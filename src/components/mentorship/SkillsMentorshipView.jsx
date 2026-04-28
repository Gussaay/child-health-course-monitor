// SkillsMentorshipView.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useDataCache } from "../../DataContext";
import { Timestamp } from 'firebase/firestore';
import { PlusCircle, Trash2, FileText, Users, Building, ClipboardCheck, Archive, LayoutDashboard, Search, Share2, List, ArrowLeft, Target, AlertTriangle } from 'lucide-react';
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
    saveEENCVisitReport,
    deleteEENCVisitReport,
    listMentorshipSessions, 
    listIMNCIVisitReports,
    listEENCVisitReports    
} from '../../data';

import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox, Modal
} from '../CommonComponents';

import { STATE_LOCALITIES } from "../constants.js";
import SkillsAssessmentForm from './SkillsAssessmentForm';
import MentorshipDashboard from './MentorshipDashboard';
import { LanguageProvider, useTranslation } from './LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
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
    IMNCIFormFields,
    SaveStatusModal 
} from '../FacilityForms.jsx';

// --- Bilingual Normalization Helpers ---
const normalizeState = (stateVal) => {
    if (!stateVal || stateVal === 'N/A') return 'N/A';
    for (const [enKey, data] of Object.entries(STATE_LOCALITIES)) {
        if (enKey === stateVal || data.ar === stateVal) return enKey;
    }
    return stateVal;
};

const normalizeLocality = (stateEnKey, localityVal) => {
    if (!localityVal || localityVal === 'N/A') return 'N/A';
    
    const cleanVal = localityVal.trim();
    
    if (stateEnKey && stateEnKey !== 'N/A' && STATE_LOCALITIES[stateEnKey]) {
        const locObj = STATE_LOCALITIES[stateEnKey].localities.find(l => l.en === cleanVal || l.ar === cleanVal || l.ar.trim() === cleanVal);
        if (locObj) return locObj.en;
    }
    for (const data of Object.values(STATE_LOCALITIES)) {
        const locObj = data.localities.find(l => l.en === cleanVal || l.ar === cleanVal || l.ar.trim() === cleanVal);
        if (locObj) return locObj.en;
    }
    return cleanVal;
};

const isDateInRange = (dateString, filterType) => {
    if (!filterType) return true;
    if (!dateString || dateString === 'N/A') return false;
    
    const dParts = dateString.split('-');
    if (dParts.length !== 3) return false;
    const dateToCompare = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterType) {
        case 'today':
            return dateToCompare.getTime() === today.getTime();
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return dateToCompare.getTime() === yesterday.getTime();
        case 'this_week':
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            return dateToCompare >= startOfWeek;
        case 'last_week':
            const startOfLastWeek = new Date(today);
            startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
            const endOfLastWeek = new Date(startOfLastWeek);
            endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
            return dateToCompare >= startOfLastWeek && dateToCompare <= endOfLastWeek;
        case 'this_month':
            return dateToCompare.getMonth() === today.getMonth() && dateToCompare.getFullYear() === today.getFullYear();
        case 'last_month':
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            return dateToCompare.getMonth() === lastMonth.getMonth() && dateToCompare.getFullYear() === lastMonth.getFullYear();
        case 'this_year':
            return dateToCompare.getFullYear() === today.getFullYear();
        case 'last_year':
            return dateToCompare.getFullYear() === today.getFullYear() - 1;
        default:
            return true;
    }
};

const normalizeJobTitle = (title) => {
    if (!title || typeof title !== 'string') return title;
    const t = title.trim();
    if (t === 'طبيب' || t === 'طبيب عمومي') return 'Medical Officer';
    if (t === 'مساعد طبي') return 'Medical Assistance';
    if (t === 'ممرض') return 'Treating Nurse';
    if (t === 'قابلة') return 'Midwife';
    return t;
};

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

// --- Helper: Calculate Proposed Visit Number Updates for Visit Reports ---
const calculateVisitNumberUpdates = (allVisitReports, serviceType) => {
    if (!allVisitReports || allVisitReports.length === 0) return [];

    const reportsByFacility = allVisitReports.reduce((acc, report) => {
        const facId = report.facilityId || report.fullData?.facilityId;
        if (!facId) return acc;
        if (!acc[facId]) acc[facId] = [];
        acc[facId].push(report);
        return acc;
    }, {});

    const updatesToMake = [];

    for (const [facilityId, facilityReports] of Object.entries(reportsByFacility)) {
        const uniqueDates = [...new Set(
            facilityReports.map(r => r.visitDate || r.fullData?.visitDate)
        )].filter(d => d && d !== 'N/A').sort();

        for (const report of facilityReports) {
            const reportDate = report.visitDate || report.fullData?.visitDate;
            if (!reportDate || reportDate === 'N/A') continue;

            const correctVisitNumber = uniqueDates.indexOf(reportDate) + 1;
            const currentVisitNumber = parseInt(report.visitNumber || report.fullData?.visitNumber);

            if (currentVisitNumber !== correctVisitNumber && !isNaN(correctVisitNumber)) {
                updatesToMake.push({
                    id: report.id,
                    facilityName: report.facilityName || report.fullData?.facilityName || 'Unknown Facility',
                    visitDate: reportDate,
                    oldNumber: currentVisitNumber || '-',
                    newNumber: correctVisitNumber,
                    service: serviceType,
                    payload: {
                        ...report.fullData, 
                        visitNumber: correctVisitNumber
                    }
                });
            }
        }
    }
    
    return updatesToMake.sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate));
};

// --- Helper: Calculate Proposed Visit Number Updates for Submissions (Skills & Mothers) ---
const calculateSubmissionVisitNumberUpdates = (submissions, activeTab) => {
    if (!submissions || submissions.length === 0) return [];

    const updatesToMake = [];

    const grouped = submissions.reduce((acc, sub) => {
        const facId = sub.facilityId;
        if (!facId) return acc;

        let groupKey = facId;
        if (activeTab === 'skills_list') {
            const worker = sub.staff || 'N/A';
            groupKey = `${facId}_${worker}`;
        }

        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(sub);
        return acc;
    }, {});

    for (const [groupKey, groupSubs] of Object.entries(grouped)) {
        const uniqueDates = [...new Set(
            groupSubs.map(s => s.sessionDate || s.date)
        )].filter(d => d && d !== 'N/A').sort();

        for (const sub of groupSubs) {
            const subDate = sub.sessionDate || sub.date;
            if (!subDate || subDate === 'N/A') continue;

            const correctVisitNumber = uniqueDates.indexOf(subDate) + 1;
            const currentVisitNumber = parseInt(sub.visitNumber);

            if (currentVisitNumber !== correctVisitNumber && !isNaN(correctVisitNumber)) {
                updatesToMake.push({
                    id: sub.id,
                    facilityName: sub.facility || 'Unknown Facility',
                    workerName: activeTab === 'skills_list' ? sub.staff : 'N/A',
                    visitDate: subDate,
                    oldNumber: currentVisitNumber || '-',
                    newNumber: correctVisitNumber,
                    service: sub.service,
                    payload: {
                        ...sub.fullData,
                        visitNumber: correctVisitNumber
                    }
                });
            }
        }
    }
    return updatesToMake.sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate));
};

