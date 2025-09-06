import React, { useState, useMemo, useEffect, useRef } from "react";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Card, PageHeader, Button, FormGroup, Input, Select, Textarea, Table, EmptyState, Spinner, PdfIcon } from './UIComponents.jsx';
import { STATE_LOCALITIES, COURSE_TYPES_FACILITATOR, calcPct, fmtPct, generateFacilitatorPdf, generateFacilitatorComparisonPdf } from './ConstantsAndHelpers.js';
import { upsertFacilitator, deleteFacilitator } from './data.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function FacilitatorsView({ facilitators, onAdd, onEdit, onDelete, onOpenReport, onOpenComparison }) {
    return (
        <Card>
            <PageHeader title="Manage Facilitators" actions={<Button onClick={onOpenComparison}>Compare Facilitators</Button>} />
            <div className="mb-4">
                <Button onClick={onAdd}>Add New Facilitator</Button>
            </div>
            <Table headers={["Name", "Phone", "Courses", "Actions"]}>
                {facilitators.length === 0 ? <EmptyState message="No facilitators have been added yet." /> :
                    facilitators.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50">
                            <td className="p-4 border">{f.name}</td>
                            <td className="p-4 border">{f.phone}</td>
                            <td className="p-4 border">{(f.courses || []).join(', ')}</td>
                            <td className="p-4 border">
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <Button variant="primary" onClick={() => onOpenReport(f.id)}>Report</Button>
                                    <Button variant="secondary" onClick={() => onEdit(f)}>Edit</Button>
                                    <Button variant="danger" onClick={() => onDelete(f.id)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))
                }
            </Table>
        </Card>
    );
}

