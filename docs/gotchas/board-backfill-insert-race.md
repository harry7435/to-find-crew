# Known race: `loadSnapshot` backfill vs `addPlayer`'s state-row insert

**Status: known and accepted as of 2026-11-13. Not reproduced, not fixed.**

## The race

`useBoardRealtime.addPlayer` writes in two steps:
1. It inserts a `guest_participants` row.
2. It inserts that guest's `board_player_state` row with `attending: true, player_status: 'active'`.
   See [board-player-state-defaults.md](board-player-state-defaults.md). The result of this insert
   is not checked.

Between steps 1 and 2, `loadSnapshot` can run:
- The hook subscribes to `guest_participants` changes and calls `loadSnapshot()` on each event.
- That backfill (`missingInserts`) finds the new guest with no state row and inserts one with the
  **DB defaults**: absent, resting.
- `board_player_state` has `UNIQUE (guest_participant_id)`, so whichever insert lands second fails.
- If the backfill wins, `addPlayer`'s insert fails silently and the new player shows as **absent**,
  even though the organizer just added them.

## Who can trigger it

- **Any open organizer tab on the same session.** Every tab runs the backfill on the realtime event.
- **Possibly the adding tab itself.** Supabase delivers the `guest_participants` INSERT event to the
  originating client too. This is inferred from reading the code, not reproduced.

## Why it wasn't fixed

- **Before PR #7 it was invisible.** Both inserts wrote the same defaults (absent), so it didn't
  matter which one won. PR #7 made organizer-added players start as attending, which exposed it.
- **The fix needs a new write step.** For example, on a unique-violation (`23505`), follow up with
  `updatePlayerState(id, { attending: true, player_status: 'active', waiting_since })`.
  [game-manager-board-conventions.md](game-manager-board-conventions.md) asks for explicit sign-off
  before adding or reordering `useBoardRealtime` writes.
- **Recovery is one tap.** The empty-state [참석자 선택] (or the attendance chip) marks the player
  attending.

## If it gets reported

- **Repro:** two organizer tabs on one session, then register several players rapidly in one tab.
- **Fix options:** pick one with the user, then follow the write-failure contract (`fail()` without
  `cause` for an expected conflict).
  - **Follow-up update:** on unique-violation, update the existing row instead.
  - **Atomic RPC:** move the guest insert and the state-row insert into one RPC.
- Don't add client-side retries or sleeps. The race window is on the server side of two clients.
- Playwright e2e can't cover this, because it doesn't run against the real DB. Verify with two
  browsers.
