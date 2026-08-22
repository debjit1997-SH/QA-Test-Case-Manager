import { hash } from "./lib/seed-utils";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
const defaultModules = [
  ["Login", "LOGIN", "Authentication and session access"],
  ["User Management", "USERS", "Accounts, access, and permissions"],
  ["GRN", "GRN", "Goods received note workflows"],
  ["Billing", "BILLING", "Billing and payment workflows"],
  ["Inventory", "INVENTORY", "Stock and inventory control"],
  ["Reports", "REPORTS", "Operational and management reports"],
];
export async function seed() {
  for (const [name, code, description] of defaultModules) {
    const existing = await pool.query(
      "select id from qa_modules where upper(code)=upper($1)",
      [code],
    );
    if (!existing.rows[0]) {
      await pool.query(
        "insert into qa_modules(name,code,description) values($1,$2,$3)",
        [name, code, description],
      );
    }
  }
  if (process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
    const existing = await pool.query("select id from qa_users where email=$1", [process.env.INITIAL_ADMIN_EMAIL.toLowerCase()]);
    if (!existing.rows[0]) {
      await pool.query(
        "insert into qa_users(full_name,email,password_hash,role,account_status) values($1,$2,$3,'ADMIN','ACTIVE')",
        [process.env.INITIAL_ADMIN_NAME || "QA Administrator", process.env.INITIAL_ADMIN_EMAIL.toLowerCase(), hash(process.env.INITIAL_ADMIN_PASSWORD)],
      );
    }
  }
  logger.info("QA Test Case Manager seed completed");
}