# Game Manager Login Migration Pattern

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
