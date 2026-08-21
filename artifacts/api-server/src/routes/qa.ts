import { Router, type Request, type Response } from "express";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();
const sessions = new Map<string, number>();
const now = () => new Date();
const hasText = (value: unknown) => typeof value === "string" && value.replace(/<[^>]*>/g, "").trim().length > 0;
const publicUser = (u: any) => ({
  id: u.id, fullName: u.full_name, email: u.email, role: u.role,
  accountStatus: u.account_status, createdAt: u.created_at,
});
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
const verifyPassword = (password: string, stored: string) => {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(key, "hex"));
};
const getUser = async (req: Request) => {
  const token = req.cookies?.qa_session;
  const id = token ? sessions.get(token) : undefined;
  if (!id) return null;
  const result = await pool.query("select * from qa_users where id=$1", [id]);
  return result.rows[0] ?? null;
};
const requireUser = async (req: Request, res: Response) => {
  const user = await getUser(req);
  if (!user || user.account_status !== "ACTIVE") {
    res.status(401).json({ error: "You must be signed in." });
    return null;
  }
  return user;
};
const requireAdmin = async (req: Request, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== "ADMIN") {
    res.status(403).json({ error: "You do not have permission to access this page." });
    return null;
  }
  return user;
};
const formatAttachment = (a: any) => ({
  id: a.id, type: a.type, sourceType: a.source_type, url: a.url,
  fileName: a.file_name, mimeType: a.mime_type,
});
const formatModule = (r: any) => ({ id: r.id, name: r.name, code: r.code, description: r.description, status: r.status, testCaseCount: Number(r.test_case_count ?? 0), passCount: Number(r.pass_count ?? 0), failCount: Number(r.fail_count ?? 0), blockedCount: Number(r.blocked_count ?? 0) });
const testCaseSelect = `
  select tc.*, m.name as module_name, pu.full_name as performed_by,
    cb.full_name as created_by_name, ub.full_name as updated_by_name,
    (select count(*) from qa_attachments a where a.test_case_id=tc.id)::int as attachment_count
  from qa_test_cases tc join qa_modules m on m.id=tc.module_id
  join qa_users pu on pu.id=tc.performed_by_user_id
  join qa_users cb on cb.id=tc.created_by join qa_users ub on ub.id=tc.updated_by`;
const formatTestCase = (r: any) => ({
  id: r.id, testCaseNumber: r.test_case_number, moduleId: r.module_id, moduleName: r.module_name,
  testDate: r.test_date, testCaseTag: r.test_case_tag, description: r.description, expectedResult: r.expected_result,
  actualResult: r.actual_result, testResult: r.test_result, passedOn: r.passed_on, performedBy: r.performed_by,
  performedByUserId: r.performed_by_user_id, createdBy: r.created_by_name, updatedBy: r.updated_by_name,
  createdByUserId: r.created_by,
  createdAt: r.created_at, updatedAt: r.updated_at, attachmentCount: r.attachment_count,
});

