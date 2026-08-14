# Session-Scoped Participant Display-Info Overrides

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
  should "fix" (that would violate the additive-only convention in `CLAUDE.md` without explicit
  sign-off). If you're debugging "why is this user's age group blank," check for a missing
  override row before assuming a data bug.
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
