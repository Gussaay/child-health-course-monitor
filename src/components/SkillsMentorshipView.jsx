// SkillsMentorshipView.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDataCache } from '../DataContext';
import { Timestamp } from 'firebase/firestore';
// --- MODIFICATION: Import new function ---
import { saveMentorshipSession, listMentorshipSessions, importMentorshipSessions, addHealthWorkerToFacility } from '../data';
// --- END MODIFICATION ---
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox, Modal
} from './CommonComponents';
import { STATE_LOCALITIES } from "./constants.js";
import SkillsAssessmentForm from './SkillsAssessmentForm'; // Keep for individual form view
import * as XLSX from 'xlsx';
import { getAuth } from "firebase/auth";

// --- Form Structure (Copied for reference in Bulk Upload - Keep in sync with SkillsAssessmentForm.jsx) ---
// --- Classification Constants (Copied for reference) ---
const COUGH_CLASSIFICATIONS = ["التهاب رئوي حاد وخيم", "التهاب رئوي", "كحة أو زكام"];
const DIARRHEA_CLASSIFICATIONS = ["جفاف حاد", "بعض الجفاف", "لا يوجد جفاف", "إسهال مستمر شديد", "إسهال مستمر", "دسنتاريا"];
const FEVER_CLASSIFICATIONS = ["مرض حمي شديد", "ملاريا", "حمى لا توجد ملاريا", "حصبة مصحوبة بمضاعفات شديدة", "حصبة مصحوبة بمضاعفات في العين والفم", "حصبة"];
const EAR_CLASSIFICATIONS = ["التهاب العظمة خلف الاذن", "التهاب أذن حاد", "التهاب أذن مزمن", "لا يوجد التهاب أذن"];
const MALNUTRITION_CLASSIFICATIONS = ["سوء تغذية حاد شديد مع مضاعفات", "سوء تغذية حاد شديد من غير مضاعفات", "سوء تغذية حاد متوسط", "لا يوجد سوء تغذية"];
const ANEMIA_CLASSIFICATIONS = ["فقر دم شديد", "فقر دم", "لا يوجد فقر دم"];
const createInitialClassificationState = (classifications) => classifications.reduce((acc, c) => { acc[c] = false; return acc; }, {});

// --- Helper function to evaluate the relevance logic (Copied from SkillsAssessmentForm) ---
const evaluateRelevance = (relevanceString, formData) => {
    if (!relevanceString) return true;
    // Simple evaluator: checks for ${key}='value'
    const logicRegex = /\$\{(.*?)\}='(.*?)'/;
    const match = relevanceString.match(logicRegex);
    if (!match) {
        console.warn("Could not parse relevance string:", relevanceString);
        return true; // Default to relevant if parsing fails
    }
    const [, varName, expectedValue] = match;

    // Look for the variable in different potential locations within formData
    let actualValue = formData[varName]; // Top level first
    if (actualValue === undefined && formData.assessment_skills) {
        actualValue = formData.assessment_skills[varName]; // Check assessment_skills
    }
     if (actualValue === undefined && formData.treatment_skills) {
        actualValue = formData.treatment_skills[varName]; // Check treatment_skills
    }
     // Add specific checks if needed, e.g., for decisionMatches
     if (actualValue === undefined && varName === 'decisionMatches') {
         actualValue = formData.decisionMatches;
     }

    // Handle boolean-like strings
    if (expectedValue.toLowerCase() === 'yes') return actualValue === 'yes';
    if (expectedValue.toLowerCase() === 'no') return actualValue === 'no';
    if (expectedValue.toLowerCase() === 'na') return actualValue === 'na';

    return actualValue === expectedValue;
};


