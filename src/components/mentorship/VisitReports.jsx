// VisitReports.jsx
// This file contains components for both IMNCI and EENC visit reports.

import React, { useState, useMemo, Suspense } from 'react';
import { getAuth } from "firebase/auth";
import { Timestamp } from 'firebase/firestore';
// --- (MODIFIED) Import both save functions ---
import { 
    uploadFile, 
    deleteFile, 
    saveIMNCIVisitReport, 
    saveEENCVisitReport 
} from '../data.js';
import { 
    Card, 
    PageHeader, 
    Button, 
    FormGroup, 
    Spinner, 
    Input, 
    Textarea, 
} from '../CommonComponents';
import { PlusCircle, Trash2, Camera } from 'lucide-react';

// --- 1: IMNCI Visit Report Component ---
// --- (MODIFIED) Using named export ---
export const IMNCIVisitReport = ({ facility, onCancel, setToast, allSubmissions, existingReportData = null }) => {
    const auth = getAuth();
    const user = auth.currentUser;

    const getInitialState = () => {
        if (existingReportData) {
            return {
                visit_date: existingReportData.visit_date || new Date().toISOString().split('T')[0],
                trained_skills: existingReportData.trained_skills || {},
                other_orientations: existingReportData.other_orientations || {},
                challenges_table: existingReportData.challenges_table || [{ id: 1, problem: '', immediate_solution: '', long_term_solution: '', responsible_person: '' }],
                imageUrls: existingReportData.imageUrls || [], 
                notes: existingReportData.notes || '',
            };
        }
        return {
            visit_date: new Date().toISOString().split('T')[0],
            trained_skills: {},
            other_orientations: {},
            challenges_table: [{ id: 1, problem: '', immediate_solution: '', long_term_solution: '', responsible_person: '' }],
            imageUrls: [],
            notes: '',
        };
    };

    const [formData, setFormData] = useState(getInitialState());
    const [newImageFiles, setNewImageFiles] = useState([]); 
    const [isSaving, setIsSaving] = useState(false);

    // Filter sessions for this facility and visit date (IMNCI)
    const sessionsForThisVisit = useMemo(() => {
        if (!allSubmissions || !facility || !formData.visit_date) return [];
        return allSubmissions.filter(
            sub => sub.facilityId === facility.id &&
                   sub.sessionDate === formData.visit_date &&
                   sub.service === 'IMNCI' && // Only IMNCI Skills sessions
                   sub.status === 'complete' // Only completed sessions
        );
    }, [allSubmissions, facility, formData.visit_date]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (group, key) => {
        setFormData(prev => ({
            ...prev,
            [group]: {
                ...prev[group],
                [key]: !prev[group][key]
            }
        }));
    };

    const handleChallengeChange = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            challenges_table: prev.challenges_table.map(row =>
                row.id === id ? { ...row, [field]: value } : row
            )
        }));
    };

    const addChallengeRow = () => {
        setFormData(prev => ({
            ...prev,
            challenges_table: [
                ...prev.challenges_table,
                { id: Date.now(), problem: '', immediate_solution: '', long_term_solution: '', responsible_person: '' }
            ]
        }));
    };

    const removeChallengeRow = (id) => {
        setFormData(prev => ({
            ...prev,
            challenges_table: prev.challenges_table.filter(row => row.id !== id)
        }));
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setNewImageFiles(prevFiles => [...prevFiles, ...newFiles]);
            e.target.value = null; // Clear input
        }
    };

    const removeExistingImage = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            imageUrls: prev.imageUrls.filter((_, index) => index !== indexToRemove)
        }));
    };

    const removeNewImage = (indexToRemove) => {
        setNewImageFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // 1. Identify URLs to delete from Firebase
            const originalUrls = existingReportData?.imageUrls || [];
            const currentUrls = formData.imageUrls;
            const urlsToDelete = originalUrls.filter(url => !currentUrls.includes(url));
            
            for (const url of urlsToDelete) {
                try {
                    await deleteFile(url);
                } catch (delError) {
                    console.warn("Failed to delete old image, continuing...", delError);
                }
            }

            // 2. Upload NEW files (from newImageFiles)
            const newUploadedUrls = [];
            const validNewFiles = newImageFiles.filter(file => file); 
            for (const file of validNewFiles) {
                const newUrl = await uploadFile(file);
                newUploadedUrls.push(newUrl);
            }

            // 3. Combine final list of URLs
            const finalImageUrls = [...currentUrls, ...newUploadedUrls];

            // 4. Prepare payload
            const payload = {
                ...formData,
                imageUrls: finalImageUrls, 
                facilityId: facility.id,
                facilityName: facility['اسم_المؤسسة'],
                state: facility['الولاية'],
                locality: facility['المحلية'],
                mentorEmail: user.email,
                mentorName: user.displayName || user.email,
                ...(existingReportData ? { lastUpdatedAt: Timestamp.now() } : { createdAt: Timestamp.now() })
            };
            
            delete payload.imageUrl; 

            // 5. Save report (IMNCI)
            await saveIMNCIVisitReport(payload, existingReportData?.id || null);
            setToast({ show: true, message: 'تم حفظ تقرير الزيارة بنجاح!', type: 'success' });
            onCancel(); // Close modal/form and trigger refresh

        } catch (error) {
            console.error("Error saving visit report:", error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // Data for IMNCI checkboxes
    const skillsList = {
        skill_weight: "قياس الوزن",
        skill_height: "قياس الطول",
        skill_temp: "قياس الحرارة",
        skill_rr: "قياس معدل التنفس",
        skill_muac: "قياس محيط منتصف الذراع",
        skill_wfh: "قياس الانحراف المعياري للطول بالنسبة للوزن",
        skill_edema: "تقييم الورم",
        skill_danger_signs: "التعرف على علامات الخطورة",
        skill_chartbook: "استخدام كتيب اللوحات للتقييم والتصنيف والعلاج",
        skill_counseling_card: "استخدام كرت نصح وارشاد الأم",
        skill_immunization_referral: "اكتشاف وتحويل سواقط التطعيم",
    };

    const orientationsList = {
        orient_nutrition: "تنوير مسئول التغذية عن العلاج المتكامل",
        orient_epi: "تنوير مسئول التحصين عن العلاج المتكامل",
        orient_stats: "تنوير مسئول الاحصاء عن العلاج المتكامل",
        orient_pharmacy: "تنوير مسئول الصيدلية عن العلاج المتكامل",
    };

    return (
        <Suspense fallback={<div className="p-8"><Spinner /></div>}>
            <Card dir="rtl">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 text-right">
                        
                        <div className="flex justify-center">
                            <PageHeader
                                title="تقرير زيارة العلاج المتكامل"
                                subtitle={`المنشأة: ${facility['اسم_المؤسسة']} | ${facility['المحلية']}, ${facility['الولاية']}`}
                            />
                        </div>

                        <div className="max-w-xs mb-4 ms-auto">
                            <FormGroup label="تاريخ الزيارة" className="text-right">
                                <Input
                                    type="date"
                                    name="visit_date"
                                    value={formData.visit_date}
                                    onChange={handleFormChange}
                                    required
                                    className="text-right" 
                                />
                            </FormGroup>
                        </div>

                        {/* Mentored Staff List */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">الكوادر التي تم الإشراف عليها في هذا التاريخ</h3>
                            {sessionsForThisVisit.length === 0 ? (
                                <p className="text-gray-600">لا توجد جلسات إشراف مكتملة مسجلة لهذه المنشأة في هذا التاريخ.</p>
                            ) : (
                                <ul className="list-disc pr-6 space-y-1">
                                    {sessionsForThisVisit.map(session => {
                                        const score = session.scores?.overallScore_score;
                                        const maxScore = session.scores?.overallScore_maxScore;
                                        const percentage = (maxScore > 0) ? Math.round((score / maxScore) * 100) : 'N_A';
                                        return (
                                            <li key={session.id} className="text-sm">
                                                <span className="font-semibold">{session.staff}</span>
                                                <span className="mr-2 text-gray-700">(الدرجة: {percentage}%)</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Trained Skills */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المهارات التي تم التدريب عليها</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                {Object.entries(skillsList).map(([key, label]) => (
                                    <label 
                                        htmlFor={`skill_${key}`} 
                                        key={key} 
                                        className="cursor-pointer"
                                    >
                                        <span>{label}</span>
                                        <input
                                            type="checkbox"
                                            id={`skill_${key}`}
                                            checked={!!formData.trained_skills[key]}
                                            onChange={() => handleCheckboxChange('trained_skills', key)}
                                            className="ms-3" 
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Other Orientations */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">تنوير الأقسام الأخرى</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                {Object.entries(orientationsList).map(([key, label]) => (
                                    <label 
                                        htmlFor={`orient_${key}`} 
                                        key={key} 
                                        className="cursor-pointer"
                                    >
                                        <span>{label}</span>
                                        <input
                                            type="checkbox"
                                            id={`orient_${key}`}
                                            checked={!!formData.other_orientations[key]}
                                            onChange={() => handleCheckboxChange('other_orientations', key)}
                                            className="ms-3"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Challenges Table */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المشاكل والمعوقات والحلول</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-2 py-2 border border-gray-300 text-right">المسئول (بعيدة المدى)</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right">الحلول بعيدة المدى</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right">الحلول الانية</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right">المشاكل والمعوقات</th>
                                            <th className="px-2 py-2 border border-gray-300"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.challenges_table.map((row, index) => (
                                            <tr key={row.id}>
                                                <td className="border border-gray-300"><Textarea value={row.responsible_person} onChange={(e) => handleChallengeChange(row.id, 'responsible_person', e.target.value)} rows={2} className="w-full text-right" /></td>
                                                <td className="border border-gray-300"><Textarea value={row.long_term_solution} onChange={(e) => handleChallengeChange(row.id, 'long_term_solution', e.target.value)} rows={2} className="w-full text-right" /></td>
                                                <td className="border border-gray-300"><Textarea value={row.immediate_solution} onChange={(e) => handleChallengeChange(row.id, 'immediate_solution', e.target.value)} rows={2} className="w-full text-right" /></td>
                                                <td className="border border-gray-300"><Textarea value={row.problem} onChange={(e) => handleChallengeChange(row.id, 'problem', e.target.value)} rows={2} className="w-full text-right" /></td>
                                                <td className="border border-gray-300 text-center">
                                                    {index > 0 && (
                                                        <Button type="button" variant="danger" size="sm" onClick={() => removeChallengeRow(row.id)}>
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-start"> {/* justify-start = right in RTL */}
                                <Button type="button" variant="outline" size="sm" onClick={addChallengeRow} className="mt-2 flex items-center gap-1">
                                    <PlusCircle size={16} /> إضافة صف
                                 </Button>
                            </div>
                        </div>

                        {/* Image Documentation (Multiple) */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">توثيق الصور</h3>
                            
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                
                                {formData.imageUrls.map((url, index) => (
                                    <div key={index} className="relative group border rounded-lg overflow-hidden">
                                        <img src={url} alt={`Existing ${index + 1}`} className="w-full h-32 object-cover" />
                                        <Button 
                                            type="button" 
                                            variant="danger" 
                                            size="sm"
                                            onClick={() => removeExistingImage(index)}
                                            className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                ))}

                                {newImageFiles.map((file, index) => (
                                    file && (
                                        <div key={index} className="relative group border rounded-lg overflow-hidden">
                                            <img src={URL.createObjectURL(file)} alt={`New ${index + 1}`} className="w-full h-32 object-cover" />
                                            <Button 
                                                type="button" 
                                                variant="danger" 
                                                size="sm"
                                                onClick={() => removeNewImage(index)}
                                                className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    )
                                ))}

                                <label 
                                    htmlFor="photo-upload-imnci" // --- Unique ID
                                    className="flex flex-col justify-center items-center w-full h-32 px-4 py-6 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-sky-500 bg-gray-50"
                                >
                                    <div className="text-center">
                                        <Camera className="mx-auto h-8 w-8 text-gray-400" />
                                        <p className="mt-1 text-sm text-gray-600">
                                            إضافة صورة
                                        </p>
                                        <Input 
                                            id="photo-upload-imnci" // --- Unique ID
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleImageChange}
                                            className="sr-only"
                                            multiple
                                        />
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        {/* Notes */}
                        <div className="mb-6">
                             <FormGroup label="ملاحظات إضافية" className="text-right">
                                <Textarea 
                                    name="notes" 
                                    value={formData.notes} 
                                    onChange={handleFormChange}
                                    rows={4} 
                                    placeholder="أضف أي ملاحظات إضافية..." 
                                    className="text-right placeholder:text-right" 
                                />
                             </FormGroup>
                        </div>

                    </div>

                    {/* Button Bar */}
                    <div className="flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                        <div className="flex gap-2 flex-wrap justify-start">
                            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}> إلغاء </Button>
                            <Button type="submit" disabled={isSaving}> 
                                {isSaving ? 'جاري الحفظ...' : (existingReportData ? 'تحديث التقرير' : 'حفظ التقرير')}
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>
        </Suspense>
    );
};


// -----------------------------------------------------------------
// -----------------------------------------------------------------


// --- 2: EENC Visit Report Component ---
// --- (MODIFIED) Using named export ---
export const EENCVisitReport = ({ facility, onCancel, setToast, allSubmissions, existingReportData = null }) => {
    const auth = getAuth();
    const user = auth.currentUser;

    const getInitialState = () => {
        if (existingReportData) {
            return {
                visit_date: existingReportData.visit_date || new Date().toISOString().split('T')[0],
                trained_skills: existingReportData.trained_skills || {},
                other_orientations: existingReportData.other_orientations || {},
                challenges_table: existingReportData.challenges_table || [{ id: 1, problem: '', immediate_solution: '', long_term_solution: '', responsible_person: '' }],
                imageUrls: existingReportData.imageUrls || [], 
                notes: existingReportData.notes || '',
            };
        }
        return {
            visit_date: new Date().toISOString().split('T')[0],
            trained_skills: {},
            other_orientations: {},
            challenges_table: [{ id: 1, problem: '', immediate_solution: '', long_term_solution: '', responsible_person: '' }],
            imageUrls: [],
            notes: '',
        };
    };

    const [formData, setFormData] = useState(getInitialState());
    const [newImageFiles, setNewImageFiles] = useState([]); 
    const [isSaving, setIsSaving] = useState(false);

    // Filter sessions for this facility and visit date (EENC)
    const sessionsForThisVisit = useMemo(() => {
        if (!allSubmissions || !facility || !formData.visit_date) return [];
        return allSubmissions.filter(
            sub => sub.facilityId === facility.id &&
                   sub.sessionDate === formData.visit_date &&
                   sub.service === 'EENC' && // Only EENC Skills sessions
                   sub.status === 'complete' // Only completed sessions
        );
    }, [allSubmissions, facility, formData.visit_date]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (group, key) => {
        setFormData(prev => ({
            ...prev,
            [group]: {
                ...prev[group],
                [key]: !prev[group][key]
            }
        }));
    };

    const handleChallengeChange = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            challenges_table: prev.challenges_table.map(row =>
                row.id === id ? { ...row, [field]: value } : row
            )
        }));
    };

    const addChallengeRow = () => {
        setFormData(prev => ({
            ...prev,
            challenges_table: [
                ...prev.challenges_table,
                { id: Date.now(), problem: '', immediate_solution: '', long_term_solution: '', responsible_person: '' }
            ]
        }));
    };

    const removeChallengeRow = (id) => {
        setFormData(prev => ({
            ...prev,
            challenges_table: prev.challenges_table.filter(row => row.id !== id)
        }));
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setNewImageFiles(prevFiles => [...prevFiles, ...newFiles]);
            e.target.value = null; 
        }
    };

    const removeExistingImage = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            imageUrls: prev.imageUrls.filter((_, index) => index !== indexToRemove)
        }));
    };

    const removeNewImage = (indexToRemove) => {
        setNewImageFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // 1. Identify URLs to delete
            const originalUrls = existingReportData?.imageUrls || [];
            const currentUrls = formData.imageUrls;
            const urlsToDelete = originalUrls.filter(url => !currentUrls.includes(url));
            
            for (const url of urlsToDelete) {
                try {
                    await deleteFile(url);
                } catch (delError) {
                    console.warn("Failed to delete old image, continuing...", delError);
                }
            }

            // 2. Upload NEW files
            const newUploadedUrls = [];
            const validNewFiles = newImageFiles.filter(file => file); 
            for (const file of validNewFiles) {
                const newUrl = await uploadFile(file);
                newUploadedUrls.push(newUrl);
            }

            // 3. Combine final list of URLs
            const finalImageUrls = [...currentUrls, ...newUploadedUrls];

            // 4. Prepare payload
            const payload = {
                ...formData,
                imageUrls: finalImageUrls, 
                facilityId: facility.id,
                facilityName: facility['اسم_المؤسسة'],
                state: facility['الولاية'],
                locality: facility['المحلية'],
                mentorEmail: user.email,
                mentorName: user.displayName || user.email,
                ...(existingReportData ? { lastUpdatedAt: Timestamp.now() } : { createdAt: Timestamp.now() })
            };
            
            delete payload.imageUrl; 

            // 5. Save report (EENC)
            await saveEENCVisitReport(payload, existingReportData?.id || null);
            setToast({ show: true, message: 'تم حفظ تقرير الزيارة بنجاح!', type: 'success' });
            onCancel(); 

        } catch (error) {
            console.error("Error saving visit report:", error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // Data for EENC checkboxes
    const skillsList = {
        skill_pre_handwash: "تجهيزات ما قبل : غسل الايدي",
        skill_pre_equip: "تجهيز معدات الانعاش قبل الولادة",
        skill_drying: "التجفيف الجيد للطفل",
        skill_skin_to_skin: "وضع الطفل ملتصقا ببطن أمه",
        skill_suction: "شفط السواءل بالعصفورة عند الحوجة",
        skill_cord_pulse_check: "التاكد من توقف نبض الحبل السري",
        skill_clamp_placement: "وضع المشبك في المكان المناسب بعد توقف النبض",
        skill_transfer: "نقل الطفل سريعا لمنطقة الانعاش مع تغطيته",
        skill_airway: "استعدال الراس لفتح مجرى الهواء",
        skill_ambubag_placement: "وضع الامبوباق بصورة صحيحة",
        skill_ambubag_use: "استخدام الامبوباق لرفع الصدر بالهواء خلال دقيقة من الولادة",
        skill_ventilation_rate: "اعطاء 30 -60 نفس بالدقيقة",
        skill_correction_steps: "اجراءات التدخلات التصحيحية لضمان دحول الهواء بالصدر",
    };

    const orientationsList = {
        orient_infection_control: "قسم مكافحة العدوى",
        orient_nicu: "قسم الحضانة",
        orient_stats: "قسم الاحصاء والمعلومات",
        orient_nutrition: "قسم التغذية عن الرعاية الضرورية المبكرة للاطفال حديث الولادة",
    };

    return (
        <Suspense fallback={<div className="p-8"><Spinner /></div>}>
            <Card dir="rtl">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 text-right">
                        
                        <div className="flex justify-center">
                            <PageHeader
                                title="تقرير زيارة الرعاية الضرورية المبكرة (EENC)"
                                subtitle={`المنشأة: ${facility['اسم_المؤسسة']} | ${facility['المحلية']}, ${facility['الولاية']}`}
                            />
                        </div>

                        <div className="max-w-xs mb-4 ms-auto">
                            <FormGroup label="تاريخ الزيارة" className="text-right">
                                <Input
                                    type="date"
                                    name="visit_date"
                                    value={formData.visit_date}
                                    onChange={handleFormChange}
                                    required
                                    className="text-right" 
                                />
                            </FormGroup>
                        </div>

                        {/* Mentored Staff List */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">الكوادر التي تم الإشراف عليها في هذا التاريخ</h3>
                            {sessionsForThisVisit.length === 0 ? (
                                <p className="text-gray-600">لا توجد جلسات إشراف مكتملة مسجلة لهذه المنشأة في هذا التاريخ.</p>
                            ) : (
                                <ul className="list-disc pr-6 space-y-1">
                                    {sessionsForThisVisit.map(session => {
                                        const score = session.scores?.overallScore_score;
                                        const maxScore = session.scores?.overallScore_maxScore;
                                        const percentage = (maxScore > 0) ? Math.round((score / maxScore) * 100) : 'N_A';
                                        return (
                                            <li key={session.id} className="text-sm">
                                                <span className="font-semibold">{session.staff}</span>
                                                <span className="mr-2 text-gray-700">(الدرجة: {percentage}%)</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Trained Skills */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المهارات التي تم التدريب عليها</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                {Object.entries(skillsList).map(([key, label]) => (
                                    <label 
                                        htmlFor={`skill_${key}`} 
                                        key={key} 
                                        className="cursor-pointer"
                                    >
                                        <span>{label}</span>
                                        <input
                                            type="checkbox"
                                            id={`skill_${key}`}
                                            checked={!!formData.trained_skills[key]}
                                            onChange={() => handleCheckboxChange('trained_skills', key)}
                                            className="ms-3" 
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Other Orientations */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">تنوير الأقسام الأخرى</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                {Object.entries(orientationsList).map(([key, label]) => (
                                    <label 
                                        htmlFor={`orient_${key}`} 
                                        key={key} 
                                        className="cursor-pointer"
                                    >
                                        <span>{label}</span>
                                        <input
                                            type="checkbox"
                                            id={`orient_${key}`}
                                            checked={!!formData.other_orientations[key]}
                                            onChange={() => handleCheckboxChange('other_orientations', key)}
                                            className="ms-3"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Challenges Table */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المشاكل والمعوقات والحلول</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-2 py-2 border border-gray-300 text-right">المسئول (بعيدة المدى)</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right">الحلول بعيدة المدى</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right">الحلول الانية</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right">المشاكل والمعوقات</th>
                                            <th className="px-2 py-2 border border-gray-300"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.challenges_table.map((row, index) => (
                                            <tr key={row.id}>
                                                <td className="border border-gray-300"><Textarea value={row.responsible_person} onChange={(e) => handleChallengeChange(row.id, 'responsible_person', e.target.value)} rows={2} className="w-full text-right" /></td>
                                                <td className="border border-gray-300"><Textarea value={row.long_term_solution} onChange={(e) => handleChallengeChange(row.id, 'long_term_solution', e.target.value)} rows={2} className="w-full text-right" /></td>
                                                <td className="border border-gray-300"><Textarea value={row.immediate_solution} onChange={(e) => handleChallengeChange(row.id, 'immediate_solution', e.target.value)} rows={2} className="w-full text-right" /></td>
                                                <td className="border border-gray-300"><Textarea value={row.problem} onChange={(e) => handleChallengeChange(row.id, 'problem', e.target.value)} rows={2} className="w-full text-right" /></td>
                                                <td className="border border-gray-300 text-center">
                                                    {index > 0 && (
                                                        <Button type="button" variant="danger" size="sm" onClick={() => removeChallengeRow(row.id)}>
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-start">
                                <Button type="button" variant="outline" size="sm" onClick={addChallengeRow} className="mt-2 flex items-center gap-1">
                                    <PlusCircle size={16} /> إضافة صف
                                 </Button>
                            </div>
                        </div>

                        {/* Image Documentation */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">توثيق الصور</h3>
                            
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                
                                {formData.imageUrls.map((url, index) => (
                                    <div key={index} className="relative group border rounded-lg overflow-hidden">
                                        <img src={url} alt={`Existing ${index + 1}`} className="w-full h-32 object-cover" />
                                        <Button 
                                            type="button" 
                                            variant="danger" 
                                            size="sm"
                                            onClick={() => removeExistingImage(index)}
                                            className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                ))}

                                {newImageFiles.map((file, index) => (
                                    file && (
                                        <div key={index} className="relative group border rounded-lg overflow-hidden">
                                            <img src={URL.createObjectURL(file)} alt={`New ${index + 1}`} className="w-full h-32 object-cover" />
                                            <Button 
                                                type="button" 
                                                variant="danger" 
                                                size="sm"
                                                onClick={() => removeNewImage(index)}
                                                className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    )
                                ))}

                                <label 
                                    htmlFor="photo-upload-eenc" // --- Unique ID
                                    className="flex flex-col justify-center items-center w-full h-32 px-4 py-6 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-sky-500 bg-gray-50"
                                >
                                    <div className="text-center">
                                        <Camera className="mx-auto h-8 w-8 text-gray-400" />
                                        <p className="mt-1 text-sm text-gray-600">
                                            إضافة صورة
                                        </p>
                                        <Input 
                                            id="photo-upload-eenc" // --- Unique ID
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleImageChange}
                                            className="sr-only"
                                            multiple
                                        />
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        {/* Notes */}
                        <div className="mb-6">
                             <FormGroup label="ملاحظات إضافية" className="text-right">
                                <Textarea 
                                    name="notes" 
                                    value={formData.notes} 
                                    onChange={handleFormChange}
                                    rows={4} 
                                    placeholder="أضف أي ملاحظات إضافية..." 
                                    className="text-right placeholder:text-right" 
                                />
                             </FormGroup>
                        </div>

                    </div>

                    {/* Button Bar */}
                    <div className="flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                        <div className="flex gap-2 flex-wrap justify-start">
                            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}> إلغاء </Button>
                            <Button type="submit" disabled={isSaving}> 
                                {isSaving ? 'جاري الحفظ...' : (existingReportData ? 'تحديث التقرير' : 'حفظ التقرير')}
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>
        </Suspense>
    );
};

// --- (REMOVED) No default export needed when using named exports ---