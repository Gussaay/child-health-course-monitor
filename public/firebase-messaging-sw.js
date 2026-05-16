// public/firebase-messaging-sw.js

// 1. Import Firebase compat libraries for the Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 2. Initialize the Firebase app in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyDRZoNR9eiAnE9RyqPZ-eXYbhkWOuJmoyI",
  authDomain: "imnci-courses-monitor.firebaseapp.com",
  projectId: "imnci-courses-monitor",
  storageBucket: "gs://imnci-courses-monitor.firebasestorage.app",
  messagingSenderId: "928082473485",
  appId: "1:928082473485:web:cbbde89d57c657f52a9b44"
};

firebase.initializeApp(firebaseConfig);

// 3. Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// 4. Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Customize the notification UI here
    const notificationTitle = payload.notification?.title || 'New Notification';
    const notificationOptions = {
        body: payload.notification?.body,
        icon: '/favicon.ico', 
        badge: '/favicon.ico', 
        data: payload.data 
    };

    // Show the system tray notification
    self.registration.showNotification(notificationTitle, notificationOptions);
});