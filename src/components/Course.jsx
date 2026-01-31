// components/Course.jsx
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
import { Users, Download, Calendar, Clock, Share2, UserPlus, CheckCircle } from 'lucide-react'; 
import { useDataCache } from '../DataContext'; 

// Lazy load components that are not always visible to speed up initial load
const ReportsView = React.lazy(() => import('./ReportsView').then(module => ({ default: module.ReportsView })));
const ObservationView = React.lazy(() => import('./MonitoringView').then(module => ({ default: module.ObservationView })));


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

const generateFullCourseReportPdf = async (course, overallChartRef, dailyChartRef) => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const fileName = `Course_Report_${course.course_type}_${course.state}.pdf`;
    const element = document.getElementById('full-course-report');

    if (!element) {
        console.error("The element with ID 'full-course-report' was not found.");
        return;
    }

    const imageLoadPromises = [];

    const overallImg = overallChartRef.current ? new Image() : null;
    if (overallImg) {
        const promise = new Promise((resolve) => {
            overallImg.onload = resolve;
            overallImg.src = overallChartRef.current.toBase64Image('image/png', 1.0);
            overallImg.style.display = 'block';
            overallImg.style.margin = '20px auto';
            const placeholder = element.querySelector('#overall-chart-placeholder');
            if(placeholder) placeholder.appendChild(overallImg);
        });
        imageLoadPromises.push(promise);
    }

    const dailyImg = dailyChartRef.current ? new Image() : null;
    if (dailyImg) {
        const promise = new Promise((resolve) => {
            dailyImg.onload = resolve;
            dailyImg.src = dailyChartRef.current.toBase64Image('image/png', 1.0);
            dailyImg.style.display = 'block';
            dailyImg.style.margin = '20px auto';
            const placeholder = element.querySelector('#daily-chart-placeholder');
            if(placeholder) placeholder.appendChild(dailyImg);
        });
        imageLoadPromises.push(promise);
    }

    await Promise.all(imageLoadPromises);

    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
        position = -heightLeft;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    doc.save(fileName);

    if(overallImg) overallImg.remove();
    if(dailyImg) dailyImg.remove();
};

const HospitalIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v2.85c-.9.17-1.72.6-2.43 1.24L4.3 11.2a1 1 0 0 0-.2 1.39l.2.2c.45.6.84 1.34 1.36 2.14L6 15l2.43-1.6c.71-.48 1.54-.74 2.43-.84V14a1 1 0 0 0 1 1h2c.7 0 1.25-.56 1.25-1.25S15.7 12.5 15 12.5V11a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v1.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V9.85c-.9-.1-1.72-.36-2.43-.84L4.3 7.8a1 1 0 0 0-.2-1.39l.2-.2c.45-.6.84-1.34 1.36-2.14L6 3l2.43 1.6c.71.48 1.54-.74 2.43 .84V5a3 3 0 0 0-3-3zM12 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2zM18 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2z"></path><path d="M12 18.5V22"></path><path d="M12 11h-2"></path><path d="M14 11h2"></path><path d="M18 11h2"></path></svg>;

const IccmIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline><path d="M12 9v6"></path><path d="M9 12h6"></path></svg>;
const IpcIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 11v4"></path><path d="M10 13h4"></path></svg>;
const NewbornIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9c0-2-1.5-3.5-4-3.5C7.5 5.5 6 7 6 9c0 1.5.5 2.5 1 3.5h0l-1 4.5h10L17 17l-1-4.5h0c.5-1 1-2.5 1-3.5z"></path><path d="M12 18h.01"></path><path d="M10.5 21v-1.5h3V21"></path></svg>;

// --- UPDATED: Public Participant Registration Modal ---
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

// --- NEW COMPONENT: Public Registration Page (Route Target) ---
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


