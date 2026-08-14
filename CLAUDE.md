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
  tables without explicit sign-off — this is an explicit, repeated user preference. Examples: the board
  persistence feature added `board_player_state`, `courts`, `board_games` as brand-new tables; the
  session-scoped display-info override feature (see below) added `session_participant_overrides` —
  both rather than adding columns to existing tables (`session_participants`, `users`) or reusing old
  table structures (`teams`/`games`).
- **Realtime gotchas** — `CREATE TABLE` alone does not make a table broadcast over Supabase Realtime.
  Two extra steps are required for any new table that needs live updates:
  1. `ALTER PUBLICATION supabase_realtime ADD TABLE <table_name>;`
  2. `ALTER TABLE <table_name> REPLICA IDENTITY FULL;` — without this, `DELETE` events only carry the
     primary key in the old record, so a realtime filter on a non-PK column (e.g. `session_id`) silently
     fails to match `DELETE` events. Both failure modes are silent (no error, subscription just never
     fires) — verify with manual multi-browser testing, not just single-tab checks.
- **`datetime-local` inputs → `TIMESTAMPTZ` columns must be converted client-side, not
  server-side.** `<input type="datetime-local">` (e.g. `session_date` in `SessionForm.tsx` /
  `edit/[id]/page.tsx`) produces a timezone-naive string like `"2026-08-14T20:00"`. Supabase/
  Postgres's session timezone is UTC, so sending that string as-is into a `TIMESTAMPTZ` column
  gets it interpreted as UTC — silently storing a time off by the browser's UTC offset (9 hours
  for KST). Fix: convert with `new Date(data.session_date).toISOString()` in the client
  component, immediately before the fetch call — not inside the API route. Doing the conversion
  server-side reproduces the same bug, because Vercel serverless functions default to UTC, not
  the user's local timezone. The inverse conversion (UTC ISO string → local `datetime-local`
  value, needed to pre-fill an edit form) requires the matching local-offset correction — see
  `convertToDateTimeLocal()` in `src/app/badminton/edit/[id]/page.tsx`
  (`date.setMinutes(date.getMinutes() - date.getTimezoneOffset())`). No error is thrown in
  either direction; verify by checking actual stored/displayed times, not just that the request
  succeeds. See commit `7a482d1`.

## Supabase Configuration Gotchas

- **Auth Redirect URLs allow-list** — `signInWithOAuth`/`signInWithOtp`'s `redirectTo`/
  `emailRedirectTo` (e.g. `http://localhost:3000/auth/callback`) only works if that exact URL is
  also registered in the Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
  allow-list. If it isn't, Supabase silently falls back to the dashboard's configured Site URL
  instead — the app's `/auth/callback` page (and any logic living there, e.g. the Game Manager
  Login Migration flag check below) is never visited at all. The Supabase JS client's default
  `detectSessionInUrl` behavior then auto-completes the session on whatever page it lands on, so
  login *appears* to succeed while completely bypassing the callback page. This is a silent
  failure mode like the Realtime gotchas above — no error anywhere. Diagnose via the browser
  Network tab: if the final redirect lands on `/` (or wherever Site URL points) with a bare
  `?code=...` instead of on `/auth/callback`, this is the cause — fix in the Supabase Dashboard,
  not in code.
- **`useAuth()` loading race in role-based branching** — `AuthContext` (`src/contexts/AuthContext.tsx`)
  initializes `user` to `null` and `loading` to `true`; `user` only becomes accurate once the async
  `supabase.auth.getSession()` call resolves and `loading` flips to `false`. Any page that branches
  rendering on `user?.id` (e.g. `isOrganizer = user?.id === session.creator_id`) must gate on
  `loading` too, not just the page's own data-fetch loading state — otherwise there's a window where
  `user` is `null` and the branch picks the wrong UI (e.g. an organizer briefly renders as a
  spectator) before flipping to the correct state. No error is thrown; it just silently shows the
  wrong branch for a moment. Fix pattern: destructure `loading: authLoading` from `useAuth()` and
  fold it into the page's existing loading guard, e.g. `if (isLoading || authLoading) return <Spinner />`
  before computing role-dependent variables. See `src/app/badminton/[id]/page.tsx` (commit `d26b3d2`).

## Project Structure & Layout Architecture

- `<Header />` is rendered globally by `src/components/layout/AppShell.tsx`, applied once in
  `src/app/layout.tsx` — not by individual pages. Any new page automatically gets the header plus
  matching top padding.
- **Exclusion list** — `AppShell.tsx` hard-codes a short list of routes that opt out of the global
  header: `/random-picker` (drives its own full-screen, state-based header visibility during the
  picker game), `/auth/login`, `/auth/callback` (auth-flow pages where a header is redundant). If
  a new page needs the same kind of custom/no header treatment, add its path to that list rather
  than fighting the global header from within the page.
- **The footer uses the opposite direction on purpose — `SHOW_FOOTER_ROUTES` in `AppShell.tsx` is
  an allow-list, not an exclusion list.** The board pages (`/badminton/[id]`, `/game-manager`) are
  viewport-filling dashboards that lose court/queue space to anything extra at the bottom, so the
  safe default has to be "no footer": with an exclusion list, forgetting to register a new
  board-family page silently shrinks its layout. Only document/form-style pages are opted in. Board
  pages surface `/terms` and `/privacy` through `Header.tsx`'s user dropdown instead — which only
  renders for logged-in users, so a guest sitting on `/game-manager` or a spectator board currently
  has no in-page link to either document (they have to go via the home page). That gap is known and
  accepted, not an oversight to "fix" silently.
