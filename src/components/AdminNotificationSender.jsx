// src/components/AdminNotificationSender.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions'; // <-- NEW IMPORTS FOR FCM
import { Card, CardHeader, CardBody, Button, Input, FormGroup, Select, Toast, Table } from './CommonComponents';
import { Trash2, CheckCircle, Clock } from 'lucide-react';

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

    // Sync the dropdown state if the parent passes a new pre-selected ID
    useEffect(() => {
        setTargetUser(preselectedUserId);
    }, [preselectedUserId]);

    useEffect(() => {
        // Fetch users for the dropdown and for mapping read receipts
        const fetchUsers = async () => {
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUsers(usersList);
                
                const map = {};
                usersList.forEach(u => {
                    map[u.id] = u.email || u.displayName || u.id;
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
            // 1. Save to Firestore (Preserves your in-app History & Read Receipts UI)
            await addDoc(collection(db, 'notifications'), {
                title,
                message,
                targetUser, // 'all' or specific user ID
                createdAt: serverTimestamp(),
                readBy: [], 
                status: 'active'
            });

            // 2. Trigger FCM Push Notification via Cloud Function
            try {
                // Initialize functions using your existing db app instance
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
                // Note: We don't fail the whole function here so the in-app notification still works
                // even if the user hasn't set up their FCM token yet.
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
                                        {u.email || u.displayName || u.id}
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
                        <p className="text-sm text-gray-500">Track sent messages and view read receipts.</p>
                    </div>
                </div>
                
                {managerLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading history...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No notifications sent yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table headers={['Date', 'Target', 'Message Details', 'Read Receipts', 'Actions']}>
                            {notifications.map(notif => {
                                const readCount = (notif.readBy || []).length;
                                const dateStr = notif.createdAt 
                                    ? new Date(notif.createdAt.seconds * 1000).toLocaleString() 
                                    : 'Sending...';

                                const targetDisplay = notif.targetUser === 'all' 
                                    ? <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold uppercase tracking-wider">All Users</span>
                                    : <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold uppercase tracking-wider">{usersMap[notif.targetUser] || 'Unknown User'}</span>;

                                return (
                                    <tr key={notif.id} className="hover:bg-gray-50">
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
                                        <td>
                                            <div className="flex items-center text-xs">
                                                <CheckCircle className={`w-4 h-4 mr-1.5 ${readCount > 0 ? 'text-green-500' : 'text-gray-300'}`} />
                                                {notif.targetUser === 'all' ? (
                                                    <span className="font-medium text-gray-600">{readCount} user(s) read</span>
                                                ) : (
                                                    <span className={`font-medium ${readCount > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                                        {readCount > 0 ? 'Read' : 'Unread'}
                                                    </span>
                                                )}
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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}