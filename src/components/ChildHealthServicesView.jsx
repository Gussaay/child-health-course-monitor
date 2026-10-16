// ChildHealthServicesView.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { getAuth } from "firebase/auth";
import { writeBatch, collection, getDocs, doc, addDoc, serverTimestamp } from "firebase/firestore"; 
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from "../firebase";
import { useDataCache } from '../DataContext';
import { amiriFontBase64 } from './AmiriFont.js';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';

// --- ICONS ---
import { PdfIcon } from './CommonComponents';
import { List, FileText, Users, Building, PlusCircle, ArrowLeft, Search, LineChart, Activity } from 'lucide-react';

import NameStandardizationModal from './NameStandardizationModal.jsx';
import { useStandardNames } from '../hooks/useNameRegistry';
import { canonicalOptions } from '../utils/nameRegistry';
import LocationMapModal from './ChildHealthServicesMap.jsx';
import FacilityHistoryView, { AggregateHistoryDashboard } from './FacilityHistoryView.jsx'; 
import { UpdateDashboard } from './UpdateDashboard.jsx'; 

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

import {
    Card, PageHeader, Button, FormGroup, Select, Table,
    Modal, Spinner, EmptyState, Checkbox, Input, SkeletonTable
} from './CommonComponents';
import {
    saveFacilitySnapshot,
    upsertHealthFacility,
    importHealthFacilities,
    deleteHealthFacility,
    deleteFacilitiesBatch,
    getHealthFacilityById,
    listPendingFacilitySubmissions,
    approveFacilitySubmission,
    rejectFacilitySubmission,
    submitFacilityDataForApproval,
    listFacilitiesByLocality,
    fetchFacilitiesHistoryMultiDate
} from "../data.js"; 
import {
    GenericFacilityForm,
    IMNCIFormFields,
    EENCFormFields,
    NeonatalFormFields,
    CriticalCareFormFields,
    SaveStatusModal 
} from './FacilityForms.jsx';
import { STATE_LOCALITIES } from "./constants.js";
import { notify, confirmDialog } from './dialogs';
import { publicBaseUrl } from '../utils/publicLink';

// MISSING IMPLEMENTATION — generateFacilityListPdf is called below but has never
// been defined in this file or imported from anywhere, so the facility-list PDF
// export has always failed. The call sits inside a try/catch, which is why it
// failed quietly rather than crashing. Restore the real generator here.
async function generateFacilityListPdf(_facilities, _activeTab, _serviceTypeFilter, _quality, _onSuccess, onError) {
    onError?.('The facility list PDF export is not available in this build.');
}


const TABS = {
    PENDING: 'Pending Submissions',
    ALL: 'All Facilities',
};

// --- HELPER FUNCTIONS ---

const removeUndefinedProperties = (obj) => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    // Preserve Firebase Dates and Timestamps
    if (obj instanceof Date || (typeof obj.toDate === 'function')) return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(removeUndefinedProperties);
    }
    
    const result = {};
    for (const key in obj) {
        if (obj[key] !== undefined) {
            result[key] = removeUndefinedProperties(obj[key]);
        }
    }
    return result;
};

const deepEqual = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

const getDisplayableValue = (value, t) => {
    if (value === null || value === undefined) return t('facilities_page.common.na', 'N/A');
    if (typeof value === 'boolean') return value ? t('facilities_page.common.yes', 'Yes') : t('facilities_page.common.no', 'No');
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === 'object' && value !== null) {
         if (Array.isArray(value)) { return value.length > 0 ? value.map(v => v.name || JSON.stringify(v)).join(', ') : t('facilities_page.common.na', 'N/A'); }
         if ('primary' in value || 'secondary' in value || 'tertiary' in value) {
             const levels = [];
             if (value.primary) levels.push(t('facilities_page.history.level_primary', 'Primary'));
             if (value.secondary) levels.push(t('facilities_page.history.level_special_care', 'Special Care'));
             if (value.tertiary) levels.push('NICU');
             return levels.length > 0 ? levels.join(', ') : t('facilities_page.common.na', 'N/A');
         }
         return JSON.stringify(value);
    }
    return String(value);
};

const getFieldLabelsForComparison = (t) => ({
    'اسم_المؤسسة': t('facilities_page.history.fields.facility_name', 'Facility Name'), 
    'الولاية': t('facilities_page.history.fields.state', 'State'), 
    'المحلية': t('facilities_page.history.fields.locality', 'Locality'), 
    'facility_ownership': t('facilities_page.history.fields.facility_ownership', 'Facility Ownership'), 
    'نوع_المؤسسةالصحية': t('facilities_page.history.fields.facility_type', 'Facility Type'), 
    'هل_المؤسسة_تعمل': t('facilities_page.history.fields.functioning', 'Functioning'), 
    '_الإحداثيات_latitude': t('facilities_page.history.fields.latitude', 'Latitude'), 
    '_الإحداثيات_longitude': t('facilities_page.history.fields.longitude', 'Longitude'), 
    'وجود_العلاج_المتكامل_لامراض_الطفولة': t('facilities_page.history.fields.imnci_service', 'IMNCI Service'), 
    'eenc_provides_essential_care': t('facilities_page.history.fields.eenc_service', 'EENC Service'), 
    'eenc_trained_workers': t('facilities_page.history.fields.eenc_trained_workers', 'EENC Trained Workers'), 
    'neonatal_level_of_care': t('facilities_page.history.fields.neonatal_level_of_care', 'Neonatal Level of Care'), 
    'neonatal_total_beds': t('facilities_page.history.fields.neonatal_total_beds', 'Neonatal Total Beds'), 
    'neonatal_incubators': t('facilities_page.history.fields.neonatal_incubators', 'Neonatal Incubators'), 
    'etat_has_service': t('facilities_page.history.fields.etat_service', 'ETAT Service'), 
    'hdu_has_service': t('facilities_page.history.fields.hdu_service', 'HDU Service'), 
    'picu_has_service': t('facilities_page.history.fields.picu_service', 'PICU Service'), 
    'imnci_staff': t('facilities_page.history.fields.imnci_staff_list', 'IMNCI Staff List')
});

const STAFF_ARRAY_KEYS = ['imnci_staff', 'eenc_staff', 'neonatal_staff', 'critical_staff'];

const compareFacilities = (oldData, newData, t) => {
    const FIELD_LABELS_FOR_COMPARISON = getFieldLabelsForComparison(t);
    const changes = [];
    const ignoreFields = [
        'id', 'submissionId', 'submittedAt', 'updated_by', 'اخر تحديث', 'date_of_visit',
        'createdAt', 'lastSnapshotAt', 'originalFacilityId', 'status'
    ];

    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    
    allKeys.forEach(key => {
        if (key.startsWith('_') || ignoreFields.includes(key)) { return; }

        const oldValue = oldData?.[key];
        const newValue = newData?.[key];

        if (STAFF_ARRAY_KEYS.includes(key)) {
            const oldStaff = Array.isArray(oldValue) ? oldValue : [];
            const newStaff = Array.isArray(newValue) ? newValue : [];
            const maxLen = Math.max(oldStaff.length, newStaff.length);
            
            const serviceName = key.split('_')[0].toUpperCase();

            for (let i = 0; i < maxLen; i++) {
                const os = oldStaff[i] || {};
                const ns = newStaff[i] || {};
                const staffFields = new Set([...Object.keys(os), ...Object.keys(ns)]);

                staffFields.forEach(field => {
                    if (!deepEqual(os[field], ns[field])) {
                        const niceLabel = t('facilities_page.services.staff_change_label', '{{service}} Staff {{n}}: {{field}}', { service: serviceName, n: i + 1, field: field.replace(/_/g, ' ') });
                        changes.push({
                            key: `${key}_${i}_${field}`,
                            label: niceLabel,
                            from: getDisplayableValue(os[field], t),
                            to: getDisplayableValue(ns[field], t)
                        });
                    }
                });
            }
            return; 
        }

        if (!deepEqual(oldValue, newValue)) { 
            changes.push({ 
                key: key, 
                label: FIELD_LABELS_FOR_COMPARISON[key] || key.replace(/_/g, ' '), 
                from: getDisplayableValue(oldValue, t), 
                to: getDisplayableValue(newValue, t) 
            }); 
        }
    });
    
    return changes;
};

