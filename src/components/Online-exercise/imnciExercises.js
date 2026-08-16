// src/components/exercises/imnciExercises.js
//
// Content library for the IMNCI Online Training sub-course.
// Pure data — no React, no Firebase. Add new exercises by appending to EXERCISES.
//
// ---------------------------------------------------------------------------
// STEP TYPES
// ---------------------------------------------------------------------------
//  'brief'     Narrative only. Not scored. Use to present the case.
//  'form'      Fill the recording-form header (name, age, weight, temp, ...).
//              fields: [{ id, label, labelAr, unit, type, answer, tolerance }]
//  'checklist' Tick each sign present / not present.
//              signs: [{ id, label, labelAr, present: true|false, why }]
//  'classify'  Choose the classification(s) for one assessment module.
//              options: [{ id, label, colour: 'pink'|'yellow'|'green' }]
//              correct: [ids]           multi = true allows more than one
//  'mcq'       Multiple choice. options: [strings], correct: [indexes]
//  'match'     Drag / tap a sign onto the classification it belongs to.
//              left: [{id,label}]  right: [{id,label,colour}]  correct: {leftId: rightId}
//  'media'     Photo or video sign identification. media: {type:'image'|'video', src, alt}
//              then behaves like an mcq.
//
// Every scored step may carry `explain` — shown in the feedback panel.
// ---------------------------------------------------------------------------

export const CLASSIFICATION_COLOURS = {
    pink:   { bg: 'bg-rose-100',   border: 'border-rose-400',   text: 'text-rose-900',   dot: 'bg-rose-500',   label: 'Urgent referral' },
    yellow: { bg: 'bg-amber-100',  border: 'border-amber-400',  text: 'text-amber-900',  dot: 'bg-amber-500',  label: 'Treat at facility' },
    green:  { bg: 'bg-emerald-100',border: 'border-emerald-400',text: 'text-emerald-900',dot: 'bg-emerald-500',label: 'Home care / advise' },
};

// Reusable option banks -----------------------------------------------------

export const DIARRHOEA_HYDRATION_OPTIONS = [
    { id: 'severe_dehydration', label: 'Severe dehydration',       labelAr: 'جفاف شديد',   colour: 'pink' },
    { id: 'some_dehydration',   label: 'Some dehydration',         labelAr: 'جفاف بسيط',   colour: 'yellow' },
    { id: 'no_dehydration',     label: 'No dehydration',           labelAr: 'لا يوجد جفاف', colour: 'green' },
];

export const DIARRHOEA_EXTRA_OPTIONS = [
    { id: 'severe_persistent', label: 'Severe persistent diarrhoea', labelAr: 'إسهال مستمر شديد', colour: 'pink' },
    { id: 'persistent',        label: 'Persistent diarrhoea',        labelAr: 'إسهال مستمر',      colour: 'yellow' },
    { id: 'dysentery',         label: 'Dysentery',                   labelAr: 'دوسنتاريا',        colour: 'yellow' },
    { id: 'none_extra',        label: 'No additional classification',labelAr: 'لا يوجد تصنيف إضافي', colour: 'green' },
];

export const COUGH_OPTIONS = [
    { id: 'severe_pneumonia', label: 'Severe pneumonia or very severe disease', labelAr: 'التهاب رئوي شديد أو مرض شديد جداً', colour: 'pink' },
    { id: 'pneumonia',        label: 'Pneumonia',        labelAr: 'التهاب رئوي',   colour: 'yellow' },
    { id: 'cough_no_pneumonia', label: 'Cough or cold (no pneumonia)', labelAr: 'سعال أو برد', colour: 'green' },
    { id: 'no_cough',         label: 'Child does not have cough or difficult breathing', labelAr: 'لا يوجد سعال', colour: 'green' },
];

// ---------------------------------------------------------------------------
// EXERCISE 2 — Assess and Classify a Child with Diarrhoea
// Digitised from "Exercise 2" slide deck.
// ---------------------------------------------------------------------------

