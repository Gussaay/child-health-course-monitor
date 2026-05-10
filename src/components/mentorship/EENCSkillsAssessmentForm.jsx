// EENCSkillsAssessmentForm.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { saveMentorshipSession } from '../../data';
import { Timestamp } from 'firebase/firestore';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    Input, Textarea, Checkbox, Modal
} from '../CommonComponents';
import { getAuth } from "firebase/auth";
import { GenericFacilityForm, EENCFormFields } from '../FacilityForms.jsx'; 
import { submitFacilityDataForApproval } from '../../data';

// --- مكونات خاصة بهذا النموذج --- 

export const PREPARATION_ITEMS = [
    { key: 'prep_temp', label: 'التأكد من درجة حرارة الغرفة مناسبة، اغلق تيارات الهواء' }, 
    { key: 'prep_notify_mother', label: 'إخبار الام (أوالشخص الداعم لها) عن مجريات سير الولادة وابدى تعاطفا معها وطمئنها' }, 
    { key: 'prep_wash_1', label: 'غسل الأيدي جيدا بالماء والصابون (المرة الأولى)' }, 
    { key: 'prep_cloths', label: 'تجهيز (2) قطعة قماش جافة ونظيفة، ووضع قطعة قماش جافة فوق بطن الأم لتجفيف الطفل مباشرة بعد الولادة، وضع القطعة الثانية جانبا لاستخدامها لتغطية الطفل بعد تجفيفه.' }, 
    { key: 'prep_resuscitation_area', label: 'تجهيز منطقة إنعاش الوليد (قناع + كيس + عصفورة شفط + فوطة)' }, 
    { key: 'prep_ambu_check', label: 'التأكد من فعالية القناع والكيس (امبوباق) لإنعاش الوليد' }, 
    { key: 'prep_wash_2', label: 'غسل الأيدي جيدا بالماء والصابون (المرة الثانية)' }, 
    { key: 'prep_gloves', label: 'لبس قفازات معقمة (2 قفاز)' }, 
    { key: 'prep_tools', label: 'وضع المشابك والملقط وكل ادوات الولادة معقمة في منطقة يسهل استخدامها بعد الولادة' }, 
];

export const DRYING_STIMULATION_ITEMS = [
    { key: 'dry_time_record', label: 'تسجيل زمن الولادة (الساعة ___ دقائق ____ ثواني___)' }, 
    { key: 'dry_start_5sec', label: 'بداية التجفيف خلال 5 ثواني من الولادة' }, 
    { key: 'dry_procedure', label: 'التجفيف جيدا بداية من العينين، الوجه، الراس، الصدر، البطن، الظهر وأخيراً اليدين والقدمين' }, 
    { key: 'dry_stimulation', label: 'التحفيز بواسطة المسح برفق على الراس والجسم والاطراف (عدم الضرب على الظهر)' }, 
    { key: 'dry_suction', label: 'شفط مجرى التنفس فقط في حالة قفل مجرى الهواء والطفل لا يتنفس تماما' }, 
    { key: 'dry_remove_wet_cloth', label: 'ازالة القطعة المبللة بالسوائل' }, 
    { key: 'dry_skin_to_skin', label: 'وضع الطفل ملتصقا جلدا بجلد امه' }, 
    { key: 'dry_cover_baby', label: 'تغطية الطفل بقطعة جافة وتغطية الراس بطاقية' }, 
];

export const NORMAL_BREATHING_ITEMS = [
    { key: 'normal_check_second_baby', label: 'التأكد من عدم وجود طفل اخر' }, 
    { key: 'normal_oxytocin', label: 'اعطاء حقنة الطلق (اوكسيتوسين) خلال واحد دقيقة بعد الولادة' }, 
    { key: 'normal_remove_outer_glove', label: 'نزع القفاز الخارجي والابقاء علي الداخلي قبل لمس الحبل السري' }, 
    { key: 'normal_cord_pulse_check', label: 'التاكد من نبض الحبل السري قبل الشبك , وشبك الحبل السري بعد توقف النبض (عادة 1- 3 دقيقة)' }, 
    { key: 'normal_cord_clamping', label: 'وضع المشبك الاول علي بعد 2سم من قاعدة السرة ووضع الملقط علي بعد 5 سم من قاعدة السرة ثم قطع الحبل السري' }, 
    { key: 'normal_placenta', label: 'ازالة المشيمة' }, 
    { key: 'normal_breastfeeding_guidance', label: 'ارشد الام علي علامات استعداد الوليد للرضاعة الطبيعية' }, 
];

