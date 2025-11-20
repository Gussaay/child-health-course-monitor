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
    ClipboardCheck,
    X 
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
const PublicCourseMonitoringView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicCourseMonitoringView })));
const ProgramTeamView = lazy(() => import('./components/ProgramTeamView.jsx'));
const PublicTeamMemberProfileView = lazy(() => import('./components/ProgramTeamView.jsx').then(module => ({ default: module.PublicTeamMemberProfileView })));
const TeamMemberApplicationForm = lazy(() => import('./components/ProgramTeamView.jsx').then(module => ({ default: module.TeamMemberApplicationForm })));
const ParticipantsView = lazy(() => import('./components/Participants').then(module => ({ default: module.ParticipantsView })));
const ParticipantForm = lazy(() => import('./components/Participants').then(module => ({ default: module.ParticipantForm })));
const ParticipantMigrationMappingView = lazy(() => import('./components/Participants').then(module => ({ default: module.ParticipantMigrationMappingView })));

// --- NEW: Import CertificateVerificationView from Course.jsx ---
const CertificateVerificationView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.CertificateVerificationView })));

const CourseTestForm = lazy(() => import('./components/CourseTestForm.jsx').then(module => ({ default: module.CourseTestForm })));

const PublicFacilityUpdateForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.PublicFacilityUpdateForm })));
const NewFacilityEntryForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.NewFacilityEntryForm })));
const SkillsMentorshipView = lazy(() => import('./components/mentorship/SkillsMentorshipView.jsx'));


// --- Data & Component Imports ---
import {
    upsertCourse, deleteCourse, listParticipants, deleteParticipant, listObservationsForParticipant,
    listCasesForParticipant, listAllDataForCourse, upsertFacilitator, deleteFacilitator, importParticipants,
    upsertCoordinator, upsertFunder, upsertFinalReport, getFinalReportByCourseId, uploadFile, deleteFile,
    getCourseById, getParticipantById, updateCourseSharingSettings, updateParticipantSharingSettings,
    listPendingFacilitatorSubmissions, approveFacilitatorSubmission, rejectFacilitatorSubmission,
    saveParticipantAndSubmitFacilityUpdate, bulkMigrateFromMappings,
    getPublicCourseReportData,
    getPublicFacilitatorReportData,
    getPublicTeamMemberProfileData,
    initializeUsageTracking,
    listAllParticipantsForCourse,
    listParticipantTestsForCourse, 
    listMentorshipSessions,
    saveMentorshipSession,
    importMentorshipSessions,
    upsertParticipantTest
} from './data.js';
import { STATE_LOCALITIES } from './components/constants.js';
import { Card, PageHeader, Button, Table, EmptyState, Spinner, PdfIcon, CourseIcon, Footer, Toast } from './components/CommonComponents';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useDataCache } from './DataContext';
import { useAuth } from './hooks/useAuth';
import { SignInBox } from './auth-ui.jsx';

// --- CRITICAL FIX: Permissions Defined Locally to Avoid Circular Dependency ---
const ALL_PERMISSIONS = {
    canViewDashboard: true,
    canViewCourse: true,
    canViewHumanResource: true,
    canViewFacilities: true,
    canViewSkillsMentorship: true,
    canViewAdmin: true,
    canManageCourse: true,
    canManageHumanResource: true,
    canManageFacilities: true,
    canApproveSubmissions: true,
    canUseSuperUserAdvancedFeatures: true,
    canUseFederalManagerAdvancedFeatures: true,
};

const ALL_PERMISSION_KEYS = Object.keys(ALL_PERMISSIONS);

const DEFAULT_ROLE_PERMISSIONS = {
    'super_user': ALL_PERMISSION_KEYS,
    'federal_manager': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship',
        'canManageCourse', 'canManageHumanResource', 'canManageFacilities',
        'canApproveSubmissions', 'canUseFederalManagerAdvancedFeatures'
    ],
    'state_manager': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship',
        'canManageCourse', 'canManageHumanResource', 'canManageFacilities'
    ],
    'locality_manager': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship',
        'canManageCourse',
        'canManageFacilities'
    ],
    'user': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship'
    ]
};

const applyDerivedPermissions = (basePermissions) => {
    return basePermissions;
};
// --- END CRITICAL FIX ---


