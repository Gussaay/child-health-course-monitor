// AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Card, PageHeader, Button, Table, Spinner, Select, Checkbox, Toast } from './CommonComponents';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { STATE_LOCALITIES } from './constants'; // Import the states

// --- Define Professional Roles and their display labels ---
const ROLES = {
    'super_user': 'Super User',
    'federal_manager': 'Federal Manager',
    'states_manager': 'States Manager',
    'course_coordinator': 'Course Coordinator',
    'user': 'Standard User',
};

// Define default permissions for a user
const DEFAULT_PERMISSIONS = {
    canViewDashboard: false,
    canViewLanding: false,
    canViewCourse: false,
    canAddCourse: false,
    canEditDeleteActiveCourse: false,
    canEditDeleteInactiveCourse: false,
    canBulkUploadParticipant: false,
    canAddParticipant: false,
    canEditDeleteParticipant: false,
    canAddMonitoring: false,
    canEditDeleteMonitoring: false,
    canAddFinalReport: false,
    canEditDeleteFinalReport: false,
    canViewFacilitators: false,
    canViewAdmin: false,
    canViewDetailedData: false,
};

const PERMISSION_DESCRIPTIONS = {
    canViewDashboard: "Allow navigating to the dashboard.",
    canViewLanding: "Allow viewing the course package selection screen.",
    canViewCourse: "View courses, participants, monitoring, and reports.",
    canAddCourse: "Add new courses.",
    canEditDeleteActiveCourse: "Edit or delete active courses (end date in the future).",
    canEditDeleteInactiveCourse: "Edit or delete inactive courses (end date has passed).",
    canBulkUploadParticipant: "Bulk upload participants from an Excel sheet.",
    canAddParticipant: "Allow adding new participants to a course.",
    canEditDeleteParticipant: "Allow editing or deleting participants.",
    canAddMonitoring: "Allow adding clinical monitoring observations.",
    canEditDeleteMonitoring: "Allow editing or deleting monitoring cases.",
    canAddFinalReport: "Allow adding a final report to a course.",
    canEditDeleteFinalReport: "Allow editing or deleting a final report.",
    canViewFacilitators: "View and manage facilitators.",
    canViewAdmin: "Access the Admin Dashboard.",
    canViewDetailedData: "Allow fetching and viewing detailed data on the dashboard.",
};


const STATES = Object.keys(STATE_LOCALITIES); //

