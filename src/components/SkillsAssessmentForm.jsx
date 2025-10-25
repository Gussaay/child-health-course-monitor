// SkillsAssessmentForm.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { saveMentorshipSession } from "../data.js";
// --- FIX: Import Timestamp ---
import { Timestamp } from 'firebase/firestore';
// --- END FIX ---
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox
} from './CommonComponents';
import { getAuth } from "firebase/auth";

// --- Single Skill Checklist Item (Unchanged) ---
const SkillChecklistItem = ({ label, value, onChange, name, showNaOption = true, naLabel = "لا ينطبق", isMainSymptom = false, scoreCircle = null }) => {
    const handleChange = (e) => { onChange(name, e.target.value); };

    const containerClasses = isMainSymptom
        ? "flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-sky-700 text-white rounded-t-md"
        : "flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-md bg-white shadow-sm transition-all hover:shadow-md sm:mr-4";

    const labelClasses = isMainSymptom
        ? "text-sm font-bold mb-2 sm:mb-0 sm:ml-4 text-right flex items-center"
        : "text-sm font-medium text-gray-800 mb-2 sm:mb-0 sm:ml-4 text-right";

    return (
        <div dir="rtl" className={containerClasses}>
            <span className={labelClasses}>
                {scoreCircle}
                <span>{label}</span>
            </span>
            <div className="flex gap-4 flex-shrink-0">
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

// --- Score Circle Component (Unchanged) ---
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

    return (
        <div
            className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-white font-bold text-xs shadow-md ml-3`}
            title={`${score} / ${maxScore} (${maxScore > 0 ? percentage + '%' : 'N/A'})`}
        >
            {maxScore === 0 ? 'N/A' : `${percentage}%`}
        </div>
    );
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

// --- Helper function to evaluate the relevance logic (Unchanged) ---
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
                { mainSkill: { key: 'skill_ask_cough', label: 'هل سأل عن وجود الكحة', scoreKey: 'symptom_cough' } },
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
                    { key: 'skill_ref_abx', label: 'في حالة التحويل : هل أعطى الجرعة الاولى من المضاد الحيوي المناسب قبل تحويل الطفل' },
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
                skills: [ { key: 'skill_pneu_abx', label: 'هل وصف مضاد حيوي لعلاج الالتهاب الرئوي بصورة صحيحة' }, { key: 'skill_pneu_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج الالتهاب الرئوي بالعيادة بصورة صحيحة', relevant: "${skill_pneu_abx}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification is 'التهاب رئوي'
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
                skills: [ { key: 'skill_diar_ors', label: 'هل حدد كمية محلول الإرواء بصورة صحيحة' }, { key: 'skill_diar_counsel', label: 'هل نصح الأم بالRعاية المنزلية بإعطاء سوائل أكثر و الاستمرار في تغذية الطفل)' }, { key: 'skill_diar_zinc', label: 'هل وصف دواء الزنك بصورة صحيحة' }, { key: 'skill_diar_zinc_dose', label: 'هل أعطى الجرعة الأولى من دواء الزنك للطفل بالوحدة الصحية بطريقة صحيحة', relevant: "${skill_diar_zinc}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification includes relevant keys (including 'لا يوجد جفاف')
                    const didClassifyCorrectly = formData.assessment_skills.skill_classify_diarrhea === 'yes';
                    const workerCls = formData.assessment_skills.worker_diarrhea_classification || {};
                    const supervisorCls = formData.assessment_skills.supervisor_correct_diarrhea_classification || {};
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    const relevantKeys = ['جفاف حاد', 'بعض الجفاف', 'إسهال مستمر شديد', 'إسهال مستمر', 'دسنتاريا', 'لا يوجد جفاف'];
                    return relevantKeys.some(key => effectiveCls[key]);
                }
            },
            {
                subgroupTitle: 'في حالة الدسنتاريا',
                scoreKey: 'dyst_treatment',
                skills: [ { key: 'skill_dyst_abx', label: 'هل وصف مضاد حيوي لعلاج الدسنتاريا بصورة صحيحة' }, { key: 'skill_dyst_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج الدسنتاريا في العيادة بصورة صحيحة', relevant: "${skill_dyst_abx}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification includes 'دسنتاريا'
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
                skills: [ { key: 'skill_mal_meds', label: 'هل وصف دواء لعلاج الملاريا بصورة صحيحة' }, { key: 'skill_mal_dose', label: 'هل أعطى الجرعة الأولى من الدواء لعلاج الملاريا في العيادة بصورة صحيحة', relevant: "${skill_mal_meds}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification includes 'ملاريا'
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
                skills: [ { key: 'skill_ear_abx', label: 'هل وصف مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة' }, { key: 'skill_ear_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة', relevant: "${skill_ear_abx}='yes'" }, { key: 'skill_ear_para', label: 'هل وصف دواء الباراسيتامول بصورة صحيحة' }, { key: 'skill_ear_para_dose', label: 'هل أعطى الجرعة الأولى من الباراسيتامول بصورة صحيحة', relevant: "${skill_ear_para}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification is 'التهاب اذن حاد' or 'التهاب اذن مزمن'
                    const didClassifyCorrectly = formData.assessment_skills.skill_classify_ear === 'yes';
                    const workerCls = formData.assessment_skills.worker_ear_classification;
                    const supervisorCls = formData.assessment_skills.supervisor_correct_ear_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return ['التهاب العظمة خلف الاذن', 'التهاب اذن حاد', 'التهاب اذن مزمن'].includes(effectiveCls);
                }
            },
            {
                subgroupTitle: 'في حالة سوء التغذية',
                scoreKey: 'nut_treatment',
                skills: [ { key: 'skill_nut_assess', label: 'قيم تغذية الطفل بما في ذلك مشاكل الرضاعة (لأقل من عمر سنتين)' }, { key: 'skill_nut_counsel', label: 'أرشد الأم عن تغذية الطفل بما في ذلك مشاكل الرضاعة الأقل من عمر سنتين)' }, ],
                relevant: (formData) => { // Show if effective classification is SAM or MAM
                    const didClassifyCorrectly = formData.assessment_skills.skill_mal_classify === 'yes';
                    const workerCls = formData.assessment_skills.worker_malnutrition_classification;
                    const supervisorCls = formData.assessment_skills.supervisor_correct_malnutrition_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return ['سوء تغذية حاد شديد مع مضاعفات', 'سوء تغذية حاد شديد من غير مضاعفات', 'سوء تغذية حاد متوسط'].includes(effectiveCls);
                }
            },
            {
                subgroupTitle: 'في حالة فقر الدم',
                scoreKey: 'anemia_treatment',
                skills: [ { key: 'skill_anemia_iron', label: 'هل وصف شراب حديد بصورة صحيحة' }, { key: 'skill_anemia_iron_dose', label: 'هل أعطى الجرعة الأولى من شراب حديد بصورة صحيحة', relevant: "${skill_anemia_iron}='yes'" }, ],
                relevant: (formData) => { // Show if effective classification is 'فقر دم'
                    const didClassifyCorrectly = formData.assessment_skills.skill_anemia_classify === 'yes';
                    const workerCls = formData.assessment_skills.worker_anemia_classification;
                    const supervisorCls = formData.assessment_skills.supervisor_correct_anemia_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return effectiveCls === 'فقر دم'; // Strict check
                }
            },
            { subgroupTitle: 'نصح الأم متى تعود للمتابعة',
                scoreKey: 'fu_treatment',
                skills: [ { key: 'skill_fu_when', label: 'هل ذكر لها علامتين علي الأقل إذا ظهرت على الطفل يجب أن تعود به فورا للوحدة الصحية' }, { key: 'skill_fu_return', label: 'هل حدد للام متى تعود بالطفل' }, ] }
        ]
    }
];

// --- Classification Constants (Unchanged) ---
const COUGH_CLASSIFICATIONS = ["التهاب رئوي حاد وخيم", "التهاب رئوي", "كحة أو زكام"];
const DIARRHEA_CLASSIFICATIONS = ["جفاف حاد", "بعض الجفاف", "لا يوجد جفاف", "إسهال مستمر شديد", "إسهال مستمر", "دسنتاريا"];
const DIARRHEA_COLS_1 = ["جفاف حاد", "بعض الجفاف", "لا يوجد جفاف"];
const DIARRHEA_COLS_2 = ["إسهال مستمر شديد", "إسهال مستمر", "دسنتاريا"];
const FEVER_CLASSIFICATIONS = ["مرض حمي شديد", "ملاريا", "حمى لا توجد ملاريا", "حصبة مصحوبة بمضاعفات شديدة", "حصبة مصحوبة بمضاعفات في العين والفم", "حصبة"];
const FEVER_COLS_1 = ["مرض حمي شديد", "ملاريا", "حمى لا توجد ملاريا"];
const FEVER_COLS_2 = ["حصبة مصحوبة بمضاعفات شديدة", "حصبة مصحوبة بمضاعفات في العين والفم", "حصبة"];
const EAR_CLASSIFICATIONS = ["التهاب العظمة خلف الاذن", "التهاب أذن حاد", "التهاب أذن مزمن", "لا يوجد التهاب أذن"];
const MALNUTRITION_CLASSIFICATIONS = ["سوء تغذية حاد شديد مع مضاعفات", "سوء تغذية حاد شديد من غير مضاعفات", "سوء تغذية حاد متوسط", "لا يوجد سوء تغذية"];
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

    rehydrated.assessment_skills.worker_diarrhea_classification =
        DIARRHEA_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = (assessmentDraft.worker_diarrhea_classification || []).includes(c);
            return acc;
        }, createInitialClassificationState(DIARRHEA_CLASSIFICATIONS));

    rehydrated.assessment_skills.supervisor_correct_diarrhea_classification =
        DIARRHEA_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = (assessmentDraft.supervisor_correct_diarrhea_classification || []).includes(c);
            return acc;
        }, createInitialClassificationState(DIARRHEA_CLASSIFICATIONS));

    rehydrated.assessment_skills.worker_fever_classification =
        FEVER_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = (assessmentDraft.worker_fever_classification || []).includes(c);
            return acc;
        }, createInitialClassificationState(FEVER_CLASSIFICATIONS));

    rehydrated.assessment_skills.supervisor_correct_fever_classification =
        FEVER_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = (assessmentDraft.supervisor_correct_fever_classification || []).includes(c);
            return acc;
        }, createInitialClassificationState(FEVER_CLASSIFICATIONS));

    return rehydrated;
};


// --- Function to calculate scores (updated logic) ---
const calculateScores = (formData) => {
    const scores = {};
    let totalCurrentScore = 0;
    let totalMaxScore = 0; // Total relevant max score

    IMNCI_FORM_STRUCTURE.forEach(group => {
        let groupCurrentScore = 0;
        let groupRelevantMaxScore = 0; // Track max score for relevant items in this group

        if (group.isDecisionSection) {
            groupRelevantMaxScore = 1; // Decision is always relevant and max 1
            groupCurrentScore = formData.decisionMatches === 'yes' ? 1 : 0;
            totalMaxScore += groupRelevantMaxScore; // Add to total max
            totalCurrentScore += groupCurrentScore; // Add to total current
            if (group.scoreKey) { // Store decision score
                scores[group.scoreKey] = { score: groupCurrentScore, maxScore: groupRelevantMaxScore };
            }
        } else if (group.sectionKey) {
            const sectionData = formData[group.sectionKey] || {};

            group.subgroups?.forEach(subgroup => {
                let subgroupCurrentScore = 0;
                let subgroupRelevantMaxScore = 0; // Max score for relevant items in subgroup
                let isSubgroupRelevantForScoring = true;

                // Check subgroup relevance first
                if (subgroup.relevant) {
                    if (typeof subgroup.relevant === 'function') {
                        isSubgroupRelevantForScoring = subgroup.relevant(formData);
                    } else if (typeof subgroup.relevant === 'string') {
                        isSubgroupRelevantForScoring = evaluateRelevance(subgroup.relevant, formData);
                    } else {
                         isSubgroupRelevantForScoring = false; // Unknown format
                    }
                }

                // If subgroup NOT relevant, skip scoring it
                if (!isSubgroupRelevantForScoring) {
                   if (subgroup.scoreKey) {
                        scores[subgroup.scoreKey] = { score: 0, maxScore: 0 }; // Report 0/0
                   }
                   // Ensure skills within are marked 'na' (should ideally happen in form effect)
                   // ...
                   return; // Skip to next subgroup
                }

                // Process relevant subgroup
                if (subgroup.isSymptomGroupContainer) {
                    subgroup.symptomGroups?.forEach(sg => {
                         const askSkillKey = sg.mainSkill.key;
                         const symptomPrefix = askSkillKey.split('_')[2];
                         const confirmsKey = `supervisor_confirms_${symptomPrefix}`;
                         const checkSkillKey = `skill_check_${symptomPrefix === 'cough' ? 'rr' : symptomPrefix === 'diarrhea' ? 'dehydration' : symptomPrefix === 'fever' ? 'rdt' : 'ear'}`;
                         const classifySkillKey = `skill_classify_${symptomPrefix}`;

                         let currentSymptomScore = 0;
                         let maxSymptomScore = 0;

                         // Score asking the question (always contributes 1 to max if not empty)
                         if (sectionData[askSkillKey] === 'yes' || sectionData[askSkillKey] === 'no') {
                            maxSymptomScore += 1;
                            if (sectionData[askSkillKey] === 'yes') currentSymptomScore += 1;
                         }

                         // Score sub-questions ONLY if asked AND confirmed by supervisor
                         if (sectionData[askSkillKey] === 'yes' && formData.assessment_skills?.[confirmsKey] === 'yes') {
                             // Check skill (contributes 1 to max if not empty/na)
                             if (sectionData[checkSkillKey] === 'yes' || sectionData[checkSkillKey] === 'no') {
                                maxSymptomScore += 1;
                                if (sectionData[checkSkillKey] === 'yes') currentSymptomScore += 1;
                             }
                             // Classify skill (contributes 1 to max if not empty/na)
                             if (sectionData[classifySkillKey] === 'yes' || sectionData[classifySkillKey] === 'no') {
                                maxSymptomScore += 1;
                                if (sectionData[classifySkillKey] === 'yes') currentSymptomScore += 1;
                             }
                         }
                         subgroupCurrentScore += currentSymptomScore;
                         subgroupRelevantMaxScore += maxSymptomScore; // Use relevant max
                         if (sg.mainSkill.scoreKey) {
                             scores[sg.mainSkill.scoreKey] = { score: currentSymptomScore, maxScore: maxSymptomScore };
                         }
                    });
                } else if (Array.isArray(subgroup.skills)) {
                    subgroup.skills.forEach(skill => {
                        let isSkillRelevantForScoring = true; // Assume relevant if subgroup is relevant
                        // Check individual skill relevance if defined
                        if (skill.relevant) {
                             if (typeof skill.relevant === 'function') {
                                isSkillRelevantForScoring = skill.relevant(formData);
                             } else if (typeof skill.relevant === 'string') {
                                 isSkillRelevantForScoring = evaluateRelevance(skill.relevant, formData);
                             } else {
                                isSkillRelevantForScoring = false;
                             }
                        }

                        // If the skill is relevant for scoring (based on subgroup and skill relevance)
                        if (isSkillRelevantForScoring) {
                            const value = sectionData[skill.key];
                            // Only count towards max score if the value is 'yes' or 'no'
                            if (value === 'yes' || value === 'no') {
                                subgroupRelevantMaxScore += 1; // Increment relevant max score for the subgroup
                                if (value === 'yes') {
                                    subgroupCurrentScore += 1; // Increment current score if 'yes'
                                }
                            }
                        }
                        // else { // Skill not relevant, ensure 'na' (handled by effect) }
                    });
                }

                // Add subgroup scores to group totals
                groupCurrentScore += subgroupCurrentScore;
                groupRelevantMaxScore += subgroupRelevantMaxScore; // Sum relevant max scores

                // Store individual subgroup score if key exists, using relevant max
                if (subgroup.scoreKey) {
                    scores[subgroup.scoreKey] = { score: subgroupCurrentScore, maxScore: subgroupRelevantMaxScore };
                }
            });

             // Add group's total relevant score to overall totals
            totalCurrentScore += groupCurrentScore;
            totalMaxScore += groupRelevantMaxScore;

            // Store group score if key exists (using relevant max score)
            if (group.scoreKey) {
                 scores[group.scoreKey] = { score: groupCurrentScore, maxScore: groupRelevantMaxScore };
            }
             // Store assessment/treatment specific totals
             if (group.sectionKey === 'assessment_skills') {
                scores['assessment_total_score'] = { score: groupCurrentScore, maxScore: groupRelevantMaxScore };
             }
             if (group.sectionKey === 'treatment_skills') {
                 scores['treatment_score_calculated'] = { score: groupCurrentScore, maxScore: groupRelevantMaxScore }; // Use a distinct key
             }
        }
    });

    // Final overall score using accumulated totals
    scores.overallScore = { score: totalCurrentScore, maxScore: totalMaxScore };

    // Format scores payload for saving (using calculated max scores)
     const scoresPayload = {};
     for (const key in scores) {
         // Exclude the temporary calculated treatment score key
         if (key !== 'treatment_score_calculated' && scores[key]?.score !== undefined && scores[key]?.maxScore !== undefined) {
             scoresPayload[`${key}_score`] = scores[key].score;
             scoresPayload[`${key}_maxScore`] = scores[key].maxScore;
         }
     }
     // Ensure treatment specific score/max are included correctly using the calculated values
     if(scores['treatment_score_calculated']){
        scoresPayload['treatment_score'] = scores['treatment_score_calculated'].score;
        scoresPayload['treatment_maxScore'] = scores['treatment_score_calculated'].maxScore; // Use calculated max
     } else {
        // If treatment group wasn't relevant at all or had no scorable items
        scoresPayload['treatment_score'] = 0;
        scoresPayload['treatment_maxScore'] = 0;
     }

    // Return the payload format
    return scoresPayload;
};

// --- Form Component Start ---
// --- MODIFICATION: Accept new props ---
const SkillsAssessmentForm = ({
    facility,
    healthWorkerName,
    healthWorkerJobTitle,
    healthWorkerTrainingDate,
    onCancel,
    setToast,
    existingSessionData = null,
    visitNumber = 1 // Default to 1 if not provided
}) => {
// --- END MODIFICATION ---

    const [formData, setFormData] = useState(
        existingSessionData
        ? rehydrateDraftData(existingSessionData)
        : getInitialFormData()
    );

    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [visibleStep, setVisibleStep] = useState(existingSessionData ? 9 : 1); // Show all if editing draft
    const [scores, setScores] = useState({});
    const auth = getAuth();
    const user = auth.currentUser;

    // --- Helper functions to check step completion (Unchanged) ---
    const isVitalSignsComplete = (data) => { const skills = data.assessment_skills; return skills.skill_weight !== '' && skills.skill_temp !== '' && skills.skill_height !== ''; };
    const isDangerSignsComplete = (data) => { const skills = data.assessment_skills; return skills.skill_ds_drink !== '' && skills.skill_ds_vomit !== '' && skills.skill_ds_convulsion !== '' && skills.skill_ds_conscious !== ''; };
    const isMainSymptomsComplete = (data) => {
        const skills = data.assessment_skills;
        if (skills.skill_ask_cough === '') return false;
        if (skills.skill_ask_cough === 'yes' && skills.supervisor_confirms_cough === '') return false;
        if (skills.skill_ask_diarrhea === '') return false;
        if (skills.skill_ask_diarrhea === 'yes' && skills.supervisor_confirms_diarrhea === '') return false;
        if (skills.skill_ask_fever === '') return false;
        if (skills.skill_ask_fever === 'yes' && skills.supervisor_confirms_fever === '') return false;
        if (skills.skill_ask_ear === '') return false;
        if (skills.skill_ask_ear === 'yes' && skills.supervisor_confirms_ear === '') return false;
        // Check sub-questions based on confirmation
        if (skills.skill_ask_cough === 'yes' && skills.supervisor_confirms_cough === 'yes' && (skills.skill_check_rr === '' || skills.skill_classify_cough === '')) return false;
        if (skills.skill_ask_diarrhea === 'yes' && skills.supervisor_confirms_diarrhea === 'yes' && (skills.skill_check_dehydration === '' || skills.skill_classify_diarrhea === '')) return false;
        if (skills.skill_ask_fever === 'yes' && skills.supervisor_confirms_fever === 'yes' && (skills.skill_check_rdt === '' || skills.skill_classify_fever === '')) return false;
        if (skills.skill_ask_ear === 'yes' && skills.supervisor_confirms_ear === 'yes' && (skills.skill_check_ear === '' || skills.skill_classify_ear === '')) return false;
        return true;
    };
    const isMalnutritionComplete = (data) => { const skills = data.assessment_skills; if (skills.skill_mal_muac === '' || skills.skill_mal_wfh === '' || skills.skill_mal_classify === '') return false; if (skills.worker_malnutrition_classification === '') return false; if (skills.skill_mal_classify === 'no' && skills.supervisor_correct_malnutrition_classification === '') return false; return true; };
    const isAnemiaComplete = (data) => { const skills = data.assessment_skills; if (skills.skill_anemia_pallor === '' || skills.skill_anemia_classify === '') return false; if (skills.worker_anemia_classification === '') return false; if (skills.skill_anemia_classify === 'no' && skills.supervisor_correct_anemia_classification === '') return false; return true; };
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
                if (isMainSymptomsComplete(formData)) { maxStep = 4;
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
        const targetVisibleStep = existingSessionData ? 9 : Math.max(visibleStep, maxStep);
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
                const checkSkillKey = `skill_check_${symptomPrefix === 'cough' ? 'rr' : symptomPrefix === 'diarrhea' ? 'dehydration' : symptomPrefix === 'fever' ? 'rdt' : 'ear'}`;
                const classifySkillKey = `skill_classify_${symptomPrefix}`;
                const workerClassKey = `worker_${symptomPrefix}_classification`;
                const correctClassKey = `supervisor_correct_${symptomPrefix}_classification`;
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

        // Calculate scores based on the *current* (potentially cleaned) formData
        setScores(calculateScores(newFormData)); // Use cleaned data for scoring

    }, [formData, visibleStep, existingSessionData]); // Rerun on data change, step change, or if draft loaded


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
                [key]: value,    // Update the specific skill
            }
        }));
    };

    // --- Submit handler for final save ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validation for multi-selects
        const { assessment_skills } = formData;
        const isMultiSelectGroupEmpty = (obj) => !obj || !Object.values(obj).some(v => v === true);

        if (assessment_skills.supervisor_confirms_diarrhea === 'yes' && isMultiSelectGroupEmpty(assessment_skills.worker_diarrhea_classification)) {
             setToast({ show: true, message: 'الرجاء تحديد تصنيف الإسهال (للعامل الصحي).', type: 'error' }); return;
        }
        if (assessment_skills.supervisor_confirms_diarrhea === 'yes' && assessment_skills.skill_classify_diarrhea === 'no' && isMultiSelectGroupEmpty(assessment_skills.supervisor_correct_diarrhea_classification)) {
             setToast({ show: true, message: 'الرجاء تحديد تصنيف الإسهال الصحيح (للمشرف).', type: 'error' }); return;
        }
        if (assessment_skills.supervisor_confirms_fever === 'yes' && isMultiSelectGroupEmpty(assessment_skills.worker_fever_classification)) {
             setToast({ show: true, message: 'الرجاء تحديد تصنيف الحمى (للعامل الصحي).', type: 'error' }); return;
        }
        if (assessment_skills.supervisor_confirms_fever === 'yes' && assessment_skills.skill_classify_fever === 'no' && isMultiSelectGroupEmpty(assessment_skills.supervisor_correct_fever_classification)) {
            setToast({ show: true, message: 'الرجاء تحديد تصنيف الحمى الصحيح (للمشرف).', type: 'error' }); return;
        }
        // Add checks for single-select classifications if needed
        if (assessment_skills.skill_mal_classify === 'no' && !assessment_skills.supervisor_correct_malnutrition_classification) {
             setToast({ show: true, message: 'الرجاء تحديد تصنيف سوء التغذية الصحيح (للمشرف).', type: 'error' }); return;
        }
         if (assessment_skills.skill_anemia_classify === 'no' && !assessment_skills.supervisor_correct_anemia_classification) {
             setToast({ show: true, message: 'الرجاء تحديد تصنيف فقر الدم الصحيح (للمشرف).', type: 'error' }); return;
        }


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


            // Use calculated scores directly from state
            const calculatedScores = calculateScores(formData); // Recalculate just before save for safety
            const scoresPayload = {};
             for (const key in calculatedScores) {
                 if (key !== 'treatment_score_calculated' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                     scoresPayload[`${key}_score`] = calculatedScores[key].score;
                     scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                 }
             }
            // Add treatment score specifically
             scoresPayload['treatment_score'] = calculatedScores['treatment_score_calculated']?.score ?? 0;
             scoresPayload['treatment_maxScore'] = calculatedScores['treatment_score_calculated']?.maxScore ?? 0;


            const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));

            const payload = {
                serviceType: 'IMNCI', state: facility['الولاية'], locality: facility['المحلية'], facilityId: facility.id, facilityName: facility['اسم_المؤسسة'], healthWorkerName: healthWorkerName,

                sessionDate: formData.session_date, // Keep the original string
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

            const sessionId = existingSessionData ? existingSessionData.id : null;
            await saveMentorshipSession(payload, sessionId); // Use the correct function signature (payload, optional id)

            setToast({ show: true, message: 'تم حفظ الجلسة بنجاح!', type: 'success' });
            onCancel();
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

            // Calculate and format scores for draft
            const calculatedScores = calculateScores(formData);
            const scoresPayload = {};
             for (const key in calculatedScores) {
                 if (key !== 'treatment_score_calculated' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                     scoresPayload[`${key}_score`] = calculatedScores[key].score;
                     scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                 }
             }
             scoresPayload['treatment_score'] = calculatedScores['treatment_score_calculated']?.score ?? 0;
             scoresPayload['treatment_maxScore'] = calculatedScores['treatment_score_calculated']?.maxScore ?? 0;


             const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));

             const payload = {
                 serviceType: 'IMNCI', state: facility['الولاية'], locality: facility['المحلية'], facilityId: facility.id, facilityName: facility['اسم_المؤسسة'], healthWorkerName: healthWorkerName,
                 sessionDate: formData.session_date,
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

             const sessionId = existingSessionData ? existingSessionData.id : null;
             await saveMentorshipSession(payload, sessionId);

             setToast({ show: true, message: 'تم حفظ المسودة بنجاح!', type: 'success' });
             onCancel(); // Call onCancel to navigate back
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
                    {/* Header */}
                    <div className="text-right">
                        <PageHeader
                            title={`متابعة مهارات IMNCI: ${healthWorkerName}`}
                            subtitle={`المؤسسة: ${facility['اسم_المؤسسة']} (${facility['المحلية']}, ${facility['الولاية']})`}
                        />
                    </div>

                    {/* Facility Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-4 p-4 border rounded-lg bg-gray-50 text-right">
                        <div>
                            <span className="text-sm font-medium text-gray-500">نوع المؤسسة:</span>
                            <span className="text-sm font-semibold text-gray-900 mr-2">
                                {facility['نوع_المؤسسةالصحية'] || 'غير محدد'}
                            </span>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-gray-500">العدد الكلي للكوادر الطبية (أطباء ومساعدين):</span>
                            <span className="text-sm font-semibold text-gray-900 mr-2">
                                {facility['العدد_الكلي_للكوادر_الطبية_العاملة_أطباء_ومساعدين'] ?? 'غير محدد'}
                            </span>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-gray-500">العدد الكلي للكوادر المدربة على IMNCI:</span>
                            <span className="text-sm font-semibold text-gray-900 mr-2">
                                {facility['العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل'] ?? 'غير محدد'}
                            </span>
                        </div>
                    </div>

                    {/* --- NEW: Health Worker Info --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mb-4 p-4 border rounded-lg bg-gray-50 text-right">
                        <div>
                            <span className="text-sm font-medium text-gray-500">الوصف الوظيفي للعامل الصحي:</span>
                            <span className="text-sm font-semibold text-gray-900 mr-2">
                                {healthWorkerJobTitle || 'غير محدد'}
                            </span>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-gray-500">اخر تاريخ تدريب على IMNCI:</span>
                            <span className="text-sm font-semibold text-gray-900 mr-2">
                                {healthWorkerTrainingDate || 'غير محDد'}
                            </span>
                        </div>
                    </div>
                    {/* --- END NEW: Health Worker Info --- */}


                    {/* Date, Mentor, Visit Number Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 mb-8 items-end">
                        <FormGroup label="تاريخ الجلسة" className="text-right">
                            <Input type="date" name="session_date" value={formData.session_date} onChange={handleFormChange} required />
                        </FormGroup>
                        <div className="md:col-span-1">
                            <FormGroup label="اسم المتابع (Mentor)" className="text-right">
                                <Input type="text" value={user?.displayName || user?.email || '...'} disabled />
                            </FormGroup>
                        </div>
                         <div className="md:col-span-1 text-right pb-2"> {/* Align baseline */}
                             <span className="text-sm font-medium text-gray-700">رقم الزيارة: </span>
                             <span className="text-lg font-bold text-sky-700">{visitNumber}</span>
                         </div>
                    </div>

                    {/* Form Structure Mapping */}
                    {IMNCI_FORM_STRUCTURE.map(group => {
                        const isGroupVisible = !group.step || visibleStep >= group.step;
                        if (!isGroupVisible) return null;
                         const groupScoreData = group.scoreKey ? scores[group.scoreKey] : (group.sectionKey === 'assessment_skills' ? scores['assessment_total_score'] : (group.sectionKey === 'treatment_skills' ? scores['treatment_score_calculated'] : null));

                         // Decision Section Rendering
                         if (group.isDecisionSection) {
                             return (
                                <div key={group.group} className="mb-8">
                                    <h3 dir="rtl" className="flex justify-between items-center text-xl font-bold mb-4 text-white bg-sky-900 p-2 rounded-md text-right">
                                        <span className="flex items-center">
                                            {groupScoreData && <ScoreCircle score={groupScoreData.score} maxScore={groupScoreData.maxScore} />}
                                            <span>{group.group}</span>
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
                                            <FormGroup label="هل يتطابق قرار العامل الصحي مع المشرف؟" className="text-right flex-shrink-0">
                                                <Select name="decisionMatches" value={formData.decisionMatches} onChange={handleFormChange} className="min-w-[100px]">
                                                    <option value="">-- اختر --</option>
                                                    <option value="yes">نعم</option>
                                                    <option value="no">لا</option>
                                                </Select>
                                            </FormGroup>
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
                                        <span>{group.group}</span>
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
                                                    <span>{subgroup.subgroupTitle}</span>
                                                </h4>
                                                {subgroup.symptomGroups.map(symptomGroup => {
                                                    // ... (logic to determine symptom prefix, labels, classifications) ...
                                                     const mainSkill = symptomGroup.mainSkill; if (!mainSkill?.key) return null;
                                                     const { assessment_skills } = formData;

                                                     let previousAskKey = null; let previousConfirmKey = null;
                                                     if (mainSkill.key === 'skill_ask_diarrhea') { previousAskKey = 'skill_ask_cough'; previousConfirmKey = 'supervisor_confirms_cough'; }
                                                     else if (mainSkill.key === 'skill_ask_fever') { previousAskKey = 'skill_ask_diarrhea'; previousConfirmKey = 'supervisor_confirms_diarrhea'; }
                                                     else if (mainSkill.key === 'skill_ask_ear') { previousAskKey = 'skill_ask_fever'; previousConfirmKey = 'supervisor_confirms_fever'; }

                                                     // Hide step if previous symptom confirmation is pending (unless editing draft)
                                                     if (!existingSessionData && previousAskKey) {
                                                         const previousAskValue = assessment_skills[previousAskKey];
                                                         if (previousAskValue === '') return null; // Previous not answered
                                                         if (previousAskValue === 'yes' && assessment_skills[previousConfirmKey] === '') return null; // Previous needs confirmation
                                                     }

                                                     let symptomPrefix = ''; let symptomClassifications = []; let originalCheckSkill = null; let originalClassifySkill = null; let supervisorConfirmLabel = ''; let multiSelectCols = null;
                                                     const symptomScoreData = mainSkill.scoreKey ? scores[mainSkill.scoreKey] : null;
                                                     const symptomScoreCircle = symptomScoreData ? <ScoreCircle score={symptomScoreData.score} maxScore={symptomScoreData.maxScore} /> : null;
                                                     switch (mainSkill.key) { case 'skill_ask_cough': symptomPrefix = 'cough'; symptomClassifications = COUGH_CLASSIFICATIONS; originalCheckSkill = { key: 'skill_check_rr', label: 'هل قاس معدل التنفس بصورة صحيحة'}; originalClassifySkill = { key: 'skill_classify_cough', label: 'هل صنف الكحة بصورة صحيحة'}; supervisorConfirmLabel = 'هل يوجد كحة او ضيق تنفس (سؤال للمشرف)'; break; case 'skill_ask_diarrhea': symptomPrefix = 'diarrhea'; symptomClassifications = DIARRHEA_CLASSIFICATIONS; originalCheckSkill = { key: 'skill_check_dehydration', label: 'هل قيم فقدان السوائل بصورة صحيحة'}; originalClassifySkill = { key: 'skill_classify_diarrhea', label: 'هل صنف الاسهال بصورة صحيحة'}; supervisorConfirmLabel = 'هل يوجد إسهال (سؤال للمشرف)'; multiSelectCols = { col1: DIARRHEA_COLS_1, col2: DIARRHEA_COLS_2 }; break; case 'skill_ask_fever': symptomPrefix = 'fever'; symptomClassifications = FEVER_CLASSIFICATIONS; originalCheckSkill = { key: 'skill_check_rdt', label: 'هل أجرى فحص الملاريا السريع بصورة صحيحة'}; originalClassifySkill = { key: 'skill_classify_fever', label: 'هل صنف الحمى بصورة صحيحة'}; supervisorConfirmLabel = 'هل يوجد حمى (سؤال للمشرف)'; multiSelectCols = { col1: FEVER_COLS_1, col2: FEVER_COLS_2 }; break; case 'skill_ask_ear': symptomPrefix = 'ear'; symptomClassifications = EAR_CLASSIFICATIONS; originalCheckSkill = { key: 'skill_check_ear', label: 'هل فحص الفحص ورم مؤلم خلف الأذن'}; originalClassifySkill = { key: 'skill_classify_ear', label: 'هل صنف مشكلة الأذن بصورة صحيحة'}; supervisorConfirmLabel = 'هل يوجد مشكلة اذن (سؤال للمشرف)'; break; default: return null; }
                                                     const supervisorConfirmsKey = `supervisor_confirms_${symptomPrefix}`; const workerClassKey = `worker_${symptomPrefix}_classification`; const correctClassKey = `supervisor_correct_${symptomPrefix}_classification`; const classifySkillKey = `skill_classify_${symptomPrefix}`;
                                                     const mainSkillValue = formData[group.sectionKey]?.[mainSkill.key];
                                                     const isMainRelevant = true; // Main symptoms always considered relevant initially
                                                     if (!isMainRelevant) return null;
                                                     const isMultiSelectClassification = ['diarrhea', 'fever'].includes(symptomPrefix);
                                                     const showSubQuestions = mainSkillValue === 'yes';
                                                     const showClassifications = showSubQuestions && formData.assessment_skills[supervisorConfirmsKey] === 'yes';
                                                     const showSupervisorCorrection = showClassifications && formData.assessment_skills[classifySkillKey] === 'no';

                                                    return (
                                                        <div key={mainSkill.key} className="mb-4 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                                                            {/* Main Symptom Question */}
                                                            <SkillChecklistItem name={mainSkill.key} label={mainSkill.label} value={mainSkillValue} onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)} showNaOption={false} isMainSymptom={true} scoreCircle={symptomScoreCircle} />

                                                            {/* Sub-questions and Classifications (conditionally rendered) */}
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

                                                                    {/* Check and Classify Skills (if supervisor confirms) */}
                                                                    {showClassifications && ( <>
                                                                        {originalCheckSkill && <SkillChecklistItem key={originalCheckSkill.key} name={originalCheckSkill.key} label={originalCheckSkill.label} value={formData.assessment_skills[originalCheckSkill.key]} onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)} showNaOption={false} />}
                                                                        {originalClassifySkill && <SkillChecklistItem key={originalClassifySkill.key} name={originalClassifySkill.key} label={originalClassifySkill.label} value={formData.assessment_skills[classifySkillKey]} onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)} showNaOption={false} />}

                                                                        {/* Worker Classification */}
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

                                                                        {/* Supervisor Correction (if needed) */}
                                                                        {showSupervisorCorrection && (
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
                                        // Filter skills based on relevance *before* rendering
                                        const relevantSkills = subgroup.skills.filter(skill => {
                                            if (skill.relevant) {
                                                return typeof skill.relevant === 'function'
                                                    ? skill.relevant(formData)
                                                    : evaluateRelevance(skill.relevant, formData);
                                            }
                                            return true; // No relevance rule means it's relevant
                                        });

                                        if (relevantSkills.length === 0) return null; // Don't render subgroup if no skills are relevant

                                        const isMalnutrition = subgroup.subgroupTitle === 'تحرى عن سوء التغذية الحاد'; const isAnemia = subgroup.subgroupTitle === 'تحرى عن الانيميا'; let classPrefix = ''; let classifications = []; if (isMalnutrition) { classPrefix = 'malnutrition'; classifications = MALNUTRITION_CLASSIFICATIONS; } if (isAnemia) { classPrefix = 'anemia'; classifications = ANEMIA_CLASSIFICATIONS; } const workerClassKey = `worker_${classPrefix}_classification`; const correctClassKey = `supervisor_correct_${classPrefix}_classification`; const classifySkillKey = isMalnutrition ? 'skill_mal_classify' : isAnemia ? 'skill_anemia_classify' : null;
                                        const showClassifications = (isMalnutrition || isAnemia) && classifySkillKey;
                                        const showSupervisorCorrection = showClassifications && formData.assessment_skills[classifySkillKey] === 'no';

                                        return (
                                            <div key={subgroup.subgroupTitle} className="mb-4 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                                                {/* Subgroup Header */}
                                                <h5 dir="rtl" className="flex items-center text-sm font-bold text-white bg-sky-700 p-3 text-right">
                                                    {subgroupScoreData && <ScoreCircle score={subgroupScoreData.score} maxScore={subgroupScoreData.maxScore} />}
                                                    <span>{subgroup.subgroupTitle}</span>
                                                </h5>
                                                <div className="space-y-3 p-4 text-right" dir="rtl">
                                                    {/* Render only relevant skills */}
                                                    {relevantSkills.map(skill => (
                                                        <SkillChecklistItem
                                                            key={skill.key}
                                                            name={skill.key}
                                                            label={skill.label}
                                                            value={formData[group.sectionKey]?.[skill.key]}
                                                            onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)}
                                                            showNaOption={isVitalSignsGroup} // Specific NA logic for vital signs
                                                            naLabel={isVitalSignsGroup ? "لا يوجد / لا يعمل الجهاز" : "لا ينطبق"}
                                                        />
                                                    ))}
                                                    {/* Malnutrition/Anemia Classifications */}
                                                    {showClassifications && (
                                                        <div className="pt-4 mt-4 border-t border-gray-200 space-y-4">
                                                            <FormGroup label="ما هو التصنيف الذي الذي صنفه العامل الصحي؟" className="text-right">
                                                                 <Select name={workerClassKey} value={formData.assessment_skills[workerClassKey]} onChange={handleFormChange}> <option value="">-- اختر التصنيف --</option> {classifications.map(c => <option key={c} value={c}>{c}</option>)} </Select>
                                                            </FormGroup>
                                                            {showSupervisorCorrection && (
                                                                <FormGroup label="ما هو التصنيف الصحيح؟" className="text-right">
                                                                     <Select name={correctClassKey} value={formData.assessment_skills[correctClassKey]} onChange={handleFormChange}> <option value="">-- اختر التصنيف الصحيح --</option> {classifications.map(c => <option key={c} value={c}>{c}</option>)} </Select>
                                                                </FormGroup>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null; // Should not happen if structure is correct
                                })}
                            </div>
                        );
                    })}

                    {/* --- Notes Section --- */}
                    {(visibleStep >= 9 || !!existingSessionData) && (
                        <>
                           <FormGroup label="ملاحظات عامة" className="text-right">
                                <Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={4} placeholder="أضف أي ملاحظات إضافية حول الجلسة..." className="text-right placeholder:text-right"/>
                           </FormGroup>
                        </>
                    )}
                </div>

                 {/* --- Button Bar --- */}
                 <div className="flex gap-2 justify-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                     <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving || isSavingDraft}> إلغاء </Button>
                     <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving || isSavingDraft}> {isSavingDraft ? 'جاري حفظ المسودة...' : 'حفظ كمسودة'} </Button>
                     <Button type="submit" disabled={isSaving || isSavingDraft || visibleStep < 9} title={visibleStep < 9 ? "يجب إكمال جميع الخطوات أولاً لحفظ الجلسة" : "حفظ وإنهاء الجلسة"}> {isSaving ? 'جاري الحفظ...' : 'حفظ وإكمال الجلسة'} </Button>
                 </div>
            </form>
        </Card>
    );
};

export default SkillsAssessmentForm;