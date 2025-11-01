// SkillsMentorshipView.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDataCache } from '../DataContext';
import { Timestamp } from 'firebase/firestore';
import {
    saveMentorshipSession,
    importMentorshipSessions,
    addHealthWorkerToFacility,
    deleteMentorshipSession
} from '../data';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox, Modal
} from './CommonComponents';
import { STATE_LOCALITIES } from "./constants.js";
import SkillsAssessmentForm from './SkillsAssessmentForm';
import MentorshipDashboard from './MentorshipDashboard'; // <-- IMPORT ADDED
import { getAuth } from "firebase/auth";

// --- NEW IMPORT: Bulk Upload Modal ---
import DetailedMentorshipBulkUploadModal from './MentorshipBulkUpload';
// --- END NEW IMPORT ---

// --- NEW IMPORT: Mothers Form ---
import MothersForm from './MothersForm'; // <-- NEW IMPORT
// --- END NEW IMPORT ---

// --- Form Structure (Copied for reference in Bulk Upload - Keep in sync with SkillsAssessmentForm.jsx) ---
// --- Classification Constants (Copied for reference) ---
const COUGH_CLASSIFICATIONS = ["التهاب رئوي شديد أو مرض شديد جدا", "التهاب رئوي", "كحة أو نزلة برد"]; // Note: Adjusted to match SkillsAssessmentForm
const DIARRHEA_CLASSIFICATIONS = ["جفاف شديد", "بعض الجفاف", "لا يوجد جفاف", "إسهال مستمر شديد", "إسهال مستمر", "دسنتاريا"]; // Note: Adjusted to match SkillsAssessmentForm
const FEVER_CLASSIFICATIONS = ["مرض حمي شديد", "ملاريا", "حمى لا توجد ملارIA", "حصبة مصحوبة بمضاعفات شديدة", "حصبة مصحوبة بمضاعفات في العين والفم", "حصبة"]; // Note: Adjusted to match SkillsAssessmentForm
const EAR_CLASSIFICATIONS = ["التهاب العظمة خلف الاذن", "التهاب أذن حاد", "التهاب أذن مزمن", "لا يوجد التهاب أذن"];
const MALNUTRITION_CLASSIFICATIONS = ["سوء تغذية شديد مصحوب بمضاعفات", "سوء تغذية شديد غير مصحوب بمضاعفات", "سوء تغذية حاد متوسط", "لا يوجد سوء تغذية"]; // Note: Adjusted to match SkillsAssessmentForm
const ANEMIA_CLASSIFICATIONS = ["فقر دم شديد", "فقر دم", "لا يوجد فقر دم"];
const createInitialClassificationState = (classifications) => classifications.reduce((acc, c) => { acc[c] = false; return acc; }, {});

// --- Helper function to evaluate the relevance logic (Copied from SkillsAssessmentForm) ---
const evaluateRelevance = (relevanceString, formData) => {
    // ... (Implementation unchanged) ...
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
     // Specific lookups if still undefined (Copied from SkillsAssessmentForm)
    if (actualValue === undefined && varName.startsWith('as_')) actualValue = formData.assessment_skills?.[varName.replace('as_','')];
    if (actualValue === undefined && varName.startsWith('ts_')) actualValue = formData.treatment_skills?.[varName.replace('ts_','')];

    if (expectedValue.toLowerCase() === 'yes') return actualValue === 'yes';
    if (expectedValue.toLowerCase() === 'no') return actualValue === 'no';
    if (expectedValue.toLowerCase() === 'na') return actualValue === 'na';
    return actualValue === expectedValue;
};


