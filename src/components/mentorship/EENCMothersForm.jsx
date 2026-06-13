// EENCMothersForm.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { saveMentorshipSession } from '../../data'; 
import { Timestamp } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
import {
    Card, Button, FormGroup, Input, Spinner
} from '../CommonComponents'; 
import { handleAutoScroll, ActionToggle } from './IMNCSkillsAssessmentForm';

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

// --- Accordion Wrapper for EENC Mothers Form Sections ---
const MothersSectionAccordion = ({ title, scoreData, children, isCompleted = false }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        if (isCompleted) {
            const timer = setTimeout(() => setIsExpanded(false), 800);
            return () => clearTimeout(timer);
        } else {
            setIsExpanded(true);
        }
    }, [isCompleted]);

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200 mb-6" dir="rtl">
            <button 
                type="button"
                onClick={() => setIsExpanded(!isExpanded)} 
                className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
            >
                <div className="flex items-center text-right text-base font-bold text-slate-800">
                    {scoreData && <ScoreCircle score={scoreData.score} maxScore={scoreData.max} />}
                    <span className="mr-2">{title}</span>
                    {isCompleted && !isExpanded && <span className="mr-3 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">مكتمل</span>}
                </div>
                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isExpanded && (
                <div className="divide-y divide-slate-100 bg-white">
                    {children}
                </div>
            )}
        </div>
    );
};

const EENCFormRow = ({ label, value, onChange }) => {
    const isAnswered = value !== '';
    const containerClasses = `flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 sm:px-5 hover:bg-sky-50 transition-colors ${isAnswered ? 'row-answered' : 'row-unanswered'}`;

    const handleToggleClick = (name, val) => {
        const wasAnswered = value !== '';
        onChange(val);
        if (!wasAnswered) {
            handleAutoScroll();
        }
    };

    return (
        <div dir="rtl" className={containerClasses}>
            <span className="text-sm font-medium text-gray-800 mb-2 sm:mb-0 text-right flex-grow mr-4 w-full sm:w-auto">
                {label} <span className="text-red-500 text-lg align-middle">*</span>
            </span>
            <div className="flex gap-4 flex-shrink-0 mt-1 sm:mt-0">
                <ActionToggle
                    options={[
                        ['نعم', 'yes', 'bg-green-600 border-green-600'],
                        ['لا', 'no', 'bg-red-600 border-red-600']
                    ]}
                    currentValue={value}
                    onClick={handleToggleClick}
                />
            </div>
        </div>
    );
};

const calculateScores = (data) => {
    const calcSection = (keys, targetIsNo = []) => {
        let score = 0;
        let max = 0;
        keys.forEach(key => {
            const val = data[key];
            if (val === 'yes' || val === 'no') {
                max += 1;
                const target = targetIsNo.includes(key) ? 'no' : 'yes';
                if (val === target) score += 1;
            }
        });
        return { score, max };
    };

    const sections = {
        skin: calcSection(['skin_to_skin_immediate', 'skin_to_skin_90min']),
        breastfeeding: calcSection(
            ['breastfed_first_hour', 'given_other_fluids', 'given_other_fluids_bottle'], 
            ['given_other_fluids', 'given_other_fluids_bottle'] 
        ),
        care: calcSection(['given_vitamin_k', 'given_tetracycline', 'anything_on_cord', 'rubbed_with_oil', 'baby_bathed']),
        vaccination: calcSection(['polio_zero_dose', 'bcg_dose']),
        measurements: calcSection(['baby_weighed', 'baby_temp_measured']),
        registration: calcSection(['baby_registered', 'given_discharge_card']),
    };

    let totalScore = 0;
    let totalMax = 0;

    Object.values(sections).forEach(sec => {
        totalScore += sec.score;
        totalMax += sec.max;
    });

    return { ...sections, overall: { score: totalScore, maxScore: totalMax } };
};

const REQUIRED_CLINICAL_FIELDS = [
    'skin_to_skin_immediate', 'skin_to_skin_90min',
    'breastfed_first_hour', 'given_other_fluids', 'given_other_fluids_bottle',
    'given_vitamin_k', 'given_tetracycline', 'anything_on_cord', 'rubbed_with_oil', 'baby_bathed',
    'polio_zero_dose', 'bcg_dose',
    'baby_weighed', 'baby_temp_measured',
    'baby_registered', 'given_discharge_card'
];

