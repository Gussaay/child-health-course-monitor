// AdminDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, PageHeader, Button, Table, Spinner, Select, Checkbox, Toast, Input, FormGroup } from './CommonComponents';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { STATE_LOCALITIES } from './constants'; // Import the states

// -----------------------------------------------------------------------------
// EXPORTED PERMISSION MANAGEMENT CONSTANTS FOR App.jsx
// (Unchanged)
// -----------------------------------------------------------------------------
export const ALL_PERMISSIONS = {
    // --- A. Course Management ---
    canViewCourse: false, // Now selectable
    canManageCourse: false, // NEW: Replaces 5 old permissions

    // --- B. Child Health Service Facility Management ---
    canViewFacilities: false, // Base value is always false
    canManageFacilities: false, // Basic add/edit/delete within scope

    // --- C. Human Resource (HR) Management ---
    canViewHumanResource: false, // NEW: Replaces 3 view permissions
    canManageHumanResource: false, // NEW: Replaces 3 manage permissions

    // --- NEW: D. Skills Mentorship ---
    canViewSkillsMentorship: false,
    canManageSkillsMentorship: false,

    // --- E. System / Advanced / Scope ---
    canApproveSubmissions: false,   // DERIVED: Now tied to canUseFederalManagerAdvancedFeatures
    canUseSuperUserAdvancedFeatures: false,    // REVERTED: Back in System category
    canUseFederalManagerAdvancedFeatures: false, // REVERTED: Back in System category
    
    // Scope fields for non-Super roles (Scope, Location, Time)
    manageScope: 'none',            // 'federal', 'state', 'locality', 'course', 'none'
    manageLocation: '',             // Assigned State/Locality key (e.g., 'Khartoum')
    manageTimePeriod: 'course_period_only', // 'anytime', 'course_period_only'

    // Legacy/Derived flags (Base value is always false for clean derivation)
    canViewDashboard: false,
    canViewAdmin: false,
};
export const applyDerivedPermissions = (basePermissions) => {
    if (basePermissions.manageScope !== 'none' || basePermissions.canViewCourse) {
        basePermissions.canViewDashboard = true;
    }
    if (basePermissions.canManageFacilities) {
        basePermissions.canViewFacilities = true;
    }
    if (basePermissions.canManageHumanResource) {
        basePermissions.canViewHumanResource = true;
    }
    // --- START MODIFICATION ---
    if (basePermissions.canManageSkillsMentorship) {
        basePermissions.canViewSkillsMentorship = true;
    }
    // --- END MODIFICATION ---
    if (basePermissions.canUseFederalManagerAdvancedFeatures) {
        basePermissions.canApproveSubmissions = true;
    }
    return basePermissions;
};
const BASE_PERMS = { ...ALL_PERMISSIONS };
const COURSE_MGMT_NONE = { canViewCourse: false, canManageCourse: false };
const COURSE_MGMT_VIEW_ONLY = { canViewCourse: true, canManageCourse: false };
const COURSE_MGMT_STANDARD = { canViewCourse: true, canManageCourse: true };
const FACILITY_MGMT_NONE = { canViewFacilities: false, canManageFacilities: false };
const FACILITY_MGMT_VIEW_ONLY = { ...FACILITY_MGMT_NONE, canViewFacilities: true, canManageFacilities: false };
const FACILITY_MGMT_STANDARD = { ...FACILITY_MGMT_NONE, canViewFacilities: true, canManageFacilities: true };
const HR_MGMT_NONE = { canViewHumanResource: false, canManageHumanResource: false };
const HR_MGMT_VIEW_ONLY = { ...HR_MGMT_NONE, canViewHumanResource: true };
const HR_MGMT_STANDARD = { canViewHumanResource: true, canManageHumanResource: true };
// --- START MODIFICATION ---
const MENTORSHIP_MGMT_NONE = { canViewSkillsMentorship: false, canManageSkillsMentorship: false };
const MENTORSHIP_MGMT_VIEW_ONLY = { ...MENTORSHIP_MGMT_NONE, canViewSkillsMentorship: true };
const MENTORSHIP_MGMT_STANDARD = { ...MENTORSHIP_MGMT_NONE, canViewSkillsMentorship: true, canManageSkillsMentorship: true };
// --- END MODIFICATION ---
const ADVANCED_PERMS_NONE = { canApproveSubmissions: false, canUseSuperUserAdvancedFeatures: false, canUseFederalManagerAdvancedFeatures: false, canViewAdmin: false };
const SUPER_USER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, canViewAdmin: true, canUseSuperUserAdvancedFeatures: true, canUseFederalManagerAdvancedFeatures: true, manageScope: 'federal', manageTimePeriod: 'anytime' };
const FEDERAL_MANAGER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, canUseFederalManagerAdvancedFeatures: true, manageScope: 'federal', manageTimePeriod: 'anytime' };
const STATES_MANAGER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, manageScope: 'state', manageLocation: 'user_state', manageTimePeriod: 'course_period_only' };
const LOCALITY_MANAGER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, manageScope: 'locality', manageLocation: 'user_locality', manageTimePeriod: 'course_period_only' };
const FEDERAL_COORDINATOR_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_VIEW_ONLY, ...HR_MGMT_VIEW_ONLY, ...MENTORSHIP_MGMT_VIEW_ONLY, ...ADVANCED_PERMS_NONE, manageScope: 'course', manageLocation: 'federal_level', manageTimePeriod: 'course_period_plus_3_days' };
const FACILITATOR_PERMS = { ...FEDERAL_COORDINATOR_PERMS };
const STATE_COORDINATOR_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_VIEW_ONLY, ...HR_MGMT_VIEW_ONLY, ...MENTORSHIP_MGMT_VIEW_ONLY, ...ADVANCED_PERMS_NONE, manageScope: 'course', manageLocation: 'user_state', manageTimePeriod: 'course_period_only' };
const COURSE_COORDINATOR_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_VIEW_ONLY, ...HR_MGMT_NONE, ...MENTORSHIP_MGMT_VIEW_ONLY, ...ADVANCED_PERMS_NONE, manageScope: 'course', manageTimePeriod: 'course_period_only' };
const USER_PERMS = { ...BASE_PERMS, canViewCourse: true, canViewFacilities: true, canViewSkillsMentorship: true, canViewDashboard: true };
export const DEFAULT_ROLE_PERMISSIONS = {
    'super_user': applyDerivedPermissions(SUPER_USER_PERMS),
    'federal_manager': applyDerivedPermissions(FEDERAL_MANAGER_PERMS),
    'states_manager': applyDerivedPermissions(STATES_MANAGER_PERMS),
    'locality_manager': applyDerivedPermissions(LOCALITY_MANAGER_PERMS),
    'federal_coordinator': applyDerivedPermissions(FEDERAL_COORDINATOR_PERMS),
    'facilitator': applyDerivedPermissions(FACILITATOR_PERMS),
    'state_coordinator': applyDerivedPermissions(STATE_COORDINATOR_PERMS),
    'course_coordinator': applyDerivedPermissions(COURSE_COORDINATOR_PERMS),
    'user': applyDerivedPermissions(USER_PERMS),
};
export const ALL_PERMISSION_KEYS = Object.keys(ALL_PERMISSIONS);
// (End Unchanged Section)
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// LOCAL CONSTANTS FOR AdminDashboard COMPONENT
// -----------------------------------------------------------------------------