// --- Function to calculate scores (Copied & adapted from SkillsAssessmentForm) ---
const calculateScores = (formData) => {
    // ... (Implementation unchanged) ...
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
                    // Note: maxScore is null in SkillsAssessmentForm, dynamically calculated
                    skills: [
                        { key: 'skill_ref_abx', label: 'في حالة التحويل : هل أعطى الجرعة الاولى من المضاد الحيوي المناسب قبل تحويل الطفل' },
                        { key: 'skill_ref_quinine', label: 'في حالة التحويل : أعطى الكينيين بالعضل قبل التحويل', 
                            relevant: (formData) => { // Use function for accurate check
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
                    skills: [ { key: 'skill_pneu_abx', label: 'هل وصف مضاد حيوي لعلاج الالتهاب الرئوي بصورة صحيحة' }, { key: 'skill_pneu_dose', label: 'هل أعطى الجrعة الأولى من مضاد حيوي لعلاج الالتهاب الرئوي بالعيادة بصورة صحيحة', relevant: "${ts_skill_pneu_abx}='yes'" }, ],
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
                    skills: [ { key: 'skill_diar_ors', label: 'هل حدد كمية محلول الإرواء بصورة صحيحة' }, { key: 'skill_diar_counsel', label: 'هل نصح الأم بالRعاية المنزلية بإعطاء سوائل أكثر و الاستمرار في تغذية الطفل)' }, { key: 'skill_diar_zinc', label: 'هل وصف دواء الزنك بصورة صحيحة' }, { key: 'skill_diar_zinc_dose', label: 'هل أعطى الجrعة الأولى من دواء الزنك للطفل بالوحدة الصحية بطريقة صحيحة', relevant: "${ts_skill_diar_zinc}='yes'" }, ],
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
                    skills: [ { key: 'skill_dyst_abx', label: 'هل وصف مضاد حيوي لعلاج الدسنتاريا بصورة صحيحة' }, { key: 'skill_dyst_dose', label: 'هل أعطى الجrعة الأولى من مضاد حيوي لعلاج الدسنتاريا في العيادة بصورة صحيحة', relevant: "${ts_skill_dyst_abx}='yes'" }, ],
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
                    skills: [ { key: 'skill_mal_meds', label: 'هل وصف دواء لعلاج الملاريا بصورة صحيحة' }, { key: 'skill_mal_dose', label: 'هل أعطى الجrعة الأولى من الدواء لعلاج الملاريا في العيادة بصورة صحيحة', relevant: "${ts_skill_mal_meds}='yes'" }, ],
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
                    skills: [ { key: 'skill_ear_abx', label: 'هل وصف مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة' }, { key: 'skill_ear_dose', label: 'هل أعطى الجrعة الأولى من مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة', relevant: "${ts_skill_ear_abx}='yes'" }, { key: 'skill_ear_para', label: 'هل وصف دواء الباراسيتامول بصورة صحيحة' }, { key: 'skill_ear_para_dose', label: 'هل أعطى الجrعة الأولى من الباراسيتامول بصورة صحيحة', relevant: "${ts_skill_ear_para}='yes'" }, ],
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
                    ], // Bulk upload fields differ slightly here (no skill_nut_refer_otp)
                    relevant: (formData) => {
                        const didClassifyCorrectly = formData.assessment_skills?.skill_mal_classify === 'yes';
                        const workerCls = formData.assessment_skills?.worker_malnutrition_classification;
                        const supervisorCls = formData.assessment_skills?.supervisor_correct_malnutrition_classification;
                        const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                        return ['سوء تغذية شديد غير مصحوب بمضاعفات', 'سوء تغذية حاد متوسط'].includes(effectiveCls); // Use correct constants
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

    const scores = {};
    let totalMaxScore = 0;
    let totalCurrentScore = 0;

    IMNCI_FORM_STRUCTURE.forEach(group => {
        let groupCurrentScore = 0;
        let groupMaxScore = 0;

        if (group.isDecisionSection) {
            groupMaxScore = 1;
            groupCurrentScore = formData.decisionMatches === 'yes' ? 1 : 0;
            totalMaxScore += groupMaxScore;
            totalCurrentScore += groupCurrentScore;
            if (group.scoreKey) {
                scores[group.scoreKey] = { score: groupCurrentScore, maxScore: groupMaxScore };
            }
        } else if (group.sectionKey) {
            const sectionData = formData[group.sectionKey] || {};
            let groupRelevantMaxScore = 0;

            group.subgroups?.forEach(subgroup => {
                let subgroupCurrentScore = 0;
                let subgroupMaxScore = 0;
                let subgroupRelevantMaxScore = 0;
                let isSubgroupRelevantForScoring = true;

                if (subgroup.relevant) {
                    if (typeof subgroup.relevant === 'function') {
                        isSubgroupRelevantForScoring = subgroup.relevant(formData);
                    } else if (typeof subgroup.relevant === 'string') {
                        const simplifiedRelevanceString = subgroup.relevant.replace(/\$\{(.*?)\}/g, (match, key) => {
                            let val = formData[key] ?? sectionData[key] ?? formData.assessment_skills?.[key] ?? formData.treatment_skills?.[key];
                             if (key.startsWith('as_') && val === undefined) val = formData.assessment_skills?.[key.replace('as_', '')];
                             if (key.startsWith('ts_') && val === undefined) val = formData.treatment_skills?.[key.replace('ts_', '')];
                            return `'${val || ''}'`;
                        });
                        try {
                           isSubgroupRelevantForScoring = eval(simplifiedRelevanceString.replace(/='(.*?)'/g, '===\'$1\''));
                        } catch (e) {
                            console.warn("Error evaluating subgroup relevance:", simplifiedRelevanceString, e);
                            isSubgroupRelevantForScoring = false;
                        }
                    } else {
                         isSubgroupRelevantForScoring = false;
                    }
                }

                if (!isSubgroupRelevantForScoring) {
                   if (subgroup.scoreKey) {
                        scores[subgroup.scoreKey] = { score: 0, maxScore: 0 };
                   }
                   return;
                }

                if (subgroup.isSymptomGroupContainer) {
                    subgroup.symptomGroups?.forEach(sg => {
                         const askSkillKey = sg.mainSkill.key;
                         const symptomPrefix = askSkillKey.split('_')[2];
                         const confirmsKey = `supervisor_confirms_${symptomPrefix}`;
                         const checkSkillKey = `skill_check_${symptomPrefix === 'cough' ? 'rr' : symptomPrefix === 'diarrhea' ? 'dehydration' : symptomPrefix === 'fever' ? 'rdt' : 'ear'}`;
                         const classifySkillKey = `skill_classify_${symptomPrefix}`;

                         let currentSymptomScore = 0;
                         let maxSymptomScore = 0;

                         if (sectionData[askSkillKey] === 'yes' || sectionData[askSkillKey] === 'no') {
                            maxSymptomScore += 1;
                            if (sectionData[askSkillKey] === 'yes') currentSymptomScore += 1;
                         }

                         if (sectionData[askSkillKey] === 'yes' && formData.assessment_skills?.[confirmsKey] === 'yes') {
                             if (sectionData[checkSkillKey] === 'yes' || sectionData[checkSkillKey] === 'no') {
                                maxSymptomScore += 1;
                                if (sectionData[checkSkillKey] === 'yes') currentSymptomScore += 1;
                             }
                             if (sectionData[classifySkillKey] === 'yes' || sectionData[classifySkillKey] === 'no') {
                                maxSymptomScore += 1;
                                if (sectionData[classifySkillKey] === 'yes') currentSymptomScore += 1;
                             }
                         }
                         subgroupCurrentScore += currentSymptomScore;
                         subgroupRelevantMaxScore += maxSymptomScore;
                         if (sg.mainSkill.scoreKey) {
                             scores[sg.mainSkill.scoreKey] = { score: currentSymptomScore, maxScore: maxSymptomScore };
                         }
                    });
                } else if (Array.isArray(subgroup.skills)) {
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
                            if (value === 'yes' || value === 'no') {
                                subgroupRelevantMaxScore += 1;
                                if (value === 'yes') {
                                    subgroupCurrentScore += 1;
                                }
                            }
                        }
                    });
                }

                groupCurrentScore += subgroupCurrentScore;
                groupRelevantMaxScore += subgroupRelevantMaxScore;

                if (subgroup.scoreKey) {
                    scores[subgroup.scoreKey] = { score: subgroupCurrentScore, maxScore: subgroupRelevantMaxScore };
                }
            });

            totalCurrentScore += groupCurrentScore;
            totalMaxScore += groupRelevantMaxScore;

            if (group.scoreKey) {
                 scores[group.scoreKey] = { score: groupCurrentScore, maxScore: groupRelevantMaxScore };
            }
             if (group.sectionKey === 'assessment_skills') {
                scores['assessment_total_score'] = { score: groupCurrentScore, maxScore: groupRelevantMaxScore };
             }
             if (group.sectionKey === 'treatment_skills') {
                 scores['treatment_score'] = { score: groupCurrentScore, maxScore: groupRelevantMaxScore };
             }
        }
    });

    scores.overallScore = { score: totalCurrentScore, maxScore: totalMaxScore };
    const scoresPayload = {};
     for (const key in scores) {
         if (key !== 'treatment_score' && scores[key]?.score !== undefined && scores[key]?.maxScore !== undefined) {
             scoresPayload[`${key}_score`] = scores[key].score;
             scoresPayload[`${key}_maxScore`] = scores[key].maxScore;
         }
     }
     if(scores['treatment_score']){
        scoresPayload['treatment_score'] = scores['treatment_score'].score;
        scoresPayload['treatment_maxScore'] = scores['treatment_score'].maxScore;
     } else {
        scoresPayload['treatment_score'] = 0;
        scoresPayload['treatment_maxScore'] = 0;
     }

    return scoresPayload;
};
// --- END calculateScores ---


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
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">Action</th>
    </>
);
// --- END Mentorship Table Column Component ---

