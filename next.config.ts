import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  // Sentry가 업로드 후 클라이언트 소스맵을 삭제하므로 프리캐시 목록에서 빼야 SW 설치가 404로 실패하지 않는다
  buildExcludes: [/\.map$/],
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // 광고 차단기가 sentry.io 요청을 막지 않도록 같은 출처로 우회한다
  tunnelRoute: '/monitoring',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  suppressOnRouterTransitionStartWarning: true,
});
