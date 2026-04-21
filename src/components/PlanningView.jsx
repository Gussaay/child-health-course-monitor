// src/components/PlanningView.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { amiriFontBase64 } from './AmiriFont.js'; 
import { Card, CardBody, Button, Modal, Input, FormGroup, Select, PageHeader, Table, EmptyState, Spinner } from './CommonComponents';
import { upsertMasterPlan, deleteMasterPlan, upsertOperationalPlan, deleteOperationalPlan } from '../data';
import { useDataCache } from '../DataContext';
import { 
    Plus, Edit, Trash2, TrendingUp, Target, ChevronDown, 
    ChevronUp, Calendar, Activity, FileSpreadsheet, CheckCircle2, 
    AlertTriangle, Briefcase, Calculator, Upload, Download, Save, X, BarChart2, PieChart, Layers, ListFilter, FileText
} from 'lucide-react';
import { STATE_LOCALITIES } from './constants'; 

// --- الثوابت الأساسية والقوائم ---
const AXIS_OPTIONS = ['الحاكمية', 'بناء القدرات', 'تقديم الخدمات', 'نظام المعلومات', 'الإمداد', 'التمويل'];

const OUTCOME_OPTIONS = [
    'ذيادة التغطية بخدمات العلاج المتكامل',
    'ذيادة التغطية بخدمات الرعاية الضرورية للاطفال',
    'ذيادة التغطية بخدمات الرعاية الخاصة للاطفال',
    'ذيادة التغطية بخدمات الفرز والتقييم والمعالجة',
    'ذيادة التغطية بخدمات المراهقين',
    'ذيادة التغطية بخدمات حماية الاطفال',
    'ذيادة التغطية بخدمات تطور الاطفال',
    'تقوية الحاكمية والتنسيق'
];

const INDICATOR_OPTIONS = ['عدد الكوادر التي تم تدريبها', 'عدد الورش', 'عدد المؤسسات التي تم توفير حوجتها', 'وجود دليل مجاز'];
const GOV_PROJECT_OPTIONS = ['خفض وفيات الامهات والاطفال', 'حفض وفيات الاطفال', 'العلاج المجاني'];
const PARTNER_SUPPORT_OPTIONS = ['الصحة العالمية', 'اليونسيف', 'الامم المتحدة للسكان', 'حماية الطفولة', 'سابا'];

const QUARTERS_MAP = {
    'الربع الاول': ['يناير', 'فبراير', 'مارس'],
    'الربع الثاني': ['أبريل', 'مايو', 'يونيو'],
    'الربع الثالث': ['يوليو', 'أغسطس', 'سبتمبر'],
    'الربع الرابع': ['أكتوبر', 'نوفمبر', 'ديسمبر']
};

const QUARTERS_LIST = Object.keys(QUARTERS_MAP);
const MONTHS_LIST = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKS_LIST = ['الأسبوع الأول', 'الأسبوع الثاني', 'الأسبوع الثالث', 'الأسبوع الرابع', 'الأسبوع الخامس'];

const PLAN_TYPES = {
    QUARTERLY: 'Quarterly',
    MONTHLY: 'Monthly',
    WEEKLY: 'Weekly'
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 2 + i);

// نموذج التدخل الافتراضي للخطط التشغيلية 
const DEFAULT_OP_ACTIVITY = () => ({
    id: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    isUnplanned: false,
    masterPlanId: '',
    interventionId: '',
    name: '', axis: AXIS_OPTIONS[0], indicator: '', 
    target: 0, isOutsideMonthly: false,
    totalCost: 0,
    govSource: '', govValue: 0,
    extSource1: '', extValue1: 0,
    extSource2: '', extValue2: 0,
    extSource3: '', extValue3: 0,
    targetFacilities: [] 
});