export const RESUSCITATION_ITEMS = [
    { key: 'resus_ask_help', label: 'طلب المساعدة' }, 
    { key: 'resus_remove_outer_glove', label: 'نزع القفاز الخارجي والابقاء على الداخلي' }, 
    { key: 'resus_clamp_cord', label: 'وضع المشبك سريعا على الحبل السري وقطع الحبل السري' }, 
    { key: 'resus_move_to_area', label: 'نقل الوليد سريعا الي منطقة الانعاش المجهزة' }, 
    { key: 'resus_cover_while_moving', label: 'تغطية الوليد اثناء نقله الي منطقة الإنعاش' }, 
    { key: 'resus_position_head', label: 'استعدال الراس لفتح مجري الهواء' }, 
    { key: 'resus_mask_position', label: 'تغطية الكيس والقناع (الأمبوباق) للفم والانف والحنك' }, 
    { key: 'resus_check_chest_rise', label: 'التأكد من ارتفاع الصدر في اقل من 1 دقيقة من الولادة' }, 
    { key: 'resus_ventilation_rate', label: 'الضغط على الكيس (امبوباق) لإعطاء 30 – 50 نفس في الدقيقة والحفاظ علي ارتفاع الصدر (التهوية)' }, 
    { key: 'resus_no_chest_rise_steps', label: 'فى حالة عدم ارتفاع الصدر بعد استخدام (امبوباق) اتبع الخطوات التالية: استعدال وضعية الراس، استعدال وضعية القناع لتعطى تغطية أفضل، التأكد من فتح مجرى الهواء' }, 
    { key: 'resus_followup_if_breathing', label: 'إذا تنفس الطفل طبيعيا بعد الامبوباق (ايقاف عملية الانعاش والمراقبه كل 15 دقيقة, ارجاع الطفل الي بطن امه ملتصقا جلد بجلد, ارشاد الام ان طفلها سليم...)' }, 
    { key: 'resus_followup_no_breathing_10min_pulse', label: 'فى حالة لم يتنفس الطفل طبيعيا بعد 10 دقائق من التنفس الفعال + وجود نبضات قلب (مواصلة عملية التنفس ,وتحويل الطفل والتأكد من المحافظة عليه دافئا أثناء التحويل)' }, 
    { key: 'resus_followup_no_breathing_10min_no_pulse', label: 'فى حالة لم يتنفس الطفل طبيعيا بعد 10 دقائق من التنفس الفعال + عدم وجود نبضات قلب (هل تم التأكد من وفاة الطفل ,وايقاف عملية التنفس ,وتقديم الدعم العاطفي للام)' }, 
];

const allItems = [
    ...PREPARATION_ITEMS,
    ...DRYING_STIMULATION_ITEMS,
    ...NORMAL_BREATHING_ITEMS,
    ...RESUSCITATION_ITEMS
];

const getInitialFormData = () => {
    const skills = {};
    allItems.forEach(item => {
        skills[item.key] = 'na'; 
    });

    return {
        session_date: new Date().toISOString().split('T')[0],
        eenc_breathing_status: 'na', 
        eenc_resus_breathed_normally: 'na',
        eenc_resus_has_pulse: 'na',
        skills: skills,
        notes: '',
    };
};

const rehydrateDraftData = (draftData) => {
    const initial = getInitialFormData();
    if (!draftData) return initial;

    const dataToLoad = draftData.formData ? draftData.formData : draftData;
    const skills = { ...initial.skills, ...dataToLoad.skills };
    
    return {
        session_date: dataToLoad.session_date || initial.session_date,
        eenc_breathing_status: dataToLoad.eenc_breathing_status || (dataToLoad.formType === 'breathing' ? 'yes' : (dataToLoad.formType === 'not_breathing' ? 'no' : 'na')),
        eenc_resus_breathed_normally: dataToLoad.eenc_resus_breathed_normally || 'na',
        eenc_resus_has_pulse: dataToLoad.eenc_resus_has_pulse || 'na',
        skills: skills,
        notes: dataToLoad.notes || '',
    };
};

const calculateScores = (formData) => {
    const { eenc_breathing_status, skills } = formData;
    let overallScore = 0;
    let overallMax = 0;
    
    const sectionScores = {
        preparation: { score: 0, maxScore: 0 },
        drying: { score: 0, maxScore: 0 },
        normal_breathing: { score: 0, maxScore: 0 },
        resuscitation: { score: 0, maxScore: 0 }
    };

    const calculateSection = (items, sectionKey) => {
        items.forEach(item => {
            const value = skills[item.key];
            if (value && value !== 'na') {
                sectionScores[sectionKey].maxScore += 2;
                overallMax += 2;
                
                if (value === 'yes') {
                    sectionScores[sectionKey].score += 2;
                    overallScore += 2;
                } else if (value === 'partial') {
                    sectionScores[sectionKey].score += 1;
                    overallScore += 1;
                }
            }
        });
    };

    calculateSection(PREPARATION_ITEMS, 'preparation');
    calculateSection(DRYING_STIMULATION_ITEMS, 'drying');

    if (eenc_breathing_status === 'yes') {
        calculateSection(NORMAL_BREATHING_ITEMS, 'normal_breathing');
    } else if (eenc_breathing_status === 'no') {
        calculateSection(RESUSCITATION_ITEMS, 'resuscitation');
    }

    return {
        overallScore: { score: overallScore, maxScore: overallMax },
        ...sectionScores
    };
};