// --- Function to calculate scores (Copied & adapted from SkillsAssessmentForm) ---
const calculateScores = (formData) => {
    // Requires IMNCI_FORM_STRUCTURE to be defined globally or passed in
    // For simplicity in this context, assume IMNCI_FORM_STRUCTURE is accessible
    // Note: If IMNCI_FORM_STRUCTURE is not available here, it needs to be imported or passed.
     // --- Re-define FORM_STRUCTURE here for use in calculateScores ---
    const IMNCI_FORM_STRUCTURE = [
        // PASTE THE FULL IMNCI_FORM_STRUCTURE ARRAY HERE from SkillsAssessmentForm.jsx
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
                    maxScore: 2, // Example fixed max score if relevance isn't perfectly calculated offline
                    skills: [
                        { key: 'skill_ref_abx', label: 'في حالة التحويل : هل أعطى الجرعة الاولى من المضاد الحيوي المناسب قبل تحويل الطفل' },
                        { key: 'skill_ref_quinine', label: 'في حالة التحويل : أعطى الكينيين بالعضل قبل التحويل', relevant: "${as_supervisor_correct_fever_classification}='مرض حمي شديد'" }, // Simplified relevance for example
                    ],
                    relevant: "${finalDecision}='referral'" // Example relevance
                },
                 {
                    subgroupTitle: 'في حالة الإلتهاب الرئوي',
                    scoreKey: 'pneu_treatment',
                     maxScore: 2,
                    skills: [ { key: 'skill_pneu_abx', label: 'هل وصف مضاد حيوي لعلاج الالتهاب الرئوي بصورة صحيحة' }, { key: 'skill_pneu_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج الالتهاب الرئوي بالعيادة بصورة صحيحة', relevant: "${ts_skill_pneu_abx}='yes'" }, ],
                    relevant: "${as_supervisor_correct_cough_classification}='التهاب رئوي'"
                },
                 {
                    subgroupTitle: 'في حالة الإسهال',
                    scoreKey: 'diar_treatment',
                    maxScore: 4,
                    skills: [ { key: 'skill_diar_ors', label: 'هل حدد كمية محلول الإرواء بصورة صحيحة' }, { key: 'skill_diar_counsel', label: 'هل نصح الأم بالRعاية المنزلية بإعطاء سوائل أكثر و الاستمرار في تغذية الطفل)' }, { key: 'skill_diar_zinc', label: 'هل وصف دواء الزنك بصورة صحيحة' }, { key: 'skill_diar_zinc_dose', label: 'هل أعطى الجرعة الأولى من دواء الزنك للطفل بالوحدة الصحية بطريقة صحيحة', relevant: "${ts_skill_diar_zinc}='yes'" }, ],
                    relevant: (formData) => { // Keep complex relevance as function if needed
                        const cls = formData.assessment_skills?.supervisor_correct_diarrhea_classification || {};
                        const relevantKeys = ['جفاف حاد', 'بعض الجفاف', 'إسهال مستمر شديد', 'إسهال مستمر', 'دسنتاريا', 'لا يوجد جفاف'];
                        return relevantKeys.some(key => cls[key]);
                    }
                },
                 {
                    subgroupTitle: 'في حالة الدسنتاريا',
                    scoreKey: 'dyst_treatment',
                     maxScore: 2,
                    skills: [ { key: 'skill_dyst_abx', label: 'هل وصف مضاد حيوي لعلاج الدسنتاريا بصورة صحيحة' }, { key: 'skill_dyst_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج الدسنتاريا في العيادة بصورة صحيحة', relevant: "${ts_skill_dyst_abx}='yes'" }, ],
                    relevant: (formData) => (formData.assessment_skills?.supervisor_correct_diarrhea_classification || {})['دسنتاريا']
                },
                 {
                    subgroupTitle: 'في حالة الملاريا',
                    scoreKey: 'mal_treatment',
                     maxScore: 2,
                    skills: [ { key: 'skill_mal_meds', label: 'هل وصف دواء لعلاج الملاريا بصورة صحيحة' }, { key: 'skill_mal_dose', label: 'هل أعطى الجرعة الأولى من الدواء لعلاج الملاريا في العيادة بصورة صحيحة', relevant: "${ts_skill_mal_meds}='yes'" }, ],
                    relevant: (formData) => (formData.assessment_skills?.supervisor_correct_fever_classification || {})['ملاريا']
                },
                {
                    subgroupTitle: 'في حالة التهاب الأذن',
                    scoreKey: 'ear_treatment',
                    maxScore: 4,
                    skills: [ { key: 'skill_ear_abx', label: 'هل وصف مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة' }, { key: 'skill_ear_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة', relevant: "${ts_skill_ear_abx}='yes'" }, { key: 'skill_ear_para', label: 'هل وصف دواء الباراسيتامول بصورة صحيحة' }, { key: 'skill_ear_para_dose', label: 'هل أعطى الجرعة الأولى من الباراسيتامول بصورة صحيحة', relevant: "${ts_skill_ear_para}='yes'" }, ],
                    relevant: (formData) => ['التهاب العظمة خلف الاذن', 'التهاب اذن حاد', 'التهاب اذن مزمن'].includes(formData.assessment_skills?.supervisor_correct_ear_classification)
                },
                {
                    subgroupTitle: 'في حالة سوء التغذية',
                    scoreKey: 'nut_treatment',
                    maxScore: 2,
                    skills: [ { key: 'skill_nut_assess', label: 'قيم تغذية الطفل بما في ذلك مشاكل الرضاعة (لأقل من عمر سنتين)' }, { key: 'skill_nut_counsel', label: 'أرشد الأم عن تغذية الطفل بما في ذلك مشاكل الرضاعة الأقل من عمر سنتين)' }, ],
                    relevant: (formData) => ['سوء تغذية حاد شديد مع مضاعفات', 'سوء تغذية حاد شديد من غير مضاعفات', 'سوء تغذية حاد متوسط'].includes(formData.assessment_skills?.supervisor_correct_malnutrition_classification)
                },
                {
                    subgroupTitle: 'في حالة فقر الدم',
                    scoreKey: 'anemia_treatment',
                     maxScore: 2,
                    skills: [ { key: 'skill_anemia_iron', label: 'هل وصف شراب حديد بصورة صحيحة' }, { key: 'skill_anemia_iron_dose', label: 'هل أعطى الجرعة الأولى من شراب حديد بصورة صحيحة', relevant: "${ts_skill_anemia_iron}='yes'" }, ],
                     relevant: "${as_supervisor_correct_anemia_classification}='فقر دم'"
                },
                 { subgroupTitle: 'نصح الأم متى تعود للمتابعة',
                    scoreKey: 'fu_treatment',
                     maxScore: 2,
                    skills: [ { key: 'skill_fu_when', label: 'هل ذكر لها علامتين علي الأقل إذا ظهرت على الطفل يجب أن تعود به فورا للوحدة الصحية' }, { key: 'skill_fu_return', label: 'هل حدد للام متى تعود بالطفل' }, ] }
            ]
        }
    ];
     // --- END FORM STRUCTURE ---


    const scores = {};
    let totalMaxScore = 0;
    let totalCurrentScore = 0;

    IMNCI_FORM_STRUCTURE.forEach(group => {
        let groupCurrentScore = 0;
        let groupMaxScore = 0; // Initialize max score to 0

        if (group.isDecisionSection) {
            groupMaxScore = 1; // Decision is always max 1
            groupCurrentScore = formData.decisionMatches === 'yes' ? 1 : 0;
            totalMaxScore += groupMaxScore; // Add to total max
            totalCurrentScore += groupCurrentScore; // Add to total current
            if (group.scoreKey) { // Store decision score
                scores[group.scoreKey] = { score: groupCurrentScore, maxScore: groupMaxScore };
            }
        } else if (group.sectionKey) {
            const sectionData = formData[group.sectionKey] || {};
            let groupRelevantMaxScore = 0; // Track max score for relevant items in this group

            group.subgroups?.forEach(subgroup => {
                let subgroupCurrentScore = 0;
                let subgroupMaxScore = 0; // Initialize subgroup max score
                let subgroupRelevantMaxScore = 0; // Max score for relevant items in subgroup
                let isSubgroupRelevantForScoring = true;

                // Check subgroup relevance first
                if (subgroup.relevant) {
                    if (typeof subgroup.relevant === 'function') {
                        isSubgroupRelevantForScoring = subgroup.relevant(formData);
                    } else if (typeof subgroup.relevant === 'string') {
                        // Simple relevance evaluation (less robust)
                        const simplifiedRelevanceString = subgroup.relevant.replace(/\$\{(.*?)\}/g, (match, key) => {
                            let val = formData[key] ?? sectionData[key] ?? formData.assessment_skills?.[key] ?? formData.treatment_skills?.[key];
                             if (key.startsWith('as_') && val === undefined) val = formData.assessment_skills?.[key.replace('as_', '')];
                             if (key.startsWith('ts_') && val === undefined) val = formData.treatment_skills?.[key.replace('ts_', '')];
                            return `'${val || ''}'`; // Wrap in quotes
                        });
                        try {
                           isSubgroupRelevantForScoring = eval(simplifiedRelevanceString.replace(/='(.*?)'/g, '===\'$1\''));
                        } catch (e) {
                            console.warn("Error evaluating subgroup relevance:", simplifiedRelevanceString, e);
                            isSubgroupRelevantForScoring = false;
                        }
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
                                 const simplifiedRelevanceString = skill.relevant.replace(/\$\{(.*?)\}/g, (match, key) => {
                                      // More robust value finding
                                      let val = formData[key] ?? sectionData[key] ?? formData.assessment_skills?.[key] ?? formData.treatment_skills?.[key];
                                      if (key.startsWith('as_') && val === undefined) val = formData.assessment_skills?.[key.replace('as_', '')];
                                      if (key.startsWith('ts_') && val === undefined) val = formData.treatment_skills?.[key.replace('ts_', '')];
                                      return `'${val || ''}'`;
                                 });
                                 try {
                                      isSkillRelevantForScoring = eval(simplifiedRelevanceString.replace(/='(.*?)'/g, '===\'$1\''));
                                 } catch (e) {
                                      console.warn("Error evaluating skill relevance:", simplifiedRelevanceString, e);
                                      isSkillRelevantForScoring = false;
                                 }
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
                        } else {
                             // If skill is not relevant, ensure its value is 'na' (should be done by form effect)
                             // sectionData[skill.key] = 'na';
                        }
                    });
                }

                // Add subgroup scores to group totals
                groupCurrentScore += subgroupCurrentScore;
                groupRelevantMaxScore += subgroupRelevantMaxScore; // Sum relevant max scores

                // Store individual subgroup score if key exists
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
                 scores['treatment_score'] = { score: groupCurrentScore, maxScore: groupRelevantMaxScore }; // Use relevant max
             }
        }
    });

    // Final overall score using accumulated totals
    scores.overallScore = { score: totalCurrentScore, maxScore: totalMaxScore };

    // Format scores payload for saving (using calculated max scores)
     const scoresPayload = {};
     for (const key in scores) {
         // Exclude the specific 'treatment_score' key here, handle it separately
         if (key !== 'treatment_score' && scores[key]?.score !== undefined && scores[key]?.maxScore !== undefined) {
             scoresPayload[`${key}_score`] = scores[key].score;
             scoresPayload[`${key}_maxScore`] = scores[key].maxScore;
         }
     }
     // Ensure treatment specific score/max are included correctly using the calculated values
     if(scores['treatment_score']){
        scoresPayload['treatment_score'] = scores['treatment_score'].score;
        scoresPayload['treatment_maxScore'] = scores['treatment_score'].maxScore; // Use calculated max
     } else {
        // If treatment group wasn't relevant at all
        scoresPayload['treatment_score'] = 0;
        scoresPayload['treatment_maxScore'] = 0;
     }

    // Return the payload format
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
    activeService
}) => {
    // ... (Implementation unchanged) ...
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [failedRows, setFailedRows] = useState([]);
    const fileInputRef = useRef(null);
    const auth = getAuth();

    // --- Define ALL fields for mapping ---
    const BASE_FIELDS = [
        { key: 'session_date', label: 'Session Date (YYYY-MM-DD)', required: true },
        { key: 'state', label: 'State (Arabic Name)', required: true },
        { key: 'locality', label: 'Locality (Arabic Name)', required: true },
        { key: 'facility_name', label: 'Facility Name', required: true },
        { key: 'health_worker_name', label: 'Health Worker Name', required: true },
        { key: 'notes', label: 'Notes' },
        { key: 'mentor_email', label: 'Mentor Email (Optional)' },
    ];

    const ASSESSMENT_SKILL_FIELDS = [
        // Vital Signs
        { key: 'as_skill_weight', label: 'AS: Weight Correctly' },
        { key: 'as_skill_temp', label: 'AS: Temperature Correctly' },
        { key: 'as_skill_height', label: 'AS: Height Correctly' },
        // Danger Signs
        { key: 'as_skill_ds_drink', label: 'AS: Asked/Checked DS Drink' },
        { key: 'as_skill_ds_vomit', label: 'AS: Asked/Checked DS Vomit' },
        { key: 'as_skill_ds_convulsion', label: 'AS: Asked/Checked DS Convulsion' },
        { key: 'as_skill_ds_conscious', label: 'AS: Checked DS Conscious' },
         // Cough
        { key: 'as_skill_ask_cough', label: 'AS: Asked Cough' },
        { key: 'as_supervisor_confirms_cough', label: 'AS: Supervisor Confirms Cough' },
        { key: 'as_skill_check_rr', label: 'AS: Checked RR Correctly', relevant: "${as_supervisor_confirms_cough}='yes'" },
        { key: 'as_skill_classify_cough', label: 'AS: Classified Cough Correctly', relevant: "${as_supervisor_confirms_cough}='yes'" },
        { key: 'as_worker_cough_classification', label: 'AS: Worker Cough Classification', relevant: "${as_supervisor_confirms_cough}='yes'" },
        { key: 'as_supervisor_correct_cough_classification', label: 'AS: Correct Cough Classification', relevant: "${as_skill_classify_cough}='no'" },
         // Diarrhea
        { key: 'as_skill_ask_diarrhea', label: 'AS: Asked Diarrhea' },
        { key: 'as_supervisor_confirms_diarrhea', label: 'AS: Supervisor Confirms Diarrhea' },
        { key: 'as_skill_check_dehydration', label: 'AS: Checked Dehydration Correctly', relevant: "${as_supervisor_confirms_diarrhea}='yes'" },
        { key: 'as_skill_classify_diarrhea', label: 'AS: Classified Diarrhea Correctly', relevant: "${as_supervisor_confirms_diarrhea}='yes'" },
        { key: 'as_worker_diarrhea_classification', label: 'AS: Worker Diarrhea Class (comma-sep)', relevant: "${as_supervisor_confirms_diarrhea}='yes'" },
        { key: 'as_supervisor_correct_diarrhea_classification', label: 'AS: Correct Diarrhea Class (comma-sep)', relevant: "${as_skill_classify_diarrhea}='no'" },
        // Fever
        { key: 'as_skill_ask_fever', label: 'AS: Asked Fever' },
        { key: 'as_supervisor_confirms_fever', label: 'AS: Supervisor Confirms Fever' },
        { key: 'as_skill_check_rdt', label: 'AS: Checked RDT Correctly', relevant: "${as_supervisor_confirms_fever}='yes'" },
        { key: 'as_skill_classify_fever', label: 'AS: Classified Fever Correctly', relevant: "${as_supervisor_confirms_fever}='yes'" },
        { key: 'as_worker_fever_classification', label: 'AS: Worker Fever Class (comma-sep)', relevant: "${as_supervisor_confirms_fever}='yes'" },
        { key: 'as_supervisor_correct_fever_classification', label: 'AS: Correct Fever Class (comma-sep)', relevant: "${as_skill_classify_fever}='no'" },
        // Ear
        { key: 'as_skill_ask_ear', label: 'AS: Asked Ear Problem' },
        { key: 'as_supervisor_confirms_ear', label: 'AS: Supervisor Confirms Ear Problem' },
        { key: 'as_skill_check_ear', label: 'AS: Checked Ear Correctly', relevant: "${as_supervisor_confirms_ear}='yes'" },
        { key: 'as_skill_classify_ear', label: 'AS: Classified Ear Correctly', relevant: "${as_supervisor_confirms_ear}='yes'" },
        { key: 'as_worker_ear_classification', label: 'AS: Worker Ear Classification', relevant: "${as_supervisor_confirms_ear}='yes'" },
        { key: 'as_supervisor_correct_ear_classification', label: 'AS: Correct Ear Classification', relevant: "${as_skill_classify_ear}='no'" },
         // Malnutrition
        { key: 'as_skill_mal_muac', label: 'AS: Measured MUAC Correctly' },
        { key: 'as_skill_mal_wfh', label: 'AS: Checked WFH Correctly' },
        { key: 'as_skill_mal_classify', label: 'AS: Classified Malnutrition Correctly' },
        { key: 'as_worker_malnutrition_classification', label: 'AS: Worker Malnutrition Classification' },
        { key: 'as_supervisor_correct_malnutrition_classification', label: 'AS: Correct Malnutrition Classification', relevant: "${as_skill_mal_classify}='no'" },
        // Anemia
        { key: 'as_skill_anemia_pallor', label: 'AS: Checked Pallor Correctly' },
        { key: 'as_skill_anemia_classify', label: 'AS: Classified Anemia Correctly' },
        { key: 'as_worker_anemia_classification', label: 'AS: Worker Anemia Classification' },
        { key: 'as_supervisor_correct_anemia_classification', label: 'AS: Correct Anemia Classification', relevant: "${as_skill_anemia_classify}='no'" },
        // Immunization
        { key: 'as_skill_imm_vacc', label: 'AS: Checked Immunization Correctly' },
        { key: 'as_skill_imm_vita', label: 'AS: Checked Vitamin A Correctly' },
        // Other
        { key: 'as_skill_other', label: 'AS: Checked Other Problems' },
    ];

    const DECISION_FIELDS = [
        { key: 'finalDecision', label: 'Final Decision (Worker)', required: true }, // Add required if needed by form logic
        { key: 'decisionMatches', label: 'Decision Matches Supervisor', required: true }, // Add required if needed
    ];

    const TREATMENT_SKILL_FIELDS = [
         // Referral
        { key: 'ts_skill_ref_abx', label: 'TS: Gave Pre-Referral ABX', relevant: "${finalDecision}='referral'" },
        { key: 'ts_skill_ref_quinine', label: 'TS: Gave Pre-Referral Quinine', relevant: "${finalDecision}='referral' and ${as_supervisor_correct_fever_classification}='مرض حمي شديد'" }, // Simplified
        // Pneumonia
        { key: 'ts_skill_pneu_abx', label: 'TS: Prescribed Pneumonia ABX Correctly', relevant: "${as_supervisor_correct_cough_classification}='التهاب رئوي'" },
        { key: 'ts_skill_pneu_dose', label: 'TS: Gave Pneumonia ABX Dose Correctly', relevant: "${ts_skill_pneu_abx}='yes'" },
        // Diarrhea
        { key: 'ts_skill_diar_ors', label: 'TS: Determined ORS Amount Correctly' /* Add relevance if needed */ },
        { key: 'ts_skill_diar_counsel', label: 'TS: Counselled Diarrhea Home Care' /* Add relevance */ },
        { key: 'ts_skill_diar_zinc', label: 'TS: Prescribed Zinc Correctly' /* Add relevance */ },
        { key: 'ts_skill_diar_zinc_dose', label: 'TS: Gave Zinc Dose Correctly', relevant: "${ts_skill_diar_zinc}='yes'" },
        // Dysentery
        { key: 'ts_skill_dyst_abx', label: 'TS: Prescribed Dysentery ABX Correctly' /* Add relevance */ },
        { key: 'ts_skill_dyst_dose', label: 'TS: Gave Dysentery ABX Dose Correctly', relevant: "${ts_skill_dyst_abx}='yes'" },
        // Malaria
        { key: 'ts_skill_mal_meds', label: 'TS: Prescribed Malaria Meds Correctly' /* Add relevance */ },
        { key: 'ts_skill_mal_dose', label: 'TS: Gave Malaria Meds Dose Correctly', relevant: "${ts_skill_mal_meds}='yes'" },
        // Ear
        { key: 'ts_skill_ear_abx', label: 'TS: Prescribed Ear ABX Correctly' /* Add relevance */ },
        { key: 'ts_skill_ear_dose', label: 'TS: Gave Ear ABX Dose Correctly', relevant: "${ts_skill_ear_abx}='yes'" },
        { key: 'ts_skill_ear_para', label: 'TS: Prescribed Paracetamol Correctly' /* Add relevance */ },
        { key: 'ts_skill_ear_para_dose', label: 'TS: Gave Paracetamol Dose Correctly', relevant: "${ts_skill_ear_para}='yes'" },
        // Nutrition
        { key: 'ts_skill_nut_assess', label: 'TS: Assessed Feeding Correctly' /* Add relevance */ },
        { key: 'ts_skill_nut_counsel', label: 'TS: Counselled Feeding Correctly' /* Add relevance */ },
        // Anemia
        { key: 'ts_skill_anemia_iron', label: 'TS: Prescribed Iron Correctly', relevant: "${as_supervisor_correct_anemia_classification}='فقر دم'" },
        { key: 'ts_skill_anemia_iron_dose', label: 'TS: Gave Iron Dose Correctly', relevant: "${ts_skill_anemia_iron}='yes'" },
         // Follow-up
        { key: 'ts_skill_fu_when', label: 'TS: Counselled When to Return Immediately' },
        { key: 'ts_skill_fu_return', label: 'TS: Counselled Follow-Up Visit' },
    ];

    const ALL_MENTORSHIP_FIELDS = useMemo(() => [
        ...BASE_FIELDS,
        ...ASSESSMENT_SKILL_FIELDS,
        ...DECISION_FIELDS,
        ...TREATMENT_SKILL_FIELDS
    ], []); // Dependencies can be empty as definitions are static

    const ALL_TEMPLATE_HEADERS = useMemo(() => ALL_MENTORSHIP_FIELDS.map(f => f.key), [ALL_MENTORSHIP_FIELDS]);


    // --- State & Handlers ---
    // (stateArToKey, localityArToKey, facilityLookup remain the same)
    const stateArToKey = useMemo(() => {
        return Object.entries(STATE_LOCALITIES).reduce((acc, [key, value]) => {
            acc[value.ar.trim().toLowerCase()] = key;
            return acc;
        }, {});
    }, []);

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
            const name = String(facility['اسم_المؤسسة'] ?? '').trim().toLowerCase(); // Ensure string conversion
            if (state && locality && name) {
                const key = `${state}-${locality}-${name}`;
                acc.set(key, facility.id);
            }
            return acc;
        }, new Map());
    }, [healthFacilities]);


    useEffect(() => {
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
        const fileName = `Mentorship_Upload_Template_Detailed_${activeService}.xlsx`;
        const worksheetData = [ALL_TEMPLATE_HEADERS]; // Use the detailed headers
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Mentorships");
        XLSX.writeFile(workbook, fileName);
    };

    const handleMappingChange = useCallback((appField, excelHeader) => {
        setFieldMappings(prev => {
            const newMappings = { ...prev };
            if (excelHeader) newMappings[appField] = excelHeader;
            else delete newMappings[appField];
            return newMappings;
        });
    }, []);

    const handleValidation = () => {
        const missingMappings = BASE_FIELDS // Only check required base fields for mapping presence
            .filter(field => field.required && !fieldMappings[field.key])
            .map(field => field.label);

        if (missingMappings.length > 0) {
            setError(`The following base fields must be mapped: ${missingMappings.join(', ')}.`);
            return;
        }
        setError('');
        startImportProcess(excelData, excelData);
    };

    // --- Reworked processAndStartImport ---
    const processAndStartImport = (dataForProcessing, originalRawData) => {
        const user = auth.currentUser;
        if (!user) {
            setError('You must be logged in to import data.');
            return;
        }

        const processedSessions = [];

        dataForProcessing.forEach((row, rowIndex) => {
            const sessionFromRow = {};
            // Map all defined fields from Excel row using the mapping config
            ALL_MENTORSHIP_FIELDS.forEach(field => {
                 const excelHeader = fieldMappings[field.key];
                 if (excelHeader) {
                     const headerIndex = headers.indexOf(excelHeader);
                     if (headerIndex !== -1) {
                         let cellValue = row[headerIndex];
                         // Basic cleanup: trim strings, keep dates/numbers as is for now
                         if (typeof cellValue === 'string') cellValue = cellValue.trim();
                         if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                            sessionFromRow[field.key] = cellValue;
                         }
                     }
                 }
            });


            // --- Basic Validation ---
            if (!sessionFromRow.session_date || !sessionFromRow.state || !sessionFromRow.locality || !sessionFromRow.facility_name || !sessionFromRow.health_worker_name) {
                 console.warn(`Skipping row ${rowIndex + 2}: Missing required base info.`);
                return; // Skip row if required base fields are missing
            }

            // --- Reconstruct formData structure ---
            const formDataForRow = {
                 session_date: '', // Will be set below
                 notes: sessionFromRow.notes || '',
                 assessment_skills: {},
                 treatment_skills: {},
                 finalDecision: sessionFromRow.finalDecision || '',
                 decisionMatches: sessionFromRow.decisionMatches || '',
            };

            // Populate assessment_skills
            ASSESSMENT_SKILL_FIELDS.forEach(field => {
                 const keyWithoutPrefix = field.key.replace('as_', '');
                 const value = sessionFromRow[field.key]; // Raw value from Excel
                 if (value !== undefined) {
                     // Handle multi-select classifications (expecting comma-separated string)
                     if (field.key === 'as_worker_diarrhea_classification' || field.key === 'as_supervisor_correct_diarrhea_classification') {
                        const selected = (value || '').split(',').map(s => s.trim()).filter(Boolean);
                        formDataForRow.assessment_skills[keyWithoutPrefix] = DIARRHEA_CLASSIFICATIONS.reduce((acc, c) => {
                           acc[c] = selected.includes(c);
                           return acc;
                        }, {});
                     } else if (field.key === 'as_worker_fever_classification' || field.key === 'as_supervisor_correct_fever_classification') {
                        const selected = (value || '').split(',').map(s => s.trim()).filter(Boolean);
                        formDataForRow.assessment_skills[keyWithoutPrefix] = FEVER_CLASSIFICATIONS.reduce((acc, c) => {
                           acc[c] = selected.includes(c);
                           return acc;
                        }, {});
                     } else {
                        // Simple assignment for yes/no/na or classification string
                        formDataForRow.assessment_skills[keyWithoutPrefix] = value;
                     }
                 } else {
                     // Set default for missing optional fields if needed, e.g., 'na' or ''
                     // Multi-select defaults to all false
                      if (field.key === 'as_worker_diarrhea_classification' || field.key === 'as_supervisor_correct_diarrhea_classification') {
                         formDataForRow.assessment_skills[keyWithoutPrefix] = createInitialClassificationState(DIARRHEA_CLASSIFICATIONS);
                      } else if (field.key === 'as_worker_fever_classification' || field.key === 'as_supervisor_correct_fever_classification') {
                         formDataForRow.assessment_skills[keyWithoutPrefix] = createInitialClassificationState(FEVER_CLASSIFICATIONS);
                      } else {
                         // Default other missing skills to empty string or 'na' based on logic
                         formDataForRow.assessment_skills[keyWithoutPrefix] = ''; // Or 'na' if applicable
                      }
                 }
            });

             // Populate treatment_skills
            TREATMENT_SKILL_FIELDS.forEach(field => {
                 const keyWithoutPrefix = field.key.replace('ts_', '');
                 const value = sessionFromRow[field.key];
                 if (value !== undefined) {
                     formDataForRow.treatment_skills[keyWithoutPrefix] = value;
                 } else {
                     formDataForRow.treatment_skills[keyWithoutPrefix] = ''; // Default missing treatment skills
                 }
            });


            // --- Build Final Payload ---
            const payload = {
                serviceType: activeService,
                status: 'complete', // Assume uploaded data is complete
                healthWorkerName: sessionFromRow.health_worker_name,
                notes: formDataForRow.notes,
                mentorEmail: sessionFromRow.mentor_email || user.email,
                mentorName: user.displayName || 'Batch Upload',
                assessmentSkills: formDataForRow.assessment_skills, // Nested object
                treatmentSkills: formDataForRow.treatment_skills, // Nested object
                finalDecision: formDataForRow.finalDecision,
                decisionMatches: formDataForRow.decisionMatches,
            };

            // Date processing
            try {
                let effectiveDate;
                if (sessionFromRow.session_date instanceof Date) {
                    effectiveDate = Timestamp.fromDate(sessionFromRow.session_date);
                    payload.sessionDate = sessionFromRow.session_date.toISOString().split('T')[0];
                } else {
                    // Attempt to parse string date (e.g., YYYY-MM-DD)
                    const parsedDate = new Date(sessionFromRow.session_date);
                    if (isNaN(parsedDate.getTime())) throw new Error('Invalid date format');
                    effectiveDate = Timestamp.fromDate(parsedDate);
                    payload.sessionDate = parsedDate.toISOString().split('T')[0];
                }
                payload.effectiveDate = effectiveDate;
            } catch (e) {
                console.warn(`Skipping row ${rowIndex + 2}: Invalid date - ${sessionFromRow.session_date}`);
                // Add to errors? For now, just skip. The import function will catch it.
                 payload.effectiveDate = null; // Mark as invalid for import function
            }

            // Location processing
            const stateKey = stateArToKey[String(sessionFromRow.state).trim().toLowerCase()];
            const localityKey = localityArToKey(stateKey, String(sessionFromRow.locality));
            payload.state = stateKey; // Store the key
            payload.locality = localityKey; // Store the key
            payload.facilityName = sessionFromRow.facility_name; // Keep original name

            const facilityNameLower = String(sessionFromRow.facility_name).trim().toLowerCase();
            const lookupKey = `${stateKey}-${localityKey}-${facilityNameLower}`;
            payload.facilityId = facilityLookup.get(lookupKey) || null; // Will be null if not found


            // Calculate Scores (using the reconstructed formData)
             try {
                 payload.scores = calculateScores(formDataForRow);
             } catch (scoreError) {
                 console.error(`Error calculating scores for row ${rowIndex + 2}:`, scoreError);
                 // Decide how to handle score errors: skip row, or save with empty scores?
                 payload.scores = {}; // Save empty scores object on error
             }


            processedSessions.push(payload);
        });

        if (processedSessions.length === 0) {
            setError('No valid sessions could be processed from the Excel file. Check required fields and formats.');
            setCurrentPage(1); // Go back to mapping if needed
            return;
        }

        onImport(processedSessions, originalRawData);
    };
    // --- End Reworked processAndStartImport ---


    const startImportProcess = (data, rawData) => processAndStartImport(data, rawData);

    const handleRetryUpload = () => {
        const dataToRetry = failedRows.map(failedRow => failedRow.rowData);
        setFailedRows([]);
        processAndStartImport(dataToRetry, dataToRetry);
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

    // --- MappingRow Component ---
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
        // ... (Implementation unchanged) ...
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
        // ... (Implementation unchanged) ...
         <div>
            <h4 className="font-medium text-lg mb-2">Import Complete</h4>
            <div className="bg-gray-50 p-4 rounded-md">
                <p className="font-semibold whitespace-pre-wrap">{uploadStatus.message}</p>
                {/* Display specific row errors if available */}
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
                 {/* Display general errors if no row data */}
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
                 {/* Provide button to go back to correction if there were row errors */}
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
        // ... (Implementation unchanged) ...
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
        // ... (Modal structure unchanged) ...
        <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Upload (Detailed) for ${activeService}`} size="full">
            <div className="p-4">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

                {currentPage === 0 && (
                    <div>
                        <p className="mb-4">Download the detailed template for {activeService}. Use Arabic names for State/Locality. Use 'yes', 'no', 'na' for skill checks. Use comma-separated values for multi-select classifications (e.g., "بعض الجفاف,دسنتاريا").</p>
                        <Button variant="secondary" onClick={handleDownloadTemplate} className="mb-4">Download Template</Button>
                        <hr className="my-4" />
                        <p className="mb-2">Or, upload your completed Excel file (first row must be headers).</p>
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} ref={fileInputRef} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                )}

                {currentPage === 1 && (
                    <div>
                        <h4 className="font-medium mb-4">Map Excel columns to application fields</h4>
                        <p className="text-sm text-gray-600 mb-4">Match columns to fields. Base fields marked * are required for basic processing. Ensure all relevant detail columns are mapped for full scoring.</p>
                        {/* Make the mapping section scrollable */}
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
// --- End of Detailed Bulk Upload Modal ---


// --- AddHealthWorkerModal Component (with job title dropdown) ---
const IMNCI_JOB_TITLES = [
    "مساعد طبي",
    "طبيب عمومي",
    "ممرض",
    "قابلة",
    "مسؤول تغذية",
    "فني مختبر",
    "صيدلي",
    "أخرى"
];

const AddHealthWorkerModal = ({ isOpen, onClose, onSave, facilityName }) => {
    // ... (State and handlers unchanged) ...
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
        setName(''); setJobTitle(''); setTrainingDate(''); setPhone(''); // Clear form
    };

    const handleClose = () => {
        setName(''); setJobTitle(''); setTrainingDate(''); setPhone(''); setError(''); // Clear form
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`إضافة عامل صحي جديد لـ: ${facilityName}`} size="lg">
            <div className="p-6 text-right" dir="rtl">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
                <div className="space-y-4">
                    <FormGroup label="الاسم كامل *">
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ادخل الاسم الكامل" required />
                    </FormGroup>
                    <FormGroup label="الوصف الوظيفي">
                        <Select value={job_title} onChange={(e) => setJobTitle(e.target.value)}>
                            <option value="">-- اختر الوصف الوظيفي --</option>
                            {IMNCI_JOB_TITLES.map(title => (
                                <option key={title} value={title}>{title}</option>
                            ))}
                        </Select>
                    </FormGroup>
                    <FormGroup label="اخر تاريخ تدريب على العلاج المتكامل">
                        <Input type="date" value={training_date} onChange={(e) => setTrainingDate(e.target.value)} />
                    </FormGroup>
                    <FormGroup label="رقم الهاتف">
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


// --- Table Column Component (Unchanged) ---
const MentorshipTableColumns = () => (
    // ... (Implementation unchanged) ...
    <>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الولاية</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المحلية</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المؤسسة</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العامل الصحي</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المشرف</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الجلسة</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
    </>
);

// --- Friendly Service Titles (Unchanged) ---
const SERVICE_TITLES = {
    'IMNCI': 'المعالجة المتكاملة',
    'EENC': 'رعاية حديثي الولادة',
    'ETAT': 'الفرز والعلاج في الطوارئ',
    'IPC': 'مكافحة العدوى'
};

// --- Submissions Table Component (Unchanged) ---
const MentorshipSubmissionsTable = ({
    submissions,
    onNewVisit,
    onBackToServiceSelection,
    activeService,
    setToast,
    availableStates,
    userStates,
    fetchSubmissions,
    isSubmissionsLoading,
    onShareLink,
    canShareLink,
    canBulkUpload,
    onBulkUpload
}) => {
    // ... (Implementation unchanged) ...
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [workerFilter, setWorkerFilter] = useState('');

    const handleAction = (action, submission) => {
        let message = '';
        if (action === 'view') {
            message = `عرض تفاصيل الجلسة رقم ${submission.id}`;
        } else if (action === 'edit') {
            message = `تعديل الجلسة رقم ${submission.id}`;
        } else if (action === 'delete') {
            message = `حذف الجلسة رقم ${submission.id}`;
        }
        setToast({ message: message, variant: 'info' });
    };


    const filteredSubmissions = useMemo(() => {
        let filtered = submissions;
        if (activeService) {
            filtered = filtered.filter(sub => sub.service === activeService);
        }
        if (stateFilter) {
             filtered = filtered.filter(sub => sub.state === stateFilter);
        }
        if (localityFilter) {
             filtered = filtered.filter(sub => sub.locality === localityFilter);
        }
        if (workerFilter) {
            filtered = filtered.filter(sub => (sub.staff || '').toLowerCase().includes(workerFilter.toLowerCase()));
        }
        return filtered;
    }, [submissions, activeService, stateFilter, localityFilter, workerFilter]);

    const availableLocalities = useMemo(() => {
        if (!stateFilter || !STATE_LOCALITIES[stateFilter]) return [];
        return [
            { key: "", label: "-- اختر المحلية --" },
            ...STATE_LOCALITIES[stateFilter].localities.sort((a, b) => a.ar.localeCompare(b.ar)).map(l => ({ key: l.en, label: l.ar }))
        ];
    }, [stateFilter]);


    const serviceTitle = SERVICE_TITLES[activeService] || activeService;

    return (
        <Card dir="rtl">
            <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-2 flex-wrap">
                        <Button onClick={onNewVisit}>+ إضافة زيارة {serviceTitle}</Button>
                        {canBulkUpload && (
                            <Button onClick={onBulkUpload}>Bulk Upload</Button>
                        )}
                        <Button variant="secondary" onClick={onBackToServiceSelection}> العودة لاختيار الخدمة </Button>
                        {canShareLink && (
                             <Button variant="info" onClick={onShareLink}>
                                 مشاركة رابط الإدخال
                             </Button>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                        <PageHeader
                            title={`سجل زيارات: ${serviceTitle}`}
                            subtitle="قائمة بجميع النماذج المقدمة لهذه الخدمة."
                        />
                    </div>
                </div>

                {/* Filters */}
                 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 border p-4 rounded-lg bg-gray-50">
                    <FormGroup label="الولاية" className="text-right">
                        <Select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setLocalityFilter(''); }}>
                            {availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="المحلية" className="text-right">
                        <Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}>
                             {availableLocalities.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="البحث بالموظف" className="text-right">
                        <Input value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)} placeholder="بحث باسم العامل الصحي..." />
                    </FormGroup>
                    <FormGroup label="تاريخ الجلسة" className="text-right">
                         <Input type="date" placeholder="التاريخ" /> {/* TODO: Implement date filtering */}
                    </FormGroup>
                </div>


                {/* Table */}
                <div className="mt-6 overflow-x-auto">
                     {isSubmissionsLoading ? (
                        <div className="flex justify-center p-8"><Spinner /></div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <MentorshipTableColumns />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSubmissions.length === 0 ? (
                                    <tr><td colSpan="8"><EmptyState title="لا توجد بيانات" message="لم يتم تسجيل أي زيارات متابعة مطابقة لفلاتر البحث لهذه الخدمة." /></td></tr>
                                ) : (
                                    filteredSubmissions.map((sub, index) => (
                                        <tr key={sub.id}>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{STATE_LOCALITIES[sub.state]?.ar || sub.state}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{STATE_LOCALITIES[sub.state]?.localities.find(l=>l.en === sub.locality)?.ar || sub.locality}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{sub.facility}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{sub.staff}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{sub.supervisor}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{sub.date}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="info" onClick={() => handleAction('view', sub)}>عرض</Button>
                                                    <Button size="sm" variant="warning" onClick={() => handleAction('edit', sub)}>تعديل</Button>
                                                    <Button size="sm" variant="danger" onClick={() => handleAction('delete', sub)}>حذف</Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="flex justify-center mt-4">
                    <Button variant="secondary" onClick={() => fetchSubmissions(true)}>تحديث البيانات</Button>
                </div>
            </div>
        </Card>
    );
};

// --- Service Selection Component (Unchanged) ---
const ServiceSelector = ({ onSelectService }) => {
    // ... (Implementation unchanged) ...
    const services = [ { key: 'IMNCI', title: 'متابعة مهارات المعالجة المتكاملة', enabled: true }, { key: 'EENC', title: 'متابعة مهارات الرعاية الأساسية لحديثي الولادة', enabled: false }, { key: 'ETAT', title: 'متابعة مهارة الفرز والعلاج في الطوارئ', enabled: false }, { key: 'IPC', title: 'متابعة مهارات مكافحة العدوى', enabled: false }, ];
    return (
        <Card className="p-6" dir="rtl">
            <div className="text-right flex justify-between items-start">
                <PageHeader title="اختر برنامج المتابعة" subtitle="اختر خدمة لبدء متابعة المهارات." />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map(service => (
                    <button key={service.key} disabled={!service.enabled} className={`border rounded-lg p-6 text-right transition-all duration-200 ${service.enabled ? 'hover:shadow-md hover:scale-105' : 'opacity-60 cursor-not-allowed bg-gray-50'}`} onClick={() => service.enabled && onSelectService(service.key)} >
                        <div className="flex items-center gap-4">
                            <CourseIcon course={service.key} />
                            <div>
                                <div className="font-semibold text-gray-800 text-right">{service.title}</div>
                                <div className="text-xs text-gray-500 mt-1 text-right">{service.enabled ? 'اضغط لبدء الجلسة' : 'قريباً'}</div>
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
    const [selectedHealthWorkerName, setSelectedHealthWorkerName] = useState(''); // Name selected from dropdown

    const { healthFacilities, fetchHealthFacilities, isFacilitiesLoading } = useDataCache();
    const [submissions, setSubmissions] = useState(null);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);
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

    // --- NEW STATE for Editable Worker Info ---
    const [selectedWorkerOriginalData, setSelectedWorkerOriginalData] = useState(null); // Store original data for comparison
    const [workerJobTitle, setWorkerJobTitle] = useState('');
    const [workerTrainingDate, setWorkerTrainingDate] = useState('');
    const [workerPhone, setWorkerPhone] = useState('');
    const [isWorkerInfoChanged, setIsWorkerInfoChanged] = useState(false);
    const [isUpdatingWorker, setIsUpdatingWorker] = useState(false);
    // --- END NEW STATE ---

    // --- Hooks and Handlers ---
    const fetchMentorshipSubmissions = useCallback(async (force = false) => {
        setIsSubmissionsLoading(true);
        try {
            const result = await listMentorshipSessions();
            // --- MODIFICATION: Add facilityId to processed list ---
            const processedSubmissions = result.map(sub => ({
                id: sub.id,
                service: sub.serviceType,
                date: sub.effectiveDate ? new Date(sub.effectiveDate.seconds * 1000).toISOString().split('T')[0] : 'N/A',
                state: sub.state || 'N/A',
                locality: sub.locality || 'N/A',
                facility: sub.facilityName || 'N/A',
                staff: sub.healthWorkerName || 'N/A',
                supervisor: sub.mentorEmail || 'N/A',
                facilityId: sub.facilityId || null // Track facilityId for visit counting
            }));
            // --- END MODIFICATION ---
            setSubmissions(processedSubmissions);
        } catch (error) {
            console.error("Failed to fetch mentorship submissions:", error);
            setToast({ message: 'فشل في تحميل سجلات المتابعة.', variant: 'error' });
            setSubmissions([]);
        } finally {
            setIsSubmissionsLoading(false);
        }
    }, [setToast]);

     useEffect(() => {
        fetchHealthFacilities();
        if (!publicSubmissionMode) {
            fetchMentorshipSubmissions();
        }
    }, [fetchHealthFacilities, fetchMentorshipSubmissions, publicSubmissionMode]);

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
        // --- Clear worker details ---
        setSelectedWorkerOriginalData(null);
        setWorkerJobTitle('');
        setWorkerTrainingDate('');
        setWorkerPhone('');
        setIsWorkerInfoChanged(false);
        // ---
    };


    // --- Hooks for Facility and Worker Data ---
    const filteredFacilities = useMemo(() => {
        if (!healthFacilities || !selectedState || !selectedLocality) return [];
        return healthFacilities.filter(f => f['الولاية'] === selectedState && f['المحلية'] === selectedLocality)
               .sort((a, b) => (a['اسم_المؤسسة'] || '').localeCompare(b['اسم_المؤسسة'] || ''));
    }, [healthFacilities, selectedState, selectedLocality]);

    const selectedFacility = useMemo(() => {
        return filteredFacilities.find(f => f.id === selectedFacilityId);
    }, [filteredFacilities, selectedFacilityId]);

    // --- MODIFIED: healthWorkers useMemo (simpler, only name) ---
    const healthWorkers = useMemo(() => {
        if (!selectedFacility || !selectedFacility.imnci_staff) return [];
        try {
            const staffList = typeof selectedFacility.imnci_staff === 'string'
                ? JSON.parse(selectedFacility.imnci_staff)
                : selectedFacility.imnci_staff;

            if (!Array.isArray(staffList)) return [];

            // Just return name and id (which is also name)
            return staffList
                .map(s => ({
                    id: s.name, // Use name as the value/ID
                    name: s.name || 'N/A',
                }))
                .filter(w => w.name !== 'N/A') // Filter out invalid entries if any
                .sort((a, b) => a.name.localeCompare(b.name));

        } catch (e) {
            console.error("Error processing imnci_staff for dropdown:", e);
            return [];
        }
    }, [selectedFacility]);
    // --- END MODIFICATION ---

    // --- NEW: Calculate Visit Number ---
    const visitNumber = useMemo(() => {
        // Ensure submissions is an array before filtering
        if (!Array.isArray(submissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return 1; // Default to 1 if data isn't ready
        }
        const existingVisitsCount = submissions.filter(sub =>
            sub.facilityId === selectedFacilityId &&
            sub.staff === selectedHealthWorkerName &&
            sub.service === activeService
        ).length;
    
        return existingVisitsCount + 1;
    }, [submissions, selectedFacilityId, selectedHealthWorkerName, activeService]);
    // --- END NEW ---

    // --- Effect to update editable fields when worker selection changes ---
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
                    setSelectedWorkerOriginalData(workerData); // Store original
                    setWorkerJobTitle(workerData.job_title || '');
                    setWorkerTrainingDate(workerData.training_date || '');
                    setWorkerPhone(workerData.phone || '');
                    setIsWorkerInfoChanged(false); // Reset changed status
                } else {
                    // Worker not found in list (maybe deleted?), clear fields
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
            // No worker selected or no facility staff list, clear fields
            setSelectedWorkerOriginalData(null);
            setWorkerJobTitle('');
            setWorkerTrainingDate('');
            setWorkerPhone('');
            setIsWorkerInfoChanged(false);
        }
    }, [selectedHealthWorkerName, selectedFacility]); // Re-run when selection changes

    // --- Effect to check if worker info has changed ---
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
        if (!publicSubmissionMode && userStates && userStates.length === 1) { setSelectedState(userStates[0]); } else { setSelectedState(''); }
        if (!publicSubmissionMode && permissions.manageScope === 'locality' && userLocalities && userLocalities.length === 1) { setSelectedLocality(userLocalities[0]); } else { setSelectedLocality(''); }
        setSelectedFacilityId(''); setSelectedHealthWorkerName('');
        // Clear worker details on full reset
        setSelectedWorkerOriginalData(null);
        setWorkerJobTitle('');
        setWorkerTrainingDate('');
        setWorkerPhone('');
        setIsWorkerInfoChanged(false);
    };

    const handleSelectService = (serviceKey) => {
        setActiveService(serviceKey);
        setCurrentView('history');
    };

    const handleStartNewVisit = () => {
        setCurrentView('form_setup');
    };

    const handleReturnToServiceSelection = () => {
        setActiveService(null);
        setCurrentView('service_selection');
        resetSelection();
    };

    // Called when SkillsAssessmentForm finishes (saves or cancels)
    const handleFormCompletion = async () => {
        const cameFromSetup = previousViewRef.current === 'form_setup'; // Check where we came from
        resetSelection(); // Clear selections (state, locality, facility, worker)
        if (publicSubmissionMode) {
            setToast({ show: true, message: 'Submission successful! Thank you.', type: 'success' });
             setCurrentView('form_setup'); // Stay on setup for public
        } else {
             if (cameFromSetup) { // Only refetch if we just submitted/saved a draft
                await fetchMentorshipSubmissions(true); // Refetch submissions
             }
            setCurrentView('history'); // Go back to the history list
        }
    };
    const previousViewRef = useRef(currentView); // Track previous view
    useEffect(() => {
        previousViewRef.current = currentView;
    }, [currentView]);


    const handleBackToHistoryView = () => {
        setCurrentView('history');
         resetSelection();
    };

    const handleShareSubmissionLink = () => {
        // ... (Implementation unchanged) ...
        const publicUrl = `${window.location.origin}/mentorship/submit/${activeService}`;
        navigator.clipboard.writeText(publicUrl).then(() => {
            setToast({ show: true, message: 'Public submission link copied to clipboard!', type: 'success' });
        }, (err) => {
            setToast({ show: true, message: 'Failed to copy link.', type: 'error' });
        });
    };

    const handleImportMentorships = async (data, originalRows) => {
        // ... (Implementation unchanged) ...
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
             fetchMentorshipSubmissions(true);

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

    // --- MODIFIED: handleSaveNewHealthWorker ---
    // Now also needs to clear the editable fields after saving
    const handleSaveNewHealthWorker = async (workerData) => {
        const user = auth.currentUser;
        if (!selectedFacilityId || !workerData.name) {
             setToast({ show: true, message: 'خطأ: لم يتم تحديد المؤسسة أو اسم العامل الصحي.', type: 'error' });
            return;
        }
        try {
            const mentorIdentifier = user ? (user.displayName || user.email) : (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm');
            await addHealthWorkerToFacility(selectedFacilityId, workerData, mentorIdentifier);
            await fetchHealthFacilities(true); // Refetch
            setToast({ show: true, message: 'تمت إضافة العامل الصحي بنجاح!', type: 'success' });

            // Clear editable fields (important!)
            setWorkerJobTitle('');
            setWorkerTrainingDate('');
            setWorkerPhone('');
            setIsWorkerInfoChanged(false);
            setSelectedWorkerOriginalData(null); // Clear original data too

            // Auto-select the newly added worker in the dropdown
            setSelectedHealthWorkerName(workerData.name); // This will trigger the useEffect to load data

            setIsAddWorkerModalOpen(false);
        } catch (error) {
            console.error("Error saving new health worker:", error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        }
    };
    // --- END MODIFICATION ---

    // --- NEW: Handler to save updated worker info ---
    const handleUpdateHealthWorkerInfo = async () => {
        if (!selectedHealthWorkerName || !selectedFacilityId || !isWorkerInfoChanged) {
            return; // No worker selected, no facility, or no changes
        }
        setIsUpdatingWorker(true);
        const user = auth.currentUser;
        try {
             const mentorIdentifier = user ? (user.displayName || user.email) : (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm');
             const updatedData = {
                name: selectedHealthWorkerName, // Keep the name
                job_title: workerJobTitle,
                training_date: workerTrainingDate,
                phone: workerPhone
             };
             // Call the SAME function used for adding, it handles updates too
             await addHealthWorkerToFacility(selectedFacilityId, updatedData, mentorIdentifier);
             await fetchHealthFacilities(true); // Refetch to get updated list/data
             setToast({ show: true, message: 'تم تحديث بيانات العامل الصحي بنجاح!', type: 'success' });
             setIsWorkerInfoChanged(false); // Reset changed status after successful save

             // Re-fetch the worker data to update the 'original' state after save
             const updatedFacility = healthFacilities.find(f => f.id === selectedFacilityId); // Get latest from potentially updated cache
             if (updatedFacility?.imnci_staff) {
                 const staffList = typeof updatedFacility.imnci_staff === 'string' ? JSON.parse(updatedFacility.imnci_staff) : updatedFacility.imnci_staff;
                 const freshWorkerData = Array.isArray(staffList) ? staffList.find(w => w.name === selectedHealthWorkerName) : null;
                 setSelectedWorkerOriginalData(freshWorkerData); // Update original data reference
             }

        } catch (error) {
             console.error("Error updating health worker info:", error);
             setToast({ show: true, message: `فشل تحديث بيانات العامل: ${error.message}`, type: 'error' });
        } finally {
            setIsUpdatingWorker(false);
        }
    };
    // --- END NEW HANDLER ---


    // --- Render Logic ---
    if (currentView === 'service_selection') {
        return <ServiceSelector onSelectService={handleSelectService} />;
    }

    if (currentView === 'history') {
        const canShareLink = permissions.canManageSkillsMentorship || permissions.canUseSuperUserAdvancedFeatures;
        return (
            <>
                <MentorshipSubmissionsTable
                    submissions={submissions || []}
                    onNewVisit={handleStartNewVisit}
                    onBackToServiceSelection={handleReturnToServiceSelection}
                    activeService={activeService}
                    setToast={setToast}
                    availableStates={availableStates}
                    userStates={userStates}
                    fetchSubmissions={fetchMentorshipSubmissions}
                    isSubmissionsLoading={isSubmissionsLoading}
                    onShareLink={handleShareSubmissionLink}
                    canShareLink={canShareLink}
                    canBulkUpload={canBulkUploadMentorships}
                    onBulkUpload={() => setIsBulkUploadModalOpen(true)}
                />
                {isBulkUploadModalOpen && (
                    <DetailedMentorshipBulkUploadModal
                        isOpen={isBulkUploadModalOpen}
                        onClose={() => { setIsBulkUploadModalOpen(false); setUploadStatus({ inProgress: false, processed: 0, total: 0, errors: [], message: '' }); }}
                        onImport={handleImportMentorships}
                        uploadStatus={uploadStatus}
                        activeService={activeService}
                        healthFacilities={healthFacilities || []}
                    />
                )}
            </>
        );
    }


    // --- Render SkillsAssessmentForm when worker name is selected ---
    // This view is now separate and triggered *only* when a worker name is finally selected and ready for assessment.
    // --- MODIFICATION: Pass visitNumber and new worker props ---
    if (currentView === 'form_setup' && selectedHealthWorkerName && selectedFacility && activeService && !isAddWorkerModalOpen && !isWorkerInfoChanged) {
        // Only render the form if a worker is selected, facility exists, service active, modal is closed, AND info isn't pending update
        return (
            <SkillsAssessmentForm
                facility={selectedFacility}
                healthWorkerName={selectedHealthWorkerName}
                // --- ADD NEW PROPS ---
                healthWorkerJobTitle={workerJobTitle}
                healthWorkerTrainingDate={workerTrainingDate}
                // --- END ADD NEW PROPS ---
                onCancel={handleFormCompletion} // Handles navigation back to history/setup
                setToast={setToast}
                visitNumber={visitNumber} // Pass the calculated visit number
                // existingSessionData can be passed here if editing a draft later
            />
        );
    }
    // --- END MODIFICATION ---

    // --- Render Setup View ---
    const isStateFilterDisabled = !publicSubmissionMode && userStates && userStates.length === 1;
    const isLocalityFilterDisabled = publicSubmissionMode ? !selectedState : (permissions.manageScope === 'locality' || !selectedState);

    // This view remains if we haven't selected a worker or if info is being edited.
    if (currentView === 'form_setup') {
          const serviceTitle = SERVICE_TITLES[activeService] || activeService;
        return (
            <>
                <Card dir="rtl">
                    <div className="p-6">
                        {/* --- Header and Back Button --- */}
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-right">
                                <PageHeader
                                    title={publicSubmissionMode ? `إدخال بيانات: ${serviceTitle}` : `متابعة مهارات: ${serviceTitle}`}
                                    subtitle={publicSubmissionMode ? "الرجاء اختيار الولاية والمحلية والمنشأة والعامل الصحي للمتابعة." : "اختر عاملاً صحياً لبدء الجلسة."}
                                />
                            </div>
                            {!publicSubmissionMode && (
                                <Button variant="secondary" onClick={handleBackToHistoryView}> العودة للسجل </Button>
                            )}
                        </div>

                        {/* --- Selection Grid --- */}
                        {isFacilitiesLoading ? (
                            <div className="flex justify-center p-8"><Spinner /></div>
                        ) : (
                            <div className="space-y-6 mt-6">
                                {/* --- Location Selection Row --- */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border p-4 rounded-lg bg-gray-50">
                                    <FormGroup label="الولاية" className="text-right">
                                        <Select value={selectedState} onChange={handleStateChange} disabled={isStateFilterDisabled}>
                                            {availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="المحلية" className="text-right">
                                        <Select value={selectedLocality} onChange={(e) => { setSelectedLocality(e.target.value); setSelectedFacilityId(''); setSelectedHealthWorkerName(''); setSelectedWorkerOriginalData(null); setWorkerJobTitle(''); setWorkerTrainingDate(''); setWorkerPhone(''); setIsWorkerInfoChanged(false); }} disabled={isLocalityFilterDisabled}>
                                             {(!publicSubmissionMode && permissions.manageScope === 'locality') ? (
                                                userLocalities && userLocalities.length > 0 ? (
                                                    userLocalities.map(locEn => {
                                                        const locAr = selectedState && STATE_LOCALITIES[selectedState]?.localities.find(l => l.en === locEn)?.ar || locEn;
                                                        return <option key={locEn} value={locEn}>{locAr}</option>;
                                                    })
                                                ) : (
                                                    <option value="">-- لم يتم تحديد محلية --</option>
                                                )
                                            ) : ( // Public mode OR non-locality scope user
                                                <>
                                                    <option value="">-- اختر المحلية --</option>
                                                    {selectedState && STATE_LOCALITIES[selectedState]?.localities.sort((a, b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                                                </>
                                            )}
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="المؤسسة الصحية" className="text-right">
                                        <Select value={selectedFacilityId} onChange={(e) => { setSelectedFacilityId(e.target.value); setSelectedHealthWorkerName(''); setSelectedWorkerOriginalData(null); setWorkerJobTitle(''); setWorkerTrainingDate(''); setWorkerPhone(''); setIsWorkerInfoChanged(false); }} disabled={!selectedLocality}>
                                            <option value="">-- اختر المؤسسة --</option>
                                            {filteredFacilities.map(f => ( <option key={f.id} value={f.id}>{f['اسم_المؤسسة']}</option> ))}
                                        </Select>
                                        {selectedState && selectedLocality && filteredFacilities.length === 0 && !isFacilitiesLoading && ( <p className="text-xs text-red-600 mt-1">لا توجد مؤسسات مسجلة لهذه المحلية.</p> )}
                                    </FormGroup>
                                </div>

                                {/* --- Health Worker Selection & Edit Section --- */}
                                {selectedFacilityId && (
                                    <div className="border p-4 rounded-lg bg-gray-50 space-y-4">
                                        {/* Worker Dropdown */}
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
                                                        // useEffect will handle populating fields
                                                    }
                                                }}
                                                disabled={!selectedFacilityId}
                                            >
                                                <option value="">-- اختر العامل الصحي --</option>
                                                <option value="ADD_NEW_WORKER" className="font-bold text-blue-600 bg-blue-50">
                                                    + إضافة عامل صحي جديد...
                                                </option>
                                                {healthWorkers.map(w => (
                                                    <option key={w.id} value={w.name}>
                                                        {w.name}
                                                    </option>
                                                ))}
                                            </Select>
                                            {healthWorkers.length === 0 && (
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
                                                            variant="success" // Changed variant
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
                    </div>
                     {/* --- Button to Proceed to Assessment (only if worker selected and info not changed) --- */}
                     {selectedHealthWorkerName && !isWorkerInfoChanged && (
                         <div className="p-4 border-t bg-gray-50 flex justify-end">
                             <Button
                                 onClick={() => { /* Simply letting the component re-render will show the form */ }}
                                 disabled={!selectedHealthWorkerName || isWorkerInfoChanged} // Extra safety check
                                 title={isWorkerInfoChanged ? "الرجاء حفظ تعديلات بيانات العامل أولاً" : ""}
                             >
                                 بدء جلسة المتابعة لـ {selectedHealthWorkerName}
                             </Button>
                         </div>
                     )}
                </Card>

                {/* --- Add Worker Modal --- */}
                {isAddWorkerModalOpen && (
                    <AddHealthWorkerModal
                        isOpen={isAddWorkerModalOpen}
                        onClose={() => setIsAddWorkerModalOpen(false)}
                        onSave={handleSaveNewHealthWorker}
                        facilityName={selectedFacility?.['اسم_المؤسسة'] || 'المؤسسة المحددة'}
                    />
                )}
            </>
        );
    }

    return null; // Should not happen
};

export default SkillsMentorshipView;