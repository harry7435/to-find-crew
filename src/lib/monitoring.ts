import * as Sentry from '@sentry/nextjs';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';

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

/**
 * 보고할 필요 없는 Supabase AuthError인지 확인한다.
 * 4xx(잘못된 비밀번호, 만료된 OTP, 429 rate limit 등)는 사용자 탓, 네트워크 단절(AuthRetryableFetchError)은
 * 불안정한 환경 탓이다. getSession()이 페이지마다 토큰을 갱신하므로 후자를 보고하면 Sentry가 넘친다.
 * 5xx와 그 외 알 수 없는 오류만 보고 대상이다.
 */
export function isExpectedAuthError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

// StorageApiError(status: number)는 용량·형식 위반 등이 4xx다. 업로드는 드물게 직접 하는 동작이라
// 네트워크 단절(status 없는 StorageUnknownError)은 일부러 보고 대상으로 둔다.
export function isClientCausedStorageError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

// 정적 세그먼트(소문자·하이픈)만 남기고, uuid·숫자·초대 코드(대문자) 등은 모두 :id로 바꾼다.
function normalizeApiPath(path: string): string {
  return path
    .split('?')[0]
    .split('/')
    .map((segment) => (segment === '' || /^[a-z][a-z-]*$/.test(segment) ? segment : ':id'))
    .join('/');
}

/**
 * 우리 API 라우트 호출 실패를 breadcrumb으로만 남긴다. 500은 서버가 보고하고 4xx는 정상 거절, 네트워크
 * 실패는 불안정한 환경 탓이라 이벤트로는 보내지 않는다. 다른 이벤트의 맥락으로만 쓰인다.
 */
export function recordApiFailure(method: string, path: string, status: number | 'network'): void {
  Sentry.addBreadcrumb({
    category: 'api',
    level: 'warning',
    message: `${method} ${normalizeApiPath(path)} → ${status}`,
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
