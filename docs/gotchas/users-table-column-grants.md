# `users` Table: Column-Level Grants and Schema/DB Drift

- **`users` has column-level `SELECT` grants, not table-wide.** `anon` and `authenticated` can read
  only `id, name, profile_image, bio, gender, skill_level, created_at, updated_at`. `email`, `phone`
  and `provider` are **not** readable (see the "users 연락처 조회 제한" section at the end of
  `supabase-schema.sql`). RLS is row-level, so the "Users can read all users" policy alone could never
  hide those columns — that is why this uses `REVOKE SELECT` + `GRANT SELECT (cols)`. Consequences:
  - `.select('*')` on `users`, or any select/embed that names `email`/`phone`/`provider`, fails with
    "permission denied". It is loud, but it is easy to hit through an embedded select such as
    `user:users(*)`. Always list columns explicitly.
  - The owner reads their own email/phone through the `SECURITY DEFINER` function
    `get_my_contact()` (`supabase.rpc('get_my_contact')`, see `src/app/profile/page.tsx`). Never
    surface another user's email/phone anywhere.
  - Read the login method from `user.app_metadata.provider` (the session), not from `users.provider`.
  - A new `users` column that clients should read needs its own `GRANT SELECT (col) ON users` —
    adding the column alone leaves it unreadable. A new personal-data column also triggers
    `docs/gotchas/legal-pages-maintenance.md`.
  - `src/lib/supabase.ts`'s hand-written `Database` type still lists `email`/`phone` on
    `users.Row`. It is type drift, not a promise that those columns are selectable.
- **Rollout order for a column `REVOKE` matters.** The safe order was: (1) create the new function
  (additive, nothing breaks), (2) deploy code that no longer selects the column, (3) only then run the
  `REVOKE`. Revoking first breaks the code that is still deployed. Rollback is one line:
  `GRANT SELECT ON users TO anon, authenticated;`.
- **Before a `REVOKE` or column drop, audit every call site.** Grep for `from('users')`, `users!`,
  `:users(`, `users(`, `select('*')` and `.email`/`.phone`. The embedded forms
  (`creator:users!creator_id(...)`, `user:users(...)` inside `badminton_sessions` /
  `session_participants` / `teams` selects, in both API routes and hooks) are the ones that get
  missed.
- **A Supabase `.update()` that matches no row, or is filtered out by RLS, returns no error and zero
  rows.** To know a write landed, chain `.select('id')` and check `data.length` (see
  `EmailOnboardingModal.saveName`). To create a row only if it is missing, use
  `upsert(row, { onConflict: 'id', ignoreDuplicates: true })` (see `auth/callback/page.tsx`).
- **The dev-only policy "Allow all operations for development" (`FOR ALL USING (true)`) is gone from
  `users`.** Writes now rely on the own-profile INSERT/UPDATE policies. Do not re-add a permissive
  policy to "unblock" a query; fix the query or the grant instead.
- **`supabase-schema.sql` is the intended schema, not a guarantee of the live DB.** On 2026-10-07 the
  live `users` table lacked the two own-profile policies the file declared, so the dev policy was
  the only thing allowing writes — dropping it on the file's say-so would have blocked every write.
  Before changing or dropping an existing policy, ask the user to run a read-only query in the
  Supabase SQL editor and read the result first:
  ```sql
  select tablename, policyname, cmd, qual, with_check
  from pg_policies where schemaname = 'public' order by tablename, policyname;
  ```
  When you replace a policy, `CREATE` the new one and `DROP` the old one in a single transaction so
  there is no window with no write policy.
- **Known, intentional drift (checked 2026-10-07; do not "fix" without asking):**
  - Tables `gm_sessions`, `gm_players`, `gm_courts`, `gm_games`, `gm_queue` exist only in the live
    DB, with RLS on, public read and owner-only write policies. Nothing in the code, the schema file
    or git references them. Don't drop them and don't add them to the file unprompted.
  - `guest_participants` policy names differ from the file ("Anyone can view guest participants",
    "Anyone can join as guest"), and two creator-only UPDATE/DELETE policies remain next to the
    organizer policy. They are redundant but harmless (the organizer policy already includes the
    creator).
  - Everything else compared — RLS on every table, the realtime publication and
    `REPLICA IDENTITY FULL` for the 7 realtime tables, and the badminton-table policies — matched.
