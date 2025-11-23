// AdminDashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, PageHeader, Button, Table, Spinner, Select, Checkbox, Toast, Input, FormGroup, Modal, CardBody, CardFooter } from './CommonComponents';
import { db, auth } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { STATE_LOCALITIES } from './constants'; 

// --- Icons & Data Imports ---
import { CheckCircle, XCircle, RefreshCw, Lock, Upload, FileSignature, Stamp } from 'lucide-react';
import { 
    listAllCourses, 
    listFederalCoordinators, 
    unapproveCourseCertificates,
    uploadFile
} from '../data';
// ----------------------------

// -----------------------------------------------------------------------------
// EXPORTED PERMISSION MANAGEMENT CONSTANTS (Unchanged)
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
    canManageHumanResource: "Allow add/edit/delete for Facilitators, Program Teams, and Partners within the user's assigned scope (federal, state, or locality).",
    canViewSkillsMentorship: "Allow user to view the Skills Mentorship module, dashboard, and history.",
    canManageSkillsMentorship: "Allow user to share public submission links for mentorship.",
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

// --- Helper Components ---

const AdminTabs = ({ activeTab, setActiveTab, currentUserRole }) => {
    const tabs = [
        { key: 'roles', label: 'Manage User Roles' },
        { key: 'permissions', label: 'Manage Role Permissions' },
    ];

    if (currentUserRole === 'super_user' || currentUserRole === 'federal_manager') {
        tabs.push({ key: 'approvals', label: 'Certificate Approvals' });
    }

    if (currentUserRole === 'super_user') {
        tabs.push({ key: 'usage', label: 'Resource Usage' });
    }

    return (
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 font-medium text-sm transition-colors duration-150 whitespace-nowrap ${
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

const PermissionsDropdown = ({ role, currentPermissions, allPermissions, onPermissionChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const PERMISSION_CATEGORIES = useMemo(() => [
        { title: 'A. Course Management', keys: ['canViewCourse', 'canManageCourse'] },
        { title: 'B. Child Health Service Facility Management', keys: ['canViewFacilities', 'canManageFacilities'] },
        { title: 'C. Human Resource (HR) Management', keys: ['canViewHumanResource', 'canManageHumanResource'] },
        { title: 'D. Skills Mentorship', keys: ['canViewSkillsMentorship', 'canManageSkillsMentorship'] },
        { title: 'E. System / Advanced / Scope', keys: ['canUseSuperUserAdvancedFeatures', 'canUseFederalManagerAdvancedFeatures', 'manageLocation', 'manageTimePeriod', 'canViewAdmin', 'canViewDashboard'] }
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

const formatDuration = (milliseconds) => {
    // ... [Unchanged] ...
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
// Certificate Approvals Tab (Updated with Sub Course Logic)
// -----------------------------------------------------------------------------
const CertificateApprovalsTab = ({ setToast }) => {
    const [courses, setCourses] = useState([]);
    const [managerName, setManagerName] = useState('');
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    
    // --- STATE FOR APPROVAL MODAL ---
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [isApproving, setIsApproving] = useState(false);
    
    // Inputs
    const [managerSignatureFile, setManagerSignatureFile] = useState(null);
    
    // New Fields
    const [directorName, setDirectorName] = useState('');
    const [directorSignatureFile, setDirectorSignatureFile] = useState(null);
    const [programStampFile, setProgramStampFile] = useState(null);

    // Refs
    const managerFileRef = useRef(null);
    const directorFileRef = useRef(null);
    const stampFileRef = useRef(null);

    const loadData = async () => {
        setLoadingApprovals(true);
        try {
            const allCourses = await listAllCourses({ source: 'server' });
            // Sort: Pending first, then Approved (descending by date)
            const sorted = allCourses.sort((a, b) => {
                if (a.isCertificateApproved === b.isCertificateApproved) {
                    return new Date(b.start_date) - new Date(a.start_date);
                }
                return a.isCertificateApproved ? 1 : -1;
            });
            setCourses(sorted);

            const coords = await listFederalCoordinators({ source: 'server' });
            const manager = coords.find(c => c.role === 'مدير البرنامج' || c.role === 'Federal Program Manager');
            if (manager) {
                setManagerName(manager.name);
            }
        } catch (err) {
            console.error(err);
            setToast({ show: true, message: "Error loading approval data", type: 'error' });
        } finally {
            setLoadingApprovals(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [setToast]);

    // --- HANDLERS ---

    const handleOpenApprovalModal = (course) => {
        if (!managerName) {
            setToast({ show: true, message: "Program Manager Name is missing. Please check HR settings.", type: 'error' });
            return;
        }
        setSelectedCourse(course);
        // Reset Inputs
        setManagerSignatureFile(null);
        setDirectorSignatureFile(null);
        setProgramStampFile(null);
        // Pre-fill Director name from course data
        setDirectorName(course.director || '');
        setApprovalModalOpen(true);
    };

    const handleConfirmApprove = async () => {
        if (!selectedCourse || !managerName) return;
        
        setIsApproving(true);
        try {
            // 1. Upload Manager Signature (Optional)
            let managerSigUrl = null;
            if (managerSignatureFile) {
                managerSigUrl = await uploadFile(managerSignatureFile);
            }

            // 2. Upload Director Signature (Optional)
            let directorSigUrl = null;
            if (directorSignatureFile) {
                directorSigUrl = await uploadFile(directorSignatureFile);
            }

            // 3. Upload Program Stamp (Optional)
            let stampUrl = null;
            if (programStampFile) {
                stampUrl = await uploadFile(programStampFile);
            }

            // 4. Update Course Document directly (replacing API call to handle new fields)
            const courseRef = doc(db, 'courses', selectedCourse.id);
            const approvalData = {
                isCertificateApproved: true,
                approvedByManagerName: managerName,
                approvedByManagerSignatureUrl: managerSigUrl || selectedCourse.approvedByManagerSignatureUrl || null, // Keep existing if not replaced
                approvedDirectorName: directorName,
                approvedDirectorSignatureUrl: directorSigUrl || selectedCourse.approvedDirectorSignatureUrl || null,
                approvedProgramStampUrl: stampUrl || selectedCourse.approvedProgramStampUrl || null,
                certificateApprovedAt: new Date()
            };

            await updateDoc(courseRef, approvalData);
            
            setToast({ show: true, message: "Certificates Approved Successfully.", type: 'success' });
            setApprovalModalOpen(false);
            
            // --- SELECTIVE UPDATE: Update local state ---
            setCourses(prevCourses => prevCourses.map(c => {
                if (c.id === selectedCourse.id) {
                    return {
                        ...c,
                        ...approvalData,
                        certificateApprovedAt: { seconds: Math.floor(Date.now() / 1000) } 
                    };
                }
                return c;
            }));

        } catch (err) {
            console.error(err);
            setToast({ show: true, message: `Error: ${err.message}`, type: 'error' });
        } finally {
            setIsApproving(false);
        }
    };

    const handleUnapprove = async (course) => {
        if (course.approvedByManagerName && course.approvedByManagerName !== managerName) {
            setToast({ 
                show: true, 
                message: `Permission Denied. Only ${course.approvedByManagerName} can revoke this approval.`, 
                type: 'error' 
            });
            return;
        }

        if (window.confirm(`Revoke approval for ${course.course_type}? \n\nThis will hide the download links for participants.`)) {
            setLoadingApprovals(true);
            try {
                await unapproveCourseCertificates(course.id);
                setToast({ show: true, message: "Approval Revoked.", type: 'info' });
                
                setCourses(prevCourses => prevCourses.map(c => {
                    if (c.id === course.id) {
                        return {
                            ...c,
                            isCertificateApproved: false,
                            approvedByManagerName: null,
                            approvedByManagerSignatureUrl: null,
                            approvedDirectorName: null,
                            approvedDirectorSignatureUrl: null,
                            approvedProgramStampUrl: null,
                            certificateApprovedAt: null
                        };
                    }
                    return c;
                }));

            } catch (err) {
                setToast({ show: true, message: err.message, type: 'error' });
            } finally {
                setLoadingApprovals(false);
            }
        }
    };

    if (loadingApprovals && !approvalModalOpen) return <div className="flex justify-center p-8"><Spinner /></div>;

    return (
        <>
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Certificate Approvals</h3>
                    <Button variant="secondary" onClick={loadData} size="sm">
                        <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                    </Button>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-md mb-6">
                    <p className="text-sm text-blue-800">
                        <strong>Current Signing Authority:</strong> 
                        <span className="font-bold text-lg ml-2 underline">{managerName || "Loading..."}</span>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                        * Approving a course will stamp your name on the certificates. Ensure you upload all necessary signatures and the program stamp.
                    </p>
                </div>

                {courses.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No courses found.</div>
                ) : (
                    <Table headers={["State", "Locality", "Course Type", "Sub Course", "Start Date", "Status", "Actions"]}>
                        {courses.map(c => {
                            const isApproved = c.isCertificateApproved === true;
                            const canModify = isApproved && c.approvedByManagerName === managerName;

                            // --- CORRECTED SUBCOURSE LOGIC ---
                            const subCourses = c.facilitatorAssignments && c.facilitatorAssignments.length > 0
                                ? [...new Set(c.facilitatorAssignments.map(a => a.imci_sub_type).filter(Boolean))].join(', ')
                                : (c.director_imci_sub_type || '-');
                            // ---------------------------------

                            return (
                                <tr key={c.id} className={isApproved ? "bg-gray-50" : "bg-white"}>
                                    <td className="font-medium">{c.state}</td>
                                    <td>{c.locality}</td>
                                    <td>{c.course_type}</td>
                                    {/* Displaying Calculated Sub Course */}
                                    <td className="text-sm text-gray-600 max-w-xs truncate" title={subCourses}>
                                        {subCourses}
                                    </td>
                                    <td>{c.start_date}</td>
                                    <td>
                                        {isApproved ? (
                                            <div className="flex flex-col">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Approved
                                                </span>
                                                <span className="text-[10px] text-gray-500 mt-1">
                                                    By: {c.approvedByManagerName}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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
                                                className={!canModify ? "opacity-50 cursor-not-allowed" : "text-red-600 hover:bg-red-50"}
                                                title={!canModify ? `Only ${c.approvedByManagerName} can revoke this.` : "Revoke Approval"}
                                            >
                                                {canModify ? "Revoke" : <Lock className="w-4 h-4" />}
                                            </Button>
                                        ) : (
                                            <Button 
                                                onClick={() => handleOpenApprovalModal(c)} 
                                                disabled={!managerName} 
                                                variant="primary"
                                                size="sm"
                                            >
                                                Approve
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </Table>
                )}
            </Card>

            {/* --- APPROVAL MODAL --- */}
            <Modal isOpen={approvalModalOpen} onClose={() => !isApproving && setApprovalModalOpen(false)} title="Confirm & Sign Certificates">
                <CardBody>
                    <div className="space-y-6">
                        <p className="text-sm text-gray-600">
                            You are approving certificates for <strong>{selectedCourse?.course_type}</strong> in <strong>{selectedCourse?.locality}, {selectedCourse?.state}</strong>.
                        </p>
                        
                        {/* 1. Manager Section */}
                        <div className="border border-gray-200 rounded p-4 bg-gray-50">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-3 flex items-center">
                                <FileSignature className="w-4 h-4 mr-2" /> Program Manager (You)
                            </h4>
                            <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Name on Certificate</label>
                                <div className="text-sm font-medium bg-white px-2 py-1.5 border rounded text-gray-700">{managerName}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Signature Image (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept="image/*" ref={managerFileRef} onChange={(e) => setManagerSignatureFile(e.target.files[0])} className="hidden" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => managerFileRef.current?.click()} className="w-full justify-center">
                                        <Upload className="w-3 h-3 mr-2" /> {managerSignatureFile ? managerSignatureFile.name : "Upload Signature"}
                                    </Button>
                                    {managerSignatureFile && <Button type="button" variant="danger" size="sm" onClick={() => { setManagerSignatureFile(null); if(managerFileRef.current) managerFileRef.current.value = ''; }}><XCircle className="w-3 h-3" /></Button>}
                                </div>
                            </div>
                        </div>

                        {/* 2. Course Director Section */}
                        <div className="border border-gray-200 rounded p-4 bg-white">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-3 flex items-center">
                                <FileSignature className="w-4 h-4 mr-2" /> Course Director
                            </h4>
                            <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Director Name</label>
                                <Input value={directorName} onChange={(e) => setDirectorName(e.target.value)} placeholder="Dr. Name..." className="text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Director Signature (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept="image/*" ref={directorFileRef} onChange={(e) => setDirectorSignatureFile(e.target.files[0])} className="hidden" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => directorFileRef.current?.click()} className="w-full justify-center">
                                        <Upload className="w-3 h-3 mr-2" /> {directorSignatureFile ? directorSignatureFile.name : "Upload Signature"}
                                    </Button>
                                    {directorSignatureFile && <Button type="button" variant="danger" size="sm" onClick={() => { setDirectorSignatureFile(null); if(directorFileRef.current) directorFileRef.current.value = ''; }}><XCircle className="w-3 h-3" /></Button>}
                                </div>
                            </div>
                        </div>

                        {/* 3. Program Stamp Section */}
                        <div className="border border-gray-200 rounded p-4 bg-white">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-3 flex items-center">
                                <Stamp className="w-4 h-4 mr-2" /> Program Stamp
                            </h4>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Stamp Image</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept="image/*" ref={stampFileRef} onChange={(e) => setProgramStampFile(e.target.files[0])} className="hidden" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => stampFileRef.current?.click()} className="w-full justify-center">
                                        <Upload className="w-3 h-3 mr-2" /> {programStampFile ? programStampFile.name : "Upload Stamp"}
                                    </Button>
                                    {programStampFile && <Button type="button" variant="danger" size="sm" onClick={() => { setProgramStampFile(null); if(stampFileRef.current) stampFileRef.current.value = ''; }}><XCircle className="w-3 h-3" /></Button>}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Recommended: Transparent PNG background.</p>
                            </div>
                        </div>
                    </div>
                </CardBody>
                <CardFooter>
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="secondary" onClick={() => setApprovalModalOpen(false)} disabled={isApproving}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleConfirmApprove} disabled={isApproving}>
                            {isApproving ? <><Spinner size="sm" className="mr-2" /> Processing...</> : "Confirm & Approve"}
                        </Button>
                    </div>
                </CardFooter>
            </Modal>
        </>
    );
};

// -----------------------------------------------------------------------------
// Main AdminDashboard Component (Unchanged except imports)
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
            const userList = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                displayName: doc.data().displayName || doc.data().name || '', 
                assignedLocality: doc.data().assignedLocality || '',
            }));

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
            console.error("Error loading data:", error);
            setToast({ show: true, message: "Error loading data. Please try again.", type: "error" });
        }
        setLoading(false);
    };

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
                const userName = userToUpdate.displayName || userToUpdate.email;
                setToast({ show: true, message: `Successfully updated ${userName}'s role.`, type: "success" });
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
            await updateDoc(userRef, { assignedState: newState, assignedLocality: '' }); 
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
            await loadData(currentUserRole); 
            setToast({ show: true, message: "Permissions saved and synchronized with all users successfully!", type: "success" });
        } catch (error) {
            console.error("Error saving and syncing permissions:", error);
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
            const roleMatch = !filterRole || user.role === filterRole;
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
                <Table headers={["#", "Display Name", "Email", "Current Role", "Change Role", "Assigned State", "Assigned Locality"]}>
                    {filteredUsers.map((user, index) => {
                        const isStateAssignable = ['states_manager', 'state_coordinator', 'locality_manager'].includes(user.role);
                        const isLocalityAssignable = user.role === 'locality_manager';
                        const currentLocalities = user.assignedState ? (STATE_LOCALITIES[user.assignedState]?.localities || []) : [];
                        return (
                            <tr key={user.id}>
                                <td>{index + 1}</td>
                                <td>{user.displayName || 'N/A'}</td>
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

    const renderUsageTab = () => {
        const formatTimestamp = (timestamp) => {
            if (!timestamp) return 'N/A';
            return new Date(timestamp.seconds * 1000).toLocaleString();
        };

        return (
            <Card>
                <h3 className="text-lg font-medium mb-4">Resource Usage Tracking (All Users)</h3>
                <p className="text-sm text-gray-600 mb-6">
                    This table shows the total read/write operations and an approximation of active time in the app.
                    Active time is counted in 1-minute intervals as long as the user has database activity within a 5-minute window.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                        <div className="text-sm font-medium text-green-700">Total System Reads</div>
                        <div className="text-3xl font-bold text-green-900">{aggregates.totalReads.toLocaleString()}</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
                        <div className="text-sm font-medium text-yellow-700">Total System Writes</div>
                        <div className="text-3xl font-bold text-yellow-900">{aggregates.totalWrites.toLocaleString()}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
                        <div className="text-sm font-medium text-blue-700">Mean Active Duration</div>
                        <div className="text-3xl font-bold text-blue-900">{formatDuration(aggregates.meanDurationMs)}</div>
                        <div className="text-xs text-gray-500">Total: {formatDuration(aggregates.totalDurationMs)}</div>
                    </div>
                </div>

                <Table 
                    headers={[
                        'User Email',
                        'Total Reads',
                        'Total Writes',
                        'Total Active Duration',
                        'Last Updated'
                    ]}
                >
                    {usageStats.map((stat) => (
                        <tr key={stat.id}>
                            <td>{stat.email || 'N/A'}</td>
                            <td className="font-mono">{stat.totalReads ? stat.totalReads.toLocaleString() : 0}</td>
                            <td className="font-mono">{stat.totalWrites ? stat.totalWrites.toLocaleString() : 0}</td>
                            <td>{formatDuration(stat.totalActiveDurationMs)}</td>
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
    };

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
            {activeTab === 'approvals' && <CertificateApprovalsTab setToast={setToast} />}

        </div>
    );
}

export default AdminDashboard;