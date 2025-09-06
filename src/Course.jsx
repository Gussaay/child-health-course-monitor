import React, { useState, useMemo, useEffect, useRef } from "react";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Card, PageHeader, Button, FormGroup, Input, Select, Table, EmptyState, Spinner, CourseIcon, PdfIcon } from './UIComponents.jsx';
import { STATE_LOCALITIES, calcPct, fmtPct, pctBgClass, generateCoursePdf, generateFullCourseReportPdf } from './ConstantsAndHelpers.js';
import { listParticipants, listAllDataForCourse, upsertCourse, deleteCourse } from './data.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function CoursesView({ courses, onAdd, onOpen, onEdit, onDelete, onOpenReport }) {
    return (
        <Card>
            <PageHeader title="Available Courses" />
            <div className="mb-4">
                <Button onClick={onAdd}>Add New Course</Button>
            </div>
            <div className="hidden md:block">
                <Table headers={["State", "Locality", "Hall", "#", "Actions"]}>
                    {courses.length === 0 ? <EmptyState message="No courses found for this package." /> : courses.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                            <td className="p-4 border border-gray-200">{c.state}</td>
                            <td className="p-4 border border-gray-200">{c.locality}</td>
                            <td className="p-4 border border-gray-200">{c.hall}</td>
                            <td className="p-4 border border-gray-200 text-center">{c.participants_count}</td>
                            <td className="p-4 border border-gray-200">
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <Button variant="primary" onClick={() => onOpen(c.id)}>Open</Button>
                                    <Button variant="secondary" onClick={() => onOpenReport(c.id)}>Course Report</Button>
                                    <Button variant="secondary" onClick={() => onEdit(c)}>Edit</Button>
                                    <Button variant="danger" onClick={() => onDelete(c.id)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
            <div className="md:hidden grid gap-4">
                {courses.length === 0 ? (
                    <p className="py-12 text-center text-gray-500">No courses found for this package.</p>
                ) : (
                    courses.map(c => (
                        <div key={c.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{c.state}</h3>
                                    <p className="text-gray-600">{c.locality} - {c.hall}</p>
                                    <p className="text-sm text-gray-500 mt-1">Participants: {c.participants_count}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
                                <Button variant="primary" onClick={() => onOpen(c.id)}>Open</Button>
                                <Button variant="secondary" onClick={() => onOpenReport(c.id)}>Report</Button>
                                <Button variant="secondary" onClick={() => onEdit(c)}>Edit</Button>
                                <Button variant="danger" onClick={() => onDelete(c.id)}>Delete</Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
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
    const [facilitators, setFacilitators] = useState(initialData?.facilitators || ['', '']);
    const [error, setError] = useState('');

    const [directorSearch, setDirectorSearch] = useState('');
    const [facilitatorSearch, setFacilitatorSearch] = useState('');

    const directorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => f.directorCourse === 'Yes')
            .filter(f => !directorSearch || f.name.toLowerCase().includes(directorSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, directorSearch]);

    const facilitatorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => (f.courses || []).includes(courseType))
            .filter(f => !facilitatorSearch || f.name.toLowerCase().includes(facilitatorSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, courseType, facilitatorSearch]);

    const addFac = () => setFacilitators(f => [...f, '']);
    const removeFac = (i) => setFacilitators(f => f.length <= 2 ? f : f.filter((_, idx) => idx !== i));
    const setFac = (i, v) => setFacilitators(f => f.map((x, idx) => idx === i ? v : x));

    const submit = () => {
        const facArr = facilitators.map(s => s.trim()).filter(Boolean);
        if (!state || !locality || !hall || !coordinator || !participantsCount || !director || facArr.length < 2 || !supporter || !startDate) {
            setError('Please complete all required fields (minimum two facilitators).'); return;
        }

        const payload = {
            state, locality, hall, coordinator, start_date: startDate,
            course_duration: courseDuration,
            participants_count: participantsCount, director,
            funded_by: supporter, facilitators: facArr
        };

        if (courseType === 'IMNCI') {
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
                    <Input type="search" placeholder="Search for a director..." value={directorSearch} onChange={e => setDirectorSearch(e.target.value)} className="mb-1" />
                    <Select value={director} onChange={(e) => setDirector(e.target.value)}>
                        <option value="">— Select Director —</option>
                        {directorOptions.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                    </Select>
                </FormGroup>
                {courseType === 'IMNCI' && <FormGroup label="Clinical Instructor (Optional)"><Input value={clinical} onChange={(e) => setClinical(e.target.value)} /></FormGroup>}
                <FormGroup label="Funded by:"><Input value={supporter} onChange={(e) => setSupporter(e.target.value)} /></FormGroup>
                <div className="md:col-span-2 lg:col-span-1">
                    <FormGroup label="Facilitators">
                        <Input type="search" placeholder="Search for a facilitator..." value={facilitatorSearch} onChange={e => setFacilitatorSearch(e.target.value)} className="mb-2" />
                        <div className="grid gap-2">
                            {facilitators.map((v, i) => (
                                <div key={i} className="flex gap-2">
                                    <Select value={v} onChange={(e) => setFac(i, e.target.value)} className="flex-grow">
                                        <option value="">— Select Facilitator {i + 1} —</option>
                                        {facilitatorOptions.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                                    </Select>
                                    <Button type="button" variant="secondary" onClick={() => removeFac(i)} disabled={facilitators.length <= 2}>−</Button>
                                </div>
                            ))}
                            <div className="flex gap-2 mt-2">
                                <Button type="button" variant="secondary" onClick={addFac} className="flex-grow">+ Add Facilitator</Button>
                                <Button type="button" variant="ghost" onClick={onAddNewFacilitator} className="flex-grow">Add New to List</Button>
                            </div>
                        </div>
                    </FormGroup>
                </div>
            </div>
            <div className="flex gap-2 justify-end mt-6 border-t pt-6"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={submit}>Save Course</Button></div>
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
