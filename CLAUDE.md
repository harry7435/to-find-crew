# CLAUDE.md

## Project Identity (read before making product decisions)

- `README.md` describes the original "crew-matching social platform" vision and predates the current
  active product surface — it doesn't mention badminton at all.
- The actual shipped/active product is a **badminton club on-site game-management tool**:
  `/badminton/create`, `/badminton/join`, `/badminton/my-sessions`, `/badminton/[id]` (session pages
  with a realtime organizer board), and `/game-manager` (a no-login "trial" mode of the same board,
  backed by localStorage).
- This isn't either/or: the crew-matching platform stays a long-term vision, not abandoned — but
  badminton is the near-term focus. Don't "fix" the README by erasing the crew-matching vision; flag
  staleness and ask before rewriting it.

## Database Schema Conventions (`supabase-schema.sql`)

- `supabase-schema.sql` is the single hand-maintained source of truth for schema (no migration
  tool/ORM). Changes get pasted into the Supabase dashboard SQL editor manually.
- **Additive-only convention:** when adding features, only use `CREATE TABLE` (plus supporting
  `CREATE INDEX` / RLS policies for the *new* tables). Do not `ALTER TABLE` or `DROP TABLE` on existing
  tables without explicit sign-off — this is an explicit, repeated user preference. Example: the board
  persistence feature added `board_player_state`, `courts`, `board_games` as brand-new tables rather
  than adding columns to `session_participants` or reusing the old `teams`/`games` tables.
- **Realtime gotchas** — `CREATE TABLE` alone does not make a table broadcast over Supabase Realtime.
  Two extra steps are required for any new table that needs live updates:
  1. `ALTER PUBLICATION supabase_realtime ADD TABLE <table_name>;`
  2. `ALTER TABLE <table_name> REPLICA IDENTITY FULL;` — without this, `DELETE` events only carry the
     primary key in the old record, so a realtime filter on a non-PK column (e.g. `session_id`) silently
     fails to match `DELETE` events. Both failure modes are silent (no error, subscription just never
     fires) — verify with manual multi-browser testing, not just single-tab checks.

## Git Workflow

- **Never run `git add` or `git commit` in this repo, ever, without being explicitly asked in the
  moment.** The user stages and commits everything themselves. This overrides any other guidance
  (including older plan documents under `docs/superpowers/plans/`) that suggests otherwise.

## Game Manager Login Migration Pattern

- `/game-manager` (no-login localStorage trial) can migrate its player roster into a real
  server-backed session (`/badminton/[id]`) when the user logs in. The flow spans 4 files:
  `MigrateBanner.tsx` (sets the flag + routes to login, or opens the modal directly if already
  logged in) → `auth/callback/page.tsx` (reads the flag, redirects to `/game-manager` instead of
  `/` if set) → `game-manager/page.tsx`'s mount effect (reads + clears the flag, opens the modal)
  → `MigrateModal.tsx` (creates the session, copies players into `guest_participants`, navigates
  to the new session).
- **`MIGRATION_PENDING_FLAG` (`src/utils/gameManagerMigration.ts`) has exactly one consumer that
  clears it: the `game-manager` page's mount effect.** `auth/callback` only *reads* the flag to
  decide where to redirect — it must never call `removeItem` on it. A whole-branch review caught
  a bug where both files cleared it independently, which silently broke the "modal auto-opens
  after login" behavior (the callback's clear always ran first, so the mount effect's check was
  always false). If you touch either file, preserve this single-consumer rule.
- When the flag is absent, both `auth/callback` and `game-manager` behave exactly as before this
  feature existed (redirect to `/`, no auto-opened modal) — this backward-compatibility path must
  keep working for every login flow that isn't game-manager migration (e.g.
  `/badminton/invite/[code]`).

## Testing / Verification

- No automated test suite (no Jest/Vitest) exists. Don't add one unprompted. Verify changes manually
  via `pnpm dev` + click-through, and run `pnpm lint` / `pnpm build` before considering work done.
  `pnpm build` requires real `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars to
  fully succeed (static generation touches the Supabase client); placeholder values are enough to catch
  compile/type errors even without a live project.

## Docs Layout

- `docs/superpowers/specs/*.md` — design docs (what/why) for larger features.
- `docs/superpowers/plans/*.md` — task-by-task implementation plans (checkbox `- [ ]` format).
- `.claude/plans/*.md` — older, ad hoc plans predating the specs/plans split. New work uses
  `docs/superpowers/{specs,plans}/`.
