// src/components/AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, PageHeader, Button, Table, Spinner, Select, Checkbox, Toast, Input, FormGroup, Modal, CardBody, CardFooter } from './CommonComponents';
import { db, auth } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, getDoc, setDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { STATE_LOCALITIES } from './constants'; 

// --- Icons & Data Imports ---
import { CheckCircle, XCircle, RefreshCw, Lock, Users, Shield, Activity, Filter, Database, Edit3, Clock, Settings, Smartphone, CloudDownload, History } from 'lucide-react';
import { listFederalCoordinators } from '../data';

// --- PERMISSIONS IMPORT ---
import {
    ALL_PERMISSIONS,
    applyDerivedPermissions,
    mergeRolePermissions,
    DEFAULT_ROLE_PERMISSIONS,
    ROLES,
    PERMISSION_DESCRIPTIONS
} from './permissions';
// ----------------------------

// -----------------------------------------------------------------------------
// LOCAL CONSTANTS
// -----------------------------------------------------------------------------
const STATES = Object.keys(STATE_LOCALITIES);

// --- Styling Helpers ---
const getRoleBadgeStyle = (role) => {
    if (role === 'super_user') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (role.includes('manager')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (role.includes('coordinator')) return 'bg-teal-100 text-teal-800 border-teal-200';
    if (role === 'facilitator') return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
};

// --- Helper Components ---

const AdminTabs = ({ activeTab, setActiveTab, currentUserRoles = [] }) => {
    const tabs = [
        { key: 'roles', label: 'Manage User Roles', icon: Users },
        { key: 'permissions', label: 'Manage Role Permissions', icon: Shield },
    ];

    if (currentUserRoles.includes('super_user')) {
        tabs.push({ key: 'usage', label: 'Resource Usage', icon: Activity });
        tabs.push({ key: 'updates', label: 'App Updates', icon: Smartphone });
    }

    return (
        <div className="flex space-x-1 border-b border-gray-200 mb-6 overflow-x-auto p-1.5 bg-gray-50/80 rounded-t-xl shadow-sm inset-x-0">
            {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center px-4 py-2.5 font-medium text-sm rounded-lg transition-all duration-200 whitespace-nowrap ${
                            isActive
                                ? 'bg-white text-sky-600 shadow border border-gray-100 scale-100'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 scale-95 hover:scale-100'
                        }`}
                    >
                        <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-sky-500' : 'text-gray-400'}`} />
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
};

const PermissionsEditor = ({ role, currentPermissions, allPermissions, onPermissionChange, disabled }) => {
    const PERMISSION_CATEGORIES = useMemo(() => [
        { title: 'A. Course Management', keys: ['canViewCourse', 'canAddCourse', 'canManageCourse', 'canManageCertificates'] },
        { title: 'B. Child Health Service Facility Management', keys: ['canViewFacilities', 'canManageFacilities'] },
        { title: 'C. Human Resource (HR) Management', keys: ['canViewHumanResource', 'canManageHumanResource'] },
        { title: 'D. Skills Mentorship', keys: ['canViewSkillsMentorship', 'canManageSkillsMentorship', 'canAddMentorshipVisit'] },
        { title: 'E. System / Advanced / Scope', keys: ['canUseSuperUserAdvancedFeatures', 'canUseFederalManagerAdvancedFeatures', 'manageLocation', 'manageTimePeriod', 'canViewAdmin', 'canViewDashboard'] }
    ], []);
    
    const handlePermissionChangeInternal = (key, value) => {
        onPermissionChange(role, key, value);
    };
    
    const isStandardUser = role === 'user';
    
    return (
        <div className="w-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 relative">
            <div className="bg-white rounded-xl">
                {PERMISSION_CATEGORIES.map((category, catIndex) => (
                    <div key={category.title} className={catIndex > 0 ? 'border-t-4 border-gray-100' : ''}>
                        <div className={`px-6 py-3 bg-gray-100 border-b border-gray-200 sticky top-0 z-20 shadow-sm ${catIndex === 0 ? 'rounded-t-xl' : ''}`}>
                            <h5 className="text-gray-800 font-black text-sm uppercase tracking-wider">
                                {category.title}
                            </h5>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {category.keys.map(permission => {
                                if (!currentPermissions.hasOwnProperty(permission)) return null;
                                const value = currentPermissions[permission];
                                const isBoolean = typeof allPermissions[permission] === 'boolean';
                                const formattedTitle = permission.replace(/([A-Z])/g, ' $1').trim();
                                
                                if (['canViewDashboard', 'canApproveSubmissions'].includes(permission)) {
                                    return (
                                        <div key={permission} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/40">
                                            <div className="flex-1 pr-4">
                                                <div className="text-lg font-bold capitalize text-gray-700 flex items-center gap-3">
                                                    {formattedTitle}
                                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 border border-gray-300 shadow-sm">Derived</span>
                                                </div>
                                                <div className="text-sm mt-1 text-gray-500">{PERMISSION_DESCRIPTIONS[permission] || 'Derived permission.'}</div>
                                            </div>
                                            <div className="shrink-0">
                                                <span className={`text-xs uppercase font-bold tracking-wide px-3 py-1.5 rounded-full border shadow-sm ${value ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                    Effective: {value ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }
                                
                                return (
                                    <div key={permission} className="px-6 py-4 hover:bg-sky-50/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                                        <div className="flex-1 pr-4">
                                            <div className="text-lg font-bold text-gray-900 group-hover:text-sky-800 transition-colors capitalize">
                                                {formattedTitle}
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {PERMISSION_DESCRIPTIONS[permission]}
                                            </div>
                                        </div>
                                        <div className="shrink-0 md:min-w-[200px]">
                                            {isBoolean ? (
                                                <label className="flex items-center cursor-pointer p-2 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all">
                                                    <Checkbox 
                                                        checked={!!value} 
                                                        onChange={(e) => handlePermissionChangeInternal(permission, e.target.checked)} 
                                                        disabled={disabled || isStandardUser} 
                                                    />
                                                    <span className={`ml-3 font-bold text-sm ${value ? 'text-green-700' : 'text-gray-600'}`}>
                                                        {value ? 'Allowed' : 'Denied'}
                                                    </span>
                                                </label>
                                            ) : (
                                                <Select 
                                                    value={value || ''} 
                                                    onChange={(e) => handlePermissionChangeInternal(permission, e.target.value)} 
                                                    disabled={disabled || isStandardUser} 
                                                    className="w-full text-sm font-bold bg-white border-gray-300 shadow-sm rounded-lg py-2"
                                                >
                                                    {permission === 'manageScope' && (<><option value="none">None (Standard)</option><option value="federal">Federal Level</option><option value="state">State Manager</option><option value="locality">Locality Manager</option><option value="course">Course Coordinator</option></>)}
                                                    {permission === 'manageTimePeriod' && (<><option value="anytime">Anytime</option><option value="course_period_only">Course Period Only</option><option value="course_period_plus_3_days">Course Period + 3 Days</option></>)}
                                                    {permission === 'manageLocation' && (<><option value="">N/A (Federal/Course)</option><option value="user_state">User's State</option><option value="user_locality">User's Locality</option></>)}
                                                </Select>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const formatDuration = (milliseconds) => {
    if (!milliseconds || milliseconds < 60000) {
        return '0 minutes';
    }
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    return parts.join(', ');
};

// -----------------------------------------------------------------------------
// Main AdminDashboard Component
// -----------------------------------------------------------------------------
export function AdminDashboard() {
    const [users, setUsers] = useState([]);
    const [rolesAndPermissions, setRolesAndPermissions] = useState({});
    const [usageStats, setUsageStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [currentUserRoles, setCurrentUserRoles] = useState([]); 
    const [currentUserPermissions, setCurrentUserPermissions] = useState({}); 
    
    const [activeTab, setActiveTab] = useState('roles');

    const [filterRole, setFilterRole] = useState('');
    const [filterState, setFilterState] = useState('');
    const [filterLocality, setFilterLocality] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [viewingUser, setViewingUser] = useState(null);
    const [editingRolesUser, setEditingRolesUser] = useState(null);
    const [tempSelectedRoles, setTempSelectedRoles] = useState([]);
    const [tempSelectedState, setTempSelectedState] = useState('');
    const [tempSelectedLocality, setTempSelectedLocality] = useState('');
    
    // --- STATE FOR ROLE PERMISSIONS MODAL ---
    const [editingPermissionRole, setEditingPermissionRole] = useState(null);

    // --- STATE FOR INDIVIDUAL USER PERMISSIONS MODAL ---
    const [editingUserPermissions, setEditingUserPermissions] = useState(null);
    const [tempUserPermissions, setTempUserPermissions] = useState({});

    // --- APP UPDATE STATES ---
    const [otaVersion, setOtaVersion] = useState("Checking Server...");
    const [serverNativeConfig, setServerNativeConfig] = useState(null); 
    const [isUpdateActive, setIsUpdateActive] = useState(false); // Controls the "Native Update Required" View

    const [updateConfig, setUpdateConfig] = useState({
        latestNativeBuild: 1,
        versionString: "1.0.0",
        downloadUrl: "https://imnci-courses-monitor.web.app/app-release.apk",
        mandatory: true,
        releaseNotes: ""
    });

    useEffect(() => {
        setLoading(true);
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                getDoc(userRef).then(docSnap => {
                    let role = 'user';
                    let roles = ['user'];
                    let perms = {};
                    
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        role = data.role || 'user';
                        roles = data.roles || [role];
                        perms = data.permissions || {};
                    } 
                    
                    setCurrentUserRole(role);
                    setCurrentUserRoles(roles);
                    setCurrentUserPermissions(perms);
                    
                    // Allow Super User or Federal Manager data levels 
                    const effectiveRole = roles.includes('super_user') ? 'super_user' : role;
                    loadData(effectiveRole);
                }).catch(error => {
                    console.error("Error fetching current user's role:", error);
                    setCurrentUserRole(null);
                    setCurrentUserRoles([]);
                    setLoading(false);
                });
            } else {
                setCurrentUserRole(null);
                setCurrentUserRoles([]);
                setUsers([]);
                setRolesAndPermissions({});
                setUsageStats([]);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadData = async (role) => {
        try {
            const usersQuery = query(collection(db, "users"));
            const usersSnapshot = await getDocs(usersQuery);
            const userList = usersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    displayName: data.displayName || data.name || (data.email ? data.email.split('@')[0] : 'Unknown'), 
                    assignedLocality: data.assignedLocality || '',
                };
            });

            const rolesDocRef = doc(db, "meta", "roles");
            const rolesDocSnap = await getDoc(rolesDocRef);
            const permissionsData = rolesDocSnap.exists() ? rolesDocSnap.data() : {};
            const updatedPermissions = Object.keys(ROLES).reduce((acc, r) => {
                const defaultPerms = DEFAULT_ROLE_PERMISSIONS[r] || DEFAULT_ROLE_PERMISSIONS['user'];
                const savedPerms = permissionsData[r]; 
                let mergedPerms = { ...ALL_PERMISSIONS, ...defaultPerms, ...(savedPerms || {}) };
                acc[r] = applyDerivedPermissions(mergedPerms);
                return acc;
            }, {});

            setUsers(userList);
            setRolesAndPermissions(updatedPermissions);

            // Always fetch usage stats (telemetry) to populate versions in the User Directory
            try {
                const usageQuery = query(collection(db, "userUsageStats"));
                const usageSnapshot = await getDocs(usageQuery);
                const usageList = usageSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setUsageStats(usageList);
            } catch (e) {
                console.warn("Could not load usage stats:", e);
                setUsageStats([]);
            }

            if (role === 'super_user') {
                // Load Native App Update Config from Database
                const updateRef = doc(db, "meta", "update_config");
                const updateSnap = await getDoc(updateRef);
                if (updateSnap.exists()) {
                    const data = updateSnap.data();
                    setUpdateConfig(data);
                    // Determine if the form should be hidden based on the active mandatory configuration
                    if (data.mandatory) {
                        setIsUpdateActive(true);
                    }
                }

                // 1. Fetch current Live OTA Version from Firebase Hosting
                try {
                    const res = await fetch("https://imnci-courses-monitor.web.app/latest/update.json?t=" + Date.now());
                    if (res.ok) {
                        const otaData = await res.json();
                        setOtaVersion(otaData.version || "Unknown");
                    } else {
                        setOtaVersion("No Capgo Payload Found");
                    }
                } catch(e) {
                    setOtaVersion("Offline");
                }

                // 2. Fetch the absolute latest compiled APK config from Firebase Hosting
                try {
                    const nativeRes = await fetch("https://imnci-courses-monitor.web.app/native-version.json?t=" + Date.now());
                    if (nativeRes.ok) {
                        const nativeData = await nativeRes.json();
                        setServerNativeConfig(nativeData);
                    }
                } catch(e) {
                    console.warn("Could not fetch server native config", e);
                }
            }
        } catch (error) {
            setToast({ show: true, message: "Error loading data. Please try again.", type: "error" });
        }
        setLoading(false);
    };

    const handleSaveUpdateConfig = async () => {
        if (!window.confirm("Are you sure? Updating this configuration will immediately trigger a mandatory download prompt for any user running an older native app build.")) return;
        setLoading(true);
        try {
            await setDoc(doc(db, "meta", "update_config"), updateConfig);
            if (updateConfig.mandatory) {
                setIsUpdateActive(true);
            } else {
                setIsUpdateActive(false);
            }
            setToast({show: true, message: 'Update triggered! Mobile users will be prompted immediately.', type: 'success'});
        } catch(e) {
            console.error("Update config error", e);
            setToast({show: true, message: 'Failed to save update configuration.', type: 'error'});
        }
        setLoading(false);
    };

    const handleReverseUpdate = async () => {
        if (!window.confirm("Are you sure you want to reverse the mandatory update? Users will no longer be forced to download the new APK.")) return;
        setLoading(true);
        try {
            const newConfig = { ...updateConfig, mandatory: false };
            await setDoc(doc(db, "meta", "update_config"), newConfig);
            setUpdateConfig(newConfig);
            setIsUpdateActive(false);
            setToast({show: true, message: 'Mandatory update requirement reversed.', type: 'success'});
        } catch(e) {
            console.error("Revert config error", e);
            setToast({show: true, message: 'Failed to reverse update configuration.', type: 'error'});
        }
        setLoading(false);
    };

    const handleUserRolesChange = async (userId, selectedRoles, assignedState, assignedLocality) => {
        const userToUpdate = users.find(u => u.id === userId);
        
        if (selectedRoles.length === 0) {
            setToast({ show: true, message: "A user must have at least one role.", type: "error" });
            return;
        }

        if (currentUser.email === userToUpdate.email && !selectedRoles.includes('super_user') && (userToUpdate.roles || [userToUpdate.role]).includes('super_user')) {
            setToast({ show: true, message: "You cannot remove your own super_user access.", type: "error" });
            return;
        }

        const mergedPermissions = mergeRolePermissions(selectedRoles, rolesAndPermissions);
        const primaryRole = selectedRoles[0];
        
        let updatePayload = {
            role: primaryRole,
            roles: selectedRoles,
            permissions: mergedPermissions 
        };

        const LOCATION_ASSIGNMENT_ROLES = ['states_manager', 'state_coordinator', 'locality_manager'];
        const needsLocation = selectedRoles.some(r => LOCATION_ASSIGNMENT_ROLES.includes(r));

        if (!needsLocation) {
            updatePayload.assignedState = '';
            updatePayload.assignedLocality = '';
        } else {
            updatePayload.assignedState = assignedState || '';
            if (selectedRoles.includes('locality_manager')) {
                updatePayload.assignedLocality = assignedLocality || '';
            } else {
                updatePayload.assignedLocality = '';
            }
        }

        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, updatePayload);
            setUsers(users.map(user => user.id === userId ? { ...user, ...updatePayload } : user));
            setToast({ show: true, message: `Successfully updated user roles and boundaries.`, type: "success" });
        } catch (error) {
            setToast({ show: true, message: "Failed to update user roles.", type: "error" });
        }
    };

    const handleUserStateChange = async (userId, newState) => {
        const userToUpdate = users.find(u => u.id === userId);
        const userRoles = userToUpdate.roles || [userToUpdate.role];
        if (!userRoles.some(r => ['states_manager', 'state_coordinator', 'locality_manager'].includes(r))) {
            setToast({ show: true, message: "State can only be assigned to a State Manager, State Coordinator, or Locality Manager.", type: "error" });
            return;
        }
        const userRef = doc(db, "users", userId);
        try {
            await updateDoc(userRef, { assignedState: newState, assignedLocality: '' }); 
            setUsers(users.map(user => user.id === userId ? { ...user, assignedState: newState, assignedLocality: '' } : user));
            setToast({ show: true, message: "User's state updated successfully.", type: "success" });
        } catch (error) {
            setToast({ show: true, message: "Failed to update user state. Please try again.", type: "error" });
        }
    };

    const handleLocalityChange = async (userId, newState, newLocality) => {
        const userToUpdate = users.find(u => u.id === userId);
        const userRoles = userToUpdate.roles || [userToUpdate.role];
        if (!userRoles.includes('locality_manager')) {
            setToast({ show: true, message: "Locality can only be assigned to a Locality Manager.", type: "error" });
            return;
        }
        if (!newState) {
            setToast({ show: true, message: "Please select a State before assigning a Locality.", type: "error" });
            return;
        }
        const userRef = doc(db, "users", userId);
        try {
            await updateDoc(userRef, { assignedState: newState, assignedLocality: newLocality });
            setUsers(users.map(user => user.id === userId ? { ...user, assignedState: newState, assignedLocality: newLocality } : user));
            setToast({ show: true, message: "User's locality updated successfully.", type: "success" });
        } catch (error) {
            setToast({ show: true, message: "Failed to update user locality. Please try again.", type: "error" });
        }
    };

    const handlePermissionChange = (role, permission, value) => {
        setRolesAndPermissions(prev => {
            let baseRole = { ...ALL_PERMISSIONS, ...prev[role] };
            baseRole[permission] = value;
            
            baseRole.canApproveSubmissions = ALL_PERMISSIONS.canApproveSubmissions;
            baseRole.canViewDashboard = ALL_PERMISSIONS.canViewDashboard; 
            
            if (permission !== 'canViewHumanResource') {
                baseRole.canViewHumanResource = prev[role].canViewHumanResource;
            }
            if (permission !== 'canViewFacilities') {
                baseRole.canViewFacilities = prev[role].canViewFacilities;
            } 
            if (permission !== 'canViewSkillsMentorship') {
                baseRole.canViewSkillsMentorship = prev[role].canViewSkillsMentorship;
            }
            if (permission !== 'canViewCourse') {
                 baseRole.canViewCourse = prev[role].canViewCourse;
            }

            if (baseRole.canManageFacilities) {
                 baseRole.canViewFacilities = true;
            }
            if (baseRole.canAddCourse || baseRole.canManageCourse) {
                 baseRole.canViewCourse = true;
            }
            
            const updatedRole = applyDerivedPermissions(baseRole);
            return { ...prev, [role]: updatedRole };
        });
    };

    const handleIndividualPermissionChange = (userId, permission, value) => {
        setTempUserPermissions(prev => {
            let updated = { ...prev, [permission]: value };
            return applyDerivedPermissions(updated);
        });
    };

    const handleSaveIndividualPermissions = async () => {
        if (!editingUserPermissions) return;
        setLoading(true);
        try {
            const userRef = doc(db, "users", editingUserPermissions.id);
            await updateDoc(userRef, { permissions: tempUserPermissions });
            setUsers(users.map(u => 
                u.id === editingUserPermissions.id ? { ...u, permissions: tempUserPermissions } : u
            ));
            setToast({ show: true, message: `Custom permissions updated for ${editingUserPermissions.displayName}.`, type: "success" });
            setEditingUserPermissions(null);
        } catch (error) {
            console.error("Error updating individual permissions:", error);
            setToast({ show: true, message: "Failed to update custom permissions.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    // --- INCREMENTAL PERMISSION SYNC ---
    const handleCloseAndSyncBlueprint = async () => {
        if (!editingPermissionRole) return;
        const roleToSync = editingPermissionRole;

        setLoading(true);
        try {
            const rolesAndPermissionsWithDerived = Object.keys(rolesAndPermissions).reduce((acc, role) => {
                const currentRolePerms = { ...ALL_PERMISSIONS, ...(rolesAndPermissions[role] || {}) };
                acc[role] = applyDerivedPermissions(currentRolePerms);
                return acc;
            }, {});

            const rolesDocRef = doc(db, "meta", "roles");
            await setDoc(rolesDocRef, rolesAndPermissionsWithDerived);
            
            const batch = writeBatch(db);
            let updateCount = 0;

            const updatedUsers = users.map(user => {
                const userRoles = user.roles || [user.role || 'user'];
                
                if (userRoles.includes(roleToSync)) {
                    const mergedPermissions = mergeRolePermissions(userRoles, rolesAndPermissionsWithDerived);
                    const userRef = doc(db, "users", user.id);
                    batch.update(userRef, { permissions: { ...ALL_PERMISSIONS, ...mergedPermissions } });
                    updateCount++;
                    
                    return { ...user, permissions: { ...ALL_PERMISSIONS, ...mergedPermissions } };
                }
                return user;
            });
            
            if (updateCount > 0) {
                await batch.commit();
            }
            
            setRolesAndPermissions(rolesAndPermissionsWithDerived);
            setUsers(updatedUsers); 
            
            setToast({ show: true, message: `Permissions saved and incrementally synced to ${updateCount} users!`, type: "success" });
        } catch (error) {
            console.error("Error saving and syncing permissions:", error);
            setToast({ show: true, message: "Failed to save and sync permissions. Please try again.", type: "error" });
        } finally {
            setLoading(false);
            setEditingPermissionRole(null); 
        }
    };

    const handleSendPasswordReset = async (email) => {
        if (!email) return;
        if (window.confirm(`Send a password reset email to ${email}?`)) {
            try {
                await sendPasswordResetEmail(auth, email);
                setToast({ show: true, message: `Password reset email sent to ${email}.`, type: 'success' });
            } catch (error) {
                console.error("Password reset error:", error);
                setToast({ show: true, message: `Failed to send reset email: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleDeleteAccount = async (userId, userEmail) => {
        if (!userId) return;
        
        const confirmMessage = `CRITICAL WARNING:\n\nAre you sure you want to delete the database profile for ${userEmail}?\n\nNote: This removes their permissions and profile from the app. For total removal, their Firebase Authentication account must also be deleted via the Firebase Console or a Cloud Function.`;
        
        if (window.confirm(confirmMessage)) {
            setLoading(true);
            try {
                await deleteDoc(doc(db, "users", userId));
                setUsers(users.filter(u => u.id !== userId));
                setToast({ show: true, message: `User profile for ${userEmail} deleted successfully.`, type: 'success' });
                if (viewingUser && viewingUser.id === userId) {
                    setViewingUser(null);
                }
            } catch (error) {
                console.error("Error deleting user profile:", error);
                setToast({ show: true, message: `Failed to delete account: ${error.message}`, type: 'error' });
            } finally {
                setLoading(false);
            }
        }
    };

    const allLocalitiesInFilterState = useMemo(() => {
        if (!filterState || filterState === 'All') return [];
        return (STATE_LOCALITIES[filterState]?.localities || []).map(l => l.en);
    }, [filterState]);

    const filteredUsers = useMemo(() => {
        const queryLower = searchQuery.toLowerCase();
        let filtered = users.filter(user => {
            const roleMatch = !filterRole || (user.roles || [user.role]).includes(filterRole);
            const stateMatch = !filterState || user.assignedState === filterState;
            const localityMatch = !filterLocality || user.assignedLocality === filterLocality;
            const searchMatch = !searchQuery ||
                                String(user.displayName || '').toLowerCase().includes(queryLower) ||
                                String(user.email || '').toLowerCase().includes(queryLower);
            return roleMatch && stateMatch && localityMatch && searchMatch;
        });
        return filtered;
    }, [users, filterRole, filterState, filterLocality, searchQuery]);

    const aggregates = useMemo(() => {
        const totalUsersWithDuration = usageStats.filter(u => (u.totalActiveDurationMs || 0) > 0).length;
        const totals = usageStats.reduce(
            (acc, user) => {
                acc.totalReads += user.totalReads || 0;
                acc.totalWrites += user.totalWrites || 0;
                acc.totalDurationMs += user.totalActiveDurationMs || 0;
                return acc;
            },
            { totalReads: 0, totalWrites: 0, totalDurationMs: 0 }
        );
        return {
            ...totals,
            meanDurationMs: totalUsersWithDuration > 0 ? (totals.totalDurationMs / totalUsersWithDuration) : 0,
        };
    }, [usageStats]);

    if (loading) return <Spinner />;

    // =========================================================================
    // NEW APP UPDATES TAB
    // =========================================================================
    const renderUpdatesTab = () => {
        const isNewApkAvailable = serverNativeConfig && serverNativeConfig.latestNativeBuild > (updateConfig?.latestNativeBuild || 0);

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* OTA Web Status Block */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-full shrink-0"><CloudDownload className="w-6 h-6 text-emerald-500" /></div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Over-The-Air (OTA) Status</h3>
                        <p className="text-sm text-gray-500 mt-0.5 max-w-lg">
                            OTA updates happen entirely automatically. Whenever GitHub Actions finishes a build, Capgo serves these UI changes to users instantly in the background.
                        </p>
                    </div>
                    <div className="ml-auto text-right">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Live OTA Version</div>
                        <div className="text-2xl font-black text-emerald-600 border border-emerald-100 bg-emerald-50 px-3 py-1 rounded-lg">v{otaVersion}</div>
                    </div>
                </div>

                {/* --- 1-CLICK NEW APK NOTIFICATION BANNER --- */}
                {isNewApkAvailable && (
                    <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 rounded-full shrink-0"><Smartphone className="w-6 h-6 text-emerald-600" /></div>
                            <div>
                                <h3 className="text-lg font-bold text-emerald-900">New APK Available for Deployment!</h3>
                                <p className="text-sm text-emerald-700 mt-0.5 max-w-xl">
                                    GitHub Actions has built a newer native app (<strong>v{serverNativeConfig.versionString}</strong>). Click the button to instantly configure and trigger this update.
                                </p>
                            </div>
                        </div>
                        <Button 
                            onClick={() => {
                                setUpdateConfig({
                                    ...serverNativeConfig,
                                    mandatory: true,
                                    releaseNotes: `Update to version ${serverNativeConfig.versionString}. Includes latest bug fixes and improvements.`
                                });
                                // Note: It still requires clicking "Push Native Update Prompt" to save and lock
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md border border-emerald-700 whitespace-nowrap"
                        >
                            <CloudDownload className="w-4 h-4 mr-2" /> 1-Click Load Latest APK
                        </Button>
                    </div>
                )}

                {/* Native APK Trigger Control Block */}
                <Card className="shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center">
                            <Smartphone className="w-5 h-5 text-sky-600 mr-3" />
                            <div>
                                <h3 className="text-md font-bold text-gray-800">Native APK Trigger Control</h3>
                                <p className="text-xs text-gray-500">You control when users are forced to download a completely new Native APK installation.</p>
                            </div>
                        </div>
                        {isUpdateActive && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold border border-red-200 shadow-sm">
                                <Shield className="w-3.5 h-3.5 mr-1" /> Native Update Required
                            </span>
                        )}
                    </div>
                    
                    {isUpdateActive ? (
                        <div className="p-8 flex flex-col items-center justify-center text-center bg-red-50/20">
                            <div className="inline-flex items-center px-4 py-2 rounded-full bg-red-100 text-red-800 font-bold mb-4 shadow-sm border border-red-200">
                                <Smartphone className="w-5 h-5 mr-2" /> Native Update is Currently Mandatory
                            </div>
                            <h4 className="text-lg font-bold text-gray-800 mb-2">Target Build: v{updateConfig.versionString} (ID: {updateConfig.latestNativeBuild})</h4>
                            <p className="text-sm text-gray-600 max-w-md mb-6">Users opening an older app build are currently being locked out and forced to download the new APK. Form entry fields are hidden while active.</p>
                            
                            <Button onClick={handleReverseUpdate} variant="secondary" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 shadow-sm bg-white">
                                <RefreshCw className="w-4 h-4 mr-2" /> Reverse / Cancel Mandatory Update
                            </Button>
                        </div>
                    ) : (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormGroup label="Target Native Build ID">
                                <Input 
                                    type="number" 
                                    value={updateConfig.latestNativeBuild} 
                                    onChange={e => setUpdateConfig({...updateConfig, latestNativeBuild: parseInt(e.target.value)})} 
                                    placeholder="e.g. 19" 
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Matches the exact Native ID built by GitHub Actions.</p>
                            </FormGroup>
                            <FormGroup label="Display Version String">
                                <Input 
                                    value={updateConfig.versionString} 
                                    onChange={e => setUpdateConfig({...updateConfig, versionString: e.target.value})} 
                                    placeholder="e.g. 1.19.0" 
                                />
                            </FormGroup>
                            <div className="md:col-span-2">
                                <FormGroup label="Release Notes / Changelog">
                                    <textarea 
                                        rows="3" 
                                        className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500" 
                                        value={updateConfig.releaseNotes} 
                                        onChange={e => setUpdateConfig({...updateConfig, releaseNotes: e.target.value})} 
                                        placeholder="Describe what's new in this Native APK..."
                                    ></textarea>
                                </FormGroup>
                            </div>
                            <div className="md:col-span-2 flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-sky-50 rounded-xl border border-sky-100 gap-4">
                                <div>
                                    <label className="flex items-center cursor-pointer">
                                        <Checkbox checked={updateConfig.mandatory} onChange={e => setUpdateConfig({...updateConfig, mandatory: e.target.checked})} />
                                        <span className="ml-3 font-bold text-sky-900 text-sm">Force Mandatory Update</span>
                                    </label>
                                    <p className="text-xs text-sky-700 mt-1 ml-8">If checked, users cannot dismiss the popup and must download the APK.</p>
                                </div>
                                <Button onClick={handleSaveUpdateConfig} variant="primary" className="shadow-md shrink-0 w-full md:w-auto">
                                    <Smartphone className="w-4 h-4 mr-2"/> Push Native Update Prompt
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        );
    }

    const renderUserRolesTab = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center text-gray-800 font-bold mb-4">
                    <Filter className="w-5 h-5 mr-2 text-sky-500" /> Filter & Search Directory
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                    <FormGroup label="Search Directory">
                        <Input type="search" placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-gray-50 border-gray-200" />
                    </FormGroup>
                    <FormGroup label="Filter by Role">
                        <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="bg-gray-50 border-gray-200">
                            <option value="">All Roles</option>
                            {Object.entries(ROLES).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Filter by State">
                        <Select value={filterState} onChange={(e) => { setFilterState(e.target.value); setFilterLocality(''); }} className="bg-gray-50 border-gray-200">
                            <option value="">All States</option>
                            {STATES.map(state => (<option key={state} value={state}>{state}</option>))}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Filter by Locality">
                        <Select value={filterLocality} onChange={(e) => setFilterLocality(e.target.value)} disabled={!filterState || allLocalitiesInFilterState.length === 0} className="bg-gray-50 border-gray-200 disabled:opacity-50">
                            <option value="">All Localities</option>
                            {allLocalitiesInFilterState.map(locEn => {
                                const locAr = STATE_LOCALITIES[filterState]?.localities.find(l => l.en === locEn)?.ar || locEn;
                                return <option key={locEn} value={locEn}>{locAr}</option>
                            })}
                        </Select>
                    </FormGroup>
                </div>
            </div>

            <Card className="overflow-hidden shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">User Directory <span className="text-sm font-normal text-gray-500 ml-2">({filteredUsers.length} users)</span></h3>
                </div>
                {filteredUsers.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <Table headers={["Name & Email", "Current Roles", "Manage Roles", "Assigned Area", "App Status", "Web Status"]}>
                            {filteredUsers.map((user) => {
                                const userRoles = user.roles || [user.role || 'user'];
                                const isStateAssignable = userRoles.some(r => ['states_manager', 'state_coordinator', 'locality_manager'].includes(r));
                                const isLocalityAssignable = userRoles.includes('locality_manager');
                                const currentLocalities = user.assignedState ? (STATE_LOCALITIES[user.assignedState]?.localities || []) : [];
                                
                                const userStats = usageStats.find(s => s.id === user.id) || {};
                                
                                const appVersion = user.appVersion || userStats.appVersion;
                                const lastAppAccess = user.lastAppAccess || userStats.lastAppAccess;
                                
                                const webVersion = user.webVersion || userStats.webVersion;
                                const lastWebAccess = user.lastWebAccess || userStats.lastWebAccess;

                                const renderVersionInfo = (version, timestamp) => {
                                    if (!version && !timestamp) return <span className="text-gray-400 text-[10px] italic">No record</span>;
                                    
                                    let dateStr = 'Unknown date';
                                    if (timestamp?.seconds) {
                                        dateStr = new Date(timestamp.seconds * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    } else if (timestamp && typeof timestamp === 'string') {
                                        dateStr = new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    } else if (timestamp instanceof Date) {
                                        dateStr = timestamp.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    }

                                    return (
                                        <div className="flex flex-col gap-1 items-start min-w-[90px]">
                                            <div className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 shadow-sm">
                                                {version ? `v${version}` : 'Unknown v'}
                                            </div>
                                            <div className="text-[9px] text-gray-500 flex items-center font-medium whitespace-nowrap">
                                                <Clock className="w-2.5 h-2.5 mr-1" /> {dateStr}
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <tr key={user.id} className="hover:bg-sky-50/50 transition-colors group">
                                        <td className="py-3">
                                            <div 
                                                className="font-bold text-sky-700 cursor-pointer group-hover:text-sky-600 transition-colors"
                                                onClick={() => setViewingUser(user)}
                                                title="View Profile Details"
                                            >
                                                {user.displayName}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">{user.email}</div>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                {userRoles.map(r => (
                                                    <span key={r} className={`border text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm whitespace-nowrap ${getRoleBadgeStyle(r)}`}>
                                                        {ROLES[r] || r}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex flex-col gap-2 items-start max-w-[130px]">
                                                <Button 
                                                    size="sm" 
                                                    variant="secondary" 
                                                    onClick={() => { 
                                                        setEditingRolesUser(user); 
                                                        setTempSelectedRoles(userRoles); 
                                                        setTempSelectedState(user.assignedState || '');
                                                        setTempSelectedLocality(user.assignedLocality || '');
                                                    }}
                                                    className="text-xs py-1 px-3 bg-white border-gray-300 shadow-sm hover:bg-gray-50 hover:text-sky-600 w-full justify-start"
                                                >
                                                    <Edit3 className="w-3 h-3 mr-2" /> Edit Roles
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="secondary" 
                                                    onClick={() => { 
                                                        setEditingUserPermissions(user); 
                                                        setTempUserPermissions(user.permissions || mergeRolePermissions(userRoles, rolesAndPermissions)); 
                                                    }}
                                                    className="text-xs py-1 px-3 bg-white border-gray-300 shadow-sm hover:bg-gray-50 hover:text-purple-600 w-full justify-start"
                                                >
                                                    <Shield className="w-3 h-3 mr-2" /> Custom Perms
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex flex-col gap-2 max-w-[180px]">
                                                {isStateAssignable ? (
                                                    <Select value={user.assignedState || ''} onChange={(e) => handleUserStateChange(user.id, e.target.value)} className="text-xs py-1">
                                                        <option value="">-- State --</option>
                                                        {STATES.map(state => (<option key={state} value={state}>{state}</option>))}
                                                    </Select>
                                                ) : (<span className="text-xs text-gray-400 font-medium">{user.assignedState || 'Global (No State)'}</span>)}
                                                
                                                {isLocalityAssignable && (
                                                    <Select value={user.assignedLocality || ''} onChange={(e) => handleLocalityChange(user.id, user.assignedState, e.target.value)} disabled={!user.assignedState} className="text-xs py-1 disabled:opacity-50 bg-gray-50">
                                                        <option value="">-- Locality --</option>
                                                        {currentLocalities.map(loc => (<option key={loc.en} value={loc.en}>{loc.ar}</option>))}
                                                    </Select>
                                                )}
                                                {!isLocalityAssignable && isStateAssignable && <span className="text-[10px] text-gray-400">All Localities</span>}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            {renderVersionInfo(appVersion, lastAppAccess)}
                                        </td>
                                        <td className="py-3">
                                            {renderVersionInfo(webVersion, lastWebAccess)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <div className="text-gray-500 font-medium">No users found matching your filters.</div>
                        <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setSearchQuery(''); setFilterRole(''); setFilterState(''); }}>Clear Filters</Button>
                    </div>
                )}
            </Card>
        </div>
    );

    const renderRolePermissionsTab = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-sky-50 border border-sky-100 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-sky-900 flex items-center">
                        <Shield className="w-5 h-5 mr-2 text-sky-500" /> Global Role Definitions
                    </h3>
                    <p className="text-sm text-sky-700 mt-1 max-w-2xl">
                        Adjusting permissions here defines the default blueprint for each role. Changes are <strong>automatically saved and incrementally synced</strong> to affected users when you close the configuration menu.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {Object.keys(ROLES).map(role => (
                    <div key={role} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col p-5">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sky-400 to-blue-600"></div>
                        <div className="flex-grow pt-1">
                            <h4 className="text-lg font-bold text-gray-800 mb-2">{ROLES[role]}</h4>
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${getRoleBadgeStyle(role)} border shadow-sm`}>
                                Blueprint Definition
                            </span>
                        </div>
                        <Button 
                            onClick={() => setEditingPermissionRole(role)}
                            variant="secondary"
                            size="sm"
                            className="mt-6 w-full justify-center bg-gray-50 border-gray-200 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 shadow-sm"
                        >
                            <Settings className="w-4 h-4 mr-2" /> Configure Permissions
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderUsageTab = () => {
        const formatTimestamp = (timestamp) => {
            if (!timestamp) return 'N/A';
            return new Date(timestamp.seconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        };

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-full shrink-0"><Activity className="w-6 h-6 text-indigo-500" /></div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">System Analytics</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Aggregate reading, writing, and active time tracking across all users.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl shadow-sm flex items-center relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity"><Database className="w-32 h-32 text-emerald-600" /></div>
                        <div className="p-3 bg-emerald-100 rounded-xl mr-4 z-10"><Database className="text-emerald-600 w-6 h-6" /></div>
                        <div className="z-10">
                            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Total System Reads</div>
                            <div className="text-3xl font-black text-emerald-900">{aggregates.totalReads.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl shadow-sm flex items-center relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity"><Edit3 className="w-32 h-32 text-amber-600" /></div>
                        <div className="p-3 bg-amber-100 rounded-xl mr-4 z-10"><Edit3 className="text-amber-600 w-6 h-6" /></div>
                        <div className="z-10">
                            <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Total System Writes</div>
                            <div className="text-3xl font-black text-amber-900">{aggregates.totalWrites.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl shadow-sm flex items-center relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity"><Clock className="w-32 h-32 text-blue-600" /></div>
                        <div className="p-3 bg-blue-100 rounded-xl mr-4 z-10"><Clock className="text-blue-600 w-6 h-6" /></div>
                        <div className="z-10">
                            <div className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Mean Active Time</div>
                            <div className="text-3xl font-black text-blue-900">{formatDuration(aggregates.meanDurationMs)}</div>
                            <div className="text-[10px] font-semibold text-blue-500 mt-1 uppercase">Sum: {formatDuration(aggregates.totalDurationMs)}</div>
                        </div>
                    </div>
                </div>

                <Card className="shadow-sm border border-gray-100 overflow-hidden">
                    <h3 className="text-md font-bold text-gray-800 mb-4 px-1">Detailed User Telemetry</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <Table headers={['User Identity', 'Total Reads', 'Total Writes', 'Active Duration', 'Last Recorded']}>
                            {usageStats.map((stat) => (
                                <tr key={stat.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="font-medium text-gray-800">{stat.email || 'N/A'}</td>
                                    <td className="font-mono text-emerald-700 font-bold bg-emerald-50/50">{stat.totalReads ? stat.totalReads.toLocaleString() : 0}</td>
                                    <td className="font-mono text-amber-700 font-bold bg-amber-50/50">{stat.totalWrites ? stat.totalWrites.toLocaleString() : 0}</td>
                                    <td className="text-gray-600">{formatDuration(stat.totalActiveDurationMs)}</td>
                                    <td className="text-sm text-gray-500">{formatTimestamp(stat.lastUpdated)}</td>
                                </tr>
                            ))}
                        </Table>
                        {usageStats.length === 0 && (
                            <div className="text-center py-12 text-gray-400 bg-gray-50">
                                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                No telemetry data accumulated yet.
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-12 max-w-7xl mx-auto">
            <PageHeader
                title="System Administration"
                subtitle="Securely manage user profiles, roles, broad permissions, and monitor telemetry."
            />
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}

            <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} currentUserRoles={currentUserRoles} />

            <div className="mt-4">
                {activeTab === 'roles' && renderUserRolesTab()}
                {activeTab === 'permissions' && renderRolePermissionsTab()}
                {activeTab === 'usage' && currentUserRoles.includes('super_user') && renderUsageTab()}
                {activeTab === 'updates' && currentUserRoles.includes('super_user') && renderUpdatesTab()}
            </div>

            {/* EDIT ROLES MODAL */}
            <Modal isOpen={!!editingRolesUser} onClose={() => setEditingRolesUser(null)} title="Modify User Access Roles">
                <CardBody className="p-0 bg-gray-50/50">
                    <div className="p-6 bg-white border-b border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Adjusting roles for:</p>
                        <div className="font-bold text-gray-800 flex items-center text-xl"><Users className="w-5 h-5 mr-2 text-sky-500"/> {editingRolesUser?.displayName || editingRolesUser?.email}</div>
                    </div>
                    <div className="p-4">
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="divide-y divide-gray-100">
                                {Object.entries(ROLES).map(([key, label]) => {
                                    const isChecked = tempSelectedRoles.includes(key);
                                    const isDisabled = currentUser?.uid === editingRolesUser?.id && key === 'super_user';
                                    
                                    return (
                                        <label key={key} className={`flex items-center space-x-3 p-4 transition-colors ${isChecked ? 'bg-sky-50/50' : 'hover:bg-gray-50'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                            <input 
                                                type="checkbox" 
                                                checked={isChecked}
                                                disabled={isDisabled}
                                                onChange={(e) => {
                                                    let newRoles = [...tempSelectedRoles];
                                                    if (e.target.checked) {
                                                        if (!newRoles.includes(key)) newRoles.push(key);
                                                    } else {
                                                        newRoles = newRoles.filter(r => r !== key);
                                                    }
                                                    if (newRoles.length === 0) newRoles = ['user'];
                                                    setTempSelectedRoles(newRoles);
                                                }}
                                                className="form-checkbox h-5 w-5 text-sky-600 rounded border-gray-300 transition duration-150 ease-in-out focus:ring-sky-500"
                                            />
                                            <span className={`font-bold ${isChecked ? 'text-sky-900' : 'text-gray-700'}`}>{label}</span>
                                            {isChecked && <div className={`ml-auto text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${getRoleBadgeStyle(key)}`}>Active</div>}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* DYNAMIC LOCATION ASSIGNMENT UI */}
                        {(() => {
                            const LOCATION_ASSIGNMENT_ROLES = ['states_manager', 'state_coordinator', 'locality_manager'];
                            const needsLocation = tempSelectedRoles.some(r => LOCATION_ASSIGNMENT_ROLES.includes(r));
                            const needsLocality = tempSelectedRoles.includes('locality_manager');
                            const availableLocalities = tempSelectedState ? (STATE_LOCALITIES[tempSelectedState]?.localities || []) : [];

                            if (!needsLocation) return null;

                            return (
                                <div className="mt-4 p-4 bg-sky-50 border border-sky-200 rounded-xl shadow-inner space-y-3 animate-in fade-in zoom-in duration-200">
                                    <h4 className="text-sm font-bold text-sky-900 flex items-center"><Filter className="w-4 h-4 mr-2"/> Required Geographic Assignment</h4>
                                    <p className="text-xs text-sky-700 font-medium">The selected roles require you to assign a specific geographic boundary.</p>
                                    
                                    <div className="pt-2 space-y-3">
                                        <FormGroup>
                                            <Select value={tempSelectedState} onChange={(e) => { setTempSelectedState(e.target.value); setTempSelectedLocality(''); }} className="w-full bg-white font-bold text-sm shadow-sm">
                                                <option value="">-- Select Required State --</option>
                                                {STATES.map(state => (<option key={state} value={state}>{state}</option>))}
                                            </Select>
                                        </FormGroup>

                                        {needsLocality && (
                                            <FormGroup>
                                                <Select value={tempSelectedLocality} onChange={(e) => setTempSelectedLocality(e.target.value)} disabled={!tempSelectedState} className="w-full bg-white font-bold text-sm shadow-sm disabled:opacity-50">
                                                    <option value="">-- Select Required Locality --</option>
                                                    {availableLocalities.map(loc => (<option key={loc.en} value={loc.en}>{loc.ar}</option>))}
                                                </Select>
                                            </FormGroup>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        <p className="text-xs text-gray-500 mt-4 flex items-start px-1"><Shield className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0"/> Assigning multiple roles will automatically grant the highest level of permissions derived from all selected blueprints.</p>
                    </div>
                </CardBody>
                <CardFooter className="bg-white border-t border-gray-100">
                    <div className="flex justify-end gap-3 w-full pt-1">
                        <Button variant="secondary" onClick={() => setEditingRolesUser(null)} className="px-5">Cancel</Button>
                        <Button variant="primary" onClick={() => {
                            const LOCATION_ASSIGNMENT_ROLES = ['states_manager', 'state_coordinator', 'locality_manager'];
                            const needsLocation = tempSelectedRoles.some(r => LOCATION_ASSIGNMENT_ROLES.includes(r));
                            const needsLocality = tempSelectedRoles.includes('locality_manager');
                            
                            if (needsLocation && !tempSelectedState) {
                                setToast({ show: true, message: "You must select a State for this role configuration.", type: "error" });
                                return;
                            }
                            if (needsLocality && !tempSelectedLocality) {
                                setToast({ show: true, message: "You must select a Locality for this role configuration.", type: "error" });
                                return;
                            }

                            handleUserRolesChange(editingRolesUser.id, tempSelectedRoles, tempSelectedState, tempSelectedLocality);
                            setEditingRolesUser(null);
                        }} className="px-6 shadow-md">
                            Confirm & Apply Roles
                        </Button>
                    </div>
                </CardFooter>
            </Modal>

            {/* CONFIGURE ROLE PERMISSIONS MODAL */}
            <Modal isOpen={!!editingPermissionRole} onClose={() => {}} title="Configure Blueprint Permissions">
                <CardBody className="p-0 bg-gray-50/50">
                    <div className="p-6 border-b border-gray-200 bg-white">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Editing Permissions Blueprint for:</p>
                        <div className="font-black text-sky-900 flex items-center text-3xl">
                            <Shield className="w-8 h-8 mr-3 text-sky-500"/> {editingPermissionRole && ROLES[editingPermissionRole]}
                        </div>
                    </div>
                    {editingPermissionRole && (
                        <div className="p-4 md:p-6">
                            <PermissionsEditor 
                                role={editingPermissionRole} 
                                currentPermissions={rolesAndPermissions[editingPermissionRole]} 
                                allPermissions={ALL_PERMISSIONS} 
                                onPermissionChange={handlePermissionChange} 
                                disabled={!currentUserRoles.includes('super_user') || editingPermissionRole === 'super_user'} 
                            />
                        </div>
                    )}
                </CardBody>
                <CardFooter className="bg-white border-t border-gray-100">
                    <div className="flex justify-end gap-3 w-full pt-1">
                        <Button variant="primary" onClick={handleCloseAndSyncBlueprint} disabled={loading} className="px-8 shadow-sm">
                            {loading ? <><Spinner size="sm" className="mr-2" /> Saving...</> : "Done & Sync"}
                        </Button>
                    </div>
                </CardFooter>
            </Modal>

            {/* CONFIGURE INDIVIDUAL USER PERMISSIONS MODAL */}
            <Modal isOpen={!!editingUserPermissions} onClose={() => setEditingUserPermissions(null)} title="Configure Custom User Permissions">
                <CardBody className="p-0 bg-gray-50/50">
                    <div className="p-6 border-b border-gray-200 bg-white">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Editing Custom Permissions For:</p>
                        <div className="font-black text-purple-900 flex items-center text-2xl">
                            <Shield className="w-6 h-6 mr-3 text-purple-500"/> {editingUserPermissions?.displayName || editingUserPermissions?.email}
                        </div>
                        <p className="text-xs text-amber-600 mt-2 font-medium flex items-center">
                            ⚠️ Changing this user's role later will reset these custom permissions back to the role defaults.
                        </p>
                    </div>
                    {editingUserPermissions && (
                        <div className="p-4 md:p-6 max-h-[60vh] overflow-y-auto">
                            <PermissionsEditor 
                                role={editingUserPermissions.id} 
                                currentPermissions={tempUserPermissions} 
                                allPermissions={ALL_PERMISSIONS} 
                                onPermissionChange={(role, permission, value) => handleIndividualPermissionChange(editingUserPermissions.id, permission, value)} 
                                disabled={!currentUserRoles.includes('super_user')} 
                            />
                        </div>
                    )}
                </CardBody>
                <CardFooter className="bg-white border-t border-gray-100">
                    <div className="flex justify-end gap-3 w-full pt-1">
                        <Button variant="secondary" onClick={() => setEditingUserPermissions(null)} className="px-5">Cancel</Button>
                        <Button variant="primary" onClick={handleSaveIndividualPermissions} className="px-8 shadow-sm">
                            Save Custom Permissions
                        </Button>
                    </div>
                </CardFooter>
            </Modal>

            {/* USER PROFILE MODAL */}
            <Modal isOpen={!!viewingUser} onClose={() => setViewingUser(null)} title="Full User Profile">
                {viewingUser && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-start space-x-5 border-b border-gray-100 pb-6">
                            <div className="h-16 w-16 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-md shrink-0">
                                {(viewingUser.displayName || viewingUser.email || 'U')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 pt-1">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{viewingUser.displayName || 'No Name Set'}</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {(viewingUser.roles || [viewingUser.role]).map(r => (
                                        <span key={r} className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full shadow-sm border ${getRoleBadgeStyle(r)}`}>
                                            {ROLES[r] || r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                                <span className="block text-xs text-gray-500 font-bold uppercase tracking-wide mb-1">Email Identity</span>
                                <span className="text-gray-800 font-medium">{viewingUser.email}</span>
                            </div>

                            <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                                <span className="block text-xs text-gray-500 font-bold uppercase tracking-wide mb-1">Last Active Login</span>
                                <span className="text-gray-800 font-medium flex items-center">
                                    <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-400"/>
                                    {viewingUser.lastLogin ? new Date(viewingUser.lastLogin.seconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never Logged In'}
                                </span>
                            </div>

                            <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl md:col-span-2">
                                <span className="block text-xs text-sky-600 font-bold uppercase tracking-wide mb-2">Aggregate System Access</span>
                                <span className="text-sky-900 font-bold capitalize text-base">
                                    {(viewingUser.roles || [viewingUser.role]).map(r => ROLES[r] || r).join(' • ') || 'Standard User'}
                                </span>
                            </div>
                            
                            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                                <span className="block text-xs text-gray-500 font-bold uppercase tracking-wide mb-1">Geographic State</span>
                                <span className="text-gray-900 font-bold">
                                    {viewingUser.assignedState || 'Global (No Restrictions)'}
                                </span>
                            </div>
                            
                            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                                <span className="block text-xs text-gray-500 font-bold uppercase tracking-wide mb-1">Geographic Locality</span>
                                <span className="text-gray-900 font-bold">
                                    {viewingUser.assignedLocality || 'All Localities in Area'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-100 gap-4">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                    onClick={() => handleSendPasswordReset(viewingUser.email)} 
                                    variant="secondary" 
                                    className="text-xs sm:text-sm px-3 bg-white border-sky-200 text-sky-700 hover:bg-sky-50"
                                >
                                    Reset Password
                                </Button>
                                
                                {currentUserRoles.includes('super_user') && (
                                    <Button 
                                        onClick={() => handleDeleteAccount(viewingUser.id, viewingUser.email)} 
                                        variant="danger" 
                                        className="text-xs sm:text-sm px-3 bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800"
                                    >
                                        Delete Profile
                                    </Button>
                                )}
                            </div>

                            <Button onClick={() => setViewingUser(null)} variant="secondary" className="px-6 w-full sm:w-auto">
                                Close Profile
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default AdminDashboard;