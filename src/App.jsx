// App.jsx
import React, { useEffect, useMemo, useState, useRef, lazy, Suspense, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';

// --- NEW: Import icons from lucide-react ---
import {
    Home,
    Book,
    Users,
    User,
    Hospital,
    Database,
    ClipboardCheck
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);

// --- Lazy Load View Components ---
const DashboardView = lazy(() => import('./components/DashboardView'));
const CourseReportView = lazy(() => import('./components/CourseReportView.jsx').then(module => ({ default: module.CourseReportView })));
const ShareModal = lazy(() => import('./components/ShareModal').then(module => ({ default: module.ShareModal })));
const FinalReportManager = lazy(() => import('./components/FinalReportManager.jsx').then(module => ({ default: module.FinalReportManager })));
const ObservationView = lazy(() => import('./components/MonitoringView').then(module => ({ default: module.ObservationView })));
const ReportsView = lazy(() => import('./components/ReportsView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ParticipantReportView = lazy(() => import('./components/ParticipantReport').then(module => ({ default: module.ParticipantReportView })));
const ChildHealthServicesView = lazy(() => import('./components/ChildHealthServicesView.jsx'));
const HumanResourcesPage = lazy(() => import('./components/HumanResources').then(module => ({ default: module.HumanResourcesPage })));
const FacilitatorForm = lazy(() => import('./components/Facilitator').then(module => ({ default: module.FacilitatorForm })));
const FacilitatorReportView = lazy(() => import('./components/Facilitator').then(module => ({ default: module.FacilitatorReportView })));
const FacilitatorApplicationForm = lazy(() => import('./components/Facilitator').then(module => ({ default: module.FacilitatorApplicationForm })));
const CourseManagementView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.CourseManagementView })));
const CourseForm = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.CourseForm })));
// --- NEW: Import PublicCourseMonitoringView from Course.jsx ---
const PublicCourseMonitoringView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicCourseMonitoringView })));
const ProgramTeamView = lazy(() => import('./components/ProgramTeamView').then(module => ({ default: module.ProgramTeamView })));
const TeamMemberApplicationForm = lazy(() => import('./components/ProgramTeamView').then(module => ({ default: module.TeamMemberApplicationForm })));
const ParticipantsView = lazy(() => import('./components/Participants').then(module => ({ default: module.ParticipantsView })));
const ParticipantForm = lazy(() => import('./components/Participants').then(module => ({ default: module.ParticipantForm })));
const ParticipantMigrationMappingView = lazy(() => import('./components/Participants').then(module => ({ default: module.ParticipantMigrationMappingView })));
const PublicFacilityUpdateForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.PublicFacilityUpdateForm })));
const NewFacilityEntryForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.NewFacilityEntryForm })));
const SkillsMentorshipView = lazy(() => import('./components/SkillsMentorshipView.jsx'));


// --- Data & Component Imports ---
import {
    upsertCourse, deleteCourse, listParticipants, deleteParticipant, listObservationsForParticipant,
    listCasesForParticipant, listAllDataForCourse, upsertFacilitator, deleteFacilitator, importParticipants,
    upsertCoordinator, upsertFunder, upsertFinalReport, getFinalReportByCourseId, uploadFile, deleteFile,
    getCourseById, getParticipantById, updateCourseSharingSettings, updateParticipantSharingSettings,
    listPendingFacilitatorSubmissions, approveFacilitatorSubmission, rejectFacilitatorSubmission,
    saveParticipantAndSubmitFacilityUpdate, bulkMigrateFromMappings,
    getPublicCourseReportData,
    initializeUsageTracking,
    // --- NEW: Import listAllParticipantsForCourse ---
    listAllParticipantsForCourse,
    listMentorshipSessions,
    saveMentorshipSession,
    importMentorshipSessions
} from './data.js';
import { STATE_LOCALITIES } from './components/constants.js';
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
// --- Mobile Navigation Icons & Components ---
// --- REMOVED: Inline SVG components (HomeIcon, CoursesIcon, etc.) ---
// --- They are now imported from lucide-react ---


// --- Resource Monitor Component ---
const ResourceMonitor = ({ counts, onReset }) => {
    return (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-3 rounded-lg shadow-lg z-50 opacity-90 w-64">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    {/* --- MODIFIED: Use lucide-react icon --- */}
                    <Database className="w-5 h-5 text-sky-400" />
                    <h4 className="font-bold text-base">Session Ops</h4>
                </div>
                <button
                    onClick={onReset}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                    title="Reset Counts"
                >
                    Reset
                </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                    <div className="text-xs text-gray-400 uppercase">Reads</div>
                    <div className="text-2xl font-mono font-bold text-green-400">{counts.reads}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-400 uppercase">Writes</div>
                    <div className="text-2xl font-mono font-bold text-yellow-400">{counts.writes}</div>
                </div>
            </div>
        </div>
    );
};

