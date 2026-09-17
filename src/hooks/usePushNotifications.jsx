// src/hooks/usePushNotifications.jsx
//
// One hook, two transports (Capacitor native + Firebase web), ONE event stream.
//
// What changed and why:
//
// 1. Native foreground pushes were logged and thrown away. Android does not
//    draw a tray notification while the app is in the foreground, so the user
//    saw nothing. Every incoming push now goes through emitPush(), which the
//    UI subscribes to with usePushEvents().
//
// 2. The setupDoneForUid guard was never reset, but the cleanup called
//    removeAllListeners(). Sign out -> sign back in as the same person (or a
//    StrictMode double-mount in dev) hit the guard while the listeners were
//    already gone, so register() never ran again and push went silently dead
//    until the process restarted.
//
// 3. The web onMessage() subscription was never unsubscribed, so remounts
//    stacked listeners and the same toast fired two or three times.
//
// 4. Notification taps (pushNotificationActionPerformed) now reach the UI too,
//    so a tap can navigate instead of only logging.
//
// App.jsx must NOT keep its own getMessaging()/onMessage() listener. This hook
// owns the web transport now; two listeners means duplicate popups.
import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';

const VAPID_KEY =
  'BEmmrhr6OeXSRrTHtIjApXDF9MTeca5juJ5pblMFyGu7N4vCQk_qQ0SFVA2OA4arm7TvobGETRuu173tYsJb0BY';

// =========================================================================
// EVENT BUS — module level, so native and web deliver through one path and
// the UI never has to know which platform it is running on.
// =========================================================================
const pushListeners = new Set();
const recentIds = new Map(); // messageId -> timestamp, for de-duplication
const DEDUPE_WINDOW_MS = 8000;

function alreadySeen(id) {
  if (!id) return false;
  const now = Date.now();
  for (const [key, at] of recentIds) {
    if (now - at > DEDUPE_WINDOW_MS) recentIds.delete(key);
  }
  if (recentIds.has(id)) return true;
  recentIds.set(id, now);
  return false;
}

/**
 * Normalises a raw payload from either transport into one shape:
 *   { id, title, body, data, source, tapped, receivedAt }
 */
function emitPush(raw, { source, tapped = false }) {
  const notification = raw?.notification || raw || {};
  const data = raw?.data || notification?.data || {};

  const id = raw?.messageId || raw?.id || data.messageId || null;
  // A tap is always worth delivering, even if the same message was already
  // shown in the foreground a moment ago.
  if (!tapped && alreadySeen(id)) return;

  const event = {
    id,
    title: notification.title || data.title || 'New notification',
    body: notification.body || data.body || '',
    data,
    source,
    tapped,
    receivedAt: Date.now(),
  };

  pushListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('[FCM] A push listener threw:', error);
    }
  });
}

/** Subscribe imperatively, outside React. Returns an unsubscribe function. */
export function subscribeToPush(listener) {
  pushListeners.add(listener);
  return () => pushListeners.delete(listener);
}

/**
 * React subscription. The handler is kept in a ref, so you do not need to
 * memoise it and the subscription never churns:
 *
 *   usePushEvents((event) => { ... });
 */
export function usePushEvents(handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => subscribeToPush((event) => handlerRef.current?.(event)), []);
}

/** Convenience wrapper: the most recent push as state, plus a clear(). */
export function useLatestPush() {
  const [latest, setLatest] = useState(null);
  usePushEvents(setLatest);
  return [latest, () => setLatest(null)];
}

export function usePushNotifications() {
  const { user } = useAuth();
  const setupForUid = useRef(null);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    // Re-running for the SAME person (a new user object, same uid) would stack
    // listeners and show each notification two or three times. Re-running after
    // a real teardown must still be allowed, which is why this is cleared in
    // the cleanup below instead of being left set forever.
    if (setupForUid.current === uid) return;
    setupForUid.current = uid;

    let cancelled = false;
    let unsubscribeWebMessages = null;

    const saveToken = async (token) => {
      if (!token || cancelled) return;
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
        console.log('[FCM] Token saved.');
      } catch (error) {
        console.error('[FCM] Could not save the token. Check your security rules.', error);
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
          // The server must send android.notification.channel_id = "default"
          // or heads-up notifications will not appear on Android 8+.
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
        // THIS is the foreground path on native. It used to only console.log,
        // which is why nothing ever appeared while the app was open.
        await PushNotifications.addListener('pushNotificationReceived', (n) => {
          emitPush(n, { source: 'native' });
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
          emitPush(a?.notification, { source: 'native', tapped: true });
        });

        await PushNotifications.register();

        // A notification that launched the app from cold start is delivered
        // before the listener above exists on some Android builds.
        const delivered = await PushNotifications.getDeliveredNotifications().catch(() => null);
        if (delivered?.notifications?.length) {
          console.log(`[FCM] ${delivered.notifications.length} notification(s) already in the tray.`);
        }
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
        if (cancelled) return;

        // Was never unsubscribed before, so remounts stacked listeners.
        unsubscribeWebMessages = onMessage(messaging, (payload) => {
          emitPush(payload, { source: 'web' });
        });
      } catch (error) {
        console.error('[FCM] Web setup failed:', error);
      }
    };

    if (Capacitor.isNativePlatform()) setupNative();
    else setupWeb();

    return () => {
      cancelled = true;
      // Allow a later mount for the same uid to set everything up again.
      setupForUid.current = null;
      if (unsubscribeWebMessages) unsubscribeWebMessages();
      if (Capacitor.isNativePlatform()) PushNotifications.removeAllListeners();
    };
    // uid only: a new user object for the same person must not restart setup.
  }, [user?.uid]);
}
