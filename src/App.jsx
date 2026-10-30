// App.jsx
import './i18n'; 
import React, { useEffect, useMemo, useState, useRef, lazy, Suspense, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from 'react-i18next'; 


import {
    Home, Book, Users, User, Hospital, Database, ClipboardCheck, FolderKanban, TrendingUp, X, RefreshCw, Activity, Layers, LogOut, Info, HardDrive, Bell, Trash2, Cloud, CloudOff, Package, BookOpen, Sparkles, ArrowLeft, CalendarDays, Menu, Languages
} from 'lucide-react';

import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Network } from '@capacitor/network';

// --- CUSTOM HOOKS & UTILS ---
import { downloadAndOpenFile } from './utils/fileDownloader';
import { computeCoverage, computeHomeStats, levelFromPermissions } from './utils/homeStats';
import { OWN_KEYS, describePage, pagePath, pageFromLocation, settlePage, isNewEntry, isTransientPage } from './utils/pageAddress';
import { useAppUpdate } from './hooks/useAppUpdate';
import { runInPageBack } from './utils/inPageBack';
import { isFormGuarded, onGuardChange, setLeaveConfirmer } from './utils/leaveGuard';
import { clearRememberedFilters } from './utils/rememberedState';
import { usePushNotifications, usePushEvents } from './hooks/usePushNotifications';

// --- PRE-FLIGHT LANGUAGE CHECK ---
if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    if (lang) {
        localStorage.setItem('language', lang);
        localStorage.setItem('app_language', lang);
    }
}


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

const IMNCIRecordingForm = lazy(() => import('./components/imnci').then(m => ({ default: m.IMNCIRecordingForm })));

const CertificateVerificationView = lazy(() => import('./components/CertificateGenerator').then(module => ({ default: module.CertificateVerificationView })));
const PublicCertificateDownloadView = lazy(() => import('./components/CertificateGenerator').then(module => ({ default: module.PublicCertificateDownloadView })));
const PublicCourseCertificatesView = lazy(() => import('./components/CertificateGenerator').then(module => ({ default: module.PublicCourseCertificatesView }))); 
const CertificateDownloadBanner = lazy(() => import('./components/CertificateGenerator').then(module => ({ default: module.CertificateDownloadBanner })));

const PublicAttendanceView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicAttendanceView })));
const AttendanceManagerView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.AttendanceManagerView })));
const PublicParticipantRegistrationView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicParticipantRegistrationView })));
const PublicExerciseView = lazy(() => import('./components/imnci').then(m => ({ default: m.PublicExerciseView })));
const PublicCourseMonitoringView = lazy(() => import('./components/Course.jsx').then(module => ({ default: module.PublicCourseMonitoringView })));

const CourseTestForm = lazy(() => import('./components/CourseTestForm.jsx').then(module => ({ default: module.CourseTestForm })));

const PublicFacilityUpdateForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.PublicFacilityUpdateForm })));
const NewFacilityEntryForm = lazy(() => import('./components/FacilityForms.jsx').then(module => ({ default: module.NewFacilityEntryForm })));
const SkillsMentorshipView = lazy(() => import('./components/mentorship/SkillsMentorshipView.jsx'));

const ProjectTrackerView = lazy(() => import('./components/ProjectTrackerView'));
const SupplyManagementView = lazy(() => import('./components/SupplyManagementView'));
const SupervisionView = lazy(() => import('./components/SupervisionView'));
const PublicSupervisionForm = lazy(() => import('./components/SupervisionView').then(module => ({ default: module.PublicSupervisionForm })));
const OnlineCoursesView = lazy(() => import('./components/imnci').then(m => ({ default: m.OnlineCoursesView })));
// The IMNCI screens share one load of the exercise definitions. Wrapping them
// in the provider is what stops the course, the exercises and the patient form
// each fetching their own copy, and what makes a case corrected in one of them
// correct in the others without a reload.
const ImnciProvider = lazy(() => import('./components/imnci').then(m => ({ default: m.ImnciProvider })));
// Reaching programme data through Claude: the consent step for the claude.ai
// connector, and the chat panel inside the app.
const ConnectClaudeScreen = lazy(() => import('./components/ClaudeAssistant').then(m => ({ default: m.ConnectClaudeScreen })));
const ClaudeChatPanel = lazy(() => import('./components/ClaudeAssistant').then(m => ({ default: m.ClaudeChatPanel })));

// The chat panel needs an Anthropic API key, which is billed per question and
// cannot be covered by a Claude subscription. Off until the programme decides
// to fund it; the claude.ai connector does the same job on the subscriptions
// the team already has. Flip this and the claudeChat export together.
const CLAUDE_CHAT_ENABLED = false;

// "Ask the data" on every page: answers from the app's own data only, through
// the aiAssistant Cloud Function (Gemini and Groq free tiers, no Anthropic key).
// The panel loads the first time it is opened.
const DataAssistantPanel = lazy(() => import('./components/DataAssistant').then(m => ({ default: m.DataAssistantPanel })));
// Pages where the round button would sit on top of a form's own Save row.
const NO_ASSISTANT_BUTTON = new Set(['courseForm', 'participantForm', 'facilitatorForm', 'observe', 'imciForm', 'enter-test-scores', 'participantMigration']);

// Reporting a problem from wherever it happened.
const ReportProblemButton = lazy(() => import('./components/ProblemReports').then(m => ({ default: m.ReportProblemButton })));
const MeetingTrackerView = lazy(() => import('./components/MeetingTrackerView'));

const PublicMeetingAttendanceView = lazy(() => import('./components/ProjectTrackerView').then(module => ({ default: module.PublicMeetingAttendanceView })));
const PlanningView = lazy(() => import('./components/PlanningView'));
const LocalityPlanView = lazy(() => import('./components/LocalityPlanView'));

// --- DOWNLOADS AND ABOUT PAGE ---
const AboutDeveloperPage = lazy(() => import('./components/AboutDeveloperPage'));
const DownloadedFilesView = lazy(() => import('./components/DownloadedFilesView.jsx'));

// --- PERMISSIONS IMPORT ---
import { 
    ALL_PERMISSION_KEYS, 
    DEFAULT_ROLE_PERMISSIONS, 
    applyDerivedPermissions 
} from './components/permissions.js';

import {
    listAllDataForCourse, deleteFacilitator,
    upsertFinalReport, getFinalReportByCourseId, saveFinalReportWithFiles, lightFinalReport, uploadFile, deleteFile,
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
    upsertUnitMeeting,
    getPendingSyncQueue,
    clearPendingSyncQueue,
    getCachedCourse, getCachedParticipants,
} from './data.js';
import { STATE_LOCALITIES } from './components/constants.js';
import { Card, Button, Spinner, Toast, Modal, Input, PageSkeleton, Skeleton } from './components/CommonComponents';
import { auth, db, isOnline, getConnectivity } from './firebase';
import OfflinePill from './components/OfflinePill';

import { doc, getDoc, getDocFromServer, waitForPendingWrites, onSnapshot } from 'firebase/firestore';

import { signOut, updateProfile, onAuthStateChanged } from 'firebase/auth'; 
import { useDataCache } from './DataContext';
import { useAuth } from './hooks/useAuth';
import { SignInBox } from './auth-ui.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import { notify, confirmDialog, DialogHost } from './components/dialogs';
import ErrorBoundary, { QuietBoundary } from './components/ErrorBoundary.jsx';
import { publicBaseUrl } from './utils/publicLink';
import SudanMiniMap from './components/SudanMiniMap';
import { DataAssistantButton, DataAssistantCard } from './components/DataAssistantLauncher';
import { coverageColor } from './utils/statusColors';

const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;

/**
 * Reads a JSON value from localStorage without ever throwing. A corrupt entry
 * is discarded rather than left in place to fail again on the next launch.
 */
function readBackup(key, fallback) {
    let raw = null;
    try {
        raw = localStorage.getItem(key);
    } catch {
        return fallback; // storage blocked entirely (private mode, disabled cookies)
    }
    if (raw == null) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed == null ? fallback : parsed;
    } catch {
        console.warn(`[backup] discarding unreadable localStorage entry: ${key}`);
        try { localStorage.removeItem(key); } catch { /* nothing more to do */ }
        return fallback;
    }
}

function ShareModal({ isOpen, onClose, shareableItem, shareType = 'course', onSave }) {
    const { t } = useTranslation();
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
        
        const baseUrl = publicBaseUrl();
        const shareUrl = `${baseUrl}/${routePrefix}/${shareableItem.id}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopySuccess(t('app_extra.share.link_copied', 'Link copied!'));
            setTimeout(() => setCopySuccess(''), 2000);
        }).catch(err => {
            setCopySuccess(t('app_extra.share.copy_failed', 'Failed to copy.'));
        });
    };

    if (!shareableItem) return null;

    const isCourse = shareType === 'course';
    const reportName = isCourse ? `${shareableItem.course_type} - ${shareableItem.state}` : shareableItem.name;
    const modalTitle = isCourse ? t('app_extra.share.title_course', 'Share Course Report') : t('app_extra.share.title_participant', 'Share Participant Report');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
            <div className="p-6 space-y-6">
                <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 bg-sky-100 p-3 rounded-full">
                        <ShareIcon />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">{reportName}</h3>
                        <p className="text-sm text-gray-500">{t('app_extra.share.manage_access', 'Manage access permissions for this report.')}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-semibold text-gray-700">{t('app_extra.share.general_access', 'General Access')}</label>
                    <div className="flex space-x-4">
                        <label className="flex items-center space-x-2">
                            <input type="radio" name="accessLevel" value="private" checked={accessLevel === 'private'} onChange={() => setAccessLevel('private')} className="form-radio text-sky-600" />
                            <span>{t('app_extra.share.restricted', 'Restricted')}</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input type="radio" name="accessLevel" value="public" checked={accessLevel === 'public'} onChange={() => setAccessLevel('public')} className="form-radio text-sky-600" />
                            <span>{t('app_extra.share.anyone', 'Anyone with the link')}</span>
                        </label>
                    </div>
                </div>

                {accessLevel === 'private' && (
                    <div className="space-y-4">
                        <label className="font-semibold text-gray-700">{t('app_extra.share.specific_people', 'Share with specific people')}</label>
                        <div className="flex space-x-2">
                            <Input type="email" placeholder={t('app_extra.share.email_placeholder', 'Enter email address')} value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="flex-grow" />
                            <Button onClick={handleAddEmail}>{t('app_extra.buttons.add', 'Add')}</Button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {sharedWith.map(email => (
                                <div key={email} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                                    <span className="text-sm text-gray-700">{email}</span>
                                    <button onClick={() => handleRemoveEmail(email)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                                </div>
                            ))}
                            {sharedWith.length === 0 && <p className="text-sm text-gray-500 text-center py-2">{t('app_extra.share.not_shared', 'Not shared with anyone yet.')}</p>}
                        </div>
                    </div>
                )}
                
                <div className="pt-4 border-t">
                     <div className="flex items-center justify-between">
                        <Button onClick={handleCopyLink} variant="secondary">
                            <LinkIcon /> {copySuccess ? copySuccess : t('app_extra.share.copy_link', 'Copy Link')}
                        </Button>
                        <div className="flex space-x-2">
                            <Button variant="secondary" onClick={onClose}>{t('app_extra.buttons.cancel', 'Cancel')}</Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Spinner size="sm" /> : t('app_extra.buttons.save_changes', 'Save Changes')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

const ResourceMonitor = ({ counts, onReset, onDismiss }) => {
    const { t } = useTranslation();
    return (
        <div className="fixed top-4 end-4 md:bottom-4 md:top-auto bg-gray-900 text-white p-2 rounded-lg shadow-lg z-50 opacity-90 w-56">
            <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-sky-400" />
                    <h4 className="font-bold text-sm">{t('app_extra.monitor.title', 'Session Ops')}</h4>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onReset} className="text-xs text-gray-400 hover:text-white transition-colors" title={t('app_extra.monitor.reset_counts', 'Reset Counts')}>{t('app_extra.monitor.reset', 'Reset')}</button>
                    <button onClick={onDismiss} className="text-gray-400 hover:text-white transition-colors" title={t('app_extra.monitor.dismiss', 'Dismiss Monitor')}><X className="w-4 h-4" /></button>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                    <div className="text-xs text-gray-400 ">{t('app_extra.monitor.reads', 'Reads')}</div>
                    <div className="text-xl font-mono font-bold text-green-400">{counts.reads}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-400 ">{t('app_extra.monitor.writes', 'Writes')}</div>
                    <div className="text-xl font-mono font-bold text-yellow-400">{counts.writes}</div>
                </div>
            </div>
        </div>
    );
};

// --- Landing Page ---
// Tailwind keeps only class names it can see whole in the source, so each
// tile's colours are written out rather than built from a colour name.
const TILE_TINTS = {
    teal: { icon: 'bg-teal-50 text-teal-700', ring: 'group-hover:ring-teal-200' },
    violet: { icon: 'bg-violet-50 text-violet-700', ring: 'group-hover:ring-violet-200' },
    amber: { icon: 'bg-amber-50 text-amber-700', ring: 'group-hover:ring-amber-200' },
    slate: { icon: 'bg-slate-100 text-slate-700', ring: 'group-hover:ring-slate-200' },
};

// The main menu's tile groups, in order. Each group has one colour, so the
// colour tells you which area a tile belongs to.
const MODULE_GROUPS = [
    { id: 'services', tint: 'teal', label: 'Services and coverage' },
    { id: 'training', tint: 'violet', label: 'Training and people' },
    { id: 'planning', tint: 'amber', label: 'Planning and follow-up' },
    { id: 'general', tint: 'slate', label: 'App and team' },
];

function ModuleTile({ label, tagline, icon: Icon, tint, onClick }) {
    const { icon: iconCls, ring: ringCls } = TILE_TINTS[tint];
    return (
        <button
            onClick={onClick}
            className={`group relative text-start bg-white rounded-2xl border border-slate-100 p-4 shadow-sm ring-2 ring-transparent transition hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] ${ringCls}`}
        >
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${iconCls}`}>
                <Icon size={24} />
            </div>
            <p className="font-bold text-slate-900 mt-3 leading-snug">{label}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{tagline}</p>
        </button>
    );
}

// The greeting card's colour and label follow the person's programme level.
const LEVEL_CARDS = {
    federal: 'bg-sky-700',
    state: 'bg-emerald-700',
    locality: 'bg-violet-700',
};

// `value` null: still loading (`busy`) or could not be loaded.
// The app's modules, for the main menu tiles and the side menu. 'downloads'
// only exists on the native app.
// Page names for the slim bar.
function pageTitles(t) {
    return {
    dashboard: t('landing.modules.dashboard', 'Dashboard'), courses: t('landing.modules.courses', 'Courses'),
    humanResources: t('landing.modules.human_resources', 'Human Resources'), childHealthServices: t('landing.modules.facilities', 'Child Health Services'),
    skillsMentorship: t('landing.modules.mentorship', 'Skills Mentorship'), imciForm: t('landing.modules.imci', 'IMNCI Protocol'),
    projects: t('landing.modules.projects', 'Project Tracker'), meetings: t('landing.modules.meetings', 'Meeting Tracker'),
    planning: t('landing.modules.planning', 'Master Plan'), localityPlan: t('landing.modules.locality_plan', 'Bottom-up Planning'),
    supplyManagement: t('landing.modules.supply', 'Supply Management'), supervision: t('landing.modules.supervision', 'Supervision'),
    onlineCourses: t('landing.modules.online_courses', 'Online Courses'), downloads: t('landing.modules.downloads', 'App Files & Downloads'),
    admin: t('landing.modules.admin', 'Admin'), about: t('landing.modules.about', 'About Team'),
    courseReport: t('landing.modules.course_report', 'Course Report'), participantReport: t('landing.modules.participant_report', 'Participant Report'),
    facilitatorReport: t('landing.modules.facilitator_report', 'Facilitator Report'), facilitatorForm: t('landing.modules.facilitator_form', 'Facilitator'),
    finalReport: t('landing.modules.final_report', 'Final Report'), attendanceManager: t('landing.modules.attendance', 'Attendance'),
    observe: t('landing.modules.monitoring', 'Monitoring'), monitoring: t('landing.modules.monitoring', 'Monitoring'),
};
}

