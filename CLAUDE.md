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

- `supabase-schema.sql` is the single hand-maintained source of truth for the *intended* schema (no
  migration tool/ORM). Changes get pasted into the Supabase dashboard SQL editor manually, so the live
  DB can drift from the file — query it before trusting the file (see the `users` bullet below).
- **Additive-only convention:** when adding features, only use `CREATE TABLE` (plus supporting
  `CREATE INDEX` / RLS policies for the *new* tables). Do not `ALTER TABLE` or `DROP TABLE` on existing
  tables without explicit sign-off — this is an explicit, repeated user preference. Examples: the board
  persistence feature added `board_player_state`, `courts`, `board_games` as brand-new tables; the
  session-scoped display-info override feature (see below) added `session_participant_overrides` —
  both rather than adding columns to existing tables (`session_participants`, `users`) or reusing old
  table structures (`teams`/`games`).
- **`users` has column-level `SELECT` grants, and the live DB differs from this file in places.**
  `select('*')` or selecting `email`/`phone`/`provider` on `users` errors with permission denied
  (owner contact: `rpc('get_my_contact')`); `gm_*` tables exist only in the DB. Privilege
  (`GRANT`/`REVOKE`) and RLS-policy changes on existing tables need the same explicit sign-off as
  `ALTER TABLE`, and `pg_policies` must be queried before editing any policy. See
  `docs/gotchas/users-table-column-grants.md`.
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
  Login Migration flag check below and first-login `users` row creation) is never visited at all.
  The Supabase JS client's default `detectSessionInUrl` behavior then auto-completes the session on
  whatever page it lands on, so login *appears* to succeed while completely bypassing the callback
  page. This is a silent
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
- **Board-family pages use `MobileTabBar` below `md`, one section per screen.** `OrganizerBoard`,
  `/game-manager`, and `SpectatorBoard` hide non-active sections with CSS (`max-md:hidden` /
  `hidden md:block`) instead of unmounting them, so in-progress UI state (custom-pick selection, picked
  team, half-filled forms) survives tab switches — don't "optimize" this into conditional rendering.
  On `/game-manager` the sections are `forceMount`ed `CollapsibleContent` with
  `data-[state=closed]:hidden max-md:!block`, so they stay open on mobile while desktop collapse still
  works. Pages using the bar add `MOBILE_TAB_BAR_PADDING` to the outermost page wrapper (so content rendered
  after the board, e.g. the guest login card on `/badminton/[id]`, is not covered) so the fixed bar never
  covers the last item. Arrival-highlight targets carry `scroll-mt-20`/`max-md:scroll-mb-*` margins so
  `scrollIntoView` doesn't land under the header or bar. The bar is `z-40` so Radix sheets/modals (`z-50`) stay above it. Success paths that
  move work elsewhere (confirm → queue, assign → court) also switch the mobile tab, alongside the
  arrival highlight — by calling the page's tab setter directly, because `MobileTabBar` scrolls to top
  only on *manual* tab changes and a programmatic switch must not cancel the highlight's scroll.

## Legal Pages (`/terms`, `/privacy`)

- Hand-written documents that must be updated in the same change whenever a schema change or a
  signup/auth change (e.g. a new credential or profile field collected at login) adds a personal-data
  field, or a new third-party service is integrated — no lint/test catches the drift.
  See `docs/gotchas/legal-pages-maintenance.md` for what exactly to check and why.

## Git Workflow

- **Claude may stage and commit on its own, without asking first** (changed 2026-11-13; this
  replaces the earlier "never commit" rule). Commit at natural checkpoints, e.g. per completed task
  or reviewed fix, using the repo's message style (`feat: …`, `fix: …`, `test: …`, Korean summary).
- **Always commit with explicit pathspecs** (`git add <paths>` + `git commit -m "…" -- <paths>`),
  never a bare `git commit` after staging, and run `git status` right before. A bare commit writes
  the *whole index*, and this repo has twice had pre-existing staged files (a `.gitignore`, a
  `CLAUDE.md`) swept into an unrelated commit that way. If it happens anyway:
  `git reset --soft HEAD~1`, then re-commit with pathspecs.
