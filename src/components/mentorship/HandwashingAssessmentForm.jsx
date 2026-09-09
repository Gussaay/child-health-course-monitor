import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button } from '../CommonComponents';
import { saveMentorshipSession } from '../../data';
import { Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const INDICATIONS = [
    { id: 'bef_pat', label: 'قبل التلامس مع المريض' },
    { id: 'bef_asep', label: 'قبل إجراء تنظيف أو مانع للتلوث' },
    { id: 'aft_fluid', label: 'بعد خطر التعرض لإفرازات وسوائل جسم المريض' },
    { id: 'aft_pat', label: 'بعد التلامس مع المريض' },
    { id: 'aft_surr', label: 'بعد التلامس مع البيئة المحيطة للمريض' }
];

// الفئات المهنية المتاحة لكل فرصة على حدة
const WORKER_TYPES = [
    'اختصاصي',
    'نائب اختصاصي',
    'طبيب عمومي',
    'ممرض',
    'مهندس طبي',
    'أم',
    'عامل نظافة'
];

const DEFAULT_OPPORTUNITY_COUNT = 4;

const createOpportunity = () => ({ indications: [], action: '', gloveUse: false, workerType: '' });

const normalizeOpportunities = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
        return Array.from({ length: DEFAULT_OPPORTUNITY_COUNT }, createOpportunity);
    }
    return data.map(opp => ({
        indications: Array.isArray(opp?.indications) ? opp.indications : [],
        action: opp?.action || '',
        gloveUse: !!opp?.gloveUse,
        workerType: opp?.workerType || ''
    }));
};

const isOpportunityComplete = (opp) => opp.indications.length > 0 && !!opp.action;

const computeStats = (opps) => {
    let oppCount = 0, hwCount = 0, hrCount = 0;
    opps.forEach(opp => {
        if (isOpportunityComplete(opp)) {
            oppCount++;
            if (opp.action === 'wash') hwCount++;
            if (opp.action === 'rub') hrCount++;
        }
    });
    const totalActions = hwCount + hrCount;
    const compliance = oppCount > 0 ? Math.round((totalActions / oppCount) * 100) : 0;
    return { opp: oppCount, hw: hwCount, hr: hrCount, compliance };
};

// تجميع النتائج حسب الفئة المهنية المسجلة في كل فرصة
const computeWorkerTypeStats = (opps) => {
    const map = new Map();
    opps.forEach(opp => {
        if (!isOpportunityComplete(opp)) return;
        const key = opp.workerType || 'غير محدد';
        const row = map.get(key) || { workerType: key, opp: 0, hw: 0, hr: 0, compliance: 0 };
        row.opp++;
        if (opp.action === 'wash') row.hw++;
        if (opp.action === 'rub') row.hr++;
        map.set(key, row);
    });
    return Array.from(map.values()).map(row => ({
        ...row,
        compliance: row.opp > 0 ? Math.round(((row.hw + row.hr) / row.opp) * 100) : 0
    }));
};

const dominantWorkerType = (opps) => {
    const counts = {};
    opps.forEach(opp => {
        if (isOpportunityComplete(opp) && opp.workerType) {
            counts[opp.workerType] = (counts[opp.workerType] || 0) + 1;
        }
    });
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
};

