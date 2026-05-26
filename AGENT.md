# Agent Instructions

- Before creating, modifying, deleting, moving, or renaming any file, list the proposed changes and affected files first.
- Wait for explicit user approval before making any file changes.
- Reading files and running non-mutating inspection commands is allowed without prior approval.
- After approved changes are made, summarize the changed files and verification performed.

## Supabase Collaboration And Database Workflow

### Who needs Supabase access

- Frontend-only development does not require Supabase Dashboard access or Supabase CLI login. The app can use the public `supabase-url` and `supabase-publishable-key` values already configured in `index.html` for browser-side testing.
- Any collaborator who needs to inspect or modify the remote database, Auth settings, Storage buckets, RLS policies, Edge Functions, or run `supabase db push` must be invited to the Supabase project first.
- The project owner should invite the collaborator from the Supabase Dashboard team/member access area for project `wwqgixluxlegrttyhrgy`. The collaborator must accept the invite before CLI linking or remote database operations.
- Never share a `service_role` key through chat, docs, committed files, browser code, `.env.example`, or screenshots. Browser code may only use public publishable/anon keys.

### Database source of truth

- `supabase/migrations/` is the source of truth for schema, RLS, functions, triggers, and Storage policies.
- Do not create or edit production tables manually in the Supabase Dashboard unless the user explicitly approves a one-off experiment.
- If Dashboard changes already exist, capture them with `npx.cmd supabase db pull` before writing new migrations.
- Once a migration has been pushed to a shared remote project, do not rewrite it. Add a new timestamped migration instead.

### Complete remote database operation flow

1. Confirm the collaborator has accepted the Supabase project invite.
2. Install project dependencies:

   ```bash
   npm.cmd install
   ```

3. Check the Supabase CLI:

   ```bash
   npx.cmd supabase --version
   ```

4. Log in to Supabase:

   ```bash
   npx.cmd supabase login
   ```

5. Link this repository to the remote Supabase project:

   ```bash
   npx.cmd supabase link --project-ref wwqgixluxlegrttyhrgy
   ```

6. Before adding new database work, inspect existing migrations and remote state:

   ```bash
   Get-ChildItem supabase\migrations
   npx.cmd supabase db push --dry-run
   ```

7. If the remote database was changed outside migrations, pull those changes first:

   ```bash
   npx.cmd supabase db pull
   ```

8. Add every schema, RLS, function, trigger, bucket, and Storage policy change as a new SQL migration under `supabase/migrations/`.
   Name files like:

   ```text
   YYYYMMDDHHMMSS_short_description.sql
   ```

9. Validate locally when possible:

   ```bash
   npx.cmd supabase db reset
   ```

10. Preview remote changes before applying them:

    ```bash
    npx.cmd supabase db push --dry-run
    ```

11. Push approved migrations to the linked Supabase project:

    ```bash
    npx.cmd supabase db push
    ```

12. Verify the result with one or more of:

    ```bash
    npx.cmd supabase migration list
    ```

    Supabase Dashboard Table Editor, SQL Editor, Auth users, and Storage bucket views are also acceptable verification surfaces.

13. Update `README.md`, `doc/Database-Architecture.md`, or related docs whenever schema, RLS, Storage, or setup behavior changes.

### Database safety rules

- Enable RLS before exposing any table to browser code.
- Write RLS policies intentionally for `select`, `insert`, `update`, and `delete`.
- Store media bytes in Supabase Storage, not Postgres. Postgres should keep metadata and Storage paths.
- Add indexes for foreign keys and common query filters.
- Keep migrations deterministic where practical by using `create extension if not exists`, `create or replace function`, and idempotent bucket inserts.
- On Windows PowerShell, prefer `npm.cmd` and `npx.cmd` because `.ps1` wrappers may be blocked by execution policy.
