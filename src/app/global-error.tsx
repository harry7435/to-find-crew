'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// 루트 레이아웃까지 깨졌을 때만 쓰이므로 html/body를 직접 렌더하고 전역 스타일에 기대지 않는다.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: 16 }}>
          <p style={{ marginBottom: 16 }}>문제가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
          <button type="button" onClick={reset} style={{ padding: '8px 16px' }}>
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
