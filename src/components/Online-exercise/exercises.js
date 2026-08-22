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


// ---------------------------------------------------------------------------
// YOUNG INFANT (up to 2 months). The infant form has its own sections,
// classifications and treatments — none of the child banks apply.
// ---------------------------------------------------------------------------

export const INFANT_SECTIONS = ['infection', 'jaundice', 'diarrhea', 'feeding', 'breast', 'vaccine', 'other'];

export const INFANT_SECTION_LABELS = {
    infection: 'Very severe disease / bacterial infection',
    jaundice: 'Jaundice',
    diarrhea: 'Diarrhoea',
    feeding: 'Feeding problem or low weight',
    breast: 'Assess breastfeeding',
    vaccine: 'Immunisation',
    other: 'Other problems',
};

export const INFANT_CLASSIFY_OPTIONS = {
    infection: [
        { id: 'imci.classifications.possible_severe_bacterial_infection' },
        { id: 'imci.classifications.local_bacterial_infection' },
        { id: 'no_infection', label: 'No bacterial infection', labelAr: 'لا يوجد التهاب بكتيري' },
    ],
    jaundice: [
        { id: 'imci.classifications.severe_jaundice' },
        { id: 'imci.classifications.jaundice' },
        { id: 'no_jaundice', label: 'No jaundice', labelAr: 'لا يوجد يرقان' },
    ],
    diarrhea: [
        { id: 'imci.classifications.severe_dehydration' },
        { id: 'imci.classifications.some_dehydration' },
        { id: 'imci.classifications.no_dehydration' },
        { id: 'no_diarrhoea', label: 'No diarrhoea', labelAr: 'لا يوجد إسهال' },
    ],
    feeding: [
        { id: 'imci.classifications.feeding_problem_low_weight' },
        { id: 'imci.classifications.no_feeding_problem' },
    ],
    breast: [
        { id: 'bf_good', label: 'No breastfeeding problem' },
        { id: 'bf_problem', label: 'Breastfeeding problem — position, attachment or sucking' },
    ],
    vaccine: [
        { id: 'imci.classifications.fully_vaccinated' },
        { id: 'imci.classifications.partially_vaccinated' },
        { id: 'imci.classifications.not_vaccinated' },
    ],
    other: [],
};

export const INFANT_TREATMENT_OPTIONS = {
    infection: [
        { id: 'i_local_abx',  label: 'Give an appropriate oral antibiotic' },
        { id: 'i_teach_skin', label: 'Teach the mother to treat local infections at home' },
        { id: 'i_followup_2', label: 'Follow up in 2 days' },
        { id: 'i_first_dose', label: 'Give first dose of intramuscular antibiotics' },
        { id: 'i_sugar',      label: 'Treat to prevent low blood sugar' },
        { id: 'i_warm',       label: 'Advise the mother how to keep the infant warm on the way' },
        { id: 'i_refer',      label: 'Refer URGENTLY to hospital' },
    ],
    jaundice: [
        { id: 'j_advise_return', label: 'Advise the mother when to return immediately' },
        { id: 'j_followup_1',    label: 'Follow up in 1 day' },
        { id: 'j_sunlight',      label: 'Advise the mother to keep the infant warm' },
        { id: 'j_sugar',         label: 'Treat to prevent low blood sugar' },
        { id: 'j_refer',         label: 'Refer URGENTLY to hospital' },
    ],
    diarrhea: [
        { id: 'id_planA', label: 'Plan A: treat diarrhoea at home' },
        { id: 'id_planB', label: 'Plan B: treat some dehydration with ORS' },
        { id: 'id_planC', label: 'Plan C: treat severe dehydration quickly' },
        { id: 'id_refer', label: 'Refer URGENTLY to hospital' },
        { id: 'id_none',  label: 'No treatment needed — the infant has no diarrhoea' },
    ],
    feeding: [
        { id: 'f_continue_bf', label: 'Advise the mother to continue breastfeeding on demand' },
        { id: 'f_home_care',   label: 'Advise home care for the young infant' },
        { id: 'f_counsel',     label: 'Counsel the mother about a feeding problem' },
        { id: 'f_thrush',      label: 'Treat thrush' },
        { id: 'f_followup_2',  label: 'Follow up any feeding problem in 2 days' },
    ],
    breast: [
        { id: 'b_teach_position', label: 'Teach correct positioning and attachment' },
        { id: 'b_followup_2',     label: 'Follow up in 2 days' },
        { id: 'b_none',           label: 'No action needed' },
    ],
    vaccine: [
        { id: 'v_give_due',  label: 'Give the vaccines due today' },
        { id: 'v_next_date', label: 'Tell the mother the date of the next immunisation' },
    ],
    other: [],
};

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
// EXERCISE 6 — Malnutrition and Anaemia: knowledge check
// From the "Exercise 7 / Exercise 8" decks (the circle-the-best-answer slides).
// kind: 'quiz' renders a question page instead of a recording form.
// ============================================================================

