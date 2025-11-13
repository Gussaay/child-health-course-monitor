// EENCSkillsAssessmentForm.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { saveMentorshipSession } from "../data.js";
import { Timestamp } from 'firebase/firestore';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    Input, Textarea, Checkbox, Modal
} from './CommonComponents';
import { getAuth } from "firebase/auth";
// --- FIX: Import EENCFormFields, not IMNCIFormFields ---
import { GenericFacilityForm, EENCFormFields } from './FacilityForms.jsx'; 
import { submitFacilityDataForApproval } from "../data.js";

// --- مكونات خاصة بهذا النموذج ---

// --- 1. هيكل النموذج (من المصادر 1 و 2) ---

const PREPARATION_ITEMS = [
    { key: 'prep_temp', label: 'التأكد من درجة حرارة الغرفة مناسبة، اغلق تيارات الهواء' }, //
    { key: 'prep_notify_mother', label: 'إخبار الام (أوالشخص الداعم لها) عن مجريات سير الولادة وابدى تعاطفا معها وطمئنها' }, //
    { key: 'prep_wash_1', label: 'غسل الأيدي جيدا بالماء والصابون (المرة الأولى)' }, //
    { key: 'prep_cloths', label: 'تجهيز (2) قطعة قماش جافة ونظيفة، ووضع قطعة قماش جافة فوق بطن الأم لتجفيف الطفل مباشرة بعد الولادة، وضع القطعة الثانية جانبا لاستخدامها لتغطية الطفل بعد تجفيفه.' }, //
    { key: 'prep_resuscitation_area', label: 'تجهيز منطقة إنعاش الوليد (قناع + كيس + عصفورة شفط + فوطة)' }, //
    { key: 'prep_ambu_check', label: 'التأكد من فعالية القناع والكيس (امبوباق) لإنعاش الوليد' }, //
    { key: 'prep_wash_2', label: 'غسل الأيدي جيدا بالماء والصابون (المرة الثانية)' }, //
    { key: 'prep_gloves', label: 'لبس قفازات معقمة (2 قفاز)' }, //
    { key: 'prep_tools', label: 'وضع المشابك والملقط وكل ادوات الولادة معقمة في منطقة يسهل استخدامها بعد الولادة' }, //
];

const DRYING_STIMULATION_ITEMS = [
    { key: 'dry_time_record', label: 'تسجيل زمن الولادة (الساعة ___ دقائق ____ ثواني___)' }, //
    { key: 'dry_start_5sec', label: 'بداية التجفيف خلال 5 ثواني من الولادة' }, //
    { key: 'dry_procedure', label: 'التجفيف جيدا بداية من العينين، الوجه، الراس، الصدر، البطن، الظهر وأخيراً اليدين والقدمين' }, //
    { key: 'dry_stimulation', label: 'التحفيز بواسطة المسح برفق على الراس والجسم والاطراف (عدم الضرب على الظهر)' }, //
    { key: 'dry_suction', label: 'شفط مجرى التنفس فقط في حالة قفل مجرى الهواء والطفل لا يتنفس تماما' }, //
    { key: 'dry_remove_wet_cloth', label: 'ازالة القطعة المبللة بالسوائل' }, //
    { key: 'dry_skin_to_skin', label: 'وضع الطفل ملتصقا جلدا بجلد امه' }, //
    { key: 'dry_cover_baby', label: 'تغطية الطفل بقطعة جافة وتغطية الراس بطاقية' }, //
];