// نموذج التدخل الافتراضي (Matrix Row)
const DEFAULT_INTERVENTION = () => ({
    id: `inv_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    axis: AXIS_OPTIONS[0],
    name: '', indicator: '', baseline: 0, target: 0,
    q1: false, q2: false, q3: false, q4: false,
    totalCost: 0,
    govSource: '', govValue: 0,
    extSource1: '', extValue1: 0,
    extSource2: '', extValue2: 0,
    extSource3: '', extValue3: 0
});

// مكون مساعد للقوائم المنسدلة
const SelectWithOther = ({ options, value, onChange, placeholder, otherLabel = 'اخرى', invalidMode = false }) => {
    const isOther = value !== '' && !options.includes(value);
    const [showInput, setShowInput] = useState(isOther || value === otherLabel);

    useEffect(() => {
        setShowInput(value !== '' && !options.includes(value));
    }, [value, options]);

    const handleSelectChange = (e) => {
        const val = e.target.value;
        if (val === otherLabel) {
            setShowInput(true);
            onChange(''); 
        } else {
            setShowInput(false);
            onChange(val);
        }
    };

    const baseClass = "w-full h-full min-h-[32px] px-1 py-1 outline-none text-right text-xs cursor-pointer rounded border border-gray-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500";
    const selectClass = invalidMode ? `${baseClass} bg-red-50 border-red-400 text-red-800` : `${baseClass} bg-white`;

    return (
        <div className="w-full flex flex-col justify-center relative">
            {!showInput ? (
                <select className={selectClass} value={value} onChange={handleSelectChange}>
                    <option value="">{placeholder}</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                    <option value={otherLabel} className="font-bold text-sky-600">{otherLabel}</option>
                </select>
            ) : (
                <div className="flex items-center w-full bg-white ring-1 ring-sky-500 z-10 relative rounded">
                    <input 
                        type="text" 
                        className="w-full min-h-[32px] px-2 py-1 bg-transparent border-0 outline-none text-right text-xs" 
                        value={value} 
                        onChange={(e) => onChange(e.target.value)} 
                        placeholder="حدد..." 
                        autoFocus
                    />
                    <button type="button" className="text-red-500 px-2 font-bold hover:bg-red-50 h-full rounded-l" onClick={() => { setShowInput(false); onChange(''); }}>×</button>
                </div>
            )}
        </div>
    );
};

export default function PlanningView({ permissions, userStates }) {
    const { 
        masterPlans: rawPlans, fetchMasterPlans, 
        operationalPlans: rawOpPlans, fetchOperationalPlans, 
        healthFacilities, fetchHealthFacilities,
        isLoading 
    } = useDataCache();
    
    const [activeTab, setActiveTab] = useState('master'); 
    const [expandedPlanId, setExpandedPlanId] = useState(null);
    const [isEditingMatrix, setIsEditingMatrix] = useState(false); 
    const [isEditingOpPlan, setIsEditingOpPlan] = useState(false); 
    const [isEditingTracking, setIsEditingTracking] = useState(false);

    // Pop-up states for Matrix and Operational Plan enhancement
    const [scheduleModalIdx, setScheduleModalIdx] = useState(null);
    const [supportModalIdx, setSupportModalIdx] = useState(null);
    const [opSupportModalIdx, setOpSupportModalIdx] = useState(null);

    const isFederalManager = permissions?.canUseFederalManagerAdvancedFeatures || permissions?.manageScope === 'federal';

    // ==========================================
    // 1. GLOBAL CONTEXT STATE (الموجه الأساسي للنظام)
    // ==========================================
    const [globalFilter, setGlobalFilter] = useState({
        year: CURRENT_YEAR,
        level: isFederalManager ? 'federal' : 'state',
        state: isFederalManager ? '' : (userStates?.[0] || '')
    });

    // Evaluation Granular Filters
    const [evalFilters, setEvalFilters] = useState({
        quarter: '',
        month: '',
        week: '',
        outcome: '',
        axis: ''
    });

    const [currentPlan, setCurrentPlan] = useState(null);
    const [currentOpPlan, setCurrentOpPlan] = useState(null);

    useEffect(() => {
        fetchMasterPlans();
        fetchOperationalPlans();
        if (fetchHealthFacilities) fetchHealthFacilities(); 
    }, [fetchMasterPlans, fetchOperationalPlans, fetchHealthFacilities]);

    // ==========================================
    // 2. FILTERED DATA MEMOS
    // ==========================================
    const filteredPlans = useMemo(() => {
        return (rawPlans || [])
            .filter(p => !p.isDeleted)
            .filter(p => (p.year || CURRENT_YEAR) === globalFilter.year) 
            .filter(p => (p.level || 'federal') === globalFilter.level) 
            .filter(p => globalFilter.level === 'federal' || !globalFilter.state || (p.state || '') === globalFilter.state)
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [rawPlans, globalFilter]);

    const filteredOpPlans = useMemo(() => {
        return (rawOpPlans || [])
            .filter(p => !p.isDeleted)
            .filter(p => (p.year || CURRENT_YEAR) === globalFilter.year)
            .filter(p => (p.level || 'federal') === globalFilter.level)
            .filter(p => globalFilter.level === 'federal' || !globalFilter.state || (p.state || '') === globalFilter.state)
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [rawOpPlans, globalFilter]);

    // قائمة المؤسسات الديناميكية الذكية للتخطيط
    const dynamicFacilityOptions = useMemo(() => {
        if (!healthFacilities) return [];
        
        let validFacilities = healthFacilities.filter(f => 
            f.isDeleted !== true && f.isDeleted !== "true" && f['اسم_المؤسسة']
        );
        
        if (currentOpPlan && currentOpPlan.level === 'state' && currentOpPlan.state) {
            validFacilities = validFacilities.filter(f => f['الولاية'] === currentOpPlan.state);
        }
        
        const names = [...new Set(validFacilities.map(f => f['اسم_المؤسسة']))];
        return names.sort();
    }, [healthFacilities, currentOpPlan?.level, currentOpPlan?.state]);


    const calculateGap = (inv) => {
        const total = Number(inv.totalCost) || 0;
        const funded = (Number(inv.govValue) || 0) + (Number(inv.extValue1) || 0) + (Number(inv.extValue2) || 0) + (Number(inv.extValue3) || 0);
        return total - funded;
    };

    const getAvailableInterventions = (actRow) => {
        if (!currentOpPlan || !actRow.masterPlanId) return [];
        const mp = filteredPlans.find(p => p.id === actRow.masterPlanId);
        if (!mp) return [];
        return mp.interventions;
    };

    const getAvailableMasterPlans = (actRow) => {
        return filteredPlans;
    };

    const getAggregatedData = (targetPlan) => {
        if (targetPlan.planType === PLAN_TYPES.WEEKLY || targetPlan.planType === PLAN_TYPES.MONTHLY) {
            return targetPlan.activities || [];
        }
        
        const aggregatedActivities = JSON.parse(JSON.stringify(targetPlan.activities || []));

        return aggregatedActivities.map(act => {
            let relatedWeeks = [];
            if (targetPlan.planType === PLAN_TYPES.QUARTERLY) { 
                const monthsInQ = QUARTERS_MAP[targetPlan.periodQuarter] || [];
                relatedWeeks = filteredOpPlans.filter(op => op.planType === PLAN_TYPES.WEEKLY && monthsInQ.includes(op.periodMonth));
            }
            
            let totalAchieved = 0; 
            let totalActualCost = 0;
            
            relatedWeeks.forEach(week => {
                const sameAct = week.activities?.find(a => a.interventionId === act.interventionId);
                if (sameAct) { 
                    totalAchieved += parseFloat(sameAct.achieved || 0); 
                    totalActualCost += parseFloat(sameAct.actualCost || 0); 
                }
            });
            return { ...act, achieved: totalAchieved, actualCost: totalActualCost, isAggregated: true };
        });
    };

    const getDynamicBaseline = (masterPlanId, interventionId, currentOpId) => {
        let base = 0;
        if (masterPlanId) {
            const masterPlan = filteredPlans.find(p => p.id === masterPlanId);
            const intervention = masterPlan?.interventions?.find(i => i.id === interventionId);
            base = parseFloat(intervention?.baseline) || 0;
        }

        filteredOpPlans.forEach(op => {
            if ((op.planType === PLAN_TYPES.WEEKLY || op.planType === PLAN_TYPES.MONTHLY) && op.id !== currentOpId) {
                const act = op.activities?.find(a => a.interventionId === interventionId);
                base += parseFloat(act?.achieved || 0);
            }
        });
        return base;
    };

    const handleUpdateWeeklyTracking = (activityId, field, value) => {
        if (!currentOpPlan) return;
        const newActs = [...(currentOpPlan.activities || [])];
        const actIndex = newActs.findIndex(a => a.id === activityId);
        if (actIndex > -1) {
            newActs[actIndex][field] = value;
            setCurrentOpPlan({ ...currentOpPlan, activities: newActs });
        }
    };

    // Updating Handlers for Modals
    const updateMasterPlanIntervention = (idx, field, val) => {
        const newInvs = [...currentPlan.interventions];
        newInvs[idx][field] = val;
        setCurrentPlan({...currentPlan, interventions: newInvs});
    };

    const updateOpPlanActivity = (idx, field, val) => {
        const newActs = [...currentOpPlan.activities];
        newActs[idx][field] = val;
        setCurrentOpPlan({...currentOpPlan, activities: newActs});
    };

    const handleSaveMasterPlan = async (e) => {
        if (e) e.preventDefault();
        
        if (!currentPlan.level) {
            alert("الرجاء تحديد نوع الخطة (اتحادية / ولائية).");
            return;
        }
        if (currentPlan.level === 'state' && !currentPlan.state) {
            alert("الرجاء تحديد الولاية.");
            return;
        }
        
        await upsertMasterPlan(currentPlan);
        fetchMasterPlans(true);
        setIsEditingMatrix(false);
        setScheduleModalIdx(null);
        setSupportModalIdx(null);
    };

    const handleSaveOpPlan = async (e) => {
        if (e) e.preventDefault();
        
        if (!currentOpPlan.level) {
            alert("الرجاء تحديد مستوى الخطة.");
            return;
        }
        if (currentOpPlan.level === 'state' && !currentOpPlan.state) {
            alert("الرجاء تحديد الولاية.");
            return;
        }

        let name = currentOpPlan.planType === PLAN_TYPES.QUARTERLY ? currentOpPlan.periodQuarter : 
                   currentOpPlan.planType === PLAN_TYPES.MONTHLY ? currentOpPlan.periodMonth : 
                   `${currentOpPlan.periodWeek} - ${currentOpPlan.periodMonth}`;
        
        await upsertOperationalPlan({ ...currentOpPlan, periodName: name });
        fetchOperationalPlans(true);
        setIsEditingOpPlan(false);
        setOpSupportModalIdx(null);
    };

    const handleSaveTracking = async (e) => {
        if (e) e.preventDefault();
        await upsertOperationalPlan(currentOpPlan);
        fetchOperationalPlans(true);
        setIsEditingTracking(false);
    };

    const openCreateMasterPlan = () => {
        setCurrentPlan({ 
            year: globalFilter.year, 
            expectedOutcome: OUTCOME_OPTIONS[0], 
            level: globalFilter.level,
            state: globalFilter.level === 'state' && !globalFilter.state && isFederalManager ? Object.keys(STATE_LOCALITIES)[0] : globalFilter.state,
            interventions: [DEFAULT_INTERVENTION()] 
        }); 
        setIsEditingMatrix(true);
    };

    const openCreateOpPlan = (type) => {
        let base = { 
            planType: type, 
            year: globalFilter.year, 
            level: globalFilter.level,
            state: globalFilter.level === 'state' && !globalFilter.state && isFederalManager ? Object.keys(STATE_LOCALITIES)[0] : globalFilter.state,
            activities: [] 
        };
        if (type === PLAN_TYPES.QUARTERLY) base.periodQuarter = QUARTERS_LIST[0];
        if (type === PLAN_TYPES.MONTHLY) base.periodMonth = MONTHS_LIST[0];
        if (type === PLAN_TYPES.WEEKLY) {
            base.periodMonth = MONTHS_LIST[0];
            base.periodWeek = WEEKS_LIST[0];
        }
        setCurrentOpPlan(base);
        setIsEditingOpPlan(true);
    };

    const handleEditOpPlan = (op) => {
        const enrichedOp = { ...op };
        const existingInvIds = new Set(enrichedOp.activities?.map(a => a.interventionId) || []);
        const newActivities = [];

        if (op.planType === PLAN_TYPES.QUARTERLY) {
            const months = QUARTERS_MAP[op.periodQuarter] || [];
            const childPlans = filteredOpPlans.filter(p => 
                (p.planType === PLAN_TYPES.MONTHLY || p.planType === PLAN_TYPES.WEEKLY) && 
                months.includes(p.periodMonth) && 
                p.year === op.year && p.level === op.level && p.state === op.state
            );
            
            childPlans.forEach(cp => {
                cp.activities?.forEach(act => {
                    if (!existingInvIds.has(act.interventionId)) {
                        newActivities.push({ ...act, id: `act_${Date.now()}_${Math.floor(Math.random() * 10000)}` });
                        existingInvIds.add(act.interventionId);
                    }
                });
            });
        } else if (op.planType === PLAN_TYPES.MONTHLY) {
            const childPlans = filteredOpPlans.filter(p => 
                p.planType === PLAN_TYPES.WEEKLY && 
                p.periodMonth === op.periodMonth && 
                p.year === op.year && p.level === op.level && p.state === op.state
            );
            
            childPlans.forEach(cp => {
                cp.activities?.forEach(act => {
                    if (!existingInvIds.has(act.interventionId)) {
                        newActivities.push({ ...act, id: `act_${Date.now()}_${Math.floor(Math.random() * 10000)}` });
                        existingInvIds.add(act.interventionId);
                    }
                });
            });
        }

        enrichedOp.activities = [...(enrichedOp.activities || []), ...newActivities];
        setCurrentOpPlan(enrichedOp);
        setIsEditingOpPlan(true);
    };

    const getFullPlanEvaluation = () => {
        let totalBudget = 0;
        let totalGap = 0;
        let totalActualCost = 0;

        const { quarter, month, week, outcome, axis } = evalFilters;

        const monthIdx = new Date().getMonth();
        const actualCurrentMonth = MONTHS_LIST[monthIdx];
        
        let targetMonth = month;
        let targetQuarter = quarter;

        if (!targetQuarter && targetMonth) {
            targetQuarter = Object.keys(QUARTERS_MAP).find(q => QUARTERS_MAP[q].includes(targetMonth));
        } else if (targetQuarter && !targetMonth) {
            if (!QUARTERS_MAP[targetQuarter].includes(actualCurrentMonth)) {
                targetMonth = QUARTERS_MAP[targetQuarter][2]; 
            } else {
                targetMonth = actualCurrentMonth;
            }
        } else if (!targetQuarter && !targetMonth) {
            targetMonth = actualCurrentMonth;
            targetQuarter = Object.keys(QUARTERS_MAP).find(q => QUARTERS_MAP[q].includes(targetMonth));
        }
        
        const quarterMonths = QUARTERS_MAP[targetQuarter] || [];
        const isH1 = QUARTERS_MAP['الربع الاول'].includes(targetMonth) || QUARTERS_MAP['الربع الثاني'].includes(targetMonth);
        const targetHalfMonths = isH1 ? MONTHS_LIST.slice(0, 6) : MONTHS_LIST.slice(6, 12);

        const groupedData = [];

        filteredPlans.forEach(p => {
            if (outcome && p.expectedOutcome !== outcome) return;

            const outcomeGroup = {
                outcomeName: p.expectedOutcome || 'نتيجة غير محددة',
                levelInfo: (p.level || 'federal') === 'federal' ? 'خطة اتحادية' : `خطة ولائية - ${STATE_LOCALITIES[p.state]?.ar || p.state || 'غير محدد'}`,
                rows: []
            };

            p.interventions?.forEach(inv => {
                if (axis && inv.axis !== axis) return;
                
                if (quarter) {
                    const qKey = quarter === 'الربع الاول' ? 'q1' : quarter === 'الربع الثاني' ? 'q2' : quarter === 'الربع الثالث' ? 'q3' : 'q4';
                    if (!inv[qKey]) return; 
                } else if (month) {
                    const qKey = targetQuarter === 'الربع الاول' ? 'q1' : targetQuarter === 'الربع الثاني' ? 'q2' : targetQuarter === 'الربع الثالث' ? 'q3' : 'q4';
                    if (!inv[qKey]) return;
                }

                totalBudget += Number(inv.totalCost || 0);
                totalGap += calculateGap(inv);
                
                let achievedMonthly = 0;
                let achievedQuarterly = 0;
                let achievedSemiAnnual = 0;
                let achievedAnnual = 0;
                let actualCost = 0;
                
                filteredOpPlans.filter(op => op.planType === PLAN_TYPES.WEEKLY || op.planType === PLAN_TYPES.MONTHLY).forEach(opExec => {
                    if (week && opExec.planType === PLAN_TYPES.WEEKLY && opExec.periodWeek !== week) return; 
                    if (week && opExec.planType === PLAN_TYPES.MONTHLY) return; 

                    const isCurrentMonth = opExec.periodMonth === targetMonth;
                    const isCurrentQuarter = quarterMonths.includes(opExec.periodMonth);
                    const isCurrentHalf = targetHalfMonths.includes(opExec.periodMonth);

                    opExec.activities?.filter(a => a.interventionId === inv.id).forEach(a => {
                        const val = Number(a.achieved || 0);
                        achievedAnnual += val;
                        if (isCurrentMonth) achievedMonthly += val;
                        if (isCurrentQuarter) achievedQuarterly += val;
                        if (isCurrentHalf) achievedSemiAnnual += val;
                        actualCost += Number(a.actualCost || 0);
                    });
                });
                
                totalActualCost += actualCost;

                outcomeGroup.rows.push({
                    id: inv.id,
                    type: 'مخطط',
                    axis: inv.axis,
                    name: inv.name,
                    indicator: inv.indicator,
                    target: inv.target,
                    budget: inv.totalCost,
                    achievedMonthly,
                    achievedQuarterly,
                    achievedSemiAnnual,
                    achievedAnnual,
                    actualCost
                });
            });

            if (outcomeGroup.rows.length > 0) {
                groupedData.push(outcomeGroup);
            }
        });

        const unplannedMap = {};
        filteredOpPlans.forEach(op => {
            op.activities?.filter(a => a.isUnplanned).forEach(a => {
                if (axis && a.axis !== axis) return; 
                
                if (!unplannedMap[a.interventionId]) {
                    unplannedMap[a.interventionId] = {
                        id: a.interventionId,
                        type: 'غير مخطط',
                        axis: a.axis || 'غير محدد',
                        name: a.name || 'نشاط غير مخطط',
                        indicator: a.indicator || '-',
                        target: 0,
                        budget: 0,
                        achievedMonthly: 0,
                        achievedQuarterly: 0,
                        achievedSemiAnnual: 0,
                        achievedAnnual: 0,
                        actualCost: 0,
                        opQuarter: op.periodQuarter,
                        opMonth: op.periodMonth,
                        levelInfo: (op.level || 'federal') === 'federal' ? 'خطة اتحادية' : `خطة ولائية - ${STATE_LOCALITIES[op.state]?.ar || op.state || 'غير محدد'}`,
                    };
                }
                
                if (op.planType === PLAN_TYPES.MONTHLY || op.planType === PLAN_TYPES.QUARTERLY) {
                    if (op.planType === PLAN_TYPES.MONTHLY) {
                        unplannedMap[a.interventionId].target += Number(a.target || 0);
                        unplannedMap[a.interventionId].budget += Number(a.totalCost || 0);
                        totalBudget += Number(a.totalCost || 0);
                        totalGap += calculateGap(a);
                    }
                }
                
                if (op.planType === PLAN_TYPES.WEEKLY || op.planType === PLAN_TYPES.MONTHLY) {
                    if (week && op.planType === PLAN_TYPES.WEEKLY && op.periodWeek !== week) return;
                    if (week && op.planType === PLAN_TYPES.MONTHLY) return;

                    const isCurrentMonth = op.periodMonth === targetMonth;
                    const isCurrentQuarter = quarterMonths.includes(op.periodMonth);
                    const isCurrentHalf = targetHalfMonths.includes(op.periodMonth);

                    const val = Number(a.achieved || 0);
                    unplannedMap[a.interventionId].achievedAnnual += val;
                    if (isCurrentMonth) unplannedMap[a.interventionId].achievedMonthly += val;
                    if (isCurrentQuarter) unplannedMap[a.interventionId].achievedQuarterly += val;
                    if (isCurrentHalf) unplannedMap[a.interventionId].achievedSemiAnnual += val;

                    unplannedMap[a.interventionId].actualCost += Number(a.actualCost || 0);
                    totalActualCost += Number(a.actualCost || 0);
                    
                    if (op.planType === PLAN_TYPES.WEEKLY && unplannedMap[a.interventionId].target === 0) {
                        unplannedMap[a.interventionId].target += Number(a.target || 0);
                        unplannedMap[a.interventionId].budget += Number(a.totalCost || 0);
                        totalBudget += Number(a.totalCost || 0);
                        totalGap += calculateGap(a);
                    }
                }
            });
        });

        const unplannedRows = Object.values(unplannedMap).filter(r => {
             if (quarter && r.opQuarter && r.opQuarter !== quarter && !quarterMonths.includes(r.opMonth)) return false;
             if (month && r.opMonth && r.opMonth !== month) return false;
             return true;
        });

        if (unplannedRows.length > 0) {
            groupedData.push({
                outcomeName: 'أنشطة مستحدثة (خارج النتيجة / غير مخططة)',
                levelInfo: 'مختلط (الاتحادي والولائي)',
                rows: unplannedRows
            });
        }

        let totalActivities = 0;
        let fullyCompleted = 0;
        let partiallyCompleted = 0;
        let notImplemented = 0;

        groupedData.forEach(group => {
            group.rows.forEach(row => {
                totalActivities++;
                const p = row.target > 0 ? (row.achievedAnnual / row.target) * 100 : 0;
                if (p >= 100) fullyCompleted++;
                else if (p > 0) partiallyCompleted++;
                else notImplemented++;
            });
        });

        const meanPerMonth = totalActivities > 0 ? (totalActivities / 12).toFixed(1) : 0;

        return { 
            groupedData, totalBudget, totalGap, totalActualCost, 
            totalActivities, meanPerMonth, fullyCompleted, partiallyCompleted, notImplemented 
        };
    };

    const FormattedAchieved = ({ achieved, target }) => {
        const p = target > 0 ? Math.round((achieved / target) * 100) : 0;
        return (
            <div className="flex items-center justify-center gap-1.5">
                <span className="font-bold text-gray-800 text-sm">{achieved}</span>
                <span className={`text-[10px] font-bold px-1 rounded-sm ${p >= 100 ? 'bg-green-100 text-green-700' : p > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p}%
                </span>
            </div>
        );
    };

    const exportEvaluationPDF = (evalData) => {
        const doc = new jsPDF('landscape', 'mm', 'a4');
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');

        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.setFontSize(18);
        doc.text(`تقرير التقييم: ${globalFilter.year} - ${globalFilter.level === 'federal' ? 'القومي' : (STATE_LOCALITIES[globalFilter.state]?.ar || 'كل الولايات')}`, pageWidth - 14, 15, { align: 'right' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`إجمالي الأنشطة المشمولة: ${evalData.totalActivities}`, pageWidth - 14, 25, { align: 'right' });
        doc.text(`إجمالي الميزانية: ${evalData.totalBudget.toLocaleString()}`, pageWidth - 70, 25, { align: 'right' });
        doc.text(`المنصرف الفعلي: ${evalData.totalActualCost.toLocaleString()}`, pageWidth - 130, 25, { align: 'right' });
        
        const head = [['المنصرف الفعلي', 'الميزانية السنوية', '% الكلي', 'الإنجاز السنوي', 'الإنجاز النصف سنوي', 'الإنجاز الربعي', 'الإنجاز الشهري', 'المستهدف السنوي', 'النوع', 'المحور', 'النشاط']];
        
        const body = [];
        evalData.groupedData.forEach(group => {
            body.push([{ content: `النتيجة المتوقعة: ${group.outcomeName} (${group.levelInfo})`, colSpan: 11, styles: { halign: 'right', fillColor: [224, 242, 254], textColor: [12, 74, 110], fontStyle: 'normal' } }]);
            
            group.rows.forEach(row => {
                const perc = row.target > 0 ? Math.round((row.achievedAnnual / row.target) * 100) : 0;
                let typeText = row.type === 'غير مخطط' ? 'غير مخطط' : 'مخطط';
                
                body.push([
                    row.actualCost.toLocaleString(),
                    row.budget.toLocaleString(),
                    `${perc}%`,
                    row.achievedAnnual.toString(),
                    row.achievedSemiAnnual.toString(),
                    row.achievedQuarterly.toString(),
                    row.achievedMonthly.toString(),
                    row.target.toString(),
                    typeText,
                    row.axis,
                    row.name
                ]);
            });
        });

        autoTable(doc, {
            head: head,
            body: body,
            startY: 32,
            theme: 'grid',
            styles: { font: 'Amiri', fontStyle: 'normal', halign: 'right', fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], halign: 'center', fontStyle: 'normal' },
            columnStyles: {
                10: { halign: 'right', cellWidth: 60 }, 
                9: { halign: 'center', cellWidth: 20 },  
                8: { halign: 'center' }, 
                7: { halign: 'center', textColor: [67, 56, 202] }, 
                6: { halign: 'center' }, 
                5: { halign: 'center' }, 
                4: { halign: 'center' }, 
                3: { halign: 'center', textColor: [21, 128, 61] }, 
                2: { halign: 'center' }, 
                1: { halign: 'center' }, 
                0: { halign: 'center', textColor: [185, 28, 28] } 
            },
            didParseCell: (data) => {
                data.cell.styles.font = 'Amiri';
            }
        });

        doc.save(`Evaluation_Report_${globalFilter.year}.pdf`);
    };

    const exportEvaluationExcel = (evalData) => {
        const rows = [];
        
        rows.push({
            'النتيجة المتوقعة': `تقرير تقييم الخطة الشامل (${globalFilter.year})`,
            'النشاط': '', 'المحور': '', 'النوع': '', 'المستهدف السنوي': '', 'الإنجاز الشهري': '', 'الإنجاز الربعي': '', 'الإنجاز النصف سنوي': '', 'الإنجاز السنوي': '', 'نسبة الإنجاز الكلي (%)': '', 'الميزانية السنوية': '', 'المنصرف الفعلي': ''
        });
        rows.push({});

        evalData.groupedData.forEach(group => {
            rows.push({
                'النتيجة المتوقعة': `النتيجة: ${group.outcomeName} (${group.levelInfo})`,
                'النشاط': '', 'المحور': '', 'النوع': '', 'المستهدف السنوي': '', 'الإنجاز الشهري': '', 'الإنجاز الربعي': '', 'الإنجاز النصف سنوي': '', 'الإنجاز السنوي': '', 'نسبة الإنجاز الكلي (%)': '', 'الميزانية السنوية': '', 'المنصرف الفعلي': ''
            });

            group.rows.forEach(row => {
                const perc = row.target > 0 ? Math.round((row.achievedAnnual / row.target) * 100) : 0;
                rows.push({
                    'النتيجة المتوقعة': '', 
                    'النشاط': row.name,
                    'المحور': row.axis,
                    'النوع': row.type,
                    'المستهدف السنوي': row.target,
                    'الإنجاز الشهري': row.achievedMonthly,
                    'الإنجاز الربعي': row.achievedQuarterly,
                    'الإنجاز النصف سنوي': row.achievedSemiAnnual,
                    'الإنجاز السنوي': row.achievedAnnual,
                    'نسبة الإنجاز الكلي (%)': perc,
                    'الميزانية السنوية': row.budget,
                    'المنصرف الفعلي': row.actualCost
                });
            });
        });

        if (rows.length === 0) {
            alert("لا توجد بيانات لتصديرها");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!views'] = [{ rightToLeft: true }];
        ws['!cols'] = [ { wch: 40 }, { wch: 50 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 } ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "تقرير التقييم الشامل");
        XLSX.writeFile(wb, `Evaluation_Report_${globalFilter.year}.xlsx`);
    };

    // ==========================================
    // EDIT MODALS (MATRIX, OP PLAN, TRACKING)
    // ==========================================
    if (isEditingMatrix && currentPlan) {
        return (
            <div className="fixed inset-0 z-40 bg-gray-100 flex flex-col" dir="rtl">
                <div className="bg-white shadow px-4 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 border-b gap-3">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2"><Briefcase className="text-sky-600"/> إدخال مصفوفة الخطة السنوية الاستراتيجية</h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">يتم إدخال الجدولة وتفاصيل الدعم بالضغط على الخلايا المخصصة لفتح نوافذ الإدخال.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setIsEditingMatrix(false)}><X size={16} className="ml-1"/> إغلاق</Button>
                        <Button className="flex-1 sm:flex-none" onClick={handleSaveMasterPlan}><Save size={16} className="ml-1"/> حفظ المصفوفة</Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 sm:p-4 relative">
                    <div className="bg-white rounded-lg shadow-sm border mb-4 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
                        <FormGroup label="السنة">
                            <Select value={currentPlan.year} onChange={(e) => setCurrentPlan({...currentPlan, year: Number(e.target.value)})} className="font-bold border-sky-300 w-full">
                                {YEAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="المستوى">
                            <Select value={currentPlan.level} onChange={(e) => setCurrentPlan({...currentPlan, level: e.target.value, state: e.target.value === 'federal' ? '' : currentPlan.state})} disabled={!isFederalManager} className="w-full">
                                <option value="federal">اتحادي (قومي)</option>
                                <option value="state">ولائي</option>
                            </Select>
                        </FormGroup>
                        {currentPlan.level === 'state' && (
                            <FormGroup label="الولاية">
                                <Select value={currentPlan.state} onChange={(e) => setCurrentPlan({...currentPlan, state: e.target.value})} disabled={!isFederalManager && userStates.length === 1} className="w-full">
                                    <option value="">-- اختر --</option>
                                    {isFederalManager ? 
                                        Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar || s}</option>) :
                                        userStates.map(s => <option key={s} value={s}>{STATE_LOCALITIES[s]?.ar || s}</option>)
                                    }
                                </Select>
                            </FormGroup>
                        )}
                        <FormGroup label="النتيجة المتوقعة (الأساس)" className="md:col-span-2">
                            <Select value={currentPlan.expectedOutcome} onChange={(e) => setCurrentPlan({...currentPlan, expectedOutcome: e.target.value})} className="font-bold border-sky-300 w-full">
                                {OUTCOME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>
                    </div>

                    <div className="bg-white border shadow-sm w-full relative overflow-x-auto rounded-t-lg">
                        <table className="w-full table-fixed border-collapse text-[10px] sm:text-xs text-right whitespace-normal min-w-[800px]">
                            <thead className="bg-slate-800 text-white font-bold">
                                <tr>
                                    <th className="w-[12%] p-1.5 border border-slate-600">المحور</th>
                                    <th className="w-[20%] p-1.5 border border-slate-600">النشاط</th>
                                    <th className="w-[15%] p-1.5 border border-slate-600">المؤشر</th>
                                    <th className="w-[6%] p-1.5 border border-slate-600 text-center">الأساس</th>
                                    <th className="w-[6%] p-1.5 border border-slate-600 text-center">الهدف</th>
                                    <th className="w-[8%] p-1.5 border border-slate-600 text-center bg-green-900">الجدولة</th>
                                    <th className="w-[10%] p-1.5 border border-slate-600 text-center">التكلفة الإجمالية</th>
                                    <th className="w-[10%] p-1.5 border border-slate-600 text-center bg-indigo-900">مصادر التمويل</th>
                                    <th className="w-[8%] p-1.5 border border-slate-600 text-center bg-red-900">العجز (Gap)</th>
                                    <th className="w-[5%] p-1.5 border border-slate-600 text-center">حذف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentPlan.interventions?.map((inv, idx) => {
                                    const gap = calculateGap(inv);
                                    const totalSupport = (Number(inv.govValue)||0) + (Number(inv.extValue1)||0) + (Number(inv.extValue2)||0) + (Number(inv.extValue3)||0);
                                    const update = (field, val) => updateMasterPlanIntervention(idx, field, val);
                                    
                                    const cellClass = "p-0 border border-slate-300 relative focus-within:ring-1 focus-within:ring-sky-500 focus-within:z-10 align-top";
                                    const inputClass = "w-full h-full min-h-[32px] px-1 py-1 bg-transparent border-0 outline-none text-right whitespace-normal break-words resize-none overflow-hidden";
                                    
                                    return (
                                    <tr key={inv.id} className="hover:bg-sky-50 transition-colors bg-white">
                                        <td className={cellClass}><select className={`${inputClass} text-xs`} value={inv.axis} onChange={(e) => update('axis', e.target.value)}>{AXIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></td>
                                        <td className={cellClass}><textarea className={`${inputClass} font-bold h-full`} rows={2} value={inv.name} onChange={(e) => update('name', e.target.value)} placeholder="نشاط..." required /></td>
                                        <td className={cellClass}><SelectWithOther options={INDICATOR_OPTIONS} value={inv.indicator} onChange={(val) => update('indicator', val)} placeholder="- اختر مؤشر -" otherLabel="اخرى حدد" /></td>
                                        <td className={cellClass}><input type="number" className={`${inputClass} text-center`} value={inv.baseline} onChange={(e) => update('baseline', e.target.value)} /></td>
                                        <td className={cellClass}><input type="number" className={`${inputClass} text-center font-bold`} value={inv.target} onChange={(e) => update('target', e.target.value)} /></td>
                                        
                                        <td className={`${cellClass} text-center align-middle bg-green-50/50 p-1`}>
                                            <button type="button" onClick={() => setScheduleModalIdx(idx)} className="w-full min-h-[30px] rounded text-[10px] font-bold text-green-700 bg-white border border-green-300 hover:bg-green-100 transition-colors shadow-sm cursor-pointer">
                                                {inv.q1 || inv.q2 || inv.q3 || inv.q4 ? 
                                                    [inv.q1&&'ر1', inv.q2&&'ر2', inv.q3&&'ر3', inv.q4&&'ر4'].filter(Boolean).join('، ') 
                                                    : '+ الجدولة'}
                                            </button>
                                        </td>
                                        
                                        <td className={cellClass}><input type="number" className={`${inputClass} text-center font-bold bg-gray-50`} value={inv.totalCost} onChange={(e) => update('totalCost', e.target.value)} /></td>
                                        
                                        <td className={`${cellClass} text-center align-middle bg-indigo-50/30 p-1`}>
                                            <button type="button" onClick={() => setSupportModalIdx(idx)} className="w-full min-h-[30px] rounded text-[10px] font-bold text-indigo-700 bg-white border border-indigo-300 hover:bg-indigo-100 transition-colors shadow-sm cursor-pointer">
                                                {totalSupport > 0 ? `دعم (${totalSupport.toLocaleString()})` : '+ إضافة تمويل'}
                                            </button>
                                        </td>

                                        <td className={`p-1 border border-slate-300 text-center font-bold align-middle ${gap > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                            {gap.toLocaleString()}
                                        </td>
                                        <td className="p-1 border border-slate-300 text-center align-middle">
                                            <button type="button" onClick={() => setCurrentPlan({...currentPlan, interventions: currentPlan.interventions.filter(i => i.id !== inv.id)})} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition shadow-sm border border-transparent hover:border-red-200">
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-2 border border-t-0 border-slate-300 bg-slate-50 flex justify-center rounded-b-lg">
                        <Button type="button" size="sm" variant="secondary" onClick={() => setCurrentPlan({...currentPlan, interventions: [...(currentPlan.interventions||[]), DEFAULT_INTERVENTION()]})}><Plus size={16} className="ml-1"/> إضافة نشاط جديد</Button>
                    </div>

                    {/* --- Matrix Pop-ups --- */}
                    
                    {/* Schedule Modal */}
                    {scheduleModalIdx !== null && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in zoom-in-95">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200">
                                <div className="bg-slate-800 p-3.5 flex justify-between items-center text-white border-b border-slate-700">
                                    <h3 className="font-bold flex items-center gap-2"><Calendar size={18} className="text-green-400"/> جدولة النشاط (الأرباع)</h3>
                                    <button type="button" onClick={() => setScheduleModalIdx(null)} className="text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-1 rounded-full transition-colors"><X size={18}/></button>
                                </div>
                                <div className="p-6">
                                    <p className="text-xs text-gray-500 mb-4 text-center">حدد الفترات الزمنية لتنفيذ هذا النشاط:</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {['q1', 'q2', 'q3', 'q4'].map((q, i) => (
                                            <label key={q} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${currentPlan.interventions[scheduleModalIdx][q] ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                                                <input type="checkbox" className="w-5 h-5 accent-green-600 rounded" 
                                                    checked={currentPlan.interventions[scheduleModalIdx][q]}
                                                    onChange={(e) => updateMasterPlanIntervention(scheduleModalIdx, q, e.target.checked)}
                                                />
                                                <span className={`font-bold ${currentPlan.interventions[scheduleModalIdx][q] ? 'text-green-800' : 'text-gray-700'}`}>الربع {i+1}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end">
                                    <Button type="button" onClick={() => setScheduleModalIdx(null)} className="px-6">تأكيد الجدولة</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Support & Funding Modal */}
                    {supportModalIdx !== null && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in zoom-in-95">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200">
                                <div className="bg-indigo-900 p-3.5 flex justify-between items-center text-white border-b border-indigo-800">
                                    <h3 className="font-bold flex items-center gap-2"><Briefcase size={18} className="text-indigo-300"/> مصادر الدعم والتمويل</h3>
                                    <button type="button" onClick={() => setSupportModalIdx(null)} className="text-indigo-200 hover:text-white bg-indigo-800/50 hover:bg-indigo-800 p-1 rounded-full transition-colors"><X size={18}/></button>
                                </div>
                                <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto bg-slate-50/50">
                                    {/* Government Support */}
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200 shadow-sm">
                                        <h4 className="font-bold text-blue-800 mb-3 text-sm flex items-center gap-2">الدعم الحكومي (مشاريع الدولة)</h4>
                                        <div className="grid grid-cols-5 gap-3">
                                            <div className="col-span-3">
                                                <label className="text-[10px] text-gray-500 font-bold mb-1 block">اسم المشروع</label>
                                                <SelectWithOther options={GOV_PROJECT_OPTIONS} value={currentPlan.interventions[supportModalIdx].govSource} onChange={(val) => updateMasterPlanIntervention(supportModalIdx, 'govSource', val)} placeholder="- اختر أو اكتب -" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] text-gray-500 font-bold mb-1 block">القيمة (المبلغ)</label>
                                                <input type="number" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-bold text-blue-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-left" dir="ltr" value={currentPlan.interventions[supportModalIdx].govValue} onChange={(e) => updateMasterPlanIntervention(supportModalIdx, 'govValue', e.target.value)} placeholder="0" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* External Partners Support */}
                                    <div className="space-y-3">
                                        <h4 className="font-bold text-orange-800 text-sm mb-1 px-1">دعم الشركاء والمنظمات</h4>
                                        {[1, 2, 3].map(num => (
                                            <div key={num} className="bg-orange-50/50 p-3.5 rounded-lg border border-orange-200 shadow-sm flex flex-col sm:flex-row gap-3 items-end">
                                                <div className="flex-1 w-full">
                                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">الشريك {num}</label>
                                                    <SelectWithOther options={PARTNER_SUPPORT_OPTIONS} value={currentPlan.interventions[supportModalIdx][`extSource${num}`]} onChange={(val) => updateMasterPlanIntervention(supportModalIdx, `extSource${num}`, val)} placeholder="- اختر الشريك -" />
                                                </div>
                                                <div className="w-full sm:w-1/3">
                                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">قيمة الدعم</label>
                                                    <input type="number" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-bold text-orange-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-left" dir="ltr" value={currentPlan.interventions[supportModalIdx][`extValue${num}`]} onChange={(e) => updateMasterPlanIntervention(supportModalIdx, `extValue${num}`, e.target.value)} placeholder="0" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white p-4 border-t border-slate-200 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 relative">
                                     <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 font-bold">العجز المتبقي (Gap)</span>
                                        <span className={`font-bold text-lg ${calculateGap(currentPlan.interventions[supportModalIdx]) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {calculateGap(currentPlan.interventions[supportModalIdx]).toLocaleString()}
                                        </span>
                                     </div>
                                    <Button type="button" onClick={() => setSupportModalIdx(null)} className="px-6">حفظ ومتابعة</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (isEditingOpPlan && currentOpPlan) {
        return (
            <div className="fixed inset-0 z-40 bg-gray-100 flex flex-col" dir="rtl">
                <div className="bg-white shadow px-4 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 border-b gap-3">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2"><Calendar className="text-sky-600"/> إعداد خطة العمل التشغيلية - {currentOpPlan.planType}</h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">يتم إدخال مصادر التمويل والدعم لكل نشاط عبر النوافذ المنبثقة.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setIsEditingOpPlan(false)}><X size={16} className="ml-1"/> إغلاق</Button>
                        <Button className="flex-1 sm:flex-none" onClick={handleSaveOpPlan}><Save size={16} className="ml-1"/> حفظ الخطة</Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4 sm:space-y-6 relative">
                    <div className="bg-white p-4 rounded-lg border shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <FormGroup label="نوع الخطة">
                            <div className="font-bold text-indigo-800 p-2 bg-indigo-100 rounded text-center border border-indigo-200">{currentOpPlan.planType}</div>
                        </FormGroup>
                        <FormGroup label="السنة">
                            <Select value={currentOpPlan.year} onChange={(e) => setCurrentOpPlan({...currentOpPlan, year: Number(e.target.value)})}>
                                {YEAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="المستوى">
                            <Select value={currentOpPlan.level} onChange={(e) => setCurrentOpPlan({...currentOpPlan, level: e.target.value, state: e.target.value === 'federal' ? '' : currentOpPlan.state})} disabled={!isFederalManager}>
                                <option value="federal">اتحادي</option>
                                <option value="state">ولائي</option>
                            </Select>
                        </FormGroup>
                        {currentOpPlan.level === 'state' && (
                            <FormGroup label="الولاية">
                                <Select value={currentOpPlan.state} onChange={(e) => setCurrentOpPlan({...currentOpPlan, state: e.target.value})} disabled={!isFederalManager && userStates.length === 1}>
                                    <option value="">-- اختر --</option>
                                    {isFederalManager ? 
                                        Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar || s}</option>) :
                                        userStates.map(s => <option key={s} value={s}>{STATE_LOCALITIES[s]?.ar || s}</option>)
                                    }
                                </Select>
                            </FormGroup>
                        )}

                        {currentOpPlan.planType === PLAN_TYPES.QUARTERLY && (
                            <FormGroup label="الربع">
                                <Select value={currentOpPlan.periodQuarter} onChange={(e) => setCurrentOpPlan({...currentOpPlan, periodQuarter: e.target.value})}>
                                    <option value="">-- اختر --</option>
                                    {QUARTERS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                        )}
                        {(currentOpPlan.planType === PLAN_TYPES.MONTHLY || currentOpPlan.planType === PLAN_TYPES.WEEKLY) && (
                            <FormGroup label="الشهر">
                                <Select value={currentOpPlan.periodMonth} onChange={(e) => setCurrentOpPlan({...currentOpPlan, periodMonth: e.target.value})}>
                                    <option value="">-- اختر --</option>
                                    {MONTHS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                        )}
                        {currentOpPlan.planType === PLAN_TYPES.WEEKLY && (
                            <FormGroup label="الأسبوع">
                                <Select value={currentOpPlan.periodWeek} onChange={(e) => setCurrentOpPlan({...currentOpPlan, periodWeek: e.target.value})}>
                                    <option value="">-- اختر --</option>
                                    {WEEKS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                        )}
                    </div>

                    <div className="bg-white rounded-lg border shadow-sm w-full relative">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border-b bg-gray-50 gap-2">
                            <h4 className="font-bold text-gray-700 text-sm sm:text-base">تحديد الأنشطة والميزانية للفترة المحددة</h4>
                            <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => setCurrentOpPlan({...currentOpPlan, activities: [...(currentOpPlan.activities||[]), DEFAULT_OP_ACTIVITY()]})}>
                                <Plus size={16} className="ml-1"/> إضافة نشاط
                            </Button>
                        </div>
                        
                        <div className="overflow-x-auto w-full pb-16">
                            <table className="w-full table-fixed border-collapse text-[10px] sm:text-xs text-right whitespace-normal min-w-[900px]">
                                <thead className="bg-slate-800 text-white font-bold">
                                    <tr>
                                        <th className="w-[6%] p-1.5 border border-slate-600 text-center">النوع</th>
                                        <th className="w-[18%] p-1.5 border border-slate-600 text-center">الخطة / المحور</th>
                                        <th className="w-[20%] p-1.5 border border-slate-600 text-center">النشاط</th>
                                        <th className="w-[12%] p-1.5 border border-slate-600 text-center text-[10px]">المؤسسات المستهدفة</th>
                                        <th className="w-[10%] p-1.5 border border-slate-600 text-center">المؤشر</th>
                                        <th className="w-[6%] p-1.5 border border-slate-600 text-center">الهدف</th>
                                        <th className="w-[8%] p-1.5 border border-slate-600 text-center">التكلفة الإجمالية</th>
                                        <th className="w-[10%] p-1.5 border border-slate-600 text-center bg-indigo-900">مصادر التمويل</th>
                                        <th className="w-[8%] p-1.5 border border-slate-600 text-center bg-red-900">العجز</th>
                                        <th className="w-[5%] p-1.5 border border-slate-600 text-center">حذف</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentOpPlan.activities?.map((act, idx) => {
                                        const gap = calculateGap(act);
                                        const totalSupport = (Number(act.govValue)||0) + (Number(act.extValue1)||0) + (Number(act.extValue2)||0) + (Number(act.extValue3)||0);
                                        const update = (field, val) => updateOpPlanActivity(idx, field, val);
                                        
                                        const cellClass = "p-0 border border-slate-300 relative focus-within:ring-1 focus-within:ring-sky-500 focus-within:z-10 align-top";
                                        const inputClass = "w-full h-full min-h-[32px] px-1 py-1 bg-transparent border-0 outline-none text-right whitespace-normal break-words resize-none overflow-hidden";
                                        
                                        const availableMasterPlans = getAvailableMasterPlans(act);
                                        const availableInvs = getAvailableInterventions(act);

                                        return (
                                            <tr key={act.id} className={`hover:bg-slate-50 transition-colors ${act.isUnplanned ? 'bg-amber-50/30' : 'bg-white'}`}>
                                                <td className={`${cellClass} text-center align-middle p-1`}>
                                                    <label className="flex flex-col items-center justify-center gap-1 text-[9px] font-bold cursor-pointer text-amber-700">
                                                        <input type="checkbox" className="w-4 h-4 cursor-pointer rounded" checked={act.isUnplanned} onChange={(e) => {
                                                            const newActs = [...currentOpPlan.activities];
                                                            newActs[idx].isUnplanned = e.target.checked;
                                                            if(e.target.checked) {
                                                                newActs[idx].masterPlanId = '';
                                                                newActs[idx].interventionId = `unp_${Date.now()}_${idx}`;
                                                            } else {
                                                                newActs[idx].interventionId = '';
                                                            }
                                                            setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                        }} />
                                                        غير مخطط
                                                    </label>
                                                </td>

                                                <td className={cellClass}>
                                                    {act.isUnplanned ? (
                                                        <select className={`${inputClass} text-xs`} value={act.axis} onChange={(e) => update('axis', e.target.value)}>
                                                            <option value="">- المحور -</option>
                                                            {AXIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                        </select>
                                                    ) : (
                                                        <select className={`${inputClass} text-[10px]`} value={act.masterPlanId} onChange={(e) => {
                                                            const newActs = [...currentOpPlan.activities];
                                                            newActs[idx].masterPlanId = e.target.value;
                                                            newActs[idx].interventionId = '';
                                                            setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                        }}>
                                                            <option value="">- اختر النتيجة -</option>
                                                            {availableMasterPlans.map(p => <option key={p.id} value={p.id}>{p.expectedOutcome}</option>)}
                                                        </select>
                                                    )}
                                                </td>

                                                <td className={cellClass}>
                                                    {act.isUnplanned ? (
                                                        <textarea className={`${inputClass} font-bold h-full bg-white`} rows={2} value={act.name} onChange={(e) => update('name', e.target.value)} placeholder="اسم النشاط..." />
                                                    ) : (
                                                        <select className={`${inputClass} font-bold text-[10px]`} value={act.interventionId} onChange={(e) => {
                                                            const newActs = [...currentOpPlan.activities];
                                                            newActs[idx].interventionId = e.target.value;
                                                            const selInv = availableInvs.find(i => i.id === e.target.value);
                                                            if (selInv) {
                                                                newActs[idx].indicator = selInv.indicator;
                                                            }
                                                            setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                        }} disabled={!act.masterPlanId}>
                                                            <option value="">- اختر النشاط المتاح -</option>
                                                            {availableInvs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                        </select>
                                                    )}
                                                </td>
                                                
                                                <td className={cellClass}>
                                                    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto max-h-[50px] p-1 gap-1 min-h-[40px]">
                                                        <div className="flex flex-wrap gap-1">
                                                            {(act.targetFacilities || []).map(facility => (
                                                                <span key={facility} className="text-[8px] bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded flex items-center gap-1 border border-indigo-200 shadow-sm">
                                                                    {facility}
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => update('targetFacilities', act.targetFacilities.filter(f => f !== facility))} 
                                                                        className="text-red-500 font-bold hover:text-red-700 hover:bg-red-50 px-0.5 rounded"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <select 
                                                            className="w-full text-[9px] bg-white border border-gray-300 mt-auto outline-none cursor-pointer rounded p-0.5" 
                                                            value=""
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val && !(act.targetFacilities || []).includes(val)) {
                                                                    update('targetFacilities', [...(act.targetFacilities || []), val]);
                                                                }
                                                            }}
                                                        >
                                                            <option value="">+ اختيار مؤسسة</option>
                                                            {dynamicFacilityOptions.filter(f => !(act.targetFacilities || []).includes(f)).map(f => (
                                                                <option key={f} value={f}>{f}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </td>

                                                <td className={cellClass}>
                                                    {act.isUnplanned ? (
                                                        <SelectWithOther options={INDICATOR_OPTIONS} value={act.indicator} onChange={(val) => update('indicator', val)} placeholder="- مؤشر -" />
                                                    ) : (
                                                        <div className="w-full h-full min-h-[32px] px-1 py-1 text-gray-600 bg-gray-50 flex items-center text-[10px]">
                                                            {act.indicator || '-'}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className={cellClass}><input type="number" className={`${inputClass} text-center font-bold`} value={act.target} onChange={(e) => update('target', e.target.value)} placeholder="0" /></td>
                                                <td className={cellClass}><input type="number" className={`${inputClass} text-center font-bold bg-gray-50`} value={act.totalCost} onChange={(e) => update('totalCost', e.target.value)} placeholder="0" /></td>
                                                
                                                <td className={`${cellClass} text-center align-middle bg-indigo-50/30 p-1`}>
                                                    <button type="button" onClick={() => setOpSupportModalIdx(idx)} className="w-full min-h-[30px] rounded text-[10px] font-bold text-indigo-700 bg-white border border-indigo-300 hover:bg-indigo-100 transition-colors shadow-sm cursor-pointer">
                                                        {totalSupport > 0 ? `دعم (${totalSupport.toLocaleString()})` : '+ إضافة تمويل'}
                                                    </button>
                                                </td>

                                                <td className={`p-1 border border-slate-300 text-center font-bold align-middle ${gap > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                    {gap.toLocaleString()}
                                                </td>

                                                <td className="p-1 border border-slate-300 text-center align-middle">
                                                    <button type="button" onClick={() => setCurrentOpPlan({...currentOpPlan, activities: currentOpPlan.activities.filter(item => item.id !== act.id)})} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition-colors border border-transparent hover:border-red-200 shadow-sm" title="حذف النشاط">
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {currentOpPlan.activities?.length === 0 && (
                                <div className="text-center text-sm text-gray-500 p-8 border border-t-0 border-slate-300 bg-white">
                                    لم يتم إضافة أي أنشطة لهذه الخطة بعد.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- Operational Plan Funding Pop-up --- */}
                    {opSupportModalIdx !== null && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in zoom-in-95">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200">
                                <div className="bg-indigo-900 p-3.5 flex justify-between items-center text-white border-b border-indigo-800">
                                    <h3 className="font-bold flex items-center gap-2"><Briefcase size={18} className="text-indigo-300"/> مصادر الدعم (للنشاط التشغيلي)</h3>
                                    <button type="button" onClick={() => setOpSupportModalIdx(null)} className="text-indigo-200 hover:text-white bg-indigo-800/50 hover:bg-indigo-800 p-1 rounded-full transition-colors"><X size={18}/></button>
                                </div>
                                <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto bg-slate-50/50">
                                    
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200 shadow-sm">
                                        <h4 className="font-bold text-blue-800 mb-3 text-sm flex items-center gap-2">الدعم الحكومي</h4>
                                        <div className="grid grid-cols-5 gap-3">
                                            <div className="col-span-3">
                                                <label className="text-[10px] text-gray-500 font-bold mb-1 block">المشروع</label>
                                                <SelectWithOther options={GOV_PROJECT_OPTIONS} value={currentOpPlan.activities[opSupportModalIdx].govSource} onChange={(val) => updateOpPlanActivity(opSupportModalIdx, 'govSource', val)} placeholder="- اختر -" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] text-gray-500 font-bold mb-1 block">القيمة</label>
                                                <input type="number" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-bold text-blue-700 focus:border-sky-500 outline-none text-left" dir="ltr" value={currentOpPlan.activities[opSupportModalIdx].govValue} onChange={(e) => updateOpPlanActivity(opSupportModalIdx, 'govValue', e.target.value)} placeholder="0" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <h4 className="font-bold text-orange-800 text-sm mb-1 px-1">دعم الشركاء</h4>
                                        {[1, 2, 3].map(num => (
                                            <div key={num} className="bg-orange-50/50 p-3.5 rounded-lg border border-orange-200 shadow-sm flex flex-col sm:flex-row gap-3 items-end">
                                                <div className="flex-1 w-full">
                                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">الشريك {num}</label>
                                                    <SelectWithOther options={PARTNER_SUPPORT_OPTIONS} value={currentOpPlan.activities[opSupportModalIdx][`extSource${num}`]} onChange={(val) => updateOpPlanActivity(opSupportModalIdx, `extSource${num}`, val)} placeholder="- اختر -" />
                                                </div>
                                                <div className="w-full sm:w-1/3">
                                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">القيمة</label>
                                                    <input type="number" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-bold text-orange-700 focus:border-sky-500 outline-none text-left" dir="ltr" value={currentOpPlan.activities[opSupportModalIdx][`extValue${num}`]} onChange={(e) => updateOpPlanActivity(opSupportModalIdx, `extValue${num}`, e.target.value)} placeholder="0" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white p-4 border-t border-slate-200 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 relative">
                                     <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 font-bold">العجز المتبقي (Gap)</span>
                                        <span className={`font-bold text-lg ${calculateGap(currentOpPlan.activities[opSupportModalIdx]) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {calculateGap(currentOpPlan.activities[opSupportModalIdx]).toLocaleString()}
                                        </span>
                                     </div>
                                    <Button type="button" onClick={() => setOpSupportModalIdx(null)} className="px-6">تأكيد</Button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        );
    }

    if (isEditingTracking && currentOpPlan) {
        return (
            <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col" dir="rtl">
                <div className="bg-white shadow px-4 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 border-b border-green-200 gap-3">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2"><CheckCircle2 className="text-green-600"/> تحديث إنجاز الخطة ({currentOpPlan.planType === PLAN_TYPES.MONTHLY ? 'الشهرية' : 'الأسبوعية'})</h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">{currentOpPlan.periodName} - عام {currentOpPlan.year} ({(currentOpPlan.level || 'federal') === 'federal' ? 'اتحادي' : `ولائي - ${STATE_LOCALITIES[currentOpPlan.state]?.ar || currentOpPlan.state}`})</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setIsEditingTracking(false)}><X size={16} className="ml-1"/> إغلاق</Button>
                        <Button variant="success" className="flex-1 sm:flex-none" onClick={handleSaveTracking}><Save size={16} className="ml-1"/> حفظ الإنجازات</Button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 sm:p-4">
                    <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                        <Table headers={["النشاط", "النوع", "المستهدف", "الأساس المحدث", "المنفذ الفعلي", "التكلفة الفعلية", "نسبة الإنجاز"]}>
                            {getAggregatedData(currentOpPlan).map(a => {
                                const base = getDynamicBaseline(a.masterPlanId, a.interventionId, currentOpPlan.id);
                                const perc = a.target > 0 ? Math.round((a.achieved / a.target) * 100) : 0;
                                
                                let interventionName = 'نشاط غير معروف';
                                if (a.isUnplanned) {
                                    interventionName = a.name;
                                } else {
                                    const masterPlan = filteredPlans.find(p => p.id === a.masterPlanId);
                                    interventionName = masterPlan?.interventions?.find(i => i.id === a.interventionId)?.name || 'نشاط غير معروف';
                                }

                                return (
                                    <tr key={a.id} className={a.isUnplanned ? 'bg-amber-50/20' : ''}>
                                        <td className="p-3 text-sm font-bold w-1/4 break-words whitespace-normal min-w-[200px]">{interventionName}</td>
                                        <td className="p-3 text-center text-xs min-w-[80px]">
                                            {a.isUnplanned ? <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold">غير مخطط</span> : <span className="text-gray-500">مخطط</span>}
                                        </td>
                                        <td className="p-3 text-center font-bold text-indigo-600 min-w-[120px]">{a.target}</td>
                                        <td className="p-3 text-center bg-gray-100/50 text-xs font-medium min-w-[120px]">{base}</td>
                                        <td className="p-3 w-32 min-w-[120px]">
                                            <Input type="number" value={a.achieved || 0} onChange={(e) => handleUpdateWeeklyTracking(a.id, 'achieved', e.target.value)} className="text-center font-bold text-green-700 border-green-200 w-full" />
                                        </td>
                                        <td className="p-3 w-32 min-w-[120px]">
                                            <Input type="number" value={a.actualCost || 0} onChange={(e) => handleUpdateWeeklyTracking(a.id, 'actualCost', e.target.value)} className="text-center w-full" />
                                        </td>
                                        <td className="p-3 min-w-[120px]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div className={`h-2 rounded-full ${perc >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(perc, 100)}%` }}></div>
                                                </div>
                                                <span className="text-xs font-bold w-10">{perc}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading.masterPlans || isLoading.operationalPlans || isLoading.healthFacilities) return <Spinner />;

    const evalData = getFullPlanEvaluation();

    return (
        <div className="space-y-6" dir="rtl">
            <PageHeader 
                title="منظومة التخطيط والمتابعة" 
                subtitle="الخطة الاستراتيجية، الخطط التشغيلية، وتقارير التقييم الشاملة" 
            />

            {/* ==========================================
                GLOBAL FILTER BAR (الموجه الأساسي للنظام)
            ========================================== */}
            <div className="bg-slate-800 p-4 rounded-lg shadow-md mb-6 flex flex-col md:flex-row flex-wrap gap-4 items-start md:items-end text-white">
                <div className="w-full md:flex-1 md:min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-300 mb-1">سنة الخطة (Year)</label>
                    <select className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-2 focus:ring-sky-500 outline-none"
                        value={globalFilter.year}
                        onChange={e => setGlobalFilter({...globalFilter, year: Number(e.target.value)})}
                    >
                        {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="w-full md:flex-1 md:min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-300 mb-1">مستوى التخطيط (Level)</label>
                    <select className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-2 focus:ring-sky-500 outline-none"
                        value={globalFilter.level}
                        onChange={e => setGlobalFilter({...globalFilter, level: e.target.value, state: e.target.value === 'federal' ? '' : globalFilter.state})}
                        disabled={!isFederalManager}
                    >
                        <option value="federal">اتحادي (قومي)</option>
                        <option value="state">ولائي</option>
                    </select>
                </div>
                {globalFilter.level === 'state' && (
                    <div className="w-full md:flex-1 md:min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-300 mb-1">الولاية (State)</label>
                        <select className="w-full bg-slate-700 border-slate-600 font-bold text-white rounded p-2 focus:ring-sky-500 outline-none"
                            value={globalFilter.state}
                            onChange={e => setGlobalFilter({...globalFilter, state: e.target.value})}
                            disabled={!isFederalManager && userStates.length <= 1}
                        >
                            {isFederalManager && <option value="">-- عرض كل الولايات --</option>}
                            {isFederalManager ? 
                                Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar || s}</option>) :
                                userStates.map(s => <option key={s} value={s}>{STATE_LOCALITIES[s]?.ar || s}</option>)
                            }
                        </select>
                    </div>
                )}
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-4 sm:gap-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {[
                        { id: 'master', label: 'الخطة السنوية', icon: TrendingUp },
                        { id: 'quarterly', label: 'الخطط الربعية', icon: Calendar },
                        { id: 'monthly', label: 'الخطط الشهرية', icon: Calendar },
                        { id: 'weekly', label: 'التشغيلية الأسبوعية', icon: FileSpreadsheet },
                        { id: 'tracking', label: 'المتابعة والتنفيذ', icon: CheckCircle2 },
                        { id: 'evaluation', label: 'التقييم', icon: Activity }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors ${
                                activeTab === tab.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* --- Master Plan Tab --- */}
            {activeTab === 'master' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Target className="text-sky-600"/> 
                            الخطة السنوية لعام {globalFilter.year}
                            {globalFilter.level === 'state' && globalFilter.state && ` (${STATE_LOCALITIES[globalFilter.state]?.ar})`}
                        </h3>
                        
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button onClick={openCreateMasterPlan} className="w-full sm:w-auto justify-center">
                                <Plus size={18} className="ml-2"/> إضافة خطة نتيجة
                            </Button>
                        </div>
                    </div>

                    {filteredPlans.length === 0 ? (
                        <EmptyState message="لا توجد خطط سنوية مسجلة مطابقة للبحث." />
                    ) : (
                        <div className="space-y-4">
                            {filteredPlans.map(plan => (
                                <div key={plan.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div 
                                        className="p-4 bg-sky-50 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-sky-100 border-b gap-3"
                                        onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${(plan.level || 'federal') === 'federal' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                                {(plan.level || 'federal') === 'federal' ? 'اتحادي' : `ولائي - ${STATE_LOCALITIES[plan.state]?.ar || plan.state || 'غير محدد'}`}
                                            </span>
                                            <span className="font-bold text-base sm:text-lg text-gray-800">{plan.expectedOutcome}</span>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end">
                                            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setCurrentPlan(plan); setIsEditingMatrix(true); }}><Edit size={14}/></Button>
                                            <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); if(confirm("حذف؟")) deleteMasterPlan(plan.id).then(()=>fetchMasterPlans(true)); }}><Trash2 size={14}/></Button>
                                            {expandedPlanId === plan.id ? <ChevronUp size={20} className="text-gray-500"/> : <ChevronDown size={20} className="text-gray-500"/>}
                                        </div>
                                    </div>
                                    
                                    {expandedPlanId === plan.id && (
                                        <div className="overflow-x-auto p-2 sm:p-4">
                                            <table className="w-full text-xs text-right table-fixed border-collapse min-w-[1000px]">
                                                <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                                    <tr>
                                                        <th className="w-[10%] p-2 border-l border-slate-200">المحور</th>
                                                        <th className="w-[20%] p-2 border-l border-slate-200">النشاط</th>
                                                        <th className="w-[12%] p-2 border-l border-slate-200">المؤشر</th>
                                                        <th className="w-[5%] p-2 border-l border-slate-200 text-center">الهدف</th>
                                                        <th className="w-[8%] p-2 border-l border-slate-200 text-center bg-green-50">الجداول</th>
                                                        <th className="w-[8%] p-2 border-l border-slate-200 text-center">التكلفة</th>
                                                        <th className="w-[8%] p-2 border-l border-slate-200 text-center">حكومي</th>
                                                        <th className="w-[7%] p-2 border-l border-slate-200 text-center">شريك 1</th>
                                                        <th className="w-[7%] p-2 border-l border-slate-200 text-center">شريك 2</th>
                                                        <th className="w-[7%] p-2 border-l border-slate-200 text-center">شريك 3</th>
                                                        <th className="w-[8%] p-2 text-center">العجز / Gap</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {plan.interventions?.map(inv => {
                                                        const gap = calculateGap(inv);
                                                        return (
                                                            <tr key={inv.id} className="hover:bg-gray-50">
                                                                <td className="p-2 border-l border-slate-200 text-gray-600 whitespace-normal">{inv.axis}</td>
                                                                <td className="p-2 border-l border-slate-200 font-bold text-gray-800 whitespace-normal">{inv.name}</td>
                                                                <td className="p-2 border-l border-slate-200 text-gray-600 whitespace-normal">{inv.indicator}</td>
                                                                <td className="p-2 border-l border-slate-200 text-center font-bold">{inv.target}</td>
                                                                <td className="p-2 border-l border-slate-200 text-center">
                                                                    <div className="flex justify-center gap-1">
                                                                        <div className={`w-3 h-3 rounded-sm ${inv.q1 ? 'bg-green-500' : 'bg-gray-200'}`} title="ر1"></div>
                                                                        <div className={`w-3 h-3 rounded-sm ${inv.q2 ? 'bg-green-500' : 'bg-gray-200'}`} title="ر2"></div>
                                                                        <div className={`w-3 h-3 rounded-sm ${inv.q3 ? 'bg-green-500' : 'bg-gray-200'}`} title="ر3"></div>
                                                                        <div className={`w-3 h-3 rounded-sm ${inv.q4 ? 'bg-green-500' : 'bg-gray-200'}`} title="ر4"></div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-2 border-l border-slate-200 text-center font-bold">{Number(inv.totalCost).toLocaleString()}</td>
                                                                <td className="p-2 border-l border-slate-200 text-center text-blue-700"><div className="text-[10px]">{inv.govSource}</div><div className="font-bold">{Number(inv.govValue).toLocaleString()}</div></td>
                                                                <td className="p-2 border-l border-slate-200 text-center text-orange-600"><div className="text-[10px]">{inv.extSource1}</div><div className="font-bold">{Number(inv.extValue1).toLocaleString()}</div></td>
                                                                <td className="p-2 border-l border-slate-200 text-center text-orange-600"><div className="text-[10px]">{inv.extSource2}</div><div className="font-bold">{Number(inv.extValue2).toLocaleString()}</div></td>
                                                                <td className="p-2 border-l border-slate-200 text-center text-orange-600"><div className="text-[10px]">{inv.extSource3}</div><div className="font-bold">{Number(inv.extValue3).toLocaleString()}</div></td>
                                                                <td className={`p-2 text-center font-bold ${gap > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500'}`}>{gap > 0 ? gap.toLocaleString() : '-'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* --- Operational Plans Tabs --- */}
            {['quarterly', 'monthly', 'weekly'].includes(activeTab) && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Calendar className="text-indigo-600"/> 
                            {activeTab === 'quarterly' ? 'الخطط الربعية' : activeTab === 'monthly' ? 'الخطط الشهرية' : 'الخطط الأسبوعية التشغيلية'}
                            {` (${globalFilter.year})`}
                        </h3>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button onClick={() => openCreateOpPlan(PLAN_TYPES[activeTab.toUpperCase()])} className="w-full sm:w-auto justify-center">
                                <Plus size={18} className="ml-2"/> {`إنشاء خطة ${activeTab === 'quarterly' ? 'ربعية' : activeTab === 'monthly' ? 'شهرية' : 'أسبوعية'}`}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredOpPlans.filter(op => op.planType === PLAN_TYPES[activeTab.toUpperCase()]).map(op => (
                            <Card key={op.id} className="border-r-4 border-r-indigo-500">
                                <CardBody className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="flex gap-2 mb-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${(op.level || 'federal') === 'federal' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                                {(op.level || 'federal') === 'federal' ? 'اتحادي' : `ولائي - ${STATE_LOCALITIES[op.state]?.ar || op.state || 'غير محدد'}`}
                                            </span>
                                        </div>
                                        <h4 className="text-base sm:text-lg font-bold text-gray-800">{op.periodName}</h4>
                                        <p className="text-xs text-gray-500 mt-1">الأنشطة المجدولة: {op.activities?.length || 0}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end">
                                        <Button variant="secondary" size="sm" onClick={() => handleEditOpPlan(op)}><Edit size={16}/></Button>
                                        <Button variant="danger" size="sm" onClick={() => { if(confirm("حذف؟")) deleteOperationalPlan(op.id).then(()=>fetchOperationalPlans(true)); }}><Trash2 size={16}/></Button>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                    {filteredOpPlans.filter(op => op.planType === PLAN_TYPES[activeTab.toUpperCase()]).length === 0 && (
                        <EmptyState message="لا توجد خطط تشغيلية مسجلة للعام والمستوى المحددين." />
                    )}
                </div>
            )}

            {/* --- Tracking (Monthly/Weekly) --- */}
            {activeTab === 'tracking' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex items-start gap-3">
                        <CheckCircle2 className="text-green-600 shrink-0 mt-1" />
                        <p className="text-xs sm:text-sm text-green-800 font-medium leading-relaxed">
                            <strong>شاشة المتابعة والتنفيذ:</strong> تتيح تحديث إنجازات الأنشطة (المخططة وغير المخططة) للخطط <strong>الشهرية</strong> و<strong>الأسبوعية</strong> المفعلة بناءً على الفلتر المختار أعلاه.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredOpPlans.filter(op => op.planType === PLAN_TYPES.WEEKLY || op.planType === PLAN_TYPES.MONTHLY).map(op => {
                            const isMonthly = op.planType === PLAN_TYPES.MONTHLY;
                            return (
                                <div key={op.id} onClick={() => { setCurrentOpPlan(op); setIsEditingTracking(true); }} className="cursor-pointer">
                                    <Card className={`hover:shadow-md transition-all border-r-4 ${isMonthly ? 'border-r-blue-500 bg-blue-50/10' : 'border-r-green-500 bg-green-50/10'}`}>
                                        <CardBody className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                            <div>
                                                <div className="text-[10px] font-bold mb-1 flex gap-2">
                                                    <span className={(op.level || 'federal') === 'federal' ? 'text-purple-600' : 'text-teal-600'}>
                                                        {(op.level || 'federal') === 'federal' ? 'اتحادي' : `ولائي`}
                                                    </span>
                                                    <span className={isMonthly ? 'text-blue-600 bg-blue-100 px-1.5 rounded' : 'text-green-600 bg-green-100 px-1.5 rounded'}>
                                                        {isMonthly ? 'خطة شهرية' : 'خطة أسبوعية'}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-gray-800 text-sm sm:text-base">{op.periodName}</h4>
                                            </div>
                                            <Button size="sm" variant={isMonthly ? 'primary' : 'success'} className="self-end sm:self-auto"><Edit size={14} className="ml-1"/> إدخال التنفيذ</Button>
                                        </CardBody>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                    {filteredOpPlans.filter(op => op.planType === PLAN_TYPES.WEEKLY || op.planType === PLAN_TYPES.MONTHLY).length === 0 && (
                        <EmptyState message="لا توجد خطط (شهرية أو أسبوعية) متاحة لإدخال التنفيذ." />
                    )}
                </div>
            )}

            {/* --- Evaluation Dashboard --- */}
            {activeTab === 'evaluation' && (
                <div className="space-y-6 animate-in fade-in">
                    
                    <div className="bg-white p-4 rounded-lg border shadow-sm mb-6">
                        <div className="flex items-center gap-2 mb-4 text-indigo-800 font-bold border-b pb-2 text-sm sm:text-base">
                            <ListFilter size={18}/> عوامل التصفية (للفترات والأهداف فقط)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <FormGroup label="النتيجة المتوقعة">
                                <Select value={evalFilters.outcome} onChange={(e) => setEvalFilters({...evalFilters, outcome: e.target.value})}>
                                    <option value="">-- الكل --</option>
                                    {OUTCOME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="المحور">
                                <Select value={evalFilters.axis} onChange={(e) => setEvalFilters({...evalFilters, axis: e.target.value})}>
                                    <option value="">-- الكل --</option>
                                    {AXIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="الربع">
                                <Select value={evalFilters.quarter} onChange={(e) => setEvalFilters({...evalFilters, quarter: e.target.value})}>
                                    <option value="">-- الكل --</option>
                                    {QUARTERS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="الشهر">
                                <Select value={evalFilters.month} onChange={(e) => setEvalFilters({...evalFilters, month: e.target.value})}>
                                    <option value="">-- الكل --</option>
                                    {MONTHS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="الأسبوع">
                                <Select value={evalFilters.week} onChange={(e) => setEvalFilters({...evalFilters, week: e.target.value})}>
                                    <option value="">-- الكل --</option>
                                    {WEEKS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <Card className="bg-white border-t-4 border-t-sky-500">
                            <CardBody className="text-center p-4">
                                <BarChart2 className="w-6 h-6 text-sky-500 mx-auto mb-2" />
                                <div className="text-xs text-gray-500 font-bold mb-1">إجمالي الميزانية المرصودة</div>
                                <div className="text-xl sm:text-2xl font-bold text-gray-800">{evalData.totalBudget.toLocaleString()}</div>
                            </CardBody>
                        </Card>
                        <Card className="bg-white border-t-4 border-t-green-500">
                            <CardBody className="text-center p-4">
                                <PieChart className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                <div className="text-xs text-gray-500 font-bold mb-1">المنصرف الفعلي (تراكمي)</div>
                                <div className="text-xl sm:text-2xl font-bold text-gray-800">{evalData.totalActualCost.toLocaleString()}</div>
                            </CardBody>
                        </Card>
                        <Card className="bg-white border-t-4 border-t-red-500">
                            <CardBody className="text-center p-4">
                                <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                                <div className="text-xs text-gray-500 font-bold mb-1">الفجوة التمويلية (العجز)</div>
                                <div className="text-xl sm:text-2xl font-bold text-gray-800">{evalData.totalGap.toLocaleString()}</div>
                            </CardBody>
                        </Card>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                        <Card className="bg-indigo-50 border border-indigo-100 col-span-2 sm:col-span-1">
                            <CardBody className="text-center p-3">
                                <div className="text-[10px] text-indigo-600 font-bold mb-1">إجمالي الأنشطة المشمولة</div>
                                <div className="text-lg sm:text-xl font-bold text-indigo-900">{evalData.totalActivities}</div>
                            </CardBody>
                        </Card>
                        <Card className="bg-sky-50 border border-sky-100">
                            <CardBody className="text-center p-3">
                                <div className="text-[10px] text-sky-600 font-bold mb-1">متوسط الأنشطة / شهر</div>
                                <div className="text-lg sm:text-xl font-bold text-sky-900">{evalData.meanPerMonth}</div>
                            </CardBody>
                        </Card>
                        <Card className="bg-green-50 border border-green-100">
                            <CardBody className="text-center p-3">
                                <div className="text-[10px] text-green-600 font-bold mb-1">مكتملة كلياً</div>
                                <div className="text-lg sm:text-xl font-bold text-green-700">{evalData.fullyCompleted}</div>
                            </CardBody>
                        </Card>
                        <Card className="bg-orange-50 border border-orange-100">
                            <CardBody className="text-center p-3">
                                <div className="text-[10px] text-orange-600 font-bold mb-1">مكتملة جزئياً</div>
                                <div className="text-lg sm:text-xl font-bold text-orange-700">{evalData.partiallyCompleted}</div>
                            </CardBody>
                        </Card>
                        <Card className="bg-red-50 border border-red-100">
                            <CardBody className="text-center p-3">
                                <div className="text-[10px] text-red-600 font-bold mb-1">لم تنفذ</div>
                                <div className="text-lg sm:text-xl font-bold text-red-700">{evalData.notImplemented}</div>
                            </CardBody>
                        </Card>
                    </div>

                    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                                <Layers className="text-indigo-600"/> 
                                <h4 className="font-bold text-gray-800 text-sm sm:text-base">جدول تقييم الخطة الشامل</h4>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Button size="sm" variant="secondary" onClick={() => exportEvaluationExcel(evalData)} className="w-full sm:w-auto justify-center">
                                    <Download size={14} className="ml-1" /> تصدير Excel
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => exportEvaluationPDF(evalData)} className="w-full sm:w-auto justify-center">
                                    <FileText size={14} className="ml-1" /> تصدير PDF
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto w-full pb-4">
                            <table className="w-full text-xs sm:text-sm text-right border-collapse min-w-[1200px]">
                                <thead className="bg-slate-800 text-white">
                                    <tr>
                                        <th className="p-3 border-l border-slate-700 w-[20%]">النشاط</th>
                                        <th className="p-3 border-l border-slate-700 text-center w-[8%]">المحور</th>
                                        <th className="p-3 border-l border-slate-700 text-center w-[6%]">النوع</th>
                                        <th className="p-3 border-l border-slate-700 text-center">المستهدف السنوي</th>
                                        <th className="p-3 border-l border-slate-700 text-center">الإنجاز الشهري</th>
                                        <th className="p-3 border-l border-slate-700 text-center">الإنجاز الربعي</th>
                                        <th className="p-3 border-l border-slate-700 text-center">الإنجاز النصف سنوي</th>
                                        <th className="p-3 border-l border-slate-700 text-center">الإنجاز السنوي</th>
                                        <th className="p-3 border-l border-slate-700 text-center">% الكلي</th>
                                        <th className="p-3 border-l border-slate-700 text-center">الميزانية السنوية</th>
                                        <th className="p-3 text-center">المنصرف الفعلي</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {evalData.groupedData.map((group, gIdx) => (
                                        <React.Fragment key={gIdx}>
                                            <tr className="bg-sky-50 border-b-2 border-sky-100">
                                                <td colSpan="11" className="p-3 font-bold text-sky-900">
                                                    النتيجة المتوقعة: {group.outcomeName} <span className="text-[10px] sm:text-xs text-sky-600 bg-sky-100 px-2 py-1 rounded mr-2">{group.levelInfo}</span>
                                                </td>
                                            </tr>
                                            {group.rows.map((row, idx) => {
                                                const perc = row.target > 0 ? Math.round((row.achievedAnnual / row.target) * 100) : 0;
                                                return (
                                                    <tr key={`${row.id}_${idx}`} className={`hover:bg-slate-50 transition-colors ${row.type === 'غير مخطط' ? 'bg-amber-50/20' : 'bg-white'}`}>
                                                        <td className="p-3 border-l border-slate-200 font-bold text-gray-800 break-words whitespace-normal">{row.name}</td>
                                                        <td className="p-3 border-l border-slate-200 text-gray-600 text-[10px] sm:text-xs text-center">{row.axis}</td>
                                                        <td className="p-3 border-l border-slate-200 text-center">
                                                            {row.type === 'غير مخطط' 
                                                                ? <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[9px] sm:text-[10px] font-bold whitespace-nowrap">غير مخطط</span>
                                                                : <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[9px] sm:text-[10px] font-bold whitespace-nowrap">مخطط</span>
                                                            }
                                                        </td>
                                                        <td className="p-3 border-l border-slate-200 text-center font-bold text-indigo-600 text-base sm:text-lg">{row.target}</td>
                                                        
                                                        <td className="p-2 border-l border-slate-200 bg-teal-50/30">
                                                            <FormattedAchieved achieved={row.achievedMonthly} target={row.target} />
                                                        </td>
                                                        <td className="p-2 border-l border-slate-200 bg-teal-50/50">
                                                            <FormattedAchieved achieved={row.achievedQuarterly} target={row.target} />
                                                        </td>
                                                        <td className="p-2 border-l border-slate-200 bg-teal-50/70">
                                                            <FormattedAchieved achieved={row.achievedSemiAnnual} target={row.target} />
                                                        </td>
                                                        <td className="p-2 border-l border-slate-200 bg-green-50/50">
                                                            <FormattedAchieved achieved={row.achievedAnnual} target={row.target} />
                                                        </td>
                                                        
                                                        <td className="p-3 border-l border-slate-200 text-center">
                                                            <div className="flex flex-col items-center justify-center gap-1">
                                                                <span className={`text-[10px] sm:text-xs font-bold ${perc >= 100 ? 'text-green-600' : perc > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{perc}%</span>
                                                                <div className="w-12 sm:w-16 bg-gray-200 rounded-full h-1.5">
                                                                    <div className={`h-1.5 rounded-full ${perc >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(perc, 100)}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 border-l border-slate-200 text-center font-medium">{row.budget.toLocaleString()}</td>
                                                        <td className="p-3 text-center font-bold text-red-600">{row.actualCost.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                    {evalData.groupedData.length === 0 && (
                                        <tr>
                                            <td colSpan="11" className="text-center p-8 sm:p-12 text-gray-500 bg-white">
                                                <div className="flex flex-col items-center justify-center">
                                                    <AlertTriangle className="text-amber-500 w-8 h-8 sm:w-10 sm:h-10 mb-2"/>
                                                    <span className="text-xs sm:text-sm">لا توجد بيانات متاحة لعرض التقييم بناءً على الفلاتر المحددة.</span>
                                                </div>
                                            </td>
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