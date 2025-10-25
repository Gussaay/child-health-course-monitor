// SkillsMentorshipView.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
// --- MODIFICATION: Import useDataCache ---
import { useDataCache } from '../DataContext';
// --- END MODIFICATION ---
import { Timestamp } from 'firebase/firestore';
// --- MODIFICATION: Import deleteMentorshipSession ---
import {
    saveMentorshipSession,
    // --- MODIFICATION: listMentorshipSessions is no longer needed here ---
    // listMentorshipSessions, 
    // --- END MODIFICATION ---
    importMentorshipSessions,
    addHealthWorkerToFacility,
    deleteMentorshipSession // <-- ADDED
} from '../data';
// --- END MODIFICATION ---
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox, Modal
} from './CommonComponents';
import { STATE_LOCALITIES } from "./constants.js";
import SkillsAssessmentForm from './SkillsAssessmentForm';
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
    if (expectedValue.toLowerCase() === 'yes') return actualValue === 'yes';
    if (expectedValue.toLowerCase() === 'no') return actualValue === 'no';
    if (expectedValue.toLowerCase() === 'na') return actualValue === 'na';
    return actualValue === expectedValue;
};


// --- Function to calculate scores (Copied & adapted from SkillsAssessmentForm) ---
const calculateScores = (formData) => {
    // ... (Implementation unchanged) ...
    // Requires IMNCI_FORM_STRUCTURE to be defined globally or passed in
    // For simplicity in this context, assume IMNCI_FORM_STRUCTURE is accessible
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
                    maxScore: 2, 
                    skills: [
                        { key: 'skill_ref_abx', label: 'في حالة التحويل : هل أعطى الجرعة الاولى من المضاد الحيوي المناسب قبل تحويل الطفل' },
                        { key: 'skill_ref_quinine', label: 'في حالة التحويل : أعطى الكينيين بالعضل قبل التحويل', relevant: "${as_supervisor_correct_fever_classification}='مرض حمي شديد'" }, 
                    ],
                    relevant: "${finalDecision}='referral'" 
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
                    relevant: (formData) => { 
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
                                      isSkillRelevantForScoring = eval(simplifiedRelevanceString.replace(/='(.*?)'/g, '===\'$1\''));
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


// --- Bulk Upload Modal (Detailed Version) ---
const DetailedMentorshipBulkUploadModal = ({
    // ... (Implementation unchanged) ...
    isOpen,
    onClose,
    onImport,
    uploadStatus,
    healthFacilities,
    activeService
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
        { key: 'state', label: 'State (Arabic Name)', required: true },
        { key: 'locality', label: 'Locality (Arabic Name)', required: true },
        { key: 'facility_name', label: 'Facility Name', required: true },
        { key: 'health_worker_name', label: 'Health Worker Name', required: true },
        { key: 'notes', label: 'Notes' },
        { key: 'mentor_email', label: 'Mentor Email (Optional)' },
    ];
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

    const stateArToKey = useMemo(() => {
        // ... (Implementation unchanged) ...
        return Object.entries(STATE_LOCALITIES).reduce((acc, [key, value]) => {
            acc[value.ar.trim().toLowerCase()] = key;
            return acc;
        }, {});
    }, []);
    const localityArToKey = (stateKey, localityAr) => {
        // ... (Implementation unchanged) ...
        if (!stateKey || !localityAr) return null;
        const stateData = STATE_LOCALITIES[stateKey];
        if (!stateData) return null;
        const locality = stateData.localities.find(l => l.ar.trim().toLowerCase() === String(localityAr).trim().toLowerCase());
        return locality ? locality.en : null;
    };
    const facilityLookup = useMemo(() => {
        // ... (Implementation unchanged) ...
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
        // ... (Implementation unchanged) ...
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
        // ... (Implementation unchanged) ...
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
        // ... (Implementation unchanged) ...
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
        // ... (Implementation unchanged) ...
        const fileName = `Mentorship_Upload_Template_Detailed_${activeService}.xlsx`;
        const worksheetData = [ALL_TEMPLATE_HEADERS]; 
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Mentorships");
        XLSX.writeFile(workbook, fileName);
    };
    const handleMappingChange = useCallback((appField, excelHeader) => {
        // ... (Implementation unchanged) ...
        setFieldMappings(prev => {
            const newMappings = { ...prev };
            if (excelHeader) newMappings[appField] = excelHeader;
            else delete newMappings[appField];
            return newMappings;
        });
    }, []);
    const handleValidation = () => {
        // ... (Implementation unchanged) ...
        const missingMappings = BASE_FIELDS 
            .filter(field => field.required && !fieldMappings[field.key])
            .map(field => field.label);
        if (missingMappings.length > 0) {
            setError(`The following base fields must be mapped: ${missingMappings.join(', ')}.`);
            return;
        }
        setError('');
        startImportProcess(excelData, excelData);
    };
    const processAndStartImport = (dataForProcessing, originalRawData) => {
        // ... (Implementation unchanged) ...
        const user = auth.currentUser;
        if (!user) {
            setError('You must be logged in to import data.');
            return;
        }
        const processedSessions = [];
        dataForProcessing.forEach((row, rowIndex) => {
            const sessionFromRow = {};
            ALL_MENTORSHIP_FIELDS.forEach(field => {
                 const excelHeader = fieldMappings[field.key];
                 if (excelHeader) {
                     const headerIndex = headers.indexOf(excelHeader);
                     if (headerIndex !== -1) {
                         let cellValue = row[headerIndex];
                         if (typeof cellValue === 'string') cellValue = cellValue.trim();
                         if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                            sessionFromRow[field.key] = cellValue;
                         }
                     }
                 }
            });
            if (!sessionFromRow.session_date || !sessionFromRow.state || !sessionFromRow.locality || !sessionFromRow.facility_name || !sessionFromRow.health_worker_name) {
                 console.warn(`Skipping row ${rowIndex + 2}: Missing required base info.`);
                return; 
            }
            const formDataForRow = {
                 session_date: '', 
                 notes: sessionFromRow.notes || '',
                 assessment_skills: {},
                 treatment_skills: {},
                 finalDecision: sessionFromRow.finalDecision || '',
                 decisionMatches: sessionFromRow.decisionMatches || '',
            };
            ASSESSMENT_SKILL_FIELDS.forEach(field => {
                 const keyWithoutPrefix = field.key.replace('as_', '');
                 const value = sessionFromRow[field.key]; 
                 if (value !== undefined) {
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
                        formDataForRow.assessment_skills[keyWithoutPrefix] = value;
                     }
                 } else {
                      if (field.key === 'as_worker_diarrhea_classification' || field.key === 'as_supervisor_correct_diarrhea_classification') {
                         formDataForRow.assessment_skills[keyWithoutPrefix] = createInitialClassificationState(DIARRHEA_CLASSIFICATIONS);
                      } else if (field.key === 'as_worker_fever_classification' || field.key === 'as_supervisor_correct_fever_classification') {
                         formDataForRow.assessment_skills[keyWithoutPrefix] = createInitialClassificationState(FEVER_CLASSIFICATIONS);
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
            const payload = {
                serviceType: activeService,
                status: 'complete', 
                healthWorkerName: sessionFromRow.health_worker_name,
                notes: formDataForRow.notes,
                mentorEmail: sessionFromRow.mentor_email || user.email,
                mentorName: user.displayName || 'Batch Upload',
                assessmentSkills: formDataForRow.assessment_skills, 
                treatmentSkills: formDataForRow.treatment_skills, 
                finalDecision: formDataForRow.finalDecision,
                decisionMatches: formDataForRow.decisionMatches,
            };
            try {
                let effectiveDate;
                if (sessionFromRow.session_date instanceof Date) {
                    effectiveDate = Timestamp.fromDate(sessionFromRow.session_date);
                    payload.sessionDate = sessionFromRow.session_date.toISOString().split('T')[0];
                } else {
                    const parsedDate = new Date(sessionFromRow.session_date);
                    if (isNaN(parsedDate.getTime())) throw new Error('Invalid date format');
                    effectiveDate = Timestamp.fromDate(parsedDate);
                    payload.sessionDate = parsedDate.toISOString().split('T')[0];
                }
                payload.effectiveDate = effectiveDate;
            } catch (e) {
                console.warn(`Skipping row ${rowIndex + 2}: Invalid date - ${sessionFromRow.session_date}`);
                 payload.effectiveDate = null; 
            }
            const stateKey = stateArToKey[String(sessionFromRow.state).trim().toLowerCase()];
            const localityKey = localityArToKey(stateKey, String(sessionFromRow.locality));
            payload.state = stateKey; 
            payload.locality = localityKey; 
            payload.facilityName = sessionFromRow.facility_name; 
            const facilityNameLower = String(sessionFromRow.facility_name).trim().toLowerCase();
            const lookupKey = `${stateKey}-${localityKey}-${facilityNameLower}`;
            payload.facilityId = facilityLookup.get(lookupKey) || null; 
             try {
                 payload.scores = calculateScores(formDataForRow);
             } catch (scoreError) {
                 console.error(`Error calculating scores for row ${rowIndex + 2}:`, scoreError);
                 payload.scores = {}; 
             }
            processedSessions.push(payload);
        });
        if (processedSessions.length === 0) {
            setError('No valid sessions could be processed from the Excel file. Check required fields and formats.');
            setCurrentPage(1); 
            return;
        }
        onImport(processedSessions, originalRawData);
    };
    const startImportProcess = (data, rawData) => processAndStartImport(data, rawData);
    const handleRetryUpload = () => {
        // ... (Implementation unchanged) ...
        const dataToRetry = failedRows.map(failedRow => failedRow.rowData);
        setFailedRows([]);
        processAndStartImport(dataToRetry, dataToRetry);
    };
    const handleCorrectionDataChange = (errorIndex, cellIndex, value) => {
        // ... (Implementation unchanged) ...
        const updatedFailedRows = [...failedRows];
        const newRowData = [...updatedFailedRows[errorIndex].rowData];
        newRowData[cellIndex] = value;
        updatedFailedRows[errorIndex].rowData = newRowData;
        setFailedRows(updatedFailedRows);
    };
    const renderPreview = () => (excelData.length === 0) ? null : (
        // ... (Implementation unchanged) ...
        <div className="mt-4 overflow-auto max-h-60">
            <h4 className="font-medium mb-2">Data Preview (first 5 rows)</h4>
            <table className="min-w-full border border-gray-200">
                <thead><tr className="bg-gray-100">{headers.map((header, idx) => <th key={idx} className="border border-gray-300 p-2 text-left text-xs">{header}</th>)}</tr></thead>
                <tbody>{excelData.slice(0, 5).map((row, rowIdx) => <tr key={rowIdx}>{row.map((cell, cellIdx) => <td key={cellIdx} className="border border-gray-300 p-2 text-xs">{cell instanceof Date ? cell.toLocaleDateString() : cell}</td>)}</tr>)}</tbody>
            </table>
        </div>
    );
    const MappingRow = ({ field, headers, selectedValue, onMappingChange }) => (
        // ... (Implementation unchanged) ...
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
    // ... (Implementation unchanged) ...
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


// --- MODIFIED: Table Column Component ---
const MentorshipTableColumns = () => (
    <>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
        {/* <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الولاية</th> */}
        {/* <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المحلية</th> */}
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المؤسسة</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العامل الصحي</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المشرف</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الجلسة</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الدرجة الكلية</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
    </>
);
// --- END MODIFICATION ---

// --- Friendly Service Titles (Unchanged) ---
const SERVICE_TITLES = {
    // ... (Implementation unchanged) ...
    'IMNCI': 'المعالجة المتكاملة',
    'EENC': 'رعاية حديثي الولادة',
    'ETAT': 'الفرز والعلاج في الطوارئ',
    'IPC': 'مكافحة العدوى'
};

// --- NEW: View Submission Modal ---
const ViewSubmissionModal = ({ submission, onClose }) => {
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
                    <ul className="space-y-2 max-h-80 overflow-y-auto pr-2">
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


// --- MODIFIED: Submissions Table Component ---
const MentorshipSubmissionsTable = ({
    submissions,
    onNewVisit,
    onBackToServiceSelection,
    activeService,
    // setToast, // Removed, handled by parent
    onView, // ADDED
    onEdit, // ADDED
    onDelete, // ADDED
    availableStates,
    userStates,
    fetchSubmissions,
    isSubmissionsLoading,
    onShareLink,
    canShareLink,
    canBulkUpload,
    onBulkUpload
}) => {
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [workerFilter, setWorkerFilter] = useState('');

    // MODIFIED: handleAction now calls parent handlers
    const handleAction = (action, submission) => {
        if (action === 'view') {
            onView(submission.id); // Pass ID
        } else if (action === 'edit') {
            onEdit(submission.id); // Pass ID
        } else if (action === 'delete') {
            onDelete(submission.id); // Pass ID
        }
    };


    const filteredSubmissions = useMemo(() => {
        // ... (Implementation unchanged) ...
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
            // Use 'staff' property from processed submission
            filtered = filtered.filter(sub => (sub.staff || '').toLowerCase().includes(workerFilter.toLowerCase()));
        }
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
    }, [submissions, activeService, stateFilter, localityFilter, workerFilter]);

    const availableLocalities = useMemo(() => {
        // ... (Implementation unchanged) ...
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
                    {/* ... (Header buttons unchanged) ... */}
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

                {/* Filters (Unchanged) */}
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
                         <Input type="date" placeholder="التاريخ" /> 
                    </FormGroup>
                </div>


                {/* MODIFIED Table */}
                <div className="mt-6 overflow-x-auto">
                     {isSubmissionsLoading ? (
                        <div className="flex justify-center p-8"><Spinner /></div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {/* Updated Columns */}
                                    <MentorshipTableColumns />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSubmissions.length === 0 ? (
                                    <tr><td colSpan="8"><EmptyState title="لا توجد بيانات" message="لم يتم تسجيل أي زيارات متابعة مطابقة لفلاتر البحث لهذه الخدمة." /></td></tr>
                                ) : (
                                    filteredSubmissions.map((sub, index) => {
                                        // Calculate Score
                                        const scoreData = sub.scores;
                                        let percentage = null;
                                        if (scoreData && scoreData.overallScore_maxScore > 0) {
                                            percentage = Math.round((scoreData.overallScore_score / scoreData.overallScore_maxScore) * 100);
                                        }

                                        return (
                                        <tr key={sub.id} className={sub.status === 'draft' ? 'bg-yellow-50' : 'bg-white'}>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                                            {/* <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{STATE_LOCALITIES[sub.state]?.ar || sub.state}</td> */}
                                            {/* <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{STATE_LOCALITIES[sub.state]?.localities.find(l=>l.en === sub.locality)?.ar || sub.locality}</td> */}
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{sub.facility}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{sub.staff}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{sub.supervisor}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{sub.date}</td>
                                            {/* Status Badge */}
                                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                                                {sub.status === 'draft' ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                        مسودة
                                                    </span>
                                                ) : (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                        مكتمل
                                                    </span>
                                                )}
                                            </td>
                                            {/* Score */}
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                                                {percentage !== null ? `${percentage}%` : 'N/A'}
                                            </td>
                                            {/* Actions */}
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="info" onClick={() => handleAction('view', sub)}>عرض</Button>
                                                    <Button size="sm" variant="warning" onClick={() => handleAction('edit', sub)}>تعديل</Button>
                                                    <Button size="sm" variant="danger" onClick={() => handleAction('delete', sub)}>حذف</Button>
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
                    <Button variant="secondary" onClick={() => fetchSubmissions(true)}>تحديث البيانات</Button>
                </div>
            </div>
        </Card>
    );
};
// --- END MODIFIED TABLE ---

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
    const [selectedHealthWorkerName, setSelectedHealthWorkerName] = useState(''); 
    
    // --- MODIFICATION: Get data and fetchers from DataContext ---
    const { 
        healthFacilities, 
        fetchHealthFacilities, 
        isFacilitiesLoading, // Use this directly
        skillMentorshipSubmissions, // <-- Get cached data
        fetchSkillMentorshipSubmissions, // <-- Get context fetcher
        isLoading: isDataCacheLoading // <-- Get context loading object
    } = useDataCache();
    // --- END MODIFICATION ---
    
    // --- MODIFICATION: State for raw data, view/edit modals ---
    // const [rawSubmissions, setRawSubmissions] = useState(null); // <-- Store raw data
    const [viewingSubmission, setViewingSubmission] = useState(null); // <-- For View Modal
    const [editingSubmission, setEditingSubmission] = useState(null); // <-- For Edit Form
    // --- END MODIFICATION ---

    // --- MODIFICATION: isSubmissionsLoading state removed ---
    // const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);
    // --- END MODIFICATION ---
    
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
    const [selectedWorkerOriginalData, setSelectedWorkerOriginalData] = useState(null); 
    const [workerJobTitle, setWorkerJobTitle] = useState('');
    const [workerTrainingDate, setWorkerTrainingDate] = useState('');
    const [workerPhone, setWorkerPhone] = useState('');
    const [isWorkerInfoChanged, setIsWorkerInfoChanged] = useState(false);
    const [isUpdatingWorker, setIsUpdatingWorker] = useState(false);

    // --- MODIFICATION: fetchMentorshipSubmissions useCallback removed ---
    // The local fetchMentorshipSubmissions function is no longer needed
    // --- END MODIFICATION ---

    // --- NEW: useMemo to process submissions for table ---
    const processedSubmissions = useMemo(() => {
        if (!skillMentorshipSubmissions) return []; // <-- Use cached data
        return skillMentorshipSubmissions.map(sub => ({ // <-- Use cached data
            id: sub.id,
            service: sub.serviceType,
            // Convert Firestore Timestamp to string for display/filtering
            date: sub.effectiveDate ? new Date(sub.effectiveDate.seconds * 1000).toISOString().split('T')[0] : (sub.sessionDate || 'N/A'),
            effectiveDateTimestamp: sub.effectiveDate, // Keep the timestamp for sorting/filtering
            state: sub.state || 'N/A', // Keep for filtering
            locality: sub.locality || 'N/A', // Keep for filtering
            facility: sub.facilityName || 'N/A',
            staff: sub.healthWorkerName || 'N/A',
            supervisor: sub.mentorEmail || 'N/A',
            facilityId: sub.facilityId || null,
            scores: sub.scores || null, // Pass scores
            status: sub.status || 'complete' // Pass status
        }));
    }, [skillMentorshipSubmissions]); // <-- Dependency on cached data
    // --- END NEW useMemo ---

     useEffect(() => {
        // ... (Implementation unchanged) ...
        fetchHealthFacilities();
        // --- MODIFICATION: local fetchMentorshipSubmissions call removed ---
        // This is now handled by App.jsx when the view changes
        // --- END MODIFICATION ---
    }, [fetchHealthFacilities, publicSubmissionMode]); // <-- Modified dependencies

     const availableStates = useMemo(() => {
        // ... (Implementation unchanged) ...
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
        // ... (Implementation unchanged) ...
        if (!publicSubmissionMode && userStates && userStates.length === 1) {
            setSelectedState(userStates[0]);
        }
    }, [userStates, publicSubmissionMode]);

    useEffect(() => {
       // ... (Implementation unchanged) ...
       if (!publicSubmissionMode && permissions.manageScope === 'locality' && userLocalities && userLocalities.length === 1) {
            setSelectedLocality(userLocalities[0]);
        }
    }, [userLocalities, permissions.manageScope, publicSubmissionMode]);


    const handleStateChange = (e) => {
        // ... (Implementation unchanged) ...
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
    };


    const filteredFacilities = useMemo(() => {
        // ... (Implementation unchanged) ...
        if (!healthFacilities || !selectedState || !selectedLocality) return [];
        return healthFacilities.filter(f => f['الولاية'] === selectedState && f['المحلية'] === selectedLocality)
               .sort((a, b) => (a['اسم_المؤسسة'] || '').localeCompare(b['اسم_المؤسسة'] || ''));
    }, [healthFacilities, selectedState, selectedLocality]);

    const selectedFacility = useMemo(() => {
        // ... (Implementation unchanged) ...
        return filteredFacilities.find(f => f.id === selectedFacilityId);
    }, [filteredFacilities, selectedFacilityId]);

    const healthWorkers = useMemo(() => {
        // ... (Implementation unchanged) ...
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

    // --- MODIFICATION: Calculate visitNumber ---
    const visitNumber = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return 1; 
        }
        const existingVisitsCount = processedSubmissions.filter(sub =>
            sub.facilityId === selectedFacilityId &&
            sub.staff === selectedHealthWorkerName &&
            sub.service === activeService &&
            sub.status !== 'draft' // Only count completed submissions
        ).length;

        // If editing a draft, the existingVisitsCount is the number of *completed* sessions.
        // If editing a completed session, the count is the total completed sessions, including the current one.
        // The visit number is stored in the submission data, so we don't need a complex formula here.
        // If we are creating a new one (not editing), the number is completed + 1.

        if (editingSubmission) {
            return editingSubmission.visitNumber || 1; 
        }

        return existingVisitsCount + 1;
    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService, editingSubmission]);
    // --- END MODIFICATION ---

    // --- MODIFICATION: Calculate lastSessionDate ---
    const lastSessionDate = useMemo(() => {
        if (!Array.isArray(processedSubmissions) || !selectedFacilityId || !selectedHealthWorkerName || !activeService) {
            return null;
        }

        const workerSessions = processedSubmissions
            .filter(sub =>
                sub.facilityId === selectedFacilityId &&
                sub.staff === selectedHealthWorkerName &&
                sub.service === activeService &&
                sub.status !== 'draft' // Only consider completed sessions
            )
            // Sort by effectiveDate/date descending (most recent first)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (workerSessions.length === 0) {
            return null; // No previous completed sessions
        }

        if (editingSubmission) {
            // Find the most recent session that is *not* the one being edited.
            const previousSession = workerSessions.find(s => s.id !== editingSubmission.id);
            return previousSession ? previousSession.date : null;
        } else {
            // If creating a new session, the most recent one is the previous one.
            return workerSessions[0].date;
        }
    }, [processedSubmissions, selectedFacilityId, selectedHealthWorkerName, activeService, editingSubmission]);
    // --- END MODIFICATION ---


    useEffect(() => {
        // ... (Implementation unchanged) ...
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
        // ... (Implementation unchanged) ...
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
        // ... (Implementation unchanged) ...
        if (!publicSubmissionMode && userStates && userStates.length === 1) { setSelectedState(userStates[0]); } else { setSelectedState(''); }
        if (!publicSubmissionMode && permissions.manageScope === 'locality' && userLocalities && userLocalities.length === 1) { setSelectedLocality(userLocalities[0]); } else { setSelectedLocality(''); }
        setSelectedFacilityId(''); setSelectedHealthWorkerName('');
        setSelectedWorkerOriginalData(null);
        setWorkerJobTitle('');
        setWorkerTrainingDate('');
        setWorkerPhone('');
        setIsWorkerInfoChanged(false);
    };
    const handleSelectService = (serviceKey) => {
        // ... (Implementation unchanged) ...
        setActiveService(serviceKey);
        setCurrentView('history');
    };
    const handleStartNewVisit = () => {
        // ... (Implementation unchanged) ...
        setCurrentView('form_setup');
    };
    const handleReturnToServiceSelection = () => {
        // ... (Implementation unchanged) ...
        setActiveService(null);
        setCurrentView('service_selection');
        resetSelection();
    };

    // --- MODIFIED: handleFormCompletion ---
    // Clears editing state
    const handleFormCompletion = async () => {
        const cameFromSetup = previousViewRef.current === 'form_setup';
        const wasEditing = !!editingSubmission; // Check if we were editing

        resetSelection();
        setEditingSubmission(null); // <-- CLEAR EDITING STATE
        
        if (publicSubmissionMode) {
            setToast({ show: true, message: 'Submission successful! Thank you.', type: 'success' });
             setCurrentView('form_setup'); // Stay on setup for public
        } else {
             if (cameFromSetup || wasEditing) { // Refetch if new or editing
                // --- MODIFICATION: Use context fetcher ---
                await fetchSkillMentorshipSubmissions(true); // Refetch submissions
                // --- END MODIFICATION ---
             }
            setCurrentView('history'); // Go back to the history list
        }
    };
    // --- END MODIFICATION ---

    const previousViewRef = useRef(currentView); 
    useEffect(() => {
        previousViewRef.current = currentView;
    }, [currentView]);


    // --- MODIFIED: handleBackToHistoryView ---
    // Clears editing state
    const handleBackToHistoryView = () => {
        setCurrentView('history');
         resetSelection();
         setEditingSubmission(null); // <-- CLEAR EDITING STATE
    };
    // --- END MODIFICATION ---

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
             // --- MODIFICATION: Use context fetcher ---
             fetchSkillMentorshipSubmissions(true);
             // --- END MODIFICATION ---
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
             const mentorIdentifier = user ? (user.displayName || user.email) : (publicSubmissionMode ? 'PublicMentorshipForm' : 'SkillsMentorshipForm');
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
             const updatedFacility = healthFacilities.find(f => f.id === selectedFacilityId); 
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
    // --- END NEW HANDLER ---

    // --- NEW: View, Edit, Delete Handlers ---
    const handleViewSubmission = (submissionId) => {
        // --- MODIFICATION: Use cached data ---
        const fullSubmission = skillMentorshipSubmissions.find(s => s.id === submissionId);
        // --- END MODIFICATION ---
        setViewingSubmission(fullSubmission);
    };

    const handleEditSubmission = (submissionId) => {
        // --- MODIFICATION: Use cached data ---
        const fullSubmission = skillMentorshipSubmissions.find(s => s.id === submissionId);
        // --- END MODIFICATION ---
        if (!fullSubmission) return;

        // Set up all the state needed for the form setup view
        setActiveService(fullSubmission.serviceType);
        setSelectedState(fullSubmission.state);
        setSelectedLocality(fullSubmission.locality);
        setSelectedFacilityId(fullSubmission.facilityId);
        setSelectedHealthWorkerName(fullSubmission.healthWorkerName);
        
        // Set the submission data to be passed to the form
        setEditingSubmission(fullSubmission);
        
        // Navigate to the form
        setCurrentView('form_setup');
    };

    const handleDeleteSubmission = async (submissionId) => {
        // --- MODIFICATION: Use cached data ---
        const submissionToDelete = skillMentorshipSubmissions.find(s => s.id === submissionId);
        // --- END MODIFICATION ---
        if (!submissionToDelete) return;

        const confirmMessage = `هل أنت متأكد من حذف جلسة العامل الصحي: ${submissionToDelete.healthWorkerName} بتاريخ ${submissionToDelete.sessionDate}؟
${submissionToDelete.status === 'draft' ? '\n(هذه مسودة)' : ''}`;

        if (window.confirm(confirmMessage)) {
            try {
                await deleteMentorshipSession(submissionId);
                setToast({ show: true, message: 'تم حذف الجلسة بنجاح.', type: 'success' });
                // --- MODIFICATION: Use context fetcher ---
                await fetchSkillMentorshipSubmissions(true); // Refetch list
                // --- END MODIFICATION ---
            } catch (error) {
                console.error("Error deleting session:", error);
                setToast({ show: true, message: `فشل الحذف: ${error.message}`, type: 'error' });
            }
        }
    };
    // --- END NEW Handlers ---


    // --- Render Logic ---
    if (currentView === 'service_selection') {
        return <ServiceSelector onSelectService={handleSelectService} />;
    }

    // --- MODIFIED: history view render ---
    if (currentView === 'history') {
        const canShareLink = permissions.canManageSkillsMentorship || permissions.canUseSuperUserAdvancedFeatures;
        return (
            <>
                <MentorshipSubmissionsTable
                    submissions={processedSubmissions} // <-- Pass processed data
                    onNewVisit={handleStartNewVisit}
                    onBackToServiceSelection={handleReturnToServiceSelection}
                    activeService={activeService}
                    // Pass new handlers
                    onView={handleViewSubmission}
                    onEdit={handleEditSubmission}
                    onDelete={handleDeleteSubmission}
                    //
                    availableStates={availableStates}
                    userStates={userStates}
                    // --- MODIFICATION: Pass context fetcher and loading state ---
                    fetchSubmissions={fetchSkillMentorshipSubmissions}
                    isSubmissionsLoading={isDataCacheLoading.skillMentorshipSubmissions || !skillMentorshipSubmissions} // Show loading if context is loading OR data is null
                    // --- END MODIFICATION ---
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
                {/* NEW: Render View Modal */}
                {viewingSubmission && (
                    <ViewSubmissionModal
                        submission={viewingSubmission}
                        onClose={() => setViewingSubmission(null)}
                    />
                )}
            </>
        );
    }
    // --- END MODIFICATION ---


    // --- MODIFIED: Render SkillsAssessmentForm ---
    // This logic now checks for editingSubmission as well
    if (currentView === 'form_setup' && (editingSubmission || (selectedHealthWorkerName && selectedFacility)) && activeService && !isAddWorkerModalOpen && !isWorkerInfoChanged) {
        
        // When editing, the useEffects for worker info will run based on state set by handleEditSubmission
        // and populate workerJobTitle, workerTrainingDate, workerPhone from the *latest* facility data.
        
        return (
            <SkillsAssessmentForm
                facility={editingSubmission ? { // Construct a minimal facility object if editing
                    'الولاية': editingSubmission.state,
                    'المحلية': editingSubmission.locality,
                    'اسم_المؤسسة': editingSubmission.facilityName,
                    'id': editingSubmission.facilityId,
                    // Add any other facility details the form might need, if any
                } : selectedFacility}
                healthWorkerName={editingSubmission ? editingSubmission.healthWorkerName : selectedHealthWorkerName}
                // Pass worker details. These will be populated by useEffects
                healthWorkerJobTitle={workerJobTitle}
                healthWorkerTrainingDate={workerTrainingDate}
                healthWorkerPhone={workerPhone} 
                //
                onCancel={handleFormCompletion} // Handles navigation back
                setToast={setToast}
                visitNumber={visitNumber} // Use calculated value (which respects editing mode)
                existingSessionData={editingSubmission} // <-- PASS THE SUBMISSION DATA FOR EDITING
                lastSessionDate={lastSessionDate} // <-- PASS CALCULATED VALUE
            />
        );
    }
    // --- END MODIFICATION ---

    // --- Render Setup View (Unchanged logic, but now leads to form above) ---
    const isStateFilterDisabled = !publicSubmissionMode && userStates && userStates.length === 1;
    const isLocalityFilterDisabled = publicSubmissionMode ? !selectedState : (permissions.manageScope === 'locality' || !selectedState);

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
                                    title={editingSubmission ? `تعديل جلسة: ${serviceTitle}` : (publicSubmissionMode ? `إدخال بيانات: ${serviceTitle}` : `متابعة مهارات: ${serviceTitle}`)}
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
                                        <Select value={selectedState} onChange={handleStateChange} disabled={isStateFilterDisabled || !!editingSubmission}>
                                            {availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="المحلية" className="text-right">
                                        <Select value={selectedLocality} onChange={(e) => { setSelectedLocality(e.target.value); setSelectedFacilityId(''); setSelectedHealthWorkerName(''); setSelectedWorkerOriginalData(null); setWorkerJobTitle(''); setWorkerTrainingDate(''); setWorkerPhone(''); setIsWorkerInfoChanged(false); }} disabled={isLocalityFilterDisabled || !!editingSubmission}>
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
                                    <FormGroup label="المؤسسة الصحية" className="text-right">
                                        <Select value={selectedFacilityId} onChange={(e) => { setSelectedFacilityId(e.target.value); setSelectedHealthWorkerName(''); setSelectedWorkerOriginalData(null); setWorkerJobTitle(''); setWorkerTrainingDate(''); setWorkerPhone(''); setIsWorkerInfoChanged(false); }} disabled={!selectedLocality || !!editingSubmission}>
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
                                                    }
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
                                                            disabled={isUpdatingWorker || !!editingSubmission}
                                                            variant="success" 
                                                            size="sm"
                                                            title={editingSubmission ? "لا يمكن تعديل بيانات العامل أثناء تعديل الجلسة" : ""}
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
                     {/* Button to Proceed - now hidden, as form renders automatically */}
                     {/* {selectedHealthWorkerName && !isWorkerInfoChanged && !editingSubmission && (
                         <div className="p-4 border-t bg-gray-50 flex justify-end">
                             <Button
                                 onClick={() => {}} // Form renders automatically
                                 disabled={true} // No need to click
                             >
                                 بدء جلسة المتابعة لـ {selectedHealthWorkerName}
                             </Button>
                         </div>
                     )} */}
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