importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB82QGIFGkeSsda2qg3Yg3feYKSAxvqI1Y',
  authDomain: 'silverbridgebe.firebaseapp.com',
  projectId: 'silverbridgebe',
  storageBucket: 'silverbridgebe.firebasestorage.app',
  messagingSenderId: '608365601427',
  appId: '1:608365601427:web:b3ac76ab46895df2fda366',
});

const messaging = firebase.messaging();

function getNotificationPath(data) {
  switch (data?.type) {
    case 'CONNECTION_REQUEST':
      return '/ward/guardians';
    case 'CONNECTION_ACCEPTED':
    case 'CONNECTION_REFUSED':
      return '/guardian/wards';
    case 'CONNECTION_CANCELLED':
      return '/guardian/wards';
    case 'DISCONNECTION':
    case 'CONNECTION_DISCONNECTED':
      return '/';
    default:
      return '/';
  }
}

function getNotificationContent(payload) {
  switch (payload.data?.type) {
    case 'CONNECTION_REQUEST':
      return {
        body: payload.notification?.body || '보호자가 연결을 요청했습니다.',
        title: payload.notification?.title || '연결 요청',
      };
    case 'CONNECTION_ACCEPTED':
      return {
        body: payload.notification?.body || '연결 요청이 수락되었습니다.',
        title: payload.notification?.title || '연결 수락',
      };
    case 'CONNECTION_REFUSED':
      return {
        body: payload.notification?.body || '연결 요청이 거절되었습니다.',
        title: payload.notification?.title || '연결 거절',
      };
    case 'DISCONNECTION':
    case 'CONNECTION_DISCONNECTED':
      return {
        body: payload.notification?.body || '연결이 해제되었습니다.',
        title: payload.notification?.title || '연결 해제',
      };
    default:
      return {
        body: payload.notification?.body || '',
        title: payload.notification?.title || '알림',
      };
  }
}

messaging.onBackgroundMessage(payload => {
  const notification = getNotificationContent(payload);

  self.registration.showNotification(notification.title, {
    body: notification.body,
    data: payload.data,
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const path = getNotificationPath(event.notification.data);
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clientList => {
      const sameOriginClient = clientList.find(client => client.url.startsWith(self.location.origin));

      if (sameOriginClient) {
        sameOriginClient.focus();
        return sameOriginClient.navigate(targetUrl);
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