const HandwashingAssessmentForm = ({ facility, healthWorkerName, healthWorkerJobTitle, onExit, onSaveComplete, setToast, existingSessionData }) => {
    const auth = getAuth();
    const user = auth.currentUser;
    const [isSaving, setIsSaving] = useState(false);

    const [opportunities, setOpportunities] = useState(() => normalizeOpportunities(existingSessionData?.assessmentData));

    const [sessionStats, setSessionStats] = useState(() => computeStats(normalizeOpportunities(existingSessionData?.assessmentData)));
    const [workerTypeStats, setWorkerTypeStats] = useState([]);

    // حالة الحفظ التلقائي: idle | saving | saved | error
    const [autoSave, setAutoSave] = useState({ status: 'idle', time: null, message: '' });

    // معرّف الجلسة المحفوظة — يضمن التحديث على نفس السجل بدل إنشاء نسخ مكررة
    const savedIdRef = useRef(existingSessionData?.id || null);
    const isPersistingRef = useRef(false);

    useEffect(() => {
        setSessionStats(computeStats(opportunities));
        setWorkerTypeStats(computeWorkerTypeStats(opportunities));
    }, [opportunities]);

    const handleIndicationToggle = (idx, indId) => {
        setOpportunities(prev => prev.map((opp, i) => {
            if (i !== idx) return opp;
            const inds = opp.indications.includes(indId)
                ? opp.indications.filter(id => id !== indId)
                : [...opp.indications, indId];
            return { ...opp, indications: inds };
        }));
    };

    const handleActionChange = (idx, actValue) => {
        setOpportunities(prev => prev.map((opp, i) => (
            i === idx ? { ...opp, action: actValue, gloveUse: actValue === 'missed' ? opp.gloveUse : false } : opp
        )));
    };

    const handleGloveUseToggle = (idx) => {
        setOpportunities(prev => prev.map((opp, i) => (i === idx ? { ...opp, gloveUse: !opp.gloveUse } : opp)));
    };

    const handleWorkerTypeChange = (idx, value) => {
        setOpportunities(prev => prev.map((opp, i) => (i === idx ? { ...opp, workerType: value } : opp)));
    };

    const buildPayload = useCallback((opps) => {
        const stats = computeStats(opps);
        const byWorkerType = computeWorkerTypeStats(opps);
        return {
            serviceType: 'IPC',
            formType: 'handwashing',
            state: facility?.['الولاية'] || null,
            locality: facility?.['المحلية'] || null,
            facilityId: facility?.id || null,
            facilityName: facility?.['اسم_المؤسسة'] || null,
            facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
            healthWorkerName: healthWorkerName || null,
            workerType: dominantWorkerType(opps) || healthWorkerJobTitle || null,
            workerTypes: Array.from(new Set(opps.filter(isOpportunityComplete).map(o => o.workerType).filter(Boolean))),
            workerTypeStats: byWorkerType,
            sessionDate: new Date().toISOString().split('T')[0],
            effectiveDate: Timestamp.fromDate(new Date()),
            assessmentData: opps,
            scores: {
                overallScore_score: stats.compliance,
                overallScore_maxScore: 100,
                opportunities_count: stats.opp,
                handwash_count: stats.hw,
                handrub_count: stats.hr
            },
            status: 'complete',
            mentorEmail: user?.email || 'unknown',
            mentorName: user?.displayName || 'Unknown Mentor',
            project: facility?.project_name || facility?.['المشروع'] || 'N/A'
        };
    }, [facility, healthWorkerName, healthWorkerJobTitle, user]);

    // حفظ موحّد: يُستخدم للحفظ التلقائي وللحفظ النهائي على نفس السجل
    const persistSession = useCallback(async (opps, { silent }) => {
        if (isPersistingRef.current) return null;

        const stats = computeStats(opps);
        // لا نُنشئ سجلاً فارغاً في الحفظ التلقائي قبل اكتمال أي فرصة
        if (silent && stats.opp === 0 && !savedIdRef.current) return null;

        isPersistingRef.current = true;
        if (silent) setAutoSave({ status: 'saving', time: null, message: '' });
        else setIsSaving(true);

        try {
            const payload = buildPayload(opps);
            const savedId = await saveMentorshipSession(payload, savedIdRef.current);
            savedIdRef.current = savedId || savedIdRef.current;
            payload.id = savedIdRef.current;
            if (silent) {
                setAutoSave({
                    status: 'saved',
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    message: ''
                });
            }
            return payload;
        } catch (error) {
            if (silent) {
                setAutoSave({ status: 'error', time: null, message: error.message });
            } else if (setToast) {
                setToast({ show: true, message: `حدث خطأ أثناء الحفظ: ${error.message}`, type: 'error' });
            }
            return null;
        } finally {
            isPersistingRef.current = false;
            if (!silent) setIsSaving(false);
        }
    }, [buildPayload, setToast]);

    // إضافة فرصة جديدة = حفظ فوري بدون الضغط على زر الحفظ
    const handleAddOpportunity = async () => {
        const next = [...opportunities, createOpportunity()];
        setOpportunities(next);
        await persistSession(next, { silent: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = await persistSession(opportunities, { silent: false });
        if (!payload) return;
        if (onSaveComplete) onSaveComplete('complete', payload);
        if (setToast) setToast({ show: true, message: "تم حفظ تقييم الالتزام بنظافة الأيدي بنجاح!", type: 'success' });
    };

    return (
        <Card className="relative pb-20 text-right w-full" dir="rtl">
            <div className={`fixed top-4 left-4 z-50 flex flex-col items-center justify-center p-3 w-32 h-32 rounded-full ${sessionStats.compliance >= 80 ? 'bg-green-600' : sessionStats.compliance >= 50 ? 'bg-yellow-500' : 'bg-red-600'} text-white shadow-2xl transition-all duration-300 border-4 border-white`}>
                <div className="font-bold text-3xl leading-none drop-shadow-md">{sessionStats.compliance}%</div>
                <div className="text-sm mt-1 text-center font-medium opacity-90">نسبة الامتثال</div>
            </div>

            <form onSubmit={handleSubmit} className="w-full text-right" dir="rtl">
                <div className="p-4 sm:p-8">
                    <div className="text-center mb-8 pb-6 border-b border-gray-200">
                        <h2 className="text-2xl font-extrabold text-sky-900 mb-2">
                            استمارة رقم (1): تقييم الالتزام بنظافة وتطهير الأيدي
                        </h2>
                        <p className="text-gray-600 text-base font-semibold">
                            المنشأة: {facility?.['اسم_المؤسسة'] || 'غير محددة'}
                        </p>
                        <p className="text-gray-500 text-sm mt-1">
                            الملاحظة تُسجَّل لكل فرصة على حدة — حدد الفئة المهنية بجانب كل فرصة.
                        </p>
                    </div>

                    <div className="bg-sky-50 border-r-4 border-sky-600 p-5 rounded-l-lg mb-8 shadow-sm text-right">
                        <h3 className="font-bold text-sky-900 mb-3 text-lg">تعليمات التقييم:</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-sky-800 font-medium leading-relaxed">
                            <li>يجوز للمراقب مراقبة ما يصل إلى ثلاثة من العاملين في مجال الرعاية الصحية في وقت واحد.</li>
                            <li>بمجرد اكتشاف داعٍ لنظافة الأيدي، احسب "فرصة" في العمود المناسب، وضع علامة في المربع المقابل للداعي (الدواعي).</li>
                            <li>حدد الفئة المهنية للعامل الملاحَظ من القائمة المجاورة لرقم الفرصة.</li>
                            <li>ضع علامة في المربعات (قد ينطبق أكثر من خيار للفرصة الواحدة) أو الدوائر (خيار واحد فقط للإجراء).</li>
                            <li>يجب دائماً تسجيل الإجراءات المنفذة أو الفائتة ضمن سياق الفرصة (لا تحتسب الفرصة مالم يتم تحديد داعٍ واحد على الأقل).</li>
                            <li>يمكن تسجيل استخدام القفازات فقط عندما يتم تفويت إجراء نظافة الأيدي بينما يرتدي العامل القفازات.</li>
                        </ol>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {opportunities.map((opp, idx) => (
                            <div key={idx} className={`border rounded-xl p-4 shadow-sm transition-shadow ${isOpportunityComplete(opp) ? 'border-green-300 bg-green-50/30' : 'border-slate-300 bg-slate-50'}`}>
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-200 pb-3">
                                    <h4 className="font-bold text-sky-800 text-right">
                                        <span className="align-middle">الفرصة رقم {idx + 1}</span>
                                        {isOpportunityComplete(opp) && (
                                            <span className="mr-3 align-middle text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">مكتملة</span>
                                        )}
                                    </h4>

                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-600 whitespace-nowrap">الفئة المهنية:</span>
                                        <select
                                            value={opp.workerType}
                                            onChange={(e) => handleWorkerTypeChange(idx, e.target.value)}
                                            className={`text-sm font-semibold border rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 cursor-pointer ${opp.workerType ? 'border-sky-300 text-sky-800' : 'border-slate-300 text-slate-500'}`}
                                        >
                                            <option value="">-- اختر الفئة --</option>
                                            {WORKER_TYPES.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm w-full text-right block">
                                        <p className="font-bold text-sm mb-3 text-slate-800 border-b border-slate-100 pb-2">الدواعي:</p>
                                        <div className="w-full space-y-1">
                                            {INDICATIONS.map(ind => (
                                                <label key={ind.id} className="block p-2 hover:bg-slate-50 rounded transition-colors cursor-pointer text-right">
                                                    <input
                                                        type="checkbox"
                                                        checked={opp.indications.includes(ind.id)}
                                                        onChange={() => handleIndicationToggle(idx, ind.id)}
                                                        className="ml-3 align-middle w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500 cursor-pointer"
                                                    />
                                                    <span className="align-middle text-sm text-gray-700 font-medium leading-relaxed">{ind.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm w-full text-right block">
                                        <p className="font-bold text-sm mb-4 text-slate-800 border-b border-slate-100 pb-2">الإجراء:</p>
                                        <div className="w-full text-right">
                                            <label className="inline-block ml-6 mb-3 cursor-pointer text-right">
                                                <input type="radio" name={`action_${idx}`} checked={opp.action === 'wash'} onChange={() => handleActionChange(idx, 'wash')} className="ml-2 align-middle w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer" />
                                                <span className="align-middle font-bold text-sm">غسل بالصابون</span>
                                            </label>
                                            <label className="inline-block ml-6 mb-3 cursor-pointer text-right">
                                                <input type="radio" name={`action_${idx}`} checked={opp.action === 'rub'} onChange={() => handleActionChange(idx, 'rub')} className="ml-2 align-middle w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer" />
                                                <span className="align-middle font-bold text-sm">فرك بالكحول</span>
                                            </label>
                                            <label className="inline-block mb-3 cursor-pointer text-right">
                                                <input type="radio" name={`action_${idx}`} checked={opp.action === 'missed'} onChange={() => handleActionChange(idx, 'missed')} className="ml-2 align-middle w-4 h-4 text-red-500 focus:ring-red-500 cursor-pointer" />
                                                <span className="align-middle font-bold text-sm text-slate-600">عدم غسل أو تطهير</span>
                                            </label>
                                        </div>

                                        {opp.action === 'missed' && (
                                            <div className="mt-2 pt-3 border-t border-slate-100 text-right block">
                                                <label className="block p-2 hover:bg-slate-50 rounded transition-colors cursor-pointer text-right">
                                                    <input
                                                        type="checkbox"
                                                        checked={opp.gloveUse}
                                                        onChange={() => handleGloveUseToggle(idx)}
                                                        className="ml-3 align-middle w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                                                    />
                                                    <span className="align-middle text-sm font-semibold text-amber-700">كان يرتدي قفازات وقت التفويت</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mb-10 w-full block">
                        <Button
                            className="inline-block bg-white border-sky-500 text-sky-700 hover:bg-sky-50 font-bold px-6 py-2 shadow-sm rounded-full transition-colors"
                            onClick={handleAddOpportunity}
                            type="button"
                            variant="outline"
                            disabled={autoSave.status === 'saving'}
                        >
                            {autoSave.status === 'saving' ? 'جاري الحفظ...' : '+ إضافة فرصة جديدة (حفظ تلقائي)'}
                        </Button>

                        <div className="mt-3 text-sm font-semibold min-h-[20px]">
                            {autoSave.status === 'saving' && <span className="text-sky-700">جاري حفظ البيانات تلقائياً...</span>}
                            {autoSave.status === 'saved' && <span className="text-green-700">تم الحفظ التلقائي {autoSave.time ? `الساعة ${autoSave.time}` : ''}</span>}
                            {autoSave.status === 'error' && <span className="text-red-600">تعذّر الحفظ التلقائي: {autoSave.message}</span>}
                        </div>
                    </div>

                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-6 shadow-sm mb-4 w-full text-right block">
                        <div className="mb-6 border-b border-sky-200 pb-4 text-right block">
                            <h3 className="inline-block align-middle text-xl font-bold text-sky-900 ml-4">تجميع البيانات لكل جلسة</h3>
                            <span className="inline-block align-middle bg-white text-sky-800 border border-sky-300 px-4 py-1.5 rounded-full text-sm font-bold">
                                الفئات المهنية المسجلة: {workerTypeStats.length > 0 ? workerTypeStats.map(w => w.workerType).join(' • ') : 'لا يوجد'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4" dir="rtl">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 text-center shadow-sm">
                                <p className="text-sm font-semibold text-sky-700 mb-1">إجمالي الفرص المكتملة</p>
                                <p className="text-2xl font-black text-slate-800">{sessionStats.opp}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 text-center shadow-sm">
                                <p className="text-sm font-semibold text-sky-700 mb-1">مرات غسل اليدين</p>
                                <p className="text-2xl font-black text-emerald-600">{sessionStats.hw}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 text-center shadow-sm">
                                <p className="text-sm font-semibold text-sky-700 mb-1">مرات فرك اليدين</p>
                                <p className="text-2xl font-black text-emerald-600">{sessionStats.hr}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-sky-300 text-center shadow-sm ring-2 ring-sky-100">
                                <p className="text-sm font-semibold text-sky-700 mb-1">نسبة الامتثال</p>
                                <p className={`text-2xl font-black ${sessionStats.compliance >= 80 ? 'text-green-600' : sessionStats.compliance >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {sessionStats.compliance}%
                                </p>
                            </div>
                        </div>

                        {workerTypeStats.length > 0 && (
                            <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 overflow-x-auto">
                                <p className="font-bold text-sm text-sky-900 mb-3">الامتثال حسب الفئة المهنية</p>
                                <table className="w-full text-sm border-collapse" dir="rtl">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="border border-slate-200 p-2 text-right font-bold">الفئة المهنية</th>
                                            <th className="border border-slate-200 p-2 text-center font-bold">الفرص</th>
                                            <th className="border border-slate-200 p-2 text-center font-bold">غسل</th>
                                            <th className="border border-slate-200 p-2 text-center font-bold">فرك</th>
                                            <th className="border border-slate-200 p-2 text-center font-bold">الامتثال</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workerTypeStats.map(row => (
                                            <tr key={row.workerType} className="hover:bg-sky-50">
                                                <td className="border border-slate-200 p-2 font-semibold">{row.workerType}</td>
                                                <td className="border border-slate-200 p-2 text-center" dir="ltr">{row.opp}</td>
                                                <td className="border border-slate-200 p-2 text-center" dir="ltr">{row.hw}</td>
                                                <td className="border border-slate-200 p-2 text-center" dir="ltr">{row.hr}</td>
                                                <td className={`border border-slate-200 p-2 text-center font-bold ${row.compliance >= 80 ? 'text-green-600' : row.compliance >= 50 ? 'text-yellow-600' : 'text-red-600'}`} dir="ltr">
                                                    {row.compliance}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 text-right block">
                            <span className="font-bold text-sky-800 ml-2">معادلة الحساب:</span>
                            نسبة الامتثال (%) = (إجمالي الإجراءات المُنفذة ÷ إجمالي الفرص) × 100
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-100 rounded-b-2xl sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] w-full text-left block" dir="ltr">
                    <Button className="inline-block ml-4 px-8 py-2 text-sm font-bold bg-sky-700 hover:bg-sky-800 text-white shadow-lg" disabled={isSaving} type="submit">
                        {isSaving ? 'جاري الحفظ...' : 'حفظ وإنهاء التقييم'}
                    </Button>
                    <Button className="inline-block px-6 py-2 text-sm font-bold bg-white text-gray-700 hover:bg-gray-50 border-gray-300" onClick={onExit} type="button" variant="secondary">
                        إلغاء الخروج
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export default HandwashingAssessmentForm;