// Admin Dashboard Component
export function AdminDashboard() {
    const [users, setUsers] = useState([]); //
    const [rolesAndPermissions, setRolesAndPermissions] = useState({}); //
    const [loading, setLoading] = useState(true); //
    const [currentUser, setCurrentUser] = useState(null); //
    const [toast, setToast] = useState({ show: false, message: '', type: '' }); //
    const [currentUserRole, setCurrentUserRole] = useState(null); //

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user); //
            if (user) {
                // Fetch the user's role and set it in state
                const userRef = doc(db, 'users', user.uid); //
                getDoc(userRef).then(docSnap => {
                    if (docSnap.exists()) {
                        setCurrentUserRole(docSnap.data().role); //
                    }
                }).catch(error => {
                    console.error("Error fetching current user's role:", error); //
                    setCurrentUserRole(null); //
                });
            } else {
                setCurrentUserRole(null); //
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (currentUser) {
            loadData(); //
        }
    }, [currentUser]);

    const loadData = async () => {
        setLoading(true); //
        try {
            const usersQuery = query(collection(db, "users")); //
            const usersSnapshot = await getDocs(usersQuery); //
            const userList = usersSnapshot.docs.map(doc => ({
                id: doc.id, //
                ...doc.data()
            }));

            const rolesDocRef = doc(db, "meta", "roles"); //
            const rolesDocSnap = await getDoc(rolesDocRef); //
            const permissionsData = rolesDocSnap.exists() ? rolesDocSnap.data() : {}; //
            
            // Merge default permissions with fetched data to ensure all keys are present
            const updatedPermissions = Object.keys(ROLES).reduce((acc, role) => {
                const roleData = permissionsData[role] || {}; //
                acc[role] = { ...DEFAULT_PERMISSIONS, ...roleData }; //
                return acc;
            }, {});

            setUsers(userList); //
            setRolesAndPermissions(updatedPermissions); //
        } catch (error) {
            console.error("Error loading data:", error); //
            setToast({ show: true, message: "Error loading data. Please try again.", type: "error" }); //
        }
        setLoading(false); //
    };

    const handleUserRoleChange = async (userId, newRole) => {
        const userToUpdate = users.find(u => u.id === userId); //
        if (currentUser.email === userToUpdate.email && newRole !== userToUpdate.role) {
            setToast({ show: true, message: "You cannot change your own role.", type: "error" }); //
            return;
        }

        if (window.confirm(`Are you sure you want to change this user's role to ${ROLES[newRole]}? This will update their permissions.`)) { //
            const userRef = doc(db, "users", userId); //
            const newPermissions = rolesAndPermissions[newRole]; //
            try {
                await updateDoc(userRef, { 
                    role: newRole, //
                    permissions: newPermissions //
                });
                const updatedUsers = users.map(user => 
                    user.id === userId ? { ...user, role: newRole } : user //
                );
                setUsers(updatedUsers); //
                setToast({ show: true, message: `Successfully updated ${userToUpdate.email}'s role.`, type: "success" }); //
            } catch (error) {
                console.error("Error updating user role:", error); //
                setToast({ show: true, message: "Failed to update user role. Please try again.", type: "error" }); //
            }
        }
    };

    const handleUserStateChange = async (userId, newState) => {
        const userToUpdate = users.find(u => u.id === userId); //
        if (userToUpdate.role !== 'states_manager') {
            setToast({ show: true, message: "State can only be assigned to a States Manager.", type: "error" }); //
            return;
        }

        const userRef = doc(db, "users", userId); //
        try {
            await updateDoc(userRef, { assignedState: newState }); //
            setUsers(users.map(user => user.id === userId ? { ...user, assignedState: newState } : user)); //
            setToast({ show: true, message: "User's state updated successfully.", type: "success" }); //
        } catch (error) {
            console.error("Error updating user state:", error); //
            setToast({ show: true, message: "Failed to update user state. Please try again.", type: "error" }); //
        }
    };

    const handlePermissionChange = (role, permission, value) => {
        setRolesAndPermissions(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [permission]: value, //
            },
        }));
    };

    const handleSavePermissions = async () => {
        setLoading(true); //
        const rolesDocRef = doc(db, "meta", "roles"); //
        try {
            await setDoc(rolesDocRef, rolesAndPermissions); //
            setToast({ show: true, message: "Permissions saved successfully!", type: "success" }); //
        } catch (error) {
            console.error("Error saving permissions:", error); //
            setToast({ show: true, message: "Failed to save permissions. Please try again.", type: "error" }); //
        }
        setLoading(false); //
    };

    const syncPermissionsForRole = async (role) => {
        if (!window.confirm(`Are you sure you want to save these permissions for ALL users with the role '${ROLES[role]}'?`)) { //
            return;
        }

        setLoading(true); //
        try {
            const batch = writeBatch(db); //
            const usersQuery = query(collection(db, "users"), where("role", "==", role)); //
            const usersSnapshot = await getDocs(usersQuery); //
            const newPermissions = rolesAndPermissions[role]; //

            usersSnapshot.docs.forEach(userDoc => {
                const userRef = doc(db, "users", userDoc.id); //
                batch.update(userRef, { permissions: newPermissions }); //
            });

            await batch.commit(); //
            setToast({ show: true, message: `Permissions for all '${ROLES[role]}' users have been synchronized.`, type: "success" }); //
        } catch (error) {
            console.error("Error syncing permissions:", error); //
            setToast({ show: true, message: "Failed to sync permissions. Please try again.", type: "error" }); //
        }
        setLoading(false); //
    };

    if (loading) return <Spinner />; //

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Admin Dashboard" 
                subtitle="Manage system users and their access permissions."
            />
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}

            <Card>
                <h3 className="text-lg font-medium mb-4">Manage User Roles</h3>
                {users.length > 0 ? (
                    <Table headers={["Email", "Current Role", "Change Role", "Assigned State"]}>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>{user.email}</td>
                                <td>
                                    <span className="bg-slate-200 text-slate-800 text-xs font-medium px-2 py-1 rounded-full">
                                        {ROLES[user.role] || 'N/A'}
                                    </span>
                                </td>
                                <td>
                                    <Select 
                                        value={user.role} 
                                        onChange={(e) => handleUserRoleChange(user.id, e.target.value)}
                                        disabled={currentUser?.uid === user.id || (user.role === 'super_user' && currentUserRole !== 'super_user')}
                                    >
                                        {Object.entries(ROLES).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </Select>
                                </td>
                                <td>
                                    {user.role === 'states_manager' ? (
                                        <Select
                                            value={user.assignedState || ''}
                                            onChange={(e) => handleUserStateChange(user.id, e.target.value)}
                                        >
                                            <option value="">-- Select State --</option>
                                            {STATES.map(state => (
                                                <option key={state} value={state}>{state}</option>
                                            ))}
                                        </Select>
                                    ) : (
                                        <span>N/A</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </Table>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        No users found.
                    </div>
                )}
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Manage Role Permissions</h3>
                    <Button onClick={handleSavePermissions} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Global Permissions'}
                    </Button>
                </div>
                
                {Object.keys(ROLES).map(role => (
                    <div key={role} className="border-b py-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-base font-semibold">{ROLES[role]}</h4>
                            {currentUserRole === 'super_user' && role !== 'super_user' && (
                                <Button
                                    variant="secondary"
                                    onClick={() => syncPermissionsForRole(role)}
                                    disabled={loading}
                                >
                                    Sync Permissions for All Users
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                            {Object.keys(DEFAULT_PERMISSIONS).map(permission => (
                                <label key={permission} className="flex items-center space-x-2">
                                    <Checkbox
                                        checked={rolesAndPermissions[role]?.[permission] || false}
                                        onChange={(e) => handlePermissionChange(role, permission, e.target.checked)}
                                        disabled={currentUserRole !== 'super_user' || role === 'super_user'}
                                    />
                                    <div>
                                        <div className="font-medium text-sm">{permission.replace(/([A-Z])/g, ' $1').trim()}</div>
                                        <div className="text-xs text-gray-500">{PERMISSION_DESCRIPTIONS[permission]}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </Card>
        </div>
    );
}

export default AdminDashboard;