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
    getCourseById, listAllParticipantsForCourse 
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
import { Users, Download, Calendar, Clock } from 'lucide-react'; 
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
    onOpenAttendanceManager // Prop received from parent
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
                                        
                                        {/* --- UPDATED: New Attendance Button --- */}
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

                {/* --- NEW: Attendance Action Modal --- */}
                {attendanceModalCourse && (
                    <Modal isOpen={!!attendanceModalCourse} onClose={() => setAttendanceModalCourse(null)} title="Attendance Management">
                        <CardBody className="flex flex-col gap-4">
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

// Export PublicAttendanceView from here so App.jsx (which imports from Course.jsx) doesn't break
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