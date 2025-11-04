// MentorshipBulkUpload.jsx

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { getAuth } from "firebase/auth";

// --- Imported Components and Data (Assuming these are available in the runtime environment) ---
import {
    Button, FormGroup, Select, Spinner,
    EmptyState, Input, Modal
} from './CommonComponents'; 
import { STATE_LOCALITIES } from "./constants.js"; 
import { importMentorshipSessions } from '../data'; 

// --- START: STANDARDIZATION HELPER LOGIC ---

// --- Valid Values for Standardization ---
const YES_NO_NA_VALUES = ['yes', 'no', 'na'];
const FINAL_DECISION_VALUES = ['referral', 'treatment'];
const COUGH_CLASSIFICATIONS = ["التهاب رئوي شديد أو مرض شديد جدا", "التهاب رئوي", "كحة أو نزلة برد"];
const DIARRHEA_CLASSIFICATIONS = ["جفاف شديد", "بعض الجفاف", "لا يوجد جفاف", "إسهال مستمر شديد", "إسهال مستمر", "دسنتاريا"];
const FEVER_CLASSIFICATIONS = ["مرض حمي شديد", "ملاريا", "حمى لا توجد ملAR", "حصبة مصحوبة بمضاعفات شديدة", "حصبة مصحوبة بمضاعفات في العين والفم", "حصبة"];
const EAR_CLASSIFICATIONS = ["التهاب العظمة خلف الاذن", "التهاب أذن حاد", "التهاب أذن مزمن", "لا يوجد التهاب أذن"];
const MALNUTRITION_CLASSIFICATIONS = ["سوء تغذية شديد مصحوب بمضاعفات", "سوء تغذية شديد غير مصحوب بمضاعفات", "سوء تغذية حاد متوسط", "لا يوجد سوء تغذية"];
const ANEMIA_CLASSIFICATIONS = ["فقر دم شديد", "فقر دم", "لا يوجد فقر دم"];

// Helper Map for Case-Insensitive/Whitespace-Insensitive Lookups
const createStandardizationMap = (validValues) => {
    return validValues.reduce((map, value) => {
        const cleanedKey = String(value).trim().toLowerCase();
        map[cleanedKey] = value;
        return map;
    }, {});
};

// Maps for easy lookup
const YES_NO_NA_MAP = createStandardizationMap(YES_NO_NA_VALUES);
const FINAL_DECISION_MAP = createStandardizationMap(FINAL_DECISION_VALUES);
const COUGH_CLASSIFICATION_MAP = createStandardizationMap(COUGH_CLASSIFICATIONS);
const DIARRHEA_CLASSIFICATION_MAP = createStandardizationMap(DIARRHEA_CLASSIFICATIONS);
const FEVER_CLASSIFICATION_MAP = createStandardizationMap(FEVER_CLASSIFICATIONS);
const EAR_CLASSIFICATION_MAP = createStandardizationMap(EAR_CLASSIFICATIONS);
const MALNUTRITION_CLASSIFICATION_MAP = createStandardizationMap(MALNUTRITION_CLASSIFICATIONS);
const ANEMIA_CLASSIFICATION_MAP = createStandardizationMap(ANEMIA_CLASSIFICATIONS);


const standardizeValue = (inputValue, standardizationMap) => {
    const value = String(inputValue).trim();
    if (value === '') return null; 

    const cleanedKey = value.toLowerCase();
    
    if (standardizationMap[cleanedKey]) {
        return standardizationMap[cleanedKey];
    }
    
    // Handle numeric input for 'yes'/'no' 
    if (standardizationMap === YES_NO_NA_MAP) {
         if (value === '1' || value.toLowerCase() === 'true') return 'yes';
         if (value === '0' || value.toLowerCase() === 'false') return 'no';
    }

    return null;
};

const standardizeYesNoNa = (inputValue) => standardizeValue(inputValue, YES_NO_NA_MAP);
const standardizeFinalDecision = (inputValue) => standardizeValue(inputValue, FINAL_DECISION_MAP);

const CLASSIFICATION_CONSTANTS = {
    DIARRHEA_MAP: DIARRHEA_CLASSIFICATION_MAP,
    FEVER_MAP: FEVER_CLASSIFICATION_MAP,
    COUGH: COUGH_CLASSIFICATIONS,
    DIARRHEA: DIARRHEA_CLASSIFICATIONS,
    FEVER: FEVER_CLASSIFICATIONS,
    EAR: EAR_CLASSIFICATIONS,
    MALNUTRITION: MALNUTRITION_CLASSIFICATIONS,
    ANEMIA: ANEMIA_CLASSIFICATIONS,
};

// --- END: STANDARDIZATION HELPER LOGIC ---