const EXERCISE_6 = {
    id: 'imnci-ex6-malnutrition-quiz',
    kind: 'quiz',
    order: 6,
    title: 'Exercise 6 — Malnutrition and Anaemia: Knowledge Check',
    titleAr: 'التمرين ٦ — سوء التغذية وفقر الدم: اختبار المعرفة',
    subCourse: ONLINE_SUB_COURSE,
    passMark: 80,
    estimatedMinutes: 12,
    draft: true,
    narrative: [
        'Answer each question. Some ask you to choose the best answer; others ask you to type a short answer.',
        'Check your answers when you have finished — you will see the correct answer and the reason for each one.',
    ],
    questions: [
        {
            id: 'q1', type: 'mcq',
            question: 'When is it necessary to check a child for malnutrition and anaemia?',
            options: [
                'Check if the child appears low weight for age',
                'Check every child for malnutrition and anaemia, as sometimes problems go unnoticed',
                'Check if the caregiver tells you about a feeding problem',
            ],
            correct: [1],
            explain: 'Every sick child is checked. Waiting for the child to look thin or for the mother to raise it means missing children who are already at risk.',
        },
        {
            id: 'q2', type: 'mcq',
            question: 'Sami has a MUAC measurement of 112 mm. What does this tell you?',
            options: [
                'Sami is healthy',
                '112 mm is low weight, so you will advise on feeding recommendations',
                'Sami is showing a sign of severe acute malnutrition',
            ],
            correct: [2],
            explain: 'MUAC below 115 mm is a sign of severe acute malnutrition. Between 115 and 125 mm is moderate acute malnutrition.',
        },
        {
            id: 'q3', type: 'mcq',
            question: 'A child with anaemia needs:',
            options: ['Vitamin A', 'Iron', 'Glucose'],
            correct: [1],
            explain: 'Iron. Add an oral antimalarial if the malaria test is positive, and mebendazole if the child is older than one year.',
        },
        {
            id: 'q4', type: 'mcq',
            question: 'Ali shows oedema in both feet. What are your actions?',
            options: [
                'Sit Ali down and elevate his legs, to drain the swelling',
                "Advise his mother to cut down the salt and fat in the child's diet",
                'Refer urgently, as this is a sign of severe malnutrition',
            ],
            correct: [2],
            explain: 'Oedema of both feet is a sign of severe acute malnutrition and needs urgent referral, whatever the weight or MUAC.',
        },
        {
            id: 'q5', type: 'mcq',
            question: 'What is palmar pallor?',
            options: ['A sign of anaemia', 'A sign of local infection', 'A sign of severe wasting'],
            correct: [0],
            explain: 'Palmar pallor is unusual paleness of the skin of the palms, and it is the IMNCI sign for anaemia.',
        },
        {
            id: 'q6', type: 'mcq',
            question: 'Which of the following is an important measurement of wasting?',
            options: ['Weight-for-age', 'Percentage weight gain since the last visit', 'Weight-for-height (or length)'],
            correct: [2],
            explain: 'Weight-for-height (or length) measures wasting. Weight-for-age mixes wasting and stunting together and cannot separate them.',
        },
        {
            id: 'q7', type: 'text',
            question: 'SEVERE PALMAR PALLOR is treated with — what?',
            correct: 'refer urgently',
            accept: ['refer', 'urgent referral', 'refer urgently to hospital', 'referral'],
            placeholder: 'Type your answer',
            explain: 'Severe palmar pallor is classified as SEVERE ANAEMIA and needs urgent referral to hospital.',
        },
        {
            id: 'q8', type: 'text',
            question: 'A child with SEVERE UNCOMPLICATED MALNUTRITION should return for follow-up in how many days?',
            correct: '7',
            accept: ['7 days', 'seven', 'seven days', '7days'],
            placeholder: 'Number of days',
            explain: 'Follow up in 7 days, while the child continues RUTF at home.',
        },
        {
            id: 'q9', type: 'tf',
            question: 'True or false: children should be given fewer feedings during illness.',
            correct: false,
            explain: 'False. A sick child needs MORE frequent feeding, and extra food for two weeks after the illness to regain lost weight.',
        },
        {
            id: 'q10', type: 'tf',
            question: 'True or false: a 3-month-old child should be exclusively breastfed.',
            correct: true,
            explain: 'True. Exclusive breastfeeding is recommended up to 6 months — no other food or fluid, not even water.',
        },
        {
            id: 'q11', type: 'tf',
            question: 'True or false: a very thin cereal gruel is a nutritious complementary food.',
            correct: false,
            explain: 'False. A thin gruel is mostly water. Complementary food should be thick enough to stay on a spoon, and enriched with oil, beans, eggs or milk.',
        },
        {
            id: 'q12', type: 'tf',
            question: 'True or false: a 3-year-old needs 5 feedings each day of family foods or other nutritious foods.',
            correct: true,
            explain: 'True — three meals plus two nutritious snacks each day.',
        },
        {
            id: 'q13', type: 'mcq',
            question: "Which sick children need a feeding assessment?",
            options: [
                'Only children whose mothers report a feeding problem',
                'Children with moderate acute malnutrition OR anaemia OR under 2 years of age',
                'Every sick child, at every visit',
                'Only children being referred to hospital',
            ],
            correct: [1],
            explain: "This is the rule printed on the recording form: assess the child's feeding if the child has MODERATE ACUTE MALNUTRITION, or ANAEMIA, or is LESS THAN 2 YEARS OLD.",
        },
    ],
    explain:
        'Remember the two measurements: MUAC under 115 mm, or oedema of both feet, means severe acute malnutrition ' +
        'and urgent referral. MUAC 115–125 mm is moderate acute malnutrition, treated with feeding counselling and ' +
        'follow-up in 7 days.',
};

