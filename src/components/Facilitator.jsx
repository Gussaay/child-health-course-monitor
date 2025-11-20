// Facilitator.jsx
import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, Pie } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import { QRCodeCanvas } from 'qrcode.react';
import { Button, Card, EmptyState, FormGroup, Input, PageHeader, Select, Spinner, Table, Textarea, Modal, CardBody, CardFooter, CardHeader } from './CommonComponents';
import {
    listAllCourses,
    upsertFacilitator,
    deleteFacilitator,
    importFacilitators,
    submitFacilitatorApplication,
    getFacilitatorByEmail,
    getFacilitatorSubmissionByEmail,
    updateFacilitatorApplicationStatus,
    incrementFacilitatorApplicationOpenCount,
    uploadFile,
    getFacilitatorApplicationSettings,
    deleteFile
} from '../data';
import { COURSE_TYPES_FACILITATOR, STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES } from './constants.js';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useDataCache } from '../DataContext'; 
import { DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS } from './AdminDashboard';

const getCertificateName = (key) => {
    const names = {
        IMNCI: 'IMNCI ToT Certificate',
        ETAT: 'ETAT ToT Certificate',
        EENC: 'EENC ToT Certificate',
        IPC: 'IPC ToT Certificate',
        'Small & Sick Newborn': 'Small & Sick Newborn ToT Certificate',
        directorCourseCert: 'IMNCI Course Director Certificate',
        followUpCourseCert: 'IMNCI Follow-up Course Certificate',
        teamLeaderCourseCert: 'IMNCI Team Leader Certificate',
    };
    return names[key] || key;
};

function ViewCertificatesModal({ isOpen, onClose, facilitator }) {
    if (!facilitator) return null;

    const certs = facilitator.certificateUrls ? Object.entries(facilitator.certificateUrls) : [];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Certificates for ${facilitator.name}`} size="lg">
            {certs.length > 0 ? (
                <ul className="space-y-3">
                    {certs.map(([key, url]) => (
                        <li key={key} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100">
                            <span className="font-medium text-gray-700">{getCertificateName(key)}</span>
                            <a href={url} target="_blank" rel="noopener noreferrer">
                                <Button variant="secondary">View Certificate</Button>
                            </a>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="p-4">
                    <EmptyState message="No certificates have been uploaded for this facilitator." />
                </div>
            )}
        </Modal>
    );
}

function LinkManagementModal({ isOpen, onClose, settings, isLoading, onToggleStatus }) {
    const [showLinkCopied, setShowLinkCopied] = useState(false);
    const link = `${window.location.origin}/public/facilitator-application`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(link).then(() => {
            setShowLinkCopied(true);
            setTimeout(() => setShowLinkCopied(false), 2500);
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Public Submission Link">
            {isLoading ? <Spinner /> : (
                <>
                    <div>
                        <FormGroup label="Public URL">
                            <div className="relative">
                                <Input type="text" value={link} readOnly className="pr-24" />
                                <Button
                                    onClick={handleCopyLink}
                                    className="absolute right-1 top-1/2 -translate-y-1/2"
                                    variant="secondary"
                                    size="sm"
                                >
                                    {showLinkCopied ? 'Copied!' : 'Copy'}
                                </Button>
                            </div>
                        </FormGroup>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg mt-6">
                        <div className="flex items-center gap-4">
                            <div>Status:
                                <span className={`font-bold px-2 py-1 rounded-full text-xs ml-2 ${settings.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {settings.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div>
                                <span className="font-medium">Link Opened:</span> {settings.openCount || 0} times
                            </div>
                        </div>
                        <Button
                            variant={settings.isActive ? 'danger' : 'success'}
                            onClick={onToggleStatus}
                        >
                            {settings.isActive ? 'Deactivate Link' : 'Activate Link'}
                        </Button>
                    </div>
                </>
            )}
        </Modal>
    );
}

