// App.jsx
import './i18n'; 
import React, { useEffect, useMemo, useState, useRef, lazy, Suspense, useCallback } from "react";
import { useTranslation } from 'react-i18next'; 
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement } from 'chart.js';

import {
    Home, Book, Users, User, Hospital, Database, ClipboardCheck, ClipboardList, FolderKanban, TrendingUp, X, WifiOff, RefreshCw, Activity, Layers, Globe, LogOut, Info, Download, HardDrive
} from 'lucide-react';

import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { LocalNotifications } from '@capacitor/local-notifications';

// --- IMPORTS FOR GENERIC DOWNLOAD MANAGER ---
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

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
const ProgramTeamView = lazy(() => import('./components/ProgramTeamView.jsx'));
const PublicTeamMemberProfileView = lazy(() => import('./components/ProgramTeamView.jsx').then(module => ({ default: module.PublicTeamMemberProfileView })));
const TeamMemberApplicationForm = lazy(() => import('./components/ProgramTeamView.jsx').then(module => ({ default: module.TeamMemberApplicationForm })));

const IMNCIRecordingForm = lazy(() => import('./components/IMNCIRecordingForm'));

// --- FIXED LAZY IMPORTS HERE ---
const CertificateVerificationView = lazy(() => import('./components/CertificateGenerator').then(module => ({ default: module.CertificateVerificationView })));
const PublicCertificateDownloadView = lazy(() => import('./components/CertificateGenerator').then(module => ({ default: module.PublicCertificateDownloadView })));
const PublicCourseCertificatesView = lazy(() => import('./components/CertificateGenerator').then(module => ({ default: module.PublicCourseCertificatesView }))); 

const PublicAttendanceView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicAttendanceView })));
const AttendanceManagerView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.AttendanceManagerView })));
const PublicParticipantRegistrationView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicParticipantRegistrationView })));
const PublicCourseMonitoringView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicCourseMonitoringView })));

const CourseTestForm = lazy(() => import('./components/CourseTestForm.jsx').then(module => ({ default: module.CourseTestForm })));

const PublicFacilityUpdateForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.PublicFacilityUpdateForm })));
const NewFacilityEntryForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.NewFacilityEntryForm })));
const SkillsMentorshipView = lazy(() => import('./components/mentorship/SkillsMentorshipView.jsx'));

const ProjectTrackerView = lazy(() => import('./components/ProjectTrackerView'));
const PublicMeetingAttendanceView = lazy(() => import('./components/ProjectTrackerView').then(module => ({ default: module.PublicMeetingAttendanceView })));
const PlanningView = lazy(() => import('./components/PlanningView'));
const LocalityPlanView = lazy(() => import('./components/LocalityPlanView'));

// --- DOWNLOADS AND ABOUT PAGE ---
const AboutDeveloperPage = lazy(() => import('./components/AboutDeveloperPage'));
const DownloadedFilesView = lazy(() => import('./components/DownloadedFilesView.jsx'));

// --- PERMISSIONS IMPORT ---
import { 
    ALL_PERMISSIONS, 
    ALL_PERMISSION_KEYS, 
    DEFAULT_ROLE_PERMISSIONS, 
    applyDerivedPermissions 
} from './components/permissions.js';

