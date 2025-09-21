import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Textarea, Table, EmptyState, Modal
} from "./CommonComponents";
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_ETAT, JOB_TITLES_EENC, JOB_TITLES_IMNCI
} from './constants.js';

// --- Excel Import Modal Component ---
const ExcelImportModal = ({ isOpen, onClose, onImport, course, participants }) => {
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const allFields = [
        { key: 'id', label: 'ID', required: false, hidden: true },
        { key: 'name', label: 'Name' },
        { key: 'group', label: 'Group' },
        { key: 'email', label: 'Email' },
        { key: 'state', label: 'State' },
        { key: 'locality', label: 'Locality' },
        { key: 'center_name', label: 'Health Facility Name' },
        { key: 'job_title', label: 'Job Title' },
        { key: 'phone', label: 'Phone Number' },
        { key: 'pre_test_score', label: 'Pre-Test Score' },
        { key: 'post_test_score', label: 'Post-Test Score' },
        ...(course.course_type === 'IMNCI' ? [
            { key: 'imci_sub_type', label: 'IMCI Course Sub-type' },
            { key: 'facility_type', label: 'Facility Type' },
            { key: 'trained_before', label: 'Previously trained in IMCI?' },
            { key: 'last_imci_training', label: 'Date of last training' },
            { key: 'num_other_providers', label: 'Number of other providers' },
            { key: 'num_other_providers_imci', label: 'Number of providers trained in IMCI' },
            { key: 'has_nutrition_service', label: 'Has therapeutic nutrition service?' },
            { key: 'nearest_nutrition_center', label: 'Nearest therapeutic nutrition center?' },
            { key: 'has_immunization_service', label: 'Has immunization service?' },
            { key: 'nearest_immunization_center', label: 'Nearest immunization center?' },
            { key: 'has_ors_room', label: 'Has ORS corner service?' }
        ] : []),
        ...(course.course_type === 'ETAT' ? [
            { key: 'hospital_type', label: 'Hospital Type' },
            { key: 'trained_etat_before', label: 'Previously trained on ETAT?' },
            { key: 'last_etat_training', label: 'Date of last ETAT training' },
            { key: 'has_triage_system', label: 'Does hospital have a current triaging system?' },
            { key: 'has_stabilization_center', label: 'Does hospital have a stabilization center for malnutrition?' },
            { key: 'has_hdu', label: 'Does hospital have a high dependency unit?' },
            { key: 'num_staff_in_er', label: 'Number of staff in ER' },
            { key: 'num_staff_trained_in_etat', label: 'Number of staff trained in ETAT' }
        ] : []),
        ...(course.course_type === 'EENC' ? [
            { key: 'hospital_type', label: 'Hospital Type' },
            { key: 'other_hospital_type', label: 'Specify Hospital Type' },
            { key: 'trained_eenc_before', label: 'Previously trained on EENC?' },
            { key: 'last_eenc_training', label: 'Date of last EENC training' },
            { key: 'has_sncu', label: 'Does hospital have a Special Newborn Care Unit (SNCU)?' },
            { key: 'has_iycf_center', label: 'Does hospital have an IYCF center?' },
            { key: 'has_kangaroo_room', label: 'Does hospital have a Kangaroo care room?' },
            { key: 'num_staff_in_delivery', label: 'Number of staff in delivery room' },
            { key: 'num_staff_trained_in_eenc', label: 'Number of staff trained in EENC' }
        ] : [])
    ];

    const handleDownloadTemplate = () => {
        const templateData = participants.map(p => {
            const row = {};
            allFields.forEach(field => {
                row[field.label] = p[field.key] || '';
            });
            return row;
        });

        const headerLabels = allFields.map(f => f.label);
        const worksheet = XLSX.utils.json_to_sheet(templateData, { header: headerLabels });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Participants");
        XLSX.writeFile(workbook, `Participant_Template_${course.course_type}.xlsx`);
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

        const importedParticipants = excelData.map(row => {
            const participant = {};
            Object.entries(fieldMappings).forEach(([appField, excelHeader]) => {
                const headerIndex = headers.indexOf(excelHeader);
                if (headerIndex !== -1 && row[headerIndex] !== undefined) {
                    participant[appField] = row[headerIndex];
                }
            });
            return participant;
        }).filter(p => p.name);

        if (importedParticipants.length === 0) {
            setError('No valid participants were found with a name after mapping.');
            return;
        }
        
        onImport(importedParticipants);
        onClose();
    };

    const renderPreview = () => {
        if (excelData.length === 0) return null;

        return (
            <div className="mt-4 overflow-auto max-h-60">
                <h4 className="font-medium mb-2">Data Preview (first 5 rows)</h4>
                <table className="min-w-full border border-gray-200">
                    <thead>
                        <tr className="bg-gray-100">
                            {headers.map((header, idx) => (
                                <th key={idx} className="border border-gray-300 p-2 text-left text-xs">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {excelData.slice(0, 5).map((row, rowIdx) => (
                            <tr key={rowIdx}>
                                {row.map((cell, cellIdx) => (
                                    <td key={cellIdx} className="border border-gray-300 p-2 text-xs">{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Participants from Excel">
            <div className="p-4">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

                {currentPage === 0 && (
                    <div>
                        <p className="mb-4">
                            You can download an Excel template to get started. Fill it out and then upload it here. The template will include existing participant data for easy editing.
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
                            Map the columns from your Excel file to the corresponding fields in the application. Only the 'Name' field is required for import. To update an existing record, the 'ID' field must be mapped.
                        </p>
                        <div className="grid gap-3 mb-4">
                            {allFields.map(field => (
                                <div key={field.key} className="flex items-center" style={{ display: field.hidden ? 'none' : 'flex' }}>
                                    <label className="w-40 font-medium">{field.label}{field.key === 'name' && '*'}</label>
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
                            <Button onClick={handleImport}>Import Participants</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export function ParticipantsView({ course, participants, onAdd, onOpen, onEdit, onDelete, onOpenReport, onImport, canAddParticipant, canBulkUploadParticipant }) {
    const [groupFilter, setGroupFilter] = useState('All');
    const [importModalOpen, setImportModalOpen] = useState(false);
    const filtered = groupFilter === 'All' ? participants : participants.filter(p => p.group === groupFilter);

    return (
        <Card>
            <PageHeader title="Course Participants" subtitle={`${course.state} / ${course.locality}`} />

            <ExcelImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onImport={onImport}
                course={course}
                participants={participants}
            />

            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <div className="flex gap-2">
                    {canAddParticipant && (
                        <Button onClick={onAdd}>Add Participant</Button>
                    )}
                    {canBulkUploadParticipant && (
                        <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                            Import from Excel
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Filter by Group:</label>
                    <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                        <option value="All">All Groups</option>
                        <option>Group A</option>
                        <option>Group B</option>
                        <option>Group C</option>
                        <option>Group D</option>
                    </Select>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
                <Table headers={["Name", "Group", "Job Title", "Actions"]}>
                    {filtered.length === 0 ? <EmptyState message="No participants found for this group." /> : filtered.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="p-4 border border-gray-200 font-medium text-gray-800">{p.name}</td>
                            <td className="p-4 border border-gray-200">{p.group}</td>
                            <td className="p-4 border border-gray-200">{p.job_title}</td>
                            <td className="p-4 border border-gray-200 text-right">
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <Button variant="primary" onClick={() => onOpen(p.id)}>Monitor</Button>
                                    <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                    <Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button>
                                    <Button variant="danger" onClick={() => onDelete(p.id)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid gap-4">
                {filtered.length === 0 ? (
                    <p className="py-12 text-center text-gray-500">No participants found for this group.</p>
                ) : (
                    filtered.map(p => (
                        <div key={p.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                                    <p className="text-gray-600">{p.job_title}</p>
                                    <p className="text-sm text-gray-500 mt-1">Group: <span className="font-medium text-gray-700">{p.group}</span></p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
                                <Button variant="secondary" onClick={() => onOpen(p.id)}>Monitor</Button>
                                <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                <Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button>
                                <Button variant="danger" onClick={() => onDelete(p.id)}>Delete</Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}


export function ParticipantForm({ course, initialData, onCancel, onSave }) {
    // --- Course Type Flags ---
    const isImnci = course.course_type === 'IMNCI';
    const isEtat = course.course_type === 'ETAT';
    const isEenc = course.course_type === 'EENC';

    const excludedImnciSubtypes = ["Standard 7 days course for Medical Doctors", "Standard 7 days course for Medical Assistance", "Refreshment IMNCI Course"];
    const showTestScores = !isImnci || (isImnci && !excludedImnciSubtypes.includes(initialData?.imci_sub_type));


    // --- Dynamic Job Options ---
    const jobTitleOptions = useMemo(() => {
        if (isEtat) return JOB_TITLES_ETAT;
        if (isEenc) return JOB_TITLES_EENC;
        return JOB_TITLES_IMNCI;
    }, [isImnci, isEtat, isEenc]);

    // --- Common States ---
    const [name, setName] = useState(initialData?.name || '');
    const [email, setEmail] = useState(initialData?.email || '');
    const [state, setState] = useState(initialData?.state || '');
    const [locality, setLocality] = useState(initialData?.locality || '');
    const [center, setCenter] = useState(initialData?.center_name || '');
    const [phone, setPhone] = useState(initialData?.phone || '');
    const [group, setGroup] = useState(initialData?.group || 'Group A');
    const [error, setError] = useState('');
    const [preTestScore, setPreTestScore] = useState(initialData?.pre_test_score || '');
    const [postTestScore, setPostTestScore] = useState(initialData?.post_test_score || '');

    // --- Job Title State ---
    const initialJobTitle = initialData?.job_title || '';
    const isInitialJobOther = initialJobTitle && !jobTitleOptions.includes(initialJobTitle);
    const [job, setJob] = useState(isInitialJobOther ? 'Other' : initialJobTitle);
    const [otherJobTitle, setOtherJobTitle] = useState(isInitialJobOther ? initialJobTitle : '');

    // --- IMCI States ---
    const [imciSubType, setImciSubType] = useState(initialData?.imci_sub_type || 'Standard 7 days course');
    const [facilityType, setFacilityType] = useState(initialData?.facility_type || '');
    const [trainedIMNCI, setTrainedIMNCI] = useState(initialData?.trained_before ? 'yes' : 'no');
    const [lastTrainIMNCI, setLastTrainIMNCI] = useState(initialData?.last_imci_training || '');
    const [numProv, setNumProv] = useState(initialData?.num_other_providers || 1);
    const [numProvIMCI, setNumProvIMNCI] = useState(initialData?.num_other_providers_imci || 0);
    const [hasNutri, setHasNutri] = useState(initialData?.has_nutrition_service || false);
    const [nearestNutri, setNearestNutri] = useState(initialData?.nearest_nutrition_center || '');
    const [hasImm, setHasImm] = useState(initialData?.has_immunization_service || false);
    const [nearestImm, setNearestImm] = useState(initialData?.nearest_immunization_center || '');
    const [hasORS, setHasORS] = useState(initialData?.has_ors_room || false);

    // --- ETAT States ---
    const [hospitalTypeEtat, setHospitalTypeEtat] = useState(initialData?.hospital_type || '');
    const [trainedEtat, setTrainedEtat] = useState(initialData?.trained_etat_before ? 'yes' : 'no');
    const [lastTrainEtat, setLastTrainEtat] = useState(initialData?.last_etat_training || '');
    const [hasTriageSystem, setHasTriageSystem] = useState(initialData?.has_triage_system || false);
    const [hasStabilizationCenter, setHasStabilizationCenter] = useState(initialData?.has_stabilization_center || false);
    const [hasHdu, setHasHdu] = useState(initialData?.has_hdu || false);
    const [numStaffInEr, setNumStaffInEr] = useState(initialData?.num_staff_in_er || 0);
    const [numStaffTrainedInEtat, setNumStaffTrainedInEtat] = useState(initialData?.num_staff_trained_in_etat || 0);

    // --- EENC States ---
    const [hospitalTypeEenc, setHospitalTypeEenc] = useState(initialData?.hospital_type || '');
    const [otherHospitalTypeEenc, setOtherHospitalTypeEenc] = useState(initialData?.other_hospital_type || '');
    const [trainedEENC, setTrainedEENC] = useState(initialData?.trained_eenc_before ? 'yes' : 'no');
    const [lastTrainEENC, setLastTrainEENC] = useState(initialData?.last_eenc_training || '');
    const [hasSncu, setHasSncu] = useState(initialData?.has_sncu || false);
    const [hasIycfCenter, setHasIycfCenter] = useState(initialData?.has_iycf_center || false);
    const [numStaffInDelivery, setNumStaffInDelivery] = useState(initialData?.num_staff_in_delivery || 0);
    const [numStaffTrainedInEenc, setNumStaffTrainedInEenc] = useState(initialData?.num_staff_trained_in_eenc || 0);
    const [hasKangaroo, setHasKangaroo] = useState(initialData?.has_kangaroo_room || false);

    // --- Dynamic Label Logic ---
    const professionalCategory = useMemo(() => {
        const lowerCaseJob = (job === 'Other' ? otherJobTitle : job).toLowerCase();
        if (lowerCaseJob.includes('doctor') || lowerCaseJob.includes('specialist') || lowerCaseJob.includes('registrar') || lowerCaseJob.includes('practioner')) return 'doctor';
        if (lowerCaseJob.includes('nurse')) return 'nurse';
        if (lowerCaseJob.includes('midwife')) return 'midwife';
        return 'provider';
    }, [job, otherJobTitle]);

    const submit = () => {
        const finalJobTitle = job === 'Other' ? otherJobTitle : job;
        if (!name || !state || !locality || !center || !finalJobTitle || !phone) { setError('Please complete all required fields'); return; }

        let p = { name, group, state, locality, center_name: center, job_title: finalJobTitle, phone, email };

        // Add pre and post test scores
        if (showTestScores) {
            p = { ...p, pre_test_score: preTestScore, post_test_score: postTestScore };
        }

        if (isImnci) {
            if (!facilityType || !imciSubType) { setError('Please complete all required fields'); return; }
            if (numProv <= 0) { setError('Number of providers at health center must be more than zero.'); return; }
            p = { ...p, imci_sub_type: imciSubType, facility_type: facilityType, trained_before: trainedIMNCI === 'yes', last_imci_training: trainedIMNCI === 'yes' ? lastTrainIMNCI : '', num_other_providers: numProv, num_other_providers_imci: numProvIMCI, has_nutrition_service: hasNutri, has_immunization_service: hasImm, has_ors_room: hasORS, nearest_nutrition_center: !hasNutri ? nearestNutri : '', nearest_immunization_center: !hasImm ? nearestImm : '' };
        } else if (isEtat) {
            if (!hospitalTypeEtat) { setError('Please complete all required fields'); return; }
            p = { ...p, hospital_type: hospitalTypeEtat, trained_etat_before: trainedEtat === 'yes', last_etat_training: trainedEtat === 'yes' ? lastTrainEtat : '', has_triage_system: hasTriageSystem, has_stabilization_center: hasStabilizationCenter, has_hdu: hasHdu, num_staff_in_er: numStaffInEr, num_staff_trained_in_etat: numStaffTrainedInEtat };
        } else if (isEenc) {
            if (!hospitalTypeEenc) { setError('Please complete all required fields'); return; }
            p = { ...p, hospital_type: hospitalTypeEenc === 'other' ? otherHospitalTypeEenc : hospitalTypeEenc, trained_eenc_before: trainedEENC === 'yes', last_eenc_training: trainedEENC === 'yes' ? lastTrainEENC : '', has_sncu: hasSncu, has_iycf_center: hasIycfCenter, num_staff_in_delivery: numStaffInDelivery, num_staff_trained_in_eenc: numStaffTrainedInEenc, has_kangaroo_room: hasKangaroo };
        }

        onSave(p);
    };

    return (
        <Card>
            <PageHeader title={initialData ? 'Edit Participant' : 'Add New Participant'} />
            {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* --- COMMON FIELDS --- */}
                <FormGroup label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormGroup>
                <FormGroup label="Group"><Select value={group} onChange={(e) => setGroup(e.target.value)}><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                <FormGroup label={isEtat ? "Hospital Name" : "Health Facility Name"}><Input value={center} onChange={(e) => setCenter(e.target.value)} /></FormGroup>
                <FormGroup label="Email (Optional)"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></FormGroup>

                <FormGroup label="Job Title">
                    <Select value={job} onChange={(e) => setJob(e.target.value)}>
                        <option value="">— Select Job —</option>
                        {jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </Select>
                </FormGroup>

                {job === 'Other' && (
                    <FormGroup label="Specify Job Title">
                        <Input value={otherJobTitle} onChange={(e) => setOtherJobTitle(e.target.value)} placeholder="Please specify" />
                    </FormGroup>
                )}

                <FormGroup label="Phone Number"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></FormGroup>

                {showTestScores && (
                    <>
                        <FormGroup label="Pre-Test Score (%)">
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={preTestScore}
                                onChange={(e) => setPreTestScore(e.target.value)}
                            />
                        </FormGroup>
                        <FormGroup label="Post-Test Score (%)">
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={postTestScore}
                                onChange={(e) => setPostTestScore(e.target.value)}
                            />
                        </FormGroup>
                    </>
                )}

                {/* --- IMCI SPECIFIC FIELDS --- */}
                {isImnci && (<>
                    <FormGroup label="IMCI Course Sub-type">
                        <Select value={imciSubType} onChange={(e) => setImciSubType(e.target.value)}>
                            {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Facility Type"><Select value={facilityType} onChange={(e) => setFacilityType(e.target.value)}><option value="">— Select Type —</option><option value="Health Unit">Health Unit</option><option value="Health Center">Health Center</option><option value="Rural Hospital">Rural Hospital</option><option value="Teaching Hospital">Teaching Hospital</option><option value="other">Other</option></Select></FormGroup>
                    <FormGroup label="Previously trained in IMCI?"><Select value={trainedIMNCI ? 'yes' : 'no'} onChange={(e) => setTrainedIMNCI(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {trainedIMNCI === 'yes' && <FormGroup label="Date of last training"><Input type="date" value={lastTrainIMNCI} onChange={(e) => setLastTrainIMNCI(e.target.value)} /></FormGroup>}
                    <FormGroup label="Has therapeutic nutrition service?"><Select value={hasNutri ? 'yes' : 'no'} onChange={e => setHasNutri(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {!hasNutri && <FormGroup label="Nearest therapeutic nutrition center?"><Input value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} /></FormGroup>}
                    <FormGroup label="Has immunization service?"><Select value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {!hasImm && <FormGroup label="Nearest immunization center?"><Input value={nearestImm} onChange={e => setNearestImm(e.target.value)} /></FormGroup>}
                    <FormGroup label="Has ORS corner service?"><Select value={hasORS ? 'yes' : 'no'} onChange={e => setHasORS(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Number of provider at health center including the current participant"><Input type="number" min="1" value={numProv} onChange={(e) => setNumProv(Number(e.target.value || 1))} /></FormGroup>
                    <FormGroup label="Number of providers trained in IMCI (not including current COURSE)"><Input type="number" min="0" value={numProvIMCI} onChange={(e) => setNumProvIMCI(Number(e.target.value || 0))} /></FormGroup>
                </>)}

                {/* --- ETAT SPECIFIC FIELDS --- */}
                {isEtat && (<>
                    <FormGroup label="Hospital Type"><Select value={hospitalTypeEtat} onChange={e => setHospitalTypeEtat(e.target.value)}><option value="">— Select Type —</option><option>Pediatric Hospital</option><option>Pediatric Department in General Hospital</option><option>Rural Hospital</option><option>other</option></Select></FormGroup>
                    <FormGroup label="Previously trained on ETAT?"><Select value={trainedEtat ? 'yes' : 'no'} onChange={e => setTrainedEtat(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {trainedEtat === 'yes' && <FormGroup label="Date of last ETAT training"><Input type="date" value={lastTrainEtat} onChange={(e) => setLastTrainEtat(e.target.value)} /></FormGroup>}
                    <FormGroup label="Does hospital have a current triaging system?"><Select value={hasTriageSystem ? 'yes' : 'no'} onChange={e => setHasTriageSystem(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have a stabilization center for malnutrition?"><Select value={hasStabilizationCenter ? 'yes' : 'no'} onChange={e => setHasStabilizationCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have a high dependency unit?"><Select value={hasHdu ? 'yes' : 'no'} onChange={e => setHasHdu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s working in Emergency Room`}><Input type="number" min="0" value={numStaffInEr} onChange={e => setNumStaffInEr(Number(e.target.value || 0))} /></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s trained in ETAT`}><Input type="number" min="0" value={numStaffTrainedInEtat} onChange={e => setNumStaffTrainedInEtat(Number(e.target.value || 0))} /></FormGroup>
                </>)}

                {/* --- EENC SPECIFIC FIELDS --- */}
                {isEenc && (<>
                    <FormGroup label="Hospital Type"><Select value={hospitalTypeEenc} onChange={e => setHospitalTypeEenc(e.target.value)}><option value="">— Select Type —</option><option>Comprehensive EmONC</option><option>Basic EmONC</option><option value="other">Other (specify)</option></Select></FormGroup>
                    {hospitalTypeEenc === 'other' && <FormGroup label="Specify Hospital Type"><Input value={otherHospitalTypeEenc} onChange={e => setOtherHospitalTypeEenc(e.target.value)} /></FormGroup>}
                    <FormGroup label="Previously trained on EENC?"><Select value={trainedEENC ? 'yes' : 'no'} onChange={e => setTrainedEENC(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {trainedEENC === 'yes' && <FormGroup label="Date of last EENC training"><Input type="date" value={lastTrainEENC} onChange={(e) => setLastTrainEENC(e.target.value)} /></FormGroup>}
                    <FormGroup label="Does hospital have a Special Newborn Care Unit (SNCU)?"><Select value={hasSncu ? 'yes' : 'no'} onChange={e => setHasSncu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have an IYCF center?"><Select value={hasIycfCenter ? 'yes' : 'no'} onChange={e => setHasIycfCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have a Kangaroo care room?"><Select value={hasKangaroo ? 'yes' : 'no'} onChange={e => setHasKangaroo(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s working in delivery room`}><Input type="number" min="0" value={numStaffInDelivery} onChange={e => setNumStaffInDelivery(Number(e.target.value || 0))} /></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s trained in EENC`}><Input type="number" min="0" value={numStaffTrainedInEenc} onChange={e => setNumStaffTrainedInEenc(Number(e.target.value || 0))} /></FormGroup>
                </>)}
            </div>
            <div className="flex gap-2 justify-end mt-6 border-t pt-6"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={submit}>Save Participant</Button></div>
        </Card>
    );
}