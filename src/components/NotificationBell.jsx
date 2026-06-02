// src/components/NotificationBell.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Bell, Trash2, ChevronRight, ArrowLeft } from 'lucide-react';
import { Modal, Button, Toast } from './CommonComponents';

export default function NotificationBell({ user }) {
    const [notifications, setNotifications] = useState([]);
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [selectedNotif, setSelectedNotif] = useState(null); 
    const [toast, setToast] = useState(null);
    
    // Track initial load to prevent toast flooding
    const initialLoadRef = useRef(true);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'notifications'),
            where('targetUser', 'in', ['all', user.uid]),
            where('status', '==', 'active')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = [];
            snapshot.forEach(docSnap => {
                notifs.push({ id: docSnap.id, ...docSnap.data() });
            });
            
            // Sort newest first
            notifs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setNotifications(notifs);

            // Update selected notification if it gets modified while open
            if (selectedNotif) {
                const updatedSelected = notifs.find(n => n.id === selectedNotif.id);
                if (updatedSelected) setSelectedNotif(updatedSelected);
            }

            // Process document changes for Delivery Tracking and Toasts
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const notifId = change.doc.id;

                    // 1. Mark as DELIVERED as soon as it reaches the device
                    if (!(data.deliveredTo || []).includes(user.uid)) {
                        const notifRef = doc(db, 'notifications', notifId);
                        updateDoc(notifRef, {
                            deliveredTo: arrayUnion(user.uid)
                        }).catch(err => console.error("Error marking delivered:", err));
                    }

                    // 2. Show toast ONLY if it's a completely new notification (not initial app load)
                    if (!initialLoadRef.current && !(data.readBy || []).includes(user.uid)) {
                        setToast({ 
                            show: true, 
                            message: `🔔 ${data.title}`, 
                            type: 'info' 
                        });
                    }
                }
            });

            // Mark initial load as complete after processing the first snapshot
            if (initialLoadRef.current) {
                initialLoadRef.current = false;
            }
        });

        return () => unsubscribe();
    }, [user, selectedNotif]);

    // Handle clicking a notification in the list
    const handleNotificationClick = async (notif) => {
        setSelectedNotif(notif); // Switch to detail view

        // 3. Mark as READ explicitly when the user clicks the notification
        if (user && !(notif.readBy || []).includes(user.uid)) {
            try {
                const notifRef = doc(db, 'notifications', notif.id);
                await updateDoc(notifRef, {
                    readBy: arrayUnion(user.uid)
                });
            } catch (error) {
                console.error("Error marking notification as read:", error);
            }
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
            setSelectedNotif(null); // Go back to list if cleared while viewing
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
                    onClose={() => { setIsNotificationsModalOpen(false); setSelectedNotif(null); }} 
                    title={selectedNotif ? "Message Details" : "Notifications"}
                >
                    <div className="p-4 max-h-[60vh] min-h-[300px] overflow-y-auto bg-gray-50">
                        
                        {/* LIST VIEW */}
                        {!selectedNotif && notifications.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <Bell className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                                <p>No notifications right now.</p>
                            </div>
                        )}

                        {!selectedNotif && notifications.length > 0 && (
                            <div className="space-y-2">
                                {notifications.map(notif => {
                                    const isRead = (notif.readBy || []).includes(user.uid);
                                    return (
                                        <div 
                                            key={notif.id} 
                                            onClick={() => handleNotificationClick(notif)}
                                            className={`p-3 rounded-lg border shadow-sm cursor-pointer transition-all hover:shadow-md ${isRead ? 'bg-white border-gray-200' : 'bg-sky-50 border-sky-300'}`}
                                        >
                                            <div className="flex justify-between items-center gap-3">
                                                <div className="flex-1 truncate">
                                                    <h4 className={`text-sm font-bold truncate ${isRead ? 'text-gray-800' : 'text-sky-900'}`}>
                                                        {notif.title}
                                                        {!isRead && <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full"></span>}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 truncate mt-0.5">{notif.message}</p>
                                                </div>
                                                <div className="text-[10px] text-gray-400 shrink-0 flex items-center">
                                                    {notif.createdAt ? new Date(notif.createdAt.seconds * 1000).toLocaleDateString() : 'New'}
                                                    <ChevronRight size={16} className="ml-1 text-gray-300" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* DETAIL VIEW */}
                        {selectedNotif && (
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex items-start justify-between border-b border-gray-100 pb-4 mb-4">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-lg font-bold text-gray-900 leading-tight mb-1">{selectedNotif.title}</h4>
                                        <div className="text-xs text-gray-400">
                                            {selectedNotif.createdAt ? new Date(selectedNotif.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                                        </div>
                                    </div>
                                    {selectedNotif.targetUser !== 'all' && (
                                        <button 
                                            onClick={() => handleClearNotification(selectedNotif.id, selectedNotif.targetUser)} 
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 bg-gray-50" 
                                            title="Delete Notification"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {selectedNotif.message}
                                </div>
                            </div>
                        )}

                    </div>
                    
                    {/* MODAL FOOTER */}
                    <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center rounded-b-xl">
                        {selectedNotif ? (
                            <Button onClick={() => setSelectedNotif(null)} variant="secondary" className="px-4">
                                <ArrowLeft size={16} className="mr-2" /> Back to List
                            </Button>
                        ) : (
                            <div></div> // Spacer
                        )}
                        
                        <Button onClick={() => { setIsNotificationsModalOpen(false); setSelectedNotif(null); }} variant="secondary">
                            Close
                        </Button>
                    </div>
                </Modal>
            )}
        </>
    );
}