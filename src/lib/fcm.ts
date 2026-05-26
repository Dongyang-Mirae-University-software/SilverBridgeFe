'use client';

import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, MessagePayload, Messaging, onMessage } from 'firebase/messaging';
import { reportNonApiError } from '@/lib/api/reportError';
import { deleteNotificationFcmToken, registerNotificationFcmToken } from '@/service/api/notification';

const FCM_TOKEN_KEY = 'careai_fcm_token';
const FCM_REGISTERED_TOKEN_KEY = 'careai_fcm_registered_token';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyB82QGIFGkeSsda2qg3Yg3feYKSAxvqI1Y';
const DEFAULT_FIREBASE_SENDER_ID = '608365601427';
const DEFAULT_FIREBASE_APP_ID = '1:608365601427:web:b3ac76ab46895df2fda366';
const DEFAULT_FIREBASE_VAPID_KEY = 'BHUOhweRqH1Gq6_IV5uFPgUI3XW2TiLX0E8bhT2mRufiIdEfyw9SuBS_O0TshJOcKLMatk6V-RpWB4heYU2ceM0';
let registrationPromise: Promise<string | null> | null = null;

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function getFirebaseApp(): FirebaseApp {
  const app = getApps()[0];
  if (app) return app;

  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? DEFAULT_FIREBASE_API_KEY,
    authDomain: 'silverbridgebe.firebaseapp.com',
    projectId: 'silverbridgebe',
    storageBucket: 'silverbridgebe.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID ?? DEFAULT_FIREBASE_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? DEFAULT_FIREBASE_APP_ID,
  });
}

async function getBrowserMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  const supported = await isSupported();
  if (!supported) return null;

  return getMessaging(getFirebaseApp());
}

async function getMessagingServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;

  return registration;
}

async function getCurrentFcmToken() {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  const messaging = await getBrowserMessaging();
  const serviceWorkerRegistration = await getMessagingServiceWorker();
  if (!messaging || !serviceWorkerRegistration) return null;

  return getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? DEFAULT_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration,
  });
}

export async function registerFcmTokenForCurrentDevice() {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;

  const storage = getSessionStorage();
  const storedToken = storage?.getItem(FCM_TOKEN_KEY);
  const registeredToken = storage?.getItem(FCM_REGISTERED_TOKEN_KEY);

  if (storedToken && registeredToken === storedToken) return storedToken;
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    if (storedToken) {
      await registerNotificationFcmToken({ token: storedToken, platform: 'WEB' });
      storage?.setItem(FCM_REGISTERED_TOKEN_KEY, storedToken);
      return storedToken;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getCurrentFcmToken();
    if (!token) return null;

    await registerNotificationFcmToken({ token, platform: 'WEB' });
    storage?.setItem(FCM_TOKEN_KEY, token);
    storage?.setItem(FCM_REGISTERED_TOKEN_KEY, token);

    return token;
  })();

  try {
    return await registrationPromise;
  } finally {
    registrationPromise = null;
  }
}

export async function unregisterFcmTokenForCurrentDevice() {
  const storedToken = getSessionStorage()?.getItem(FCM_TOKEN_KEY);
  const token = storedToken ?? (await getCurrentFcmToken());

  if (!token) return;

  try {
    await deleteNotificationFcmToken(token);
  } finally {
    getSessionStorage()?.removeItem(FCM_TOKEN_KEY);
    getSessionStorage()?.removeItem(FCM_REGISTERED_TOKEN_KEY);
  }
}

export function listenForegroundMessages(handler: (payload: MessagePayload) => void) {
  let unsubscribe = () => {};
  let disposed = false;

  void getBrowserMessaging()
    .then(messaging => {
      if (!messaging || disposed) return;
      unsubscribe = onMessage(messaging, handler);
    })
    .catch(error => {
      reportNonApiError('FCM 포그라운드 메시지 연결 실패:', error);
    });

  return () => {
    disposed = true;
    unsubscribe();
  };
}
