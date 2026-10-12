# Spectator Board Read-Only Duplication Pattern

- `/badminton/[id]` branches on `showOrganizerBoard = isOrganizer && !isViewOnly` to render either
  `OrganizerBoard` (full read/write, via `useBoardRealtime`) or `SpectatorBoard` (read-only, via
  `useBoardSpectator`) — see `src/app/badminton/[id]/page.tsx`. `isOrganizer` is the creator or a
  `session_organizers` member; `isViewOnly` is the organizer's own "현황판 보기" toggle, so an
  organizer can also land on `SpectatorBoard`. That view-only mode relies on the same guarantee as
  everything below: it stays write-free only while `SpectatorBoard` keeps using `useBoardSpectator`.
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
- **The background-return refetch (`refreshOnReturn`) is a second duplicated surface, with a different
  reason: consistency, not write safety.** It lives in `useBoardRealtime.ts`, `useBoardSpectator.ts`
  and — not a hook — `src/app/badminton/[id]/page.tsx`, whose own `session-participants-${sessionId}`
  channel (guest/session participants and organizers) calls `fetchSession()`. Each registers
  `visibilitychange` (only when `visibilityState === 'visible'`) and `online` listeners that reload
  the data. Reason (inferred from reading the code, not reproduced): an installed PWA that is
  backgrounded can have its WebSocket suspended, Realtime may not notice, and events missed while
  hidden are never replayed — the board silently keeps the old state. Don't remove the listeners as
  "redundant with Realtime", and keep the trigger identical in all three places; a fix in only one
  half-fixes the bug. A new realtime-backed hook or page needs the same pair.
  Known gaps: (1) `loadSnapshot` has no sequencing, so overlapping calls (a Realtime reload racing a
  visibility reload) can land out of order and an older snapshot can overwrite a newer one;
  (2) not yet verified on a real installed PWA — to test, background it, change data from another
  browser, then foreground it (desktop tab switching doesn't reliably reproduce this).
- **Resolved (2026-08-11/12):** the old "인원 풀" vs. separate "참가자 목록" duplication noted above
  was the "UI 재설계" roadmap item (`docs/superpowers/specs/2026-07-14-board-persistence-design.md`
  로드맵 항목 4) — it shipped. `ParticipantsList.tsx` was deleted; `OrganizerBoard` now uses a single
  `Tabs` (`인원 풀` / `팀 뽑기`) in its left column instead of two separately-scrolling lists. See
  `docs/superpowers/specs/2026-08-11-board-roster-layout-design.md` and
  `docs/superpowers/specs/2026-08-11-team-court-box-design.md` for the design rationale, and
  `src/components/badminton/OrganizerBoard.tsx`'s `Tabs`/`TabsContent` structure for the current
  implementation.
