-- Additive V1 upgrade. Do not drop or reset existing QA data.
DO $$ BEGIN
  CREATE TYPE qa_module_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE qa_modules ADD COLUMN IF NOT EXISTS status qa_module_status NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE qa_test_cases ADD COLUMN IF NOT EXISTS test_case_tag text NOT NULL DEFAULT 'Untitled test case';
ALTER TABLE qa_test_cases ADD COLUMN IF NOT EXISTS passed_on timestamptz;

DROP INDEX IF EXISTS qa_modules_code_idx;
DROP INDEX IF EXISTS qa_modules_name_lower_idx;
CREATE UNIQUE INDEX IF NOT EXISTS qa_modules_name_code_idx ON qa_modules (lower(name), upper(code));
CREATE UNIQUE INDEX IF NOT EXISTS qa_test_cases_number_idx ON qa_test_cases (test_case_number);
