// src/components/NotificationBell.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Bell, Trash2, ChevronRight, ArrowLeft } from 'lucide-react';
import { Modal, Button, Toast } from './CommonComponents';

export default function NotificationBell({ user, navigate }) {
    const [notifications, setNotifications] = useState([]);
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [selectedNotif, setSelectedNotif] = useState(null); 
    const [toast, setToast] = useState(null);
    const [actionAlert, setActionAlert] = useState(null); 
    
    // Track initial load to prevent toast flooding
    const initialLoadRef = useRef(true);

    useEffect(() => {
        if (!user) return;

        // UPDATED: Added 'managers_and_super_users' to the query so group notifications are caught
        const q = query(
            collection(db, 'notifications'),
            where('targetUser', 'in', ['all', 'managers_and_super_users', user.uid]),
            where('status', '==', 'active')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                // ONLY show notifications this specific user hasn't cleared/deleted
                if (!(data.deletedBy || []).includes(user.uid)) {
                    notifs.push({ id: docSnap.id, ...data });
                }
            });
            
            // Sort newest first
            notifs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setNotifications(notifs);

            if (selectedNotif) {
                const updatedSelected = notifs.find(n => n.id === selectedNotif.id);
                if (updatedSelected) setSelectedNotif(updatedSelected);
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const notifId = change.doc.id;

                    // Prevent processing if the user already cleared it
                    if ((data.deletedBy || []).includes(user.uid)) return;

                    // 1. Mark as DELIVERED
                    if (!(data.deliveredTo || []).includes(user.uid)) {
                        const notifRef = doc(db, 'notifications', notifId);
                        updateDoc(notifRef, {
                            deliveredTo: arrayUnion(user.uid)
                        }).catch(err => console.error("Error marking delivered:", err));
                    }

                    // 2. Handle actionable (Pop-up) vs standard (Toast)
                    if (!initialLoadRef.current && !(data.readBy || []).includes(user.uid)) {
                        if (data.actionView) {
                            setActionAlert({ id: notifId, ...data });
                        } else {
                            setToast({ 
                                show: true, 
                                message: `🔔 ${data.title}`, 
                                type: 'info' 
                            });
                        }
                    }
                }
            });

            if (initialLoadRef.current) {
                initialLoadRef.current = false;
            }
        });

        return () => unsubscribe();
    }, [user, selectedNotif]);

    // Standard click just marks as Read (Used for regular notifications in the list)
    const handleNotificationClick = async (notif) => {
        setSelectedNotif(notif); 
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

    // Immediate personal deletion (Used for Action Pop-ups and the Trash icon)
    const handleClearNotification = async (notificationId) => {
        if (!user) return;
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            // Append the user to 'deletedBy' so it hides for them, but stays in DB for others
            await updateDoc(notifRef, { 
                readBy: arrayUnion(user.uid),
                deletedBy: arrayUnion(user.uid) 
            });
            setSelectedNotif(null); 
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

            {/* ACTION ALERT POP-UP MODAL (For Federal Managers / Updates) */}
            {actionAlert && (
                <Modal isOpen={!!actionAlert} onClose={() => setActionAlert(null)} title="Action Required">
                    <div className="p-6 text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-sky-100 mb-4 shadow-sm">
                            <Bell className="h-8 w-8 text-sky-600 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{actionAlert.title}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{actionAlert.message || actionAlert.body}</p>
                        <div className="flex justify-center gap-3 mt-8 border-t pt-6">
                            <Button variant="secondary" onClick={() => {
                                handleClearNotification(actionAlert.id); // Hides it permanently for this user
                                setActionAlert(null);
                            }}>
                                Dismiss
                            </Button>
                            <Button onClick={() => {
                                handleClearNotification(actionAlert.id); // Hides it permanently for this user
                                setActionAlert(null);
                                if(navigate) {
                                    const params = actionAlert.actionParams ? JSON.parse(actionAlert.actionParams) : {};
                                    navigate(actionAlert.actionView, params);
                                }
                            }}>
                                View Details Now
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {isNotificationsModalOpen && (
                <Modal 
                    isOpen={isNotificationsModalOpen} 
                    onClose={() => { setIsNotificationsModalOpen(false); setSelectedNotif(null); }} 
                    title={selectedNotif ? "Message Details" : "Notifications"}
                >
                    <div className="p-4 max-h-[60vh] min-h-[300px] overflow-y-auto bg-gray-50">
                        
                        {/* LIST VIEW (Standard Notifications) */}
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
                                                    <p className="text-xs text-gray-500 truncate mt-0.5">{notif.message || notif.body}</p>
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
                                    <button 
                                        onClick={() => handleClearNotification(selectedNotif.id)} 
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 bg-gray-50" 
                                        title="Delete Notification"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {selectedNotif.message || selectedNotif.body}
                                </div>
                            </div>
                        )}

                    </div>
                    
                    <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center rounded-b-xl">
                        {selectedNotif ? (
                            <Button onClick={() => setSelectedNotif(null)} variant="secondary" className="px-4">
                                <ArrowLeft size={16} className="mr-2" /> Back to List
                            </Button>
                        ) : (
                            <div></div>
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