const checkFormCompletion = (formData) => {
    const { eenc_breathing_status, eenc_resus_breathed_normally, eenc_resus_has_pulse, skills } = formData;
    
    // First check Prep & Drying
    const initialItemsToCheck = [...PREPARATION_ITEMS, ...DRYING_STIMULATION_ITEMS];
    for (const item of initialItemsToCheck) {
        if (skills[item.key] === 'na' || skills[item.key] === '') {
            return false;
        }
    }

    // Then check breathing status
    if (eenc_breathing_status === 'na') return false; 
    
    // Then check respective branch
    if (eenc_breathing_status === 'yes') {
        for (const item of NORMAL_BREATHING_ITEMS) {
            if (skills[item.key] === 'na' || skills[item.key] === '') return false;
        }
    } else if (eenc_breathing_status === 'no') {
        // Check base resuscitation items (up to resus_no_chest_rise_steps)
        for (let i = 0; i < 10; i++) {
            if (skills[RESUSCITATION_ITEMS[i].key] === 'na' || skills[RESUSCITATION_ITEMS[i].key] === '') return false;
        }
        
        // Check branching logic completion
        if (eenc_resus_breathed_normally === 'na') return false;
        
        if (eenc_resus_breathed_normally === 'yes') {
            if (skills[RESUSCITATION_ITEMS[10].key] === 'na' || skills[RESUSCITATION_ITEMS[10].key] === '') return false;
        } else if (eenc_resus_breathed_normally === 'no') {
            if (eenc_resus_has_pulse === 'na') return false;
            
            if (eenc_resus_has_pulse === 'yes') {
                if (skills[RESUSCITATION_ITEMS[11].key] === 'na' || skills[RESUSCITATION_ITEMS[11].key] === '') return false;
            } else if (eenc_resus_has_pulse === 'no') {
                if (skills[RESUSCITATION_ITEMS[12].key] === 'na' || skills[RESUSCITATION_ITEMS[12].key] === '') return false;
            }
        }
    }
    
    return true;
};

