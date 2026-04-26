// child_helathservice_bulk-update.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// --- ICONS ---
import { Plus, Trash2, Edit } from 'lucide-react';

// --- DATA & CONFIG ---
import { db } from "../firebase";
import { submitFacilityDataForApproval, saveFacilitySnapshot } from "../data.js"; 
import { useDataCache } from '../DataContext'; 
import { STATE_LOCALITIES } from "./constants.js";
import { amiriFontBase64 } from './AmiriFont.js';

// --- COMPONENTS ---
import {
    Card, PageHeader, Button, FormGroup, Select,
    Modal, Spinner, Input, PdfIcon
} from './CommonComponents';

// --- CONSTANTS ---
const LOCALITY_EN_TO_AR_MAP = Object.values(STATE_LOCALITIES).flatMap(s => s.localities).reduce((acc, loc) => {
    acc[loc.en] = loc.ar;
    return acc;
}, {});

const OWNERSHIP_OPTIONS = ['حكومي', 'خاص', 'منظمات', 'اهلي'];
const FACILITY_TYPE_OPTIONS = ["مستشفى", "مستشفى ريفي", "مستشفى تخصصي", "مركز صحة الاسرة", "وحدة صحة الاسرة", "شفخانه", "نقطة غيار"];

const SERVICE_TYPE_OPTIONS = [
    { value: 'CEmONC', label: 'طواري شاملة (CEmONC)' },
    { value: 'BEmONC', label: 'طواري أساسية (BEmONC)' },
    { value: 'pediatric', label: 'مستشفى اطفال' },
    { value: 'general', label: 'خدمات عامة' }
];

const getPct = (val, total) => total > 0 ? Math.round((val / total) * 100) : 0;

// --- HELPER: GET LIVE VALUE (Includes unsaved edits) ---
const getVal = (f, key, updates) => updates[f.id]?.[key] ?? f[key];
const isYes = (val) => val === 'Yes' || val === true;

// --- HELPER: CALCULATE DYNAMIC KPIS (Dashboard Logic) ---
const calculateKPIs = (targetFacilities, updates, serviceCategory) => {
    const total = targetFacilities.length;
    if (total === 0) return null;

    const countYes = (key) => targetFacilities.filter(f => isYes(getVal(f, key, updates))).length;
    const sumNumber = (key) => targetFacilities.reduce((sum, f) => sum + (Number(getVal(f, key, updates)) || 0), 0);

    // 1. IMNCI Logic
    const functioningPhcs = targetFacilities.filter(f => 
        isYes(getVal(f, 'هل_المؤسسة_تعمل', updates)) && 
        ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(getVal(f, 'نوع_المؤسسةالصحية', updates))
    );
    const imnciInPhcs = functioningPhcs.filter(f => isYes(getVal(f, 'وجود_العلاج_المتكامل_لامراض_الطفولة', updates)));

    // 2. EENC Logic
    const emoncFacilities = targetFacilities.filter(f => 
        ['BEmONC', 'CEmONC'].includes(getVal(f, 'eenc_service_type', updates)) && 
        isYes(getVal(f, 'هل_المؤسسة_تعمل', updates))
    );
    const eencProviders = emoncFacilities.filter(f => isYes(getVal(f, 'eenc_provides_essential_care', updates)));

    // 3. Neonatal (SCNU) Logic
    const supposedScnuFacilities = targetFacilities.filter(f => {
        const sType = getVal(f, 'eenc_service_type', updates);
        const p = getVal(f, 'neonatal_level_primary', updates) ?? f.neonatal_level_of_care?.primary;
        const s = getVal(f, 'neonatal_level_secondary', updates) ?? f.neonatal_level_of_care?.secondary;
        const t = getVal(f, 'neonatal_level_tertiary', updates) ?? f.neonatal_level_of_care?.tertiary;
        return ['CEmONC', 'pediatric'].includes(sType) || isYes(p) || isYes(s) || isYes(t);
    });
    const functioningScnus = supposedScnuFacilities.filter(f => 
        isYes(getVal(f, 'هل_المؤسسة_تعمل', updates)) && 
        isYes(getVal(f, 'neonatal_level_secondary', updates) ?? f.neonatal_level_of_care?.secondary)
    );

    // 4. Critical Care (ETAT) Logic
    const targetHospitals = targetFacilities.filter(f => 
        ['مستشفى', 'مستشفى ريفي'].includes(getVal(f, 'نوع_المؤسسةالصحية', updates)) || 
        getVal(f, 'eenc_service_type', updates) === 'pediatric'
    );
    const hospitalsWithEtat = targetHospitals.filter(f => isYes(getVal(f, 'etat_has_service', updates)));

    if (serviceCategory === 'IMNCI') {
        return {
            total,
            type: 'IMNCI',
            imnci: imnciInPhcs.length,
            imnciTotal: functioningPhcs.length, 
            ors: countYes('غرفة_إرواء'),
            timer: countYes('ساعة_مؤقت'),
            scale: countYes('ميزان_وزن'),
        };
    } else if (serviceCategory === 'EENC') {
        return {
            total,
            type: 'EENC',
            eenc: eencProviders.length,
            eencTotal: emoncFacilities.length, 
            ambu: sumNumber('eenc_ambu_bags'),
            resuscitation: sumNumber('eenc_resuscitation_stations'),
            workers: sumNumber('eenc_trained_workers')
        };
    } else if (serviceCategory === 'Neonatal') {
        return {
            total,
            type: 'Neonatal',
            scnu: functioningScnus.length,
            scnuTotal: supposedScnuFacilities.length, 
            primary: countYes('neonatal_level_primary') || targetFacilities.filter(f=>isYes(f.neonatal_level_of_care?.primary)).length,
            secondary: countYes('neonatal_level_secondary') || targetFacilities.filter(f=>isYes(f.neonatal_level_of_care?.secondary)).length,
            tertiary: countYes('neonatal_level_tertiary') || targetFacilities.filter(f=>isYes(f.neonatal_level_of_care?.tertiary)).length,
            kmc: countYes('neonatal_kmc_unit')
        };
    } else if (serviceCategory === 'Critical Care') {
        return {
            total,
            type: 'Critical',
            etat: hospitalsWithEtat.length,
            etatTotal: targetHospitals.length, 
            hdu: countYes('hdu_has_service'),
            picu: countYes('picu_has_service')
        };
    } else {
        return {
            total,
            type: 'General',
            imnci: imnciInPhcs.length,
            imnciTotal: functioningPhcs.length,
            eenc: eencProviders.length,
            eencTotal: emoncFacilities.length,
            scnu: functioningScnus.length,
            scnuTotal: supposedScnuFacilities.length,
            critical: hospitalsWithEtat.length,
            criticalTotal: targetHospitals.length
        };
    }
};

