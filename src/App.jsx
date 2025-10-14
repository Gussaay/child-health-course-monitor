// App.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);

import DashboardView from './components/DashboardView';
import { FacilitatorsView, FacilitatorReportView, FacilitatorForm, FacilitatorApplicationForm } from './components/Facilitator';
import { CourseManagementView, CourseForm } from './components/Course.jsx';
import { CourseReportView } from './components/CourseReportView.jsx';
import { ShareModal } from './components/ShareModal';
import { FinalReportForm } from './components/FinalReportForm.jsx';
import { ObservationView } from './components/MonitoringView';
import { ReportsView } from './components/ReportsView';
import { AdminDashboard } from './components/AdminDashboard';
import { HumanResourcesPage } from './components/HumanResources';
import { ProgramTeamView, TeamMemberApplicationForm } from './components/ProgramTeamView';
import { ParticipantsView, ParticipantForm, ParticipantMigrationMappingView } from './components/Participants';
import { ParticipantReportView } from './components/ParticipantReport';
import ChildHealthServicesView from './components/ChildHealthServicesView.jsx';
import {
    PublicFacilityUpdateForm,
    NewFacilityEntryForm,
    GenericFacilityForm,
    IMNCIFormFields
} from './components/FacilityForms.jsx';


import {
    listCoursesByType,
    upsertCourse,
    deleteCourse,
    listParticipants,
    deleteParticipant,
    listObservationsForParticipant,
    listCasesForParticipant,
    upsertCaseAndObservations,
    deleteCaseAndObservations,
    listAllDataForCourse,
    upsertFacilitator,
    listFacilitators,
    deleteFacilitator,
    listAllCourses,
    listAllParticipants,
    importParticipants,
    upsertCoordinator,
    listCoordinators,
    upsertStateCoordinator,
    listStateCoordinators,
    deleteStateCoordinator,
    listFederalCoordinators,
    listLocalityCoordinators,
    upsertFunder,
    listFunders,
    upsertFinalReport,
    getFinalReportByCourseId,
    uploadFile,
    deleteFile,
    getPublicCourseReportData,
    updateCourseSharingSettings,
    getCourseById,
    updateCoursePublicStatus,
    getParticipantById,
    updateParticipantSharingSettings,
    listPendingFacilitatorSubmissions,
    approveFacilitatorSubmission,
    rejectFacilitatorSubmission,
    upsertHealthFacility,
    getHealthFacilityById,
    submitFacilityDataForApproval,
    saveParticipantAndSubmitFacilityUpdate,
    bulkMigrateFromMappings,
    listHealthFacilities,
} from './data.js';
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_ETAT, JOB_TITLES_EENC, JOB_TITLES_IMNCI,
    SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING,
    EENC_DOMAINS_BREATHING, EENC_DOMAINS_NOT_BREATHING, SKILLS_ETAT, ETAT_DOMAIN_LABEL, ETAT_DOMAINS,
    CLASS_2_59M, CLASS_0_59D, DOMAINS_BY_AGE_IMNCI, DOMAIN_LABEL_IMNCI, getClassListImnci,
    calcPct, fmtPct, pctBgClass, formatAsPercentageAndCount, formatAsPercentageAndScore
} from './components/constants.js';
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Textarea, Table,
    EmptyState, Spinner, PdfIcon, CourseIcon, Footer, Modal, Toast
} from './components/CommonComponents';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// --- VIEW COMPONENTS ---
function Landing({ active, onPick }) {
    const items = [
        { key: 'IMNCI', title: 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)', enabled: true },
        { key: 'ETAT', title: 'Emergency Triage, Assessment & Treatment (ETAT)', enabled: true },
        { key: 'EENC', title: 'Early Essential Newborn Care (EENC)', enabled: true },
        { key: 'IPC', title: 'Infection Prevention & Control (Neonatal Unit)', enabled: true },
        { key: 'Small & Sick Newborn', title: 'Small & Sick Newborn Case Management', enabled: true },
    ];

    return (
        <Card className="p-6">
            <PageHeader title="Select a Course Package" subtitle="Choose a monitoring package to begin." />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(it => (
                    <button key={it.key} disabled={!it.enabled} className={`border rounded-lg p-6 text-left transition-all duration-200 ${active === it.key ? 'ring-2 ring-sky-500 shadow-lg' : ''} ${it.enabled ? 'hover:shadow-md hover:scale-105' : 'opacity-60 cursor-not-allowed bg-gray-50'}`} onClick={() => it.enabled && onPick(it.key)}>
                        <div className="flex items-center gap-4">
                            {(it.key === 'IPC' || it.key === 'Small & Sick Newborn')
                                ? <HospitalIcon className="w-10 h-10 text-slate-500 flex-shrink-0" />
                                : <CourseIcon course={it.key} />
                            }
                            <div>
                                <div className="font-semibold text-gray-800">{it.title}</div>
                                <div className="text-xs text-gray-500 mt-1">{it.enabled ? 'Click to manage courses' : 'Coming Soon'}</div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </Card>
    );
}

// --- Mobile Navigation Icons & Components ---
const HomeIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
const CoursesIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
const UsersIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
const MonitorIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
const ReportIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>
const FacilitatorIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
const AdminIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
const HospitalIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v2.85c-.9.17-1.72.6-2.43 1.24L4.3 11.2a1 1 0 0 0-.2 1.39l.2.2c.45.6.84 1.34 1.36 2.14L6 15l2.43-1.6c.71-.48 1.54-.74 2.43-.84V14a1 1 0 0 0 1 1h2c.7 0 1.25-.56 1.25-1.25S15.7 12.5 15 12.5V11a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v1.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V9.85c-.9-.1-1.72-.36-2.43-.84L4.3 7.8a1 1 0 0 0-.2-1.39l.2-.2c.45-.6.84-1.34 1.36-2.14L6 3l2.43 1.6c.71.48 1.54.74 2.43.84V5a3 3 0 0 0-3-3zM12 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2zM18 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2z"></path><path d="M12 18.5V22"></path><path d="M12 11h-2"></path><path d="M14 11h2"></path><path d="M18 11h2"></path></svg>


function BottomNav({ navItems, navigate }) {
    const icons = {
        Dashboard: HomeIcon,
        Home: HomeIcon,
        Courses: CoursesIcon,
        'Human Resources': UsersIcon,
        'Child Health Services': HospitalIcon,
        Participants: UsersIcon,
        Monitoring: MonitorIcon,
        Reports: ReportIcon,
        Admin: AdminIcon,
    };
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around items-center z-20">
            {navItems.map(item => {
                const Icon = icons[item.label];
                return (
                    <button
                        key={item.label}
                        onClick={() => !item.disabled && navigate(item.view)}
                        disabled={item.disabled}
                        className={`flex flex-col items-center justify-center p-2 w-full h-16 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${item.active ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        {Icon && <Icon className="w-6 h-6 mb-1" />}
                        <span>{item.label}</span>
                    </button>
                )
            })}
        </nav>
    );
}

// --- New Splash Screen Component ---
function SplashScreen() {
    return (
        <div className="fixed inset-0 bg-sky-50 flex flex-col items-center justify-center gap-6 text-center p-4">
            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center p-1 shadow-xl animate-pulse">
                <img src="/child.png" alt="NCHP Logo" className="h-20 w-20 object-contain" />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-slate-800">National Child Health Program</h1>
                <p className="text-lg text-slate-500 mt-1">Course Monitoring System</p>
            </div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mt-4"></div>
            <p className="text-slate-600 mt-4">Loading application, please wait...</p>
        </div>
    );
}

// =============================================================================
// Root App Component
// =============================================================================
export default function App() {
    // --- App State ---
    const [view, setView] = useState("dashboard");
    const [activeCourseType, setActiveCourseType] = useState("IMNCI");
    const [courses, setCourses] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [facilitators, setFacilitators] = useState([]);
    const [coordinators, setCoordinators] = useState([]);
    const [funders, setFunders] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState(null);
    const [selectedParticipantId, setSelectedParticipantId] = useState(null);
    const [selectedFacilitatorId, setSelectedFacilitatorId] = useState(null);
    const [editingCourse, setEditingCourse] = useState(null);
    const [editingParticipant, setEditingParticipant] = useState(null);
    const [editingFacilitator, setEditingFacilitator] = useState(null);
    const [editingCaseFromReport, setEditingCaseFromReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [previousView, setPreviousView] = useState("dashboard");
    const [allParticipants, setAllParticipants] = useState([]);
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userPermissions, setUserPermissions] = useState({});
    const [userStates, setUserStates] = useState([]);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    const [activeCoursesTab, setActiveCoursesTab] = useState('courses');
    const [activeHRTab, setActiveHRTab] = useState('facilitators');
    const [courseDataForReport, setCourseDataForReport] = useState({ participants: [], allObs: [], allCases: [] });
    const [finalReportCourse, setFinalReportCourse] = useState(null);
    const [finalReportData, setFinalReportData] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);
    const [federalCoordinators, setFederalCoordinators] = useState([]);
    const [stateCoordinators, setStateCoordinators] = useState([]);
    const [localityCoordinators, setLocalityCoordinators] = useState([]);

    // --- State for Shared View ---
    const [isSharedView, setIsSharedView] = useState(false);
    const [isPublicSubmissionView, setIsPublicSubmissionView] = useState(false);
    const [isNewFacilityView, setIsNewFacilityView] = useState(false);
    const [isPublicFacilityUpdateView, setIsPublicFacilityUpdateView] = useState(false);
    const [submissionType, setSubmissionType] = useState(null);
    const [sharedReportData, setSharedReportData] = useState(null);
    const [sharedViewError, setSharedViewError] = useState(null);
    const [sharedViewRequiresLogin, setSharedViewRequiresLogin] = useState(false);
    
    // --- State for Share Modal ---
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [itemToShare, setItemToShare] = useState(null);
    const [shareType, setShareType] = useState('course');

    // --- Refs for Browser History Management ---
    const historyInitialized = useRef(false);
    const isPopStateNavigation = useRef(false);
    
    // --- Check for Shared URL on Initial Load ---
    useEffect(() => {
        const path = window.location.pathname;
        const sharedMatch = path.match(/^\/shared\/(course-report|participant-report)\/([a-zA-Z0-9]+)\/?$/);
        const submissionMatch = path.match(/^\/public\/(facilitator-application|team-member-application)\/?$/);
        const unifiedTeamMemberSubmissionMatch = path === '/public/team-member-application';
        const newFacilityMatch = path.match(/^\/facilities\/data-entry\/new\/?$/);
        const updateFacilityMatch = path.match(/^\/facilities\/data-entry\/([a-zA-Z0-9]+)\/?$/);

        if (newFacilityMatch) {
            setIsNewFacilityView(true);
            setLoading(false);
            setAuthLoading(false);
            return;
        }

        if (updateFacilityMatch && updateFacilityMatch[1]) {
            setIsPublicFacilityUpdateView(true);
            setLoading(false);
            setAuthLoading(false);
            return;
        }

        if (submissionMatch || unifiedTeamMemberSubmissionMatch) {
            setIsPublicSubmissionView(true);
            setSubmissionType(submissionMatch ? submissionMatch[1] : 'team-member-application');
            setLoading(false);
            setAuthLoading(false);
            return;
        }

        const handleSharedRoute = async (reportType, reportId) => {
            setIsSharedView(true);
            setLoading(true);
            setSharedViewRequiresLogin(false);
            setSharedViewError(null);

            try {
                if (reportType === 'course-report') {
                    const course = await getCourseById(reportId);
                    if (!course) throw new Error("Report not found.");

                    setSharedReportData({ type: 'course', course });

                    if (course.isPublic) {
                        const [participants, { allObs, allCases }] = await Promise.all([
                            listParticipants(reportId),
                            listAllDataForCourse(reportId)
                        ]);
                        const finalReport = await getFinalReportByCourseId(reportId);
                        setSharedReportData({ type: 'course', course, participants, allObs, allCases, finalReport, hasFullAccess: true });
                    } else if (course.sharedWith?.length > 0) {
                        setSharedViewRequiresLogin(true);
                    } else {
                        throw new Error("This report is private and cannot be viewed.");
                    }
                } else if (reportType === 'participant-report') {
                    const participant = await getParticipantById(reportId);
                    if (!participant) throw new Error("Participant report not found.");
                    
                    const course = await getParticipantById(participant.courseId);
                    if (!course) throw new Error("Associated course data not found.");

                    setSharedReportData({ type: 'participant', participant, course });

                    if (participant.isPublic) {
                        const [observations, cases, participantsInCourse] = await Promise.all([
                            listObservationsForParticipant(participant.courseId, participant.id),
                            listCasesForParticipant(participant.courseId, participant.id),
                            listParticipants(participant.courseId)
                        ]);
                        setSharedReportData({ type: 'participant', participant, course, observations, cases, participantsInCourse, hasFullAccess: true });
                    } else if (participant.sharedWith?.length > 0) {
                        setSharedViewRequiresLogin(true);
                    } else {
                        throw new Error("This report is private and cannot be viewed.");
                    }
                }
            } catch (err) {
                console.error("Shared view error:", err);
                setSharedViewError(err.message);
            } finally {
                setLoading(false);
                setAuthLoading(false);
            }
        };

        if (sharedMatch) {
            handleSharedRoute(sharedMatch[1], sharedMatch[2]);
        }
    }, []);


    const ALL_PERMISSIONS = useMemo(() => ({
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
        canApproveSubmissions: false,
        canManageHealthFacilities: false,
    }), []);

    const DEFAULT_ROLE_PERMISSIONS = useMemo(() => ({
        'super_user': {
            ...ALL_PERMISSIONS,
            canViewDashboard: true,
            canViewCourse: true,
            canAddCourse: true,
            canEditDeleteActiveCourse: true,
            canEditDeleteInactiveCourse: true,
            canBulkUploadParticipant: true,
            canViewFacilitators: true,
            canViewAdmin: true,
            canViewLanding: true,
            canViewDetailedData: true,
            canAddParticipant: true,
            canEditDeleteParticipant: true,
            canAddMonitoring: true,
            canEditDeleteMonitoring: true,
            canAddFinalReport: true,
            canEditDeleteFinalReport: true,
            canApproveSubmissions: true,
            canManageHealthFacilities: true,
        },
        'federal_manager': {
            ...ALL_PERMISSIONS,
            canViewDashboard: true,
            canViewCourse: true,
            canAddCourse: true,
            canEditDeleteActiveCourse: true,
            canEditDeleteInactiveCourse: true,
            canBulkUploadParticipant: true,
            canViewFacilitators: true,
            canViewDetailedData: true,
            canAddParticipant: true,
            canEditDeleteParticipant: true,
            canAddMonitoring: true,
            canEditDeleteMonitoring: true,
            canAddFinalReport: true,
            canEditDeleteFinalReport: true,
            canApproveSubmissions: true,
            canManageHealthFacilities: true,
        },
        'states_manager': {
            ...ALL_PERMISSIONS,
            canViewDashboard: true,
            canViewCourse: true,
            canViewFacilitators: true,
            canViewLanding: true,
            canViewDetailedData: true,
            canAddParticipant: true,
            canEditDeleteParticipant: true,
            canAddMonitoring: true,
            canEditDeleteMonitoring: true,
            canAddFinalReport: true,
            canEditDeleteFinalReport: true,
            canManageHealthFacilities: true,
        },
        'user': { 
            ...ALL_PERMISSIONS, 
            canViewDashboard: true, 
            canViewLanding: true, 
            canViewFacilitators: false, 
            canViewDetailedData: false 
        },
    }), [ALL_PERMISSIONS]);

    const permissions = useMemo(() => {
        let derivedPermissions = { ...userPermissions };

        if (userRole?.toLowerCase() === 'super_user') {
            return Object.keys(ALL_PERMISSIONS).reduce((acc, key) => ({ ...acc, [key]: true }), {});
        }

        if (derivedPermissions.canViewCourse) {
            derivedPermissions = {
                ...derivedPermissions,
                canAddCourse: true,
                canEditDeleteActiveCourse: true,
                canAddParticipant: true,
                canEditDeleteParticipant: true,
                canAddMonitoring: true,
                canEditDeleteMonitoring: true,
                canAddFinalReport: true,
                canEditDeleteFinalReport: true,
            };
        }

        return derivedPermissions;
    }, [userRole, userPermissions, ALL_PERMISSIONS]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (isSharedView) {
                if (sharedViewRequiresLogin && sharedReportData) {
                    const item = sharedReportData.type === 'course' ? sharedReportData.course : sharedReportData.participant;
                    if (user && item?.sharedWith?.includes(user.email)) {
                        if (sharedReportData.type === 'course') {
                            const [participants, { allObs, allCases }] = await Promise.all([
                                listParticipants(item.id),
                                listAllDataForCourse(item.id)
                            ]);
                            const finalReport = await getFinalReportByCourseId(item.id);
                            setSharedReportData(prev => ({ ...prev, participants, allObs, allCases, finalReport, hasFullAccess: true }));
                        } else { // participant
                            const p = item;
                            const [observations, cases, participantsInCourse] = await Promise.all([
                                listObservationsForParticipant(p.courseId, p.id),
                                listCasesForParticipant(p.courseId, p.id),
                                listParticipants(p.courseId)
                            ]);
                            setSharedReportData(prev => ({ ...prev, observations, cases, participantsInCourse, hasFullAccess: true }));
                        }
                    } else {
                        setSharedReportData(prev => ({ ...prev, hasFullAccess: false }));
                    }
                }
                setAuthLoading(false);
                return;
            }
            
            const checkUserRoleAndPermissions = async (user) => {
                if (user) {
                    try {
                        const userRef = doc(db, "users", user.uid);
                        const userSnap = await getDoc(userRef);
                        let role;
                        let permissionsData = {};
                        let assignedState = '';

                        if (!userSnap.exists() || !userSnap.data().role) {
                            role = 'user';
                            permissionsData = DEFAULT_ROLE_PERMISSIONS.user;
                            await setDoc(userRef, {
                                email: user.email,
                                role: role,
                                permissions: permissionsData,
                                lastLogin: new Date(),
                                assignedState: ''
                            }, { merge: true });
                        } else {
                            role = userSnap.data().role;
                            permissionsData = userSnap.data().permissions || DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
                            permissionsData = { ...ALL_PERMISSIONS, ...permissionsData };
                            assignedState = userSnap.data().assignedState || '';
                        }
                        setUserRole(role);
                        setUserPermissions(permissionsData);
                        setUserStates(assignedState ? [assignedState] : []);
                    } catch (error) {
                        console.error("Error checking user role and permissions:", error);
                        setUserRole('user');
                        setUserPermissions(DEFAULT_ROLE_PERMISSIONS.user);
                        setUserStates([]);
                    }
                } else {
                    setUser(null);
                    setUserRole(null);
                    setUserPermissions({});
                    setUserStates([]);
                }
            };

            if (user) {
                setUser(user);
                await checkUserRoleAndPermissions(user);
                setAuthLoading(false);
            } else {
                setUser(null);
                setUserRole(null);
                setUserPermissions({});
                setUserStates([]);
                setAuthLoading(false);
            }
        });

        return () => unsubscribe();
    }, [isSharedView, sharedViewRequiresLogin, sharedReportData?.course, DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS]);

    // --- Browser History Management ---
    useEffect(() => {
        const handlePopState = (event) => {
            if (event.state) {
                isPopStateNavigation.current = true;
                setView(event.state.view || 'dashboard');
                setActiveCourseType(event.state.activeCourseType || 'IMNCI');
                setSelectedCourseId(event.state.selectedCourseId || null);
                setSelectedParticipantId(event.state.selectedParticipantId || null);
                setPreviousView(event.state.previousView || 'dashboard');
                setActiveCoursesTab(event.state.activeCoursesTab || null);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        if (authLoading || isSharedView) {
            return;
        }

        const stateToSave = {
            view,
            activeCourseType,
            selectedCourseId,
            selectedParticipantId,
            previousView,
            activeCoursesTab,
        };

        if (isPopStateNavigation.current) {
            isPopStateNavigation.current = false;
            return;
        }

        if (!historyInitialized.current) {
            window.history.replaceState(stateToSave, '');
            historyInitialized.current = true;
        } else {
            if (JSON.stringify(stateToSave) !== JSON.stringify(window.history.state)) {
                window.history.pushState(stateToSave, '');
            }
        }

    }, [authLoading, isSharedView, view, activeCourseType, selectedCourseId, selectedParticipantId, previousView, activeCoursesTab]);


    // --- Data Fetching Functions ---
    async function refreshAllData(userStates) {
        setLoading(true);
        try {
            const [
                coursesData,
                facilitatorsData,
                coordinatorsData,
                fundersData,
                allParticipantsData,
                federalCoordsData,
                stateCoordsData,
                localityCoordsData
            ] = await Promise.all([
                listAllCourses(userStates),
                listFacilitators(userStates),
                listCoordinators(),
                listFunders(),
                listAllParticipants(userStates),
                listFederalCoordinators(),
                listStateCoordinators(),
                listLocalityCoordinators()
            ]);
            
            const courseMap = new Map(coursesData.map(c => [c.id, c]));
            const participantsWithCourseInfo = allParticipantsData.map(p => {
                const course = courseMap.get(p.courseId);
                return {
                    ...p,
                    course_type: course?.course_type,
                    state: course?.state,
                    locality: course?.locality,
                };
            });

            setAllCourses(coursesData);
            setAllParticipants(participantsWithCourseInfo);
            setFacilitators(facilitatorsData);
            setCoordinators(coordinatorsData);
            setFunders(fundersData);
            setCourses(coursesData.filter(c => c.course_type === activeCourseType));
            setFederalCoordinators(federalCoordsData);
            setStateCoordinators(stateCoordsData);
            setLocalityCoordinators(localityCoordsData);
        } catch (error) {
            console.error("Error refreshing all data:", error);
        } finally {
            setLoading(false);
        }
    }
    
    async function refreshParticipants() {
        if (!selectedCourseId) { setParticipants([]); return; }
        setLoading(true);
        try {
            const list = await listParticipants(selectedCourseId, userStates);
            setParticipants(list);
        } catch (error) {
            console.error("Error refreshing participants:", error);
        } finally {
            setLoading(false);
        }
    }
    
    const fetchCourseReportData = async (courseId) => {
        setLoading(true);
        try {
            const [pData, { allObs, allCases }, finalReport] = await Promise.all([
                listParticipants(courseId),
                listAllDataForCourse(courseId),
                getFinalReportByCourseId(courseId)
            ]);
            setCourseDataForReport({ participants: pData, allObs, allCases });
            setFinalReportData(finalReport);
        } catch (error) {
            console.error("Error fetching course report data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingSubmissions = async () => {
        if (!permissions.canApproveSubmissions) return;
        setIsSubmissionsLoading(true);
        try {
            const submissions = await listPendingFacilitatorSubmissions();
            setPendingSubmissions(submissions);
        } catch (error) {
            console.error("Error fetching submissions:", error);
            setToast({ show: true, message: 'Failed to load submissions.', type: 'error' });
        } finally {
            setIsSubmissionsLoading(false);
        }
    };

    const handleApproveSubmission = async (submission) => {
        if (window.confirm(`Approve ${submission.name}? This will add them to the main facilitator list.`)) {
            try {
                await approveFacilitatorSubmission(submission, user.email);
                setToast({ show: true, message: 'Facilitator approved and added.', type: 'success' });
                await fetchPendingSubmissions();
                await refreshAllData(userStates);
            } catch (error) {
                setToast({ show: true, message: 'Approval failed: ' + error.message, type: 'error' });
            }
        }
    };

    const handleRejectSubmission = async (submissionId) => {
        if (window.confirm('Are you sure you want to reject this submission? This cannot be undone.')) {
            try {
                await rejectFacilitatorSubmission(submissionId, user.email);
                setToast({ show: true, message: 'Submission rejected.', type: 'success' });
                await fetchPendingSubmissions();
            } catch (error) {
                setToast({ show: true, message: 'Rejection failed: ' + error.message, type: 'error' });
            }
        }
    };

    useEffect(() => {
        if (user && !isSharedView) {
            refreshAllData(userStates);
        }
    }, [user, userStates, isSharedView]);

    useEffect(() => {
        setCourses(allCourses.filter(c => c.course_type === activeCourseType));
    }, [activeCourseType, allCourses]);

    useEffect(() => { refreshParticipants(); }, [selectedCourseId, userStates]);

    useEffect(() => {
        if (selectedCourseId && view === 'courseReport') {
            fetchCourseReportData(selectedCourseId);
        }
    }, [selectedCourseId, view]);

    useEffect(() => {
        if (view === 'humanResources' && activeHRTab === 'facilitators' && permissions.canApproveSubmissions) {
            fetchPendingSubmissions();
        }
    }, [view, activeHRTab, permissions.canApproveSubmissions]);

    // --- Memoized Selectors and Handlers ---
    const selectedCourse = useMemo(() => {
        return allCourses.find(c => c.id === selectedCourseId) || null;
    }, [allCourses, selectedCourseId]);
    const selectedFacilitator = useMemo(() => facilitators.find(f => f.id === selectedFacilitatorId) || null, [facilitators, selectedFacilitatorId]);

    // --- Share Modal Handlers ---
    const handleShare = (item, type) => {
        setItemToShare(item);
        setShareType(type);
        setIsShareModalOpen(true);
    };

    const handleSaveSharingSettings = async (itemId, settings) => {
        try {
            if (shareType === 'course') {
                await updateCourseSharingSettings(itemId, settings);
            } else if (shareType === 'participant') {
                await updateParticipantSharingSettings(itemId, settings);
            }
            await refreshAllData(userStates);
            setToast({ show: true, message: "Sharing settings updated successfully.", type: "success" });
        } catch (error) {
            console.error("Error saving sharing settings:", error);
            setToast({ show: true, message: "Failed to update sharing settings.", type: "error" });
        }
    };

    const handleDeleteCourse = async (courseId) => {
        if (!permissions.canEditDeleteActiveCourse && !permissions.canEditDeleteInactiveCourse) {
            alert("You do not have permission to delete courses.");
            return;
        }
        if (window.confirm('Are you sure you want to delete this course and all its data? This cannot be undone.')) {
            await deleteCourse(courseId);
            await refreshAllData();
            if (selectedCourseId === courseId) {
                setSelectedCourseId(null);
                setSelectedParticipantId(null);
                navigate('courses');
            }
        }
    };
    const handleDeleteParticipant = async (participantId) => {
        if (!permissions.canEditDeleteParticipant) {
            alert("You do not have permission to delete participants.");
            return;
        }
        if (window.confirm('Are you sure you want to delete this participant and all their data?')) {
            await deleteParticipant(participantId);
            await refreshParticipants();
            if (selectedParticipantId === participantId) {
                setSelectedParticipantId(null);
                navigate('participants');
            }
        }
    };
    const handleDeleteFacilitator = async (facilitatorId) => {
        if (!permissions.canEditDeleteFacilitator) {
            alert("You do not have permission to delete facilitators.");
            return;
        }
        if (window.confirm('Are you sure you want to delete this facilitator?')) {
            await deleteFacilitator(facilitatorId);
            await refreshAllData();
            navigate('humanResources');
        }
    };

    const handleImportParticipants = async ({ participantsToImport, facilitiesToUpsert }) => {
        if (!permissions.canBulkUploadParticipant) {
            alert("You do not have permission to import participants.");
            return;
        }
        try {
            setLoading(true);
            if (facilitiesToUpsert && facilitiesToUpsert.length > 0) {
                const submissionPromises = facilitiesToUpsert.map(facility => submitFacilityDataForApproval(facility));
                await Promise.all(submissionPromises);
                setToast({ show: true, message: `Submitted ${facilitiesToUpsert.length} facility updates for approval.`, type: 'info' });
            }
    
            const participantsWithCourseId = participantsToImport.map(p => ({
                ...p,
                courseId: selectedCourse.id
            }));
            
            await importParticipants(participantsWithCourseId);
            await refreshParticipants();
            setToast({ show: true, message: `Successfully imported ${participantsToImport.length} participants.`, type: 'success' });
        } catch (error) {
            console.error("Error importing participants and facilities:", error);
            setToast({ show: true, message: "Error during import: " + error.message, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    // --- Bulk Migration Handlers ---
    const handleBulkMigrate = (courseId) => {
        navigate('participantMigration', { courseId });
    };

    const handleExecuteBulkMigration = async (mappings) => {
        setLoading(true);
        try {
            const result = await bulkMigrateFromMappings(mappings, { dryRun: false });
            setToast({
                show: true,
                message: `Migration submitted! Processed: ${result.totalProcessed}, Submitted: ${result.submitted}, Skipped: ${result.skipped}, Errors: ${result.errors}.`,
                type: result.errors > 0 ? 'warning' : 'success'
            });
            navigate('participants');
        } catch (error) {
            setToast({
                show: true,
                message: `Migration failed: ${error.message}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddNewCoordinator = async (coordinatorData) => {
        try {
            await upsertCoordinator(coordinatorData);
            setToast({ show: true, message: `Coordinator '${coordinatorData.name}' added.`, type: 'success' });
            await refreshAllData(userStates);
        } catch (error) {
                console.error("Error adding new coordinator:", error);
            setToast({ show: true, message: "Failed to add new coordinator.", type: 'error' });
        }
    };

    const handleAddNewFunder = async (funderData) => {
        try {
            await upsertFunder(funderData);
            setToast({ show: true, message: `Funder '${funderData.orgName}' added.`, type: 'success' });
            await refreshAllData(userStates);
        } catch (error) {
            console.error("Error adding new funder:", error);
            setToast({ show: true, message: "Failed to add new funder.", type: 'error' });
        }
    };

    const handleAddFinalReport = async (courseId) => {
        if (!permissions.canAddFinalReport) {
            alert("You do not have permission to add final reports.");
            return;
        }
        const courseToReport = allCourses.find(c => c.id === courseId);
        if (!courseToReport) return;

        setFinalReportCourse(courseToReport);
        setSelectedCourseId(courseId);

        const existingReport = await getFinalReportByCourseId(courseId);

        if (existingReport) {
            setFinalReportData(existingReport);
            setView('finalReportView');
            setToast({ show: true, message: "Displaying existing final report.", type: 'info' });
        } else {
            setView('finalReportForm');
        }
    };
    
    const handleSaveFinalReport = async (reportData) => {
        if (!permissions.canAddFinalReport && !permissions.canEditDeleteFinalReport) {
            alert("You do not have permission to save or update final reports.");
            return;
        }
        try {
            let pdfUrl = reportData.existingPdfUrl;

            if (reportData.pdfFile) {
                pdfUrl = await uploadFile(reportData.pdfFile);
                if (reportData.existingPdfUrl) {
                    await deleteFile(reportData.existingPdfUrl);
                }
            } else if (reportData.existingPdfUrl === null && reportData.id) {
                const existingReport = await getFinalReportByCourseId(reportData.courseId);
                if (existingReport && existingReport.pdfUrl) {
                    await deleteFile(existingReport.pdfUrl);
                }
                pdfUrl = null;
            }

            const payload = {
                courseId: reportData.courseId,
                summary: reportData.summary,
                recommendations: reportData.recommendations,
                potentialFacilitators: reportData.potentialFacilitators,
                pdfUrl: pdfUrl,
            };

            if (reportData.id) {
                payload.id = reportData.id;
            }
            
            await upsertFinalReport(payload);

            setFinalReportCourse(null);
            setView('courses');
            setToast({ show: true, message: "Final report saved successfully!", type: 'success' });
        } catch (error) {
            console.error("Error saving final report:", error);
            setToast({ show: true, message: "Failed to save final report: " + error.message, type: 'error' });
        }
    };
    
    const handleEditFinalReport = async (courseId) => {
        if (!permissions.canEditDeleteFinalReport) {
            alert("You do not have permission to edit final reports.");
            return;
        }
        const courseToEdit = allCourses.find(c => c.id === courseId);
        if (!courseToEdit) return;

        setFinalReportCourse(courseToEdit);
        setSelectedCourseId(courseId);

        const existingReport = await getFinalReportByCourseId(courseId);
        setFinalReportData(existingReport);

        setView('finalReportForm');
    };

    const handleDeletePdf = async (courseId) => {
        if (!permissions.canEditDeleteFinalReport) {
            alert("You do not have permission to delete the PDF from final reports.");
            return;
        }
        if (window.confirm('Are you sure you want to delete the PDF from this report? This action cannot be undone.')) {
            try {
                if (finalReportData?.pdfUrl) {
                    await deleteFile(finalReportData.pdfUrl);
                }
                const updatedPayload = {
                    id: finalReportData.id,
                    courseId: courseId,
                    summary: finalReportData.summary,
                    recommendations: finalReportData.recommendations,
                    potentialFacilitators: finalReportData.potentialFacilitators,
                    pdfUrl: null
                };
                await upsertFinalReport(updatedPayload);
                setFinalReportData(prev => ({ ...prev, pdfUrl: null }));
                setToast({ show: true, message: "PDF deleted successfully.", type: "success" });
            } catch (error) {
                console.error("Error deleting PDF:", error);
                setToast({ show: true, message: "Failed to delete PDF.", type: "error" });
            }
        }
    };

    const navigate = (newView, state = {}) => {
        setPreviousView(view);
        setEditingCourse(null);
        setEditingParticipant(null);
        setEditingFacilitator(null);
        setEditingCaseFromReport(null);
        
        if (state.courseId && state.courseId !== selectedCourseId) {
            setSelectedCourseId(state.courseId);
        }
        if (state.participantId && state.participantId !== selectedParticipantId) {
            setSelectedParticipantId(state.participantId);
        }
        
        const viewPermissions = {
            'dashboard': permissions.canViewDashboard,
            'admin': permissions.canViewAdmin,
            'landing': permissions.canViewLanding,
            'humanResources': permissions.canViewFacilitators || userRole === 'states_manager' || userRole === 'federal_manager' || userRole === 'super_user',
            'courses': permissions.canViewCourse,
            'participants': permissions.canViewCourse,
            'observe': permissions.canAddMonitoring,
            'monitoring': permissions.canAddMonitoring,
            'reports': permissions.canViewCourse,
            'courseForm': permissions.canAddCourse,
            'participantForm': permissions.canAddParticipant || permissions.canEditDeleteParticipant,
            'facilitatorForm': permissions.canViewFacilitators,
            'courseReport': permissions.canViewCourse,
            'participantReport': permissions.canViewCourse,
            'facilitatorReport': permissions.canViewFacilitators,
            'finalReportForm': permissions.canAddFinalReport || permissions.canEditDeleteFinalReport,
            'finalReportView': permissions.canViewCourse,
            'participantMigration': permissions.canBulkUploadParticipant,
            'childHealthServices': permissions.canManageHealthFacilities,
        };
    
        if (user && !viewPermissions[newView] && !['facilitators', 'programTeams', 'partnersPage'].includes(newView)) {
            console.log(`Access denied to view: ${newView} for role: ${userRole}`);
            setToast({ show: true, message: `Access denied to view: ${newView}`, type: 'error' });
            return;
        }
        
        const courseSubTabs = ['participants', 'reports'];
        const hrSubTabs = ['facilitators', 'programTeams', 'partnersPage'];

        if (hrSubTabs.includes(newView)) {
            setActiveHRTab(newView);
            setView('humanResources');
        } else if (['courses', ...courseSubTabs].includes(newView)) {
            setActiveCoursesTab(newView);
            setView('courses');
        } else {
            setActiveCoursesTab(null);
            setView(newView);
        }
        
        if (state.editCourse) setEditingCourse(state.editCourse);
        if (state.editParticipant) setEditingParticipant(state.editParticipant);
        if (state.editFacilitator) setEditingFacilitator(state.editFacilitator);
        if (state.openFacilitatorReport) setSelectedFacilitatorId(state.openFacilitatorReport);
        if (state.openCourseReport) setSelectedCourseId(state.openCourseReport);
        if (state.openParticipantReport) {
            setSelectedParticipantId(state.openParticipantReport);
            setSelectedCourseId(state.openCourseReport);
        }
        if (state.caseToEdit) setEditingCaseFromReport(state.caseToEdit);
    
        if (['landing', 'courses', 'humanResources', 'dashboard', 'admin'].includes(newView)) {
            setSelectedCourseId(null);
            setSelectedParticipantId(null);
            setFinalReportCourse(null);
            setFinalReportData(null);
        }
        if (view === 'observe' || view === 'participantReport') {
            if (newView !== 'observe' && newView !== 'participantReport') {
                setSelectedParticipantId(null);
            }
        }
    };
    
    const handleLogout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setUserRole(null);
            navigate('landing');
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const handleLoginForSharedView = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error during sign-in:", error);
            setSharedViewError("Could not sign in. Please try again.");
        }
    };
    
    const renderView = () => {
        const currentParticipant = allParticipants.find(p => p.id === selectedParticipantId);
        
        if (authLoading || (loading && view !== 'landing')) return <Card><Spinner /></Card>;
        
        const viewToRender = view;
        const viewPermissions = {
            'dashboard': permissions.canViewDashboard,
            'admin': permissions.canViewAdmin,
            'landing': permissions.canViewLanding,
            'humanResources': permissions.canViewFacilitators || userRole === 'states_manager' || userRole === 'federal_manager' || userRole === 'super_user',
            'courses': permissions.canViewCourse,
            'participants': permissions.canViewCourse,
            'observe': permissions.canAddMonitoring,
            'monitoring': permissions.canAddMonitoring,
            'reports': permissions.canViewCourse,
            'courseForm': permissions.canAddCourse,
            'participantForm': permissions.canAddParticipant || permissions.canEditDeleteParticipant,
            'facilitatorForm': permissions.canViewFacilitators,
            'courseReport': permissions.canViewCourse,
            'participantReport': permissions.canViewCourse,
            'facilitatorReport': permissions.canViewFacilitators,
            'finalReportForm': permissions.canAddFinalReport || permissions.canEditDeleteFinalReport,
            'finalReportView': permissions.canViewCourse,
            'participantMigration': permissions.canBulkUploadParticipant,
            'childHealthServices': permissions.canManageHealthFacilities,
        };

        if (user && !viewPermissions[viewToRender]) {
            return <div className="p-8 text-center text-red-500">Access Denied: You do not have permission to view this page.</div>;
        }

        if (view === 'finalReportForm') {
            if (!permissions.canAddFinalReport && !permissions.canEditDeleteFinalReport) {
                return <div className="p-8 text-center text-red-500">Access Denied: You do not have permission to add or edit final reports.</div>;
            }
            return (
                <FinalReportForm
                    course={finalReportCourse}
                    participants={participants} 
                    onCancel={() => navigate(previousView)}
                    onSave={handleSaveFinalReport}
                    initialData={finalReportData}
                />
            );
        }
        
        switch (view) {
            case 'landing': return <Landing active={activeCourseType} onPick={(t) => { setActiveCourseType(t); navigate('courses'); }} />;
            case 'humanResources': return <HumanResourcesPage 
                    activeTab={activeHRTab}
                    setActiveTab={setActiveHRTab}
                    facilitators={facilitators}
                    onAddFacilitator={() => navigate('facilitatorForm')}
                    onEditFacilitator={(f) => navigate('facilitatorForm', { editFacilitator: f })}
                    onDeleteFacilitator={handleDeleteFacilitator}
                    onOpenFacilitatorReport={(fid) => navigate('facilitatorReport', { openFacilitatorReport: fid })}
                    onOpenFacilitatorComparison={() => navigate('dashboard')}
                    onImportFacilitators={async (data) => { await importFacilitators(data); await refreshAllData(); }}
                    userStates={userStates}
                    pendingSubmissions={pendingSubmissions}
                    isSubmissionsLoading={isSubmissionsLoading}
                    onApproveSubmission={handleApproveSubmission}
                    onRejectSubmission={handleRejectSubmission}
                    permissions={permissions}
                />;
            case 'courses': 
                return <CourseManagementView 
                    courses={courses} 
                    onAdd={() => navigate('courseForm')} 
                    onOpen={(id) => { setSelectedCourseId(id); navigate('participants'); }} 
                    onEdit={(c) => navigate('courseForm', { editCourse: c })} 
                    onDelete={handleDeleteCourse} 
                    onOpenReport={(id) => { setSelectedCourseId(id); navigate('courseReport'); }} 
                    canAddCourse={permissions.canAddCourse}
                    canEditDeleteActiveCourse={permissions.canEditDeleteActiveCourse}
                    canEditDeleteInactiveCourse={permissions.canEditDeleteInactiveCourse}
                    userStates={userStates}
                    activeCoursesTab={activeCoursesTab}
                    setActiveCoursesTab={setActiveCoursesTab}
                    selectedCourse={selectedCourse}
                    participants={selectedCourseId ? allParticipants.filter(p => p.courseId === selectedCourseId) : []}
                    allParticipants={allParticipants}
                    onAddParticipant={() => navigate('participantForm')}
                    onEditParticipant={(p) => navigate('participantForm', { editParticipant: p })}
                    onDeleteParticipant={handleDeleteParticipant}
                    onOpenParticipantReport={(pid) => { setSelectedCourseId(selectedCourse.id); setSelectedParticipantId(pid); navigate('participantReport'); }}
                    onImportParticipants={handleImportParticipants}
                    onAddFinalReport={handleAddFinalReport}
                    onEditFinalReport={handleEditFinalReport}
                    selectedParticipantId={selectedParticipantId}
                    onSetSelectedParticipantId={setSelectedParticipantId}
                    onBulkMigrate={handleBulkMigrate}
                    onBatchUpdate={() => refreshAllData(userStates)}
                />;
            case 'participantMigration':
                return selectedCourse && (
                    <ParticipantMigrationMappingView
                        course={selectedCourse}
                        participants={participants}
                        onCancel={() => navigate('participants')}
                        onSave={handleExecuteBulkMigration}
                        setToast={setToast}
                    />
                );
            case 'childHealthServices':
                return permissions.canManageHealthFacilities ? (
                    <ChildHealthServicesView permissions={permissions} setToast={setToast} />
                ) : null;
            case 'monitoring':
            case 'observe':
                return permissions.canAddMonitoring ? (
                    selectedCourse && currentParticipant &&
                    <ObservationView
                        course={selectedCourse}
                        participant={currentParticipant}
                        participants={allParticipants.filter(p => p.courseId === selectedCourseId)}
                        onChangeParticipant={(id) => setSelectedParticipantId(id)}
                        initialCaseToEdit={editingCaseFromReport}
                    />
                ) : null;
            case 'courseForm': return permissions.canAddCourse || permissions.canEditDeleteActiveCourse || permissions.canEditDeleteInactiveCourse ? (
                <CourseForm 
                    courseType={activeCourseType} 
                    initialData={editingCourse} 
                    facilitatorsList={facilitators} 
                    onCancel={() => navigate(previousView)} 
                    onSave={async (payload) => { 
                        const id = await upsertCourse({ ...payload, id: editingCourse?.id, course_type: activeCourseType }); 
                        await refreshAllData(); 
                        setSelectedCourseId(id); 
                        navigate('participants'); 
                    }} 
                    onAddNewFacilitator={async (data) => { await upsertFacilitator(data); await refreshAllData(); }} 
                    onAddNewCoordinator={handleAddNewCoordinator} 
                    onAddNewFunder={handleAddNewFunder} 
                    fundersList={funders} 
                    federalCoordinatorsList={federalCoordinators}
                    stateCoordinatorsList={stateCoordinators}
                    localityCoordinatorsList={localityCoordinators}
                />
            ) : null;
            case 'participantForm': return permissions.canAddParticipant || permissions.canEditDeleteParticipant ? (
                selectedCourse && <ParticipantForm course={selectedCourse} initialData={editingParticipant} onCancel={() => navigate(previousView)} onSave={async (participantData, facilityUpdateData) => {
                    try {
                        const fullParticipantPayload = {
                            ...participantData,
                            id: editingParticipant?.id,
                            courseId: selectedCourse.id
                        };
                        await saveParticipantAndSubmitFacilityUpdate(fullParticipantPayload, facilityUpdateData);
                        if (facilityUpdateData) {
                            setToast({
                                show: true,
                                message: 'Facility staff update submitted for approval.',
                                type: 'info'
                            });
                        }
                        await refreshParticipants();
                        navigate('participants');
                    } catch (e) {
                        setToast({
                            show: true,
                            message: `Submission failed: ${e.message}`,
                            type: 'error'
                        });
                    }
                }} />
            ) : null;
            case 'participantReport': return permissions.canViewCourse ? (
                selectedCourse && currentParticipant && <ParticipantReportView 
                    course={selectedCourse} 
                    participant={currentParticipant} 
                    participants={allParticipants.filter(p => p.courseId === selectedCourseId)} 
                    onChangeParticipant={(pid) => setSelectedParticipantId(pid)} 
                    onBack={() => navigate(previousView)} 
                    onNavigateToCase={(caseToEdit) => {
                        navigate('observe', { 
                            caseToEdit: caseToEdit,
                            courseId: caseToEdit.courseId,
                            participantId: caseToEdit.participant_id
                        });
                    }}
                    onShare={(participant) => handleShare(participant, 'participant')}
                />
            ) : null;
            case 'courseReport': return permissions.canViewCourse ? (
                selectedCourse && <CourseReportView course={selectedCourse} participants={courseDataForReport.participants} allObs={courseDataForReport.allObs} allCases={courseDataForReport.allCases} finalReportData={finalReportData} onBack={() => navigate(previousView)} onEditFinalReport={handleEditFinalReport} onDeletePdf={handleDeletePdf} onViewParticipantReport={(pid) => { setSelectedParticipantId(pid); navigate('participantReport'); }} onShare={(course) => handleShare(course, 'course')} />
            ) : null;
            case 'facilitatorForm': return <FacilitatorForm initialData={editingFacilitator} onCancel={() => navigate(previousView)} onSave={async (payload) => {
                try {
                    setLoading(true);
                    const { certificateFiles, ...facilitatorData } = payload;
                    const oldCertificateUrls = editingFacilitator?.certificateUrls || {};
                    let newCertificateUrls = facilitatorData.certificateUrls || {};

                    if (certificateFiles) {
                        for (const course in certificateFiles) {
                            const file = certificateFiles[course];
                            if (file) {
                                if (oldCertificateUrls[course]) {
                                    await deleteFile(oldCertificateUrls[course]);
                                }
                                const url = await uploadFile(file);
                                newCertificateUrls[course] = url;
                            }
                        }
                    }

                    const finalPayload = {
                        ...facilitatorData,
                        id: editingFacilitator?.id,
                        certificateUrls: newCertificateUrls,
                    };
                    delete finalPayload.certificateFiles;

                    await upsertFacilitator(finalPayload);
                    await refreshAllData();
                    setToast({ show: true, message: 'Facilitator saved successfully.', type: 'success' });
                    navigate(previousView === 'facilitatorForm' ? 'courseForm' : 'humanResources');

                } catch (error) {
                    console.error("Error saving facilitator:", error);
                    setToast({ show: true, message: `Error saving facilitator: ${error.message}`, type: 'error' });
                } finally {
                    setLoading(false);
                }
            }} />;
            case 'facilitatorReport': return selectedFacilitator && <FacilitatorReportView facilitator={selectedFacilitator} allCourses={allCourses} onBack={() => navigate(previousView)} />;
            case 'admin': return <AdminDashboard />;
            case 'dashboard':
                return <DashboardView
                    STATE_LOCALITIES={STATE_LOCALITIES}
                    onOpenCourseReport={(id) => { setSelectedCourseId(id); navigate('courseReport'); }}
                    onOpenParticipantReport={(pId, cId) => {
                        navigate('participantReport', { openParticipantReport: pId, openCourseReport: cId });
                    }}
                    onOpenFacilitatorReport={(id) => { setSelectedFacilitatorId(id); navigate('facilitatorReport'); }}
                    permissions={permissions}
                    userStates={userStates}
                />;
            case 'finalReportView':
                return selectedCourse && finalReportData ? (
        <div className="space-y-6">
            <PageHeader
                title={`Final Report for ${selectedCourse.course_type} - ${selectedCourse.state}`}
                subtitle="View the complete final report."
                actions={permissions.canEditDeleteFinalReport && <Button onClick={() => handleEditFinalReport(selectedCourse.id)}>Edit Report</Button>}
            />
            <Card>
                <h3 className="text-xl font-bold mb-4">Course Summary</h3>
                <p className="whitespace-pre-wrap">{finalReportData.summary}</p>
            </Card>
            <Card>
                <h3 className="text-xl font-bold mb-4">Course Recommendations</h3>
                <div className="overflow-x-auto">
                    <Table headers={['Recommendation', 'Responsible', 'Status']}>
                        {finalReportData.recommendations.map((rec, index) => (
                            <tr key={index}>
                                <td className="p-2 border">{rec.recommendation}</td>
                                <td className="p-2 border">{rec.responsible}</td>
                                <td className="p-2 border">{rec.status}</td>
                            </tr>
                        ))}
                    </Table>
                </div>
            </Card>
            <Card>
                <h3 className="text-xl font-bold mb-4">Potential Facilitators</h3>
                <div className="overflow-x-auto">
                    <Table headers={['Name', 'Course Type']}>
                        {finalReportData.potentialFacilitators.map((fac, index) => {
                            const participant = participants.find(p => p.id === fac.participant_id);
                            return (
                                <tr key={index}>
                                    <td className="p-2 border">{participant?.name || 'N/A'}</td>
                                    <td className="p-2 border">{fac.course_type}</td>
                                </tr>
                            );
                        })}
                    </Table>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Final Report PDF</h3>
                <div className="overflow-x-auto">
                    <Table headers={['Document', 'Actions']}>
                        <tbody>
                            <tr>
                                <td className="p-2 border">
                                    {finalReportData?.pdfUrl ? (
                                        <div className="flex items-center gap-2">
                                            <PdfIcon className="text-blue-500 w-6 h-6" />
                                            <span>Final Report.pdf</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-500">No PDF uploaded</span>
                                    )}
                                </td>
                                <td className="p-2 border">
                                    {finalReportData?.pdfUrl && (
                                        <div className="flex flex-wrap gap-2">
                                            <a href={finalReportData.pdfUrl} target="_blank" rel="noopener noreferrer">
                                                <Button variant="info">View</Button>
                                            </a>
                                            <a href={finalReportData.pdfUrl} download="FinalReport.pdf">
                                                <Button variant="primary">Download</Button>
                                            </a>
                                            {permissions.canEditDeleteFinalReport && (
                                                <Button
                                                    variant="danger"
                                                    onClick={() => handleDeletePdf(selectedCourse.id)}
                                                >
                                                    Delete
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </Table>
                </div>
            </Card>
        </div>
    ) : (
        <EmptyState message="Final report not found. Please go back to the course list to add one." onAction={() => navigate('courses')} actionText="Go Back" />
    );
            default: return <div className="p-8 text-center text-red-500">Access Denied: You do not have permission to view this page.</div>;
        }
    };

    const navItems = [
        { label: 'Dashboard', view: 'dashboard', active: view === 'dashboard', disabled: !permissions.canViewDashboard },
        { label: 'Home', view: 'landing', active: view === 'landing', disabled: !permissions.canViewLanding },
        { label: 'Courses', view: 'courses', active: ['courses', 'courseForm', 'courseReport', 'participants', 'participantForm', 'participantReport', 'observe', 'monitoring', 'reports', 'finalReportForm', 'finalReportView', 'participantMigration'].includes(view), disabled: !permissions.canViewCourse },
        { label: 'Human Resources', view: 'humanResources', active: ['humanResources', 'facilitatorForm', 'facilitatorReport'].includes(view), disabled: !permissions.canViewFacilitators },
        { label: 'Child Health Services', view: 'childHealthServices', active: view === 'childHealthServices', disabled: !permissions.canManageHealthFacilities },
    ];

    let mainContent;

    if (isPublicFacilityUpdateView) {
        mainContent = <PublicFacilityUpdateForm setToast={setToast} />;
    } else if (isNewFacilityView) {
        mainContent = <NewFacilityEntryForm setToast={setToast} />;
    } else if (isPublicSubmissionView) {
        if (submissionType === 'facilitator-application') {
            mainContent = <FacilitatorApplicationForm />;
        } else if (submissionType === 'team-member-application') {
            mainContent = <TeamMemberApplicationForm />;
        } else {
            mainContent = <div className="p-8 text-center">Invalid form link.</div>;
        }
    } else if (isSharedView) {
        if (loading || authLoading) {
            mainContent = <SplashScreen />;
        } else if (sharedViewError) {
            mainContent = (
                <div className="flex items-center justify-center min-h-full">
                    <div className="text-center p-8 bg-white shadow-md rounded-lg max-w-md mx-4">
                        <h2 className="text-2xl font-bold text-red-600 mb-4">Access Error</h2>
                        <p className="text-gray-700 mb-6">{sharedViewError}</p>
                        <Button onClick={() => window.location.href = '/'}>Go to Homepage</Button>
                    </div>
                </div>
            );
        } else if (sharedViewRequiresLogin && !sharedReportData?.hasFullAccess) {
            mainContent = (
                <div className="flex items-center justify-center min-h-full">
                    <div className="text-center p-8 bg-white shadow-md rounded-lg max-w-md mx-4">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Private Report</h2>
                        <p className="text-gray-600 mb-6">This report is private. Please sign in to see if you have access.</p>
                        {user ? (
                            <p className="text-red-500">You do not have access with the account {user.email}.</p>
                        ) : (
                            <Button onClick={handleLoginForSharedView}>Sign in with Google</Button>
                        )}
                    </div>
                </div>
            );
        } else if (sharedReportData?.hasFullAccess) {
            if (sharedReportData.type === 'course') {
                mainContent = <CourseReportView
                    course={sharedReportData.course}
                    participants={sharedReportData.participants}
                    allObs={sharedReportData.allObs}
                    allCases={sharedReportData.allCases}
                    finalReportData={sharedReportData.finalReport}
                    onBack={() => {}}
                    isSharedView={true}
                    onShare={() => {}}
                    onViewParticipantReport={() => {}}
                />;
            } else if (sharedReportData.type === 'participant') {
                mainContent = <ParticipantReportView
                    course={sharedReportData.course}
                    participant={sharedReportData.participant}
                    participants={sharedReportData.participantsInCourse}
                    onChangeParticipant={() => {}}
                    onBack={() => {}}
                    onNavigateToCase={() => {}}
                    onShare={() => {}}
                    isSharedView={true}
                />;
            } else {
                 mainContent = <SplashScreen />;
            }
        } else {
            mainContent = <SplashScreen />;
        }
    } else if (!user && !authLoading) {
        mainContent = <Landing active={activeCourseType} onPick={(t) => { setActiveCourseType(t); navigate('courses'); }} />;
    } else {
        mainContent = renderView();
    }

    const isPublicView = isPublicSubmissionView || isNewFacilityView || isPublicFacilityUpdateView;

    return (
        <div className="min-h-screen bg-sky-50 flex flex-col">
            { isPublicView ? (
                <header className="bg-slate-800 shadow-lg sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                        <div className="flex items-center justify-center gap-4">
                            <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md">
                                <img src="/child.png" alt="NCHP Logo" className="h-12 w-12 object-contain" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-white text-center">National Child Health Program</h1>
                                <p className="text-sm text-slate-300 hidden sm:block text-center">Course Monitoring System</p>
                            </div>
                        </div>
                    </div>
                </header>
            ) : (
                <header className="bg-slate-800 shadow-lg sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 cursor-pointer" onClick={() => !isSharedView && navigate('dashboard')}>
                                <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md">
                                    <img src="/child.png" alt="NCHP Logo" className="h-12 w-12 object-contain" />
                                </div>
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-white">National Child Health Program</h1>
                                    <p className="text-sm text-slate-300 hidden sm:block">Course Monitoring System</p>
                                </div>
                            </div>
                            {!isSharedView && (
                                <nav className="hidden md:flex items-center gap-1">
                                    {navItems.map(item => (
                                        <button key={item.label} onClick={() => !item.disabled && navigate(item.view)} disabled={item.disabled}
                                            className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${item.active
                                                    ? 'bg-sky-600 text-white'
                                                    : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                                                }`}>
                                            {item.label}
                                        </button>
                                    ))}
                                </nav>
                            )}
                        </div>
                    </div>
                </header>
            )}
            
            {user && !isSharedView && !isPublicView && (
                <div className="bg-slate-700 text-slate-200 p-2 md:p-3 text-center flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                        <span>Welcome, {user.email}</span>
                        {userRole && <span className="bg-sky-600 text-xs px-2 py-1 rounded">{userRole}</span>}
                    </div>
                    {permissions.canViewAdmin && (
                        <Button onClick={() => navigate('admin')} variant="primary">Admin Dashboard</Button>
                    )}
                    <Button 
                        onClick={handleLogout}
                        className="px-3 py-1 text-sm font-semibold text-white bg-red-600 rounded-md transition-colors hover:bg-red-700"
                    >
                        Logout
                    </Button>
                </div>
            )}
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}
            
            <main className="max-w-7xl mx-auto p-6 sm:p-8 w-full flex-grow mb-16 md:mb-0">
                {mainContent}
            </main>

            <Footer />
            { !isSharedView && !isPublicView && <BottomNav navItems={navItems} navigate={navigate} /> }
            
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                shareableItem={itemToShare}
                shareType={shareType}
                onSave={handleSaveSharingSettings}
            />
        </div>
    );
}