- **`AppShell` is a sticky-footer flex column, so page roots must use `flex-1`, never
  `min-h-screen`.** The header is `fixed`, so `AppShell` always adds `pt-16` to its content wrapper;
  the wrapper is `flex-1` and owns the 100vh budget. A page root that declares its own
  `min-h-screen` stacks 100vh on top of that `pt-16` plus the footer height and overflows the
  viewport, producing a permanent scrollbar even when the content is one screen short. No error is
  thrown — it only shows up on the *shortest* page in the app, so verify there, not on a long one.
  Both `src/app/page.tsx` and `src/components/legal/LegalLayout.tsx` hit this; the second one hit it
  even though the fix for the first had just landed in the same change.
- **`Header.tsx`'s `loading` branch and its loaded branch must render the identical `HEADER_CLASS`,
  above all `fixed`.** `AppShell`'s unconditional `pt-16` assumes the header is out of document
  flow. When only one branch is `fixed`, the other is `static` and occupies a real 64px on top of
  that padding, so the instant `loading` flips the whole page jumps by exactly the header height.
  Cold loads hide it (the loading window is too short); it becomes obvious right after
  login/logout, when `AuthContext` re-runs `getSession()` on an already-mounted page and `loading`
  goes back to `true`. Test auth-state *transitions*, not just fresh page loads. If a third branch
  (error, skeleton) is ever added, it uses `HEADER_CLASS` too.

## Legal Pages (`/terms`, `/privacy`)

- Hand-written documents that must be updated in the same change whenever a schema change adds a
  personal-data field or a new third-party service is integrated — no lint/test catches the drift.
  See `docs/gotchas/legal-pages-maintenance.md` for what exactly to check and why.

## Git Workflow

- **Never run `git add` or `git commit` in this repo, ever, without being explicitly asked in the
  moment.** The user stages and commits everything themselves. This overrides any other guidance
  (including older plan documents under `docs/superpowers/plans/`) that suggests otherwise.

## Game Manager Login Migration Pattern

- `/game-manager` can migrate its localStorage player roster into a real server-backed session on
  login, across 4 files (`MigrateBanner.tsx` → `auth/callback/page.tsx` → `game-manager/page.tsx`'s
  mount effect → `MigrateModal.tsx`) sharing a flag with a single-consumer rule that's easy to
  accidentally break. See `docs/gotchas/game-manager-login-migration.md` before touching any of
  those 4 files.

## Spectator Board Read-Only Duplication Pattern

- `useBoardRealtime`/`useBoardSpectator` intentionally duplicate Supabase fetch/subscribe
  boilerplate as a safety mechanism — a read-only hook must never share a write code path with the
  hook that performs writes. Do not "clean up" this duplication without checking with the user
  first. See `docs/gotchas/spectator-board-duplication.md` for the full rationale.

## Session-Scoped Participant Display-Info Overrides

- Organizers can override a logged-in participant's display info for one session only, via
  `session_participant_overrides` + a fallback merge in `boardSnapshot.ts` — `age_group` has no
  profile fallback by design (`users` has no such column; this is expected, not a bug). See
  `docs/gotchas/session-participant-overrides.md` before adding a new overridable field or touching
  `updatePlayer()`'s `participantType` branch in `useBoardRealtime.ts`.

## Game Manager Board Shared-State & Styling Conventions

- Several repeated, load-bearing patterns in the board components: controlled-prop lifting for
  cross-component shared UI state, `boundedOnDesktop` layout-budget delegation, `TeamCourtBox`'s two
  independent color channels (gender vs. team side), and `waiting_since` reset rules around
  `enqueueGame`. See `docs/gotchas/game-manager-board-conventions.md` before "simplifying" any of
  `CustomTeamPicker.tsx`, `TeamCourtBox.tsx`, or either hook's `enqueueGame()`.

## Invite Flow: Guest/Login Duplicate-Participant Prevention

- Guest/login duplicate-person matching is deliberately manual (organizer choice on the invite
  page), not automatic — auto-matching by name was explicitly considered and rejected. See
  `docs/gotchas/invite-duplicate-participant-prevention.md` before adding any linking/matching
  logic between `guest_participants` and `users`.

## Testing / Verification

- No automated test suite (no Jest/Vitest) exists. Don't add one unprompted. Verify changes manually
  via `pnpm dev` + click-through, and run `pnpm lint` / `pnpm build` before considering work done.
  `pnpm build` requires real `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars to
  fully succeed (static generation touches the Supabase client); placeholder values are enough to catch
  compile/type errors even without a live project.

## Guest Favorites (`/badminton/favorites`) — localStorage-only by design

- `guestFavorites.ts` is intentionally localStorage-only, not a server table — the only
  session-recovery path for non-logged-in guests. See `docs/gotchas/guest-favorites.md` before
  proposing a server-backed upgrade.

## Docs Layout

- `docs/superpowers/specs/*.md` — design docs (what/why) for larger features. **Gitignored
  (`/docs/superpowers/` in `.gitignore`) — local-only, not committed, invisible to other
  contributors and to anyone cloning the repo.**
- `docs/superpowers/plans/*.md` — task-by-task implementation plans (checkbox `- [ ]` format). Same
  gitignore scope as specs above.
- `docs/gotchas/*.md` — **git-tracked.** One file per narrow "read this before touching X" pattern,
  split out of this file to keep CLAUDE.md itself short. CLAUDE.md keeps a 2-4 line pointer to each;
  the full detail lives in the linked file. When a pointer's summary stops being enough context on
  its own, that's the signal to open the linked file, not to re-inline it here.
- `.claude/plans/*.md` — older, ad hoc plans predating the specs/plans split. New work uses
  `docs/superpowers/{specs,plans}/`.