const NORMAL_BREATHING_ITEMS = [
    { key: 'normal_check_second_baby', label: 'التأكد من عدم وجود طفل اخر' }, //
    { key: 'normal_oxytocin', label: 'اعطاء حقنة الطلق (اوكسيتوسين) خلال واحد دقيقة بعد الولادة' }, //
    { key: 'normal_remove_outer_glove', label: 'نزع القفاز الخارجي والابقاء علي الداخلي قبل لمس الحبل السري' }, //
    { key: 'normal_cord_pulse_check', label: 'التاكد من نبض الحبل السري قبل الشبك , وشبك الحبل السري بعد توقف النبض (عادة 1- 3 دقيقة)' }, //
    { key: 'normal_cord_clamping', label: 'وضع المشبك الاول علي بعد 2سم من قاعدة السرة ووضع الملقط علي بعد 5 سم من قاعدة السرة ثم قطع الحبل السري' }, //
    { key: 'normal_placenta', label: 'ازالة المشيمة' }, //
    { key: 'normal_breastfeeding_guidance', label: 'ارشد الام علي علامات استعداد الوليد للرضاعة الطبيعية' }, //
];

const RESUSCITATION_ITEMS = [
    { key: 'resus_ask_help', label: 'طلب المساعدة' }, //
    { key: 'resus_remove_outer_glove', label: 'نزع القفاز الخارجي والابقاء على الداخلي' }, //
    { key: 'resus_clamp_cord', label: 'وضع المشبك سريعا على الحبل السري وقطع الحبل السري' }, //
    { key: 'resus_move_to_area', label: 'نقل الوليد سريعا الي منطقة الانعاش المجهزة' }, //
    { key: 'resus_cover_while_moving', label: 'تغطية الوليد اثناء نقله الي منطقة الإنعاش' }, //
    { key: 'resus_position_head', label: 'استعدال الراس لفتح مجري الهواء' }, //
    { key: 'resus_mask_position', label: 'تغطية الكيس والقناع (الأمبوباق) للفم والانف والحنك' }, //
    { key: 'resus_check_chest_rise', label: 'التأكد من ارتفاع الصدر في اقل من 1 دقيقة من الولادة' }, //
    { key: 'resus_ventilation_rate', label: 'الضغط على الكيس (امبوباق) لإعطاء 30 – 50 نفس في الدقيقة والحفاظ علي ارتفاع الصدر (التهوية)' }, //
    { key: 'resus_no_chest_rise_steps', label: 'فى حالة عدم ارتفاع الصدر بعد استخدام (امبوباق) اتبع الخطوات التالية: استعدال وضعية الراس، استعدال وضعية القناع لتعطى تغطية أفضل، التأكد من فتح مجرى الهواء' }, //
    { key: 'resus_followup_if_breathing', label: 'إذا تنفس الطفل طبيعيا بعد الامبوباق (ايقاف عملية الانعاش والمراقبه كل 15 دقيقة, ارجاع الطفل الي بطن امه ملتصقا جلد بجلد, ارشاد الام ان طفلها سليم...)' }, //
    { key: 'resus_followup_no_breathing_10min_pulse', label: 'فى حالة لم يتنفس الطفل طبيعيا بعد 10 دقائق من التنفس الفعال + وجود نبضات قلب (مواصلة عملية التنفس ,وتحويل الطفل والتأكد من المحافظة عليه دافئا أثناء التحويل)' }, //
    { key: 'resus_followup_no_breathing_10min_no_pulse', label: 'فى حالة لم يتنفس الطفل طبيعيا بعد 10 دقائق من التنفس الفعال + عدم وجود نبضات قلب (هل تم التأكد من وفاة الطفل ,وايقاف عملية التنفس ,وتقديم الدعم العاطفي للام)' }, //
];

// دمج كل المفاتيح لإنشاء الحالة الأولية
const allItems = [
    ...PREPARATION_ITEMS,
    ...DRYING_STIMULATION_ITEMS,
    ...NORMAL_BREATHING_ITEMS,
    ...RESUSCITATION_ITEMS
];

// --- 2. دالة الحالة الأولية ---
const getInitialFormData = () => {
    const skills = {};
    allItems.forEach(item => {
        skills[item.key] = 'na'; // 'na' | 'yes' | 'no' | 'partial'
    });

    return {
        session_date: new Date().toISOString().split('T')[0],
        eenc_breathing_status: 'na', // 'na' | 'yes' | 'no'
        skills: skills,
        notes: '',
    };
};

