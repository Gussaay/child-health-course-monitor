// src/components/NotificationBell.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Bell, Trash2 } from 'lucide-react';
import { Modal, Button, Toast } from './CommonComponents';

export default function NotificationBell({ user }) {
    const [notifications, setNotifications] = useState([]);
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'notifications'),
            where('targetUser', 'in', ['all', user.uid]),
            where('status', '==', 'active')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = [];
            snapshot.forEach(doc => {
                notifs.push({ id: doc.id, ...doc.data() });
            });
            // Sort newest first
            notifs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setNotifications(notifs);

            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const isNew = data.createdAt && (Date.now() - data.createdAt.toMillis() < 60000); 
                    
                    if (isNew && !(data.readBy || []).includes(user.uid)) {
                        setToast({ 
                            show: true, 
                            message: `🔔 ${data.title}`, 
                            type: 'info' 
                        });
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [user]);

    const handleMarkAsRead = async (notificationId) => {
        if (!user) return;
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            await updateDoc(notifRef, {
                readBy: arrayUnion(user.uid)
            });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const handleClearNotification = async (notificationId, currentTargetUser) => {
        if (!user) return;
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            if (currentTargetUser === 'all') {
                await updateDoc(notifRef, { readBy: arrayUnion(user.uid) });
            } else {
                await updateDoc(notifRef, { status: 'cleared' });
            }
        } catch (error) {
            console.error("Error clearing notification:", error);
        }
    };
    
    const unreadCount = useMemo(() => {
        if (!user) return 0;
        return notifications.filter(n => !(n.readBy || []).includes(user.uid)).length;
    }, [notifications, user]);

    return (
        <>
            <button
                onClick={() => setIsNotificationsModalOpen(true)}
                className="relative p-1.5 sm:px-3 sm:py-1 text-sm font-semibold text-slate-200 bg-slate-600 rounded-md hover:bg-slate-500 hover:text-white flex items-center justify-center transition-colors"
                title="Notifications"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white ring-2 ring-slate-700">
                        {unreadCount}
                    </span>
                )}
            </button>

            {toast?.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {isNotificationsModalOpen && (
                <Modal 
                    isOpen={isNotificationsModalOpen} 
                    onClose={() => setIsNotificationsModalOpen(false)} 
                    title="Messages & Notifications"
                >
                    <div className="p-4 max-h-[60vh] overflow-y-auto bg-gray-50">
                        {notifications.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p>No notifications right now.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notifications.map(notif => {
                                    const isRead = (notif.readBy || []).includes(user.uid);
                                    return (
                                        <div key={notif.id} className={`p-4 rounded-xl border shadow-sm relative transition-colors ${isRead ? 'bg-white border-gray-200' : 'bg-sky-50 border-sky-200'}`}>
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <h4 className={`text-sm font-bold mb-1 ${isRead ? 'text-gray-800' : 'text-sky-900'}`}>
                                                        {notif.title}
                                                        {!isRead && <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full"></span>}
                                                    </h4>
                                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{notif.message}</p>
                                                    <div className="text-[10px] text-gray-400 mt-2">
                                                        {notif.createdAt ? new Date(notif.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 shrink-0">
                                                    {!isRead && (
                                                        <Button size="sm" variant="secondary" onClick={() => handleMarkAsRead(notif.id)} className="text-[10px] py-1 px-2 h-auto">
                                                            Mark Read
                                                        </Button>
                                                    )}
                                                    {notif.targetUser !== 'all' && (
                                                        <button onClick={() => handleClearNotification(notif.id, notif.targetUser)} className="p-1 text-gray-400 hover:text-red-500 transition-colors mx-auto" title="Clear Notification">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-gray-200 bg-white flex justify-end">
                        <Button onClick={() => setIsNotificationsModalOpen(false)} variant="secondary">
                            Close
                        </Button>
                    </div>
                </Modal>
            )}
        </>
    );
}