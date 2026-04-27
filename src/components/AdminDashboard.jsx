// AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, PageHeader, Button, Table, Spinner, Select, Checkbox, Toast, Input, FormGroup, Modal, CardBody, CardFooter } from './CommonComponents';
import { db, auth } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { STATE_LOCALITIES } from './constants'; 

// --- Icons & Data Imports ---
import { CheckCircle, XCircle, RefreshCw, Lock, Upload, FileSignature, Stamp, Users, Shield, Activity, Award, Filter, Database, Edit3, Clock, Settings } from 'lucide-react';
import { 
    listAllCourses, 
    listFederalCoordinators, 
    unapproveCourseCertificates,
    uploadFile
} from '../data';
// ----------------------------

// -----------------------------------------------------------------------------
// EXPORTED PERMISSION MANAGEMENT CONSTANTS 
// -----------------------------------------------------------------------------
export const ALL_PERMISSIONS = {
    canViewCourse: false,
    canManageCourse: false,
    canViewFacilities: false,
    canManageFacilities: false,
    canViewHumanResource: false,
    canManageHumanResource: false,
    canViewSkillsMentorship: false,
    canManageSkillsMentorship: false,
    canApproveSubmissions: false,
    canUseSuperUserAdvancedFeatures: false,
    canUseFederalManagerAdvancedFeatures: false,
    manageScope: 'none',
    manageLocation: '',
    manageTimePeriod: 'course_period_only',
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
    if (basePermissions.canManageSkillsMentorship) {
        basePermissions.canViewSkillsMentorship = true;
    }
    if (basePermissions.canUseFederalManagerAdvancedFeatures) {
        basePermissions.canApproveSubmissions = true;
    }
    return basePermissions;
};

// --- MULTI-ROLE MERGE FUNCTION ---
export const mergeRolePermissions = (rolesArray, globalPermissionsMap) => {
    let mergedPerms = { ...ALL_PERMISSIONS };
    
    const hierarchies = {
        manageScope: { 'none': 0, 'course': 1, 'locality': 2, 'state': 3, 'federal': 4 },
        manageTimePeriod: { 'course_period_only': 1, 'course_period_plus_3_days': 2, 'anytime': 3 },
        manageLocation: { 'user_locality': 1, 'user_state': 2, 'federal_level': 3, '': 4 }
    };

    rolesArray.forEach(role => {
        const perms = globalPermissionsMap[role] || DEFAULT_ROLE_PERMISSIONS[role] || {};
        
        Object.keys(perms).forEach(key => {
            if (typeof perms[key] === 'boolean') {
                mergedPerms[key] = mergedPerms[key] || perms[key];
            } else if (hierarchies[key]) {
                const currentVal = mergedPerms[key] || Object.keys(hierarchies[key])[0];
                const newVal = perms[key] || Object.keys(hierarchies[key])[0];
                
                if (hierarchies[key][newVal] > hierarchies[key][currentVal]) {
                    mergedPerms[key] = newVal;
                }
            }
        });
    });

    return applyDerivedPermissions(mergedPerms);
};

const BASE_PERMS = { ...ALL_PERMISSIONS };
const COURSE_MGMT_STANDARD = { canViewCourse: true, canManageCourse: true };
const FACILITY_MGMT_VIEW_ONLY = { canViewFacilities: true, canManageFacilities: false };
const FACILITY_MGMT_STANDARD = { canViewFacilities: true, canManageFacilities: true };
const HR_MGMT_VIEW_ONLY = { canViewHumanResource: true, canManageHumanResource: false };
const HR_MGMT_NONE = { canViewHumanResource: false, canManageHumanResource: false };
const HR_MGMT_STANDARD = { canViewHumanResource: true, canManageHumanResource: true };
const MENTORSHIP_MGMT_VIEW_ONLY = { canViewSkillsMentorship: true, canManageSkillsMentorship: false };
const MENTORSHIP_MGMT_STANDARD = { canViewSkillsMentorship: true, canManageSkillsMentorship: true };
const ADVANCED_PERMS_NONE = { canApproveSubmissions: false, canUseSuperUserAdvancedFeatures: false, canUseFederalManagerAdvancedFeatures: false, canViewAdmin: false };