// --- 3. دالة إعادة ملء المسودة ---
const rehydrateDraftData = (draftData) => {
    const initial = getInitialFormData();
    if (!draftData) return initial;

    const dataToLoad = draftData.formData ? draftData.formData : draftData;

    const skills = { ...initial.skills, ...dataToLoad.skills };
    
    return {
        session_date: dataToLoad.session_date || initial.session_date,
        eenc_breathing_status: dataToLoad.eenc_breathing_status || (dataToLoad.formType === 'breathing' ? 'yes' : (dataToLoad.formType === 'not_breathing' ? 'no' : 'na')),
        skills: skills,
        notes: dataToLoad.notes || '',
    };
};

// --- 4. دالة حساب الدرجات ---
const calculateScores = (formData) => {
    const { eenc_breathing_status, skills } = formData;
    let score = 0;
    let maxScore = 0;

    const itemsToScore = [...PREPARATION_ITEMS, ...DRYING_STIMULATION_ITEMS];
    
    if (eenc_breathing_status === 'yes') {
        itemsToScore.push(...NORMAL_BREATHING_ITEMS);
    } else if (eenc_breathing_status === 'no') {
        itemsToScore.push(...RESUSCITATION_ITEMS);
    }
    // إذا كان 'na'، يتم حساب التحضيرات والتجفيف فقط

    itemsToScore.forEach(item => {
        const value = skills[item.key];
        if (value && value !== 'na') {
            maxScore += 2; // أقصى درجة لكل عنصر هي 2
            if (value === 'yes') {
                score += 2;
            } else if (value === 'partial') {
                score += 1;
            }
            // 'no' adds 0
        }
    });

    return {
        overallScore: { score, maxScore },
    };
};

// --- 5. دالة التحقق من الاكتمال ---
// --- FIX: Renamed function to avoid name collision ---
const checkFormCompletion = (formData) => {
    const { eenc_breathing_status, skills } = formData;
    if (eenc_breathing_status === 'na') return false; // يجب اختيار الحالة

    const itemsToCheck = [...PREPARATION_ITEMS, ...DRYING_STIMULATION_ITEMS];
    
    if (eenc_breathing_status === 'yes') {
        itemsToCheck.push(...NORMAL_BREATHING_ITEMS);
    } else if (eenc_breathing_status === 'no') {
        itemsToCheck.push(...RESUSCITATION_ITEMS);
    }
    
    // التحقق من أن كل عنصر ذي صلة قد تم ملؤه (ليس 'na' أو '')
    for (const item of itemsToCheck) {
        if (skills[item.key] === 'na' || skills[item.key] === '') {
            return false;
        }
    }
    return true;
};


// --- مكونات الواجهة ---

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

// --- START: LAYOUT FIX ---
const SkillChecklistItem = ({ label, itemKey, value, onChange }) => {
    const handleChange = (e) => {
        onChange('skills', itemKey, e.target.value);
    };

    return (
        // Use justify-between. In RTL, this pushes the first child (span) to the right
        // and the second child (div) to the left.
        <div className="p-3 border rounded-lg bg-white flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Label (Item 1: will be on the right) */}
            <span className="font-medium text-gray-700 text-right md:flex-grow">{label}</span>
            
            {/* Options (Item 2: will be on the left) */}
            <div className="flex gap-4 flex-shrink-0" dir="ltr">
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
            </div>
        </div>
    );
};
// --- END: LAYOUT FIX ---

const SectionRenderer = ({ title, items, formData, handleSkillChange }) => {
    return (
        <div className="mt-6 animate-fade-in">
            {/* --- FIX: Changed background to blue and added text-right --- */}
            <h3 className="text-xl font-semibold mb-4 p-3 bg-sky-100 text-sky-800 rounded-md sticky top-0 z-10 text-right">
                {title}
            </h3>
            <div className="space-y-3">
                {items.map(item => (
                    <SkillChecklistItem
                        key={item.key}
                        label={item.label}
                        itemKey={item.key}
                        value={formData.skills[item.key]}
                        onChange={handleSkillChange}
                    />
                ))}
            </div>
        </div>
    );
};

