// ============================================================================
// SUDAN NATIONAL IMNCI PROTOCOL (built-in)
//
// Written box by box from the national chart booklet (Arabic edition, with the
// English 2023 adaptation used where the two agree; zinc tablets follow the
// English edition, which gives the WHO 10 mg / 20 mg doses). What Protocol
// management loads with "Load national protocol".
//
// Shape, as the engine (engine.js) reads it:
//   categories.<key> = one booklet table; the first matching rule wins.
//   rule.requires    = "only when": every one must be true (the table's question).
//   rule.conditions  = the signs in the box, combined by rule.type.
//   {{dose:<id>}}    = the dose from the matching Doses tab. One per line, at
//                      the end, so the form can show it as a dose badge.
//
// Ages are in months, weights in kg. Bands end at .99 so a weight such as
// 5.95 kg never falls between two rows.
// ============================================================================

import { BOOKLET_SIGNS } from './bookletLayout';
import { toArabic } from './nationalProtocolAr';

export const NATIONAL_PROTOCOL_VERSION = 'Sudan national IMNCI booklet (2026-10)';

const RED = 'bg-red-500';
const YELLOW = 'bg-yellow-400';
const GREEN = 'bg-green-500';

// rule.signs is the booklet's SIGNS column (bookletLayout.js), saved with the
// rule so Protocol management can show the page as the booklet prints it.
const rule = (id, type, conditions, label, color, treatments, extra = {}) => ({
    id, type, conditions, classification: { label, color }, treatments,
    ...(BOOKLET_SIGNS[id] ? { signs: [...BOOKLET_SIGNS[id]] } : {}), ...extra,
});

const band = (minAge, maxAge, minWeight, maxWeight, doseQty, doseFreq, doseDuration) => ({
    minAge, maxAge, minWeight, maxWeight, doseQty, doseFreq, doseDuration,
});

// Common lines, so the same advice reads the same in every box.
const RETURN_NOW = 'Advise the mother when to return immediately';
const LOW_SUGAR = 'Treat the child to prevent low blood sugar';
const REFER = 'Refer URGENTLY to hospital';
const ORAL_AB_FIRST = 'First dose of antibiotic if the child can take oral medicine — oral amoxicillin: {{dose:amoxicillin}}';
const IM_AMP_FIRST = 'If the child cannot drink, vomits everything, is convulsing or lethargic — first dose of IM ampicillin: {{dose:ampicillin}}';
const IM_GENT_FIRST = 'and first dose of IM gentamicin: {{dose:gentamycin}}';
const FEED_UNDER_2 = 'If the child is less than 2 years old, assess feeding and counsel the mother on the feeding recommendations';
const PARACETAMOL_HIGH_FEVER = 'Give one dose of paracetamol in clinic for high fever (38.5 °C or above): {{dose:paracetamol}}';
const BACTERIAL_CAUSE = 'Give an appropriate antibiotic for any bacterial cause of fever found';
const FEVER_7_DAYS = 'If fever has been present every day for more than 7 days, refer for assessment';
const ORS_ON_WAY = 'refer URGENTLY to hospital with the mother giving frequent sips of ORS on the way';
const INFANT_WARM = 'Advise the mother how to keep the infant warm on the way to the hospital';
const INFANT_HOME_CARE = 'Advise the mother to give home care for the young infant';
const INFANT_LOW_SUGAR = 'Treat the young infant to prevent low blood sugar';