export function CoursesTable({ 
    courses, onOpen, onEdit, onDelete, onOpenReport, onOpenTestForm, 
    canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates, onAddFinalReport, canManageFinalReport,
    onOpenAttendanceManager 
}) {
    const [reportModalCourse, setReportModalCourse] = useState(null);
    const [monitorModalCourse, setMonitorModalCourse] = useState(null);
    
    // --- STATE for Attendance Modals ---
    const [attendanceModalCourse, setAttendanceModalCourse] = useState(null); // The modal to pick action (Link or Report)
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
                        const active = isCourseActive(c);
                        const canEdit = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                        const canDelete = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                        const subcourses = c.facilitatorAssignments && c.facilitatorAssignments.length > 0
                            ? [...new Set(c.facilitatorAssignments.map(a => a.imci_sub_type))].join(', ')
                            : 'N/A';

                        return (
                            <tr key={c.id} className="hover:bg-gray-50">
                                <td className="p-4 border">{c.state}</td>
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
                                    <div className="flex gap-1 flex-nowrap justify-end items-center">
                                        <Button variant="primary" className="px-2 py-1 text-xs" onClick={() => onOpen(c.id)}>Open</Button>
                                        
                                        <Button 
                                            variant="secondary" 
                                            className="px-2 py-1 text-xs" 
                                            onClick={() => setReportModalCourse(c)}
                                        >
                                            Report
                                        </Button>
                                        
                                        <Button 
                                            variant="secondary" 
                                            className="px-2 py-1 text-xs" 
                                            onClick={() => setAttendanceModalCourse(c)}
                                        >
                                            Attendance
                                        </Button>

                                        <Button 
                                            variant="secondary" 
                                            className="px-2 py-1 text-xs" 
                                            onClick={() => setMonitorModalCourse(c)}
                                        >
                                            Share Monitor & Test
                                        </Button>

                                        <Button
                                            variant="secondary"
                                            className="px-2 py-1 text-xs"
                                            onClick={() => onEdit(c)}
                                            disabled={!canEdit}
                                            title={!canEdit ? "You do not have permission to edit this course." : ""}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="danger"
                                            className="px-2 py-1 text-xs"
                                            onClick={() => onDelete(c.id)}
                                            disabled={!canDelete}
                                            title={!canDelete ? "You do not have permission to delete this course." : ""}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </Table>

                {reportModalCourse && (
                    <Modal isOpen={!!reportModalCourse} onClose={() => setReportModalCourse(null)} title="Course Reports">
                        <CardBody className="flex flex-col gap-3">
                             <Button variant="secondary" onClick={() => {
                                 onOpenReport(reportModalCourse.id);
                                 setReportModalCourse(null);
                             }}>
                                 View Course Analytics
                             </Button>
                             {canManageFinalReport && (
                                 <Button variant="secondary" onClick={() => {
                                     onAddFinalReport(reportModalCourse.id);
                                     setReportModalCourse(null);
                                 }}>
                                     Final Report
                                 </Button>
                             )}
                        </CardBody>
                        <CardFooter>
                            <Button variant="secondary" onClick={() => setReportModalCourse(null)}>Close</Button>
                        </CardFooter>
                    </Modal>
                )}

                {/* --- Attendance Action Modal --- */}
                {attendanceModalCourse && (
                    <Modal isOpen={!!attendanceModalCourse} onClose={() => setAttendanceModalCourse(null)} title="Attendance Management">
                        <CardBody className="flex flex-col gap-4">
                            {/* --- MOVED UP: Share Registration Link --- */}
                            <div className="space-y-2 pb-4 border-b">
                                <h4 className="font-semibold text-gray-700">Registration</h4>
                                <Button 
                                    variant="secondary" 
                                    className="w-full justify-start"
                                    onClick={() => {
                                        const link = `${window.location.origin}/public/register/course/${attendanceModalCourse.id}`;
                                        navigator.clipboard.writeText(link)
                                            .then(() => alert('Public registration link copied!'))
                                            .catch(() => alert('Failed to copy link.'));
                                        setAttendanceModalCourse(null);
                                    }}
                                >
                                    <UserPlus className="w-4 h-4 mr-2" /> Share Registration Link
                                </Button>
                            </div>

                            <div className="space-y-2 pb-4 border-b">
                                <h4 className="font-semibold text-gray-700">Share Attendance Link</h4>
                                <div className="bg-gray-50 p-3 rounded-md border">
                                    <label className="block text-sm text-gray-600 mb-1">Select Session Date</label>
                                    <Input 
                                        type="date" 
                                        value={attendanceDate} 
                                        onChange={(e) => setAttendanceDate(e.target.value)}
                                        className="mb-2"
                                    />
                                    <p className="text-xs text-gray-500 mb-2">
                                        The link generated will <strong>only work on this specific date</strong>.
                                    </p>
                                    <Button variant="secondary" className="w-full justify-start" onClick={() => {
                                        const link = `${window.location.origin}/attendance/course/${attendanceModalCourse.id}?date=${attendanceDate}`;
                                        navigator.clipboard.writeText(link)
                                            .then(() => alert(`Attendance link for ${attendanceDate} copied!`))
                                            .catch(() => alert('Failed to copy link.'));
                                        setAttendanceModalCourse(null);
                                    }}>
                                        <Calendar className="w-4 h-4 mr-2" /> Copy Attendance Link
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-semibold text-gray-700">Reports & Management</h4>
                                <Button 
                                    variant="secondary" 
                                    className="w-full justify-start"
                                    onClick={() => {
                                        if (onOpenAttendanceManager) {
                                            onOpenAttendanceManager(attendanceModalCourse.id);
                                        } else {
                                            console.error("onOpenAttendanceManager is not defined");
                                        }
                                        setAttendanceModalCourse(null);
                                    }}
                                >
                                    <Clock className="w-4 h-4 mr-2" /> Open Attendance Dashboard
                                </Button>
                            </div>
                        </CardBody>
                        <CardFooter>
                            <Button variant="secondary" onClick={() => setAttendanceModalCourse(null)}>Close</Button>
                        </CardFooter>
                    </Modal>
                )}

                {monitorModalCourse && (
                    <Modal isOpen={!!monitorModalCourse} onClose={() => setMonitorModalCourse(null)} title="Monitoring & Testing">
                        <CardBody className="flex flex-col gap-4">
                            <div className="space-y-2 pb-4 border-b">
                                <h4 className="font-semibold text-gray-700">General Monitoring</h4>
                                <Button variant="secondary" className="w-full justify-start" onClick={() => {
                                    const link = `${window.location.origin}/monitor/course/${monitorModalCourse.id}`;
                                    navigator.clipboard.writeText(link)
                                        .then(() => alert('Public monitoring link copied to clipboard!'))
                                        .catch(() => alert('Failed to copy link.'));
                                    setMonitorModalCourse(null);
                                }}>
                                    <Users className="w-4 h-4 mr-2" /> Share Monitoring Link
                                </Button>
                            </div>

                            {(monitorModalCourse.course_type === 'ICCM' || monitorModalCourse.course_type === 'EENC' || monitorModalCourse.course_type === 'Small & Sick Newborn' || monitorModalCourse.course_type === 'IMNCI' || monitorModalCourse.course_type === 'ETAT') && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-gray-700">Testing</h4>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="secondary" className="w-full justify-center" onClick={() => {
                                            const link = `${window.location.origin}/public/test/course/${monitorModalCourse.id}?type=pre`;
                                            navigator.clipboard.writeText(link)
                                                .then(() => alert('Public Pre-Test link copied!'))
                                                .catch(() => alert('Failed to copy link.'));
                                            setMonitorModalCourse(null);
                                        }}>
                                            <Share2 className="w-4 h-4 mr-2" /> Share Pre-Test
                                        </Button>
                                        <Button variant="secondary" className="w-full justify-center" onClick={() => {
                                            const link = `${window.location.origin}/public/test/course/${monitorModalCourse.id}?type=post`;
                                            navigator.clipboard.writeText(link)
                                                .then(() => alert('Public Post-Test link copied!'))
                                                .catch(() => alert('Failed to copy link.'));
                                            setMonitorModalCourse(null);
                                        }}>
                                            <Share2 className="w-4 h-4 mr-2" /> Share Post-Test
                                        </Button>
                                    </div>

                                    <Button variant="secondary" className="w-full justify-start" onClick={() => {
                                        onOpenTestForm(monitorModalCourse.id);
                                        setMonitorModalCourse(null);
                                    }}>
                                        <Clock className="w-4 h-4 mr-2" /> Open Pre & Post Test
                                    </Button>
                                </div>
                            )}
                        </CardBody>
                        <CardFooter>
                            <Button variant="secondary" onClick={() => setMonitorModalCourse(null)}>Close</Button>
                        </CardFooter>
                    </Modal>
                )}
            </div>
        )
    );
}