function buildModules(t, permissions) {
    const tile = (key, fallback) => t(`landing.taglines.${key}`, fallback);
    return [
        { label: t('landing.modules.dashboard', 'Dashboard'), tagline: tile('dashboard', 'Key indicators at a glance'), view: 'dashboard', group: 'services', icon: Home, permission: true },
        { label: t('landing.modules.courses', 'Courses'), tagline: tile('courses', 'Courses, participants and reports'), view: 'courses', group: 'training', icon: Book, permission: permissions.canViewCourse },
        { label: t('landing.modules.human_resources', 'Human Resources'), tagline: tile('human_resources', 'Facilitators, teams and partners'), view: 'humanResources', group: 'training', icon: Users, permission: permissions.canViewHumanResource },
        { label: t('landing.modules.facilities', 'Child Health Services'), tagline: tile('facilities', 'Facilities and service coverage'), view: 'childHealthServices', group: 'services', icon: Hospital, permission: permissions.canViewFacilities },
        { label: t('landing.modules.mentorship', 'Skills Mentorship'), tagline: tile('mentorship', 'Mentorship visits and skills'), view: 'skillsMentorship', group: 'services', icon: ClipboardCheck, permission: permissions.canViewSkillsMentorship },
        { label: t('landing.modules.imci', 'IMNCI Protocol'), tagline: tile('imci', 'Assess and classify a sick child'), view: 'imciForm', group: 'training', icon: Activity, permission: permissions.canViewCourse },
        { label: t('landing.modules.projects', 'Project Tracker'), tagline: tile('projects', 'Track project tasks'), view: 'projects', group: 'planning', icon: FolderKanban, permission: permissions.canUseFederalManagerAdvancedFeatures },
        { label: t('landing.modules.meetings', 'Meeting Tracker'), tagline: tile('meetings', 'Meetings and attendance'), view: 'meetings', group: 'planning', icon: CalendarDays, permission: permissions.canUseFederalManagerAdvancedFeatures },
        { label: t('landing.modules.planning', 'Master Plan'), tagline: tile('planning', 'The annual master plan'), view: 'planning', group: 'planning', icon: TrendingUp, permission: permissions.canUseFederalManagerAdvancedFeatures },
        { label: t('landing.modules.locality_plan', 'Bottom-up Planning'), tagline: tile('locality_plan', 'Plans from the localities'), view: 'localityPlan', group: 'planning', icon: Layers, permission: permissions.canViewLocalityPlan },
        { label: t('landing.modules.supply', 'Supply Management'), tagline: tile('supply', 'Stock and distribution'), view: 'supplyManagement', group: 'services', icon: Package, permission: permissions.canViewSupplyChain },
        { label: t('landing.modules.supervision', 'Supervision'), tagline: tile('supervision', 'Supervision checklists'), view: 'supervision', group: 'services', icon: ClipboardCheck, permission: permissions.canViewSupervision },
        { label: t('landing.modules.online_courses', 'Online Courses'), tagline: tile('online_courses', 'Learn and practise online'), view: 'onlineCourses', group: 'training', icon: BookOpen, permission: permissions.canViewOnlineCourses },
        { label: t('landing.modules.downloads', 'App Files & Downloads'), tagline: tile('downloads', 'Files saved on this device'), view: 'downloads', group: 'general', icon: HardDrive, permission: Capacitor.isNativePlatform() },
        { label: t('landing.modules.admin', 'Admin'), tagline: tile('admin', 'Users, roles and settings'), view: 'admin', group: 'general', icon: User, permission: permissions.canViewAdmin },
        { label: t('landing.modules.about', 'About Team'), tagline: tile('about', 'The programme team'), view: 'about', group: 'general', icon: Info, permission: true },
    ];
}

function StatBox({ value, label, busy, icon: Icon, format = (v) => v.toLocaleString() }) {
    const loading = value === null && busy;
    return (
        <div className="rounded-2xl bg-white/15 backdrop-blur-sm px-3 py-2.5 min-w-0 ring-1 ring-white/10">
            <div className="flex items-center gap-1.5 text-white/80">
                {Icon && <Icon size={13} className="shrink-0" />}
                <p className="text-xs leading-tight truncate">{label}</p>
            </div>
            {loading
                ? <Skeleton className="shimmer-light h-6 w-12 mt-1" />
                : <p className="text-xl font-bold leading-tight mt-0.5">{value === null ? '—' : format(value)}</p>}
        </div>
    );
}

// Coverage on the greeting card: overall first, then the four services,
// all on one row (it scrolls sideways on narrow phones).
const COVERAGE_ITEMS = [
    { key: 'imnci', label: 'IMNCI' },
    { key: 'etat', label: 'ETAT' },
    { key: 'eenc', label: 'EENC' },
    { key: 'scnu', label: 'SCNU' },
];

function CoverageChip({ label, value, loading, strong = false }) {
    return (
        <div className={`shrink-0 min-w-[5.5rem] flex-1 rounded-2xl px-3 py-2 ring-1 ${strong ? 'bg-white text-slate-800 ring-white' : 'bg-white/15 ring-white/10'}`}>
            <p className={`text-xs leading-tight truncate ${strong ? 'font-semibold text-slate-500' : 'text-white/80'}`}>{label}</p>
            {loading
                ? <Skeleton className={`${strong ? '' : 'shimmer-light'} h-5 w-10 mt-1`} />
                : (
                    <>
                        <p className="text-lg font-bold leading-tight mt-0.5">{value === null || value === undefined ? '—' : `${value}%`}</p>
                        <div className={`mt-1 h-1 rounded-full overflow-hidden ${strong ? 'bg-slate-200' : 'bg-white/20'}`}>
                            <div className={`h-full rounded-full ${strong ? '' : 'bg-white'}`} style={{ width: `${Math.min(100, value || 0)}%`, backgroundColor: strong ? coverageColor(value) : undefined }} />
                        </div>
                    </>
                )}
        </div>
    );
}

function CoverageRow({ coverage, busy, onOpen }) {
    const { t } = useTranslation();
    const loading = !coverage && busy;
    if (!coverage && !busy) return null;
    const row = (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CoverageChip strong label={t('landing.coverage.overall', 'Overall coverage')} value={coverage?.overall} loading={loading} />
            {COVERAGE_ITEMS.map(({ key, label }) => (
                <CoverageChip key={key} label={t(`landing.coverage.${key}`, label)} value={coverage?.services?.[key]?.perc} loading={loading} />
            ))}
        </div>
    );
    return onOpen
        ? <button type="button" onClick={onOpen} className="mt-2 block w-full text-start">{row}</button>
        : <div className="mt-2">{row}</div>;
}

// Phone greeting: two lines. The greeting, then one highlight from this
// year's numbers, picked at random each time the main menu opens; tapping
// it shows another.
function homeFacts(t, stats, level) {
    if (!stats) return [];
    const n = (v) => Number(v).toLocaleString();
    const facts = [];
    const add = (value, key, icon) => {
        if (value !== null && value !== undefined && Number(value) > 0) facts.push({ icon, text: t(`ui.facts.${key}`, { n: n(value) }) });
    };
    add(stats.courses, 'courses', Book);
    add(stats.participants, 'participants', Users);
    add(stats.facilitiesReached, 'facilities_reached', Hospital);
    add(stats.visits, 'visits', ClipboardCheck);
    if (level !== 'locality') add(stats.facilitators, 'facilitators', User);
    const coverage = stats.coverage;
    if (coverage?.overall !== null && coverage?.overall !== undefined) facts.push({ icon: Activity, text: t('ui.facts.overall', { n: coverage.overall }) });
    COVERAGE_ITEMS.forEach(({ key, label }) => {
        const perc = coverage?.services?.[key]?.perc;
        if (perc !== null && perc !== undefined) facts.push({ icon: Activity, text: t('ui.facts.service', { n: perc, service: t(`landing.coverage.${key}`, label) }) });
    });
    return facts;
}

function PhoneGreeting({ greeting, firstName, level, levelLabel, scope, stats, states = [] }) {
    const { t } = useTranslation();
    const [pick, setPick] = useState(() => Math.floor(Math.random() * 1000));
    const facts = homeFacts(t, stats, level);
    const loading = facts.length === 0 && stats && Object.values(stats.busy || {}).some(Boolean);
    const fact = facts.length ? facts[pick % facts.length] : null;
    const FactIcon = fact?.icon;
    return (
        <section className={`md:hidden relative overflow-hidden rounded-2xl ${LEVEL_CARDS[level]} text-white ps-4 pe-[4.5rem] py-3`}>
            <SudanMiniMap highlight={states} all={level === 'federal'} className="absolute end-3 top-1/2 -translate-y-1/2 h-14 w-14 text-white" />
            <div className="relative flex items-center gap-2 min-w-0">
                <h2 className="text-base font-bold leading-tight truncate">
                    {greeting}{firstName ? `, ${firstName}` : ''}
                </h2>
                <span className="shrink-0 max-w-[45%] truncate rounded-full bg-white text-slate-800 px-2 py-0.5 text-xs font-semibold">{scope || levelLabel}</span>
            </div>
            {fact ? (
                <button
                    type="button"
                    onClick={() => setPick(p => p + 1)}
                    title={t('ui.next_fact', 'Show another highlight')}
                    className="relative mt-1 flex w-full items-center gap-1.5 text-start text-sm text-white/90 min-w-0"
                >
                    <FactIcon size={14} className="shrink-0" />
                    <span className="truncate">{fact.text}</span>
                </button>
            ) : loading ? (
                <Skeleton className="shimmer-light relative mt-1.5 h-4 w-2/3" />
            ) : (
                <p className="relative mt-1 text-sm text-white/80 truncate">{levelLabel}</p>
            )}
        </section>
    );
}

