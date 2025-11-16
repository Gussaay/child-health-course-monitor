// SkillsMentorshipView.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useDataCache } from "../../DataContext";
import { Timestamp } from 'firebase/firestore';
import { PlusCircle, Trash2, FileText, Users, Building, ClipboardCheck, Archive, LayoutDashboard } from 'lucide-react';
import {
    saveMentorshipSession,
    importMentorshipSessions,
    submitFacilityDataForApproval, // <-- NEW IMPORT
    addHealthWorkerToFacility,
    deleteMentorshipSession,
    uploadFile, 
    deleteFile, 
    saveIMNCIVisitReport,
    deleteIMNCIVisitReport,
    listIMNCIVisitReports, // Implied import
    saveEENCVisitReport, // <-- ADDED
    deleteEENCVisitReport // <-- ADDED
} from '../../data';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox, Modal
} from '../CommonComponents';
import { STATE_LOCALITIES } from "../constants.js";
import SkillsAssessmentForm from './SkillsAssessmentForm';
import MentorshipDashboard from './MentorshipDashboard'; // <-- IMPORT ADDED
import { getAuth } from "firebase/auth";

// --- NEW IMPORT: Bulk Upload Modal ---
import DetailedMentorshipBulkUploadModal from './MentorshipBulkUpload';
// --- END NEW IMPORT ---

// --- NEW IMPORT: Mothers Form ---
import MothersForm from './MothersForm'; // <-- existing IMNCI Mothers Form
// --- END NEW IMPORT ---

// --- NEW IMPORTS: EENC Forms ---
import EENCSkillsAssessmentForm from './EENCSkillsAssessmentForm'; // <-- ADDED
import EENCMothersForm from './EENCMothersForm'; // <-- ADDED
// --- END EENC IMPORTS ---

// --- MODIFIED: Lazy load Visit Reports from combined file ---
const IMNCIVisitReport = lazy(() =>
  import('./VisitReports.jsx').then(module => ({ default: module.IMNCIVisitReport }))
);
const EENCVisitReport = lazy(() =>
  import('./VisitReports.jsx').then(module => ({ default: module.EENCVisitReport }))
);
// --- END MODIFICATION ---


// --- NEW IMPORTS: For Add Facility Modal ---
import {
    GenericFacilityForm,
    SharedFacilityFields,
    IMNCIFormFields
} from '../FacilityForms.jsx';
import { onAuthStateChanged } from "firebase/auth"; // <-- NEW IMPORT

