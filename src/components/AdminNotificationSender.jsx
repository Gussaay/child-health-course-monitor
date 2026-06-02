// src/components/AdminNotificationSender.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Card, CardBody, Button, Input, FormGroup, Select, Toast, Table, Modal } from './CommonComponents';
import { Trash2, CheckCircle, Clock, Eye } from 'lucide-react';

export default function AdminNotificationSender({ preselectedUserId = 'all' }) {
    const [users, setUsers] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    
    // Send form state
    const [targetUser, setTargetUser] = useState(preselectedUserId);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // Manager state
    const [notifications, setNotifications] = useState([]);
    const [managerLoading, setManagerLoading] = useState(true);
    
    // Stats Modal state - store ONLY the ID to prevent unnecessary re-renders of the listener
    const [statsNotifId, setStatsNotifId] = useState(null);

    // Derive the active notification directly from the existing list
    const statsNotif = notifications.find(n => n.id === statsNotifId) || null;

    // Sync the dropdown state if the parent passes a new pre-selected ID
    useEffect(() => {
        setTargetUser(preselectedUserId);
    }, [preselectedUserId]);

    useEffect(() => {
        // Fetch users for the dropdown and for mapping read/delivered receipts
        const fetchUsers = async () => {
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUsers(usersList);
                
                const map = {};
                usersList.forEach(u => {
                    map[u.id] = u.displayName || u.email || u.id;
                });
                setUsersMap(map);
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };
        fetchUsers();
    }, []);

    // Listen to all notifications for the manager
    useEffect(() => {
        setManagerLoading(true);
        const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = [];
            snapshot.forEach(doc => {
                notifs.push({ id: doc.id, ...doc.data() });
            });
            setNotifications(notifs);
            setManagerLoading(false);
        }, (error) => {
            console.error("Error fetching notifications:", error);
            setManagerLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            setToast({ message: 'Title and message are required', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            // 1. Save to Firestore (Preserves History & Read/Delivered Receipts UI)
            await addDoc(collection(db, 'notifications'), {
                title,
                message,
                targetUser, 
                createdAt: serverTimestamp(),
                deliveredTo: [], 
                readBy: [],      
                status: 'active'
            });

            // 2. Trigger FCM Push Notification via Cloud Function
            try {
                const functions = getFunctions(db.app); 
                const sendFCMNotification = httpsCallable(functions, 'sendFCMNotification');
                
                const fcmResult = await sendFCMNotification({
                    targetUserId: targetUser,
                    title: title,
                    body: message
                });
                
                if (fcmResult.data.success) {
                    console.log(`FCM Sent to ${fcmResult.data.successCount} devices.`);
                }
            } catch (fcmError) {
                console.error("FCM Send Error:", fcmError);
            }

            setToast({ message: 'Notification sent and pushed successfully!', type: 'success' });
            setTitle('');
            setMessage('');
        } catch (error) {
            console.error("Error sending notification:", error);
            setToast({ message: 'Error sending notification', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this notification? It will be removed for all users.")) return;
        
        try {
            await deleteDoc(doc(db, 'notifications', id));
            setToast({ message: 'Notification deleted.', type: 'success' });
            if (statsNotifId === id) setStatsNotifId(null);
        } catch (error) {
            console.error("Error deleting notification:", error);
            setToast({ message: 'Error deleting notification.', type: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. SEND NOTIFICATION FORM */}
            <Card>
                <div className="px-6 py-4 border-b border-gray-200 bg-sky-50 rounded-t-lg">
                    <h3 className="text-lg font-bold text-sky-900">Send Real-Time Notification</h3>
                    <p className="text-sm text-sky-700">Broadcast a message to all users or target a specific individual.</p>
                </div>
                <CardBody>
                    <form onSubmit={handleSend} className="space-y-4 max-w-2xl">
                        <FormGroup label="Target Audience">
                            <Select value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className="bg-white">
                                <option value="all">Broadcast to All Users</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.displayName || u.email || u.id}
                                    </option>
                                ))}
                            </Select>
                        </FormGroup>

                        <FormGroup label="Notification Title">
                            <Input 
                                value={title} 
                                onChange={(e) => setTitle(e.target.value)} 
                                placeholder="e.g. System Update or Course Reminder" 
                                required 
                            />
                        </FormGroup>

                        <FormGroup label="Message Body">
                            <textarea
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 p-3 border text-sm"
                                rows="3"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Type your message here..."
                                required
                            />
                        </FormGroup>

                        <Button type="submit" disabled={loading} className="w-full justify-center shadow-md">
                            {loading ? 'Sending...' : 'Send Notification Now'}
                        </Button>
                    </form>
                </CardBody>
            </Card>

            {/* 2. NOTIFICATIONS MANAGER TABLE */}
            <Card className="overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Notification History & Manager</h3>
                        <p className="text-sm text-gray-500">Track sent messages and view detailed delivery & read receipts.</p>
                    </div>
                </div>
                
                {managerLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading history...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No notifications sent yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table headers={['Date', 'Target', 'Message Details', 'Engagement Stats', 'Actions']}>
                            {notifications.map(notif => {
                                const deliveredCount = (notif.deliveredTo || []).length;
                                const readCount = (notif.readBy || []).length;
                                const dateStr = notif.createdAt 
                                    ? new Date(notif.createdAt.seconds * 1000).toLocaleString() 
                                    : 'Sending...';

                                const targetDisplay = notif.targetUser === 'all' 
                                    ? <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold uppercase tracking-wider">All Users</span>
                                    : <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold uppercase tracking-wider">{usersMap[notif.targetUser] || 'Unknown User'}</span>;

                                return (
                                    <tr key={notif.id} className="hover:bg-gray-50 group">
                                        <td className="whitespace-nowrap text-xs text-gray-500">
                                            <div className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {dateStr}</div>
                                        </td>
                                        <td className="whitespace-nowrap">{targetDisplay}</td>
                                        <td>
                                            <div className="max-w-xs">
                                                <div className="font-bold text-sm text-gray-800 truncate" title={notif.title}>{notif.title}</div>
                                                <div className="text-xs text-gray-500 truncate" title={notif.message}>{notif.message}</div>
                                            </div>
                                        </td>
                                        <td 
                                            className="cursor-pointer bg-gray-50/50 hover:bg-sky-50 transition-colors rounded-lg m-1 p-2 border border-transparent hover:border-sky-200"
                                            onClick={() => setStatsNotifId(notif.id)}
                                            title="Click to view detailed engagement lists"
                                        >
                                            <div className="flex flex-col gap-1.5 text-xs">
                                                <div className={`flex items-center font-bold ${deliveredCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> {deliveredCount} Delivered
                                                </div>
                                                <div className={`flex items-center font-bold ${readCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                    <Eye className="w-3.5 h-3.5 mr-1" /> {readCount} Read
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <Button 
                                                variant="danger" 
                                                size="sm" 
                                                onClick={() => handleDelete(notif.id)}
                                                className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 py-1 px-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                    </div>
                )}
            </Card>

            {/* 3. ENGAGEMENT STATS MODAL */}
            {statsNotif && (
                <Modal isOpen={!!statsNotif} onClose={() => setStatsNotifId(null)} title="Notification Engagement Details">
                    {/* Removed max-h and overflow configurations to rely completely on default Modal container scrolling behavior */}
                    <div className="p-5 bg-gray-50 space-y-5">
                        
                        {/* Notification Preview */}
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <h4 className="font-bold text-gray-900 text-lg mb-1">{statsNotif.title}</h4>
                            <p className="text-sm text-gray-600 mb-3">{statsNotif.message}</p>
                            <div className="flex items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                <Clock className="w-3 h-3 mr-1" />
                                {statsNotif.createdAt ? new Date(statsNotif.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                                <span className="mx-2">•</span>
                                Target: {statsNotif.targetUser === 'all' ? 'All Users' : usersMap[statsNotif.targetUser] || 'Unknown'}
                            </div>
                        </div>
                        
                        {/* Two Columns Grid elements flow cleanly with no internal layout boundaries */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                            {/* Column 1: DELIVERED */}
                            <div className="bg-white rounded-xl border border-blue-100 shadow-sm flex flex-col">
                                <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 font-bold text-blue-900 flex items-center justify-between rounded-t-xl">
                                    <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-blue-600"/> Delivered To Device</span>
                                    <span className="bg-blue-200 text-blue-900 px-2.5 py-0.5 rounded-full text-xs shadow-sm">
                                        {(statsNotif.deliveredTo || []).length}
                                    </span>
                                </div>
                                <div>
                                    <ul className="divide-y divide-gray-50">
                                        {(!statsNotif.deliveredTo || statsNotif.deliveredTo.length === 0) ? (
                                            <li className="p-6 text-center text-sm text-gray-400 italic">No delivery receipts yet.</li>
                                        ) : (
                                            statsNotif.deliveredTo.map(uid => (
                                                <li key={uid} className="px-4 py-2.5 text-sm text-gray-700 flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {(usersMap[uid] || '?')[0].toUpperCase()}
                                                    </div>
                                                    <span className="truncate">{usersMap[uid] || uid}</span>
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                </div>
                            </div>

                            {/* Column 2: READ */}
                            <div className="bg-white rounded-xl border border-green-100 shadow-sm flex flex-col">
                                <div className="bg-green-50 px-4 py-3 border-b border-green-100 font-bold text-green-900 flex items-center justify-between rounded-t-xl">
                                    <span className="flex items-center"><Eye className="w-4 h-4 mr-2 text-green-600"/> Clicked & Read</span>
                                    <span className="bg-green-200 text-green-900 px-2.5 py-0.5 rounded-full text-xs shadow-sm">
                                        {(statsNotif.readBy || []).length}
                                    </span>
                                </div>
                                <div>
                                    <ul className="divide-y divide-gray-50">
                                        {(!statsNotif.readBy || statsNotif.readBy.length === 0) ? (
                                            <li className="p-6 text-center text-sm text-gray-400 italic">Nobody has read this yet.</li>
                                        ) : (
                                            statsNotif.readBy.map(uid => (
                                                <li key={uid} className="px-4 py-2.5 text-sm text-gray-700 flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                            {(usersMap[uid] || '?')[0].toUpperCase()}
                                                        </div>
                                                        <span className="truncate">{usersMap[uid] || uid}</span>
                                                    </div>
                                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>

                    </div>
                    <div className="p-4 border-t border-gray-200 bg-white flex justify-end rounded-b-xl">
                        <Button onClick={() => setStatsNotifId(null)} variant="secondary" className="px-6">Close Details</Button>
                    </div>
                </Modal>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}