const EXERCISE_2 = {
    id: 'imnci-ex2-diarrhoea',
    order: 2,
    title: 'Exercise 2 — Assess and Classify a Child with Diarrhoea',
    titleAr: 'التمرين ٢ — تقييم وتصنيف الطفل المصاب بالإسهال',
    subCourse: 'IMNCI Online Training',
    ageGroup: '2 months up to 5 years',
    passMark: 80,
    feedbackMode: 'immediate', // 'immediate' | 'end'
    estimatedMinutes: 20,
    intro:
        'You will assess two children who came to the clinic with diarrhoea. For each child, ' +
        'record the findings on the recording form, then decide the classification for every ' +
        'assessment box you have opened. Check your answer after each step.',
    introAr:
        'ستقوم بتقييم طفلين حضرا إلى العيادة بسبب الإسهال. سجّل النتائج في استمارة التسجيل لكل طفل، ' +
        'ثم حدّد التصنيف لكل مربع تقييم قمت بفتحه.',

    cases: [
        // ---------------------------------------------------------------- CASE 1
        {
            id: 'case1',
            title: 'Case 1 — Samira Ahmed Ali',
            steps: [
                {
                    id: 'c1-brief',
                    type: 'brief',
                    title: 'Read the case',
                    body: [
                        'Samira Ahmed Ali is at the clinic today because she has had diarrhoea for 4 days.',
                        'She is 25 months old. She weighs 9 kg, her height is 75 cm and her temperature is 37.0 °C.',
                        'This is her initial visit for this problem.',
                    ],
                    bodyAr: [
                        'سميرة أحمد علي في العيادة اليوم لأنها تعاني من الإسهال منذ ٤ أيام.',
                        'عمرها ٢٥ شهراً، وزنها ٩ كجم، طولها ٧٥ سم، ودرجة حرارتها ٣٧٫٠ °م.',
                    ],
                },
                {
                    id: 'c1-form',
                    type: 'form',
                    title: 'Complete the top of the recording form',
                    instruction: 'Fill in the child\'s details exactly as recorded by the health worker.',
                    fields: [
                        { id: 'name',    label: 'Child name',      labelAr: 'اسم الطفل',   type: 'text',   answer: 'Samira Ahmed Ali', accept: ['samira ahmed ali', 'samera ali ahmed', 'samira ali ahmed'] },
                        { id: 'age',     label: 'Age',             labelAr: 'العمر',       type: 'number', unit: 'months', answer: 25 },
                        { id: 'weight',  label: 'Weight',          labelAr: 'الوزن',       type: 'number', unit: 'kg',     answer: 9, tolerance: 0.1 },
                        { id: 'height',  label: 'Height / length', labelAr: 'الطول',       type: 'number', unit: 'cm',     answer: 75, tolerance: 1 },
                        { id: 'temp',    label: 'Temperature',     labelAr: 'درجة الحرارة', type: 'number', unit: '°C',    answer: 37, tolerance: 0.2 },
                        { id: 'problem', label: 'Child\'s problem',labelAr: 'شكوى الطفل',  type: 'text',   answer: 'Diarrhoea', accept: ['diarrhea', 'diarrhoea', 'إسهال'] },
                        { id: 'visit',   label: 'Visit',           labelAr: 'الزيارة',     type: 'select', options: ['Initial visit', 'Follow-up visit'], answer: 'Initial visit' },
                    ],
                    explain: 'Age is always recorded in completed months for a child 2 months up to 5 years.',
                },
                {
                    id: 'c1-danger',
                    type: 'checklist',
                    title: 'Check for general danger signs',
                    instruction: 'The health worker checked every child for general danger signs. Mark what she found.',
                    signs: [
                        { id: 'not_drink', label: 'Not able to drink or breastfeed', labelAr: 'غير قادر على الشرب أو الرضاعة', present: false },
                        { id: 'vomits',    label: 'Vomits everything',               labelAr: 'يتقيأ كل شيء',                 present: false },
                        { id: 'convuls_illness', label: 'Convulsions in current illness', labelAr: 'تشنجات في المرض الحالي', present: false },
                        { id: 'convulsing_now',  label: 'Convulsing now',            labelAr: 'يتشنج الآن',                   present: false },
                        { id: 'lethargic', label: 'Lethargic or unconscious',        labelAr: 'خامل أو فاقد الوعي',           present: false },
                    ],
                    explain: 'Samira has no general danger sign, so she does not need urgent referral on that basis.',
                },
                {
                    id: 'c1-cough',
                    type: 'classify',
                    title: 'Does the child have cough or difficult breathing?',
                    instruction: 'The mother says Samira does not have cough or difficult breathing. What do you record?',
                    options: COUGH_OPTIONS,
                    correct: ['no_cough'],
                    explain:
                        'When the answer to the main symptom question is NO, you do not assess further and you do not ' +
                        'classify — you simply tick "No" and move to the next main symptom.',
                },
                {
                    id: 'c1-diarr-signs',
                    type: 'checklist',
                    title: 'Assess the diarrhoea',
                    instruction: 'Samira has had diarrhoea for 4 days. Record the signs the health worker found.',
                    signs: [
                        { id: 'blood',     label: 'Blood in the stool',     labelAr: 'دم في البراز',       present: true,  why: 'Blood in the stool is the sign for dysentery.' },
                        { id: 'restless',  label: 'Restless or irritable',  labelAr: 'مضطرب أو سريع الانفعال', present: false },
                        { id: 'lethargic_d', label: 'Lethargic or unconscious', labelAr: 'خامل أو فاقد الوعي', present: false },
                        { id: 'sunken',    label: 'Sunken eyes',            labelAr: 'عيون غائرة',         present: false },
                        { id: 'thirsty',   label: 'Drinks eagerly, thirsty',labelAr: 'يشرب بلهفة، عطشان',  present: false },
                        { id: 'not_drink_d', label: 'Not able to drink or drinking poorly', labelAr: 'غير قادر على الشرب', present: false },
                        { id: 'pinch_slow', label: 'Skin pinch goes back slowly or very slowly', labelAr: 'قرصة الجلد تعود ببطء', present: false, why: 'Her skin pinch goes back immediately.' },
                    ],
                    explain: 'Duration = 4 days (less than 14 days, so not persistent diarrhoea). One sign is present: blood in the stool.',
                },
                {
                    id: 'c1-hydration',
                    type: 'classify',
                    title: 'Classify the dehydration',
                    instruction: 'Using the classification table, choose Samira\'s dehydration classification.',
                    options: DIARRHOEA_HYDRATION_OPTIONS,
                    correct: ['no_dehydration'],
                    explain:
                        'Severe dehydration needs 2 of: lethargic/unconscious, sunken eyes, not able to drink, skin pinch ' +
                        'very slow. Some dehydration needs 2 of: restless/irritable, sunken eyes, drinks eagerly, skin ' +
                        'pinch slow. Samira has none of these, so she is classified NO DEHYDRATION (green).',
                },
                {
                    id: 'c1-extra',
                    type: 'classify',
                    title: 'Any additional diarrhoea classification?',
                    instruction: 'Diarrhoea for 4 days, blood in the stool. Select every classification that applies.',
                    multi: true,
                    options: DIARRHOEA_EXTRA_OPTIONS,
                    correct: ['dysentery'],
                    explain:
                        'Blood in the stool = DYSENTERY (yellow). Persistent diarrhoea requires 14 days or more — Samira ' +
                        'has had diarrhoea for only 4 days, so that row is not classified.',
                },
                {
                    id: 'c1-summary',
                    type: 'mcq',
                    title: 'Final classifications',
                    question: 'Which set of classifications should be written in Samira\'s Classify column?',
                    options: [
                        'Severe dehydration + Dysentery',
                        'No dehydration + Dysentery',
                        'Some dehydration + Persistent diarrhoea',
                        'No dehydration only',
                    ],
                    correct: [1],
                    explain: 'NO DEHYDRATION + DYSENTERY. Samira is treated at the clinic with Plan A, zinc, and an oral antibiotic for dysentery — she is not referred.',
                },
            ],
        },

        // ---------------------------------------------------------------- CASE 2
        {
            id: 'case2',
            title: 'Case 2 — Amani Omer Ahmed',
            steps: [
                {
                    id: 'c2-brief',
                    type: 'brief',
                    title: 'Read the case',
                    body: [
                        'Amani Omer Ahmed is 3 years old. She weighs 10 kg, her height is 80 cm and her temperature is 37 °C.',
                        'Her mother came today because Amani has diarrhoea. She has also had a cough for two days.',
                    ],
                    bodyAr: [
                        'أماني عمر أحمد عمرها ٣ سنوات، وزنها ١٠ كجم، طولها ٨٠ سم، ودرجة حرارتها ٣٧ °م.',
                        'حضرت والدتها اليوم لأن أماني تعاني من الإسهال، ولديها أيضاً سعال منذ يومين.',
                    ],
                },
                {
                    id: 'c2-form',
                    type: 'form',
                    title: 'Complete the top of the recording form',
                    instruction: 'Fill in Amani\'s details. Remember: age is recorded in completed months.',
                    fields: [
                        { id: 'name',   label: 'Child name',      labelAr: 'اسم الطفل',   type: 'text',   answer: 'Amani Omer Ahmed', accept: ['amani omer ahmed', 'amani omar ahmed'] },
                        { id: 'age',    label: 'Age',             labelAr: 'العمر',       type: 'number', unit: 'months', answer: 36 },
                        { id: 'weight', label: 'Weight',          labelAr: 'الوزن',       type: 'number', unit: 'kg',     answer: 10, tolerance: 0.1 },
                        { id: 'height', label: 'Height / length', labelAr: 'الطول',       type: 'number', unit: 'cm',     answer: 80, tolerance: 1 },
                        { id: 'temp',   label: 'Temperature',     labelAr: 'درجة الحرارة', type: 'number', unit: '°C',    answer: 37, tolerance: 0.2 },
                    ],
                    explain: '3 years = 36 completed months.',
                },
                {
                    id: 'c2-danger',
                    type: 'checklist',
                    title: 'Check for general danger signs',
                    instruction: 'Mark each danger sign as the health worker found it.',
                    signs: [
                        { id: 'not_drink', label: 'Not able to drink or breastfeed', present: false },
                        { id: 'vomits',    label: 'Vomits everything',               present: false },
                        { id: 'convuls_illness', label: 'Convulsions in current illness', present: true, why: 'The mother reported convulsions during this illness — this is a general danger sign.' },
                        { id: 'convulsing_now',  label: 'Convulsing now',            present: false },
                        { id: 'lethargic', label: 'Lethargic or unconscious',        present: false },
                    ],
                    explain:
                        'A convulsion during the current illness IS a general danger sign, even if the child is not ' +
                        'convulsing now and looks well in the clinic. Any danger sign means urgent referral.',
                },
                {
                    id: 'c2-danger-mcq',
                    type: 'mcq',
                    title: 'What does this mean?',
                    question: 'Amani has a general danger sign. What must you do?',
                    options: [
                        'Stop the assessment and refer immediately without completing it',
                        'Complete the assessment quickly, give pre-referral treatment, and refer urgently',
                        'Treat at the clinic and ask the mother to return in 2 days',
                        'Ignore it because she is not convulsing now',
                    ],
                    correct: [1],
                    explain:
                        'You complete the rest of the assessment rapidly so that no other severe classification is missed, ' +
                        'give the needed pre-referral treatment, then refer urgently.',
                },
                {
                    id: 'c2-cough-signs',
                    type: 'checklist',
                    title: 'Assess the cough',
                    instruction: 'Amani has had a cough for 2 days. Her breathing was counted at 36 breaths per minute.',
                    signs: [
                        { id: 'fast_breathing', label: 'Fast breathing', present: false, why: 'For a child 12 months up to 5 years, fast breathing is 40 breaths per minute or more. 36 is not fast breathing.' },
                        { id: 'indrawing',      label: 'Chest indrawing', present: false },
                        { id: 'stridor',        label: 'Stridor in a calm child', present: false },
                        { id: 'wheeze',         label: 'Wheeze', present: false },
                    ],
                    explain: 'Fast-breathing cut-offs: 2–11 months → 50/min or more; 12 months–5 years → 40/min or more.',
                },
                {
                    id: 'c2-cough-classify',
                    type: 'classify',
                    title: 'Classify the cough',
                    instruction: 'Amani has no fast breathing, no chest indrawing, no stridor and no wheeze — but remember what you found earlier.',
                    options: COUGH_OPTIONS,
                    correct: ['severe_pneumonia'],
                    explain:
                        'This is the key learning point of the case. A general danger sign in a child with cough means ' +
                        'SEVERE PNEUMONIA OR VERY SEVERE DISEASE (pink), even when the breathing signs are all normal.',
                },
                {
                    id: 'c2-diarr-signs',
                    type: 'checklist',
                    title: 'Assess the diarrhoea',
                    instruction: 'Amani has had diarrhoea for 2 days. Record the signs found.',
                    signs: [
                        { id: 'blood',      label: 'Blood in the stool',      present: false },
                        { id: 'restless',   label: 'Restless or irritable',   present: false },
                        { id: 'sunken',     label: 'Sunken eyes',             present: true },
                        { id: 'thirsty',    label: 'Drinks eagerly, thirsty', present: true },
                        { id: 'pinch_slow', label: 'Skin pinch goes back slowly or very slowly', present: false, why: 'Her skin pinch goes back immediately.' },
                    ],
                    explain: 'Two signs of some dehydration are present: sunken eyes and drinking eagerly.',
                },
                {
                    id: 'c2-hydration',
                    type: 'classify',
                    title: 'Classify the dehydration',
                    instruction: 'Choose Amani\'s dehydration classification.',
                    options: DIARRHOEA_HYDRATION_OPTIONS,
                    correct: ['some_dehydration'],
                    explain:
                        'Two of the four "some dehydration" signs (sunken eyes, drinks eagerly) → SOME DEHYDRATION (yellow). ' +
                        'Because she also has a severe classification requiring urgent referral, she is referred urgently ' +
                        'with the mother giving frequent sips of ORS on the way.',
                },
                {
                    id: 'c2-match',
                    type: 'match',
                    title: 'Match each sign to the classification it produces',
                    instruction: 'Drag each sign onto its classification. On a phone, tap the sign then tap the classification.',
                    left: [
                        { id: 'm_blood',   label: 'Blood in the stool' },
                        { id: 'm_14days',  label: 'Diarrhoea for 14 days or more, with dehydration' },
                        { id: 'm_2signs',  label: 'Sunken eyes + drinks eagerly' },
                        { id: 'm_danger',  label: 'Cough + any general danger sign' },
                        { id: 'm_pinch',   label: 'Skin pinch goes back very slowly + lethargic' },
                    ],
                    right: [
                        { id: 'r_dysentery', label: 'Dysentery', colour: 'yellow' },
                        { id: 'r_severe_persistent', label: 'Severe persistent diarrhoea', colour: 'pink' },
                        { id: 'r_some',      label: 'Some dehydration', colour: 'yellow' },
                        { id: 'r_sev_pneu',  label: 'Severe pneumonia or very severe disease', colour: 'pink' },
                        { id: 'r_severe_deh',label: 'Severe dehydration', colour: 'pink' },
                    ],
                    correct: {
                        m_blood: 'r_dysentery',
                        m_14days: 'r_severe_persistent',
                        m_2signs: 'r_some',
                        m_danger: 'r_sev_pneu',
                        m_pinch: 'r_severe_deh',
                    },
                    explain: 'Pink classifications always mean urgent referral after pre-referral treatment.',
                },
                {
                    id: 'c2-summary',
                    type: 'mcq',
                    title: 'Final classifications',
                    question: 'What is written in Amani\'s Classify column?',
                    options: [
                        'Cough or cold + Some dehydration',
                        'Pneumonia + No dehydration',
                        'Severe pneumonia or very severe disease + Some dehydration',
                        'Severe pneumonia or very severe disease + Severe dehydration',
                    ],
                    correct: [2],
                    explain: 'SEVERE PNEUMONIA OR VERY SEVERE DISEASE + SOME DEHYDRATION. Amani needs urgent referral.',
                },
            ],
        },
    ],
};