// ... [The rest of the Course.jsx exports (CourseManagementView, CourseForm, etc.) remain unchanged] ...
export { PublicAttendanceView, AttendanceManagerView } from './CourseAttendanceView';
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

    const coursesForActiveType = useMemo(() => {
        if (!activeCourseType) return [];
        return allCourses.filter(c => c.course_type === activeCourseType);
    }, [allCourses, activeCourseType]);

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

    const courses = useMemo(() => {
        return coursesForActiveType.filter(c => {
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


    return (
        <Card>
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
                <Button variant="tab" isActive={activeCoursesTab === 'courses' || activeCoursesTab === 'add-course' || activeCoursesTab === 'edit-course'} onClick={() => setActiveCoursesTab('courses')}>Courses</Button>

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
                                    onDelete={onDelete}
                                    onOpenReport={onOpenReport}
                                    onOpenTestForm={handleOpenTestForm}
                                    onOpenAttendanceManager={onOpenAttendanceManager} // Pass prop
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
                
                {loadingDetails && (activeCoursesTab !== 'courses' && activeCoursesTab !== 'add-course' && activeCoursesTab !== 'edit-course') ? <div className="flex justify-center p-8"><Spinner /></div> : (
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
    federalCoordinatorsList = [], stateCoordinatorsList = [], localityCoordinatorsList = []
}) {
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

export function PublicCourseMonitoringView({ course, allParticipants }) {
    const [selectedGroup, setSelectedGroup] = useState('All');
    const [selectedParticipantId, setSelectedParticipantId] = useState('');

    const groups = useMemo(() => {
        const groupSet = new Set(allParticipants.map(p => p.group || 'N/A'));
        return ['All', ...Array.from(groupSet).sort()];
    }, [allParticipants]);

    const filteredParticipants = useMemo(() => {
        if (selectedGroup === 'All') {
            return allParticipants.sort((a, b) => a.name.localeCompare(b.name));
        }
        return allParticipants
            .filter(p => (p.group || 'N/A') === selectedGroup)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allParticipants, selectedGroup]);

    const selectedParticipant = useMemo(() => {
        if (!selectedParticipantId) {
            return null;
        }
        return allParticipants.find(p => p.id === selectedParticipantId);
    }, [allParticipants, selectedParticipantId]);

    const handleGroupChange = (e) => {
        setSelectedGroup(e.target.value);
        setSelectedParticipantId(''); 
    };

    const handleParticipantChange = (e) => {
        setSelectedParticipantId(e.target.value);
    };

    return (
        <div className="grid gap-4">
            <PageHeader
                title={`Data Entry for: ${course.course_type}`}
                subtitle={`${course.state} / ${course.locality} (Started: ${course.start_date})`}
            />

            <Card>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormGroup label="Select Group">
                        <Select value={selectedGroup} onChange={handleGroupChange}>
                            {groups.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Select Participant">
                        <Select value={selectedParticipantId} onChange={handleParticipantChange} disabled={selectedGroup === ''}>
                            <option value="">-- Select a participant --</option>
                            {filteredParticipants.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </Select>
                    </FormGroup>
                </div>
            </Card>

            {selectedParticipant ? (
                <Suspense fallback={<Card><Spinner /></Card>}>
                    <ObservationView
                        course={course}
                        participant={selectedParticipant}
                        participants={filteredParticipants} 
                        onChangeParticipant={handleParticipantChange} 
                        initialCaseToEdit={null} 
                        isPublicView={true} 
                    />
                </Suspense>
            ) : (
                <Card>
                    <div className="p-6 text-center text-gray-500">
                        Please select a group and participant to begin data entry.
                    </div>
                </Card>
            )}
        </div>
    );
}

// --- NEW: Certificate Verification View Component ---
export function CertificateVerificationView({ participant, course }) {
    if (!participant || !course) return <EmptyState message="Invalid certificate data." />;

    const courseTypeTitle = course.course_type === 'IMNCI' ? 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)' :
                            course.course_type === 'ICCM' ? 'Integrated Community case management for under 5 children (iCCM)' :
                            course.course_type === 'ETAT' ? 'Emergency Triage, Assessment & Treatment (ETAT)' :
                            course.course_type === 'EENC' ? 'Early Essential Newborn Care (EENC)' :
                            course.course_type;

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <Card className="w-full max-w-lg border-t-4 border-green-500">
                <div className="p-8 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Certificate Verified</h2>
                    <p className="text-gray-600 mb-6">This certificate is valid and issued by the National Child Health Program.</p>
                    
                    <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3 border border-gray-200">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Participant Name</p>
                            <p className="text-lg font-medium text-gray-900">{participant.name}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Course</p>
                            <p className="text-md font-medium text-gray-900">{courseTypeTitle}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Location</p>
                            <p className="text-md font-medium text-gray-900">{course.state} - {course.locality}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Date</p>
                            <p className="text-md font-medium text-gray-900">{course.start_date}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-center">
                    <p className="text-xs text-gray-500">Verified by NCHP System</p>
                </div>
            </Card>
        </div>
    );
}

// --- NEW: Public Certificate Download View ---
export function PublicCertificateDownloadView({ participantId }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [generating, setGenerating] = useState(false);

    // Extract language from URL query params
    const searchParams = new URLSearchParams(window.location.search);
    const language = searchParams.get('lang') || 'en';

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Participant
                const participant = await getParticipantById(participantId, 'server'); 
                if (!participant) throw new Error("Participant not found.");

                // 2. Fetch Course
                const course = await getCourseById(participant.courseId, 'server');
                if (!course) throw new Error("Course not found.");

                // --- NEW CHECK: Ensure Certificate is Approved ---
                if (!course.isCertificateApproved) {
                    throw new Error("Certificates for this course have not yet been approved/released by the National Child Health Program.");
                }
                // -----------------------------------------------

                // 3. Fetch Federal Manager Name (Handle Permission Error Gracefully)
                let managerName = "Federal Program Manager";
                try {
                    const coords = await listCoordinators('federalCoordinators');
                    const manager = coords.find(c => c.role === 'مدير البرنامج');
                    if (manager) managerName = manager.name;
                } catch (e) {
                    console.warn("Could not fetch coordinators (likely permission issue). Using default.", e);
                    // Fallback is already set
                }

                // 4. Determine Subcourse
                let subCourse = participant.imci_sub_type;
                if (!subCourse && course.facilitatorAssignments) {
                    const assignment = course.facilitatorAssignments.find(a => a.group === participant.group);
                    subCourse = assignment?.imci_sub_type;
                }

                setData({ participant, course, managerName, subCourse });
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (participantId) fetchData();
    }, [participantId]);

    const handleDownload = async () => {
        if (!data) return;
        setGenerating(true);
        try {
            const canvas = await generateCertificatePdf(
                data.course, 
                data.participant, 
                data.managerName, 
                data.subCourse, 
                language // Use the language from URL
            );
            
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                const imgWidth = 297;
                const imgHeight = 210;
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                const fileName = `Certificate_${data.participant.name.replace(/ /g, '_')}_${language}.pdf`;
                doc.save(fileName);
            }
        } catch (err) {
            alert("Failed to generate certificate: " + err.message);
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Spinner /></div>;
    if (error) return <EmptyState message={`Error: ${error}`} />;
    if (!data) return <EmptyState message="No data found." />;

    const isArabic = language === 'ar';

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full">
                <div className="p-8 text-center space-y-6">
                    <div className="mx-auto h-20 w-20 bg-sky-100 rounded-full flex items-center justify-center">
                        <PdfIcon className="h-10 w-10 text-sky-600" />
                    </div>
                    
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isArabic ? 'تحميل الشهادة' : 'Download Certificate'}
                        </h1>
                        <p className="text-gray-600 mt-2">
                            {isArabic 
                                ? `شهادة اكمال دورة لـ: ${data.participant.name}` 
                                : `Course Completion Certificate for: ${data.participant.name}`}
                        </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border text-left space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">{isArabic ? 'الدورة' : 'Course'}:</span>
                            <span className="font-medium">{data.course.course_type}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">{isArabic ? 'التاريخ' : 'Date'}:</span>
                            <span className="font-medium">{data.course.start_date}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">{isArabic ? 'اللغة' : 'Language'}:</span>
                            <span className="font-medium uppercase">{language}</span>
                        </div>
                    </div>

                    <Button 
                        onClick={handleDownload} 
                        disabled={generating}
                        className="w-full py-3 text-lg justify-center"
                    >
                        {generating 
                            ? (isArabic ? 'جاري التحميل...' : 'Generating PDF...') 
                            : (isArabic ? 'تحميل الشهادة (PDF)' : 'Download Certificate (PDF)')}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

// --- NEW: Public Course Certificates Page ---
export function PublicCourseCertificatesView({ courseId }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState({ course: null, participants: [], managerName: '' });
    const [downloadingId, setDownloadingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Read 'lang' from URL to set initial language
    const searchParams = new URLSearchParams(window.location.search);
    const initialLang = searchParams.get('lang') || 'en';
    
    // State for language is initialized but NOT updated by user UI (locked)
    const [language] = useState(initialLang);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Course
                const course = await getCourseById(courseId, 'server');
                if (!course) throw new Error("Course not found.");

                // --- NEW CHECK: Ensure Certificate is Approved ---
                if (!course.isCertificateApproved) {
                    throw new Error("Certificates for this course have not yet been approved/released.");
                }
                // -----------------------------------------------

                // 2. Fetch All Participants
                const participants = await listAllParticipantsForCourse(courseId, 'server');

                // 3. Fetch Federal Manager Name (Handle Permission Error Gracefully)
                let managerName = "Federal Program Manager";
                try {
                    const coords = await listCoordinators('federalCoordinators');
                    const manager = coords.find(c => c.role === 'مدير البرنامج');
                    if (manager) managerName = manager.name;
                } catch (e) {
                    console.warn("Could not fetch coordinators (likely permission issue). Using default.", e);
                    // Fallback is already set
                }

                setData({ course, participants: participants || [], managerName });
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (courseId) fetchData();
    }, [courseId]);

    const handleDownload = async (participant) => {
        setDownloadingId(participant.id);
        try {
            // Determine Subcourse
            let subCourse = participant.imci_sub_type;
            if (!subCourse && data.course.facilitatorAssignments) {
                const assignment = data.course.facilitatorAssignments.find(a => a.group === participant.group);
                subCourse = assignment?.imci_sub_type;
            }

            const canvas = await generateCertificatePdf(
                data.course, 
                participant, 
                data.managerName, 
                subCourse, 
                language
            );
            
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                const imgWidth = 297;
                const imgHeight = 210;
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                const fileName = `Certificate_${participant.name.replace(/ /g, '_')}_${language}.pdf`;
                doc.save(fileName);
            }
        } catch (err) {
            alert("Failed to generate certificate: " + err.message);
        } finally {
            setDownloadingId(null);
        }
    };

    const filteredParticipants = useMemo(() => {
        if (!searchTerm) return data.participants;
        return data.participants.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [data.participants, searchTerm]);

    if (loading) return <div className="flex justify-center items-center h-screen"><Spinner /></div>;
    if (error) return <EmptyState message={`Error: ${error}`} />;
    if (!data.course) return <EmptyState message="Course not found." />;

    const isArabic = language === 'ar';

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <Card className="p-6 border-t-4 border-sky-500">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{data.course.course_type} Course Certificates</h1>
                            <p className="text-gray-600 mt-1">
                                {data.course.state} - {data.course.locality} | {data.course.start_date}
                            </p>
                        </div>
                        
                        <div className="flex items-center bg-white border border-gray-300 rounded-md px-3 py-2 shadow-sm">
                            <span className="text-sm font-bold text-gray-600 mr-2 uppercase">Certificate Language:</span>
                            <span className="text-sm font-medium text-sky-700">
                                {language === 'ar' ? 'Arabic (عربي)' : 'English'}
                            </span>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-700">
                            <Users className="w-5 h-5" />
                            <span className="font-semibold">{filteredParticipants.length} Participants</span>
                        </div>
                        <Input 
                            placeholder="Search by name..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-xs bg-white"
                        />
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Group</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Title</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredParticipants.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {p.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {p.group || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {p.job_title}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Button 
                                                onClick={() => handleDownload(p)}
                                                disabled={!!downloadingId}
                                                className={`inline-flex items-center gap-2 ${downloadingId === p.id ? 'opacity-70' : ''}`}
                                                size="sm"
                                                variant={downloadingId === p.id ? 'secondary' : 'primary'}
                                            >
                                                {downloadingId === p.id ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
                                                {downloadingId === p.id ? (isArabic ? 'جاري...' : 'Generating...') : (isArabic ? 'تحميل' : 'Download')}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredParticipants.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                            No participants found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}