// ----------------------------------------------------------------------------
// SICK CHILD, 2 MONTHS UP TO 5 YEARS
// ----------------------------------------------------------------------------
export const NATIONAL_CHILD_PROTOCOL = {
    formType: 'child',
    version: NATIONAL_PROTOCOL_VERSION,
    categories: {
        danger: {
            title: 'General danger signs',
            rules: [
                rule('danger_convulsing_now', 'ANY', ['convulsingNow'], 'General danger sign: convulsing now', RED, [
                    'Manage the airway, turn the child on the side, and give diazepam rectally: {{dose:diazepam}}',
                    'If convulsions have not stopped after 10 minutes, repeat the diazepam dose',
                    LOW_SUGAR,
                    'Complete the assessment and any pre-referral treatment immediately so referral is not delayed',
                    REFER,
                ]),
                rule('danger_sign', 'ANY', ['hasDangerSign'], 'General danger sign present', RED, [
                    'Complete the assessment and any pre-referral treatment immediately so referral is not delayed',
                    LOW_SUGAR,
                    REFER,
                ]),
            ],
        },
        cough: {
            title: 'Cough or difficult breathing',
            rules: [
                rule('severe_pneumonia', 'ANY', ['hasDangerSign', 'stridor'], 'Severe Pneumonia or Very Severe Disease', RED, [
                    ORAL_AB_FIRST, IM_AMP_FIRST, IM_GENT_FIRST,
                    'If wheezing, give a rapid-acting inhaled bronchodilator: {{dose:salbutamol_inhaler}}',
                    LOW_SUGAR,
                    REFER,
                ], { requires: ['hasCough'] }),
                rule('pneumonia', 'ANY', ['fastBreathing', 'chestIndrawing'], 'Pneumonia', YELLOW, [
                    'Give oral amoxicillin for 5 days: {{dose:amoxicillin}}',
                    'If wheezing (or wheeze went away after a rapid-acting bronchodilator), give an inhaled bronchodilator for 5 days: {{dose:salbutamol_inhaler}}',
                    'Only if no inhaler is available, give oral salbutamol for 5 days: {{dose:salbutamol_oral}}',
                    'Soothe the throat and relieve the cough with a safe remedy',
                    'If coughing for 14 days or more, or recurrent wheeze, refer for assessment',
                    RETURN_NOW,
                    'Follow up in 3 days',
                ], { requires: ['hasCough'] }),
                rule('cough_or_cold', 'ALL', ['hasCough'], 'Cough or Cold', GREEN, [
                    'If wheezing, give an inhaled bronchodilator for 5 days: {{dose:salbutamol_inhaler}}',
                    'Soothe the throat and relieve the cough with a safe remedy',
                    'If coughing for more than 14 days, refer for assessment',
                    RETURN_NOW,
                    'Follow up in 5 days if not improving',
                ]),
            ],
        },
        diarrhea: {
            title: 'Diarrhoea: dehydration',
            rules: [
                rule('severe_dehydration', 'ALL', ['severeDehydration'], 'Severe Dehydration', RED, [
                    'If the child has no other severe classification, give fluid for severe dehydration (Plan C): {{dose:plan_c_iv}}',
                    'and give zinc for 14 days: {{dose:zinc}}',
                    `If the child also has another severe classification, ${ORS_ON_WAY}`,
                    'Advise the mother to continue breastfeeding',
                    'If the child is 2 years or older and there is cholera in your area, give an antibiotic for cholera: {{dose:erythromycin}}',
                ], { requires: ['hasDiarrhea'] }),
                rule('some_dehydration', 'ALL', ['someDehydration'], 'Some Dehydration', YELLOW, [
                    'Give fluid and food for some dehydration (Plan B): {{dose:plan_b_ors}}',
                    'Give zinc for 14 days: {{dose:zinc}}',
                    `If the child also has a severe classification, ${ORS_ON_WAY}, and advise her to continue breastfeeding`,
                    RETURN_NOW,
                    'Follow up in 5 days if not improving',
                ], { requires: ['hasDiarrhea'] }),
                rule('no_dehydration', 'ALL', ['hasDiarrhea'], 'No Dehydration', GREEN, [
                    'Give fluid and food to treat diarrhoea at home (Plan A): {{dose:plan_a_ors}}',
                    'Give zinc for 14 days: {{dose:zinc}}',
                    RETURN_NOW,
                    'Follow up in 5 days if not improving',
                ]),
            ],
        },
        persistent_diarrhea: {
            title: 'Diarrhoea for 14 days or more',
            rules: [
                rule('severe_persistent_diarrhea', 'ALL', ['dehydrationPresent'], 'Severe Persistent Diarrhoea', RED, [
                    'Treat dehydration before referral unless the child has another severe classification',
                    'Refer to hospital',
                ], { requires: ['hasDiarrhea', 'diarrhea14Days'] }),
                rule('persistent_diarrhea', 'ALL', ['diarrhea14Days'], 'Persistent Diarrhoea', YELLOW, [
                    'Advise the mother on feeding a child who has persistent diarrhoea',
                    'Give zinc for 14 days: {{dose:zinc}}',
                    'Follow up in 5 days',
                ], { requires: ['hasDiarrhea'] }),
            ],
        },
        dysentery: {
            title: 'Blood in the stool',
            rules: [
                rule('dysentery', 'ALL', ['bloodInStool'], 'Dysentery', YELLOW, [
                    'Give oral ciprofloxacin for 3 days: {{dose:ciprofloxacin}}',
                    'Give zinc for 14 days: {{dose:zinc}}',
                    'Follow up in 3 days',
                ], { requires: ['hasDiarrhea'] }),
            ],
        },
        fever: {
            title: 'Fever',
            rules: [
                rule('very_severe_febrile_disease', 'ANY', ['hasDangerSign', 'neckStiffness'], 'Very Severe Febrile Disease', RED, [
                    'Give first dose of IM quinine: {{dose:quinine}}',
                    ORAL_AB_FIRST, IM_AMP_FIRST, IM_GENT_FIRST,
                    PARACETAMOL_HIGH_FEVER,
                    LOW_SUGAR,
                    REFER,
                ], { requires: ['hasFever'] }),
                rule('malaria', 'ALL', ['malariaTestPositive'], 'Malaria', YELLOW, [
                    'Give the first-line oral antimalarial, artemether-lumefantrine: {{dose:coartem}}',
                    'If P. vivax, give primaquine after the first-line treatment: {{dose:primaquine}}',
                    PARACETAMOL_HIGH_FEVER,
                    BACTERIAL_CAUSE,
                    RETURN_NOW,
                    'Follow up in 3 days if fever persists',
                    FEVER_7_DAYS,
                ], { requires: ['hasFever'] }),
                rule('fever_no_malaria', 'ALL', ['hasFever'], 'Fever - No Malaria', GREEN, [
                    'Assess for other causes of fever and treat accordingly',
                    PARACETAMOL_HIGH_FEVER,
                    BACTERIAL_CAUSE,
                    RETURN_NOW,
                    'Follow up in 3 days if fever persists',
                    FEVER_7_DAYS,
                ]),
            ],
        },
        measles: {
            title: 'Measles now or within the last 3 months',
            rules: [
                rule('severe_complicated_measles', 'ANY', ['hasDangerSign', 'corneaClouding', 'deepExtensiveUlcers'], 'Severe Complicated Measles', RED, [
                    'Give vitamin A treatment: {{dose:vitamin_a_treatment}}',
                    ORAL_AB_FIRST, IM_AMP_FIRST, IM_GENT_FIRST,
                    'If clouding of the cornea or pus draining from the eye, apply tetracycline eye ointment',
                    REFER,
                ], { requires: ['measlesNowOrRecent'] }),
                rule('measles_eye_mouth', 'ANY', ['pusFromEye', 'mouthUlcers'], 'Measles with Eye or Mouth Complications', YELLOW, [
                    'Give vitamin A treatment: {{dose:vitamin_a_treatment}}',
                    'If pus draining from the eye, treat the eye infection with tetracycline eye ointment',
                    'If mouth ulcers, treat with half-strength gentian violet (0.25%) twice daily',
                    'Advise the mother on feeding the child',
                    'Follow up in 3 days',
                ], { requires: ['measlesNowOrRecent'] }),
                rule('measles', 'ALL', ['measlesNowOrRecent'], 'Measles', GREEN, [
                    'Give vitamin A treatment: {{dose:vitamin_a_treatment}}',
                    'Advise the mother on feeding the child',
                ]),
            ],
        },
        ear: {
            title: 'Ear problem',
            rules: [
                rule('mastoiditis', 'ALL', ['tenderSwelling'], 'Mastoiditis', RED, [
                    ORAL_AB_FIRST, IM_AMP_FIRST, IM_GENT_FIRST,
                    'Give first dose of paracetamol for pain: {{dose:paracetamol}}',
                    REFER,
                ], { requires: ['hasEarProblem'] }),
                rule('acute_ear_infection', 'ANY', ['earPain', 'earDischargeAcute'], 'Acute Ear Infection', YELLOW, [
                    'Give oral amoxicillin for 5 days: {{dose:amoxicillin}}',
                    'Give paracetamol for pain: {{dose:paracetamol}}',
                    'Dry the ear by wicking',
                    'Follow up in 5 days',
                ], { requires: ['hasEarProblem'] }),
                rule('chronic_ear_infection', 'ALL', ['earDischargeChronic'], 'Chronic Ear Infection', YELLOW, [
                    'Dry the ear by wicking',
                    'After wicking, give ciprofloxacin ear drops 3 times daily for 14 days',
                    'Follow up in 5 days',
                    'Refer for assessment if there is a hearing problem',
                ], { requires: ['hasEarProblem'] }),
                rule('no_ear_infection', 'ALL', ['hasEarProblem'], 'No Ear Infection', GREEN, [
                    'No treatment needed',
                    'Refer for assessment if there is a hearing problem',
                    RETURN_NOW,
                ]),
            ],
        },
        malnutrition: {
            title: 'Acute malnutrition',
            rules: [
                rule('complicated_sam', 'ALL', ['samWithComplications'], 'Complicated Severe Acute Malnutrition', RED, [
                    ORAL_AB_FIRST, IM_AMP_FIRST, IM_GENT_FIRST,
                    LOW_SUGAR,
                    'Advise the mother to keep the child warm',
                    REFER,
                ]),
                rule('uncomplicated_sam', 'ALL', ['samWithoutComplications'], 'Uncomplicated Severe Acute Malnutrition', YELLOW, [
                    'Give oral amoxicillin for 5 days: {{dose:amoxicillin}}',
                    'If 6 months or older, refer to the outpatient therapeutic programme (OTP) and give RUTF: {{dose:rutf}}',
                    'Assess the child\'s feeding and counsel the mother on the feeding recommendations',
                    RETURN_NOW,
                    'Follow up in 14 days',
                ]),
                rule('moderate_acute_malnutrition', 'ALL', ['moderateAcuteMalnutrition'], 'Moderate Acute Malnutrition', YELLOW, [
                    'Refer the child to the supplementary feeding programme',
                    'Assess the child\'s feeding and counsel the mother on the feeding recommendations',
                    RETURN_NOW,
                    'Follow up in 30 days',
                ]),
                rule('no_acute_malnutrition', 'ALL', ['noMalnutrition'], 'No Acute Malnutrition', GREEN, [
                    FEED_UNDER_2,
                    'If there is a feeding problem, follow up in 7 days',
                ]),
            ],
        },
        anemia: {
            title: 'Anaemia',
            rules: [
                rule('severe_anemia', 'ALL', ['severePalmarPallor'], 'Severe Anaemia', RED, [REFER]),
                rule('anemia', 'ALL', ['somePalmarPallor'], 'Anaemia', YELLOW, [
                    'Give iron for 14 days, but not if sickle cell anaemia is known or suspected, or the child is on RUTF: {{dose:iron}}',
                    'If 1 year or older and no mebendazole in the last 6 months, give mebendazole: {{dose:mebendazole}}',
                    'Assess the child\'s feeding and counsel the mother on the feeding recommendations',
                    RETURN_NOW,
                    'Follow up in 14 days',
                ]),
                rule('no_anemia', 'ALL', ['noPalmarPallor'], 'No Anaemia', GREEN, [
                    FEED_UNDER_2,
                    'If there is a feeding problem, follow up in 7 days',
                ]),
            ],
        },
    },
};

