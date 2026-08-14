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

- `src/app/terms/page.tsx` and `src/app/privacy/page.tsx` are hand-written static documents (shared
  shell: `src/components/legal/LegalLayout.tsx`). They are **not** boilerplate — the privacy policy
  enumerates the actual collected fields and names every external processor (Supabase, Vercel,
  Google, Kakao) individually, and nothing links them to `supabase-schema.sql`. **When a schema
  change adds a personal-data field that a participant or organizer enters, or a new third-party
  service is integrated, update the policy in the same change.** No lint or test catches the drift;
  it's a remember-to-check convention like the additive-only schema rule.
- The policy's §6 and the terms' 제7조 exist specifically because organizers enter *other people's*
  names/gender/skill/age via `guest_participants` and `session_participant_overrides` — they place
  the consent-collection burden on the organizer who typed the data in. If that data-entry model
  changes, those two clauses are the ones to revisit.
- `src/app/auth/login/page.tsx` links both documents from its consent sentence, and login is treated
  as implied consent (no checkbox) — a deliberate choice for conversion, revisited only if
  under-14 verification or optional consent items appear. Keep both routes reachable: they were
  linked from that sentence for a while before the pages existed, which meant the app claimed to
  collect consent to documents that 404'd.

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

## Session-Scoped Participant Display-Info Overrides

- Organizers can override a **logged-in** participant's display info (name/gender/skill_level/
  age_group) for a single session, without touching their actual `users` profile — stored in
  `session_participant_overrides` (one row per `session_participant_id`, additive-only new table,
  see `supabase-schema.sql`). Guest participants don't need this: their row in `guest_participants`
  *is* the display info, so it's updated directly.
- **Merge/fallback logic lives in `toPlayer()`/`buildSnapshot()` in `src/utils/boardSnapshot.ts`**:
  for a logged-in participant, `override?.<field> ?? user.<field>` — override wins if present,
  otherwise fall back to the joined `users` profile value.
- **`age_group` is the one field with no fallback, because `users` has no `age_group` column at
  all** (only `guest_participants` and `session_participant_overrides` do). So a logged-in
  participant who's never had an override set will always show an empty age group on the board —
  this is expected, not a bug, and not something an `ALTER TABLE users ADD COLUMN age_group ...`
  should "fix" (that would violate the additive-only convention above without explicit sign-off).
  If you're debugging "why is this user's age group blank," check for a missing override row
  before assuming a data bug.
- `useBoardRealtime.ts`'s `updatePlayer()` branches on `participantType`: `'user'` → upsert into
  `session_participant_overrides` (`onConflict: 'session_participant_id'`); `'guest'` → direct
  `UPDATE guest_participants`. The upsert only patches the keys present in the `updates` object
  (same partial-update semantics as the rest of `updatePlayer`), so previously-set override fields
  persist even if a later edit's form field is left blank/unselected — it does not null them out.
- **If you add a new editable field to `Player`, update all four spots**: the `PlayerEditModal.tsx`
  form, the `session_participant_overrides` table schema (once this table is live in Supabase, that
  requires an actual `ALTER TABLE` + explicit sign-off — unlike this feature's initial `age_group`
  addition, which could edit the `CREATE TABLE` statement directly only because the table hadn't
  been deployed yet), the `RawParticipantOverride` type + merge branch in `boardSnapshot.ts`, and
  the `'user'` branch of `updatePlayer()` in `useBoardRealtime.ts`.

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
- **`waiting_since`/`waitingSince` must not be cleared when a group enters the queue.** It tracks
  "since when has this player been waiting to play," and `PlayerList.tsx`'s wait-time badge
  (`formatElapsed(player.waitingSince, now)`) is shown for **both** `status === 'active'` and
  `status === 'queued'` players, not just `'active'`. This is deliberately distinct from a queue
  party's own `queuedAt`/`board_games.queued_at` (used only by `GameQueue.tsx` to show how long the
  *group* has been queued). The other status transitions (game end, game cancel, dequeue) correctly
  reset `waiting_since` to `nowIso` because they start a *new* wait — `enqueueGame` is the one
  exception, since entering the queue is a *continuation* of an existing wait, not a new one. Both
  `useGameManager.ts` and `useBoardRealtime.ts` had a regression where their `enqueueGame` also
  nulled `waiting_since`/`waitingSince` on entering the queue — this silently made the wait-time
  badge disappear the moment a group got matched into the queue (no error; the field is nullable so
  nothing crashed). Fixed by omitting `waiting_since`/`waitingSince` from the update entirely inside
  `enqueueGame` in both files. If you touch either hook's `enqueueGame` again, keep this invariant in
  both — they're an intentionally duplicated pair (see Spectator Board Read-Only Duplication Pattern
  above), so a fix in one without the other silently half-fixes the bug.

