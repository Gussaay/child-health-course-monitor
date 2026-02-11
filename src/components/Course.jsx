// src/components/Course.jsx
import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Line } from 'react-chartjs-2';
import { 
    Button, Card, EmptyState, FormGroup, Input, PageHeader, PdfIcon, 
    Select, Spinner, Table, Textarea, CourseIcon, Modal, CardBody, CardFooter 
} from './CommonComponents'; 
import { 
    listAllDataForCourse, listParticipants, listCoordinators, upsertCoordinator, 
    deleteCoordinator, listFunders, upsertFunder, deleteFunder, listFinalReport, 
    upsertFinalReport, deleteFinalReport, uploadFile, getParticipantById, 
    getCourseById, listAllParticipantsForCourse,
    listHealthFacilities,
    saveParticipantAndSubmitFacilityUpdate
} from '../data.js'; 
import { ParticipantsView, ParticipantForm } from './Participants';
import { CourseTestForm } from './CourseTestForm'; 
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES,
} from './constants.js';
import html2canvas from 'html2canvas';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS } from './AdminDashboard';
import { generateCertificatePdf } from './CertificateGenerator'; 
import { 
    Users, Download, Calendar, Clock, Share2, UserPlus, CheckCircle, 
    FileText, Edit, Trash2, ExternalLink, Link as LinkIcon, Eye, BarChart2,
    AlertTriangle, Shield, Check, X, RefreshCw, Archive, ClipboardList
} from 'lucide-react'; 
import { useDataCache } from '../DataContext'; 

// Lazy load components that are not always visible to speed up initial load
const ReportsView = React.lazy(() => import('./ReportsView').then(module => ({ default: module.ReportsView })));
const ObservationView = React.lazy(() => import('./MonitoringView').then(module => ({ default: module.ObservationView })));


// ... [Keep helper functions: calcPct, fmtPct, pctBgClass, generateFullCourseReportPdf, Icons, etc.] ...
const calcPct = (correct, total) => {
    if (total === 0) {
        return 0;
    }
    return (correct / total) * 100;
};

const fmtPct = (value) => {
    if (isNaN(value) || value === null) return 'N/A';
    return `${value.toFixed(1)}%`;
};

const pctBgClass = (value, customClasses) => {
    if (isNaN(value) || value === null) {
        return 'bg-gray-100 text-gray-800';
    }
    const classes = customClasses || '>80:bg-green-100;60-80:bg-yellow-100;<60:bg-red-100';
    const rules = classes.split(';').map(r => r.split(':'));
    for (const rule of rules) {
        const [condition, bgClass] = rule;
        if (condition.includes('>=')) {
            const num = parseFloat(condition.replace('>=', ''));
            if (value >= num) return bgClass;
        } else if (condition.includes('>')) {
            const num = parseFloat(condition.replace('>', ''));
            if (value > num) return bgClass;
        } else if (condition.includes('<=')) {
            const num = parseFloat(condition.replace('<', ''));
            if (value <= num) return bgClass;
        } else if (condition.includes('<')) {
            const num = parseFloat(condition.replace('<', ''));
            if (value < num) return bgClass;
        } else if (condition.includes('-')) {
            const [min, max] = condition.split('-').map(Number);
            if (value >= min && value <= max) return bgClass;
        }
    }
    return '';
};

const HospitalIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v2.85c-.9.17-1.72.6-2.43 1.24L4.3 11.2a1 1 0 0 0-.2 1.39l.2.2c.45.6.84 1.34 1.36 2.14L6 15l2.43-1.6c.71-.48 1.54-.74 2.43-.84V14a1 1 0 0 0 1 1h2c.7 0 1.25-.56 1.25-1.25S15.7 12.5 15 12.5V11a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v1.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V9.85c-.9-.1-1.72-.36-2.43-.84L4.3 7.8a1 1 0 0 0-.2-1.39l.2-.2c.45-.6.84-1.34 1.36-2.14L6 3l2.43 1.6c.71.48 1.54-.74 2.43 .84V5a3 3 0 0 0-3-3zM12 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2zM18 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2z"></path><path d="M12 18.5V22"></path><path d="M12 11h-2"></path><path d="M14 11h2"></path><path d="M18 11h2"></path></svg>;

const IccmIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline><path d="M12 9v6"></path><path d="M9 12h6"></path></svg>;
const IpcIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 11v4"></path><path d="M10 13h4"></path></svg>;
const NewbornIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9c0-2-1.5-3.5-4-3.5C7.5 5.5 6 7 6 9c0 1.5.5 2.5 1 3.5h0l-1 4.5h10L17 17l-1-4.5h0c.5-1 1-2.5 1-3.5z"></path><path d="M12 18h.01"></path><path d="M10.5 21v-1.5h3V21"></path></svg>;