// ----------------------------------------------------------------------------
// SICK YOUNG INFANT, UP TO 2 MONTHS
// ----------------------------------------------------------------------------
export const NATIONAL_INFANT_PROTOCOL = {
    formType: 'infant',
    version: NATIONAL_PROTOCOL_VERSION,
    categories: {
        bacterial_infection: {
            title: 'Very severe disease and local bacterial infection',
            rules: [
                rule('possible_serious_bacterial_infection', 'ALL', ['possibleSevereDisease'], 'Possible Serious Bacterial Infection or Very Severe Disease', RED, [
                    'If convulsing now, manage the airway and give diazepam rectally',
                    'Give first dose of IM ampicillin: {{dose:ampicillin_im_infant}}',
                    'Give first dose of IM gentamicin: {{dose:gentamicin_im_infant}}',
                    INFANT_LOW_SUGAR,
                    INFANT_WARM,
                    REFER,
                ]),
                rule('local_bacterial_infection', 'ALL', ['localBacterialInfection'], 'Local Bacterial Infection', YELLOW, [
                    'Give oral amoxicillin for 5 days: {{dose:amoxicillin_infant}}',
                    'Teach the mother to treat local infections at home (full-strength gentian violet 0.5%, twice daily for 5 days)',
                    INFANT_HOME_CARE,
                    'Follow up in 2 days',
                ]),
                rule('bacterial_infection_unlikely', 'ALL', ['noBacterialSigns'], 'Severe Disease or Local Infection Unlikely', GREEN, [
                    INFANT_HOME_CARE,
                ]),
            ],
        },
        jaundice: {
            title: 'Jaundice',
            rules: [
                rule('severe_jaundice', 'ALL', ['jaundiceSevere'], 'Severe Jaundice', RED, [
                    INFANT_LOW_SUGAR,
                    INFANT_WARM,
                    REFER,
                ]),
                rule('jaundice', 'ALL', ['jaundiceAfter24h'], 'Jaundice', YELLOW, [
                    'If the infant is 14 days or older, refer for assessment',
                    INFANT_HOME_CARE,
                    'Advise the mother to return immediately if palms and soles appear yellow',
                    'Follow up in 1 day',
                ]),
                rule('no_jaundice', 'ALL', ['noJaundice'], 'No Jaundice', GREEN, [
                    INFANT_HOME_CARE,
                    RETURN_NOW,
                ]),
            ],
        },
        diarrhea: {
            title: 'Diarrhoea: dehydration',
            rules: [
                rule('infant_severe_dehydration', 'ALL', ['severeDehydration'], 'Severe Dehydration', RED, [
                    'If the infant has no other severe classification, give fluid for severe dehydration (Plan C): {{dose:plan_c_iv}}',
                    `If the infant also has another severe classification, ${ORS_ON_WAY}`,
                    'Advise the mother to continue breastfeeding',
                    INFANT_WARM,
                ], { requires: ['hasDiarrhea'] }),
                rule('infant_some_dehydration', 'ALL', ['someDehydration'], 'Some Dehydration', YELLOW, [
                    'If the infant has no severe classification, give fluid for some dehydration (Plan B): {{dose:plan_b_ors}}',
                    `If the infant has a severe classification, ${ORS_ON_WAY}, advise her to continue breastfeeding and keep the infant warm`,
                    'Counsel the mother on feeding the young infant',
                    'If diarrhoea for more than 2 weeks with no feeding problem, refer for assessment',
                    RETURN_NOW,
                    'Follow up in 2 days if not improving',
                ], { requires: ['hasDiarrhea'] }),
                rule('infant_no_dehydration', 'ALL', ['hasDiarrhea'], 'No Dehydration', GREEN, [
                    'Give fluids to treat diarrhoea at home (Plan A): {{dose:plan_a_ors}}',
                    'Counsel the mother on feeding the young infant',
                    RETURN_NOW,
                    'Follow up in 2 days if not improving',
                ]),
            ],
        },
        persistent_diarrhea: {
            title: 'Diarrhoea for 14 days or more',
            rules: [
                rule('infant_severe_persistent_diarrhea', 'ALL', ['diarrhea14Days'], 'Severe Persistent Diarrhoea', RED, [
                    'If the infant is dehydrated and has no other severe classification, treat dehydration before referral',
                    'Refer URGENTLY to hospital with the mother giving frequent sips of ORS on the way',
                    'Advise the mother to continue breastfeeding',
                ], { requires: ['hasDiarrhea'] }),
            ],
        },
        dysentery: {
            title: 'Blood in the stool',
            rules: [
                rule('infant_blood_in_stool', 'ALL', ['bloodInStool'], 'Blood in Stool', RED, [
                    INFANT_LOW_SUGAR,
                    INFANT_WARM,
                    'Refer URGENTLY to hospital with the mother giving frequent sips of ORS on the way',
                    'Advise the mother to continue breastfeeding',
                ], { requires: ['hasDiarrhea'] }),
            ],
        },
        feeding_problem: {
            title: 'Feeding problem or low weight',
            rules: [
                rule('feeding_problem_or_low_weight', 'ALL', ['feedingProblem'], 'Feeding Problem or Low Weight', YELLOW, [
                    'If not well attached or not suckling effectively, teach correct positioning and attachment',
                    'If breastfeeding less than 8 times in 24 hours, advise the mother to breastfeed as often and for as long as the infant wants, day and night',
                    'If receiving other foods or drinks, counsel the mother to breastfeed more, reduce other foods or drinks, and use a cup',
                    'If not breastfeeding at all, refer for breastfeeding counselling and possible relactation',
                    'If thrush, teach the mother to treat it at home (half-strength gentian violet 0.25%, 4 times daily for 7 days)',
                    'Advise the mother how to feed and keep the young infant warm',
                    'Follow up any feeding problem or thrush in 2 days',
                    'Follow up low weight for age in 14 days',
                ]),
                rule('no_feeding_problem', 'ALL', ['feedingWellNormalWeight'], 'No Feeding Problem', GREEN, [
                    INFANT_HOME_CARE,
                    'Praise the mother for feeding the infant well',
                ]),
            ],
        },
    },
};

