// SkillsMentorshipView.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useDataCache } from "../../DataContext";
import { Timestamp } from 'firebase/firestore';
import { PlusCircle, Trash2, FileText, Users, Building, ClipboardCheck, Archive, LayoutDashboard, Search, Share2 } from 'lucide-react';
import {
    saveMentorshipSession,
    importMentorshipSessions,
    submitFacilityDataForApproval,
    addHealthWorkerToFacility,
    deleteMentorshipSession,
    uploadFile, 
    deleteFile, 
    saveIMNCIVisitReport,
    deleteIMNCIVisitReport,
    listIMNCIVisitReports,
    saveEENCVisitReport,
    deleteEENCVisitReport
} from '../../data';

import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox, Modal
} from '../CommonComponents';


import { STATE_LOCALITIES } from "../constants.js";
import SkillsAssessmentForm from './SkillsAssessmentForm';
import MentorshipDashboard from './MentorshipDashboard';
import { getAuth } from "firebase/auth";

// --- Bulk Upload Modal ---
import DetailedMentorshipBulkUploadModal from './MentorshipBulkUpload';

// --- Mothers Form ---
import MothersForm from './IMNCIMothersForm';

// --- EENC Forms ---
import EENCSkillsAssessmentForm from './EENCSkillsAssessmentForm';
import EENCMothersForm from './EENCMothersForm';

// --- Lazy load Visit Reports ---
const IMNCIVisitReport = lazy(() =>
  import('./VisitReports.jsx').then(module => ({ default: module.IMNCIVisitReport }))
);
const EENCVisitReport = lazy(() =>
  import('./VisitReports.jsx').then(module => ({ default: module.EENCVisitReport }))
);

// --- Facility Forms Imports ---
import {
    GenericFacilityForm,
    SharedFacilityFields,
    IMNCIFormFields
} from '../FacilityForms.jsx';
import { onAuthStateChanged } from "firebase/auth";

