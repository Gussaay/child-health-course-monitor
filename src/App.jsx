// App.jsx
import './i18n'; 
import React, { useEffect, useMemo, useState, useRef, lazy, Suspense, useCallback } from "react";
import { useTranslation } from 'react-i18next'; 
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';

import {
    Home, Book, Users, User, Hospital, Database, ClipboardCheck, ClipboardList, FolderKanban, TrendingUp, X, WifiOff, RefreshCw, Activity, Layers
} from 'lucide-react';

import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
// --- ADDED: Capacitor Network plugin for reliable native detection ---
import { Network } from '@capacitor/network';

// --- PRE-FLIGHT LANGUAGE CHECK ---
if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    if (lang) {
        localStorage.setItem('language', lang);
        localStorage.setItem('app_language', lang);
    }
}

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement);

// --- Lazy Load View Components ---
const DashboardView = lazy(() => import('./components/DashboardView'));
const CourseReportView = lazy(() => import('./components/CourseReportView.jsx').then(module => ({ default: module.CourseReportView })));
const FinalReportManager = lazy(() => import('./components/FinalReportManager.jsx').then(module => ({ default: module.FinalReportManager })));
const ObservationView = lazy(() => import('./components/MonitoringView').then(module => ({ default: module.ObservationView })));
const ReportsView = lazy(() => import('./components/ReportsView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ParticipantReportView = lazy(() => import('./components/ParticipantReport').then(module => ({ default: module.ParticipantReportView })));
const ChildHealthServicesView = lazy(() => import('./components/ChildHealthServicesView.jsx'));
const LocalityBulkUpdateView = lazy(() => import('./components/child_helathservice_bulk-update'));

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

const IMNCIRecordingForm = lazy(() => import('./components/IMNCIRecordingForm'));

const CertificateVerificationView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.CertificateVerificationView })));
const PublicCertificateDownloadView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicCertificateDownloadView })));
const PublicCourseCertificatesView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicCourseCertificatesView }))); 
const PublicAttendanceView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicAttendanceView })));
const AttendanceManagerView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.AttendanceManagerView })));
const PublicParticipantRegistrationView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicParticipantRegistrationView })));

const CourseTestForm = lazy(() => import('./components/CourseTestForm.jsx').then(module => ({ default: module.CourseTestForm })));

const PublicFacilityUpdateForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.PublicFacilityUpdateForm })));
const NewFacilityEntryForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.NewFacilityEntryForm })));
const SkillsMentorshipView = lazy(() => import('./components/mentorship/SkillsMentorshipView.jsx'));

const ProjectTrackerView = lazy(() => import('./components/ProjectTrackerView'));
const PublicMeetingAttendanceView = lazy(() => import('./components/ProjectTrackerView').then(module => ({ default: module.PublicMeetingAttendanceView })));
const PlanningView = lazy(() => import('./components/PlanningView'));
const LocalityPlanView = lazy(() => import('./components/LocalityPlanView'));

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
    upsertParticipantTest,
    getUnitMeetingById,
    upsertUnitMeeting
} from './data.js';
import { STATE_LOCALITIES } from './components/constants.js';
import { Card, PageHeader, Button, Table, EmptyState, Spinner, PdfIcon, CourseIcon, Footer, Toast, Modal, Input } from './components/CommonComponents';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, waitForPendingWrites } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useDataCache } from './DataContext';
import { useAuth } from './hooks/useAuth';
import { SignInBox } from './auth-ui.jsx';

const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;