const EENCMothersForm = ({ 
    facility, 
    onCancel,
    onSaveComplete,
    setToast, 
    visitNumber = 1, 
    existingSessionData = null,
    canEditVisitNumber = false,
    allSubmissions = [] 
}) => {
    const [formData, setFormData] = useState(() => {
        if (existingSessionData) {
            const mothersData = existingSessionData.eencMothersData || {};
            return {
                ...mothersData, 
                session_date: existingSessionData.sessionDate || new Date().toISOString().split('T')[0],
                visitNumber: existingSessionData.visitNumber || visitNumber,
                motherName: existingSessionData.motherName || '',
                childAge: existingSessionData.childAge || '',
            };
        }
        return {
            session_date: new Date().toISOString().split('T')[0],
            visitNumber: visitNumber, 
            motherName: '', 
            childAge: '', 
            
            skin_to_skin_immediate: '', 
            skin_to_skin_90min: '', 
            breastfed_first_hour: '', 
            given_other_fluids: '', 
            given_other_fluids_bottle: '', 
            given_vitamin_k: '', 
            given_tetracycline: '', 
            anything_on_cord: '', 
            rubbed_with_oil: '', 
            baby_bathed: '', 
            polio_zero_dose: '', 
            bcg_dose: '', 
            baby_weighed: '', 
            baby_temp_measured: '', 
            baby_registered: '', 
            given_discharge_card: '', 
        };
    });

    const [isSaving, setIsSaving] = useState(false);
    const auth = getAuth();
    const user = auth.currentUser;

    const scores = useMemo(() => calculateScores(formData), [formData]);

    const eencMothersHistoryStats = useMemo(() => {
        if (existingSessionData || !facility?.id) return { maxVisitNum: 0, dateMap: {} };

        let maxVisitNum = 0;
        const dateMap = {};

        const facilityMotherSessions = allSubmissions.filter(sub => 
            sub.facilityId === facility.id && 
            sub.service === 'EENC_MOTHERS'
        );

        facilityMotherSessions.forEach(session => {
            const vNum = parseInt(session.visitNumber, 10) || parseInt(session.fullData?.visitNumber, 10) || 0;
            if (vNum > maxVisitNum) maxVisitNum = vNum;

            const sDate = session.sessionDate || (session.effectiveDate && session.effectiveDate.seconds ? new Date(session.effectiveDate.seconds * 1000).toISOString().split('T')[0] : null);
            if (sDate && vNum > 0) dateMap[sDate] = vNum;
        });

        return { maxVisitNum, dateMap };
    }, [allSubmissions, facility?.id, existingSessionData]);

    useEffect(() => {
        if (existingSessionData || !facility?.id) return;
        const currentSessionDate = formData.session_date;
        if (!currentSessionDate) return;

        try {
            const { maxVisitNum, dateMap } = eencMothersHistoryStats;
            const matchingDateVisitNum = dateMap[currentSessionDate] || null;

            let newVisitNumber = 1;
            const offlineKey = `offline_visit_max_${facility.id}_EENC_MOTHERS`;
            const localMaxVisitNum = parseInt(localStorage.getItem(offlineKey), 10) || 0;

            if (matchingDateVisitNum !== null) {
                newVisitNumber = matchingDateVisitNum;
            } else {
                const absoluteMax = Math.max(maxVisitNum, localMaxVisitNum);
                newVisitNumber = absoluteMax + 1;
            }

            if (formData.visitNumber !== newVisitNumber) {
                setFormData(prev => ({ ...prev, visitNumber: newVisitNumber }));
            }

            if (maxVisitNum > localMaxVisitNum) {
                localStorage.setItem(offlineKey, maxVisitNum.toString());
            }
        } catch (error) {
            console.error("Error managing visit number assignment:", error);
        }
    }, [formData.session_date, eencMothersHistoryStats, facility?.id, existingSessionData, formData.visitNumber]);

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSimpleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const missingFields = REQUIRED_CLINICAL_FIELDS.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            setToast({ 
                show: true, 
                message: 'يرجى الإجابة على جميع الأسئلة (نعم/لا) قبل الحفظ.', 
                type: 'error' 
            });
            return;
        }

        setIsSaving(true);

        const sessionId = existingSessionData ? existingSessionData.id : null;

        const payload = {
            serviceType: 'EENC_MOTHERS', 
            state: facility?.['الولاية'] || null,
            locality: facility?.['المحلية'] || null,
            facilityId: facility?.id || null,
            facilityName: facility?.['اسم_المؤسسة'] || null,
            sessionDate: formData.session_date,
            effectiveDate: Timestamp.fromDate(new Date(formData.session_date)),
            status: 'complete',
            
            visitNumber: parseInt(formData.visitNumber) || 1, 
            motherName: formData.motherName,
            childAge: formData.childAge,
            eencMothersData: { 
                skin_to_skin_immediate: formData.skin_to_skin_immediate,
                skin_to_skin_90min: formData.skin_to_skin_90min,
                breastfed_first_hour: formData.breastfed_first_hour,
                given_other_fluids: formData.given_other_fluids,
                given_other_fluids_bottle: formData.given_other_fluids_bottle,
                given_vitamin_k: formData.given_vitamin_k,
                given_tetracycline: formData.given_tetracycline,
                anything_on_cord: formData.anything_on_cord,
                rubbed_with_oil: formData.rubbed_with_oil,
                baby_bathed: formData.baby_bathed,
                polio_zero_dose: formData.polio_zero_dose,
                bcg_dose: formData.bcg_dose,
                baby_weighed: formData.baby_weighed,
                baby_temp_measured: formData.baby_temp_measured,
                baby_registered: formData.baby_registered,
                given_discharge_card: formData.given_discharge_card
            },
            
            scores: {
                overall_score: scores.overall.score,
                overall_maxScore: scores.overall.maxScore,
                skin_score: scores.skin.score,
                breastfeeding_score: scores.breastfeeding.score,
                care_score: scores.care.score,
                vaccination_score: scores.vaccination.score,
                measurements_score: scores.measurements.score,
                registration_score: scores.registration.score
            }
        };

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

        const offlineKey = `offline_visit_max_${facility.id}_EENC_MOTHERS`;
        const currentStoredMax = parseInt(localStorage.getItem(offlineKey), 10) || 0;
        if (payload.visitNumber > currentStoredMax) {
            localStorage.setItem(offlineKey, payload.visitNumber.toString());
        }

        try {
            await saveMentorshipSession(payload, sessionId);
            setToast({ show: true, message: 'تم حفظ استبيان الأم بنجاح!', type: 'success' });
            
            if (onSaveComplete) {
                onSaveComplete('complete', payload);
            } else if (onCancel) {
                onCancel(); 
            }
        } catch (error) {
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };
    
    // Check completion state for each section to feed auto-collapse
    const isSkinComplete = formData.skin_to_skin_immediate !== '' && formData.skin_to_skin_90min !== '';
    const isBreastfeedingComplete = formData.breastfed_first_hour !== '' && formData.given_other_fluids !== '' && formData.given_other_fluids_bottle !== '';
    const isCareComplete = formData.given_vitamin_k !== '' && formData.given_tetracycline !== '' && formData.anything_on_cord !== '' && formData.rubbed_with_oil !== '' && formData.baby_bathed !== '';
    const isVaccinationComplete = formData.polio_zero_dose !== '' && formData.bcg_dose !== '';
    const isMeasurementsComplete = formData.baby_weighed !== '' && formData.baby_temp_measured !== '';
    const isRegistrationComplete = formData.baby_registered !== '' && formData.given_discharge_card !== '';

    return (
        <Card dir="rtl">
            <StickyOverallScore
                totalScore={scores.overall.score}
                totalMaxScore={scores.overall.maxScore}
            />

            <form onSubmit={handleSubmit}>
                <div className="p-6">
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-sky-800">
                            {existingSessionData ? 'تعديل استبيان الأمهات (EENC)' : 'استبيان الأمهات (الرعاية الضرورية EENC)'}
                        </h2>
                        <h3 className="text-lg font-semibold text-gray-600">
                            (مقابلة مع الأم)
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

                            <FormGroup label="رقم الزيارة" className="text-right">
                                <Input 
                                    type="number" 
                                    name="visitNumber" 
                                    value={formData.visitNumber} 
                                    readOnly={!canEditVisitNumber} 
                                    onChange={handleSimpleChange} 
                                    min="1" 
                                    className={`p-1 text-sm w-full border rounded text-right font-bold ${canEditVisitNumber ? 'bg-white text-sky-700 border-sky-300' : 'bg-gray-200 cursor-not-allowed text-gray-600'}`} 
                                />
                            </FormGroup>

                            <FormGroup label="اسم الأم (اختياري)" className="text-right">
                                <Input type="text" name="motherName" value={formData.motherName} onChange={handleSimpleChange} placeholder="اسم الأم" className="p-1 text-sm w-full border rounded text-right" />
                            </FormGroup>
                             <FormGroup label="عمر الطفل (اختياري)" className="text-right">
                                <Input type="text" name="childAge" value={formData.childAge} onChange={handleSimpleChange} placeholder="مثال: يومان" className="p-1 text-sm w-full border rounded text-right" />
                            </FormGroup>
                        </div>
                    </div>

                    <MothersSectionAccordion title="1. وضع الطفل جلد بجلد" scoreData={scores.skin} isCompleted={isSkinComplete}>
                        <EENCFormRow 
                            label="هل تم وضع الطفل جلد بجلد مباشرة بعد الولادة؟" 
                            value={formData.skin_to_skin_immediate} 
                            onChange={(val) => handleChange('skin_to_skin_immediate', val)} 
                        />
                        <EENCFormRow 
                            label="هل الطفل الان موضوع جلد بجلد أو تم وضعه جلد بجلد بصورة غير منقطعة مدة 90 دقيقة؟" 
                            value={formData.skin_to_skin_90min} 
                            onChange={(val) => handleChange('skin_to_skin_90min', val)} 
                        />
                    </MothersSectionAccordion>

                    <MothersSectionAccordion title="2. بدء الرضاعة الطبيعية" scoreData={scores.breastfeeding} isCompleted={isBreastfeedingComplete}>
                        <EENCFormRow label="هل أكمل الطفل رضعة كاملة خلال الساعة الأولى من الولادة؟" value={formData.breastfed_first_hour} onChange={(val) => handleChange('breastfed_first_hour', val)} />
                        <EENCFormRow label="هل تم إعطاء أي سوائل اخرى غير حليب الأم؟ (الإجابة المثالية: لا)" value={formData.given_other_fluids} onChange={(val) => handleChange('given_other_fluids', val)} />
                        <EENCFormRow label="هل تم إعطاء الطفل أي سائل اخر عن طريق البزة؟ (الإجابة المثالية: لا)" value={formData.given_other_fluids_bottle} onChange={(val) => handleChange('given_other_fluids_bottle', val)} />
                    </MothersSectionAccordion>

                    <MothersSectionAccordion title="3. رعاية الجلد والعين والسرة" scoreData={scores.care} isCompleted={isCareComplete}>
                        <EENCFormRow label="هل تم إعطاء الطفل فيتامين ك ؟" value={formData.given_vitamin_k} onChange={(val) => handleChange('given_vitamin_k', val)} />
                        <EENCFormRow label="هل تم إعطاء الطفل جرعة تتراسيكلين للعين ؟" value={formData.given_tetracycline} onChange={(val) => handleChange('given_tetracycline', val)} />
                        <EENCFormRow label="هل تم وضع أي مادة على السرة ؟" value={formData.anything_on_cord} onChange={(val) => handleChange('anything_on_cord', val)} />
                        <EENCFormRow label="هل تم مسح الطفل باي نوع من الزيوت ؟" value={formData.rubbed_with_oil} onChange={(val) => handleChange('rubbed_with_oil', val)} />
                        <EENCFormRow label="هل تم استحمام الطفل ؟" value={formData.baby_bathed} onChange={(val) => handleChange('baby_bathed', val)} />
                    </MothersSectionAccordion>

                    <MothersSectionAccordion title="4. تطعيمات الطفل" scoreData={scores.vaccination} isCompleted={isVaccinationComplete}>
                        <EENCFormRow label="هل تم تطعيم الطفل الجرعة الصفرية للشلل الفموي ؟" value={formData.polio_zero_dose} onChange={(val) => handleChange('polio_zero_dose', val)} />
                        <EENCFormRow label="هل تم تطعيم الطفل جرعة الدرن ؟" value={formData.bcg_dose} onChange={(val) => handleChange('bcg_dose', val)} />
                    </MothersSectionAccordion>

                    <MothersSectionAccordion title="5. قياسات الطفل" scoreData={scores.measurements} isCompleted={isMeasurementsComplete}>
                        <EENCFormRow label="هل تم وزن الطفل ؟" value={formData.baby_weighed} onChange={(val) => handleChange('baby_weighed', val)} />
                        <EENCFormRow label="هل تم قياس درجة حرارة الطفل ؟" value={formData.baby_temp_measured} onChange={(val) => handleChange('baby_temp_measured', val)} />
                    </MothersSectionAccordion>

                    <MothersSectionAccordion title="6. تسجيلات الطفل" scoreData={scores.registration} isCompleted={isRegistrationComplete}>
                        <EENCFormRow label="هل تم تسجيل الطفل في السجل المدني؟" value={formData.baby_registered} onChange={(val) => handleChange('baby_registered', val)} />
                        <EENCFormRow label="هل تم إعطاء الطفل كرت الخروج؟" value={formData.given_discharge_card} onChange={(val) => handleChange('given_discharge_card', val)} />
                    </MothersSectionAccordion>
                </div>

                <div className="hidden sm:flex gap-2 justify-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                    <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
                        إلغاء
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Spinner size="sm" /> : 'حفظ الاستبيان'}
                    </Button>
                </div>

                <div className="flex sm:hidden fixed bottom-16 left-0 right-0 z-20 p-2 bg-gray-50 border-t border-gray-200 shadow-lg justify-around items-center" dir="rtl">
                    <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving} size="sm">
                        إلغاء
                    </Button>
                    <Button type="submit" disabled={isSaving} size="sm"> 
                        {isSaving ? 'جاري...' : 'حفظ وإكمال'} 
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export default EENCMothersForm;