# Auth Profile Source of Truth and Email Onboarding

- **Display name and photo come from the `users` table, not from OAuth `user_metadata`.**
  `AuthContext` (`src/contexts/AuthContext.tsx`) exposes `profile` (`users.name` / `profile_image`)
  and `refreshProfile()`. `Header.tsx` prefers `profile` and falls back to the Kakao/Google
  `user_metadata` only until it loads. After any code path edits those columns, call
  `refreshProfile()` or the header stays stale. The token's `user_metadata` is a snapshot from login
  time and never reflects a profile edit.
- **`/auth/callback` must only create the `users` row, never overwrite it.** It upserts with
  `{ onConflict: 'id', ignoreDuplicates: true }`. It used to overwrite `name`/`profile_image` with
  the social values on every login, which silently reset whatever the user had set on `/profile`.
  Don't turn it back into a plain upsert, and don't add "refresh from social" there.
- **Email (magic-link) onboarding state lives in Supabase auth `user_metadata`** under
  `name_confirmed`, `password_set` and `password_prompt_skipped` — chosen so no schema change was
  needed. A signed-in user can edit their own `user_metadata`, so these flags drive **what the UI
  shows only**; never use them for authorization. `AuthContext.emailOnboarding`
  (`isPending`, `needsName`, `needsPassword`, `dismiss`) is the single place that decides it. It
  checks `app_metadata.provider === 'email'` first, because a Kakao user has none of the three keys
  and would otherwise look like someone who still needs onboarding. "나중에" is remembered per user id
  in `sessionStorage` (`email_onboarding_dismissed`), so it returns in a new browser session.
- **Modal ordering: onboarding goes first.** `EmailOnboardingModal` is mounted once in `AppShell`.
  Any modal that can open on page load or right after login must stay closed while
  `emailOnboarding.isPending` is true, or two Radix dialogs stack and nothing errors. The two that
  do this today: `UserInfoModal` in `src/app/badminton/[id]/page.tsx` and `MigrateModal` in
  `src/app/game-manager/page.tsx`. Gate the `isOpen` prop only — don't touch the migration flag
  handling next to it (`docs/gotchas/game-manager-login-migration.md`). `isPending` is already
  `false` while `loading` is true, so this does not reintroduce the `useAuth()` loading race
  described in `CLAUDE.md`. The modal never mounts on `/auth/login`, `/auth/callback` or
  `/random-picker`, because `AppShell` returns early for `NO_GLOBAL_HEADER_ROUTES`.
- **Password sign-in goes through `/auth/callback`.** `/auth/login` calls
  `signInWithPassword` and then `router.replace('/auth/callback')`, so first-login row creation and
  the game-manager migration redirect stay in one place. The Auth Redirect URLs allow-list problem
  in `CLAUDE.md` doesn't apply to this path (no redirect happens), only to the Kakao and magic-link
  paths.
- **Supabase dashboard settings this depends on** (no code error if they drift): email/password
  sign-in enabled; Minimum password length equal to `MIN_PASSWORD_LENGTH` in
  `src/utils/password.ts` (6); "Secure password change" on, which makes a password change from an
  old session fail with `reauthentication_needed` (mapped to a "log in again" message in
  `describePasswordError`). Change the dashboard value and the constant together.
- **Known gaps, not verified or not fixed:** an account that signed up with Kakao and later used a
  magic link with the same address may keep `provider === 'kakao'`, so it would get no password card
  (unchecked). A second device can ask for a password again until its session refreshes. Changing a
  password does not ask for the current one. Account deletion is out of scope. Design and plan:
  `docs/superpowers/specs/2026-08-13-email-auth-onboarding-design.md` and
  `docs/superpowers/plans/2026-10-08-email-auth-onboarding.md` (local-only, gitignored).