function ShareModal({ isOpen, onClose, shareableItem, shareType = 'course', onSave }) {
    const [accessLevel, setAccessLevel] = useState('private');
    const [sharedWith, setSharedWith] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');

    useEffect(() => {
        if (shareableItem) {
            setAccessLevel(shareableItem.isPublic ? 'public' : 'private');
            setSharedWith(shareableItem.sharedWith || []);
        }
    }, [shareableItem]);

    const handleAddEmail = () => {
        const email = emailInput.trim().toLowerCase();
        if (email && !sharedWith.includes(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setSharedWith([...sharedWith, email]);
            setEmailInput('');
        }
    };

    const handleRemoveEmail = (emailToRemove) => {
        setSharedWith(sharedWith.filter(email => email !== emailToRemove));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const settings = {
            isPublic: accessLevel === 'public',
            sharedWith: accessLevel === 'private' ? sharedWith : []
        };
        try {
            await onSave(shareableItem.id, settings);
            setCopySuccess('');
        } catch (error) {
            console.error("Failed to save sharing settings:", error);
        } finally {
            setIsSaving(false);
            onClose();
        }
    };
    
    const handleCopyLink = () => {
        let routePrefix = '';
        if (shareType === 'course') {
            routePrefix = 'public/report/course';
        } else if (shareType === 'facilitator') {
            routePrefix = 'public/report/facilitator';
        } else {
            routePrefix = `shared/${shareType}-report`;
        }
        
        // Fix: Use production URL if native app, otherwise fallback to origin
        const baseUrl = Capacitor.isNativePlatform() ? 'https://imnci-courses-monitor.web.app' : window.location.origin;
        const shareUrl = `${baseUrl}/${routePrefix}/${shareableItem.id}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopySuccess('Link copied!');
            setTimeout(() => setCopySuccess(''), 2000);
        }).catch(err => {
            setCopySuccess('Failed to copy.');
        });
    };

    if (!shareableItem) return null;

    const isCourse = shareType === 'course';
    const reportName = isCourse ? `${shareableItem.course_type} - ${shareableItem.state}` : shareableItem.name;
    const modalTitle = `Share ${isCourse ? 'Course' : 'Participant'} Report`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
            <div className="p-6 space-y-6">
                <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 bg-sky-100 p-3 rounded-full">
                        <ShareIcon />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">{reportName}</h3>
                        <p className="text-sm text-gray-500">Manage access permissions for this report.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-semibold text-gray-700">General Access</label>
                    <div className="flex space-x-4">
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="accessLevel"
                                value="private"
                                checked={accessLevel === 'private'}
                                onChange={() => setAccessLevel('private')}
                                className="form-radio text-sky-600"
                            />
                            <span>Restricted</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="accessLevel"
                                value="public"
                                checked={accessLevel === 'public'}
                                onChange={() => setAccessLevel('public')}
                                className="form-radio text-sky-600"
                            />
                            <span>Anyone with the link</span>
                        </label>
                    </div>
                </div>

                {accessLevel === 'private' && (
                    <div className="space-y-4">
                        <label className="font-semibold text-gray-700">Share with specific people</label>
                        <div className="flex space-x-2">
                            <Input
                                type="email"
                                placeholder="Enter email address"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                className="flex-grow"
                            />
                            <Button onClick={handleAddEmail}>Add</Button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {sharedWith.map(email => (
                                <div key={email} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                                    <span className="text-sm text-gray-700">{email}</span>
                                    <button onClick={() => handleRemoveEmail(email)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                                </div>
                            ))}
                            {sharedWith.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Not shared with anyone yet.</p>}
                        </div>
                    </div>
                )}
                
                <div className="pt-4 border-t">
                     <div className="flex items-center justify-between">
                        <Button onClick={handleCopyLink} variant="secondary">
                            <LinkIcon /> {copySuccess ? copySuccess : "Copy Link"}
                        </Button>
                        <div className="flex space-x-2">
                            <Button variant="secondary" onClick={onClose}>Cancel</Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Spinner /> : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

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
    canViewLocalityPlan: true,
    canEditLocalityPlan: true,
};

const ALL_PERMISSION_KEYS = Object.keys(ALL_PERMISSIONS);

const DEFAULT_ROLE_PERMISSIONS = {
    'super_user': ALL_PERMISSION_KEYS,
    'federal_manager': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship',
        'canManageCourse', 'canManageHumanResource', 'canManageFacilities',
        'canApproveSubmissions', 'canUseFederalManagerAdvancedFeatures', 'canViewLocalityPlan', 'canEditLocalityPlan'
    ],
    'state_manager': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship',
        'canManageCourse', 'canManageHumanResource', 'canManageFacilities', 'canViewLocalityPlan'
    ],
    'locality_manager': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities', 'canViewSkillsMentorship',
        'canManageCourse',
        'canManageFacilities'
    ],
    'user': [
        'canViewDashboard', 'canViewCourse', 'canViewHumanResource', 'canViewFacilities'
    ]
};

const applyDerivedPermissions = (basePermissions) => {
    return basePermissions;
};

const ResourceMonitor = ({ counts, onReset, onDismiss }) => {
    return (
        <div className="fixed top-4 end-4 md:bottom-4 md:top-auto bg-gray-900 text-white p-2 rounded-lg shadow-lg z-50 opacity-90 w-56">
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

function Landing({ navigate, permissions }) {
    const { t } = useTranslation();
    const navButtons = [
        { label: t('landing.modules.dashboard', 'Dashboard'), view: 'dashboard', icon: Home, permission: true },
        { label: t('landing.modules.courses', 'Courses'), view: 'courses', icon: Book, permission: permissions.canViewCourse },
        { label: t('landing.modules.human_resources', 'Human Resources'), view: 'humanResources', icon: Users, permission: permissions.canViewHumanResource },
        { label: t('landing.modules.facilities', 'Child Health Services'), view: 'childHealthServices', icon: Hospital, permission: permissions.canViewFacilities },
        { label: t('landing.modules.mentorship', 'Skills Mentorship'), view: 'skillsMentorship', icon: ClipboardCheck, permission: permissions.canViewSkillsMentorship },
        { label: t('landing.modules.imci', 'IMCI Assessment'), view: 'imciForm', icon: Activity, permission: permissions.canViewCourse },
        { label: t('landing.modules.projects', 'Project Tracker'), view: 'projects', icon: FolderKanban, permission: permissions.canUseFederalManagerAdvancedFeatures },
        { label: t('landing.modules.planning', 'Master Plan'), view: 'planning', icon: TrendingUp, permission: permissions.canUseFederalManagerAdvancedFeatures }, 
        { label: t('landing.modules.locality_plan', 'Bottom-up Planning'), view: 'localityPlan', icon: Layers, permission: permissions.canViewLocalityPlan },
        { label: t('landing.modules.admin', 'Admin'), view: 'admin', icon: User, permission: permissions.canViewAdmin },
    ];

    const accessibleButtons = navButtons.filter(btn => btn.permission);

    return (
        <Card>
            <PageHeader 
                title={t('landing.welcome', 'Welcome')} 
                subtitle={t('landing.subtitle', 'Select a module to get started')} 
            />
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
                    <EmptyState message={t('landing.no_permissions', 'You do not have permissions to view any modules. Please contact an administrator.')} />
                )}
            </div>
        </Card>
    );
}

const BottomNav = React.memo(function BottomNav({ navItems, navigate }) {
    const icons = { 
        'landing': Home, 
        'dashboard': Home, 
        'courses': Book, 
        'humanResources': Users, 
        'childHealthServices': Hospital, 
        'skillsMentorship': ClipboardCheck, 
        'projects': FolderKanban,
        'planning': TrendingUp,
        'localityPlan': Layers,
        'admin': User 
    };
    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 flex justify-around items-center z-20">
            {navItems.map(item => {
                const Icon = icons[item.view] || Activity;
                return (
                    <button key={item.view} onClick={() => navigate(item.view)} className={`flex flex-col items-center justify-center p-2 w-full h-16 text-xs font-medium transition-colors ${item.active ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}>
                        {Icon && <Icon className="w-6 h-6 mb-1" />}
                        <span>{item.label}</span>
                    </button>
                )
            })}
        </nav>
    );
});

function SplashScreen() {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 bg-sky-50 flex flex-col items-center justify-center gap-6 text-center p-4 z-[9999]">
            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center p-1 shadow-xl animate-pulse"><img src="/child.png" alt="NCHP Logo" className="h-20 w-20 object-contain" /></div>
            <div>
                <h1 className="text-3xl font-bold text-slate-800">{t('app.title', 'National Child Health Program')}</h1>
                <p className="text-lg text-slate-500 mt-1">{t('app.subtitle', 'Program & Course Monitoring System')}</p>
            </div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mt-4"></div>
            <p className="text-slate-600 mt-4">{t('app.loading_system', 'Loading application, please wait...')}</p>
        </div>
    );
}