const getServiceConfig = (serviceType) => {
    const baseConfig = { 
        headers: ["ID", "الولاية", "المحلية", "اسم المؤسسة", "ملكية المؤسسة", "نوع المؤسسةالصحية", "نوع الخدمات", "Date of Visit"], 
        dataKeys: ["id", "الولاية", "المحلية", "اسم_المؤسسة", "facility_ownership", "نوع_المؤسسةالصحية", "eenc_service_type", "date_of_visit"] 
    };
    const baseImnciHeaders = ["هل المؤسسة تعمل", "هل توجد حوافز للاستاف", "ما هي المنظمة المقدم للحوافز", "هل تشارك المؤسسة في أي مشروع", "ما هو اسم المشروع", "رقم هاتف المسئول من المؤسسة", "وجود العلاج المتكامل لامراض الطفولة", "العدد الكلي للكوادر الطبية العاملة (أطباء ومساعدين)", "العدد الكلي للكودار المدربة على العلاج المتكامل", "وجود سجل علاج متكامل", "وجود كتيب لوحات", "ميزان وزن", "ميزان طول", "ميزان حرارة", "ساعة مؤقت", "غرفة إرواء", "وجود الدعم المادي", "_الإحداثيات_latitude", "_الإحداثيات_longitude", "هل يوجد مكتب تحصين", "اين يقع اقرب مركز تحصين", "هل يوجد مركز تغذية خارجي", "اين يقع اقرب مركز تغذية خارجي", "هل يوجد خدمة متابعة النمو"];
    const baseImnciDataKeys = ["هل_المؤسسة_تعمل", "staff_incentives", "staff_incentives_organization", "project_participation", "project_name", "person_in_charge_phone", "وجود_العلاج_المتكامل_لامراض_الطفولة", "العدد_الكلي_لكوادر_طبية_العاملة_أطباء_ومساعدين", "العدد_Kلي_للكودار_ المدربة_على_العلاج_المتكامل", "وجود_سجل_علاج_متكامل", "وجود_كتيب_لوحات", "ميزان_وزن", "ميزان_طول", "ميزان_حرارة", "ساعة_ مؤقت", "غرفة_إرواء", "وجود_الدعمادي", "_الإحداثيات_latitude", "_الإحداثيات_longitude", "immunization_office_exists", "nearest_immunization_center", "nutrition_center_exists", "nearest_nutrition_center", "growth_monitoring_service_exists"];
    const MAX_STAFF = 5;
    for (let i = 1; i <= MAX_STAFF; i++) { baseImnciHeaders.push(`اسم الكادر ${i}`, `الوصف الوظيفي للكادر ${i}`, `هل الكادر ${i} مدرب`, `تاريخ تدريب الكادر ${i}`, `رقم هاتف الكادر ${i}`); baseImnciDataKeys.push(`imnci_staff_${i}_name`, `imnci_staff_${i}_job_title`, `imnci_staff_${i}_is_trained`, `imnci_staff_${i}_training_date`, `imnci_staff_${i}_phone`); }
    const imnciConfig = { headers: baseImnciHeaders, dataKeys: baseImnciDataKeys };
    const eencConfig = { headers: ["هل تقدم الرعاية الضرورية المبكرة EENC", "عدد الكوادر الصحية المدربة", "العدد الكلي لسرير الولادة", "العدد الكلي لمحطات الانعاش", "العدد الكلي لاجهزة التدفئة", "العدد الكلي لجهاز الامبوباق", "العدد الكلي لجهاز الشفط اليدوي", "ساعة حائط", "جهاز التعقيم بالبخار", "تاريخ الزيارة لغرفة الولادة"], dataKeys: ["eenc_provides_essential_care", "eenc_trained_workers", "eenc_delivery_beds", "eenc_resuscitation_stations", "eenc_warmers", "eenc_ambu_bags", "eenc_manual_suction", "eenc_wall_clock", "eenc_steam_sterilizer", "eenc_delivery_room_visit_date"] };
    const neonatalConfig = { headers: ["Level of Care - Primary", "Level of Care - Secondary", "Level of Care - Tertiary", "وحدة رعاية الكنغر (KMC unit)", "وحدة الرضاعة الطبيعية (breastfeeding unit)", "وحدة تعقيم (sterilization unit)", "الترصد والحماية من عدوى التسمم الدموي", "إجمالي سعة الأسرة", "العدد الكلي للحضانات (incubators)", "العدد الكلي للاسرة للاطفال مكتملي النمو (cots)", "أجهزة CPAP", "جهاز تدفئة حرارية (warmer)", "مضخة تسريب (infusion pump)", "مضخات الحقن (Syringe pump)", "جهاز شفط (suction machine)", "وحدات العلاج الضوئي (Phototherapy)", "أكياس الإنعاش (Ambu Bag)", "جهاز مراقبة التنفس والاكسجين (Pulse and oxygen Monitor)", "جهاز أكسجين (Oxygen concentrator)", "أسطوانة الاكسجين (oxygen cylinder)", "جهاز تنفس صناعي (Mechanical ventilator)", "حاضنة محمولة (Portable Incubator)", "تاريخ زيارة وحدة حديثي الولادة"], dataKeys: ["neonatal_level_of_care_primary", "neonatal_level_of_care_secondary", "neonatal_level_of_care_tertiary", "neonatal_kmc_unit", "neonatal_breastfeeding_unit", "neonatal_sterilization_unit", "neonatal_sepsis_surveillance", "neonatal_total_beds", "neonatal_total_incubators", "neonatal_total_cots", "neonatal_cpap", "neonatal_warmer", "neonatal_infusion_pump", "neonatal_syringe_pump", "neonatal_sucker", "neonatal_phototherapy", "neonatal_ambu_bag", "neonatal_respiration_monitor", "neonatal_oxygen_machine", "neonatal_oxygen_cylinder", "neonatal_mechanical_ventilator", "neonatal_portable_incubator", "neonatal_unit_visit_date"] };
    
    // Updated configuration for Critical Care export
    const criticalCareConfig = { 
        headers: [
            "ETAT Service", "HDU Service", "PICU Service", "PICU Bed Capacity",
            "ETAT: Separate Pediatric Emergency", "ETAT: Separate Emergency Notes",
            "ETAT: 24 Hours Operation", "ETAT: 24 Hours Notes",
            "ETAT: Triage System", "ETAT: Triage System Notes",
            "ETAT: Cold Cases Clinic", "ETAT: Cold Cases Clinic Notes",
            "ETAT: Specialist Clinics", "ETAT: Specialist Clinics Notes",
            "ETAT: Short Stay Ward", "ETAT: Short Stay Ward Notes",
            "ETAT: Emergency Pharmacy", "ETAT: Emergency Pharmacy Notes",
            "ETAT: Free Medicines", "ETAT: Free Medicines Notes",
            "ETAT: Central Oxygen", "ETAT: Central Oxygen Notes",
            "ETAT: Pediatric Lab", "ETAT: Pediatric Lab Notes",
            "ETAT: Ambu Bags", "ETAT: Oxygen Masks", "ETAT: Glucometers", 
            "ETAT: Fluid Pumps", "ETAT: Suction Machines", "ETAT: CPAP",
            "ETAT Staff: Pediatric Specialist (Total)", "ETAT Staff: Pediatric Specialist (Trained)",
            "ETAT Staff: Pediatric Registrar (Total)", "ETAT Staff: Pediatric Registrar (Trained)",
            "ETAT Staff: General Practitioner (Total)", "ETAT Staff: General Practitioner (Trained)",
            "ETAT Staff: House Officer (Total)", "ETAT Staff: House Officer (Trained)",
            "ETAT Staff: Nurse BSc (Total)", "ETAT Staff: Nurse BSc (Trained)",
            "ETAT Staff: Nurse Diploma (Total)", "ETAT Staff: Nurse Diploma (Trained)",
            "HDU Bed Capacity", "HDU Bed Capacity Notes",
            "HDU: Glucometers", "HDU: Fluid Pumps", "HDU: Suction Machines", "HDU: CPAP",
            "HDU Staff: Pediatric Specialist (Total)", "HDU Staff: Pediatric Specialist (Trained)",
            "HDU Staff: Pediatric Registrar (Total)", "HDU Staff: Pediatric Registrar (Trained)",
            "HDU Staff: General Practitioner (Total)", "HDU Staff: General Practitioner (Trained)",
            "HDU Staff: House Officer (Total)", "HDU Staff: House Officer (Trained)",
            "HDU Staff: Nurse BSc (Total)", "HDU Staff: Nurse BSc (Trained)",
            "HDU Staff: Nurse Diploma (Total)", "HDU Staff: Nurse Diploma (Trained)"
        ], 
        dataKeys: [
            "etat_has_service", "hdu_has_service", "picu_has_service", "picu_bed_capacity",
            "etat_separate_pediatric_emergency", "etat_separate_pediatric_emergency_notes",
            "etat_operation_24_hours", "etat_operation_24_hours_notes",
            "etat_triage_system", "etat_triage_system_notes",
            "etat_cold_cases_clinic", "etat_cold_cases_clinic_notes",
            "etat_specialist_clinics", "etat_specialist_clinics_notes",
            "etat_short_stay_ward", "etat_short_stay_ward_notes",
            "etat_emergency_pharmacy", "etat_emergency_pharmacy_notes",
            "etat_free_medicines", "etat_free_medicines_notes",
            "etat_central_oxygen", "etat_central_oxygen_notes",
            "etat_pediatric_lab", "etat_pediatric_lab_notes",
            "etat_ambu_bag", "etat_oxygen_mask", "etat_glucometer", 
            "etat_fluid_pump", "etat_suction_machine", "etat_cpap",
            "etat_staff_pediatric_specialist_total", "etat_staff_pediatric_specialist_trained",
            "etat_staff_pediatric_registrar_total", "etat_staff_pediatric_registrar_trained",
            "etat_staff_general_practitioner_total", "etat_staff_general_practitioner_trained",
            "etat_staff_house_officer_total", "etat_staff_house_officer_trained",
            "etat_staff_nurse_bsc_total", "etat_staff_nurse_bsc_trained",
            "etat_staff_nurse_diploma_total", "etat_staff_nurse_diploma_trained",
            "hdu_bed_capacity", "hdu_bed_capacity_notes",
            "hdu_glucometer", "hdu_fluid_pump", "hdu_suction_machine", "hdu_cpap",
            "hdu_staff_pediatric_specialist_total", "hdu_staff_pediatric_specialist_trained",
            "hdu_staff_pediatric_registrar_total", "hdu_staff_pediatric_registrar_trained",
            "hdu_staff_general_practitioner_total", "hdu_staff_general_practitioner_trained",
            "hdu_staff_house_officer_total", "hdu_staff_house_officer_trained",
            "hdu_staff_nurse_bsc_total", "hdu_staff_nurse_bsc_trained",
            "hdu_staff_nurse_diploma_total", "hdu_staff_nurse_diploma_trained"
        ] 
    };

    let finalHeaders = [...baseConfig.headers], finalDataKeys = [...baseConfig.dataKeys], fileName = 'Facility_Template.xlsx';
    switch (serviceType) {
        case TABS.IMNCI: case 'IMNCI': finalHeaders.push(...imnciConfig.headers); finalDataKeys.push(...imnciConfig.dataKeys); fileName = 'IMNCI_Template.xlsx'; break;
        case TABS.EENC: case 'EENC': finalHeaders.push(...eencConfig.headers); finalDataKeys.push(...eencConfig.dataKeys); fileName = 'EENC_Template.xlsx'; break;
        case TABS.NEONATAL: case 'Neonatal': 
        case 'Neonatal (Any Level)': case 'Neonatal (Primary)': case 'Neonatal (Secondary)': case 'Neonatal (Tertiary)':
            finalHeaders.push(...eencConfig.headers, ...neonatalConfig.headers); finalDataKeys.push(...eencConfig.dataKeys, ...neonatalConfig.dataKeys); fileName = 'Neonatal_Care_Template.xlsx'; break;
        case TABS.CRITICAL: case 'Critical Care': finalHeaders.push(...eencConfig.headers, ...criticalCareConfig.headers); finalDataKeys.push(...criticalCareConfig.dataKeys); fileName = 'Critical_Care_Template.xlsx'; break;
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

const ActionMenu = ({ onAction, isSuperUserOrFed }) => {
    const items = [
        { id: 'show_list', label: 'عرض قائمة المنشآت', icon: List, color: 'text-blue-600', bg: 'bg-blue-100', border: 'hover:border-blue-400', shadow: 'hover:shadow-blue-100' },
        { id: 'share_imnci', label: 'تحديث معلومات العلاج المتكامل', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'hover:border-emerald-400', shadow: 'hover:shadow-emerald-100' },
        { id: 'share_eenc', label: 'تحديث معلومات الرعاية الضرورية (غرفة الولادة)', icon: Users, color: 'text-teal-600', bg: 'bg-teal-100', border: 'hover:border-teal-400', shadow: 'hover:shadow-teal-100' },
        { id: 'share_neonatal', label: 'تحديث معلومات الرعاية الخاصة (الحضانة)', icon: Building, color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'hover:border-indigo-400', shadow: 'hover:shadow-indigo-100' },
        { id: 'share_etat', label: 'تحديث معلومات الرعاية الحرجة (الحوادث والعناية المكثفة)', icon: PlusCircle, color: 'text-red-600', bg: 'bg-red-100', border: 'hover:border-red-400', shadow: 'hover:shadow-red-100' },
        { id: 'show_update_dashboard', label: 'لوحة متابعة تحديثات المنشآت (Update Dashboard)', icon: Activity, color: 'text-orange-600', bg: 'bg-orange-100', border: 'hover:border-orange-400', shadow: 'hover:shadow-orange-100' },
    ];

    if (isSuperUserOrFed) {
        items.push({ 
            id: 'show_history', 
            label: 'مؤشرات التغطية التاريخية (KPI)', 
            icon: LineChart, 
            color: 'text-purple-600', 
            bg: 'bg-purple-100', 
            border: 'hover:border-purple-400', 
            shadow: 'hover:shadow-purple-100' 
        });
    }

    return (
        <div className="max-w-7xl mx-auto mt-8 p-4 space-y-12" dir="rtl">
            <section>
                <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">خدمات صحة الطفل</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                    {items.map(item => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onAction(item.id)}
                                className={`flex flex-col items-center justify-center p-8 border border-gray-100 rounded-2xl bg-white shadow-sm hover:shadow-lg transition-all duration-300 group ${item.border} ${item.shadow} transform hover:-translate-y-1`}
                            >
                                <div className={`p-5 rounded-2xl mb-5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${item.bg}`}>
                                    <Icon className={`w-8 h-8 ${item.color}`} strokeWidth={1.5} />
                                </div>
                                <div className="font-semibold text-gray-700 text-lg group-hover:text-gray-900 transition-colors text-center">
                                    {item.label}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

const AllFacilitiesTab = ({ facilities, onEdit, onDelete, onGenerateLink, onOpenMap, onOpenHistory, emptyMessage, canApproveSubmissions, canManageFacilities }) => {
    const { t } = useTranslation();
    const getServiceBadges = (f) => {
        const services = [];
        if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') services.push({ name: 'IMNCI', color: 'bg-sky-100 text-sky-800' });
        if (f.eenc_provides_essential_care === 'Yes') services.push({ name: 'EENC', color: 'bg-teal-100 text-teal-800' });
        if (f.neonatal_level_primary === 'Yes' || f.neonatal_level_secondary === 'Yes' || f.neonatal_level_tertiary === 'Yes' || (f.neonatal_level_of_care && (f.neonatal_level_of_care.primary || f.neonatal_level_of_care.secondary || f.neonatal_level_of_care.tertiary))) services.push({ name: 'Neonatal', label: t('facilities_page.services.badge_neonatal', 'Neonatal'), color: 'bg-indigo-100 text-indigo-800' });
        if (f.etat_has_service === 'Yes' || f.hdu_has_service === 'Yes' || f.picu_has_service === 'Yes') services.push({ name: 'Critical', label: t('facilities_page.services.badge_critical', 'Critical'), color: 'bg-red-100 text-red-800' });
        if (services.length === 0) return <span className="text-xs text-gray-500">{t('facilities_page.services.none', 'None')}</span>;
        return <div className="flex flex-wrap gap-1">{services.map(s => <span key={s.name} className={`px-2 py-1 text-xs font-medium rounded-full ${s.color}`}>{s.label || s.name}</span>)}</div>;
    };

    return (
        <Table cardsOnPhone headers={[t('facilities_page.services.col.state', 'State'), t('facilities_page.services.col.locality', 'Locality'), t('facilities_page.services.col.facility_name', 'Facility Name'), t('facilities_page.services.col.ownership', 'Ownership'), t('facilities_page.services.col.functioning', 'Functioning'), t('facilities_page.services.col.services_available', 'Services Available'), t('facilities_page.services.col.last_update', 'Last Update'), t('facilities_page.common.actions', 'Actions')]}>
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
                        <td>{ (f['هل_المؤسسة_تعمل'] === 'Yes' || f['هل_المؤسسة_تعمل'] === 'No') ? <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${f['هل_المؤسسة_تعمل'] === 'Yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{f['هل_المؤسسة_تعمل'] === 'Yes' ? t('facilities_page.common.yes', 'Yes') : t('facilities_page.common.no', 'No')}</span> : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{t('facilities_page.services.not_set', 'Not Set')}</span> }</td>
                        <td>{getServiceBadges(f)}</td>
                        <td>{f.lastSnapshotAt?.toDate ? f.lastSnapshotAt.toDate().toLocaleDateString() : t('facilities_page.common.na', 'N/A')}</td>
                        <td className="min-w-[280px]">
                            <div className="flex flex-nowrap gap-2">
                                {canManageFacilities && (
                                    <>
                                        <Button variant="info" size="sm" onClick={() => onEdit(f.id)}>{t('facilities_page.common.edit', 'Edit')}</Button>
                                        <Button variant="danger" size="sm" onClick={() => onDelete(f.id)}>{t('facilities_page.common.delete', 'Delete')}</Button>
                                    </>
                                )}
                                <Button size="sm" onClick={() => onGenerateLink(f.id)}>{t('facilities_page.services.share_link', 'Share Link')}</Button>
                                <Button variant="secondary" size="sm" onClick={() => onOpenMap(f)}>{t('facilities_page.services.map', 'Map')}</Button>
                                <Button variant="secondary" size="sm" onClick={() => onOpenHistory(f)}>{t('facilities_page.services.history', 'History')}</Button>
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
    const { t } = useTranslation();
    return (
        <Table cardsOnPhone headers={[t('facilities_page.services.col.submission_date', 'Submission Date'), t('facilities_page.services.col.facility_name', 'Facility Name'), t('facilities_page.services.col.state', 'State'), t('facilities_page.services.col.locality', 'Locality'), t('facilities_page.services.col.submitted_by', 'Submitted By'), t('facilities_page.common.actions', 'Actions')]}>
            {(!submissions || submissions.length === 0) ? (
                <EmptyState message={t('facilities_page.services.no_pending', 'No pending submissions found.')} colSpan={6} />
            ) : (
                submissions.map(s => (
                    <tr key={s.submissionId}>
                        <td>{s.submittedAt?.toDate ? s.submittedAt.toDate().toLocaleDateString() : t('facilities_page.common.na', 'N/A')}</td>
                        <td>
                            {s['اسم_المؤسسة']}
                            {s._action === 'DELETE' && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">{t('facilities_page.services.deletion_request', 'Deletion Request')}</span>}
                        </td>
                        <td>{s['الولاية']}</td>
                        <td>{s['المحلية']}</td>
                        <td>{s.updated_by || t('facilities_page.services.public_submission', 'Public Submission')}</td>
                        <td className="flex flex-wrap gap-2">
                            <Button variant="success" size="sm" onClick={() => onApprove(s)}>{t('facilities_page.services.view_approve', 'View / Approve')}</Button>
                            <Button variant="danger" size="sm" onClick={() => onReject(s._mergedSubmissionIds || [s.submissionId], s._action === 'DELETE')}>{t('facilities_page.services.reject', 'Reject')}</Button>
                        </td>
                    </tr>
                ))
            )}
        </Table>
    );
};

const ApprovalComparisonModal = ({ submission, allFacilities, onClose, onConfirm, setToast }) => {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef(null);
    const [isEditing, setIsEditing] = useState(false);
    useEffect(() => { setIsEditing(false); }, [submission]);
    const comparison = useMemo(() => {
        if (!submission) return null;
        const existingFacility = (allFacilities || []).find(f => String(f?.['اسم_المؤسسة'] || '').trim().toLowerCase() === String(submission['اسم_المؤسسة'] || '').trim().toLowerCase() && f?.['الولاية'] === submission['الولاية'] && f?.['المحلية'] === submission['المحلية'] );
        if (existingFacility) { const changes = compareFacilities(existingFacility, submission, t); return { isUpdate: true, changes, hasChanges: changes.length > 0 }; }
        return { isUpdate: false, changes: compareFacilities({}, submission, t), hasChanges: true };
    }, [submission, allFacilities, t]);
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
    const modalTitle = isDeletionRequest ? t('facilities_page.services.review_deletion_title', 'Review Deletion Request: {{name}}', { name: submission['اسم_المؤسسة'] }) : t('facilities_page.services.review_submission_title', 'Review Submission: {{name}}', { name: submission['اسم_المؤسسة'] });
    
    return (
        <Modal isOpen={!!submission} onClose={onClose} title={modalTitle} size="full">
            <div className="p-6 h-full relative overflow-y-auto">
                 <div className="absolute top-4 right-4 z-10 flex gap-2">
                     {(!isEditing || isDeletionRequest) && (
                         <Button variant={isDeletionRequest ? "danger" : "success"} onClick={handleDirectApprove} disabled={isSubmitting}>
                             {isSubmitting ? (isDeletionRequest ? t('facilities_page.services.deleting', 'Deleting...') : t('facilities_page.services.approving', 'Approving...')) : (isDeletionRequest ? t('facilities_page.services.confirm_deletion', 'Confirm Deletion') : t('facilities_page.services.approve', 'Approve')) }
                         </Button>
                     )}
                     {!isSubmitting && ( <Button variant="secondary" onClick={onClose} > {t('facilities_page.common.close', 'Close')} </Button> )}
                 </div>
                 
                {isDeletionRequest && (
                    <div className="p-4 bg-red-100 border border-red-300 rounded-md mb-4 mt-12 flex-shrink-0">
                        <h4 className="font-semibold text-lg text-red-800">{t('facilities_page.services.deletion_request_heading', 'DELETION REQUEST')}</h4>
                        <p className="text-red-700">{t('facilities_page.services.deletion_request_text', 'A user has requested to **permanently delete** this facility. Review the details below. Approving will remove the facility.')}</p>
                    </div>
                )}
                
                {!isDeletionRequest && comparison && (
                     <div className={`p-4 border rounded-md mb-4 mt-12 flex-shrink-0 ${comparison.isUpdate ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
                        <h4 className={`font-semibold text-lg ${comparison.isUpdate ? 'text-yellow-800' : 'text-blue-800'}`}>
                             {comparison.isUpdate ? t('facilities_page.services.summary_of_changes', 'Summary of Changes') : t('facilities_page.services.new_facility_submission', 'New Facility Submission')}
                        </h4>
                            {comparison.hasChanges ? (
                            <div className="mt-2">
                                <Table headers={comparison.isUpdate ? [t('facilities_page.services.field', 'Field'), t('facilities_page.services.previous_value', 'Previous Value'), t('facilities_page.services.new_value', 'New Value')] : [t('facilities_page.services.field', 'Field'), t('facilities_page.services.submitted_value', 'Submitted Value')]}>
                                     {comparison.changes .filter(c => c.to !== t('facilities_page.common.na', 'N/A')) .map(({ label, from, to }) => (
                                        <tr key={label}>
                                            <td className="font-medium capitalize align-top py-2">{label}</td>
                                            {comparison.isUpdate && <td className="align-top py-2"><div className="text-sm bg-red-100 text-red-800 p-2 rounded">{from}</div></td>}
                                            <td className="align-top py-2"><div className="text-sm bg-green-100 text-green-800 p-2 rounded">{to}</div></td>
                                        </tr>
                                    ))}
                                </Table>
                            </div>
                            ) : <p className={`mt-1 ${comparison.isUpdate ? 'text-yellow-700' : 'text-blue-700'}`}>
                                 {comparison.isUpdate ? t('facilities_page.services.no_changes_detected', 'No changes were detected compared to the existing record.') : t('facilities_page.services.no_data_submitted', 'No data submitted?')}
                                </p>}
                    </div>
                )}
                
                {(isEditing || isDeletionRequest) && (
                    <div className={`mb-4 ${!isDeletionRequest && !comparison?.isUpdate ? 'mt-12' : ''}`}>
                        <GenericFacilityForm
                            ref={formRef}
                            initialData={submission}
                            onSave={handleSaveFromForm}
                            onCancel={handleCancelEdit}
                            setToast={setToast}
                            title={isDeletionRequest ? t('facilities_page.services.facility_details_readonly', 'Facility Details (Read-Only)') : t('facilities_page.services.edit_approve_submission', 'Edit & Approve Submission')}
                            subtitle={isDeletionRequest ? t('facilities_page.services.review_before_deletion', 'Review the data below before approving deletion.') : t('facilities_page.services.make_corrections', "Make necessary corrections and click 'Approve'.") }
                            isReadOnly={isDeletionRequest}
                            saveButtonText={t('facilities_page.services.approve_changes', 'Approve Changes')}
                            saveButtonVariant="success"
                            cancelButtonText={t('facilities_page.services.cancel_edit', 'Cancel Edit')}
                            isSubmitting={isSubmitting}
                             userAssignedState={null}
                             userAssignedLocality={null}
                        >
                            {(props) => (
                                <div className="space-y-8">
                                    <IMNCIFormFields {...props} isReadOnly={isDeletionRequest} />
                                    <EENCFormFields {...props} isReadOnly={isDeletionRequest} />
                                    <NeonatalFormFields {...props} isReadOnly={isDeletionRequest} />
                                    <CriticalCareFormFields {...props} isReadOnly={isDeletionRequest} />
                                </div>
                            )}
                        </GenericFacilityForm>
                    </div>
                )}
                 {!isEditing && !isDeletionRequest && (
                     <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
                          <Button variant="info" onClick={() => setIsEditing(true)} disabled={isSubmitting}>
                              {t('facilities_page.services.edit_before_approving', 'Edit Before Approving')}
                          </Button>
                     </div>
                 )}
                 {(isEditing || isDeletionRequest) && <div className="pt-4 flex-shrink-0"></div>}
            </div>
        </Modal>
    );
};

const MappingRow = React.memo(({ field, headers, selectedValue, onMappingChange }) => { const { t } = useTranslation(); return ( <div className="flex items-center"><label className="w-1/2 font-medium text-sm capitalize">{field.label}{field.key === 'اسم_المؤسسة' && '*'}</label><Select value={selectedValue || ''} onChange={(e) => onMappingChange(field.key, e.target.value)} className="flex-1"><option value="">{t('facilities_page.services.select_excel_column', '-- Select Excel Column --')}</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</Select></div> ); });

const BulkUploadModal = ({ isOpen, onClose, onImport, uploadStatus, activeTab, filteredData, cleanupConfig, projectNames = [], canonicalProject = (v) => v }) => {
    const { t } = useTranslation();
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [validationIssues, setValidationIssues] = useState([]);
    const [userCorrections, setUserCorrections] = useState({});
    const [failedRows, setFailedRows] = useState([]);
    
    const [uploadState, setUploadState] = useState('');
    const [uploadLocality, setUploadLocality] = useState('');
    const [uploadProject, setUploadProject] = useState('');

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
            setUploadState(''); setUploadLocality(''); setUploadProject('');
        } 
    }, [isOpen]);

    const FIELD_LABELS = useMemo(() => ({ 'eenc_service_type': 'نوع الخدمات المقدمة', }), []);
    
    const allFacilityFields = useMemo(() => { 
        if (!activeTab) return []; 
        const config = getServiceConfig(activeTab); 
        return [{ key: 'id', label: t('facilities_page.services.id_for_updates', 'ID (for updates)') }, ...config.dataKeys.filter(key => key !== 'id').map(key => ({ key, label: FIELD_LABELS[key] || key.replace(/_/g, ' ') }))]; 
    }, [activeTab, FIELD_LABELS, t]);

    const handleFileUpload = (e) => { 
        const file = e.target.files[0]; if (!file) return; 
        const reader = new FileReader(); 
        reader.onload = (event) => { 
            try { 
                const data = new Uint8Array(event.target.result); 
                const workbook = XLSX.read(data, { type: 'array' }); 
                const worksheet = workbook.Sheets[workbook.SheetNames[0]]; 
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", cellDates: true }); 
                if (jsonData.length < 1) { setError(t('facilities_page.services.excel_empty', 'Excel file appears to be empty.')); return; } 
                setHeaders(jsonData[0].map(h => String(h).trim())); 
                setExcelData(jsonData.slice(1)); 
                setCurrentPage(1); setError(''); 
            } catch (err) { setError(t('facilities_page.services.excel_read_error', 'Error reading Excel file: {{message}}', { message: err.message })); } 
        }; 
        reader.readAsArrayBuffer(file); 
    };

    const handleDownloadTemplate = () => {
        const { headers: finalHeaders, dataKeys: finalDataKeys, fileName } = getServiceConfig(activeTab);
        let downloadFileName = `New_Facilities_${fileName}`;
        let worksheetData = [finalHeaders];

        let dataToDownload = filteredData || [];
        if (uploadState) dataToDownload = dataToDownload.filter(f => f['الولاية'] === uploadState);
        if (uploadLocality) dataToDownload = dataToDownload.filter(f => f['المحلية'] === uploadLocality);
        if (uploadProject) dataToDownload = dataToDownload.filter(f => canonicalProject(f['project_name']) === uploadProject);

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
        if (!fieldMappings['اسم_المؤسسة']) { setError(t('facilities_page.services.name_must_be_mapped', 'The "Facility Name" (اسم_المؤسسة) field must be mapped to an Excel column.')); return; }
        setError('');
        const issues = []; const checkedFields = {}; const mappedFields = Object.keys(fieldMappings);
        for (const appField of mappedFields) {
            const config = cleanupConfig[appField];
            if (config && config.standardValues && !checkedFields[appField] && !config.isDynamicText) {
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

            if (uploadState && !facilityFromRow['الولاية']) facilityFromRow['الولاية'] = uploadState;
            if (uploadLocality && !facilityFromRow['المحلية']) facilityFromRow['المحلية'] = uploadLocality;
            if (uploadProject && !facilityFromRow['project_name']) {
                facilityFromRow['project_name'] = uploadProject;
                facilityFromRow['project_participation'] = 'Yes';
            }

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
            
            const staffList = []; 
            for (let i = 1; i <= MAX_STAFF; i++) { 
                if (newFacility[`imnci_staff_${i}_name`]) { 
                    staffList.push({ name: newFacility[`imnci_staff_${i}_name`], job_title: newFacility[`imnci_staff_${i}_job_title`] || '', is_trained: normalizeBoolean(newFacility[`imnci_staff_${i}_is_trained`]) || 'No', training_date: newFacility[`imnci_staff_${i}_training_date`] || '', phone: newFacility[`imnci_staff_${i}_phone`] || '' }); 
                } 
                delete newFacility[`imnci_staff_${i}_name`]; delete newFacility[`imnci_staff_${i}_job_title`]; delete newFacility[`imnci_staff_${i}_is_trained`]; delete newFacility[`imnci_staff_${i}_training_date`]; delete newFacility[`imnci_staff_${i}_phone`]; 
            }
            if (staffList.length > 0) newFacility.imnci_staff = staffList;
            
            const key1 = 'neonatal_level_of_care_primary', key2 = 'neonatal_level_of_care_secondary', key3 = 'neonatal_level_of_care_tertiary'; if (newFacility[key1] || newFacility[key2] || newFacility[key3]) { newFacility.neonatal_level_of_care = { primary: newFacility[key1] === 'Yes', secondary: newFacility[key2] === 'Yes', tertiary: newFacility[key3] === 'Yes', }; } delete newFacility[key1]; delete newFacility[key2]; delete newFacility[key3];
            return newFacility;
        });
        if (processedFacilities.length === 0) { setError(t('facilities_page.services.no_valid_facilities', 'No valid facilities with a name were found after mapping and filtering.')); setCurrentPage(1); return; }
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
    
    const renderPreview = () => (excelData.length === 0) ? null : (<div className="mt-4 overflow-auto max-h-60"><h4 className="font-medium mb-2">{t('facilities_page.services.data_preview', 'Data Preview (first 5 rows)')}</h4><table className="min-w-full border border-gray-200"><thead><tr className="bg-gray-100">{headers.map((header, idx) => <th key={idx} className="border border-gray-300 p-2 text-left text-xs">{header}</th>)}</tr></thead><tbody>{excelData.slice(0, 5).map((row, rowIdx) => <tr key={rowIdx}>{row.map((cell, cellIdx) => <td key={cellIdx} className="border border-gray-300 p-2 text-xs">{cell instanceof Date ? cell.toLocaleDateString() : cell}</td>)}</tr>)}</tbody></table></div>);
    const renderValidationScreen = () => { const allCorrectionsMade = validationIssues.every(issue => issue.invalidValues.every(val => userCorrections[val])); return (<div><h4 className="font-medium text-lg mb-2">{t('facilities_page.services.review_mismatches', 'Review Data Mismatches')}</h4><p className="text-sm text-gray-600 mb-4">{t('facilities_page.services.mismatch_hint', "Some values in your file don't match the expected options. Please map your values to the correct ones.")}</p><div className="space-y-4 max-h-96 overflow-y-auto p-2 border rounded bg-gray-50">{validationIssues.map(issue => (<div key={issue.columnName}><h5 className="font-semibold text-gray-800">{t('facilities_page.services.mismatches_for_column', 'Mismatches for Column:')} <span className="font-bold">"{issue.columnName}"</span></h5>{issue.invalidValues.map(val => (<div key={val} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 mt-2 p-2 bg-white rounded border"><span className="bg-red-50 text-red-800 p-2 rounded text-sm truncate" title={val}>{t('facilities_page.services.your_value', 'Your value: "{{value}}"', { value: val })}</span><span className="text-center font-bold text-gray-500 hidden md:block">&rarr;</span><Select value={userCorrections[val] || ''} onChange={(e) => handleCorrectionChange(val, e.target.value)}><option value="">{t('facilities_page.services.choose_correct_option', '-- Choose correct option --')}</option>{issue.options.map(opt => <option key={opt} value={opt}>{STATE_LOCALITIES[opt]?.ar || opt}</option>)}</Select></div>))}</div>))}</div><div className="flex justify-end mt-6 space-x-2"><Button variant="secondary" onClick={() => setCurrentPage(1)}>{t('facilities_page.services.back_to_mapping', 'Back to Mapping')}</Button><Button onClick={startImportProcess} disabled={!allCorrectionsMade}>{t('facilities_page.services.apply_and_import', 'Apply and Import')}</Button></div>{!allCorrectionsMade && <p className="text-right text-sm text-red-600 mt-2">{t('facilities_page.services.resolve_all_mismatches', 'Please resolve all mismatches.')}</p>}</div>); };
    const renderProgressView = () => (<div><h4 className="font-medium text-lg mb-2">{t('facilities_page.services.import_in_progress', 'Import in Progress...')}</h4><p className="text-sm text-gray-600 mb-4">{t('facilities_page.services.please_wait_uploading', 'Please wait while the facilities are being uploaded.')}</p><div className="w-full bg-gray-200 rounded-full h-4"><div className="bg-blue-600 h-4 rounded-full transition-all duration-500" style={{ width: `${uploadStatus.total > 0 ? (uploadStatus.processed / uploadStatus.total) * 100 : 0}%` }}></div></div><p className="text-center mt-2 font-medium">{uploadStatus.processed} / {uploadStatus.total}</p></div>);
    const renderResultView = () => (<div><h4 className="font-medium text-lg mb-2">{t('facilities_page.services.import_complete', 'Import Complete')}</h4><div className="bg-gray-50 p-4 rounded-md"><p className="font-semibold whitespace-pre-wrap">{uploadStatus.message}</p>{uploadStatus.errors && uploadStatus.errors.length > 0 && !uploadStatus.errors.some(e => e.rowData) && (<div className="mt-4 max-h-40 overflow-y-auto"><h5 className="font-semibold text-red-700">{t('facilities_page.services.errors_unrecoverable', 'Errors encountered (unrecoverable):')}</h5><ul className="list-disc list-inside text-sm text-red-600">{uploadStatus.errors.map((err, index) => <li key={index}>{err.message || err.toString()}</li>)}</ul></div>)}</div><div className="flex justify-end mt-6"><Button onClick={onClose}>{t('facilities_page.common.close', 'Close')}</Button></div></div>);
    const renderCorrectionScreen = () => ( <div><h4 className="font-medium text-lg text-red-700 mb-2">{t('facilities_page.services.import_errors', 'Import Errors')}</h4><p className="text-sm text-gray-600 mb-4">{t('facilities_page.services.import_errors_hint', 'Some rows failed to import. You can correct the data below and retry uploading only the failed rows.')}</p><div className="overflow-x-auto max-h-[60vh] border rounded-md"><table className="min-w-full text-sm"><thead className="bg-gray-100 sticky top-0"><tr><th className="p-2 border-r text-left">{t('facilities_page.services.row_number', 'Row #')}</th><th className="p-2 border-r text-left">{t('facilities_page.services.error', 'Error')}</th>{headers.map(header => <th key={header} className="p-2 border-r text-left whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{failedRows.map((error, errorIndex) => ( <tr key={error.rowIndex} className="bg-white hover:bg-red-50"><td className="p-1 border-r font-medium">{error.rowIndex + 2}</td><td className="p-1 border-r text-red-600 max-w-xs">{error.message}</td>{error.rowData.map((cell, cellIndex) => ( <td key={cellIndex} className="p-0 border-r"><Input type="text" value={cell || ''} onChange={(e) => handleCorrectionDataChange(errorIndex, cellIndex, e.target.value)} className="w-full border-0 rounded-none focus:ring-2 focus:ring-blue-500" /></td> ))}</tr> ))}</tbody></table></div><div className="flex justify-end mt-6 space-x-2"><Button variant="secondary" onClick={() => setCurrentPage(0)}>{t('facilities_page.services.back_to_selection', 'Back to Selection')}</Button><Button onClick={handleRetryUpload}>{t('facilities_page.services.retry_upload', 'Retry Upload for {{count}} Corrected Row(s)', { count: failedRows.length })}</Button></div></div> );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('facilities_page.services.bulk_upload', 'Bulk Upload')} size="full">
            <div className="p-4">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
                
                {currentPage === 0 && (
                    <div>
                        <p className="mb-4">{t('facilities_page.services.download_template_hint', 'Download the template to get started. You can select a State, Locality, or Project to restrict the template.')}</p>
                        
                        <div className="flex flex-col md:flex-row gap-4 mb-4 p-4 border rounded bg-gray-50">
                            <FormGroup label={t('facilities_page.services.template_by_state', 'Filter Template by State (Optional)')} className="flex-1">
                                <Select 
                                    value={uploadState} 
                                    onChange={e => { setUploadState(e.target.value); setUploadLocality(''); }}
                                >
                                    <option value="">{t('facilities_page.services.all_states_option', '-- All States --')}</option>
                                    {Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => (
                                        <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                            <FormGroup label={t('facilities_page.services.template_by_locality', 'Filter Template by Locality (Optional)')} className="flex-1">
                                <Select 
                                    value={uploadLocality} 
                                    onChange={e => setUploadLocality(e.target.value)} 
                                    disabled={!uploadState}
                                >
                                    <option value="">{t('facilities_page.services.all_localities_option', '-- All Localities --')}</option>
                                    {uploadState && STATE_LOCALITIES[uploadState]?.localities.map(l => (
                                        <option key={l.en} value={l.en}>{l.ar}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                            <FormGroup label={t('facilities_page.services.template_by_project', 'Filter Template by Project (Optional)')} className="flex-1">
                                <Select 
                                    value={uploadProject} 
                                    onChange={e => setUploadProject(e.target.value)}
                                >
                                    <option value="">{t('facilities_page.services.all_projects_option', '-- All Projects --')}</option>
                                    {projectNames.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                        </div>
                        <p className="text-xs text-gray-500 italic mb-4">{t('facilities_page.services.template_note', 'Note: Selecting a State/Locality/Project above will also auto-assign uploaded facilities to them if they are missing from your Excel file.')}</p>

                        <Button variant="secondary" onClick={handleDownloadTemplate} className="mb-4">
                            {t('facilities_page.services.download_template', 'Download Template')}
                        </Button>
                        <hr className="my-4"/>
                        <p className="mb-2">{t('facilities_page.services.upload_own_file', 'Or, upload your own Excel file (first row must be headers).')}</p>
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} ref={fileInputRef} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    </div>
                )}
                
                {currentPage === 1 && (
                    <div>
                        <h4 className="font-medium mb-4">{t('facilities_page.services.map_columns', 'Map Excel columns to application fields')}</h4>
                        <p className="text-sm text-gray-600 mb-4">{t('facilities_page.services.map_columns_hint', "Match the columns from your Excel file to the application fields. To update existing records, ensure the 'ID' field is correctly mapped.")}</p>
                        <div className="grid grid-cols-2 gap-3 mb-4 max-h-80 overflow-y-auto p-2 border rounded">
                            {allFacilityFields.map(field => <MappingRow key={field.key} field={field} headers={headers} selectedValue={fieldMappings[field.key]} onMappingChange={handleMappingChange}/>)}
                        </div>
                        {renderPreview()}
                        <div className="flex justify-end mt-6 space-x-2">
                            <Button variant="secondary" onClick={() => setCurrentPage(0)}>{t('facilities_page.common.back', 'Back')}</Button>
                            <Button onClick={handleValidation}>{t('facilities_page.services.validate_continue', 'Validate and Continue')}</Button>
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
    const { t } = useTranslation();
     const [isLoading, setIsLoading] = useState(false); const [duplicateGroups, setDuplicateGroups] = useState([]); const [selectedGroups, setSelectedGroups] = useState({});
    const findDuplicates = useCallback(() => { 
        setIsLoading(true); 
        const groups = new Map(); 
        facilities.forEach(facility => { 
            const key = `${facility['الولاية'] || 'N/A'}-${facility['المحلية'] || 'N/A'}-${facility['اسم_المؤسسة'] || 'N/A'}`.toLowerCase(); 
            if (!groups.has(key)) groups.set(key, []); 
            groups.get(key).push(facility); 
        }); 
        const foundDuplicates = []; 
        groups.forEach((group, key) => { 
            if (group.length > 1) { 
                group.sort((a, b) => {
                    const getTime = (t) => t?.toMillis ? t.toMillis() : (t?.toDate ? t.toDate().getTime() : (t ? new Date(t).getTime() : 0));
                    return getTime(b.lastSnapshotAt) - getTime(a.lastSnapshotAt);
                }); 
                foundDuplicates.push({ key, original: group[0], duplicates: group.slice(1) }); 
            } 
        }); 
        setDuplicateGroups(foundDuplicates); 
        const initialSelection = {}; 
        foundDuplicates.forEach(group => { initialSelection[group.key] = true; }); 
        setSelectedGroups(initialSelection); 
        setIsLoading(false); 
    }, [facilities]);
    
    useEffect(() => { if (isOpen) findDuplicates(); else { setDuplicateGroups([]); setSelectedGroups({}); } }, [isOpen, findDuplicates]);
    const handleSelectionChange = (key) => { setSelectedGroups(prev => ({ ...prev, [key]: !prev[key] })); };
    const handleDeleteSelected = async () => {
        const idsToDelete = []; duplicateGroups.forEach(group => { if (selectedGroups[group.key]) group.duplicates.forEach(d => idsToDelete.push(d.id)); });
        if (idsToDelete.length === 0) { notify(t('facilities_page.services.no_duplicates_selected', 'No duplicates selected for deletion.')); return; }
        if (await confirmDialog(t('facilities_page.services.confirm_delete_duplicates', 'Are you sure you want to permanently delete {{count}} duplicate records?', { count: idsToDelete.length }))) { try { await deleteFacilitiesBatch(idsToDelete); notify(t('facilities_page.services.duplicates_deleted', '{{count}} duplicates deleted successfully.', { count: idsToDelete.length })); onDuplicatesDeleted(idsToDelete); onClose(); } catch (error) { notify(t('facilities_page.services.delete_duplicates_failed', 'Failed to delete duplicates: {{message}}', { message: error.message })); } }
    };
    const totalDuplicates = duplicateGroups.reduce((acc, group) => acc + group.duplicates.length, 0);
    return (<Modal isOpen={isOpen} onClose={onClose} title={t('facilities_page.services.find_fix_duplicates', 'Find & Fix Duplicates')}><div className="p-4">{isLoading && <div className="text-center"><Spinner /></div>}{!isLoading && duplicateGroups.length === 0 && <div className="text-center p-4"><EmptyState message={t('facilities_page.services.no_duplicates', 'No duplicate facilities found.')} /></div>}{!isLoading && duplicateGroups.length > 0 && (<div><p className="mb-4 text-sm text-gray-700">{t('facilities_page.services.found', 'Found')} <strong>{totalDuplicates}</strong> {t('facilities_page.services.duplicate_records_across', 'duplicate records across')} <strong>{duplicateGroups.length}</strong> {t('facilities_page.services.groups_uncheck_hint', 'groups. Uncheck any group you do not want to clean up.')}</p><div className="space-y-4 max-h-96 overflow-y-auto p-2 border rounded">{duplicateGroups.map(group => (<div key={group.key} className="p-3 border rounded-md bg-gray-50"><div className="flex items-center justify-between mb-2"><h4 className="font-bold text-gray-800">{group.original['اسم_المؤسسة']}<span className="text-sm font-normal text-gray-500 ml-2">({group.original['الولاية']} / {group.original['المحلية']})</span></h4><label className="flex items-center gap-2 cursor-pointer">
        <Checkbox label="" checked={!!selectedGroups[group.key]} onChange={() => handleSelectionChange(group.key)}/>
        <span>{t('facilities_page.services.clean_up', 'Clean up')}</span>
    </label></div><div className="text-xs space-y-1"><p className="p-1 rounded bg-green-100 text-green-800"><strong>{t('facilities_page.services.keep_original', 'Keep (Original):')}</strong> ID {group.original.id} <span className="text-gray-600 italic ml-2"> {t('facilities_page.services.last_updated_paren', '(Last updated: {{date}})', { date: group.original.lastSnapshotAt?.toDate ? group.original.lastSnapshotAt.toDate().toLocaleString() : (group.original.lastSnapshotAt ? new Date(group.original.lastSnapshotAt).toLocaleString() : t('facilities_page.common.na', 'N/A')) })}</span></p>{group.duplicates.map(dup => <p key={dup.id} className="p-1 rounded bg-red-100 text-red-800"><strong>{t('facilities_page.services.delete_duplicate', 'Delete (Duplicate):')}</strong> ID {dup.id}<span className="text-gray-600 italic ml-2"> {t('facilities_page.services.last_updated_paren', '(Last updated: {{date}})', { date: dup.lastSnapshotAt?.toDate ? dup.lastSnapshotAt.toDate().toLocaleString() : (dup.lastSnapshotAt ? new Date(dup.lastSnapshotAt).toLocaleString() : t('facilities_page.common.na', 'N/A')) })}</span></p>)}</div></div>))}</div><div className="flex justify-end mt-6"><Button variant="danger" onClick={handleDeleteSelected}>{t('facilities_page.services.delete_selected', 'Delete Selected ({{count}})', { count: Object.values(selectedGroups).filter(Boolean).length })}</Button></div></div>)}</div></Modal>);
};

const DataCleanupModal = ({ isOpen, onClose, facilities, onCleanupComplete, setToast, cleanupConfig }) => {
    const { t } = useTranslation();
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
                        if (value && (config.isDynamicText || !config.standardValues.includes(value))) {
                            values.add(value);
                        }
                    });
                } else if (!config.isStaffField) {
                    const value = facility[selectedFieldKey];
                    if (value && (config.isDynamicText || !config.standardValues.includes(value))) {
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
        if (newValue.trim() === '' || newValue === oldValue) {
            setMappings(prev => {
                const newMap = { ...prev };
                delete newMap[oldValue];
                return newMap;
            });
        } else {
            setMappings(prev => ({ ...prev, [oldValue]: newValue })); 
        }
    };

    const handleApplyFixes = async () => {
        const user = auth.currentUser;
        if (!user) { setToast({ show: true, message: t('facilities_page.services.must_be_logged_in_action', 'You must be logged in to perform this action.'), type: 'error' }); return; }
        const config = cleanupConfig[selectedFieldKey];
        const facilitiesToUpdate = facilities.filter(f => {
            if (config.isStaffField) { return f.imnci_staff?.some(staff => Object.keys(mappings).includes(staff[selectedFieldKey])); } else { return Object.keys(mappings).includes(f[selectedFieldKey]); }
        });
        if (facilitiesToUpdate.length === 0) { setToast({ show: true, message: t('facilities_page.services.no_changes_to_apply', 'No changes to apply.'), type: 'info' }); onClose(); return; }
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
            setToast({ show: true, message: t('facilities_page.services.cleanup_success', '{{count}} facilities updated successfully for field "{{field}}".', { count: facilitiesToUpdate.length, field: config.label }), type: 'success' });
            onCleanupComplete();
        } catch (error) {
            setToast({ show: true, message: t('facilities_page.services.error_occurred', 'An error occurred: {{message}}', { message: error.message }), type: 'error' });
        } finally {
            setIsUpdating(false);
            onClose();
        }
    };
    
    const renderSelectionScreen = () => ( <div><FormGroup label={t('facilities_page.services.select_field_to_clean', 'Select a data field to clean')}><Select value={selectedFieldKey} onChange={(e) => setSelectedFieldKey(e.target.value)}><option value="">{t('facilities_page.services.choose_field', '-- Choose field --')}</option>{Object.entries(cleanupConfig).map(([key, config]) => ( <option key={key} value={key}>{config.label}</option> ))}</Select></FormGroup></div> );
    
    const renderMappingScreen = () => {
        const config = cleanupConfig[selectedFieldKey];
        return (
            <div>
                {isLoading && <div className="text-center"><Spinner /></div>}
                {!isLoading && nonStandardValues.length === 0 && ( <div className="text-center p-4"><EmptyState message={t('facilities_page.services.all_standardized', 'All values for "{{field}}" are already standardized.', { field: config.label })} /></div> )}
                {!isLoading && nonStandardValues.length > 0 && ( 
                    <div>
                        <p className="mb-4 text-sm text-gray-700"> 
                            {t('facilities_page.services.found', 'Found')} <strong>{nonStandardValues.length}</strong> {config.isDynamicText ? t('facilities_page.services.unique_values_for', 'unique value(s) for') : t('facilities_page.services.nonstandard_values_for', 'non-standard value(s) for')} <strong>{config.label}</strong>. {t('facilities_page.services.map_to_standard_hint', 'Map them to a standard value to clean up your data.')} 
                        </p>
                        <div className="space-y-3 max-h-80 overflow-y-auto p-2 border rounded bg-gray-50">
                            {nonStandardValues.map(value => ( 
                                <div key={value} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 p-2 bg-white rounded border">
                                    <span className="bg-yellow-50 text-yellow-800 p-2 rounded text-sm truncate" title={value}> {t('facilities_page.services.current_value', 'Current: "{{value}}"', { value })} </span>
                                    <span className="text-center font-bold text-gray-500 hidden md:block">&rarr;</span>
                                    
                                    {config.isDynamicText ? (
                                        <div className="flex-1 w-full">
                                            <Input 
                                                type="text" 
                                                list={`${selectedFieldKey}-options`}
                                                placeholder={t('facilities_page.services.type_unified_name', 'Type unified name...')} 
                                                value={mappings[value] || ''} 
                                                onChange={(e) => handleMappingChange(value, e.target.value)} 
                                            />
                                            <datalist id={`${selectedFieldKey}-options`}>
                                                {config.standardValues.map(opt => <option key={opt} value={opt} />)}
                                            </datalist>
                                        </div>
                                    ) : (
                                        <Select value={mappings[value] || ''} onChange={(e) => handleMappingChange(value, e.target.value)}>
                                            <option value="">{t('facilities_page.services.map_to_standard', '-- Map to standard value --')}</option>
                                            {config.standardValues.map(opt => { 
                                                let displayValue = opt; 
                                                if (selectedFieldKey === 'الولاية') { displayValue = STATE_LOCALITIES[opt]?.ar || opt; } 
                                                else if (selectedFieldKey === 'المحلية') { displayValue = LOCALITY_EN_TO_AR_MAP[opt] || opt; } 
                                                return <option key={opt} value={opt}>{displayValue}</option>; 
                                            })}
                                        </Select>
                                    )}
                                </div> 
                            ))}
                        </div>
                    </div> 
                )}
                <div className="flex justify-between items-center mt-6">
                    <Button variant="secondary" onClick={() => setSelectedFieldKey('')}>{t('facilities_page.services.back_to_selection', 'Back to Selection')}</Button>
                    <Button onClick={handleApplyFixes} disabled={isUpdating || Object.keys(mappings).length === 0 || nonStandardValues.length === 0}>
                        {isUpdating ? t('facilities_page.services.applying_fixes', 'Applying Fixes...') : t('facilities_page.services.apply_fixes', 'Apply Fixes for {{count}} Value(s)', { count: Object.keys(mappings).length })}
                    </Button>
                </div>
            </div>
        );
    };
    
    return ( <Modal isOpen={isOpen} onClose={onClose} title={t('facilities_page.services.clean_facility_data', 'Clean Facility Data')}><div className="p-4">{!selectedFieldKey ? renderSelectionScreen() : renderMappingScreen()}</div></Modal> );
};

const LocationMismatchModal = ({ isOpen, onClose, mismatches, onFix }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('facilities_page.services.mismatches_found', 'Location Mismatches Found ({{count}})', { count: mismatches.length })} size="lg">
            <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                    {t('facilities_page.services.mismatch_description', 'The following facilities have coordinates that do not fall within the geographical boundaries of their assigned State and Locality.')}
                </p>
                {mismatches.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto">
                        <Table headers={[t('facilities_page.services.col.facility_name', 'Facility Name'), t('facilities_page.services.col.assigned_state', 'Assigned State'), t('facilities_page.services.col.assigned_locality', 'Assigned Locality'), t('facilities_page.common.actions', 'Actions')]}>
                            {mismatches.map(facility => (
                                <tr key={facility.id}>
                                    <td>{facility['اسم_المؤسسة']}</td>
                                    <td>{STATE_LOCALITIES[facility['الولاية']]?.ar || facility['الولاIAة']}</td>
                                    <td>{LOCALITY_EN_TO_AR_MAP[facility['المحلية']] || facility['المحلية']}</td>
                                    <td>
                                        <Button size="sm" onClick={() => onFix(facility)}>
                                            {t('facilities_page.services.fix_location', 'Fix Location')}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </div>
                ) : (
                     <div className="text-center p-4">
                       <EmptyState message={t('facilities_page.services.no_mismatches', 'No location mismatches were found.')} />
                     </div>
                )}
            </div>
            <div className="flex justify-end p-4 border-t">
                <Button variant="secondary" onClick={onClose}>{t('facilities_page.common.close', 'Close')}</Button>
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
    canFindFacilityDuplicates
}) => {
    const { t } = useTranslation();
    const [view, setView] = useState('action_menu');
    
    const [updateSelectionService, setUpdateSelectionService] = useState(null);
    const [updateSelectionData, setUpdateSelectionData] = useState({ state: '', locality: '', facilityId: '' });
    const [updateSelectionSearch, setUpdateSelectionSearch] = useState(''); 
    
    const [statusData, setStatusData] = useState(null);

    const isSuperUserOrFed = permissions?.canUseSuperUserAdvancedFeatures || permissions?.role === 'super_user' || permissions?.manageScope === 'federal' || permissions?.isAdmin;

    const getBaseUrl = () => publicBaseUrl();

    const shareViaWhatsApp = (textToShare, successMessage) => {
        navigator.clipboard.writeText(textToShare).then(() => {
            if (Capacitor.isNativePlatform()) {
                window.open(`whatsapp://send?text=${encodeURIComponent(textToShare)}`, '_system');
            } else {
                setToast({ show: true, message: successMessage || 'تم النسخ بنجاح!', type: 'success' });
            }
        }).catch(() => {
            setToast({ show: true, message: 'فشل النسخ. يرجى المحاولة مرة أخرى.', type: 'error' });
        });
    };

    const handleActionMenuClick = (action) => {
        if (action === 'show_list') {
            setView('list');
        } else if (action === 'show_history') {
            setView('kpi_history');
        } else if (action === 'show_update_dashboard') {
            setView('update_dashboard');
        } else {
            if (action === 'share_imnci') setUpdateSelectionService('IMNCI');
            else if (action === 'share_eenc') setUpdateSelectionService('EENC');
            else if (action === 'share_neonatal') setUpdateSelectionService('Neonatal');
            else if (action === 'share_etat') setUpdateSelectionService('Critical Care'); 

            setUpdateSelectionData({
                state: userStates?.length === 1 ? userStates[0] : '',
                locality: userLocalities?.length === 1 ? userLocalities[0] : '',
                facilityId: ''
            });
            setUpdateSelectionSearch(''); 
        }
    };

    const handleShareBulkUpdateLink = () => {
        const params = new URLSearchParams();

        if (stateFilter && stateFilter !== 'ALL_STATES' && stateFilter !== 'NOT_ASSIGNED') {
            params.append('state', stateFilter);
        }
        
        let description = `الرجاء تحديث بيانات المنشآت الصحية عبر الرابط التالي:\n\n`;
        
        if (stateFilter && stateFilter !== 'ALL_STATES' && stateFilter !== 'NOT_ASSIGNED') {
            description += `الولاية: ${STATE_LOCALITIES[stateFilter]?.ar || stateFilter}\n`;
        }

        if (localityFilter) {
            params.append('locality', localityFilter);
            description += `المحلية: ${LOCALITY_EN_TO_AR_MAP[localityFilter] || localityFilter}\n`;
        }
        if (facilityTypeFilter) {
            params.append('facilityType', facilityTypeFilter);
            description += `نوع المنشأة: ${facilityTypeFilter}\n`;
        }
        if (functioningFilter && functioningFilter !== 'NOT_SET') {
            params.append('functioning', functioningFilter);
            description += `حالة العمل: ${functioningFilter === 'Yes' ? 'نعم' : 'لا'}\n`;
        }
        if (projectFilter) {
            params.append('project', projectFilter);
            description += `المشروع: ${projectFilter}\n`;
        }
        if (serviceTypeFilter) {
            params.append('service', serviceTypeFilter);
            description += `الخدمة: ${serviceTypeFilter}\n`;
        }
        
        const url = `${getBaseUrl()}/public/bulk-update?${params.toString()}`;
        const textToCopy = `${description}\nالرابط:\n${url}`;
        
        shareViaWhatsApp(textToCopy, "تم نسخ رابط التحديث الجماعي مع الوصف بنجاح!");
    };

    const { 
        healthFacilities, 
        fetchHealthFacilities, 
        removeFromCache,
        isLoading,
        fetchPendingFacilitatorSubmissions,
        fetchPendingFederalSubmissions,
        fetchPendingStateSubmissions,
        fetchPendingLocalitySubmissions
    } = useDataCache();

    const isFacilitiesLoading = isLoading?.healthFacilities || healthFacilities === null;

    const activeHealthFacilities = useMemo(() => {
        if (!healthFacilities) return null;
        return healthFacilities.filter(f => f.isDeleted !== true && f.isDeleted !== "true");
    }, [healthFacilities]);

    const scopedFacilities = useMemo(() => {
        if (!activeHealthFacilities) return [];
        const userScope = permissions?.manageScope;
        
        if (userScope === 'locality') {
            if (userLocalities && userLocalities.length > 0) {
                const allowedLocalities = new Set(userLocalities);
                return activeHealthFacilities.filter(f => allowedLocalities.has(f['المحلية']));
            }
            return []; 
        } else if (userScope === 'state') {
            if (userStates && userStates.length > 0) {
                const allowedStates = new Set(userStates);
                return activeHealthFacilities.filter(f => allowedStates.has(f['الولاية']));
            }
            return []; 
        }
        
        return activeHealthFacilities;
    }, [activeHealthFacilities, permissions?.manageScope, userLocalities, userStates]);

    const [editingFacility, setEditingFacility] = useState(null);
    const [activeTab, setActiveTab] = useState(TABS.ALL);
    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
    const [isNameStandardizationOpen, setIsNameStandardizationOpen] = useState(false);
    const [stateFilter, setStateFilter] = useState(userStates?.length === 1 ? userStates[0] : '');
    const [localityFilter, setLocalityFilter] = useState(userLocalities?.length === 1 ? userLocalities[0] : '');
    const [facilityTypeFilter, setFacilityTypeFilter] = useState('');
    const [functioningFilter, setFunctioningFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [serviceTypeFilter, setServiceTypeFilter] = useState('');
    const [eencServiceTypeFilter, setEencServiceTypeFilter] = useState('');
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);
    const [uploadStatus, setUploadStatus] = useState({ inProgress: false, processed: 0, total: 0, errors: [], message: '' });
    const [submissionForReview, setSubmissionForReview] = useState(null);
    const [comparisonFacilities, setComparisonFacilities] = useState([]);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingStartDate, setPendingStartDate] = useState('');
    const [pendingEndDate, setPendingEndDate] = useState('');
    const hasFetchedPendingRef = useRef(false); 
    
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [facilityForMap, setFacilityForMap] = useState(null);
    const [isMismatchModalOpen, setIsMismatchModalOpen] = useState(false);
    const [mismatchedFacilities, setMismatchedFacilities] = useState([]); 
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [facilityForHistory, setFacilityForHistory] = useState(null);

    const handleOpenHistoryModal = (facility) => {
        setFacilityForHistory(facility);
        setIsHistoryModalOpen(true);
    };

    const auth = getAuth();
    const [hasManuallySelected, setHasManuallySelected] = useState(!!(userStates?.length === 1 || userLocalities?.length === 1));
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);


   const handlePdfListGeneration = async (quality) => {
        if (!filteredFacilities || filteredFacilities.length === 0) {
            notify(t('facilities_page.services.no_facilities_to_export', 'No facilities to export.'), 'info');
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
            notify(t('facilities_page.services.pdf_error', 'Sorry, there was an error generating the PDF.'), 'error');
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const availableStates = useMemo(() => {
        const allStates = Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(b.ar) );
        if (!userStates || userStates.length === 0) {
            return [ { key: "", label: t('facilities_page.services.select_state', '-- Select State --') }, { key: "ALL_STATES", label: t('facilities_page.services.all_states', 'All States') }, { key: "NOT_ASSIGNED", label: t('facilities_page.services.not_assigned', 'Not Assigned') }, ...allStates.map(sKey => ({ key: sKey, label: STATE_LOCALITIES[sKey].ar })) ];
        }
        return [ { key: "", label: t('facilities_page.services.select_state', '-- Select State --') }, ...allStates .filter(sKey => userStates.includes(sKey)) .map(sKey => ({ key: sKey, label: STATE_LOCALITIES[sKey].ar })) ];
    }, [userStates, t]);

    const getCurrentFilters = useCallback(() => {
        return {};
    }, []);

    const handleOpenMapModal = (facility) => { setFacilityForMap(facility); setIsMapModalOpen(true); };

    const handleSaveLocation = async (newLocation) => {
        if (!facilityForMap) return;
        const payload = { ...facilityForMap, _الإحداثيات_latitude: newLocation._الإحداثيات_latitude, _الإحداثيات_longitude: newLocation._الإحداثيات_longitude, date_of_visit: facilityForMap.date_of_visit || new Date().toISOString().split('T')[0], };
        try {
            if (permissions.canApproveSubmissions) {
                await saveFacilitySnapshot(payload);
                setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
                await fetchHealthFacilities({}, 'sync');
            } else {
                 await submitFacilityDataForApproval(payload, auth.currentUser?.email || 'Unknown User');
                 setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
            }
        } catch (error) {
            setStatusData({ status: 'error', message: error.message });
        }
    };

    const handleFixMismatch = (facility) => { setIsMismatchModalOpen(false); handleOpenMapModal(facility); };

    // Projects by their standard names (see utils/nameRegistry.js), so the
    // filter offers SHARE once rather than "share", "Share " and "SHARE".
    const observedProjects = useMemo(
        () => (scopedFacilities || []).map(f => f.project_name).filter(Boolean),
        [scopedFacilities],
    );
    const { canonicalize: canonicalProject } = useStandardNames('projects', observedProjects);
    const projectNames = useMemo(() => canonicalOptions(canonicalProject, observedProjects), [canonicalProject, observedProjects]);

    const CLEANABLE_FIELDS_CONFIG = useMemo(() => ({
        'الولاية': { label: t('facilities_page.services.cleanup_fields.state', 'State'), standardValues: Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)), isStaffField: false },
        'المحلية': { label: t('facilities_page.services.cleanup_fields.locality', 'Locality'), standardValues: Object.values(STATE_LOCALITIES).flatMap(s => s.localities.map(l => l.en)).sort((a, b) => (LOCALITY_EN_TO_AR_MAP[a] || a).localeCompare(LOCALITY_EN_TO_AR_MAP[b] || b)), isStaffField: false },
        'facility_ownership': { label: t('facilities_page.services.cleanup_fields.facility_ownership', 'Facility Ownership (ملكية المؤسسة)'), standardValues: ['حكومي', 'خاص', 'منظمات', 'اهلي'], isStaffField: false },
        'job_title': { label: t('facilities_page.services.cleanup_fields.staff_job_title', 'Staff Job Title'), standardValues: ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"], isStaffField: true },
        'نوع_المؤسسةالصحية': { label: t('facilities_page.services.cleanup_fields.facility_type', 'Facility Type'), standardValues: ["مركز صحة الاسرة", "مستشفى ريفي", "وحدة صحة الاسرة", "مستشفى"], isStaffField: false },
        'eenc_service_type': { label: t('facilities_page.services.cleanup_fields.service_type', 'Service Type'), standardValues: ["CEmONC", "BEmONC", "general", "pediatric"], isStaffField: false },
        'هل_المؤسسة_تعمل': { label: t('facilities_page.services.cleanup_fields.is_functioning', 'Is Facility Functioning'), standardValues: ['Yes', 'No'], isStaffField: false },
        'staff_incentives': { label: t('facilities_page.services.cleanup_fields.staff_incentives', 'Staff Incentives'), standardValues: ['Yes', 'No'], isStaffField: false },
        'project_participation': { label: t('facilities_page.services.cleanup_fields.project_participation', 'Project Participation'), standardValues: ['Yes', 'No'], isStaffField: false },
        'project_name': { label: t('facilities_page.services.cleanup_fields.project_name', 'Project Name (اسم المشروع)'), standardValues: projectNames, isDynamicText: true, isStaffField: false },
        'وجود_العلاج_المتكامل_لامراض_الطفولة': { label: t('facilities_page.services.cleanup_fields.imnci_service', 'IMNCI Service Availability'), standardValues: ['Yes', 'No'], isStaffField: false },
        'وجود_سجل_علاج_متكامل': { label: t('facilities_page.services.cleanup_fields.imnci_register', 'IMNCI Register Availability (السجلات)'), standardValues: ['Yes', 'No'], isStaffField: false },
        'وجود_كتيب_لوحات': { label: t('facilities_page.services.cleanup_fields.chart_booklet', 'Chart Booklet Availability (كتيب اللوحات)'), standardValues: ['Yes', 'No'], isStaffField: false },
        'ميزان_وزن': { label: t('facilities_page.services.cleanup_fields.weight_scale', 'Weight Scale Availability'), standardValues: ['Yes', 'No'], isStaffField: false },
        'ميزان_طول': { label: t('facilities_page.services.cleanup_fields.height_scale', 'Height Scale Availability'), standardValues: ['Yes', 'No'], isStaffField: false },
        'ميزان_حرارة': { label: t('facilities_page.services.cleanup_fields.thermometer', 'Thermometer Availability'), standardValues: ['Yes', 'No'], isStaffField: false },
        'ساعة_مؤقت': { label: t('facilities_page.services.cleanup_fields.timer', 'Timer Availability'), standardValues: ['Yes', 'No'], isStaffField: false },
        'غرفة_إرواء': { label: t('facilities_page.services.cleanup_fields.ors_corner', 'ORS Corner Availability'), standardValues: ['Yes', 'No'], isStaffField: false },
        'immunization_office_exists': { label: t('facilities_page.services.cleanup_fields.immunization_office', 'Immunization Office Exists'), standardValues: ['Yes', 'No'], isStaffField: false }, 
        'nutrition_center_exists': { label: t('facilities_page.services.cleanup_fields.nutrition_center', 'Nutrition Center Exists'), standardValues: ['Yes', 'No'], isStaffField: false }, 
        'growth_monitoring_service_exists': { label: t('facilities_page.services.cleanup_fields.growth_monitoring', 'Growth Monitoring Service Exists'), standardValues: ['Yes', 'No'], isStaffField: false }, 
        'eenc_provides_essential_care': { label: t('facilities_page.services.cleanup_fields.eenc_service', 'EENC Service Provided'), standardValues: ['Yes', 'No'], isStaffField: false },
        'eenc_steam_sterilizer': { label: t('facilities_page.services.cleanup_fields.eenc_steam_sterilizer', 'EENC Steam Sterilizer'), standardValues: ['Yes', 'No'], isStaffField: false },
        'eenc_wall_clock': { label: t('facilities_page.services.cleanup_fields.eenc_wall_clock', 'EENC Wall Clock'), standardValues: ['Yes', 'No'], isStaffField: false },
        'neonatal_sepsis_surveillance': { label: t('facilities_page.services.cleanup_fields.sepsis_surveillance', 'Sepsis Surveillance and Prevention'), standardValues: ['Yes', 'No'], isStaffField: false },
        'neonatal_kmc_unit': { label: t('facilities_page.services.cleanup_fields.kmc_unit', 'KMC Unit (وحدة رعاية الكنغر)'), standardValues: ['Yes', 'No'], isStaffField: false },
        'neonatal_breastfeeding_unit': { label: t('facilities_page.services.cleanup_fields.breastfeeding_unit', 'Breastfeeding Unit'), standardValues: ['Yes', 'No'], isStaffField: false },
        'neonatal_sterilization_unit': { label: t('facilities_page.services.cleanup_fields.sterilization_unit', 'Sterilization Unit'), standardValues: ['Yes', 'No'], isStaffField: false },
        'etat_has_service': { label: t('facilities_page.services.cleanup_fields.etat_service', 'ETAT Service Availability'), standardValues: ['Yes', 'No'], isStaffField: false },
        'hdu_has_service': { label: t('facilities_page.services.cleanup_fields.hdu_service', 'HDU Service Availability'), standardValues: ['Yes', 'No'], isStaffField: false },
        'picu_has_service': { label: t('facilities_page.services.cleanup_fields.picu_service', 'PICU Service Availability'), standardValues: ['Yes', 'No'], isStaffField: false },
    }), [projectNames, t]);

    const refreshSubmissions = useCallback(async (force = false) => {
        if (!permissions?.canManageFacilities) return;
        if (!force && hasFetchedPendingRef.current) return;

        setIsSubmissionsLoading(true);
        try {
            await Promise.all([
                fetchPendingFacilitatorSubmissions(force),
                fetchPendingFederalSubmissions(force),
                fetchPendingStateSubmissions(force),
                fetchPendingLocalitySubmissions(force),
                (async () => { 
                    const subs = await listPendingFacilitySubmissions(); 
                    setPendingSubmissions(subs); 
                    hasFetchedPendingRef.current = true;
                })()
            ]);
        } catch (error) {
            setToast({ show: true, message: t('facilities_page.services.load_pending_failed', 'Failed to load pending submissions.'), type: "error" });
        } finally {
            setIsSubmissionsLoading(false);
        }
    }, [ permissions, setToast, t, fetchPendingFacilitatorSubmissions, fetchPendingFederalSubmissions, fetchPendingStateSubmissions, fetchPendingLocalitySubmissions ]);

    useEffect(() => {
        if (permissions?.canManageFacilities) {
            refreshSubmissions(false);
        }
    }, [permissions, refreshSubmissions]);

    const dropPendingSubmissions = useCallback((ids) => {
        const gone = new Set(ids);
        setPendingSubmissions((prev) => prev.filter((s) => !gone.has(s.submissionId)));
    }, []);

    useEffect(() => {
        if (view === 'list') {
            if (activeTab === TABS.PENDING) {
                // Already fetched
            } else {
                fetchHealthFacilities({}, false);
            }
        }
    }, [view, activeTab, fetchHealthFacilities]);

    const uniquePendingSubmissions = useMemo(() => {
        if (!pendingSubmissions || pendingSubmissions.length === 0) return [];

        let relevantSubmissions = pendingSubmissions;
        if (pendingStartDate || pendingEndDate) {
            const start = pendingStartDate ? new Date(pendingStartDate).setHours(0, 0, 0, 0) : 0;
            const end = pendingEndDate ? new Date(pendingEndDate).setHours(23, 59, 59, 999) : Infinity;
            
            relevantSubmissions = pendingSubmissions.filter(s => {
                if (!s.submittedAt?.toDate) return false;
                const time = s.submittedAt.toDate().getTime();
                return time >= start && time <= end;
            });
        }

        const sortedSubmissions = [...relevantSubmissions].sort((a, b) => {
            const timeA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
            const timeB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
            return timeA - timeB; 
        });

        const norm = (v) => (v === undefined || v === null) ? '' : String(v).trim();

        const unique = new Map();
        for (const s of sortedSubmissions) {
            const key = `${s['اسم_المؤسسة']}-${s['الولاية']}-${s['المحلية']}`;
            const existing = unique.get(key);

            if (!existing) {
                unique.set(key, { ...s, _mergedSubmissionIds: [s.submissionId] });
            } else {
                if (s._action === 'DELETE') {
                    unique.set(key, { 
                        ...s, 
                        _mergedSubmissionIds: [...existing._mergedSubmissionIds, s.submissionId] 
                    });
                } else {
                    const baseFacility = (activeHealthFacilities || []).find(f => 
                        f['اسم_المؤسسة'] === s['اسم_المؤسسة'] && 
                        f['الولاية'] === s['الولاية'] && 
                        f['المحلية'] === s['المحلية']
                    ) || {};

                    const merged = { ...existing }; 

                    const allKeys = new Set([...Object.keys(existing), ...Object.keys(s)]);
                    const ignoreKeys = [
                        '_mergedSubmissionIds', 'submissionId', 'submittedAt', 'createdAt', 
                        'lastSnapshotAt', 'updated_by', 'اخر تحديث', 'imnci_staff', 'eenc_staff', 
                        'neonatal_staff', 'critical_staff', 'neonatal_level_of_care'
                    ];
                    
                    allKeys.forEach(field => {
                        if (ignoreKeys.includes(field)) return;
                        
                        const sVal = s[field];
                        const baseVal = baseFacility[field];
                        const existVal = existing[field];

                        if (norm(sVal) !== norm(baseVal)) {
                            merged[field] = s[field];
                        } else {
                            merged[field] = existVal;
                        }
                    });

                    const baseNeonatal = baseFacility.neonatal_level_of_care || {};
                    const existNeonatal = existing.neonatal_level_of_care || {};
                    const sNeonatal = s.neonatal_level_of_care || {};
                    
                    if (Object.keys(existNeonatal).length > 0 || Object.keys(sNeonatal).length > 0) {
                        merged.neonatal_level_of_care = { ...existNeonatal };
                        ['primary', 'secondary', 'tertiary'].forEach(level => {
                            const sVal = sNeonatal[level];
                            const bVal = baseNeonatal[level];
                            if (norm(sVal) !== norm(bVal)) {
                                merged.neonatal_level_of_care[level] = sNeonatal[level];
                            }
                        });
                    }

                    const STAFF_ARRAY_KEYS = ['imnci_staff', 'eenc_staff', 'neonatal_staff', 'critical_staff'];
                    
                    STAFF_ARRAY_KEYS.forEach(staffKey => {
                        const baseStaffArr = Array.isArray(baseFacility[staffKey]) ? baseFacility[staffKey] : [];
                        const existStaffArr = Array.isArray(existing[staffKey]) ? existing[staffKey] : [];
                        const sStaffArr = Array.isArray(s[staffKey]) ? s[staffKey] : [];
                        
                        const maxLen = Math.max(existStaffArr.length, sStaffArr.length);
                        const mergedStaffArr = [];
                        
                        for (let i = 0; i < maxLen; i++) {
                            const bStaff = baseStaffArr[i] || {};
                            const eStaff = existStaffArr[i] || {};
                            const sStaff = sStaffArr[i] || {};
                            
                            const mergedStaffMember = { ...eStaff };
                            const staffFields = new Set([...Object.keys(eStaff), ...Object.keys(sStaff)]);
                            
                            staffFields.forEach(f => {
                                const sVal = sStaff[f];
                                const bVal = bStaff[f];
                                
                                if (norm(sVal) !== norm(bVal)) {
                                    mergedStaffMember[f] = sStaff[f];
                                }
                            });
                            
                            if (Object.keys(mergedStaffMember).length > 0) {
                                mergedStaffArr.push(mergedStaffMember);
                            }
                        }
                        merged[staffKey] = mergedStaffArr;
                    });

                    merged._mergedSubmissionIds = [...existing._mergedSubmissionIds, s.submissionId];
                    merged.submissionId = s.submissionId; 
                    unique.set(key, merged);
                }
            }
        }

        return Array.from(unique.values()).sort((a, b) => {
            const timeA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
            const timeB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
            return timeB - timeA;
        });
    }, [pendingSubmissions, pendingStartDate, pendingEndDate, activeHealthFacilities]);

    const filteredFacilities = useMemo(() => {
        if (!scopedFacilities || !hasManuallySelected) return [];

        let filtered = scopedFacilities.filter(f => {
            const userScope = permissions.manageScope;
            
            if (userScope !== 'state' && userScope !== 'locality') {
                if (stateFilter && stateFilter !== 'ALL_STATES' && stateFilter !== 'NOT_ASSIGNED' && f['الولاية'] !== stateFilter) return false; 
                if (stateFilter === 'NOT_ASSIGNED' && f['الولاية']) return false;
            }
            if (userScope !== 'locality') { 
                if (localityFilter && f['المحلية'] !== localityFilter) return false; 
            }
            
            if (facilityTypeFilter && f['نوع_المؤسسةالصحية'] !== facilityTypeFilter) return false;
            if (projectFilter && canonicalProject(f.project_name) !== projectFilter) return false;
            if (functioningFilter && functioningFilter !== 'NOT_SET' && f['هل_المؤسسة_تعمل'] !== functioningFilter) return false;
            if (functioningFilter === 'NOT_SET' && (f['هل_المؤسسة_تعمل'] != null && f['هل_المؤسسة_تعمل'] !== '')) return false;
            if (searchQuery) { const lowerQuery = searchQuery.toLowerCase(); if (!String(f['اسم_المؤسسة'] || '').toLowerCase().includes(lowerQuery)) return false; }
            if (serviceTypeFilter) {
                 switch (serviceTypeFilter) {
                    case 'IMNCI': if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] !== 'Yes') return false; break;
                    case 'EENC': if (f.eenc_provides_essential_care !== 'Yes') return false; break;
                    case 'Neonatal': 
                    case 'Neonatal (Any Level)': if (!f.neonatal_level_of_care || !(f.neonatal_level_of_care.primary || f.neonatal_level_of_care.secondary || f.neonatal_level_of_care.tertiary)) return false; break;
                    case 'Neonatal (Primary)': if (!f.neonatal_level_of_care?.primary) return false; break;
                    case 'Neonatal (Secondary)': if (!f.neonatal_level_of_care?.secondary) return false; break;
                    case 'Neonatal (Tertiary)': if (!f.neonatal_level_of_care?.tertiary) return false; break;
                    case 'Critical Care': if (f.etat_has_service !== 'Yes' && f.hdu_has_service !== 'Yes' && f.picu_has_service !== 'Yes') return false; break;
                    default: break;
                }
            }
            if (eencServiceTypeFilter && f.eenc_service_type !== eencServiceTypeFilter) return false;

            return true;
        });
        
        filtered.sort((a, b) => {
            const getTime = (t) => t?.toMillis ? t.toMillis() : (t?.toDate ? t.toDate().getTime() : (t ? new Date(t).getTime() : 0));
            return getTime(b.lastSnapshotAt) - getTime(a.lastSnapshotAt);
        });

        return filtered;
    }, [ scopedFacilities, stateFilter, localityFilter, facilityTypeFilter, functioningFilter, projectFilter, searchQuery, serviceTypeFilter, permissions.manageScope, hasManuallySelected, eencServiceTypeFilter, canonicalProject ]);

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
            setToast({ show: true, message: t('facilities_page.services.refreshed', 'Data refreshed successfully.'), type: "success" });
        } catch (error) {
            setToast({ show: true, message: t('facilities_page.services.refresh_failed', 'Failed to refresh: {{message}}', { message: error.message }), type: "error" });
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSaveFacility = async (payload) => {
        const user = auth.currentUser;
        if (!user) { setToast({ show: true, message: t('facilities_page.services.must_be_logged_in', 'You must be logged in.'), type: 'error' }); return; }
        
        const isUpdate = !!editingFacility?.id; 
        const finalPayload = { ...payload };
        if (isUpdate) { finalPayload.id = editingFacility.id; }
        
        // --- FIX 1: Clean data before sending to Firestore ---
        const cleanedPayload = removeUndefinedProperties(finalPayload);
        
        try {
            if (permissions.canApproveSubmissions) { 
                await saveFacilitySnapshot(cleanedPayload); 
                setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
                await fetchHealthFacilities({}, 'sync');
            } else { 
                await submitFacilityDataForApproval(cleanedPayload, user.email || 'Unknown User'); 
                setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });

                if (navigator.onLine) {
                    try {
                        let submitterRole = permissions?.role ? permissions.role.replace(/_/g, ' ') : 'User';
                        const submitterName = user.displayName || user.email || 'A user';
                        const actionText = isUpdate ? 'updated the' : 'submitted a new';
                        const notifTitle = isUpdate ? 'Facility Update Requires Approval' : 'New Facility Requires Approval';
                        const notifBody = `${submitterName} (${submitterRole}) has ${actionText} facility: ${cleanedPayload['اسم_المؤسسة']}.`;

                        const functions = getFunctions(db.app);
                        const sendFCMNotification = httpsCallable(functions, 'sendFCMNotification');
                        
                        sendFCMNotification({
                            targetUserId: 'managers_and_super_users',
                            title: notifTitle,
                            body: notifBody,
                            data: {
                                actionView: 'childHealthServices'
                            }
                        }).catch(e => console.warn("FCM Send Error:", e));
                    } catch (fcmError) {
                        console.warn("FCM Error", fcmError);
                    }
                }
            }
        } catch (error) {
             setStatusData({ status: 'error', message: error.message });
        }
    };

    const handleCloseStatusModal = () => {
        const wasSuccessOrQueued = statusData?.status !== 'error';
        setStatusData(null);
        if (wasSuccessOrQueued) {
            setEditingFacility(null);
            setUpdateSelectionService(null);
            setView('list'); 
        }
    };

    const handleEditFacility = async (facilityId) => {
        let facility = (filteredFacilities || []).find(f => f.id === facilityId);
        if (!facility) {
             facility = await getHealthFacilityById(facilityId);
             if (facility) {
                  const userScope = permissions.manageScope;
                  if (userScope === 'locality' && (!userLocalities || !userLocalities.includes(facility['المحلية']))) { facility = null; } else if (userScope === 'state' && (!userStates || !userStates.includes(facility['الولاية']))) { facility = null; }
             }
        }
        if (facility) { 
            setEditingFacility(facility); 
            setView('form'); 
        } else { 
            setToast({ show: true, message: t('facilities_page.services.not_found_edit', 'Facility not found or you do not have permission to edit it.'), type: 'error' }); 
        }
    };

    const handleDeleteFacility = async (facilityId) => {
        const user = auth.currentUser;
        if (!user) { setToast({ show: true, message: t('facilities_page.services.must_be_logged_in', 'You must be logged in.'), type: 'error' }); return; }
        let facility = (filteredFacilities || []).find(f => f.id === facilityId);
        if (!facility) {
             facility = await getHealthFacilityById(facilityId);
             if (facility) {
                  const userScope = permissions.manageScope;
                   if (userScope === 'locality' && (!userLocalities || !userLocalities.includes(facility['المحلية']))) { facility = null; } else if (userScope === 'state' && (!userStates || !userStates.includes(facility['الولاية']))) { facility = null; }
             }
        }
        if (!facility) { setToast({ show: true, message: t('facilities_page.services.not_found_delete', 'Facility not found or you do not have permission to delete it.'), type: 'error' }); return; }
        const confirmMessage = permissions.canApproveSubmissions ? t('facilities_page.services.confirm_delete_facility', 'Are you sure you want to permanently delete "{{name}}"? This action cannot be undone.', { name: facility['اسم_المؤسسة'] }) : t('facilities_page.services.confirm_request_deletion', 'Are you sure you want to request deletion for "{{name}}"? This will be sent for approval.', { name: facility['اسم_المؤسسة'] });
        if (await confirmDialog(confirmMessage)) {
            try {
                if (permissions.canApproveSubmissions) {
                    await deleteHealthFacility(facilityId);
                    setToast({ show: true, message: t('facilities_page.services.facility_deleted', 'Facility deleted.'), type: 'success' });
                    // Only this facility leaves the cache; no full re-download.
                    await removeFromCache('healthFacilities', [facilityId]);
                } else {
                    const updaterIdentifier = user.displayName ? `${user.displayName} (${user.email})` : user.email;
                    const payload = { ...facility, _action: 'DELETE', updated_by: updaterIdentifier, 'اخر تحديث': new Date().toISOString(), };
                    await submitFacilityDataForApproval(payload, user.email || 'Unknown User');
                    setToast({ show: true, message: t('facilities_page.services.deletion_requested', 'Deletion request submitted for approval.'), type: 'info' });
                }
            } catch (error) {
                setToast({ show: true, message: t('facilities_page.services.process_failed', 'Failed to process request: {{message}}', { message: error.message }), type: 'error' });
            }
        }
    };

    const handleImport = async (data, originalRows) => {
        if (!permissions.canApproveSubmissions) { setToast({ show: true, message: t('facilities_page.services.no_import_permission', 'You do not have permission to import facilities.'), type: 'error' }); return; }
        setUploadStatus({ inProgress: true, processed: 0, total: data.length, errors: [], message: '' });
        try {
            const { successes, errors, failedRowsData } = await importHealthFacilities(data, originalRows, (progress) => { setUploadStatus(prev => ({ ...prev, processed: progress.processed })); });
            const successCount = successes.length;
            const errorCount = errors.length;
            let message = t('facilities_page.services.import_success', '{{count}} facilities imported/updated successfully.', { count: successCount });
            if (errorCount > 0) { message += '\n' + t('facilities_page.services.import_rows_failed', '{{count}} rows failed to import.', { count: errorCount }); }
             setUploadStatus(prev => ({ ...prev, inProgress: false, message, errors: failedRowsData }));
             await fetchHealthFacilities({}, true);
        } catch (error) {
             setUploadStatus({ inProgress: false, processed: 0, total: 0, errors: [{ message: error.message }], message: t('facilities_page.services.import_failed', 'Import failed: {{message}}', { message: error.message }) });
        }
    };

    const handleConfirmApproval = async (submissionData) => {
        if (!permissions.canApproveSubmissions) return;
        try {
            // --- FIX 2: Strip undefined fields before interacting with Firestore ---
            const cleanSubmissionData = removeUndefinedProperties(submissionData);

            if (cleanSubmissionData._action === 'DELETE') {
                 // --- FIX 3: Target originalFacilityId explicitly for deletions, fallback to id ---
                 const targetId = cleanSubmissionData.originalFacilityId || cleanSubmissionData.id;
                 if (!targetId) throw new Error("Missing facility ID for deletion.");
                 
                 await deleteHealthFacility(targetId);
                 await removeFromCache('healthFacilities', [targetId]);
                 
                 // --- FIX 4: Prevent mapping undefined IDs into rejectFacilitySubmission ---
                 const idsToClean = (cleanSubmissionData._mergedSubmissionIds || [cleanSubmissionData.submissionId]).filter(Boolean);
                 await Promise.all(idsToClean.map(id => rejectFacilitySubmission(id, auth.currentUser?.email || 'Unknown Approver')));
                 
                 setToast({ show: true, message: t('facilities_page.services.deletion_approved', 'Facility deletion approved and completed.'), type: "success" });
            } else {
                await approveFacilitySubmission(cleanSubmissionData, auth.currentUser?.email || 'Unknown Approver');
                if (cleanSubmissionData._mergedSubmissionIds && cleanSubmissionData._mergedSubmissionIds.length > 1) {
                    const redundantIds = cleanSubmissionData._mergedSubmissionIds.filter(id => id !== cleanSubmissionData.submissionId).filter(Boolean);
                    await Promise.all(redundantIds.map(id => rejectFacilitySubmission(id, 'Merged into a combined submission')));
                }
                setToast({ show: true, message: t('facilities_page.services.submission_approved', 'Submission approved and facility data updated.'), type: "success" });
            }
            setSubmissionForReview(null);
            setComparisonFacilities([]);
            // Take the handled submissions off the list here instead of
            // re-reading every pending submission, and fetch only the
            // facilities that changed instead of all of them.
            const handledIds = (cleanSubmissionData._mergedSubmissionIds || [cleanSubmissionData.submissionId]).filter(Boolean);
            dropPendingSubmissions(handledIds);
            if (cleanSubmissionData._action !== 'DELETE') await fetchHealthFacilities({}, 'sync');
        } catch (error) {
             setToast({ show: true, message: t('facilities_page.services.approval_failed', 'Approval failed: {{message}}', { message: error.message }), type: 'error' });
        }
    };

    const handleReject = async (submissionIds, isDeletionRequest = false) => {
        if (!permissions.canApproveSubmissions) return;
        const confirmRejectMessage = isDeletionRequest ? t('facilities_page.services.confirm_reject_deletion', 'Are you sure you want to reject this deletion request?') : t('facilities_page.services.confirm_reject_submission', 'Are you sure you want to reject this submission?');
        if (await confirmDialog(confirmRejectMessage)) {
            try {
                // --- FIX 5: Safely ensure we don't pass undefined values to rejectDoc ---
                const idsArray = (Array.isArray(submissionIds) ? submissionIds : [submissionIds]).filter(Boolean);
                
                await Promise.all(idsArray.map(id => rejectFacilitySubmission(id, auth.currentUser?.email || 'Unknown Rejector')));
                setToast({ show: true, message: t('facilities_page.services.submission_rejected', 'Submission rejected.'), type: "success" });
                dropPendingSubmissions(idsArray);
            } catch (error) {
                setToast({ show: true, message: t('facilities_page.services.rejection_failed', 'Rejection failed: {{message}}', { message: error.message }), type: 'error' });
            }
        }
    };

    const handleReviewSubmission = useCallback(async (submission) => {
        setIsReviewLoading(true);
        setSubmissionForReview(submission);
        try {
             let relevantFacilities = activeHealthFacilities || [];
             const userScope = permissions.manageScope;
             if(userScope === 'state' && userStates && userStates.length > 0) { const allowedStates = new Set(userStates); relevantFacilities = relevantFacilities.filter(f => allowedStates.has(f['الولاية'])); }
            setComparisonFacilities(relevantFacilities);
        } catch (error) {
            setToast({ show: true, message: t('facilities_page.services.comparison_load_failed', 'Failed to load comparison data.'), type: 'error' });
        } finally {
            setIsReviewLoading(false);
        }
    }, [activeHealthFacilities, setToast, t, permissions.manageScope, userStates]);

    const handleGenerateLink = (facilityId) => {
        const facility = (filteredFacilities || []).find(f => f.id === facilityId);
        const facilityName = facility ? facility['اسم_المؤسسة'] : 'المنشأة';
        
        let url = `${getBaseUrl()}/facilities/data-entry/${facilityId}`;
        if (serviceTypeFilter) { url += `?service=${encodeURIComponent(serviceTypeFilter)}`; }
        
        const textToCopy = `الرجاء تحديث بيانات المنشأة "${facilityName}" عبر الرابط التالي:\n\n${url}`;
        
        shareViaWhatsApp(textToCopy, 'تم نسخ الرابط مع الوصف بنجاح!');
    };

    const handleCopySingleUpdateLink = () => {
        let url;
        let textToCopy;

        if (updateSelectionData.facilityId) {
            const facility = facilitiesToDisplay.find(fac => fac.id === updateSelectionData.facilityId);
            const facilityName = facility ? facility['اسم_المؤسسة'] : 'المنشأة';
            
            url = `${getBaseUrl()}/facilities/data-entry/${updateSelectionData.facilityId}`;
            if (updateSelectionService) { 
                url += `?service=${encodeURIComponent(updateSelectionService)}`; 
            }
            
            textToCopy = `الرجاء تحديث بيانات المنشأة "${facilityName}" لخدمة "${updateSelectionService}" عبر الرابط التالي:\n\n${url}`;
        } else {
            const params = new URLSearchParams();
            if (updateSelectionService) params.append('service', updateSelectionService);
            if (updateSelectionData.state) params.append('state', updateSelectionData.state);
            if (updateSelectionData.locality) params.append('locality', updateSelectionData.locality);
            
            url = `${getBaseUrl()}/facilities/data-entry/new?${params.toString()}`;
            
            let locationDesc = '';
            if (updateSelectionData.locality) {
                locationDesc = ` في محلية ${LOCALITY_EN_TO_AR_MAP[updateSelectionData.locality] || updateSelectionData.locality}`;
            } else if (updateSelectionData.state) {
                locationDesc = ` في ولاية ${STATE_LOCALITIES[updateSelectionData.state]?.ar || updateSelectionData.state}`;
            }

            textToCopy = `الرجاء الدخول واختيار المنشأة${locationDesc} لتحديث بيانات خدمة "${updateSelectionService}" عبر الرابط التالي:\n\n${url}`;
        }
        
        shareViaWhatsApp(textToCopy, 'تم نسخ الرابط بنجاح!');
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

    const renderFormPage = () => {
        const saveButtonText = permissions.canApproveSubmissions ? t('facilities_page.services.save_directly', 'Save Directly') : t('facilities_page.services.submit_for_approval', 'Submit for Approval');
        
        let formTypeKey = 'imnci';
        if (updateSelectionService === 'IMNCI') formTypeKey = 'imnci';
        if (updateSelectionService === 'EENC') formTypeKey = 'eenc';
        if (updateSelectionService === 'Neonatal') formTypeKey = 'neonatal';
        if (updateSelectionService === 'Critical Care') formTypeKey = 'critical';

        const FORM_KEY_TO_COMPONENT = {
            'imnci': IMNCIFormFields,
            'eenc': EENCFormFields,
            'neonatal': NeonatalFormFields,
            'critical': CriticalCareFormFields,
        };

        const FormComponent = FORM_KEY_TO_COMPONENT[formTypeKey] || IMNCIFormFields;

        const handleBackClick = () => {
            setEditingFacility(null);
            if (updateSelectionService) {
                setUpdateSelectionService(null);
                setView('action_menu');
            } else {
                setView('list');
            }
        };

        const pendingFacilityData = editingFacility 
            ? (uniquePendingSubmissions || []).find(s => 
                s['اسم_المؤسسة'] === editingFacility['اسم_المؤسسة'] && 
                s['الولاية'] === editingFacility['الولاية'] && 
                s['المحلية'] === editingFacility['المحلية']
              ) 
            : null;

        return (
            <div className="w-full max-w-7xl mx-auto animate-fade-in">
                <div className="mb-4 flex justify-end" dir="rtl">
                    <Button variant="secondary" onClick={handleBackClick} className="flex items-center gap-2 font-bold px-6 py-2 rounded-lg border-2 border-gray-200 hover:bg-white shadow-sm">
                        <ArrowLeft className="w-5 h-5 ml-2" /> الرجوع للخلف
                    </Button>
                </div>
                <GenericFacilityForm
                    initialData={formInitialData}
                    pendingData={pendingFacilityData}
                    onSave={handleSaveFacility}
                    onCancel={handleBackClick}
                    setToast={setToast}
                    title={editingFacility ? `تحديث بيانات: ${updateSelectionService || 'المنشأة'}` : `إضافة منشأة جديدة`}
                    subtitle={editingFacility ? `المنشأة: ${editingFacility['اسم_المؤسسة']}` : `أدخل تفاصيل المنشأة`}
                    saveButtonText={saveButtonText}
                    userAssignedState={userStates && userStates.length === 1 ? userStates[0] : null}
                    userAssignedLocality={userLocalities && userLocalities.length === 1 ? userLocalities[0] : null}
                >
                    {(props) => (
                        <div className="space-y-8">
                            {updateSelectionService ? <FormComponent {...props} /> : (
                                <>
                                    <IMNCIFormFields {...props} />
                                    <EENCFormFields {...props} />
                                    <NeonatalFormFields {...props} />
                                    <CriticalCareFormFields {...props} />
                                </>
                            )}
                        </div>
                    )}
                </GenericFacilityForm>
            </div>
        );
    };

    const renderListView = () => {
        const FACILITY_TYPES = ["مركز صحة الاسرة", "مستشفى ريفي", "وحدة صحة الاسرة", "مستشفى"];
        const SERVICE_TYPES = [
            'IMNCI', 
            'EENC', 
            'Neonatal (Any Level)', 
            'Neonatal (Primary)', 
            'Neonatal (Secondary)', 
            'Neonatal (Tertiary)', 
            'Critical Care'
        ];
        const EENC_SERVICE_TYPES = ["CEmONC", "BEmONC", "general", "pediatric"];
        const SERVICE_TYPE_LABELS = {
            'Neonatal (Any Level)': t('facilities_page.services.service_types.neonatal_any', 'Neonatal (Any Level)'),
            'Neonatal (Primary)': t('facilities_page.services.service_types.neonatal_primary', 'Neonatal (Primary)'),
            'Neonatal (Secondary)': t('facilities_page.services.service_types.neonatal_secondary', 'Neonatal (Secondary)'),
            'Neonatal (Tertiary)': t('facilities_page.services.service_types.neonatal_tertiary', 'Neonatal (Tertiary)'),
            'Critical Care': t('facilities_page.services.service_types.critical_care', 'Critical Care'),
        };
        const EENC_SERVICE_TYPE_LABELS = {
            'general': t('facilities_page.services.eenc_types.general', 'general'),
            'pediatric': t('facilities_page.services.eenc_types.pediatric', 'pediatric'),
        };
        const TAB_LABELS = {
            [TABS.PENDING]: t('facilities_page.services.tabs.pending', 'Pending Submissions'),
            [TABS.ALL]: t('facilities_page.services.tabs.all', 'All Facilities'),
        };
        
        const isLocalityManager = permissions.manageScope === 'locality';
        const isStateManager = permissions.manageScope === 'state';
        const isRestrictedUser = isLocalityManager || isStateManager;
        const isUnassignedLocalityManager = isLocalityManager && (!userLocalities || userLocalities.length === 0);
        const isUnassignedStateManager = isStateManager && (!userStates || userStates.length === 0);

        let emptyStateMessage = t('facilities_page.services.empty.none_found', 'No health facilities found for the selected criteria.');
        if (isUnassignedLocalityManager) { emptyStateMessage = t('facilities_page.services.empty.no_locality_assigned', 'You are a Locality Manager but do not have a locality assigned. Please contact an administrator.'); } 
        else if (isUnassignedStateManager) { emptyStateMessage = t('facilities_page.services.empty.no_state_assigned', 'You are a State Manager but do not have a state assigned. Please contact an administrator.'); } 
        else if (!stateFilter && isRestrictedUser) { emptyStateMessage = t('facilities_page.services.empty.select_assigned_state', 'Please select your assigned State to view facilities.'); } 
        else if (!stateFilter && !isRestrictedUser) { emptyStateMessage = t('facilities_page.services.empty.select_state_or_filters', 'Please select a State or apply other filters to begin viewing facilities.'); } 
        else if (!hasManuallySelected) { emptyStateMessage = t('facilities_page.services.empty.select_state_or_filters', 'Please select a State or apply other filters to begin viewing facilities.'); }

        const tabsContent = {
            [TABS.PENDING]: <PendingSubmissionsTab submissions={uniquePendingSubmissions || []} onApprove={handleReviewSubmission} onReject={handleReject} />,
            [TABS.ALL]: <AllFacilitiesTab facilities={paginatedFacilities || []} onEdit={handleEditFacility} onDelete={handleDeleteFacility} onGenerateLink={handleGenerateLink} onOpenMap={handleOpenMapModal} onOpenHistory={handleOpenHistoryModal} emptyMessage={emptyStateMessage} canApproveSubmissions={permissions.canApproveSubmissions} canManageFacilities={permissions.canManageFacilities} />,
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
                    <div className="flex items-center gap-4">
                        <Button variant="secondary" onClick={() => setView('action_menu')} className="mr-4">
                            <ArrowLeft className="w-4 h-4 mr-1 inline" /> {t('facilities_page.common.back', 'Back')}
                        </Button>
                        <PageHeader 
                            title={t('facilities_page.services.page_title', 'Child Health Services Management')} 
                            subtitle={t('facilities_page.services.page_subtitle', 'Manage health facilities and their pediatric services.')}
                        />
                    </div>
                    <Button 
                        variant="secondary" 
                        onClick={handleRefresh} 
                        disabled={isRefreshing}
                        className="flex items-center gap-2"
                    >
                        {isRefreshing ? (
                            <> <Spinner size="sm" /> {t('facilities_page.services.refreshing', 'Refreshing...')} </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.759l.274.549a.75.75 0 101.3-.65l-.274-.549a5.479 5.479 0 016.128-4.032.75.75 0 00.573-1.376 6.979 6.979 0 00-7.75-2.088l-.94-.313a.75.75 0 00-.913.655v1.944a.75.75 0 001.5 0V7.32l.94.313a5.479 5.479 0 016.128 4.032zM4.688 8.576a5.5 5.5 0 019.201-2.759l-.274-.549a.75.75 0 10-1.3.65l.274.549a5.479 5.479 0 01-6.128 4.032.75.75 0 00-.573 1.376 6.979 6.979 0 007.75 2.088l.94.313a.75.75 0 00.913-.655V12.06a.75.75 0 00-1.5 0v1.631l-.94-.313a5.479 5.479 0 01-6.128-4.032z" clipRule="evenodd" />
                                </svg>
                                {t('facilities_page.services.refresh', 'Refresh')}
                            </>
                        )}
                    </Button>
                </div>
                
                <div className="border-b border-gray-200 mt-6"><nav className="-mb-px flex space-x-4 overflow-x-auto">{availableTabs.map(tabName => (<button key={tabName} onClick={() => setActiveTab(tabName)} className={`${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm`}>{TAB_LABELS[tabName] || tabName}{tabName === TABS.PENDING && uniquePendingSubmissions && uniquePendingSubmissions.length > 0 && <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{uniquePendingSubmissions.length}</span>}</button>))}</nav></div>

                {activeTab === TABS.PENDING && (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4 items-end">
                        <FormGroup label={t('facilities_page.services.filter_submission_start', 'Filter by Submission Start Date')}>
                            <Input type="date" value={pendingStartDate} onChange={(e) => setPendingStartDate(e.target.value)} />
                        </FormGroup>
                        <FormGroup label={t('facilities_page.services.filter_submission_end', 'Filter by Submission End Date')}>
                            <Input type="date" value={pendingEndDate} onChange={(e) => setPendingEndDate(e.target.value)} />
                        </FormGroup>
                    </div>
                )}

                {showFiltersAndActions && (<>
                    <div className="flex flex-wrap gap-4 my-4 items-end">
                       <div className="flex-1 min-w-[160px]"><FormGroup label={t('facilities_page.services.filter_state', 'Filter by State')}><Select value={stateFilter} onChange={handleStateChange} disabled={isStateFilterDisabled}>{availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></FormGroup></div>
                       <div className="flex-1 min-w-[160px]">
                            <FormGroup label={t('facilities_page.services.filter_locality', 'Filter by Locality')}>
                                <Select value={localityFilter} onChange={(e) => { setLocalityFilter(e.target.value); setHasManuallySelected(true); }} disabled={isLocalityFilterDisabled}>
                                    {isLocalityManager ? (
                                        userLocalities && userLocalities.length > 0 ? ( userLocalities.map(locEn => { const locAr = stateFilter && STATE_LOCALITIES[stateFilter]?.localities.find(l => l.en === locEn)?.ar || locEn; return <option key={locEn} value={locEn}>{locAr}</option>; }) ) : ( <option value="">{t('facilities_page.services.no_locality_assigned_option', '-- No Locality Assigned --')}</option> )
                                    ) : (
                                         <> <option value="">{t('facilities_page.services.all_localities', 'All Localities')}</option> {stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a, b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option> )} </>
                                    )}
                                </Select>
                            </FormGroup>
                        </div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label={t('facilities_page.services.filter_facility_type', 'Filter by Facility Type')}><Select value={facilityTypeFilter} onChange={(e) => { setFacilityTypeFilter(e.target.value); setHasManuallySelected(true); }}><option value="">{t('facilities_page.services.all_types', 'All Types')}</option>{FACILITY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</Select></FormGroup></div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label={t('facilities_page.services.filter_service', 'Filter by Service')}><Select value={serviceTypeFilter} onChange={(e) => { setServiceTypeFilter(e.target.value); setHasManuallySelected(true); }}><option value="">{t('facilities_page.services.all_services', 'All Services')}</option>{SERVICE_TYPES.map(type => <option key={type} value={type}>{SERVICE_TYPE_LABELS[type] || type}</option>)}</Select></FormGroup></div>
                        
                        <div className="flex-1 min-w-[160px]"><FormGroup label="نوع الخدمات المقدمة"><Select value={eencServiceTypeFilter} onChange={(e) => { setEencServiceTypeFilter(e.target.value); setHasManuallySelected(true); }}><option value="">{t('facilities_page.services.all_types', 'All Types')}</option>{EENC_SERVICE_TYPES.map(type => <option key={type} value={type}>{EENC_SERVICE_TYPE_LABELS[type] || type}</option>)}</Select></FormGroup></div>

                        <div className="flex-1 min-w-[160px]"><FormGroup label={t('facilities_page.services.functioning_status', 'Functioning Status')}><Select value={functioningFilter} onChange={(e) => { setFunctioningFilter(e.target.value); setHasManuallySelected(true); }}><option value="">{t('facilities_page.services.all', 'All')}</option><option value="Yes">{t('facilities_page.common.yes', 'Yes')}</option><option value="No">{t('facilities_page.common.no', 'No')}</option><option value="NOT_SET">{t('facilities_page.services.not_set', 'Not Set')}</option></Select></FormGroup></div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label={t('facilities_page.services.filter_project', 'Filter by Project Name')}><Select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setHasManuallySelected(true); }}><option value="">{t('facilities_page.services.all_projects', 'All Projects')}</option>{(projectNames || []).map(name => <option key={name} value={name}>{name}</option>)}</Select></FormGroup></div>
                    </div>

                    <div className="flex justify-between items-center my-4">
                        <div className="flex flex-wrap gap-2">
                            {permissions.canManageFacilities && ( <Button onClick={() => { setEditingFacility(null); setUpdateSelectionService(null); setView('form'); }}>{t('facilities_page.services.add_new', 'Add New')}</Button> )}
                            {canBulkUploadFacilities && ( <Button onClick={() => setIsBulkUploadModalOpen(true)}>{t('facilities_page.services.bulk_upload', 'Bulk Upload')}</Button> )}
                            
                            <Button variant="info" onClick={handleShareBulkUpdateLink}>{t('facilities_page.services.share_bulk_link', 'Share Bulk Update Link')}</Button>
                            
                            <Button variant="secondary" onClick={handleExportExcel} disabled={!filteredFacilities || filteredFacilities.length === 0}>{t('facilities_page.services.export_excel', 'Export Excel')}</Button>
                            
                            {isPdfGenerating ? (
                                <Button disabled variant="secondary"><Spinner size="sm" /> {t('facilities_page.services.generating_pdf', 'Generating PDF...')}</Button>
                            ) : (
                                <>
                                    <Button onClick={() => handlePdfListGeneration('print')} variant="secondary" className="flex items-center gap-1" disabled={!filteredFacilities || filteredFacilities.length === 0}>
                                        <PdfIcon /> {t('facilities_page.services.export_pdf_print', 'Export PDF (Print)')}
                                    </Button>
                                    <Button onClick={() => handlePdfListGeneration('screen')} variant="secondary" className="flex items-center gap-1" disabled={!filteredFacilities || filteredFacilities.length === 0}>
                                        <PdfIcon /> {t('facilities_page.services.export_pdf_share', 'Export PDF (Share)')}
                                    </Button>
                                </>
                            )}
                        </div>
                         
                        <div className="flex flex-wrap gap-2">
                             {canFindFacilityDuplicates && ( <Button variant="secondary" onClick={() => setIsDuplicateModalOpen(true)}>{t('facilities_page.services.find_duplicates', 'Find Duplicates')}</Button> )}
                             {canCleanFacilityData && ( <Button variant="secondary" onClick={() => setIsCleanupModalOpen(true)}>{t('facilities_page.services.clean_data', 'Clean Data')}</Button> )}
                             {canCleanFacilityData && ( <Button variant="secondary" onClick={() => setIsNameStandardizationOpen(true)}>{t('facilities_page.services.standardize_names', 'Standardize Projects & Organizations')}</Button> )}
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                        {hasManuallySelected ? t('facilities_page.services.showing_n', 'Showing {{count}} facilities.', { count: totalFacilities }) : t('facilities_page.services.select_filters', 'Select filters to view data.')}
                    </p>
                     <div className="my-4">
                        <Input type="search" placeholder={t('facilities_page.services.search_placeholder', 'Search by Facility Name...')} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setHasManuallySelected(true); }} />
                    </div>
                </>)}

                {isFacilitiesLoading || isReviewLoading || (activeTab === TABS.PENDING && isSubmissionsLoading) ? (
                    <div className="mt-4"><SkeletonTable rows={8} columns={5} /></div>
                ) : (
                    <div className="mt-4" id="facility-list-content">
                        {tabsContent[activeTab]}
                    </div>
                )}
                
                {showFiltersAndActions && hasManuallySelected && totalFacilities > 0 && (
                    <div className="flex justify-between items-center mt-4 p-4 border-t">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-700">
                                {t('facilities_page.services.page', 'Page')} <strong>{currentPage}</strong> {t('facilities_page.services.of', 'of')} <strong>{totalPages}</strong> {t('facilities_page.services.total_facilities', '(Total: {{count}} facilities)', { count: totalFacilities })}
                            </span>
                            <div className="flex items-center gap-2">
                                <label htmlFor="itemsPerPageSelect" className="text-sm font-medium text-gray-700">{t('facilities_page.services.per_page', 'Per Page:')}</label>
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
                            <Button variant="secondary" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} > &larr; {t('facilities_page.services.previous', 'Previous')} </Button>
                            <Button variant="secondary" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || totalPages === 0} > {t('facilities_page.services.next', 'Next')} &rarr; </Button>
                        </div>
                    </div>
                )}
            </div>
        </Card>);
    };

    const facilitiesInLocality = useMemo(() => {
         if (!scopedFacilities || !updateSelectionData.state || !updateSelectionData.locality) return [];
         return scopedFacilities.filter(f => f['الولاية'] === updateSelectionData.state && f['المحلية'] === updateSelectionData.locality)
                                      .sort((a, b) => (a['اسم_المؤسسة'] || '').localeCompare(b['اسم_المؤسسة'] || ''));
    }, [scopedFacilities, updateSelectionData.state, updateSelectionData.locality]);

    const facilitiesWithService = useMemo(() => {
         if (!updateSelectionService) return [];
         return facilitiesInLocality.filter(f => {
              const facilityType = f['نوع_المؤسسةالصحية'];
              const isPHC = facilityType === 'مركز صحة الاسرة' || facilityType === 'وحدة صحة الاسرة';
              const isHospital = facilityType === 'مستشفى' || facilityType === 'مستشفى ريفي';

              if (updateSelectionService === 'IMNCI') return f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes' || isPHC;
              if (updateSelectionService === 'EENC') return f.eenc_provides_essential_care === 'Yes' || isHospital;
              if (updateSelectionService === 'Neonatal') return !!(f.neonatal_level_of_care?.primary || f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary) || isHospital;
              if (updateSelectionService === 'Critical Care') return f.etat_has_service !== 'Yes' && f.hdu_has_service !== 'Yes' && f.picu_has_service !== 'Yes' || isHospital;
              return true;
         });
    }, [facilitiesInLocality, updateSelectionService]);

    const facilitiesToDisplay = facilitiesWithService.length > 0 ? facilitiesWithService : facilitiesInLocality;
    
    const searchedFacilitiesToDisplay = useMemo(() => {
        if (!updateSelectionSearch) return facilitiesToDisplay;
        const lowerQuery = updateSelectionSearch.toLowerCase();
        return facilitiesToDisplay.filter(f => (f['اسم_المؤسسة'] || '').toLowerCase().includes(lowerQuery));
    }, [facilitiesToDisplay, updateSelectionSearch]);

    const isShowingAll = facilitiesWithService.length === 0 && facilitiesInLocality.length > 0;
    
    return (
        <>
            {view === 'action_menu' ? (
                <ActionMenu onAction={handleActionMenuClick} isSuperUserOrFed={isSuperUserOrFed} />
            ) : view === 'list' ? (
                renderListView()
            ) : view === 'form' ? (
                renderFormPage()
            ) : view === 'kpi_history' ? (
                <AggregateHistoryDashboard userStates={userStates} onBack={() => setView('action_menu')} />
            ) : view === 'update_dashboard' ? (
                <UpdateDashboard facilities={scopedFacilities || []} onBack={() => setView('action_menu')} />
            ) : null}

            <Modal isOpen={!!updateSelectionService && view === 'action_menu'} onClose={() => setUpdateSelectionService(null)} title={`تحديث بيانات - ${updateSelectionService}`} size="lg">
                <div className="p-6 space-y-4" dir="rtl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormGroup label="الولاية">
                             <Select 
                                value={updateSelectionData.state} 
                                onChange={(e) => {
                                    setUpdateSelectionData({ state: e.target.value, locality: '', facilityId: '' });
                                    setUpdateSelectionSearch(''); 
                                }}
                                disabled={userStates && userStates.length === 1}
                             >
                                  <option value="">اختر الولاية</option>
                                  {Object.keys(STATE_LOCALITIES)
                                    .filter(s => !userStates || userStates.length === 0 || userStates.includes(s))
                                    .map(k => <option key={k} value={k}>{STATE_LOCALITIES[k].ar}</option>)}
                             </Select>
                        </FormGroup>
                        <FormGroup label="المحلية">
                             <Select 
                                value={updateSelectionData.locality} 
                                onChange={(e) => {
                                    setUpdateSelectionData({ ...updateSelectionData, locality: e.target.value, facilityId: '' });
                                    setUpdateSelectionSearch(''); 
                                }} 
                                disabled={!updateSelectionData.state || (userLocalities && userLocalities.length === 1)}
                             >
                                  <option value="">اختر المحلية</option>
                                  {updateSelectionData.state && STATE_LOCALITIES[updateSelectionData.state]?.localities
                                    .filter(l => !userLocalities || userLocalities.length === 0 || userLocalities.includes(l.en))
                                    .map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                             </Select>
                        </FormGroup>
                    </div>
                    
                    {updateSelectionData.locality && (
                        <div className="mt-4 animate-fade-in">
                             {isFacilitiesLoading ? (
                                 <div className="flex flex-col items-center justify-center p-4">
                                     <Spinner size="sm" />
                                     <p className="text-sm font-semibold text-gray-600 mt-2">جاري التحميل... (Loading...)</p>
                                 </div>
                             ) : (
                                 <>
                                     <FormGroup label="بحث وتحديد المنشأة">
                                         <div className="relative mb-3">
                                             <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                                             <Input 
                                                 type="search" 
                                                 placeholder="أدخل اسم المنشأة للبحث المباشر..." 
                                                 value={updateSelectionSearch} 
                                                 onChange={(e) => setUpdateSelectionSearch(e.target.value)}
                                                 className="pr-10 bg-white"
                                            />
                                         </div>
                                     </FormGroup>

                                     <div className="mt-2">
                                         <label className="block text-sm font-semibold text-gray-700 mb-2">
                                             المنشآت المتاحة ({searchedFacilitiesToDisplay.length})
                                         </label>
                                         <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-inner">
                                             {searchedFacilitiesToDisplay.length > 0 ? (
                                                 <ul className="divide-y divide-gray-100">
                                                     {searchedFacilitiesToDisplay.map(f => (
                                                         <li 
                                                             key={f.id}
                                                             onClick={() => setUpdateSelectionData({ ...updateSelectionData, facilityId: f.id })}
                                                             className={`p-3 cursor-pointer transition-colors ${updateSelectionData.facilityId === f.id ? 'bg-sky-100 border-r-4 border-r-sky-500 text-sky-800 font-bold' : 'hover:bg-gray-50 text-gray-700 font-medium'}`}
                                                         >
                                                             {f['اسم_المؤسسة']}
                                                         </li>
                                                     ))}
                                                 </ul>
                                             ) : (
                                                 <div className="p-6 text-center text-sm text-gray-500">
                                                     لا توجد مؤسسات مطابقة للبحث
                                                 </div>
                                             )}
                                         </div>
                                     </div>

                                     {isShowingAll && <p className="text-amber-600 font-medium text-xs mt-3 bg-amber-50 p-2 rounded border border-amber-100">لا توجد منشآت مسجلة بهذه الخدمة. يتم عرض جميع المنشآت في المحلية.</p>}
                                 </>
                             )}
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-2 mt-6 border-t pt-4">
                        <Button variant="secondary" onClick={() => setUpdateSelectionService(null)}>إلغاء</Button>
                        
                        <Button 
                            variant="info" 
                            onClick={handleCopySingleUpdateLink} 
                            disabled={isFacilitiesLoading} 
                        >
                            نسخ الرابط
                        </Button>
                        
                        <Button 
                            onClick={() => {
                                const f = facilitiesToDisplay.find(fac => fac.id === updateSelectionData.facilityId);
                                if (f) {
                                    setEditingFacility(f);
                                    setView('form');
                                }
                            }} 
                            disabled={!updateSelectionData.facilityId || isFacilitiesLoading}
                        >
                            متابعة لتحديث البيانات
                        </Button>
                    </div>
                </div>
            </Modal>

            <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />

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
                projectNames={projectNames}
                canonicalProject={canonicalProject}
            />
            <DuplicateFinderModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                facilities={filteredFacilities || []}
                onDuplicatesDeleted={(ids) => {
                    removeFromCache('healthFacilities', ids);
                }}
            />
            <DataCleanupModal
                isOpen={isCleanupModalOpen}
                onClose={() => setIsCleanupModalOpen(false)}
                facilities={filteredFacilities || []}
                onCleanupComplete={() => {
                    fetchHealthFacilities({}, true);
                }}
                setToast={setToast}
                cleanupConfig={CLEANABLE_FIELDS_CONFIG}
            />
            {isNameStandardizationOpen && (
                <NameStandardizationModal
                    isOpen={isNameStandardizationOpen}
                    onClose={() => setIsNameStandardizationOpen(false)}
                    facilities={scopedFacilities || []}
                    onComplete={() => { setIsNameStandardizationOpen(false); fetchHealthFacilities({}, true); }}
                    setToast={setToast}
                />
            )}
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
            <FacilityHistoryView
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                facility={facilityForHistory}
            />
        </>
    );
};

export default ChildHealthServicesView;