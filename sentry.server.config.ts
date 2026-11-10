import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV ?? 'development',
  tracesSampleRate: 0,
  // v11에서 sendDefaultPii가 dataCollection으로 대체됨 — 사용자 정보·쿠키·헤더·요청 본문·쿼리스트링 자동 수집을 끈다.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  // console 브레드크럼은 console.error 인자(Supabase error.details = 실패한 행 전체, 게스트 이름·이메일)를 그대로 담고,
  // http 브레드크럼은 web-push 엔드포인트 경로(기기 토큰)를 담는다
  beforeBreadcrumb: (breadcrumb) =>
    breadcrumb.category === 'console' || breadcrumb.category === 'http' ? null : breadcrumb,
});
