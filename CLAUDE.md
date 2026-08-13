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

## Spectator Board Read-Only Duplication Pattern

- `/badminton/[id]` branches on `isOrganizer = user?.id === session.creator_id` to render either
  `OrganizerBoard` (full read/write, via `useBoardRealtime`) or `SpectatorBoard` (read-only, via
  `useBoardSpectator`) — see `src/app/badminton/[id]/page.tsx`.
- **`useBoardRealtime` (`src/hooks/useBoardRealtime.ts`) and `useBoardSpectator`
  (`src/hooks/useBoardSpectator.ts`) intentionally duplicate their Supabase fetch/subscribe
  boilerplate (~20 lines: the 5-table `Promise.all` fetch + `postgres_changes` subscription
  wiring).** Only the pure mapping logic is shared, via `buildSnapshot()` in
  `src/utils/boardSnapshot.ts`. This was a deliberate, user-approved trade-off to keep
  `useBoardSpectator` fully independent of `useBoardRealtime` — no read-only hook is allowed to
  share code paths with the hook that performs writes (including the `board_player_state` seeding
  `INSERT` that `useBoardRealtime` does on load), so that it's structurally impossible for a
  spectator/unauthenticated visitor to trigger a write. **Do not "clean up" this duplication by
  merging the two hooks or adding a read/write mode flag to `useBoardRealtime`** without checking
  with the user first — the duplication is the safety mechanism, not an oversight.
- The two hooks also use different Supabase Realtime channel names on purpose —
  `board-${sessionId}` (organizer) vs `board-spectator-${sessionId}` (spectator) — so the two
  roles never share a channel subscription instance.
- **Resolved (2026-08-11/12):** the old "인원 풀" vs. separate "참가자 목록" duplication noted above
  was the "UI 재설계" roadmap item (`docs/superpowers/specs/2026-07-14-board-persistence-design.md`
  로드맵 항목 4) — it shipped. `ParticipantsList.tsx` was deleted; `OrganizerBoard` now uses a single
  `Tabs` (`인원 풀` / `팀 뽑기`) in its left column instead of two separately-scrolling lists. See
  `docs/superpowers/specs/2026-08-11-board-roster-layout-design.md` and
  `docs/superpowers/specs/2026-08-11-team-court-box-design.md` for the design rationale, and
  `src/components/badminton/OrganizerBoard.tsx`'s `Tabs`/`TabsContent` structure for the current
  implementation.

## Game Manager Board Shared-State & Styling Conventions

- **Controlled-prop lifting for cross-component shared UI state.** When a piece of UI state needs to
  be visible/actionable from two separate DOM locations owned by *different* components — e.g. a
  parent's desktop header action-button group and a child's own mobile-only button row — keep it as a
  controlled prop pair on the child (`value` + `onValueChange`), with the actual `useState` living in
  the parent, rather than as child-local state. This is a repeated pattern, not a one-off:
  `selectedPlayers`, `isCustomPicking`, and `isEditingSelection` (named `isEditingCustomPick` in
  `OrganizerBoard.tsx`/`game-manager/page.tsx`) all follow it. Example: `CustomTeamPicker`'s
  `isEditingSelection`/`onEditingSelectionChange` props exist so the "다시 선택" button can render
  both in `OrganizerBoard`'s desktop header (the `isCustomPicking` branch next to `TabsList`) and in
  `CustomTeamPicker`'s own mobile-only button row (the bottom `md:hidden` block) and stay in sync.
  Don't "simplify" these back to local `useState` in the child without checking whether a parent call
  site depends on the same value.
- **`boundedOnDesktop` (`CustomTeamPicker.tsx`) is a related but distinct convention — layout-budget
  delegation, not shared state.** It tells the child whether an ancestor (`OrganizerBoard`'s
  fixed-viewport `md:` dashboard) has already given its tab a fixed height to fill and scroll within
  (`true`), vs. the child sitting on an ordinary unbounded page like `/game-manager` and needing to
  self-limit its own scroll height via `max-h-[55vh]` (`false`, the default). Any new board
  sub-component embedded in both the fixed-viewport `OrganizerBoard` dashboard and a normal-scrolling
  page should follow this same boolean-prop pattern rather than hardcoding one layout assumption.
- **`TeamCourtBox` (`src/components/game-manager/TeamCourtBox.tsx`) deliberately splits color across
  two independent channels — do not merge them.** Player name text + gender icon color always encodes
  *gender* (`getGenderColor()`: `text-blue-600` = male, `text-pink-600` = female), never team side.
  Team side (A = left / B = right) is encoded only via background wash (`bg-blue-50` vs `bg-violet-50`
  on the side container) and border color (`border-blue-200` vs `border-violet-200` on each chip),
  never via text color. All consumers (`CourtManager`, `GameQueue`, `GameHistory`, `TeamPicker`,
  `CustomTeamPicker`, `SpectatorBoard`) render through this single component, so changing its color
  logic changes all of them at once — check both channels stay independent before "simplifying."

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