// --- Component: Preview Sync Modal ---
const PreviewSyncModal = ({ isOpen, onClose, onConfirm, proposedUpdates, isSyncing, activeTab }) => {
    if (!isOpen) return null;
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="مراجعة أرقام الزيارات (Review Visit Numbers)" size="3xl">
            <div className="p-6 text-right" dir="rtl">
                <div className="mb-4 bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="text-yellow-600 mt-1 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-yellow-800">تحذير!</h4>
                        <p className="text-sm text-yellow-700">
                            تم العثور على <strong>{proposedUpdates.length}</strong> تقرير/جلسة يحتاج إلى تصحيح. النظام سيقوم بإعادة ترتيب أرقام الزيارات لتكون متسلسلة حسب تاريخ الزيارة للمرافق (والكوادر) المحددة. يرجى المراجعة والتأكيد.
                        </p>
                    </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto border rounded-lg mb-6 bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                        <thead className="bg-sky-100 text-sky-900 sticky top-0 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 border-b text-right font-bold">المنشأة</th>
                                {activeTab === 'skills_list' && <th className="px-4 py-3 border-b text-right font-bold">العامل الصحي</th>}
                                <th className="px-4 py-3 border-b text-center font-bold">الخدمة</th>
                                <th className="px-4 py-3 border-b text-center font-bold">تاريخ الزيارة</th>
                                <th className="px-4 py-3 border-b text-center font-bold">الرقم الحالي</th>
                                <th className="px-4 py-3 border-b text-center font-bold text-green-700">الرقم المقترح</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {proposedUpdates.map((update, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-gray-800">{update.facilityName}</td>
                                    {activeTab === 'skills_list' && <td className="px-4 py-3 font-semibold text-sky-800">{update.workerName}</td>}
                                    <td className="px-4 py-3 text-center text-gray-600">{update.service}</td>
                                    <td className="px-4 py-3 text-center" dir="ltr">{update.visitDate}</td>
                                    <td className="px-4 py-3 text-center text-red-500 font-bold line-through">{update.oldNumber}</td>
                                    <td className="px-4 py-3 text-center font-extrabold text-green-600 text-lg bg-green-50/50">{update.newNumber}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={isSyncing}>إلغاء</Button>
                    <Button variant="primary" onClick={onConfirm} disabled={isSyncing} className="px-6">
                        {isSyncing ? (
                            <><Spinner size="sm" className="ml-2"/> جاري التحديث...</>
                        ) : (
                            'تأكيد وتحديث الكل'
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Action Menu Component ---
const ActionMenu = ({ onAction, activeService, draftCount, reportCount, onBack, permissions, canManage }) => {
    
    const canViewSubmissions = 
        permissions?.canViewSkillsMentorship ||
        permissions?.canUseFederalManagerAdvancedFeatures ||
        permissions?.canUseSuperUserAdvancedFeatures ||
        ['super_user', 'federal_manager', 'states_manager', 'locality_manager'].includes(permissions?.role);

    const addItems = [
        { id: 'new_skill', label: 'Add New Skill Form', icon: PlusCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'hover:border-emerald-400', shadow: 'hover:shadow-emerald-100' },
        { id: 'new_mother', label: 'Add New Mother Form', icon: Users, color: 'text-pink-600', bg: 'bg-pink-100', border: 'hover:border-pink-400', shadow: 'hover:shadow-pink-100' },
        { id: 'new_visit_report', label: 'Add New Visit Report', icon: ClipboardCheck, color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'hover:border-indigo-400', shadow: 'hover:shadow-indigo-100' },
        { id: 'update_facility', label: 'Update Facility Info', icon: Building, color: 'text-cyan-600', bg: 'bg-cyan-100', border: 'hover:border-cyan-400', shadow: 'hover:shadow-cyan-100' },
    ];

    const viewItems = [
        { id: 'view_dashboard', label: 'Show Dashboard', icon: LayoutDashboard, color: 'text-purple-600', bg: 'bg-purple-100', border: 'hover:border-purple-400', shadow: 'hover:shadow-purple-100' },
        { id: 'view_drafts', label: `My Drafts & Reports (${draftCount + (reportCount || 0)})`, icon: Archive, color: 'text-amber-600', bg: 'bg-amber-100', border: 'hover:border-amber-400', shadow: 'hover:shadow-amber-100' },
        { id: 'training_priorities', label: 'Training Priorities', icon: Target, color: 'text-teal-600', bg: 'bg-teal-100', border: 'hover:border-teal-400', shadow: 'hover:shadow-teal-100' },
    ];

    if (canViewSubmissions) {
        viewItems.unshift({ 
            id: 'view_submissions', 
            label: 'Show Submitted Forms', 
            icon: List, 
            color: 'text-blue-600', 
            bg: 'bg-blue-100', 
            border: 'hover:border-blue-400', 
            shadow: 'hover:shadow-blue-100' 
        });
    }

    const renderGrid = (items) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map(item => {
                const Icon = item.icon;
                return (
                    <button
                        key={item.id}
                        onClick={() => onAction(item.id)}
                        className={`flex flex-col items-center justify-center p-8 border border-gray-100 rounded-2xl bg-white shadow-sm hover:shadow-lg transition-all duration-300 group ${item.border} ${item.shadow} transform hover:-translate-y-1`}
                    >
                        <div className={`p-5 rounded-2xl mb-5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${item.bg}`}>
                            <Icon className={`w-8 h-8 ${item.color}`} strokeWidth={1.5} />
                        </div>
                        <div className="font-semibold text-gray-700 text-lg group-hover:text-gray-900 transition-colors text-center">
                            {item.label}
                        </div>
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto mt-8 p-4 space-y-12" dir="ltr">
            {canManage && (
                <section>
                    <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">Add New Data</h3>
                    {renderGrid(addItems)}
                </section>
            )}
            <section>
                <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">View Records & Dashboards</h3>
                {renderGrid(viewItems)}
            </section>
        </div>
    );
};

// --- Training Priorities View Component ---
const TrainingPrioritiesView = ({ activeService, submissions, currentUserEmail, onBack }) => {
    
    const [facilityFilter, setFacilityFilter] = useState('');
    const [workerFilter, setWorkerFilter] = useState('');
    const [visitCountFilter, setVisitCountFilter] = useState('');

    const computeWeaknesses = useCallback((sessions, service) => {
        if (!sessions || sessions.length === 0) return [];
        let stats = {};

        if (service === 'IMNCI') {
            stats = {
                skill_weight: { score: 0, max: 0, label: "وزن الطفل بصورة صحيحة" },
                skill_temp: { score: 0, max: 0, label: "قياس درجة الطفل بصورة صحيحة" },
                skill_height: { score: 0, max: 0, label: "قياس طول/ارتفاع الطفل بصورة صحيحة" },
                skill_check_rr: { score: 0, max: 0, label: "قياس معدل التنفس بصورة صحيحة" },
                skill_check_dehydration: { score: 0, max: 0, label: "تقييم فقدان السوائل بصورة صحيحة" },
                skill_mal_muac: { score: 0, max: 0, label: "قياس المواك (MUAC) بصورة صحيحة" },
                skill_mal_wfh: { score: 0, max: 0, label: "قياس نسبة الوزن للطول أو الارتفاع (Z-Score)" },
                skill_edema: { score: 0, max: 0, label: "تقييم الورم (Edema)" },
                skill_ds_drink: { score: 0, max: 0, label: "علامة خطورة: لا يستطيع ان يرضع أو يشرب" },
                skill_ds_vomit: { score: 0, max: 0, label: "علامة خطورة: يتقيأ كل شئ" },
                skill_ds_convulsion: { score: 0, max: 0, label: "علامة خطورة: تشنجات أثناء المرض الحالي" },
                skill_ds_conscious: { score: 0, max: 0, label: "علامة خطورة: خامل أو فاقد للوعي" },
            };

            sessions.forEach(sub => {
                const s = sub.scores || {};
                const as = sub.assessmentSkills || sub.fullData?.assessment_skills || sub.fullData?.assessmentSkills || {};

                const addScore = (key, scoreProp, maxProp) => {
                    if (s[maxProp] > 0) {
                        stats[key].score += (s[scoreProp] || 0);
                        stats[key].max += s[maxProp];
                    }
                };

                addScore('skill_weight', 'handsOnWeight_score', 'handsOnWeight_maxScore');
                addScore('skill_temp', 'handsOnTemp_score', 'handsOnTemp_maxScore');
                addScore('skill_height', 'handsOnHeight_score', 'handsOnHeight_maxScore');
                addScore('skill_check_rr', 'handsOnRR_score', 'handsOnRR_maxScore');
                if (s.respiratoryRateCalculation_maxScore > 0) {
                     stats.skill_check_rr.score += (s.respiratoryRateCalculation_score || 0);
                     stats.skill_check_rr.max += s.respiratoryRateCalculation_maxScore;
                }
                addScore('skill_check_dehydration', 'dehydrationAssessment_score', 'dehydrationAssessment_maxScore');
                addScore('skill_mal_muac', 'handsOnMUAC_score', 'handsOnMUAC_maxScore');
                addScore('skill_mal_wfh', 'handsOnWFH_score', 'handsOnWFH_maxScore');

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
        } else if (service === 'EENC') {
            Object.keys(EENC_SKILLS_LABELS).forEach(k => {
                stats[k] = { score: 0, max: 0, label: EENC_SKILLS_LABELS[k] };
            });
            sessions.forEach(sub => {
                const skills = sub.fullData?.skills || {};
                Object.keys(EENC_SKILLS_LABELS).forEach(k => {
                    if (skills[k] === 'yes') { stats[k].score++; stats[k].max++; }
                    else if (skills[k] === 'partial') { stats[k].score += 0.5; stats[k].max++; } 
                    else if (skills[k] === 'no') { stats[k].max++; }
                });
            });
        }

        const weakSkills = [];
        Object.keys(stats).forEach(key => {
            if (stats[key] && stats[key].max > 0) {
                const pct = stats[key].score / stats[key].max;
                if (pct < 0.75) {
                    weakSkills.push({
                        label: stats[key].label,
                        pct: Math.round(pct * 100)
                    });
                }
            }
        });
        return weakSkills;
    }, []);

    const mySessions = useMemo(() => {
        if (!submissions || !currentUserEmail) return [];
        return submissions.filter(s =>
            s.supervisorEmail === currentUserEmail &&
            s.service === activeService &&
            s.status === 'complete'
        );
    }, [submissions, currentUserEmail, activeService]);

    const workerData = useMemo(() => {
        const map = new Map();
        let globalMaxVisits = 0;

        mySessions.forEach(sub => {
            if (!sub.staff || sub.staff === 'N/A') return;
            const key = `${sub.facilityId}_${sub.staff}`;
            
            if (!map.has(key)) {
                map.set(key, {
                    facilityName: sub.facility,
                    staff: sub.staff,
                    sessions: [],
                    visitsMap: {}
                });
            }
            
            const worker = map.get(key);
            worker.sessions.push(sub);
            
            const vNum = parseInt(sub.visitNumber) || 1;
            worker.visitsMap[vNum] = sub;
            if (vNum > globalMaxVisits) globalMaxVisits = vNum;
        });

        const computedWorkers = Array.from(map.values()).map(worker => {
            const rowData = {
                facilityName: worker.facilityName,
                staff: worker.staff,
                totalVisits: worker.sessions.length,
                visitWeaknesses: {},
                collectiveWeaknesses: computeWeaknesses(worker.sessions, activeService)
            };

            Object.keys(worker.visitsMap).forEach(vNum => {
                rowData.visitWeaknesses[vNum] = computeWeaknesses([worker.visitsMap[vNum]], activeService);
            });

            return rowData;
        });

        return { workers: computedWorkers.sort((a,b) => a.facilityName.localeCompare(b.facilityName) || a.staff.localeCompare(b.staff)), maxVisits: globalMaxVisits };
    }, [mySessions, activeService, computeWeaknesses]);

    const filterOptions = useMemo(() => {
        const facs = new Set();
        const workers = new Set();
        const visits = new Set();

        workerData.workers.forEach(w => {
            facs.add(w.facilityName);
            workers.add(w.staff);
            visits.add(w.totalVisits);
        });

        return {
            facilities: Array.from(facs).sort(),
            workers: Array.from(workers).sort(),
            visits: Array.from(visits).sort((a,b) => a - b)
        };
    }, [workerData.workers]);

    const filteredWorkers = useMemo(() => {
        return workerData.workers.filter(w => {
            if (facilityFilter && w.facilityName !== facilityFilter) return false;
            if (workerFilter && w.staff !== workerFilter) return false;
            if (visitCountFilter && w.totalVisits !== parseInt(visitCountFilter)) return false;
            return true;
        });
    }, [workerData.workers, facilityFilter, workerFilter, visitCountFilter]);

    const renderWeaknessPills = (weaknesses) => {
        if (!weaknesses || weaknesses.length === 0) {
            return <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded">ممتاز (بدون ضعف)</span>;
        }
        return (
            <div className="flex flex-col gap-1">
                {weaknesses.map((w, idx) => (
                    <div key={idx} className="text-[10px] sm:text-xs font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded leading-tight">
                        {w.label} <span dir="ltr">({w.pct}%)</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Card dir="rtl" className="w-full">
            <div className="p-6">
                <div className="flex items-center gap-4 mb-6 border-b pb-4">
                    <Button variant="secondary" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 ml-2" /> العودة للقائمة
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-sky-800">جدول أولويات التدريب للكوادر</h2>
                        <p className="text-gray-500 text-sm mt-1">يعرض هذا الجدول المهارات التي تحتاج للتدريب (بدرجة أقل من 75%) مجمعة لكل زيارة ولكل الكوادر التي قمت بالإشراف عليها.</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 border p-4 rounded-lg bg-gray-50">
                    <FormGroup label="المؤسسة الصحية" className="text-right">
                        <Select value={facilityFilter} onChange={e => setFacilityFilter(e.target.value)}>
                            <option value="">الكل</option>
                            {filterOptions.facilities.map(f => <option key={f} value={f}>{f}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="اسم العامل الصحي" className="text-right">
                        <Select value={workerFilter} onChange={e => setWorkerFilter(e.target.value)}>
                            <option value="">الكل</option>
                            {filterOptions.workers.map(w => <option key={w} value={w}>{w}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="عدد الزيارات الإجمالي" className="text-right">
                        <Select value={visitCountFilter} onChange={e => setVisitCountFilter(e.target.value)}>
                            <option value="">الكل</option>
                            {filterOptions.visits.map(v => <option key={v} value={v}>{v} زيارات</option>)}
                        </Select>
                    </FormGroup>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-sky-50">
                            <tr>
                                <th className="px-4 py-3 text-right text-xs font-extrabold text-sky-900 uppercase tracking-wider border-l border-gray-200 min-w-[150px]">المنشأة</th>
                                <th className="px-4 py-3 text-right text-xs font-extrabold text-sky-900 uppercase tracking-wider border-l border-gray-200 min-w-[150px]">العامل الصحي</th>
                                <th className="px-4 py-3 text-center text-xs font-extrabold text-sky-900 uppercase tracking-wider border-l border-gray-200">الزيارات</th>
                                
                                {Array.from({ length: workerData.maxVisits }).map((_, i) => (
                                    <th key={i} className="px-4 py-3 text-center text-xs font-extrabold text-gray-600 uppercase tracking-wider border-l border-gray-200 min-w-[200px]">
                                        الزيارة رقم {i + 1}
                                    </th>
                                ))}
                                
                                <th className="px-4 py-3 text-center text-xs font-extrabold text-amber-900 bg-amber-100 uppercase tracking-wider min-w-[250px]">
                                    الضعف التراكمي المجمع
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredWorkers.length === 0 ? (
                                <tr>
                                    <td colSpan={workerData.maxVisits + 4} className="p-8 text-center text-gray-500 font-medium">
                                        لا توجد بيانات متاحة تطابق خيارات التصفية الحالية، أو لم تقم بتسجيل أي زيارات مكتملة بعد.
                                    </td>
                                </tr>
                            ) : (
                                filteredWorkers.map((worker, idx) => (
                                    <tr key={`${worker.facilityName}_${worker.staff}_${idx}`} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-4 text-sm font-semibold text-gray-800 border-l border-gray-200 align-top">
                                            {worker.facilityName}
                                        </td>
                                        <td className="px-4 py-4 text-sm font-bold text-sky-700 border-l border-gray-200 align-top">
                                            {worker.staff}
                                        </td>
                                        <td className="px-4 py-4 text-sm font-bold text-center border-l border-gray-200 align-top">
                                            {worker.totalVisits}
                                        </td>
                                        
                                        {Array.from({ length: workerData.maxVisits }).map((_, i) => {
                                            const visitNum = i + 1;
                                            const hasVisit = worker.visitWeaknesses[visitNum] !== undefined;
                                            
                                            return (
                                                <td key={visitNum} className="px-4 py-4 align-top border-l border-gray-200">
                                                    {hasVisit ? (
                                                        renderWeaknessPills(worker.visitWeaknesses[visitNum])
                                                    ) : (
                                                        <div className="text-center text-gray-400 font-medium">-</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        
                                        <td className="px-4 py-4 align-top bg-amber-50/50">
                                            {renderWeaknessPills(worker.collectiveWeaknesses)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Card>
    );
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
                    <Button variant="secondary" onClick={handleClose}>إغلاق</Button>
                    <Button onClick={handleSave}>حفظ وإضافة</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Facility Selection Modal ---
const FacilitySelectionModal = ({ isOpen, onClose, facilities, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
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

// --- Training Priorities Modal (Post Save) ---
const TrainingPrioritiesModal = ({ isOpen, onClose, onSelect, currentSessionData, historicalSessions, healthWorkerName }) => {
    
    const computeWeaknesses = (sessions) => {
        if (!sessions || sessions.length === 0) return [];
        const stats = {
            skill_weight: { score: 0, max: 0, label: "وزن الطفل بصورة صحيحة" },
            skill_temp: { score: 0, max: 0, label: "قياس درجة الطفل بصورة صحيحة" },
            skill_height: { score: 0, max: 0, label: "قياس طول/ارتفاع الطفل بصورة صحيحة" },
            skill_check_rr: { score: 0, max: 0, label: "قياس معدل التنفس بصورة صحيحة" },
            skill_check_dehydration: { score: 0, max: 0, label: "تقييم فقدان السوائل بصورة صحيحة" },
            skill_mal_muac: { score: 0, max: 0, label: "قياس المواك (MUAC) بصورة صحيحة" },
            skill_mal_wfh: { score: 0, max: 0, label: "قياس نسبة الوزن للطول أو الارتفاع (Z-Score)" },
            skill_edema: { score: 0, max: 0, label: "تقييم الورم (Edema)" },
            skill_ds_drink: { score: 0, max: 0, label: "علامة خطورة: لا يستطيع ان يرضع أو يشرب" },
            skill_ds_vomit: { score: 0, max: 0, label: "علامة خطورة: يتقيأ كل شئ" },
            skill_ds_convulsion: { score: 0, max: 0, label: "علامة خطورة: تشنجات أثناء المرض الحالي" },
            skill_ds_conscious: { score: 0, max: 0, label: "علامة خطورة: خامل أو فاقد للوعي" },
        };

        sessions.forEach(sub => {
            const s = sub.scores || {};
            const as = sub.assessmentSkills || sub.fullData?.assessment_skills || sub.fullData?.assessmentSkills || {};

            const addScore = (key, scoreProp, maxProp) => {
                if (s[maxProp] > 0) {
                    stats[key].score += (s[scoreProp] || 0);
                    stats[key].max += s[maxProp];
                }
            };

            addScore('skill_weight', 'handsOnWeight_score', 'handsOnWeight_maxScore');
            addScore('skill_temp', 'handsOnTemp_score', 'handsOnTemp_maxScore');
            addScore('skill_height', 'handsOnHeight_score', 'handsOnHeight_maxScore');
            addScore('skill_check_rr', 'handsOnRR_score', 'handsOnRR_maxScore');
            if (s.respiratoryRateCalculation_maxScore > 0) {
                 stats.skill_check_rr.score += (s.respiratoryRateCalculation_score || 0);
                 stats.skill_check_rr.max += s.respiratoryRateCalculation_maxScore;
            }
            addScore('skill_check_dehydration', 'dehydrationAssessment_score', 'dehydrationAssessment_maxScore');
            addScore('skill_mal_muac', 'handsOnMUAC_score', 'handsOnMUAC_maxScore');
            addScore('skill_mal_wfh', 'handsOnWFH_score', 'handsOnWFH_maxScore');

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

        const weakSkills = [];
        Object.keys(stats).forEach(key => {
            if (stats[key].max > 0) {
                const pct = stats[key].score / stats[key].max;
                if (pct < 0.75) {
                    weakSkills.push({
                        label: stats[key].label,
                        score: stats[key].score,
                        max: stats[key].max,
                        pct: Math.round(pct * 100)
                    });
                }
            }
        });
        return weakSkills;
    };

    const currentWeaknesses = currentSessionData ? computeWeaknesses([currentSessionData]) : [];
    const historyWeaknesses = computeWeaknesses(historicalSessions);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={onSelect ? "الجلسة حفظت بنجاح! - أولويات التدريب" : "أولويات التدريب للعامل الصحي"} size="lg">
            <div className="p-6 text-right" dir="rtl">
                <h3 className="text-xl font-bold text-sky-800 mb-4">العامل الصحي: {healthWorkerName || 'غير محدد'}</h3>
                
                {currentSessionData && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-lg font-bold text-red-800 mb-3 border-b border-red-200 pb-2">مهارات تحتاج إلى تدريب (من الجلسة الحالية)</h4>
                        {currentWeaknesses.length > 0 ? (
                            <ul className="list-disc pr-6 space-y-2">
                                {currentWeaknesses.map((w, i) => (
                                    <li key={i} className="text-sm font-semibold text-gray-800">
                                        {w.label} <span className="text-red-600 mr-2" dir="ltr">({w.pct}%)</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-green-700 font-bold text-sm">أداء ممتاز! لم تُسجل نقاط ضعف (أقل من 75%) في هذه الجلسة.</p>
                        )}
                    </div>
                )}

                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="text-lg font-bold text-yellow-800 mb-3 border-b border-yellow-200 pb-2">أولويات التدريب المتراكمة (من الجلسات السابقة)</h4>
                    {historyWeaknesses.length > 0 ? (
                        <ul className="list-disc pr-6 space-y-2">
                            {historyWeaknesses.map((w, i) => (
                                <li key={i} className="text-sm font-semibold text-gray-800">
                                    {w.label} <span className="text-yellow-600 mr-2" dir="ltr">({w.pct}%)</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-green-700 font-bold text-sm">لا توجد نقاط ضعف متراكمة من الجلسات السابقة (أو لا توجد جلسات سابقة).</p>
                    )}
                </div>

                {onSelect ? (
                    <>
                        <p className="text-lg mb-4 font-bold text-gray-800 border-t pt-4">ماذا تريد أن تفعل الآن؟</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Button variant="primary" onClick={() => onSelect('skills_assessment')} className="justify-center">بدء جلسة إشراف فني جديدة</Button>
                            <Button variant="info" onClick={() => onSelect('mothers_form')} className="justify-center">بدء استبيان أم جديد</Button>
                            <Button variant="info" onClick={() => onSelect('visit_report')} className="justify-center">بدء تقرير زيارة جديد</Button>
                            <Button variant="secondary" onClick={() => onSelect('action_menu')} className="justify-center">العودة للقائمة الرئيسية</Button>
                        </div>
                    </>
                ) : (
                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                        <Button variant="secondary" onClick={onClose}>إغلاق</Button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

// --- Visit Reports Table Component ---
const VisitReportsTable = ({ 
    reports, onEdit, onDelete, onView, selectedIds, onSelectionChange, isReportsLoading, canManage, currentUserEmail
}) => {

    const isAllSelected = reports.length > 0 && reports.every(r => selectedIds.includes(r.id));
    const isSomeSelected = reports.length > 0 && reports.some(r => selectedIds.includes(r.id));

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const newSelection = new Set([...selectedIds, ...reports.map(r => r.id)]);
            onSelectionChange(Array.from(newSelection));
        } else {
            const visibleIds = reports.map(r => r.id);
            onSelectionChange(selectedIds.filter(id => !visibleIds.includes(id)));
        }
    };

    const handleSelectRow = (id) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(selId => selId !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    return (
        <div dir="ltr" className="p-4 overflow-x-auto border rounded-lg bg-white">
            {isReportsLoading ? (
                <div className="flex justify-center p-8"><Spinner /></div>
            ) : (
                <table className="w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-50">
                        <tr>
                            {canManage && (
                                <th className="px-3 py-3 text-center w-10 border border-gray-300">
                                    <input 
                                        type="checkbox" 
                                        checked={isAllSelected} 
                                        ref={el => el && (el.indeterminate = isSomeSelected && !isAllSelected)} 
                                        onChange={handleSelectAll} 
                                        className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer"
                                    />
                                </th>
                            )}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Facility</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">State</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Locality</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Visit Date</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Visit #</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Supervisor</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {reports.length === 0 ? (
                            <tr><td colSpan={canManage ? "8" : "7"} className="border border-gray-300"><EmptyState title="No Records Found" message="No visit reports found for this service." /></td></tr>
                        ) : (
                            reports.map(rep => {
                                const isAuthor = rep.mentorEmail === currentUserEmail;
                                return (
                                <tr key={rep.id} className={selectedIds.includes(rep.id) ? 'bg-sky-50' : ''}>
                                    {canManage && (
                                        <td className="px-3 py-2 text-center border border-gray-300">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.includes(rep.id)} 
                                                onChange={() => handleSelectRow(rep.id)} 
                                                className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer"
                                            />
                                        </td>
                                    )}
                                    <td className="px-4 py-4 whitespace-normal break-words text-sm text-gray-500 text-left border border-gray-300">{rep.facilityName}</td>
                                    <td className="px-4 py-4 whitespace-normal break-words text-sm text-gray-500 text-left border border-gray-300">{STATE_LOCALITIES[rep.state]?.ar || rep.state}</td>
                                    <td className="px-4 py-4 whitespace-normal break-words text-sm text-gray-500 text-left border border-gray-300">{STATE_LOCALITIES[rep.state]?.localities.find(l => l.en === rep.locality)?.ar || rep.locality}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{rep.visitDate}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-bold border border-gray-300">{rep.visitNumber || '-'}</td>
                                    <td className="px-4 py-4 whitespace-normal break-words text-sm text-gray-500 text-left border border-gray-300">{rep.mentorDisplay}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-left border border-gray-300">
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="info" onClick={() => onView(rep.id)}>View</Button>
                                            {(canManage || isAuthor) && <Button size="sm" variant="warning" onClick={() => onEdit(rep.id)}>Edit</Button>}
                                            {canManage && <Button size="sm" variant="danger" onClick={() => onDelete(rep.id)}>Delete</Button>}
                                        </div>
                                    </td>
                                </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            )}
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
const MentorshipTableColumns = ({ allSelected, someSelected, onSelectAll, canManage }) => (
    <>
        {canManage && (
            <th className="px-3 py-3 text-center w-10 border border-gray-300">
                 <input 
                     type="checkbox" 
                     checked={allSelected} 
                     ref={el => el && (el.indeterminate = someSelected && !allSelected)} 
                     onChange={onSelectAll} 
                     className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer"
                 />
            </th>
        )}
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">#</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Facility</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Project / Partner</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Health Worker/Service</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Job Title</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Supervisor</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Date</th>
        <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Visit #</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Status</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Score</th>
        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Action</th>
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
                             {submission.project && submission.project !== 'N/A' && <p><span className="font-medium text-gray-500">المشروع / الشريك:</span> <span className="font-semibold text-gray-900">{submission.project}</span></p>}
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
                        {submission.project && submission.project !== 'N/A' && <p><span className="font-medium text-gray-500">المشروع / الشريك:</span> <span className="font-semibold text-gray-900">{submission.project}</span></p>}
                        {submission.workerType && submission.workerType !== 'N/A' && <p><span className="font-medium text-gray-500">الوصف الوظيفي:</span> <span className="font-semibold text-gray-900">{normalizeJobTitle(submission.workerType)}</span></p>}
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
const DraftsModal = ({ isOpen, onClose, drafts, reports = [], onViewSession, onEditSession, onDeleteSession, onViewReport, onEditReport, canManage, userEmail }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="مسوداتي وتقاريري (My Drafts & Reports)" size="2xl">
            <div className="p-6 text-right" dir="rtl">
                {drafts.length === 0 && reports.length === 0 ? (
                    <EmptyState message="لا توجد مسودات أو تقارير محفوظة لك." />
                ) : (
                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                        
                        {drafts.length > 0 && (
                            <div>
                                <h4 className="text-lg font-bold text-amber-700 mb-3 border-b pb-2">مسودات الإشراف غير المكتملة</h4>
                                <div className="space-y-3">
                                    {drafts.map(draft => (
                                        <div key={draft.id} className="p-3 border rounded-lg bg-yellow-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                            <div className="text-sm flex-grow">
                                                <p><span className="font-medium text-gray-600">العامل الصحي:</span> <span className="font-semibold text-gray-900">{draft.staff}</span></p>
                                                <p><span className="font-medium text-gray-600">المؤسسة:</span> <span className="font-semibold text-gray-900">{draft.facility}</span></p>
                                                <p><span className="font-medium text-gray-600">تاريخ المسودة:</span> <span className="font-semibold text-gray-900">{draft.date}</span></p>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                                <Button size="sm" variant="info" onClick={() => { onViewSession(draft.id); onClose(); }}>عرض</Button>
                                                <Button size="sm" variant="warning" onClick={() => { onEditSession(draft.id); onClose(); }}>تعديل</Button>
                                                <Button size="sm" variant="danger" onClick={() => { onDeleteSession(draft.id); onClose(); }}>حذف</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {reports.length > 0 && (
                            <div>
                                <h4 className="text-lg font-bold text-sky-700 mb-3 border-b pb-2">تقارير الزيارات الخاصة بي</h4>
                                <div className="space-y-3">
                                    {reports.map(rep => (
                                        <div key={rep.id} className="p-3 border rounded-lg bg-sky-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                            <div className="text-sm flex-grow">
                                                <p><span className="font-medium text-gray-600">المؤسسة:</span> <span className="font-semibold text-gray-900">{rep.facilityName}</span></p>
                                                <p><span className="font-medium text-gray-600">رقم الزيارة:</span> <span className="font-semibold text-gray-900">{rep.visitNumber || '-'}</span></p>
                                                <p><span className="font-medium text-gray-600">التاريخ:</span> <span className="font-semibold text-gray-900">{rep.visitDate}</span></p>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                                <Button size="sm" variant="info" onClick={() => { onViewReport(rep.id); onClose(); }}>عرض</Button>
                                                <Button size="sm" variant="warning" onClick={() => { onEditReport(rep.id); onClose(); }}>تعديل</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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
    isSubmissionsLoading,
    filterServiceType,
    selectedIds, onSelectionChange, canManage, currentUserEmail
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

    const allFilteredIds = submissions.map(s => s.id);
    const isAllSelected = submissions.length > 0 && allFilteredIds.every(id => selectedIds.includes(id));
    const isSomeSelected = submissions.length > 0 && allFilteredIds.some(id => selectedIds.includes(id));

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const newSelection = new Set([...selectedIds, ...allFilteredIds]);
            onSelectionChange(Array.from(newSelection));
        } else {
            const newSelection = selectedIds.filter(id => !allFilteredIds.includes(id));
            onSelectionChange(newSelection);
        }
    };

    const handleSelectRow = (id) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    return (
        <div dir="ltr" className="p-4"> 
                <div className="mt-6 w-full overflow-x-auto border border-gray-300 rounded-lg shadow-sm">
                     {isSubmissionsLoading ? (
                        <div className="flex justify-center p-8"><Spinner /></div>
                    ) : (
                        <table className="w-full border-collapse" dir="ltr"> 
                            <thead className="bg-gray-50">
                                <tr>
                                    <MentorshipTableColumns 
                                        allSelected={isAllSelected}
                                        someSelected={isSomeSelected}
                                        onSelectAll={handleSelectAll}
                                        canManage={canManage}
                                    />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {submissions.length === 0 ? (
                                    <tr><td colSpan={canManage ? "12" : "11"} className="border border-gray-300"><EmptyState title="No Records Found" message="No mentorship visits matched the current filters." /></td></tr>
                                ) : (
                                    submissions.map((sub, index) => {
                                        const scoreData = sub.scores;
                                        let percentage = null;
                                        if (scoreData && scoreData.overallScore_maxScore > 0) {
                                            percentage = Math.round((scoreData.overallScore_score / scoreData.overallScore_maxScore) * 100);
                                        }

                                        const motherServiceType = `${activeService}_MOTHERS`;
                                        const isMotherSurvey = sub.service === motherServiceType;
                                
                                        const workerDisplay = isMotherSurvey 
                                            ? `Survey: ${sub.motherName || 'N/A'}`
                                            : sub.staff;
                                        const serviceStatus = isMotherSurvey 
                                            ? 'Mother\'s Survey' 
                                            : (sub.status === 'draft' ? 'Draft' : 'Complete');

                                        const isSelected = selectedIds.includes(sub.id);
                                        const rowBgClass = isSelected ? 'bg-sky-50' : (sub.status === 'draft' ? 'bg-yellow-50' : (isMotherSurvey ? 'bg-blue-50' : 'bg-white'));

                                        const isAuthor = sub.supervisorEmail === currentUserEmail || sub.mentorEmail === currentUserEmail;
                                        
                                        // UPDATED: Facilitator cannot edit/delete completed skills/mothers forms. Only drafts.
                                        const canEditRow = canManage || (isAuthor && sub.status === 'draft');
                                        const canDeleteRow = canManage || (isAuthor && sub.status === 'draft');

                                        return (
                                        <tr key={sub.id} className={rowBgClass}>
                                            {canManage && (
                                                <td className="px-3 py-2 text-center border border-gray-300">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected} 
                                                        onChange={() => handleSelectRow(sub.id)} 
                                                        className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer"
                                                    />
                                                </td>
                                            )}

                                            <td className="px-2 py-2 text-sm font-medium text-gray-900 text-left border border-gray-300">{index + 1}</td>
                                            
                                            <td className="px-2 py-2 text-xs text-gray-500 text-left border border-gray-300 break-words whitespace-normal">{sub.facility}</td>
                                            
                                            <td className="px-2 py-2 text-xs text-gray-500 text-left border border-gray-300 break-words whitespace-normal">
                                                {sub.project && sub.project !== 'N/A' ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-50 text-purple-800">
                                                        {sub.project}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            
                                            <td className="px-2 py-2 text-xs text-gray-500 text-left font-semibold border border-gray-300 break-words whitespace-normal">{workerDisplay}</td>
                                            
                                            <td className="px-2 py-2 text-xs text-gray-500 text-left border border-gray-300 break-words whitespace-normal">{sub.workerType || '-'}</td>
                                            
                                            <td className="px-2 py-2 text-xs text-gray-500 text-left border border-gray-300 break-words whitespace-normal">{sub.supervisorDisplay}</td> 
                                            
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 text-left border border-gray-300">{sub.date}</td>
                                            
                                            <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-center font-bold border border-gray-300">
                                                {sub.visitNumber || '-'}
                                            </td>

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

                                            <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-800 text-left border border-gray-300">
                                                {isMotherSurvey ? 'N/A' : (percentage !== null ? `${percentage}%` : 'N/A')}
                                            </td>

                                            <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-left border border-gray-300">
                                                <div className="flex flex-col xl:flex-row gap-1">
                                                    <Button size="sm" variant="info" onClick={() => handleAction('view', sub)} className="text-xs px-2 py-1">View</Button>
                                                    {canEditRow && (sub.service === 'IMNCI' || sub.service === 'IMNCI_MOTHERS' || sub.service === 'EENC_MOTHERS') && 
                                                        <Button size="sm" variant="warning" onClick={() => handleAction('edit', sub)} className="text-xs px-2 py-1">Edit</Button>
                                                    }
                                                    {canDeleteRow && <Button size="sm" variant="danger" onClick={() => handleAction('delete', sub)} className="text-xs px-2 py-1">Del</Button>}
                                                </div>
                                            </td>
                                        </tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                    )}
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
    publicDashboardMode = false, 
    publicDashboardParams = null 
}) => {
    useEffect(() => {
        if (publicDashboardMode) {
            const params = new URLSearchParams(window.location.search);
            const langParam = params.get('lang');
            
            if (langParam) {
                localStorage.setItem('language', langParam);
                localStorage.setItem('app_language', langParam);
            }
        }
    }, [publicDashboardMode]);

    const defaultService = publicDashboardMode ? publicDashboardParams?.serviceType : (publicSubmissionMode ? publicServiceType : null);

    const [currentView, setCurrentView] = useState(() => {
        if (publicDashboardMode && defaultService) return 'history';
        if (defaultService) return 'action_menu';
        return 'service_selection';
    });
    
    const canManageMentorship = publicSubmissionMode || permissions?.canManageSkillsMentorship || permissions?.canUseSuperUserAdvancedFeatures || permissions?.role === 'super_user' || false;
    
    // UPDATED: Strictly check canAddMentorshipVisit instead of falling back to canManageMentorship
    const canAddMentorshipData = publicSubmissionMode || permissions?.canAddMentorshipVisit || permissions?.canUseSuperUserAdvancedFeatures || permissions?.role === 'super_user' || false;

    const [activeService, setActiveService] = useState(defaultService);
    
    const [selectedState, setSelectedState] = useState('');
    const [selectedLocality, setSelectedLocality] = useState('');
    const [selectedFacilityId, setSelectedFacilityId] = useState('');
    const [selectedHealthWorkerName, setSelectedHealthWorkerName] = useState('');

    const [activeTab, setActiveTab] = useState(() => {
        return publicDashboardMode ? 'dashboard' : 'skills_list';
    });
    const [activeFormType, setActiveFormType] = useState('skills_assessment');
    const [isReadyToStart, setIsReadyToStart] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const [selectedSubmissionIds, setSelectedSubmissionIds] = useState([]);
    const [selectedReportIds, setSelectedReportIds] = useState([]);
    const [deletedSubmissionIds, setDeletedSubmissionIds] = useState(new Set());
    const [deletedReportIds, setDeletedReportIds] = useState(new Set());

    const [lastSyncTime, setLastSyncTime] = useState(null);

    const [statusData, setStatusData] = useState(null);
    const [statusAction, setStatusAction] = useState(null);
    
    // --- Sync Preview State ---
    const [proposedSyncUpdates, setProposedSyncUpdates] = useState([]);
    const [isPreviewSyncModalOpen, setIsPreviewSyncModalOpen] = useState(false);
    const [isExecutingSync, setIsExecutingSync] = useState(false);

    const updateLastSyncTime = useCallback(() => {
        let lastTimeMs = 0;
        
        if (publicDashboardMode) {
            lastTimeMs = parseInt(localStorage.getItem('publicDashboardLastSync') || '0', 10);
        } else {
            const keys = [
                'lastServerFetch_skillMentorshipSubmissions', 
                'lastServerFetch_imnciVisitReports', 
                'lastServerFetch_eencVisitReports'
            ];
            keys.forEach(k => {
                const t = parseInt(localStorage.getItem(k) || '0', 10);
                if (t > lastTimeMs) lastTimeMs = t;
            });
        }
        
        if (lastTimeMs > 0) {
            const d = new Date(lastTimeMs);
            setLastSyncTime(d.toLocaleString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric', 
                hour: 'numeric', minute: '2-digit', hour12: true 
            }));
        } else {
            setLastSyncTime('Never synced');
        }
    }, [publicDashboardMode]);

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
    } = useDataCache();

    const [localHealthFacilities, setLocalHealthFacilities] = useState(healthFacilities || []);

    // Provide a non-blocking loading state for facilities when cached data exists
    const isFacilitiesLoading = isDataCacheLoading?.healthFacilities && (!localHealthFacilities || localHealthFacilities.length === 0);

    useEffect(() => {
        if (!publicDashboardMode) {
            updateLastSyncTime();
        }
    }, [
        isDataCacheLoading?.skillMentorshipSubmissions, 
        isDataCacheLoading?.imnciVisitReports, 
        isDataCacheLoading?.eencVisitReports, 
        updateLastSyncTime, 
        publicDashboardMode
    ]);

    const canSeeAllMentorshipData = useMemo(() => {
        if (publicDashboardMode || publicSubmissionMode) return true;
        if (permissions?.canUseSuperUserAdvancedFeatures || permissions?.canUseFederalManagerAdvancedFeatures) return true;
        if (['super_user', 'federal_manager'].includes(permissions?.role)) return true;
        if (permissions?.manageLocation === 'federal_level' && permissions?.role !== 'facilitator') return true;

        return false;
    }, [permissions, publicDashboardMode, publicSubmissionMode]);

    const isLocalityManager = permissions?.manageScope === 'locality' || permissions?.role === 'locality_manager';
    const isFacilitator = permissions?.role === 'facilitator';

    const [activeDashboardState, setActiveDashboardState] = useState(() => {
        if (publicDashboardMode) return publicDashboardParams?.state || '';
        if (!canSeeAllMentorshipData && userStates?.length === 1) return userStates[0];
        return '';
    });
    
    const [activeDashboardLocality, setActiveDashboardLocality] = useState(() => {
        if (publicDashboardMode) return publicDashboardParams?.locality || '';
        if (!canSeeAllMentorshipData && isLocalityManager && userLocalities?.length === 1) return userLocalities[0];
        return '';
    });

    const [activeDashboardFacilityId, setActiveDashboardFacilityId] = useState(publicDashboardMode ? publicDashboardParams?.facilityId || '' : '');
    const [activeDashboardWorkerName, setActiveDashboardWorkerName] = useState(publicDashboardMode ? publicDashboardParams?.workerName || '' : '');
    const [activeDashboardProject, setActiveDashboardProject] = useState(publicDashboardMode ? publicDashboardParams?.project || '' : '');
    const [activeDashboardWorkerType, setActiveDashboardWorkerType] = useState(publicDashboardMode ? publicDashboardParams?.workerType || '' : '');
    const [activeDashboardDate, setActiveDashboardDate] = useState(publicDashboardMode ? (publicDashboardParams?.dateFilter || publicDashboardParams?.week || '') : '');

    const [viewingVisitReport, setViewingVisitReport] = useState(null);

    const [isFacilitySelectionModalOpen, setIsFacilitySelectionModalOpen] = useState(false);
    const [isStandaloneFacilityModalOpen, setIsStandaloneFacilityModalOpen] = useState(false);

    const [lastSavedSessionData, setLastSavedSessionData] = useState(null);
    const [isTrainingPrioritiesModalOpen, setIsTrainingPrioritiesModalOpen] = useState(false);


    const [publicData, setPublicData] = useState({ submissions: null, imnci: null, eenc: null });
    const [publicLoading, setPublicLoading] = useState(publicDashboardMode);

    const { language } = useTranslation();

    useEffect(() => {
        if (healthFacilities) {
            setLocalHealthFacilities(healthFacilities);
        }
    }, [healthFacilities]);

    useEffect(() => {
        if (publicDashboardMode) {
            let isMounted = true;
            const fetchPublicData = async () => {
                const timeKey = 'publicDashboardLastSync';
                const lastFetchTime = parseInt(localStorage.getItem(timeKey) || '0', 10);
                const isStale = (Date.now() - lastFetchTime) > (1 * 60 * 60 * 1000); 
                
                let localSubs = [];
                let localImnci = [];
                let localEenc = [];
                let hasLocalData = false;

                try {
                    const [cachedSubs, cachedImnci, cachedEenc] = await Promise.all([
                        typeof listMentorshipSessions === 'function' ? listMentorshipSessions({ source: 'cache' }).catch(() => []) : Promise.resolve([]),
                        typeof listIMNCIVisitReports === 'function' ? listIMNCIVisitReports({ source: 'cache' }).catch(() => []) : Promise.resolve([]),
                        typeof listEENCVisitReports === 'function' ? listEENCVisitReports({ source: 'cache' }).catch(() => []) : Promise.resolve([])
                    ]);
                    
                    if (isMounted && cachedSubs !== undefined && cachedImnci !== undefined && cachedEenc !== undefined) {
                        localSubs = cachedSubs;
                        localImnci = cachedImnci;
                        localEenc = cachedEenc;
                        hasLocalData = true;

                        setPublicData({ submissions: cachedSubs || [], imnci: cachedImnci || [], eenc: cachedEenc || [] });
                        setPublicLoading(false); 
                        updateLastSyncTime(); 
                    }
                } catch (e) {
                    console.log("Cache miss or unavailable. Waiting for server data...");
                }

                if (!hasLocalData || isStale) {
                    try {
                        let effectiveLastFetchTime = lastFetchTime;
                        if (!hasLocalData || localSubs.length === 0) {
                            effectiveLastFetchTime = 0;
                        }

                        const [newSubs, newImnci, newEenc] = await Promise.all([
                            typeof listMentorshipSessions === 'function' ? listMentorshipSessions({ source: 'server' }, effectiveLastFetchTime).catch(() => []) : Promise.resolve([]),
                            typeof listIMNCIVisitReports === 'function' ? listIMNCIVisitReports({ source: 'server' }, effectiveLastFetchTime).catch(() => []) : Promise.resolve([]),
                            typeof listEENCVisitReports === 'function' ? listEENCVisitReports({ source: 'server' }, effectiveLastFetchTime).catch(() => []) : Promise.resolve([])
                        ]);

                        if (isMounted) {
                            const mergeData = (oldData, newData) => {
                                if (!newData || newData.length === 0) return oldData || [];
                                const map = new Map((oldData || []).map(i => [i.id, i]));
                                newData.forEach(i => map.set(i.id, i));
                                return Array.from(map.values());
                            };

                            setPublicData({ 
                                submissions: mergeData(localSubs, newSubs), 
                                imnci: mergeData(localImnci, newImnci), 
                                eenc: mergeData(localEenc, newEenc) 
                            });
                            
                            localStorage.setItem(timeKey, Date.now().toString());
                            updateLastSyncTime();
                        }
                    } catch (e) {
                        console.error("Failed fetching fresh public data from server", e);
                    } finally {
                        if (isMounted) setPublicLoading(false);
                    }
                }
            };
            fetchPublicData();
            return () => { isMounted = false; };
        }
    }, [publicDashboardMode, updateLastSyncTime]);

    useEffect(() => {
        if (fetchHealthFacilities) {
            fetchHealthFacilities({}, false);
        }

        if (!publicDashboardMode) {
            fetchSkillMentorshipSubmissions(false);
            fetchIMNCIVisitReports(false); 
            if (fetchEENCVisitReports) fetchEENCVisitReports(false);
            updateLastSyncTime();
        }
    }, [fetchHealthFacilities, fetchSkillMentorshipSubmissions, fetchIMNCIVisitReports, fetchEENCVisitReports, publicDashboardMode, updateLastSyncTime]);

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

    const [isMothersFormModalOpen, setIsMothersFormModalOpen] = useState(false);
    const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
    const [isVisitReportModalOpen, setIsVisitReportModalOpen] = useState(false);
    const [lastSavedFacilityInfo, setLastSavedFacilityInfo] = useState(null);
 
    const formRef = useRef(null);
    
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [supervisorFilter, setSupervisorFilter] = useState(''); 
    const [statusFilter, setStatusFilter] = useState('');
    const [visitNumberFilter, setVisitNumberFilter] = useState(''); 
    const [facilityFilter, setFacilityFilter] = useState('');
    const [workerFilter, setWorkerFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [workerTypeFilter, setWorkerTypeFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const canEditVisitNumber = useMemo(() => {
        if (publicSubmissionMode || publicDashboardMode) return false;
        return permissions?.canUseFederalManagerAdvancedFeatures || 
               permissions?.canUseSuperUserAdvancedFeatures ||
               permissions?.manageScope === 'federal' || 
               permissions?.role === 'super_user' || 
               permissions?.role === 'federal_manager';
    }, [permissions, publicSubmissionMode, publicDashboardMode]);

    const dashboardStateLocalities = useMemo(() => {
        if (canSeeAllMentorshipData || !userStates || userStates.length === 0) return STATE_LOCALITIES;
        const filtered = {};
        userStates.forEach(stateKey => {
            if (STATE_LOCALITIES[stateKey]) {
                filtered[stateKey] = { ...STATE_LOCALITIES[stateKey] };
                if (isLocalityManager && userLocalities && userLocalities.length > 0) {
                     filtered[stateKey].localities = filtered[stateKey].localities.filter(l => 
                         userLocalities.includes(l.en) || userLocalities.includes(l.ar)
                     );
                }
            }
        });
        return filtered;
    }, [canSeeAllMentorshipData, userStates, userLocalities, isLocalityManager]);

    const facilityMap = useMemo(() => {
        const map = new Map();
        if (localHealthFacilities) {
            for (let i = 0; i < localHealthFacilities.length; i++) {
                map.set(localHealthFacilities[i].id, localHealthFacilities[i]);
            }
        }
        return map;
    }, [localHealthFacilities]);

    const processedSubmissions = useMemo(() => {
        const sourceData = publicDashboardMode ? publicData.submissions : skillMentorshipSubmissions;
        if (!sourceData) return [];
        
        let filteredData = sourceData.filter(sub => 
            !deletedSubmissionIds.has(sub.id) && sub.isDeleted !== true && sub.isDeleted !== "true"
        );

        let mappedData = filteredData.map(sub => {
            const fac = facilityMap.get(sub.facilityId);
            const projectInfo = fac?.project_name || fac?.['المشروع'] || fac?.project || fac?.['الشركاء_الداعمين'] || fac?.['المنظمة_الداعمة'] || sub.project || 'N/A';
            
            const rawState = sub.state || fac?.['الولاية'] || 'N/A';
            const rawLocality = sub.locality || fac?.['المحلية'] || 'N/A';
            
            const normState = normalizeState(rawState);
            const normLocality = normalizeLocality(normState, rawLocality);

            return {
                id: sub.id,
                service: sub.serviceType,
                date: sub.effectiveDate ? new Date(sub.effectiveDate.seconds * 1000).toISOString().split('T')[0] : (sub.sessionDate || 'N/A'),
                effectiveDateTimestamp: sub.effectiveDate,
                state: normState,
                locality: normLocality,
                facility: sub.facilityName || fac?.['اسم_المؤسسة'] || 'N/A',
                staff: sub.healthWorkerName || 'N/A',
                supervisorEmail: sub.mentorEmail || null,
                supervisorName: sub.mentorName || null,
                supervisorDisplay: sub.mentorName || sub.mentorEmail || 'N/A',
                facilityId: sub.facilityId || null,
                scores: sub.scores || null,
                status: sub.status || 'complete',
                facilityType: sub.facilityType || fac?.['نوع_المؤسسةالصحية'] || null,
                workerType: normalizeJobTitle(sub.workerType) || null,
                motherName: sub.motherName || null,
                visitNumber: sub.visitNumber || null,
                sessionDate: sub.sessionDate || (sub.effectiveDate ? new Date(sub.effectiveDate.seconds * 1000).toISOString().split('T')[0] : null),
                project: projectInfo, 
                fullData: sub 
            };
        });

        if (isFacilitator && user?.email) {
            mappedData = mappedData.filter(sub => sub.supervisorEmail === user.email);
        } else if (!canSeeAllMentorshipData) {
            if (userStates && userStates.length > 0) {
                const stateSet = new Set(userStates);
                mappedData = mappedData.filter(sub => stateSet.has(sub.state));
            }
            if (isLocalityManager && userLocalities && userLocalities.length > 0) {
                const localitySet = new Set(userLocalities);
                mappedData = mappedData.filter(sub => localitySet.has(sub.locality));
            }
        }

        return mappedData;
    }, [skillMentorshipSubmissions, publicDashboardMode, publicData.submissions, facilityMap, deletedSubmissionIds, canSeeAllMentorshipData, userStates, userLocalities, isLocalityManager, isFacilitator, user?.email]);

    // --- LIFTED SUBMISSIONS FILTERING TO TOP LEVEL ---
    const filteredSubmissions = useMemo(() => {
        let filtered = processedSubmissions;
        
        const motherServiceType = `${activeService}_MOTHERS`;
        const filterServiceTarget = activeTab === 'mothers_list' ? motherServiceType : activeService;
        
        if (filterServiceTarget) {
            filtered = filtered.filter(sub => sub.service === filterServiceTarget); 
        }
        if (stateFilter) filtered = filtered.filter(sub => sub.state === stateFilter);
        if (localityFilter) filtered = filtered.filter(sub => sub.locality === localityFilter);
        if (supervisorFilter) filtered = filtered.filter(sub => sub.supervisorEmail === supervisorFilter);
        if (statusFilter) filtered = filtered.filter(sub => sub.status === statusFilter);
        if (visitNumberFilter) filtered = filtered.filter(sub => String(sub.visitNumber) === String(visitNumberFilter));
        if (facilityFilter) filtered = filtered.filter(sub => sub.facility === facilityFilter);
        if (workerFilter) filtered = filtered.filter(sub => sub.staff === workerFilter);
        if (projectFilter) filtered = filtered.filter(sub => sub.project === projectFilter);
        if (workerTypeFilter) filtered = filtered.filter(sub => sub.workerType === workerTypeFilter);
        if (dateFilter) filtered = filtered.filter(sub => isDateInRange(sub.date, dateFilter));
        
        return filtered.sort((a, b) => {
            const timeA = a.effectiveDateTimestamp ? (a.effectiveDateTimestamp.seconds || a.effectiveDateTimestamp._seconds) : new Date(a.date).getTime() / 1000;
            const timeB = b.effectiveDateTimestamp ? (b.effectiveDateTimestamp.seconds || b.effectiveDateTimestamp._seconds) : new Date(b.date).getTime() / 1000;
            return timeB - timeA;
        });
    }, [processedSubmissions, activeService, activeTab, stateFilter, localityFilter, supervisorFilter, statusFilter, visitNumberFilter, facilityFilter, workerFilter, projectFilter, workerTypeFilter, dateFilter]);

    const uniqueVisitNumbers = useMemo(() => {
        const numbers = new Set();
        processedSubmissions.forEach(sub => {
            if (sub.visitNumber) numbers.add(Number(sub.visitNumber));
        });
        return Array.from(numbers).sort((a, b) => a - b);
    }, [processedSubmissions]);
    
    const uniqueFacilitiesList = useMemo(() => {
        const facs = new Set();
        processedSubmissions.forEach(sub => {
            if ((!stateFilter || sub.state === stateFilter) && 
                (!localityFilter || sub.locality === localityFilter)) {
                if (sub.facility && sub.facility !== 'N/A') facs.add(sub.facility);
            }
        });
        return Array.from(facs).sort();
    }, [processedSubmissions, stateFilter, localityFilter]);

    const uniqueWorkersList = useMemo(() => {
        const workers = new Set();
        processedSubmissions.forEach(sub => {
            if ((!stateFilter || sub.state === stateFilter) && 
                (!localityFilter || sub.locality === localityFilter) &&
                (!facilityFilter || sub.facility === facilityFilter)) {
                if (sub.staff && sub.staff !== 'N/A') workers.add(sub.staff);
            }
        });
        return Array.from(workers).sort();
    }, [processedSubmissions, stateFilter, localityFilter, facilityFilter]);

    const uniqueProjectsList = useMemo(() => {
        const projects = new Set();
        processedSubmissions.forEach(sub => {
            if ((!stateFilter || sub.state === stateFilter) && 
                (!localityFilter || sub.locality === localityFilter) &&
                (!facilityFilter || sub.facility === facilityFilter)) {
                if (sub.project && sub.project !== 'N/A') projects.add(sub.project);
            }
        });
        return Array.from(projects).sort();
    }, [processedSubmissions, stateFilter, localityFilter, facilityFilter]);

    const uniqueWorkerTypesList = useMemo(() => {
        const types = new Set();
        processedSubmissions.forEach(sub => {
            if ((!stateFilter || sub.state === stateFilter) && 
                (!localityFilter || sub.locality === localityFilter) &&
                (!facilityFilter || sub.facility === facilityFilter)) {
                if (sub.workerType && sub.workerType !== 'N/A') types.add(sub.workerType);
            }
        });
        return Array.from(types).sort();
    }, [processedSubmissions, stateFilter, localityFilter, facilityFilter]);

    const workerHistory = useMemo(() => {
        if (!processedSubmissions || !selectedFacilityId || !selectedHealthWorkerName || !activeService) return [];
        return processedSubmissions.filter(sub =>
            sub.facilityId === selectedFacilityId &&
            sub.staff === selectedHealthWorkerName &&
            sub.service === activeService &&
            sub.sessionDate
        );
    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService]);

    const currentUserDrafts = useMemo(() => {
        if (!user || !processedSubmissions || !activeService) return [];
        return processedSubmissions.filter(sub =>
            sub.status === 'draft' &&
            sub.supervisorEmail === user.email &&
            sub.service === activeService
        ).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [processedSubmissions, user, activeService]);

    const processedVisitReports = useMemo(() => {
        const rawImnci = publicDashboardMode ? publicData.imnci : imnciVisitReports;
        const rawEenc = publicDashboardMode ? publicData.eenc : eencVisitReports;
        
        const mapReport = (rep, serviceType) => {
            const fac = facilityMap.get(rep.facilityId || rep.fullData?.facilityId);
            const projectInfo = rep.project || rep.fullData?.project || fac?.project_name || fac?.['المشروع'] || fac?.project || fac?.['الشركاء_الداعمين'] || fac?.['المنظمة_الداعمة'] || 'N/A';
            
            const rawState = rep.state || rep.fullData?.state || fac?.['الولاية'] || 'N/A';
            const rawLocality = rep.locality || rep.fullData?.locality || fac?.['المحلية'] || 'N/A';
            
            const normState = normalizeState(rawState);
            const normLocality = normalizeLocality(normState, rawLocality);

            return {
                id: rep.id,
                service: serviceType,
                facilityId: rep.facilityId || rep.fullData?.facilityId || null,
                facilityName: rep.facilityName || rep.fullData?.facilityName || fac?.['اسم_المؤسسة'] || 'N/A',
                state: normState,
                locality: normLocality,
                visitDate: rep.visitDate || rep.fullData?.visitDate || rep.visit_date || rep.date || 'N/A',
                visitNumber: rep.visitNumber || rep.fullData?.visitNumber || null, 
                mentorEmail: rep.mentorEmail || rep.fullData?.mentorEmail || null,
                mentorName: rep.mentorName || rep.fullData?.mentorName || null,
                mentorDisplay: rep.mentorName || rep.fullData?.mentorName || rep.mentorEmail || rep.fullData?.mentorEmail || 'N/A',
                project: projectInfo, 
                fullData: rep.fullData || rep
            };
        };
        
        const imnci = (rawImnci || []).map(rep => mapReport(rep, 'IMNCI'));
        const eenc = (rawEenc || []).map(rep => mapReport(rep, 'EENC'));

        let allReports = [...imnci, ...eenc];
        allReports = allReports.filter(rep => 
            rep.service === activeService && 
            !deletedReportIds.has(rep.id) && 
            rep.fullData?.isDeleted !== true && 
            rep.fullData?.isDeleted !== "true"
        );

        if (isFacilitator && user?.email) {
            allReports = allReports.filter(rep => rep.mentorEmail === user.email);
        } else if (!canSeeAllMentorshipData) {
            if (userStates && userStates.length > 0) {
                const stateSet = new Set(userStates);
                allReports = allReports.filter(rep => stateSet.has(rep.state));
            }
            if (isLocalityManager && userLocalities && userLocalities.length > 0) {
                const localitySet = new Set(userLocalities);
                allReports = allReports.filter(rep => localitySet.has(rep.locality));
            }
        }

        return allReports;
    }, [imnciVisitReports, eencVisitReports, activeService, publicDashboardMode, publicData, deletedReportIds, facilityMap, canSeeAllMentorshipData, userStates, userLocalities, isLocalityManager, isFacilitator, user?.email]);
    
    // --- LIFTED VISIT REPORTS FILTERING TO TOP LEVEL ---
    const filteredVisitReports = useMemo(() => {
        let filtered = processedVisitReports;

        if (stateFilter) filtered = filtered.filter(rep => rep.state === stateFilter);
        if (localityFilter) filtered = filtered.filter(rep => rep.locality === localityFilter);
        if (facilityFilter) filtered = filtered.filter(rep => rep.facilityName === facilityFilter);
        if (supervisorFilter) filtered = filtered.filter(rep => rep.mentorEmail === supervisorFilter);
        if (visitNumberFilter) filtered = filtered.filter(rep => String(rep.visitNumber) === String(visitNumberFilter));
        if (dateFilter) filtered = filtered.filter(rep => isDateInRange(rep.visitDate, dateFilter));

        return filtered.sort((a, b) => {
            const timeA = a.fullData?.createdAt ? (a.fullData.createdAt.seconds || a.fullData.createdAt._seconds) : new Date(a.visitDate || 0).getTime() / 1000;
            const timeB = b.fullData?.createdAt ? (b.fullData.createdAt.seconds || b.fullData.createdAt._seconds) : new Date(b.visitDate || 0).getTime() / 1000;
            return timeB - timeA; 
        });
    }, [processedVisitReports, stateFilter, localityFilter, facilityFilter, supervisorFilter, visitNumberFilter, dateFilter]);

    const currentUserVisitReports = useMemo(() => {
        if (!user || !processedVisitReports || !activeService) return [];
        return processedVisitReports.filter(rep =>
            rep.mentorEmail === user.email &&
            rep.service === activeService
        ).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
    }, [processedVisitReports, user, activeService]);

    const handleEditVisitReport = (reportId) => {
        const reportList = activeService === 'IMNCI' ? imnciVisitReports : eencVisitReports;
        if (!reportList) return;

        const report = reportList.find(r => r.id === reportId);
        if (!report) return;

        const isAuthor = report.mentorEmail === user?.email;

        // UPDATED: Facilitators CAN edit their own visit reports
        if (!canManageMentorship && !isAuthor) {
            setToast({ show: true, message: 'You do not have permission to edit this report.', type: 'error' });
            return;
        }

        setSelectedState(report.state);
        setSelectedLocality(report.locality);
        setSelectedFacilityId(report.facilityId);
        setEditingSubmission(report);
        setActiveFormType('visit_report');
        setCurrentView('form_setup');
        setIsReadyToStart(true); 
    };

    const handleViewVisitReport = (reportId) => {
        const report = processedVisitReports.find(r => r.id === reportId);
        if (report) {
            setViewingVisitReport(report);
        }
    };

    const handleDeleteVisitReport = async (reportId) => {
        // UPDATED: Only canManageMentorship can delete submitted reports.
        if (!canManageMentorship) {
             setToast({ show: true, message: 'You do not have permission to delete submitted reports.', type: 'error' });
             return;
        }
        
        if (window.confirm('Are you sure you want to delete this visit report?')) {
            setDeletedReportIds(prev => new Set(prev).add(reportId));
            try {
                if (activeService === 'IMNCI') {
                    await deleteIMNCIVisitReport(reportId);
                } else if (activeService === 'EENC') {
                    await deleteEENCVisitReport(reportId);
                }
                setToast({ show: true, message: 'Report deleted. (Click Refresh to update table)', type: 'success' });
            } catch (error) {
                setToast({ show: true, message: `Delete failed: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleBulkDeleteReports = async () => {
        if (!canManageMentorship) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedReportIds.length} reports?`)) return;

        const reportsToDelete = selectedReportIds.map(id => processedVisitReports.find(r => r.id === id)).filter(Boolean);

        const newDeleted = new Set(deletedReportIds);
        selectedReportIds.forEach(id => newDeleted.add(id));
        setDeletedReportIds(newDeleted);
        
        setSelectedReportIds([]);

        try {
            await Promise.all(reportsToDelete.map(rep => {
                if (rep.service === 'IMNCI') return deleteIMNCIVisitReport(rep.id);
                else return deleteEENCVisitReport(rep.id);
            }));
            setToast({ show: true, message: 'Selected reports deleted.', type: 'success' });
        } catch(error) {
            console.error("Bulk delete error", error);
            setToast({ show: true, message: 'Some reports failed to delete.', type: 'error' });
        }
    };

    const handleChallengeStatusUpdate = async (reportId, challengeId, newStatus, fieldName = 'status') => {
        const reportList = activeService === 'IMNCI' ? imnciVisitReports : eencVisitReports;
        const report = reportList.find(r => r.id === reportId);
        
        if (!report) {
            setToast({ show: true, message: 'Report not found', type: 'error' });
            return;
        }

        const updatedChallenges = (report.challenges_table || []).map(ch => 
            ch.id === challengeId ? { ...ch, [fieldName]: newStatus } : ch
        );

        const payload = {
            ...report,
            challenges_table: updatedChallenges,
            lastUpdatedAt: Timestamp.now(),
            statusUpdatedBy: user?.email || 'Unknown'
        };
        const { id, ...dataToSave } = payload;

        try {
            if (activeService === 'IMNCI') {
                await saveIMNCIVisitReport(dataToSave, reportId);
            } else {
                await saveEENCVisitReport(dataToSave, reportId);
            }
            setToast({ show: true, message: 'Status updated. (Click Refresh to update table)', type: 'success' });
        } catch (error) {
            console.error("Error updating status:", error);
            setToast({ show: true, message: `Failed to update status: ${error.message}`, type: 'error' });
        }
    };

    // --- Handle Previewing Visit Numbers Sync Based on Current Filters ---
    const handlePreviewVisitNumbers = () => {
        let allUpdates = [];

        if (activeTab === 'visit_reports') {
            const facilitiesToProcess = new Set(filteredVisitReports.map(r => r.facilityId));
            if (facilitiesToProcess.size === 0) {
                setToast({ show: true, message: 'لا توجد تقارير حالية لعمل مزامنة عليها بناءً على التصفية الحالية.', type: 'info' });
                return;
            }

            const reportsToProcess = processedVisitReports.filter(r => facilitiesToProcess.has(r.facilityId));
            const imnciReportsToProcess = reportsToProcess.filter(r => r.service === 'IMNCI');
            const eencReportsToProcess = reportsToProcess.filter(r => r.service === 'EENC');

            allUpdates = [
                ...calculateVisitNumberUpdates(imnciReportsToProcess, 'IMNCI'),
                ...calculateVisitNumberUpdates(eencReportsToProcess, 'EENC')
            ];
        } else {
            // For skills_list and mothers_list
            const facilitiesToProcess = new Set(filteredSubmissions.map(s => s.facilityId));
            if (facilitiesToProcess.size === 0) {
                setToast({ show: true, message: 'لا توجد جلسات حالية لعمل مزامنة عليها بناءً على التصفية الحالية.', type: 'info' });
                return;
            }

            const targetService = activeTab === 'mothers_list' ? `${activeService}_MOTHERS` : activeService;
            
            // For chronological calculation to be accurate, we grab all matching targetService 
            // records for the filtered facilities.
            const subsToProcess = processedSubmissions.filter(s => {
                if (s.service !== targetService) return false;
                if (!facilitiesToProcess.has(s.facilityId)) return false;
                return true;
            });

            allUpdates = calculateSubmissionVisitNumberUpdates(subsToProcess, activeTab);
        }
        
        if (allUpdates.length === 0) {
            setToast({ show: true, message: 'أرقام الزيارات للمنشآت المحددة صحيحة بالفعل.', type: 'success' });
        } else {
            setProposedSyncUpdates(allUpdates);
            setIsPreviewSyncModalOpen(true);
        }
    };

    // --- Handle Confirming the Sync ---
    const handleConfirmSync = async () => {
        setIsExecutingSync(true);
        let successCount = 0;
        try {
            for (const update of proposedSyncUpdates) {
                if (activeTab === 'visit_reports') {
                    if (update.service === 'IMNCI') {
                        await saveIMNCIVisitReport(update.payload, update.id);
                    } else if (update.service === 'EENC') {
                        await saveEENCVisitReport(update.payload, update.id);
                    }
                } else {
                    await saveMentorshipSession(update.payload, update.id);
                }
                successCount++;
            }
            setToast({ show: true, message: `Successfully updated ${successCount} records.`, type: 'success' });
            setIsPreviewSyncModalOpen(false);
            setProposedSyncUpdates([]);
            handleRefresh(); 
        } catch (error) {
            console.error("Sync error:", error);
            setToast({ show: true, message: `Error during sync: ${error.message}`, type: 'error' });
        } finally {
            setIsExecutingSync(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            if (publicDashboardMode) {
                const timeKey = 'publicDashboardLastSync';
                const lastFetch = parseInt(localStorage.getItem(timeKey) || '0', 10);
                
                let effectiveLastFetch = lastFetch;
                if (!publicData.submissions || publicData.submissions.length === 0) {
                    effectiveLastFetch = 0;
                }

                if (fetchHealthFacilities) {
                    fetchHealthFacilities({}, true);
                }

                const [newSubs, newImnci, newEenc] = await Promise.all([
                    listMentorshipSessions({ source: 'server' }, effectiveLastFetch).catch(() => []),
                    listIMNCIVisitReports({ source: 'server' }, effectiveLastFetch).catch(() => []),
                    listEENCVisitReports({ source: 'server' }, effectiveLastFetch).catch(() => [])
                ]);

                const mergeData = (oldData, newData) => {
                    if (!newData || newData.length === 0) return oldData || [];
                    const map = new Map((oldData || []).map(i => [i.id, i]));
                    newData.forEach(i => map.set(i.id, i));
                    return Array.from(map.values());
                };

                setPublicData(prev => ({
                    submissions: mergeData(prev.submissions, newSubs),
                    imnci: mergeData(prev.imnci, newImnci),
                    eenc: mergeData(prev.eenc, newEenc)
                }));
                
                localStorage.setItem(timeKey, Date.now().toString());

            } else {
                const promises = [
                    fetchSkillMentorshipSubmissions(true),
                    fetchIMNCIVisitReports(true),
                    fetchHealthFacilities({}, true)
                ];
                if (fetchEENCVisitReports) {
                    promises.push(fetchEENCVisitReports(true));
                }
                await Promise.all(promises);
            }
            updateLastSyncTime();
            setToast({ show: true, message: "Data refreshed successfully.", type: "success" });
        } catch (error) {
            setToast({ show: true, message: `Failed to refresh: ${error.message}`, type: "error" });
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (!publicDashboardMode) {
            setStateFilter('');
            setLocalityFilter('');
            setSupervisorFilter('');
            setStatusFilter('');
            setVisitNumberFilter('');
            setFacilityFilter('');
            setWorkerFilter('');
            setProjectFilter('');
            setWorkerTypeFilter('');
            setDateFilter('');
        }
    }, [activeTab, publicDashboardMode]);

    // 1. Add this reference to track if the record has been triggered already
    const hasTriggeredRecordView = useRef(false);

    // 2. Add this useEffect near the other data-fetching effects to handle isRecordView logic
    useEffect(() => {
        if (publicDashboardMode && publicDashboardParams?.isRecordView && !publicLoading && !hasTriggeredRecordView.current) {
            // Only trigger if data arrays are populated (or at least we tried fetching them)
            if (processedSubmissions.length > 0 || processedVisitReports.length > 0) {
                hasTriggeredRecordView.current = true;
                const { viewId, viewType } = publicDashboardParams;
                
                if (viewType === 'cases' || viewType === 'mothers') {
                    const sub = processedSubmissions.find(s => s.id === viewId);
                    if (sub) {
                        setViewingSubmission(sub);
                    } else {
                        setToast({ show: true, message: 'Record not found.', type: 'error' });
                    }
                } else if (viewType === 'reports') {
                    const rep = processedVisitReports.find(r => r.id === viewId);
                    if (rep) {
                        setViewingVisitReport(rep);
                    } else {
                        setToast({ show: true, message: 'Report not found.', type: 'error' });
                    }
                }
            }
        }
    }, [publicDashboardMode, publicDashboardParams, publicLoading, processedSubmissions, processedVisitReports, setToast]);


    const availableStates = useMemo(() => {
        const allStates = Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar));
        const userAllowedStates = allStates.filter(sKey =>
             canSeeAllMentorshipData || !userStates || userStates.length === 0 || userStates.includes(sKey)
        );
        return [
            { key: "", label: "-- اختر الولاية --" },
            ...userAllowedStates.map(sKey => ({ key: sKey, label: STATE_LOCALITIES[sKey].ar }))
        ];
    }, [userStates, canSeeAllMentorshipData]);

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
        
        let locs = STATE_LOCALITIES[stateFilter].localities;
        if (!canSeeAllMentorshipData && isLocalityManager && userLocalities && userLocalities.length > 0) {
             locs = locs.filter(l => userLocalities.includes(l.en) || userLocalities.includes(l.ar));
        }

        return [
            { key: "", label: "Select Locality" },
            ...locs.sort((a, b) => a.ar.localeCompare(b.ar)).map(l => ({ key: l.en, label: l.ar }))
        ];
    }, [stateFilter, canSeeAllMentorshipData, isLocalityManager, userLocalities]);


     useEffect(() => {
        if (!publicSubmissionMode && !publicDashboardMode && userStates && userStates.length === 1) {
            setSelectedState(userStates[0]);
        }
    }, [userStates, publicSubmissionMode, publicDashboardMode]);

    useEffect(() => {
       if (!publicSubmissionMode && !publicDashboardMode && isLocalityManager && userLocalities && userLocalities.length === 1) {
            setSelectedLocality(userLocalities[0]);
        }
    }, [userLocalities, isLocalityManager, publicSubmissionMode, publicDashboardMode]);


    const handleStateChange = (e) => {
        setSelectedState(e.target.value);
        if (!isLocalityManager || publicSubmissionMode) {
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

    const motherVisitNumber = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !activeService) {
            return 1;
        }

        if (editingSubmission && (editingSubmission.service === `${activeService}_MOTHERS`)) {
             return editingSubmission.visitNumber || 1;
        }

        const motherServiceType = `${activeService}_MOTHERS`;

        const facilityMotherSessions = processedSubmissions.filter(sub =>
            sub.facilityId === selectedFacilityId &&
            sub.service === motherServiceType &&
            sub.sessionDate
        );

        const uniqueDateSet = new Set(facilityMotherSessions.map(s => s.sessionDate));
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

    }, [processedSubmissions, selectedFacilityId, activeService, editingSubmission]);

    const visitReportVisitNumber = useMemo(() => {
        if (!selectedFacilityId || !activeService) {
            return 1;
        }
        
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

    const lastSessionDate = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return null;
        }

        const workerSessions = processedSubmissions
            .filter(sub =>
                sub.facilityId === selectedFacilityId &&
                sub.staff === selectedHealthWorkerName &&
                sub.service === activeService 
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
        if (publicSubmissionMode || !(isLocalityManager && userLocalities && userLocalities.length === 1)) {
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
        if (publicDashboardMode) {
            setCurrentView('history');
            setActiveTab('dashboard');
        } else {
            setCurrentView('action_menu');
        }
    };

    const handleActionMenuClick = (action) => {
        if (action === 'view_submissions') {
            setCurrentView('history');
            setActiveTab('skills_list');
        } else if (action === 'training_priorities') {
            setCurrentView('training_priorities');
        } else if (action === 'view_dashboard') {
            setCurrentView('history');
            setActiveTab('dashboard');
        } else if (action === 'view_drafts') {
            setIsDraftsModalOpen(true);
        } else if (action === 'new_skill') {
            if (!canAddMentorshipData) return;
            resetSelection();
            setActiveFormType('skills_assessment');
            setCurrentView('form_setup');
        } else if (action === 'new_mother') {
            if (!canAddMentorshipData) return;
            resetSelection();
            setActiveFormType('mothers_form');
            setCurrentView('form_setup');
        } else if (action === 'new_visit_report') {
            if (!canAddMentorshipData) return;
            resetSelection();
            setActiveFormType('visit_report');
            setCurrentView('form_setup');
        } else if (action === 'update_facility') {
            if (!canAddMentorshipData) return;
            resetSelection();
            setActiveFormType('facility_update');
            setCurrentView('form_setup');
        }
    };
    
    const handleStartNewVisit = async () => {
        if (!canAddMentorshipData) return;
        resetSelection();
        setActiveFormType('skills_assessment');
        setCurrentView('form_setup');
    };
    
    const handleStartMothersForm = () => {
        if (!canAddMentorshipData) return;
        resetSelection();
        setActiveFormType('mothers_form');
        setCurrentView('form_setup');
    };

    const handleStartNewVisitReport = () => {
        if (!canAddMentorshipData) return;
        resetSelection();
        setActiveFormType('visit_report');
        setCurrentView('form_setup');
    };

    const handleExitForm = () => {
        resetSelection(); 
        setCurrentView('action_menu');
    };

    const handleSaveSuccess = async (status, savedData) => {
        let lastFacilityInfo = null;
        if (savedData) {
            lastFacilityInfo = {
                state: savedData.state,
                locality: savedData.locality,
                facilityId: savedData.facilityId,
                healthWorkerName: savedData.healthWorkerName
            };
        }
        
        if (status === 'complete' || status === 'draft') {
            fetchSkillMentorshipSubmissions(true);
        }
 
        resetSelection(); 
        
        if (status === 'complete' && !publicSubmissionMode) {
            setLastSavedSessionData(savedData);
            setLastSavedFacilityInfo(lastFacilityInfo);
            setIsTrainingPrioritiesModalOpen(true);
        } else {
            if (publicSubmissionMode) {
                setCurrentView('action_menu');
            } else {
                setCurrentView('action_menu');
            }
        }
    };

    const handleGenericFormExit = async (returnTab = 'skills_list') => {
        resetSelection(); 
        setCurrentView('action_menu');
    };

    const previousViewRef = useRef(currentView);
    useEffect(() => {
        previousViewRef.current = currentView;
    }, [currentView]);

    const handleBackToMainMenu = () => {
        setCurrentView('action_menu');
        resetSelection();
    };

    const handlePostSaveSelect = (actionType) => {
        if (!lastSavedFacilityInfo) return;

        setIsTrainingPrioritiesModalOpen(false);

        const savedInfo = lastSavedFacilityInfo;
        setLastSavedFacilityInfo(null);
        setLastSavedSessionData(null);

        setSelectedState(savedInfo.state);
        setSelectedLocality(savedInfo.locality);
        setSelectedFacilityId(savedInfo.facilityId);

        if (actionType === 'skills_assessment' || actionType === 'mothers_form' || actionType === 'visit_report') {
            setActiveFormType(actionType);
            setCurrentView('form_setup');
            setSelectedHealthWorkerName('');
            setIsReadyToStart(false);

        } else if (actionType === 'action_menu') {
            setCurrentView('action_menu');
        } else if (actionType === 'drafts') {
            setIsDraftsModalOpen(true);
            setCurrentView('action_menu');
        }
    };

    const handlePostSaveClose = () => {
        setIsTrainingPrioritiesModalOpen(false);
        setLastSavedFacilityInfo(null);
        setLastSavedSessionData(null);
        setCurrentView('action_menu');
    };

    const handleProceedToForm = () => {
        if (activeFormType === 'facility_update') {
            setIsStandaloneFacilityModalOpen(true);
        }
        else if (activeFormType === 'skills_assessment') {
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

    const handleShareDashboardLink = () => {
        const baseUrl = `${window.location.origin}/public/mentorship/dashboard/${activeService}`;
        const params = new URLSearchParams();
        
        const stateToShare = activeDashboardState || selectedState;
        const localityToShare = activeDashboardLocality || selectedLocality;
        const facilityToShare = activeDashboardFacilityId || selectedFacilityId;
        const workerToShare = activeDashboardWorkerName || selectedHealthWorkerName;
        const projectToShare = activeDashboardProject || projectFilter;
        const workerTypeToShare = activeDashboardWorkerType || workerTypeFilter;
        const dateToShare = activeDashboardDate;

        if (stateToShare) params.append('state', stateToShare);
        if (localityToShare) params.append('locality', localityToShare);
        if (facilityToShare) params.append('facilityId', facilityToShare);
        if (workerToShare) params.append('workerName', workerToShare);
        if (projectToShare) params.append('project', projectToShare);
        if (workerTypeToShare) params.append('workerType', workerTypeToShare);
        if (dateToShare) params.append('dateFilter', dateToShare);
        if (language) {
            params.append('lang', language);
        }
        
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
            let message = `${successCount} sessions imported successfully. (Click Refresh to update table)`;
            if (errorCount > 0) {
                message += `\n${errorCount} rows failed to import. Check results for details.`;
            }
             setUploadStatus(prev => ({ ...prev, inProgress: false, message, errors: failedRowsData }));
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

            setLocalHealthFacilities(prevFacilities => 
                prevFacilities.map(f => f.id === payload.id ? payload : f)
            );

            setSelectedHealthWorkerName(workerData.name);
            
            setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
            setStatusAction('addWorker');

        } catch (error) {
            console.error("Error submitting new health worker for approval:", error);
            setStatusData({ status: 'error', message: error.message });
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

            setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
            setStatusAction('updateWorker');

        } catch (error) {
             console.error("Error submitting health worker update for approval:", error);
             setStatusData({ status: 'error', message: error.message });
        } finally {
            setIsUpdatingWorker(false);
        }
    };

    const handleCloseStatusModal = () => {
        const wasSuccessOrQueued = statusData?.status !== 'error';
        setStatusData(null);
        if (wasSuccessOrQueued) {
            if (statusAction === 'addWorker') {
                setIsAddWorkerModalOpen(false);
            } else if (statusAction === 'standaloneFacility') {
                setIsStandaloneFacilityModalOpen(false);
            }
        }
        setStatusAction(null);
    };

    const handleViewSubmission = (submissionId) => {
        const fullSubmission = skillMentorshipSubmissions.find(s => s.id === submissionId);
        setViewingSubmission(fullSubmission);
        setIsDraftsModalOpen(false);
    };

    const handleEditSubmission = async (submissionId) => {
        const fullSubmission = skillMentorshipSubmissions.find(s => s.id === submissionId);
        if (!fullSubmission) return;

        const isAuthor = fullSubmission.supervisorEmail === user?.email || fullSubmission.mentorEmail === user?.email;
        // UPDATED: Facilitators CANNOT edit completed sessions
        if (!canManageMentorship && !(isAuthor && fullSubmission.status === 'draft')) {
            setToast({ show: true, message: 'You do not have permission to edit completed sessions.', type: 'error' });
            return;
        }
        
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

        const isAuthor = submissionToDelete.supervisorEmail === user?.email || submissionToDelete.mentorEmail === user?.email;
        // UPDATED: Facilitators CANNOT delete completed sessions
        if (!canManageMentorship && !(isAuthor && submissionToDelete.status === 'draft')) {
            setToast({ show: true, message: 'You do not have permission to delete completed sessions.', type: 'error' });
            return;
        }

        const confirmMessage = `هل أنت متأكد من حذف جلسة العامل الصحي: ${submissionToDelete.staff || submissionToDelete.motherName || 'N/A'} بتاريخ ${submissionToDelete.date}؟\n${submissionToDelete.status === 'draft' ? '\n(هذه مسودة)' : ''}`;

        if (window.confirm(confirmMessage)) {
            setDeletedSubmissionIds(prev => new Set(prev).add(submissionId));
            try {
                await deleteMentorshipSession(submissionId);
                setToast({ show: true, message: 'تم الحذف. (انقر تحديث لتحديث القائمة)', type: 'success' });
                setIsDraftsModalOpen(false);
                setViewingSubmission(null);
            } catch (error) {
                console.error("Error deleting session:", error);
                setToast({ show: true, message: `فشل الحذف: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleBulkDeleteSubmissions = async () => {
        if (!canManageMentorship) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedSubmissionIds.length} items?`)) return;

        const newDeleted = new Set(deletedSubmissionIds);
        selectedSubmissionIds.forEach(id => newDeleted.add(id));
        setDeletedSubmissionIds(newDeleted);
        
        const idsToDelete = [...selectedSubmissionIds];
        setSelectedSubmissionIds([]);

        try {
            await Promise.all(idsToDelete.map(id => deleteMentorshipSession(id)));
            setToast({ show: true, message: 'Selected items deleted.', type: 'success' });
        } catch (error) {
            console.error("Bulk delete error", error);
            setToast({ show: true, message: 'Some items failed to delete. Refreshing might be needed.', type: 'error' });
        }
    };

    const handleDraftCreated = (newDraftObject) => {
        setEditingSubmission(newDraftObject);
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
                setActiveDashboardWorkerType(workerTypeFilter);
            }
            setIsDashboardModalOpen(true);
        }
    };

    if (currentView === 'service_selection') {
        return <ServiceSelector onSelectService={handleSelectService} />;
    }
    
    if (currentView === 'training_priorities') {
        return (
            <TrainingPrioritiesView
                activeService={activeService}
                submissions={processedSubmissions}
                currentUserEmail={user?.email}
                onBack={() => setCurrentView('action_menu')}
            />
        );
    }

    if (currentView === 'action_menu') {
        return (
            <>
                <ActionMenu 
                    onAction={handleActionMenuClick} 
                    activeService={activeService} 
                    draftCount={currentUserDrafts.length}
                    reportCount={currentUserVisitReports.length}
                    permissions={permissions}
                    canManage={canAddMentorshipData}
                    onBack={() => {
                        setActiveService(null);
                        setCurrentView('service_selection');
                        resetSelection();
                    }}
                />
                <DraftsModal
                    isOpen={isDraftsModalOpen}
                    onClose={() => setIsDraftsModalOpen(false)}
                    drafts={currentUserDrafts}
                    reports={currentUserVisitReports}
                    onViewSession={handleViewSubmission}
                    onEditSession={handleEditSubmission}
                    onDeleteSession={handleDeleteSubmission}
                    onViewReport={handleViewVisitReport}
                    onEditReport={handleEditVisitReport}
                    canManage={canManageMentorship}
                    userEmail={user?.email}
                />
                {viewingSubmission && (
                    <ViewSubmissionModal
                        submission={viewingSubmission}
                        onClose={() => setViewingSubmission(null)}
                    />
                )}
            </>
        );
    }

    if (currentView === 'history') {
        return (
            <>
                <Card dir="ltr">
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-2">
                            <div className="flex items-center gap-4">
                                {!publicDashboardMode && (
                                    <Button variant="secondary" onClick={() => setCurrentView('action_menu')} className="mr-4">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Main Menu
                                    </Button>
                                )}
                                
                                <LanguageSwitcher />

                                <Button 
                                    variant="secondary" 
                                    onClick={handleRefresh} 
                                    disabled={isRefreshing}
                                    className="flex items-center gap-2"
                                >
                                    {isRefreshing ? (
                                        <> <Spinner size="sm" /> Refreshing... </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.759l.274.549a.75.75 0 101.3-.65l-.274-.549a5.479 5.479 0 016.128-4.032.75.75 0 00.573-1.376 6.979 6.979 0 00-7.75-2.088l-.94-.313a.75.75 0 00-.913.655v1.944a.75.75 0 001.5 0V7.32l.94.313a5.479 5.479 0 016.128 4.032zM4.688 8.576a5.5 5.5 0 019.201-2.759l-.274-.549a.75.75 0 10-1.3.65l.274.549a5.479 5.479 0 01-6.128 4.032.75.75 0 00-.573 1.376 6.979 6.979 0 007.75 2.088l.94.313a.75.75 0 00.913-.655V12.06a.75.75 0 00-1.5 0v1.631l-.94-.313a5.479 5.479 0 01-6.128-4.032z" clipRule="evenodd" />
                                            </svg>
                                            Refresh
                                        </>
                                    )}
                                </Button>
                                {lastSyncTime && (
                                    <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-white text-slate-600 border border-slate-300 shadow-sm">
                                        <svg className="w-3.5 h-3.5 mr-1.5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Last Updated: {lastSyncTime}
                                    </div>
                                )}
                            </div>
                            
                            {activeTab === 'dashboard' && !publicDashboardMode && (
                                <div className="flex items-center">
                                    <Button variant="secondary" onClick={handleShareDashboardLink} title="Share Public Dashboard Link">
                                        <Share2 className="w-4 h-4 mr-2" /> Share Dashboard
                                    </Button>
                                </div>
                            )}
                        </div>

                        {!publicDashboardMode && activeTab !== 'dashboard' && (
                            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
                                <button
                                    onClick={() => setActiveTab('skills_list')}
                                    className={`px-4 py-2 font-medium text-sm transition-colors duration-150 whitespace-nowrap ${
                                        activeTab === 'skills_list'
                                            ? 'border-b-2 border-sky-500 text-sky-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Skills Assessments
                                </button>
                                <button
                                    onClick={() => setActiveTab('mothers_list')}
                                    className={`px-4 py-2 font-medium text-sm transition-colors duration-150 whitespace-nowrap ${
                                        activeTab === 'mothers_list'
                                            ? 'border-b-2 border-sky-500 text-sky-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Mothers Surveys
                                </button>
                                <button
                                    onClick={() => setActiveTab('visit_reports')}
                                    className={`px-4 py-2 font-medium text-sm transition-colors duration-150 whitespace-nowrap ${
                                        activeTab === 'visit_reports'
                                            ? 'border-b-2 border-sky-500 text-sky-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Visit Reports
                                </button>
                            </div>
                        )}

                        {activeTab !== 'dashboard' && !publicDashboardMode && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6 border p-4 rounded-lg bg-gray-50">
                                    
                                    <FormGroup label="Date Range" className="text-left" dir="ltr">
                                        <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                                            <option value="">All Time</option>
                                            <option value="today">Today</option>
                                            <option value="yesterday">Yesterday</option>
                                            <option value="this_week">This Week</option>
                                            <option value="last_week">Last Week</option>
                                            <option value="this_month">This Month</option>
                                            <option value="last_month">Last Month</option>
                                            <option value="this_year">This Year</option>
                                            <option value="last_year">Last Year</option>
                                        </Select>
                                    </FormGroup>

                                    <FormGroup label="State" className="text-left" dir="ltr">
                                        <Select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setLocalityFilter(''); setFacilityFilter(''); setWorkerFilter(''); setProjectFilter(''); setWorkerTypeFilter(''); }}>
                                            {availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                        </Select>
                                    </FormGroup>

                                    <FormGroup label="Locality" className="text-left" dir="ltr">
                                        <Select value={localityFilter} onChange={(e) => { setLocalityFilter(e.target.value); setFacilityFilter(''); setWorkerFilter(''); setProjectFilter(''); setWorkerTypeFilter(''); }} disabled={!stateFilter}>
                                             {availableLocalities.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                                        </Select>
                                    </FormGroup>

                                    <FormGroup label="Facility" className="text-left" dir="ltr">
                                        <Select value={facilityFilter} onChange={(e) => { setFacilityFilter(e.target.value); setWorkerFilter(''); setWorkerTypeFilter(''); }}>
                                            <option value="">All Facilities</option>
                                            {uniqueFacilitiesList.map(f => <option key={f} value={f}>{f}</option>)}
                                        </Select>
                                    </FormGroup>

                                    <FormGroup label="Health Worker" className="text-left" dir="ltr">
                                        <Select value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)}>
                                            <option value="">All Workers</option>
                                            {uniqueWorkersList.map(w => <option key={w} value={w}>{w}</option>)}
                                        </Select>
                                    </FormGroup>

                                    <FormGroup label="Job Title" className="text-left" dir="ltr">
                                        <Select value={workerTypeFilter} onChange={(e) => setWorkerTypeFilter(e.target.value)}>
                                            <option value="">All Job Titles</option>
                                            {uniqueWorkerTypesList.map(w => <option key={w} value={w}>{w}</option>)}
                                        </Select>
                                    </FormGroup>

                                    <FormGroup label="Project / Partner" className="text-left" dir="ltr">
                                        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                                            <option value="">All Projects</option>
                                            {uniqueProjectsList.map(p => <option key={p} value={p}>{p}</option>)}
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

                                    <FormGroup label="Visit Number" className="text-left" dir="ltr">
                                        <Select value={visitNumberFilter} onChange={(e) => setVisitNumberFilter(e.target.value)}>
                                            <option value="">All Visits</option>
                                            {uniqueVisitNumbers.map(num => (
                                                <option key={num} value={num}>Visit {num}</option>
                                            ))}
                                        </Select>
                                    </FormGroup>
                                </div>
                            
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-2 flex-wrap">
                                        
                                        {activeTab === 'skills_list' && selectedSubmissionIds.length === 0 && canAddMentorshipData && (
                                            <Button onClick={handleStartNewVisit}>Add New Skills Observation</Button>
                                        )}
                                        {activeTab === 'skills_list' && selectedSubmissionIds.length > 0 && canManageMentorship && (
                                            <Button variant="danger" onClick={handleBulkDeleteSubmissions}>
                                                <Trash2 className="w-4 h-4 mr-2 inline" /> Delete Selected ({selectedSubmissionIds.length})
                                            </Button>
                                        )}
                                        
                                        {activeTab === 'mothers_list' && selectedSubmissionIds.length === 0 && canAddMentorshipData && (
                                            <Button variant="primary" onClick={handleStartMothersForm}>Add Mother's Knowledge & Satisfaction Form</Button>
                                        )}
                                        {activeTab === 'mothers_list' && selectedSubmissionIds.length > 0 && canManageMentorship && (
                                            <Button variant="danger" onClick={handleBulkDeleteSubmissions}>
                                                <Trash2 className="w-4 h-4 mr-2 inline" /> Delete Selected ({selectedSubmissionIds.length})
                                            </Button>
                                        )}

                                        {activeTab === 'visit_reports' && activeService === 'IMNCI' && selectedReportIds.length === 0 && canAddMentorshipData && (
                                            <Button variant="primary" onClick={handleStartNewVisitReport}>Add New IMNCI Visit Report</Button>
                                        )}
                                        {activeTab === 'visit_reports' && activeService === 'EENC' && selectedReportIds.length === 0 && canAddMentorshipData && (
                                            <Button variant="primary" onClick={handleStartNewVisitReport}>Add New EENC Visit Report</Button>
                                        )}
                                        {activeTab === 'visit_reports' && selectedReportIds.length > 0 && canManageMentorship && (
                                             <Button variant="danger" onClick={handleBulkDeleteReports}>
                                                <Trash2 className="w-4 h-4 mr-2 inline" /> Delete Selected ({selectedReportIds.length})
                                            </Button>
                                        )}

                                        {canManageMentorship && ['federal_manager', 'super_user'].includes(permissions?.role) && (
                                            <Button variant="warning" onClick={handlePreviewVisitNumbers} className="bg-amber-500 hover:bg-amber-600 text-white">
                                                Sync Visit Numbers
                                            </Button>
                                        )}

                                        {activeTab === 'skills_list' && canBulkUploadMentorships && selectedSubmissionIds.length === 0 && canManageMentorship && (
                                            <Button onClick={() => setIsBulkUploadModalOpen(true)}>Bulk Upload</Button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        <div>
                            {activeTab === 'skills_list' && !publicDashboardMode && (
                                <MentorshipSubmissionsTable
                                    submissions={filteredSubmissions}
                                    activeService={activeService}
                                    filterServiceType={activeService}
                                    onView={handleViewSubmission}
                                    onEdit={handleEditSubmission}
                                    onDelete={handleDeleteSubmission}
                                    isSubmissionsLoading={isDataCacheLoading.skillMentorshipSubmissions && skillMentorshipSubmissions === null}
                                    stateFilter={stateFilter}
                                    localityFilter={localityFilter}
                                    supervisorFilter={supervisorFilter}
                                    statusFilter={statusFilter}
                                    visitNumberFilter={visitNumberFilter}
                                    facilityFilter={facilityFilter}
                                    workerFilter={workerFilter}
                                    projectFilter={projectFilter}
                                    workerTypeFilter={workerTypeFilter}
                                    dateFilter={dateFilter}
                                    selectedIds={selectedSubmissionIds}
                                    onSelectionChange={setSelectedSubmissionIds}
                                    canManage={canManageMentorship}
                                    currentUserEmail={user?.email}
                                />
                            )}
                            {activeTab === 'mothers_list' && !publicDashboardMode && (
                                <MentorshipSubmissionsTable
                                    submissions={filteredSubmissions}
                                    activeService={activeService}
                                    filterServiceType={`${activeService}_MOTHERS`}
                                    onView={handleViewSubmission}
                                    onEdit={handleEditSubmission}
                                    onDelete={handleDeleteSubmission}
                                    isSubmissionsLoading={isDataCacheLoading.skillMentorshipSubmissions && skillMentorshipSubmissions === null}
                                    stateFilter={stateFilter}
                                    localityFilter={localityFilter}
                                    supervisorFilter={supervisorFilter}
                                    statusFilter={statusFilter}
                                    visitNumberFilter={visitNumberFilter}
                                    facilityFilter={facilityFilter}
                                    workerFilter={workerFilter}
                                    projectFilter={projectFilter}
                                    workerTypeFilter={workerTypeFilter}
                                    dateFilter={dateFilter}
                                    selectedIds={selectedSubmissionIds}
                                    onSelectionChange={setSelectedSubmissionIds}
                                    canManage={canManageMentorship}
                                    currentUserEmail={user?.email}
                                />
                            )}
                            {activeTab === 'visit_reports' && !publicDashboardMode && (
                                <VisitReportsTable
                                    reports={filteredVisitReports}
                                    onEdit={handleEditVisitReport}
                                    onDelete={handleDeleteVisitReport}
                                    onView={handleViewVisitReport} 
                                    selectedIds={selectedReportIds}
                                    onSelectionChange={setSelectedReportIds}
                                    isReportsLoading={activeService === 'IMNCI' ? (isDataCacheLoading.imnciVisitReports && imnciVisitReports === null) : (isDataCacheLoading.eencVisitReports && eencVisitReports === null)}
                                    canManage={canManageMentorship}
                                    currentUserEmail={user?.email}
                                />
                            )}

                            {activeTab === 'dashboard' && (
                                publicLoading ? (
                                    <div className="flex justify-center items-center p-12">
                                        <Spinner />
                                        <span className="ml-3 text-sky-700 font-medium">Loading Dashboard Data...</span>
                                    </div>
                                ) : publicDashboardParams?.isRecordView ? (
                                    <div className="flex flex-col justify-center items-center p-12 text-slate-500 h-[60vh]">
                                        <div className="text-xl font-bold text-sky-800 mb-2">Viewing Individual Record</div>
                                        <p>{(!viewingSubmission && !viewingVisitReport) ? "Record not found or loading..." : "The record details are open in the popup window."}</p>
                                    </div>
                                ) : (
                                    <MentorshipDashboard
                                        allSubmissions={processedSubmissions}
                                        visitReports={processedVisitReports}
                                        STATE_LOCALITIES={dashboardStateLocalities}
                                        activeService={activeService}
                                        isLoading={!publicDashboardMode && (isDataCacheLoading.skillMentorshipSubmissions && skillMentorshipSubmissions === null)}
                                        canEditStatus={permissions?.manageScope === 'federal' || permissions?.canUseFederalManagerAdvancedFeatures}
                                        onUpdateStatus={handleChallengeStatusUpdate}

                                        activeState={activeDashboardState || selectedState}
                                        onStateChange={(value) => {
                                            setActiveDashboardState(value);
                                            setActiveDashboardLocality("");
                                            setActiveDashboardFacilityId("");
                                            setActiveDashboardProject("");
                                            setActiveDashboardWorkerName("");
                                            setActiveDashboardWorkerType("");
                                        }}
                                        activeLocality={activeDashboardLocality || selectedLocality}
                                        onLocalityChange={(value) => {
                                            setActiveDashboardLocality(value);
                                            setActiveDashboardFacilityId("");
                                            setActiveDashboardProject("");
                                            setActiveDashboardWorkerName("");
                                            setActiveDashboardWorkerType("");
                                        }}
                                        activeFacilityId={activeDashboardFacilityId || selectedFacilityId}
                                        onFacilityIdChange={(value) => {
                                            setActiveDashboardFacilityId(value);
                                            setActiveDashboardWorkerName("");
                                            setActiveDashboardWorkerType("");
                                        }}
                                        
                                        activeProject={activeDashboardProject}
                                        onProjectChange={(value) => {
                                            setActiveDashboardProject(value);
                                            setActiveDashboardWorkerName("");
                                            setActiveDashboardWorkerType("");
                                        }}

                                        activeWorkerName={activeDashboardWorkerName || selectedHealthWorkerName}
                                        onWorkerNameChange={(value) => {
                                            setActiveDashboardWorkerName(value);
                                        }}

                                        activeWorkerType={activeDashboardWorkerType || workerTypeFilter}
                                        onWorkerTypeChange={(value) => {
                                            setActiveDashboardWorkerType(value);
                                            setActiveDashboardWorkerName("");
                                        }}
                                        dateFilter={activeDashboardDate}
                                        onDateFilterChange={setActiveDashboardDate}
                                    />
                                )
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
                        onClose={() => {
                            setViewingSubmission(null);
                            if (publicDashboardMode && publicDashboardParams?.isRecordView) {
                                window.close(); 
                            }
                        }}
                    />
                )}
                
                {viewingVisitReport && (
                    <ViewVisitReportModal
                        report={viewingVisitReport}
                        onClose={() => {
                            setViewingVisitReport(null);
                            if (publicDashboardMode && publicDashboardParams?.isRecordView) {
                                window.close(); 
                            }
                        }}
                    />
                )}

                <PreviewSyncModal
                    isOpen={isPreviewSyncModalOpen}
                    onClose={() => {
                        setIsPreviewSyncModalOpen(false);
                        setProposedSyncUpdates([]);
                    }}
                    onConfirm={handleConfirmSync}
                    proposedUpdates={proposedSyncUpdates}
                    isSyncing={isExecutingSync}
                    activeTab={activeTab}
                />
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
                        workerHistory={workerHistory} 
                        
                        canEditVisitNumber={canEditVisitNumber} 
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
                        reports={currentUserVisitReports}
                        onViewSession={handleViewSubmission}
                        onEditSession={handleEditSubmission}
                        onDeleteSession={handleDeleteSubmission}
                        onViewReport={handleViewVisitReport}
                        onEditReport={handleEditVisitReport}
                        canManage={canManageMentorship}
                        userEmail={user?.email}
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
                                    existingSessionData={null}
                                    onCancel={() => {
                                        setIsMothersFormModalOpen(false);
                                    }}
                                    setToast={setToast}
                                    canEditVisitNumber={canEditVisitNumber}
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
                                            visitNumber={visitReportVisitNumber}
                                            onCancel={() => {
                                                setIsVisitReportModalOpen(false);
                                            }}
                                            onSaveSuccess={() => {
                                                fetchIMNCIVisitReports(true);
                                                setIsVisitReportModalOpen(false);
                                            }}
                                            setToast={setToast}
                                            allSubmissions={processedSubmissions}
                                            existingReportData={null}
                                            allVisitReports={processedVisitReports}
                                            canEditVisitNumber={canEditVisitNumber}
                                        />
                                    ) : (
                                        <EENCVisitReport
                                            facility={facilityData}
                                            visitNumber={visitReportVisitNumber}
                                            onCancel={() => {
                                                setIsVisitReportModalOpen(false);
                                            }}
                                            onSaveSuccess={() => {
                                                if(fetchEENCVisitReports) fetchEENCVisitReports(true);
                                                setIsVisitReportModalOpen(false);
                                            }}
                                            setToast={setToast}
                                            allSubmissions={processedSubmissions}
                                            existingReportData={null}
                                            allVisitReports={processedVisitReports}
                                            canEditVisitNumber={canEditVisitNumber}
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
                                    STATE_LOCALITIES={dashboardStateLocalities}
                                    activeService={activeService}
                                    isLoading={isDataCacheLoading.skillMentorshipSubmissions && skillMentorshipSubmissions === null}
                                    canEditStatus={permissions?.manageScope === 'federal' || permissions?.canUseFederalManagerAdvancedFeatures}
                                    onUpdateStatus={handleChallengeStatusUpdate}

                                    activeState={activeDashboardState || selectedState}
                                    onStateChange={(value) => {
                                        setActiveDashboardState(value);
                                        setActiveDashboardLocality("");
                                        setActiveDashboardFacilityId("");
                                        setActiveDashboardProject("");
                                        setActiveDashboardWorkerName("");
                                        setActiveDashboardWorkerType("");
                                    }}
                                    activeLocality={activeDashboardLocality || selectedLocality}
                                    onLocalityChange={(value) => {
                                        setActiveDashboardLocality(value);
                                        setActiveDashboardFacilityId("");
                                        setActiveDashboardProject("");
                                        setActiveDashboardWorkerName("");
                                        setActiveDashboardWorkerType("");
                                    }}
                                    activeFacilityId={activeDashboardFacilityId || selectedFacilityId}
                                    onFacilityIdChange={(value) => {
                                        setActiveDashboardFacilityId(value);
                                        setActiveDashboardWorkerName("");
                                        setActiveDashboardWorkerType("");
                                    }}
                                    
                                    activeProject={activeDashboardProject}
                                    onProjectChange={(value) => {
                                        setActiveDashboardProject(value);
                                        setActiveDashboardWorkerName("");
                                        setActiveDashboardWorkerType("");
                                    }}

                                    activeWorkerName={activeDashboardWorkerName || selectedHealthWorkerName}
                                    onWorkerNameChange={(value) => {
                                        setActiveDashboardWorkerName(value);
                                    }}

                                    activeWorkerType={activeDashboardWorkerType || workerTypeFilter}
                                    onWorkerTypeChange={(value) => {
                                        setActiveDashboardWorkerType(value);
                                        setActiveDashboardWorkerName("");
                                    }}
                                    dateFilter={activeDashboardDate}
                                    onDateFilterChange={setActiveDashboardDate}
                                />
                            </div>
                        </Modal>
                    )}
                    
                    {isTrainingPrioritiesModalOpen && (
                        <TrainingPrioritiesModal
                            isOpen={isTrainingPrioritiesModalOpen}
                            onClose={handlePostSaveClose}
                            onSelect={lastSavedSessionData ? handlePostSaveSelect : null}
                            currentSessionData={lastSavedSessionData}
                            historicalSessions={workerHistory.filter(s => !lastSavedSessionData || s.sessionDate !== lastSavedSessionData.sessionDate)}
                            healthWorkerName={lastSavedFacilityInfo?.healthWorkerName || selectedHealthWorkerName}
                        />
                    )}
                    
                    <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
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
                        workerHistory={workerHistory}
                        canEditVisitNumber={canEditVisitNumber}
                    />
                    
                    {isTrainingPrioritiesModalOpen && (
                        <TrainingPrioritiesModal
                            isOpen={isTrainingPrioritiesModalOpen}
                            onClose={handlePostSaveClose}
                            onSelect={lastSavedSessionData ? handlePostSaveSelect : null}
                            currentSessionData={lastSavedSessionData}
                            historicalSessions={workerHistory.filter(s => !lastSavedSessionData || s.sessionDate !== lastSavedSessionData.sessionDate)}
                            healthWorkerName={lastSavedFacilityInfo?.healthWorkerName || selectedHealthWorkerName}
                        />
                    )}
                    
                    <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
                </>
            );
        }
    }
    
     if (currentView === 'form_setup' && activeFormType === 'mothers_form' && (isReadyToStart && selectedFacility) && activeService && !isAddWorkerModalOpen && !isWorkerInfoChanged) {
        
        if (activeService === 'IMNCI') {
            return (
                <>
                    <MothersForm
                        facility={facilityData}
                        visitNumber={motherVisitNumber}
                        existingSessionData={editingSubmission}
                        onCancel={() => handleGenericFormExit('mothers_list')}
                        setToast={setToast}
                        canEditVisitNumber={canEditVisitNumber}
                    />
                    <MobileFormNavBar
                        activeFormType={activeFormType}
                        draftCount={currentUserDrafts.length}
                        onNavClick={handleMobileNavClick}
                    />
                    
                    <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
                </>
            );
        }
        else if (activeService === 'EENC') {
            return (
                <>
                    <EENCMothersForm
                        facility={facilityData}
                        visitNumber={motherVisitNumber}
                        existingSessionData={editingSubmission}
                        onCancel={() => handleGenericFormExit('mothers_list')}
                        setToast={setToast}
                        canEditVisitNumber={canEditVisitNumber}
                    />
                    
                    <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
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
                        visitNumber={visitReportVisitNumber}
                        onCancel={() => handleGenericFormExit('visit_reports')}
                        onSaveSuccess={() => {
                            if (activeService === 'IMNCI') fetchIMNCIVisitReports(true);
                            if (activeService === 'EENC' && fetchEENCVisitReports) fetchEENCVisitReports(true);
                            handleGenericFormExit('visit_reports');
                        }}
                        setToast={setToast}
                        allSubmissions={processedSubmissions}
                        existingReportData={editingSubmission}
                        allVisitReports={processedVisitReports}
                        canEditVisitNumber={canEditVisitNumber}
                    />
                </Suspense>
                {isVisitReportModalOpen && (
                    <Modal isOpen={isVisitReportModalOpen} onClose={() => setIsVisitReportModalOpen(false)}>
                        <div className="p-4">Visit Report is already open.</div>
                    </Modal>
                )}
                {isMothersFormModalOpen && facilityData && <Modal isOpen={isMothersFormModalOpen} onClose={() => setIsMothersFormModalOpen(false)} title="استبيان الأم" size="full"><div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto"><MothersForm facility={facilityData} visitNumber={motherVisitNumber} existingSessionData={null} onCancel={() => { setIsMothersFormModalOpen(false); }} setToast={setToast} canEditVisitNumber={canEditVisitNumber} /></div></Modal>}
                <MobileFormNavBar
                    activeFormType={activeFormType}
                    draftCount={currentUserDrafts.length}
                    onNavClick={handleMobileNavClick}
                 />
                 
                <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
            </>
        );
    }

    const isStateFilterDisabled = !publicSubmissionMode && !publicDashboardMode && userStates && userStates.length === 1;
    const isLocalityFilterDisabled = (publicSubmissionMode || publicDashboardMode) ? !selectedState : (isLocalityManager || !selectedState);

    if (currentView === 'form_setup') {
        const serviceTitleArabic = activeService === 'EENC' 
            ? "الاشراف التدريبي الداعم على الرعاية الضرورية المبكرة (EENC)"
            : "الاشراف التدريبي الداعم على تطبيق العلاج المتكامل للاطفال اقل من 5 سنوات";
        
        const isSkillsAssessmentSetup = activeFormType === 'skills_assessment';
        const isVisitReportSetup = activeFormType === 'visit_report';
        const isMothersFormSetup = activeFormType === 'mothers_form';
        const isFacilityUpdateSetup = activeFormType === 'facility_update';
        
        let setupTitle = '';
        if (isSkillsAssessmentSetup) {
            setupTitle = editingSubmission ? `تعديل جلسة: ${serviceTitleArabic}` : `إدخال بيانات: ${serviceTitleArabic}`;
        } else if (isVisitReportSetup) {
            setupTitle = editingSubmission ? (activeService === 'EENC' ? 'تعديل تقرير زيارة EENC' : 'تعديل تقرير الزيارة') : (activeService === 'EENC' ? 'إدخال تقرير زيارة EENC' : 'إدخال تقرير زيارة جديد');
        } else if (isMothersFormSetup) {
            setupTitle = editingSubmission ? (activeService === 'EENC' ? 'تعديل استبيان الأم (EENC)' : 'تعديل استبيان الأم') : (activeService === 'EENC' ? 'نموذج استبيان الأم (EENC)' : 'نموذج استبيان الأم (IMNCI)');
        } else if (isFacilityUpdateSetup) {
            setupTitle = 'تحديث بيانات المؤسسة الصحية';
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
                                         {(!publicSubmissionMode && !publicDashboardMode && isLocalityManager) ? (
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
                            <div className="flex gap-2 flex-wrap justify-end w-full">
                                <Button 
                                    onClick={handleBackToMainMenu}
                                    variant="secondary"
                                    disabled={isFacilitiesLoading}
                                >
                                    إلغاء والعودة
                                </Button>
                                
                                {isSkillsAssessmentSetup && selectedHealthWorkerName && (
                                    <Button 
                                        type="button" 
                                        variant="warning"
                                        onClick={() => {
                                            setLastSavedSessionData(null);
                                            setIsTrainingPrioritiesModalOpen(true);
                                        }}
                                        disabled={isFacilitiesLoading || workerHistory.length === 0}
                                        title={workerHistory.length === 0 ? "لا توجد جلسات سابقة لعرض الأولويات" : "عرض أولويات التدريب للعامل بناءً على التقييمات السابقة"}
                                        className="ml-auto"
                                    >
                                        أولويات التدريب (للعامل الصحي)
                                    </Button>
                                )}

                                <Button
                                    onClick={handleProceedToForm}
                                    disabled={!selectedFacilityId || (isSkillsAssessmentSetup && !selectedHealthWorkerName) || isFacilitiesLoading || isWorkerInfoChanged}
                                    variant="primary"
                                >
                                    {isSkillsAssessmentSetup ? 'بدء جلسة الاشراف' : 
                                     (isVisitReportSetup ? (activeService === 'EENC' ? 'بدء تقرير زيارة EENC' : 'بدء تقرير زيارة') : 
                                     (isFacilityUpdateSetup ? 'تحديث بيانات المنشأة' : 'بدء استبيان الأم'))}
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
                            <Button type="button" variant="secondary" onClick={handleBackToMainMenu} disabled={isFacilitiesLoading} size="sm">
                                إلغاء
                            </Button>
                            
                            <Button 
                                type="button" 
                                onClick={handleProceedToForm}
                                disabled={!selectedFacilityId || (isSkillsAssessmentSetup && !selectedHealthWorkerName) || isFacilitiesLoading || isWorkerInfoChanged}
                                title={!selectedFacilityId ? "Select facility" : (isSkillsAssessmentSetup && !selectedHealthWorkerName ? "Select health worker" : "Start Session")}
                                size="sm"
                            >
                                {isSkillsAssessmentSetup ? 'بدء الجلسة' : 
                                 (isVisitReportSetup ? (activeService === 'EENC' ? 'بدء تقرير EENC' : 'بدء التقرير') : 
                                 (isFacilityUpdateSetup ? 'تحديث منشأة' : 'بدء الاستبيان'))}
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
                    reports={currentUserVisitReports}
                    onViewSession={handleViewSubmission}
                    onEditSession={handleEditSubmission}
                    onDeleteSession={handleDeleteSubmission}
                    onViewReport={handleViewVisitReport}
                    onEditReport={handleEditVisitReport}
                    canManage={canManageMentorship}
                    userEmail={user?.email}
                 />
                 {viewingSubmission && (
                    <ViewSubmissionModal
                        submission={viewingSubmission}
                        onClose={() => setViewingSubmission(null)}
                    />
                 )}
                
                {isTrainingPrioritiesModalOpen && (
                    <TrainingPrioritiesModal
                        isOpen={isTrainingPrioritiesModalOpen}
                        onClose={handlePostSaveClose}
                        onSelect={lastSavedSessionData ? handlePostSaveSelect : null}
                        currentSessionData={lastSavedSessionData}
                        historicalSessions={workerHistory.filter(s => !lastSavedSessionData || s.sessionDate !== lastSavedSessionData.sessionDate)}
                        healthWorkerName={lastSavedFacilityInfo?.healthWorkerName || selectedHealthWorkerName}
                    />
                )}

                {isStandaloneFacilityModalOpen && selectedFacility && (
                    <Modal 
                        isOpen={isStandaloneFacilityModalOpen} 
                        onClose={() => setIsStandaloneFacilityModalOpen(false)} 
                        title={`بيانات منشأة: ${selectedFacility['اسم_المؤسسة'] || ''}`}
                        size="full"
                    >
                        <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                            <GenericFacilityForm
                                initialData={selectedFacility}
                                onSave={async (formData) => {
                                    try {
                                        await submitFacilityDataForApproval(formData);
                                        setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
                                        setStatusAction('standaloneFacility');
                                    } catch (error) {
                                        setStatusData({ status: 'error', message: error.message });
                                    }
                                }}
                                onCancel={() => setIsStandaloneFacilityModalOpen(false)}
                                setToast={setToast}
                                title="تحديث بيانات المنشأة"
                                subtitle={`المنشأة: ${selectedFacility['اسم_المؤسسة']}`}
                                isPublicForm={false}
                                saveButtonText="إرسال التحديث للموافقة"
                                cancelButtonText="إغلاق"
                            >
                                {(props) => <IMNCIFormFields {...props} />}
                            </GenericFacilityForm>
                        </div>
                    </Modal>
                )}

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
                                existingSessionData={null} 
                                onCancel={() => { 
                                    setIsMothersFormModalOpen(false);
                                }}
                                setToast={setToast}
                                canEditVisitNumber={canEditVisitNumber} 
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
                                        visitNumber={visitReportVisitNumber}
                                        onCancel={() => {
                                            setIsVisitReportModalOpen(false);
                                        }}
                                        onSaveSuccess={() => {
                                            fetchIMNCIVisitReports(true);
                                            setIsVisitReportModalOpen(false);
                                        }}
                                        setToast={setToast}
                                        allSubmissions={processedSubmissions}
                                        existingReportData={null}
                                        allVisitReports={processedVisitReports}
                                        canEditVisitNumber={canEditVisitNumber} 
                                    />
                                ) : (
                                    <EENCVisitReport
                                        facility={selectedFacility}
                                        visitNumber={visitReportVisitNumber}
                                        onCancel={() => {
                                            setIsVisitReportModalOpen(false);
                                        }}
                                        onSaveSuccess={() => {
                                            if (fetchEENCVisitReports) fetchEENCVisitReports(true);
                                            setIsVisitReportModalOpen(false);
                                        }}
                                        setToast={setToast}
                                        allSubmissions={processedSubmissions}
                                        existingReportData={null}
                                        allVisitReports={processedVisitReports}
                                        canEditVisitNumber={canEditVisitNumber}
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
                                STATE_LOCALITIES={dashboardStateLocalities}
                                activeService={activeService}
                                isLoading={isDataCacheLoading.skillMentorshipSubmissions && skillMentorshipSubmissions === null}
                                canEditStatus={permissions?.manageScope === 'federal' || permissions?.canUseFederalManagerAdvancedFeatures}
                                onUpdateStatus={handleChallengeStatusUpdate}

                                activeState={activeDashboardState}
                                onStateChange={(value) => {
                                    setActiveDashboardState(value);
                                    setActiveDashboardLocality("");
                                    setActiveDashboardFacilityId("");
                                    setActiveDashboardProject("");
                                    setActiveDashboardWorkerName("");
                                    setActiveDashboardWorkerType("");
                                }}
                                activeLocality={activeDashboardLocality}
                                onLocalityChange={(value) => {
                                    setActiveDashboardLocality(value);
                                    setActiveDashboardFacilityId("");
                                    setActiveDashboardProject("");
                                    setActiveDashboardWorkerName("");
                                    setActiveDashboardWorkerType("");
                                }}
                                activeFacilityId={activeDashboardFacilityId}
                                onFacilityIdChange={(value) => {
                                    setActiveDashboardFacilityId(value);
                                    setActiveDashboardWorkerName("");
                                    setActiveDashboardWorkerType("");
                                }}
                                
                                activeProject={activeDashboardProject}
                                onProjectChange={(value) => {
                                    setActiveDashboardProject(value);
                                    setActiveDashboardWorkerName("");
                                    setActiveDashboardWorkerType("");
                                }}

                                 activeWorkerName={activeDashboardWorkerName}
                                onWorkerNameChange={(value) => {
                                    setActiveDashboardWorkerName(value);
                                }}

                                activeWorkerType={activeDashboardWorkerType}
                                onWorkerTypeChange={(value) => {
                                    setActiveDashboardWorkerType(value);
                                    setActiveDashboardWorkerName("");
                                }}
                                dateFilter={activeDashboardDate}
                                onDateFilterChange={setActiveDashboardDate}
                            />
                        </div>
                    </Modal>
                )}

                <MobileFormNavBar
                    activeFormType={activeFormType}
                    draftCount={currentUserDrafts.length}
                    onNavClick={handleMobileNavClick}
                 />

                 <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
            </>
        );
    }

    return null;
};

export default function SkillsMentorshipViewWrapper(props) {
    return (
        <LanguageProvider>
            <SkillsMentorshipView {...props} />
        </LanguageProvider>
    );
}