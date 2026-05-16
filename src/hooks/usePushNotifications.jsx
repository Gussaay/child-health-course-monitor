// src/hooks/usePushNotifications.jsx
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export function usePushNotifications() {
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            const setupPushNotifications = async () => {
                try {
                    // 1. Request permission to receive push notifications
                    let permStatus = await PushNotifications.checkPermissions();
                    
                    if (permStatus.receive === 'prompt') {
                        permStatus = await PushNotifications.requestPermissions();
                    }

                    if (permStatus.receive !== 'granted') {
                        console.warn("User denied push notification permissions");
                        return;
                    }

                    // 2. Register with Apple / Google to receive push via FCM
                    await PushNotifications.register();

                    // 3. Listen for successful registration (Provides the FCM token)
                    PushNotifications.addListener('registration', (token) => {
                        console.log('Push registration success, token: ' + token.value);
                        // Optional: Save token to Firestore here if needed
                    });

                    // 4. Listen for registration errors
                    PushNotifications.addListener('registrationError', (error) => {
                        console.error('Error on registration: ' + JSON.stringify(error));
                    });

                    // 5. Listen for notifications received while the app is OPEN (Foreground)
                    PushNotifications.addListener('pushNotificationReceived', (notification) => {
                        console.log('Push received in foreground: ', notification);
                    });

                    // 6. Listen for when a user TAPS the notification (Background/Killed)
                    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                        console.log('Push action performed: ', action);
                        
                        // Example: If your server sends custom data like { "route": "admin" }
                        const data = action.notification.data;
                        if (data && data.route) {
                            // You could use a global navigation dispatcher here if needed
                        }
                    });

                } catch (error) {
                    console.error("Failed to setup Push Notifications:", error);
                }
            };

            setupPushNotifications();
        }
    }, []);
}