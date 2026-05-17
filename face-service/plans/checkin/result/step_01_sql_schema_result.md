# Step 01 Result — SQL Schema for Staffs and Attendances

## Status

DONE

## Plan File

`plans/checkin/plan_step_by_step/01_sql_schema.md`

## Implemented Files

- `sql/01_create_attendance_tables.sql`
- `plans/checkin/plan_step_by_step/01_sql_schema.md`
- `plans/checkin/plan_step_by_step/PROGRESS.json`

## Summary

Step 01 created the shared MySQL schema for the check-in/check-out flow.

Implemented:

- Created the `sql` directory.
- Added `staffs` table with the full employee attributes requested for the shared database.
- Added `attendances` table with employee id, check type, check timestamp, check date, and `on_time`.
- Used `PRIMARY KEY (employee_id, type, check_date)` to prevent duplicate check-in/check-out records for the same employee on the same date.
- Added foreign key from `attendances.employee_id` to `staffs.employee_id`.
- Added SQL comments for generated employee ids, password hashing, app-timezone check dates, and duplicate/race protection.

## Schema Decisions

- `staffs.employee_id` is the primary key and is not auto-increment, because employee ids may use formats such as `NV001`.
- `staffs.password_hash` stores only the password hash. The plain default password derived from date of birth must not be stored.
- `attendances` does not include an `id` column in this step.
- `attendances` does not include `similarity_score` in this step, because the requested attendance table fields were employee id, type, check time, check date, and `on_time`.
- `attendances.on_time` is `BOOLEAN NOT NULL`. The business logic for true/false will be implemented in later service steps.

## Verification

Performed:

- Read back `sql/01_create_attendance_tables.sql`.
- Checked that required `staffs` fields exist:
  - `employee_id`
  - `full_name`
  - `department`
  - `position`
  - `onboard_date`
  - `status`
  - `phone`
  - `personal_email`
  - `national_id`
  - `bank_account`
  - `bank_name`
  - `date_of_birth`
  - `password_hash`
- Checked that required `attendances` fields exist:
  - `employee_id`
  - `type`
  - `check_time`
  - `check_date`
  - `on_time`
- Confirmed indexes and foreign key are present in the SQL file.

Not performed:

- Did not execute SQL against MySQL because `mysql` client was not available in PATH.
- Did not update Docker init mount; that belongs to step 02.

## Follow-up

Next suggested step:

- `plans/checkin/plan_step_by_step/02_docker_init_sql.md`

## Reporting Rule Added

From this point onward, each completed plan step must produce a result report under:

`plans/checkin/result/`

Suggested naming:

`step_XX_<short_name>_result.md`

