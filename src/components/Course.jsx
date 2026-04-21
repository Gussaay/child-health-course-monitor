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
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_SSNC
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

// NEW IMPORTS FOR MIGRATED DASHBOARDS
import SudanMap from '../SudanMap';
import CompiledReportView from './CompiledReportView.jsx';

// Lazy load components that are not always visible to speed up initial load
const ReportsView = React.lazy(() => import('./ReportsView').then(module => ({ default: module.ReportsView })));
const ObservationView = React.lazy(() => import('./MonitoringView').then(module => ({ default: module.ObservationView })));


// Helper functions 
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
        if (course.course_type === 'Small & Sick Newborn' || course.course_type === 'SSNC') return JOB_TITLES_SSNC;
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
        { key: 'Program Management', title: 'Program Management', enabled: true },
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
                             it.key === 'Program Management' ? <ClipboardList className="w-10 h-10 text-slate-500 flex-shrink-0" /> :
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


export function CoursesTable({ 
    courses, onOpen, onEdit, onDelete, onOpenReport, onOpenTestForm, 
    canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates, userLocalities, onAddFinalReport, canManageFinalReport,
    onOpenAttendanceManager 
}) {
    const [shareModalCourse, setShareModalCourse] = useState(null);
    const [reportModalCourse, setReportModalCourse] = useState(null);
    const [deleteRequestCourse, setDeleteRequestCourse] = useState(null); 
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    // Reset to page 1 when courses array or items per page change
    useEffect(() => {
        setCurrentPage(1);
    }, [courses, itemsPerPage]);

    const isCourseActive = (course) => {
        if (course.approvalStatus === 'pending') {
            return false; 
        }
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
        let filtered = courses;
        if (userStates && userStates.length > 0) {
            filtered = filtered.filter(c => userStates.includes(c.state));
        }
        if (userLocalities && userLocalities.length > 0) {
            filtered = filtered.filter(c => userLocalities.includes(c.locality));
        }
        return filtered;
    }, [courses, userStates, userLocalities]);

    const sortedCourses = useMemo(() => {
        return [...filteredCourses].sort((a, b) => {
            const aActive = isCourseActive(a);
            const bActive = isCourseActive(b);
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return 0;
        });
    }, [filteredCourses]);

    // Calculate Pagination Data
    const totalItems = sortedCourses.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedCourses = sortedCourses.slice(startIndex, startIndex + itemsPerPage);

    const courseType = sortedCourses.length > 0 ? sortedCourses[0].course_type : 'Courses';

    return (
        sortedCourses.length === 0 ? <EmptyState message="No courses found matching the selected filters." /> : ( 
            <div>
                <h3 className="text-xl font-bold mb-4">{courseType} Courses</h3>
                <Table headers={["State", "Subcourses", "Status", "Actions"]}>
                    {paginatedCourses.map((c, index) => {
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
                                    {c.state} - {c.locality}
                                    {isPendingDeletion && <span className="block text-xs text-red-600 font-bold mt-1">(Deletion Pending)</span>}
                                </td>
                                <td className="p-4 border">{subcourses}</td>
                                <td className="p-4 border">
                                    {c.approvalStatus === 'pending' ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                            Not Approved
                                        </span>
                                    ) : active ? (
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

                {/* --- Pagination Controls --- */}
                {totalItems > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-4 p-4 bg-white border rounded-lg text-sm text-gray-700 shadow-sm">
                        <div className="flex items-center gap-4 mb-4 sm:mb-0">
                            <span>Page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong> <span className="text-gray-500">(Total: {totalItems} courses)</span></span>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">Per Page:</span>
                                <Select 
                                    value={itemsPerPage} 
                                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                    className="py-1 px-2 text-sm w-20 border-gray-300 rounded"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                </Select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                variant="secondary" 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1"
                            >
                                &larr; Previous
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage >= totalPages || totalPages === 0}
                                className="px-3 py-1"
                            >
                                Next &rarr;
                            </Button>
                        </div>
                    </div>
                )}

                {/* --- SHARE & MANAGE MODAL --- */}
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
                                    
                                    {(['ICCM', 'EENC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management'].includes(shareModalCourse.course_type)) && (
                                        <div className="bg-gray-50 p-3 rounded border">
                                            <span className="text-sm font-semibold block mb-2">Testing</span>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="secondary" size="sm" className="flex items-center gap-1 justify-center" onClick={() => { const link = `${window.location.origin}/public/test/course/${shareModalCourse.id}?type=pre`; navigator.clipboard.writeText(link).then(() => alert('Pre-Test link copied!')); }}><FileText size={14} /> Copy Pre-Test</Button>
                                                <Button variant="secondary" size="sm" className="flex items-center gap-1 justify-center" onClick={() => { const link = `${window.location.origin}/public/test/course/${shareModalCourse.id}?type=post`; navigator.clipboard.writeText(link).then(() => alert('Post-Test link copied!')); }}><FileText size={14} /> Copy Post-Test</Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-gray-50 p-3 rounded border">
                                        <span className="text-sm font-semibold block mb-2">Daily Attendance</span>
                                        <div className="flex gap-2">
                                            <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="py-1 text-sm" />
                                            <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => { const link = `${window.location.origin}/attendance/course/${shareModalCourse.id}`; navigator.clipboard.writeText(link).then(() => alert(`Attendance link for ${attendanceDate} copied!`)); }}><LinkIcon size={14} /> Copy Link</Button>
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

                            {(['ICCM', 'EENC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management'].includes(reportModalCourse.course_type)) && (
                                <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => { onOpenTestForm(reportModalCourse.id); setReportModalCourse(null); }}>
                                    <div className="bg-orange-100 p-2 rounded-full"><CheckCircle className="text-orange-600" size={20} /></div>
                                    <div className="text-left">
                                        <div className="font-semibold text-gray-800">Test Scores Dashboard</div>
                                        <div className="text-xs text-gray-500">Manage pre-test and post-test scores</div>
                                    </div>
                                </Button>
                            )}

                            {canManageFinalReport && (
                                <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => { onAddFinalReport(reportModalCourse.id); setReportModalCourse(null); }}>
                                    <div className="bg-purple-100 p-2 rounded-full"><FileText className="text-purple-600" size={20} /></div>
                                    <div className="text-left">
                                        <div className="font-semibold text-gray-800">Final Report</div>
                                        <div className="text-xs text-gray-500">Generate or view the narrative report</div>
                                    </div>
                                </Button>
                            )}

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

// --- Federal Approvals View ---
function CourseApprovalsView({ courses, onApproveCourse }) {
    const pendingApprovalCourses = useMemo(() => courses.filter(c => c.approvalStatus === 'pending' && !c.deletionRequested && !c.inRecycleBin), [courses]);

    if (pendingApprovalCourses.length === 0) {
        return <EmptyState message="No courses are currently pending federal approval." />;
    }

    return (
        <div className="space-y-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="text-green-600" /> Course Approvals
            </h3>

            <div>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <p className="text-sm text-yellow-700">
                        These courses have been created but require federal approval before they can become actively tracked and monitored.
                    </p>
                </div>
                <Table headers={["Course Type", "Location", "Start Date", "Coordinator", "Actions"]}>
                    {pendingApprovalCourses.map(c => (
                        <tr key={c.id} className="bg-white hover:bg-gray-50">
                            <td className="p-4 border font-medium">{c.course_type}</td>
                            <td className="p-4 border">{c.state} - {c.locality}</td>
                            <td className="p-4 border">{c.start_date}</td>
                            <td className="p-4 border">{c.coordinator || 'N/A'}</td>
                            <td className="p-4 border text-right">
                                <Button 
                                    variant="primary" 
                                    className="flex items-center gap-1 ml-auto"
                                    onClick={() => onApproveCourse(c.id)}
                                >
                                    <Check size={14} /> Approve Course
                                </Button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
        </div>
    );
}


// --- Course Administration View (Deletions Only Now) ---
function CourseAdministrationView({ courses, onApproveDelete, onRejectDelete }) {
    const pendingDeletionCourses = useMemo(() => courses.filter(c => c.deletionRequested === true && !c.inRecycleBin), [courses]);

    if (pendingDeletionCourses.length === 0) {
        return <EmptyState message="No pending administrative deletion requests at this time." />;
    }

    return (
        <div className="space-y-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="text-sky-600" /> Course Administration
            </h3>

            <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Pending Deletion Requests</h4>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <p className="text-sm text-yellow-700">
                        The following courses have been requested for deletion. Approving will move them to the <strong>Recycle Bin</strong>.
                    </p>
                </div>
                <Table headers={["Course Type", "Location", "Start Date", "Coordinator", "Actions"]}>
                    {pendingDeletionCourses.map(c => (
                        <tr key={c.id} className="bg-white hover:bg-gray-50">
                            <td className="p-4 border font-medium">{c.course_type}</td>
                            <td className="p-4 border">{c.state} - {c.locality}</td>
                            <td className="p-4 border">{c.start_date}</td>
                            <td className="p-4 border">{c.coordinator || 'N/A'}</td>
                            <td className="p-4 border text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="secondary" className="text-green-700 border-green-200 hover:bg-green-50 flex items-center gap-1" onClick={() => onRejectDelete(c)}>
                                        <X size={14} /> Reject
                                    </Button>
                                    <Button variant="danger" className="flex items-center gap-1" onClick={() => onApproveDelete(c.id)}>
                                        <Check size={14} /> Approve (Move to Bin)
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
        </div>
    );
}

export function CourseManagementView({
    allCourses, onOpen, onDelete, onOpenReport,
    onOpenTestForm,
    canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates, userLocalities,
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
    onOpenAttendanceManager
}) {
    const { 
        federalCoordinators, fetchFederalCoordinators,
        stateCoordinators, fetchStateCoordinators,
        localityCoordinators, fetchLocalityCoordinators,
        funders, fetchFunders,
        fetchCourses,
        participants: globalParticipants, 
        fetchParticipants
    } = useDataCache();

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [allHealthFacilities, setAllHealthFacilities] = useState([]);
    const [loadingFacilities, setLoadingFacilities] = useState(false);

    useEffect(() => {
        fetchFederalCoordinators();
        fetchStateCoordinators();
        fetchLocalityCoordinators();
        fetchFunders();
        fetchParticipants(true); 
    }, []); 

    // Fetch all health facilities only when the compiled reports tab is opened and not already loaded
    useEffect(() => {
        if (activeCoursesTab === 'compiled-reports' && allHealthFacilities.length === 0) {
            setLoadingFacilities(true);
            listHealthFacilities({}, 'server')
                .then(data => setAllHealthFacilities(data || []))
                .catch(err => console.error("Failed to load all health facilities:", err))
                .finally(() => setLoadingFacilities(false));
        }
    }, [activeCoursesTab, allHealthFacilities.length]);

    const currentParticipant = participants.find(p => p.id === selectedParticipantId);
    const [courseToEdit, setCourseToEdit] = useState(null);

    // Filter logic for specific course type views
    const coursesForActiveType = useMemo(() => {
        if (!activeCourseType) return [];
        return allCourses.filter(c => c.course_type === activeCourseType);
    }, [allCourses, activeCourseType]);

    const [filterState, setFilterState] = useState('All');
    const [filterLocality, setFilterLocality] = useState('All');
    const [filterSubCourse, setFilterSubCourse] = useState('All');
    const [filterProject, setFilterProject] = useState('All');

    const filterStateOptions = useMemo(() => {
        const states = new Set();
        coursesForActiveType.forEach(c => {
             if (!userStates || userStates.length === 0 || userStates.includes(c.state)) {
                 states.add(c.state);
             }
        });
        return ['All', ...Array.from(states).sort()];
    }, [coursesForActiveType, userStates]);

    const filterLocalityOptions = useMemo(() => {
        const localities = new Set();
        coursesForActiveType.forEach(c => {
            if (filterState === 'All' || c.state === filterState) {
                if (!userLocalities || userLocalities.length === 0 || userLocalities.includes(c.locality)) {
                    localities.add(c.locality);
                }
            }
        });
        return ['All', ...Array.from(localities).sort()];
    }, [coursesForActiveType, filterState, userLocalities]);

    const filterSubCourseOptions = useMemo(() => {
        const subCourses = new Set();
        coursesForActiveType.forEach(c => {
            if (c.facilitatorAssignments && c.facilitatorAssignments.length > 0) {
                c.facilitatorAssignments.forEach(a => subCourses.add(a.imci_sub_type));
            }
        });
        return ['All', ...Array.from(subCourses).sort()];
    }, [coursesForActiveType]);

    const filterProjectOptions = useMemo(() => {
        const projects = new Set();
        coursesForActiveType.forEach(c => {
            if (c.course_project) {
                projects.add(c.course_project);
            }
        });
        return ['All', ...Array.from(projects).sort()];
    }, [coursesForActiveType]);

    useEffect(() => {
        setFilterState('All');
        setFilterLocality('All');
        setFilterSubCourse('All');
        setFilterProject('All');
    }, [activeCourseType]);

    useEffect(() => {
        setFilterLocality('All');
    }, [filterState]);

    const courses = useMemo(() => {
        return coursesForActiveType.filter(c => {
            if (c.inRecycleBin) return false;
            
            // Permissions checks
            if (userStates && userStates.length > 0 && !userStates.includes(c.state)) return false;
            if (userLocalities && userLocalities.length > 0 && !userLocalities.includes(c.locality)) return false;

            // Form filter checks
            const stateMatch = filterState === 'All' || c.state === filterState;
            const localityMatch = filterLocality === 'All' || c.locality === filterLocality;
            const subCourseMatch = filterSubCourse === 'All' || 
                (c.facilitatorAssignments && c.facilitatorAssignments.some(a => a.imci_sub_type === filterSubCourse));
            const projectMatch = filterProject === 'All' || c.course_project === filterProject;

            return stateMatch && localityMatch && subCourseMatch && projectMatch;
        });
    }, [coursesForActiveType, filterState, filterLocality, filterSubCourse, filterProject, userStates, userLocalities]);

    const dashboardCourses = useMemo(() => {
        return (allCourses || []).filter(c => {
            if (c.inRecycleBin || c.isDeleted === true || c.isDeleted === "true") return false;
            if (userStates && userStates.length > 0 && !userStates.includes(c.state)) return false;
            if (userLocalities && userLocalities.length > 0 && !userLocalities.includes(c.locality)) return false;
            return true;
        });
    }, [allCourses, userStates, userLocalities]);

    const dashboardParticipants = useMemo(() => {
        return (globalParticipants || []).filter(p => {
            if (p.isDeleted === true || p.isDeleted === "true") return false;
            if (userStates && userStates.length > 0 && !userStates.includes(p.state)) return false;
            if (userLocalities && userLocalities.length > 0 && !userLocalities.includes(p.locality)) return false;
            return true;
        });
    }, [globalParticipants, userStates, userLocalities]);

    const courseKPIs = useMemo(() => {
        return { 
            totalCourses: dashboardCourses.length, 
            totalImnciCourses: dashboardCourses.filter(c => c.course_type === 'IMNCI').length, 
            totalEtatCourses: dashboardCourses.filter(c => c.course_type === 'ETAT').length, 
            totalEencCourses: dashboardCourses.filter(c => c.course_type === 'EENC').length 
        };
    }, [dashboardCourses]);

    const coursesByState = useMemo(() => {
        const data = {};
        const allStatesInFilter = [...new Set(dashboardCourses.map(c => c.state))].sort();
        const allCourseTypesInFilter = [...new Set(dashboardCourses.map(c => c.course_type))].sort();
        const totalCounts = {};

        dashboardCourses.forEach(c => {
            const state = c.state;
            const type = c.course_type;
            if (!data[state]) data[state] = {};
            data[state][type] = (data[state][type] || 0) + 1;
            totalCounts[state] = (totalCounts[state] || 0) + 1;
        });

        const tableBody = allStatesInFilter.map(state => {
            const row = [state];
            allCourseTypesInFilter.forEach(type => row.push(data[state]?.[type] || 0));
            row.push(totalCounts[state] || 0);
            return row;
        });

        const columnTotals = ["Total"];
        allCourseTypesInFilter.forEach(type => {
            columnTotals.push(Object.values(data).reduce((acc, stateData) => acc + (stateData[type] || 0), 0));
        });
        columnTotals.push(columnTotals.slice(1).reduce((acc, sum) => acc + sum, 0));

        return { headers: ["State", ...allCourseTypesInFilter, "Total"], body: tableBody, totals: columnTotals };
    }, [dashboardCourses]);

    const mapCoordinates = {
        "Khartoum": { lat: 15.6000, lng: 32.5000 }, "Gezira": { lat: 14.4000, lng: 33.5167 }, "White Nile": { lat: 13.1667, lng: 32.6667 }, "Blue Nile": { lat: 11.7667, lng: 34.3500 },
        "Sennar": { lat: 13.1500, lng: 33.9333 }, "Gedarif": { lat: 14.0333, lng: 35.3833 }, "Kassala": { lat: 15.4500, lng: 36.4000 }, "Red Sea": { lat: 19.6167, lng: 37.2167 },
        "Northern": { lat: 19.1698, lng: 30.4749 }, "River Nile": { lat: 17.5900, lng: 33.9600 }, "North Kordofan": { lat: 13.1833, lng: 30.2167 }, "South Kordofan": { lat: 11.0167, lng: 29.7167 },
        "West Kordofan": { lat: 11.7175, lng: 28.3400 }, "North Darfur": { lat: 13.6306, lng: 25.3500 }, "South Darfur": { lat: 12.0500, lng: 24.8833 }, "West Darfur": { lat: 13.4500, lng: 22.4500 },
        "Central Darfur": { lat: 12.9000, lng: 23.4833 }, "East Darfur": { lat: 11.4608, lng: 26.1283 }
    };

    const localMapData = useMemo(() => {
        const courseCounts = {};
        dashboardCourses.forEach(course => courseCounts[course.state] = (courseCounts[course.state] || 0) + 1);
        return Object.entries(courseCounts).map(([state, count]) => {
            const coords = mapCoordinates[state];
            return coords ? { state, percentage: count, coordinates: [coords.lng, coords.lat] } : null;
        }).filter(Boolean);
    }, [dashboardCourses]);

    const isCourseActive = useMemo(() => {
        if (selectedCourse?.approvalStatus === 'pending') return false; 
        if (!selectedCourse?.start_date || !selectedCourse?.course_duration || selectedCourse.course_duration <= 0) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(selectedCourse.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + selectedCourse.course_duration);
        return today >= startDate && today < endDate;
    }, [selectedCourse]);

    const canAccessAdminTab = canUseFederalManagerAdvancedFeatures || canManageCourse;
    const canAccessRecycleBin = canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try { await fetchCourses(true); await fetchParticipants(true); } finally { setIsRefreshing(false); }
    };

    const handleOpenCourse = (id) => {
        onOpen(id);
        onSetSelectedParticipantId(null);
        setActiveCoursesTab('participants'); // Shift into Course Specific View automatically
    };

    const handleOpenTestForm = async (courseId) => {
        if (onOpen) await onOpen(courseId); 
        onSetSelectedParticipantId(null); 
        setActiveCoursesTab('enter-test-scores'); 
    };

    const handleOpenTestFormForParticipant = (participantId) => {
        onSetSelectedParticipantId(participantId);
        setActiveCoursesTab('enter-test-scores');
    };

    const handleOpenAddForm = () => { setCourseToEdit(null); setActiveCoursesTab('add-course'); };
    const handleOpenEditForm = (course) => { setCourseToEdit(course); setActiveCoursesTab('edit-course'); };
    const handleCancelCourseForm = () => { setCourseToEdit(null); setActiveCoursesTab('courses'); };

    const handleSaveCourseAndReturn = async (courseData) => {
        if (onSaveCourse) await onSaveCourse(courseData); 
        setActiveCoursesTab('courses'); 
        setCourseToEdit(null);
    };

    const handleCourseDeleteAction = async (courseId, isRequest = false) => {
        const courseToUpdate = allCourses.find(c => c.id === courseId);
        if (isRequest) {
            if (courseToUpdate) {
                await onSaveCourse({ ...courseToUpdate, deletionRequested: true });
                alert("Deletion requested. Please wait for approval.");
            }
        } else {
            if (courseToUpdate) await onSaveCourse({ ...courseToUpdate, deletionRequested: false, inRecycleBin: true });
        }
    };

    const handleApproveCourse = async (courseId) => {
        const courseToUpdate = allCourses.find(c => c.id === courseId);
        if (courseToUpdate) {
            await onSaveCourse({ ...courseToUpdate, approvalStatus: 'approved' });
        }
    };

    const handleRejectDelete = async (course) => await onSaveCourse({ ...course, deletionRequested: false });
    const handleRestoreCourse = async (course) => { if (window.confirm(`Are you sure you want to restore the course: ${course.course_type}?`)) await onSaveCourse({ ...course, inRecycleBin: false }); };
    const handlePermanentDelete = async (courseId) => { if (window.confirm("Are you sure? This will permanently delete the course and cannot be undone.")) await onDelete(courseId); };

    // Group tabs logically to handle display visibility
    const globalTabs = ['courses', 'add-course', 'edit-course', 'dashboard', 'compiled-reports', 'administration', 'approvals', 'recycle-bin'];
    const isGlobalView = globalTabs.includes(activeCoursesTab);

    return (
        <Card>
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
                <Button 
                    variant="tab" 
                    isActive={activeCoursesTab === 'courses' || activeCoursesTab === 'add-course' || activeCoursesTab === 'edit-course'} 
                    onClick={() => { 
                        setActiveCoursesTab('courses');
                        onSetSelectedParticipantId(null);
                    }}
                >
                    {isGlobalView ? 'Courses' : '← Back to Courses'}
                </Button>
                
                {/* Global Management Tabs */}
                {isGlobalView && (
                    <>
                        <Button variant="tab" isActive={activeCoursesTab === 'dashboard'} onClick={() => { setActiveCoursesTab('dashboard'); onSetSelectedParticipantId(null); }}>Course Dashboard</Button>
                        <Button variant="tab" isActive={activeCoursesTab === 'compiled-reports'} onClick={() => { setActiveCoursesTab('compiled-reports'); onSetSelectedParticipantId(null); }}>Compiled Reports</Button>

                        {canAccessAdminTab && (
                            <Button variant="tab" isActive={activeCoursesTab === 'administration'} onClick={() => { setActiveCoursesTab('administration'); onSetSelectedParticipantId(null); }}>
                                Administration
                                 {allCourses.filter(c => c.deletionRequested && !c.inRecycleBin).length > 0 && (
                                     <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                                         {allCourses.filter(c => c.deletionRequested && !c.inRecycleBin).length}
                                     </span>
                                 )}
                            </Button>
                        )}

                        {canUseFederalManagerAdvancedFeatures && (
                            <Button variant="tab" isActive={activeCoursesTab === 'approvals'} onClick={() => { setActiveCoursesTab('approvals'); onSetSelectedParticipantId(null); }}>
                                Approvals
                                 {allCourses.filter(c => c.approvalStatus === 'pending' && !c.inRecycleBin).length > 0 && (
                                     <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                                         {allCourses.filter(c => c.approvalStatus === 'pending' && !c.inRecycleBin).length}
                                     </span>
                                 )}
                            </Button>
                        )}

                        {canAccessRecycleBin && (
                            <Button variant="tab" isActive={activeCoursesTab === 'recycle-bin'} onClick={() => { setActiveCoursesTab('recycle-bin'); onSetSelectedParticipantId(null); }}>
                                Recycle Bin
                                 {allCourses.filter(c => c.inRecycleBin).length > 0 && (
                                     <span className="ml-2 bg-gray-200 text-gray-800 text-xs px-2 py-0.5 rounded-full">{allCourses.filter(c => c.inRecycleBin).length}</span>
                                 )}
                            </Button>
                        )}
                    </>
                )}

                {/* Course-Specific Tabs */}
                {!isGlobalView && selectedCourse && (
                    <>
                        <Button variant="tab" isActive={activeCoursesTab === 'participants'} onClick={() => { setActiveCoursesTab('participants'); onSetSelectedParticipantId(null); }}>Participants</Button>
                        <Button variant="tab" isActive={activeCoursesTab === 'monitoring'} onClick={() => setActiveCoursesTab('monitoring')} disabled={!currentParticipant}>Monitoring</Button>
                        <Button variant="tab" isActive={activeCoursesTab === 'reports'} onClick={() => setActiveCoursesTab('reports')}>Reports</Button>
                        {(['ICCM', 'EENC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management'].includes(selectedCourse.course_type)) && (
                            <Button variant="tab" isActive={activeCoursesTab === 'enter-test-scores'} onClick={() => { setActiveCoursesTab('enter-test-scores'); }}>Test Scores</Button>
                        )}
                    </>
                )}
            </div>
            
            <div className="p-4">
                {activeCoursesTab === 'courses' && (
                    <>
                        {!activeCourseType ? (
                            <Landing active={activeCourseType} onPick={(t) => setActiveCourseType(t)} />
                        ) : (
                            <div>
                                <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
                                    <div className="flex gap-2">
                                        {canManageCourse && <Button onClick={handleOpenAddForm} className="bg-sky-600 text-white hover:bg-sky-700">Add New Course</Button>}
                                        <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>{isRefreshing ? <Spinner size="sm" /> : <><RefreshCw size={14} className="mr-1"/> Refresh Data</>}</Button>
                                    </div>
                                    <Button variant="secondary" onClick={() => setActiveCourseType(null)}>Change Course Package</Button>
                                </div>
                                
                                <Card className="p-4 mb-4 bg-gray-50">
                                    <h4 className="text-lg font-semibold mb-3">Filter Courses</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <FormGroup label="Filter by State"><Select value={filterState} onChange={(e) => setFilterState(e.target.value)}>{filterStateOptions.map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                                        <FormGroup label="Filter by Locality"><Select value={filterLocality} onChange={(e) => setFilterLocality(e.target.value)} disabled={filterLocalityOptions.length <= 1}>{filterLocalityOptions.map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                                        <FormGroup label="Filter by Sub-course"><Select value={filterSubCourse} onChange={(e) => setFilterSubCourse(e.target.value)} disabled={filterSubCourseOptions.length <= 1}>{filterSubCourseOptions.map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                                        <FormGroup label="Filter by Project"><Select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} disabled={filterProjectOptions.length <= 1}>{filterProjectOptions.map(p => <option key={p} value={p}>{p}</option>)}</Select></FormGroup>
                                    </div>
                                </Card>
                                
                                <CoursesTable
                                    courses={courses} onOpen={handleOpenCourse} onEdit={handleOpenEditForm} onDelete={handleCourseDeleteAction} 
                                    onOpenReport={onOpenReport} onOpenTestForm={handleOpenTestForm} onOpenAttendanceManager={onOpenAttendanceManager} 
                                    canEditDeleteActiveCourse={canEditDeleteActiveCourse} canEditDeleteInactiveCourse={canEditDeleteInactiveCourse}
                                    userStates={userStates} userLocalities={userLocalities} onAddFinalReport={onAddFinalReport} canManageFinalReport={canUseFederalManagerAdvancedFeatures}
                                />
                            </div>
                        )}
                    </>
                )}

                {/* --- MIGRATED TABS --- */}
                {activeCoursesTab === 'dashboard' && (
                    <div className="mt-4">
                        <h3 className="text-xl font-bold mb-4">Course KPIs</h3>
                        <div className="grid md:grid-cols-4 gap-4 mb-8">
                            <div className="p-4 bg-sky-100 rounded-lg text-center"><div className="text-sm font-semibold text-sky-700">Total Courses</div><div className="text-3xl font-bold">{courseKPIs.totalCourses}</div></div>
                            <div className="p-4 bg-sky-100 rounded-lg text-center"><div className="text-sm font-semibold text-sky-700">Total IMNCI Courses</div><div className="text-3xl font-bold">{courseKPIs.totalImnciCourses}</div></div>
                            <div className="p-4 bg-sky-100 rounded-lg text-center"><div className="text-sm font-semibold text-sky-700">Total ETAT Courses</div><div className="text-3xl font-bold">{courseKPIs.totalEtatCourses}</div></div>
                            <div className="p-4 bg-sky-100 rounded-lg text-center"><div className="text-sm font-semibold text-sky-700">Total EENC Courses</div><div className="text-3xl font-bold">{courseKPIs.totalEencCourses}</div></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <Card className="p-0">
                                <h4 className="font-semibold text-xl pl-4 pt-4 mb-0">Number of Courses by State</h4>
                                <Table headers={coursesByState.headers}>
                                    {coursesByState.body.map((row, index) => (<tr key={index}>{row.map((cell, cellIndex) => (<td key={cellIndex} className="p-2 border">{cell}</td>))}</tr>))}
                                    <tr className="font-bold bg-gray-100">{coursesByState.totals.map((cell, index) => (<td key={index} className="p-2 border">{cell}</td>))}</tr>
                                </Table>
                            </Card>
                            <Card className="p-0">
                                <h4 className="font-semibold text-xl pl-4 pt-4 mb-0">Course Locations on Map</h4>
                                <SudanMap data={localMapData} center={[30, 15.5]} scale={2000} isMovable={false} pannable={false} />
                            </Card>
                        </div>
                    </div>
                )}

                {activeCoursesTab === 'compiled-reports' && (
                    loadingFacilities ? (
                        <div className="flex justify-center p-8"><Spinner /></div>
                    ) : (
                        <CompiledReportView 
                            allCourses={dashboardCourses} 
                            allParticipants={dashboardParticipants} 
                            allHealthFacilities={allHealthFacilities} 
                        />
                    )
                )}

                {activeCoursesTab === 'administration' && (
                    <CourseAdministrationView 
                        courses={allCourses} 
                        onApproveDelete={(id) => handleCourseDeleteAction(id, false)} 
                        onRejectDelete={handleRejectDelete} 
                    />
                )}

                {activeCoursesTab === 'approvals' && (
                    <CourseApprovalsView 
                        courses={allCourses} 
                        onApproveCourse={handleApproveCourse}
                    />
                )}

                {activeCoursesTab === 'recycle-bin' && <RecycleBinView courses={allCourses.filter(c => c.inRecycleBin)} onRestore={handleRestoreCourse} onPermanentDelete={handlePermanentDelete} />}
                
                {(activeCoursesTab === 'add-course' || activeCoursesTab === 'edit-course') && (
                    <CourseForm courseType={activeCourseType} initialData={courseToEdit} onCancel={handleCancelCourseForm} onSave={handleSaveCourseAndReturn} facilitatorsList={facilitatorsList} fundersList={funders || []} federalCoordinatorsList={federalCoordinators || []} stateCoordinatorsList={stateCoordinators || []} localityCoordinatorsList={localityCoordinators || []} userStates={userStates} userLocalities={userLocalities} />
                )}
                
                {loadingDetails && (!globalTabs.includes(activeCoursesTab)) ? <div className="flex justify-center p-8"><Spinner /></div> : (
                    <>
                        {activeCoursesTab === 'participants' && selectedCourse && (
                            <ParticipantsView
                                course={selectedCourse} participants={participants} onAdd={onAddParticipant} onOpen={(id) => { onSetSelectedParticipantId(id); setActiveCoursesTab('monitoring'); }}
                                onEdit={onEditParticipant} onDelete={onDeleteParticipant} onOpenReport={onOpenParticipantReport} onImport={onImportParticipants}
                                onBatchUpdate={onBatchUpdate} onBulkMigrate={onBulkMigrate} onOpenTestFormForParticipant={handleOpenTestFormForParticipant}
                                isCourseActive={isCourseActive} canAddParticipant={canManageCourse} canImportParticipants={canUseSuperUserAdvancedFeatures}
                                canCleanParticipantData={canUseSuperUserAdvancedFeatures} canBulkChangeParticipants={canUseSuperUserAdvancedFeatures}
                                canBulkMigrateParticipants={canUseSuperUserAdvancedFeatures} canAddMonitoring={(canManageCourse && isCourseActive) || canUseFederalManagerAdvancedFeatures}
                                canEditDeleteParticipantActiveCourse={canManageCourse} canEditDeleteParticipantInactiveCourse={canUseFederalManagerAdvancedFeatures}
                            />
                        )}
                        {activeCoursesTab === 'participants' && !selectedCourse && activeCoursesTab !== 'courses' && <EmptyState message="Please select a course from the 'Courses' tab to view participants." />}
                        {activeCoursesTab === 'monitoring' && selectedCourse && currentParticipant && <Suspense fallback={<Spinner />}><ObservationView course={selectedCourse} participant={currentParticipant} participants={participants} onChangeParticipant={(id) => onSetSelectedParticipantId(id)} /></Suspense>}
                        {activeCoursesTab === 'monitoring' && selectedCourse && !currentParticipant && activeCoursesTab !== 'courses' && <EmptyState message="Please select a participant from the 'Participants' tab to begin monitoring." />}
                        {activeCoursesTab === 'reports' && selectedCourse && <Suspense fallback={<Spinner />}><ReportsView course={selectedCourse} participants={participants} /></Suspense>}
                        {activeCoursesTab === 'enter-test-scores' && selectedCourse && (
                            <CourseTestForm
                                course={selectedCourse} participants={participants} participantTests={participantTests} initialParticipantId={selectedParticipantId}
                                onSaveTest={onSaveParticipantTest} onCancel={() => setActiveCoursesTab(selectedParticipantId ? 'participants' : 'courses')}
                                onSave={() => { setActiveCoursesTab('participants'); onBatchUpdate(); }} canManageTests={canManageCourse || canUseFederalManagerAdvancedFeatures} onSaveParticipant={onSaveParticipant}
                            />
                        )}
                    </>
                )}
            </div>
        </Card>
    );
}

const SearchableSelect = ({ label, options, value, onChange, onOpenNewForm, placeholder }) => {
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
    federalCoordinatorsList = [], stateCoordinatorsList = [], localityCoordinatorsList = [],
    userStates, userLocalities // Access to the user's allowed states and localities
}) {
    // Determine allowed states based on userStates prop
    const availableStates = useMemo(() => {
        const allStates = Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(b.ar));
        // If userStates is null or empty, assume they have access to all (like a super user)
        if (!userStates || userStates.length === 0) {
            return allStates;
        }
        return allStates.filter(s => userStates.includes(s));
    }, [userStates]);

    // If initialData exists, use it. Otherwise, if the user only has exactly 1 state, auto-select it.
    const [state, setState] = useState(initialData?.state || (userStates && userStates.length === 1 ? userStates[0] : ''));
    
    // Determine allowed localities based on the selected state AND the userLocalities prop
    const availableLocalities = useMemo(() => {
        if (!state) return [];
        const allLocalitiesForState = (STATE_LOCALITIES[state]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar));
        
        if (!userLocalities || userLocalities.length === 0) {
            return allLocalitiesForState;
        }
        
        // Filter the state's localities by what the user is allowed to access
        return allLocalitiesForState.filter(l => userLocalities.includes(l.en) || userLocalities.includes(l.ar));
    }, [state, userLocalities]);

    // Set initial locality. If availableLocalities is exactly 1, auto select it.
    const [locality, setLocality] = useState(initialData?.locality || (userLocalities && userLocalities.length === 1 ? userLocalities[0] : ''));
    
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
    const SMALL_AND_SICK_SUBCOURSE_TYPES = ['Portable warmer training', 'CPAP training', 'Kangaroo mother Care'];

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

    const PROGRAM_MANAGEMENT_SUBCOURSE_TYPES = [
        'IMNCI implementation operational Guide (الدليل التشغيلي لتطبيق العلاج المتكامل)',
        'planning, Monitoring and evaluation (التخطيط والمتابعة والتقييم)'
    ];

    const COURSE_GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];

    const isImnci = courseType === 'IMNCI';
    const isInfectionControl = courseType === 'IPC';
    const isIccm = courseType === 'ICCM';
    const isSmallAndSick = courseType === 'Small & Sick Newborn';
    const isEenc = courseType === 'EENC';
    const isEtat = courseType === 'ETAT';
    const isProgramManagement = courseType === 'Program Management';

    // DEFAULT TO TWO GROUPS
    const [groups, setGroups] = useState(initialData?.facilitatorAssignments?.length > 0 ? [...new Set(initialData.facilitatorAssignments.map(a => a.group))] : ['Group A', 'Group B']);

    // DEFAULT TO TWO FACILITATORS PER GROUP
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
        return {
            'Group A': [{ imci_sub_type: defaultSubcourse, name: '' }, { imci_sub_type: defaultSubcourse, name: '' }],
            'Group B': [{ imci_sub_type: defaultSubcourse, name: '' }, { imci_sub_type: defaultSubcourse, name: '' }]
        };
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
                
                if (isIccm) return fCourses.includes('ICCM') || fCourses.includes('IMNCI');
                if (isInfectionControl) return fCourses.includes('IPC');
                if (isProgramManagement) return fCourses.includes('Program Management') || fCourses.includes('IMNCI');
                
                return fCourses.includes(courseType);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, courseType, isInfectionControl, isIccm, isProgramManagement]);

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
            setError('الرجاء إكمال جميع الحقول المطلوبة.');
            return;
        }
        
        if (!courseType) {
            setError('تعذر تحديد نوع الدورة. الرجاء العودة لصفحة الدورات واختيار حزمة قبل إضافة دورة جديدة.');
            return;
        }

        if (!isInfectionControl && !director) {
            setError('الرجاء اختيار مدير الدورة. هذا الحقل إلزامي لهذا النوع من الدورات.');
            return;
        }

        if (!isInfectionControl && !isSmallAndSick && allFacilitatorAssignments.length === 0) {
             setError('الرجاء تعيين ميسر واحد على الأقل.');
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
            approvalStatus: initialData?.approvalStatus || 'pending', 
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
            <div className="p-6" dir="rtl" style={{ textAlign: 'right' }}>
                <PageHeader title={initialData ? 'تعديل دورة' : 'إضافة دورة'} subtitle={`الحزمة: ${courseType || 'غير محدد'}`} className="mb-6" />
                {error && <div className="p-3 mb-6 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                
                {/* Section 1: Course Information */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold bg-sky-100 text-sky-800 p-3 rounded-md mb-4 border-r-4 border-sky-500">معلومات الدورة الأساسية</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FormGroup label="الولاية">
                            <Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}>
                                <option value="">— اختر الولاية —</option>
                                {availableStates.map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="المحلية">
                            <Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}>
                                <option value="">— اختر المحلية —</option>
                                {availableLocalities.map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="قاعة الدورة"><Input value={hall} onChange={(e) => setHall(e.target.value)} /></FormGroup>
                        <FormGroup label="تاريخ بداية الدورة"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></FormGroup>
                        <FormGroup label="مدة الدورة بالأيام"><Input type="number" value={courseDuration} onChange={(e) => setCourseDuration(Number(e.target.value))} /></FormGroup>
                        <FormGroup label="عدد المشاركين"><Input type="number" value={participantsCount} onChange={(e) => setParticipantsCount(Number(e.target.value))} /></FormGroup>
                        <FormGroup label="ميزانية الدورة بالدولار الأمريكي"><Input type="number" value={courseBudget} onChange={(e) => setCourseBudget(Number(e.target.value))} /></FormGroup>
                    </div>
                </div>

                {/* Section 2: Coordination & Funding */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold bg-green-100 text-green-800 p-3 rounded-md mb-4 border-r-4 border-green-500">التنسيق والتمويل</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FormGroup label="المنسق الاتحادي للدورة">
                            <SearchableSelect
                                value={coordinator}
                                onChange={setCoordinator}
                                options={federalCoordinatorOptions}
                                placeholder="اكتب للبحث..."
                                label="المنسق الاتحادي للدورة"
                            />
                        </FormGroup>
                        <FormGroup label="المنسق الولائي للدورة">
                            <SearchableSelect
                                value={stateCoordinator}
                                onChange={setStateCoordinator}
                                options={stateCoordinatorOptions}
                                placeholder="اكتب للبحث..."
                                label="المنسق الولائي للدورة"
                            />
                        </FormGroup>
                        <FormGroup label="منسق الدورة بالمحلية">
                            <SearchableSelect
                                value={localityCoordinator}
                                onChange={setLocalityCoordinator}
                                options={localityCoordinatorOptions}
                                placeholder="اكتب للبحث..."
                                label="منسق الدورة بالمحلية"
                            />
                        </FormGroup>
                        <FormGroup label="بتمويل من">
                            <SearchableSelect
                                value={supporter}
                                onChange={setSupporter}
                                options={funderOptions}
                                placeholder="اكتب للبحث..."
                                label="بتمويل من"
                            />
                        </FormGroup>
                        <FormGroup label="تنفيذ">
                            <SearchableSelect
                                value={implementedBy}
                                onChange={setImplementedBy}
                                options={funderOptions}
                                placeholder="اكتب للبحث..."
                                label="تنفيذ"
                            />
                        </FormGroup>
                        <FormGroup label="مشروع الدورة">
                             <SearchableSelect
                                value={courseProject}
                                onChange={setCourseProject}
                                options={projectOptions}
                                placeholder="اكتب للبحث..."
                                label="مشروع الدورة"
                            />
                        </FormGroup>
                    </div>
                </div>

                {/* Section 3: Leadership Assignments */}
                {!isInfectionControl && (
                    <div className="mb-8">
                        <h3 className="text-lg font-bold bg-amber-100 text-amber-800 p-3 rounded-md mb-4 border-r-4 border-amber-500">مهام القيادة</h3>
                        <div className="flex flex-col space-y-4 p-5 border border-gray-200 shadow-sm rounded-lg bg-white">
                            {/* Director Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                                <FormGroup label="مدير الدورة">
                                    <SearchableSelect
                                        value={director}
                                        onChange={setDirector}
                                        options={directorOptions}
                                        placeholder="اكتب للبحث..."
                                        label="مدير الدورة"
                                    />
                                </FormGroup>
                                {isImnci && (
                                    <FormGroup label="اسم الورشة الفرعية">
                                        <Select value={directorImciSubType} onChange={(e) => setDirectorImciSubType(e.target.value)} className="w-full">
                                            {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                        </Select>
                                    </FormGroup>
                                )}
                            </div>

                            {/* Clinical Instructor Row */}
                            {(isImnci || isIccm) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end pt-5 border-t border-gray-100">
                                    <FormGroup label="المدرب السريري - اختياري">
                                        <SearchableSelect
                                            value={clinical}
                                            onChange={setClinical}
                                            options={clinicalInstructorOptions}
                                            placeholder="اكتب للبحث..."
                                            label="المدرب السريري - اختياري"
                                        />
                                    </FormGroup>
                                    {isImnci && (
                                        <FormGroup label="اسم الورشة الفرعية">
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

                {/* Section 4: Facilitators */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold bg-purple-100 text-purple-800 p-3 rounded-md mb-4 border-r-4 border-purple-500">مهام الميسرين / المدربين</h3>
                    <div className="space-y-6">
                        {groups.map(groupName => (
                            <div key={groupName} className="p-6 border-2 border-indigo-50 shadow-md rounded-xl bg-white relative">
                                <h4 className="text-md font-bold mb-5 text-indigo-700 bg-indigo-50 inline-block px-4 py-1.5 rounded-lg border border-indigo-200">{groupName}</h4>
                                {facilitatorGroups[groupName]?.map((assignment, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4 items-end pb-4 border-b border-gray-50 last:border-0">
                                        {/* NAME FIRST */}
                                        <FormGroup label="اسم الميسر" className={isIccm ? "lg:col-span-2" : ""}>
                                            <SearchableSelect
                                                value={assignment.name}
                                                onChange={(value) => updateFacilitatorAssignment(groupName, index, 'name', value)}
                                                options={facilitatorOptions}
                                                placeholder="اكتب للبحث..."
                                                label="اسم الميسر"
                                            />
                                        </FormGroup>
                                        {/* SUBCOURSE SECOND */}
                                        {!isIccm && (
                                            <FormGroup label="اسم الورشة الفرعية">
                                                <Select
                                                    value={assignment.imci_sub_type || ''}
                                                    onChange={(e) => updateFacilitatorAssignment(groupName, index, 'imci_sub_type', e.target.value)}
                                                    className="w-full"
                                                >
                                                    <option value="">— اختر الورشة الفرعية —</option>
                                                    {(isImnci ? IMNCI_SUBCOURSE_TYPES : 
                                                      isIccm ? ICCM_SUBCOURSE_TYPES : 
                                                      isInfectionControl ? INFECTION_CONTROL_SUBCOURSE_TYPES : 
                                                      isSmallAndSick ? SMALL_AND_SICK_SUBCOURSE_TYPES :
                                                      isEenc ? EENC_SUBCOURSE_TYPES :
                                                      isEtat ? ETAT_SUBCOURSE_TYPES :
                                                      isProgramManagement ? PROGRAM_MANAGEMENT_SUBCOURSE_TYPES :
                                                      []
                                                    ).map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </Select>
                                            </FormGroup>
                                        )}
                                        {/* ACTION BUTTON */}
                                        <div className="flex items-end pb-1">
                                            <Button type="button" variant="danger" onClick={() => removeFacilitatorFromGroup(groupName, index)} disabled={facilitatorGroups[groupName]?.length <= 1}>إزالة</Button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-end mt-2 pt-4">
                                    <Button type="button" variant="secondary" onClick={() => addFacilitatorToGroup(groupName)} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">إضافة ميسر آخر لهذه المجموعة</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {groups.length < COURSE_GROUPS.length && (
                        <div className="flex justify-start mt-4">
                            <Button type="button" variant="secondary" onClick={addGroup} className="font-bold border-dashed border-2">إضافة مجموعة أخرى</Button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 justify-end mt-8 border-t pt-6">
                    <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
                    <Button onClick={submit}>حفظ الدورة</Button>
                </div>
            </div>
        </Card>
    );
}

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