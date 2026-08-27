// ============================================================================
// IMNCI CHART BOOKLET — CLASSIFICATION TABLES
// ============================================================================
//
// On a real IMNCI course the health worker does not classify from memory: they
// read the signs, then turn to the chart booklet page for that complaint and
// match the child against the rows from the TOP DOWN, taking the first row
// whose signs are present. The pink row is checked before the yellow, and the
// yellow before the green — that ordering is the method, not a detail.
//
// These tables are transcribed from the Sudan IMNCI chart booklet pages so the
// learner can open the same page beside the form, as they would on the course.
//
// Shape:
//   key            matches the `section` used by the recording form
//   title          the heading printed on the chart booklet page
//   note           the arrow label on the left edge of the page, where present
//   rows[]         top to bottom, in chart booklet order
//     signs[]      the "signs" column
//     signsIntro   optional lead-in, e.g. "Two of the following signs:"
//     classify     the classification name
//     colour       'pink' | 'yellow' | 'green'  (severity, as printed)
//     treatments[] the "identify treatment" column
//     dashed       true where the booklet prints a dashed divider above the row
//
// IMPORTANT: this is reference content shown to learners. Correct it against
// your own national chart booklet before a course — treatment lines in
// particular differ between editions and between countries.

export const CHART_BOOKLET = {
    // ---------------------------------------------------------------- cough
    cough: {
        title: 'Classify COUGH OR DIFFICULT BREATHING',
        rows: [
            {
                signs: ['Any general danger sign', 'or', 'Stridor in a calm child.'],
                classify: 'SEVERE PNEUMONIA OR VERY SEVERE DISEASE',
                colour: 'pink',
                treatments: [
                    'Give first dose of an appropriate antibiotic.',
                    'Treat to prevent low blood sugar.',
                    'Refer URGENTLY to hospital.',
                ],
            },
            {
                signs: ['Chest indrawing', 'or', 'Fast breathing'],
                classify: 'PNEUMONIA',
                colour: 'yellow',
                treatments: [
                    'Give appropriate antibiotics for 5 days.',
                    'If wheezing (or disappeared after rapidly acting bronchodilator) give an inhaled bronchodilator for 5 days.',
                    'Soothe the throat and relieve the cough with a safe remedy.',
                    'If coughing for 14 days or more refer to the hospital for further assessment.',
                    'Advise mother when to return immediately.',
                    'Follow-up in 3 days.',
                ],
            },
            {
                signs: ['No signs of pneumonia or very severe disease.'],
                classify: 'COUGH OR COLD',
                colour: 'green',
                treatments: [
                    'If coughing for 14 days or more refer for assessment.',
                    'Soothe the throat and relieve cough with a safe remedy.',
                    'Treat wheezing if present.',
                    'Advise mother when to return immediately.',
                    'Follow up in 5 days if not improving.',
                ],
            },
        ],
    },

    // ------------------------------------------------------------- diarrhoea
    diarrhea: {
        title: 'Classify DIARRHOEA',
        note: 'Classify for dehydration first, then for persistent diarrhoea, then for dysentery.',
        rows: [
            {
                group: 'For dehydration',
                signsIntro: 'Two of the following signs:',
                signs: [
                    'Lethargic or unconscious',
                    'Sunken eyes',
                    'Not able to drink or drinking poorly',
                    'Skin pinch goes back very slowly.',
                ],
                classify: 'SEVERE DEHYDRATION',
                colour: 'pink',
                treatments: [
                    'If child has no other severe classification: Give fluid for severe dehydration (Plan C).',
                    'If child has another severe classification: Refer URGENTLY to hospital with mother giving frequent sips of ORS on the way.',
                    'Advise the mother to continue breastfeeding.',
                    'If child is 2 years or older and there is cholera in your area, give antibiotic for cholera.',
                ],
            },
            {
                signsIntro: 'Two of the following signs:',
                signs: [
                    'Restless, irritable',
                    'Sunken eyes',
                    'Drinks eagerly, thirsty',
                    'Skin pinch goes back slowly.',
                ],
                classify: 'SOME DEHYDRATION',
                colour: 'yellow',
                treatments: [
                    'Give fluid for some dehydration (Plan B).',
                    'Give Zinc.',
                    'If child has a severe classification: Refer URGENTLY to hospital with mother giving frequent sips of ORS on the way.',
                    'Advise the mother to continue breastfeeding.',
                    'Advise mother when to return immediately.',
                    'Follow-up in 5 days if not improving.',
                ],
            },
            {
                signs: ['Not enough signs to classify as severe or some dehydration.'],
                classify: 'NO DEHYDRATION',
                colour: 'green',
                treatments: [
                    'Give fluid and food to treat diarrhoea at home (Plan A).',
                    'Give Zinc.',
                    'Advise mother when to return immediately.',
                    'Follow-up in 5 days if not improving.',
                ],
            },
            {
                group: 'If diarrhoea for 14 days or more',
                signs: ['Dehydration present.'],
                classify: 'SEVERE PERSISTENT DIARRHOEA',
                colour: 'pink',
                dashed: true,
                treatments: [
                    'Treat dehydration before referral unless the child has another severe classification.',
                    'Refer to hospital.',
                ],
            },
            {
                signs: ['No dehydration.'],
                classify: 'PERSISTENT DIARRHOEA',
                colour: 'yellow',
                treatments: [
                    'Advise the mother on feeding a child who has PERSISTENT DIARRHOEA.',
                    'Give dose of Vitamin A.',
                    'Follow-up in 5 days.',
                ],
            },
            {
                group: 'If blood in stool',
                signs: ['Blood in the stool.'],
                classify: 'DYSENTERY',
                colour: 'yellow',
                dashed: true,
                treatments: [
                    'Give an oral ciprofloxacin for 3 days.',
                    'Follow-up in 3 days.',
                ],
            },
        ],
    },

    // ----------------------------------------------------------------- fever
    fever: {
        title: 'Classify FEVER',
        note: 'Classify for malaria first, then for measles if measles now or within the last 3 months.',
        rows: [
            {
                group: 'Classify for MALARIA',
                signs: ['Any general danger sign', 'or', 'Stiff neck.'],
                classify: 'VERY SEVERE FEBRILE DISEASE',
                colour: 'pink',
                treatments: [
                    'Give IM quinine (first dose).',
                    'Give first dose of an appropriate antibiotic.',
                    'Treat the child to prevent low blood sugar.',
                    'Give one dose of paracetamol in clinic for high fever (38.5°C or above).',
                    'Refer URGENTLY to hospital.',
                ],
            },
            {
                signsIntro: 'Positive malaria test.',
                signs: ['Falciparum', 'or', 'Vivax'],
                classify: 'MALARIA',
                colour: 'yellow',
                treatments: [
                    'Give first line of oral antimalarial.',
                    'In case of Vivax give primaquine after completion of the first line antimalarial.',
                    'Give one dose of paracetamol in clinic for high fever (38.5°C or above).',
                    'Advise mother when to return immediately.',
                    'Follow-up in 3 days if fever persists.',
                    'If fever is present every day for more than 7 days, refer for assessment.',
                ],
            },
            {
                signs: ['Negative malaria test.'],
                classify: 'FEVER — NO MALARIA',
                colour: 'green',
                treatments: [
                    'Assess for other cause of fever and treat accordingly.',
                    'Give one dose of paracetamol for high fever (38.5°C or above).',
                    'If fever for 7 days or more refer for assessment.',
                    'Advise the mother when to return immediately.',
                    'Follow up in 3 days if fever persists.',
                ],
            },
            {
                group: 'If measles now or in the last 3 months',
                signs: [
                    'Any general danger sign',
                    'or',
                    'Clouding of the cornea',
                    'or',
                    'Deep or extensive mouth ulcers.',
                ],
                classify: 'SEVERE COMPLICATED MEASLES',
                colour: 'pink',
                dashed: true,
                treatments: [
                    'Give Vitamin A treatment.',
                    'Give first dose of an appropriate antibiotic.',
                    'If clouding of the cornea or pus draining from the eye, apply tetracycline eye ointment.',
                    'Refer URGENTLY to hospital.',
                ],
            },
            {
                signs: ['Pus draining from the eye', 'or', 'Mouth ulcers.'],
                classify: 'MEASLES WITH EYE OR MOUTH COMPLICATIONS',
                colour: 'yellow',
                treatments: [
                    'Give Vitamin A treatment.',
                    'If pus draining from the eye, treat eye infection with tetracycline eye ointment.',
                    'If mouth ulcers, treat with gentian violet.',
                    'Advise the mother when to return immediately.',
                    'Follow-up in 3 days.',
                ],
            },
            {
                signs: ['Measles now or within the last 3 months.'],
                classify: 'MEASLES',
                colour: 'green',
                treatments: [
                    'Give Vitamin A.',
                    'Advise the mother to feed the child.',
                ],
            },
        ],
    },

    // ------------------------------------------------------------------- ear
    ear: {
        title: 'Classify EAR PROBLEM',
        rows: [
            {
                signs: ['Tender swelling behind the ear.'],
                classify: 'MASTOIDITIS',
                colour: 'pink',
                treatments: [
                    'Give first dose of an appropriate antibiotic.',
                    'Give first dose of paracetamol for pain.',
                    'Refer URGENTLY to hospital.',
                ],
            },
            {
                signs: [
                    'Ear pain.',
                    'or',
                    'Pus is seen draining from the ear and discharge is reported for less than 14 days.',
                ],
                classify: 'ACUTE EAR INFECTION',
                colour: 'yellow',
                treatments: [
                    'Give an appropriate oral antibiotic for 5 days.',
                    'Give paracetamol for pain.',
                    'Dry the ear by wicking.',
                    'Advise the mother when to return immediately.',
                    'Follow up in 5 days.',
                ],
            },
            {
                signs: ['Pus is seen draining from the ear and discharge is reported for 14 days or more.'],
                classify: 'CHRONIC EAR INFECTION',
                colour: 'yellow',
                dashed: true,
                treatments: [
                    'Dry the ear by wicking.',
                    'Give Quinolone ear drops.',
                    'Advise the mother when to return immediately.',
                ],
            },
            {
                signs: ['No ear pain and no pus seen draining from the ear.'],
                classify: 'NO EAR INFECTION (other ear problems)',
                colour: 'green',
                treatments: [
                    'No treatment advised.',
                    'Refer for assessment if there is hearing problems.',
                ],
            },
        ],
    },

    // ---------------------------------------------------------- malnutrition
    malnutrition: {
        title: 'Classify NUTRITIONAL STATUS',
        rows: [
            {
                signs: [
                    'Edema of both feet',
                    'OR',
                    'WFH/L less than -3 z-scores or MUAC less than 11.5 cm with any of the following:',
                    '— Medical complication present, or',
                    '— Not able to finish RUTF portion',
                ],
                classify: 'COMPLICATED SEVERE ACUTE MALNUTRITION (SAM)',
                colour: 'pink',
                treatments: [
                    'Give first dose appropriate antibiotic.',
                    'Treat the child to prevent low blood sugar.',
                    'Keep the child warm.',
                    'Refer URGENTLY to hospital.',
                ],
            },
            {
                signs: [
                    'WFH/L less than -3 z-scores OR MUAC less than 11.5 cm',
                    'AND',
                    'Able to finish RUTF portion and no medical complications',
                ],
                classify: 'UNCOMPLICATED SEVERE ACUTE MALNUTRITION (SAM)',
                colour: 'yellow',
                treatments: [
                    'Give oral antibiotics for 5 days.',
                    'Refer for Outpatient Therapeutic Program (OTP) for ready-to-use therapeutic food (RUTF) if a child aged 6 months or more.',
                    'Counsel the mother on how to feed the child.',
                    'Advise mother when to return immediately.',
                    'Follow up in 14 days.',
                ],
            },
            {
                signs: ['WFH/L -3 up to -2 z-scores', 'OR', 'MUAC 11.5 up to 12.5 cm'],
                classify: 'MODERATE ACUTE MALNUTRITION (MAM)',
                colour: 'yellow',
                dashed: true,
                treatments: [
                    'Refer the child for Supplementary feeding program if available.',
                    "Assess the child's feeding and counsel the mother on the feeding recommendations and refer for growth monitoring and health promotion.",
                    'If feeding problem, follow up in 7 days.',
                    'Advise mother when to return immediately.',
                    'Follow-up in 30 days.',
                ],
            },
            {
                signs: ['WFH/L -2 z-scores or more', 'OR', 'MUAC 12.5 cm or more.'],
                classify: 'NO ACUTE MALNUTRITION',
                colour: 'green',
                treatments: [
                    "If child is less than 2 years old, assess the child's feeding and counsel the mother on feeding according to the feeding recommendations.",
                    'If feeding problem, follow-up in 7 days.',
                ],
            },
        ],
    },

    // ---------------------------------------------------------------- anaemia
    anemia: {
        title: 'Classify ANAEMIA',
        rows: [
            {
                signs: ['Severe palmar pallor'],
                classify: 'SEVERE ANAEMIA',
                colour: 'pink',
                treatments: ['Refer URGENTLY to hospital.'],
            },
            {
                signs: ['Some palmar pallor'],
                classify: 'ANAEMIA',
                colour: 'yellow',
                treatments: [
                    'Give iron.',
                    'Give mebendazole if child is 1 year or older and has not received a dose in the last 6 months.',
                    'Advise mother when to return immediately.',
                    'Follow-up in 14 days.',
                    "If child is less than 2 years old, assess the child's feeding and counsel the mother on feeding according to the feeding recommendations.",
                ],
            },
            {
                signs: ['No palmar pallor'],
                classify: 'NO ANAEMIA',
                colour: 'green',
                treatments: [
                    'No additional treatment.',
                    "If child is less than 2 years old, assess the child's feeding and counsel the mother on feeding according to the feeding recommendations.",
                ],
            },
        ],
    },
};

export const hasChartBooklet = (section) => !!CHART_BOOKLET[section];
export const getChartBooklet = (section) => CHART_BOOKLET[section] || null;