// --- Core Logic from SkillsMentorshipView.jsx (For Scoring) ---
// Note: This structure and the scoring logic must be kept identical to the copy 
// in SkillsMentorshipView.jsx to ensure consistent score calculation across the app.
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
        group: 'تقييم مهارات العلاج والنصح', step: 9, scoreKey: 'treatment', maxScore: null,
        sectionKey: 'treatment_skills',
        subgroups: [
             {
                subgroupTitle: 'الحالات التي تحتاج لتحويل ، تم تحويلها',
                scoreKey: 'ref_treatment',
                skills: [
                    { key: 'skill_ref_abx', label: 'في حالة التحويل : هل أعطى الجرعة الاولى من المضاد الحيوي المناسب قبل تحويل الطفل' },
                    { key: 'skill_ref_quinine', label: 'في حالة التحويل : أعطى الكينيين بالعضل قبل التحويل', 
                        relevant: (formData) => { 
                            const didClassifyCorrectly = formData.assessment_skills?.skill_classify_fever === 'yes';
                            const workerCls = formData.assessment_skills?.worker_fever_classification || {};
                            const supervisorCls = formData.assessment_skills?.supervisor_correct_fever_classification || {};
                            const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                            return effectiveCls && effectiveCls['مرض حمي شديد'];
                        }
                    },
                ],
                relevant: (formData) => formData.finalDecision === 'referral' && formData.decisionMatches === 'yes'
            },
             {
                subgroupTitle: 'في حالة الإلتهاب الرئوي',
                scoreKey: 'pneu_treatment',
                skills: [ { key: 'skill_pneu_abx', label: 'هل وصف مضاد حيوي لعلاج الالتهاب الرئوي بصورة صحيحة' }, { key: 'skill_pneu_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج الالتهاب الرئوي بالعيادة بصورة صحيحة', relevant: "${ts_skill_pneu_abx}='yes'" }, ],
                relevant: (formData) => {
                     const didClassifyCorrectly = formData.assessment_skills?.skill_classify_cough === 'yes';
                     const workerClassification = formData.assessment_skills?.worker_cough_classification;
                     const supervisorClassification = formData.assessment_skills?.supervisor_correct_cough_classification;
                     const effectiveCls = didClassifyCorrectly ? workerClassification : supervisorClassification;
                     return effectiveCls === 'التهاب رئوي';
                }
            },
             {
                subgroupTitle: 'في حالة الإسهال',
                scoreKey: 'diar_treatment',
                skills: [ { key: 'skill_diar_ors', label: 'هل حدد كمية محلول الإرواء بصورة صحيحة' }, { key: 'skill_diar_counsel', label: 'هل نصح الأم بالRعاية المنزلية بإعطاء سوائل أكثر و الاستمرار في تغذية الطفل)' }, { key: 'skill_diar_zinc', label: 'هل وصف دواء الزنك بصورة صحيحة' }, { key: 'skill_diar_zinc_dose', label: 'هل أعطى الجرعة الأولى من دواء الزنك للطفل بالوحدة الصحية بطريقة صحيحة', relevant: "${ts_skill_diar_zinc}='yes'" }, ],
                relevant: (formData) => {
                    const didClassifyCorrectly = formData.assessment_skills?.skill_classify_diarrhea === 'yes';
                    const workerCls = formData.assessment_skills?.worker_diarrhea_classification || {};
                    const supervisorCls = formData.assessment_skills?.supervisor_correct_diarrhea_classification || {};
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    const relevantKeys = ['جفاف شديد', 'بعض الجفاف', 'إسهال مستمر شديد', 'إسهال مستمر', 'دسنتاريا', 'لا يوجد جفاف'];
                    return relevantKeys.some(key => effectiveCls[key]);
                }
            },
             {
                subgroupTitle: 'في حالة الدسنتاريا',
                scoreKey: 'dyst_treatment',
                skills: [ { key: 'skill_dyst_abx', label: 'هل وصف مضاد حيوي لعلاج الدسنتاريا بصورة صحيحة' }, { key: 'skill_dyst_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج الدسنتاريا في العيادة بصورة صحيحة', relevant: "${ts_skill_dyst_abx}='yes'" }, ],
                relevant: (formData) => {
                    const didClassifyCorrectly = formData.assessment_skills?.skill_classify_diarrhea === 'yes';
                    const workerCls = formData.assessment_skills?.worker_diarrhea_classification || {};
                    const supervisorCls = formData.assessment_skills?.supervisor_correct_diarrhea_classification || {};
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return !!effectiveCls['دسنتاريا'];
                }
            },
             {
                subgroupTitle: 'في حالة الملاريا',
                scoreKey: 'mal_treatment',
                skills: [ { key: 'skill_mal_meds', label: 'هل وصف دواء لعلاج الملاريا بصورة صحيحة' }, { key: 'skill_mal_dose', label: 'هل أعطى الجرعة الأولى من الدواء لعلاج الملاريا في العيادة بصورة صحيحة', relevant: "${ts_skill_mal_meds}='yes'" }, ],
                relevant: (formData) => {
                    const didClassifyCorrectly = formData.assessment_skills?.skill_classify_fever === 'yes';
                    const workerCls = formData.assessment_skills?.worker_fever_classification || {};
                    const supervisorCls = formData.assessment_skills?.supervisor_correct_fever_classification || {};
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return !!effectiveCls['ملاريا'];
                }
            },
            {
                subgroupTitle: 'في حالة التهاب الأذن',
                scoreKey: 'ear_treatment',
                skills: [ { key: 'skill_ear_abx', label: 'هل وصف مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة' }, { key: 'skill_ear_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة', relevant: "${ts_skill_ear_abx}='yes'" }, { key: 'skill_ear_para', label: 'هل وصف دواء الباراسيتامول بصورة صحيحة' }, { key: 'skill_ear_para_dose', label: 'هل أعطى الجرعة الأولى من الباراسيتامول بصورة صحيحة', relevant: "${ts_skill_ear_para}='yes'" }, ],
                relevant: (formData) => {
                     const didClassifyCorrectly = formData.assessment_skills?.skill_classify_ear === 'yes';
                     const workerCls = formData.assessment_skills?.worker_ear_classification;
                     const supervisorCls = formData.assessment_skills?.supervisor_correct_ear_classification;
                     const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                     return ['التهاب العظمة خلف الاذن', 'التهاب أذن حاد', 'التهاب أذن مزمن'].includes(effectiveCls);
                }
            },
            {
                subgroupTitle: 'في حالة سوء التغذية',
                scoreKey: 'nut_treatment',
                skills: [ 
                    { key: 'skill_nut_assess', label: 'قيم تغذية الطفل بما في ذلك مشاكل الرضاعة (لأقل من عمر سنتين)' }, 
                    { key: 'skill_nut_counsel', label: 'أرشد الأم عن تغذية الطفل بما في ذلك مشاكل الرضاعة الأقل من عمر سنتين)' }, 
                ], 
                relevant: (formData) => {
                    const didClassifyCorrectly = formData.assessment_skills?.skill_mal_classify === 'yes';
                    const workerCls = formData.assessment_skills?.worker_malnutrition_classification;
                    const supervisorCls = formData.assessment_skills?.supervisor_correct_malnutrition_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return ['سوء تغذية شديد غير مصحوب بمضاعفات', 'سوء تغذية حاد متوسط'].includes(effectiveCls); 
                }
            },
            {
                subgroupTitle: 'في حالة فقر الدم',
                scoreKey: 'anemia_treatment',
                skills: [ { key: 'skill_anemia_iron', label: 'هل وصف شراب حديد بصورة صحيحة' }, { key: 'skill_anemia_iron_dose', label: 'هل أعطى الجrعة الأولى من شراب حديد بصورة صحيحة', relevant: "${ts_skill_anemia_iron}='yes'" }, ],
                relevant: (formData) => {
                    const didClassifyCorrectly = formData.assessment_skills?.skill_anemia_classify === 'yes';
                    const workerCls = formData.assessment_skills?.worker_anemia_classification;
                    const supervisorCls = formData.assessment_skills?.supervisor_correct_anemia_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return effectiveCls === 'فقر دم';
                }
            },
             { subgroupTitle: 'نصح الأم متى تعود للمتابعة',
                scoreKey: 'fu_treatment',
                skills: [ { key: 'skill_fu_when', label: 'هل ذكر لها علامتين علي الأقل إذا ظهرت على الطفل يجب أن تعود به فورا للوحدة الصحية' }, { key: 'skill_fu_return', label: 'هل حدد للام متى تعود بالطفل' }, ] }
        ]
    }
];

const evaluateRelevance = (relevanceString, formData) => {
    // ... (Implementation unchanged from original file 1) ...
    if (!relevanceString) return true;
    const logicRegex = /\$\{(.*?)\}='(.*?)'/;
    const match = relevanceString.match(logicRegex);
    if (!match) {
        console.warn("Could not parse relevance string:", relevanceString);
        return true;
    }
    const [, varName, expectedValue] = match;
    let actualValue = formData[varName];
    if (actualValue === undefined && formData.assessment_skills) {
        actualValue = formData.assessment_skills[varName];
    }
     if (actualValue === undefined && formData.treatment_skills) {
        actualValue = formData.treatment_skills[varName];
    }
     if (actualValue === undefined && varName === 'decisionMatches') {
         actualValue = formData.decisionMatches;
     }
    if (actualValue === undefined && varName.startsWith('as_')) actualValue = formData.assessment_skills?.[varName.replace('as_','')];
    if (actualValue === undefined && varName.startsWith('ts_')) actualValue = formData.treatment_skills?.[varName.replace('ts_','')];

    if (expectedValue.toLowerCase() === 'yes') return actualValue === 'yes';
    if (expectedValue.toLowerCase() === 'no') return actualValue === 'no';
    if (expectedValue.toLowerCase() === 'na') return actualValue === 'na';
    return actualValue === expectedValue;
};