- No `Co-Authored-By` trailer in commit messages.
- Still ask first before anything that rewrites or publishes history beyond a normal commit: amend
  or rebase of already-pushed commits, `reset --hard`, force-push, deleting branches, or pushing
  to `main`. Never commit directly on `main` — work on a feature branch.
- lint-staged runs `eslint --fix` + `prettier --write` on staged ts/tsx at commit time, so the
  committed files can differ slightly in formatting from the working copy you reviewed.

## Game Manager Login Migration Pattern

- `/game-manager` can migrate its localStorage player roster into a real server-backed session on
  login, across 4 files (`MigrateBanner.tsx` → `auth/callback/page.tsx` → `game-manager/page.tsx`'s
  mount effect → `MigrateModal.tsx`) sharing a flag with a single-consumer rule that's easy to
  accidentally break. See `docs/gotchas/game-manager-login-migration.md` before touching any of
  those 4 files.

## Auth Profile & Email Onboarding

- Header name/photo come from `AuthContext.profile` (the `users` table), never raw OAuth
  `user_metadata`, and `/auth/callback` must only *create* the `users` row, never overwrite it.
  Email-signup onboarding flags live in auth `user_metadata` (UX-only, never authz), and any modal
  that opens on load/login must stay closed while `emailOnboarding.isPending`. See
  `docs/gotchas/auth-profile-and-email-onboarding.md` before touching `AuthContext`, the callback, or
  adding a login/mount-time modal.

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
  independent color channels (gender vs. team side), `waiting_since` reset rules around
  `enqueueGame`, and the write-failure contract of `useBoardRealtime` (writes return
  `Promise<boolean>`, multi-step writes keep a recoverable order). See
  `docs/gotchas/game-manager-board-conventions.md` before "simplifying" any of `CustomTeamPicker.tsx`,
  `TeamCourtBox.tsx`, either hook's `enqueueGame()`, or reordering `useBoardRealtime` writes.

## Invite Flow: Guest/Login Duplicate-Participant Prevention

- Guest/login duplicate-person matching is deliberately manual (organizer choice on the invite
  page), not automatic — auto-matching by name was explicitly considered and rejected. See
  `docs/gotchas/invite-duplicate-participant-prevention.md` before adding any linking/matching
  logic between `guest_participants` and `users`.

## Error Monitoring (Sentry)

- Supabase and API-route failures don't throw, so they reach Sentry only via explicit
  `reportError()` calls; `useBoardRealtime`'s `fail(message, cause?)` must omit `cause` for normal
  concurrency conflicts. See `docs/gotchas/error-monitoring.md` before adding a write path or a 500
  branch.

## Testing / Verification

- **Playwright e2e exists, but only for login-free screens.** `pnpm test:e2e` runs `e2e/*.spec.ts`
  against `pnpm dev` (reused if already running; needs `.env.local`) in two chromium projects,
  `mobile` (375×812, touch) and `desktop` (1280×800). Coverage is limited to `/` and `/game-manager`
  (localStorage-only). Organizer board, spectator board, invite/join, and anything that needs login or
  writes to the real Supabase DB are *not* automated — verify those manually (two browsers for
  realtime/multi-organizer cases). Don't point e2e at the live DB to "cover" them.
- First run needs the browser binary: `pnpm exec playwright install chromium`.
- `e2e/game-manager.spec.ts` hides the Next.js dev-mode indicator (`nextjs-portal`) in its top-level
  `beforeEach` (mobile project only), because in dev it overlaps the leftmost tab of the bottom bar. Don't remove it, or clicks on the '인원' tab
  fail for no obvious reason.
- When changing `/` or `/game-manager` UI, update/extend the matching e2e spec in the same change.
  Prefer role/text selectors (the UI copy is the contract); if copy changes, the spec changes with it.
- No unit-test runner (Jest/Vitest) exists. Don't add one unprompted.
- Run `pnpm lint` / `pnpm build` before considering work done. `pnpm lint` also covers `e2e/` and
  `playwright.config.ts` (`next lint --dir src --dir e2e --file playwright.config.ts`). `pnpm build`
  requires real `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars to fully succeed
  (static generation touches the Supabase client); placeholder values are enough to catch compile/type
  errors even without a live project.

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