const ScoreCircle = ({ score, maxScore }) => {
    if (score === undefined || maxScore === undefined || maxScore === 0) return null;
    const percentage = Math.round((score / maxScore) * 100);
    
    let colorClasses = 'bg-red-100 text-red-700 border-red-200';
    if (percentage >= 80) {
        colorClasses = 'bg-green-100 text-green-700 border-green-200';
    } else if (percentage >= 50) {
        colorClasses = 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }

    return (
        <div 
            className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full border-2 text-xs font-bold ml-3 shadow-sm ${colorClasses}`}
            title={`${score}/${maxScore}`}
        >
            {percentage}%
        </div>
    );
};

const StickyOverallScore = ({ score, maxScore }) => {
    if (score === null || maxScore === null || maxScore === 0 || score === undefined || maxScore === undefined) return null;
    let percentage = Math.round((score / maxScore) * 100);
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
            className={`fixed top-4 left-4 z-50 flex flex-col items-center justify-center p-3 w-20 h-20 rounded-lg ${bgColor} text-white shadow-2xl transition-all duration-300 transform hover:scale-105`}
            dir="rtl"
        >
            <div className="font-bold text-lg leading-none">{percentage}%</div>
            <div className="text-xs mt-1 text-center leading-tight">الدرجة الكلية</div>
            <div className="text-xs mt-0 leading-tight">({score}/{maxScore})</div>
        </div>
    );
};

const SkillChecklistItem = ({ label, itemKey, value, onChange }) => {
    const handleChange = (e) => {
        onChange('skills', itemKey, e.target.value);
    };

    // Specific keys that are allowed to have the "partial" option
    const allowPartialKeys = ['dry_start_5sec', 'resus_check_chest_rise', 'normal_breastfeeding_guidance'];
    const showPartial = allowPartialKeys.includes(itemKey);

    return (
        <div 
            className="p-3 border rounded-lg bg-white flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in transition-all duration-300"
            dir="rtl" 
        >
            <span className="font-medium text-gray-700 text-right w-full md:flex-1">
                {label}
            </span>
            <div className="flex gap-4 flex-shrink-0" dir="ltr">
                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="radio"
                        name={itemKey}
                        value="no"
                        checked={value === 'no'}
                        onChange={handleChange}
                        className="form-radio text-red-600"
                    />
                    <span className="text-sm">لا</span>
                </label>
                
                {showPartial && (
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input
                            type="radio"
                            name={itemKey}
                            value="partial"
                            checked={value === 'partial'}
                            onChange={handleChange}
                            className="form-radio text-yellow-500"
                        />
                        <span className="text-sm">جزئياً</span>
                    </label>
                )}

                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="radio"
                        name={itemKey}
                        value="yes"
                        checked={value === 'yes'}
                        onChange={handleChange}
                        className="form-radio text-green-600"
                    />
                    <span className="text-sm">نعم</span>
                </label>
            </div>
        </div>
    );
};

const SectionRenderer = ({ title, items, formData, handleSkillChange, score, maxScore, visibleItemIndex }) => {
    if (visibleItemIndex === -2) return null; // Entirely hidden section

    return (
        <div className="mt-6 animate-fade-in transition-all duration-500">
            <h3 className="text-xl font-semibold mb-4 p-3 bg-sky-100 text-sky-800 rounded-md sticky top-0 z-10 text-right flex items-center shadow-sm" dir="rtl">
                <ScoreCircle score={score} maxScore={maxScore} />
                <span>{title}</span>
            </h3>
            <div className="space-y-3">
                {items.map((item, idx) => {
                    const isVisible = visibleItemIndex === -1 || idx <= visibleItemIndex;
                    if (!isVisible) return null;
                    
                    return (
                        <SkillChecklistItem
                            key={item.key}
                            label={item.label}
                            itemKey={item.key}
                            value={formData.skills[item.key]}
                            onChange={handleSkillChange}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// Specialized Renderer for Resuscitation Section to handle branch questions elegantly
const ResuscitationSectionRenderer = ({ formData, handleFormChange, handleSkillChange, score, maxScore }) => {
    const baseItems = RESUSCITATION_ITEMS.slice(0, 10);
    const firstUnanswered = baseItems.findIndex(item => formData.skills[item.key] === 'na' || formData.skills[item.key] === '');
    const visibleBaseCount = firstUnanswered === -1 ? baseItems.length : firstUnanswered + 1;
    const visibleBaseItems = baseItems.slice(0, visibleBaseCount);

    const isBaseComplete = firstUnanswered === -1;
    const showBreathedNormally = isBaseComplete;
    const showHasPulse = isBaseComplete && formData.eenc_resus_breathed_normally === 'no';

    return (
        <div className="mt-6 animate-fade-in transition-all duration-500">
            <h3 className="text-xl font-semibold mb-4 p-3 bg-sky-100 text-sky-800 rounded-md sticky top-0 z-10 text-right flex items-center shadow-sm" dir="rtl">
                <ScoreCircle score={score} maxScore={maxScore} />
                <span>4. إنعاش الوليد (الدقيقة الذهبية)</span>
            </h3>
            <div className="space-y-3">
                {visibleBaseItems.map((item) => (
                    <SkillChecklistItem
                        key={item.key}
                        label={item.label}
                        itemKey={item.key}
                        value={formData.skills[item.key]}
                        onChange={handleSkillChange}
                    />
                ))}

                {/* Branching Question 1 - Right-to-Left Inline Layout */}
                {showBreathedNormally && (
                    <div className="p-4 border rounded-lg bg-sky-50 border-sky-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in transition-all duration-300 mt-4" dir="rtl">
                        <span className="font-bold text-sky-900 text-right w-full md:flex-1">
                            هل تنفس الطفل طبيعيا؟
                        </span>
                        <div className="flex gap-4 flex-shrink-0" dir="ltr">
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-md border hover:border-red-300 transition-colors">
                                <input type="radio" name="eenc_resus_breathed_normally" value="no" checked={formData.eenc_resus_breathed_normally === 'no'} onChange={handleFormChange} className="form-radio text-red-600 h-4 w-4"/>
                                <span className="font-bold text-gray-800">لا</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-md border hover:border-green-300 transition-colors">
                                <input type="radio" name="eenc_resus_breathed_normally" value="yes" checked={formData.eenc_resus_breathed_normally === 'yes'} onChange={handleFormChange} className="form-radio text-green-600 h-4 w-4"/>
                                <span className="font-bold text-gray-800">نعم</span>
                            </label>
                        </div>
                    </div>
                )}

                {/* Branch 1 Outcome */}
                {showBreathedNormally && formData.eenc_resus_breathed_normally === 'yes' && (
                    <SkillChecklistItem
                        label={RESUSCITATION_ITEMS[10].label}
                        itemKey={RESUSCITATION_ITEMS[10].key}
                        value={formData.skills[RESUSCITATION_ITEMS[10].key]}
                        onChange={handleSkillChange}
                    />
                )}

                {/* Branching Question 2 - Right-to-Left Inline Layout */}
                {showHasPulse && (
                    <div className="p-4 border rounded-lg bg-sky-50 border-sky-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in transition-all duration-300 mt-4" dir="rtl">
                        <span className="font-bold text-sky-900 text-right w-full md:flex-1">
                            هل يوجد نبضات قلب؟
                        </span>
                        <div className="flex gap-4 flex-shrink-0" dir="ltr">
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-md border hover:border-red-300 transition-colors">
                                <input type="radio" name="eenc_resus_has_pulse" value="no" checked={formData.eenc_resus_has_pulse === 'no'} onChange={handleFormChange} className="form-radio text-red-600 h-4 w-4"/>
                                <span className="font-bold text-gray-800">لا</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-md border hover:border-green-300 transition-colors">
                                <input type="radio" name="eenc_resus_has_pulse" value="yes" checked={formData.eenc_resus_has_pulse === 'yes'} onChange={handleFormChange} className="form-radio text-green-600 h-4 w-4"/>
                                <span className="font-bold text-gray-800">نعم</span>
                            </label>
                        </div>
                    </div>
                )}

                {/* Branch 2 Outcomes */}
                {showHasPulse && formData.eenc_resus_has_pulse === 'yes' && (
                    <SkillChecklistItem
                        label={RESUSCITATION_ITEMS[11].label}
                        itemKey={RESUSCITATION_ITEMS[11].key}
                        value={formData.skills[RESUSCITATION_ITEMS[11].key]}
                        onChange={handleSkillChange}
                    />
                )}

                {showHasPulse && formData.eenc_resus_has_pulse === 'no' && (
                    <SkillChecklistItem
                        label={RESUSCITATION_ITEMS[12].label}
                        itemKey={RESUSCITATION_ITEMS[12].key}
                        value={formData.skills[RESUSCITATION_ITEMS[12].key]}
                        onChange={handleSkillChange}
                    />
                )}
            </div>
        </div>
    );
};

const EENCSkillsAssessmentForm = forwardRef((props, ref) => {
    const {
        facility,
        healthWorkerName,
        healthWorkerJobTitle,
        healthWorkerTrainingDate,
        healthWorkerPhone, 
        onExit,
        onSaveComplete,
        setToast,
        existingSessionData = null,
        visitNumber = 1,
        canEditVisitNumber = false,
        lastSessionDate = null,
        onDraftCreated,
        setIsMothersFormModalOpen,
        setIsDashboardModalOpen,
        setIsVisitReportModalOpen,
        draftCount,
        workerHistory = []
    } = props;

    const [formData, setFormData] = useState(() => 
        existingSessionData ? rehydrateDraftData(existingSessionData) : getInitialFormData()
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false);
    const [scores, setScores] = useState({});
    const auth = getAuth();
    const user = auth.currentUser;
    const [isFormComplete, setIsFormComplete] = useState(false);

    const [currentVisitNumber, setCurrentVisitNumber] = useState(() => 
        existingSessionData?.visitNumber ? existingSessionData.visitNumber : visitNumber
    );

    // --- DYNAMIC VISIT NUMBER CALCULATION ---
    useEffect(() => {
        if (existingSessionData) return;
        const currentSessionDate = formData.session_date;
        if (!currentSessionDate) return;

        const uniqueDates = [...new Set(
            (workerHistory || []).map(s => s.sessionDate || (s.effectiveDate ? new Date(s.effectiveDate.seconds * 1000).toISOString().split('T')[0] : ''))
        )].filter(d => d).sort();

        if (uniqueDates.includes(currentSessionDate)) {
            const index = uniqueDates.indexOf(currentSessionDate);
            setCurrentVisitNumber(index + 1);
        } else {
            setCurrentVisitNumber(uniqueDates.length + 1);
        }
    }, [formData.session_date, workerHistory, existingSessionData]);

    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    const allPropsRef = useRef({
        facility, healthWorkerName, user, existingSessionData,
        isSaving, isSavingDraft, setToast, healthWorkerJobTitle,
        onDraftCreated, healthWorkerTrainingDate, healthWorkerPhone, 
        onExit, onSaveComplete, visitNumber, lastSessionDate, 
        setIsMothersFormModalOpen, setIsDashboardModalOpen, 
        setIsVisitReportModalOpen, draftCount
    });
    
    useEffect(() => {
        allPropsRef.current = {
            facility, healthWorkerName, user, existingSessionData,
            isSaving, isSavingDraft, setToast, healthWorkerJobTitle,
            onDraftCreated, healthWorkerTrainingDate, healthWorkerPhone, 
            onExit, onSaveComplete, visitNumber, lastSessionDate, 
            setIsMothersFormModalOpen, setIsDashboardModalOpen, 
            setIsVisitReportModalOpen, draftCount
        };
    }, [
        facility, healthWorkerName, user, existingSessionData,
        isSaving, isSavingDraft, setToast, healthWorkerJobTitle,
        onDraftCreated, healthWorkerTrainingDate, healthWorkerPhone, 
        onExit, onSaveComplete, visitNumber, lastSessionDate, 
        setIsMothersFormModalOpen, setIsDashboardModalOpen, 
        setIsVisitReportModalOpen, draftCount
    ]);
    
    const editingIdRef = useRef(null);

    useEffect(() => {
        const newId = existingSessionData ? existingSessionData.id : null;
        const oldId = editingIdRef.current;
        
        if (newId !== oldId) {
            const rehydratedData = rehydrateDraftData(existingSessionData);
            setFormData(rehydratedData);
            editingIdRef.current = newId;
        }
    }, [existingSessionData]);


    useEffect(() => {
        let needsUpdate = false;
        const newFormData = JSON.parse(JSON.stringify(formData));
        const { eenc_breathing_status, eenc_resus_breathed_normally, eenc_resus_has_pulse, skills } = newFormData;

        const updateRelevance = (items, isRelevant) => {
            items.forEach(item => {
                const key = item.key;
                if (isRelevant && (skills[key] === 'na' || skills[key] === undefined)) {
                    skills[key] = ''; 
                    needsUpdate = true;
                } else if (!isRelevant && skills[key] !== 'na') {
                    skills[key] = 'na'; 
                    needsUpdate = true;
                }
            });
        };

        updateRelevance(PREPARATION_ITEMS, true);
        updateRelevance(DRYING_STIMULATION_ITEMS, true);
        updateRelevance(NORMAL_BREATHING_ITEMS, eenc_breathing_status === 'yes');
        
        const isResus = eenc_breathing_status === 'no';
        updateRelevance(RESUSCITATION_ITEMS.slice(0, 10), isResus);

        if (!isResus) {
            if (eenc_resus_breathed_normally !== 'na') { newFormData.eenc_resus_breathed_normally = 'na'; needsUpdate = true; }
            if (eenc_resus_has_pulse !== 'na') { newFormData.eenc_resus_has_pulse = 'na'; needsUpdate = true; }
            updateRelevance(RESUSCITATION_ITEMS.slice(10), false);
        } else {
            const resusBaseUnanswered = RESUSCITATION_ITEMS.slice(0, 10).findIndex(item => skills[item.key] === 'na' || skills[item.key] === '');
            const baseComplete = resusBaseUnanswered === -1;

            if (!baseComplete) {
                if (eenc_resus_breathed_normally !== 'na') { newFormData.eenc_resus_breathed_normally = 'na'; needsUpdate = true; }
                if (eenc_resus_has_pulse !== 'na') { newFormData.eenc_resus_has_pulse = 'na'; needsUpdate = true; }
                updateRelevance(RESUSCITATION_ITEMS.slice(10), false);
            } else {
                if (eenc_resus_breathed_normally === 'yes') {
                    updateRelevance([RESUSCITATION_ITEMS[10]], true);
                    updateRelevance(RESUSCITATION_ITEMS.slice(11), false);
                    if (eenc_resus_has_pulse !== 'na') { newFormData.eenc_resus_has_pulse = 'na'; needsUpdate = true; }
                } else if (eenc_resus_breathed_normally === 'no') {
                    updateRelevance([RESUSCITATION_ITEMS[10]], false);
                    if (eenc_resus_has_pulse === 'yes') {
                        updateRelevance([RESUSCITATION_ITEMS[11]], true);
                        updateRelevance([RESUSCITATION_ITEMS[12]], false);
                    } else if (eenc_resus_has_pulse === 'no') {
                        updateRelevance([RESUSCITATION_ITEMS[11]], false);
                        updateRelevance([RESUSCITATION_ITEMS[12]], true);
                    } else {
                        updateRelevance(RESUSCITATION_ITEMS.slice(11), false);
                    }
                } else {
                    updateRelevance(RESUSCITATION_ITEMS.slice(10), false);
                    if (eenc_resus_has_pulse !== 'na') { newFormData.eenc_resus_has_pulse = 'na'; needsUpdate = true; }
                }
            }
        }

        if (needsUpdate) {
            setFormData(newFormData);
        }

        setScores(calculateScores(newFormData)); 
        setIsFormComplete(checkFormCompletion(newFormData));

    }, [formData]);


    const silentSaveDraft = useCallback(async () => {
        const {
            facility, healthWorkerName, user, isSaving, isSavingDraft, 
            healthWorkerJobTitle, onDraftCreated
        } = allPropsRef.current;
        
        const currentFormData = formDataRef.current;
        if (isSaving || isSavingDraft) return;
        
        try {
            const calculatedScores = calculateScores(currentFormData);
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }

            const effectiveDateTimestamp = Timestamp.fromDate(new Date(currentFormData.session_date));
            const sessionId = editingIdRef.current;

            const payload = {
                serviceType: 'EENC',
                state: facility?.['الولاية'] || null,
                locality: facility?.['المحلية'] || null,
                facilityId: facility?.id || null,
                facilityName: facility?.['اسم_المؤسسة'] || null,
                healthWorkerName: healthWorkerName,
                facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                workerType: healthWorkerJobTitle || null,
                sessionDate: currentFormData.session_date,
                effectiveDate: effectiveDateTimestamp,
                scores: scoresPayload,
                notes: currentFormData.notes,
                status: 'draft',
                visitNumber: Number(currentVisitNumber),
                eenc_breathing_status: currentFormData.eenc_breathing_status,
                eenc_resus_breathed_normally: currentFormData.eenc_resus_breathed_normally,
                eenc_resus_has_pulse: currentFormData.eenc_resus_has_pulse,
                skills: currentFormData.skills,
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

            const savedDraft = await saveMentorshipSession(payload, sessionId);
            
            if (!sessionId && savedDraft && onDraftCreated) {
                onDraftCreated(savedDraft);
                editingIdRef.current = savedDraft.id; 
            }
        } catch (error) {
            console.error("Autosave failed:", error);
        }
    }, [currentVisitNumber]);

    useImperativeHandle(ref, () => ({
        saveDraft: async () => {
            const { isSaving, isSavingDraft } = allPropsRef.current;
            if (isSaving || isSavingDraft) {
                return;
            }
            await silentSaveDraft();
        },
        openFacilityModal: () => setIsFacilityModalOpen(true)
    }));


    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSkillChange = (section, key, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value,
            }
        }));
    };

    const handleSaveFacilityData = async (formData) => {
        try {
            await submitFacilityDataForApproval(formData);
            setToast({ show: true, message: "Update submitted successfully!", type: 'success' });
            setIsFacilityModalOpen(false);
        } catch (error) {
            setToast({ show: true, message: `Submission failed: ${error.message}`, type: 'error' });
        }
    };

    const handleSubmit = async (e, status = 'complete') => {
        if (e) e.preventDefault();
        
        const currentFormComplete = checkFormCompletion(formData);

        if (status === 'complete' && !currentFormComplete) {
             setToast({ show: true, message: "Please complete all fields before saving.", type: 'error', duration: 10000 });
             return;
        }

        const savingDraft = status === 'draft';
        if (savingDraft) setIsSavingDraft(true);
        else setIsSaving(true);

        try {
            const calculatedScores = calculateScores(formData);
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }
            
            const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));
            const sessionId = editingIdRef.current;

            const payload = {
                serviceType: 'EENC',
                state: facility?.['الولاية'] || null,
                locality: facility?.['المحلية'] || null,
                facilityId: facility?.id || null,
                facilityName: facility?.['اسم_المؤسسة'] || null,
                healthWorkerName: healthWorkerName,
                facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                workerType: healthWorkerJobTitle || null,
                sessionDate: formData.session_date,
                effectiveDate: effectiveDateTimestamp,
                scores: scoresPayload,
                notes: formData.notes,
                status: status,
                visitNumber: Number(currentVisitNumber),
                eenc_breathing_status: formData.eenc_breathing_status,
                eenc_resus_breathed_normally: formData.eenc_resus_breathed_normally,
                eenc_resus_has_pulse: formData.eenc_resus_has_pulse,
                skills: formData.skills,
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

            const savedSession = await saveMentorshipSession(payload, sessionId);
            
            if (!sessionId && savedSession && onDraftCreated) {
                onDraftCreated(savedSession);
                editingIdRef.current = savedSession.id;
            }

            setToast({ show: true, message: `Saved ${status} successfully!`, type: 'success' });
            if (onSaveComplete) onSaveComplete(status, payload);

        } catch (error) {
            setToast({ show: true, message: `Error: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
            setIsSavingDraft(false);
        }
    };

    // Sequential Visibility Calculation Logic
    const getFirstUnansweredIndex = (items) => {
        return items.findIndex(item => formData.skills[item.key] === 'na' || formData.skills[item.key] === '');
    };

    const prepUnanswered = getFirstUnansweredIndex(PREPARATION_ITEMS);
    const prepVisibleIndex = prepUnanswered !== -1 ? prepUnanswered : -1;
    const isPrepComplete = prepUnanswered === -1;

    const dryingUnanswered = getFirstUnansweredIndex(DRYING_STIMULATION_ITEMS);
    // If Prep isn't complete, hide Drying entirely (-2). Else calc index.
    const dryingVisibleIndex = isPrepComplete ? (dryingUnanswered !== -1 ? dryingUnanswered : -1) : -2;
    const isDryingComplete = isPrepComplete && dryingUnanswered === -1;

    const isBreathingStatusAnswered = formData.eenc_breathing_status !== 'na';

    const normalUnanswered = getFirstUnansweredIndex(NORMAL_BREATHING_ITEMS);
    const normalVisibleIndex = isBreathingStatusAnswered ? (normalUnanswered !== -1 ? normalUnanswered : -1) : -2;

    return (
        <Card dir="rtl">
            <StickyOverallScore
                score={scores?.overallScore?.score}
                maxScore={scores?.overallScore?.maxScore}
            />
            <form onSubmit={(e) => handleSubmit(e, 'complete')}>
                <div className="p-6">
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-sky-800">
                            متابعة مهارات الرعاية الضرورية المبكرة (EENC)
                        </h2>
                    </div>

                    <div className="space-y-2 mb-4">
                        <div className="p-2 border rounded-lg bg-gray-50 text-right space-y-0.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-0.5" dir="rtl">
                                <div><span className="text-sm font-medium text-gray-500">الولاية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['الولاية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">المحلية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['المحلية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">اسم المؤسسة:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['اسم_المؤسسة'] || 'غير محدد'}</span></div>
                            </div>
                        </div>
                        <div className="p-2 border rounded-lg bg-gray-50 text-right">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-0.5 items-end" dir="rtl">
                                <div className="text-sm">
                                    <span className="font-medium text-gray-500">تاريخ الجلسة:</span>
                                    <Input type="date" name="session_date" value={formData.session_date} onChange={handleFormChange} required className="p-1 text-sm mr-2 w-auto"/>
                                </div>
                                <div className="text-sm flex items-center">
                                    <span className="font-medium text-gray-700 ml-2">رقم الجلسة:</span>
                                    {canEditVisitNumber ? (
                                        <Input type="number" min="1" value={currentVisitNumber} onChange={(e) => setCurrentVisitNumber(e.target.value)} className="w-20 p-1 text-center font-bold text-sky-700 border-sky-300 focus:ring-sky-500"/>
                                    ) : (
                                        <span className="text-lg font-bold text-sky-700 mr-2">{currentVisitNumber}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <SectionRenderer 
                        title="1. تحضيرات ما قبل الولادة" 
                        items={PREPARATION_ITEMS} 
                        formData={formData} 
                        handleSkillChange={handleSkillChange} 
                        score={scores.preparation?.score} 
                        maxScore={scores.preparation?.maxScore}
                        visibleItemIndex={prepVisibleIndex}
                    />
                    
                    <SectionRenderer 
                        title="2. التجفيف، التحفيز، التدفئة والشفط" 
                        items={DRYING_STIMULATION_ITEMS} 
                        formData={formData} 
                        handleSkillChange={handleSkillChange} 
                        score={scores.drying?.score} 
                        maxScore={scores.drying?.maxScore}
                        visibleItemIndex={dryingVisibleIndex}
                    />

                    {isDryingComplete && (
                        <div className="mt-6 p-4 border rounded-lg bg-sky-50 shadow-sm animate-fade-in transition-all duration-500">
                            <h3 className="text-lg font-semibold mb-3 text-right text-sky-900">3. تحديد حالة الوليد</h3>
                            <FormGroup label="الرجاء تحديد حالة الوليد لبدء التقييم التالي:" className="text-right">
                                <div className="flex gap-4 justify-start" dir="rtl">
                                    <label className="flex items-center gap-2 p-3 border rounded-md bg-white cursor-pointer hover:bg-sky-50 hover:border-sky-300 transition-colors">
                                        <input type="radio" name="eenc_breathing_status" value="yes" checked={formData.eenc_breathing_status === 'yes'} onChange={handleFormChange} className="form-radio text-green-600 h-5 w-5"/>
                                        <span className="font-semibold text-gray-800">طفل يتنفس طبيعياً</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-3 border rounded-md bg-white cursor-pointer hover:bg-red-50 hover:border-red-300 transition-colors">
                                        <input type="radio" name="eenc_breathing_status" value="no" checked={formData.eenc_breathing_status === 'no'} onChange={handleFormChange} className="form-radio text-red-600 h-5 w-5"/>
                                        <span className="font-semibold text-gray-800">طفل لا يتنفس طبيعياً (يحتاج إنعاش)</span>
                                    </label>
                                </div>
                            </FormGroup>
                        </div>
                    )}

                    {isDryingComplete && formData.eenc_breathing_status === 'yes' && (
                        <SectionRenderer 
                            title="4. متابعة طفل يتنفس طبيعياً" 
                            items={NORMAL_BREATHING_ITEMS} 
                            formData={formData} 
                            handleSkillChange={handleSkillChange} 
                            score={scores.normal_breathing?.score} 
                            maxScore={scores.normal_breathing?.maxScore}
                            visibleItemIndex={normalVisibleIndex}
                        />
                    )}

                    {isDryingComplete && formData.eenc_breathing_status === 'no' && (
                        <ResuscitationSectionRenderer 
                            formData={formData} 
                            handleFormChange={handleFormChange}
                            handleSkillChange={handleSkillChange} 
                            score={scores.resuscitation?.score} 
                            maxScore={scores.resuscitation?.maxScore}
                        />
                    )}
                    
                    {isFormComplete && (
                        <FormGroup label="ملاحظات عامة" className="text-right mt-6 animate-fade-in">
                            <Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={4} placeholder="أضف أي ملاحظات إضافية..." className="text-right placeholder:text-right"/>
                        </FormGroup>
                    )}
                </div>

                 <div className="hidden sm:flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                     <div className="flex gap-2 flex-wrap justify-end">
                        <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft}> إلغاء </Button>
                        <Button type="button" variant="outline" onClick={(e) => handleSubmit(e, 'draft')} disabled={isSaving || isSavingDraft || formData.eenc_breathing_status === 'na'}> {isSavingDraft ? 'جاري الحفظ...' : 'حفظ كمسودة'} </Button>
                        <Button type="submit" disabled={isSaving || isSavingDraft || !isFormComplete}> {isSaving ? 'جاري الحفظ...' : 'حفظ وإكمال الجلسة'} </Button>
                     </div>
                 </div>

                 {/* --- Mobile Bar --- */}
                 <div className="flex sm:hidden fixed bottom-16 left-0 right-0 z-20 h-16 justify-around items-center bg-gray-900 text-white border-t border-gray-700 shadow-lg" dir="rtl">
                    <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft} size="sm">
                        إلغاء
                    </Button>
                    <Button type="button" variant="outline" onClick={(e) => handleSubmit(e, 'draft')} disabled={isSaving || isSavingDraft || formData.eenc_breathing_status === 'na'} size="sm">
                        {isSavingDraft ? 'جاري...' : 'حفظ مسودة'}
                    </Button>
                    <Button type="submit" disabled={isSaving || isSavingDraft || !isFormComplete} size="sm"> 
                        {isSaving ? 'جاري...' : 'حفظ وإكمال'} 
                    </Button>
                 </div>

            </form>
        </Card>
    );
});

export default EENCSkillsAssessmentForm;