const SUPER_USER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, canViewAdmin: true, canUseSuperUserAdvancedFeatures: true, canUseFederalManagerAdvancedFeatures: true, manageScope: 'federal', manageTimePeriod: 'anytime' };
const FEDERAL_MANAGER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, canUseFederalManagerAdvancedFeatures: true, manageScope: 'federal', manageTimePeriod: 'anytime' };
const STATES_MANAGER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, manageScope: 'state', manageLocation: 'user_state', manageTimePeriod: 'course_period_only' };
const LOCALITY_MANAGER_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_STANDARD, ...HR_MGMT_STANDARD, ...MENTORSHIP_MGMT_STANDARD, ...ADVANCED_PERMS_NONE, manageScope: 'locality', manageLocation: 'user_locality', manageTimePeriod: 'course_period_only' };
const FEDERAL_COORDINATOR_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_VIEW_ONLY, ...HR_MGMT_VIEW_ONLY, ...MENTORSHIP_MGMT_VIEW_ONLY, ...ADVANCED_PERMS_NONE, manageScope: 'course', manageLocation: 'federal_level', manageTimePeriod: 'course_period_plus_3_days' };
const FACILITATOR_PERMS = { ...FEDERAL_COORDINATOR_PERMS };
const STATE_COORDINATOR_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_VIEW_ONLY, ...HR_MGMT_VIEW_ONLY, ...MENTORSHIP_MGMT_VIEW_ONLY, ...ADVANCED_PERMS_NONE, manageScope: 'course', manageLocation: 'user_state', manageTimePeriod: 'course_period_only' };
const COURSE_COORDINATOR_PERMS = { ...BASE_PERMS, ...COURSE_MGMT_STANDARD, ...FACILITY_MGMT_VIEW_ONLY, ...HR_MGMT_NONE, ...MENTORSHIP_MGMT_VIEW_ONLY, ...ADVANCED_PERMS_NONE, manageScope: 'course', manageTimePeriod: 'course_period_only' };
const USER_PERMS = { ...BASE_PERMS, canViewCourse: true, canViewFacilities: true, canViewSkillsMentorship: false, canViewDashboard: true };

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

// -----------------------------------------------------------------------------
// LOCAL CONSTANTS
// -----------------------------------------------------------------------------
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

const PERMISSION_DESCRIPTIONS = {
    canViewCourse: "Allow user to view course list, details, and reports.",
    canManageCourse: "Allow user to add/edit/delete active courses, participants, and monitoring observations.",
    canViewFacilities: "View the Child Health Services facilities list.",
    canManageFacilities: "Add, Edit, and Delete facility records within assigned scope.",
    canViewHumanResource: "Allow viewing lists for Facilitators, Program Teams, and Partners.",
    canManageHumanResource: "Allow add/edit/delete for Facilitators, Program Teams, and Partners within the user's assigned scope.",
    canViewSkillsMentorship: "Allow user to view the Skills Mentorship module, dashboard, and history.",
    canManageSkillsMentorship: "Allow user to share public submission links for mentorship.",
    canApproveSubmissions: "Approve/Reject submissions for Facilitators and Health Facilities.",
    canUseSuperUserAdvancedFeatures: "ADVANCED: Allows bulk operations (import, clean, migrate, check).", 
    canUseFederalManagerAdvancedFeatures: "ADVANCED: Allows managing inactive items, Final Reports, enables all HR Management, and grants approval rights.", 
    manageScope: "Defines the scope (Federal, State, Locality, or Course level) for management actions.",
    manageLocation: "The specific location filter for management actions.",
    manageTimePeriod: "Limits course/monitoring management actions.",
    canViewDashboard: "Derived: Allow navigating to the dashboard.",
    canViewAdmin: "Access the Admin Dashboard.",
};

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

