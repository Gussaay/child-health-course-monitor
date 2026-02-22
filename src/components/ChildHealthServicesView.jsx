// ChildHealthServicesView.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { getAuth } from "firebase/auth";
import { writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useDataCache } from '../DataContext';
import { amiriFontBase64 } from './AmiriFont.js';

// --- ICONS ---
import { PdfIcon } from './CommonComponents';

import LocationMapModal from './ChildHealthServicesMap.jsx';

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

import {
    Card, PageHeader, Button, FormGroup, Select, Table,
    Modal, Spinner, EmptyState, Checkbox, Input
} from './CommonComponents';
import {
    saveFacilitySnapshot,
    upsertHealthFacility,
    listHealthFacilities,
    importHealthFacilities,
    deleteHealthFacility,
    deleteFacilitiesBatch,
    getHealthFacilityById,
    listPendingFacilitySubmissions,
    approveFacilitySubmission,
    rejectFacilitySubmission,
    submitFacilityDataForApproval,
    listFacilitiesByLocality
} from "../data.js";
import {
    GenericFacilityForm,
    IMNCIFormFields,
    EENCFormFields,
    NeonatalFormFields,
    CriticalCareFormFields,
} from './FacilityForms.jsx';
import { STATE_LOCALITIES } from "./constants.js";

const TABS = {
    PENDING: 'Pending Submissions',
    ALL: 'All Facilities',
};
const ARABIC_TITLES = {};

// --- HELPER FUNCTIONS ---

const deepEqual = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

const getDisplayableValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === 'object' && value !== null) {
         if (Array.isArray(value)) { return value.length > 0 ? value.map(v => v.name || JSON.stringify(v)).join(', ') : 'N/A'; }
         if ('primary' in value || 'secondary' in value || 'tertiary' in value) {
             const levels = [];
             if (value.primary) levels.push('Primary');
             if (value.secondary) levels.push('Special Care');
             if (value.tertiary) levels.push('NICU');
             return levels.length > 0 ? levels.join(', ') : 'N/A';
         }
         return JSON.stringify(value);
    }
    return String(value);
};

const FIELD_LABELS_FOR_COMPARISON = {
    'اسم_المؤسسة': 'Facility Name', 
    'الولاية': 'State', 
    'المحلية': 'Locality', 
    'facility_ownership': 'Facility Ownership', 
    'نوع_المؤسسةالصحية': 'Facility Type', 
    'هل_المؤسسة_تعمل': 'Functioning', 
    '_الإحداثيات_latitude': 'Latitude', 
    '_الإحداثيات_longitude': 'Longitude', 
    'وجود_العلاج_المتكامل_لامراض_الطفولة': 'IMNCI Service', 
    'العدد_الكلي_لكوادر_طبية_العاملة_أطباء_ومساعدين': 'IMNCI Total Staff', 
    'العدد_الكلي_للكودار_ المدربة_على_العلاج_المتكامل': 'IMNCI Trained Staff', 
    'eenc_provides_essential_care': 'EENC Service', 
    'eenc_trained_workers': 'EENC Trained Workers', 
    'neonatal_level_of_care': 'Neonatal Level of Care', 
    'neonatal_total_beds': 'Neonatal Total Beds', 
    'neonatal_incubators': 'Neonatal Incubators', 
    'etat_has_service': 'ETAT Service', 
    'hdu_has_service': 'HDU Service', 
    'picu_has_service': 'PICU Service', 
    'imnci_staff': 'IMNCI Staff List'
};

const compareFacilities = (oldData, newData) => {
    const changes = [];
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    allKeys.forEach(key => {
        if (key.startsWith('_') || key === 'id' || key === 'submissionId' || key === 'submittedAt' || key === 'updated_by' || key === 'اخر تحديث' || key === 'date_of_visit') { return; }
        const oldValue = oldData?.[key];
        const newValue = newData?.[key];
        if (!deepEqual(oldValue, newValue)) { changes.push({ key: key, label: FIELD_LABELS_FOR_COMPARISON[key] || key.replace(/_/g, ' '), from: getDisplayableValue(oldValue), to: getDisplayableValue(newValue) }); }
    });
    return changes;
};

const getServiceConfig = (serviceType) => {
    const baseConfig = { 
        headers: ["ID", "الولاية", "المحلية", "اسم المؤسسة", "ملكية المؤسسة", "نوع المؤسسةالصحية", "نوع الخدمات", "Date of Visit"], 
        dataKeys: ["id", "الولاية", "المحلية", "اسم_المؤسسة", "facility_ownership", "نوع_المؤسسةالصحية", "eenc_service_type", "date_of_visit"] 
    };
    const baseImnciHeaders = ["هل المؤسسة تعمل", "هل توجد حوافز للاستاف", "ما هي المنظمة المقدم للحوافز", "هل تشارك المؤسسة في أي مشروع", "ما هو اسم المشروع", "رقم هاتف المسئول من المؤسسة", "وجود العلاج المتكامل لامراض الطفولة", "العدد الكلي للكوادر الطبية العاملة (أطباء ومساعدين)", "العدد الكلي للكودار المدربة על العلاج المتكامل", "وجود سجل علاج متكامل", "وجود كتيب لوحات", "ميزان وزن", "ميزان طول", "ميزان حرارة", "ساعة مؤقت", "غرفة إرواء", "وجود الدعم المادي", "_الإحداثيات_latitude", "_الإحداثيات_longitude", "هل يوجد مكتب تحصين", "اين يقع اقرب مركز تحصين", "هل يوجد مركز تغذية خارجي", "اين يقع اقرب مركز تغذية خارجي", "هل يوجد خدمة متابعة النمو"];
    const baseImnciDataKeys = ["هل_المؤسسة_تعمل", "staff_incentives", "staff_incentives_organization", "project_participation", "project_name", "person_in_charge_phone", "وجود_العلاج_المتكامل_لامراض_الطفولة", "العدد_الكلي_لكوادر_طبية_العاملة_أطباء_ومساعدين", "العدد_Kلي_للكودار_ المدربة_على_العلاج_المتكامل", "وجود_سجل_علاج_متكامل", "وجود_كتيب_لوحات", "ميزان_وزن", "ميزان_طول", "ميزان_حرارة", "ساعة_ مؤقت", "غرفة_إرواء", "وجود_الدعمادي", "_الإحداثيات_latitude", "_الإحداثيات_longitude", "immunization_office_exists", "nearest_immunization_center", "nutrition_center_exists", "nearest_nutrition_center", "growth_monitoring_service_exists"];
    const MAX_STAFF = 5;
    for (let i = 1; i <= MAX_STAFF; i++) { baseImnciHeaders.push(`اسم الكادر ${i}`, `الوصف الوظيفي للكادر ${i}`, `هل الكادر ${i} مدرب`, `تاريخ تدريب الكادر ${i}`, `رقم هاتف الكادر ${i}`); baseImnciDataKeys.push(`imnci_staff_${i}_name`, `imnci_staff_${i}_job_title`, `imnci_staff_${i}_is_trained`, `imnci_staff_${i}_training_date`, `imnci_staff_${i}_phone`); }
    const imnciConfig = { headers: baseImnciHeaders, dataKeys: baseImnciDataKeys };
    const eencConfig = { headers: ["هل تقدم الرعاية الضرورية المبكرة EENC", "عدد الكوادر الصحية المدربة", "العدد الكلي لسرير الولادة", "العدد الكلي لمحطات الانعاش", "العدد الكلي لاجهزة التدفئة", "العدد الكلي لجهاز الامبوباق", "العدد الكلي لجهاز الشفط اليدوي", "ساعة حائط", "جهاز التعقيم بالبخار", "تاريخ الزيارة لغرفة الولادة"], dataKeys: ["eenc_provides_essential_care", "eenc_trained_workers", "eenc_delivery_beds", "eenc_resuscitation_stations", "eenc_warmers", "eenc_ambu_bags", "eenc_manual_suction", "eenc_wall_clock", "eenc_steam_sterilizer", "eenc_delivery_room_visit_date"] };
    const neonatalConfig = { headers: ["Level of Care - Primary", "Level of Care - Secondary", "Level of Care - Tertiary", "وحدة رعاية الكنغر (KMC unit)", "وحدة الرضاعة الطبيعية (breastfeeding unit)", "وحدة تعقيم (sterilization unit)", "الترصد والحماية من عدوى التسمم الدموي", "إجمالي سعة الأسرة", "العدد الكلي للحضانات (incubators)", "العدد الكلي للاسرة للاطفال مكتملي النمو (cots)", "أجهزة CPAP", "جهاز تدفئة حرارية (warmer)", "مضخة تسريب (infusion pump)", "مضخات الحقن (Syringe pump)", "جهاز شفط (suction machine)", "وحدات العلاج الضوئي (Phototherapy)", "أكياس الإنعاش (Ambu Bag)", "جهاز مراقبة التنفس والاكسجين (Pulse and oxygen Monitor)", "جهاز أكسجين (Oxygen concentrator)", "أسطوانة الاكسجين (oxygen cylinder)", "جهاز تنفس صناعي (Mechanical ventilator)", "حاضنة محمولة (Portable Incubator)", "تاريخ زيارة وحدة حديثي الولادة"], dataKeys: ["neonatal_level_of_care_primary", "neonatal_level_of_care_secondary", "neonatal_level_of_care_tertiary", "neonatal_kmc_unit", "neonatal_breastfeeding_unit", "neonatal_sterilization_unit", "neonatal_sepsis_surveillance", "neonatal_total_beds", "neonatal_total_incubators", "neonatal_total_cots", "neonatal_cpap", "neonatal_warmer", "neonatal_infusion_pump", "neonatal_syringe_pump", "neonatal_sucker", "neonatal_phototherapy", "neonatal_ambu_bag", "neonatal_respiration_monitor", "neonatal_oxygen_machine", "neonatal_oxygen_cylinder", "neonatal_mechanical_ventilator", "neonatal_portable_incubator", "neonatal_unit_visit_date"] };
    const criticalCareConfig = { headers: ["etat_has_service", "etat_trained_workers", "hdu_has_service", "hdu_bed_capacity", "picu_has_service", "picu_bed_capacity"], dataKeys: ["etat_has_service", "etat_trained_workers", "hdu_has_service", "hdu_bed_capacity", "picu_has_service", "picu_has_service"] };
    let finalHeaders = [...baseConfig.headers], finalDataKeys = [...baseConfig.dataKeys], fileName = 'Facility_Template.xlsx';
    switch (serviceType) {
        case TABS.IMNCI: case 'IMNCI': finalHeaders.push(...imnciConfig.headers); finalDataKeys.push(...imnciConfig.dataKeys); fileName = 'IMNCI_Template.xlsx'; break;
        case TABS.EENC: case 'EENC': finalHeaders.push(...eencConfig.headers); finalDataKeys.push(...eencConfig.dataKeys); fileName = 'EENC_Template.xlsx'; break;
        case TABS.NEONATAL: case 'Neonatal': finalHeaders.push(...eencConfig.headers, ...neonatalConfig.headers); finalDataKeys.push(...eencConfig.dataKeys, ...neonatalConfig.dataKeys); fileName = 'Neonatal_Care_Template.xlsx'; break;
        case TABS.CRITICAL: case 'Critical Care': finalHeaders.push(...eencConfig.headers, ...criticalCareConfig.headers); finalDataKeys.push(...eencConfig.dataKeys, ...criticalCareConfig.dataKeys); fileName = 'Critical_Care_Template.xlsx'; break;
        default: finalHeaders.push(...imnciConfig.headers, ...eencConfig.headers, ...neonatalConfig.headers, ...criticalCareConfig.headers); finalDataKeys.push(...imnciConfig.dataKeys, ...imnciConfig.dataKeys, ...eencConfig.dataKeys, ...neonatalConfig.dataKeys, ...criticalCareConfig.dataKeys); fileName = 'All_Services_Template.xlsx';
    }
    return { headers: [...new Set(finalHeaders)], dataKeys: [...new Set(finalDataKeys)], fileName };
};