// --- Friendly Service Titles (MODIFIED to English) (KEPT AS-IS) ---
const SERVICE_TITLES = {
    // ... (Implementation unchanged) ...
    'IMNCI': 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)',
    'EENC': 'Early Essential Newborn Care (EENC)',
    'ETAT': 'Emergency Triage, Assessment and Treatment (ETAT)',
    'IPC': 'Infection Prevention and Control in Neonatal Units (IPC)',
    'IMNCI_MOTHERS': 'Mother\'s Knowledge & Satisfaction Survey (IMNCI)' // <-- ADDED
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
    if (submission.serviceType === 'IMNCI_MOTHERS') {
         // Display Mother's Form data
         const { mothersKnowledge = {}, mothersSatisfaction = {} } = submission;
         
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
                     {renderMotherData(mothersKnowledge, 'معرفة الأمهات')}
                     {renderMotherData(mothersSatisfaction, 'رضا الأمهات')}
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
        if (activeService) {
            // Filter by the main service *program* (e.g., IMNCI) and its related forms (IMNCI_MOTHERS)
            filtered = filtered.filter(sub => sub.service === activeService || sub.service === 'IMNCI_MOTHERS'); 
        }
        // NEW: Add secondary filter for the specific tab (skills vs mothers)
        if (filterServiceType) {
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
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">{/* <-- FIX: Removed whitespace */}
                                {filteredSubmissions.length === 0 ? (
                                    <tr><td colSpan="8" className="border border-gray-300"><EmptyState title="No Records Found" message="No mentorship visits matched the current filters for this service." /></td></tr>
                                ) : (
                                    filteredSubmissions.map((sub, index) => {
                                        const scoreData = sub.scores;
                                        let percentage = null;
                                        if (scoreData && scoreData.overallScore_maxScore > 0) {
                                            percentage = Math.round((scoreData.overallScore_score / scoreData.overallScore_maxScore) * 100);
                                        }

                                        // NEW: Determine worker name/service for display
                                        const workerDisplay = sub.service === 'IMNCI_MOTHERS' 
                                            ? `Survey: ${sub.motherName || 'N/A'}`
                                            : sub.staff;
                                        const serviceStatus = sub.service === 'IMNCI_MOTHERS' 
                                            ? 'Mother\'s Survey' 
                                            : (sub.status === 'draft' ? 'Draft' : 'Complete');

                                        return (
                                        <tr key={sub.id} className={sub.status === 'draft' ? 'bg-yellow-50' : (sub.service === 'IMNCI_MOTHERS' ? 'bg-blue-50' : 'bg-white')}>
                                            {/* --- MODIFICATION: Added border class to all <td>s --- */}
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left border border-gray-300">{index + 1}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{sub.facility}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left font-semibold border border-gray-300">{workerDisplay}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{sub.supervisorDisplay}</td> {/* <-- USE DISPLAY */}
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-left border border-gray-300">{sub.date}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-left border border-gray-300">
                                                {sub.service === 'IMNCI_MOTHERS' ? (
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
                                                {sub.service === 'IMNCI_MOTHERS' ? 'N/A' : (percentage !== null ? `${percentage}%` : 'N/A')}
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

// --- Service Selection Component (MODIFIED to English Layout) (KEPT AS-IS) ---
const ServiceSelector = ({ onSelectService }) => {
    // ... (Implementation unchanged) ...
    const services = [
        { key: 'IMNCI', title: 'Mentorship on Integrated Management of Newborn and Childhood Illnesses (IMNCI)', enabled: true },
        { key: 'EENC', title: 'Mentorship on Early Essential Newborn Care (EENC)', enabled: false },
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
    const [activeTab, setActiveTab] = useState('skills_list'); // MODIFIED: Default to skills_list

    // --- NEW STATE ADDITIONS ---
    const [activeFormType, setActiveFormType] = useState('skills_assessment'); // 'skills_assessment' or 'mothers_form'
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
        isFacilitiesLoading, // Use this directly for form setup
    } = useDataCache();
    // --- END MODIFICATION ---

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


     // --- MODIFICATION START ---
     useEffect(() => {
        fetchHealthFacilities();

        // If we are in public mode, App.jsx's view-based fetcher
        // (in App.jsx) didn't run, so we must trigger the submission
        // fetch here. We need this data for visit number calculation and drafts.
        if (publicSubmissionMode) {
            fetchSkillMentorshipSubmissions();
        }

    }, [fetchHealthFacilities, fetchSkillMentorshipSubmissions, publicSubmissionMode]); // Add fetchSkillMentorshipSubmissions to deps array
    // --- MODIFICATION END ---
    
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
        if (!healthFacilities || !selectedState || !selectedLocality) return [];
        return healthFacilities.filter(f => f['الولاية'] === selectedState && f['المحلية'] === selectedLocality)
               .sort((a, b) => (a['اسم_المؤسسة'] || '').localeCompare(b['اسم_المؤسسة'] || ''));
    }, [healthFacilities, selectedState, selectedLocality]);

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

    // --- Visit Number Logic MODIFICATION ---
    const visitNumber = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return 1;
        }

        // Authenticated Logic (unchanged)
        const existingVisitsCount = processedSubmissions.filter(sub =>
            sub.facilityId === selectedFacilityId &&
            sub.staff === selectedHealthWorkerName &&
            sub.service === activeService &&
            sub.status !== 'draft' // Only count completed visits
        ).length;

        // If editing a COMPLETED session, keep its original visit number
        if (editingSubmission && editingSubmission.status === 'complete') {
             return editingSubmission.visitNumber || 1; 
        }
        // If editing a DRAFT, calculate as if it's a new visit (count completed ones + 1)
        else if (editingSubmission && editingSubmission.status === 'draft') {
            return existingVisitsCount + 1;
        }
        // If creating a new visit, count completed ones + 1
        return existingVisitsCount + 1;

    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService, editingSubmission]); // <-- MODIFICATION: Removed publicSubmissionMode from deps

    // --- Last Session Date Logic MODIFICATION ---
    const lastSessionDate = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return null;
        }

        // Authenticated Logic (unchanged)
        const workerSessions = processedSubmissions
            .filter(sub =>
                sub.facilityId === selectedFacilityId &&
                sub.staff === selectedHealthWorkerName &&
                sub.service === activeService &&
                sub.status !== 'draft' // Only consider completed sessions for 'last session'
            )
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort completed sessions

        // If editing, find the latest COMPLETED session *before* the one being edited
        if (editingSubmission) {
            const sessionsBeforeThisOne = workerSessions.filter(s =>
                s.id !== editingSubmission.id && // Exclude the current draft/session
                new Date(s.date) < new Date(editingSubmission.date) // Only consider sessions strictly before
            );
             return sessionsBeforeThisOne.length > 0 ? sessionsBeforeThisOne[0].date : null;
        }
        // If creating new, find the latest completed session
        else {
            return workerSessions.length > 0 ? workerSessions[0].date : null;
        }
    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService, editingSubmission]); // <-- MODIFICATION: Removed publicSubmissionMode from deps


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

    const handleReturnToServiceSelection = () => {
        setActiveService(null);
        setCurrentView('service_selection');
        resetSelection();
    };

    const handleFormCompletion = async () => {
        const wasEditing = !!editingSubmission;

        const completedFormType = activeFormType; // Capture the type before reset
        resetSelection(); // This now also clears editingSubmission, resets activeFormType, and isReadyToStart

        if (completedFormType === 'skills_assessment') {
             if (publicSubmissionMode) {
                setToast({ show: true, message: 'Submission successful! Thank you.', type: 'success' });
                 setCurrentView('form_setup'); // Go back to setup in public mode
             } else {
                 // If coming from setup OR finishing an edit, refresh history
                 if (previousViewRef.current === 'form_setup' || wasEditing) {
                    await fetchSkillMentorshipSubmissions(true);
                 }
                setCurrentView('history'); // Go back to history in normal mode
                setActiveTab('skills_list'); // MODIFIED: Go to skills list after saving
             }
        }
        // NEW: If it was the Mother's Form, go back to history without editing flag
        else if (completedFormType === 'mothers_form') {
             await fetchSkillMentorshipSubmissions(true); 
             setToast({ show: true, message: 'استبيان الأم تم حفظه بنجاح!', type: 'success' });
             setCurrentView('history'); 
             setActiveTab('mothers_list'); // MODIFIED: Go to mothers list after saving
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
        } else if (activeFormType === 'mothers_form') {
            // Mother's form doesn't have drafts, just proceed.
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
        // ... (Implementation unchanged) ...
        const user = auth.currentUser;
        if (!selectedFacilityId || !workerData.name) {
             setToast({ show: true, message: 'خطأ: لم يتم تحديد المؤسسة أو اسم العامل الصحي.', type: 'error' });
            return;
        }
        try {
            const mentorIdentifier = user ? (user.displayName || user.email) : (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm');
            await addHealthWorkerToFacility(selectedFacilityId, workerData, mentorIdentifier);
            await fetchHealthFacilities(true);
            setToast({ show: true, message: 'تمت إضافة العامل الصحي بنجاح!', type: 'success' });
            setWorkerJobTitle('');
            setWorkerTrainingDate('');
            setWorkerPhone('');
            setIsWorkerInfoChanged(false);
            setSelectedWorkerOriginalData(null);
            setSelectedHealthWorkerName(workerData.name);
            setIsAddWorkerModalOpen(false);
        } catch (error) {
            console.error("Error saving new health worker:", error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        }
    };
    const handleUpdateHealthWorkerInfo = async () => {
        // ... (Implementation unchanged) ...
        if (!selectedHealthWorkerName || !selectedFacilityId || !isWorkerInfoChanged) {
            return;
        }
        setIsUpdatingWorker(true);
        const user = auth.currentUser;
        try {
             // Use default identifier for public mode, otherwise use current user
             const mentorIdentifier = publicSubmissionMode
                 ? 'PublicMentorshipForm'
                 : (user ? (user.displayName || user.email) : 'SkillsMentorshipForm');

             const updatedData = {
                name: selectedHealthWorkerName,
                job_title: workerJobTitle,
                training_date: workerTrainingDate,
                phone: workerPhone
             };
             await addHealthWorkerToFacility(selectedFacilityId, updatedData, mentorIdentifier);
             await fetchHealthFacilities(true);
             setToast({ show: true, message: 'تم تحديث بيانات العامل الصحي بنجاح!', type: 'success' });
             setIsWorkerInfoChanged(false);
             // Re-fetch worker data after update to reset original data baseline
             const updatedFacility = await fetchHealthFacilities(true).then(() => healthFacilities.find(f => f.id === selectedFacilityId)); // Re-fetch might be needed
             if (updatedFacility?.imnci_staff) {
                 const staffList = typeof updatedFacility.imnci_staff === 'string' ? JSON.parse(updatedFacility.imnci_staff) : updatedFacility.imnci_staff;
                 const freshWorkerData = Array.isArray(staffList) ? staffList.find(w => w.name === selectedHealthWorkerName) : null;
                 setSelectedWorkerOriginalData(freshWorkerData);
             }
        } catch (error) {
             console.error("Error updating health worker info:", error);
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
        const isMothersActive = activeFormType === 'mothers_form';
        
        const navItems = [
            { id: 'skills_assessment', label: 'Skills Form', active: isSkillsActive, disabled: false },
            { id: 'mothers_form', label: "Mother's Survey", active: isMothersActive, disabled: false },
            { id: 'facility_update', label: 'Facility Data', active: false, disabled: !isSkillsActive },
            { id: 'drafts', label: `Drafts (${draftCount})`, active: false, disabled: !isSkillsActive },
        ];

        return (
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center bg-gray-900 text-white border-t border-gray-700 shadow-lg">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavClick(item.id)}
                        disabled={item.disabled}
                        className={`flex flex-col items-center justify-center text-center p-2 w-1/4 transition-colors duration-150 h-16
                            ${item.active ? 'text-sky-400' : 'text-gray-300 hover:text-white'}
                            ${item.disabled ? 'text-gray-600 cursor-not-allowed' : ''}
                        `}
                    >
                        {/* Using text as icons */}
                        <span className="text-xs font-medium truncate">{item.label}</span>
                    </button>
                ))}
            </div>
        );
    };
    // --- END: Mobile Bottom Nav Bar Component ---

    // --- NEW: Handler for Mobile Nav Clicks ---
    const handleMobileNavClick = async (target) => {
        if (target === 'skills_assessment') {
            if (activeFormType === 'mothers_form') {
                const confirmSwitch = window.confirm("You are about to switch to the Skills Assessment. Your current Mother's Survey will be discarded. Proceed?");
                if (confirmSwitch) {
                    resetSelection(); 
                    setActiveFormType('skills_assessment');
                }
            }
        } 
        else if (target === 'mothers_form') {
            if (activeFormType === 'skills_assessment') {
                const confirmSwitch = window.confirm("You are about to switch to the Mother's Survey. Your current skills form will be saved as a draft. Proceed?");
                if (confirmSwitch) {
                    try {
                        if (formRef.current) {
                            await formRef.current.saveDraft();
                            await fetchSkillMentorshipSubmissions(true); // Refresh draft count
                        }
                        resetSelection();
                        setActiveFormType('mothers_form');
                    } catch (e) {
                        console.error("Failed to save draft before switching:", e);
                        setToast({ show: true, message: `Failed to save draft: ${e.message}`, type: 'error' });
                    }
                }
            }
        }
        else if (target === 'facility_update' && activeFormType === 'skills_assessment' && formRef.current) {
            formRef.current.openFacilityModal();
        }
        else if (target === 'drafts' && activeFormType === 'skills_assessment') {
            setIsDraftsModalOpen(true);
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
                                    filterServiceType="IMNCI"
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
                                    filterServiceType="IMNCI_MOTHERS"
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
    // when editing, ensuring all fields are passed to the form,
    // not just the ones saved in the draft.
    const facilityData = editingSubmission 
        ? (healthFacilities.find(f => f.id === editingSubmission.facilityId) || {
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
        // Pass the original editingSubmission data (not the processed one)
        return (
            <>
                {/* --- NEW: Sticky Drafts Button (Square, Top Right) --- */}
                 {publicSubmissionMode && user && (
                    <button
                        onClick={() => setIsDraftsModalOpen(true)}
                        className="fixed top-4 right-4 z-30 bg-yellow-500 text-white w-16 h-16 rounded-md shadow-lg hover:bg-yellow-600 transition-colors flex flex-col items-center justify-center text-xs font-medium"
                        title="عرض المسودات المحفوظة"
                        dir="rtl" // Ensure text direction is correct
                    >
                         <span>المسودات</span>
                         <span>({currentUserDrafts.length})</span>
                    </button>
                )}
                {/* --- END Sticky Drafts Button --- */}
                <SkillsAssessmentForm
                    ref={formRef} // MODIFIED: Pass the ref
                    facility={facilityData}
                    healthWorkerName={editingSubmission ? editingSubmission.healthWorkerName : selectedHealthWorkerName}
                    healthWorkerJobTitle={editingSubmission ? editingSubmission.workerType : workerJobTitle} // <-- MODIFIED: Use editing data if available
                    healthWorkerTrainingDate={workerTrainingDate}
                    healthWorkerPhone={workerPhone}
                    onCancel={handleFormCompletion}
                    setToast={setToast}
                    visitNumber={visitNumber}
                    existingSessionData={editingSubmission} // Pass the original data
                    lastSessionDate={lastSessionDate}
                    onDraftCreated={handleDraftCreated} // <-- MODIFIED: Pass handler
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
            </>
        );
    }
    
    // --- 2. Render MothersForm (MODIFIED) ---
    // --- MODIFIED: Added 'isReadyToStart' check ---
     if (currentView === 'form_setup' && activeFormType === 'mothers_form' && (isReadyToStart && selectedFacility) && activeService && !isAddWorkerModalOpen && !isWorkerInfoChanged) {
        // Render the new MothersForm component
        return (
            <>
                <MothersForm
                    facility={selectedFacility}
                    onCancel={handleFormCompletion} // Returns to history/submissions list
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


    // --- 3. Render Setup View (Fallback for selection) ---
    const isStateFilterDisabled = !publicSubmissionMode && userStates && userStates.length === 1;
    const isLocalityFilterDisabled = publicSubmissionMode ? !selectedState : (permissions.manageScope === 'locality' || !selectedState);

    if (currentView === 'form_setup') {
        const serviceTitleArabic = "الاشراف التدريبي الداعم على تطبيق العلاج المتكامل للاطفال اقل من 5 سنوات";
        const isSkillsAssessmentSetup = activeFormType === 'skills_assessment'; // Flag for worker requirement
        const setupTitle = isSkillsAssessmentSetup 
            ? (editingSubmission ? `تعديل جلسة: ${serviceTitleArabic}` : `إدخال بيانات: ${serviceTitleArabic}`) 
            : 'نموذج استبيان الأم: رضاء ومعرفة الأمهات';
        const setupSubtitle = isSkillsAssessmentSetup 
            ? "الرجاء اختيار الولاية والمحلية والمنشأة والعامل الصحي للمتابعة." 
            : "الرجاء اختيار الولاية والمحلية والمنشأة للمتابعة.";

        return (
            <>
                {/* --- NEW: Sticky Drafts Button --- */}
                {isSkillsAssessmentSetup && publicSubmissionMode && user && (
                    <button
                        onClick={() => setIsDraftsModalOpen(true)}
                        className="fixed top-1/2 right-4 transform -translate-y-1/2 z-30 bg-yellow-500 text-white px-3 py-2 rounded-md shadow-lg hover:bg-yellow-600 transition-colors"
                        title="عرض المسودات المحفوظة"
                        dir="rtl" // Ensure text direction is correct
                    >
                         عرض المسودات ({currentUserDrafts.length})
                    </button>
                )}
                {/* --- END Sticky Drafts Button --- */}

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
                        {isFacilitiesLoading ? (
                            <div className="flex justify-center p-8"><Spinner /></div>
                        ) : (
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
                                    <FormGroup label="المؤسسة الصحية" className="text-right">
                                        <Select value={selectedFacilityId} onChange={(e) => { setSelectedFacilityId(e.target.value); setSelectedHealthWorkerName(''); setSelectedWorkerOriginalData(null); setWorkerJobTitle(''); setWorkerTrainingDate(''); setWorkerPhone(''); setIsWorkerInfoChanged(false); setIsReadyToStart(false); }} disabled={!selectedLocality || !!editingSubmission}>
                                            <option value="">-- اختر المؤسسة --</option>
                                            {filteredFacilities.map(f => ( <option key={f.id} value={f.id}>{f['اسم_المؤسسة']}</option> ))}
                                        </Select>
                                        {selectedState && selectedLocality && filteredFacilities.length === 0 && !isFacilitiesLoading && ( <p className="text-xs text-red-600 mt-1">لا توجد مؤسسات مسجلة لهذه المحلية.</p> )}
                                    </FormGroup>
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
                        )}
                        
                        {/* START/CONTINUE BUTTON (MODIFIED) */}
                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                            <Button 
                                onClick={handleBackToHistoryView}
                                variant="secondary"
                                disabled={isFacilitiesLoading}
                            >
                                إلغاء والعودة
                            </Button>
                             <Button
                                onClick={handleProceedToForm} // <-- MODIFIED: Calls new handler
                                disabled={!selectedFacilityId || (isSkillsAssessmentSetup && !selectedHealthWorkerName) || isFacilitiesLoading}
                                variant="primary"
                            >
                                {isSkillsAssessmentSetup ? 'بدء جلسة الاشراف' : 'بدء استبيان الأم'}
                            </Button>
                        </div>
                        {/* END START/CONTINUE BUTTON */}
                    </div>
                </Card>

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
            </>
        );
    }

    return null; // Should not happen
};

export default SkillsMentorshipView;