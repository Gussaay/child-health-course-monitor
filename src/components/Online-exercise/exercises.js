// src/components/Online-exercise/exercises.js
//
// ============================================================================
//  THIS IS THE ONLY FILE YOU EDIT TO ADD OR CHANGE AN EXERCISE.
// ============================================================================
//
// ONE EXERCISE = ONE CASE = ONE PAGE.
// A case is opened from its own card, filled on a single page, checked and
// scored on its own. There is no "next" button and no multi-case exercise: if
// you have three cases to teach, make three exercises.
//
// ---------------------------------------------------------------------------
// EXERCISE SHAPE
// ---------------------------------------------------------------------------
//  id                unique and stable — attempts are keyed on it, so never
//                    rename it once participants have attempted the exercise
//  order             position in the list (Exercise 1, 2, 3 ...)
//  title / titleAr   shown on the card and at the top of the page
//  subCourse         must equal ONLINE_SUB_COURSE below
//  passMark          percent needed to pass (default 80)
//  estimatedMinutes  shown on the card
//  draft             true = facilitators see it, participants do not
//  narrative[]       the case scenario, shown as bullets above the form
//  narrativeAr[]     optional Arabic scenario
//  expected          everything the learner is graded on (below)
//  explain           shown after checking
//
// ---------------------------------------------------------------------------
// THE `expected` BLOCK
// ---------------------------------------------------------------------------
//  sections[]        which assessment rows appear. THE FORM ENDS AFTER THE
//                    LAST ONE — an exercise about diarrhoea shows danger signs,
//                    cough and diarrhoea, and nothing after it.
//                    Valid: danger, cough, diarrhea, fever, ear, anemia,
//                           malnutrition, vaccine, other, feeding
//                    'feeding' is the mother-card "Assess the child's feeding"
//                    row — include it ONLY in exercises that need it.
//  patientData{}     ChildForm's own field names: childName, sex, ageMonths,
//                    weightKg, lengthCm, tempC, visitType
//  assessments{}     ChildForm's own field names for the signs
//  classifyOptions{} per section, the checkboxes the learner picks from
//  classifications{} per section, the option ids that are CORRECT
//  includeTreatment  false = treatment column greyed out and inactive
//                    true  = treatment checkboxes appear and are graded
//  treatmentOptions{} per section, the treatment checkboxes
//  treatments{}      per section, the treatment ids that are CORRECT
//
// The learner CHOOSES the classification — the engine's own answer stays hidden
// until they press check, then both are shown side by side.
// ---------------------------------------------------------------------------

// Must match the entry in IMNCI_SUBCOURSE_TYPES in constants.js exactly.
export const ONLINE_SUB_COURSE = 'online IMCI course';

