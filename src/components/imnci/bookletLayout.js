// ============================================================================
// HOW THE NATIONAL CHART BOOKLET LAYS OUT EACH PAGE
//
// Protocol management shows the saved protocol the way the booklet prints it:
// a page title, the question in the box ("Does the child have cough?"), the
// ASK / LOOK column, then the coloured SIGNS | CLASSIFY | IDENTIFY TREATMENT
// table. The rules decide what the form classifies; this file only holds the
// booklet's printed words around them.
//
// BOOKLET_SIGNS is the SIGNS column for each national rule, by rule id. The
// national protocol copies it onto its rules (rule.signs), so the words are
// saved with the protocol and can be edited there.
// ============================================================================

export const BOOKLET_SIGNS = {
    // --- Sick child ---------------------------------------------------------
    danger_convulsing_now: ['Convulsing now'],
    danger_sign: ['Not able to drink or breastfeed', 'or Vomits everything', 'or Has had convulsions', 'or Lethargic or unconscious'],
    severe_pneumonia: ['Any general danger sign', 'or Stridor in a calm child'],
    pneumonia: ['Chest indrawing', 'or Fast breathing'],
    cough_or_cold: ['No signs of pneumonia or very severe disease'],
    severe_dehydration: ['Two of the following signs:', '• Lethargic or unconscious', '• Sunken eyes', '• Not able to drink or drinking poorly', '• Skin pinch goes back very slowly'],
    some_dehydration: ['Two of the following signs:', '• Restless, irritable', '• Sunken eyes', '• Drinks eagerly, thirsty', '• Skin pinch goes back slowly'],
    no_dehydration: ['Not enough signs to classify as severe or some dehydration'],
    severe_persistent_diarrhea: ['Diarrhoea for 14 days or more', 'and Dehydration present'],
    persistent_diarrhea: ['Diarrhoea for 14 days or more', 'and No dehydration'],
    dysentery: ['Blood in the stool'],
    very_severe_febrile_disease: ['Any general danger sign', 'or Stiff neck'],
    malaria: ['Positive malaria test (falciparum or vivax)'],
    fever_no_malaria: ['Negative malaria test'],
    severe_complicated_measles: ['Any general danger sign', 'or Clouding of the cornea', 'or Deep or extensive mouth ulcers'],
    measles_eye_mouth: ['Pus draining from the eye', 'or Mouth ulcers'],
    measles: ['Measles now or within the last 3 months'],
    mastoiditis: ['Tender swelling behind the ear'],
    acute_ear_infection: ['Ear pain', 'or Pus seen draining from the ear and discharge reported for less than 14 days'],
    chronic_ear_infection: ['Pus seen draining from the ear and discharge reported for 14 days or more'],
    no_ear_infection: ['No ear pain and no pus seen draining from the ear'],
    complicated_sam: ['Oedema of both feet', 'OR WFH/L less than -3 z-scores or MUAC less than 11.5 cm with any of:', '• Medical complication present', '• Not able to finish RUTF portion'],
    uncomplicated_sam: ['WFH/L less than -3 z-scores', 'OR MUAC less than 11.5 cm', 'AND Able to finish RUTF portion and no medical complication'],
    moderate_acute_malnutrition: ['WFH/L -3 up to -2 z-scores', 'OR MUAC 11.5 up to 12.5 cm'],
    no_acute_malnutrition: ['WFH/L -2 z-scores or more', 'OR MUAC 12.5 cm or more'],
    severe_anemia: ['Severe palmar pallor'],
    anemia: ['Some palmar pallor'],
    no_anemia: ['No palmar pallor'],

    // --- Young infant -------------------------------------------------------
    possible_serious_bacterial_infection: ['Any of the following signs:', '• Not able to feed or not feeding well', '• Convulsions', '• Movement only when stimulated or no movement at all', '• Fast breathing (60 breaths per minute or more)', '• Severe chest indrawing', '• Fever (37.5 °C or above)', '• Low body temperature (less than 35.5 °C)'],
    local_bacterial_infection: ['Umbilicus red or draining pus', 'or Skin pustules', 'or Pus draining from the eye'],
    bacterial_infection_unlikely: ['None of the signs of very severe disease or local bacterial infection'],
    severe_jaundice: ['Any jaundice if age less than 24 hours', 'or Yellow palms and soles at any age', 'or Jaundice in an infant weighing less than 2.5 kg'],
    jaundice: ['Jaundice appearing after 24 hours of age', 'and Palms and soles not yellow'],
    no_jaundice: ['No jaundice'],
    infant_severe_dehydration: ['Two of the following signs:', '• Movement only when stimulated or no movement at all', '• Sunken eyes', '• Skin pinch goes back very slowly'],
    infant_some_dehydration: ['Two of the following signs:', '• Restless, irritable', '• Sunken eyes', '• Skin pinch goes back slowly'],
    infant_no_dehydration: ['Not enough signs to classify as some or severe dehydration'],
    infant_severe_persistent_diarrhea: ['Diarrhoea lasting 14 days or more'],
    infant_blood_in_stool: ['Blood in the stool'],
    feeding_problem_or_low_weight: ['Feeding difficulty', 'or Less than 8 breastfeeds in 24 hours', 'or Receives other foods or drinks', 'or Low weight for age', 'or Thrush (ulcers or white patches in mouth)', 'or Not well positioned', 'or Not well attached to the breast', 'or Not suckling effectively'],
    no_feeding_problem: ['Not low weight for age and no other signs of inadequate feeding'],
};

