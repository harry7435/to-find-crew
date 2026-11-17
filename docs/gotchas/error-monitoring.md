# Error Monitoring (Sentry)

- Supabase calls return `{ error }` instead of throwing, so the SDK's automatic capture never sees
  them. Any failure path that matters must call `reportError(message, cause, context)` from
  `src/lib/monitoring.ts` explicitly. `message` is the issue title _and_ the grouping key — keep it a
  fixed string per failure site, never interpolate ids into it (put ids in `context`).
- `useBoardRealtime`'s `fail(message, cause?)` reports only when `cause` is passed. Do **not** pass
  it for normal concurrency conflicts (`'이미 처리된 대기열입니다'`, `'이미 종료된 게임입니다'` —
  another device got there first) or for failures already reported elsewhere (`updatePlayerState`
  reports its own error, so callers that fail on its `false` result omit `cause`). Passing it in
  either case floods Sentry with non-bugs or double-counts one failure.
  `removePlayer`'s `'참가자 삭제에 실패했습니다'` also omits `cause`: the `remove-participant` API route
  reports its own 500 (network failures and 4xx on that path are intentionally unreported).
- API routes don't throw either — they `console.error` and return 500, which `onRequestError`
  never sees. Every new `status: 500` branch needs a `reportError` call next to its
  `console.error`; 4xx branches don't get one.
- Client-side failures (`console.error` breadcrumbs are dropped, so they'd otherwise leave no trace):
  (A) a direct Supabase client call that fails (`{ error }` or throw) → `reportError` with a fixed
  message and ids-only context. (B) a `fetch('/api/...')` to our own route → **never** `reportError`
  (the server reports its 500s, 4xx are expected rejections, network failures are flaky gym networks);
  call `recordApiFailure(method, path, status | 'network')`, which adds an `api` breadcrumb only, with
  the path normalized (query stripped; any segment that isn't lowercase-hyphen words, i.e. uuid/number/
  invite code, becomes `:id`). If one `catch` covers both a Supabase call and a fetch, split them so each
  goes to its own path. (C) user-caused errors are not reported: auth 4xx and auth network failures (`isExpectedAuthError`:
  wrong password, bad OTP, 429; `AuthRetryableFetchError` from flaky networks), Storage 4xx (`isClientCausedStorageError`), push permission
  `NotAllowedError`, PostgREST `PGRST116` (no row for a bad/deleted id). (D) missing config
  (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) is reported. (E) `useGameManager` reports only the localStorage
  *load* failure; save failures are not reported (they fire on every state change, so a quota error
  would flood Sentry). Don't double-report: `isSessionOrganizer` reports its own query failure, and
  `AuthContext` reports auth failures, so `/auth/login` doesn't.
- Realtime `.subscribe()` callbacks use a per-channel `createRealtimeStatusReporter(source, context)`
  from `monitoring.ts`: create it in the same effect before `.subscribe`, call
  `reporter.onStatus(status, err)` in the callback, and call `reporter.dispose()` in cleanup before
  `removeChannel`. Why: a `CHANNEL_ERROR` without `err` (and `TIMED_OUT`) is a socket-level close from
  a flaky network or backgrounded tab, which realtime-js auto-recovers from (and re-fires on every
  failed reconnect), so reporting each one flooded Sentry. Those only add a `realtime` breadcrumb
  (client `beforeBreadcrumb` drops only `console`, so they pass) and arm a 60s timer, cleared by
  `SUBSCRIBED`; if it fires while `document.visibilityState === 'visible'` one `Realtime not recovered`
  warning is sent (hidden tabs re-arm instead). `CHANNEL_ERROR` with `err` (server join rejection,
  bindings mismatch — no auto-rejoin) is a real bug and reports immediately as `Realtime join failed`.
  Each reporter reports at most once until the next `SUBSCRIBED`. Adding it to `useBoardSpectator` is
  fine — it is read-only reporting, not a shared write path (see `spectator-board-duplication.md`).
- Privacy relies on settings outside the code: all three inits set
  `dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false }`,
  `Sentry.setUser({ id })` only, and **Prevent Storing of IP Addresses** enabled in the Sentry
  project settings. SDK v11 defaults all of these `dataCollection` options to on, and `httpBodies`
  matters because e.g. `join-guest` request bodies contain guest names — so never remove these keys. `monitoring.ts` deliberately drops Postgres `details` (it carries the failing row, e.g. guest
  names) — don't add it back.
  The privacy policy does not list IP addresses because of the dashboard setting — if it is ever
  turned off, update `/privacy` §1. The org is in the US region to match the policy's "국외(미국)"
  wording.
- `beforeBreadcrumb` drops `console` breadcrumbs (all runtimes) and `http` breadcrumbs (server)
  because they carry `console.error` args (Supabase `error.details` = the failing row) / web-push
  endpoint paths (device tokens). `dataCollection` does not govern breadcrumbs — never remove it.
- next-pwa `buildExcludes: [/\.map$/]` in `next.config.ts` is required because Sentry deletes
  uploaded client source maps; without it the precache list references missing `.js.map` files and the
  service worker silently fails to install in production (breaks web push). Verify after build with
  `grep -c 'static/.*\.map' public/sw.js` → 0 (a bare `.map` matches `n.map(` and the `sourceMappingURL` comment).
- Sending is disabled outside `NODE_ENV === 'production'`; verify on a Vercel preview, not on
  `pnpm dev`.
- `next.config.ts` sets `tunnelRoute: '/monitoring'`. There is no middleware today; if
  `src/middleware.ts` is ever added, its matcher must exclude `/monitoring` or client events
  silently stop arriving.
- The client `environment` tag reads `NEXT_PUBLIC_VERCEL_ENV`, which Vercel only exposes when
  "Automatically expose System Environment Variables" is on; otherwise every event is tagged
  `development`.
- `withSentryConfig` is imported from `@sentry/nextjs/config` (v11 moved it out of the root export).
