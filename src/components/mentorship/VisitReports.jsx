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
                <table className="min-w-full text-xs text-right bg-gray-50" dir="rtl">
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

// --- Mentoring Matrix Skill Categories ---
const GENERAL_SKILLS = {
    skill_chartbook: "استخدام كتيب اللوحات للتقييم والتصنيف",
    skill_record_form: "استخدام استمارة تسجيل الحالة",
    skill_counseling_card: "استخدام كرت نصح وارشاد الأم",
    skill_stat_reports: "ملء سجل العمل اليومي والتقرير الشهري",
    skill_immunization_referral: "سواقط التطعيم"
};

const ASSESSMENT_SKILLS = {
    skill_temp: "قياس درجة حرارة الطفل بصورة صحيحة",
    skill_danger_signs: "علامات الخطورة العامة",
    skill_ds_drink: "علامة خطورة: لا يستطيع ان يرضع أو يشرب",
    skill_ds_vomit: "علامة خطورة: يتقيأ كل شئ",
    skill_ds_convulsion: "علامة خطورة: تشنجات أثناء المرض الحالي",
    skill_ds_conscious: "علامة خطورة: خامل أو فاقد للوعي",
    skill_check_rr: "قياس معدل التنفس بصورة صحيحة",
    skill_check_dehydration: "تقييم فقدان السوائل بصورة صحيحة"
};

const MALNUTRITION_SKILLS = {
    skill_weight: "وزن الطفل بصورة صحيحة",
    skill_height: "قياس طول/ارتفاع الطفل بصورة صحيحة",
    skill_mal_muac: "قياس المواك (MUAC) بصورة صحيحة",
    skill_mal_wfh: "قياس نسبة الوزن للطول أو الارتفاع (Z-Score)",
    skill_edema: "تقييم الورم (Edema)"
};

const ALL_MATRIX_SKILLS = { ...GENERAL_SKILLS, ...ASSESSMENT_SKILLS, ...MALNUTRITION_SKILLS };

