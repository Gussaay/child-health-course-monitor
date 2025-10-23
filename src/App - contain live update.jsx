// App.jsx
import React, { useEffect, useMemo, useState, useRef, lazy, Suspense, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);
import { CapacitorUpdater as LiveUpdate } from '@capgo/capacitor-updater';
import { App as CapacitorApp } from '@capacitor/app'; // Renamed to avoid conflict
import { Capacitor } from '@capacitor/core'; // Added for platform check

// --- Lazy Load View Components ---
const DashboardView = lazy(() => import('./components/DashboardView.jsx'));
const CourseReportView = lazy(() => import('./components/CourseReportView.jsx').then(module => ({ default: module.CourseReportView })));
const ShareModal = lazy(() => import('./components/ShareModal').then(module => ({ default: module.ShareModal })));
const FinalReportManager = lazy(() => import('./components/FinalReportManager.jsx').then(module => ({ default: module.FinalReportManager })));
const ObservationView = lazy(() => import('./components/MonitoringView').then(module => ({ default: module.ObservationView })));
const ReportsView = lazy(() => import('./components/ReportsView').then(module => ({ default: module.ReportsView })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ParticipantReportView = lazy(() => import('./components/ParticipantReport').then(module => ({ default: module.ParticipantReportView })));
const ChildHealthServicesView = lazy(() => import('./components/ChildHealthServicesView.jsx'));
const HumanResourcesPage = lazy(() => import('./components/HumanResources').then(module => ({ default: module.HumanResourcesPage })));
const FacilitatorForm = lazy(() => import('./components/Facilitator').then(module => ({ default: module.FacilitatorForm })));
const FacilitatorReportView = lazy(() => import('./components/Facilitator').then(module => ({ default: module.FacilitatorReportView })));
const FacilitatorApplicationForm = lazy(() => import('./components/Facilitator').then(module => ({ default: module.FacilitatorApplicationForm })));
const CourseManagementView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.CourseManagementView })));
const CourseForm = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.CourseForm })));
const ProgramTeamView = lazy(() => import('./components/ProgramTeamView').then(module => ({ default: module.ProgramTeamView })));
const TeamMemberApplicationForm = lazy(() => import('./components/ProgramTeamView').then(module => ({ default: module.TeamMemberApplicationForm })));
const ParticipantsView = lazy(() => import('./components/Participants').then(module => ({ default: module.ParticipantsView })));
const ParticipantForm = lazy(() => import('./components/Participants').then(module => ({ default: module.ParticipantForm })));
const ParticipantMigrationMappingView = lazy(() => import('./components/Participants').then(module => ({ default: module.ParticipantMigrationMappingView })));
const PublicFacilityUpdateForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.PublicFacilityUpdateForm })));
const NewFacilityEntryForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.NewFacilityEntryForm })));



// --- Data & Component Imports ---
import {
    upsertCourse, deleteCourse, listParticipants, deleteParticipant, listObservationsForParticipant,
    listCasesForParticipant, listAllDataForCourse, upsertFacilitator, deleteFacilitator, importParticipants,
    upsertCoordinator, upsertFunder, upsertFinalReport, getFinalReportByCourseId, uploadFile, deleteFile,
    getCourseById, getParticipantById, updateCourseSharingSettings, updateParticipantSharingSettings,
    listPendingFacilitatorSubmissions, approveFacilitatorSubmission, rejectFacilitatorSubmission,
    saveParticipantAndSubmitFacilityUpdate, bulkMigrateFromMappings,
    getPublicCourseReportData
} from './data.js';
import { STATE_LOCALITIES } from './components/constants.js';
// --- MODIFIED: Removed CourseIcon, as it's now handled in Course.jsx, but it's used in Dashboard, re-checking...
// CourseIcon is imported in App.jsx but was only used in the removed Landing component.
// Let's check DashboardView... it's not passed.
// Let's check Landing in App.jsx... ah, it uses CourseIcon.
// Let's check Landing in Course.jsx... it will need CourseIcon.
// The original App.jsx *did* import CourseIcon. I will keep it.
import { Card, PageHeader, Button, Table, EmptyState, Spinner, PdfIcon, CourseIcon, Footer, Toast } from './components/CommonComponents';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useDataCache } from './DataContext';
import { useAuth } from './hooks/useAuth';
import { SignInBox } from './auth-ui.jsx';

// --- Import centralized permission constants ---
import {
    ALL_PERMISSIONS,
    DEFAULT_ROLE_PERMISSIONS,
    ALL_PERMISSION_KEYS,
    applyDerivedPermissions 
} from './components/AdminDashboard';


// --- VIEW COMPONENTS ---
// --- REMOVED: Landing component moved to Course.jsx ---

// --- Mobile Navigation Icons & Components ---
const HomeIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
const CoursesIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
const UsersIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
const MonitorIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
const ReportIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
const AdminIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
// --- MODIFIED: Added HospitalIcon here as it's needed by BottomNav and the new Landing component ---
const HospitalIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v2.85c-.9.17-1.72.6-2.43 1.24L4.3 11.2a1 1 0 0 0-.2 1.39l.2.2c.45.6.84 1.34 1.36 2.14L6 15l2.43-1.6c.71-.48 1.54-.74 2.43-.84V14a1 1 0 0 0 1 1h2c.7 0 1.25-.56 1.25-1.25S15.7 12.5 15 12.5V11a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v1.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V9.85c-.9-.1-1.72-.36-2.43-.84L4.3 7.8a1 1 0 0 0-.2-1.39l.2-.2c.45-.6.84-1.34 1.36-2.14L6 3l2.43 1.6c.71.48 1.54-.74 2.43 .84V5a3 3 0 0 0-3-3zM12 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2zM18 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2z"></path><path d="M12 18.5V22"></path><path d="M12 11h-2"></path><path d="M14 11h2"></path><path d="M18 11h2"></path></svg>;

