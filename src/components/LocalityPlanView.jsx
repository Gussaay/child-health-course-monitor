// src/components/LocalityPlanView.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardBody, Button, FormGroup, Select, EmptyState, PageHeader, Spinner } from './CommonComponents';
import { upsertMasterPlan, deleteMasterPlan, upsertOperationalPlan, deleteOperationalPlan } from '../data';
import { useDataCache } from '../DataContext';
import { Save, Plus, Edit, Trash2, X, ChevronDown, ChevronUp, Layers, BarChart2, PieChart, Activity, Users, Calendar } from 'lucide-react';
import { STATE_LOCALITIES } from './constants';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 2 + i);

const AXIS_OPTIONS = ['الحاكمية والتنسيق', 'التدريب', 'تقديم الخدمات', 'نظام المعلومات', 'الامداد', 'التمويل', 'أخرى'];
const QUARTERS_LIST = ['الربع الاول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];

// القالب الثابت كنقطة بداية للخطط القاعدية
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
        planned: 0,
        baseline: 0,
        target: 0,
        totalCost: 0,
        notes: ''
    }));
};

const DEFAULT_LOC_OP_ACTIVITY = () => ({
    id: `loc_act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    isUnplanned: false, masterPlanId: '', interventionId: '',
    name: '', axis: AXIS_OPTIONS[0], indicator: '', planned: 0,
    target: 0, totalCost: 0, notes: ''
});

export default function LocalityPlanView({ permissions, userStates, userLocalities }) {
    const { masterPlans, fetchMasterPlans, operationalPlans, fetchOperationalPlans, isLoading } = useDataCache();
    
    // تحديد الصلاحيات
    const isLocalityManager = permissions?.role === 'locality_manager' || permissions?.manageScope === 'locality';
    const isSuperUser = permissions?.canUseSuperUserAdvancedFeatures;
    const canEditPlan = isLocalityManager || isSuperUser;
    const isFederalManager = permissions?.canUseFederalManagerAdvancedFeatures || permissions?.manageScope === 'federal';

    const [activeTab, setActiveTab] = useState('master');
    const [globalFilter, setGlobalFilter] = useState({
        year: CURRENT_YEAR,
        state: isFederalManager ? '' : (userStates?.[0] || ''),
        locality: isLocalityManager ? (userLocalities?.[0] || '') : ''
    });

    // تحديث الفلتر تلقائياً في حال تأخر تحميل بيانات المحلية للمستخدم
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
    const [currentPlan, setCurrentPlan] = useState(null);
    const [expandedPlanId, setExpandedPlanId] = useState(null);

    const [isEditingOpPlan, setIsEditingOpPlan] = useState(false);
    const [currentOpPlan, setCurrentOpPlan] = useState(null);

    useEffect(() => {
        fetchMasterPlans();
        fetchOperationalPlans();
    }, [fetchMasterPlans, fetchOperationalPlans]);

    const localityPlans = useMemo(() => {
        return (masterPlans || [])
            .filter(p => !p.isDeleted && p.level === 'locality')
            .filter(p => (p.year || CURRENT_YEAR) === globalFilter.year)
            .filter(p => isFederalManager || !globalFilter.state || p.state === globalFilter.state)
            .filter(p => !globalFilter.locality || p.locality === globalFilter.locality)
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [masterPlans, globalFilter, isFederalManager]);

    const localityOpPlans = useMemo(() => {
        return (operationalPlans || [])
            .filter(p => !p.isDeleted && p.level === 'locality' && p.planType === 'Quarterly')
            .filter(p => (p.year || CURRENT_YEAR) === globalFilter.year)
            .filter(p => isFederalManager || !globalFilter.state || p.state === globalFilter.state)
            .filter(p => !globalFilter.locality || p.locality === globalFilter.locality)
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [operationalPlans, globalFilter, isFederalManager]);

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

    // --- Master Plan Handlers ---
    const handleCreateNewMaster = () => {
        const assignedLocality = isLocalityManager ? (userLocalities?.[0] || '') : globalFilter.locality;
        
        if (!assignedLocality) {
            alert("الرجاء تحديد المحلية من الفلاتر أولاً قبل إضافة الخطة.");
            return;
        }

        setCurrentPlan({
            level: 'locality',
            year: globalFilter.year,
            state: globalFilter.state || (isFederalManager ? Object.keys(STATE_LOCALITIES)[0] : userStates[0]),
            locality: assignedLocality,
            expectedOutcome: 'خطة محلية شاملة (تخطيط قاعدي)',
            interventions: generateTemplateInterventions()
        });
        setIsEditing(true);
    };

    const handleSaveMaster = async (e) => {
        if (e) e.preventDefault();
        if (!currentPlan.state || !currentPlan.locality) return alert("الرجاء تحديد الولاية والمحلية.");
        await upsertMasterPlan(currentPlan);
        fetchMasterPlans(true);
        setIsEditing(false);
    };

    const updateIntervention = (idx, field, value) => {
        const updated = [...currentPlan.interventions];
        updated[idx][field] = value;
        
        if (field === 'planned' || field === 'baseline') {
            updated[idx].target = Number(updated[idx].planned || 0) + Number(updated[idx].baseline || 0);
        }
        
        setCurrentPlan({ ...currentPlan, interventions: updated });
    };

    // --- Operational Plan Handlers ---
    const handleCreateNewOp = () => {
        const assignedLocality = isLocalityManager ? (userLocalities?.[0] || '') : globalFilter.locality;

        if (!assignedLocality) {
            alert("الرجاء تحديد المحلية من الفلاتر أولاً قبل إضافة الخطة الربعية.");
            return;
        }

        setCurrentOpPlan({
            planType: 'Quarterly',
            level: 'locality',
            year: globalFilter.year,
            state: globalFilter.state || (isFederalManager ? Object.keys(STATE_LOCALITIES)[0] : userStates[0]),
            locality: assignedLocality,
            periodQuarter: QUARTERS_LIST[0],
            activities: []
        });
        setIsEditingOpPlan(true);
    };

    const handleSaveOpPlan = async (e) => {
        if (e) e.preventDefault();
        if (!currentOpPlan.state || !currentOpPlan.locality) return alert("الرجاء تحديد الولاية والمحلية.");
        await upsertOperationalPlan({ ...currentOpPlan, periodName: currentOpPlan.periodQuarter });
        fetchOperationalPlans(true);
        setIsEditingOpPlan(false);
    };

    const updateOpActivity = (idx, field, value) => {
        const updated = [...currentOpPlan.activities];
        updated[idx][field] = value;
        setCurrentOpPlan({ ...currentOpPlan, activities: updated });
    };

    const getAvailableInterventionsForOp = (masterPlanId) => {
        if (!masterPlanId) return [];
        const mp = localityPlans.find(p => p.id === masterPlanId);
        return mp ? mp.interventions : [];
    };

    if (isLoading.masterPlans || isLoading.operationalPlans) return <Spinner />;

    // =====================================
    // Modal: الخطة السنوية (القاعدية)
    // =====================================
    if (isEditing && currentPlan) {
        const inputClass = "w-full h-full min-h-[36px] px-2 py-1 outline-none text-right text-xs bg-transparent focus:bg-white focus:ring-1 focus:ring-teal-500 rounded";
        const numInputClass = "w-full h-full min-h-[36px] px-1 py-1 outline-none text-center font-bold bg-transparent focus:bg-white focus:ring-1 focus:ring-teal-500 rounded";
        
        return (
            <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col animate-in fade-in" dir="rtl">
                <div className="bg-white shadow px-4 py-3 flex justify-between items-center border-b border-teal-200 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Layers className="text-teal-600"/> إدخال الخطة السنوية المحلية</h2>
                        <p className="text-sm text-gray-500 mt-1">إضافة وتعديل الأنشطة السنوية والمستهدفات الخاصة بمحليتك.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setIsEditing(false)}><X size={16} className="ml-1"/> إغلاق</Button>
                        <Button variant="primary" onClick={handleSaveMaster}><Save size={16} className="ml-1"/> حفظ الخطة</Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 relative">
                    <div className="bg-white rounded-lg shadow-sm border mb-4 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormGroup label="السنة">
                            <Select value={currentPlan.year} onChange={(e) => setCurrentPlan({...currentPlan, year: Number(e.target.value)})} disabled>
                                {YEAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="الولاية">
                            <div className="p-2 border rounded bg-gray-50 font-bold text-gray-600 border-gray-200">{STATE_LOCALITIES[currentPlan.state]?.ar || currentPlan.state}</div>
                        </FormGroup>
                        <FormGroup label="المحلية">
                            {isLocalityManager ? (
                                <div className="p-2 border rounded bg-gray-50 font-bold text-gray-600 border-gray-200">{currentPlan.locality}</div>
                            ) : (
                                <Select value={currentPlan.locality} onChange={(e) => setCurrentPlan({...currentPlan, locality: e.target.value})}>
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
                        <table className="w-full text-xs text-right border-collapse min-w-[1000px]">
                            <thead className="bg-teal-800 text-white font-bold">
                                <tr>
                                    <th className="p-2 border border-teal-700 w-[15%]">المحور</th>
                                    <th className="p-2 border border-teal-700 w-[30%]">النشاط (ثابت)</th>
                                    <th className="p-2 border border-teal-700 text-center w-[10%] bg-teal-900">المُخطط</th>
                                    <th className="p-2 border border-teal-700 text-center w-[10%]">الابتدائي</th>
                                    <th className="p-2 border border-teal-700 text-center w-[10%] bg-indigo-900">المستهدف</th>
                                    <th className="p-2 border border-teal-700 text-center w-[10%]">التكلفة</th>
                                    <th className="p-2 border border-teal-700 text-center w-[15%]">ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {currentPlan.interventions?.map((inv, idx) => {
                                    return (
                                        <tr key={idx} className="hover:bg-teal-50 bg-white transition-colors">
                                            <td className="p-2 border border-gray-200 font-bold text-teal-800 bg-teal-50/30">{inv.axis}</td>
                                            <td className="p-2 border border-gray-200 text-gray-800">{inv.name}</td>
                                            
                                            <td className="p-0 border border-gray-200 bg-teal-50/10">
                                                <input type="number" className={numInputClass} value={inv.planned || 0} onChange={(e) => updateIntervention(idx, 'planned', e.target.value)} />
                                            </td>
                                            <td className="p-0 border border-gray-200">
                                                <input type="number" className={numInputClass} value={inv.baseline || 0} onChange={(e) => updateIntervention(idx, 'baseline', e.target.value)} />
                                            </td>
                                            
                                            <td className="p-0 border border-gray-200">
                                                <input type="number" className={`${numInputClass} text-indigo-700 bg-indigo-50/20`} value={inv.target || 0} onChange={(e) => updateIntervention(idx, 'target', e.target.value)} />
                                            </td>
                                            
                                            <td className="p-0 border border-gray-200"><input type="number" className={`${numInputClass} bg-gray-50`} value={inv.totalCost} onChange={(e) => updateIntervention(idx, 'totalCost', e.target.value)} placeholder="0" /></td>
                                            <td className="p-0 border border-gray-200"><textarea className={`${inputClass} resize-none`} rows={1} value={inv.notes || ''} onChange={(e) => updateIntervention(idx, 'notes', e.target.value)} placeholder="..." /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // =====================================
    // Modal: الخطة الربعية (Operational)
    // =====================================
    if (isEditingOpPlan && currentOpPlan) {
        const inputClass = "w-full h-full min-h-[36px] px-2 py-1 outline-none text-right text-xs bg-transparent focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded";
        return (
            <div className="fixed inset-0 z-40 bg-gray-100 flex flex-col animate-in fade-in" dir="rtl">
                <div className="bg-white shadow px-4 py-3 flex justify-between items-center border-b border-indigo-200 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Calendar className="text-indigo-600"/> إعداد الخطة الربعية المحلية</h2>
                        <p className="text-sm text-gray-500 mt-1">تنزيل الأنشطة السنوية للربع المستهدف ووضع تفاصيل التنفيذ.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setIsEditingOpPlan(false)}><X size={16} className="ml-1"/> إغلاق</Button>
                        <Button variant="primary" onClick={handleSaveOpPlan}><Save size={16} className="ml-1"/> حفظ الخطة الربعية</Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 relative">
                    <div className="bg-white rounded-lg shadow-sm border mb-4 p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormGroup label="السنة">
                            <Select value={currentOpPlan.year} onChange={(e) => setCurrentOpPlan({...currentOpPlan, year: Number(e.target.value)})} disabled>
                                {YEAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="الربع">
                            <Select value={currentOpPlan.periodQuarter} onChange={(e) => setCurrentOpPlan({...currentOpPlan, periodQuarter: e.target.value})}>
                                {QUARTERS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="المحلية" className="md:col-span-2">
                            <div className="p-2 border rounded bg-indigo-50 font-bold text-indigo-800 border-indigo-200">{currentOpPlan.locality} ({STATE_LOCALITIES[currentOpPlan.state]?.ar})</div>
                        </FormGroup>
                    </div>

                    <div className="bg-white border shadow-sm w-full overflow-x-auto rounded-lg pb-10">
                        <table className="w-full text-xs text-right border-collapse min-w-[1100px]">
                            <thead className="bg-indigo-800 text-white font-bold">
                                <tr>
                                    <th className="p-2 border border-indigo-700 w-[6%] text-center">النوع</th>
                                    <th className="p-2 border border-indigo-700 w-[15%]">الخطة الأساسية</th>
                                    <th className="p-2 border border-indigo-700 w-[29%]">النشاط (من الخطة)</th>
                                    <th className="p-2 border border-indigo-700 text-center w-[8%]">المُخطط</th>
                                    <th className="p-2 border border-indigo-700 text-center w-[8%]">الهدف الربعي</th>
                                    <th className="p-2 border border-indigo-700 text-center w-[10%]">التكلفة</th>
                                    <th className="p-2 border border-indigo-700 text-center w-[20%]">ملاحظات</th>
                                    <th className="p-2 border border-indigo-700 text-center w-[4%]">حذف</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {currentOpPlan.activities?.map((act, idx) => {
                                    const availableMasterPlans = localityPlans;
                                    const availableInvs = getAvailableInterventionsForOp(act.masterPlanId);
                                    
                                    return (
                                        <tr key={act.id} className={`hover:bg-indigo-50 transition-colors ${act.isUnplanned ? 'bg-orange-50/20' : 'bg-white'}`}>
                                            <td className="p-1 border border-gray-200 text-center">
                                                <label className="flex flex-col items-center gap-1 text-[9px] font-bold cursor-pointer text-orange-700">
                                                    <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={act.isUnplanned} onChange={(e) => {
                                                        const newActs = [...currentOpPlan.activities];
                                                        newActs[idx].isUnplanned = e.target.checked;
                                                        if(e.target.checked) { newActs[idx].masterPlanId = ''; newActs[idx].interventionId = `unp_${Date.now()}`; }
                                                        else { newActs[idx].interventionId = ''; }
                                                        setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                    }} /> مستحدث
                                                </label>
                                            </td>
                                            <td className="p-1 border border-gray-200">
                                                {act.isUnplanned ? (
                                                    <select className={inputClass} value={act.axis} onChange={(e) => updateOpActivity(idx, 'axis', e.target.value)}>
                                                        <option value="">- المحور -</option>
                                                        {AXIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                ) : (
                                                    <select className={inputClass} value={act.masterPlanId} onChange={(e) => {
                                                        const newActs = [...currentOpPlan.activities];
                                                        newActs[idx].masterPlanId = e.target.value; newActs[idx].interventionId = '';
                                                        setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                    }}>
                                                        <option value="">- اختر الخطة السنوية -</option>
                                                        {availableMasterPlans.map(p => <option key={p.id} value={p.id}>{p.expectedOutcome}</option>)}
                                                    </select>
                                                )}
                                            </td>
                                            <td className="p-1 border border-gray-200">
                                                {act.isUnplanned ? (
                                                    <textarea className={`${inputClass} font-bold resize-none`} rows={2} value={act.name} onChange={(e) => updateOpActivity(idx, 'name', e.target.value)} placeholder="اسم النشاط المستحدث..." />
                                                ) : (
                                                    <select className={`${inputClass} font-bold`} value={act.interventionId} onChange={(e) => {
                                                        const newActs = [...currentOpPlan.activities];
                                                        newActs[idx].interventionId = e.target.value;
                                                        const selInv = availableInvs.find(i => i.id === e.target.value);
                                                        if (selInv) { newActs[idx].name = selInv.name; newActs[idx].planned = selInv.planned; }
                                                        setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                    }} disabled={!act.masterPlanId}>
                                                        <option value="">- النشاط من الخطة السنوية -</option>
                                                        {availableInvs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                    </select>
                                                )}
                                            </td>
                                            <td className="p-1 border border-gray-200"><input type="number" className={`${inputClass} text-center font-bold`} value={act.planned || 0} onChange={(e) => updateOpActivity(idx, 'planned', e.target.value)} placeholder="0" /></td>
                                            <td className="p-1 border border-gray-200"><input type="number" className={`${inputClass} text-center font-bold text-indigo-700`} value={act.target} onChange={(e) => updateOpActivity(idx, 'target', e.target.value)} /></td>
                                            <td className="p-1 border border-gray-200"><input type="number" className={`${inputClass} text-center font-bold`} value={act.totalCost} onChange={(e) => updateOpActivity(idx, 'totalCost', e.target.value)} placeholder="0" /></td>
                                            <td className="p-1 border border-gray-200"><textarea className={`${inputClass} resize-none`} rows={2} value={act.notes || ''} onChange={(e) => updateOpActivity(idx, 'notes', e.target.value)} placeholder="..." /></td>
                                            <td className="p-1 border border-gray-200 text-center align-middle">
                                                <button type="button" onClick={() => setCurrentOpPlan({...currentOpPlan, activities: currentOpPlan.activities.filter((_, i) => i !== idx)})} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-2 border border-t-0 border-gray-200 bg-gray-50 flex justify-center">
                            <Button type="button" size="sm" variant="secondary" onClick={() => setCurrentOpPlan({...currentOpPlan, activities: [...(currentOpPlan.activities||[]), DEFAULT_LOC_OP_ACTIVITY()]})}><Plus size={16} className="ml-1"/> إضافة نشاط للربع</Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in" dir="rtl">
            <PageHeader title="التخطيط القاعدي للمحليات" subtitle="إدارة الخطط السنوية والتشغيلية الخاصة بالمحليات وتطبيق العلاج المتكامل" />

            {/* --- DASHBOARD SECTION --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                <Card className="border-r-4 border-r-sky-500 bg-white"><CardBody className="p-4 flex items-center gap-4"><div className="p-3 bg-sky-100 text-sky-600 rounded-full"><Layers size={24}/></div><div><p className="text-xs text-gray-500 font-bold">الخطط المرفوعة</p><h4 className="text-2xl font-bold text-gray-800">{dashboardStats.plansCount}</h4></div></CardBody></Card>
                <Card className="border-r-4 border-r-teal-500 bg-white"><CardBody className="p-4 flex items-center gap-4"><div className="p-3 bg-teal-100 text-teal-600 rounded-full"><Users size={24}/></div><div><p className="text-xs text-gray-500 font-bold">المحليات المغطاة</p><h4 className="text-2xl font-bold text-gray-800">{dashboardStats.localitiesCount}</h4></div></CardBody></Card>
                <Card className="border-r-4 border-r-indigo-500 bg-white"><CardBody className="p-4 flex items-center gap-4"><div className="p-3 bg-indigo-100 text-indigo-600 rounded-full"><BarChart2 size={24}/></div><div><p className="text-xs text-gray-500 font-bold">إجمالي المستهدفات</p><h4 className="text-2xl font-bold text-gray-800">{dashboardStats.totalTarget.toLocaleString()}</h4></div></CardBody></Card>
                <Card className="border-r-4 border-r-orange-500 bg-white"><CardBody className="p-4 flex items-center gap-4"><div className="p-3 bg-orange-100 text-orange-600 rounded-full"><PieChart size={24}/></div><div><p className="text-xs text-gray-500 font-bold">الميزانية الإجمالية</p><h4 className="text-2xl font-bold text-gray-800">{dashboardStats.totalBudget.toLocaleString()}</h4></div></CardBody></Card>
            </div>

            {/* --- FILTERS SECTION --- */}
            <div className="bg-slate-800 p-4 rounded-lg shadow-md mb-6 flex flex-col md:flex-row flex-wrap gap-4 items-start md:items-end text-white">
                <div className="w-full md:flex-1 md:min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-300 mb-1">سنة الخطة</label>
                    <select className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-2 outline-none" value={globalFilter.year} onChange={e => setGlobalFilter({...globalFilter, year: Number(e.target.value)})}>
                        {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="w-full md:flex-1 md:min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-300 mb-1">الولاية</label>
                    <select className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-2 outline-none disabled:opacity-50" value={globalFilter.state} onChange={e => setGlobalFilter({...globalFilter, state: e.target.value, locality: ''})} disabled={!isFederalManager && userStates.length <= 1}>
                        <option value="">-- عرض كل الولايات --</option>
                        {isFederalManager ? Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar || s}</option>) : userStates.map(s => <option key={s} value={s}>{STATE_LOCALITIES[s]?.ar || s}</option>)}
                    </select>
                </div>
                {globalFilter.state && (
                    <div className="w-full md:flex-1 md:min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-300 mb-1">المحلية</label>
                        <select 
                            className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-2 outline-none disabled:opacity-50" 
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

            {/* --- SUB-TABS --- */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-4 sm:gap-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {[
                        { id: 'master', label: 'الخطة السنوية (الأساسية)', icon: Layers },
                        { id: 'quarterly', label: 'الخطط الربعية (التشغيلية)', icon: Calendar }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* --- TAB: MASTER PLANS --- */}
            {activeTab === 'master' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2"><Activity className="text-teal-600"/> قائمة الخطط السنوية المرفوعة ({globalFilter.year})</h3>
                            {!canEditPlan && <p className="text-xs text-orange-600 font-bold mt-1">صلاحيات العرض فقط (المستوى الاتحادي/الولائي لا يملك حق التعديل المباشر).</p>}
                        </div>
                        {canEditPlan && <Button onClick={handleCreateNewMaster} className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white border-0"><Plus size={18} className="ml-2"/> إدخال خطة محلية سنوية جديدة</Button>}
                    </div>

                    {localityPlans.length === 0 ? (
                        <EmptyState message="لا توجد خطط قاعدية مسجلة لهذه الفلاتر." />
                    ) : (
                        <div className="space-y-4">
                            {localityPlans.map(plan => (
                                <div key={plan.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div className="p-4 bg-teal-50 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-teal-100 border-b gap-3" onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}>
                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-teal-200 text-teal-800">محلي - {plan.locality || 'غير محدد'} ({STATE_LOCALITIES[plan.state]?.ar || plan.state})</span>
                                            <span className="font-bold text-base text-gray-800">{plan.expectedOutcome || 'خطة محلية شاملة'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {canEditPlan && (
                                                <><Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setCurrentPlan(plan); setIsEditing(true); }}><Edit size={14}/></Button>
                                                <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); if(confirm("حذف الخطة؟")) deleteMasterPlan(plan.id).then(()=>fetchMasterPlans(true)); }}><Trash2 size={14}/></Button></>
                                            )}
                                            {expandedPlanId === plan.id ? <ChevronUp size={20} className="text-gray-500"/> : <ChevronDown size={20} className="text-gray-500"/>}
                                        </div>
                                    </div>
                                    {expandedPlanId === plan.id && (
                                        <div className="overflow-x-auto p-2 sm:p-4">
                                            <table className="w-full text-xs text-right border-collapse min-w-[900px]">
                                                <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                                    <tr>
                                                        <th className="p-2 border-l border-slate-200 w-[15%]">المحور</th>
                                                        <th className="p-2 border-l border-slate-200 w-[35%]">النشاط</th>
                                                        <th className="p-2 border-l border-slate-200 text-center w-[10%] text-indigo-700">المُخطط</th>
                                                        <th className="p-2 border-l border-slate-200 text-center w-[10%]">الابتدائي</th>
                                                        <th className="p-2 border-l border-slate-200 text-center w-[10%]">المستهدف</th>
                                                        <th className="p-2 border-l border-slate-200 text-center w-[10%]">التكلفة</th>
                                                        <th className="p-2 border-l border-slate-200 text-center w-[10%]">ملاحظات</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {plan.interventions?.filter(inv => Number(inv.target) > 0 || Number(inv.baseline) > 0 || Number(inv.planned) > 0).map(inv => {
                                                        return (
                                                            <tr key={inv.id} className="hover:bg-gray-50">
                                                                <td className="p-2 border-l border-slate-200 text-gray-600 font-bold">{inv.axis}</td>
                                                                <td className="p-2 border-l border-slate-200 text-gray-800">{inv.name}</td>
                                                                <td className="p-2 border-l border-slate-200 text-center font-bold text-indigo-600 bg-indigo-50/30">{inv.planned || 0}</td>
                                                                <td className="p-2 border-l border-slate-200 text-center font-bold text-gray-600">{inv.baseline || 0}</td>
                                                                <td className="p-2 border-l border-slate-200 text-center font-bold text-teal-600 bg-teal-50/20">{inv.target || 0}</td>
                                                                <td className="p-2 border-l border-slate-200 text-center font-medium">{Number(inv.totalCost||0).toLocaleString()}</td>
                                                                <td className="p-2 border-l border-slate-200 text-[10px] text-gray-500">{inv.notes || '-'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            {plan.interventions?.filter(inv => Number(inv.target) > 0 || Number(inv.baseline) > 0 || Number(inv.planned) > 0).length === 0 && (
                                                <div className="p-4 text-center text-sm text-gray-500">لم يتم رصد أرقام أو مستهدفات لأي نشاط في هذه الخطة حتى الآن.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* --- TAB: QUARTERLY PLANS --- */}
            {activeTab === 'quarterly' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2"><Calendar className="text-indigo-600"/> الخطط الربعية للمحليات ({globalFilter.year})</h3>
                        </div>
                        {canEditPlan && <Button onClick={handleCreateNewOp} className="w-full sm:w-auto justify-center bg-indigo-600 hover:bg-indigo-700 text-white border-0"><Plus size={18} className="ml-2"/> إدخال خطة ربعية</Button>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {localityOpPlans.map(op => (
                            <Card key={op.id} className="border-r-4 border-r-indigo-500">
                                <CardBody className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="flex gap-2 mb-1"><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">محلي - {op.locality || 'غير محدد'} ({STATE_LOCALITIES[op.state]?.ar})</span></div>
                                        <h4 className="text-base sm:text-lg font-bold text-gray-800">{op.periodName}</h4>
                                        <p className="text-xs text-gray-500 mt-1">الأنشطة المجدولة: {op.activities?.length || 0}</p>
                                    </div>
                                    {canEditPlan && (
                                        <div className="flex gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end">
                                            <Button variant="secondary" size="sm" onClick={() => { setCurrentOpPlan(op); setIsEditingOpPlan(true); }}><Edit size={16}/></Button>
                                            <Button variant="danger" size="sm" onClick={() => { if(confirm("حذف؟")) deleteOperationalPlan(op.id).then(()=>fetchOperationalPlans(true)); }}><Trash2 size={16}/></Button>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                    {localityOpPlans.length === 0 && <EmptyState message="لا توجد خطط ربعية مسجلة للعام والمستوى المحددين." />}
                </div>
            )}
        </div>
    );
}