// --- Define Professional Roles and their display labels ---
const ROLES = {
    'super_user': 'Super User',
    'federal_manager': 'Federal Manager',
    'states_manager': 'States Manager',
    'locality_manager': 'Locality Manager',
    'federal_coordinator': 'Federal Course Coordinator',
    'facilitator': 'Facilitator',
    'state_coordinator': 'State Course Coordinator',
    'course_coordinator': 'Course Coordinator',
    'user': 'Standard User',
};

// (Unchanged PERMISSION_DESCRIPTIONS)
const PERMISSION_DESCRIPTIONS = {
    canViewCourse: "Allow user to view course list, details, and reports.",
    canManageCourse: "Allow user to add/edit/delete active courses, participants, and monitoring observations.",
    canViewFacilities: "View the Child Health Services facilities list.",
    canManageFacilities: "Add, Edit, and Delete facility records within assigned scope.",
    canViewHumanResource: "Allow viewing lists for Facilitators, Program Teams, and Partners.",
    canManageHumanResource: "Allow add/edit/delete for Facilitators, Program Teams, and Partners within the user's assigned scope (federal, state, or locality).",
    // --- START MODIFICATION ---
    canViewSkillsMentorship: "Allow user to view the Skills Mentorship module, dashboard, and history.",
    canManageSkillsMentorship: "Allow user to share public submission links for mentorship.",
    // --- END MODIFICATION ---
    canApproveSubmissions: "Derived: Approve/Reject submissions for Facilitators and Health Facilities. (Granted by Federal/Super advanced features).",
    canUseSuperUserAdvancedFeatures: "ADVANCED (Super User): Allows bulk participant/facility operations (import, clean, migrate, duplicates, location check).", 
    canUseFederalManagerAdvancedFeatures: "ADVANCED (Federal/Super): Allows managing inactive items (courses, participants, monitoring), Final Reports, *enables* ALL Human Resources Management, and *grants* submission approval rights.", 
    manageScope: "Defines the scope (Federal, State, Locality, or Course level) for management actions.",
    manageLocation: "The specific location filter for management actions ('user_state' uses the user's assigned state).",
    manageTimePeriod: "Limits course/monitoring management actions to the course period or allows anytime access.",
    canViewDashboard: "Derived: Allow navigating to the dashboard.",
    canViewAdmin: "Access the Admin Dashboard.",
};