import {
    listAllDataForCourse, deleteFacilitator,
    upsertFinalReport, getFinalReportByCourseId, uploadFile, deleteFile,
    getCourseById, getParticipantById, updateCourseSharingSettings, updateParticipantSharingSettings,
    listPendingFacilitatorSubmissions, approveFacilitatorSubmission, rejectFacilitatorSubmission,
    saveParticipantAndSubmitFacilityUpdate,
    getPublicCourseReportData,
    getPublicFacilitatorReportData,
    getPublicTeamMemberProfileData,
    initializeUsageTracking,
    listAllParticipantsForCourse,
    listParticipantTestsForCourse, 
    upsertParticipantTest,
    getUnitMeetingById,
    upsertUnitMeeting
} from './data.js';
import { STATE_LOCALITIES } from './components/constants.js';
import { Card, PageHeader, Button, Table, EmptyState, Spinner, PdfIcon, CourseIcon, Footer, Toast, Modal, Input } from './components/CommonComponents';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, waitForPendingWrites } from 'firebase/firestore';
import { signOut, updateProfile } from 'firebase/auth'; 
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
                            <input type="radio" name="accessLevel" value="private" checked={accessLevel === 'private'} onChange={() => setAccessLevel('private')} className="form-radio text-sky-600" />
                            <span>Restricted</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input type="radio" name="accessLevel" value="public" checked={accessLevel === 'public'} onChange={() => setAccessLevel('public')} className="form-radio text-sky-600" />
                            <span>Anyone with the link</span>
                        </label>
                    </div>
                </div>

                {accessLevel === 'private' && (
                    <div className="space-y-4">
                        <label className="font-semibold text-gray-700">Share with specific people</label>
                        <div className="flex space-x-2">
                            <Input type="email" placeholder="Enter email address" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="flex-grow" />
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

const ResourceMonitor = ({ counts, onReset, onDismiss }) => {
    return (
        <div className="fixed top-4 end-4 md:bottom-4 md:top-auto bg-gray-900 text-white p-2 rounded-lg shadow-lg z-50 opacity-90 w-56">
            <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-sky-400" />
                    <h4 className="font-bold text-sm">Session Ops</h4>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onReset} className="text-xs text-gray-400 hover:text-white transition-colors" title="Reset Counts">Reset</button>
                    <button onClick={onDismiss} className="text-gray-400 hover:text-white transition-colors" title="Dismiss Monitor"><X className="w-4 h-4" /></button>
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

// --- Landing Page ---
function Landing({ navigate, permissions }) {
    const { t } = useTranslation();
    
    // Conditionally include 'downloads' ONLY if it's a native platform
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
        { label: t('landing.modules.downloads', 'App Files & Downloads'), view: 'downloads', icon: HardDrive, permission: Capacitor.isNativePlatform() },
        { label: t('landing.modules.admin', 'Admin'), view: 'admin', icon: User, permission: permissions.canViewAdmin },
        { label: t('landing.modules.about', 'About Team'), view: 'about', icon: Info, permission: true },
    ];

    const accessibleButtons = navButtons.filter(btn => btn.permission);

    return (
        <div className="flex flex-col min-h-full">
            <Card>
                <PageHeader title={t('landing.welcome', 'Welcome')} subtitle={t('landing.subtitle', 'Select a module to get started')} />
                <div className="p-4">
                    {accessibleButtons.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {accessibleButtons.map(btn => {
                                const Icon = btn.icon; 
                                return (
                                    <button key={btn.view} onClick={() => navigate(btn.view)} className="flex flex-col items-center justify-center gap-3 p-6 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:bg-slate-50 transition-all duration-150 text-slate-700 hover:text-sky-600">
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
            
            {/* Desktop footer */}
            <div className="hidden md:block mt-8 mb-4 text-center text-slate-600 text-xs font-medium w-full">
                <p>App developed by Dr Qusay Mohamed - <a href="mailto:Gussaay@gmail.com" className="text-sky-600 hover:text-sky-500 transition-colors font-bold">Gussaay@gmail.com</a></p>
            </div>
        </div>
    );
}

// --- UPDATED BOTTOM NAV COMPONENT ---
const BottomNav = React.memo(function BottomNav({ navItems, navigate, currentView }) {
    const icons = { 
        'landing': Home, 'dashboard': Home, 'courses': Book, 'humanResources': Users, 'childHealthServices': Hospital, 
        'skillsMentorship': ClipboardCheck, 'downloads': HardDrive
    };
    
    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 flex flex-col z-[60] shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center px-2 w-full">
                {navItems.map(item => {
                    const Icon = icons[item.view] || Activity;
                    return (
                        <button 
                            key={item.view} 
                            onClick={() => navigate(item.view)} 
                            className={`flex flex-col items-center justify-center p-1 w-full h-16 flex-1 min-w-0 transition-colors ${item.active ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}
                            title={item.label} 
                        >
                            {Icon && <Icon className="w-6 h-6 mb-1 shrink-0" />}
                            <span className="w-full text-center text-[10px] sm:text-[11px] leading-tight truncate px-0.5 block">
                                {item.label}
                            </span>
                        </button>
                    )
                })}
            </div>
            
            {currentView === 'landing' && (
                <div className="bg-slate-900 text-slate-400 text-center text-[8px] py-1.5 w-full border-t border-slate-800">
                    App developed by Dr Qusay Mohamed - <a href="mailto:Gussaay@gmail.com" className="text-sky-400 hover:text-sky-300">Gussaay@gmail.com</a>
                </div>
            )}
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
    
    const [appVersion, setAppVersion] = useState(import.meta.env.VITE_APP_VERSION || window.APP_VERSION || '1.0.2');
    
    const [isUpdateReady, setIsUpdateReady] = useState(false);
    const [updateBundle, setUpdateBundle] = useState(null);
    const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);

    const [nativeUpdatePrompt, setNativeUpdatePrompt] = useState(null);
    const [manualUpdateModal, setManualUpdateModal] = useState({ isOpen: false, status: 'idle', message: '' });

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editDisplayName, setEditDisplayName] = useState('');

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
                        await Promise.race([ waitForPendingWrites(db), new Promise(resolve => setTimeout(resolve, 5000)) ]);
                    } catch (e) { console.error("Error waiting for pending writes during sync:", e); } finally { setIsSyncing(false); }
                }
            });
        };
        setupNetworkListener();
        return () => { if (networkListener) networkListener.remove(); };
    }, []);

    const {
        courses: rawCourses, facilitators: rawFacilitators,
        funders, federalCoordinators, stateCoordinators, localityCoordinators, healthFacilities, participantTests, 
        fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators,
        fetchHealthFacilities, fetchSkillMentorshipSubmissions, fetchParticipantTests
    } = useDataCache();

    const allCourses = useMemo(() => (rawCourses || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true"), [rawCourses]);
    const allFacilitators = useMemo(() => (rawFacilitators || []).filter(f => f.isDeleted !== true && f.isDeleted !== "true"), [rawFacilitators]);

    const { user, userStates, authLoading, userLocalities } = useAuth();

    const isProfileIncomplete = useMemo(() => {
        if (!authLoading && user && (!user.displayName || user.displayName.trim().length === 0)) return true;
        return false;
    }, [user, authLoading]);

    const userHRProfile = useMemo(() => {
        if (!user || !user.email) return null;
        const allCoordinators = [ ...(federalCoordinators || []), ...(stateCoordinators || []), ...(localityCoordinators || []) ];
        return allCoordinators.find(c => c.email === user.email);
    }, [user, federalCoordinators, stateCoordinators, localityCoordinators]);

    useEffect(() => {
        if (isUserProfileModalOpen) { fetchFederalCoordinators(); fetchStateCoordinators(); fetchLocalityCoordinators(); }
    }, [isUserProfileModalOpen, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators]);

    useEffect(() => {
        if (isUserProfileModalOpen && user) {
            setEditDisplayName(user.displayName || '');
            setIsEditingProfile(false);
        }
    }, [isUserProfileModalOpen, user]);

    const handleSaveProfile = async () => {
        try {
            await updateProfile(auth.currentUser, { displayName: editDisplayName });
            setToast({ show: true, message: 'Profile updated successfully!', type: 'success' });
            setIsEditingProfile(false);
            window.location.reload(); 
        } catch (error) {
            setToast({ show: true, message: `Failed to update profile: ${error.message}`, type: 'error' });
        }
    };

    const [view, setView] = useState("landing");
    const [activeCourseType, setActiveCourseType] = useState(null);
    const [selectedCourseId, setSelectedCourseId] = useState(null);
    const [selectedParticipantId, setSelectedParticipantId] = useState(null);
    const [selectedFacilitatorId, setSelectedFacilitatorId] = useState(null);
    const [editingCourse, setEditingCourse] = useState(null);
    const [editingFacilitator, setEditingFacilitator] = useState(null);
    const [finalReportCourse, setFinalReportCourse] = useState(null);
    const [editingCaseFromReport, setEditingCaseFromReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previousView, setPreviousView] = useState("landing");
    const [userRole, setUserRole] = useState(null);
    const [userRoles, setUserRoles] = useState([]); 
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
    const [publicMeetingTargetDate, setPublicMeetingTargetDate] = useState(null); 

    const [operationCounts, setOperationCounts] = useState({ reads: 0, writes: 0 });
    const [isMonitorVisible, setIsMonitorVisible] = useState(true);

    const historyInitialized = useRef(false);
    const isPopStateNavigation = useRef(false);
    const initialViewIsSet = useRef(false);

    // =========================================================================
    // --- GENERIC IN-APP DOWNLOAD & OPEN MANAGER (FIXED MEMORY CRASH) ---
    // =========================================================================
    const handleFileDownloadAndOpen = async (url, customFileName = null) => {
        if (!Capacitor.isNativePlatform()) {
            window.open(url, '_blank');
            return;
        }

        setIsDownloadingUpdate(true); 
        setUpdateProgress(0);

        try {
            const fileName = customFileName || url.substring(url.lastIndexOf('/') + 1) || 'downloaded_file.apk';
            
            let mimeType = 'application/vnd.android.package-archive';
            const lowerName = fileName.toLowerCase();
            if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
            else if (lowerName.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            else if (lowerName.endsWith('.png')) mimeType = 'image/png';
            else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';

            try {
                await Filesystem.mkdir({ path: 'downloads', directory: Directory.Data, recursive: true });
            } catch (e) {
                // Ignore if it already exists
            }

            const filePath = `downloads/${fileName}`;

            // --- USE NATIVE BACKGROUND DOWNLOADER ---
            // Bypasses the webview memory limits completely, fixing the Base64/Fetch Crash!
            await CapacitorHttp.downloadFile({
                url: url,
                filePath: filePath,
                fileDirectory: Directory.Data 
            });

            // Get the absolute device URI for the newly downloaded file
            const { uri } = await Filesystem.getUri({
                path: filePath,
                directory: Directory.Data
            });

            setToast({ show: true, message: 'Download complete. Opening...', type: 'success' });

            // Trigger the native OS "Open With" / Installer intent
            await FileOpener.open({
                filePath: uri,
                contentType: mimeType,
                openWithDefault: true
            });

        } catch (error) {
            console.error("Full Download Error:", error);
            alert(`NATIVE ERROR: ${error.message || JSON.stringify(error)}`);
            setToast({ show: true, message: `Failed to open automatically. Check App Files & Downloads.`, type: 'error' });
        } finally {
            setIsDownloadingUpdate(false);
            setUpdateProgress(0);
        }
    };

    // --- DECOUPLED & ARMOR-PLATED UPDATE SCRIPT ---
    useEffect(() => {
        let downloadListenerHandle;

        if (Capacitor.isNativePlatform()) {
            const setupAndCheckUpdates = async () => {
                
                // 1. CONFIRM OTA SUCCESS TO CAPGO (PREVENTS ROLLBACK LOOP!)
                try {
                    await CapacitorUpdater.notifyAppReady();
                } catch (e) {
                    console.warn("notifyAppReady failed", e);
                }

                // 2. SETUP ANDROID NOTIFICATION CHANNELS (FIXES SILENT NOTIFICATIONS)
                try {
                    let permStatus = await LocalNotifications.checkPermissions();
                    if (permStatus.display !== 'granted') {
                        permStatus = await LocalNotifications.requestPermissions();
                    }
                    
                    // Create channel explicitly for Android 13+ before scheduling anything
                    if (permStatus.display === 'granted' && Capacitor.getPlatform() === 'android') {
                        await LocalNotifications.createChannel({
                            id: 'updates',
                            name: 'App Updates',
                            description: 'Notifications for app updates',
                            importance: 5,
                            visibility: 1
                        });
                    }
                } catch (err) {
                    console.warn("Notifications missing or denied. Skipping.", err);
                }

                // 3. START BACKGROUND CHECKS
                const status = await Network.getStatus();
                if (!status.connected) return;

                // --- NATIVE CHECK (FIRESTORE) ---
                try {
                    const updateDocRef = doc(db, "meta", "update_config");
                    const updateSnap = await getDoc(updateDocRef);

                    if (updateSnap.exists()) {
                        const serverConfig = updateSnap.data();
                        const appInfo = await CapacitorApp.getInfo();
                        
                        const currentBuild = parseInt(appInfo.build, 10) || 1;
                        const serverBuild = parseInt(serverConfig.latestNativeBuild, 10);

                        if (serverBuild > currentBuild) {
                            console.log(`Native update required! App: ${currentBuild}, Server: ${serverBuild}`);
                            setNativeUpdatePrompt(serverConfig);

                            try {
                                await LocalNotifications.schedule({
                                    notifications: [{
                                        title: "تحديث جديد للتطبيق",
                                        body: `يتوفر إصدار جديد (${serverConfig.versionString}). يرجى التحميل الآن.`,
                                        id: 101,
                                        channelId: 'updates',
                                        schedule: { at: new Date(Date.now() + 1000) }
                                    }]
                                });
                            } catch (e) {}
                            return; // Stop here if native update is required
                        }
                    }
                } catch (e) {
                    console.warn("Native update check failed safely:", e);
                }

                // --- CAPGO OTA WEB CHECK (SILENT BACKGROUND) ---
                try {
                    const currentState = await CapacitorUpdater.current();
                    const currentVersion = currentState.bundle?.version || import.meta.env.VITE_APP_VERSION || "builtin";
                    
                    setAppVersion(currentVersion); // Update UI version immediately

                    // Standard fetch with cache busting to prevent old versions from sticking
                    const response = await fetch('https://imnci-courses-monitor.web.app/latest/update.json?t=' + Date.now(), { cache: "no-store" });

                    if (response.ok) {
                        const latestUpdate = await response.json();

                        if (currentVersion !== latestUpdate.version) {
                            console.log(`Downloading Capgo bundle ${latestUpdate.version}...`);
                            
                            // Download SILENTLY in the background without blocking the UI
                            const downloadedBundle = await CapacitorUpdater.download({ url: latestUpdate.url, version: latestUpdate.version });
                            setUpdateBundle(downloadedBundle); 
                            setIsUpdateReady(true); // Pops up the "Restart to Apply" modal

                            try {
                                await LocalNotifications.schedule({
                                    notifications: [{
                                        title: "تحديث جاهز!",
                                        body: "تم تحميل التحديث بنجاح. انقر لإعادة تشغيل التطبيق.",
                                        id: 102,
                                        channelId: 'updates',
                                        schedule: { at: new Date(Date.now() + 1000) }
                                    }]
                                });
                            } catch (e) {}
                        }
                    }
                } catch (error) { 
                    console.warn("Capgo check failed safely:", error); 
                }
            };
            
            // Wait a few seconds for app to fully boot before checking
            setTimeout(setupAndCheckUpdates, 5000); 

            // REGISTER PROGRESS LISTENER
            CapacitorUpdater.addListener('download', (info) => {
                setUpdateProgress(info.percent); 
            }).then(handle => {
                downloadListenerHandle = handle;
            }).catch(e => console.warn("Failed to bind Capgo listener", e));
        }

        return () => {
            if (downloadListenerHandle) downloadListenerHandle.remove();
        };
    }, []);

    // =========================================================================
    // --- MANUAL UPDATE CHECKER ---
    // =========================================================================
    const handleManualUpdateCheck = async () => {
        setManualUpdateModal({ isOpen: true, status: 'checking', message: 'Checking for updates...' });

        if (!Capacitor.isNativePlatform()) {
            setManualUpdateModal({ isOpen: true, status: 'info', message: 'Web version is always up to date on refresh.' });
            return;
        }

        try {
            const status = await Network.getStatus();
            if (!status.connected) {
                setManualUpdateModal({ isOpen: true, status: 'error', message: 'You are offline. Cannot check for updates.' });
                return;
            }

            let nativeUpdateFound = false;

            try {
                const updateDocRef = doc(db, "meta", "update_config");
                const updateSnap = await getDoc(updateDocRef);

                if (updateSnap.exists()) {
                    const serverConfig = updateSnap.data();
                    const appInfo = await CapacitorApp.getInfo();
                    const currentBuild = parseInt(appInfo.build, 10) || 1;
                    const serverBuild = parseInt(serverConfig.latestNativeBuild, 10);
                    
                    if (serverBuild > currentBuild) {
                        setManualUpdateModal({ isOpen: false, status: 'idle', message: '' }); 
                        setNativeUpdatePrompt(serverConfig); 
                        nativeUpdateFound = true;
                        return; 
                    }
                }
            } catch (fsError) {
                console.warn("Firestore native check skipped due to error:", fsError);
            }

            try {
                const response = await fetch('https://imnci-courses-monitor.web.app/latest/update.json?t=' + Date.now(), { cache: "no-store" });

                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`);
                }

                const latestUpdate = await response.json();
                const currentState = await CapacitorUpdater.current();
                const currentVersion = currentState.bundle?.version || "builtin";

                if (currentVersion !== latestUpdate.version) {
                    setManualUpdateModal({ isOpen: false, status: 'idle', message: '' });
                    setIsDownloadingUpdate(true);
                    setUpdateProgress(0);
                    
                    const downloadedBundle = await CapacitorUpdater.download({ url: latestUpdate.url, version: latestUpdate.version });
                    setUpdateBundle(downloadedBundle); 
                    setIsUpdateReady(true);
                } else if (!nativeUpdateFound) {
                    setManualUpdateModal({ 
                        isOpen: true, 
                        status: 'success', 
                        message: `App is already up to date! (Version: ${currentVersion})` 
                    });
                }
            } catch (fetchError) {
                 throw new Error(`Network request failed: ${fetchError.message}`);
            }

        } catch (error) {
            console.error("Manual update check failed:", error);
            setManualUpdateModal({ isOpen: true, status: 'error', message: `${error.message || 'Unknown error occurred.'}` });
        } finally {
            setIsDownloadingUpdate(false);
        }
    };
    // =========================================================================

    
    useEffect(() => { if (!authLoading && user) initializeUsageTracking(); }, [authLoading, user]);

    useEffect(() => {
      const handleOperation = (event) => {
        const { type, count } = event.detail;
        setOperationCounts(prev => ({ ...prev, [type === 'read' ? 'reads' : 'writes']: (prev[type === 'read' ? 'reads' : 'writes'] || 0) + count }));
      };
      window.addEventListener('firestoreOperation', handleOperation);
      return () => { window.removeEventListener('firestoreOperation', handleOperation); };
    }, []);

    useEffect(() => {
        if (historyInitialized.current) return;
        historyInitialized.current = true;

        const handlePathChange = async () => { 
            const path = window.location.pathname;

            setIsSharedView(false); setIsPublicSubmissionView(false); setIsNewFacilityView(false); setIsPublicFacilityUpdateView(false); setPublicServiceType(null); 
            setIsPublicMonitoringView(false); setPublicMonitorError(null); setPublicMonitorData({ course: null, participants: [] }); 
            setPublicMentorshipProps(null); setSubmissionType(null); setSharedViewError(null);
            
            setIsPublicMentorshipDashboardView(false); setPublicMentorshipDashboardParams(null);

            setPublicViewData(null); setPublicViewType(null); setPublicViewLoading(false);

            setIsPublicTestView(false); setPublicTestError(null); setPublicTestData({ course: null, participants: [], tests: [] }); setPublicTestType(null); 

            setIsPublicRegistrationView(false); setPublicRegistrationCourseId(null);

            setIsBulkUpdateView(false); setPublicBulkUpdateParams({});

            setIsPublicMeetingView(false); setPublicMeetingId(null); setPublicMeetingData(null); setPublicMeetingTargetDate(null);

            // --- PUBLIC ROUTES EVALUATION ---
            
            const publicMeetingMatch = path.match(/^\/public\/meeting\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicMeetingMatch && publicMeetingMatch[1]) {
                setIsPublicMeetingView(true); setPublicMeetingId(publicMeetingMatch[1]); setPublicViewLoading(true);
                
                // Extract target date from URL
                const searchParams = new URLSearchParams(window.location.search);
                setPublicMeetingTargetDate(searchParams.get('date'));
                
                getUnitMeetingById(publicMeetingMatch[1], 'server')
                    .then(data => { if (!data) throw new Error("Meeting not found."); setPublicMeetingData(data); })
                    .catch(err => setSharedViewError(err.message))
                    .finally(() => setPublicViewLoading(false));
                return;
            }

            // Mentorship Record Deep Link explicitly formatted so it doesn't default to dashboard
            const publicMentorshipRecordMatch = path.match(/^\/public\/mentorship\/record\/([a-zA-Z0-9_]+)\/(cases|mothers|reports)\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicMentorshipRecordMatch) {
                setIsPublicMentorshipDashboardView(true);
                const searchParams = new URLSearchParams(window.location.search);
                const langParam = searchParams.get('lang');
                if (langParam) { localStorage.setItem('language', langParam); localStorage.setItem('app_language', langParam); }
                
                setPublicMentorshipDashboardParams({
                    serviceType: publicMentorshipRecordMatch[1],
                    viewType: publicMentorshipRecordMatch[2],
                    viewId: publicMentorshipRecordMatch[3],
                    isRecordView: true,
                    state: '', locality: '', facilityId: '', workerName: '', project: '', workerType: '', week: '', month: '', lang: langParam || ''
                });
                return;
            }

            // Mentorship Dashboard Deep Link
            const publicMentorshipDashboardMatch = path.match(/^\/public\/mentorship\/dashboard\/([a-zA-Z0-9_]+)\/?$/);
            if (publicMentorshipDashboardMatch && publicMentorshipDashboardMatch[1]) {
                setIsPublicMentorshipDashboardView(true);
                const searchParams = new URLSearchParams(window.location.search);
                const langParam = searchParams.get('lang');
                if (langParam) { localStorage.setItem('language', langParam); localStorage.setItem('app_language', langParam); }

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
                if (service) setPublicServiceType(service); 
                return;
            }
            if (facilityUpdateMatch) {
                setIsPublicFacilityUpdateView(true);
                const searchParams = new URLSearchParams(window.location.search);
                const service = searchParams.get('service');
                if (service) setPublicServiceType(service); 
                return;
            }

            const publicMonitorMatch = path.match(/^\/monitor\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicMonitorMatch && publicMonitorMatch[1]) {
                setIsPublicMonitoringView(true);
                const courseId = publicMonitorMatch[1];
                setPublicMonitorLoading(true);
                const fetchData = async () => {
                    try {
                        const [courseData, participantData] = await Promise.all([ getCourseById(courseId, 'server'), listAllParticipantsForCourse(courseId, { source: 'server' }) ]);
                        if (!courseData) throw new Error('Course not found.');
                        if (!participantData) throw new Error('Participants not found.'); 
                        const activeParticipants = (participantData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
                        setPublicMonitorData({ course: courseData, participants: activeParticipants });
                        setPublicMonitorError(null);
                    } catch (err) { setPublicMonitorError(err.message); } finally { setPublicMonitorLoading(false); }
                };
                fetchData();
                return; 
            }
            
            const bulkUpdateMatch = path.match(/^\/public\/bulk-update\/?$/);
            if (bulkUpdateMatch) {
                setIsBulkUpdateView(true);
                const searchParams = new URLSearchParams(window.location.search);
                setPublicBulkUpdateParams({
                    state: searchParams.get('state') || '', locality: searchParams.get('locality') || '', facilityType: searchParams.get('facilityType') || '',
                    functioning: searchParams.get('functioning') || '', project: searchParams.get('project') || '', service: searchParams.get('service') || ''
                });
                return;
            }

            const publicMentorshipMatch = path.match(/^\/mentorship\/submit\/([a-zA-Z0-9_]+)\/?$/);
            if (publicMentorshipMatch && publicMentorshipMatch[1]) { setPublicMentorshipProps({ serviceType: publicMentorshipMatch[1] }); return; }

            const facilitatorAppMatch = path.match(/^\/public\/facilitator-application\/?$/);
            if (facilitatorAppMatch) { setIsPublicSubmissionView(true); setSubmissionType('facilitator-application'); return; }

            const teamAppMatch = path.match(/^\/public\/team-member-application\/?$/);
            if (teamAppMatch) { setIsPublicSubmissionView(true); setSubmissionType('team-member-application'); return; }
            
            const publicRegistrationMatch = path.match(/^\/public\/register\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicRegistrationMatch && publicRegistrationMatch[1]) { setIsPublicRegistrationView(true); setPublicRegistrationCourseId(publicRegistrationMatch[1]); return; }

            const publicTestMatch = path.match(/^\/public\/test\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicTestMatch && publicTestMatch[1]) {
                setIsPublicTestView(true);
                const courseId = publicTestMatch[1];
                const searchParams = new URLSearchParams(window.location.search);
                setPublicTestType(searchParams.get('type'));
                setPublicTestLoading(true);
                const fetchData = async () => {
                    try {
                        const [courseData, participantData, testData] = await Promise.all([ getCourseById(courseId, 'server'), listAllParticipantsForCourse(courseId, { source: 'server' }), listParticipantTestsForCourse(courseId, { source: 'server' }) ]);
                        if (!courseData) throw new Error('Course not found.'); if (!participantData) throw new Error('Participants not found.');
                        if (!['ICCM', 'EENC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management', 'Comprehensive Package For Community Midwives'].includes(courseData.course_type)) { throw new Error('Test forms are only available for selected courses.'); }
                        const activeParticipants = (participantData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
                        const activeTests = (testData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
                        setPublicTestData({ course: courseData, participants: activeParticipants, tests: activeTests });
                        setPublicTestError(null);
                    } catch (err) { setPublicTestError(err.message); } finally { setPublicTestLoading(false); }
                };
                fetchData();
                return; 
            }
            
            const certDownloadMatch = path.match(/^\/public\/certificate\/download\/([a-zA-Z0-9_-]+)\/?$/);
            if (certDownloadMatch && certDownloadMatch[1]) { setPublicViewType('certificateDownload'); setPublicViewData({ participantId: certDownloadMatch[1] }); return; }
            
            const courseCertPageMatch = path.match(/^\/public\/course\/certificates\/([a-zA-Z0-9_-]+)\/?$/);
            if (courseCertPageMatch && courseCertPageMatch[1]) { setPublicViewType('courseCertificatesPage'); setPublicViewData({ courseId: courseCertPageMatch[1] }); return; }
            
            const publicAttendanceMatch = path.match(/^\/attendance\/course\/([a-zA-Z0-9]+)\/?$/);
            if (publicAttendanceMatch && publicAttendanceMatch[1]) { setPublicViewType('attendance'); setPublicViewData({ courseId: publicAttendanceMatch[1] }); return; }

            const publicCertificateMatch = path.match(/^\/verify\/certificate\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicCertificateMatch && publicCertificateMatch[1]) {
                setPublicViewType('certificateVerification'); setPublicViewLoading(true);
                try {
                    const participant = await getParticipantById(publicCertificateMatch[1], 'server');
                    if (!participant || !participant.courseId) throw new Error("Certificate invalid or participant not found.");
                    const course = await getCourseById(participant.courseId, 'server');
                    if (!course) throw new Error("Associated course data not found.");
                    setPublicViewData({ participant, course });
                } catch (error) { setSharedViewError(error.message); } finally { setPublicViewLoading(false); }
                return; 
            }

            const publicCourseReportMatch = path.match(/^\/public\/report\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicCourseReportMatch && publicCourseReportMatch[1]) {
                setIsSharedView(true); setPublicViewType('courseReport'); setPublicViewLoading(true);
                try { const data = await getPublicCourseReportData(publicCourseReportMatch[1]); setSharedReportData(data); setPublicViewData(data); } catch (error) { setSharedViewError(error.message); } finally { setPublicViewLoading(false); }
                return; 
            }

            const publicFacilitatorReportMatch = path.match(/^\/public\/report\/facilitator\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicFacilitatorReportMatch && publicFacilitatorReportMatch[1]) {
                setPublicViewType('facilitatorReport'); setPublicViewLoading(true);
                try { const data = await getPublicFacilitatorReportData(publicFacilitatorReportMatch[1]); setPublicViewData(data); } catch (error) { setSharedViewError(error.message); } finally { setPublicViewLoading(false); }
                return; 
            }

            const publicTeamMemberMatch = path.match(/^\/public\/profile\/team\/(federal|state|locality)\/([a-zA-Z0-9]+)\/?$/);
            if (publicTeamMemberMatch && publicTeamMemberMatch[1] && publicTeamMemberMatch[2]) {
                setPublicViewType('teamMemberProfile'); setPublicViewLoading(true);
                try { const data = await getPublicTeamMemberProfileData(publicTeamMemberMatch[1], publicTeamMemberMatch[2]); setPublicViewData(data); } catch (error) { setSharedViewError(error.message); } finally { setPublicViewLoading(false); }
                return; 
            }
        };

        handlePathChange();
    }, []); 

    const permissions = useMemo(() => {
        let derivedPermissions = { ...userPermissions };
        
        if (userRole?.toLowerCase() === 'super_user') {
            return ALL_PERMISSION_KEYS.reduce((acc, key) => {
                acc[key] = key === 'canEditLocalityPlan' ? false : true;
                return acc;
            }, { role: userRole });
        }

        if (userRole?.toLowerCase() === 'user') { derivedPermissions.canViewSkillsMentorship = false; derivedPermissions.canManageSkillsMentorship = false; }

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

    // UPDATED AND SECURED checkUserRoleAndPermissions logic
    useEffect(() => {
        const checkUserRoleAndPermissions = async () => {
            setPermissionsLoading(true);
            try {
                if (user) {
                    const status = await Network.getStatus();
                    const isOffline = !status.connected;
                    
                    const userRef = doc(db, "users", user.uid);
                    let userSnap;
                    
                    // Safe offline check
                    try {
                        const sourceOptions = isOffline ? { source: 'cache' } : {};
                        userSnap = await getDoc(userRef, sourceOptions);
                    } catch (e) {
                        userSnap = await getDoc(userRef, { source: 'cache' });
                    }
                    
                    let role; let roles = []; let permissionsData = {};

                    // IF THE DOCUMENT IS MISSING (Either a brand new user, OR offline with a cleared cache)
                    if (!userSnap.exists() || !userSnap.data().role) {
                        
                        // 1. Check Local Storage backup first
                        const backupRole = localStorage.getItem(`backup_role_${user.uid}`);
                        
                        if (isOffline && backupRole) {
                            // Restore from our secondary backup
                            role = backupRole;
                            roles = JSON.parse(localStorage.getItem(`backup_roles_${user.uid}`) || `["${role}"]`);
                            permissionsData = JSON.parse(localStorage.getItem(`backup_perms_${user.uid}`) || "{}");
                            console.log("Restored user role from localStorage fallback.");
                        } else {
                            // Truly no role found
                            role = 'user';
                            roles = ['user'];
                            const rawPerms = DEFAULT_ROLE_PERMISSIONS.user;
                            permissionsData = applyDerivedPermissions(rawPerms);
                            
                            // CRITICAL: ONLY SAVE TO FIREBASE IF ONLINE
                            // If offline, we give them basic access locally but DO NOT queue a write that overwrites their cloud role later.
                            if (!isOffline) {
                                setDoc(userRef, { 
                                    email: user.email, 
                                    role: role, 
                                    roles: roles, 
                                    permissions: permissionsData, 
                                    lastLogin: new Date(), 
                                    assignedState: '' 
                                }, { merge: true }).catch(err => console.warn("Failed to set default role:", err));
                            }
                        }
                    } else {
                        // USER EXISTS IN FIRESTORE/CACHE - Load Normally
                        role = userSnap.data().role;
                        roles = userSnap.data().roles || [role]; 
                        const ALL_PERMISSIONS_MINIMAL = ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});
                        const rawPerms = { ...ALL_PERMISSIONS_MINIMAL, ...(userSnap.data().permissions || {}) };
                        permissionsData = applyDerivedPermissions(rawPerms);
                        
                        // 2. Update Local Storage Backup (Secondary Fail-safe)
                        localStorage.setItem(`backup_role_${user.uid}`, role);
                        localStorage.setItem(`backup_roles_${user.uid}`, JSON.stringify(roles));
                        localStorage.setItem(`backup_perms_${user.uid}`, JSON.stringify(permissionsData));
                    }
                    
                    setUserRole(role); 
                    setUserRoles(roles); 
                    setUserPermissions(permissionsData); 
                } else { 
                    setUserRole(null); setUserRoles([]); setUserPermissions({}); 
                }
            } catch (error) {
                console.error("Error checking user role:", error);
                // Emergency fallback
                setUserRole('user'); setUserRoles(['user']); setUserPermissions(applyDerivedPermissions(DEFAULT_ROLE_PERMISSIONS.user));
            } finally { 
                setPermissionsLoading(false); 
            }
        };
        
        checkUserRoleAndPermissions();
    }, [user]);

    useEffect(() => { if (!user) initialViewIsSet.current = false; }, [user]);

    useEffect(() => {
        const handlePopState = (event) => {
            isPopStateNavigation.current = true;
            if (window.location.pathname === '/') navigate('landing');
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const fetchCoordinators = useCallback(async (force = false) => { await fetchFederalCoordinators(force); await fetchStateCoordinators(force); await fetchLocalityCoordinators(force); }, [fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators]);

    useEffect(() => {
        if (isSharedView || isPublicMentorshipDashboardView || (!user && !isPublicMentorshipDashboardView)) return;
        if (view === 'dashboard') { fetchCourses(); fetchParticipants(); fetchFacilitators(); fetchHealthFacilities(); }
        if (['humanResources', 'facilitatorForm', 'facilitatorReport', 'courseForm', 'dashboard', 'landing'].includes(view)) fetchFacilitators();
        if (['courseForm', 'humanResources'].includes(view)) fetchFunders();
        if (['courseForm'].includes(view)) fetchCoordinators();
        if (view === 'courses' || view === 'facilitatorReport') fetchCourses();
        if (view === 'skillsMentorship') { fetchHealthFacilities(); fetchSkillMentorshipSubmissions(); }
        if (view === 'childHealthServices') fetchHealthFacilities();
        if (view === 'courseReport') fetchHealthFacilities();
    }, [view, isSharedView, user, fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchCoordinators, fetchHealthFacilities, fetchSkillMentorshipSubmissions, isPublicMentorshipDashboardView]);

    useEffect(() => {
        if (selectedCourseId && !courseDetailsCache[selectedCourseId]?.allObs && !courseDetailsLoading) {
            const fetchFullCourseDetails = async () => {
                setCourseDetailsLoading(true);
                try {
                    const [participantsData, allCourseData, finalReport, testData] = await Promise.all([
                        listAllParticipantsForCourse(selectedCourseId, { source: 'cache' }).catch(()=>null),
                        listAllDataForCourse(selectedCourseId, { source: 'cache' }).catch(()=>null),
                        getFinalReportByCourseId(selectedCourseId, { source: 'cache' }).catch(()=>null),
                        listParticipantTestsForCourse(selectedCourseId, { source: 'cache' }).catch(()=>null)
                    ]);

                    const processAndSet = (pData, cData, fData, tData) => {
                        const activeParticipants = (pData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
                        const activeTests = (tData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
                        const activeObs = (cData?.allObs || []).filter(o => o.isDeleted !== true && o.isDeleted !== "true");
                        const activeCases = (cData?.allCases || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true");
                        const activeFinalReport = (fData && fData.isDeleted !== true && fData.isDeleted !== "true") ? fData : null;
                        
                        setCourseDetailsCache(prev => ({
                            ...prev,
                            [selectedCourseId]: { participants: activeParticipants, allObs: activeObs, allCases: activeCases, finalReport: activeFinalReport, participantTests: activeTests }
                        }));
                    };

                    const isCacheMiss = participantsData === null || allCourseData === null || testData === null;

                    if (!isCacheMiss) {
                        processAndSet(participantsData, allCourseData, finalReport, testData);
                    } else {
                        const [serverParticipants, serverAllCourse, serverFinalReport, serverTestData] = await Promise.all([
                            listAllParticipantsForCourse(selectedCourseId, { source: 'server' }).catch(()=>[]),
                            listAllDataForCourse(selectedCourseId, { source: 'server' }).catch(()=>({allObs:[], allCases:[]})),
                            getFinalReportByCourseId(selectedCourseId, { source: 'server' }).catch(()=>null),
                            listParticipantTestsForCourse(selectedCourseId, { source: 'server' }).catch(()=>[])
                        ]);
                        processAndSet(serverParticipants, serverAllCourse, serverFinalReport, serverTestData);
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

    const canSeeAllData = useMemo(() => permissions.canUseSuperUserAdvancedFeatures || permissions.canUseFederalManagerAdvancedFeatures, [permissions]);

    const filteredCourses = useMemo(() => {
        if (!allCourses) return [];
        const locPerm = permissions.manageLocation;

        // Strict Location Permission Enforcement
        if (locPerm === 'user_state' || locPerm === 'user_locality') {
            let filtered = allCourses;

            // Restrict by State
            if (userStates && userStates.length > 0) {
                const userStateSet = new Set(userStates);
                filtered = filtered.filter(c => userStateSet.has(c.state));
            } else {
                return []; // Block access if they should be restricted but have no state assigned
            }

            // Further restrict by Locality
            if (locPerm === 'user_locality') {
                if (userLocalities && userLocalities.length > 0) {
                    filtered = filtered.filter(c => userLocalities.includes(c.locality));
                } else {
                    return []; // Block access if they should be restricted but have no locality assigned
                }
            }
            return filtered;
        }

        // Default: federal, empty, none -> sees everything
        return allCourses;
    }, [allCourses, userStates, userLocalities, permissions.manageLocation]);

    const filteredFacilitators = useMemo(() => {
        if (!allFacilitators) return [];
        const locPerm = permissions.manageLocation;

        if (locPerm === 'user_state' || locPerm === 'user_locality') {
            let filtered = allFacilitators;

            if (userStates && userStates.length > 0) {
                const userStateSet = new Set(userStates);
                filtered = filtered.filter(f => userStateSet.has(f.currentState));
            } else {
                return [];
            }

            if (locPerm === 'user_locality') {
                if (userLocalities && userLocalities.length > 0) {
                    filtered = filtered.filter(f => userLocalities.includes(f.currentLocality));
                } else {
                    return [];
                }
            }
            return filtered;
        }

        return allFacilitators;
    }, [allFacilitators, userStates, userLocalities, permissions.manageLocation]);


    const fetchPendingSubmissions = useCallback(async () => {
        if (!permissions.canApproveSubmissions) return;
        setIsSubmissionsLoading(true);
        try { const submissions = await listPendingFacilitatorSubmissions(); setPendingSubmissions(submissions); } 
        catch (error) { setToast({ show: true, message: 'Failed to load submissions.', type: 'error' }); } 
        finally { setIsSubmissionsLoading(false); }
    }, [permissions.canApproveSubmissions]);

    useEffect(() => { if (view === 'humanResources' && activeHRTab === 'facilitators' && permissions.canApproveSubmissions) fetchPendingSubmissions(); }, [view, activeHRTab, permissions.canApproveSubmissions, fetchPendingSubmissions]);

    const selectedCourse = useMemo(() => (allCourses || []).find(c => c.id === selectedCourseId) || null, [allCourses, selectedCourseId]);

    const isCourseActive = useMemo(() => {
        if (!selectedCourse?.start_date || !selectedCourse?.course_duration || selectedCourse.course_duration <= 0) return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const startDate = new Date(selectedCourse.start_date); startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate); endDate.setDate(startDate.getDate() + selectedCourse.course_duration);
        return today >= startDate && today < endDate;
    }, [selectedCourse]);

    const selectedFacilitator = useMemo(() => (allFacilitators || []).find(f => f.id === selectedFacilitatorId) || null, [allFacilitators, selectedFacilitatorId]);

    const navigate = useCallback((newView, state = {}) => {
        const viewPermissions = {
            'landing': true, 'dashboard': true, 'admin': permissions.canViewAdmin, 'imciForm': permissions.canViewCourse, 'humanResources': permissions.canViewHumanResource,
            'courses': permissions.canViewCourse, 'courseDetails': permissions.canViewCourse, 'participants': permissions.canViewCourse, 'reports': permissions.canViewCourse,
           'observe': (permissions.canManageCourse && isCourseActive) || permissions.canUseFederalManagerAdvancedFeatures || permissions.manageTimePeriod === 'anytime',
           'monitoring': (permissions.canManageCourse && isCourseActive) || permissions.canUseFederalManagerAdvancedFeatures || permissions.manageTimePeriod === 'anytime',
            'courseForm': permissions.canManageCourse || permissions.canAddCourse, 'participantForm': permissions.canManageCourse, 'facilitatorForm': permissions.canManageHumanResource,
            'courseReport': permissions.canViewCourse, 'participantReport': permissions.canViewCourse, 'facilitatorReport': permissions.canViewHumanResource,
            'finalReport': permissions.canViewCourse, 'participantMigration': permissions.canUseSuperUserAdvancedFeatures, 'childHealthServices': permissions.canViewFacilities,
            'skillsMentorship': permissions.canViewSkillsMentorship, 'facilitators': permissions.canViewHumanResource, 'programTeams': permissions.canViewHumanResource,
            'partnersPage': permissions.canViewHumanResource, 'attendanceManager': permissions.canManageCourse, 
            'projects': permissions.canUseFederalManagerAdvancedFeatures, 'planning': permissions.canUseFederalManagerAdvancedFeatures, 'localityPlan': permissions.canViewLocalityPlan,
            'downloads': Capacitor.isNativePlatform(), 'about': true, 
        };

        if (user && !viewPermissions[newView]) {
            console.warn(`Access denied to view: ${newView}. Redirecting to landing.`);
            setView('landing'); return;
        }

        setPreviousView(view); setEditingCourse(null); setEditingFacilitator(null); setEditingCaseFromReport(null);

        if (state.courseId && state.courseId !== selectedCourseId) setSelectedCourseId(state.courseId);
        if (state.participantId && state.participantId !== selectedParticipantId) setSelectedParticipantId(state.participantId);
        if (state.activeCourseType) setActiveCourseType(state.activeCourseType);

        const courseSubTabs = ['participants', 'reports', 'courseDetails', 'test-dashboard', 'enter-test-scores']; 
        const hrSubTabs = ['facilitators', 'programTeams', 'partnersPage'];

        if (hrSubTabs.includes(newView)) { setActiveHRTab(newView); setView('humanResources'); }
        else if (['courses', ...courseSubTabs].includes(newView)) { setActiveCoursesTab(newView); setView('courses'); }
        else { setActiveCoursesTab(null); setView(newView); }

        if (state.editCourse) setEditingCourse(state.editCourse);
        if (state.editFacilitator) setEditingFacilitator(state.editFacilitator);
        if (state.openFacilitatorReport) setSelectedFacilitatorId(state.openFacilitatorReport);
        if (state.openCourseReport) setSelectedCourseId(state.openCourseReport);
        if (state.openParticipantReport) { setSelectedParticipantId(state.openParticipantReport); setSelectedCourseId(state.openCourseReport); }
        if (state.caseToEdit) setEditingCaseFromReport(state.caseToEdit);

        if (['courses', 'humanResources', 'dashboard', 'admin', 'landing', 'skillsMentorship', 'projects', 'planning', 'localityPlan', 'downloads', 'about'].includes(newView)) {
            setSelectedCourseId(null); setSelectedParticipantId(null); setFinalReportCourse(null);
            if (['dashboard', 'admin', 'landing', 'skillsMentorship', 'projects', 'planning', 'localityPlan', 'downloads', 'about'].includes(newView)) setActiveCourseType(null);
        }
        if ((view === 'observe' || view === 'participantReport') && !['observe', 'participantReport'].includes(newView)) setSelectedParticipantId(null);
    }, [view, selectedCourseId, selectedParticipantId, permissions, user, isCourseActive]);

    const handleOpenCourse = useCallback((courseId) => { setSelectedCourseId(courseId); setLoading(false); navigate('participants', { courseId }); }, [navigate]);

    const handleOpenCourseReport = useCallback(async (courseId) => {
        setSelectedCourseId(courseId);
        if (courseDetailsCache[courseId]?.allObs && courseDetailsCache[courseId]?.participants && courseDetailsCache[courseId]?.participantTests) { navigate('courseReport', { courseId }); return; }
        if (courseDetailsLoading) { setToast({ show: true, message: 'Report data is still loading, please wait...', type: 'info' }); return; }
        setLoading(true); setCourseDetailsLoading(true); 
        try {
            const [participantsData, allCourseData, finalReport, testData] = await Promise.all([
                listAllParticipantsForCourse(courseId, { source: 'cache' }).catch(()=>null), 
                listAllDataForCourse(courseId, { source: 'cache' }).catch(()=>null), 
                getFinalReportByCourseId(courseId, { source: 'cache' }).catch(()=>null), 
                listParticipantTestsForCourse(courseId, { source: 'cache' }).catch(()=>null) 
            ]);
            
            let finalParticipants = participantsData;
            let finalAllCourse = allCourseData || {allObs:[], allCases:[]};
            let finalFinalReport = finalReport;
            let finalTestData = testData;
            
            const isCacheMiss = participantsData === null || allCourseData === null || testData === null;

            if (isCacheMiss) {
                 const [serverParticipants, serverAllCourse, serverFinalReport, serverTestData] = await Promise.all([
                    listAllParticipantsForCourse(courseId, { source: 'server' }).catch(()=>[]), 
                    listAllDataForCourse(courseId, { source: 'server' }).catch(()=>({allObs:[], allCases:[]})), 
                    getFinalReportByCourseId(courseId, { source: 'server' }).catch(()=>null), 
                    listParticipantTestsForCourse(courseId, { source: 'server' }).catch(()=>[]) 
                ]);
                finalParticipants = serverParticipants;
                finalAllCourse = serverAllCourse;
                finalFinalReport = serverFinalReport;
                finalTestData = serverTestData;
            }

            const activeParticipants = (finalParticipants || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeTests = (finalTestData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
            const activeObs = (finalAllCourse.allObs || []).filter(o => o.isDeleted !== true && o.isDeleted !== "true");
            const activeCases = (finalAllCourse.allCases || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true");
            const activeFinalReport = (finalFinalReport && finalFinalReport.isDeleted !== true && finalFinalReport.isDeleted !== "true") ? finalFinalReport : null;
            
            setCourseDetailsCache(prev => ({ ...prev, [courseId]: { participants: activeParticipants, allObs: activeObs, allCases: activeCases, finalReport: activeFinalReport, participantTests: activeTests } }));
            navigate('courseReport', { courseId });
        } catch (error) { 
            console.error("Error loading course report data:", error); 
            setToast({ show: true, message: 'Failed to load course report data. Please try again.', type: 'error' }); 
        } finally { 
            setLoading(false); setCourseDetailsLoading(false); 
        }
    }, [navigate, courseDetailsCache, courseDetailsLoading]);

    const handleOpenCourseForTestForm = useCallback(async (courseId) => {
        setLoading(true); setSelectedCourseId(courseId); setSelectedParticipantId(null); 
        try {
            let participantsData = await listAllParticipantsForCourse(courseId, { source: 'cache' }).catch(()=>null);
            let testData = await listParticipantTestsForCourse(courseId, { source: 'cache' }).catch(()=>null);

            if (participantsData === null || testData === null) {
                 [participantsData, testData] = await Promise.all([ 
                     listAllParticipantsForCourse(courseId, { source: 'server' }), 
                     listParticipantTestsForCourse(courseId, { source: 'server' }) 
                 ]);
            }

            const activeParticipants = (participantsData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeTests = (testData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
            setCourseDetailsCache(prev => ({ ...prev, [courseId]: { ...(prev[courseId] || {}), participants: activeParticipants, participantTests: activeTests } }));
            setActiveCoursesTab('test-dashboard'); setView('courses');
        } catch (error) { 
            console.error("Error loading data for test form:", error); 
            setToast({ show: true, message: 'Failed to load test form data.', type: 'error' }); 
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
                await fetchPendingSubmissions(); await fetchFacilitators();
            } catch (error) { setToast({ show: true, message: `Approval failed: ${error.message}`, type: 'error' }); }
        }
    }, [user, fetchPendingSubmissions, fetchFacilitators]);

    const handleRejectSubmission = useCallback(async (submissionId) => {
        if (window.confirm('Reject this submission?')) {
            try { await rejectFacilitatorSubmission(submissionId, user.email); setToast({ show: true, message: 'Submission rejected.', type: 'success' }); await fetchPendingSubmissions(); } 
            catch (error) { setToast({ show: true, message: `Rejection failed: ${error.message}`, type: 'error' }); }
        }
    }, [user, fetchPendingSubmissions]);

    const handleShare = useCallback((item, type) => { setItemToShare(item); setShareType(type); setIsShareModalOpen(true); }, []);

    const handleSaveSharingSettings = useCallback(async (itemId, settings) => {
        try {
            if (shareType === 'course') await updateCourseSharingSettings(itemId, settings); else if (shareType === 'participant') await updateParticipantSharingSettings(itemId, settings);
            await fetchCourses(); setToast({ show: true, message: "Sharing settings updated.", type: "success" });
        } catch (error) { setToast({ show: true, message: "Failed to update sharing settings.", type: "error" }); }
    }, [shareType, fetchCourses]);

    const handleDeleteFacilitator = useCallback(async (facilitatorId) => {
        if (!permissions.canManageHumanResource) return;
        if (window.confirm('Are you sure you want to delete this facilitator?')) {
            setLoading(true);
            try {
                await deleteFacilitator(facilitatorId); await fetchFacilitators(); 
                if (selectedFacilitatorId === facilitatorId) { setSelectedFacilitatorId(null); navigate('humanResources'); }
                setToast({ show: true, message: 'Facilitator deleted successfully.', type: 'success' });
            } catch (error) { console.error("Error deleting facilitator:", error); setToast({ show: true, message: `Failed to delete facilitator: ${error.message}`, type: 'error' }); } 
            finally { setLoading(false); }
        }
    }, [permissions.canManageHumanResource, selectedFacilitatorId, navigate, fetchFacilitators]);

    const handleAddFinalReport = useCallback(async (courseId) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;
        const courseToReport = (allCourses || []).find(c => c.id === courseId);
        if (!courseToReport) return;
        setFinalReportCourse(courseToReport); setSelectedCourseId(courseId); setLoading(true);
        try {
            let participantsData = await listAllParticipantsForCourse(courseId, { source: 'cache' }).catch(()=>null);
            let existingReport = await getFinalReportByCourseId(courseId, { source: 'cache' }).catch(()=>null);

            if (participantsData === null) {
                [participantsData, existingReport] = await Promise.all([ 
                    listAllParticipantsForCourse(courseId, { source: 'server' }), 
                    getFinalReportByCourseId(courseId, { source: 'server' }) 
                ]);
            }

            const activeParticipants = (participantsData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeFinalReport = (existingReport && existingReport.isDeleted !== true && existingReport.isDeleted !== "true") ? existingReport : null;
            setCourseDetailsCache(prev => ({ ...prev, [courseId]: { ...prev[courseId], participants: activeParticipants, finalReport: activeFinalReport } }));
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
            if (reportData.pdfFile) { if (pdfUrl) await deleteFile(pdfUrl); pdfUrl = await uploadFile(reportData.pdfFile); }
            const finalUrlsToSave = []; const originalUrls = reportData.originalGalleryUrls || []; const finalUrlsFromEditor = reportData.finalGalleryUrls || []; const filesToUpload = reportData.galleryImageFiles || {};
            for (let i = 0; i < 3; i++) {
                const originalUrl = originalUrls[i]; const finalUrl = finalUrlsFromEditor[i]; const newFile = filesToUpload[i];
                if (newFile) { if (originalUrl) await deleteFile(originalUrl); const uploadedUrl = await uploadFile(newFile); finalUrlsToSave.push(finalUrl); }
                else if (finalUrl) { finalUrlsToSave.push(finalUrl); } else if (originalUrl && !finalUrl) { await deleteFile(originalUrl); }
            }
            const payload = { id: reportData.id, courseId: reportData.courseId, summary: reportData.summary, recommendations: reportData.recommendations, potentialFacilitators: reportData.participantsForFollowUp, pdfUrl: pdfUrl, galleryImageUrls: finalUrlsToSave, participantsForFollowUp: reportData.participantsForFollowUp };
            await upsertFinalReport(payload);
            const savedReport = await getFinalReportByCourseId(reportData.courseId, { source: 'server' });
            setCourseDetailsCache(prev => ({ ...prev, [reportData.courseId]: { ...prev[reportData.courseId], finalReport: savedReport } }));
            setToast({ show: true, message: 'Final report saved successfully.', type: 'success' });
        } catch (error) { console.error("Error saving final report:", error); setToast({ show: true, message: `Error saving final report: ${error.message}`, type: 'error' }); } 
        finally { setLoading(false); }
    }, [permissions]);

    const handleEditFinalReport = useCallback(async (courseId) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;
        const courseToEditReport = (allCourses || []).find(c => c.id === courseId);
        if (!courseToEditReport) { setToast({ show: true, message: 'Course not found.', type: 'error' }); return; }
        setFinalReportCourse(courseToEditReport); setSelectedCourseId(courseId); setLoading(true);
        try {
            let participantsData = await listAllParticipantsForCourse(courseId, { source: 'cache' }).catch(()=>null);
            let existingReport = await getFinalReportByCourseId(courseId, { source: 'cache' }).catch(()=>null);

            if (participantsData === null) {
                [participantsData, existingReport] = await Promise.all([ 
                    listAllParticipantsForCourse(courseId, { source: 'server' }), 
                    getFinalReportByCourseId(courseId, { source: 'server' }) 
                ]);
            }

            const activeParticipants = (participantsData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeFinalReport = (existingReport && existingReport.isDeleted !== true && existingReport.isDeleted !== "true") ? existingReport : null;
            setCourseDetailsCache(prev => ({ ...prev, [courseId]: { ...prev[courseId], participants: activeParticipants, finalReport: activeFinalReport } }));
            navigate('finalReport');
        } catch (error) { 
            console.error("Error fetching final report for editing:", error); 
            setToast({ show: true, message: 'Failed to load the final report.', type: 'error' }); 
        } finally { 
            setLoading(false); 
        }
    }, [permissions, allCourses, navigate]);

    const handleDeletePdf = useCallback(async (courseId) => {  }, [permissions, courseDetails.finalReport]);

    // Handle standard logout prompt
    const handleLogout = useCallback(async () => { 
        if (window.confirm('Are you sure you want to log out?')) {
            try { 
                await signOut(auth); 
            } catch (error) { 
                console.error("Error signing out:", error); 
            } 
        }
    }, []);

    const handleLoginForSharedView = useCallback(async () => {  }, []);

    const handleResetMonitor = useCallback(() => { setOperationCounts({ reads: 0, writes: 0 }); }, []);
    const handleDismissMonitor = useCallback(() => { setIsMonitorVisible(false); }, []);

    const renderView = () => {
        const currentParticipant = (courseDetails.participants || []).find(p => p.id === selectedParticipantId);
        const viewToRender = view;

        switch (viewToRender) {
            case 'landing': return <Landing navigate={navigate} permissions={permissions} />;
            case 'admin': return <AdminDashboard />;
            case 'about': return <AboutDeveloperPage permissions={permissions} />;
            case 'imciForm': 
                return permissions.canViewCourse ? ( <Suspense fallback={<Card><div className="flex justify-center p-8"><Spinner /></div></Card>}><IMNCIRecordingForm /></Suspense> ) : null;

            case 'humanResources': return <HumanResourcesPage
                activeTab={activeHRTab} setActiveTab={setActiveHRTab}
                onAddFacilitator={() => navigate('facilitatorForm')}
                onEditFacilitator={(f) => navigate('facilitatorForm', { editFacilitator: f })}
                onDeleteFacilitator={handleDeleteFacilitator}
                onOpenFacilitatorReport={(fid) => navigate('facilitatorReport', { openFacilitatorReport: fid })}
                userStates={userStates} userLocalities={userLocalities} onApproveSubmission={handleApproveSubmission} onRejectSubmission={handleRejectSubmission} permissions={permissions}
            />;

            case 'courses': return <CourseManagementView
                allCourses={filteredCourses} activeCourseType={activeCourseType} setActiveCourseType={setActiveCourseType}
                onOpen={handleOpenCourse} 
                onOpenReport={handleOpenCourseReport} onOpenTestForm={handleOpenCourseForTestForm} 
                onOpenAttendanceManager={(courseId) => { setSelectedCourseId(courseId); navigate('attendanceManager', { courseId }); }}
                userStates={userStates} userLocalities={userLocalities} activeCoursesTab={activeCoursesTab} setActiveCoursesTab={setActiveCoursesTab}
                selectedCourse={selectedCourse} participants={courseDetails.participants || []} participantTests={courseDetails.participantTests || []} 
                onOpenParticipantReport={(pid) => { setSelectedCourseId(selectedCourse.id); setSelectedParticipantId(pid); navigate('participantReport'); }}
                onAddFinalReport={handleAddFinalReport} onEditFinalReport={handleEditFinalReport}
                selectedParticipantId={selectedParticipantId} onSetSelectedParticipantId={setSelectedParticipantId}
                onBatchUpdate={() => { setCourseDetailsCache(prev => { const newCache = { ...prev }; delete newCache[selectedCourse.id]; return newCache; }); setSelectedCourseId(null); setSelectedCourseId(selectedCourse.id); }}
                loadingDetails={loading || (selectedCourseId && courseDetailsLoading)} 
                canManageCourse={permissions.canManageCourse} 
                canAddCourse={permissions.canAddCourse} /* PASSED PERMISSION DOWN HERE */
                canUseSuperUserAdvancedFeatures={permissions.canUseSuperUserAdvancedFeatures}
                canUseFederalManagerAdvancedFeatures={permissions.canUseFederalManagerAdvancedFeatures} canEditDeleteActiveCourse={permissions.canManageCourse} 
                canEditDeleteInactiveCourse={permissions.canUseFederalManagerAdvancedFeatures || (permissions.canManageCourse && permissions.manageTimePeriod === 'anytime')}
                manageLocation={permissions.manageLocation} /* PASSED STRICT LOCATION ENFORCEMENT DOWN HERE */
                facilitatorsList={allFacilitators || []} 
                currentUserRole={userRole} /* PASSED CURRENT ROLE FOR CREATOR RECORD */
            />;

            case 'childHealthServices':
                return permissions.canViewFacilities ? (
                    <ChildHealthServicesView
                        permissions={permissions} setToast={setToast} userStates={userStates} userLocalities={userLocalities}
                        canManageFacilities={permissions.canManageFacilities} canBulkUploadFacilities={permissions.canUseSuperUserAdvancedFeatures}
                        canCleanFacilityData={permissions.canUseSuperUserAdvancedFeatures} canFindFacilityDuplicates={permissions.canUseSuperUserAdvancedFeatures}
                        canCheckFacilityLocations={permissions.canUseSuperUserAdvancedFeatures}
                    />
                ) : null;

            case 'skillsMentorship':
                return permissions.canViewSkillsMentorship ? (
                    <SkillsMentorshipView setToast={setToast} permissions={permissions} userStates={userStates} userLocalities={userLocalities} canBulkUploadMentorships={permissions.canUseSuperUserAdvancedFeatures} />
                ) : null;

            case 'projects':
                return permissions.canUseFederalManagerAdvancedFeatures ? ( <Suspense fallback={<Spinner />}><ProjectTrackerView permissions={permissions} /></Suspense> ) : null;

            case 'planning':
                return permissions.canUseFederalManagerAdvancedFeatures ? ( <Suspense fallback={<Spinner />}><PlanningView permissions={permissions} userStates={userStates} /></Suspense> ) : null;

            case 'localityPlan':
                return permissions.canViewLocalityPlan ? ( <Suspense fallback={<Spinner />}><LocalityPlanView permissions={permissions} userStates={userStates} userLocalities={userLocalities} /></Suspense> ) : null;

            case 'downloads':
                return ( <Suspense fallback={<Card><Spinner /></Card>}><DownloadedFilesView onBack={() => navigate(previousView)} setToast={setToast} /></Suspense> );

            case 'monitoring': case 'observe':
                const canMonitor = (permissions.canManageCourse && isCourseActive) || permissions.canUseFederalManagerAdvancedFeatures || permissions.manageTimePeriod === 'anytime';
                return canMonitor ? (selectedCourse && currentParticipant && <ObservationView course={selectedCourse} participant={currentParticipant} participants={courseDetails.participants} onChangeParticipant={(id) => setSelectedParticipantId(id)} initialCaseToEdit={editingCaseFromReport} />) : null;

            case 'participantReport': return permissions.canViewCourse ? (
                selectedCourse && currentParticipant && 
                <ParticipantReportView 
                    course={selectedCourse} participant={currentParticipant} participants={courseDetails.participants} 
                    observations={courseDetails.allObs?.filter(o => o.participant_id === currentParticipant.id) || []} cases={courseDetails.allCases?.filter(c => c.participant_id === currentParticipant.id) || []}
                    onChangeParticipant={(pid) => setSelectedParticipantId(pid)} onBack={() => navigate(previousView)} 
                    onNavigateToCase={(caseToEdit) => navigate('observe', { caseToEdit, courseId: caseToEdit.courseId, participantId: caseToEdit.participant_id })} 
                    onShare={(participant) => handleShare(participant, 'participant')} 
                />
            ) : null;

            case 'courseReport': return permissions.canViewCourse ? (selectedCourse && <CourseReportView course={selectedCourse} participants={courseDetails.participants} allObs={courseDetails.allObs} allCases={courseDetails.allCases} finalReportData={courseDetails.finalReport} onBack={() => navigate(previousView)} onEditFinalReport={handleEditFinalReport} onDeletePdf={handleDeletePdf} onViewParticipantReport={(pid) => { setSelectedParticipantId(pid); navigate('participantReport'); }} onShare={(course) => handleShare(course, 'course')} setToast={setToast} allHealthFacilities={healthFacilities} />) : null;

            case 'facilitatorForm':
                return permissions.canManageHumanResource ? (<FacilitatorForm 
                    initialData={editingFacilitator} onCancel={() => navigate(previousView)} 
                    onSave={async () => { await fetchFacilitators(); setToast({ show: true, message: 'Facilitator saved.', type: 'success' }); navigate('humanResources'); }}
                    setToast={setToast} setLoading={setLoading}
                />) : null;

            case 'facilitatorReport': return permissions.canViewHumanResource ? (selectedFacilitator && <FacilitatorReportView facilitator={selectedFacilitator} allCourses={allCourses || []} onBack={() => navigate(previousView)} />) : null;

            case 'dashboard': return <DashboardView onOpenCourseReport={handleOpenCourseReport} onOpenParticipantReport={(pId, cId) => navigate('participantReport', { openParticipantReport: pId, openCourseReport: cId })} onOpenFacilitatorReport={(id) => { setSelectedFacilitatorId(id); navigate('facilitatorReport'); }} permissions={permissions} userStates={userStates} userLocalities={userLocalities} STATE_LOCALITIES={STATE_LOCALITIES} />;

            case 'finalReport':
                return (
                    <FinalReportManager
                        course={finalReportCourse || selectedCourse} participants={courseDetails.participants} initialData={courseDetails.finalReport}
                        onSave={handleSaveFinalReport} onCancel={() => navigate(previousView)} canUseFederalManagerAdvancedFeatures={permissions.canUseFederalManagerAdvancedFeatures}
                    />
                );
            case 'attendanceManager':
                return permissions.canManageCourse ? ( selectedCourse && ( <Suspense fallback={<Card><Spinner /></Card>}><AttendanceManagerView course={selectedCourse} onClose={() => navigate('courses')} /></Suspense> ) ) : null;

            default: return <Landing navigate={navigate} permissions={permissions} />;
        }
    };

    const navItems = useMemo(() => [
        { label: t('landing.modules.home', 'Home'), view: 'landing', active: view === 'landing', disabled: false },
        { label: t('landing.modules.dashboard', 'Dashboard'), view: 'dashboard', active: view === 'dashboard', disabled: false },
        { label: t('landing.modules.courses', 'Courses'), view: 'courses', active: ['courses', 'courseForm', 'courseReport', 'participants', 'participantForm', 'participantReport', 'observe', 'monitoring', 'reports', 'finalReport', 'participantMigration', 'courseDetails', 'test-dashboard', 'enter-test-scores', 'attendanceManager', 'imciForm'].includes(view), disabled: !permissions.canViewCourse }, 
        { label: t('landing.modules.human_resources', 'Human Resources'), view: 'humanResources', active: ['humanResources', 'facilitatorForm', 'facilitatorReport'].includes(view), disabled: !permissions.canViewHumanResource },
        { label: t('landing.modules.facilities', 'Child Health Services'), view: 'childHealthServices', active: view === 'childHealthServices', disabled: !permissions.canViewFacilities },
        { label: t('landing.modules.mentorship', 'Skills Mentorship'), view: 'skillsMentorship', active: view === 'skillsMentorship', disabled: !permissions.canViewSkillsMentorship }
        // Locality plan, planning, projects, and admin specifically omitted from top/bottom navigation as requested
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
                <LocalityBulkUpdateView stateParam={publicBulkUpdateParams.state} localityParam={publicBulkUpdateParams.locality} filters={publicBulkUpdateParams} setToast={setToast} />
            </Suspense>
        );
    }
    else if (isPublicRegistrationView) {
        if (publicRegistrationCourseId) {
            mainContent = (
                <Suspense fallback={<Card><Spinner /></Card>}>
                    <PublicParticipantRegistrationView courseId={publicRegistrationCourseId} />
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
                        targetDate={publicMeetingTargetDate}
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
                    mainContent = ( <CourseReportView course={publicViewData.course} participants={publicViewData.participants} allObs={publicViewData.allObs} allCases={publicViewData.allCases} finalReportData={publicViewData.finalReport} allHealthFacilities={null} isSharedView={true} onBack={() => {}} onShare={() => {}} /> );
                    break;
                case 'facilitatorReport':
                    mainContent = ( <FacilitatorReportView facilitator={publicViewData.facilitator} allCourses={publicViewData.allCourses} isSharedView={true} onBack={() => {}} /> );
                    break;
                case 'teamMemberProfile':
                    mainContent = ( <PublicTeamMemberProfileView member={publicViewData.member} level={publicViewData.level} /> );
                    break;
                case 'certificateVerification':
                    mainContent = ( <Suspense fallback={<Card><Spinner /></Card>}><CertificateVerificationView participant={publicViewData.participant} course={publicViewData.course} /></Suspense> );
                    break;
                case 'certificateDownload':
                    mainContent = ( <Suspense fallback={<Card><Spinner /></Card>}><PublicCertificateDownloadView participantId={publicViewData.participantId} /></Suspense> );
                    break;
                case 'courseCertificatesPage':
                    mainContent = ( <Suspense fallback={<Card><Spinner /></Card>}><PublicCourseCertificatesView courseId={publicViewData.courseId} /></Suspense> );
                    break;
                case 'attendance':
                    mainContent = ( <Suspense fallback={<Card><Spinner /></Card>}><PublicAttendanceView courseId={publicViewData.courseId} /></Suspense> );
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
            mainContent = ( <PublicCourseMonitoringView course={publicMonitorData.course} allParticipants={publicMonitorData.participants} /> );
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
                    setToast={setToast} permissions={permissions} userStates={userStates} userLocalities={userLocalities} 
                    publicSubmissionMode={true} publicServiceType={publicMentorshipProps.serviceType} canBulkUploadMentorships={permissions.canUseSuperUserAdvancedFeatures}
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
                        course={publicTestData.course} participants={publicTestData.participants} participantTests={publicTestData.tests}
                        onSaveTest={upsertParticipantTest} 
                        onSaveParticipant={async (participantData, facilityUpdateData) => {
                            const currentUserIdentifier = user?.displayName || user?.email || 'Public User';
                            const savedParticipant = await saveParticipantAndSubmitFacilityUpdate(participantData, facilityUpdateData, currentUserIdentifier);
                            if (facilityUpdateData) setToast({ show: true, message: 'Facility update submitted for approval.', type: 'info' });
                            return savedParticipant;
                        }} 
                        onCancel={() => {}} 
                        onSave={(savedTest) => { 
                            setToast({ show: true, message: 'Test saved successfully!', type: 'success' });
                            const refetchData = async () => {
                                setPublicTestLoading(true);
                                try {
                                    const [testData, participantData] = await Promise.all([ listParticipantTestsForCourse(publicTestData.course.id, 'server'), listAllParticipantsForCourse(publicTestData.course.id, 'server') ]);
                                    const activeParticipants = (participantData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
                                    const activeTests = (testData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
                                    setPublicTestData(prev => ({ ...prev, tests: activeTests, participants: activeParticipants }));
                                } catch (err) { setToast({ show: true, message: 'Failed to refresh test data.', type: 'error' }); } finally { setPublicTestLoading(false); }
                            };
                            refetchData();
                        }}
                        initialParticipantId={''} isPublicView={true} canManageTests={permissions.canUseFederalManagerAdvancedFeatures} testType={publicTestType}
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
            <div className="fixed top-0 start-0 w-full z-[100005] flex flex-col">
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
                {isDownloadingUpdate && (
                    <div className="bg-sky-700 text-white text-center py-2 px-4 text-sm font-bold flex justify-center items-center gap-2 shadow-md relative overflow-hidden">
                        {/* Dynamic Progress Bar Background */}
                        <div 
                            className="absolute top-0 left-0 h-full bg-sky-500 z-0 transition-all duration-300" 
                            style={{ width: `${updateProgress}%` }}
                        ></div>
                        <RefreshCw className="w-4 h-4 animate-spin z-10" /> 
                        <span className="z-10">{t('app.downloading_update', 'Downloading update...')} {Math.round(updateProgress)}%</span>
                    </div>
                )}
            </div>

            <header className={`bg-slate-800 shadow-lg sticky z-40 transition-all ${isOffline || isSyncing || isDownloadingUpdate ? 'top-10' : 'top-0'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => !isSharedView && navigate('landing')}>
                            <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md">
                                <img src="/child.png" alt="NCHP Logo" className="h-12 w-12 object-contain" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-white">{t('app.title', 'National Child Health Program')}</h1>
                                <p className="text-xs sm:text-sm text-slate-300 flex items-center flex-wrap gap-2 mt-1 sm:mt-0">
                                    <span>{t('app.subtitle', 'Program & Course Monitoring System')}</span>
                                    {/* App Version Pill (Clickable) */}
                                    <span 
                                        onClick={handleManualUpdateCheck}
                                        className="bg-slate-700 text-sky-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-600 font-mono shadow-sm cursor-pointer hover:bg-slate-600 hover:text-sky-200 transition-colors"
                                        title="Tap to check for updates"
                                    >
                                        v{appVersion}
                                    </span>
                                </p>
                            </div>
                        </div>
                        
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
                            {/* We keep a fallback language toggle here ONLY for public/logged-out views where the secondary banner isn't visible */}
                            {(!user || isMinimalUILayout) && (
                                <button
                                    onClick={() => {
                                        const newLang = i18n.language?.startsWith('en') ? 'ar' : 'en';
                                        i18n.changeLanguage(newLang);
                                    }}
                                    className="p-1.5 text-sky-400 bg-slate-700 border border-slate-600 rounded hover:bg-slate-600 hover:text-sky-300 transition-colors flex items-center justify-center min-w-[36px]"
                                    title={i18n.language?.startsWith('en') ? 'التبديل إلى العربية' : 'Switch to English'}
                                >
                                    <span className="font-bold text-sm">E/ع</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {user && !isMinimalUILayout && (
                <div className="bg-slate-700 text-slate-200 px-3 py-2 flex items-center w-full shadow-inner relative min-h-[48px]">

                    {/* Centered Profile Info Container */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                        <div
                            className="flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-600 px-2 py-1 rounded-md transition-colors duration-200 pointer-events-auto max-w-[65%] sm:max-w-xl mx-auto"
                            onClick={() => setIsUserProfileModalOpen(true)}
                            title="View Profile Information"
                        >
                            <span className="font-semibold text-sm truncate shrink-0">
                                {user.displayName || user.email}
                            </span>

                            <div className="flex items-center gap-1 flex-nowrap overflow-hidden">
                                {userRoles && userRoles.length > 0 && userRoles.map((r, idx) => (
                                    idx === 0 && <span key={r} className="bg-sky-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm capitalize whitespace-nowrap shrink-0">
                                        {r.replace(/_/g, ' ')}
                                    </span>
                                ))}
                                {userHRProfile && userHRProfile.role && (
                                    <span className="bg-teal-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm capitalize whitespace-nowrap shrink-0 hidden sm:inline-flex">
                                        {userHRProfile.role}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Left Spacer for symmetry */}
                    <div className="flex-1 z-10 pointer-events-none"></div>

                    {/* Right Action Buttons */}
                    <div className="flex items-center justify-end gap-2 shrink-0 z-10 pointer-events-auto">
                        <button
                            onClick={() => {
                                const newLang = i18n.language?.startsWith('en') ? 'ar' : 'en';
                                i18n.changeLanguage(newLang);
                            }}
                            className="p-1.5 text-sky-400 bg-slate-600 border border-slate-500 rounded hover:bg-slate-500 hover:text-sky-300 transition-colors flex items-center justify-center min-w-[36px]"
                            title={i18n.language?.startsWith('en') ? 'التبديل إلى العربية' : 'Switch to English'}
                        >
                            <span className="font-bold text-sm">E/ع</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 sm:px-3 sm:py-1 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center justify-center gap-1 transition-colors"
                            title={t('app.logout', 'Logout')}
                        >
                            <LogOut size={18} className="sm:hidden" />
                            <span className="hidden sm:inline">{t('app.logout', 'Logout')}</span>
                        </button>
                    </div>
                </div>
            )}
            
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}

            {/* Adjusted padding to ensure BottomNav doesn't cover anything */}
            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full flex-grow pb-24 md:pb-8 overflow-x-hidden">
                <Suspense fallback={<Card><Spinner /></Card>}>
                    {mainContent}
                </Suspense>
            </main>

            { user && !isMinimalUILayout && <BottomNav navItems={visibleNavItems} navigate={navigate} currentView={view} /> }

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
                            <div className="flex items-start justify-between border-b border-gray-200 pb-6">
                                <div className="flex items-start space-x-4">
                                    <div className="h-16 w-16 bg-sky-100 rounded-full flex items-center justify-center text-sky-600 text-3xl font-bold shadow-inner shrink-0">
                                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 mt-1">
                                        {isEditingProfile ? (
                                            <div className="mb-2">
                                                <Input 
                                                    value={editDisplayName} 
                                                    onChange={(e) => setEditDisplayName(e.target.value)} 
                                                    placeholder="Full Name" 
                                                />
                                            </div>
                                        ) : (
                                            <h3 className="text-xl font-bold text-gray-800 mb-1">{user.displayName || 'No Name Set'}</h3>
                                        )}
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Active Account
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="shrink-0 ml-4">
                                    {isEditingProfile ? (
                                        <div className="flex space-x-2">
                                            <Button variant="secondary" onClick={() => setIsEditingProfile(false)}>Cancel</Button>
                                            <Button onClick={handleSaveProfile}>Save</Button>
                                        </div>
                                    ) : (
                                        <Button variant="secondary" onClick={() => setIsEditingProfile(true)}>
                                            Edit Profile
                                        </Button>
                                    )}
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

                                <div className="border border-gray-200 p-4 rounded-lg bg-white shadow-sm md:col-span-2">
                                    <span className="block text-xs text-gray-500 uppercase font-bold mb-3">Roles & Designations</span>
                                    <div className="flex flex-col gap-2">
                                        
                                        {/* Updated to show multiple roles here too */}
                                        <div className="flex flex-col gap-2 bg-sky-50 p-2.5 rounded border border-sky-100">
                                            <span className="text-sm font-medium text-sky-800">System Access Levels</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {userRoles && userRoles.length > 0 ? userRoles.map(r => (
                                                    <span key={r} className="text-sky-700 font-bold capitalize bg-white px-2 py-0.5 rounded shadow-sm text-xs">
                                                        {r.replace(/_/g, ' ')}
                                                    </span>
                                                )) : (
                                                    <span className="text-sky-700 font-bold capitalize">
                                                        {(userRole || 'Standard User').replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
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
                <ResourceMonitor counts={operationCounts} onReset={handleResetMonitor} onDismiss={handleDismissMonitor} />
            )}

            {/* --- NATIVE DIRECT DOWNLOAD MODAL --- */}
            {nativeUpdatePrompt && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-90 flex flex-col items-center justify-center z-[100000] p-4 backdrop-blur-sm" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                            <Download className="h-8 w-8 text-red-600 animate-bounce"/>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">تحديث هام مطلوب</h3>
                        <p className="text-sm text-slate-600 font-medium">
                            يتوفر إصدار جديد من التطبيق ({nativeUpdatePrompt.versionString}). يجب عليك تحميل هذا التحديث للاستمرار في استخدام التطبيق.
                        </p>
                        {nativeUpdatePrompt.releaseNotes && (
                            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-700 text-right border border-gray-200">
                                <strong>ميزات التحديث:</strong><br/>
                                {nativeUpdatePrompt.releaseNotes}
                            </div>
                        )}
                        <button 
                            onClick={() => {
                                handleFileDownloadAndOpen(
                                    nativeUpdatePrompt.downloadUrl, 
                                    `National Child Health Program APP v${nativeUpdatePrompt.versionString}.apk`
                                );
                            }}
                            className="w-full justify-center rounded-xl bg-red-600 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-red-700 transition-colors"
                        >
                            تحميل التحديث الآن
                        </button>
                        {!nativeUpdatePrompt.mandatory && (
                            <button onClick={() => setNativeUpdatePrompt(null)} className="text-sm text-gray-500 hover:text-gray-700 mt-2">
                                تخطي في الوقت الحالي
                            </button>
                        )}
                    </div>
                </div>
            )}

           {/* --- CAPGO OTA UPDATE READY MODAL --- */}
           {isUpdateReady && updateBundle && !nativeUpdatePrompt && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-[100000] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-sky-100">
                            <RefreshCw className="h-6 w-6 text-sky-600 animate-spin"/>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Update Ready!</h3>
                        <p className="text-sm text-slate-500">
                            A new version of the app has been downloaded in the background. You must restart the app to apply the update and continue.
                        </p>
                        <button 
                            onClick={async () => {
                                try { await CapacitorUpdater.set({ id: updateBundle.id }); } catch (e) { console.error("Failed to apply update", e); }
                            }}
                            className="w-full inline-flex justify-center rounded-md border border-transparent bg-sky-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 sm:text-sm"
                        >
                            Restart & Update Now
                        </button>
                    </div>
                </div>
            )}

           {/* --- MANUAL UPDATE CHECK MODAL --- */}
           {manualUpdateModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-[100000] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-100">
                            {manualUpdateModal.status === 'checking' || manualUpdateModal.status === 'downloading' ? (
                                <RefreshCw className="h-6 w-6 text-sky-600 animate-spin"/>
                            ) : manualUpdateModal.status === 'success' ? (
                                <ClipboardCheck className="h-6 w-6 text-green-600" />
                            ) : manualUpdateModal.status === 'error' ? (
                                <X className="h-6 w-6 text-red-600" />
                            ) : (
                                <Info className="h-6 w-6 text-sky-600" />
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">
                            {manualUpdateModal.status === 'checking' ? 'Checking for Updates' :
                             manualUpdateModal.status === 'downloading' ? 'Downloading Update' :
                             manualUpdateModal.status === 'success' ? 'Up to Date' :
                             manualUpdateModal.status === 'error' ? 'Update Error' : 'Information'}
                        </h3>
                        <p className="text-sm text-slate-500">
                            {manualUpdateModal.message}
                        </p>
                        {(manualUpdateModal.status === 'success' || manualUpdateModal.status === 'error' || manualUpdateModal.status === 'info') && (
                            <button 
                                onClick={() => setManualUpdateModal({ isOpen: false, status: 'idle', message: '' })}
                                className="w-full mt-2 inline-flex justify-center rounded-md border border-transparent bg-slate-800 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 sm:text-sm"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}