const AdminTabs = ({ activeTab, setActiveTab, currentUserRole }) => {
    const tabs = [
        { key: 'roles', label: 'Manage User Roles', icon: Users },
        { key: 'permissions', label: 'Manage Role Permissions', icon: Shield },
    ];

    if (currentUserRole === 'super_user' || currentUserRole === 'federal_manager') {
        tabs.push({ key: 'approvals', label: 'Certificate Approvals', icon: Award });
    }

    if (currentUserRole === 'super_user') {
        tabs.push({ key: 'usage', label: 'Resource Usage', icon: Activity });
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
        { title: 'A. Course Management', keys: ['canViewCourse', 'canManageCourse'] },
        { title: 'B. Child Health Service Facility Management', keys: ['canViewFacilities', 'canManageFacilities'] },
        { title: 'C. Human Resource (HR) Management', keys: ['canViewHumanResource', 'canManageHumanResource'] },
        { title: 'D. Skills Mentorship', keys: ['canViewSkillsMentorship', 'canManageSkillsMentorship'] },
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
                        {/* Category Heading - Sticks cleanly to the top */}
                        <div className={`px-6 py-3 bg-gray-100 border-b border-gray-200 sticky top-0 z-20 shadow-sm ${catIndex === 0 ? 'rounded-t-xl' : ''}`}>
                            <h5 className="text-gray-800 font-black text-sm uppercase tracking-wider">
                                {category.title}
                            </h5>
                        </div>

                        {/* Coherent List within Category */}
                        <div className="divide-y divide-gray-100">
                            {category.keys.map(permission => {
                                if (!currentPermissions.hasOwnProperty(permission)) return null;
                                const value = currentPermissions[permission];
                                const isBoolean = typeof allPermissions[permission] === 'boolean';
                                const formattedTitle = permission.replace(/([A-Z])/g, ' $1').trim();
                                
                                // View for Derived/Read-only Permissions
                                if (['canViewDashboard', 'canViewAdmin', 'canApproveSubmissions'].includes(permission)) {
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
                                
                                // View for Standard Editable Permissions
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
// Certificate Approvals Tab
// -----------------------------------------------------------------------------
const CertificateApprovalsTab = ({ setToast }) => {
    const [courses, setCourses] = useState([]);
    const [managerName, setManagerName] = useState('');
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [isApproving, setIsApproving] = useState(false);
    
    const [managerSignatureFile, setManagerSignatureFile] = useState(null);
    const [directorName, setDirectorName] = useState('');
    const [directorSignatureFile, setDirectorSignatureFile] = useState(null);
    const [programStampFile, setProgramStampFile] = useState(null);

    const managerFileRef = useRef(null);
    const directorFileRef = useRef(null);
    const stampFileRef = useRef(null);

    const loadData = async () => {
        setLoadingApprovals(true);
        try {
            const allCourses = await listAllCourses({ source: 'server' });
            const sorted = allCourses.sort((a, b) => {
                if (a.isCertificateApproved === b.isCertificateApproved) {
                    return new Date(b.start_date) - new Date(a.start_date);
                }
                return a.isCertificateApproved ? 1 : -1;
            });
            setCourses(sorted);

            const coords = await listFederalCoordinators({ source: 'server' });
            const manager = coords.find(c => c.role === 'مدير البرنامج' || c.role === 'Federal Program Manager');
            if (manager) setManagerName(manager.name);
        } catch (err) {
            setToast({ show: true, message: "Error loading approval data", type: 'error' });
        } finally {
            setLoadingApprovals(false);
        }
    };

    useEffect(() => { loadData(); }, [setToast]);

    const handleOpenApprovalModal = (course) => {
        if (!managerName) {
            setToast({ show: true, message: "Program Manager Name is missing. Please check HR settings.", type: 'error' });
            return;
        }
        setSelectedCourse(course);
        setManagerSignatureFile(null);
        setDirectorSignatureFile(null);
        setProgramStampFile(null);
        setDirectorName(course.director || '');
        setApprovalModalOpen(true);
    };

    const handleConfirmApprove = async () => {
        if (!selectedCourse || !managerName) return;
        setIsApproving(true);
        try {
            let managerSigUrl = null; if (managerSignatureFile) managerSigUrl = await uploadFile(managerSignatureFile);
            let directorSigUrl = null; if (directorSignatureFile) directorSigUrl = await uploadFile(directorSignatureFile);
            let stampUrl = null; if (programStampFile) stampUrl = await uploadFile(programStampFile);

            const courseRef = doc(db, 'courses', selectedCourse.id);
            const approvalData = {
                isCertificateApproved: true,
                approvedByManagerName: managerName,
                approvedByManagerSignatureUrl: managerSigUrl || selectedCourse.approvedByManagerSignatureUrl || null,
                approvedDirectorName: directorName,
                approvedDirectorSignatureUrl: directorSigUrl || selectedCourse.approvedDirectorSignatureUrl || null,
                approvedProgramStampUrl: stampUrl || selectedCourse.approvedProgramStampUrl || null,
                certificateApprovedAt: new Date()
            };

            await updateDoc(courseRef, approvalData);
            setToast({ show: true, message: "Certificates Approved Successfully.", type: 'success' });
            setApprovalModalOpen(false);
            
            setCourses(prevCourses => prevCourses.map(c => {
                if (c.id === selectedCourse.id) {
                    return { ...c, ...approvalData, certificateApprovedAt: { seconds: Math.floor(Date.now() / 1000) } };
                }
                return c;
            }));

        } catch (err) {
            setToast({ show: true, message: `Error: ${err.message}`, type: 'error' });
        } finally { setIsApproving(false); }
    };

    const handleUnapprove = async (course) => {
        if (course.approvedByManagerName && course.approvedByManagerName !== managerName) {
            setToast({ show: true, message: `Permission Denied. Only ${course.approvedByManagerName} can revoke this.`, type: 'error' });
            return;
        }

        if (window.confirm(`Revoke approval for ${course.course_type}? \n\nThis will hide the download links for participants.`)) {
            setLoadingApprovals(true);
            try {
                await unapproveCourseCertificates(course.id);
                setToast({ show: true, message: "Approval Revoked.", type: 'info' });
                setCourses(prevCourses => prevCourses.map(c => {
                    if (c.id === course.id) {
                        return { ...c, isCertificateApproved: false, approvedByManagerName: null, approvedByManagerSignatureUrl: null, approvedDirectorName: null, approvedDirectorSignatureUrl: null, approvedProgramStampUrl: null, certificateApprovedAt: null };
                    }
                    return c;
                }));
            } catch (err) { setToast({ show: true, message: err.message, type: 'error' }); } 
            finally { setLoadingApprovals(false); }
        }
    };

    if (loadingApprovals && !approvalModalOpen) return <div className="flex justify-center p-8"><Spinner /></div>;

    return (
        <>
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center">
                        <Award className="w-5 h-5 mr-2 text-sky-500" /> Certificate Approvals
                    </h3>
                    <Button variant="secondary" onClick={loadData} size="sm" className="shadow-sm">
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                </div>
                
                <div className="bg-sky-50 border border-sky-100 p-5 rounded-xl mb-6 shadow-sm flex items-start">
                    <div className="p-2 bg-sky-100 text-sky-600 rounded-full mr-4 shrink-0">
                        <FileSignature className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-sky-900">
                            <strong>Current Signing Authority:</strong> 
                            <span className="font-bold text-lg ml-2 underline decoration-sky-300 underline-offset-4">{managerName || "Loading..."}</span>
                        </p>
                        <p className="text-xs text-sky-700 mt-2 leading-relaxed">
                            Approving a course will permanently stamp your name on the generated certificates. Ensure you upload all necessary signatures and the transparent program stamp before confirming.
                        </p>
                    </div>
                </div>

                {courses.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <div className="text-gray-400 mb-2"><Award className="w-8 h-8 mx-auto opacity-50" /></div>
                        <div className="text-gray-500 font-medium">No courses found to approve.</div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                        <Table headers={["State", "Locality", "Course Type", "Sub Course", "Start Date", "Status", "Actions"]}>
                            {courses.map(c => {
                                const isApproved = c.isCertificateApproved === true;
                                const canModify = isApproved && c.approvedByManagerName === managerName;

                                const subCourses = c.facilitatorAssignments && c.facilitatorAssignments.length > 0
                                    ? [...new Set(c.facilitatorAssignments.map(a => a.imci_sub_type).filter(Boolean))].join(', ')
                                    : (c.director_imci_sub_type || '-');

                                return (
                                    <tr key={c.id} className={`transition-colors hover:bg-gray-50 ${isApproved ? "bg-gray-50/50" : "bg-white"}`}>
                                        <td className="font-medium text-gray-800">{c.state}</td>
                                        <td className="text-gray-600">{c.locality}</td>
                                        <td className="font-medium text-sky-700">{c.course_type}</td>
                                        <td className="text-sm text-gray-500 max-w-[150px] truncate" title={subCourses}>
                                            {subCourses}
                                        </td>
                                        <td className="text-gray-600 font-mono text-sm">{c.start_date}</td>
                                        <td>
                                            {isApproved ? (
                                                <div className="flex flex-col items-start">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-200 shadow-sm">
                                                        <CheckCircle className="w-3 h-3 mr-1" /> Approved
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 mt-1 font-medium bg-gray-100 px-1.5 py-0.5 rounded">
                                                        By: {c.approvedByManagerName}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            {isApproved ? (
                                                <Button 
                                                    onClick={() => handleUnapprove(c)} 
                                                    disabled={!canModify}
                                                    variant="secondary"
                                                    size="sm"
                                                    className={!canModify ? "opacity-50 cursor-not-allowed" : "text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"}
                                                    title={!canModify ? `Only ${c.approvedByManagerName} can revoke this.` : "Revoke Approval"}
                                                >
                                                    {canModify ? "Revoke" : <Lock className="w-4 h-4" />}
                                                </Button>
                                            ) : (
                                                <Button onClick={() => handleOpenApprovalModal(c)} disabled={!managerName} variant="primary" size="sm" className="shadow-sm">
                                                    Review & Approve
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                    </div>
                )}
            </Card>

            <Modal isOpen={approvalModalOpen} onClose={() => !isApproving && setApprovalModalOpen(false)} title="Confirm & Sign Certificates">
                <CardBody>
                    <div className="space-y-6">
                        <div className="bg-sky-50 text-sky-800 p-3 rounded-lg text-sm border border-sky-100 flex items-start">
                            <Award className="w-5 h-5 mr-3 shrink-0 opacity-70" />
                            <p>You are approving certificates for <strong>{selectedCourse?.course_type}</strong> in <strong>{selectedCourse?.locality}, {selectedCourse?.state}</strong>.</p>
                        </div>
                        
                        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center tracking-wide">
                                <FileSignature className="w-4 h-4 mr-2 text-sky-500" /> Program Manager (You)
                            </h4>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Name on Certificate</label>
                                <div className="text-sm font-bold bg-white px-3 py-2 border border-gray-200 rounded-lg text-gray-800 shadow-sm">{managerName}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Signature Image (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept="image/*" ref={managerFileRef} onChange={(e) => setManagerSignatureFile(e.target.files[0])} className="hidden" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => managerFileRef.current?.click()} className="w-full justify-center bg-white">
                                        <Upload className="w-4 h-4 mr-2 text-gray-400" /> {managerSignatureFile ? managerSignatureFile.name : "Upload Signature"}
                                    </Button>
                                    {managerSignatureFile && <Button type="button" variant="danger" size="sm" onClick={() => { setManagerSignatureFile(null); if(managerFileRef.current) managerFileRef.current.value = ''; }}><XCircle className="w-4 h-4" /></Button>}
                                </div>
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center tracking-wide">
                                <FileSignature className="w-4 h-4 mr-2 text-blue-500" /> Course Director
                            </h4>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Director Name</label>
                                <Input value={directorName} onChange={(e) => setDirectorName(e.target.value)} placeholder="Dr. Name..." className="text-sm font-medium" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Director Signature (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept="image/*" ref={directorFileRef} onChange={(e) => setDirectorSignatureFile(e.target.files[0])} className="hidden" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => directorFileRef.current?.click()} className="w-full justify-center bg-gray-50">
                                        <Upload className="w-4 h-4 mr-2 text-gray-400" /> {directorSignatureFile ? directorSignatureFile.name : "Upload Signature"}
                                    </Button>
                                    {directorSignatureFile && <Button type="button" variant="danger" size="sm" onClick={() => { setDirectorSignatureFile(null); if(directorFileRef.current) directorFileRef.current.value = ''; }}><XCircle className="w-4 h-4" /></Button>}
                                </div>
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center tracking-wide">
                                <Stamp className="w-4 h-4 mr-2 text-indigo-500" /> Program Stamp
                            </h4>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Stamp Image</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept="image/*" ref={stampFileRef} onChange={(e) => setProgramStampFile(e.target.files[0])} className="hidden" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => stampFileRef.current?.click()} className="w-full justify-center bg-gray-50">
                                        <Upload className="w-4 h-4 mr-2 text-gray-400" /> {programStampFile ? programStampFile.name : "Upload Stamp"}
                                    </Button>
                                    {programStampFile && <Button type="button" variant="danger" size="sm" onClick={() => { setProgramStampFile(null); if(stampFileRef.current) stampFileRef.current.value = ''; }}><XCircle className="w-4 h-4" /></Button>}
                                </div>
                                <p className="text-xs text-gray-400 mt-2 italic flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Recommended: Transparent PNG background.</p>
                            </div>
                        </div>
                    </div>
                </CardBody>
                <CardFooter>
                    <div className="flex justify-end gap-3 w-full pt-2">
                        <Button variant="secondary" onClick={() => setApprovalModalOpen(false)} disabled={isApproving}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleConfirmApprove} disabled={isApproving} className="shadow-md">
                            {isApproving ? <><Spinner size="sm" className="mr-2" /> Processing...</> : "Confirm & Approve"}
                        </Button>
                    </div>
                </CardFooter>
            </Modal>
        </>
    );
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
    const [activeTab, setActiveTab] = useState('roles');

    const [filterRole, setFilterRole] = useState('');
    const [filterState, setFilterState] = useState('');
    const [filterLocality, setFilterLocality] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [viewingUser, setViewingUser] = useState(null);
    const [editingRolesUser, setEditingRolesUser] = useState(null);
    const [tempSelectedRoles, setTempSelectedRoles] = useState([]);
    
    // --- STATE FOR ROLE PERMISSIONS MODAL ---
    const [editingPermissionRole, setEditingPermissionRole] = useState(null);

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
                        role = 'user'; 
                    }
                    setCurrentUserRole(role);
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
            const updatedPermissions = Object.keys(ROLES).reduce((acc, role) => {
                const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS['user'];
                const savedPerms = permissionsData[role]; 
                let mergedPerms = { ...ALL_PERMISSIONS, ...defaultPerms, ...(savedPerms || {}) };
                acc[role] = applyDerivedPermissions(mergedPerms);
                return acc;
            }, {});

            setUsers(userList);
            setRolesAndPermissions(updatedPermissions);

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
            setToast({ show: true, message: "Error loading data. Please try again.", type: "error" });
        }
        setLoading(false);
    };

    const handleUserRolesChange = async (userId, selectedRoles) => {
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
        }

        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, updatePayload);
            setUsers(users.map(user => user.id === userId ? { ...user, ...updatePayload } : user));
            setToast({ show: true, message: `Successfully updated user roles.`, type: "success" });
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
            if (baseRole.canManageFacilities) {
                 baseRole.canViewFacilities = true;
            }
            const updatedRole = applyDerivedPermissions(baseRole);
            return { ...prev, [role]: updatedRole };
        });
    };

    const handleSaveAndSyncAllPermissions = async () => {
        if (!window.confirm("Are you sure you want to save these global permissions AND synchronize them with ALL users in the database?")) return;
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
                const userData = userDoc.data();
                const userRoles = userData.roles || [userData.role || 'user'];
                const mergedPermissions = mergeRolePermissions(userRoles, rolesAndPermissionsWithDerived);
                const userRef = doc(db, "users", userDoc.id);
                batch.update(userRef, { permissions: { ...ALL_PERMISSIONS, ...mergedPermissions } });
            });
            
            await batch.commit();
            setRolesAndPermissions(rolesAndPermissionsWithDerived);
            await loadData(currentUserRole); 
            setToast({ show: true, message: "Permissions saved and synchronized with all users successfully!", type: "success" });
        } catch (error) {
            setToast({ show: true, message: "Failed to save and sync permissions. Please try again.", type: "error" });
        }
        setLoading(false);
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
                        <Table headers={["Name & Email", "Current Roles", "Manage Roles", "Assigned Area"]}>
                            {filteredUsers.map((user) => {
                                const userRoles = user.roles || [user.role || 'user'];
                                const isStateAssignable = userRoles.some(r => ['states_manager', 'state_coordinator', 'locality_manager'].includes(r));
                                const isLocalityAssignable = userRoles.includes('locality_manager');
                                const currentLocalities = user.assignedState ? (STATE_LOCALITIES[user.assignedState]?.localities || []) : [];
                                
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
                                            <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                                                {userRoles.map(r => (
                                                    <span key={r} className={`border text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm whitespace-nowrap ${getRoleBadgeStyle(r)}`}>
                                                        {ROLES[r] || r}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <Button 
                                                size="sm" 
                                                variant="secondary" 
                                                onClick={() => { setEditingRolesUser(user); setTempSelectedRoles(userRoles); }}
                                                className="text-xs py-1 px-3 bg-white border-gray-300 shadow-sm hover:bg-gray-50 hover:text-sky-600"
                                            >
                                                <Edit3 className="w-3 h-3 mr-1" /> Edit Roles
                                            </Button>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex flex-col gap-2 max-w-[200px]">
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
                        Adjusting permissions here defines the default blueprint for each role. Clicking <strong>Save and Sync</strong> will permanently overwrite the permissions for all users to match their assigned roles.
                    </p>
                </div>
                <Button onClick={handleSaveAndSyncAllPermissions} disabled={loading || currentUserRole !== 'super_user'} className="shrink-0 shadow-md">
                    {loading ? <><Spinner size="sm" className="mr-2" /> Syncing Data...</> : <><RefreshCw className="w-4 h-4 mr-2" /> Save & Sync Globally</>}
                </Button>
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

            <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} currentUserRole={currentUserRole} />

            <div className="mt-4">
                {activeTab === 'roles' && renderUserRolesTab()}
                {activeTab === 'permissions' && renderRolePermissionsTab()}
                {activeTab === 'usage' && currentUserRole === 'super_user' && renderUsageTab()}
                {activeTab === 'approvals' && <CertificateApprovalsTab setToast={setToast} />}
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
                        <p className="text-xs text-gray-500 mt-4 flex items-start px-1"><Shield className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0"/> Assigning multiple roles will automatically grant the highest level of permissions derived from all selected blueprints.</p>
                    </div>
                </CardBody>
                <CardFooter className="bg-white border-t border-gray-100">
                    <div className="flex justify-end gap-3 w-full pt-1">
                        <Button variant="secondary" onClick={() => setEditingRolesUser(null)} className="px-5">Cancel</Button>
                        <Button variant="primary" onClick={() => {
                            handleUserRolesChange(editingRolesUser.id, tempSelectedRoles);
                            setEditingRolesUser(null);
                        }} className="px-6 shadow-md">
                            Confirm & Apply Roles
                        </Button>
                    </div>
                </CardFooter>
            </Modal>

            {/* CONFIGURE ROLE PERMISSIONS MODAL */}
            <Modal isOpen={!!editingPermissionRole} onClose={() => setEditingPermissionRole(null)} title="Configure Blueprint Permissions">
                <CardBody className="p-0 bg-gray-50/50">
                    <div className="p-6 border-b border-gray-200 bg-white">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Editing Permissions Blueprint for:</p>
                        <div className="font-black text-sky-900 flex items-center text-3xl">
                            <Shield className="w-8 h-8 mr-3 text-sky-500"/> {ROLES[editingPermissionRole]}
                        </div>
                    </div>
                    {editingPermissionRole && (
                        <div className="p-4 md:p-6">
                            <PermissionsEditor 
                                role={editingPermissionRole} 
                                currentPermissions={rolesAndPermissions[editingPermissionRole]} 
                                allPermissions={ALL_PERMISSIONS} 
                                onPermissionChange={handlePermissionChange} 
                                disabled={currentUserRole !== 'super_user' || editingPermissionRole === 'super_user'} 
                            />
                        </div>
                    )}
                </CardBody>
                <CardFooter className="bg-white border-t border-gray-100">
                    <div className="flex justify-end gap-3 w-full pt-1">
                        <Button variant="primary" onClick={() => setEditingPermissionRole(null)} className="px-8 shadow-sm">
                            Done
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
                        <div className="mt-8 flex justify-end pt-4 border-t border-gray-100">
                            <Button onClick={() => setViewingUser(null)} variant="secondary" className="px-6">Close Profile</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default AdminDashboard;