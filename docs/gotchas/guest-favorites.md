# Guest Favorites (`/badminton/favorites`) — localStorage-only by design

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