// --- NEW: Landing Page Component ---
function Landing({ navigate, permissions }) {
    const navButtons = [
        // --- MODIFIED: Dashboard permission is now 'true' to make it always available ---
        { label: 'Dashboard', view: 'dashboard', icon: HomeIcon, permission: true },
        { label: 'Courses', view: 'courses', icon: CoursesIcon, permission: permissions.canViewCourse },
        { label: 'Human Resources', view: 'humanResources', icon: UsersIcon, permission: permissions.canViewHumanResource },
        { label: 'Child Health Services', view: 'childHealthServices', icon: HospitalIcon, permission: permissions.canViewFacilities },
        { label: 'Admin', view: 'admin', icon: AdminIcon, permission: permissions.canViewAdmin },
    ];

    const accessibleButtons = navButtons.filter(btn => btn.permission);

    return (
        <Card>
            <PageHeader title="Welcome" subtitle="Select a module to get started" />
            <div className="p-4">
                {accessibleButtons.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {accessibleButtons.map(btn => {
                            const Icon = btn.icon;
                            return (
                                <button
                                    key={btn.view}
                                    onClick={() => navigate(btn.view)}
                                    className="flex flex-col items-center justify-center gap-3 p-6 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:bg-slate-50 transition-all duration-150 text-slate-700 hover:text-sky-600"
                                >
                                    <Icon className="w-12 h-12 text-sky-500" />
                                    <span className="text-lg font-semibold">{btn.label}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState message="You do not have permissions to view any modules. Please contact an administrator." />
                )}
            </div>
        </Card>
    );
}
// --- END: Landing Page Component ---

const BottomNav = React.memo(function BottomNav({ navItems, navigate }) {
    // --- MODIFIED: Removed HospitalIcon definition, as it's now defined globally above ---
    const icons = { Dashboard: HomeIcon, Home: HomeIcon, Courses: CoursesIcon, 'Human Resources': UsersIcon, 'Child Health Services': HospitalIcon, Admin: AdminIcon };
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around items-center z-20">
            {navItems.map(item => {
                const Icon = icons[item.label];
                return (
                    <button key={item.label} onClick={() => navigate(item.view)} className={`flex flex-col items-center justify-center p-2 w-full h-16 text-xs font-medium transition-colors ${item.active ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}>
                        {Icon && <Icon className="w-6 h-6 mb-1" />}
                        <span>{item.label}</span>
                    </button>
                )
            })}
        </nav>
    );
});

function SplashScreen() {
    return (
        <div className="fixed inset-0 bg-sky-50 flex flex-col items-center justify-center gap-6 text-center p-4">
            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center p-1 shadow-xl animate-pulse"><img src="/child.png" alt="NCHP Logo" className="h-20 w-20 object-contain" /></div>
            <div><h1 className="text-3xl font-bold text-slate-800">National Child Health Program</h1><p className="text-lg text-slate-500 mt-1">Program & Course Monitoring System</p></div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mt-4"></div>
            <p className="text-slate-600 mt-4">Loading application, please wait...</p>
        </div>
    );
}

// =============================================================================
// Root App Component
// =============================================================================
export default function App() {
    const {
        courses: allCourses, facilitators, funders, federalCoordinators, stateCoordinators, localityCoordinators,
        fetchCourses, fetchFacilitators, fetchFunders, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators,
    } = useDataCache();
    const { user, userStates, authLoading } = useAuth();

    // --- MODIFIED: Default view is now 'landing' ---
    const [view, setView] = useState("landing");
    // --- MODIFIED: Default activeCourseType is now null ---
    const [activeCourseType, setActiveCourseType] = useState(null);
    const [selectedCourseId, setSelectedCourseId] = useState(null);
    const [selectedParticipantId, setSelectedParticipantId] = useState(null);
    const [selectedFacilitatorId, setSelectedFacilitatorId] = useState(null);
    const [editingCourse, setEditingCourse] = useState(null);
    const [editingParticipant, setEditingParticipant] = useState(null);
    const [editingFacilitator, setEditingFacilitator] = useState(null);
    const [finalReportCourse, setFinalReportCourse] = useState(null);
    const [editingCaseFromReport, setEditingCaseFromReport] = useState(null);
    const [loading, setLoading] = useState(false);
    // --- MODIFIED: Default previousView is now 'landing' ---
    const [previousView, setPreviousView] = useState("landing");
    const [userRole, setUserRole] = useState(null);
    const [userPermissions, setUserPermissions] = useState({});
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    const [activeCoursesTab, setActiveCoursesTab] = useState('courses');
    const [activeHRTab, setActiveHRTab] = useState('facilitators');

    const [courseDetails, setCourseDetails] = useState({ participants: [], allObs: [], allCases: [], finalReport: null });
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);

    const [isSharedView, setIsSharedView] = useState(false);
    const [isPublicSubmissionView, setIsPublicSubmissionView] = useState(false);
    const [isNewFacilityView, setIsNewFacilityView] = useState(false);
    const [isPublicFacilityUpdateView, setIsPublicFacilityUpdateView] = useState(false);
    const [submissionType, setSubmissionType] = useState(null);
    const [sharedReportData, setSharedReportData] = useState(null);
    const [sharedViewError, setSharedViewError] = useState(null);
    const [sharedViewRequiresLogin, setSharedViewRequiresLogin] = useState(false);

    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [itemToShare, setItemToShare] = useState(null);
    const [shareType, setShareType] = useState('course');

    const historyInitialized = useRef(false);
    const isPopStateNavigation = useRef(false);
    const initialViewIsSet = useRef(false);

    // --- NEW: Live Update Effect for Capacitor ---
    useEffect(() => {
        // Only run this logic on native Capacitor platforms
        if (!Capacitor.isNativePlatform()) return;

        const performUpdateCheck = async (showToast = false) => {
            console.log('Checking for updates...');
            try {
                const result = await LiveUpdate.getLatest();
                if (result.version !== (await LiveUpdate.current()).version) {
                    // New version available
                    if (showToast) {
                        setToast({ show: true, message: 'Downloading update...', type: 'info' });
                    }
                    const bundle = await LiveUpdate.download(result);
                    await LiveUpdate.set(bundle);
                    setToast({ show: true, message: 'Update applied! Restarting...', type: 'success' });
                    
                    // Give the toast a moment to show before restarting
                    setTimeout(() => {
                        LiveUpdate.reload();
                    }, 2000);
                } else {
                    if (showToast) {
                        setToast({ show: true, message: 'App is up to date.', type: 'info' });
                    }
                    console.log('App is up to date.');
                }
            } catch (error) {
                console.error('Live update failed:', error);
                if (showToast) {
                    setToast({ show: true, message: 'Update check failed.', type: 'error' });
                }
            }
        };

        // Check for updates when the app first loads
        performUpdateCheck();

        // Check for updates when the app resumes from the background
        const listener = CapacitorApp.addListener('appStateChange', (state) => {
            if (state.isActive) {
                performUpdateCheck(true); // Show toast on resume
            }
        });

        // Clean up the listener when the component unmounts
        return () => {
            listener.remove();
        };
    }, []); // Empty dependency array ensures this runs once on mount
    // --- END: Live Update Effect ---

    useEffect(() => {
        if (historyInitialized.current) return;
        historyInitialized.current = true;

        const handlePathChange = () => {
            const path = window.location.pathname;

            setIsSharedView(false);
            setIsPublicSubmissionView(false);
            setIsNewFacilityView(false);
            setIsPublicFacilityUpdateView(false);
            setSharedViewError(null);

            const facilityUpdateMatch = path.match(/^\/facilities\/data-entry\/([a-zA-Z0-9]+)\/?$/);
            if (path.startsWith('/facilities/data-entry/new')) {
                setIsNewFacilityView(true);
                return;
            }
            if (facilityUpdateMatch) {
                setIsPublicFacilityUpdateView(true);
                return;
            }

            const facilitatorAppMatch = path.match(/^\/submit\/facilitator-application\/?$/);
            if (facilitatorAppMatch) {
                setIsPublicSubmissionView(true);
                setSubmissionType('facilitator-application');
                return;
            }

            const teamAppMatch = path.match(/^\/submit\/team-member-application\/?$/);
            if (teamAppMatch) {
                setIsPublicSubmissionView(true);
                setSubmissionType('team-member-application');
                return;
            }

            const publicReportMatch = path.match(/^\/public\/report\/course\/([a-zA-Z0-9]+)\/?$/);
            if (publicReportMatch && publicReportMatch[1]) {
                const courseId = publicReportMatch[1];
                setIsSharedView(true);
                const fetchReport = async () => {
                    try {
                        const data = await getPublicCourseReportData(courseId);
                        setSharedReportData(data);
                    } catch (error) {
                        setSharedViewError(error.message);
                    }
                };
                fetchReport();
            }
        };

        handlePathChange();
    }, []);

    // Create minimal structure for checks, based on keys imported from AdminDashboard
    const ALL_PERMISSIONS_MINIMAL = useMemo(() => {
        return ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});
    }, [ALL_PERMISSION_KEYS]);

    const permissions = useMemo(() => {
        // userPermissions from state is now ALREADY DERIVED
        let derivedPermissions = { ...userPermissions }; 

        // Handle super_user override just in case the stored permissions haven't updated yet
        if (userRole?.toLowerCase() === 'super_user') {
            return ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {});
        }

        // Ensure all keys are present, defaulting to false if missing
        return { ...ALL_PERMISSIONS_MINIMAL, ...derivedPermissions };
    }, [userRole, userPermissions, ALL_PERMISSIONS_MINIMAL, ALL_PERMISSION_KEYS]);

    // --- MODIFIED: This effect now defaults to 'landing' ---
    useEffect(() => {
        if (user && !permissionsLoading && !initialViewIsSet.current) {
            setView("landing"); // Start on landing page
            initialViewIsSet.current = true;
        }
    }, [user, permissionsLoading]); // Simplified dependencies

    // *** MODIFIED: This entire function is updated to use applyDerivedPermissions ***
    useEffect(() => {
        const checkUserRoleAndPermissions = async () => {
            setPermissionsLoading(true);
            try {
                if (user) {
                    const userRef = doc(db, "users", user.uid);
                    const userSnap = await getDoc(userRef);
                    let role;
                    let permissionsData = {};

                    if (!userSnap.exists() || !userSnap.data().role) {
                        role = 'user';
                        // Get the default, derived permissions for a new 'user'
                        const rawPerms = DEFAULT_ROLE_PERMISSIONS.user;
                        // Run derivation logic just in case (good practice, though defaults are pre-derived)
                        permissionsData = applyDerivedPermissions(rawPerms); 
                        
                        await setDoc(userRef, { email: user.email, role: role, permissions: permissionsData, lastLogin: new Date(), assignedState: '' }, { merge: true });
                    } else {
                        role = userSnap.data().role;
                        // Get the raw permissions from Firestore
                        const rawPerms = { ...ALL_PERMISSIONS_MINIMAL, ...(userSnap.data().permissions || {}) };
                        // *** ALWAYS apply derivation logic on load ***
                        // This fixes stale data in Firestore if rules in AdminDashboard have changed
                        permissionsData = applyDerivedPermissions(rawPerms);
                    }
                    setUserRole(role);
                    setUserPermissions(permissionsData);
                } else {
                    setUserRole(null);
                    setUserPermissions({});
                }
            } catch (error) {
                console.error("Error checking user role:", error);
                setUserRole('user');
                // Fallback to default derived 'user' permissions
                setUserPermissions(applyDerivedPermissions(DEFAULT_ROLE_PERMISSIONS.user));
            } finally {
                setPermissionsLoading(false);
            }
        };
        checkUserRoleAndPermissions();
    }, [user, ALL_PERMISSIONS_MINIMAL, DEFAULT_ROLE_PERMISSIONS]); // Added dependencies

    // **FIX**: This new effect resets the initial view flag when a user logs out.
    useEffect(() => {
        if (!user) {
            initialViewIsSet.current = false;
        }
    }, [user]);

    useEffect(() => {
        const handlePopState = (event) => {
            isPopStateNavigation.current = true;
            if (window.location.pathname === '/') {
                navigate('landing'); // --- MODIFIED: Navigate to 'landing'
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const fetchCoordinators = useCallback(async (force = false) => {
        await fetchFederalCoordinators(force);
        await fetchStateCoordinators(force);
        await fetchLocalityCoordinators(force);
    }, [fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators]);


    // --- MODIFIED: Added 'landing' to list of views that might need facilitators ---
    useEffect(() => {
        if (isSharedView || !user) return;
        const needsFacilitators = ['humanResources', 'facilitatorForm', 'facilitatorReport', 'courseForm', 'dashboard', 'landing'].includes(view);
        const needsFunders = ['courseForm', 'humanResources'].includes(view);
        const needsCoordinators = ['courseForm'].includes(view);
        if (needsFacilitators) fetchFacilitators();
        if (needsFunders) fetchFunders();
        if (needsCoordinators) fetchCoordinators();
    }, [view, isSharedView, user, fetchFacilitators, fetchFunders, fetchCoordinators]);

    // --- REMOVED: The 'courses' memo is removed. Filtering now happens in CourseManagementView. ---

    const fetchPendingSubmissions = useCallback(async () => {
        if (!permissions.canApproveSubmissions) return;
        setIsSubmissionsLoading(true);
        try {
            const submissions = await listPendingFacilitatorSubmissions();
            setPendingSubmissions(submissions);
        } catch (error) { setToast({ show: true, message: 'Failed to load submissions.', type: 'error' }); } finally { setIsSubmissionsLoading(false); }
    }, [permissions.canApproveSubmissions]);

    useEffect(() => { if (view === 'humanResources' && activeHRTab === 'facilitators' && permissions.canApproveSubmissions) fetchPendingSubmissions(); }, [view, activeHRTab, permissions.canApproveSubmissions, fetchPendingSubmissions]);

    const listAllParticipantsForCourse = async (courseId) => {
        if (!courseId) return [];
        let allParticipants = [];
        let lastVisible = null;
        let hasMore = true;

        while(hasMore) {
            const result = await listParticipants(courseId, lastVisible);
            if (result.participants && result.participants.length > 0) {
                allParticipants = allParticipants.concat(result.participants);
            }
            lastVisible = result.lastVisible;
            if (!lastVisible) {
                hasMore = false;
            }
        }
        return allParticipants;
    };

    const selectedCourse = useMemo(() => allCourses.find(c => c.id === selectedCourseId) || null, [allCourses, selectedCourseId]);

    // *** NEW: Added useMemo for isCourseActive ***
    const isCourseActive = useMemo(() => {
        if (!selectedCourse?.start_date || !selectedCourse?.course_duration || selectedCourse.course_duration <= 0) {
            return false;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(selectedCourse.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + selectedCourse.course_duration);
        return today >= startDate && today < endDate;
    }, [selectedCourse]);

    const selectedFacilitator = useMemo(() => facilitators.find(f => f.id === selectedFacilitatorId) || null, [facilitators, selectedFacilitatorId]);

    const navigate = useCallback((newView, state = {}) => {
        // --- UPDATED PERMISSION CHECKS ---
        // --- FIX: Added 'facilitators', 'programTeams', and 'partnersPage' to this map ---
        // --- MODIFIED: Added 'landing' ---
        const viewPermissions = {
            'landing': true,
            // --- MODIFIED: Dashboard permission is now 'true' to make it always available ---
            'dashboard': true,
            'admin': permissions.canViewAdmin,
            'humanResources': permissions.canViewHumanResource,
            'courses': permissions.canViewCourse,
            'courseDetails': permissions.canViewCourse,
            'participants': permissions.canViewCourse,
            'reports': permissions.canViewCourse,
            'observe': (permissions.canManageCourse && isCourseActive) || permissions.canUseFederalManagerAdvancedFeatures, 
            'monitoring': (permissions.canManageCourse && isCourseActive) || permissions.canUseFederalManagerAdvancedFeatures, 
            'courseForm': permissions.canManageCourse,
            'participantForm': permissions.canManageCourse,
            'facilitatorForm': permissions.canManageHumanResource,
            'courseReport': permissions.canViewCourse,
            'participantReport': permissions.canViewCourse,
            'facilitatorReport': permissions.canViewHumanResource,
            'finalReport': permissions.canViewCourse,
            'participantMigration': permissions.canUseSuperUserAdvancedFeatures,
            'childHealthServices': permissions.canViewFacilities,
            'facilitators': permissions.canViewHumanResource,
            'programTeams': permissions.canViewHumanResource,
            'partnersPage': permissions.canViewHumanResource,
        };

        // --- FIX: Simplified this check to remove the exception for HR sub-tabs ---
        // This now correctly blocks any navigation attempt if the permission is false or undefined.
        if (user && !viewPermissions[newView]) {
            console.warn(`Access denied to view: ${newView}. Redirecting to landing.`);
            setView('landing'); // --- MODIFIED: Redirect to 'landing'
            return;
        }

        setPreviousView(view);
        setEditingCourse(null);
        setEditingParticipant(null);
        setEditingFacilitator(null);
        setEditingCaseFromReport(null);

        if (state.courseId && state.courseId !== selectedCourseId) setSelectedCourseId(state.courseId);
        if (state.participantId && state.participantId !== selectedParticipantId) setSelectedParticipantId(state.participantId);
        // --- ADDED: Handle activeCourseType state passed from navigation ---
        if (state.activeCourseType) setActiveCourseType(state.activeCourseType);

        const courseSubTabs = ['participants', 'reports', 'courseDetails'];
        const hrSubTabs = ['facilitators', 'programTeams', 'partnersPage'];

        if (hrSubTabs.includes(newView)) { setActiveHRTab(newView); setView('humanResources'); }
        else if (['courses', ...courseSubTabs].includes(newView)) { setActiveCoursesTab(newView); setView('courses'); }
        else { setActiveCoursesTab(null); setView(newView); }

        if (state.editCourse) setEditingCourse(state.editCourse);
        if (state.editParticipant) setEditingParticipant(state.editParticipant);
        if (state.editFacilitator) setEditingFacilitator(state.editFacilitator);
        if (state.openFacilitatorReport) setSelectedFacilitatorId(state.openFacilitatorReport);
        if (state.openCourseReport) setSelectedCourseId(state.openCourseReport);
        if (state.openParticipantReport) { setSelectedParticipantId(state.openParticipantReport); setSelectedCourseId(state.openCourseReport); }
        if (state.caseToEdit) setEditingCaseFromReport(state.caseToEdit);

        // --- MODIFIED: Added 'landing' to reset list ---
        if (['courses', 'humanResources', 'dashboard', 'admin', 'landing'].includes(newView)) {
            setSelectedCourseId(null);
            setSelectedParticipantId(null);
            setFinalReportCourse(null);
            setCourseDetails({ participants: [], allObs: [], allCases: [], finalReport: null });
            // --- ADDED: Reset activeCourseType if navigating to dashboard or admin ---
            if (['dashboard', 'admin', 'landing'].includes(newView)) { // --- MODIFIED: Added 'landing'
                setActiveCourseType(null);
            }
        }
        if ((view === 'observe' || view === 'participantReport') && !['observe', 'participantReport'].includes(newView)) {
            setSelectedParticipantId(null);
        }
    }, [view, selectedCourseId, selectedParticipantId, permissions, user, isCourseActive]); 

    const handleOpenCourse = useCallback(async (courseId) => {
        setSelectedCourseId(courseId);
        setLoading(true);
        try {
            const [participantsData, allCourseData, finalReport] = await Promise.all([
                listAllParticipantsForCourse(courseId),
                listAllDataForCourse(courseId),
                getFinalReportByCourseId(courseId)
            ]);

            const { allObs, allCases } = allCourseData;

            setCourseDetails({ participants: participantsData, allObs, allCases, finalReport });
            navigate('courseDetails', { courseId });
        } catch (error) {
            console.error("Error loading course details:", error);
            setToast({ show: true, message: 'Failed to load course details. Please try again.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    const handleOpenCourseReport = useCallback(async (courseId) => {
        setSelectedCourseId(courseId);
        setLoading(true);
        try {
            const [participantsData, allCourseData, finalReport] = await Promise.all([
                listAllParticipantsForCourse(courseId),
                listAllDataForCourse(courseId),
                getFinalReportByCourseId(courseId)
            ]);

            const { allObs, allCases } = allCourseData;

            setCourseDetails({ participants: participantsData, allObs, allCases, finalReport });
            navigate('courseReport', { courseId });
        } catch (error) {
            console.error("Error loading course report data:", error);
            setToast({ show: true, message: 'Failed to load course report data. Please try again.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    const handleApproveSubmission = useCallback(async (submission) => {
        if (window.confirm(`Approve ${submission.name}?`)) {
            try {
                await approveFacilitatorSubmission(submission, user.email);
                setToast({ show: true, message: 'Facilitator approved.', type: 'success' });
                await fetchPendingSubmissions();
                await fetchFacilitators(true);
            } catch (error) {
                setToast({ show: true, message: `Approval failed: ${error.message}`, type: 'error' });
            }
        }
    }, [user, fetchPendingSubmissions, fetchFacilitators]);

    const handleRejectSubmission = useCallback(async (submissionId) => {
        if (window.confirm('Reject this submission?')) {
            try {
                await rejectFacilitatorSubmission(submissionId, user.email);
                setToast({ show: true, message: 'Submission rejected.', type: 'success' });
                await fetchPendingSubmissions();
            } catch (error) {
                setToast({ show: true, message: `Rejection failed: ${error.message}`, type: 'error' });
            }
        }
    }, [user, fetchPendingSubmissions]);

    const handleShare = useCallback((item, type) => {
        setItemToShare(item);
        setShareType(type);
        setIsShareModalOpen(true);
    }, []);

    const handleSaveSharingSettings = useCallback(async (itemId, settings) => {
        try {
            if (shareType === 'course') await updateCourseSharingSettings(itemId, settings);
            else if (shareType === 'participant') await updateParticipantSharingSettings(itemId, settings);
            await fetchCourses(true);
            setToast({ show: true, message: "Sharing settings updated.", type: "success" });
        } catch (error) {
            setToast({ show: true, message: "Failed to update sharing settings.", type: "error" });
        }
    }, [shareType, fetchCourses]);

    const handleDeleteCourse = useCallback(async (courseId) => {
        if (!permissions.canManageCourse) return; // Simplified check
        if (window.confirm('Are you sure you want to delete this course and all its data?')) {
            await deleteCourse(courseId);
            await fetchCourses(true);
            if (selectedCourseId === courseId) {
                setSelectedCourseId(null);
                setSelectedParticipantId(null);
                navigate('courses');
            }
        }
    }, [permissions, selectedCourseId, navigate, fetchCourses]);

    const handleDeleteParticipant = useCallback(async (participantId) => {
        if (!permissions.canManageCourse) return; // Simplified check
        if (window.confirm('Are you sure you want to delete this participant and all their data?')) {
            await deleteParticipant(participantId);
            if (selectedCourseId) await handleOpenCourse(selectedCourseId);
            if (selectedParticipantId === participantId) {
                setSelectedParticipantId(null);
                navigate('participants');
            }
        }
    }, [permissions, selectedCourseId, selectedParticipantId, navigate, handleOpenCourse]);

    const handleDeleteFacilitator = useCallback(async (facilitatorId) => {
        if (!permissions.canManageHumanResource) return; // Simplified check
        if (window.confirm('Are you sure you want to delete this facilitator?')) {
            await deleteFacilitator(facilitatorId);
            await fetchFacilitators(true);
            navigate('humanResources');
        }
    }, [permissions, navigate, fetchFacilitators]);

    const handleImportParticipants = useCallback(async ({ participantsToImport, facilitiesToUpsert }) => {
        if (!permissions.canUseSuperUserAdvancedFeatures) return;
        try {
            setLoading(true);
            if (facilitiesToUpsert?.length > 0) { /* ... */ }
            const participantsWithCourseId = participantsToImport.map(p => ({ ...p, courseId: selectedCourse.id }));
            await importParticipants(participantsWithCourseId);
            await handleOpenCourse(selectedCourse.id);
            setToast({ show: true, message: `Successfully imported ${participantsToImport.length} participants.`, type: 'success' });
        } catch (error) {
            setToast({ show: true, message: "Error during import: " + error.message, type: "error" });
        } finally {
            setLoading(false);
        }
    }, [permissions, selectedCourse, handleOpenCourse]);

    const handleBulkMigrate = useCallback((courseId) => { navigate('participantMigration', { courseId }); }, [navigate]);
    const handleExecuteBulkMigration = useCallback(async (mappings) => { /* ... unchanged ... */ }, [navigate]);
    const handleAddNewCoordinator = useCallback(async (coordinatorData) => { await upsertCoordinator(coordinatorData); await fetchCoordinators(true); }, [fetchCoordinators]);
    const handleAddNewFunder = useCallback(async (funderData) => { await upsertFunder(funderData); await fetchFunders(true); }, [fetchFunders]);

    const handleAddFinalReport = useCallback(async (courseId) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;
        const courseToReport = allCourses.find(c => c.id === courseId);
        if (!courseToReport) return;

        setFinalReportCourse(courseToReport);
        setSelectedCourseId(courseId);

        setLoading(true);
        try {
            const [participantsData, existingReport] = await Promise.all([
                listAllParticipantsForCourse(courseId),
                getFinalReportByCourseId(courseId)
            ]);
            setCourseDetails(prev => ({ ...prev, participants: participantsData, finalReport: existingReport }));
            navigate('finalReport');
        } catch (error) {
            setToast({ show: true, message: 'Failed to load data for Final Report.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [permissions, allCourses, navigate]);

    const handleSaveFinalReport = useCallback(async (reportData) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;

        setLoading(true);
        try {
            let pdfUrl = reportData.existingPdfUrl || null;
            if (reportData.pdfFile) {
                if (pdfUrl) {
                    await deleteFile(pdfUrl);
                }
                pdfUrl = await uploadFile(reportData.pdfFile);
            }

            // Gallery Image Handling
            const finalUrlsToSave = [];
            const originalUrls = reportData.originalGalleryUrls || [];
            const finalUrlsFromEditor = reportData.finalGalleryUrls || [];
            const filesToUpload = reportData.galleryImageFiles || {};

            for (let i = 0; i < 3; i++) {
                const originalUrl = originalUrls[i];
                const finalUrl = finalUrlsFromEditor[i];
                const newFile = filesToUpload[i];

                if (newFile) { // A new file is staged for upload
                    if (originalUrl) { // It's a replacement, so delete the old file
                        await deleteFile(originalUrl);
                    }
                    const uploadedUrl = await uploadFile(newFile);
                    finalUrlsToSave.push(uploadedUrl);
                } else if (finalUrl) { // No new file, but a URL from initial data is still present
                    finalUrlsToSave.push(finalUrl);
                } else if (originalUrl && !finalUrl) { // An existing image was explicitly deleted
                    await deleteFile(originalUrl);
                }
            }

            const payload = {
                id: reportData.id,
                courseId: reportData.courseId,
                summary: reportData.summary,
                recommendations: reportData.recommendations,
                potentialFacilitators: reportData.potentialFacilitators,
                pdfUrl: pdfUrl,
                galleryImageUrls: finalUrlsToSave,
                participantsForFollowUp: reportData.participantsForFollowUp,
            };

            await upsertFinalReport(payload);
            const savedReport = await getFinalReportByCourseId(reportData.courseId);
            setCourseDetails(prev => ({...prev, finalReport: savedReport }));

            setToast({ show: true, message: 'Final report saved successfully.', type: 'success' });

        } catch (error) {
            console.error("Error saving final report:", error);
            setToast({ show: true, message: `Error saving final report: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [permissions]);

    const handleEditFinalReport = useCallback(async (courseId) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;

        const courseToEditReport = allCourses.find(c => c.id === courseId);
        if (!courseToEditReport) {
            setToast({ show: true, message: 'Course not found.', type: 'error' });
            return;
        }

        setFinalReportCourse(courseToEditReport);
        setSelectedCourseId(courseId);

        setLoading(true);
        try {
            const [participantsData, existingReport] = await Promise.all([
                listAllParticipantsForCourse(courseId),
                getFinalReportByCourseId(courseId)
            ]);
            setCourseDetails(prev => ({ ...prev, participants: participantsData, finalReport: existingReport }));
            navigate('finalReport');
        } catch (error) {
            console.error("Error fetching final report for editing:", error);
            setToast({ show: true, message: 'Failed to load the final report.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [permissions, allCourses, navigate]);

    const handleDeletePdf = useCallback(async (courseId) => { /* ... unchanged ... */ }, [permissions, courseDetails.finalReport]);
    const handleLogout = useCallback(async () => { try { await signOut(auth); } catch (error) { console.error("Error signing out:", error); } }, []);
    const handleLoginForSharedView = useCallback(async () => { /* ... unchanged ... */ }, []);

    const renderView = () => {
        const currentParticipant = courseDetails.participants.find(p => p.id === selectedParticipantId);
        const viewToRender = view;
        
        // --- PERMISSION CHECKS ARE NOW SIMPLIFIED ---

        switch (viewToRender) {
            // --- NEW: Added case 'landing' ---
            case 'landing': return <Landing navigate={navigate} permissions={permissions} />;
            case 'humanResources': return <HumanResourcesPage 
                activeTab={activeHRTab} 
                setActiveTab={setActiveHRTab} 
                facilitators={facilitators} 
                onAddFacilitator={() => navigate('facilitatorForm')} 
                onEditFacilitator={(f) => navigate('facilitatorForm', { editFacilitator: f })} 
                onDeleteFacilitator={handleDeleteFacilitator} 
                onOpenFacilitatorReport={(fid) => navigate('facilitatorReport', { openFacilitatorReport: fid })} 
                onImportFacilitators={async (data) => { await importParticipants(data); await fetchFacilitators(true); }} 
                userStates={userStates} 
                pendingSubmissions={pendingSubmissions} 
                isSubmissionsLoading={isSubmissionsLoading} 
                onApproveSubmission={handleApproveSubmission} 
                onRejectSubmission={handleRejectSubmission} 
                permissions={permissions} 
            />;
            case 'courses': return <CourseManagementView
                // --- MODIFIED: Pass allCourses, activeCourseType, and setActiveCourseType ---
                allCourses={allCourses}
                activeCourseType={activeCourseType}
                setActiveCourseType={setActiveCourseType}
                // ---
                onAdd={() => navigate('courseForm')}
                onOpen={handleOpenCourse}
                onEdit={(c) => navigate('courseForm', { editCourse: c })}
                onDelete={handleDeleteCourse}
                onOpenReport={handleOpenCourseReport}
                userStates={userStates}
                activeCoursesTab={activeCoursesTab}
                setActiveCoursesTab={setActiveCoursesTab}
                selectedCourse={selectedCourse}
                participants={courseDetails.participants}
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
                onBatchUpdate={() => handleOpenCourse(selectedCourse.id)}
                loadingDetails={loading && !!selectedCourseId}

                // --- PASSING SIMPLIFIED PERMISSIONS ---
                canManageCourse={permissions.canManageCourse}
                canUseSuperUserAdvancedFeatures={permissions.canUseSuperUserAdvancedFeatures}
                canUseFederalManagerAdvancedFeatures={permissions.canUseFederalManagerAdvancedFeatures}
                
                // --- ADD THESE MISSING PROPS ---
                canEditDeleteActiveCourse={permissions.canManageCourse}
                canEditDeleteInactiveCourse={permissions.canUseFederalManagerAdvancedFeatures}
            />;

            case 'participantMigration': return selectedCourse && (permissions.canUseSuperUserAdvancedFeatures ? <ParticipantMigrationMappingView course={selectedCourse} participants={courseDetails.participants} onCancel={() => navigate('participants')} onSave={handleExecuteBulkMigration} setToast={setToast} /> : null);

            case 'childHealthServices':
                // Check for view permission
                return permissions.canViewFacilities ? ( 
                    <ChildHealthServicesView
                        permissions={permissions} // Pass all permissions down
                        setToast={setToast}
                        userStates={userStates}
                        // Explicitly pass canManageFacilities to resolve the issue
                        canManageFacilities={permissions.canManageFacilities} 
                        canBulkUploadFacilities={permissions.canUseSuperUserAdvancedFeatures}
                        canCleanFacilityData={permissions.canUseSuperUserAdvancedFeatures}
                        canFindFacilityDuplicates={permissions.canUseSuperUserAdvancedFeatures}
                        canCheckFacilityLocations={permissions.canUseSuperUserAdvancedFeatures}
                    />
                ) : null;

            case 'monitoring': case 'observe':
                const canMonitor = (permissions.canManageCourse && isCourseActive) || permissions.canUseFederalManagerAdvancedFeatures;
                return canMonitor ? (selectedCourse && currentParticipant && <ObservationView course={selectedCourse} participant={currentParticipant} participants={courseDetails.participants} onChangeParticipant={(id) => setSelectedParticipantId(id)} initialCaseToEdit={editingCaseFromReport} />) : null;
            
            // --- MODIFIED: CourseForm now gets activeCourseType from state, or falls back to editingCourse.course_type ---
            case 'courseForm': return permissions.canManageCourse ? (<CourseForm courseType={activeCourseType || editingCourse?.course_type} initialData={editingCourse} facilitatorsList={facilitators} onCancel={() => navigate(previousView)} onSave={async (payload) => { const id = await upsertCourse({ ...payload, id: editingCourse?.id, course_type: activeCourseType || editingCourse?.course_type }); await fetchCourses(true); handleOpenCourse(id); }} onAddNewFacilitator={async (data) => { await upsertFacilitator(data); await fetchFacilitators(true); }} onAddNewCoordinator={handleAddNewCoordinator} onAddNewFunder={handleAddNewFunder} fundersList={funders} federalCoordinatorsList={federalCoordinators} stateCoordinatorsList={stateCoordinators} localityCoordinatorsList={localityCoordinators} />) : null;
            case 'participantForm': return permissions.canManageCourse ? (selectedCourse && <ParticipantForm course={selectedCourse} initialData={editingParticipant} onCancel={() => navigate(previousView)} onSave={async (participantData, facilityUpdateData) => { try { const fullPayload = { ...participantData, id: editingParticipant?.id, courseId: selectedCourse.id }; await saveParticipantAndSubmitFacilityUpdate(fullPayload, facilityUpdateData); if (facilityUpdateData) setToast({ show: true, message: 'Facility update submitted for approval.', type: 'info' }); await handleOpenCourse(selectedCourse.id); navigate('participants'); } catch (e) { setToast({ show: true, message: `Submission failed: ${e.message}`, type: 'error' }); } }} />) : null;
            case 'participantReport': return permissions.canViewCourse ? (selectedCourse && currentParticipant && <ParticipantReportView course={selectedCourse} participant={currentParticipant} participants={courseDetails.participants} onChangeParticipant={(pid) => setSelectedParticipantId(pid)} onBack={() => navigate(previousView)} onNavigateToCase={(caseToEdit) => navigate('observe', { caseToEdit, courseId: caseToEdit.courseId, participantId: caseToEdit.participant_id })} onShare={(participant) => handleShare(participant, 'participant')} />) : null;
            


case 'courseReport': return permissions.canViewCourse ? (selectedCourse && <CourseReportView course={selectedCourse} participants={courseDetails.participants} allObs={courseDetails.allObs} allCases={courseDetails.allCases} finalReportData={courseDetails.finalReport} onBack={() => navigate(previousView)} onEditFinalReport={handleEditFinalReport} onDeletePdf={handleDeletePdf} onViewParticipantReport={(pid) => { setSelectedParticipantId(pid); navigate('participantReport'); }} onShare={(course) => handleShare(course, 'course')} setToast={setToast} />) : null;

            case 'facilitatorForm': 
                return permissions.canManageHumanResource ? (<FacilitatorForm initialData={editingFacilitator} onCancel={() => navigate(previousView)} onSave={async (payload) => { try { setLoading(true); const { certificateFiles, ...data } = payload; let urls = data.certificateUrls || {}; if (certificateFiles) { for (const key in certificateFiles) { if (editingFacilitator?.certificateUrls?.[key]) await deleteFile(editingFacilitator.certificateUrls[key]); urls[key] = await uploadFile(certificateFiles[key]); } } const finalPayload = { ...data, id: editingFacilitator?.id, certificateUrls: urls }; delete finalPayload.certificateFiles; await upsertFacilitator(finalPayload); await fetchFacilitators(true); setToast({ show: true, message: 'Facilitator saved.', type: 'success' }); navigate('humanResources'); } catch (error) { setToast({ show: true, message: `Error saving: ${error.message}`, type: 'error' }); } finally { setLoading(false); } }} />) : null;
            
            case 'facilitatorReport': return permissions.canViewHumanResource ? (selectedFacilitator && <FacilitatorReportView facilitator={selectedFacilitator} allCourses={allCourses} onBack={() => navigate(previousView)} />) : null;
            case 'admin': return <AdminDashboard />;
            case 'dashboard': return <DashboardView onOpenCourseReport={handleOpenCourseReport} onOpenParticipantReport={(pId, cId) => navigate('participantReport', { openParticipantReport: pId, openCourseReport: cId })} onOpenFacilitatorReport={(id) => { setSelectedFacilitatorId(id); navigate('facilitatorReport'); }} permissions={permissions} userStates={userStates} STATE_LOCALITIES={STATE_LOCALITIES} />;
            case 'finalReport':
                return (
                    <FinalReportManager
                        course={finalReportCourse || selectedCourse}
                        participants={courseDetails.participants}
                        initialData={courseDetails.finalReport}
                        onSave={handleSaveFinalReport}
                        onCancel={() => navigate(previousView)}
                        canEditDeleteFinalReport={permissions.canUseFederalManagerAdvancedFeatures}
                    />
                );
            default: return <Landing navigate={navigate} permissions={permissions} />; // --- MODIFIED: Default to 'landing'
        }
    };

    // --- MODIFIED: Added 'Home' item pointing to 'landing' ---
    const navItems = useMemo(() => [
        { label: 'Home', view: 'landing', active: view === 'landing', disabled: false },
        // --- MODIFIED: Dashboard is no longer disabled by permissions ---
        { label: 'Dashboard', view: 'dashboard', active: view === 'dashboard', disabled: false },
        { label: 'Courses', view: 'courses', active: ['courses', 'courseForm', 'courseReport', 'participants', 'participantForm', 'participantReport', 'observe', 'monitoring', 'reports', 'finalReport', 'participantMigration', 'courseDetails'].includes(view), disabled: !permissions.canViewCourse },
        { label: 'Human Resources', view: 'humanResources', active: ['humanResources', 'facilitatorForm', 'facilitatorReport'].includes(view), disabled: !permissions.canViewHumanResource },
        { label: 'Child Health Services', view: 'childHealthServices', active: view === 'childHealthServices', disabled: !permissions.canViewFacilities }, 
    ], [view, permissions]);

    const visibleNavItems = useMemo(() => navItems.filter(item => !item.disabled), [navItems]);

    const isPublicView = isPublicSubmissionView || isNewFacilityView || isPublicFacilityUpdateView;
    let mainContent;

    if ((authLoading || permissionsLoading) && !isPublicView && !isSharedView) {
        mainContent = <SplashScreen />;
    }
    else if (isPublicFacilityUpdateView) {
        mainContent = <PublicFacilityUpdateForm setToast={setToast} />;
    }
    else if (isNewFacilityView) {
        mainContent = <NewFacilityEntryForm setToast={setToast} />;
    }
    else if (isPublicSubmissionView) {
        if (submissionType === 'facilitator-application') mainContent = <FacilitatorApplicationForm />;
        else if (submissionType === 'team-member-application') mainContent = <TeamMemberApplicationForm />;
        else mainContent = <div className="p-8 text-center">Invalid form link.</div>;
    }
    else if (isSharedView) {
        if (sharedViewError) {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{sharedViewError}</div></Card>;
        } else if (!sharedReportData) {
            mainContent = <Card><div className="flex justify-center p-8"><Spinner /></div></Card>;
        } else {
            mainContent = (
                <CourseReportView
                    course={sharedReportData.course}
                    participants={sharedReportData.participants}
                    allObs={sharedReportData.allObs}
                    allCases={sharedReportData.allCases}
                    finalReportData={sharedReportData.finalReport}
                    isSharedView={true}
                    onBack={() => {}}
                    onShare={() => {}}
                />
            );
        }
    }
    else if (!user && !authLoading) {
        mainContent = <SignInBox />;
    }
    else {
        mainContent = renderView();
    }


    return (
        <div className="min-h-screen bg-sky-50 flex flex-col">
            <header className="bg-slate-800 shadow-lg sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex items-center justify-between">
                        {/* --- MODIFIED: Logo now navigates to 'landing' --- */}
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => !isSharedView && navigate('landing')}>
                            <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md"><img src="/child.png" alt="NCHP Logo" className="h-12 w-12 object-contain" /></div>
                            <div><h1 className="text-xl sm:text-2xl font-bold text-white">National Child Health Program</h1><p className="text-sm text-slate-300 hidden sm:block">Program & Course Monitoring System</p></div>
                        </div>
                        {!isSharedView && !isPublicView && user && (<nav className="hidden md:flex items-center gap-1">{visibleNavItems.map(item => (<button key={item.label} onClick={() => navigate(item.view)} className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${item.active ? 'bg-sky-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}>{item.label}</button>))} </nav>)}
                    </div>
                </div>
            </header>

            {user && !isSharedView && !isPublicView && (
                <div className="bg-slate-700 text-slate-200 p-2 md:p-3 text-center flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2"><span>Welcome, {user.email}</span>{userRole && <span className="bg-sky-600 text-xs px-2 py-1 rounded">{userRole}</span>}</div>
                    {permissions.canViewAdmin && (<Button onClick={() => navigate('admin')} variant="primary">Admin Dashboard</Button>)}
                    <Button onClick={handleLogout} className="px-3 py-1 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">Logout</Button>
                </div>
            )}
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}

            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full flex-grow mb-16 md:mb-0 overflow-x-hidden">
                <Suspense fallback={<Card><Spinner /></Card>}>
                    {mainContent}
                </Suspense>
            </main>

            <Footer />
            { user && !isSharedView && !isPublicView && <BottomNav navItems={visibleNavItems} navigate={navigate} /> }

            <Suspense fallback={null}>
                {isShareModalOpen && user && (
                     <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} shareableItem={itemToShare} shareType={shareType} onSave={handleSaveSharingSettings} />
                )}
            </Suspense>
        </div>
    );
}