// src/hooks/usePushNotifications.jsx
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth'; 

export function usePushNotifications() {
    const { user } = useAuth();

    useEffect(() => {
        console.log('[FCM] Hook triggered. User:', user?.uid || 'No user');
        if (!user || !user.uid) return;

        const saveTokenToFirestore = async (token) => {
            console.log('[FCM] Attempting to save token to Firestore...', token);
            try {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    fcmToken: token,
                    fcmTokenUpdatedAt: new Date()
                });
                console.log('[FCM] ✅ Token successfully saved to profile!');
            } catch (error) {
                console.error('[FCM] ❌ Failed to save FCM token to Firestore. Check your security rules!', error);
            }
        };

        const setupPushNotifications = async () => {
            const platform = Capacitor.getPlatform();
            console.log(`[FCM] Setting up push notifications for platform: ${platform}`);

            if (Capacitor.isNativePlatform()) {
                // ---------------------------------------------
                // NATIVE ANDROID / IOS LOGIC
                // ---------------------------------------------
                try {
                    let permStatus = await PushNotifications.checkPermissions();
                    console.log('[FCM Native] Permission status:', permStatus);
                    
                    if (permStatus.receive === 'prompt') {
                        permStatus = await PushNotifications.requestPermissions();
                        console.log('[FCM Native] Requested permissions:', permStatus);
                    }

                    if (permStatus.receive !== 'granted') {
                        console.warn("[FCM Native] ❌ User denied push notification permissions");
                        return;
                    }

                    console.log('[FCM Native] Registering for push notifications...');
                    await PushNotifications.register();

                    PushNotifications.addListener('registration', (token) => {
                        console.log('[FCM Native] ✅ Push registration success, token: ' + token.value);
                        saveTokenToFirestore(token.value);
                    });

                    PushNotifications.addListener('registrationError', (error) => {
                        console.error('[FCM Native] ❌ Error on registration: ', JSON.stringify(error));
                    });

                    PushNotifications.addListener('pushNotificationReceived', (notification) => {
                        console.log('[FCM Native] Push received in foreground: ', notification);
                        alert(`Notification: ${notification.title}\n${notification.body}`);
                    });

                    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                        console.log('[FCM Native] Push action performed: ', action);
                    });

                } catch (error) {
                    console.error("[FCM Native] ❌ Failed to setup Native Push Notifications:", error);
                }
            } else {
                // ---------------------------------------------
                // WEB BROWSER LOGIC
                // ---------------------------------------------
                try {
                    console.log('[FCM Web] Requesting notification permissions...');
                    const permission = await Notification.requestPermission();
                    console.log('[FCM Web] Permission result:', permission);

                    if (permission === 'granted') {
                        const messaging = getMessaging();
                        console.log('[FCM Web] Getting token...');
                        
                        // IMPORTANT: Replace with your actual VAPID key
                        const vapidKey = 'BEmmrhr6OeXSRrTHtIjApXDF9MTeca5juJ5pblMFyGu7N4vCQk_qQ0SFVA2OA4arm7TvobGETRuu173tYsJb0BY';
                        
                        if (vapidKey === 'YOUR_PUBLIC_VAPID_KEY_HERE') {
                             console.error('[FCM Web] ❌ VAPID KEY IS MISSING. You must replace YOUR_PUBLIC_VAPID_KEY_HERE with your key from the Firebase Console.');
                             return;
                        }

                        const currentToken = await getToken(messaging, { vapidKey });
                        
                        if (currentToken) {
                            console.log('[FCM Web] ✅ Token generated:', currentToken);
                            saveTokenToFirestore(currentToken);
                        } else {
                            console.warn('[FCM Web] ❌ No registration token available. Request permission to generate one.');
                        }

                        onMessage(messaging, (payload) => {
                            console.log('[FCM Web] Message received in web foreground: ', payload);
                            if (payload.notification) {
                                alert(`Notification: ${payload.notification.title}\n${payload.notification.body}`);
                            }
                        });

                    } else {
                        console.warn("[FCM Web] ❌ User denied web push notification permissions");
                    }
                } catch (error) {
                    console.error('[FCM Web] ❌ An error occurred while retrieving Web FCM token.', error);
                }
            }
        };

        setupPushNotifications();

        return () => {
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners();
            }
        };
    }, [user]); 
}