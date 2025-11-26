// MothersForm.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { saveMentorshipSession } from '../../data';
import { Timestamp } from 'firebase/firestore';
import {
    Card, 
    Button, 
    FormGroup, 
    Select, 
    Textarea,
    Input 
} from '../CommonComponents';
import { getAuth } from "firebase/auth";

// --- Score Circle Component ---
const ScoreCircle = ({ score, maxScore }) => {
    if (maxScore === null || maxScore === undefined || score === null || score === undefined) {
        return null;
    }

    let percentage;
    if (maxScore === 0) {
        percentage = (score === 0) ? 100 : 0; 
    } else {
        percentage = Math.round((score / maxScore) * 100);
    }

    let bgColor = 'bg-gray-400';
    if (maxScore > 0) {
        if (percentage >= 80) {
            bgColor = 'bg-green-600';
        } else if (percentage >= 50) {
            bgColor = 'bg-yellow-500';
        } else {
            bgColor = 'bg-red-600';
        }
    } else if (maxScore === 0) {
         bgColor = 'bg-green-600'; 
    }

    return (
        <div
            className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-white font-bold text-xs shadow-md ml-2`} 
            title={`${score} / ${maxScore} (${maxScore > 0 ? percentage + '%' : 'N/A'})`}
        >
            {maxScore === 0 ? 'N/A' : `${percentage}%`}
        </div>
    );
};

// --- Sticky Overall Score Component ---
const StickyOverallScore = ({ totalScore, totalMaxScore }) => {
    if (totalScore === null || totalMaxScore === null || totalMaxScore === 0 || totalScore === undefined || totalMaxScore === undefined) return null;
    
    let percentage = Math.round((totalScore / totalMaxScore) * 100);
    let bgColor = 'bg-gray-400';
    if (percentage >= 80) {
        bgColor = 'bg-green-600';
    } else if (percentage >= 50) {
        bgColor = 'bg-yellow-500';
    } else {
        bgColor = 'bg-red-600';
    }

    return (
        <div
            className={`fixed top-4 left-4 z-50 flex flex-col items-center justify-center p-3 w-16 h-16 sm:w-20 sm:h-20 rounded-lg ${bgColor} text-white shadow-2xl transition-all duration-300 transform hover:scale-105 text-xs sm:text-lg`}
            dir="ltr"
        >
            <div className="font-bold text-sm sm:text-lg leading-none">{totalMaxScore === 0 ? 'N/A' : `${percentage}%`}</div>
            <div className="text-[10px] sm:text-xs mt-1 text-center leading-tight">Overall Score</div>
            <div className="text-[10px] sm:text-xs mt-0 leading-tight">({totalScore}/{totalMaxScore})</div>
        </div>
    );
};

const MOTHER_KNOWLEDGE_QUESTIONS = [
    { key: 'knows_med_details', label: '1. الأم التي طفلها أعطى مضاد حيوي أو دواء ملاريا تعرف كل الأسئلة . إجاباتها صحيحة على : الجرعة، كم مرة في اليوم، عدد الأيام )' },
    { key: 'knows_ors_prep', label: '2. الأم التي طفلها يعانى من الإسهال و أعطى ملح الإرواء بالفم تعرف كيف تعطى ملح الإرواء في المنزل ( كيف تحضره، الكمية التي يجب أن تعطيها )' },
    { key: 'knows_treatment_details', label: '3. الأم التي طفلها أعطى مضاد حيوي مع / أو دواء ملاريا مع / أو ملح الإرواء بالفم تعرف كيف تعطى العلاج :( الجرعة ، كم مرة في اليوم ، عدد الأيام )' },
    { key: 'knows_diarrhea_4rules', label: '4. الأم تعرف القواعد الاربعة للعلاج الاسهال بالمنزل ( السوائل ، التغذية ، الزنك ومتى تعود فوراً )' },
    { key: 'knows_return_date', label: '5. الأم تعرف متى تعود للمتابعة.' },
    { key: 'knows_home_fluids', label: '6. لأم تعرف ما هي السوائل التي تعطيها لطفلها بالمنزل' },
    { key: 'knows_ors_water_qty', label: '7. الأم تعرف ما هي كمية الماء التي تحضر بها ملح الإرواء' },
    { key: 'knows_ors_after_stool', label: '8. الأم تعرف ما هي كمية المحلول التي تعطيها بعد كل جلسة تبرز' },
];

const MOTHER_SATISFACTION_QUESTIONS = [
    { key: 'time_spent', label: '1. الزمن الذي قضاه الكادر الصحي مع الطفل' },
    { key: 'assessment_method', label: '2. الطريقة التي كشف بها الكادر الصحي على الطفل' },
    { key: 'treatment_given', label: '3. العلاج الذي أعطى' },
    { key: 'communication_style', label: '4. الطريقة التي تحدث بها الكادر الصحي مع الأم' },
    { key: 'what_learned', label: '5. ما تعلمته من الكادر الصحي' },
    { key: 'drug_availability', label: '6. توفر الدواء بالوحدة الصحية' },
];

const getInitialFormData = (defaultVisitNumber = 1) => ({
    session_date: new Date().toISOString().split('T')[0],
    visitNumber: defaultVisitNumber,
    mother_name: '',
    child_age: '',
    child_sex: '', 
    knowledge: MOTHER_KNOWLEDGE_QUESTIONS.reduce((acc, q) => ({ ...acc, [q.key]: '' }), {}),
    satisfaction: MOTHER_SATISFACTION_QUESTIONS.reduce((acc, q) => ({ ...acc, [q.key]: '' }), {}),
    notes: '',
});

const calculateScores = (formData) => {
    const scores = {};

    const scoreSection = (sectionData, questions) => {
        let currentScore = 0;
        let maxScore = 0;
        
        questions.forEach(q => {
            const value = sectionData[q.key];
            if (value === 'نعم' || value === 'لا') {
                maxScore += 1;
                if (value === 'نعم') {
                    currentScore += 1;
                }
            }
        });
        
        return { score: currentScore, maxScore: maxScore };
    };

    scores.knowledge = scoreSection(formData.knowledge, MOTHER_KNOWLEDGE_QUESTIONS);
    scores.satisfaction = scoreSection(formData.satisfaction, MOTHER_SATISFACTION_QUESTIONS); 

    const totalScore = scores.knowledge.score + scores.satisfaction.score;
    const totalMaxScore = scores.knowledge.maxScore + scores.satisfaction.maxScore;

    scores.overall = { score: totalScore, maxScore: totalMaxScore };
    
    return scores;
};

const MotherFormRow = ({ name, label, value, onChange, options = ['نعم', 'لا', 'لا ينطبق'] }) => {
    return (
        <div dir="rtl" className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border-b last:border-b-0 bg-white hover:bg-gray-50 transition-colors">
            <span className="text-sm font-medium text-gray-800 mb-2 sm:mb-0 text-right flex-grow mr-4 w-full sm:w-auto">
                {label}
            </span>
            <div className="flex gap-4 flex-shrink-0 mt-1 sm:mt-0">
                {options.map(option => (
                    <label key={option} className="flex items-center gap-1 cursor-pointer text-sm">
                        <input
                            type="radio"
                            name={name}
                            value={option}
                            checked={value === option}
                            onChange={(e) => onChange(name, e.target.value)}
                            className={`form-radio ${option === 'نعم' ? 'text-green-600' : option === 'لا' ? 'text-red-600' : 'text-gray-500'}`}
                            required
                        /> {option}
                    </label>
                ))}
            </div>
        </div>
    );
};

// --- Updated Component Signature ---
const MothersForm = ({ 
    facility, 
    onCancel, 
    setToast, 
    visitNumber = 1, 
    existingSessionData = null,
    canEditVisitNumber = false // <--- New Prop
}) => {
    // Initialize State (with Hydration logic for Edit Mode)
    const [formData, setFormData] = useState(() => {
        if (existingSessionData) {
            // Populate form with existing data
            return {
                session_date: existingSessionData.sessionDate || new Date().toISOString().split('T')[0],
                visitNumber: existingSessionData.visitNumber || visitNumber,
                mother_name: existingSessionData.motherName || '',
                child_age: existingSessionData.childAge || '',
                child_sex: existingSessionData.childSex || '',
                knowledge: existingSessionData.mothersKnowledge || getInitialFormData().knowledge,
                satisfaction: existingSessionData.mothersSatisfaction || getInitialFormData().satisfaction,
                notes: existingSessionData.notes || ''
            };
        }
        return getInitialFormData(visitNumber);
    });

    const [isSaving, setIsSaving] = useState(false);
    const auth = getAuth();
    const user = auth.currentUser;
    const formRef = useRef(null); 
    
    // Sync visitNumber prop if it changes (only in Create mode)
    useEffect(() => {
        if (!existingSessionData && visitNumber) {
            setFormData(prev => ({ ...prev, visitNumber: visitNumber }));
        }
    }, [visitNumber, existingSessionData]);
    
    const scores = useMemo(() => calculateScores(formData), [formData]);

    const handleFormChange = (section, key, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value,
            }
        }));
    };

    const handleSimpleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const allKnowledgeAnswered = MOTHER_KNOWLEDGE_QUESTIONS.every(q => formData.knowledge[q.key] !== '');
        const allSatisfactionAnswered = MOTHER_SATISFACTION_QUESTIONS.every(q => formData.satisfaction[q.key] !== '');
        
        if (!allKnowledgeAnswered || !allSatisfactionAnswered) {
             setToast({ 
                 show: true, 
                 message: 'الرجاء الإجابة على جميع أسئلة معرفة ورضا الأمهات.', 
                 type: 'error' 
             });
             return;
        }

        setIsSaving(true);
        
        try {
            const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));
            
            // Determine if updating or creating
            const sessionId = existingSessionData ? existingSessionData.id : null;

            const payload = {
                serviceType: 'IMNCI_MOTHERS', 
                state: facility['الولاية'], 
                locality: facility['المحلية'], 
                facilityId: facility.id, 
                facilityName: facility['اسم_المؤسسة'],
                facilityType: facility['نوع_المؤسسةالصحية'] || null,

                sessionDate: formData.session_date, 
                effectiveDate: effectiveDateTimestamp,
                
                visitNumber: parseInt(formData.visitNumber) || 1,
                motherName: formData.mother_name || 'غير محدد',
                childAge: formData.child_age || 'غير محدد', 
                childSex: formData.child_sex || 'غير محدد', 

                mothersKnowledge: formData.knowledge,
                mothersSatisfaction: formData.satisfaction,
                
                scores: {
                    knowledge_score: scores.knowledge.score,
                    knowledge_maxScore: scores.knowledge.maxScore,
                    satisfaction_score: scores.satisfaction.score,
                    satisfaction_maxScore: scores.satisfaction.maxScore,
                    overall_score: scores.overall.score,
                    overall_maxScore: scores.overall.maxScore,
                },

                notes: formData.notes,
                status: 'complete',
            };

            // Add Mentor Info / Edit Trail
            if (sessionId) {
                payload.mentorEmail = existingSessionData?.mentorEmail || 'unknown';
                payload.mentorName = existingSessionData?.mentorName || 'Unknown Mentor';
                payload.edited_by_email = user?.email || 'unknown';
                payload.edited_by_name = user?.displayName || 'Unknown Mentor';
                payload.edited_at = Timestamp.now();
            } else {
                payload.mentorEmail = user?.email || 'unknown';
                payload.mentorName = user?.displayName || 'Unknown Mentor';
            }

            await saveMentorshipSession(payload, sessionId);

            setToast({ show: true, message: 'تم حفظ استبيان الأم بنجاح!', type: 'success' });
            onCancel(); 
        } catch (error) {
            console.error("Error saving Mother's Form session:", error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card dir="rtl">
            <StickyOverallScore
                totalScore={scores.overall.score}
                totalMaxScore={scores.overall.maxScore}
            />
            <form ref={formRef} onSubmit={handleSubmit}>
                <div className="p-6">
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-sky-800">
                            {existingSessionData ? 'تعديل استبيان الأم (IMNCI)' : 'استبيان رضا ومعرفة الأمهات'}
                        </h2>
                        <h3 className="text-lg font-semibold text-gray-600">
                            (المنهج المتكامل لإدارة أمراض الطفولة حديثي الولادة)
                        </h3>
                    </div>

                    <div className="p-3 border rounded-lg bg-gray-50 text-right space-y-0.5 mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1" dir="rtl">
                            <div><span className="text-sm font-medium text-gray-500">الولاية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility['الولاية'] || 'غير محدد'}</span></div>
                            <div><span className="text-sm font-medium text-gray-500">المحلية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility['المحلية'] || 'غير محدد'}</span></div>
                            <div><span className="text-sm font-medium text-gray-500">المؤسسة:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility['اسم_المؤسسة'] || 'غير محدد'}</span></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 pt-3 border-t mt-3">
                             <FormGroup label="تاريخ الجلسة" className="text-right">
                                <Input type="date" name="session_date" value={formData.session_date} onChange={handleSimpleChange} required className="p-1 text-sm w-full border rounded" />
                            </FormGroup>
                            
                            {/* --- MODIFIED: Visit Number Input --- */}
                            <FormGroup label="رقم الزيارة" className="text-right">
                                <Input 
                                    type="number" 
                                    name="visitNumber" 
                                    value={formData.visitNumber} 
                                    readOnly={!canEditVisitNumber} // Toggle ReadOnly
                                    onChange={handleSimpleChange} // Allow change if editable
                                    min="1" 
                                    className={`p-1 text-sm w-full border rounded text-right font-bold ${canEditVisitNumber ? 'bg-white text-sky-700 border-sky-300' : 'bg-gray-200 cursor-not-allowed text-gray-600'}`} 
                                />
                            </FormGroup>
                            {/* ----------------------------------- */}

                            <FormGroup label="اسم الأم / مقدم الرعاية (اختياري)" className="text-right">
                                <Input type="text" name="mother_name" value={formData.mother_name} onChange={handleSimpleChange} placeholder="اسم الأم" className="p-1 text-sm w-full border rounded text-right" />
                            </FormGroup>
                             <FormGroup label="عمر الطفل (شهور) (اختياري)" className="text-right">
                                <Input type="number" name="child_age" value={formData.child_age} onChange={handleSimpleChange} placeholder="العمر" className="p-1 text-sm w-full border rounded text-right" min="0" max="59" />
                            </FormGroup>
                             <FormGroup label="جنس الطفل (اختياري)" className="text-right">
                                <Select name="child_sex" value={formData.child_sex} onChange={handleSimpleChange}>
                                    <option value="">-- اختر --</option>
                                    <option value="male">ذكر</option>
                                    <option value="female">أنثى</option>
                                    <option value="N/A">لا ينطبق</option>
                                </Select>
                            </FormGroup>
                        </div>
                    </div>

                    <div className="mb-8 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                        <h3 className="flex justify-end items-center text-xl font-bold mb-0 text-white bg-sky-900 p-3 text-right">
                            <span className="mr-2">معرفة الأمهات: هل الأم تعرف؟</span> 
                            <ScoreCircle score={scores.knowledge.score} maxScore={scores.knowledge.maxScore} />
                        </h3>
                        {MOTHER_KNOWLEDGE_QUESTIONS.map((q) => (
                            <MotherFormRow
                                key={q.key}
                                name={q.key}
                                label={q.label}
                                value={formData.knowledge[q.key]}
                                onChange={(key, value) => handleFormChange('knowledge', key, value)}
                            />
                        ))}
                    </div>

                    <div className="mb-8 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                         <h3 className="flex justify-end items-center text-xl font-bold mb-0 text-white bg-sky-900 p-3 text-right">
                            <span className="mr-2">رضاء الأمهات: هل الأم راضية عن؟</span>
                            <ScoreCircle score={scores.satisfaction.score} maxScore={scores.satisfaction.maxScore} />
                        </h3>
                        {MOTHER_SATISFACTION_QUESTIONS.map((q) => {
                            return (
                                <div key={q.key} className="space-y-2">
                                    <MotherFormRow
                                        name={q.key}
                                        label={q.label}
                                        value={formData.satisfaction[q.key]}
                                        onChange={(key, value) => handleFormChange('satisfaction', key, value)}
                                        options={['نعم', 'لا', 'لا ينطبق']}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    
                    <FormGroup label="ملاحظات عامة حول الاستبيان" className="text-right">
                        <Textarea name="notes" value={formData.notes} onChange={handleSimpleChange} rows={3} placeholder="أضف أي ملاحظات إضافية حول الاستبيان..." className="text-right placeholder:text-right"/>
                    </FormGroup>
                </div>

                 <div className="hidden sm:flex gap-2 justify-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                    <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}> إلغاء </Button>
                    <Button type="submit" disabled={isSaving}> {isSaving ? 'جاري الحفظ...' : 'حفظ وإكمال الاستبيان'} </Button>
                 </div>

                 <div className="flex sm:hidden fixed bottom-16 left-0 right-0 z-20 p-2 bg-gray-50 border-t border-gray-200 shadow-lg justify-around items-center" dir="rtl">
                    <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving} size="sm">
                        إلغاء
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={isSaving} 
                        size="sm"
                    > 
                        {isSaving ? 'جاري...' : 'حفظ وإكمال'} 
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export default MothersForm;