import * as Sentry from '@sentry/nextjs';

export type MonitoringContext = Record<string, string | number | boolean | null | undefined>;

type PostgrestLike = { code?: string; hint?: string; message?: string };

// Supabase PostgrestError는 Error 인스턴스가 아닌 일반 객체라 그대로 보내면 그룹핑·제목이 깨진다.
function isPostgrestLike(value: unknown): value is PostgrestLike {
  return typeof value === 'object' && value !== null && !(value instanceof Error) && 'message' in value;
}

function applyContext(scope: Sentry.Scope, context: MonitoringContext) {
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) scope.setTag(key, String(value));
  }
  // Node 21+에도 전역 navigator가 있지만 onLine이 없으므로 브라우저에서만 붙인다.
  if (typeof window !== 'undefined') scope.setTag('online', String(navigator.onLine));
}

/**
 * throw되지 않는 실패(Supabase { error }, 500 응답 분기 등)를 Sentry에 보고한다.
 * message가 이슈 제목이자 그룹 기준이므로 같은 실패에는 같은 문자열을 쓴다.
 */
export function reportError(message: string, cause: unknown, context: MonitoringContext = {}): void {
  Sentry.withScope((scope) => {
    applyContext(scope, context);
    scope.setFingerprint([message]);
    if (isPostgrestLike(cause)) {
      // 제약 위반 시 details에 실패한 행 전체(게스트 이름 등)가 담기므로 보내지 않는다.
      scope.setExtra('postgrest', {
        code: cause.code,
        hint: cause.hint,
        message: cause.message,
      });
    }
    Sentry.captureException(new Error(message, { cause }));
  });
}

/** Realtime 구독 status 콜백에서 호출한다. 실패 status만 보고한다. */
export function reportRealtimeStatus(
  source: string,
  status: string,
  err: Error | undefined,
  context: MonitoringContext = {},
): void {
  if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return;
  Sentry.withScope((scope) => {
    applyContext(scope, context);
    scope.setLevel('warning');
    // 모바일 백그라운드 전환으로 반복되는 실패를 이슈 하나로 묶는다
    scope.setFingerprint(['realtime', status, source]);
    if (err) scope.setExtra('realtimeError', err.message);
    Sentry.captureMessage(`Realtime ${status}: ${source}`);
  });
}