const STATES = Object.keys(STATE_LOCALITIES);

// --- MODIFICATION: Helper component for Tab Navigation ---
const AdminTabs = ({ activeTab, setActiveTab, currentUserRole }) => {
    // Base tabs
    const tabs = [
        { key: 'roles', label: 'Manage User Roles' },
        { key: 'permissions', label: 'Manage Role Permissions' },
    ];

    // Conditionally add the new tab for super users
    if (currentUserRole === 'super_user') {
        tabs.push({ key: 'usage', label: 'Resource Usage' });
    }

    return (
        <div className="flex border-b border-gray-200 mb-6">
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 font-medium text-sm transition-colors duration-150 ${
                        activeTab === tab.key
                            ? 'border-b-2 border-sky-500 text-sky-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};
// --- END MODIFICATION ---

// (Unchanged PermissionsDropdown)
const PermissionsDropdown = ({ role, currentPermissions, allPermissions, onPermissionChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const PERMISSION_CATEGORIES = useMemo(() => [
        { title: 'A. Course Management', keys: ['canViewCourse', 'canManageCourse'] },
        { title: 'B. Child Health Service Facility Management', keys: ['canViewFacilities', 'canManageFacilities'] },
        { title: 'C. Human Resource (HR) Management', keys: ['canViewHumanResource', 'canManageHumanResource'] },
        // --- START MODIFICATION ---
        { title: 'D. Skills Mentorship', keys: ['canViewSkillsMentorship', 'canManageSkillsMentorship'] },
        { title: 'E. System / Advanced / Scope', keys: ['canUseSuperUserAdvancedFeatures', 'canUseFederalManagerAdvancedFeatures', 'manageLocation', 'manageTimePeriod', 'canViewAdmin', 'canViewDashboard'] }
        // --- END MODIFICATION ---
    ], []);
    const booleanPermissionKeys = useMemo(() => {
        return PERMISSION_CATEGORIES.flatMap(category => 
            category.keys.filter(key => 
                allPermissions.hasOwnProperty(key) &&
                typeof allPermissions[key] === 'boolean' &&
                !['canViewDashboard', 'canViewAdmin', 'canApproveSubmissions'].includes(key)
            )
        );
    }, [allPermissions, PERMISSION_CATEGORIES]);
    const checkedCount = booleanPermissionKeys.filter(key => currentPermissions[key] === true).length;
    const totalBooleanCount = booleanPermissionKeys.length;
    const buttonLabel = checkedCount === 0 ? 'Select Permissions' : checkedCount === totalBooleanCount ? 'All Boolean Permissions Selected' : `${checkedCount} of ${totalBooleanCount} Boolean Flags Selected`;
    const handleToggleSelectAll = (e) => {
        const value = e.target.checked;
        booleanPermissionKeys.forEach(permission => {
            onPermissionChange(role, permission, value);
        });
    };
    const isSelectAllChecked = booleanPermissionKeys.every(key => currentPermissions[key] === true);
    const isIndeterminate = checkedCount > 0 && checkedCount < totalBooleanCount;
    const handlePermissionChangeInternal = (key, value) => {
        if (['manageScope', 'manageTimePeriod', 'manageLocation'].includes(key)) {
            onPermissionChange(role, key, value);
        } else {
            onPermissionChange(role, key, value);
        }
    };
    const isStandardUser = role === 'user';
    return (
        <div className="relative w-full">
            <Button type="button" onClick={() => setIsOpen(!isOpen)} disabled={disabled} variant="secondary" className="w-full justify-between flex items-center bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {buttonLabel}
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </Button>
            {isOpen && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
                    {!isStandardUser && (
                        <div className="px-3 py-2 border-b">
                            <label className="flex items-center space-x-2 font-semibold text-sm">
                                <input type="checkbox" checked={isSelectAllChecked} onChange={handleToggleSelectAll} ref={el => el && (el.indeterminate = isIndeterminate)} disabled={disabled} />
                                <span>Select All Boolean Flags</span>
                            </label>
                        </div>
                    )}
                    {PERMISSION_CATEGORIES.map(category => (
                        <div key={category.title}>
                            <h5 className="px-3 py-2 bg-gray-100 text-gray-800 font-semibold text-sm sticky top-0 z-10">{category.title}</h5>
                            {category.keys.map(permission => {
                                if (!currentPermissions.hasOwnProperty(permission)) return null;
                                const value = currentPermissions[permission];
                                const isBoolean = typeof allPermissions[permission] === 'boolean';
                                if (['canViewDashboard', 'canViewAdmin', 'canApproveSubmissions'].includes(permission)) {
                                    return (
                                        <div key={permission} className={`px-3 py-2 hover:bg-gray-100 transition-colors ${value ? 'text-green-700' : 'text-red-700'}`}>
                                            <div className="font-medium text-sm">{permission.replace(/([A-Z])/g, ' $1').trim()} (Effective: **{value ? 'Yes' : 'No'}**)</div>
                                            <div className="text-xs text-gray-500">{PERMISSION_DESCRIPTIONS[permission] || 'No description.'}</div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={permission} className="px-3 py-2 hover:bg-sky-50 transition-colors">
                                        <label className="flex flex-col space-y-1 text-sm cursor-pointer">
                                            <div className="font-medium">{permission.replace(/([A-Z])/g, ' $1').trim()}</div>
                                            <div className="text-xs text-gray-500">{PERMISSION_DESCRIPTIONS[permission] || 'No description.'}</div>
                                            {isBoolean ? (
                                                <Checkbox checked={!!value} onChange={(e) => handlePermissionChangeInternal(permission, e.target.checked)} disabled={disabled || isStandardUser} label={value ? 'Allowed' : 'Denied'} />
                                            ) : (
                                                <Select value={value || ''} onChange={(e) => handlePermissionChangeInternal(permission, e.target.value)} disabled={disabled || isStandardUser} className="w-full text-xs mt-1">
                                                    {permission === 'manageScope' && (<><option value="none">None (Standard User)</option><option value="federal">Federal Level (All States)</option><option value="state">State Manager Level</option><option value="locality">Locality Manager Level</option><option value="course">Course Coordinator (Assigned Courses Only)</option></>)}
                                                    {permission === 'manageTimePeriod' && (<><option value="anytime">Anytime</option><option value="course_period_only">Course Period Only</option><option value="course_period_plus_3_days">Course Period + 3 Days</option></>)}
                                                    {permission === 'manageLocation' && (<><option value="">N/A (Federal Level / Course level)</option><option value="user_state">User's Assigned State(s)</option><option value="user_locality">User's Assigned Locality/Localities</option></>)}
                                                </Select>
                                            )}
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
// (End Unchanged PermissionsDropdown)

// --- NEW: Helper function to format duration ---
const formatDuration = (milliseconds) => {
    if (!milliseconds || milliseconds < 60000) {
        return '0 minutes';
    }
    
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let parts = [];
    if (hours > 0) {
        parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    }
    if (minutes > 0) {
        parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    }
    return parts.join(', ');
};


// --- MODIFICATION: Admin Dashboard Component ---
export function AdminDashboard() {
    const [users, setUsers] = useState([]);
    const [rolesAndPermissions, setRolesAndPermissions] = useState({});
    
    // --- STATE FOR USAGE TAB ---
    const [usageStats, setUsageStats] = useState([]);

    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [activeTab, setActiveTab] = useState('roles');

    const [filterRole, setFilterRole] = useState('');
    const [filterState, setFilterState] = useState('');
    const [filterLocality, setFilterLocality] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setLoading(true);
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                getDoc(userRef).then(docSnap => {
                    let role = null;
                    if (docSnap.exists()) {
                        role = docSnap.data().role;
                    } else {
                        role = 'user'; // Default for a user not in DB yet
                    }
                    setCurrentUserRole(role);
                    // Trigger data load *after* role is confirmed
                    loadData(role);
                }).catch(error => {
                    console.error("Error fetching current user's role:", error);
                    setCurrentUserRole(null);
                    setLoading(false);
                });
            } else {
                setCurrentUserRole(null);
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
            // Fetch Users
            const usersQuery = query(collection(db, "users"));
            const usersSnapshot = await getDocs(usersQuery);
            const userList = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(), // Spread data first
                // --- START MODIFICATION ---
                // Ensure displayName is prioritized, falling back to name
                displayName: doc.data().displayName || doc.data().name || '', 
                // --- END MODIFICATION ---
                assignedLocality: doc.data().assignedLocality || '',
            }));

            // Fetch Role Permissions
            const rolesDocRef = doc(db, "meta", "roles");
            const rolesDocSnap = await getDoc(rolesDocRef);
            const permissionsData = rolesDocSnap.exists() ? rolesDocSnap.data() : {};
            const updatedPermissions = Object.keys(ROLES).reduce((acc, role) => {
                const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS['user'];
                const savedPerms = permissionsData[role]; 
                let mergedPerms = { ...ALL_PERMISSIONS, ...defaultPerms, ...(savedPerms || {}) };
                acc[role] = applyDerivedPermissions(mergedPerms);
                return acc;
            }, {});

            setUsers(userList);
            setRolesAndPermissions(updatedPermissions);

            // Conditionally fetch usage stats
            if (role === 'super_user') {
                const usageQuery = query(collection(db, "userUsageStats"));
                const usageSnapshot = await getDocs(usageQuery);
                const usageList = usageSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setUsageStats(usageList);
            }

        } catch (error) {
            console.error("Error loading data:", error);
            setToast({ show: true, message: "Error loading data. Please try again.", type: "error" });
        }
        setLoading(false);
    };

    // (Unchanged user/permission handlers)
    const handleUserRoleChange = async (userId, newRole) => {
        const userToUpdate = users.find(u => u.id === userId);
        if (currentUser.email === userToUpdate.email && newRole !== userToUpdate.role) {
            setToast({ show: true, message: "You cannot change your own role.", type: "error" });
            return;
        }
        if (window.confirm(`Are you sure you want to change this user's role to ${ROLES[newRole]}? This will update their permissions.`)) {
            const userRef = doc(db, "users", userId);
            const newPermissions = rolesAndPermissions[newRole] || DEFAULT_ROLE_PERMISSIONS[newRole];
            const LOCATION_ASSIGNMENT_ROLES = ['states_manager', 'state_coordinator', 'locality_manager'];
            let updatePayload = {
                role: newRole,
                permissions: { ...ALL_PERMISSIONS, ...newPermissions } 
            };
            if (!LOCATION_ASSIGNMENT_ROLES.includes(newRole)) {
                updatePayload.assignedState = '';
                updatePayload.assignedLocality = '';
            } else if (userToUpdate.role && !LOCATION_ASSIGNMENT_ROLES.includes(userToUpdate.role)) {
                 updatePayload.assignedState = '';
                 updatePayload.assignedLocality = '';
            }
            try {
                await updateDoc(userRef, updatePayload);
                const updatedUsers = users.map(user =>
                    user.id === userId ? { ...user, ...updatePayload } : user
                );
                setUsers(updatedUsers);
                // --- START MODIFICATION ---
                // Use displayName in toast message
                const userName = userToUpdate.displayName || userToUpdate.email;
                setToast({ show: true, message: `Successfully updated ${userName}'s role.`, type: "success" });
                // --- END MODIFICATION ---
            } catch (error) {
                console.error("Error updating user role:", error);
                setToast({ show: true, message: "Failed to update user role. Please try again.", type: "error" });
            }
        }
    };
    const handleUserStateChange = async (userId, newState) => {
        const userToUpdate = users.find(u => u.id === userId);
        if (!['states_manager', 'state_coordinator', 'locality_manager'].includes(userToUpdate.role)) {
            setToast({ show: true, message: "State can only be assigned to a State Manager, State Coordinator, or Locality Manager.", type: "error" });
            return;
        }
        const userRef = doc(db, "users", userId);
        try {
            await updateDoc(userRef, { assignedState: newState, assignedLocality: '' }); // Clear locality when state changes
            setUsers(users.map(user => user.id === userId ? { ...user, assignedState: newState, assignedLocality: '' } : user));
            setToast({ show: true, message: "User's state updated successfully.", type: "success" });
        } catch (error) {
            console.error("Error updating user state:", error);
            setToast({ show: true, message: "Failed to update user state. Please try again.", type: "error" });
        }
    };
    const handleLocalityChange = async (userId, newState, newLocality) => {
        const userToUpdate = users.find(u => u.id === userId);
        if (userToUpdate.role !== 'locality_manager') {
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
            console.error("Error updating user locality:", error);
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
            // --- START MODIFICATION ---
            if (permission !== 'canViewSkillsMentorship') {
                baseRole.canViewSkillsMentorship = prev[role].canViewSkillsMentorship;
            }
            // --- END MODIFICATION ---
            if (baseRole.canManageFacilities) {
                 baseRole.canViewFacilities = true;
            }
            const updatedRole = applyDerivedPermissions(baseRole);
            return { ...prev, [role]: updatedRole };
        });
    };
    const handleSaveAndSyncAllPermissions = async () => {
        if (!window.confirm("Are you sure you want to save these global permissions AND synchronize them with ALL users in the database?")) {
            return;
        }
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
            const allUsersQuery = query(collection(db, "users"));
            const allUsersSnapshot = await getDocs(allUsersQuery);
            allUsersSnapshot.docs.forEach(userDoc => {
                const userRole = userDoc.data().role;
                const newPermissions = rolesAndPermissionsWithDerived[userRole] || DEFAULT_ROLE_PERMISSIONS['user'];
                const userRef = doc(db, "users", userDoc.id);
                batch.update(userRef, { permissions: { ...ALL_PERMISSIONS, ...newPermissions } });
            });
            await batch.commit();
            setRolesAndPermissions(rolesAndPermissionsWithDerived);
            await loadData(currentUserRole); // Reload all data
            setToast({ show: true, message: "Permissions saved and synchronized with all users successfully!", type: "success" });
        } catch (error) {
            console.error("Error saving and syncing permissions:", error);
            setToast({ show: true, message: "Failed to save and sync permissions. Please try again.", type: "error" });
        }
        setLoading(false);
    };
    // (End Unchanged handlers)


    // (Unchanged Filtering Logic)
    const allLocalitiesInFilterState = useMemo(() => {
        if (!filterState || filterState === 'All') return [];
        return (STATE_LOCALITIES[filterState]?.localities || []).map(l => l.en);
    }, [filterState]);
    const filteredUsers = useMemo(() => {
        const queryLower = searchQuery.toLowerCase();
        let filtered = users.filter(user => {
            const roleMatch = !filterRole || user.role === filterRole;
            const stateMatch = !filterState || user.assignedState === filterState;
            const localityMatch = !filterLocality || user.assignedLocality === filterLocality;
            // --- START MODIFICATION ---
            // Search displayName instead of name
            const searchMatch = !searchQuery ||
                                String(user.displayName || '').toLowerCase().includes(queryLower) ||
                                String(user.email || '').toLowerCase().includes(queryLower);
            // --- END MODIFICATION ---
            return roleMatch && stateMatch && localityMatch && searchMatch;
        });
        return filtered;
    }, [users, filterRole, filterState, filterLocality, searchQuery]);
    // (End Unchanged Filtering Logic)

    // --- MODIFIED: Memoized calculations for usage tab ---
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
    // --- END MODIFICATION ---


    if (loading) return <Spinner />;

    // (Unchanged renderUserRolesTab)
    const renderUserRolesTab = () => (
        <Card>
            <h3 className="text-lg font-medium mb-4">Manage User Roles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <FormGroup label="Search by Name/Email">
                    <Input type="search" placeholder="Name or Email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </FormGroup>
                <FormGroup label="Filter by Role">
                    <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                        <option value="">All Roles</option>
                        {Object.entries(ROLES).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                    </Select>
                </FormGroup>
                <FormGroup label="Filter by State">
                    <Select value={filterState} onChange={(e) => { setFilterState(e.target.value); setFilterLocality(''); }}>
                        <option value="">All States</option>
                        {STATES.map(state => (<option key={state} value={state}>{state}</option>))}
                    </Select>
                </FormGroup>
                <FormGroup label="Filter by Locality">
                    <Select value={filterLocality} onChange={(e) => setFilterLocality(e.target.value)} disabled={!filterState || allLocalitiesInFilterState.length === 0}>
                        <option value="">All Localities</option>
                        {allLocalitiesInFilterState.map(locEn => {
                            const locAr = STATE_LOCALITIES[filterState]?.localities.find(l => l.en === locEn)?.ar || locEn;
                            return <option key={locEn} value={locEn}>{locAr}</option>
                        })}
                    </Select>
                </FormGroup>
            </div>
            {filteredUsers.length > 0 ? (
                // --- START MODIFICATION ---
                // Change header from "Name" to "Display Name"
                <Table headers={["#", "Display Name", "Email", "Current Role", "Change Role", "Assigned State", "Assigned Locality"]}>
                {/* --- END MODIFICATION --- */}
                    {filteredUsers.map((user, index) => {
                        const isStateAssignable = ['states_manager', 'state_coordinator', 'locality_manager'].includes(user.role);
                        const isLocalityAssignable = user.role === 'locality_manager';
                        const currentLocalities = user.assignedState ? (STATE_LOCALITIES[user.assignedState]?.localities || []) : [];
                        return (
                            <tr key={user.id}>
                                <td>{index + 1}</td>
                                {/* --- START MODIFICATION --- */}
                                {/* Render displayName instead of name */}
                                <td>{user.displayName || 'N/A'}</td>
                                {/* --- END MODIFICATION --- */}
                                <td>{user.email}</td>
                                <td><span className="bg-slate-200 text-slate-800 text-xs font-medium px-2 py-1 rounded-full">{ROLES[user.role] || 'N/A'}</span></td>
                                <td>
                                    <Select value={user.role} onChange={(e) => handleUserRoleChange(user.id, e.target.value)} disabled={currentUser?.uid === user.id || (user.role === 'super_user' && currentUserRole !== 'super_user')}>
                                        {Object.entries(ROLES).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                                    </Select>
                                </td>
                                <td>
                                    {isStateAssignable ? (
                                        <Select value={user.assignedState || ''} onChange={(e) => handleUserStateChange(user.id, e.target.value)}>
                                            <option value="">-- Select State --</option>
                                            {STATES.map(state => (<option key={state} value={state}>{state}</option>))}
                                        </Select>
                                    ) : (<span>{user.assignedState || 'N/A'}</span>)}
                                </td>
                                <td>
                                    {isLocalityAssignable ? (
                                        <Select value={user.assignedLocality || ''} onChange={(e) => handleLocalityChange(user.id, user.assignedState, e.target.value)} disabled={!user.assignedState}>
                                            <option value="">-- Select Locality --</option>
                                            {currentLocalities.map(loc => (<option key={loc.en} value={loc.en}>{loc.ar}</option>))}
                                        </Select>
                                    ) : (<span>{user.assignedLocality || 'N/A'}</span>)}
                                </td>
                            </tr>
                        );
                    })}
                </Table>
            ) : (<div className="text-center py-8 text-gray-500">No users found matching the current filters.</div>)}
        </Card>
    );

    // (Unchanged renderRolePermissionsTab)
    const renderRolePermissionsTab = () => (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Manage Role Permissions</h3>
                <Button onClick={handleSaveAndSyncAllPermissions} disabled={loading || currentUserRole !== 'super_user'}>
                    {loading ? 'Saving & Syncing...' : 'Save and Sync All Permissions'}
                </Button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
                Changes here define the default permissions for each role. Clicking 'Save and Sync' will update the global role definitions and **overwrite the permissions for all users** to match their assigned role.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {Object.keys(ROLES).map(role => (
                    <div key={role} className="border p-4 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-base font-semibold">{ROLES[role]}</h4>
                        </div>
                        <PermissionsDropdown role={role} currentPermissions={rolesAndPermissions[role]} allPermissions={ALL_PERMISSIONS} onPermissionChange={handlePermissionChange} disabled={currentUserRole !== 'super_user' || role === 'super_user'} />
                    </div>
                ))}
            </div>
        </Card>
    );


    // --- MODIFIED: Render function for the Usage Tab ---
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp.seconds * 1000).toLocaleString();
    };

    const renderUsageTab = () => (
        <Card>
            <h3 className="text-lg font-medium mb-4">Resource Usage Tracking (All Users)</h3>
            <p className="text-sm text-gray-600 mb-6">
                This table shows the total read/write operations and an approximation of active time in the app.
                Active time is counted in 1-minute intervals as long as the user has database activity within a 5-minute window.
            </p>

            {/* --- MODIFIED: Aggregate Stats --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                    <div className="text-sm font-medium text-green-700">Total System Reads</div>
                    <div className="text-3xl font-bold text-green-900">{aggregates.totalReads.toLocaleString()}</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
                    <div className="text-sm font-medium text-yellow-700">Total System Writes</div>
                    <div className="text-3xl font-bold text-yellow-900">{aggregates.totalWrites.toLocaleString()}</div>
                </div>
                {/* --- NEW CARD --- */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
                    <div className="text-sm font-medium text-blue-700">Mean Active Duration</div>
                    <div className="text-3xl font-bold text-blue-900">{formatDuration(aggregates.meanDurationMs)}</div>
                    <div className="text-xs text-gray-500">Total: {formatDuration(aggregates.totalDurationMs)}</div>
                </div>
            </div>

            {/* --- MODIFIED: Usage Table --- */}
            <Table 
                headers={[
                    'User Email',
                    'Total Reads',
                    'Total Writes',
                    'Total Active Duration', // <-- NEW
                    'Last Updated'
                ]}
            >
                {usageStats.map((stat) => (
                    <tr key={stat.id}>
                        <td>{stat.email || 'N/A'}</td>
                        <td className="font-mono">{stat.totalReads ? stat.totalReads.toLocaleString() : 0}</td>
                        <td className="font-mono">{stat.totalWrites ? stat.totalWrites.toLocaleString() : 0}</td>
                        <td>{formatDuration(stat.totalActiveDurationMs)}</td> {/* <-- NEW */}
                        <td>{formatTimestamp(stat.lastUpdated)}</td>
                    </tr>
                ))}
            </Table>
            {usageStats.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    No usage data found.
                </div>
            )}
        </Card>
    );
    // --- END MODIFICATION ---


    return (
        <div className="space-y-6">
            <PageHeader
                title="Admin Dashboard"
                subtitle="Manage system users and their access permissions."
            />
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}

            <AdminTabs 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                currentUserRole={currentUserRole} 
            />

            {activeTab === 'roles' && renderUserRolesTab()}
            {activeTab === 'permissions' && renderRolePermissionsTab()}
            {activeTab === 'usage' && currentUserRole === 'super_user' && renderUsageTab()}

        </div>
    );
}

export default AdminDashboard;