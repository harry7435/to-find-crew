# Game Manager Board Shared-State & Styling Conventions

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
- **`waiting_since`/`waitingSince` must not be touched by the queue round-trip — neither
  `enqueueGame` nor `removeFromQueue`.** It tracks "since when has this player been waiting to
  play," and `PlayerList.tsx`'s wait-time badge (`formatElapsed(player.waitingSince, now)`) is shown
  for **both** `status === 'active'` and `status === 'queued'` players, not just `'active'`. This is
  deliberately distinct from a queue party's own `queuedAt`/`board_games.queued_at` (used only by
  `GameQueue.tsx` to show how long the *group* has been queued).
  **The governing rule: only actually playing a game starts a new wait.** So `endCourtGame` resets
  `waiting_since` to `nowIso`, and `useGameManager.ts`'s `cancelCourtGame` restores the pre-game
  value it stashed in `court.prevWaiting`. Entering *and leaving* the queue is a mere continuation of
  an existing wait — a player who was queued and then had the queue entry cancelled never played, so
  their accumulated wait must survive intact.
  Both hooks have hit this twice: first `enqueueGame` nulled `waiting_since`/`waitingSince` on
  entering the queue (the badge vanished the moment a group got matched), then `removeFromQueue` set
  it to `nowIso` on cancelling (the badge restarted from 0). Both are fixed by omitting the field
  from the update entirely. Both failures are silent — the column is nullable and no error is thrown,
  so verify by watching an actual badge across a queue → cancel round-trip, not by checking that the
  write succeeded. If you touch either hook's `enqueueGame`/`removeFromQueue` again, keep this
  invariant in both files — they're an intentionally duplicated pair (see the Spectator Board
  Read-Only Duplication Pattern doc), so a fix in one without the other silently half-fixes the bug.
- **Known divergence, not yet fixed: `cancelCourtGame` in `useBoardRealtime.ts` still resets
  `waiting_since` to `nowIso`**, while `useGameManager.ts`'s equivalent restores `court.prevWaiting`.
  Cancelling a game means the game didn't happen, so by the rule above the server-backed board is
  wrong here. It isn't a simple fix: the localStorage board keeps `prevWaiting` on the in-memory
  court object, and there is no column on `courts`/`board_games` to stash it — closing the gap needs
  a schema decision (additive-only convention applies). Don't "align" the two by copying the
  `nowIso` behaviour into `useGameManager.ts`.