export function FacilitatorForm({ initialData, onCancel, onSave }) {
    const [name, setName] = useState(initialData?.name || '');
    const [phone, setPhone] = useState(initialData?.phone || '');
    const [email, setEmail] = useState(initialData?.email || '');
    const [courses, setCourses] = useState(initialData?.courses || []);
    const [totDates, setTotDates] = useState(initialData?.totDates || {});
    const [currentState, setCurrentState] = useState(initialData?.currentState || '');
    const [currentLocality, setCurrentLocality] = useState(initialData?.currentLocality || '');
    const [directorCourse, setDirectorCourse] = useState(initialData?.directorCourse || 'No');
    const [directorCourseDate, setDirectorCourseDate] = useState(initialData?.directorCourseDate || '');
    const [followUpCourse, setFollowUpCourse] = useState(initialData?.followUpCourse || 'No');
    const [followUpCourseDate, setFollowUpCourseDate] = useState(initialData?.followUpCourseDate || '');
    const [teamLeaderCourse, setTeamLeaderCourse] = useState(initialData?.teamLeaderCourse || 'No');
    const [teamLeaderCourseDate, setTeamLeaderCourseDate] = useState(initialData?.teamLeaderCourseDate || '');
    const [isClinicalInstructor, setIsClinicalInstructor] = useState(initialData?.isClinicalInstructor || 'No');
    const [comments, setComments] = useState(initialData?.comments || '');
    const [error, setError] = useState('');

    const handleCourseToggle = (course) => {
        setCourses(prev => prev.includes(course) ? prev.filter(c => c !== course) : [...prev, course]);
    };

    const handleSubmit = async () => {
        if (!name || !phone) {
            setError('Facilitator Name and Phone Number are required.');
            return;
        }
        const payload = {
            name, phone, email, courses, totDates, currentState, currentLocality,
            directorCourse, directorCourseDate: directorCourse === 'Yes' ? directorCourseDate : '',
            followUpCourse, followUpCourseDate: followUpCourse === 'Yes' ? followUpCourseDate : '',
            teamLeaderCourse, teamLeaderCourseDate: teamLeaderCourse === 'Yes' ? teamLeaderCourseDate : '',
            isClinicalInstructor, comments
        };
        await upsertFacilitator({ ...payload, id: initialData?.id });
        onSave();
    };

    return (
        <Card>
            <PageHeader title={initialData ? 'Edit Facilitator' : 'Add New Facilitator'} />
            {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormGroup label="Facilitator Name"><Input value={name} onChange={e => setName(e.target.value)} /></FormGroup>
                <FormGroup label="Phone Number"><Input value={phone} onChange={e => setPhone(e.target.value)} /></FormGroup>
                <FormGroup label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></FormGroup>
                <FormGroup label="Current State">
                    <Select value={currentState} onChange={e => { setCurrentState(e.target.value); setCurrentLocality(''); }}>
                        <option value="">— Select State —</option>
                        {Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="Out of Sudan">Out of Sudan</option>
                    </Select>
                </FormGroup>
                <FormGroup label="Current Locality">
                    <Select value={currentLocality} onChange={e => setCurrentLocality(e.target.value)} disabled={!currentState || currentState === 'Out of Sudan'}>
                        <option value="">— Select Locality —</option>
                        {(STATE_LOCALITIES[currentState] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}
                    </Select>
                </FormGroup>

                <div className="lg:col-span-3 grid md:grid-cols-2 gap-6 border-t pt-6">
                    <FormGroup label="Applicable Courses & ToT Dates">
                        <div className="space-y-2">
                            {COURSE_TYPES_FACILITATOR.map(course => (
                                <div key={course} className="flex flex-wrap items-center gap-4 p-3 border rounded-md">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id={`course_${course}`} checked={courses.includes(course)} onChange={() => handleCourseToggle(course)} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
                                        <label htmlFor={`course_${course}`} className="font-medium w-16">{course}</label>
                                    </div>
                                    {courses.includes(course) && (
                                        <div className="flex items-center gap-2 flex-grow">
                                            <label className="text-sm">ToT Date:</label>
                                            <Input type="date" value={totDates[course] || ''} onChange={e => setTotDates(d => ({ ...d, [course]: e.target.value }))} className="flex-grow" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </FormGroup>
                </div>

                <div className="lg:col-span-3 grid md:grid-cols-2 lg:grid-cols-3 gap-6 border-t pt-6">
                    <FormGroup label="Attended IMNCI Course Director Course?"><Select value={directorCourse} onChange={e => setDirectorCourse(e.target.value)}><option>No</option><option>Yes</option></Select></FormGroup>
                    {directorCourse === 'Yes' && <FormGroup label="Date of Course"><Input type="date" value={directorCourseDate} onChange={e => setDirectorCourseDate(e.target.value)} /></FormGroup>}
                    <div />

                    <FormGroup label="Attended IMNCI Follow-up Course?"><Select value={followUpCourse} onChange={e => setFollowUpCourse(e.target.value)}><option>No</option><option>Yes</option></Select></FormGroup>
                    {followUpCourse === 'Yes' && <FormGroup label="Date of Course"><Input type="date" value={followUpCourseDate} onChange={e => setFollowUpCourseDate(e.target.value)} /></FormGroup>}
                    <div />

                    <FormGroup label="Attended IMNCI Team Leader Course?"><Select value={teamLeaderCourse} onChange={e => setTeamLeaderCourse(e.target.value)}><option>No</option><option>Yes</option></Select></FormGroup>
                    {teamLeaderCourse === 'Yes' && <FormGroup label="Date of Course"><Input type="date" value={teamLeaderCourseDate} onChange={e => setTeamLeaderCourseDate(e.target.value)} /></FormGroup>}
                    <div />

                    <FormGroup label="Selected as Clinical Instructor?"><Select value={isClinicalInstructor} onChange={e => setIsClinicalInstructor(e.target.value)}><option>No</option><option>Yes</option></Select></FormGroup>
                </div>

                <div className="lg:col-span-3 border-t pt-6">
                    <FormGroup label="Other comments from Program Manager"><Textarea rows={4} value={comments} onChange={e => setComments(e.target.value)} /></FormGroup>
                </div>
            </div>
            <div className="flex gap-2 justify-end mt-6 border-t pt-6">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSubmit}>Save Facilitator</Button>
            </div>
        </Card>
    );
}

export function FacilitatorReportView({ facilitator, allCourses, onBack }) {
    const [loading, setLoading] = useState(true);
    const [courseTypeFilter, setCourseTypeFilter] = useState('All');
    const directedChartRef = useRef(null);
    const facilitatedChartRef = useRef(null);

    useEffect(() => {
        if (allCourses.length > 0) {
            setLoading(false);
        }
    }, [allCourses]);

    const { directedCourses, facilitatedCourses, totalDays, directedChartData, facilitatedChartData } = useMemo(() => {
        if (!facilitator) return { directedCourses: [], facilitatedCourses: [], totalDays: 0, directedChartData: {}, facilitatedChartData: {} };

        const filtered = allCourses.filter(c => courseTypeFilter === 'All' || c.course_type === courseTypeFilter);

        const directed = filtered.filter(c => c.director === facilitator.name);
        const facilitated = filtered.filter(c => (c.facilitators || []).includes(facilitator.name));

        const allInvolvedCourses = [...new Set([...directed, ...facilitated])];
        const days = allInvolvedCourses.reduce((sum, course) => sum + (course.course_duration || 0), 0);

        const buildChartData = (courses) => {
            const counts = {};
            COURSE_TYPES_FACILITATOR.forEach(type => { counts[type] = 0; });
            courses.forEach(c => {
                if (counts[c.course_type] !== undefined) {
                    counts[c.course_type]++;
                }
            });
            return {
                labels: Object.keys(counts),
                datasets: [{ label: '# of Courses', data: Object.values(counts), backgroundColor: '#3b82f6' }]
            };
        };

        return {
            directedCourses: directed,
            facilitatedCourses: facilitated,
            totalDays: days,
            directedChartData: buildChartData(directed),
            facilitatedChartData: buildChartData(facilitated)
        };
    }, [facilitator, allCourses, courseTypeFilter]);

    if (loading) return <Card><Spinner /></Card>;
    if (!facilitator) return <Card><EmptyState message="Facilitator not found." /></Card>;

    const chartOptions = (title) => ({
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: title } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    });

    return (
        <div className="grid gap-6">
            <PageHeader title="Facilitator Report" subtitle={facilitator.name} actions={<>
                <Button onClick={() => generateFacilitatorPdf(facilitator, allCourses, directedChartRef, facilitatedChartRef)} variant="secondary"><PdfIcon /> Export as PDF</Button>
                <Button onClick={onBack}>Back to List</Button>
            </>} />

            <Card>
                <h3 className="text-xl font-bold mb-4">Facilitator Details</h3>
                <div className="overflow-x-auto">
                    <table className="text-sm w-full"><tbody>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50 w-1/4">Name</td><td className="p-2">{facilitator.name}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Phone</td><td className="p-2">{facilitator.phone}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Email</td><td className="p-2">{facilitator.email || 'N/A'}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Location</td><td className="p-2">{facilitator.currentState || 'N/A'}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Courses</td><td className="p-2">{(facilitator.courses || []).join(', ')}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Course Director</td><td className="p-2">{facilitator.directorCourse === 'Yes' ? `Yes (${facilitator.directorCourseDate || 'N/A'})` : 'No'}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Clinical Instructor</td><td className="p-2">{facilitator.isClinicalInstructor || 'No'}</td></tr>
                    </tbody></table>
                </div>
            </Card>

            <Card>
                <div className="flex justify-end mb-4">
                    <FormGroup label="Filter by Course Type">
                        <Select value={courseTypeFilter} onChange={e => setCourseTypeFilter(e.target.value)}>
                            <option value="All">All Course Types</option>
                            {COURSE_TYPES_FACILITATOR.map(type => <option key={type} value={type}>{type}</option>)}
                        </Select>
                    </FormGroup>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-6">
                    <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm text-gray-600">Courses Directed</div><div className="text-3xl font-bold text-sky-700">{directedCourses.length}</div></div>
                    <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm text-gray-600">Courses Facilitated</div><div className="text-3xl font-bold text-sky-700">{facilitatedCourses.length}</div></div>
                    <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm text-gray-600">Total Days of Training</div><div className="text-3xl font-bold text-sky-700">{totalDays}</div></div>
                </div>
                <div className="grid md:grid-cols-2 gap-6 h-64">
                    <Bar ref={directedChartRef} options={chartOptions('Courses Directed by Type')} data={directedChartData} />
                    <Bar ref={facilitatedChartRef} options={chartOptions('Courses Facilitated by Type')} data={facilitatedChartData} />
                </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card><h3 className="text-xl font-bold mb-4">Directed Courses</h3><Table headers={["Course", "Date", "Location"]}>{directedCourses.length === 0 ? <EmptyState message="No courses directed." /> : directedCourses.map(c => (<tr key={c.id}><td className="p-2 border">{c.course_type}</td><td className="p-2 border">{c.start_date}</td><td className="p-2 border">{c.state}</td></tr>))}</Table></Card>
                <Card><h3 className="text-xl font-bold mb-4">Facilitated Courses</h3><Table headers={["Course", "Date", "Location"]}>{facilitatedCourses.length === 0 ? <EmptyState message="No courses facilitated." /> : facilitatedCourses.map(c => (<tr key={c.id}><td className="p-2 border">{c.course_type}</td><td className="p-2 border">{c.start_date}</td><td className="p-2 border">{c.state}</td></tr>))}</Table></Card>
            </div>
        </div>
    );
}

export function FacilitatorComparisonView({ facilitators, allCourses, onBack }) {
    const [courseFilter, setCourseFilter] = useState('All');

    const comparisonData = useMemo(() => {
        return facilitators.map(f => {
            const directed = allCourses.filter(c => c.director === f.name && (courseFilter === 'All' || c.course_type === courseFilter));
            const facilitated = allCourses.filter(c => (c.facilitators || []).includes(f.name) && (courseFilter === 'All' || c.course_type === courseFilter));
            const totalDays = [...new Set([...directed, ...facilitated])].reduce((sum, c) => sum + (c.course_duration || 0), 0);

            return {
                id: f.id, name: f.name,
                directedCount: directed.length,
                facilitatedCount: facilitated.length,
                totalDays: totalDays,
                isDirector: f.directorCourse === 'Yes',
                isClinicalInstructor: f.isClinicalInstructor === 'Yes'
            };
        }).sort((a, b) => b.totalDays - a.totalDays);
    }, [facilitators, allCourses, courseFilter]);

    const handleExportPdf = () => {
        generateFacilitatorComparisonPdf(facilitators, allCourses, courseFilter);
    };

    return (
        <Card>
            <PageHeader
                title="Facilitator Comparison"
                actions={<>
                    <Button onClick={handleExportPdf} variant="secondary"><PdfIcon /> Export as PDF</Button>
                    <Button onClick={onBack}>Back to List</Button>
                </>}
            />
            <div className="flex justify-end mb-4">
                <FormGroup label="Filter by Course">
                    <Select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                        <option value="All">All Courses</option>
                        {COURSE_TYPES_FACILITATOR.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                </FormGroup>
            </div>
            <Table headers={['Facilitator', 'Courses Directed', 'Courses Facilitated', 'Total Training Days', 'Director', 'Clinical Instructor']}>
                {comparisonData.length === 0 ? <EmptyState message="No data to display." /> :
                    comparisonData.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50 text-center">
                            <td className="p-2 border text-left">{f.name}</td>
                            <td className="p-2 border">{f.directedCount}</td>
                            <td className="p-2 border">{f.facilitatedCount}</td>
                            <td className="p-2 border font-bold">{f.totalDays}</td>
                            <td className="p-2 border">{f.isDirector ? '✔️' : '❌'}</td>
                            <td className="p-2 border">{f.isClinicalInstructor ? '✔️' : '❌'}</td>
                        </tr>
                    ))
                }
            </Table>
        </Card>
    );
}
