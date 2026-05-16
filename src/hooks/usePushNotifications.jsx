// src/hooks/usePushNotifications.jsx
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getMessaging, getToken } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth'; 

export function usePushNotifications() {
    const { user } = useAuth();

    useEffect(() => {
        // Only attempt to get a token if the user is fully logged in
        if (!user || !user.uid) return;

        const saveTokenToFirestore = async (token) => {
            try {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    fcmToken: token,
                    fcmTokenUpdatedAt: new Date()
                });
                console.log('FCM Token successfully saved to profile.');
            } catch (error) {
                console.error('Failed to save FCM token to Firestore:', error);
            }
        };

        const setupPushNotifications = async () => {
            if (Capacitor.isNativePlatform()) {
                // ---------------------------------------------
                // NATIVE ANDROID / IOS LOGIC (Capacitor)
                // ---------------------------------------------
                try {
                    let permStatus = await PushNotifications.checkPermissions();
                    
                    if (permStatus.receive === 'prompt') {
                        permStatus = await PushNotifications.requestPermissions();
                    }

                    if (permStatus.receive !== 'granted') {
                        console.warn("User denied push notification permissions");
                        return;
                    }

                    await PushNotifications.register();

                    PushNotifications.addListener('registration', (token) => {
                        console.log('Push registration success, token: ' + token.value);
                        saveTokenToFirestore(token.value);
                    });

                    PushNotifications.addListener('registrationError', (error) => {
                        console.error('Error on registration: ' + JSON.stringify(error));
                    });

                    PushNotifications.addListener('pushNotificationReceived', (notification) => {
                        console.log('Push received in foreground: ', notification);
                    });

                    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                        console.log('Push action performed: ', action);
                        const data = action.notification.data;
                        if (data && data.route) {
                            // Handle routing if necessary
                        }
                    });

                } catch (error) {
                    console.error("Failed to setup Native Push Notifications:", error);
                }
            } else {
                // ---------------------------------------------
                // WEB BROWSER LOGIC (Firebase JS SDK)
                // ---------------------------------------------
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        const messaging = getMessaging();
                        // IMPORTANT: Replace 'YOUR_PUBLIC_VAPID_KEY_HERE' with your actual VAPID key 
                        // from Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration
                        const currentToken = await getToken(messaging, { 
                            vapidKey: 'YOUR_PUBLIC_VAPID_KEY_HERE' 
                        });
                        
                        if (currentToken) {
                            saveTokenToFirestore(currentToken);
                        } else {
                            console.warn('No registration token available. Request permission to generate one.');
                        }
                    } else {
                        console.warn("User denied web push notification permissions");
                    }
                } catch (error) {
                    console.error('An error occurred while retrieving Web FCM token.', error);
                }
            }
        };

        setupPushNotifications();

        // Cleanup native listeners when component unmounts
        return () => {
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners();
            }
        };
    }, [user]); 
}