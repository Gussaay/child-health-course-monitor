// EENCMothersForm.jsx
import React, { useState } from 'react';
import { saveMentorshipSession } from "../data.js"; // افترض استيراد دالة الحفظ
import { Timestamp } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Spinner
} from './CommonComponents'; // افترض استيراد المكونات الأساسية

// --- مكون فرعي لأسئلة نعم/لا ---
const YesNoQuestion = ({ label, value, onChange }) => (
    <FormGroup label={label} className="p-3 border rounded-lg bg-white flex flex-col md:flex-row justify-between md:items-center">
        <span className="font-medium text-gray-700 mb-2 md:mb-0">{label}</span>
        <div className="flex gap-4" dir="ltr">
            <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" value="yes" checked={value === 'yes'} onChange={onChange} className="form-radio text-sky-600" />
                <span className="text-sm">نعم</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" value="no" checked={value === 'no'} onChange={onChange} className="form-radio text-gray-500" />
                <span className="text-sm">لا</span>
            </label>
        </div>
    </FormGroup>
);

// --- المكون الأساسي للنموذج ---
const EENCMothersForm = ({ facility, onCancel, setToast }) => {
    const [formData, setFormData] = useState({
        session_date: new Date().toISOString().split('T')[0],
        motherName: '', // اسم الأم (جديد)
        childAge: '', // عمر الطفل (جديد)
        // جلد بجلد
        skin_to_skin_immediate: '',
        skin_to_skin_90min: '',
        // الرضاعة
        breastfed_first_hour: '',
        given_other_fluids: '',
        given_other_fluids_bottle: '',
        // رعاية الجلد والسرة
        given_vitamin_k: '',
        given_tetracycline: '',
        anything_on_cord: '',
        rubbed_with_oil: '',
        baby_bathed: '',
        // تطعيمات
        polio_zero_dose: '',
        bcg_dose: '',
        // قياسات
        baby_weighed: '',
        baby_temp_measured: '',
        // تسجيلات
        baby_registered: '',
        given_discharge_card: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const auth = getAuth();
    const user = auth.currentUser;

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const payload = {
            serviceType: 'EENC_MOTHERS', // نوع خدمة جديد
            state: facility?.['الولاية'] || null,
            locality: facility?.['المحلية'] || null,
            facilityId: facility?.id || null,
            facilityName: facility?.['اسم_المؤسسة'] || null,
            sessionDate: formData.session_date,
            effectiveDate: Timestamp.fromDate(new Date(formData.session_date)),
            status: 'complete',
            mentorEmail: user?.email || 'unknown',
            mentorName: user?.displayName || 'Unknown Mentor',
            // بيانات النموذج
            motherName: formData.motherName,
            childAge: formData.childAge,
            eencMothersData: { ...formData }, // حفظ كل البيانات
        };

        try {
            await saveMentorshipSession(payload);
            setToast({ show: true, message: 'تم حفظ استبيان الأم بنجاح!', type: 'success' });
            if (onCancel) onCancel(); // إغلاق النموذج بعد الحفظ
        } catch (error) {
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card dir="rtl">
            <form onSubmit={handleSubmit}>
                <PageHeader
                    title="استبيان الأمهات (الرعاية الضرورية EENC)"
                    subtitle={`يتم ملء هذا النموذج مع الأم في: ${facility?.['اسم_المؤسسة'] || '...'}`}
                />
                <div className="p-6 space-y-4">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 border rounded-lg bg-gray-50">
                        <FormGroup label="تاريخ الاستبيان">
                            <Input
                                type="date"
                                value={formData.session_date}
                                onChange={(e) => handleChange('session_date', e.target.value)}
                                required
                            />
                        </FormGroup>
                        <FormGroup label="اسم الأم (اختياري)">
                            <Input
                                type="text"
                                value={formData.motherName}
                                onChange={(e) => handleChange('motherName', e.target.value)}
                                placeholder="ادخل اسم الأم..."
                            />
                        </FormGroup>
                        <FormGroup label="عمر الطفل (اختياري)">
                            <Input
                                type="text"
                                value={formData.childAge}
                                onChange={(e) => handleChange('childAge', e.target.value)}
                                placeholder="مثال: يومان، أسبوع..."
                            />
                        </FormGroup>
                    </div>

                    {/* الأسئلة */}
                    <h3 className="text-lg font-semibold pt-4 border-b pb-2">1. وضع الطفل جلد بجلد</h3>
                    <YesNoQuestion label="هل تم وضع الطفل جلد بجلد مباشرة بعد الولادة؟" value={formData.skin_to_skin_immediate} onChange={(e) => handleChange('skin_to_skin_immediate', e.target.value)} />
                    <YesNoQuestion label="هل الطفل الان موضوع جلد بجلد أو تم وضعه جلد بجلد بصورة غير منقطعة مدة 90 دقيقة؟" value={formData.skin_to_skin_90min} onChange={(e) => handleChange('skin_to_skin_90min', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2">2. بدء الرضاعة الطبيعية</h3>
                    <YesNoQuestion label="هل أكمل الطفل رضعة كاملة خلال الساعة الأولى من الولادة؟" value={formData.breastfed_first_hour} onChange={(e) => handleChange('breastfed_first_hour', e.target.value)} />
                    <YesNoQuestion label="هل تم إعطاء أي سوائل اخرى غير حليب الأم؟" value={formData.given_other_fluids} onChange={(e) => handleChange('given_other_fluids', e.target.value)} />
                    <YesNoQuestion label="هل تم إعطاء الطفل أي سائل اخر عن طريق البزة؟" value={formData.given_other_fluids_bottle} onChange={(e) => handleChange('given_other_fluids_bottle', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2">3. رعاية الجلد والعين والسرة</h3>
                    <YesNoQuestion label="هل تم إعطاء الطفل فيتامين ك ؟" value={formData.given_vitamin_k} onChange={(e) => handleChange('given_vitamin_k', e.target.value)} />
                    <YesNoQuestion label="هل تم إعطاء الطفل جرعة تتراسيكلين للعين ؟" value={formData.given_tetracycline} onChange={(e) => handleChange('given_tetracycline', e.target.value)} />
                    <YesNoQuestion label="هل تم وضع أي مادة على السرة ؟" value={formData.anything_on_cord} onChange={(e) => handleChange('anything_on_cord', e.target.value)} />
                    <YesNoQuestion label="هل تم مسح الطفل باي نوع من الزيوت ؟" value={formData.rubbed_with_oil} onChange={(e) => handleChange('rubbed_with_oil', e.target.value)} />
                    <YesNoQuestion label="هل تم استحمام الطفل ؟" value={formData.baby_bathed} onChange={(e) => handleChange('baby_bathed', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2">4. تطعيمات الطفل</h3>
                    <YesNoQuestion label="هل تم تطعيم الطفل الجرعة الصفرية للشلل الفموي ؟" value={formData.polio_zero_dose} onChange={(e) => handleChange('polio_zero_dose', e.target.value)} />
                    <YesNoQuestion label="هل تم تطعيم الطفل جرعة الدرن ؟" value={formData.bcg_dose} onChange={(e) => handleChange('bcg_dose', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2">5. قياسات الطفل</h3>
                    <YesNoQuestion label="هل تم وزن الطفل ؟" value={formData.baby_weighed} onChange={(e) => handleChange('baby_weighed', e.target.value)} />
                    <YesNoQuestion label="هل تم قياس درجة حرارة الطفل ؟" value={formData.baby_temp_measured} onChange={(e) => handleChange('baby_temp_measured', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2">6. تسجيلات الطفل</h3>
                    <YesNoQuestion label="هل تم تسجيل الطفل في السجل المدني؟" value={formData.baby_registered} onChange={(e) => handleChange('baby_registered', e.target.value)} />
                    <YesNoQuestion label="هل تم إعطاء الطفل كرت الخروج؟" value={formData.given_discharge_card} onChange={(e) => handleChange('given_discharge_card', e.target.value)} />

                </div>

                <div className="flex gap-2 p-4 border-t bg-gray-50 justify-end">
                    <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
                        إلغاء
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Spinner size="sm" /> : 'حفظ الاستبيان'}
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export default EENCMothersForm;