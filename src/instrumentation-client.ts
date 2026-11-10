import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
  tracesSampleRate: 0,
  // v11에서 sendDefaultPii가 dataCollection으로 대체됨 — 사용자 정보·쿠키·헤더·요청 본문·쿼리스트링 자동 수집을 끈다.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  // console 브레드크럼은 console.error 인자(Supabase error.details = 실패한 행 전체, 게스트 이름·이메일)를 그대로 담는다
  beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === 'console' ? null : breadcrumb),
  // 현장 문제와 무관한 브라우저 노이즈
  ignoreErrors: ['ResizeObserver loop limit exceeded', 'ResizeObserver loop completed with undelivered notifications'],
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
});
