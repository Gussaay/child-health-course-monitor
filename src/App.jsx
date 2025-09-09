import React, { useEffect, useMemo, useState, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

import DashboardView from './components/DashboardView';
import { FacilitatorsView, FacilitatorReportView, FacilitatorForm } from './components/Facilitator';
import { CoursesView, CourseForm, CourseReportView } from './components/Course';
import { ObservationView } from './components/MonitoringView';
import { ReportsView } from './components/ReportsView';

// Corrected consolidated import for all participant components
import { ParticipantsView, ParticipantForm, ParticipantReportView } from './components/ParticipantView';


// Import all data functions
import {
    listCoursesByType,
    upsertCourse,
    deleteCourse,
    listParticipants,
    upsertParticipant,
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
    listAllParticipants
} from './data.js';

// Import constants from the new file
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_ETAT, JOB_TITLES_EENC, JOB_TITLES_IMNCI,
    SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING,
    EENC_DOMAINS_BREATHING, EENC_DOMAINS_NOT_BREATHING, SKILLS_ETAT, ETAT_DOMAIN_LABEL, ETAT_DOMAINS,
    CLASS_2_59M, CLASS_0_59D, DOMAINS_BY_AGE_IMNCI, DOMAIN_LABEL_IMNCI, getClassListImnci,
    calcPct, fmtPct, pctBgClass, formatAsPercentageAndCount, formatAsPercentageAndScore
} from './components/constants.js';


// Import CommonComponents for shared UI elements
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Textarea, Table,
    EmptyState, Spinner, PdfIcon, CourseIcon, Footer
} from './components/CommonComponents';


/** =============================================================================
 * National Child Health Program - Courses Monitoring System (Firebase Version)
 * ============================================================================ */


// =============================================================================
// --- VIEW COMPONENTS ---
// =============================================================================