// --- AddHealthWorkerModal Component (with job title dropdown) (KEPT AS-IS) ---
const IMNCI_JOB_TITLES = [
    "مساعد طبي", "طبيب عمومي", "ممرض", "قابلة", "مسؤول تغذية", "فني مختبر", "صيدلي", "أخرى"
];
const AddHealthWorkerModal = ({ isOpen, onClose, onSave, facilityName }) => {
    // ... (Implementation unchanged) ...
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
// --- END AddHealthWorkerModal ---

// --- NEW: Copied from FacilityForms.jsx ---
// --- Custom Searchable Select Component ---
const SearchableSelect = ({ options, value, onChange, placeholder = "اختر من القائمة...", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    const selectedOption = options.find(option => option.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSelect = (optionValue) => {
        // --- MODIFIED: Use 'facilityId' as name for compatibility ---
        onChange({ target: { name: 'facilityId', value: optionValue } });
        setIsOpen(false);
        setSearchTerm('');
    };

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(option =>
            option.value === 'addNew' || // Always keep the "Add New" option
            (option.label && option.label.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [searchTerm, options]);

    const groupedOptions = useMemo(() => {
        const groups = { ungrouped: [] };
        filteredOptions.forEach(option => {
            const groupName = option.group || 'ungrouped';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(option);
        });
        // Ensure "ungrouped" (like 'Add New') comes first
        return { ungrouped: groups.ungrouped, ...Object.fromEntries(Object.entries(groups).filter(([key]) => key !== 'ungrouped')) };
    }, [filteredOptions]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                className="w-full text-right bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <span className="block truncate">
                    {selectedOption ? selectedOption.label : <span className="text-gray-500">{placeholder}</span>}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </span>
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    <div className="p-2 sticky top-0 bg-white z-10">
                        <Input
                            type="search"
                            placeholder="ابحث..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full"
                            autoFocus
                        />
                    </div>
                    <ul role="listbox">
                        {Object.entries(groupedOptions).map(([groupName, opts]) => (
                            <React.Fragment key={groupName}>
                                {groupName !== 'ungrouped' && opts.length > 0 && (
                                    <li className="text-gray-500 cursor-default select-none relative py-2 px-3 font-bold">{groupName}</li>
                                )}
                                {opts.map(option => (
                                    <li
                                        key={option.value}
                                        className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-sky-100 ${option.className || ''}`}
                                        onClick={() => handleSelect(option.value)}
                                    >
                                        <span className={`block truncate ${value === option.value ? 'font-semibold' : 'font-normal'}`}>
                                            {option.label}
                                        </span>
                                    </li>
                                ))}
                            </React.Fragment>
                        ))}
                         {filteredOptions.length === 0 && searchTerm && (
                            <li className="text-gray-500 cursor-default select-none relative py-2 px-3">لا توجد نتائج</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};
// --- END: Copied from FacilityForms.jsx ---

// --- NEW: Add Facility Modal Component ---
const AddFacilityModal = ({ isOpen, onClose, onSaveComplete, setToast, initialState, initialLocality }) => {
   const handleSave = async (formData) => {
        try {
            await submitFacilityDataForApproval(formData);
            setToast({ show: true, message: "Submission successful! Your new facility is pending approval.", type: 'success' });
            onSaveComplete(); // <-- FIX: Call without formData
        } catch (error) {
            setToast({ show: true, message: `Submission failed: ${error.message}`, type: 'error' });
        }
    };

    const initialData = {
        'الولاية': initialState,
        'المحلية': initialLocality
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`إضافة منشأة صحية جديدة في: ${initialLocality}`} size="3xl">
            <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                <GenericFacilityForm
                    initialData={initialData}
                    onSave={handleSave}
                    onCancel={onClose}
                    setToast={setToast}
                    title="بيانات المنشأة الصحية"
                    subtitle="الرجاء إدخال تفاصيل المنشأة الجديدة. سيتم إرسالها للموافقة."
                    isPublicForm={true} // Use public form logic for submitter name/email
                >
                    {(props) => <IMNCIFormFields {...props} />}
                </GenericFacilityForm>
            </div>
        </Modal>
    );
};
// --- END AddFacilityModal ---

// --- NEW: Post-Save Modal Component ---
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
                    
                    {/* --- NEW BUTTONS ADDED --- */}
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
                    {/* --- END NEW BUTTONS --- */}

                    <hr className="my-2" />
                    <Button
                        variant="secondary"
                        onClick={onClose} // This will just close the modal and run the default "go to history"
                        className="w-full justify-center"
                    >
                        العودة إلى القائمة الرئيسية
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
// --- END Post-Save Modal ---




// --- NEW: Visit Reports Table Component ---
const VisitReportsTable = ({ reports, onEdit, onDelete }) => {
    return (
        <div dir="ltr" className="p-4 overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Facility</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">State</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Locality</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Visit Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Supervisor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Action</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {reports.length === 0 ? (
                        <tr><td colSpan="6" className="border border-gray-300"><EmptyState title="No Records Found" message="No visit reports found for this service." /></td></tr>
                    ) : (
                        reports.map(rep => (
                            <tr key={rep.id}>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{rep.facilityName}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{STATE_LOCALITIES[rep.state]?.ar || rep.state}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{STATE_LOCALITIES[rep.state]?.localities.find(l => l.en === rep.locality)?.ar || rep.locality}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{rep.visitDate}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{rep.mentorDisplay}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-left border border-gray-300">
                                    <div className="flex gap-2">
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
// --- END: Visit Reports Table Component ---


// --- Mentorship Table Column Component (MODIFIED to English Headers) (KEPT AS-IS) ---
const MentorshipTableColumns = () => (
    // ... (Implementation unchanged) ...
    <>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">#</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Facility</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Health Worker/Service</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Supervisor</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Date</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Status</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Overall Score</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-3D0">Action</th>
    </>
);
// --- END Mentorship Table Column Component ---

// --- Friendly Service Titles (MODIFIED to English) ---
const SERVICE_TITLES = {
    // ... (Implementation unchanged) ...
    'IMNCI': 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)',
    'EENC': 'Early Essential Newborn Care (EENC)',
    'ETAT': 'Emergency Triage, Assessment and Treatment (ETAT)',
    'IPC': 'Infection Prevention and Control in Neonatal Units (IPC)',
    'IMNCI_MOTHERS': 'Mother\'s Knowledge & Satisfaction Survey (IMNCI)', // <-- ADDED
    'EENC_MOTHERS': 'Mother\'s Survey (EENC)' // <-- ADDED
};

// --- NEW: View Submission Modal (KEPT AS-IS) ---
const ViewSubmissionModal = ({ submission, onClose }) => {
    // ... (Implementation unchanged) ...
    if (!submission) return null;

    const scores = submission.scores || {};
    const serviceTitle = SERVICE_TITLES[submission.serviceType] || submission.serviceType;

    // Helper to render score
    const renderScore = (scoreKey, label) => {
        const score = scores[`${scoreKey}_score`];
        const maxScore = scores[`${scoreKey}_maxScore`];
        let percentage = null;

        // Only calculate if maxScore is positive
        if (score !== undefined && maxScore !== undefined && maxScore > 0) {
            percentage = Math.round((score / maxScore) * 100);
        }
        // Handle 0/0 case as N/A or 100% depending on logic, here N/A
        else if (score === 0 && maxScore === 0) {
             percentage = null; // Or 100 if 0/0 means 100% complete (N/A)
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

    // New: Handle Mother's Form display (simplified as this component is mainly for IMNCI skills)
    if (submission.serviceType === 'IMNCI_MOTHERS' || submission.serviceType === 'EENC_MOTHERS') {
         // Display Mother's Form data
         const { mothersKnowledge = {}, mothersSatisfaction = {}, eencMothersData = {} } = submission;
         
         const dataToRender = submission.serviceType === 'EENC_MOTHERS' ? eencMothersData : mothersKnowledge;
         const titleToRender = submission.serviceType === 'EENC_MOTHERS' ? 'استبيان الأمهات (EENC)' : 'معرفة الأمهات';

         const renderMotherData = (data, title) => (
             <div className="mb-6">
                <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">{title}</h4>
                {/* --- MODIFICATION: Removed max-h and overflow --- */}
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
                {/* Worker Info */}
                <div className="mb-6">
                    <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">بيانات الجلسة</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p><span className="font-medium text-gray-500">العامل الصحي:</span> <span className="font-semibold text-gray-900">{submission.healthWorkerName}</span></p>
                        <p><span className="font-medium text-gray-500">المؤسسة:</span> <span className="font-semibold text-gray-900">{submission.facilityName}</span></p>
                        <p><span className="font-medium text-gray-500">المشرف:</span> <span className="font-semibold text-gray-900">{submission.mentorEmail}</span></p>
                        <p><span className="font-medium text-gray-500">التاريخ:</span> <span className="font-semibold text-gray-900">{submission.sessionDate}</span></p>
                        <p><span className="font-medium text-gray-500">الولاية:</span> <span className="font-semibold text-gray-900">{STATE_LOCALITIES[submission.state]?.ar || submission.state}</span></p>
                        <p><span className="font-medium text-gray-500">المحلية:</span> <span className="font-semibold text-gray-900">{STATE_LOCALITIES[submission.state]?.localities.find(l=>l.en === submission.locality)?.ar || submission.locality}</span></p>
                    </div>
                </div>

                {/* Scores */}
                <div>
                    <h4 className="text-lg font-bold text-sky-800 mb-3 border-b pb-2">الدرجات التفصيلية</h4>
                    {/* --- MODIFICATION: Removed max-h and overflow --- */}
                    <ul className="space-y-2 pr-2">
                        {renderScore('overallScore', 'الدرجة الكلية')}
                        <hr className="my-2"/>
                        {/* IMNCI-Specific Scores */}
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
                        {/* EENC-Specific scores will just show overall if any */}
                    </ul>
                </div>

                {/* Notes */}
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
// --- END View Submission Modal ---

// --- NEW: Drafts Modal (KEPT AS-IS) ---
const DraftsModal = ({ isOpen, onClose, drafts, onView, onEdit, onDelete }) => {
    // ... (Implementation unchanged) ...
    const handleAction = (action, submissionId) => {
        if (action === 'view') {
            onView(submissionId);
        } else if (action === 'edit') {
            onEdit(submissionId);
        } else if (action === 'delete') {
            onDelete(submissionId);
        }
        onClose(); // Close modal after action
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
// --- END Drafts Modal ---


// --- Mentorship Submissions Table Component (MODIFIED Filters) ---
const MentorshipSubmissionsTable = ({
    submissions, activeService, onView, onEdit, onDelete,
    fetchSubmissions, isSubmissionsLoading,
    filterServiceType, // <-- NEW PROP ADDED
    // --- NEW: Filter props ---
    stateFilter, localityFilter, supervisorFilter, statusFilter
}) => {
    
    const handleAction = (action, submission) => {
        if (action === 'view') {
            onView(submission.id);
        } else if (action === 'edit') {
            // Note: This needs to call the parent's handleEditSubmission which is passed via onView/onEdit
            // This is a common pattern where the table acts as a dispatcher.
            onEdit(submission.id); // Call onEdit
        } else if (action === 'delete') {
            onDelete(submission.id);
        }
    };

    const filteredSubmissions = useMemo(() => {
        let filtered = submissions;
        const motherServiceType = `${activeService}_MOTHERS`; // Dynamic mother service type

        if (activeService) {
            // Filter by the main service *program* (e.g., IMNCI) and its related forms (IMNCI_MOTHERS or EENC_MOTHERS)
            filtered = filtered.filter(sub => sub.service === activeService || sub.service === motherServiceType); 
        }
        // NEW: Add secondary filter for the specific tab (skills vs mothers)
        if (filterServiceType) {
            // filterServiceType will be "IMNCI" or "EENC" or "IMNCI_MOTHERS" or "EENC_MOTHERS"
            filtered = filtered.filter(sub => sub.service === filterServiceType);
        }
        // --- MODIFICATION: Use filter props ---
        if (stateFilter) {
             filtered = filtered.filter(sub => sub.state === stateFilter);
        }
        if (localityFilter) {
             filtered = filtered.filter(sub => sub.locality === localityFilter);
        }
        if (supervisorFilter) {
            filtered = filtered.filter(sub => sub.supervisorEmail === supervisorFilter); // <-- USE EMAIL
        }
        if (statusFilter) {
             filtered = filtered.filter(sub => sub.status === statusFilter);
        }
        // --- END MODIFICATION ---
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
    }, [submissions, activeService, filterServiceType, stateFilter, localityFilter, supervisorFilter, statusFilter]); // <-- PROPS ADDED TO DEPENDENCIES


    return (
        <div dir="ltr" className="p-4"> 
                {/* --- MODIFICATION: Filter bar removed from here --- */}

                {/* Table */}
                <div className="mt-6 overflow-x-auto">
                     {isSubmissionsLoading ? (
                        <div className="flex justify-center p-8"><Spinner /></div>
                    ) : (
                        <table className="min-w-full border-collapse border border-gray-300" dir="ltr"> {/* <-- MODIFICATION: Table style */}
                            <thead className="bg-gray-50">
                                <tr>
                                    <MentorshipTableColumns />
                                </tr>
                            </thead><tbody className="bg-white divide-y divide-gray-200">{/* <-- FIX: Removed whitespace */}{filteredSubmissions.length === 0 ? (
                                    <tr><td colSpan="8" className="border border-gray-300"><EmptyState title="No Records Found" message="No mentorship visits matched the current filters for this service." /></td></tr>
                                ) : (
                                    filteredSubmissions.map((sub, index) => {
                                        const scoreData = sub.scores;
                                        let percentage = null;
                                        if (scoreData && scoreData.overallScore_maxScore > 0) {
                                            percentage = Math.round((scoreData.overallScore_score / scoreData.overallScore_maxScore) * 100);
                                        }

                                        // NEW: Determine worker name/service for display
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
                                            {/* --- MODIFICATION: Added border class to all <td>s --- */}
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left border border-gray-300">{index + 1}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{sub.facility}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left font-semibold border border-gray-300">{workerDisplay}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{sub.supervisorDisplay}</td> {/* <-- USE DISPLAY */}
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{sub.date}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-left border border-gray-300">
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
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-800 text-left border border-gray-300">
                                                {isMotherSurvey ? 'N/A' : (percentage !== null ? `${percentage}%` : 'N/A')}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-left border border-gray-300">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="info" onClick={() => handleAction('view', sub)}>View</Button>
                                                    {sub.service === 'IMNCI' && <Button size="sm" variant="warning" onClick={() => handleAction('edit', sub)}>Edit</Button>} {/* Conditional Edit */}
                                                    <Button size="sm" variant="danger" onClick={() => handleAction('delete', sub)}>Delete</Button>
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
// --- END Mentorship Submissions Table Component ---

// --- Service Selection Component (MODIFIED to English Layout) ---
const ServiceSelector = ({ onSelectService }) => {
    // ... (Implementation unchanged) ...
    const services = [
        { key: 'IMNCI', title: 'Mentorship on Integrated Management of Newborn and Childhood Illnesses (IMNCI)', enabled: true },
        { key: 'EENC', title: 'Mentorship on Early Essential Newborn Care (EENC)', enabled: true }, // <-- MODIFIED
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
    canBulkUploadMentorships = false
}) => {
    // --- Existing State ---
    const [currentView, setCurrentView] = useState(publicSubmissionMode ? 'form_setup' : 'service_selection');
    const [activeService, setActiveService] = useState(publicSubmissionMode ? publicServiceType : null);
    const [selectedState, setSelectedState] = useState('');
    const [selectedLocality, setSelectedLocality] = useState('');
    const [selectedFacilityId, setSelectedFacilityId] = useState('');
    const [selectedHealthWorkerName, setSelectedHealthWorkerName] = useState('');

    // --- MODIFICATION: Set activeTab default to 'skills_list' ---
    const [activeTab, setActiveTab] = useState('skills_list'); // MODIFIED: Default to skills_list tab

    // --- NEW STATE ADDITIONS ---
    const [activeFormType, setActiveFormType] = useState('skills_assessment'); // 'skills_assessment', 'mothers_form', or 'visit_report'
    // --- END NEW STATE ADDITIONS ---

    // --- NEW: State to control form rendering after selection ---
    const [isReadyToStart, setIsReadyToStart] = useState(false);
    // --- END NEW STATE ---

    // --- MODIFIED: Dashboard Filter State ---
    const [activeDashboardState, setActiveDashboardState] = useState('');
    const [activeDashboardLocality, setActiveDashboardLocality] = useState('');
    const [activeDashboardFacilityId, setActiveDashboardFacilityId] = useState(''); // <-- CHANGED
    const [activeDashboardWorkerName, setActiveDashboardWorkerName] = useState(''); // <-- CHANGED
    // --- END MODIFICATION ---

    // --- MODIFICATION: Get data and fetchers from DataContext ---
    const {
        healthFacilities,
        fetchHealthFacilities,
        isLoading: isDataCacheLoading,
        skillMentorshipSubmissions,
        fetchSkillMentorshipSubmissions,
        imnciVisitReports, // <-- EXISTING
        fetchIMNCIVisitReports, // <-- EXISTING
        eencVisitReports, // <-- ASSUMED/ADDED
        fetchEENCVisitReports, // <-- ASSUMED/ADDED
        isFacilitiesLoading, // Use this directly for form setup
    } = useDataCache();
    // --- END MODIFICATION ---

// --- START: NEW LOCAL STATE FOR OPTIMISTIC UPDATES ---
    const [localHealthFacilities, setLocalHealthFacilities] = useState(healthFacilities || []);

    useEffect(() => {
        // Sync local state when the global cache updates
        if (healthFacilities) {
            setLocalHealthFacilities(healthFacilities);
        }
    }, [healthFacilities]);
    // --- END: NEW LOCAL STATE ---

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
    const user = auth.currentUser; // Get current user for filtering drafts
    const [selectedWorkerOriginalData, setSelectedWorkerOriginalData] = useState(null);
    const [workerJobTitle, setWorkerJobTitle] = useState('');
    const [workerTrainingDate, setWorkerTrainingDate] = useState('');
    const [workerPhone, setWorkerPhone] = useState('');
    const [isWorkerInfoChanged, setIsWorkerInfoChanged] = useState(false);
    const [isUpdatingWorker, setIsUpdatingWorker] = useState(false);

    // --- NEW: State for Drafts Modal ---
    const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
 
    // --- NEW: State for Add Facility Modal ---
    const [isAddFacilityModalOpen, setIsAddFacilityModalOpen] = useState(false);

    // --- START: NEW STATE FOR MODALS ---
    const [isMothersFormModalOpen, setIsMothersFormModalOpen] = useState(false);
    const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
    const [isVisitReportModalOpen, setIsVisitReportModalOpen] = useState(false); // <-- NEW
    const [isPostSaveModalOpen, setIsPostSaveModalOpen] = useState(false);
    const [lastSavedFacilityInfo, setLastSavedFacilityInfo] = useState(null); // To store { state, locality, facilityId }
 
    // --- END: NEW STATE FOR MODALS ---

    // --- NEW: Ref for the SkillsAssessmentForm ---
    const formRef = useRef(null);
    
    // --- NEW: Filter State (Moved from Table) ---
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [supervisorFilter, setSupervisorFilter] = useState(''); 
    const [statusFilter, setStatusFilter] = useState('');


    // --- MODIFIED: useMemo to process submissions for table and drafts ---
    const processedSubmissions = useMemo(() => {
        if (!skillMentorshipSubmissions) return [];
        return skillMentorshipSubmissions.map(sub => ({
            // --- Keep existing fields ---
            id: sub.id,
            service: sub.serviceType,
            date: sub.effectiveDate ? new Date(sub.effectiveDate.seconds * 1000).toISOString().split('T')[0] : (sub.sessionDate || 'N/A'),
            effectiveDateTimestamp: sub.effectiveDate,
            state: sub.state || 'N/A',
            locality: sub.locality || 'N/A',
            facility: sub.facilityName || 'N/A',
            staff: sub.healthWorkerName || 'N/A',
            // --- MODIFICATION: Add name, email, and display fields ---
            supervisorEmail: sub.mentorEmail || null,
            supervisorName: sub.mentorName || null,
            supervisorDisplay: sub.mentorName || sub.mentorEmail || 'N/A',
            // --- END MODIFICATION ---
            facilityId: sub.facilityId || null,
            scores: sub.scores || null,
            status: sub.status || 'complete',
            
            // --- START: ADDITIONS (MODIFIED) ---
            facilityType: sub.facilityType || null,
            workerType: sub.workerType || null,
            motherName: sub.motherName || null, // For Mother's Form display
            visitNumber: sub.visitNumber || null, // <-- MODIFICATION: ADDED THIS LINE
            // --- END: ADDITIONS (MODIFIED) ---

            // --- START: MODIFICATION (Add sessionDate for visit counting) ---
            sessionDate: sub.sessionDate || (sub.effectiveDate ? new Date(sub.effectiveDate.seconds * 1000).toISOString().split('T')[0] : null),
            // --- END: MODIFICATION ---

            fullData: sub // Store the original data for editing drafts
        }));
    }, [skillMentorshipSubmissions]);
    // --- END MODIFICATION ---

    // --- NEW: Memoized list of user's drafts for the current service ---
    const currentUserDrafts = useMemo(() => {
        if (!user || !processedSubmissions || !activeService) return [];
        return processedSubmissions.filter(sub =>
            sub.status === 'draft' &&
            sub.supervisorEmail === user.email && // Match current user's email
            sub.service === activeService   // Match the active service
        ).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
    }, [processedSubmissions, user, activeService]);


    // --- MODIFIED: Memoized list of visit reports (filters by activeService) ---
    const processedVisitReports = useMemo(() => {
        const imnci = (imnciVisitReports || []).map(rep => ({
            id: rep.id,
            service: 'IMNCI', // <-- Add service type
            facilityId: rep.facilityId || null,
            facilityName: rep.facilityName || 'N/A',
            state: rep.state || 'N/A',
            locality: rep.locality || 'N/A',
            visitDate: rep.visit_date || 'N/A',
            mentorEmail: rep.mentorEmail || null,
            mentorName: rep.mentorName || null,
            mentorDisplay: rep.mentorName || rep.mentorEmail || 'N/A',
            fullData: rep // Store original for editing
        }));
        
        const eenc = (eencVisitReports || []).map(rep => ({
            id: rep.id,
            service: 'EENC', // <-- Add service type
            facilityId: rep.facilityId || null,
            facilityName: rep.facilityName || 'N/A',
            state: rep.state || 'N/A',
            locality: rep.locality || 'N/A',
            visitDate: rep.visit_date || 'N/A',
            mentorEmail: rep.mentorEmail || null,
            mentorName: rep.mentorName || null,
            mentorDisplay: rep.mentorName || rep.mentorEmail || 'N/A',
            fullData: rep // Store original for editing
        }));

        // Combine and filter by the active service
        const allReports = [...imnci, ...eenc];
        return allReports.filter(rep => rep.service === activeService);

    }, [imnciVisitReports, eencVisitReports, activeService]); // <-- MODIFIED
    // --- END MODIFICATION ---

    // --- MODIFIED: Handlers for Visit Reports ---
    const handleEditVisitReport = (reportId) => {
        // Find in the correct *original* list based on activeService
        const reportList = activeService === 'IMNCI' ? imnciVisitReports : eencVisitReports;
        if (!reportList) return;

        const report = reportList.find(r => r.id === reportId);
        if (!report) return;

        setSelectedState(report.state);
        setSelectedLocality(report.locality);
        setSelectedFacilityId(report.facilityId);
        setEditingSubmission(report); // Re-use editingSubmission state
        setActiveFormType('visit_report');
        setCurrentView('form_setup');
        setIsReadyToStart(true); 
    };

    const handleDeleteVisitReport = async (reportId) => {
        if (window.confirm('Are you sure you want to delete this visit report?')) {
            try {
                if (activeService === 'IMNCI') {
                    await deleteIMNCIVisitReport(reportId);
                    await fetchIMNCIVisitReports(true);
                } else if (activeService === 'EENC') {
                    await deleteEENCVisitReport(reportId);
                    await fetchEENCVisitReports(true); // <-- Fetch EENC
                }
                setToast({ show: true, message: 'Report deleted.', type: 'success' });
            } catch (error) {
                setToast({ show: true, message: `Delete failed: ${error.message}`, type: 'error' });
            }
        }
    };
    // --- END MODIFICATION ---

     // --- MODIFIED: DATA FETCHING (Fetches EENC reports) ---
     useEffect(() => {
        // This fetches the list of facilities for the dropdowns
        fetchHealthFacilities();

        // These fetches are required for BOTH public and authenticated modes
        // to populate all the history tables (skills, mothers, visits)
        // and for the dashboard to have data.
        fetchSkillMentorshipSubmissions();
        fetchIMNCIVisitReports(); 
        if (fetchEENCVisitReports) fetchEENCVisitReports(); // <-- ADDED (with check)

    }, [fetchHealthFacilities, fetchSkillMentorshipSubmissions, fetchIMNCIVisitReports, fetchEENCVisitReports]); // <-- ADDED
    // --- END MODIFICATION ---
    
    // --- NEW: Effect to reset filters on tab change ---
    useEffect(() => {
        setStateFilter('');
        setLocalityFilter('');
        setSupervisorFilter('');
        setStatusFilter('');
    }, [activeTab]);


     const availableStates = useMemo(() => {
        const allStates = Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar));
        const userAllowedStates = allStates.filter(sKey =>
             publicSubmissionMode || !userStates || userStates.length === 0 || userStates.includes(sKey)
        );
        return [
            { key: "", label: "-- اختر الولاية --" },
            ...userAllowedStates.map(sKey => ({ key: sKey, label: STATE_LOCALITIES[sKey].ar }))
        ];
    }, [userStates, publicSubmissionMode]);

    // --- NEW: Filter Memos (Moved from Table) ---
    const uniqueSupervisors = useMemo(() => {
        const supervisorMap = new Map();
        processedSubmissions.forEach(sub => {
            if (sub.supervisorEmail) {
                // Store the best available name for this email
                if (!supervisorMap.has(sub.supervisorEmail)) {
                    supervisorMap.set(sub.supervisorEmail, sub.supervisorDisplay);
                } else {
                    // Prefer a real name over an email if we find one later
                    if (sub.supervisorName) {
                        supervisorMap.set(sub.supervisorEmail, sub.supervisorDisplay);
                    }
                }
            }
        });
        // Convert map to array of objects { email, display }
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
    // --- END NEW FILTER MEMOS ---


     useEffect(() => {
        if (!publicSubmissionMode && userStates && userStates.length === 1) {
            setSelectedState(userStates[0]);
        }
    }, [userStates, publicSubmissionMode]);

    useEffect(() => {
       if (!publicSubmissionMode && permissions.manageScope === 'locality' && userLocalities && userLocalities.length === 1) {
            setSelectedLocality(userLocalities[0]);
        }
    }, [userLocalities, permissions.manageScope, publicSubmissionMode]);


    const handleStateChange = (e) => {
        setSelectedState(e.target.value);
        if (permissions.manageScope !== 'locality' || publicSubmissionMode) {
             setSelectedLocality('');
        }
        setSelectedFacilityId('');
        setSelectedHealthWorkerName('');
        setSelectedWorkerOriginalData(null);
        setWorkerJobTitle('');
        setWorkerTrainingDate('');
        setWorkerPhone('');
        setIsWorkerInfoChanged(false);
        setIsReadyToStart(false); // <-- ADDED: Reset ready state
    };


    const filteredFacilities = useMemo(() => {
        if (!localHealthFacilities || !selectedState || !selectedLocality) return [];
        return localHealthFacilities.filter(f => f['الولاية'] === selectedState && f['المحلية'] === selectedLocality)
               .sort((a, b) => (a['اسم_المؤسسة'] || '').localeCompare(b['اسم_المؤسسة'] || ''));
    }, [localHealthFacilities, selectedState, selectedLocality]);

    // --- NEW: Memo for SearchableSelect options ---
    const facilityOptions = useMemo(() => {
        const options = [
            {
                value: 'addNew',
                label: '--- إضافة منشأة جديدة ---',
                className: 'font-bold text-sky-600 bg-sky-50'
            }
        ];
        filteredFacilities.forEach(f => options.push({
            value: f.id,
            label: f['اسم_المؤسسة'],
            group: ''
        }));
        return options;
    }, [filteredFacilities]);

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

    // --- START: MODIFIED Visit Number Logic ---
    const visitNumber = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return 1;
        }

        // 1. If we are editing a submission, just use its stored visit number.
        if (editingSubmission) {
             return editingSubmission.visitNumber || 1; 
        }

        // 2. If creating a new session, calculate based on unique visit days.
        const workerSessions = processedSubmissions.filter(sub =>
            sub.facilityId === selectedFacilityId &&
            sub.staff === selectedHealthWorkerName &&
            sub.service === activeService &&
            sub.status !== 'draft' && // Only count completed visits
            sub.sessionDate // Ensure it has a date
        );

        // Get all unique dates
        const uniqueDateSet = new Set(workerSessions.map(s => s.sessionDate));
        const baseVisitCount = uniqueDateSet.size;

        if (baseVisitCount === 0) {
            return 1; // This is the first visit
        }
        
        // Find the latest date string from the set
        const sortedDates = Array.from(uniqueDateSet).sort();
        const lastVisitDateStr = sortedDates[sortedDates.length - 1];

        // Compare last visit date to *today's date* (for a new session)
        const todayStr = new Date().toISOString().split('T')[0];

        if (todayStr === lastVisitDateStr) {
            // New session on the same day as the last visit. Use the same number.
            return baseVisitCount;
        } else {
            // New session on a new day. Increment the number.
            return baseVisitCount + 1;
        }

    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService, editingSubmission]);
    // --- END: MODIFIED Visit Number Logic ---

    // --- START: MODIFIED Last Session Date Logic ---
    const lastSessionDate = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return null;
        }

        // Get all completed, non-draft sessions for this worker, sorted by date
        const workerSessions = processedSubmissions
            .filter(sub =>
                sub.facilityId === selectedFacilityId &&
                sub.staff === selectedHealthWorkerName &&
                sub.service === activeService &&
                sub.status !== 'draft' // Only consider completed sessions
            )
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        // If editing, find the latest completed session *before* the one being edited
        if (editingSubmission) {
            // Find sessions that are not this one
            const sessionsBeforeThisOne = workerSessions.filter(s =>
                s.id !== editingSubmission.id
            );
             return sessionsBeforeThisOne.length > 0 ? sessionsBeforeThisOne[0].date : null;
        }
        // If creating new, find the latest completed session
        else {
            return workerSessions.length > 0 ? workerSessions[0].date : null;
        }
    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService, editingSubmission]);
    // --- END: MODIFIED Last Session Date Logic ---


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


    // --- Navigation and Form Handlers ---
    const resetSelection = () => {
        // Keep state/locality if user is restricted
        if (publicSubmissionMode || !(userStates && userStates.length === 1)) {
            setSelectedState('');
        }
        if (publicSubmissionMode || !(permissions.manageScope === 'locality' && userLocalities && userLocalities.length === 1)) {
            setSelectedLocality('');
        }
        setSelectedFacilityId('');
        setSelectedHealthWorkerName('');
        setSelectedWorkerOriginalData(null);
        setWorkerJobTitle('');
        setWorkerTrainingDate('');
        setWorkerPhone('');
        setIsWorkerInfoChanged(false);
        setEditingSubmission(null); // Clear editing state here too
        setActiveFormType('skills_assessment'); // <-- Reset form type
        setIsReadyToStart(false); // <-- ADDED: Reset ready state
    };
    const handleSelectService = (serviceKey) => {
        setActiveService(serviceKey);
        setCurrentView('history');
        setActiveTab('skills_list'); // MODIFIED: Default to skills_list tab
    };
    
    // --- MODIFIED: handleStartNewVisit ---
    const handleStartNewVisit = async () => {
        // This function now *only* resets state and navigates to the setup view.
        // The draft check is moved to handleProceedToForm.
        resetSelection(); // This clears editingSubmission, resets form type, and sets isReadyToStart(false)
        setCurrentView('form_setup');
    };
    // --- END MODIFICATION ---
    
    // --- NEW HANDLER: For starting Mother's Form ---
    const handleStartMothersForm = () => {
        resetSelection(); // This clears editingSubmission and resets selected worker
        setActiveFormType('mothers_form');
        setCurrentView('form_setup');
    };
    // --- END NEW HANDLER ---

    // --- NEW HANDLER: For starting Visit Report ---
    const handleStartNewVisitReport = () => {
        resetSelection();
        setActiveFormType('visit_report');
        setCurrentView('form_setup');
    };
    // --- END NEW HANDLER ---

    const handleReturnToServiceSelection = () => {
        setActiveService(null);
        setCurrentView('service_selection');
        resetSelection();
    };

    // This function handles "Cancel" button clicks or non-save exits from forms
    const handleExitForm = () => {
        const completedFormType = activeFormType; // Capture type before reset
        resetSelection(); 

        if (publicSubmissionMode) {
             setCurrentView('form_setup'); // Go back to setup in public mode
        } else {
            setCurrentView('history'); // Go back to history in normal mode
            if (completedFormType === 'mothers_form') {
                setActiveTab('mothers_list');
            } else if (completedFormType === 'visit_report') {
                setActiveTab('visit_reports');
            } else {
                setActiveTab('skills_list');
            }
        }
    };

    // This function handles successful saves from SkillsAssessmentForm
    const handleSaveSuccess = async (status, savedData) => {
        // This handler is ONLY for SkillsAssessmentForm
        const wasEditing = !!editingSubmission;
        const completedFormType = activeFormType; // This will be 'skills_assessment'

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
            // Completed save in auth mode: Show popup
            setLastSavedFacilityInfo(lastFacilityInfo);
            setIsPostSaveModalOpen(true);
        } else {
            // This handles 'draft' saves or public 'complete' saves
            if (publicSubmissionMode) {
                if (status === 'complete') {
                    setToast({ show: true, message: 'Submission successful! Thank you.', type: 'success' });
                }
                setCurrentView('form_setup');
            } else {
                // This handles 'draft' saves
                setCurrentView('history');
                setActiveTab('skills_list');
            }
        }
    };

    // --- MODIFIED: This function handles exits from MothersForm and VisitReport ---
    const handleGenericFormExit = async (returnTab = 'skills_list') => {
        resetSelection(); 

        // We assume any exit from these forms (save or cancel) should refresh lists
        // (Skills form has its own save handler 'handleSaveSuccess')
        await fetchSkillMentorshipSubmissions(true); 
        await fetchIMNCIVisitReports(true); // Also refresh visit reports
        if (fetchEENCVisitReports) await fetchEENCVisitReports(true); // <-- ADDED


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
         resetSelection(); // <-- This now also resets isReadyToStart
         // editingSubmission is cleared in resetSelection
    };

   // --- NEW: Handlers for Post-Save Modal ---
    const handlePostSaveSelect = (actionType) => {
        if (!lastSavedFacilityInfo) return;

        // Close the post-save modal immediately
        setIsPostSaveModalOpen(false);

        // Pre-fill state, locality, facility (needed for ALL actions)
        const savedInfo = lastSavedFacilityInfo; // Copy info before clearing
        setLastSavedFacilityInfo(null); // Clear this now

        setSelectedState(savedInfo.state);
        setSelectedLocality(savedInfo.locality);
        setSelectedFacilityId(savedInfo.facilityId);

        if (actionType === 'skills_assessment' || actionType === 'mothers_form' || actionType === 'visit_report') {
            // --- ACTION: Start a new form ---
            
            // Set form type and view
            setActiveFormType(actionType);
            setCurrentView('form_setup');
            
            // Clear worker and reset flags
            setSelectedHealthWorkerName('');
            setIsReadyToStart(false); // Let the setup screen show

        } else if (actionType === 'dashboard') {
            // --- ACTION: Open Dashboard Modal ---
            
            // Pre-filter the dashboard to this facility
            setActiveDashboardState(savedInfo.state);
            setActiveDashboardLocality(savedInfo.locality);
            setActiveDashboardFacilityId(savedInfo.facilityId);
            setIsDashboardModalOpen(true);
            
            // Go back to the history view in the background
            setCurrentView('history');
            setActiveTab('skills_list');

        } else if (actionType === 'drafts') {
            // --- ACTION: Open Drafts Modal ---
            setIsDraftsModalOpen(true);

            // Go back to the history view in the background
            setCurrentView('history');
            setActiveTab('skills_list');
        }
    };

    const handlePostSaveClose = () => {
        setIsPostSaveModalOpen(false);
        setLastSavedFacilityInfo(null);
        // Exit to history (the default "cancel" behavior)
        setCurrentView('history');
        setActiveTab('skills_list'); // Default to skills list
    };
    // --- END NEW HANDLERS ---

    // --- NEW: Handler for the "Start Session" button ---
    const handleProceedToForm = () => {
        // This function is called by the "Start Session" button in form_setup
        // It's only for 'skills_assessment' as 'mothers_form' doesn't have drafts
        if (activeFormType === 'skills_assessment') {
            // Find if a draft already exists for this specific worker
            const draftForSelectedWorker = currentUserDrafts.find(d => 
                d.facilityId === selectedFacilityId && 
                d.staff === selectedHealthWorkerName
            );

            if (draftForSelectedWorker) {
                const confirmEdit = window.confirm(
                    `يوجد لديك مسودة محفوظة لهذا العامل الصحي: \n\n${draftForSelectedWorker.staff} \n${draftForSelectedWorker.facility} \nبتاريخ: ${draftForSelectedWorker.date}\n\nهل تريد تعديل هذه المسودة؟ \n\n(ملاحظة: الضغط على 'Cancel' سيبدأ جلسة جديدة فارغة لهذا العامل.)`
                );
                
                if (confirmEdit) {
                    // User wants to edit. This sets editingSubmission and currentView.
                    // The render logic will catch this and show the form in edit mode.
                    handleEditSubmission(draftForSelectedWorker.id);
                } else {
                    // User wants a new form. Clear any old edit state and set ready flag.
                    setEditingSubmission(null);
                    setIsReadyToStart(true); 
                    // The component will re-render, and the logic at line 1386 will show the new form.
                }
            } else {
                // No draft exists for this worker. Proceed with a new form.
                setEditingSubmission(null);
                setIsReadyToStart(true);
            }
        } else if (activeFormType === 'mothers_form' || activeFormType === 'visit_report') {
            // Mother's form & Visit Report don't have drafts, just proceed.
            setEditingSubmission(null);
            setIsReadyToStart(true);
        }
    };
    // --- END NEW HANDLER ---

    const handleShareSubmissionLink = () => {
        const publicUrl = `${window.location.origin}/mentorship/submit/${activeService}`;
        navigator.clipboard.writeText(publicUrl).then(() => {
            setToast({ show: true, message: 'Public submission link copied to clipboard!', type: 'success' });
        }, (err) => {
            setToast({ show: true, message: 'Failed to copy link.', type: 'error' });
        });
    };
    
    // --- handleImportMentorships (RETAINS importMentorshipSessions from data.js) ---
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
    // --- END handleImportMentorships ---
    
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
                ...selectedFacility, // All existing facility data
                imnci_staff: newStaffList, // The updated staff list
                updated_by: user ? (user.displayName || user.email) : (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm'),
                'اخر تحديث': new Date().toISOString() 
            };
            
            // 1. Submit for approval
            await submitFacilityDataForApproval(payload, user?.email || (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm'));

            setToast({ show: true, message: 'تم إرسال طلب إضافة العامل الصحي للموافقة.', type: 'info' });

            // 2. --- FIX: Optimistically update local state ---
            // This line adds the worker to your local list.
            setLocalHealthFacilities(prevFacilities => 
                prevFacilities.map(f => f.id === payload.id ? payload : f)
            );
            // DO NOT add fetchHealthFacilities(true) here

            // 3. Select the new worker
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
                ...selectedFacility, // All existing facility data
                imnci_staff: newStaffList, // The updated staff list
                updated_by: user ? (user.displayName || user.email) : (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm'),
                'اخر تحديث': new Date().toISOString()
            };

            // 1. Submit for approval
            await submitFacilityDataForApproval(payload, user?.email || (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm'));
            
            setToast({ show: true, message: 'تم إرسال طلب تحديث بيانات العامل للموافقة.', type: 'info' });

            // 2. --- FIX: Optimistically update local state ---
            // This line updates the worker in your local list.
            setLocalHealthFacilities(prevFacilities => 
                prevFacilities.map(f => f.id === payload.id ? payload : f)
            );
            // DO NOT add fetchHealthFacilities(true) here
            
            // 3. Update the "original data" baseline
            const updatedOriginalData = {
                 name: selectedHealthWorkerName,
                 job_title: workerJobTitle,
                 training_date: workerTrainingDate,
                 phone: workerPhone
            };
            setSelectedWorkerOriginalData(updatedOriginalData);
            setIsWorkerInfoChanged(false); // This will hide the update button

        } catch (error) {
             console.error("Error submitting health worker update for approval:", error);
             setToast({ show: true, message: `فشل تحديث بيانات العامل: ${error.message}`, type: 'error' });
        } finally {
            setIsUpdatingWorker(false);
        }
    };




    // --- MODIFIED: View, Edit, Delete Handlers (KEPT AS-IS) ---
    const handleViewSubmission = (submissionId) => {
        // ... (Implementation unchanged) ...
        const fullSubmission = skillMentorshipSubmissions.find(s => s.id === submissionId);
        setViewingSubmission(fullSubmission);
        setIsDraftsModalOpen(false); // Close drafts modal if open
    };

    const handleEditSubmission = async (submissionId) => { // MODIFIED: Made async
        // ... (Implementation unchanged) ...
        // Find the full original data using the ID
        const fullSubmission = skillMentorshipSubmissions.find(s => s.id === submissionId);
        if (!fullSubmission) return;
        
        // NEW: Only allow editing if it is a Skills Assessment form
        if (fullSubmission.serviceType !== 'IMNCI') {
            setToast({ show: true, message: 'لا يمكن تعديل هذا النوع من الجلسات (فقط جلسات الإشراف الفني قابلة للتعديل).', type: 'error' });
            return;
        }
        setActiveFormType('skills_assessment'); // <-- Set form type

        // --- START: New logic to save current draft before switching ---
        const isFormOpen = currentView === 'form_setup' && activeFormType === 'skills_assessment';
        // Check if we are switching to a *different* draft than the one currently being edited
        const isDifferentDraft = !editingSubmission || (editingSubmission.id !== submissionId);

        if (isFormOpen && isDifferentDraft && formRef.current) {
            try {
                // Show a toast that we are saving
                setToast({ show: true, message: 'Saving current draft before switching...', type: 'info' });
                // Call the saveDraft method exposed by the form via useImperativeHandle
                await formRef.current.saveDraft();
                
                // ================== BEGIN FIX ==================
                //
                // After the silent save, we must manually fetch submissions
                // to refresh the list in the background, so the
                // drafts modal will be up-to-date.
                await fetchSkillMentorshipSubmissions(true);
                //
                // =================== END FIX ===================

            } catch (e) {
                console.error("Failed to save current draft before switching:", e);
                setToast({ show: true, message: `Failed to save current draft: ${e.message}`, type: 'error' });
                // We'll proceed even if save fails, but the user is warned
            }
        }
        // --- END: New logic ---


        // Set state based on the *original* data structure
        setSelectedState(fullSubmission.state);
        setSelectedLocality(fullSubmission.locality);
        setSelectedFacilityId(fullSubmission.facilityId);
        setSelectedHealthWorkerName(fullSubmission.healthWorkerName);

        // Pass the *original* data structure to editingSubmission
        setEditingSubmission(fullSubmission);
        setIsReadyToStart(true); // <-- ADDED: Ensure form renders if we edit from setup

        setIsDraftsModalOpen(false); // Close drafts modal if open
        setCurrentView('form_setup'); // Navigate to form setup
    };


    const handleDeleteSubmission = async (submissionId) => {
        // ... (Implementation unchanged) ...
        // Find the submission from the *processed* array for display info
        const submissionToDelete = processedSubmissions.find(s => s.id === submissionId);
        if (!submissionToDelete) return;

        const confirmMessage = `هل أنت متأكد من حذف جلسة العامل الصحي: ${submissionToDelete.staff || submissionToDelete.motherName || 'N/A'} بتاريخ ${submissionToDelete.date}؟
${submissionToDelete.status === 'draft' ? '\n(هذه مسودة)' : ''}`;

        if (window.confirm(confirmMessage)) {
            try {
                await deleteMentorshipSession(submissionId);
                setToast({ show: true, message: 'تم حذف الجلسة بنجاح.', type: 'success' });
                await fetchSkillMentorshipSubmissions(true); // Refresh list
                setIsDraftsModalOpen(false); // Close drafts modal if open
                setViewingSubmission(null); // Close view modal if this was viewed
            } catch (error) {
                console.error("Error deleting session:", error);
                setToast({ show: true, message: `فشل الحذف: ${error.message}`, type: 'error' });
            }
        }
    };
    // --- END MODIFIED Handlers ---

    // --- NEW: Handler for when form autosaves a NEW draft ---
    const handleDraftCreated = (newDraftObject) => {
        // The form's autosave just created a new draft.
        // We must update our `editingSubmission` state
        // so the form's *next* autosave updates this same draft.
        setEditingSubmission(newDraftObject);
        
        // Also, trigger a background refresh of the submissions list
        // so the "Drafts (1)" button and list are accurate.
        fetchSkillMentorshipSubmissions(true);
    };
    // --- END NEW HANDLER ---


    // --- NEW: Mobile Bottom Nav Bar Component ---
    const MobileFormNavBar = ({ activeFormType, draftCount, onNavClick }) => {
        const isSkillsActive = activeFormType === 'skills_assessment';
        
        // --- MODIFIED: Added icons, labels are already Arabic ---
        const navItems = [
            { id: 'skills_assessment', label: 'استمارة المهارات', icon: FileText, active: activeFormType === 'skills_assessment', disabled: false },
            { id: 'mothers_form', label: 'استبيان الامهات', icon: Users, active: activeFormType === 'mothers_form', disabled: false },
            { id: 'facility_info', label: 'معلومات المؤسسة', icon: Building, active: false, disabled: !isSkillsActive },
            { id: 'visit_report', label: 'تقرير الزيارة', icon: ClipboardCheck, active: activeFormType === 'visit_report', disabled: false },
            { id: 'drafts', label: `مسودات (${draftCount})`, icon: Archive, active: false, disabled: !isSkillsActive },
            { id: 'dashboard', label: 'المنصة', icon: LayoutDashboard, active: false, disabled: false },
        ];
        
        const itemWidth = `${100 / navItems.length}%`; // Dynamic width

        return (
            // --- MODIFIED: Added dir="rtl" to the container ---
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center bg-gray-900 text-white border-t border-gray-700 shadow-lg" dir="rtl">
                {navItems.map(item => {
                    const IconComponent = item.icon; // Get the icon component
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
                            {/* --- ADDED: Icon rendering --- */}
                            <IconComponent className="h-5 w-5 mb-0.5" />
                            
                            {/* --- MODIFIED: Removed 'truncate', added 'leading-tight' for wrapping --- */}
                            <span className="text-xs font-medium leading-tight">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    };
    // --- END: Mobile Bottom Nav Bar Component ---

   // --- NEW: Handler for Mobile Nav Clicks ---
    const handleMobileNavClick = async (target) => {
        // An "active form" is when the form itself is rendered (not the setup screen)
        const isFormRendered = (currentView === 'form_setup' && (isReadyToStart || editingSubmission));

         if (target === 'skills_assessment') {
            if (activeFormType !== 'skills_assessment') {
                 resetSelection(); // This resets form type to default 'skills_assessment'
                 // isReadyToStart will be false, so it stays on setup screen
            }
        } 
        else if (target === 'mothers_form') {
            if (isFormRendered) {
                // Form is open, open modal
                setIsMothersFormModalOpen(true);
            } else {
                // We are on the setup screen, just switch form type
                if (activeFormType !== 'mothers_form') {
                    resetSelection();
                    setActiveFormType('mothers_form');
                }
            }
        }
        else if (target === 'visit_report') {
             if (isFormRendered) {
                // Form is open, open modal
                setIsVisitReportModalOpen(true);
             } else {
                // We are on the setup screen, just switch form type
                if (activeFormType !== 'visit_report') {
                    resetSelection();
                    setActiveFormType('visit_report');
                }
             }
        }
        else if (target === 'facility_info' && activeFormType === 'skills_assessment' && formRef.current) {
            formRef.current.openFacilityModal();
        }
        else if (target === 'facility_update' && activeFormType === 'skills_assessment' && formRef.current) { // Keep old one just in case
            formRef.current.openFacilityModal();
        }
        else if (target === 'drafts' && activeFormType === 'skills_assessment') {
            // This button is only enabled when isSkillsActive is true.
            // It should work from setup screen or active form.
            setIsDraftsModalOpen(true);
        }
        else if (target === 'dashboard') {
            // Pre-filter dashboard if we are on the setup screen
            if (!isFormRendered) {
                setActiveDashboardState(selectedState);
                setActiveDashboardLocality(selectedLocality);
                setActiveDashboardFacilityId(selectedFacilityId);
                setActiveDashboardWorkerName(selectedHealthWorkerName);
            }
            setIsDashboardModalOpen(true);
        }
    };
    // --- END: Handler for Mobile Nav Clicks ---

    // --- Render Logic ---
    if (currentView === 'service_selection') {
        return <ServiceSelector onSelectService={handleSelectService} />;
    }

    // --- MODIFIED: 'history' view now renders tabs ---
    if (currentView === 'history') {
        const canShareLink = permissions.canManageSkillsMentorship || permissions.canUseSuperUserAdvancedFeatures;
        const serviceTitle = SERVICE_TITLES[activeService] || activeService;
        const headerTitle = `${activeService} Mentorship`;

        return (
            <>
                <Card dir="ltr">
                    <div className="p-6">
                        
                        {/* 1. --- MODIFICATION: Tabs moved to top and styled as buttons --- */}
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

                        {/* 2. --- MODIFICATION: Title smaller and moved below tabs --- */}
                        <div className="flex justify-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">{headerTitle}</h2>
                        </div>
                        
                        
                        {/* --- MODIFICATION: Filters and Action Buttons moved here --- */}
                        {activeTab !== 'dashboard' && (
                            <>
                                {/* 3. Filter Bar (Moved from Table) */}
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
                                            value={supervisorFilter} // This state now stores the email
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
                            
                                {/* 4. Action Buttons (Now below filters) */}
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-2 flex-wrap">
                                        
                                        {/* --- MODIFICATION: Show "Add Skills" only on skills tab --- */}
                                        {activeTab === 'skills_list' && (
                                            <Button onClick={handleStartNewVisit}>Add New Skills Observation</Button>
                                        )}
                                        
                                        {/* --- MODIFICATION: Show "Add Mother" only on mothers tab --- */}
                                        {activeTab === 'mothers_list' && (
                                            <Button variant="primary" onClick={handleStartMothersForm}>Add Mother's Knowledge & Satisfaction Form</Button>
                                        )}

                                        {/* --- MODIFICATION: Show "Add Visit Report" based on service --- */}
                                        {activeTab === 'visit_reports' && activeService === 'IMNCI' && (
                                            <Button variant="primary" onClick={handleStartNewVisitReport}>Add New IMNCI Visit Report</Button>
                                        )}
                                        {activeTab === 'visit_reports' && activeService === 'EENC' && (
                                            <Button variant="primary" onClick={handleStartNewVisitReport}>Add New EENC Visit Report</Button>
                                        )}
                                        {/* --- END MODIFICATION --- */}

                                        {/* --- MODIFICATION: Show "Bulk Upload" only on skills tab --- */}
                                        {activeTab === 'skills_list' && canBulkUploadMentorships && (
                                            <Button onClick={() => setIsBulkUploadModalOpen(true)}>Bulk Upload</Button>
                                        )}

                                        {/* --- MODIFICATION: Show "Share Link" only on skills tab --- */}
                                        {activeTab === 'skills_list' && canShareLink && (
                                             <Button variant="info" onClick={handleShareSubmissionLink}>
                                                 Share Submission Link
                                             </Button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        {/* --- END MODIFICATION --- */}


                        {/* Tab Content */}
                        <div>
                            {/* MODIFIED: Check for 'skills_list' and pass filter props */}
                            {activeTab === 'skills_list' && (
                                <MentorshipSubmissionsTable
                                    submissions={processedSubmissions}
                                    activeService={activeService}
                                    filterServiceType={activeService} // <-- MODIFIED
                                    onView={handleViewSubmission}
                                    onEdit={handleEditSubmission}
                                    onDelete={handleDeleteSubmission}
                                    fetchSubmissions={fetchSkillMentorshipSubmissions}
                                    isSubmissionsLoading={isDataCacheLoading.skillMentorshipSubmissions || !skillMentorshipSubmissions}
                                    // --- Pass filter state down ---
                                    stateFilter={stateFilter}
                                    localityFilter={localityFilter}
                                    supervisorFilter={supervisorFilter}
                                    statusFilter={statusFilter}
                                />
                            )}
                            {/* --- NEW CONTENT BLOCK: For Mother's Surveys --- */}
                            {activeTab === 'mothers_list' && (
                                <MentorshipSubmissionsTable
                                    submissions={processedSubmissions}
                                    activeService={activeService}
                                    filterServiceType={`${activeService}_MOTHERS`} // <-- MODIFIED
                                    onView={handleViewSubmission}
                                    onEdit={handleEditSubmission}
                                    onDelete={handleDeleteSubmission}
                                    fetchSubmissions={fetchSkillMentorshipSubmissions}
                                    isSubmissionsLoading={isDataCacheLoading.skillMentorshipSubmissions || !skillMentorshipSubmissions}
                                    // --- Pass filter state down ---
                                    stateFilter={stateFilter}
                                    localityFilter={localityFilter}
                                    supervisorFilter={supervisorFilter}
                                    statusFilter={statusFilter}
                                />
                            )}
                            {/* --- MODIFIED CONTENT BLOCK: For Visit Reports --- */}
                            {activeTab === 'visit_reports' && (
                                <VisitReportsTable
                                    reports={processedVisitReports} // This is now filtered by activeService
                                    onEdit={handleEditVisitReport}
                                    onDelete={handleDeleteVisitReport}
                                />
                            )}
                            {/* --- END MODIFICATION --- */}

                            {/* --- MODIFIED: Dashboard props --- */}
                            {activeTab === 'dashboard' && (
                                <MentorshipDashboard
                                    allSubmissions={processedSubmissions}
                                    STATE_LOCALITIES={STATE_LOCALITIES} // <-- PASS PROP
                                    activeService={activeService}
                                    
                                    // --- START: PASS FILTER PROPS (MODIFIED) ---
                                    activeState={activeDashboardState}
                                    onStateChange={(value) => {
                                        setActiveDashboardState(value);
                                        setActiveDashboardLocality(""); // Reset locality
                                        setActiveDashboardFacilityId(""); // <-- Add reset
                                        setActiveDashboardWorkerName(""); // <-- Add reset
                                    }}
                                    activeLocality={activeDashboardLocality}
                                    onLocalityChange={(value) => {
                                        setActiveDashboardLocality(value);
                                        setActiveDashboardFacilityId(""); // <-- Add reset
                                        setActiveDashboardWorkerName(""); // <-- Add reset
                                    }}
                                    activeFacilityId={activeDashboardFacilityId} // <-- Changed
                                    onFacilityIdChange={(value) => {
                                        setActiveDashboardFacilityId(value);
                                        setActiveDashboardWorkerName(""); // <-- Add reset
                                    }}
                                    activeWorkerName={activeDashboardWorkerName} // <-- Changed
                                    onWorkerNameChange={setActiveDashboardWorkerName} // <-- Changed
                                    // --- END: PASS FILTER PROPS (MODIFIED) ---
                                />
                            )}
                            {/* --- END MODIFICATION --- */}
                        </div>
                    </div>
                </Card>

                {/* Modals */}
                {isBulkUploadModalOpen && (
                    <DetailedMentorshipBulkUploadModal // MODIFIED: Imported modal used here
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
            </>
        );
    }
    // --- END 'history' VIEW MODIFICATION ---


    // ================== BEGIN FIX ==================
    //
    // --- 1. Render SkillsAssessmentForm (MODIFIED) ---
    //
    // This logic now finds the *full* facility object from the cache
    // when editing, or uses the selectedFacility.
    const facilityData = editingSubmission 
        ? (localHealthFacilities.find(f => f.id === editingSubmission.facilityId) || {
            // Fallback object if not found in cache (e.g., facility deleted)
            'الولاية': editingSubmission.state,
            'المحلية': editingSubmission.locality,
            'اسم_المؤسسة': editingSubmission.facilityName,
            'id': editingSubmission.facilityId,
            'نوع_المؤسسةالصحية': editingSubmission.facilityType 
          })
        : selectedFacility;
    //
    // =================== END FIX ===================

    // --- MODIFIED: Added 'isReadyToStart' check ---
    if (currentView === 'form_setup' && activeFormType === 'skills_assessment' && (editingSubmission || (isReadyToStart && selectedHealthWorkerName && selectedFacility)) && activeService && !isAddWorkerModalOpen && !isWorkerInfoChanged) {
        
        // --- START: MODIFIED FOR EENC ---
        if (activeService === 'IMNCI') {
            return (
                <>
                    <SkillsAssessmentForm
                        ref={formRef} // MODIFIED: Pass the ref
                        facility={facilityData}
                        healthWorkerName={editingSubmission ? editingSubmission.healthWorkerName : selectedHealthWorkerName}
                        healthWorkerJobTitle={editingSubmission ? editingSubmission.workerType : workerJobTitle} // <-- MODIFIED: Use editing data if available
                        healthWorkerTrainingDate={workerTrainingDate}
                        healthWorkerPhone={workerPhone}
                        onExit={handleExitForm} // Renamed from onCancel
                        onSaveComplete={handleSaveSuccess} // New prop for save
                        setToast={setToast}
                        visitNumber={visitNumber}
                        existingSessionData={editingSubmission} // Pass the original data
                        lastSessionDate={lastSessionDate}
                        onDraftCreated={handleDraftCreated} // <-- MODIFIED: Pass handler
                        
                        // --- START: NEW PROPS PASSED DOWN ---
                        setIsMothersFormModalOpen={setIsMothersFormModalOpen}
                        setIsDashboardModalOpen={setIsDashboardModalOpen}
                        setIsVisitReportModalOpen={setIsVisitReportModalOpen} // <-- NEW
                        draftCount={currentUserDrafts.length}
                        // --- END: NEW PROPS PASSED DOWN ---
                    />
                    {/* --- NEW: Drafts Modal --- */}
                    <MobileFormNavBar
                        activeFormType={activeFormType}
                        draftCount={currentUserDrafts.length}
                        onNavClick={handleMobileNavClick}
                    />
                    <DraftsModal
                        isOpen={isDraftsModalOpen}
                        onClose={() => setIsDraftsModalOpen(false)}
                        drafts={currentUserDrafts} // Pass the filtered drafts
                        onView={handleViewSubmission}
                        onEdit={handleEditSubmission}
                        onDelete={handleDeleteSubmission}
                    />
                    {/* Viewing uses the original data structure */}
                    {viewingSubmission && (
                        <ViewSubmissionModal
                            submission={viewingSubmission}
                            onClose={() => setViewingSubmission(null)}
                        />
                    )}
                
                    {/* --- START: NEW MOTHER'S FORM MODAL --- */}
                    {isMothersFormModalOpen && (
                        <Modal 
                            isOpen={isMothersFormModalOpen} 
                            onClose={() => setIsMothersFormModalOpen(false)} 
                            title="استبيان الأم: رضاء ومعرفة الأمهات"
                            size="full"
                        >
                            <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                                <MothersForm
                                    facility={facilityData} // Pass the same facility data as the skills form
                                    onCancel={() => { // This handles both Save and Cancel from the modal form
                                        setIsMothersFormModalOpen(false);
                                        fetchSkillMentorshipSubmissions(true); // Refresh submissions list on close
                                    }}
                                    setToast={setToast}
                                />
                            </div>
                        </Modal>
                    )}
                    {/* --- END: NEW MOTHER'S FORM MODAL --- */}

                    {/* --- START: NEW VISIT REPORT MODAL (MODIFIED) --- */}
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
                                            facility={facilityData} // Pass the same facility data as the skills form
                                            onCancel={() => { // This handles both Save and Cancel from the modal form
                                                setIsVisitReportModalOpen(false);
                                                fetchSkillMentorshipSubmissions(true); // Refresh submissions list on close
                                                fetchIMNCIVisitReports(true);
                                            }}
                                            setToast={setToast}
                                            allSubmissions={processedSubmissions}
                                            existingReportData={null} // Modal always creates new
                                        />
                                    ) : (
                                        <EENCVisitReport
                                            facility={facilityData}
                                            onCancel={() => {
                                                setIsVisitReportModalOpen(false);
                                                fetchSkillMentorshipSubmissions(true);
                                                if (fetchEENCVisitReports) fetchEENCVisitReports(true);
                                            }}
                                            setToast={setToast}
                                            allSubmissions={processedSubmissions}
                                            existingReportData={null}
                                        />
                                    )}
                                </Suspense>
                            </div>
                        </Modal>
                    )}
                    {/* --- END: NEW VISIT REPORT MODAL --- */}
                    
                    {/* --- START: NEW DASHBOARD MODAL --- */}
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
                                    STATE_LOCALITIES={STATE_LOCALITIES}
                                    activeService={activeService}
                                    
                                    // Pass dashboard filter state
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
                    {/* --- END: NEW DASHBOARD MODAL --- */}
                </>
            );
        }
        else if (activeService === 'EENC') {
            return (
                <>
                    {/* Render EENC Skills Form */}
                    <EENCSkillsAssessmentForm
                        facility={facilityData}
                        healthWorkerName={editingSubmission ? editingSubmission.healthWorkerName : selectedHealthWorkerName}
                        onExit={handleExitForm}
                        onSaveComplete={handleSaveSuccess} // Use the same save handler
                        setToast={setToast}
                        existingSessionData={editingSubmission}
                    />
                    {/* EENC Form doesn't use the complex sidebar, but we can add modals if needed */}
                </>
            );
        }
        // --- END: MODIFIED FOR EENC ---
    }
    
    // --- 2. Render MothersForm (MODIFIED) ---
    // --- MODIFIED: Added 'isReadyToStart' check ---
     if (currentView === 'form_setup' && activeFormType === 'mothers_form' && (isReadyToStart && selectedFacility) && activeService && !isAddWorkerModalOpen && !isWorkerInfoChanged) {
        
        // --- START: MODIFIED FOR EENC ---
        if (activeService === 'IMNCI') {
            return (
                <>
                    <MothersForm
                        facility={selectedFacility}
                        onCancel={() => handleGenericFormExit('mothers_list')} // Use the dedicated exit handler
                        setToast={setToast}
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
                        facility={selectedFacility}
                        onCancel={() => handleGenericFormExit('mothers_list')} // Use the dedicated exit handler
                        setToast={setToast}
                    />
                    {/* We can add MobileFormNavBar here too if EENC mothers form needs it */}
                </>
            );
        }
        // --- END: MODIFIED FOR EENC ---
    }

    // --- 4. Render VisitReport (MODIFIED) ---
     if (currentView === 'form_setup' && activeFormType === 'visit_report' && (editingSubmission || (isReadyToStart && selectedFacility)) && activeService) {
        
        const ReportComponent = activeService === 'IMNCI' ? IMNCIVisitReport : EENCVisitReport;
        
        return (
            <>
                <Suspense fallback={<div className="p-8"><Spinner /></div>}>
                    <ReportComponent
                        facility={facilityData} // Use the same facilityData logic from Skills form
                        onCancel={() => handleGenericFormExit('visit_reports')}
                        setToast={setToast}
                        allSubmissions={processedSubmissions} // Pass skills submissions
                        existingReportData={editingSubmission} // Pass editing data
                    />
                </Suspense>
                {/* --- NEW: Visit Report Modal (for nav) --- */}
                {isVisitReportModalOpen && (
                    <Modal isOpen={isVisitReportModalOpen} onClose={() => setIsVisitReportModalOpen(false)}>
                        <div className="p-4">Visit Report is already open.</div>
                    </Modal>
                )}
                {/* --- NEW: Mothers Form Modal (for nav) --- */}
                {/* (Need to add this here too for nav to work) */}
                {isMothersFormModalOpen && facilityData && <Modal isOpen={isMothersFormModalOpen} onClose={() => setIsMothersFormModalOpen(false)} title="استبيان الأم" size="full"><div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto"><MothersForm facility={facilityData} onCancel={() => { setIsMothersFormModalOpen(false); fetchSkillMentorshipSubmissions(true); }} setToast={setToast} /></div></Modal>}
                <MobileFormNavBar
                    activeFormType={activeFormType}
                    draftCount={currentUserDrafts.length}
                    onNavClick={handleMobileNavClick}
                 />
            </>
        );
    }
    // --- END MODIFICATION ---


    // --- 3. Render Setup View (Fallback for selection) ---
    const isStateFilterDisabled = !publicSubmissionMode && userStates && userStates.length === 1;
    const isLocalityFilterDisabled = publicSubmissionMode ? !selectedState : (permissions.manageScope === 'locality' || !selectedState);

    if (currentView === 'form_setup') {
        const serviceTitleArabic = activeService === 'EENC' 
            ? "الاشراف التدريبي الداعم على الرعاية الضرورية المبكرة (EENC)"
            : "الاشراف التدريبي الداعم على تطبيق العلاج المتكامل للاطفال اقل من 5 سنوات";
        
        const isSkillsAssessmentSetup = activeFormType === 'skills_assessment'; // Flag for worker requirement
        const isVisitReportSetup = activeFormType === 'visit_report'; // <-- NEW
        
        // --- MODIFIED: Setup Title ---
        let setupTitle = '';
        if (isSkillsAssessmentSetup) {
            setupTitle = editingSubmission ? `تعديل جلسة: ${serviceTitleArabic}` : `إدخال بيانات: ${serviceTitleArabic}`;
        } else if (isVisitReportSetup) {
            setupTitle = editingSubmission ? (activeService === 'EENC' ? 'تعديل تقرير زيارة EENC' : 'تعديل تقرير الزيارة') : (activeService === 'EENC' ? 'إدخال تقرير زيارة EENC' : 'إدخال تقرير زيارة جديد');
        } else {
            setupTitle = activeService === 'EENC' ? 'نموذج استبيان الأم (EENC)' : 'نموذج استبيان الأم (IMNCI)';
        }
        // --- END MODIFICATION ---

        const setupSubtitle = isSkillsAssessmentSetup 
            ? "الرجاء اختيار الولاية والمحلية والمنشأة والعامل الصحي للمتابعة." 
            : "الرجاء اختيار الولاية والمحلية والمنشأة للمتابعة.";

        return (
            <>
                {/* --- START: REMOVED Sticky Drafts Button --- */}
                {/* The floating draft button was here and is now removed. */}
                {/* --- END: REMOVED Sticky Drafts Button --- */}

                <Card dir="rtl">
                    <div className="p-6">
                        {/* FINAL ALIGNMENT FIX: Centered Title, No Back Button */}
                        <div className="mx-auto text-center mb-6 max-w-lg"> 
                            {/* --- FIX: Pass plain string to title/subtitle props --- */}
                            <PageHeader
                                title={setupTitle}
                                subtitle={setupSubtitle}
                            />
                        </div>

                        {/* --- Selection Grid --- */}
                        {/* --- MODIFICATION: Spinner logic moved --- */}
                        <div className="space-y-6 mt-6">
                            {/* GRID ALIGNMENT FIX: Use flex-row-reverse to guarantee RTL flow for grid items */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border p-4 rounded-lg bg-gray-50 flex flex-row-reverse">
                                {/* 1. State - الولاية (Appears Right in RTL flow) */}
                                <FormGroup label="الولاية" className="text-right">
                                    <Select value={selectedState} onChange={handleStateChange} disabled={isStateFilterDisabled || !!editingSubmission}>
                                        {availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                    </Select>
                                </FormGroup>
                                
                                {/* 2. Locality - المحلية (Appears Center) */}
                                <FormGroup label="المحلية" className="text-right">
                                    <Select value={selectedLocality} onChange={(e) => { setSelectedLocality(e.target.value); setSelectedFacilityId(''); setSelectedHealthWorkerName(''); setSelectedWorkerOriginalData(null); setWorkerJobTitle(''); setWorkerTrainingDate(''); setWorkerPhone(''); setIsWorkerInfoChanged(false); setIsReadyToStart(false); }} disabled={isLocalityFilterDisabled || !!editingSubmission}>
                                         {(!publicSubmissionMode && permissions.manageScope === 'locality') ? (
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
                                
                                {/* 3. Facility - المؤسسة الصحية (Appears Left in RTL flow) */}
                                {/* --- MODIFICATION: Replaced Select with SearchableSelect and added loading spinner --- */}
                                {isFacilitiesLoading ? (
                                    <div className="flex justify-center items-center p-4">
                                        <Spinner />
                                        <span className="mr-2 text-gray-500">جاري تحميل المؤسسات...</span>
                                    </div>
                                ) : (
                                    <FormGroup label="المؤسسة الصحية" className="text-right">
                                        <SearchableSelect
                                            value={selectedFacilityId}
                                            onChange={(e) => { // e.target.value comes from handleSelect
                                                const newFacilityId = e.target.value;
                                                if (newFacilityId === 'addNew') {
                                                    setIsAddFacilityModalOpen(true);
                                                } else {
                                                    setSelectedFacilityId(newFacilityId);
                                                    setSelectedHealthWorkerName('');
                                                    setSelectedWorkerOriginalData(null); setWorkerJobTitle(''); setWorkerTrainingDate(''); setWorkerPhone(''); setIsWorkerInfoChanged(false);
                                                    setIsReadyToStart(false);
                                                }
                                            }}
                                            options={facilityOptions}
                                            placeholder="-- اختر أو ابحث عن المؤسسة --"
                                            disabled={!selectedLocality || !!editingSubmission}
                                        />
                                        {selectedState && selectedLocality && filteredFacilities.length === 0 && !isFacilitiesLoading && ( <p className="text-xs text-red-600 mt-1">لا توجد مؤسسات مسجلة. أضف واحدة جديدة.</p> )}
                                    </FormGroup>
                                )}
                            </div>

                                {/* --- Health Worker Selection & Edit Section (Conditional on form type) --- */}
                                {isSkillsAssessmentSetup && selectedFacilityId && (
                                    <div className="border p-4 rounded-lg bg-gray-50 space-y-4">
                                        {/* 4. Worker Dropdown - العامل الصحي */}
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
                                                    setIsReadyToStart(false); // <-- ADDED: Reset ready state on change
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

                                        {/* Editable Fields - Only show if a worker is selected */}
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

                                                {/* Update Button - appears only if changed */}
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
                        
                        {/* START/CONTINUE BUTTON (MODIFIED) */}
                        {/* --- MODIFICATION: Changed to flex-col and added Row 2 --- */}
                        <div className="hidden sm:flex flex-col gap-2 items-end mt-6 pt-4 border-t">
                            {/* --- Row 1: Action Buttons --- */}
                            <div className="flex gap-2 flex-wrap justify-end">
                                <Button 
                                    onClick={handleBackToHistoryView}
                                    variant="secondary"
                                    disabled={isFacilitiesLoading}
                                >
                                    إلغاء والعودة
                                </Button>
                                {/* --- MODIFIED: Button Text --- */}
                                <Button
                                    onClick={handleProceedToForm} // <-- MODIFIED: Calls new handler
                                    disabled={!selectedFacilityId || (isSkillsAssessmentSetup && !selectedHealthWorkerName) || isFacilitiesLoading || isWorkerInfoChanged}
                                    variant="primary"
                                >
                                    {isSkillsAssessmentSetup ? 'بدء جلسة الاشراف' : (isVisitReportSetup ? (activeService === 'EENC' ? 'بدء تقرير زيارة EENC' : 'بدء تقرير الزيارة') : 'بدء استبيان الأم')}
                                </Button>
                                {/* --- END MODIFICATION --- */}
                            </div>
                            {/* --- Row 2: Navigation Buttons (NEW) --- */}
                            <div className="flex gap-2 flex-wrap justify-end">
                                {/* Note: Facility Data button is omitted as it's part of the SkillsAssessmentForm itself */}
                                <Button 
                                    type="button" 
                                    variant="info"
                                    onClick={() => setIsMothersFormModalOpen(true)} 
                                    disabled={isFacilitiesLoading || !selectedFacility}
                                    title={selectedFacility ? "Open Mother's Survey" : "Select a facility first"}
                                >
                                    استبيان الأم
                                </Button>
                                {/* --- MODIFIED: Button Text and Title --- */}
                                <Button 
                                    type="button" 
                                    variant="info"
                                    onClick={() => setIsVisitReportModalOpen(true)} 
                                    disabled={isFacilitiesLoading || !selectedFacility}
                                    title={selectedFacility ? (activeService === 'EENC' ? "Open EENC Visit Report" : "Open IMNCI Visit Report") : "Select a facility first"}
                                >
                                    {activeService === 'EENC' ? 'تقرير زيارة EENC' : 'تقرير الزيارة'}
                                </Button>
                                {/* --- END MODIFICATION --- */}
                                <Button 
                                    type="button" 
                                    variant="info"
                                    onClick={() => {
                                        // Pre-filter dashboard
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
                        {/* END START/CONTINUE BUTTON */}

                        {/* --- NEW: Mobile Bar (Generic) --- */}
                        <div className="flex sm:hidden fixed bottom-16 left-0 right-0 z-20 h-16 justify-around items-center bg-gray-900 text-white border-t border-gray-700 shadow-lg" dir="rtl">
                            <Button type="button" variant="secondary" onClick={handleBackToHistoryView} disabled={isFacilitiesLoading} size="sm">
                                إلغاء
                            </Button>
                            
                            {/* This view has no "draft" state */}
                            
                            {/* --- MODIFIED: Button Text --- */}
                            <Button 
                                type="button" 
                                onClick={handleProceedToForm}
                                disabled={!selectedFacilityId || (isSkillsAssessmentSetup && !selectedHealthWorkerName) || isFacilitiesLoading || isWorkerInfoChanged}
                                title={!selectedFacilityId ? "Select facility" : (isSkillsAssessmentSetup && !selectedHealthWorkerName ? "Select health worker" : "Start Session")}
                                size="sm"
                            >
                                {isSkillsAssessmentSetup ? 'بدء الجلسة' : (isVisitReportSetup ? (activeService === 'EENC' ? 'بدء تقرير EENC' : 'بدء التقرير') : 'بدء الاستبيان')} 
                            </Button>
                            {/* --- END MODIFICATION --- */}
                        </div>
                        {/* --- END NEW: Mobile Bar --- */}
                    </div>
                </Card>

                {/* --- NEW: Add Facility Modal Render --- */}
       {isAddFacilityModalOpen && (
                    <AddFacilityModal
                        isOpen={isAddFacilityModalOpen}
                        onClose={() => setIsAddFacilityModalOpen(false)}
                        onSaveComplete={() => {
                            // --- START: REVERTED LOGIC ---
                            
                            // 1. Refresh the main list from the server.
                            // This will NOT include the pending facility.
                            fetchHealthFacilities(true); 

                            // 2. Just close the modal.
                            setIsAddFacilityModalOpen(false);
                            
                            // --- END: REVERTED LOGIC ---
                        }}
                        setToast={setToast}
                        initialState={selectedState}
                        initialLocality={selectedLocality}
                    />
                )}




                 {/* --- Modals (omitted for brevity) --- */}
                 {isAddWorkerModalOpen && (
                    <AddHealthWorkerModal
                        isOpen={isAddWorkerModalOpen}
                        onClose={() => setIsAddWorkerModalOpen(false)}
                        onSave={handleSaveNewHealthWorker}
                        facilityName={selectedFacility?.['اسم_المؤسسة'] || 'المؤسسة المحددة'}
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
                {/* --- NEW: Post-Save Modal --- */}
                <PostSaveModal
                    isOpen={isPostSaveModalOpen}
                    onClose={handlePostSaveClose}
                    onSelect={handlePostSaveSelect}
                />

                {/* --- NEW: Modals for Nav Bar (Copied from SkillsAssessmentForm render) --- */}
                {/* We need these here so the new desktop/mobile nav bars can open them */}
                
                {/* --- START: NEW MOTHER'S FORM MODAL --- */}
                {isMothersFormModalOpen && selectedFacility && (
                    <Modal 
                        isOpen={isMothersFormModalOpen} 
                        onClose={() => setIsMothersFormModalOpen(false)} 
                        title="استبيان الأم: رضاء ومعرفة الأمهات"
                        size="full"
                    >
                        <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                            <MothersForm
                                facility={selectedFacility} // Use selectedFacility from setup
                                onCancel={() => { 
                                    setIsMothersFormModalOpen(false);
                                    fetchSkillMentorshipSubmissions(true); 
                                }}
                                setToast={setToast}
                            />
                        </div>
                    </Modal>
                )}
                {/* --- END: NEW MOTHER'S FORM MODAL --- */}

                {/* --- START: NEW VISIT REPORT MODAL (MODIFIED) --- */}
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
                                        facility={selectedFacility} // Use selectedFacility from setup
                                        onCancel={() => {
                                            setIsVisitReportModalOpen(false);
                                            fetchSkillMentorshipSubmissions(true);
                                            fetchIMNCIVisitReports(true);
                                        }}
                                        setToast={setToast}
                                        allSubmissions={processedSubmissions}
                                        existingReportData={null} // Modal always creates new
                                    />
                                ) : (
                                    <EENCVisitReport
                                        facility={selectedFacility}
                                        onCancel={() => {
                                            setIsVisitReportModalOpen(false);
                                            fetchSkillMentorshipSubmissions(true);
                                            if (fetchEENCVisitReports) fetchEENCVisitReports(true);
                                        }}
                                        setToast={setToast}
                                        allSubmissions={processedSubmissions}
                                        existingReportData={null}
                                    />
                                )}
                            </Suspense>
                        </div>
                    </Modal>
                )}
                {/* --- END: NEW VISIT REPORT MODAL --- */}
                
                {/* --- START: NEW DASHBOARD MODAL --- */}
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
                                STATE_LOCALITIES={STATE_LOCALITIES}
                                activeService={activeService}
                                
                                // Pass dashboard filter state
                                // Pre-filter based on setup screen selection
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
                {/* --- END: NEW DASHBOARD MODAL --- */}

                {/* --- NEW: Mobile Nav Bar for Setup View --- */}
                <MobileFormNavBar
                    activeFormType={activeFormType}
                    draftCount={currentUserDrafts.length}
                    onNavClick={handleMobileNavClick}
                 />
            </>
        );
    }

    return null; // Should not happen
};

export default SkillsMentorshipView;