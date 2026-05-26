---
name: supabase-auto-migrations
description: Use when a project needs Supabase CLI database migrations, Postgres schema changes, RLS policies, Storage bucket policies, or browser Supabase client configuration.
---

# Supabase Auto Migrations

Use Supabase migrations as the source of truth. Do not create production tables by clicking in Dashboard unless the user explicitly asks for a one-off experiment; if Dashboard changes already exist, capture them with `supabase db pull` before continuing.

## Workflow

1. Inspect `supabase/migrations/`, `.env.example`, frontend entry files, and any database architecture docs.
2. If `supabase/config.toml` is missing, tell the user to run or approve `supabase init`.
3. Check CLI/auth/link status:
   - `supabase --version`
   - `supabase login`
   - `supabase link --project-ref <project-ref>`
   - In this Windows PowerShell project, prefer `npx.cmd supabase ...` when using the local npm CLI because `npx.ps1` may be blocked by execution policy.
4. Write every schema, RLS, function, trigger, and Storage policy change as a timestamped SQL migration under `supabase/migrations/`.
5. Validate locally when possible:
   - `supabase db reset` for local migrations
   - `supabase db push --dry-run` before remote push when supported
6. Push remote migrations with `supabase db push`.
7. Verify through SQL or Dashboard Table Editor, then update docs.

## Migration Rules

- Name files like `YYYYMMDDHHMMSS_short_description.sql`.
- Keep migrations deterministic and safe to rerun where practical: use `create extension if not exists`, `create or replace function`, and `insert ... on conflict` for bucket setup.
- Put RLS in migrations, not only in Dashboard toggles.
- Enable RLS before exposing tables to frontend code.
- Add indexes for foreign keys and common queries.
- Keep media bytes in Supabase Storage; store only metadata and Storage paths in Postgres.
- Never put `service_role` keys in browser code, `.env.example`, README examples, or committed files.

## Frontend Configuration

For this project's static HTML setup, prefer a small browser client wrapper:

- `index.html` stores public placeholders in meta tags.
- `js/supabaseClient.js` reads the meta tags and creates `window.VideoEditingSupabase`.
- `.env.example` documents the same values for future build tooling and CLI-driven workflows.

Only these values may be exposed to the browser:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

The anon key is public by design, but data safety depends on RLS policies. Treat missing RLS as a blocker before adding reads or writes from the frontend.

## Common Commands

```bash
supabase login
supabase init
supabase link --project-ref <project-ref>
supabase db pull
supabase db reset
supabase db push
```

For the project-local CLI on Windows PowerShell, replace `supabase` with `npx.cmd supabase`.

Use `supabase db pull` when the remote database was changed outside migrations. Use `supabase db push` when local migrations should be applied to the linked remote project.

## Review Checklist

- Migrations exist for schema, RLS, Storage, and helper functions.
- The frontend uses anon key only.
- `service_role` is absent from browser code and committed examples.
- RLS policies cover `select`, `insert`, `update`, and `delete` intentionally.
- Storage policies match the path convention.
- README tells humans how to link and push migrations.