// --- Landing Page Component ---
function Landing({ navigate, permissions }) {
    // --- MODIFIED: Use lucide-react components directly ---
    const navButtons = [
        { label: 'Dashboard', view: 'dashboard', icon: Home, permission: true },
        { label: 'Courses', view: 'courses', icon: Book, permission: permissions.canViewCourse },
        { label: 'Human Resources', view: 'humanResources', icon: Users, permission: permissions.canViewHumanResource },
        { label: 'Child Health Services', view: 'childHealthServices', icon: Hospital, permission: permissions.canViewFacilities },
        { label: 'Skills Mentorship', view: 'skillsMentorship', icon: ClipboardCheck, permission: permissions.canViewSkillsMentorship },
        { label: 'Admin', view: 'admin', icon: User, permission: permissions.canViewAdmin },
    ];

    const accessibleButtons = navButtons.filter(btn => btn.permission);

    return (
        <Card>
            <PageHeader title="Welcome" subtitle="Select a module to get started" />
            <div className="p-4">
                {accessibleButtons.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {accessibleButtons.map(btn => {
                            const Icon = btn.icon; // Icon is now the component itself (e.g., Home)
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

const BottomNav = React.memo(function BottomNav({ navItems, navigate }) {
    // --- MODIFIED: Use lucide-react components directly ---
    const icons = { Dashboard: Home, Home: Home, Courses: Book, 'Human Resources': Users, 'Child Health Services': Hospital, 'Skills Mentorship': ClipboardCheck, Admin: User };
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
        courses: allCourses,
        facilitators: allFacilitators,
        funders, federalCoordinators, stateCoordinators, localityCoordinators,
        healthFacilities,
        fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators,
        fetchHealthFacilities,
        fetchSkillMentorshipSubmissions,
    } = useDataCache();
    const { user, userStates, authLoading, userLocalities } = useAuth();

    const [view, setView] = useState("landing");
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
    const [publicServiceType, setPublicServiceType] = useState(null);
    const [publicMentorshipProps, setPublicMentorshipProps] = useState(null);
    const [submissionType, setSubmissionType] = useState(null);
    const [sharedReportData, setSharedReportData] = useState(null);
    const [sharedViewError, setSharedViewError] = useState(null);
    const [sharedViewRequiresLogin, setSharedViewRequiresLogin] = useState(false);

    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [itemToShare, setItemToShare] = useState(null);
    const [shareType, setShareType] = useState('course');

    // --- MODIFIED: State for public monitoring view ---
    const [isPublicMonitoringView, setIsPublicMonitoringView] = useState(false);
    const [publicMonitorData, setPublicMonitorData] = useState({ course: null, participants: [] });
    const [publicMonitorLoading, setPublicMonitorLoading] = useState(false);
    const [publicMonitorError, setPublicMonitorError] = useState(null);

    // State for operation counts (for the real-time monitor)
    const [operationCounts, setOperationCounts] = useState({ reads: 0, writes: 0 });

    const historyInitialized = useRef(false);
    const isPopStateNavigation = useRef(false);
    const initialViewIsSet = useRef(false);

    // Initialize usage tracking from data.js when auth is ready
    useEffect(() => {
        if (!authLoading && user) {
            initializeUsageTracking();
        }
    }, [authLoading, user]);


    // Effect to listen for custom operation events for the real-time monitor
    useEffect(() => {
      const handleOperation = (event) => {
        const { type, count } = event.detail;
        setOperationCounts(prev => ({
          ...prev,
          [type === 'read' ? 'reads' : 'writes']: (prev[type === 'read' ? 'reads' : 'writes'] || 0) + count
        }));
      };

      window.addEventListener('firestoreOperation', handleOperation);
      return () => {
        window.removeEventListener('firestoreOperation', handleOperation);
      };
    }, []);

    // --- MODIFIED: useEffect for path handling ---
    useEffect(() => {
        if (historyInitialized.current) return;
        historyInitialized.current = true;

        const handlePathChange = () => {
            const path = window.location.pathname;

            setIsSharedView(false);
            setIsPublicSubmissionView(false);
            setIsNewFacilityView(false);
            setIsPublicFacilityUpdateView(false);
            setPublicServiceType(null); 
            setIsPublicMonitoringView(false); 
            setPublicMonitorError(null); 
            setPublicMonitorData({ course: null, participants: [] }); 
            setPublicMentorshipProps(null);
            setSubmissionType(null);
            setSharedViewError(null);

            const facilityUpdateMatch = path.match(/^\/facilities\/data-entry\/([a-zA-Z0-9]+)\/?$/);
            if (path.startsWith('/facilities/data-entry/new')) {
                setIsNewFacilityView(true);
                // --- MODIFICATION: Read query param for 'new' route as well ---
                const searchParams = new URLSearchParams(window.location.search);
                const service = searchParams.get('service');
                if (service) {
                    setPublicServiceType(service); 
                }
                // --- END MODIFICATION ---
                return;
            }
            if (facilityUpdateMatch) {
                setIsPublicFacilityUpdateView(true);
                const searchParams = new URLSearchParams(window.location.search);
                const service = searchParams.get('service');
                if (service) {
                    setPublicServiceType(service); 
                }
                return;
            }

            // --- MODIFIED: Public Monitoring Link for COURSE ---
            const publicMonitorMatch = path.match(/^\/monitor\/course\/([a-zA-Z0-9]+)\/?$/);
            if (publicMonitorMatch && publicMonitorMatch[1]) {
                setIsPublicMonitoringView(true);
                const courseId = publicMonitorMatch[1];
                // Fetch data right here
                setPublicMonitorLoading(true);
                const fetchData = async () => {
                    try {
                        const [courseData, participantData] = await Promise.all([
                            getCourseById(courseId, 'server'),
                            listAllParticipantsForCourse(courseId, 'server') // Fetch all participants
                        ]);
                        if (!courseData) throw new Error('Course not found.');
                        if (!participantData) throw new Error('Participants not found.'); 
                        setPublicMonitorData({ course: courseData, participants: participantData });
                        setPublicMonitorError(null);
                    } catch (err) {
                        setPublicMonitorError(err.message);
                    } finally {
                        setPublicMonitorLoading(false);
                    }
                };
                fetchData();
                return; // Stop processing
            }

            // Public Mentorship Link - path still checked, authentication check moved to render logic
            const publicMentorshipMatch = path.match(/^\/mentorship\/submit\/([a-zA-Z0-9_]+)\/?$/);
            if (publicMentorshipMatch && publicMentorshipMatch[1]) {
                setPublicMentorshipProps({ serviceType: publicMentorshipMatch[1] });
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
    // --- END MODIFICATION ---

    const ALL_PERMISSIONS_MINIMAL = useMemo(() => {
        return ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), { canViewSkillsMentorship: false });
    }, [ALL_PERMISSION_KEYS]);

    const permissions = useMemo(() => {
        let derivedPermissions = { ...userPermissions };
        if (userRole?.toLowerCase() === 'super_user') {
            return ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), { canViewSkillsMentorship: true });
        }
        return { ...ALL_PERMISSIONS_MINIMAL, ...derivedPermissions };
    }, [userRole, userPermissions, ALL_PERMISSIONS_MINIMAL, ALL_PERMISSION_KEYS]);

    useEffect(() => {
        if (user && !permissionsLoading && !initialViewIsSet.current) {
            setView("landing");
            initialViewIsSet.current = true;
        }
    }, [user, permissionsLoading]);

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
                        const rawPerms = DEFAULT_ROLE_PERMISSIONS.user;
                        permissionsData = applyDerivedPermissions(rawPerms);
                        await setDoc(userRef, { email: user.email, role: role, permissions: permissionsData, lastLogin: new Date(), assignedState: '' }, { merge: true });
                    } else {
                        role = userSnap.data().role;
                        const rawPerms = { ...ALL_PERMISSIONS_MINIMAL, ...(userSnap.data().permissions || {}) };
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
                setUserPermissions(applyDerivedPermissions(DEFAULT_ROLE_PERMISSIONS.user));
            } finally {
                setPermissionsLoading(false);
            }
        };
        checkUserRoleAndPermissions();
    }, [user, ALL_PERMISSIONS_MINIMAL, DEFAULT_ROLE_PERMISSIONS]);

    useEffect(() => {
        if (!user) {
            initialViewIsSet.current = false;
        }
    }, [user]);

    useEffect(() => {
        const handlePopState = (event) => {
            isPopStateNavigation.current = true;
            if (window.location.pathname === '/') {
                navigate('landing');
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


    // This effect fetches data ON DEMAND based on view
    useEffect(() => {
        if (isSharedView || !user) return;

        // Fetch facilities on dashboard, human resources, and skills mentorship views
        if (view === 'dashboard') {
            fetchCourses();
            fetchParticipants();
            fetchFacilitators();
            fetchHealthFacilities();
        }
        if (['humanResources', 'facilitatorForm', 'facilitatorReport', 'courseForm', 'dashboard', 'landing'].includes(view)) {
             fetchFacilitators();
        }
        if (['courseForm', 'humanResources'].includes(view)) {
            fetchFunders();
        }
        if (['courseForm'].includes(view)) {
            fetchCoordinators();
        }
        if (view === 'courses') {
            fetchCourses();
        }
        if (view === 'skillsMentorship') {
            fetchHealthFacilities();
            fetchSkillMentorshipSubmissions();
        }
        // --- MODIFICATION: Also fetch facilities when opening a course report ---
        if (view === 'courseReport') {
            fetchHealthFacilities();
        }
    }, [view, isSharedView, user, fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchCoordinators, fetchHealthFacilities, fetchSkillMentorshipSubmissions]);


    // --- FILTERING LOGIC ---
    const canSeeAllData = useMemo(() => {
        return permissions.canUseSuperUserAdvancedFeatures || permissions.canUseFederalManagerAdvancedFeatures;
    }, [permissions]);

    const filteredCourses = useMemo(() => {
        if (!allCourses) {
            return [];
        }
        if (canSeeAllData || !userStates || userStates.length === 0) {
            return allCourses;
        }
        const userStateSet = new Set(userStates);
        return allCourses.filter(c => userStateSet.has(c.state));
    }, [allCourses, userStates, canSeeAllData]);

    const filteredFacilitators = useMemo(() => {
        if (!allFacilitators) {
            return [];
        }
        if (canSeeAllData || !userStates || userStates.length === 0) {
            return allFacilitators;
        }
        const userStateSet = new Set(userStates);
        return allFacilitators.filter(f => userStateSet.has(f.currentState));
    }, [allFacilitators, userStates, canSeeAllData]);
    // --- END: FILTERING LOGIC ---

    const fetchPendingSubmissions = useCallback(async () => {
        if (!permissions.canApproveSubmissions) return;
        setIsSubmissionsLoading(true);
        try {
            const submissions = await listPendingFacilitatorSubmissions();
            setPendingSubmissions(submissions);
        } catch (error) { setToast({ show: true, message: 'Failed to load submissions.', type: 'error' }); } finally { setIsSubmissionsLoading(false); }
    }, [permissions.canApproveSubmissions]);

    useEffect(() => { if (view === 'humanResources' && activeHRTab === 'facilitators' && permissions.canApproveSubmissions) fetchPendingSubmissions(); }, [view, activeHRTab, permissions.canApproveSubmissions, fetchPendingSubmissions]);

    // Use the imported listAllParticipantsForCourse
    // const listAllParticipantsForCourse = ... (removed, now imported)

    const selectedCourse = useMemo(() => (allCourses || []).find(c => c.id === selectedCourseId) || null, [allCourses, selectedCourseId]);

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

    const selectedFacilitator = useMemo(() => (allFacilitators || []).find(f => f.id === selectedFacilitatorId) || null, [allFacilitators, selectedFacilitatorId]);

    // --- MODIFIED: navigate ---
    const navigate = useCallback((newView, state = {}) => {
        const viewPermissions = {
            'landing': true,
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
            'skillsMentorship': permissions.canViewSkillsMentorship,
            'facilitators': permissions.canViewHumanResource,
            'programTeams': permissions.canViewHumanResource,
            'partnersPage': permissions.canViewHumanResource,
        };

        if (user && !viewPermissions[newView]) {
            console.warn(`Access denied to view: ${newView}. Redirecting to landing.`);
            setView('landing');
            return;
        }

        setPreviousView(view);
        setEditingCourse(null);
        setEditingParticipant(null);
        setEditingFacilitator(null);
        setEditingCaseFromReport(null);

        if (state.courseId && state.courseId !== selectedCourseId) setSelectedCourseId(state.courseId);
        if (state.participantId && state.participantId !== selectedParticipantId) setSelectedParticipantId(state.participantId);
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

        if (['courses', 'humanResources', 'dashboard', 'admin', 'landing', 'skillsMentorship'].includes(newView)) {
            setSelectedCourseId(null);
            setSelectedParticipantId(null);
            setFinalReportCourse(null);
            setCourseDetails({ participants: [], allObs: [], allCases: [], finalReport: null });
            if (['dashboard', 'admin', 'landing', 'skillsMentorship'].includes(newView)) {
                setActiveCourseType(null);
            }
        }
        if ((view === 'observe' || view === 'participantReport') && !['observe', 'participantReport'].includes(newView)) {
            setSelectedParticipantId(null);
        }
    }, [view, selectedCourseId, selectedParticipantId, permissions, user, isCourseActive]);
    // --- END MODIFICATION ---

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
            navigate('participants', { courseId });
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
        if (!permissions.canManageCourse) return;
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
        if (!permissions.canManageCourse) return;
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
        if (!permissions.canManageHumanResource) return;
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
    const handleExecuteBulkMigration = useCallback(async (mappings) => { /* Uses wrapped functions */ }, [navigate]);
    const handleAddNewCoordinator = useCallback(async (coordinatorData) => { await upsertCoordinator(coordinatorData); await fetchCoordinators(true); }, [fetchCoordinators]);
    const handleAddNewFunder = useCallback(async (funderData) => { await upsertFunder(funderData); await fetchFunders(true); }, [fetchFunders]);

    const handleAddFinalReport = useCallback(async (courseId) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;
        const courseToReport = (allCourses || []).find(c => c.id === courseId);
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
        } finally { setLoading(false); }
    }, [permissions, allCourses, navigate]);

    const handleSaveFinalReport = useCallback(async (reportData) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;
        setLoading(true);
        try {
            let pdfUrl = reportData.existingPdfUrl || null;
            if (reportData.pdfFile) { if (pdfUrl) await deleteFile(pdfUrl); pdfUrl = await uploadFile(reportData.pdfFile); }
            const finalUrlsToSave = [];
            const originalUrls = reportData.originalGalleryUrls || [];
            const finalUrlsFromEditor = reportData.finalGalleryUrls || [];
            const filesToUpload = reportData.galleryImageFiles || {};
            for (let i = 0; i < 3; i++) {
                const originalUrl = originalUrls[i]; const finalUrl = finalUrlsFromEditor[i]; const newFile = filesToUpload[i];
                if (newFile) { if (originalUrl) await deleteFile(originalUrl); const uploadedUrl = await uploadFile(newFile); finalUrlsToSave.push(uploadedUrl); }
                else if (finalUrl) { finalUrlsToSave.push(finalUrl); }
                else if (originalUrl && !finalUrl) { await deleteFile(originalUrl); }
            }
            const payload = { id: reportData.id, courseId: reportData.courseId, summary: reportData.summary, recommendations: reportData.recommendations, potentialFacilitators: reportData.potentialFacilitators, pdfUrl: pdfUrl, galleryImageUrls: finalUrlsToSave, participantsForFollowUp: reportData.participantsForFollowUp };
            await upsertFinalReport(payload);
            const savedReport = await getFinalReportByCourseId(reportData.courseId);
            setCourseDetails(prev => ({...prev, finalReport: savedReport }));
            setToast({ show: true, message: 'Final report saved successfully.', type: 'success' });
        } catch (error) {
            console.error("Error saving final report:", error);
            setToast({ show: true, message: `Error saving final report: ${error.message}`, type: 'error' });
        } finally { setLoading(false); }
    }, [permissions]);

    const handleEditFinalReport = useCallback(async (courseId) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;
        const courseToEditReport = (allCourses || []).find(c => c.id === courseId);
        if (!courseToEditReport) { setToast({ show: true, message: 'Course not found.', type: 'error' }); return; }
        setFinalReportCourse(courseToEditReport); setSelectedCourseId(courseId); setLoading(true);
        try {
            const [participantsData, existingReport] = await Promise.all([ listAllParticipantsForCourse(courseId), getFinalReportByCourseId(courseId) ]);
            setCourseDetails(prev => ({ ...prev, participants: participantsData, finalReport: existingReport }));
            navigate('finalReport');
        } catch (error) { console.error("Error fetching final report for editing:", error); setToast({ show: true, message: 'Failed to load the final report.', type: 'error' }); }
        finally { setLoading(false); }
    }, [permissions, allCourses, navigate]);

    const handleDeletePdf = useCallback(async (courseId) => { /* ... unchanged ... */ }, [permissions, courseDetails.finalReport]);
    const handleLogout = useCallback(async () => { try { await signOut(auth); } catch (error) { console.error("Error signing out:", error); } }, []);
    const handleLoginForSharedView = useCallback(async () => { /* ... unchanged ... */ }, []);

    // Reset function for the monitor
    const handleResetMonitor = useCallback(() => {
        setOperationCounts({ reads: 0, writes: 0 });
    }, []);

    // --- MODIFIED: renderView ---
    const renderView = () => {
        const currentParticipant = (courseDetails.participants || []).find(p => p.id === selectedParticipantId);
        const viewToRender = view;

        switch (viewToRender) {
            case 'landing': return <Landing navigate={navigate} permissions={permissions} />;

            case 'humanResources': return <HumanResourcesPage
                activeTab={activeHRTab}
                setActiveTab={setActiveHRTab}
                onAddFacilitator={() => navigate('facilitatorForm')}
                onEditFacilitator={(f) => navigate('facilitatorForm', { editFacilitator: f })}
                onDeleteFacilitator={handleDeleteFacilitator}
                onOpenFacilitatorReport={(fid) => navigate('facilitatorReport', { openFacilitatorReport: fid })}
                onImportFacilitators={async (data) => { await importParticipants(data); await fetchFacilitators(true); }}
                userStates={userStates}
                onApproveSubmission={handleApproveSubmission}
                onRejectSubmission={handleRejectSubmission}
                permissions={permissions}
            />;

            case 'courses': return <CourseManagementView
                allCourses={filteredCourses}
                activeCourseType={activeCourseType}
                setActiveCourseType={setActiveCourseType}
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
                canManageCourse={permissions.canManageCourse}
                canUseSuperUserAdvancedFeatures={permissions.canUseSuperUserAdvancedFeatures}
                canUseFederalManagerAdvancedFeatures={permissions.canUseFederalManagerAdvancedFeatures}
                canEditDeleteActiveCourse={permissions.canManageCourse}
                canEditDeleteInactiveCourse={permissions.canUseFederalManagerAdvancedFeatures}
            />;

            case 'participantMigration': return selectedCourse && (permissions.canUseSuperUserAdvancedFeatures ? <ParticipantMigrationMappingView course={selectedCourse} participants={courseDetails.participants} onCancel={() => navigate('participants')} onSave={handleExecuteBulkMigration} setToast={setToast} /> : null);

            case 'childHealthServices':
                return permissions.canViewFacilities ? (
                    <ChildHealthServicesView
                        permissions={permissions}
                        setToast={setToast}
                        userStates={userStates}
                        userLocalities={userLocalities}
                        canManageFacilities={permissions.canManageFacilities}
                        canBulkUploadFacilities={permissions.canUseSuperUserAdvancedFeatures}
                        canCleanFacilityData={permissions.canUseSuperUserAdvancedFeatures}
                        canFindFacilityDuplicates={permissions.canUseSuperUserAdvancedFeatures}
                        canCheckFacilityLocations={permissions.canUseSuperUserAdvancedFeatures}
                    />
                ) : null;

            case 'skillsMentorship':
                return permissions.canViewSkillsMentorship ? (
                    <SkillsMentorshipView
                        setToast={setToast}
                        permissions={permissions}
                        userStates={userStates}
                        userLocalities={userLocalities}
                        canBulkUploadMentorships={permissions.canUseSuperUserAdvancedFeatures}
                    />
                ) : null;

            case 'monitoring': case 'observe':
                const canMonitor = (permissions.canManageCourse && isCourseActive) || permissions.canUseFederalManagerAdvancedFeatures;
                return canMonitor ? (selectedCourse && currentParticipant && <ObservationView course={selectedCourse} participant={currentParticipant} participants={courseDetails.participants} onChangeParticipant={(id) => setSelectedParticipantId(id)} initialCaseToEdit={editingCaseFromReport} />) : null;

            case 'courseForm': return permissions.canManageCourse ? (<CourseForm
                courseType={activeCourseType || editingCourse?.course_type}
                initialData={editingCourse}
                facilitatorsList={allFacilitators || []}
                onCancel={() => navigate(previousView)}
                onSave={async (payload) => { const id = await upsertCourse({ ...payload, id: editingCourse?.id, course_type: activeCourseType || editingCourse?.course_type }); await fetchCourses(true); handleOpenCourse(id); }}
                onAddNewFacilitator={async (data) => { await upsertFacilitator(data); await fetchFacilitators(true); }}
                onAddNewCoordinator={handleAddNewCoordinator}
                onAddNewFunder={handleAddNewFunder}
                fundersList={funders || []}
                federalCoordinatorsList={federalCoordinators || []}
                stateCoordinatorsList={stateCoordinators || []}
                localityCoordinatorsList={localityCoordinators || []}
            />) : null;

            case 'participantForm': return permissions.canManageCourse ? (selectedCourse && <ParticipantForm course={selectedCourse} initialData={editingParticipant} onCancel={() => navigate(previousView)} onSave={async (participantData, facilityUpdateData) => { try { const fullPayload = { ...participantData, id: editingParticipant?.id, courseId: selectedCourse.id }; await saveParticipantAndSubmitFacilityUpdate(fullPayload, facilityUpdateData); if (facilityUpdateData) setToast({ show: true, message: 'Facility update submitted for approval.', type: 'info' }); await handleOpenCourse(selectedCourse.id); navigate('participants'); } catch (e) { setToast({ show: true, message: `Submission failed: ${e.message}`, type: 'error' }); } }} />) : null;

            case 'participantReport': return permissions.canViewCourse ? (selectedCourse && currentParticipant && <ParticipantReportView course={selectedCourse} participant={currentParticipant} participants={courseDetails.participants} onChangeParticipant={(pid) => setSelectedParticipantId(pid)} onBack={() => navigate(previousView)} onNavigateToCase={(caseToEdit) => navigate('observe', { caseToEdit, courseId: caseToEdit.courseId, participantId: caseToEdit.participant_id })} onShare={(participant) => handleShare(participant, 'participant')} />) : null;

            case 'courseReport': return permissions.canViewCourse ? (selectedCourse && <CourseReportView course={selectedCourse} participants={courseDetails.participants} allObs={courseDetails.allObs} allCases={courseDetails.allCases} finalReportData={courseDetails.finalReport} onBack={() => navigate(previousView)} onEditFinalReport={handleEditFinalReport} onDeletePdf={handleDeletePdf} onViewParticipantReport={(pid) => { setSelectedParticipantId(pid); navigate('participantReport'); }} onShare={(course) => handleShare(course, 'course')} setToast={setToast} allHealthFacilities={healthFacilities} />) : null;

            case 'facilitatorForm':
                return permissions.canManageHumanResource ? (<FacilitatorForm initialData={editingFacilitator} onCancel={() => navigate(previousView)} onSave={async (payload) => { try { setLoading(true); const { certificateFiles, ...data } = payload; let urls = data.certificateUrls || {}; if (certificateFiles) { for (const key in certificateFiles) { if (editingFacilitator?.certificateUrls?.[key]) await deleteFile(editingFacilitator.certificateUrls[key]); urls[key] = await uploadFile(certificateFiles[key]); } } const finalPayload = { ...data, id: editingFacilitator?.id, certificateUrls: urls }; delete finalPayload.certificateFiles; await upsertFacilitator(finalPayload); await fetchFacilitators(true); setToast({ show: true, message: 'Facilitator saved.', type: 'success' }); navigate('humanResources'); } catch (error) { setToast({ show: true, message: `Error saving: ${error.message}`, type: 'error' }); } finally { setLoading(false); } }} />) : null;

            case 'facilitatorReport': return permissions.canViewHumanResource ? (selectedFacilitator && <FacilitatorReportView
                facilitator={selectedFacilitator}
                allCourses={allCourses || []}
                onBack={() => navigate(previousView)}
            />) : null;

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
            default: return <Landing navigate={navigate} permissions={permissions} />;
        }
    };
    // --- END MODIFICATION ---

    const navItems = useMemo(() => [
        { label: 'Home', view: 'landing', active: view === 'landing', disabled: false },
        { label: 'Dashboard', view: 'dashboard', active: view === 'dashboard', disabled: false },
        { label: 'Courses', view: 'courses', active: ['courses', 'courseForm', 'courseReport', 'participants', 'participantForm', 'participantReport', 'observe', 'monitoring', 'reports', 'finalReport', 'participantMigration', 'courseDetails'].includes(view), disabled: !permissions.canViewCourse },
        { label: 'Human Resources', view: 'humanResources', active: ['humanResources', 'facilitatorForm', 'facilitatorReport'].includes(view), disabled: !permissions.canViewHumanResource },
        { label: 'Child Health Services', view: 'childHealthServices', active: view === 'childHealthServices', disabled: !permissions.canViewFacilities },
        { label: 'Skills Mentorship', view: 'skillsMentorship', active: view === 'skillsMentorship', disabled: !permissions.canViewSkillsMentorship },
    ], [view, permissions]);

    const visibleNavItems = useMemo(() => navItems.filter(item => !item.disabled), [navItems]);

    // isApplicationPublicView includes forms that ARE public (like application forms, facility updates, and shared reports)
    const isApplicationPublicView = isPublicSubmissionView || isNewFacilityView || isPublicFacilityUpdateView || isSharedView;
    // isMentorshipPublicView is a specific path, but access is now restricted to logged-in users.
    const isMentorshipPublicView = !!publicMentorshipProps; 

    // This checks if the user is on *any* minimal UI path (whether authenticated or not)
    const isMinimalUILayout = isApplicationPublicView || isMentorshipPublicView || isPublicMonitoringView;

    let mainContent;

    if ((authLoading || permissionsLoading) && !isMinimalUILayout) {
        mainContent = <SplashScreen />;
    }
    // --- MODIFICATION: Added authLoading check ---
    else if (isPublicFacilityUpdateView) {
        if (authLoading) {
            mainContent = <Card><Spinner /></Card>;
        } else if (!user) {
            mainContent = <SignInBox message="You must sign in to use this facility data entry form." />;
        } else {
            mainContent = <PublicFacilityUpdateForm setToast={setToast} serviceType={publicServiceType} />;
        }
    }
    // --- MODIFICATION: Added authLoading check ---
    else if (isNewFacilityView) {
        if (authLoading) {
            mainContent = <Card><Spinner /></Card>;
        } else if (!user) {
            mainContent = <SignInBox message="You must sign in to use this new facility entry form." />;
        } else {
            // --- MODIFICATION: Pass publicServiceType as a prop ---
            mainContent = <NewFacilityEntryForm setToast={setToast} serviceType={publicServiceType} />;
        }
    }
    // --- END MODIFICATION ---
    // --- MODIFICATION: Added authLoading check ---
    else if (isPublicSubmissionView) {
        if (authLoading) {
            mainContent = <Card><Spinner /></Card>;
        } else if (!user) {
            mainContent = <SignInBox message="You must sign in to submit an application." />;
        } else {
            if (submissionType === 'facilitator-application') mainContent = <FacilitatorApplicationForm />;
            else if (submissionType === 'team-member-application') mainContent = <TeamMemberApplicationForm />;
            else mainContent = <div className="p-8 text-center">Invalid form link.</div>;
        }
    }
    // --- END MODIFICATION ---
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
                    allHealthFacilities={null} // Public reports don't have access to all facilities for coverage calculation
                    isSharedView={true}
                    onBack={() => {}}
                    onShare={() => {}}
                />
            );
        }
    }
    // --- MODIFICATION: Added authLoading check ---
    else if (isPublicMonitoringView) {
        if (authLoading) {
             mainContent = <Card><Spinner /></Card>;
        } else if (!user) {
            mainContent = <SignInBox message="You must sign in to access the public monitoring page." />;
        } else if (publicMonitorLoading) {
            mainContent = <Card><div className="flex justify-center p-8"><Spinner /></div></Card>;
        } else if (publicMonitorError) {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{publicMonitorError}</div></Card>;
        } else if (publicMonitorData.course && publicMonitorData.participants) {
            mainContent = (
                <PublicCourseMonitoringView
                    course={publicMonitorData.course}
                    allParticipants={publicMonitorData.participants}
                />
            );
        } else {
             mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">Could not load monitoring session.</div></Card>;
        }
    }
    // --- END MODIFICATION ---
    // --- MODIFICATION: Added authLoading check ---
    else if (isMentorshipPublicView) {
        if (authLoading) {
            mainContent = <Card><Spinner /></Card>;
        } else if (!user) { // CRITICAL CHECK: If user is NOT authenticated, show sign-in
            mainContent = <SignInBox message="You must sign in to use the mentorship submission link." />;
        } else {
            // User IS authenticated, proceed to render the Mentorship View with minimal UI
            mainContent = (
                <SkillsMentorshipView
                    setToast={setToast}
                    permissions={permissions} // Pass actual permissions
                    userStates={userStates} // Pass actual states
                    userLocalities={userLocalities} // Pass actual localities
                    publicSubmissionMode={true} // Keep publicSubmissionMode to enable setup mode
                    publicServiceType={publicMentorshipProps.serviceType}
                    canBulkUploadMentorships={permissions.canUseSuperUserAdvancedFeatures}
                />
            );
        }
    }
    // --- END MODIFICATION ---
    // Standard authenticated view
    else if (!user && !authLoading) {
        mainContent = <SignInBox />;
    }
    else {
        mainContent = renderView();
    }


    return (
        <div className="min-h-screen bg-sky-50 flex flex-col">
            {/* --- MODIFIED HEADER: Always show logo, hide nav bar if minimal layout --- */}
            <header className="bg-slate-800 shadow-lg sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex items-center justify-between">
                        {/* Always show the logo/title block */}
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => !isSharedView && navigate('landing')}>
                            <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md">
                                {/* --- MODIFICATION: Changed to absolute path --- */}
                                <img src="/child.png" alt="NCHP Logo" className="h-12 w-12 object-contain" />
                                {/* --- END MODIFICATION --- */}
                            </div>
                            <div><h1 className="text-xl sm:text-2xl font-bold text-white">National Child Health Program</h1><p className="text-sm text-slate-300 hidden sm:block">Program & Course Monitoring System</p></div>
                        </div>
                        {/* Only show the full navigation for authenticated users NOT on a minimal UI path */}
                        {!isMinimalUILayout && user && (
                            <nav className="hidden md:flex items-center gap-1">
                                {visibleNavItems.map(item => (
                                    <button key={item.label} onClick={() => navigate(item.view)} className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${item.active ? 'bg-sky-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}>
                                        {item.label}
                                    </button>
                                ))} 
                            </nav>
                        )}
                    </div>
                </div>
            </header>
            {/* --- END MODIFIED HEADER --- */}

            {/* --- User/Admin Info Bar: Hidden if minimal layout OR not logged in --- */}
            {user && !isMinimalUILayout && (
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
            {/* --- Mobile Nav: Hidden if minimal layout OR not logged in --- */}
            { user && !isMinimalUILayout && <BottomNav navItems={visibleNavItems} navigate={navigate} /> }

            <Suspense fallback={null}>
                {isShareModalOpen && user && (
                     <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} shareableItem={itemToShare} shareType={shareType} onSave={handleSaveSharingSettings} />
                )}
            </Suspense>

            {/* --- Conditionally render the Resource Monitor for Super Users --- */}
            {permissions.canUseSuperUserAdvancedFeatures && (
                <ResourceMonitor
                    counts={operationCounts}
                    onReset={handleResetMonitor}
                />
            )}
        </div>
    );
}