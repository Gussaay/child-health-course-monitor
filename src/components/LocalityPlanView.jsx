// src/components/LocalityPlanView.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardBody, Button, FormGroup, Select, PageHeader, Spinner } from './CommonComponents';
import { upsertMasterPlan } from '../data';
import { useDataCache } from '../DataContext';
import { Save, Plus, Edit, Trash2, X, ChevronDown, ChevronUp, Layers, BarChart2, PieChart, Users, Calendar, AlertCircle } from 'lucide-react';
import { STATE_LOCALITIES } from './constants';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 2 + i);
const QUARTERS_LIST = ['الربع الاول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];

// القالب الثابت للأنشطة القاعدية
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
        indicator: 'عدد', 
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
    const [currentPlan, setCurrentPlan] = useState(null);
    const [expandedPlanId, setExpandedPlanId] = useState(null);

    useEffect(() => {
        fetchMasterPlans();
    }, [fetchMasterPlans]);

    const localityPlans = useMemo(() => {
        return (masterPlans || [])
            .filter(p => !p.isDeleted && p.level === 'locality')
            .filter(p => (p.year || CURRENT_YEAR) === globalFilter.year)
            .filter(p => isFederalManager || !globalFilter.state || p.state === globalFilter.state)
            .filter(p => !globalFilter.locality || p.locality === globalFilter.locality)
            .filter(p => !globalFilter.quarter || p.quarter === globalFilter.quarter) 
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [masterPlans, globalFilter, isFederalManager]);

    const dashboardStats = useMemo(() => {
        let totalBudget = 0; let totalTarget = 0; let activeLocalities = new Set();
        localityPlans.forEach(plan => {
            if (plan.locality) activeLocalities.add(plan.locality);
            plan.interventions?.forEach(inv => {
                totalBudget += Number(inv.totalCost || 0);
                totalTarget += Number(inv.target || 0);
            });
        });
        return { plansCount: localityPlans.length, localitiesCount: activeLocalities.size, totalBudget, totalTarget };
    }, [localityPlans]);

    const handleCreateNewMaster = () => {
        const assignedLocality = isLocalityManager ? (userLocalities?.[0] || '') : globalFilter.locality;
        
        if (!assignedLocality) {
            alert("الرجاء تحديد المحلية من الفلاتر أولاً للتمكن من إضافة خطة ربعية جديدة.");
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
                    indicator: inv.indicator || 'عدد',
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
            alert("حدث خطأ أثناء الحفظ. تأكد من تعديل الصلاحيات في Firebase.\nالتفاصيل: " + error.message);
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
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2"><Calendar className="text-teal-600"/> إدخال الخطة القاعدية الربعية</h2>
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
                        <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[900px]">
                            <thead className="bg-teal-800 text-white font-bold">
                                <tr>
                                    <th className="p-3 border border-teal-700 w-[15%]">المحور</th>
                                    <th className="p-3 border border-teal-700 w-[30%]">النشاط (ثابت)</th>
                                    <th className="p-3 border border-teal-700 text-center w-[10%] bg-teal-900">المُخطط</th>
                                    <th className="p-3 border border-teal-700 text-center w-[10%]">الابتدائي</th>
                                    <th className="p-3 border border-teal-700 text-center w-[10%] bg-indigo-900">المستهدف</th>
                                    <th className="p-3 border border-teal-700 text-center w-[10%]">التكلفة</th>
                                    <th className="p-3 border border-teal-700 text-center w-[15%]">ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {currentPlan.interventions?.map((inv, idx) => (
                                    <tr key={idx} className="hover:bg-teal-50 bg-white transition-colors">
                                        <td className="p-3 border border-gray-200 font-bold text-teal-800 bg-teal-50/30">{inv.axis}</td>
                                        <td className="p-3 border border-gray-200 text-gray-800 leading-relaxed">{inv.name}</td>
                                        
                                        <td className="p-0 border border-gray-200 bg-teal-50/10">
                                            <input 
                                                type="text" 
                                                inputMode="numeric" 
                                                pattern="[0-9]*" 
                                                className={numInputClass} 
                                                value={inv.planned} 
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
                                                value={inv.baseline} 
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
                                                value={inv.target} 
                                                onChange={(e) => updateIntervention(idx, 'target', e.target.value)} 
                                                placeholder="0" 
                                            />
                                        </td>
                                        
                                        <td className="p-0 border border-gray-200"><input type="text" inputMode="numeric" pattern="[0-9]*" className={`${numInputClass} bg-gray-50`} value={inv.totalCost} onChange={(e) => updateIntervention(idx, 'totalCost', e.target.value)} placeholder="0" /></td>
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

            {/* --- DASHBOARD SECTION --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                <Card className="border-r-4 border-r-sky-500 bg-white"><CardBody className="p-4 flex items-center gap-4"><div className="p-3 bg-sky-100 text-sky-600 rounded-full"><Layers size={24}/></div><div><p className="text-xs text-gray-500 font-bold">إجمالي الخطط المعروضة</p><h4 className="text-2xl font-bold text-gray-800">{dashboardStats.plansCount}</h4></div></CardBody></Card>
                <Card className="border-r-4 border-r-teal-500 bg-white"><CardBody className="p-4 flex items-center gap-4"><div className="p-3 bg-teal-100 text-teal-600 rounded-full"><Users size={24}/></div><div><p className="text-xs text-gray-500 font-bold">المحليات المغطاة</p><h4 className="text-2xl font-bold text-gray-800">{dashboardStats.localitiesCount}</h4></div></CardBody></Card>
                <Card className="border-r-4 border-r-indigo-500 bg-white"><CardBody className="p-4 flex items-center gap-4"><div className="p-3 bg-indigo-100 text-indigo-600 rounded-full"><BarChart2 size={24}/></div><div><p className="text-xs text-gray-500 font-bold">المستهدف التراكمي (Sum)</p><h4 className="text-2xl font-bold text-gray-800">{dashboardStats.totalTarget.toLocaleString()}</h4></div></CardBody></Card>
                <Card className="border-r-4 border-r-orange-500 bg-white"><CardBody className="p-4 flex items-center gap-4"><div className="p-3 bg-orange-100 text-orange-600 rounded-full"><PieChart size={24}/></div><div><p className="text-xs text-gray-500 font-bold">الميزانية الإجمالية (Sum)</p><h4 className="text-2xl font-bold text-gray-800">{dashboardStats.totalBudget.toLocaleString()}</h4></div></CardBody></Card>
            </div>

            {/* --- FILTERS SECTION --- */}
            <div className="bg-slate-800 p-4 rounded-lg shadow-md mb-6 flex flex-col md:flex-row flex-wrap gap-4 items-start md:items-end text-white">
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
                        {isFederalManager ? Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar || s}</option>) : userStates.map(s => <option key={s} value={s}>{STATE_LOCALITIES[s]?.ar || s}</option>)}
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

            {/* --- HEADER & ADD BUTTON --- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><Calendar className="text-teal-600"/> قائمة الخطط المرفوعة ({globalFilter.quarter ? globalFilter.quarter : 'كل أرباع العام'})</h3>
                    {!canEditPlan && <p className="text-xs text-orange-600 font-bold mt-1">صلاحيات العرض فقط (المستوى الاتحادي/الولائي لا يملك حق التعديل المباشر).</p>}
                </div>
                {canEditPlan && <Button onClick={handleCreateNewMaster} className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white border-0 py-3 sm:py-2 h-12 sm:h-auto"><Plus size={18} className="ml-2"/> إدخال خطة ربعية جديدة</Button>}
            </div>

            {/* --- PLANS LIST --- */}
            {localityPlans.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 flex flex-col items-center justify-center text-center">
                    <AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">لا توجد خطط قاعدية ربعية مسجلة لهذه الفلاتر حتى الآن.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {localityPlans.map(plan => (
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
                                            <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); if(window.confirm("هل أنت متأكد من حذف هذه الخطة بالكامل؟")) deleteMasterPlan(plan.id).then(()=>fetchMasterPlans(true)); }} className="px-4 py-2"><Trash2 size={16}/></Button></>
                                        )}
                                    </div>
                                    {expandedPlanId === plan.id ? <ChevronUp size={24} className="text-gray-500"/> : <ChevronDown size={24} className="text-gray-500"/>}
                                </div>
                            </div>
                            {expandedPlanId === plan.id && (
                                <div className="overflow-x-auto p-2 sm:p-4">
                                    <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[900px]">
                                        <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                            <tr>
                                                <th className="p-3 border-l border-slate-200 w-[15%]">المحور</th>
                                                <th className="p-3 border-l border-slate-200 w-[35%]">النشاط</th>
                                                <th className="p-3 border-l border-slate-200 text-center w-[10%] text-indigo-700">المُخطط</th>
                                                <th className="p-3 border-l border-slate-200 text-center w-[10%]">الابتدائي</th>
                                                <th className="p-3 border-l border-slate-200 text-center w-[10%]">المستهدف</th>
                                                <th className="p-3 border-l border-slate-200 text-center w-[10%]">التكلفة</th>
                                                <th className="p-3 border-l border-slate-200 text-center w-[10%]">ملاحظات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {plan.interventions?.filter(inv => Number(inv.target) > 0 || Number(inv.baseline) > 0 || Number(inv.planned) > 0).map(inv => {
                                                return (
                                                    <tr key={inv.id} className="hover:bg-gray-50">
                                                        <td className="p-3 border-l border-slate-200 text-gray-600 font-bold">{inv.axis}</td>
                                                        <td className="p-3 border-l border-slate-200 text-gray-800 leading-relaxed">{inv.name}</td>
                                                        <td className="p-3 border-l border-slate-200 text-center font-bold text-indigo-600 bg-indigo-50/30 text-base">{inv.planned || 0}</td>
                                                        <td className="p-3 border-l border-slate-200 text-center font-bold text-gray-600 text-base">{inv.baseline || 0}</td>
                                                        <td className="p-3 border-l border-slate-200 text-center font-bold text-teal-600 bg-teal-50/20 text-base">{inv.target || 0}</td>
                                                        <td className="p-3 border-l border-slate-200 text-center font-medium">{Number(inv.totalCost||0).toLocaleString()}</td>
                                                        <td className="p-3 border-l border-slate-200 text-xs text-gray-500 whitespace-normal">{inv.notes || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {plan.interventions?.filter(inv => Number(inv.target) > 0 || Number(inv.baseline) > 0 || Number(inv.planned) > 0).length === 0 && (
                                        <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 border border-t-0 rounded-b-lg">لم يتم رصد أرقام لأي نشاط في هذه الخطة. اضغط تعديل لإدخال الأرقام.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}