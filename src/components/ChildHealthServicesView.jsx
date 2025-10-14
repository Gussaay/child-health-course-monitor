// ChildHealthServicesView.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Corrected import
import { getAuth } from "firebase/auth";

import {
    Card, PageHeader, Button, FormGroup, Select, Table,
    Modal, Spinner, EmptyState, Checkbox, Input
} from './CommonComponents';
import {
    upsertHealthFacility,
    listHealthFacilities,
    importHealthFacilities,
    deleteHealthFacility,
    deleteFacilitiesBatch,
    getHealthFacilityById,
    listPendingFacilitySubmissions,
    approveFacilitySubmission,
    rejectFacilitySubmission,
} from "../data.js";
import {
    GenericFacilityForm,
    IMNCIFormFields,
    EENCFormFields,
    NeonatalFormFields,
    CriticalCareFormFields,
} from './FacilityForms.jsx';
import { STATE_LOCALITIES } from "./constants.js";


// --- TABS & TITLES ---
const TABS = {
    PENDING: 'Pending Submissions',
    ALL: 'All Facilities',
    IMNCI: 'IMNCI Services',
    EENC: 'EENC Services',
    NEONATAL: 'Neonatal Care Unit',
    CRITICAL: 'Emergency & Critical Care',
};

const ARABIC_TITLES = {
    [TABS.IMNCI]: "خدمات العلاج المتكامل لأمراض الطفولة",
    [TABS.EENC]: "خدمات الرعاية الطارئة لحديثي الولادة",
    [TABS.NEONATAL]: "وحدة رعاية حديثي الولادة",
    [TABS.CRITICAL]: "الطوارئ والرعاية الحرجة",
};

// --- HELPER for Template/Download Configuration ---
const getServiceConfig = (serviceType) => {
    const baseConfig = { headers: ["ID", "الولاية", "المحلية", "اسم المؤسسة", "نوع المؤسسةالصحية", "نوع الخدمات", "Date of Visit"], dataKeys: ["id", "الولاية", "المحلية", "اسم_المؤسسة", "نوع_المؤسسةالصحية", "eenc_service_type", "date_of_visit"] };
    const baseImnciHeaders = ["هل المؤسسة تعمل", "هل توجد حوافز للاستاف", "ما هي المنظمة المقدم للحوافز", "هل تشارك المؤسسة في أي مشروع", "ما هو اسم المشروع", "رقم هاتف المسئول من المؤسسة", "وجود العلاج المتكامل لامراض الطفولة", "العدد الكلي للكوادر الطبية العاملة (أطباء ومساعدين)", "العدد الكلي للكودار المدربة על العلاج المتكامل", "وجود سجل علاج متكامل", "وجود كتيب لوحات", "ميزان وزن", "ميزان طول", "ميزان حرارة", "ساعة مؤقت", "غرفة إرواء", "وجود الدعم المادي", "_الإحداثيات_latitude", "_الإحداثيات_longitude", "هل يوجد مكتب تحصين", "اين يقع اقرب مركز تحصين", "هل يوجد مركز تغذية خارجي", "اين يقع اقرب مركز تغذية خارجي", "هل يوجد خدمة متابعة النمو"];
    const baseImnciDataKeys = ["هل_المؤسسة_تعمل", "staff_incentives", "staff_incentives_organization", "project_participation", "project_name", "person_in_charge_phone", "وجود_العلاج_المتكامل_لامراض_الطفولة", "العدد_الكلي_للكوادر_الطبية_العاملة_أطباء_ومساعدين", "العدد_الكلي_للكودار_ المدربة_على_العلاج_المتكامل", "وجود_سجل_علاج_متكامل", "وجود_كتيب_لوحات", "ميزان_وزن", "ميزان_طول", "ميزان_حرارة", "ساعة_مؤقت", "غرفة_إرواء", "وجود_الدعمادي", "_الإحداثيات_latitude", "_الإحداثيات_longitude", "immunization_office_exists", "nearest_immunization_center", "nutrition_center_exists", "nearest_nutrition_center", "growth_monitoring_service_exists"];
    const MAX_STAFF = 5;
    for (let i = 1; i <= MAX_STAFF; i++) { baseImnciHeaders.push(`اسم الكادر ${i}`, `الوصف الوظيفي للكادر ${i}`, `هل الكادر ${i} مدرب`, `تاريخ تدريب الكادر ${i}`, `رقم هاتف الكادر ${i}`); baseImnciDataKeys.push(`imnci_staff_${i}_name`, `imnci_staff_${i}_job_title`, `imnci_staff_${i}_is_trained`, `imnci_staff_${i}_training_date`, `imnci_staff_${i}_phone`); }
    const imnciConfig = { headers: baseImnciHeaders, dataKeys: baseImnciDataKeys };
    const eencConfig = { headers: ["هل تقدم الرعاية الضرورية المبكرة EENC", "عدد الكوادر الصحية المدربة", "العدد الكلي لسرير الولادة", "العدد الكلي لمحطات الانعاش", "العدد الكلي لاجهزة التدفئة", "العدد الكلي لجهاز الامبوباق", "العدد الكلي لجهاز الشفط اليدوي", "ساعة حائط", "جهاز التعقيم بالبخار", "تاريخ الزيارة لغرفة الولادة"], dataKeys: ["eenc_provides_essential_care", "eenc_trained_workers", "eenc_delivery_beds", "eenc_resuscitation_stations", "eenc_warmers", "eenc_ambu_bags", "eenc_manual_suction", "eenc_wall_clock", "eenc_steam_sterilizer", "eenc_delivery_room_visit_date"] };
    const neonatalConfig = { headers: ["Level of Care - Primary", "Level of Care - Secondary", "Level of Care - Tertiary", "وحدة رعاية الكنغر (KMC unit)", "وحدة الرضاعة الطبيعية (breastfeeding unit)", "وحدة تعقيم (sterilization unit)", "إجمالي سعة الأسرة", "العدد الكلي للحضانات (incubators)", "العدد الكلي للاسرة للاطفال مكتملي النمو (cots)", "أجهزة CPAP", "جهاز تدفئة حرارية (warmer)", "مضخة تسريب (infusion pump)", "مضخات الحقن (Syringe pump)", "جهاز شفط (suction machine)", "وحدات العلاج الضوئي (Phototherapy)", "أكياس الإنعاش (Ambu Bag)", "جهاز مراقبة التنفس والاكسجين (Pulse and oxygen Monitor)", "جهاز أكسجين (Oxygen concentrator)", "أسطوانة الاكسجين (oxygen cylinder)", "جهاز تنفس صناعي (Mechanical ventilator)", "حاضنة محمولة (Portable Incubator)", "تاريخ زيارة وحدة حديثي الولادة"], dataKeys: ["neonatal_level_of_care_primary", "neonatal_level_of_care_secondary", "neonatal_level_of_care_tertiary", "neonatal_kmc_unit", "neonatal_breastfeeding_unit", "neonatal_sterilization_unit", "neonatal_total_beds", "neonatal_total_incubators", "neonatal_total_cots", "neonatal_cpap", "neonatal_warmer", "neonatal_infusion_pump", "neonatal_syringe_pump", "neonatal_sucker", "neonatal_phototherapy", "neonatal_ambu_bag", "neonatal_respiration_monitor", "neonatal_oxygen_machine", "neonatal_oxygen_cylinder", "neonatal_mechanical_ventilator", "neonatal_portable_incubator", "neonatal_unit_visit_date"] };
    const criticalCareConfig = { headers: ["etat_has_service", "etat_trained_workers", "hdu_has_service", "hdu_bed_capacity", "picu_has_service", "picu_bed_capacity"], dataKeys: ["etat_has_service", "etat_trained_workers", "hdu_has_service", "hdu_bed_capacity", "picu_has_service", "picu_bed_capacity"] };
    let finalHeaders = [...baseConfig.headers], finalDataKeys = [...baseConfig.dataKeys], fileName = 'Facility_Template.xlsx';
    switch (serviceType) {
        case TABS.IMNCI: finalHeaders.push(...imnciConfig.headers); finalDataKeys.push(...imnciConfig.dataKeys); fileName = 'IMNCI_Template.xlsx'; break;
        case TABS.EENC: finalHeaders.push(...eencConfig.headers); finalDataKeys.push(...eencConfig.dataKeys); fileName = 'EENC_Template.xlsx'; break;
        case TABS.NEONATAL: finalHeaders.push(...eencConfig.headers, ...neonatalConfig.headers); finalDataKeys.push(...eencConfig.dataKeys, ...neonatalConfig.dataKeys); fileName = 'Neonatal_Care_Template.xlsx'; break;
        case TABS.CRITICAL: finalHeaders.push(...eencConfig.headers, ...criticalCareConfig.headers); finalDataKeys.push(...eencConfig.dataKeys, ...criticalCareConfig.dataKeys); fileName = 'Critical_Care_Template.xlsx'; break;
        default: finalHeaders.push(...imnciConfig.headers, ...eencConfig.headers, ...neonatalConfig.headers, ...criticalCareConfig.headers); finalDataKeys.push(...imnciConfig.dataKeys, ...imnciConfig.dataKeys, ...neonatalConfig.dataKeys, ...criticalCareConfig.dataKeys); fileName = 'All_Services_Template.xlsx';
    }
    return { headers: [...new Set(finalHeaders)], dataKeys: [...new Set(finalDataKeys)], fileName };
};

const LOCALITY_EN_TO_AR_MAP = Object.values(STATE_LOCALITIES).flatMap(s => s.localities).reduce((acc, loc) => {
    acc[loc.en] = loc.ar;
    return acc;
}, {});

// --- SERVICE-SPECIFIC TAB COMPONENTS ---

