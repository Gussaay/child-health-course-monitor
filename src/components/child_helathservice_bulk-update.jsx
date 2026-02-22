// child_helathservice_bulk-update.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

// --- ICONS ---
import { Plus, Trash2, Edit } from 'lucide-react';

// --- DATA & CONFIG ---
import { submitFacilityDataForApproval, listHealthFacilities } from "../data.js";
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

// --- HELPER: CALCULATE KPIS ---
const calculateKPIs = (facilities, updates, config) => {
    let targetFacilities = facilities;
    
    if (config.facilityTypes) {
         targetFacilities = facilities.filter(f => {
            const type = updates[f.id]?.['نوع_المؤسسةالصحية'] ?? f['نوع_المؤسسةالصحية'];
            return config.facilityTypes.some(t => t === type || type?.includes(t));
        });
    }
    const total = targetFacilities.length;
    if (total === 0) return null;

    const countYes = (key) => targetFacilities.filter(f => {
        const val = updates[f.id]?.[key] ?? f[key];
        return val === 'Yes' || val === true;
    }).length;

    const imnciCount = countYes('وجود_العلاج_المتكامل_لامراض_الطفولة');
    const orsCount = countYes('غرفة_إرواء');
    const timerCount = countYes('ساعة_مؤقت');
    const scaleCount = countYes('ميزان_وزن');

    return {
        total,
        imnciCount,
        imnciPercentage: Math.round((imnciCount / total) * 100),
        orsCount,
        orsPercentage: Math.round((orsCount / total) * 100),
        timerCount,
        timerPercentage: Math.round((timerCount / total) * 100),
        scaleCount,
        scalePercentage: Math.round((scaleCount / total) * 100),
    };
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
    const currentFilters = useMemo(() => {
        if (filters && Object.keys(filters).length > 0) return filters;
        return { state: stateParam, locality: localityParam };
    }, [filters, stateParam, localityParam]);

    const activeService = currentFilters.service || 'General';
    
    // States
    const [facilities, setFacilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updates, setUpdates] = useState({}); 
    
    // Search & Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [ownershipFilter, setOwnershipFilter] = useState(''); 
    
    // NEW: UI Filters to narrow down the fetched results
    const [localStateFilter, setLocalStateFilter] = useState(currentFilters.state && currentFilters.state !== 'ALL_STATES' ? currentFilters.state : 'All');
    const [localLocalityFilter, setLocalLocalityFilter] = useState(currentFilters.locality || 'All');
    
    const tableRef = useRef(null);
    
    // Staff Modal State
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [selectedFacilityId, setSelectedFacilityId] = useState(null);
    const [selectedFacilityName, setSelectedFacilityName] = useState('');
    const [currentStaffList, setCurrentStaffList] = useState([]);

    // --- CONFIG ---
    const BULK_VIEW_CONFIG = useMemo(() => ({
        'General': {
            label: 'بيانات عامة',
            facilityTypes: null, 
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'وجود_العلاج_المتكامل_لامراض_الطفولة', label: 'العلاج المتكامل', type: 'select', options: ['Yes', 'No'] },
                { key: 'eenc_provides_essential_care', label: 'رعاية حديثي الولادة', type: 'select', options: ['Yes', 'No'] },
                { key: 'neonatal_level_of_care_primary', label: 'الرعاية المبكرة', type: 'select', options: ['Yes', 'No'] }
            ]
        },
        'IMNCI': {
            label: 'العلاج المتكامل لأمراض الطفولة (IMNCI)',
            facilityTypes: ["مركز صحة الاسرة", "وحدة صحة الاسرة", "شفخانه", "Health Unit", "Family Health Center", "Primary Health Center"],
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'وجود_العلاج_المتكامل_لامراض_الطفولة', label: 'وجود العلاج المتكامل', type: 'select', options: ['Yes', 'No'] },
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
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'neonatal_level_of_care_primary', label: 'رعاية أولية', type: 'select', options: ['Yes', 'No'] },
                { key: 'neonatal_level_of_care_secondary', label: 'رعاية ثانوية', type: 'select', options: ['Yes', 'No'] },
                { key: 'neonatal_level_of_care_tertiary', label: 'رعاية تخصصية (NICU)', type: 'select', options: ['Yes', 'No'] },
                { key: 'neonatal_total_incubators', label: 'عدد الحضانَات', type: 'number' },
                { key: 'neonatal_kmc_unit', label: 'وحدة الكنغر (KMC)', type: 'select', options: ['Yes', 'No'] }
            ]
        },
        'EENC': {
            label: 'الرعاية المبكرة لحديثي الولادة (EENC)',
            facilityTypes: ["مستشفى", "مستشفى ريفي", "مستشفى تخصصي", "Hospital", "Rural Hospital"],
            columns: [
                { key: 'facility_ownership', label: 'ملكية المؤسسة', type: 'select', options: OWNERSHIP_OPTIONS },
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'eenc_provides_essential_care', label: 'تقدم خدمة EENC', type: 'select', options: ['Yes', 'No'] },
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
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'etat_has_service', label: 'فرز الحالات (ETAT)', type: 'select', options: ['Yes', 'No'] },
                { key: 'hdu_has_service', label: 'عناية وسيطة (HDU)', type: 'select', options: ['Yes', 'No'] },
                { key: 'picu_has_service', label: 'عناية مكثفة (PICU)', type: 'select', options: ['Yes', 'No'] },
                { key: 'etat_trained_workers', label: 'الكوادر المدربة', type: 'number' }
            ]
        }
    }), []);

    const filtersString = JSON.stringify(currentFilters);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setFacilities([]); 
            try {
                const fetchFilters = {
                    state: currentFilters.state,
                    locality: currentFilters.locality,
                    facilityType: currentFilters.facilityType,
                    functioningStatus: currentFilters.functioning,
                    project: currentFilters.project
                };
                
                const raw = await listHealthFacilities(fetchFilters);
                const data = raw.map(r => ({ ...r, locality: r['المحلية'] || 'Unknown' }));
                
                setFacilities(data);
            } catch (err) {
                console.error("Load Error:", err);
                setToast({ show: true, message: "Failed to load facilities data.", type: "error" });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [filtersString, setToast]);

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

    const handleSaveAll = async () => {
        const changeCount = Object.keys(updates).length;
        if (changeCount === 0) return;
        try {
            setLoading(true);
            const submissionPromises = Object.entries(updates).map(([id, data]) => {
                const original = facilities.find(f => f.id === id);
                let cleanData = { ...data };
                if (data.neonatal_level_of_care_primary || data.neonatal_level_of_care_secondary || data.neonatal_level_of_care_tertiary) {
                    const existingLevels = original.neonatal_level_of_care || {};
                    cleanData.neonatal_level_of_care = {
                        primary: data.neonatal_level_of_care_primary === 'Yes' ? true : (data.neonatal_level_of_care_primary === 'No' ? false : existingLevels.primary),
                        secondary: data.neonatal_level_of_care_secondary === 'Yes' ? true : (data.neonatal_level_of_care_secondary === 'No' ? false : existingLevels.secondary),
                        tertiary: data.neonatal_level_of_care_tertiary === 'Yes' ? true : (data.neonatal_level_of_care_tertiary === 'No' ? false : existingLevels.tertiary),
                    };
                    delete cleanData.neonatal_level_of_care_primary;
                    delete cleanData.neonatal_level_of_care_secondary;
                    delete cleanData.neonatal_level_of_care_tertiary;
                }
                const payload = { ...original, ...cleanData, date_of_visit: new Date().toISOString().split('T')[0] };
                return submitFacilityDataForApproval(payload, `Bulk Update (${activeService})`);
            });
            await Promise.all(submissionPromises);
            setToast({ show: true, message: `Successfully submitted ${changeCount} updates for approval.`, type: "success" });
            setUpdates({}); 
        } catch (err) {
            console.error(err);
            setToast({ show: true, message: "Error submitting batch updates.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const config = BULK_VIEW_CONFIG[activeService] || BULK_VIEW_CONFIG['General'];
    
    // --- DYNAMIC ARABIC TITLE ---
    const stateAr = currentFilters.state && currentFilters.state !== 'ALL_STATES' 
        ? (STATE_LOCALITIES[currentFilters.state]?.ar || currentFilters.state) 
        : 'كل الولايات';
        
    const localityAr = currentFilters.locality 
        ? (LOCALITY_EN_TO_AR_MAP[currentFilters.locality] || currentFilters.locality) 
        : (currentFilters.state && currentFilters.state !== 'ALL_STATES' ? 'كل المحليات' : '');

    let filterTitleParts = [];
    if (currentFilters.project) filterTitleParts.push(`مشروع: ${currentFilters.project}`);
    if (currentFilters.facilityType) filterTitleParts.push(`نوع: ${currentFilters.facilityType}`);
    if (currentFilters.functioning && currentFilters.functioning !== 'NOT_SET') filterTitleParts.push(`حالة: ${currentFilters.functioning}`);

    const filterTitleStr = filterTitleParts.length > 0 ? ` (${filterTitleParts.join(' | ')})` : '';
    const arabicTitle = `${stateAr}${localityAr ? ` - ${localityAr}` : ''}${filterTitleStr}`;
    
    // Get localities for the currently selected UI State Filter
    const availableLocalities = localStateFilter !== 'All' && STATE_LOCALITIES[localStateFilter] 
        ? STATE_LOCALITIES[localStateFilter].localities 
        : [];

    const displayedFacilities = useMemo(() => {
        let filtered = facilities;
        
        // 1. UI Filter: State
        if (localStateFilter !== 'All') {
            filtered = filtered.filter(f => f['الولاية'] === localStateFilter);
        }

        // 2. UI Filter: Locality
        if (localLocalityFilter !== 'All') {
            filtered = filtered.filter(f => f['المحلية'] === localLocalityFilter);
        }
        
        // 3. System Filter: Facility Types based on Service
        if (config.facilityTypes) {
            filtered = filtered.filter(f => {
                const type = updates[f.id]?.['نوع_المؤسسةالصحية'] ?? f['نوع_المؤسسةالصحية'];
                return config.facilityTypes.some(t => t === type || type?.includes(t));
            });
        }

        // 4. UI Filter: Text Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(f => f['اسم_المؤسسة']?.toLowerCase().includes(term));
        }

        // 5. UI Filter: Ownership
        if (ownershipFilter) {
            filtered = filtered.filter(f => {
                const ownership = updates[f.id]?.facility_ownership ?? f.facility_ownership;
                return ownership === ownershipFilter;
            });
        }

        return filtered;
    }, [facilities, config, searchTerm, ownershipFilter, updates, localStateFilter, localLocalityFilter]);

    const viewKpiData = useMemo(() => calculateKPIs(displayedFacilities, updates, config), [displayedFacilities, updates, config]);

    const handleExportPDF = async () => {
        const safeStateName = currentFilters.state || 'All_States';
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
            const localKpi = calculateKPIs(currentFacilities, updates, config);
            
            let mainTableStartY = 25; 
            if (localKpi) {
                const kpiHeaders = [['ميزان وزن', 'ساعة مؤقت', 'غرفة إرواء', 'العلاج المتكامل', 'العدد الكلي']];
                const kpiBody = [[
                    `${localKpi.scaleCount} (${localKpi.scalePercentage}%)`,
                    `${localKpi.timerCount} (${localKpi.timerPercentage}%)`,
                    `${localKpi.orsCount} (${localKpi.orsPercentage}%)`,
                    `${localKpi.imnciCount} (${localKpi.imnciPercentage}%)`,
                    `${localKpi.total}`
                ]];

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
                        if (col.key === 'neonatal_level_of_care_primary') val = f.neonatal_level_of_care?.primary ? 'Yes' : 'No';
                        else if (col.key === 'neonatal_level_of_care_secondary') val = f.neonatal_level_of_care?.secondary ? 'Yes' : 'No';
                        else if (col.key === 'neonatal_level_of_care_tertiary') val = f.neonatal_level_of_care?.tertiary ? 'Yes' : 'No';
                        else val = f[col.key];
                    }
                    if (val === true || val === 'Yes') return 'نعم';
                    if (val === false || val === 'No') return 'لا';
                    return val || '';
                });
                
                const type = updates[f.id]?.['نوع_المؤسسةالصحية'] ?? f['نوع_المؤسسةالصحية'];
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

    if (loading) return <div className="p-10 text-center"><Spinner /></div>;

    const KPICard = ({ label, value, colorClass = "bg-sky-50 text-sky-800" }) => (
        <div className={`p-4 rounded shadow-sm border ${colorClass} text-center flex flex-col justify-center items-center h-full`}>
            <span className="text-2xl font-bold mb-1" dir="ltr">{value}</span>
            <span className="text-xs font-medium opacity-90">{label}</span>
        </div>
    );

    return (
        <Card>
            <div className="flex flex-col border-b pb-4 mb-4">
                <div className="text-center w-full mb-4">
                     <h1 className="text-2xl font-bold text-gray-800">{arabicTitle}</h1>
                </div>
                
                {viewKpiData && (
                    <div className="mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" dir="rtl">
                        <KPICard 
                            label="العدد الكلي للمؤسسات" 
                            value={viewKpiData.total} 
                            colorClass="bg-gray-100 text-gray-800 border-gray-200" 
                        />
                        <KPICard 
                            label="توفر العلاج المتكامل" 
                            value={`${viewKpiData.imnciCount} (${viewKpiData.imnciPercentage}%)`} 
                            colorClass="bg-blue-50 text-blue-800 border-blue-200" 
                        />
                        <KPICard 
                            label="توفر غرفة إرواء" 
                            value={`${viewKpiData.orsCount} (${viewKpiData.orsPercentage}%)`} 
                            colorClass="bg-green-50 text-green-800 border-green-200" 
                        />
                        <KPICard 
                            label="توفر ساعة مؤقت" 
                            value={`${viewKpiData.timerCount} (${viewKpiData.timerPercentage}%)`} 
                            colorClass="bg-teal-50 text-teal-800 border-teal-200" 
                        />
                        <KPICard 
                            label="توفر ميزان وزن" 
                            value={`${viewKpiData.scaleCount} (${viewKpiData.scalePercentage}%)`} 
                            colorClass="bg-indigo-50 text-indigo-800 border-indigo-200" 
                        />
                    </div>
                )}

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

                        {/* NEW: Client-side State Filter */}
                        <div className="w-full md:w-48">
                            <Select 
                                value={localStateFilter} 
                                onChange={(e) => {
                                    setLocalStateFilter(e.target.value);
                                    setLocalLocalityFilter('All');
                                }} 
                                className="bg-white border-gray-300 w-full"
                            >
                                <option value="All">كل الولايات (All States)</option>
                                {Object.keys(STATE_LOCALITIES).sort((a,b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => (
                                    <option key={s} value={s}>{STATE_LOCALITIES[s].ar} ({s})</option>
                                ))}
                            </Select>
                        </div>

                        {/* NEW: Client-side Locality Filter (Shows only if State is selected) */}
                        {localStateFilter !== 'All' && availableLocalities.length > 0 && (
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

                    </div>
                    
                    <div className="flex gap-2 w-full justify-end mt-2">
                        <Button onClick={handleExportPDF} variant="secondary" className="flex items-center gap-1" disabled={displayedFacilities.length === 0}>
                            <PdfIcon /> تحميل الملف
                        </Button>
                        <Button onClick={handleSaveAll} disabled={Object.keys(updates).length === 0 || loading} variant="primary">
                            {loading ? <Spinner size="sm" /> : `احفظ التغييرات (${Object.keys(updates).length})`}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="p-4">
                <div className="overflow-x-auto rounded-lg border border-slate-200" dir="rtl">
                    <table ref={tableRef} className="w-full table-fixed divide-y divide-gray-200 border-collapse bg-white">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-1 py-1 text-center text-xs font-bold text-slate-800 uppercase w-12 border border-slate-300">#</th>
                                <th className="px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase w-48 whitespace-normal break-words align-bottom border border-slate-300">اسم المؤسسة</th>
                                <th className="px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase w-20 whitespace-normal break-words align-bottom border border-slate-300">النوع</th>
                                {config.columns.map(col => (
                                    <th key={col.key} className={`px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase whitespace-normal break-words align-bottom border border-slate-300 ${col.type === 'staff_names' ? 'w-40' : ''}`}>{col.label}</th>
                                ))}
                                <th className="px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase w-16 whitespace-normal break-words align-bottom border border-slate-300">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {displayedFacilities.length > 0 ? displayedFacilities.map((f, index) => (
                                <tr key={f.id} className={updates[f.id] ? "bg-blue-50" : "hover:bg-gray-50"}>
                                    <td className="px-1 py-1 text-center text-xs text-gray-500 font-medium border border-slate-300 align-top">{index + 1}</td>
                                    <td className="px-1 py-1 text-xs font-medium text-right border border-slate-300 whitespace-normal break-words leading-tight">{f['اسم_المؤسسة']}</td>
                                    <td className="px-1 py-1 border border-slate-300">
                                        <Select
                                            value={updates[f.id]?.['نوع_المؤسسةالصحية'] ?? f['نوع_المؤسسةالصحية'] ?? ''}
                                            onChange={(e) => handleInputChange(f.id, 'نوع_المؤسسةالصحية', e.target.value)}
                                            className="text-[10px] py-0 px-1 h-7 w-full border rounded-sm focus:ring-1 focus:ring-sky-500 text-gray-700"
                                        >
                                            <option value="">-</option>
                                            {FACILITY_TYPE_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </Select>
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
                                                                        {col.type === 'staff_training' && (s.is_trained === 'Yes' ? 'نعم' : 'لا')}
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
                                        
                                        // Standard cells
                                        let val = updates[f.id]?.[col.key];
                                        if (val === undefined) {
                                            if (col.key === 'neonatal_level_of_care_primary') val = f.neonatal_level_of_care?.primary ? 'Yes' : 'No';
                                            else if (col.key === 'neonatal_level_of_care_secondary') val = f.neonatal_level_of_care?.secondary ? 'Yes' : 'No';
                                            else if (col.key === 'neonatal_level_of_care_tertiary') val = f.neonatal_level_of_care?.tertiary ? 'Yes' : 'No';
                                            else val = f[col.key];
                                        }
                                        let selectColorClass = "text-gray-700";
                                        if (val === 'Yes' || val === true) selectColorClass = "bg-green-100 text-green-800 border-green-200 font-semibold";
                                        if (val === 'No' || val === false) selectColorClass = "bg-red-100 text-red-800 border-red-200 font-semibold";
                                        
                                        return (
                                            <td key={`${f.id}-${col.key}`} className="px-1 py-1 border border-slate-300 align-top">
                                                {col.type === 'select' ? (
                                                    <Select value={val ?? ''} onChange={(e) => handleInputChange(f.id, col.key, e.target.value)} className={`text-[10px] py-0 px-1 h-7 w-full border rounded-sm focus:ring-1 focus:ring-sky-500 ${selectColorClass}`}>
                                                        <option value="">-</option>
                                                        {col.options.map(opt => (
                                                            <option key={opt} value={opt}>
                                                                {opt === 'Yes' ? 'نعم' : (opt === 'No' ? 'لا' : opt)}
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
                                <tr><td colSpan={config.columns.length + 4} className="px-4 py-8 text-center text-gray-500 border border-slate-300">لا توجد مؤسسات مطابقة للبحث. (No facilities match these filters)</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <StaffManagementModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} facilityName={selectedFacilityName} initialStaff={currentStaffList} onSave={handleSaveStaffList} />
        </Card>
    );
};

export default LocalityBulkUpdateView;