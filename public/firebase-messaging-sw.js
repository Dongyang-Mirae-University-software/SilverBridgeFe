importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');
importScripts('/push-sw-logic.js');

const push = self.SilverBridgePush;

// 역할(보호자·피보호자)을 고른다: access token 쿠키 → 열린 탭 경로 → 모름(null).
// cookieStore는 Chrome·안드로이드만 있다. 토큰은 role 값만 읽고 밖으로 보내지 않는다
async function resolveRole(clientList) {
  try {
    if (self.cookieStore) {
      const cookie = await self.cookieStore.get('careai_access_token');
      const role = push.getRoleFromToken(cookie && cookie.value);
      if (role) return role;
    }
  } catch {
    // 쿠키를 못 읽으면 탭 경로로 넘어간다
  }
  for (const client of clientList) {
    const role = push.getRoleFromPath(client.url);
    if (role) return role;
  }
  return null;
}

function getWindowClients() {
  return self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
}

// firebase.messaging()보다 먼저 등록해야 한다 - 라이브러리 리스너는 자기가 띄운 알림(FCM_MSG)의 클릭을
// stopImmediatePropagation으로 가로채고, 링크가 없어 아무 화면도 열지 않는다
self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  event.notification.close();

  const data = push.getClickData(event.notification.data);

  event.waitUntil(
    getWindowClients().then(async clientList => {
      const role = await resolveRole(clientList);
      const targetUrl = new URL(push.getPath(data, role, event.action), self.location.origin).href;
      const sameOriginClient = clientList.find(client => client.url.startsWith(self.location.origin));

      if (sameOriginClient) {
        await sameOriginClient.focus();
        return sameOriginClient.navigate(targetUrl);
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});


firebase.initializeApp({
  apiKey: 'AIzaSyB82QGIFGkeSsda2qg3Yg3feYKSAxvqI1Y',
  authDomain: 'silverbridgebe.firebaseapp.com',
  projectId: 'silverbridgebe',
  storageBucket: 'silverbridgebe.firebasestorage.app',
  messagingSenderId: '608365601427',
  appId: '1:608365601427:web:b3ac76ab46895df2fda366',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(async payload => {
  // notification 블록이 있으면 라이브러리가 이미 띄웠다(BE data 전용 전환 전) - 또 그리면 알림이 두 번 뜬다
  if (!push.shouldDraw(payload)) return;

  const role = await resolveRole(await getWindowClients());
  const { title, options } = push.buildNotification(payload, role);
  await self.registration.showNotification(title, options);
});
