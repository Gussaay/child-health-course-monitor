// src/components/LocalityPlanView.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import jsPDF from "jspdf";
import html2canvas from 'html2canvas';
import { amiriFontBase64 } from './AmiriFont.js'; 
import { Card, CardBody, Button, FormGroup, Select, EmptyState, PageHeader, Spinner } from './CommonComponents';
import { upsertMasterPlan, deleteMasterPlan } from '../data';
import { useDataCache } from '../DataContext';
import { Save, Plus, Edit, Trash2, X, ChevronDown, ChevronUp, Layers, BarChart2, PieChart, Activity, Users, Calendar, Download, FileText, Target, CheckSquare, Settings } from 'lucide-react';
import { STATE_LOCALITIES } from './constants';

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 2 + i);
const QUARTERS_LIST = ['الربع الاول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];

const ACTIVITY_INDICATOR_MAP = {
    'تنوير متخذي القرار ومدراء البرامج والشركاء بالمحليات على العلاج المتكامل للأطفال': 'عدد الكوادر',
    'تنفيذ اجتماعات مناصرة رسمية ومجتمعية لجلب الدعم لقضايا الاطفال': 'عدد الاجتماعات',
    'تدريب كادر على العلاج المتكامل للأطفال': 'عدد الكوادر',
    'تنفيذ زيارات بعد التدريب على الكوادر المدربة': 'عدد الزيارات',
    'تنفيذ ارشاد سريري على الكوادر المدربة': 'عدد جلسات الارشاد السريري',
    'تنفيذ عيادات جوالة للوصول للمناطق صعبة الوصول': 'عدد ايام العيادات',
    'تنفيذ زيارات تعزيز صحة الأطفال والمراهقين': 'عدد الزيارات',
    'توفير حزمة ادوية العلاج المتكامل': 'عدد حزم ادوية العلاج المتكامل',
    'توفير ميزان وزن': 'عدد موازين الوزن',
    'توفير ميزان طول': 'عدد موازين الطول',
    'توفير ميزان حرارة': 'عدد موازين الحرارة',
    'توفير مؤقت تنفس': 'عدد مواقيت التنفس',
    'توفير مواك': 'عدد المواك',
    'توفير كتيب لوحات': 'عدد كتيب اللوحات',
    'توفير سجل استمارات العلاج المتكامل + كرت الام': 'عدد سجل الاستمارات',
    'تنفيذ زيارة اشرافية شهرية': 'عدد زيارات الإشراف الداعم الروتينية',
    'تنفيذ اجتماع شهري مع الكوادر المطبقة': 'عدد الاجتماعات الشهرية'
};

const LOCALITY_TEMPLATE = [
    { axis: 'الحاكمية والتنسيق', name: 'تنوير متخذي القرار ومدراء البرامج والشركاء بالمحليات على العلاج المتكامل للأطفال' },
    { axis: 'الحاكمية والتنسيق', name: 'تنفيذ اجتماعات مناصرة رسمية ومجتمعية لجلب الدعم لقضايا الاطفال' },
    { axis: 'التدريب', name: 'تدريب كادر على العلاج المتكامل للأطفال' },
    { axis: 'التدريب', name: 'تنفيذ زيارات بعد التدريب على الكوادر المدربة' },
    { axis: 'التدريب', name: 'تنفيذ ارشاد سريري على الكوادر المدربة' },
    { axis: 'تقديم الخدمات', name: 'تنفيذ عيادات جوالة للوصول للمناطق صعبة الوصول' },
    { axis: 'تقديم الخدمات', name: 'تنفيذ زيارات تعزيز صحة الأطفال والمراهقين' },
    { axis: 'الامداد', name: 'توفير حزمة ادوية العلاج المتكامل' },
    { axis: 'الامداد', name: 'توفير ميزان وزن' },
    { axis: 'الامداد', name: 'توفير ميزان طول' },
    { axis: 'الامداد', name: 'توفير ميزان حرارة' },
    { axis: 'الامداد', name: 'توفير مؤقت تنفس' },
    { axis: 'الامداد', name: 'توفير مواك' },
    { axis: 'الامداد', name: 'توفير كتيب لوحات' },
    { axis: 'الامداد', name: 'توفير سجل استمارات العلاج المتكامل + كرت الام' },
    { axis: 'المعلومات', name: 'تنفيذ زيارة اشرافية شهرية' },
    { axis: 'المعلومات', name: 'تنفيذ اجتماع شهري مع الكوادر المطبقة' }
];

const TargetedFacilitiesSelect = ({ options, selectedIds, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleSelection = (id) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(x => x !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    if (!options || options.length === 0) {
        return <div className="text-[10px] text-gray-400 text-center py-2 bg-gray-50 border border-gray-200 rounded">مغطاة بالكامل / لا فجوة</div>;
    }

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`border rounded p-2 text-[11px] font-bold flex justify-between items-center cursor-pointer min-h-[48px] ${disabled ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white border-teal-300 text-teal-800 hover:bg-teal-50'}`}
            >
                <span className="truncate flex-1 text-right pl-2">
                    {selectedIds.length === 0 ? 'اختر المؤسسات المستهدفة...' : `تم تحديد (${selectedIds.length}) مؤسسة`}
                </span>
                <ChevronDown size={14} className="flex-shrink-0" />
            </div>
            
            {isOpen && !disabled && (
                <div className="absolute z-50 mt-1 w-64 bg-white border border-teal-200 rounded-lg shadow-xl max-h-48 overflow-y-auto right-0">
                    <div className="p-2 border-b border-gray-100 bg-teal-50 text-[10px] font-bold text-teal-800 flex justify-between">
                        <span>المؤسسات التي بها فجوة ({options.length})</span>
                        {selectedIds.length > 0 && (
                            <button onClick={() => onChange([])} className="text-red-500 hover:text-red-700 underline">مسح الكل</button>
                        )}
                    </div>
                    {options.map(opt => (
                        <label key={opt.id} className="flex items-center gap-3 p-2.5 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={selectedIds.includes(opt.id)}
                                onChange={() => toggleSelection(opt.id)}
                                className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                            />
                            <span className="text-xs text-gray-700 font-medium truncate flex-1 text-right">{opt.name}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function LocalityPlanView({ permissions, userStates, userLocalities }) {
    const { 
        masterPlans, fetchMasterPlans, 
        healthFacilities, fetchHealthFacilities,
        skillMentorshipSubmissions, fetchSkillMentorshipSubmissions,
        isLoading 
    } = useDataCache();
    
    const isLocalityManager = permissions?.role === 'locality_manager' || permissions?.manageScope === 'locality';
    const isSuperUser = permissions?.canUseSuperUserAdvancedFeatures;
    const canEditPlan = isLocalityManager || isSuperUser;
    const isFederalManager = permissions?.canUseFederalManagerAdvancedFeatures || permissions?.manageScope === 'federal';

    const [activeTab, setActiveTab] = useState('master'); 
    const [globalFilter, setGlobalFilter] = useState({
        year: CURRENT_YEAR,
        quarter: '', 
        state: isFederalManager ? '' : (userStates?.[0] || ''),
        locality: isLocalityManager ? (userLocalities?.[0] || '') : ''
    });

    useEffect(() => {
        if (isLocalityManager && userLocalities && userLocalities.length > 0) {
            setGlobalFilter(prev => {
                if (prev.locality !== userLocalities[0]) {
                    return { ...prev, locality: userLocalities[0] };
                }
                return prev;
            });
        }
    }, [isLocalityManager, userLocalities]);

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false); 
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [expandedPlanId, setExpandedPlanId] = useState(null);

    useEffect(() => {
        fetchMasterPlans();
        if (!healthFacilities) fetchHealthFacilities({}, false);
        if (!skillMentorshipSubmissions) fetchSkillMentorshipSubmissions(false);
    }, [fetchMasterPlans, fetchHealthFacilities, fetchSkillMentorshipSubmissions, healthFacilities, skillMentorshipSubmissions]);

    const currentTotalPhcs = useMemo(() => {
        const filteredLocFacs = (healthFacilities || []).filter(f => 
            (!globalFilter.state || f['الولاية'] === globalFilter.state) && 
            (!globalFilter.locality || f['المحلية'] === globalFilter.locality) && 
            f.isDeleted !== true && f.isDeleted !== "true" &&
            f['هل_المؤسسة_تعمل'] === 'Yes' && 
            (f['نوع_المؤسسةالصحية'] === 'مركز صحة الاسرة' || f['نوع_المؤسسةالصحية'] === 'وحدة صحة الاسرة')
        );
        return filteredLocFacs.length;
    }, [healthFacilities, globalFilter.state, globalFilter.locality]);

    const computeSystemBaseline = useCallback((invName, state, locality) => {
        if (!state || !locality || state === 'all' || locality === 'all') 
            return { text: '-', value: 0, gapFacilities: [], isFacilityBased: false, hasGapTargeting: false, totalPhcs: 0 };

        const locFacs = (healthFacilities || []).filter(f => 
            f['الولاية'] === state && f['المحلية'] === locality && f.isDeleted !== true && f.isDeleted !== "true"
        );
        
        const functioningPhcs = locFacs.filter(f => 
            f['هل_المؤسسة_تعمل'] === 'Yes' && 
            (f['نوع_المؤسسةالصحية'] === 'مركز صحة الاسرة' || f['نوع_المؤسسةالصحية'] === 'وحدة صحة الاسرة')
        );
        
        const totalPhcs = functioningPhcs.length;
        const countPhcField = (field) => functioningPhcs.filter(f => f[field] === 'Yes').length;
        const getGap = (field) => functioningPhcs.filter(f => f[field] !== 'Yes').map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }));
        const getAllPhcs = () => functioningPhcs.map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }));

        const baseObj = { totalPhcs, gapFacilities: [], isFacilityBased: false, hasGapTargeting: false };

        if (!invName) return { ...baseObj, text: 'غير معرف', value: 0, gapFacilities: [] };

        if (invName.includes('ميزان وزن')) {
            return { ...baseObj, text: `${countPhcField('ميزان_وزن')} من ${totalPhcs} رعاية اساسية`, value: countPhcField('ميزان_وزن'), gapFacilities: getGap('ميزان_وزن'), isFacilityBased: true, hasGapTargeting: true };
        } 
        else if (invName.includes('ميزان طول')) {
            return { ...baseObj, text: `${countPhcField('ميزان_طول')} من ${totalPhcs} رعاية اساسية`, value: countPhcField('ميزان_طول'), gapFacilities: getGap('ميزان_طول'), isFacilityBased: true, hasGapTargeting: true };
        } 
        else if (invName.includes('ميزان حرارة')) {
            return { ...baseObj, text: `${countPhcField('ميزان_حرارة')} من ${totalPhcs} رعاية اساسية`, value: countPhcField('ميزان_حرارة'), gapFacilities: getGap('ميزان_حرارة'), isFacilityBased: true, hasGapTargeting: true };
        } 
        else if (invName.includes('مؤقت تنفس')) {
            return { ...baseObj, text: `${countPhcField('ساعة_مؤقت')} من ${totalPhcs} رعاية اساسية`, value: countPhcField('ساعة_مؤقت'), gapFacilities: getGap('ساعة_مؤقت'), isFacilityBased: true, hasGapTargeting: true };
        } 
        else if (invName.includes('كتيب لوحات')) {
            return { ...baseObj, text: `${countPhcField('وجود_كتيب_لوحات')} من ${totalPhcs} رعاية اساسية`, value: countPhcField('وجود_كتيب_لوحات'), gapFacilities: getGap('وجود_كتيب_لوحات'), isFacilityBased: true, hasGapTargeting: true };
        } 
        else if (invName.includes('سجل استمارات')) {
            return { ...baseObj, text: `${countPhcField('وجود_سجل_علاج_متكامل')} من ${totalPhcs} رعاية اساسية`, value: countPhcField('وجود_سجل_علاج_متكامل'), gapFacilities: getGap('وجود_سجل_علاج_متكامل'), isFacilityBased: true, hasGapTargeting: true };
        } 
        else if (invName.includes('مواك')) {
            return { ...baseObj, text: 'لا يوجد معلومة في النظام', value: 0, gapFacilities: getAllPhcs() }; 
        } 
        else if (invName.includes('ادوية العلاج المتكامل') || invName.includes('أدوية العلاج المتكامل')) {
            return { ...baseObj, text: `يعتمد على السكان (لا يحسب بالمنشأة)`, value: 0, gapFacilities: [] };
        } 
        else if (invName.includes('تدريب كادر') || invName.includes('تدريب كوادر')) {
            const imnciCoveredPhcs = functioningPhcs.filter(f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes');
            return { 
                ...baseObj, 
                text: `${imnciCoveredPhcs.length} مؤسسة مطبقة`, 
                value: imnciCoveredPhcs.length,
                gapFacilities: functioningPhcs.filter(f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] !== 'Yes').map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }))
            };
        } 
        else if (invName.includes('ارشاد سريري') || invName.includes('أرشاد سريري')) {
            if (!skillMentorshipSubmissions) return { ...baseObj, text: 'جاري التحميل...', value: 0, gapFacilities: [] };
            const stateObj = STATE_LOCALITIES[state];
            const locAr = stateObj?.localities.find(l => l.en === locality)?.ar;
            
            const locMentorships = skillMentorshipSubmissions.filter(m =>
                (m.state === state || m.state === stateObj?.ar) &&
                (m.locality === locality || m.locality === locAr) &&
                m.serviceType === 'IMNCI' && m.status === 'complete' && 
                m.isDeleted !== true && m.isDeleted !== "true"
            );
            
            const uniqueVisits = new Set();
            locMentorships.forEach(m => {
                let dateStr = 'unk';
                if (m.sessionDate) dateStr = m.sessionDate;
                else if (m.effectiveDate && m.effectiveDate.seconds) dateStr = new Date(m.effectiveDate.seconds * 1000).toISOString().split('T')[0];
                else if (m.date) dateStr = m.date;
                uniqueVisits.add(`${m.facilityId || 'unk'}_${m.healthWorkerName || m.staff || 'unk'}_${dateStr}`);
            });

            return { ...baseObj, text: `${uniqueVisits.size} زيارة إرشاد`, value: uniqueVisits.size, gapFacilities: getAllPhcs() };
        } 
        else if (invName.includes('زيارة اشرافية شهرية')) {
            return { ...baseObj, text: 'لا يوجد معلومة في النظام', value: 0, gapFacilities: getAllPhcs() };
        } 
        else {
            return { ...baseObj, text: 'لا يوجد معلومة في النظام', value: 0, gapFacilities: [] };
        }
    }, [healthFacilities, skillMentorshipSubmissions]);

    const federalTemplates = useMemo(() => {
        return (masterPlans || [])
            .filter(p => !p.isDeleted && p.level === 'federal' && String(p.year || CURRENT_YEAR) === String(globalFilter.year))
            .filter(p => {
                if (!globalFilter.quarter) return true;
                const planQuarter = p.quarter?.trim() || QUARTERS_LIST[0]; 
                return planQuarter === globalFilter.quarter?.trim();
            })
            .sort((a, b) => {
                const timeA = a.createdAt?.seconds || a.lastUpdatedAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || b.lastUpdatedAt?.seconds || 0;
                return timeB - timeA;
            });
    }, [masterPlans, globalFilter.year, globalFilter.quarter]);

    const localityPlans = useMemo(() => {
        return (masterPlans || [])
            .filter(p => !p.isDeleted)
            .filter(p => p.level !== 'federal')
            .filter(p => {
                if (!globalFilter.year) return true;
                const planYear = p.year ? String(p.year) : String(CURRENT_YEAR);
                return planYear === String(globalFilter.year);
            })
            .filter(p => {
                if (!globalFilter.state) return true;
                return p.state?.trim() === globalFilter.state?.trim();
            })
            .filter(p => {
                if (!globalFilter.locality) return true;
                return p.locality?.trim() === globalFilter.locality?.trim();
            })
            .filter(p => {
                if (!globalFilter.quarter) return true;
                const planQuarter = p.quarter?.trim() || QUARTERS_LIST[0]; 
                return planQuarter === globalFilter.quarter?.trim();
            })
            .sort((a, b) => {
                const timeA = a.createdAt?.seconds || a.lastUpdatedAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || b.lastUpdatedAt?.seconds || 0;
                return timeB - timeA;
            });
    }, [masterPlans, globalFilter]);

    const dashboardStats = useMemo(() => {
        let totalBudget = 0; let totalTarget = 0; let activeLocalities = new Set();
        localityPlans.forEach(plan => {
            if (plan.locality) activeLocalities.add(plan.locality);
            plan.interventions?.forEach(inv => {
                const fedTemplate = federalTemplates.find(p => p.quarter === plan.quarter && String(p.year) === String(plan.year));
                const fedInv = fedTemplate?.interventions?.find(f => f.name === inv.name);
                const unitPrice = Number(inv.unitPrice || fedInv?.unitPrice || 0);
                const plannedVal = Number(inv.planned || 0);
                const computedCost = plannedVal * unitPrice; // FORCE CALCULATION
                
                totalBudget += computedCost;
                totalTarget += Number(inv.target) || 0;
            });
        });
        return { plansCount: localityPlans.length, localitiesCount: activeLocalities.size, totalBudget, totalTarget };
    }, [localityPlans, federalTemplates]);

    const aggregatedPlan = useMemo(() => {
        const map = {};
        localityPlans.forEach(plan => {
            plan.interventions?.forEach(inv => {
                const fedTemplate = federalTemplates.find(p => p.quarter === plan.quarter && String(p.year) === String(plan.year));
                const fedInv = fedTemplate?.interventions?.find(f => f.name === inv.name);
                const unitPrice = Number(inv.unitPrice || fedInv?.unitPrice || 0);
                const plannedVal = Number(inv.planned || 0);
                const computedCost = plannedVal * unitPrice; // FORCE CALCULATION

                const actualIndicator = ACTIVITY_INDICATOR_MAP[inv.name] || inv.indicator || 'عدد';
                const key = `${inv.axis}_${inv.name}`;
                if (!map[key]) {
                    map[key] = { axis: inv.axis, name: inv.name, indicator: actualIndicator, planned: 0, baseline: 0, target: 0, totalCost: 0 };
                }
                map[key].planned += plannedVal;
                map[key].baseline += Number(inv.baseline) || 0;
                map[key].target += Number(inv.target) || 0;
                map[key].totalCost += computedCost; // Add forced cost
            });
        });
        return Object.values(map);
    }, [localityPlans, federalTemplates]);

    const dashboardIndicatorKpis = useMemo(() => {
        const counts = {};
        aggregatedPlan.forEach(inv => {
            if (!inv.indicator) return;
            if (!counts[inv.indicator]) counts[inv.indicator] = 0;
            counts[inv.indicator] += Number(inv.planned) || 0; 
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .filter(kpi => kpi.count > 0)
            .sort((a, b) => b.count - a.count);
    }, [aggregatedPlan]);

    const visibleAggregatedRows = useMemo(() => {
        return aggregatedPlan.filter(r => 
            r.target > 0 || r.baseline > 0 || r.planned > 0 || r.totalCost > 0 || LOCALITY_TEMPLATE.some(t => t.name === r.name)
        );
    }, [aggregatedPlan]);

    const exportDashboardPDF = async () => {
        setIsPdfGenerating(true);
        try {
            const doc = new jsPDF('landscape', 'mm', 'a4');
            doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
            doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
            doc.setFont('Amiri');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 8; 
            let currentY = 12;

            doc.setFontSize(22);
            doc.text(`تقرير التخطيط القاعدي المجمع`, pageWidth / 2, currentY, { align: 'center' });
            currentY += 10;

            doc.setFontSize(13);
            doc.setTextColor(100);
            const filterText = `السنة: ${globalFilter.year} | الولاية: ${globalFilter.state || 'الكل'} | المحلية: ${globalFilter.locality || 'الكل'} | الربع: ${globalFilter.quarter || 'الكل'}`;
            doc.text(filterText, pageWidth / 2, currentY, { align: 'center' });
            currentY += 8; 

            const element = document.getElementById('locality-dashboard-export');
            if (element) {
                const style = document.createElement('style');
                style.innerHTML = `
                    #locality-dashboard-export { width: 1500px !important; max-width: 1500px !important; background-color: #ffffff !important; direction: rtl !important; }
                    #locality-dashboard-export .space-y-6 > * + * { margin-top: 0.75rem !important; }
                    #locality-dashboard-export .p-4 { padding: 0.75rem !important; }
                    #locality-dashboard-export table th { font-size: 15px !important; padding: 8px 6px !important; }
                    #locality-dashboard-export table td { font-size: 15px !important; padding: 8px 6px !important; line-height: 1.5 !important; }
                `;
                document.head.appendChild(style);
                await new Promise(resolve => setTimeout(resolve, 200));

                const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 1500 });
                document.head.removeChild(style);

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const maxImgWidth = pageWidth - (margin * 2);
                const maxImgHeight = pageHeight - currentY - margin;
                const bestRatio = Math.min(maxImgWidth / canvas.width, maxImgHeight / canvas.height); 
                
                doc.addImage(imgData, 'JPEG', margin + (maxImgWidth - (canvas.width * bestRatio)) / 2, currentY, canvas.width * bestRatio, canvas.height * bestRatio);
            }

            const fileName = `Locality_Plan_${globalFilter.year}.pdf`;
            if (Capacitor.isNativePlatform()) {
                const base64Data = doc.output('datauristring').split('base64,')[1];
                const writeResult = await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Downloads });
                await FileOpener.open({ filePath: writeResult.uri, contentType: 'application/pdf' });
            } else { doc.save(fileName); }
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("حدث خطأ أثناء تصدير الـ PDF.");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const handleCreateNewMaster = (asFederalTemplate = false) => {
        let selectedQuarter = globalFilter.quarter || QUARTERS_LIST[0];

        if (asFederalTemplate) {
            const existingFederalPlan = federalTemplates.find(p => p.quarter === selectedQuarter && String(p.year) === String(globalFilter.year));
            if (existingFederalPlan) {
                alert(`عفواً، يوجد قالب إتحادي مسجل بالفعل لـ ${selectedQuarter} لعام ${globalFilter.year}. الرجاء تعديله من القائمة بدلاً من إنشاء واحد جديد.`);
                return;
            }

            const quarterIndex = QUARTERS_LIST.indexOf(selectedQuarter);
            const prevQuarter = quarterIndex > 0 ? QUARTERS_LIST[quarterIndex - 1] : null;
            const prevFedTemplate = (masterPlans || []).find(p => !p.isDeleted && p.level === 'federal' && String(p.year) === String(globalFilter.year) && p.quarter === prevQuarter);
            
            let baseItems = prevFedTemplate && prevFedTemplate.interventions?.length > 0 ? prevFedTemplate.interventions : LOCALITY_TEMPLATE;

            setCurrentPlan({
                level: 'federal',
                year: globalFilter.year,
                quarter: selectedQuarter,
                state: 'all',
                locality: 'all',
                expectedOutcome: 'قالب خطة إتحادية',
                interventions: baseItems.map((item, idx) => ({
                    id: `fed_inv_${Date.now()}_${idx}`,
                    axis: item.axis || '', 
                    name: item.name || '', 
                    indicator: item.indicator || ACTIVITY_INDICATOR_MAP[item.name] || 'عدد',
                    planned: '', baseline: '0', target: '0', unitPrice: item.unitPrice || '', totalCost: '0', notes: '', targetedFacilities: [],
                    isCustom: false
                }))
            });
            setIsEditing(true);
            return;
        }

        const assignedLocality = isLocalityManager ? (userLocalities?.[0] || '') : globalFilter.locality;
        if (!assignedLocality) {
            alert("الرجاء تحديد المحلية من الفلاتر أولاً للتمكن من إضافة خطة جديدة.");
            return;
        }

        const stateToUse = globalFilter.state || (isFederalManager ? Object.keys(STATE_LOCALITIES)[0] : userStates[0]);

        const existingLocalityPlan = localityPlans.find(p => String(p.year) === String(globalFilter.year) && p.quarter === selectedQuarter && p.locality === assignedLocality && p.state === stateToUse);
        if (existingLocalityPlan) {
            alert(`عفواً، توجد خطة مسجلة بالفعل لـ ${selectedQuarter} لمحلية ${assignedLocality}. الرجاء تعديلها من القائمة بدلاً من إنشاء خطة جديدة.`);
            return;
        }

        const quarterIndex = QUARTERS_LIST.indexOf(selectedQuarter);
        const prevQuarter = quarterIndex > 0 ? QUARTERS_LIST[quarterIndex - 1] : null;

        const prevPlan = (masterPlans || []).find(p => 
            p.level !== 'federal' && 
            p.state === stateToUse && 
            p.locality === assignedLocality && 
            String(p.year || CURRENT_YEAR) === String(globalFilter.year) && 
            (p.quarter || QUARTERS_LIST[0]) === prevQuarter && 
            !p.isDeleted
        );
        
        const fedTemplate = (masterPlans || []).find(p => !p.isDeleted && p.level === 'federal' && String(p.year || CURRENT_YEAR) === String(globalFilter.year) && p.quarter === selectedQuarter);

        let baseItems = LOCALITY_TEMPLATE;
        if (prevPlan && prevPlan.interventions?.length > 0) {
            baseItems = prevPlan.interventions;
        } else if (fedTemplate && fedTemplate.interventions?.length > 0) {
            baseItems = fedTemplate.interventions;
        }

        const prefilledInterventions = baseItems.map((item, idx) => {
            const systemData = computeSystemBaseline(item.name, stateToUse, assignedLocality);
            const plannedVal = Number(item.planned || 0);
            
            // Try to pull unit price from federal template if missing
            const fedInv = fedTemplate?.interventions?.find(f => f.name === item.name);
            const unitPriceVal = Number(item.unitPrice || fedInv?.unitPrice || 0);

            return {
                id: `loc_inv_${Date.now()}_${idx}`,
                axis: item.axis || '',
                name: item.name || '',
                indicator: item.indicator || ACTIVITY_INDICATOR_MAP[item.name] || 'عدد',
                planned: item.planned || '', 
                baseline: systemData.value.toString(), 
                target: (plannedVal + systemData.value).toString(),
                unitPrice: unitPriceVal ? String(unitPriceVal) : '', 
                totalCost: String(plannedVal * unitPriceVal), // FORCE CALCULATION
                notes: item.notes || '',
                targetedFacilities: item.targetedFacilities || [],
                isCustom: item.isCustom || false 
            };
        });

        setCurrentPlan({
            level: 'locality',
            year: globalFilter.year,
            quarter: selectedQuarter, 
            state: stateToUse,
            locality: assignedLocality,
            expectedOutcome: 'خطة قاعدية (ربعية)',
            interventions: prefilledInterventions
        });
        setIsEditing(true);
    };

    const handleSaveMaster = async (e) => {
        if (e) e.preventDefault();
        if (currentPlan.level === 'locality' && !currentPlan.state) return alert("الرجاء تحديد الولاية.");
        if (currentPlan.level === 'locality' && !currentPlan.locality) return alert("الرجاء تحديد المحلية.");
        if (!currentPlan.quarter) return alert("الرجاء تحديد الربع.");

        setIsSaving(true);
        try {
            const payloadToSave = {
                ...currentPlan,
                interventions: currentPlan.interventions.map(inv => {
                    const pVal = Number(inv.planned || 0);
                    const uVal = Number(inv.unitPrice || 0);
                    return {
                        id: inv.id || `loc_inv_${Date.now()}_${Math.random()}`,
                        axis: inv.axis || '',
                        name: inv.name || '',
                        indicator: inv.indicator || ACTIVITY_INDICATOR_MAP[inv.name] || 'عدد',
                        planned: pVal,
                        baseline: Number(inv.baseline) || 0,
                        target: Number(inv.target) || 0,
                        unitPrice: uVal,
                        totalCost: pVal * uVal, // FORCE CALCULATION ON SAVE
                        notes: inv.notes || '',
                        targetedFacilities: inv.targetedFacilities || [],
                        isCustom: currentPlan.level === 'federal' ? false : !!inv.isCustom
                    }
                })
            };

            await upsertMasterPlan(payloadToSave);
            await fetchMasterPlans(true);
            setIsEditing(false);
        } catch (error) {
            console.error("Firebase Save Error:", error);
            alert("حدث خطأ أثناء الحفظ.\nالتفاصيل: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const updateIntervention = (idx, field, value) => {
        const updated = [...currentPlan.interventions];
        
        if (field === 'targetedFacilities') {
            updated[idx][field] = value;
        } else if (['planned', 'baseline', 'unitPrice'].includes(field)) {
            let cleanValue = value ? String(value).replace(/[^0-9]/g, '') : '';
            updated[idx][field] = cleanValue;
            
            const pVal = Number(updated[idx].planned) || 0;
            const bVal = Number(updated[idx].baseline) || 0;
            const uVal = Number(updated[idx].unitPrice) || 0;
            
            updated[idx].target = (pVal + bVal).toString(); 
            updated[idx].totalCost = (pVal * uVal).toString(); // FORCE CALCULATION ON EVERY EDIT
        } else {
            updated[idx][field] = value;
        }
        
        setCurrentPlan({ ...currentPlan, interventions: updated });
    };

    const addIntervention = () => {
        setCurrentPlan({
            ...currentPlan,
            interventions: [
                ...currentPlan.interventions,
                { id: `custom_inv_${Date.now()}`, axis: '', name: '', indicator: 'عدد', planned: '', baseline: '0', target: '0', unitPrice: '', totalCost: '0', notes: '', targetedFacilities: [], isCustom: true }
            ]
        });
    };

    const removeIntervention = (idx) => {
        const updated = [...currentPlan.interventions];
        updated.splice(idx, 1);
        setCurrentPlan({ ...currentPlan, interventions: updated });
    };

    if (isLoading.masterPlans) return <Spinner />;

    const inputClass = "w-full h-full min-h-[48px] px-2 py-2 outline-none text-right text-xs sm:text-sm bg-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded transition-all";
    const numInputClass = "w-full h-full min-h-[48px] px-1 py-2 outline-none text-center font-bold text-sm sm:text-base bg-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded transition-all";

    if (isEditing && currentPlan) {
        const isFederalPlan = currentPlan.level === 'federal';

        return (
            <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col animate-in fade-in" dir="rtl">
                <div className="bg-white shadow px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-teal-200 shrink-0 gap-3">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                            {isFederalPlan ? <Settings className="text-teal-600"/> : <Calendar className="text-teal-600"/>} 
                            {isFederalPlan ? 'إعداد قالب الخطة الإتحادية' : 'إدخال الخطة القاعدية'}
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                            {isFederalPlan ? 'تحديد الأنشطة الموحدة التي ستظهر للمحليات كقالب افتراضي.' : 'تعبئة مستهدفات وميزانيات الأنشطة للربع المختار.'}
                        </p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={isSaving} className="flex-1 sm:flex-none justify-center h-12">
                            <X size={18} className="ml-1"/> إغلاق
                        </Button>
                        <Button variant="primary" onClick={handleSaveMaster} disabled={isSaving} className="flex-1 sm:flex-none justify-center h-12">
                            {isSaving ? <Spinner size="sm" className="ml-2" /> : <Save size={18} className="ml-1"/>}
                            {isSaving ? 'جاري الحفظ...' : 'حفظ الخطة'}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 sm:p-4 relative">
                    <div className="bg-white rounded-lg shadow-sm border mb-4 p-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <FormGroup label="السنة">
                            <Select value={currentPlan.year} onChange={(e) => setCurrentPlan({...currentPlan, year: Number(e.target.value)})} disabled className="h-12 border-gray-300 bg-gray-50 text-gray-500">
                                {YEAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="الربع المستهدف (الفترة)">
                            <Select value={currentPlan.quarter} onChange={(e) => setCurrentPlan({...currentPlan, quarter: e.target.value})} className="h-12 border-teal-300 focus:ring-teal-500 font-bold text-teal-800">
                                {QUARTERS_LIST.map(q => <option key={q} value={q}>{q}</option>)}
                            </Select>
                        </FormGroup>
                        {!isFederalPlan && (
                            <>
                                <FormGroup label="الولاية">
                                    <div className="p-3 h-12 border rounded bg-gray-50 font-bold text-gray-600 border-gray-200 flex items-center">{STATE_LOCALITIES[currentPlan.state]?.ar || currentPlan.state}</div>
                                </FormGroup>
                                <FormGroup label="المحلية">
                                    {isLocalityManager ? (
                                        <div className="p-3 h-12 border rounded bg-gray-50 font-bold text-gray-600 border-gray-200 flex items-center">{currentPlan.locality}</div>
                                    ) : (
                                        <Select value={currentPlan.locality} onChange={(e) => setCurrentPlan({...currentPlan, locality: e.target.value})} className="h-12 border-teal-300">
                                            <option value="">-- اختر المحلية --</option>
                                            {(STATE_LOCALITIES[currentPlan.state]?.localities || []).map((loc, i) => {
                                                const locLabel = loc?.ar || loc?.en || loc;
                                                const locValue = loc?.en || loc?.ar || loc;
                                                return <option key={i} value={locValue}>{locLabel}</option>;
                                            })}
                                        </Select>
                                    )}
                                </FormGroup>
                            </>
                        )}
                    </div>

                    <div className="bg-white border shadow-sm w-full overflow-x-auto rounded-lg pb-4">
                        <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[1250px]">
                            <thead className="bg-teal-800 text-white font-bold">
                                <tr>
                                    <th className="p-3 border-l border-teal-700 w-[10%]">المحور</th>
                                    <th className="p-3 border-l border-teal-700 w-[20%]">النشاط</th>
                                    <th className="p-3 border-l border-teal-700 w-[8%]">المؤشر</th>
                                    
                                    {!isFederalPlan && <th className="p-3 border-l border-teal-700 text-center w-[10%] bg-amber-700 shadow-inner">أساس النظام</th>}
                                    {!isFederalPlan && <th className="p-3 border-l border-teal-700 text-center w-[6%]">الابتدائي</th>}
                                    {!isFederalPlan && <th className="p-3 border-l border-teal-700 text-center w-[6%] bg-teal-900">المُخطط</th>}
                                    
                                    {!isFederalPlan && <th className="p-3 border-l border-teal-700 text-center w-[12%] bg-sky-800">المؤسسات المستهدفة (الفجوة)</th>}
                                    {!isFederalPlan && <th className="p-3 border-l border-teal-700 text-center w-[8%] bg-indigo-900">التغطية النهائية بالمحلية</th>}
                                    
                                    <th className="p-3 border-l border-teal-700 text-center w-[8%]">{isFederalPlan ? 'سعر الوحدة الافتراضي (ج.س)' : 'سعر الوحدة (ج.س)'}</th>
                                    {!isFederalPlan && <th className="p-3 border-l border-teal-700 text-center w-[8%]">التكلفة (ج.س)</th>}
                                    <th className="p-3 border-l border-teal-700 text-center w-[10%]">ملاحظات</th>
                                    <th className="p-3 text-center w-[4%]">إجراء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {currentPlan.interventions?.map((inv, idx) => {
                                    const systemData = isFederalPlan ? {} : computeSystemBaseline(inv.name, currentPlan.state, currentPlan.locality);
                                    const isEditableDefinition = isFederalPlan || inv.isCustom;
                                    
                                    const targetVal = Number(inv.target) || 0;
                                    let targetDisplay = targetVal.toLocaleString('en-US');
                                    if (!isFederalPlan && systemData.isFacilityBased && systemData.totalPhcs > 0) {
                                        const percentage = Math.min(100, Math.round((targetVal / systemData.totalPhcs) * 100));
                                        targetDisplay = `${targetVal.toLocaleString('en-US')} (${percentage}%)`;
                                    }

                                    // Strictly compute cost to ensure display accuracy in edit mode
                                    const computedTotalCost = (Number(inv.planned) || 0) * (Number(inv.unitPrice) || 0);

                                    return (
                                        <tr key={idx} className="hover:bg-teal-50 bg-white transition-colors">
                                            <td className="p-0 border border-gray-200 bg-teal-50/30">
                                                {isEditableDefinition ? (
                                                    <input type="text" className={`${inputClass} font-bold text-teal-800`} value={inv.axis || ''} onChange={(e) => updateIntervention(idx, 'axis', e.target.value)} placeholder="اسم المحور" />
                                                ) : (
                                                    <div className="p-3 text-teal-800 font-bold text-xs sm:text-sm">{inv.axis}</div>
                                                )}
                                            </td>
                                            <td className="p-0 border border-gray-200">
                                                {isEditableDefinition ? (
                                                    <textarea className={`${inputClass} resize-none text-gray-800`} rows={2} value={inv.name || ''} onChange={(e) => updateIntervention(idx, 'name', e.target.value)} placeholder="تفاصيل النشاط" />
                                                ) : (
                                                    <div className="p-3 text-gray-800 text-xs sm:text-sm leading-relaxed">{inv.name}</div>
                                                )}
                                            </td>
                                            <td className="p-0 border border-gray-200">
                                                {isEditableDefinition ? (
                                                    <input type="text" className={`${inputClass} text-teal-700 font-bold text-xs`} value={inv.indicator || ''} onChange={(e) => updateIntervention(idx, 'indicator', e.target.value)} placeholder="مثال: عدد الكوادر" />
                                                ) : (
                                                    <div className="p-3 text-teal-700 font-bold text-xs">{ACTIVITY_INDICATOR_MAP[inv.name] || inv.indicator}</div>
                                                )}
                                            </td>
                                            
                                            {!isFederalPlan && (
                                                <>
                                                    <td className="p-3 border border-gray-200 text-amber-800 text-xs font-bold text-center bg-amber-50/50">{systemData.text}</td>
                                                    <td className="p-0 border border-gray-200">
                                                        <input type="text" className={numInputClass} value={inv.baseline ? Number(inv.baseline).toLocaleString('en-US') : ''} onChange={(e) => updateIntervention(idx, 'baseline', e.target.value)} placeholder="0" />
                                                    </td>
                                                    <td className="p-0 border border-gray-200 bg-teal-50/10">
                                                        <input type="text" className={numInputClass} value={inv.planned ? Number(inv.planned).toLocaleString('en-US') : ''} onChange={(e) => updateIntervention(idx, 'planned', e.target.value)} placeholder="0" />
                                                    </td>
                                                    <td className="p-2 border border-gray-200 bg-sky-50/20 align-top text-center">
                                                        {systemData.hasGapTargeting ? (
                                                            <TargetedFacilitiesSelect options={systemData.gapFacilities} selectedIds={inv.targetedFacilities || []} onChange={(newIds) => updateIntervention(idx, 'targetedFacilities', newIds)} />
                                                        ) : (
                                                            <div className="text-[11px] text-gray-400 py-2 bg-gray-50 border border-gray-200 rounded">لا ينطبق</div>
                                                        )}
                                                    </td>
                                                    <td className="p-0 border border-gray-200">
                                                        <input type="text" className={`${numInputClass} text-indigo-700 bg-indigo-50/20 cursor-not-allowed font-extrabold`} value={targetDisplay} readOnly placeholder="0" title="التغطية = المُخطط + الابتدائي"/>
                                                    </td>
                                                </>
                                            )}

                                            <td className="p-0 border border-gray-200">
                                                <input type="text" className={`${numInputClass} bg-gray-50 text-orange-700 font-bold`} value={inv.unitPrice ? Number(inv.unitPrice).toLocaleString('en-US') : ''} onChange={(e) => updateIntervention(idx, 'unitPrice', e.target.value)} placeholder="0" title="سعر الوحدة الافتراضي"/>
                                            </td>

                                            {!isFederalPlan && (
                                                <td className="p-0 border border-gray-200">
                                                    <input type="text" className={`${numInputClass} bg-indigo-50 text-indigo-800 font-bold cursor-not-allowed`} value={computedTotalCost > 0 ? computedTotalCost.toLocaleString('en-US') : ''} readOnly placeholder="0" title="يتم حسابه تلقائياً (المُخطط × سعر الوحدة)"/>
                                                </td>
                                            )}
                                            
                                            <td className="p-0 border border-gray-200"><textarea className={`${inputClass} resize-none`} rows={1} value={inv.notes || ''} onChange={(e) => updateIntervention(idx, 'notes', e.target.value)} placeholder="ملاحظات..." /></td>
                                            <td className="p-2 border border-gray-200 text-center">
                                                {isEditableDefinition ? (
                                                    <button onClick={() => removeIntervention(idx)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="حذف النشاط"><Trash2 size={18} /></button>
                                                ) : (
                                                    <span className="text-gray-300 select-none" title="نشاط أساسي لا يمكن حذفه">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-4 border-t border-gray-200">
                            <Button variant="secondary" onClick={addIntervention} className="w-full sm:w-auto border-dashed border-2 border-teal-300 text-teal-700 hover:bg-teal-50 justify-center">
                                <Plus size={18} className="ml-2" /> إضافة نشاط جديد
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in" dir="rtl">
            <PageHeader title="التخطيط القاعدي للمحليات" subtitle="إدارة الخطط الربعية وتطبيق العلاج المتكامل على مستوى المحليات" />

            <div className="bg-slate-800 p-4 rounded-lg shadow-md flex flex-col md:flex-row flex-wrap gap-4 items-start md:items-end text-white">
                <div className="w-full md:flex-1 md:min-w-[150px]">
                    <label className="block text-xs font-bold text-slate-300 mb-1">سنة الخطة</label>
                    <select className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-3 sm:p-2 outline-none h-12 sm:h-auto" value={globalFilter.year} onChange={e => setGlobalFilter({...globalFilter, year: Number(e.target.value)})}>
                        {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                
                <div className="w-full md:flex-1 md:min-w-[150px]">
                    <label className="block text-xs font-bold text-slate-300 mb-1">الربع (الفترة)</label>
                    <select className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-3 sm:p-2 outline-none text-sky-200 h-12 sm:h-auto" value={globalFilter.quarter} onChange={e => setGlobalFilter({...globalFilter, quarter: e.target.value})}>
                        <option value="">-- كل الأرباع (مجموع العام) --</option>
                        {QUARTERS_LIST.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                </div>

                <div className="w-full md:flex-1 md:min-w-[150px]">
                    <label className="block text-xs font-bold text-slate-300 mb-1">الولاية</label>
                    <select className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-3 sm:p-2 outline-none disabled:opacity-50 h-12 sm:h-auto" value={globalFilter.state} onChange={e => setGlobalFilter({...globalFilter, state: e.target.value, locality: ''})} disabled={!isFederalManager && userStates.length <= 1}>
                        <option value="">-- عرض كل الولايات --</option>
                        {isFederalManager ? Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar || s}</option>) : userStates.map(s => <option key={s} value={s}>{STATE_LOCALITIES[s]?.ar || s}</option>) }
                    </select>
                </div>

                {globalFilter.state && (
                    <div className="w-full md:flex-1 md:min-w-[150px]">
                        <label className="block text-xs font-bold text-slate-300 mb-1">المحلية</label>
                        <select 
                            className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-3 sm:p-2 outline-none disabled:opacity-50 h-12 sm:h-auto" 
                            value={globalFilter.locality} 
                            onChange={e => setGlobalFilter({...globalFilter, locality: e.target.value})} 
                            disabled={!globalFilter.state || isLocalityManager}
                        >
                            <option value="">-- عرض كل المحليات --</option>
                            {(STATE_LOCALITIES[globalFilter.state]?.localities || []).map((loc, i) => { const locLabel = loc?.ar || loc?.en || loc; const locValue = loc?.en || loc?.ar || loc; return <option key={i} value={locValue}>{locLabel}</option>; })}
                        </select>
                    </div>
                )}
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-4 sm:gap-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {isFederalManager && (
                        <button onClick={() => setActiveTab('federal')} className={`pb-4 px-2 sm:px-1 border-b-2 font-bold text-sm sm:text-base flex items-center gap-2 transition-colors ${activeTab === 'federal' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <Settings size={20} /> الخطة الإتحادية (Master Plan)
                        </button>
                    )}
                    <button onClick={() => setActiveTab('master')} className={`pb-4 px-2 sm:px-1 border-b-2 font-bold text-sm sm:text-base flex items-center gap-2 transition-colors ${activeTab === 'master' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <Layers size={20} /> الخطط القاعدية (للمحليات)
                    </button>
                    <button onClick={() => setActiveTab('dashboard')} className={`pb-4 px-2 sm:px-1 border-b-2 font-bold text-sm sm:text-base flex items-center gap-2 transition-colors ${activeTab === 'dashboard' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <BarChart2 size={20} /> لوحة المؤشرات المجمعة
                    </button>
                </nav>
            </div>

            {/* TAB: FEDERAL MASTER TEMPLATES (ONLY FOR FEDERAL MANAGER) */}
            {activeTab === 'federal' && isFederalManager && (
                <div className="space-y-4 animate-in fade-in pt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2"><Settings className="text-teal-600"/> قائمة القوالب الإتحادية</h3>
                            <p className="text-xs text-gray-500 font-medium mt-1">القوالب الإتحادية المخصصة لتكون أساساً لخطط المحليات.</p>
                        </div>
                        <Button onClick={() => handleCreateNewMaster(true)} className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white border-0 py-3 sm:py-2 h-12 sm:h-auto">
                            <Plus size={18} className="ml-2"/> إعداد قالب إتحادي جديد للربع
                        </Button>
                    </div>

                    {federalTemplates.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-lg p-8 flex flex-col items-center justify-center text-center">
                            <Settings className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">لا توجد قوالب إتحادية مسجلة لهذه الفلاتر حتى الآن.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {federalTemplates.map(plan => {
                                return (
                                    <div key={plan.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                        <div className="p-4 bg-teal-50 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-teal-100 border-b gap-4" onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                                <span className="px-3 py-1.5 rounded text-xs font-bold bg-teal-200 text-teal-800 w-fit">قالب إتحادي - عام</span>
                                                <span className="px-3 py-1.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 w-fit">{plan.quarter || 'غير محدد'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setCurrentPlan(plan); setIsEditing(true); }} className="px-4 py-2"><Edit size={16}/></Button>
                                                    <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); if(window.confirm("حذف القالب الإتحادي؟")) deleteMasterPlan(plan.id).then(()=>fetchMasterPlans(true)); }} className="px-4 py-2"><Trash2 size={16}/></Button>
                                                </div>
                                                {expandedPlanId === plan.id ? <ChevronUp size={24} className="text-gray-500"/> : <ChevronDown size={24} className="text-gray-500"/>}
                                            </div>
                                        </div>
                                        {expandedPlanId === plan.id && (
                                            <div className="p-2 sm:p-4">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[1000px]">
                                                        <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                                            <tr>
                                                                <th className="p-3 border-l border-slate-200 w-[15%]">المحور</th>
                                                                <th className="p-3 border-l border-slate-200 w-[40%]">النشاط</th>
                                                                <th className="p-3 border-l border-slate-200 w-[15%]">المؤشر</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[10%]">سعر الوحدة الافتراضي (ج.س)</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[20%]">ملاحظات</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {plan.interventions?.map(inv => (
                                                                <tr key={inv.id} className="hover:bg-gray-50">
                                                                    <td className="p-3 border-l border-slate-200 text-gray-600 font-bold">{inv.axis}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-gray-800 leading-relaxed">{inv.name}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-teal-700 text-xs font-bold">{inv.indicator}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-center font-bold text-orange-600">{Number(inv.unitPrice||0).toLocaleString('en-US')}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-xs text-gray-500 whitespace-normal">{inv.notes || '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: LOCALITY MASTER PLANS */}
            {activeTab === 'master' && (
                <div className="space-y-4 animate-in fade-in pt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2"><Activity className="text-teal-600"/> قائمة الخطط المرفوعة للمحليات</h3>
                            {!canEditPlan && <p className="text-xs text-orange-600 font-bold mt-1">صلاحيات العرض فقط.</p>}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            {canEditPlan && (
                                <Button onClick={() => handleCreateNewMaster(false)} className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white border-0 py-3 sm:py-2 h-12 sm:h-auto">
                                    <Plus size={18} className="ml-2"/> إدخال خطة قاعدية ربعية جديدة
                                </Button>
                            )}
                        </div>
                    </div>

                    {localityPlans.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-lg p-8 flex flex-col items-center justify-center text-center">
                            <Layers className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">لا توجد خطط قاعدية مسجلة لهذه الفلاتر حتى الآن.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {localityPlans.map(plan => {
                                const planKpis = {};
                                plan.interventions?.forEach(inv => {
                                    const actualIndicator = ACTIVITY_INDICATOR_MAP[inv.name] || inv.indicator || 'عدد';
                                    if (!planKpis[actualIndicator]) planKpis[actualIndicator] = 0;
                                    planKpis[actualIndicator] += Number(inv.planned) || 0; 
                                });
                                const planKpisArr = Object.entries(planKpis).map(([name, count]) => ({name, count})).filter(k => k.count > 0);

                                return (
                                    <div key={plan.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                        <div className="p-4 bg-teal-50 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-teal-100 border-b gap-4" onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                                <span className="px-3 py-1.5 rounded text-xs font-bold bg-teal-200 text-teal-800 w-fit">محلي - {plan.locality || 'غير محدد'} ({STATE_LOCALITIES[plan.state]?.ar || plan.state})</span>
                                                <span className="px-3 py-1.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 w-fit">{plan.quarter || 'الربع الأول'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                                <div className="flex gap-2">
                                                    {canEditPlan && (
                                                        <><Button size="sm" variant="secondary" onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            
                                                            const fedTemplate = federalTemplates.find(p => p.quarter === plan.quarter && String(p.year) === String(plan.year));
                                                            const fedInterventions = fedTemplate?.interventions || [];
                                                            
                                                            const syncedInterventions = plan.interventions?.map(inv => {
                                                                const fedInv = fedInterventions.find(f => f.name === inv.name);
                                                                const unitPrice = inv.unitPrice || fedInv?.unitPrice || 0;
                                                                const totalCost = Number(inv.planned || 0) * Number(unitPrice);
                                                                return { ...inv, unitPrice: String(unitPrice), totalCost: String(totalCost) };
                                                            });

                                                            setCurrentPlan({ ...plan, interventions: syncedInterventions }); 
                                                            setIsEditing(true); 
                                                        }} className="px-4 py-2"><Edit size={16}/></Button>
                                                        <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); if(window.confirm("حذف الخطة؟")) deleteMasterPlan(plan.id).then(()=>fetchMasterPlans(true)); }} className="px-4 py-2"><Trash2 size={16}/></Button></>
                                                    )}
                                                </div>
                                                {expandedPlanId === plan.id ? <ChevronUp size={24} className="text-gray-500"/> : <ChevronDown size={24} className="text-gray-500"/>}
                                            </div>
                                        </div>
                                        {expandedPlanId === plan.id && (
                                            <div className="p-2 sm:p-4">
                                                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                                    <h5 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1"><Target size={14}/> ملخص مؤشرات المُخطط:</h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="bg-white border border-orange-200 text-orange-700 text-[10px] sm:text-xs font-bold px-2 py-1 rounded">
                                                            إجمالي الميزانية (ج.س): <span className="text-gray-800 ml-1">
                                                                {plan.interventions?.reduce((sum, inv) => {
                                                                    const fedTemplate = federalTemplates.find(p => p.quarter === plan.quarter && String(p.year) === String(plan.year));
                                                                    const fedInv = fedTemplate?.interventions?.find(f => f.name === inv.name);
                                                                    const unitPrice = Number(inv.unitPrice || fedInv?.unitPrice || 0);
                                                                    const cost = Number(inv.planned || 0) * unitPrice;
                                                                    return sum + cost;
                                                                }, 0).toLocaleString('en-US') || '0'}
                                                            </span>
                                                        </span>
                                                        {planKpisArr.map((kpi, kIdx) => (
                                                            <span key={kIdx} className="bg-white border border-indigo-200 text-indigo-700 text-[10px] sm:text-xs font-bold px-2 py-1 rounded">
                                                                {kpi.name}: <span className="text-gray-800 ml-1">{kpi.count.toLocaleString('en-US')}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[1000px]">
                                                        <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                                            <tr>
                                                                <th className="p-3 border-l border-slate-200 w-[12%]">المحور</th>
                                                                <th className="p-3 border-l border-slate-200 w-[25%]">النشاط</th>
                                                                <th className="p-3 border-l border-slate-200 w-[10%]">المؤشر</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[8%] text-indigo-700">المُخطط</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[8%]">الابتدائي</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[8%] bg-indigo-50">التغطية النهائية</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[8%]">سعر الوحدة (ج.س)</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[8%]">التكلفة (ج.س)</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[13%]">ملاحظات</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {plan.interventions?.filter(inv => Number(inv.target) > 0 || Number(inv.baseline) > 0 || Number(inv.planned) > 0 || Number(inv.totalCost) > 0 || inv.name).map(inv => {
                                                                const isFacilityBasedIndicator = ['توفير ميزان وزن', 'توفير ميزان طول', 'توفير ميزان حرارة', 'توفير مؤقت تنفس', 'توفير كتيب لوحات', 'توفير سجل استمارات العلاج المتكامل + كرت الام'].includes(inv.name);
                                                                const targetValue = Number(inv.target) || 0;
                                                                const systemData = computeSystemBaseline(inv.name, plan.state, plan.locality);
                                                                
                                                                const targetDisplay = isFacilityBasedIndicator && systemData.totalPhcs > 0 
                                                                    ? `${targetValue.toLocaleString('en-US')} (${Math.min(100, Math.round((targetValue / systemData.totalPhcs) * 100))}%)`
                                                                    : targetValue.toLocaleString('en-US');

                                                                const fedTemplate = federalTemplates.find(p => p.quarter === plan.quarter && String(p.year) === String(plan.year));
                                                                const fedInv = fedTemplate?.interventions?.find(f => f.name === inv.name);
                                                                const displayUnitPrice = Number(inv.unitPrice || fedInv?.unitPrice || 0);
                                                                const displayTotalCost = Number(inv.planned || 0) * displayUnitPrice;

                                                                return (
                                                                    <tr key={inv.id} className="hover:bg-gray-50">
                                                                        <td className="p-3 border-l border-slate-200 text-gray-600 font-bold">{inv.axis}</td>
                                                                        <td className="p-3 border-l border-slate-200 text-gray-800 leading-relaxed">{inv.name}</td>
                                                                        <td className="p-3 border-l border-slate-200 text-teal-700 text-xs font-bold">{ACTIVITY_INDICATOR_MAP[inv.name] || inv.indicator}</td>
                                                                        <td className="p-3 border-l border-slate-200 text-center font-bold text-indigo-600 bg-indigo-50/30 text-base">{Number(inv.planned||0).toLocaleString('en-US')}</td>
                                                                        <td className="p-3 border-l border-slate-200 text-center font-bold text-gray-600 text-base">{Number(inv.baseline||0).toLocaleString('en-US')}</td>
                                                                        <td className="p-3 border-l border-slate-200 text-center font-bold text-teal-600 bg-teal-50/20 text-base">{targetDisplay}</td>
                                                                        <td className="p-3 border-l border-slate-200 text-center font-bold text-orange-600">{displayUnitPrice.toLocaleString('en-US')}</td>
                                                                        <td className="p-3 border-l border-slate-200 text-center font-bold text-indigo-800">{displayTotalCost.toLocaleString('en-US')}</td>
                                                                        <td className="p-3 border-l border-slate-200 text-xs text-gray-500 whitespace-normal">
                                                                            {inv.notes || '-'}
                                                                            {inv.targetedFacilities && inv.targetedFacilities.length > 0 && (
                                                                                <div className="mt-1 text-[10px] text-teal-600 font-semibold bg-teal-50 p-1 rounded">
                                                                                    <CheckSquare size={10} className="inline mr-1" /> المستهدف: {inv.targetedFacilities.length} مؤسسة
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in pt-4">
                    <div className="bg-white border rounded-lg shadow-sm p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <FileText className="text-teal-600"/> 
                            <h4 className="font-bold text-gray-800 text-sm sm:text-base">لوحة المؤشرات والتصدير</h4>
                        </div>
                        <Button size="sm" variant="primary" onClick={exportDashboardPDF} disabled={isPdfGenerating} className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 border-0 h-12 sm:h-auto">
                            {isPdfGenerating ? <Spinner size="sm" className="ml-2" /> : <Download size={14} className="ml-1" />}
                            {isPdfGenerating ? 'جاري التصدير...' : 'تصدير التقرير PDF'}
                        </Button>
                    </div>

                    <div id="locality-dashboard-export" className="space-y-6 bg-transparent pb-4">
                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <Target className="text-teal-600" size={18} /> ملخص مؤشرات المُخطط (مجموع الخطط المعروضة)
                            </h4>
                            <div className="flex flex-wrap gap-3">
                                <div className="bg-orange-50 border border-orange-200 px-3 py-2 rounded-md flex items-center gap-2 shadow-sm">
                                    <span className="text-xs font-semibold text-orange-800">إجمالي الميزانية (ج.س):</span>
                                    <span className="text-sm font-bold text-orange-700">{dashboardStats.totalBudget.toLocaleString('en-US')}</span>
                                </div>
                                {dashboardIndicatorKpis.map((kpi, idx) => (
                                    <div key={idx} className="bg-teal-50 border border-teal-200 px-3 py-2 rounded-md flex items-center gap-2 shadow-sm">
                                        <span className="text-xs font-semibold text-teal-800">{kpi.name}:</span>
                                        <span className="text-sm font-bold text-indigo-700">{kpi.count.toLocaleString('en-US')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                            <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
                                <BarChart2 className="text-teal-600"/> <h4 className="font-bold text-gray-800 text-sm sm:text-base">جدول التخطيط القاعدي المجمع بناءً على الفلاتر</h4>
                            </div>
                            <div className="overflow-x-auto w-full pb-4">
                                <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[1000px]">
                                    <thead className="bg-slate-800 text-white">
                                        <tr>
                                            <th className="p-3 border-l border-slate-700 w-[15%]">المحور</th>
                                            <th className="p-3 border-l border-slate-700 w-[30%]">النشاط</th>
                                            <th className="p-3 border-l border-slate-700 w-[15%]">المؤشر</th>
                                            <th className="p-3 border-l border-slate-700 text-center w-[10%]">الابتدائي الإجمالي</th>
                                            <th className="p-3 border-l border-slate-700 text-center w-[10%]">المُخطط الإجمالي</th>
                                            <th className="p-3 border-l border-slate-700 text-center w-[10%] bg-indigo-900">التغطية النهائية بالمحلية</th>
                                            <th className="p-3 border-l border-slate-700 text-center w-[10%]">التكلفة الإجمالية (ج.س)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {visibleAggregatedRows.map((row, idx) => {
                                            const isFacilityBasedIndicator = ['توفير ميزان وزن', 'توفير ميزان طول', 'توفير ميزان حرارة', 'توفير مؤقت تنفس', 'توفير كتيب لوحات', 'توفير سجل استمارات العلاج المتكامل + كرت الام'].includes(row.name);
                                            const targetValue = Number(row.target) || 0;
                                            const targetDisplay = isFacilityBasedIndicator && currentTotalPhcs > 0 
                                                ? `${targetValue.toLocaleString('en-US')} (${Math.min(100, Math.round((targetValue / currentTotalPhcs) * 100))}%)`
                                                : targetValue.toLocaleString('en-US');

                                            return (
                                                <tr key={idx} className="hover:bg-teal-50 transition-colors bg-white">
                                                    <td className="p-3 border-l border-slate-200 font-bold text-teal-800 bg-teal-50/20">{row.axis}</td>
                                                    <td className="p-3 border-l border-slate-200 text-gray-800 font-medium">{row.name}</td>
                                                    <td className="p-3 border-l border-slate-200 text-teal-700 text-xs font-bold">{row.indicator}</td>
                                                    <td className="p-3 border-l border-slate-200 text-center font-bold text-gray-700">{row.baseline.toLocaleString('en-US')}</td>
                                                    <td className="p-3 border-l border-slate-200 text-center font-bold text-gray-700">{row.planned.toLocaleString('en-US')}</td>
                                                    <td className="p-3 border-l border-slate-200 text-center font-bold text-teal-700 bg-teal-50/20 text-base">{targetDisplay}</td>
                                                    <td className="p-3 border-l border-slate-200 text-center font-bold text-orange-600">{row.totalCost.toLocaleString('en-US')}</td>
                                                </tr>
                                            );
                                        })}
                                        {visibleAggregatedRows.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="text-center p-8 text-gray-500 bg-white">لا توجد بيانات مجمعة لعرضها بناءً على الفلاتر الحالية.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}