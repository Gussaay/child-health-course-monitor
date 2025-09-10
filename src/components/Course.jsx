import React, { useState, useMemo, useRef, useEffect } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Pie } from 'react-chartjs-2';
import { Button, Card, EmptyState, FormGroup, Input, PageHeader, PdfIcon, Select, Spinner, Table, Textarea } from './CommonComponents';
import { listAllDataForCourse, listParticipants } from '../data.js';
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES,
    pctBgClass, fmtPct, calcPct,
} from './constants.js';

// --- PDF Export Helper ---
const generateFullCourseReportPdf = async (course, groupPerformance, chartRef) => {
    const doc = new jsPDF('landscape');
    const fileName = `Course_Report_${course.course_type}_${course.state}.pdf`;

    // --- Title Page ---
    doc.setFontSize(22);
    doc.text("Full Course Performance Report", 148, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`${course.course_type} Course`, 148, 30, { align: 'center' });
    doc.text(`${course.state} / ${course.locality}`, 148, 38, { align: 'center' });

    // --- Course Details ---
    const courseDetailsBody = [
        ['Coordinator', course.coordinator],
        ['Director', course.director],
        ['Clinical Instructor', course.clinical_instructor],
        ['Funded by', course.funded_by],
        ['Facilitators', (course.facilitators || []).join(', ')],
        ['# Participants', course.participants_count],
    ];
    autoTable(doc, {
        startY: 50,
        head: [['Course Information', '']],
        body: courseDetailsBody,
        theme: 'striped'
    });

    // --- Performance Table ---
    let finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(14);
    doc.text("Performance by Group", 14, finalY + 15);
    const tableHead = [['Group', '# Participants', 'Cases Seen', 'Skills Recorded', '% Correct']];
    const tableBody = Object.entries(groupPerformance).map(([group, data]) => [
        group,
        data.participantCount,
        data.totalCases,
        data.totalObs,
        fmtPct(data.percentage)
    ]);
    autoTable(doc, {
        startY: finalY + 20,
        head: tableHead,
        body: tableBody,
        theme: 'grid'
    });
    finalY = doc.lastAutoTable.finalY;

    // --- Chart ---
    if (chartRef.current) {
        const chartImg = chartRef.current.canvas.toDataURL('image/png');
        if (finalY > 100) { doc.addPage(); finalY = 20; }
        doc.setFontSize(14);
        doc.text("Performance Chart", 14, finalY + 15);
        doc.addImage(chartImg, 'PNG', 14, finalY + 20, 260, 120);
    }

    doc.save(fileName);
};