export const CLASSIFICATION_COLOURS = {
    pink:   { bg: 'bg-rose-100',    border: 'border-rose-400',    text: 'text-rose-900',    dot: 'bg-rose-500',    label: 'Urgent referral' },
    yellow: { bg: 'bg-amber-100',   border: 'border-amber-400',   text: 'text-amber-900',   dot: 'bg-amber-500',   label: 'Treat at facility' },
    green:  { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-900', dot: 'bg-emerald-500', label: 'Home care / advise' },
};

// ---------------------------------------------------------------------------
// Classification option banks. Every id beginning `imci.` is a real i18n key
// from the app's own classification engine, so the checkbox labels follow the
// interface language. Reuse these rather than retyping options per case.
// ---------------------------------------------------------------------------

export const CLASSIFY_OPTIONS = {
    danger: [
        { id: 'imci.classifications.danger_sign' },
        { id: 'no_danger_sign', label: 'No general danger sign', labelAr: 'لا توجد علامة خطر' },
    ],
    cough: [
        { id: 'imci.classifications.severe_pneumonia' },
        { id: 'imci.classifications.pneumonia' },
        { id: 'imci.classifications.cough_cold' },
    ],
    diarrhea: [
        { id: 'imci.classifications.severe_dehydration' },
        { id: 'imci.classifications.some_dehydration' },
        { id: 'imci.classifications.no_dehydration' },
        { id: 'imci.classifications.severe_persistent_diarrhea' },
        { id: 'imci.classifications.persistent_diarrhea' },
        { id: 'imci.classifications.dysentery' },
    ],
    fever: [
        { id: 'imci.classifications.very_severe_febrile' },
        { id: 'imci.classifications.malaria' },
        { id: 'imci.classifications.fever_no_malaria' },
    ],
    ear: [
        { id: 'imci.classifications.mastoiditis' },
        { id: 'imci.classifications.acute_ear_infection' },
        { id: 'imci.classifications.chronic_ear_infection' },
        { id: 'imci.classifications.no_ear_infection' },
    ],
    anemia: [
        { id: 'imci.classifications.severe_anemia' },
        { id: 'imci.classifications.anemia' },
        { id: 'imci.classifications.no_anemia' },
    ],
    malnutrition: [
        { id: 'imci.classifications.complicated_sam' },
        { id: 'imci.classifications.uncomplicated_sam' },
        { id: 'imci.classifications.mam' },
        { id: 'imci.classifications.no_malnutrition' },
    ],
    feeding: [
        { id: 'imci.classifications.feeding_problem' },
        { id: 'imci.classifications.no_feeding_problem' },
    ],
};

// Every section the form can show, in the order the form renders them.
export const ALL_SECTIONS = [
    'danger', 'cough', 'diarrhea', 'fever', 'ear',
    'anemia', 'malnutrition', 'vaccine', 'other', 'feeding',
];

export const SECTION_LABELS = {
    danger: 'General danger signs', cough: 'Cough / difficult breathing', diarrhea: 'Diarrhoea',
    fever: 'Fever', ear: 'Ear problem', anemia: 'Anaemia', malnutrition: 'Malnutrition',
    vaccine: 'Immunisation', other: 'Other problems', feeding: "Mother card — assess feeding",
};

// ---------------------------------------------------------------------------
// Treatment option banks. Plain text, because treatments are phrased differently
// per programme — edit these to match your national chart booklet wording.
// ---------------------------------------------------------------------------

export const TREATMENT_OPTIONS = {
    danger: [
        { id: 'd_first_dose',  label: 'Give first dose of an appropriate antibiotic' },
        { id: 'd_sugar',       label: 'Treat to prevent low blood sugar' },
        { id: 'd_refer',       label: 'Refer URGENTLY to hospital' },
    ],
    cough: [
        { id: 'c_first_dose',  label: 'Give first dose of an appropriate antibiotic' },
        { id: 'c_sugar',       label: 'Treat to prevent low blood sugar' },
        { id: 'c_refer',       label: 'Refer URGENTLY to hospital' },
        { id: 'c_oral_5days',  label: 'Oral antibiotic for 5 days at home' },
        { id: 'c_soothe',      label: 'Soothe the throat, relieve the cough with a safe remedy' },
        { id: 'c_return',      label: 'Advise the mother when to return immediately' },
        { id: 'c_followup_3',  label: 'Follow up in 3 days' },
        { id: 'c_none',        label: 'No treatment needed for cough' },
    ],
    diarrhea: [
        { id: 'dr_planA',      label: 'Plan A: treat diarrhoea at home' },
        { id: 'dr_planB',      label: 'Plan B: treat some dehydration with ORS' },
        { id: 'dr_planC',      label: 'Plan C: treat severe dehydration quickly' },
        { id: 'dr_zinc',       label: 'Give zinc supplement' },
        { id: 'dr_antibiotic', label: 'Oral antibiotic for dysentery' },
        { id: 'dr_ors_on_way', label: 'Give frequent sips of ORS on the way to hospital' },
        { id: 'dr_refer',      label: 'Refer URGENTLY to hospital' },
        { id: 'dr_followup_3', label: 'Follow up in 3 days' },
    ],
    fever: [
        { id: 'f_antimalarial', label: 'Give oral antimalarial' },
        { id: 'f_paracetamol',  label: 'Give paracetamol for high fever' },
        { id: 'f_refer',        label: 'Refer URGENTLY to hospital' },
        { id: 'f_followup_2',   label: 'Follow up in 2 days if fever persists' },
    ],
    ear: [
        { id: 'e_antibiotic',  label: 'Give an oral antibiotic for 5 days' },
        { id: 'e_wick',        label: 'Dry the ear by wicking' },
        { id: 'e_paracetamol', label: 'Give paracetamol for pain' },
        { id: 'e_refer',       label: 'Refer URGENTLY to hospital' },
    ],
    anemia: [
        { id: 'an_iron',       label: 'Give iron' },
        { id: 'an_antimalarial', label: 'Give oral antimalarial if the malaria test is positive' },
        { id: 'an_deworm',     label: 'Give mebendazole if the child is older than one year' },
        { id: 'an_followup_14', label: 'Follow up in 14 days' },
        { id: 'an_refer',      label: 'Refer URGENTLY to hospital' },
    ],
    malnutrition: [
        { id: 'mn_rutf',       label: 'Give ready-to-use therapeutic food (RUTF)' },
        { id: 'mn_vit_a',      label: 'Give vitamin A' },
        { id: 'mn_amoxicillin', label: 'Give oral amoxicillin' },
        { id: 'mn_refer',      label: 'Refer URGENTLY to hospital' },
        { id: 'mn_supplementary', label: 'Refer to a supplementary feeding programme' },
        { id: 'mn_assess_feeding', label: "Assess the child's feeding and counsel the mother" },
        { id: 'mn_followup_7', label: 'Follow up in 7 days' },
        { id: 'mn_followup_30', label: 'Follow up in 30 days' },
    ],
    feeding: [
        { id: 'fd_counsel',    label: 'Counsel the mother using the mother card' },
        { id: 'fd_exclusive',  label: 'Advise exclusive breastfeeding under 6 months' },
        { id: 'fd_no_bottle',  label: 'Advise against feeding bottles; use a cup' },
        { id: 'fd_extra_meals', label: 'Advise extra feeds each day' },
        { id: 'fd_active',     label: 'Advise active feeding: sit with the child and encourage' },
        { id: 'fd_followup_7', label: 'Follow up any feeding problem in 7 days' },
        { id: 'fd_none',       label: 'No feeding counselling needed' },
    ],
};

// ---------------------------------------------------------------------------
// Fills in the option banks so EVERY section listed in `sections` has choices.
// Without this, a section shown on the form but missing from classifyOptions
// renders an empty Classify cell, and a treatment section with no options would
// otherwise fall through to the engine's own answer.
// Pass explicit options in an exercise to override the bank for that section.
// ---------------------------------------------------------------------------

const withDefaults = (expected) => ({
    ...expected,
    classifyOptions: Object.fromEntries(
        (expected.sections || []).map(sec => [
            sec, expected.classifyOptions?.[sec] || CLASSIFY_OPTIONS[sec] || [],
        ])
    ),
    treatmentOptions: expected.includeTreatment
        ? Object.fromEntries(
            (expected.sections || []).map(sec => [
                sec, expected.treatmentOptions?.[sec] || TREATMENT_OPTIONS[sec] || [],
            ])
        )
        : {},
});

// ============================================================================
// EXERCISE 1 — Musa
//
// NOTE: Exercises 1 and 2 were authored to standard IMNCI rules, NOT
// transcribed from one of your slide decks. The clinical logic follows the
// chart booklet (fast breathing = 50/min or more at 2–11 months, 40/min or
// more at 12 months–5 years). A facilitator should review the wording before
// publishing — that is why draft is true.
// ============================================================================

const EXERCISE_1 = {
    id: 'imnci-ex1-musa',
    order: 1,
    title: 'Exercise 1 — Cough: Musa, 8 months',
    titleAr: 'التمرين ١ — السعال: موسى، ٨ أشهر',
    subCourse: ONLINE_SUB_COURSE,
    passMark: 80,
    estimatedMinutes: 12,
    draft: true,
    narrative: [
        'Musa is 8 months old. He weighs 7 kg, is 68 cm long, and his temperature is 37.5 °C. This is his initial visit.',
        'General danger signs: he is able to drink, does not vomit everything, has had no convulsions during this illness, is not convulsing now, and is not lethargic or unconscious.',
        'His mother says he has had a cough for 3 days.',
        'You count 54 breaths per minute. There is no chest indrawing, no stridor and no wheeze.',
    ],
    narrativeAr: [
        'موسى عمره ٨ أشهر، وزنه ٧ كجم، طوله ٦٨ سم، ودرجة حرارته ٣٧٫٥ °م. هذه زيارته الأولى.',
        'علامات الخطر العامة: قادر على الشرب، لا يتقيأ كل شيء، لا توجد تشنجات، لا يتشنج الآن، وليس خاملاً.',
        'تقول والدته إنه يسعل منذ ٣ أيام.',
        'عدد مرات التنفس ٥٤ في الدقيقة. لا يوجد سحب للصدر، ولا صرير، ولا أزيز.',
    ],
    expected: withDefaults({
        sections: ['danger', 'cough'],
        patientData: {
            childName: 'Musa', sex: 'male', ageMonths: 8,
            weightKg: 7, lengthCm: 68, tempC: 37.5, visitType: 'initial',
        },
        assessments: {
            notAbleToDrink: false, vomitsEverything: false, historyOfConvulsions: false,
            lethargicUnconscious: false, convulsingNow: false,
            hasCough: true, coughDays: 3, breathRate: 54, fastBreathing: true,
            chestIndrawing: false, stridor: false, wheeze: false,
        },
        classifyOptions: { danger: CLASSIFY_OPTIONS.danger, cough: CLASSIFY_OPTIONS.cough },
        classifications: {
            danger: ['no_danger_sign'],
            cough: ['imci.classifications.pneumonia'],
        },
        includeTreatment: true,
        treatments: {
            danger: [],
            cough: ['c_oral_5days', 'c_soothe', 'c_return', 'c_followup_3'],
        },
    }),
    explain:
        '54 breaths per minute in an 8-month-old is fast breathing (the cut-off is 50). With no danger sign, ' +
        'no chest indrawing and no stridor, the classification is PNEUMONIA (yellow): an oral antibiotic for ' +
        '5 days, soothe the throat, advise when to return immediately, follow up in 3 days.',
};

// ============================================================================
// EXERCISE 2 — Hawa  (includes the treatment column)
// ============================================================================

const EXERCISE_2 = {
    id: 'imnci-ex2-hawa',
    order: 2,
    title: 'Exercise 2 — Danger Signs: Hawa, 2 years',
    titleAr: 'التمرين ٢ — علامات الخطر: حواء، سنتان',
    subCourse: ONLINE_SUB_COURSE,
    passMark: 80,
    estimatedMinutes: 15,
    draft: true,
    narrative: [
        'Hawa is 2 years old (24 months). She weighs 11 kg, is 85 cm tall, and her temperature is 38.0 °C. This is her initial visit.',
        'General danger signs: she is able to drink and does not vomit everything. She has had no convulsions during this illness and is not convulsing now. She IS lethargic and difficult to wake.',
        'Her mother brings her because she has been coughing for 5 days.',
        'You count 38 breaths per minute. There IS chest indrawing. No stridor, no wheeze.',
    ],
    expected: withDefaults({
        sections: ['danger', 'cough'],
        patientData: {
            childName: 'Hawa', sex: 'female', ageMonths: 24,
            weightKg: 11, lengthCm: 85, tempC: 38, visitType: 'initial',
        },
        assessments: {
            notAbleToDrink: false, vomitsEverything: false, historyOfConvulsions: false,
            lethargicUnconscious: true, convulsingNow: false,
            hasCough: true, coughDays: 5, breathRate: 38, fastBreathing: false,
            chestIndrawing: true, stridor: false, wheeze: false,
        },
        classifyOptions: { danger: CLASSIFY_OPTIONS.danger, cough: CLASSIFY_OPTIONS.cough },
        classifications: {
            danger: ['imci.classifications.danger_sign'],
            cough: ['imci.classifications.severe_pneumonia'],
        },
        includeTreatment: true,
        treatments: {
            danger: ['d_first_dose', 'd_sugar', 'd_refer'],
            cough: ['c_first_dose', 'c_sugar', 'c_refer'],
        },
    }),
    explain:
        'Lethargic or unconscious is a general danger sign, so Hawa needs urgent referral whatever else is ' +
        'found. 38 breaths per minute is NOT fast breathing at 24 months (the cut-off is 40) — but chest ' +
        'indrawing is present, and the danger sign alone would be enough: SEVERE PNEUMONIA OR VERY SEVERE ' +
        'DISEASE. Give the first dose of antibiotic, treat to prevent low blood sugar, and refer urgently. ' +
        'She is not treated at home, so there is no 5-day course and no 3-day follow-up.',
};

// ============================================================================
// EXERCISE 3 — Samira
// Digitised from your "Exercise 2" slide deck, Case 1.
// Left as classification-only (includeTreatment: false) so you have a working
// example of the greyed-out treatment column.
// ============================================================================

const EXERCISE_3 = {
    id: 'imnci-ex3-samira',
    order: 3,
    title: 'Exercise 3 — Diarrhoea: Samira, 25 months',
    titleAr: 'التمرين ٣ — الإسهال: سميرة، ٢٥ شهراً',
    subCourse: ONLINE_SUB_COURSE,
    passMark: 80,
    estimatedMinutes: 15,
    narrative: [
        'Samira Ahmed Ali is at the clinic today because she has had diarrhoea for 4 days.',
        'She is 25 months old, weighs 9 kg, is 75 cm tall, and her temperature is 37.0 °C. This is her initial visit.',
        'General danger signs: she is able to drink, does not vomit everything, has had no convulsions, is not convulsing now, and is not lethargic or unconscious.',
        'She does not have cough or difficult breathing.',
        'There is blood in the stool. She is not restless or irritable, her eyes are not sunken, she does not drink eagerly, and her skin pinch goes back immediately.',
    ],
    narrativeAr: [
        'سميرة أحمد علي في العيادة اليوم لأنها تعاني من الإسهال منذ ٤ أيام.',
        'عمرها ٢٥ شهراً، وزنها ٩ كجم، طولها ٧٥ سم، ودرجة حرارتها ٣٧٫٠ °م. هذه زيارتها الأولى.',
        'علامات الخطر العامة: قادرة على الشرب، لا تتقيأ كل شيء، لا توجد تشنجات، وليست خاملة.',
        'لا يوجد سعال أو صعوبة في التنفس.',
        'يوجد دم في البراز. ليست مضطربة، عيناها ليستا غائرتين، لا تشرب بلهفة، وقرصة الجلد تعود فوراً.',
    ],
    expected: withDefaults({
        sections: ['danger', 'cough', 'diarrhea'],
        patientData: {
            childName: 'Samira Ahmed Ali', sex: 'female', ageMonths: 25,
            weightKg: 9, lengthCm: 75, tempC: 37, visitType: 'initial',
        },
        assessments: {
            notAbleToDrink: false, vomitsEverything: false, historyOfConvulsions: false,
            lethargicUnconscious: false, convulsingNow: false,
            hasCough: false,
            hasDiarrhea: true, diarrheaDays: 4, bloodInStool: true,
            lethargic: false, restlessIrritable: false, sunkenEyes: false,
            drinkPoorly: false, drinkEagerly: false,
            pinchVerySlow: false, pinchSlow: false,
        },
        classifyOptions: {
            danger: CLASSIFY_OPTIONS.danger,
            diarrhea: CLASSIFY_OPTIONS.diarrhea,
        },
        classifications: {
            danger: ['no_danger_sign'],
            diarrhea: ['imci.classifications.no_dehydration', 'imci.classifications.dysentery'],
        },
        includeTreatment: false,
    }),
    explain:
        'Blood in the stool = DYSENTERY (yellow). None of the dehydration signs are present, so NO DEHYDRATION ' +
        '(green). Diarrhoea for 4 days is under 14 days, so persistent diarrhoea is not classified. Samira is ' +
        'treated at the clinic with Plan A, zinc, and an oral antibiotic for dysentery — she is not referred.',
};

// ============================================================================
// EXERCISE 4 — Amani
// Digitised from your "Exercise 2" slide deck, Case 2.
// ============================================================================

const EXERCISE_4 = {
    id: 'imnci-ex4-amani',
    order: 4,
    title: 'Exercise 4 — Cough and Diarrhoea: Amani, 3 years',
    titleAr: 'التمرين ٤ — السعال والإسهال: أماني، ٣ سنوات',
    subCourse: ONLINE_SUB_COURSE,
    passMark: 80,
    estimatedMinutes: 18,
    narrative: [
        'Amani Omer Ahmed is 3 years old (36 months). She weighs 10 kg, is 80 cm tall, and her temperature is 37 °C. This is her initial visit.',
        'Her mother came today because Amani has diarrhoea. She has also had a cough for two days.',
        'General danger signs: she is able to drink and does not vomit everything. Her mother reports that she DID have convulsions during this illness. She is not convulsing now and is not lethargic or unconscious.',
        'You count 36 breaths per minute. There is no chest indrawing, no wheeze and no stridor.',
        'She has had diarrhoea for 2 days with no blood in the stool. She is not restless or irritable, her eyes ARE sunken, she DOES drink eagerly, and her skin pinch goes back immediately.',
    ],
    expected: withDefaults({
        sections: ['danger', 'cough', 'diarrhea'],
        patientData: {
            childName: 'Amani Omer Ahmed', sex: 'female', ageMonths: 36,
            weightKg: 10, lengthCm: 80, tempC: 37, visitType: 'initial',
        },
        assessments: {
            notAbleToDrink: false, vomitsEverything: false, historyOfConvulsions: true,
            lethargicUnconscious: false, convulsingNow: false,
            hasCough: true, coughDays: 2, breathRate: 36, fastBreathing: false,
            chestIndrawing: false, stridor: false, wheeze: false,
            hasDiarrhea: true, diarrheaDays: 2, bloodInStool: false,
            lethargic: false, restlessIrritable: false, sunkenEyes: true,
            drinkPoorly: false, drinkEagerly: true,
            pinchVerySlow: false, pinchSlow: false,
        },
        classifyOptions: {
            danger: CLASSIFY_OPTIONS.danger,
            cough: CLASSIFY_OPTIONS.cough,
            diarrhea: CLASSIFY_OPTIONS.diarrhea,
        },
        classifications: {
            danger: ['imci.classifications.danger_sign'],
            cough: ['imci.classifications.severe_pneumonia'],
            diarrhea: ['imci.classifications.some_dehydration'],
        },
        includeTreatment: true,
        treatments: {
            danger: ['d_first_dose', 'd_sugar', 'd_refer'],
            cough: ['c_first_dose', 'c_sugar', 'c_refer'],
            diarrhea: ['dr_ors_on_way', 'dr_refer'],
        },
    }),
    explain:
        'The teaching point: 36 breaths per minute is NOT fast breathing for a child 12 months to 5 years (the ' +
        'cut-off is 40), and there is no indrawing, wheeze or stridor — yet the convulsion during this illness ' +
        'is a general danger sign, so the classification is SEVERE PNEUMONIA OR VERY SEVERE DISEASE. Sunken ' +
        'eyes + drinks eagerly = two signs = SOME DEHYDRATION. Amani needs urgent referral, with the mother ' +
        'giving frequent sips of ORS on the way.',
};

// ============================================================================
// EXERCISE 5 — Mohamoud: malnutrition, anaemia and the feeding assessment
//
// Built from the "Exercise 8 — Malnutrition, Anaemia" deck (the Mohamoud
// follow-up case and the feeding-assessment box). This is the worked example of
// an exercise that DOES include the mother-card feeding row.
//
// The deck's multiple-choice items (MUAC 112 mm, RUTF amounts, plot
// weight-for-height, the true/false feeding statements) are not represented
// here — the current engine is one-case-one-form, with no quiz format.
// ============================================================================

const EXERCISE_5 = {
    id: 'imnci-ex5-mohamoud',
    order: 5,
    title: 'Exercise 5 — Malnutrition and Feeding: Mohamoud, 18 months',
    titleAr: 'التمرين ٥ — سوء التغذية والتغذية: محمود، ١٨ شهراً',
    subCourse: ONLINE_SUB_COURSE,
    passMark: 80,
    estimatedMinutes: 20,
    draft: true,
    narrative: [
        'Mohamoud is an 18-month-old boy. He weighs 8.5 kg, is 78 cm long, and his temperature is 37.0 °C. This is a follow-up visit.',
        'General danger signs: he is able to drink, does not vomit everything, has had no convulsions, is not convulsing now, and is not lethargic or unconscious.',
        'He has no cough. His diarrhoea has settled since his last visit five days ago.',
        'He has no palmar pallor. There is no oedema of both feet. His MUAC measures 11.8 cm.',
        'Feeding: he takes 3 meals a day — gorassa with rice and beans, bananas, plus coffee. Nothing between meals. No milk. His mother stopped breastfeeding 3 months ago.',
        'He is under 2 years old, so his feeding must be assessed.',
    ],
    expected: withDefaults({
        sections: ['danger', 'cough', 'diarrhea', 'anemia', 'malnutrition', 'feeding'],
        patientData: {
            childName: 'Mohamoud', sex: 'male', ageMonths: 18,
            weightKg: 8.5, lengthCm: 78, tempC: 37, visitType: 'followup',
        },
        assessments: {
            notAbleToDrink: false, vomitsEverything: false, historyOfConvulsions: false,
            lethargicUnconscious: false, convulsingNow: false,
            hasCough: false,
            hasDiarrhea: false,
            pallor: 'noPallor',
            edema: false,
            muacCm: 11.8,
            feed_ageLess2: true,
            feedingStatus: 'problem',
        },
        classifications: {
            danger: ['no_danger_sign'],
            anemia: ['imci.classifications.no_anemia'],
            malnutrition: ['imci.classifications.mam'],
            feeding: ['imci.classifications.feeding_problem'],
        },
        includeTreatment: true,
        treatments: {
            danger: [],
            anemia: [],
            malnutrition: ['mn_supplementary', 'mn_assess_feeding', 'mn_followup_7'],
            feeding: ['fd_counsel', 'fd_extra_meals', 'fd_followup_7'],
        },
    }),
    explain:
        'MUAC 11.8 cm (118 mm) with no oedema and no complications is MODERATE ACUTE MALNUTRITION. No palmar ' +
        'pallor means NO ANAEMIA. Because he is under 2 years old his feeding must be assessed, and it shows a ' +
        'problem: only 3 meals a day, nothing between meals, no milk, and breastfeeding stopped at 15 months. ' +
        'Counsel the mother using the mother card — add 2 extra feeds a day, gorassa with beans mashed in oil, ' +
        'plus banana, dates, eggs or milk when available — and follow up in 7 days.',
};

// ============================================================================
//  REGISTRY — add every new exercise here.
//  `order` controls the display position; position in this array does not.
//  Each exercise is one case, opened, solved and scored on its own.
// ============================================================================

export const EXERCISES = [
    EXERCISE_1,
    EXERCISE_2,
    EXERCISE_3,
    EXERCISE_4,
    EXERCISE_5,
];

// ---------------------------------------------------------------------------
// Helpers used by the engine — you should not need to touch these.
// ---------------------------------------------------------------------------

export const getExercisesForSubCourse = (subCourse, { includeDrafts = false } = {}) =>
    EXERCISES
        .filter(e => e.subCourse === subCourse && (includeDrafts || !e.draft))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

export const getExerciseById = (id) => EXERCISES.find(e => e.id === id) || null;
