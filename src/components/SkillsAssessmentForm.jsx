// SkillsAssessmentForm.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { saveMentorshipSession } from "../data.js";
// --- FIX: Import Timestamp ---
import { Timestamp } from 'firebase/firestore';
// --- END FIX ---
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox,
    Modal // <-- ADDED
} from './CommonComponents';
import { getAuth } from "firebase/auth";

// --- ADD NEW IMPORTS ---
import { GenericFacilityForm, IMNCIFormFields } from './FacilityForms.jsx';
import { submitFacilityDataForApproval } from "../data.js";
// --- END NEW IMPORTS ---

// --- Single Skill Checklist Item (Ensure score circle has space and text wraps) ---
const SkillChecklistItem = ({ label, value, onChange, name, showNaOption = true, naLabel = "لا ينطبق", isMainSymptom = false, scoreCircle = null }) => {
    const handleChange = (e) => { onChange(name, e.target.value); };

    const containerClasses = isMainSymptom
        ? "flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-sky-700 text-white rounded-t-md"
        : "flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-md bg-white shadow-sm transition-all hover:shadow-md sm:mr-4"; // sm:mr-4 provides space on the right in RTL

    const labelClasses = isMainSymptom
        ? "text-sm font-bold mb-2 sm:mb-0 text-right flex items-start sm:items-center flex-grow mr-4" // MODIFICATION: items-start/sm:items-center, Removed min-w-0
        : "text-sm font-medium text-gray-800 mb-2 sm:mb-0 text-right flex items-start sm:items-center flex-grow mr-4"; // MODIFICATION: items-start/sm:items-center, Removed min-w-0

    return (
        <div dir="rtl" className={containerClasses}>
            {/* Label and Score Circle Container */}
            <span className={labelClasses}>
                {/* Score Circle - rendered first in RTL */}
                {/* MODIFICATION: Added self-start/sm:self-auto */}
                {scoreCircle && <span className="ml-2 flex-shrink-0 self-start sm:self-auto">{scoreCircle}</span>} 
                {/* Label Text */}
                {/* MODIFICATION: Added w-full on small screens to ensure full width for wrapping */}
                <span className="w-full sm:w-auto break-words sm:whitespace-nowrap">{label}</span> 
            </span>

            {/* Radio Buttons - Moved below the label on small screen using flex-col in parent and mt-2 here */}
            <div className="flex gap-4 flex-shrink-0 mt-2 sm:mt-0"> 
                <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input type="radio" name={name} value="yes" checked={value === 'yes'} onChange={handleChange} className="form-radio text-green-600" /> نعم
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input type="radio" name={name} value="no" checked={value === 'no'} onChange={handleChange} className="form-radio text-red-600" /> لا
                </label>
                {showNaOption && (
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                        <input type="radio" name={name} value="na" checked={value === 'na'} onChange={handleChange} className="form-radio text-gray-500" /> {naLabel}
                    </label>
                )}
            </div>
        </div>
    );
};