// One booklet page: the boxes printed together, in order. `categories` are the
// protocol tables shown on that page; any saved table not listed here is shown
// after the booklet pages, so a table added by hand is never hidden.
export const BOOKLET_PAGES = {
    child: [
        {
            id: 'danger',
            title: 'Check for general danger signs',
            ask: ['Is the child not able to drink or breastfeed?', 'Does the child vomit everything?', 'Has the child had convulsions?'],
            look: ['See if the child is lethargic or unconscious', 'Is the child convulsing now?'],
            note: 'A child with any general danger sign needs URGENT attention; complete the assessment and any pre-referral treatment immediately so referral is not delayed.',
            categories: ['danger'],
        },
        {
            id: 'cough',
            title: 'Assess and classify for cough or difficult breathing',
            question: 'Does the child have cough or difficult breathing?',
            ask: ['For how long?'],
            look: ['Count the breaths in one minute', 'Look for chest indrawing', 'Look and listen for stridor', 'Look and listen for wheeze', '(The child must be calm)'],
            note: 'Fast breathing is 50 breaths per minute or more from 2 up to 12 months, and 40 or more from 12 months up to 5 years.',
            categories: ['cough'],
        },
        {
            id: 'diarrhea',
            title: 'Assess and classify for diarrhoea',
            question: 'Does the child have diarrhoea?',
            ask: ['For how long?', 'Is there blood in the stool?'],
            look: ['Look at the general condition: lethargic or unconscious? restless and irritable?', 'Look for sunken eyes', 'Offer fluid: not able to drink or drinking poorly? drinking eagerly, thirsty?', 'Pinch the skin of the abdomen: does it go back very slowly (more than 2 seconds) or slowly?'],
            categories: ['diarrhea', 'persistent_diarrhea', 'dysentery'],
            sideLabels: { diarrhea: 'for dehydration', persistent_diarrhea: 'if diarrhoea 14 days or more', dysentery: 'if blood in stool' },
        },
        {
            id: 'fever',
            title: 'Assess and classify fever',
            question: 'Does the child have fever? (by history, feels hot, or temperature 37.5 °C or above)',
            ask: ['For how long?', 'If more than 7 days, has fever been present every day?', 'Has the child had measles within the last three months?'],
            look: ['Look or feel for stiff neck', 'Look for generalized rash of measles', 'Do a malaria test in all fever cases', 'If measles now or within 3 months: look for mouth ulcers (deep and extensive?), pus draining from the eye, clouding of the cornea'],
            note: 'Temperatures are axillary. Rectal readings are about 0.5 °C higher.',
            categories: ['fever', 'measles'],
            sideLabels: { measles: 'if measles now or within the last 3 months' },
        },
        {
            id: 'ear',
            title: 'Assess and classify for ear problem',
            question: 'Does the child have an ear problem?',
            ask: ['Is there ear pain?', 'Is there ear discharge? If yes, for how long?'],
            look: ['Look for pus draining from the ear', 'Feel for tender swelling behind the ear'],
            categories: ['ear'],
        },
        {
            id: 'malnutrition',
            title: 'Then check for acute malnutrition',
            look: ['Look for oedema of both feet', 'Determine WFH/L z-score', 'Measure MUAC in a child 6 months or older', 'If WFH/L less than -3 z or MUAC less than 11.5 cm: check for any medical complication, and if none, do the appetite test (6 months or older)'],
            note: 'WFH/L is weight-for-height or length, from the WHO growth standards. RUTF is ready-to-use therapeutic food.',
            categories: ['malnutrition'],
        },
        {
            id: 'anemia',
            title: 'Then check for anaemia',
            look: ['Look for palmar pallor. Is it severe palmar pallor, some palmar pallor, or no palmar pallor?'],
            note: 'Assess for sickle cell anaemia if common in your area and do not give iron. Do not give iron to a child with SAM receiving RUTF.',
            categories: ['anemia'],
        },
    ],
    infant: [
        {
            id: 'bacterial_infection',
            title: 'Check for very severe disease and local bacterial infection',
            ask: ['Is the infant not able to feed or not feeding well?', 'Has the infant had convulsions?'],
            look: ['Is the infant convulsing now?', 'Look at the movements: no movement at all, or moving only when stimulated?', 'Count the breaths in one minute; repeat if 60 or more', 'Look for severe chest indrawing', 'Measure axillary temperature', 'Look at the umbilicus: red or draining pus?', 'Look for skin pustules', 'Look for pus draining from the eyes'],
            note: 'Temperatures are axillary. Rectal readings are about 0.5 °C higher.',
            categories: ['bacterial_infection'],
        },
        {
            id: 'jaundice',
            title: 'Then check for jaundice',
            ask: ['Does the infant have jaundice? If yes, when did it appear?'],
            look: ['Is the infant weighing less than 2.5 kg and has jaundice in any part of the body?', 'Look at the palms and soles: are they yellow?'],
            categories: ['jaundice'],
        },
        {
            id: 'diarrhea',
            title: 'Assess and classify for diarrhoea',
            question: 'Does the young infant have diarrhoea?',
            ask: ['For how long?', 'Is there blood in the stool?'],
            look: ['Look at the general condition: movement only when stimulated or no movement at all? restless or irritable?', 'Look for sunken eyes', 'Pinch the skin of the abdomen: does it go back very slowly (longer than 2 seconds) or slowly?'],
            note: 'A young infant has diarrhoea if the stools have changed from the usual pattern and are many and watery. The frequent or semi-solid stools of a breastfed baby are not diarrhoea.',
            categories: ['diarrhea', 'persistent_diarrhea', 'dysentery'],
            sideLabels: { diarrhea: 'for dehydration', persistent_diarrhea: 'if diarrhoea 14 days or more', dysentery: 'if blood in stool' },
        },
        {
            id: 'feeding_problem',
            title: 'Then check for feeding problem or low weight',
            ask: ['Does the infant have feeding difficulty?', 'Is the infant breastfed? If yes, how many times in 24 hours?', 'Does the infant usually receive any other foods or drinks? If yes, how often, and what is used to feed the infant?'],
            look: ['Determine weight for age', 'Look for ulcers or white patches in the mouth (thrush)', 'Assess breastfeeding: is the infant well positioned, well attached, suckling effectively?'],
            categories: ['feeding_problem'],
        },
    ],
};

// Plain words for a condition when a rule has no booklet signs of its own
// (a rule written by hand in the editor).
export const conditionText = (key) => String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\s(.)/g, (m) => m.toLowerCase());

/** The SIGNS column for one rule: its saved booklet words, or its conditions. */
export const ruleSigns = (rule) => {
    if (Array.isArray(rule.signs) && rule.signs.some((s) => String(s).trim())) return rule.signs.filter((s) => String(s).trim());
    // A national rule saved before the signs were added still reads as printed.
    if (BOOKLET_SIGNS[rule.id]) return BOOKLET_SIGNS[rule.id];
    const conds = (rule.conditions || []).map(conditionText);
    if (!conds.length) return [];
    if (rule.type === 'COUNT_GTE') return [`${rule.threshold || 2} of the following signs:`, ...conds.map((c) => `• ${c}`)];
    const joiner = rule.type === 'ALL' ? 'and' : 'or';
    return conds.map((c, i) => (i === 0 ? c : `${joiner} ${c}`));
};