export const PublicParticipantRegistrationModal = ({ isOpen, onClose, course, onSuccess }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [group, setGroup] = useState('Group A');
    const [facilityId, setFacilityId] = useState('');
    const [facilityName, setFacilityName] = useState(''); 
    
    const [facilities, setFacilities] = useState([]);
    const [loadingFacilities, setLoadingFacilities] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [isFacilitySelectorOpen, setIsFacilitySelectorOpen] = useState(false);

    // Load job titles based on course type
    const jobOptions = useMemo(() => {
        if (course.course_type === 'ICCM') return ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
        return ['Medical Doctor', 'Nurse', 'Midwife', 'Medical Assistant', 'Health Visitor', 'Nutritionist', 'Vaccinator'];
    }, [course.course_type]);

    useEffect(() => {
        if (course.state && course.locality && isOpen) {
            setLoadingFacilities(true);
            listHealthFacilities({ state: course.state, locality: course.locality }, 'server')
                .then(data => {
                    const formatted = data.map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }));
                    setFacilities(formatted);
                })
                .catch(err => console.error("Failed to load facilities", err))
                .finally(() => setLoadingFacilities(false));
        }
    }, [course.state, course.locality, isOpen]);

    const handleSave = async () => {
        setError('');
        if (!name.trim()) return setError('Name is required');
        if (!phone.trim()) return setError('Phone is required');
        if (!jobTitle) return setError('Job Title is required');
        if (!facilityId) return setError('Please select a valid Facility from the list'); 

        setIsSaving(true);
        try {
            const participantData = {
                name: name.trim(),
                phone: phone.trim(),
                job_title: jobTitle,
                group: group,
                state: course.state,
                locality: course.locality,
                center_name: facilityName, 
                courseId: course.id,
                facilityId: facilityId 
            };

            await saveParticipantAndSubmitFacilityUpdate(participantData, null);
            
            if (onSuccess) onSuccess(participantData);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFacilitySelect = (fac) => {
        setFacilityId(fac.id);
        setFacilityName(fac.name);
        setIsFacilitySelectorOpen(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Register New Participant" size="lg">
            <CardBody className="p-6">
                {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormGroup label="Full Name">
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter full name" />
                    </FormGroup>
                    <FormGroup label="Phone Number">
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0xxxxxxxxx" />
                    </FormGroup>
                    
                    <FormGroup label="Job Title">
                        <Select value={jobTitle} onChange={e => setJobTitle(e.target.value)}>
                            <option value="">-- Select Job --</option>
                            {jobOptions.map(j => <option key={j} value={j}>{j}</option>)}
                        </Select>
                    </FormGroup>

                    <FormGroup label="Group">
                        <Select value={group} onChange={e => setGroup(e.target.value)}>
                            <option>Group A</option>
                            <option>Group B</option>
                            <option>Group C</option>
                            <option>Group D</option>
                        </Select>
                    </FormGroup>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Health Facility (in {course.locality})
                        </label>
                        
                        {/* Searchable Select for Facility (Read-only selection from list) */}
                        <div className="relative">
                            <Input 
                                value={facilityName} 
                                onChange={(e) => {
                                    setFacilityName(e.target.value);
                                    setFacilityId(''); // Clear ID if user types something new
                                    setIsFacilitySelectorOpen(true);
                                }}
                                onFocus={() => setIsFacilitySelectorOpen(true)}
                                placeholder="Search facility name..."
                                disabled={loadingFacilities}
                            />
                            {loadingFacilities && <div className="absolute right-3 top-2.5"><Spinner size="sm" /></div>}
                            
                            {isFacilitySelectorOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {facilities.length > 0 ? (
                                        facilities
                                            .filter(f => f.name.toLowerCase().includes(facilityName.toLowerCase()))
                                            .map(f => (
                                                <div 
                                                    key={f.id} 
                                                    className="p-2 cursor-pointer hover:bg-gray-100"
                                                    onClick={() => handleFacilitySelect(f)}
                                                >
                                                    {f.name}
                                                </div>
                                            ))
                                    ) : (
                                        <div className="p-2 text-gray-500">No facilities found.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardBody>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Spinner size="sm" /> : 'Register & Save'}
                </Button>
            </CardFooter>
        </Modal>
    );
};

export function PublicParticipantRegistrationView({ courseId }) {
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        getCourseById(courseId, 'server')
            .then(data => {
                if (!data) throw new Error("Course not found");
                setCourse(data);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [courseId]);

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;
    if (!course) return <EmptyState message="Course data unavailable" />;

    if (successMessage) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful</h2>
                <p className="text-gray-600 mb-6">{successMessage}</p>
                <Button onClick={() => setSuccessMessage('')}>Register Another Participant</Button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto mt-6 p-4">
            <Card className="text-center p-8">
                <div className="mx-auto h-20 w-20 bg-sky-100 rounded-full flex items-center justify-center mb-6">
                    <UserPlus className="h-10 w-10 text-sky-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Course Registration</h1>
                <p className="text-lg text-gray-600 mb-1">{course.course_type}</p>
                <p className="text-sm text-gray-500 mb-8">{course.state} - {course.locality} ({course.start_date})</p>

                <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6 text-left text-sm text-blue-800">
                    <p><strong>Note:</strong> Use this form to register yourself or a participant if you are not already on the list.</p>
                </div>

                <Button size="lg" className="w-full justify-center" onClick={() => setShowModal(true)}>
                    Register New Participant
                </Button>
            </Card>

            <PublicParticipantRegistrationModal 
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                course={course}
                onSuccess={(participant) => {
                    setSuccessMessage(`Successfully registered ${participant.name}.`);
                    setShowModal(false);
                }}
            />
        </div>
    );
}

const Landing = React.memo(function Landing({ active, onPick }) {
   const items = [
        { key: 'IMNCI', title: 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)', enabled: true },
        { key: 'ICCM', title: 'Integrated Community case management for under 5 children (iCCM)', enabled: true },
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
                            {it.key === 'ICCM' ? <IccmIcon className="w-10 h-10 text-slate-500 flex-shrink-0" /> :
                             it.key === 'IPC' ? <IpcIcon className="w-10 h-10 text-slate-500 flex-shrink-0" /> :
                             it.key === 'Small & Sick Newborn' ? <NewbornIcon className="w-10 h-10 text-slate-500 flex-shrink-0" /> :
                                <CourseIcon course={it.key} />
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
});


// --- CoursesTable with Added Report Button & Modal ---
export function CoursesTable({ 
    courses, onOpen, onEdit, onDelete, onOpenReport, onOpenTestForm, 
    canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates, onAddFinalReport, canManageFinalReport,
    onOpenAttendanceManager 
}) {
    const [shareModalCourse, setShareModalCourse] = useState(null);
    const [reportModalCourse, setReportModalCourse] = useState(null);
    const [deleteRequestCourse, setDeleteRequestCourse] = useState(null); 
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

    const isCourseActive = (course) => {
        if (!course.start_date || !course.course_duration || course.course_duration <= 0) {
            return false;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(course.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + course.course_duration);
        return today >= startDate && today < endDate;
    };

    const filteredCourses = useMemo(() => {
        if (!userStates || userStates.length === 0) {
            return courses;
        }
        return courses.filter(c => userStates.includes(c.state));
    }, [courses, userStates]);

    const sortedCourses = [...filteredCourses].sort((a, b) => {
        const aActive = isCourseActive(a);
        const bActive = isCourseActive(b);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return 0;
    });

    const courseType = sortedCourses.length > 0 ? sortedCourses[0].course_type : 'Courses';

    return (
        sortedCourses.length === 0 ? <EmptyState message="No courses found matching the selected filters." /> : ( 
            <div>
                <h3 className="text-xl font-bold mb-4">{courseType} Courses</h3>
                <Table headers={["State", "Subcourses", "Status", "Actions"]}>
                    {sortedCourses.map((c, index) => {
                        // Pending deletion flag
                        const isPendingDeletion = c.deletionRequested === true;
                        
                        const active = isCourseActive(c);
                        const canEdit = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                        const canDelete = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                        
                        const subcourses = c.facilitatorAssignments && c.facilitatorAssignments.length > 0
                            ? [...new Set(c.facilitatorAssignments.map(a => a.imci_sub_type))].join(', ')
                            : 'N/A';

                        return (
                            <tr key={c.id} className={`hover:bg-gray-50 ${isPendingDeletion ? 'bg-red-50' : ''}`}>
                                <td className="p-4 border">
                                    {c.state}
                                    {isPendingDeletion && <span className="block text-xs text-red-600 font-bold mt-1">(Deletion Pending)</span>}
                                </td>
                                <td className="p-4 border">{subcourses}</td>
                                <td className="p-4 border">
                                    {active ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            Inactive
                                        </span>
                                    )}
                                </td>
                                <td className="p-2 border text-right whitespace-nowrap">
                                    <div className="flex gap-2 justify-end items-center">
                                        <Button 
                                            variant="primary" 
                                            className="px-3 py-1 text-sm flex items-center gap-1" 
                                            onClick={() => onOpen(c.id)}
                                        >
                                           <ExternalLink size={14} /> Open
                                        </Button>

                                        <Button
                                            variant="secondary"
                                            className="px-3 py-1 text-sm flex items-center gap-1"
                                            onClick={() => onEdit(c)}
                                            disabled={!canEdit || isPendingDeletion}
                                            title={!canEdit ? "You do not have permission to edit." : ""}
                                        >
                                            <Edit size={14} /> Edit
                                        </Button>

                                        {/* --- REPORT BUTTON --- */}
                                        <Button
                                            variant="secondary"
                                            className="px-3 py-1 text-sm flex items-center gap-1"
                                            onClick={() => setReportModalCourse(c)}
                                        >
                                            <FileText size={14} /> Reports
                                        </Button>
                                        
                                        <Button 
                                            variant="secondary" 
                                            className="px-3 py-1 text-sm flex items-center gap-1" 
                                            onClick={() => setShareModalCourse(c)}
                                        >
                                           <Share2 size={14} /> Share
                                        </Button>
                                        
                                        <Button
                                            variant="danger"
                                            className="px-3 py-1 text-sm flex items-center gap-1"
                                            onClick={() => setDeleteRequestCourse(c)}
                                            disabled={!canDelete || isPendingDeletion}
                                            title={isPendingDeletion ? "Deletion already requested" : (!canDelete ? "No permission" : "")}
                                        >
                                           <Trash2 size={14} /> Delete
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </Table>

                {/* --- SHARE & MANAGE MODAL (Updated) --- */}
                {shareModalCourse && (
                    <Modal isOpen={!!shareModalCourse} onClose={() => setShareModalCourse(null)} title="Share Public Links">
                         <CardBody className="flex flex-col gap-6 p-4">
                            <div>
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <Share2 size={16} /> Public Links
                                </h4>
                                <div className="space-y-3 pl-2">
                                    <div className="bg-gray-50 p-3 rounded border">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-semibold">Participant Registration</span>
                                            <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => { const link = `${window.location.origin}/public/register/course/${shareModalCourse.id}`; navigator.clipboard.writeText(link).then(() => alert('Registration link copied!')); }}><LinkIcon size={14} /> Copy Link</Button>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded border">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-semibold">Course Monitoring</span>
                                            <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => { const link = `${window.location.origin}/monitor/course/${shareModalCourse.id}`; navigator.clipboard.writeText(link).then(() => alert('Monitoring link copied!')); }}><Eye size={14} /> Copy Link</Button>
                                        </div>
                                    </div>
                                    
                                    {/* TESTING SECTION WITH TITLE */}
                                    {(['ICCM', 'EENC', 'Small & Sick Newborn', 'IMNCI', 'ETAT'].includes(shareModalCourse.course_type)) && (
                                        <div className="bg-gray-50 p-3 rounded border">
                                            <span className="text-sm font-semibold block mb-2">Testing</span>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="secondary" size="sm" className="flex items-center gap-1 justify-center" onClick={() => { const link = `${window.location.origin}/public/test/course/${shareModalCourse.id}?type=pre`; navigator.clipboard.writeText(link).then(() => alert('Pre-Test link copied!')); }}><FileText size={14} /> Copy Pre-Test</Button>
                                                <Button variant="secondary" size="sm" className="flex items-center gap-1 justify-center" onClick={() => { const link = `${window.location.origin}/public/test/course/${shareModalCourse.id}?type=post`; navigator.clipboard.writeText(link).then(() => alert('Post-Test link copied!')); }}><FileText size={14} /> Copy Post-Test</Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ATTENDANCE MOVED TO BOTTOM */}
                                    <div className="bg-gray-50 p-3 rounded border">
                                        <span className="text-sm font-semibold block mb-2">Daily Attendance</span>
                                        <div className="flex gap-2">
                                            <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="py-1 text-sm" />
                                            <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => { const link = `${window.location.origin}/attendance/course/${shareModalCourse.id}?date=${attendanceDate}`; navigator.clipboard.writeText(link).then(() => alert(`Attendance link for ${attendanceDate} copied!`)); }}><LinkIcon size={14} /> Copy Link</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                        <CardFooter>
                            <Button variant="secondary" onClick={() => setShareModalCourse(null)}>Close</Button>
                        </CardFooter>
                    </Modal>
                )}

                {/* --- REPORTS MODAL --- */}
                {reportModalCourse && (
                    <Modal isOpen={!!reportModalCourse} onClose={() => setReportModalCourse(null)} title="Course Reports">
                        <CardBody className="p-6 flex flex-col gap-3">
                            <p className="text-sm text-gray-500 mb-2">Access all reporting and analysis tools for this course.</p>
                            
                            <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => { onOpenReport(reportModalCourse.id); setReportModalCourse(null); }}>
                                <div className="bg-blue-100 p-2 rounded-full"><BarChart2 className="text-blue-600" size={20} /></div>
                                <div className="text-left">
                                    <div className="font-semibold text-gray-800">Course Analytics</div>
                                    <div className="text-xs text-gray-500">View charts and performance metrics</div>
                                </div>
                            </Button>

                            <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => { onOpenAttendanceManager(reportModalCourse.id); setReportModalCourse(null); }}>
                                <div className="bg-green-100 p-2 rounded-full"><ClipboardList className="text-green-600" size={20} /></div>
                                <div className="text-left">
                                    <div className="font-semibold text-gray-800">Attendance Dashboard</div>
                                    <div className="text-xs text-gray-500">View daily attendance logs</div>
                                </div>
                            </Button>

                            {canManageFinalReport && (
                                <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => { onAddFinalReport(reportModalCourse.id); setReportModalCourse(null); }}>
                                    <div className="bg-purple-100 p-2 rounded-full"><FileText className="text-purple-600" size={20} /></div>
                                    <div className="text-left">
                                        <div className="font-semibold text-gray-800">Final Report</div>
                                        <div className="text-xs text-gray-500">Generate or view the narrative report</div>
                                    </div>
                                </Button>
                            )}

                             {/* --- NEW SHARE REPORT BUTTON --- */}
                            <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => {
                                const link = `${window.location.origin}/public/report/course/${reportModalCourse.id}`;
                                navigator.clipboard.writeText(link).then(() => alert('Report link copied to clipboard!'));
                            }}>
                                <div className="bg-indigo-100 p-2 rounded-full"><LinkIcon className="text-indigo-600" size={20} /></div>
                                <div className="text-left">
                                    <div className="font-semibold text-gray-800">Share Report Link</div>
                                    <div className="text-xs text-gray-500">Copy public link to course report</div>
                                </div>
                            </Button>

                        </CardBody>
                        <CardFooter>
                             <Button variant="secondary" onClick={() => setReportModalCourse(null)}>Close</Button>
                        </CardFooter>
                    </Modal>
                )}

                {/* --- Deletion Request Confirmation Modal --- */}
                {deleteRequestCourse && (
                    <Modal isOpen={!!deleteRequestCourse} onClose={() => setDeleteRequestCourse(null)} title="Request Course Deletion">
                        <CardBody className="p-6">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">Confirm Deletion Request</h3>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Are you sure you want to delete the course <strong>{deleteRequestCourse.course_type} ({deleteRequestCourse.state})</strong>?
                                    </p>
                                    <p className="text-sm text-gray-600 mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-left">
                                        <strong>Note:</strong> This action will not delete the course immediately. It will be marked for deletion and sent to the <strong>Course Administration</strong> tab for approval. Approved courses will be moved to the <strong>Recycle Bin</strong>.
                                    </p>
                                </div>
                            </div>
                        </CardBody>
                        <CardFooter className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setDeleteRequestCourse(null)}>Cancel</Button>
                            <Button variant="danger" onClick={() => {
                                // Request update: true = isRequest
                                onDelete(deleteRequestCourse.id, true); 
                                setDeleteRequestCourse(null);
                            }}>
                                Request Deletion
                            </Button>
                        </CardFooter>
                    </Modal>
                )}
            </div>
        )
    );
}

export { PublicAttendanceView, AttendanceManagerView } from './CourseAttendanceView';

// --- Recycle Bin View ---
function RecycleBinView({ courses, onRestore, onPermanentDelete }) {
    if (courses.length === 0) {
        return <EmptyState message="The recycle bin is empty." />;
    }

    return (
        <div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Archive className="text-gray-600" /> Recycle Bin
            </h3>
            <div className="bg-gray-50 border-l-4 border-gray-400 p-4 mb-4">
                <p className="text-sm text-gray-700">
                    Courses in the recycle bin are hidden from the main list. You can restore them or permanently delete them.
                </p>
            </div>

            <Table headers={["Course Type", "Location", "Start Date", "Coordinator", "Actions"]}>
                {courses.map(c => (
                    <tr key={c.id} className="bg-white hover:bg-gray-50 opacity-75">
                        <td className="p-4 border font-medium">{c.course_type}</td>
                        <td className="p-4 border">{c.state} - {c.locality}</td>
                        <td className="p-4 border">{c.start_date}</td>
                        <td className="p-4 border">{c.coordinator || 'N/A'}</td>
                        <td className="p-4 border text-right">
                            <div className="flex justify-end gap-2">
                                <Button 
                                    variant="secondary" 
                                    className="flex items-center gap-1"
                                    onClick={() => onRestore(c)}
                                >
                                    <RefreshCw size={14} /> Restore
                                </Button>
                                <Button 
                                    variant="danger" 
                                    className="flex items-center gap-1"
                                    onClick={() => onPermanentDelete(c.id)}
                                >
                                    <X size={14} /> Delete Forever
                                </Button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </div>
    );
}

// --- Course Administration View ---
function CourseAdministrationView({ courses, onApproveDelete, onRejectDelete }) {
    // Only show pending deletion requests that are NOT already in recycle bin
    const pendingCourses = useMemo(() => courses.filter(c => c.deletionRequested === true && !c.inRecycleBin), [courses]);

    if (pendingCourses.length === 0) {
        return <EmptyState message="No pending administrative tasks (e.g., deletion requests) at this time." />;
    }

    return (
        <div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="text-sky-600" /> Course Administration
            </h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                            The following courses have been requested for deletion. Approving will move them to the <strong>Recycle Bin</strong>.
                        </p>
                    </div>
                </div>
            </div>

            <Table headers={["Course Type", "Location", "Start Date", "Coordinator", "Actions"]}>
                {pendingCourses.map(c => (
                    <tr key={c.id} className="bg-white hover:bg-gray-50">
                        <td className="p-4 border font-medium">{c.course_type}</td>
                        <td className="p-4 border">{c.state} - {c.locality}</td>
                        <td className="p-4 border">{c.start_date}</td>
                        <td className="p-4 border">{c.coordinator || 'N/A'}</td>
                        <td className="p-4 border text-right">
                            <div className="flex justify-end gap-2">
                                <Button 
                                    variant="secondary" 
                                    className="text-green-700 border-green-200 hover:bg-green-50 flex items-center gap-1"
                                    onClick={() => onRejectDelete(c)}
                                >
                                    <X size={14} /> Reject
                                </Button>
                                <Button 
                                    variant="danger" 
                                    className="flex items-center gap-1"
                                    onClick={() => onApproveDelete(c.id)}
                                >
                                    <Check size={14} /> Approve (Move to Bin)
                                </Button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </div>
    );
}

export function CourseManagementView({
    allCourses, onOpen, onDelete, onOpenReport,
    onOpenTestForm,
    canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates,
    activeCoursesTab, setActiveCoursesTab, selectedCourse,
    participants,
    participantTests,
    onAddParticipant, onEditParticipant, onDeleteParticipant,
    onOpenParticipantReport, onImportParticipants, onAddFinalReport, onEditFinalReport,
    selectedParticipantId, onSetSelectedParticipantId, onBulkMigrate, onBatchUpdate,
    loadingDetails,
    canManageCourse,
    canUseSuperUserAdvancedFeatures,
    canUseFederalManagerAdvancedFeatures,
    activeCourseType,
    setActiveCourseType,
    onSaveParticipantTest,
    
    onSaveParticipant, 

    facilitatorsList,
    onSaveCourse, 
    // These are no longer needed as adding new is disabled
    onAddNewFacilitator,
    onAddNewCoordinator,
    onAddNewFunder,
    onOpenAttendanceManager // Receive prop
}) {
    const { 
        federalCoordinators, fetchFederalCoordinators,
        stateCoordinators, fetchStateCoordinators,
        localityCoordinators, fetchLocalityCoordinators,
        funders, fetchFunders
    } = useDataCache();

    useEffect(() => {
        fetchFederalCoordinators();
        fetchStateCoordinators();
        fetchLocalityCoordinators();
        fetchFunders();
    }, []); 

    const currentParticipant = participants.find(p => p.id === selectedParticipantId);

    const [courseToEdit, setCourseToEdit] = useState(null);

    // Filter logic...
    const coursesForActiveType = useMemo(() => {
        if (!activeCourseType) return [];
        return allCourses.filter(c => c.course_type === activeCourseType);
    }, [allCourses, activeCourseType]);

    // ... [Filters state and logic: filterState, filterLocality, etc.] ...
    const [filterState, setFilterState] = useState('All');
    const [filterLocality, setFilterLocality] = useState('All');
    const [filterSubCourse, setFilterSubCourse] = useState('All');

    const filterStateOptions = useMemo(() => {
        const states = new Set(coursesForActiveType.map(c => c.state));
        return ['All', ...Array.from(states).sort()];
    }, [coursesForActiveType]);

    const filterLocalityOptions = useMemo(() => {
        const localities = new Set();
        coursesForActiveType.forEach(c => {
            if (filterState === 'All' || c.state === filterState) {
                localities.add(c.locality);
            }
        });
        return ['All', ...Array.from(localities).sort()];
    }, [coursesForActiveType, filterState]);

    const filterSubCourseOptions = useMemo(() => {
        const subCourses = new Set();
        coursesForActiveType.forEach(c => {
            if (c.facilitatorAssignments && c.facilitatorAssignments.length > 0) {
                c.facilitatorAssignments.forEach(a => subCourses.add(a.imci_sub_type));
            }
        });
        return ['All', ...Array.from(subCourses).sort()];
    }, [coursesForActiveType]);

    useEffect(() => {
        setFilterState('All');
        setFilterLocality('All');
        setFilterSubCourse('All');
    }, [activeCourseType]);

    useEffect(() => {
        setFilterLocality('All');
    }, [filterState]);

    // **UPDATED**: Filter main list to exclude recycled courses
    const courses = useMemo(() => {
        return coursesForActiveType.filter(c => {
            // Exclude courses in Recycle Bin
            if (c.inRecycleBin) return false;

            const stateMatch = filterState === 'All' || c.state === filterState;
            const localityMatch = filterLocality === 'All' || c.locality === filterLocality;
            
            const subCourseMatch = filterSubCourse === 'All' || 
                (c.facilitatorAssignments && c.facilitatorAssignments.some(a => a.imci_sub_type === filterSubCourse));

            return stateMatch && localityMatch && subCourseMatch;
        });
    }, [coursesForActiveType, filterState, filterLocality, filterSubCourse]);

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

    // Permissions
    const canAccessAdminTab = canUseFederalManagerAdvancedFeatures || canManageCourse;
    const canAccessRecycleBin = canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures;

    const handleOpenCourse = (id) => {
        onOpen(id);
        onSetSelectedParticipantId(null);
    };

    const handleOpenTestForm = async (courseId) => {
        if (onOpen) {
            await onOpen(courseId); 
        }
        onSetSelectedParticipantId(null); 
        setActiveCoursesTab('enter-test-scores'); 
    };

    const handleOpenTestFormForParticipant = (participantId) => {
        onSetSelectedParticipantId(participantId);
        setActiveCoursesTab('enter-test-scores');
    };

    const handleOpenAddForm = () => {
        setCourseToEdit(null); 
        setActiveCoursesTab('add-course'); 
    };

    const handleOpenEditForm = (course) => {
        setCourseToEdit(course); 
        setActiveCoursesTab('edit-course'); 
    };

    const handleCancelCourseForm = () => {
        setCourseToEdit(null);
        setActiveCoursesTab('courses'); 
    };

    const handleSaveCourseAndReturn = async (courseData) => {
        if (onSaveCourse) {
            await onSaveCourse(courseData); 
        }
        setActiveCoursesTab('courses'); 
        setCourseToEdit(null);
    };

    // Modified Delete Handler
    const handleCourseDeleteAction = async (courseId, isRequest = false) => {
        const courseToUpdate = allCourses.find(c => c.id === courseId);
        
        if (isRequest) {
            if (courseToUpdate) {
                await onSaveCourse({ ...courseToUpdate, deletionRequested: true });
                alert("Deletion requested. Please wait for approval.");
            }
        } else {
            // APPROVAL ACTION: Move to Recycle Bin (Soft Delete)
            if (courseToUpdate) {
                // Clear request flag, set recycle bin flag
                await onSaveCourse({ ...courseToUpdate, deletionRequested: false, inRecycleBin: true });
            }
        }
    };

    const handleRejectDelete = async (course) => {
         await onSaveCourse({ ...course, deletionRequested: false });
    };

    // Recycle Bin Actions
    const handleRestoreCourse = async (course) => {
        if (window.confirm(`Are you sure you want to restore the course: ${course.course_type}?`)) {
            await onSaveCourse({ ...course, inRecycleBin: false });
        }
    };

    const handlePermanentDelete = async (courseId) => {
        if (window.confirm("Are you sure? This will permanently delete the course and cannot be undone.")) {
            await onDelete(courseId);
        }
    };

    return (
        <Card>
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
                <Button variant="tab" isActive={activeCoursesTab === 'courses' || activeCoursesTab === 'add-course' || activeCoursesTab === 'edit-course'} onClick={() => setActiveCoursesTab('courses')}>Courses</Button>

                {canAccessAdminTab && (
                    <Button variant="tab" isActive={activeCoursesTab === 'administration'} onClick={() => { setActiveCoursesTab('administration'); onSetSelectedParticipantId(null); }}>
                        Administration
                         {/* Show badge for pending requests not yet in bin */}
                         {allCourses.filter(c => c.deletionRequested && !c.inRecycleBin).length > 0 && (
                             <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                                 {allCourses.filter(c => c.deletionRequested && !c.inRecycleBin).length}
                             </span>
                         )}
                    </Button>
                )}

                {canAccessRecycleBin && (
                    <Button variant="tab" isActive={activeCoursesTab === 'recycle-bin'} onClick={() => { setActiveCoursesTab('recycle-bin'); onSetSelectedParticipantId(null); }}>
                        Recycle Bin
                         {/* Show badge for items in bin */}
                         {allCourses.filter(c => c.inRecycleBin).length > 0 && (
                             <span className="ml-2 bg-gray-200 text-gray-800 text-xs px-2 py-0.5 rounded-full">
                                 {allCourses.filter(c => c.inRecycleBin).length}
                             </span>
                         )}
                    </Button>
                )}

                {selectedCourse && (
                    <>
                        <Button variant="tab" isActive={activeCoursesTab === 'participants'} onClick={() => { setActiveCoursesTab('participants'); onSetSelectedParticipantId(null); }}>Participants</Button>
                        <Button variant="tab" isActive={activeCoursesTab === 'monitoring'} onClick={() => setActiveCoursesTab('monitoring')} disabled={!currentParticipant}>Monitoring</Button>
                        <Button variant="tab" isActive={activeCoursesTab === 'reports'} onClick={() => setActiveCoursesTab('reports')}>Reports</Button>
                        {(selectedCourse.course_type === 'ICCM' || selectedCourse.course_type === 'EENC' || selectedCourse.course_type === 'Small & Sick Newborn' || selectedCourse.course_type === 'IMNCI' || selectedCourse.course_type === 'ETAT') && (
                            <Button variant="tab" isActive={activeCoursesTab === 'enter-test-scores'} onClick={() => { setActiveCoursesTab('enter-test-scores'); }}>
                                Test Scores
                            </Button>
                        )}
                    </>
                )}
            </div>
            
            <div className="p-4">
                {activeCoursesTab === 'courses' && (
                    <>
                        {!activeCourseType ? (
                            <Landing
                                active={activeCourseType}
                                onPick={(t) => setActiveCourseType(t)}
                            />
                        ) : (
                            <div>
                                <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
                                    {canManageCourse && (
                                        <Button onClick={handleOpenAddForm} className="bg-sky-600 text-white hover:bg-sky-700">Add New Course</Button>
                                    )}
                                    <Button variant="secondary" onClick={() => setActiveCourseType(null)}>
                                        Change Course Package
                                    </Button>
                                </div>
                                
                                <Card className="p-4 mb-4 bg-gray-50">
                                    <h4 className="text-lg font-semibold mb-3">Filter Courses</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormGroup label="Filter by State">
                                            <Select value={filterState} onChange={(e) => setFilterState(e.target.value)}>
                                                {filterStateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="Filter by Locality">
                                            <Select value={filterLocality} onChange={(e) => setFilterLocality(e.target.value)} disabled={filterLocalityOptions.length <= 1}>
                                                {filterLocalityOptions.map(l => <option key={l} value={l}>{l}</option>)}
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="Filter by Sub-course">
                                            <Select value={filterSubCourse} onChange={(e) => setFilterSubCourse(e.target.value)} disabled={filterSubCourseOptions.length <= 1}>
                                                {filterSubCourseOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                            </Select>
                                        </FormGroup>
                                    </div>
                                </Card>
                                
                                <CoursesTable
                                    courses={courses}
                                    onOpen={handleOpenCourse}
                                    onEdit={handleOpenEditForm} 
                                    onDelete={handleCourseDeleteAction} // Updated handler
                                    onOpenReport={onOpenReport}
                                    onOpenTestForm={handleOpenTestForm}
                                    onOpenAttendanceManager={onOpenAttendanceManager} 
                                    canEditDeleteActiveCourse={canEditDeleteActiveCourse}
                                    canEditDeleteInactiveCourse={canEditDeleteInactiveCourse}
                                    userStates={userStates}
                                    onAddFinalReport={onAddFinalReport}
                                    canManageFinalReport={canUseFederalManagerAdvancedFeatures}
                                />
                            </div>
                        )}
                    </>
                )}

                {/* --- Administration Tab --- */}
                {activeCoursesTab === 'administration' && (
                    <CourseAdministrationView 
                        courses={allCourses} // Pass all courses (it filters inside)
                        onApproveDelete={(id) => handleCourseDeleteAction(id, false)} // Approve logic
                        onRejectDelete={handleRejectDelete}
                    />
                )}

                {/* --- Recycle Bin Tab --- */}
                {activeCoursesTab === 'recycle-bin' && (
                    <RecycleBinView 
                        courses={allCourses.filter(c => c.inRecycleBin)} // Pass recycled courses
                        onRestore={handleRestoreCourse}
                        onPermanentDelete={handlePermanentDelete}
                    />
                )}

                {(activeCoursesTab === 'add-course' || activeCoursesTab === 'edit-course') && (
                    <CourseForm
                        courseType={activeCourseType}
                        initialData={courseToEdit} 
                        onCancel={handleCancelCourseForm} 
                        onSave={handleSaveCourseAndReturn} 
                        facilitatorsList={facilitatorsList}
                        fundersList={funders || []}
                        federalCoordinatorsList={federalCoordinators || []}
                        stateCoordinatorsList={stateCoordinators || []}
                        localityCoordinatorsList={localityCoordinators || []}
                    />
                )}
                
                {loadingDetails && (activeCoursesTab !== 'courses' && activeCoursesTab !== 'administration' && activeCoursesTab !== 'recycle-bin' && activeCoursesTab !== 'add-course' && activeCoursesTab !== 'edit-course') ? <div className="flex justify-center p-8"><Spinner /></div> : (
                    <>
                        {activeCoursesTab === 'participants' && selectedCourse && (
                            <ParticipantsView
                                course={selectedCourse}
                                participants={participants}
                                onAdd={onAddParticipant}
                                onOpen={(id) => { onSetSelectedParticipantId(id); setActiveCoursesTab('monitoring'); }}
                                onEdit={onEditParticipant}
                                onDelete={onDeleteParticipant}
                                onOpenReport={onOpenParticipantReport}
                                onImport={onImportParticipants}
                                onBatchUpdate={onBatchUpdate}
                                onBulkMigrate={onBulkMigrate}
                                onOpenTestFormForParticipant={handleOpenTestFormForParticipant}
                                isCourseActive={isCourseActive}
                                canAddParticipant={canManageCourse}
                                canImportParticipants={canUseSuperUserAdvancedFeatures}
                                canCleanParticipantData={canUseSuperUserAdvancedFeatures}
                                canBulkChangeParticipants={canUseSuperUserAdvancedFeatures}
                                canBulkMigrateParticipants={canUseSuperUserAdvancedFeatures}
                                canAddMonitoring={(canManageCourse && isCourseActive) || canUseFederalManagerAdvancedFeatures}
                                canEditDeleteParticipantActiveCourse={canManageCourse}
                                canEditDeleteParticipantInactiveCourse={canUseFederalManagerAdvancedFeatures}
                            />
                        )}
                        {/* ... [Rest of tabs remain unchanged] ... */}
                        {activeCoursesTab === 'participants' && !selectedCourse && activeCoursesTab !== 'courses' && (
                            <EmptyState message="Please select a course from the 'Courses' tab to view participants." />
                        )}
                        {activeCoursesTab === 'monitoring' && selectedCourse && currentParticipant && (
                           <Suspense fallback={<Spinner />}><ObservationView course={selectedCourse} participant={currentParticipant} participants={participants} onChangeParticipant={(id) => onSetSelectedParticipantId(id)} /></Suspense>
                        )}
                        {activeCoursesTab === 'monitoring' && selectedCourse && !currentParticipant && activeCoursesTab !== 'courses' && (
                            <EmptyState message="Please select a participant from the 'Participants' tab to begin monitoring." />
                        )}
                        {activeCoursesTab === 'reports' && selectedCourse && (
                            <Suspense fallback={<Spinner />}><ReportsView course={selectedCourse} participants={participants} /></Suspense>
)}
                        {activeCoursesTab === 'enter-test-scores' && selectedCourse && (
                            <CourseTestForm
                                course={selectedCourse}
                                participants={participants}
                                participantTests={participantTests}
                                initialParticipantId={selectedParticipantId}
                                onSaveTest={onSaveParticipantTest}
                                onCancel={() => setActiveCoursesTab(selectedParticipantId ? 'participants' : 'courses')}
                                onSave={() => {
                                    setActiveCoursesTab('participants');
                                    onBatchUpdate();
                                }}
                                canManageTests={canUseFederalManagerAdvancedFeatures}
                                onSaveParticipant={onSaveParticipant}
                            />
                        )}
                    </>
                )}
            </div>
        </Card>
    );
}
// ... [SearchableSelect, CourseForm, public views, etc. remain unchanged] ...
const SearchableSelect = ({ label, options, value, onChange, onOpenNewForm, placeholder }) => {
    // ... [Implementation remains the same]
     const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const ref = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
                setInputValue(value || '');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref, value]);

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        return options.filter(opt => opt.name.toLowerCase().includes(inputValue.toLowerCase()));
    }, [options, inputValue]);

    const isNewEntry = inputValue && !options.some(opt => opt.name.toLowerCase() === inputValue.toLowerCase());

    const handleSelect = (option) => {
        onChange(option.name);
        setInputValue(option.name);
        setIsOpen(false);
    };

    const handleAddNew = () => {
        if (onOpenNewForm) {
            onOpenNewForm(inputValue);
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={ref}>
            <Input
                type="text"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    setIsOpen(true);
                    if (e.target.value === '') {
                        onChange('');
                    }
                }}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder}
            />
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {onOpenNewForm && (
                        <div
                            className={`p-2 cursor-pointer font-medium text-indigo-600 hover:bg-gray-100 ${isNewEntry ? 'border-b' : ''}`}
                            onClick={handleAddNew}
                        >
                           {`+ Add "${isNewEntry ? inputValue : `New ${label ? label.replace(':', '') : ''}`}"`}
                        </div>
                    )}
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <div
                                key={opt.id}
                                className="p-2 cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSelect(opt)}
                            >
                                {opt.name}
                            </div>
                        ))
                    ) : (
                        <div className="p-2 text-gray-500">No results found.</div>
                    )}
                </div>
            )}
        </div>
    );
};


