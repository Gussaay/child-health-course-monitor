import React, { useState, useEffect, forwardRef } from 'react';
import { Card, Button } from '../CommonComponents';
import { handleAutoScroll } from './IMNCSkillsAssessmentForm';
import { saveMentorshipSession } from '../../data';
import { Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// --- Local ActionToggle with logical RTL support ---
function ActionToggle({ options, currentValue, onClick, name }) {
    return (
        <div className="relative z-0 inline-flex shadow-sm rounded-md flex-shrink-0" dir="rtl">
            {options.map(([label, value, activeClass], idx) => {
                const isSelected = currentValue === value;
                const baseClass = "relative inline-flex items-center justify-center px-3 py-1 text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition";
                const activeState = isSelected ? `${activeClass} text-white` : "bg-white text-gray-700 hover:bg-gray-50";
                
                let roundedClass = "";
                if (idx === 0) roundedClass = "rounded-s-md";
                else if (idx === options.length - 1) roundedClass = "rounded-e-md";
                if (options.length === 1) roundedClass = "rounded-md";
                if (idx > 0) roundedClass += " -me-px border border-gray-300";
                else roundedClass += " border border-gray-300";

                return (
                    <button
                        key={value}
                        type="button"
                        className={`${baseClass} ${activeState} ${roundedClass}`}
                        onClick={() => onClick(name, value)}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

// --- WHO IPC Framework Structure & Scoring ---
// 8 Core Components (CC) - Max Score: 800 (100 per section)
const IPC_FORM_STRUCTURE = [
    {
        sectionId: 'cc1',
        title: 'العنصر الأساسي 1: برنامج الطب الوقائي ومكافحة العدوى',
        maxScore: 100,
        questions: [
            {
                id: 'cc1_q1',
                label: '١. هل يوجد لدى منشأتك الصحية برنامج الطب الوقائي ومكافحة العدوى؟',
                options: [
                    { label: 'لا', value: 'no', score: 0 },
                    { label: 'نعم، ولكن بأهداف غير واضحة', value: 'yes_unclear', score: 5 },
                    { label: 'نعم، بأهداف واضحة وخطة سنوية', value: 'yes_clear', score: 10 }
                ]
            },
            {
                id: 'cc1_q2',
                label: '٢. هل يتضمن برنامج مكافحة العدوى فريق أو مختص؟',
                options: [
                    { label: 'لا', value: 'no', score: 0 },
                    { label: 'شخص مسؤول فقط', value: 'person_only', score: 5 },
                    { label: 'نعم، يوجد فريق', value: 'team', score: 10 }
                ]
            },
            {
                id: 'cc1_q3',
                label: '٣. هل يتضمن فريق مكافحة العدوى خبيراً متفرغاً؟ (١ لكل ٢٥٠ سرير)',
                options: [
                    { label: 'لا يوجد', value: 'none', score: 0 },
                    { label: 'بدوام جزئي فقط', value: 'part_time', score: 2.5 },
                    { label: 'نعم، ١ لكل أكثر من ٢٥٠ سرير', value: 'ratio_high', score: 5 },
                    { label: 'نعم، ١ لكل ٢٥٠ سرير أو أقل', value: 'ratio_low', score: 10 }
                ]
            },
            {
                id: 'cc1_q4',
                label: '٤. هل يخصص فريق مكافحة العدوى وقتاً للأنشطة؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 10 }]
            },
            {
                id: 'cc1_q5',
                label: '٥. هل يحتوي فريق مكافحة العدوى على أطباء وممرضين؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 10 }]
            },
            {
                id: 'cc1_q6',
                label: '٦. هل يوجد لجنة لمكافحة العدوى تدعم الفريق بفعالية؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 10 }]
            },
            {
                id: 'cc1_q7',
                label: '٧. هل تتضمن لجنة مكافحة العدوى (قيادة عليا، طاقم طبي، إدارة المنشأة)؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 10 }]
            },
            {
                id: 'cc1_q8',
                label: '٨. هل أهداف مكافحة العدوى محددة بوضوح وقابلة للقياس؟',
                options: [
                    { label: 'لا', value: 'no', score: 0 },
                    { label: 'أهداف فقط', value: 'goals_only', score: 5 },
                    { label: 'أهداف ومؤشرات قياس', value: 'goals_kpi', score: 10 }
                ]
            },
            {
                id: 'cc1_q9',
                label: '٩. هل تظهر القيادة العليا التزاماً ودعماً (مع ميزانية مخصصة)؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 10 }]
            },
            {
                id: 'cc1_q10',
                label: '١٠. هل تمتلك منشأتك دعم مخبري ميكروبيولوجي؟',
                options: [
                    { label: 'لا', value: 'no', score: 0 },
                    { label: 'نعم، لكن غير موثوق', value: 'yes_poor', score: 5 },
                    { label: 'نعم، موثوق وفي الوقت المناسب', value: 'yes_good', score: 10 }
                ]
            }
        ]
    },
    {
        sectionId: 'cc2',
        title: 'العنصر الأساسي 2: إرشادات ومبادئ مكافحة العدوى',
        maxScore: 100,
        questions: [
            {
                id: 'cc2_q1',
                label: '١. هل يتوفر لدى المنشأة إرشادات مكتوبة لمكافحة العدوى؟',
                options: [
                    { label: 'لا', value: 'no', score: 0 },
                    { label: 'نعم، ولكن غير محدثة', value: 'yes_outdated', score: 5 },
                    { label: 'نعم، محدثة ومبنية على الأدلة', value: 'yes_updated', score: 10 }
                ]
            },
            {
                id: 'cc2_q2',
                label: '٢. هل تتوفر إرشادات نظافة اليدين؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 15 }]
            },
            {
                id: 'cc2_q3',
                label: '٣. هل تتوفر إرشادات العزل والاحتياطات القياسية؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 15 }]
            },
            {
                id: 'cc2_q4',
                label: '٤. هل تتوفر إرشادات التطهير والتعقيم؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 15 }]
            },
            {
                id: 'cc2_q5',
                label: '٥. هل يتم تدريب الموظفين على هذه الإرشادات؟',
                options: [
                    { label: 'لا', value: 'no', score: 0 },
                    { label: 'أحياناً', value: 'sometimes', score: 10 },
                    { label: 'بشكل دوري وموثق', value: 'regularly', score: 20 }
                ]
            },
            {
                id: 'cc2_q6',
                label: '٦. هل يتم رصد الامتثال لهذه الإرشادات؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            }
        ]
    },
    {
        sectionId: 'cc3',
        title: 'العنصر الأساسي 3: تعليم وتدريب مكافحة العدوى',
        maxScore: 100,
        questions: [
            {
                id: 'cc3_q1',
                label: '١. هل يوجد برنامج تدريبي مستمر لمكافحة العدوى لجميع الموظفين؟',
                options: [
                    { label: 'لا', value: 'no', score: 0 },
                    { label: 'نعم، عند التعيين فقط', value: 'orientation_only', score: 5 },
                    { label: 'نعم، تدريب مستمر', value: 'continuous', score: 15 }
                ]
            },
            {
                id: 'cc3_q2',
                label: '٢. هل يشمل التدريب الأطباء والإداريين وليس فقط التمريض؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc3_q3',
                label: '٣. هل يتم تقييم فعالية التدريب (اختبارات/عملي)؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            },
            {
                id: 'cc3_q4',
                label: '٤. هل يوجد سجلات موثقة لحضور التدريب؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc3_q5',
                label: '٥. هل يتم توفير التدريب بلغة يفهمها جميع الموظفين والعمال؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            }
        ]
    },
    {
        sectionId: 'cc4',
        title: 'العنصر الأساسي 4: مراقبة العدوى المرتبطة بالرعاية الصحية',
        maxScore: 100,
        questions: [
            {
                id: 'cc4_q1',
                label: '١. هل يوجد برنامج نشط لمراقبة العدوى المكتسبة في المستشفى؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc4_q2',
                label: '٢. هل يتم رصد التهابات مجرى الدم؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 15 }]
            },
            {
                id: 'cc4_q3',
                label: '٣. هل يتم رصد التهابات المسالك البولية المرتبطة بالقسطرة؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 15 }]
            },
            {
                id: 'cc4_q4',
                label: '٤. هل يتم رصد التهابات الجروح الجراحية؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 15 }]
            },
            {
                id: 'cc4_q5',
                label: '٥. هل يتم تحليل البيانات ورفع تقارير للإدارة العليا؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc4_q6',
                label: '٦. هل يتم مشاركة نتائج المراقبة مع الطاقم الطبي لتحسين الأداء؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 15 }]
            }
        ]
    },
    {
        sectionId: 'cc5',
        title: 'العنصر الأساسي 5: استراتيجيات متعددة الوسائط',
        maxScore: 100,
        questions: [
            {
                id: 'cc5_q1',
                label: '١. هل يتم استخدام استراتيجيات متعددة لتطبيق مبادرات مكافحة العدوى؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            },
            {
                id: 'cc5_q2',
                label: '٢. هل تتضمن هذه الاستراتيجيات توفير النظام الأدوات المطلوبة؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            },
            {
                id: 'cc5_q3',
                label: '٣. هل تتضمن تغيير ثقافة العمل ودعم القيادة؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            },
            {
                id: 'cc5_q4',
                label: '٤. هل يتم إشراك المرضى ومرافقيهم في التوعية بمكافحة العدوى؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            }
        ]
    },
    {
        sectionId: 'cc6',
        title: 'العنصر الأساسي 6: مراقبة وتدقيق ممارسات مكافحة العدوى',
        maxScore: 100,
        questions: [
            {
                id: 'cc6_q1',
                label: '١. هل يتم إجراء تدقيق دوري لنظافة اليدين؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc6_q2',
                label: '٢. هل يتم تدقيق عمليات التنظيف البيئي والتطهير؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc6_q3',
                label: '٣. هل يتم تدقيق قسم التعقيم المركزي؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc6_q4',
                label: '٤. هل يتم إعطاء تغذية راجعة فورية للموظفين عند رصد أخطاء؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc6_q5',
                label: '٥. هل يتم استخدام نماذج تدقيق معتمدة وموحدة؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            }
        ]
    },
    {
        sectionId: 'cc7',
        title: 'العنصر الأساسي 7: ضغط العمل، التوظيف، وشغل الأسرة',
        maxScore: 100,
        questions: [
            {
                id: 'cc7_q1',
                label: '١. هل يتم الالتزام بمعيار سرير واحد لكل مريض (لا تتم مشاركة الأسرة)؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            },
            {
                id: 'cc7_q2',
                label: '٢. هل يتم الحفاظ على مسافة متر واحد على الأقل بين الأسرة؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            },
            {
                id: 'cc7_q3',
                label: '٣. هل عدد طاقم التمريض كافٍ لتلبية احتياجات المرضى دون إرهاق؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            },
            {
                id: 'cc7_q4',
                label: '٤. هل يتم تجنب التكدس الزائد للمرضى في أقسام الطوارئ؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 25 }]
            }
        ]
    },
    {
        sectionId: 'cc8',
        title: 'العنصر الأساسي 8: توفر البيئة المناسبة والمواد والمعدات',
        maxScore: 100,
        questions: [
            {
                id: 'cc8_q1',
                label: '١. هل يتوفر مصدر مياه نظيفة وآمنة بشكل مستمر (٢٤/٧)؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc8_q2',
                label: '٢. هل تتوفر مرافق غسيل اليدين (ماء، صابون، مناشف ورقية) في مناطق رعاية المرضى؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc8_q3',
                label: '٣. هل يتوفر معقم الأيدي الكحولي عند كل نقطة رعاية؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc8_q4',
                label: '٤. هل يتوفر إمداد مستمر لأدوات الحماية الشخصية (قفازات، كمامات، مريلة)؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            },
            {
                id: 'cc8_q5',
                label: '٥. هل تتوفر حاويات تخلص آمن من الأدوات الحادة والنفايات الطبية المعدية؟',
                options: [{ label: 'لا', value: 'no', score: 0 }, { label: 'نعم', value: 'yes', score: 20 }]
            }
        ]
    }
];

// --- Sticky Score Widget ---
const StickyOverallScore = ({ totalScore, maxScore = 800 }) => {
    let level = "غير كاف";
    let bgColor = "bg-red-600";
    
    if (totalScore >= 601) {
        level = "متقدم";
        bgColor = "bg-green-600";
    } else if (totalScore >= 401) {
        level = "متوسط";
        bgColor = "bg-blue-500";
    } else if (totalScore >= 201) {
        level = "أساسي";
        bgColor = "bg-yellow-500";
    } else {
        level = "غير كاف";
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

const IPCAssessmentForm = forwardRef(({ facility, onSaveComplete, onExit, setToast }, ref) => {
    
    const [formData, setFormData] = useState({});
    const [scores, setScores] = useState({ total: 0, sections: {} });
    const [isSaving, setIsSaving] = useState(false);
    const auth = getAuth();
    const user = auth.currentUser;

    // 1. Initialize Form Data State
    useEffect(() => {
        const initial = {};
        IPC_FORM_STRUCTURE.forEach(section => {
            section.questions.forEach(q => {
                initial[q.id] = '';
            });
        });
        setFormData(initial);
    }, []);

    // 2. Real-time live scoring logic
    useEffect(() => {
        let totalScore = 0;
        const sectionScores = {};

        IPC_FORM_STRUCTURE.forEach(section => {
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

    // 3. Handle selection and trigger autoscroll
    const handleOptionChange = (questionId, value) => {
        setFormData(prev => ({ ...prev, [questionId]: value }));
        handleAutoScroll();
    };

    // 4. Form Submission with Firebase save
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSaving) return;
        
        // Validation: Ensure all questions are answered
        const unanswered = IPC_FORM_STRUCTURE.flatMap(s => s.questions).filter(q => formData[q.id] === '');
        if (unanswered.length > 0) {
            if (setToast) setToast({ show: true, message: `الرجاء الإجابة على جميع الأسئلة. متبقي ${unanswered.length} سؤال.`, type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            const sessionDate = new Date().toISOString().split('T')[0];
            const effectiveDateTimestamp = Timestamp.fromDate(new Date());

            const payload = {
                serviceType: 'IPC',
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
                scores: scores,
                notes: '',
                status: 'complete',
                visitNumber: 1,
                mentorEmail: user?.email || 'unknown',
                mentorName: user?.displayName || 'Unknown Mentor',
                project: facility?.project_name || facility?.['المشروع'] || 'N/A'
            };

            const savedId = await saveMentorshipSession(payload);
            payload.id = savedId;

            if (onSaveComplete) onSaveComplete('complete', payload);
            if (setToast) setToast({ show: true, message: "تم حفظ تقييم الطب الوقائي ومكافحة العدوى بنجاح!", type: 'success' });
        } catch (error) {
            console.error("Error saving IPC:", error);
            if (setToast) setToast({ show: true, message: `حدث خطأ أثناء الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card dir="rtl" className="relative pb-20">
            <StickyOverallScore totalScore={scores.total} />
            <form onSubmit={handleSubmit}>
                <div className="p-4 sm:p-8">
                    <div className="text-center mb-10 pb-6 border-b border-gray-200">
                        <h2 className="text-2xl font-extrabold text-sky-900 mb-2">
                            تقييم برنامج الطب الوقائي ومكافحة العدوى بالمستشفيات
                        </h2>
                        <p className="text-gray-600 text-base">بناءً على المبادئ التوجيهية لمنظمة الصحة العالمية</p>
                    </div>

                    {IPC_FORM_STRUCTURE.map(section => (
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
                                            className={`flex flex-row-reverse justify-between items-start p-3 hover:bg-sky-50 transition-colors gap-4 rounded-xl ${isAnswered ? 'row-answered' : 'row-unanswered bg-white shadow-sm mb-1.5'}`}
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

                <div className="flex justify-between items-center p-4 border-t bg-gray-100 rounded-b-2xl sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <Button type="button" variant="secondary" onClick={onExit} className="px-6 py-2 text-sm font-bold bg-white text-gray-700 hover:bg-gray-50 border-gray-300">
                        إلغاء الخروج
                    </Button>
                    <Button type="submit" disabled={isSaving} className="px-8 py-2 text-sm font-bold bg-sky-700 hover:bg-sky-800 text-white shadow-lg">
                        {isSaving ? 'جاري الحفظ...' : 'حفظ وإنهاء التقييم'}
                    </Button>
                </div>
            </form>
        </Card>
    );
});

export default IPCAssessmentForm;