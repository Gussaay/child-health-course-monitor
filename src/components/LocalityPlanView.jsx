// src/components/LocalityPlanView.jsx
import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from "jspdf";
import html2canvas from 'html2canvas';
import { amiriFontBase64 } from './AmiriFont.js'; 
import { Card, CardBody, Button, FormGroup, Select, EmptyState, PageHeader, Spinner } from './CommonComponents';
import { upsertMasterPlan, deleteMasterPlan } from '../data';
import { useDataCache } from '../DataContext';
import { Save, Plus, Edit, Trash2, X, ChevronDown, ChevronUp, Layers, BarChart2, PieChart, Activity, Users, Calendar, Download, FileText, Target } from 'lucide-react';
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

const generateTemplateInterventions = () => {
    return LOCALITY_TEMPLATE.map((item, idx) => ({
        id: `loc_inv_${Date.now()}_${idx}`,
        axis: item.axis,
        name: item.name,
        indicator: ACTIVITY_INDICATOR_MAP[item.name] || 'عدد',
        planned: '',
        baseline: '',
        target: '',
        totalCost: '',
        notes: ''
    }));
};

export default function LocalityPlanView({ permissions, userStates, userLocalities }) {
    const { masterPlans, fetchMasterPlans, isLoading } = useDataCache();
    
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
    }, [fetchMasterPlans]);

    const localityPlans = useMemo(() => {
        return (masterPlans || [])
            .filter(p => !p.isDeleted && p.level === 'locality')
            .filter(p => (p.year || CURRENT_YEAR) === globalFilter.year)
            .filter(p => !globalFilter.state || p.state === globalFilter.state) 
            .filter(p => !globalFilter.locality || p.locality === globalFilter.locality)
            .filter(p => !globalFilter.quarter || p.quarter === globalFilter.quarter) 
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [masterPlans, globalFilter]);

    const dashboardStats = useMemo(() => {
        let totalBudget = 0; let totalTarget = 0; let activeLocalities = new Set();
        localityPlans.forEach(plan => {
            if (plan.locality) activeLocalities.add(plan.locality);
            plan.interventions?.forEach(inv => {
                totalBudget += Number(inv.totalCost) || 0;
                totalTarget += Number(inv.target) || 0;
            });
        });
        return { plansCount: localityPlans.length, localitiesCount: activeLocalities.size, totalBudget, totalTarget };
    }, [localityPlans]);

    const aggregatedPlan = useMemo(() => {
        const map = {};
        localityPlans.forEach(plan => {
            plan.interventions?.forEach(inv => {
                const actualIndicator = ACTIVITY_INDICATOR_MAP[inv.name] || inv.indicator || 'عدد';
                const key = `${inv.axis}_${inv.name}`;
                if (!map[key]) {
                    map[key] = { axis: inv.axis, name: inv.name, indicator: actualIndicator, planned: 0, baseline: 0, target: 0, totalCost: 0 };
                }
                map[key].planned += Number(inv.planned) || 0;
                map[key].baseline += Number(inv.baseline) || 0;
                map[key].target += Number(inv.target) || 0;
                map[key].totalCost += Number(inv.totalCost) || 0;
            });
        });
        return Object.values(map);
    }, [localityPlans]);

    // حساب الـ KPIs بناءً على حقل "المُخطط" (النخطط)
    const dashboardIndicatorKpis = useMemo(() => {
        const counts = {};
        aggregatedPlan.forEach(inv => {
            if (!inv.indicator) return;
            if (!counts[inv.indicator]) counts[inv.indicator] = 0;
            counts[inv.indicator] += Number(inv.planned) || 0; // تم التغيير لجمع حقل "المخطط"
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .filter(kpi => kpi.count > 0)
            .sort((a, b) => b.count - a.count);
    }, [aggregatedPlan]);

    const exportDashboardPDF = async () => {
        setIsPdfGenerating(true);
        try {
            const doc = new jsPDF('landscape', 'mm', 'a4');
            doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
            doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
            doc.setFont('Amiri');
            
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 10;
            let currentY = 15;

            doc.setFontSize(20);
            doc.text(`تقرير التخطيط القاعدي المجمع`, pageWidth / 2, currentY, { align: 'center' });
            currentY += 10;

            doc.setFontSize(12);
            doc.setTextColor(100);
            const filterText = `السنة: ${globalFilter.year} | الولاية: ${globalFilter.state || 'الكل'} | المحلية: ${globalFilter.locality || 'الكل'} | الربع: ${globalFilter.quarter || 'الكل'}`;
            doc.text(filterText, pageWidth / 2, currentY, { align: 'center' });
            currentY += 10;

            const element = document.getElementById('locality-dashboard-export');
            if (element) {
                const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const imgWidth = pageWidth - (margin * 2);
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                doc.addImage(imgData, 'JPEG', margin, currentY, imgWidth, imgHeight);
            }

            const fileName = `Locality_Plan_${globalFilter.year}.pdf`;

            if (Capacitor.isNativePlatform()) {
                const base64Data = doc.output('datauristring').split('base64,')[1];
                const writeResult = await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Downloads });
                await FileOpener.open({ filePath: writeResult.uri, contentType: 'application/pdf' });
            } else {
                doc.save(fileName);
            }
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("حدث خطأ أثناء تصدير الـ PDF.");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const handleCreateNewMaster = () => {
        const assignedLocality = isLocalityManager ? (userLocalities?.[0] || '') : globalFilter.locality;
        if (!assignedLocality) {
            alert("الرجاء تحديد المحلية من الفلاتر أولاً للتمكن من إضافة خطة جديدة.");
            return;
        }

        setCurrentPlan({
            level: 'locality',
            year: globalFilter.year,
            quarter: globalFilter.quarter || QUARTERS_LIST[0], 
            state: globalFilter.state || (isFederalManager ? Object.keys(STATE_LOCALITIES)[0] : userStates[0]),
            locality: assignedLocality,
            expectedOutcome: 'خطة قاعدية (ربعية)',
            interventions: generateTemplateInterventions()
        });
        setIsEditing(true);
    };

    const handleSaveMaster = async (e) => {
        if (e) e.preventDefault();
        if (!currentPlan.state) return alert("الرجاء تحديد الولاية.");
        if (!currentPlan.locality) return alert("الرجاء تحديد المحلية.");
        if (!currentPlan.quarter) return alert("الرجاء تحديد الربع.");

        setIsSaving(true);
        try {
            const payloadToSave = {
                ...currentPlan,
                interventions: currentPlan.interventions.map(inv => ({
                    id: inv.id || `loc_inv_${Date.now()}_${Math.random()}`,
                    axis: inv.axis || '',
                    name: inv.name || '',
                    indicator: ACTIVITY_INDICATOR_MAP[inv.name] || inv.indicator || 'عدد',
                    planned: Number(inv.planned) || 0,
                    baseline: Number(inv.baseline) || 0,
                    target: Number(inv.target) || 0,
                    totalCost: Number(inv.totalCost) || 0,
                    notes: inv.notes || ''
                }))
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
        let cleanValue = value ? String(value) : '';
        if (['planned', 'baseline', 'target', 'totalCost'].includes(field)) {
            cleanValue = cleanValue.replace(/[^0-9]/g, '');
        }

        updated[idx][field] = cleanValue;
        
        if (field === 'planned' || field === 'baseline') {
            const pVal = Number(updated[idx].planned) || 0;
            const bVal = Number(updated[idx].baseline) || 0;
            updated[idx].target = (pVal + bVal).toString(); 
        }
        
        setCurrentPlan({ ...currentPlan, interventions: updated });
    };

    if (isLoading.masterPlans) return <Spinner />;

    const inputClass = "w-full h-full min-h-[48px] px-2 py-2 outline-none text-right text-xs sm:text-sm bg-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded transition-all";
    const numInputClass = "w-full h-full min-h-[48px] px-1 py-2 outline-none text-center font-bold text-sm sm:text-base bg-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded transition-all";

    if (isEditing && currentPlan) {
        return (
            <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col animate-in fade-in" dir="rtl">
                <div className="bg-white shadow px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-teal-200 shrink-0 gap-3">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2"><Calendar className="text-teal-600"/> إدخال الخطة القاعدية</h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">تعبئة مستهدفات وميزانيات الأنشطة للربع المختار.</p>
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
                    </div>

                    <div className="bg-white border shadow-sm w-full overflow-x-auto rounded-lg pb-10">
                        <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[1000px]">
                            <thead className="bg-teal-800 text-white font-bold">
                                <tr>
                                    <th className="p-3 border-l border-teal-700 w-[15%]">المحور</th>
                                    <th className="p-3 border-l border-teal-700 w-[30%]">النشاط (ثابت)</th>
                                    <th className="p-3 border-l border-teal-700 w-[15%]">المؤشر</th>
                                    <th className="p-3 border-l border-teal-700 text-center w-[8%] bg-teal-900">المُخطط</th>
                                    <th className="p-3 border-l border-teal-700 text-center w-[8%]">الابتدائي</th>
                                    <th className="p-3 border-l border-teal-700 text-center w-[8%] bg-indigo-900">المستهدف</th>
                                    <th className="p-3 border-l border-teal-700 text-center w-[8%]">التكلفة</th>
                                    <th className="p-3 border-l border-teal-700 text-center w-[12%]">ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {currentPlan.interventions?.map((inv, idx) => (
                                    <tr key={idx} className="hover:bg-teal-50 bg-white transition-colors">
                                        <td className="p-3 border border-gray-200 font-bold text-teal-800 bg-teal-50/30">{inv.axis}</td>
                                        <td className="p-3 border border-gray-200 text-gray-800 leading-relaxed">{inv.name}</td>
                                        <td className="p-3 border border-gray-200 text-teal-700 text-xs font-bold">{ACTIVITY_INDICATOR_MAP[inv.name] || inv.indicator}</td>
                                        
                                        <td className="p-0 border border-gray-200 bg-teal-50/10">
                                            <input 
                                                type="text" 
                                                inputMode="numeric" 
                                                pattern="[0-9]*" 
                                                className={numInputClass} 
                                                value={inv.planned ?? ''} 
                                                onChange={(e) => updateIntervention(idx, 'planned', e.target.value)} 
                                                placeholder="0" 
                                            />
                                        </td>
                                        <td className="p-0 border border-gray-200">
                                            <input 
                                                type="text" 
                                                inputMode="numeric" 
                                                pattern="[0-9]*" 
                                                className={numInputClass} 
                                                value={inv.baseline ?? ''} 
                                                onChange={(e) => updateIntervention(idx, 'baseline', e.target.value)} 
                                                placeholder="0" 
                                            />
                                        </td>
                                        
                                        <td className="p-0 border border-gray-200">
                                            <input 
                                                type="text" 
                                                inputMode="numeric" 
                                                pattern="[0-9]*" 
                                                className={`${numInputClass} text-indigo-700 bg-indigo-50/20`} 
                                                value={inv.target ?? ''} 
                                                onChange={(e) => updateIntervention(idx, 'target', e.target.value)} 
                                                placeholder="0" 
                                            />
                                        </td>
                                        
                                        <td className="p-0 border border-gray-200"><input type="text" inputMode="numeric" pattern="[0-9]*" className={`${numInputClass} bg-gray-50`} value={inv.totalCost ?? ''} onChange={(e) => updateIntervention(idx, 'totalCost', e.target.value)} placeholder="0" /></td>
                                        <td className="p-0 border border-gray-200"><textarea className={`${inputClass} resize-none`} rows={1} value={inv.notes || ''} onChange={(e) => updateIntervention(idx, 'notes', e.target.value)} placeholder="ملاحظات..." /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                    {[
                        { id: 'master', label: 'الخطة القاعدية', icon: Layers },
                        { id: 'dashboard', label: 'لوحة المؤشرات المجمعة', icon: BarChart2 }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-4 px-2 sm:px-1 border-b-2 font-bold text-sm sm:text-base flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <tab.icon size={20} /> {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* TAB: MASTER PLANS */}
            {activeTab === 'master' && (
                <div className="space-y-4 animate-in fade-in pt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2"><Activity className="text-teal-600"/> قائمة الخطط المرفوعة</h3>
                            {!canEditPlan && <p className="text-xs text-orange-600 font-bold mt-1">صلاحيات العرض فقط.</p>}
                        </div>
                        {canEditPlan && <Button onClick={handleCreateNewMaster} className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white border-0 py-3 sm:py-2 h-12 sm:h-auto"><Plus size={18} className="ml-2"/> إدخال خطة قاعدية ربعية جديدة</Button>}
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
                                    planKpis[actualIndicator] += Number(inv.planned) || 0; // جمع حقل المخطط للفردي
                                });
                                const planKpisArr = Object.entries(planKpis).map(([name, count]) => ({name, count})).filter(k => k.count > 0);

                                return (
                                    <div key={plan.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                        <div className="p-4 bg-teal-50 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-teal-100 border-b gap-4" onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                                <span className="px-3 py-1.5 rounded text-xs font-bold bg-teal-200 text-teal-800 w-fit">محلي - {plan.locality || 'غير محدد'} ({STATE_LOCALITIES[plan.state]?.ar || plan.state})</span>
                                                <span className="px-3 py-1.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 w-fit">{plan.quarter || 'ربع غير محدد'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                                <div className="flex gap-2">
                                                    {canEditPlan && (
                                                        <><Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setCurrentPlan(plan); setIsEditing(true); }} className="px-4 py-2"><Edit size={16}/></Button>
                                                        <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); if(window.confirm("حذف الخطة؟")) deleteMasterPlan(plan.id).then(()=>fetchMasterPlans(true)); }} className="px-4 py-2"><Trash2 size={16}/></Button></>
                                                    )}
                                                </div>
                                                {expandedPlanId === plan.id ? <ChevronUp size={24} className="text-gray-500"/> : <ChevronDown size={24} className="text-gray-500"/>}
                                            </div>
                                        </div>
                                        {expandedPlanId === plan.id && (
                                            <div className="p-2 sm:p-4">
                                                {planKpisArr.length > 0 && (
                                                    <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                                        <h5 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1"><Target size={14}/> ملخص مؤشرات المُخطط:</h5>
                                                        <div className="flex flex-wrap gap-2">
                                                            {planKpisArr.map((kpi, kIdx) => (
                                                                <span key={kIdx} className="bg-white border border-indigo-200 text-indigo-700 text-[10px] sm:text-xs font-bold px-2 py-1 rounded">
                                                                    {kpi.name}: <span className="text-gray-800 ml-1">{kpi.count.toLocaleString()}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[1000px]">
                                                        <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                                            <tr>
                                                                <th className="p-3 border-l border-slate-200 w-[15%]">المحور</th>
                                                                <th className="p-3 border-l border-slate-200 w-[30%]">النشاط</th>
                                                                <th className="p-3 border-l border-slate-200 w-[15%]">المؤشر</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[8%] text-indigo-700">المُخطط</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[8%]">الابتدائي</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[8%] bg-indigo-50">المستهدف</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[8%]">التكلفة</th>
                                                                <th className="p-3 border-l border-slate-200 text-center w-[12%]">ملاحظات</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {plan.interventions?.filter(inv => Number(inv.target) > 0 || Number(inv.baseline) > 0 || Number(inv.planned) > 0 || Number(inv.totalCost) > 0).map(inv => (
                                                                <tr key={inv.id} className="hover:bg-gray-50">
                                                                    <td className="p-3 border-l border-slate-200 text-gray-600 font-bold">{inv.axis}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-gray-800 leading-relaxed">{inv.name}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-teal-700 text-xs font-bold">{ACTIVITY_INDICATOR_MAP[inv.name] || inv.indicator}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-center font-bold text-indigo-600 bg-indigo-50/30 text-base">{inv.planned || 0}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-center font-bold text-gray-600 text-base">{inv.baseline || 0}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-center font-bold text-teal-600 bg-teal-50/20 text-base">{inv.target || 0}</td>
                                                                    <td className="p-3 border-l border-slate-200 text-center font-medium">{Number(inv.totalCost||0).toLocaleString()}</td>
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

            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in pt-4">
                    {dashboardIndicatorKpis.length > 0 && (
                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <Target className="text-teal-600" size={18} />
                                ملخص مؤشرات المُخطط (مجموع الخطط المعروضة)
                            </h4>
                            <div className="flex flex-wrap gap-3">
                                {dashboardIndicatorKpis.map((kpi, idx) => (
                                    <div key={idx} className="bg-teal-50 border border-teal-200 px-3 py-2 rounded-md flex items-center gap-2 shadow-sm">
                                        <span className="text-xs font-semibold text-teal-800">{kpi.name}:</span>
                                        <span className="text-sm font-bold text-indigo-700">{kpi.count.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                                <FileText className="text-teal-600"/> 
                                <h4 className="font-bold text-gray-800 text-sm sm:text-base">جدول التخطيط القاعدي المجمع بناءً على الفلاتر</h4>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Button size="sm" variant="primary" onClick={exportDashboardPDF} disabled={isPdfGenerating} className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 border-0 h-12 sm:h-auto">
                                    {isPdfGenerating ? <Spinner size="sm" className="ml-2" /> : <Download size={14} className="ml-1" />}
                                    {isPdfGenerating ? 'جاري التصدير...' : 'تصدير التقرير PDF'}
                                </Button>
                            </div>
                        </div>

                        <div id="locality-dashboard-export" className="overflow-x-auto w-full pb-4">
                            <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[1000px]">
                                <thead className="bg-slate-800 text-white">
                                    <tr>
                                        <th className="p-3 border-l border-slate-700 w-[15%]">المحور</th>
                                        <th className="p-3 border-l border-slate-700 w-[30%]">النشاط</th>
                                        <th className="p-3 border-l border-slate-700 w-[15%]">المؤشر</th>
                                        <th className="p-3 border-l border-slate-700 text-center w-[10%]">المُخطط الإجمالي</th>
                                        <th className="p-3 border-l border-slate-700 text-center w-[10%]">الابتدائي الإجمالي</th>
                                        <th className="p-3 border-l border-slate-700 text-center w-[10%] bg-indigo-900">المستهدف الكلي</th>
                                        <th className="p-3 border-l border-slate-700 text-center w-[10%]">التكلفة الإجمالية</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {aggregatedPlan.filter(r => r.target > 0 || r.baseline > 0 || r.planned > 0 || r.totalCost > 0).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-teal-50 transition-colors bg-white">
                                            <td className="p-3 border-l border-slate-200 font-bold text-teal-800 bg-teal-50/20">{row.axis}</td>
                                            <td className="p-3 border-l border-slate-200 text-gray-800 font-medium">{row.name}</td>
                                            <td className="p-3 border-l border-slate-200 text-teal-700 text-xs font-bold">{row.indicator}</td>
                                            <td className="p-3 border-l border-slate-200 text-center font-bold text-gray-700">{row.planned.toLocaleString()}</td>
                                            <td className="p-3 border-l border-slate-200 text-center font-bold text-gray-700">{row.baseline.toLocaleString()}</td>
                                            <td className="p-3 border-l border-slate-200 text-center font-bold text-teal-700 bg-teal-50/20 text-base">{row.target.toLocaleString()}</td>
                                            <td className="p-3 border-l border-slate-200 text-center font-bold text-orange-600">{row.totalCost.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {aggregatedPlan.filter(r => r.target > 0 || r.baseline > 0 || r.planned > 0 || r.totalCost > 0).length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="text-center p-8 text-gray-500 bg-white">لا توجد بيانات مجمعة لعرضها بناءً على الفلاتر الحالية.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}