function Landing({ navigate, permissions, user, roles = [], userStates = [], userLocalities = [], stats = null, onAskData }) {
    const { t, i18n } = useTranslation();

    const hour = new Date().getHours();
    const greeting = hour < 12 ? t('landing.good_morning', 'Good morning') : hour < 18 ? t('landing.good_afternoon', 'Good afternoon') : t('landing.good_evening', 'Good evening');
    const firstName = String(user?.displayName || '').trim().split(/\s+/)[0];
    const role = roles[0] ? String(roles[0]).replace(/_/g, ' ') : '';
    const level = levelFromPermissions(permissions);
    const levelLabel = {
        federal: t('landing.level_federal', 'Federal level'),
        state: t('landing.level_state', 'State level'),
        locality: t('landing.level_locality', 'Locality level'),
    }[level];
    const places = (level === 'locality' ? userLocalities : level === 'state' ? userStates : []) || [];
    const scope = places.filter(Boolean).join(i18n.language?.startsWith('ar') ? '، ' : ', ');

    const accessibleButtons = buildModules(t, permissions).filter(btn => btn.permission);
    const chip = 'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold';

    return (
        <div className="flex flex-col min-h-full space-y-4">
            <PhoneGreeting greeting={greeting} firstName={firstName} level={level} levelLabel={levelLabel} scope={scope} stats={stats} states={userStates} />
            <section className={`hidden md:flex items-start gap-5 rounded-3xl ${LEVEL_CARDS[level]} text-white p-4 sm:p-5`}>
                <div className="relative flex-1 min-w-0">
                    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <h2 className="shrink-0 text-lg sm:text-xl font-bold leading-tight">
                            {greeting}{firstName ? `, ${firstName}` : ''}
                        </h2>
                        <span className={`${chip} bg-white text-slate-800`}>{levelLabel}</span>
                        {scope && <span className={`${chip} bg-white/20`}>{scope}</span>}
                        {role && <span className={`${chip} bg-white/20 capitalize`}>{role}</span>}
                        {stats?.focus && <span className={`${chip} bg-white/20`}>{t(`landing.unit_${stats.focus.toLowerCase()}`, `${stats.focus} unit`)}</span>}
                    </div>
                    {stats && (
                        <div className={`mt-3 grid grid-cols-2 sm:grid-cols-3 ${level === 'locality' ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-2`}>
                            <StatBox icon={Book} busy={stats.busy.courses} value={stats.courses} label={t('landing.stats.courses', 'Courses')} />
                            <StatBox icon={Users} busy={stats.busy.courses || stats.busy.participants} value={stats.participants} label={t('landing.stats.participants', 'Participants trained')} />
                            <StatBox icon={Hospital} busy={stats.busy.visits} value={stats.facilitiesReached} label={t('landing.stats.facilities_reached', 'Facilities reached')} />
                            <StatBox icon={ClipboardCheck} busy={stats.busy.visits} value={stats.visits} label={t('landing.stats.visits', 'Mentorship visits')} />
                            {level !== 'locality' && <StatBox icon={User} busy={stats.busy.facilitators} value={stats.facilitators} label={t('landing.stats.facilitators', 'Facilitators')} />}
                        </div>
                    )}
                    {stats && (
                        <CoverageRow
                            coverage={stats.coverage}
                            busy={stats.busy.facilities}
                            onOpen={permissions.canViewFacilities ? () => navigate('childHealthServices') : undefined}
                        />
                    )}
                    {stats && <p className="mt-2 text-xs text-white/70">{t('landing.stats_year', 'This year')} ({new Date().getFullYear()})</p>}
                </div>
                <SudanMiniMap highlight={userStates} all={level === 'federal'} title={scope || levelLabel} className="hidden lg:block shrink-0 w-36 xl:w-44 text-white" />
            </section>

            {onAskData && accessibleButtons.length > 0 && <DataAssistantCard onOpen={onAskData} />}

            {accessibleButtons.length > 0 ? (
                <div className="space-y-5">
                    {MODULE_GROUPS.map(group => {
                        const tiles = accessibleButtons.filter(btn => btn.group === group.id);
                        if (!tiles.length) return null;
                        return (
                            <section key={group.id} aria-labelledby={`group-${group.id}`}>
                                <h3 id={`group-${group.id}`} className="mb-2 text-sm font-semibold text-slate-500">{t(`landing.groups.${group.id}`, group.label)}</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {tiles.map(btn => (
                                        <ModuleTile key={btn.view} label={btn.label} tagline={btn.tagline} icon={btn.icon} tint={group.tint} onClick={() => navigate(btn.view)} />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            ) : (
                <Card><div className="p-8 text-center text-gray-500">{t('landing.no_permissions', 'You do not have permissions to view any modules. Please contact an administrator.')}</div></Card>
            )}
        </div>
    );
}

// Credit line shown at the foot of every page: inside the phone bottom bar,
// and as a page footer on wider screens and on pages without the bar.
function AppCredit({ className = '' }) {
    return (
        <div className={`text-center leading-snug ${className}`}>
            <p className="font-semibold">{`© ${new Date().getFullYear()} National Child Health Program`}</p>
            <p>
                <span>Developed by <span className="font-semibold">Dr Qusay Mohamed</span></span>
                <span className="mx-1.5 opacity-60">•</span>
                <a href="mailto:Gussaay@gmail.com" className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline">Gussaay@gmail.com</a>
            </p>
        </div>
    );
}

const BottomNav = React.memo(function BottomNav({ navItems, navigate }) {
    const icons = { 
        'landing': Home, 'dashboard': Home, 'courses': Book, 'humanResources': Users, 'childHealthServices': Hospital, 
        'skillsMentorship': ClipboardCheck, 'downloads': HardDrive
    };
    
    // Publishes the bar's height as --bottom-nav so pinned Save rows sit above it.
    const navRef = useRef(null);
    useEffect(() => {
        const el = navRef.current;
        if (!el) return undefined;
        const root = document.documentElement.style;
        const set = () => root.setProperty('--bottom-nav', `${el.offsetHeight}px`);
        set();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
        ro?.observe(el);
        return () => { ro?.disconnect(); root.removeProperty('--bottom-nav'); };
    }, []);

    return (
        <nav ref={navRef} className="md:hidden fixed bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 flex flex-col z-[60] shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
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
                            <span className="w-full text-center text-xs leading-tight truncate px-0.5 block">
                                {item.label}
                            </span>
                        </button>
                    )
                })}
            </div>
            
            <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-2 w-full border-t border-slate-700 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
                <AppCredit />
            </div>
        </nav>
    );
});

// Slide-out side menu (☰): who you are, every module you can open, and the
// app's settings in one place. The header keeps its own buttons as well.
function SideMenu({ open, onClose, user, roleLabel, levelLabel, modules, currentView, onNavigate, onProfile, onSync, onLanguage, onUpdate, onLogout, appVersion, isOffline, languageLabel }) {
    const { t } = useTranslation();
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
        window.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
    }, [open]);

    const go = (fn) => () => { onClose(); fn(); };
    const settings = [
        { icon: User, label: t('menu.profile', 'My profile'), action: onProfile },
        { icon: isOffline ? CloudOff : Cloud, label: isOffline ? t('menu.offline', 'Offline – sync status') : t('menu.sync', 'Data sync status'), action: onSync },
        { icon: Languages, label: languageLabel, action: onLanguage, keepOpen: true },
        { icon: RefreshCw, label: t('menu.updates', 'Check for updates'), action: onUpdate },
    ];

    return createPortal(
        <div className={`fixed inset-0 z-[100010] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
            <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
            <aside
                role="dialog"
                aria-label={t('menu.title', 'Menu')}
                className={`absolute inset-y-0 start-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'}`}
            >
                <div className="bg-gradient-to-br from-slate-800 to-sky-700 text-white px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
                    <button className="float-end p-1 text-white/80 hover:text-white" onClick={onClose} aria-label={t('menu.close', 'Close menu')}>
                        <X size={20} />
                    </button>
                    <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md mt-1">
                        <img src="/child.png" alt="" className="h-12 w-12 object-contain" />
                    </div>
                    <p className="text-lg font-bold mt-3 truncate">{user?.displayName || user?.email}</p>
                    {user?.displayName && <p className="text-xs text-white/80 truncate">{user?.email}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                        {levelLabel && <span className="rounded-full bg-white text-slate-800 px-2 py-0.5 font-bold">{levelLabel}</span>}
                        {roleLabel && <span className="rounded-full bg-white/20 px-2 py-0.5 font-semibold capitalize">{roleLabel}</span>}
                    </div>
                </div>
                <nav className="flex-1 overflow-y-auto py-2">
                    <button
                        onClick={go(() => onNavigate('landing'))}
                        className={`w-full flex items-center gap-4 px-5 py-2.5 text-start ${currentView === 'landing' ? 'bg-sky-50 text-sky-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <Home size={20} className="text-sky-600 shrink-0" /> {t('landing.modules.home', 'Home')}
                    </button>
                    {modules.map(({ view, label, icon: Icon, group }) => (
                        <button
                            key={view}
                            onClick={go(() => onNavigate(view))}
                            className={`w-full flex items-center gap-4 px-5 py-2.5 text-start ${currentView === view ? 'bg-sky-50 text-sky-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                            <span className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${TILE_TINTS[MODULE_GROUPS.find(g => g.id === group)?.tint]?.icon || ''}`}><Icon size={16} /></span>
                            <span className="truncate">{label}</span>
                        </button>
                    ))}
                    <div className="my-2 border-t border-slate-100" />
                    {settings.map(({ icon: Icon, label, action, keepOpen }) => (
                        <button
                            key={label}
                            onClick={keepOpen ? action : go(action)}
                            className="w-full flex items-center gap-4 px-5 py-2.5 text-start text-slate-700 hover:bg-slate-50"
                        >
                            <Icon size={20} className="text-sky-600 shrink-0" /> <span className="truncate">{label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button
                        onClick={go(onLogout)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-700 py-2.5 font-semibold hover:bg-red-100"
                    >
                        <LogOut size={18} /> {t('app.logout', 'Logout')}
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-3">{t('menu.version', 'App version')}: {appVersion}</p>
                </div>
            </aside>
        </div>,
        document.body
    );
}

function SplashScreen() {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 bg-surface flex flex-col items-center justify-center gap-6 text-center p-4 z-[9999]">
            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center p-1 shadow-xl animate-pulse"><img src="/child.png" alt={t('app_extra.header.logo_alt', 'NCHP Logo')} className="h-20 w-20 object-contain" /></div>
            <div>
                <h1 className="text-3xl font-bold text-slate-800">{t('app.title', 'National Child Health Program')}</h1>
                <p className="text-lg text-slate-500 mt-1">{t('app.subtitle', 'Program & Course Monitoring System')}</p>
            </div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mt-4"></div>
            <p className="text-slate-600 mt-4">{t('app.loading_system', 'Loading application, please wait...')}</p>
        </div>
    );
}

// --- FOREGROUND PUSH POPUP ---------------------------------------------
// Portaled to document.body on purpose. Rendered inside the app tree, an
// ancestor with transform / filter / backdrop-filter / perspective becomes the
// containing block for `position: fixed`, and the overlay re-anchors to that
// element instead of the viewport, so the box lands off-centre.
// It also uses role="dialog", not role="alert": the mobile <style> block below
// forces `bottom: 80px` on [role="alert"], which shortens an inset-0 overlay
// from the bottom and lifts anything centred inside it by ~40px.
function PushPopup({ open, title, body, onClose, onPrimary, primaryLabel, secondaryLabel }) {
    const { t } = useTranslation();
    // In a WebView, 100vh is the LAYOUT viewport: it stays tall when the
    // keyboard opens or the URL bar collapses, so centring against it puts the
    // box below the fold. Measure the visual viewport instead.
    const [vp, setVp] = useState(() => ({ height: typeof window === 'undefined' ? 0 : window.innerHeight, top: 0 }));

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) {
            const onResize = () => setVp({ height: window.innerHeight, top: 0 });
            window.addEventListener('resize', onResize);
            return () => window.removeEventListener('resize', onResize);
        }
        const update = () => setVp({ height: vv.height, top: vv.offsetTop });
        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-popup-title"
            onClick={onClose}
            style={{
                position: 'fixed', left: 0, right: 0, top: vp.top, height: vp.height,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'calc(env(safe-area-inset-top, 0px) + 16px) calc(env(safe-area-inset-right, 0px) + 16px) calc(env(safe-area-inset-bottom, 0px) + 16px) calc(env(safe-area-inset-left, 0px) + 16px)',
                background: 'rgba(15, 23, 42, 0.55)',
                zIndex: 100010,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 380, maxHeight: '100%', overflowY: 'auto', background: '#fff', borderRadius: 14, boxShadow: '0 20px 45px rgba(15,23,42,0.25)' }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 0' }}>
                    <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '50%', background: '#e0f2fe', color: '#0369a1' }}>
                        <Bell size={18} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 id="push-popup-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{title}</h2>
                        {body && <p style={{ margin: '6px 0 0', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>{body}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label={t('app_extra.buttons.close', 'Close')} style={{ flexShrink: 0, background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#94a3b8' }}>
                        <X size={18} />
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 10, padding: 20 }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 16px', fontSize: 14, fontWeight: 600, color: '#334155', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 9, cursor: 'pointer' }}>
                        {secondaryLabel || t('app_extra.push.dismiss', 'Dismiss')}
                    </button>
                    {primaryLabel && onPrimary && (
                        <button type="button" onClick={onPrimary} style={{ flex: 1, padding: '10px 16px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#0284c7', border: '1px solid #0284c7', borderRadius: 9, cursor: 'pointer' }}>
                            {primaryLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

export default function App() {
    const { t, i18n } = useTranslation();
    
    // --- ADDED REFS FOR FCM NOTIFICATION QUEUE ---
    const notificationQueue = useRef([]);
    const notificationTimer = useRef(null);
    const [actionAlert, setActionAlert] = useState(null);

    const {
        appVersion,
        isDownloadingAppUpdate,
        appUpdateProgress,
        handleManualUpdateCheck,
        AppUpdateModals,
        // Header update button: green when a check confirmed the app is
        // current, red when a bundle or a new APK is waiting, spinner while
        // checking or downloading, grey before the first check / when offline.
        UpdateButton,
    } = useAppUpdate();

    usePushNotifications(); 

    const [isFileDownloading, setIsFileDownloading] = useState(false);
    const [fileDownloadProgress, setFileDownloadProgress] = useState(0);

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
    const [sideMenuOpen, setSideMenuOpen] = useState(false);
    // Where the sticky top bar ends, as --app-top, so page tabs, filter rows
    // and toolbars can stick just under it.
    const headerRef = useRef(null);
    const headerElRef = useRef(null);
    const headerObserverRef = useRef(null);
    useEffect(() => {
        const el = headerRef.current;
        const set = () => {
            const top = el ? (el.classList.contains('top-10') ? 40 : 0) + el.offsetHeight : 0;
            document.documentElement.style.setProperty('--app-top', `${top}px`);
        };
        if (headerElRef.current !== el) {
            headerObserverRef.current?.disconnect();
            headerElRef.current = el;
            if (el && typeof ResizeObserver !== 'undefined') {
                headerObserverRef.current = new ResizeObserver(set);
                headerObserverRef.current.observe(el);
            }
        }
        set();
    });
    useEffect(() => () => headerObserverRef.current?.disconnect(), []);

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editDisplayName, setEditDisplayName] = useState('');

    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [pendingSyncItems, setPendingSyncItems] = useState([]);

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
                        clearPendingSyncQueue();
                    } catch (e) { console.error("Error waiting for pending writes during sync:", e); } finally { setIsSyncing(false); }
                }
            });
        };
        setupNetworkListener();
        return () => { if (networkListener) networkListener.remove(); };
    }, []);

    useEffect(() => {
        setPendingSyncItems(getPendingSyncQueue());
        const handleQueueUpdate = () => setPendingSyncItems(getPendingSyncQueue());
        window.addEventListener('syncQueueUpdated', handleQueueUpdate);
        return () => window.removeEventListener('syncQueueUpdated', handleQueueUpdate);
    }, []);

    // =========================================================================
    // --- REMOTE CACHE WIPE LISTENER (Triggered by Admin Dashboard) ---
    // =========================================================================
    useEffect(() => {
        // The inner onSnapshot used to be torn down by returning a function from
        // the onAuthStateChanged callback. Firebase ignores that return value, so
        // every auth event (including silent hourly token refreshes) stacked
        // another listener on users/{uid}. Several listeners then raced the
        // forceCacheReset check below, and each one that read the old
        // last_forced_reset fired its own wipe + reload.
        let unsubscribeDoc = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (unsubscribeDoc) { unsubscribeDoc(); unsubscribeDoc = null; }
            if (!user) return;

            const userRef = doc(db, 'users', user.uid);
            unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
                if (!docSnap.exists()) return;
                const data = docSnap.data();
                if (!data.forceCacheReset) return;

                const remoteResetTime = data.forceCacheReset.toMillis();
                const localResetTime = parseInt(localStorage.getItem('last_forced_reset') || '0', 10);
                if (remoteResetTime <= localResetTime) return;

                console.warn("⚠️ Admin ordered a local data wipe. Wiping now...");

                // Claim the reset BEFORE doing any work, so a duplicate listener
                // or a second tab cannot run the same wipe again.
                localStorage.setItem('last_forced_reset', remoteResetTime.toString());

                // --- SELECTIVE WIPE ---
                // localStorage.clear() was the cause of the random sign-outs. When
                // IndexedDB is unavailable (Capacitor's Android WebView, WKWebView
                // under storage partitioning, private browsing) the Firebase Auth
                // SDK falls back to browserLocalPersistence and keeps the session
                // under a "firebase:authUser:*" key in localStorage. Clearing
                // everything deleted that key, and the reload two lines later
                // dropped the user on the sign-in screen.
                //
                // It also deleted app_version, which made main.jsx believe a new
                // build had shipped on the very next boot and run a second full
                // cache wipe + reload, and it deleted the backup_role_* entries
                // that protect a user's role when the profile read fails.
                const PRESERVE_EXACT = ['last_forced_reset', 'app_version'];
                const PRESERVE_PREFIXES = [
                    'firebase:authUser',      // Auth session (localStorage fallback)
                    'firebase:persistence',
                    'firebase:redirectEvent',
                    'backup_role_',
                    'backup_roles_',
                    'backup_perms_',
                    'backup_states_',
                    'backup_localities_'
                ];

                Object.keys(localStorage).forEach((k) => {
                    if (PRESERVE_EXACT.includes(k)) return;
                    if (PRESERVE_PREFIXES.some(p => k.startsWith(p))) return;
                    localStorage.removeItem(k);
                });

                notify("قام مدير النظام بتحديث بيانات التطبيق وإصلاح الأخطاء. سيتم إعادة تحميل التطبيق الآن.\n\n(The administrator has refreshed your app data to fix errors. The app will now reload.)");

                window.location.reload();
            });
        });

        return () => {
            if (unsubscribeDoc) unsubscribeDoc();
            unsubscribeAuth();
        };
    }, []);

    const {
        courses: rawCourses, facilitators: rawFacilitators,
        funders, federalCoordinators, stateCoordinators, localityCoordinators, healthFacilities, participantTests, 
        fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators,
        fetchHealthFacilities, fetchSkillMentorshipSubmissions, fetchParticipantTests,
        mergeIntoCache, participants: rawParticipants, skillMentorshipSubmissions, isLoading: dataLoading
    } = useDataCache();

    const allCourses = useMemo(() => (rawCourses || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true"), [rawCourses]);
    const allFacilitators = useMemo(() => (rawFacilitators || []).filter(f => f.isDeleted !== true && f.isDeleted !== "true"), [rawFacilitators]);

    const { user, authLoading } = useAuth();
    const [userStates, setUserStates] = useState([]);
    const [userLocalities, setUserLocalities] = useState([]);

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
            setToast({ show: true, message: t('app_extra.toast.profile_updated', 'Profile updated successfully!'), type: 'success' });
            setIsEditingProfile(false);
            window.location.reload(); 
        } catch (error) {
            setToast({ show: true, message: t('app_extra.toast.profile_update_failed', 'Failed to update profile: {{message}}', { message: error.message }), type: 'error' });
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
    const [permissionsError, setPermissionsError] = useState(false);
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
    const [publicSupervisionFormId, setPublicSupervisionFormId] = useState(null);
    const [submissionType, setSubmissionType] = useState(null);
    const [sharedReportData, setSharedReportData] = useState(null);
    const [sharedViewError, setSharedViewError] = useState(null);
    const [sharedViewRequiresLogin, setSharedViewRequiresLogin] = useState(false);

    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [itemToShare, setItemToShare] = useState(null);
    const [shareType, setShareType] = useState('course');
    
    // Set when claude.ai sends somebody here to approve a connection.
    const [connectClaudeId, setConnectClaudeId] = useState(null);
    const [claudeChatOpen, setClaudeChatOpen] = useState(false);
    const [dataAssistant, setDataAssistant] = useState({ loaded: false, open: false });
    const openDataAssistant = useCallback(() => setDataAssistant({ loaded: true, open: true }), []);
    const closeDataAssistant = useCallback(() => setDataAssistant((s) => ({ ...s, open: false })), []);
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
    
    // --- ADDED FOR PUBLIC PROJECT DASHBOARD SHARED LINKS ---
    const [isPublicProjectsView, setIsPublicProjectsView] = useState(false);

    const [operationCounts, setOperationCounts] = useState({ reads: 0, writes: 0 });
    const [isMonitorVisible, setIsMonitorVisible] = useState(true);

    const historyInitialized = useRef(false);
    const isPopStateNavigation = useRef(false);
    const initialViewIsSet = useRef(false);
    // Page addresses (see utils/pageAddress.js). `pageRestored` turns the
    // address writer on once the start-up page has been read from the address.
    const [pageRestored, setPageRestored] = useState(false);
    const navigateRef = useRef(null);
    const applyPageRef = useRef(null);
    const formDirtyRef = useRef(false);
    const confirmLeaveRef = useRef(null);
    const lastEntryRef = useRef(null);
    const viewRef = useRef('landing');
    const lastPageRef = useRef(null);
    const hasWrittenPageRef = useRef(false);
    const replaceNextPageRef = useRef(false);

    const handleFileDownloadAndOpen = (url, customFileName = null) => {
        // Offline: one quiet line instead of a download bar that then fails
        // with a native error.
        if (['offline', 'no-internet'].includes(getConnectivity().status)) {
            setToast({ show: true, message: t('app.download_offline', 'No internet right now, so this file cannot be downloaded. Try again when you are back online.'), type: 'info' });
            return;
        }
        downloadAndOpenFile(url, customFileName, {
            onStart: () => { setIsFileDownloading(true); setFileDownloadProgress(0); },
            onSuccess: () => setToast({ show: true, message: t('app_extra.toast.download_opening', 'Download complete. Opening...'), type: 'success' }),
            onError: (error) => {
                notify(t('app_extra.toast.native_error', 'NATIVE ERROR: {{message}}', { message: error.message || JSON.stringify(error) }));
                setToast({ show: true, message: t('app_extra.toast.open_failed', 'Failed to open automatically.'), type: 'error' });
            },
            onFinally: () => { setIsFileDownloading(false); setFileDownloadProgress(0); }
        });
    };

    useEffect(() => { if (!authLoading && user) initializeUsageTracking(); }, [authLoading, user]);

    useEffect(() => {
      const handleOperation = (event) => {
        const { type, count } = event.detail;
        setOperationCounts(prev => ({ ...prev, [type === 'read' ? 'reads' : 'writes']: (prev[type === 'read' ? 'reads' : 'writes'] || 0) + count }));
      };
      window.addEventListener('firestoreOperation', handleOperation);
      return () => { window.removeEventListener('firestoreOperation', handleOperation); };
    }, []);

    // --- FOREGROUND PUSH: NATIVE + WEB, ONE PATH ---
    // The old version used getMessaging()/onMessage() from firebase/messaging.
    // That is the WEB sdk: inside the Capacitor WebView isSupported() resolves
    // false, so setupForegroundListener() returned immediately and NOTHING was
    // ever shown in the mobile app. Android also suppresses the tray
    // notification while the app is in the foreground, so the user saw nothing
    // at all. usePushEvents() is fed by both transports in usePushNotifications.
    usePushEvents((event) => {
        const { title, body, data, tapped } = event;

        // A tapped notification goes straight to its destination, no popup.
        if (tapped && data?.actionView) {
            const params = data.actionParams ? JSON.parse(data.actionParams) : {};
            navigate(data.actionView, params);
            return;
        }

        // Actionable notification -> popup with a button.
        if (data?.actionView) {
            setActionAlert({ title, body, data });
            return;
        }

        // Everything else is queued and debounced into a single toast.
        notificationQueue.current.push({ title, body });

        if (notificationTimer.current) clearTimeout(notificationTimer.current);

        notificationTimer.current = setTimeout(() => {
            const queueLength = notificationQueue.current.length;

            if (queueLength === 1) {
                const single = notificationQueue.current[0];
                setToast({ show: true, message: `${single.title}: ${single.body}`, type: 'info' });
            } else if (queueLength > 1) {
                setToast({
                    show: true,
                    message: t('app_extra.toast.notifications_many', 'You have {{n}} new notifications (e.g., {{title}})', { n: queueLength, title: notificationQueue.current[0].title }),
                    type: 'info'
                });
            }

            notificationQueue.current = [];
        }, 1000);
    });

    // The debounce timer still needs clearing on unmount.
    useEffect(() => () => {
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
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

            setIsPublicProjectsView(false);

            setPublicSupervisionFormId(null);

            // Check if the current URL parameters match a generated shared Project Tracker link
            const searchParamsPath = new URLSearchParams(window.location.search);
            // Somebody adding this server as a connector in claude.ai is sent
            // here to approve it. Checked before every public route: this one
            // needs them signed in, so it must not be mistaken for a shared
            // link that does not.
            const connectRequest = searchParamsPath.get('connect_claude');
            if (connectRequest) { setConnectClaudeId(connectRequest); return; }

            const publicProjectsMatch = path.match(/^\/public\/projects\/?$/);
            const isSharedProjectQuery = searchParamsPath.get('view') === 'dashboard' || searchParamsPath.get('tab') === 'active' || searchParamsPath.get('tab') === 'completed' || searchParamsPath.has('project');

            if (publicProjectsMatch || (path === '/' && isSharedProjectQuery)) {
                setIsPublicProjectsView(true);
                return;
            }

            const publicMeetingMatch = path.match(/^\/public\/meeting\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicMeetingMatch && publicMeetingMatch[1]) {
                setIsPublicMeetingView(true); setPublicMeetingId(publicMeetingMatch[1]); setPublicViewLoading(true);
                
                const searchParams = new URLSearchParams(window.location.search);
                setPublicMeetingTargetDate(searchParams.get('date'));
                
                getUnitMeetingById(publicMeetingMatch[1], 'server')
                    .then(data => { if (!data) throw new Error("Meeting not found."); setPublicMeetingData(data); })
                    .catch(err => setSharedViewError(err.message))
                    .finally(() => setPublicViewLoading(false));
                return;
            }

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
                        // Cached for the session. These links are opened and reopened all
                        // day on a phone at a clinic, and the course and its roster do
                        // not change between openings — re-downloading both every time
                        // is what made the page slow to appear on a weak connection.
                        const [courseData, participantData] = await Promise.all([ getCachedCourse(courseId), getCachedParticipants(courseId) ]);
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

            const publicSupervisionMatch = path.match(/^\/public\/supervision\/([a-zA-Z0-9_]+)\/?$/);
            if (publicSupervisionMatch) { setPublicSupervisionFormId(publicSupervisionMatch[1]); return; }

            const publicMentorshipMatch = path.match(/^\/mentorship\/submit\/([a-zA-Z0-9_]+)\/?$/);
            if (publicMentorshipMatch && publicMentorshipMatch[1]) { setPublicMentorshipProps({ serviceType: publicMentorshipMatch[1] }); return; }

            const facilitatorAppMatch = path.match(/^\/public\/facilitator-application\/?$/);
            if (facilitatorAppMatch) { setIsPublicSubmissionView(true); setSubmissionType('facilitator-application'); return; }

            const teamAppMatch = path.match(/^\/public\/team-member-application\/?$/);
            if (teamAppMatch) { setIsPublicSubmissionView(true); setSubmissionType('team-member-application'); return; }
            
            const publicRegistrationMatch = path.match(/^\/public\/register\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicRegistrationMatch && publicRegistrationMatch[1]) { setIsPublicRegistrationView(true); setPublicRegistrationCourseId(publicRegistrationMatch[1]); return; }

            const publicExercisesMatch = path.match(/^\/public\/exercises\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicExercisesMatch && publicExercisesMatch[1]) { setPublicViewType('onlineExercises'); setPublicViewData({ courseId: publicExercisesMatch[1] }); return; }

            const publicTestMatch = path.match(/^\/public\/test\/course\/([a-zA-Z0-9_-]+)\/?$/);
            if (publicTestMatch && publicTestMatch[1]) {
                setIsPublicTestView(true);
                const courseId = publicTestMatch[1];
                const searchParams = new URLSearchParams(window.location.search);
                setPublicTestType(searchParams.get('type'));
                setPublicTestLoading(true);
                const fetchData = async () => {
                    try {
                        // The course and roster come from the session cache; the tests do
                        // not, because a participant sitting a test needs to see whether
                        // their own result has already been recorded.
                        const [courseData, participantData, testData] = await Promise.all([ getCachedCourse(courseId), getCachedParticipants(courseId), listParticipantTestsForCourse(courseId, { source: 'server' }) ]);
                        if (!courseData) throw new Error('Course not found.'); if (!participantData) throw new Error('Participants not found.');
                        if (!['ICCM', 'EENC', 'EmONC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management', 'Comprehensive Package For Community Midwives'].includes(courseData.course_type)) { throw new Error('Test forms are only available for selected courses.'); }
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
            initialViewIsSet.current = true;
            // Open the page the address names, so refresh and opened links
            // land where they point. A ?view= link is left to the deep-link
            // effect below.
            const linked = new URLSearchParams(window.location.search).get('view');
            const page = settlePage(pageFromLocation(path, window.location.search));
            if (linked) navigateRef.current?.(linked);
            else if (page && page.view !== 'landing') applyPageRef.current?.(page);
            else setView("landing");
            setPageRestored(true);
        }
    }, [user, permissionsLoading]);

    // =========================================================================
    // THE NATIVE-SAFE ROLE SYNC (WITH RETRY LOOP)
    // =========================================================================
    useEffect(() => {
        let isMounted = true;
        // Set once the live listener below has applied a server-confirmed
        // profile; nothing slower may then clear the role it set.
        let lastAppliedProfile = null;

        // A profile is only believable when it names a role. The FCM token
        // save is a setDoc(users/{uid}, { fcmToken }, { merge: true }); when
        // this device has no copy of the profile cached (a fresh sign-in, a
        // cleared cache), that write leaves a local document holding nothing
        // but the token. Reading it back while the server was out of reach
        // defaulted the role to 'user', and a super user saw a standard view.
        const hasRole = (data) => !!(data && (data.role || data.Role || (Array.isArray(data.roles) && data.roles.length > 0)));

        // Applies a profile document to state and refreshes the local backup.
        const applyProfile = (data, fromCache) => {
            const rawRole = data.role || data.Role || (data.roles && data.roles[0]) || 'user';
            const newRole = typeof rawRole === 'string' ? rawRole.toLowerCase() : 'user';
            const newRoles = data.roles && Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : [newRole];

            const ALL_PERMISSIONS_MINIMAL = ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});
            // A profile created by the Cloud Function starts with an empty
            // permissions map, so fall back to the role's defaults.
            const storedPerms = data.permissions && Object.keys(data.permissions).length > 0
                ? data.permissions
                : (DEFAULT_ROLE_PERMISSIONS[newRole] || DEFAULT_ROLE_PERMISSIONS.user);
            const newPermissionsData = applyDerivedPermissions({ ...ALL_PERMISSIONS_MINIMAL, ...storedPerms });

            const newStates = data.assignedState ? [data.assignedState] : [];
            const newLocalities = data.assignedLocality ? [data.assignedLocality] : [];

            if (!fromCache) {
                try {
                    localStorage.setItem(`backup_role_${user.uid}`, newRole);
                    localStorage.setItem(`backup_roles_${user.uid}`, JSON.stringify(newRoles));
                    localStorage.setItem(`backup_perms_${user.uid}`, JSON.stringify(newPermissionsData));
                    localStorage.setItem(`backup_states_${user.uid}`, JSON.stringify(newStates));
                    localStorage.setItem(`backup_localities_${user.uid}`, JSON.stringify(newLocalities));
                } catch (e) {
                    console.warn('[backup] could not save profile locally:', e?.message);
                }
            }

            setUserRole(newRole);
            setUserRoles(newRoles);
            setUserPermissions(newPermissionsData);
            setUserStates(newStates);
            setUserLocalities(newLocalities);
        };

        const checkUserRoleAndPermissions = async () => {
            if (!user) {
                setUserRole(null); setUserRoles([]); setUserPermissions({});
                setUserStates([]); setUserLocalities([]);
                setPermissionsLoading(false);
                return;
            }

            setPermissionsLoading(true);
            setPermissionsError(false);

            // Polls for the profile the createUserProfile trigger is writing.
            // Returns its data, or null if it has not appeared in time.
            const waitForProfile = async (ref) => {
                for (let attempt = 0; attempt < 5; attempt += 1) {
                    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
                    try {
                        const snap = await getDocFromServer(ref);
                        if (snap.exists()) return snap.data();
                    } catch (e) {
                        console.warn('[profile] retry failed:', e?.message);
                    }
                }
                return null;
            };

            // 1. Instantly load from local backups to prevent UI flicker.
            // These parses sit OUTSIDE the try/finally below, so a truncated
            // localStorage value (quota eviction, an interrupted write) used to
            // throw here and skip setPermissionsLoading(false) — leaving the app
            // on its loading spinner forever, on every launch, with no way out
            // on the Android build. readBackup() never throws.
            const backupRole = localStorage.getItem(`backup_role_${user.uid}`);
            if (backupRole) {
                setUserRole(backupRole);
                setUserRoles(readBackup(`backup_roles_${user.uid}`, [backupRole]));
                setUserPermissions(readBackup(`backup_perms_${user.uid}`, {}));
                setUserStates(readBackup(`backup_states_${user.uid}`, []));
                setUserLocalities(readBackup(`backup_localities_${user.uid}`, []));
                // The saved profile is enough to open the app straight away;
                // the server copy below refreshes it in the background.
                setPermissionsLoading(false);
            }

            try {
                // --- CRITICAL NATIVE FIX: Force Token Sync ---
                if (Capacitor.isNativePlatform()) {
                    try {
                        await user.getIdToken(true);
                    } catch (tokenErr) {
                        console.warn("Manual token refresh skipped or failed:", tokenErr);
                    }
                }

                const userRef = doc(db, "users", user.uid);
                let userSnap;
                let readFromServer = false;

                // Retry loop to handle any lingering network/bridge delays.
                //
                // getDocFromServer is used first, on purpose. A plain getDoc()
                // against a persistentLocalCache silently falls back to the cache,
                // and a profile this device has never synced comes back as a
                // perfectly valid snapshot with exists() === false. Downstream that
                // was read as "this user has no profile", which triggered the
                // default-profile write and permanently demoted real accounts.
                let retries = 3;
                while (retries > 0) {
                    try {
                        userSnap = await getDocFromServer(userRef);
                        readFromServer = true;
                        break;
                    } catch (e) {
                        retries -= 1;
                        if (retries === 0) break;
                        await new Promise(resolve => setTimeout(resolve, 600));
                    }
                }

                // Offline or the server is unreachable: read the cache, but mark it
                // so nothing below is allowed to write.
                if (!readFromServer) {
                    try {
                        userSnap = await getDoc(userRef);
                    } catch (e) {
                        throw e;
                    }
                }

                if (!isMounted) return;

                if (userSnap && userSnap.exists()) {
                    const fromCache = !readFromServer || !!userSnap.metadata?.fromCache;
                    if (!hasRole(userSnap.data())) {
                        // Keep whatever is showing; the live listener below
                        // applies the real profile as soon as the server answers.
                        console.warn("Profile read has no role (partial local copy). Keeping the current role.");
                        if (!backupRole && !lastAppliedProfile) setPermissionsError(true);
                    } else if (fromCache && backupRole) {
                        // The saved backup came from the server; the cached copy
                        // is never newer than it, because every server snapshot
                        // refreshes the backup. Don't let a cache read change it.
                    } else {
                        applyProfile(userSnap.data(), fromCache);
                    }
                } else if (userSnap && !userSnap.exists()) {
                    // --- GUARD AGAINST SILENT DEMOTION ---
                    // A "missing" profile is only believable if the server said so.
                    // Network.getStatus() reports the OS radio, not whether the
                    // Firestore stream is up, so it was never sufficient evidence:
                    // a super_user on a flaky connection got role: 'user' written
                    // over their real profile with { merge: true }, which destroys
                    // role, roles and permissions server-side for every device.
                    if (!readFromServer || userSnap.metadata?.fromCache) {
                        console.warn("Profile read was not server-confirmed. Keeping existing role, not creating a default profile.");
                        return;
                    }

                    // --- THE CLIENT NO LONGER CREATES ITS OWN PROFILE ---
                    // Writing role/roles/permissions from the browser only worked
                    // because the rules let a user write their own profile, which
                    // also let any signed-in user grant themselves super_user from
                    // the console. The createUserProfile Cloud Function writes it
                    // now, and firestore.rules refuses every client write to those
                    // fields. That trigger fires just after the account is created,
                    // so on a first sign-in the document can be a second or two
                    // behind — wait for it rather than assuming anything.
                    const profile = await waitForProfile(userRef);
                    if (!isMounted) return;

                    if (profile) {
                        applyProfile(profile);
                    } else if (!lastAppliedProfile) {
                        console.warn("Profile has not appeared yet. Not assuming a role.");
                        setUserRole(null); setUserRoles([]); setUserPermissions({});
                        setUserStates([]); setUserLocalities([]);
                        setPermissionsError(true);
                    }
                }
            } catch (error) {
                console.warn("Role fetch completely failed after retries:", error);
                if (isMounted && !backupRole && !lastAppliedProfile) {
                    // Previously this granted the 'user' role, so a failed read
                    // looked identical to a real demotion and the person saw their
                    // level silently drop. A failed read is not evidence of a role.
                    // Leave the role unresolved so the UI can say "couldn't load
                    // your permissions, retry" instead of quietly showing a
                    // standard-user view to a manager.
                    setUserRole(null);
                    setUserRoles([]);
                    setUserPermissions({});
                    setUserStates([]);
                    setUserLocalities([]);
                    setPermissionsError(true);
                }
            } finally {
                if (isMounted) setPermissionsLoading(false);
            }
        };

        checkUserRoleAndPermissions();

        // Live, server-confirmed profile. Repairs a role that could not be read
        // at sign-in or after a reload (flaky network, slow start), and applies
        // a role an administrator changes without needing a restart. Cache-only
        // snapshots are ignored, so a stale or partial local copy never demotes.
        const unsubscribeProfile = user ? onSnapshot(doc(db, "users", user.uid), (snap) => {
            if (!isMounted || snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
            if (!snap.exists()) return;
            const data = snap.data();
            if (!hasRole(data)) return;
            const key = JSON.stringify([data.role, data.Role, data.roles, data.permissions, data.assignedState, data.assignedLocality]);
            if (key === lastAppliedProfile) return;
            lastAppliedProfile = key;
            applyProfile(data, false);
            setPermissionsError(false);
            setPermissionsLoading(false);
        }, (err) => console.warn('[profile] live listener stopped:', err?.message)) : null;

        return () => { isMounted = false; if (unsubscribeProfile) unsubscribeProfile(); };
    }, [user]);

    useEffect(() => { if (!user) { initialViewIsSet.current = false; setPageRestored(false); hasWrittenPageRef.current = false; } }, [user]);

    // Browser back/forward: reopen the page that history entry was written for.
    useEffect(() => {
        const handlePopState = (event) => {
            if (!hasWrittenPageRef.current) return;
            // Leaving a half-filled form: put the form's history entry back,
            // then ask, and step back again only if they choose to leave.
            if (formDirtyRef.current) {
                const entry = lastEntryRef.current;
                if (entry) window.history.pushState(entry.state, '', entry.url);
                confirmLeaveRef.current?.().then((leave) => { if (leave) window.history.back(); });
                return;
            }
            const page = settlePage(event.state?.chmPage || pageFromLocation(window.location.pathname, window.location.search));
            if (!page) return;
            const last = lastPageRef.current;
            if (last && !isNewEntry(last, page) && (last.participant || null) === (page.participant || null)) return;
            isPopStateNavigation.current = true;
            applyPageRef.current?.(page);
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
        // The main menu's greeting card counts courses, participants and mentorship visits.
        // Coordinators tell us the person's unit (IMNCI, newborn...), which narrows the numbers.
        // Facilities give the coverage card.
        if (view === 'landing') { fetchCourses(); fetchParticipants(); fetchSkillMentorshipSubmissions(); fetchCoordinators(); fetchHealthFacilities(); }
    }, [view, isSharedView, user, fetchCourses, fetchParticipants, fetchFacilitators, fetchFunders, fetchCoordinators, fetchHealthFacilities, fetchSkillMentorshipSubmissions, isPublicMentorshipDashboardView]);

    // The offline cache only holds what THIS device last read. Tests and scores
    // entered on another phone (or a cache that never held this course's tests,
    // which comes back as an empty list rather than a miss) stay invisible until
    // the server is asked, so every cache hit is followed by a server refresh.
    const refreshCourseDetailsFromServer = useCallback(async (courseId) => {
        if (!courseId || !isOnline()) return;
        try {
            const [serverParticipants, serverTests] = await Promise.all([
                listAllParticipantsForCourse(courseId, { source: 'server' }),
                listParticipantTestsForCourse(courseId, { source: 'server' })
            ]);
            const activeParticipants = (serverParticipants || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeTests = (serverTests || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
            setCourseDetailsCache(prev => ({ ...prev, [courseId]: { ...(prev[courseId] || {}), participants: activeParticipants, participantTests: activeTests } }));
        } catch (error) {
            console.error("Server refresh of course participants/tests failed:", error);
        }
    }, []);

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
                        refreshCourseDetailsFromServer(selectedCourseId);
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
    }, [selectedCourseId, courseDetailsCache, courseDetailsLoading, refreshCourseDetailsFromServer]); 

    const canSeeAllData = useMemo(() => permissions.canUseSuperUserAdvancedFeatures || permissions.canUseFederalManagerAdvancedFeatures, [permissions]);

    const filteredCourses = useMemo(() => {
        if (!allCourses) return [];
        const locPerm = permissions.manageLocation;

        if (locPerm === 'user_state' || locPerm === 'user_locality') {
            let filtered = allCourses;
            if (userStates && userStates.length > 0) {
                const userStateSet = new Set(userStates);
                filtered = filtered.filter(c => userStateSet.has(c.state));
            } else { return []; }

            if (locPerm === 'user_locality') {
                if (userLocalities && userLocalities.length > 0) {
                    filtered = filtered.filter(c => userLocalities.includes(c.locality));
                } else { return []; }
            }
            return filtered;
        }
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
            } else { return []; }

            if (locPerm === 'user_locality') {
                if (userLocalities && userLocalities.length > 0) {
                    filtered = filtered.filter(f => userLocalities.includes(f.currentLocality));
                } else { return []; }
            }
            return filtered;
        }
        return allFacilitators;
    }, [allFacilitators, userStates, userLocalities, permissions.manageLocation]);


    const fetchPendingSubmissions = useCallback(async () => {
        if (!permissions.canApproveSubmissions) return;
        setIsSubmissionsLoading(true);
        try { const submissions = await listPendingFacilitatorSubmissions(); setPendingSubmissions(submissions); } 
        catch (error) { setToast({ show: true, message: t('app_extra.toast.load_submissions_failed', 'Failed to load submissions.'), type: 'error' }); } 
        finally { setIsSubmissionsLoading(false); }
    }, [permissions.canApproveSubmissions, t]);

    useEffect(() => { if (view === 'humanResources' && activeHRTab === 'facilitators' && permissions.canApproveSubmissions) fetchPendingSubmissions(); }, [view, activeHRTab, permissions.canApproveSubmissions, fetchPendingSubmissions]);

    const selectedCourse = useMemo(() => (allCourses || []).find(c => c.id === selectedCourseId) || null, [allCourses, selectedCourseId]);
    // The main menu's numbers. The last ones worked out are kept on the
    // device, so the menu shows them at once and refreshes them as data loads.
    const homeStatsKey = user?.uid ? `home_stats_${user.uid}` : null;
    const savedHomeStats = useMemo(() => (homeStatsKey ? readBackup(homeStatsKey, null) : null), [homeStatsKey]);
    const freshHomeStats = useMemo(() => {
        if (view !== 'landing' || !user) return null;
        const level = levelFromPermissions(permissions);
        const stats = computeHomeStats({
            level, unit: userHRProfile?.unit,
            states: userStates, localities: userLocalities,
            courses: rawCourses, participants: rawParticipants, sessions: skillMentorshipSubmissions, facilitators: rawFacilitators,
        });
        const coverage = computeCoverage({ level, states: userStates, localities: userLocalities, facilities: healthFacilities });
        return { ...stats, coverage };
    }, [view, user, permissions, userHRProfile, userStates, userLocalities, rawCourses, rawParticipants, skillMentorshipSubmissions, rawFacilitators, healthFacilities]);
    const homeStats = useMemo(() => {
        if (!freshHomeStats) return null;
        const merged = { ...freshHomeStats };
        if (savedHomeStats) {
            Object.keys(savedHomeStats).forEach((k) => { if (merged[k] === null || merged[k] === undefined) merged[k] = savedHomeStats[k]; });
        }
        // A number whose data failed to load shows a dash instead of a placeholder forever.
        const busy = {
            courses: !!dataLoading?.courses, participants: !!dataLoading?.participants,
            visits: !!dataLoading?.skillMentorshipSubmissions, facilitators: !!dataLoading?.facilitators,
            facilities: !!dataLoading?.healthFacilities,
        };
        return { ...merged, busy };
    }, [freshHomeStats, savedHomeStats, dataLoading]);
    useEffect(() => {
        if (!homeStatsKey || !freshHomeStats) return;
        const known = Object.fromEntries(Object.entries(freshHomeStats).filter(([, v]) => v !== null && v !== undefined));
        if (Object.keys(known).length === 0) return;
        try {
            const prev = readBackup(homeStatsKey, {}) || {};
            localStorage.setItem(homeStatsKey, JSON.stringify({ ...prev, ...known }));
        } catch { /* the menu still works without the saved copy */ }
    }, [homeStatsKey, freshHomeStats]);
    // A course page opened from an address or history needs the course list.
    useEffect(() => {
        if (user && selectedCourseId && !selectedCourse) fetchCourses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, selectedCourseId]);

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
            'projects': permissions.canUseFederalManagerAdvancedFeatures,
'meetings': permissions.canUseFederalManagerAdvancedFeatures,


 'planning': permissions.canUseFederalManagerAdvancedFeatures, 'localityPlan': permissions.canViewLocalityPlan,
            'supplyManagement': permissions.canViewSupplyChain,
            'supervision': permissions.canViewSupervision,
            'onlineCourses': permissions.canViewOnlineCourses,
            'downloads': Capacitor.isNativePlatform(), 'about': true, 
        };

        if (user && !viewPermissions[newView]) {
            console.warn(`Access denied to view: ${newView}. Redirecting to landing.`);
            setView('landing'); return false;
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

        if (['courses', 'humanResources', 'dashboard', 'admin', 'landing', 'skillsMentorship', 'projects', 'planning', 'localityPlan', 'supplyManagement', 'supervision', 'onlineCourses', 'downloads', 'about'].includes(newView)) {
            setSelectedCourseId(null); setSelectedParticipantId(null); setFinalReportCourse(null);
            if (['dashboard', 'admin', 'landing', 'skillsMentorship', 'projects', 'planning', 'localityPlan', 'supplyManagement', 'supervision', 'onlineCourses', 'downloads', 'about'].includes(newView)) setActiveCourseType(null);
        }
        if ((view === 'observe' || view === 'participantReport') && !['observe', 'participantReport'].includes(newView)) setSelectedParticipantId(null);
        return true;
    }, [view, selectedCourseId, selectedParticipantId, permissions, user, isCourseActive]);
    navigateRef.current = navigate;
    viewRef.current = view;

    // Opens a page described by an address or history entry.
    const applyPage = useCallback((page) => {
        const go = navigateRef.current;
        let opened;
        if (page.view === 'courses') { opened = go('courses'); if (opened) setActiveCoursesTab(page.tab || 'courses'); }
        else if (page.view === 'humanResources') { opened = go('humanResources'); if (opened) setActiveHRTab(page.tab || 'facilitators'); }
        else opened = go(page.view, page.facilitator ? { openFacilitatorReport: page.facilitator } : {});
        if (!opened) return;
        setSelectedCourseId(page.course || null);
        setSelectedParticipantId(page.participant || null);
        setActiveCourseType(page.type || null);
    }, []);
    applyPageRef.current = applyPage;

    // Back buttons on pages: step back through history when there is an
    // in-app page to return to, otherwise fall back to the previous page.
    const goBack = useCallback(() => {
        if (runInPageBack()) return;
        if ((window.history.state?.chmIdx || 0) > 0) { window.history.back(); return; }
        confirmLeaveRef.current?.().then((leave) => {
            if (!leave) return;
            replaceNextPageRef.current = true;
            navigate(previousView);
        });
    }, [navigate, previousView]);

    // Half-filled forms (new/edit course, participant, facilitator) live only
    // in memory, so leaving one loses what was typed. Typing on one marks it
    // changed; back buttons, the menus and closing the tab then ask first.
    // Saving leaves the form by its own route and is not asked about.
    const formPageKey = view === 'facilitatorForm' ? 'facilitatorForm'
        : (view === 'courses' && ['add-course', 'edit-course', 'participant-form'].includes(activeCoursesTab) ? `courses:${activeCoursesTab}` : null);
    const formPageKeyRef = useRef(null);
    formPageKeyRef.current = formPageKey;
    useEffect(() => { formDirtyRef.current = false; }, [formPageKey]);
    useEffect(() => onGuardChange(() => { formDirtyRef.current = false; }), []);
    useEffect(() => {
        const mark = (e) => { if ((formPageKeyRef.current || isFormGuarded()) && e.target?.closest?.('main')) formDirtyRef.current = true; };
        const warn = (e) => { if (formDirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
        document.addEventListener('input', mark, true);
        document.addEventListener('change', mark, true);
        window.addEventListener('beforeunload', warn);
        return () => {
            document.removeEventListener('input', mark, true);
            document.removeEventListener('change', mark, true);
            window.removeEventListener('beforeunload', warn);
        };
    }, []);
    // Resolves true when it is fine to leave (nothing typed, or they chose to).
    const confirmLeave = useCallback(async () => {
        if (!formDirtyRef.current) return true;
        const leave = await confirmDialog(t('app.leave_form', 'You have unsaved changes. Leave this page without saving?'), {
            title: t('app.unsaved_title', 'Unsaved changes'),
            confirmLabel: t('app.leave', 'Leave'),
            cancelLabel: t('app.stay', 'Stay'),
            danger: true,
        });
        if (leave) formDirtyRef.current = false;
        return leave;
    }, [t]);
    confirmLeaveRef.current = confirmLeave;
    setLeaveConfirmer(confirmLeave);
    const guardedNavigate = useCallback((newView, state) => {
        if (!formDirtyRef.current) return navigate(newView, state);
        confirmLeave().then((leave) => { if (leave) navigate(newView, state); });
        return false;
    }, [confirmLeave, navigate]);

    // A shared in-app link, e.g. ?view=planning&plan=<id>.
    //
    // Not a public route: the recipient signs in as themselves and `navigate`
    // applies the same permission check as any other way in, so sharing a link
    // widens nothing. The screen it lands on reads the rest of the query for
    // itself — this only gets them to the right screen.
    const deepLinked = useRef(false);
    useEffect(() => {
        if (deepLinked.current || !user) return;
        const wanted = new URLSearchParams(window.location.search).get('view');
        if (!wanted) return;
        deepLinked.current = true;
        navigate(wanted);
    }, [user, navigate]);

    // Writes the current page into the address bar. A new page adds a history
    // entry; a participant change, a page reopened from history, and the page
    // left behind by a half-filled form only replace the current one.
    useEffect(() => {
        if (!pageRestored || !user || connectClaudeId || isPublicProjectsView) return;
        if (pageFromLocation(window.location.pathname, '') === null) return;
        const page = describePage({
            view, coursesTab: activeCoursesTab, hrTab: activeHRTab, courseId: selectedCourseId,
            participantId: selectedParticipantId, facilitatorId: selectedFacilitatorId, courseType: activeCourseType,
        });
        const { path, params } = pagePath(page);
        const current = new URL(window.location.href);
        const fromHistory = isPopStateNavigation.current;
        const forceReplace = replaceNextPageRef.current;
        isPopStateNavigation.current = false;
        replaceNextPageRef.current = false;
        const first = !hasWrittenPageRef.current;
        const prev = lastPageRef.current;
        // The page's own query (e.g. ?plan=) stays while it is still on screen.
        if (first || fromHistory || current.pathname === path) {
            current.searchParams.forEach((value, key) => { if (!OWN_KEYS.includes(key) && key !== 'view') params.set(key, value); });
        }
        const query = params.toString();
        const url = `${path}${query ? `?${query}` : ''}${current.hash}`;
        const idx = window.history.state?.chmIdx || 0;
        const push = !first && !fromHistory && !forceReplace && isNewEntry(prev, page) && !isTransientPage(prev);
        if (push) window.history.pushState({ chmPage: page, chmIdx: idx + 1 }, '', url);
        else window.history.replaceState({ ...(window.history.state || {}), chmPage: page, chmIdx: idx }, '', url);
        hasWrittenPageRef.current = true;
        lastPageRef.current = page;
        lastEntryRef.current = { state: window.history.state, url };
    }, [pageRestored, user, connectClaudeId, isPublicProjectsView, view, activeCoursesTab, activeHRTab, selectedCourseId, selectedParticipantId, selectedFacilitatorId, activeCourseType]);

    // Android back button: back through the app's pages, then home, then exit.
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return undefined;
        const sub = CapacitorApp.addListener('backButton', () => {
            if (runInPageBack()) return;
            if ((window.history.state?.chmIdx || 0) > 0) { window.history.back(); return; }
            if (hasWrittenPageRef.current && viewRef.current !== 'landing') {
                confirmLeaveRef.current?.().then((leave) => {
                    if (!leave) return;
                    replaceNextPageRef.current = true;
                    navigateRef.current?.('landing');
                });
                return;
            }
            CapacitorApp.exitApp();
        });
        return () => { sub.then((h) => h.remove()).catch(() => {}); };
    }, []);


    const handleOpenCourse = useCallback((courseId) => { setSelectedCourseId(courseId); setLoading(false); navigate('participants', { courseId }); }, [navigate]);

    // OPEN THE REPORT FIRST, THEN FETCH IT.
    //
    // This used to await every read before navigating, so clicking Report left
    // you on the course list with nothing happening — several seconds of what
    // looks exactly like a dead button, and people click it again. The report
    // page now opens at once and shows its own loading state until the data
    // lands (CourseReportView renders a skeleton while participants is null).
    const handleOpenCourseReport = useCallback(async (courseId) => {
        setSelectedCourseId(courseId);
        navigate('courseReport', { courseId });

        if (courseDetailsCache[courseId]?.allObs && courseDetailsCache[courseId]?.participants && courseDetailsCache[courseId]?.participantTests) { refreshCourseDetailsFromServer(courseId); return; }
        // Already being fetched by another path; its result lands in the same
        // cache entry and the open page picks it up.
        if (courseDetailsLoading) return;
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
            if (!isCacheMiss) refreshCourseDetailsFromServer(courseId);
        } catch (error) { 
            console.error("Error loading course report data:", error); 
            setToast({ show: true, message: t('app_extra.toast.course_report_load_failed', 'Failed to load course report data. Please try again.'), type: 'error' }); 
            // The page is already open, so it must be told the load finished and
            // failed — otherwise it spins for ever on an error nobody can see.
            setCourseDetailsCache(prev => ({
                ...prev,
                [courseId]: { participants: [], allObs: [], allCases: [], finalReport: null, participantTests: [], loadFailed: true }
            }));
        } finally { 
            setLoading(false); setCourseDetailsLoading(false); 
        }
    }, [navigate, courseDetailsCache, courseDetailsLoading, t, refreshCourseDetailsFromServer]);

    const handleOpenCourseForTestForm = useCallback(async (courseId) => {
        setLoading(true); setSelectedCourseId(courseId); setSelectedParticipantId(null); 
        try {
            let participantsData = await listAllParticipantsForCourse(courseId, { source: 'cache' }).catch(()=>null);
            let testData = await listParticipantTestsForCourse(courseId, { source: 'cache' }).catch(()=>null);
            const servedFromCache = participantsData !== null && testData !== null;

            if (!servedFromCache) {
                 [participantsData, testData] = await Promise.all([ 
                     listAllParticipantsForCourse(courseId, { source: 'server' }), 
                     listParticipantTestsForCourse(courseId, { source: 'server' }) 
                 ]);
            }

            const activeParticipants = (participantsData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
            const activeTests = (testData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
            setCourseDetailsCache(prev => ({ ...prev, [courseId]: { ...(prev[courseId] || {}), participants: activeParticipants, participantTests: activeTests } }));
            if (servedFromCache) refreshCourseDetailsFromServer(courseId);
            setActiveCoursesTab('test-dashboard'); setView('courses');
        } catch (error) { 
            console.error("Error loading data for test form:", error); 
            setToast({ show: true, message: t('app_extra.toast.test_form_load_failed', 'Failed to load test form data.'), type: 'error' }); 
            navigate('courses'); 
        } finally { 
            setLoading(false); 
        }
    }, [navigate, t, refreshCourseDetailsFromServer]); 

    const handleApproveSubmission = useCallback(async (submission) => {
        if (await confirmDialog(t('app_extra.confirm.approve', 'Approve {{name}}?', { name: submission.name }))) {
            try {
                await approveFacilitatorSubmission(submission, user.email);
                setToast({ show: true, message: t('app_extra.toast.facilitator_approved', 'Facilitator approved.'), type: 'success' });
                await fetchPendingSubmissions(); await fetchFacilitators();
            } catch (error) { setToast({ show: true, message: t('app_extra.toast.approval_failed', 'Approval failed: {{message}}', { message: error.message }), type: 'error' }); }
        }
    }, [user, fetchPendingSubmissions, fetchFacilitators, t]);

    const handleRejectSubmission = useCallback(async (submissionId) => {
        if (await confirmDialog(t('app_extra.confirm.reject', 'Reject this submission?'))) {
            try { await rejectFacilitatorSubmission(submissionId, user.email); setToast({ show: true, message: t('app_extra.toast.submission_rejected', 'Submission rejected.'), type: 'success' }); await fetchPendingSubmissions(); } 
            catch (error) { setToast({ show: true, message: t('app_extra.toast.rejection_failed', 'Rejection failed: {{message}}', { message: error.message }), type: 'error' }); }
        }
    }, [user, fetchPendingSubmissions, t]);

    const handleShare = useCallback((item, type) => { setItemToShare(item); setShareType(type); setIsShareModalOpen(true); }, []);

    const handleSaveSharingSettings = useCallback(async (itemId, settings) => {
        try {
            if (shareType === 'course') await updateCourseSharingSettings(itemId, settings); else if (shareType === 'participant') await updateParticipantSharingSettings(itemId, settings);
            await fetchCourses(); setToast({ show: true, message: t('app_extra.toast.sharing_updated', 'Sharing settings updated.'), type: "success" });
        } catch (error) { setToast({ show: true, message: t('app_extra.toast.sharing_update_failed', 'Failed to update sharing settings.'), type: "error" }); }
    }, [shareType, fetchCourses, t]);

    const handleDeleteFacilitator = useCallback(async (facilitatorId) => {
        if (!permissions.canManageHumanResource) return;
        if (await confirmDialog(t('app_extra.confirm.delete_facilitator', 'Are you sure you want to delete this facilitator?'))) {
            setLoading(true);
            try {
                await deleteFacilitator(facilitatorId); await fetchFacilitators(); 
                if (selectedFacilitatorId === facilitatorId) { setSelectedFacilitatorId(null); navigate('humanResources'); }
                setToast({ show: true, message: t('app_extra.toast.facilitator_deleted', 'Facilitator deleted successfully.'), type: 'success' });
            } catch (error) { console.error("Error deleting facilitator:", error); setToast({ show: true, message: t('app_extra.toast.facilitator_delete_failed', 'Failed to delete facilitator: {{message}}', { message: error.message }), type: 'error' }); } 
            finally { setLoading(false); }
        }
    }, [permissions.canManageHumanResource, selectedFacilitatorId, navigate, fetchFacilitators, t]);

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
            setToast({ show: true, message: t('app_extra.toast.final_report_load_failed', 'Failed to load data for Final Report.'), type: 'error' }); 
        } finally { 
            setLoading(false); 
        }
    }, [permissions, allCourses, navigate, t]);

    // The uploads live in saveFinalReportWithFiles, which the report view's own
    // save path calls too. They used to be written out here only, so the Save
    // button inside the report view wrote File objects straight into Firestore
    // and the attached PDF was silently lost. One function, both callers.
    //
    // It also carries the signed copy of the report, which this handler had no
    // notion of at all.
    const handleSaveFinalReport = useCallback(async (reportData) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;
        setLoading(true);
        try {
            const currentUserIdentifier = user?.displayName || user?.email || 'Unknown User';
            const savedReport = await saveFinalReportWithFiles(reportData, currentUserIdentifier);
            setCourseDetailsCache(prev => ({ ...prev, [reportData.courseId]: { ...prev[reportData.courseId], finalReport: savedReport } }));
            // Into the shared cache too, so the course list and dashboards show it without a fetch.
            if (savedReport?.id) mergeIntoCache('finalReports', lightFinalReport(savedReport));
            setToast({ show: true, message: t('app_extra.toast.final_report_saved', 'Final report saved successfully.'), type: 'success' });
        } catch (error) {
            console.error("Error saving final report:", error);
            setToast({ show: true, message: t('app_extra.toast.final_report_save_error', 'Error saving final report: {{message}}', { message: error.message }), type: 'error' });
        } finally { setLoading(false); }
    }, [permissions, user, mergeIntoCache, t]);

    const handleEditFinalReport = useCallback(async (courseId) => {
        if (!permissions.canUseFederalManagerAdvancedFeatures) return;
        const courseToEditReport = (allCourses || []).find(c => c.id === courseId);
        if (!courseToEditReport) { setToast({ show: true, message: t('app_extra.toast.course_not_found', 'Course not found.'), type: 'error' }); return; }
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
            setToast({ show: true, message: t('app_extra.toast.final_report_fetch_failed', 'Failed to load the final report.'), type: 'error' }); 
        } finally { 
            setLoading(false); 
        }
    }, [permissions, allCourses, navigate, t]);

    const handleDeletePdf = useCallback(async (courseId) => {  }, [permissions, courseDetails.finalReport]);

    const handleLogout = useCallback(async () => { 
        if (await confirmDialog(t('app_extra.confirm.logout', 'Are you sure you want to log out?'))) {
            try { 
                if (user) {
                    localStorage.removeItem(`backup_role_${user.uid}`);
                    localStorage.removeItem(`backup_roles_${user.uid}`);
                    localStorage.removeItem(`backup_perms_${user.uid}`);
                    localStorage.removeItem(`backup_states_${user.uid}`);
                    localStorage.removeItem(`backup_localities_${user.uid}`);
                }
                clearRememberedFilters();
                await signOut(auth); 
            } catch (error) { 
                console.error("Error signing out:", error); 
            } 
        }
    }, [user, t]);

    const handleLoginForSharedView = useCallback(async () => {  }, []);

    const handleResetMonitor = useCallback(() => { setOperationCounts({ reads: 0, writes: 0 }); }, []);
    const handleDismissMonitor = useCallback(() => { setIsMonitorVisible(false); }, []);

    const renderView = () => {
        const currentParticipant = (courseDetails.participants || []).find(p => p.id === selectedParticipantId);
        const viewToRender = view;

        switch (viewToRender) {
            case 'landing': return <Landing navigate={navigate} permissions={permissions} user={user} roles={userRoles} userStates={userStates} userLocalities={userLocalities} stats={homeStats} onAskData={openDataAssistant} />;
            case 'admin': return <AdminDashboard appRoles={userRoles} />;
            case 'about': return <AboutDeveloperPage permissions={permissions} />;
            case 'imciForm': 
                return permissions.canViewCourse ? ( <Suspense fallback={<PageSkeleton />}><ImnciProvider><IMNCIRecordingForm permissions={permissions} /></ImnciProvider></Suspense> ) : null;

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
                canAddCourse={permissions.canAddCourse}
                canUseSuperUserAdvancedFeatures={permissions.canUseSuperUserAdvancedFeatures}
                canUseFederalManagerAdvancedFeatures={permissions.canUseFederalManagerAdvancedFeatures} canEditDeleteActiveCourse={permissions.canManageCourse} 
                canEditDeleteInactiveCourse={permissions.canUseFederalManagerAdvancedFeatures || (permissions.canManageCourse && permissions.manageTimePeriod === 'anytime')}
                manageLocation={permissions.manageLocation}
                facilitatorsList={allFacilitators || []} 
                currentUserRole={userRole}
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

           case 'supplyManagement':
    return permissions.canViewSupplyChain ? ( <Suspense fallback={<PageSkeleton />}><SupplyManagementView permissions={permissions} /></Suspense> ) : null;

           case 'supervision':
    return permissions.canViewSupervision ? ( <Suspense fallback={<PageSkeleton />}><SupervisionView permissions={permissions} /></Suspense> ) : null;

           case 'onlineCourses':
    return permissions.canViewOnlineCourses ? ( <Suspense fallback={<PageSkeleton />}><ImnciProvider><OnlineCoursesView permissions={permissions} userRoles={userRoles} /></ImnciProvider></Suspense> ) : null;


           case 'projects':
    return permissions.canUseFederalManagerAdvancedFeatures ? ( <Suspense fallback={<PageSkeleton />}><ProjectTrackerView permissions={permissions} /></Suspense> ) : null;

case 'meetings':
    return permissions.canUseFederalManagerAdvancedFeatures ? ( <Suspense fallback={<PageSkeleton />}><MeetingTrackerView permissions={permissions} /></Suspense> ) : null;

            case 'planning':
                return permissions.canUseFederalManagerAdvancedFeatures ? ( <Suspense fallback={<PageSkeleton />}><PlanningView permissions={permissions} userStates={userStates} /></Suspense> ) : null;

            case 'localityPlan':
                return permissions.canViewLocalityPlan ? ( <Suspense fallback={<PageSkeleton />}><LocalityPlanView permissions={permissions} userStates={userStates} userLocalities={userLocalities} /></Suspense> ) : null;

            case 'downloads':
                return ( <Suspense fallback={<PageSkeleton />}><DownloadedFilesView onBack={goBack} setToast={setToast} /></Suspense> );

            case 'monitoring': case 'observe':
                const canMonitor = (permissions.canManageCourse && isCourseActive) || permissions.canUseFederalManagerAdvancedFeatures || permissions.manageTimePeriod === 'anytime';
                return canMonitor ? (selectedCourse && currentParticipant && <ObservationView course={selectedCourse} participant={currentParticipant} participants={courseDetails.participants} onChangeParticipant={(id) => setSelectedParticipantId(id)} initialCaseToEdit={editingCaseFromReport} />) : null;

            case 'participantReport': return permissions.canViewCourse ? (
                selectedCourse && currentParticipant && 
                <ParticipantReportView 
                    course={selectedCourse} participant={currentParticipant} participants={courseDetails.participants} 
                    observations={courseDetails.allObs?.filter(o => o.participant_id === currentParticipant.id) || []} cases={courseDetails.allCases?.filter(c => c.participant_id === currentParticipant.id) || []}
                    onChangeParticipant={(pid) => setSelectedParticipantId(pid)} onBack={goBack} 
                    onNavigateToCase={(caseToEdit) => navigate('observe', { caseToEdit, courseId: caseToEdit.courseId, participantId: caseToEdit.participant_id })} 
                    onShare={(participant) => handleShare(participant, 'participant')} 
                />
            ) : null;

            case 'courseReport': return permissions.canViewCourse ? (selectedCourse && <CourseReportView course={selectedCourse} onSaveFinalReport={permissions.canUseFederalManagerAdvancedFeatures ? handleSaveFinalReport : undefined} onFinalReportChanged={(saved) => setCourseDetailsCache(prev => ({ ...prev, [selectedCourse.id]: { ...prev[selectedCourse.id], finalReport: saved } }))} isLoadingData={courseDetails.participants === null || courseDetails.allObs === null} loadFailed={!!courseDetails.loadFailed} onRetry={() => { setCourseDetailsCache(prev => { const next = { ...prev }; delete next[selectedCourse.id]; return next; }); handleOpenCourseReport(selectedCourse.id); }} participants={courseDetails.participants} allObs={courseDetails.allObs} allCases={courseDetails.allCases} finalReportData={courseDetails.finalReport} onBack={goBack} onEditFinalReport={handleEditFinalReport} onDeletePdf={handleDeletePdf} onViewParticipantReport={(pid) => { setSelectedParticipantId(pid); navigate('participantReport'); }} onShare={(course) => handleShare(course, 'course')} setToast={setToast} allHealthFacilities={healthFacilities} />) : null;

            case 'facilitatorForm':
                return permissions.canManageHumanResource ? (<FacilitatorForm 
                    initialData={editingFacilitator} onCancel={goBack} 
                    onSave={async () => { await fetchFacilitators(); setToast({ show: true, message: t('app_extra.toast.facilitator_saved', 'Facilitator saved.'), type: 'success' }); navigate('humanResources'); }}
                    setToast={setToast} setLoading={setLoading}
                />) : null;

            case 'facilitatorReport': return permissions.canViewHumanResource ? (selectedFacilitator && <FacilitatorReportView facilitator={selectedFacilitator} allCourses={allCourses || []} onBack={goBack} />) : null;

            case 'dashboard': return <DashboardView onOpenCourseReport={handleOpenCourseReport} onOpenParticipantReport={(pId, cId) => navigate('participantReport', { openParticipantReport: pId, openCourseReport: cId })} onOpenFacilitatorReport={(id) => { setSelectedFacilitatorId(id); navigate('facilitatorReport'); }} permissions={permissions} userStates={userStates} userLocalities={userLocalities} STATE_LOCALITIES={STATE_LOCALITIES} />;

            case 'finalReport':
                return (
                    <FinalReportManager
                        course={finalReportCourse || selectedCourse} participants={courseDetails.participants} initialData={courseDetails.finalReport}
                        onSave={handleSaveFinalReport} onCancel={goBack} canUseFederalManagerAdvancedFeatures={permissions.canUseFederalManagerAdvancedFeatures}
                    />
                );
            case 'attendanceManager':
                return permissions.canManageCourse ? ( selectedCourse && ( <Suspense fallback={<PageSkeleton />}><AttendanceManagerView course={selectedCourse} onClose={() => navigate('courses')} /></Suspense> ) ) : null;

            default: return <Landing navigate={navigate} permissions={permissions} user={user} roles={userRoles} userStates={userStates} userLocalities={userLocalities} stats={homeStats} />;
        }
    };

    const navItems = useMemo(() => [
        { label: t('landing.modules.home', 'Home'), view: 'landing', active: view === 'landing', disabled: false },
        { label: t('landing.modules.dashboard', 'Dashboard'), view: 'dashboard', active: view === 'dashboard', disabled: false },
        { label: t('landing.modules.courses', 'Courses'), view: 'courses', active: ['courses', 'courseForm', 'courseReport', 'participants', 'participantForm', 'participantReport', 'observe', 'monitoring', 'reports', 'finalReport', 'participantMigration', 'courseDetails', 'test-dashboard', 'enter-test-scores', 'attendanceManager', 'imciForm'].includes(view), disabled: !permissions.canViewCourse }, 
        { label: t('landing.modules.human_resources', 'Human Resources'), view: 'humanResources', active: ['humanResources', 'facilitatorForm', 'facilitatorReport'].includes(view), disabled: !permissions.canViewHumanResource },
        { label: t('landing.modules.facilities', 'Child Health Services'), view: 'childHealthServices', active: view === 'childHealthServices', disabled: !permissions.canViewFacilities },
        { label: t('landing.modules.mentorship', 'Skills Mentorship'), view: 'skillsMentorship', active: view === 'skillsMentorship', disabled: !permissions.canViewSkillsMentorship }
    ], [view, permissions, t]);

    const visibleNavItems = useMemo(() => navItems.filter(item => !item.disabled), [navItems]);

    const isApplicationPublicView = isPublicSubmissionView || isNewFacilityView || isPublicFacilityUpdateView;
    const isMentorshipPublicView = !!publicMentorshipProps || isPublicMentorshipDashboardView; 
    
    const isPublicReportView = !!publicViewType; 

    const isVerificationPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/verify/certificate/');
    const isCertDownloadPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/public/certificate/download/');
    const isCourseCertPagePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/public/course/certificates/');
    const isAttendancePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/attendance/course/');

    // `connectClaudeId` is here because that page opens in a small OAuth popup
    // window. Drawn with the full app chrome — header, navigation, bottom bar —
    // the consent card is pushed below the fold of a 600px popup and the window
    // looks empty, which is exactly how it was reported.
    const isMinimalUILayout = isApplicationPublicView || isMentorshipPublicView || isPublicMonitoringView || isPublicReportView || isPublicTestView || isVerificationPath || isCertDownloadPath || isCourseCertPagePath || publicViewType === 'certificateDownload' || publicViewType === 'courseCertificatesPage' || isBulkUpdateView || publicViewType === 'attendance' || publicViewType === 'onlineExercises' || isPublicRegistrationView || isPublicMeetingView || isPublicProjectsView || !!publicSupervisionFormId || !!connectClaudeId;

    let mainContent;

    if ((authLoading || permissionsLoading) && !isMinimalUILayout) {
        mainContent = <SplashScreen />;
    }
    // Approving the claude.ai connector. Deliberately NOT a minimal-UI public
    // route: a signed-out visitor falls through to the sign-in screen and comes
    // back here, because the whole point is that the connection is granted by a
    // known person rather than by whoever holds the link.
    // Not gated on `user`. Falling through to the ordinary app when nobody was
    // signed in yet meant this window rendered the whole dashboard shell around
    // a sign-in box, which in a popup reads as a blank page. The screen itself
    // handles all three states — still checking, not signed in, signed in — so
    // the popup always shows something that explains itself.
    else if (connectClaudeId && !user && !authLoading) {
        // The real sign-in form, the same one every other signed-out route
        // shows. The consent screen used to offer a button of its own that
        // navigated to the address it was already on, so pressing it did
        // nothing at all. Signing in here sets `user`, and the branch below
        // then takes over with the request id still held in state.
        mainContent = (
            <SignInBox message={t('app_extra.signin.claude', 'Sign in to let Claude read programme data as you.')} />
        );
    }
    else if (connectClaudeId) {
        mainContent = (
            <Suspense fallback={<div className="min-h-screen grid place-items-center"><Spinner /></div>}>
                <ConnectClaudeScreen
                    requestId={connectClaudeId}
                    user={user}
                    authLoading={authLoading}
                    onDone={() => { setConnectClaudeId(null); window.history.replaceState({}, '', '/'); }}
                />
            </Suspense>
        );
    }
    else if (isPublicProjectsView) {
        mainContent = (
             <Suspense fallback={<PageSkeleton />}>
                 <ProjectTrackerView permissions={{ canUseFederalManagerAdvancedFeatures: false }} />
             </Suspense>
        );
    }
    else if (isPublicMentorshipDashboardView) {
        mainContent = (
             <Suspense fallback={<PageSkeleton />}>
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
            mainContent = <PageSkeleton />;
        } else if (!user) {
            mainContent = <SignInBox message={t('app_extra.signin.facility_update', 'You must sign in to use this facility data entry form.')} />;
        } else {
            mainContent = <PublicFacilityUpdateForm setToast={setToast} serviceType={publicServiceType} />;
        }
    }
    else if (isNewFacilityView) {
        if (authLoading) {
            mainContent = <PageSkeleton />;
        } else if (!user) {
            mainContent = <SignInBox message={t('app_extra.signin.new_facility', 'You must sign in to use this new facility entry form.')} />;
        } else {
            mainContent = <NewFacilityEntryForm setToast={setToast} serviceType={publicServiceType} />;
        }
    }
    else if (isPublicSubmissionView) {
        if (authLoading) {
            mainContent = <PageSkeleton />;
        } else if (!user) {
            mainContent = <SignInBox message={t('app_extra.signin.application', 'You must sign in to submit an application.')} />;
        } else {
            if (submissionType === 'facilitator-application') mainContent = <FacilitatorApplicationForm />;
            else if (submissionType === 'team-member-application') mainContent = <TeamMemberApplicationForm />;
            else mainContent = <div className="p-8 text-center">{t('app_extra.errors.invalid_form_link', 'Invalid form link.')}</div>;
        }
    }
    else if (isBulkUpdateView) {
        mainContent = (
            <Suspense fallback={<PageSkeleton />}>
                <LocalityBulkUpdateView stateParam={publicBulkUpdateParams.state} localityParam={publicBulkUpdateParams.locality} filters={publicBulkUpdateParams} setToast={setToast} />
            </Suspense>
        );
    }
    else if (isPublicRegistrationView) {
        if (publicRegistrationCourseId) {
            mainContent = (
                <Suspense fallback={<PageSkeleton />}>
                    <PublicParticipantRegistrationView courseId={publicRegistrationCourseId} />
                </Suspense>
            );
        } else {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{t('app_extra.errors.invalid_registration_link', 'Invalid Registration Link.')}</div></Card>;
        }
    }
    else if (isPublicMeetingView) {
        if (publicViewLoading) {
            mainContent = <PageSkeleton />;
        } else if (sharedViewError) {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{sharedViewError}</div></Card>;
        } else if (publicMeetingData) {
            mainContent = (
                <Suspense fallback={<PageSkeleton />}>
                    <PublicMeetingAttendanceView
                        meeting={publicMeetingData}
                        targetDate={publicMeetingTargetDate}
                        onSave={async (updatedMeeting) => {
                            await upsertUnitMeeting(updatedMeeting);
                            setPublicMeetingData(updatedMeeting);
                            setToast({ show: true, message: t('app_extra.toast.attendance_updated', 'Attendance updated successfully!'), type: 'success' });
                        }}
                    />
                </Suspense>
            );
        } else {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{t('app_extra.errors.meeting_load_failed', 'Could not load meeting data.')}</div></Card>;
        }
    }

    else if (isPublicReportView || isVerificationPath || publicViewType === 'certificateDownload' || publicViewType === 'courseCertificatesPage' || publicViewType === 'attendance' || publicViewType === 'onlineExercises') { 
        if (publicViewLoading || ((isVerificationPath || publicViewType === 'certificateDownload' || publicViewType === 'courseCertificatesPage') && !publicViewData && !sharedViewError)) {
            mainContent = <PageSkeleton />;
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
                    mainContent = ( <Suspense fallback={<PageSkeleton />}><CertificateVerificationView participant={publicViewData.participant} course={publicViewData.course} /></Suspense> );
                    break;
                case 'certificateDownload':
                    mainContent = ( <Suspense fallback={<PageSkeleton />}><PublicCertificateDownloadView participantId={publicViewData.participantId} /></Suspense> );
                    break;
                case 'courseCertificatesPage':
                    mainContent = ( <Suspense fallback={<PageSkeleton />}><PublicCourseCertificatesView courseId={publicViewData.courseId} /></Suspense> );
                    break;
                case 'attendance':
                    mainContent = ( <Suspense fallback={<PageSkeleton />}><PublicAttendanceView courseId={publicViewData.courseId} /></Suspense> );
                    break;
                case 'onlineExercises':
                    mainContent = ( <Suspense fallback={<PageSkeleton />}><ImnciProvider><PublicExerciseView courseId={publicViewData.courseId} /></ImnciProvider></Suspense> );
                    break;
                default:
                    mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{t('app_extra.errors.invalid_report_type', 'Invalid report type.')}</div></Card>;
            }
        }
        else {
             mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{t('app_extra.errors.report_load_failed', 'Could not load report data.')}</div></Card>;
        }
    }
    
    else if (isPublicMonitoringView) {
        if (authLoading) {
             mainContent = <PageSkeleton />;
        } else if (!user) {
            mainContent = <SignInBox message={t('app_extra.signin.monitoring', 'You must sign in to access the public monitoring page.')} />;
        } else if (publicMonitorLoading) {
            mainContent = <PageSkeleton />;
        } else if (publicMonitorError) {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{publicMonitorError}</div></Card>;
        } else if (publicMonitorData.course && publicMonitorData.participants) {
            mainContent = ( <PublicCourseMonitoringView course={publicMonitorData.course} allParticipants={publicMonitorData.participants} /> );
        } else {
             mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{t('app_extra.errors.monitoring_load_failed', 'Could not load monitoring session.')}</div></Card>;
        }
    }

    else if (publicSupervisionFormId) {
        if (authLoading) {
            mainContent = <PageSkeleton />;
        } else if (!user) {
            mainContent = <SignInBox message={t('app_extra.signin.supervision', 'Sign in to fill this supervision form.')} />;
        } else {
            mainContent = <Suspense fallback={<PageSkeleton />}><PublicSupervisionForm checklistId={publicSupervisionFormId} /></Suspense>;
        }
    }
    else if (isMentorshipPublicView && !isPublicMentorshipDashboardView) {
        if (authLoading) {
            mainContent = <PageSkeleton />;
        } else if (!user) { 
            mainContent = <SignInBox message={t('app_extra.signin.mentorship', 'You must sign in to use the mentorship submission link.')} />;
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
            mainContent = <PageSkeleton />;
        } else if (publicTestLoading) {
            mainContent = <PageSkeleton />;
        } else if (publicTestError) {
            mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{publicTestError}</div></Card>;
        } else if (publicTestData.course) {
            mainContent = (
                <Suspense fallback={<PageSkeleton />}>
                    <CourseTestForm
                        course={publicTestData.course} participants={publicTestData.participants} participantTests={publicTestData.tests}
                        onSaveTest={upsertParticipantTest} 
                        onSaveParticipant={async (participantData, facilityUpdateData) => {
                            const currentUserIdentifier = user?.displayName || user?.email || 'Public User';
                            const savedParticipant = await saveParticipantAndSubmitFacilityUpdate(participantData, facilityUpdateData, currentUserIdentifier);
                            if (facilityUpdateData) setToast({ show: true, message: t('app_extra.toast.facility_update_submitted', 'Facility update submitted for approval.'), type: 'info' });
                            return savedParticipant;
                        }} 
                        onCancel={() => {}} 
                        onSave={(savedTest) => { 
                            setToast({ show: true, message: t('app_extra.toast.test_saved', 'Test saved successfully!'), type: 'success' });
                            const refetchData = async () => {
                                setPublicTestLoading(true);
                                try {
                                    const [testData, participantData] = await Promise.all([ listParticipantTestsForCourse(publicTestData.course.id, 'server'), listAllParticipantsForCourse(publicTestData.course.id, 'server') ]);
                                    const activeParticipants = (participantData || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
                                    const activeTests = (testData || []).filter(t => t.isDeleted !== true && t.isDeleted !== "true");
                                    setPublicTestData(prev => ({ ...prev, tests: activeTests, participants: activeParticipants }));
                                } catch (err) { setToast({ show: true, message: t('app_extra.toast.test_refresh_failed', 'Failed to refresh test data.'), type: 'error' }); } finally { setPublicTestLoading(false); }
                            };
                            refetchData();
                        }}
                        initialParticipantId={''} isPublicView={true} canManageTests={permissions.canUseFederalManagerAdvancedFeatures} testType={publicTestType}
                    />
                </Suspense>
            );
        } else {
             mainContent = <Card><div className="p-4 text-center text-red-600 font-semibold">{t('app_extra.errors.test_load_failed', 'Could not load test session.')}</div></Card>;
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


    // Slim top bar (back arrow and page title only) on the Android app, on
    // every page but the main menu. The web keeps its full header.
    const PAGE_TITLES = pageTitles(t);
    const closeSideMenu = () => setSideMenuOpen(false);
    const showSlimBar = Capacitor.isNativePlatform() && !!user && !isMinimalUILayout && view !== 'landing';
    const pageTitle = PAGE_TITLES[view] || t('app.title', 'National Child Health Program');
    const pageSubtitle = (() => {
        if (view === 'facilitatorReport' || view === 'facilitatorForm') return selectedFacilitator?.name || '';
        const course = view === 'finalReport' ? (finalReportCourse || selectedCourse) : selectedCourse;
        const courseLine = course ? [course.course_type, [course.state, course.locality].filter(Boolean).join(' / ')].filter(Boolean).join(' · ') : '';
        if (['participantReport', 'observe', 'monitoring'].includes(view)) {
            const participant = (courseDetails.participants || []).find(p => p.id === selectedParticipantId);
            return [participant?.name, courseLine].filter(Boolean).join(' · ');
        }
        if (['courses', 'courseReport', 'finalReport', 'attendanceManager'].includes(view)) return courseLine || (view === 'courses' ? activeCourseType || '' : '');
        return '';
    })();
    const headerActions = (
        <>
                {/* The in-app chat is built but not switched on: it
                    calls the Anthropic API, which is billed separately
                    and cannot be paid for with a Claude subscription.
                    The team asks their questions through the claude.ai
                    connector instead, which costs them nothing extra.
                    Turn this back on alongside the claudeChat export in
                    functions/index.js. */}
                {CLAUDE_CHAT_ENABLED && permissions.canViewDashboard && (
                    <button
                        onClick={() => setClaudeChatOpen(true)}
                        title={t('app_extra.header.ask_data', 'Ask about the data')}
                        className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <Sparkles size={20} />
                    </button>
                )}

                {/* Reporting a problem, from wherever the problem is.
                    A report sent from the screen it happened on knows
                    which screen that was; one sent later does not. */}
                <QuietBoundary>
                    <Suspense fallback={null}>
                        <ReportProblemButton user={user} currentView={view} />
                    </Suspense>
                </QuietBoundary>

                <NotificationBell user={user} navigate={guardedNavigate} />

                {/* Update arrow. Red and pulsing when an update is
                    waiting, green once a check confirms the app is
                    current, spinner while checking or downloading. */}
                <UpdateButton />

                <button
                    onClick={() => setIsSyncModalOpen(true)}
                    className={`p-1 sm:p-1.5 border rounded transition-colors flex items-center justify-center min-w-[32px] sm:min-w-[36px] ${
                        isOffline 
                        ? 'text-amber-400 bg-slate-600 border-slate-500 hover:bg-slate-500' 
                        : 'text-sky-400 bg-slate-600 border-slate-500 hover:bg-slate-500 hover:text-sky-300'
                    }`}
                    title={isOffline ? t('app_extra.header.offline_mode', 'Offline Mode') : t('app_extra.header.sync_status', 'Data Sync Status')}
                >
                    {isOffline ? (
                        <CloudOff size={18} />
                    ) : (
                        isSyncing ? <RefreshCw size={18} className="animate-spin text-sky-300" /> : <Cloud size={18} />
                    )}
                </button>

                <button
                    onClick={() => {
                        const newLang = i18n.language?.startsWith('en') ? 'ar' : 'en';
                        i18n.changeLanguage(newLang);
                    }}
                    className="p-1 sm:p-1.5 text-sky-400 bg-slate-600 border border-slate-500 rounded hover:bg-slate-500 hover:text-sky-300 transition-colors flex items-center justify-center min-w-[32px] sm:min-w-[36px]"
                    title={i18n.language?.startsWith('en') ? 'التبديل إلى العربية' : 'Switch to English'}
                >
                    <span className="font-bold text-sm">E/ع</span>
                </button>
        </>
    );

    return (
        <div className="min-h-screen bg-surface flex flex-col pt-0 relative">
            
            <style>{`
                @media (max-width: 768px) {
                    /* Scoped to the toast. This used to match [role="alert"] and
                       .fixed.bottom-4, which caught modal overlays too: forcing
                       bottom:80px on an inset-0 overlay shortens it from the
                       bottom and lifts anything centred inside it off-centre. */
                    .toast-container {
                        bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important;
                        margin-bottom: 0 !important;
                    }
                }
            `}</style>

            {/* MOUNTED ONCE, ABOVE THE ROUTED VIEWS.
                Certificate generation runs in a module-level queue so it is not
                interrupted by navigation; this is the only thing that reports on
                it, so it has to live somewhere that navigation does not unmount.
                Lazy, because nothing on the sign-in screen needs the certificate
                code and it pulls in jsPDF and html2canvas. */}
            <Suspense fallback={null}><CertificateDownloadBanner /></Suspense>

            {/* Offline is a small floating pill, not a bar: it takes no space
                and blocks no taps, so open forms and quizzes carry on. */}
            <OfflinePill />

            <div className="fixed top-0 start-0 w-full z-[100005] flex flex-col">
                {(isFileDownloading || isDownloadingAppUpdate) && (
                    <div className="bg-sky-700 text-white py-2 px-4 text-sm font-bold flex justify-center items-center gap-2 shadow-md relative overflow-hidden">
                        <div 
                            className="absolute top-0 left-0 h-full bg-sky-500 z-0 transition-all duration-300" 
                            style={{ width: `${isFileDownloading ? fileDownloadProgress : appUpdateProgress}%` }}
                        ></div>
                        <RefreshCw className="w-4 h-4 animate-spin z-10 shrink-0" /> 
                        <span className="z-10 truncate">
                            {t('app.downloading', 'Downloading...')} {Math.round(isFileDownloading ? fileDownloadProgress : appUpdateProgress)}%
                        </span>
                    </div>
                )}
            </div>

            {showSlimBar ? (
            <header ref={headerRef} className={`bg-slate-800 text-white shadow-lg sticky z-40 transition-all ${(isFileDownloading || isDownloadingAppUpdate) ? 'top-10' : 'top-0'}`}>
                <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 h-14 px-1 sm:px-4">
                    <button
                        onClick={goBack}
                        aria-label={t('app.back', 'Back')}
                        title={t('app.back', 'Back')}
                        className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 shrink-0"
                    >
                        <ArrowLeft size={22} className="rtl:-scale-x-100" />
                    </button>
                    <div className="flex-1 min-w-0 px-1">
                        <h1 className="text-base sm:text-lg font-bold leading-tight truncate">{pageTitle}</h1>
                        {pageSubtitle && <p className="text-xs text-slate-300 truncate">{pageSubtitle}</p>}
                    </div>
                </div>
            </header>
            ) : (<>
            <header ref={headerRef} className={`bg-slate-800 shadow-lg sticky z-40 transition-all ${(isFileDownloading || isDownloadingAppUpdate) ? 'top-10' : 'top-0'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        {user && !isMinimalUILayout && (
                            <button
                                onClick={() => setSideMenuOpen(true)}
                                aria-label={t('menu.title', 'Menu')}
                                title={t('menu.title', 'Menu')}
                                className="hidden md:inline-flex p-2 rounded-full text-white hover:bg-white/10 active:bg-white/20 shrink-0"
                            >
                                <Menu size={24} />
                            </button>
                        )}
                        <div className="flex items-center gap-3 sm:gap-4 cursor-pointer min-w-0" onClick={() => !isSharedView && navigate('landing')}>
                            <div className="h-11 w-11 sm:h-14 sm:w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md shrink-0">
                                <img src="/child.png" alt={t('app_extra.header.logo_alt', 'NCHP Logo')} className="h-9 w-9 sm:h-12 sm:w-12 object-contain" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-2xl font-bold text-white leading-tight">{t('app.title', 'National Child Health Program')}</h1>
                                <p className="text-xs sm:text-sm text-slate-300 flex items-center flex-wrap gap-2 mt-1 sm:mt-0">
                                    <span>{t('app.subtitle', 'Program & Course Monitoring System')}</span>
                                    <span
                                        onClick={(e) => { e.stopPropagation(); handleManualUpdateCheck(); }}
                                        className="bg-slate-700 text-sky-300 text-xs px-1.5 py-0.5 rounded border border-slate-600 font-mono shadow-sm cursor-pointer hover:bg-slate-600 hover:text-sky-200 transition-colors"
                                        title={t('app_extra.header.check_updates', 'Tap to check for updates')}
                                    >
                                        v{appVersion}
                                    </span>
                                </p>
                            </div>
                        </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {!isMinimalUILayout && user && (
                                <nav className="hidden md:flex items-center gap-1">
                                    {visibleNavItems.map(item => (
                                        <button key={item.view} onClick={() => guardedNavigate(item.view)} className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${item.active ? 'bg-sky-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}>
                                            {item.label}
                                        </button>
                                    ))} 
                                </nav>
                            )}
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
                <div className="bg-slate-700 text-slate-200 px-2 sm:px-3 py-2 flex items-center justify-between w-full shadow-inner min-h-[48px] gap-2">

                    <div className="flex-1 flex items-center justify-start overflow-hidden min-w-0">
                        {/* Phones: the side menu sits here; the greeting already names the user. */}
                        <button
                            onClick={() => setSideMenuOpen(true)}
                            aria-label={t('menu.title', 'Menu')}
                            title={t('menu.title', 'Menu')}
                            className="md:hidden p-1.5 rounded-md text-white hover:bg-slate-600 active:bg-slate-500 shrink-0"
                        >
                            <Menu size={22} />
                        </button>
                        <div
                            className="hidden md:flex items-center gap-1.5 cursor-pointer hover:bg-slate-600 px-2 py-1 rounded-md transition-colors duration-200 min-w-0 max-w-full"
                            onClick={() => setIsUserProfileModalOpen(true)}
                            title={t('app_extra.header.view_profile', 'View Profile Information')}
                        >
                            <span className="font-semibold text-sm truncate shrink-0 max-w-[90px] sm:max-w-xs">
                                {user.displayName || user.email}
                            </span>

                            <div className="flex items-center gap-1 flex-nowrap overflow-hidden">
                                {userRoles && userRoles.length > 0 && userRoles.map((r, idx) => (
                                    idx === 0 && <span key={r} className="bg-sky-500 text-white text-xs px-1.5 py-0.5 rounded shadow-sm capitalize whitespace-nowrap shrink-0">
                                        {r.replace(/_/g, ' ')}
                                    </span>
                                ))}
                                {userHRProfile && userHRProfile.role && (
                                    <span className="bg-teal-500 text-white text-xs px-1.5 py-0.5 rounded shadow-sm capitalize whitespace-nowrap shrink-0 hidden sm:inline-flex">
                                        {userHRProfile.role}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                        {headerActions}
                        
                        <button
                            onClick={handleLogout}
                            className="p-1 sm:px-3 sm:py-1 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center justify-center gap-1 transition-colors min-w-[32px]"
                            title={t('app.logout', 'Logout')}
                        >
                            <LogOut size={18} className="sm:hidden" />
                            <span className="hidden sm:inline">{t('app.logout', 'Logout')}</span>
                        </button>
                    </div>
                </div>
            )}
            </>)}
            
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}

            {/* in-app replacements for alert()/confirm(); see components/dialogs.jsx */}
            <DialogHost />

            <main className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 w-full flex-grow pb-32 md:pb-8 overflow-x-clip">
                {/* keyed on `view` so navigating away from a crashed screen clears the error */}
                <ErrorBoundary key={view} screen={view} onGoHome={() => navigate('landing')}>
                    <Suspense fallback={<PageSkeleton />}>
                        {mainContent}
                    </Suspense>
                </ErrorBoundary>
            </main>

            {/* On phones the credit sits in the bottom bar; everywhere else it is the page footer. */}
            <footer className={`${user && !isMinimalUILayout ? 'hidden md:block' : 'block'} bg-slate-800 text-slate-300 text-xs py-3 px-4 border-t border-slate-700`}>
                <AppCredit />
            </footer>

            {user && !isMinimalUILayout && (
                <SideMenu
                    open={sideMenuOpen}
                    onClose={closeSideMenu}
                    user={user}
                    roleLabel={userRoles?.[0] ? String(userRoles[0]).replace(/_/g, ' ') : ''}
                    levelLabel={{ federal: t('landing.level_federal', 'Federal level'), state: t('landing.level_state', 'State level'), locality: t('landing.level_locality', 'Locality level') }[levelFromPermissions(permissions)]}
                    modules={buildModules(t, permissions).filter(m => m.permission)}
                    currentView={view}
                    onNavigate={guardedNavigate}
                    onProfile={() => setIsUserProfileModalOpen(true)}
                    onSync={() => setIsSyncModalOpen(true)}
                    onLanguage={() => i18n.changeLanguage(i18n.language?.startsWith('en') ? 'ar' : 'en')}
                    languageLabel={i18n.language?.startsWith('en') ? 'التبديل إلى العربية' : 'Switch to English'}
                    onUpdate={handleManualUpdateCheck}
                    onLogout={handleLogout}
                    appVersion={appVersion}
                    isOffline={isOffline}
                />
            )}

            { user && !isMinimalUILayout && <BottomNav navItems={visibleNavItems} navigate={guardedNavigate} /> }

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
                        title={t('app_extra.profile.title', 'My Profile Information')}
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
                                                    placeholder={t('app_extra.profile.full_name', 'Full Name')} 
                                                />
                                            </div>
                                        ) : (
                                            <h3 className="text-xl font-bold text-gray-800 mb-1">{user.displayName || t('app_extra.profile.no_name', 'No Name Set')}</h3>
                                        )}
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            {t('app_extra.profile.active', 'Active Account')}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="shrink-0 ms-4">
                                    {isEditingProfile ? (
                                        <div className="flex space-x-2">
                                            <Button variant="secondary" onClick={() => setIsEditingProfile(false)}>{t('app_extra.buttons.cancel', 'Cancel')}</Button>
                                            <Button onClick={handleSaveProfile}>{t('app_extra.buttons.save', 'Save')}</Button>
                                        </div>
                                    ) : (
                                        <Button variant="secondary" onClick={() => setIsEditingProfile(true)}>
                                            {t('app_extra.profile.edit', 'Edit Profile')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-gray-200 p-3 rounded-lg bg-white shadow-sm">
                                    <span className="block text-xs text-gray-500 font-bold mb-1">{t('app_extra.profile.email', 'Email Address')}</span>
                                    <span className="text-gray-800 font-medium">{user.email}</span>
                                </div>

                                <div className="border border-gray-200 p-3 rounded-lg bg-white shadow-sm">
                                    <span className="block text-xs text-gray-500 font-bold mb-1">{t('app_extra.profile.registered', 'Date of Registration')}</span>
                                    <span className="text-gray-800 font-medium">
                                        {user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        }) : t('app_extra.profile.not_available', 'Not Available')}
                                    </span>
                                </div>

                                <div className="border border-gray-200 p-4 rounded-lg bg-white shadow-sm md:col-span-2">
                                    <span className="block text-xs text-gray-500 font-bold mb-3">{t('app_extra.profile.roles', 'Roles & Designations')}</span>
                                    <div className="flex flex-col gap-2">
                                        
                                        <div className="flex flex-col gap-2 bg-sky-50 p-2.5 rounded border border-sky-100">
                                            <span className="text-sm font-medium text-sky-800">{t('app_extra.profile.access_levels', 'System Access Levels')}</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {userRoles && userRoles.length > 0 ? userRoles.map(r => (
                                                    <span key={r} className="text-sky-700 font-bold capitalize bg-white px-2 py-0.5 rounded shadow-sm text-xs">
                                                        {r.replace(/_/g, ' ')}
                                                    </span>
                                                )) : (
                                                    <span className="text-sky-700 font-bold capitalize">
                                                        {userRole ? userRole.replace(/_/g, ' ') : t('app_extra.profile.standard_user', 'Standard User')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {userHRProfile && userHRProfile.role && (
                                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">{t('app_extra.profile.team_role', 'Program Team Role')}</span>
                                                <span className="text-gray-800 font-bold">{userHRProfile.role}</span>
                                            </div>
                                        )}
                                        
                                        {userHRProfile && userHRProfile.unit && (
                                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">{t('app_extra.profile.unit', 'Assigned Unit')}</span>
                                                <span className="text-gray-800 font-bold">{userHRProfile.unit}</span>
                                            </div>
                                        )}

                                        {userHRProfile && userHRProfile.jobTitle && (
                                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">{t('app_extra.profile.job_title', 'Job Title')}</span>
                                                <span className="text-gray-800 font-bold">
                                                    {userHRProfile.jobTitle === 'اخرى' ? userHRProfile.jobTitleOther : userHRProfile.jobTitle}
                                                </span>
                                            </div>
                                        )}

                                        {!userHRProfile && (
                                            <div className="text-center p-2 text-xs text-gray-400 mt-2">
                                                {t('app_extra.profile.no_team_role', 'No specific Program Team role assigned in the HR database yet.')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="border border-gray-200 p-3 rounded-lg bg-gray-50 shadow-sm">
                                    <span className="block text-xs text-gray-500 font-bold mb-1">{t('app_extra.profile.states', 'Assigned States')}</span>
                                    <span className="text-gray-800 font-medium">
                                        {userStates?.length > 0 ? userStates.join(', ') : t('app_extra.profile.global_none', 'Global / None')}
                                    </span>
                                </div>
                                
                                <div className="border border-gray-200 p-3 rounded-lg bg-gray-50 shadow-sm">
                                    <span className="block text-xs text-gray-500 font-bold mb-1">{t('app_extra.profile.localities', 'Assigned Localities')}</span>
                                    <span className="text-gray-800 font-medium">
                                        {userLocalities?.length > 0 ? userLocalities.join(', ') : t('app_extra.profile.all_localities', 'All Localities in State / None')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end rounded-b-lg">
                            <Button onClick={() => setIsUserProfileModalOpen(false)} variant="secondary">
                                {t('app_extra.buttons.close', 'Close')}
                            </Button>
                        </div>
                    </Modal>
                )}
            </Suspense>

            <Suspense fallback={null}>
                {isSyncModalOpen && (
                    <Modal 
                        isOpen={isSyncModalOpen} 
                        onClose={() => setIsSyncModalOpen(false)} 
                        title={t('app_extra.header.sync_status', 'Data Sync Status')}
                    >
                        <div className="p-6 space-y-5">
                            <div className={`p-4 rounded-lg flex items-center gap-4 ${isOffline ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                                {isOffline ? <CloudOff size={28} /> : <Cloud size={28} />}
                                <div>
                                    <h4 className="font-bold text-lg">{isOffline ? t('app_extra.sync.offline_title', 'Currently Offline') : t('app_extra.sync.online_title', 'Connected to Server')}</h4>
                                    <p className="text-sm mt-1">{isOffline ? t('app_extra.sync.offline_desc', 'Changes are being saved locally. They will sync automatically when your connection is restored.') : t('app_extra.sync.online_desc', 'Your connection is stable and the database is reachable.')}</p>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-3 border-b pb-2">
                                    <h4 className="font-semibold text-gray-700">{t('app_extra.sync.waiting', 'Data Waiting for Sync')}</h4>
                                    <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
                                        {t('app_extra.sync.items', '{{n}} items', { n: pendingSyncItems.length })}
                                    </span>
                                </div>
                                
                                {pendingSyncItems.length > 0 ? (
                                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {pendingSyncItems.map((item, idx) => (
                                            <li key={idx} className="bg-white p-3 rounded-md border border-gray-200 shadow-sm flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sky-700 text-sm">{item.type}</span>
                                                    <span className="text-gray-500 text-xs mt-0.5">{item.name}</span>
                                                </div>
                                                <span className="text-xs text-amber-500 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                                    {t('app_extra.sync.pending', 'Pending')}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center py-6 bg-gray-50 rounded border border-dashed border-gray-300">
                                        <p className="text-sm text-gray-500">{t('app_extra.sync.none', 'No tracked items waiting to sync.')}</p>
                                        <p className="text-xs text-gray-400 mt-1">{t('app_extra.sync.firebase', 'Firebase handles background data synchronization automatically.')}</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex justify-end gap-2 border-t">
                                <Button variant="secondary" onClick={() => setIsSyncModalOpen(false)}>
                                    {t('app_extra.buttons.close', 'Close')}
                                </Button>
                                <Button
                                    disabled={isOffline || isSyncing}
                                    onClick={() => {
                                        setIsSyncing(true);
                                        setToast({ show: true, message: t('app_extra.toast.syncing', 'Checking and syncing offline data...'), type: 'info' });
                                        
                                        waitForPendingWrites(db).then(() => {
                                            setToast({ show: true, message: t('app_extra.toast.sync_done', 'All offline data synced successfully.'), type: 'success' });
                                            clearPendingSyncQueue();
                                            setIsSyncModalOpen(false);
                                        }).catch(() => {
                                            setToast({ show: true, message: t('app_extra.toast.sync_failed', 'Sync failed or timed out.'), type: 'error' });
                                        }).finally(() => {
                                            setIsSyncing(false);
                                        });
                                    }}
                                >
                                    {isSyncing ? <Spinner size="sm" /> : t('app_extra.buttons.force_sync', 'Force Sync Now')}
                                </Button>
                            </div>
                        </div>
                    </Modal>
                )}
            </Suspense>

            {/* FOREGROUND PUSH POPUP — portaled to document.body so nothing in
                the app tree can knock it off-centre, and pinned to the visual
                viewport so the keyboard / collapsing URL bar cannot shift it. */}
            <PushPopup
                open={!!actionAlert}
                title={actionAlert?.title}
                body={actionAlert?.body}
                onClose={() => setActionAlert(null)}
                secondaryLabel={t('app_extra.push.dismiss', 'Dismiss')}
                primaryLabel={t('app_extra.push.view_details', 'View details')}
                onPrimary={() => {
                    const data = actionAlert?.data || {};
                    setActionAlert(null);
                    const params = data.actionParams ? JSON.parse(data.actionParams) : {};
                    if (data.actionView) navigate(data.actionView, params);
                }}
            />

            {permissions.canUseSuperUserAdvancedFeatures && isMonitorVisible && (
                <ResourceMonitor counts={operationCounts} onReset={handleResetMonitor} onDismiss={handleDismissMonitor} />
            )}

            <AppUpdateModals />

            {claudeChatOpen && (
                <Suspense fallback={null}>
                    <ClaudeChatPanel isOpen onClose={() => setClaudeChatOpen(false)} />
                </Suspense>
            )}

            {user && !isMinimalUILayout && !dataAssistant.open && !NO_ASSISTANT_BUTTON.has(view) && (
                <DataAssistantButton onClick={openDataAssistant} />
            )}
            {dataAssistant.loaded && (
                <Suspense fallback={null}>
                    <DataAssistantPanel open={dataAssistant.open} onClose={closeDataAssistant} view={view} pageTitle={pageTitle} uid={user?.uid} />
                </Suspense>
            )}

        </div>
    );
}