// --- Resource Monitor Component ---
const ResourceMonitor = ({ counts, onReset, onDismiss }) => {
    return (
        <div className="fixed top-4 right-4 md:bottom-4 md:top-auto bg-gray-900 text-white p-2 rounded-lg shadow-lg z-50 opacity-90 w-56">
            <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-sky-400" />
                    <h4 className="font-bold text-sm">Session Ops</h4>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onReset}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                        title="Reset Counts"
                    >
                        Reset
                    </button>
                    <button
                        onClick={onDismiss}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Dismiss Monitor"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                    <div className="text-[10px] text-gray-400 uppercase">Reads</div>
                    <div className="text-xl font-mono font-bold text-green-400">{counts.reads}</div>
                </div>
                <div>
                    <div className="text-[10px] text-gray-400 uppercase">Writes</div>
                    <div className="text-xl font-mono font-bold text-yellow-400">{counts.writes}</div>
                </div>
            </div>
        </div>
    );
};

// --- Landing Page Component ---
function Landing({ navigate, permissions }) {
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

const BottomNav = React.memo(function BottomNav({ navItems, navigate }) {
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
        participantTests, 
        fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators,
        fetchHealthFacilities,
        fetchSkillMentorshipSubmissions,
        fetchParticipantTests
    } = useDataCache();
    const { user, userStates, authLoading, userLocalities } = useAuth();

    const isProfileIncomplete = useMemo(() => {
        if (!authLoading && user && (!user.displayName || user.displayName.trim().length === 0)) {
            return true;
        }
        return false;
    }, [user, authLoading]);

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

    const [courseDetails, setCourseDetails] = useState({ participants: null, allObs: null, allCases: null, finalReport: null, participantTests: null });
    
    const [courseDetailsLoading, setCourseDetailsLoading] = useState(false);
    
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
    
    const [publicViewData, setPublicViewData] = useState(null);
    const [publicViewType, setPublicViewType] = useState(null); 
    const [publicViewLoading, setPublicViewLoading] = useState(false);

    const [isPublicMonitoringView, setIsPublicMonitoringView] = useState(false);
    const [publicMonitorData, setPublicMonitorData] = useState({ course: null, participants: [] });
    const [publicMonitorLoading, setPublicMonitorLoading] = useState(false);
    const [publicMonitorError, setPublicMonitorError] = useState(null);

    const [isPublicTestView, setIsPublicTestView] = useState(false);
    const [publicTestData, setPublicTestData] = useState({ course: null, participants: [], tests: [] });
    const [publicTestLoading, setPublicTestLoading] = useState(false);
    const [publicTestError, setPublicTestError] = useState(null);

    const [operationCounts, setOperationCounts] = useState({ reads: 0, writes: 0 });
    const [isMonitorVisible, setIsMonitorVisible] = useState(true);

    const historyInitialized = useRef(false);
    const isPopStateNavigation = useRef(false);
    const initialViewIsSet = useRef(false);

    useEffect(() => {
        if (!authLoading && user) {
            initializeUsageTracking();
        }
    }, [authLoading, user]);


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

    useEffect(() => {
        if (historyInitialized.current) return;
        historyInitialized.current = true;

        const handlePathChange = async () => { 
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
            
            setPublicViewData(null);
            setPublicViewType(null);
            setPublicViewLoading(false);

            setIsPublicTestView(false);
            setPublicTestError(null);
            setPublicTestData({ course: null, participants: [], tests: [] });


            const facilityUpdateMatch = path.match(/^\/facilities\/data-entry\/([a-zA-Z0-9]+)\/?$/);
            if (path.startsWith('/facilities/data-entry/new')) {
                setIsNewFacilityView(true);
                const searchParams = new URLSearchParams(window.location.search);
                const service = searchParams.get('service');
                if (service) {
                    setPublicServiceType(service); 
                }
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

            const publicMonitorMatch = path.match(/^\/monitor\/course\/([a-zA-Z0-9]+)\/?$/);
            if (publicMonitorMatch && publicMonitorMatch[1]) {
                setIsPublicMonitoringView(true);
                const courseId = publicMonitorMatch[1];
                setPublicMonitorLoading(true);
                const fetchData = async () => {
                    try {
                        const [courseData, participantData] = await Promise.all([
                            getCourseById(courseId, 'server'),
                            listAllParticipantsForCourse(courseId, 'server') 
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
                return; 
            }

            const publicMentorshipMatch = path.match(/^\/mentorship\/submit\/([a-zA-Z0-9_]+)\/?$/);
            if (publicMentorshipMatch && publicMentorshipMatch[1]) {
                setPublicMentorshipProps({ serviceType: publicMentorshipMatch[1] });
                return;
            }

            const facilitatorAppMatch = path.match(/^\/public\/facilitator-application\/?$/);
            if (facilitatorAppMatch) {
                setIsPublicSubmissionView(true);
                setSubmissionType('facilitator-application');
                return;
            }

            const teamAppMatch = path.match(/^\/public\/team-member-application\/?$/);
            if (teamAppMatch) {
                setIsPublicSubmissionView(true);
                setSubmissionType('team-member-application');
                return;
            }
            
            const publicTestMatch = path.match(/^\/public\/test\/course\/([a-zA-Z0-9]+)\/?$/);
            if (publicTestMatch && publicTestMatch[1]) {
                setIsPublicTestView(true);
                const courseId = publicTestMatch[1];
                setPublicTestLoading(true);
                const fetchData = async () => {
                    try {
                        const [courseData, participantData, testData] = await Promise.all([
                            getCourseById(courseId, 'server'),
                            listAllParticipantsForCourse(courseId, 'server'),
                            listParticipantTestsForCourse(courseId, 'server')
                        ]);

                        if (!courseData) throw new Error('Course not found.');
                        if (!participantData) throw new Error('Participants not found.');

                        if (courseData.course_type !== 'ICCM' && courseData.course_type !== 'EENC') {
                            throw new Error('Test forms are only available for ICCM and EENC courses.');
                        }

                        setPublicTestData({ course: courseData, participants: participantData, tests: testData || [] });
                        setPublicTestError(null);
                    } catch (err) {
                        setPublicTestError(err.message);
                    } finally {
                        setPublicTestLoading(false);
                    }
                };
                fetchData();
                return; 
            }

            // --- UPDATED REGEX TO ALLOW HYPHENS AND UNDERSCORES ---
            const publicCertificateMatch = path.match(/^\/verify\/certificate\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicCertificateMatch && publicCertificateMatch[1]) {
                const participantId = publicCertificateMatch[1];
                setPublicViewType('certificateVerification');
                setPublicViewLoading(true);
                try {
                    const participant = await getParticipantById(participantId, 'server');
                    if (!participant || !participant.courseId) {
                        throw new Error("Certificate invalid or participant not found.");
                    }
                    
                    const course = await getCourseById(participant.courseId, 'server');
                    if (!course) {
                        throw new Error("Associated course data not found.");
                    }
                    
                    setPublicViewData({ participant, course });
                } catch (error) {
                    setSharedViewError(error.message); 
                } finally {
                    setPublicViewLoading(false);
                }
                return; 
            }

            const publicCourseReportMatch = path.match(/^\/public\/report\/course\/([a-zA-Z0-9]+)\/?$/);
            if (publicCourseReportMatch && publicCourseReportMatch[1]) {
                const courseId = publicCourseReportMatch[1];
                setIsSharedView(true); 
                setPublicViewType('courseReport'); 
                setPublicViewLoading(true);
                try {
                    const data = await getPublicCourseReportData(courseId);
                    setSharedReportData(data); 
                    setPublicViewData(data); 
                } catch (error) {
                    setSharedViewError(error.message);
                } finally {
                    setPublicViewLoading(false);
                }
                return; 
            }

            const publicFacilitatorReportMatch = path.match(/^\/public\/report\/facilitator\/([a-zA-Z0-9]+)\/?$/);
            if (publicFacilitatorReportMatch && publicFacilitatorReportMatch[1]) {
                const facilitatorId = publicFacilitatorReportMatch[1];
                setPublicViewType('facilitatorReport');
                setPublicViewLoading(true);
                try {
                    const data = await getPublicFacilitatorReportData(facilitatorId);
                    setPublicViewData(data);
                } catch (error) {
                    setSharedViewError(error.message); 
                } finally {
                    setPublicViewLoading(false);
                }
                return; 
            }

            const publicTeamMemberMatch = path.match(/^\/public\/profile\/team\/(federal|state|locality)\/([a-zA-Z0-9]+)\/?$/);
            if (publicTeamMemberMatch && publicTeamMemberMatch[1] && publicTeamMemberMatch[2]) {
                const level = publicTeamMemberMatch[1];
                const memberId = publicTeamMemberMatch[2];
                setPublicViewType('teamMemberProfile');
                setPublicViewLoading(true);
                try {
                    const data = await getPublicTeamMemberProfileData(level, memberId);
                    setPublicViewData(data);
                } catch (error) {
                    setSharedViewError(error.message); 
                } finally {
                    setPublicViewLoading(false);
                }
                return; 
            }
        };

        handlePathChange();
    }, []); 

    const permissions = useMemo(() => {
        let derivedPermissions = { ...userPermissions };
        if (userRole?.toLowerCase() === 'super_user') {
            return ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {});
        }
        
        const ALL_PERMISSIONS_MINIMAL = ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});
        return { ...ALL_PERMISSIONS_MINIMAL, ...derivedPermissions };
    }, [userRole, userPermissions]);

    useEffect(() => {
        const path = window.location.pathname;
        const isSpecialPath = path.startsWith('/submit/') || 
                              path.startsWith('/public/') || 
                              path.startsWith('/facilities/') || 
                              path.startsWith('/monitor/') || 
                              path.startsWith('/verify/') || 
                              path.startsWith('/mentorship/');
                              
        if (!isSpecialPath && user && !permissionsLoading && !initialViewIsSet.current) {
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
                        // Use ALL_PERMISSIONS logic from local definition
                        const ALL_PERMISSIONS_MINIMAL = ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});
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
    }, [user]);

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


    useEffect(() => {
        if (isSharedView || !user) return;

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
        if (view === 'courses' || view === 'facilitatorReport') {
            fetchCourses();
        }
        if (view === 'skillsMentorship') {
            fetchHealthFacilities();
            fetchSkillMentorshipSubmissions();
        }
        
        if (view === 'childHealthServices') {
            fetchHealthFacilities();
        }

        if (view === 'courseReport') {
            fetchHealthFacilities();
        }
    }, [view, isSharedView, user, fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchCoordinators, fetchHealthFacilities, fetchSkillMentorshipSubmissions]);

    useEffect(() => {
        if (selectedCourseId && !courseDetails.allObs && !courseDetailsLoading) {
            
            const fetchFullCourseDetails = async () => {
                setCourseDetailsLoading(true);
                try {
                    const [participantsData, allCourseData, finalReport, testData] = await Promise.all([
                        listAllParticipantsForCourse(selectedCourseId),
                        listAllDataForCourse(selectedCourseId),
                        getFinalReportByCourseId(selectedCourseId),
                        listParticipantTestsForCourse(selectedCourseId) 
                    ]);
                    const { allObs, allCases } = allCourseData;
                    
                    setCourseDetails({ participants: participantsData || [], allObs, allCases, finalReport, participantTests: testData || [] }); 
                    
                } catch (error) {
                    console.error("Background fetch of course details failed:", error);
                    setCourseDetails({ participants: null, allObs: null, allCases: null, finalReport: null, participantTests: null }); 
                } finally {
                    setCourseDetailsLoading(false);
                }
            };
            
            fetchFullCourseDetails();
        }
    }, [selectedCourseId, courseDetails.allObs, courseDetailsLoading]); 

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

    const fetchPendingSubmissions = useCallback(async () => {
        if (!permissions.canApproveSubmissions) return;
        setIsSubmissionsLoading(true);
        try {
            const submissions = await listPendingFacilitatorSubmissions();
            setPendingSubmissions(submissions);
        } catch (error) { setToast({ show: true, message: 'Failed to load submissions.', type: 'error' }); } finally { setIsSubmissionsLoading(false); }
    }, [permissions.canApproveSubmissions]);

    useEffect(() => { if (view === 'humanResources' && activeHRTab === 'facilitators' && permissions.canApproveSubmissions) fetchPendingSubmissions(); }, [view, activeHRTab, permissions.canApproveSubmissions, fetchPendingSubmissions]);

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

        const courseSubTabs = ['participants', 'reports', 'courseDetails', 'test-dashboard', 'enter-test-scores']; 
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
            setCourseDetails({ participants: null, allObs: null, allCases: null, finalReport: null, participantTests: null }); 
            if (['dashboard', 'admin', 'landing', 'skillsMentorship'].includes(newView)) {
                setActiveCourseType(null);
            }
        }
        if ((view === 'observe' || view === 'participantReport') && !['observe', 'participantReport'].includes(newView)) {
            setSelectedParticipantId(null);
        }
    }, [view, selectedCourseId, selectedParticipantId, permissions, user, isCourseActive]);

    const handleOpenCourse = useCallback((courseId) => {
        setSelectedCourseId(courseId);
        setLoading(false); 
        
        setCourseDetails({ participants: null, allObs: null, allCases: null, finalReport: null, participantTests: null }); 
        
        navigate('participants', { courseId });
    }, [navigate]);

    const handleOpenCourseReport = useCallback(async (courseId) => {
        setSelectedCourseId(courseId);
        
        if (courseDetails.allObs !== null && courseDetails.participants !== null && courseDetails.participantTests !== null) { 
             navigate('courseReport', { courseId });
             return; 
        }
        
        if (courseDetailsLoading) {
             setToast({ show: true, message: 'Report data is still loading, please wait...', type: 'info' });
             return; 
        }

        setLoading(true); 
        setCourseDetailsLoading(true); 
        try {
            const [participantsData, allCourseData, finalReport, testData] = await Promise.all([
                listAllParticipantsForCourse(courseId),
                listAllDataForCourse(courseId),
                getFinalReportByCourseId(courseId),
                listParticipantTestsForCourse(courseId) 
            ]);
            const { allObs, allCases } = allCourseData;
            setCourseDetails({ participants: participantsData, allObs, allCases, finalReport, participantTests: testData || [] }); 
            navigate('courseReport', { courseId });
        } catch (error) {
            console.error("Error loading course report data:", error);
            setToast({ show: true, message: 'Failed to load course report data. Please try again.', type: 'error' });
        } finally {
            setLoading(false);
            setCourseDetailsLoading(false); 
        }
    }, [navigate, courseDetails, courseDetailsLoading]);

    const handleOpenCourseForTestForm = useCallback(async (courseId) => {
        setLoading(true);
        setSelectedCourseId(courseId);
        setSelectedParticipantId(null); 

        try {
            const [participantsData, testData] = await Promise.all([
                listAllParticipantsForCourse(courseId, { source: 'server' }), 
                listParticipantTestsForCourse(courseId, { source: 'server' }) 
            ]);
            
            setCourseDetails({
                participants: participantsData || [],
                participantTests: testData || [],
                allObs: null, 
                allCases: null, 
                finalReport: null 
            });

            setActiveCoursesTab('test-dashboard'); 
            setView('courses');

        } catch (error) {
            console.error("Error loading data for test form:", error);
            setToast({ show: true, message: 'Failed to load test form data. Please try again.', type: 'error' });
            navigate('courses'); 
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
            if (selectedCourseId) navigate('participants', { courseId: selectedCourseId });
            if (selectedParticipantId === participantId) {
                setSelectedParticipantId(null);
                navigate('participants');
            }
        }
    }, [permissions, selectedCourseId, selectedParticipantId, navigate]);

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
            
            navigate('participants', { courseId: selectedCourse.id });

            setToast({ show: true, message: `Successfully imported ${participantsToImport.length} participants.`, type: 'success' });
        } catch (error) {
            setToast({ show: true, message: "Error during import: " + error.message, type: "error" });
        } finally {
            setLoading(false);
        }
    }, [permissions, selectedCourse, navigate]); 

    const handleBulkMigrate = useCallback((courseId) => { navigate('participantMigration', { courseId }); }, [navigate]);
    const handleExecuteBulkMigration = useCallback(async (mappings) => {
        if (!mappings || mappings.length === 0) {
            setToast({ show: true, message: 'No mappings were provided.', type: 'info' });
            return;
        }

        setLoading(true); 
        try {
            const result = await bulkMigrateFromMappings(mappings, { dryRun: false });

            let summaryMessage = `${result.submitted} participants submitted for migration.`;
            if (result.errors > 0) {
                summaryMessage += ` ${result.errors} failed.`;
            }
            if (result.skipped > 0) {
                summaryMessage += ` ${result.skipped} skipped.`;
            }

            setToast({
                show: true,
                message: summaryMessage,
                type: result.errors > 0 ? 'warning' : 'success'
            });

            setCourseDetails({ participants: null, allObs: null, allCases: null, finalReport: null, participantTests: null }); 
            navigate('participants', { courseId: selectedCourseId });

        } catch (error) {
            console.error("Bulk migration failed:", error);
            setToast({ show: true, message: `Migration failed: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false); 
        }
    }, [navigate, selectedCourseId, setToast]); 
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

    const handleDeletePdf = useCallback(async (courseId) => {  }, [permissions, courseDetails.finalReport]);
    const handleLogout = useCallback(async () => { try { await signOut(auth); } catch (error) { console.error("Error signing out:", error); } }, []);
    const handleLoginForSharedView = useCallback(async () => {  }, []);

    const handleResetMonitor = useCallback(() => {
        setOperationCounts({ reads: 0, writes: 0 });
    }, []);
    
    const handleDismissMonitor = useCallback(() => {
        setIsMonitorVisible(false);
    }, []);
    
    const handleSaveParticipantFromTestForm = useCallback(async (participantData, facilityUpdateData) => {
        try {
            const savedParticipant = await saveParticipantAndSubmitFacilityUpdate(participantData, facilityUpdateData);
            if (facilityUpdateData) {
                setToast({ show: true, message: 'Facility update submitted for approval.', type: 'info' });
            }
            return savedParticipant; 
        } catch (e) {
            setToast({ show: true, message: `Submission failed: ${e.message}`, type: 'error' });
            throw e; 
        }
    }, [setToast]); 

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
                onOpenTestForm={handleOpenCourseForTestForm} 
                userStates={userStates}
                activeCoursesTab={activeCoursesTab}
                setActiveCoursesTab={setActiveCoursesTab}
                selectedCourse={selectedCourse}
                participants={courseDetails.participants || []} 
                participantTests={courseDetails.participantTests || []} 
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
                onBatchUpdate={() => {
                    setCourseDetails({ participants: null, allObs: null, allCases: null, finalReport: null, participantTests: null });
                    setSelectedCourseId(null); 
                    setSelectedCourseId(selectedCourse.id); 
                }}
                loadingDetails={loading || (selectedCourseId && courseDetailsLoading)} 
                canManageCourse={permissions.canManageCourse}
                canUseSuperUserAdvancedFeatures={permissions.canUseSuperUserAdvancedFeatures}
                canUseFederalManagerAdvancedFeatures={permissions.canUseFederalManagerAdvancedFeatures}
                canEditDeleteActiveCourse={permissions.canManageCourse}
                canEditDeleteInactiveCourse={permissions.canUseFederalManagerAdvancedFeatures}
                onSaveParticipantTest={async (payload) => {
                    if (!payload.deleted) {
                        await upsertParticipantTest(payload);
                    }
                    
                    setCourseDetails({ participants: null, allObs: null, allCases: null, finalReport: null, participantTests: null });
                    
                    if (selectedCourse) {
                        const currentId = selectedCourse.id;
                        setSelectedCourseId(null);
                        setTimeout(() => setSelectedCourseId(currentId), 0);
                    }
                }}
                
                onSaveParticipant={handleSaveParticipantFromTestForm}
                
                facilitatorsList={allFacilitators || []}
                fundersList={funders || []}
                federalCoordinatorsList={federalCoordinators || []}
                stateCoordinatorsList={stateCoordinators || []}
                localityCoordinatorsList={localityCoordinators || []}
                onSaveCourse={async (payload) => { 
                    const id = await upsertCourse({ ...payload, id: payload.id }); 
                    await fetchCourses(true); 
                    return id; 
                }}
                onAddNewFacilitator={async (data) => { await upsertFacilitator(data); await fetchFacilitators(true); }}
                onAddNewCoordinator={handleAddNewCoordinator}
                onAddNewFunder={handleAddNewFunder}
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

            case 'courseForm': 
                return permissions.canManageCourse ? (<CourseForm
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

            case 'participantForm': return permissions.canManageCourse ? (selectedCourse && <ParticipantForm course={selectedCourse} initialData={editingParticipant} onCancel={() => navigate(previousView)} onSave={async (participantData, facilityUpdateData) => { try { const fullPayload = { ...participantData, id: editingParticipant?.id, courseId: selectedCourse.id }; await saveParticipantAndSubmitFacilityUpdate(fullPayload, facilityUpdateData); if (facilityUpdateData) setToast({ show: true, message: 'Facility update submitted for approval.', type: 'info' }); 
            
            setCourseDetails({ participants: null, allObs: null, allCases: null, finalReport: null, participantTests: null }); 
            navigate('participants', { courseId: selectedCourse.id });

            } catch (e) { setToast({ show: true, message: `Submission failed: ${e.message}`, type: 'error' }); } }} />) : null;

            case 'participantReport': return permissions.canViewCourse ? (selectedCourse && currentParticipant && <ParticipantReportView course={selectedCourse} participant={currentParticipant} participants={courseDetails.participants} onChangeParticipant={(pid) => setSelectedParticipantId(pid)} onBack={() => navigate(previousView)} onNavigateToCase={(caseToEdit) => navigate('observe', { caseToEdit, courseId: caseToEdit.courseId, participantId: caseToEdit.participant_id })} onShare={(participant) => handleShare(participant, 'participant')} />) : null;

            case 'courseReport': return permissions.canViewCourse ? (selectedCourse && <CourseReportView course={selectedCourse} participants={courseDetails.participants} allObs={courseDetails.allObs} allCases={courseDetails.allCases} finalReportData={courseDetails.finalReport} onBack={() => navigate(previousView)} onEditFinalReport={handleEditFinalReport} onDeletePdf={handleDeletePdf} onViewParticipantReport={(pid) => { setSelectedParticipantId(pid); navigate('participantReport'); }} onShare={(course) => handleShare(course, 'course')} setToast={setToast} allHealthFacilities={healthFacilities} />) : null;

            case 'facilitatorForm':
                return permissions.canManageHumanResource ? (<FacilitatorForm 
                    initialData={editingFacilitator} 
                    onCancel={() => navigate(previousView)} 
                    onSave={async () => { 
                        await fetchFacilitators(true); 
                        setToast({ show: true, message: 'Facilitator saved.', type: 'success' }); 
                        navigate('humanResources'); 
                    }}
                    setToast={setToast}
                    setLoading={setLoading}
                />) : null;

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
                        canUseFederalManagerAdvancedFeatures={permissions.canUseFederalManagerAdvancedFeatures}
                    />
                );
            default: return <Landing navigate={navigate} permissions={permissions} />;
        }
    };

    const navItems = useMemo(() => [
        { label: 'Home', view: 'landing', active: view === 'landing', disabled: false },
        { label: 'Dashboard', view: 'dashboard', active: view === 'dashboard', disabled: false },
        { label: 'Courses', view: 'courses', active: ['courses', 'courseForm', 'courseReport', 'participants', 'participantForm', 'participantReport', 'observe', 'monitoring', 'reports', 'finalReport', 'participantMigration', 'courseDetails', 'test-dashboard', 'enter-test-scores'].includes(view), disabled: !permissions.canViewCourse }, 
        { label: 'Human Resources', view: 'humanResources', active: ['humanResources', 'facilitatorForm', 'facilitatorReport'].includes(view), disabled: !permissions.canViewHumanResource },
        { label: 'Child Health Services', view: 'childHealthServices', active: view === 'childHealthServices', disabled: !permissions.canViewFacilities },
        { label: 'Skills Mentorship', view: 'skillsMentorship', active: view === 'skillsMentorship', disabled: !permissions.canViewSkillsMentorship },
    ], [view, permissions]);

    const visibleNavItems = useMemo(() => navItems.filter(item => !item.disabled), [navItems]);

    const isApplicationPublicView = isPublicSubmissionView || isNewFacilityView || isPublicFacilityUpdateView;
    const isMentorshipPublicView = !!publicMentorshipProps; 
    
    const isPublicReportView = !!publicViewType; 

    // --- FIX START: Define verification path synchronously ---
    const isVerificationPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/verify/certificate/');

    const isMinimalUILayout = isApplicationPublicView || isMentorshipPublicView || isPublicMonitoringView || isPublicReportView || isPublicTestView || isVerificationPath;
    // --- FIX END ---

    let mainContent;

    if ((authLoading || permissionsLoading) && !isMinimalUILayout) {
        mainContent = <SplashScreen />;
    }
    else if (isPublicFacilityUpdateView) {
        if (authLoading) {
            mainContent = <Card><Spinner /></Card>;
        } else if (!user) {
            mainContent = <SignInBox message="You must sign in to use this facility data entry form." />;
        } else {
            mainContent = <PublicFacilityUpdateForm setToast={setToast} serviceType={publicServiceType} />;
        }
    }
    else if (isNewFacilityView) {
        if (authLoading) {
            mainContent = <Card><Spinner /></Card>;
        } else if (!user) {
            mainContent = <SignInBox message="You must sign in to use this new facility entry form." />;
        } else {
            mainContent = <NewFacilityEntryForm setToast={setToast} serviceType={publicServiceType} />;
        }
    }
    
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
    
    // --- FIX START: Modified public report view logic ---
    else if (isPublicReportView || isVerificationPath) { 
        if (publicViewLoading || (isVerificationPath && !publicViewData && !sharedViewError)) {
            mainContent = <Card><div className="flex justify-center p-8"><Spinner /></div></Card>;
        }
        else if (sharedViewError) { 
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{sharedViewError}</div></Card>;
        } 
        else if (publicViewData) {
            const viewType = publicViewType || (isVerificationPath ? 'certificateVerification' : null);
            
            switch (viewType) {
                case 'courseReport':
                    mainContent = (
                        <CourseReportView
                            course={publicViewData.course}
                            participants={publicViewData.participants}
                            allObs={publicViewData.allObs}
                            allCases={publicViewData.allCases}
                            finalReportData={publicViewData.finalReport}
                            allHealthFacilities={null} 
                            isSharedView={true}
                            onBack={() => {}}
                            onShare={() => {}} 
                        />
                    );
                    break;
                case 'facilitatorReport':
                    mainContent = (
                        <FacilitatorReportView
                            facilitator={publicViewData.facilitator}
                            allCourses={publicViewData.allCourses}
                            isSharedView={true}
                            onBack={() => {}}
                        />
                    );
                    break;
                case 'teamMemberProfile':
                    mainContent = (
                        <PublicTeamMemberProfileView
                            member={publicViewData.member}
                            level={publicViewData.level}
                        />
                    );
                    break;
                
                case 'certificateVerification':
                    mainContent = (
                        <Suspense fallback={<Card><Spinner /></Card>}>
                            <CertificateVerificationView
                                participant={publicViewData.participant}
                                course={publicViewData.course}
                            />
                        </Suspense>
                    );
                    break;
                
                default:
                    mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">Invalid report type.</div></Card>;
            }
        }
        else {
             mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">Could not load report data.</div></Card>;
        }
    }
    // --- FIX END ---
    
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
    else if (isMentorshipPublicView) {
        if (authLoading) {
            mainContent = <Card><Spinner /></Card>;
        } else if (!user) { 
            mainContent = <SignInBox message="You must sign in to use the mentorship submission link." />;
        } else {
            mainContent = (
                <SkillsMentorshipView
                    setToast={setToast}
                    permissions={permissions} 
                    userStates={userStates} 
                    userLocalities={userLocalities} 
                    publicSubmissionMode={true} 
                    publicServiceType={publicMentorshipProps.serviceType}
                    canBulkUploadMentorships={permissions.canUseSuperUserAdvancedFeatures}
                />
            );
        }
    }

    else if (isPublicTestView) {
        if (authLoading) {
            mainContent = <Card><Spinner /></Card>;
        } else if (!user) {
            mainContent = <SignInBox message="You must sign in to access the public test form." />;
        } else if (publicTestLoading) {
            mainContent = <Card><div className="flex justify-center p-8"><Spinner /></div></Card>;
        } else if (publicTestError) {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{publicTestError}</div></Card>;
        } else if (publicTestData.course) {
            mainContent = (
                <Suspense fallback={<Card><Spinner /></Card>}>
                    <CourseTestForm
                        course={publicTestData.course}
                        participants={publicTestData.participants}
                        participantTests={publicTestData.tests}
                        onSaveTest={upsertParticipantTest} 
                        
                        onSaveParticipant={handleSaveParticipantFromTestForm}
                        
                        onCancel={() => {}} 
                        onSave={(savedTest) => { 
                            setToast({ show: true, message: 'Test saved successfully!', type: 'success' });
                            const refetchData = async () => {
                                setPublicTestLoading(true);
                                try {
                                    const [testData, participantData] = await Promise.all([
                                        listParticipantTestsForCourse(publicTestData.course.id, 'server'),
                                        listAllParticipantsForCourse(publicTestData.course.id, 'server')
                                    ]);
                                    setPublicTestData(prev => ({ ...prev, tests: testData || [], participants: participantData || [] }));
                                } catch (err) {
                                    setToast({ show: true, message: 'Failed to refresh test data.', type: 'error' });
                                } finally {
                                    setPublicTestLoading(false);
                                }
                            };
                            refetchData();
                        }}
                        initialParticipantId={''} 
                        isPublicView={true} 

                        canManageTests={permissions.canUseFederalManagerAdvancedFeatures}
                    />
                </Suspense>
            );
        } else {
             mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">Could not load test session.</div></Card>;
        }
    }


    else if (!user && !authLoading) {
        mainContent = <SignInBox />;
    }
    else if (user && isProfileIncomplete) {
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
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => !isSharedView && navigate('landing')}>
                            <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md">
                                <img src="/child.png" alt="NCHP Logo" className="h-12 w-12 object-contain" />
                            </div>
                            <div><h1 className="text-xl sm:text-2xl font-bold text-white">National Child Health Program</h1><p className="text-sm text-slate-300 hidden sm:block">Program & Course Monitoring System</p></div>
                        </div>
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

            {user && !isMinimalUILayout && (
                <div className="bg-slate-700 text-slate-200 p-2 md:p-3 text-center flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                        <span>Welcome, **{user.displayName || user.email}**</span>
                        {userRole && <span className="bg-sky-600 text-xs px-2 py-1 rounded">{userRole}</span>}
                    </div>
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
            { user && !isMinimalUILayout && <BottomNav navItems={visibleNavItems} navigate={navigate} /> }

            <Suspense fallback={null}>
                {isShareModalOpen && user && (
                     <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} shareableItem={itemToShare} shareType={shareType} onSave={handleSaveSharingSettings} />
                )}
            </Suspense>

            {permissions.canUseSuperUserAdvancedFeatures && isMonitorVisible && (
                <ResourceMonitor
                    counts={operationCounts}
                    onReset={handleResetMonitor}
                    onDismiss={handleDismissMonitor}
                />
            )}
        </div>
    );
}