## Invite Flow: Guest/Login Duplicate-Participant Prevention

- When an organizer pre-registers players as guests (`guest_participants` — no `user_id`/`phone`
  column, per the additive-only schema convention above) and the real person later joins the same
  session by logging in via the invite link, there is no reliable way to detect "this logged-in user
  is the same person as that guest row" — `guest_participants` has no field linking it to a `users`
  row, and matching by name alone is unsafe (typos, duplicate names, nicknames the organizer typed
  in).
- Rather than adding a schema column to support auto-matching, or a name-matching heuristic,
  `InvitePage` (`src/app/badminton/invite/[code]/page.tsx`) asks a logged-in user to explicitly
  choose between **"참가자로 추가하고 입장"** (calls `/api/badminton/sessions/join`, adds a
  `session_participants` row) and **"인원 추가 없이 보기만 하기"** (skip joining, navigate straight
  to `/badminton/[id]` — no participant row needed, since viewing only requires `isOrganizer` to
  evaluate `false` and fall through to `SpectatorBoard`) when they land on an invite link.
- **Do not "fix" this by adding automatic name-matching** between `session_participants`/`users` and
  `guest_participants`, or by adding a linking column to `guest_participants`, without checking with
  the user first — both were considered and explicitly rejected this way: the name typed for a guest
  entry might not match the logged-in account's display name at all, so any automatic matcher risks
  merging the wrong two people (or failing to merge the same person) with no visible error. If an
  organizer needs to clean up a stale duplicate guest entry, that's a manual removal from the board,
  not something this flow should try to detect automatically.

## Testing / Verification

- No automated test suite (no Jest/Vitest) exists. Don't add one unprompted. Verify changes manually
  via `pnpm dev` + click-through, and run `pnpm lint` / `pnpm build` before considering work done.
  `pnpm build` requires real `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars to
  fully succeed (static generation touches the Supabase client); placeholder values are enough to catch
  compile/type errors even without a live project.

## Guest Favorites (`/badminton/favorites`) — localStorage-only by design

- `src/utils/guestFavorites.ts` stores favorited session IDs in a single `localStorage` key
  (`guest_favorite_sessions`) in the browser, with no server-side table or sync — this is
  intentional, not a stopgap. It's the only session-recovery mechanism available to a *guest*
  (non-logged-in) participant: guests have no account, so `my-sessions`
  (`/api/badminton/sessions/my-sessions`) can't help them find their way back to a session.
  `addFavoriteSessionId()` is called once, right after a successful guest join
  (`InvitePage.handleGuestJoin` in `src/app/badminton/invite/[code]/page.tsx`).
- Known/accepted downside: favorites don't follow the guest across devices/browsers, and clearing
  site data loses them — the only recovery path then is re-requesting the invite link from the
  organizer. This was judged acceptable because the invite link is always the pre-existing fallback
  anyway; this feature only adds a shortcut, it doesn't replace anything.
- **Don't "upgrade" this to a server-backed table without checking with the user first** — doing so
  would require a way to identify a guest without login (e.g. a persisted device ID), which is a
  bigger design question than this feature was meant to solve.

## Docs Layout

- `docs/superpowers/specs/*.md` — design docs (what/why) for larger features.
- `docs/superpowers/plans/*.md` — task-by-task implementation plans (checkbox `- [ ]` format).
- `.claude/plans/*.md` — older, ad hoc plans predating the specs/plans split. New work uses
  `docs/superpowers/{specs,plans}/`.
