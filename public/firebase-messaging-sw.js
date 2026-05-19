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
    case 'CONNECTION_CANCELLED':
      return '/guardian/wards';
    default:
      return '/';
  }
}

messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(payload.notification?.title || '알림', {
    body: payload.notification?.body || '',
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