const calculateScores = (formData) => {
    const scores = {};
    let totalTreatmentMaxScore = 0;
    let currentTreatmentScore = 0;
    let totalAssessmentMaxScore = 0; 
    let mainSymptomsCurrentScore = 0;
    let mainSymptomsMaxScore = 0;
    let totalMaxScore = 0;
    let totalCurrentScore = 0;

    // --- NEW HANDS-ON SKILLS VARS ---
    let handsOnWeight_score = 0, handsOnWeight_max = 0;
    let handsOnTemp_score = 0, handsOnTemp_max = 0;
    let handsOnHeight_score = 0, handsOnHeight_max = 0;
    let handsOnRR_score = 0, handsOnRR_max = 0;
    let handsOnRDT_score = 0, handsOnRDT_max = 0;
    let handsOnMUAC_score = 0, handsOnMUAC_max = 0;
    let handsOnWFH_score = 0, handsOnWFH_max = 0;
    // --- END NEW HANDS-ON SKILLS VARS ---

    // --- NEW KPI VARS (Referral, Malaria, Malnutrition) ---
    let totalReferralCases_max = 0;
    let totalFeverCases_Malaria = 0;
    let totalCorrectFeverClassifications_Malaria = 0;
    let totalMalnutritionCases_max = 0;
    // --- END NEW KPI VARS ---

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

            // --- NEW KPI: Calculate Effective Classifications to find Referrals ---
            const as = formData.assessment_skills;
            const didClassifyCough = as.skill_classify_cough === 'yes';
            const effectiveCoughCls = didClassifyCough ? as.worker_cough_classification : as.supervisor_correct_cough_classification;
            
            const didClassifyDiarrhea = as.skill_classify_diarrhea === 'yes';
            const effectiveDiarrheaCls = didClassifyDiarrhea ? as.worker_diarrhea_classification : as.supervisor_correct_diarrhea_classification;
            
            const didClassifyFever = as.skill_classify_fever === 'yes';
            const effectiveFeverCls = didClassifyFever ? as.worker_fever_classification : as.supervisor_correct_fever_classification;
            
            const didClassifyEar = as.skill_classify_ear === 'yes';
            const effectiveEarCls = didClassifyEar ? as.worker_ear_classification : as.supervisor_correct_ear_classification;
            
            const didClassifyMal = as.skill_mal_classify === 'yes';
            const effectiveMalnutritionCls = didClassifyMal ? as.worker_malnutrition_classification : as.supervisor_correct_malnutrition_classification;
            
            const didClassifyAnemia = as.skill_anemia_classify === 'yes';
            const effectiveAnemiaCls = didClassifyAnemia ? as.worker_anemia_classification : as.supervisor_correct_anemia_classification;

            if (
                effectiveCoughCls === 'التهاب رئوي شديد أو مرض شديد جدا' ||
                (effectiveDiarrheaCls && (effectiveDiarrheaCls['جفاف شديد'] || effectiveDiarrheaCls['إسهال مستمر شديد'])) ||
                (effectiveFeverCls && (effectiveFeverCls['مرض حمي شديد'] || effectiveFeverCls['حصبة مصحوبة بمضاعفات شديدة'])) ||
                effectiveEarCls === 'التهاب العظمة خلف الاذن' ||
                effectiveMalnutritionCls === 'سوء تغذية شديد مصحوب بمضاعفات' ||
                effectiveAnemiaCls === 'فقر دم شديد'
            ) {
                totalReferralCases_max = 1;
            }
            // --- END NEW KPI ---

        } else if (group.sectionKey) {
            const sectionData = formData[group.sectionKey] || {};

            group.subgroups?.forEach(subgroup => {
                let subgroupCurrentScore = 0;
                let subgroupMaxScore = subgroup.maxScore ?? 0;
                let isSubgroupScored = !!subgroup.scoreKey;
                let isTreatmentSubgroup = group.sectionKey === 'treatment_skills';
                let dynamicSubgroupMaxScore = 0;
                let isSubgroupRelevantForScoring = true;

                // --- NEW KPI: Check Malnutrition Cases ---
                if (group.sectionKey === 'assessment_skills' && subgroup.scoreKey === 'malnutrition') {
                    const didClassifyMal = sectionData['skill_mal_classify'] === 'yes';
                    const workerClsMal = sectionData['worker_malnutrition_classification'];
                    const supervisorClsMal = sectionData['supervisor_correct_malnutrition_classification'];
                    const effectiveClsMal = didClassifyMal ? workerClsMal : supervisorClsMal;
                    if (effectiveClsMal === 'سوء تغذية شديد غير مصحوب بمضاعفات' || effectiveClsMal === 'سوء تغذية حاد متوسط') { 
                        totalMalnutritionCases_max = 1; 
                    }
                }
                // --- END NEW KPI ---

                if (isTreatmentSubgroup && subgroup.relevant) {
                    if (typeof subgroup.relevant === 'function') isSubgroupRelevantForScoring = subgroup.relevant(formData);
                    else if (typeof subgroup.relevant === 'string') isSubgroupRelevantForScoring = evaluateRelevance(subgroup.relevant, formData);
                }

                if (!isSubgroupRelevantForScoring && isTreatmentSubgroup) {
                   if (subgroup.scoreKey) {
                        scores[subgroup.scoreKey] = { score: 0, maxScore: 0 };
                   }
                   return;
                }

                if (subgroup.isSymptomGroupContainer) {
                    subgroup.symptomGroups?.forEach(sg => {
                         const symptomPrefix = sg.mainSkill.key.split('_')[2];
                         const askSkillKey = sg.mainSkill.key;
                         const confirmsKey = `supervisor_confirms_${symptomPrefix}`;
                         const checkSkillKey = `skill_check_${symptomPrefix === 'cough' ? 'rr' : symptomPrefix === 'diarrhea' ? 'dehydration' : symptomPrefix === 'fever' ? 'rdt' : 'ear'}`;
                         const classifySkillKey = `skill_classify_${symptomPrefix}`;
                         const askValue = sectionData[askSkillKey];

                         let currentSymptomScore = 0;
                         let maxSymptomScore = 0;

                         if (askValue === 'yes' || askValue === 'no') {
                            maxSymptomScore += 1;
                            if (askValue === 'yes') currentSymptomScore += 1;
                         }

                         if (askValue === 'yes' && formData.assessment_skills?.[confirmsKey] === 'yes') {
                             if (sectionData[checkSkillKey] === 'yes' || sectionData[checkSkillKey] === 'no') {
                                maxSymptomScore += 1;
                                if (sectionData[checkSkillKey] === 'yes') currentSymptomScore += 1;
                             }
                             if (sectionData[classifySkillKey] === 'yes' || sectionData[classifySkillKey] === 'no') {
                                maxSymptomScore += 1;
                                if (sectionData[classifySkillKey] === 'yes') currentSymptomScore += 1;
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
                        
                        // --- NEW KPI: Malaria Classification ---
                        if (symptomPrefix === 'fever') {
                            const confirmsValue = formData.assessment_skills[confirmsKey];
                            const classifyValue = sectionData[classifySkillKey];
                            if (askValue === 'yes' && confirmsValue === 'yes') {
                                const didClassifyCorrectly = classifyValue === 'yes';
                                const workerCls = formData.assessment_skills[`worker_${symptomPrefix}_classification`] || {};
                                const supervisorCls = formData.assessment_skills[`supervisor_correct_${symptomPrefix}_classification`] || {};
                                const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                                
                                if (effectiveCls['ملاريا']) {
                                    totalFeverCases_Malaria = 1;
                                    if (didClassifyCorrectly) {
                                        totalCorrectFeverClassifications_Malaria = 1;
                                    }
                                }
                            }
                        }
                        // --- END NEW KPI ---

                         subgroupCurrentScore += currentSymptomScore;
                         mainSymptomsMaxScore += maxSymptomScore; // <-- MODIFIED: was subgroupRelevantMaxScore
                         if (sg.mainSkill.scoreKey) {
                             scores[sg.mainSkill.scoreKey] = { score: currentSymptomScore, maxScore: maxSymptomScore };
                         }
                    });
                    // --- START: MODIFICATION (Corrected Symptom Score) ---
                    mainSymptomsCurrentScore = subgroupCurrentScore; 
                    // mainSymptomsMaxScore is already calculated in the loop
                    if (subgroup.scoreKey) {
                        scores[subgroup.scoreKey] = { score: mainSymptomsCurrentScore, maxScore: mainSymptomsMaxScore };
                    }
                    // --- END: MODIFICATION ---

                } else if (Array.isArray(subgroup.skills)) {
                    // --- START: MODIFICATION (Clearer subgroup max) ---
                    let subgroupRelevantMaxScore = 0;
                    // --- END: MODIFICATION ---
                    subgroup.skills.forEach(skill => {
                        let isSkillRelevantForScoring = true;
                        if (skill.relevant) {
                             if (typeof skill.relevant === 'function') {
                                isSkillRelevantForScoring = skill.relevant(formData);
                             } else if (typeof skill.relevant === 'string') {
                                 const simplifiedRelevanceString = skill.relevant.replace(/\$\{(.*?)\}/g, (match, key) => {
                                      let val = formData[key] ?? sectionData[key] ?? formData.assessment_skills?.[key] ?? formData.treatment_skills?.[key];
                                      if (key.startsWith('as_') && val === undefined) val = formData.assessment_skills?.[key.replace('as_', '')];
                                      if (key.startsWith('ts_') && val === undefined) val = formData.treatment_skills?.[key.replace('ts_', '')];
                                      return `'${val || ''}'`;
                                 });
                                 try {
                                      isSkillRelevantForScoring = evaluateRelevance(skill.relevant, formData); // Use the dedicated helper for consistency
                                 } catch (e) {
                                      console.warn("Error evaluating skill relevance:", simplifiedRelevanceString, e);
                                      isSkillRelevantForScoring = false;
                                 }
                             } else {
                                isSkillRelevantForScoring = false;
                             }
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

                            if (value === 'yes' || value === 'no') {
                                // subgroupRelevantMaxScore is for the max score of *this* subgroup
                                subgroupRelevantMaxScore += 1;
                                
                                // This is for the *group* total max score (assessment vs treatment)
                                if (isTreatmentSubgroup) {
                                    totalTreatmentMaxScore += 1;
                                } else {
                                    const isVitalSignsNa = (subgroup.scoreKey === 'vitalSigns' && value === 'na');
                                    if (!isVitalSignsNa) { // Don't count N/A vitals
                                        totalAssessmentMaxScore += 1;
                                    }
                                }
                            }

                            if (value === 'yes') {
                                subgroupCurrentScore += 1;
                            }
                        }
                    });
                    // --- START: MODIFICATION (Assign dynamic score) ---
                    if (isSubgroupScored) {
                        subgroupMaxScore = subgroupRelevantMaxScore;
                        scores[subgroup.scoreKey] = { score: subgroupCurrentScore, maxScore: subgroupMaxScore };
                    }
                    // --- END: MODIFICATION ---
                }

                groupCurrentScore += subgroupCurrentScore;
                
                // --- REMOVED: Flawed logic block ---
            });

            // This block is for the total Assessment score
            if (group.sectionKey === 'assessment_skills') {
                scores['assessment_total_score'] = { 
                    score: groupCurrentScore, // contains sum of vital, danger, mal, anemia, imm, other (BUT NOT SYMPTOMS)
                    maxScore: totalAssessmentMaxScore // contains sum of their relevant maxes
                };
                 totalCurrentScore += groupCurrentScore;
                 totalMaxScore += totalAssessmentMaxScore;
            } 
            // This block is for the total Treatment score
            else if (group.scoreKey === 'treatment') {
                groupMaxScore = totalTreatmentMaxScore; // Max score is the sum of all relevant skills
                scores[group.scoreKey] = { score: groupCurrentScore, maxScore: groupMaxScore };
                totalMaxScore += groupMaxScore;
                totalCurrentScore += groupCurrentScore;
            }
        }
    });

    // Add back the mainSymptom scores to the total (they were separate)
    totalCurrentScore += mainSymptomsCurrentScore;
    totalMaxScore += mainSymptomsMaxScore;
    
    // Recalculate assessment_total_score to include symptoms
    scores['assessment_total_score'].score += mainSymptomsCurrentScore;
    scores['assessment_total_score'].maxScore += mainSymptomsMaxScore;
    
    // Final Overall Score
    scores.overallScore = { score: totalCurrentScore, maxScore: totalMaxScore };

    // Format payload
    const scoresPayload = {};
     for (const key in scores) {
         if (key !== 'treatment' && scores[key]?.score !== undefined && scores[key]?.maxScore !== undefined) {
             scoresPayload[`${key}_score`] = scores[key].score;
             scoresPayload[`${key}_maxScore`] = scores[key].maxScore;
         }
     }
     if(scores['treatment']){
        scoresPayload['treatment_score'] = scores['treatment'].score;
        scoresPayload['treatment_maxScore'] = scores['treatment'].maxScore;
     } else {
        scoresPayload['treatment_score'] = 0;
        scoresPayload['treatment_maxScore'] = 0;
     }

    // --- NEW HANDS-ON SKILL SCORES ---
    scoresPayload['handsOnWeight_score'] = handsOnWeight_score;
    scoresPayload['handsOnWeight_maxScore'] = handsOnWeight_max;
    scoresPayload['handsOnTemp_score'] = handsOnTemp_score;
    scoresPayload['handsOnTemp_maxScore'] = handsOnTemp_max;
    scoresPayload['handsOnHeight_score'] = handsOnHeight_score;
    scoresPayload['handsOnHeight_maxScore'] = handsOnHeight_max;
    scoresPayload['handsOnRR_score'] = handsOnRR_score;
    scoresPayload['handsOnRR_maxScore'] = handsOnRR_max;
    scoresPayload['handsOnRDT_score'] = handsOnRDT_score;
    scoresPayload['handsOnRDT_maxScore'] = handsOnRDT_max;
    scoresPayload['handsOnMUAC_score'] = handsOnMUAC_score;
    scoresPayload['handsOnMUAC_maxScore'] = handsOnMUAC_max;
    scoresPayload['handsOnWFH_score'] = handsOnWFH_score;
    scoresPayload['handsOnWFH_maxScore'] = handsOnWFH_max;
    // --- END NEW HANDS-ON SKILL SCORES ---

    // --- NEW KPI SCORES (Referral, Malaria, Malnutrition, Anemia) ---
    scoresPayload['referralCaseCount_score'] = totalReferralCases_max;
    scoresPayload['referralCaseCount_maxScore'] = 1;
    scoresPayload['referralManagement_score'] = scores['ref_treatment']?.score || 0;
    scoresPayload['referralManagement_maxScore'] = scores['ref_treatment']?.maxScore || 0;
    scoresPayload['malariaClassification_score'] = totalCorrectFeverClassifications_Malaria;
    scoresPayload['malariaClassification_maxScore'] = totalFeverCases_Malaria;
    scoresPayload['malariaManagement_score'] = scores['mal_treatment']?.score || 0;
    scoresPayload['malariaManagement_maxScore'] = scores['mal_treatment']?.maxScore || 0;
    scoresPayload['malnutritionCaseCount_score'] = totalMalnutritionCases_max;
    scoresPayload['malnutritionCaseCount_maxScore'] = 1;
    scoresPayload['malnutritionManagement_score'] = scores['nut_treatment']?.score || 0;
    scoresPayload['malnutritionManagement_maxScore'] = scores['nut_treatment']?.maxScore || 0;
    scoresPayload['anemiaManagement_score'] = scores['anemia_treatment']?.score || 0;
    scoresPayload['anemiaManagement_maxScore'] = scores['anemia_treatment']?.maxScore || 0;
    // --- END NEW KPI SCORES ---

    return scoresPayload;
};
// --- END calculateScores ---


