// AMSAssessmentForm.jsx
import React, { useState, useEffect, forwardRef } from 'react';
import { Card, Button } from '../CommonComponents';
import { handleAutoScroll } from './IMNCSkillsAssessmentForm';
import { saveMentorshipSession } from '../../data';
import { Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// --- Local ActionToggle with logical RTL support ---
function ActionToggle({ options, currentValue, onClick, name }) {
    return (
        <div className="relative z-0 inline-flex shadow-sm rounded-md flex-wrap gap-1" dir="rtl">
            {options.map(([label, value, activeClass], idx) => {
                const isSelected = currentValue === value;
                const baseClass = "relative inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition rounded-md";
                const activeState = isSelected ? `${activeClass} text-white shadow-md` : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300";
                
                return (
                    <button
                        key={value}
                        type="button"
                        className={`${baseClass} ${activeState}`}
                        onClick={() => onClick(name, value)}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

// --- AMS Survey Structure & Scoring ---
const AMS_FORM_STRUCTURE = [
    {
        sectionId: 'diagnostics',
        title: 'الممارسات التشخيصية والمزرعة الحيوية (Culture & Diagnostics)',
        maxScore: 30,
        questions: [
            {
                id: 'q1',
                label: '١. هل تقومون بشكل روتيني بسحب مزرعة دم قبل البدء بالمضادات الحيوية التجريبية؟',
                options: [
                    { label: 'دائماً (>90%)', value: 'always', score: 10 },
                    { label: 'أحياناً (50-90%)', value: 'sometimes', score: 5 },
                    { label: 'نادراً (<50%)', value: 'rarely', score: 2 },
                    { label: 'أبداً', value: 'never', score: 0 }
                ]
            },
            {
                id: 'q2',
                label: '٢. ما هو الوقت المعتاد للحصول على نتائج مزرعة الدم في وحدتكم؟',
                options: [
                    { label: 'خلال 24 ساعة', value: '24h', score: 10 },
                    { label: '24-48 ساعة', value: '48h', score: 7 },
                    { label: '48-72 ساعة', value: '72h', score: 4 },
                    { label: '>72 ساعة', value: 'gt72h', score: 1 },
                    { label: 'غير متوفرة', value: 'not_available', score: 0 }
                ]
            },
            {
                id: 'q3',
                label: '٣. ما هي المؤشرات الحيوية التي تستخدمونها روتينيا لمراقبة تسمم الدم؟ (اختر أهم مؤشر أو الأساسي)',
                options: [
                    { label: 'بروكالسيتونين (PCT)', value: 'pct', score: 10 },
                    { label: 'البروتين التفاعلي (CRP)', value: 'crp', score: 7 },
                    { label: 'صورة دم كاملة (CBC)', value: 'cbc', score: 5 },
                    { label: 'لا يوجد', value: 'none', score: 0 }
                ]
            }
        ]
    },
    {
        sectionId: 'empirical',
        title: 'استخدام المضادات التجريبية واختياراتها (Empirical Antibiotic Use)',
        maxScore: 30,
        questions: [
            {
                id: 'q4',
                label: '٤. ما هو البروتوكول القياسي الأول لتسمم الدم المبكر (EOS < 72h)؟',
                options: [
                    { label: 'أمبيسلين + جنتاميسين', value: 'amp_gent', score: 10 },
                    { label: 'بنسلين جي + جنتاميسين', value: 'pen_gent', score: 10 },
                    { label: 'سيفالوسبورين جيل ثالث', value: '3rd_gen_ceph', score: 3 },
                    { label: 'أخرى', value: 'other', score: 0 }
                ]
            },
            {
                id: 'q5',
                label: '٥. ما هو البروتوكول القياسي الأول لتسمم الدم المتأخر (LOS >= 72h)؟',
                options: [
                    { label: 'كلوكساسيلين + أميكاسين', value: 'clox_ami', score: 10 },
                    { label: 'فانكومايسين + أميكاسين', value: 'vanc_ami_gent', score: 7 },
                    { label: 'سيفالوسبورين جيل ثالث/رابع', value: '3rd_4th_ceph', score: 3 },
                    { label: 'أخرى', value: 'other', score: 0 }
                ]
            },
            {
                id: 'q6',
                label: '٦. ما هي العوامل الرئيسية التي تحدد اختياركم للمضادات الحيوية التجريبية؟',
                options: [
                    { label: 'أنماط المقاومة المحلية والإرشادات', value: 'resistance_patterns', score: 10 },
                    { label: 'التكلفة وتوفر الصيدلية', value: 'availability', score: 5 },
                    { label: 'أخرى', value: 'other', score: 0 }
                ]
            }
        ]
    },
    {
        sectionId: 'duration',
        title: 'مدة العلاج والتعديل (Duration of Therapy & De-escalation)',
        maxScore: 30,
        questions: [
            {
                id: 'q7',
                label: '٧. إذا كانت مزرعة الدم سلبية بعد 48-72 ساعة والطفل مستقر، هل توقفون المضادات؟',
                options: [
                    { label: 'نعم بشكل روتيني', value: 'yes_routinely', score: 10 },
                    { label: 'أحياناً حسب التقدير', value: 'sometimes', score: 5 },
                    { label: 'نكمل الكورس دائماً', value: 'complete_course', score: 0 }
                ]
            },
            {
                id: 'q8',
                label: '٨. بمجرد توفر نتائج المزرعة والحساسية، كم مرة تقومون بتضييق نطاق (تعديل) المضادات؟',
                options: [
                    { label: 'دائماً / غالباً', value: 'always_often', score: 10 },
                    { label: 'نادراً', value: 'seldom_rarely', score: 3 },
                    { label: 'أبداً / لا يوجد فحص', value: 'never', score: 0 }
                ]
            },
            {
                id: 'q9',
                label: '٩. ما هي المدة المعتادة للعلاج في حالات تسمم الدم المؤكدة بالمزرعة؟',
                options: [
                    { label: '7 إلى 10 أيام', value: '7_10_days', score: 10 },
                    { label: '10 إلى 14 يوماً', value: '10_14_days', score: 5 },
                    { label: 'أكثر من 14 يوماً', value: 'gt_14_days', score: 2 }
                ]
            }
        ]
    },
    {
        sectionId: 'stewardship_barriers',
        title: 'الإشراف والعقبات (Stewardship, Barriers & Resistance)',
        maxScore: 30,
        questions: [
            {
                id: 'q10',
                label: '١٠. هل يوجد في المستشفى/وحدة حديثي الولادة برنامج نشط للإشراف على استخدام المضادات (AMS)؟',
                options: [
                    { label: 'نعم، نشط ومفعل', value: 'active', score: 10 },
                    { label: 'موجود وغير نشط', value: 'inactive', score: 4 },
                    { label: 'لا يوجد', value: 'no', score: 0 }
                ]
            },
            {
                id: 'q11',
                label: '١١. ما هي العوائق الرئيسية أمام ترشيد استخدام المضادات؟',
                options: [
                    { label: 'لا توجد عوائق كبرى / منضبط', value: 'no_barriers', score: 10 },
                    { label: 'نقص التشخيص أو انقطاع الأدوية', value: 'drug_shortages', score: 5 },
                    { label: 'ضغط الأهل / غياب البروتوكولات', value: 'pressure_fear', score: 2 }
                ]
            },
            {
                id: 'q12',
                label: '١٢. هل لاحظتم زيادة في الميكروبات متعددة المقاومة (مثل MRSA أو ESBL) خلال العام الماضي؟',
                options: [
                    { label: 'لا يوجد تغيير / مراقبة جيدة', value: 'no_change', score: 10 },
                    { label: 'زيادة طفيفة', value: 'slight_increase', score: 5 },
                    { label: 'زيادة ملحوظة / غير متأكد', value: 'significant_increase', score: 0 }
                ]
            }
        ]
    },
    {
        sectionId: 'rational_use',
        title: 'مؤشرات الاستخدام الرشيد (Rational Use Indicators)',
        maxScore: 30,
        questions: [
            {
                id: 'q13',
                label: '١٣. كم مرة يتم توثيق الداعي السريري (السبب) لبدء المضادات الحيوية في الملف الطبي؟',
                options: [
                    { label: 'دائماً (100%)', value: 'always', score: 10 },
                    { label: 'غالباً (75-99%)', value: 'most', score: 7 },
                    { label: 'أحياناً أو نادراً', value: 'sometimes', score: 0 }
                ]
            },
            {
                id: 'q14',
                label: '١٤. هل يتم توثيق المبرر السريري لتغيير المضاد الحيوي أو تصعيده بوضوح في الملف؟',
                options: [
                    { label: 'نعم، دائماً', value: 'always', score: 10 },
                    { label: 'نعم، أحياناً', value: 'sometimes', score: 5 },
                    { label: 'نادراً أو لا يتم', value: 'rarely_never', score: 0 }
                ]
            },
            {
                id: 'q15',
                label: '١٥. هل تتطلب وحدتكم إذناً مسبقاً قبل وصف المضادات "المقيدة" (مثل الميروبينيم)؟',
                options: [
                    { label: 'نعم، يتطلب إذناً صارماً', value: 'strict', score: 10 },
                    { label: 'موصى به وليس إجبارياً', value: 'recommended', score: 5 },
                    { label: 'لا، يمكن لأي طبيب وصفها', value: 'anyone', score: 0 }
                ]
            }
        ]
    },
    {
        sectionId: 'reporting_surveillance',
        title: 'أهمية الإبلاغ والترصد (Surveillance & Reporting)',
        maxScore: 30,
        questions: [
            {
                id: 'q16',
                label: '١٦. ما مدى أهمية الإبلاغ المنتظم عن استهلاك المضادات الحيوية إلى سجل وطني؟',
                options: [
                    { label: 'مهم جداً', value: 'extremely', score: 10 },
                    { label: 'متوسط الأهمية', value: 'moderately', score: 5 },
                    { label: 'قليل / غير مهم', value: 'low', score: 0 }
                ]
            },
            {
                id: 'q17',
                label: '١٧. هل تقوم وحدتكم بإبلاغ السلطات بأنماط مقاومة المضادات بشكل نشط؟',
                options: [
                    { label: 'نعم، بشكل منتظم', value: 'regularly', score: 10 },
                    { label: 'بشكل متقطع', value: 'occasionally', score: 5 },
                    { label: 'لا نقوم بالإبلاغ / لا أعلم', value: 'no', score: 0 }
                ]
            },
            {
                id: 'q18',
                label: '١٨. ما مدى فائدة تلقي تقارير دورية عن حساسية الميكروبات لتوجيه خياراتكم؟',
                options: [
                    { label: 'مفيدة للغاية', value: 'extremely', score: 10 },
                    { label: 'مفيدة نوعاً ما', value: 'somewhat', score: 5 },
                    { label: 'غير مفيدة / غير متأكد', value: 'not', score: 0 }
                ]
            }
        ]
    },
    {
        sectionId: 'guidelines_eml',
        title: 'البروتوكولات وقائمة الأدوية الأساسية (Guidelines & EML)',
        maxScore: 30,
        questions: [
            {
                id: 'q19',
                label: '١٩. هل تمتلك وحدتكم بروتوكولاً/دليلاً علاجياً مكتوباً ومعدلاً محلياً لوصف المضادات التجريبية؟',
                options: [
                    { label: 'نعم ويتبع بصرامة', value: 'strictly_followed', score: 10 },
                    { label: 'موجود ولكنه نادراً ما يُتبع', value: 'rarely_followed', score: 4 },
                    { label: 'لا يوجد / نعتمد على التقدير', value: 'individual_judgment', score: 0 }
                ]
            },
            {
                id: 'q20',
                label: '٢٠. هل المضادات الحيوية الأساسية متوافقة مع القائمة الوطنية للأدوية الأساسية (EML)؟',
                options: [
                    { label: 'نعم متوافقة تماماً', value: 'completely_aligned', score: 10 },
                    { label: 'متوافقة جزئياً', value: 'partially_aligned', score: 5 },
                    { label: 'لا / لا أعلم', value: 'non_eml', score: 0 }
                ]
            },
            {
                id: 'q21',
                label: '٢١. كم مرة يجبركم نقص الأدوية الأساسية على وصف بدائل أوسع طيفاً (مقيدة)؟',
                options: [
                    { label: 'نادراً أو أبداً', value: 'rarely_never', score: 10 },
                    { label: 'أحياناً (شهرياً)', value: 'occasionally', score: 5 },
                    { label: 'بشكل متكرر (أسبوعياً)', value: 'frequently', score: 0 }
                ]
            }
        ]
    }
];

// --- Sticky Overall Score Widget ---
const StickyOverallScore = ({ totalScore, maxScore = 210 }) => {
    let level = "يحتاج تحسين";
    let bgColor = "bg-red-600";
    
    const percentage = Math.round((totalScore / maxScore) * 100);

    if (percentage >= 80) {
        level = "متقدم";
        bgColor = "bg-green-600";
    } else if (percentage >= 60) {
        level = "جيد";
        bgColor = "bg-blue-500";
    } else if (percentage >= 40) {
        level = "متوسط";
        bgColor = "bg-yellow-500";
    } else {
        level = "ضعيف";
        bgColor = "bg-red-600";
    }

    return (
        <div className={`fixed top-4 left-4 z-50 flex flex-col items-center justify-center p-3 w-32 h-32 rounded-full ${bgColor} text-white shadow-2xl transition-all duration-300 border-4 border-white`} dir="rtl">
            <div className="font-bold text-3xl leading-none drop-shadow-md">{totalScore}</div>
            <div className="text-sm mt-1 text-center font-medium opacity-90">من {maxScore}</div>
            <div className="text-xs mt-2 text-center font-bold bg-black bg-opacity-25 px-2 py-1 rounded w-11/12 overflow-hidden text-ellipsis whitespace-nowrap">{level}</div>
        </div>
    );
};

const AMSAssessmentForm = forwardRef(({ facility, onSaveComplete, onExit, setToast, existingSessionData }, ref) => {
    
    const [formData, setFormData] = useState({});
    const [scores, setScores] = useState({ total: 0, sections: {} });
    const [isSaving, setIsSaving] = useState(false);
    
    const auth = getAuth();
    const user = auth.currentUser;

    // 1. Initialize Form State
    useEffect(() => {
        if (existingSessionData?.assessmentData) {
            setFormData(existingSessionData.assessmentData);
        } else {
            const initial = {};
            AMS_FORM_STRUCTURE.forEach(section => {
                section.questions.forEach(q => {
                    initial[q.id] = '';
                });
            });
            setFormData(initial);
        }
    }, [existingSessionData]);

    // 2. Real-time Live Scoring Calculation
    useEffect(() => {
        let totalScore = 0;
        const sectionScores = {};

        AMS_FORM_STRUCTURE.forEach(section => {
            let sectionTotal = 0;
            section.questions.forEach(q => {
                const answer = formData[q.id];
                const selectedOption = q.options.find(opt => opt.value === answer);
                if (selectedOption) {
                    sectionTotal += selectedOption.score;
                }
            });
            sectionScores[section.sectionId] = sectionTotal;
            totalScore += sectionTotal;
        });

        setScores({ total: totalScore, sections: sectionScores });
    }, [formData]);

    // 3. Handle selection and trigger auto-scroll
    const handleOptionChange = (questionId, value) => {
        setFormData(prev => ({ ...prev, [questionId]: value }));
        handleAutoScroll();
    };

    // 4. Submission Handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSaving) return;
        
        const unanswered = AMS_FORM_STRUCTURE.flatMap(s => s.questions).filter(q => formData[q.id] === '');
        if (unanswered.length > 0) {
            if (setToast) setToast({ show: true, message: `الرجاء الإجابة على جميع الأسئلة. متبقي ${unanswered.length} سؤال.`, type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            const sessionDate = new Date().toISOString().split('T')[0];
            const effectiveDateTimestamp = Timestamp.fromDate(new Date());

            const maxPossibleScore = AMS_FORM_STRUCTURE.reduce((acc, s) => acc + s.maxScore, 0);
            const percentageVal = Math.round((scores.total / maxPossibleScore) * 100);

            const payload = {
                serviceType: 'IPC', 
                formCategory: 'AMS_Stewardship',
                state: facility?.['الولاية'] || null,
                locality: facility?.['المحلية'] || null,
                facilityId: facility?.id || null,
                facilityName: facility?.['اسم_المؤسسة'] || null,
                facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                healthWorkerName: 'N/A',
                workerType: null,
                sessionDate: sessionDate,
                effectiveDate: effectiveDateTimestamp,
                assessmentData: formData,
                scores: {
                    ...scores,
                    overallScore_score: scores.total,
                    overallScore_maxScore: maxPossibleScore,
                    percentage: percentageVal
                },
                status: 'complete',
                visitNumber: 1,
                mentorEmail: user?.email || 'unknown',
                mentorName: user?.displayName || 'Unknown Mentor',
                project: facility?.project_name || facility?.['المشروع'] || 'N/A'
            };

            const savedId = await saveMentorshipSession(payload, existingSessionData?.id);
            payload.id = savedId;

            if (setToast) setToast({ show: true, message: "تم حفظ استبيان الإشراف على مضادات الميكروبات بنجاح!", type: 'success' });
            
            setTimeout(() => {
                if (onSaveComplete) onSaveComplete('complete', payload);
            }, 100);

        } catch (error) {
            console.error("Error saving AMS Form:", error);
            if (setToast) setToast({ show: true, message: `حدث خطأ أثناء الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card dir="rtl" className="relative pb-20">
            <StickyOverallScore totalScore={scores.total} maxScore={210} />
            <form onSubmit={handleSubmit}>
                <div className="p-4 sm:p-8">
                    
                    {/* Header Info */}
                    <div className="text-center mb-10 pb-6 border-b border-gray-200">
                        <h2 className="text-2xl font-extrabold text-sky-900 mb-2">
                            استبيان استخدام مضادات الميكروبات ومقاومتها والإشراف عليها (AMS)
                        </h2>
                        <p className="text-gray-600 text-sm max-w-3xl mx-auto leading-relaxed">
                            تقييم ومتابعة سياسات وبرامج ترشيد استخدام المضادات الحيوية بوحدات حديثي الولادة والمستشفيات.
                        </p>
                    </div>

                    {/* Facility Summary Strip */}
                    <div className="mb-8 p-4 border rounded-xl bg-sky-50 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div><span className="text-gray-500 font-medium">الولاية:</span> <span className="font-bold text-sky-900 mx-1">{facility?.['الولاية'] || 'غير محدد'}</span></div>
                            <div><span className="text-gray-500 font-medium">المحلية:</span> <span className="font-bold text-sky-900 mx-1">{facility?.['المحلية'] || 'غير محدد'}</span></div>
                            <div><span className="text-gray-500 font-medium">اسم المؤسسة:</span> <span className="font-bold text-sky-900 mx-1">{facility?.['اسم_المؤسسة'] || 'غير محدد'}</span></div>
                        </div>
                    </div>

                    {/* Form Sections */}
                    {AMS_FORM_STRUCTURE.map(section => (
                        <div key={section.sectionId} className="mb-10 border border-slate-300 rounded-2xl bg-white overflow-hidden shadow-sm">
                            <div className="bg-slate-800 text-white p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                                <h3 className="text-lg font-bold text-center sm:text-right w-full">{section.title}</h3>
                                <div className="font-bold bg-sky-600 text-white px-3 py-1.5 rounded-lg whitespace-nowrap shadow-inner text-sm">
                                    النتيجة: {scores.sections[section.sectionId] || 0} / {section.maxScore}
                                </div>
                            </div>
                            
                            <div className="divide-y divide-slate-100 p-2 sm:p-4 bg-slate-50">
                                {section.questions.map((q) => {
                                    const isAnswered = formData[q.id] !== '';
                                    return (
                                        <div
                                            key={q.id}
                                            className={`flex flex-col xl:flex-row-reverse justify-between items-start p-4 hover:bg-sky-50 transition-colors gap-4 rounded-xl ${isAnswered ? 'row-answered' : 'row-unanswered bg-white shadow-sm mb-1.5'}`}
                                        >
                                            <span className="font-medium text-slate-800 text-sm xl:w-5/12 leading-relaxed text-right">
                                                {q.label}
                                            </span>
                                            <div className="w-full xl:w-7/12 flex justify-start">
                                                <ActionToggle
                                                    name={q.id}
                                                    options={q.options.map(opt => [opt.label, opt.value, 'bg-sky-700 border-sky-700 shadow-md'])}
                                                    currentValue={formData[q.id]}
                                                    onClick={handleOptionChange}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Action Footer */}
                <div className="flex justify-between items-center p-4 border-t bg-gray-100 rounded-b-2xl sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <Button type="button" variant="secondary" onClick={onExit} className="px-6 py-2 text-sm font-bold bg-white text-gray-700 hover:bg-gray-50 border-gray-300">
                        إلغاء الخروج
                    </Button>
                    <Button type="submit" disabled={isSaving} className="px-8 py-2 text-sm font-bold bg-sky-700 hover:bg-sky-800 text-white shadow-lg">
                        {isSaving ? 'جاري الحفظ...' : 'حفظ وإنهاء الاستبيان'}
                    </Button>
                </div>
            </form>
        </Card>
    );
});

export default AMSAssessmentForm;