// --- Score Circle Component (Ensured flex-shrink-0) ---
const ScoreCircle = ({ score, maxScore }) => {
    if (maxScore === null || maxScore === undefined || score === null || score === undefined) {
        return null;
    }

    let percentage;
    if (maxScore === 0) {
        percentage = (score === 0) ? 100 : 0; // If max is 0, score 0 means 100% (nothing applicable)
    } else {
        percentage = Math.round((score / maxScore) * 100);
    }

    let bgColor = 'bg-gray-400';
    if (maxScore > 0) {
        if (percentage >= 80) {
            bgColor = 'bg-green-600';
        } else if (percentage >= 50) {
            bgColor = 'bg-yellow-500';
        } else {
            bgColor = 'bg-red-600';
        }
    } else if (maxScore === 0) {
         bgColor = 'bg-green-600'; // Or gray if you prefer N/A look
    }

    // --- MODIFICATION: Added flex-shrink-0 ---
    return (
        <div
            className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-white font-bold text-xs shadow-md`}
            title={`${score} / ${maxScore} (${maxScore > 0 ? percentage + '%' : 'N/A'})`}
        >
            {maxScore === 0 ? 'N/A' : `${percentage}%`}
        </div>
    );
    // --- END MODIFICATION ---
};

// --- New Sticky Overall Score Component (Unchanged) ---
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

// --- Helper function to evaluate the relevance logic (Unchanged from File 1) ---
const evaluateRelevance = (relevanceString, formData) => {
    if (!relevanceString) return true;
    const logicRegex = /\$\{(.*?)\}='(.*?)'/;
    const match = relevanceString.match(logicRegex);
    if (!match) {
        console.warn("Could not parse relevance string:", relevanceString);
        return true; // Default to relevant
    }
    const [, varName, expectedValue] = match;
    // Enhanced value finding
    let actualValue = formData[varName]
        ?? formData.assessment_skills?.[varName]
        ?? formData.treatment_skills?.[varName]
        ?? (varName === 'decisionMatches' ? formData.decisionMatches : undefined);
    // Specific lookups if still undefined
    if (actualValue === undefined && varName.startsWith('as_')) actualValue = formData.assessment_skills?.[varName.replace('as_','')];
    if (actualValue === undefined && varName.startsWith('ts_')) actualValue = formData.treatment_skills?.[varName.replace('ts_','')];

    // Handle yes/no/na separately if needed, otherwise direct compare
    if (expectedValue.toLowerCase() === 'yes') return actualValue === 'yes';
    if (expectedValue.toLowerCase() === 'no') return actualValue === 'no';
    if (expectedValue.toLowerCase() === 'na') return actualValue === 'na';

    return actualValue === expectedValue;
};


// --- Form Structure (Unchanged) ---
const IMNCI_FORM_STRUCTURE = [
    {
        group: 'تقييم مهارات التقييم والتصنيف',
        sectionKey: 'assessment_skills',
        subgroups: [
            { subgroupTitle: 'القياسات الجسمانية والحيوية', step: 1, scoreKey: 'vitalSigns', maxScore: 3, skills: [ { key: 'skill_weight', label: 'وزن الطفل بصورة صحيحة' }, { key: 'skill_temp', label: 'قياس درجة الطفل بصورة صحيحة' }, { key: 'skill_height', label: 'قياس طول / ارتفاع الطفل بصورة صحيحة' }, ] },
            { subgroupTitle: 'قيم علامات الخطورة العامة بصورة صحيحة', step: 2, scoreKey: 'dangerSigns', maxScore: 4, skills: [ { key: 'skill_ds_drink', label: 'هل سأل وتأكد من علامة الخطورة : لا يستطيع ان يرضع أو يشرب' }, { key: 'skill_ds_vomit', label: 'هل سأل وتأكد من علامة الخطورة : يتقيأ كل شئ' }, { key: 'skill_ds_convulsion', label: 'هل سأل وتأكد من علامة الخطورة : تشنجات أثناء المرض الحالي' }, { key: 'skill_ds_conscious', label: 'هل تأكد من علامة الخطورة : حامل أو فاقد للوعي' }, ] },
            { subgroupTitle: 'قيم الطفل بصورة صحيحة لوجود كل الأعراض الأساسية', step: 3, scoreKey: 'mainSymptoms', maxScore: 12, isSymptomGroupContainer: true, symptomGroups: [
                { mainSkill: { key: 'skill_ask_cough', label: 'هل سأل عن وجود الكحة أو ضيق التنفس', scoreKey: 'symptom_cough' } },
                { mainSkill: { key: 'skill_ask_diarrhea', label: 'هل سأل عن وجود الاسهال', scoreKey: 'symptom_diarrhea' } },
                { mainSkill: { key: 'skill_ask_fever', label: 'هل سأل عن وجود الحمى', scoreKey: 'symptom_fever' } },
                { mainSkill: { key: 'skill_ask_ear', label: 'هل سأل عن وجود مشكلة في الأذن', scoreKey: 'symptom_ear' } },
            ] },
            { subgroupTitle: 'تحرى عن سوء التغذية الحاد', step: 4, scoreKey: 'malnutrition', maxScore: 3, skills: [ { key: 'skill_mal_muac', label: 'هل قاس المواك بصورة صحيحة' }, { key: 'skill_mal_wfh', label: 'هل قاس نسبة الوزن للطول أو الارتفاع بصورة صحيحة' }, { key: 'skill_mal_classify', label: 'هل صنف الحالة التغذوية بصورة صحيحة' }, ] },
            { subgroupTitle: 'تحرى عن الانيميا', step: 5, scoreKey: 'anemia', maxScore: 2, skills: [ { key: 'skill_anemia_pallor', label: 'هل فحص شحوب الكف بصورة صحيحة' }, { key: 'skill_anemia_classify', label: 'هل صنف الانيميا بصورة صحيحة' }, ] },
            { subgroupTitle: 'تحرى عن التطعيم وفيتامين أ بصورة صحيحة', step: 6, scoreKey: 'immunization', maxScore: 2, skills: [ { key: 'skill_imm_vacc', label: 'هل تحرى عن التطعيمات بصورة صحيحة' }, { key: 'skill_imm_vita', label: 'هل تحرى عن فيتامين أ بصورة صحيحة' }, ] },
            { subgroupTitle: 'تحرى عن الأمراض الأخرى', step: 7, scoreKey: 'otherProblems', maxScore: 1, skills: [ { key: 'skill_other', label: 'هل تحرى عن الأمراض الأخرى' }, ] }
        ]
    },
    { group: 'القرار النهائي', step: 8, scoreKey: 'finalDecision', maxScore: 1, isDecisionSection: true, sectionKey: null, subgroups: [] },
    {
        group: 'تقييم مهارات العلاج والنصح', step: 9, scoreKey: 'treatment', maxScore: null, // Max score calculated dynamically
        sectionKey: 'treatment_skills',
        subgroups: [
            {
                subgroupTitle: 'الحالات التي تحتاج لتحويل ، تم تحويلها',
                scoreKey: 'ref_treatment',
                skills: [
                    { key: 'skill_ref_abx', label: 'هل أعطى الجرعة الاولى من المضاد الحيوي المناسب قبل تحويل الطفل' },
                    {
                        key: 'skill_ref_quinine',
                        label: 'في حالة التحويل : أعطى الكينيين بالعضل قبل التحويل',
                        relevant: (formData) => { // Only relevant if effective fever classification is 'مرض حمي شديد'
                            const didClassifyCorrectly = formData.assessment_skills.skill_classify_fever === 'yes';
                            const workerCls = formData.assessment_skills.worker_fever_classification || {};
                            const supervisorCls = formData.assessment_skills.supervisor_correct_fever_classification || {};
                            const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                            return effectiveCls && effectiveCls['مرض حمي شديد'];
                        }
                    },
                ],
                relevant: (formData) => {
                    return formData.finalDecision === 'referral' && formData.decisionMatches === 'yes';
                }
            },
            {
                subgroupTitle: 'في حالة الإلتهاب الرئوي',
                scoreKey: 'pneu_treatment',
                skills: [ { key: 'skill_pneu_abx', label: 'هل وصف مضاد حيوي لعلاج الالتهاب الرئوي بصورة صحيحة' }, { key: 'skill_pneu_dose', label: 'هل أعطى الجrعة الأولى من مضاد حيوي لعلاج الالتهاب الرئوي بالعيادة بصورة صحيحة', relevant: "${skill_pneu_abx}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification is 'التهاب رئوي'
                    // --- START FIX ---
                    if (formData.finalDecision !== 'treatment') return false;
                    // --- END FIX ---
                    const didClassifyCorrectly = formData.assessment_skills.skill_classify_cough === 'yes';
                    const workerClassification = formData.assessment_skills.worker_cough_classification;
                    const supervisorClassification = formData.assessment_skills.supervisor_correct_cough_classification;
                    const effectiveCls = didClassifyCorrectly ? workerClassification : supervisorClassification;
                    return effectiveCls === 'التهاب رئوي';
                }
            },
            {
                subgroupTitle: 'في حالة الإسهال',
                scoreKey: 'diar_treatment',
                skills: [ { key: 'skill_diar_ors', label: 'هل حدد كمية محلول الإرواء بصورة صحيحة' }, { key: 'skill_diar_counsel', label: 'هل نصح الأم بالرعاية المنزلية بإعطاء سوائل أكثر و الاستمرار في تغذية الطفل)' }, { key: 'skill_diar_zinc', label: 'هل وصف دواء الزنك بصورة صحيحة' }, { key: 'skill_diar_zinc_dose', label: 'هل أعطى الجrعة الأولى من دواء الزنك للطفل بالوحدة الصحية بطريقة صحيحة', relevant: "${skill_diar_zinc}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification includes relevant keys (including 'لا يوجد جفاف')
                    // --- START FIX ---
                    if (formData.finalDecision !== 'treatment') return false;
                    // --- END FIX ---
                    const didClassifyCorrectly = formData.assessment_skills.skill_classify_diarrhea === 'yes';
                    const workerCls = formData.assessment_skills.worker_diarrhea_classification || {};
                    const supervisorCls = formData.assessment_skills.supervisor_correct_diarrhea_classification || {};
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    const relevantKeys = ['جفاف شديد', 'بعض الجفاف', 'إسهال مستمر شديد', 'إسهال مستمر', 'دسنتاريا', 'لا يوجد جفاف'];
                    return relevantKeys.some(key => effectiveCls[key]);
                }
            },
            {
                subgroupTitle: 'في حالة الدسنتاريا',
                scoreKey: 'dyst_treatment',
                skills: [ { key: 'skill_dyst_abx', label: 'هل وصف مضاد حيوي لعلاج الدسنتاريا بصورة صحيحة' }, { key: 'skill_dyst_dose', label: 'هل أعطى الجrعة الأولى من مضاد حيوي لعلاج الدسنتارIA في العيادة بصورة صحيحة', relevant: "${skill_dyst_abx}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification includes 'دسنتاريا'
                    // --- START FIX ---
                    if (formData.finalDecision !== 'treatment') return false;
                    // --- END FIX ---
                    const didClassifyCorrectly = formData.assessment_skills.skill_classify_diarrhea === 'yes';
                    const workerCls = formData.assessment_skills.worker_diarrhea_classification || {};
                    const supervisorCls = formData.assessment_skills.supervisor_correct_diarrhea_classification || {};
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return !!effectiveCls['دسنتاريا'];
                }
            },
            {
                subgroupTitle: 'في حالة الملاريا',
                scoreKey: 'mal_treatment',
                skills: [ { key: 'skill_mal_meds', label: 'هل وصف دواء لعلاج الملاريا بصورة صحيحة' }, { key: 'skill_mal_dose', label: 'هل أعطى الجrعة الأولى من الدواء لعلاج الملاريا في العيادة بصورة صحيحة', relevant: "${skill_mal_meds}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification includes 'ملاريا'
                    // --- START FIX ---
                    if (formData.finalDecision !== 'treatment') return false;
                    // --- END FIX ---
                    const didClassifyCorrectly = formData.assessment_skills.skill_classify_fever === 'yes';
                    const workerCls = formData.assessment_skills.worker_fever_classification || {};
                    const supervisorCls = formData.assessment_skills.supervisor_correct_fever_classification || {};
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return !!effectiveCls['ملاريا']; // Strict check for 'ملاريا' only
                }
            },
            {
                subgroupTitle: 'في حالة التهاب الأذن',
                scoreKey: 'ear_treatment',
                skills: [ { key: 'skill_ear_abx', label: 'هل وصف مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة' }, { key: 'skill_ear_dose', label: 'هل أعطى الجrعة الأولى من مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة', relevant: "${skill_ear_abx}='yes'" }, { key: 'skill_ear_para', label: 'هل وصف دواء الباراسيتامول بصورة صحيحة' }, { key: 'skill_ear_para_dose', label: 'هل أعطى الجrعة الأولى من الباراسيتامول بصورة صحيحة', relevant: "${skill_ear_para}='yes'" }, ],
                // --- START CORRECTION: Added hamza (أ) to match classification constants ---
                relevant: (formData) => { // Show if effective classification is 'التهاب اذن حاد' or 'التهاب اذن مزمن'
                    // --- START FIX ---
                    if (formData.finalDecision !== 'treatment') return false;
                    // --- END FIX ---
                    const didClassifyCorrectly = formData.assessment_skills.skill_classify_ear === 'yes';
                    const workerCls = formData.assessment_skills.worker_ear_classification;
                    const supervisorCls = formData.assessment_skills.supervisor_correct_ear_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return ['التهاب العظمة خلف الاذن', 'التهاب أذن حاد', 'التهاب أذن مزمن'].includes(effectiveCls);
                }
                // --- END CORRECTION ---
            },
            {
                subgroupTitle: 'في حالة سوء التغذية',
                scoreKey: 'nut_treatment',
                skills: [
                    {
                        key: 'skill_nut_refer_otp',
                        label: 'هل حول الطفل الى مركز المعالجة الخارجي OTP',
                        relevant: (formData) => {
                            const didClassifyCorrectly = formData.assessment_skills.skill_mal_classify === 'yes';
                            const workerCls = formData.assessment_skills.worker_malnutrition_classification;
                            const supervisorCls = formData.assessment_skills.supervisor_correct_malnutrition_classification;
                            const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                            // Show for MAM and SAM without complications, hide for SAM with complications
                            return ['سوء تغذية شديد غير مصحوب بمضاعفات', 'سوء تغذية حاد متوسط'].includes(effectiveCls);
                        }
                    },
                    { key: 'skill_nut_assess', label: 'قيم تغذية الطفل بما في ذلك مشاكل الرضاعة (لأقل من عمر سنتين)' }, { key: 'skill_nut_counsel', label: 'أرشد الأم عن تغذية الطفل بما في ذلك مشاكل الرضاعة الأقل من عمر سنتين)' },
                ],
                relevant: (formData) => { // Show if effective classification is SAM or MAM
                    // --- START FIX ---
                    if (formData.finalDecision !== 'treatment') return false;
                    // --- END FIX ---
                    const didClassifyCorrectly = formData.assessment_skills.skill_mal_classify === 'yes';
                    const workerCls = formData.assessment_skills.worker_malnutrition_classification;
                    const supervisorCls = formData.assessment_skills.supervisor_correct_malnutrition_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return ['سوء تغذية شديد غير مصحوب بمضاعفات', 'سوء تغذية حاد متوسط'].includes(effectiveCls);
                }
            },
            {
                subgroupTitle: 'في حالة فقر الدم',
                scoreKey: 'anemia_treatment',
                skills: [ { key: 'skill_anemia_iron', label: 'هل وصف شراب حديد بصورة صحيحة' }, { key: 'skill_anemia_iron_dose', label: 'هل أعطى الجrعة الأولى من شراب حديد بصورة صحيحة', relevant: "${skill_anemia_iron}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification is 'فقر دم'
                    // --- START FIX ---
                    if (formData.finalDecision !== 'treatment') return false;
                    // --- END FIX ---
                    const didClassifyCorrectly = formData.assessment_skills.skill_anemia_classify === 'yes';
                    const workerCls = formData.assessment_skills.worker_anemia_classification;
                    const supervisorCls = formData.assessment_skills.supervisor_correct_anemia_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return effectiveCls === 'فقر دم'; // Strict check
                }
            },
            { subgroupTitle: 'نصح الأم متى تعود للمتابعة',
                scoreKey: 'fu_treatment',
                skills: [ { key: 'skill_fu_when', label: 'هل ذكر لها علامتين علي الأقل إذا ظهرت على الطفل يجب أن تعود به فورا للوحدة الصحية' }, { key: 'skill_fu_return', label: 'هل حدد للام متى تعود بالطفل' }, ]
                // --- START FIX ---
                ,
                relevant: (formData) => {
                    return formData.finalDecision === 'treatment';
                }
                // --- END FIX ---
            }
        ]
    }
];

// --- Classification Constants (Unchanged) ---
const COUGH_CLASSIFICATIONS = ["التهاب رئوي شديد أو مرض شديد جدا", "التهاب رئوي", "كحة أو نزلة برد"];
const DIARRHEA_CLASSIFICATIONS = ["جفاف شديد", "بعض الجفاف", "لا يوجد جفاف", "إسهال مستمر شديد", "إسهال مستمر", "دسنتاريا"];
const DIARRHEA_COLS_1 = ["جفاف شديد", "بعض الجفاف", "لا يوجد جفاف"];
const DIARRHEA_COLS_2 = ["إسهال مستمر شديد", "إسهال مستمر", "دسنتاريا"];
const FEVER_CLASSIFICATIONS = ["مرض حمي شديد", "ملاريا", "حمى لا توجد ملاريا", "حصبة مصحوبة بمضاعفات شديدة", "حصبة مصحوبة بمضاعفات في العين والفم", "حصبة"];
const FEVER_COLS_1 = ["مرض حمي شديد", "ملاريا", "حمى لا توجد ملاريا"];
const FEVER_COLS_2 = ["حصبة مصحوبة بمضاعفات شديدة", "حصبة مصحوبة بمضاعفات في العين والفم", "حصبة"];
const EAR_CLASSIFICATIONS = ["التهاب العظمة خلف الاذن", "التهاب أذن حاد", "التهاب أذن مزمن", "لا يوجد التهاب أذن"];
const MALNUTRITION_CLASSIFICATIONS = ["سوء تغذية شديد مصحوب بمضاعفات", "سوء تغذية شديد غير مصحوب بمضاعفات", "سوء تغذية حاد متوسط", "لا يوجد سوء تغذية"];
const ANEMIA_CLASSIFICATIONS = ["فقر دم شديد", "فقر دم", "لا يوجد فقر دم"];

// Helper for initial state (Unchanged)
const createInitialClassificationState = (classifications) => classifications.reduce((acc, c) => { acc[c] = false; return acc; }, {});

// --- Initial Form Data setup (Unchanged) ---
const getInitialFormData = () => {
    const initialState = {
        session_date: new Date().toISOString().split('T')[0], notes: '', assessment_skills: { supervisor_confirms_cough: '', worker_cough_classification: '', supervisor_correct_cough_classification: '', supervisor_confirms_diarrhea: '', worker_diarrhea_classification: createInitialClassificationState(DIARRHEA_CLASSIFICATIONS), supervisor_correct_diarrhea_classification: createInitialClassificationState(DIARRHEA_CLASSIFICATIONS), supervisor_confirms_fever: '', worker_fever_classification: createInitialClassificationState(FEVER_CLASSIFICATIONS), supervisor_correct_fever_classification: createInitialClassificationState(FEVER_CLASSIFICATIONS), supervisor_confirms_ear: '', worker_ear_classification: '', supervisor_correct_ear_classification: '', worker_malnutrition_classification: '', supervisor_correct_malnutrition_classification: '', worker_anemia_classification: '', supervisor_correct_anemia_classification: '', /* supervisor_correct_decision removed */ }, treatment_skills: {}, finalDecision: '', decisionMatches: '',
    };
    IMNCI_FORM_STRUCTURE.forEach(group => {
        if (group.isDecisionSection) return; if (!initialState[group.sectionKey]) initialState[group.sectionKey] = {};
        if (group.subgroups && Array.isArray(group.subgroups)) {
            group.subgroups.forEach(subgroup => {
                if (subgroup.isSymptomGroupContainer && Array.isArray(subgroup.symptomGroups)) { subgroup.symptomGroups.forEach(sg => { if (sg.mainSkill?.key) initialState[group.sectionKey][sg.mainSkill.key] = ''; }); } else if (Array.isArray(subgroup.skills)) { subgroup.skills.forEach(skill => { if (skill?.key) initialState[group.sectionKey][skill.key] = ''; }); }
            });
        }
    });
    // Explicitly add symptom skills that might not be in skills array
    initialState.assessment_skills['skill_ask_cough'] = ''; initialState.assessment_skills['skill_check_rr'] = ''; initialState.assessment_skills['skill_classify_cough'] = '';
    initialState.assessment_skills['skill_ask_diarrhea'] = ''; initialState.assessment_skills['skill_check_dehydration'] = ''; initialState.assessment_skills['skill_classify_diarrhea'] = '';
    initialState.assessment_skills['skill_ask_fever'] = ''; initialState.assessment_skills['skill_check_rdt'] = ''; initialState.assessment_skills['skill_classify_fever'] = '';
    initialState.assessment_skills['skill_ask_ear'] = ''; initialState.assessment_skills['skill_check_ear'] = ''; initialState.assessment_skills['skill_classify_ear'] = '';
    return initialState;
};

// --- START FIX: New helper function to find incomplete treatment skills ---
const ensureArrayOfKeys = (data, classifications) => {
    if (Array.isArray(data)) {
        return data; // Already the saved array format
    }
    // If it's the internal object format (keys mapped to true/false), convert it back to an array of selected keys
    if (typeof data === 'object' && data !== null) {
        // Filter based on the classifications list to handle cases where keys might be missing
        return classifications.filter(c => data[c]);
    }
    return [];
};
// --- END FIX ---


// --- Helper to rehydrate draft data into form state ---
const rehydrateDraftData = (draft) => {
    // Start with the default structure
    const rehydrated = getInitialFormData();

    // Overwrite top-level fields from the draft
    rehydrated.session_date = draft.sessionDate || new Date().toISOString().split('T')[0];
    rehydrated.notes = draft.notes || '';
    rehydrated.finalDecision = draft.finalDecision || '';
    rehydrated.decisionMatches = draft.decisionMatches || '';

    // Merge nested skill objects safely
    if (draft.assessmentSkills) {
        rehydrated.assessment_skills = {
            ...rehydrated.assessment_skills, // Keep defaults
            ...draft.assessmentSkills, // Overwrite with draft data
        };
    }
    if (draft.treatmentSkills) {
        rehydrated.treatment_skills = {
            ...rehydrated.treatment_skills, // Keep defaults
            ...draft.treatmentSkills, // Overwrite with draft data
        };
    }

    // Convert saved arrays for multi-selects back into state objects
    // Use || [] to handle cases where the key might be missing in the draft
    const assessmentDraft = draft.assessmentSkills || {};

    // --- START FIX: Use new helper function ---
    const workerDiarrheaKeys = ensureArrayOfKeys(assessmentDraft.worker_diarrhea_classification, DIARRHEA_CLASSIFICATIONS);
    rehydrated.assessment_skills.worker_diarrhea_classification =
        DIARRHEA_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = workerDiarrheaKeys.includes(c);
            return acc;
        }, createInitialClassificationState(DIARRHEA_CLASSIFICATIONS));

    const supervisorDiarrheaKeys = ensureArrayOfKeys(assessmentDraft.supervisor_correct_diarrhea_classification, DIARRHEA_CLASSIFICATIONS);
    rehydrated.assessment_skills.supervisor_correct_diarrhea_classification =
        DIARRHEA_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = supervisorDiarrheaKeys.includes(c);
            return acc;
        }, createInitialClassificationState(DIARRHEA_CLASSIFICATIONS));

    const workerFeverKeys = ensureArrayOfKeys(assessmentDraft.worker_fever_classification, FEVER_CLASSIFICATIONS);
    rehydrated.assessment_skills.worker_fever_classification =
        FEVER_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = workerFeverKeys.includes(c);
            return acc;
        }, createInitialClassificationState(FEVER_CLASSIFICATIONS));

    const supervisorFeverKeys = ensureArrayOfKeys(assessmentDraft.supervisor_correct_fever_classification, FEVER_CLASSIFICATIONS);
    rehydrated.assessment_skills.supervisor_correct_fever_classification =
        FEVER_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = supervisorFeverKeys.includes(c);
            return acc;
        }, createInitialClassificationState(FEVER_CLASSIFICATIONS));
    // --- END FIX ---

    return rehydrated;
};


// --- START: calculateScores function (Corrected) ---
const calculateScores = (formData) => {
    const scores = {};
    let totalTreatmentMaxScore = 0;
    let currentTreatmentScore = 0;
    let totalAssessmentMaxScore = 0; // Will hold max for non-symptom skills
    let mainSymptomsCurrentScore = 0;
    let mainSymptomsMaxScore = 0;
    let totalMaxScore = 0;
    let totalCurrentScore = 0;

    // --- NEW KPI VARS ---
    let totalCoughCases = 0;
    let totalCorrectCoughClassifications = 0;
    let totalPneumoniaCases = 0;
    let totalCorrectPneumoniaMgmt = 0;
    let totalDiarrheaCases = 0;
    let totalCorrectDiarrheaClassifications = 0;
    let totalCorrectDiarrheaMgmt = 0;
    // --- END NEW KPI VARS ---

    // --- NEW HANDS-ON SKILLS VARS ---
    let handsOnWeight_score = 0, handsOnWeight_max = 0;
    let handsOnTemp_score = 0, handsOnTemp_max = 0;
    let handsOnHeight_score = 0, handsOnHeight_max = 0;
    let handsOnRR_score = 0, handsOnRR_max = 0;
    let handsOnRDT_score = 0, handsOnRDT_max = 0;
    let handsOnMUAC_score = 0, handsOnMUAC_max = 0;
    let handsOnWFH_score = 0, handsOnWFH_max = 0;
    // --- END NEW HANDS-ON SKILLS VARS ---


    IMNCI_FORM_STRUCTURE.forEach(group => {
        let groupCurrentScore = 0;
        let groupMaxScore = group.maxScore;

        if (group.isDecisionSection) {
            groupCurrentScore = formData.decisionMatches === 'yes' ? 1 : 0;
            groupMaxScore = 1;
            if (group.scoreKey) {
                scores[group.scoreKey] = { score: groupCurrentScore, maxScore: groupMaxScore };
            }
            totalMaxScore += groupMaxScore;
            totalCurrentScore += groupCurrentScore;

        } else if (group.sectionKey) {
            const sectionData = formData[group.sectionKey] || {};

            group.subgroups?.forEach(subgroup => {
                let subgroupCurrentScore = 0;
                let subgroupMaxScore = subgroup.maxScore ?? 0;
                let isSubgroupScored = !!subgroup.scoreKey;
                let isTreatmentSubgroup = group.sectionKey === 'treatment_skills';
                let dynamicSubgroupMaxScore = 0;

                if (subgroup.isSymptomGroupContainer) {
                    subgroup.symptomGroups?.forEach(sg => {
                        const symptomPrefix = sg.mainSkill.key.split('_')[2];
                        const askSkillKey = sg.mainSkill.key;
                        const confirmsKey = `supervisor_confirms_${symptomPrefix}`;
                        const checkSkillKey = `skill_check_${symptomPrefix === 'cough' ? 'rr' : symptomPrefix === 'diarrhea' ? 'dehydration' : symptomPrefix === 'fever' ? 'rdt' : 'ear'}`;
                        const classifySkillKey = `skill_classify_${symptomPrefix}`;
                        const askValue = sectionData[askSkillKey];

                        let symptomCurrentScore = 0;
                        let symptomMaxScore = 0;

                        if (askValue === 'yes' || askValue === 'no') {
                            symptomMaxScore += 1;
                            if (askValue === 'yes') {
                                symptomCurrentScore += 1;
                            }
                        }

                        if (askValue === 'yes' && formData.assessment_skills[confirmsKey] === 'yes') {
                            // Only count 'yes'/'no' answers towards max score
                            if (sectionData[checkSkillKey] === 'yes' || sectionData[checkSkillKey] === 'no') {
                                symptomMaxScore += 1;
                                if (sectionData[checkSkillKey] === 'yes') symptomCurrentScore += 1;
                            }
                             if (sectionData[classifySkillKey] === 'yes' || sectionData[classifySkillKey] === 'no') {
                                symptomMaxScore += 1;
                                if (sectionData[classifySkillKey] === 'yes') symptomCurrentScore += 1;
                            }
                        }

                        // --- NEW HANDS-ON SKILL LOGIC (Symptoms) ---
                        if (askValue === 'yes' && formData.assessment_skills[confirmsKey] === 'yes') {
                            const checkValue = sectionData[checkSkillKey];
                            if (symptomPrefix === 'cough') {
                                if (checkValue === 'yes' || checkValue === 'no') handsOnRR_max++;
                                if (checkValue === 'yes') handsOnRR_score++;
                            } else if (symptomPrefix === 'fever') {
                                if (checkValue === 'yes' || checkValue === 'no') handsOnRDT_max++;
                                if (checkValue === 'yes') handsOnRDT_score++;
                            }
                        }
                        // --- END NEW HANDS-ON SKILL LOGIC ---

                        mainSymptomsCurrentScore += symptomCurrentScore;
                        mainSymptomsMaxScore += symptomMaxScore;

                        if (sg.mainSkill?.scoreKey) {
                             scores[sg.mainSkill.scoreKey] = { score: symptomCurrentScore, maxScore: symptomMaxScore };
                        }

                        // --- NEW KPI 1 LOGIC (Cough Classification) ---
                        if (symptomPrefix === 'cough') {
                            const confirmsValue = formData.assessment_skills[confirmsKey];
                            const classifyValue = sectionData[classifySkillKey];

                            if (askValue === 'yes' && confirmsValue === 'yes') {
                                totalCoughCases = 1; // 1 = This case had cough
                                if (classifyValue === 'yes') {
                                    totalCorrectCoughClassifications = 1; // 1 = Correctly classified
                                }
                            }
                        }
                        // --- END NEW KPI 1 LOGIC ---

                        // --- NEW KPI 1 LOGIC (Diarrhea Classification) ---
                        if (symptomPrefix === 'diarrhea') {
                            const confirmsValue = formData.assessment_skills[confirmsKey];
                            const classifyValue = sectionData[classifySkillKey];

                            if (askValue === 'yes' && confirmsValue === 'yes') {
                                totalDiarrheaCases = 1; // 1 = This case had diarrhea
                                if (classifyValue === 'yes') {
                                    totalCorrectDiarrheaClassifications = 1; // 1 = Correctly classified
                                }
                            }
                        }
                        // --- END NEW KPI 1 LOGIC ---
                    });

                    if (isSubgroupScored) {
                        subgroupCurrentScore = mainSymptomsCurrentScore;
                        subgroupMaxScore = mainSymptomsMaxScore;
                    }

                } else if (Array.isArray(subgroup.skills)) {
                    let isSubgroupRelevantForScoring = true;
                    if (isTreatmentSubgroup && subgroup.relevant) {
                        if (typeof subgroup.relevant === 'function') isSubgroupRelevantForScoring = subgroup.relevant(formData);
                        else if (typeof subgroup.relevant === 'string') isSubgroupRelevantForScoring = evaluateRelevance(subgroup.relevant, formData);
                    }

                    // --- NEW KPI 2 LOGIC (Pneumonia Management) ---
                    if (isTreatmentSubgroup && subgroup.scoreKey === 'pneu_treatment' && isSubgroupRelevantForScoring) {
                        totalPneumoniaCases = 1; // 1 = This was a pneumonia case
                        const abxValue = sectionData['skill_pneu_abx'];
                        if (abxValue === 'yes') {
                            totalCorrectPneumoniaMgmt = 1; // 1 = Correct ABX given
                        }
                    }
                    // --- END NEW KPI 2 LOGIC ---

                    // --- NEW KPI 2 LOGIC (Diarrhea Management) ---
                    if (isTreatmentSubgroup && subgroup.scoreKey === 'diar_treatment' && isSubgroupRelevantForScoring) {
                        // Denominator (totalDiarrheaCases) is set from assessment.
                        // Relevance check (isSubgroupRelevantForScoring) confirms this is a diarrhea case.
                        const orsValue = sectionData['skill_diar_ors'];
                        const zincValue = sectionData['skill_diar_zinc'];

                        if (orsValue === 'yes' && zincValue === 'yes') {
                            totalCorrectDiarrheaMgmt = 1; // 1 = Correct ORS and Zinc given
                        }
                    }
                    // --- END NEW KPI 2 LOGIC ---

                    subgroup.skills.forEach(skill => {
                        let isSkillRelevantForScoring = isSubgroupRelevantForScoring;
                        if (isSubgroupRelevantForScoring && skill.relevant) {
                             if (typeof skill.relevant === 'function') isSkillRelevantForScoring = skill.relevant(formData);
                             else if (typeof skill.relevant === 'string') isSkillRelevantForScoring = evaluateRelevance(skill.relevant, formData);
                        }

                        if (isSkillRelevantForScoring) {
                            const value = sectionData[skill.key];
                            
                            // --- NEW HANDS-ON SKILL LOGIC (Vitals & Malnutrition) ---
                            if (subgroup.scoreKey === 'vitalSigns') {
                                if (skill.key === 'skill_weight') {
                                    if (value === 'yes' || value === 'no') handsOnWeight_max++;
                                    if (value === 'yes') handsOnWeight_score++;
                                } else if (skill.key === 'skill_temp') {
                                    if (value === 'yes' || value === 'no') handsOnTemp_max++;
                                    if (value === 'yes') handsOnTemp_score++;
                                } else if (skill.key === 'skill_height') {
                                    if (value === 'yes' || value === 'no') handsOnHeight_max++;
                                    if (value === 'yes') handsOnHeight_score++;
                                }
                            } else if (subgroup.scoreKey === 'malnutrition') {
                                if (skill.key === 'skill_mal_muac') {
                                    if (value === 'yes' || value === 'no') handsOnMUAC_max++;
                                    if (value === 'yes') handsOnMUAC_score++;
                                } else if (skill.key === 'skill_mal_wfh') {
                                    if (value === 'yes' || value === 'no') handsOnWFH_max++;
                                    if (value === 'yes') handsOnWFH_score++;
                                }
                            }
                            // --- END NEW HANDS-ON SKILL LOGIC ---

                            if (isTreatmentSubgroup) {
                                // Only count 'yes'/'no' answers towards max score
                                if (value === 'yes' || value === 'no') {
                                    totalTreatmentMaxScore += 1;
                                    if (isSubgroupScored) dynamicSubgroupMaxScore += 1;
                                }
                            } else {
                                // Only count 'yes'/'no' answers towards max score for assessment
                                // 'na' for vitals (لا يوجد / لا يعمل الجهاز) should not count towards max score
                                const isVitalSignsNa = (subgroup.scoreKey === 'vitalSigns' && value === 'na');
                                if ((value === 'yes' || value === 'no') && !isVitalSignsNa) {
                                    totalAssessmentMaxScore += 1;
                                }
                            }

                            if (value === 'yes') {
                                // This logic correctly adds to subgroup score for assessment,
                                // and group score for treatment.
                                if (isTreatmentSubgroup) {
                                    groupCurrentScore += 1; 
                                }
                                if (isSubgroupScored) {
                                    subgroupCurrentScore += 1; 
                                }
                            }
                        }
                    });

                    if (isTreatmentSubgroup) {
                        if (isSubgroupScored) subgroupMaxScore = dynamicSubgroupMaxScore;
                    }

                    if (!isTreatmentSubgroup) {
                         // This adds the subgroup's total to the group's total
                         groupCurrentScore += subgroupCurrentScore; 
                    }
                }

                if (isSubgroupScored) {
                    // Manually set max score for vitals since it's dynamic
                    if (subgroup.scoreKey === 'vitalSigns') {
                        let vitalMax = 0;
                        if (sectionData['skill_weight'] === 'yes' || sectionData['skill_weight'] === 'no') vitalMax++;
                        if (sectionData['skill_temp'] === 'yes' || sectionData['skill_temp'] === 'no') vitalMax++;
                        if (sectionData['skill_height'] === 'yes' || sectionData['skill_height'] === 'no') vitalMax++;
                        subgroupMaxScore = vitalMax;
                    } else if (subgroup.scoreKey === 'dangerSigns') {
                        let dangerMax = 0;
                        if (sectionData['skill_ds_drink'] === 'yes' || sectionData['skill_ds_drink'] === 'no') dangerMax++;
                        if (sectionData['skill_ds_vomit'] === 'yes' || sectionData['skill_ds_vomit'] === 'no') dangerMax++;
                        if (sectionData['skill_ds_convulsion'] === 'yes' || sectionData['skill_ds_convulsion'] === 'no') dangerMax++;
                        if (sectionData['skill_ds_conscious'] === 'yes' || sectionData['skill_ds_conscious'] === 'no') dangerMax++;
                        subgroupMaxScore = dangerMax;
                    } else if (!isTreatmentSubgroup && !subgroup.isSymptomGroupContainer) {
                        // For other assessment subgroups (malnutrition, anemia, etc.)
                        // max score is the count of 'yes'/'no' answers
                        let subMax = 0;
                        subgroup.skills.forEach(skill => {
                            const skillValue = sectionData[skill.key];
                            if(skillValue === 'yes' || skillValue === 'no') subMax++;
                        });
                        subgroupMaxScore = subMax;
                    }
                    
                    scores[subgroup.scoreKey] = { score: subgroupCurrentScore, maxScore: subgroupMaxScore };
                }
            });

            if (group.scoreKey === 'treatment') {
                currentTreatmentScore = groupCurrentScore;
                groupMaxScore = totalTreatmentMaxScore;
                scores[group.scoreKey] = { score: currentTreatmentScore, maxScore: groupMaxScore };
                totalMaxScore += groupMaxScore;
                totalCurrentScore += currentTreatmentScore;
            } else if (group.sectionKey === 'assessment_skills') {
                // Here is the final tally, using the correctly separated max scores
                scores['assessment_total_score'] = { 
                    score: groupCurrentScore + mainSymptomsCurrentScore, 
                    maxScore: totalAssessmentMaxScore + mainSymptomsMaxScore 
                };
                totalMaxScore += totalAssessmentMaxScore + mainSymptomsMaxScore;
                totalCurrentScore += groupCurrentScore + mainSymptomsCurrentScore;
            }
        }
    });

    scores.treatmentScoreForSave = currentTreatmentScore;
    scores.overallScore = { score: totalCurrentScore, maxScore: totalMaxScore };

    // --- NEW KPI SCORES ---
    scores.coughClassification = { score: totalCorrectCoughClassifications, maxScore: totalCoughCases };
    scores.pneumoniaManagement = { score: totalCorrectPneumoniaMgmt, maxScore: totalPneumoniaCases };
    scores.diarrheaClassification = { score: totalCorrectDiarrheaClassifications, maxScore: totalDiarrheaCases };
    scores.diarrheaManagement = { score: totalCorrectDiarrheaMgmt, maxScore: totalDiarrheaCases };
    // --- END NEW KPI SCORES ---

    // --- NEW HANDS-ON SKILL SCORES ---
    scores.handsOnWeight = { score: handsOnWeight_score, maxScore: handsOnWeight_max };
    scores.handsOnTemp = { score: handsOnTemp_score, maxScore: handsOnTemp_max };
    scores.handsOnHeight = { score: handsOnHeight_score, maxScore: handsOnHeight_max };
    scores.handsOnRR = { score: handsOnRR_score, maxScore: handsOnRR_max };
    scores.handsOnRDT = { score: handsOnRDT_score, maxScore: handsOnRDT_max };
    scores.handsOnMUAC = { score: handsOnMUAC_score, maxScore: handsOnMUAC_max };
    scores.handsOnWFH = { score: handsOnWFH_score, maxScore: handsOnWFH_max };
    // --- END NEW HANDS-ON SKILL SCORES ---

    return scores;
};
// --- END: calculateScores function (Corrected) ---


// --- START: New helper function to find incomplete treatment skills ---
const findIncompleteTreatmentSkills = (formData) => {
    const treatmentGroup = IMNCI_FORM_STRUCTURE.find(g => g.sectionKey === 'treatment_skills');
    if (!treatmentGroup) return [];

    const incomplete = [];
    const sectionData = formData.treatment_skills || {};

    treatmentGroup.subgroups.forEach(subgroup => {
        let isSubgroupRelevant = true;
        if (subgroup.relevant) {
            isSubgroupRelevant = typeof subgroup.relevant === 'function'
                ? subgroup.relevant(formData)
                : evaluateRelevance(subgroup.relevant, formData);
        }

        if (isSubgroupRelevant && Array.isArray(subgroup.skills)) {
            subgroup.skills.forEach(skill => {
                let isSkillRelevant = true; // Inherit subgroup relevance
                if (skill.relevant) { // Only check skill relevance if subgroup is relevant
                    isSkillRelevant = typeof skill.relevant === 'function'
                        ? skill.relevant(formData)
                        : evaluateRelevance(skill.relevant, formData);
                }

                // If the skill is relevant and its value is empty, it's incomplete.
                // 'na' is a valid, complete answer.
                if (isSkillRelevant && (!sectionData[skill.key] || sectionData[skill.key] === '')) {
                    incomplete.push(skill.label);
                }
            });
        }
    });
    return incomplete;
};
// --- END: New helper function ---


// --- Form Component Start (MODIFIED) ---
const SkillsAssessmentForm = forwardRef((props, ref) => { // MODIFIED: Wrap in forwardRef
    // --- MODIFICATION: Destructure onDraftCreated ---
    const { // MODIFIED: Destructure props
        facility,
        healthWorkerName,
        healthWorkerJobTitle,
        healthWorkerTrainingDate,
        healthWorkerPhone, 
        onExit, // Renamed from onCancel
        onSaveComplete, // New prop for successful save
        setToast,
        existingSessionData = null,
        visitNumber = 1, 
        lastSessionDate = null,
        onDraftCreated, // <-- DESTRUCTURED
        // --- START NEW PROPS ---
        setIsMothersFormModalOpen,
        setIsDashboardModalOpen,
        draftCount
        // --- END NEW PROPS ---
    } = props;
    // --- END MODIFICATION ---

    // --- START: MODIFIED STATE INITIALIZATION ---
    // Start with a blank form. The useEffect will populate it.
    const [formData, setFormData] = useState(getInitialFormData());
    // Start at step 1. The useEffect will expand it if needed.
    const [visibleStep, setVisibleStep] = useState(1);
    // --- END: MODIFIED STATE INITIALIZATION ---

    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false); // <-- ADDED
    const [scores, setScores] = useState({});
    const auth = getAuth();
    const user = auth.currentUser;

    // --- START: NEW STATE FOR COMPLETION ---
    const [isFormFullyComplete, setIsFormFullyComplete] = useState(false);
    // --- END: NEW STATE FOR COMPLETION ---

    // --- START: MODIFIED AUTOSAVE REFS ---
    // Create refs to hold stable values for props and state
    // This avoids stale closures in the useCallback for silentSave
    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);


    // --- MODIFICATION: Add onDraftCreated to ref ---
    const allPropsRef = useRef({
        facility, healthWorkerName, user, visitNumber, existingSessionData,
        isSaving, isSavingDraft, setToast,
        healthWorkerJobTitle,
        onDraftCreated // <-- ADDED
    });
    useEffect(() => {
        allPropsRef.current = {
            facility, healthWorkerName, user, visitNumber, existingSessionData,
            isSaving, isSavingDraft, setToast,
            healthWorkerJobTitle,
            onDraftCreated // <-- ADDED
        };
    }, [
        facility, healthWorkerName, user, visitNumber, existingSessionData,
        isSaving, isSavingDraft, setToast,
        healthWorkerJobTitle,
        onDraftCreated // <-- ADDED
    ]);
    // --- END MODIFICATION ---
    
    // --- NEW: Add ref to track the currently loaded draft ID ---
    const editingIdRef = useRef(null); 
    // --- END NEW REF ---
    // --- END: MODIFIED AUTOSAVE REFS ---


    // ================== BEGIN FIX ==================
    //
    // This effect now synchronizes the form state *only when the draft ID actually changes*
    //
    useEffect(() => {
        const newId = existingSessionData ? existingSessionData.id : null;
        const oldId = editingIdRef.current;

        // We only reload the form if the ID *changes*.
        if (newId !== oldId) {
            
            if (newId) {
                // New ID is present: load/reload the draft data
                setFormData(rehydrateDraftData(existingSessionData));
                setVisibleStep(9); // Always expand when loading/switching drafts
            } else {
                // New ID is null: reset to a blank form
                setFormData(getInitialFormData());
                setVisibleStep(1);
            }
            // Update the ID we are tracking
            editingIdRef.current = newId;
        }
        // If newId === oldId, do nothing. This prevents re-hydration
        // when the parent re-renders but the draft ID is the same.

    }, [existingSessionData]); // Only depends on the prop
    //
    // =================== END FIX ===================

    // --- START: MODIFIED Helper functions for step completion ---
    const isMultiSelectGroupEmpty = (obj) => !obj || !Object.values(obj).some(v => v === true);

    const isVitalSignsComplete = (data) => { const skills = data.assessment_skills; return skills.skill_weight !== '' && skills.skill_temp !== '' && skills.skill_height !== ''; };
    const isDangerSignsComplete = (data) => { const skills = data.assessment_skills; return skills.skill_ds_drink !== '' && skills.skill_ds_vomit !== '' && skills.skill_ds_convulsion !== '' && skills.skill_ds_conscious !== ''; };

    // --- START: NEW helper functions for each symptom block ---
    const isCoughBlockComplete = (skills) => {
        if (skills.skill_ask_cough === '') return false;
        if (skills.skill_ask_cough === 'yes') {
            if (skills.supervisor_confirms_cough === '') return false;
            if (skills.supervisor_confirms_cough === 'yes') {
                if (skills.skill_check_rr === '' || skills.skill_classify_cough === '') return false;
                if (skills.skill_classify_cough === 'yes' && skills.worker_cough_classification === '') return false;
                if (skills.skill_classify_cough === 'no' && (skills.worker_cough_classification === '' || skills.supervisor_correct_cough_classification === '')) return false;
            }
        }
        return true; // Complete if 'no' or if 'yes' and all sub-questions are filled
    };

    const isDiarrheaBlockComplete = (skills) => {
        if (skills.skill_ask_diarrhea === '') return false;
        if (skills.skill_ask_diarrhea === 'yes') {
            if (skills.supervisor_confirms_diarrhea === '') return false;
            if (skills.supervisor_confirms_diarrhea === 'yes') {
                if (skills.skill_check_dehydration === '' || skills.skill_classify_diarrhea === '') return false;
                if (skills.skill_classify_diarrhea === 'yes' && isMultiSelectGroupEmpty(skills.worker_diarrhea_classification)) return false;
                if (skills.skill_classify_diarrhea === 'no' && (isMultiSelectGroupEmpty(skills.worker_diarrhea_classification) || isMultiSelectGroupEmpty(skills.supervisor_correct_diarrhea_classification))) return false;
            }
        }
        return true;
    };
    
    const isFeverBlockComplete = (skills) => {
        if (skills.skill_ask_fever === '') return false;
        if (skills.skill_ask_fever === 'yes') {
            if (skills.supervisor_confirms_fever === '') return false;
            if (skills.supervisor_confirms_fever === 'yes') {
                if (skills.skill_check_rdt === '' || skills.skill_classify_fever === '') return false;
                if (skills.skill_classify_fever === 'yes' && isMultiSelectGroupEmpty(skills.worker_fever_classification)) return false;
                if (skills.skill_classify_fever === 'no' && (isMultiSelectGroupEmpty(skills.worker_fever_classification) || isMultiSelectGroupEmpty(skills.supervisor_correct_fever_classification))) return false;
            }
        }
        return true;
    };

    const isEarBlockComplete = (skills) => {
        if (skills.skill_ask_ear === '') return false;
        if (skills.skill_ask_ear === 'yes') {
            if (skills.supervisor_confirms_ear === '') return false;
            if (skills.supervisor_confirms_ear === 'yes') { 
                if (skills.skill_check_ear === '' || skills.skill_classify_ear === '') return false;
                if (skills.skill_classify_ear === 'yes' && skills.worker_ear_classification === '') return false;
                if (skills.skill_classify_ear === 'no' && (skills.worker_ear_classification === '' || skills.supervisor_correct_ear_classification === '')) return false;
            }
        }
        return true;
    };
    // --- END: NEW helper functions ---

    const isMainSymptomsComplete = (data) => {
        const skills = data.assessment_skills;
        return isCoughBlockComplete(skills) && 
               isDiarrheaBlockComplete(skills) && 
               isFeverBlockComplete(skills) && 
               isEarBlockComplete(skills);
    };

    const isMalnutritionComplete = (data) => {
        const skills = data.assessment_skills;
        if (skills.skill_mal_muac === '' || skills.skill_mal_wfh === '' || skills.skill_mal_classify === '') {
            return false;
        }
        if (skills.skill_mal_classify === 'yes') {
            if (skills.worker_malnutrition_classification === '') return false;
        } else if (skills.skill_mal_classify === 'no') {
            if (skills.worker_malnutrition_classification === '') return false;
            if (skills.supervisor_correct_malnutrition_classification === '') return false;
        }
        return true;
    };

    const isAnemiaComplete = (data) => {
        const skills = data.assessment_skills;
        if (skills.skill_anemia_pallor === '' || skills.skill_anemia_classify === '') {
            return false;
        }
        if (skills.skill_anemia_classify === 'yes') {
            if (skills.worker_anemia_classification === '') return false;
        } else if (skills.skill_anemia_classify === 'no') {
            if (skills.worker_anemia_classification === '') return false;
            if (skills.supervisor_correct_anemia_classification === '') return false;
        }
        return true;
    };
    // --- END: MODIFIED Helper functions ---

    const isImmunizationComplete = (data) => { const skills = data.assessment_skills; return skills.skill_imm_vacc !== '' && skills.skill_imm_vita !== ''; };
    const isOtherProblemsComplete = (data) => { const skills = data.assessment_skills; return skills.skill_other !== ''; };
    const isDecisionComplete = (data) => { return data.finalDecision !== '' && data.decisionMatches !== ''; };


    // --- Effect to control step visibility, cleanup, and score calculation ---
    useEffect(() => {
        let needsUpdate = false;
        // Deep copy to avoid direct state mutation during cleanup
        const newFormData = JSON.parse(JSON.stringify(formData));
        const { assessment_skills: newAssessmentSkills, treatment_skills: newTreatmentSkills } = newFormData;

        // --- Step Visibility Logic ---
        let maxStep = 1;
        if (isVitalSignsComplete(formData)) { maxStep = 2;
            if (isDangerSignsComplete(formData)) { maxStep = 3;
                // --- MODIFICATION: Check symptom blocks sequentially ---
                if (isCoughBlockComplete(newAssessmentSkills) &&
                    isDiarrheaBlockComplete(newAssessmentSkills) &&
                    isFeverBlockComplete(newAssessmentSkills) &&
                    isEarBlockComplete(newAssessmentSkills)) { maxStep = 4;
                // --- END MODIFICATION ---
                    if (isMalnutritionComplete(formData)) { maxStep = 5;
                        if (isAnemiaComplete(formData)) { maxStep = 6;
                            if (isImmunizationComplete(formData)) { maxStep = 7;
                                if (isOtherProblemsComplete(formData)) { maxStep = 8;
                                    if (isDecisionComplete(formData)) { maxStep = 9; }
                                }
                            }
                        }
                    }
                }
            }
        }
        // Always show at least the step reached, or all if editing
        const targetVisibleStep = editingIdRef.current ? 9 : Math.max(visibleStep, maxStep); // Use ref here
        if (targetVisibleStep !== visibleStep) {
            setVisibleStep(targetVisibleStep);
        }

        // --- Cleanup Logic ---

        // Helper to reset symptom sub-questions if main symptom is 'no'
        const resetSymptomSubquestions = (prefix, classifications, isMulti) => {
            const mainSkillKey = `skill_ask_${prefix}`;
            if (newAssessmentSkills[mainSkillKey] === 'no') {
                const confirmsKey = `supervisor_confirms_${prefix}`;
                const checkSkillKey = `skill_check_${prefix === 'cough' ? 'rr' : prefix === 'diarrhea' ? 'dehydration' : prefix === 'fever' ? 'rdt' : 'ear'}`;
                const classifySkillKey = `skill_classify_${prefix}`;
                const workerClassKey = `worker_${prefix}_classification`;
                const correctClassKey = `supervisor_correct_${prefix}_classification`;
                const initialClassState = isMulti ? createInitialClassificationState(classifications || []) : '';

                if (newAssessmentSkills[confirmsKey] !== '') { newAssessmentSkills[confirmsKey] = ''; needsUpdate = true; }
                if (newAssessmentSkills[checkSkillKey] !== '') { newAssessmentSkills[checkSkillKey] = ''; needsUpdate = true; }
                if (newAssessmentSkills[classifySkillKey] !== '') { newAssessmentSkills[classifySkillKey] = ''; needsUpdate = true; }
                // Compare deeply for multi-select objects before resetting
                if (isMulti ? JSON.stringify(newAssessmentSkills[workerClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[workerClassKey] !== '') { newAssessmentSkills[workerClassKey] = initialClassState; needsUpdate = true; }
                if (isMulti ? JSON.stringify(newAssessmentSkills[correctClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[correctClassKey] !== '') { newAssessmentSkills[correctClassKey] = initialClassState; needsUpdate = true; }
            }
        };
        resetSymptomSubquestions('cough', COUGH_CLASSIFICATIONS, false);
        resetSymptomSubquestions('diarrhea', DIARRHEA_CLASSIFICATIONS, true);
        resetSymptomSubquestions('fever', FEVER_CLASSIFICATIONS, true);
        resetSymptomSubquestions('ear', EAR_CLASSIFICATIONS, false);

        // Helper for cleanup based on supervisor confirmation
        const symptomCleanup = (symptomPrefix, classifications, isMulti = false) => {
            const mainSkillKey = `skill_ask_${symptomPrefix}`;
            if (newAssessmentSkills[mainSkillKey] === 'yes') {
                const confirmsKey = `supervisor_confirms_${symptomPrefix}`;
                
                // --- FIX: Replaced 'prefix' with 'symptomPrefix' in all 3 locations ---
                const checkSkillKey = `skill_check_${symptomPrefix === 'cough' ? 'rr' : symptomPrefix === 'diarrhea' ? 'dehydration' : symptomPrefix === 'fever' ? 'rdt' : 'ear'}`;
                const classifySkillKey = `skill_classify_${symptomPrefix}`;
                const workerClassKey = `worker_${symptomPrefix}_classification`; 
                const correctClassKey = `supervisor_correct_${symptomPrefix}_classification`; 
                // --- END FIX ---

                const supervisorConfirms = newAssessmentSkills[confirmsKey] === 'yes';
                const initialClassState = isMulti ? createInitialClassificationState(classifications || []) : '';
                const didClassifyCorrectly = newAssessmentSkills[classifySkillKey] === 'yes';

                if (!supervisorConfirms && newAssessmentSkills[confirmsKey] !== '') { // Only cleanup if confirmation exists and is 'no'
                    // Set sub-skills to 'na' if supervisor says no symptom
                    if (newAssessmentSkills[checkSkillKey] !== 'na') { newAssessmentSkills[checkSkillKey] = 'na'; needsUpdate = true; }
                    if (newAssessmentSkills[classifySkillKey] !== 'na') { newAssessmentSkills[classifySkillKey] = 'na'; needsUpdate = true; }
                    // Reset classifications
                    if (isMulti ? JSON.stringify(newAssessmentSkills[workerClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[workerClassKey] !== '') { newAssessmentSkills[workerClassKey] = initialClassState; needsUpdate = true; }
                    if (isMulti ? JSON.stringify(newAssessmentSkills[correctClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[correctClassKey] !== '') { newAssessmentSkills[correctClassKey] = initialClassState; needsUpdate = true; }
                } else if (supervisorConfirms) {
                    // Reset from 'na' if supervisor confirms symptom
                    if (newAssessmentSkills[checkSkillKey] === 'na') { newAssessmentSkills[checkSkillKey] = ''; needsUpdate = true; }
                    if (newAssessmentSkills[classifySkillKey] === 'na') { newAssessmentSkills[classifySkillKey] = ''; needsUpdate = true; }
                    // Reset supervisor correction if worker classified correctly or classification is pending/na
                    if (didClassifyCorrectly || newAssessmentSkills[classifySkillKey] === 'na' || newAssessmentSkills[classifySkillKey] === '') {
                        if (isMulti ? JSON.stringify(newAssessmentSkills[correctClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[correctClassKey] !== '') {
                            newAssessmentSkills[correctClassKey] = initialClassState;
                            needsUpdate = true;
                        }
                    }
                }
            }
        };
        symptomCleanup('cough', COUGH_CLASSIFICATIONS);
        symptomCleanup('diarrhea', DIARRHEA_CLASSIFICATIONS, true);
        symptomCleanup('fever', FEVER_CLASSIFICATIONS, true);
        symptomCleanup('ear', EAR_CLASSIFICATIONS);

        // Helper for Malnutrition/Anemia classification cleanup
        const classificationCleanup = (prefix, isMulti = false, classifications = []) => {
            const classifySkillKey = `skill_${prefix}_classify`;
            const correctKey = `supervisor_correct_${prefix}_classification`;
            const didClassifyCorrectly = newAssessmentSkills[classifySkillKey] === 'yes';
            const initialClassState = isMulti ? createInitialClassificationState(classifications) : '';

            // If classified correctly, or not yet classified, or N/A, clear supervisor correction
            if (didClassifyCorrectly || newAssessmentSkills[classifySkillKey] === 'na' || newAssessmentSkills[classifySkillKey] === '') {
                if (isMulti ? JSON.stringify(newAssessmentSkills[correctKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[correctKey] !== '') {
                    newAssessmentSkills[correctKey] = initialClassState;
                    needsUpdate = true;
                }
            }
        };
        classificationCleanup('malnutrition'); // Single select
        classificationCleanup('anemia'); // Single select


        // Treatment relevance cleanup
        IMNCI_FORM_STRUCTURE.forEach(group => {
            if (group.sectionKey !== 'treatment_skills' || !newTreatmentSkills) return;
            if(Array.isArray(group.subgroups)) {
                group.subgroups.forEach(subgroup => {
                     let isSubgroupRelevant = true;
                     if (subgroup.relevant) {
                        isSubgroupRelevant = typeof subgroup.relevant === 'function'
                            ? subgroup.relevant(newFormData)
                            : evaluateRelevance(subgroup.relevant, newFormData);
                     }

                    if (Array.isArray(subgroup.skills)) {
                        subgroup.skills.forEach(skill => {
                            if (!skill?.key) return;
                            let isSkillRelevant = isSubgroupRelevant; // Inherit subgroup relevance
                            if (isSubgroupRelevant && skill.relevant) { // Only check skill relevance if subgroup is relevant
                                isSkillRelevant = typeof skill.relevant === 'function'
                                    ? skill.relevant(newFormData)
                                    : evaluateRelevance(skill.relevant, newFormData);
                            }

                            // If not relevant, set to 'na' if it's not already 'na'
                            if (!isSkillRelevant && newTreatmentSkills[skill.key] !== 'na') {
                                newTreatmentSkills[skill.key] = 'na';
                                needsUpdate = true;
                            }
                            // If relevant, reset from 'na' to empty ONLY IF it was 'na'
                            else if (isSkillRelevant && newTreatmentSkills[skill.key] === 'na') {
                                newTreatmentSkills[skill.key] = ''; // Reset to allow input
                                needsUpdate = true;
                            }
                        });
                    }
                });
            }
        });


        // Apply updates if any cleanup occurred
        if (needsUpdate) {
            setFormData(newFormData);
        }

        // --- START: NEW COMPLETION CHECK ---
        const vitalSignsComplete = isVitalSignsComplete(newFormData);
        const dangerSignsComplete = isDangerSignsComplete(newFormData);
        const mainSymptomsComplete = isMainSymptomsComplete(newFormData);
        const malnutritionComplete = isMalnutritionComplete(newFormData);
        const anemiaComplete = isAnemiaComplete(newFormData);
        const immunizationComplete = isImmunizationComplete(newFormData);
        const otherProblemsComplete = isOtherProblemsComplete(newFormData);
        const decisionComplete = isDecisionComplete(newFormData);
        // Check if treatment step is complete (no empty relevant fields)
        const treatmentComplete = findIncompleteTreatmentSkills(newFormData).length === 0;

        const allStepsComplete = vitalSignsComplete &&
                                 dangerSignsComplete &&
                                 mainSymptomsComplete &&
                                 malnutritionComplete &&
                                 anemiaComplete &&
                                 immunizationComplete &&
                                 otherProblemsComplete &&
                                 decisionComplete &&
                                 treatmentComplete;

        setIsFormFullyComplete(allStepsComplete);
        // --- END: NEW COMPLETION CHECK ---

        // Calculate scores based on the *current* (potentially cleaned) formData
        setScores(calculateScores(newFormData)); 

    }, [formData, visibleStep]); // Rerun on data change, step change (removed existingSessionData)


    // --- START: New silentSaveDraft function for autosave ---
    // --- MODIFICATION: Call onDraftCreated ---
    const silentSaveDraft = useCallback(async () => {
        // Get all props/state from the ref to ensure they are current
        const {
            facility, healthWorkerName, user, visitNumber, existingSessionData,
            isSaving, isSavingDraft, setToast, healthWorkerJobTitle,
            onDraftCreated // <-- DESTRUCTURED FROM REF
        } = allPropsRef.current;
        
        // Get the latest formData from its ref
        const currentFormData = formDataRef.current;

        // Don't autosave if a manual save is in progress
        if (isSaving || isSavingDraft) return;

        // --- REMOVED isAutoSaving state ---
        
        try {
            // Payload processing (copied from handleSaveDraft)
            const getSelectedKeys = (obj) => Object.entries(obj || {}).filter(([, isSelected]) => isSelected).map(([key]) => key);
            const assessmentSkillsPayload = {
                ...currentFormData.assessment_skills,
                worker_diarrhea_classification: getSelectedKeys(currentFormData.assessment_skills.worker_diarrhea_classification),
                supervisor_correct_diarrhea_classification: getSelectedKeys(currentFormData.assessment_skills.supervisor_correct_diarrhea_classification),
                worker_fever_classification: getSelectedKeys(currentFormData.assessment_skills.worker_fever_classification),
                supervisor_correct_fever_classification: getSelectedKeys(currentFormData.assessment_skills.supervisor_correct_fever_classification),
            };
            delete assessmentSkillsPayload.supervisor_confirms_cough;
            delete assessmentSkillsPayload.supervisor_confirms_diarrhea;
            delete assessmentSkillsPayload.supervisor_confirms_fever;
            delete assessmentSkillsPayload.supervisor_confirms_ear;

            const calculatedScores = calculateScores(currentFormData);
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (key !== 'treatmentScoreForSave' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }
            scoresPayload['treatment_score'] = calculatedScores.treatmentScoreForSave ?? 0;
            scoresPayload['treatment_maxScore'] = calculatedScores['treatment']?.maxScore ?? 0;

            const effectiveDateTimestamp = Timestamp.fromDate(new Date(currentFormData.session_date));

            // ================== BEGIN FIX ==================
            // Apply optional chaining (?.) and null fallback (|| null)
            // to all fields derived from the `facility` prop.
            const payload = {
                serviceType: 'IMNCI', 
                state: facility?.['الولاية'] || null,
                locality: facility?.['المحلية'] || null,
                facilityId: facility?.id || null,
                facilityName: facility?.['اسم_المؤسسة'] || null,
                healthWorkerName: healthWorkerName,
                
                // --- START: ADDITIONS ---
                facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                workerType: healthWorkerJobTitle || null,
                // --- END: ADDITIONS ---

                sessionDate: currentFormData.session_date,
            // =================== END FIX ===================
                effectiveDate: effectiveDateTimestamp,
                assessmentSkills: assessmentSkillsPayload,
                finalDecision: currentFormData.finalDecision,
                decisionMatches: currentFormData.decisionMatches,
                treatmentSkills: currentFormData.treatment_skills,
                scores: scoresPayload,
                notes: currentFormData.notes,
                mentorEmail: user?.email || 'unknown', mentorName: user?.displayName || 'Unknown Mentor',
                status: 'draft',
                visitNumber: visitNumber
            };

            // --- MODIFIED: Use the ref for the current ID ---
            const sessionId = editingIdRef.current;
            
            // --- MODIFICATION: Capture return value ---
            const savedDraft = await saveMentorshipSession(payload, sessionId);
            
            // --- MODIFICATION: Call onDraftCreated if it was a new draft ---
            if (!sessionId && savedDraft && onDraftCreated) {
                // This updates the parent's state
                onDraftCreated(savedDraft);
                // This updates our *internal* tracking ID to prevent re-loads
                editingIdRef.current = savedDraft.id; 
            }
            // --- END MODIFICATION ---

        } catch (error) {
            console.error("Autosave failed:", error);
            // Only show toast on error for silent save
            setToast({ show: true, message: `فشل الحفظ التلقائي: ${error.message}`, type: 'error' });
        } finally {
            // --- REMOVED setIsAutoSaving(false) ---
        }
    }, []); // MODIFIED: Empty dependency array, relies on refs
    // --- END MODIFICATION ---
    // --- END: New silentSaveDraft function for autosave ---

    // --- START: REMOVED useEffect to trigger autosave ---
    // (This entire block was removed)
    // --- END: REMOVED useEffect to trigger autosave ---

    // --- START: New useImperativeHandle to expose saveDraft ---
    useImperativeHandle(ref, () => ({
        saveDraft: async () => {
            // ... (existing saveDraft logic) ...
            // --- MODIFIED: Removed isAutoSaving ---
            const { isSaving, isSavingDraft } = allPropsRef.current;
            
            // ================== BEGIN FIX ==================
            //
            // If a manual or auto save is already in progress, just return to avoid conflicts
            // --- MODIFIED: Removed isAutoSaving ---
            if (isSaving || isSavingDraft) {
                return;
            }
            //
            // REMOVED: The check for "!isDirty".
            // The parent component (SkillsMentorshipView) is explicitly
            // asking the form to save its state before switching.
            // We must honor this request even if isDirty is false,
            // (e.g., to correctly save a new, empty draft).
            //
            // =================== END FIX ===================

            // --- REMOVED: Timer clear ---

            // Trigger the save immediately and wait for it
            await silentSaveDraft();
        },
        // --- NEW: Expose function to open facility modal ---
        openFacilityModal: () => setIsFacilityModalOpen(true)
    }));
    // --- END: New useImperativeHandle ---


    // --- Handlers ---
    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        const assessmentFieldsConfig = {
            worker_diarrhea_classification: DIARRHEA_CLASSIFICATIONS, supervisor_correct_diarrhea_classification: DIARRHEA_CLASSIFICATIONS,
            worker_fever_classification: FEVER_CLASSIFICATIONS, supervisor_correct_fever_classification: FEVER_CLASSIFICATIONS,
        };
        let isMultiClassification = false;
        let targetObjectKey = null;
        let classificationValue = null;
        // Check if the changed input 'name' corresponds to a multi-select classification checkbox
        for (const key in assessmentFieldsConfig) {
            if (assessmentFieldsConfig[key].includes(name)) {
                isMultiClassification = true;
                targetObjectKey = key;
                classificationValue = name;
                break;
            }
        }

        if (isMultiClassification && targetObjectKey && classificationValue) {
            // Update multi-select state within assessment_skills
            setFormData(prev => ({
                ...prev,
                assessment_skills: {
                    ...prev.assessment_skills,
                    [targetObjectKey]: {
                        ...(prev.assessment_skills[targetObjectKey] || {}), // Ensure object exists
                        [classificationValue]: checked // Set the specific classification's boolean value
                    }
                }
            }));
        } else {
            // Handle simple inputs (text, date, single select, radio buttons not part of multi-select)
            const simpleAssessmentFields = [
                'supervisor_confirms_cough', 'worker_cough_classification', 'supervisor_correct_cough_classification',
                'supervisor_confirms_diarrhea', /* multi handled above */
                'supervisor_confirms_fever', /* multi handled above */
                'supervisor_confirms_ear', 'worker_ear_classification', 'supervisor_correct_ear_classification',
                'worker_malnutrition_classification', 'supervisor_correct_malnutrition_classification',
                'worker_anemia_classification', 'supervisor_correct_anemia_classification'
            ];
             if (simpleAssessmentFields.includes(name)) {
                // Update simple fields within assessment_skills
                setFormData(prev => ({
                    ...prev,
                    assessment_skills: { ...prev.assessment_skills, [name]: value }
                }));
            } else if (name === 'finalDecision' || name === 'decisionMatches' || name === 'notes' || name === 'session_date') {
                 // Update top-level fields
                 setFormData(prev => ({ ...prev, [name]: value }));
             }
             // Note: SkillChecklistItem uses handleSkillChange, not this one.
        }
    };

    const handleSkillChange = (section, key, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section], // Spread existing skills in the section
                [key]: value,    // Update the specific skill,
            }
        }));
    };

    // --- NEW: Handler for saving facility data from modal ---
    const handleSaveFacilityData = async (formData) => {
        try {
            // This function is used by NewFacilityEntryForm and PublicFacilityUpdateForm
            await submitFacilityDataForApproval(formData);
            setToast({ show: true, message: "Update submitted successfully! Your changes are pending approval.", type: 'success' });
            setIsFacilityModalOpen(false); // Close modal on success
        } catch (error) {
            setToast({ show: true, message: `Submission failed: ${error.message}`, type: 'error' });
            // Don't close modal on failure
        }
    };

    // --- Submit handler for final save ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        // --- START: NEW COMPREHENSIVE VALIDATION ---
        // This check is now redundant because the button is disabled,
        // but it serves as a final backend-style check in case of a race condition.
        if (!isFormFullyComplete) {
             const validationMessages = [];
             if (!isVitalSignsComplete(formData)) validationMessages.push('خطوة 1: القياسات الجسمانية والحيوية');
             if (!isDangerSignsComplete(formData)) validationMessages.push('خطوة 2: علامات الخطورة العامة');
             if (!isMainSymptomsComplete(formData)) validationMessages.push('خطوة 3: الأعراض الأساسية (بما في ذلك التصنيفات)');
             if (!isMalnutritionComplete(formData)) validationMessages.push('خطوة 4: سوء التغذية الحاد (بما في ذلك التصنيفات)');
             if (!isAnemiaComplete(formData)) validationMessages.push('خطوة 5: فقر الدم (بما في ذلك التصنيفات)');
             if (!isImmunizationComplete(formData)) validationMessages.push('خطوة 6: التطعيم وفيتامين أ');
             if (!isOtherProblemsComplete(formData)) validationMessages.push('خطوة 7: الأمراض الأخرى');
             if (!isDecisionComplete(formData)) validationMessages.push('خطوة 8: القرار النهائي');
             const incompleteTreatment = findIncompleteTreatmentSkills(formData);
             if (incompleteTreatment.length > 0) {
                validationMessages.push(`خطوة 9: حقول العلاج والنصح (ناقص: ${incompleteTreatment[0]}...)`);
             }
             
             const errorMessage = `لا يمكن الحفظ. الرجاء إكمال الأقسام التالية: \n- ${validationMessages.join('\n- ')}`;
             setToast({ 
                show: true, 
                message: errorMessage, 
                type: 'error',
                duration: 10000 // Give user time to read
             });
             return; // Block submission
        }
        // --- END: NEW COMPREHENSIVE VALIDATION ---


        setIsSaving(true);
        try {
            // Payload processing
            const getSelectedKeys = (obj) => Object.entries(obj || {}).filter(([, isSelected]) => isSelected).map(([key]) => key);
            const assessmentSkillsPayload = {
                ...formData.assessment_skills,
                worker_diarrhea_classification: getSelectedKeys(formData.assessment_skills.worker_diarrhea_classification),
                supervisor_correct_diarrhea_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_diarrhea_classification),
                worker_fever_classification: getSelectedKeys(formData.assessment_skills.worker_fever_classification),
                supervisor_correct_fever_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_fever_classification),
            };
             // Cleanup unnecessary temporary fields (supervisor confirms flags etc.)
             // These flags are for form logic, not persistent data
            delete assessmentSkillsPayload.supervisor_confirms_cough;
            delete assessmentSkillsPayload.supervisor_confirms_diarrhea;
            delete assessmentSkillsPayload.supervisor_confirms_fever;
            delete assessmentSkillsPayload.supervisor_confirms_ear;
            // Remove agree flags if they were accidentally included
            delete assessmentSkillsPayload.supervisor_agrees_cough_classification;
            delete assessmentSkillsPayload.supervisor_agrees_diarrhea_classification;
            delete assessmentSkillsPayload.supervisor_agrees_fever_classification;
            delete assessmentSkillsPayload.supervisor_agrees_ear_classification;
            delete assessmentSkillsPayload.supervisor_agrees_malnutrition_classification;
            delete assessmentSkillsPayload.supervisor_agrees_anemia_classification;


            // --- START: Score processing logic (Corrected) ---
            // Use calculated scores directly from state
            const calculatedScores = calculateScores(formData); // Recalculate just before save
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (key !== 'treatmentScoreForSave' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }
            scoresPayload['treatment_score'] = calculatedScores.treatmentScoreForSave ?? 0;
            scoresPayload['treatment_maxScore'] = calculatedScores['treatment']?.maxScore ?? 0;
            // --- END: Score processing logic (Corrected) ---


            const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));

            // ================== BEGIN FIX ==================
            // Apply optional chaining (?.) and null fallback (|| null)
            // to all fields derived from the `facility` prop.
            const payload = {
                serviceType: 'IMNCI', 
                state: facility?.['الولاية'] || null,
                locality: facility?.['المحلية'] || null,
                facilityId: facility?.id || null,
                facilityName: facility?.['اسم_المؤسسة'] || null,
                healthWorkerName: healthWorkerName,

                // --- START: ADDITIONS ---
                facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                workerType: healthWorkerJobTitle || null,
                // --- END: ADDITIONS ---

                sessionDate: formData.session_date, // Keep the original string
            // =================== END FIX ===================
                effectiveDate: effectiveDateTimestamp, // Add the Firestore Timestamp

                assessmentSkills: assessmentSkillsPayload,
                finalDecision: formData.finalDecision,
                decisionMatches: formData.decisionMatches,
                treatmentSkills: formData.treatment_skills, // Already cleaned by effect
                scores: scoresPayload,
                notes: formData.notes,
                mentorEmail: user?.email || 'unknown', mentorName: user?.displayName || 'Unknown Mentor',
                status: 'complete',
                visitNumber: visitNumber // Add visit number
            };

            // --- MODIFIED: Use the ref for the current ID ---
            const sessionId = editingIdRef.current;
            const savedSession = await saveMentorshipSession(payload, sessionId); // Use the correct function signature (payload, optional id)

            setToast({ show: true, message: 'تم حفظ الجلسة بنجاح!', type: 'success' });
            // onCancel(); // <-- REMOVED
            if (onSaveComplete) onSaveComplete('complete', payload); // <-- ADDED: Pass status and saved data
        } catch (error) {
            console.error("Error saving mentorship session:", error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // --- Submit handler for saving as draft ---
    const handleSaveDraft = async (e) => {
         e.preventDefault();
         // NO VALIDATION FOR DRAFTS

         setIsSavingDraft(true);
         try {
             // Payload processing (similar to final save, but status is 'draft')
             const getSelectedKeys = (obj) => Object.entries(obj || {}).filter(([, isSelected]) => isSelected).map(([key]) => key);
             const assessmentSkillsPayload = {
                 ...formData.assessment_skills,
                 worker_diarrhea_classification: getSelectedKeys(formData.assessment_skills.worker_diarrhea_classification),
                 supervisor_correct_diarrhea_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_diarrhea_classification),
                 worker_fever_classification: getSelectedKeys(formData.assessment_skills.worker_fever_classification),
                 supervisor_correct_fever_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_fever_classification),
             };
              // Cleanup temporary fields
            delete assessmentSkillsPayload.supervisor_confirms_cough;
            delete assessmentSkillsPayload.supervisor_confirms_diarrhea;
            delete assessmentSkillsPayload.supervisor_confirms_fever;
            delete assessmentSkillsPayload.supervisor_confirms_ear;

            // --- START: Score processing logic (Corrected) ---
            // Calculate and format scores for draft
            const calculatedScores = calculateScores(formData); // Recalculate
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (key !== 'treatmentScoreForSave' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }
            scoresPayload['treatment_score'] = calculatedScores.treatmentScoreForSave ?? 0;
            scoresPayload['treatment_maxScore'] = calculatedScores['treatment']?.maxScore ?? 0;
            // --- END: Score processing logic (Corrected) ---


             const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));

            // ================== BEGIN FIX ==================
            // Apply optional chaining (?.) and null fallback (|| null)
            // to all fields derived from the `facility` prop.
             const payload = {
                 serviceType: 'IMNCI', 
                 state: facility?.['الولاية'] || null,
                 locality: facility?.['المحلية'] || null,
                 facilityId: facility?.id || null,
                 facilityName: facility?.['اسم_المؤسسة'] || null,
                 healthWorkerName: healthWorkerName,
                 
                 // --- START: ADDITIONS ---
                 facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                 workerType: healthWorkerJobTitle || null,
                 // --- END: ADDITIONS ---

                 sessionDate: formData.session_date,
            // =================== END FIX ===================
                 effectiveDate: effectiveDateTimestamp,
                 assessmentSkills: assessmentSkillsPayload,
                 finalDecision: formData.finalDecision,
                 decisionMatches: formData.decisionMatches,
                 treatmentSkills: formData.treatment_skills,
                 scores: scoresPayload, // Save scores even for draft
                 notes: formData.notes,
                 mentorEmail: user?.email || 'unknown', mentorName: user?.displayName || 'Unknown Mentor',
                status: 'draft', // Set status to draft
                 visitNumber: visitNumber // Add visit number
             };

             // --- MODIFIED: Use the ref for the current ID ---
             const sessionId = editingIdRef.current;
             
             // --- MODIFICATION: Capture return value ---
             const savedDraft = await saveMentorshipSession(payload, sessionId);

             // --- MODIFICATION: Call onDraftCreated if it was a new draft ---
             if (!sessionId && savedDraft && onDraftCreated) {
                 onDraftCreated(savedDraft);
                 // Update internal tracking ID
                 editingIdRef.current = savedDraft.id;
             }
             // --- END MODIFICATION ---

             setToast({ show: true, message: 'تم حفظ المسودة بنجاح!', type: 'success' });
             // onCancel(); // <-- REMOVED
             if (onSaveComplete) onSaveComplete('draft', payload); // <-- ADDED: Pass status and saved data
         } catch (error) {
            console.error("Error saving draft session:", error);
            setToast({ show: true, message: `فشل حفظ المسودة: ${error.message}` });
         } finally {
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
            <form onSubmit={handleSubmit}>
                <div className="p-6">
                    {/* --- Centered Title --- */}
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-sky-800">
                            متابعة مهارات العلاج المتكامل للأطفال اقل من 5 سنوات
                        </h2>
                    </div>

                    {/* --- Compact Info Cards Wrapper (Reduced margin between cards) --- */}
                    <div className="space-y-2 mb-4"> {/* Reduced bottom margin */}

                        {/* --- Compact Facility Info Card --- */}
                        <div className="p-2 border rounded-lg bg-gray-50 text-right space-y-0.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-0.5" dir="rtl">
                                <div><span className="text-sm font-medium text-gray-500">الولاية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['الولاية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">المحلية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['المحلية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">اسم المؤسسة:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['اسم_المؤسسة'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">نوع المؤسسة:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['نوع_المؤسسةالصحية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">العدد الكلي للكوادر الطبية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['العدد_الكلي_للكوادر_الطبية_العاملة_أطباء_ومساعدين'] ?? 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">الكوادر المدربة (IMNCI):</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل'] ?? 'غير محدد'}</span></div>
                            </div>
                        </div>

                        {/* --- Compact Health Worker Info Card --- */}
                        <div className="p-2 border rounded-lg bg-gray-50 text-right space-y-0.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-0.5" dir="rtl">
                                <div><span className="text-sm font-medium text-gray-500">اسم العامل الصحي:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerName || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">الوصف الوظيفي:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerJobTitle || 'غير محدد'}</span></div>
                                <div className="whitespace-nowrap overflow-hidden text-ellipsis"><span className="text-sm font-medium text-gray-500">تاريخ اخر تدريب (IMNCI):</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerTrainingDate || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">رقم الهاتف:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerPhone || 'غير محدد'}</span></div>
                            </div>
                        </div>

                        {/* --- Compact Mentor/Session Info Card --- */}
                        <div className="p-2 border rounded-lg bg-gray-50 text-right">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-0.5 items-end" dir="rtl">
                                {/* Using simple divs for display */}
                                <div className="text-sm"><span className="font-medium text-gray-500">اسم المشرف:</span><span className="font-semibold text-gray-900 mr-2">{user?.displayName || user?.email || '...'}</span></div>
                                <div className="text-sm"><span className="font-medium text-gray-500">تاريخ الجلسة:</span>
                                    {/* Swapped to Input to allow editing date */}
                                    <Input 
                                        type="date" 
                                        name="session_date" 
                                        value={formData.session_date} 
                                        onChange={handleFormChange} 
                                        required 
                                        className="p-1 text-sm mr-2 w-auto"
                                    />
                                </div>
                                {/* MODIFIED: Display lastSessionDate prop */}
                                <div className="text-sm">
                                    <span className="font-medium text-gray-500">تاريخ الجلسة السابقة:</span>
                                    {/* Ensure prop is displayed whether it's 'N/A' or a date string */}
                                    <span className="font-semibold text-gray-900 mr-2">{lastSessionDate || '---'}</span> 
                                </div>
                                {/* MODIFIED: Display visitNumber prop */}
                                <div className="text-sm"><span className="font-medium text-gray-700">رقم الجلسة:</span>
                                    {/* Ensure prop is displayed whether it's 'N/A' or a number */}
                                    <span className="text-lg font-bold text-sky-700 mr-2">{visitNumber}</span>
                                </div>
                                
                            </div>
                        </div>
                    </div>
                    {/* --- END Compact Info Cards Wrapper --- */}


                    {/* Form Structure Mapping */}
                    {IMNCI_FORM_STRUCTURE.map(group => {
                        const isGroupVisible = !group.step || visibleStep >= group.step;
                        if (!isGroupVisible) return null;
                         const groupScoreData = group.scoreKey ? scores[group.scoreKey] : (group.sectionKey === 'assessment_skills' ? scores['assessment_total_score'] : (group.sectionKey === 'treatment_skills' ? scores['treatment'] : null));

                         // Decision Section Rendering
                         if (group.isDecisionSection) {
                             return (
                                <div key={group.group} className="mb-8">
                                    <h3 dir="rtl" className="flex justify-between items-center text-xl font-bold mb-4 text-white bg-sky-900 p-2 rounded-md text-right">
                                        <span className="flex items-center">
                                            {groupScoreData && <ScoreCircle score={groupScoreData.score} maxScore={groupScoreData.maxScore} />}
                                            <span className="mr-2">{group.group}</span> {/* Margin for spacing */}
                                        </span>
                                    </h3>
                                    <div className="mb-4 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                                        <div className="p-4 space-y-4 md:space-y-0 md:flex md:items-end md:gap-6 text-right" dir="rtl">
                                            <FormGroup label="القرار النهائي حسب تقييم العامل الصحي" className="text-right flex-1 min-w-0">
                                                <Select name="finalDecision" value={formData.finalDecision} onChange={handleFormChange}>
                                                    <option value="">-- اختر القرار --</option>
                                                    <option value="referral">تحويل عاجل</option>
                                                    <option value="treatment">علاج ونصائح منزلية</option>
                                                </Select>
                                            </FormGroup>
                                            {/* --- START: MODIFIED - Sequential logic for Decision --- */}
                                            {formData.finalDecision !== '' && (
                                                <FormGroup label="هل يتطابق قرار العامل الصحي مع المشرف؟" className="text-right flex-shrink-0">
                                                    <Select name="decisionMatches" value={formData.decisionMatches} onChange={handleFormChange} className="min-w-[100px]">
                                                        <option value="">-- اختر --</option>
                                                        <option value="yes">نعم</option>
                                                        <option value="no">لا</option>
                                                    </Select>
                                                </FormGroup>
                                            )}
                                            {/* --- END: MODIFIED --- */}
                                        </div>
                                    </div>
                                </div>
                             );
                        }

                        // Other Group Rendering
                        return (
                            <div key={group.group} className="mb-8">
                                {/* Group Header */}
                                <h3 dir="rtl" className={`flex justify-between items-center text-xl font-bold mb-4 border-b pb-2 text-right ${ group.group.includes('الأعراض الأساسية') ? 'text-white bg-sky-900 p-2 rounded-md border-b-0' : 'text-gray-800 border-gray-300' }`}>
                                    <span className="flex items-center">
                                        {groupScoreData && <ScoreCircle score={groupScoreData.score} maxScore={groupScoreData.maxScore} />}
                                        <span className="mr-2">{group.group}</span> {/* Margin for spacing */}
                                    </span>
                                </h3>
                                {/* Subgroups */}
                                {Array.isArray(group.subgroups) && group.subgroups.map(subgroup => {
                                    const isSubgroupVisible = !subgroup.step || visibleStep >= subgroup.step;
                                    if (!isSubgroupVisible) return null;
                                     const subgroupScoreData = subgroup.scoreKey ? scores[subgroup.scoreKey] : null;

                                    let isSubgroupRelevant = true;
                                    if (subgroup.relevant) {
                                        isSubgroupRelevant = typeof subgroup.relevant === 'function'
                                            ? subgroup.relevant(formData)
                                            : evaluateRelevance(subgroup.relevant, formData);
                                    }
                                    if (!isSubgroupRelevant) return null; // Don't render if not relevant

                                    // Symptom Group Container Rendering
                                    if (subgroup.isSymptomGroupContainer && Array.isArray(subgroup.symptomGroups)) {
                                        return (
                                            <div key={subgroup.subgroupTitle} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                                <h4 dir="rtl" className="flex items-center text-sm font-bold mb-4 text-sky-800 text-right">
                                                    {subgroupScoreData && <ScoreCircle score={subgroupScoreData.score} maxScore={subgroupScoreData.maxScore} />}
                                                    <span className="mr-2">{subgroup.subgroupTitle}</span> {/* Margin for spacing */}
                                                </h4>
                                                {subgroup.symptomGroups.map(symptomGroup => {
                                                     const mainSkill = symptomGroup.mainSkill; if (!mainSkill?.key) return null;
                                                     const { assessment_skills } = formData;
                                                     
                                                    // --- START: NEW Sequential Visibility Logic ---
                                                    let isSymptomGroupSequentiallyVisible = true;
                                                    if (!editingIdRef.current) { // Only apply sequential logic if NOT editing a draft
                                                        if (mainSkill.key === 'skill_ask_diarrhea') {
                                                            // Diarrhea only shows if Cough is complete
                                                            isSymptomGroupSequentiallyVisible = isCoughBlockComplete(assessment_skills);
                                                        }
                                                        else if (mainSkill.key === 'skill_ask_fever') {
                                                            // Fever only shows if Cough AND Diarrhea are complete
                                                            isSymptomGroupSequentiallyVisible = isCoughBlockComplete(assessment_skills) && 
                                                                                                isDiarrheaBlockComplete(assessment_skills);
                                                        }
                                                        else if (mainSkill.key === 'skill_ask_ear') {
                                                            // Ear only shows if Cough, Diarrhea, AND Fever are complete
                                                            isSymptomGroupSequentiallyVisible = isCoughBlockComplete(assessment_skills) && 
                                                                                                isDiarrheaBlockComplete(assessment_skills) &&
                                                                                                isFeverBlockComplete(assessment_skills);
                                                        }
                                                        // 'skill_ask_cough' always shows (isSymptomGroupSequentiallyVisible = true)
                                                    }
                                                    
                                                    if (!isSymptomGroupSequentiallyVisible) return null; // Hide this symptom group
                                                    // --- END: NEW Sequential Visibility Logic ---
                                                     
                                                     let symptomPrefix = ''; let symptomClassifications = []; let originalCheckSkill = null; let originalClassifySkill = null; let supervisorConfirmLabel = ''; let multiSelectCols = null;
                                                     const symptomScoreData = mainSkill.scoreKey ? scores[mainSkill.scoreKey] : null;
                                                     const symptomScoreCircle = symptomScoreData ? <ScoreCircle score={symptomScoreData.score} maxScore={symptomScoreData.maxScore} /> : null;
                                                     switch (mainSkill.key) { case 'skill_ask_cough': symptomPrefix = 'cough'; symptomClassifications = COUGH_CLASSIFICATIONS; originalCheckSkill = { key: 'skill_check_rr', label: 'هل قاس معدل التنفس بصورة صحيحة'}; originalClassifySkill = { key: 'skill_classify_cough', label: 'هل صنف الكحة بصورة صحيحة'}; supervisorConfirmLabel = 'هل يوجد كحة او ضيق تنفس (سؤال للمشرف)'; break; case 'skill_ask_diarrhea': symptomPrefix = 'diarrhea'; symptomClassifications = DIARRHEA_CLASSIFICATIONS; originalCheckSkill = { key: 'skill_check_dehydration', label: 'هل قيم فقدان السوائل بصورة صحيحة'}; originalClassifySkill = { key: 'skill_classify_diarrhea', label: 'هل صنف الاسهال بصورة صحيحة'}; supervisorConfirmLabel = 'هل يوجد إسهال (سؤال للمشرف)'; multiSelectCols = { col1: DIARRHEA_COLS_1, col2: DIARRHEA_COLS_2 }; break; case 'skill_ask_fever': symptomPrefix = 'fever'; symptomClassifications = FEVER_CLASSIFICATIONS; originalCheckSkill = { key: 'skill_check_rdt', label: 'هل أجرى فحص الملاريا السريع بصورة صحيحة'}; originalClassifySkill = { key: 'skill_classify_fever', label: 'هل صنف الحمى بصورة صحيحة'}; supervisorConfirmLabel = 'هل يوجد حمى (سؤال للمشرف)'; multiSelectCols = { col1: FEVER_COLS_1, col2: FEVER_COLS_2 }; break; case 'skill_ask_ear': symptomPrefix = 'ear'; symptomClassifications = EAR_CLASSIFICATIONS; originalCheckSkill = { key: 'skill_check_ear', label: 'هل فحص الفحص ورم مؤلم خلف الأذن'}; originalClassifySkill = { key: 'skill_classify_ear', label: 'هل صنف مشكلة الأذن بصورة صحيحة'}; supervisorConfirmLabel = 'هل يوجد مشكلة اذن (سؤال للمشرف)'; break; default: return null; }
                                                     const supervisorConfirmsKey = `supervisor_confirms_${symptomPrefix}`; const workerClassKey = `worker_${symptomPrefix}_classification`; const correctClassKey = `supervisor_correct_${symptomPrefix}_classification`; const classifySkillKey = `skill_classify_${symptomPrefix}`;
                                                     const mainSkillValue = formData[group.sectionKey]?.[mainSkill.key];
                                                     const isMainRelevant = true;
                                                     if (!isMainRelevant) return null;
                                                     const isMultiSelectClassification = ['diarrhea', 'fever'].includes(symptomPrefix);
                                                     const showSubQuestions = mainSkillValue === 'yes';
                                                     const showClassifications = showSubQuestions && formData.assessment_skills[supervisorConfirmsKey] === 'yes';
                                                     const showSupervisorCorrection = showClassifications && formData.assessment_skills[classifySkillKey] === 'no';

                                                    return (
                                                        <div key={mainSkill.key} className="mb-4 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                                                            {/* Main Symptom Question */}
                                                            <SkillChecklistItem name={mainSkill.key} label={mainSkill.label} value={mainSkillValue} onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)} showNaOption={false} isMainSymptom={true} scoreCircle={symptomScoreCircle} />

                                                            {/* Sub-questions and Classifications */}
                                                            {showSubQuestions && (
                                                                <div dir="rtl" className="p-4 pt-2 bg-gray-50 space-y-4 text-right rounded-b-md">
                                                                    {/* Supervisor Confirmation */}
                                                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center py-2">
                                                                         <span className="text-sm font-medium text-gray-800 mb-2 sm:mb-0 sm:ml-4 text-right">{supervisorConfirmLabel}</span>
                                                                         <div className="flex gap-4 mt-1 sm:mt-0 flex-shrink-0">
                                                                              <label className="flex items-center gap-1 cursor-pointer text-sm"> <input type="radio" name={supervisorConfirmsKey} value="yes" checked={formData.assessment_skills[supervisorConfirmsKey] === 'yes'} onChange={handleFormChange} className="form-radio text-green-600"/> نعم </label>
                                                                              <label className="flex items-center gap-1 cursor-pointer text-sm"> <input type="radio" name={supervisorConfirmsKey} value="no" checked={formData.assessment_skills[supervisorConfirmsKey] === 'no'} onChange={handleFormChange} className="form-radio text-red-600"/> لا </label>
                                                                         </div>
                                                                    </div>

                                                                    {/* --- START: MODIFIED - Sequential Check and Classify Skills --- */}
                                                                    {showClassifications && ( <>
                                                                        {/* 1. Check Skill (e.g., skill_check_rr) */}
                                                                        {originalCheckSkill && <SkillChecklistItem key={originalCheckSkill.key} name={originalCheckSkill.key} label={originalCheckSkill.label} value={formData.assessment_skills[originalCheckSkill.key]} onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)} showNaOption={false} />}
                                                                        
                                                                        {/* 2. Classify Skill (e.g., skill_classify_cough) - Only show if check skill is answered */}
                                                                        {originalClassifySkill && formData.assessment_skills[originalCheckSkill.key] !== '' && (
                                                                            <SkillChecklistItem key={originalClassifySkill.key} name={originalClassifySkill.key} label={originalClassifySkill.label} value={formData.assessment_skills[classifySkillKey]} onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)} showNaOption={false} />
                                                                        )}

                                                                        {/* 3. Worker Classification - Only show if classify skill is answered (and not 'na') */}
                                                                        {formData.assessment_skills[classifySkillKey] !== '' && formData.assessment_skills[classifySkillKey] !== 'na' && (
                                                                            <FormGroup label="ما هو التصنيف الذي الذي صنفه العامل الصحي؟" className="text-right">
                                                                                {isMultiSelectClassification && multiSelectCols ? (
                                                                                    <div className="max-h-40 overflow-y-auto border rounded p-3 bg-white grid grid-cols-2 gap-x-4">
                                                                                        <div className="space-y-1">{multiSelectCols.col1.map(c => ( <div key={c} className="flex items-center gap-2"> <Checkbox label="" id={`${workerClassKey}-${c.replace(/\s+/g, '-')}`} name={c} checked={!!formData.assessment_skills[workerClassKey]?.[c]} onChange={handleFormChange} /> <label htmlFor={`${workerClassKey}-${c.replace(/\s+/g, '-')}`} className="cursor-pointer text-sm">{c}</label> </div> ))}</div>
                                                                                        <div className="space-y-1">{multiSelectCols.col2.map(c => ( <div key={c} className="flex items-center gap-2"> <Checkbox label="" id={`${workerClassKey}-${c.replace(/\s+/g, '-')}`} name={c} checked={!!formData.assessment_skills[workerClassKey]?.[c]} onChange={handleFormChange} /> <label htmlFor={`${workerClassKey}-${c.replace(/\s+/g, '-')}`} className="cursor-pointer text-sm">{c}</label> </div> ))}</div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <Select name={workerClassKey} value={formData.assessment_skills[workerClassKey]} onChange={handleFormChange}> <option value="">-- اختر التصنيف --</option> {symptomClassifications.map(c => <option key={c} value={c}>{c}</option>)} </Select>
                                                                                )}
                                                                            </FormGroup>
                                                                        )}

                                                                        {/* 4. Supervisor Correction - Only show if:
                                                                             - classify skill is 'no' (existing logic: showSupervisorCorrection)
                                                                             - worker classification is filled (new logic)
                                                                        */}
                                                                        {showSupervisorCorrection && (
                                                                             (isMultiSelectClassification && !isMultiSelectGroupEmpty(formData.assessment_skills[workerClassKey])) ||
                                                                             (!isMultiSelectClassification && formData.assessment_skills[workerClassKey] !== '')
                                                                        ) && (
                                                                            <FormGroup label="ما هو التصنيف الصحيح؟" className="text-right">
                                                                                {isMultiSelectClassification && multiSelectCols ? (
                                                                                     <div className="max-h-40 overflow-y-auto border rounded p-3 bg-white grid grid-cols-2 gap-x-4">
                                                                                         <div className="space-y-1">{multiSelectCols.col1.map(c => ( <div key={c} className="flex items-center gap-2"> <Checkbox label="" id={`${correctClassKey}-${c.replace(/\s+/g, '-')}`} name={c} checked={!!formData.assessment_skills[correctClassKey]?.[c]} onChange={handleFormChange} /> <label htmlFor={`${correctClassKey}-${c.replace(/\s+/g, '-')}`} className="cursor-pointer text-sm">{c}</label> </div> ))}</div>
                                                                                         <div className="space-y-1">{multiSelectCols.col2.map(c => ( <div key={c} className="flex items-center gap-2"> <Checkbox label="" id={`${correctClassKey}-${c.replace(/\s+/g, '-')}`} name={c} checked={!!formData.assessment_skills[correctClassKey]?.[c]} onChange={handleFormChange} /> <label htmlFor={`${correctClassKey}-${c.replace(/\s+/g, '-')}`} className="cursor-pointer text-sm">{c}</label> </div> ))}</div>
                                                                                     </div>
                                                                                ) : (
                                                                                    <Select name={correctClassKey} value={formData.assessment_skills[correctClassKey]} onChange={handleFormChange}> <option value="">-- اختر التصنيف الصحيح --</option> {symptomClassifications.map(c => <option key={c} value={c}>{c}</option>)} </Select>
                                                                                )}
                                                                            </FormGroup>
                                                                        )}
                                                                    </> )}
                                                                    {/* --- END: MODIFIED --- */}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }
                                    // Regular Subgroup Rendering
                                    else if (Array.isArray(subgroup.skills)) {
                                        const isVitalSignsGroup = subgroup.subgroupTitle === 'القياسات الجسمانية والحيوية';
                                        
                                        // --- START: MODIFIED - Remove pre-filtering ---
                                        // const relevantSkills = subgroup.skills.filter(skill => { ... }); // <-- This is removed
                                        // --- END: MODIFIED ---
                                        
                                        // if (relevantSkills.length === 0) return null; // <-- This is removed
                                        
                                        const isMalnutrition = subgroup.subgroupTitle === 'تحرى عن سوء التغذية الحاد'; const isAnemia = subgroup.subgroupTitle === 'تحرى عن الانيميا'; let classPrefix = ''; let classifications = []; if (isMalnutrition) { classPrefix = 'malnutrition'; classifications = MALNUTRITION_CLASSIFICATIONS; } if (isAnemia) { classPrefix = 'anemia'; classifications = ANEMIA_CLASSIFICATIONS; } const workerClassKey = `worker_${classPrefix}_classification`; const correctClassKey = `supervisor_correct_${classPrefix}_classification`; const classifySkillKey = isMalnutrition ? 'skill_mal_classify' : isAnemia ? 'skill_anemia_classify' : null;
                                        const showClassifications = (isMalnutrition || isAnemia) && classifySkillKey;
                                        const showSupervisorCorrection = showClassifications && formData.assessment_skills[classifySkillKey] === 'no';

                                        return (
                                            <div key={subgroup.subgroupTitle} className="mb-4 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                                                {/* Subgroup Header */}
                                                <h5 dir="rtl" className="flex items-center text-sm font-bold text-white bg-sky-700 p-3 text-right">
                                                    {subgroupScoreData && <ScoreCircle score={subgroupScoreData.score} maxScore={subgroupScoreData.maxScore} />}
                                                    <span className="mr-2">{subgroup.subgroupTitle}</span> {/* Margin for spacing */}
                                                </h5>
                                                <div className="space-y-3 p-4 text-right" dir="rtl">
                                                    {/* --- START: MODIFIED - Skills mapping with sequential logic --- */}
                                                    {subgroup.skills.map((skill, index) => {
                                                        // 1. Check existing relevance logic (e.g., for treatment skills)
                                                        let isConditionallyRelevant = true;
                                                        if (skill.relevant) {
                                                            isConditionallyRelevant = typeof skill.relevant === 'function'
                                                                ? skill.relevant(formData)
                                                                : evaluateRelevance(skill.relevant, formData);
                                                        }
                                                        if (!isConditionallyRelevant) return null; // Hide if explicitly irrelevant

                                                        // 2. Check sequential logic
                                                        let isSequentiallyVisible = true;
                                                        if (!editingIdRef.current && index > 0) { // Only apply if NOT editing and not the first item
                                                            // Find the *previous* skill in the list that was *also* conditionally relevant
                                                            let previousRelevantSkill = null;
                                                            for (let i = index - 1; i >= 0; i--) {
                                                                const prevSkill = subgroup.skills[i];
                                                                let prevSkillIsRelevant = true;
                                                                if (prevSkill.relevant) {
                                                                    prevSkillIsRelevant = typeof prevSkill.relevant === 'function'
                                                                        ? prevSkill.relevant(formData)
                                                                        : evaluateRelevance(prevSkill.relevant, formData);
                                                                }
                                                                if (prevSkillIsRelevant) {
                                                                    previousRelevantSkill = prevSkill;
                                                                    break; // Found the first preceding relevant skill
                                                                }
                                                            }

                                                            if (previousRelevantSkill) {
                                                                const previousValue = formData[group.sectionKey]?.[previousRelevantSkill.key];
                                                                if (previousValue === '' || previousValue === undefined) {
                                                                    isSequentiallyVisible = false; // Hide if previous relevant skill is not answered
                                                                }
                                                            }
                                                        }

                                                        if (!isSequentiallyVisible) return null; // Hide if sequentially blocked

                                                        // If both checks pass, render the item
                                                        return (
                                                            <SkillChecklistItem
                                                                key={skill.key}
                                                                name={skill.key}
                                                                label={skill.label}
                                                                value={formData[group.sectionKey]?.[skill.key]}
                                                                onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)}
                                                                showNaOption={isVitalSignsGroup}
                                                                naLabel={isVitalSignsGroup ? "لا يوجد / لا يعمل الجهاز" : "لا ينطبق"}
                                                            />
                                                        );
                                                    })}
                                                    {/* --- END: MODIFIED --- */}
                                                    
                                                    {/* --- START: MODIFIED - Classifications with sequential logic --- */}
                                                    {showClassifications && (
                                                        <div className="pt-4 mt-4 border-t border-gray-200 space-y-4">
                                                            {/* Check if the 'classify' skill has been answered.
                                                              (classifySkillKey holds 'skill_mal_classify' or 'skill_anemia_classify')
                                                            */}
                                                            {formData.assessment_skills[classifySkillKey] !== '' && formData.assessment_skills[classifySkillKey] !== 'na' && (
                                                                <FormGroup label="ما هو التصنيف الذي الذي صنفه العامل الصحي؟" className="text-right">
                                                                     <Select name={workerClassKey} value={formData.assessment_skills[workerClassKey]} onChange={handleFormChange}> <option value="">-- اختر التصنيف --</option> {classifications.map(c => <option key={c} value={c}>{c}</option>)} </Select>
                                                                </FormGroup>
                                                            )}
                                                            
                                                            {/* Check for supervisor correction.
                                                              This should only show if:
                                                              1. The main 'classify' skill is 'no' (existing logic: showSupervisorCorrection)
                                                              2. The worker classification dropdown has been filled.
                                                            */}
                                                            {showSupervisorCorrection && formData.assessment_skills[workerClassKey] !== '' && (
                                                                <FormGroup label="ما هو التصنيف الصحيح؟" className="text-right">
                                                                     <Select name={correctClassKey} value={formData.assessment_skills[correctClassKey]} onChange={handleFormChange}> <option value="">-- اختر التصنيف الصحيح --</option> {classifications.map(c => <option key={c} value={c}>{c}</option>)} </Select>
                                                                </FormGroup>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* --- END: MODIFIED --- */}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        );
                    })}

                    {/* --- Notes Section --- */}
                    {(visibleStep >= 9 || !!editingIdRef.current) && ( // Use ref here
                        <>
                           <FormGroup label="ملاحظات عامة" className="text-right">
                                <Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={4} placeholder="أضف أي ملاحظات إضافية حول الجلسة..." className="text-right placeholder:text-right"/>
                           </FormGroup>
                        </>
                    )}
                </div>

                 {/* --- START: Button Bar (MODIFIED for 2 rows) --- */}
                 <div className="hidden sm:flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                     
                     {/* Row 1: Action Buttons (MOVED UP) */}
                     <div className="flex gap-2 flex-wrap justify-end">
                        <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft}> إلغاء </Button>
                        <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving || isSavingDraft}> {isSavingDraft ? 'جاري حفظ المسودة...' : 'حفظ كمسودة'} </Button>
                        <Button 
                            type="submit" 
                            disabled={isSaving || isSavingDraft || !isFormFullyComplete} 
                            title={!isFormFullyComplete ? "يجب إكمال جميع الخطوات أولاً لحفظ الجلسة" : "حفظ وإنهاء الجلسة"}
                        > 
                            {isSaving ? 'جاري الحفظ...' : 'حفظ وإكمال الجلسة'} 
                        </Button>
                     </div>

                     {/* Row 2: Navigation Buttons (MOVED DOWN) */}
                     <div className="flex gap-2 flex-wrap justify-end">
                        {/* --- NEW FACILITY FORM BUTTON --- */}
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsFacilityModalOpen(true)} 
                            disabled={isSaving || isSavingDraft || !facility} // Also disable if facility prop is null
                            title={facility ? "Open IMNCI Facility Data Form" : "No facility selected"}
                        >
                            بيانات المنشأة (IMNCI)
                        </Button>
                        {/* --- END NEW BUTTON --- */}

                        {/* --- START: NEW MOTHER'S FORM BUTTON --- */}
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsMothersFormModalOpen(true)} 
                            disabled={isSaving || isSavingDraft || !facility}
                            title={facility ? "Open Mother's Survey" : "No facility selected"}
                        >
                            استبيان الأم
                        </Button>
                        {/* --- END: NEW MOTHER'S FORM BUTTON --- */}
                        
                        {/* --- START: NEW DASHBOARD BUTTON --- */}
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsDashboardModalOpen(true)} 
                            disabled={isSaving || isSavingDraft}
                            title="Open Dashboard"
                        >
                            لوحة المتابعة
                        </Button>
                        {/* --- END: NEW DASHBOARD BUTTON --- */}
                     </div>
                 </div>
                 {/* --- END: Button Bar (MODIFIED for 2 rows) --- */}

                {/* --- START: NEW Mobile Sticky Action Bar --- */}
                {/* This bar sits on top of the MobileFormNavBar (which is in the parent) */}
                <div className="flex sm:hidden fixed bottom-16 left-0 right-0 z-20 p-2 bg-gray-50 border-t border-gray-200 shadow-lg justify-around items-center" dir="rtl">
                    <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft} size="sm">
                        إلغاء
                    </Button>
                    <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving || isSavingDraft} size="sm">
                        {isSavingDraft ? 'جاري...' : 'حفظ مسودة'}
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={isSaving || isSavingDraft || !isFormFullyComplete} 
                        title={!isFormFullyComplete ? "يجب إكمال جميع الخطوات أولاً لحفظ الجلسة" : "حفظ وإنهاء الجلسة"}
                        size="sm"
                    > 
                        {isSaving ? 'جاري...' : 'حفظ وإكمال'} 
                    </Button>
                </div>
                {/* --- END: NEW Mobile Sticky Action Bar --- */}

            </form>

            {/* --- NEW FACILITY DATA MODAL --- */}
            {isFacilityModalOpen && facility && (
                <Modal 
                    isOpen={isFacilityModalOpen} 
                    onClose={() => setIsFacilityModalOpen(false)} 
                    title={`بيانات منشأة: ${facility['اسم_المؤسسة'] || ''}`}
                    size="full"
                >
                    <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto"> {/* Give modal content scroll */}
                        <GenericFacilityForm
                            initialData={facility}
                            onSave={handleSaveFacilityData}
                            onCancel={() => setIsFacilityModalOpen(false)}
                            setToast={setToast}
                            title="بيانات خدمة IMNCI"
                            subtitle={`تحديث البيانات للمنشأة: ${facility['اسم_المؤسسة'] || '...'}`}
                            isPublicForm={false} // This is an internal edit
                            saveButtonText="Submit for Approval"
                            cancelButtonText="Close"
                        >
                            {(props) => <IMNCIFormFields {...props} />}
                        </GenericFacilityForm>
                    </div>
                </Modal>
            )}
            {/* --- END NEW MODAL --- */}
        </Card>
    );
}); // MODIFIED: Closed forwardRef

export default SkillsAssessmentForm;