// --- HELPER COMPONENT: STAFF MANAGEMENT MODAL ---
const StaffManagementModal = ({ isOpen, onClose, facilityName, initialStaff, onSave }) => {
    const [staffList, setStaffList] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setStaffList(Array.isArray(initialStaff) ? [...initialStaff] : []);
        }
    }, [isOpen, initialStaff]);

    const handleAddStaff = () => {
        setStaffList([...staffList, { name: '', job_title: '', is_trained: 'No', training_date: '', phone: '' }]);
    };

    const handleRemoveStaff = (index) => {
        const newList = [...staffList];
        newList.splice(index, 1);
        setStaffList(newList);
    };

    const handleStaffChange = (index, field, value) => {
        const newList = [...staffList];
        newList[index] = { ...newList[index], [field]: value };
        setStaffList(newList);
    };

    const handleSave = () => {
        const validStaff = staffList.filter(s => s.name && s.name.trim() !== '');
        onSave(validStaff);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`إدارة الكوادر: ${facilityName}`} size="lg">
            <div className="p-4 max-h-[70vh] overflow-y-auto" dir="rtl">
                {staffList.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        لا يوجد كوادر مسجلة.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {staffList.map((staff, index) => (
                            <div key={index} className="p-4 border border-slate-300 rounded bg-slate-50 relative">
                                <button 
                                    onClick={() => handleRemoveStaff(index)}
                                    className="absolute top-2 left-2 text-red-500 hover:text-red-700 font-bold"
                                    title="Remove Worker"
                                >
                                    <Trash2 size={18} />
                                </button>
                                <h4 className="font-semibold text-sm text-slate-700 mb-2">الكادر رقم {index + 1}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <FormGroup label="الاسم">
                                        <Input 
                                            value={staff.name} 
                                            onChange={(e) => handleStaffChange(index, 'name', e.target.value)} 
                                            placeholder="الاسم الرباعي"
                                        />
                                    </FormGroup>
                                    <FormGroup label="الوصف الوظيفي">
                                        <Select 
                                            value={staff.job_title} 
                                            onChange={(e) => handleStaffChange(index, 'job_title', e.target.value)}
                                        >
                                            <option value="">اختر...</option>
                                            <option value="طبيب">طبيب</option>
                                            <option value="مساعد طبي">مساعد طبي</option>
                                            <option value="ممرض معالج">ممرض معالج</option>
                                            <option value="معاون صحي">معاون صحي</option>
                                            <option value="كادر معاون">كادر معاون</option>
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="هل مدرب؟">
                                        <Select 
                                            value={staff.is_trained} 
                                            onChange={(e) => handleStaffChange(index, 'is_trained', e.target.value)}
                                        >
                                            <option value="No">لا</option>
                                            <option value="Yes">نعم</option>
                                            <option value="Planned">مخططة</option>
                                        </Select>
                                    </FormGroup>
                                    {staff.is_trained === 'Yes' && (
                                        <FormGroup label="تاريخ التدريب">
                                            <Input 
                                                type="date" 
                                                value={staff.training_date} 
                                                onChange={(e) => handleStaffChange(index, 'training_date', e.target.value)} 
                                            />
                                        </FormGroup>
                                    )}
                                    <FormGroup label="رقم الهاتف">
                                        <Input 
                                            type="tel" 
                                            value={staff.phone} 
                                            onChange={(e) => handleStaffChange(index, 'phone', e.target.value)} 
                                            placeholder="01xxxxxxxxx"
                                        />
                                    </FormGroup>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="mt-4 flex justify-center">
                    <Button variant="secondary" onClick={handleAddStaff} className="w-full md:w-auto flex items-center gap-2">
                        <Plus size={16} /> إضافة كادر جديد
                    </Button>
                </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
                <Button variant="secondary" onClick={onClose}>إلغاء</Button>
                <Button onClick={handleSave}>حفظ القائمة</Button>
            </div>
        </Modal>
    );
};

// --- MAIN EXPORT: BULK UPDATE VIEW ---
const LocalityBulkUpdateView = ({ stateParam, localityParam, filters, setToast }) => {
    const { healthFacilities, fetchHealthFacilities, isLoading } = useDataCache();
    const isFetchingData = isLoading?.healthFacilities || false;

    const currentFilters = useMemo(() => {
        if (filters && Object.keys(filters).length > 0) return filters;
        return { state: stateParam, locality: localityParam };
    }, [filters, stateParam, localityParam]);

    const activeService = currentFilters.service || 'General';
    
    // States
    const [updates, setUpdates] = useState({}); 
    const [canApprove, setCanApprove] = useState(false); 
    const [isSaving, setIsSaving] = useState(false); 
    
    // Pagination & Display States
    const [displayedFacilities, setDisplayedFacilities] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [viewKpiData, setViewKpiData] = useState(null);
    const [isFiltering, setIsFiltering] = useState(false);
    
    // Search & Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [ownershipFilter, setOwnershipFilter] = useState(''); 
    const [selectedServiceTypes, setSelectedServiceTypes] = useState([]); 
    
    // UI Filters
    const [localStateFilter, setLocalStateFilter] = useState(
        currentFilters.state && currentFilters.state !== 'ALL_STATES' && currentFilters.state !== 'NOT_ASSIGNED' 
        ? currentFilters.state 
        : 'All'
    );
    const [localLocalityFilter, setLocalLocalityFilter] = useState(currentFilters.locality || 'All');
    const [localProjectFilter, setLocalProjectFilter] = useState(currentFilters.project || 'All');

    // Reset pagination to Page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [localStateFilter, localLocalityFilter, localProjectFilter, searchTerm, ownershipFilter, selectedServiceTypes]);

    // Initial background fetch. We fetch all data {} so we don't corrupt the global DataContext cache.
    // We rely purely on the useMemo filter + pagination to prevent UI freezing.
    useEffect(() => {
        fetchHealthFacilities({}, false);
    }, [fetchHealthFacilities]);

    const tableRef = useRef(null);
    
    // Staff Modal State
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [selectedFacilityId, setSelectedFacilityId] = useState(null);
    const [selectedFacilityName, setSelectedFacilityName] = useState('');
    const [currentStaffList, setCurrentStaffList] = useState([]);

    // --- CHECK USER PERMISSIONS FOR DIRECT SAVE ---
    useEffect(() => {
        const checkPerms = async () => {
            const auth = getAuth();
            if (auth.currentUser) {
                const userRef = doc(db, 'users', auth.currentUser.uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.role === 'super_user' || data.role === 'federal_manager' || data.permissions?.canApproveSubmissions) {
                        setCanApprove(true);
                    }
                }
            }
        };
        checkPerms();
    }, []);

    // --- SYNCHRONOUSLY DERIVE PROJECTS FROM CACHE ---
    const allProjectOptions = useMemo(() => {
        if (!healthFacilities) return [];
        const names = new Set();
        healthFacilities.forEach(f => {
            if (f.project_name && f.project_name.trim() !== '') {
                names.add(f.project_name.trim());
            }
        });
        return Array.from(names).sort();
    }, [healthFacilities]);

    // --- CONFIG ---
    const BULK_VIEW_CONFIG = useMemo(() => ({
        'General': {
            label: 'بيانات عامة',
            facilityTypes: null, 
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'project_name', label: 'اسم المشروع', type: 'select', options: allProjectOptions },
                { key: 'eenc_service_type', label: 'نوع الخدمة', type: 'readonly' },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'وجود_العلاج_المتكامل_لامراض_الطفولة', label: 'العلاج المتكامل', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'eenc_provides_essential_care', label: 'رعاية EENC', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'neonatal_level_primary', label: 'حضانة مستوى 1', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'neonatal_level_secondary', label: 'حضانة مستوى 2', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'neonatal_level_tertiary', label: 'حضانة مستوى 3', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'etat_has_service', label: 'فرز الحالات (ETAT)', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'hdu_has_service', label: 'عناية وسيطة (HDU)', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'picu_has_service', label: 'عناية مكثفة (PICU)', type: 'select', options: ['Yes', 'No', 'Planned'] }
            ]
        },
        'IMNCI': {
            label: 'العلاج المتكامل لأمراض الطفولة (IMNCI)',
            facilityTypes: ["مركز صحة الاسرة", "وحدة صحة الاسرة", "شفخانه", "Health Unit", "Family Health Center", "Primary Health Center"],
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'project_name', label: 'اسم المشروع', type: 'select', options: allProjectOptions },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'وجود_العلاج_المتكامل_لامراض_الطفولة', label: 'وجود العلاج المتكامل', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'STAFF_NAMES', label: 'اسم الكادر', type: 'staff_names' },
                { key: 'STAFF_TRAINING', label: 'هل الكادر مدرب', type: 'staff_training' },
                { key: 'STAFF_PHONES', label: 'رقم الهاتف', type: 'staff_phones' },
                { key: 'وجود_سجل_علاج_متكامل', label: 'وجود سجل علاج متكامل', type: 'select', options: ['Yes', 'No'] },
                { key: 'وجود_كتيب_لوحات', label: 'وجود كتيب لوحات', type: 'select', options: ['Yes', 'No'] },
                { key: 'ميزان_وزن', label: 'وجود ميزان وزن', type: 'select', options: ['Yes', 'No'] },
                { key: 'ميزان_طول', label: 'وجود ميزان طول', type: 'select', options: ['Yes', 'No'] },
                { key: 'ميزان_حرارة', label: 'وجود ميزان حرارة', type: 'select', options: ['Yes', 'No'] },
                { key: 'ساعة_مؤقت', label: 'وجود ساعة مؤقت', type: 'select', options: ['Yes', 'No'] },
                { key: 'غرفة_إرواء', label: 'وجود غرفة ارواء', type: 'select', options: ['Yes', 'No'] }
            ]
        },
        'Neonatal': {
            label: 'رعاية حديثي الولادة (Neonatal)',
            facilityTypes: ["مستشفى", "مستشفى ريفي", "مستشفى تخصصي", "Hospital", "Rural Hospital"],
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'eenc_service_type', label: 'نوع الخدمة', type: 'readonly' },
                { key: 'project_name', label: 'اسم المشروع', type: 'select', options: allProjectOptions },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'neonatal_level_primary', label: 'رعاية أولية', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'neonatal_level_secondary', label: 'رعاية ثانوية', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'neonatal_level_tertiary', label: 'رعاية تخصصية (NICU)', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'neonatal_total_incubators', label: 'عدد الحضانَات', type: 'number' },
                { key: 'neonatal_kmc_unit', label: 'وحدة الكنغر (KMC)', type: 'select', options: ['Yes', 'No'] }
            ]
        },
        'EENC': {
            label: 'الرعاية المبكرة لحديثي الولادة (EENC)',
            facilityTypes: ["مستشفى", "مستشفى ريفي", "مستشفى تخصصي", "Hospital", "Rural Hospital"],
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'eenc_service_type', label: 'نوع الخدمة', type: 'readonly' },
                { key: 'project_name', label: 'اسم المشروع', type: 'select', options: allProjectOptions },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'eenc_provides_essential_care', label: 'تقدم خدمة EENC', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'eenc_ambu_bags', label: 'عدد الامبوباق', type: 'number' },
                { key: 'eenc_resuscitation_stations', label: 'محطات الانعاش', type: 'number' },
                { key: 'eenc_trained_workers', label: 'عدد الكوادر المدربة', type: 'number' }
            ]
        },
        'Critical Care': {
            label: 'الرعاية الحرجة (Critical Care)',
            facilityTypes: ["مستشفى", "مستشفى ريفي", "مستشفى تخصصي", "Hospital", "Rural Hospital"],
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'eenc_service_type', label: 'نوع الخدمة', type: 'readonly' },
                { key: 'project_name', label: 'اسم المشروع', type: 'select', options: allProjectOptions },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'etat_has_service', label: 'فرز الحالات (ETAT)', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'hdu_has_service', label: 'عناية وسيطة (HDU)', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'picu_has_service', label: 'عناية مكثفة (PICU)', type: 'select', options: ['Yes', 'No', 'Planned'] },
                { key: 'etat_trained_workers', label: 'الكوادر المدربة', type: 'number' }
            ]
        },
        'Vaccination': {
            label: 'التحصين (Vaccination)',
            facilityTypes: ["مستشفى ريفي", "مركز صحة الاسرة", "وحدة صحة الاسرة", "شفخانه", "Primary Health Center"],
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'project_name', label: 'اسم المشروع', type: 'select', options: allProjectOptions },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'immunization_office_exists', label: 'وجود مكتب تحصين', type: 'select', options: ['Yes', 'No'] },
                { key: 'nearest_immunization_center', label: 'أقرب مركز تحصين', type: 'text' }
            ]
        },
        'Nutrition': {
            label: 'التغذية (Nutrition)',
            facilityTypes: ["مستشفى ريفي", "مركز صحة الاسرة", "وحدة صحة الاسرة", "شفخانه", "Primary Health Center"],
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'project_name', label: 'اسم المشروع', type: 'select', options: allProjectOptions },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'nutrition_center_exists', label: 'مركز تغذية خارجي', type: 'select', options: ['Yes', 'No'] },
                { key: 'growth_monitoring_service_exists', label: 'خدمة متابعة النمو', type: 'select', options: ['Yes', 'No'] },
                { key: 'nearest_nutrition_center', label: 'أقرب مركز تغذية', type: 'text' }
            ]
        }
    }), [allProjectOptions]);

    const config = BULK_VIEW_CONFIG[activeService] || BULK_VIEW_CONFIG['General'];

    // --- SYNCHRONOUS FAST FILTERING ---
    useEffect(() => {
        if (!healthFacilities || healthFacilities.length === 0) {
            setDisplayedFacilities([]);
            setIsFiltering(false);
            return;
        }
        
        setIsFiltering(true);

        const timerId = setTimeout(() => {
            let filtered = [...healthFacilities].filter(f => f.isDeleted !== true && f.isDeleted !== "true");
            
            // 1. URL Filters
            if (currentFilters.facilityType) {
                filtered = filtered.filter(f => f['نوع_المؤسسةالصحية'] === currentFilters.facilityType);
            }
            if (currentFilters.functioning && currentFilters.functioning !== 'NOT_SET') {
                filtered = filtered.filter(f => f['هل_المؤسسة_تعمل'] === currentFilters.functioning);
            }

            // 2. UI Filter: State (Strict match)
            if (localStateFilter !== 'All' && localStateFilter !== '') {
                filtered = filtered.filter(f => f['الولاية'] === localStateFilter);
            } else if (localStateFilter === '') {
                filtered = [];
            }

            // 3. UI Filter: Locality
            if (localLocalityFilter && localLocalityFilter !== 'All') {
                filtered = filtered.filter(f => f['المحلية'] === localLocalityFilter);
            }
            
            // 4. System Filter: Facility Types based on Service Configuration
            if (config?.facilityTypes && filtered.length > 0) {
                filtered = filtered.filter(f => {
                    const type = updates[f.id]?.['نوع_المؤسسةالصحية'] ?? f['نوع_المؤسسةالصحية'];
                    return config.facilityTypes.includes(type);
                });
            }

            // 5. UI Filter: Text Search
            if (searchTerm && filtered.length > 0) {
                const term = searchTerm.toLowerCase();
                filtered = filtered.filter(f => (f['اسم_المؤسسة'] || '').toLowerCase().includes(term));
            }

            // 6. UI Filter: Ownership
            if (ownershipFilter && filtered.length > 0) {
                filtered = filtered.filter(f => {
                    const ownership = updates[f.id]?.facility_ownership ?? f.facility_ownership;
                    return ownership === ownershipFilter;
                });
            }

            // 7. UI Filter: Project
            if (localProjectFilter && localProjectFilter !== 'All' && filtered.length > 0) {
                filtered = filtered.filter(f => {
                    const proj = updates[f.id]?.project_name ?? f.project_name;
                    return proj === localProjectFilter;
                });
            }

            // 8. UI Filter: Service Type
            if (selectedServiceTypes.length > 0 && filtered.length > 0) {
                filtered = filtered.filter(f => {
                    const sType = updates[f.id]?.eenc_service_type ?? f.eenc_service_type;
                    return selectedServiceTypes.includes(sType);
                });
            }

            setDisplayedFacilities(filtered);
            setViewKpiData(calculateKPIs(filtered, updates, activeService));
            setIsFiltering(false);

        }, 0); 

        return () => clearTimeout(timerId);

    }, [healthFacilities, currentFilters.facilityType, currentFilters.functioning, config, searchTerm, ownershipFilter, updates, localStateFilter, localLocalityFilter, localProjectFilter, selectedServiceTypes, activeService]);


    const handleInputChange = (id, field, value) => {
        setUpdates(prev => {
            const facilityUpdates = { ...(prev[id] || {}) };
            facilityUpdates[field] = value;
            return { ...prev, [id]: facilityUpdates };
        });
    };

    const getFacilityStaff = (facility) => {
        const updatedStaff = updates[facility.id]?.imnci_staff;
        const originalStaff = facility.imnci_staff;
        let staffToLoad = [];
        if (updatedStaff) {
            staffToLoad = updatedStaff;
        } else if (Array.isArray(originalStaff)) {
            staffToLoad = originalStaff;
        } else if (typeof originalStaff === 'string') {
            try { staffToLoad = JSON.parse(originalStaff); } catch(e) {}
        }
        return staffToLoad;
    };

    const openStaffModal = (facility) => {
        setSelectedFacilityId(facility.id);
        setSelectedFacilityName(facility['اسم_المؤسسة']);
        setCurrentStaffList(getFacilityStaff(facility));
        setIsStaffModalOpen(true);
    };

    const handleSaveStaffList = (newStaffList) => {
        handleInputChange(selectedFacilityId, 'imnci_staff', newStaffList);
    };

    const toggleServiceType = (val) => {
        setSelectedServiceTypes(prev => 
            prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]
        );
    };

    const handleSaveAll = async () => {
        const changeCount = Object.keys(updates).length;
        if (changeCount === 0) return;
        try {
            setIsSaving(true);
            const submissionPromises = Object.entries(updates).map(([id, data]) => {
                const original = healthFacilities.find(f => f.id === id); 
                let cleanData = { ...data };
                
                const payload = { ...original, ...cleanData, date_of_visit: new Date().toISOString().split('T')[0] };
                
                if (payload.neonatal_level_of_care) {
                    delete payload.neonatal_level_of_care;
                }
                
                if (canApprove) {
                    return saveFacilitySnapshot(payload);
                } else {
                    return submitFacilityDataForApproval(payload, `Bulk Update (${activeService})`);
                }
            });
            await Promise.all(submissionPromises);
            setToast({ show: true, message: `Successfully ${canApprove ? 'saved' : 'submitted'} ${changeCount} updates.`, type: "success" });
            setUpdates({}); 
            
            // Refresh global cache after save
            fetchHealthFacilities({}, true);
        } catch (err) {
            console.error(err);
            setToast({ show: true, message: "Error submitting batch updates.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    // --- DYNAMIC ARABIC TITLE ---
    const stateAr = localStateFilter !== 'All' && localStateFilter !== ''
        ? (STATE_LOCALITIES[localStateFilter]?.ar || localStateFilter) 
        : 'كل الولايات';
        
    const localityAr = localLocalityFilter !== 'All' 
        ? (LOCALITY_EN_TO_AR_MAP[localLocalityFilter] || localLocalityFilter) 
        : (localStateFilter !== 'All' && localStateFilter !== '' ? 'كل المحليات' : '');

    let filterTitleParts = [];
    if (localProjectFilter !== 'All') filterTitleParts.push(`مشروع: ${localProjectFilter}`);
    if (currentFilters.facilityType) filterTitleParts.push(`نوع: ${currentFilters.facilityType}`);
    if (currentFilters.functioning && currentFilters.functioning !== 'NOT_SET') filterTitleParts.push(`حالة: ${currentFilters.functioning}`);
    if (selectedServiceTypes.length > 0) {
        const labels = selectedServiceTypes.map(val => SERVICE_TYPE_OPTIONS.find(o => o.value === val)?.label || val);
        filterTitleParts.push(`نوع الخدمة: ${labels.join('، ')}`);
    }

    const filterTitleStr = filterTitleParts.length > 0 ? ` (${filterTitleParts.join(' | ')})` : '';
    const arabicTitle = `${stateAr}${localityAr ? ` - ${localityAr}` : ''}${filterTitleStr}`;
    
    // Get localities for the currently selected UI State Filter
    const availableLocalities = localStateFilter !== 'All' && localStateFilter !== '' && STATE_LOCALITIES[localStateFilter] 
        ? STATE_LOCALITIES[localStateFilter].localities 
        : [];


    const handleExportPDF = async () => {
        const safeStateName = localStateFilter !== 'All' && localStateFilter !== '' ? localStateFilter : 'All_States';
        const fileName = `${activeService}_${safeStateName}.pdf`;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'bold'); 
        
        const groupedFacilities = displayedFacilities.reduce((acc, f) => {
            const locName = f['المحلية'] ? (LOCALITY_EN_TO_AR_MAP[f['المحلية']] || f['المحلية']) : 'غير محدد';
            const stateName = f['الولاية'] ? (STATE_LOCALITIES[f['الولاية']]?.ar || f['الولاية']) : 'غير محدد';
            const groupKey = `${stateName} - ${locName}`;
            
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(f);
            return acc;
        }, {});

        const localityKeys = Object.keys(groupedFacilities);

        localityKeys.forEach((locKey, index) => {
            if (index > 0) doc.addPage('landscape', 'a4');

            const pageTitle = `${locKey} - ${config.label}`;
            doc.setFont('Amiri', 'bold');
            doc.setFontSize(16);
            doc.text(pageTitle, 148.5, 15, { align: 'center' });

            const currentFacilities = groupedFacilities[locKey];
            const localKpi = calculateKPIs(currentFacilities, updates, activeService);
            
            let mainTableStartY = 25; 
            if (localKpi) {
                let kpiHeaders = [];
                let kpiBody = [];

                if (localKpi.type === 'IMNCI') {
                    kpiHeaders = [['ميزان وزن', 'ساعة مؤقت', 'غرفة إرواء', 'العلاج المتكامل', 'العدد الكلي']];
                    kpiBody = [[`${localKpi.scale} (${getPct(localKpi.scale, localKpi.imnciTotal)}%)`, `${localKpi.timer} (${getPct(localKpi.timer, localKpi.imnciTotal)}%)`, `${localKpi.ors} (${getPct(localKpi.ors, localKpi.imnciTotal)}%)`, `${localKpi.imnci} (${getPct(localKpi.imnci, localKpi.imnciTotal)}%)`, `${localKpi.total}`]];
                } else if (localKpi.type === 'EENC') {
                    kpiHeaders = [['الكوادر المدربة', 'محطات الإنعاش', 'أجهزة الإنعاش (Ambu)', 'تقدم الخدمة', 'العدد الكلي']];
                    kpiBody = [[`${localKpi.workers}`, `${localKpi.resuscitation}`, `${localKpi.ambu}`, `${localKpi.eenc} (${getPct(localKpi.eenc, localKpi.eencTotal)}%)`, `${localKpi.total}`]];
                } else if (localKpi.type === 'Neonatal') {
                    kpiHeaders = [['وحدة الكنغر (KMC)', 'عناية تخصصية (3)', 'عناية ثانوية (2)', 'عناية أولية (1)', 'العدد الكلي']];
                    kpiBody = [[`${localKpi.kmc} (${getPct(localKpi.kmc, localKpi.scnuTotal)}%)`, `${localKpi.tertiary} (${getPct(localKpi.tertiary, localKpi.scnuTotal)}%)`, `${localKpi.secondary} (${getPct(localKpi.secondary, localKpi.scnuTotal)}%)`, `${localKpi.primary} (${getPct(localKpi.primary, localKpi.scnuTotal)}%)`, `${localKpi.total}`]];
                } else if (localKpi.type === 'Critical') {
                    kpiHeaders = [['العناية المكثفة (PICU)', 'العناية الوسيطة (HDU)', 'فرز الحالات (ETAT)', 'العدد الكلي']];
                    kpiBody = [[`${localKpi.picu} (${getPct(localKpi.picu, localKpi.etatTotal)}%)`, `${localKpi.hdu} (${getPct(localKpi.hdu, localKpi.etatTotal)}%)`, `${localKpi.etat} (${getPct(localKpi.etat, localKpi.etatTotal)}%)`, `${localKpi.total}`]];
                } else {
                    kpiHeaders = [['تغطية الرعاية الحرجة', 'تغطية حديثي الولادة', 'تغطية EENC', 'تغطية IMNCI', 'العدد الكلي']];
                    kpiBody = [[`${localKpi.critical} (${getPct(localKpi.critical, localKpi.criticalTotal)}%)`, `${localKpi.scnu} (${getPct(localKpi.scnu, localKpi.scnuTotal)}%)`, `${localKpi.eenc} (${getPct(localKpi.eenc, localKpi.eencTotal)}%)`, `${localKpi.imnci} (${getPct(localKpi.imnci, localKpi.imnciTotal)}%)`, `${localKpi.total}`]];
                }

                autoTable(doc, {
                    head: kpiHeaders,
                    body: kpiBody,
                    startY: 20,
                    theme: 'plain',
                    styles: { fontSize: 10, font: 'Amiri', cellPadding: 2, halign: 'center', lineWidth: 0.1, lineColor: [200, 200, 200] },
                    headStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold' },
                });
                mainTableStartY = doc.lastAutoTable.finalY + 10;
            }

            doc.setFont('Amiri', 'normal');
            const pdfColumns = config.columns; 
            const tableHeaders = [[...pdfColumns.map(c => c.label).reverse(), 'النوع', 'اسم المؤسسة', '#']];
            
            const tableBody = currentFacilities.map((f, i) => {
                const dynamicVals = pdfColumns.map(col => {
                    if (col.type === 'staff_names' || col.type === 'staff_training' || col.type === 'staff_phones') {
                        const staffArr = getFacilityStaff(f);
                        if (!staffArr || staffArr.length === 0) return '-';
                        return staffArr.map(s => {
                            if (col.type === 'staff_names') return s.name || '-';
                            if (col.type === 'staff_training') return s.is_trained === 'Yes' ? 'نعم' : 'لا';
                            if (col.type === 'staff_phones') return s.phone || '-';
                            return '';
                        }).join('\n'); 
                    }
                    if (col.type === 'action_button') return ''; 
                    
                    let val = updates[f.id]?.[col.key];
                    if (val === undefined) {
                        if (col.key === 'neonatal_level_primary') val = f.neonatal_level_primary || (f.neonatal_level_of_care?.primary ? 'Yes' : 'No');
                        else if (col.key === 'neonatal_level_secondary') val = f.neonatal_level_secondary || (f.neonatal_level_of_care?.secondary ? 'Yes' : 'No');
                        else if (col.key === 'neonatal_level_tertiary') val = f.neonatal_level_tertiary || (f.neonatal_level_of_care?.tertiary ? 'Yes' : 'No');
                        else val = f[col.key];
                    }
                    
                    if (col.type === 'readonly' && col.key === 'eenc_service_type') {
                         if (val === 'CEmONC') return 'طواري شاملة';
                         if (val === 'BEmONC') return 'طواري أساسية';
                         if (val === 'pediatric') return 'مستشفى اطفال';
                         if (val === 'general') return 'خدمات عامة';
                         return val || '-';
                    }

                    if (val === true || val === 'Yes') return 'نعم';
                    if (val === false || val === 'No') return 'لا';
                    if (val === 'Planned') return 'مخططة';
                    return val || '';
                });
                
                const type = updates[f.id]?.[col.key] ?? f['نوع_المؤسسةالصحية'];
                return [...dynamicVals.reverse(), type || '', f['اسم_المؤسسة'] || '', (i + 1).toString()];
            });

            const columnStyles = {};
            const nameIndex = config.columns.findIndex(c => c.type === 'staff_names');
            if (nameIndex > -1) columnStyles[(config.columns.length - 1) - nameIndex] = { cellWidth: 35 }; 
            
            const trainIndex = config.columns.findIndex(c => c.type === 'staff_training');
            if (trainIndex > -1) columnStyles[(config.columns.length - 1) - trainIndex] = { cellWidth: 15 }; 

            const phoneIndex = config.columns.findIndex(c => c.type === 'staff_phones');
            if (phoneIndex > -1) columnStyles[(config.columns.length - 1) - phoneIndex] = { cellWidth: 25 }; 

            const typeColIndex = config.columns.length;
            columnStyles[typeColIndex] = { cellWidth: 25 }; 
            const nameColIndex = config.columns.length + 1;
            columnStyles[nameColIndex] = { cellWidth: 40 }; 

            autoTable(doc, {
                head: tableHeaders,
                body: tableBody,
                startY: mainTableStartY,
                theme: 'grid',
                styles: { fontSize: 8, font: 'Amiri', cellPadding: 2, halign: 'right', overflow: 'linebreak' },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'right' },
                columnStyles: columnStyles, 
                didParseCell: function (data) { 
                    data.cell.styles.halign = 'right'; 
                    if (data.section === 'body') {
                        const text = data.cell.text[0];
                        if (text === 'نعم') data.cell.styles.fillColor = [220, 252, 231]; 
                        if (text === 'لا') data.cell.styles.fillColor = [254, 226, 226]; 
                        if (text === 'مخططة') data.cell.styles.fillColor = [254, 240, 138]; 
                    }
                },
                didDrawCell: function (data) {
                    if (data.section === 'body' && data.cell.raw && typeof data.cell.raw === 'string') {
                         const configIndex = (config.columns.length - 1) - data.column.index;
                         if (configIndex >= 0 && configIndex < config.columns.length) {
                             const colType = config.columns[configIndex].type;
                             if (['staff_names', 'staff_training', 'staff_phones'].includes(colType)) {
                                 const lineCount = data.cell.raw.split('\n').length;
                                 if (lineCount > 1) {
                                     const cellHeight = data.cell.height;
                                     const lineHeight = cellHeight / lineCount;
                                     const x = data.cell.x;
                                     const w = data.cell.width;
                                     const startY = data.cell.y;
            
                                     const doc = data.doc;
                                     doc.saveGraphicsState();
                                     doc.setDrawColor(200, 200, 200); 
                                     doc.setLineWidth(0.1);
            
                                     for (let i = 1; i < lineCount; i++) {
                                         const y = startY + (lineHeight * i);
                                         doc.line(x, y, x + w, y);
                                     }
                                     doc.restoreGraphicsState();
                                 }
                             }
                         }
                    }
                }
            });
        });

        if (Capacitor.isNativePlatform()) {
            const base64Data = doc.output('datauristring').split('base64,')[1];
            const writeResult = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Downloads,
            });
            await FileOpener.open({ filePath: writeResult.uri, contentType: 'application/pdf' });
        } else {
            doc.save(fileName);
        }
    };

    // --- KPICard component Definition ---
    const KPICard = ({ label, value, colorClass = "bg-sky-50 text-sky-800" }) => (
        <div className={`p-4 rounded shadow-sm border ${colorClass} text-center flex flex-col justify-center items-center h-full`}>
            <span className="text-2xl font-bold mb-1" dir="ltr">{value}</span>
            <span className="text-xs font-medium opacity-90">{label}</span>
        </div>
    );

    // Render Dynamic KPI section
    const renderKPIs = () => {
        if (!viewKpiData || displayedFacilities.length === 0) return null;

        return (
            <div className="mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" dir="rtl">
                <KPICard 
                    label="العدد الكلي (المعروض)" 
                    value={viewKpiData.total} 
                    colorClass="bg-gray-100 text-gray-800 border-gray-200" 
                />
                
                {viewKpiData.type === 'IMNCI' && (
                    <>
                        <KPICard label="تغطية IMNCI (للمراكز)" value={`${viewKpiData.imnci} (${getPct(viewKpiData.imnci, viewKpiData.imnciTotal)}%)`} colorClass="bg-blue-50 text-blue-800 border-blue-200" />
                        <KPICard label="توفر غرفة إرواء" value={`${viewKpiData.ors} (${getPct(viewKpiData.ors, viewKpiData.imnciTotal)}%)`} colorClass="bg-green-50 text-green-800 border-green-200" />
                        <KPICard label="توفر ساعة مؤقت" value={`${viewKpiData.timer} (${getPct(viewKpiData.timer, viewKpiData.imnciTotal)}%)`} colorClass="bg-teal-50 text-teal-800 border-teal-200" />
                        <KPICard label="توفر ميزان وزن" value={`${viewKpiData.scale} (${getPct(viewKpiData.scale, viewKpiData.imnciTotal)}%)`} colorClass="bg-indigo-50 text-indigo-800 border-indigo-200" />
                    </>
                )}

                {viewKpiData.type === 'EENC' && (
                    <>
                        <KPICard label="تغطية EENC (للطوارئ)" value={`${viewKpiData.eenc} (${getPct(viewKpiData.eenc, viewKpiData.eencTotal)}%)`} colorClass="bg-teal-50 text-teal-800 border-teal-200" />
                        <KPICard label="محطات الإنعاش" value={viewKpiData.resuscitation} colorClass="bg-blue-50 text-blue-800 border-blue-200" />
                        <KPICard label="أجهزة الإنعاش (Ambu)" value={viewKpiData.ambu} colorClass="bg-indigo-50 text-indigo-800 border-indigo-200" />
                        <KPICard label="الكوادر المدربة" value={viewKpiData.workers} colorClass="bg-emerald-50 text-emerald-800 border-emerald-200" />
                    </>
                )}

                {viewKpiData.type === 'Neonatal' && (
                    <>
                        <KPICard label="عناية ثانوية (SCNU)" value={`${viewKpiData.scnu} (${getPct(viewKpiData.scnu, viewKpiData.scnuTotal)}%)`} colorClass="bg-blue-50 text-blue-800 border-blue-200" />
                        <KPICard label="عناية تخصصية (3)" value={`${viewKpiData.tertiary} (${getPct(viewKpiData.tertiary, viewKpiData.scnuTotal)}%)`} colorClass="bg-teal-50 text-teal-800 border-teal-200" />
                        <KPICard label="عناية أولية (1)" value={`${viewKpiData.primary} (${getPct(viewKpiData.primary, viewKpiData.scnuTotal)}%)`} colorClass="bg-indigo-50 text-indigo-800 border-indigo-200" />
                        <KPICard label="وحدة الكنغر (KMC)" value={`${viewKpiData.kmc} (${getPct(viewKpiData.kmc, viewKpiData.scnuTotal)}%)`} colorClass="bg-purple-50 text-purple-800 border-purple-200" />
                    </>
                )}

                {viewKpiData.type === 'Critical' && (
                    <>
                        <KPICard label="فرز الحالات (ETAT)" value={`${viewKpiData.etat} (${getPct(viewKpiData.etat, viewKpiData.etatTotal)}%)`} colorClass="bg-red-50 text-red-800 border-red-200" />
                        <KPICard label="العناية الوسيطة (HDU)" value={`${viewKpiData.hdu} (${getPct(viewKpiData.hdu, viewKpiData.etatTotal)}%)`} colorClass="bg-orange-50 text-orange-800 border-orange-200" />
                        <KPICard label="العناية المكثفة (PICU)" value={`${viewKpiData.picu} (${getPct(viewKpiData.picu, viewKpiData.etatTotal)}%)`} colorClass="bg-rose-50 text-rose-800 border-rose-200" />
                    </>
                )}

                {viewKpiData.type === 'General' && (
                    <>
                        <KPICard label="تغطية IMNCI" value={`${viewKpiData.imnci} (${getPct(viewKpiData.imnci, viewKpiData.imnciTotal)}%)`} colorClass="bg-blue-50 text-blue-800 border-blue-200" />
                        <KPICard label="تغطية EENC" value={`${viewKpiData.eenc} (${getPct(viewKpiData.eenc, viewKpiData.eencTotal)}%)`} colorClass="bg-teal-50 text-teal-800 border-teal-200" />
                        <KPICard label="تغطية حديثي الولادة" value={`${viewKpiData.scnu} (${getPct(viewKpiData.scnu, viewKpiData.scnuTotal)}%)`} colorClass="bg-indigo-50 text-indigo-800 border-indigo-200" />
                        <KPICard label="تغطية الرعاية الحرجة" value={`${viewKpiData.critical} (${getPct(viewKpiData.critical, viewKpiData.criticalTotal)}%)`} colorClass="bg-red-50 text-red-800 border-red-200" />
                    </>
                )}
            </div>
        );
    };

    // Apply Pagination logic based on displayedFacilities
    const paginatedFacilities = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return displayedFacilities.slice(startIndex, startIndex + itemsPerPage);
    }, [displayedFacilities, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(displayedFacilities.length / itemsPerPage);

    return (
        <Card>
            <div className="flex flex-col border-b pb-4 mb-4">
                <div className="text-center w-full mb-4">
                     <h1 className="text-2xl font-bold text-gray-800">{arabicTitle}</h1>
                </div>
                
                {renderKPIs()}

                <div className="p-4 bg-slate-50 border-b border-slate-200 rounded-lg flex flex-col gap-4" dir="rtl">
                    <div className="flex flex-wrap items-center gap-4 w-full">
                        
                        {/* Text Search */}
                        <div className="w-full md:w-48">
                            <Input 
                                placeholder="أدخل اسم المؤسسة..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="w-full" 
                            />
                        </div>
                        
                        {/* Ownership Filter */}
                        <div className="w-full md:w-40">
                            <Select 
                                value={ownershipFilter} 
                                onChange={(e) => setOwnershipFilter(e.target.value)} 
                                className="w-full"
                            >
                                <option value="">كل الملكيات</option>
                                {OWNERSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </Select>
                        </div>

                        {/* Client-side State Filter */}
                        <div className="w-full md:w-48">
                            <Select 
                                value={localStateFilter} 
                                onChange={(e) => {
                                    setLocalStateFilter(e.target.value);
                                    setLocalLocalityFilter('All');
                                }} 
                                className="bg-white border-gray-300 w-full"
                            >
                                <option value="All">كل الولايات</option>
                                {Object.keys(STATE_LOCALITIES).sort((a,b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => (
                                    <option key={s} value={s}>{STATE_LOCALITIES[s].ar} ({s})</option>
                                ))}
                            </Select>
                        </div>

                        {/* Client-side Locality Filter */}
                        {localStateFilter !== 'All' && localStateFilter !== '' && availableLocalities.length > 0 && (
                            <div className="w-full md:w-48">
                                <Select 
                                    value={localLocalityFilter} 
                                    onChange={(e) => setLocalLocalityFilter(e.target.value)} 
                                    className="bg-white border-gray-300 w-full"
                                >
                                    <option value="All">كل المحليات (All Localities)</option>
                                    {availableLocalities.map(loc => (
                                        <option key={loc.en} value={loc.en}>{loc.ar} ({loc.en})</option>
                                    ))}
                                </Select>
                            </div>
                        )}
                        
                        {/* Client-side Project Filter */}
                        <div className="w-full md:w-48">
                            <Select 
                                value={localProjectFilter} 
                                onChange={(e) => setLocalProjectFilter(e.target.value)} 
                                className="bg-white border-gray-300 w-full"
                            >
                                <option value="All">كل المشاريع (All Projects)</option>
                                {allProjectOptions.map(proj => (
                                    <option key={proj} value={proj}>{proj}</option>
                                ))}
                            </Select>
                        </div>
                    </div>
                    
                    {/* Multi-Select Filter for Service Types */}
                    <div className="w-full flex flex-wrap gap-2 items-center border-t border-slate-200 pt-3">
                        <span className="text-sm font-semibold text-slate-700 ml-2">تصفية بنوع الخدمة:</span>
                        {SERVICE_TYPE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => toggleServiceType(opt.value)}
                                className={`px-3 py-1 border rounded-full text-xs font-bold transition-colors ${
                                    selectedServiceTypes.includes(opt.value)
                                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                        {selectedServiceTypes.length > 0 && (
                            <button 
                                onClick={() => setSelectedServiceTypes([])} 
                                className="text-xs text-red-500 hover:underline mr-2 font-semibold"
                            >
                                مسح الخدمات
                            </button>
                        )}
                    </div>
                    
                    <div className="flex gap-2 w-full justify-end mt-2">
                        <Button onClick={handleExportPDF} variant="secondary" className="flex items-center gap-1" disabled={displayedFacilities.length === 0}>
                            <PdfIcon /> تحميل الملف
                        </Button>
                        <Button onClick={handleSaveAll} disabled={Object.keys(updates).length === 0 || isSaving} variant="primary">
                            {isSaving ? <Spinner size="sm" /> : `احفظ التغييرات (${Object.keys(updates).length})`}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="p-4 relative min-h-[300px]">
                {/* Minimal Loading Indicator (Top Right) so it doesn't block the UI */}
                {isFetchingData && (
                    <div className="absolute top-2 left-2 z-10 flex items-center bg-white/80 px-3 py-1 rounded shadow-sm border border-sky-100">
                        <Spinner size="sm" />
                        <span className="ml-2 text-xs font-bold text-sky-700">جاري المزامنة...</span>
                    </div>
                )}
                
                <div className="overflow-x-auto rounded-lg border border-slate-200" dir="rtl">
                    <table ref={tableRef} className="w-full table-fixed divide-y divide-gray-200 border-collapse bg-white">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-1 py-1 text-center text-xs font-bold text-slate-800 uppercase w-12 border border-slate-300">#</th>
                                <th className="px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase w-48 whitespace-normal break-words align-bottom border border-slate-300">اسم المؤسسة</th>
                                <th className="px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase w-28 whitespace-normal break-words align-bottom border border-slate-300">النوع</th>
                                {config.columns.map(col => (
                                    <th key={col.key} className={`px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase whitespace-normal break-words align-bottom border border-slate-300 ${col.type === 'staff_names' ? 'w-40' : ''}`}>{col.label}</th>
                                ))}
                                <th className="px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase w-16 whitespace-normal break-words align-bottom border border-slate-300">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedFacilities.length > 0 ? paginatedFacilities.map((f, index) => (
                                <tr key={f.id} className={updates[f.id] ? "bg-blue-50" : "hover:bg-gray-50"}>
                                    <td className="px-1 py-1 text-center text-xs text-gray-500 font-medium border border-slate-300 align-top">
                                        {(currentPage - 1) * itemsPerPage + index + 1}
                                    </td>
                                    <td className="px-1 py-1 text-xs font-medium text-right border border-slate-300 whitespace-normal break-words leading-tight">{f['اسم_المؤسسة']}</td>
                                    <td className="px-1 py-1 border border-slate-300 align-top">
                                        <div className="text-[10px] py-1 px-1 w-full bg-slate-100 text-slate-700 border border-slate-200 rounded-sm cursor-not-allowed text-right whitespace-normal break-words leading-tight min-h-[28px] flex items-center">
                                            {f['نوع_المؤسسةالصحية'] || '-'}
                                        </div>
                                    </td>
                                    {config.columns.map(col => {
                                        if (col.type === 'staff_names' || col.type === 'staff_training' || col.type === 'staff_phones') {
                                            const staffArr = getFacilityStaff(f);
                                            return (
                                                <td key={`${f.id}-${col.key}`} className="px-0 py-0 border border-slate-300 align-top relative group">
                                                    <button 
                                                        onClick={() => openStaffModal(f)} 
                                                        className="w-full h-full text-right p-1 min-h-[40px] hover:bg-sky-50 transition-colors flex flex-col items-start gap-0"
                                                    >
                                                        {staffArr.length > 0 ? (
                                                            <div className="flex flex-col w-full">
                                                                {staffArr.map((s, idx) => (
                                                                    <div key={idx} className="text-[10px] h-7 flex items-center whitespace-nowrap w-full border-b border-gray-200 last:border-0 overflow-hidden text-ellipsis px-1">
                                                                        {col.type === 'staff_names' && (s.name || '-')}
                                                                        {col.type === 'staff_training' && (s.is_trained === 'Yes' ? 'نعم' : (s.is_trained === 'Planned' ? 'مخططة' : 'لا'))}
                                                                        {col.type === 'staff_phones' && (s.phone || '-')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic text-[10px] p-1 block">-</span>
                                                        )}
                                                    </button>
                                                    {col.type === 'staff_names' && (
                                                        <div className="absolute top-1 left-1 pointer-events-none text-sky-600 opacity-50 group-hover:opacity-100">
                                                            <Edit size={14} />
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        }
                                        
                                        let val = updates[f.id]?.[col.key];
                                        if (val === undefined) {
                                            if (col.key === 'neonatal_level_primary') val = f.neonatal_level_primary || (f.neonatal_level_of_care?.primary ? 'Yes' : 'No');
                                            else if (col.key === 'neonatal_level_secondary') val = f.neonatal_level_secondary || (f.neonatal_level_of_care?.secondary ? 'Yes' : 'No');
                                            else if (col.key === 'neonatal_level_tertiary') val = f.neonatal_level_tertiary || (f.neonatal_level_of_care?.tertiary ? 'Yes' : 'No');
                                            else val = f[col.key];
                                        }
                                        
                                        if (col.type === 'readonly') {
                                            let displayVal = val;
                                            if (col.key === 'eenc_service_type') {
                                                 if (val === 'CEmONC') displayVal = 'طواري شاملة (CEmONC)';
                                                 else if (val === 'BEmONC') displayVal = 'طواري أساسية (BEmONC)';
                                                 else if (val === 'pediatric') displayVal = 'مستشفى اطفال';
                                                 else if (val === 'general') displayVal = 'خدمات عامة';
                                            }
                                            return (
                                                <td key={`${f.id}-${col.key}`} className="px-1 py-1 border border-slate-300 align-top">
                                                    <div className="text-[9px] py-1 px-1 h-7 w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-sm cursor-not-allowed flex items-center overflow-hidden text-ellipsis whitespace-nowrap" title={displayVal || '-'}>
                                                        {displayVal || '-'}
                                                    </div>
                                                </td>
                                            );
                                        }
                                        
                                        let selectColorClass = "text-gray-700";
                                        if (val === 'Yes' || val === true) selectColorClass = "bg-green-100 text-green-800 border-green-200 font-semibold";
                                        if (val === 'No' || val === false) selectColorClass = "bg-red-100 text-red-800 border-red-200 font-semibold";
                                        if (val === 'Planned') selectColorClass = "bg-yellow-100 text-yellow-800 border-yellow-200 font-semibold";
                                        
                                        return (
                                            <td key={`${f.id}-${col.key}`} className="px-1 py-1 border border-slate-300 align-top">
                                                {col.type === 'select' ? (
                                                    <Select value={val ?? ''} onChange={(e) => handleInputChange(f.id, col.key, e.target.value)} className={`text-[10px] py-0 px-1 h-7 w-full border rounded-sm focus:ring-1 focus:ring-sky-500 ${selectColorClass}`}>
                                                        <option value="">-</option>
                                                        {col.options.map(opt => (
                                                            <option key={opt} value={opt}>
                                                                {opt === 'Yes' ? 'نعم' : (opt === 'No' ? 'لا' : (opt === 'Planned' ? 'مخططة' : opt))}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                ) : (
                                                    <Input type={col.type} value={val ?? ''} onChange={(e) => handleInputChange(f.id, col.key, e.target.value)} className="text-[10px] py-0 px-1 h-7 w-full border border-gray-200 rounded-sm focus:ring-1 focus:ring-sky-500" />
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-1 py-1 text-center border border-slate-300">
                                        {updates[f.id] ? <span className="text-blue-600 text-[10px] font-bold whitespace-nowrap">تم التعديل</span> : <span className="text-slate-300 text-[10px]">-</span>}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={config.columns.length + 4} className="px-4 py-8 text-center text-gray-500 border border-slate-300">
                                        لا توجد مؤسسات مطابقة للبحث. (No facilities match these filters)
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* --- Added Pagination Controls --- */}
                {displayedFacilities.length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 p-4 bg-gray-50 rounded-b-lg border border-slate-200" dir="rtl">
                        <div className="flex items-center gap-4 mb-4 sm:mb-0">
                            <span className="text-sm text-gray-700">
                                الصفحة <strong>{currentPage}</strong> من <strong>{totalPages}</strong> (الإجمالي: {displayedFacilities.length} منشأة)
                            </span>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600">العدد بالصفحة:</label>
                                <Select 
                                    value={itemsPerPage} 
                                    onChange={(e) => { 
                                        setItemsPerPage(Number(e.target.value)); 
                                        setCurrentPage(1); 
                                    }} 
                                    className="w-20 bg-white border-gray-300 py-1"
                                >
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={500}>500</option>
                                </Select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                variant="secondary" 
                                onClick={() => setCurrentPage(p => p - 1)} 
                                disabled={currentPage === 1}
                            >
                                السابق
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => setCurrentPage(p => p + 1)} 
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                التالي
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <StaffManagementModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} facilityName={selectedFacilityName} initialStaff={currentStaffList} onSave={handleSaveStaffList} />
        </Card>
    );
};

export default LocalityBulkUpdateView;