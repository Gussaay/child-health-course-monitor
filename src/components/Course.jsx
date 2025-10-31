// Course.jsx
import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Line } from 'react-chartjs-2';
// --- MODIFIED: Added CourseIcon ---
import { Button, Card, EmptyState, FormGroup, Input, PageHeader, PdfIcon, Select, Spinner, Table, Textarea, CourseIcon } from './CommonComponents';
import { listAllDataForCourse, listParticipants, listCoordinators, upsertCoordinator, deleteCoordinator, listFunders, upsertFunder, deleteFunder, listFinalReport, upsertFinalReport, deleteFinalReport } from '../data.js';
// Updated imports for participant components
import { ParticipantsView, ParticipantForm } from './Participants';
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES,
} from './constants.js';
import html2canvas from 'html2canvas';

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
            const num = parseFloat(condition.replace('<=', ''));
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

// --- ADDED: HospitalIcon component (moved from App.jsx) ---
const HospitalIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v2.85c-.9.17-1.72.6-2.43 1.24L4.3 11.2a1 1 0 0 0-.2 1.39l.2.2c.45.6.84 1.34 1.36 2.14L6 15l2.43-1.6c.71-.48 1.54-.74 2.43-.84V14a1 1 0 0 0 1 1h2c.7 0 1.25-.56 1.25-1.25S15.7 12.5 15 12.5V11a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v1.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V9.85c-.9-.1-1.72-.36-2.43-.84L4.3 7.8a1 1 0 0 0-.2-1.39l.2-.2c.45-.6.84-1.34 1.36-2.14L6 3l2.43 1.6c.71.48 1.54-.74 2.43 .84V5a3 3 0 0 0-3-3zM12 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2zM18 22v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2z"></path><path d="M12 18.5V22"></path><path d="M12 11h-2"></path><path d="M14 11h2"></path><path d="M18 11h2"></path></svg>;

