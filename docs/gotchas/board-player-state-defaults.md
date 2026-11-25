# `board_player_state` attendance defaults: organizer-added vs code-joined

There are two ways a player gets a `board_player_state` row, and they start in different states on
purpose.

| How the player arrives | Row created by | Starts as |
|---|---|---|
| The organizer adds them on the board ("선수 등록" modal) | `useBoardRealtime.addPlayer` (explicit insert) | `attending: true`, `player_status: 'active'`, `waiting_since: now` |
| They join with the invite code or link | `loadSnapshot`'s missing-row backfill (`missingInserts`) | DB defaults: `attending: false`, `player_status: 'resting'` |
| `/game-manager` trial: the organizer adds them | `useGameManager.addPlayer` | `attending: true`, `status: 'active'`, `waitingSince: now` |

## Why the two board paths differ (decided 2026-11-13, PR #7)

- **Organizer-added means the person is physically here now.** Before PR #7, organizer-added players
  also started absent. The player-list filter defaults to "참석" (attending), so a freshly
  registered player disappeared from the list and random pick stayed disabled ("현재: 0명"). This was
  the main cause of first-time organizers asking "어떻게 해야 해?".
- **Code-joined means the person signed up, not that they arrived.** People often join days ahead,
  and some never show up. Auto-attending them would put no-shows into team picks. The user chose
  "keep absent, but surface it loudly" instead.

## What surfaces the absent code-joined players

- **`PlayerList` empty state:** when the "참석" filter is empty but absent players exist, it shows
  "신청자 N명이 있어요…" with a [참석자 선택] button that opens the attendance picker.
- **`TeamPicker`:** when fewer than 4 players are active and some are absent, it shows
  "미참석 N명 중 참석자 선택".

## Before changing any default

- Don't "unify" the two paths. Both directions were tried or considered and rejected for the reasons
  above.
- The schema defaults (`supabase-schema.sql`) stay `false` / `'resting'`. The organizer-add values
  are set in the insert, not by changing the column default. Changing the default would need an
  `ALTER TABLE`, which needs sign-off under the additive-only rule.
- These code paths depend on the defaults, so check them if you change one:
  - the spectator sheet "오늘 참석자 · 게임 기록", which lists attendees only
  - the spectator summary line, which counts attending vs. 신청
  - the empty-state copy above
- Related race: [board-backfill-insert-race.md](board-backfill-insert-race.md) — the backfill can
  beat `addPlayer`'s insert and leave an organizer-added player absent.

## `guest_participants.is_one_time` (1회성 게스트)

- `is_one_time` is a column on `guest_participants` (`BOOLEAN NOT NULL DEFAULT false`), added by an
  `ALTER TABLE` the user explicitly approved on 2026-11-25 as an exception to the additive-only rule.
  Invite-link joiners are always `false`; only the organizer's add/edit forms on the realtime board
  set it (`PlayerForm`/`PlayerAddModal`/`PlayerEditModal` take an opt-in `showOneTime` prop, so
  `/game-manager` is unchanged). Logged-in participants never get it — `updatePlayer()` ignores
  `isOneTime` for `participantType === 'user'`.
- `removeOneTimeGuests()` (settings sheet) deletes by explicit id list and skips anyone in a `playing`
  or `queued` `board_games` row. Busy players come from a DB query right before the delete
  (`fetchBusyPlayers`), not from the snapshot, for the same reason as the other writes in
  `game-manager-board-conventions.md`.
- Known race: between the `board_games` busy check and the delete, another organizer can queue one of
  those guests, leaving a deleted id in a queued game. Same class of gap as `removePlayer`; the proper
  fix is an RPC doing check + delete in one transaction. Accepted for now.
- The spectator hook also selects `is_one_time` (shared `boardSnapshot.ts`), but spectators don't show the badge.