export function CourseForm({ 
    courseType, initialData, facilitatorsList, fundersList, onCancel, onSave, 
    federalCoordinatorsList = [], stateCoordinatorsList = [], localityCoordinatorsList = []
}) {
    // ... [Implementation remains the same]
        const [state, setState] = useState(initialData?.state || '');
    const [locality, setLocality] = useState(initialData?.locality || '');
    const [hall, setHall] = useState(initialData?.hall || '');
    const [startDate, setStartDate] = useState(initialData?.start_date || '');
    const [courseDuration, setCourseDuration] = useState(initialData?.course_duration || 7);
    const [coordinator, setCoordinator] = useState(initialData?.coordinator || '');
    const [participantsCount, setParticipantsCount] = useState(initialData?.participants_count || 0);
    const [courseBudget, setCourseBudget] = useState(initialData?.course_budget || '');
    const [director, setDirector] = useState(initialData?.director || '');
    const [clinical, setClinical] = useState(initialData?.clinical_instructor || '');
    const [supporter, setSupporter] = useState(initialData?.funded_by || '');
    const [stateCoordinator, setStateCoordinator] = useState(initialData?.state_coordinator || '');
    const [localityCoordinator, setLocalityCoordinator] = useState(initialData?.locality_coordinator || '');
    const [courseProject, setCourseProject] = useState(initialData?.course_project || '');
    const [implementedBy, setImplementedBy] = useState(initialData?.implemented_by || '');

    const [directorImciSubType, setDirectorImciSubType] = useState(initialData?.director_imci_sub_type || IMNCI_SUBCOURSE_TYPES[0]);
    const [clinicalImciSubType, setClinicalImciSubType] = useState(initialData?.clinical_instructor_imci_sub_type || IMNCI_SUBCOURSE_TYPES[0]);

    const INFECTION_CONTROL_SUBCOURSE_TYPES = [
        'IPC in Delivery room',
        'IPC in Neonatal unit',
        'Neonatal Sepsis Surveillance',
    ];

    const ICCM_SUBCOURSE_TYPES = ['ICCM Community Module'];
    const SMALL_AND_SICK_SUBCOURSE_TYPES = ['Portable warmer training', 'CPAP training'];

    const EENC_SUBCOURSE_TYPES = [
        'EENC EmONC', 
        'EENC Orientation', 
        'EENC TOT', 
        'EENC Mentorship'
    ];

    const ETAT_SUBCOURSE_TYPES = [
        'ETAT Standard', 
        'ETAT Orientation', 
        'ETAT Plus', 
        'ETAT Mentorship'
    ];

    const COURSE_GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];

    const isImnci = courseType === 'IMNCI';
    const isInfectionControl = courseType === 'IPC';
    const isIccm = courseType === 'ICCM';
    const isSmallAndSick = courseType === 'Small & Sick Newborn';
    const isEenc = courseType === 'EENC';
    const isEtat = courseType === 'ETAT';

    const [groups, setGroups] = useState(initialData?.facilitatorAssignments ? [...new Set(initialData.facilitatorAssignments.map(a => a.group))] : ['Group A']);

    const [facilitatorGroups, setFacilitatorGroups] = useState(() => {
        const defaultSubcourse = isIccm ? ICCM_SUBCOURSE_TYPES[0] : '';
        if (initialData?.facilitatorAssignments?.length > 0) {
            const groups = {};
            initialData.facilitatorAssignments.forEach(assignment => {
                if (!groups[assignment.group]) {
                    groups[assignment.group] = [];
                }
                groups[assignment.group].push({
                    name: assignment.name,
                    imci_sub_type: assignment.imci_sub_type,
                });
            });
            const initialGroups = [...new Set(initialData.facilitatorAssignments.map(a => a.group))];
            initialGroups.forEach(group => {
                if (!groups[group]) {
                    groups[group] = [];
                }
            });
            return groups;
        }
        return { 'Group A': [{ imci_sub_type: defaultSubcourse, name: '' }] };
    });

    const [error, setError] = useState('');

    const directorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => f.directorCourse === 'Yes')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList]);

    const clinicalInstructorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => f.isClinicalInstructor === 'Yes' || f.directorCourse === 'Yes')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList]);

  const facilitatorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => {
                const fCourses = Array.isArray(f.courses) ? f.courses : [];
                
                if (isIccm) {
                    return fCourses.includes('ICCM') || fCourses.includes('IMNCI');
                }

                if (isInfectionControl) {
                    return fCourses.includes('IPC');
                }
                
                return fCourses.includes(courseType);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, courseType, isInfectionControl, isIccm]);

    const federalCoordinatorOptions = useMemo(() => {
        return federalCoordinatorsList.map(c => ({ id: c.id, name: c.name }));
    }, [federalCoordinatorsList]);

    const stateCoordinatorOptions = useMemo(() => {
        const sortedList = [...stateCoordinatorsList].sort((a, b) => {
            const aIsMatch = a.state === state;
            const bIsMatch = b.state === state;
            if (aIsMatch && !bIsMatch) return -1;
            if (!aIsMatch && bIsMatch) return 1;
            return a.name.localeCompare(b.name);
        });
        return sortedList.map(c => ({ id: c.id, name: `${c.name} (${c.state})` }));
    }, [stateCoordinatorsList, state]);

    const localityCoordinatorOptions = useMemo(() => {
        const sortedList = [...localityCoordinatorsList].sort((a, b) => {
            const aIsExact = a.state === state && a.locality === locality;
            const bIsExact = b.state === state && b.locality === locality;
            if (aIsExact && !bIsExact) return -1;
            if (!aIsExact && bIsExact) return 1;

            const aIsStateMatch = a.state === state;
            const bIsStateMatch = b.state === state;
            if (aIsStateMatch && !bIsStateMatch) return -1;
            if (!aIsStateMatch && bIsStateMatch) return 1;

            return a.name.localeCompare(b.name);
        });
        return sortedList.map(c => ({ id: c.id, name: `${c.name} (${c.locality}, ${c.state})` }));
    }, [localityCoordinatorsList, state, locality]);

    const funderOptions = useMemo(() => {
        return (fundersList || []).map(f => ({ id: f.id, name: f.orgName }));
    }, [fundersList]);

    const projectOptions = useMemo(() => {
        if (!fundersList) return [];
        const allProjects = fundersList.flatMap(partner => partner.projects || []);
        const uniqueProjects = [...new Set(allProjects)].sort();
        return uniqueProjects.map(proj => ({ id: proj, name: proj }));
    }, [fundersList]);



    const addFacilitatorToGroup = (groupName) => {
        const defaultSubcourse = isIccm ? ICCM_SUBCOURSE_TYPES[0] : '';
        setFacilitatorGroups(prev => ({
            ...prev,
            [groupName]: [...prev[groupName], { imci_sub_type: defaultSubcourse, name: '' }]
        }));
    };

    const removeFacilitatorFromGroup = (groupName, index) => {
        setFacilitatorGroups(prev => ({
            ...prev,
            [groupName]: prev[groupName].filter((_, i) => i !== index)
        }));
    };

    const updateFacilitatorAssignment = (groupName, index, field, value) => {
        setFacilitatorGroups(prev => ({
            ...prev,
            [groupName]: prev[groupName].map((item, i) => (i === index ? { ...item, [field]: value } : item))
        }));
    };

    const addGroup = () => {
        const nextGroupIndex = groups.length;
        if (nextGroupIndex < COURSE_GROUPS.length) {
            const defaultSubcourse = isIccm ? ICCM_SUBCOURSE_TYPES[0] : '';
            const newGroup = COURSE_GROUPS[nextGroupIndex];
            setGroups(prev => [...prev, newGroup]);
            setFacilitatorGroups(prev => ({
                ...prev,
                [newGroup]: [{ imci_sub_type: defaultSubcourse, name: '' }]
            }));
        }
    };

    const removeGroup = (groupName) => {
        setGroups(prev => prev.filter(g => g !== groupName));
        setFacilitatorGroups(prev => {
            const newGroups = { ...prev };
            delete newGroups[groupName];
            return newGroups;
        });
    };

    const submit = () => {
        const allFacilitatorAssignments = groups.reduce((acc, group) => {
            const groupAssignments = facilitatorGroups[group].map(assignment => ({
                ...assignment,
                group: group
            })).filter(assignment => assignment.name && (assignment.imci_sub_type || isIccm));
            
            if (isIccm) {
                groupAssignments.forEach(a => a.imci_sub_type = ICCM_SUBCOURSE_TYPES[0]);
            }
            
            return [...acc, ...groupAssignments];
        }, []);

        if (!state || !locality || !hall || !coordinator || !participantsCount || !supporter || !startDate || !implementedBy) {
            setError('Please complete all required fields.');
            return;
        }
        
        if (!courseType) {
            setError('Could not determine course type. Please go back to the courses page and select a package before adding a new course.');
            return;
        }

        if (!isInfectionControl && !director) {
            setError('Please select a Course Director. This is a mandatory field for this course type.');
            return;
        }

        // --- FIXED: Added !isSmallAndSick to skip facilitator requirement ---
        if (!isInfectionControl && !isSmallAndSick && allFacilitatorAssignments.length === 0) {
             setError('Please assign at least one facilitator to a subcourse.');
             return;
        }

        const payload = {
            ...(initialData?.id && { id: initialData.id }),
            state, locality, hall, coordinator, start_date: startDate,
            course_duration: courseDuration,
            participants_count: participantsCount, director,
            funded_by: supporter,
            implemented_by: implementedBy,
            course_budget: courseBudget,
            state_coordinator: stateCoordinator,
            locality_coordinator: localityCoordinator,
            course_project: courseProject,
            facilitators: allFacilitatorAssignments.map(f => f.name),
            facilitatorAssignments: allFacilitatorAssignments,
            course_type: courseType, 
        };

        if (isImnci || isIccm) {
            payload.clinical_instructor = clinical;
            payload.director_imci_sub_type = isIccm ? ICCM_SUBCOURSE_TYPES[0] : directorImciSubType;
            payload.clinical_instructor_imci_sub_type = isIccm ? ICCM_SUBCOURSE_TYPES[0] : clinicalImciSubType;
        }

        onSave(payload);
    };

    return (
        <Card>
            <div className="p-6">
                <PageHeader title={`${initialData ? 'Edit' : 'Add New'} Course`} subtitle={`Package: ${courseType || 'N/A'}`} className="mb-6" />
                {error && <div className="p-3 mb-6 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(b.ar)).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}</Select></FormGroup>
                    <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}</Select></FormGroup>
                    <FormGroup label="Course Hall"><Input value={hall} onChange={(e) => setHall(e.target.value)} /></FormGroup>
                    <FormGroup label="Start Date of Course"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></FormGroup>
                    <FormGroup label="Course Duration (days)"><Input type="number" value={courseDuration} onChange={(e) => setCourseDuration(Number(e.target.value))} /></FormGroup>
                    <FormGroup label="# of Participants"><Input type="number" value={participantsCount} onChange={(e) => setParticipantsCount(Number(e.target.value))} /></FormGroup>

                    <FormGroup label="Federal Course Coordinator">
                        <SearchableSelect
                            value={coordinator}
                            onChange={setCoordinator}
                            options={federalCoordinatorOptions}
                            placeholder="Type to search..."
                            label="Federal Course Coordinator"
                        />
                    </FormGroup>
                    <FormGroup label="State Course Coordinator">
                        <SearchableSelect
                            value={stateCoordinator}
                            onChange={setStateCoordinator}
                            options={stateCoordinatorOptions}
                            placeholder="Type to search..."
                            label="State Course Coordinator"
                        />
                    </FormGroup>
                    <FormGroup label="Locality Course Coordinator">
                        <SearchableSelect
                            value={localityCoordinator}
                            onChange={setLocalityCoordinator}
                            options={localityCoordinatorOptions}
                            placeholder="Type to search..."
                            label="Locality Course Coordinator"
                        />
                    </FormGroup>
                    
                    <FormGroup label="Funded by:">
                        <SearchableSelect
                            value={supporter}
                            onChange={setSupporter}
                            options={funderOptions}
                            placeholder="Type to search..."
                            label="Funded by"
                        />
                    </FormGroup>
                    <FormGroup label="Implemented by:">
                        <SearchableSelect
                            value={implementedBy}
                            onChange={setImplementedBy}
                            options={funderOptions}
                            placeholder="Type to search..."
                            label="Implemented by"
                        />
                    </FormGroup>
                    <FormGroup label="Course Project">
                         <SearchableSelect
                            value={courseProject}
                            onChange={setCourseProject}
                            options={projectOptions}
                            placeholder="Type to search for a project"
                            label="Course Project"
                        />
                    </FormGroup>

                    <FormGroup label="Course Budget (USD)"><Input type="number" value={courseBudget} onChange={(e) => setCourseBudget(Number(e.target.value))} /></FormGroup>

                    <div className="lg:col-span-3" /> 

                    {!isInfectionControl && (
                        <div className="md:col-span-2 lg:col-span-3">
                            <h3 className="text-lg font-bold mb-2">Leadership Assignments</h3>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 border rounded-md bg-gray-50">
                                <div className="space-y-2">
                                    <FormGroup label="Course Director">
                                        <SearchableSelect
                                            value={director}
                                            onChange={setDirector}
                                            options={directorOptions}
                                            placeholder="Select Director"
                                            label="Course Director"
                                        />
                                    </FormGroup>
                                    {isImnci && (
                                        <FormGroup label="IMNCI Subcourse for Director">
                                            <Select value={directorImciSubType} onChange={(e) => setDirectorImciSubType(e.target.value)} className="w-full">
                                                {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                            </Select>
                                        </FormGroup>
                                    )}
                                </div>

                                {(isImnci || isIccm) && (
                                    <div className="space-y-2">
                                        <FormGroup label="Clinical Instructor (Optional)">
                                            <SearchableSelect
                                                value={clinical}
                                                onChange={setClinical}
                                                options={clinicalInstructorOptions}
                                                placeholder="Select Instructor"
                                                label="Clinical Instructor"
                                            />
                                        </FormGroup>
                                        {isImnci && (
                                            <FormGroup label="IMNCI Subcourse for Clinical Instructor (Optional)">
                                                <Select value={clinicalImciSubType} onChange={(e) => setClinicalImciSubType(e.target.value)} className="w-full">
                                                    {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                                </Select>
                                            </FormGroup>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="md:col-span-2 lg:col-span-3 mt-4">
                        <h3 className="text-lg font-bold mb-2">Facilitator Assignments</h3>
                        <div className="space-y-6">
                            {groups.map(groupName => (
                                <div key={groupName} className="p-4 border rounded-md bg-gray-50">
                                    <h4 className="text-md font-semibold mb-2">{groupName}</h4>
                                    {facilitatorGroups[groupName]?.map((assignment, index) => (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                            {!isIccm && (
                                                <FormGroup label="Subcourse Type">
                                                    <Select
                                                        value={assignment.imci_sub_type || ''}
                                                        onChange={(e) => updateFacilitatorAssignment(groupName, index, 'imci_sub_type', e.target.value)}
                                                        className="w-full"
                                                    >
                                                        <option value="">— Select Subcourse —</option>
                                                        {(isImnci ? IMNCI_SUBCOURSE_TYPES : 
                                                          isIccm ? ICCM_SUBCOURSE_TYPES : 
                                                          isInfectionControl ? INFECTION_CONTROL_SUBCOURSE_TYPES : 
                                                          isSmallAndSick ? SMALL_AND_SICK_SUBCOURSE_TYPES :
                                                          isEenc ? EENC_SUBCOURSE_TYPES :
                                                          isEtat ? ETAT_SUBCOURSE_TYPES :
                                                          []
                                                        ).map(type => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </Select>
                                                </FormGroup>
                                            )}
                                            <FormGroup label="Facilitator Name" className={isIccm ? "lg:col-span-2" : ""}>
                                                <SearchableSelect
                                                    value={assignment.name}
                                                    onChange={(value) => updateFacilitatorAssignment(groupName, index, 'name', value)}
                                                    options={facilitatorOptions}
                                                    placeholder="Select Facilitator"
                                                    label="Facilitator"
                                                />
                                            </FormGroup>
                                            <div className="flex items-end">
                                                <Button type="button" variant="danger" onClick={() => removeFacilitatorFromGroup(groupName, index)} disabled={facilitatorGroups[groupName]?.length <= 1}>Remove</Button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-end mt-2">
                                        <Button type="button" variant="secondary" onClick={() => addFacilitatorToGroup(groupName)}>+ Add another facilitator to {groupName}</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {groups.length < COURSE_GROUPS.length && (
                            <div className="flex justify-start mt-4">
                                <Button type="button" variant="secondary" onClick={addGroup}>+ Add another group</Button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 justify-end mt-8 border-t pt-6">
                    <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button onClick={submit}>Save Course</Button>
                </div>
            </div>
        </Card>
    );
}

// --- ADDED THIS COMPONENT TO FIX THE ERROR ---
export function PublicCourseMonitoringView({ course, allParticipants }) {
    const [selectedParticipantId, setSelectedParticipantId] = useState(
        allParticipants && allParticipants.length > 0 ? allParticipants[0].id : null
    );
    
    const currentParticipant = allParticipants.find(p => p.id === selectedParticipantId);

    if (!course) return <EmptyState message="Course data unavailable." />;

    return (
        <div className="space-y-6">
            <Card>
                <div className="p-6 border-b border-gray-100">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-sky-100 rounded-lg">
                            <Eye className="w-6 h-6 text-sky-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Course Monitoring</h1>
                     </div>
                     <div className="text-gray-600">
                        <span className="font-semibold text-gray-900">{course.course_type}</span>
                        <span className="mx-2">•</span>
                        <span>{course.state} - {course.locality}</span>
                        <span className="mx-2">•</span>
                        <span>{course.start_date}</span>
                     </div>
                </div>
            </Card>

            <Suspense fallback={<div className="flex justify-center p-10"><Spinner /></div>}>
                {allParticipants && allParticipants.length > 0 ? (
                    currentParticipant ? (
                        <ObservationView 
                            course={course} 
                            participant={currentParticipant} 
                            participants={allParticipants}
                            onChangeParticipant={setSelectedParticipantId}
                        />
                    ) : (
                         <div className="flex justify-center p-10"><Spinner /></div>
                    )
                ) : (
                    <EmptyState message="No participants found for this course." />
                )}
            </Suspense>
        </div>
    );
}