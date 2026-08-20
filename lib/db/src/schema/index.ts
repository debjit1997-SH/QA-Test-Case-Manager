import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("qa_role", ["ADMIN", "USER"]);
export const accountStatusEnum = pgEnum("qa_account_status", [
  "PENDING",
  "ACTIVE",
  "REJECTED",
  "DISABLED",
]);
export const requestStatusEnum = pgEnum("qa_request_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
export const resultEnum = pgEnum("qa_test_result", [
  "PASS",
  "FAIL",
  "BLOCKED",
  "NOT_TESTED",
]);
export const attachmentTypeEnum = pgEnum("qa_attachment_type", ["IMAGE", "VIDEO"]);
export const attachmentSourceEnum = pgEnum("qa_attachment_source", [
  "UPLOAD",
  "EXTERNAL_LINK",
]);

export const users = pgTable("qa_users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("USER"),
  accountStatus: accountStatusEnum("account_status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("qa_users_email_idx").on(table.email)]);

export const accessRequests = pgTable("qa_access_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  requestedRole: roleEnum("requested_role").notNull(),
  status: requestStatusEnum("status").notNull().default("PENDING"),
  rejectionReason: text("rejection_reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: integer("reviewed_by").references(() => users.id),
});

export const modules = pgTable("qa_modules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("qa_modules_code_idx").on(table.code)]);

export const moduleSequences = pgTable("qa_module_sequences", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id").notNull().references(() => modules.id),
  nextNumber: integer("next_number").notNull().default(1),
}, (table) => [uniqueIndex("qa_module_sequences_module_idx").on(table.moduleId)]);

export const testCases = pgTable("qa_test_cases", {
  id: serial("id").primaryKey(),
  testCaseNumber: text("test_case_number").notNull(),
  moduleId: integer("module_id").notNull().references(() => modules.id),
  testDate: timestamp("test_date", { withTimezone: true }).defaultNow().notNull(),
  performedByUserId: integer("performed_by_user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  expectedResult: text("expected_result").notNull(),
  actualResult: text("actual_result").notNull(),
  testResult: resultEnum("test_result").notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  updatedBy: integer("updated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("qa_test_cases_number_idx").on(table.testCaseNumber)]);

export const attachments = pgTable("qa_attachments", {
  id: serial("id").primaryKey(),
  testCaseId: integer("test_case_id").notNull().references(() => testCases.id, { onDelete: "cascade" }),
  type: attachmentTypeEnum("type").notNull(),
  sourceType: attachmentSourceEnum("source_type").notNull(),
  url: text("url").notNull(),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const testCaseHistory = pgTable("qa_test_case_history", {
  id: serial("id").primaryKey(),
  testCaseId: integer("test_case_id").notNull().references(() => testCases.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  changedBy: integer("changed_by").notNull().references(() => users.id),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
});