// ----------------------------------------------------------------------------
// DOSES, SICK CHILD
// ----------------------------------------------------------------------------
const ONCE_PRE_REFERRAL = 'First dose before referral';

export const NATIONAL_CHILD_DOSAGES = {
    formType: 'dosages_child',
    version: NATIONAL_PROTOCOL_VERSION,
    drugs: [
        {
            id: 'amoxicillin', label: 'Amoxicillin (oral)', fallback: 'Check the amoxicillin table (age 2 months up to 5 years)',
            rules: [
                band(2, 11.99, 4, 9.99, '5 ml syrup (250 mg/5 ml) OR 1 tablet (250 mg)', 'Twice daily', 'For 5 days'),
                band(12, 35.99, 10, 13.99, '10 ml syrup OR 2 tablets (250 mg)', 'Twice daily', 'For 5 days'),
                band(36, 60, 14, 19.99, '15 ml syrup OR 3 tablets (250 mg)', 'Twice daily', 'For 5 days'),
            ],
        },
        {
            id: 'ampicillin', label: 'Ampicillin (IM)', fallback: '50 mg/kg; 500 mg vial + 2.1 ml sterile water = 500 mg/2.5 ml',
            rules: [
                band(2, 3.99, 4, 5.99, '1 ml (500 mg vial + 2.1 ml sterile water)', ONCE_PRE_REFERRAL, 'If referral is not possible: every 6 hours for 5 days'),
                band(4, 11.99, 6, 9.99, '2 ml', ONCE_PRE_REFERRAL, 'If referral is not possible: every 6 hours for 5 days'),
                band(12, 35.99, 10, 13.99, '3 ml', ONCE_PRE_REFERRAL, 'If referral is not possible: every 6 hours for 5 days'),
                band(36, 60, 14, 19.99, '5 ml', ONCE_PRE_REFERRAL, 'If referral is not possible: every 6 hours for 5 days'),
            ],
        },
        {
            id: 'gentamycin', label: 'Gentamicin (IM)', fallback: '7.5 mg/kg/day; 80 mg/2 ml vial',
            rules: [
                band(2, 3.99, 4, 5.99, '0.75–1.0 ml (80 mg/2 ml)', ONCE_PRE_REFERRAL, 'If referral is not possible: once daily for 5 days'),
                band(4, 11.99, 6, 9.99, '1.1–1.8 ml', ONCE_PRE_REFERRAL, 'If referral is not possible: once daily for 5 days'),
                band(12, 35.99, 10, 13.99, '1.9–2.7 ml', ONCE_PRE_REFERRAL, 'If referral is not possible: once daily for 5 days'),
                band(36, 60, 14, 19.99, '2.8–3.5 ml', ONCE_PRE_REFERRAL, 'If referral is not possible: once daily for 5 days'),
            ],
        },
        {
            id: 'quinine', label: 'Quinine (IM)', fallback: '300 mg/ml: dilute to 60 mg/ml with normal saline',
            rules: [
                band(0, 99, 4, 5.99, '0.2 ml quinine + 0.8 ml normal saline = 1 ml diluted', ONCE_PRE_REFERRAL, 'If referral is not possible: every 8 hours until able to take oral quinine, 7 days in total'),
                band(0, 99, 6, 9.99, '0.3 ml quinine + 1.2 ml saline = 1.5 ml diluted', ONCE_PRE_REFERRAL, 'If referral is not possible: every 8 hours until able to take oral quinine, 7 days in total'),
                band(0, 99, 10, 11.99, '0.4 ml quinine + 1.6 ml saline = 2 ml diluted', ONCE_PRE_REFERRAL, 'If referral is not possible: every 8 hours until able to take oral quinine, 7 days in total'),
                band(0, 99, 12, 13.99, '0.5 ml quinine + 2.0 ml saline = 2.5 ml diluted', ONCE_PRE_REFERRAL, 'If referral is not possible: every 8 hours until able to take oral quinine, 7 days in total'),
                band(0, 99, 14, 19.99, '0.6 ml quinine + 2.4 ml saline = 3 ml diluted', ONCE_PRE_REFERRAL, 'If referral is not possible: every 8 hours until able to take oral quinine, 7 days in total'),
            ],
        },
        {
            id: 'diazepam', label: 'Diazepam (rectal)', fallback: '0.5 mg/kg rectally; 10 mg/2 ml',
            rules: [
                band(2, 5.99, 4, 6.99, '0.5 ml (10 mg/2 ml) rectally', 'Once; repeat after 10 minutes if still convulsing', 'Then flush with 2 ml saline'),
                band(6, 11.99, 7, 9.99, '1 ml rectally', 'Once; repeat after 10 minutes if still convulsing', 'Then flush with 2 ml saline'),
                band(12, 35.99, 10, 13.99, '1.5 ml rectally', 'Once; repeat after 10 minutes if still convulsing', 'Then flush with 2 ml saline'),
                band(36, 60, 14, 19.99, '2 ml rectally', 'Once; repeat after 10 minutes if still convulsing', 'Then flush with 2 ml saline'),
            ],
        },
        {
            id: 'ciprofloxacin', label: 'Ciprofloxacin (oral)', fallback: 'Check the ciprofloxacin table',
            rules: [
                band(2, 3.99, 4, 5.99, '¼ tablet (250 mg)', 'Twice daily', 'For 3 days'),
                band(4, 11.99, 6, 9.99, '½ tablet (250 mg)', 'Twice daily', 'For 3 days'),
                band(12, 60, 10, 19.99, '1 tablet (250 mg)', 'Twice daily', 'For 3 days'),
            ],
        },
        {
            id: 'erythromycin', label: 'Cholera antibiotic', fallback: 'For children 2 years or older (10–19 kg)',
            rules: [
                band(24, 60, 10, 19.99, '1 tablet erythromycin 250 mg (second line: 1 tablet tetracycline 250 mg)', '4 times daily', 'For 3 days'),
            ],
        },
        {
            id: 'zinc', label: 'Zinc', fallback: 'For children 2 months up to 5 years',
            rules: [
                band(2, 5.99, 0, 99, '5 ml syrup (10 mg/5 ml) OR ½ tablet (20 mg)', 'Once daily', 'For 14 days'),
                band(6, 60, 0, 99, '10 ml syrup OR 1 tablet (20 mg)', 'Once daily', 'For 14 days'),
            ],
        },
        {
            id: 'plan_a_ors', label: 'ORS, Plan A', fallback: 'As much as the child will take',
            rules: [
                band(0, 23.99, 0, 99, '50–100 ml after each loose stool', 'Small frequent sips from a cup', 'Until the diarrhoea stops; give the mother 2 ORS packets'),
                band(24, 60, 0, 99, '100–200 ml after each loose stool', 'Small frequent sips from a cup', 'Until the diarrhoea stops; give the mother 2 ORS packets'),
            ],
        },
        {
            id: 'plan_b_ors', label: 'ORS, Plan B', fallback: 'Weight (kg) × 75 ml over 4 hours',
            rules: [
                band(0, 3.99, 0.01, 5.99, '200–400 ml', 'Frequent small sips in clinic', 'Over the first 4 hours, then reassess'),
                band(4, 11.99, 6, 9.99, '400–700 ml', 'Frequent small sips in clinic', 'Over the first 4 hours, then reassess'),
                band(12, 23.99, 10, 11.99, '700–900 ml', 'Frequent small sips in clinic', 'Over the first 4 hours, then reassess'),
                band(24, 60, 12, 19.99, '900–1400 ml', 'Frequent small sips in clinic', 'Over the first 4 hours, then reassess'),
            ],
        },
        {
            id: 'plan_c_iv', label: 'IV fluid, Plan C', fallback: '100 ml/kg Ringer\'s lactate (or normal saline)',
            rules: [
                band(0, 11.99, 0, 99, '100 ml/kg Ringer\'s lactate: 30 ml/kg in 1 hour, then 70 ml/kg in 5 hours', 'IV; repeat the first 30 ml/kg once if the radial pulse is still very weak', 'Reassess every 1–2 hours; reclassify after 6 hours'),
                band(12, 60, 0, 99, '100 ml/kg Ringer\'s lactate: 30 ml/kg in 30 minutes, then 70 ml/kg in 2½ hours', 'IV; repeat the first 30 ml/kg once if the radial pulse is still very weak', 'Reassess every 1–2 hours; reclassify after 3 hours'),
            ],
        },
        {
            id: 'coartem', label: 'Artemether-lumefantrine (20/120 mg)', fallback: 'Under 5 kg: seek specialist advice',
            rules: [
                band(0, 99, 5, 14.99, '1 tablet', 'Now, after 8 hours, then twice daily on days 2 and 3 (6 doses)', 'Give with fatty food; 6 tablets in total'),
                band(0, 99, 15, 24.99, '2 tablets', 'Now, after 8 hours, then twice daily on days 2 and 3 (6 doses)', 'Give with fatty food; 12 tablets in total'),
            ],
        },
        {
            id: 'dhap', label: 'Dihydroartemisinin-piperaquine (second line)', fallback: 'Under 5 kg: seek specialist advice',
            rules: [
                band(0, 99, 5, 7.99, '1 tablet (20/160 mg)', 'Once daily', 'For 3 days; avoid a high-fat meal'),
                band(0, 99, 8, 10.99, '1½ tablets (20/160 mg)', 'Once daily', 'For 3 days; avoid a high-fat meal'),
                band(0, 99, 11, 17.99, '1 tablet (40/320 mg)', 'Once daily', 'For 3 days; avoid a high-fat meal'),
            ],
        },
        {
            id: 'quinine_oral', label: 'Quinine tablets (third line)', fallback: '10 mg/kg every 8 hours for 7 days (300 mg tablets)',
            rules: [
                band(0, 99, 5, 6.99, '¼ tablet (300 mg)', 'Every 8 hours', 'For 7 days'),
                band(0, 99, 11, 14.99, '½ tablet (300 mg)', 'Every 8 hours', 'For 7 days'),
            ],
        },
        {
            id: 'primaquine', label: 'Primaquine (P. vivax)', fallback: 'Not for children under 6 months or with G6PD deficiency or haemolytic anaemia',
            rules: [
                band(6, 60, 0, 99, '0.25 mg/kg (15 mg tablets)', 'Once daily', 'For 14 days, after the first-line treatment; not with G6PD deficiency'),
            ],
        },
        {
            id: 'paracetamol', label: 'Paracetamol', fallback: 'Check the paracetamol table',
            rules: [
                band(2, 35.99, 4, 13.99, '5 ml syrup (120 mg/5 ml) OR ¼ tablet (500 mg)', 'Every 6 hours', 'Until the high fever or ear pain is gone'),
                band(36, 60, 14, 19.99, '7.5 ml syrup (120 mg/5 ml) OR ½ tablet (500 mg)', 'Every 6 hours', 'Until the high fever or ear pain is gone'),
            ],
        },
        {
            id: 'salbutamol_inhaler', label: 'Salbutamol inhaler (100 mcg/puff)', fallback: 'Always through a spacer',
            rules: [
                band(2, 60, 0, 99, '3 puffs (100 mcg/puff) through a spacer', 'Every 20 minutes, up to 3 times in 1 hour, then reassess', 'At home for 5 days'),
            ],
        },
        {
            id: 'salbutamol_oral', label: 'Salbutamol (oral)', fallback: 'Only if no inhaler; not for severe classification',
            rules: [
                band(2, 11.99, 0.01, 9.99, '2.5 ml syrup (2 mg/5 ml) OR ½ tablet (2 mg) OR ¼ tablet (4 mg)', '3 times daily', 'For 5 days'),
                band(12, 60, 10, 19.99, '5 ml syrup OR 1 tablet (2 mg) OR ½ tablet (4 mg)', '3 times daily', 'For 5 days'),
            ],
        },
        {
            id: 'iron', label: 'Iron', fallback: 'Not for sickle cell anaemia or a child on RUTF',
            rules: [
                band(2, 3.99, 4, 5.99, '1 ml ferrous fumarate syrup (100 mg/5 ml) OR 2 ml iron polymaltose syrup (50 mg/5 ml)', 'Once daily', 'For 14 days'),
                band(4, 11.99, 6, 9.99, '1.25 ml ferrous fumarate syrup OR 2.5 ml iron polymaltose syrup', 'Once daily', 'For 14 days'),
                band(12, 35.99, 10, 13.99, '½ tablet (ferrous sulphate 200 mg + folate) OR 2 ml fumarate syrup OR 4 ml polymaltose syrup', 'Once daily', 'For 14 days'),
                band(36, 60, 14, 19.99, '½ tablet (ferrous sulphate 200 mg + folate) OR 2.5 ml fumarate syrup OR 5 ml polymaltose syrup', 'Once daily', 'For 14 days'),
            ],
        },
        {
            id: 'mebendazole', label: 'Mebendazole', fallback: 'Only for children 1 year or older',
            rules: [
                band(12, 60, 10, 19.99, '5 ml syrup (100 mg/5 ml)', 'Morning and evening', 'For 3 days; repeat the course after 2 weeks'),
            ],
        },
        {
            id: 'vitamin_a', label: 'Vitamin A (supplement)', fallback: 'From 6 months of age; not within 6 months of the last dose',
            rules: [
                band(6, 11.99, 0, 99, '100,000 IU (blue capsule)', 'Once, in clinic', 'Then every 6 months up to 5 years'),
                band(12, 60, 0, 99, '200,000 IU (red capsule)', 'Once, in clinic', 'Then every 6 months up to 5 years'),
            ],
        },
        {
            id: 'vitamin_a_treatment', label: 'Vitamin A (measles treatment)', fallback: 'Not in the national chart under 6 months: seek advice',
            rules: [
                band(6, 11.99, 0, 99, '100,000 IU (blue capsule)', '3 doses: day 1 in clinic, day 2 at home, and after 2 weeks in clinic', 'Not if a dose was given in the last 6 months or the child is on RUTF'),
                band(12, 60, 0, 99, '200,000 IU (red capsule)', '3 doses: day 1 in clinic, day 2 at home, and after 2 weeks in clinic', 'Not if a dose was given in the last 6 months or the child is on RUTF'),
            ],
        },
        {
            id: 'rutf', label: 'RUTF (Plumpy\'Nut, 92 g sachet)', fallback: 'For children 6 months or older with uncomplicated SAM',
            rules: [
                band(6, 60, 4, 4.99, '2 sachets a day', '5–6 small meals a day', '14 sachets a week'),
                band(6, 60, 5, 6.99, '2½ sachets a day', '5–6 small meals a day', '18 sachets a week'),
                band(6, 60, 7, 8.49, '3 sachets a day', '5–6 small meals a day', '21 sachets a week'),
                band(6, 60, 8.5, 9.49, '3½ sachets a day', '5–6 small meals a day', '25 sachets a week'),
                band(6, 60, 9.5, 10.49, '4 sachets a day', '5–6 small meals a day', '28 sachets a week'),
                band(6, 60, 10.5, 11.99, '4½ sachets a day', '5–6 small meals a day', '32 sachets a week'),
                band(6, 60, 12, 30, '5 sachets a day', '5–6 small meals a day', '35 sachets a week'),
            ],
        },
    ],
};