const LOCALITY_EN_TO_AR_MAP = Object.values(STATE_LOCALITIES).flatMap(s => s.localities).reduce((acc, loc) => {
    acc[loc.en] = loc.ar;
    return acc;
}, {});

const getStateName = (stateKey) => STATE_LOCALITIES[stateKey]?.ar || stateKey || 'N/A';
const getLocalityName = (stateKey, localityKey) => { if (!stateKey || !localityKey) return 'N/A'; const state = STATE_LOCALITIES[stateKey]; if (!state) return localityKey; const locality = state.localities.find(l => l.en === localityKey); return locality?.ar || localityKey; };

// --- SUB-COMPONENTS ---

const AllFacilitiesTab = ({ facilities, onEdit, onDelete, onGenerateLink, onOpenMap, emptyMessage, canApproveSubmissions, canManageFacilities }) => {
    const getServiceBadges = (f) => {
        const services = [];
        if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') services.push({ name: 'IMNCI', color: 'bg-sky-100 text-sky-800' });
        if (f.eenc_provides_essential_care === 'Yes') services.push({ name: 'EENC', color: 'bg-teal-100 text-teal-800' });
        if (f.neonatal_level_of_care && (f.neonatal_level_of_care.primary || f.neonatal_level_of_care.secondary || f.neonatal_level_of_care.tertiary)) services.push({ name: 'Neonatal', color: 'bg-indigo-100 text-indigo-800' });
        if (f.etat_has_service === 'Yes' || f.hdu_has_service === 'Yes' || f.picu_has_service === 'Yes') services.push({ name: 'Critical', color: 'bg-red-100 text-red-800' });
        if (services.length === 0) return <span className="text-xs text-gray-500">None</span>;
        return <div className="flex flex-wrap gap-1">{services.map(s => <span key={s.name} className={`px-2 py-1 text-xs font-medium rounded-full ${s.color}`}>{s.name}</span>)}</div>;
    };

    return (
        <Table headers={['State', 'Locality', 'Facility Name', 'Ownership', 'Functioning', 'Services Available', 'Last Update', 'Actions']}>
            {facilities.length > 0 ? (
                facilities.map((f, index) => (
                    <tr key={f.id}>
                        <td>{getStateName(f['الولاية'])}</td>
                        <td>{getLocalityName(f['الولاية'], f['المحلية'])}</td>
                        <td>{f['اسم_المؤسسة']}</td>
                        <td>
                            {f.facility_ownership ? (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-800">
                                    {f.facility_ownership}
                                </span>
                            ) : (
                                <span className="text-gray-400 text-xs">-</span>
                            )}
                        </td>
                        <td>{ (f['هل_المؤسسة_تعمل'] === 'Yes' || f['هل_المؤسسة_تعمل'] === 'No') ? <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${f['هل_المؤسسة_تعمل'] === 'Yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{f['هل_المؤسسة_تعمل']}</span> : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Not Set</span> }</td>
                        <td>{getServiceBadges(f)}</td>
                        <td>{f.lastSnapshotAt?.toDate ? f.lastSnapshotAt.toDate().toLocaleDateString() : 'N/A'}</td>
                        <td className="min-w-[280px]">
                            <div className="flex flex-nowrap gap-2">
                                {canManageFacilities && (
                                    <>
                                        <Button variant="info" size="sm" onClick={() => onEdit(f.id)}>Edit</Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => onDelete(f.id)}
                                        >
                                            Delete
                                        </Button>
                                    </>
                                )}
                                <Button size="sm" onClick={() => onGenerateLink(f.id)}>Link</Button>
                                <Button variant="secondary" size="sm" onClick={() => onOpenMap(f)}>Map</Button>
                            </div>
                        </td>
                    </tr>
                ))
            ) : (
                <EmptyState message={emptyMessage} colSpan={8} />
              )}
        </Table>
    );
};

const PendingSubmissionsTab = ({ submissions, onApprove, onReject }) => {
    return (
        <Table headers={['Submission Date', 'Facility Name', 'State', 'Locality', 'Submitted By', 'Actions']}>
            {(!submissions || submissions.length === 0) ? (
                <EmptyState message="No pending submissions found." colSpan={6} />
            ) : (
                submissions.map(s => (
                    <tr key={s.submissionId}>
                        <td>{s.submittedAt?.toDate ? s.submittedAt.toDate().toLocaleDateString() : 'N/A'}</td>
                        <td>
                            {s['اسم_المؤسسة']}
                            {s._action === 'DELETE' && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Deletion Request</span>}
                        </td>
                        <td>{s['الولاية']}</td>
                        <td>{s['المحلية']}</td>
                        <td>{s.updated_by || 'Public Submission'}</td>
                        <td className="flex flex-wrap gap-2">
                            <Button variant="success" size="sm" onClick={() => onApprove(s)}>View / Approve</Button>
                            <Button variant="danger" size="sm" onClick={() => onReject(s.submissionId, s._action === 'DELETE')}>Reject</Button>
                        </td>
                    </tr>
                ))
            )}
        </Table>
    );
};

// --- ApprovalComparisonModal ---
const ApprovalComparisonModal = ({ submission, allFacilities, onClose, onConfirm, setToast }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef(null);
    const [isEditing, setIsEditing] = useState(false);
    useEffect(() => { setIsEditing(false); }, [submission]);
    const comparison = useMemo(() => {
        if (!submission) return null;
        const existingFacility = (allFacilities || []).find(f => String(f?.['اسم_المؤسسة'] || '').trim().toLowerCase() === String(submission['اسم_المؤسسة'] || '').trim().toLowerCase() && f?.['الولاية'] === submission['الولاية'] && f?.['المحلية'] === submission['المحلية'] );
        if (existingFacility) { const changes = compareFacilities(existingFacility, submission); return { isUpdate: true, changes, hasChanges: changes.length > 0 }; }
        return { isUpdate: false, changes: compareFacilities({}, submission), hasChanges: true };
    }, [submission, allFacilities]);
    const handleSaveFromForm = async (formData) => {
        setIsSubmitting(true);
        try {
            if (submission?._action === 'DELETE') { formData._action = 'DELETE'; }
            await onConfirm(formData);
        } finally {
            setIsSubmitting(false);
        }
    };
    const handleDirectApprove = async () => {
         setIsSubmitting(true);
         try { await onConfirm({ ...submission }); } finally { setIsSubmitting(false); }
     };
    const handleCancelEdit = () => { setIsEditing(false); };
    if (!submission) return null;
    const isDeletionRequest = submission?._action === 'DELETE';
    const modalTitle = isDeletionRequest ? `Review Deletion Request: ${submission['اسم_المؤسسة']}` : `Review Submission: ${submission['اسم_المؤسسة']}`;
    return (
        <Modal isOpen={!!submission} onClose={onClose} title={modalTitle} size="full">
            <div className="p-6 h-full flex flex-col relative">
                 <div className="absolute top-4 right-4 z-10 flex gap-2">
                     {(!isEditing || isDeletionRequest) && (
                         <Button variant={isDeletionRequest ? "danger" : "success"} onClick={handleDirectApprove} disabled={isSubmitting}>
                             {isSubmitting ? (isDeletionRequest ? 'Deleting...' : 'Approving...') : (isDeletionRequest ? 'Confirm Deletion' : 'Approve') }
                         </Button>
                     )}
                     {!isSubmitting && ( <Button variant="secondary" onClick={onClose} > Close </Button> )}
                 </div>
                {isDeletionRequest && (
                    <div className="p-4 bg-red-100 border border-red-300 rounded-md mb-4 mt-12 flex-shrink-0">
                        <h4 className="font-semibold text-lg text-red-800">DELETION REQUEST</h4>
                        <p className="text-red-700">A user has requested to **permanently delete** this facility. Review the details below. Approving will remove the facility.</p>
                    </div>
                )}
                {!isDeletionRequest && comparison && (
                     <div className={`p-4 border rounded-md mb-4 mt-12 flex-shrink-0 ${comparison.isUpdate ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
                        <h4 className={`font-semibold text-lg ${comparison.isUpdate ? 'text-yellow-800' : 'text-blue-800'}`}>
                             {comparison.isUpdate ? "Summary of Changes" : "New Facility Submission"}
                        </h4>
                            {comparison.hasChanges ? (
                            <div className="max-h-60 overflow-y-auto mt-2">
                                <Table headers={comparison.isUpdate ? ['Field', 'Previous Value', 'New Value'] : ['Field', 'Submitted Value']}>
                                     {comparison.changes .filter(c => c.to !== 'N/A') .map(({ label, from, to }) => (
                                        <tr key={label}>
                                            <td className="font-medium capitalize align-top py-2">{label}</td>
                                            {comparison.isUpdate && <td className="align-top py-2"><div className="text-sm bg-red-100 text-red-800 p-2 rounded">{from}</div></td>}
                                            <td className="align-top py-2"><div className="text-sm bg-green-100 text-green-800 p-2 rounded">{to}</div></td>
                                        </tr>
                                    ))}
                                </Table>
                            </div>
                            ) : <p className={`mt-1 ${comparison.isUpdate ? 'text-yellow-700' : 'text-blue-700'}`}>
                                 {comparison.isUpdate ? "No changes were detected compared to the existing record." : "No data submitted?"}
                                </p>}
                    </div>
                )}
                {(isEditing || isDeletionRequest) && (
                    <div className={`flex-grow overflow-y-auto mb-4 ${!isDeletionRequest && !comparison?.isUpdate ? 'mt-12' : ''}`}>
                        <GenericFacilityForm
                            ref={formRef}
                            initialData={submission}
                            onSave={handleSaveFromForm}
                            onCancel={handleCancelEdit}
                            setToast={setToast}
                            title={isDeletionRequest ? "Facility Details (Read-Only)" : "Edit & Approve Submission"}
                            subtitle={isDeletionRequest ? "Review the data below before approving deletion." : "Make necessary corrections and click 'Approve'." }
                            isReadOnly={isDeletionRequest}
                            saveButtonText="Approve Changes"
                            saveButtonVariant="success"
                            cancelButtonText="Cancel Edit"
                            isSubmitting={isSubmitting}
                             userAssignedState={null}
                             userAssignedLocality={null}
                        >
                            {(props) => (
                                <>
                                    <h3 className="text-lg font-semibold text-sky-700 border-b pb-2 mb-4">IMNCI Services (خدمات العلاج المتكامل لأمراض الطفولة)</h3>
                                    <IMNCIFormFields {...props} isReadOnly={isDeletionRequest} />
                                    <hr className="my-6 border-t-2 border-gray-200" />
                                    
                                    <h3 className="text-lg font-semibold text-teal-700 border-b pb-2 mb-4">EENC Services (خدمات الرعاية الطارئة لحديثي الولادة)</h3>
                                    <EENCFormFields {...props} isReadOnly={isDeletionRequest} />
                                    <hr className="my-6 border-t-2 border-gray-200" />

                                    <h3 className="text-lg font-semibold text-indigo-700 border-b pb-2 mb-4">Neonatal Care Unit (وحدة رعاية حديثي الولادة)</h3>
                                    <NeonatalFormFields {...props} isReadOnly={isDeletionRequest} />
                                    <hr className="my-6 border-t-2 border-gray-200" />

                                    <h3 className="text-lg font-semibold text-red-700 border-b pb-2 mb-4">Emergency & Critical Care (الطوارئ والرعاية الحرجة)</h3>
                                    <CriticalCareFormFields {...props} isReadOnly={isDeletionRequest} />
                                </>
                            )}
                        </GenericFacilityForm>
                    </div>
                )}
                 {!isEditing && !isDeletionRequest && (
                     <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
                          <Button variant="info" onClick={() => setIsEditing(true)} disabled={isSubmitting}>
                              Edit Before Approving
                          </Button>
                     </div>
                 )}
                 {(isEditing || isDeletionRequest) && <div className="pt-4 flex-shrink-0"></div>}
            </div>
        </Modal>
    );
};

const MappingRow = React.memo(({ field, headers, selectedValue, onMappingChange }) => ( <div className="flex items-center"><label className="w-1/2 font-medium text-sm capitalize">{field.label}{field.key === 'اسم_المؤسسة' && '*'}</label><Select value={selectedValue || ''} onChange={(e) => onMappingChange(field.key, e.target.value)} className="flex-1"><option value="">-- Select Excel Column --</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</Select></div> ));

const BulkUploadModal = ({ isOpen, onClose, onImport, uploadStatus, activeTab, filteredData, cleanupConfig }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [validationIssues, setValidationIssues] = useState([]);
    const [userCorrections, setUserCorrections] = useState({});
    const [failedRows, setFailedRows] = useState([]);
    
    // Filters for Bulk Upload
    const [uploadState, setUploadState] = useState('');
    const [uploadLocality, setUploadLocality] = useState('');

    const fileInputRef = useRef(null);
    const MAX_STAFF = 5;

    useEffect(() => { 
        if (uploadStatus.inProgress) { setCurrentPage(2); } 
        else if (uploadStatus.message) { 
            const detailedErrors = uploadStatus.errors?.filter(e => e.rowData); 
            if (detailedErrors && detailedErrors.length > 0) { 
                setFailedRows(detailedErrors); setCurrentPage('correction'); 
            } else { setCurrentPage(3); } 
        } 
    }, [uploadStatus.inProgress, uploadStatus.message, uploadStatus.errors]);

    useEffect(() => { 
        if (isOpen) { 
            setCurrentPage(0); setError(''); setExcelData([]); setHeaders([]); 
            setFieldMappings({}); setValidationIssues([]); setUserCorrections({}); setFailedRows([]); 
            setUploadState(''); setUploadLocality(''); // Reset filters on open
        } 
    }, [isOpen]);

    const FIELD_LABELS = useMemo(() => ({ 'eenc_service_type': 'نوع الخدمات المقدمة', }), []);
    
    const allFacilityFields = useMemo(() => { 
        if (!activeTab) return []; 
        const config = getServiceConfig(activeTab); 
        return [{ key: 'id', label: 'ID (for updates)' }, ...config.dataKeys.filter(key => key !== 'id').map(key => ({ key, label: FIELD_LABELS[key] || key.replace(/_/g, ' ') }))]; 
    }, [activeTab, FIELD_LABELS]);

    const handleFileUpload = (e) => { 
        const file = e.target.files[0]; if (!file) return; 
        const reader = new FileReader(); 
        reader.onload = (event) => { 
            try { 
                const data = new Uint8Array(event.target.result); 
                const workbook = XLSX.read(data, { type: 'array' }); 
                const worksheet = workbook.Sheets[workbook.SheetNames[0]]; 
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", cellDates: true }); 
                if (jsonData.length < 1) { setError('Excel file appears to be empty.'); return; } 
                setHeaders(jsonData[0].map(h => String(h).trim())); 
                setExcelData(jsonData.slice(1)); 
                setCurrentPage(1); setError(''); 
            } catch (err) { setError('Error reading Excel file: ' + err.message); } 
        }; 
        reader.readAsArrayBuffer(file); 
    };

    const handleDownloadTemplate = () => {
        const { headers: finalHeaders, dataKeys: finalDataKeys, fileName } = getServiceConfig(activeTab);
        let downloadFileName = `New_Facilities_${fileName}`;
        let worksheetData = [finalHeaders];

        let dataToDownload = filteredData || [];
        if (uploadState) {
            dataToDownload = dataToDownload.filter(f => f['الولاية'] === uploadState);
        }
        if (uploadLocality) {
            dataToDownload = dataToDownload.filter(f => f['المحلية'] === uploadLocality);
        }

        if (dataToDownload && dataToDownload.length > 0) {
            downloadFileName = `Update_Template_For_${fileName}`;
            const rowsData = dataToDownload.map(facility => {
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
                return finalDataKeys.map(key => { let value = flatFacilityData[key]; if (value === undefined || value === null || value === '') { return ''; } return value; });
            });
            worksheetData.push(...rowsData);
        }
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facilities");
        XLSX.writeFile(workbook, downloadFileName);
    };

    const handleMappingChange = useCallback((appField, excelHeader) => { setFieldMappings(prev => { const newMappings = { ...prev }; if (excelHeader) newMappings[appField] = excelHeader; else delete newMappings[appField]; return newMappings; }); }, []);

    const handleValidation = () => {
        if (!fieldMappings['اسم_المؤسسة']) { setError('The "Facility Name" (اسم_المؤسسة) field must be mapped to an Excel column.'); return; }
        setError('');
        const issues = []; const checkedFields = {}; const mappedFields = Object.keys(fieldMappings);
        for (const appField of mappedFields) {
            const config = cleanupConfig[appField];
            if (config && config.standardValues && !checkedFields[appField]) {
                const excelHeader = fieldMappings[appField];
                const headerIndex = headers.indexOf(excelHeader);
                if (headerIndex === -1) continue;
                const invalidValues = new Set();
                const standardValuesLower = new Set(config.standardValues.map(v => String(v).toLowerCase()));
                excelData.forEach(row => { const cellValue = row[headerIndex]; if (cellValue !== null && cellValue !== undefined && cellValue !== '') { const cleanCellValue = String(cellValue).trim().toLowerCase(); if (!standardValuesLower.has(cleanCellValue)) { invalidValues.add(String(cellValue).trim()); } } });
                if (invalidValues.size > 0) { issues.push({ columnName: excelHeader, appField: appField, invalidValues: Array.from(invalidValues).sort(), options: config.standardValues }); }
                checkedFields[appField] = true;
            }
        }
        if (issues.length > 0) { setValidationIssues(issues); setCurrentPage('validation'); } else { startImportProcess(); }
    };

    const handleCorrectionChange = (originalValue, mappedValue) => { setUserCorrections(prev => ({ ...prev, [originalValue]: mappedValue })); };

    const processAndStartImport = (dataForProcessing, originalRawData) => {
        const normalizeBoolean = (value) => { if (value === null || value === undefined) return value; const strValue = String(value).toLowerCase().trim(); const yesValues = ['yes', 'نعم', 'توجد', 'يوجد', true]; const noValues = ['no', 'لا', 'لاتوجد', 'لا توجد', false]; if (yesValues.includes(strValue)) return 'Yes'; if (noValues.includes(strValue)) return 'No'; return value; };
        const serviceGroups = { eenc: { dateKey: 'eenc_delivery_room_visit_date', dataKeys: getServiceConfig(TABS.EENC).dataKeys.filter(k => k.startsWith('eenc_')) }, neonatal: { dateKey: 'neonatal_unit_visit_date', dataKeys: getServiceConfig(TABS.NEONATAL).dataKeys.filter(k => k.startsWith('neonatal_')) }, critical: { dateKey: 'date_of_visit', dataKeys: getServiceConfig(TABS.CRITICAL).dataKeys.filter(k => k.startsWith('etat_') || k.startsWith('hdu_') || k.startsWith('picu_')) }, imnci: { dateKey: 'date_of_visit', dataKeys: getServiceConfig(TABS.IMNCI).dataKeys.filter(k => !k.startsWith('eenc_') && !k.startsWith('neonatal_') && !k.startsWith('etat_') && !k.startsWith('hdu_') && !k.startsWith('picu_')) } };
        const allServiceDataKeys = Object.values(serviceGroups).flatMap(g => g.dataKeys);
        let allPayloads = [];
        dataForProcessing.forEach(row => {
            const facilityFromRow = {};
            if (Array.isArray(row)) { 
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
            } else { Object.assign(facilityFromRow, row); }
            
            if (!facilityFromRow['اسم_المؤسسة']) return;

            // Apply Selected State and Locality if missing
            if (uploadState && !facilityFromRow['الولاية']) facilityFromRow['الولاية'] = uploadState;
            if (uploadLocality && !facilityFromRow['المحلية']) facilityFromRow['المحلية'] = uploadLocality;

            const commonData = Object.keys(facilityFromRow).filter(key => !allServiceDataKeys.includes(key)).reduce((obj, key) => { obj[key] = facilityFromRow[key]; return obj; }, {});
            const payloadsByDate = new Map();
            Object.values(serviceGroups).forEach(group => { const visitDate = facilityFromRow[group.dateKey]; if (visitDate) { const serviceDataForDate = group.dataKeys.reduce((obj, key) => { if (facilityFromRow[key] !== undefined) obj[key] = facilityFromRow[key]; return obj; }, {}); if (Object.keys(serviceDataForDate).length > 0) { const existingPayload = payloadsByDate.get(visitDate) || { ...commonData }; const updatedPayload = { ...existingPayload, ...serviceDataForDate, date_of_visit: visitDate }; payloadsByDate.set(visitDate, updatedPayload); } } });
            if (payloadsByDate.size === 0) { const defaultDate = facilityFromRow['date_of_visit'] || new Date().toISOString().split('T')[0]; payloadsByDate.set(defaultDate, { ...facilityFromRow, date_of_visit: defaultDate }); }
            allPayloads.push(...Array.from(payloadsByDate.values()));
        });
        const booleanFields = ['هل_المؤسسة_تعمل', 'staff_incentives', 'project_participation', 'وجود_العلاج_المتكامل_لامراض_الطفولة', 'وجود_سجل_علاج_متكامل', 'وجود_كتيب_لوحات', 'ميزان_وزن', 'ميزان_طول', 'ميزان_حرارة', 'ساعة_مؤقت', 'غرفة_إرواء', 'eenc_provides_essential_care', 'eenc_steam_sterilizer', 'eenc_wall_clock', 'etat_has_service', 'hdu_has_service', 'picu_has_service', 'neonatal_level_of_care_primary', 'neonatal_level_of_care_secondary', 'neonatal_level_of_care_tertiary', 'neonatal_kmc_unit', 'neonatal_breastfeeding_unit', 'neonatal_sterilization_unit', 'immunization_office_exists', 'nutrition_center_exists', 'growth_monitoring_service_exists', 'neonatal_sepsis_surveillance'];
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
        onImport(processedFacilities, originalRawData);
    };

    const startImportProcess = () => processAndStartImport(excelData, excelData);
    const handleRetryUpload = () => {
        const dataToRetry = failedRows.map(failedRow => { const correctedObject = {}; headers.forEach((header, index) => { const appField = Object.keys(fieldMappings).find(key => fieldMappings[key] === header); if(appField) { correctedObject[appField] = failedRow.rowData[index]; } }); return correctedObject; });
        setFailedRows([]);
        const originalFailedRows = failedRows.map(fr => fr.rowData);
        processAndStartImport(dataToRetry, originalFailedRows);
    };
    const handleCorrectionDataChange = (errorIndex, cellIndex, value) => { const updatedFailedRows = [...failedRows]; const newRowData = [...updatedFailedRows[errorIndex].rowData]; newRowData[cellIndex] = value; updatedFailedRows[errorIndex].rowData = newRowData; setFailedRows(updatedFailedRows); };
    
    const renderPreview = () => (excelData.length === 0) ? null : (<div className="mt-4 overflow-auto max-h-60"><h4 className="font-medium mb-2">Data Preview (first 5 rows)</h4><table className="min-w-full border border-gray-200"><thead><tr className="bg-gray-100">{headers.map((header, idx) => <th key={idx} className="border border-gray-300 p-2 text-left text-xs">{header}</th>)}</tr></thead><tbody>{excelData.slice(0, 5).map((row, rowIdx) => <tr key={rowIdx}>{row.map((cell, cellIdx) => <td key={cellIdx} className="border border-gray-300 p-2 text-xs">{cell instanceof Date ? cell.toLocaleDateString() : cell}</td>)}</tr>)}</tbody></table></div>);
    const renderValidationScreen = () => { const allCorrectionsMade = validationIssues.every(issue => issue.invalidValues.every(val => userCorrections[val])); return (<div><h4 className="font-medium text-lg mb-2">Review Data Mismatches</h4><p className="text-sm text-gray-600 mb-4">Some values in your file don't match the expected options. Please map your values to the correct ones.</p><div className="space-y-4 max-h-96 overflow-y-auto p-2 border rounded bg-gray-50">{validationIssues.map(issue => (<div key={issue.columnName}><h5 className="font-semibold text-gray-800">Mismatches for Column: <span className="font-bold">"{issue.columnName}"</span></h5>{issue.invalidValues.map(val => (<div key={val} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 mt-2 p-2 bg-white rounded border"><span className="bg-red-50 text-red-800 p-2 rounded text-sm truncate" title={val}>Your value: "{val}"</span><span className="text-center font-bold text-gray-500 hidden md:block">&rarr;</span><Select value={userCorrections[val] || ''} onChange={(e) => handleCorrectionChange(val, e.target.value)}><option value="">-- Choose correct option --</option>{issue.options.map(opt => <option key={opt} value={opt}>{STATE_LOCALITIES[opt]?.ar || opt}</option>)}</Select></div>))}</div>))}</div><div className="flex justify-end mt-6 space-x-2"><Button variant="secondary" onClick={() => setCurrentPage(1)}>Back to Mapping</Button><Button onClick={startImportProcess} disabled={!allCorrectionsMade}>Apply and Import</Button></div>{!allCorrectionsMade && <p className="text-right text-sm text-red-600 mt-2">Please resolve all mismatches.</p>}</div>); };
    const renderProgressView = () => (<div><h4 className="font-medium text-lg mb-2">Import in Progress...</h4><p className="text-sm text-gray-600 mb-4">Please wait while the facilities are being uploaded.</p><div className="w-full bg-gray-200 rounded-full h-4"><div className="bg-blue-600 h-4 rounded-full transition-all duration-500" style={{ width: `${uploadStatus.total > 0 ? (uploadStatus.processed / uploadStatus.total) * 100 : 0}%` }}></div></div><p className="text-center mt-2 font-medium">{uploadStatus.processed} / {uploadStatus.total}</p></div>);
    const renderResultView = () => (<div><h4 className="font-medium text-lg mb-2">Import Complete</h4><div className="bg-gray-50 p-4 rounded-md"><p className="font-semibold whitespace-pre-wrap">{uploadStatus.message}</p>{uploadStatus.errors && uploadStatus.errors.length > 0 && !uploadStatus.errors.some(e => e.rowData) && (<div className="mt-4 max-h-40 overflow-y-auto"><h5 className="font-semibold text-red-700">Errors encountered (unrecoverable):</h5><ul className="list-disc list-inside text-sm text-red-600">{uploadStatus.errors.map((err, index) => <li key={index}>{err.message || err.toString()}</li>)}</ul></div>)}</div><div className="flex justify-end mt-6"><Button onClick={onClose}>Close</Button></div></div>);
    const renderCorrectionScreen = () => ( <div><h4 className="font-medium text-lg text-red-700 mb-2">Import Errors</h4><p className="text-sm text-gray-600 mb-4">Some rows failed to import. You can correct the data below and retry uploading only the failed rows.</p><div className="overflow-x-auto max-h-[60vh] border rounded-md"><table className="min-w-full text-sm"><thead className="bg-gray-100 sticky top-0"><tr><th className="p-2 border-r text-left">Row #</th><th className="p-2 border-r text-left">Error</th>{headers.map(header => <th key={header} className="p-2 border-r text-left whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{failedRows.map((error, errorIndex) => ( <tr key={error.rowIndex} className="bg-white hover:bg-red-50"><td className="p-1 border-r font-medium">{error.rowIndex + 2}</td><td className="p-1 border-r text-red-600 max-w-xs">{error.message}</td>{error.rowData.map((cell, cellIndex) => ( <td key={cellIndex} className="p-0 border-r"><Input type="text" value={cell || ''} onChange={(e) => handleCorrectionDataChange(errorIndex, cellIndex, e.target.value)} className="w-full border-0 rounded-none focus:ring-2 focus:ring-blue-500" /></td> ))}</tr> ))}</tbody></table></div><div className="flex justify-end mt-6 space-x-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleRetryUpload}>Retry Upload for {failedRows.length} Corrected Row(s)</Button></div></div> );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload" size="full">
            <div className="p-4">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
                
                {currentPage === 0 && (
                    <div>
                        <p className="mb-4">Download the template to get started. You can select a State and Locality to restrict the template to specific facilities.</p>
                        
                        <div className="flex flex-col md:flex-row gap-4 mb-4 p-4 border rounded bg-gray-50">
                            <FormGroup label="Filter Template by State (Optional)" className="flex-1">
                                <Select 
                                    value={uploadState} 
                                    onChange={e => { setUploadState(e.target.value); setUploadLocality(''); }}
                                >
                                    <option value="">-- All States --</option>
                                    {Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => (
                                        <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Filter Template by Locality (Optional)" className="flex-1">
                                <Select 
                                    value={uploadLocality} 
                                    onChange={e => setUploadLocality(e.target.value)} 
                                    disabled={!uploadState}
                                >
                                    <option value="">-- All Localities --</option>
                                    {uploadState && STATE_LOCALITIES[uploadState]?.localities.map(l => (
                                        <option key={l.en} value={l.en}>{l.ar}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                        </div>
                        <p className="text-xs text-gray-500 italic mb-4">Note: Selecting a State/Locality above will also auto-assign uploaded facilities to them if they are missing from your Excel file.</p>

                        <Button variant="secondary" onClick={handleDownloadTemplate} className="mb-4">
                            Download Template
                        </Button>
                        <hr className="my-4"/>
                        <p className="mb-2">Or, upload your own Excel file (first row must be headers).</p>
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} ref={fileInputRef} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    </div>
                )}
                
                {currentPage === 1 && (
                    <div>
                        <h4 className="font-medium mb-4">Map Excel columns to application fields</h4>
                        <p className="text-sm text-gray-600 mb-4">Match the columns from your Excel file to the application fields. To update existing records, ensure the 'ID' field is correctly mapped.</p>
                        <div className="grid grid-cols-2 gap-3 mb-4 max-h-80 overflow-y-auto p-2 border rounded">
                            {allFacilityFields.map(field => <MappingRow key={field.key} field={field} headers={headers} selectedValue={fieldMappings[field.key]} onMappingChange={handleMappingChange}/>)}
                        </div>
                        {renderPreview()}
                        <div className="flex justify-end mt-6 space-x-2">
                            <Button variant="secondary" onClick={() => setCurrentPage(0)}>Back</Button>
                            <Button onClick={handleValidation}>Validate and Continue</Button>
                        </div>
                    </div>
                )}
                
                {currentPage === 'validation' && renderValidationScreen()}
                {currentPage === 'correction' && renderCorrectionScreen()}
                {currentPage === 2 && renderProgressView()}
                {currentPage === 3 && renderResultView()}
            </div>
        </Modal>
    );
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
    return (<Modal isOpen={isOpen} onClose={onClose} title="Find & Fix Duplicates"><div className="p-4">{isLoading && <div className="text-center"><Spinner /></div>}{!isLoading && duplicateGroups.length === 0 && <div className="text-center p-4"><EmptyState message="No duplicate facilities found." /></div>}{!isLoading && duplicateGroups.length > 0 && (<div><p className="mb-4 text-sm text-gray-700">Found <strong>{totalDuplicates}</strong> duplicate records across <strong>{duplicateGroups.length}</strong> groups. Uncheck any group you do not want to clean up.</p><div className="space-y-4 max-h-96 overflow-y-auto p-2 border rounded">{duplicateGroups.map(group => (<div key={group.key} className="p-3 border rounded-md bg-gray-50"><div className="flex items-center justify-between mb-2"><h4 className="font-bold text-gray-800">{group.original['اسم_المؤسسة']}<span className="text-sm font-normal text-gray-500 ml-2">({group.original['الولاية']} / {group.original['المحلية']})</span></h4><label className="flex items-center gap-2 cursor-pointer">
        <Checkbox label="" checked={!!selectedGroups[group.key]} onChange={() => handleSelectionChange(group.key)}/>
        <span>Clean up</span>
    </label></div><div className="text-xs space-y-1"><p className="p-1 rounded bg-green-100 text-green-800"><strong>Keep (Original):</strong> ID {group.original.id} <span className="text-gray-600 italic ml-2"> (Last updated: {group.original.lastSnapshotAt?.toDate().toLocaleString() || 'N/A'})</span></p>{group.duplicates.map(dup => <p key={dup.id} className="p-1 rounded bg-red-100 text-red-800"><strong>Delete (Duplicate):</strong> ID {dup.id}<span className="text-gray-600 italic ml-2"> (Last updated: {dup.lastSnapshotAt?.toDate().toLocaleString() || 'N/A'})</span></p>)}</div></div>))}</div><div className="flex justify-end mt-6"><Button variant="danger" onClick={handleDeleteSelected}>Delete Selected ({Object.values(selectedGroups).filter(Boolean).length})</Button></div></div>)}</div></Modal>);
};
const DataCleanupModal = ({ isOpen, onClose, facilities, onCleanupComplete, setToast, cleanupConfig }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedFieldKey, setSelectedFieldKey] = useState('');
    const [nonStandardValues, setNonStandardValues] = useState([]);
    const [mappings, setMappings] = useState({});
    const auth = getAuth();
    useEffect(() => { if (!isOpen) { setSelectedFieldKey(''); } setNonStandardValues([]); setMappings({}); }, [isOpen]);
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
    const handleMappingChange = (oldValue, newValue) => { setMappings(prev => ({ ...prev, [oldValue]: newValue })); };
    const handleApplyFixes = async () => {
        const user = auth.currentUser;
        if (!user) { setToast({ show: true, message: 'You must be logged in to perform this action.', type: 'error' }); return; }
        const config = cleanupConfig[selectedFieldKey];
        const facilitiesToUpdate = facilities.filter(f => {
            if (config.isStaffField) { return f.imnci_staff?.some(staff => Object.keys(mappings).includes(staff[selectedFieldKey])); } else { return Object.keys(mappings).includes(f[selectedFieldKey]); }
        });
        if (facilitiesToUpdate.length === 0) { setToast({ show: true, message: 'No changes to apply.', type: 'info' }); onClose(); return; }
        setIsUpdating(true);
        const batch = writeBatch(db);
        const today = new Date().toISOString().split('T')[0];
        const updaterIdentifier = user.displayName ? `${user.displayName} (${user.email})` : user.email;
        const updatePromises = facilitiesToUpdate.map(facility => {
            let payload;
            if (config.isStaffField) {
                const updatedStaff = facility.imnci_staff.map(staff => ({ ...staff, [selectedFieldKey]: mappings[staff[selectedFieldKey]] || staff[selectedFieldKey], }));
                payload = { ...facility, imnci_staff: updatedStaff };
            } else {
                payload = { ...facility, [selectedFieldKey]: mappings[facility[selectedFieldKey]] || facility[selectedFieldKey] };
            }
            const finalPayload = { ...payload, date_of_visit: today, updated_by: `Cleaned by ${updaterIdentifier}`, };
            return saveFacilitySnapshot(finalPayload, batch);
        });
        try {
            await Promise.all(updatePromises);
            await batch.commit();
            setToast({ show: true, message: `${facilitiesToUpdate.length} facilities updated successfully for field "${config.label}".`, type: 'success' });
            onCleanupComplete();
        } catch (error) {
            setToast({ show: true, message: `An error occurred: ${error.message}`, type: 'error' });
        } finally {
            setIsUpdating(false);
            onClose();
        }
    };
    const renderSelectionScreen = () => ( <div><FormGroup label="Select a data field to clean"><Select value={selectedFieldKey} onChange={(e) => setSelectedFieldKey(e.target.value)}><option value="">-- Choose field --</option>{Object.entries(cleanupConfig).map(([key, config]) => ( <option key={key} value={key}>{config.label}</option> ))}</Select></FormGroup></div> );
    const renderMappingScreen = () => {
        const config = cleanupConfig[selectedFieldKey];
        return (
            <div>
                {isLoading && <div className="text-center"><Spinner /></div>}
                {!isLoading && nonStandardValues.length === 0 && ( <div className="text-center p-4"><EmptyState message={`All values for "${config.label}" are already standardized.`} /></div> )}
                {!isLoading && nonStandardValues.length > 0 && ( <div><p className="mb-4 text-sm text-gray-700"> Found <strong>{nonStandardValues.length}</strong> non-standard value(s) for <strong>{config.label}</strong>. Map them to a standard value to clean up your data. </p><div className="space-y-3 max-h-80 overflow-y-auto p-2 border rounded bg-gray-50">{nonStandardValues.map(value => ( <div key={value} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 p-2 bg-white rounded border"><span className="bg-yellow-50 text-yellow-800 p-2 rounded text-sm truncate" title={value}> Current: "{value}" </span><span className="text-center font-bold text-gray-500 hidden md:block">&rarr;</span><Select value={mappings[value] || ''} onChange={(e) => handleMappingChange(value, e.target.value)}><option value="">-- Map to standard value --</option>{config.standardValues.map(opt => { let displayValue = opt; if (selectedFieldKey === 'الولاية') { displayValue = STATE_LOCALITIES[opt]?.ar || opt; } else if (selectedFieldKey === 'المحلية') { displayValue = LOCALITY_EN_TO_AR_MAP[opt] || opt; } return <option key={opt} value={opt}>{displayValue}</option>; })}</Select></div> ))}</div></div> )}
                <div className="flex justify-between items-center mt-6"><Button variant="secondary" onClick={() => setSelectedFieldKey('')}>Back to Selection</Button><Button onClick={handleApplyFixes} disabled={isUpdating || Object.keys(mappings).length === 0 || nonStandardValues.length === 0}>{isUpdating ? 'Applying Fixes...' : `Apply Fixes for ${Object.keys(mappings).length} Value(s)`}</Button></div>
            </div>
        );
    };
    return ( <Modal isOpen={isOpen} onClose={onClose} title="Clean Facility Data"><div className="p-4">{!selectedFieldKey ? renderSelectionScreen() : renderMappingScreen()}</div></Modal> );
};
const LocationMismatchModal = ({ isOpen, onClose, mismatches, onFix }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Location Mismatches Found (${mismatches.length})`} size="lg">
            <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                    The following facilities have coordinates that do not fall within the geographical boundaries of their assigned State and Locality.
                </p>
                {mismatches.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto">
                        <Table headers={['Facility Name', 'Assigned State', 'Assigned Locality', 'Actions']}>
                            {mismatches.map(facility => (
                                <tr key={facility.id}>
                                    <td>{facility['اسم_المؤسسة']}</td>
                                    <td>{STATE_LOCALITIES[facility['الولاية']]?.ar || facility['الولاIAة']}</td>
                                    <td>{LOCALITY_EN_TO_AR_MAP[facility['المحلية']] || facility['المحلية']}</td>
                                    <td>
                                        <Button size="sm" onClick={() => onFix(facility)}>
                                            Fix Location
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </div>
                ) : (
                     <div className="text-center p-4">
                       <EmptyState message="No location mismatches were found." />
                     </div>
                )}
            </div>
            <div className="flex justify-end p-4 border-t">
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
        </Modal>
    );
};

// --- MAIN COMPONENT: ChildHealthServicesView ---
const ChildHealthServicesView = ({
    permissions = {},
    setToast,
    userStates,
    userLocalities,
    canBulkUploadFacilities,
    canCleanFacilityData,
    canFindFacilityDuplicates,
    canCheckFacilityLocations
}) => {
    const handleShareBulkUpdateLink = () => {
        const params = new URLSearchParams();

        // Add any active filters to the query parameters
        if (stateFilter && stateFilter !== 'ALL_STATES' && stateFilter !== 'NOT_ASSIGNED') {
            params.append('state', stateFilter);
        }
        if (localityFilter) {
            params.append('locality', localityFilter);
        }
        if (facilityTypeFilter) {
            params.append('facilityType', facilityTypeFilter);
        }
        if (functioningFilter && functioningFilter !== 'NOT_SET') {
            params.append('functioning', functioningFilter);
        }
        if (projectFilter) {
            params.append('project', projectFilter);
        }
        if (serviceTypeFilter) {
            params.append('service', serviceTypeFilter);
        }

        // Ensure at least one filter is applied so users don't accidentally share the entire database
        if (Array.from(params.keys()).length === 0) {
            setToast({ show: true, message: "Please select at least one filter first.", type: "error" });
            return;
        }
        
        // Use a generic route and attach query parameters
        const url = `${window.location.origin}/public/bulk-update?${params.toString()}`;
        
        navigator.clipboard.writeText(url).then(() => {
            setToast({ show: true, message: "Bulk update link copied to clipboard!", type: "success" });
        });
    };

    const { 
        healthFacilities, 
        fetchHealthFacilities, 
        isFacilitiesLoading,
        fetchPendingFacilitatorSubmissions,
        fetchPendingFederalSubmissions,
        fetchPendingStateSubmissions,
        fetchPendingLocalitySubmissions
    } = useDataCache();
    const [editingFacility, setEditingFacility] = useState(null);
    const [view, setView] = useState('list');
    const [activeTab, setActiveTab] = useState(TABS.ALL);
    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [facilityTypeFilter, setFacilityTypeFilter] = useState('');
    const [functioningFilter, setFunctioningFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [serviceTypeFilter, setServiceTypeFilter] = useState('');
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);
    const [uploadStatus, setUploadStatus] = useState({ inProgress: false, processed: 0, total: 0, errors: [], message: '' });
    const [submissionForReview, setSubmissionForReview] = useState(null);
    const [comparisonFacilities, setComparisonFacilities] = useState([]);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingStartDate, setPendingStartDate] = useState('');
    const [pendingEndDate, setPendingEndDate] = useState('');
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [facilityForMap, setFacilityForMap] = useState(null);
    const [localityBoundaries, setLocalityBoundaries] = useState(null);
    const [isMismatchModalOpen, setIsMismatchModalOpen] = useState(false);
    const [mismatchedFacilities, setMismatchedFacilities] = useState([]);
    const [isCheckingLocations, setIsCheckingLocations] = useState(false);
    const auth = getAuth();
    const [hasManuallySelected, setHasManuallySelected] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

    const notify = (message, type = 'info') => {
        if (setToast) {
            setToast({ show: true, message, type });
        } else {
            alert(message);
        }
    };

   const handlePdfListGeneration = async (quality) => {
        if (!filteredFacilities || filteredFacilities.length === 0) {
            notify("No facilities to export.", 'info');
            return;
        }
        setIsPdfGenerating(true);
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
            await generateFacilityListPdf(
                filteredFacilities, 
                activeTab,
                serviceTypeFilter, 
                quality,
                (message) => notify(message, 'success'), 
                (message) => notify(message, 'error')    
            );
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            notify("Sorry, there was an error generating the PDF.", 'error');
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const availableStates = useMemo(() => {
        const allStates = Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar) );
        if (!userStates || userStates.length === 0) {
            return [ { key: "", label: "-- Select State --" }, { key: "ALL_STATES", label: "All States" }, { key: "NOT_ASSIGNED", label: "Not Assigned" }, ...allStates.map(sKey => ({ key: sKey, label: STATE_LOCALITIES[sKey].ar })) ];
        }
        return [ { key: "", label: "-- Select State --" }, ...allStates .filter(sKey => userStates.includes(sKey)) .map(sKey => ({ key: sKey, label: STATE_LOCALITIES[sKey].ar })) ];
    }, [userStates]);

    useEffect(() => {
        const fetchBoundaries = async () => {
            try {
                const response = await fetch('./sudan_localities.json');
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                setLocalityBoundaries(data);
            } catch (error) {
                console.error("Failed to load locality boundaries:", error);
                setToast({ show: true, message: 'Could not load map boundaries for location checking.', type: 'error' });
            }
        };
        fetchBoundaries();
    }, [setToast]);

    const getCurrentFilters = () => {
         let effectiveLocalityFilter = localityFilter;
         if (permissions.manageScope === 'locality') {
             effectiveLocalityFilter = userLocalities?.[0] || '';
         }
        const filters = { locality: effectiveLocalityFilter, facilityType: facilityTypeFilter, functioningStatus: functioningFilter, project: projectFilter, };
        if (stateFilter && stateFilter !== 'ALL_STATES') { filters.state = stateFilter; }
        if (!stateFilter && (userStates && userStates.length > 0)) { return null; }
        if (permissions.manageScope === 'locality' && !effectiveLocalityFilter) { return null; }
        if ((!userStates || userStates.length === 0) && !stateFilter && Object.keys(filters).every(k => !filters[k] )) { return null; }
        return filters;
    };

    const handleOpenMapModal = (facility) => { setFacilityForMap(facility); setIsMapModalOpen(true); };

    const handleSaveLocation = async (newLocation) => {
        if (!facilityForMap) return;
        const payload = { ...facilityForMap, _الإحداثيات_latitude: newLocation._الإحداثيات_latitude, _الإحداثيات_longitude: newLocation._الإحداثيات_longitude, date_of_visit: facilityForMap.date_of_visit || new Date().toISOString().split('T')[0], };
        try {
            if (permissions.canApproveSubmissions) {
                await saveFacilitySnapshot(payload);
                setToast({ show: true, message: "Facility location updated directly.", type: "success" });
            } else {
                 await submitFacilityDataForApproval(payload, auth.currentUser?.email || 'Unknown User');
                 setToast({ show: true, message: "Facility location update submitted for approval.", type: "info" });
            }
            const currentFilters = getCurrentFilters();
            if (currentFilters) { fetchHealthFacilities(currentFilters, true); }
        } catch (error) {
            setToast({ show: true, message: `Failed to update location: ${error.message}`, type: 'error' });
        }
    };

   const handleCheckLocations = useCallback(() => {
        if (!localityBoundaries || !healthFacilities) { setToast({ show: true, message: 'Boundary data or facility list is not yet loaded.', type: 'info' }); return; }
        setIsCheckingLocations(true);
        const stateKeyToEnName = Object.entries(STATE_LOCALITIES).reduce((acc, [key, value]) => { acc[key] = value.en; return acc; }, {});
        const mismatches = healthFacilities.filter(facility => {
            const lat = parseFloat(facility._الإحداثيات_latitude);
            const lng = parseFloat(facility._الإحداثيات_longitude);
            const stateKey = facility['الولاية'];
            const localityKey = facility['المحلية'];
            if (isNaN(lat) || isNaN(lng) || !stateKey || !localityKey || stateKey === 'NOT_ASSIGNED') { return false; }
            const facilityPoint = point([lng, lat]);
            const stateEn = stateKeyToEnName[stateKey];
            if (!stateEn) return false;
            const preciseBoundaryFeature = localityBoundaries.features.find(f => f.properties.state_en?.toLowerCase() === stateEn.toLowerCase() && f.properties.locality_e?.toLowerCase() === localityKey.toLowerCase() );
            if (preciseBoundaryFeature) { return !booleanPointInPolygon(facilityPoint, preciseBoundaryFeature.geometry); }
            const stateBoundaryFeatures = localityBoundaries.features.filter(f => f.properties.state_en?.toLowerCase() === stateEn.toLowerCase() );
            if (stateBoundaryFeatures.length > 0) { const isWithinState = stateBoundaryFeatures.some(f => booleanPointInPolygon(facilityPoint, f.geometry) ); if (!isWithinState) { return true; } } else { console.warn(`No boundary features found for state: ${stateEn}`); }
            return false;
        });
        setMismatchedFacilities(mismatches);
        setIsMismatchModalOpen(true);
        setIsCheckingLocations(false);
    }, [localityBoundaries, healthFacilities, setToast]);

    const handleFixMismatch = (facility) => { setIsMismatchModalOpen(false); handleOpenMapModal(facility); };

    const CLEANABLE_FIELDS_CONFIG = {
        'الولاية': { label: 'State', standardValues: Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)), isStaffField: false },
        'المحلية': { label: 'Locality', standardValues: Object.values(STATE_LOCALITIES).flatMap(s => s.localities.map(l => l.en)).sort((a, b) => (LOCALITY_EN_TO_AR_MAP[a] || a).localeCompare(LOCALITY_EN_TO_AR_MAP[b] || b)), isStaffField: false },
        'facility_ownership': { label: 'Facility Ownership (ملكية المؤسسة)', standardValues: ['حكومي', 'خاص', 'منظمات', 'اهلي'], isStaffField: false },
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
        'neonatal_sepsis_surveillance': { label: 'Sepsis Surveillance and Prevention', standardValues: ['Yes', 'No'], isStaffField: false },
    };

    const refreshSubmissions = useCallback(async (force = false) => {
        if (!permissions.canManageFacilities) return;
        setIsSubmissionsLoading(true);
        try {
            await Promise.all([
                fetchPendingFacilitatorSubmissions(force),
                fetchPendingFederalSubmissions(force),
                fetchPendingStateSubmissions(force),
                fetchPendingLocalitySubmissions(force),
                (async () => { const subs = await listPendingFacilitySubmissions(); setPendingSubmissions(subs); })()
            ]);
        } catch (error) {
            setToast({ show: true, message: "Failed to load pending submissions.", type: "error" });
        } finally {
            setIsSubmissionsLoading(false);
        }
    }, [ permissions, setToast, fetchPendingFacilitatorSubmissions, fetchPendingFederalSubmissions, fetchPendingStateSubmissions, fetchPendingLocalitySubmissions ]);

    useEffect(() => {
        if (view === 'list') {
            const isLocalityMgr = permissions.manageScope === 'locality';
            const hasAssignedLocality = userLocalities && userLocalities.length > 0;
            if (isLocalityMgr && !hasAssignedLocality) {
                 if (activeTab === TABS.PENDING) { refreshSubmissions(false); }
                 return;
             }
            let fetchLocalityFilter = '';
            if (isLocalityMgr && hasAssignedLocality) { fetchLocalityFilter = userLocalities[0]; } else if (!isLocalityMgr) { fetchLocalityFilter = localityFilter; }
            const filters = { locality: fetchLocalityFilter, facilityType: facilityTypeFilter, functioningStatus: functioningFilter, project: projectFilter, };
            if (stateFilter && stateFilter !== 'ALL_STATES') { filters.state = stateFilter; }
            const shouldFetch = (stateFilter && stateFilter !== 'ALL_STATES') || ((!userStates || userStates.length === 0) && (stateFilter === 'ALL_STATES' || stateFilter === 'NOT_ASSIGNED')) || ((!userStates || userStates.length === 0) && !stateFilter && (filters.locality || filters.facilityType || filters.functioningStatus || filters.project)) || (isLocalityMgr && stateFilter && hasAssignedLocality);
            if (hasManuallySelected && shouldFetch) { fetchHealthFacilities(filters, false); }
            if (activeTab === TABS.PENDING) { refreshSubmissions(false); }
        }
    }, [ view, stateFilter, localityFilter, facilityTypeFilter, functioningFilter, projectFilter, activeTab, fetchHealthFacilities, refreshSubmissions, userStates, userLocalities, permissions.manageScope, hasManuallySelected ]);

    const projectNames = useMemo(() => {
        if (!healthFacilities) return [];
        const names = new Set();
        healthFacilities.forEach(f => { if (f.project_name) { names.add(f.project_name); } });
        return Array.from(names).sort();
    }, [healthFacilities]);

    const uniquePendingSubmissions = useMemo(() => {
        if (!pendingSubmissions) return [];
        const unique = new Map();
        pendingSubmissions.forEach(s => { const key = `${s['اسم_المؤسسة']}-${s['الولاية']}-${s['المحلية']}`; if (!unique.has(key) || s.submittedAt > unique.get(key).submittedAt) { unique.set(key, s); } });
        let filtered = Array.from(unique.values());
        if (pendingStartDate) { const start = new Date(pendingStartDate); start.setHours(0, 0, 0, 0); filtered = filtered.filter(s => s.submittedAt?.toDate() >= start); }
        if (pendingEndDate) { const end = new Date(pendingEndDate); end.setHours(23, 59, 59, 999); filtered = filtered.filter(s => s.submittedAt?.toDate() <= end); }
        return filtered.sort((a, b) => b.submittedAt?.toMillis() - a.submittedAt?.toMillis());
    }, [pendingSubmissions, pendingStartDate, pendingEndDate]);

    const filteredFacilities = useMemo(() => {
        if (!healthFacilities || !hasManuallySelected) return [];
        let facilitiesInScope = [];
        const userScope = permissions.manageScope;
        if (userScope === 'locality') {
            if (userLocalities && userLocalities.length > 0) { const allowedLocalities = new Set(userLocalities); facilitiesInScope = healthFacilities.filter(f => allowedLocalities.has(f['المحلية']) && (!stateFilter || f['الولاية'] === stateFilter) ); } else { return []; }
        } else if (userScope === 'state') {
             if (userStates && userStates.length > 0) { const allowedStates = new Set(userStates); facilitiesInScope = healthFacilities.filter(f => allowedStates.has(f['الولاية'])); } else { return []; }
        } else {
             facilitiesInScope = healthFacilities;
        }
        let filtered = facilitiesInScope.filter(f => {
            if (userScope !== 'state' && userScope !== 'locality') { if (stateFilter && stateFilter !== 'ALL_STATES' && stateFilter !== 'NOT_ASSIGNED' && f['الولاية'] !== stateFilter) { return false; } if (stateFilter === 'NOT_ASSIGNED' && f['الولاية']) { return false; } }
            if (userScope !== 'locality') { if (localityFilter && f['المحلية'] !== localityFilter) { return false; } }
            if (facilityTypeFilter && f['نوع_المؤسسةالصحية'] !== facilityTypeFilter) return false;
            if (projectFilter && f.project_name !== projectFilter) return false;
            if (functioningFilter && functioningFilter !== 'NOT_SET' && f['هل_المؤسسة_تعمل'] !== functioningFilter) return false;
            if (functioningFilter === 'NOT_SET' && (f['هل_المؤسسة_تعمل'] != null && f['هل_المؤسسة_تعمل'] !== '')) return false;
            if (searchQuery) { const lowerQuery = searchQuery.toLowerCase(); if (!f['اسم_المؤسسة']?.toLowerCase().includes(lowerQuery)) return false; }
            if (serviceTypeFilter) {
                 switch (serviceTypeFilter) {
                    case 'IMNCI': if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] !== 'Yes') return false; break;
                    case 'EENC': if (f.eenc_provides_essential_care !== 'Yes') return false; break;
                    case 'Neonatal': if (!f.neonatal_level_of_care || !(f.neonatal_level_of_care.primary || f.neonatal_level_of_care.secondary || f.neonatal_level_of_care.tertiary)) return false; break;
                    case 'Critical Care': if (f.etat_has_service !== 'Yes' && f.hdu_has_service !== 'Yes' && f.picu_has_service !== 'Yes') return false; break;
                    default: break;
                }
            }
            return true;
        });
        filtered.sort((a, b) => (b.lastSnapshotAt?.toMillis() || 0) - (a.lastSnapshotAt?.toMillis() || 0));
        return filtered;
    }, [ healthFacilities, stateFilter, localityFilter, facilityTypeFilter, functioningFilter, projectFilter, searchQuery, serviceTypeFilter, userStates, userLocalities, permissions.manageScope, hasManuallySelected ]);

    useEffect(() => { setCurrentPage(1); }, [filteredFacilities]);
    
    const paginatedFacilities = useMemo(() => {
        if (!filteredFacilities) return [];
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredFacilities.slice(startIndex, endIndex);
    }, [filteredFacilities, currentPage, itemsPerPage]);

    const handleStateChange = (e) => { setStateFilter(e.target.value); setHasManuallySelected(true); if (permissions.manageScope !== 'locality') { setLocalityFilter(''); } };
     
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            if (activeTab === TABS.PENDING) { await refreshSubmissions(true); } else { const currentFilters = getCurrentFilters(); if (currentFilters) { await fetchHealthFacilities(currentFilters, true); } }
            setToast({ show: true, message: "Data refreshed successfully.", type: "success" });
        } catch (error) {
            setToast({ show: true, message: `Failed to refresh: ${error.message}`, type: "error" });
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSaveFacility = async (payload) => {
        const user = auth.currentUser;
        if (!user) { setToast({ show: true, message: 'You must be logged in.', type: 'error' }); return; }
        const finalPayload = { ...payload };
        if (editingFacility?.id) { finalPayload.id = editingFacility.id; }
        try {
            if (permissions.canApproveSubmissions) { await saveFacilitySnapshot(finalPayload); setToast({ show: true, message: 'Facility saved directly.', type: 'success' }); } else { await submitFacilityDataForApproval(finalPayload, user.email || 'Unknown User'); setToast({ show: true, message: 'Facility update submitted for approval.', type: 'info' }); }
            setEditingFacility(null);
            setView('list');
            const currentFilters = getCurrentFilters();
            if (currentFilters) { fetchHealthFacilities(currentFilters, true); }
        } catch (error) {
             setToast({ show: true, message: `Failed to save/submit: ${error.message}`, type: 'error' });
        }
    };

    const handleEditFacility = async (facilityId) => {
        let facility = (filteredFacilities || []).find(f => f.id === facilityId);
        if (!facility) {
             console.warn("Attempting to edit facility not in current filtered list:", facilityId);
             facility = await getHealthFacilityById(facilityId);
             if (facility) {
                  const userScope = permissions.manageScope;
                  if (userScope === 'locality' && (!userLocalities || !userLocalities.includes(facility['المحلية']))) { facility = null; } else if (userScope === 'state' && (!userStates || !userStates.includes(facility['الولاية']))) { facility = null; }
             }
        }
        if (facility) { setEditingFacility(facility); setView('form'); } else { setToast({ show: true, message: 'Facility not found or you do not have permission to edit it.', type: 'error' }); }
    };

    const handleDeleteFacility = async (facilityId) => {
        const user = auth.currentUser;
        if (!user) { setToast({ show: true, message: 'You must be logged in.', type: 'error' }); return; }
        let facility = (filteredFacilities || []).find(f => f.id === facilityId);
        if (!facility) {
            console.warn("Attempting to delete facility not in current filtered list:", facilityId);
             facility = await getHealthFacilityById(facilityId);
             if (facility) {
                  const userScope = permissions.manageScope;
                   if (userScope === 'locality' && (!userLocalities || !userLocalities.includes(facility['المحلية']))) { facility = null; } else if (userScope === 'state' && (!userStates || !userStates.includes(facility['الولاية']))) { facility = null; }
             }
        }
        if (!facility) { setToast({ show: true, message: 'Facility not found or you do not have permission to delete it.', type: 'error' }); return; }
        const confirmMessage = permissions.canApproveSubmissions ? `Are you sure you want to permanently delete "${facility['اسم_المؤسسة']}"? This action cannot be undone.` : `Are you sure you want to request deletion for "${facility['اسم_المؤسسة']}"? This will be sent for approval.`;
        if (window.confirm(confirmMessage)) {
            try {
                if (permissions.canApproveSubmissions) {
                    await deleteHealthFacility(facilityId);
                    setToast({ show: true, message: 'Facility deleted.', type: 'success' });
                } else {
                    const updaterIdentifier = user.displayName ? `${user.displayName} (${user.email})` : user.email;
                    const payload = { ...facility, _action: 'DELETE', updated_by: updaterIdentifier, 'اخر تحديث': new Date().toISOString(), };
                    await submitFacilityDataForApproval(payload, user.email || 'Unknown User');
                    setToast({ show: true, message: 'Deletion request submitted for approval.', type: 'info' });
                }
                const currentFilters = getCurrentFilters();
                if (currentFilters) { fetchHealthFacilities(currentFilters, true); }
            } catch (error) {
                setToast({ show: true, message: `Failed to process request: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleImport = async (data, originalRows) => {
        if (!permissions.canApproveSubmissions) { setToast({ show: true, message: 'You do not have permission to import facilities.', type: 'error' }); return; }
        setUploadStatus({ inProgress: true, processed: 0, total: data.length, errors: [], message: '' });
        try {
            const { successes, errors, failedRowsData } = await importHealthFacilities(data, originalRows, (progress) => { setUploadStatus(prev => ({ ...prev, processed: progress.processed })); });
            const successCount = successes.length;
            const errorCount = errors.length;
            let message = `${successCount} facilities imported/updated successfully.`;
            if (errorCount > 0) { message += `\n${errorCount} rows failed to import.`; }
             setUploadStatus(prev => ({ ...prev, inProgress: false, message, errors: failedRowsData }));
            const currentFilters = getCurrentFilters();
            if (currentFilters) { fetchHealthFacilities(currentFilters, true); }
        } catch (error) {
             setUploadStatus({ inProgress: false, processed: 0, total: 0, errors: [{ message: error.message }], message: `Import failed: ${error.message}` });
        }
    };

    const handleConfirmApproval = async (submissionData) => {
        if (!permissions.canApproveSubmissions) return;
        try {
            if (submissionData._action === 'DELETE') {
                 await deleteHealthFacility(submissionData.id);
                 await rejectFacilitySubmission(submissionData.submissionId, auth.currentUser?.email || 'Unknown Approver');
                 setToast({ show: true, message: "Facility deletion approved and completed.", type: "success" });
            } else {
                await approveFacilitySubmission(submissionData, auth.currentUser?.email || 'Unknown Approver');
                setToast({ show: true, message: "Submission approved and facility data updated.", type: "success" });
            }
            setSubmissionForReview(null);
            setComparisonFacilities([]);
            refreshSubmissions(true);
            const currentFilters = getCurrentFilters();
            if (currentFilters) { fetchHealthFacilities(currentFilters, true); }
        } catch (error) {
             setToast({ show: true, message: `Approval failed: ${error.message}`, type: 'error' });
        }
    };

    const handleReject = async (submissionId, isDeletionRequest = false) => {
        if (!permissions.canApproveSubmissions) return;
        const action = isDeletionRequest ? "deletion request" : "submission";
        if (window.confirm(`Are you sure you want to reject this ${action}?`)) {
            try {
                await rejectFacilitySubmission(submissionId, auth.currentUser?.email || 'Unknown Rejector');
                setToast({ show: true, message: "Submission rejected.", type: "success" });
                refreshSubmissions(true);
            } catch (error) {
                setToast({ show: true, message: `Rejection failed: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleReviewSubmission = useCallback(async (submission) => {
        setIsReviewLoading(true);
        setSubmissionForReview(submission);
        try {
             let relevantFacilities = healthFacilities || [];
             const userScope = permissions.manageScope;
             if(userScope === 'state' && userStates && userStates.length > 0) { const allowedStates = new Set(userStates); relevantFacilities = relevantFacilities.filter(f => allowedStates.has(f['الولاية'])); }
            setComparisonFacilities(relevantFacilities);
        } catch (error) {
            setToast({ show: true, message: 'Failed to load comparison data.', type: 'error' });
        } finally {
            setIsReviewLoading(false);
        }
    }, [healthFacilities, setToast, permissions.manageScope, userStates]);


    const handleGenerateLink = (facilityId) => {
        let url = `${window.location.origin}/facilities/data-entry/${facilityId}`;
        if (serviceTypeFilter) { url += `?service=${encodeURIComponent(serviceTypeFilter)}`; }
        navigator.clipboard.writeText(url).then(() => { setToast({ show: true, message: 'Public update link copied to clipboard!', type: 'success' }); }, (err) => { setToast({ show: true, message: 'Failed to copy link.', type: 'error' }); });
    };

    const handleShareLink = () => {
         let url = `${window.location.origin}/facilities/data-entry/new`;
         if (serviceTypeFilter) { url += `?service=${encodeURIComponent(serviceTypeFilter)}`; }
         navigator.clipboard.writeText(url).then(() => { setToast({ show: true, message: 'Public "Add New Facility" link copied to clipboard!', type: 'success' }); }, (err) => { setToast({ show: true, message: 'Failed to copy link.', type: 'error' }); });
    };

    const handleExportExcel = () => {
        if (!filteredFacilities) return;
        const configKey = serviceTypeFilter || activeTab;
        const { headers: finalHeaders, dataKeys: finalDataKeys, fileName } = getServiceConfig(configKey);
        const data = filteredFacilities.map(f => {
             const flatFacilityData = { ...f };
             if (f.imnci_staff && Array.isArray(f.imnci_staff)) {
                f.imnci_staff.slice(0, 5).forEach((staff, index) => {
                    const i = index + 1;
                    flatFacilityData[`imnci_staff_${i}_name`] = staff.name;
                    flatFacilityData[`imnci_staff_${i}_job_title`] = staff.job_title;
                    flatFacilityData[`imnci_staff_${i}_is_trained`] = staff.is_trained || 'No';
                    flatFacilityData[`imnci_staff_${i}_training_date`] = staff.training_date;
                    flatFacilityData[`imnci_staff_${i}_phone`] = staff.phone;
                });
             }
             if (f.neonatal_level_of_care && typeof f.neonatal_level_of_care === 'object') {
                flatFacilityData.neonatal_level_of_care_primary = f.neonatal_level_of_care.primary ? 'Yes' : 'No';
                flatFacilityData.neonatal_level_of_care_secondary = f.neonatal_level_of_care.secondary ? 'Yes' : 'No';
                flatFacilityData.neonatal_level_of_care_tertiary = f.neonatal_level_of_care.tertiary ? 'Yes' : 'No';
             }
             return finalDataKeys.map(key => flatFacilityData[key] ?? '');
        });
        const worksheet = XLSX.utils.aoa_to_sheet([finalHeaders, ...data]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facilities");
        XLSX.writeFile(workbook, `Export_${fileName}`);
    };

    const formInitialData = useMemo(() => {
        if (editingFacility) { return editingFacility; }
        const prefilledData = {};
        if (userStates && userStates.length === 1) { prefilledData['الولاية'] = userStates[0]; }
        if (userLocalities && userLocalities.length === 1) { prefilledData['المحلية'] = userLocalities[0]; }
        return prefilledData;
    }, [editingFacility, userStates, userLocalities]);


    const renderListView = () => {
        const FACILITY_TYPES = ["مركز صحة الاسرة", "مستشفى ريفي", "وحدة صحة الاسرة", "مستشفى"];
        const SERVICE_TYPES = ['IMNCI', 'EENC', 'Neonatal', 'Critical Care'];
        
        const isLocalityManager = permissions.manageScope === 'locality';
        const isStateManager = permissions.manageScope === 'state';
        const isRestrictedUser = isLocalityManager || isStateManager;
        const isUnassignedLocalityManager = isLocalityManager && (!userLocalities || userLocalities.length === 0);
        const isUnassignedStateManager = isStateManager && (!userStates || userStates.length === 0);

        let emptyStateMessage = "No health facilities found for the selected criteria.";
        if (isUnassignedLocalityManager) { emptyStateMessage = "You are a Locality Manager but do not have a locality assigned. Please contact an administrator."; } 
        else if (isUnassignedStateManager) { emptyStateMessage = "You are a State Manager but do not have a state assigned. Please contact an administrator."; } 
        else if (!stateFilter && isRestrictedUser) { emptyStateMessage = "Please select your assigned State to view facilities."; } 
        else if (!stateFilter && !isRestrictedUser) { emptyStateMessage = "Please select a State or apply other filters to begin viewing facilities."; } 
        else if (!hasManuallySelected) { emptyStateMessage = "Please select a State or apply other filters to begin viewing facilities."; }

        const tabsContent = {
            [TABS.PENDING]: <PendingSubmissionsTab submissions={uniquePendingSubmissions || []} onApprove={handleReviewSubmission} onReject={handleReject} />,
            [TABS.ALL]: <AllFacilitiesTab facilities={paginatedFacilities || []} onEdit={handleEditFacility} onDelete={handleDeleteFacility} onGenerateLink={handleGenerateLink} onOpenMap={handleOpenMapModal} emptyMessage={emptyStateMessage} canApproveSubmissions={permissions.canApproveSubmissions} canManageFacilities={permissions.canManageFacilities} />,
        };
        const availableTabs = Object.values(TABS).filter(tab => tab === TABS.PENDING ? permissions.canManageFacilities : true);
        const showFiltersAndActions = activeTab !== TABS.PENDING;

        const isStateFilterDisabled = userStates && userStates.length === 1;
        const isLocalityFilterDisabled = isLocalityManager || !stateFilter || stateFilter === 'NOT_ASSIGNED' || stateFilter === 'ALL_STATES';
        
        const totalFacilities = filteredFacilities ? filteredFacilities.length : 0;
        const totalPages = Math.ceil(totalFacilities / itemsPerPage);


        return (<Card>
            <div className="p-6">
                <div className="flex justify-between items-center">
                    <PageHeader 
                        title="Child Health Services Management" 
                        subtitle="Manage health facilities and their pediatric services."
                    />
                    <Button 
                        variant="secondary" 
                        onClick={handleRefresh} 
                        disabled={isRefreshing}
                        className="flex items-center gap-2"
                    >
                        {isRefreshing ? (
                            <> <Spinner size="sm" /> Refreshing... </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.759l.274.549a.75.75 0 101.3-.65l-.274-.549a5.479 5.479 0 016.128-4.032.75.75 0 00.573-1.376 6.979 6.979 0 00-7.75-2.088l-.94-.313a.75.75 0 00-.913.655v1.944a.75.75 0 001.5 0V7.32l.94.313a5.479 5.479 0 016.128 4.032zM4.688 8.576a5.5 5.5 0 019.201-2.759l-.274-.549a.75.75 0 10-1.3.65l.274.549a5.479 5.479 0 01-6.128 4.032.75.75 0 00-.573 1.376 6.979 6.979 0 007.75 2.088l.94.313a.75.75 0 00.913-.655V12.06a.75.75 0 00-1.5 0v1.631l-.94-.313a5.479 5.479 0 01-6.128-4.032z" clipRule="evenodd" />
                                </svg>
                                Refresh
                            </>
                        )}
                    </Button>
                </div>
                
                <div className="border-b border-gray-200 mt-6"><nav className="-mb-px flex space-x-4 overflow-x-auto">{availableTabs.map(tabName => (<button key={tabName} onClick={() => setActiveTab(tabName)} className={`${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm`}>{tabName}{tabName === TABS.PENDING && uniquePendingSubmissions && uniquePendingSubmissions.length > 0 && <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{uniquePendingSubmissions.length}</span>}</button>))}</nav></div>

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
                    <div className="flex flex-wrap gap-4 my-4 items-end">
                       <div className="flex-1 min-w-[160px]"><FormGroup label="Filter by State"><Select value={stateFilter} onChange={handleStateChange} disabled={isStateFilterDisabled}>{availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></FormGroup></div>
                       <div className="flex-1 min-w-[160px]">
                            <FormGroup label="Filter by Locality">
                                <Select value={localityFilter} onChange={(e) => { setLocalityFilter(e.target.value); setHasManuallySelected(true); }} disabled={isLocalityFilterDisabled}>
                                    {isLocalityManager ? (
                                        userLocalities && userLocalities.length > 0 ? ( userLocalities.map(locEn => { const locAr = stateFilter && STATE_LOCALITIES[stateFilter]?.localities.find(l => l.en === locEn)?.ar || locEn; return <option key={locEn} value={locEn}>{locAr}</option>; }) ) : ( <option value="">-- No Locality Assigned --</option> )
                                    ) : (
                                         <> <option value="">All Localities</option> {stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a, b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option> )} </>
                                    )}
                                </Select>
                            </FormGroup>
                        </div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label="Filter by Facility Type"><Select value={facilityTypeFilter} onChange={(e) => { setFacilityTypeFilter(e.target.value); setHasManuallySelected(true); }}><option value="">All Types</option>{FACILITY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</Select></FormGroup></div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label="Filter by Service"><Select value={serviceTypeFilter} onChange={(e) => { setServiceTypeFilter(e.target.value); setHasManuallySelected(true); }}><option value="">All Services</option>{SERVICE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</Select></FormGroup></div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label="Functioning Status"><Select value={functioningFilter} onChange={(e) => { setFunctioningFilter(e.target.value); setHasManuallySelected(true); }}><option value="">All</option><option value="Yes">Yes</option><option value="No">No</option><option value="NOT_SET">Not Set</option></Select></FormGroup></div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label="Filter by Project Name"><Select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setHasManuallySelected(true); }}><option value="">All Projects</option>{(projectNames || []).map(name => <option key={name} value={name}>{name}</option>)}</Select></FormGroup></div>
                    </div>

                    <div className="flex justify-between items-center my-4">
                        <div className="flex flex-wrap gap-2">
                            {permissions.canManageFacilities && ( <Button onClick={() => { setEditingFacility(null); setView('form'); }}>Add New</Button> )}
                            {canBulkUploadFacilities && ( <Button onClick={() => setIsBulkUploadModalOpen(true)}>Bulk Upload</Button> )}
                            <Button variant="info" onClick={handleShareLink}>Share Entry Link</Button>
                            
                            <Button variant="info" onClick={handleShareBulkUpdateLink}>Share Bulk Update Link</Button>
                            
                            <Button variant="secondary" onClick={handleExportExcel} disabled={!filteredFacilities || filteredFacilities.length === 0}>Export Excel</Button>
                            
                            {isPdfGenerating ? (
                                <Button disabled variant="secondary"><Spinner size="sm" /> Generating PDF...</Button>
                            ) : (
                                <>
                                    <Button onClick={() => handlePdfListGeneration('print')} variant="secondary" className="flex items-center gap-1" disabled={!filteredFacilities || filteredFacilities.length === 0}>
                                        <PdfIcon /> Export PDF (Print)
                                    </Button>
                                    <Button onClick={() => handlePdfListGeneration('screen')} variant="secondary" className="flex items-center gap-1" disabled={!filteredFacilities || filteredFacilities.length === 0}>
                                        <PdfIcon /> Export PDF (Share)
                                    </Button>
                                </>
                            )}
                        </div>
                         
                        <div className="flex flex-wrap gap-2">
                             {canFindFacilityDuplicates && ( <Button variant="secondary" onClick={() => setIsDuplicateModalOpen(true)}>Find Duplicates</Button> )}
                             {canCleanFacilityData && ( <Button variant="secondary" onClick={() => setIsCleanupModalOpen(true)}>Clean Data</Button> )}
                             {canCheckFacilityLocations && ( <Button variant="secondary" onClick={handleCheckLocations} disabled={isCheckingLocations || !localityBoundaries}>{isCheckingLocations ? 'Checking...' : 'Check Locations'}</Button> )}
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                        {hasManuallySelected ? `Showing ${totalFacilities} facilities.` : 'Select filters to view data.'}
                    </p>
                     <div className="my-4">
                        <Input type="search" placeholder="Search by Facility Name..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setHasManuallySelected(true); }} />
                    </div>
                </>)}

                {isFacilitiesLoading || isReviewLoading || (activeTab === TABS.PENDING && isSubmissionsLoading) ? (
                    <div className="flex justify-center items-center h-48"><Spinner /></div>
                ) : (
                    <div className="mt-4" id="facility-list-content">
                        {tabsContent[activeTab]}
                    </div>
                )}
                
                {showFiltersAndActions && hasManuallySelected && totalFacilities > 0 && (
                    <div className="flex justify-between items-center mt-4 p-4 border-t">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-700">
                                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (Total: {totalFacilities} facilities)
                            </span>
                            <div className="flex items-center gap-2">
                                <label htmlFor="itemsPerPageSelect" className="text-sm font-medium text-gray-700">Per Page:</label>
                                <Select
                                    id="itemsPerPageSelect"
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="w-20"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </Select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} > &larr; Previous </Button>
                            <Button variant="secondary" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || totalPages === 0} > Next &rarr; </Button>
                        </div>
                    </div>
                )}
            </div>
        </Card>);
    };

    const renderFormView = () => {
        const formFields = { 'IMNCI': IMNCIFormFields, 'EENC': EENCFormFields, 'Neonatal': NeonatalFormFields, 'Critical Care': CriticalCareFormFields, };
        const currentTabForForm = serviceTypeFilter || 'IMNCI'; 
        const FormComponent = formFields[currentTabForForm] || IMNCIFormFields;
        const arabicTitle = ARABIC_TITLES[currentTabForForm] || currentTabForForm;
        const saveButtonText = permissions.canApproveSubmissions ? "Save Directly" : "Submit for Approval";
        return (
            <GenericFacilityForm
                initialData={formInitialData}
                onSave={handleSaveFacility}
                onCancel={() => { setEditingFacility(null); setView('list'); }}
                setToast={setToast}
                title={editingFacility ? `Edit Facility Data` : `Add New Facility`}
                subtitle={editingFacility ? `تعديل تفاصيل المؤسسة` : `أدخل تفاصيل المؤسسة`}
                saveButtonText={saveButtonText}
                userAssignedState={userStates && userStates.length === 1 ? userStates[0] : null}
                userAssignedLocality={userLocalities && userLocalities.length === 1 ? userLocalities[0] : null}
            >
                {(props) => (
                    <>
                        <h3 className="text-lg font-semibold text-sky-700 border-b pb-2 mb-4">IMNCI Services (خدمات العلاج المتكامل لأمراض الطفولة)</h3>
                        <IMNCIFormFields {...props} />
                        <hr className="my-6 border-t-2 border-gray-200" />
                        
                        <h3 className="text-lg font-semibold text-teal-700 border-b pb-2 mb-4">EENC Services (خدمات الرعاية الطارئة لحديثي الولادة)</h3>
                        <EENCFormFields {...props} />
                        <hr className="my-6 border-t-2 border-gray-200" />

                        <h3 className="text-lg font-semibold text-indigo-700 border-b pb-2 mb-4">Neonatal Care Unit (وحدة رعاية حديثي الولادة)</h3>
                        <NeonatalFormFields {...props} />
                        <hr className="my-6 border-t-2 border-gray-200" />

                        <h3 className="text-lg font-semibold text-red-700 border-b pb-2 mb-4">Emergency & Critical Care (الطوارئ والرعاية الحرجة)</h3>
                        <CriticalCareFormFields {...props} />
                    </>
                )}
            </GenericFacilityForm>
        );
    };
    
    return (
        <>
            {view === 'list' ? renderListView() : renderFormView()}
            <ApprovalComparisonModal
                submission={submissionForReview}
                allFacilities={comparisonFacilities}
                onClose={() => {
                    setSubmissionForReview(null);
                    setComparisonFacilities([]);
                }}
                onConfirm={handleConfirmApproval}
                setToast={setToast}
            />
            <BulkUploadModal
                isOpen={isBulkUploadModalOpen}
                onClose={() => {
                    setIsBulkUploadModalOpen(false);
                    setUploadStatus({ inProgress: false, processed: 0, total: 0, errors: [], message: '' });
                }}
                onImport={handleImport}
                activeTab={serviceTypeFilter || activeTab}
                uploadStatus={uploadStatus}
                filteredData={filteredFacilities || []}
                cleanupConfig={CLEANABLE_FIELDS_CONFIG}
            />
            <DuplicateFinderModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                facilities={filteredFacilities || []}
                onDuplicatesDeleted={() => {
                    const currentFilters = getCurrentFilters();
                    if (currentFilters) fetchHealthFacilities(currentFilters, true);
                }}
            />
            <DataCleanupModal
                isOpen={isCleanupModalOpen}
                onClose={() => setIsCleanupModalOpen(false)}
                facilities={filteredFacilities || []}
                onCleanupComplete={() => {
                    const currentFilters = getCurrentFilters();
                    if (currentFilters) fetchHealthFacilities(currentFilters, true);
                }}
                setToast={setToast}
                cleanupConfig={CLEANABLE_FIELDS_CONFIG}
            />
            <LocationMapModal
                isOpen={isMapModalOpen}
                onClose={() => setIsMapModalOpen(false)}
                facility={facilityForMap}
                onSaveLocation={handleSaveLocation}
            />
            <LocationMismatchModal
                isOpen={isMismatchModalOpen}
                onClose={() => setIsMismatchModalOpen(false)}
                mismatches={mismatchedFacilities}
                onFix={handleFixMismatch}
            />
        </>
    );
};

export default ChildHealthServicesView;