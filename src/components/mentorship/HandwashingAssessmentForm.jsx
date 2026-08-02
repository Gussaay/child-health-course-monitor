import React, { useState, useEffect } from 'react';
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

const HandwashingAssessmentForm = ({ facility, healthWorkerName, healthWorkerJobTitle, onExit, onSaveComplete, setToast, existingSessionData }) => {
    const auth = getAuth();
    const user = auth.currentUser;
    const [isSaving, setIsSaving] = useState(false);
    
    const [opportunities, setOpportunities] = useState(() => {
        if (existingSessionData?.assessmentData) return existingSessionData.assessmentData;
        return Array.from({ length: 2 }, () => ({ indications: [], action: '', gloveUse: false }));
    });
    
    const [sessionStats, setSessionStats] = useState({ opp: 0, hw: 0, hr: 0, compliance: 0 });

    useEffect(() => {
        let oppCount = 0;
        let hwCount = 0;
        let hrCount = 0;

        opportunities.forEach(opp => {
            if (opp.indications.length > 0 && opp.action) {
                oppCount++;
                if (opp.action === 'wash') hwCount++;
                if (opp.action === 'rub') hrCount++;
            }
        });

        const totalActions = hwCount + hrCount;
        const compliance = oppCount > 0 ? Math.round((totalActions / oppCount) * 100) : 0;

        setSessionStats({ opp: oppCount, hw: hwCount, hr: hrCount, compliance });
    }, [opportunities]);

    const handleIndicationToggle = (idx, indId) => {
        const newOpps = [...opportunities];
        const inds = newOpps[idx].indications;
        if (inds.includes(indId)) {
            newOpps[idx].indications = inds.filter(i => i !== indId);
        } else {
            newOpps[idx].indications = [...inds, indId];
        }
        setOpportunities(newOpps);
    };

    const handleActionChange = (idx, actValue) => {
        const newOpps = [...opportunities];
        newOpps[idx].action = actValue;
        if (actValue !== 'missed') {
            newOpps[idx].gloveUse = false;
        }
        setOpportunities(newOpps);
    };

    const handleGloveUseToggle = (idx) => {
        const newOpps = [...opportunities];
        newOpps[idx].gloveUse = !newOpps[idx].gloveUse;
        setOpportunities(newOpps);
    };

    const handleAddOpportunity = () => {
        setOpportunities([...opportunities, { indications: [], action: '', gloveUse: false }]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                serviceType: 'IPC',
                formType: 'handwashing',
                state: facility?.['الولاية'] || null,
                locality: facility?.['المحلية'] || null,
                facilityId: facility?.id || null,
                facilityName: facility?.['اسم_المؤسسة'] || null,
                facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                healthWorkerName: healthWorkerName,
                workerType: healthWorkerJobTitle || null,
                sessionDate: new Date().toISOString().split('T')[0],
                effectiveDate: Timestamp.fromDate(new Date()),
                assessmentData: opportunities,
                scores: { 
                    overallScore_score: sessionStats.compliance, 
                    overallScore_maxScore: 100,
                    opportunities_count: sessionStats.opp,
                    handwash_count: sessionStats.hw,
                    handrub_count: sessionStats.hr
                },
                status: 'complete',
                mentorEmail: user?.email || 'unknown',
                mentorName: user?.displayName || 'Unknown Mentor',
                project: facility?.project_name || facility?.['المشروع'] || 'N/A'
            };

            const savedId = await saveMentorshipSession(payload, existingSessionData?.id);
            payload.id = savedId;
            if (onSaveComplete) onSaveComplete('complete', payload);
            if (setToast) setToast({ show: true, message: "تم حفظ تقييم الالتزام بنظافة الأيدي بنجاح!", type: 'success' });
        } catch (error) {
            if (setToast) setToast({ show: true, message: `حدث خطأ أثناء الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
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
                        <p className="text-gray-600 text-base font-semibold">الممارس: {healthWorkerName} {healthWorkerJobTitle ? `(${healthWorkerJobTitle})` : ''}</p>
                    </div>

                    <div className="bg-sky-50 border-r-4 border-sky-600 p-5 rounded-l-lg mb-8 shadow-sm text-right">
                        <h3 className="font-bold text-sky-900 mb-3 text-lg">تعليمات التقييم:</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-sky-800 font-medium leading-relaxed">
                            <li>يجوز للمراقب مراقبة ما يصل إلى ثلاثة من العاملين في مجال الرعاية الصحية في وقت واحد.</li>
                            <li>بمجرد اكتشاف داعٍ لنظافة الأيدي، احسب "فرصة" في العمود المناسب، وضع علامة في المربع المقابل للداعي (الدواعي).</li>
                            <li>ضع علامة في المربعات (قد ينطبق أكثر من خيار للفرصة الواحدة) أو الدوائر (خيار واحد فقط للإجراء).</li>
                            <li>يجب دائماً تسجيل الإجراءات المنفذة أو الفائتة ضمن سياق الفرصة (لا تحتسب الفرصة مالم يتم تحديد داعٍ واحد على الأقل).</li>
                            <li>يمكن تسجيل استخدام القفازات فقط عندما يتم تفويت إجراء نظافة الأيدي بينما يرتدي العامل القفازات.</li>
                        </ol>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {opportunities.map((opp, idx) => (
                            <div key={idx} className={`border rounded-xl p-4 shadow-sm transition-shadow ${opp.indications.length > 0 && opp.action ? 'border-green-300 bg-green-50/30' : 'border-slate-300 bg-slate-50'}`}>
                                <h4 className="font-bold text-sky-800 mb-4 border-b border-slate-200 pb-2 text-right block">
                                    <span className="align-middle">الفرصة رقم {idx + 1}</span>
                                    {opp.indications.length > 0 && opp.action && (
                                        <span className="mr-3 align-middle text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">مكتملة</span>
                                    )}
                                </h4>
                                
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
                        <Button className="inline-block bg-white border-sky-500 text-sky-700 hover:bg-sky-50 font-bold px-6 py-2 shadow-sm rounded-full transition-colors" onClick={handleAddOpportunity} type="button" variant="outline">
                            + إضافة فرصة جديدة
                        </Button>
                    </div>

                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-6 shadow-sm mb-4 w-full text-right block">
                        <div className="mb-6 border-b border-sky-200 pb-4 text-right block">
                            <h3 className="inline-block align-middle text-xl font-bold text-sky-900 ml-4">تجميع البيانات لكل جلسة</h3>
                            <span className="inline-block align-middle bg-white text-sky-800 border border-sky-300 px-4 py-1.5 rounded-full text-sm font-bold">
                                الفئة المهنية: {healthWorkerJobTitle || 'غير محدد'}
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