// --- ADDED: Landing component (moved from App.jsx) ---
const Landing = React.memo(function Landing({ active, onPick }) {
    const items = [
        { key: 'IMNCI', title: 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)', enabled: true },
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
                            {(it.key === 'IPC' || it.key === 'Small & Sick Newborn')
                                ? <HospitalIcon className="w-10 h-10 text-slate-500 flex-shrink-0" />
                                : <CourseIcon course={it.key} />
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


export function CoursesTable({ courses, onOpen, onEdit, onDelete, onOpenReport, canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates, onAddFinalReport, canManageFinalReport }) {
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
        sortedCourses.length === 0 ? <EmptyState message="No courses have been added yet for this package." /> : (
            <div>
                <h3 className="text-xl font-bold mb-4">{courseType} Courses</h3>
                <Table headers={["#", "State", "Locality", "Subcourses", "# Participants", "Status", "Actions"]}>
                    {sortedCourses.map((c, index) => {
                        const active = isCourseActive(c);
                        const canEdit = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                        const canDelete = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                        const subcourses = c.facilitatorAssignments && c.facilitatorAssignments.length > 0
                            ? [...new Set(c.facilitatorAssignments.map(a => a.imci_sub_type))].join(', ')
                            : 'N/A';

                        return (
                            <tr key={c.id} className="hover:bg-gray-50">
                                <td className="p-4 border font-medium text-gray-800">{index + 1}</td>
                                <td className="p-4 border">{c.state}</td>
                                <td className="p-4 border">{c.locality}</td>
                                <td className="p-4 border">{subcourses}</td>
                                <td className="p-4 border">{c.participants_count}</td>
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
                                <td className="p-4 border text-right">
                                    <div className="flex gap-2 flex-nowrap justify-end">
                                        <Button variant="primary" onClick={() => onOpen(c.id)}>Open Course</Button>
                                        <Button variant="secondary" onClick={() => onOpenReport(c.id)}>Course Reports</Button>
                                        {/* --- NEW BUTTON --- */}
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                const link = `${window.location.origin}/monitor/course/${c.id}`;
                                                navigator.clipboard.writeText(link)
                                                    .then(() => alert('Public monitoring link copied to clipboard!'))
                                                    .catch(() => alert('Failed to copy link.'));
                                            }}
                                            title="Copy public monitoring link for this course"
                                        >
                                            Share Monitoring
                                        </Button>
                                        {/* --- END NEW BUTTON --- */}
                                        <Button
                                            variant="secondary"
                                            onClick={() => onEdit(c)}
                                            disabled={!canEdit}
                                            title={!canEdit ? "You do not have permission to edit this course." : ""}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="danger"
                                            onClick={() => onDelete(c.id)}
                                            disabled={!canDelete}
                                            title={!canDelete ? "You do not have permission to delete this course." : ""}
                                        >
                                            Delete
                                        </Button>
                                        {canManageFinalReport && (
                                            <Button variant="secondary" onClick={() => onAddFinalReport(c.id)}>Final Report</Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </Table>
            </div>
        )
    );
}

// --- REMOVED CourseDetailView and DetailItem components ---

export function CourseManagementView({
    // --- MODIFIED: 'courses' prop is now 'allCourses' ---
    allCourses, onAdd, onOpen, onEdit, onDelete, onOpenReport,
    /* canAddCourse, */ canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates,
    activeCoursesTab, setActiveCoursesTab, selectedCourse, participants,
    onAddParticipant, onEditParticipant, onDeleteParticipant,
    onOpenParticipantReport, onImportParticipants, onAddFinalReport, onEditFinalReport,
    selectedParticipantId, onSetSelectedParticipantId, onBulkMigrate, onBatchUpdate,
    loadingDetails, 
    
    // --- ADDED PROPS FROM App.jsx ---
    canManageCourse,
    canUseSuperUserAdvancedFeatures,
    canUseFederalManagerAdvancedFeatures,

    // --- NEW PROPS to manage course type selection ---
    activeCourseType,
    setActiveCourseType
}) {
    const currentParticipant = participants.find(p => p.id === selectedParticipantId);

    // --- NEW: Filter allCourses based on activeCourseType ---
    const courses = useMemo(() => {
        if (!activeCourseType) return [];
        return allCourses.filter(c => c.course_type === activeCourseType);
    }, [allCourses, activeCourseType]);

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

    // --- MODIFIED: handleOpenCourse now defaults to 'participants' tab ---
    const handleOpenCourse = (id) => {
        onOpen(id);
                onSetSelectedParticipantId(null); // Clear participant selection when opening a new course
    };

    return (
        <Card>
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
                <Button variant="tab" isActive={activeCoursesTab === 'courses'} onClick={() => setActiveCoursesTab('courses')}>Courses</Button>

                {selectedCourse && (
                    <>
                        {/* --- REMOVED: Course Details Tab Button --- */}
                        <Button variant="tab" isActive={activeCoursesTab === 'participants'} onClick={() => { setActiveCoursesTab('participants'); onSetSelectedParticipantId(null); }}>Participants</Button>
                        <Button variant="tab" isActive={activeCoursesTab === 'monitoring'} onClick={() => setActiveCoursesTab('monitoring')} disabled={!currentParticipant}>Monitoring</Button>
                        <Button variant="tab" isActive={activeCoursesTab === 'reports'} onClick={() => setActiveCoursesTab('reports')}>Reports</Button>
                    </>
                )}
            </div>
            
            {/* --- MODIFIED: This entire block is refactored --- */}
            <div className="p-4">
                {/* --- COURSES TAB LOGIC --- */}
                {activeCoursesTab === 'courses' && (
                    <>
                        {!activeCourseType ? (
                            // Show package selector if no type is selected
                            <Landing
                                active={activeCourseType}
                                onPick={(t) => setActiveCourseType(t)}
                            />
                        ) : (
                            // Show course list if a type is selected
                            <div>
                                <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
                                    {/* "Add" button */}
                                    {canManageCourse && (
                                        <Button onClick={onAdd} className="bg-sky-600 text-white hover:bg-sky-700">Add New Course</Button>
                                    )}
                                    {/* "Change Package" button */}
                                    <Button variant="secondary" onClick={() => setActiveCourseType(null)}>
                                        Change Course Package
                                    </Button>
                                </div>
                                
                                <CoursesTable
                                    courses={courses} // Use the new filtered list
                                    onOpen={handleOpenCourse}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onOpenReport={onOpenReport}
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
                
                {/* --- OTHER TABS LOGIC --- */}
                {/* Show spinner *only* if not on courses tab and loading details */}
                {loadingDetails && activeCoursesTab !== 'courses' ? <div className="flex justify-center p-8"><Spinner /></div> : (
                    <>
                        {/* --- REMOVED: Course Details Content --- */}
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
                                // --- PASS ALL THE CORRECT PERMISSION PROPS ---
                                isCourseActive={isCourseActive}
                                canAddParticipant={canManageCourse}
                                canImportParticipants={canUseSuperUserAdvancedFeatures}
                                canCleanParticipantData={canUseSuperUserAdvancedFeatures}
                                canBulkChangeParticipants={canUseSuperUserAdvancedFeatures}
                                canBulkMigrateParticipants={canUseSuperUserAdvancedFeatures}
                                
                                // *** MODIFIED: This prop now uses the new logic ***
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
                    </>
                )}
            </div>
            {/* --- END OF MODIFIED BLOCK --- */}
        </Card>
    );
}

const NewFacilitatorForm = ({ initialName, onCancel, onSave }) => {
    const [name, setName] = useState(initialName || '');
    const [courses, setCourses] = useState([]);
    const [directorCourse, setDirectorCourse] = useState('No');
    const [isClinicalInstructor, setIsClinicalInstructor] = useState('No');

    const handleSave = () => {
        onSave({ name, courses, directorCourse, isClinicalInstructor });
    };

    return (
        <Card>
            <h3 className="text-xl font-bold mb-4">Add New Facilitator</h3>
            <FormGroup label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormGroup>
            <div className="flex gap-2 justify-end mt-4">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave}>Save Facilitator</Button>
            </div>
        </Card>
    );
};

const NewCoordinatorForm = ({ initialName, onCancel, onSave }) => {
    const [name, setName] = useState(initialName || '');
    const [state, setState] = useState('');
    const [locality, setLocality] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    const handleSave = () => {
        onSave({ name, state, locality, phoneNumber });
    };

    return (
        <Card>
            <h3 className="text-xl font-bold mb-4">Add New Coordinator</h3>
            <FormGroup label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormGroup>
            <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
            <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}</Select></FormGroup>
            <FormGroup label="Phone Number"><Input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></FormGroup>
            <div className="flex gap-2 justify-end mt-4">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave}>Save Coordinator</Button>
            </div>
        </Card>
    );
};

const NewFunderForm = ({ initialOrgName, onCancel, onSave }) => {
    const [orgName, setOrgName] = useState(initialOrgName || '');
    const [focalPerson, setFocalPerson] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    const handleSave = () => {
        onSave({ orgName, focalPerson, phoneNumber });
    };

    return (
        <Card>
            <h3 className="text-xl font-bold mb-4">Add New Funding Partner</h3>
            <FormGroup label="Organization Name"><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></FormGroup>
            <FormGroup label="Focal Person for Health"><Input value={focalPerson} onChange={(e) => setFocalPerson(e.target.value)} /></FormGroup>
            <FormGroup label="Phone Number"><Input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></FormGroup>
            <div className="flex gap-2 justify-end mt-4">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave}>Save Partner</Button>
            </div>
        </Card>
    );
};

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
        onOpenNewForm(inputValue);
        setIsOpen(false);
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
                    <div
                        className={`p-2 cursor-pointer font-medium text-indigo-600 hover:bg-gray-100 ${isNewEntry ? 'border-b' : ''}`}
                        onClick={handleAddNew}
                    >
                       {`+ Add "${isNewEntry ? inputValue : `New ${label ? label.replace(':', '') : ''}`}"`}
                    </div>
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
    onAddNewFacilitator, onAddNewCoordinator, onAddNewFunder, 
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

    const COURSE_GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];

    const [groups, setGroups] = useState(initialData?.facilitatorAssignments ? [...new Set(initialData.facilitatorAssignments.map(a => a.group))] : ['Group A']);

    const [facilitatorGroups, setFacilitatorGroups] = useState(() => {
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
        return { 'Group A': [{ imci_sub_type: '', name: '' }] };
    });

    const [error, setError] = useState('');

    const isImnci = courseType === 'IMNCI';
    const isInfectionControl = courseType === 'IPC';

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
                return fCourses.includes(isInfectionControl ? 'IPC' : courseType);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, courseType, isInfectionControl]);

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
        setFacilitatorGroups(prev => ({
            ...prev,
            [groupName]: [...prev[groupName], { imci_sub_type: '', name: '' }]
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
            const newGroup = COURSE_GROUPS[nextGroupIndex];
            setGroups(prev => [...prev, newGroup]);
            setFacilitatorGroups(prev => ({
                ...prev,
                [newGroup]: [{ imci_sub_type: '', name: '' }]
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
            })).filter(assignment => assignment.name && assignment.imci_sub_type);
            return [...acc, ...groupAssignments];
        }, []);

        if (!state || !locality || !hall || !coordinator || !participantsCount || !supporter || !startDate || !implementedBy) {
            setError('Please complete all required fields.');
            return;
        }
        
        // --- ADDED: Check if courseType is provided ---
        if (!courseType) {
            setError('Could not determine course type. Please go back to the courses page and select a package before adding a new course.');
            return;
        }

        if (!isInfectionControl && !director) {
            setError('Please select a Course Director. This is a mandatory field for this course type.');
            return;
        }

        if (!isInfectionControl && allFacilitatorAssignments.length === 0) {
             setError('Please assign at least one facilitator to a subcourse.');
             return;
        }

        const payload = {
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
            // course_type is passed in from App.jsx, but we'll add it to the payload
            // onSave in App.jsx adds it, so this is redundant but safe
            course_type: courseType, 
        };

        if (isImnci) {
            payload.clinical_instructor = clinical;
            payload.director_imci_sub_type = directorImciSubType;
            payload.clinical_instructor_imci_sub_type = clinicalImciSubType;
        }

        onSave(payload);
    };

    const [showNewFacilitatorForm, setShowNewFacilitatorForm] = useState(false);
    const [newFacilitatorName, setNewFacilitatorName] = useState('');
    const [showNewCoordinatorForm, setShowNewCoordinatorForm] = useState(false);
    const [newCoordinatorName, setNewCoordinatorName] = useState('');
    const [showNewFunderForm, setShowNewFunderForm] = useState(false);
    const [newFunderOrgName, setNewFunderOrgName] = useState('');

    const handleOpenNewFacilitatorForm = (name) => {
        setNewFacilitatorName(name);
        setShowNewFacilitatorForm(true);
    }
    const handleSaveNewFacilitator = async (facilitatorData) => {
        await onAddNewFacilitator(facilitatorData);
        setShowNewFacilitatorForm(false);
        setDirector(facilitatorData.name);
        setClinical(facilitatorData.name);
    }

    const handleOpenNewCoordinatorForm = (name) => {
        setNewCoordinatorName(name);
        setShowNewCoordinatorForm(true);
    }
    const handleSaveNewCoordinator = async (coordinatorData) => {
        await onAddNewCoordinator(coordinatorData);
        setShowNewCoordinatorForm(false);
        setCoordinator(coordinatorData.name);
    }

    const handleOpenNewFunderForm = (orgName) => {
        setNewFunderOrgName(orgName);
        setShowNewFunderForm(true);
    }
    const handleSaveNewFunder = async (funderData) => {
        await onAddNewFunder(funderData);
        setShowNewFunderForm(false);
        setSupporter(funderData.orgName);
    }

    if (showNewFacilitatorForm) {
        return <NewFacilitatorForm initialName={newFacilitatorName} onCancel={() => setShowNewFacilitatorForm(false)} onSave={handleSaveNewFacilitator} />;
    }
    if (showNewCoordinatorForm) {
        return <NewCoordinatorForm initialName={newCoordinatorName} onCancel={() => setShowNewCoordinatorForm(false)} onSave={handleSaveNewCoordinator} />;
    }
    if (showNewFunderForm) {
        return <NewFunderForm initialOrgName={newFunderOrgName} onCancel={() => setShowNewFunderForm(false)} onSave={handleSaveNewFunder} />;
    }

    return (
        <Card>
            <div className="p-6">
                <PageHeader title={`${initialData ? 'Edit' : 'Add New'} Course`} subtitle={`Package: ${courseType || 'N/A'}`} className="mb-6" />
                {error && <div className="p-3 mb-6 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}</Select></FormGroup>
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
                            onOpenNewForm={handleOpenNewCoordinatorForm}
                            placeholder="Type to search..."
                            label="Federal Course Coordinator"
                        />
                    </FormGroup>
                    <FormGroup label="State Course Coordinator">
                        <SearchableSelect
                            value={stateCoordinator}
                            onChange={setStateCoordinator}
                            options={stateCoordinatorOptions}
                            onOpenNewForm={handleOpenNewCoordinatorForm}
                            placeholder="Type to search..."
                            label="State Course Coordinator"
                        />
                    </FormGroup>
                    <FormGroup label="Locality Course Coordinator">
                        <SearchableSelect
                            value={localityCoordinator}
                            onChange={setLocalityCoordinator}
                            options={localityCoordinatorOptions}
                            onOpenNewForm={handleOpenNewCoordinatorForm}
                            placeholder="Type to search..."
                            label="Locality Course Coordinator"
                        />
                    </FormGroup>
                    
                    <FormGroup label="Funded by:">
                        <SearchableSelect
                            value={supporter}
                            onChange={setSupporter}
                            options={funderOptions}
                            onOpenNewForm={handleOpenNewFunderForm}
                            placeholder="Type to search or add a funder"
                            label="Funded by"
                        />
                    </FormGroup>
                    <FormGroup label="Implemented by:">
                        <SearchableSelect
                            value={implementedBy}
                            onChange={setImplementedBy}
                            options={funderOptions}
                            onOpenNewForm={handleOpenNewFunderForm}
                            placeholder="Type to search or add an implementer"
                            label="Implemented by"
                        />
                    </FormGroup>
                    <FormGroup label="Course Project">
                         <SearchableSelect
                            value={courseProject}
                            onChange={setCourseProject}
                            options={projectOptions}
                            onOpenNewForm={() => alert('Please add new projects via the Partners page in Human Resources.')}
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
                                            onOpenNewForm={handleOpenNewFacilitatorForm}
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

                                {isImnci && (
                                    <div className="space-y-2">
                                        <FormGroup label="Clinical Instructor (Optional)">
                                            <SearchableSelect
                                                value={clinical}
                                                onChange={setClinical}
                                                options={clinicalInstructorOptions}
                                                onOpenNewForm={handleOpenNewFacilitatorForm}
                                                placeholder="Select Instructor"
                                                label="Clinical Instructor"
                                            />
                                        </FormGroup>
                                        <FormGroup label="IMNCI Subcourse for Clinical Instructor (Optional)">
                                            <Select value={clinicalImciSubType} onChange={(e) => setClinicalImciSubType(e.target.value)} className="w-full">
                                                {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                            </Select>
                                        </FormGroup>
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
                                            <FormGroup label="Subcourse Type">
                                                <Select
                                                    value={assignment.imci_sub_type || ''}
                                                    onChange={(e) => updateFacilitatorAssignment(groupName, index, 'imci_sub_type', e.target.value)}
                                                    className="w-full"
                                                >
                                                    <option value="">— Select Subcourse —</option>
                                                    {(isImnci ? IMNCI_SUBCOURSE_TYPES : INFECTION_CONTROL_SUBCOURSE_TYPES).map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </Select>
                                            </FormGroup>
                                            <FormGroup label="Facilitator Name">
                                                <SearchableSelect
                                                    value={assignment.name}
                                                    onChange={(value) => updateFacilitatorAssignment(groupName, index, 'name', value)}
                                                    options={facilitatorOptions}
                                                    onOpenNewForm={handleOpenNewFacilitatorForm}
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

// --- NEWLY ADDED: PublicCourseMonitoringView ---

/**
 * A public-facing view for data entry for an entire course.
 * Allows selecting a group, then a participant, then entering monitoring data.
 */
export function PublicCourseMonitoringView({ course, allParticipants }) {
    const [selectedGroup, setSelectedGroup] = useState('All');
    const [selectedParticipantId, setSelectedParticipantId] = useState('');

    // Get a unique, sorted list of groups from the participants
    const groups = useMemo(() => {
        const groupSet = new Set(allParticipants.map(p => p.group || 'N/A'));
        return ['All', ...Array.from(groupSet).sort()];
    }, [allParticipants]);

    // Filter participants based on the selected group
    const filteredParticipants = useMemo(() => {
        if (selectedGroup === 'All') {
            return allParticipants.sort((a, b) => a.name.localeCompare(b.name));
        }
        return allParticipants
            .filter(p => (p.group || 'N/A') === selectedGroup)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allParticipants, selectedGroup]);

    // Get the full participant object for the selected ID
    const selectedParticipant = useMemo(() => {
        if (!selectedParticipantId) {
            return null;
        }
        return allParticipants.find(p => p.id === selectedParticipantId);
    }, [allParticipants, selectedParticipantId]);

    const handleGroupChange = (e) => {
        setSelectedGroup(e.target.value);
        setSelectedParticipantId(''); // Reset participant selection when group changes
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
                        participants={filteredParticipants} // Pass this for context, though selector is hidden
                        onChangeParticipant={handleParticipantChange} // Allow changing participant
                        initialCaseToEdit={null} // Public view never edits
                        isPublicView={true} // Use the public view flag
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