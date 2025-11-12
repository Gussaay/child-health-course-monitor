// EENCSkillsAssessmentForm.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { saveMentorshipSession } from "../data.js"; // افترض استيراد دالة الحفظ
import { Timestamp } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
import {
    Card, PageHeader, Button, FormGroup, Input, Textarea, Spinner
} from './CommonComponents'; // افترض استيراد المكونات الأساسية

// --- بيانات النموذج من المصادر 1 و 2 ---

// المصدر 1: طفل يتنفس طبيعيا
const PREPARATION_ITEMS = [
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

const DRYING_STIMULATION_ITEMS = [
    { key: 'dry_time_record', label: 'تسجيل زمن الولادة (الساعة ___ دقائق ____ ثواني___)' },
    { key: 'dry_start_5sec', label: 'بداية التجفيف خلال 5 ثواني من الولادة' },
    { key: 'dry_procedure', label: 'التجفيف جيدا بداية من العينين، الوجه، الراس، الصدر، البطن، الظهر وأخيراً اليدين والقدمين' },
    { key: 'dry_stimulation', label: 'التحفيز بواسطة المسح برفق على الراس والجسم والاطراف (عدم الضرب على الظهر)' },
    { key: 'dry_suction', label: 'شفط مجرى التنفس فقط في حالة قفل مجرى الهواء والطفل لا يتنفس تماما' },
    { key: 'dry_remove_wet_cloth', label: 'ازالة القطعة المبللة بالسوائل' },
    { key: 'dry_skin_to_skin', label: 'وضع الطفل ملتصقا جلدا بجلد امه' },
    { key: 'dry_cover_baby', label: 'تغطية الطفل بقطعة جافة وتغطية الراس بطاقية' },
];

const NORMAL_BREATHING_ITEMS = [
    { key: 'normal_check_second_baby', label: 'التأكد من عدم وجود طفل اخر' },
    { key: 'normal_oxytocin', label: 'اعطاء حقنة الطلق (اوكسيتوسين) خلال واحد دقيقة بعد الولادة' },
    { key: 'normal_remove_outer_glove', label: 'نزع القفاز الخارجي والابقاء علي الداخلي قبل لمس الحبل السري' },
    { key: 'normal_cord_pulse_check', label: 'التاكد من نبض الحبل السري قبل الشبك , وشبك الحبل السري بعد توقف النبض (عادة 1- 3 دقيقة)' },
    { key: 'normal_cord_clamping', label: 'وضع المشبك الاول علي بعد 2سم من قاعدة السرة ووضع الملقط علي بعد 5 سم من قاعدة السرة ثم قطع الحبل السري' },
    { key: 'normal_placenta', label: 'ازالة المشيمة' },
    { key: 'normal_breastfeeding_guidance', label: 'ارشد الام علي علامات استعداد الوليد للرضاعة الطبيعية' },
];

// المصدر 2: طفل لا يتنفس طبيعيا (إنعاش)
const RESUSCITATION_ITEMS = [
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
    // متابعة ما بعد الإنعاش
    { key: 'resus_followup_if_breathing', label: 'إذا تنفس الطفل طبيعيا بعد الامبوباق (ايقاف عملية الانعاش والمراقبه كل 15 دقيقة, ارجاع الطفل الي بطن امه ملتصقا جلد بجلد, ارشاد الام ان طفلها سليم...)' },
    { key: 'resus_followup_no_breathing_10min_pulse', label: 'فى حالة لم يتنفس الطفل طبيعيا بعد 10 دقائق من التنفس الفعال + وجود نبضات قلب (مواصلة عملية التنفس ,وتحويل الطفل والتأكد من المحافظة عليه دافئا أثناء التحويل)' },
    { key: 'resus_followup_no_breathing_10min_no_pulse', label: 'فى حالة لم يتنفس الطفل طبيعيا بعد 10 دقائق من التنفس الفعال + عدم وجود نبضات قلب (هل تم التأكد من وفاة الطفل ,وايقاف عملية التنفس ,وتقديم الدعم العاطفي للام)' },
];

// دمج كل المفاتيح لإنشاء الحالة الأولية
const allItems = [
    ...PREPARATION_ITEMS,
    ...DRYING_STIMULATION_ITEMS,
    ...NORMAL_BREATHING_ITEMS,
    ...RESUSCITATION_ITEMS
];

const getInitialFormData = () => {
    const data = {};
    allItems.forEach(item => {
        data[item.key] = ''; // '' | 'yes' | 'no' | 'partial'
    });
    data.session_date = new Date().toISOString().split('T')[0];
    data.notes = '';
    return data;
};

// --- مكون فرعي لعرض كل عنصر تقييم ---
const ChecklistItem = ({ label, itemKey, value, onChange }) => {
    const handleChange = (e) => {
        onChange(itemKey, e.target.value);
    };

    return (
        <div className="p-3 border rounded-lg bg-white flex flex-col md:flex-row justify-between md:items-center">
            <span className="font-medium text-gray-700 mb-2 md:mb-0 md:w-2/3">{label}</span>
            <div className="flex gap-4" dir="ltr">
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

// --- المكون الأساسي للنموذج ---
const EENCSkillsAssessmentForm = ({
    facility,
    healthWorkerName,
    onExit,
    onSaveComplete,
    setToast,
    existingSessionData = null
}) => {
    const [formData, setFormData] = useState(getInitialFormData);
    const [formToShow, setFormToShow] = useState(null); // 'breathing' | 'not_breathing'
    const [isSaving, setIsSaving] = useState(false);
    const auth = getAuth();
    const user = auth.currentUser;

    useEffect(() => {
        if (existingSessionData) {
            // إعادة ملء النموذج إذا كان موجوداً (لتحرير المسودات)
            const rehydratedData = { ...getInitialFormData(), ...existingSessionData.formData };
            setFormData(rehydratedData);
            setFormToShow(existingSessionData.formType);
        }
    }, [existingSessionData]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSkillChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    // حساب الدرجات
    const calculateScores = () => {
        let score = 0;
        let maxScore = 0;
        const itemsToScore = formToShow === 'breathing' 
            ? [...PREPARATION_ITEMS, ...DRYING_STIMULATION_ITEMS, ...NORMAL_BREATHING_ITEMS]
            : [...PREPARATION_ITEMS, ...DRYING_STIMULATION_ITEMS, ...RESUSCITATION_ITEMS];
        
        itemsToScore.forEach(item => {
            const value = formData[item.key];
            if (value) {
                maxScore += 2; // أقصى درجة لكل عنصر هي 2
                if (value === 'yes') {
                    score += 2;
                } else if (value === 'partial') {
                    score += 1;
                }
                // 'no' adds 0
            }
        });
        return { score, maxScore };
    };

    const handleSubmit = async (status = 'complete') => {
        if (!formToShow) {
            setToast({ show: true, message: 'الرجاء اختيار نوع الحالة أولاً (طفل يتنفس أو لا يتنفس).', type: 'error' });
            return;
        }

        setIsSaving(true);
        const { score, maxScore } = calculateScores();
        const scoresPayload = {
            overallScore_score: score,
            overallScore_maxScore: maxScore
        };

        const payload = {
            serviceType: 'EENC',
            state: facility?.['الولاية'] || null,
            locality: facility?.['المحلية'] || null,
            facilityId: facility?.id || null,
            facilityName: facility?.['اسم_المؤسسة'] || null,
            healthWorkerName: healthWorkerName,
            sessionDate: formData.session_date,
            effectiveDate: Timestamp.fromDate(new Date(formData.session_date)),
            scores: scoresPayload,
            notes: formData.notes,
            status: status,
            mentorEmail: user?.email || 'unknown',
            mentorName: user?.displayName || 'Unknown Mentor',
            formData: formData, // حفظ جميع بيانات النموذج
            formType: formToShow // حفظ نوع النموذج المستخدم
        };

        try {
            await saveMentorshipSession(payload, existingSessionData?.id || null);
            setToast({ show: true, message: `تم حفظ ${status === 'draft' ? 'المسودة' : 'الجلسة'} بنجاح!`, type: 'success' });
            if (onSaveComplete) onSaveComplete(status, payload);
        } catch (error) {
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const renderChecklist = (title, items) => (
        <div className="mt-6">
            <h3 className="text-xl font-semibold mb-4 p-2 bg-gray-100 rounded-md">{title}</h3>
            <div className="space-y-3">
                {items.map(item => (
                    <ChecklistItem
                        key={item.key}
                        label={item.label}
                        itemKey={item.key}
                        value={formData[item.key]}
                        onChange={handleSkillChange}
                    />
                ))}
            </div>
        </div>
    );

    return (
        <Card dir="rtl">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit('complete'); }}>
                <div className="p-6">
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-sky-800">
                            متابعة مهارات الرعاية الضرورية المبكرة (EENC)
                        </h2>
                    </div>
                    
                    {/* معلومات الجلسة (مبسطة) */}
                    <div className="p-3 border rounded-lg bg-gray-50 text-right space-y-2 mb-4">
                        <p><span className="font-medium text-gray-500">المؤسسة:</span> <span className="font-semibold text-gray-900 mr-2">{facility?.['اسم_المؤسسة'] || 'غير محدد'}</span></p>
                        <p><span className="font-medium text-gray-500">العامل الصحي:</span> <span className="font-semibold text-gray-900 mr-2">{healthWorkerName || 'غير محدد'}</span></p>
                        <FormGroup label="تاريخ الجلسة:" className="flex items-center gap-2">
                            <Input 
                                type="date" 
                                name="session_date" 
                                value={formData.session_date} 
                                onChange={handleFormChange} 
                                required 
                                className="p-1 text-sm w-auto"
                            />
                        </FormGroup>
                    </div>

                    {/* اختيار نوع النموذج */}
                    {!formToShow && (
                        <div className="p-6 border-2 border-dashed border-sky-400 rounded-lg text-center">
                            <h3 className="text-lg font-semibold mb-4">الرجاء تحديد حالة الوليد لبدء التقييم:</h3>
                            <div className="flex justify-center gap-4">
                                <Button type="button" variant="success" size="lg" onClick={() => setFormToShow('breathing')}>
                                    طفل يتنفس طبيعياً
                                </Button>
                                <Button type="button" variant="danger" size="lg" onClick={() => setFormToShow('not_breathing')}>
                                    طفل لا يتنفس طبيعياً (يحتاج إنعاش)
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* عرض النموذج المختار */}
                    {formToShow && (
                        <div className="animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {formToShow === 'breathing' ? 'النموذج: طفل يتنفس طبيعياً' : 'النموذج: طفل لا يتنفس طبيعياً'}
                                </h2>
                                <Button type="button" variant="secondary" onClick={() => setFormToShow(null)}>تغيير الاختيار</Button>
                            </div>

                            {renderChecklist('1. تحضيرات ما قبل الولادة', PREPARATION_ITEMS)}
                            {renderChecklist('2. التجفيف، التحفيز، التدفئة والشفط', DRYING_STIMULATION_ITEMS)}
                            
                            {formToShow === 'breathing' && (
                                renderChecklist('3. متابعة طفل يتنفس طبيعياً', NORMAL_BREATHING_ITEMS)
                            )}
                            
                            {formToShow === 'not_breathing' && (
                                renderChecklist('3. إنعاش الوليد (الدقيقة الذهبية)', RESUSCITATION_ITEMS)
                            )}

                            {/* ملاحظات */}
                            <FormGroup label="ملاحظات عامة" className="text-right mt-6">
                                <Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={4} placeholder="أضف أي ملاحظات إضافية..." />
                            </FormGroup>
                        </div>
                    )}
                </div>

                {/* أزرار الحفظ */}
                <div className="flex gap-2 p-4 border-t bg-gray-50 sticky bottom-0 z-10 justify-end">
                    <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving}> إلغاء </Button>
                    <Button type="button" variant="outline" onClick={() => handleSubmit('draft')} disabled={isSaving || !formToShow}>
                        {isSaving ? 'جاري الحفظ...' : 'حفظ كمسودة'}
                    </Button>
                    <Button type="submit" disabled={isSaving || !formToShow}> 
                        {isSaving ? 'جاري الحفظ...' : 'حفظ وإكمال الجلسة'} 
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export default EENCSkillsAssessmentForm;