// --- Bulk Upload Modal (Detailed Version) ---
const DetailedMentorshipBulkUploadModal = ({
    isOpen,
    onClose,
    onImport,
    uploadStatus,
    healthFacilities,
    activeService,
    allSubmissions 
}) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [failedRows, setFailedRows] = useState([]);
    const fileInputRef = useRef(null);
    const auth = getAuth();

    const BASE_FIELDS = [
        { key: 'session_date', label: 'Session Date (YYYY-MM-DD)', required: true },
        { key: 'state', label: 'State (Arabic/English Name)', required: true },
        { key: 'locality', label: 'Locality (Arabic Name)', required: true },
        { key: 'facility_name', label: 'Facility Name', required: true },
        { key: 'health_worker_name', label: 'Health Worker Name', required: true },
        { key: 'notes', label: 'Notes' },
        { key: 'mentor_email', label: 'Mentor Email (Optional)' },
        { key: 'worker_job_title', label: 'Worker Job Title (Optional)' }, 
        { key: 'facility_type', label: 'Facility Type (Optional)' }, 
    ];
    // ... (ASSESSMENT_SKILL_FIELDS, DECISION_FIELDS, TREATMENT_SKILL_FIELDS definitions unchanged) ...
    const ASSESSMENT_SKILL_FIELDS = [
        { key: 'as_skill_weight', label: 'AS: Weight Correctly' },
        { key: 'as_skill_temp', label: 'AS: Temperature Correctly' },
        { key: 'as_skill_height', label: 'AS: Height Correctly' },
        { key: 'as_skill_ds_drink', label: 'AS: Asked/Checked DS Drink' },
        { key: 'as_skill_ds_vomit', label: 'AS: Asked/Checked DS Vomit' },
        { key: 'as_skill_ds_convulsion', label: 'AS: Asked/Checked DS Convulsion' },
        { key: 'as_skill_ds_conscious', label: 'AS: Checked DS Conscious' },
        { key: 'as_skill_ask_cough', label: 'AS: Asked Cough' },
        { key: 'as_supervisor_confirms_cough', label: 'AS: Supervisor Confirms Cough' },
        { key: 'as_skill_check_rr', label: 'AS: Checked RR Correctly', relevant: "${as_supervisor_confirms_cough}='yes'" },
        { key: 'as_skill_classify_cough', label: 'AS: Classified Cough Correctly', relevant: "${as_supervisor_confirms_cough}='yes'" },
        { key: 'as_worker_cough_classification', label: 'AS: Worker Cough Classification', relevant: "${as_supervisor_confirms_cough}='yes'" },
        { key: 'as_supervisor_correct_cough_classification', label: 'AS: Correct Cough Classification', relevant: "${as_skill_classify_cough}='no'" },
        { key: 'as_skill_ask_diarrhea', label: 'AS: Asked Diarrhea' },
        { key: 'as_supervisor_confirms_diarrhea', label: 'AS: Supervisor Confirms Diarrhea' },
        { key: 'as_skill_check_dehydration', label: 'AS: Checked Dehydration Correctly', relevant: "${as_supervisor_confirms_diarrhea}='yes'" },
        { key: 'as_skill_classify_diarrhea', label: 'AS: Classified Diarrhea Correctly', relevant: "${as_supervisor_confirms_diarrhea}='yes'" },
        { key: 'as_worker_diarrhea_classification', label: 'AS: Worker Diarrhea Class (comma-sep)', relevant: "${as_supervisor_confirms_diarrhea}='yes'" },
        { key: 'as_supervisor_correct_diarrhea_classification', label: 'AS: Correct Diarrhea Class (comma-sep)', relevant: "${as_skill_classify_diarrhea}='no'" },
        { key: 'as_skill_ask_fever', label: 'AS: Asked Fever' },
        { key: 'as_supervisor_confirms_fever', label: 'AS: Supervisor Confirms Fever' },
        { key: 'as_skill_check_rdt', label: 'AS: Checked RDT Correctly', relevant: "${as_supervisor_confirms_fever}='yes'" },
        { key: 'as_skill_classify_fever', label: 'AS: Classified Fever Correctly', relevant: "${as_supervisor_confirms_fever}='yes'" },
        { key: 'as_worker_fever_classification', label: 'AS: Worker Fever Class (comma-sep)', relevant: "${as_supervisor_confirms_fever}='yes'" },
        { key: 'as_supervisor_correct_fever_classification', label: 'AS: Correct Fever Class (comma-sep)', relevant: "${as_skill_classify_fever}='no'" },
        { key: 'as_skill_ask_ear', label: 'AS: Asked Ear Problem' },
        { key: 'as_supervisor_confirms_ear', label: 'AS: Supervisor Confirms Ear Problem' },
        { key: 'as_skill_check_ear', label: 'AS: Checked Ear Correctly', relevant: "${as_supervisor_confirms_ear}='yes'" },
        { key: 'as_skill_classify_ear', label: 'AS: Classified Ear Correctly', relevant: "${as_supervisor_confirms_ear}='yes'" },
        { key: 'as_worker_ear_classification', label: 'AS: Worker Ear Classification', relevant: "${as_supervisor_confirms_ear}='yes'" },
        { key: 'as_supervisor_correct_ear_classification', label: 'AS: Correct Ear Classification', relevant: "${as_skill_classify_ear}='no'" },
        { key: 'as_skill_mal_muac', label: 'AS: Measured MUAC Correctly' },
        { key: 'as_skill_mal_wfh', label: 'AS: Checked WFH Correctly' },
        { key: 'as_skill_mal_classify', label: 'AS: Classified Malnutrition Correctly' },
        { key: 'as_worker_malnutrition_classification', label: 'AS: Worker Malnutrition Classification' },
        { key: 'as_supervisor_correct_malnutrition_classification', label: 'AS: Correct Malnutrition Classification', relevant: "${as_skill_mal_classify}='no'" },
        { key: 'as_skill_anemia_pallor', label: 'AS: Checked Pallor Correctly' },
        { key: 'as_skill_anemia_classify', label: 'AS: Classified Anemia Correctly' },
        { key: 'as_worker_anemia_classification', label: 'AS: Worker Anemia Classification' },
        { key: 'as_supervisor_correct_anemia_classification', label: 'AS: Correct Anemia Classification', relevant: "${as_skill_anemia_classify}='no'" },
        { key: 'as_skill_imm_vacc', label: 'AS: Checked Immunization Correctly' },
        { key: 'as_skill_imm_vita', label: 'AS: Checked Vitamin A Correctly' },
        { key: 'as_skill_other', label: 'AS: Checked Other Problems' },
    ];
    const DECISION_FIELDS = [
        { key: 'finalDecision', label: 'Final Decision (Worker)', required: true },
        { key: 'decisionMatches', label: 'Decision Matches Supervisor', required: true },
    ];
    const TREATMENT_SKILL_FIELDS = [
        { key: 'ts_skill_ref_abx', label: 'TS: Gave Pre-Referral ABX', relevant: "${finalDecision}='referral'" },
        { key: 'ts_skill_ref_quinine', label: 'TS: Gave Pre-Referral Quinine', relevant: "${finalDecision}='referral' and ${as_supervisor_correct_fever_classification}='مرض حمي شديد'" },
        { key: 'ts_skill_pneu_abx', label: 'TS: Prescribed Pneumonia ABX Correctly', relevant: "${as_supervisor_correct_cough_classification}='التهاب رئوي'" },
        { key: 'ts_skill_pneu_dose', label: 'TS: Gave Pneumonia ABX Dose Correctly', relevant: "${ts_skill_pneu_abx}='yes'" },
        { key: 'ts_skill_diar_ors', label: 'TS: Determined ORS Amount Correctly' },
        { key: 'ts_skill_diar_counsel', label: 'TS: Counselled Diarrhea Home Care' },
        { key: 'ts_skill_diar_zinc', label: 'TS: Prescribed Zinc Correctly' },
        { key: 'ts_skill_diar_zinc_dose', label: 'TS: Gave Zinc Dose Correctly', relevant: "${ts_skill_diar_zinc}='yes'" },
        { key: 'ts_skill_dyst_abx', label: 'TS: Prescribed Dysentery ABX Correctly' },
        { key: 'ts_skill_dyst_dose', label: 'TS: Gave Dysentery ABX Dose Correctly', relevant: "${ts_skill_dyst_abx}='yes'" },
        { key: 'ts_skill_mal_meds', label: 'TS: Prescribed Malaria Meds Correctly' },
        { key: 'ts_skill_mal_dose', label: 'TS: Gave Malaria Meds Dose Correctly', relevant: "${ts_skill_mal_meds}='yes'" },
        { key: 'ts_skill_ear_abx', label: 'TS: Prescribed Ear ABX Correctly' },
        { key: 'ts_skill_ear_dose', label: 'TS: Gave Ear ABX Dose Correctly', relevant: "${ts_skill_ear_abx}='yes'" },
        { key: 'ts_skill_ear_para', label: 'TS: Prescribed Paracetamol Correctly' },
        { key: 'ts_skill_ear_para_dose', label: 'TS: Gave Paracetamol Dose Correctly', relevant: "${ts_skill_ear_para}='yes'" },
        { key: 'ts_skill_nut_assess', label: 'TS: Assessed Feeding Correctly' },
        { key: 'ts_skill_nut_counsel', label: 'TS: Counselled Feeding Correctly' },
        { key: 'ts_skill_anemia_iron', label: 'TS: Prescribed Iron Correctly', relevant: "${as_supervisor_correct_anemia_classification}='فقر دم'" },
        { key: 'ts_skill_anemia_iron_dose', label: 'TS: Gave Iron Dose Correctly', relevant: "${ts_skill_anemia_iron}='yes'" },
        { key: 'ts_skill_fu_when', label: 'TS: Counselled When to Return Immediately' },
        { key: 'ts_skill_fu_return', label: 'TS: Counselled Follow-Up Visit' },
    ];
    const ALL_MENTORSHIP_FIELDS = useMemo(() => [
        ...BASE_FIELDS,
        ...ASSESSMENT_SKILL_FIELDS,
        ...DECISION_FIELDS,
        ...TREATMENT_SKILL_FIELDS
    ], []);
    const ALL_TEMPLATE_HEADERS = useMemo(() => ALL_MENTORSHIP_FIELDS.map(f => f.key), [ALL_MENTORSHIP_FIELDS]);

    // --- MODIFIED: stateArToKey to include English name lookup ---
    const stateArToKey = useMemo(() => {
        return Object.entries(STATE_LOCALITIES).reduce((acc, [key, value]) => {
            const arName = value.ar.trim().toLowerCase();
            const enName = key.trim().toLowerCase(); // Use the key itself as the English representation
            
            // Map Arabic name to English key
            acc[arName] = key;
            // Map English name to English key
            acc[enName] = key;
            return acc;
        }, {});
    }, []);
    // --- END MODIFIED ---
    
    const localityArToKey = (stateKey, localityAr) => {
        if (!stateKey || !localityAr) return null;
        const stateData = STATE_LOCALITIES[stateKey];
        if (!stateData) return null;
        const locality = stateData.localities.find(l => l.ar.trim().toLowerCase() === String(localityAr).trim().toLowerCase());
        return locality ? locality.en : null;
    };
    const facilityLookup = useMemo(() => {
        if (!healthFacilities) return new Map();
        return healthFacilities.reduce((acc, facility) => {
            const state = facility['الولاية'];
            const locality = facility['المحلية'];
            const name = String(facility['اسم_المؤسسة'] ?? '').trim().toLowerCase();
            if (state && locality && name) {
                const key = `${state}-${locality}-${name}`;
                acc.set(key, facility.id);
            }
            return acc;
        }, new Map());
    }, [healthFacilities]);

    useEffect(() => {
        // ... (upload status effect unchanged) ...
        if (uploadStatus.inProgress) {
            setCurrentPage(2);
        } else if (uploadStatus.message) {
            const detailedErrors = uploadStatus.errors?.filter(e => e.rowData);
            if (detailedErrors && detailedErrors.length > 0) {
                setFailedRows(detailedErrors);
                setCurrentPage('correction');
            } else {
                setCurrentPage(3);
            }
        }
    }, [uploadStatus.inProgress, uploadStatus.message, uploadStatus.errors]);
    
    useEffect(() => {
        // ... (reset state on open effect unchanged) ...
        if (isOpen) {
            setCurrentPage(0);
            setError('');
            setExcelData([]);
            setHeaders([]);
            setFieldMappings({});
            setFailedRows([]);
        }
    }, [isOpen]);
    
    const handleFileUpload = (e) => {
        // ... (handleFileUpload implementation unchanged) ...
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", cellDates: true });
                if (jsonData.length < 1) {
                    setError('Excel file appears to be empty.');
                    return;
                }
                setHeaders(jsonData[0].map(h => String(h).trim()));
                setExcelData(jsonData.slice(1));
                setCurrentPage(1);
                setError('');
            } catch (err) {
                setError('Error reading Excel file: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    const handleDownloadTemplate = () => {
        // ... (handleDownloadTemplate implementation unchanged) ...
        const fileName = `Mentorship_Upload_Template_Detailed_${activeService}.xlsx`;
        const worksheetData = [ALL_TEMPLATE_HEADERS];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Mentorships");
        XLSX.writeFile(workbook, fileName);
    };
    
    const handleMappingChange = useCallback((appField, excelHeader) => {
        // ... (handleMappingChange implementation unchanged) ...
        setFieldMappings(prev => {
            const newMappings = { ...prev };
            if (excelHeader) newMappings[appField] = excelHeader;
            else delete newMappings[appField];
            return newMappings;
        });
    }, []);
    
    const handleValidation = () => {
        // ... (handleValidation implementation unchanged) ...
        const missingMappings = BASE_FIELDS
            .filter(field => field.required && !fieldMappings[field.key])
            .map(field => field.label);
        if (missingMappings.length > 0) {
            setError(`The following base fields must be mapped: ${missingMappings.join(', ')}.`);
            return;
        }
        setError('');
        processAndStartImport(excelData, excelData, allSubmissions);
    };

    const processAndStartImport = (dataForProcessing, originalRawData, allSubmissions) => {
        const user = auth.currentUser;
        if (!user) {
            setError('You must be logged in to import data.');
            return;
        }

        // --- START: MODIFIED Visit Number Logic ---
            
        // 1. Create map of existing *unique visit days* from DB to get the baseline count and last date
        const existingVisitDates = new Map();
        if (allSubmissions) {
            allSubmissions.forEach(sub => {
                // Only count completed sessions to establish the baseline
                if (sub.status === 'complete' && sub.facilityId && sub.staff && sub.sessionDate) {
                     const key = `${sub.facilityId}-${sub.staff}`;
                     if (!existingVisitDates.has(key)) {
                         existingVisitDates.set(key, new Set());
                     }
                     // Add the date string (e.g., "2025-11-01") to the Set
                     existingVisitDates.get(key).add(sub.sessionDate);
                }
            });
        }

        // 2. Convert the date Sets into the final baseline count map
        const existingVisitCounts = new Map();
        existingVisitDates.forEach((dateSet, key) => {
            const sortedDates = Array.from(dateSet).sort();
            const count = sortedDates.length;
            const lastDate = sortedDates[count - 1] || null;
            existingVisitCounts.set(key, { count, lastDate });
        });
        
        // --- END: DB Baseline Logic ---


        // 3. Find header indices for fields needed for sorting and counting
        const dateHdr = fieldMappings['session_date'];
        const workerHdr = fieldMappings['health_worker_name'];
        const facilityHdr = fieldMappings['facility_name'];
        const stateHdr = fieldMappings['state'];
        const localityHdr = fieldMappings['locality'];
        
        const dateIdx = headers.indexOf(dateHdr);
        const workerIdx = headers.indexOf(workerHdr);
        const facilityIdx = headers.indexOf(facilityHdr);
        const stateIdx = headers.indexOf(stateHdr);
        const localityIdx = headers.indexOf(localityHdr);

        // 4. Pre-process and sort the *current* Excel data by date
        const preProcessedData = dataForProcessing.map((row, rowIndex) => {
            let dateObj = null;
            let dateStr = null; // YYYY-MM-DD string
            const dateVal = row[dateIdx];
            try {
                 if (dateVal instanceof Date) {
                    dateObj = dateVal;
                 } else {
                    // Handle Excel dates (numbers) or string dates
                    const parsedDate = new Date(dateVal);
                    if (!isNaN(parsedDate.getTime())) dateObj = parsedDate;
                 }
                 // Convert valid date object to YYYY-MM-DD string
                 if(dateObj) {
                     dateStr = dateObj.toISOString().split('T')[0];
                 }
            } catch (e) { /* dateObj remains null */ }

            const workerName = String(row[workerIdx] || '').trim();
            const facilityName = String(row[facilityIdx] || '').trim();
            const stateName = String(row[stateIdx] || '').trim().toLowerCase();
            const localityName = String(row[localityIdx] || '').trim();

            const stateKey = stateArToKey[stateName];
            const localityKey = localityArToKey(stateKey, localityName);
            const facilityNameLower = facilityName.toLowerCase();
            const lookupKey = `${stateKey}-${localityKey}-${facilityNameLower}`;
            const facilityId = facilityLookup.get(lookupKey) || null;

            return {
                row,
                originalRowIndex: rowIndex, // Keep for potential error mapping
                dateObj,
                dateStr, // Store the YYYY-MM-DD string
                workerName,
                facilityId,
                key: `${facilityId}-${workerName}` // Worker-Facility key
            };
        }).sort((a, b) => {
            // Sort by date, null dates go to the end
            if (a.dateObj && b.dateObj) return a.dateObj.getTime() - b.dateObj.getTime();
            if (a.dateObj) return -1; // a has date, b does not, a comes first
            if (b.dateObj) return 1;  // b has date, a does not, b comes first
            return 0; // neither has a date
        });
        
        // This map will track visit numbers { count, lastDate } *within this upload*
        const internalVisitTracker = new Map();

        // --- END: MODIFIED Visit Number Logic ---
        
        const processedSessions = [];

        // 5. Iterate over the *sorted* data
        preProcessedData.forEach(({ row, originalRowIndex, key: workerFacilityKey, dateStr: currentSessionDate }) => {
            const sessionFromRow = {};
            let hasError = false;

            ALL_MENTORSHIP_FIELDS.forEach(field => {
                 const excelHeader = fieldMappings[field.key];
                 if (excelHeader) {
                     const headerIndex = headers.indexOf(excelHeader);
                     if (headerIndex !== -1) {
                         let cellValue = row[headerIndex];
                         if (cellValue === null || cellValue === undefined) cellValue = '';
                         if (typeof cellValue === 'string') cellValue = cellValue.trim();
                         
                         // --- START: VALUE STANDARDIZATION ---
                         let standardizedValue = cellValue;

                         if (field.key.startsWith('as_skill') || field.key.startsWith('ts_skill') || field.key === 'decisionMatches' || field.key.startsWith('as_supervisor_confirms') || field.key === 'finalDecision') {
                             // Standardize 'yes', 'no', 'na', or finalDecision
                             if (field.key === 'finalDecision') {
                                 standardizedValue = standardizeFinalDecision(cellValue);
                             } else {
                                 standardizedValue = standardizeYesNoNa(cellValue);
                             }
                         } else if (field.key === 'as_worker_cough_classification' || field.key === 'as_supervisor_correct_cough_classification') {
                             standardizedValue = CLASSIFICATION_CONSTANTS.COUGH.find(c => String(c).trim().toLowerCase() === String(cellValue).trim().toLowerCase()) || cellValue;
                         } else if (field.key === 'as_worker_ear_classification' || field.key === 'as_supervisor_correct_ear_classification') {
                             standardizedValue = CLASSIFICATION_CONSTANTS.EAR.find(c => String(c).trim().toLowerCase() === String(cellValue).trim().toLowerCase()) || cellValue;
                         } else if (field.key === 'as_worker_malnutrition_classification' || field.key === 'as_supervisor_correct_malnutrition_classification') {
                              standardizedValue = CLASSIFICATION_CONSTANTS.MALNUTRITION.find(c => String(c).trim().toLowerCase() === String(cellValue).trim().toLowerCase()) || cellValue;
                         } else if (field.key === 'as_worker_anemia_classification' || field.key === 'as_supervisor_correct_anemia_classification') {
                             standardizedValue = CLASSIFICATION_CONSTANTS.ANEMIA.find(c => String(c).trim().toLowerCase() === String(cellValue).trim().toLowerCase()) || cellValue;
                         } else if (field.key.endsWith('_classification') && field.label.includes('(comma-sep)')) {
                             const isDiarrhea = field.key.includes('diarrhea');
                             const classificationMap = isDiarrhea ? CLASSIFICATION_CONSTANTS.DIARRHEA_MAP : CLASSIFICATION_CONSTANTS.FEVER_MAP;
                             const rawList = String(cellValue || '').split(',').map(s => s.trim()).filter(Boolean);
                             standardizedValue = rawList.map(rawCls => {
                                 const cleanedKey = rawCls.toLowerCase();
                                 return classificationMap[cleanedKey] || rawCls; 
                             });
                         }
                         
                         if (standardizedValue !== null && standardizedValue !== '') {
                            sessionFromRow[field.key] = standardizedValue;
                         }
                         // --- END: VALUE STANDARDIZATION ---
                     }
                 }
            });
            
            // Basic required field check after standardization
            if (!sessionFromRow.session_date || !sessionFromRow.state || !sessionFromRow.locality || !sessionFromRow.facility_name || !sessionFromRow.health_worker_name) {
                 return; // Skip this row, it's missing fundamental data
            }

            const formDataForRow = {
                 session_date: '', notes: sessionFromRow.notes || '', assessment_skills: {}, treatment_skills: {},
                 finalDecision: sessionFromRow.finalDecision || '', decisionMatches: sessionFromRow.decisionMatches || '',
            };
            
            ASSESSMENT_SKILL_FIELDS.forEach(field => {
                 const keyWithoutPrefix = field.key.replace('as_', '');
                 const value = sessionFromRow[field.key];
                 if (value !== undefined) {
                     if (field.key.endsWith('_classification') && field.label.includes('(comma-sep)')) {
                        // Value is already an array from standardization
                        formDataForRow.assessment_skills[keyWithoutPrefix] = value; 
                     } else {
                        formDataForRow.assessment_skills[keyWithoutPrefix] = value;
                     }
                 } else {
                      if (field.key.endsWith('_classification') && field.label.includes('(comma-sep)')) {
                         formDataForRow.assessment_skills[keyWithoutPrefix] = [];
                      } else {
                         formDataForRow.assessment_skills[keyWithoutPrefix] = '';
                      }
                 }
            });
            
            TREATMENT_SKILL_FIELDS.forEach(field => {
                 const keyWithoutPrefix = field.key.replace('ts_', '');
                 const value = sessionFromRow[field.key];
                 if (value !== undefined) {
                     formDataForRow.treatment_skills[keyWithoutPrefix] = value;
                 } else {
                     formDataForRow.treatment_skills[keyWithoutPrefix] = '';
                 }
            });
            
            // --- Final Payload Construction ---
            const payload = {
                serviceType: activeService, status: 'complete', healthWorkerName: sessionFromRow.health_worker_name || '',
                workerType: sessionFromRow.worker_job_title || null, 
                facilityType: sessionFromRow.facility_type || null, 
                notes: formDataForRow.notes || '',
                mentorEmail: sessionFromRow.mentor_email || user.email || 'unknown@example.com',
                mentorName: user.displayName || 'Batch Upload',
                assessmentSkills: formDataForRow.assessment_skills,
                treatmentSkills: formDataForRow.treatment_skills,
                finalDecision: sessionFromRow.finalDecision ?? '',
                decisionMatches: sessionFromRow.decisionMatches ?? '',
            };

            // Date processing
            try {
                let effectiveDate;
                if (sessionFromRow.session_date instanceof Date) {
                    effectiveDate = Timestamp.fromDate(sessionFromRow.session_date);
                    // Use the pre-calculated dateStr
                    payload.sessionDate = currentSessionDate || sessionFromRow.session_date.toISOString().split('T')[0];
                } else {
                    const parsedDate = new Date(sessionFromRow.session_date);
                    if (isNaN(parsedDate.getTime())) throw new Error('Invalid date format');
                    effectiveDate = Timestamp.fromDate(parsedDate);
                     // Use the pre-calculated dateStr
                    payload.sessionDate = currentSessionDate || parsedDate.toISOString().split('T')[0];
                }
                payload.effectiveDate = effectiveDate;
            } catch (e) {
                 payload.effectiveDate = null;
                 payload.sessionDate = null; // Set sessionDate to null also
                 hasError = true;
            }
            
            // Location processing
            // MODIFIED: State name lookup uses the new lookup logic (English or Arabic)
            const stateKey = stateArToKey[String(sessionFromRow.state).trim().toLowerCase()];
            const localityKey = localityArToKey(stateKey, String(sessionFromRow.locality));
            payload.state = stateKey;
            payload.locality = localityKey;
            payload.facilityName = sessionFromRow.facility_name;
            const facilityNameLower = String(sessionFromRow.facility_name).trim().toLowerCase();
            const lookupKey = `${stateKey}-${localityKey}-${facilityNameLower}`;
            payload.facilityId = facilityLookup.get(lookupKey) || null;

            // --- 5. START: MODIFIED Visit Number Calculation ---
            let visitNumber = null;
            
            // Only proceed if we have a valid date and key
            if (currentSessionDate && workerFacilityKey) {
                // 1. Get the baseline data from the DB map
                const baseData = existingVisitCounts.get(workerFacilityKey) || { count: 0, lastDate: null };
                
                // 2. Get the current tracking data for this worker *from this file*
                const trackerData = internalVisitTracker.get(workerFacilityKey);
                
                if (!trackerData) {
                    // This is the first row for this worker *in this file*.
                    // Compare to the baseline from the DB.
                    if (currentSessionDate === baseData.lastDate) {
                        // This session is on the *same day* as their last DB visit. Use the same count.
                        visitNumber = baseData.count;
                        // Start tracking based on this baseline
                        internalVisitTracker.set(workerFacilityKey, { count: baseData.count, lastDate: baseData.lastDate });
                    } else {
                        // This session is on a *new day* (or it's their first-ever visit). Increment.
                        visitNumber = baseData.count + 1;
                        // Start tracking with the new incremented count and date
                        internalVisitTracker.set(workerFacilityKey, { count: baseData.count + 1, lastDate: currentSessionDate });
                    }
                } else {
                    // We *have* seen this worker in a previous row *in this file*. Use the tracker.
                    if (currentSessionDate === trackerData.lastDate) {
                        // This session is on the *same day* as a previous row. Use the same count.
                        visitNumber = trackerData.count;
                        // No need to update the tracker, it's correct.
                    } else {
                        // This session is on a *new day* compared to the previous row. Increment.
                        visitNumber = trackerData.count + 1;
                        // Update the tracker with the new incremented count and date
                        internalVisitTracker.set(workerFacilityKey, { count: trackerData.count + 1, lastDate: currentSessionDate });
                    }
                }
            }
            
            payload.visitNumber = visitNumber;
            // --- END: MODIFIED Visit Number Calculation ---


             // Score calculation - must convert multi-select arrays back to objects for the function
             try {
                 const formDataForScoring = {
                     ...formDataForRow,
                     assessment_skills: {
                         ...formDataForRow.assessment_skills,
                         worker_diarrhea_classification: (formDataForRow.assessment_skills.worker_diarrhea_classification || []).reduce((acc, c) => { acc[c] = true; return acc; }, {}),
                         supervisor_correct_diarrhea_classification: (formDataForRow.assessment_skills.supervisor_correct_diarrhea_classification || []).reduce((acc, c) => { acc[c] = true; return acc; }, {}),
                         worker_fever_classification: (formDataForRow.assessment_skills.worker_fever_classification || []).reduce((acc, c) => { acc[c] = true; return acc; }, {}),
                         supervisor_correct_fever_classification: (formDataForRow.assessment_skills.supervisor_correct_fever_classification || []).reduce((acc, c) => { acc[c] = true; return acc; }, {}),
                     }
                 };
                 payload.scores = calculateScores(formDataForScoring);
             } catch (scoreError) {
                 payload.scores = {};
                 hasError = true;
             }
             
             if (!hasError) {
                 processedSessions.push(payload);
             } 

        }); // --- End of preProcessedData.forEach loop ---

        if (processedSessions.length === 0) {
            setError('No valid sessions could be processed from the Excel file. Check required fields and formats.');
            setCurrentPage(1);
            return;
        }
        // Pass the processed (sorted) sessions, and the original (unsorted) raw data
        // The import function will use originalRawData for error reporting
        onImport(processedSessions, originalRawData);
    };

    const startImportProcess = (data, rawData) => processAndStartImport(data, rawData);
    const handleRetryUpload = () => {
        const dataToRetry = failedRows.map(failedRow => failedRow.rowData);
        setFailedRows([]);
        // Pass allSubmissions again for the retry
        processAndStartImport(dataToRetry, dataToRetry, allSubmissions); 
    };
    const handleCorrectionDataChange = (errorIndex, cellIndex, value) => {
        const updatedFailedRows = [...failedRows];
        const newRowData = [...updatedFailedRows[errorIndex].rowData];
        newRowData[cellIndex] = value;
        updatedFailedRows[errorIndex].rowData = newRowData;
        setFailedRows(updatedFailedRows);
    };
    const renderPreview = () => (excelData.length === 0) ? null : (
        <div className="mt-4 overflow-auto max-h-60">
            <h4 className="font-medium mb-2">Data Preview (first 5 rows)</h4>
            <table className="min-w-full border border-gray-200">
                <thead><tr className="bg-gray-100">{headers.map((header, idx) => <th key={idx} className="border border-gray-300 p-2 text-left text-xs">{header}</th>)}</tr></thead>
                <tbody>{excelData.slice(0, 5).map((row, rowIdx) => <tr key={rowIdx}>{row.map((cell, cellIdx) => <td key={cellIdx} className="border border-gray-300 p-2 text-xs">{cell instanceof Date ? cell.toLocaleDateString() : cell}</td>)}</tr>)}</tbody>
            </table>
        </div>
    );
    const MappingRow = ({ field, headers, selectedValue, onMappingChange }) => (
        <div className="flex flex-col">
            <label htmlFor={field.key} className="text-sm font-medium mb-1">
                {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <Select
                id={field.key}
                value={selectedValue || ''}
                onChange={(e) => onMappingChange(field.key, e.target.value)}
                className="text-sm"
            >
                <option value="">-- Do not import --</option>
                {headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                ))}
            </Select>
        </div>
    );
    const renderProgressView = () => (
        <div>
            <h4 className="font-medium text-lg mb-2">Import in Progress...</h4>
            <p className="text-sm text-gray-600 mb-4">Please wait while the sessions are being uploaded.</p>
            <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full transition-all duration-500" style={{ width: `${uploadStatus.total > 0 ? (uploadStatus.processed / uploadStatus.total) * 100 : 0}%` }}></div>
            </div>
            <p className="text-center mt-2 font-medium">{uploadStatus.processed} / {uploadStatus.total}</p>
        </div>
    );
    const renderResultView = () => (
         <div>
            <h4 className="font-medium text-lg mb-2">Import Complete</h4>
            <div className="bg-gray-50 p-4 rounded-md">
                <p className="font-semibold whitespace-pre-wrap">{uploadStatus.message}</p>
                 {uploadStatus.errors && uploadStatus.errors.some(e => e.rowData) && (
                    <div className="mt-4 max-h-40 overflow-y-auto">
                        <h5 className="font-semibold text-red-700">Rows with Errors:</h5>
                        <ul className="list-disc list-inside text-sm text-red-600">
                            {uploadStatus.errors.filter(e => e.rowData).map((err, index) =>
                                <li key={index}>Row {err.rowIndex + 2}: {err.message}</li>
                            )}
                        </ul>
                         <p className="text-sm mt-2">Go back to the 'Correction Screen' to fix these rows.</p>
                    </div>
                )}
                 {uploadStatus.errors && !uploadStatus.errors.some(e => e.rowData) && uploadStatus.errors.length > 0 && (
                     <div className="mt-4 max-h-40 overflow-y-auto">
                         <h5 className="font-semibold text-red-700">Errors encountered:</h5>
                         <ul className="list-disc list-inside text-sm text-red-600">
                             {uploadStatus.errors.map((err, index) => <li key={index}>{err.message || err.toString()}</li>)}
                         </ul>
                     </div>
                 )}
            </div>
            <div className="flex justify-end mt-6">
                 {failedRows.length > 0 && (
                     <Button variant="secondary" onClick={() => setCurrentPage('correction')} className="mr-2">
                         Go to Correction Screen ({failedRows.length})
                     </Button>
                 )}
                 <Button onClick={onClose}>Close</Button>
            </div>
        </div>
    );
    const renderCorrectionScreen = () => (
        <div>
            <h4 className="font-medium text-lg text-red-700 mb-2">Import Errors</h4>
            <p className="text-sm text-gray-600 mb-4">Some rows failed to import. You can correct the data below and retry uploading only the failed rows.</p>
            <div className="overflow-x-auto max-h-[60vh] border rounded-md">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-2 border-r text-left">Row #</th>
                            <th className="p-2 border-r text-left">Error</th>
                            {headers.map(header => <th key={header} className="p-2 border-r text-left whitespace-nowrap">{header}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {failedRows.map((error, errorIndex) => (
                            <tr key={error.rowIndex} className="bg-white hover:bg-red-50">
                                <td className="p-1 border-r font-medium">{error.rowIndex + 2}</td>
                                <td className="p-1 border-r text-red-600 max-w-xs">{error.message}</td>
                                {error.rowData.map((cell, cellIndex) => (
                                    <td key={cellIndex} className="p-0 border-r">
                                        <Input
                                            type="text"
                                            value={cell || ''}
                                            onChange={(e) => handleCorrectionDataChange(errorIndex, cellIndex, e.target.value)}
                                            className="w-full border-0 rounded-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleRetryUpload}>Retry Upload for {failedRows.length} Corrected Row(s)</Button>
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Upload (Detailed) for ${activeService}`} size="full">
            <div className="p-4">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
                {currentPage === 0 && (
                    <div>
                        <p className="mb-4">Download the detailed template for {activeService}. Use Arabic or English names for State. Use Arabic names for Locality. Use 'yes', 'no', 'na' for skill checks. Use comma-separated values for multi-select classifications (e.g., "بعض الجفاف,دسنتاريا").</p>
                        <Button variant="secondary" onClick={handleDownloadTemplate} className="mb-4">Download Template</Button>
                        <hr className="my-4" />
                        <p className="mb-2">Or, upload your completed Excel file (first row must be headers).</p>
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} ref={fileInputRef} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                )}
                {currentPage === 1 && (
                    <div>
                        <h4 className="font-medium mb-4">Map Excel columns to application fields</h4>
                        <p className="text-sm text-gray-600 mb-4">Match columns to fields. Base fields marked * are required for basic processing. **Note: Input standardization is applied (case/space insensitive) to 'yes/no/na' and classification fields.**</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 mb-4 max-h-[50vh] overflow-y-auto p-2 border rounded">
                            {ALL_MENTORSHIP_FIELDS.map(field =>
                                <MappingRow
                                    key={field.key}
                                    field={field}
                                    headers={headers}
                                    selectedValue={fieldMappings[field.key]}
                                    onMappingChange={handleMappingChange}
                                />
                            )}
                        </div>
                        {renderPreview()}
                        <div className="flex justify-end mt-6 space-x-2">
                            <Button variant="secondary" onClick={() => setCurrentPage(0)}>Back</Button>
                            <Button onClick={handleValidation}>Validate and Continue</Button>
                        </div>
                    </div>
                )}
                {currentPage === 'correction' && renderCorrectionScreen()}
                {currentPage === 2 && renderProgressView()}
                {currentPage === 3 && renderResultView()}
            </div>
        </Modal>
    );
};

export default DetailedMentorshipBulkUploadModal;