// --- المكون الأساسي للنموذج ---
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
        lastSessionDate = null,
        onDraftCreated,
        setIsMothersFormModalOpen,
        setIsDashboardModalOpen,
        setIsVisitReportModalOpen,
        draftCount
    } = props;

    // --- State Management ---
    const [formData, setFormData] = useState(() => 
        existingSessionData ? rehydrateDraftData(existingSessionData) : getInitialFormData()
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false);
    const [scores, setScores] = useState({});
    const auth = getAuth();
    const user = auth.currentUser;
    // --- FIX: Renamed state variable ---
    const [isFormComplete, setIsFormComplete] = useState(false);

    // --- Refs for Autosave ---
    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    const allPropsRef = useRef({
        facility, healthWorkerName, user, visitNumber, existingSessionData,
        isSaving, isSavingDraft, setToast, healthWorkerJobTitle,
        onDraftCreated,
        healthWorkerTrainingDate, healthWorkerPhone, onExit, onSaveComplete,
        visitNumber, lastSessionDate, setIsMothersFormModalOpen,
        setIsDashboardModalOpen, setIsVisitReportModalOpen, draftCount
    });
    useEffect(() => {
        allPropsRef.current = {
            facility, healthWorkerName, user, visitNumber, existingSessionData,
            isSaving, isSavingDraft, setToast, healthWorkerJobTitle,
            onDraftCreated,
            healthWorkerTrainingDate, healthWorkerPhone, onExit, onSaveComplete,
            visitNumber, lastSessionDate, setIsMothersFormModalOpen,
            setIsDashboardModalOpen, setIsVisitReportModalOpen, draftCount
        };
    }, [
        facility, healthWorkerName, user, visitNumber, existingSessionData,
        isSaving, isSavingDraft, setToast, healthWorkerJobTitle,
        onDraftCreated,
        healthWorkerTrainingDate, healthWorkerPhone, onExit, onSaveComplete,
        visitNumber, lastSessionDate, setIsMothersFormModalOpen,
        setIsDashboardModalOpen, setIsVisitReportModalOpen, draftCount
    ]);
    
    const editingIdRef = useRef(null);

    // --- Effect for loading/rehydrating data ---
    useEffect(() => {
        const newId = existingSessionData ? existingSessionData.id : null;
        const oldId = editingIdRef.current;
        
        if (newId !== oldId) {
            const rehydratedData = rehydrateDraftData(existingSessionData);
            setFormData(rehydratedData);
            editingIdRef.current = newId;
        }
    }, [existingSessionData]);


    // --- Main effect for cleanup, scoring, and relevance ---
    useEffect(() => {
        let needsUpdate = false;
        const newFormData = JSON.parse(JSON.stringify(formData));
        const { eenc_breathing_status, skills } = newFormData;

        // Relevance Cleanup Logic
        const updateRelevance = (items, isRelevant) => {
            items.forEach(item => {
                const key = item.key;
                if (isRelevant && (skills[key] === 'na' || skills[key] === undefined)) {
                    skills[key] = ''; // Set to empty to be filled
                    needsUpdate = true;
                } else if (!isRelevant && skills[key] !== 'na') {
                    skills[key] = 'na'; // Set to 'na' as it's not relevant
                    needsUpdate = true;
                }
            });
        };

        // Sections 1 & 2 are always relevant
        updateRelevance(PREPARATION_ITEMS, true);
        updateRelevance(DRYING_STIMULATION_ITEMS, true);

        // Section 3
        updateRelevance(NORMAL_BREATHING_ITEMS, eenc_breathing_status === 'yes');
        // Section 4
        updateRelevance(RESUSCITATION_ITEMS, eenc_breathing_status === 'no');

        if (needsUpdate) {
            setFormData(newFormData);
        }

        // Calculate scores
        setScores(calculateScores(newFormData)); 

        // Check completion
        // --- FIX: Use renamed checker function ---
        setIsFormComplete(checkFormCompletion(newFormData));

    }, [formData]);


    // --- Autosave Logic (Simplified) ---
    const silentSaveDraft = useCallback(async () => {
        const {
            facility, healthWorkerName, user, visitNumber, existingSessionData,
            isSaving, isSavingDraft, setToast, healthWorkerJobTitle,
            onDraftCreated
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
                visitNumber: visitNumber,
                eenc_breathing_status: currentFormData.eenc_breathing_status,
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
            // Don't show toast on autosave fail
        }
    }, []); 

    // --- useImperativeHandle ---
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


    // --- Handlers ---
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
        // (Copied from IMNCI form)
        try {
            await submitFacilityDataForApproval(formData);
            setToast({ show: true, message: "Update submitted successfully! Your changes are pending approval.", type: 'success' });
            setIsFacilityModalOpen(false);
        } catch (error) {
            setToast({ show: true, message: `Submission failed: ${error.message}`, type: 'error' });
        }
    };

    // --- Final Submit Handler ---
    const handleSubmit = async (e, status = 'complete') => {
        if (e) e.preventDefault();
        
        // --- FIX: Use renamed checker function ---
        const currentFormComplete = checkFormCompletion(formData);

        if (status === 'complete' && !currentFormComplete) {
             const errorMessage = `لا يمكن الحفظ. الرجاء اختيار حالة الطفل (يتنفس / لا يتنفس) والتأكد من ملء جميع العناصر ذات الصلة.`;
             setToast({ show: true, message: errorMessage, type: 'error', duration: 10000 });
             return;
        }

        const savingDraft = status === 'draft';
        if (savingDraft) {
            setIsSavingDraft(true);
        } else {
            setIsSaving(true);
        }

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
                visitNumber: visitNumber,
                // EENC specific data
                eenc_breathing_status: formData.eenc_breathing_status,
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

            setToast({ show: true, message: `تم حفظ ${savingDraft ? 'المسودة' : 'الجلسة'} بنجاح!`, type: 'success' });
            if (onSaveComplete) onSaveComplete(status, payload);

        } catch (error) {
            console.error("Error saving EENC session:", error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
            setIsSavingDraft(false);
        }
    };

    // --- Render function ---
    return (
        <Card dir="rtl">
            <StickyOverallScore
                score={scores?.overallScore?.score}
                maxScore={scores?.overallScore?.maxScore}
            />
            <form onSubmit={(e) => handleSubmit(e, 'complete')}>
                <div className="p-6">
                    {/* --- Centered Title --- */}
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-sky-800">
                            متابعة مهارات الرعاية الضرورية المبكرة (EENC)
                        </h2>
                    </div>

                    {/* --- Info Cards Wrapper (Copied from IMNCI) --- */}
                    <div className="space-y-2 mb-4">
                        {/* Facility Info */}
                        <div className="p-2 border rounded-lg bg-gray-50 text-right space-y-0.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-0.5" dir="rtl">
                                <div><span className="text-sm font-medium text-gray-500">الولاية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['الولاية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">المحلية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['المحلية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">اسم المؤسسة:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['اسم_المؤسسة'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">نوع المؤسسة:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['نوع_المؤسسةالصحية'] || 'غير محدد'}</span></div>
                            </div>
                        </div>
                        {/* Health Worker Info */}
                        <div className="p-2 border rounded-lg bg-gray-50 text-right space-y-0.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-0.5" dir="rtl">
                                <div><span className="text-sm font-medium text-gray-500">اسم العامل الصحي:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerName || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">الوصف الوظيفي:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerJobTitle || 'غير محدد'}</span></div>
                                <div className="whitespace-nowrap overflow-hidden text-ellipsis"><span className="text-sm font-medium text-gray-500">تاريخ اخر تدريب:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerTrainingDate || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">رقم الهاتف:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerPhone || 'غير محدد'}</span></div>
                            </div>
                        </div>
                        {/* Mentor/Session Info */}
                        <div className="p-2 border rounded-lg bg-gray-50 text-right">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-0.5 items-end" dir="rtl">
                                <div className="text-sm"><span className="font-medium text-gray-500">اسم المشرف:</span><span className="font-semibold text-gray-900 mr-2">{user?.displayName || user?.email || '...'}</span></div>                                <div className="text-sm"><span className="font-medium text-gray-500">تاريخ الجلسة:</span>
                                    <Input 
                                        type="date" 
                                        name="session_date" 
                                        value={formData.session_date} 
                                        onChange={handleFormChange} 
                                        required 
                                        className="p-1 text-sm mr-2 w-auto"
                                    />
                                </div>
                                <div className="text-sm">
                                    <span className="font-medium text-gray-500">تاريخ الجلسة السابقة:</span>
                                    <span className="font-semibold text-gray-900 mr-2">{lastSessionDate || '---'}</span> 
                                </div>
                                <div className="text-sm"><span className="font-medium text-gray-700">رقم الجلسة:</span>
                                    <span className="text-lg font-bold text-sky-700 mr-2">{visitNumber}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- EENC Form Content --- */}
                    <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                        {/* --- FIX: Added text-right --- */}
                        <h3 className="text-lg font-semibold mb-3 text-right">1. تحديد حالة الوليد</h3>
                        {/* --- FIX: Added text-right --- */}
                        <FormGroup label="الرجاء تحديد حالة الوليد لبدء التقييم:" className="text-right">
                            {/* --- FIX: Changed justify-end to justify-start for RTL --- */}
                            <div className="flex gap-4 justify-start" dir="rtl">
                                <label className="flex items-center gap-2 p-2 border rounded-md bg-white cursor-pointer">
                                    <input
                                        type="radio"
                                        name="eenc_breathing_status"
                                        value="yes"
                                        checked={formData.eenc_breathing_status === 'yes'}
                                        onChange={handleFormChange}
                                        className="form-radio text-green-600"
                                    />
                                    <span className="font-semibold">طفل يتنفس طبيعياً</span>
                                </label>
                                <label className="flex items-center gap-2 p-2 border rounded-md bg-white cursor-pointer">
                                    <input
                                        type="radio"
                                        name="eenc_breathing_status"
                                        value="no"
                                        checked={formData.eenc_breathing_status === 'no'}
                                        onChange={handleFormChange}
                                        className="form-radio text-red-600"
                                    />
                                    <span className="font-semibold">طفل لا يتنفس طبيعياً (يحتاج إنعاش)</span>
                                </label>
                            </div>
                        </FormGroup>
                    </div>

                    {/* --- Render Sections Based on Selection --- */}
                    {formData.eenc_breathing_status !== 'na' && (
                        <>
                            <SectionRenderer title="2. تحضيرات ما قبل الولادة" items={PREPARATION_ITEMS} formData={formData} handleSkillChange={handleSkillChange} />
                            <SectionRenderer title="3. التجفيف، التحفيز، التدفئة والشفط" items={DRYING_STIMULATION_ITEMS} formData={formData} handleSkillChange={handleSkillChange} />
                        </>
                    )}

                    {formData.eenc_breathing_status === 'yes' && (
                        <SectionRenderer title="4. متابعة طفل يتنفس طبيعياً" items={NORMAL_BREATHING_ITEMS} formData={formData} handleSkillChange={handleSkillChange} />
                    )}

                    {formData.eenc_breathing_status === 'no' && (
                        <SectionRenderer title="4. إنعاش الوليد (الدقيقة الذهبية)" items={RESUSCITATION_ITEMS} formData={formData} handleSkillChange={handleSkillChange} />
                    )}
                    

                    {/* --- Notes Section --- */}
                    {(formData.eenc_breathing_status !== 'na') && (
                        <>
                           <FormGroup label="ملاحظات عامة" className="text-right mt-6">
                                <Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={4} placeholder="أضف أي ملاحظات إضافية حول الجلسة..." className="text-right placeholder:text-right"/>
                           </FormGroup>
                        </>
                    )}
                </div>

                 {/* --- Button Bar (Copied from IMNCI) --- */}
                 <div className="hidden sm:flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                     {/* Row 1: Action Buttons */}
                     <div className="flex gap-2 flex-wrap justify-end">
                        <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft}> إلغاء </Button>
                        <Button type="button" variant="outline" onClick={(e) => handleSubmit(e, 'draft')} disabled={isSaving || isSavingDraft || formData.eenc_breathing_status === 'na'}> {isSavingDraft ? 'جاري حفظ المسودة...' : 'حفظ كمسودة'} </Button>
                        <Button 
                            type="submit" 
                            disabled={isSaving || isSavingDraft || !isFormComplete} 
                            title={!isFormComplete ? "يجب إكمال جميع الخطوات أولاً لحفظ الجلسة" : "حفظ وإنهاء الجلسة"}
                        > 
                            {isSaving ? 'جاري الحفظ...' : 'حفظ وإكمال الجلسة'} 
                        </Button>
                     </div>
                     {/* Row 2: Navigation Buttons */}
                     <div className="flex gap-2 flex-wrap justify-end">
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsFacilityModalOpen(true)} 
                            disabled={isSaving || isSavingDraft || !facility}
                            title={facility ? "Open EENC Facility Data Form" : "No facility selected"}
                        >
                            بيانات المنشأة (EENC)
                        </Button>
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsMothersFormModalOpen(true)} 
                            disabled={isSaving || isSavingDraft || !facility}
                            title={facility ? "Open Mother's Survey" : "No facility selected"}
                        >
                            استبيان الأم
                        </Button>
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsDashboardModalOpen(true)} 
                            disabled={isSaving || isSavingDraft}
                            title="Open Dashboard"
                        >
                            لوحة المتابعة
                        </Button>
                     </div>
                 </div>

                {/* --- Mobile Bar (Copied from IMNCI) --- */}
                <div className="flex sm:hidden fixed bottom-16 left-0 right-0 z-20 h-16 justify-around items-center bg-gray-900 text-white border-t border-gray-700 shadow-lg" dir="rtl">
                    <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft} size="sm">
                        إلغاء
                    </Button>
                    <Button type="button" variant="outline" onClick={(e) => handleSubmit(e, 'draft')} disabled={isSaving || isSavingDraft || formData.eenc_breathing_status === 'na'} size="sm">
                        {isSavingDraft ? 'جاري...' : 'حفظ مسودة'}
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={isSaving || isSavingDraft || !isFormComplete} 
                        title={!isFormComplete ? "يجب إكمال جميع الخطوات أولاً لحفظ الجلسة" : "حفظ وإنهاء الجلسة"}
                        size="sm"
                    > 
                        {isSaving ? 'جاري...' : 'حفظ وإكمال'} 
                    </Button>
                </div>
            </form>

            {/* --- Facility Modal (Copied from IMNCI) --- */}
            {isFacilityModalOpen && facility && (
                <Modal 
                    isOpen={isFacilityModalOpen} 
                    onClose={() => setIsFacilityModalOpen(false)} 
                    title={`بيانات منشأة: ${facility['اسم_المؤسسة'] || ''}`}
                    size="full"
                >
                    <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                        <GenericFacilityForm
                            initialData={facility}
                            onSave={handleSaveFacilityData}
                            onCancel={() => setIsFacilityModalOpen(false)}
                            setToast={setToast}
                            title="بيانات خدمة EENC"
                            subtitle={`تحديث البيانات للمنشأة: ${facility['اسم_المؤسسة'] || '...'}`}
                            isPublicForm={false}
                            saveButtonText="Submit for Approval"
                            cancelButtonText="Close"
                        >
                            {/* --- FIX: This now correctly points to EENCFormFields --- */}
                            {(props) => <EENCFormFields {...props} />}
                        </GenericFacilityForm>
                    </div>
                </Modal>
            )}
        </Card>
    );
});

export default EENCSkillsAssessmentForm;