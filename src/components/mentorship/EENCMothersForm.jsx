// EENCMothersForm.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { saveMentorshipSession } from '../../data'; 
import { Timestamp } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
import {
    Card, Button, FormGroup, Input, Spinner
} from '../CommonComponents'; 

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

// Refactored Row Component with Required Indicator
const EENCFormRow = ({ label, value, onChange }) => {
    return (
        <div dir="rtl" className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border-b last:border-b-0 bg-white hover:bg-gray-50 transition-colors">
            <span className="text-sm font-medium text-gray-800 mb-2 sm:mb-0 text-right flex-grow mr-4 w-full sm:w-auto">
                {label} <span className="text-red-500 text-lg align-middle">*</span>
            </span>
            <div className="flex gap-4 flex-shrink-0 mt-1 sm:mt-0">
                <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                        type="radio"
                        value="yes"
                        checked={value === 'yes'}
                        onChange={onChange}
                        className="form-radio text-green-600"
                    /> نعم
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                        type="radio"
                        value="no"
                        checked={value === 'no'}
                        onChange={onChange}
                        className="form-radio text-red-600"
                    /> لا
                </label>
            </div>
        </div>
    );
};

// --- Logic to calculate scores ---
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

// List of mandatory fields for validation
const REQUIRED_CLINICAL_FIELDS = [
    'skin_to_skin_immediate', 'skin_to_skin_90min',
    'breastfed_first_hour', 'given_other_fluids', 'given_other_fluids_bottle',
    'given_vitamin_k', 'given_tetracycline', 'anything_on_cord', 'rubbed_with_oil', 'baby_bathed',
    'polio_zero_dose', 'bcg_dose',
    'baby_weighed', 'baby_temp_measured',
    'baby_registered', 'given_discharge_card'
];