export function CoursesView({ courses, onAdd, onOpen, onEdit, onDelete, onOpenReport }) {
    // Function to check if a course is active
    const isCourseActive = (course) => {
        if (!course.start_date) return false;
        
        const today = new Date();
        const startDate = new Date(course.start_date);
        const diffTime = Math.abs(today - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (course.course_type === 'IMNCI') {
            return diffDays <= 7;
        } else if (course.course_type === 'ETAT') {
            return diffDays <= 4;
        } else if (course.course_type === 'EENC') {
            return diffDays <= 2;
        }
        return false;
    };

    // Function to check if a course can be modified
    const isCourseEditable = (course) => {
        if (!course.start_date) return true;
        
        const today = new Date();
        const startDate = new Date(course.start_date);
        
        // Determine course duration based on course type
        let courseDuration = 0;
        if (course.course_type === 'IMNCI') courseDuration = 7;
        else if (course.course_type === 'ETAT') courseDuration = 4;
        else if (course.course_type === 'EENC') courseDuration = 2;
        
        // Calculate end date (start date + course duration)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + courseDuration);
        
        // Calculate days since course ended
        const daysSinceEnd = Math.floor((today - endDate) / (1000 * 60 * 60 * 24));
        
        // Course can be edited if it ended less than 5 days ago
        return daysSinceEnd <= 5;
    };

    // Sort courses: active first, then others
    const sortedCourses = [...courses].sort((a, b) => {
        const aActive = isCourseActive(a);
        const bActive = isCourseActive(b);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return 0;
    });

    return (
        <Card>
            <PageHeader
                title="Courses"
                subtitle="Manage training courses."
                actions={<Button onClick={onAdd}>Add New Course</Button>}
            />
            {sortedCourses.length === 0 ? <EmptyState message="No courses have been added yet." /> : (
                <Table headers={["Course Name", "State", "# Participants", "Status", "Actions"]}>
                    {sortedCourses.map(c => {
                        const active = isCourseActive(c);
                        const editable = isCourseEditable(c);
                        return (
                            <tr key={c.id} className={`hover:bg-gray-50 ${active ? 'bg-green-50' : ''}`}>
                                <td className="p-4 border border-gray-200 font-medium text-gray-800">
                                    {c.course_type}
                                    {active && <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>}
                                </td>
                                <td className="p-4 border border-gray-200">{c.state}</td>
                                <td className="p-4 border border-gray-200">{c.participants_count}</td>
                                <td className="p-4 border border-gray-200">
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
                                <td className="p-4 border border-gray-200 text-right">
                                    <div className="flex gap-2 flex-wrap justify-end">
                                        <Button variant="primary" onClick={() => onOpen(c.id)}>Open Course</Button>
                                        <Button variant="secondary" onClick={() => onOpenReport(c.id)}>Course Reports</Button>
                                        <Button 
                                            variant="secondary" 
                                            onClick={() => onEdit(c)}
                                            disabled={!editable}
                                            title={!editable ? "Course cannot be modified after 5 days from end date" : ""}
                                        >
                                            Edit
                                        </Button>
                                        <Button 
                                            variant="danger" 
                                            onClick={() => onDelete(c.id)}
                                            disabled={!editable}
                                            title={!editable ? "Course cannot be deleted after 5 days from end date" : ""}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </Table>
            )}
        </Card>
    );
}

export function CourseForm({ courseType, initialData, facilitatorsList, onCancel, onSave, onAddNewFacilitator }) {
    const [state, setState] = useState(initialData?.state || '');
    const [locality, setLocality] = useState(initialData?.locality || '');
    const [hall, setHall] = useState(initialData?.hall || '');
    const [startDate, setStartDate] = useState(initialData?.start_date || '');
    const [courseDuration, setCourseDuration] = useState(initialData?.course_duration || 7);
    const [coordinator, setCoordinator] = useState(initialData?.coordinator || '');
    const [participantsCount, setParticipantsCount] = useState(initialData?.participants_count || 0);
    const [director, setDirector] = useState(initialData?.director || '');
    const [clinical, setClinical] = useState(initialData?.clinical_instructor || '');
    const [supporter, setSupporter] = useState(initialData?.funded_by || '');

    const initialFacilitators = useMemo(() => {
        if (initialData?.facilitators?.length > 0) {
            return initialData.facilitators.map(name => {
                const assignment = initialData.facilitatorAssignments?.find(a => a.name === name);
                return {
                    name,
                    group: assignment?.group || 'Group A',
                    imci_sub_type: assignment?.imci_sub_type || 'Standard 7 days course',
                };
            });
        }
        return [{ name: '', group: 'Group A', imci_sub_type: 'Standard 7 days course' }];
    }, [initialData]);

    const [facilitators, setFacilitators] = useState(initialFacilitators);
    const [error, setError] = useState('');

    const [directorSearch, setDirectorSearch] = useState('');
    const [facilitatorSearch, setFacilitatorSearch] = useState('');
    const [clinicalInstructorSearch, setClinicalInstructorSearch] = useState('');

    const isImnci = courseType === 'IMNCI';

    const directorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => f.directorCourse === 'Yes')
            .filter(f => !directorSearch || f.name.toLowerCase().includes(directorSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, directorSearch]);
    
    const clinicalInstructorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => f.isClinicalInstructor === 'Yes' || f.directorCourse === 'Yes')
            .filter(f => !clinicalInstructorSearch || f.name.toLowerCase().includes(clinicalInstructorSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, clinicalInstructorSearch]);

    const facilitatorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => (Array.isArray(f.courses) ? f.courses : []).includes(courseType))
            .filter(f => !facilitatorSearch || f.name.toLowerCase().includes(facilitatorSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, courseType, facilitatorSearch]);

    const addFacilitator = () => {
        setFacilitators(f => [...f, { name: '', group: 'Group A', imci_sub_type: 'Standard 7 days course' }]);
    };

    const removeFacilitator = (index) => {
        setFacilitators(f => f.filter((_, i) => i !== index));
    };
    
    const updateFacilitator = (index, field, value) => {
        setFacilitators(f => f.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    };

    const submit = () => {
        const selectedFacilitatorNames = facilitators.map(f => f.name).filter(Boolean);
        if (!state || !locality || !hall || !coordinator || !participantsCount || !director || selectedFacilitatorNames.length < 2 || !supporter || !startDate) {
            setError('Please complete all required fields (minimum two facilitators).');
            return;
        }

        const payload = {
            state, locality, hall, coordinator, start_date: startDate,
            course_duration: courseDuration,
            participants_count: participantsCount, director,
            funded_by: supporter,
            // Only store the names in the main course object
            facilitators: selectedFacilitatorNames,
            // Store detailed facilitator assignments in a new field
            facilitatorAssignments: facilitators.filter(f => f.name).map(f => ({ name: f.name, group: f.group, imci_sub_type: f.imci_sub_type })),
        };

        if (isImnci) {
            payload.clinical_instructor = clinical;
        }

        onSave(payload);
    };

    return (
        <Card>
            <PageHeader title={`${initialData ? 'Edit' : 'Add New'} Course`} subtitle={`Package: ${courseType}`} />
            {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                <FormGroup label="Course Hall"><Input value={hall} onChange={(e) => setHall(e.target.value)} /></FormGroup>
                <FormGroup label="Start Date of Course"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></FormGroup>
                <FormGroup label="Course Duration (days)"><Input type="number" value={courseDuration} onChange={(e) => setCourseDuration(Number(e.target.value))} /></FormGroup>
                <FormGroup label="Course Coordinator"><Input value={coordinator} onChange={(e) => setCoordinator(e.target.value)} /></FormGroup>
                <FormGroup label="# of Participants"><Input type="number" value={participantsCount} onChange={(e) => setParticipantsCount(Number(e.target.value))} /></FormGroup>
                <FormGroup label="Course Director">
                    <Select value={director} onChange={(e) => setDirector(e.target.value)}>
                        <option value="">— Select Director —</option>
                        {directorOptions.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                    </Select>
                </FormGroup>
                {isImnci &&
                    <FormGroup label="Clinical Instructor (Optional)">
                        <Select value={clinical} onChange={(e) => setClinical(e.target.value)}>
                            <option value="">— Select Clinical Instructor —</option>
                            {clinicalInstructorOptions.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                        </Select>
                    </FormGroup>
                }
                <FormGroup label="Funded by:"><Input value={supporter} onChange={(e) => setSupporter(e.target.value)} /></FormGroup>
                
                {/* Updated Facilitator Section */}
                <div className="md:col-span-2 lg:col-span-3">
                    <FormGroup label="Facilitators and Assignments">
                        <div className="grid gap-4">
                            {(Array.isArray(facilitators) ? facilitators : []).map((fac, index) => (
                                <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center p-3 border rounded-md bg-gray-50">
                                    <div className="col-span-1">
                                        <Select value={fac.name} onChange={(e) => updateFacilitator(index, 'name', e.target.value)} className="w-full">
                                            <option value="">— Select Facilitator {index + 1} —</option>
                                            {facilitatorOptions.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                                        </Select>
                                    </div>
                                    <div className="col-span-1">
                                        <Select value={fac.group} onChange={(e) => updateFacilitator(index, 'group', e.target.value)} className="w-full">
                                            <option>Group A</option>
                                            <option>Group B</option>
                                            <option>Group C</option>
                                            <option>Group D</option>
                                        </Select>
                                    </div>
                                    {isImnci && (
                                        <div className="col-span-1">
                                            <Select value={fac.imci_sub_type} onChange={(e) => updateFacilitator(index, 'imci_sub_type', e.target.value)} className="w-full">
                                                {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                            </Select>
                                        </div>
                                    )}
                                    <div className="col-span-1 sm:col-span-3 flex justify-end">
                                        <Button type="button" variant="danger" onClick={() => removeFacilitator(index)} disabled={facilitators.length <= 2}>Remove</Button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex gap-2 mt-2">
                                <Button type="button" variant="secondary" onClick={addFacilitator} className="flex-grow">+ Add Facilitator</Button>
                                <Button type="button" variant="ghost" onClick={onAddNewFacilitator} className="flex-grow">Add New to List</Button>
                            </div>
                        </div>
                    </FormGroup>
                </div>
            </div>
            <div className="flex gap-2 justify-end mt-6 border-t pt-6">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button onClick={submit}>Save Course</Button>
            </div>
        </Card>
    );
}

export function CourseReportView({ course, onBack }) {
    const [participants, setParticipants] = useState([]);
    const [allObs, setAllObs] = useState([]);
    const [allCases, setAllCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const chartRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!course?.id) return;
            setLoading(true);
            const [pData, { allObs, allCases }] = await Promise.all([
                listParticipants(course.id),
                listAllDataForCourse(course.id)
            ]);
            setParticipants(pData);
            setAllObs(allObs);
            setAllCases(allCases);
            setLoading(false);
        };
        fetchData();
    }, [course.id]);

    const { groupPerformance, overall } = useMemo(() => {
        const groupPerformance = { 'Group A': { pids: [], totalObs: 0, correctObs: 0, totalCases: 0 }, 'Group B': { pids: [], totalObs: 0, correctObs: 0, totalCases: 0 }, 'Group C': { pids: [], totalObs: 0, correctObs: 0, totalCases: 0 }, 'Group D': { pids: [], totalObs: 0, correctObs: 0, totalCases: 0 } };

        participants.forEach(p => {
            if (groupPerformance[p.group]) {
                groupPerformance[p.group].pids.push(p.id);
            }
        });

        allObs.forEach(o => {
            const p = participants.find(p => p.id === o.participant_id);
            if (p && groupPerformance[p.group]) {
                groupPerformance[p.group].totalObs++;
                if (o.item_correct > 0) groupPerformance[p.group].correctObs++;
            }
        });

        allCases.forEach(c => {
            const p = participants.find(p => p.id === c.participant_id);
            if (p && groupPerformance[p.group]) {
                groupPerformance[p.group].totalCases++;
            }
        });

        let totalObs = 0, correctObs = 0, totalCases = 0;
        Object.keys(groupPerformance).forEach(g => {
            const group = groupPerformance[g];
            group.participantCount = group.pids.length;
            group.percentage = calcPct(group.correctObs, group.totalObs);
            totalObs += group.totalObs;
            correctObs += group.correctObs;
            totalCases += group.totalCases;
        });

        const overall = {
            totalObs,
            correctObs,
            totalCases,
            percentage: calcPct(correctObs, totalObs),
            avgCases: (totalCases / participants.length) || 0,
            avgSkills: (totalObs / participants.length) || 0,
        };

        return { groupPerformance, overall };
    }, [participants, allObs, allCases]);

    if (loading) return <Card><Spinner /></Card>;

    const chartData = {
        labels: Object.keys(groupPerformance),
        datasets: [{
            label: '% Correct',
            data: Object.values(groupPerformance).map(g => g.percentage),
            backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444'],
        }],
    };

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false }, title: { display: true, text: 'Overall Performance by Group' } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } } }
    };

    return (
        <div className="grid gap-6">
            <PageHeader title="Full Course Report" subtitle={`${course.course_type} - ${course.state}`} actions={<>
                <Button onClick={() => generateFullCourseReportPdf(course, groupPerformance, chartRef)} variant="secondary"><PdfIcon /> Save as PDF</Button>
                <Button onClick={onBack}>Back to Courses</Button>
            </>} />

            <Card>
                <h3 className="text-xl font-bold mb-4">Course Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><strong>State:</strong> {course.state}</div>
                    <div><strong>Locality:</strong> {course.locality}</div>
                    <div><strong>Hall:</strong> {course.hall}</div>
                    <div><strong>Start Date:</strong> {course.start_date}</div>
                    <div><strong># Participants:</strong> {participants.length}</div>
                    <div><strong>Coordinator:</strong> {course.coordinator}</div>
                    <div><strong>Director:</strong> {course.director}</div>
                    {course.clinical_instructor && <div><strong>Clinical Instructor:</strong> {course.clinical_instructor}</div>}
                    <div><strong>Funded by:</strong> {course.funded_by}</div>
                    <div className="col-span-2"><strong>Facilitators:</strong> {(course.facilitators || []).join(', ')}</div>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Key Performance Indicators (KPIs)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Total Cases</div>
                        <div className="text-3xl font-bold text-sky-700">{overall.totalCases}</div>
                    </div>
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Avg. Cases / Participant</div>
                        <div className="text-3xl font-bold text-sky-700">{overall.avgCases.toFixed(1)}</div>
                    </div>
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Avg. Skills / Participant</div>
                        <div className="text-3xl font-bold text-sky-700">{overall.avgSkills.toFixed(1)}</div>
                    </div>
                    <div className={`p-4 rounded-lg ${pctBgClass(overall.percentage)}`}>
                        <div className="text-sm font-semibold">Overall Correctness</div>
                        <div className="text-3xl font-bold">{fmtPct(overall.percentage)}</div>
                    </div>
                </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-xl font-bold mb-4">Performance by Group</h3>
                    <Table headers={['Group', '# Participants', 'Cases Seen', 'Skills Recorded', '% Correct']}>
                        {Object.entries(groupPerformance).map(([group, data]) => (
                            <tr key={group}>
                                <td className="p-2 border">{group}</td>
                                <td className="p-2 border text-center">{data.participantCount}</td>
                                <td className="p-2 border text-center">{data.totalCases}</td>
                                <td className="p-2 border text-center">{data.totalObs}</td>
                                <td className={`p-2 border font-mono text-center ${pctBgClass(data.percentage)}`}>{fmtPct(data.percentage)}</td>
                            </tr>
                        ))}
                    </Table>
                </Card>
                <Card>
                    <Bar ref={chartRef} options={chartOptions} data={chartData} />
                </Card>
            </div>
        </div>
    );
}