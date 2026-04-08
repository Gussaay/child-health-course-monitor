// src/components/PlanningView.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardBody, Button, Modal, Input, FormGroup, Select, PageHeader, Table, EmptyState, Spinner } from './CommonComponents';
import { upsertMasterPlan, deleteMasterPlan, upsertOperationalPlan, deleteOperationalPlan } from '../data';
import { useDataCache } from '../DataContext';
import { 
    Plus, Edit, Trash2, TrendingUp, Target, ChevronDown, 
    ChevronUp, Calendar, Activity, FileSpreadsheet, CheckCircle2, 
    AlertTriangle, Briefcase, Calculator, Upload, Download, Save, X
} from 'lucide-react';

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

// مكون مساعد للقوائم المنسدلة التي تحتوي على خيار "أخرى"
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

    const baseClass = "w-full h-full min-h-[32px] px-1 py-1 outline-none text-right text-xs cursor-pointer rounded";
    const selectClass = invalidMode 
        ? `${baseClass} bg-red-50 border border-red-400 text-red-800 focus:ring-red-500` 
        : `${baseClass} bg-transparent border-0`;

    return (
        <div className="w-full h-full flex flex-col justify-center relative">
            {!showInput ? (
                <select className={selectClass} value={value} onChange={handleSelectChange}>
                    <option value="">{placeholder}</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                    <option value={otherLabel} className="font-bold text-sky-600">{otherLabel}</option>
                </select>
            ) : (
                <div className="flex items-center w-full h-full bg-white ring-1 ring-sky-500 z-10 relative rounded">
                    <input 
                        type="text" 
                        className="w-full h-full min-h-[32px] px-1 py-1 bg-transparent border-0 outline-none text-right text-[10px]" 
                        value={value} 
                        onChange={(e) => onChange(e.target.value)} 
                        placeholder="حدد..." 
                        autoFocus
                    />
                    <button type="button" className="text-red-500 px-1 font-bold hover:bg-red-50 h-full" onClick={() => { setShowInput(false); onChange(''); }}>×</button>
                </div>
            )}
        </div>
    );
};