const ExcelImportModal = ({ isOpen, onClose, onImport, facilitators }) => {
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const allFields = [
        { key: 'id', label: 'ID', required: false, hidden: true },
        { key: 'name', label: 'Name' },
        { key: 'arabicName', label: 'Arabic Name' },
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
        const templateData = (facilitators || []).map(f => {
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
        <Modal isOpen={isOpen} onClose={onClose} title="Import Facilitators from Excel" size="2xl">
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
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
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

function SubmissionDetails({ submission }) {
    const fieldsToShow = {
        name: "Name",
        arabicName: "Arabic Name",
        phone: "Phone",
        email: "Email",
        currentState: "State",
        currentLocality: "Locality",
        courses: "Courses Taught",
        totDates: "ToT Dates",
        directorCourse: "Attended Director Course",
        directorCourseDate: "Director Course Date",
        followUpCourse: "Attended Follow-up Course",
        followUpCourseDate: "Follow-up Course Date",
        teamLeaderCourse: "Attended Team Leader Course",
        teamLeaderCourseDate: "Team Leader Course Date",
        isClinicalInstructor: "Is Clinical Instructor",
        comments: "Comments",
    };

    return (
        <div className="p-4">
            <dl className="divide-y divide-gray-200">
                {Object.entries(fieldsToShow).map(([key, label]) => {
                    let value = submission[key];
                    if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) return null;

                    if (key === 'courses' && Array.isArray(value)) {
                        value = value.join(', ');
                    }
                    if (key === 'totDates' && typeof value === 'object') {
                        value = Object.entries(value).map(([course, date]) => `${course}: ${date}`).join('; ');
                    }
                    if (typeof value === 'boolean') {
                        value = value ? 'Yes' : 'No';
                    }
                    
                    return (
                        <div key={key} className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                            <dt className="text-sm font-medium text-gray-500">{label}</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{String(value)}</dd>
                        </div>
                    );
                })}
            </dl>
        </div>
    );
}

// --- Reusable Facilitator Form Fields Component ---
export function FacilitatorDataForm({ data, onDataChange, onFileChange, isPublicForm = false }) {
    const { name, arabicName, phone, email, isUserEmail, courses, totDates, certificateUrls, currentState, currentLocality, directorCourse, directorCourseDate, followUpCourse, followUpCourseDate, teamLeaderCourse, teamLeaderCourseDate, isClinicalInstructor, comments, backgroundQualification, backgroundQualificationOther } = data;

    const handleFieldChange = (field, value) => onDataChange({ ...data, [field]: value });
    const handleTotDateChange = (course, date) => onDataChange({ ...data, totDates: { ...totDates, [course]: date } });
    const handleCourseToggle = (course) => {
        const newCourses = courses.includes(course) ? courses.filter(c => c !== course) : [...courses, course];
        onDataChange({ ...data, courses: newCourses });
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-none border">
                <CardHeader>Personal Information</CardHeader>
                <CardBody>
                    <div className="grid md:grid-cols-2 gap-4">
                        <FormGroup label="Facilitator Name (English)">
                            <Input value={name} onChange={e => handleFieldChange('name', e.target.value)} required />
                        </FormGroup>
                        <FormGroup label="Facilitator Name (Arabic)">
                            <Input value={arabicName || ''} onChange={e => handleFieldChange('arabicName', e.target.value)} placeholder="الاسم بالعربي" />
                        </FormGroup>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <FormGroup label="Phone Number">
                            <Input value={phone} onChange={e => handleFieldChange('phone', e.target.value)} required />
                        </FormGroup>
                        <FormGroup label="Email">
                            <Input type="email" value={email} onChange={e => handleFieldChange('email', e.target.value)} disabled={isPublicForm && isUserEmail} />
                        </FormGroup>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <FormGroup label="Background Qualification">
                            <Select value={backgroundQualification} onChange={e => handleFieldChange('backgroundQualification', e.target.value)}>
                                <option value="">— Select Qualification —</option>
                                <option>General Practitioner</option>
                                <option>Pediatric</option>
                                <option>Family Medicine</option>
                                <option>Medicine</option>
                                <option>Oncology</option>
                                <option>Pathology</option>
                                <option>Community Medicine</option>
                                <option>Surgery</option>
                                <option>Other</option>
                            </Select>
                        </FormGroup>
                        {backgroundQualification === 'Other' && (
                            <FormGroup label="Please Specify Qualification">
                                <Input value={backgroundQualificationOther} onChange={e => handleFieldChange('backgroundQualificationOther', e.target.value)} />
                            </FormGroup>
                        )}
                    </div>
                </CardBody>
            </Card>

            <Card className="shadow-none border">
                 <CardHeader>Location</CardHeader>
                 <CardBody>
                    <div className="grid md:grid-cols-2 gap-4">
                         <FormGroup label="Current State">
                             <Select value={currentState} onChange={e => onDataChange({ ...data, currentState: e.target.value, currentLocality: '' })}>
                                 <option value="">— Select State —</option>
                                 {Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}
                                 <option value="Out of Sudan">Out of Sudan</option>
                             </Select>
                         </FormGroup>
                         <FormGroup label="Current Locality">
                            <Select value={currentLocality} onChange={e => handleFieldChange('currentLocality', e.target.value)} disabled={!currentState || currentState === 'Out of Sudan'}>
                                <option value="">— Select Locality —</option>
                                {(STATE_LOCALITIES[currentState]?.localities || []).sort((a, b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                            </Select>
                        </FormGroup>
                    </div>
                 </CardBody>
            </Card>
            
             <Card className="shadow-none border">
                 <CardHeader>Course Qualifications & Certificates</CardHeader>
                 <CardBody>
                    <div className="space-y-4">
                        {COURSE_TYPES_FACILITATOR.map(course => (
                            <Fragment key={course}>
                                <div className="p-4 border rounded-lg bg-white">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id={`course_${course}`} checked={courses.includes(course)} onChange={() => handleCourseToggle(course)} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <label htmlFor={`course_${course}`} className="font-medium text-md text-gray-800">{course}</label>
                                        </div>
                                        
                                        <div className="min-w-0">
                                            {courses.includes(course) && (
                                                <FormGroup label="ToT Date">
                                                    <Input type="date" value={totDates[course] || ''} onChange={e => handleTotDateChange(course, e.target.value)} required />
                                                </FormGroup>
                                            )}
                                        </div>
                                        
                                        <div className="min-w-0">
                                            {courses.includes(course) && (
                                                <FormGroup label="Certificate (Optional)">
                                                    {!isPublicForm && certificateUrls[course] && (
                                                        <a href={certificateUrls[course]} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mb-1 block">
                                                            View Current Certificate
                                                        </a>
                                                    )}
                                                    <Input type="file" accept="image/*,.pdf" onChange={e => onFileChange(course, e.target.files[0])}
                                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                                    />
                                                </FormGroup>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {course === 'IMNCI' && courses.includes('IMNCI') && (
                                     <div className="p-4 border-t border-indigo-200 bg-indigo-50 rounded-b-lg -mt-4">
                                        <FormGroup label="Selected as Clinical Instructor?">
                                            <Select value={isClinicalInstructor} onChange={e => handleFieldChange('isClinicalInstructor', e.target.value)}><option>No</option><option>Yes</option></Select>
                                        </FormGroup>
                                     </div>
                                )}
                            </Fragment>
                        ))}
                    </div>
                 </CardBody>
            </Card>

             <Card className="shadow-none border">
                 <CardHeader>IMNCI Specific Qualifications</CardHeader>
                 <CardBody>
                    <div className="space-y-4">
                         <div className="grid md:grid-cols-3 gap-4 items-end">
                            <FormGroup label="Attended IMNCI Course Director Course?">
                                <Select value={directorCourse} onChange={e => handleFieldChange('directorCourse', e.target.value)}><option>No</option><option>Yes</option></Select>
                            </FormGroup>
                            {directorCourse === 'Yes' && <>
                                <FormGroup label="Date of Course"><Input type="date" value={directorCourseDate} onChange={e => handleFieldChange('directorCourseDate', e.target.value)} /></FormGroup>
                                <FormGroup label="Certificate">
                                    {!isPublicForm && certificateUrls['directorCourseCert'] && ( <a href={certificateUrls['directorCourseCert']} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mb-1 block">View Current</a> )}
                                    <Input type="file" accept="image/*,.pdf" onChange={e => onFileChange('directorCourseCert', e.target.files[0])} />
                                </FormGroup>
                            </>}
                        </div>
                         <div className="grid md:grid-cols-3 gap-4 items-end">
                            <FormGroup label="Attended IMNCI Follow-up Course?">
                                <Select value={followUpCourse} onChange={e => handleFieldChange('followUpCourse', e.target.value)}><option>No</option><option>Yes</option></Select>
                            </FormGroup>
                            {followUpCourse === 'Yes' && <>
                                <FormGroup label="Date of Course"><Input type="date" value={followUpCourseDate} onChange={e => handleFieldChange('followUpCourseDate', e.target.value)} /></FormGroup>
                                <FormGroup label="Certificate">
                                     {!isPublicForm && certificateUrls['followUpCourseCert'] && ( <a href={certificateUrls['followUpCourseCert']} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mb-1 block">View Current</a> )}
                                    <Input type="file" accept="image/*,.pdf" onChange={e => onFileChange('followUpCourseCert', e.target.files[0])} />
                                 </FormGroup>
                            </>}
                        </div>
                        <div className="grid md:grid-cols-3 gap-4 items-end">
                            <FormGroup label="Attended IMNCI Team Leader Course?">
                                <Select value={teamLeaderCourse} onChange={e => handleFieldChange('teamLeaderCourse', e.target.value)}><option>No</option><option>Yes</option></Select>
                            </FormGroup>
                            {teamLeaderCourse === 'Yes' && <>
                                <FormGroup label="Date of Course"><Input type="date" value={teamLeaderCourseDate} onChange={e => handleFieldChange('teamLeaderCourseDate', e.target.value)} /></FormGroup>
                                 <FormGroup label="Certificate">
                                     {!isPublicForm && certificateUrls['teamLeaderCourseCert'] && ( <a href={certificateUrls['teamLeaderCourseCert']} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mb-1 block">View Current</a> )}
                                    <Input type="file" accept="image/*,.pdf" onChange={e => onFileChange('teamLeaderCourseCert', e.target.files[0])} />
                                </FormGroup>
                            </>}
                        </div>
                    </div>
                 </CardBody>
            </Card>

             <Card className="shadow-none border">
                 <CardHeader>Additional Information</CardHeader>
                 <CardBody>
                    <FormGroup label={isPublicForm ? "Other comments or qualifications" : "Other comments from Program Manager"}>
                        <Textarea rows={4} value={comments} onChange={e => handleFieldChange('comments', e.target.value)} />
                    </FormGroup>
                 </CardBody>
            </Card>
        </div>
    );
}

function ShareLinkModal({ isOpen, onClose, title, link }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <p className="text-sm text-gray-600 mb-4">Share this public link with anyone. They will be able to view a read-only version of the profile.</p>
            
            <FormGroup label="Public Link">
                <div className="flex gap-2">
                    <Input type="text" value={link} readOnly />
                    <Button onClick={handleCopy} variant="secondary" className="w-24">
                        {copied ? 'Copied!' : 'Copy'}
                    </Button>
                </div>
            </FormGroup>

            <FormGroup label="QR Code">
                <div className="flex justify-center p-4 bg-white rounded-md border">
                    <QRCodeCanvas
                        value={link}
                        size={256} 
                        bgColor={"#ffffff"}
                        fgColor={"#000000"}
                        level={"Q"}
                    />
                </div>
            </FormGroup>
        </Modal>
    );
}

export function FacilitatorsView({ 
    onAdd, 
    onEdit, 
    onDelete, 
    onOpenReport, 
    onImport, 
    userStates,
    onApproveSubmission,
    onRejectSubmission,
    refreshData,
    permissions
}) {
    const {
        facilitators,
        pendingFacilitatorSubmissions: pendingSubmissions,
        facilitatorApplicationSettings,
        isLoading,
        fetchFacilitators,
        fetchPendingFacilitatorSubmissions,
        fetchFacilitatorApplicationSettings
    } = useDataCache();

    const isSubmissionsLoading = isLoading.pendingFacilitatorSubmissions;
    const isLoadingSettings = isLoading.facilitatorApplicationSettings;

    const [importModalOpen, setImportModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('current');
    const [viewingSubmission, setViewingSubmission] = useState(null);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [viewingCertsFor, setViewingCertsFor] = useState(null);
    
    // --- NEW STATE: Search Query ---
    const [searchQuery, setSearchQuery] = useState('');
    const [shareModalInfo, setShareModalInfo] = useState({ isOpen: false, link: '' });

    useEffect(() => {
        fetchFacilitators(); 

        if (permissions.canApproveSubmissions) {
            fetchPendingFacilitatorSubmissions(); 
            fetchFacilitatorApplicationSettings();
        }
    }, [permissions.canApproveSubmissions, fetchFacilitators, fetchPendingFacilitatorSubmissions, fetchFacilitatorApplicationSettings]);

    const handleToggleLinkStatus = async () => {
        const newStatus = !facilitatorApplicationSettings.isActive;
        await updateFacilitatorApplicationStatus(newStatus);
        fetchFacilitatorApplicationSettings(true);
    };

    const handleApprove = async (submission) => {
        try {
            await onApproveSubmission(submission); 

            if (submission.email) {
                const facilitatorRole = 'facilitator';
                const newPermissions = DEFAULT_ROLE_PERMISSIONS[facilitatorRole];

                if (!newPermissions) {
                    console.warn(`[RoleSync] Default permissions for role '${facilitatorRole}' not found. Skipping role assignment.`);
                } else {
                    const usersRef = collection(db, "users");
                    const q = query(usersRef, where("email", "==", submission.email));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const userDoc = querySnapshot.docs[0];
                        const userRef = doc(db, "users", userDoc.id);
                        
                        const updatePayload = {
                            role: facilitatorRole,
                            permissions: { ...ALL_PERMISSIONS, ...newPermissions }
                        };
                        
                        await updateDoc(userRef, updatePayload);
                        console.log(`[RoleSync] Successfully assigned 'facilitator' role to ${submission.email}`);
                    } else {
                        console.warn(`[RoleSync] Could not find user with email ${submission.email} to assign role.`);
                    }
                }
            } else {
                 console.warn(`[RoleSync] Submission ${submission.id} has no email. Skipping role assignment.`);
            }

            refreshData(); 
        } catch (error) {
             console.error("Error during approval or role assignment:", error);
        }
    };

    const handleReject = async (submissionId) => {
        await onRejectSubmission(submissionId); 
        refreshData(); 
    };
    
    const handleShare = (facilitator) => {
        const link = `${window.location.origin}/public/report/facilitator/${facilitator.id}`;
        setShareModalInfo({ isOpen: true, link: link });
    };

    const filteredFacilitators = useMemo(() => {
        if (!facilitators) {
            return [];
        }
        
        let result = facilitators;

        // Filter by Permission Scope
        if (permissions.manageScope !== 'federal') {
            if (userStates && userStates.length > 0) {
                result = result.filter(f => f.currentState && userStates.includes(f.currentState));
            }
        }

        // --- NEW: Search Filtering ---
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(f => 
                (f.name && f.name.toLowerCase().includes(lowerQuery)) ||
                (f.email && f.email.toLowerCase().includes(lowerQuery)) ||
                (f.phone && f.phone.includes(lowerQuery))
            );
        }
        
        return result;
    }, [facilitators, userStates, permissions.manageScope, searchQuery]);

    return (
        <Card>
            <CardBody>
                <PageHeader title="Manage Facilitators" />
                
                {/* --- UPDATED: Toolbar with Buttons on Left, Search on Right --- */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex gap-2 flex-wrap">
                        {permissions.canManageHumanResource && <Button onClick={onAdd}>Add New Facilitator</Button>}
                        {permissions.canManageHumanResource && <Button variant="secondary" onClick={() => setImportModalOpen(true)}>Import from Excel</Button>}
                        {permissions.canApproveSubmissions && (
                            <Button variant="secondary" onClick={() => setIsLinkModalOpen(true)}>
                                Manage Submission Link
                            </Button>
                        )}
                    </div>
                    <div className="w-full md:w-64">
                        <Input 
                            type="text" 
                            placeholder="Search by name, email, phone..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                
                <ExcelImportModal
                    isOpen={importModalOpen}
                    onClose={() => setImportModalOpen(false)}
                    onImport={onImport}
                    facilitators={facilitators}
                />

                <LinkManagementModal 
                    isOpen={isLinkModalOpen}
                    onClose={() => setIsLinkModalOpen(false)}
                    settings={facilitatorApplicationSettings}
                    isLoading={isLoadingSettings}
                    onToggleStatus={handleToggleLinkStatus}
                />
                
                <ViewCertificatesModal
                    isOpen={!!viewingCertsFor}
                    onClose={() => setViewingCertsFor(null)}
                    facilitator={viewingCertsFor}
                />
                
                <ShareLinkModal
                    isOpen={shareModalInfo.isOpen}
                    onClose={() => setShareModalInfo({ isOpen: false, link: '' })}
                    title="Share Facilitator Report"
                    link={shareModalInfo.link}
                />

                <div className="mt-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex gap-6" aria-label="Tabs">
                            <Button variant="tab" isActive={activeTab === 'current'} onClick={() => setActiveTab('current')}>
                                Current Facilitators
                            </Button>
                            {permissions.canApproveSubmissions && (
                                <Button variant="tab" isActive={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
                                    Pending Submissions 
                                    <span className={`ml-2 text-xs font-bold px-2 py-1 rounded-full ${activeTab === 'pending' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-200 text-gray-600'}`}>
                                        {pendingSubmissions ? pendingSubmissions.length : 0}
                                    </span>
                                </Button>
                            )}
                        </nav>
                    </div>

                    <div className="mt-4">
                        {activeTab === 'current' && (
                             // --- UPDATED: Removed Arabic Name from headers, kept actions simple ---
                             <Table headers={["Name", "Phone", "Courses", "Actions"]}>
                                {isLoading.facilitators ? (
                                    <tr><td colSpan={4} className="p-8 text-center"><Spinner /></td></tr>
                                ) : filteredFacilitators.length > 0 ? (
                                    filteredFacilitators.map(f => {
                                        const hasCerts = f.certificateUrls && Object.keys(f.certificateUrls).length > 0;
                                        return (
                                            <tr key={f.id}>
                                                <td className="p-4">{f.name}</td>
                                                {/* Removed Arabic Name TD */}
                                                <td className="p-4">{f.phone}</td>
                                                <td className="p-4">{(Array.isArray(f.courses) ? f.courses : []).join(', ')}</td>
                                                <td className="p-4">
                                                    {/* --- UPDATED: Actions container with whitespace-nowrap --- */}
                                                    <div className="flex gap-2 justify-end whitespace-nowrap">
                                                        <Button size="sm" onClick={() => onOpenReport(f.id)}>Report</Button>
                                                        
                                                        <Button size="sm" variant="secondary" onClick={() => handleShare(f)}>Share</Button>
                                                        
                                                        <Button size="sm" variant="secondary" onClick={() => setViewingCertsFor(f)} disabled={!hasCerts} title={hasCerts ? "View Certificates" : "No certificates available"}>Certs</Button>
                                                        {permissions.canManageHumanResource && <Button size="sm" variant="secondary" onClick={() => onEdit(f)}>Edit</Button>}
                                                        {permissions.canManageHumanResource && <Button size="sm" variant="danger" onClick={() => onDelete(f.id)}>Delete</Button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <EmptyState key="empty-facilitators" message="No facilitators found matching your search." colSpan={4} />
                                )}
                            </Table>
                        )}

                        {activeTab === 'pending' && permissions.canApproveSubmissions && (
                            isSubmissionsLoading ? <Spinner /> : (
                                // Pending table still shows Arabic name as per previous instruction, or should I remove it here too? 
                                // User said "no need for arabic name in the table", usually implying the main view. 
                                // I will remove it from here too for consistency with "the table".
                                <Table headers={["Name", "Phone", "State", "Submitted At", "Actions"]}>
                                    {pendingSubmissions && pendingSubmissions.length > 0 ? (
                                        pendingSubmissions.map(sub => (
                                            <tr key={sub.id}>
                                                <td className="p-2">{sub.name}</td>
                                                {/* Removed Arabic Name TD */}
                                                <td className="p-2">{sub.phone}</td>
                                                <td className="p-2">{sub.currentState}</td>
                                                <td className="p-2">{sub.submittedAt?.toDate ? sub.submittedAt.toDate().toLocaleDateString() : 'N/A'}</td>
                                                <td className="p-2">
                                                    <div className="flex gap-2 whitespace-nowrap">
                                                        <Button size="sm" variant="secondary" onClick={() => setViewingSubmission(sub)}>View</Button>
                                                        <Button size="sm" variant="success" onClick={() => handleApprove(sub)}>Approve</Button>
                                                        <Button size="sm" variant="danger" onClick={() => handleReject(sub.id)}>Reject</Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <EmptyState message="No pending facilitator submissions." colSpan={5} />
                                    )}
                                </Table>
                            )
                        )}
                    </div>
                </div>

                {viewingSubmission && (
                    <Modal isOpen={!!viewingSubmission} onClose={() => setViewingSubmission(null)} title="Submission Details" size="lg">
                        <SubmissionDetails submission={viewingSubmission} />
                    </Modal>
                )}
            </CardBody>
        </Card>
    );
}

export function FacilitatorForm({ initialData, onCancel, onSave, setToast, setLoading }) {
    const [formData, setFormData] = useState({
        name: '', arabicName: '', phone: '', email: '', courses: [], totDates: {}, certificateUrls: {}, currentState: '',
        currentLocality: '', directorCourse: 'No', directorCourseDate: '', followUpCourse: 'No', 
        followUpCourseDate: '', teamLeaderCourse: 'No', teamLeaderCourseDate: '', isClinicalInstructor: 'No', comments: '',
        backgroundQualification: '', backgroundQualificationOther: '',
        ...(initialData || {})
    });
    const [certificateFiles, setCertificateFiles] = useState({});
    const [error, setError] = useState('');
    const [isCertsModalOpen, setIsCertsModalOpen] = useState(false);
    const hasCerts = initialData?.certificateUrls && Object.keys(initialData.certificateUrls).length > 0;

    const handleFileChange = (certKey, file) => {
        if (file) {
            setCertificateFiles(prev => ({ ...prev, [certKey]: file }));
        }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.phone) {
            setError('Facilitator Name and Phone Number are required.');
            return;
        }

        const missingDates = formData.courses.filter(course => !formData.totDates[course]);
        if (missingDates.length > 0) {
            setError(`Please provide a ToT date for the following selected course(s): ${missingDates.join(', ')}.`);
            return;
        }
        
        setError('');
        
        try { 
            setLoading(true); 
            const payload = { ...formData, certificateFiles }; 
            const { certificateFiles: files, ...data } = payload; 
            let urls = data.certificateUrls || {}; 
            
            if (files) { 
                for (const key in files) { 
                    if (initialData?.certificateUrls?.[key]) await deleteFile(initialData.certificateUrls[key]); 
                    urls[key] = await uploadFile(files[key]); 
                } 
            } 
            
            const finalPayload = { ...data, id: initialData?.id, certificateUrls: urls }; 
            delete finalPayload.certificateFiles; 
            
            await upsertFacilitator(finalPayload); 

            const email = finalPayload.email;
            if (email) {
                const facilitatorRole = 'facilitator';
                const newPermissions = DEFAULT_ROLE_PERMISSIONS[facilitatorRole];

                if (!newPermissions) {
                    console.warn(`[RoleSync] Default permissions for role '${facilitatorRole}' not found.`);
                } else {
                    const usersRef = collection(db, "users");
                    const q = query(usersRef, where("email", "==", email));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const userDoc = querySnapshot.docs[0];
                        await updateDoc(userDoc.ref, {
                            role: facilitatorRole,
                            permissions: { ...ALL_PERMISSIONS, ...newPermissions }
                        });
                        console.log(`[RoleSync] Successfully assigned 'facilitator' role to ${email}`);
                    } else {
                        console.warn(`[RoleSync] Could not find user with email ${email} to assign role.`);
                    }
                }
            } else {
                console.warn(`[RoleSync] New facilitator has no email. Skipping role assignment.`);
            }
            
            onSave(); 

        } catch (error) { 
            setToast({ show: true, message: `Error saving: ${error.message}`, type: 'error' }); 
        } finally { 
            setLoading(false); 
        } 
    };

    return (
        <Card>
            <CardBody>
                <PageHeader 
                    title={initialData ? 'Edit Facilitator' : 'Add New Facilitator'} 
                    actions={initialData && <Button variant="secondary" onClick={() => setIsCertsModalOpen(true)} disabled={!hasCerts}>View All Certificates</Button>}
                />
                {error && <div className="p-3 mb-4 rounded-md bg-red-50 text-red-800">{error}</div>}
                
                <FacilitatorDataForm 
                    data={formData} 
                    onDataChange={setFormData}
                    onFileChange={handleFileChange}
                />
            </CardBody>
            <CardFooter>
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSubmit}>Save Facilitator</Button>
            </CardFooter>
            <ViewCertificatesModal isOpen={isCertsModalOpen} onClose={() => setIsCertsModalOpen(false)} facilitator={initialData} />
        </Card>
    );
}

export function FacilitatorApplicationForm() {
    const [formData, setFormData] = useState({
        name: '', arabicName: '', phone: '', email: '', courses: [], totDates: {}, certificateUrls: {}, currentState: '',
        currentLocality: '', directorCourse: 'No', directorCourseDate: '', followUpCourse: 'No', 
        followUpCourseDate: '', teamLeaderCourse: 'No', teamLeaderCourseDate: '', isClinicalInstructor: 'No', comments: '',
        backgroundQualification: '', backgroundQualificationOther: '',
        isUserEmail: false,
    });
    const [certificateFiles, setCertificateFiles] = useState({});
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [isLinkActive, setIsLinkActive] = useState(false);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isUpdate, setIsUpdate] = useState(false); 

    useEffect(() => {
        const checkStatusAndIncrement = async () => {
            try {
                const settings = await getFacilitatorApplicationSettings(true); 

                if (settings.isActive) {
                    await incrementFacilitatorApplicationOpenCount();
                    setIsLinkActive(true);
                } else { setIsLinkActive(false); }
            } catch (error) {
                console.error("Error checking application status:", error);
                setIsLinkActive(false);
            } finally { setIsLoadingStatus(false); }
        };

        checkStatusAndIncrement();
        
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && user.email) {
                setFormData(prev => ({ ...prev, email: user.email, isUserEmail: true }));

                const existingFacilitator = await getFacilitatorByEmail(user.email);
                
                if (existingFacilitator) {
                    setFormData(prev => ({ ...prev, ...existingFacilitator, isUserEmail: true }));
                    setIsUpdate(true); 
                } else {
                    const existingSubmission = await getFacilitatorSubmissionByEmail(user.email);
                    if (existingSubmission) {
                        setFormData(prev => ({ ...prev, ...existingSubmission, email: user.email, isUserEmail: true }));
                    }
                }
            }
        });

        return () => unsubscribe();
    }, []);

    const handleFileChange = (certKey, file) => {
        if (file) {
            setCertificateFiles(prev => ({ ...prev, [certKey]: file }));
        }
    };
    
    const handleSubmit = async () => {
        if (!formData.name || !formData.phone) {
            setError('Facilitator Name and Phone Number are required.');
            return;
        }
        
        const missingDates = formData.courses.filter(course => !formData.totDates[course]);
        if (missingDates.length > 0) {
            setError(`Please provide a ToT date for the following selected course(s): ${missingDates.join(', ')}.`);
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            let certificateUrls = { ...(formData.certificateUrls || {}) };
            for (const key in certificateFiles) {
                const file = certificateFiles[key];
                if (file) {
                    const url = await uploadFile(file);
                    certificateUrls[key] = url;
                }
            }

            const payload = { ...formData, certificateUrls };
            delete payload.isUserEmail;
            
            if (payload.id) {
                await upsertFacilitator(payload);
            } else {
                await submitFacilitatorApplication(payload);
            }
            
            setSubmitted(true);
        } catch (err) {
            console.error("Submission failed:", err);
            setError("There was an error submitting your information. Please try again later.");
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoadingStatus) return <Card><Spinner /></Card>;
    if (!isLinkActive) return <Card><PageHeader title="Facilitator Application" /><EmptyState message="Submissions for new facilitators are currently closed." /></Card>;
    
    if (submitted) {
        const title = isUpdate ? "Profile Updated" : "Submission Received";
        const message = isUpdate 
            ? "Your profile has been updated successfully."
            : "Your information has been submitted successfully for review.";
            
        return (
            <Card>
                <PageHeader title={title} />
                <div className="p-8 text-center">
                    <h3 className="text-2xl font-bold text-green-600 mb-4">Thank You!</h3>
                    <p className="text-gray-700">{message}</p>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <CardBody>
                <PageHeader 
                    title={isUpdate ? "Update Your Facilitator Profile" : "Facilitator Application Form"}
                    subtitle={isUpdate ? "Please review and update your information below." : "Submit your details to be considered as a facilitator for the National Child Health Program."} 
                />
                {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                <FacilitatorDataForm 
                    data={formData} 
                    onDataChange={setFormData}
                    onFileChange={handleFileChange}
                    isPublicForm={true}
                />
            </CardBody>
            <CardFooter>
                 <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Submitting...' : (isUpdate ? 'Update Profile' : 'Submit Application')}
                </Button>
            </CardFooter>
        </Card>
    );
}

export function FacilitatorReportView({ 
    facilitator, 
    allCourses, 
    onBack, 
    isSharedView = false
}) {
    const combinedChartRef = useRef(null);
    const imciSubcoursePieRef = useRef(null);
    const [isCertsModalOpen, setIsCertsModalOpen] = useState(false);
    const hasCerts = facilitator?.certificateUrls && Object.keys(facilitator.certificateUrls).length > 0;
    
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const publicLink = isSharedView ? window.location.href : `${window.location.origin}/public/report/facilitator/${facilitator?.id}`;
    
    const { 
        directedCourses, 
        facilitatedCourses, 
        combinedChartData, 
        imciSubcourseData, 
        courseSummary,
        totalInstructed,
        totalDirected
    } = useMemo(() => {
        if (!facilitator || !allCourses) {
            return {
                directedCourses: [], facilitatedCourses: [], combinedChartData: { labels: [], datasets: [] }, 
                imciSubcourseData: null, courseSummary: [], totalInstructed: 0, totalDirected: 0
            };
        }

        const directed = allCourses.filter(c => c.director === facilitator.name);
        const facilitated = allCourses.filter(c => Array.isArray(c.facilitators) && c.facilitators.includes(facilitator.name));
        
        const summary = {};
        const imciCounts = {};

        allCourses.forEach(course => {
            const courseType = course.course_type;
            summary[courseType] = summary[courseType] || { directed: 0, instructed: 0, daysDirected: 0, daysInstructed: 0, };

            const isDirector = course.director === facilitator.name;
            const isClinical = course.clinical_instructor === facilitator.name;
            const isFacilitator = Array.isArray(course.facilitators) && course.facilitators.includes(facilitator.name);

            if (isDirector) {
                summary[courseType].directed++;
                summary[courseType].daysDirected += (course.course_duration || 0);
            }
            if (isFacilitator) {
                summary[courseType].instructed++;
                summary[courseType].daysInstructed += (course.course_duration || 0);
            }

            if (courseType === 'IMNCI' && (isDirector || isClinical || isFacilitator)) {
                const involvedSubTypes = new Set();
                
                if (isDirector && course.director_imci_sub_type) {
                    involvedSubTypes.add(course.director_imci_sub_type);
                }
                if (isClinical && course.clinical_instructor_imci_sub_type) {
                    involvedSubTypes.add(course.clinical_instructor_imci_sub_type);
                }
                if (isFacilitator && Array.isArray(course.facilitatorAssignments)) {
                    course.facilitatorAssignments.forEach(ass => {
                        if (ass.name === facilitator.name && ass.imci_sub_type) {
                            involvedSubTypes.add(ass.imci_sub_type);
                        }
                    });
                }
                
                involvedSubTypes.forEach(subType => {
                    imciCounts[subType] = (imciCounts[subType] || 0) + 1;
                });
            }
        });

        const finalCombinedChartData = {
            labels: Object.keys(summary),
            datasets: [
                {
                    label: 'Courses Instructed',
                    data: Object.values(summary).map(s => s.instructed),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                },
                {
                    label: 'Courses Directed',
                    data: Object.values(summary).map(s => s.directed),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                },
            ],
        };
        
        let finalImciSubcourseData = null;
        if (Object.keys(imciCounts).length > 0) {
            const backgroundColors = IMNCI_SUBCOURSE_TYPES.map((_, index) => {
                const colors = [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                ];
                return colors[index % colors.length];
            });

            finalImciSubcourseData = {
                labels: Object.keys(imciCounts),
                datasets: [{
                    data: Object.values(imciCounts),
                    backgroundColor: backgroundColors.slice(0, Object.keys(imciCounts).length),
                }]
            };
        }
        
        return {
            directedCourses: directed,
            facilitatedCourses: facilitated,
            courseSummary: Object.entries(summary),
            combinedChartData: finalCombinedChartData,
            imciSubcourseData: finalImciSubcourseData,
            totalInstructed: facilitated.length,
            totalDirected: directed.length
        };
    }, [facilitator, allCourses]);
    
    const generateFacilitatorPdf = () => {
    };
    
    if (!facilitator) {
        return <Card><CardBody><EmptyState message="Facilitator not found." /></CardBody></Card>;
    }
    
    return (
        <div className="space-y-6">
            <ViewCertificatesModal isOpen={isCertsModalOpen} onClose={() => setIsCertsModalOpen(false)} facilitator={facilitator} />
            
            <ShareLinkModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                title="Share Facilitator Report"
                link={publicLink}
            />
            
            <PageHeader title="Facilitator Report" subtitle={facilitator.name} actions={<>
                <Button onClick={generateFacilitatorPdf} variant="secondary">Export as PDF</Button>
                <Button variant="secondary" onClick={() => setIsCertsModalOpen(true)} disabled={!hasCerts}>View Certificates</Button>
                
                {isSharedView ? (
                    <Button variant="secondary" onClick={() => setIsShareModalOpen(true)}>Share</Button>
                ) : (
                    <Button onClick={onBack}>Back to List</Button>
                )}
            </>} />

            {/* 1. Full Facilitator Details */}
            <Card>
                <CardHeader>Facilitator Details</CardHeader>
                <CardBody>
                    <dl className="divide-y divide-gray-200">
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">Name (English)</dt><dd className="md:col-span-2">{facilitator.name}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">Name (Arabic)</dt><dd className="md:col-span-2 font-arabic">{facilitator.arabicName || '-'}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">Phone</dt><dd className="md:col-span-2">{facilitator.phone}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">Email</dt><dd className="md:col-span-2">{facilitator.email || 'N/A'}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">Location</dt><dd className="md:col-span-2">{facilitator.currentState ? `${facilitator.currentState}${facilitator.currentLocality ? `, ${facilitator.currentLocality}` : ''}` : 'N/A'}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">Background</dt><dd className="md:col-span-2">{facilitator.backgroundQualification === 'Other' ? facilitator.backgroundQualificationOther : facilitator.backgroundQualification || 'N/A'}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">Courses (ToT)</dt><dd className="md:col-span-2">{(Array.isArray(facilitator.courses) ? facilitator.courses : []).join(', ')}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">IMNCI Director</dt><dd className="md:col-span-2">{facilitator.directorCourse || 'No'}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">IMNCI Follow-up</dt><dd className="md:col-span-2">{facilitator.followUpCourse || 'No'}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">IMNCI Team Leader</dt><dd className="md:col-span-2">{facilitator.teamLeaderCourse || 'No'}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">Clinical Instructor</dt><dd className="md:col-span-2">{facilitator.isClinicalInstructor || 'No'}</dd></div>
                       <div className="py-2 grid grid-cols-1 md:grid-cols-3 gap-4"><dt className="font-medium text-gray-500">Comments</dt><dd className="md:col-span-2">{facilitator.comments || 'N/A'}</dd></div>
                    </dl>
                </CardBody>
            </Card>

            {/* 2. KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>Total Courses Instructed</CardHeader>
                    <CardBody className="flex items-center justify-center">
                        <div className="text-5xl font-bold text-indigo-600">{totalInstructed}</div>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader>Total Courses Directed</CardHeader>
                    <CardBody className="flex items-center justify-center">
                        <div className="text-5xl font-bold text-pink-600">{totalDirected}</div>
                    </CardBody>
                </Card>
            </div>

            {/* 3. Course Involvement Summary Table */}
            <Card>
                <CardHeader>Course Involvement Summary</CardHeader>
                <CardBody>
                    <Table headers={["Course Type", "Instructed", "Directed", "Total Days"]}>
                        {courseSummary.map(([type, data]) => (
                            <tr key={type}>
                                <td className="p-2 border">{type}</td>
                                <td className="p-2 border text-center">{data.instructed}</td>
                                <td className="p-2 border text-center">{data.directed}</td>
                                <td className="p-2 border text-center">{data.daysInstructed + data.daysDirected}</td>
                            </tr>
                        ))}
                    </Table>
                </CardBody>
            </Card>
            
            {/* 4. Graphs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 5. IMNCI Pie Chart */}
                {imciSubcourseData && (
                    <Card>
                        <CardHeader>IMNCI Sub-course Distribution</CardHeader>
                        <CardBody><div className="h-64 flex justify-center"><Pie data={imciSubcourseData} options={{ responsive: true, maintainAspectRatio: false }} ref={imciSubcoursePieRef} /></div></CardBody>
                    </Card>
                )}
                 <Card>
                    <CardHeader>Course Overview (All Types)</CardHeader>
                    <CardBody><div className="h-64 flex justify-center"><Bar data={combinedChartData} options={{ responsive: true, maintainAspectRatio: false }} ref={combinedChartRef} /></div></CardBody>
                </Card>
            </div>

            {/* 6. Directed and Facilitated Lists */}
            <div className="grid md:grid-cols-2 gap-6">
                 <Card><CardHeader>Directed Courses</CardHeader><CardBody><Table headers={["Course", "Date", "Location"]}>{directedCourses.length > 0 ? directedCourses.map(c => <tr key={c.id}><td className="p-2">{c.course_type}</td><td className="p-2">{c.start_date}</td><td className="p-2">{c.state}</td></tr>) : <EmptyState message="No courses directed." colSpan={3} />}</Table></CardBody></Card>
                 <Card><CardHeader>Facilitated Courses</CardHeader><CardBody><Table headers={["Course", "Date", "Location"]}>{facilitatedCourses.length > 0 ? facilitatedCourses.map(c => <tr key={c.id}><td className="p-2">{c.course_type}</td><td className="p-2">{c.start_date}</td><td className="p-2">{c.state}</td></tr>) : <EmptyState message="No courses facilitated." colSpan={3} />}</Table></CardBody></Card>
            </div>
        </div>
    );
}