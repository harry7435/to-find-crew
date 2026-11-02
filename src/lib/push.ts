import { supabase } from '@/lib/supabase';

export type PushSupport = 'supported' | 'ios-needs-install' | 'unsupported';

export interface PushTarget {
  participantId: string;
  participantType: 'user' | 'guest';
  name: string;
}

export type SessionPushState = { status: 'off' } | { status: 'denied' } | { status: 'on'; target: PushTarget };

// 모임별로 이 기기가 누구 이름으로 알림을 켰는지 기억하는 UI 표시용 힌트.
// 권한 판단에는 쓰지 않는다 (실제 구독 여부는 서버의 push_subscriptions 가 진실).
const TARGETS_KEY = 'push_session_targets';

function readTargets(): Record<string, PushTarget> {
  try {
    const raw = window.localStorage.getItem(TARGETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeTargets(targets: Record<string, PushTarget>): void {
  try {
    window.localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
  } catch {
    // 저장소가 막힌 환경(사생활 보호 모드 등)에서는 표시 힌트만 잃는다.
  }
}

function isIos(): boolean {
  const ua = window.navigator.userAgent;
  // iPadOS는 데스크톱 Safari UA를 보내므로 터치 지점 수로 구분한다.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  // iOS는 홈 화면에 추가한 PWA에서만 웹 푸시를 지원한다 (16.4+).
  if (isIos() && !isStandalone()) return 'ios-needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  return 'supported';
}

// 읽기 전용 조회: 워커를 설치하지 않는다. next-pwa 는 App Router 에서 서비스 워커를 등록하지 않으므로
// 구독할 때 push 전용 워커(/push-sw.js)를 직접 register 한다. navigator.serviceWorker.ready 는
// 등록된 워커가 없으면 영원히 대기하므로 register() 직후에만 쓴다.
async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration();
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function getSessionPushState(sessionId: string): Promise<SessionPushState> {
  if (Notification.permission === 'denied') return { status: 'denied' };
  const target = readTargets()[sessionId];
  if (!target || Notification.permission !== 'granted') return { status: 'off' };
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { status: 'off' };
  return { status: 'on', target };
}

export async function subscribeToSession(sessionId: string, target: PushTarget): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY 가 설정되지 않았습니다');
    throw new Error('알림 기능이 아직 준비되지 않았어요');
  }

  // iOS는 사용자 제스처 안에서 요청해야 권한 창을 띄우므로, 다른 await보다 먼저 호출한다.
  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    throw new Error('알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요');
  }
  if (permission !== 'granted') {
    throw new Error('알림 권한을 허용해야 알림을 받을 수 있어요');
  }

  let subscription: PushSubscription;
  try {
    await navigator.serviceWorker.register('/push-sw.js');
    const registration = await navigator.serviceWorker.ready;
    subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
  } catch (err) {
    // 브라우저가 영어 DOMException(AbortError 등)을 던지므로 사용자용 한국어 메시지로 바꾼다.
    console.error('[push] browser subscribe failed:', err);
    throw new Error('알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요');
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('알림 구독 정보를 만들지 못했어요. 다시 시도해 주세요');
  }

  const { error } = await supabase.rpc('upsert_push_subscription', {
    p_session_id: sessionId,
    p_session_participant_id: target.participantType === 'user' ? target.participantId : null,
    p_guest_participant_id: target.participantType === 'guest' ? target.participantId : null,
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
  });
  if (error) {
    console.error('[push] upsert_push_subscription failed:', error);
    throw new Error('알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요');
  }

  writeTargets({ ...readTargets(), [sessionId]: target });
}

export async function unsubscribeFromSession(sessionId: string): Promise<void> {
  let subscription: PushSubscription | null | undefined;
  try {
    const registration = await getRegistration();
    subscription = await registration?.pushManager.getSubscription();
  } catch (err) {
    console.error('[push] browser getSubscription failed:', err);
    throw new Error('알림을 끄지 못했어요. 잠시 후 다시 시도해 주세요');
  }
  if (subscription) {
    const { error } = await supabase.rpc('delete_push_subscription', {
      p_session_id: sessionId,
      p_endpoint: subscription.endpoint,
    });
    if (error) {
      console.error('[push] delete_push_subscription failed:', error);
      throw new Error('알림을 끄지 못했어요. 잠시 후 다시 시도해 주세요');
    }
  }
  // 브라우저 구독(endpoint)은 같은 사이트의 다른 모임과 공유되므로 unsubscribe() 하지 않는다.
  const targets = readTargets();
  delete targets[sessionId];
  writeTargets(targets);
}

// 코트 배정 직후 운영진 화면에서 호출한다. 실패해도 보드 동작에는 영향이 없어야 하므로
// 기다리지 않고 로그만 남긴다 (운영진이 할 수 있는 조치가 없어 토스트도 띄우지 않는다).
export function notifyGameStarted(gameId: string): void {
  fetch('/api/push/game-started', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
  })
    .then(async (res) => {
      if (!res.ok) {
        console.error('[push] game-started failed:', res.status, await res.text());
      }
    })
    .catch((err) => {
      console.error('[push] game-started request error:', err);
    });
}
