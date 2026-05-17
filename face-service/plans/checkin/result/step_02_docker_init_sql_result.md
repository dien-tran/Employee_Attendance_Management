# Step 02 Result — Docker Init SQL

## Status

DONE

## Plan File

`plans/checkin/plan_step_by_step/02_docker_init_sql.md`

## Implemented Files

- `docker-compose.yml`
- `plans/checkin/plan_step_by_step/PROGRESS.json`

## Summary

Step 02 updated the MySQL service in `docker-compose.yml` so a new MySQL data volume can initialize schema files from the repository `sql` directory.

Implemented:

- Added read-only bind mount:
  - `./sql:/docker-entrypoint-initdb.d:ro`
- Added comments explaining that MySQL init SQL only runs when `mysql_data` is empty.
- Did not remove, reset, or modify any Docker volume.

## Verification

Performed:

- Ran `docker compose config`.
- Confirmed rendered config includes:
  - Source: repository `sql` directory.
  - Target: `/docker-entrypoint-initdb.d`.
  - `read_only: true`.

Command result:

- `docker compose config` completed successfully.

Warnings:

- Docker emitted warnings that it could not read `C:\Users\ADMIN\.docker\config.json` due to access denied.
- These warnings did not prevent compose config rendering.

## Important Note

MySQL only runs files under `/docker-entrypoint-initdb.d` when the data directory is empty.

If `mysql_data` already exists, `sql/01_create_attendance_tables.sql` will not run automatically. Existing databases need a migration step or an explicitly approved volume reset.

## Follow-up

Next suggested step:

- `plans/checkin/plan_step_by_step/03_config_checkin_attendance.md`

