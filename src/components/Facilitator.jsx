// Facilitator.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Pie } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import { Button, Card, EmptyState, Footer, FormGroup, Input, PageHeader, PdfIcon, Select, Spinner, Table, Textarea, Modal } from './CommonComponents';
import {
    listFacilitators,
    listAllCourses,
    upsertFacilitator,
    deleteFacilitator,
    importFacilitators
} from '../data';
import { COURSE_TYPES_FACILITATOR, STATE_LOCALITIES } from './constants.js';

const calcPct = (c, s) => (!s ? NaN : (c * 100) / s);
const fmtPct = v => (!isFinite(v) ? "—" : Math.round(v).toFixed(0) + " %");


const ExcelImportModal = ({ isOpen, onClose, onImport, facilitators, allCourses }) => {
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const allFields = [
        { key: 'id', label: 'ID', required: false, hidden: true },
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone Number' },
        { key: 'email', label: 'Email' },
        { key: 'currentState', label: 'Current State' },
        { key: 'currentLocality', label: 'Current Locality' },
        { key: 'directorCourse', label: 'IMNCI Course Director' },
        { key: 'directorCourseDate', label: 'Director Course Date' },
        { key: 'followUpCourse', label: 'IMNCI Follow-up Course' },
        { key: 'followUpCourseDate', label: 'Follow-up Course Date' },
        { key: 'teamLeaderCourse', label: 'IMNCI Team Leader Course' },
        { key: 'teamLeaderCourseDate', label: 'Team Leader Course Date' },
        { key: 'isClinicalInstructor', label: 'Clinical Instructor' },
        { key: 'comments', label: 'Comments' },
    ];
    
    const handleDownloadTemplate = () => {
        const templateData = facilitators.map(f => {
            const row = {};
            allFields.forEach(field => {
                row[field.label] = f[field.key] || '';
            });
            row['Courses'] = (Array.isArray(f.courses) ? f.courses : []).join(',');
            row['IMNCI ToT Date'] = f.totDates?.IMNCI || '';
            row['ETAT ToT Date'] = f.totDates?.ETAT || '';
            row['EENC ToT Date'] = f.totDates?.EENC || '';
            row['IPC ToT Date'] = f.totDates?.IPC || '';
            return row;
        });
        const dynamicHeaders = [...allFields.map(f => f.label), 'Courses', 'IMNCI ToT Date', 'ETAT ToT Date', 'EENC ToT Date', 'IPC ToT Date'];
        const worksheet = XLSX.utils.json_to_sheet(templateData, { header: dynamicHeaders });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facilitators");
        XLSX.writeFile(workbook, `Facilitator_Template.xlsx`);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length < 2) {
                    setError('Excel file must contain at least a header row and one data row');
                    return;
                }
                setHeaders(jsonData[0]);
                setExcelData(jsonData.slice(1));
                setCurrentPage(1);
                setError('');
            } catch (err) {
                setError('Error reading Excel file: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    const handleMappingChange = (appField, excelHeader) => {
        setFieldMappings(prev => ({
            ...prev,
            [appField]: excelHeader
        }));
    };

    const handleImport = () => {
        if (!fieldMappings['name']) {
            setError('The "Name" field must be mapped to an Excel column.');
            return;
        }

        const importedFacilitators = excelData.map(row => {
            const facilitator = {};
            Object.entries(fieldMappings).forEach(([appField, excelHeader]) => {
                const headerIndex = headers.indexOf(excelHeader);
                if (headerIndex !== -1 && row[headerIndex] !== undefined) {
                    facilitator[appField] = row[headerIndex];
                }
            });
            if (facilitator.courses) {
                facilitator.courses = facilitator.courses.split(',').map(c => c.trim());
            }
            if (facilitator['IMNCI ToT Date']) {
                facilitator.totDates = { ...facilitator.totDates, IMNCI: facilitator['IMNCI ToT Date'] };
                delete facilitator['IMNCI ToT Date'];
            }
            return facilitator;
        }).filter(f => f.name);

        if (importedFacilitators.length === 0) {
            setError('No valid facilitators found with a name after mapping.');
            return;
        }
        onImport(importedFacilitators);
        onClose();
    };

    const renderPreview = () => {
        if (excelData.length === 0) return null;
        return (
            <div className="mt-4 overflow-auto max-h-60">
                <h4 className="font-medium mb-2">Data Preview (first 5 rows)</h4>
                <Table headers={headers}>
                    {excelData.slice(0, 5).map((row, rowIdx) => (
                        <tr key={rowIdx}>
                            {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="border p-2 text-xs">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </Table>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Facilitators from Excel">
            <div className="p-4">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
                
                {currentPage === 0 && (
                    <div>
                        <p className="mb-4">
                            You can download an Excel template with existing data to update records, or upload your own file.
                        </p>
                        <Button variant="secondary" onClick={handleDownloadTemplate} className="mb-4">
                            Download Template
                        </Button>
                        <p className="mb-2">
                            Or, upload your own Excel file (first row must be headers).
                        </p>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            ref={fileInputRef}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                )}
                
                {currentPage === 1 && (
                    <div>
                        <h4 className="font-medium mb-4">Map Excel columns to application fields</h4>
                        <p className="text-sm text-gray-600 mb-4">
                            Map columns to fields. To update, ensure the 'ID' field is mapped.
                        </p>
                        <div className="grid gap-3 mb-4">
                            {allFields.map(field => (
                                <div key={field.key} className="flex items-center" style={{ display: field.hidden ? 'none' : 'flex' }}>
                                    <label className="w-40 font-medium">{field.label}{field.required && '*'}</label>
                                    <Select
                                        value={fieldMappings[field.key] || ''}
                                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                        className="flex-1"
                                    >
                                        <option value="">-- Select Excel Column --</option>
                                        {headers.map(header => (
                                            <option key={header} value={header}>{header}</option>
                                        ))}
                                    </Select>
                                </div>
                            ))}
                        </div>
                        {renderPreview()}
                        <div className="flex justify-end mt-6 space-x-2">
                            <Button variant="secondary" onClick={() => setCurrentPage(0)}>Back</Button>
                            <Button onClick={handleImport}>Import Facilitators</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export function FacilitatorsView({ facilitators, onAdd, onEdit, onDelete, onOpenReport, onOpenComparison, onImport, userStates }) {
    const [importModalOpen, setImportModalOpen] = useState(false);

    const filteredFacilitators = useMemo(() => {
        if (!userStates || userStates.length === 0) {
            return facilitators;
        }
        return facilitators.filter(f => f.currentState && userStates.includes(f.currentState));
    }, [facilitators, userStates]);

    return (
        <Card>
            <PageHeader title="Manage Facilitators" actions={<Button onClick={onOpenComparison}>Compare Facilitators</Button>} />
            <div className="mb-4 flex gap-2">
                <Button onClick={onAdd}>Add New Facilitator</Button>
                <Button variant="secondary" onClick={() => setImportModalOpen(true)}>Import from Excel</Button>
            </div>
            
            <ExcelImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onImport={onImport}
                facilitators={facilitators}
            />

            {Array.isArray(filteredFacilitators) && filteredFacilitators.length > 0 ? (
                <Table headers={["Name", "Phone", "Courses", "Actions"]}>
                    {filteredFacilitators.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50">
                            <td className="p-4 border">{f.name}</td>
                            <td className="p-4 border">{f.phone}</td>
                            <td className="p-4 border">{(Array.isArray(f.courses) ? f.courses : []).join(', ')}</td>
                            <td className="p-4 border">
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <Button variant="primary" onClick={() => onOpenReport(f.id)}>Report</Button>
                                    <Button variant="secondary" onClick={() => onEdit(f)}>Edit</Button>
                                    <Button variant="danger" onClick={() => onDelete(f.id)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            ) : (
                <EmptyState key="empty-facilitators" message="No facilitators found for your assigned state(s)." />
            )}
        </Card>
    );
}

export function FacilitatorForm({ initialData, onCancel, onSave }) {
    const [name, setName] = useState(initialData?.name || '');
    const [phone, setPhone] = useState(initialData?.phone || '');
    const [email, setEmail] = useState(initialData?.email || '');
    const [courses, setCourses] = useState(Array.isArray(initialData?.courses) ? initialData.courses : []);
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

    const handleSubmit = () => {
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
        onSave(payload);
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
    const combinedChartRef = useRef(null);
    const imciSubcoursePieRef = useRef(null);

    const { directedCourses, facilitatedCourses, totalDays, combinedChartData, imciSubcourseData } = useMemo(() => {
        if (!facilitator) {
            return {
                directedCourses: [],
                facilitatedCourses: [],
                totalDays: 0,
                combinedChartData: { labels: [], datasets: [] },
                imciSubcourseData: null
            };
        }

        const directed = allCourses.filter(c => c.director === facilitator.name);
        const facilitated = allCourses.filter(c => Array.isArray(c.facilitators) && c.facilitators.includes(facilitator.name));

        const allInvolvedCourses = [...new Set([...directed, ...facilitated])];
        const days = allInvolvedCourses.reduce((sum, course) => sum + (course.course_duration || 0), 0);
        
        const courseCounts = {};
        const subcourseCounts = {};
        COURSE_TYPES_FACILITATOR.forEach(type => { courseCounts[type] = 0; });
        
        allInvolvedCourses.forEach(c => {
            if (courseCounts[c.course_type] !== undefined) {
                courseCounts[c.course_type]++;
            }
        });
        
        allCourses.forEach(c => {
            if (c.course_type === 'IMNCI' && Array.isArray(c.facilitatorAssignments)) {
                c.facilitatorAssignments.forEach(fa => {
                    if (fa.name === facilitator.name) {
                        subcourseCounts[fa.imci_sub_type] = (subcourseCounts[fa.imci_sub_type] || 0) + 1;
                    }
                });
            }
        });

        const combinedChartData = {
            labels: Object.keys(courseCounts),
            datasets: [{ 
                label: '# of Courses', 
                data: Object.values(courseCounts), 
                backgroundColor: '#3b82f6' 
            }]
        };

        const hasSubcourseData = Object.values(subcourseCounts).some(count => count > 0);
        const imciSubcourseData = hasSubcourseData ? {
            labels: Object.keys(subcourseCounts),
            datasets: [{
                data: Object.values(subcourseCounts),
                backgroundColor: ['#f97316', '#ef4444', '#f59e0b', '#84cc16', '#06b6d4'],
            }]
        } : null;

        return {
            directedCourses: directed,
            facilitatedCourses: facilitated,
            totalDays: days,
            combinedChartData,
            imciSubcourseData
        };
    }, [facilitator, allCourses]);

    const courseSummary = useMemo(() => {
        const summary = {};
        allCourses.forEach(course => {
            const courseType = course.course_type;
            summary[courseType] = summary[courseType] || {
                directed: 0,
                instructed: 0,
                daysDirected: 0,
                daysInstructed: 0,
            };
            if (course.director === facilitator.name) {
                summary[courseType].directed++;
                summary[courseType].daysDirected += (course.course_duration || 0);
            }
            if (Array.isArray(course.facilitators) && course.facilitators.includes(facilitator.name)) {
                summary[courseType].instructed++;
                summary[courseType].daysInstructed += (course.course_duration || 0);
            }
        });
        return Object.entries(summary);
    }, [allCourses, facilitator]);

    const generateFacilitatorPdf = () => {
        const doc = new jsPDF();
        const fileName = `Facilitator_Report_${facilitator.name.replace(/ /g, '_')}.pdf`;

        doc.setFontSize(22);
        doc.text("Facilitator Report", 105, 20, { align: 'center' });
        doc.setFontSize(18);
        doc.text(facilitator.name, 105, 30, { align: 'center' });

        let finalY = 40;

        doc.setFontSize(14);
        doc.text("Facilitator Information", 14, finalY);
        const infoBody = [
            ['Name', facilitator.name], ['Phone', facilitator.phone], ['Email', facilitator.email || 'N/A'],
            ['Current Location', `${facilitator.currentState || ''} / ${facilitator.currentLocality || ''}`],
            ...COURSE_TYPES_FACILITATOR.map(c => [
                `${c} Facilitator`,
                Array.isArray(facilitator.courses) && facilitator.courses.includes(c) ? `Yes (ToT: ${facilitator.totDates?.[c] || 'N/A'})` : 'No'
            ]),
            ['IMNCI Course Director', `${facilitator.directorCourse} ${facilitator.directorCourse === 'Yes' ? '(' + (facilitator.directorCourseDate || 'N/A') + ')' : ''}`],
            ['IMNCI Follow-up Course', `${facilitator.followUpCourse} ${facilitator.followUpCourse === 'Yes' ? '(' + (facilitator.followUpCourseDate || 'N/A') + ')' : ''}`],
            ['IMNCI Team Leader Course', `${facilitator.teamLeaderCourse} ${facilitator.teamLeaderCourse === 'Yes' ? '(' + (facilitator.teamLeaderCourseDate || 'N/A') + ')' : ''}`],
            ['Clinical Instructor', facilitator.isClinicalInstructor || 'No'],
            ['Comments', facilitator.comments || 'None']
        ];
        autoTable(doc, {
            startY: finalY + 5,
            head: [['Field', 'Details']],
            body: infoBody,
            theme: 'striped',
            headStyles: { fillColor: [8, 145, 178] },
        });
        finalY = doc.lastAutoTable.finalY;

        doc.addPage();
        finalY = 20;

        const combinedChartImg = combinedChartRef.current?.canvas.toDataURL('image/png');
        const imciSubcoursePieImg = imciSubcoursePieRef.current?.canvas.toDataURL('image/png');
        
        if (combinedChartImg && imciSubcoursePieImg) {
            doc.setFontSize(14);
            doc.text("Combined Courses Directed & Facilitated", 14, finalY);
            doc.addImage(combinedChartImg, 'PNG', 14, finalY + 5, 80, 60);
            doc.text("IMNCI Sub-course Distribution", 110, finalY);
            doc.addImage(imciSubcoursePieImg, 'PNG', 110, finalY + 5, 80, 60);
            finalY += 70;
        } else if (combinedChartImg) {
            doc.setFontSize(14);
            doc.text("Combined Courses Directed & Facilitated", 14, finalY);
            doc.addImage(combinedChartImg, 'PNG', 14, finalY + 5, 180, 90);
            finalY += 100;
        } else if (imciSubcoursePieImg) {
            doc.setFontSize(14);
            doc.text("IMNCI Sub-course Distribution", 14, finalY);
            doc.addImage(imciSubcoursePieImg, 'PNG', 14, finalY + 5, 180, 90);
            finalY += 100;
        }

        if (directedCourses.length > 0) {
            if (finalY + 30 > doc.internal.pageSize.height) { doc.addPage(); finalY = 20; }
            autoTable(doc, {
                startY: finalY,
                head: [['Directed Courses', 'Date', 'Location']],
                body: directedCourses.map(c => [c.course_type, c.start_date, c.state]),
                didDrawPage: (data) => { doc.text("Directed Courses", 14, data.settings.margin.top - 10); }
            });
            finalY = doc.lastAutoTable.finalY + 10;
        }

        if (facilitatedCourses.length > 0) {
            if (finalY + 30 > doc.internal.pageSize.height) { doc.addPage(); finalY = 20; }
            autoTable(doc, {
                startY: finalY,
                head: [['Facilitated Courses', 'Date', 'Location']],
                body: facilitatedCourses.map(c => [c.course_type, c.start_date, c.state]),
                didDrawPage: (data) => { doc.text("Facilitated Courses", 14, data.settings.margin.top - 10); }
            });
        }

        doc.save(fileName);
    };
    
    if (!facilitator) {
        return <Card><EmptyState message="Facilitator not found." /></Card>;
    }
    
    return (
        <div className="grid gap-6">
            <PageHeader title="Facilitator Report" subtitle={facilitator.name} actions={<>
                <Button onClick={generateFacilitatorPdf} variant="secondary"><PdfIcon /> Export as PDF</Button>
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
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Courses</td><td className="p-2">{(Array.isArray(facilitator.courses) ? facilitator.courses : []).join(', ')}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Course Director</td><td className="p-2">{facilitator.directorCourse === 'Yes' ? `Yes (${facilitator.directorCourseDate || 'N/A'})` : 'No'}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Clinical Instructor</td><td className="p-2">{facilitator.isClinicalInstructor || 'No'}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Team Leader</td><td className="p-2">{facilitator.teamLeaderCourse === 'Yes' ? `Yes (${facilitator.teamLeaderCourseDate || 'N/A'})` : 'No'}</td></tr>
                        <tr className="border-b"><td className="font-semibold p-2 bg-gray-50">Follow-up Supervisor</td><td className="p-2">{facilitator.followUpCourse === 'Yes' ? `Yes (${facilitator.followUpCourseDate || 'N/A'})` : 'No'}</td></tr>
                    </tbody></table>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Course Involvement Summary</h3>
                <Table headers={["Course Type", "Instructed", "Directed", "Total Days"]}>
                    {courseSummary.map(([type, data]) => (
                        <tr key={type} className="hover:bg-gray-50">
                            <td className="p-2 border">{type}</td>
                            <td className="p-2 border text-center">{data.instructed}</td>
                            <td className="p-2 border text-center">{data.directed}</td>
                            <td className="p-2 border text-center">{data.daysInstructed + data.daysDirected}</td>
                        </tr>
                    ))}
                </Table>
            </Card>

            {imciSubcourseData && (
                <Card>
                    <h3 className="text-xl font-bold mb-4">IMNCI Sub-course Distribution</h3>
                    <div className="h-64 flex justify-center">
                        <Pie data={imciSubcourseData} options={{ responsive: true, maintainAspectRatio: false }} ref={imciSubcoursePieRef} />
                    </div>
                </Card>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                <Card><h3 className="text-xl font-bold mb-4">Directed Courses</h3><Table headers={["Course", "Date", "Location"]}>{directedCourses.length === 0 ? <EmptyState message="No courses directed." /> : directedCourses.map(c => (<tr key={c.id} className="hover:bg-gray-50"><td className="p-2 border">{c.course_type}</td><td className="p-2 border">{c.start_date}</td><td className="p-2 border">{c.state}</td></tr>))}</Table></Card>
                <Card><h3 className="text-xl font-xl mb-4">Facilitated Courses</h3><Table headers={["Course", "Date", "Location"]}>{facilitatedCourses.length === 0 ? <EmptyState message="No courses facilitated." /> : facilitatedCourses.map(c => (<tr key={c.id} className="hover:bg-gray-50"><td className="p-2 border">{c.course_type}</td><td className="p-2 border">{c.start_date}</td><td className="p-2 border">{c.state}</td></tr>))}</Table></Card>
            </div>
        </div>
    );
}