const AllFacilitiesTab = ({ facilities, onEdit, onDelete, onGenerateLink, selectedFacilities, onToggleSelection, onToggleAll }) => {
    const getServiceBadges = (f) => {
        const services = [];
        if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') services.push({ name: 'IMNCI', color: 'bg-sky-100 text-sky-800' });
        if (f.eenc_provides_essential_care === 'Yes') services.push({ name: 'EENC', color: 'bg-teal-100 text-teal-800' });
        if (f.neonatal_level_of_care && (f.neonatal_level_of_care.primary || f.neonatal_level_of_care.secondary || f.neonatal_level_of_care.tertiary)) services.push({ name: 'Neonatal', color: 'bg-indigo-100 text-indigo-800' });
        if (f.etat_has_service === 'Yes' || f.hdu_has_service === 'Yes' || f.picu_has_service === 'Yes') services.push({ name: 'Critical', color: 'bg-red-100 text-red-800' });
        if (services.length === 0) return <span className="text-xs text-gray-500">None</span>;
        return <div className="flex flex-wrap gap-1">{services.map(s => <span key={s.name} className={`px-2 py-1 text-xs font-medium rounded-full ${s.color}`}>{s.name}</span>)}</div>;
    };
    const getStateName = (stateKey) => STATE_LOCALITIES[stateKey]?.ar || stateKey || 'N/A';
    const getLocalityName = (stateKey, localityKey) => { if (!stateKey || !localityKey) return 'N/A'; const state = STATE_LOCALITIES[stateKey]; if (!state) return localityKey; const locality = state.localities.find(l => l.en === localityKey); return locality?.ar || localityKey; };
    const areAllSelected = facilities.length > 0 && facilities.every(f => selectedFacilities.has(f.id));

    return (
        <Table headers={[<Checkbox key="select-all" onChange={onToggleAll} checked={areAllSelected} />, '#', 'State', 'Locality', 'Facility Name', 'Facility Type', 'Functioning', 'Services Available', 'Actions']}>
            {facilities.map((f, index) => (
                <tr key={f.id}>
                    <td><Checkbox onChange={() => onToggleSelection(f.id)} checked={selectedFacilities.has(f.id)} /></td>
                    <td>{index + 1}</td><td>{getStateName(f['الولاية'])}</td><td>{getLocalityName(f['الولاية'], f['المحلية'])}</td><td>{f['اسم_المؤسسة']}</td><td>{f['نوع_المؤسسةالصحية'] || 'N/A'}</td><td>{ (f['هل_المؤسسة_تعمل'] === 'Yes' || f['هل_المؤسسة_تعمل'] === 'No') ? <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${f['هل_المؤسسة_تعمل'] === 'Yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{f['هل_المؤسسة_تعمل']}</span> : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Not Set</span> }</td><td>{getServiceBadges(f)}</td>
                    <td className="min-w-[240px]">
                        <div className="flex flex-wrap gap-2">
                            <Button variant="info" size="sm" onClick={() => onEdit(f.id)}>Edit</Button>
                            <Button variant="danger" size="sm" onClick={() => onDelete(f.id)}>Delete</Button>
                            <Button size="sm" onClick={() => onGenerateLink(f.id)}>Link</Button>
                        </div>
                    </td>
                </tr>
            ))}
        </Table>
    );
};

const IMNCIServiceTab = ({ facilities, onEdit, onDelete, onGenerateLink }) => ( <Table headers={['Facility Name', 'Total Staff', 'Trained Staff', 'Actions']}>{facilities.map(f => (<tr key={f.id}><td>{f.اسم_المؤسسة}</td><td>{f['العدد_الكلي_للكوادر_الطبية_العاملة_أطباء_ومساعدين'] || 'N/A'}</td><td>{f['العدد_الكلي_للكودار_مدربة_على_العلاج_المتكامل'] || 'N/A'}</td>
    <td className="min-w-[240px]">
        <div className="flex flex-wrap gap-2">
            <Button variant="info" onClick={() => onEdit(f.id)}>Edit</Button>
            <Button variant="danger" onClick={() => onDelete(f.id)}>Delete</Button>
            <Button onClick={() => onGenerateLink(f.id)}>Generate Link</Button>
        </div>
    </td>
</tr>))}</Table> );

const EENCServiceTab = ({ facilities, onEdit, onDelete }) => ( <Table headers={['Facility Name', 'State', 'Operational', 'Service Type', 'Trained Workers', 'Actions']}>{facilities.map(f => (<tr key={f.id}><td>{f.اسم_المؤسسة}</td><td>{f.الولاية}</td><td>{f.هل_المؤسسة_تعمل}</td><td>{f.eenc_service_type || 'N/A'}</td><td>{f.eenc_trained_workers || 'N/A'}</td>
    <td className="min-w-[180px]">
        <div className="flex flex-wrap gap-2">
            <Button variant="info" onClick={() => onEdit(f.id)}>Edit</Button>
            <Button variant="danger" onClick={() => onDelete(f.id)}>Delete</Button>
        </div>
    </td>
</tr>))}</Table> );

const NeonatalServiceTab = ({ facilities, onEdit, onDelete }) => ( <Table headers={['Facility Name', 'Level of Care', 'Total Beds', 'Incubators', 'CPAP', 'Actions']}>{facilities.map(f => { let levelOfCareDisplay = 'N/A'; const levelData = f.neonatal_level_of_care; if (typeof levelData === 'string' && levelData) { levelOfCareDisplay = levelData; } else if (typeof levelData === 'object' && levelData !== null) { const levels = []; if (levelData.primary) levels.push('Primary'); if (levelData.secondary) levels.push('Special Care'); if (levelData.tertiary) levels.push('NICU'); if (levels.length > 0) levelOfCareDisplay = levels.join(', '); } return (<tr key={f.id}><td>{f.اسم_المؤسسة}</td><td>{levelOfCareDisplay}</td><td>{f.neonatal_total_beds || 'N/A'}</td><td>{f.neonatal_total_incubators || 'N/A'}</td><td>{f.neonatal_cpap || 'N/A'}</td>
    <td className="min-w-[180px]">
        <div className="flex flex-wrap gap-2">
            <Button variant="info" onClick={() => onEdit(f.id)}>Edit</Button>
            <Button variant="danger" onClick={() => onDelete(f.id)}>Delete</Button>
        </div>
    </td>
</tr>); })}</Table> );

const CriticalCareServiceTab = ({ facilities, onEdit, onDelete }) => ( <Table headers={['Facility Name', 'Has ETAT', 'Has HDU', 'Has PICU', 'Actions']}>{facilities.map(f => (<tr key={f.id}><td>{f.اسم_المؤسسة}</td><td>{f.etat_has_service || 'No'}</td><td>{f.hdu_has_service || 'No'}</td><td>{f.picu_has_service || 'No'}</td>
    <td className="min-w-[180px]">
        <div className="flex flex-wrap gap-2">
            <Button variant="info" onClick={() => onEdit(f.id)}>Edit</Button>
            <Button variant="danger" onClick={() => onDelete(f.id)}>Delete</Button>
        </div>
    </td>
</tr>))}</Table> );

// --- MODAL & PENDING SUBMISSIONS COMPONENTS ---

const PendingSubmissionsTab = ({ submissions, onApprove, onReject }) => {
    if (!submissions || submissions.length === 0) return <EmptyState message="No pending submissions found." />;
    return <Table headers={['Submission Date', 'Facility Name', 'State', 'Locality', 'Submitted By', 'Actions']}>{submissions.map(s => <tr key={s.submissionId}><td>{s.submittedAt?.toDate ? s.submittedAt.toDate().toLocaleDateString() : 'N/A'}</td><td>{s['اسم_المؤسسة']}</td><td>{s['الولاية']}</td><td>{s['المحلية']}</td><td>{s.updated_by || 'Public Submission'}</td><td className="flex flex-wrap gap-2"><Button variant="success" size="sm" onClick={() => onApprove(s)}>View / Approve</Button><Button variant="danger" size="sm" onClick={() => onReject(s.submissionId)}>Reject</Button></td></tr>)}</Table>;
};

const MappingRow = React.memo(({ field, headers, selectedValue, onMappingChange }) => ( <div className="flex items-center"><label className="w-1/2 font-medium text-sm capitalize">{field.label}{field.key === 'اسم_المؤسسة' && '*'}</label><Select value={selectedValue || ''} onChange={(e) => onMappingChange(field.key, e.target.value)} className="flex-1"><option value="">-- Select Excel Column --</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</Select></div> ));

const BulkUploadModal = ({ isOpen, onClose, onImport, uploadStatus, activeTab, filteredData }) => {
    const [currentPage, setCurrentPage] = useState(0); const [error, setError] = useState(''); const [excelData, setExcelData] = useState([]); const [headers, setHeaders] = useState([]); const [fieldMappings, setFieldMappings] = useState({}); const [validationIssues, setValidationIssues] = useState([]); const [userCorrections, setUserCorrections] = useState({}); const fileInputRef = useRef(null); const MAX_STAFF = 5;
    useEffect(() => { if (uploadStatus.inProgress) setCurrentPage(2); else if (uploadStatus.message) setCurrentPage(3); }, [uploadStatus.inProgress, uploadStatus.message]);
    useEffect(() => { if (isOpen && !uploadStatus.inProgress && !uploadStatus.message) { setCurrentPage(0); setError(''); setExcelData([]); setHeaders([]); setFieldMappings({}); setValidationIssues([]); setUserCorrections({}); } }, [isOpen, uploadStatus.inProgress, uploadStatus.message]);
    const FIELD_LABELS = useMemo(() => ({ 'eenc_service_type': 'نوع الخدمات المقدمة', }), []);
    const allFacilityFields = useMemo(() => { if (!activeTab) return []; const config = getServiceConfig(activeTab); return [{ key: 'id', label: 'ID (for updates)' }, ...config.dataKeys.filter(key => key !== 'id').map(key => ({ key, label: FIELD_LABELS[key] || key.replace(/_/g, ' ') }))]; }, [activeTab, FIELD_LABELS]);
    const findBestMatch = (value, options) => { if (!value || !options || options.length === 0) return { match: null, isPerfect: false }; const cleanValue = String(value).trim().toLowerCase(); for (const option of options) { if (String(option).toLowerCase() === cleanValue) return { match: option, isPerfect: true }; } for (const option of options) { if (String(option).toLowerCase().includes(cleanValue) || cleanValue.includes(String(option).toLowerCase())) return { match: option, isPerfect: false }; } return { match: null, isPerfect: false }; };
    const handleFileUpload = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { try { const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, { type: 'array' }); const worksheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", cellDates: true }); if (jsonData.length < 1) { setError('Excel file appears to be empty.'); return; } setHeaders(jsonData[0].map(h => String(h).trim())); setExcelData(jsonData.slice(1)); setCurrentPage(1); setError(''); } catch (err) { setError('Error reading Excel file: ' + err.message); } }; reader.readAsArrayBuffer(file); };
    const handleDownloadTemplate = () => {
        const { headers: finalHeaders, dataKeys: finalDataKeys, fileName } = getServiceConfig(activeTab);
        let downloadFileName = `New_Facilities_${fileName}`;
        let worksheetData = [finalHeaders];

        if (filteredData && filteredData.length > 0) {
            downloadFileName = `Update_Template_For_${fileName}`;
            const rowsData = filteredData.map(facility => {
                const flatFacilityData = { ...facility };
                if (facility.imnci_staff && Array.isArray(facility.imnci_staff)) {
                    facility.imnci_staff.slice(0, MAX_STAFF).forEach((staff, index) => {
                        const i = index + 1;
                        flatFacilityData[`imnci_staff_${i}_name`] = staff.name;
                        flatFacilityData[`imnci_staff_${i}_job_title`] = staff.job_title;
                        flatFacilityData[`imnci_staff_${i}_is_trained`] = staff.is_trained || 'No';
                        flatFacilityData[`imnci_staff_${i}_training_date`] = staff.training_date;
                        flatFacilityData[`imnci_staff_${i}_phone`] = staff.phone;
                    });
                }
                if (facility.neonatal_level_of_care && typeof facility.neonatal_level_of_care === 'object') {
                    flatFacilityData.neonatal_level_of_care_primary = facility.neonatal_level_of_care.primary ? 'Yes' : 'No';
                    flatFacilityData.neonatal_level_of_care_secondary = facility.neonatal_level_of_care.secondary ? 'Yes' : 'No';
                    flatFacilityData.neonatal_level_of_care_tertiary = facility.neonatal_level_of_care.tertiary ? 'Yes' : 'No';
                }
                
                return finalDataKeys.map(key => {
                    let value = flatFacilityData[key];
                    if (value === undefined || value === null || value === '') {
                        return ''; 
                    }
                    return value;
                });
            });
            worksheetData.push(...rowsData);
        }
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facilities");
        XLSX.writeFile(workbook, downloadFileName);
    };
    const handleMappingChange = useCallback((appField, excelHeader) => { setFieldMappings(prev => { const newMappings = { ...prev }; if (excelHeader) newMappings[appField] = excelHeader; else delete newMappings[appField]; return newMappings; }); }, []);
    const normalizeBoolean = (value) => { if (value === null || value === undefined) return value; const strValue = String(value).toLowerCase().trim(); const yesValues = ['yes', 'نعم', 'توجد', 'يوجد', true]; const noValues = ['no', 'لا', 'لاتوجد', 'لا توجد', false]; if (yesValues.includes(strValue)) return 'Yes'; if (noValues.includes(strValue)) return 'No'; return value; };
    
    const handleValidation = () => {
        if (!fieldMappings['اسم_المؤسسة']) {
            setError('The "Facility Name" (اسم_المؤسسة) field must be mapped to an Excel column.');
            return;
        }
        setError('');

        const dropdownFieldsConfig = {
            'نوع_المؤسسةالصحية': ["مركز صحة الاسرة", "مستشفى ريفي", "وحدة صحة الاسرة", "مستشفى"],
            'eenc_service_type': ["CEmONC", "BEmONC", "general", "pediatric", "CEMONC", "Comprehensive EmONC", "Basic Emonc Pediatric", "General"],
            'الولاية': Object.keys(STATE_LOCALITIES),
        };
        
        const booleanLikeFields = [
            'هل_المؤسسة_تعمل', 'staff_incentives', 'project_participation', 'وجود_العلاج_المتكامل_لامراض_الطفولة',
            'وجود_سجل_علاج_متكامل', 'وجود_كتيب_لوحات', 'ميزان_وزن', 'ميزان_طول', 'ميزان_حرارة', 'ساعة_مؤقت',
            'غرفة_إرواء', 'eenc_provides_essential_care', 'eenc_steam_sterilizer', 'eenc_wall_clock',
            'etat_has_service', 'hdu_has_service', 'picu_has_service', 'neonatal_level_of_care_primary',
            'neonatal_level_of_care_secondary', 'neonatal_level_of_care_tertiary', 'neonatal_kmc_unit',
            'neonatal_breastfeeding_unit', 'neonatal_sterilization_unit', 'immunization_office_exists',
            'nutrition_center_exists', 'growth_monitoring_service_exists'
        ];

        const validBooleanOptions = ['Yes', 'No', 'yes', 'no', 'نعم', 'لا', 'توجد', 'يوجد', 'لاتوجد', 'لا توجد', true, false].map(v => String(v));
        const validJobTitles = ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];

        const issues = {};
        const allLocalitiesMasterList = Object.values(STATE_LOCALITIES).flatMap(s => s.localities.map(l => l.en));

        const mappedJobTitleFields = Object.keys(fieldMappings).filter(
            key => key.startsWith('imnci_staff_') && key.endsWith('_job_title')
        );

        const mappedIsTrainedFields = Object.keys(fieldMappings).filter(
            key => key.startsWith('imnci_staff_') && key.endsWith('_is_trained')
        );

        excelData.forEach(row => {
            // 1. Validate standard dropdowns
            Object.entries(dropdownFieldsConfig).forEach(([appField, options]) => {
                const excelHeader = fieldMappings[appField];
                if (!excelHeader) return;
                const headerIndex = headers.indexOf(excelHeader);
                const cellValue = row[headerIndex];
                if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                    const result = findBestMatch(cellValue, options);
                    if (!result.isPerfect) {
                        if (!issues[appField]) {
                            issues[appField] = { columnName: excelHeader, options: options, invalidValues: new Set() };
                        }
                        issues[appField].invalidValues.add(String(cellValue).trim());
                    }
                }
            });

            // 2. Validate all boolean-like fields
            booleanLikeFields.forEach(appField => {
                const excelHeader = fieldMappings[appField];
                if (!excelHeader) return;
                const headerIndex = headers.indexOf(excelHeader);
                const cellValue = row[headerIndex];
                if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                    const result = findBestMatch(cellValue, validBooleanOptions);
                    if (!result.isPerfect) {
                        if (!issues[appField]) {
                            issues[appField] = { columnName: excelHeader, options: ['Yes', 'No'], invalidValues: new Set() };
                        }
                        issues[appField].invalidValues.add(String(cellValue).trim());
                    }
                }
            });

            // 3. Validate staff job titles
            mappedJobTitleFields.forEach(appField => {
                const excelHeader = fieldMappings[appField];
                const headerIndex = headers.indexOf(excelHeader);
                const cellValue = row[headerIndex];
                 if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                    const result = findBestMatch(cellValue, validJobTitles);
                     if (!result.isPerfect) {
                        const issueKey = 'الوصف_الوظيفي'; 
                        if (!issues[issueKey]) {
                             issues[issueKey] = { columnName: 'Job Title Columns', options: validJobTitles, invalidValues: new Set() };
                        }
                         issues[issueKey].invalidValues.add(String(cellValue).trim());
                    }
                }
            });

            // 4. Validate staff 'is_trained' fields
            mappedIsTrainedFields.forEach(appField => {
                const excelHeader = fieldMappings[appField];
                const headerIndex = headers.indexOf(excelHeader);
                const cellValue = row[headerIndex];
                if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                    const result = findBestMatch(cellValue, validBooleanOptions);
                    if (!result.isPerfect) {
                        const issueKey = 'الكادر_مدرب';
                        if (!issues[issueKey]) {
                            issues[issueKey] = { columnName: 'Staff "Is Trained" Columns', options: ['Yes', 'No'], invalidValues: new Set() };
                        }
                        issues[issueKey].invalidValues.add(String(cellValue).trim());
                    }
                }
            });

            // 5. Validate localities against states
            const stateHeader = fieldMappings['الولاية'];
            const localityHeader = fieldMappings['المحلية'];
            if (stateHeader && localityHeader) {
                const stateHeaderIndex = headers.indexOf(stateHeader);
                const localityHeaderIndex = headers.indexOf(localityHeader);
                const stateValue = row[stateHeaderIndex];
                const localityValue = row[localityHeaderIndex];
                if (stateValue && localityValue) {
                    const stateKeyResult = findBestMatch(stateValue, Object.keys(STATE_LOCALITIES));
                    if (stateKeyResult.match) {
                        const stateKey = stateKeyResult.match;
                        const stateData = STATE_LOCALITIES[stateKey];
                        const validLocalityNames = stateData.localities.flatMap(l => [l.en, l.ar]);
                        const localityMatchResult = findBestMatch(localityValue, validLocalityNames);
                        if (!localityMatchResult.isPerfect) {
                            if (!issues['المحلية']) {
                                issues['المحلية'] = { columnName: localityHeader, options: allLocalitiesMasterList, invalidValues: new Set() };
                            }
                            issues['المحلية'].invalidValues.add(String(localityValue).trim());
                        }
                    }
                }
            }
        });

        const issuesArray = Object.values(issues).map(issue => ({ ...issue, invalidValues: Array.from(issue.invalidValues).sort() }));

        if (issuesArray.length > 0) {
            setValidationIssues(issuesArray);
            const initialCorrections = {};
            issuesArray.forEach(issue => {
                issue.invalidValues.forEach(val => {
                    const bestMatch = findBestMatch(val, issue.options);
                    if (bestMatch.match) initialCorrections[val] = bestMatch.match;
                });
            });
            setUserCorrections(initialCorrections);
            setCurrentPage('validation');
        } else {
            startImportProcess();
        }
    };

    const handleCorrectionChange = (invalidValue, correctedValue) => { setUserCorrections(prev => ({ ...prev, [invalidValue]: correctedValue })); };
    const startImportProcess = () => {
        const serviceGroups = { eenc: { dateKey: 'eenc_delivery_room_visit_date', dataKeys: getServiceConfig(TABS.EENC).dataKeys.filter(k => k.startsWith('eenc_')) }, neonatal: { dateKey: 'neonatal_unit_visit_date', dataKeys: getServiceConfig(TABS.NEONATAL).dataKeys.filter(k => k.startsWith('neonatal_')) }, critical: { dateKey: 'date_of_visit', dataKeys: getServiceConfig(TABS.CRITICAL).dataKeys.filter(k => k.startsWith('etat_') || k.startsWith('hdu_') || k.startsWith('picu_')) }, imnci: { dateKey: 'date_of_visit', dataKeys: getServiceConfig(TABS.IMNCI).dataKeys.filter(k => !k.startsWith('eenc_') && !k.startsWith('neonatal_') && !k.startsWith('etat_') && !k.startsWith('hdu_') && !k.startsWith('picu_')) } };
        const allServiceDataKeys = Object.values(serviceGroups).flatMap(g => g.dataKeys);
        let allPayloads = [];
        excelData.forEach(row => {
            const facilityFromRow = {};
            Object.entries(fieldMappings).forEach(([appFieldKey, excelHeader]) => {
                const headerIndex = headers.indexOf(excelHeader);
                if (headerIndex !== -1) {
                    let cellValue = row[headerIndex];
                    if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                        const finalValue = cellValue instanceof Date ? cellValue.toISOString().split('T')[0] : userCorrections[String(cellValue).trim()] ?? cellValue;
                        facilityFromRow[appFieldKey] = finalValue;
                    }
                }
            });

            if (!facilityFromRow['اسم_المؤسسة']) return;
            const commonData = Object.keys(facilityFromRow).filter(key => !allServiceDataKeys.includes(key)).reduce((obj, key) => { obj[key] = facilityFromRow[key]; return obj; }, {});
            const payloadsByDate = new Map();
            Object.values(serviceGroups).forEach(group => { const visitDate = facilityFromRow[group.dateKey]; if (visitDate) { const serviceDataForDate = group.dataKeys.reduce((obj, key) => { if (facilityFromRow[key] !== undefined) obj[key] = facilityFromRow[key]; return obj; }, {}); if (Object.keys(serviceDataForDate).length > 0) { const existingPayload = payloadsByDate.get(visitDate) || { ...commonData }; const updatedPayload = { ...existingPayload, ...serviceDataForDate, date_of_visit: visitDate }; payloadsByDate.set(visitDate, updatedPayload); } } });
            if (payloadsByDate.size === 0) { const defaultDate = facilityFromRow['date_of_visit'] || new Date().toISOString().split('T')[0]; payloadsByDate.set(defaultDate, { ...facilityFromRow, date_of_visit: defaultDate }); }
            allPayloads.push(...Array.from(payloadsByDate.values()));
        });
        const booleanFields = ['هل_المؤسسة_تعمل', 'staff_incentives', 'project_participation', 'وجود_العلاج_المتكامل_لامراض_الطفولة', 'وجود_سجل_علاج_متكامل', 'وجود_كتيب_لوحات', 'ميزان_وزن', 'ميزان_طول', 'ميزان_حرارة', 'ساعة_مؤقت', 'غرفة_إرواء', 'eenc_provides_essential_care', 'eenc_steam_sterilizer', 'eenc_wall_clock', 'etat_has_service', 'hdu_has_service', 'picu_has_service', 'neonatal_level_of_care_primary', 'neonatal_level_of_care_secondary', 'neonatal_level_of_care_tertiary', 'neonatal_kmc_unit', 'neonatal_breastfeeding_unit', 'neonatal_sterilization_unit', 'immunization_office_exists', 'nutrition_center_exists', 'growth_monitoring_service_exists'];
        const serviceTypeNormalizationMap = { 'comprehensive emonc': 'CEmONC', 'cemonc': 'CEmONC', 'basic emonc pediatric': 'BEmONC', 'bemoc': 'BEmONC', 'general': 'general', 'pediatric': 'pediatric' };
        const auth = getAuth(); const user = auth.currentUser; const uploadTimestamp = new Date().toISOString(); let uploaderIdentifier = user ? (user.displayName || user.email) : 'Unknown Uploader';
        const processedFacilities = allPayloads.map(payload => {
            const newFacility = { ...payload }; newFacility.updated_by = uploaderIdentifier; newFacility['اخر تحديث'] = uploadTimestamp; if (newFacility.eenc_service_type) { const lowerValue = String(newFacility.eenc_service_type).toLowerCase().trim(); newFacility.eenc_service_type = serviceTypeNormalizationMap[lowerValue] || newFacility.eenc_service_type; }
            for (const field of booleanFields) { if (newFacility.hasOwnProperty(field)) newFacility[field] = normalizeBoolean(newFacility[field]); }
            const staffList = []; for (let i = 1; i <= MAX_STAFF; i++) { if (newFacility[`imnci_staff_${i}_name`]) { staffList.push({ name: newFacility[`imnci_staff_${i}_name`], job_title: newFacility[`imnci_staff_${i}_job_title`] || '', is_trained: normalizeBoolean(newFacility[`imnci_staff_${i}_is_trained`]) || 'No', training_date: newFacility[`imnci_staff_${i}_training_date`] || '', phone: newFacility[`imnci_staff_${i}_phone`] || '' }); } delete newFacility[`imnci_staff_${i}_name`]; delete newFacility[`imnci_staff_${i}_job_title`]; delete newFacility[`imnci_staff_${i}_is_trained`]; delete newFacility[`imnci_staff_${i}_training_date`]; delete newFacility[`imnci_staff_${i}_phone`]; }
            if (staffList.length > 0) newFacility.imnci_staff = staffList;
            const key1 = 'neonatal_level_of_care_primary', key2 = 'neonatal_level_of_care_secondary', key3 = 'neonatal_level_of_care_tertiary'; if (newFacility[key1] || newFacility[key2] || newFacility[key3]) { newFacility.neonatal_level_of_care = { primary: newFacility[key1] === 'Yes', secondary: newFacility[key2] === 'Yes', tertiary: newFacility[key3] === 'Yes', }; } delete newFacility[key1]; delete newFacility[key2]; delete newFacility[key3];
            return newFacility;
        });
        if (processedFacilities.length === 0) { setError('No valid facilities with a name were found after mapping and filtering.'); setCurrentPage(1); return; }
        onImport(processedFacilities);
    };
    const renderPreview = () => (excelData.length === 0) ? null : (<div className="mt-4 overflow-auto max-h-60"><h4 className="font-medium mb-2">Data Preview (first 5 rows)</h4><table className="min-w-full border border-gray-200"><thead><tr className="bg-gray-100">{headers.map((header, idx) => <th key={idx} className="border border-gray-300 p-2 text-left text-xs">{header}</th>)}</tr></thead><tbody>{excelData.slice(0, 5).map((row, rowIdx) => <tr key={rowIdx}>{row.map((cell, cellIdx) => <td key={cellIdx} className="border border-gray-300 p-2 text-xs">{cell instanceof Date ? cell.toLocaleDateString() : cell}</td>)}</tr>)}</tbody></table></div>);
    const renderValidationScreen = () => { const allCorrectionsMade = validationIssues.every(issue => issue.invalidValues.every(val => userCorrections[val])); return (<div><h4 className="font-medium text-lg mb-2">Review Data Mismatches</h4><p className="text-sm text-gray-600 mb-4">Some values in your file don't match the expected options. Please map your values to the correct ones.</p><div className="space-y-4 max-h-96 overflow-y-auto p-2 border rounded bg-gray-50">{validationIssues.map(issue => (<div key={issue.columnName}><h5 className="font-semibold text-gray-800">Mismatches for Column: <span className="font-bold">"{issue.columnName}"</span></h5>{issue.invalidValues.map(val => (<div key={val} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 mt-2 p-2 bg-white rounded border"><span className="bg-red-50 text-red-800 p-2 rounded text-sm truncate" title={val}>Your value: "{val}"</span><span className="text-center font-bold text-gray-500 hidden md:block">&rarr;</span><Select value={userCorrections[val] || ''} onChange={(e) => handleCorrectionChange(val, e.target.value)}><option value="">-- Choose correct option --</option>{issue.options.map(opt => <option key={opt} value={opt}>{STATE_LOCALITIES[opt]?.ar || opt}</option>)}</Select></div>))}</div>))}</div><div className="flex justify-end mt-6 space-x-2"><Button variant="secondary" onClick={() => setCurrentPage(1)}>Back to Mapping</Button><Button onClick={startImportProcess} disabled={!allCorrectionsMade}>Apply and Import</Button></div>{!allCorrectionsMade && <p className="text-right text-sm text-red-600 mt-2">Please resolve all mismatches.</p>}</div>); };
    const renderProgressView = () => (<div><h4 className="font-medium text-lg mb-2">Import in Progress...</h4><p className="text-sm text-gray-600 mb-4">Please wait while the facilities are being uploaded.</p><div className="w-full bg-gray-200 rounded-full h-4"><div className="bg-blue-600 h-4 rounded-full transition-all duration-500" style={{ width: `${uploadStatus.total > 0 ? (uploadStatus.processed / uploadStatus.total) * 100 : 0}%` }}></div></div><p className="text-center mt-2 font-medium">{uploadStatus.processed} / {uploadStatus.total}</p></div>);
    const renderResultView = () => (<div><h4 className="font-medium text-lg mb-2">Import Complete</h4><div className="bg-gray-50 p-4 rounded-md"><p className="font-semibold whitespace-pre-wrap">{uploadStatus.message}</p>{uploadStatus.errors && uploadStatus.errors.length > 0 && (<div className="mt-4 max-h-40 overflow-y-auto"><h5 className="font-semibold text-red-700">Errors encountered:</h5><ul className="list-disc list-inside text-sm text-red-600">{uploadStatus.errors.map((err, index) => <li key={index}>{err.toString()}</li>)}</ul></div>)}</div><div className="flex justify-end mt-6"><Button onClick={onClose}>Close</Button></div></div>);
    return (<Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload"><div className="p-4">{error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}{currentPage === 0 && (<div><p className="mb-4">Download the template to get started. If you have filtered the facility list, the template will be pre-filled for easy updates.</p><Button variant="secondary" onClick={handleDownloadTemplate} className="mb-4">Download Template</Button><hr className="my-4"/><p className="mb-2">Or, upload your own Excel file (first row must be headers).</p><input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} ref={fileInputRef} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/></div>)}{currentPage === 1 && (<div><h4 className="font-medium mb-4">Map Excel columns to application fields</h4><p className="text-sm text-gray-600 mb-4">Match the columns from your Excel file to the application fields. To update existing records, ensure the 'ID' field is correctly mapped.</p><div className="grid grid-cols-2 gap-3 mb-4 max-h-80 overflow-y-auto p-2 border rounded">{allFacilityFields.map(field => <MappingRow key={field.key} field={field} headers={headers} selectedValue={fieldMappings[field.key]} onMappingChange={handleMappingChange}/>)}</div>{renderPreview()}<div className="flex justify-end mt-6 space-x-2"><Button variant="secondary" onClick={() => setCurrentPage(0)}>Back</Button><Button onClick={handleValidation}>Validate and Continue</Button></div></div>)}{currentPage === 'validation' && renderValidationScreen()}{currentPage === 2 && renderProgressView()}{currentPage === 3 && renderResultView()}</div></Modal>);
};

const DuplicateFinderModal = ({ isOpen, onClose, facilities, onDuplicatesDeleted }) => {
    const [isLoading, setIsLoading] = useState(false); const [duplicateGroups, setDuplicateGroups] = useState([]); const [selectedGroups, setSelectedGroups] = useState({});
    const findDuplicates = useCallback(() => { setIsLoading(true); const groups = new Map(); facilities.forEach(facility => { const key = `${facility['الولاية'] || 'N/A'}-${facility['المحلية'] || 'N/A'}-${facility['اسم_المؤسسة'] || 'N/A'}`.toLowerCase(); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(facility); }); const foundDuplicates = []; groups.forEach((group, key) => { if (group.length > 1) { group.sort((a, b) => (b.lastSnapshotAt?.toMillis() || 0) - (a.lastSnapshotAt?.toMillis() || 0)); foundDuplicates.push({ key, original: group[0], duplicates: group.slice(1) }); } }); setDuplicateGroups(foundDuplicates); const initialSelection = {}; foundDuplicates.forEach(group => { initialSelection[group.key] = true; }); setSelectedGroups(initialSelection); setIsLoading(false); }, [facilities]);
    useEffect(() => { if (isOpen) findDuplicates(); else { setDuplicateGroups([]); setSelectedGroups({}); } }, [isOpen, findDuplicates]);
    const handleSelectionChange = (key) => { setSelectedGroups(prev => ({ ...prev, [key]: !prev[key] })); };
    const handleDeleteSelected = async () => {
        const idsToDelete = []; duplicateGroups.forEach(group => { if (selectedGroups[group.key]) group.duplicates.forEach(d => idsToDelete.push(d.id)); });
        if (idsToDelete.length === 0) { alert("No duplicates selected for deletion."); return; }
        if (window.confirm(`Are you sure you want to permanently delete ${idsToDelete.length} duplicate records?`)) { try { await deleteFacilitiesBatch(idsToDelete); alert(`${idsToDelete.length} duplicates deleted successfully.`); onDuplicatesDeleted(); onClose(); } catch (error) { alert(`Failed to delete duplicates: ${error.message}`); } }
    };
    const totalDuplicates = duplicateGroups.reduce((acc, group) => acc + group.duplicates.length, 0);
    return (<Modal isOpen={isOpen} onClose={onClose} title="Find & Fix Duplicates"><div className="p-4">{isLoading && <div className="text-center"><Spinner /></div>}{!isLoading && duplicateGroups.length === 0 && <EmptyState message="No duplicate facilities found." />}{!isLoading && duplicateGroups.length > 0 && (<div><p className="mb-4 text-sm text-gray-700">Found <strong>{totalDuplicates}</strong> duplicate records across <strong>{duplicateGroups.length}</strong> groups. Uncheck any group you do not want to clean up.</p><div className="space-y-4 max-h-96 overflow-y-auto p-2 border rounded">{duplicateGroups.map(group => (<div key={group.key} className="p-3 border rounded-md bg-gray-50"><div className="flex items-center justify-between mb-2"><h4 className="font-bold text-gray-800">{group.original['اسم_المؤسسة']}<span className="text-sm font-normal text-gray-500 ml-2">({group.original['الولاية']} / {group.original['المحلية']})</span></h4><Checkbox label="Clean up" checked={!!selectedGroups[group.key]} onChange={() => handleSelectionChange(group.key)}/></div><div className="text-xs space-y-1"><p className="p-1 rounded bg-green-100 text-green-800"><strong>Keep (Original):</strong> ID {group.original.id} <span className="text-gray-600 italic ml-2"> (Last updated: {group.original.lastSnapshotAt?.toDate().toLocaleString() || 'N/A'})</span></p>{group.duplicates.map(dup => <p key={dup.id} className="p-1 rounded bg-red-100 text-red-800"><strong>Delete (Duplicate):</strong> ID {dup.id}<span className="text-gray-600 italic ml-2"> (Last updated: {dup.lastSnapshotAt?.toDate().toLocaleString() || 'N/A'})</span></p>)}</div></div>))}</div><div className="flex justify-end mt-6"><Button variant="danger" onClick={handleDeleteSelected}>Delete Selected ({Object.values(selectedGroups).filter(Boolean).length})</Button></div></div>)}</div></Modal>);
};

const DataCleanupModal = ({ isOpen, onClose, facilities, onCleanupComplete, setToast, cleanupConfig }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedFieldKey, setSelectedFieldKey] = useState('');
    const [nonStandardValues, setNonStandardValues] = useState([]);
    const [mappings, setMappings] = useState({});
    const auth = getAuth();

    // Reset state when modal is opened/closed or field changes
    useEffect(() => {
        if (!isOpen) {
            setSelectedFieldKey('');
        }
        setNonStandardValues([]);
        setMappings({});
    }, [isOpen]);

    useEffect(() => {
        if (selectedFieldKey) {
            setIsLoading(true);
            const config = cleanupConfig[selectedFieldKey];
            const values = new Set();
            facilities.forEach(facility => {
                if (config.isStaffField && Array.isArray(facility.imnci_staff)) {
                    facility.imnci_staff.forEach(staff => {
                        const value = staff[selectedFieldKey];
                        if (value && !config.standardValues.includes(value)) {
                            values.add(value);
                        }
                    });
                } else if (!config.isStaffField) {
                    const value = facility[selectedFieldKey];
                    if (value && !config.standardValues.includes(value)) {
                        values.add(value);
                    }
                }
            });
            setNonStandardValues(Array.from(values).sort());
            setMappings({});
            setIsLoading(false);
        }
    }, [selectedFieldKey, facilities, cleanupConfig]);

    const handleMappingChange = (oldValue, newValue) => {
        setMappings(prev => ({ ...prev, [oldValue]: newValue }));
    };

    const handleApplyFixes = async () => {
        const user = auth.currentUser;
        if (!user) {
            setToast({ show: true, message: 'You must be logged in to perform this action.', type: 'error' });
            return;
        }
        
        const config = cleanupConfig[selectedFieldKey];

        const facilitiesToUpdate = facilities.filter(f => {
            if (config.isStaffField) {
                return f.imnci_staff?.some(staff => Object.keys(mappings).includes(staff[selectedFieldKey]));
            } else {
                return Object.keys(mappings).includes(f[selectedFieldKey]);
            }
        });

        if (facilitiesToUpdate.length === 0) {
            setToast({ show: true, message: 'No changes to apply.', type: 'info' });
            onClose();
            return;
        }

        setIsUpdating(true);
        const updatePromises = [];
        const today = new Date().toISOString().split('T')[0];
        const updaterIdentifier = user.displayName ? `${user.displayName} (${user.email})` : user.email;

        for (const facility of facilitiesToUpdate) {
            let payload;
            if (config.isStaffField) {
                const updatedStaff = facility.imnci_staff.map(staff => ({
                    ...staff,
                    [selectedFieldKey]: mappings[staff[selectedFieldKey]] || staff[selectedFieldKey],
                }));
                payload = { ...facility, imnci_staff: updatedStaff };
            } else {
                payload = { ...facility, [selectedFieldKey]: mappings[facility[selectedFieldKey]] || facility[selectedFieldKey] };
            }
            
            const finalPayload = {
                ...payload,
                date_of_visit: today, // Create a new snapshot for today
                updated_by: `Cleaned by ${updaterIdentifier}`,
            };
            
            updatePromises.push(upsertHealthFacility(finalPayload));
        }

        try {
            await Promise.all(updatePromises);
            setToast({ show: true, message: `${facilitiesToUpdate.length} facilities updated successfully for field "${config.label}".`, type: 'success' });
            onCleanupComplete();
        } catch (error) {
            setToast({ show: true, message: `An error occurred: ${error.message}`, type: 'error' });
        } finally {
            setIsUpdating(false);
            onClose();
        }
    };
    
    const renderSelectionScreen = () => (
        <div>
            <FormGroup label="Select a data field to clean">
                <Select value={selectedFieldKey} onChange={(e) => setSelectedFieldKey(e.target.value)}>
                    <option value="">-- Choose field --</option>
                    {Object.entries(cleanupConfig).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </Select>
            </FormGroup>
        </div>
    );

    const renderMappingScreen = () => {
        const config = cleanupConfig[selectedFieldKey];
        return (
            <div>
                {isLoading && <div className="text-center"><Spinner /></div>}
                {!isLoading && nonStandardValues.length === 0 && (
                    <EmptyState message={`All values for "${config.label}" are already standardized.`} />
                )}
                {!isLoading && nonStandardValues.length > 0 && (
                    <div>
                        <p className="mb-4 text-sm text-gray-700">
                            Found <strong>{nonStandardValues.length}</strong> non-standard value(s) for <strong>{config.label}</strong>. Map them to a standard value to clean up your data.
                        </p>
                        <div className="space-y-3 max-h-80 overflow-y-auto p-2 border rounded bg-gray-50">
                            {nonStandardValues.map(value => (
                                <div key={value} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 p-2 bg-white rounded border">
                                    <span className="bg-yellow-50 text-yellow-800 p-2 rounded text-sm truncate" title={value}>
                                        Current: "{value}"
                                    </span>
                                    <span className="text-center font-bold text-gray-500 hidden md:block">&rarr;</span>
                                    <Select value={mappings[value] || ''} onChange={(e) => handleMappingChange(value, e.target.value)}>
                                        <option value="">-- Map to standard value --</option>
                                        {config.standardValues.map(opt => {
                                            let displayValue = opt;
                                            if (selectedFieldKey === 'الولاية') {
                                                displayValue = STATE_LOCALITIES[opt]?.ar || opt;
                                            } else if (selectedFieldKey === 'المحلية') {
                                                displayValue = LOCALITY_EN_TO_AR_MAP[opt] || opt;
                                            }
                                            return <option key={opt} value={opt}>{displayValue}</option>;
                                        })}
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center mt-6">
                    <Button variant="secondary" onClick={() => setSelectedFieldKey('')}>Back to Selection</Button>
                    <Button onClick={handleApplyFixes} disabled={isUpdating || Object.keys(mappings).length === 0 || nonStandardValues.length === 0}>
                        {isUpdating ? 'Applying Fixes...' : `Apply Fixes for ${Object.keys(mappings).length} Value(s)`}
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Clean Facility Data">
            <div className="p-4">
                {!selectedFieldKey ? renderSelectionScreen() : renderMappingScreen()}
            </div>
        </Modal>
    );
};


// --- MAIN COMPONENT ---

const ChildHealthServicesView = ({ permissions, setToast }) => {
    const [healthFacilities, setHealthFacilities] = useState([]); const [editingFacility, setEditingFacility] = useState(null); const [view, setView] = useState('list'); const [activeTab, setActiveTab] = useState(TABS.ALL); const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false); const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false); const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false); const [isLoading, setIsLoading] = useState(true); const [stateFilter, setStateFilter] = useState(''); const [localityFilter, setLocalityFilter] = useState(''); const [facilityTypeFilter, setFacilityTypeFilter] = useState(''); const [functioningFilter, setFunctioningFilter] = useState(''); const [pendingSubmissions, setPendingSubmissions] = useState([]); const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true); const [uploadStatus, setUploadStatus] = useState({ inProgress: false, processed: 0, total: 0, errors: [], message: '' }); const [submissionForReview, setSubmissionForReview] = useState(null); const [searchQuery, setSearchQuery] = useState(''); const [selectedFacilities, setSelectedFacilities] = useState(new Set()); const [pendingStartDate, setPendingStartDate] = useState(''); const [pendingEndDate, setPendingEndDate] = useState(''); const [projectFilter, setProjectFilter] = useState('');
    const auth = getAuth();

    const CLEANABLE_FIELDS_CONFIG = {
        'الولاية': { label: 'State', standardValues: Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)), isStaffField: false },
        'المحلية': { label: 'Locality', standardValues: Object.values(STATE_LOCALITIES).flatMap(s => s.localities.map(l => l.en)).sort((a, b) => (LOCALITY_EN_TO_AR_MAP[a] || a).localeCompare(LOCALITY_EN_TO_AR_MAP[b] || b)), isStaffField: false },
        'job_title': { label: 'Staff Job Title', standardValues: ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"], isStaffField: true },
        'نوع_المؤسسةالصحية': { label: 'Facility Type', standardValues: ["مركز صحة الاسرة", "مستشفى ريفي", "وحدة صحة الاسرة", "مستشفى"], isStaffField: false },
        'eenc_service_type': { label: 'Service Type', standardValues: ["CEmONC", "BEmONC", "general", "pediatric"], isStaffField: false },
        'هل_المؤسسة_تعمل': { label: 'Is Facility Functioning', standardValues: ['Yes', 'No'], isStaffField: false },
        'staff_incentives': { label: 'Staff Incentives', standardValues: ['Yes', 'No'], isStaffField: false },
        'project_participation': { label: 'Project Participation', standardValues: ['Yes', 'No'], isStaffField: false },
        'وجود_العلاج_المتكامل_لامراض_الطفولة': { label: 'IMNCI Service Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'وجود_سجل_علاج_متكامل': { label: 'IMNCI Register Availability (السجلات)', standardValues: ['Yes', 'No'], isStaffField: false },
        'وجود_كتيب_لوحات': { label: 'Chart Booklet Availability (كتيب اللوحات)', standardValues: ['Yes', 'No'], isStaffField: false },
        'ميزان_وزن': { label: 'Weight Scale Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'ميزان_طول': { label: 'Height Scale Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'ميزان_حرارة': { label: 'Thermometer Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'ساعة_مؤقت': { label: 'Timer Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'غرفة_إرواء': { label: 'ORS Corner Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'eenc_provides_essential_care': { label: 'EENC Service Provided', standardValues: ['Yes', 'No'], isStaffField: false },
    };

    const refreshHealthFacilities = async () => { setIsLoading(true); try { const facilities = await listHealthFacilities(); setHealthFacilities(facilities); } catch (error) { setToast({ show: true, message: "Failed to load facilities.", type: "error" }); } finally { setIsLoading(false); } };
    const refreshSubmissions = async () => { if (!permissions.canManageHealthFacilities) return; setIsSubmissionsLoading(true); try { const subs = await listPendingFacilitySubmissions(); setPendingSubmissions(subs); } catch (error) { setToast({ show: true, message: "Failed to load pending submissions.", type: "error" }); } finally { setIsSubmissionsLoading(false); } };
    useEffect(() => { if (view === 'list') { refreshHealthFacilities(); refreshSubmissions(); } }, [view]);

    const projectNames = useMemo(() => {
        const names = new Set();
        healthFacilities.forEach(f => {
            if (f.project_name) {
                names.add(f.project_name);
            }
        });
        return Array.from(names).sort();
    }, [healthFacilities]);

    const uniquePendingSubmissions = useMemo(() => {
        if (!pendingSubmissions || pendingSubmissions.length === 0) return [];
    
        const submissionsMap = new Map();
        const sortedSubmissions = [...pendingSubmissions].sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));
        
        for (const submission of sortedSubmissions) {
            const name = String(submission['اسم_المؤسسة'] || '').trim().toLowerCase() || 'no-name';
            const state = submission['الولاية'] || 'no-state';
            const locality = submission['المحلية'] || 'no-locality';
            const key = `${state}-${locality}-${name}`;
            if (!submissionsMap.has(key)) {
                submissionsMap.set(key, submission);
            }
        }

        let finalSubmissions = Array.from(submissionsMap.values());

        // Filter by date range
        if (pendingStartDate || pendingEndDate) {
            finalSubmissions = finalSubmissions.filter(s => {
                const submissionDate = s.submittedAt?.toDate();
                if (!submissionDate) return false;

                const start = pendingStartDate ? new Date(pendingStartDate) : null;
                const end = pendingEndDate ? new Date(pendingEndDate) : null;
                
                if (start) start.setHours(0, 0, 0, 0);
                if (end) end.setHours(23, 59, 59, 999);

                if (start && submissionDate < start) return false;
                if (end && submissionDate > end) return false;
                
                return true;
            });
        }
    
        return finalSubmissions;
    }, [pendingSubmissions, pendingStartDate, pendingEndDate]);

    const filteredFacilities = useMemo(() => { 
        if (!healthFacilities) return []; 
        let facilities = healthFacilities.filter(f => { 
            const matchesState = !stateFilter ? true : stateFilter === 'NOT_ASSIGNED' ? (!f['الولاية'] || !STATE_LOCALITIES[f['الولاية']]) : f['الولاية'] === stateFilter; 
            const matchesLocality = localityFilter ? f['المحلية'] === localityFilter : true; 
            const matchesFacilityType = facilityTypeFilter ? f['نوع_المؤسسةالصحية'] === facilityTypeFilter : true; 
            let matchesFunctioning = true; 
            if (functioningFilter === 'Yes') matchesFunctioning = f['هل_المؤسسة_تعمل'] === 'Yes'; 
            else if (functioningFilter === 'No') matchesFunctioning = f['هل_المؤسسة_تعمل'] === 'No'; 
            else if (functioningFilter === 'NOT_SET') matchesFunctioning = f['هل_المؤسسة_تعمل'] == null || f['هل_المؤسسة_تعمل'] === '';
            
            const matchesSearch = searchQuery ? String(f['اسم_المؤسسة'] || '').toLowerCase().includes(searchQuery.toLowerCase()) : true;
            
            const matchesProject = projectFilter ? f.project_name === projectFilter : true;

            return matchesState && matchesLocality && matchesFacilityType && matchesFunctioning && matchesSearch && matchesProject; 
        });

        switch (activeTab) { 
            case TABS.IMNCI: return facilities.filter(f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes'); 
            case TABS.EENC: return facilities.filter(f => f.eenc_provides_essential_care === 'Yes'); 
            case TABS.NEONATAL: return facilities.filter(f => f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary); 
            case TABS.CRITICAL: return facilities.filter(f => f.etat_has_service === 'Yes' || f.hdu_has_service === 'Yes' || f.picu_has_service === 'Yes'); 
            default: return facilities; 
        } 
    }, [healthFacilities, stateFilter, localityFilter, facilityTypeFilter, functioningFilter, activeTab, searchQuery, projectFilter]);
    
    const handleStateChange = (e) => { setStateFilter(e.target.value); setLocalityFilter(''); };
    const handleSaveFacility = async (payload) => { await upsertHealthFacility({ ...payload, id: editingFacility?.id }); setEditingFacility(null); setView('list'); await refreshHealthFacilities(); };
    const handleEditFacility = async (facilityId) => { const facility = await getHealthFacilityById(facilityId); if (facility) { setEditingFacility(facility); setView('form'); } else { setToast({ show: true, message: 'Facility not found.', type: 'error' }); } };
    const handleDeleteFacility = async (facilityId) => { if (window.confirm('Are you sure you want to delete this facility?')) { try { await deleteHealthFacility(facilityId); setToast({ show: true, message: 'Facility deleted.', type: 'success' }); await refreshHealthFacilities(); } catch (error) { setToast({ show: true, message: 'Failed to delete facility.', type: 'error' }); } } };
    
    const handleToggleSelection = (facilityId) => {
        setSelectedFacilities(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(facilityId)) {
                newSelection.delete(facilityId);
            } else {
                newSelection.add(facilityId);
            }
            return newSelection;
        });
    };

    const handleToggleAll = () => {
        setSelectedFacilities(prev => {
            const currentIds = new Set(filteredFacilities.map(f => f.id));
            const areAllSelected = filteredFacilities.length > 0 && filteredFacilities.every(f => prev.has(f.id));
            
            if (areAllSelected) {
                // Deselect all visible
                return new Set([...prev].filter(id => !currentIds.has(id)));
            } else {
                // Select all visible
                return new Set([...prev, ...currentIds]);
            }
        });
    };

    const handleDeleteSelected = async () => {
        const idsToDelete = Array.from(selectedFacilities);
        if (idsToDelete.length === 0) {
            setToast({ show: true, message: 'No facilities selected.', type: 'info' });
            return;
        }
        const confirmMessage = `Are you sure you want to delete the ${idsToDelete.length} selected facilities? This action cannot be undone.`;
        if (window.confirm(confirmMessage)) {
            try {
                await deleteFacilitiesBatch(idsToDelete);
                setToast({ show: true, message: `${idsToDelete.length} facilities deleted.`, type: 'success' });
                setSelectedFacilities(new Set());
                await refreshHealthFacilities();
            } catch (error) {
                setToast({ show: true, message: `Failed to delete facilities: ${error.message}`, type: 'error' });
            }
        }
    };
    
    const handleImport = async (data) => {
        setUploadStatus({ inProgress: true, processed: 0, total: data.length, errors: [], message: '' });
        const onProgress = (processedCount, error) => {
            setUploadStatus(prev => ({ ...prev, processed: processedCount, errors: error ? [...prev.errors, error] : prev.errors, }));
        };
        try {
            const result = await importHealthFacilities(data, onProgress);

            let summaryParts = [];
            let detailParts = [];

            if (result.createdFacilities && result.createdFacilities.length > 0) {
                const count = result.createdFacilities.length;
                summaryParts.push(`${count} new facilit${count > 1 ? 'ies were' : 'y was'} added`);
                detailParts.push(`Facilities Added (Snapshot Created):\n- ${result.createdFacilities.map(f => f['اسم_المؤسسة']).join('\n- ')}`);
            }

            if (result.updatedFacilities && result.updatedFacilities.length > 0) {
                const count = result.updatedFacilities.length;
                summaryParts.push(`${count} existing facilit${count > 1 ? 'ies were' : 'y was'} updated`);
                detailParts.push(`Facilities Updated (Snapshot Created):\n- ${result.updatedFacilities.map(f => f['اسم_المؤسسة']).join('\n- ')}`);
            }

            let finalMessage;
            if (summaryParts.length > 0) {
                finalMessage = `Import successful. ${summaryParts.join(' and ')}.\n\n${detailParts.join('\n\n')}`;
            } else {
                finalMessage = "Import complete. No new information was found to add or update as all data matched existing records.";
            }

            const finalErrors = result.errors || [];
            if (finalErrors.length > 0) {
                finalMessage += `\n\nHowever, ${finalErrors.length} error(s) occurred during the process.`;
            }

            setUploadStatus(prev => ({ ...prev, inProgress: false, message: finalMessage, errors: finalErrors, }));
            await refreshHealthFacilities();
        } catch (error) {
            setUploadStatus({ inProgress: false, processed: 0, total: data.length, errors: [], message: `A critical error occurred: ${error.message}` });
        }
    };
    
    const handleConfirmApproval = async (submissionData) => {
        if (!window.confirm(`Approve this submission for "${submissionData['اسم_المؤسسة']}"?`)) {
            return;
        }
        try {
            const existingFacility = healthFacilities.find(f =>
                String(f['اسم_المؤسسة'] || '').trim().toLowerCase() === String(submissionData['اسم_المؤسسة'] || '').trim().toLowerCase() &&
                f['الولاية'] === submissionData['الولاية'] &&
                f['المحلية'] === submissionData['المحلية']
            );

            const payloadForApproval = { ...submissionData };
            if (existingFacility) {
                payloadForApproval.id = existingFacility.id;
            }

            await approveFacilitySubmission(payloadForApproval, auth.currentUser?.email || 'Unknown');
            setToast({
                show: true,
                message: existingFacility ? 'Submission approved and existing facility updated.' : 'Submission approved and new facility created.',
                type: 'success'
            });

            setSubmissionForReview(null);
            await refreshSubmissions();
            await refreshHealthFacilities();
        } catch (error) {
            setToast({ show: true, message: `Approval failed: ${error.message}`, type: 'error' });
        }
    };

    const handleReject = async (submissionId) => {
        if (window.confirm('Reject this submission? This action cannot be undone.')) {
            try {
                await rejectFacilitySubmission(submissionId, auth.currentUser?.email || 'Unknown');
                setToast({ show: true, message: 'Submission rejected.', type: 'success' });
                await refreshSubmissions();
            } catch (error) {
                setToast({ show: true, message: `Rejection failed: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleGenerateLink = (facilityId) => {
        const link = `${window.location.origin}/facilities/data-entry/${facilityId}`;
        navigator.clipboard.writeText(link).then(
            () => setToast({ show: true, message: "Link copied to clipboard.", type: "success" }),
            () => setToast({ show: true, message: "Failed to copy link.", type: "error" })
        );
    };

    const handleShareLink = () => {
        const baseUrl = `${window.location.origin}/facilities/data-entry/new`;
        const params = new URLSearchParams();
        if (stateFilter) params.append('state', stateFilter);
        if (localityFilter) params.append('locality', localityFilter);
        let formTypeKey = 'imnci';
        if (activeTab === TABS.EENC) formTypeKey = 'eenc';
        else if (activeTab === TABS.NEONATAL) formTypeKey = 'neonatal';
        else if (activeTab === TABS.CRITICAL) formTypeKey = 'critical';
        params.append('formType', formTypeKey);
        const finalUrl = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
        navigator.clipboard.writeText(finalUrl).then(
            () => setToast({ show: true, message: "Prefilled link copied.", type: "success" }),
            () => setToast({ show: true, message: "Failed to copy link.", type: "error" })
        );
    };

    const handleExportExcel = () => {
        if (filteredFacilities.length === 0) {
            setToast({ show: true, message: "No data to export.", type: "info" });
            return;
        }
        const { headers: allHeaders, dataKeys: allDataKeys } = getServiceConfig('all');
        const MAX_STAFF_EXPORT = 5;
        
        const rowsData = filteredFacilities.map(facility => {
            const flatFacilityData = { ...facility };
            if (facility.imnci_staff && Array.isArray(facility.imnci_staff)) {
                facility.imnci_staff.slice(0, MAX_STAFF_EXPORT).forEach((staff, index) => {
                    const i = index + 1;
                    flatFacilityData[`imnci_staff_${i}_name`] = staff.name;
                    flatFacilityData[`imnci_staff_${i}_job_title`] = staff.job_title;
                    flatFacilityData[`imnci_staff_${i}_is_trained`] = staff.is_trained || 'No';
                    flatFacilityData[`imnci_staff_${i}_training_date`] = staff.training_date;
                    flatFacilityData[`imnci_staff_${i}_phone`] = staff.phone;
                });
            }
            if (facility.neonatal_level_of_care && typeof facility.neonatal_level_of_care === 'object') {
                flatFacilityData.neonatal_level_of_care_primary = facility.neonatal_level_of_care.primary ? 'Yes' : 'No';
                flatFacilityData.neonatal_level_of_care_secondary = facility.neonatal_level_of_care.secondary ? 'Yes' : 'No';
                flatFacilityData.neonatal_level_of_care_tertiary = facility.neonatal_level_of_care.tertiary ? 'Yes' : 'No';
            }
            
            return allDataKeys.map(key => {
                let value = flatFacilityData[key];
                 if (typeof value === 'object' && value !== null) return JSON.stringify(value);
                return value ?? '';
            });
        });
    
        const worksheetData = [allHeaders, ...rowsData];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facilities");
        XLSX.writeFile(workbook, `Facilities_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        if (filteredFacilities.length === 0) {
            setToast({ show: true, message: "No data to export.", type: "info" });
            return;
        }
        // Note: For Arabic text to render correctly, a font that supports Arabic
        // must be embedded in jsPDF, which requires loading a .ttf font file.
        const doc = new jsPDF('landscape');
        doc.text("Health Facilities Report", 14, 20);
        const head = [['#', 'Name', 'State', 'Locality', 'Type', 'Functioning', 'Project']];
        const body = filteredFacilities.map((f, index) => [
            index + 1,
            String(f['اسم_المؤسسة'] || ''),
            String(STATE_LOCALITIES[f['الولاية']]?.ar || f['الولاية'] || ''),
            String(LOCALITY_EN_TO_AR_MAP[f['المحلية']] || f['المحلية'] || ''),
            String(f['نوع_المؤسسةالصحية'] || ''),
            String(f['هل_المؤسسة_تعمل'] || 'Not Set'),
            String(f.project_name || 'N/A'),
        ]);
        autoTable(doc, { startY: 25, head: head, body: body });
        doc.save(`Facilities_Export_${new Date().toISOString().split('T')[0]}.pdf`);
    };
    
    const renderListView = () => {
        const FACILITY_TYPES = ["مركز صحة الاسرة", "مستشفى ريفي", "وحدة صحة الاسرة", "مستشفى"];
        const tabsContent = { 
            [TABS.PENDING]: <PendingSubmissionsTab submissions={uniquePendingSubmissions} onApprove={setSubmissionForReview} onReject={handleReject} />, 
            [TABS.ALL]: <AllFacilitiesTab facilities={filteredFacilities} onEdit={handleEditFacility} onDelete={handleDeleteFacility} onGenerateLink={handleGenerateLink} selectedFacilities={selectedFacilities} onToggleSelection={handleToggleSelection} onToggleAll={handleToggleAll} />, 
            [TABS.IMNCI]: <IMNCIServiceTab facilities={filteredFacilities} onEdit={handleEditFacility} onDelete={handleDeleteFacility} onGenerateLink={handleGenerateLink} />, 
            [TABS.EENC]: <EENCServiceTab facilities={filteredFacilities} onEdit={handleEditFacility} onDelete={handleDeleteFacility} />, 
            [TABS.NEONATAL]: <NeonatalServiceTab facilities={filteredFacilities} onEdit={handleEditFacility} onDelete={handleDeleteFacility} />, 
            [TABS.CRITICAL]: <CriticalCareServiceTab facilities={filteredFacilities} onEdit={handleEditFacility} onDelete={handleDeleteFacility} /> 
        };
        const availableTabs = Object.values(TABS).filter(tab => tab === TABS.PENDING ? permissions.canManageHealthFacilities : true); 
        const showFiltersAndActions = activeTab !== TABS.PENDING; 

        return (<Card>
            <div className="p-6">
                <PageHeader title="Child Health Services Management" subtitle="Manage health facilities and their pediatric services."/>
                <div className="border-b border-gray-200 mt-6"><nav className="-mb-px flex space-x-4 overflow-x-auto">{availableTabs.map(tabName => (<button key={tabName} onClick={() => setActiveTab(tabName)} className={`${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm`}>{tabName}{tabName === TABS.PENDING && uniquePendingSubmissions.length > 0 && <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{uniquePendingSubmissions.length}</span>}</button>))}</nav></div>
                
                {activeTab === TABS.PENDING && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4 items-end">
                        <FormGroup label="Filter by Submission Start Date">
                            <Input type="date" value={pendingStartDate} onChange={(e) => setPendingStartDate(e.target.value)} />
                        </FormGroup>
                        <FormGroup label="Filter by Submission End Date">
                            <Input type="date" value={pendingEndDate} onChange={(e) => setPendingEndDate(e.target.value)} />
                        </FormGroup>
                    </div>
                )}

                {showFiltersAndActions && (<>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 my-4 items-end">
                        <FormGroup label="Filter by State"><Select value={stateFilter} onChange={handleStateChange}><option value="">All States</option><option value="NOT_ASSIGNED">Not Assigned</option>{Object.keys(STATE_LOCALITIES).sort().map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>)}</Select></FormGroup>
                        <FormGroup label="Filter by Locality"><Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter || stateFilter === 'NOT_ASSIGNED'}><option value="">All Localities</option>{stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a, b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}</Select></FormGroup>
                        <FormGroup label="Filter by Facility Type"><Select value={facilityTypeFilter} onChange={(e) => setFacilityTypeFilter(e.target.value)}><option value="">All Types</option>{FACILITY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</Select></FormGroup>
                        <FormGroup label="Functioning Status"><Select value={functioningFilter} onChange={(e) => setFunctioningFilter(e.target.value)}><option value="">All</option><option value="Yes">Yes</option><option value="No">No</option><option value="NOT_SET">Not Set</option></Select></FormGroup>
                        <FormGroup label="Filter by Project Name">
                            <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                                <option value="">All Projects</option>
                                {projectNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </Select>
                        </FormGroup>
                    </div>

                    <div className="flex justify-between items-center my-4">
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={() => { setEditingFacility(null); setView('form'); }}>Add New</Button>
                            <Button onClick={() => setIsBulkUploadModalOpen(true)}>Bulk Upload</Button>
                            <Button variant="secondary" onClick={handleExportExcel} disabled={filteredFacilities.length === 0}>Export Excel</Button>
                            <Button variant="secondary" onClick={handleExportPDF} disabled={filteredFacilities.length === 0}>Export PDF</Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                             <Button variant="secondary" onClick={() => setIsDuplicateModalOpen(true)}>Find Duplicates</Button>
                             <Button variant="secondary" onClick={() => setIsCleanupModalOpen(true)}>Clean Data</Button>
                             <Button variant="danger" onClick={handleDeleteSelected} disabled={selectedFacilities.size === 0}>Delete Selected ({selectedFacilities.size})</Button>
                        </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">Showing <strong>{filteredFacilities.length}</strong> of <strong>{healthFacilities.length}</strong> facilities. {selectedFacilities.size > 0 && <span className="ml-2 font-semibold">{selectedFacilities.size} selected.</span>}</p>
                    
                     <div className="my-4">
                        <Input type="search" placeholder="Search by Facility Name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                </>)}

                {isLoading || (activeTab === TABS.PENDING && isSubmissionsLoading) ? <div className="flex justify-center items-center h-48"><Spinner /></div> : (filteredFacilities.length > 0 || (activeTab === TABS.PENDING && uniquePendingSubmissions.length > 0)) ? <div className="mt-4">{tabsContent[activeTab]}</div> : <EmptyState message="No health facilities found. Please add new ones or adjust your filters." />}
            </div>
        </Card>);
    };

    const renderFormView = () => {
        const formFields = {
            [TABS.IMNCI]: IMNCIFormFields,
            [TABS.EENC]: EENCFormFields,
            [TABS.NEONATAL]: NeonatalFormFields,
            [TABS.CRITICAL]: CriticalCareFormFields,
        };
        const currentTabForForm = [TABS.ALL, TABS.PENDING].includes(activeTab) ? TABS.IMNCI : activeTab;
        const FormComponent = formFields[currentTabForForm];
        const arabicTitle = ARABIC_TITLES[currentTabForForm] || currentTabForForm;

        return (
            <GenericFacilityForm
                initialData={editingFacility}
                onSave={handleSaveFacility}
                onCancel={() => { setEditingFacility(null); setView('list'); }}
                setToast={setToast}
                title={arabicTitle}
                subtitle={`أدخل تفاصيل ${arabicTitle}`}
            >
                {(props) => <FormComponent {...props} />}
            </GenericFacilityForm>
        );
    };
    
    return (
        <>
            {view === 'list' ? renderListView() : renderFormView()}
            <ApprovalComparisonModal
                submission={submissionForReview}
                allFacilities={healthFacilities}
                onClose={() => setSubmissionForReview(null)}
                onConfirm={handleConfirmApproval}
            />
            <BulkUploadModal
                isOpen={isBulkUploadModalOpen}
                onClose={() => {
                    setIsBulkUploadModalOpen(false);
                    setUploadStatus({ inProgress: false, processed: 0, total: 0, errors: [], message: '' });
                }}
                onImport={handleImport}
                uploadStatus={uploadStatus}
                activeTab={activeTab}
                filteredData={filteredFacilities}
            />
            <DuplicateFinderModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                facilities={healthFacilities}
                onDuplicatesDeleted={refreshHealthFacilities}
            />
            <DataCleanupModal
                isOpen={isCleanupModalOpen}
                onClose={() => setIsCleanupModalOpen(false)}
                facilities={healthFacilities}
                onCleanupComplete={refreshHealthFacilities}
                setToast={setToast}
                cleanupConfig={CLEANABLE_FIELDS_CONFIG}
            />
        </>
    );
};

// --- Comparison and Approval Modal Components ---

const deepEqual = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

const getDisplayableValue = (value) => {
    if (value === null || value === undefined || value === '') return <span className="text-gray-500 italic">Not Set</span>;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (Array.isArray(value) && value.every(item => typeof item === 'object' && item !== null && 'name' in item)) {
        if (value.length === 0) return <span className="text-gray-500 italic">No staff listed</span>;
        return (
           <ul className="list-disc list-inside text-xs space-y-1 pl-2">
               {value.map((staff, index) => (
                   <li key={index}>
                       <strong>{staff.name || 'Unnamed'}</strong> ({staff.job_title || 'N/A'}) - Trained: {getDisplayableValue(staff.is_trained)}
                   </li>
               ))}
           </ul>
       );
    }
    
    if (Array.isArray(value)) return `${value.length} item(s)`;
    if (typeof value === 'object' && value !== null) {
        return Object.entries(value).filter(([, val]) => val).map(([key]) => key).join(', ') || 'None';
    }
    return String(value);
};

const FIELD_LABELS_FOR_COMPARISON = {
    'اسم_المؤسسة': 'Facility Name', 'الولاية': 'State', 'المحلية': 'Locality', 'هل_المؤسسة_تعمل': 'Is Functioning',
    'imnci_staff': 'IMNCI Staff List', 'neonatal_level_of_care': 'Neonatal Level of Care', 'eenc_service_type': 'EENC Service Type'
};

const compareFacilities = (oldData, newData) => {
    const changes = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    const keysToIgnore = ['id', 'submissionId', 'submittedAt', 'lastSnapshotAt', 'updated_by', 'اخر تحديث', 'date_of_visit'];

    for (const key of allKeys) {
        if (keysToIgnore.includes(key)) continue;
        const oldValue = oldData[key];
        const newValue = newData[key];
        if (!deepEqual(oldValue, newValue)) {
            changes.push({
                label: FIELD_LABELS_FOR_COMPARISON[key] || key.replace(/_/g, ' '),
                from: getDisplayableValue(oldValue),
                to: getDisplayableValue(newValue),
            });
        }
    }
    return changes;
};

const ApprovalComparisonModal = ({ submission, allFacilities, onClose, onConfirm }) => {
    const [formData, setFormData] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (submission) {
            setFormData(submission);
        }
    }, [submission]);

    const comparison = useMemo(() => {
        if (!submission) return null;
        const existingFacility = allFacilities.find(f =>
            String(f['اسم_المؤسسة'] || '').trim().toLowerCase() === String(submission['اسم_المؤسسة'] || '').trim().toLowerCase() &&
            f['الولاية'] === submission['الولاية'] &&
            f['المحلية'] === submission['المحلية']
        );

        if (existingFacility) {
            const changes = compareFacilities(existingFacility, submission);
            return { isUpdate: true, changes, hasChanges: changes.length > 0 };
        }
        return { isUpdate: false };
    }, [submission, allFacilities]);
    
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const keys = name.split('.');
        setFormData(prev => {
            const newValue = type === 'checkbox' ? checked : value;
            if (keys.length === 1) {
                return { ...prev, [name]: newValue };
            }
            const updated = { ...prev };
            let current = updated;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = { ...(current[keys[i]] || {}) };
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = newValue;
            return updated;
        });
    };

    const handleApproveClick = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(formData);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!submission || !formData) return null;

    return (
        <Modal isOpen={!!submission} onClose={onClose} title={`Review & Edit Submission: ${submission['اسم_المؤسسة']}`}>
            <div className="p-6">
                <div className="flex justify-end items-center pb-4 border-b mb-4">
                    <Button variant="danger" onClick={handleApproveClick} disabled={isSubmitting}>
                        {isSubmitting ? 'Approving...' : 'Confirm and Approve Changes'}
                    </Button>
                </div>
                
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                    {comparison?.isUpdate && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                            <h4 className="font-semibold text-lg text-yellow-800">Summary of Original Changes</h4>
                             {comparison.hasChanges ? (
                                <Table headers={['Field', 'Previous Value', 'New Value']}>
                                    {comparison.changes.map(({ label, from, to }) => (
                                        <tr key={label}>
                                            <td className="font-medium capitalize align-top py-2">{label}</td>
                                            <td className="align-top py-2"><div className="text-sm bg-red-100 text-red-800 p-2 rounded">{from}</div></td>
                                            <td className="align-top py-2"><div className="text-sm bg-green-100 text-green-800 p-2 rounded">{to}</div></td>
                                        </tr>
                                    ))}
                                </Table>
                             ) : <p className="text-yellow-700 mt-1">No changes were detected in the original submission compared to the existing record.</p>}
                        </div>
                    )}

                    <div>
                        <h4 className="font-semibold text-lg mb-2">Edit Submission Data</h4>
                        <div className="p-4 border rounded-md">
                             <IMNCIFormFields 
                                formData={formData}
                                setFormData={setFormData}
                                handleInputChange={handleInputChange}
                                errors={{}}
                                isSubmitting={isSubmitting}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};


export default ChildHealthServicesView;