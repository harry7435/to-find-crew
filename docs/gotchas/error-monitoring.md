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
- Realtime `.subscribe()` callbacks call `reportRealtimeStatus(source, status, err, context)`;
  it ignores non-failure statuses itself. Adding the call to `useBoardSpectator` is fine — it is
  read-only reporting, not a shared write path (see `spectator-board-duplication.md`).
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
