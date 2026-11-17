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

// 소켓 단절은 라이브러리가 자동 재연결·재구독하므로, 이 시간 넘게 복구되지 않을 때만 보고한다.
const REALTIME_RECOVERY_TIMEOUT_MS = 60_000;

/**
 * 채널 하나의 Realtime status를 추적하는 보고기. subscribe 전에 만들고 cleanup에서 dispose한다.
 * err 없는 CHANNEL_ERROR/TIMED_OUT은 소켓 단절(백그라운드·불안정 네트워크)이라 자동 복구되므로
 * breadcrumb만 남기고, 화면이 보이는 상태로 60초 넘게 복구되지 않을 때만 이벤트를 보낸다.
 * err가 있으면 서버 거부·바인딩 불일치라 즉시 보고한다.
 */
export function createRealtimeStatusReporter(
  source: string,
  context: MonitoringContext = {},
): { onStatus: (status: string, err: Error | undefined) => void; dispose: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reported = false;
  let disposed = false;
  let lastStatus = '';

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const arm = () => {
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed || reported) return;
      // 백그라운드 탭이 끊겨 있는 건 사용자 영향이 없으므로 보일 때까지 보고를 미룬다.
      if (document.visibilityState !== 'visible') {
        arm();
        return;
      }
      reported = true;
      Sentry.withScope((scope) => {
        applyContext(scope, context);
        scope.setLevel('warning');
        scope.setFingerprint(['realtime', 'not-recovered', source]);
        scope.setTag('lastStatus', lastStatus);
        Sentry.captureMessage(`Realtime not recovered: ${source}`);
      });
    }, REALTIME_RECOVERY_TIMEOUT_MS);
  };

  return {
    onStatus(status, err) {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        clearTimer();
        reported = false;
        return;
      }
      if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return;
      if (status === 'CHANNEL_ERROR' && err) {
        if (reported) return;
        reported = true;
        Sentry.withScope((scope) => {
          applyContext(scope, context);
          scope.setLevel('error');
          scope.setFingerprint(['realtime', 'join-failed', source]);
          scope.setExtra('realtimeError', err.message);
          Sentry.captureMessage(`Realtime join failed: ${source}`);
        });
        return;
      }
      lastStatus = status;
      Sentry.addBreadcrumb({ category: 'realtime', level: 'warning', message: `${status}: ${source}` });
      if (timer === undefined && !reported) arm();
    },
    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}