// ============================================================================
// EXERCISE 7 — Mariam, sick young infant
// Digitised from the "Exercise 8 / Exercise 9 SYI" decks.
//
// formType: 'infant' opens the YOUNG INFANT recording form (up to 2 months),
// not the sick child form. Its sections are different: infection, jaundice,
// diarrhea, feeding, breast, vaccine, other.
// ============================================================================

const EXERCISE_7 = {
    id: 'imnci-ex7-mariam',
    formType: 'infant',
    order: 7,
    title: 'Exercise 7 — Sick Young Infant: Mariam, 5 weeks',
    titleAr: 'التمرين ٧ — الرضيع الصغير المريض: مريم، ٥ أسابيع',
    subCourse: ONLINE_SUB_COURSE,
    passMark: 80,
    estimatedMinutes: 20,
    draft: true,
    narrative: [
        'Mariam is 5 weeks old. She weighs 4 kg and her axillary temperature is 37 °C. Her mother brought her to the clinic because she has a skin rash.',
        'Signs of very severe disease: her mother says there were no convulsions, she is feeding normally and moving normally.',
        'Mariam’s breathing rate is 55 per minute. She has no chest indrawing.',
        'There is no pus draining from her eyes and her umbilicus is normal.',
        'The health worker examines her entire body and finds a red rash with just a few skin pustules on her buttocks.',
        'She is awake. She has jaundice — the mother says it started on the third day of life, and it does not extend to the palms or soles.',
        'She does not have diarrhoea.',
        'The mother says Mariam has no difficulty feeding: she breastfeeds 9 or 10 times in 24 hours and drinks no other fluids. Her weight for age is normal, so the health worker decides there is no need to assess breastfeeding.',
        'Her immunisation card shows BCG and OPV 0 given at birth in hospital. The mother says there are no other problems.',
    ],
    expected: {
        sections: ['infection', 'jaundice', 'diarrhea', 'feeding'],
        patientData: {
            childName: 'Mariam',
            ageDaysWeeks: '5 weeks',
            weightKg: 4,
            tempC: 37,
            visitType: 'initial',
        },
        assessments: {
            notFeedingWell: false,
            convulsions: false,
            convulsingNow: false,
            movementOnlyStimulatedNoMovement: false,
            breathRate: 55,
            fastBreathing: false,
            severeChestIndrawing: false,
            fever38: false,
            lowTemp35_5: false,
            umbilicusRedDraining: false,
            pusFromEyes: false,
            skinPustules: true,
            hasJaundice: 'yes',
            jaundiceFirst24h: false,
            jaundiceSolesPalms: false,
            hasDiarrhea: 'no',
            diffFeeding: 'no',
            breastfed: 'yes',
            breastfeedTimes: 9,
            otherFoods: 'no',
            weightForAgeLow: false,
            thrush: false,
        },
        classifyOptions: INFANT_CLASSIFY_OPTIONS,
        classifications: {
            infection: ['imci.classifications.local_bacterial_infection'],
            jaundice: ['imci.classifications.jaundice'],
            diarrhea: ['no_diarrhoea'],
            feeding: ['imci.classifications.no_feeding_problem'],
        },
        includeTreatment: true,
        treatmentOptions: INFANT_TREATMENT_OPTIONS,
        treatments: {
            infection: ['i_local_abx', 'i_teach_skin', 'i_followup_2'],
            jaundice: ['j_advise_return', 'j_followup_1'],
            diarrhea: ['id_none'],
            feeding: ['f_continue_bf', 'f_home_care'],
        },
    },
    explain:
        'A few skin pustules with no other sign of very severe disease is LOCAL BACTERIAL INFECTION — treated at ' +
        'the clinic, not referred. Jaundice that started after 24 hours of age and does not reach the palms or ' +
        'soles is JAUNDICE (yellow), not severe jaundice: advise when to return immediately and follow up in 1 day. ' +
        'Breathing at 55 per minute is normal for a young infant (fast breathing is 60 or more). Breastfeeding 9 to ' +
        '10 times in 24 hours with normal weight for age means NO FEEDING PROBLEM, so breastfeeding does not need ' +
        'to be assessed.',
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
    EXERCISE_6,
    EXERCISE_7,
];

// ---------------------------------------------------------------------------
// Helpers used by the engine — you should not need to touch these.
// ---------------------------------------------------------------------------

export const getExercisesForSubCourse = (subCourse, { includeDrafts = false } = {}) =>
    EXERCISES
        .filter(e => e.subCourse === subCourse && (includeDrafts || !e.draft))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

export const getExerciseById = (id) => EXERCISES.find(e => e.id === id) || null;
