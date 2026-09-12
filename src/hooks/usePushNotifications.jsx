// src/hooks/usePushNotifications.jsx
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';

const VAPID_KEY =
  'BEmmrhr6OeXSRrTHtIjApXDF9MTeca5juJ5pblMFyGu7N4vCQk_qQ0SFVA2OA4arm7TvobGETRuu173tYsJb0BY';

export function usePushNotifications() {
  const { user } = useAuth();
  const setupDoneForUid = useRef(null);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    // The old version re-ran whenever the `user` OBJECT changed identity, even
    // for the same person, adding a new set of listeners each time. Result:
    // the same notification shown two or three times.
    if (setupDoneForUid.current === uid) return;
    setupDoneForUid.current = uid;

    let cancelled = false;

    const saveToken = async (token) => {
      if (!token) return;
      // Token is stored per user: switching accounts on one phone used to skip
      // the write, so notifications kept going to the previous account.
      const cacheKey = `fcm_token:${uid}`;
      if (localStorage.getItem(cacheKey) === token) return;

      try {
        // setDoc(merge) instead of updateDoc: updateDoc fails if the user
        // document does not exist yet, which silently broke notifications for
        // brand-new users. Offline, this is queued and uploaded automatically.
        await setDoc(
          doc(db, 'users', uid),
          { fcmToken: token, fcmTokenUpdatedAt: serverTimestamp() },
          { merge: true }
        );
        localStorage.setItem(cacheKey, token);
        console.log('[FCM] ✅ Token saved.');
      } catch (error) {
        console.error('[FCM] ❌ Could not save the token. Check your security rules.', error);
      }
    };

    const setupNative = async () => {
      const platform = Capacitor.getPlatform();
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') {
          console.warn('[FCM] Notification permission was not granted.');
          return;
        }

        if (platform === 'android') {
          await PushNotifications.createChannel({
            id: 'default',
            name: 'Default Notifications',
            description: 'General app notifications',
            importance: 5,
            visibility: 1,
          }).catch(() => {});
        }

        // Remove anything left from a previous mount before adding new ones.
        await PushNotifications.removeAllListeners();
        if (cancelled) return;

        // Listeners must be attached BEFORE register().
        await PushNotifications.addListener('registration', (token) => saveToken(token.value));
        await PushNotifications.addListener('registrationError', (e) =>
          console.error('[FCM] Registration error:', JSON.stringify(e))
        );
        await PushNotifications.addListener('pushNotificationReceived', (n) => {
          // alert() blocks the whole WebView and cannot be dismissed by
          // swiping. Replace this with your in-app toast component.
          console.log('[FCM] Received in foreground:', n.title, n.body);
        });
        await PushNotifications.addListener('pushNotificationActionPerformed', (a) =>
          console.log('[FCM] Notification tapped:', a?.notification?.data)
        );

        await PushNotifications.register();
      } catch (error) {
        console.error('[FCM] Native setup failed:', error);
      }
    };

    const setupWeb = async () => {
      try {
        // Not every browser supports web push (older iOS Safari, some WebViews).
        // Without this check, getMessaging() throws and the whole hook dies.
        if (!(await isSupported())) {
          console.log('[FCM] Web push is not supported in this browser.');
          return;
        }
        // Do not call requestPermission() automatically: browsers block prompts
        // that are not started by a user action, and a refused prompt cannot be
        // asked again. Ask from a button, then call this hook.
        if (Notification.permission === 'denied') return;
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
        }

        const messaging = getMessaging();
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (!cancelled && token) saveToken(token);

        onMessage(messaging, (payload) => {
          console.log('[FCM] Web message in foreground:', payload?.notification);
        });
      } catch (error) {
        console.error('[FCM] Web setup failed:', error);
      }
    };

    if (Capacitor.isNativePlatform()) setupNative();
    else setupWeb();

    return () => {
      cancelled = true;
      if (Capacitor.isNativePlatform()) PushNotifications.removeAllListeners();
    };
    // uid only: a new user object for the same person must not restart setup.
  }, [user?.uid]);
}
