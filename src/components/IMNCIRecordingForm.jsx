import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, PageHeader, Button } from './CommonComponents'; 
import { AlertCircle, Baby, User, ClipboardList, CheckSquare, CalendarDays, UserSquare2, Ruler, Weight, Thermometer, Building, LayoutDashboard, Activity, Syringe, ArrowRight, CheckCircle, XCircle, FileText, X, Check, Stethoscope, Users, ArrowLeft } from 'lucide-react';
import zScoreData from './zscore_reference_data.json'; 
import { STATE_LOCALITIES } from './constants'; 

// --- Firebase & Context Imports ---
import { db } from '../firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useDataCache } from '../DataContext';
import { notify } from './dialogs';
import { saveIMNCIPatientRecord } from '../data';

// The protocol behind every classification on this screen is edited here too,
// so the two live in one module rather than in separate places that have to be
// kept in step by whoever remembers.
const ProtocolEditor = lazy(() => import('./ProtocolEditor'));

// ============================================================================
// DYNAMIC DOSE CALCULATOR ENGINE (Reads from Database)
// ============================================================================
const resolveDoseTag = (drugKey, weight, ageInMonths, dosagesProtocol) => {
    if (!dosagesProtocol || !dosagesProtocol.drugs) return "Loading dose...";
    
    const drug = dosagesProtocol.drugs.find(d => d.id === drugKey);
    if (!drug) return "Dose: Unknown";

    const w = parseFloat(weight) || 0;
    const a = parseFloat(ageInMonths) || 0;

    if (w === 0 && a === 0) return drug.fallback || "Check manual chart";

    for (const rule of drug.rules || []) {
        const minW = parseFloat(rule.minWeight) || 0;
        const maxW = rule.maxWeight === '' || rule.maxWeight === undefined ? 999 : parseFloat(rule.maxWeight);
        
        const minA = parseFloat(rule.minAge) || 0;
        const maxA = rule.maxAge === '' || rule.maxAge === undefined ? 999 : parseFloat(rule.maxAge);

        const isPureAgeRule = minW === 0 && maxW >= 99;
        const isPureWeightRule = minA === 0 && maxA >= 99;

        let match = false;

        if (isPureAgeRule) {
            if (a >= minA && a <= maxA) match = true;
        } else if (isPureWeightRule) {
            if (w >= minW && w <= maxW) match = true;
        } else {
            // Mixed rule: PREFER WEIGHT over AGE
            if (w > 0) {
                if (w >= minW && w <= maxW) match = true;
            } else if (a > 0) {
                if (a >= minA && a <= maxA) match = true;
            }
        }

        if (match) {
            const parts = [];
            if (rule.doseQty) parts.push(rule.doseQty);
            if (rule.doseFreq) parts.push(`(${rule.doseFreq})`);
            if (rule.doseDuration) parts.push(`— ${rule.doseDuration}`);
            return parts.join(' ');
        }
    }
    
    return drug.fallback || "Check manual chart (Out of range)";
};

// ============================================================================
// DYNAMIC RULE EVALUATOR ENGINE
// ============================================================================
const evaluateProtocol = (computedAssessments, currentProtocol, defaultCategories, weight, ageInMonths, dosagesProtocol) => {
    const evaluatedCategories = { ...defaultCategories };

    if (!currentProtocol || !currentProtocol.categories) {
        return evaluatedCategories; 
    }

    Object.entries(currentProtocol.categories).forEach(([catKey, categoryData]) => {
        if (!evaluatedCategories[catKey]) evaluatedCategories[catKey] = { c: [], t: [] };
        
        for (const rule of categoryData.rules || []) {
            let isMatch = false;

            if (rule.type === 'ANY') {
                isMatch = rule.conditions.some(cond => computedAssessments[cond] === true);
            } else if (rule.type === 'ALL') {
                isMatch = rule.conditions.every(cond => computedAssessments[cond] === true);
            } else if (rule.type === 'COUNT_GTE') {
                const trueCount = rule.conditions.filter(cond => computedAssessments[cond] === true).length;
                isMatch = trueCount >= (rule.threshold || 2);
            }

            if (isMatch) {
                evaluatedCategories[catKey].c.push(rule.classification);
                
                const processedTreatments = rule.treatments.map(tStr => {
                    return tStr.replace(/{{dose:(.*?)}}/g, (match, drugKey) => {
                        return `|||${resolveDoseTag(drugKey, weight, ageInMonths, dosagesProtocol)}|||`;
                    });
                });
                
                evaluatedCategories[catKey].t.push(...processedTreatments);
                break; 
            }
        }
    });

    return evaluatedCategories;
};

