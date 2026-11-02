// 이 파일은 src/lib/push.ts 의 subscribeToSession 이 직접 register 하는 사이트 유일의 서비스 워커다.
// next-pwa 의 sw.js 에는 불러오지 않는다 (App Router 에서는 next-pwa 의 sw.js 가 등록되지 않는다).
// 페이로드 형식은 src/app/api/push/game-started/route.ts 의 GameStartedPayload 와 같다.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const DEFAULT_TITLE = '내 차례예요! 🏸';
const ICON = '/icons/icon_to_find_crew.png';

self.addEventListener('push', (event) => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }

  // iOS는 userVisibleOnly 구독에서 알림을 띄우지 않는 push를 반복하면 구독을 끊을 수 있어,
  // 페이로드가 깨져도 기본 알림은 띄운다.
  const title = payload && payload.title ? payload.title : DEFAULT_TITLE;
  const options = {
    body: payload && payload.body ? payload.body : '',
    icon: ICON,
    tag: payload && payload.tag ? payload.tag : undefined,
    data: { url: payload && payload.url ? payload.url : '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => client.url === target);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
