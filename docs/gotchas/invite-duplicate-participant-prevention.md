# Invite Flow: Guest/Login Duplicate-Participant Prevention

- When an organizer pre-registers players as guests (`guest_participants` — no `user_id`/`phone`
  column, per the additive-only schema convention in `CLAUDE.md`) and the real person later joins
  the same session by logging in via the invite link, there is no reliable way to detect "this
  logged-in user is the same person as that guest row" — `guest_participants` has no field linking
  it to a `users` row, and matching by name alone is unsafe (typos, duplicate names, nicknames the
  organizer typed in).
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