router.get("/auth/session", async (req, res) => {
  const user = await getUser(req);
  res.json({ authenticated: Boolean(user && user.account_status === "ACTIVE"), user: user ? publicUser(user) : null });
});
router.post("/auth/login", async (req, res) => {
  const email = String(req.body.email ?? "").toLowerCase().trim();
  const result = await pool.query("select * from qa_users where email=$1", [email]);
  const user = result.rows[0];
  if (!user || user.account_status !== "ACTIVE" || !verifyPassword(String(req.body.password ?? ""), user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." }); return;
  }
  const token = randomBytes(32).toString("hex");
  sessions.set(token, user.id);
  res.cookie("qa_session", token, { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 12 });
  res.json({ authenticated: true, user: publicUser(user) });
});
router.post("/auth/logout", (req, res) => {
  const token = req.cookies?.qa_session;
  if (token) sessions.delete(token);
  res.clearCookie("qa_session"); res.status(204).end();
});
router.post("/auth/access-requests", async (req, res) => {
  const { fullName, email, password, confirmPassword, requestedRole } = req.body;
  if (!fullName || !email || !password || password !== confirmPassword || !["ADMIN", "USER"].includes(requestedRole)) {
    res.status(400).json({ error: "Please complete all fields with valid values." }); return;
  }
  try {
    const result = await pool.query(
      "insert into qa_users(full_name,email,password_hash,role,account_status) values($1,$2,$3,$4,'PENDING') returning *",
      [String(fullName).trim(), String(email).toLowerCase().trim(), hashPassword(password), requestedRole],
    );
    const u = result.rows[0];
    const request = await pool.query(
      "insert into qa_access_requests(user_id,requested_role) values($1,$2) returning *", [u.id, requestedRole],
    );
    res.status(201).json({ id: request.rows[0].id, userId: u.id, fullName: u.full_name, email: u.email, requestedRole, status: "PENDING", requestedAt: request.rows[0].requested_at, rejectionReason: null, reviewedAt: null, reviewedBy: null });
  } catch {
    res.status(409).json({ error: "An account with this email already exists." });
  }
});
router.get("/dashboard/summary", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const [counts, modules, users, pending, recent] = await Promise.all([
    pool.query("select test_result, count(*)::int as count from qa_test_cases group by test_result"),
    pool.query("select count(*)::int as count from qa_modules"),
    pool.query("select count(*)::int as count from qa_users where account_status='ACTIVE'"),
    pool.query("select count(*)::int as count from qa_access_requests where status='PENDING'"),
    pool.query("select h.*, u.full_name as changed_by from qa_test_case_history h join qa_users u on u.id=h.changed_by order by h.changed_at desc limit 6"),
  ]);
  const by = Object.fromEntries(counts.rows.map((r: any) => [r.test_result, r.count]));
  res.json({ totalTestCases: Object.values(by).reduce((a: any, b: any) => a + b, 0), totalModules: modules.rows[0].count, pass: by.PASS ?? 0, fail: by.FAIL ?? 0, blocked: by.BLOCKED ?? 0, notTested: by.NOT_TESTED ?? 0, totalUsers: users.rows[0].count, pendingRequests: pending.rows[0].count, recentActivity: recent.rows.map((r: any) => ({ id: r.id, fieldName: r.field_name, previousValue: r.previous_value, newValue: r.new_value, changedBy: r.changed_by, changedAt: r.changed_at })) });
});
router.get("/modules", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const result = await pool.query(`select m.*, count(tc.id)::int as test_case_count,
    count(tc.id) filter(where tc.test_result='PASS')::int as pass_count,
    count(tc.id) filter(where tc.test_result='FAIL')::int as fail_count,
    count(tc.id) filter(where tc.test_result='BLOCKED')::int as blocked_count
    from qa_modules m left join qa_test_cases tc on tc.module_id=m.id group by m.id order by m.name`);
  res.json(result.rows.map(formatModule));
});
router.post("/modules", async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const name = String(req.body.name ?? "").trim(), code = String(req.body.code ?? "").trim().toUpperCase();
  if (!name || !code) { res.status(400).json({ error: "Module name and code are required." }); return; }
  try { const result = await pool.query("insert into qa_modules(name,code,description) values($1,$2,$3) returning *", [name, code, req.body.description || null]); res.status(201).json(formatModule(result.rows[0])); }
  catch { res.status(409).json({ error: "A module with this name or code already exists." }); }
});
router.patch("/modules/:id", async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const id = Number(req.params.id), current = await pool.query("select * from qa_modules where id=$1", [id]);
  if (!current.rows[0]) { res.status(404).json({ error: "Module not found." }); return; }
  const old = current.rows[0];
  const next = { ...old, name: String(req.body.name ?? old.name).trim(), code: req.body.code ? String(req.body.code).trim().toUpperCase() : old.code, description: req.body.description ?? old.description, status: req.body.status ?? old.status };
  try {
    const result = await pool.query("update qa_modules set name=$1,code=$2,description=$3,status=$4,updated_at=now() where id=$5 returning *", [next.name, next.code, next.description, next.status, id]);
    const count = await pool.query("select count(*)::int as count, count(*) filter(where test_result='PASS')::int as pass, count(*) filter(where test_result='FAIL')::int as fail, count(*) filter(where test_result='BLOCKED')::int as blocked from qa_test_cases where module_id=$1", [id]);
    const r = result.rows[0];
    res.json({ id: r.id, name: r.name, code: r.code, description: r.description, status: r.status, testCaseCount: count.rows[0].count, passCount: count.rows[0].pass, failCount: count.rows[0].fail, blockedCount: count.rows[0].blocked });
  }
  catch { res.status(409).json({ error: "A module with this name or code already exists." }); }
});
router.get("/test-cases", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const vals: any[] = []; const where: string[] = [];
  if (req.query.moduleId) { vals.push(Number(req.query.moduleId)); where.push(`tc.module_id=$${vals.length}`); }
  if (req.query.result) { vals.push(String(req.query.result)); where.push(`tc.test_result=$${vals.length}`); }
  if (req.query.tag) { vals.push(`%${String(req.query.tag).toLowerCase()}%`); where.push(`lower(tc.test_case_tag) like $${vals.length}`); }
  if (req.query.from) { vals.push(String(req.query.from)); where.push(`tc.test_date >= $${vals.length}::date`); }
  if (req.query.to) { vals.push(String(req.query.to)); where.push(`tc.test_date < ($${vals.length}::date + interval '1 day')`); }
  if (req.query.search) { vals.push(`%${String(req.query.search).toLowerCase()}%`); where.push(`(lower(tc.test_case_number) like $${vals.length} or lower(tc.test_case_tag) like $${vals.length} or lower(pu.full_name) like $${vals.length} or cast(tc.id as text) like $${vals.length})`); }
  const clause = where.length ? ` where ${where.join(" and ")}` : "";
  const page = Math.max(Number(req.query.page ?? 1), 1), pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
  const count = await pool.query(`select count(*)::int as count from qa_test_cases tc join qa_users pu on pu.id=tc.performed_by_user_id${clause}`, vals);
  const result = await pool.query(`${testCaseSelect}${clause} order by tc.updated_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`, vals);
  res.json({ items: result.rows.map(formatTestCase), total: count.rows[0].count, page, pageSize });
});
router.get("/admin/test-cases/by-number/:number", async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const result = await pool.query(`${testCaseSelect} where tc.test_case_number=$1`, [String(req.params.number).trim()]);
  if (!result.rows[0]) { res.status(404).json({ error: "Test case not found." }); return; }
  const [a, h] = await Promise.all([pool.query("select * from qa_attachments where test_case_id=$1 order by id", [result.rows[0].id]), pool.query("select h.*, u.full_name as changed_by from qa_test_case_history h join qa_users u on u.id=h.changed_by where h.test_case_id=$1 order by h.changed_at desc", [result.rows[0].id])]);
  res.json({ ...formatTestCase(result.rows[0]), attachments: a.rows.map(formatAttachment), history: h.rows });
});
router.post("/test-cases", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const { moduleId, testCaseTag, description, expectedResult, actualResult, testResult, attachments: incoming = [] } = req.body;
  if (!moduleId || !testCaseTag || !hasText(description) || !hasText(expectedResult) || !hasText(actualResult) || !testResult) { res.status(400).json({ error: "Please complete all required fields." }); return; }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const moduleResult = await client.query("select * from qa_modules where id=$1 for update", [Number(moduleId)]);
    if (!moduleResult.rows[0] || moduleResult.rows[0].status !== "ACTIVE") throw new Error("module");
    const module = moduleResult.rows[0];
    if (module.status !== "ACTIVE") throw new Error("inactive");
    const seq = await client.query("insert into qa_module_sequences(module_id,next_number) values($1,2) on conflict(module_id) do update set next_number=qa_module_sequences.next_number+1 returning next_number-1 as number", [module.id]);
    const number = seq.rows[0]?.number ?? 1;
    const tc = await client.query(`insert into qa_test_cases(test_case_number,module_id,test_case_tag,performed_by_user_id,description,expected_result,actual_result,test_result,passed_on,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,case when $8='PASS'::qa_test_result then now() else null end,$4,$4) returning id`, [`${module.code}-TC-${String(number).padStart(3, "0")}`, module.id, testCaseTag, user.id, description, expectedResult, actualResult ?? "", testResult]);
    for (const a of incoming) await client.query("insert into qa_attachments(test_case_id,type,source_type,url,file_name,mime_type) values($1,$2,$3,$4,$5,$6)", [tc.rows[0].id, a.type, a.sourceType, a.url, a.fileName ?? null, a.mimeType ?? null]);
    await client.query("commit");
    const created = await pool.query(`${testCaseSelect} where tc.id=$1`, [tc.rows[0].id]);
    res.status(201).json(formatTestCase(created.rows[0]));
  } catch (error) { await client.query("rollback").catch(() => undefined); logger.error({ err: error }, "Unable to create test case"); res.status(400).json({ error: "Could not save the test case. Please check all required fields and try again." }); } finally { client.release(); }
});
router.get("/test-cases/:id", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const result = await pool.query(`${testCaseSelect} where tc.id=$1`, [Number(req.params.id)]);
  if (!result.rows[0]) { res.status(404).json({ error: "Test case not found." }); return; }
  const [a, h] = await Promise.all([
    pool.query("select * from qa_attachments where test_case_id=$1 order by id", [Number(req.params.id)]),
    pool.query("select h.*, u.full_name as changed_by from qa_test_case_history h join qa_users u on u.id=h.changed_by where h.test_case_id=$1 order by h.changed_at desc", [Number(req.params.id)]),
  ]);
  res.json({ ...formatTestCase(result.rows[0]), attachments: a.rows.map(formatAttachment), history: h.rows.map((r: any) => ({ id: r.id, fieldName: r.field_name, previousValue: r.previous_value, newValue: r.new_value, changedBy: r.changed_by, changedAt: r.changed_at })) });
});
router.patch("/test-cases/:id", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const id = Number(req.params.id); const current = await pool.query("select * from qa_test_cases where id=$1", [id]);
  if (!current.rows[0]) { res.status(404).json({ error: "Test case not found." }); return; }
  const old = current.rows[0];
  if (user.role !== "ADMIN" && old.created_by !== user.id) { res.status(403).json({ error: "You do not have permission to edit this test case." }); return; }
  const next = { ...old, module_id: req.body.moduleId ?? old.module_id, test_case_tag: req.body.testCaseTag ?? old.test_case_tag, description: req.body.description ?? old.description, expected_result: req.body.expectedResult ?? old.expected_result, actual_result: req.body.actualResult ?? old.actual_result, test_result: req.body.testResult ?? old.test_result, test_date: req.body.testDate ?? old.test_date };
  if (!hasText(next.description) || !hasText(next.actual_result)) { res.status(400).json({ error: "Please complete all required fields." }); return; }
  await pool.query("update qa_test_cases set module_id=$1,test_case_tag=$2,description=$3,expected_result=$4,actual_result=$5,test_result=$6,test_date=$7,passed_on=case when $6='PASS' and $8 <> 'PASS' then now() when $6='PASS' then passed_on else null end,updated_by=$9,updated_at=now() where id=$10", [next.module_id, next.test_case_tag, next.description, next.expected_result, next.actual_result, next.test_result, next.test_date, old.test_result, user.id, id]);
  for (const key of ["module_id", "test_case_tag", "description", "expected_result", "actual_result", "test_result", "test_date"]) if (String(old[key]) !== String(next[key])) await pool.query("insert into qa_test_case_history(test_case_id,field_name,previous_value,new_value,changed_by) values($1,$2,$3,$4,$5)", [id, key, String(old[key]), String(next[key]), user.id]);
  const updated = await pool.query(`${testCaseSelect} where tc.id=$1`, [id]); res.json(formatTestCase(updated.rows[0]));
});
router.delete("/test-cases/:id", async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const result = await pool.query("delete from qa_test_cases where id=$1 returning id", [Number(req.params.id)]);
  if (!result.rows[0]) { res.status(404).json({ error: "Test case not found." }); return; }
  res.status(204).end();
});
router.get("/users", async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const [requests, active] = await Promise.all([
    pool.query("select ar.*, u.full_name,u.email from qa_access_requests ar join qa_users u on u.id=ar.user_id where ar.status='PENDING' order by ar.requested_at"),
    pool.query("select * from qa_users where account_status in ('ACTIVE','DISABLED') order by created_at"),
  ]);
  res.json({ pendingRequests: requests.rows.map((r: any) => ({ id: r.id, userId: r.user_id, fullName: r.full_name, email: r.email, requestedRole: r.requested_role, status: r.status, rejectionReason: r.rejection_reason, requestedAt: r.requested_at, reviewedAt: r.reviewed_at, reviewedBy: null })), activeUsers: active.rows.map(publicUser) });
});
router.post("/users/access-requests/:id/approve", async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const id = Number(req.params.id); const result = await pool.query("select * from qa_access_requests where id=$1", [id]);
  if (!result.rows[0]) { res.status(404).json({ error: "Request not found." }); return; }
  const r = result.rows[0]; await pool.query("update qa_users set role=$1,account_status='ACTIVE',updated_at=now() where id=$2", [r.requested_role, r.user_id]); const updated = await pool.query("update qa_access_requests set status='APPROVED',reviewed_at=now(),reviewed_by=$1 where id=$2 returning *", [user.id, id]);
  res.json({ ...r, status: updated.rows[0].status });
});
router.post("/users/access-requests/:id/reject", async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  if (!req.body.reason || String(req.body.reason).trim().length < 3) { res.status(400).json({ error: "A rejection reason is required." }); return; }
  const result = await pool.query("select * from qa_access_requests where id=$1", [Number(req.params.id)]); if (!result.rows[0]) { res.status(404).json({ error: "Request not found." }); return; }
  const r = result.rows[0]; await pool.query("update qa_users set account_status='REJECTED',updated_at=now() where id=$1", [r.user_id]); const updated = await pool.query("update qa_access_requests set status='REJECTED',rejection_reason=$1,reviewed_at=now(),reviewed_by=$2 where id=$3 returning *", [String(req.body.reason).trim(), user.id, Number(req.params.id)]); res.json({ ...r, status: updated.rows[0].status, rejectionReason: updated.rows[0].rejection_reason });
});
router.patch("/users/:id", async (req, res) => {
  const user = await requireAdmin(req, res); if (!user) return;
  const id = Number(req.params.id); if (id === user.id && req.body.role && req.body.role !== "ADMIN") { res.status(400).json({ error: "The last administrator cannot be demoted." }); return; }
  const target = await pool.query("select * from qa_users where id=$1", [id]); if (!target.rows[0]) { res.status(404).json({ error: "User not found." }); return; }
  const nextRole = req.body.role ?? target.rows[0].role, nextStatus = req.body.accountStatus ?? target.rows[0].account_status;
  if (target.rows[0].role === "ADMIN" && nextRole !== "ADMIN") { const count = await pool.query("select count(*)::int as count from qa_users where role='ADMIN' and account_status='ACTIVE'"); if (count.rows[0].count <= 1) { res.status(400).json({ error: "The last active administrator cannot be demoted." }); return; } }
  const updated = await pool.query("update qa_users set role=$1,account_status=$2,updated_at=now() where id=$3 returning *", [nextRole, nextStatus, id]); res.json(publicUser(updated.rows[0]));
});
router.get("/profile", async (req, res) => { const user = await requireUser(req, res); if (user) res.json(publicUser(user)); });
router.post("/profile/password", async (req, res) => { const user = await requireUser(req, res); if (!user) return; if (!verifyPassword(String(req.body.currentPassword ?? ""), user.password_hash) || req.body.newPassword !== req.body.confirmPassword) { res.status(400).json({ error: "Current password or confirmation is invalid." }); return; } await pool.query("update qa_users set password_hash=$1,updated_at=now() where id=$2", [hashPassword(req.body.newPassword), user.id]); res.status(204).end(); });

export default router;