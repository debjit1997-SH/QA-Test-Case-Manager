import { pgTable, foreignKey, serial, integer, text, timestamp, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const qaAccountStatus = pgEnum("qa_account_status", ['PENDING', 'ACTIVE', 'REJECTED', 'DISABLED'])
export const qaAttachmentSource = pgEnum("qa_attachment_source", ['UPLOAD', 'EXTERNAL_LINK'])
export const qaAttachmentType = pgEnum("qa_attachment_type", ['IMAGE', 'VIDEO'])
export const qaModuleStatus = pgEnum("qa_module_status", ['ACTIVE', 'INACTIVE'])
export const qaRequestStatus = pgEnum("qa_request_status", ['PENDING', 'APPROVED', 'REJECTED'])
export const qaRole = pgEnum("qa_role", ['ADMIN', 'USER'])
export const qaTestResult = pgEnum("qa_test_result", ['PASS', 'FAIL', 'BLOCKED', 'NOT_TESTED'])


export const qaTestCaseHistory = pgTable("qa_test_case_history", {
	id: serial().primaryKey().notNull(),
	testCaseId: integer("test_case_id").notNull(),
	fieldName: text("field_name").notNull(),
	previousValue: text("previous_value"),
	newValue: text("new_value"),
	changedBy: integer("changed_by").notNull(),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.changedBy],
			foreignColumns: [qaUsers.id],
			name: "qa_test_case_history_changed_by_qa_users_id_fk"
		}),
	foreignKey({
			columns: [table.testCaseId],
			foreignColumns: [qaTestCases.id],
			name: "qa_test_case_history_test_case_id_qa_test_cases_id_fk"
		}).onDelete("cascade"),
]);

export const qaTestCases = pgTable("qa_test_cases", {
	id: serial().primaryKey().notNull(),
	testCaseNumber: text("test_case_number").notNull(),
	moduleId: integer("module_id").notNull(),
	testDate: timestamp("test_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	testCaseTag: text("test_case_tag").default('Untitled test case').notNull(),
	performedByUserId: integer("performed_by_user_id").notNull(),
	description: text().notNull(),
	expectedResult: text("expected_result").notNull(),
	actualResult: text("actual_result").notNull(),
	testResult: qaTestResult("test_result").notNull(),
	passedOn: timestamp("passed_on", { withTimezone: true, mode: 'string' }),
	createdBy: integer("created_by").notNull(),
	updatedBy: integer("updated_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("qa_test_cases_number_idx").using("btree", table.testCaseNumber.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [qaUsers.id],
			name: "qa_test_cases_created_by_qa_users_id_fk"
		}),
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [qaModules.id],
			name: "qa_test_cases_module_id_qa_modules_id_fk"
		}),
	foreignKey({
			columns: [table.performedByUserId],
			foreignColumns: [qaUsers.id],
			name: "qa_test_cases_performed_by_user_id_qa_users_id_fk"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [qaUsers.id],
			name: "qa_test_cases_updated_by_qa_users_id_fk"
		}),
]);

export const qaModules = pgTable("qa_modules", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	code: text().notNull(),
	description: text(),
	status: qaModuleStatus().default('ACTIVE').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("qa_modules_code_idx").using("btree", table.code.asc().nullsLast().op("text_ops")),
	uniqueIndex("qa_modules_name_lower_idx").using("btree", sql`lower(name)`),
]);

export const qaModuleSequences = pgTable("qa_module_sequences", {
	id: serial().primaryKey().notNull(),
	moduleId: integer("module_id").notNull(),
	nextNumber: integer("next_number").default(1).notNull(),
}, (table) => [
	uniqueIndex("qa_module_sequences_module_idx").using("btree", table.moduleId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [qaModules.id],
			name: "qa_module_sequences_module_id_qa_modules_id_fk"
		}),
]);

export const qaAccessRequests = pgTable("qa_access_requests", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	requestedRole: qaRole("requested_role").notNull(),
	status: qaRequestStatus().default('PENDING').notNull(),
	rejectionReason: text("rejection_reason"),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewedBy: integer("reviewed_by"),
}, (table) => [
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [qaUsers.id],
			name: "qa_access_requests_reviewed_by_qa_users_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [qaUsers.id],
			name: "qa_access_requests_user_id_qa_users_id_fk"
		}),
]);

export const qaUsers = pgTable("qa_users", {
	id: serial().primaryKey().notNull(),
	fullName: text("full_name").notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: qaRole().default('USER').notNull(),
	accountStatus: qaAccountStatus("account_status").default('PENDING').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("qa_users_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const qaAttachments = pgTable("qa_attachments", {
	id: serial().primaryKey().notNull(),
	testCaseId: integer("test_case_id").notNull(),
	type: qaAttachmentType().notNull(),
	sourceType: qaAttachmentSource("source_type").notNull(),
	url: text().notNull(),
	fileName: text("file_name"),
	mimeType: text("mime_type"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.testCaseId],
			foreignColumns: [qaTestCases.id],
			name: "qa_attachments_test_case_id_qa_test_cases_id_fk"
		}).onDelete("cascade"),
]);