// ============================================================================
// RECORD DETAILS MODAL
// ============================================================================
const RecordDetailsModal = ({ record, onClose }) => {
    if (!record) return null;

    const pd = record.patientData || {};
    const cls = record.classifications || {};

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 animate-fade-in" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-sky-600" /> تفاصيل حالة الطفل: {pd.childName || 'غير متوفر'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors p-1 bg-white rounded-full shadow-sm border border-slate-200">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl">
                        <h3 className="font-bold text-sky-800 mb-3 border-b border-sky-200 pb-2">البيانات الأساسية</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div><span className="text-slate-500 block">التاريخ:</span> <span className="font-bold">{pd.date}</span></div>
                            <div><span className="text-slate-500 block">العمر:</span> <span className="font-bold">{pd.ageDaysWeeks || pd.ageMonths} {record.formType === 'infant' ? 'يوم/أسبوع' : 'شهر'}</span></div>
                            {pd.sex && <div><span className="text-slate-500 block">الجنس:</span> <span className="font-bold">{pd.sex === 'male' ? 'ذكر' : 'أنثى'}</span></div>}
                            <div><span className="text-slate-500 block">الوزن:</span> <span className="font-bold">{pd.weightKg || '-'} كجم</span></div>
                            {pd.lengthCm && <div><span className="text-slate-500 block">الطول:</span> <span className="font-bold">{pd.lengthCm} سم</span></div>}
                            <div><span className="text-slate-500 block">الحرارة:</span> <span className="font-bold">{pd.tempC || '-'} °C</span></div>
                            <div><span className="text-slate-500 block">نوع الزيارة:</span> <span className="font-bold">{pd.visitType === 'initial' ? 'زيارة أولى' : 'متابعة'}</span></div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 text-lg border-b border-slate-200 pb-2">التصنيفات والعلاج</h3>
                        {Object.entries(cls).map(([catKey, catData]) => {
                            if (!catData?.c || catData.c.length === 0) return null;
                            if (catData.c.every(c => c.color === 'bg-green-500') && catData.t.length === 0 && catKey !== 'vaccine') return null;

                            return (
                                <div key={catKey} className="border border-slate-200 rounded-lg overflow-hidden">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="md:w-1/3 p-3 bg-slate-50 border-b md:border-b-0 md:border-l border-slate-200 flex flex-col gap-2 justify-center">
                                            {catData.c.map((classification, idx) => (
                                                <div key={idx} className={`${classification.color} text-white text-center font-bold text-sm px-2 py-2 rounded shadow-sm`}>
                                                    {classification.label}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="md:w-2/3 p-4 bg-white">
                                            {catData.t && catData.t.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {catData.t.map((treatment, idx) => {
                                                        const isChecked = record.treatmentsAdministered?.includes(treatment);
                                                        return (
                                                            <li key={idx} className="flex gap-2 text-sm items-start">
                                                                {isChecked ? (
                                                                    <CheckSquare size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                                                                ) : (
                                                                    <div className="mt-0.5 w-4 h-4 flex-shrink-0 border-2 border-slate-300 rounded-sm"></div>
                                                                )}
                                                                <span className={isChecked ? 'font-semibold text-slate-800' : 'text-slate-600'}>
                                                                    {treatment}
                                                                </span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            ) : (
                                                <span className="text-sm text-slate-400 italic">لا توجد علاجات إضافية.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// SAVE STATUS POPUP
// ============================================================================
const SaveStatusPopup = ({ status, onClose, onBack }) => {
    if (!status) return null;
    const isSuccess = status.type === 'success';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 animate-fade-in" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform scale-100 transition-transform">
                <div className={`mb-4 flex justify-center ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
                    {isSuccess ? <CheckCircle className="w-16 h-16" /> : <XCircle className="w-16 h-16" />}
                </div>
                <h3 className="text-xl font-extrabold mb-2 text-gray-800">{isSuccess ? 'تم الحفظ بنجاح' : 'فشل الحفظ'}</h3>
                <p className="text-gray-600 mb-6 text-sm font-medium">{status.message}</p>
                <div className="flex flex-col gap-3">
                    {isSuccess ? (
                        <>
                            <Button onClick={onClose} className="w-full font-bold py-3 rounded-xl">إدخال حالة جديدة (نفس المنشأة)</Button>
                            <Button onClick={onBack} variant="secondary" className="w-full font-bold py-3 rounded-xl">العودة للقائمة الرئيسية</Button>
                        </>
                    ) : (
                        <Button onClick={onClose} variant="secondary" className="w-full font-bold py-3 rounded-xl">حسناً (إغلاق)</Button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// DASHBOARD & REPORT COMPONENT 
// ============================================================================
const IMNCIDashboard = ({ onNavigate, records, isLoading }) => {
    const { t } = useTranslation();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [dashboardTab, setDashboardTab] = useState('report'); 
    const [selectedRecordDetails, setSelectedRecordDetails] = useState(null);

    const filteredRecords = useMemo(() => {
        if (!records) return [];
        return records.filter(r => {
            const dateStr = r.patientData?.date;
            let d;
            if (dateStr) {
                const [year, month, day] = dateStr.split('-');
                d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else if (r.createdAt) {
                d = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
            } else return false;
            return d.getMonth() + 1 === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
        }).sort((a, b) => new Date(b.patientData?.date || 0).getTime() - new Date(a.patientData?.date || 0).getTime());
    }, [records, selectedMonth, selectedYear]);

    const stats = useMemo(() => {
        const data = {
            totalVisits: 0, infants: 0, children: 0, referred: 0, vaccineUpToDate: 0, vaccineNotUpToDate: 0,
            infant: { severeBacterial: 0, localBacterial: 0, severeJaundice: 0, jaundice: 0, bloodStool: 0, feeding: 0 },
            child: { severePneumonia: 0, pneumonia: 0, cough: 0, mastoiditis: 0, acuteEar: 0, chronicEar: 0, diarrheaDehydration: 0, diarrheaNoDehydration: 0, persistent: 0, dysentery: 0, samComplicated: 0, samUncomplicated: 0, mam: 0, severeAnemia: 0, anemia: 0, severeFebrile: 0, malaria: 0, measlesComp: 0, measles: 0, feedingProblem: 0, otherProblems: 0 }
        };

        filteredRecords.forEach(r => {
            data.totalVisits++;
            const c = r.classifications || {};
            const a = r.assessments || {};
            const hasRed = (cat) => c[cat]?.c?.some(cls => cls.color === 'bg-red-500');
            const hasYellow = (cat) => c[cat]?.c?.some(cls => cls.color === 'bg-yellow-400');
            const hasGreen = (cat) => c[cat]?.c?.some(cls => cls.color === 'bg-green-500');

            let isReferred = false;
            Object.keys(c).forEach(k => { if (hasRed(k)) isReferred = true; });
            if (isReferred) data.referred++;
            if (hasGreen('vaccine')) data.vaccineUpToDate++; else data.vaccineNotUpToDate++;

            if (r.formType === 'infant') {
                data.infants++;
                if (hasRed('infection') || hasRed('bacterial_infection')) data.infant.severeBacterial++;
                if (hasYellow('infection') || hasYellow('bacterial_infection')) data.infant.localBacterial++;
                if (hasRed('jaundice')) data.infant.severeJaundice++;
                if (hasYellow('jaundice')) data.infant.jaundice++;
                if (a.bloodInStool) data.infant.bloodStool++;
                if (hasYellow('feeding') || hasYellow('feeding_problem')) data.infant.feeding++;
            } else {
                data.children++;
                if (hasRed('cough') || hasRed('danger')) data.child.severePneumonia++;
                else if (hasYellow('cough')) data.child.pneumonia++;
                else if (hasGreen('cough')) data.child.cough++;

                if (hasRed('ear')) data.child.mastoiditis++;
                else if (hasYellow('ear')) {
                    if (parseInt(a.earDischargeDays || 0) >= 14) data.child.chronicEar++;
                    else data.child.acuteEar++;
                }

                if (hasRed('diarrhea') || hasRed('diarrhea_dehydration') || (hasYellow('diarrhea_dehydration') || hasYellow('diarrhea'))) data.child.diarrheaDehydration++;
                else if (hasGreen('diarrhea') || hasGreen('diarrhea_dehydration')) data.child.diarrheaNoDehydration++;
                if (parseInt(a.diarrheaDays || 0) >= 14) data.child.persistent++;
                if (a.bloodInStool) data.child.dysentery++;

                if (hasRed('malnutrition')) data.child.samComplicated++;
                else if (hasYellow('malnutrition')) {
                    const muac = parseFloat(a.muacCm || 0);
                    if (muac > 0 && muac < 11.5) data.child.samUncomplicated++;
                    else data.child.mam++;
                }

                if (hasRed('anemia')) data.child.severeAnemia++;
                if (hasYellow('anemia')) data.child.anemia++;

                if (hasRed('fever') || hasRed('fever_malaria')) data.child.severeFebrile++;
                if (a.malariaTest === 'positive') data.child.malaria++;
                if (a.measles3Months || a.measlesRash) {
                    if (a.corneaClouding || a.pusFromEye || a.mouthUlcers || a.deepExtensiveUlcers) data.child.measlesComp++;
                    else data.child.measles++;
                }

                if (a.feedingStatus === 'problem') data.child.feedingProblem++;
                if (a.hasOtherProblems) data.child.otherProblems++;
            }
        });

        return data;
    }, [filteredRecords]);

    const pct = (val, total) => total > 0 ? Math.round((val / total) * 100) : 0;

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <RecordDetailsModal record={selectedRecordDetails} onClose={() => setSelectedRecordDetails(null)} />

            <div className="flex justify-start">
                <Button variant="secondary" onClick={() => onNavigate('nav')} className="flex items-center gap-2 font-bold bg-white text-slate-700 shadow-sm border border-slate-200">
                    <ArrowRight size={18} /> العودة إلى القائمة الرئيسية
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button onClick={() => onNavigate('infant')} className="text-right cursor-pointer focus:outline-none w-full h-full block">
                    <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-sky-500 group h-full">
                        <div className="p-6 flex items-center gap-6">
                            <div className="p-4 bg-sky-100 text-sky-600 rounded-2xl group-hover:scale-110 transition-transform">
                                <Baby size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-sky-900">تسجيل طفل أقل من شهرين</h3>
                                <p className="text-sky-600 text-sm mt-1">إدخال بيانات التقييم والعلاج للرضع (Young Infant Form)</p>
                            </div>
                        </div>
                    </Card>
                </button>

                <button onClick={() => onNavigate('child')} className="text-right cursor-pointer focus:outline-none w-full h-full block">
                    <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-indigo-500 group h-full">
                        <div className="p-6 flex items-center gap-6">
                            <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
                                <User size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-indigo-900">تسجيل طفل من شهرين إلى 5 سنوات</h3>
                                <p className="text-indigo-600 text-sm mt-1">إدخال بيانات التقييم والعلاج للأطفال (Sick Child Form)</p>
                            </div>
                        </div>
                    </Card>
                </button>
            </div>

            <Card>
                <div className="bg-emerald-700 p-4 rounded-t-md flex flex-col md:flex-row justify-between items-center text-white">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <LayoutDashboard size={20} /> لوحة بيانات وتقارير IMNCI
                    </h2>
                    <div className="flex gap-3 mt-3 md:mt-0 text-slate-800">
                        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-1.5 rounded text-sm font-bold bg-white outline-none">
                            {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>شهر {m}</option>)}
                        </select>
                        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="p-1.5 rounded text-sm font-bold bg-white outline-none">
                            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 space-y-6">
                    <div className="flex gap-4 border-b border-slate-200 pb-2">
                        <button className={`pb-2 font-bold px-4 text-sm sm:text-base transition-colors ${dashboardTab === 'report' ? 'border-b-4 border-emerald-600 text-emerald-800' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setDashboardTab('report')}>تقرير الإحصائيات (Report)</button>
                        <button className={`pb-2 font-bold px-4 text-sm sm:text-base transition-colors ${dashboardTab === 'records' ? 'border-b-4 border-emerald-600 text-emerald-800' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setDashboardTab('records')}>سجل الحالات الفردية (Individual Records)</button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-10 text-slate-500">جاري تحميل البيانات...</div>
                    ) : dashboardTab === 'report' ? (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                                    <span className="text-slate-500 text-sm font-bold mb-1">إجمالي الحالات المسجلة</span>
                                    <span className="text-3xl font-black text-slate-800">{stats.totalVisits}</span>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col items-center justify-center">
                                    <span className="text-red-500 text-sm font-bold mb-1 flex items-center gap-1"><AlertCircle size={14}/> حالات خطرة (محولة)</span>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-red-600">{stats.referred}</span>
                                        <span className="text-sm font-bold text-red-400 mb-1">({pct(stats.referred, stats.totalVisits)}%)</span>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex flex-col items-center justify-center">
                                    <span className="text-green-600 text-sm font-bold mb-1 flex items-center gap-1"><Syringe size={14}/> مكتملي التطعيم</span>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-green-600">{stats.vaccineUpToDate}</span>
                                        <span className="text-sm font-bold text-green-400 mb-1">({pct(stats.vaccineUpToDate, stats.totalVisits)}%)</span>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm flex flex-col items-center justify-center">
                                    <span className="text-sky-600 text-sm font-bold mb-1 flex items-center gap-1"><Activity size={14}/> أمراض الجهاز التنفسي</span>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-sky-600">{stats.child.pneumonia + stats.child.severePneumonia}</span>
                                        <span className="text-sm font-bold text-sky-400 mb-1">حالة</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border-2 border-slate-800 rounded shadow-md overflow-hidden">
                                <div className="bg-slate-100 p-4 text-center border-b-2 border-slate-800">
                                    <h3 className="font-black text-xl text-slate-900">البرنامج القومي لصحة الطفل - تقرير شهري من مؤسسة الرعاية الصحية الأساسية</h3>
                                </div>
                                <table className="w-full text-sm border-collapse text-right">
                                    <tbody>
                                        <tr className="bg-slate-50 font-bold border-b-2 border-slate-800">
                                            <td className="p-3 border-l border-slate-300 w-1/2">عدد الاطفال (اقل من عمر شهرين): <span className="text-blue-600 ml-2">{stats.infants}</span></td>
                                            <td className="p-3">عدد الاطفال من عمر شهرين الى أقل من خمسة سنوات: <span className="text-blue-600 ml-2">{stats.children}</span></td>
                                        </tr>
                                        <tr className="bg-slate-200 border-y border-slate-800 font-bold text-center">
                                            <td colSpan={2} className="p-2">تصنيفات وعدد الحالات المرضية للمترددين من الأطفال عمر أقل من شهرين:</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-0">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-100 border-b border-slate-300">
                                                            <th className="p-2 border-l border-slate-300 w-3/4">التصنيف</th>
                                                            <th className="p-2 w-1/4 text-center">عدد الحالات</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold">التهاب بكتيري: احتمال الإصابة بالتهاب بكتيري خطير</td><td className="p-2 text-center text-red-600 font-bold">{stats.infant.severeBacterial}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">التهاب بكتيري: التهاب بكتيري موضعي</td><td className="p-2 text-center font-bold">{stats.infant.localBacterial}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold">يرقان: يرقان شديد</td><td className="p-2 text-center text-red-600 font-bold">{stats.infant.severeJaundice}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">يرقان: يرقان</td><td className="p-2 text-center font-bold">{stats.infant.jaundice}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">إسهال: دم في البراز</td><td className="p-2 text-center font-bold">{stats.infant.bloodStool}</td></tr>
                                                        <tr className="border-b border-slate-800"><td className="p-2 border-l border-slate-300">مشكلة في التغذية أو نقص في الوزن</td><td className="p-2 text-center font-bold">{stats.infant.feeding}</td></tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-200 border-b border-slate-800 font-bold text-center">
                                            <td colSpan={2} className="p-2">تصنيفات وعدد الحالات المرضية للمترددين من الأطفال عمر شهرين إلى أقل من 5 سنوات:</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-0">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-100 border-b border-slate-300">
                                                            <th className="p-2 border-l border-slate-300 w-3/4">التصنيف</th>
                                                            <th className="p-2 w-1/4 text-center">عدد الحالات</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold">التهابات الجهاز التنفسي: التهاب رئوي شديد أو مرض شديد جداً</td><td className="p-2 text-center text-red-600 font-bold">{stats.child.severePneumonia}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">التهابات الجهاز التنفسي: التهاب رئوي</td><td className="p-2 text-center font-bold">{stats.child.pneumonia}</td></tr>
                                                        <tr className="border-b border-slate-300 bg-slate-50"><td className="p-2 border-l border-slate-300">التهابات الجهاز التنفسي: كحة أو نزلة برد</td><td className="p-2 text-center font-bold">{stats.child.cough}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold">التهاب الأذن: التهاب عظمة خلف الأذن</td><td className="p-2 text-center text-red-600 font-bold">{stats.child.mastoiditis}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">التهاب الأذن: التهاب الأذن الحاد</td><td className="p-2 text-center font-bold">{stats.child.acuteEar}</td></tr>
                                                        <tr className="border-b border-slate-300 bg-slate-50"><td className="p-2 border-l border-slate-300">التهاب الأذن: التهاب الأذن المزمن</td><td className="p-2 text-center font-bold">{stats.child.chronicEar}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold">إسهالات: إسهال يوجد جفاف</td><td className="p-2 text-center text-red-600 font-bold">{stats.child.diarrheaDehydration}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">إسهالات: إسهال لا يوجد جفاف</td><td className="p-2 text-center font-bold">{stats.child.diarrheaNoDehydration}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">إسهالات: إسهال مستمر</td><td className="p-2 text-center font-bold">{stats.child.persistent}</td></tr>
                                                        <tr className="border-b border-slate-300 bg-slate-50"><td className="p-2 border-l border-slate-300">إسهالات: دسنتاريا (دم في البراز)</td><td className="p-2 text-center font-bold">{stats.child.dysentery}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold">سوء التغذية: سوء التغذية الحاد الشديد مصحوب بمضاعفات</td><td className="p-2 text-center text-red-600 font-bold">{stats.child.samComplicated}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">سوء التغذية: سوء التغذية الحاد الشديد غير مصحوب بمضاعفات</td><td className="p-2 text-center font-bold">{stats.child.samUncomplicated}</td></tr>
                                                        <tr className="border-b border-slate-300 bg-slate-50"><td className="p-2 border-l border-slate-300">سوء التغذية: سوء التغذية الحاد المتوسط</td><td className="p-2 text-center font-bold">{stats.child.mam}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold">فقر الدم: فقر دم شديد</td><td className="p-2 text-center text-red-600 font-bold">{stats.child.severeAnemia}</td></tr>
                                                        <tr className="border-b border-slate-300 bg-slate-50"><td className="p-2 border-l border-slate-300">فقر الدم: فقر دم</td><td className="p-2 text-center font-bold">{stats.child.anemia}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold">حمى: مرض حمي شديد</td><td className="p-2 text-center text-red-600 font-bold">{stats.child.severeFebrile}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">حمى: ملاريا</td><td className="p-2 text-center font-bold">{stats.child.malaria}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold">حمى: حصبة مصحوبة بمضاعفات في العين والفم</td><td className="p-2 text-center text-red-600 font-bold">{stats.child.measlesComp}</td></tr>
                                                        <tr className="border-b border-slate-300 bg-slate-50"><td className="p-2 border-l border-slate-300">حمى: حصبة</td><td className="p-2 text-center font-bold">{stats.child.measles}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">مشاكل التغذية</td><td className="p-2 text-center font-bold">{stats.child.feedingProblem}</td></tr>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300">مشاكل أخرى</td><td className="p-2 text-center font-bold">{stats.child.otherProblems}</td></tr>
                                                        <tr className="border-b border-slate-800 bg-slate-50"><td className="p-2 border-l border-slate-300 font-bold text-slate-800">الأطفال المحولين (الحالات الخطرة)</td><td className="p-2 text-center font-bold text-slate-800">{stats.referred}</td></tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-200 border-b border-slate-800 font-bold text-center">
                                            <td colSpan={2} className="p-2">حالة التطعيمات وفيتامين أ: عدد الاطفال المواكبين وغير المواكبين</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-0">
                                                <table className="w-full border-collapse">
                                                    <tbody>
                                                        <tr className="border-b border-slate-200"><td className="p-2 border-l border-slate-300 font-bold w-3/4">مواكب (Up to date)</td><td className="p-2 text-center font-bold w-1/4 text-green-600">{stats.vaccineUpToDate}</td></tr>
                                                        <tr><td className="p-2 border-l border-slate-300 font-bold">غير مواكب (Not up to date)</td><td className="p-2 text-center font-bold text-red-600">{stats.vaccineNotUpToDate}</td></tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm animate-fade-in">
                            <table className="min-w-full border-collapse text-sm text-right">
                                <thead className="bg-slate-100 border-b border-slate-300">
                                    <tr>
                                        <th className="p-4 font-bold text-slate-700">تاريخ الزيارة</th>
                                        <th className="p-4 font-bold text-slate-700">اسم الطفل</th>
                                        <th className="p-4 font-bold text-slate-700">الفئة العمرية</th>
                                        <th className="p-4 font-bold text-slate-700">نوع الزيارة</th>
                                        <th className="p-4 font-bold text-slate-700 text-center">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length === 0 ? (
                                        <tr><td colSpan="5" className="p-8 text-center text-slate-500 font-medium">لا توجد سجلات مسجلة في هذا الشهر.</td></tr>
                                    ) : (
                                        filteredRecords.map(r => (
                                            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="p-4 text-slate-600">{r.patientData?.date || 'N/A'}</td>
                                                <td className="p-4 font-bold text-slate-800">{r.patientData?.childName || 'غير متوفر'}</td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${r.formType === 'infant' ? 'bg-sky-100 text-sky-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                        {r.formType === 'infant' ? 'أقل من شهرين' : 'شهرين إلى 5 سنوات'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-600">{r.patientData?.visitType === 'initial' ? 'زيارة أولى' : 'متابعة'}</td>
                                                <td className="p-4 text-center">
                                                    <Button size="sm" variant="secondary" onClick={() => setSelectedRecordDetails(r)}>
                                                        عرض التفاصيل
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

// --- Reusable Grid Row Component for IMNCI Layout ---
const AssessmentRow = ({ title, isConditional = false, yesNoValue, onYesNoChange, children, classifyData = [], treatmentData = [], selectedTreatments = {}, onToggleTreatment }) => {
    const { t } = useTranslation();
    const isActive = isConditional ? yesNoValue === true : true;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-slate-300 bg-white">
            <div className="lg:col-span-6 p-4 border-r-0 lg:border-r border-slate-300 flex flex-col justify-start">
                {title && isConditional ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-100 p-3 rounded-md mb-3 border border-slate-200">
                        <span className="font-semibold text-slate-800">{title}</span>
                        <div className="flex gap-4 mt-2 sm:mt-0">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" checked={yesNoValue === true} onChange={() => onYesNoChange(true)} className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer" />
                                <span className="text-sm font-bold text-slate-700">{t('imci.common.yes')}</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" checked={yesNoValue === false} onChange={() => onYesNoChange(false)} className="w-4 h-4 text-slate-400 focus:ring-slate-400 cursor-pointer" />
                                <span className="text-sm font-bold text-slate-700">{t('imci.common.no')}</span>
                            </label>
                        </div>
                    </div>
                ) : title ? (
                    <div className="font-semibold text-slate-800 mb-3 bg-slate-100 p-3 rounded-md border border-slate-200 flex items-center gap-2">
                        {title}
                    </div>
                ) : null}
                
                {isActive && <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">{children}</div>}
            </div>
            
            <div className="lg:col-span-2 p-4 border-r-0 lg:border-r border-slate-300 bg-slate-50 flex flex-col gap-2 justify-center items-center text-center">
                {isActive && classifyData.map((c, i) => (
                    <div key={i} className={`${c.color || 'bg-slate-500'} text-white w-full px-2 py-2 rounded shadow-sm text-sm font-bold leading-tight uppercase`}>
                        {c.label}
                    </div>
                ))}
            </div>

            <div className="lg:col-span-4 p-3 flex flex-col justify-center bg-white border-l border-slate-100">
                {isActive && treatmentData.length > 0 ? (
                    <div className="space-y-1.5">
                        {treatmentData.map((tItem, i) => {
                            const parts = typeof tItem === 'string' ? tItem.split('|||') : [tItem];
                            const mainText = parts[0];
                            const doseBadge = parts.length > 1 ? parts[1] : null;
                            const isSelected = selectedTreatments[tItem] || false;
                            const isClickable = typeof tItem === 'string' && onToggleTreatment;

                            return (
                                <div 
                                    key={i} 
                                    onClick={() => isClickable && onToggleTreatment(tItem)}
                                    className={`w-full flex items-start text-left gap-2 p-2 rounded-lg border transition-all ${
                                        isClickable ? 'cursor-pointer hover:shadow-sm hover:border-sky-300' : ''
                                    } ${
                                        isSelected 
                                        ? 'bg-sky-50 border-sky-400 shadow-sm' 
                                        : 'bg-slate-50/50 border-slate-200'
                                    }`}
                                >
                                    {isClickable && (
                                        <div className={`mt-0.5 rounded flex items-center justify-center w-4 h-4 flex-shrink-0 transition-colors border ${
                                            isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-transparent'
                                        }`}>
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                    )}
                                    {!isClickable && (
                                        <div className="mt-0.5 w-4 h-4 flex-shrink-0 flex items-center justify-center"><CheckSquare size={14} className="text-slate-400"/></div>
                                    )}
                                    <div className="flex-1 flex flex-col gap-1.5">
                                        <span className={`text-xs font-semibold leading-snug ${isSelected ? 'text-sky-900' : 'text-slate-700'}`}>
                                            {mainText}
                                        </span>
                                        {doseBadge && (
                                            <div>
                                                <span className={`inline-block border font-bold px-2 py-0.5 rounded text-[10px] sm:text-[11px] shadow-sm whitespace-normal break-words ${isSelected ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                    {doseBadge}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : isActive ? (
                    <span className="text-xs text-slate-400 italic font-medium block text-center p-3 bg-slate-50 rounded-lg border border-slate-100">{t('imci.common_phrases.no_treatments', 'لا توجد علاجات إضافية')}</span>
                ) : null}
            </div>
        </div>
    );
};

// ============================================================================
// FORM 1: SICK YOUNG INFANT (UP TO 2 MONTHS)
// ============================================================================
function InfantForm({ selectedState, selectedLocality, selectedFacility, onBack, onSaveSuccess }) {
    const { t } = useTranslation();
    const { protocols } = useDataCache();
    const [isSaving, setIsSaving] = useState(false);
    const [statusModal, setStatusModal] = useState(null);
    const [selectedTreatments, setSelectedTreatments] = useState({});

    const initialInfantData = {
        date: new Date().toISOString().split('T')[0], childName: '', ageDaysWeeks: '', weightKg: '', tempC: '',
        problems: '', visitType: 'initial'
    };
    const initialAssessments = {
        notFeedingWell: false, convulsions: false, convulsingNow: false, movementOnlyStimulatedNoMovement: false,
        breathRate: '', fastBreathing: false, severeChestIndrawing: false, fever38: false, lowTemp35_5: false,
        umbilicusRedDraining: false, pusFromEyes: false, skinPustules: false,
        hasJaundice: null, jaundiceFirst24h: false, jaundiceLowWeight: false, jaundiceSolesPalms: false,
        hasDiarrhea: null, diarrheaDays: '', bloodInStool: false, diarrheaMovement: false, diarrheaRestless: false,
        diarrheaSunkenEyes: false, pinchVerySlow: false, pinchSlow: false,
        diffFeeding: null, breastfed: null, breastfeedTimes: '', otherFoods: null, otherFoodsOften: '', feedTool: '',
        weightForAgeLow: false, thrush: false,
        wellPositioned: null, posInLine: null, posNoseOpposite: null, posCloseBody: null, posWholeBodySupported: null,
        goodAttachment: null, attChinTouching: null, attMouthWide: null, attLowerLipOut: null, attAreolaAbove: null,
        suckingEffectively: null,
        v_opv0: false, v_bcg: false, v_opv1: false, v_rota1: false, v_pcv1: false, v_penta1: false, v_ipv1: false,
        vaccineStatus: '', nextVaccine: '',
        hasOtherProblems: null, otherProblemsText: '', followUpDays: ''
    };

    const [infantData, setInfantData] = useState({ ...initialInfantData });
    const [assessments, setAssessments] = useState({ ...initialAssessments });

    const handleDataChange = (e) => setInfantData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleCheckboxChange = (e) => setAssessments(prev => ({ ...prev, [e.target.name]: e.target.checked }));
    const handleRadioChange = (e) => setAssessments(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const toggleTreatment = (tItem) => setSelectedTreatments(prev => ({ ...prev, [tItem]: !prev[tItem] }));

    const results = useMemo(() => {
        const computedAssessments = {
            ...assessments,
            fastBreathing60: assessments.fastBreathing,
            fever37_5: assessments.fever38 || (parseFloat(infantData.tempC) >= 37.5),
            noBacterialSigns: !(assessments.convulsions || assessments.notFeedingWell || assessments.movementOnlyStimulatedNoMovement || assessments.fastBreathing || assessments.severeChestIndrawing || assessments.fever38 || assessments.lowTemp35_5 || assessments.umbilicusRedDraining || assessments.pusFromEyes || assessments.skinPustules),
            jaundiceAfter24h: assessments.hasJaundice && !assessments.jaundiceFirst24h && !assessments.jaundiceSolesPalms && !assessments.jaundiceLowWeight,
            feedsLessThan8Times: parseInt(assessments.breastfeedTimes || 8) < 8,
            receivesOtherFoods: assessments.otherFoods === 'yes',
            lowWeightForAge: assessments.weightForAgeLow,
            notWellAttached: assessments.goodAttachment === 'notWell',
            notSucklingEffectively: assessments.suckingEffectively === 'notEffective',
            feedingWellNormalWeight: assessments.diffFeeding !== 'yes' && parseInt(assessments.breastfeedTimes || 8) >= 8 && assessments.otherFoods !== 'yes' && !assessments.weightForAgeLow && !assessments.thrush
        };

        const defaultCategories = {
            bacterial_infection: { c: [], t: [] }, jaundice: { c: [], t: [] }, diarrhea: { c: [], t: [] },
            feeding_problem: { c: [], t: [] }, vaccine: { c: [], t: [] }, other: { c: [], t: [] }
        };

        const weight = parseFloat(infantData.weightKg) || 0;
        
        let ageInMonths = 1;
        const ageStr = String(infantData.ageDaysWeeks || '').toLowerCase().trim();
        if (ageStr) {
            if (ageStr.includes('d') || ageStr.includes('ي')) {
                ageInMonths = (parseFloat(ageStr) || 0) / 30.44;
            } else if (ageStr.includes('w') || ageStr.includes('ا') || ageStr.includes('س')) {
                ageInMonths = (parseFloat(ageStr) || 0) / 4.345;
            } else {
                const val = parseFloat(ageStr) || 0;
                ageInMonths = val > 8 ? val / 30.44 : val / 4.345; 
            }
        } else {
            ageInMonths = 0;
        }

        return evaluateProtocol(computedAssessments, protocols?.infant, defaultCategories, weight, ageInMonths, protocols?.dosages_infant);
    }, [assessments, infantData, protocols]);

    const handleSave = async () => {
        if (!selectedState || !selectedLocality || !selectedFacility) {
            notify(t('imci.common.please_select_facility', 'Please select a facility first.'), 'error');
            return;
        }
        if (!infantData.childName) {
            notify(t('imci.common.please_enter_name', 'Please enter the child\'s name.'), 'error');
            return;
        }

        setIsSaving(true);
        try {
            const extractText = (node) => {
                if (node === null || node === undefined) return '';
                if (typeof node === 'string') return node.replace(/\|\|\|(.*?)\|\|\|/g, " — $1");
                if (typeof node === 'number' || typeof node === 'boolean') return String(node);
                if (Array.isArray(node)) return node.map(extractText).join('');
                if (node.props && node.props.children) return extractText(node.props.children);
                return '';
            };

            const cleanClassifications = {};
            for (const [key, category] of Object.entries(results)) {
                cleanClassifications[key] = {
                    c: category.c.map(cls => ({ label: cls.label, color: cls.color })),
                    t: category.t.map(extractText).filter(text => text.trim() !== '')
                };
            }

            const safeAssessments = JSON.parse(JSON.stringify(assessments, (k, v) => v === undefined ? null : v));
            const safePatientData = JSON.parse(JSON.stringify(infantData, (k, v) => v === undefined ? null : v));

            const payload = {
                formType: 'infant', facilityId: selectedFacility, state: selectedState, locality: selectedLocality,
                patientData: safePatientData, assessments: safeAssessments, classifications: cleanClassifications,
                treatmentsAdministered: Object.keys(selectedTreatments).filter(k => selectedTreatments[k]).map(extractText),
                isDeleted: false, createdAt: serverTimestamp()
            };
            
            await saveIMNCIPatientRecord(payload);
            setInfantData({ ...initialInfantData }); setAssessments({ ...initialAssessments }); setSelectedTreatments({});
            if (onSaveSuccess) onSaveSuccess();
            setStatusModal({ type: 'success', message: 'تم حفظ بيانات المريض بنجاح.' });
        } catch (error) {
            console.error("Error saving form: ", error);
            setStatusModal({ type: 'error', message: 'حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى.' });
        } finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative">
            <SaveStatusPopup status={statusModal} onClose={() => setStatusModal(null)} onBack={onBack} />
            <div className="flex justify-start"><Button variant="secondary" onClick={onBack} className="flex items-center gap-2 font-bold bg-white text-slate-700 shadow-sm border border-slate-200"><ArrowRight size={18} /> العودة إلى القائمة الرئيسية</Button></div>
            
            <Card>
                <div className="bg-sky-700 text-white p-3 rounded-t-md font-bold text-center uppercase tracking-wide flex items-center justify-center gap-2"><Baby /> {t('imci.infant_title')}</div>
                <div className="p-5 space-y-5 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                        <div className="space-y-1 lg:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><UserSquare2 size={14}/> {t('imci.common.child_name')}</label><input type="text" name="childName" value={infantData.childName} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.child_name')} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> {t('imci.common.date')}</label><input type="date" name="date" value={infantData.date} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> {t('imci.common.age_days_weeks')}</label><input type="text" name="ageDaysWeeks" value={infantData.ageDaysWeeks} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.age_days')} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Weight size={14}/> {t('imci.common.weight')}</label><input type="number" step="0.1" name="weightKg" value={infantData.weightKg} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.weight')} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Thermometer size={14}/> {t('imci.common.temp')}</label><input type="number" step="0.1" name="tempC" value={infantData.tempC} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.temp')} /></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 border-t border-slate-200 pt-4">
                        <div className="lg:col-span-2 space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">{t('imci.common.ask_problems')}</label><input type="text" name="problems" value={infantData.problems} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.problems')} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">{t('imci.common.visit_type')}</label><div className="flex gap-4 p-2 bg-white rounded-md border border-slate-200 shadow-sm items-center h-[42px]"><label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="initial" checked={infantData.visitType === 'initial'} onChange={handleDataChange} className="text-sky-600"/> {t('imci.common.initial_visit')}</label><label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="followup" checked={infantData.visitType === 'followup'} onChange={handleDataChange} className="text-sky-600"/> {t('imci.common.follow_up')}</label></div></div>
                    </div>
                </div>
            </Card>

            <div className="border border-slate-300 rounded-md overflow-hidden shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-800 font-bold text-sm text-center text-white border-b border-slate-300 hidden lg:grid">
                    <div className="lg:col-span-6 p-3 border-r border-slate-600">{t('imci.common.ask_look')}</div>
                    <div className="lg:col-span-2 p-3 border-r border-slate-600">{t('imci.common.classify')}</div>
                    <div className="lg:col-span-4 p-3">{t('imci.common.identify_treatment')}</div>
                </div>

                <AssessmentRow title={<span className="text-slate-800 font-bold flex items-center gap-2">{t('imci.infant.check_severe_disease')}</span>} active={true} classifyData={results.bacterial_infection?.c} treatmentData={results.bacterial_infection?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 uppercase border-b pb-1 mb-2">{t('imci.infant.ask')}</h4>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="notFeedingWell" checked={assessments.notFeedingWell} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.diff_feeding')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="convulsions" checked={assessments.convulsions} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.convulsions')}</span></label>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 uppercase border-b pb-1 mb-2">{t('imci.infant.look')}</h4>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="convulsingNow" checked={assessments.convulsingNow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.convulsing_now')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="movementOnlyStimulatedNoMovement" checked={assessments.movementOnlyStimulatedNoMovement} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.movement')}</span></label>
                            <div className="flex flex-wrap items-center gap-2 text-sm border-t pt-2 border-slate-200">
                                <span>{t('imci.infant.count_breaths')}</span><input type="number" name="breathRate" value={assessments.breathRate} onChange={(e) => setAssessments(p=>({...p, breathRate: e.target.value}))} className="w-16 rounded border-slate-300 p-1" />
                                <span>{t('imci.infant.repeat_60')}</span><label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="fastBreathing" checked={assessments.fastBreathing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.fast_breathing')}</span></label>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="severeChestIndrawing" checked={assessments.severeChestIndrawing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.chest_indrawing')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="fever38" checked={assessments.fever38} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.fever_38')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="lowTemp35_5" checked={assessments.lowTemp35_5} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.low_temp')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="umbilicusRedDraining" checked={assessments.umbilicusRedDraining} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.umbilicus')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="pusFromEyes" checked={assessments.pusFromEyes} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.pus_eyes')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="skinPustules" checked={assessments.skinPustules} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.skin_pustules')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                <AssessmentRow title={t('imci.infant.check_jaundice')} isConditional yesNoValue={assessments.hasJaundice} onYesNoChange={(val) => setAssessments(p => ({...p, hasJaundice: val}))} classifyData={results.jaundice?.c} treatmentData={results.jaundice?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="jaundiceFirst24h" checked={assessments.jaundiceFirst24h} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.jaundice_24h')}</span></label>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="jaundiceLowWeight" checked={assessments.jaundiceLowWeight} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.jaundice_low_weight')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="jaundiceSolesPalms" checked={assessments.jaundiceSolesPalms} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.jaundice_palms_soles')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                <AssessmentRow title={t('imci.infant.check_feeding')} active={true} classifyData={results.feeding_problem?.c} treatmentData={results.feeding_problem?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <div className="flex justify-between items-center text-sm border-b pb-2"><span>{t('imci.infant.is_breastfed')}</span><div className="flex gap-3"><label className="cursor-pointer"><input type="radio" name="breastfed" value="yes" checked={assessments.breastfed==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label><label className="cursor-pointer"><input type="radio" name="breastfed" value="no" checked={assessments.breastfed==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></div></div>
                            {assessments.breastfed === 'yes' && (<div className="flex items-center gap-2 text-sm ml-4"><span>{t('imci.infant.times_24h')}</span><input type="number" name="breastfeedTimes" value={assessments.breastfeedTimes} onChange={(e) => setAssessments(p=>({...p, breastfeedTimes: e.target.value}))} className="w-16 rounded border-slate-300 p-1"/><span>{t('imci.infant.times')}</span></div>)}
                            <div className="flex justify-between items-center text-sm border-b pb-2"><span>{t('imci.infant.other_foods')}</span><div className="flex gap-3"><label className="cursor-pointer"><input type="radio" name="otherFoods" value="yes" checked={assessments.otherFoods==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label><label className="cursor-pointer"><input type="radio" name="otherFoods" value="no" checked={assessments.otherFoods==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></div></div>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <span className="font-bold text-sm block">{t('imci.infant.determine_weight')}</span>
                            <div className="flex gap-4 text-sm border-b pb-2"><label className="cursor-pointer"><input type="radio" name="weightForAgeLow" value="true" checked={assessments.weightForAgeLow===true} onChange={()=>setAssessments(p=>({...p, weightForAgeLow: true}))}/> {t('imci.infant.low')}</label><label className="cursor-pointer"><input type="radio" name="weightForAgeLow" value="false" checked={assessments.weightForAgeLow===false} onChange={()=>setAssessments(p=>({...p, weightForAgeLow: false}))}/> {t('imci.infant.not_low')}</label></div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="thrush" checked={assessments.thrush} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.thrush')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                <AssessmentRow title={t('imci.infant.any_other_problems')} isConditional={true} yesNoValue={assessments.hasOtherProblems} onYesNoChange={(val) => setAssessments(p => ({...p, hasOtherProblems: val}))} classifyData={results.other?.c} treatmentData={results.other?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <textarea name="otherProblemsText" value={assessments.otherProblemsText} onChange={(e) => setAssessments(prev=>({...prev, otherProblemsText: e.target.value}))} rows={2} className="block w-full rounded-md border-slate-300 shadow-sm focus:ring-sky-500 sm:text-sm mt-2 p-3" placeholder={t('imci.placeholders.other_problems')}></textarea>
                </AssessmentRow>

                <div className="p-5 bg-slate-800 text-white flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
                    <span className="font-bold tracking-wide uppercase">{t('imci.common.return_follow_up')}</span>
                    <div className="flex gap-5 font-semibold">
                        {['1', '2', '14'].map(days => (
                            <label key={days} className="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="followUpDays" value={days} checked={assessments.followUpDays===String(days)} onChange={handleRadioChange} className="text-sky-400 focus:ring-sky-400 cursor-pointer w-4 h-4" /><span>{days} {t('imci.common.days')}</span></label>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end pb-8">
                <Button variant="primary" onClick={handleSave} disabled={isSaving} className="w-full md:w-auto py-3.5 shadow-lg px-12 text-lg font-bold">
                    <ClipboardList className="w-5 h-5 mr-2 inline-block"/> {isSaving ? t('imci.common.saving', 'Saving...') : t('imci.common.save_infant', 'Save Infant Record')}
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// FORM 2: SICK CHILD (2 MONTHS UP TO 5 YEARS)
// ============================================================================
function ChildForm({ selectedState, selectedLocality, selectedFacility, onBack, onSaveSuccess }) {
    const { t } = useTranslation();
    const { protocols } = useDataCache();
    const [isSaving, setIsSaving] = useState(false);
    const [statusModal, setStatusModal] = useState(null);
    const [selectedTreatments, setSelectedTreatments] = useState({});

    const initialChildData = {
        date: new Date().toISOString().split('T')[0], childName: '', sex: 'male', ageMonths: '', weightKg: '', lengthCm: '', tempC: '',
        problems: '', visitType: 'initial'
    };
    const initialAssessments = {
        notAbleToDrink: false, vomitsEverything: false, historyOfConvulsions: false, lethargicUnconscious: false, convulsingNow: false,
        hasCough: null, coughDays: '', breathRate: '', fastBreathing: false, chestIndrawing: false, stridor: false, wheeze: false,
        hasDiarrhea: null, diarrheaDays: '', bloodInStool: false, lethargic: false, restlessIrritable: false, sunkenEyes: false,
        drinkPoorly: false, drinkEagerly: false, pinchVerySlow: false, pinchSlow: false,
        hasFever: null, feverDays: '', dailyFever7Days: false, measles3Months: false, neckStiffness: false, measlesRash: false,
        malariaTest: '', mouthUlcers: false, deepExtensiveUlcers: false, pusFromEye: false, corneaClouding: false,
        hasEarProblem: null, earPain: false, earDischarge: false, earDischargeDays: '', tenderSwelling: false, pusFromEar: false,
        pallor: 'noPallor', 
        edema: false, muacCm: '', medicalComplication: false, appetiteTest: '',
        v_opv0: false, v_bcg: false, v_opv1: false, v_rota1: false, v_pcv1: false, v_penta1: false, v_ipv1: false,
        v_opv2: false, v_rota2: false, v_pcv2: false, v_penta2: false,
        v_opv3: false, v_rota3: false, v_pcv3: false, v_penta3: false, v_ipv2: false,
        v_mr: false, v_yellowFever: false, v_menA: false, v_mrBooster: false, v_vitaminA: false,
        nextVaccine: '', nextVitaminA: '',
        hasOtherProblems: null, otherProblemsText: '',
        feed_ageLess2: false, feed_hadMAM: false, feed_hadAnemia: false, feedingStatus: '',
        followUpDays: ''
    };

    const [childData, setChildData] = useState({ ...initialChildData });
    const [assessments, setAssessments] = useState({ ...initialAssessments });

    const handleChildDataChange = (e) => setChildData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleCheckboxChange = (e) => setAssessments(prev => ({ ...prev, [e.target.name]: e.target.checked }));
    const handleRadioChange = (e) => setAssessments(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const toggleTreatment = (tItem) => setSelectedTreatments(prev => ({ ...prev, [tItem]: !prev[tItem] }));

    const zScoreResult = useMemo(() => {
        const { sex, ageMonths, weightKg, lengthCm } = childData;
        const weight = parseFloat(weightKg); const length = parseFloat(lengthCm); const age = parseFloat(ageMonths);
        if (!weight || !length || !age || !sex) return { zScore: null, status: 'Incomplete Data' };

        let groupKey = (sex === 'male') ? (age < 24 ? "boys_0_2" : "boys_2_5") : (age < 24 ? "girls_0_2" : "girls_2_5");
        const groupData = zScoreData[groupKey];
        if (!groupData) return { zScore: null, status: 'Group Error' };

        const lengthKey = (Math.round(length * 2) / 2).toFixed(1);
        const row = groupData[lengthKey];
        if (!row) return { zScore: null, status: 'Length out of range' };

        const thresholds = ["-3", "-2", "-1", "0", "1", "2", "3"];
        let z = null;

        if (weight <= row["-3"]) z = -3;
        else if (weight >= row["3"]) z = 3;
        else {
            for (let i = 0; i < thresholds.length - 1; i++) {
                if (weight >= row[thresholds[i]] && weight <= row[thresholds[i + 1]]) {
                    z = parseFloat(thresholds[i]) + (weight - row[thresholds[i]]) / (row[thresholds[i + 1]] - row[thresholds[i]]);
                    break;
                }
            }
        }
        let status = '-2 Z or more';
        if (z !== null) { if (z < -3) status = 'Less than -3Z'; else if (z < -2) status = 'Between -3 and -2 Z'; }
        return { zScore: z?.toFixed(2), status };
    }, [childData]);

    const results = useMemo(() => {
        const computedAssessments = {
            ...assessments,
            hasDangerSign: assessments.notAbleToDrink || assessments.vomitsEverything || assessments.historyOfConvulsions || assessments.lethargicUnconscious || assessments.convulsingNow,
            diarrhea14Days: parseInt(assessments.diarrheaDays || 0) >= 14,
            hasDehydration: (assessments.lethargic || assessments.restlessIrritable || assessments.sunkenEyes || assessments.drinkPoorly || assessments.drinkEagerly || assessments.pinchVerySlow || assessments.pinchSlow), 
            malariaTestPositive: assessments.malariaTest === 'positive',
            measlesNow: assessments.measlesRash,
            earDischargeAcute: assessments.earDischarge && parseInt(assessments.earDischargeDays || 0) < 14,
            earDischargeChronic: (assessments.earDischarge || assessments.pusFromEar) && parseInt(assessments.earDischargeDays || 0) >= 14,
            samWithComplications: (assessments.edema || zScoreResult.status === 'Less than -3Z' || (parseFloat(assessments.muacCm) > 0 && parseFloat(assessments.muacCm) < 11.5)) && (assessments.medicalComplication || assessments.appetiteTest === 'failed'),
            samWithoutComplications: (assessments.edema || zScoreResult.status === 'Less than -3Z' || (parseFloat(assessments.muacCm) > 0 && parseFloat(assessments.muacCm) < 11.5)) && !(assessments.medicalComplication || assessments.appetiteTest === 'failed'),
            moderateAcuteMalnutrition: zScoreResult.status === 'Between -3 and -2 Z' || (parseFloat(assessments.muacCm) >= 11.5 && parseFloat(assessments.muacCm) < 12.5),
            noMalnutrition: zScoreResult.status === '-2 Z or more' && (parseFloat(assessments.muacCm) >= 12.5 || !assessments.muacCm) && !assessments.edema,
            severePalmarPallor: assessments.pallor === 'severePallor',
            somePalmarPallor: assessments.pallor === 'somePallor',
            noPalmarPallor: assessments.pallor === 'noPallor'
        };

        const defaultCategories = {
            danger: { c: [], t: [] }, cough: { c: [], t: [] }, diarrhea: { c: [], t: [] }, 
            fever: { c: [], t: [] }, ear: { c: [], t: [] }, malnutrition: { c: [], t: [] },
            vaccine: { c: [], t: [] }, other: { c: [], t: [] }, feeding: { c: [], t: [] }
        };

        const weight = parseFloat(childData.weightKg) || 0;
        const age = parseFloat(childData.ageMonths) || 0;

        return evaluateProtocol(computedAssessments, protocols?.child, defaultCategories, weight, age, protocols?.dosages_child);
    }, [assessments, protocols, zScoreResult, childData]);

    const handleSave = async () => {
        if (!selectedState || !selectedLocality || !selectedFacility) {
            notify(t('imci.common.please_select_facility', 'Please select a facility first.'), 'error'); return;
        }
        if (!childData.childName) {
            notify(t('imci.common.please_enter_name', 'Please enter the child\'s name.'), 'error'); return;
        }

        setIsSaving(true);
        try {
            const extractText = (node) => {
                if (node === null || node === undefined) return '';
                if (typeof node === 'string') return node.replace(/\|\|\|(.*?)\|\|\|/g, " — $1"); 
                if (typeof node === 'number' || typeof node === 'boolean') return String(node);
                if (Array.isArray(node)) return node.map(extractText).join('');
                if (node.props && node.props.children) return extractText(node.props.children);
                return '';
            };

            const cleanClassifications = {};
            for (const [key, category] of Object.entries(results)) {
                cleanClassifications[key] = {
                    c: category.c.map(cls => ({ label: cls.label, color: cls.color })),
                    t: category.t.map(extractText).filter(text => text.trim() !== '')
                };
            }

            const safeAssessments = JSON.parse(JSON.stringify(assessments, (k, v) => v === undefined ? null : v));
            const safePatientData = JSON.parse(JSON.stringify(childData, (k, v) => v === undefined ? null : v));

            const payload = {
                formType: 'child', facilityId: selectedFacility, state: selectedState, locality: selectedLocality,
                patientData: safePatientData, assessments: safeAssessments, classifications: cleanClassifications,
                treatmentsAdministered: Object.keys(selectedTreatments).filter(k => selectedTreatments[k]).map(extractText),
                isDeleted: false, createdAt: serverTimestamp()
            };
            
            await saveIMNCIPatientRecord(payload);
            setChildData({ ...initialChildData }); setAssessments({ ...initialAssessments }); setSelectedTreatments({});
            if (onSaveSuccess) onSaveSuccess();
            setStatusModal({ type: 'success', message: 'تم حفظ بيانات المريض بنجاح.' });
        } catch (error) {
            console.error("Error saving form: ", error);
            setStatusModal({ type: 'error', message: 'حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى.' });
        } finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative">
            <SaveStatusPopup status={statusModal} onClose={() => setStatusModal(null)} onBack={onBack} />
            <div className="flex justify-start"><Button variant="secondary" onClick={onBack} className="flex items-center gap-2 font-bold bg-white text-slate-700 shadow-sm border border-slate-200"><ArrowRight size={18} /> العودة إلى القائمة الرئيسية</Button></div>
            
            <Card>
                <div className="bg-indigo-700 text-white p-3 rounded-t-md font-bold text-center uppercase tracking-wide flex items-center justify-center gap-2"><User /> {t('imci.child_title')}</div>
                <div className="p-5 space-y-5 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div className="space-y-1 lg:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><UserSquare2 size={14}/> {t('imci.common.child_name')}</label><input type="text" name="childName" value={childData.childName} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.child_name')} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> {t('imci.common.date')}</label><input type="date" name="date" value={childData.date} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><User size={14}/> {t('imci.common.sex')}</label><select name="sex" value={childData.sex} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white"><option value="male">{t('imci.common.male')}</option><option value="female">{t('imci.common.female')}</option></select></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> {t('imci.common.age_months')}</label><input type="number" name="ageMonths" value={childData.ageMonths} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.age_months')} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Weight size={14}/> {t('imci.common.weight')}</label><input type="number" step="0.1" name="weightKg" value={childData.weightKg} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.weight')} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Ruler size={14}/> {t('imci.common.length')}</label><input type="number" step="0.5" name="lengthCm" value={childData.lengthCm} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.length')} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Thermometer size={14}/> {t('imci.common.temp')}</label><input type="number" step="0.1" name="tempC" value={childData.tempC} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.temp')} /></div>
                    </div>
                </div>
            </Card>

            <div className="border border-slate-300 rounded-md overflow-hidden shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-800 font-bold text-sm text-center text-white border-b border-slate-300 hidden lg:grid">
                    <div className="lg:col-span-6 p-3 border-r border-slate-600">{t('imci.common.ask_look')}</div>
                    <div className="lg:col-span-2 p-3 border-r border-slate-600">{t('imci.common.classify')}</div>
                    <div className="lg:col-span-4 p-3">{t('imci.common.identify_treatment')}</div>
                </div>

                <AssessmentRow title={<span className="text-red-700 font-bold flex items-center gap-2"><AlertCircle size={16}/> {t('imci.child.danger_signs')}</span>} isConditional={false} classifyData={results.danger?.c} treatmentData={results.danger?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="notAbleToDrink" checked={assessments.notAbleToDrink} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.not_able_drink')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="lethargicUnconscious" checked={assessments.lethargicUnconscious} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.lethargic_unconscious')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="vomitsEverything" checked={assessments.vomitsEverything} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.vomits_everything')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="convulsingNow" checked={assessments.convulsingNow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.convulsing_now')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="historyOfConvulsions" checked={assessments.historyOfConvulsions} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.history_convulsions')}</span></label>
                    </div>
                </AssessmentRow>

                <AssessmentRow title={t('imci.child.cough_title')} isConditional={true} yesNoValue={assessments.hasCough} onYesNoChange={(val) => setAssessments(p => ({...p, hasCough: val}))} classifyData={results.cough?.c} treatmentData={results.cough?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-3 rounded">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium">{t('imci.common.duration')}</span><input type="number" name="coughDays" value={assessments.coughDays} onChange={(e) => setAssessments(p => ({...p, coughDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" /><span className="text-sm font-medium">{t('imci.common.days')}</span></div>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="fastBreathing" checked={assessments.fastBreathing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.fast_breathing')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="chestIndrawing" checked={assessments.chestIndrawing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.chest_indrawing')}</span></label>
                            <div className="flex items-center gap-4 text-sm pt-1 border-t border-slate-200 mt-2">
                                <span className="font-medium">{t('imci.child.look_listen')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="stridor" checked={assessments.stridor} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.stridor')}</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="wheeze" checked={assessments.wheeze} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.wheeze')}</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                <AssessmentRow title={t('imci.child.diarrhea_title')} isConditional={true} yesNoValue={assessments.hasDiarrhea} onYesNoChange={(val) => setAssessments(p => ({...p, hasDiarrhea: val}))} classifyData={results.diarrhea?.c} treatmentData={results.diarrhea?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-3 rounded">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2"><span className="text-sm font-medium">{t('imci.common.duration')}</span><input type="number" name="diarrheaDays" value={assessments.diarrheaDays} onChange={(e) => setAssessments(p => ({...p, diarrheaDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" /><span className="text-sm font-medium">{t('imci.common.days')}</span></div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="bloodInStool" checked={assessments.bloodInStool} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.blood_in_stool')}</span></label>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <span className="font-medium">{t('imci.infant.general_condition')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="lethargic" checked={assessments.lethargic} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.lethargic')}</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="restlessIrritable" checked={assessments.restlessIrritable} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.restless_irritable')}</span></label>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="sunkenEyes" checked={assessments.sunkenEyes} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.sunken_eyes')}</span></label>
                            <div className="flex items-center gap-3 text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium">{t('imci.child.offer_drink')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="drinkPoorly" checked={assessments.drinkPoorly} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.drink_poorly')}</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="drinkEagerly" checked={assessments.drinkEagerly} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.drink_eagerly')}</span></label>
                            </div>
                            <div className="flex items-center gap-3 text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium">{t('imci.infant.skin_pinch')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchVerySlow" checked={assessments.pinchVerySlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.very_slowly')}</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchSlow" checked={assessments.pinchSlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.slowly')}</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                <AssessmentRow title={<span>{t('imci.child.fever_title')}</span>} isConditional={true} yesNoValue={assessments.hasFever} onYesNoChange={(val) => setAssessments(p => ({...p, hasFever: val}))} classifyData={results.fever?.c} treatmentData={results.fever?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 mb-4 bg-slate-50 p-3 rounded">
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="dailyFever7Days" checked={assessments.dailyFever7Days} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.daily_fever_7')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="measles3Months" checked={assessments.measles3Months} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.measles_3m')}</span></label>
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="neckStiffness" checked={assessments.neckStiffness} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.neck_stiffness')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="measlesRash" checked={assessments.measlesRash} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.measles_rash')}</span></label>
                            <div className="text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium mr-2">{t('imci.child.malaria_test')}</span><span className="text-xs text-slate-500">{t('imci.child.if_no_danger')}</span>
                                <div className="flex gap-4 mt-2 ml-2"><label className="flex items-center space-x-1 text-sm cursor-pointer"><input type="radio" name="malariaTest" value="positive" checked={assessments.malariaTest==='positive'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.positive')}</span></label><label className="flex items-center space-x-1 text-sm cursor-pointer"><input type="radio" name="malariaTest" value="negative" checked={assessments.malariaTest==='negative'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.negative')}</span></label></div>
                            </div>
                        </div>
                    </div>
                    <div className="border border-amber-200 bg-amber-50 p-3 rounded-md grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="text-sm font-bold text-amber-800 col-span-full">{t('imci.child.if_measles')}</div>
                        <div className="space-y-2"><div className="flex flex-col gap-2 text-sm"><label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="mouthUlcers" checked={assessments.mouthUlcers} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>{t('imci.child.mouth_ulcers')}</span></label>{assessments.mouthUlcers && <label className="flex items-center space-x-2 ml-6 cursor-pointer"><input type="checkbox" name="deepExtensiveUlcers" checked={assessments.deepExtensiveUlcers} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>{t('imci.child.deep_ulcers')}</span></label>}</div></div>
                        <div className="space-y-2"><label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="pusFromEye" checked={assessments.pusFromEye} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>{t('imci.child.pus_eye')}</span></label><label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="corneaClouding" checked={assessments.corneaClouding} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>{t('imci.child.cornea')}</span></label></div>
                    </div>
                </AssessmentRow>

                <AssessmentRow title={t('imci.child.ear_title')} isConditional={true} yesNoValue={assessments.hasEarProblem} onYesNoChange={(val) => setAssessments(p => ({...p, hasEarProblem: val}))} classifyData={results.ear?.c} treatmentData={results.ear?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-3 rounded">
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="earPain" checked={assessments.earPain} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.ear_pain')}</span></label>
                            <div className="flex items-center gap-2"><label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="earDischarge" checked={assessments.earDischarge} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.ear_discharge')}</span></label><input type="number" name="earDischargeDays" value={assessments.earDischargeDays} onChange={(e) => setAssessments(p => ({...p, earDischargeDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" /><span className="text-sm">{t('imci.common.days')}</span></div>
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="tenderSwelling" checked={assessments.tenderSwelling} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.tender_swelling')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="pusFromEar" checked={assessments.pusFromEar} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.pus_ear')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                <AssessmentRow title={t('imci.child.malnutrition_title')} isConditional={false} classifyData={results.malnutrition?.c} treatmentData={results.malnutrition?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <div className="space-y-4 mt-2">
                        <label className="flex items-center space-x-2 text-sm font-semibold text-slate-800 cursor-pointer"><input type="checkbox" name="edema" checked={assessments.edema} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.edema')}</span></label>
                        <div className="text-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50 p-2 rounded">
                            <span className="font-bold min-w-[70px]">{t('imci.child.z_score')}</span>
                            <div className="flex flex-wrap gap-4"><label className="flex items-center space-x-1"><input type="radio" readOnly checked={zScoreResult.status === 'Less than -3Z'} className="text-slate-400 w-4 h-4" /><span className={zScoreResult.status === 'Less than -3Z' ? 'font-bold text-red-600' : ''}>{t('imci.child.less_3z')}</span></label><label className="flex items-center space-x-1"><input type="radio" readOnly checked={zScoreResult.status === 'Between -3 and -2 Z'} className="text-slate-400 w-4 h-4" /><span className={zScoreResult.status === 'Between -3 and -2 Z' ? 'font-bold text-yellow-600' : ''}>{t('imci.child.between_3_2')}</span></label><label className="flex items-center space-x-1"><input type="radio" readOnly checked={zScoreResult.status === '-2 Z or more'} className="text-slate-400 w-4 h-4" /><span className={zScoreResult.status === '-2 Z or more' ? 'font-bold text-green-600' : ''}>{t('imci.child.more_2z')}</span></label></div>
                        </div>
                        <div className="text-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50 p-2 rounded">
                            <span className="font-bold min-w-[70px]">{t('imci.child.muac')}</span>
                            <div className="flex flex-wrap gap-4 items-center"><input type="number" step="0.1" name="muacCm" placeholder="cm" value={assessments.muacCm} onChange={(e) => setAssessments(prev => ({...prev, muacCm: e.target.value}))} className="w-24 rounded-md border-slate-300 sm:text-sm p-1.5" /><span className="text-xs text-slate-500">{t('imci.child.enter_muac')}</span></div>
                        </div>
                        <div className="border border-sky-100 bg-sky-50 p-3 rounded-md">
                            <div className="text-sm font-bold mb-2 text-slate-700">{t('imci.child.if_z_muac')}</div>
                            <label className="flex items-center space-x-2 text-sm mb-3 cursor-pointer"><input type="checkbox" name="medicalComplication" checked={assessments.medicalComplication} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.med_comp')}</span></label>
                            <div className="text-sm font-bold mt-3 mb-2 text-slate-700 border-t border-sky-200 pt-2">{t('imci.child.appetite_test')}</div>
                            <div className="flex gap-6"><label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="appetiteTest" value="passed" checked={assessments.appetiteTest==='passed'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.passed')}</span></label><label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="appetiteTest" value="failed" checked={assessments.appetiteTest==='failed'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.failed')}</span></label></div>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-slate-200">
                        <span className="font-bold text-sm w-full text-slate-700">تحقق من فقر الدم:</span>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="pallor" value="severePallor" checked={assessments.pallor==='severePallor'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.severe_pallor')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="pallor" value="somePallor" checked={assessments.pallor==='somePallor'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.some_pallor')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="pallor" value="noPallor" checked={assessments.pallor==='noPallor'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.no_pallor')}</span></label>
                    </div>
                </AssessmentRow>

                <AssessmentRow title={t('imci.infant.any_other_problems')} isConditional={true} yesNoValue={assessments.hasOtherProblems} onYesNoChange={(val) => setAssessments(p => ({...p, hasOtherProblems: val}))} classifyData={results.other?.c} treatmentData={results.other?.t} selectedTreatments={selectedTreatments} onToggleTreatment={toggleTreatment}>
                    <textarea name="otherProblemsText" value={assessments.otherProblemsText} onChange={(e) => setAssessments(prev=>({...prev, otherProblemsText: e.target.value}))} rows={2} className="block w-full rounded-md border-slate-300 shadow-sm focus:ring-sky-500 sm:text-sm mt-2 p-3" placeholder={t('imci.placeholders.other_problems')}></textarea>
                </AssessmentRow>

                <div className="p-5 bg-slate-800 text-white flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
                    <span className="font-bold tracking-wide uppercase">{t('imci.common.return_follow_up')}</span>
                    <div className="flex gap-5 font-semibold">
                        {[3, 5, 7, 14, 30].map(days => (
                            <label key={days} className="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="followUpDays" value={days} checked={assessments.followUpDays===String(days)} onChange={handleRadioChange} className="text-sky-400 focus:ring-sky-400 cursor-pointer w-4 h-4" /><span>{days} {t('imci.common.days')}</span></label>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end pb-8">
                <Button variant="primary" onClick={handleSave} disabled={isSaving} className="w-full md:w-auto py-3.5 shadow-lg px-12 text-lg font-bold">
                    <ClipboardList className="w-5 h-5 mr-2 inline-block"/> 
                    {isSaving ? t('imci.common.saving', 'Saving...') : t('imci.common.save_child', 'Save Child Record')}
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN WRAPPER COMPONENT
// ============================================================================
// One tile in a hub. Kept as a component because there are now two hubs — the
// top level and the patient level — and they were drifting apart as copies.
const HubTile = ({ icon: Icon, title, subtitle, tone, onClick }) => (
    <button onClick={onClick} className="text-right cursor-pointer focus:outline-none w-full h-full block group">
        <Card className={`hover:shadow-lg transition-shadow border-t-4 ${tone.border} h-full`}>
            <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className={`p-4 rounded-full group-hover:scale-110 transition-transform ${tone.bg} ${tone.text}`}>
                    <Icon size={40} />
                </div>
                <div>
                    <h3 className={`text-xl font-bold ${tone.title}`}>{title}</h3>
                    <p className={`text-sm mt-2 ${tone.text}`}>{subtitle}</p>
                </div>
            </div>
        </Card>
    </button>
);

const TONES = {
    sky: { border: 'border-t-sky-500', bg: 'bg-sky-100', text: 'text-sky-600', title: 'text-sky-900' },
    indigo: { border: 'border-t-indigo-500', bg: 'bg-indigo-100', text: 'text-indigo-600', title: 'text-indigo-900' },
    emerald: { border: 'border-t-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-600', title: 'text-emerald-900' },
    amber: { border: 'border-t-amber-500', bg: 'bg-amber-100', text: 'text-amber-600', title: 'text-amber-900' },
};

export default function IMNCIRecordingForm({ permissions = {} }) {
    const { t } = useTranslation();
    // 'hub' is the three-way entry: protocol, reports, patients. 'patients' is
    // the age split that used to be the entry point.
    const [activeView, setActiveView] = useState('hub');

    const [selectedState, setSelectedState] = useState('');
    const [selectedLocality, setSelectedLocality] = useState('');
    const [selectedFacility, setSelectedFacility] = useState('');

    const { healthFacilities, fetchHealthFacilities, imnciPatientRecords, fetchIMNCIPatientRecords, isLoading } = useDataCache();

    useEffect(() => {
        if (!healthFacilities) fetchHealthFacilities({}, false);
        if (!imnciPatientRecords) fetchIMNCIPatientRecords(false);
    }, [healthFacilities, imnciPatientRecords, fetchHealthFacilities, fetchIMNCIPatientRecords]);
    
    const activeFacilities = useMemo(() => healthFacilities?.filter(f => f.isDeleted !== true && f.isDeleted !== "true") || [], [healthFacilities]);

    const states = useMemo(() => [...new Set(activeFacilities.map(f => f['الولاية']).filter(Boolean))].sort((a, b) => (STATE_LOCALITIES[a]?.ar || '').localeCompare(STATE_LOCALITIES[b]?.ar || '')), [activeFacilities]);
    const localities = useMemo(() => [...new Set(activeFacilities.filter(f => f['الولاية'] === selectedState).map(f => f['المحلية']).filter(Boolean))].sort(), [activeFacilities, selectedState]);
    const facilities = useMemo(() => activeFacilities.filter(f => f['الولاية'] === selectedState && f['المحلية'] === selectedLocality).sort((a,b) => (a['اسم_المؤسسة']||'').localeCompare(b['اسم_المؤسسة']||'')), [activeFacilities, selectedState, selectedLocality]);

    const filteredRecords = useMemo(() => {
        let filtered = imnciPatientRecords || [];
        if (selectedState) filtered = filtered.filter(r => r.state === selectedState);
        if (selectedLocality) filtered = filtered.filter(r => r.locality === selectedLocality);
        if (selectedFacility) filtered = filtered.filter(r => r.facilityId === selectedFacility);
        return filtered;
    }, [imnciPatientRecords, selectedState, selectedLocality, selectedFacility]);

    const handleNavigation = (view) => {
        if ((view === 'infant' || view === 'child') && !selectedFacility) {
            notify("الرجاء اختيار المؤسسة الصحية أولاً للبدء في التسجيل.", 'error');
            return;
        }
        setActiveView(view);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {activeView === 'hub' && <PageHeader title="بروتوكول الرعاية المتكاملة لصحة الطفل" subtitle="إدارة البروتوكول، التقارير، وسجلات المرضى" />}
            {activeView === 'patients' && <PageHeader title="إدارة المرضى" subtitle="اختر الفئة العمرية لبدء التسجيل" />}
            {activeView === 'reports' && <PageHeader title="إدارة التقارير" subtitle="استعراض إحصائيات وتقارير الرعاية المتكاملة" />}
            {(activeView === 'infant' || activeView === 'child') && <PageHeader title={t('imci.form_title')} subtitle={activeFacilities.find(f => f.id === selectedFacility)?.['اسم_المؤسسة'] || "إدخال البيانات"} />}

            {activeView !== 'hub' && activeView !== 'protocol' && (
            <Card>
                <div className="p-5 space-y-4 bg-slate-50 rounded-lg shadow-sm border border-slate-200" dir="rtl">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><Building size={18} /> اختر المؤسسة الصحية للبدء بالإدخال أو لتصفية التقرير:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">الولاية</label>
                            <select value={selectedState} onChange={e => { setSelectedState(e.target.value); setSelectedLocality(''); setSelectedFacility(''); }} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white">
                                <option value="">-- اختر الولاية --</option>
                                {states.map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey]?.ar || sKey}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">المحلية</label>
                            <select value={selectedLocality} onChange={e => { setSelectedLocality(e.target.value); setSelectedFacility(''); }} disabled={!selectedState} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed">
                                <option value="">-- اختر المحلية --</option>
                                {selectedState && STATE_LOCALITIES[selectedState]?.localities.map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">اسم المؤسسة الصحية</label>
                            <select value={selectedFacility} onChange={e => setSelectedFacility(e.target.value)} disabled={!selectedLocality || isLoading?.healthFacilities} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed">
                                <option value="">-- {isLoading?.healthFacilities ? 'جاري التحميل...' : 'اختر المؤسسة الصحية'} --</option>
                                {facilities.map(f => <option key={f.id} value={f.id}>{f['اسم_المؤسسة']}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </Card>
            )}

            {activeView === 'hub' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 animate-fade-in" dir="rtl">
                    {/* Editing the protocol changes the guidance every clinician
                        sees, so the tile only appears for the roles allowed to. */}
                    {permissions.canManageProtocols && (
                        <HubTile
                            icon={Stethoscope} tone={TONES.amber}
                            title="إدارة البروتوكول"
                            subtitle="تعديل قواعد التصنيف والعلاجات وجداول الجرعات"
                            onClick={() => setActiveView('protocol')}
                        />
                    )}
                    <HubTile
                        icon={LayoutDashboard} tone={TONES.emerald}
                        title="إدارة التقارير"
                        subtitle="استعراض إحصائيات وتقارير IMNCI"
                        onClick={() => setActiveView('reports')}
                    />
                    <HubTile
                        icon={Users} tone={TONES.indigo}
                        title="إدارة المرضى"
                        subtitle="تسجيل واستعراض بيانات الأطفال"
                        onClick={() => setActiveView('patients')}
                    />
                </div>
            )}

            {activeView !== 'hub' && (
                <div dir="rtl">
                    <Button variant="secondary" onClick={() => setActiveView(
                        activeView === 'infant' || activeView === 'child' ? 'patients' : 'hub'
                    )}>
                        <ArrowLeft size={16} className="inline ml-1" /> رجوع
                    </Button>
                </div>
            )}

            {activeView === 'protocol' && (
                <Suspense fallback={<div className="p-8 text-center text-slate-500">جاري التحميل...</div>}>
                    <ProtocolEditor />
                </Suspense>
            )}

            {activeView === 'patients' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 animate-fade-in" dir="rtl">
                    <button onClick={() => handleNavigation('infant')} className="text-right cursor-pointer focus:outline-none w-full h-full block group"><Card className="hover:shadow-lg transition-shadow border-t-4 border-t-sky-500 h-full"><div className="p-6 flex flex-col items-center text-center gap-4"><div className="p-4 bg-sky-100 text-sky-600 rounded-full group-hover:scale-110 transition-transform"><Baby size={40} /></div><div><h3 className="text-xl font-bold text-sky-900">أقل من شهرين</h3><p className="text-sky-600 text-sm mt-2">تسجيل بيانات الرضع (Young Infant)</p></div></div></Card></button>
                    <button onClick={() => handleNavigation('child')} className="text-right cursor-pointer focus:outline-none w-full h-full block group"><Card className="hover:shadow-lg transition-shadow border-t-4 border-t-indigo-500 h-full"><div className="p-6 flex flex-col items-center text-center gap-4"><div className="p-4 bg-indigo-100 text-indigo-600 rounded-full group-hover:scale-110 transition-transform"><User size={40} /></div><div><h3 className="text-xl font-bold text-indigo-900">شهرين إلى 5 سنوات</h3><p className="text-indigo-600 text-sm mt-2">تسجيل بيانات الأطفال (Sick Child)</p></div></div></Card></button>
                </div>
            )}

            {activeView === 'reports' && <IMNCIDashboard onNavigate={(view) => setActiveView(view)} records={filteredRecords} isLoading={isLoading?.imnciPatientRecords} />}
            {activeView === 'infant' && <InfantForm selectedState={selectedState} selectedLocality={selectedLocality} selectedFacility={selectedFacility} onBack={() => setActiveView('patients')} onSaveSuccess={() => fetchIMNCIPatientRecords(true)} />}
            {activeView === 'child' && <ChildForm selectedState={selectedState} selectedLocality={selectedLocality} selectedFacility={selectedFacility} onBack={() => setActiveView('patients')} onSaveSuccess={() => fetchIMNCIPatientRecords(true)} />}
        </div>
    );
}