// --- Updated Component Signature ---
const EENCMothersForm = ({ 
    facility, 
    onCancel, 
    setToast, 
    visitNumber = 1, 
    existingSessionData = null,
    canEditVisitNumber = false // <--- New Prop
}) => {
    // Initialize State
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

    useEffect(() => {
        if (!existingSessionData && visitNumber) {
            setFormData(prev => ({ ...prev, visitNumber: visitNumber }));
        }
    }, [visitNumber, existingSessionData]);

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSimpleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // --- VALIDATION CHECK ---
        // Ensure all clinical questions have been answered (value is not empty string)
        const missingFields = REQUIRED_CLINICAL_FIELDS.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            setToast({ 
                show: true, 
                message: 'يرجى الإجابة على جميع الأسئلة (نعم/لا) قبل الحفظ.', 
                type: 'error' 
            });
            return; // Stop execution if validation fails
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

        try {
            await saveMentorshipSession(payload, sessionId);
            setToast({ show: true, message: 'تم حفظ استبيان الأم بنجاح!', type: 'success' });
            if (onCancel) onCancel(); 
        } catch (error) {
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

                            <FormGroup label="اسم الأم (اختياري)" className="text-right">
                                <Input type="text" name="motherName" value={formData.motherName} onChange={handleSimpleChange} placeholder="اسم الأم" className="p-1 text-sm w-full border rounded text-right" />
                            </FormGroup>
                             <FormGroup label="عمر الطفل (اختياري)" className="text-right">
                                <Input type="text" name="childAge" value={formData.childAge} onChange={handleSimpleChange} placeholder="مثال: يومان" className="p-1 text-sm w-full border rounded text-right" />
                            </FormGroup>
                        </div>
                    </div>

                    {/* Section 1 */}
                    <div className="mb-8 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                        <h3 className="flex justify-end items-center text-xl font-bold mb-0 text-white bg-sky-900 p-3 text-right">
                            <span className="mr-2">1. وضع الطفل جلد بجلد</span>
                            <ScoreCircle score={scores.skin.score} maxScore={scores.skin.max} />
                        </h3>
                        <EENCFormRow 
                            label="هل تم وضع الطفل جلد بجلد مباشرة بعد الولادة؟" 
                            value={formData.skin_to_skin_immediate} 
                            onChange={(e) => handleChange('skin_to_skin_immediate', e.target.value)} 
                        />
                        <EENCFormRow 
                            label="هل الطفل الان موضوع جلد بجلد أو تم وضعه جلد بجلد بصورة غير منقطعة مدة 90 دقيقة؟" 
                            value={formData.skin_to_skin_90min} 
                            onChange={(e) => handleChange('skin_to_skin_90min', e.target.value)} 
                        />
                    </div>

                    {/* Section 2 */}
                    <div className="mb-8 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                        <h3 className="flex justify-end items-center text-xl font-bold mb-0 text-white bg-sky-900 p-3 text-right">
                            <span className="mr-2">2. بدء الرضاعة الطبيعية</span>
                            <ScoreCircle score={scores.breastfeeding.score} maxScore={scores.breastfeeding.max} />
                        </h3>
                        <EENCFormRow label="هل أكمل الطفل رضعة كاملة خلال الساعة الأولى من الولادة؟" value={formData.breastfed_first_hour} onChange={(e) => handleChange('breastfed_first_hour', e.target.value)} />
                        <EENCFormRow label="هل تم إعطاء أي سوائل اخرى غير حليب الأم؟ (الإجابة المثالية: لا)" value={formData.given_other_fluids} onChange={(e) => handleChange('given_other_fluids', e.target.value)} />
                        <EENCFormRow label="هل تم إعطاء الطفل أي سائل اخر عن طريق البزة؟ (الإجابة المثالية: لا)" value={formData.given_other_fluids_bottle} onChange={(e) => handleChange('given_other_fluids_bottle', e.target.value)} />
                    </div>

                    {/* Section 3 */}
                    <div className="mb-8 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                        <h3 className="flex justify-end items-center text-xl font-bold mb-0 text-white bg-sky-900 p-3 text-right">
                            <span className="mr-2">3. رعاية الجلد والعين والسرة</span>
                            <ScoreCircle score={scores.care.score} maxScore={scores.care.max} />
                        </h3>
                        <EENCFormRow label="هل تم إعطاء الطفل فيتامين ك ؟" value={formData.given_vitamin_k} onChange={(e) => handleChange('given_vitamin_k', e.target.value)} />
                        <EENCFormRow label="هل تم إعطاء الطفل جرعة تتراسيكلين للعين ؟" value={formData.given_tetracycline} onChange={(e) => handleChange('given_tetracycline', e.target.value)} />
                        <EENCFormRow label="هل تم وضع أي مادة على السرة ؟" value={formData.anything_on_cord} onChange={(e) => handleChange('anything_on_cord', e.target.value)} />
                        <EENCFormRow label="هل تم مسح الطفل باي نوع من الزيوت ؟" value={formData.rubbed_with_oil} onChange={(e) => handleChange('rubbed_with_oil', e.target.value)} />
                        <EENCFormRow label="هل تم استحمام الطفل ؟" value={formData.baby_bathed} onChange={(e) => handleChange('baby_bathed', e.target.value)} />
                    </div>

                    {/* Section 4 */}
                    <div className="mb-8 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                        <h3 className="flex justify-end items-center text-xl font-bold mb-0 text-white bg-sky-900 p-3 text-right">
                            <span className="mr-2">4. تطعيمات الطفل</span>
                            <ScoreCircle score={scores.vaccination.score} maxScore={scores.vaccination.max} />
                        </h3>
                        <EENCFormRow label="هل تم تطعيم الطفل الجرعة الصفرية للشلل الفموي ؟" value={formData.polio_zero_dose} onChange={(e) => handleChange('polio_zero_dose', e.target.value)} />
                        <EENCFormRow label="هل تم تطعيم الطفل جرعة الدرن ؟" value={formData.bcg_dose} onChange={(e) => handleChange('bcg_dose', e.target.value)} />
                    </div>

                    {/* Section 5 */}
                    <div className="mb-8 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                        <h3 className="flex justify-end items-center text-xl font-bold mb-0 text-white bg-sky-900 p-3 text-right">
                            <span className="mr-2">5. قياسات الطفل</span>
                            <ScoreCircle score={scores.measurements.score} maxScore={scores.measurements.max} />
                        </h3>
                        <EENCFormRow label="هل تم وزن الطفل ؟" value={formData.baby_weighed} onChange={(e) => handleChange('baby_weighed', e.target.value)} />
                        <EENCFormRow label="هل تم قياس درجة حرارة الطفل ؟" value={formData.baby_temp_measured} onChange={(e) => handleChange('baby_temp_measured', e.target.value)} />
                    </div>

                    {/* Section 6 */}
                    <div className="mb-8 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                        <h3 className="flex justify-end items-center text-xl font-bold mb-0 text-white bg-sky-900 p-3 text-right">
                            <span className="mr-2">6. تسجيلات الطفل</span>
                            <ScoreCircle score={scores.registration.score} maxScore={scores.registration.max} />
                        </h3>
                        <EENCFormRow label="هل تم تسجيل الطفل في السجل المدني؟" value={formData.baby_registered} onChange={(e) => handleChange('baby_registered', e.target.value)} />
                        <EENCFormRow label="هل تم إعطاء الطفل كرت الخروج؟" value={formData.given_discharge_card} onChange={(e) => handleChange('given_discharge_card', e.target.value)} />
                    </div>
                </div>

                {/* Desktop Buttons */}
                <div className="hidden sm:flex gap-2 justify-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                    <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
                        إلغاء
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Spinner size="sm" /> : 'حفظ الاستبيان'}
                    </Button>
                </div>

                {/* Mobile Buttons - MODIFIED: bottom-0 -> bottom-16 to avoid overlap */}
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