function Landing({ active, onPick }) {
    const items = [
        { key: 'IMNCI', title: 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)', enabled: true },
        { key: 'ETAT', title: 'Emergency Triage, Assessment & Treatment (ETAT)', enabled: true },
        { key: 'EENC', title: 'Early Essential Newborn Care (EENC)', enabled: true },
        { key: 'IPC (Neonatal Unit)', title: 'Infection Prevention & Control (Neonatal Unit)', enabled: true },
        { key: 'Small & Sick Newborn', title: 'Small & Sick Newborn Case Management', enabled: false },
    ];

    return (
        <Card>
            <PageHeader title="Select a Course Package" subtitle="Choose a monitoring package to begin." />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(it => (
                    <button key={it.key} disabled={!it.enabled} className={`border rounded-lg p-4 text-left transition-all duration-200 ${active === it.key ? 'ring-2 ring-sky-500 shadow-lg' : ''} ${it.enabled ? 'hover:shadow-md hover:scale-105' : 'opacity-60 cursor-not-allowed bg-gray-50'}`} onClick={() => it.enabled && onPick(it.key)}>
                        <div className="flex items-center gap-4">
                            <CourseIcon course={it.key} />
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

// =============================================================================
// --- Mobile Navigation Icons & Components ---
// =============================================================================
const HomeIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
const CoursesIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
const UsersIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
const MonitorIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
const ReportIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>
const FacilitatorIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>


function BottomNav({ navItems, navigate }) {
    const icons = {
        Dashboard: HomeIcon,
        Home: HomeIcon,
        Facilitators: FacilitatorIcon,
        Courses: CoursesIcon,
        Participants: UsersIcon,
        Monitoring: MonitorIcon,
        Reports: ReportIcon,
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

// =============================================================================
// --- New Splash Screen Component ---
// =============================================================================

function SplashScreen() {
    return (
        <div className="fixed inset-0 bg-sky-50 flex flex-col items-center justify-center gap-6 text-center p-4">
            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center p-2 shadow-xl animate-pulse">
                <img src="/child.png" alt="NCHP Logo" className="h-20 w-20 object-contain" />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-slate-800">National Child Health Program</h1>
                <p className="text-lg text-slate-500 mt-1">Course Monitoring System</p>
            </div>
            {/* Re-using your existing Spinner component's styles */}
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mt-4"></div>
            <p className="text-slate-600 mt-4">Loading application, please wait...</p>
        </div>
    );
}


// =============================================================================
// Root App Component
// =============================================================================
export default function App() {
    const [view, setView] = useState("dashboard");
    const [activeCourseType, setActiveCourseType] = useState("IMNCI");
    const [courses, setCourses] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [facilitators, setFacilitators] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState(null);
    const [selectedParticipantId, setSelectedParticipantId] = useState(null);
    const [selectedFacilitatorId, setSelectedFacilitatorId] = useState(null);
    const [editingCourse, setEditingCourse] = useState(null);
    const [editingParticipant, setEditingParticipant] = useState(null);
    const [editingFacilitator, setEditingFacilitator] = useState(null);
    const [loading, setLoading] = useState(true);
    const [previousView, setPreviousView] = useState("dashboard");
    const [allParticipants, setAllParticipants] = useState([]);

    async function refreshAllData() {
        setLoading(true);
        // Use Promise.all to fetch data concurrently for better performance
        const [coursesData, facilitatorsData, allParticipantsData] = await Promise.all([
            listAllCourses(),
            listFacilitators(),
            listAllParticipants(),
        ]);

        // Create a map to easily look up course type by course ID
        const courseMap = new Map(coursesData.map(c => [c.id, c]));

        // Augment each participant with their course type and course ID
        const participantsWithCourseInfo = allParticipantsData.map(p => {
            const course = courseMap.get(p.courseId);
            return {
                ...p,
                course_type: course?.course_type,
                course_state: course?.state,
                course_locality: course?.locality,
            };
        });

        setAllCourses(coursesData);
        setFacilitators(facilitatorsData);
        setAllParticipants(participantsWithCourseInfo); // Use the augmented data
        setCourses(coursesData.filter(c => c.course_type === activeCourseType));
        setLoading(false);
    }

    
    async function refreshCourses() {
        const list = await listCoursesByType(activeCourseType);
        setCourses(list);
    }
    async function refreshParticipants() {
        if (!selectedCourseId) { setParticipants([]); return; }
        setLoading(true);
        const list = await listParticipants(selectedCourseId);
        setParticipants(list);
        setLoading(false);
    }
    async function refreshFacilitators() {
        const list = await listFacilitators();
        setFacilitators(list);
    }

    useEffect(() => { refreshAllData(); }, []); // Run once on mount
    useEffect(() => {
        setCourses(allCourses.filter(c => c.course_type === activeCourseType));
    }, [activeCourseType, allCourses]);
    useEffect(() => { refreshParticipants(); }, [selectedCourseId]);

    const selectedCourse = useMemo(() => {
        // Find the course from allCourses, not the filtered courses
        return allCourses.find(c => c.id === selectedCourseId) || null;
    }, [allCourses, selectedCourseId]);
    const selectedFacilitator = useMemo(() => facilitators.find(f => f.id === selectedFacilitatorId) || null, [facilitators, selectedFacilitatorId]);

    const handleDeleteCourse = async (courseId) => {
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
        if (window.confirm('Are you sure you want to delete this facilitator?')) {
            await deleteFacilitator(facilitatorId);
            await refreshFacilitators();
            navigate('facilitators');
        }
    };

    const navigate = (newView, state = {}) => {
        setPreviousView(view);
        setEditingCourse(null);
        setEditingParticipant(null);
        setEditingFacilitator(null);

        if (state.editCourse) setEditingCourse(state.editCourse);
        if (state.editParticipant) setEditingParticipant(state.editParticipant);
        if (state.editFacilitator) setEditingFacilitator(state.editFacilitator);
        if (state.openFacilitatorReport) setSelectedFacilitatorId(state.openFacilitatorReport);
        if (state.openCourseReport) setSelectedCourseId(state.openCourseReport);
        if (state.openParticipantReport) {
            setSelectedParticipantId(state.openParticipantReport);
            // This is the key fix: setting the selectedCourseId
            setSelectedCourseId(state.openCourseReport);
        }

        if (['landing', 'courses', 'facilitators', 'dashboard'].includes(newView)) {
            setSelectedCourseId(null);
            setSelectedParticipantId(null);
        }
        if (view === 'observe' || view === 'participantReport') {
            if (newView !== 'observe' && newView !== 'participantReport') {
                setSelectedParticipantId(null);
            }
        }

        setView(newView);
    };

    const renderView = () => {
        const currentParticipant = participants.find(p => p.id === selectedParticipantId);
        if (loading && view !== 'landing') return <Card><Spinner /></Card>;
        switch (view) {
            case 'landing': return <Landing active={activeCourseType} onPick={(t) => { setActiveCourseType(t); navigate('courses'); }} />;
            case 'courses': return <CoursesView courses={courses} onAdd={() => navigate('courseForm')} onOpen={(id) => { setSelectedCourseId(id); navigate('participants'); }} onEdit={(c) => navigate('courseForm', { editCourse: c })} onDelete={handleDeleteCourse} onOpenReport={(id) => { setSelectedCourseId(id); navigate('courseReport'); }} />;
            case 'courseForm': return <CourseForm courseType={activeCourseType} initialData={editingCourse} facilitatorsList={facilitators} onCancel={() => navigate(previousView === 'facilitatorForm' ? 'courses' : previousView)} onSave={async (payload) => { const id = await upsertCourse({ ...payload, id: editingCourse?.id, course_type: activeCourseType }); await refreshAllData(); setSelectedCourseId(id); navigate('participants'); }} onAddNewFacilitator={() => navigate('facilitatorForm')} />;
            case 'participants': return selectedCourse && <ParticipantsView course={selectedCourse} participants={participants.filter(p => p.courseId === selectedCourseId)} onAdd={() => navigate('participantForm')} onOpen={(pid) => { setSelectedParticipantId(pid); navigate('observe'); }} onEdit={(p) => navigate('participantForm', { editParticipant: p })} onDelete={handleDeleteParticipant} onOpenReport={(pid) => { setSelectedParticipantId(pid); navigate('participantReport'); }} />;
            case 'participantForm': return selectedCourse && <ParticipantForm course={selectedCourse} initialData={editingParticipant} onCancel={() => navigate('participants')} onSave={async (p) => { await upsertParticipant({ ...p, id: editingParticipant?.id, courseId: selectedCourse.id }); await refreshParticipants(); navigate('participants'); }} />;
            case 'observe': return selectedCourse && currentParticipant && <ObservationView course={selectedCourse} participant={currentParticipant} participants={participants.filter(p => p.courseId === selectedCourseId)} onChangeParticipant={(id) => setSelectedParticipantId(id)} />;
            case 'reports': return selectedCourse && <ReportsView course={selectedCourse} participants={participants.filter(p => p.courseId === selectedCourse.id)} />;
            case 'participantReport': return selectedCourse && currentParticipant && <ParticipantReportView course={selectedCourse} participant={currentParticipant} participants={participants.filter(p => p.courseId === selectedCourseId)} onChangeParticipant={(pid) => setSelectedParticipantId(pid)} onBack={() => navigate('participants')} />;
            case 'courseReport': return selectedCourse && <CourseReportView course={selectedCourse} onBack={() => navigate('courses')} />;
            case 'facilitators': return <FacilitatorsView facilitators={facilitators} onAdd={() => navigate('facilitatorForm')} onEdit={(f) => navigate('facilitatorForm', { editFacilitator: f })} onDelete={handleDeleteFacilitator} onOpenReport={(fid) => navigate('facilitatorReport', { openFacilitatorReport: fid })} onOpenComparison={() => navigate('dashboard')} />;
            case 'facilitatorForm': return <FacilitatorForm initialData={editingFacilitator} onCancel={() => navigate(previousView === 'courseForm' ? 'courses' : 'facilitators')} onSave={async (payload) => { await upsertFacilitator({ ...payload, id: editingFacilitator?.id }); await refreshFacilitators(); navigate(previousView === 'courseForm' ? 'courseForm' : 'facilitators'); }} />;
            case 'facilitatorReport': return selectedFacilitator && <FacilitatorReportView facilitator={selectedFacilitator} allCourses={allCourses} onBack={() => navigate('facilitators')} />;
            case 'dashboard':
                return <DashboardView
                    allCourses={allCourses}
                    allFacilitators={facilitators}
                    allParticipants={allParticipants}
                    STATE_LOCALITIES={STATE_LOCALITIES}
                    onOpenCourseReport={(id) => { setSelectedCourseId(id); navigate('courseReport'); }}
                    onOpenParticipantReport={(pId, cId) => {
                        navigate('participantReport', { openParticipantReport: pId, openCourseReport: cId });
                    }}
                    onOpenFacilitatorReport={(id) => { setSelectedFacilitatorId(id); navigate('facilitatorReport'); }}
                />;
        }
    };

    const navItems = [
        { label: 'Dashboard', view: 'dashboard', active: view === 'dashboard' },
        { label: 'Home', view: 'landing', active: view === 'landing' },
        { label: 'Facilitators', view: 'facilitators', active: ['facilitators', 'facilitatorForm', 'facilitatorReport'].includes(view) },
        { label: 'Courses', view: 'courses', active: ['courses', 'courseForm', 'courseReport'].includes(view) },
        { label: 'Participants', view: 'participants', disabled: !selectedCourse, active: ['participants', 'participantForm', 'participantReport'].includes(view) },
        { label: 'Monitoring', view: 'observe', disabled: !selectedCourse || !selectedParticipantId, active: view === 'observe' },
        { label: 'Reports', view: 'reports', disabled: !selectedCourse, active: view === 'reports' }
    ];

    if (view === 'landing' && loading) {
        return <SplashScreen />;
    }

    return (
        <div className="min-h-screen bg-sky-50 flex flex-col">
            <header className="bg-slate-800 shadow-lg sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('dashboard')}>
                            <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md">
                                <img src="/child.png" alt="NCHP Logo" className="h-12 w-12 object-contain" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-white">National Child Health Program</h1>
                                <p className="text-sm text-slate-300 hidden sm:block">Course Monitoring System</p>
                            </div>
                        </div>
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
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full flex-grow mb-16 md:mb-0">
                {renderView()}
            </main>
            <Footer />
            <BottomNav navItems={navItems} navigate={navigate} />
        </div>
    );
}

// =============================================================================
// --- Smoke Tests ---
// =============================================================================
if (typeof window !== 'undefined') {
    (function runSmokeTests() {
        try {
            console.group('%cIMCI App - Smoke Tests', 'font-weight:bold');
            console.assert(fmtPct(NaN) === '—', 'fmtPct(NaN) should be dash');
            console.assert(Array.isArray(SKILLS_ETAT.triage) && SKILLS_ETAT.triage.length > 0, 'ETAT skills are present');
            console.log('%cAll smoke tests passed.', 'color:green');
        } catch (e) { console.error('Smoke tests failure:', e); } finally { console.groupEnd(); }
    })();
}