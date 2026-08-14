# Spectator Board Read-Only Duplication Pattern

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