// --- 1: IMNCI Visit Report Component ---
export const IMNCIVisitReport = ({ 
    facility, 
    onCancel, 
    onSaveSuccess,
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
            solution: '', 
            status: 'Pending', 
            responsible_person: '' 
        };

        const defaultMentoringMatrix = Object.keys(ALL_MATRIX_SKILLS).reduce((acc, key) => {
            acc[key] = { isTrained: false, timesTrained: 0, isMastered: false };
            return acc;
        }, {});

        if (existingReportData) {
            let initialMatrix = existingReportData.mentoring_matrix 
                ? JSON.parse(JSON.stringify(existingReportData.mentoring_matrix)) 
                : JSON.parse(JSON.stringify(defaultMentoringMatrix));

            if (existingReportData.trained_skills) {
                Object.keys(existingReportData.trained_skills).forEach(k => {
                    if (existingReportData.trained_skills[k]) {
                        if (!initialMatrix[k]) {
                            initialMatrix[k] = { isTrained: true, timesTrained: 1, isMastered: false };
                        } else {
                            initialMatrix[k].isTrained = true;
                            if (initialMatrix[k].timesTrained === 0) {
                                initialMatrix[k].timesTrained = 1;
                            }
                        }
                    }
                });
            }

            const mappedChallenges = (existingReportData.challenges_table || [defaultRow]).map(row => {
                let combinedSolution = row.solution || '';
                if (!combinedSolution && (row.immediate_solution || row.long_term_solution)) {
                    combinedSolution = [row.immediate_solution, row.long_term_solution].filter(Boolean).join(' / ');
                }
                
                return {
                    id: row.id,
                    problem: row.problem || '',
                    solution: combinedSolution,
                    status: row.status || row.immediate_status || 'Pending',
                    responsible_person: row.responsible_person || ''
                };
            });

            return {
                visit_date: existingReportData.visit_date || new Date().toISOString().split('T')[0],
                visitNumber: existingReportData.visitNumber || visitNumber,
                mentoring_matrix: initialMatrix,
                other_orientations: existingReportData.other_orientations || {},
                orientations_counts: existingReportData.orientations_counts || {},
                medication_shortage: existingReportData.medication_shortage || { amoxicillin: '', zinc: '', ors: '', coartem: '' },
                info_system: existingReportData.info_system || { total_examined: '', examined_by_trained: '', completed_forms: '', completed_followup_forms: '' },
                challenges_table: mappedChallenges,
                imageUrls: existingReportData.imageUrls || [], 
                notes: existingReportData.notes || '',
            };
        }
        return {
            visit_date: new Date().toISOString().split('T')[0],
            visitNumber: visitNumber,
            mentoring_matrix: defaultMentoringMatrix,
            other_orientations: {},
            orientations_counts: {},
            medication_shortage: { amoxicillin: '', zinc: '', ors: '', coartem: '' },
            info_system: { total_examined: '', examined_by_trained: '', completed_forms: '', completed_followup_forms: '' },
            challenges_table: [defaultRow],
            imageUrls: [],
            notes: '',
        };
    };

    const [formData, setFormData] = useState(getInitialState());
    const [newImageFiles, setNewImageFiles] = useState([]); 
    const [isSaving, setIsSaving] = useState(false);
    const [previousUpdates, setPreviousUpdates] = useState({}); 
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    useEffect(() => {
        if (existingReportData) return;
        const currentVisitDate = formData.visit_date;
        if (!currentVisitDate) return;

        const uniqueDates = [...new Set(
            allVisitReports
                .filter(r => r.facilityId === facility?.id)
                .map(r => r.visitDate)
        )].filter(d => d && d !== 'N/A').sort();

        if (uniqueDates.includes(currentVisitDate)) {
            const index = uniqueDates.indexOf(currentVisitDate);
            setFormData(prev => ({ ...prev, visitNumber: index + 1 }));
        } else {
            setFormData(prev => ({ ...prev, visitNumber: uniqueDates.length + 1 }));
        }
    }, [formData.visit_date, allVisitReports, facility?.id, existingReportData]);

    const sessionsForThisVisit = useMemo(() => {
        if (!allSubmissions || !facility || !formData.visit_date) return [];
        return allSubmissions.filter(sub => sub.facilityId === facility.id && sub.sessionDate === formData.visit_date && sub.service === 'IMNCI' && sub.status === 'complete');
    }, [allSubmissions, facility, formData.visit_date]);

    const detectedWeaknesses = useMemo(() => {
        if (!sessionsForThisVisit || sessionsForThisVisit.length === 0) return [];
        
        const stats = {
            skill_weight: { score: 0, max: 0 },
            skill_temp: { score: 0, max: 0 },
            skill_height: { score: 0, max: 0 },
            skill_check_rr: { score: 0, max: 0 },
            skill_check_dehydration: { score: 0, max: 0 },
            skill_mal_muac: { score: 0, max: 0 },
            skill_mal_wfh: { score: 0, max: 0 },
            skill_edema: { score: 0, max: 0 },
            skill_ds_drink: { score: 0, max: 0 },
            skill_ds_vomit: { score: 0, max: 0 },
            skill_ds_convulsion: { score: 0, max: 0 },
            skill_ds_conscious: { score: 0, max: 0 },
        };

        sessionsForThisVisit.forEach(sub => {
            const s = sub.scores || {};
            const as = sub.assessmentSkills || sub.fullData?.assessment_skills || sub.fullData?.assessmentSkills || {};

            if (s.handsOnWeight_maxScore > 0) { stats.skill_weight.score += s.handsOnWeight_score; stats.skill_weight.max += s.handsOnWeight_maxScore; }
            if (s.handsOnTemp_maxScore > 0) { stats.skill_temp.score += s.handsOnTemp_score; stats.skill_temp.max += s.handsOnTemp_maxScore; }
            if (s.handsOnHeight_maxScore > 0) { stats.skill_height.score += s.handsOnHeight_score; stats.skill_height.max += s.handsOnHeight_maxScore; }
            if (s.respiratoryRateCalculation_maxScore > 0) { stats.skill_check_rr.score += s.respiratoryRateCalculation_score; stats.skill_check_rr.max += s.respiratoryRateCalculation_maxScore; }
            if (s.dehydrationAssessment_maxScore > 0) { stats.skill_check_dehydration.score += s.dehydrationAssessment_score; stats.skill_check_dehydration.max += s.dehydrationAssessment_maxScore; }
            if (s.handsOnMUAC_maxScore > 0) { stats.skill_mal_muac.score += s.handsOnMUAC_score; stats.skill_mal_muac.max += s.handsOnMUAC_maxScore; }
            if (s.handsOnWFH_maxScore > 0) { stats.skill_mal_wfh.score += s.handsOnWFH_score; stats.skill_mal_wfh.max += s.handsOnWFH_maxScore; }

            const checkSkill = (key) => {
                if (as[key] === 'yes') { stats[key].score++; stats[key].max++; }
                else if (as[key] === 'no') { stats[key].max++; }
            };
            checkSkill('skill_ds_drink');
            checkSkill('skill_ds_vomit');
            checkSkill('skill_ds_convulsion');
            checkSkill('skill_ds_conscious');
            checkSkill('skill_edema');
        });

        const weakKeys = [];
        Object.keys(stats).forEach(key => {
            if (stats[key].max > 0) {
                const pct = stats[key].score / stats[key].max;
                if (pct < 0.75) weakKeys.push(key);
            }
        });
        return weakKeys;
    }, [sessionsForThisVisit]);

    const handleFormChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleCheckboxChange = (group, key) => { setFormData(prev => ({ ...prev, [group]: { ...prev[group], [key]: !prev[group][key] } })); };
    
    const handleOrientationCountChange = (key, value) => {
        setFormData(prev => ({
            ...prev,
            orientations_counts: { ...prev.orientations_counts, [key]: parseInt(value) || 0 }
        }));
    };

    const handleMentoringMatrixChange = (skillKey, field, value) => {
        setFormData(prev => ({
            ...prev,
            mentoring_matrix: {
                ...prev.mentoring_matrix,
                [skillKey]: {
                    ...(prev.mentoring_matrix[skillKey] || { isTrained: false, timesTrained: 0, isMastered: false }),
                    [field]: value
                }
            }
        }));
    };

    const handleMedicationShortageChange = (key, value) => {
        setFormData(prev => ({ ...prev, medication_shortage: { ...prev.medication_shortage, [key]: value } }));
    };

    const handleInfoSystemChange = (key, value) => {
        setFormData(prev => ({ ...prev, info_system: { ...prev.info_system, [key]: value } }));
    };

    const handleChallengeChange = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            challenges_table: prev.challenges_table.map(row =>
                row.id === id ? { ...row, [field]: value } : row
            )
        }));
    };

    const addChallengeRow = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        setFormData(prev => ({
            ...prev,
            challenges_table: [
                ...prev.challenges_table,
                { id: Date.now(), problem: '', solution: '', status: 'Pending', responsible_person: '' }
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

        setIsSaving(true);
        try {
            const originalUrls = existingReportData?.imageUrls || [];
            const currentUrls = formData.imageUrls;
            const urlsToDelete = originalUrls.filter(url => !currentUrls.includes(url));
            for (const url of urlsToDelete) { try { await deleteFile(url); } catch (e) { console.warn(e); } }

            const newUploadedUrls = [];
            for (const file of newImageFiles.filter(f => f)) { newUploadedUrls.push(await uploadFile(file)); }
            const finalImageUrls = [...currentUrls, ...newUploadedUrls];
            
            const updatedTrainedSkills = {};
            Object.keys(formData.mentoring_matrix).forEach(k => {
                if (formData.mentoring_matrix[k].isTrained) {
                    updatedTrainedSkills[k] = true;
                }
            });

            const payload = {
                ...formData,
                trained_skills: updatedTrainedSkills, 
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
        if (onSaveSuccess) onSaveSuccess();
        else onCancel();
    };

    const renderSkillGroup = (title, skillsObj, isGeneral = false) => {
        const allKeys = Object.keys(skillsObj);
        
        let topKeys = [];
        let bottomKeys = [];

        if (isGeneral) {
            topKeys = allKeys;
        } else {
            allKeys.forEach(key => {
                if (detectedWeaknesses.includes(key) || formData.mentoring_matrix[key]?.isTrained) {
                    topKeys.push(key);
                } else {
                    bottomKeys.push(key);
                }
            });
        }

        if (topKeys.length === 0 && bottomKeys.length === 0) return null;

        const renderRow = (key, isWeakness, isStrong) => {
            const matrixData = formData.mentoring_matrix[key] || { isTrained: false, timesTrained: 0, isMastered: false };
            return (
                <tr key={key} className={`hover:bg-gray-50 transition-colors ${isWeakness ? 'bg-red-50/30' : (isStrong ? 'bg-gray-50/50 opacity-80' : '')}`}>
                    <td className={`px-4 py-2 border border-gray-300 font-semibold text-sm ${isStrong ? 'text-gray-600' : 'text-gray-900'}`}>
                        {skillsObj[key]}
                        {isWeakness && (
                            <span className="mr-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                نقطة ضعف مسجلة (أقل من 75%)
                            </span>
                        )}
                        {isStrong && (
                            <span className="mr-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                                مهارة جيدة لا تحتاج تدريب
                            </span>
                        )}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 text-center">
                        <input 
                            type="checkbox" 
                            checked={matrixData.isTrained}
                            onChange={(e) => handleMentoringMatrixChange(key, 'isTrained', e.target.checked)}
                            className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer rounded"
                        />
                    </td>
                    <td className="px-4 py-2 border border-gray-300 text-center">
                        <Input 
                            type="number" 
                            min="0"
                            value={matrixData.timesTrained}
                            onChange={(e) => handleMentoringMatrixChange(key, 'timesTrained', parseInt(e.target.value) || 0)}
                            className="w-20 text-center font-bold mx-auto h-8 text-sm"
                            disabled={!matrixData.isTrained}
                        />
                    </td>
                    <td className="px-4 py-2 border border-gray-300 text-center">
                        <input 
                            type="checkbox" 
                            checked={matrixData.isMastered}
                            onChange={(e) => handleMentoringMatrixChange(key, 'isMastered', e.target.checked)}
                            className="w-4 h-4 text-green-600 focus:ring-green-500 cursor-pointer rounded"
                            disabled={!matrixData.isTrained}
                        />
                    </td>
                </tr>
            );
        };

        return (
            <React.Fragment key={title}>
                <tr className="bg-sky-50">
                    <td colSpan="4" className="px-4 py-2 border border-gray-300 font-bold text-sky-800 text-sm bg-sky-100">
                        {title}
                    </td>
                </tr>
                {topKeys.map(key => renderRow(key, detectedWeaknesses.includes(key), false))}
                {bottomKeys.map(key => renderRow(key, false, true))}
            </React.Fragment>
        );
    };

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
                        
                        {/* --- Detected Weaknesses Summary (Pre-Matrix) --- */}
                        {detectedWeaknesses.length > 0 && (
                            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
                                <h4 className="text-lg font-bold text-red-800 mb-2">مهارات تحتاج إلى تركيز (نقاط ضعف مرصودة في زيارات اليوم):</h4>
                                <ul className="list-disc pr-6 space-y-1">
                                    {detectedWeaknesses.map(key => (
                                        <li key={key} className="text-sm font-semibold text-gray-800">
                                            {ALL_MATRIX_SKILLS[key] || key}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* --- SKILLS MENTORING MATRIX --- */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">
                                مصفوفة التدريب والمهارات
                                <span className="text-xs text-gray-500 font-normal mr-2">(نقاط الضعف تظهر في الأعلى لكل مجموعة، والمهارات الجيدة تظهر في الأسفل)</span>
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300 bg-white" dir="rtl">
                                    <thead className="bg-gray-100 text-xs">
                                        <tr>
                                            <th className="px-4 py-2 border border-gray-300 text-right w-1/2">المهارة</th>
                                            <th className="px-4 py-2 border border-gray-300 text-center">تم التدريب عليها؟</th>
                                            <th className="px-4 py-2 border border-gray-300 text-center">عدد مرات التدريب</th>
                                            <th className="px-4 py-2 border border-gray-300 text-center">تم الإتقان (75% فأكثر)؟</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderSkillGroup("المهارات العامة واستخدام الأدوات", GENERAL_SKILLS, true)}
                                        {renderSkillGroup("مهارات التقييم وعلامات الخطورة", ASSESSMENT_SKILLS, false)}
                                        {renderSkillGroup("القياسات وعلامات سوء التغذية", MALNUTRITION_SKILLS, false)}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* --- ORIENTATION SESSION WITH COUNTS --- */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">تنوير الأقسام</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(orientationsList).map(([k, l]) => (
                                    <div key={k} className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer flex-grow">
                                            <input 
                                                type="checkbox" 
                                                checked={!!formData.other_orientations[k]} 
                                                onChange={() => handleCheckboxChange('other_orientations', k)} 
                                                className="w-4 h-4 text-sky-600 focus:ring-sky-500 rounded" 
                                            />
                                            <span className="text-sm font-semibold text-gray-800">{l}</span>
                                        </label>
                                        {!!formData.other_orientations[k] && (
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded">عدد الكوادر المدربة:</span>
                                                <Input 
                                                    type="number" 
                                                    min="1"
                                                    value={formData.orientations_counts?.[k] || ''}
                                                    onChange={(e) => handleOrientationCountChange(k, e.target.value)}
                                                    className="w-16 text-center h-8 text-sm border-sky-200"
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* --- MEDICATION SHORTAGE TABLE --- */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">
                                وفرة الادوية / هل حدث إنقطاع للادوية التالية خلال الاسبوع السابق؟
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300 bg-white" dir="rtl">
                                    <thead className="bg-gray-100 text-xs">
                                        <tr>
                                            <th className="px-4 py-2 border border-gray-300 text-right w-1/2">الدواء</th>
                                            <th className="px-4 py-2 border border-gray-300 text-center w-1/4">نعم (حدث انقطاع)</th>
                                            <th className="px-4 py-2 border border-gray-300 text-center w-1/4">لا (متوفر دائمًا)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { key: 'amoxicillin', label: 'أموكسليلين 250 ملغ' },
                                            { key: 'zinc', label: 'زنك' },
                                            { key: 'ors', label: 'ملح تروية' },
                                            { key: 'coartem', label: 'كوارتم' }
                                        ].map(med => (
                                            <tr key={med.key} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 border border-gray-300 font-semibold text-sm">{med.label}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-center">
                                                    <input 
                                                        type="radio" 
                                                        name={`medication_shortage_${med.key}`} 
                                                        value="yes" 
                                                        checked={formData.medication_shortage[med.key] === 'yes'}
                                                        onChange={(e) => handleMedicationShortageChange(med.key, e.target.value)}
                                                        className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 border border-gray-300 text-center">
                                                    <input 
                                                        type="radio" 
                                                        name={`medication_shortage_${med.key}`} 
                                                        value="no" 
                                                        checked={formData.medication_shortage[med.key] === 'no'}
                                                        onChange={(e) => handleMedicationShortageChange(med.key, e.target.value)}
                                                        className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* --- INFORMATION SYSTEM TABLE --- */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">
                                نظام معلومات العلاج المتكامل (فقط خلال الاسبوع السابق)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300 bg-white" dir="rtl">
                                    <thead className="bg-gray-100 text-xs">
                                        <tr>
                                            <th className="px-4 py-2 border border-gray-300 text-right w-2/3">البيان</th>
                                            <th className="px-4 py-2 border border-gray-300 text-center w-1/3">العدد</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { key: 'total_examined', label: 'عدد الأطفال الذين تم معاينتهم في العيادة خلال الاسبوع السابق' },
                                            { key: 'examined_by_trained', label: 'عدد الأطفال الذين تم معاينتهم بكادر مدرب على العلاج المتكامل خلال الاسبوع السابق' },
                                            { key: 'completed_forms', label: 'عدد الأطفال الذين لديهم إستمارة علاج متكامل مكتملة خلال الاسبوع السابق' },
                                            { key: 'completed_followup_forms', label: 'عدد الأطفال الذين لديهم إستمارة متابعة مكتملة خلال الاسبوع السابق' }
                                        ].map(item => (
                                            <tr key={item.key} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 border border-gray-300 font-semibold text-sm">{item.label}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-center">
                                                    <Input 
                                                        type="number" 
                                                        min="0"
                                                        value={formData.info_system[item.key]} 
                                                        onChange={(e) => handleInfoSystemChange(item.key, e.target.value)}
                                                        className="w-full text-center font-bold"
                                                        placeholder="0"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* --- CHALLENGES TABLE --- */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المشاكل والمعوقات والحلول (الحالية)</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300" dir="rtl">
                                    <thead className="bg-gray-100 text-xs">
                                        <tr>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/4">المشكلة</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/3">الحل</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">الحالة</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">المسؤول</th>
                                            <th className="px-2 py-2 border border-gray-300 w-1/12"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.challenges_table.map((row, index) => {
                                            const standardResp = ["مدير المركز", "منسق صحة الطفل بالمحلية", "منسق صحة الطفل بالولاية", ""];
                                            const isCustomResp = !standardResp.includes(row.responsible_person);
                                            
                                            return (
                                                <tr key={row.id}>
                                                    <td className="border p-1"><Textarea value={row.problem} onChange={(e) => handleChallengeChange(row.id, 'problem', e.target.value)} rows={2} className="w-full text-right text-xs border-gray-300 focus:border-sky-500 focus:ring-sky-500" /></td>
                                                    <td className="border p-1"><Textarea value={row.solution} onChange={(e) => handleChallengeChange(row.id, 'solution', e.target.value)} rows={2} className="w-full text-right text-xs border-gray-300 focus:border-sky-500 focus:ring-sky-500" /></td>
                                                    <td className="border align-top p-1">
                                                        <Select value={row.status || 'Pending'} onChange={(e) => handleChallengeChange(row.id, 'status', e.target.value)} className="text-[11px] font-bold p-1 border-gray-300 focus:border-sky-500 focus:ring-sky-500">
                                                            <option value="Pending">Pending</option>
                                                            <option value="In Progress">In Progress</option>
                                                            <option value="Resolved">Resolved</option>
                                                        </Select>
                                                    </td>
                                                    <td className="border align-top p-1">
                                                        <Select 
                                                            value={isCustomResp ? 'أخرى حدد' : row.responsible_person} 
                                                            onChange={(e) => handleChallengeChange(row.id, 'responsible_person', e.target.value === 'أخرى حدد' ? 'أخرى حدد' : e.target.value)} 
                                                            className="text-[11px] font-bold p-1 w-full border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                                                        >
                                                            <option value="">-- اختر --</option>
                                                            <option value="مدير المركز">مدير المركز</option>
                                                            <option value="منسق صحة الطفل بالمحلية">منسق صحة الطفل بالمحلية</option>
                                                            <option value="منسق صحة الطفل بالولاية">منسق صحة الطفل بالولاية</option>
                                                            <option value="أخرى حدد">أخرى (حدد)</option>
                                                        </Select>
                                                        {isCustomResp && (
                                                            <Textarea 
                                                                value={row.responsible_person === 'أخرى حدد' ? '' : row.responsible_person} 
                                                                onChange={(e) => handleChallengeChange(row.id, 'responsible_person', e.target.value)} 
                                                                rows={1} 
                                                                placeholder="أدخل المسؤول..."
                                                                className="w-full text-right text-xs mt-1 border-sky-200 bg-sky-50 focus:border-sky-500 focus:ring-sky-500" 
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="border text-center p-1">{index > 0 && (<Button type="button" variant="danger" size="sm" onClick={(e) => { e.preventDefault(); removeChallengeRow(row.id); }}><Trash2 size={14} /></Button>)}</td>
                                                </tr>
                                            );
                                        })}
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
                            serviceType="IMNCI"
                        />

                        <div className="mb-6 border-t pt-4"><h3 className="text-lg font-bold text-sky-800 mb-2">الصور</h3><div className="grid grid-cols-3 gap-2">{formData.imageUrls.map((url, i) => <div key={i} className="relative"><img src={url} className="h-20 w-full object-cover" /><Button type="button" variant="danger" size="xs" className="absolute top-0 left-0" onClick={(e)=>{ e.preventDefault(); removeExistingImage(i); }}>x</Button></div>)} {newImageFiles.map((f, i) => <div key={i} className="relative"><img src={URL.createObjectURL(f)} className="h-20 w-full object-cover" /><Button type="button" variant="danger" size="xs" className="absolute top-0 left-0" onClick={(e)=>{ e.preventDefault(); removeNewImage(i); }}>x</Button></div>)} <label className="border-2 border-dashed p-4 flex justify-center items-center cursor-pointer"><Camera /><Input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden"/></label></div></div>
                        <div className="mb-6"><FormGroup label="ملاحظات" className="text-right"><Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={3} /></FormGroup></div>
                    </div>
                    
                    <div className="flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                        <div className="flex gap-2 flex-wrap justify-start">
                            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}> إلغاء </Button>
                            <Button type="submit" disabled={isSaving} className="flex items-center gap-2"> {isSaving ? 'جاري...' : <><Save size={16}/> {existingReportData ? 'تحديث' : 'حفظ'}</>} </Button>
                        </div>
                    </div>
                </form>

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
    onSaveSuccess,
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
        const defaultRow = { id: 1, problem: '', solution: '', status: 'Pending', responsible_person: '' };
        if (existingReportData) {
            const mappedChallenges = (existingReportData.challenges_table || [defaultRow]).map(row => {
                let combinedSolution = row.solution || '';
                if (!combinedSolution && (row.immediate_solution || row.long_term_solution)) {
                    combinedSolution = [row.immediate_solution, row.long_term_solution].filter(Boolean).join(' / ');
                }
                
                return {
                    id: row.id,
                    problem: row.problem || '',
                    solution: combinedSolution,
                    status: row.status || row.immediate_status || 'Pending',
                    responsible_person: row.responsible_person || ''
                };
            });

            return {
                visit_date: existingReportData.visit_date || new Date().toISOString().split('T')[0],
                visitNumber: existingReportData.visitNumber || visitNumber,
                trained_skills: existingReportData.trained_skills || {},
                other_orientations: existingReportData.other_orientations || {},
                orientations_counts: existingReportData.orientations_counts || {},
                challenges_table: mappedChallenges,
                imageUrls: existingReportData.imageUrls || [], 
                notes: existingReportData.notes || '',
            };
        }
        return { visit_date: new Date().toISOString().split('T')[0], visitNumber: visitNumber, trained_skills: {}, other_orientations: {}, orientations_counts: {}, challenges_table: [defaultRow], imageUrls: [], notes: '' };
    };

    const [formData, setFormData] = useState(getInitialState());
    const [newImageFiles, setNewImageFiles] = useState([]); 
    const [isSaving, setIsSaving] = useState(false);
    const [previousUpdates, setPreviousUpdates] = useState({}); 
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    useEffect(() => {
        if (existingReportData) return;
        const currentVisitDate = formData.visit_date;
        if (!currentVisitDate) return;

        const uniqueDates = [...new Set(
            allVisitReports
                .filter(r => r.facilityId === facility?.id)
                .map(r => r.visitDate)
        )].filter(d => d && d !== 'N/A').sort();

        if (uniqueDates.includes(currentVisitDate)) {
            const index = uniqueDates.indexOf(currentVisitDate);
            setFormData(prev => ({ ...prev, visitNumber: index + 1 }));
        } else {
            setFormData(prev => ({ ...prev, visitNumber: uniqueDates.length + 1 }));
        }
    }, [formData.visit_date, allVisitReports, facility?.id, existingReportData]);

    const sessionsForThisVisit = useMemo(() => {
        if (!allSubmissions || !facility || !formData.visit_date) return [];
        return allSubmissions.filter(sub => sub.facilityId === facility.id && sub.sessionDate === formData.visit_date && sub.service === 'EENC' && sub.status === 'complete');
    }, [allSubmissions, facility, formData.visit_date]);

    const handleFormChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleCheckboxChange = (group, key) => { setFormData(prev => ({ ...prev, [group]: { ...prev[group], [key]: !prev[group][key] } })); };
    const handleChallengeChange = (id, field, value) => { setFormData(prev => ({ ...prev, challenges_table: prev.challenges_table.map(row => row.id === id ? { ...row, [field]: value } : row) })); };
    
    const handleOrientationCountChange = (key, value) => {
        setFormData(prev => ({
            ...prev,
            orientations_counts: { ...prev.orientations_counts, [key]: parseInt(value) || 0 }
        }));
    };

    const addChallengeRow = (e) => { 
        if (e && e.preventDefault) e.preventDefault(); // FIX: Prevent form submission
        setFormData(prev => ({ 
            ...prev, 
            challenges_table: [...prev.challenges_table, { id: Date.now(), problem: '', solution: '', status: 'Pending', responsible_person: '' }] 
        })); 
    };
    
    const removeChallengeRow = (id) => { setFormData(prev => ({ ...prev, challenges_table: prev.challenges_table.filter(row => row.id !== id) })); };
    const handleImageChange = (e) => { if (e.target.files) { setNewImageFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = null; } };
    const removeExistingImage = (i) => { setFormData(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, index) => index !== i) })); };
    const removeNewImage = (i) => { setNewImageFiles(prev => prev.filter((_, index) => index !== i)); };
    const handlePreviousStatusChange = (reportId, challengeId, newStatus, service) => { setPreviousUpdates(prev => ({ ...prev, [`${reportId}_${challengeId}`]: { reportId, challengeId, newStatus, service } })); };

    const handleSubmit = async (e) => {
        e.preventDefault();

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

            setShowSuccessModal(true);

        } catch (error) { setToast({ show: true, message: `فشل: ${error.message}`, type: 'error' }); } finally { setIsSaving(false); }
    };

    const handleCloseSuccessModal = () => {
        setShowSuccessModal(false);
        if (onSaveSuccess) onSaveSuccess();
        else onCancel(); 
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
                        
                        {/* --- ORIENTATION SESSION WITH COUNTS --- */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">تنوير الأقسام</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(orientationsList).map(([k, l]) => (
                                    <div key={k} className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer flex-grow">
                                            <input 
                                                type="checkbox" 
                                                checked={!!formData.other_orientations[k]} 
                                                onChange={() => handleCheckboxChange('other_orientations', k)} 
                                                className="w-4 h-4 text-sky-600 focus:ring-sky-500 rounded" 
                                            />
                                            <span className="text-sm font-semibold text-gray-800">{l}</span>
                                        </label>
                                        {!!formData.other_orientations[k] && (
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded">عدد الكوادر المدربة:</span>
                                                <Input 
                                                    type="number" 
                                                    min="1"
                                                    value={formData.orientations_counts?.[k] || ''}
                                                    onChange={(e) => handleOrientationCountChange(k, e.target.value)}
                                                    className="w-16 text-center h-8 text-sm border-sky-200"
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* --- EENC CHALLENGES TABLE --- */}
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-sky-800 mb-2 border-b pb-1">المشاكل والحلول</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse border border-gray-300" dir="rtl">
                                    <thead className="bg-gray-100 text-xs">
                                        <tr>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/4">المشكلة</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/3">الحل</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">الحالة</th>
                                            <th className="px-2 py-2 border border-gray-300 text-right w-1/6">المسؤول</th>
                                            <th className="px-2 py-2 border border-gray-300 w-1/12"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.challenges_table.map((row, index) => {
                                            const standardResp = ["مدير المركز", "منسق صحة الطفل بالمحلية", "منسق صحة الطفل بالولاية", ""];
                                            const isCustomResp = !standardResp.includes(row.responsible_person);
                                            
                                            return (
                                                <tr key={row.id}>
                                                    <td className="border p-1"><Textarea value={row.problem} onChange={(e) => handleChallengeChange(row.id, 'problem', e.target.value)} rows={2} className="w-full text-right text-xs border-gray-300 focus:border-sky-500 focus:ring-sky-500" /></td>
                                                    <td className="border p-1"><Textarea value={row.solution} onChange={(e) => handleChallengeChange(row.id, 'solution', e.target.value)} rows={2} className="w-full text-right text-xs border-gray-300 focus:border-sky-500 focus:ring-sky-500" /></td>
                                                    <td className="border align-top p-1">
                                                        <Select value={row.status || 'Pending'} onChange={(e) => handleChallengeChange(row.id, 'status', e.target.value)} className="text-[11px] font-bold p-1 border-gray-300 focus:border-sky-500 focus:ring-sky-500">
                                                            <option value="Pending">Pending</option>
                                                            <option value="In Progress">In Progress</option>
                                                            <option value="Resolved">Resolved</option>
                                                        </Select>
                                                    </td>
                                                    <td className="border align-top p-1">
                                                        <Select 
                                                            value={isCustomResp ? 'أخرى حدد' : row.responsible_person} 
                                                            onChange={(e) => handleChallengeChange(row.id, 'responsible_person', e.target.value === 'أخرى حدد' ? 'أخرى حدد' : e.target.value)} 
                                                            className="text-[11px] font-bold p-1 w-full border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                                                        >
                                                            <option value="">-- اختر --</option>
                                                            <option value="مدير المركز">مدير المركز</option>
                                                            <option value="منسق صحة الطفل بالمحلية">منسق صحة الطفل بالمحلية</option>
                                                            <option value="منسق صحة الطفل بالولاية">منسق صحة الطفل بالولاية</option>
                                                            <option value="أخرى حدد">أخرى (حدد)</option>
                                                        </Select>
                                                        {isCustomResp && (
                                                            <Textarea 
                                                                value={row.responsible_person === 'أخرى حدد' ? '' : row.responsible_person} 
                                                                onChange={(e) => handleChallengeChange(row.id, 'responsible_person', e.target.value)} 
                                                                rows={1} 
                                                                placeholder="أدخل المسؤول..."
                                                                className="w-full text-right text-xs mt-1 border-sky-200 bg-sky-50 focus:border-sky-500 focus:ring-sky-500" 
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="border text-center p-1">{index > 0 && (<Button type="button" variant="danger" size="sm" onClick={(e) => { e.preventDefault(); removeChallengeRow(row.id); }}><Trash2 size={14} /></Button>)}</td>
                                                </tr>
                                            );
                                        })}
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

                        <div className="mb-6 border-t pt-4"><h3 className="text-lg font-bold text-sky-800 mb-2">الصور</h3><div className="grid grid-cols-3 gap-2">{formData.imageUrls.map((url, i) => <div key={i} className="relative"><img src={url} className="h-20 w-full object-cover" /><Button type="button" variant="danger" size="xs" className="absolute top-0 left-0" onClick={(e)=>{ e.preventDefault(); removeExistingImage(i); }}>x</Button></div>)} {newImageFiles.map((f, i) => <div key={i} className="relative"><img src={URL.createObjectURL(f)} className="h-20 w-full object-cover" /><Button type="button" variant="danger" size="xs" className="absolute top-0 left-0" onClick={(e)=>{ e.preventDefault(); removeNewImage(i); }}>x</Button></div>)} <label className="border-2 border-dashed p-4 flex justify-center items-center cursor-pointer"><Camera /><Input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden"/></label></div></div>
                        <div className="mb-6"><FormGroup label="ملاحظات" className="text-right"><Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={3} /></FormGroup></div>
                    </div>
                    
                    <div className="flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                        <div className="flex gap-2 flex-wrap justify-start">
                            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}> إلغاء </Button>
                            <Button type="submit" disabled={isSaving} className="flex items-center gap-2"> {isSaving ? 'جاري...' : <><Save size={16}/> {existingReportData ? 'تحديث' : 'حفظ'}</>} </Button>
                        </div>
                    </div>
                </form>

                <SuccessModal 
                    isOpen={showSuccessModal} 
                    onClose={handleCloseSuccessModal} 
                    message="تم حفظ تقرير الزيارة وتحديث الحالات بنجاح." 
                />
            </Card>
        </Suspense>
    );
};