// IMNCIFormPart.jsx
import React from 'react';
import {
    FormGroup, Select, Checkbox
} from '../CommonComponents';

// --- Single Skill Checklist Item ---
export const SkillChecklistItem = ({ label, value, onChange, name, showNaOption = true, naLabel = "لا ينطبق", isMainSymptom = false, scoreCircle = null }) => {
    const handleChange = (e) => { onChange(name, e.target.value); };

    const containerClasses = isMainSymptom
        ? "flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-sky-700 text-white rounded-t-md"
        : "flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-md bg-white shadow-sm transition-all hover:shadow-md sm:mr-4";

    const labelClasses = isMainSymptom
        ? "text-sm font-bold mb-2 sm:mb-0 text-right flex items-start sm:items-center flex-grow mr-4"
        : "text-sm font-medium text-gray-800 mb-2 sm:mb-0 text-right flex items-start sm:items-center flex-grow mr-4";

    return (
        <div dir="rtl" className={containerClasses}>
            <span className={labelClasses}>
                {scoreCircle && <span className="ml-2 flex-shrink-0 self-start sm:self-auto">{scoreCircle}</span>} 
                <span className="w-full sm:w-auto break-words sm:whitespace-nowrap">{label}</span> 
            </span>
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


// --- Score Circle Component ---
export const ScoreCircle = ({ score, maxScore }) => {
    if (maxScore === null || maxScore === undefined || score === null || score === undefined) {
        return null;
    }

    let percentage;
    if (maxScore === 0) {
        percentage = (score === 0) ? 100 : 0;
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
         bgColor = 'bg-green-600';
    }

    return (
        <div
            className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-white font-bold text-xs shadow-md`}
            title={`${score} / ${maxScore} (${maxScore > 0 ? percentage + '%' : 'N/A'})`}
        >
            {maxScore === 0 ? 'N/A' : `${percentage}%`}
        </div>
    );
};


// --- Helper function to evaluate the relevance logic ---
export const evaluateRelevance = (relevanceString, formData) => {
    if (!relevanceString) return true;
    const logicRegex = /\$\{(.*?)\}='(.*?)'/;
    const match = relevanceString.match(logicRegex);
    if (!match) {
        console.warn("Could not parse relevance string:", relevanceString);
        return true;
    }
    const [, varName, expectedValue] = match;
    let actualValue = formData[varName]
        ?? formData.assessment_skills?.[varName]
        ?? formData.treatment_skills?.[varName]
        ?? (varName === 'decisionMatches' ? formData.decisionMatches : undefined);
    if (actualValue === undefined && varName.startsWith('as_')) actualValue = formData.assessment_skills?.[varName.replace('as_','')];
    if (actualValue === undefined && varName.startsWith('ts_')) actualValue = formData.treatment_skills?.[varName.replace('ts_','')];

    if (expectedValue.toLowerCase() === 'yes') return actualValue === 'yes';
    if (expectedValue.toLowerCase() === 'no') return actualValue === 'no';
    if (expectedValue.toLowerCase() === 'na') return actualValue === 'na';

    return actualValue === expectedValue;
};


// --- Form Structure ---
export const IMNCI_FORM_STRUCTURE = [
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
        group: 'تقييم مهارات العلاج والنصح', step: 9, scoreKey: 'treatment', maxScore: null,
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
                        relevant: (formData) => {
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
                skills: [ { key: 'skill_pneu_abx', label: 'هل وصف مضاد حيوي (أموكسيلين) لعلاج الالتهاب الرئوي بصورة صحيحة' }, { key: 'skill_pneu_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج الالتهاب الرئوي بالعيادة بصورة صحيحة', relevant: "${skill_pneu_abx}='yes'" }, ],
                relevant: (formData) => {
                    if (formData.finalDecision !== 'treatment') return false;
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
                skills: [ { key: 'skill_diar_ors', label: 'هل حدد كمية محلول الإرواء بصورة صحيحة' }, { key: 'skill_diar_counsel', label: 'هل نصح الأم بالرعاية المنزلية بإعطاء سوائل أكثر و الاستمرار في تغذية الطفل)' }, { key: 'skill_diar_zinc', label: 'هل وصف دواء الزنك بصورة صحيحة' }, { key: 'skill_diar_zinc_dose', label: 'هل أعطى الجرعة الأولى من دواء الزنك للطفل بالوحدة الصحية بطريقة صحيحة', relevant: "${skill_diar_zinc}='yes'" }, ],
                relevant: (formData) => {
                    if (formData.finalDecision !== 'treatment') return false;
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
                skills: [ { key: 'skill_dyst_abx', label: 'هل وصف مضاد حيوي (سبروفلوكساسين) لعلاج الدسنتاريا بصورة صحيحة' }, { key: 'skill_dyst_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج الدسنتاريا في العيادة بصورة صحيحة', relevant: "${skill_dyst_abx}='yes'" }, ],
                relevant: (formData) => {
                    if (formData.finalDecision !== 'treatment') return false;
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
                skills: [ { key: 'skill_mal_meds', label: 'هل وصف دواء لعلاج الملاريا (كوارتم) بصورة صحيحة' }, { key: 'skill_mal_dose', label: 'هل أعطى الجرعة الأولى من الدواء لعلاج الملاريا في العيادة بصورة صحيحة', relevant: "${skill_mal_meds}='yes'" }, ],
                relevant: (formData) => {
                    if (formData.finalDecision !== 'treatment') return false;
                    const didClassifyCorrectly = formData.assessment_skills.skill_classify_fever === 'yes';
                    const workerCls = formData.assessment_skills.worker_fever_classification || {};
                    const supervisorCls = formData.assessment_skills.supervisor_correct_fever_classification || {};
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return !!effectiveCls['ملاريا'];
                }
            },
            {
                subgroupTitle: 'في حالة التهاب الأذن',
                scoreKey: 'ear_treatment',
                skills: [ { key: 'skill_ear_abx', label: 'هل وصف مضاد حيوي (أموكسيلين) لعلاج التهاب الأذن الحاد بصورة صحيحة' }, { key: 'skill_ear_dose', label: 'هل أعطى الجرعة الأولى من مضاد حيوي لعلاج التهاب الأذن الحاد بصورة صحيحة', relevant: "${skill_ear_abx}='yes'" }, { key: 'skill_ear_para', label: 'هل وصف دواء الباراسيتامول بصورة صحيحة' }, { key: 'skill_ear_para_dose', label: 'هل أعطى الجرعة الأولى من الباراسيتامول بصورة صحيحة', relevant: "${skill_ear_para}='yes'" }, ],
                relevant: (formData) => {
                    if (formData.finalDecision !== 'treatment') return false;
                    const didClassifyCorrectly = formData.assessment_skills.skill_classify_ear === 'yes';
                    const workerCls = formData.assessment_skills.worker_ear_classification;
                    const supervisorCls = formData.assessment_skills.supervisor_correct_ear_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return ['التهاب العظمة خلف الاذن', 'التهاب أذن حاد', 'التهاب أذن مزمن'].includes(effectiveCls);
                }
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
                            return ['سوء تغذية شديد غير مصحوب بمضاعفات', 'سوء تغذية حاد متوسط'].includes(effectiveCls);
                        }
                    },
                    { key: 'skill_nut_assess', label: 'قيم تغذية الطفل بما في ذلك مشاكل الرضاعة (لأقل من عمر سنتين)' }, { key: 'skill_nut_counsel', label: 'أرشد الأم عن تغذية الطفل بما في ذلك مشاكل الرضاعة الأقل من عمر سنتين)' },
                ],
                relevant: (formData) => {
                    if (formData.finalDecision !== 'treatment') return false;
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
                skills: [ { key: 'skill_anemia_iron', label: 'هل وصف (شراب حديد) بصورة صحيحة' }, { key: 'skill_anemia_iron_dose', label: 'هل أعطى الجرعة الأولى من شراب حديد بصورة صحيحة', relevant: "${skill_anemia_iron}='yes'" }, ],
                relevant: (formData) => {
                    if (formData.finalDecision !== 'treatment') return false;
                    const didClassifyCorrectly = formData.assessment_skills.skill_anemia_classify === 'yes';
                    const workerCls = formData.assessment_skills.worker_anemia_classification;
                    const supervisorCls = formData.assessment_skills.supervisor_correct_anemia_classification;
                    const effectiveCls = didClassifyCorrectly ? workerCls : supervisorCls;
                    return effectiveCls === 'فقر دم';
                }
            },
            { subgroupTitle: 'نصح الأم متى تعود للمتابعة',
                scoreKey: 'fu_treatment',
                skills: [ { key: 'skill_fu_when', label: 'هل ذكر لها علامتين علي الأقل إذا ظهرت على الطفل يجب أن تعود به فورا للوحدة الصحية' }, { key: 'skill_fu_return', label: 'هل حدد للام متى تعود بالطفل' }, ]
                ,
                relevant: (formData) => {
                    return formData.finalDecision === 'treatment';
                }
            }
        ]
    }
];

// --- Classification Constants ---
export const COUGH_CLASSIFICATIONS = ["التهاب رئوي شديد أو مرض شديد جدا", "التهاب رئوي", "كحة أو نزلة برد"];
export const DIARRHEA_CLASSIFICATIONS = ["جفاف شديد", "بعض الجفاف", "لا يوجد جفاف", "إسهال مستمر شديد", "إسهال مستمر", "دسنتاريا"];
export const DIARRHEA_COLS_1 = ["جفاف شديد", "بعض الجفاف", "لا يوجد جفاف"];
export const DIARRHEA_COLS_2 = ["إسهال مستمر شديد", "إسهال مستمر", "دسنتاريا"];
export const FEVER_CLASSIFICATIONS = ["مرض حمي شديد", "ملاريا", "حمى لا توجد ملاريا", "حصبة مصحوبة بمضاعفات شديدة", "حصبة مصحوبة بمضاعفات في العين والفم", "حصبة"];
export const FEVER_COLS_1 = ["مرض حمي شديد", "ملاريا", "حمى لا توجد ملاريا"];
export const FEVER_COLS_2 = ["حصبة مصحوبة بمضاعفات شديدة", "حصبة مصحوبة بمضاعفات في العين والفم", "حصبة"];
export const EAR_CLASSIFICATIONS = ["التهاب العظمة خلف الاذن", "التهاب أذن حاد", "التهاب أذن مزمن", "لا يوجد التهاب أذن"];
export const MALNUTRITION_CLASSIFICATIONS = ["سوء تغذية شديد مصحوب بمضاعفات", "سوء تغذية شديد غير مصحوب بمضاعفات", "سوء تغذية حاد متوسط", "لا يوجد سوء تغذية"];
export const ANEMIA_CLASSIFICATIONS = ["فقر دم شديد", "فقر دم", "لا يوجد فقر دم"];

// Helper for initial state
export const createInitialClassificationState = (classifications) => classifications.reduce((acc, c) => { acc[c] = false; return acc; }, {});

// --- Initial Form Data setup ---
export const getInitialFormData = () => {
    const initialState = {
        session_date: new Date().toISOString().split('T')[0], notes: '', assessment_skills: { supervisor_confirms_cough: '', worker_cough_classification: '', supervisor_correct_cough_classification: '', supervisor_confirms_diarrhea: '', worker_diarrhea_classification: createInitialClassificationState(DIARRHEA_CLASSIFICATIONS), supervisor_correct_diarrhea_classification: createInitialClassificationState(DIARRHEA_CLASSIFICATIONS), supervisor_confirms_fever: '', worker_fever_classification: createInitialClassificationState(FEVER_CLASSIFICATIONS), supervisor_correct_fever_classification: createInitialClassificationState(FEVER_CLASSIFICATIONS), supervisor_confirms_ear: '', worker_ear_classification: '', supervisor_correct_ear_classification: '', worker_malnutrition_classification: '', supervisor_correct_malnutrition_classification: '', worker_anemia_classification: '', supervisor_correct_anemia_classification: '', }, treatment_skills: {}, finalDecision: '', decisionMatches: '',
    };
    IMNCI_FORM_STRUCTURE.forEach(group => {
        if (group.isDecisionSection) return; if (!initialState[group.sectionKey]) initialState[group.sectionKey] = {};
        if (group.subgroups && Array.isArray(group.subgroups)) {
            group.subgroups.forEach(subgroup => {
                if (subgroup.isSymptomGroupContainer && Array.isArray(subgroup.symptomGroups)) { subgroup.symptomGroups.forEach(sg => { if (sg.mainSkill?.key) initialState[group.sectionKey][sg.mainSkill.key] = ''; }); } else if (Array.isArray(subgroup.skills)) { subgroup.skills.forEach(skill => { if (skill?.key) initialState[group.sectionKey][skill.key] = ''; }); }
            });
        }
    });
    initialState.assessment_skills['skill_ask_cough'] = ''; initialState.assessment_skills['skill_check_rr'] = ''; initialState.assessment_skills['skill_classify_cough'] = '';
    initialState.assessment_skills['skill_ask_diarrhea'] = ''; initialState.assessment_skills['skill_check_dehydration'] = ''; initialState.assessment_skills['skill_classify_diarrhea'] = '';
    initialState.assessment_skills['skill_ask_fever'] = ''; initialState.assessment_skills['skill_check_rdt'] = ''; initialState.assessment_skills['skill_classify_fever'] = '';
    initialState.assessment_skills['skill_ask_ear'] = ''; initialState.assessment_skills['skill_check_ear'] = ''; initialState.assessment_skills['skill_classify_ear'] = '';
    return initialState;
};

// --- Helper function to find incomplete treatment skills ---
export const ensureArrayOfKeys = (data, classifications) => {
    if (Array.isArray(data)) {
        return data;
    }
    if (typeof data === 'object' && data !== null) {
        // MODIFICATION: Filter out 'did_not_classify' if it exists as a key
        return classifications.filter(c => data[c]);
    }
    return [];
};

// --- Helper to rehydrate draft data into form state ---
// --- MODIFIED: Pass in constants to avoid circular dependencies ---
export const rehydrateDraftData = (draft, DIARRHEA_CLASSIFICATIONS, FEVER_CLASSIFICATIONS) => {
    const rehydrated = getInitialFormData();

    rehydrated.session_date = draft.sessionDate || new Date().toISOString().split('T')[0];
    rehydrated.notes = draft.notes || '';
    rehydrated.finalDecision = draft.finalDecision || '';
    rehydrated.decisionMatches = draft.decisionMatches || '';

    if (draft.assessmentSkills) {
        rehydrated.assessment_skills = {
            ...rehydrated.assessment_skills,
            ...draft.assessmentSkills,
        };
    }
    if (draft.treatmentSkills) {
        rehydrated.treatment_skills = {
            ...rehydrated.treatment_skills,
            ...draft.treatmentSkills,
        };
    }

    const assessmentDraft = draft.assessmentSkills || {};

    const workerDiarrheaKeys = ensureArrayOfKeys(assessmentDraft.worker_diarrhea_classification, DIARRHEA_CLASSIFICATIONS);
    rehydrated.assessment_skills.worker_diarrhea_classification =
        DIARRHEA_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = workerDiarrheaKeys.includes(c);
            return acc;
        }, createInitialClassificationState(DIARRHEA_CLASSIFICATIONS));
    // Handle 'did_not_classify' separately
    if (assessmentDraft.worker_diarrhea_classification && assessmentDraft.worker_diarrhea_classification.did_not_classify) {
        rehydrated.assessment_skills.worker_diarrhea_classification.did_not_classify = true;
    }


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
    // Handle 'did_not_classify' separately
     if (assessmentDraft.worker_fever_classification && assessmentDraft.worker_fever_classification.did_not_classify) {
        rehydrated.assessment_skills.worker_fever_classification.did_not_classify = true;
    }

    const supervisorFeverKeys = ensureArrayOfKeys(assessmentDraft.supervisor_correct_fever_classification, FEVER_CLASSIFICATIONS);
    rehydrated.assessment_skills.supervisor_correct_fever_classification =
        FEVER_CLASSIFICATIONS.reduce((acc, c) => {
            acc[c] = supervisorFeverKeys.includes(c);
            return acc;
        }, createInitialClassificationState(FEVER_CLASSIFICATIONS));

    return rehydrated;
};


// --- calculateScores function (MODIFIED: Merged with Bulk Upload logic) ---
export const calculateScores = (formData) => {
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

    // --- NEW KPI VARS (Malaria, Malnutrition) ---
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

                         mainSymptomsCurrentScore += currentSymptomScore;
                         mainSymptomsMaxScore += maxSymptomScore; // <-- MODIFIED: was subgroupRelevantMaxScore
                         if (sg.mainSkill.scoreKey) {
                             scores[sg.mainSkill.scoreKey] = { score: currentSymptomScore, maxScore: maxSymptomScore };
                         }
                    });
                    if (subgroup.scoreKey) {
                        scores[subgroup.scoreKey] = { score: mainSymptomsCurrentScore, maxScore: mainSymptomsMaxScore };
                    }

                } else if (Array.isArray(subgroup.skills)) {
                    let subgroupRelevantMaxScore = 0;
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
                    if (isSubgroupScored) {
                        subgroupMaxScore = subgroupRelevantMaxScore;
                        scores[subgroup.scoreKey] = { score: subgroupCurrentScore, maxScore: subgroupMaxScore };
                    }
                }

                groupCurrentScore += subgroupCurrentScore;
            });

            // This block is for the total Assessment score
            if (group.sectionKey === 'assessment_skills') {
                scores['assessment_total_score'] = { 
                    score: groupCurrentScore, // contains sum of vital, danger, mal, anemia, imm, other
                    maxScore: totalAssessmentMaxScore // contains sum of their relevant maxes
                };
                 totalCurrentScore += groupCurrentScore;
                 totalMaxScore += totalAssessmentMaxScore;
            } 
            // This block is for the total Treatment score
            else if (group.scoreKey === 'treatment') {
                groupMaxScore = totalTreatmentMaxScore; // Max score is the sum of all relevant skills
                // --- FIX: Save under 'treatment_total_score' to match 'assessment_total_score' pattern ---
                scores['treatment_total_score'] = { score: groupCurrentScore, maxScore: groupMaxScore };
                totalMaxScore += groupMaxScore;
                totalCurrentScore += groupCurrentScore;
                currentTreatmentScore = groupCurrentScore; // <-- *** THIS IS THE FIX (Part 1) ***
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
    
    // --- THIS IS THE CRITICAL ADDITION ---
    // --- Add all the KPI and Hands-On scores that were missing ---

    // --- NEW HANDS-ON SKILL SCORES ---
    scores.handsOnWeight = { score: handsOnWeight_score, maxScore: handsOnWeight_max };
    scores.handsOnTemp = { score: handsOnTemp_score, maxScore: handsOnTemp_max };
    scores.handsOnHeight = { score: handsOnHeight_score, maxScore: handsOnHeight_max };
    scores.handsOnRR = { score: handsOnRR_score, maxScore: handsOnRR_max };
    scores.handsOnRDT = { score: handsOnRDT_score, maxScore: handsOnRDT_max };
    scores.handsOnMUAC = { score: handsOnMUAC_score, maxScore: handsOnMUAC_max };
    scores.handsOnWFH = { score: handsOnWFH_score, maxScore: handsOnWFH_max };
    // --- END NEW HANDS-ON SKILL SCORES ---

    // --- REVISED KPI SCORES (Malaria, Malnutrition, Anemia, Cough & Diarrhea) ---
    scores.malariaClassification = { score: totalCorrectFeverClassifications_Malaria, maxScore: totalFeverCases_Malaria };
    scores.malariaManagement = { score: scores['mal_treatment']?.score || 0, maxScore: scores['mal_treatment']?.maxScore || 0 };
    scores.malnutritionCaseCount = { score: totalMalnutritionCases_max, maxScore: 1 };
    scores.malnutritionManagement = { score: scores['nut_treatment']?.score || 0, maxScore: scores['nut_treatment']?.maxScore || 0 };
    scores.anemiaManagement = { score: scores['anemia_treatment']?.score || 0, maxScore: scores['anemia_treatment']?.maxScore || 0 };
    
    // Cough & Pneumonia replaced with Respiratory Rate Calculation
    const rrDenominator = formData.assessment_skills?.supervisor_confirms_cough === 'yes' ? 1 : 0;
    const rrNumerator = (rrDenominator && formData.assessment_skills?.skill_check_rr === 'yes') ? 1 : 0;
    scores.respiratoryRateCalculation = { score: rrNumerator, maxScore: rrDenominator };
    scores.pneumoniaManagement = { score: scores['pneu_treatment']?.score || 0, maxScore: scores['pneu_treatment']?.maxScore || 0 };
    
    // Diarrhea KPI replaced with Dehydration Assessment
    const dehydDenominator = formData.assessment_skills?.supervisor_confirms_diarrhea === 'yes' ? 1 : 0;
    const dehydNumerator = (dehydDenominator && formData.assessment_skills?.skill_check_dehydration === 'yes') ? 1 : 0;
    scores.dehydrationAssessment = { score: dehydNumerator, maxScore: dehydDenominator };
    scores.diarrheaManagement = { score: scores['diar_treatment']?.score || 0, maxScore: scores['diar_treatment']?.maxScore || 0 };
    // --- END REVISED KPI SCORES ---

    return scores;
};
// --- END calculateScores ---

// --- Helper function to find incomplete treatment skills ---
export const findIncompleteTreatmentSkills = (formData) => {
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
                let isSkillRelevant = true;
                if (skill.relevant) {
                    isSkillRelevant = typeof skill.relevant === 'function'
                        ? skill.relevant(formData)
                        : evaluateRelevance(skill.relevant, formData);
                }

                if (isSkillRelevant && (!sectionData[skill.key] || sectionData[skill.key] === '')) {
                    incomplete.push(skill.label);
                }
            });
        }
    });
    return incomplete;
};


// --- Step completion helpers ---
const isMultiSelectGroupEmpty = (obj) => !obj || !Object.values(obj).some(v => v === true);

export const isVitalSignsComplete = (data) => { const skills = data.assessment_skills; return skills.skill_weight !== '' && skills.skill_temp !== '' && skills.skill_height !== ''; };
export const isDangerSignsComplete = (data) => { const skills = data.assessment_skills; return skills.skill_ds_drink !== '' && skills.skill_ds_vomit !== '' && skills.skill_ds_convulsion !== '' && skills.skill_ds_conscious !== ''; };

export const isCoughBlockComplete = (skills) => {
    if (skills.skill_ask_cough === '') return false;
    if (skills.skill_ask_cough === 'yes') {
        if (skills.supervisor_confirms_cough === '') return false;
        if (skills.supervisor_confirms_cough === 'yes') {
            if (skills.skill_check_rr === '' || skills.skill_classify_cough === '') return false;
            if (skills.skill_classify_cough === 'yes' && skills.worker_cough_classification === '') return false;
            if (skills.skill_classify_cough === 'no' && (skills.worker_cough_classification === '' || skills.supervisor_correct_cough_classification === '')) return false;
        }
    }
    return true;
};

export const isDiarrheaBlockComplete = (skills) => {
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

export const isFeverBlockComplete = (skills) => {
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

export const isEarBlockComplete = (skills) => {
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

export const isMainSymptomsComplete = (data_assessment_skills) => {
    const skills = data_assessment_skills; // Passed in directly
    return isCoughBlockComplete(skills) && 
           isDiarrheaBlockComplete(skills) && 
           isFeverBlockComplete(skills) && 
           isEarBlockComplete(skills);
};

export const isMalnutritionComplete = (data) => {
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

export const isAnemiaComplete = (data) => {
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

export const isImmunizationComplete = (data) => { const skills = data.assessment_skills; return skills.skill_imm_vacc !== '' && skills.skill_imm_vita !== ''; };
export const isOtherProblemsComplete = (data) => { const skills = data.assessment_skills; return skills.skill_other !== ''; };
export const isDecisionComplete = (data) => { return data.finalDecision !== '' && data.decisionMatches !== ''; };


// --- NEW: The IMNCI-specific rendering component ---
export const IMNCIFormRenderer = ({ formData, visibleStep, scores, handleFormChange, handleSkillChange, handleMultiClassificationChange, isEditing }) => {
    return (
        <>
            {/* Form Structure Mapping */}
            {IMNCI_FORM_STRUCTURE.map(group => {
                const isGroupVisible = !group.step || visibleStep >= group.step;
                if (!isGroupVisible) return null;
                
                // --- MODIFIED: Use 'treatment_total_score' for the treatment group score ---
                const groupScoreData = group.scoreKey 
                    ? (group.scoreKey === 'treatment' ? scores['treatment_total_score'] : scores[group.scoreKey])
                    : (group.sectionKey === 'assessment_skills' ? scores['assessment_total_score'] : null);
                // --- END MODIFICATION ---

                // Decision Section Rendering
                if (group.isDecisionSection) {
                    return (
                        <div key={group.group} className="mb-8">
                            <h3 dir="rtl" className="flex justify-between items-center text-xl font-bold mb-4 text-white bg-sky-900 p-2 rounded-md text-right">
                                <span className="flex items-center">
                                    {groupScoreData && <ScoreCircle score={groupScoreData.score} maxScore={groupScoreData.maxScore} />}
                                    <span className="mr-2">{group.group}</span>
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
                                    {formData.finalDecision !== '' && (
                                        <FormGroup label="هل يتطابق قرار العامل الصحي مع المشرف؟" className="text-right flex-shrink-0">
                                            <Select name="decisionMatches" value={formData.decisionMatches} onChange={handleFormChange} className="min-w-[100px]">
                                                <option value="">-- اختر --</option>
                                                <option value="yes">نعم</option>
                                                <option value="no">لا</option>
                                            </Select>
                                        </FormGroup>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                // Other Group Rendering
                return (
                    <div key={group.group} className="mb-8">
                        <h3 dir="rtl" className={`flex justify-between items-center text-xl font-bold mb-4 border-b pb-2 text-right ${ group.group.includes('الأعراض الأساسية') ? 'text-white bg-sky-900 p-2 rounded-md border-b-0' : 'text-gray-800 border-gray-300' }`}>
                            <span className="flex items-center">
                                {groupScoreData && <ScoreCircle score={groupScoreData.score} maxScore={groupScoreData.maxScore} />}
                                <span className="mr-2">{group.group}</span>
                            </span>
                        </h3>
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
                            if (!isSubgroupRelevant) return null;

                            // Symptom Group Container Rendering
                            if (subgroup.isSymptomGroupContainer && Array.isArray(subgroup.symptomGroups)) {
                                return (
                                    <div key={subgroup.subgroupTitle} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                        <h4 dir="rtl" className="flex items-center text-sm font-bold mb-4 text-sky-800 text-right">
                                            {subgroupScoreData && <ScoreCircle score={subgroupScoreData.score} maxScore={subgroupScoreData.maxScore} />}
                                            <span className="mr-2">{subgroup.subgroupTitle}</span>
                                        </h4>
                                        {subgroup.symptomGroups.map(symptomGroup => {
                                            const mainSkill = symptomGroup.mainSkill; if (!mainSkill?.key) return null;
                                            const { assessment_skills } = formData;
                                            
                                            let isSymptomGroupSequentiallyVisible = true;
                                            if (!isEditing) {
                                                if (mainSkill.key === 'skill_ask_diarrhea') {
                                                    isSymptomGroupSequentiallyVisible = isCoughBlockComplete(assessment_skills);
                                                }
                                                else if (mainSkill.key === 'skill_ask_fever') {
                                                    isSymptomGroupSequentiallyVisible = isCoughBlockComplete(assessment_skills) && 
                                                                                        isDiarrheaBlockComplete(assessment_skills);
                                                }
                                                else if (mainSkill.key === 'skill_ask_ear') {
                                                    isSymptomGroupSequentiallyVisible = isCoughBlockComplete(assessment_skills) && 
                                                                                        isDiarrheaBlockComplete(assessment_skills) &&
                                                                                        isFeverBlockComplete(assessment_skills);
                                                }
                                            }
                                            
                                            if (!isSymptomGroupSequentiallyVisible) return null;
                                            
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
                                                    <SkillChecklistItem name={mainSkill.key} label={mainSkill.label} value={mainSkillValue} onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)} showNaOption={false} isMainSymptom={true} scoreCircle={symptomScoreCircle} />
                                                    {showSubQuestions && (
                                                        <div dir="rtl" className="p-4 pt-2 bg-gray-50 space-y-4 text-right rounded-b-md">
                                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center py-2">
                                                                <span className="text-sm font-medium text-gray-800 mb-2 sm:mb-0 sm:ml-4 text-right">{supervisorConfirmLabel}</span>
                                                                <div className="flex gap-4 mt-1 sm:mt-0 flex-shrink-0">
                                                                    <label className="flex items-center gap-1 cursor-pointer text-sm"> <input type="radio" name={supervisorConfirmsKey} value="yes" checked={formData.assessment_skills[supervisorConfirmsKey] === 'yes'} onChange={handleFormChange} className="form-radio text-green-600"/> نعم </label>
                                                                    <label className="flex items-center gap-1 cursor-pointer text-sm"> <input type="radio" name={supervisorConfirmsKey} value="no" checked={formData.assessment_skills[supervisorConfirmsKey] === 'no'} onChange={handleFormChange} className="form-radio text-red-600"/> لا </label>
                                                                </div>
                                                            </div>
                                                            {showClassifications && ( <>
                                                                {originalCheckSkill && <SkillChecklistItem key={originalCheckSkill.key} name={originalCheckSkill.key} label={originalCheckSkill.label} value={formData.assessment_skills[originalCheckSkill.key]} onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)} showNaOption={false} />}
                                                                
                                                                {originalClassifySkill && formData.assessment_skills[originalCheckSkill.key] !== '' && (
                                                                    <SkillChecklistItem key={originalClassifySkill.key} name={originalClassifySkill.key} label={originalClassifySkill.label} value={formData.assessment_skills[classifySkillKey]} onChange={(key, value) => handleSkillChange(group.sectionKey, key, value)} showNaOption={false} />
                                                                )}

                                                                {formData.assessment_skills[classifySkillKey] !== '' && formData.assessment_skills[classifySkillKey] !== 'na' && (
                                                                    <FormGroup label="ما هو التصنيف الذي الذي صنفه العامل الصحي؟" className="text-right">
                                                                        {isMultiSelectClassification && multiSelectCols ? (
                                                                            <>
                                                                                {formData.assessment_skills[classifySkillKey] === 'no' && (
                                                                                    <div className="flex items-center gap-2 mb-2 p-2 border border-red-200 rounded bg-red-50">
                                                                                        <Checkbox 
                                                                                            label="" 
                                                                                            id={`${workerClassKey}-did_not_classify`} 
                                                                                            name="did_not_classify" 
                                                                                            checked={!!formData.assessment_skills[workerClassKey]?.['did_not_classify']} 
                                                                                            onChange={(e) => handleMultiClassificationChange(workerClassKey, 'did_not_classify', e.target.checked)} 
                                                                                        />
                                                                                        <label htmlFor={`${workerClassKey}-did_not_classify`} className="cursor-pointer text-sm font-medium" style={{ color: 'red' }}>
                                                                                            لم يتم التصنيف
                                                                                        </label>
                                                                                    </div>
                                                                                )}
                                                                                <div className="max-h-40 overflow-y-auto border rounded p-3 bg-white grid grid-cols-2 gap-x-4">
                                                                                    <div className="space-y-1">{multiSelectCols.col1.map(c => ( <div key={c} className="flex items-center gap-2"> <Checkbox label="" id={`${workerClassKey}-${c.replace(/\s+/g, '-')}`} name={c} checked={!!formData.assessment_skills[workerClassKey]?.[c]} onChange={(e) => handleMultiClassificationChange(workerClassKey, c, e.target.checked)} /> <label htmlFor={`${workerClassKey}-${c.replace(/\s+/g, '-')}`} className="cursor-pointer text-sm">{c}</label> </div> ))}</div>
                                                                                    <div className="space-y-1">{multiSelectCols.col2.map(c => ( <div key={c} className="flex items-center gap-2"> <Checkbox label="" id={`${workerClassKey}-${c.replace(/\s+/g, '-')}`} name={c} checked={!!formData.assessment_skills[workerClassKey]?.[c]} onChange={(e) => handleMultiClassificationChange(workerClassKey, c, e.target.checked)} /> <label htmlFor={`${workerClassKey}-${c.replace(/\s+/g, '-')}`} className="cursor-pointer text-sm">{c}</label> </div> ))}</div>
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <Select name={workerClassKey} value={formData.assessment_skills[workerClassKey]} onChange={handleFormChange}>
                                                                                <option value="">-- اختر التصنيف --</option>
                                                                                {formData.assessment_skills[classifySkillKey] === 'no' && (
                                                                                    <option value="did_not_classify" style={{ color: 'red' }}>لم يتم التصنيف</option>
                                                                                )}
                                                                                {symptomClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                                                                            </Select>
                                                                        )}
                                                                    </FormGroup>
                                                                )}

                                                                {showSupervisorCorrection && (
                                                                    (isMultiSelectClassification && !isMultiSelectGroupEmpty(formData.assessment_skills[workerClassKey])) ||
                                                                    (!isMultiSelectClassification && formData.assessment_skills[workerClassKey] !== '')
                                                                ) && (
                                                                    <FormGroup label="ما هو التصنيف الصحيح؟" className="text-right">
                                                                        {isMultiSelectClassification && multiSelectCols ? (
                                                                            <div className="max-h-40 overflow-y-auto border rounded p-3 bg-white grid grid-cols-2 gap-x-4">
                                                                                <div className="space-y-1">{multiSelectCols.col1.map(c => ( <div key={c} className="flex items-center gap-2"> <Checkbox label="" id={`${correctClassKey}-${c.replace(/\s+/g, '-')}`} name={c} checked={!!formData.assessment_skills[correctClassKey]?.[c]} onChange={(e) => handleMultiClassificationChange(correctClassKey, c, e.target.checked)} /> <label htmlFor={`${correctClassKey}-${c.replace(/\s+/g, '-')}`} className="cursor-pointer text-sm">{c}</label> </div> ))}</div>
                                                                                <div className="space-y-1">{multiSelectCols.col2.map(c => ( <div key={c} className="flex items-center gap-2"> <Checkbox label="" id={`${correctClassKey}-${c.replace(/\s+/g, '-')}`} name={c} checked={!!formData.assessment_skills[correctClassKey]?.[c]} onChange={(e) => handleMultiClassificationChange(correctClassKey, c, e.target.checked)} /> <label htmlFor={`${correctClassKey}-${c.replace(/\s+/g, '-')}`} className="cursor-pointer text-sm">{c}</label> </div> ))}</div>
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
                                const isMalnutrition = subgroup.subgroupTitle === 'تحرى عن سوء التغذية الحاد'; const isAnemia = subgroup.subgroupTitle === 'تحرى عن الانيميا'; let classPrefix = ''; let classifications = []; if (isMalnutrition) { classPrefix = 'malnutrition'; classifications = MALNUTRITION_CLASSIFICATIONS; } if (isAnemia) { classPrefix = 'anemia'; classifications = ANEMIA_CLASSIFICATIONS; } const workerClassKey = `worker_${classPrefix}_classification`; const correctClassKey = `supervisor_correct_${classPrefix}_classification`; const classifySkillKey = isMalnutrition ? 'skill_mal_classify' : isAnemia ? 'skill_anemia_classify' : null;
                                const showClassifications = (isMalnutrition || isAnemia) && classifySkillKey;
                                const showSupervisorCorrection = showClassifications && formData.assessment_skills[classifySkillKey] === 'no';

                                return (
                                    <div key={subgroup.subgroupTitle} className="mb-4 p-0 border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                                        <h5 dir="rtl" className="flex items-center text-sm font-bold text-white bg-sky-700 p-3 text-right">
                                            {subgroupScoreData && <ScoreCircle score={subgroupScoreData.score} maxScore={subgroupScoreData.maxScore} />}
                                            <span className="mr-2">{subgroup.subgroupTitle}</span>
                                        </h5>
                                        <div className="space-y-3 p-4 text-right" dir="rtl">
                                            {subgroup.skills.map((skill, index) => {
                                                let isConditionallyRelevant = true;
                                                if (skill.relevant) {
                                                    isConditionallyRelevant = typeof skill.relevant === 'function'
                                                        ? skill.relevant(formData)
                                                        : evaluateRelevance(skill.relevant, formData);
                                                }
                                                if (!isConditionallyRelevant) return null;

                                                let isSequentiallyVisible = true;
                                                if (!isEditing && index > 0) {
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
                                                            break;
                                                        }
                                                    }
                                                    if (previousRelevantSkill) {
                                                        const previousValue = formData[group.sectionKey]?.[previousRelevantSkill.key];
                                                        if (previousValue === '' || previousValue === undefined) {
                                                            isSequentiallyVisible = false;
                                                        }
                                                    }
                                                }

                                                if (!isSequentiallyVisible) return null;

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
                                            
                                            {showClassifications && (
                                                <div className="pt-4 mt-4 border-t border-gray-200 space-y-4">
                                                    {formData.assessment_skills[classifySkillKey] !== '' && formData.assessment_skills[classifySkillKey] !== 'na' && (
                                                        <FormGroup label="ما هو التصنيف الذي الذي صنفه العامل الصحي؟" className="text-right">
                                                            <Select name={workerClassKey} value={formData.assessment_skills[workerClassKey]} onChange={handleFormChange}>
                                                                <option value="">-- اختر التصنيف --</option>
                                                                {formData.assessment_skills[classifySkillKey] === 'no' && (
                                                                    <option value="did_not_classify" style={{ color: 'red' }}>لم يتم التصنيف</option>
                                                                )}
                                                                {classifications.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </Select>
                                                        </FormGroup>
                                                    )}
                                                    
                                                    {showSupervisorCorrection && formData.assessment_skills[workerClassKey] !== '' && (
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
                            return null;
                        })}
                    </div>
                );
            })}
        </>
    );
};