export default function PlanningView({ permissions }) {
    const { 
        masterPlans: rawPlans, fetchMasterPlans, 
        operationalPlans: rawOpPlans, fetchOperationalPlans, 
        isLoading 
    } = useDataCache();
    
    const [activeTab, setActiveTab] = useState('master'); 
    const [expandedPlanId, setExpandedPlanId] = useState(null);
    const [isEditingMatrix, setIsEditingMatrix] = useState(false); 
    const [isEditingOpPlan, setIsEditingOpPlan] = useState(false); 
    const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

    // --- Excel Mapping States ---
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [importData, setImportData] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    const [currentPlan, setCurrentPlan] = useState(null);
    const [currentOpPlan, setCurrentOpPlan] = useState(null);

    const plans = useMemo(() => (rawPlans || []).filter(p => !p.isDeleted).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)), [rawPlans]);
    const opPlans = useMemo(() => (rawOpPlans || []).filter(p => !p.isDeleted).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)), [rawOpPlans]);

    useEffect(() => {
        fetchMasterPlans();
        fetchOperationalPlans();
    }, [fetchMasterPlans, fetchOperationalPlans]);

    // ==========================================
    // EXCEL EXPORT & IMPORT LOGIC
    // ==========================================
    const handleDownloadTemplate = () => {
        const rows = [];
        if (plans.length > 0) {
            plans.forEach(plan => {
                plan.interventions?.forEach(inv => {
                    rows.push({
                        Year: plan.year || CURRENT_YEAR,
                        Expected_Outcome: plan.expectedOutcome,
                        Axis: inv.axis || AXIS_OPTIONS[0],
                        Activity: inv.name, 
                        Indicator: inv.indicator,
                        Baseline: inv.baseline, Target: inv.target,
                        Q1: inv.q1 ? 'Yes' : 'No', Q2: inv.q2 ? 'Yes' : 'No', Q3: inv.q3 ? 'Yes' : 'No', Q4: inv.q4 ? 'Yes' : 'No',
                        Total_Cost: inv.totalCost, 
                        Gov_Project: inv.govSource, Gov_Value: inv.govValue,
                        Partner_Support: inv.extSource1, Ext_Value1: inv.extValue1, 
                        Partner_Support_2: inv.extSource2, Ext_Value2: inv.extValue2, 
                        Partner_Support_3: inv.extSource3, Ext_Value3: inv.extValue3,
                        Plan_ID: plan.id, Intervention_ID: inv.id
                    });
                });
            });
        } else {
            rows.push({
                Year: CURRENT_YEAR,
                Expected_Outcome: OUTCOME_OPTIONS[0], 
                Axis: AXIS_OPTIONS[0],
                Activity: 'أدخل اسم النشاط', 
                Indicator: INDICATOR_OPTIONS[0],
                Baseline: 0, Target: 100, Q1: 'Yes', Q2: 'No', Q3: 'No', Q4: 'Yes',
                Total_Cost: 50000, 
                Gov_Project: GOV_PROJECT_OPTIONS[0], Gov_Value: 10000,
                Partner_Support: PARTNER_SUPPORT_OPTIONS[0], Ext_Value1: 20000, 
                Partner_Support_2: '', Ext_Value2: 20000, 
                Partner_Support_3: '', Ext_Value3: 0,
                Plan_ID: '', Intervention_ID: ''
            });
        }
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!views'] = [{ rightToLeft: true }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Master_Plans");
        XLSX.writeFile(wb, "MasterPlan_Matrix_Template.xlsx");
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
            processImportedData(data);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        };
        reader.readAsBinaryString(file);
    };

    const processImportedData = (data) => {
        const groupedMap = new Map();
        const checkValid = (val, options) => !val || options.includes(val);

        data.forEach((row, index) => {
            const planId = row.Plan_ID || null;
            const outcome = String(row.Expected_Outcome || '').trim();
            const year = Number(row.Year) || CURRENT_YEAR;
            const groupKey = planId ? `id_${planId}` : `new_${year}_${outcome}`;

            if (!groupedMap.has(groupKey)) {
                groupedMap.set(groupKey, {
                    id: planId, 
                    year: year,
                    expectedOutcome: outcome,
                    originalOutcome: outcome, 
                    outcomeValid: OUTCOME_OPTIONS.includes(outcome),
                    interventions: []
                });
            }

            const currentPlan = groupedMap.get(groupKey);
            if (row.Activity) {
                const parseBool = (val) => String(val).toLowerCase() === 'yes' || String(val) === 'نعم';
                
                const axisVal = String(row.Axis || '').trim();
                const indVal = String(row.Indicator || '').trim();
                const govVal = String(row.Gov_Project || '').trim();
                const ext1Val = String(row.Partner_Support || '').trim();
                const ext2Val = String(row.Partner_Support_2 || row.Ext_Source2 || '').trim();
                const ext3Val = String(row.Partner_Support_3 || row.Ext_Source3 || '').trim();

                currentPlan.interventions.push({
                    id: row.Intervention_ID || `temp_${Date.now()}_${index}`,
                    name: String(row.Activity || ''), 
                    
                    axis: axisVal, axisValid: checkValid(axisVal, AXIS_OPTIONS),
                    indicator: indVal, indicatorValid: checkValid(indVal, INDICATOR_OPTIONS),
                    
                    baseline: Number(row.Baseline || 0), target: Number(row.Target || 0),
                    q1: parseBool(row.Q1), q2: parseBool(row.Q2), q3: parseBool(row.Q3), q4: parseBool(row.Q4),
                    totalCost: Number(row.Total_Cost || 0), 
                    
                    govSource: govVal, govValid: checkValid(govVal, GOV_PROJECT_OPTIONS),
                    govValue: Number(row.Gov_Value || 0),
                    
                    extSource1: ext1Val, ext1Valid: checkValid(ext1Val, PARTNER_SUPPORT_OPTIONS),
                    extValue1: Number(row.Ext_Value1 || 0),
                    
                    extSource2: ext2Val, ext2Valid: checkValid(ext2Val, PARTNER_SUPPORT_OPTIONS),
                    extValue2: Number(row.Ext_Value2 || 0),
                    
                    extSource3: ext3Val, ext3Valid: checkValid(ext3Val, PARTNER_SUPPORT_OPTIONS),
                    extValue3: Number(row.Ext_Value3 || 0),
                });
            }
        });
        setImportData(Array.from(groupedMap.values()));
        setIsMappingModalOpen(true);
    };

    const handleConfirmImport = async () => {
        let hasErrors = false;
        importData.forEach(plan => {
            if (!plan.outcomeValid) hasErrors = true;
            plan.interventions.forEach(inv => {
                if (!inv.axisValid || !inv.indicatorValid || !inv.govValid || !inv.ext1Valid || !inv.ext2Valid || !inv.ext3Valid) hasErrors = true;
            });
        });

        if (hasErrors) {
            alert("يرجى التأكد من مطابقة جميع الحقول المظللة باللون الأحمر قبل الحفظ.");
            return;
        }

        setIsImporting(true);
        try {
            for (const plan of importData) {
                const cleanInterventions = plan.interventions.map(inv => {
                    const { axisValid, indicatorValid, govValid, ext1Valid, ext2Valid, ext3Valid, ...cleanInv } = inv;
                    return cleanInv;
                });
                const payload = { expectedOutcome: plan.expectedOutcome, year: plan.year, interventions: cleanInterventions };
                if (plan.id) payload.id = plan.id; 
                await upsertMasterPlan(payload);
            }
            await fetchMasterPlans(true);
            setIsMappingModalOpen(false);
        } catch (error) {
            alert("حدث خطأ أثناء الاستيراد.");
        } finally {
            setIsImporting(false);
        }
    };


    const calculateGap = (inv) => {
        const total = Number(inv.totalCost) || 0;
        const funded = (Number(inv.govValue) || 0) + (Number(inv.extValue1) || 0) + (Number(inv.extValue2) || 0) + (Number(inv.extValue3) || 0);
        return total - funded;
    };

    // Helper to get available interventions for operational planning based on hierarchy
    const getAvailableInterventions = (actRow) => {
        if (!currentOpPlan) return [];
        const selectedYear = currentOpPlan.year || CURRENT_YEAR;
        const yearMasterPlans = plans.filter(p => (p.year || CURRENT_YEAR) == selectedYear);

        if (currentOpPlan.planType === PLAN_TYPES.QUARTERLY) {
            const mp = yearMasterPlans.find(p => p.id === actRow.masterPlanId);
            if (!mp) return [];
            const qKey = currentOpPlan.periodQuarter === 'الربع الاول' ? 'q1' : 
                         currentOpPlan.periodQuarter === 'الربع الثاني' ? 'q2' :
                         currentOpPlan.periodQuarter === 'الربع الثالث' ? 'q3' : 'q4';
            return mp.interventions.filter(i => i[qKey]);
        } 
        else if (currentOpPlan.planType === PLAN_TYPES.MONTHLY) {
            const targetQuarter = Object.keys(QUARTERS_MAP).find(q => QUARTERS_MAP[q].includes(currentOpPlan.periodMonth));
            const qPlan = opPlans.find(op => op.planType === PLAN_TYPES.QUARTERLY && (op.year || CURRENT_YEAR) == selectedYear && op.periodQuarter === targetQuarter);
            if (!qPlan) return [];
            
            const mp = yearMasterPlans.find(p => p.id === actRow.masterPlanId);
            if (!mp) return [];
            
            const validInvIds = qPlan.activities.map(a => a.interventionId);
            return mp.interventions.filter(i => validInvIds.includes(i.id));
        }
        else if (currentOpPlan.planType === PLAN_TYPES.WEEKLY) {
            const mp = yearMasterPlans.find(p => p.id === actRow.masterPlanId);
            if (!mp) return [];

            if (actRow.isOutsideMonthly) {
                return mp.interventions; // All from Master
            } else {
                const mPlan = opPlans.find(op => op.planType === PLAN_TYPES.MONTHLY && (op.year || CURRENT_YEAR) == selectedYear && op.periodMonth === currentOpPlan.periodMonth);
                if (!mPlan) return [];
                const validInvIds = mPlan.activities.map(a => a.interventionId);
                return mp.interventions.filter(i => validInvIds.includes(i.id));
            }
        }
        return [];
    };

    const getAvailableMasterPlans = (actRow) => {
        if (!currentOpPlan) return [];
        const selectedYear = currentOpPlan.year || CURRENT_YEAR;
        const yearMasterPlans = plans.filter(p => (p.year || CURRENT_YEAR) == selectedYear);

        if (currentOpPlan.planType === PLAN_TYPES.QUARTERLY) {
            return yearMasterPlans; 
        } 
        else if (currentOpPlan.planType === PLAN_TYPES.MONTHLY) {
            const targetQuarter = Object.keys(QUARTERS_MAP).find(q => QUARTERS_MAP[q].includes(currentOpPlan.periodMonth));
            const qPlan = opPlans.find(op => op.planType === PLAN_TYPES.QUARTERLY && (op.year || CURRENT_YEAR) == selectedYear && op.periodQuarter === targetQuarter);
            if (!qPlan) return [];
            const validMasterIds = qPlan.activities.map(a => a.masterPlanId);
            return yearMasterPlans.filter(p => validMasterIds.includes(p.id));
        }
        else if (currentOpPlan.planType === PLAN_TYPES.WEEKLY) {
            if (actRow.isOutsideMonthly) {
                return yearMasterPlans;
            } else {
                const mPlan = opPlans.find(op => op.planType === PLAN_TYPES.MONTHLY && (op.year || CURRENT_YEAR) == selectedYear && op.periodMonth === currentOpPlan.periodMonth);
                if (!mPlan) return [];
                const validMasterIds = mPlan.activities.map(a => a.masterPlanId);
                return yearMasterPlans.filter(p => validMasterIds.includes(p.id));
            }
        }
        return [];
    };

    // ==========================================
    // منطق حساب الإنجاز التراكمي (Aggregation & Baselines)
    // ==========================================
    const getAggregatedData = (targetPlan) => {
        if (targetPlan.planType === PLAN_TYPES.WEEKLY) return targetPlan.activities || [];
        const aggregatedActivities = JSON.parse(JSON.stringify(targetPlan.activities || []));
        
        return aggregatedActivities.map(act => {
            let relatedWeeks = [];
            if (targetPlan.planType === PLAN_TYPES.MONTHLY) {
                relatedWeeks = opPlans.filter(op => op.planType === PLAN_TYPES.WEEKLY && (op.year || CURRENT_YEAR) == (targetPlan.year || CURRENT_YEAR) && op.periodMonth === targetPlan.periodMonth);
            } else if (targetPlan.planType === PLAN_TYPES.QUARTERLY) { 
                const monthsInQ = QUARTERS_MAP[targetPlan.periodQuarter] || [];
                relatedWeeks = opPlans.filter(op => op.planType === PLAN_TYPES.WEEKLY && (op.year || CURRENT_YEAR) == (targetPlan.year || CURRENT_YEAR) && monthsInQ.includes(op.periodMonth));
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
        const masterPlan = plans.find(p => p.id === masterPlanId);
        const intervention = masterPlan?.interventions?.find(i => i.id === interventionId);
        if (!intervention) return 0;
        
        let base = parseFloat(intervention.baseline) || 0;
        opPlans.forEach(op => {
            if (op.planType === PLAN_TYPES.WEEKLY && op.id !== currentOpId) {
                const act = op.activities?.find(a => a.interventionId === interventionId);
                base += parseFloat(act?.achieved || 0);
            }
        });
        return base;
    };

    const handleSaveMasterPlan = async (e) => {
        if (e) e.preventDefault();
        await upsertMasterPlan(currentPlan);
        fetchMasterPlans(true);
        setIsEditingMatrix(false);
    };

    const handleSaveOpPlan = async (e) => {
        if (e) e.preventDefault();
        let name = currentOpPlan.planType === PLAN_TYPES.QUARTERLY ? currentOpPlan.periodQuarter : 
                   currentOpPlan.planType === PLAN_TYPES.MONTHLY ? currentOpPlan.periodMonth : 
                   `${currentOpPlan.periodWeek} - ${currentOpPlan.periodMonth}`;
        
        await upsertOperationalPlan({ ...currentOpPlan, periodName: name });
        fetchOperationalPlans(true);
        setIsEditingOpPlan(false);
    };

    const openCreateOpPlan = (type) => {
        let base = { planType: type, year: CURRENT_YEAR, activities: [] };
        if (type === PLAN_TYPES.QUARTERLY) base.periodQuarter = QUARTERS_LIST[0];
        if (type === PLAN_TYPES.MONTHLY) base.periodMonth = MONTHS_LIST[0];
        if (type === PLAN_TYPES.WEEKLY) {
            base.periodMonth = MONTHS_LIST[0];
            base.periodWeek = WEEKS_LIST[0];
        }
        setCurrentOpPlan(base);
        setIsEditingOpPlan(true);
    };

    // ==========================================
    // واجهة مصفوفة الخطة السنوية (Full Page Matrix Editor)
    // ==========================================
    if (isEditingMatrix && currentPlan) {
        return (
            <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col" dir="rtl">
                <div className="bg-white shadow px-6 py-3 flex justify-between items-center shrink-0 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Briefcase className="text-sky-600"/> إدخال مصفوفة الخطة السنوية الاستراتيجية</h2>
                        <p className="text-sm text-gray-500 mt-1">يتم تحديث العجز (Gap) تلقائياً بناءً على إجمالي التكلفة والدعم المدخل.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setIsEditingMatrix(false)}>
                            <X size={16} className="ml-1"/> إغلاق
                        </Button>
                        <Button onClick={handleSaveMasterPlan}>
                            <Save size={16} className="ml-1"/> حفظ المصفوفة
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="bg-white rounded-lg shadow-sm border mb-4 p-4 flex gap-6 items-center">
                        <FormGroup label="السنة" className="w-48">
                            <Select value={currentPlan.year || CURRENT_YEAR} onChange={(e) => setCurrentPlan({...currentPlan, year: Number(e.target.value)})} className="font-bold border-sky-300">
                                {YEAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="النتيجة المتوقعة (الأساس)" className="flex-1">
                            <Select value={currentPlan.expectedOutcome} onChange={(e) => setCurrentPlan({...currentPlan, expectedOutcome: e.target.value})} className="font-bold border-sky-300">
                                {OUTCOME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>
                    </div>

                    <div className="bg-white border shadow-sm w-full relative">
                        <table className="w-full table-fixed border-collapse text-[10px] sm:text-xs text-right whitespace-normal">
                            <thead className="bg-slate-800 text-white font-bold">
                                <tr>
                                    <th className="w-[10%] p-1.5 border border-slate-600">المحور</th>
                                    <th className="w-[13%] p-1.5 border border-slate-600">النشاط</th>
                                    <th className="w-[10%] p-1.5 border border-slate-600">المؤشر</th>
                                    <th className="w-[4%] p-1.5 border border-slate-600 text-center">الأساس</th>
                                    <th className="w-[4%] p-1.5 border border-slate-600 text-center">الهدف</th>
                                    <th className="w-[2%] p-1.5 border border-slate-600 text-center">ر1</th>
                                    <th className="w-[2%] p-1.5 border border-slate-600 text-center">ر2</th>
                                    <th className="w-[2%] p-1.5 border border-slate-600 text-center">ر3</th>
                                    <th className="w-[2%] p-1.5 border border-slate-600 text-center">ر4</th>
                                    <th className="w-[6%] p-1.5 border border-slate-600 text-center">التكلفة</th>
                                    <th className="w-[6%] p-1.5 border border-slate-600 text-center bg-blue-900">مشروع حكومي</th>
                                    <th className="w-[5%] p-1.5 border border-slate-600 text-center bg-blue-900">القيمة</th>
                                    <th className="w-[6%] p-1.5 border border-slate-600 text-center bg-orange-900">دعم شريك 1</th>
                                    <th className="w-[5%] p-1.5 border border-slate-600 text-center bg-orange-900">القيمة</th>
                                    <th className="w-[5%] p-1.5 border border-slate-600 text-center bg-orange-900">دعم شريك 2</th>
                                    <th className="w-[5%] p-1.5 border border-slate-600 text-center bg-orange-900">القيمة</th>
                                    <th className="w-[5%] p-1.5 border border-slate-600 text-center bg-orange-900">دعم شريك 3</th>
                                    <th className="w-[5%] p-1.5 border border-slate-600 text-center bg-orange-900">القيمة</th>
                                    <th className="w-[5%] p-1.5 border border-slate-600 text-center bg-red-900">العجز (Gap)</th>
                                    <th className="w-[2%] p-1.5 border border-slate-600 text-center">🗑️</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentPlan.interventions?.map((inv, idx) => {
                                    const gap = calculateGap(inv);
                                    const update = (field, val) => {
                                        const newInvs = [...currentPlan.interventions];
                                        newInvs[idx][field] = val;
                                        setCurrentPlan({...currentPlan, interventions: newInvs});
                                    };
                                    const cellClass = "p-0 border border-slate-300 relative focus-within:ring-1 focus-within:ring-sky-500 focus-within:z-10 align-top";
                                    const inputClass = "w-full h-full min-h-[32px] px-1 py-1 bg-transparent border-0 outline-none text-right whitespace-normal break-words resize-none overflow-hidden";
                                    
                                    return (
                                    <tr key={inv.id} className="hover:bg-sky-50 transition-colors bg-white">
                                        <td className={cellClass}>
                                            <select className={`${inputClass} text-xs`} value={inv.axis} onChange={(e) => update('axis', e.target.value)}>
                                                {AXIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </td>
                                        <td className={cellClass}>
                                            <textarea className={`${inputClass} font-bold h-full`} rows={2} value={inv.name} onChange={(e) => update('name', e.target.value)} placeholder="نشاط..." required />
                                        </td>
                                        
                                        <td className={cellClass}>
                                            <SelectWithOther options={INDICATOR_OPTIONS} value={inv.indicator} onChange={(val) => update('indicator', val)} placeholder="- اختر مؤشر -" otherLabel="اخرى حدد" />
                                        </td>
                                        
                                        <td className={cellClass}><input type="number" className={`${inputClass} text-center`} value={inv.baseline} onChange={(e) => update('baseline', e.target.value)} /></td>
                                        <td className={cellClass}><input type="number" className={`${inputClass} text-center font-bold`} value={inv.target} onChange={(e) => update('target', e.target.value)} /></td>
                                        
                                        <td className={`${cellClass} text-center align-middle bg-green-50/50`}><input type="checkbox" className="w-3.5 h-3.5 mt-1 cursor-pointer" checked={inv.q1} onChange={(e) => update('q1', e.target.checked)} /></td>
                                        <td className={`${cellClass} text-center align-middle bg-green-50/50`}><input type="checkbox" className="w-3.5 h-3.5 mt-1 cursor-pointer" checked={inv.q2} onChange={(e) => update('q2', e.target.checked)} /></td>
                                        <td className={`${cellClass} text-center align-middle bg-green-50/50`}><input type="checkbox" className="w-3.5 h-3.5 mt-1 cursor-pointer" checked={inv.q3} onChange={(e) => update('q3', e.target.checked)} /></td>
                                        <td className={`${cellClass} text-center align-middle bg-green-50/50`}><input type="checkbox" className="w-3.5 h-3.5 mt-1 cursor-pointer" checked={inv.q4} onChange={(e) => update('q4', e.target.checked)} /></td>
                                        
                                        <td className={cellClass}><input type="number" className={`${inputClass} text-center font-bold bg-gray-50`} value={inv.totalCost} onChange={(e) => update('totalCost', e.target.value)} /></td>
                                        
                                        <td className={`${cellClass} bg-blue-50/30`}>
                                            <SelectWithOther options={GOV_PROJECT_OPTIONS} value={inv.govSource} onChange={(val) => update('govSource', val)} placeholder="- مشروع حكومي -" />
                                        </td>
                                        <td className={`${cellClass} bg-blue-50/30`}><input type="number" className={`${inputClass} text-center text-blue-800 font-bold`} value={inv.govValue} onChange={(e) => update('govValue', e.target.value)} /></td>
                                        
                                        <td className={`${cellClass} bg-orange-50/30`}>
                                            <SelectWithOther options={PARTNER_SUPPORT_OPTIONS} value={inv.extSource1} onChange={(val) => update('extSource1', val)} placeholder="- شريك 1 -" />
                                        </td>
                                        <td className={`${cellClass} bg-orange-50/30`}><input type="number" className={`${inputClass} text-center text-orange-700 font-bold`} value={inv.extValue1} onChange={(e) => update('extValue1', e.target.value)} /></td>
                                        
                                        <td className={`${cellClass} bg-orange-50/30`}>
                                            <SelectWithOther options={PARTNER_SUPPORT_OPTIONS} value={inv.extSource2} onChange={(val) => update('extSource2', val)} placeholder="- شريك 2 -" />
                                        </td>
                                        <td className={`${cellClass} bg-orange-50/30`}><input type="number" className={`${inputClass} text-center text-orange-700 font-bold`} value={inv.extValue2} onChange={(e) => update('extValue2', e.target.value)} /></td>
                                        
                                        <td className={`${cellClass} bg-orange-50/30`}>
                                            <SelectWithOther options={PARTNER_SUPPORT_OPTIONS} value={inv.extSource3} onChange={(val) => update('extSource3', val)} placeholder="- شريك 3 -" />
                                        </td>
                                        <td className={`${cellClass} bg-orange-50/30`}><input type="number" className={`${inputClass} text-center text-orange-700 font-bold`} value={inv.extValue3} onChange={(e) => update('extValue3', e.target.value)} /></td>
                                        
                                        <td className={`p-1 border border-slate-300 text-center font-bold align-middle ${gap > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                            {gap.toLocaleString()}
                                        </td>
                                        <td className="p-1 border border-slate-300 text-center align-middle">
                                            <button type="button" onClick={() => setCurrentPlan({...currentPlan, interventions: currentPlan.interventions.filter(i => i.id !== inv.id)})} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition">
                                                <Trash2 size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                        <div className="p-2 border-t border-slate-300 bg-slate-50 flex justify-center">
                            <Button type="button" size="sm" variant="secondary" onClick={() => setCurrentPlan({...currentPlan, interventions: [...(currentPlan.interventions||[]), DEFAULT_INTERVENTION()]})}>
                                <Plus size={16} className="ml-1"/> إضافة نشاط جديد
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // واجهة الخطط التشغيلية (Full Page OpPlan Editor)
    // ==========================================
    if (isEditingOpPlan && currentOpPlan) {
        return (
            <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col" dir="rtl">
                <div className="bg-white shadow px-6 py-3 flex justify-between items-center shrink-0 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Calendar className="text-sky-600"/> إعداد خطة العمل التشغيلية - {currentOpPlan.planType}</h2>
                        <p className="text-sm text-gray-500 mt-1">يتم سحب الأنشطة المتاحة تلقائياً بناءً على الخطة السنوية والخطط التراكمية السابقة.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setIsEditingOpPlan(false)}>
                            <X size={16} className="ml-1"/> إغلاق
                        </Button>
                        <Button onClick={handleSaveOpPlan}>
                            <Save size={16} className="ml-1"/> حفظ الخطة
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div className="bg-white p-4 rounded-lg border shadow-sm grid md:grid-cols-4 gap-4">
                        <FormGroup label="نوع الخطة">
                            <div className="font-bold text-indigo-800 p-2 bg-indigo-100 rounded text-center border border-indigo-200">{currentOpPlan.planType}</div>
                        </FormGroup>
                        <FormGroup label="السنة">
                            <Select value={currentOpPlan.year || CURRENT_YEAR} onChange={(e) => setCurrentOpPlan({...currentOpPlan, year: Number(e.target.value)})}>
                                {YEAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </Select>
                        </FormGroup>

                        {currentOpPlan.planType === PLAN_TYPES.QUARTERLY && (
                            <FormGroup label="اختر الربع">
                                <Select value={currentOpPlan.periodQuarter} onChange={(e) => setCurrentOpPlan({...currentOpPlan, periodQuarter: e.target.value})}>
                                    <option value="">-- اختر --</option>
                                    {QUARTERS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                        )}
                        
                        {currentOpPlan.planType === PLAN_TYPES.MONTHLY && (
                            <FormGroup label="اختر الشهر">
                                <Select value={currentOpPlan.periodMonth} onChange={(e) => setCurrentOpPlan({...currentOpPlan, periodMonth: e.target.value})}>
                                    <option value="">-- اختر --</option>
                                    {MONTHS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                </Select>
                            </FormGroup>
                        )}

                        {currentOpPlan.planType === PLAN_TYPES.WEEKLY && (
                            <>
                                <FormGroup label="اختر الشهر">
                                    <Select value={currentOpPlan.periodMonth} onChange={(e) => setCurrentOpPlan({...currentOpPlan, periodMonth: e.target.value})}>
                                        <option value="">-- اختر --</option>
                                        {MONTHS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label="اختر الأسبوع">
                                    <Select value={currentOpPlan.periodWeek} onChange={(e) => setCurrentOpPlan({...currentOpPlan, periodWeek: e.target.value})}>
                                        <option value="">-- اختر --</option>
                                        {WEEKS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                                    </Select>
                                </FormGroup>
                            </>
                        )}
                    </div>

                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                            <h4 className="font-bold text-gray-700">تحديد الأنشطة والمستهدفات للفترة المحددة</h4>
                            <Button type="button" size="sm" onClick={() => setCurrentOpPlan({...currentOpPlan, activities: [...(currentOpPlan.activities||[]), {id: `act_${Date.now()}`, masterPlanId: '', interventionId: '', indicator: '', target: 0, isOutsideMonthly: false}]})}>
                                <Plus size={16} className="ml-1"/> إضافة نشاط للجدول
                            </Button>
                        </div>
                        
                        <div className="overflow-x-auto w-full">
                            <table className="w-full table-fixed text-sm text-right border-collapse">
                                <thead className="bg-slate-100 text-slate-700">
                                    <tr>
                                        <th className="w-[20%] p-3 border-b border-l border-slate-200">النتيجة المتوقعة (الأساس)</th>
                                        <th className="w-[25%] p-3 border-b border-l border-slate-200">النشاط المختار</th>
                                        <th className="w-[15%] p-3 border-b border-l border-slate-200">المؤشر</th>
                                        <th className="w-[10%] p-3 border-b border-l border-slate-200 text-center">الأساس التراكمي</th>
                                        <th className="w-[10%] p-3 border-b border-l border-slate-200 text-center">المستهدف للفترة</th>
                                        {currentOpPlan.planType === PLAN_TYPES.WEEKLY && (
                                            <th className="w-[15%] p-3 border-b border-l border-slate-200 text-center">حالة الجدولة</th>
                                        )}
                                        <th className="w-[5%] p-3 border-b text-center">حذف</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {currentOpPlan.activities?.map((act, idx) => {
                                        const dyn = getDynamicBaseline(act.masterPlanId, act.interventionId, currentOpPlan.id);
                                        const availableMasterPlans = getAvailableMasterPlans(act);
                                        const availableInvs = getAvailableInterventions(act);
                                        const inputClass = "w-full p-2 border border-slate-300 rounded focus:ring-sky-500 focus:border-sky-500 bg-white";

                                        return (
                                            <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-2 border-l border-slate-200 align-top">
                                                    <select className={inputClass} value={act.masterPlanId} onChange={(e) => {
                                                        const newActs = [...currentOpPlan.activities];
                                                        newActs[idx].masterPlanId = e.target.value;
                                                        newActs[idx].interventionId = '';
                                                        setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                    }}>
                                                        <option value="">-- اختر النتيجة السنوية --</option>
                                                        {availableMasterPlans.map(p => <option key={p.id} value={p.id}>{p.expectedOutcome}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2 border-l border-slate-200 align-top">
                                                    <select className={`${inputClass} font-bold`} value={act.interventionId} onChange={(e) => {
                                                        const newActs = [...currentOpPlan.activities];
                                                        newActs[idx].interventionId = e.target.value;
                                                        const selInv = availableInvs.find(i => i.id === e.target.value);
                                                        if (selInv) newActs[idx].indicator = selInv.indicator;
                                                        setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                    }} disabled={!act.masterPlanId}>
                                                        <option value="">-- اختر النشاط المتاح للفترة --</option>
                                                        {availableInvs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2 border-l border-slate-200 align-middle text-gray-600 font-medium whitespace-normal break-words">
                                                    {act.indicator || '-'}
                                                </td>
                                                <td className="p-2 border-l border-slate-200 align-middle text-center font-bold bg-slate-50 text-indigo-700">
                                                    {dyn}
                                                </td>
                                                <td className="p-2 border-l border-slate-200 align-middle text-center">
                                                    <input type="number" className={`${inputClass} text-center font-bold text-lg`} value={act.target} onChange={(e) => {
                                                        const newActs = [...currentOpPlan.activities];
                                                        newActs[idx].target = e.target.value;
                                                        setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                    }} placeholder="0" />
                                                </td>
                                                
                                                {currentOpPlan.planType === PLAN_TYPES.WEEKLY && (
                                                    <td className="p-2 border-l border-slate-200 align-middle text-center">
                                                        <label className="flex items-center justify-center gap-1.5 text-xs text-orange-800 font-bold bg-orange-100 p-2 rounded cursor-pointer border border-orange-200 hover:bg-orange-200 transition-colors">
                                                            <input type="checkbox" className="w-4 h-4 rounded text-orange-600" checked={act.isOutsideMonthly} onChange={(e) => {
                                                                const newActs = [...currentOpPlan.activities];
                                                                newActs[idx].isOutsideMonthly = e.target.checked;
                                                                newActs[idx].interventionId = ''; 
                                                                setCurrentOpPlan({...currentOpPlan, activities: newActs});
                                                            }} />
                                                            خارج خطة الشهر
                                                        </label>
                                                    </td>
                                                )}

                                                <td className="p-2 align-middle text-center">
                                                    <button type="button" onClick={() => setCurrentOpPlan({...currentOpPlan, activities: currentOpPlan.activities.filter(item => item.id !== act.id)})} className="text-red-500 hover:bg-red-100 p-2 rounded transition-colors" title="حذف النشاط">
                                                        <Trash2 size={18}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            
                            {currentOpPlan.activities?.length === 0 && (
                                <div className="text-center text-sm text-gray-500 p-8">
                                    لم يتم إضافة أي أنشطة لهذه الخطة بعد. <br/>
                                    {currentOpPlan.planType !== PLAN_TYPES.QUARTERLY && "تأكد من وجود خطط سابقة للمستوى الأعلى (ربعية/شهرية) لسحب الأنشطة منها."}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    if (isLoading.masterPlans || isLoading.operationalPlans) return <Spinner />;

    // ==========================================
    // واجهة العرض الرئيسية
    // ==========================================
    return (
        <div className="space-y-6" dir="rtl">
            <PageHeader 
                title="منظومة التخطيط والمتابعة" 
                subtitle="الخطة الاستراتيجية، الخطط التشغيلية، وتقارير المتابعة المجمعة" 
            />

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-4 sm:gap-8 overflow-x-auto whitespace-nowrap">
                    {[
                        { id: 'master', label: 'الخطة السنوية (Master)', icon: TrendingUp },
                        { id: 'quarterly', label: 'الخطط الربعية', icon: Calendar },
                        { id: 'monthly', label: 'الخطط الشهرية', icon: Calendar },
                        { id: 'weekly', label: 'التشغيلية (الأسبوعية)', icon: FileSpreadsheet },
                        { id: 'tracking', label: 'المتابعة والتجميع', icon: CheckCircle2 }
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

            {/* --- الخطة السنوية --- */}
            {activeTab === 'master' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm flex-wrap gap-4">
                        <h3 className="text-lg font-bold flex items-center gap-2"><Target className="text-sky-600"/> سجل الخطط السنوية</h3>
                        
                        {permissions?.canUseFederalManagerAdvancedFeatures && (
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={handleDownloadTemplate}>
                                    <Download size={18} className="ml-2"/> تصدير الخطة
                                </Button>
                                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                                    <Upload size={18} className="ml-2"/> استيراد الخطة
                                </Button>
                                <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                
                                <Button onClick={() => { setCurrentPlan({ year: CURRENT_YEAR, expectedOutcome: OUTCOME_OPTIONS[0], interventions: [DEFAULT_INTERVENTION()] }); setIsEditingMatrix(true); }}>
                                    <Plus size={18} className="ml-2"/> إضافة خطة نتيجة
                                </Button>
                            </div>
                        )}
                    </div>

                    {plans.map(plan => (
                        <Card key={plan.id} className="border-t-4 border-t-sky-500 overflow-hidden">
                            <div 
                                className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                                onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="bg-sky-100 text-sky-800 px-3 py-1 rounded font-bold text-sm">عام {plan.year || CURRENT_YEAR}</span>
                                    <span className="font-bold text-lg text-gray-800 break-words whitespace-normal">{plan.expectedOutcome}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setCurrentPlan(plan); setIsEditingMatrix(true); }}><Edit size={14}/></Button>
                                    <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); if(confirm("حذف؟")) deleteMasterPlan(plan.id).then(()=>fetchMasterPlans(true)); }}><Trash2 size={14}/></Button>
                                    {expandedPlanId === plan.id ? <ChevronUp /> : <ChevronDown />}
                                </div>
                            </div>
                            {expandedPlanId === plan.id && (
                                <div className="overflow-x-auto bg-white border-t border-gray-200">
                                    <table className="w-full text-xs text-right table-fixed border-collapse">
                                        <thead className="bg-gray-100 text-gray-600 font-bold border-b">
                                            <tr>
                                                <th className="w-[10%] p-2 border-l border-slate-200">المحور</th>
                                                <th className="w-[20%] p-2 border-l border-slate-200">النشاط</th>
                                                <th className="w-[12%] p-2 border-l border-slate-200">المؤشر</th>
                                                <th className="w-[5%] p-2 border-l border-slate-200 text-center">الهدف</th>
                                                <th className="w-[8%] p-2 border-l border-slate-200 text-center bg-green-50">الجداول الزمنية</th>
                                                <th className="w-[8%] p-2 border-l border-slate-200 text-center">التكلفة الكلية</th>
                                                <th className="w-[8%] p-2 border-l border-slate-200 text-center">مشروع حكومي</th>
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
                                                        <td className="p-2 border-l border-slate-200 text-gray-600 break-words whitespace-normal">{inv.axis}</td>
                                                        <td className="p-2 border-l border-slate-200 font-bold text-gray-800 break-words whitespace-normal align-top">{inv.name}</td>
                                                        <td className="p-2 border-l border-slate-200 text-gray-600 break-words whitespace-normal align-top">{inv.indicator}</td>
                                                        <td className="p-2 border-l border-slate-200 text-center font-bold align-middle">{inv.target}</td>
                                                        <td className="p-2 border-l border-slate-200 text-center align-middle">
                                                            <div className="flex justify-center gap-1">
                                                                <div className={`w-3 h-3 rounded-sm ${inv.q1 ? 'bg-green-500' : 'bg-gray-200'}`} title="الربع الأول"></div>
                                                                <div className={`w-3 h-3 rounded-sm ${inv.q2 ? 'bg-green-500' : 'bg-gray-200'}`} title="الربع الثاني"></div>
                                                                <div className={`w-3 h-3 rounded-sm ${inv.q3 ? 'bg-green-500' : 'bg-gray-200'}`} title="الربع الثالث"></div>
                                                                <div className={`w-3 h-3 rounded-sm ${inv.q4 ? 'bg-green-500' : 'bg-gray-200'}`} title="الربع الرابع"></div>
                                                            </div>
                                                        </td>
                                                        <td className="p-2 border-l border-slate-200 text-center font-bold align-middle">{Number(inv.totalCost).toLocaleString()}</td>
                                                        <td className="p-2 border-l border-slate-200 text-center text-blue-700 align-middle">
                                                            <div className="font-bold break-words whitespace-normal text-[10px]">{inv.govSource}</div>
                                                            <div>{Number(inv.govValue).toLocaleString()}</div>
                                                        </td>
                                                        <td className="p-2 border-l border-slate-200 text-center text-orange-600 align-middle">
                                                            <div className="font-bold break-words whitespace-normal text-[10px]">{inv.extSource1}</div>
                                                            <div>{Number(inv.extValue1).toLocaleString()}</div>
                                                        </td>
                                                        <td className="p-2 border-l border-slate-200 text-center text-orange-600 align-middle">
                                                            <div className="font-bold break-words whitespace-normal text-[10px]">{inv.extSource2}</div>
                                                            <div>{Number(inv.extValue2).toLocaleString()}</div>
                                                        </td>
                                                        <td className="p-2 border-l border-slate-200 text-center text-orange-600 align-middle">
                                                            <div className="font-bold break-words whitespace-normal text-[10px]">{inv.extSource3}</div>
                                                            <div>{Number(inv.extValue3).toLocaleString()}</div>
                                                        </td>
                                                        <td className={`p-2 text-center font-bold align-middle ${gap > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500'}`}>{gap > 0 ? gap.toLocaleString() : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    ))}
                    {plans.length === 0 && <EmptyState message="لا توجد بيانات في الخطة السنوية الرئيسية." />}
                </div>
            )}

            {/* --- الخطط الربعية / الشهرية / الأسبوعية (Operational) --- */}
            {['quarterly', 'monthly', 'weekly'].includes(activeTab) && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Calendar className="text-indigo-600"/> 
                            {activeTab === 'quarterly' ? 'الخطط الربعية' : activeTab === 'monthly' ? 'الخطط الشهرية' : 'الخطط الأسبوعية التشغيلية'}
                        </h3>
                        {permissions?.canUseFederalManagerAdvancedFeatures && (
                            <Button onClick={() => openCreateOpPlan(PLAN_TYPES[activeTab.toUpperCase()])}>
                                <Plus size={18} className="ml-2"/> 
                                {`إنشاء خطة ${activeTab === 'quarterly' ? 'ربعية' : activeTab === 'monthly' ? 'شهرية' : 'أسبوعية'}`}
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {opPlans.filter(op => op.planType === PLAN_TYPES[activeTab.toUpperCase()]).map(op => (
                            <Card key={op.id} className="border-r-4 border-r-indigo-500">
                                <CardBody className="flex justify-between items-center">
                                    <div>
                                        <div className="text-xs font-bold text-indigo-600 mb-1">عام {op.year || CURRENT_YEAR} - {op.planType}</div>
                                        <h4 className="text-lg font-bold text-gray-800">{op.periodName}</h4>
                                        <p className="text-xs text-gray-500 mt-1">الأنشطة المجدولة: {op.activities?.length || 0}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => { setCurrentOpPlan(op); setIsEditingOpPlan(true); }}><Edit size={16}/></Button>
                                        <Button variant="danger" size="sm" onClick={() => { if(confirm("حذف؟")) deleteOperationalPlan(op.id).then(()=>fetchOperationalPlans(true)); }}><Trash2 size={16}/></Button>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                    {opPlans.filter(op => op.planType === PLAN_TYPES[activeTab.toUpperCase()]).length === 0 && (
                        <EmptyState message={`لا توجد خطط ${activeTab === 'quarterly' ? 'ربعية' : activeTab === 'monthly' ? 'شهرية' : 'أسبوعية'} مسجلة.`} />
                    )}
                </div>
            )}

            {/* --- Mapping Modal for Import Validation --- */}
            {isMappingModalOpen && (
                <Modal isOpen={isMappingModalOpen} onClose={() => setIsMappingModalOpen(false)} title="مراجعة ومطابقة بيانات الإكسيل" size="6xl">
                     <CardBody className="space-y-4 max-h-[75vh] overflow-y-auto bg-gray-50">
                        <div className="p-3 bg-red-50 text-red-800 text-sm rounded-lg flex items-start gap-2 border border-red-200">
                            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                            <p>يحتوي الملف المرفوع على بيانات غير متطابقة مع القوائم المعتمدة. يرجى مراجعة الحقول المظللة باللون الأحمر واختيار القيمة الصحيحة (أو اختيار "اخرى" وكتابتها يدوياً) قبل الحفظ.</p>
                        </div>
                        
                        {importData.map((plan, planIdx) => (
                            <div key={planIdx} className="bg-white p-4 rounded border shadow-sm">
                                {/* Plan Level Mapping */}
                                <div className="mb-4 pb-4 border-b grid md:grid-cols-2 gap-4">
                                    <FormGroup label="النتيجة المتوقعة (Outcome)">
                                        <div className="flex items-center gap-4">
                                            {!plan.outcomeValid && <span className="text-red-600 text-xs font-bold w-1/3">غير متعرف عليه: {plan.originalOutcome || "فارغ"}</span>}
                                            <div className="flex-1">
                                                <Select 
                                                    value={plan.outcomeValid ? plan.expectedOutcome : ''} 
                                                    onChange={(e) => {
                                                        const newData = [...importData];
                                                        newData[planIdx].expectedOutcome = e.target.value;
                                                        newData[planIdx].outcomeValid = OUTCOME_OPTIONS.includes(e.target.value);
                                                        setImportData(newData);
                                                    }} 
                                                    className={!plan.outcomeValid ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500" : ""}
                                                >
                                                    <option value="">-- اختر لمحاذاة البيانات --</option>
                                                    {OUTCOME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                </Select>
                                            </div>
                                        </div>
                                    </FormGroup>
                                    <FormGroup label="السنة المستهدفة">
                                        <Select value={plan.year} onChange={(e) => {
                                            const newData = [...importData];
                                            newData[planIdx].year = Number(e.target.value);
                                            setImportData(newData);
                                        }}>
                                            {YEAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </Select>
                                    </FormGroup>
                                </div>
                                
                                {/* Intervention Level Mapping */}
                                <div className="text-xs text-gray-500 font-bold mb-2">أنشطة النتيجة ({plan.interventions.length}):</div>
                                <div className="overflow-x-auto border rounded">
                                    <table className="w-full text-right text-xs table-fixed">
                                        <thead className="bg-gray-100 border-b">
                                            <tr>
                                                <th className="w-[20%] p-2">النشاط</th>
                                                <th className="w-[15%] p-2">المحور</th>
                                                <th className="w-[15%] p-2">المؤشر</th>
                                                <th className="w-[15%] p-2">مشروع حكومي</th>
                                                <th className="w-[15%] p-2">دعم شريك 1</th>
                                                <th className="w-[10%] p-2">دعم شريك 2</th>
                                                <th className="w-[10%] p-2">دعم شريك 3</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {plan.interventions.map((inv, invIdx) => {
                                                const updateInv = (field, val, validField, optionsList) => {
                                                    const newData = [...importData];
                                                    newData[planIdx].interventions[invIdx][field] = val;
                                                    // If empty or in options, it's valid
                                                    newData[planIdx].interventions[invIdx][validField] = !val || optionsList.includes(val);
                                                    setImportData(newData);
                                                };

                                                return (
                                                    <tr key={inv.id} className="hover:bg-gray-50">
                                                        <td className="p-2 border-l font-bold text-gray-700 truncate" title={inv.name}>{inv.name}</td>
                                                        <td className="p-1 border-l">
                                                            <SelectWithOther invalidMode={!inv.axisValid} options={AXIS_OPTIONS} value={inv.axis} onChange={(val) => updateInv('axis', val, 'axisValid', AXIS_OPTIONS)} placeholder="- محور -" />
                                                        </td>
                                                        <td className="p-1 border-l">
                                                            <SelectWithOther invalidMode={!inv.indicatorValid} options={INDICATOR_OPTIONS} value={inv.indicator} onChange={(val) => updateInv('indicator', val, 'indicatorValid', INDICATOR_OPTIONS)} placeholder="- مؤشر -" otherLabel="اخرى حدد" />
                                                        </td>
                                                        <td className="p-1 border-l">
                                                            <SelectWithOther invalidMode={!inv.govValid} options={GOV_PROJECT_OPTIONS} value={inv.govSource} onChange={(val) => updateInv('govSource', val, 'govValid', GOV_PROJECT_OPTIONS)} placeholder="- مصدر -" />
                                                        </td>
                                                        <td className="p-1 border-l">
                                                            <SelectWithOther invalidMode={!inv.ext1Valid} options={PARTNER_SUPPORT_OPTIONS} value={inv.extSource1} onChange={(val) => updateInv('extSource1', val, 'ext1Valid', PARTNER_SUPPORT_OPTIONS)} placeholder="- شريك 1 -" />
                                                        </td>
                                                        <td className="p-1 border-l">
                                                            <SelectWithOther invalidMode={!inv.ext2Valid} options={PARTNER_SUPPORT_OPTIONS} value={inv.extSource2} onChange={(val) => updateInv('extSource2', val, 'ext2Valid', PARTNER_SUPPORT_OPTIONS)} placeholder="- شريك 2 -" />
                                                        </td>
                                                        <td className="p-1">
                                                            <SelectWithOther invalidMode={!inv.ext3Valid} options={PARTNER_SUPPORT_OPTIONS} value={inv.extSource3} onChange={(val) => updateInv('extSource3', val, 'ext3Valid', PARTNER_SUPPORT_OPTIONS)} placeholder="- شريك 3 -" />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </CardBody>
                    <div className="p-4 border-t flex justify-end gap-2 bg-white">
                        <Button type="button" variant="secondary" onClick={() => setIsMappingModalOpen(false)}>إلغاء</Button>
                        <Button 
                            onClick={handleConfirmImport} 
                            disabled={isImporting}
                        >
                            {isImporting ? <Spinner /> : 'حفظ واستيراد البيانات'}
                        </Button>
                    </div>
                </Modal>
            )}

            {/* --- Tracking & Aggregation --- */}
            {activeTab === 'tracking' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800 font-medium">
                            <strong>نظام التجميع والمتابعة:</strong> يتم إدخال بيانات التنفيذ الفعلي حصراً عبر الخطط <strong>التشغيلية الأسبوعية</strong>. 
                            الخطط الشهرية والربع سنوية تعرض تقارير تجميعية بناءً على إنجازات الأسابيع المرتبطة بها.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {opPlans.map(op => {
                            const isWeekly = op.planType === PLAN_TYPES.WEEKLY;
                            return (
                                <div key={op.id} onClick={() => { setCurrentOpPlan(op); setIsTrackingModalOpen(true); }} className="cursor-pointer">
                                    <Card className={`hover:shadow-md transition-all border-r-4 ${isWeekly ? 'border-r-green-500 bg-green-50/10' : 'border-r-blue-500'}`}>
                                        <CardBody className="flex justify-between items-center">
                                            <div>
                                                <div className={`text-[10px] font-bold uppercase mb-1 ${isWeekly ? 'text-green-600' : 'text-blue-600'}`}>
                                                    عام {op.year} - {op.planType}
                                                </div>
                                                <h4 className="font-bold text-gray-800">{op.periodName}</h4>
                                            </div>
                                            {isWeekly ? (
                                                <Button size="sm" variant="success"><Edit size={14} className="ml-1"/> تحديث التنفيذ</Button>
                                            ) : (
                                                <Button size="sm" variant="secondary"><Calculator size={14} className="ml-1"/> عرض التجميع</Button>
                                            )}
                                        </CardBody>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {isTrackingModalOpen && currentOpPlan && (
                <Modal isOpen={isTrackingModalOpen} onClose={() => setIsTrackingModalOpen(false)} title={`${currentOpPlan.planType === PLAN_TYPES.WEEKLY ? 'تحديث إنجاز' : 'تقرير تجميعي'}: ${currentOpPlan.periodName} - عام ${currentOpPlan.year}`} size="6xl">
                    <form onSubmit={(e) => { e.preventDefault(); upsertOperationalPlan(currentOpPlan).then(() => { fetchOperationalPlans(true); setIsTrackingModalOpen(false); }); }}>
                        <CardBody className="p-0 max-h-[70vh] overflow-y-auto">
                            <Table headers={["النشاط", "المستهدف", "الأساس المحدث", "المنفذ الفعلي", "التكلفة الفعلية", "نسبة الإنجاز"]}>
                                {getAggregatedData(currentOpPlan).map(a => {
                                    const base = getDynamicBaseline(a.masterPlanId, a.interventionId, currentOpPlan.id);
                                    const perc = a.target > 0 ? Math.round((a.achieved / a.target) * 100) : 0;
                                    const isReadonly = currentOpPlan.planType !== PLAN_TYPES.WEEKLY;
                                    const masterPlan = plans.find(p => p.id === a.masterPlanId);
                                    const interventionName = masterPlan?.interventions?.find(i => i.id === a.interventionId)?.name || 'نشاط غير معروف';

                                    return (
                                        <tr key={a.id} className={isReadonly ? 'bg-blue-50/30' : ''}>
                                            <td className="p-3 text-sm font-bold w-1/4 break-words whitespace-normal">{interventionName}</td>
                                            <td className="p-3 text-center font-bold text-indigo-600">{a.target}</td>
                                            <td className="p-3 text-center bg-gray-100/50 text-xs font-medium">{base}</td>
                                            <td className="p-3 w-32">
                                                {isReadonly ? (
                                                    <div className="text-center font-bold text-blue-700">{a.achieved}</div>
                                                ) : (
                                                    <Input 
                                                        type="number" 
                                                        value={a.achieved || 0} 
                                                        onChange={(e) => handleUpdateWeeklyTracking(a.id, 'achieved', e.target.value)} 
                                                        className="text-center font-bold text-green-700 border-green-200" 
                                                    />
                                                )}
                                            </td>
                                            <td className="p-3 w-32">
                                                {isReadonly ? (
                                                    <div className="text-center font-medium">{Number(a.actualCost).toLocaleString()}</div>
                                                ) : (
                                                    <Input 
                                                        type="number" 
                                                        value={a.actualCost || 0} 
                                                        onChange={(e) => handleUpdateWeeklyTracking(a.id, 'actualCost', e.target.value)} 
                                                        className="text-center" 
                                                    />
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div 
                                                            className={`h-2 rounded-full ${perc >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} 
                                                            style={{ width: `${Math.min(perc, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-bold w-10">{perc}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </Table>
                        </CardBody>
                        <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                            <Button type="button" variant="secondary" onClick={() => setIsTrackingModalOpen(false)}>إغلاق</Button>
                            {currentOpPlan.planType === PLAN_TYPES.WEEKLY && (
                                <Button type="submit" variant="success">حفظ الإنجازات الأسبوعية</Button>
                            )}
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}