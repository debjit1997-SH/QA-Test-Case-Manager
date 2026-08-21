-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."qa_account_status" AS ENUM('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED');--> statement-breakpoint
CREATE TYPE "public"."qa_attachment_source" AS ENUM('UPLOAD', 'EXTERNAL_LINK');--> statement-breakpoint
CREATE TYPE "public"."qa_attachment_type" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."qa_module_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."qa_request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."qa_role" AS ENUM('ADMIN', 'USER');--> statement-breakpoint
CREATE TYPE "public"."qa_test_result" AS ENUM('PASS', 'FAIL', 'BLOCKED', 'NOT_TESTED');--> statement-breakpoint
CREATE TABLE "qa_test_case_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_case_id" integer NOT NULL,
	"field_name" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"changed_by" integer NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_test_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_case_number" text NOT NULL,
	"module_id" integer NOT NULL,
	"test_date" timestamp with time zone DEFAULT now() NOT NULL,
	"test_case_tag" text DEFAULT 'Untitled test case' NOT NULL,
	"performed_by_user_id" integer NOT NULL,
	"description" text NOT NULL,
	"expected_result" text NOT NULL,
	"actual_result" text NOT NULL,
	"test_result" "qa_test_result" NOT NULL,
	"passed_on" timestamp with time zone,
	"created_by" integer NOT NULL,
	"updated_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"status" "qa_module_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_module_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"requested_role" "qa_role" NOT NULL,
	"status" "qa_request_status" DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer
);
--> statement-breakpoint
CREATE TABLE "qa_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "qa_role" DEFAULT 'USER' NOT NULL,
	"account_status" "qa_account_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_case_id" integer NOT NULL,
	"type" "qa_attachment_type" NOT NULL,
	"source_type" "qa_attachment_source" NOT NULL,
	"url" text NOT NULL,
	"file_name" text,
	"mime_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qa_test_case_history" ADD CONSTRAINT "qa_test_case_history_changed_by_qa_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."qa_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_test_case_history" ADD CONSTRAINT "qa_test_case_history_test_case_id_qa_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."qa_test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_test_cases" ADD CONSTRAINT "qa_test_cases_created_by_qa_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."qa_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_test_cases" ADD CONSTRAINT "qa_test_cases_module_id_qa_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."qa_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_test_cases" ADD CONSTRAINT "qa_test_cases_performed_by_user_id_qa_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."qa_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_test_cases" ADD CONSTRAINT "qa_test_cases_updated_by_qa_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."qa_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_module_sequences" ADD CONSTRAINT "qa_module_sequences_module_id_qa_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."qa_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_access_requests" ADD CONSTRAINT "qa_access_requests_reviewed_by_qa_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."qa_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_access_requests" ADD CONSTRAINT "qa_access_requests_user_id_qa_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."qa_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_attachments" ADD CONSTRAINT "qa_attachments_test_case_id_qa_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."qa_test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "qa_test_cases_number_idx" ON "qa_test_cases" USING btree ("test_case_number" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "qa_modules_code_idx" ON "qa_modules" USING btree ("code" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "qa_modules_name_lower_idx" ON "qa_modules" USING btree (lower(name) text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "qa_module_sequences_module_idx" ON "qa_module_sequences" USING btree ("module_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "qa_users_email_idx" ON "qa_users" USING btree ("email" text_ops);
*/