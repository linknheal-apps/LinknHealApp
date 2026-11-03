# Migrations



Rules for every file in this folder:



- All schema changes are migration files only. Never run ad-hoc SQL in the Supabase dashboard.

- One concern per file. Filename format: `YYYYMMDDHHMMSS_description.sql`.

- Every new table that holds client data must ENABLE and FORCE row level security in the SAME migration file that creates it.

- Policies must name their role explicitly (`to authenticated`) and use `(select auth.uid())` for identity.



Status: schema is not defined yet. Do NOT copy SQL from `docs/plan.md`. It has known defects pending review.

