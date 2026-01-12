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
import { submitFacilityDataForApproval, listFacilitiesByLocality } from "../data.js";
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

// --- HELPER: CALCULATE KPIS ---
const calculateKPIs = (facilities, updates, config) => {
    let targetFacilities = facilities;
    if (config.facilityTypes) {
         targetFacilities = facilities.filter(f => {
            const type = f['نوع_المؤسسةالصحية'];
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

// --- MAIN EXPORT: LOCALITY BULK UPDATE VIEW ---
const LocalityBulkUpdateView = ({ stateParam, localityParam, setToast }) => {
    const [activeLocality, setActiveLocality] = useState(localityParam);
    const [facilities, setFacilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updates, setUpdates] = useState({}); 
    const [searchTerm, setSearchTerm] = useState('');
    const tableRef = useRef(null);
    
    // Staff Modal State
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [selectedFacilityId, setSelectedFacilityId] = useState(null);
    const [selectedFacilityName, setSelectedFacilityName] = useState('');
    const [currentStaffList, setCurrentStaffList] = useState([]);

    const searchParams = new URLSearchParams(window.location.search);
    const initialService = searchParams.get('service') || 'General';
    const activeService = initialService;

    // --- CONFIG ---
    const BULK_VIEW_CONFIG = useMemo(() => ({
        'General': {
            label: 'بيانات عامة',
            facilityTypes: null, 
            columns: [
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
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'وجود_العلاج_المتكامل_لامراض_الطفولة', label: 'وجود العلاج المتكامل', type: 'select', options: ['Yes', 'No'] },
                { key: 'STAFF_MANAGEMENT_ACTION', label: 'الكوادر الصحية', type: 'action_button' },
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
                { key: 'هل_المؤسسة_تعمل', label: 'هل المؤسسة تعمل', type: 'select', options: ['Yes', 'No'] },
                { key: 'etat_has_service', label: 'فرز الحالات (ETAT)', type: 'select', options: ['Yes', 'No'] },
                { key: 'hdu_has_service', label: 'عناية وسيطة (HDU)', type: 'select', options: ['Yes', 'No'] },
                { key: 'picu_has_service', label: 'عناية مكثفة (PICU)', type: 'select', options: ['Yes', 'No'] },
                { key: 'etat_trained_workers', label: 'الكوادر المدربة', type: 'number' }
            ]
        }
    }), []);

    const stateLocalities = useMemo(() => STATE_LOCALITIES[stateParam]?.localities || [], [stateParam]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setFacilities([]); 
            try {
                let data = [];
                if (activeLocality === 'All') {
                    // Inject 'locality' into objects so we can group them later in PDF
                    const promises = stateLocalities.map(async loc => {
                        const raw = await listFacilitiesByLocality(stateParam, loc.en);
                        return raw.map(r => ({ ...r, locality: loc.en }));
                    });
                    const results = await Promise.all(promises);
                    data = results.flat();
                } else {
                    const raw = await listFacilitiesByLocality(stateParam, activeLocality);
                    data = raw.map(r => ({ ...r, locality: activeLocality }));
                }
                setFacilities(data);
            } catch (err) {
                console.error("Load Error:", err);
                setToast({ show: true, message: "Failed to load facilities data.", type: "error" });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [stateParam, activeLocality, setToast, stateLocalities]);

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
                return submitFacilityDataForApproval(payload, `Bulk Update: ${activeLocality} (${activeService})`);
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
    
    const stateAr = STATE_LOCALITIES[stateParam]?.ar || stateParam;
    const localityAr = activeLocality === 'All' ? 'كل الولاية' : (LOCALITY_EN_TO_AR_MAP[activeLocality] || activeLocality);
    const arabicTitle = `${stateAr} - ${localityAr} - معلومات العلاج المتكامل للاطفال اقل من 5 سنوات`;

    const displayedFacilities = useMemo(() => {
        let filtered = facilities;
        if (config.facilityTypes) {
            filtered = filtered.filter(f => {
                const type = f['نوع_المؤسسةالصحية'];
                return config.facilityTypes.some(t => t === type || type?.includes(t));
            });
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(f => f['اسم_المؤسسة']?.toLowerCase().includes(term));
        }
        return filtered;
    }, [facilities, config, searchTerm]);

    // Use Helper for View KPIs
    const viewKpiData = useMemo(() => calculateKPIs(displayedFacilities, updates, config), [displayedFacilities, updates, config]);

    const handleExportPDF = async () => {
        const fileName = `${activeService}_${stateParam}_${activeLocality}.pdf`;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'bold'); 
        
        // Group Facilities by Locality
        const groupedFacilities = displayedFacilities.reduce((acc, f) => {
            const loc = f.locality || 'Unknown';
            if (!acc[loc]) acc[loc] = [];
            acc[loc].push(f);
            return acc;
        }, {});

        const localityKeys = Object.keys(groupedFacilities);

        localityKeys.forEach((locKey, index) => {
            if (index > 0) doc.addPage('landscape', 'a4'); // New Page for subsequent localities

            // 1. Specific Locality Title
            const pageLocalityAr = LOCALITY_EN_TO_AR_MAP[locKey] || locKey;
            const pageTitle = `${stateAr} - ${pageLocalityAr} - معلومات العلاج المتكامل للاطفال اقل من 5 سنوات`;
            doc.setFont('Amiri', 'bold');
            doc.setFontSize(16);
            doc.text(pageTitle, 148.5, 15, { align: 'center' });

            // 2. Local KPIs
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

            // 3. Main Table for this locality
            doc.setFont('Amiri', 'normal');
            const pdfColumns = config.columns; 
            const tableHeaders = [[...pdfColumns.map(c => c.label).reverse(), 'النوع', 'اسم المؤسسة', '#']];
            
            const tableBody = currentFacilities.map((f, i) => {
                const dynamicVals = pdfColumns.map(col => {
                    if (col.type === 'staff_phones') {
                        const staffArr = getFacilityStaff(f);
                        const phones = staffArr.map(s => s.phone).filter(Boolean).join('، ');
                        return phones || '';
                    }
                    if (col.type === 'action_button') {
                        const staffArr = getFacilityStaff(f);
                        const names = staffArr.map(s => s.name).filter(Boolean).join('\n');
                        return names || '-';
                    }
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
                return [...dynamicVals.reverse(), f['نوع_المؤسسةالصحية'] || '', f['اسم_المؤسسة'] || '', (i + 1).toString()];
            });

            const columnStyles = {};
            const hwIndex = config.columns.findIndex(c => c.key === 'STAFF_MANAGEMENT_ACTION');
            if (hwIndex > -1) {
                const pdfHwIndex = (config.columns.length - 1) - hwIndex;
                columnStyles[pdfHwIndex] = { cellWidth: 30 }; 
            }
            const phoneIndex = config.columns.findIndex(c => c.key === 'STAFF_PHONES');
            if (phoneIndex > -1) {
                const pdfPhoneIndex = (config.columns.length - 1) - phoneIndex;
                columnStyles[pdfPhoneIndex] = { cellWidth: 25 }; 
            }
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

                <div className="p-4 bg-slate-50 border-b border-slate-200 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4" dir="rtl">
                    <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto flex-1">
                        <div className="w-full md:w-64">
                            <Input 
                                placeholder="أدخل اسم المؤسسة..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="w-full" 
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <label className="text-sm font-medium whitespace-nowrap text-gray-700">اختر المحلية:</label>
                            <Select 
                                value={activeLocality} 
                                onChange={(e) => setActiveLocality(e.target.value)} 
                                className="bg-white border-gray-300 w-full md:w-64"
                            >
                                <option value="All">كل الولاية (All State Facilities)</option>
                                {stateLocalities.map(loc => (
                                    <option key={loc.en} value={loc.en}>{loc.ar} ({loc.en})</option>
                                ))}
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto justify-end">
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
                                    <th key={col.key} className={`px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase whitespace-normal break-words align-bottom border border-slate-300 ${col.key === 'STAFF_MANAGEMENT_ACTION' ? 'w-40' : ''}`}>{col.label}</th>
                                ))}
                                <th className="px-1 py-1 text-right text-xs font-bold text-slate-800 uppercase w-16 whitespace-normal break-words align-bottom border border-slate-300">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {displayedFacilities.length > 0 ? displayedFacilities.map((f, index) => (
                                <tr key={f.id} className={updates[f.id] ? "bg-blue-50" : "hover:bg-gray-50"}>
                                    <td className="px-1 py-1 text-center text-xs text-gray-500 font-medium border border-slate-300 align-top">{index + 1}</td>
                                    <td className="px-1 py-1 text-xs font-medium text-right border border-slate-300 whitespace-normal break-words leading-tight">{f['اسم_المؤسسة']}</td>
                                    <td className="px-1 py-1 text-[10px] text-gray-500 text-right border border-slate-300 whitespace-normal break-words leading-tight">{f['نوع_المؤسسةالصحية']}</td>
                                    {config.columns.map(col => {
                                        if (col.type === 'action_button') {
                                            const staffArr = getFacilityStaff(f);
                                            return (
                                                <td key={`${f.id}-${col.key}`} className="px-0 py-0 border border-slate-300 align-top relative group">
                                                    <button 
                                                        onClick={() => openStaffModal(f)} 
                                                        className="w-full h-full text-right p-1 min-h-[40px] hover:bg-sky-50 transition-colors flex flex-col items-start gap-1"
                                                    >
                                                        <div className="w-full pr-5"> 
                                                            {staffArr.length > 0 ? (
                                                                <div className="flex flex-col w-full">
                                                                    {staffArr.map((s, idx) => (
                                                                        <div key={idx} className="text-[10px] whitespace-normal leading-tight w-full border-b border-gray-200 last:border-0 py-1">
                                                                            {s.name}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400 italic text-[10px]">لا يوجد</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                    <div className="absolute top-1 left-1 pointer-events-none text-sky-600 opacity-50 group-hover:opacity-100">
                                                        <Edit size={14} />
                                                    </div>
                                                </td>
                                            );
                                        }
                                        
                                        if (col.type === 'staff_phones') {
                                            const staffArr = getFacilityStaff(f);
                                            const phones = staffArr.map(s => s.phone).filter(Boolean).join('، ');
                                            return (
                                                <td key={`${f.id}-${col.key}`} className="px-1 py-1 text-right border border-slate-300 min-w-[100px]">
                                                    <span className="text-[10px] whitespace-normal leading-tight">{phones || '-'}</span>
                                                </td>
                                            );
                                        }

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
                                            <td key={`${f.id}-${col.key}`} className="px-1 py-1 border border-slate-300">
                                                {col.type === 'select' ? (
                                                    <Select value={val ?? ''} onChange={(e) => handleInputChange(f.id, col.key, e.target.value)} className={`text-[10px] py-0 px-1 h-7 w-full border rounded-sm focus:ring-1 focus:ring-sky-500 ${selectColorClass}`}>
                                                        <option value="">-</option>
                                                        {col.options.map(opt => <option key={opt} value={opt}>{opt === 'Yes' ? 'نعم' : 'لا'}</option>)}
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
                                <tr><td colSpan={config.columns.length + 4} className="px-4 py-8 text-center text-gray-500 border border-slate-300">لا توجد مؤسسات مطابقة للبحث في هذه المحلية.</td></tr>
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