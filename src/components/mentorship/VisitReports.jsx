// VisitReports.jsx
import React, { useState, useMemo, Suspense, useEffect } from 'react';
import { getAuth } from "firebase/auth";
import { Timestamp } from 'firebase/firestore';
import { 
    uploadFile, 
    deleteFile, 
    saveIMNCIVisitReport, 
    saveEENCVisitReport 
} from '../../data';
import { 
    Card, PageHeader, Button, FormGroup, Spinner, Input, Textarea, Select, Modal 
} from '../CommonComponents';
import { PlusCircle, Trash2, Camera, Save, Clock, CheckCircle } from 'lucide-react';

// --- Helper Component: Success Modal ---
const SuccessModal = ({ isOpen, onClose, message }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Success" size="sm">
            <div className="p-6 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">تم الحفظ بنجاح!</h3>
                <p className="text-gray-600 mb-6">{message}</p>
                <Button onClick={onClose} variant="primary" className="w-full justify-center">
                    موافق (OK)
                </Button>
            </div>
        </Modal>
    );
};

// --- Helper Component for Previous Problems ---
const PreviousProblemsTable = ({ reports, currentFacilityId, currentReportId, onUpdateStatus, serviceType }) => {
    const previousProblems = useMemo(() => {
        if (!reports) return [];
        const problems = [];
        reports.forEach(rep => {
            // Filter for same facility, older reports (or just different ID if editing)
            // Ensure we are looking at the correct service type if reports array is mixed
            if (rep.facilityId === currentFacilityId && rep.id !== currentReportId && rep.fullData?.challenges_table && rep.service === serviceType) {
                rep.fullData.challenges_table.forEach(ch => {
                    if (ch.problem) {
                        problems.push({
                            reportId: rep.id,
                            visitDate: rep.visitDate,
                            visitNumber: rep.visitNumber,
                            challengeId: ch.id, 
                            ...ch
                        });
                    }
                });
            }
        });
        // Sort by date descending (newest first)
        return problems.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
    }, [reports, currentFacilityId, currentReportId, serviceType]);

    if (previousProblems.length === 0) return null;

    return (
        <div className="mb-6 border-t pt-4">
            <h3 className="text-lg font-bold text-sky-800 mb-2 pb-1 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                المشاكل السابقة في هذه المنشأة (Previous Problems)
            </h3>
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-xs text-right bg-gray-50">
                    <thead className="bg-gray-200 font-bold text-gray-700">
                        <tr>
                            <th className="px-2 py-2 border w-1/6">التاريخ / الزيارة</th>
                            <th className="px-2 py-2 border w-1/3">المشكلة</th>
                            <th className="px-2 py-2 border w-1/6">المسؤول</th>
                            <th className="px-2 py-2 border w-1/6">الحالة المسجلة</th>
                            <th className="px-2 py-2 border w-1/6">تحديث الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {previousProblems.map((prob, idx) => (
                            <tr key={`${prob.reportId}_${prob.challengeId}_${idx}`} className="border-b hover:bg-white">
                                <td className="px-2 py-2 border align-top">
                                    <div className="font-semibold">{prob.visitDate}</div>
                                    <div className="text-gray-500 text-[10px]">زيارة رقم {prob.visitNumber}</div>
                                </td>
                                <td className="px-2 py-2 border align-top whitespace-pre-wrap">{prob.problem}</td>
                                <td className="px-2 py-2 border align-top">{prob.responsible_person}</td>
                                <td className="px-2 py-2 border align-top">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                        prob.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                                        prob.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {prob.status || 'Pending'}
                                    </span>
                                </td>
                                <td className="px-2 py-2 border align-top">
                                    <select
                                        className="w-full p-1 text-xs border rounded focus:ring-sky-500 focus:border-sky-500"
                                        defaultValue={prob.status || 'Pending'} 
                                        onChange={(e) => onUpdateStatus(prob.reportId, prob.challengeId, e.target.value, serviceType)}
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Resolved">Resolved</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- 1: IMNCI Visit Report Component ---
export const IMNCIVisitReport = ({ 
    facility, 
    onCancel, 
    setToast, 
    allSubmissions, 
    existingReportData = null, 
    visitNumber = 1, 
    allVisitReports = [],
    canEditVisitNumber = false 
}) => {
    const auth = getAuth();
    const user = auth.currentUser;

    const getInitialState = () => {
        const defaultRow = { 
            id: 1, 
            problem: '', 
            immediate_solution: '', 
            immediate_status: 'Pending', 
            long_term_solution: '', 
            long_term_status: 'Pending', 
            responsible_person: '' 
        };

        if (existingReportData) {
            return {
                visit_date: existingReportData.visit_date || new Date().toISOString().split('T')[0],
                visitNumber: existingReportData.visitNumber || visitNumber,
                trained_skills: existingReportData.trained_skills || {},
                other_orientations: existingReportData.other_orientations || {},
                challenges_table: existingReportData.challenges_table || [defaultRow],
                imageUrls: existingReportData.imageUrls || [], 
                notes: existingReportData.notes || '',
            };
        }
        return {
            visit_date: new Date().toISOString().split('T')[0],
            visitNumber: visitNumber,
            trained_skills: {},
            other_orientations: {},
            challenges_table: [defaultRow],
            imageUrls: [],
            notes: '',
        };
    };

    const [formData, setFormData] = useState(getInitialState());
    const [newImageFiles, setNewImageFiles] = useState([]); 
    const [isSaving, setIsSaving] = useState(false);
    const [previousUpdates, setPreviousUpdates] = useState({}); 
    const [showSuccessModal, setShowSuccessModal] = useState(false); // Success Modal State

    useEffect(() => {
        if (!existingReportData && visitNumber) {
            setFormData(prev => ({ ...prev, visitNumber: visitNumber }));
        }
    }, [visitNumber, existingReportData]);

    const sessionsForThisVisit = useMemo(() => {
        if (!allSubmissions || !facility || !formData.visit_date) return [];
        return allSubmissions.filter(sub => sub.facilityId === facility.id && sub.sessionDate === formData.visit_date && sub.service === 'IMNCI' && sub.status === 'complete');
    }, [allSubmissions, facility, formData.visit_date]);

    const handleFormChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleCheckboxChange = (group, key) => { setFormData(prev => ({ ...prev, [group]: { ...prev[group], [key]: !prev[group][key] } })); };

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
                { 
                    id: Date.now(), 
                    problem: '', 
                    immediate_solution: '', 
                    immediate_status: 'Pending',
                    long_term_solution: '', 
                    long_term_status: 'Pending',
                    responsible_person: '' 
                }
            ]
        }));
    };

    const removeChallengeRow = (id) => {
        setFormData(prev => ({ ...prev, challenges_table: prev.challenges_table.filter(row => row.id !== id) }));
    };

    const handleImageChange = (e) => { if (e.target.files) { setNewImageFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = null; } };
    const removeExistingImage = (i) => { setFormData(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, index) => index !== i) })); };
    const removeNewImage = (i) => { setNewImageFiles(prev => prev.filter((_, index) => index !== i)); };

    const handlePreviousStatusChange = (reportId, challengeId, newStatus, service) => {
        setPreviousUpdates(prev => ({
            ...prev,
            [`${reportId}_${challengeId}`]: { reportId, challengeId, newStatus, service }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // --- DUPLICATE CHECK ---
        if (!existingReportData) {
            const isDuplicate = allVisitReports.some(rep => 
                rep.facilityId === facility.id && 
                rep.visitDate === formData.visit_date && 
                rep.service === 'IMNCI'
            );

            if (isDuplicate) {
                setToast({ 
                    show: true, 
                    message: 'يوجد بالفعل تقرير زيارة IMNCI لهذه المنشأة في هذا التاريخ. يرجى تعديل التقرير الموجود بدلاً من إنشاء تقرير جديد.', 
                    type: 'error' 
                });
                return;
            }
        }
        // ------------------------

        setIsSaving(true);
        try {
            // 1. Save Current Report
            const originalUrls = existingReportData?.imageUrls || [];
            const currentUrls = formData.imageUrls;
            const urlsToDelete = originalUrls.filter(url => !currentUrls.includes(url));
            for (const url of urlsToDelete) { try { await deleteFile(url); } catch (e) { console.warn(e); } }

            const newUploadedUrls = [];
            for (const file of newImageFiles.filter(f => f)) { newUploadedUrls.push(await uploadFile(file)); }
            const finalImageUrls = [...currentUrls, ...newUploadedUrls];
            
            const payload = {
                ...formData,
                visitNumber: parseInt(formData.visitNumber) || 1,
                imageUrls: finalImageUrls,
                facilityId: facility.id,
                facilityName: facility['اسم_المؤسسة'],
                state: facility['الولاية'],
                locality: facility['المحلية'],
            };
            delete payload.imageUrl;

            if (existingReportData) {
                payload.mentorEmail = existingReportData.mentorEmail;
                payload.mentorName = existingReportData.mentorName;
                payload.edited_by_email = user.email;
                payload.edited_by_name = user.displayName || user.email;
                payload.lastUpdatedAt = Timestamp.now();
            } else {
                payload.mentorEmail = user.email;
                payload.mentorName = user.displayName || user.email;
                payload.createdAt = Timestamp.now();
            }

            await saveIMNCIVisitReport(payload, existingReportData?.id || null);

            // 2. Update Previous Reports (Batch-like)
            const updatePromises = Object.values(previousUpdates).map(async (update) => {
                const reportToUpdate = allVisitReports.find(r => r.id === update.reportId);
                if (reportToUpdate && reportToUpdate.fullData) {
                    const updatedChallenges = reportToUpdate.fullData.challenges_table.map(ch => 
                        ch.id === update.challengeId ? { ...ch, status: update.newStatus } : ch
                    );
                    const updatePayload = { 
                        ...reportToUpdate.fullData, 
                        challenges_table: updatedChallenges,
                        lastUpdatedAt: Timestamp.now()
                    };
                    const { id, ...cleanPayload } = updatePayload;
                    
                    if (update.service === 'IMNCI') await saveIMNCIVisitReport(cleanPayload, update.reportId);
                    else await saveEENCVisitReport(cleanPayload, update.reportId);
                }
            });

            await Promise.all(updatePromises);

            // Show Success Modal instead of immediate exit
            setShowSuccessModal(true);

        } catch (error) {
            console.error(error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseSuccessModal = () => {
        setShowSuccessModal(false);
        onCancel(); // Navigate back
    };

    const skillsList = { skill_weight: "قياس الوزن", skill_height: "قياس الطول", skill_temp: "قياس الحرارة", skill_rr: "قياس معدل التنفس", skill_muac: "قياس محيط منتصف الذراع", skill_wfh: "قياس الانحراف المعياري للطول بالنسبة للوزن", skill_edema: "تقييم الورم", skill_danger_signs: "علامات الخطورة", skill_chartbook: "استخدام كتيب اللوحات", skill_counseling_card: "استخدام كرت النصح", skill_immunization_referral: "سواقط التطعيم" };
    const orientationsList = { orient_nutrition: "تنوير مسئول التغذية", orient_epi: "تنوير مسئول التحصين", orient_stats: "تنوير مسئول الاحصاء", orient_pharmacy: "تنوير مسئول الصيدلية" };

    return (
        <Suspense fallback={<div className="p-8"><Spinner /></div>}>
            <Card dir="rtl">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 text-right">
                        <div className="flex justify-center">
                            <PageHeader title="تقرير زيارة العلاج المتكامل" subtitle={`المنشأة: ${facility['اسم_المؤسسة']}`} />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-end">
                             <div className="w-full sm:w-auto">
                                <FormGroup label="رقم الزيارة" className="text-right">
                                    <Input 
                                        type="number" 
                                        name="visitNumber" 
                                        value={formData.visitNumber} 
                                        onChange={handleFormChange} 
                                        min="1" 
                                        readOnly={!canEditVisitNumber}
                                        className={`font-bold text-center w-24 ${canEditVisitNumber ? 'bg-white border-sky-300' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`} 
                                    />
                                </FormGroup>
                             </div>
                             <div className="w-full sm:w-auto"><FormGroup label="تاريخ الزيارة" className="text-right"><Input type="date" name="visit_date" value={formData.visit_date} onChange={handleFormChange} required className="text-right" /></FormGroup></div>
                        </div>

                        <div className="mb-6"><h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">الكوادر التي تم الإشراف عليها</h3>{sessionsForThisVisit.length === 0 ? <p className="text-gray-600">لا توجد جلسات.</p> : <ul className="list-disc pr-6 space-y-1">{sessionsForThisVisit.map(s => <li key={s.id}>{s.staff} ({(s.scores?.overallScore_maxScore > 0) ? Math.round((s.scores?.overallScore_score/s.scores?.overallScore_maxScore)*100) : 0}%)</li>)}</ul>}</div>
                        <div className="mb-6"><h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المهارات المدربة</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Object.entries(skillsList).map(([k, l]) => <label key={k} className="cursor-pointer"><span>{l}</span><input type="checkbox" checked={!!formData.trained_skills[k]} onChange={() => handleCheckboxChange('trained_skills', k)} className="ms-3" /></label>)}</div></div>
                        <div className="mb-6"><h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">تنوير الأقسام</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Object.entries(orientationsList).map(([k, l]) => <label key={k} className="cursor-pointer"><span>{l}</span><input type="checkbox" checked={!!formData.other_orientations[k]} onChange={() => handleCheckboxChange('other_orientations', k)} className="ms-3" /></label>)}</div></div>

                        {/* --- CHALLENGES TABLE --- */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المشاكل والمعوقات والحلول (الحالية)</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300">
                                    <thead className="bg-gray-100 text-xs">
                                        <tr>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">المسؤول</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/12">حالة (بعيد)</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">حل بعيد المدى</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/12">حالة (اني)</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">حل اني</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/4">المشكلة</th>
                                            <th className="px-2 py-2 border border-gray-300"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.challenges_table.map((row, index) => (
                                            <tr key={row.id}>
                                                <td className="border"><Textarea value={row.responsible_person} onChange={(e) => handleChallengeChange(row.id, 'responsible_person', e.target.value)} rows={2} className="w-full text-right text-xs" /></td>
                                                <td className="border">
                                                    <Select value={row.long_term_status || 'Pending'} onChange={(e) => handleChallengeChange(row.id, 'long_term_status', e.target.value)} className="text-xs p-1">
                                                        <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Done">Done</option>
                                                    </Select>
                                                </td>
                                                <td className="border"><Textarea value={row.long_term_solution} onChange={(e) => handleChallengeChange(row.id, 'long_term_solution', e.target.value)} rows={2} className="w-full text-right text-xs" /></td>
                                                <td className="border">
                                                    <Select value={row.immediate_status || 'Pending'} onChange={(e) => handleChallengeChange(row.id, 'immediate_status', e.target.value)} className="text-xs p-1">
                                                        <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Done">Done</option>
                                                    </Select>
                                                </td>
                                                <td className="border"><Textarea value={row.immediate_solution} onChange={(e) => handleChallengeChange(row.id, 'immediate_solution', e.target.value)} rows={2} className="w-full text-right text-xs" /></td>
                                                <td className="border"><Textarea value={row.problem} onChange={(e) => handleChallengeChange(row.id, 'problem', e.target.value)} rows={2} className="w-full text-right text-xs" /></td>
                                                <td className="border text-center">
                                                    {index > 0 && (<Button type="button" variant="danger" size="sm" onClick={() => removeChallengeRow(row.id)}><Trash2 size={14} /></Button>)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-start mt-2"><Button type="button" variant="outline" size="sm" onClick={addChallengeRow}><PlusCircle size={16} className="ml-1"/> إضافة صف</Button></div>
                        </div>

                        {/* --- PREVIOUS PROBLEMS TABLE --- */}
                        <PreviousProblemsTable 
                            reports={allVisitReports} 
                            currentFacilityId={facility.id} 
                            currentReportId={existingReportData?.id}
                            onUpdateStatus={handlePreviousStatusChange}
                            serviceType="IMNCI"
                        />

                        <div className="mb-6 border-t pt-4"><h3 className="text-lg font-bold text-sky-800 mb-2">الصور</h3><div className="grid grid-cols-3 gap-2">{formData.imageUrls.map((url, i) => <div key={i} className="relative"><img src={url} className="h-20 w-full object-cover" /><Button type="button" variant="danger" size="xs" className="absolute top-0 left-0" onClick={()=>removeExistingImage(i)}>x</Button></div>)} {newImageFiles.map((f, i) => <div key={i} className="relative"><img src={URL.createObjectURL(f)} className="h-20 w-full object-cover" /><Button type="button" variant="danger" size="xs" className="absolute top-0 left-0" onClick={()=>removeNewImage(i)}>x</Button></div>)} <label className="border-2 border-dashed p-4 flex justify-center items-center cursor-pointer"><Camera /><Input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden"/></label></div></div>
                        <div className="mb-6"><FormGroup label="ملاحظات" className="text-right"><Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={3} /></FormGroup></div>
                    </div>

                    <div className="flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                        <div className="flex gap-2 flex-wrap justify-start">
                            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}> إلغاء </Button>
                            <Button type="submit" disabled={isSaving} className="flex items-center gap-2"> 
                                {isSaving ? 'جاري الحفظ...' : <><Save size={16}/> {existingReportData ? 'تحديث التقرير' : 'حفظ التقرير'}</>}
                            </Button>
                        </div>
                    </div>
                </form>
                
                {/* --- SUCCESS POPUP --- */}
                <SuccessModal 
                    isOpen={showSuccessModal} 
                    onClose={handleCloseSuccessModal} 
                    message="تم حفظ تقرير الزيارة وتحديث الحالات بنجاح." 
                />
            </Card>
        </Suspense>
    );
};

// --- 2: EENC Visit Report Component ---
export const EENCVisitReport = ({ 
    facility, 
    onCancel, 
    setToast, 
    allSubmissions, 
    existingReportData = null, 
    visitNumber = 1, 
    allVisitReports = [],
    canEditVisitNumber = false 
}) => {
    const auth = getAuth();
    const user = auth.currentUser;

    const getInitialState = () => {
        const defaultRow = { id: 1, problem: '', immediate_solution: '', immediate_status: 'Pending', long_term_solution: '', long_term_status: 'Pending', responsible_person: '' };
        if (existingReportData) {
            return {
                visit_date: existingReportData.visit_date || new Date().toISOString().split('T')[0],
                visitNumber: existingReportData.visitNumber || visitNumber,
                trained_skills: existingReportData.trained_skills || {},
                other_orientations: existingReportData.other_orientations || {},
                challenges_table: existingReportData.challenges_table || [defaultRow],
                imageUrls: existingReportData.imageUrls || [], 
                notes: existingReportData.notes || '',
            };
        }
        return { visit_date: new Date().toISOString().split('T')[0], visitNumber: visitNumber, trained_skills: {}, other_orientations: {}, challenges_table: [defaultRow], imageUrls: [], notes: '' };
    };

    const [formData, setFormData] = useState(getInitialState());
    const [newImageFiles, setNewImageFiles] = useState([]); 
    const [isSaving, setIsSaving] = useState(false);
    const [previousUpdates, setPreviousUpdates] = useState({}); 
    const [showSuccessModal, setShowSuccessModal] = useState(false); // Success Modal State

    useEffect(() => { if (!existingReportData && visitNumber) setFormData(prev => ({ ...prev, visitNumber: visitNumber })); }, [visitNumber, existingReportData]);

    const sessionsForThisVisit = useMemo(() => {
        if (!allSubmissions || !facility || !formData.visit_date) return [];
        return allSubmissions.filter(sub => sub.facilityId === facility.id && sub.sessionDate === formData.visit_date && sub.service === 'EENC' && sub.status === 'complete');
    }, [allSubmissions, facility, formData.visit_date]);

    const handleFormChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleCheckboxChange = (group, key) => { setFormData(prev => ({ ...prev, [group]: { ...prev[group], [key]: !prev[group][key] } })); };
    const handleChallengeChange = (id, field, value) => { setFormData(prev => ({ ...prev, challenges_table: prev.challenges_table.map(row => row.id === id ? { ...row, [field]: value } : row) })); };
    const addChallengeRow = () => { setFormData(prev => ({ ...prev, challenges_table: [...prev.challenges_table, { id: Date.now(), problem: '', immediate_solution: '', immediate_status: 'Pending', long_term_solution: '', long_term_status: 'Pending', responsible_person: '' }] })); };
    const removeChallengeRow = (id) => { setFormData(prev => ({ ...prev, challenges_table: prev.challenges_table.filter(row => row.id !== id) })); };
    const handleImageChange = (e) => { if (e.target.files) { setNewImageFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = null; } };
    const removeExistingImage = (i) => { setFormData(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, index) => index !== i) })); };
    const removeNewImage = (i) => { setNewImageFiles(prev => prev.filter((_, index) => index !== i)); };
    const handlePreviousStatusChange = (reportId, challengeId, newStatus, service) => { setPreviousUpdates(prev => ({ ...prev, [`${reportId}_${challengeId}`]: { reportId, challengeId, newStatus, service } })); };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // --- DUPLICATE CHECK ---
        if (!existingReportData) {
            const isDuplicate = allVisitReports.some(rep => 
                rep.facilityId === facility.id && 
                rep.visitDate === formData.visit_date && 
                rep.service === 'EENC'
            );

            if (isDuplicate) {
                setToast({ 
                    show: true, 
                    message: 'يوجد بالفعل تقرير زيارة EENC لهذه المنشأة في هذا التاريخ. يرجى تعديل التقرير الموجود بدلاً من إنشاء تقرير جديد.', 
                    type: 'error' 
                });
                return;
            }
        }
        // ------------------------

        setIsSaving(true);
        try {
            const originalUrls = existingReportData?.imageUrls || [];
            const currentUrls = formData.imageUrls;
            const urlsToDelete = originalUrls.filter(url => !currentUrls.includes(url));
            for (const url of urlsToDelete) { try { await deleteFile(url); } catch (e) { console.warn(e); } }
            const newUploadedUrls = [];
            for (const file of newImageFiles.filter(f => f)) { newUploadedUrls.push(await uploadFile(file)); }
            
            const payload = {
                ...formData, visitNumber: parseInt(formData.visitNumber) || 1, imageUrls: [...currentUrls, ...newUploadedUrls], facilityId: facility.id, facilityName: facility['اسم_المؤسسة'], state: facility['الولاية'], locality: facility['المحلية'],
            };
            delete payload.imageUrl;
            if (existingReportData) { payload.mentorEmail = existingReportData.mentorEmail; payload.mentorName = existingReportData.mentorName; payload.edited_by_email = user.email; payload.edited_by_name = user.displayName || user.email; payload.lastUpdatedAt = Timestamp.now(); } else { payload.mentorEmail = user.email; payload.mentorName = user.displayName || user.email; payload.createdAt = Timestamp.now(); }

            await saveEENCVisitReport(payload, existingReportData?.id || null);

            const updatePromises = Object.values(previousUpdates).map(async (update) => {
                const reportToUpdate = allVisitReports.find(r => r.id === update.reportId);
                if (reportToUpdate && reportToUpdate.fullData) {
                    const updatedChallenges = reportToUpdate.fullData.challenges_table.map(ch => ch.id === update.challengeId ? { ...ch, status: update.newStatus } : ch);
                    const updatePayload = { ...reportToUpdate.fullData, challenges_table: updatedChallenges, lastUpdatedAt: Timestamp.now() };
                    const { id, ...cleanPayload } = updatePayload;
                    await saveEENCVisitReport(cleanPayload, update.reportId);
                }
            });
            await Promise.all(updatePromises);

            // Show Success Modal
            setShowSuccessModal(true);

        } catch (error) { setToast({ show: true, message: `فشل: ${error.message}`, type: 'error' }); } finally { setIsSaving(false); }
    };

    const handleCloseSuccessModal = () => {
        setShowSuccessModal(false);
        onCancel(); // Navigate back
    };

    const skillsList = { skill_pre_handwash: "غسل الايدي", skill_pre_equip: "تجهيز المعدات", skill_drying: "التجفيف", skill_skin_to_skin: "جلد بجلد", skill_suction: "الشفط", skill_cord_pulse_check: "نبض الحبل السري", skill_clamp_placement: "وضع المشبك", skill_transfer: "نقل الطفل", skill_airway: "فتح مجرى الهواء", skill_ambubag_placement: "وضع الامبوباق", skill_ambubag_use: "استخدام الامبوباق", skill_ventilation_rate: "معدل التهوية", skill_correction_steps: "التدخلات التصحيحية" };
    const orientationsList = { orient_infection_control: "مكافحة العدوى", orient_nicu: "الحضانة", orient_stats: "الاحصاء", orient_nutrition: "التغذية" };

    return (
        <Suspense fallback={<div className="p-8"><Spinner /></div>}>
            <Card dir="rtl">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 text-right">
                        <div className="flex justify-center"><PageHeader title="تقرير زيارة EENC" subtitle={`المنشأة: ${facility['اسم_المؤسسة']}`} /></div>
                        <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-end">
                             <div className="w-full sm:w-auto">
                                <FormGroup label="رقم الزيارة" className="text-right">
                                    <Input 
                                        type="number" 
                                        name="visitNumber" 
                                        value={formData.visitNumber} 
                                        onChange={handleFormChange} 
                                        min="1" 
                                        readOnly={!canEditVisitNumber}
                                        className={`font-bold text-center w-24 ${canEditVisitNumber ? 'bg-white border-sky-300' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`} 
                                    />
                                </FormGroup>
                             </div>
                             <div className="w-full sm:w-auto"><FormGroup label="تاريخ الزيارة" className="text-right"><Input type="date" name="visit_date" value={formData.visit_date} onChange={handleFormChange} required className="text-right" /></FormGroup></div>
                        </div>

                        <div className="mb-6"><h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">الكوادر المشرف عليها</h3>{sessionsForThisVisit.length === 0 ? <p>لا توجد.</p> : <ul className="list-disc pr-6">{sessionsForThisVisit.map(s => <li key={s.id}>{s.staff}</li>)}</ul>}</div>
                        <div className="mb-6"><h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المهارات</h3><div className="grid grid-cols-2 gap-2">{Object.entries(skillsList).map(([k, l]) => <label key={k} className="cursor-pointer"><span>{l}</span><input type="checkbox" checked={!!formData.trained_skills[k]} onChange={() => handleCheckboxChange('trained_skills', k)} className="ms-3" /></label>)}</div></div>
                        <div className="mb-6"><h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">تنوير</h3><div className="grid grid-cols-2 gap-2">{Object.entries(orientationsList).map(([k, l]) => <label key={k} className="cursor-pointer"><span>{l}</span><input type="checkbox" checked={!!formData.other_orientations[k]} onChange={() => handleCheckboxChange('other_orientations', k)} className="ms-3" /></label>)}</div></div>

                        {/* --- EENC CHALLENGES TABLE --- */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المشاكل والحلول</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300">
                                    <thead className="bg-gray-100 text-xs">
                                        <tr>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">المسؤول</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/12">حالة (بعيد)</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">حل بعيد المدى</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/12">حالة (اني)</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">حل اني</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/4">المشكلة</th>
                                            <th className="px-2 py-2 border border-gray-300"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.challenges_table.map((row, index) => (
                                            <tr key={row.id}>
                                                <td className="border"><Textarea value={row.responsible_person} onChange={(e) => handleChallengeChange(row.id, 'responsible_person', e.target.value)} rows={2} className="w-full text-right text-xs" /></td>
                                                <td className="border">
                                                    <Select value={row.long_term_status || 'Pending'} onChange={(e) => handleChallengeChange(row.id, 'long_term_status', e.target.value)} className="text-xs p-1">
                                                        <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Done">Done</option>
                                                    </Select>
                                                </td>
                                                <td className="border"><Textarea value={row.long_term_solution} onChange={(e) => handleChallengeChange(row.id, 'long_term_solution', e.target.value)} rows={2} className="w-full text-right text-xs" /></td>
                                                <td className="border">
                                                    <Select value={row.immediate_status || 'Pending'} onChange={(e) => handleChallengeChange(row.id, 'immediate_status', e.target.value)} className="text-xs p-1">
                                                        <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Done">Done</option>
                                                    </Select>
                                                </td>
                                                <td className="border"><Textarea value={row.immediate_solution} onChange={(e) => handleChallengeChange(row.id, 'immediate_solution', e.target.value)} rows={2} className="w-full text-right text-xs" /></td>
                                                <td className="border"><Textarea value={row.problem} onChange={(e) => handleChallengeChange(row.id, 'problem', e.target.value)} rows={2} className="w-full text-right text-xs" /></td>
                                                <td className="border text-center">{index > 0 && (<Button type="button" variant="danger" size="sm" onClick={() => removeChallengeRow(row.id)}><Trash2 size={14} /></Button>)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-start mt-2"><Button type="button" variant="outline" size="sm" onClick={addChallengeRow}><PlusCircle size={16} className="ml-1"/> إضافة صف</Button></div>
                        </div>

                        {/* --- PREVIOUS PROBLEMS --- */}
                        <PreviousProblemsTable 
                            reports={allVisitReports} 
                            currentFacilityId={facility.id} 
                            currentReportId={existingReportData?.id}
                            onUpdateStatus={handlePreviousStatusChange}
                            serviceType="EENC"
                        />

                        <div className="mb-6 border-t pt-4"><h3 className="text-lg font-bold text-sky-800 mb-2">الصور</h3><div className="grid grid-cols-3 gap-2">{formData.imageUrls.map((url, i) => <div key={i} className="relative"><img src={url} className="h-20 w-full object-cover" /><Button type="button" variant="danger" size="xs" className="absolute top-0 left-0" onClick={()=>removeExistingImage(i)}>x</Button></div>)} {newImageFiles.map((f, i) => <div key={i} className="relative"><img src={URL.createObjectURL(f)} className="h-20 w-full object-cover" /><Button type="button" variant="danger" size="xs" className="absolute top-0 left-0" onClick={()=>removeNewImage(i)}>x</Button></div>)} <label className="border-2 border-dashed p-4 flex justify-center items-center cursor-pointer"><Camera /><Input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden"/></label></div></div>
                        <div className="mb-6"><FormGroup label="ملاحظات" className="text-right"><Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={3} /></FormGroup></div>
                    </div>
                    
                    <div className="flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                        <div className="flex gap-2 flex-wrap justify-start">
                            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}> إلغاء </Button>
                            <Button type="submit" disabled={isSaving} className="flex items-center gap-2"> {isSaving ? 'جاري...' : <><Save size={16}/> {existingReportData ? 'تحديث' : 'حفظ'}</>} </Button>
                        </div>
                    </div>
                </form>

                {/* --- SUCCESS POPUP --- */}
                <SuccessModal 
                    isOpen={showSuccessModal} 
                    onClose={handleCloseSuccessModal} 
                    message="تم حفظ تقرير الزيارة وتحديث الحالات بنجاح." 
                />
            </Card>
        </Suspense>
    );
};