// EENCMothersForm.jsx
import React, { useState } from 'react';
import { saveMentorshipSession } from "../data.js"; // Assuming data.js
import { Timestamp } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Spinner
} from './CommonComponents'; // Assuming CommonComponents.js

// --- Reusable Yes/No Question Component (RTL) ---
const YesNoQuestion = ({ label, value, onChange }) => (
    <FormGroup label="" className="p-3 border rounded-lg bg-white flex flex-col md:flex-row justify-between md:items-center">
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

// --- Main Form Component ---
const EENCMothersForm = ({ facility, onCancel, setToast }) => {
    const [formData, setFormData] = useState({
        session_date: new Date().toISOString().split('T')[0],
        motherName: '', // Mother's Name (Optional)
        childAge: '', // Child's Age (Optional)
        
        // From Source 3 & 4
        skin_to_skin_immediate: '', // هل تم وضع الطفل جلد بجلد مباشرة بعد الولادة
        skin_to_skin_90min: '', // هل الطفل الان موضوع جلد بجلد أو تم وضعه جلد بجلد بصورة غير منقطعة مدة 90 دقيقة
        breastfed_first_hour: '', // هل أكمل الطفل رضعة كاملة خلال الساعة الأولى من الولادة
        given_other_fluids: '', // هل تم إعطاء أي سوائل اخرى غير حليب الأم
        given_other_fluids_bottle: '', // هل تم إعطاء الطفل أي سائل اخر عن طريق البزة
        given_vitamin_k: '', // هل تم إعطاء الطفل فيتامين ك ؟
        given_tetracycline: '', // هل تم إعطاء الطفل جرعة تتراسيكلين للعين ؟
        anything_on_cord: '', // هل تم وضع أي مادة على السرة ؟
        rubbed_with_oil: '', // هل تم مسح الطفل باي نوع من الزيوت ؟
        baby_bathed: '', // هل تم استحمام الطفل ؟
        polio_zero_dose: '', // هل تم تطعيم الطفل الجرعة الصفرية للشلل الفموي ؟
        bcg_dose: '', // هل تم تطعيم الطفل جرعة الدرن ؟
        baby_weighed: '', // هل تم وزن الطفل ؟
        baby_temp_measured: '', // هل تم قياس درجة حرارة الطفل ؟
        baby_registered: '', // هل تم تسجيل الطفل في السجل المدني
        given_discharge_card: '', // هل تم إعطاء الطفل كرت الخروج
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
            serviceType: 'EENC_MOTHERS', // New service type for EENC Mothers
            state: facility?.['الولاية'] || null,
            locality: facility?.['المحلية'] || null,
            facilityId: facility?.id || null,
            facilityName: facility?.['اسم_المؤسسة'] || null,
            sessionDate: formData.session_date,
            effectiveDate: Timestamp.fromDate(new Date(formData.session_date)),
            status: 'complete',
            mentorEmail: user?.email || 'unknown',
            mentorName: user?.displayName || 'Unknown Mentor',
            
            // Form Data
            motherName: formData.motherName,
            childAge: formData.childAge,
            eencMothersData: { ...formData }, // Save all collected data
        };

        try {
            await saveMentorshipSession(payload);
            setToast({ show: true, message: 'تم حفظ استبيان الأم بنجاح!', type: 'success' });
            if (onCancel) onCancel(); // Close form on success
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
                        <FormGroup label="تاريخ الاستبيان" className="text-right">
                            <Input
                                type="date"
                                value={formData.session_date}
                                onChange={(e) => handleChange('session_date', e.target.value)}
                                required
                            />
                        </FormGroup>
                        <FormGroup label="اسم الأم (اختياري)" className="text-right">
                            <Input
                                type="text"
                                value={formData.motherName}
                                onChange={(e) => handleChange('motherName', e.target.value)}
                                placeholder="ادخل اسم الأم..."
                            />
                        </FormGroup>
                        <FormGroup label="عمر الطفل (اختياري)" className="text-right">
                            <Input
                                type="text"
                                value={formData.childAge}
                                onChange={(e) => handleChange('childAge', e.target.value)}
                                placeholder="مثال: يومان، أسبوع..."
                            />
                        </FormGroup>
                    </div>

                    {/* --- Questions from Source 3 & 4 --- */}
                    <h3 className="text-lg font-semibold pt-4 border-b pb-2 text-right">1. وضع الطفل جلد بجلد</h3>
                    <YesNoQuestion label="هل تم وضع الطفل جلد بجلد مباشرة بعد الولادة؟" value={formData.skin_to_skin_immediate} onChange={(e) => handleChange('skin_to_skin_immediate', e.target.value)} />
                    <YesNoQuestion label="هل الطفل الان موضوع جلد بجلد أو تم وضعه جلد بجلد بصورة غير منقطعة مدة 90 دقيقة؟" value={formData.skin_to_skin_90min} onChange={(e) => handleChange('skin_to_skin_90min', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2 text-right">2. بدء الرضاعة الطبيعية</h3>
                    <YesNoQuestion label="هل أكمل الطفل رضعة كاملة خلال الساعة الأولى من الولادة؟" value={formData.breastfed_first_hour} onChange={(e) => handleChange('breastfed_first_hour', e.target.value)} />
                    <YesNoQuestion label="هل تم إعطاء أي سوائل اخرى غير حليب الأم؟" value={formData.given_other_fluids} onChange={(e) => handleChange('given_other_fluids', e.target.value)} />
                    <YesNoQuestion label="هل تم إعطاء الطفل أي سائل اخر عن طريق البزة؟" value={formData.given_other_fluids_bottle} onChange={(e) => handleChange('given_other_fluids_bottle', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2 text-right">3. رعاية الجلد والعين والسرة</h3>
                    <YesNoQuestion label="هل تم إعطاء الطفل فيتامين ك ؟" value={formData.given_vitamin_k} onChange={(e) => handleChange('given_vitamin_k', e.target.value)} />
                    <YesNoQuestion label="هل تم إعطاء الطفل جرعة تتراسيكلين للعين ؟" value={formData.given_tetracycline} onChange={(e) => handleChange('given_tetracycline', e.target.value)} />
                    <YesNoQuestion label="هل تم وضع أي مادة على السرة ؟" value={formData.anything_on_cord} onChange={(e) => handleChange('anything_on_cord', e.target.value)} />
                    <YesNoQuestion label="هل تم مسح الطفل باي نوع من الزيوت ؟" value={formData.rubbed_with_oil} onChange={(e) => handleChange('rubbed_with_oil', e.target.value)} />
                    <YesNoQuestion label="هل تم استحمام الطفل ؟" value={formData.baby_bathed} onChange={(e) => handleChange('baby_bathed', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2 text-right">4. تطعيمات الطفل</h3>
                    <YesNoQuestion label="هل تم تطعيم الطفل الجرعة الصفرية للشلل الفموي ؟" value={formData.polio_zero_dose} onChange={(e) => handleChange('polio_zero_dose', e.target.value)} />
                    <YesNoQuestion label="هل تم تطعيم الطفل جرعة الدرن ؟" value={formData.bcg_dose} onChange={(e) => handleChange('bcg_dose', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2 text-right">5. قياسات الطفل</h3>
                    <YesNoQuestion label="هل تم وزن الطفل ؟" value={formData.baby_weighed} onChange={(e) => handleChange('baby_weighed', e.target.value)} />
                    <YesNoQuestion label="هل تم قياس درجة حرارة الطفل ؟" value={formData.baby_temp_measured} onChange={(e) => handleChange('baby_temp_measured', e.target.value)} />

                    <h3 className="text-lg font-semibold pt-4 border-b pb-2 text-right">6. تسجيلات الطفل</h3>
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