// --- Dictionaries for Visit Report View ---
const IMNCI_SKILLS_LABELS = {
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

const IMNCI_ORIENTATIONS_LABELS = {
    orient_nutrition: "تنوير مسئول التغذية عن العلاج المتكامل",
    orient_epi: "تنوير مسئول التحصين عن العلاج المتكامل",
    orient_stats: "تنوير مسئول الاحصاء عن العلاج المتكامل",
    orient_pharmacy: "تنوير مسئول الصيدلية عن العلاج المتكامل",
};

const EENC_SKILLS_LABELS = {
    skill_pre_handwash: "تجهيزات ما قبل : غسل الايدي",
    skill_pre_equip: "تجهيز معدات الانعاش قبل الولادة",
    skill_drying: "التجفيف الجيد للطفل",
    skill_skin_to_skin: "وضع الطفل ملتصقا ببطن أمه",
    skill_suction: "شفط السواءل بالعصفورة عند الحوجة",
    skill_cord_pulse_check: "نبض الحبل السري",
    skill_clamp_placement: "وضع المشبك في المكان المناسب بعد توقف النبض",
    skill_transfer: "نقل الطفل سريعا لمنطقة الانعاش مع تغطيته",
    skill_airway: "استعدال الراس لفتح مجرى الهواء",
    skill_ambubag_placement: "وضع الامبوباق بصورة صحيحة",
    skill_ambubag_use: "استخدام الامبوباق لرفع الصدر بالهواء خلال دقيقة من الولادة",
    skill_ventilation_rate: "اعطاء 30 -60 نفس بالدقيقة",
    skill_correction_steps: "اجراءات التدخلات التصحيحية لضمان دحول الهواء بالصدر",
};

const EENC_ORIENTATIONS_LABELS = {
    orient_infection_control: "قسم مكافحة العدوى",
    orient_nicu: "قسم الحضانة",
    orient_stats: "قسم الاحصاء والمعلومات",
    orient_nutrition: "قسم التغذية عن الرعاية الضرورية المبكرة للاطفال حديث الولادة",
};


// --- AddHealthWorkerModal Component ---
const IMNCI_JOB_TITLES = [
    "مساعد طبي", "طبيب عمومي", "ممرض", "قابلة", "مسؤول تغذية", "فني مختبر", "صيدلي", "أخرى"
];
const AddHealthWorkerModal = ({ isOpen, onClose, onSave, facilityName }) => {
    const [name, setName] = useState('');
    const [job_title, setJobTitle] = useState('');
    const [training_date, setTrainingDate] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const handleSave = () => {
        if (!name.trim()) {
            setError('الاسم الكامل مطلوب.');
            return;
        }
        setError('');
        onSave({ name, job_title, training_date, phone });
        setName(''); setJobTitle(''); setTrainingDate(''); setPhone('');
    };
    const handleClose = () => {
        setName(''); setJobTitle(''); setTrainingDate(''); setPhone(''); setError('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`إضافة عامل صحي جديد لـ: ${facilityName}`} size="lg">
            <div className="p-6 text-right" dir="rtl">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
                <div className="space-y-4">
                    <FormGroup label="الاسم كامل *" className="text-right">
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ادخل الاسم الكامل" required />
                    </FormGroup>
                    <FormGroup label="الوصف الوظيفي" className="text-right">
                        <Select value={job_title} onChange={(e) => setJobTitle(e.target.value)}>
                            <option value="">-- اختر الوصف الوظيفي --</option>
                            {IMNCI_JOB_TITLES.map(title => (
                                <option key={title} value={title}>{title}</option>
                            ))}
                        </Select>
                    </FormGroup>
                    <FormGroup label="اخر تاريخ تدريب على العلاج المتكامل" className="text-right">
                        <Input type="date" value={training_date} onChange={(e) => setTrainingDate(e.target.value)} />
                    </FormGroup>
                    <FormGroup label="رقم الهاتف" className="text-right">
                        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="ادخل رقم الهاتف" />
                    </FormGroup>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                    <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                    <Button onClick={handleSave}>حفظ وإضافة</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- NEW: Facility Selection Modal ---
const FacilitySelectionModal = ({ isOpen, onClose, facilities, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filter facilities based on search term
    const filteredList = useMemo(() => {
        if (!searchTerm) return facilities;
        const lowerTerm = searchTerm.toLowerCase();
        return facilities.filter(f => (f['اسم_المؤسسة'] || '').toLowerCase().includes(lowerTerm));
    }, [facilities, searchTerm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="اختر المؤسسة الصحية">
            <div className="p-4 text-right" dir="rtl">
                <div className="mb-4 relative">
                    <Input 
                        autoFocus
                        placeholder="ابحث عن المؤسسة..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 w-full"
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                </div>
                
                <div className="max-h-96 overflow-y-auto border rounded-md bg-white shadow-inner">
                    {filteredList.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            {searchTerm ? 'لا توجد نتائج مطابقة' : 'لا توجد مؤسسات متاحة'}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredList.map(f => (
                                <div 
                                    key={f.id} 
                                    onClick={() => onSelect(f.id)}
                                    className="p-3 hover:bg-sky-50 cursor-pointer transition-colors duration-150 flex justify-between items-center group"
                                >
                                    <span className="font-medium text-gray-700 group-hover:text-sky-700">{f['اسم_المؤسسة']}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="mt-4 flex justify-end pt-2 border-t">
                    <Button variant="secondary" onClick={onClose}>إغلاق</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Post-Save Modal Component ---
const PostSaveModal = ({ isOpen, onClose, onSelect }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="الجلسة حفظت بنجاح!" size="lg">
            <div className="p-6 text-right" dir="rtl">
                <p className="text-lg mb-6">ماذا تريد أن تفعل الآن؟</p>
                <div className="flex flex-col gap-4">
                    <Button
                        variant="primary"
                        onClick={() => onSelect('skills_assessment')}
                        className="w-full justify-center"
                    >
                        بدء جلسة إشراف فني جديدة (لنفس المنشأة)
                    </Button>
                    <Button
                        variant="info"
                        onClick={() => onSelect('mothers_form')}
                        className="w-full justify-center"
                    >
                        بدء استبيان أم جديد (لنفس المنشأة)
                    </Button>
                    <Button
                        variant="info"
                        onClick={() => onSelect('visit_report')}
                        className="w-full justify-center"
                    >
                        بدء تقرير زيارة جديد (لنفس المنشأة)
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => onSelect('dashboard')}
                        className="w-full justify-center"
                    >
                        عرض المنصة (Dashboard)
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => onSelect('drafts')}
                        className="w-full justify-center"
                    >
                        عرض المسودات
                    </Button>
                    <hr className="my-2" />
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="w-full justify-center"
                    >
                        العودة إلى القائمة الرئيسية
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Visit Reports Table Component ---
const VisitReportsTable = ({ reports, onEdit, onDelete, onView }) => {
    return (
        <div dir="ltr" className="p-4 overflow-x-auto border rounded-lg bg-white">
            <table className="min-w-[900px] w-full border-collapse border border-gray-300">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Facility</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">State</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Locality</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Visit Date</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-16">Visit #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Supervisor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Action</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {reports.length === 0 ? (
                        <tr><td colSpan="7" className="border border-gray-300"><EmptyState title="No Records Found" message="No visit reports found for this service." /></td></tr>
                    ) : (
                        reports.map(rep => (
                            <tr key={rep.id}>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{rep.facilityName}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{STATE_LOCALITIES[rep.state]?.ar || rep.state}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{STATE_LOCALITIES[rep.state]?.localities.find(l => l.en === rep.locality)?.ar || rep.locality}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{rep.visitDate}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-bold border border-gray-300">{rep.visitNumber || '-'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{rep.mentorDisplay}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-left border border-gray-300">
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="info" onClick={() => onView(rep.id)}>View</Button>
                                        <Button size="sm" variant="warning" onClick={() => onEdit(rep.id)}>Edit</Button>
                                        <Button size="sm" variant="danger" onClick={() => onDelete(rep.id)}>Delete</Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

// --- View Visit Report Modal ---
const ViewVisitReportModal = ({ report, onClose }) => {
    if (!report || !report.fullData) return null;
    
    const data = report.fullData;
    const skillsLabels = report.service === 'IMNCI' ? IMNCI_SKILLS_LABELS : EENC_SKILLS_LABELS;
    const orientLabels = report.service === 'IMNCI' ? IMNCI_ORIENTATIONS_LABELS : EENC_ORIENTATIONS_LABELS;

    const trainedSkills = Object.entries(data.trained_skills || {})
        .filter(([_, val]) => val)
        .map(([key]) => skillsLabels[key] || key);
        
    const orientations = Object.entries(data.other_orientations || {})
        .filter(([_, val]) => val)
        .map(([key]) => orientLabels[key] || key);

    return (
        <Modal isOpen={true} onClose={onClose} title={`تفاصيل تقرير الزيارة: ${report.facilityName}`} size="2xl">
            <div className="p-6 text-right" dir="rtl">
                <div className="mb-6">
                    <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">معلومات الزيارة</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p><span className="font-medium text-gray-500">المنشأة:</span> <span className="font-semibold text-gray-900">{report.facilityName}</span></p>
                        <p><span className="font-medium text-gray-500">التاريخ:</span> <span className="font-semibold text-gray-900">{report.visitDate}</span></p>
                        <p><span className="font-medium text-gray-500">رقم الزيارة:</span> <span className="font-semibold text-gray-900">{report.visitNumber || 1}</span></p>
                        <p><span className="font-medium text-gray-500">المشرف:</span> <span className="font-semibold text-gray-900">{report.mentorDisplay}</span></p>
                        <p><span className="font-medium text-gray-500">الولاية:</span> <span className="font-semibold text-gray-900">{STATE_LOCALITIES[report.state]?.ar || report.state}</span></p>
                        <p><span className="font-medium text-gray-500">المحلية:</span> <span className="font-semibold text-gray-900">{STATE_LOCALITIES[report.state]?.localities.find(l => l.en === report.locality)?.ar || report.locality}</span></p>
                    </div>
                </div>

                <div className="mb-6">
                    <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">المهارات المدربة</h4>
                    {trainedSkills.length > 0 ? (
                        <ul className="list-disc pr-6 space-y-1">
                            {trainedSkills.map((skill, i) => <li key={i} className="text-sm text-gray-800">{skill}</li>)}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-sm">لا توجد مهارات مسجلة.</p>
                    )}
                </div>

                <div className="mb-6">
                    <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">تنوير الأقسام</h4>
                    {orientations.length > 0 ? (
                        <ul className="list-disc pr-6 space-y-1">
                            {orientations.map((orient, i) => <li key={i} className="text-sm text-gray-800">{orient}</li>)}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-sm">لا يوجد تنوير مسجل.</p>
                    )}
                </div>

                <div className="mb-6">
                    <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">المشاكل والحلول</h4>
                    {data.challenges_table && data.challenges_table.length > 0 && data.challenges_table[0].problem ? (
                        <div className="overflow-x-auto border rounded">
                            <table className="min-w-full text-xs text-right">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-2 py-2 border">المشكلة</th>
                                        <th className="px-2 py-2 border">حل اني</th>
                                        <th className="px-2 py-2 border">حالة (اني)</th>
                                        <th className="px-2 py-2 border">حل بعيد المدى</th>
                                        <th className="px-2 py-2 border">حالة (بعيد)</th>
                                        <th className="px-2 py-2 border">المسؤول</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.challenges_table.map((row, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="px-2 py-2 border">{row.problem}</td>
                                            <td className="px-2 py-2 border">{row.immediate_solution}</td>
                                            <td className="px-2 py-2 border">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                                    row.immediate_status === 'Done' ? 'bg-green-100 text-green-800' :
                                                    row.immediate_status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {row.immediate_status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 border">{row.long_term_solution}</td>
                                            <td className="px-2 py-2 border">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                                    row.long_term_status === 'Done' ? 'bg-green-100 text-green-800' :
                                                    row.long_term_status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {row.long_term_status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 border">{row.responsible_person}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                         <p className="text-gray-500 text-sm">لا توجد مشاكل مسجلة.</p>
                    )}
                </div>

                {data.imageUrls && data.imageUrls.length > 0 && (
                    <div className="mb-6">
                        <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">الصور</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {data.imageUrls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block border rounded overflow-hidden hover:opacity-75">
                                    <img src={url} alt={`Visit img ${i}`} className="w-full h-24 object-cover" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {data.notes && (
                    <div className="mt-6">
                        <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">ملاحظات إضافية</h4>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border whitespace-pre-wrap">{data.notes}</p>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>إغلاق</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Mentorship Table Column Component ---
const MentorshipTableColumns = () => (
    <>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-10">#</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Facility</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Health Worker/Service</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Supervisor</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-24">Date</th>
        <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-16">Visit #</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300 w-20">Status</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-3D0 w-16">Score</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-3D0 w-32">Action</th>
    </>
);

// --- Friendly Service Titles ---
const SERVICE_TITLES = {
    'IMNCI': 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)',
    'EENC': 'Early Essential Newborn Care (EENC)',
    'ETAT': 'Emergency Triage, Assessment and Treatment (ETAT)',
    'IPC': 'Infection Prevention and Control in Neonatal Units (IPC)',
    'IMNCI_MOTHERS': 'Mother\'s Knowledge & Satisfaction Survey (IMNCI)',
    'EENC_MOTHERS': 'Mother\'s Survey (EENC)'
};

// --- View Submission Modal ---
const ViewSubmissionModal = ({ submission, onClose }) => {
    if (!submission) return null;

    const scores = submission.scores || {};
    const serviceTitle = SERVICE_TITLES[submission.serviceType] || submission.serviceType;

    const renderScore = (scoreKey, label) => {
        const score = scores[`${scoreKey}_score`];
        const maxScore = scores[`${scoreKey}_maxScore`];
        let percentage = null;

        if (score !== undefined && maxScore !== undefined && maxScore > 0) {
            percentage = Math.round((score / maxScore) * 100);
        }
        else if (score === 0 && maxScore === 0) {
             percentage = null; 
        }

        return (
            <li className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">
                    {percentage !== null ? `${percentage}%` : 'N/A'}
                    <span className="text-xs font-normal text-gray-500 mr-2" dir="ltr">({score !== undefined ? score : 0}/{maxScore !== undefined ? maxScore : 0})</span>
                </span>
            </li>
        );
    };

    if (submission.serviceType === 'IMNCI_MOTHERS' || submission.serviceType === 'EENC_MOTHERS') {
         const { mothersKnowledge = {}, mothersSatisfaction = {}, eencMothersData = {} } = submission;
         
         const dataToRender = submission.serviceType === 'EENC_MOTHERS' ? eencMothersData : mothersKnowledge;
         const titleToRender = submission.serviceType === 'EENC_MOTHERS' ? 'استبيان الأمهات (EENC)' : 'معرفة الأمهات';

         const renderMotherData = (data, title) => (
             <div className="mb-6">
                <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">{title}</h4>
                <ul className="space-y-2 pr-2 text-sm">
                    {Object.entries(data).map(([key, value]) => (
                        <li key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="font-medium text-gray-700">{key.replace(/_/g, ' ')}</span>
                            <span className="font-bold text-gray-900">{value}</span>
                        </li>
                    ))}
                     {mothersSatisfaction.other_note && (
                         <li className="p-2 bg-yellow-50 rounded">
                            <span className="font-medium text-gray-700">ملاحظات أخرى (رضا):</span>
                            <span className="font-bold text-gray-900 mr-2">{mothersSatisfaction.other_note}</span>
                        </li>
                     )}
                </ul>
             </div>
         );

         return (
             <Modal isOpen={true} onClose={onClose} title={`تفاصيل استبيان الأم: ${submission.facilityName}`} size="2xl">
                 <div className="p-6 text-right" dir="rtl">
                     <div className="mb-6">
                         <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">بيانات الاستبيان</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                             <p><span className="font-medium text-gray-500">اسم الأم:</span> <span className="font-semibold text-gray-900">{submission.motherName}</span></p>
                             <p><span className="font-medium text-gray-500">عمر الطفل:</span> <span className="font-semibold text-gray-900">{submission.childAge}</span></p>
                             <p><span className="font-medium text-gray-500">المؤسسة:</span> <span className="font-semibold text-gray-900">{submission.facilityName}</span></p>
                             <p><span className="font-medium text-gray-500">المشرف:</span> <span className="font-semibold text-gray-900">{submission.mentorEmail}</span></p>
                             <p><span className="font-medium text-gray-500">التاريخ:</span> <span className="font-semibold text-gray-900">{submission.sessionDate}</span></p>
                             <p><span className="font-medium text-gray-500">الولاية:</span> <span className="font-semibold text-gray-900">{STATE_LOCALITIES[submission.state]?.ar || submission.state}</span></p>
                             <p><span className="font-medium text-gray-500">رقم الزيارة:</span> <span className="font-semibold text-gray-900">{submission.visitNumber || 1}</span></p>
                         </div>
                     </div>
                     
                     {renderMotherData(dataToRender, titleToRender)}
                     {submission.serviceType === 'IMNCI_MOTHERS' && renderMotherData(mothersSatisfaction, 'رضا الأمهات')}

                     {submission.notes && (
                         <div className="mt-6">
                             <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">الملاحظات</h4>
                             <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border whitespace-pre-wrap">{submission.notes}</p>
                         </div>
                     )}
                     <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                         <Button variant="secondary" onClick={onClose}>إغلاق</Button>
                     </div>
                 </div>
             </Modal>
         );
    }

    return (
        <Modal isOpen={true} onClose={onClose} title={`تفاصيل جلسة: ${serviceTitle}`} size="2xl">
            <div className="p-6 text-right" dir="rtl">
                <div className="mb-6">
                    <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">بيانات الجلسة</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p><span className="font-medium text-gray-500">العامل الصحي:</span> <span className="font-semibold text-gray-900">{submission.healthWorkerName}</span></p>
                        <p><span className="font-medium text-gray-500">المؤسسة:</span> <span className="font-semibold text-gray-900">{submission.facilityName}</span></p>
                        <p><span className="font-medium text-gray-500">المشرف:</span> <span className="font-semibold text-gray-900">{submission.mentorEmail}</span></p>
                        <p><span className="font-medium text-gray-500">التاريخ:</span> <span className="font-semibold text-gray-900">{submission.sessionDate}</span></p>
                        <p><span className="font-medium text-gray-500">الولاية:</span> <span className="font-semibold text-gray-900">{STATE_LOCALITIES[submission.state]?.ar || submission.state}</span></p>
                        <p><span className="font-medium text-gray-500">المحلية:</span> <span className="font-semibold text-gray-900">{STATE_LOCALITIES[submission.state]?.localities.find(l=>l.en === submission.locality)?.ar || submission.locality}</span></p>
                        <p><span className="font-medium text-gray-500">رقم الزيارة:</span> <span className="font-semibold text-gray-900">{submission.visitNumber || 1}</span></p>
                    </div>
                </div>

                <div>
                    <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">الدرجات التفصيلية</h4>
                    <ul className="space-y-2 pr-2">
                        {renderScore('overallScore', 'الدرجة الكلية')}
                        <hr className="my-2"/>
                        {submission.serviceType === 'IMNCI' && (
                            <>
                                {renderScore('assessment_total_score', 'مهارات التقييم والتصنيف')}
                                {renderScore('vitalSigns', ' - القياسات الحيوية')}
                                {renderScore('dangerSigns', ' - علامات الخطورة العامة')}
                                {renderScore('mainSymptoms', ' - الأعراض الأساسية (الإجمالي)')}
                                {renderScore('symptom_cough', '   - الكحة')}
                                {renderScore('symptom_diarrhea', '   - الإسهال')}
                                {renderScore('symptom_fever', '   - الحمى')}
                                {renderScore('symptom_ear', '   - الأذن')}
                                {renderScore('malnutrition', ' - سوء التغذية')}
                                {renderScore('anemia', ' - فقر الدم')}
                                {renderScore('immunization', ' - التطعيم وفيتامين أ')}
                                {renderScore('otherProblems', ' - الأمراض الأخرى')}
                                {renderScore('finalDecision', 'القرار النهائي')}
                                <hr className="my-2"/>
                                {renderScore('treatment', 'مهارات العلاج والنصح (الإجمالي)')}
                                {renderScore('ref_treatment', ' - العلاج قبل التحويل')}
                                {renderScore('pneu_treatment', ' - علاج الإلتهاب الرئوي')}
                                {renderScore('diar_treatment', ' - علاج الإسهال')}
                                {renderScore('dyst_treatment', ' - علاج الدسنتاريا')}
                                {renderScore('mal_treatment', ' - علاج الملاريا')}
                                {renderScore('ear_treatment', ' - علاج الأذن')}
                                {renderScore('nut_treatment', ' - علاج سوء التغذية')}
                                {renderScore('anemia_treatment', ' - علاج فقر الدم')}
                                {renderScore('fu_treatment', ' - نصح المتابعة')}
                            </>
                        )}
                    </ul>
                </div>

                {submission.notes && (
                    <div className="mt-6">
                        <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">الملاحظات</h4>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border whitespace-pre-wrap">{submission.notes}</p>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>إغلاق</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Drafts Modal ---
const DraftsModal = ({ isOpen, onClose, drafts, onView, onEdit, onDelete }) => {
    const handleAction = (action, submissionId) => {
        if (action === 'view') {
            onView(submissionId);
        } else if (action === 'edit') {
            onEdit(submissionId);
        } else if (action === 'delete') {
            onDelete(submissionId);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="المسودات المحفوظة" size="xl">
            <div className="p-6 text-right" dir="rtl">
                {drafts.length === 0 ? (
                    <EmptyState message="لا توجد مسودات محفوظة لهذا المستخدم/الخدمة." />
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {drafts.map(draft => (
                            <div key={draft.id} className="p-3 border rounded-lg bg-yellow-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div className="text-sm flex-grow">
                                    <p><span className="font-medium text-gray-600">العامل الصحي:</span> <span className="font-semibold text-gray-900">{draft.staff}</span></p>
                                    <p><span className="font-medium text-gray-600">المؤسسة:</span> <span className="font-semibold text-gray-900">{draft.facility}</span></p>
                                    <p><span className="font-medium text-gray-600">تاريخ المسودة:</span> <span className="font-semibold text-gray-900">{draft.date}</span></p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                    <Button size="sm" variant="info" onClick={() => handleAction('view', draft.id)}>عرض</Button>
                                    <Button size="sm" variant="warning" onClick={() => handleAction('edit', draft.id)}>تعديل</Button>
                                    <Button size="sm" variant="danger" onClick={() => handleAction('delete', draft.id)}>حذف</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>إغلاق</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Mentorship Submissions Table Component ---
const MentorshipSubmissionsTable = ({
    submissions, activeService, onView, onEdit, onDelete,
    fetchSubmissions, isSubmissionsLoading,
    filterServiceType,
    stateFilter, localityFilter, supervisorFilter, statusFilter
}) => {
    
    const handleAction = (action, submission) => {
        if (action === 'view') {
            onView(submission.id);
        } else if (action === 'edit') {
            onEdit(submission.id);
        } else if (action === 'delete') {
            onDelete(submission.id);
        }
    };

    const filteredSubmissions = useMemo(() => {
        let filtered = submissions;
        const motherServiceType = `${activeService}_MOTHERS`;

        if (activeService) {
            filtered = filtered.filter(sub => sub.service === activeService || sub.service === motherServiceType); 
        }
        if (filterServiceType) {
            filtered = filtered.filter(sub => sub.service === filterServiceType);
        }
        if (stateFilter) {
             filtered = filtered.filter(sub => sub.state === stateFilter);
        }
        if (localityFilter) {
             filtered = filtered.filter(sub => sub.locality === localityFilter);
        }
        if (supervisorFilter) {
            filtered = filtered.filter(sub => sub.supervisorEmail === supervisorFilter);
        }
        if (statusFilter) {
             filtered = filtered.filter(sub => sub.status === statusFilter);
        }
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [submissions, activeService, filterServiceType, stateFilter, localityFilter, supervisorFilter, statusFilter]);

    return (
        <div dir="ltr" className="p-4"> 
                {/* Table Container - Added overflow-x-auto and shadow for better UI */}
                <div className="mt-6 w-full overflow-x-auto border border-gray-300 rounded-lg shadow-sm">
                     {isSubmissionsLoading ? (
                        <div className="flex justify-center p-8"><Spinner /></div>
                    ) : (
                        // Added min-w-[1200px] so fixed columns render correctly on mobile
                        <table className="min-w-[1200px] w-full border-collapse table-fixed" dir="ltr"> 
                            <thead className="bg-gray-50">
                                <tr>
                                    <MentorshipTableColumns />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSubmissions.length === 0 ? (
                                    <tr><td colSpan="9" className="border border-gray-300"><EmptyState title="No Records Found" message="No mentorship visits matched the current filters." /></td></tr>
                                ) : (
                                    filteredSubmissions.map((sub, index) => {
                                        const scoreData = sub.scores;
                                        let percentage = null;
                                        if (scoreData && scoreData.overallScore_maxScore > 0) {
                                            percentage = Math.round((scoreData.overallScore_score / scoreData.overallScore_maxScore) * 100);
                                        }

                                        // Determine worker name/service for display
                                        const motherServiceType = `${activeService}_MOTHERS`;
                                        const isMotherSurvey = sub.service === motherServiceType;
                                
                                        const workerDisplay = isMotherSurvey 
                                            ? `Survey: ${sub.motherName || 'N/A'}`
                                            : sub.staff;
                                        const serviceStatus = isMotherSurvey 
                                            ? 'Mother\'s Survey' 
                                            : (sub.status === 'draft' ? 'Draft' : 'Complete');

                                        return (
                                        <tr key={sub.id} className={sub.status === 'draft' ? 'bg-yellow-50' : (isMotherSurvey ? 'bg-blue-50' : 'bg-white')}>
                                            {/* # Column */}
                                            <td className="px-2 py-2 text-sm font-medium text-gray-900 text-left border border-gray-300">{index + 1}</td>
                                            
                                            {/* Facility - Allow wrapping */}
                                            <td className="px-2 py-2 text-xs text-gray-500 text-left border border-gray-300 break-words whitespace-normal">{sub.facility}</td>
                                            
                                            {/* Worker - Allow wrapping */}
                                            <td className="px-2 py-2 text-xs text-gray-500 text-left font-semibold border border-gray-300 break-words whitespace-normal">{workerDisplay}</td>
                                            
                                            {/* Supervisor - Allow wrapping */}
                                            <td className="px-2 py-2 text-xs text-gray-500 text-left border border-gray-300 break-words whitespace-normal">{sub.supervisorDisplay}</td> 
                                            
                                            {/* Date - No wrap */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 text-left border border-gray-300">{sub.date}</td>
                                            
                                            {/* NEW: Visit # Column */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-center font-bold border border-gray-300">
                                                {sub.visitNumber || '-'}
                                            </td>

                                            {/* Status */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-left border border-gray-300">
                                                {isMotherSurvey ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                        {serviceStatus}
                                                    </span>
                                                ) : sub.status === 'draft' ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                        {serviceStatus}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                        {serviceStatus}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Score */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-800 text-left border border-gray-300">
                                                {isMotherSurvey ? 'N/A' : (percentage !== null ? `${percentage}%` : 'N/A')}
                                            </td>

                                            {/* Actions - Flex container handles width */}
                                            <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-left border border-gray-300">
                                                <div className="flex flex-col xl:flex-row gap-1">
                                                    <Button size="sm" variant="info" onClick={() => handleAction('view', sub)} className="text-xs px-2 py-1">View</Button>
                                                    {/* MODIFIED: Allow Edit for Mothers too */}
                                                    {(sub.service === 'IMNCI' || sub.service === 'IMNCI_MOTHERS' || sub.service === 'EENC_MOTHERS') && 
                                                        <Button size="sm" variant="warning" onClick={() => handleAction('edit', sub)} className="text-xs px-2 py-1">Edit</Button>
                                                    }
                                                    <Button size="sm" variant="danger" onClick={() => handleAction('delete', sub)} className="text-xs px-2 py-1">Del</Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="flex justify-center mt-4">
                    <Button variant="secondary" onClick={() => fetchSubmissions(true)}>Refresh Data</Button>
                </div>
        </div>
    );
};


// --- Service Selection Component ---
const ServiceSelector = ({ onSelectService }) => {
    const services = [
        { key: 'IMNCI', title: 'Mentorship on Integrated Management of Newborn and Childhood Illnesses (IMNCI)', enabled: true },
        { key: 'EENC', title: 'Mentorship on Early Essential Newborn Care (EENC)', enabled: true },
        { key: 'ETAT', title: 'Mentorship on Emergency Triage, Assessment and Treatment (ETAT)', enabled: false },
        { key: 'IPC', title: 'Mentorship on Infection Prevention and Control in Neonatal Units (IPC)', enabled: false }
    ];

    return (
        <Card className="p-6" dir="ltr">
            <div className="text-left flex justify-between items-start">
                <PageHeader
                    title="Choose Service for Mentorship"
                    subtitle="Select a program to begin skills mentorship."
                />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map(service => (
                    <button
                        key={service.key}
                        disabled={!service.enabled}
                        className={`border rounded-lg p-6 text-left transition-all duration-200 ${service.enabled ? 'hover:shadow-md hover:scale-105' : 'opacity-60 cursor-not-allowed bg-gray-50'}`}
                        onClick={() => service.enabled && onSelectService(service.key)}
                    >
                        <div className="flex items-center gap-4">
                            <CourseIcon course={service.key} />
                            <div>
                                <div className="font-semibold text-gray-800 text-left">{service.title}</div>
                                <div className="text-xs text-gray-500 mt-1 text-left">
                                    {service.enabled ? 'Click to start session' : 'Coming Soon'}
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </Card>
    );
};


// --- Main View Component ---
const SkillsMentorshipView = ({
    setToast,
    permissions,
    userStates,
    userLocalities,
    publicSubmissionMode = false,
    publicServiceType = null,
    canBulkUploadMentorships = false,
    publicDashboardMode = false, // NEW: Public Dashboard View flag
    publicDashboardParams = null // NEW: Dashboard initial filters
}) => {
    // Modify initial view state to handle public dashboard routing
    const [currentView, setCurrentView] = useState(
        publicDashboardMode ? 'history' : (publicSubmissionMode ? 'form_setup' : 'service_selection')
    );
    const [activeService, setActiveService] = useState(
        publicDashboardMode ? publicDashboardParams?.serviceType : (publicSubmissionMode ? publicServiceType : null)
    );
    
    const [selectedState, setSelectedState] = useState('');
    const [selectedLocality, setSelectedLocality] = useState('');
    const [selectedFacilityId, setSelectedFacilityId] = useState('');
    const [selectedHealthWorkerName, setSelectedHealthWorkerName] = useState('');

    const [activeTab, setActiveTab] = useState(publicDashboardMode ? 'dashboard' : 'skills_list');
    const [activeFormType, setActiveFormType] = useState('skills_assessment');
    const [isReadyToStart, setIsReadyToStart] = useState(false);

    // Initialize Dashboard Filters with parameters if available
    const [activeDashboardState, setActiveDashboardState] = useState(publicDashboardMode ? publicDashboardParams?.state || '' : '');
    const [activeDashboardLocality, setActiveDashboardLocality] = useState(publicDashboardMode ? publicDashboardParams?.locality || '' : '');
    const [activeDashboardFacilityId, setActiveDashboardFacilityId] = useState(publicDashboardMode ? publicDashboardParams?.facilityId || '' : '');
    const [activeDashboardWorkerName, setActiveDashboardWorkerName] = useState(publicDashboardMode ? publicDashboardParams?.workerName || '' : '');

    // --- State for Viewing Visit Reports ---
    const [viewingVisitReport, setViewingVisitReport] = useState(null);

    // --- State for Facility Selection Modal ---
    const [isFacilitySelectionModalOpen, setIsFacilitySelectionModalOpen] = useState(false);

    const {
        healthFacilities,
        fetchHealthFacilities,
        isLoading: isDataCacheLoading,
        skillMentorshipSubmissions,
        fetchSkillMentorshipSubmissions,
        imnciVisitReports,
        fetchIMNCIVisitReports,
        eencVisitReports,
        fetchEENCVisitReports,
        isFacilitiesLoading,
    } = useDataCache();

    const [localHealthFacilities, setLocalHealthFacilities] = useState(healthFacilities || []);

    useEffect(() => {
        if (healthFacilities) {
            setLocalHealthFacilities(healthFacilities);
        }
    }, [healthFacilities]);

    const [viewingSubmission, setViewingSubmission] = useState(null);
    const [editingSubmission, setEditingSubmission] = useState(null);

    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
    const [uploadStatus, setUploadStatus] = useState({
        inProgress: false,
        processed: 0,
        total: 0,
        errors: [],
        message: ''
    });
    const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
    const auth = getAuth();
    const user = auth.currentUser;
    const [selectedWorkerOriginalData, setSelectedWorkerOriginalData] = useState(null);
    const [workerJobTitle, setWorkerJobTitle] = useState('');
    const [workerTrainingDate, setWorkerTrainingDate] = useState('');
    const [workerPhone, setWorkerPhone] = useState('');
    const [isWorkerInfoChanged, setIsWorkerInfoChanged] = useState(false);
    const [isUpdatingWorker, setIsUpdatingWorker] = useState(false);

    const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
    
    // --- REMOVED: isAddFacilityModalOpen State ---

    const [isMothersFormModalOpen, setIsMothersFormModalOpen] = useState(false);
    const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
    const [isVisitReportModalOpen, setIsVisitReportModalOpen] = useState(false);
    const [isPostSaveModalOpen, setIsPostSaveModalOpen] = useState(false);
    const [lastSavedFacilityInfo, setLastSavedFacilityInfo] = useState(null);
 
    const formRef = useRef(null);
    
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [supervisorFilter, setSupervisorFilter] = useState(''); 
    const [statusFilter, setStatusFilter] = useState('');

    // --- NEW: Calculate permission to edit visit number ---
    const canEditVisitNumber = useMemo(() => {
        if (publicSubmissionMode || publicDashboardMode) return false;
        // Check if user has Federal Manager scope or is explicitly a super user/federal manager
        return permissions?.manageScope === 'federal' || 
               permissions?.role === 'super_user' || 
               permissions?.role === 'federal_manager';
    }, [permissions, publicSubmissionMode, publicDashboardMode]);
    // -------------------------------------------------------------

    const processedSubmissions = useMemo(() => {
        if (!skillMentorshipSubmissions) return [];
        return skillMentorshipSubmissions.map(sub => ({
            id: sub.id,
            service: sub.serviceType,
            date: sub.effectiveDate ? new Date(sub.effectiveDate.seconds * 1000).toISOString().split('T')[0] : (sub.sessionDate || 'N/A'),
            effectiveDateTimestamp: sub.effectiveDate,
            state: sub.state || 'N/A',
            locality: sub.locality || 'N/A',
            facility: sub.facilityName || 'N/A',
            staff: sub.healthWorkerName || 'N/A',
            supervisorEmail: sub.mentorEmail || null,
            supervisorName: sub.mentorName || null,
            supervisorDisplay: sub.mentorName || sub.mentorEmail || 'N/A',
            facilityId: sub.facilityId || null,
            scores: sub.scores || null,
            status: sub.status || 'complete',
            facilityType: sub.facilityType || null,
            workerType: sub.workerType || null,
            motherName: sub.motherName || null,
            visitNumber: sub.visitNumber || null,
            sessionDate: sub.sessionDate || (sub.effectiveDate ? new Date(sub.effectiveDate.seconds * 1000).toISOString().split('T')[0] : null),
            fullData: sub 
        }));
    }, [skillMentorshipSubmissions]);

    // --- NEW: Calculate Worker History to pass to Form ---
    const workerHistory = useMemo(() => {
        if (!processedSubmissions || !selectedFacilityId || !selectedHealthWorkerName || !activeService) return [];
        return processedSubmissions.filter(sub =>
            sub.facilityId === selectedFacilityId &&
            sub.staff === selectedHealthWorkerName &&
            sub.service === activeService &&
            sub.status !== 'draft' &&
            sub.sessionDate
        );
    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService]);
    // ---------------------------------------------------

    const currentUserDrafts = useMemo(() => {
        if (!user || !processedSubmissions || !activeService) return [];
        return processedSubmissions.filter(sub =>
            sub.status === 'draft' &&
            sub.supervisorEmail === user.email &&
            sub.service === activeService
        ).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [processedSubmissions, user, activeService]);


    const processedVisitReports = useMemo(() => {
        const imnci = (imnciVisitReports || []).map(rep => ({
            id: rep.id,
            service: 'IMNCI',
            facilityId: rep.facilityId || null,
            facilityName: rep.facilityName || 'N/A',
            state: rep.state || 'N/A',
            locality: rep.locality || 'N/A',
            visitDate: rep.visit_date || 'N/A',
            visitNumber: rep.visitNumber || null, // Map visitNumber
            mentorEmail: rep.mentorEmail || null,
            mentorName: rep.mentorName || null,
            mentorDisplay: rep.mentorName || rep.mentorEmail || 'N/A',
            fullData: rep
        }));
        
        const eenc = (eencVisitReports || []).map(rep => ({
            id: rep.id,
            service: 'EENC',
            facilityId: rep.facilityId || null,
            facilityName: rep.facilityName || 'N/A',
            state: rep.state || 'N/A',
            locality: rep.locality || 'N/A',
            visitDate: rep.visit_date || 'N/A',
            visitNumber: rep.visitNumber || null, // Map visitNumber
            mentorEmail: rep.mentorEmail || null,
            mentorName: rep.mentorName || null,
            mentorDisplay: rep.mentorName || rep.mentorEmail || 'N/A',
            fullData: rep
        }));

        const allReports = [...imnci, ...eenc];
        return allReports.filter(rep => rep.service === activeService);

    }, [imnciVisitReports, eencVisitReports, activeService]);

    const handleEditVisitReport = (reportId) => {
        const reportList = activeService === 'IMNCI' ? imnciVisitReports : eencVisitReports;
        if (!reportList) return;

        const report = reportList.find(r => r.id === reportId);
        if (!report) return;

        setSelectedState(report.state);
        setSelectedLocality(report.locality);
        setSelectedFacilityId(report.facilityId);
        setEditingSubmission(report);
        setActiveFormType('visit_report');
        setCurrentView('form_setup');
        setIsReadyToStart(true); 
    };

    // --- Handle Viewing Visit Report ---
    const handleViewVisitReport = (reportId) => {
        const report = processedVisitReports.find(r => r.id === reportId);
        if (report) {
            setViewingVisitReport(report);
        }
    };

    const handleDeleteVisitReport = async (reportId) => {
        if (window.confirm('Are you sure you want to delete this visit report?')) {
            try {
                if (activeService === 'IMNCI') {
                    await deleteIMNCIVisitReport(reportId);
                    await fetchIMNCIVisitReports(true);
                } else if (activeService === 'EENC') {
                    await deleteEENCVisitReport(reportId);
                    await fetchEENCVisitReports(true);
                }
                setToast({ show: true, message: 'Report deleted.', type: 'success' });
            } catch (error) {
                setToast({ show: true, message: `Delete failed: ${error.message}`, type: 'error' });
            }
        }
    };

    // --- Handle Challenge Status Update (Federal Manager) ---
    const handleChallengeStatusUpdate = async (reportId, challengeId, newStatus, fieldName = 'status') => {
        const reportList = activeService === 'IMNCI' ? imnciVisitReports : eencVisitReports;
        const report = reportList.find(r => r.id === reportId);
        
        if (!report) {
            setToast({ show: true, message: 'Report not found', type: 'error' });
            return;
        }

        // Clone challenges table and update specific row and specific field
        const updatedChallenges = (report.challenges_table || []).map(ch => 
            ch.id === challengeId ? { ...ch, [fieldName]: newStatus } : ch
        );

        const payload = {
            ...report,
            challenges_table: updatedChallenges,
            lastUpdatedAt: Timestamp.now(),
            statusUpdatedBy: user?.email || 'Unknown'
        };
        // Remove potential ID field before saving
        const { id, ...dataToSave } = payload;

        try {
            if (activeService === 'IMNCI') {
                await saveIMNCIVisitReport(dataToSave, reportId);
                await fetchIMNCIVisitReports(true);
            } else {
                await saveEENCVisitReport(dataToSave, reportId);
                if (fetchEENCVisitReports) await fetchEENCVisitReports(true);
            }
            setToast({ show: true, message: 'Status updated successfully', type: 'success' });
        } catch (error) {
            console.error("Error updating status:", error);
            setToast({ show: true, message: `Failed to update status: ${error.message}`, type: 'error' });
        }
    };


     useEffect(() => {
        // In public dashboard mode we still want to fetch this data if available
        fetchHealthFacilities();
        fetchSkillMentorshipSubmissions();
        fetchIMNCIVisitReports(); 
        if (fetchEENCVisitReports) fetchEENCVisitReports();

    }, [fetchHealthFacilities, fetchSkillMentorshipSubmissions, fetchIMNCIVisitReports, fetchEENCVisitReports]);
    
    useEffect(() => {
        if (!publicDashboardMode) {
            setStateFilter('');
            setLocalityFilter('');
            setSupervisorFilter('');
            setStatusFilter('');
        }
    }, [activeTab, publicDashboardMode]);


     const availableStates = useMemo(() => {
        const allStates = Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar));
        const userAllowedStates = allStates.filter(sKey =>
             publicSubmissionMode || publicDashboardMode || !userStates || userStates.length === 0 || userStates.includes(sKey)
        );
        return [
            { key: "", label: "-- اختر الولاية --" },
            ...userAllowedStates.map(sKey => ({ key: sKey, label: STATE_LOCALITIES[sKey].ar }))
        ];
    }, [userStates, publicSubmissionMode, publicDashboardMode]);

    const uniqueSupervisors = useMemo(() => {
        const supervisorMap = new Map();
        processedSubmissions.forEach(sub => {
            if (sub.supervisorEmail) {
                if (!supervisorMap.has(sub.supervisorEmail)) {
                    supervisorMap.set(sub.supervisorEmail, sub.supervisorDisplay);
                } else {
                    if (sub.supervisorName) {
                        supervisorMap.set(sub.supervisorEmail, sub.supervisorDisplay);
                    }
                }
            }
        });
        return Array.from(supervisorMap.entries())
            .map(([email, display]) => ({ email, display }))
            .sort((a, b) => a.display.localeCompare(b.display));
    }, [processedSubmissions]);

    const availableLocalities = useMemo(() => {
        if (!stateFilter || !STATE_LOCALITIES[stateFilter]) return [];
        return [
            { key: "", label: "Select Locality" },
            ...STATE_LOCALITIES[stateFilter].localities.sort((a, b) => a.ar.localeCompare(b.ar)).map(l => ({ key: l.en, label: l.ar }))
        ];
    }, [stateFilter]);


     useEffect(() => {
        if (!publicSubmissionMode && !publicDashboardMode && userStates && userStates.length === 1) {
            setSelectedState(userStates[0]);
        }
    }, [userStates, publicSubmissionMode, publicDashboardMode]);

    useEffect(() => {
       if (!publicSubmissionMode && !publicDashboardMode && permissions?.manageScope === 'locality' && userLocalities && userLocalities.length === 1) {
            setSelectedLocality(userLocalities[0]);
        }
    }, [userLocalities, permissions?.manageScope, publicSubmissionMode, publicDashboardMode]);


    const handleStateChange = (e) => {
        setSelectedState(e.target.value);
        if ((permissions?.manageScope !== 'locality') || publicSubmissionMode) {
             setSelectedLocality('');
        }
        setSelectedFacilityId('');
        setSelectedHealthWorkerName('');
        setSelectedWorkerOriginalData(null);
        setWorkerJobTitle('');
        setWorkerTrainingDate('');
        setWorkerPhone('');
        setIsWorkerInfoChanged(false);
        setIsReadyToStart(false);
    };


    const filteredFacilities = useMemo(() => {
        if (!localHealthFacilities || !selectedState || !selectedLocality) return [];
        return localHealthFacilities.filter(f => f['الولاية'] === selectedState && f['المحلية'] === selectedLocality)
               .sort((a, b) => (a['اسم_المؤسسة'] || '').localeCompare(b['اسم_المؤسسة'] || ''));
    }, [localHealthFacilities, selectedState, selectedLocality]);

    // --- Facility Selection Handler ---
    const handleFacilitySelect = (facilityId) => {
        setSelectedFacilityId(facilityId);
        setSelectedHealthWorkerName('');
        setSelectedWorkerOriginalData(null); 
        setWorkerJobTitle(''); 
        setWorkerTrainingDate(''); 
        setWorkerPhone(''); 
        setIsWorkerInfoChanged(false);
        setIsReadyToStart(false);
        setIsFacilitySelectionModalOpen(false);
    };

    const selectedFacility = useMemo(() => {
        return filteredFacilities.find(f => f.id === selectedFacilityId);
    }, [filteredFacilities, selectedFacilityId]);

    const healthWorkers = useMemo(() => {
        if (!selectedFacility || !selectedFacility.imnci_staff) return [];
        try {
            const staffList = typeof selectedFacility.imnci_staff === 'string'
                ? JSON.parse(selectedFacility.imnci_staff)
                : selectedFacility.imnci_staff;
            if (!Array.isArray(staffList)) return [];
            return staffList
                .map(s => ({
                    id: s.name,
                    name: s.name || 'N/A',
                }))
                .filter(w => w.name !== 'N/A')
                .sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
            console.error("Error processing imnci_staff for dropdown:", e);
            return [];
        }
    }, [selectedFacility]);

    const visitNumber = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return 1;
        }

        if (editingSubmission) {
             return editingSubmission.visitNumber || 1; 
        }

        const workerSessions = processedSubmissions.filter(sub =>
            sub.facilityId === selectedFacilityId &&
            sub.staff === selectedHealthWorkerName &&
            sub.service === activeService &&
            sub.status !== 'draft' &&
            sub.sessionDate
        );

        const uniqueDateSet = new Set(workerSessions.map(s => s.sessionDate));
        const baseVisitCount = uniqueDateSet.size;

        if (baseVisitCount === 0) {
            return 1;
        }
        
        const sortedDates = Array.from(uniqueDateSet).sort();
        const lastVisitDateStr = sortedDates[sortedDates.length - 1];

        const todayStr = new Date().toISOString().split('T')[0];

        if (todayStr === lastVisitDateStr) {
            return baseVisitCount;
        } else {
            return baseVisitCount + 1;
        }

    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService, editingSubmission]);

    // --- NEW: Calculate Mother Visit Number Logic ---
    const motherVisitNumber = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !activeService) {
            return 1;
        }

        if (editingSubmission && (editingSubmission.service === `${activeService}_MOTHERS`)) {
             return editingSubmission.visitNumber || 1;
        }

        const motherServiceType = `${activeService}_MOTHERS`;

        // Filter submissions for this specific facility and mother service type
        const facilityMotherSessions = processedSubmissions.filter(sub =>
            sub.facilityId === selectedFacilityId &&
            sub.service === motherServiceType &&
            sub.status !== 'draft' &&
            sub.sessionDate
        );

        // Count unique dates to determine session number
        const uniqueDateSet = new Set(facilityMotherSessions.map(s => s.sessionDate));
        const baseVisitCount = uniqueDateSet.size;

        if (baseVisitCount === 0) {
            return 1;
        }
        
        const sortedDates = Array.from(uniqueDateSet).sort();
        const lastVisitDateStr = sortedDates[sortedDates.length - 1];
        const todayStr = new Date().toISOString().split('T')[0];

        // If a session already exists for today, use that count, otherwise increment
        if (todayStr === lastVisitDateStr) {
            return baseVisitCount;
        } else {
            return baseVisitCount + 1;
        }

    }, [processedSubmissions, selectedFacilityId, activeService, editingSubmission]);
    // --- END NEW LOGIC ---

    // --- NEW: Calculate Visit Report Visit Number Logic ---
    const visitReportVisitNumber = useMemo(() => {
        if (!selectedFacilityId || !activeService) {
            return 1;
        }
        
        // Use the processed reports which are already filtered by activeService
        // Filter for the selected facility
        const relevantReports = processedVisitReports.filter(rep => rep.facilityId === selectedFacilityId);

        if (editingSubmission && (editingSubmission.service === activeService)) {
             return editingSubmission.visitNumber || 1;
        }

        const uniqueDateSet = new Set(relevantReports.map(r => r.visitDate));
        const baseVisitCount = uniqueDateSet.size;

        if (baseVisitCount === 0) {
            return 1;
        }
        
        const sortedDates = Array.from(uniqueDateSet).sort();
        const lastVisitDateStr = sortedDates[sortedDates.length - 1];
        const todayStr = new Date().toISOString().split('T')[0];

        if (todayStr === lastVisitDateStr) {
            return baseVisitCount;
        } else {
            return baseVisitCount + 1;
        }

    }, [processedVisitReports, selectedFacilityId, activeService, editingSubmission]);
    // --- END NEW LOGIC ---

    const lastSessionDate = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return null;
        }

        const workerSessions = processedSubmissions
            .filter(sub =>
                sub.facilityId === selectedFacilityId &&
                sub.staff === selectedHealthWorkerName &&
                sub.service === activeService &&
                sub.status !== 'draft'
            )
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (editingSubmission) {
            const sessionsBeforeThisOne = workerSessions.filter(s =>
                s.id !== editingSubmission.id
            );
             return sessionsBeforeThisOne.length > 0 ? sessionsBeforeThisOne[0].date : null;
        }
        else {
            return workerSessions.length > 0 ? workerSessions[0].date : null;
        }
    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService, editingSubmission]);


    useEffect(() => {
        if (selectedHealthWorkerName && selectedFacility?.imnci_staff) {
            try {
                const staffList = typeof selectedFacility.imnci_staff === 'string'
                    ? JSON.parse(selectedFacility.imnci_staff)
                    : selectedFacility.imnci_staff;
                const workerData = Array.isArray(staffList)
                    ? staffList.find(w => w.name === selectedHealthWorkerName)
                    : null;
                if (workerData) {
                    setSelectedWorkerOriginalData(workerData);
                    setWorkerJobTitle(workerData.job_title || '');
                    setWorkerTrainingDate(workerData.training_date || '');
                    setWorkerPhone(workerData.phone || '');
                    setIsWorkerInfoChanged(false);
                } else {
                    setSelectedWorkerOriginalData(null);
                    setWorkerJobTitle('');
                    setWorkerTrainingDate('');
                    setWorkerPhone('');
                    setIsWorkerInfoChanged(false);
                }
            } catch(e) {
                console.error("Error finding worker data:", e);
                 setSelectedWorkerOriginalData(null);
                 setWorkerJobTitle('');
                 setWorkerTrainingDate('');
                 setWorkerPhone('');
                 setIsWorkerInfoChanged(false);
            }
        } else {
            setSelectedWorkerOriginalData(null);
            setWorkerJobTitle('');
            setWorkerTrainingDate('');
            setWorkerPhone('');
            setIsWorkerInfoChanged(false);
        }
    }, [selectedHealthWorkerName, selectedFacility]);

    useEffect(() => {
        if (!selectedWorkerOriginalData || !selectedHealthWorkerName) {
            setIsWorkerInfoChanged(false);
            return;
        }
        const changed = (
            workerJobTitle !== (selectedWorkerOriginalData.job_title || '') ||
            workerTrainingDate !== (selectedWorkerOriginalData.training_date || '') ||
            workerPhone !== (selectedWorkerOriginalData.phone || '')
        );
        setIsWorkerInfoChanged(changed);
    }, [workerJobTitle, workerTrainingDate, workerPhone, selectedWorkerOriginalData, selectedHealthWorkerName]);


    const resetSelection = () => {
        if (publicSubmissionMode || !(userStates && userStates.length === 1)) {
            setSelectedState('');
        }
        if (publicSubmissionMode || !(permissions?.manageScope === 'locality' && userLocalities && userLocalities.length === 1)) {
            setSelectedLocality('');
        }
        setSelectedFacilityId('');
        setSelectedHealthWorkerName('');
        setSelectedWorkerOriginalData(null);
        setWorkerJobTitle('');
        setWorkerTrainingDate('');
        setWorkerPhone('');
        setIsWorkerInfoChanged(false);
        setEditingSubmission(null);
        setActiveFormType('skills_assessment');
        setIsReadyToStart(false);
    };
    const handleSelectService = (serviceKey) => {
        setActiveService(serviceKey);
        setCurrentView('history');
        setActiveTab('skills_list');
    };
    
    const handleStartNewVisit = async () => {
        resetSelection();
        setCurrentView('form_setup');
    };
    
    const handleStartMothersForm = () => {
        resetSelection();
        setActiveFormType('mothers_form');
        setCurrentView('form_setup');
    };

    const handleStartNewVisitReport = () => {
        resetSelection();
        setActiveFormType('visit_report');
        setCurrentView('form_setup');
    };

    const handleReturnToServiceSelection = () => {
        setActiveService(null);
        setCurrentView('service_selection');
        resetSelection();
    };

    const handleExitForm = () => {
        const completedFormType = activeFormType;
        resetSelection(); 

        if (publicSubmissionMode) {
             setCurrentView('form_setup');
        } else {
            setCurrentView('history');
            if (completedFormType === 'mothers_form') {
                setActiveTab('mothers_list');
            } else if (completedFormType === 'visit_report') {
                setActiveTab('visit_reports');
            } else {
                setActiveTab('skills_list');
            }
        }
    };

    const handleSaveSuccess = async (status, savedData) => {
        const wasEditing = !!editingSubmission;
        const completedFormType = activeFormType;

        let lastFacilityInfo = null;
        if (savedData) {
            lastFacilityInfo = {
                state: savedData.state,
                locality: savedData.locality,
                facilityId: savedData.facilityId
            };
        }
 
        resetSelection(); 

        if (previousViewRef.current === 'form_setup' || wasEditing) {
            await fetchSkillMentorshipSubmissions(true);
        }
        
        if (status === 'complete' && !publicSubmissionMode) {
            setLastSavedFacilityInfo(lastFacilityInfo);
            setIsPostSaveModalOpen(true);
        } else {
            if (publicSubmissionMode) {
                if (status === 'complete') {
                    setToast({ show: true, message: 'Submission successful! Thank you.', type: 'success' });
                }
                setCurrentView('form_setup');
            } else {
                setCurrentView('history');
                setActiveTab('skills_list');
            }
        }
    };

    const handleGenericFormExit = async (returnTab = 'skills_list') => {
        resetSelection(); 

        await fetchSkillMentorshipSubmissions(true); 
        await fetchIMNCIVisitReports(true);
        if (fetchEENCVisitReports) await fetchEENCVisitReports(true);


        if (publicSubmissionMode) {
             setCurrentView('form_setup');
        } else {
            setCurrentView('history'); 
            setActiveTab(returnTab);
        }
    };

    const previousViewRef = useRef(currentView);
    useEffect(() => {
        previousViewRef.current = currentView;
    }, [currentView]);


    const handleBackToHistoryView = () => {
        setCurrentView('history');
         resetSelection();
    };

    const handlePostSaveSelect = (actionType) => {
        if (!lastSavedFacilityInfo) return;

        setIsPostSaveModalOpen(false);

        const savedInfo = lastSavedFacilityInfo;
        setLastSavedFacilityInfo(null);

        setSelectedState(savedInfo.state);
        setSelectedLocality(savedInfo.locality);
        setSelectedFacilityId(savedInfo.facilityId);

        if (actionType === 'skills_assessment' || actionType === 'mothers_form' || actionType === 'visit_report') {
            setActiveFormType(actionType);
            setCurrentView('form_setup');
            
            setSelectedHealthWorkerName('');
            setIsReadyToStart(false);

        } else if (actionType === 'dashboard') {
            setActiveDashboardState(savedInfo.state);
            setActiveDashboardLocality(savedInfo.locality);
            setActiveDashboardFacilityId(savedInfo.facilityId);
            setIsDashboardModalOpen(true);
            
            setCurrentView('history');
            setActiveTab('skills_list');

        } else if (actionType === 'drafts') {
            setIsDraftsModalOpen(true);

            setCurrentView('history');
            setActiveTab('skills_list');
        }
    };

    const handlePostSaveClose = () => {
        setIsPostSaveModalOpen(false);
        setLastSavedFacilityInfo(null);
        setCurrentView('history');
        setActiveTab('skills_list');
    };

    const handleProceedToForm = () => {
        if (activeFormType === 'skills_assessment') {
            const draftForSelectedWorker = currentUserDrafts.find(d => 
                d.facilityId === selectedFacilityId && 
                d.staff === selectedHealthWorkerName
            );

            if (draftForSelectedWorker) {
                const confirmEdit = window.confirm(
                    `يوجد لديك مسودة محفوظة لهذا العامل الصحي: \n\n${draftForSelectedWorker.staff} \n${draftForSelectedWorker.facility} \nبتاريخ: ${draftForSelectedWorker.date}\n\nهل تريد تعديل هذه المسودة؟ \n\n(ملاحظة: الضغط على 'Cancel' سيبدأ جلسة جديدة فارغة لهذا العامل.)`
                );
                
                if (confirmEdit) {
                    handleEditSubmission(draftForSelectedWorker.id);
                } else {
                    setEditingSubmission(null);
                    setIsReadyToStart(true); 
                }
            } else {
                setEditingSubmission(null);
                setIsReadyToStart(true);
            }
        } else if (activeFormType === 'mothers_form' || activeFormType === 'visit_report') {
            setEditingSubmission(null);
            setIsReadyToStart(true);
        }
    };

    const handleShareSubmissionLink = () => {
        const publicUrl = `${window.location.origin}/mentorship/submit/${activeService}`;
        navigator.clipboard.writeText(publicUrl).then(() => {
            setToast({ show: true, message: 'Public submission link copied to clipboard!', type: 'success' });
        }, (err) => {
            setToast({ show: true, message: 'Failed to copy link.', type: 'error' });
        });
    };
    
    // --- NEW: Share Dashboard Link handler ---
    const handleShareDashboardLink = () => {
        const baseUrl = `${window.location.origin}/public/mentorship/dashboard/${activeService}`;
        const params = new URLSearchParams();
        
        if (activeDashboardState) params.append('state', activeDashboardState);
        if (activeDashboardLocality) params.append('locality', activeDashboardLocality);
        if (activeDashboardFacilityId) params.append('facilityId', activeDashboardFacilityId);
        if (activeDashboardWorkerName) params.append('workerName', activeDashboardWorkerName);
        
        const shareUrl = `${baseUrl}?${params.toString()}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            setToast({ show: true, message: 'Public Dashboard link copied to clipboard!', type: 'success' });
        }).catch((err) => {
            setToast({ show: true, message: 'Failed to copy dashboard link.', type: 'error' });
        });
    };

    const handleImportMentorships = async (data, originalRows) => {
        if (!canBulkUploadMentorships) {
             setToast({ show: true, message: 'You do not have permission to import sessions.', type: 'error' });
             return;
        }
        setUploadStatus({ inProgress: true, processed: 0, total: data.length, errors: [], message: '' });
        try {
            const { successes, errors, failedRowsData } = await importMentorshipSessions(
                data,
                originalRows,
                (progress) => {
                    setUploadStatus(prev => ({ ...prev, processed: progress.processed }));
                }
            );
            const successCount = successes.length;
            const errorCount = errors.length;
            let message = `${successCount} sessions imported successfully.`;
            if (errorCount > 0) {
                message += `\n${errorCount} rows failed to import. Check results for details.`;
            }
             setUploadStatus(prev => ({ ...prev, inProgress: false, message, errors: failedRowsData }));
             fetchSkillMentorshipSubmissions(true);
        } catch (error) {
             setUploadStatus({
                 inProgress: false,
                 processed: 0,
                 total: 0,
                 errors: [{ message: error.message }],
                 message: `Import failed: ${error.message}`
            });
        }
    };
    
    const handleSaveNewHealthWorker = async (workerData) => {
        const user = auth.currentUser;
        
        if (!selectedFacility || !workerData.name) {
            setToast({ show: true, message: 'خطأ: لم يتم تحديد المؤسسة أو اسم العامل الصحي.', type: 'error' });
            return;
        }

        try {
            const currentStaff = (typeof selectedFacility.imnci_staff === 'string'
                ? JSON.parse(selectedFacility.imnci_staff)
                : selectedFacility.imnci_staff) || [];
            
            const newStaffList = [...currentStaff, workerData];

            const payload = {
                ...selectedFacility,
                imnci_staff: newStaffList,
                updated_by: user ? (user.displayName || user.email) : (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm'),
                'اخر تحديث': new Date().toISOString() 
            };
            
            await submitFacilityDataForApproval(payload, user?.email || (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm'));

            setToast({ show: true, message: 'تم إرسال طلب إضافة العامل الصحي للموافقة.', type: 'info' });

            setLocalHealthFacilities(prevFacilities => 
                prevFacilities.map(f => f.id === payload.id ? payload : f)
            );

            setSelectedHealthWorkerName(workerData.name);
            setIsAddWorkerModalOpen(false);

        } catch (error) {
            console.error("Error submitting new health worker for approval:", error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        }
    };

    const handleUpdateHealthWorkerInfo = async () => {
        if (!selectedHealthWorkerName || !selectedFacility || !isWorkerInfoChanged) {
            return;
        }
        setIsUpdatingWorker(true);
        const user = auth.currentUser;
        try {
            const currentStaff = (typeof selectedFacility.imnci_staff === 'string'
                ? JSON.parse(selectedFacility.imnci_staff)
                : selectedFacility.imnci_staff) || [];

            const newStaffList = currentStaff.map(worker => {
                if (worker.name === selectedHealthWorkerName) {
                    return {
                        name: selectedHealthWorkerName,
                        job_title: workerJobTitle,
                        training_date: workerTrainingDate,
                        phone: workerPhone
                    };
                }
                return worker;
            });

            const payload = {
                ...selectedFacility,
                imnci_staff: newStaffList,
                updated_by: user ? (user.displayName || user.email) : (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm'),
                'اخر تحديث': new Date().toISOString()
            };

            await submitFacilityDataForApproval(payload, user?.email || (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm'));
            
            setToast({ show: true, message: 'تم إرسال طلب تحديث بيانات العامل للموافقة.', type: 'info' });

            setLocalHealthFacilities(prevFacilities => 
                prevFacilities.map(f => f.id === payload.id ? payload : f)
            );
            
            const updatedOriginalData = {
                 name: selectedHealthWorkerName,
                 job_title: workerJobTitle,
                 training_date: workerTrainingDate,
                 phone: workerPhone
            };
            setSelectedWorkerOriginalData(updatedOriginalData);
            setIsWorkerInfoChanged(false);

        } catch (error) {
             console.error("Error submitting health worker update for approval:", error);
             setToast({ show: true, message: `فشل تحديث بيانات العامل: ${error.message}`, type: 'error' });
        } finally {
            setIsUpdatingWorker(false);
        }
    };

    const handleViewSubmission = (submissionId) => {
        const fullSubmission = skillMentorshipSubmissions.find(s => s.id === submissionId);
        setViewingSubmission(fullSubmission);
        setIsDraftsModalOpen(false);
    };

    const handleEditSubmission = async (submissionId) => {
        const fullSubmission = skillMentorshipSubmissions.find(s => s.id === submissionId);
        if (!fullSubmission) return;
        
        // MODIFIED: Allow mother forms
        if (fullSubmission.serviceType === 'IMNCI_MOTHERS' || fullSubmission.serviceType === 'EENC_MOTHERS') {
            setActiveFormType('mothers_form');
        } else if (fullSubmission.serviceType === 'IMNCI') {
            setActiveFormType('skills_assessment');
        } else if (fullSubmission.serviceType === 'EENC') {
             setActiveFormType('skills_assessment');
        } else {
            setToast({ show: true, message: 'لا يمكن تعديل هذا النوع من الجلسات.', type: 'error' });
            return;
        }

        const isFormOpen = currentView === 'form_setup';
        const isDifferentDraft = !editingSubmission || (editingSubmission.id !== submissionId);

        if (isFormOpen && isDifferentDraft && formRef.current) {
            // ... save draft logic
        }

        setSelectedState(fullSubmission.state);
        setSelectedLocality(fullSubmission.locality);
        setSelectedFacilityId(fullSubmission.facilityId);
        if(fullSubmission.healthWorkerName) setSelectedHealthWorkerName(fullSubmission.healthWorkerName);

        setEditingSubmission(fullSubmission);
        setIsReadyToStart(true);

        setIsDraftsModalOpen(false);
        setCurrentView('form_setup');
    };


    const handleDeleteSubmission = async (submissionId) => {
        const submissionToDelete = processedSubmissions.find(s => s.id === submissionId);
        if (!submissionToDelete) return;

        const confirmMessage = `هل أنت متأكد من حذف جلسة العامل الصحي: ${submissionToDelete.staff || submissionToDelete.motherName || 'N/A'} بتاريخ ${submissionToDelete.date}؟
${submissionToDelete.status === 'draft' ? '\n(هذه مسودة)' : ''}`;

        if (window.confirm(confirmMessage)) {
            try {
                await deleteMentorshipSession(submissionId);
                setToast({ show: true, message: 'تم حذف الجلسة بنجاح.', type: 'success' });
                await fetchSkillMentorshipSubmissions(true);
                setIsDraftsModalOpen(false);
                setViewingSubmission(null);
            } catch (error) {
                console.error("Error deleting session:", error);
                setToast({ show: true, message: `فشل الحذف: ${error.message}`, type: 'error' });
            }
        }
    };

 

    const handleDraftCreated = (newDraftObject) => {
        setEditingSubmission(newDraftObject);
        fetchSkillMentorshipSubmissions(true);
    };

    const MobileFormNavBar = ({ activeFormType, draftCount, onNavClick }) => {
        const isSkillsActive = activeFormType === 'skills_assessment';
        
        const navItems = [
            { id: 'skills_assessment', label: 'استمارة المهارات', icon: FileText, active: activeFormType === 'skills_assessment', disabled: false },
            { id: 'mothers_form', label: 'استبيان الامهات', icon: Users, active: activeFormType === 'mothers_form', disabled: false },
            { id: 'facility_info', label: 'معلومات المؤسسة', icon: Building, active: false, disabled: !isSkillsActive },
            { id: 'visit_report', label: 'تقرير الزيارة', icon: ClipboardCheck, active: activeFormType === 'visit_report', disabled: false },
            { id: 'drafts', label: `مسودات (${draftCount})`, icon: Archive, active: false, disabled: !isSkillsActive },
            { id: 'dashboard', label: 'المنصة', icon: LayoutDashboard, active: false, disabled: false },
        ];
        
        const itemWidth = `${100 / navItems.length}%`;

        return (
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center bg-gray-900 text-white border-t border-gray-700 shadow-lg" dir="rtl">
                {navItems.map(item => {
                    const IconComponent = item.icon;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onNavClick(item.id)}
                            disabled={item.disabled}
                            style={{ width: itemWidth }}
                            className={`flex flex-col items-center justify-center text-center p-2 transition-colors duration-150 h-16
                                ${item.active ? 'text-sky-400' : 'text-gray-300 hover:text-white'}
                                ${item.disabled ? 'text-gray-600 cursor-not-allowed' : ''}
                            `}
                        >
                            <IconComponent className="h-5 w-5 mb-0.5" />
                            <span className="text-xs font-medium leading-tight">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    };

    const handleMobileNavClick = async (target) => {
        const isFormRendered = (currentView === 'form_setup' && (isReadyToStart || editingSubmission));

         if (target === 'skills_assessment') {
            if (activeFormType !== 'skills_assessment') {
                 resetSelection();
            }
        } 
        else if (target === 'mothers_form') {
            if (isFormRendered) {
                setIsMothersFormModalOpen(true);
            } else {
                if (activeFormType !== 'mothers_form') {
                    resetSelection();
                    setActiveFormType('mothers_form');
                }
            }
        }
        else if (target === 'visit_report') {
             if (isFormRendered) {
                setIsVisitReportModalOpen(true);
             } else {
                if (activeFormType !== 'visit_report') {
                    resetSelection();
                    setActiveFormType('visit_report');
                }
             }
        }
        else if (target === 'facility_info' && activeFormType === 'skills_assessment' && formRef.current) {
            formRef.current.openFacilityModal();
        }
        else if (target === 'facility_update' && activeFormType === 'skills_assessment' && formRef.current) {
            formRef.current.openFacilityModal();
        }
        else if (target === 'drafts' && activeFormType === 'skills_assessment') {
            setIsDraftsModalOpen(true);
        }
        else if (target === 'dashboard') {
            if (!isFormRendered) {
                setActiveDashboardState(selectedState);
                setActiveDashboardLocality(selectedLocality);
                setActiveDashboardFacilityId(selectedFacilityId);
                setActiveDashboardWorkerName(selectedHealthWorkerName);
            }
            setIsDashboardModalOpen(true);
        }
    };

    if (currentView === 'service_selection') {
        return <ServiceSelector onSelectService={handleSelectService} />;
    }

    if (currentView === 'history') {
        const canShareLink = permissions?.canManageSkillsMentorship || permissions?.canUseSuperUserAdvancedFeatures;
        const serviceTitle = SERVICE_TITLES[activeService] || activeService;
        const headerTitle = `${activeService} Mentorship`;

        // Check if user is a Federal Manager or Super User
        const isFederalManager = permissions?.manageScope === 'federal' || permissions?.isSuperUser || permissions?.role === 'federal_manager';

        return (
            <>
                <Card dir="ltr">
                    <div className="p-6">
                        {/* Only show tabs if NOT in public dashboard mode */}
                        {!publicDashboardMode && (
                            <div className="border-b border-gray-200 mb-6">
                                <nav className="flex gap-2" aria-label="Tabs">
                                    <button
                                        onClick={() => setActiveTab('skills_list')}
                                        className={`whitespace-nowrap py-2 px-4 rounded-md font-medium text-sm
                                            ${activeTab === 'skills_list'
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Skills Observations
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('mothers_list')}
                                        className={`whitespace-nowrap py-2 px-4 rounded-md font-medium text-sm
                                            ${activeTab === 'mothers_list'
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Mother's Surveys
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('visit_reports')}
                                        className={`whitespace-nowrap py-2 px-4 rounded-md font-medium text-sm
                                            ${activeTab === 'visit_reports'
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Visit Reports
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('dashboard')}
                                        className={`whitespace-nowrap py-2 px-4 rounded-md font-medium text-sm
                                            ${activeTab === 'dashboard'
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Dashboard
                                    </button>
                                </nav>
                            </div>
                        )}

                        <div className="flex justify-center mb-4 relative">
                            <h2 className="text-xl font-semibold text-gray-800">{headerTitle}</h2>
                            {activeTab === 'dashboard' && !publicDashboardMode && (
                                <div className="absolute right-0 top-0">
                                    <Button variant="secondary" onClick={handleShareDashboardLink} title="Share Public Dashboard Link">
                                        <Share2 className="w-4 h-4 mr-2" /> Share Dashboard
                                    </Button>
                                </div>
                            )}
                        </div>
                        
                        {activeTab !== 'dashboard' && !publicDashboardMode && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 border p-4 rounded-lg bg-gray-50">
                                    <FormGroup label="State" className="text-left" dir="ltr">
                                        <Select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setLocalityFilter(''); }}>
                                            {availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                        </Select>
                                    </FormGroup>

                                    <FormGroup label="Locality" className="text-left" dir="ltr">
                                        <Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}>
                                             {availableLocalities.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                                        </Select>
                                    </FormGroup>

                                    <FormGroup label="Supervisor" className="text-left" dir="ltr">
                                        <Select
                                            value={supervisorFilter}
                                            onChange={(e) => setSupervisorFilter(e.target.value)}
                                        >
                                            <option value="">All Supervisors</option>
                                            {uniqueSupervisors.map(sup => (
                                                <option key={sup.email} value={sup.email}>{sup.display}</option>
                                            ))}
                                        </Select>
                                    </FormGroup>

                                    <FormGroup label="Status" className="text-left" dir="ltr">
                                        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                            <option value="">All Statuses</option>
                                            <option value="complete">Complete</option>
                                            <option value="draft">Draft</option>
                                        </Select>
                                    </FormGroup>
                                </div>
                            
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-2 flex-wrap">
                                        
                                        {activeTab === 'skills_list' && (
                                            <Button onClick={handleStartNewVisit}>Add New Skills Observation</Button>
                                        )}
                                        
                                        {activeTab === 'mothers_list' && (
                                            <Button variant="primary" onClick={handleStartMothersForm}>Add Mother's Knowledge & Satisfaction Form</Button>
                                        )}

                                        {activeTab === 'visit_reports' && activeService === 'IMNCI' && (
                                            <Button variant="primary" onClick={handleStartNewVisitReport}>Add New IMNCI Visit Report</Button>
                                        )}
                                        {activeTab === 'visit_reports' && activeService === 'EENC' && (
                                            <Button variant="primary" onClick={handleStartNewVisitReport}>Add New EENC Visit Report</Button>
                                        )}

                                        {activeTab === 'skills_list' && canBulkUploadMentorships && (
                                            <Button onClick={() => setIsBulkUploadModalOpen(true)}>Bulk Upload</Button>
                                        )}

                                        {activeTab === 'skills_list' && canShareLink && (
                                             <Button variant="info" onClick={handleShareSubmissionLink}>
                                                 Share Submission Link
                                             </Button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        <div>
                            {activeTab === 'skills_list' && !publicDashboardMode && (
                                <MentorshipSubmissionsTable
                                    submissions={processedSubmissions}
                                    activeService={activeService}
                                    filterServiceType={activeService}
                                    onView={handleViewSubmission}
                                    onEdit={handleEditSubmission}
                                    onDelete={handleDeleteSubmission}
                                    fetchSubmissions={fetchSkillMentorshipSubmissions}
                                    isSubmissionsLoading={isDataCacheLoading.skillMentorshipSubmissions || !skillMentorshipSubmissions}
                                    stateFilter={stateFilter}
                                    localityFilter={localityFilter}
                                    supervisorFilter={supervisorFilter}
                                    statusFilter={statusFilter}
                                />
                            )}
                            {activeTab === 'mothers_list' && !publicDashboardMode && (
                                <MentorshipSubmissionsTable
                                    submissions={processedSubmissions}
                                    activeService={activeService}
                                    filterServiceType={`${activeService}_MOTHERS`}
                                    onView={handleViewSubmission}
                                    onEdit={handleEditSubmission}
                                    onDelete={handleDeleteSubmission}
                                    fetchSubmissions={fetchSkillMentorshipSubmissions}
                                    isSubmissionsLoading={isDataCacheLoading.skillMentorshipSubmissions || !skillMentorshipSubmissions}
                                    stateFilter={stateFilter}
                                    localityFilter={localityFilter}
                                    supervisorFilter={supervisorFilter}
                                    statusFilter={statusFilter}
                                />
                            )}
                            {activeTab === 'visit_reports' && !publicDashboardMode && (
                                <VisitReportsTable
                                    reports={processedVisitReports}
                                    onEdit={handleEditVisitReport}
                                    onDelete={handleDeleteVisitReport}
                                    onView={handleViewVisitReport} // Pass view handler
                                />
                            )}

                            {activeTab === 'dashboard' && (
                                <MentorshipDashboard
                                    allSubmissions={processedSubmissions}
                                    visitReports={processedVisitReports}
                                    STATE_LOCALITIES={STATE_LOCALITIES}
                                    activeService={activeService}
                                    
                                    // Pass new props for status editing
                                    canEditStatus={isFederalManager}
                                    onUpdateStatus={handleChallengeStatusUpdate}

                                    activeState={activeDashboardState || selectedState}
                                    onStateChange={(value) => {
                                        setActiveDashboardState(value);
                                        setActiveDashboardLocality("");
                                        setActiveDashboardFacilityId("");
                                        setActiveDashboardWorkerName("");
                                    }}
                                    activeLocality={activeDashboardLocality || selectedLocality}
                                    onLocalityChange={(value) => {
                                        setActiveDashboardLocality(value);
                                        setActiveDashboardFacilityId("");
                                        setActiveDashboardWorkerName("");
                                    }}
                                    activeFacilityId={activeDashboardFacilityId || selectedFacilityId}
                                    onFacilityIdChange={(value) => {
                                        setActiveDashboardFacilityId(value);
                                        setActiveDashboardWorkerName("");
                                    }}
                                    activeWorkerName={activeDashboardWorkerName || selectedHealthWorkerName}
                                    onWorkerNameChange={setActiveDashboardWorkerName}
                                />
                            )}
                        </div>
                    </div>
                </Card>

                {isBulkUploadModalOpen && (
                    <DetailedMentorshipBulkUploadModal
                        isOpen={isBulkUploadModalOpen}
                        onClose={() => { setIsBulkUploadModalOpen(false); setUploadStatus({ inProgress: false, processed: 0, total: 0, errors: [], message: '' }); }}
                        onImport={handleImportMentorships}
                        uploadStatus={uploadStatus}
                        activeService={activeService}
                        healthFacilities={healthFacilities || []}
                        allSubmissions={processedSubmissions} 
                    />
                )}
                {viewingSubmission && (
                    <ViewSubmissionModal
                        submission={viewingSubmission}
                        onClose={() => setViewingSubmission(null)}
                    />
                )}
                
                {/* New View Visit Report Modal */}
                {viewingVisitReport && (
                    <ViewVisitReportModal
                        report={viewingVisitReport}
                        onClose={() => setViewingVisitReport(null)}
                    />
                )}
            </>
        );
    }

    const facilityData = editingSubmission 
        ? (localHealthFacilities.find(f => f.id === editingSubmission.facilityId) || {
            'الولاية': editingSubmission.state,
            'المحلية': editingSubmission.locality,
            'اسم_المؤسسة': editingSubmission.facilityName,
            'id': editingSubmission.facilityId,
            'نوع_المؤسسةالصحية': editingSubmission.facilityType 
          })
        : selectedFacility;

    if (currentView === 'form_setup' && activeFormType === 'skills_assessment' && (editingSubmission || (isReadyToStart && selectedHealthWorkerName && selectedFacility)) && activeService && !isAddWorkerModalOpen && !isWorkerInfoChanged) {
        
        if (activeService === 'IMNCI') {
            return (
                <>
                    <SkillsAssessmentForm
                        ref={formRef}
                        facility={facilityData}
                        healthWorkerName={editingSubmission ? editingSubmission.healthWorkerName : selectedHealthWorkerName}
                        healthWorkerJobTitle={editingSubmission ? editingSubmission.workerType : workerJobTitle}
                        healthWorkerTrainingDate={workerTrainingDate}
                        healthWorkerPhone={workerPhone}
                        onExit={handleExitForm}
                        onSaveComplete={handleSaveSuccess}
                        setToast={setToast}
                        
                        visitNumber={visitNumber}
                        workerHistory={workerHistory} // Pass history for date checks
                        
                        canEditVisitNumber={canEditVisitNumber} // Pass permission
                        existingSessionData={editingSubmission}
                        lastSessionDate={lastSessionDate}
                        onDraftCreated={handleDraftCreated}
                        
                        setIsMothersFormModalOpen={setIsMothersFormModalOpen}
                        setIsDashboardModalOpen={setIsDashboardModalOpen}
                        setIsVisitReportModalOpen={setIsVisitReportModalOpen}
                        draftCount={currentUserDrafts.length}
                    />
                    <MobileFormNavBar
                        activeFormType={activeFormType}
                        draftCount={currentUserDrafts.length}
                        onNavClick={handleMobileNavClick}
                    />
                    <DraftsModal
                        isOpen={isDraftsModalOpen}
                        onClose={() => setIsDraftsModalOpen(false)}
                        drafts={currentUserDrafts}
                        onView={handleViewSubmission}
                        onEdit={handleEditSubmission}
                        onDelete={handleDeleteSubmission}
                    />
                    {viewingSubmission && (
                        <ViewSubmissionModal
                            submission={viewingSubmission}
                            onClose={() => setViewingSubmission(null)}
                        />
                    )}
                
                    {isMothersFormModalOpen && (
                        <Modal 
                            isOpen={isMothersFormModalOpen} 
                            onClose={() => setIsMothersFormModalOpen(false)} 
                            title="استبيان الأم: رضاء ومعرفة الأمهات"
                            size="full"
                        >
                            <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                                <MothersForm
                                    facility={facilityData}
                                    visitNumber={motherVisitNumber}
                                    existingSessionData={null} // Mothers form is new here
                                    onCancel={() => {
                                        setIsMothersFormModalOpen(false);
                                        fetchSkillMentorshipSubmissions(true);
                                    }}
                                    setToast={setToast}
                                    canEditVisitNumber={canEditVisitNumber} // NEW PROP
                                />
                            </div>
                        </Modal>
                    )}

                    {isVisitReportModalOpen && (
                        <Modal 
                            isOpen={isVisitReportModalOpen} 
                            onClose={() => setIsVisitReportModalOpen(false)} 
                            title={activeService === 'IMNCI' ? "تقرير زيارة العلاج المتكامل" : "تقرير زيارة EENC"}
                            size="full"
                        >
                            <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                                <Suspense fallback={<div className="p-8"><Spinner /></div>}>
                                    {activeService === 'IMNCI' ? (
                                        <IMNCIVisitReport
                                            facility={facilityData}
                                            visitNumber={visitReportVisitNumber} // Pass calculated visit number
                                            onCancel={() => {
                                                setIsVisitReportModalOpen(false);
                                                fetchSkillMentorshipSubmissions(true);
                                                fetchIMNCIVisitReports(true);
                                            }}
                                            setToast={setToast}
                                            allSubmissions={processedSubmissions}
                                            existingReportData={null}
                                            // NEW PROP
                                            allVisitReports={processedVisitReports}
                                            canEditVisitNumber={canEditVisitNumber} // NEW PROP
                                        />
                                    ) : (
                                        <EENCVisitReport
                                            facility={facilityData}
                                            visitNumber={visitReportVisitNumber} // Pass calculated visit number
                                            onCancel={() => {
                                                setIsVisitReportModalOpen(false);
                                                fetchSkillMentorshipSubmissions(true);
                                                if (fetchEENCVisitReports) fetchEENCVisitReports(true);
                                            }}
                                            setToast={setToast}
                                            allSubmissions={processedSubmissions}
                                            existingReportData={null}
                                            // NEW PROP
                                            allVisitReports={processedVisitReports}
                                            canEditVisitNumber={canEditVisitNumber} // NEW PROP
                                        />
                                    )}
                                </Suspense>
                            </div>
                        </Modal>
                    )}
                    
                    {isDashboardModalOpen && (
                        <Modal 
                            isOpen={isDashboardModalOpen} 
                            onClose={() => setIsDashboardModalOpen(false)} 
                            title="لوحة متابعة: العلاج المتكامل"
                            size="full"
                        >
                            <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                                <MentorshipDashboard
                                    allSubmissions={processedSubmissions}
                                    visitReports={processedVisitReports}
                                    STATE_LOCALITIES={STATE_LOCALITIES}
                                    activeService={activeService}
                                    
                                    // Pass new props for status editing
                                    canEditStatus={permissions?.role === 'federal_manager' || permissions?.isSuperUser}
                                    onUpdateStatus={handleChallengeStatusUpdate}

                                    activeState={activeDashboardState || selectedState}
                                    onStateChange={(value) => {
                                        setActiveDashboardState(value);
                                        setActiveDashboardLocality("");
                                        setActiveDashboardFacilityId("");
                                        setActiveDashboardWorkerName("");
                                    }}
                                    activeLocality={activeDashboardLocality || selectedLocality}
                                    onLocalityChange={(value) => {
                                        setActiveDashboardLocality(value);
                                        setActiveDashboardFacilityId("");
                                        setActiveDashboardWorkerName("");
                                    }}
                                    activeFacilityId={activeDashboardFacilityId || selectedFacilityId}
                                    onFacilityIdChange={(value) => {
                                        setActiveDashboardFacilityId(value);
                                        setActiveDashboardWorkerName("");
                                    }}
                                    activeWorkerName={activeDashboardWorkerName || selectedHealthWorkerName}
                                    onWorkerNameChange={setActiveDashboardWorkerName}
                                />
                            </div>
                        </Modal>
                    )}
                </>
            );
        }
        else if (activeService === 'EENC') {
            return (
                <>
                    <EENCSkillsAssessmentForm
                        facility={facilityData}
                        healthWorkerName={editingSubmission ? editingSubmission.healthWorkerName : selectedHealthWorkerName}
                        onExit={handleExitForm}
                        onSaveComplete={handleSaveSuccess}
                        setToast={setToast}
                        existingSessionData={editingSubmission}
                        visitNumber={visitNumber}
                        workerHistory={workerHistory} // Pass history to EENC too
                        canEditVisitNumber={canEditVisitNumber} // Pass permission
                    />
                </>
            );
        }
    }
    
     if (currentView === 'form_setup' && activeFormType === 'mothers_form' && (isReadyToStart && selectedFacility) && activeService && !isAddWorkerModalOpen && !isWorkerInfoChanged) {
        
        if (activeService === 'IMNCI') {
            return (
                <>
                    <MothersForm
                        facility={facilityData} // Use facilityData which handles edits
                        visitNumber={motherVisitNumber}
                        existingSessionData={editingSubmission} // Pass existing data
                        onCancel={() => handleGenericFormExit('mothers_list')}
                        setToast={setToast}
                        canEditVisitNumber={canEditVisitNumber} // NEW PROP
                    />
                    <MobileFormNavBar
                        activeFormType={activeFormType}
                        draftCount={currentUserDrafts.length}
                        onNavClick={handleMobileNavClick}
                    />
                </>
            );
        }
        else if (activeService === 'EENC') {
            return (
                <>
                    <EENCMothersForm
                        facility={facilityData} // Use facilityData which handles edits
                        visitNumber={motherVisitNumber}
                        existingSessionData={editingSubmission} // Pass existing data
                        onCancel={() => handleGenericFormExit('mothers_list')}
                        setToast={setToast}
                        canEditVisitNumber={canEditVisitNumber} // NEW PROP
                    />
                </>
            );
        }
    }

     if (currentView === 'form_setup' && activeFormType === 'visit_report' && (editingSubmission || (isReadyToStart && selectedFacility)) && activeService) {
        
        const ReportComponent = activeService === 'IMNCI' ? IMNCIVisitReport : EENCVisitReport;
        
        return (
            <>
                <Suspense fallback={<div className="p-8"><Spinner /></div>}>
                    <ReportComponent
                        facility={facilityData}
                        visitNumber={visitReportVisitNumber} // Pass calculated visit number
                        onCancel={() => handleGenericFormExit('visit_reports')}
                        setToast={setToast}
                        allSubmissions={processedSubmissions}
                        existingReportData={editingSubmission}
                        // NEW PROP
                        allVisitReports={processedVisitReports}
                        canEditVisitNumber={canEditVisitNumber} // NEW PROP
                    />
                </Suspense>
                {isVisitReportModalOpen && (
                    <Modal isOpen={isVisitReportModalOpen} onClose={() => setIsVisitReportModalOpen(false)}>
                        <div className="p-4">Visit Report is already open.</div>
                    </Modal>
                )}
                {isMothersFormModalOpen && facilityData && <Modal isOpen={isMothersFormModalOpen} onClose={() => setIsMothersFormModalOpen(false)} title="استبيان الأم" size="full"><div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto"><MothersForm facility={facilityData} visitNumber={motherVisitNumber} existingSessionData={null} onCancel={() => { setIsMothersFormModalOpen(false); fetchSkillMentorshipSubmissions(true); }} setToast={setToast} canEditVisitNumber={canEditVisitNumber} /></div></Modal>}
                <MobileFormNavBar
                    activeFormType={activeFormType}
                    draftCount={currentUserDrafts.length}
                    onNavClick={handleMobileNavClick}
                 />
            </>
        );
    }

    const isStateFilterDisabled = !publicSubmissionMode && !publicDashboardMode && userStates && userStates.length === 1;
    const isLocalityFilterDisabled = (publicSubmissionMode || publicDashboardMode) ? !selectedState : (permissions?.manageScope === 'locality' || !selectedState);

    if (currentView === 'form_setup') {
        const serviceTitleArabic = activeService === 'EENC' 
            ? "الاشراف التدريبي الداعم على الرعاية الضرورية المبكرة (EENC)"
            : "الاشراف التدريبي الداعم على تطبيق العلاج المتكامل للاطفال اقل من 5 سنوات";
        
        const isSkillsAssessmentSetup = activeFormType === 'skills_assessment';
        const isVisitReportSetup = activeFormType === 'visit_report';
        const isMothersFormSetup = activeFormType === 'mothers_form';
        
        let setupTitle = '';
        if (isSkillsAssessmentSetup) {
            setupTitle = editingSubmission ? `تعديل جلسة: ${serviceTitleArabic}` : `إدخال بيانات: ${serviceTitleArabic}`;
        } else if (isVisitReportSetup) {
            setupTitle = editingSubmission ? (activeService === 'EENC' ? 'تعديل تقرير زيارة EENC' : 'تعديل تقرير الزيارة') : (activeService === 'EENC' ? 'إدخال تقرير زيارة EENC' : 'إدخال تقرير زيارة جديد');
        } else if (isMothersFormSetup) {
            setupTitle = editingSubmission ? (activeService === 'EENC' ? 'تعديل استبيان الأم (EENC)' : 'تعديل استبيان الأم') : (activeService === 'EENC' ? 'نموذج استبيان الأم (EENC)' : 'نموذج استبيان الأم (IMNCI)');
        }

        const setupSubtitle = isSkillsAssessmentSetup 
            ? "الرجاء اختيار الولاية والمحلية والمنشأة والعامل الصحي للمتابعة." 
            : "الرجاء اختيار الولاية والمحلية والمنشأة للمتابعة.";

        return (
            <>
                <Card dir="rtl">
                    <div className="p-6">
                        <div className="mx-auto text-center mb-6 max-w-lg"> 
                            <PageHeader
                                title={setupTitle}
                                subtitle={setupSubtitle}
                            />
                        </div>

                        <div className="space-y-6 mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border p-4 rounded-lg bg-gray-50 flex flex-row-reverse">
                                <FormGroup label="الولاية" className="text-right">
                                    <Select value={selectedState} onChange={handleStateChange} disabled={isStateFilterDisabled || !!editingSubmission}>
                                        {availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                    </Select>
                                </FormGroup>
                                
                                <FormGroup label="المحلية" className="text-right">
                                    <Select value={selectedLocality} onChange={(e) => { setSelectedLocality(e.target.value); setSelectedFacilityId(''); setSelectedHealthWorkerName(''); setSelectedWorkerOriginalData(null); setWorkerJobTitle(''); setWorkerTrainingDate(''); setWorkerPhone(''); setIsWorkerInfoChanged(false); setIsReadyToStart(false); }} disabled={isLocalityFilterDisabled || !!editingSubmission}>
                                         {(!publicSubmissionMode && !publicDashboardMode && permissions?.manageScope === 'locality') ? (
                                            userLocalities && userLocalities.length > 0 ? (
                                                userLocalities.map(locEn => {
                                                    const locAr = selectedState && STATE_LOCALITIES[selectedState]?.localities.find(l => l.en === locEn)?.ar || locEn;
                                                    return <option key={locEn} value={locEn}>{locAr}</option>;
                                                })
                                            ) : (
                                                <option value="">-- لم يتم تحديد محلية --</option>
                                            )
                                        ) : (
                                            <>
                                                <option value="">-- اختر المحلية --</option>
                                                {selectedState && STATE_LOCALITIES[selectedState]?.localities.sort((a, b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                                            </>
                                        )}
                                    </Select>
                                </FormGroup>
                                
                                {isFacilitiesLoading ? (
                                    <div className="flex justify-center items-center p-4">
                                        <Spinner />
                                        <span className="mr-2 text-gray-500">جاري تحميل المؤسسات...</span>
                                    </div>
                                ) : (
                                    <FormGroup label="المؤسسة الصحية" className="text-right">
                                        <div 
                                            onClick={() => {
                                                if (selectedLocality && !editingSubmission) {
                                                    setIsFacilitySelectionModalOpen(true);
                                                }
                                            }}
                                            className={`w-full p-2 border rounded flex justify-between items-center text-sm ${(!selectedLocality || !!editingSubmission) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-sky-500'}`}
                                        >
                                            <span className="truncate pl-2">
                                                {selectedFacility ? selectedFacility['اسم_المؤسسة'] : (editingSubmission ? editingSubmission.facilityName : '-- اختر أو ابحث عن المؤسسة --')}
                                            </span>
                                            <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        </div>
                                        {selectedState && selectedLocality && filteredFacilities.length === 0 && !isFacilitiesLoading && ( <p className="text-xs text-red-600 mt-1">لا توجد مؤسسات مسجلة.</p> )}
                                    </FormGroup>
                                )}
                            </div>

                                {isSkillsAssessmentSetup && selectedFacilityId && (
                                    <div className="border p-4 rounded-lg bg-gray-50 space-y-4">
                                        <FormGroup label="العامل الصحي" className="text-right">
                                            <Select
                                                value={selectedHealthWorkerName}
                                                onChange={(e) => {
                                                    if (e.target.value === 'ADD_NEW_WORKER') {
                                                        setIsAddWorkerModalOpen(true);
                                                        setSelectedHealthWorkerName('');
                                                        setSelectedWorkerOriginalData(null); setWorkerJobTitle(''); setWorkerTrainingDate(''); setWorkerPhone(''); setIsWorkerInfoChanged(false);
                                                    } else {
                                                        setSelectedHealthWorkerName(e.target.value);
                                                    }
                                                    setIsReadyToStart(false);
                                                }}
                                                disabled={!selectedFacilityId || !!editingSubmission}
                                            >
                                                <option value="">-- اختر العامل الصحي --</option>
                                                {!editingSubmission && (
                                                    <option value="ADD_NEW_WORKER" className="font-bold text-blue-600 bg-blue-50">
                                                        + إضافة عامل صحي جديد...
                                                    </option>
                                                )}
                                                {healthWorkers.map(w => (
                                                    <option key={w.id} value={w.name}>
                                                        {w.name}
                                                    </option>
                                                ))}
                                            </Select>
                                            {healthWorkers.length === 0 && !editingSubmission && (
                                                <p className="text-xs text-red-600 mt-1">
                                                    لا يوجد كوادر مسجلين. أضف واحداً.
                                                </p>
                                            )}
                                        </FormGroup>

                                        {selectedHealthWorkerName && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t items-end">
                                                <FormGroup label="الوصف الوظيفي" className="text-right">
                                                    <Select value={workerJobTitle} onChange={(e) => setWorkerJobTitle(e.target.value)}>
                                                         <option value="">-- اختر الوصف الوظيفي --</option>
                                                        {IMNCI_JOB_TITLES.map(title => (
                                                            <option key={title} value={title}>{title}</option>
                                                        ))}
                                                    </Select>
                                                </FormGroup>
                                                <FormGroup label="اخر تاريخ تدريب" className="text-right">
                                                    <Input type="date" value={workerTrainingDate} onChange={(e) => setWorkerTrainingDate(e.target.value)} />
                                                </FormGroup>
                                                <FormGroup label="رقم الهاتف" className="text-right">
                                                    <Input type="tel" value={workerPhone} onChange={(e) => setWorkerPhone(e.target.value)} />
                                                </FormGroup>

                                                {isWorkerInfoChanged && (
                                                     <div className="md:col-span-3 flex justify-end">
                                                         <Button
                                                            type="button"
                                                            onClick={handleUpdateHealthWorkerInfo}
                                                            disabled={isUpdatingWorker}
                                                            variant="success"
                                                            size="sm"
                                                        >
                                                            {isUpdatingWorker ? 'جاري التحديث...' : 'حفظ تعديلات بيانات العامل'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                        </div>
                        
                        <div className="hidden sm:flex flex-col gap-2 items-end mt-6 pt-4 border-t">
                            <div className="flex gap-2 flex-wrap justify-end">
                                <Button 
                                    onClick={handleBackToHistoryView}
                                    variant="secondary"
                                    disabled={isFacilitiesLoading}
                                >
                                    إلغاء والعودة
                                </Button>
                                <Button
                                    onClick={handleProceedToForm}
                                    disabled={!selectedFacilityId || (isSkillsAssessmentSetup && !selectedHealthWorkerName) || isFacilitiesLoading || isWorkerInfoChanged}
                                    variant="primary"
                                >
                                    {isSkillsAssessmentSetup ? 'بدء جلسة الاشراف' : (isVisitReportSetup ? (activeService === 'EENC' ? 'بدء تقرير زيارة EENC' : 'بدء تقرير زيارة') : 'بدء استبيان الأم')}
                                </Button>
                            </div>
                            <div className="flex gap-2 flex-wrap justify-end">
                                <Button 
                                    type="button" 
                                    variant="info"
                                    onClick={() => setIsMothersFormModalOpen(true)} 
                                    disabled={isFacilitiesLoading || !selectedFacility}
                                    title={selectedFacility ? "Open Mother's Survey" : "Select a facility first"}
                                >
                                    استبيان الأم
                                </Button>
                                <Button 
                                    type="button" 
                                    variant="info"
                                    onClick={() => setIsVisitReportModalOpen(true)} 
                                    disabled={isFacilitiesLoading || !selectedFacility}
                                    title={selectedFacility ? (activeService === 'EENC' ? "Open EENC Visit Report" : "Open IMNCI Visit Report") : "Select a facility first"}
                                >
                                    {activeService === 'EENC' ? 'تقرير زيارة EENC' : 'تقرير زيارة'}
                                </Button>
                                <Button 
                                    type="button" 
                                    variant="info"
                                    onClick={() => {
                                        setActiveDashboardState(selectedState);
                                        setActiveDashboardLocality(selectedLocality);
                                        setActiveDashboardFacilityId(selectedFacilityId);
                                        setActiveDashboardWorkerName(selectedHealthWorkerName);
                                        setIsDashboardModalOpen(true);
                                    }} 
                                    disabled={isFacilitiesLoading}
                                    title="Open Dashboard"
                                >
                                    لوحة المتابعة
                                </Button>
                            </div>
                        </div>

                        <div className="flex sm:hidden fixed bottom-16 left-0 right-0 z-20 h-16 justify-around items-center bg-gray-900 text-white border-t border-gray-700 shadow-lg" dir="rtl">
                            <Button type="button" variant="secondary" onClick={handleBackToHistoryView} disabled={isFacilitiesLoading} size="sm">
                                إلغاء
                            </Button>
                            
                            <Button 
                                type="button" 
                                onClick={handleProceedToForm}
                                disabled={!selectedFacilityId || (isSkillsAssessmentSetup && !selectedHealthWorkerName) || isFacilitiesLoading || isWorkerInfoChanged}
                                title={!selectedFacilityId ? "Select facility" : (isSkillsAssessmentSetup && !selectedHealthWorkerName ? "Select health worker" : "Start Session")}
                                size="sm"
                            >
                                {isSkillsAssessmentSetup ? 'بدء الجلسة' : (isVisitReportSetup ? (activeService === 'EENC' ? 'بدء تقرير EENC' : 'بدء التقرير') : 'بدء الاستبيان')} 
                            </Button>
                        </div>
                    </div>
                </Card>

                 {isAddWorkerModalOpen && (
                    <AddHealthWorkerModal
                        isOpen={isAddWorkerModalOpen}
                        onClose={() => setIsAddWorkerModalOpen(false)}
                        onSave={handleSaveNewHealthWorker}
                        facilityName={selectedFacility?.['اسم_المؤسسة'] || 'المؤسسة المحددة'}
                    />
                )}
                
                {isFacilitySelectionModalOpen && (
                    <FacilitySelectionModal
                        isOpen={isFacilitySelectionModalOpen}
                        onClose={() => setIsFacilitySelectionModalOpen(false)}
                        facilities={filteredFacilities}
                        onSelect={handleFacilitySelect}
                    />
                )}

                 <DraftsModal
                    isOpen={isDraftsModalOpen}
                    onClose={() => setIsDraftsModalOpen(false)}
                    drafts={currentUserDrafts}
                    onView={handleViewSubmission}
                    onEdit={handleEditSubmission}
                    onDelete={handleDeleteSubmission}
                 />
                 {viewingSubmission && (
                    <ViewSubmissionModal
                        submission={viewingSubmission}
                        onClose={() => setViewingSubmission(null)}
                    />
                 )}
                <PostSaveModal
                    isOpen={isPostSaveModalOpen}
                    onClose={handlePostSaveClose}
                    onSelect={handlePostSaveSelect}
                />

                {isMothersFormModalOpen && selectedFacility && (
                    <Modal 
                        isOpen={isMothersFormModalOpen} 
                        onClose={() => setIsMothersFormModalOpen(false)} 
                        title="استبيان الأم: رضاء ومعرفة الأمهات"
                        size="full"
                    >
                        <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                            <MothersForm
                                facility={selectedFacility} 
                                visitNumber={motherVisitNumber}
                                existingSessionData={null} // Mothers form is new here
                                onCancel={() => { 
                                    setIsMothersFormModalOpen(false);
                                    fetchSkillMentorshipSubmissions(true); 
                                }}
                                setToast={setToast}
                                canEditVisitNumber={canEditVisitNumber} // NEW PROP
                            />
                        </div>
                    </Modal>
                )}

                {isVisitReportModalOpen && selectedFacility && (
                    <Modal 
                        isOpen={isVisitReportModalOpen} 
                        onClose={() => setIsVisitReportModalOpen(false)} 
                        title={activeService === 'IMNCI' ? "تقرير زيارة العلاج المتكامل" : "تقرير زيارة EENC"}
                        size="full"
                    >
                        <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                            <Suspense fallback={<div className="p-8"><Spinner /></div>}>
                                {activeService === 'IMNCI' ? (
                                    <IMNCIVisitReport
                                        facility={selectedFacility}
                                        visitNumber={visitReportVisitNumber} // Pass calculated visit number
                                        onCancel={() => {
                                            setIsVisitReportModalOpen(false);
                                            fetchSkillMentorshipSubmissions(true);
                                            fetchIMNCIVisitReports(true);
                                        }}
                                        setToast={setToast}
                                        allSubmissions={processedSubmissions}
                                        existingReportData={null}
                                        // NEW PROP
                                        allVisitReports={processedVisitReports}
                                        canEditVisitNumber={canEditVisitNumber} // NEW PROP
                                    />
                                ) : (
                                    <EENCVisitReport
                                        facility={selectedFacility}
                                        visitNumber={visitReportVisitNumber} // Pass calculated visit number
                                        onCancel={() => {
                                            setIsVisitReportModalOpen(false);
                                            fetchSkillMentorshipSubmissions(true);
                                            if (fetchEENCVisitReports) fetchEENCVisitReports(true);
                                        }}
                                        setToast={setToast}
                                        allSubmissions={processedSubmissions}
                                        existingReportData={null}
                                        // NEW PROP
                                        allVisitReports={processedVisitReports}
                                        canEditVisitNumber={canEditVisitNumber} // NEW PROP
                                    />
                                )}
                            </Suspense>
                        </div>
                    </Modal>
                )}
                
                {isDashboardModalOpen && (
                    <Modal 
                        isOpen={isDashboardModalOpen} 
                        onClose={() => setIsDashboardModalOpen(false)} 
                        title="لوحة متابعة: العلاج المتكامل"
                        size="full"
                    >
                        <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                            <MentorshipDashboard
                                allSubmissions={processedSubmissions}
                                visitReports={processedVisitReports}
                                STATE_LOCALITIES={STATE_LOCALITIES}
                                activeService={activeService}
                                
                                // Pass new props for status editing
                                canEditStatus={permissions?.role === 'federal_manager' || permissions?.isSuperUser}
                                onUpdateStatus={handleChallengeStatusUpdate}

                                activeState={activeDashboardState}
                                onStateChange={(value) => {
                                    setActiveDashboardState(value);
                                    setActiveDashboardLocality("");
                                    setActiveDashboardFacilityId("");
                                    setActiveDashboardWorkerName("");
                                }}
                                activeLocality={activeDashboardLocality}
                                onLocalityChange={(value) => {
                                    setActiveDashboardLocality(value);
                                    setActiveDashboardFacilityId("");
                                    setActiveDashboardWorkerName("");
                                }}
                                activeFacilityId={activeDashboardFacilityId}
                                onFacilityIdChange={(value) => {
                                    setActiveDashboardFacilityId(value);
                                    setActiveDashboardWorkerName("");
                                }}
                                activeWorkerName={activeDashboardWorkerName}
                                onWorkerNameChange={setActiveDashboardWorkerName}
                            />
                        </div>
                    </Modal>
                )}

                <MobileFormNavBar
                    activeFormType={activeFormType}
                    draftCount={currentUserDrafts.length}
                    onNavClick={handleMobileNavClick}
                 />
            </>
        );
    }

    return null;
};

export default SkillsMentorshipView;