// ---------------------------------------------------------------------------
// EXERCISE 3 — template showing the media / photo-identification format.
// Replace `src` with your own hosted images or videos, then remove this note.
// ---------------------------------------------------------------------------

const EXERCISE_3_TEMPLATE = {
    id: 'imnci-ex3-signs',
    order: 3,
    title: 'Exercise 3 — Identify the Clinical Sign',
    titleAr: 'التمرين ٣ — تعرّف على العلامة السريرية',
    subCourse: 'IMNCI Online Training',
    passMark: 80,
    feedbackMode: 'immediate',
    estimatedMinutes: 10,
    draft: true, // hidden from participants until you set this to false
    intro: 'Watch each short clip or photo and identify the sign. Replace the placeholder media URLs before publishing.',
    cases: [
        {
            id: 'signs',
            title: 'Sign identification',
            steps: [
                {
                    id: 'sign-indrawing',
                    type: 'media',
                    title: 'Watch the child breathe',
                    media: { type: 'video', src: '', alt: 'Child with chest movement — add your clip URL' },
                    question: 'What sign does this child have?',
                    options: ['Chest indrawing', 'Fast breathing only', 'Stridor', 'No abnormal sign'],
                    correct: [0],
                    explain: 'Chest indrawing = the lower chest wall goes IN when the child breathes IN, and must be present all the time in a calm child.',
                },
                {
                    id: 'sign-pinch',
                    type: 'media',
                    title: 'Skin pinch',
                    media: { type: 'video', src: '', alt: 'Skin pinch demonstration — add your clip URL' },
                    question: 'How would you record this skin pinch?',
                    options: ['Goes back immediately', 'Goes back slowly (under 2 seconds)', 'Goes back very slowly (over 2 seconds)'],
                    correct: [2],
                    explain: 'A pinch that takes longer than 2 seconds to go back is "very slowly" — a sign of severe dehydration.',
                },
            ],
        },
    ],
};

export const EXERCISES = [EXERCISE_2, EXERCISE_3_TEMPLATE];

// Helpers -------------------------------------------------------------------

export const getExercisesForSubCourse = (subCourse, { includeDrafts = false } = {}) =>
    EXERCISES
        .filter(e => e.subCourse === subCourse && (includeDrafts || !e.draft))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

export const getExerciseById = (id) => EXERCISES.find(e => e.id === id) || null;

export const flattenSteps = (exercise) =>
    (exercise?.cases || []).flatMap(c => c.steps.map(s => ({ ...s, caseId: c.id, caseTitle: c.title })));

export const scoredStepCount = (exercise) =>
    flattenSteps(exercise).filter(s => s.type !== 'brief').length;