// ----------------------------------------------------------------------------
// DOSES, YOUNG INFANT
// ----------------------------------------------------------------------------
const INFANT_REFERRAL_NOT_POSSIBLE = 'If referral is not possible, continue for at least 5 days';
const SEVEN_DAYS = 7 / 30.44; // months

export const NATIONAL_INFANT_DOSAGES = {
    formType: 'dosages_infant',
    version: NATIONAL_PROTOCOL_VERSION,
    drugs: [
        {
            id: 'amoxicillin_infant', label: 'Amoxicillin (oral)', fallback: 'Check the young infant amoxicillin table',
            rules: [
                band(0, 0.99, 0.01, 3.99, '2.5 ml syrup (125 mg/5 ml) OR ¼ tablet (250 mg)', 'Twice daily', 'For 5 days'),
                band(1, 2.5, 4, 5.99, '5 ml syrup (125 mg/5 ml) OR ½ tablet (250 mg)', 'Twice daily', 'For 5 days'),
            ],
        },
        {
            id: 'ampicillin_im_infant', label: 'Ampicillin (IM)', fallback: '50 mg/kg: 0.5 ml per kg of 250 mg/2.5 ml',
            rules: [
                band(0, 99, 0.5, 1.49, '0.5 ml (250 mg vial + 2.1 ml sterile water = 250 mg/2.5 ml)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(0, 99, 1.5, 2.49, '1.0 ml', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(0, 99, 2.5, 3.49, '1.5 ml', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(0, 99, 3.5, 4.49, '2.0 ml', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(0, 99, 4.5, 6, '2.5 ml', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
            ],
        },
        {
            // Age matters at the same weight, so both have to match.
            id: 'gentamicin_im_infant', label: 'Gentamicin (IM)', ageAndWeight: true,
            fallback: 'Enter age and weight. 80 mg/2 ml vial + 6 ml sterile water = 10 mg/ml: under 7 days 0.5 ml/kg; 7 days or older 0.75 ml/kg',
            rules: [
                band(0, SEVEN_DAYS - 0.0001, 0.5, 1.49, '0.5 ml (10 mg/ml; age under 7 days)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(0, SEVEN_DAYS - 0.0001, 1.5, 2.49, '1.0 ml (10 mg/ml; age under 7 days)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(0, SEVEN_DAYS - 0.0001, 2.5, 3.49, '1.5 ml (10 mg/ml; age under 7 days)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(0, SEVEN_DAYS - 0.0001, 3.5, 4.49, '2.0 ml (10 mg/ml; age under 7 days)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(0, SEVEN_DAYS - 0.0001, 4.5, 6, '2.5 ml (10 mg/ml; age under 7 days)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(SEVEN_DAYS, 3, 0.5, 1.49, '0.8 ml (10 mg/ml; age 7 days or older)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(SEVEN_DAYS, 3, 1.5, 2.49, '1.5 ml (10 mg/ml; age 7 days or older)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(SEVEN_DAYS, 3, 2.5, 3.49, '2.25 ml (10 mg/ml; age 7 days or older)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(SEVEN_DAYS, 3, 3.5, 4.49, '3.0 ml (10 mg/ml; age 7 days or older)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
                band(SEVEN_DAYS, 3, 4.5, 6, '3.75 ml (10 mg/ml; age 7 days or older)', ONCE_PRE_REFERRAL, INFANT_REFERRAL_NOT_POSSIBLE),
            ],
        },
        {
            id: 'plan_a_ors', label: 'ORS, Plan A', fallback: '50–100 ml after each loose stool',
            rules: [
                band(0, 3, 0, 99, '50–100 ml after each loose stool, as well as breastfeeding', 'Small frequent sips from a cup', 'Until the diarrhoea stops; give the mother 2 ORS packets'),
            ],
        },
        {
            id: 'plan_b_ors', label: 'ORS, Plan B', fallback: 'Weight (kg) × 75 ml over 4 hours',
            rules: [
                band(0, 3, 0, 99, '200–400 ml (about weight × 75 ml), as well as breastfeeding', 'Frequent small sips in clinic', 'Over the first 4 hours, then reassess'),
            ],
        },
        {
            id: 'plan_c_iv', label: 'IV fluid, Plan C', fallback: '100 ml/kg Ringer\'s lactate (or normal saline)',
            rules: [
                band(0, 3, 0, 99, '100 ml/kg Ringer\'s lactate: 30 ml/kg in 1 hour, then 70 ml/kg in 5 hours', 'IV; repeat the first 30 ml/kg once if the radial pulse is still very weak', 'Reassess every 1–2 hours; reclassify after 6 hours'),
            ],
        },
    ],
};

// The Arabic wording sits beside the English on the same rule, so the Arabic
// screens and the Arabic form show the same protocol, line for line.
const arabicRules = (protocol) => {
    Object.values(protocol.categories).forEach((cat) => {
        cat.titleAr = toArabic(cat.title);
        cat.rules.forEach((r) => {
            r.classification.labelAr = toArabic(r.classification.label);
            if (r.signs) r.signsAr = r.signs.map(toArabic);
            r.treatmentsAr = r.treatments.map(toArabic);
        });
    });
};
const arabicDoses = (dosages) => {
    dosages.drugs.forEach((d) => {
        d.labelAr = toArabic(d.label);
        if (d.fallback) d.fallbackAr = toArabic(d.fallback);
        d.rules.forEach((b) => {
            ['doseQty', 'doseFreq', 'doseDuration'].forEach((f) => { if (b[f]) b[`${f}Ar`] = toArabic(b[f]); });
        });
    });
};
arabicRules(NATIONAL_CHILD_PROTOCOL);
arabicRules(NATIONAL_INFANT_PROTOCOL);
arabicDoses(NATIONAL_CHILD_DOSAGES);
arabicDoses(NATIONAL_INFANT_DOSAGES);

export const NATIONAL_PROTOCOLS = {
    dosages_child: NATIONAL_CHILD_DOSAGES,
    dosages_infant: NATIONAL_INFANT_DOSAGES,
    child: NATIONAL_CHILD_PROTOCOL,
    infant: NATIONAL_INFANT_PROTOCOL,
};

// Saved in this order: a rules tab is only valid once its Doses tab exists.
export const NATIONAL_SAVE_ORDER = ['dosages_child', 'dosages_infant', 'child', 'infant'];