export default function App() {
    const { t, i18n } = useTranslation();
    const [isUpdateReady, setIsUpdateReady] = useState(false);
    const [updateBundle, setUpdateBundle] = useState(null);

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);

    // Added user profile modal state
    const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);

    useEffect(() => {
        let networkListener;

        const setupNetworkListener = async () => {
            const status = await Network.getStatus();
            setIsOffline(!status.connected);

            networkListener = await Network.addListener('networkStatusChange', async (status) => {
                const offline = !status.connected;
                setIsOffline(offline);
                
                if (!offline) {
                    setIsSyncing(true);
                    try {
                        await Promise.race([
                            waitForPendingWrites(db),
                            new Promise(resolve => setTimeout(resolve, 5000))
                        ]);
                    } catch (e) {
                        console.error("Error waiting for pending writes during sync:", e);
                    } finally {
                        setIsSyncing(false);
                    }
                }
            });
        };

        setupNetworkListener();

        return () => {
            if (networkListener) {
                networkListener.remove();
            }
        };
    }, []);

    const {
        courses: rawCourses,
        facilitators: rawFacilitators,
        funders, federalCoordinators, stateCoordinators, localityCoordinators,
        healthFacilities,
        participantTests, 
        fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators,
        fetchHealthFacilities,
        fetchSkillMentorshipSubmissions,
        fetchParticipantTests
    } = useDataCache();

    const allCourses = useMemo(() => (rawCourses || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true"), [rawCourses]);
    const allFacilitators = useMemo(() => (rawFacilitators || []).filter(f => f.isDeleted !== true && f.isDeleted !== "true"), [rawFacilitators]);

    const { user, userStates, authLoading, userLocalities } = useAuth();

    const isProfileIncomplete = useMemo(() => {
        if (!authLoading && user && (!user.displayName || user.displayName.trim().length === 0)) {
            return true;
        }
        return false;
    }, [user, authLoading]);

    // --- FETCH AND FIND USER'S HR PROFILE ---
    const userHRProfile = useMemo(() => {
        if (!user || !user.email) return null;
        const allCoordinators = [
            ...(federalCoordinators || []),
            ...(stateCoordinators || []),
            ...(localityCoordinators || [])
        ];
        return allCoordinators.find(c => c.email === user.email);
    }, [user, federalCoordinators, stateCoordinators, localityCoordinators]);

    // Fetch HR data when the modal opens so we definitely have the user's specific role
    useEffect(() => {
        if (isUserProfileModalOpen) {
            fetchFederalCoordinators();
            fetchStateCoordinators();
            fetchLocalityCoordinators();
        }
    }, [isUserProfileModalOpen, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators]);

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

    const [courseDetailsCache, setCourseDetailsCache] = useState({});
    const courseDetails = courseDetailsCache[selectedCourseId] || { participants: null, allObs: null, allCases: null, finalReport: null, participantTests: null };
    
    const [courseDetailsLoading, setCourseDetailsLoading] = useState(false);
    
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);

    const [isSharedView, setIsSharedView] = useState(false);
    const [isPublicSubmissionView, setIsPublicSubmissionView] = useState(false);
    const [isNewFacilityView, setIsNewFacilityView] = useState(false);
    const [isPublicFacilityUpdateView, setIsPublicFacilityUpdateView] = useState(false);
    
    const [isPublicMentorshipDashboardView, setIsPublicMentorshipDashboardView] = useState(false);
    const [publicMentorshipDashboardParams, setPublicMentorshipDashboardParams] = useState(null);

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
    const [publicTestType, setPublicTestType] = useState(null);

    const [isPublicRegistrationView, setIsPublicRegistrationView] = useState(false);
    const [publicRegistrationCourseId, setPublicRegistrationCourseId] = useState(null);

    const [isBulkUpdateView, setIsBulkUpdateView] = useState(false);
    const [publicBulkUpdateParams, setPublicBulkUpdateParams] = useState({});

    const [isPublicMeetingView, setIsPublicMeetingView] = useState(false);
    const [publicMeetingId, setPublicMeetingId] = useState(null);
    const [publicMeetingData, setPublicMeetingData] = useState(null);

    const [operationCounts, setOperationCounts] = useState({ reads: 0, writes: 0 });
    const [isMonitorVisible, setIsMonitorVisible] = useState(true);

    const historyInitialized = useRef(false);
    const isPopStateNavigation = useRef(false);
    const initialViewIsSet = useRef(false);

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            const checkAndDownloadUpdate = async () => {
                if (!navigator.onLine) {
                    console.log("Device is offline. Skipping background update check.");
                    return;
                }

                try {
                    // --- USE DIRECT NATIVE HTTP CALL ---
                    // This bypasses CORS without requiring global CapacitorHttp to be enabled,
                    // which ensures Firebase continues to work normally.
                    const response = await CapacitorHttp.request({
                        method: 'GET',
                        url: 'https://imnci-courses-monitor.web.app/latest/update.json?t=' + Date.now(),
                        connectTimeout: 5000, // Handle Lie-Fi gracefully
                        readTimeout: 5000
                    });

                    if (response.status !== 200) throw new Error("Network response was not ok");
                    
                    // CapacitorHttp parses JSON automatically
                    const latestUpdate = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                    
                    const currentState = await CapacitorUpdater.current();
                    const currentVersion = currentState.bundle?.version || "builtin";

                    if (currentVersion !== latestUpdate.version) {
                        const downloadedBundle = await CapacitorUpdater.download({
                            url: latestUpdate.url,
                            version: latestUpdate.version
                        });

                        setUpdateBundle(downloadedBundle); 
                        setIsUpdateReady(true);
                    }
                } catch (error) {
                    console.warn("Self-hosted update check skipped or failed due to network conditions.");
                }
            };

            checkAndDownloadUpdate();
        }
    }, []);

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
            
            setIsPublicMentorshipDashboardView(false);
            setPublicMentorshipDashboardParams(null);

            setPublicViewData(null);
            setPublicViewType(null);
            setPublicViewLoading(false);

            setIsPublicTestView(false);
            setPublicTestError(null);
            setPublicTestData({ course: null, participants: [], tests: [] });
            setPublicTestType(null); 

            setIsPublicRegistrationView(false);
            setPublicRegistrationCourseId(null);

            setIsBulkUpdateView(false);
            setPublicBulkUpdateParams({});

            setIsPublicMeetingView(false);
            setPublicMeetingId(null);
            setPublicMeetingData(null);

            const publicMeetingMatch = path.match(/^\/public\/meeting\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicMeetingMatch && publicMeetingMatch[1]) {
                setIsPublicMeetingView(true);
                setPublicMeetingId(publicMeetingMatch[1]);
                setPublicViewLoading(true);
                
                getUnitMeetingById(publicMeetingMatch[1], 'server')
                    .then(data => {
                        if (!data) throw new Error("Meeting not found.");
                        setPublicMeetingData(data);
                    })
                    .catch(err => setSharedViewError(err.message))
                    .finally(() => setPublicViewLoading(false));
                return;
            }

            const publicMentorshipDashboardMatch = path.match(/^\/public\/mentorship\/dashboard\/([a-zA-Z0-9_]+)\/?$/);
            if (publicMentorshipDashboardMatch && publicMentorshipDashboardMatch[1]) {
                setIsPublicMentorshipDashboardView(true);
                const searchParams = new URLSearchParams(window.location.search);
                
                const langParam = searchParams.get('lang');
                if (langParam) {
                    localStorage.setItem('language', langParam);
                    localStorage.setItem('app_language', langParam);
                }

                setPublicMentorshipDashboardParams({
                    serviceType: publicMentorshipDashboardMatch[1],
                    state: searchParams.get('state') || '',
                    locality: searchParams.get('locality') || '',
                    facilityId: searchParams.get('facilityId') || '',
                    workerName: searchParams.get('workerName') || '',
                    project: searchParams.get('project') || '',
                    workerType: searchParams.get('workerType') || '',
                    week: searchParams.get('week') || '',
                    month: searchParams.get('month') || '',
                    lang: langParam || ''
                });
                return;
            }

            const facilityUpdateMatch = path.match(/^\/facilities\/data-entry\/([a-zA-Z0-9_-]+)\/?$/);
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

            const publicMonitorMatch = path.match(/^\/monitor\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicMonitorMatch && publicMonitorMatch[1]) {
                setIsPublicMonitoringView(true);
                const courseId = publicMonitorMatch[1];
                setPublicMonitorLoading(true);
                const fetchData = async () => {
                    try {
                        const [courseData, participantData] = await Promise.all([
                            getCourseById(courseId, 'server'),
                            listAllParticipantsForCourse(courseId, { source: 'server' }) 
                        ]);
                        if (!courseData) throw new Error('Course not found.');
                        if (!participantData) throw new Error('Participants not found.'); 
                        
                        const activeParticipants = (participantData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
                        
                        setPublicMonitorData({ course: courseData, participants: activeParticipants });
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
            
            const bulkUpdateMatch = path.match(/^\/public\/bulk-update\/?$/);
            if (bulkUpdateMatch) {
                setIsBulkUpdateView(true);
                const searchParams = new URLSearchParams(window.location.search);
                setPublicBulkUpdateParams({
                    state: searchParams.get('state') || '',
                    locality: searchParams.get('locality') || '',
                    facilityType: searchParams.get('facilityType') || '',
                    functioning: searchParams.get('functioning') || '',
                    project: searchParams.get('project') || '',
                    service: searchParams.get('service') || ''
                });
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
            
            const publicRegistrationMatch = path.match(/^\/public\/register\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicRegistrationMatch && publicRegistrationMatch[1]) {
                setIsPublicRegistrationView(true);
                setPublicRegistrationCourseId(publicRegistrationMatch[1]);
                return;
            }

            const publicTestMatch = path.match(/^\/public\/test\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicTestMatch && publicTestMatch[1]) {
                setIsPublicTestView(true);
                const courseId = publicTestMatch[1];
                
                const searchParams = new URLSearchParams(window.location.search);
                const testTypeParam = searchParams.get('type');
                setPublicTestType(testTypeParam);

                setPublicTestLoading(true);
                const fetchData = async () => {
                    try {
                        const [courseData, participantData, testData] = await Promise.all([
                            getCourseById(courseId, 'server'),
                            listAllParticipantsForCourse(courseId, { source: 'server' }),
                            listParticipantTestsForCourse(courseId, { source: 'server' })
                        ]);

                        if (!courseData) throw new Error('Course not found.');
                        if (!participantData) throw new Error('Participants not found.');

                        if (courseData.course_type !== 'ICCM' && 
                            courseData.course_type !== 'EENC' && 
                            courseData.course_type !== 'Small & Sick Newborn' && 
                            courseData.course_type !== 'IMNCI' && 
                            courseData.course_type !== 'ETAT' &&
                            courseData.course_type !== 'Program Management') {
                            throw new Error('Test forms are only available for ICCM, EENC, Small & Sick Newborn, IMNCI, ETAT, and Program Management courses.');
                        }
                        
                        const activeParticipants = (participantData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
                        const activeTests = (testData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");

                        setPublicTestData({ course: courseData, participants: activeParticipants, tests: activeTests });
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
            
            const certDownloadMatch = path.match(/^\/public\/certificate\/download\/([a-zA-Z0-9_-]+)\/?$/);
            if (certDownloadMatch && certDownloadMatch[1]) {
                const participantId = certDownloadMatch[1];
                setPublicViewType('certificateDownload');
                setPublicViewData({ participantId });
                return;
            }
            
            const courseCertPageMatch = path.match(/^\/public\/course\/certificates\/([a-zA-Z0-9_-]+)\/?$/);
            if (courseCertPageMatch && courseCertPageMatch[1]) {
                const courseId = courseCertPageMatch[1];
                setPublicViewType('courseCertificatesPage');
                setPublicViewData({ courseId });
                return;
            }
            
            const publicAttendanceMatch = path.match(/^\/attendance\/course\/([a-zA-Z0-9]+)\/?$/);
            if (publicAttendanceMatch && publicAttendanceMatch[1]) {
                const courseId = publicAttendanceMatch[1];
                setPublicViewType('attendance');
                setPublicViewData({ courseId });
                return;
            }

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

            const publicCourseReportMatch = path.match(/^\/public\/report\/course\/([a-zA-Z0-9_-]+)\/?$/);
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

            const publicFacilitatorReportMatch = path.match(/^\/public\/report\/facilitator\/([a-zA-Z0-9_-]+)\/?$/);
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
            return ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), { role: userRole });
        }

        if (userRole?.toLowerCase() === 'user') {
            derivedPermissions.canViewSkillsMentorship = false;
            derivedPermissions.canManageSkillsMentorship = false;
        }

        if (userRole?.toLowerCase() === 'federal_manager') {
            derivedPermissions.canViewLocalityPlan = true;
            if (derivedPermissions.canUseFederalManagerAdvancedFeatures) {
                derivedPermissions.canEditLocalityPlan = true;
            }
        }
        if (userRole?.toLowerCase() === 'state_manager') {
            derivedPermissions.canViewLocalityPlan = true;
        }

        const ALL_PERMISSIONS_MINIMAL = ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});
        return { ...ALL_PERMISSIONS_MINIMAL, ...derivedPermissions, role: userRole };
    }, [userRole, userPermissions]);

    useEffect(() => {
        const path = window.location.pathname;
        const isSpecialPath = path.startsWith('/submit/') || 
                              path.startsWith('/public/') || 
                              path.startsWith('/facilities/') || 
                              path.startsWith('/monitor/') || 
                              path.startsWith('/verify/') || 
                              path.startsWith('/mentorship/') ||
                              path.startsWith('/attendance/');
                              
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
        if (isSharedView || isPublicMentorshipDashboardView || (!user && !isPublicMentorshipDashboardView)) return;

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
    }, [view, isSharedView, user, fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchCoordinators, fetchHealthFacilities, fetchSkillMentorshipSubmissions, isPublicMentorshipDashboardView]);

    useEffect(() => {
        if (selectedCourseId && !courseDetailsCache[selectedCourseId]?.allObs && !courseDetailsLoading) {
            
            const fetchFullCourseDetails = async () => {
                setCourseDetailsLoading(true);
                try {
                    let participantsData = await listAllParticipantsForCourse(selectedCourseId, { source: 'cache' }).catch(()=>[]);
                    let allCourseData = await listAllDataForCourse(selectedCourseId, { source: 'cache' }).catch(()=>({allObs:[], allCases:[]}));
                    let finalReport = await getFinalReportByCourseId(selectedCourseId, { source: 'cache' }).catch(()=>null);
                    let testData = await listParticipantTestsForCourse(selectedCourseId, { source: 'cache' }).catch(()=>[]);

                    const hasData = participantsData.length > 0 || (allCourseData && allCourseData.allObs && allCourseData.allObs.length > 0);

                    const processAndSet = (pData, cData, fData, tData) => {
                        const activeParticipants = (pData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
                        const activeTests = (tData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
                        const activeObs = (cData?.allObs || []).filter(o => o.isDeleted !== true && o.isDeleted !== "true");
                        const activeCases = (cData?.allCases || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true");
                        const activeFinalReport = (fData && fData.isDeleted !== true && fData.isDeleted !== "true") ? fData : null;
                        
                        setCourseDetailsCache(prev => ({
                            ...prev,
                            [selectedCourseId]: { 
                                participants: activeParticipants, 
                                allObs: activeObs, 
                                allCases: activeCases, 
                                finalReport: activeFinalReport, 
                                participantTests: activeTests 
                            }
                        }));
                    };

                    if (hasData) {
                        processAndSet(participantsData, allCourseData, finalReport, testData);
                    }

                    if (!hasData) {
                        participantsData = await listAllParticipantsForCourse(selectedCourseId, { source: 'server' }).catch(()=>[]);
                        allCourseData = await listAllDataForCourse(selectedCourseId, { source: 'server' }).catch(()=>({allObs:[], allCases:[]}));
                        finalReport = await getFinalReportByCourseId(selectedCourseId, { source: 'server' }).catch(()=>null);
                        testData = await listParticipantTestsForCourse(selectedCourseId, { source: 'server' }).catch(()=>[]);

                        processAndSet(participantsData, allCourseData, finalReport, testData);
                    }
                    
                } catch (error) {
                    console.error("Background fetch of course details failed:", error);
                } finally {
                    setCourseDetailsLoading(false);
                }
            };
            
            fetchFullCourseDetails();
        }
    }, [selectedCourseId, courseDetailsCache, courseDetailsLoading]); 

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
        let filtered = allCourses.filter(c => userStateSet.has(c.state));
        
        if (userLocalities && userLocalities.length > 0) {
            filtered = filtered.filter(c => userLocalities.includes(c.locality));
        }
        
        return filtered;
    }, [allCourses, userStates, userLocalities, canSeeAllData]);

    const filteredFacilitators = useMemo(() => {
        if (!allFacilitators) {
            return [];
        }
        if (canSeeAllData || !userStates || userStates.length === 0) {
            return allFacilitators;
        }
        const userStateSet = new Set(userStates);
        let filtered = allFacilitators.filter(f => userStateSet.has(f.currentState));
        
        if (userLocalities && userLocalities.length > 0) {
            filtered = filtered.filter(f => userLocalities.includes(f.currentLocality));
        }
        
        return filtered;
    }, [allFacilitators, userStates, userLocalities, canSeeAllData]);

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
            'imciForm': permissions.canViewCourse,
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
            'attendanceManager': permissions.canManageCourse,
            'projects': permissions.canUseFederalManagerAdvancedFeatures, 
            'planning': permissions.canUseFederalManagerAdvancedFeatures, 
            'localityPlan': permissions.canViewLocalityPlan,
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

        if (['courses', 'humanResources', 'dashboard', 'admin', 'landing', 'skillsMentorship', 'projects', 'planning', 'localityPlan'].includes(newView)) {
            setSelectedCourseId(null);
            setSelectedParticipantId(null);
            setFinalReportCourse(null);
            if (['dashboard', 'admin', 'landing', 'skillsMentorship', 'projects', 'planning', 'localityPlan'].includes(newView)) {
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
        navigate('participants', { courseId });
    }, [navigate]);

    const handleOpenCourseReport = useCallback(async (courseId) => {
        setSelectedCourseId(courseId);
        
        if (courseDetailsCache[courseId]?.allObs && courseDetailsCache[courseId]?.participants && courseDetailsCache[courseId]?.participantTests) { 
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
                listAllParticipantsForCourse(courseId, { source: 'server' }),
                listAllDataForCourse(courseId, { source: 'server' }),
                getFinalReportByCourseId(courseId, { source: 'server' }),
                listParticipantTestsForCourse(courseId, { source: 'server' }) 
            ]);
            
            const activeParticipants = (participantsData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeTests = (testData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
            const activeObs = (allCourseData.allObs || []).filter(o => o.isDeleted !== true && o.isDeleted !== "true");
            const activeCases = (allCourseData.allCases || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true");
            const activeFinalReport = (finalReport && finalReport.isDeleted !== true && finalReport.isDeleted !== "true") ? finalReport : null;
            
            setCourseDetailsCache(prev => ({
                ...prev,
                [courseId]: { participants: activeParticipants, allObs: activeObs, allCases: activeCases, finalReport: activeFinalReport, participantTests: activeTests }
            }));
            
            navigate('courseReport', { courseId });
        } catch (error) {
            console.error("Error loading course report data:", error);
            setToast({ show: true, message: 'Failed to load course report data. Please try again.', type: 'error' });
        } finally {
            setLoading(false);
            setCourseDetailsLoading(false); 
        }
    }, [navigate, courseDetailsCache, courseDetailsLoading]);

    const handleOpenCourseForTestForm = useCallback(async (courseId) => {
        setLoading(true);
        setSelectedCourseId(courseId);
        setSelectedParticipantId(null); 

        try {
            const [participantsData, testData] = await Promise.all([
                listAllParticipantsForCourse(courseId, { source: 'server' }), 
                listParticipantTestsForCourse(courseId, { source: 'server' }) 
            ]);
            
            const activeParticipants = (participantsData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeTests = (testData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
            
            setCourseDetailsCache(prev => ({
                ...prev,
                [courseId]: { 
                    ...(prev[courseId] || {}), 
                    participants: activeParticipants,
                    participantTests: activeTests
                }
            }));

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
                await fetchFacilitators(navigator.onLine);
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
            await fetchCourses(navigator.onLine);
            setToast({ show: true, message: "Sharing settings updated.", type: "success" });
        } catch (error) {
            setToast({ show: true, message: "Failed to update sharing settings.", type: "error" });
        }
    }, [shareType, fetchCourses]);

    const handleDeleteCourse = useCallback(async (courseId) => {
        if (!permissions.canManageCourse) return;
        if (window.confirm('Are you sure you want to delete this course and all its data?')) {
            await deleteCourse(courseId);
            await fetchCourses(navigator.onLine);
            
            setCourseDetailsCache(prev => {
                const newCache = { ...prev };
                delete newCache[courseId];
                return newCache;
            });
            
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
            
            if (selectedCourseId) {
                setCourseDetailsCache(prev => {
                    const newCache = { ...prev };
                    delete newCache[selectedCourseId];
                    return newCache;
                });
                navigate('participants', { courseId: selectedCourseId });
            }
            if (selectedParticipantId === participantId) {
                setSelectedParticipantId(null);
                navigate('participants');
            }
        }
    }, [permissions, selectedCourseId, selectedParticipantId, navigate]);

    const handleDeleteFacilitator = useCallback(async (facilitatorId) => {
        if (!permissions.canManageHumanResource) return;
        if (window.confirm('Are you sure you want to delete this facilitator?')) {
            setLoading(true);
            try {
                await deleteFacilitator(facilitatorId);
                await fetchFacilitators(navigator.onLine); 
                
                if (selectedFacilitatorId === facilitatorId) {
                    setSelectedFacilitatorId(null);
                    navigate('humanResources');
                }
                
                setToast({ show: true, message: 'Facilitator deleted successfully.', type: 'success' });
            } catch (error) {
                console.error("Error deleting facilitator:", error);
                setToast({ show: true, message: `Failed to delete facilitator: ${error.message}`, type: 'error' });
            } finally {
                setLoading(false);
            }
        }
    }, [permissions.canManageHumanResource, selectedFacilitatorId, navigate, fetchFacilitators]);

    const handleImportParticipants = useCallback(async ({ participantsToImport, facilitiesToUpsert }) => {
        if (!permissions.canUseSuperUserAdvancedFeatures) return;
        try {
            setLoading(true);
            if (facilitiesToUpsert?.length > 0) { /* ... */ }
            const participantsWithCourseId = participantsToImport.map(p => ({ ...p, courseId: selectedCourse.id }));
            await importParticipants(participantsWithCourseId);
            
            setCourseDetailsCache(prev => {
                const newCache = { ...prev };
                delete newCache[selectedCourse.id];
                return newCache;
            });
            
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

            setCourseDetailsCache(prev => {
                const newCache = { ...prev };
                delete newCache[selectedCourseId];
                return newCache;
            });
            
            navigate('participants', { courseId: selectedCourseId });

        } catch (error) {
            console.error("Bulk migration failed:", error);
            setToast({ show: true, message: `Migration failed: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false); 
        }
    }, [navigate, selectedCourseId, setToast]); 
    const handleAddNewCoordinator = useCallback(async (coordinatorData) => { await upsertCoordinator(coordinatorData); await fetchCoordinators(navigator.onLine); }, [fetchCoordinators]);
    const handleAddNewFunder = useCallback(async (funderData) => { await upsertFunder(funderData); await fetchFunders(navigator.onLine); }, [fetchFunders]);

    const handleAddFinalReport = useCallback(async (courseId) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;
        const courseToReport = (allCourses || []).find(c => c.id === courseId);
        if (!courseToReport) return;
        setFinalReportCourse(courseToReport);
        setSelectedCourseId(courseId);
        setLoading(true);
        try {
            const [participantsData, existingReport] = await Promise.all([
                listAllParticipantsForCourse(courseId, { source: 'server' }),
                getFinalReportByCourseId(courseId, { source: 'server' })
            ]);
            
            const activeParticipants = (participantsData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeFinalReport = (existingReport && existingReport.isDeleted !== true && existingReport.isDeleted !== "true") ? existingReport : null;
            
            setCourseDetailsCache(prev => ({
                ...prev,
                [courseId]: { ...prev[courseId], participants: activeParticipants, finalReport: activeFinalReport }
            }));
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
            const payload = { id: reportData.id, courseId: reportData.courseId, summary: reportData.summary, recommendations: reportData.recommendations, potentialFacilitators: reportData.participantsForFollowUp, pdfUrl: pdfUrl, galleryImageUrls: finalUrlsToSave, participantsForFollowUp: reportData.participantsForFollowUp };
            await upsertFinalReport(payload);
            const savedReport = await getFinalReportByCourseId(reportData.courseId, { source: 'server' });
            setCourseDetailsCache(prev => ({
                ...prev,
                [reportData.courseId]: { ...prev[reportData.courseId], finalReport: savedReport }
            }));
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
            const [participantsData, existingReport] = await Promise.all([ listAllParticipantsForCourse(courseId, { source: 'server' }), getFinalReportByCourseId(courseId, { source: 'server' }) ]);
            
            const activeParticipants = (participantsData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeFinalReport = (existingReport && existingReport.isDeleted !== true && existingReport.isDeleted !== "true") ? existingReport : null;
            
            setCourseDetailsCache(prev => ({
                ...prev,
                [courseId]: { ...prev[courseId], participants: activeParticipants, finalReport: activeFinalReport }
            }));
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

            case 'admin': return <AdminDashboard />;

            case 'imciForm': 
                return permissions.canViewCourse ? (
                    <Suspense fallback={<Card><div className="flex justify-center p-8"><Spinner /></div></Card>}>
                        <IMNCIRecordingForm />
                    </Suspense>
                ) : null;

            case 'humanResources': return <HumanResourcesPage
                activeTab={activeHRTab}
                setActiveTab={setActiveHRTab}
                onAddFacilitator={() => navigate('facilitatorForm')}
                onEditFacilitator={(f) => navigate('facilitatorForm', { editFacilitator: f })}
                onDeleteFacilitator={handleDeleteFacilitator}
                onOpenFacilitatorReport={(fid) => navigate('facilitatorReport', { openFacilitatorReport: fid })}
                onImportFacilitators={async (data) => { await importParticipants(data); await fetchFacilitators(navigator.onLine); }}
                userStates={userStates}
                userLocalities={userLocalities}
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
                onOpenAttendanceManager={(courseId) => { 
                    setSelectedCourseId(courseId);
                    navigate('attendanceManager', { courseId });
                }}
                userStates={userStates}
                userLocalities={userLocalities}
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
                    setCourseDetailsCache(prev => {
                        const newCache = { ...prev };
                        delete newCache[selectedCourse.id];
                        return newCache;
                    });
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
                    
                    setCourseDetailsCache(prev => {
                        const newCache = { ...prev };
                        delete newCache[selectedCourse?.id];
                        return newCache;
                    });
                    
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
                    await fetchCourses(navigator.onLine); 
                    return id; 
                }}
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

            case 'projects':
                return permissions.canUseFederalManagerAdvancedFeatures ? (
                    <Suspense fallback={<Spinner />}>
                        <ProjectTrackerView permissions={permissions} />
                    </Suspense>
                ) : null;

            case 'planning':
                return permissions.canUseFederalManagerAdvancedFeatures ? (
                    <Suspense fallback={<Spinner />}>
                        <PlanningView permissions={permissions} userStates={userStates} />
                    </Suspense>
                ) : null;

            case 'localityPlan':
                return permissions.canViewLocalityPlan ? (
                    <Suspense fallback={<Spinner />}>
                        <LocalityPlanView permissions={permissions} userStates={userStates} userLocalities={userLocalities} />
                    </Suspense>
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
                    onSave={async (payload) => { const id = await upsertCourse({ ...payload, id: editingCourse?.id, course_type: activeCourseType || editingCourse?.course_type }); await fetchCourses(navigator.onLine); handleOpenCourse(id); }}
                    onAddNewCoordinator={handleAddNewCoordinator}
                    onAddNewFunder={handleAddNewFunder}
                    fundersList={funders || []}
                    federalCoordinatorsList={federalCoordinators || []}
                    stateCoordinatorsList={stateCoordinators || []}
                    localityCoordinatorsList={localityCoordinators || []}
                />) : null;

            case 'participantForm': return permissions.canManageCourse ? (selectedCourse && <ParticipantForm course={selectedCourse} initialData={editingParticipant} onCancel={() => navigate(previousView)} onSave={async (participantData, facilityUpdateData) => { try { const fullPayload = { ...participantData, id: editingParticipant?.id, courseId: selectedCourse.id }; await saveParticipantAndSubmitFacilityUpdate(fullPayload, facilityUpdateData); if (facilityUpdateData) setToast({ show: true, message: 'Facility update submitted for approval.', type: 'info' }); 
            
            setCourseDetailsCache(prev => {
                const newCache = { ...prev };
                delete newCache[selectedCourse.id];
                return newCache;
            });
            navigate('participants', { courseId: selectedCourse.id });

            } catch (e) { setToast({ show: true, message: `Submission failed: ${e.message}`, type: 'error' }); } }} />) : null;

            case 'participantReport': return permissions.canViewCourse ? (
                selectedCourse && currentParticipant && 
                <ParticipantReportView 
                    course={selectedCourse} 
                    participant={currentParticipant} 
                    participants={courseDetails.participants} 
                    observations={courseDetails.allObs?.filter(o => o.participant_id === currentParticipant.id) || []}
                    cases={courseDetails.allCases?.filter(c => c.participant_id === currentParticipant.id) || []}
                    onChangeParticipant={(pid) => setSelectedParticipantId(pid)} 
                    onBack={() => navigate(previousView)} 
                    onNavigateToCase={(caseToEdit) => navigate('observe', { caseToEdit, courseId: caseToEdit.courseId, participantId: caseToEdit.participant_id })} 
                    onShare={(participant) => handleShare(participant, 'participant')} 
                />
            ) : null;

            case 'courseReport': return permissions.canViewCourse ? (selectedCourse && <CourseReportView course={selectedCourse} participants={courseDetails.participants} allObs={courseDetails.allObs} allCases={courseDetails.allCases} finalReportData={courseDetails.finalReport} onBack={() => navigate(previousView)} onEditFinalReport={handleEditFinalReport} onDeletePdf={handleDeletePdf} onViewParticipantReport={(pid) => { setSelectedParticipantId(pid); navigate('participantReport'); }} onShare={(course) => handleShare(course, 'course')} setToast={setToast} allHealthFacilities={healthFacilities} />) : null;

            case 'facilitatorForm':
                return permissions.canManageHumanResource ? (<FacilitatorForm 
                    initialData={editingFacilitator} 
                    onCancel={() => navigate(previousView)} 
                    onSave={async () => { 
                        await fetchFacilitators(navigator.onLine); 
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

            case 'dashboard': return <DashboardView onOpenCourseReport={handleOpenCourseReport} onOpenParticipantReport={(pId, cId) => navigate('participantReport', { openParticipantReport: pId, openCourseReport: cId })} onOpenFacilitatorReport={(id) => { setSelectedFacilitatorId(id); navigate('facilitatorReport'); }} permissions={permissions} userStates={userStates} userLocalities={userLocalities} STATE_LOCALITIES={STATE_LOCALITIES} />;

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
            case 'attendanceManager':
                return permissions.canManageCourse ? (
                    selectedCourse && (
                        <Suspense fallback={<Card><Spinner /></Card>}>
                            <AttendanceManagerView 
                                course={selectedCourse} 
                                onClose={() => navigate('courses')} 
                            />
                        </Suspense>
                    )
                ) : null;

            default: return <Landing navigate={navigate} permissions={permissions} />;
        }
    };

    const navItems = useMemo(() => [
        { label: t('landing.modules.home', 'Home'), view: 'landing', active: view === 'landing', disabled: false },
        { label: t('landing.modules.dashboard', 'Dashboard'), view: 'dashboard', active: view === 'dashboard', disabled: false },
        { label: t('landing.modules.courses', 'Courses'), view: 'courses', active: ['courses', 'courseForm', 'courseReport', 'participants', 'participantForm', 'participantReport', 'observe', 'monitoring', 'reports', 'finalReport', 'participantMigration', 'courseDetails', 'test-dashboard', 'enter-test-scores', 'attendanceManager', 'imciForm'].includes(view), disabled: !permissions.canViewCourse }, 
        { label: t('landing.modules.human_resources', 'Human Resources'), view: 'humanResources', active: ['humanResources', 'facilitatorForm', 'facilitatorReport'].includes(view), disabled: !permissions.canViewHumanResource },
        { label: t('landing.modules.facilities', 'Child Health Services'), view: 'childHealthServices', active: view === 'childHealthServices', disabled: !permissions.canViewFacilities },
        { label: t('landing.modules.mentorship', 'Skills Mentorship'), view: 'skillsMentorship', active: view === 'skillsMentorship', disabled: !permissions.canViewSkillsMentorship },
        { label: t('landing.modules.projects', 'Project Tracker'), view: 'projects', active: view === 'projects', disabled: !permissions.canUseFederalManagerAdvancedFeatures },
        { label: t('landing.modules.planning', 'Master Plan'), view: 'planning', active: view === 'planning', disabled: !permissions.canUseFederalManagerAdvancedFeatures },
        { label: t('landing.modules.locality_plan', 'Bottom-up Planning'), view: 'localityPlan', active: view === 'localityPlan', disabled: !permissions.canViewLocalityPlan },
    ], [view, permissions, t]);

    const visibleNavItems = useMemo(() => navItems.filter(item => !item.disabled), [navItems]);

    const isApplicationPublicView = isPublicSubmissionView || isNewFacilityView || isPublicFacilityUpdateView;
    const isMentorshipPublicView = !!publicMentorshipProps || isPublicMentorshipDashboardView; 
    
    const isPublicReportView = !!publicViewType; 

    const isVerificationPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/verify/certificate/');
    const isCertDownloadPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/public/certificate/download/');
    const isCourseCertPagePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/public/course/certificates/');
    const isAttendancePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/attendance/course/');

    const isMinimalUILayout = isApplicationPublicView || isMentorshipPublicView || isPublicMonitoringView || isPublicReportView || isPublicTestView || isVerificationPath || isCertDownloadPath || isCourseCertPagePath || publicViewType === 'certificateDownload' || publicViewType === 'courseCertificatesPage' || isBulkUpdateView || publicViewType === 'attendance' || isPublicRegistrationView || isPublicMeetingView;

    let mainContent;

    if ((authLoading || permissionsLoading) && !isMinimalUILayout) {
        mainContent = <SplashScreen />;
    }
    else if (isPublicMentorshipDashboardView) {
        mainContent = (
             <Suspense fallback={<Card><div className="flex justify-center p-8"><Spinner /></div></Card>}>
                 <SkillsMentorshipView
                     setToast={setToast}
                     permissions={{ canViewSkillsMentorship: true, manageScope: 'none' }}
                     userStates={[]} 
                     userLocalities={[]} 
                     publicDashboardMode={true} 
                     publicDashboardParams={publicMentorshipDashboardParams}
                 />
             </Suspense>
        );
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
    else if (isBulkUpdateView) {
        mainContent = (
            <Suspense fallback={<Card><Spinner /></Card>}>
                <LocalityBulkUpdateView 
                    stateParam={publicBulkUpdateParams.state}
                    localityParam={publicBulkUpdateParams.locality}
                    filters={publicBulkUpdateParams}
                    setToast={setToast}
                />
            </Suspense>
        );
    }
    else if (isPublicRegistrationView) {
        if (publicRegistrationCourseId) {
            mainContent = (
                <Suspense fallback={<Card><Spinner /></Card>}>
                    <PublicParticipantRegistrationView 
                        courseId={publicRegistrationCourseId} 
                    />
                </Suspense>
            );
        } else {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">Invalid Registration Link.</div></Card>;
        }
    }
    else if (isPublicMeetingView) {
        if (publicViewLoading) {
            mainContent = <Card><div className="flex justify-center p-8"><Spinner /></div></Card>;
        } else if (sharedViewError) {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{sharedViewError}</div></Card>;
        } else if (publicMeetingData) {
            mainContent = (
                <Suspense fallback={<Card><Spinner /></Card>}>
                    <PublicMeetingAttendanceView
                        meeting={publicMeetingData}
                        onSave={async (updatedMeeting) => {
                            await upsertUnitMeeting(updatedMeeting);
                            setPublicMeetingData(updatedMeeting);
                            setToast({ show: true, message: 'Attendance updated successfully!', type: 'success' });
                        }}
                    />
                </Suspense>
            );
        } else {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">Could not load meeting data.</div></Card>;
        }
    }

    else if (isPublicReportView || isVerificationPath || publicViewType === 'certificateDownload' || publicViewType === 'courseCertificatesPage' || publicViewType === 'attendance') { 
        if (publicViewLoading || ((isVerificationPath || publicViewType === 'certificateDownload' || publicViewType === 'courseCertificatesPage') && !publicViewData && !sharedViewError)) {
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

                case 'certificateDownload':
                    mainContent = (
                         <Suspense fallback={<Card><Spinner /></Card>}>
                             <PublicCertificateDownloadView 
                                 participantId={publicViewData.participantId} 
                             />
                         </Suspense>
                    );
                    break;
                
                case 'courseCertificatesPage':
                    mainContent = (
                        <Suspense fallback={<Card><Spinner /></Card>}>
                            <PublicCourseCertificatesView 
                                courseId={publicViewData.courseId} 
                            />
                        </Suspense>
                    );
                    break;
                
                case 'attendance':
                    mainContent = (
                        <Suspense fallback={<Card><Spinner /></Card>}>
                            <PublicAttendanceView
                                courseId={publicViewData.courseId}
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

    else if (isMentorshipPublicView && !isPublicMentorshipDashboardView) {
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
                                    const activeParticipants = (participantData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
                                    const activeTests = (testData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
                                    setPublicTestData(prev => ({ ...prev, tests: activeTests, participants: activeParticipants }));
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
                        testType={publicTestType}
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
        <div className="min-h-screen bg-sky-50 flex flex-col pt-0 relative">
            <div className="fixed top-0 start-0 w-full z-[100] flex flex-col">
                {isOffline && (
                    <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-bold flex justify-center items-center gap-2 shadow-md">
                        <WifiOff className="w-5 h-5" /> {t('app.offline', 'You are offline. Changes are saved locally and will sync when reconnected.')}
                    </div>
                )}
                {isSyncing && !isOffline && (
                    <div className="bg-sky-500 text-white text-center py-2 px-4 text-sm font-bold flex justify-center items-center gap-2 shadow-md">
                        <RefreshCw className="w-5 h-5 animate-spin" /> {t('app.syncing', 'Syncing offline data to the cloud...')}
                    </div>
                )}
            </div>

            <header className={`bg-slate-800 shadow-lg sticky z-40 transition-all ${isOffline || isSyncing ? 'top-10' : 'top-0'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => !isSharedView && navigate('landing')}>
                            <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md">
                                <img src="/child.png" alt="NCHP Logo" className="h-12 w-12 object-contain" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-white">{t('app.title', 'National Child Health Program')}</h1>
                                <p className="text-sm text-slate-300 hidden sm:block">{t('app.subtitle', 'Program & Course Monitoring System')}</p>
                            </div>
                        </div>
                        
                        {/* ========================================================= */}
                        {/* WRAPPER FOR NAV AND LANGUAGE BUTTON */}
                        {/* ========================================================= */}
                        <div className="flex items-center gap-3">
                            {!isMinimalUILayout && user && (
                                <nav className="hidden md:flex items-center gap-1">
                                    {visibleNavItems.map(item => (
                                        <button key={item.view} onClick={() => navigate(item.view)} className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${item.active ? 'bg-sky-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}>
                                            {item.label}
                                        </button>
                                    ))} 
                                </nav>
                            )}

                            {/* ALWAYS VISIBLE LANGUAGE TOGGLE BUTTON */}
                            <button
                                onClick={() => {
                                    const newLang = i18n.language?.startsWith('en') ? 'ar' : 'en';
                                    i18n.changeLanguage(newLang);
                                }}
                                className="px-3 py-1.5 text-sm font-bold text-sky-100 bg-slate-700 border border-slate-600 rounded hover:bg-slate-600 hover:text-white transition-colors"
                                title={i18n.language?.startsWith('en') ? 'التبديل إلى العربية' : 'Switch to English'}
                            >
                                {i18n.language?.startsWith('en') ? 'العربية' : 'English'}
                            </button>
                        </div>

                    </div>
                </div>
            </header>

            {user && !isMinimalUILayout && (
                <div className="bg-slate-700 text-slate-200 p-2 md:p-3 text-center flex items-center justify-center gap-4">
                    <div 
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-600 px-3 py-1.5 rounded-md transition-colors duration-200"
                        onClick={() => setIsUserProfileModalOpen(true)}
                        title="View Profile Information"
                    >
                        <span>{t('app.welcome', 'Welcome')}, **{user.displayName || user.email}**</span>
                        {userRole && <span className="bg-sky-500 text-xs px-2 py-1 rounded shadow-sm capitalize">{userRole.replace(/_/g, ' ')}</span>}
                    </div>
                    {permissions.canViewAdmin && (<Button onClick={() => navigate('admin')} variant="primary">{t('landing.modules.admin', 'Admin Dashboard')}</Button>)}
                    <Button onClick={handleLogout} className="px-3 py-1 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">{t('app.logout', 'Logout')}</Button>
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

            <Suspense fallback={null}>
                {isUserProfileModalOpen && user && (
                    <Modal 
                        isOpen={isUserProfileModalOpen} 
                        onClose={() => setIsUserProfileModalOpen(false)} 
                        title="My Profile Information"
                    >
                        <div className="p-6 space-y-6">
                            <div className="flex items-start space-x-4 border-b border-gray-200 pb-6">
                                <div className="h-16 w-16 bg-sky-100 rounded-full flex items-center justify-center text-sky-600 text-3xl font-bold shadow-inner shrink-0">
                                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-gray-800 mb-1">{user.displayName || 'No Name Set'}</h3>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Active Account
                                    </span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-gray-200 p-3 rounded-lg bg-white shadow-sm">
                                    <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Email Address</span>
                                    <span className="text-gray-800 font-medium">{user.email}</span>
                                </div>

                                <div className="border border-gray-200 p-3 rounded-lg bg-white shadow-sm">
                                    <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Date of Registration</span>
                                    <span className="text-gray-800 font-medium">
                                        {user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        }) : 'Not Available'}
                                    </span>
                                </div>

                                {/* Detailed Roles Section */}
                                <div className="border border-gray-200 p-4 rounded-lg bg-white shadow-sm md:col-span-2">
                                    <span className="block text-xs text-gray-500 uppercase font-bold mb-3">Roles & Designations</span>
                                    <div className="flex flex-col gap-2">
                                        {/* System Access Role */}
                                        <div className="flex justify-between items-center bg-sky-50 p-2.5 rounded border border-sky-100">
                                            <span className="text-sm font-medium text-sky-800">System Access Level</span>
                                            <span className="text-sky-700 font-bold capitalize">
                                                {(userRole || 'Standard User').replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        
                                        {/* HR Specific Roles (Only shows if they exist in HR Database) */}
                                        {userHRProfile && userHRProfile.role && (
                                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">Program Team Role</span>
                                                <span className="text-gray-800 font-bold">{userHRProfile.role}</span>
                                            </div>
                                        )}
                                        
                                        {userHRProfile && userHRProfile.unit && (
                                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">Assigned Unit</span>
                                                <span className="text-gray-800 font-bold">{userHRProfile.unit}</span>
                                            </div>
                                        )}

                                        {userHRProfile && userHRProfile.jobTitle && (
                                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">Job Title</span>
                                                <span className="text-gray-800 font-bold">
                                                    {userHRProfile.jobTitle === 'اخرى' ? userHRProfile.jobTitleOther : userHRProfile.jobTitle}
                                                </span>
                                            </div>
                                        )}

                                        {/* Fallback if user isn't assigned an HR role yet */}
                                        {!userHRProfile && (
                                            <div className="text-center p-2 text-xs text-gray-400 mt-2">
                                                No specific Program Team role assigned in the HR database yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="border border-gray-200 p-3 rounded-lg bg-gray-50 shadow-sm">
                                    <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Assigned States</span>
                                    <span className="text-gray-800 font-medium">
                                        {userStates?.length > 0 ? userStates.join(', ') : 'Global / None'}
                                    </span>
                                </div>
                                
                                <div className="border border-gray-200 p-3 rounded-lg bg-gray-50 shadow-sm">
                                    <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Assigned Localities</span>
                                    <span className="text-gray-800 font-medium">
                                        {userLocalities?.length > 0 ? userLocalities.join(', ') : 'All Localities in State / None'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end rounded-b-lg">
                            <Button onClick={() => setIsUserProfileModalOpen(false)} variant="secondary">
                                Close
                            </Button>
                        </div>
                    </Modal>
                )}
            </Suspense>

            {permissions.canUseSuperUserAdvancedFeatures && isMonitorVisible && (
                <ResourceMonitor
                    counts={operationCounts}
                    onReset={handleResetMonitor}
                    onDismiss={handleDismissMonitor}
                />
            )}

            {isUpdateReady && updateBundle && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-[100000] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-sky-100">
                            <RefreshCw className="h-6 w-6 text-sky-600 animate-spin" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Update Ready!</h3>
                        <p className="text-sm text-slate-500">
                            A new version of the app has been downloaded in the background. You must restart the app to apply the update and continue.
                        </p>
                        <button 
                            onClick={async () => {
                                try {
                                    await CapacitorUpdater.set({ id: updateBundle.id }); 
                                } catch (e) {
                                    console.error("Failed to apply update", e);
                                }
                            }}
                            className="w-full inline-flex justify-center rounded-md border border-transparent bg-sky-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 sm:text-sm"
                        >
                            Restart & Update Now
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}