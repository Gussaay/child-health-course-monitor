// src/components/imnci/dimci/module1.js
//
// WHO IMCI distance learning course, Module 1 (General danger signs), as app
// content. GENERATED from the checked capture of the WHO booklet; do not edit
// by hand. Once added to the app, every section and exercise is edited in the
// app itself: sections in Online courses (Manage), exercises in Manage
// Exercises. Those edits are saved over these, never back into this file.
//
// - Text is the WHO wording, except where the Sudan national IMNCI booklet
//   differs: then the Sudan wording is used and a "Sudan national protocol"
//   note says what WHO wrote.
// - Classification tables are chart booklet blocks, read live from the saved
//   protocol, so they always match the chart booklet.
// - Exercises use the app's own quiz and recording-form case exercises. They
//   start as drafts: facilitators see them, participants do not.

export const DIMCI_M1_EXERCISES = [
    {
        "id": "dimci-m1-pretest",
        "order": 101,
        "title": "Distance learning Module 1: Pre-test",
        "subCourse": "online IMCI course",
        "passMark": 80,
        "estimatedMinutes": 5,
        "draft": true,
        "source": "WHO dIMCI Module 1 (2014)",
        "narrative": [
            "Before you begin studying this module, quickly practice your knowledge with the questions below. Do not look up the answers. This is for your own exercise. After you finish the module, you will answer the same questions. This will demonstrate to you what you have learned during the course of the module!"
        ],
        "kind": "quiz",
        "questions": [
            {
                "id": "q1",
                "type": "open",
                "question": "If a child arrives at your clinic with a sign of serious illness, they should be immediately referred. What are these signs?",
                "points": [
                    "Child is lethargic or unconscious",
                    "Child is vomiting everything",
                    "Child has had convulsions, or is convulsing now",
                    "Child cannot breastfeed or drink"
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.2 Checking all sick children."
            },
            {
                "id": "q2",
                "type": "mcq",
                "question": "When is a child lethargic?",
                "options": [
                    "The child will not wake, even after shaking",
                    "The child is sleeping more often than usual, but will wake up if you set them down to walk",
                    "The child is drowsy and will not follow movement or noise in the room"
                ],
                "correct": [
                    2
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.2 Checking all sick children."
            },
            {
                "id": "q3",
                "type": "mcq",
                "question": "When is a child unconscious?",
                "options": [
                    "The child will not wake, even after shaking. However, his eyes might be open.",
                    "The child is drowsy and will not follow movement or noise in the room",
                    "The child is sleeping very deeply"
                ],
                "correct": [
                    0
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.2 Checking all sick children."
            },
            {
                "id": "q4",
                "type": "mcq",
                "question": "If you identify a child with serious illness that requires referral, your course of action is:",
                "options": [
                    "Stop your assessment of the child, and tell the caregiver they must hurry to the hospital",
                    "Provide urgent treatments, prepare the caregiver for travel to the hospital, and prepare supplies and a referral note",
                    "Keep the child at your clinic to monitor them and see if they will improve during the course of the day, and then refer only when necessary"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.3 Care when urgent referral is required."
            },
            {
                "id": "q5",
                "type": "mcq",
                "question": "Why do some children require urgent referral?",
                "options": [
                    "The parents do not want to receive care in the clinic",
                    "It is quickest if the child receives important care at a different facility",
                    "They show signs of serious illness that require advanced care that is usually available at a referral facility, like a hospital."
                ],
                "correct": [
                    2
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.2 and 1.3."
            }
        ]
    },
    {
        "id": "dimci-m1-ex-a",
        "order": 102,
        "title": "Distance learning Module 1: Exercise A (charts and greeting)",
        "subCourse": "online IMCI course",
        "passMark": 80,
        "estimatedMinutes": 5,
        "draft": true,
        "source": "WHO dIMCI Module 1 (2014)",
        "narrative": [
            "Complete this exercise, and try not to look back at the material. Remember that you can check your answers to all of the self-assessment exercises at the end of the module.",
            "What charts will you use for this child? Check your answer."
        ],
        "kind": "quiz",
        "questions": [
            {
                "id": "a1",
                "type": "mcq",
                "question": "Sam is 6 weeks old",
                "options": [
                    "Sick child",
                    "Sick young infant"
                ],
                "correct": [
                    1
                ],
                "explain": "Up to 2 months: sick young infant charts. 2 months up to 5 years: sick child charts. Answer key: Module 1, page 24."
            },
            {
                "id": "a2",
                "type": "mcq",
                "question": "Mari is 2 months old",
                "options": [
                    "Sick child",
                    "Sick young infant"
                ],
                "correct": [
                    0
                ],
                "explain": "Up to 2 months: sick young infant charts. 2 months up to 5 years: sick child charts. Answer key: Module 1, page 24."
            },
            {
                "id": "a3",
                "type": "mcq",
                "question": "Jera is 4 years, 10 months",
                "options": [
                    "Sick child",
                    "Sick young infant"
                ],
                "correct": [
                    0
                ],
                "explain": "Up to 2 months: sick young infant charts. 2 months up to 5 years: sick child charts. Answer key: Module 1, page 24."
            },
            {
                "id": "a4",
                "type": "mcq",
                "question": "Thabo is 7 weeks old",
                "options": [
                    "Sick child",
                    "Sick young infant"
                ],
                "correct": [
                    1
                ],
                "explain": "Up to 2 months: sick young infant charts. 2 months up to 5 years: sick child charts. Answer key: Module 1, page 24."
            },
            {
                "id": "a5",
                "type": "mcq",
                "question": "Paulo is 3 years old",
                "options": [
                    "Sick child",
                    "Sick young infant"
                ],
                "correct": [
                    0
                ],
                "explain": "Up to 2 months: sick young infant charts. 2 months up to 5 years: sick child charts. Answer key: Module 1, page 24."
            },
            {
                "id": "a6",
                "type": "open",
                "question": "List the important pieces of information you gather during a greeting:",
                "points": [
                    "Child's name, child's age, what the child's problems are, if this is an initial or followup visit, weight, and temperature. You can also get the caregiver's name and background information on the family or household situation. You can learn how the caregiver has been trying to address the child's problem up to now. This greeting is important to build rapport and trust with good communication skills. This will help you get more information from the caregiver."
                ],
                "explain": "Answer key: Module 1, page 24."
            }
        ]
    },
    {
        "id": "dimci-m1-ex-b",
        "order": 103,
        "title": "Distance learning Module 1: Exercise B (general danger signs)",
        "subCourse": "online IMCI course",
        "passMark": 80,
        "estimatedMinutes": 5,
        "draft": true,
        "source": "WHO dIMCI Module 1 (2014)",
        "narrative": [
            "Check the boxes below if the sign is a general danger sign."
        ],
        "kind": "quiz",
        "questions": [
            {
                "id": "b1",
                "type": "mcq",
                "question": "The child is vomiting frequently. When you give milk, he holds it down.\nIs this a general danger sign?",
                "options": [
                    "YES",
                    "NO"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Module 1, page 24."
            },
            {
                "id": "b2",
                "type": "mcq",
                "question": "The child will not take the mother's breast.\nIs this a general danger sign?",
                "options": [
                    "YES",
                    "NO"
                ],
                "correct": [
                    0
                ],
                "explain": "Answer key: Module 1, page 24."
            },
            {
                "id": "b3",
                "type": "mcq",
                "question": "The child lies in his caregiver's arms. When you clap he follows you.\nIs this a general danger sign?",
                "options": [
                    "YES",
                    "NO"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Module 1, page 24."
            },
            {
                "id": "b4",
                "type": "mcq",
                "question": "The child had convulsions last night and today. The child has been ill for 4 days.\nIs this a general danger sign?",
                "options": [
                    "YES",
                    "NO"
                ],
                "correct": [
                    0
                ],
                "explain": "Answer key: Module 1, page 24."
            },
            {
                "id": "b5",
                "type": "mcq",
                "question": "The child's eyes are open, but he is limp and will not respond to you.\nIs this a general danger sign?",
                "options": [
                    "YES",
                    "NO"
                ],
                "correct": [
                    0
                ],
                "explain": "Answer key: Module 1, page 24."
            },
            {
                "id": "b6",
                "type": "mcq",
                "question": "The child will not move, but after efforts to wake him, he walks around.\nIs this a general danger sign?",
                "options": [
                    "YES",
                    "NO"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Module 1, page 24."
            }
        ]
    },
    {
        "id": "dimci-m1-ex-c-salina",
        "order": 104,
        "title": "Distance learning Module 1: Exercise C (Salina, 15 months)",
        "subCourse": "online IMCI course",
        "passMark": 80,
        "estimatedMinutes": 10,
        "draft": true,
        "source": "WHO dIMCI Module 1 (2014)",
        "narrative": [
            "Salina is 15 months old. She weighs 8.5 kg. Her temperature is 38.5 °C.",
            "The health worker asked, \"What are the child's problems?\" The mother said, \"Salina has been coughing for 4 days, and she is not eating well.\"",
            "This is Salina's initial visit for this problem.",
            "The health worker checked Salina for general danger signs. He asked, \"Is Salina able to drink or breastfeed?\" The mother said, \"No. Salina does not want to breastfeed.\"",
            "The health worker gave Salina some water. She was too weak to lift her head. She was not able to drink from a cup.",
            "Next he asked the mother, \"Is she vomiting?\" The mother said, \"No.\"",
            "Then he asked, \"Has she had convulsions?\" The mother said, \"No.\"",
            "The health worker looked to see if Salina was lethargic or unconscious. When the health worker and the mother were talking, Salina watched them and looked around the room."
        ],
        "expected": {
            "sections": [
                "danger"
            ],
            "patientData": {
                "childName": "Salina",
                "sex": "female",
                "ageMonths": 15,
                "weightKg": 8.5,
                "tempC": 38.5,
                "visitType": "initial"
            },
            "assessments": {
                "notAbleToDrink": true,
                "vomitsEverything": false,
                "historyOfConvulsions": false,
                "lethargicUnconscious": false,
                "convulsingNow": false
            },
            "classifications": {
                "danger": [
                    "imci.classifications.danger_sign"
                ]
            },
            "includeTreatment": false,
            "treatments": {}
        },
        "learningPoints": [
            "Salina was not able to drink from a cup, so she has the general danger sign \"not able to drink or breastfeed\".",
            "She watched the health worker and her mother and looked around the room, so she is not lethargic.",
            "One general danger sign is enough: the danger sign is present, and Salina needs urgent referral."
        ],
        "explain": "Answer key: Module 1, page 25. Her problems: cough for 4 days, not eating well. Initial visit. Circle NOT ABLE TO DRINK OR BREASTFEED; danger sign present: Yes."
    },
    {
        "id": "dimci-m1-lebo",
        "order": 105,
        "title": "Distance learning Module 1: Lebo, 19 months (the module case)",
        "subCourse": "online IMCI course",
        "passMark": 80,
        "estimatedMinutes": 10,
        "draft": true,
        "source": "WHO dIMCI Module 1 (2014)",
        "narrative": [
            "Lebo's grandmother carries him into the clinic. Lebo does not look well. She has walked for one hour to the clinic. She tells you that she is also taking care of 4 other grandchildren. Lebo is her youngest grandchild and she is very worried about him. She says he is acting very unwell and has had a cough for 7 days.",
            "She tells you this is the first time she is bringing Lebo in to the clinic. You ask her how old Lebo is. She says he is 19 months old. You ask Lebo's grandmother her name. She tells you that her name is Nthabeleng.",
            "What is Lebo's problem? Nthabeleng tells you that Lebo has had a cough for 7 days. She also says that he has not been eating well. Nthabeleng is very worried about this. She says that in the past two days, he cannot take anything at all and she says he is very weak. This is concerning to you.",
            "Is Lebo coming for an initial or follow-up visit? Nthabeleng told you that this is her first time bringing him to the clinic for this issue. This is an initial visit. Lebo's temperature and weight were recorded when he came into the clinic, he weighs 10 kg and his temperature is 37 Celsius.",
            "You ask if Lebo is able to drink or breastfeed, and Nthabeleng says, \"no, not today, he is too tired.\" You try to give him some water from a cup but he is too weak and does not swallow. You ask Nthabeleng if Lebo is vomiting, and she says \"no.\" You ask if Lebo is having convulsions, and Nthabeleng says \"no.\"",
            "You look at Lebo's condition. He is not paying attention to you or Nthabeleng as you talk, and only stares ahead. You snap your fingers in front of his face, but he does not look at the fingers. You ask Nthabeleng to bounce Lebo and speak to him, and when she says \"Lebo! Lebo!\" he does not look up at her."
        ],
        "expected": {
            "sections": [
                "danger"
            ],
            "patientData": {
                "childName": "Lebo",
                "sex": "male",
                "ageMonths": 19,
                "weightKg": 10,
                "tempC": 37,
                "visitType": "initial"
            },
            "assessments": {
                "notAbleToDrink": true,
                "vomitsEverything": false,
                "historyOfConvulsions": false,
                "lethargicUnconscious": true,
                "convulsingNow": false
            },
            "classifications": {
                "danger": [
                    "imci.classifications.danger_sign"
                ]
            },
            "includeTreatment": false,
            "treatments": {}
        },
        "learningPoints": [
            "Lebo is showing two general danger signs - he is unable to drink and lethargic. He needs to be referred immediately to the hospital."
        ],
        "explain": "Lebo is showing two general danger signs - he is unable to drink and lethargic. He needs to be referred immediately to the hospital."
    },
    {
        "id": "dimci-m1-ex-d",
        "order": 106,
        "title": "Distance learning Module 1: Exercise D (true or false)",
        "subCourse": "online IMCI course",
        "passMark": 80,
        "estimatedMinutes": 5,
        "draft": true,
        "source": "WHO dIMCI Module 1 (2014)",
        "narrative": [
            "What will you do for the children who have general danger signs? Which statements below are true, and which are false?",
            "When you check your answers, the true version of each false statement is shown."
        ],
        "kind": "quiz",
        "questions": [
            {
                "id": "d1",
                "type": "tf",
                "question": "Stop immediately and send the child to the hospital",
                "correct": false,
                "explain": "The true statement: Continue the assessment quickly, identify all pre-referral treatments needed, treat, and refer urgently. Answer key: Module 1, page 25."
            },
            {
                "id": "d2",
                "type": "tf",
                "question": "Continue the assessment, determine pre-referral treatment, treat, and refer.",
                "correct": true,
                "explain": "True. Answer key: Module 1, page 25."
            },
            {
                "id": "d3",
                "type": "tf",
                "question": "Continue to assess the child and send child to hospital with referral note about all of the treatments you identified.",
                "correct": false,
                "explain": "The true statement: You should deliver the necessary pre-referral treatment before they leave your clinic for the hospital. Answer key: Module 1, page 25."
            },
            {
                "id": "d4",
                "type": "tf",
                "question": "If referral is not possible, there is nothing you can do. Send the child home.",
                "correct": false,
                "explain": "The true statement: You can provide essential care (further discussed in Annex), work with the family to encourage them to go to the hospital, or bring the child near to the clinic to monitor treatment and progress. Answer key: Module 1, page 25."
            }
        ]
    },
    {
        "id": "dimci-m1-posttest",
        "order": 107,
        "title": "Distance learning Module 1: Post-test",
        "subCourse": "online IMCI course",
        "passMark": 80,
        "estimatedMinutes": 5,
        "draft": true,
        "source": "WHO dIMCI Module 1 (2014)",
        "narrative": [
            "Before you began studying this module, you practiced your knowledge. Now that you have finished the module, answer the same questions and see how much you have learned."
        ],
        "kind": "quiz",
        "questions": [
            {
                "id": "q1",
                "type": "open",
                "question": "If a child arrives at your clinic with a sign of serious illness, they should be immediately referred. What are these signs?",
                "points": [
                    "Child is lethargic or unconscious",
                    "Child is vomiting everything",
                    "Child has had convulsions, or is convulsing now",
                    "Child cannot breastfeed or drink"
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.2 Checking all sick children."
            },
            {
                "id": "q2",
                "type": "mcq",
                "question": "When is a child lethargic?",
                "options": [
                    "The child will not wake, even after shaking",
                    "The child is sleeping more often than usual, but will wake up if you set them down to walk",
                    "The child is drowsy and will not follow movement or noise in the room"
                ],
                "correct": [
                    2
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.2 Checking all sick children."
            },
            {
                "id": "q3",
                "type": "mcq",
                "question": "When is a child unconscious?",
                "options": [
                    "The child will not wake, even after shaking. However, his eyes might be open.",
                    "The child is drowsy and will not follow movement or noise in the room",
                    "The child is sleeping very deeply"
                ],
                "correct": [
                    0
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.2 Checking all sick children."
            },
            {
                "id": "q4",
                "type": "mcq",
                "question": "If you identify a child with serious illness that requires referral, your course of action is:",
                "options": [
                    "Stop your assessment of the child, and tell the caregiver they must hurry to the hospital",
                    "Provide urgent treatments, prepare the caregiver for travel to the hospital, and prepare supplies and a referral note",
                    "Keep the child at your clinic to monitor them and see if they will improve during the course of the day, and then refer only when necessary"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.3 Care when urgent referral is required."
            },
            {
                "id": "q5",
                "type": "mcq",
                "question": "Why do some children require urgent referral?",
                "options": [
                    "The parents do not want to receive care in the clinic",
                    "It is quickest if the child receives important care at a different facility",
                    "They show signs of serious illness that require advanced care that is usually available at a referral facility, like a hospital."
                ],
                "correct": [
                    2
                ],
                "explain": "Answer key: Module 1, page 24. Revise: 1.2 and 1.3."
            }
        ]
    },
    {
        "id": "dimci-m1-logbook",
        "order": 108,
        "title": "Distance learning Module 1: Logbook test",
        "subCourse": "online IMCI course",
        "passMark": 80,
        "estimatedMinutes": 15,
        "draft": true,
        "source": "WHO dIMCI Module 1 (2014)",
        "narrative": [
            "Below are questions about the module. You are allowed to use your Chart Booklet as you answer these questions. You should not use your study modules."
        ],
        "kind": "quiz",
        "questions": [
            {
                "id": "lb1",
                "type": "mcq",
                "question": "According to IMCI charts, a sick child is:",
                "options": [
                    "Under two months of age",
                    "Under 5 years of age",
                    "2 months up to 5 years of age"
                ],
                "correct": [
                    2
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb2",
                "type": "mcq",
                "question": "What is the first thing you do when a caregiver and child enter your clinic room?",
                "options": [
                    "Take the child and examine him",
                    "Greet the caregiver to make her feel welcome",
                    "Give the child treatment"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb3",
                "type": "mcq",
                "question": "Sami is 2 months old. Sami is a:",
                "options": [
                    "A sick young infant",
                    "A sick child",
                    "Neither"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb4",
                "type": "mcq",
                "question": "What important information do you need about the child before you begin your assessment?",
                "options": [
                    "If the child has general danger signs",
                    "Age, weight, temperature, child's problem according to caregiver, and if the visit is initial or follow-up",
                    "Why the caregiver came to the clinic"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb5",
                "type": "mcq",
                "question": "What is a general danger sign?",
                "options": [
                    "A sign that a sick young infant is ill",
                    "A sign that the child is beginning to get sick, so the mother should watch him more carefully at home",
                    "A sign of very serious illness in a sick child, which requires urgent referral"
                ],
                "correct": [
                    2
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb6",
                "type": "mcq",
                "question": "Which of the following is a general danger sign in sick children?",
                "options": [
                    "Vomiting frequently",
                    "Fast breathing",
                    "Unable to breastfeed, eat, or drink"
                ],
                "correct": [
                    2
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb7",
                "type": "mcq",
                "question": "How do you check if a child is unable to breastfeed or drink?",
                "options": [
                    "You can tell by looking because the child will be small",
                    "Ask the caregiver to give a drink or clean water or breast milk. See if the child will take the liquid into his mouth and swallow it.",
                    "Look at the child's lips to see if they are dry"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb8",
                "type": "mcq",
                "question": "How would you explain \"convulsions\" to a caregiver?",
                "options": [
                    "The child's arms and legs stiffen, and he might lose consciousness.",
                    "The child will fall on the floor and his body will shake violently.",
                    "The child's face muscles will twitch."
                ],
                "correct": [
                    0
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb9",
                "type": "mcq",
                "question": "How will you determine if a child is vomiting everything?",
                "options": [
                    "Ask if the child has been vomiting frequently.",
                    "Ask the caregiver if the child has vomited everything that they swallowed or drank. If they are unsure, give the child something to drink and see if they vomit.",
                    "Ask if the child has vomited at least 5 times in the past 24 hours, because the frequency of vomiting determines this sign."
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb10",
                "type": "mcq",
                "question": "If a child is lethargic, how does he look and act?",
                "options": [
                    "He is drowsy and is not alert or awake. He will not show interest in what is happening around him, he only stares ahead.",
                    "His eyes are closed, and he appears unconscious.",
                    "He will respond once you speak or clap."
                ],
                "correct": [
                    0
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb11",
                "type": "mcq",
                "question": "If a child is unconscious, how does he look and act?",
                "options": [
                    "His eyes follow your hand if you wave in front of his face.",
                    "He acts very sleepy.",
                    "He will not wake, even when someone shakes him. His eyes could be closed or open. If they are open, they do not follow any objects."
                ],
                "correct": [
                    2
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb12",
                "type": "mcq",
                "question": "If a child has a general danger sign, what are the steps taken?",
                "options": [
                    "Stop everything and send the child to the hospital.",
                    "Complete the IMCI assessment without delay so that you can determine if the child has any other critical health issues. Identify and give pre-referral treatments, and prepare a referral note.",
                    "Counsel the mother on home treatment and feeding"
                ],
                "correct": [
                    1
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb13",
                "type": "mcq",
                "question": "If a child has a severe (RED) classification and needs to be urgently referred, how do you determine the pre-referral treatment?",
                "options": [
                    "Use your best guess to decide on a treatment for whatever is causing the severe illness",
                    "No pre-referral treatment needed, send the child immediately to the hospital to not delay.",
                    "Pre-referral treatments are listed in bold type in the classification tables. Give all pre-referral treatments for all classifications."
                ],
                "correct": [
                    2
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb14",
                "type": "mcq",
                "question": "Important pre-referral treatments include:",
                "options": [
                    "Treating low blood sugar",
                    "Breastfeeding assessments and counselling for feeding problems",
                    "Oral rehydration therapy in the clinic"
                ],
                "correct": [
                    0
                ],
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb15",
                "type": "tf",
                "question": "Every child is checked for general danger signs.",
                "correct": true,
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb16",
                "type": "tf",
                "question": "Only children who are unconscious require urgent referral.",
                "correct": false,
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb17",
                "type": "tf",
                "question": "A child whose nose is blocked may have trouble breastfeeding. You must clear the nose to check if the child is able to drink.",
                "correct": true,
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb18",
                "type": "tf",
                "question": "If a child has a general danger sign, stop the assessment immediately and send them to the hospital.",
                "correct": false,
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb19",
                "type": "tf",
                "question": "If referral is not possible, there is not much you can do, so you should send the child home.",
                "correct": false,
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            },
            {
                "id": "lb20",
                "type": "tf",
                "question": "IMCI for the sick child and young infant are exactly the same.",
                "correct": false,
                "explain": "Answer key: Facilitator guide, Annex A3.2."
            }
        ]
    }
];

export const DIMCI_M1_PLAN = {
    "course": {
        "title": "IMNCI distance learning modules",
        "description": "Self-study modules based on the WHO IMCI distance learning course (2014), in the wording of the Sudan national IMNCI protocol.",
        "imageUrl": "",
        "isPublished": false,
        "source": "dimci"
    },
    "items": [
        {
            "kind": "module",
            "title": "Module 1: General danger signs for the sick child",
            "order": 1,
            "imageUrl": "",
            "isPublished": true,
            "legacyKey": "dimci-m1",
            "source": "dimci"
        },
        {
            "kind": "section",
            "legacyModuleKey": "dimci-m1",
            "title": "1.1 Module overview",
            "order": 1,
            "read": [
                {
                    "type": "paragraph",
                    "text": "During the first face-to-face meeting you learned that the IMCI process always begins by checking all children for signs of serious illness."
                },
                {
                    "type": "paragraph",
                    "text": "In the sick child aged 2 months up to 5 years these are called general danger signs. In this module you will learn about these signs"
                },
                {
                    "type": "note",
                    "text": "A sick child is 2 months up to 5 years of age. This means the child has not had his 5th birthday."
                },
                {
                    "type": "paragraph",
                    "text": "Note that the signs of serious illness for the sick young infant (under 2 months of age) are called general danger signs of serious disease. In Module 2 you will learn more about these signs and care for the sick young infant."
                },
                {
                    "type": "heading",
                    "text": "Module learning objectives"
                },
                {
                    "type": "paragraph",
                    "text": "After you study this module, you will know how to:"
                },
                {
                    "type": "list",
                    "items": [
                        "Greet a caregiver and get important information for IMCI",
                        "Recognize general danger signs in a sick child",
                        "Provide urgent pre-referral treatment according to IMCI instructions",
                        "Refer a child when danger signs are present"
                    ]
                },
                {
                    "type": "heading",
                    "text": "Module organization"
                },
                {
                    "type": "paragraph",
                    "text": "This module is divided into the following sections:"
                },
                {
                    "type": "list",
                    "items": [
                        "Greet the caregiver",
                        "Check for general danger signs",
                        "Care when urgent referral is required"
                    ]
                },
                {
                    "type": "heading",
                    "text": "Where does this module fit in the IMCI process?"
                },
                {
                    "type": "paragraph",
                    "text": "This module will focus specifically on the first two steps in the IMCI process - greeting the caregiver and checking for general danger signs. Look at the chart below to identify these two steps; they are the first two boxes."
                },
                {
                    "type": "heading",
                    "text": "What section of the IMCI recording form is used during this module?"
                },
                {
                    "type": "paragraph",
                    "text": "Review your IMCI recording form for the sick child. The top portions of this recording form are relevant to this module:"
                }
            ],
            "see": [
                {
                    "type": "form",
                    "part": "child",
                    "sections": [
                        "danger"
                    ],
                    "caption": "The national recording form: the top lines and the general danger signs row"
                }
            ],
            "practise": [
                {
                    "type": "exercise",
                    "exerciseId": "dimci-m1-pretest",
                    "note": "Do this before you study the module. You will answer the same questions in the post-test."
                }
            ],
            "bookFromPage": 5,
            "bookToPage": 7,
            "isPublished": true,
            "source": "dimci"
        },
        {
            "kind": "section",
            "legacyModuleKey": "dimci-m1",
            "title": "1.2 Checking all sick children for general danger signs",
            "order": 2,
            "read": [
                {
                    "type": "paragraph",
                    "text": "You will begin this module with a case study. This scene should be similar to situations that you see in your clinic. After you read the case study, you will learn how to: (a) greet the caregiver and get important information about the child, and (b) check for general danger signs."
                },
                {
                    "type": "rich",
                    "text": "<p><strong>Opening case study - Lebo</strong></p><blockquote><p>Lebo's grandmother carries him into the clinic. Lebo does not look well. She has walked for one hour to the clinic. She tells you that she is also taking care of 4 other grandchildren. Lebo is her youngest grandchild and she is very worried about him. She says he is acting very unwell and has had a cough for 7 days.</p></blockquote><blockquote><p>The grandmother tells you as she sits down that Lebo's mother died 2 months ago. She says she does not know what caused the mother to die. Lebo's father works away and does not come home, only once every year or so. The grandmother is very worried about Lebo and very tired from her walking.</p></blockquote><blockquote><p>She tells you this is the first time she is bringing Lebo in to the clinic. You ask her how old Lebo is. She says he is 19 months old. You ask Lebo's grandmother her name. She tells you that her name is Nthabeleng.</p></blockquote>"
                },
                {
                    "type": "heading",
                    "text": "What is the first thing you do when Nthabeleng comes to the clinic?"
                },
                {
                    "type": "paragraph",
                    "text": "The first step in the IMCI process is to greet the caregiver and ask about the child. Greeting the caregiver has two purposes."
                },
                {
                    "type": "paragraph",
                    "text": "First, greeting makes a caregiver feel welcome in the clinic. Greeting and welcoming a caregiver is an important first step in building trust. It begins good and caring communication."
                },
                {
                    "type": "paragraph",
                    "text": "Second, it helps you to gather important information about why the child is coming to the clinic."
                },
                {
                    "type": "heading",
                    "text": "Why is good communication with a caregiver important?"
                },
                {
                    "type": "paragraph",
                    "text": "Caregivers can be very stressed and emotional when a child is ill. It is important for health workers to communicate concern and care for the child's health, and the family's situation. Good communication helps to reassure the caregiver that her child will receive good care."
                },
                {
                    "type": "paragraph",
                    "text": "When you treat the child's illness later in the visit, you will need to teach and advise the caregiver about caring for her sick child at home. Good communication and trust is essential here. It is important to have good communication with the caregiver from the beginning of the visit."
                },
                {
                    "type": "heading",
                    "text": "What are good communication skills?"
                },
                {
                    "type": "paragraph",
                    "text": "Good communication skills involve the following:"
                },
                {
                    "type": "list",
                    "items": [
                        "LISTEN - Listen carefully to what the caregiver tells you. This shows you are taking her concerns seriously.",
                        "SIMPLIFY WORDS - Use words the caregiver understands. If she does not understand what you ask her, she cannot give the information you need to assess and classify the child correctly.",
                        "GIVE HER TIME - Give the caregiver time to answer the questions. She might need time to decide if a sign you are asking about is present.",
                        "BE CLEAR - Ask additional questions when the caregiver is not sure about her answer. If she is not sure that a certain symptom or sign is present, ask additional questions. Help her make her answers clearer.",
                        "PRAISE - Praise the caregiver for what she is doing right. This will reinforce good practices."
                    ]
                },
                {
                    "type": "heading",
                    "text": "What is the important information you gather during a greeting?"
                },
                {
                    "type": "paragraph",
                    "text": "When you greet a caregiver you begin to ask important information about the child. This will help you in your assessment."
                },
                {
                    "type": "heading",
                    "text": "Age"
                },
                {
                    "type": "paragraph",
                    "text": "The child's age determines which IMCI charts to use - the sick child or the young infant."
                },
                {
                    "type": "heading",
                    "text": "Child's problem"
                },
                {
                    "type": "paragraph",
                    "text": "Another important piece of information is why the caregiver is bringing the child to the clinic. By asking the caregiver about the problem, you can make note of the symptoms or health problems that are worrying them. If necessary, you can ask further detail. For example, you might ask how long the symptom has been present, or if it has been getting worse."
                },
                {
                    "type": "paragraph",
                    "text": "You can also ask the caregiver how she has been addressing the health problem thus far. This will give you background about previous care given in the home, community, or other facilities."
                },
                {
                    "type": "heading",
                    "text": "Weight and temperature"
                },
                {
                    "type": "paragraph",
                    "text": "Lastly, you will determine the child's weight and temperature. Check if this is already recorded on the child's card. If not, weigh the child and measure his temperature later when you assess and classify the child's main symptoms. Do not undress or disturb the child now."
                },
                {
                    "type": "heading",
                    "text": "Initial or follow up visit"
                },
                {
                    "type": "paragraph",
                    "text": "You also want to know if this is the first visit for this problem, or if this is a follow-up visit. These visits are different, so this is another important piece of information."
                },
                {
                    "type": "rich",
                    "text": "<p><em>ASK: first time coming to the clinic for this problem?</em></p><table style=\"width: 100%\"><tr><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">YES</td><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">NO</td></tr><tr><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">INITIAL VISIT<br>ASSESS and CLASSIFY according to IMCI</td><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">FOLLOW-UP VISIT<br>Give follow-up care according to IMCI</td></tr></table>"
                },
                {
                    "type": "paragraph",
                    "text": "This is an initial visit if it is the child's first for this episode of illness."
                },
                {
                    "type": "paragraph",
                    "text": "This is a follow-up visit if the child was seen a few days ago for the same problem. You will learn more about what to do for follow-up visits in the later modules."
                },
                {
                    "type": "rich",
                    "text": "<p><strong>Let us return to the case of Lebo</strong></p><blockquote><p>Which charts will you use for Lebo? Nthabeleng said that Lebo is 19 months old, so you will use charts for the sick child.</p></blockquote><blockquote><p>What is Lebo's problem? Nthabeleng tells you that Lebo has had a cough for 7 days. She also says that he has not been eating well. Nthabeleng is very worried about this. She says that in the past two days, he cannot take anything at all and she says he is very weak. This is concerning to you.</p></blockquote><blockquote><p>Is Lebo coming for an initial or follow-up visit? Nthabeleng told you that this is her first time bringing him to the clinic for this issue. This is an initial visit. Lebo's temperature and weight were recorded when he came into the clinic, he weighs 10 kg and his temperature is 37 Celsius.</p></blockquote><blockquote><p>How will you fill out the top of Lebo's recording form?</p></blockquote>"
                },
                {
                    "type": "rich",
                    "text": "<p><strong>For ALL sick children - ask the caregiver about the child's problems, then CHECK EVERY SICK CHILD FOR GENERAL DANGER SIGNS</strong></p><ul><li><strong>NO signs present:</strong> continue the assessment</li><li><strong>YES, one or more signs present:</strong> Child requires urgent referral. Continue assessment quickly so referral is not delayed.</li></ul><p>CONTINUE ASSESSMENT: assess for main symptoms (cough or difficult breathing, diarrhoea, fever, ear problems), check for malnutrition &amp; anaemia, check immunization status, HIV status, and other problems</p>"
                },
                {
                    "type": "heading",
                    "text": "After greeting the caregiver, how do you begin assessing the child?"
                },
                {
                    "type": "paragraph",
                    "text": "The first thing you check every sick child for is general danger signs. These signs are critically important. If Lebo shows any one of these signs, he is in danger. He needs urgent pre-referral treatment and immediate referral to the hospital."
                },
                {
                    "type": "heading",
                    "text": "What is a general danger sign?"
                },
                {
                    "type": "paragraph",
                    "text": "A general danger sign is present if:"
                },
                {
                    "type": "list",
                    "items": [
                        "Child is not able to drink or breastfeed",
                        "Child vomits everything",
                        "Child has had more than one convulsion or prolonged convulsions, or is convulsing",
                        "Child is lethargic or unconscious"
                    ]
                },
                {
                    "type": "heading",
                    "text": "How will you check for a general danger sign?"
                },
                {
                    "type": "paragraph",
                    "text": "Assessing for general danger signs involves four steps. You will ASK three questions and LOOK to observe the child's actions."
                },
                {
                    "type": "paragraph",
                    "text": "Open your Chart Booklet to the chart for general danger signs. You will see these instructions:"
                },
                {
                    "type": "rich",
                    "text": "<p><em>CHECK FOR GENERAL DANGER SIGNS</em></p><table style=\"width: 100%\"><tr><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">Ask:</td><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">Look:</td></tr><tr><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">Is the child able to drink or breastfeed?<br>Does the child vomit everything?<br>Has the child had convulsions?</td><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">See if the child is lethargic or unconscious.<br>Is the child convulsing now?</td></tr></table>"
                },
                {
                    "type": "heading",
                    "text": "Ask - Is your child able to drink or breastfeed?"
                },
                {
                    "type": "paragraph",
                    "text": "A child has the sign not able to drink or breastfeed if the child is not able to suck or swallow when offered a drink or breast milk."
                },
                {
                    "type": "paragraph",
                    "text": "When you ask the caregiver if the child is able to drink, make sure that she understands the question. If she says that her child is not able to drink or breastfeed, ask her to describe what happens when she offers the child something to drink. For example, is the child able to take fluid into his mouth and swallow it? If you are not sure about the caregiver's answer, ask her to offer the child a drink of clean water or breast milk. Look to see if the child is swallowing the water or breast milk."
                },
                {
                    "type": "paragraph",
                    "text": "A child who is breastfed may have difficulty sucking when his nose is blocked. If the child's nose is blocked, clear it. If the child can breastfeed after the nose is cleared, the child does not have the danger sign, \"not able to drink or breastfeed.\""
                },
                {
                    "type": "heading",
                    "text": "Ask - Does your child vomit everything?"
                },
                {
                    "type": "paragraph",
                    "text": "A child who is not able to hold anything down at all has the sign \"vomits everything\" - everything that goes down comes back up. A child who vomits everything will not be able to hold down food, fluids, or oral drugs. A child who vomits several times but can hold down some fluids does not have this general danger sign."
                },
                {
                    "type": "paragraph",
                    "text": "When you ask the question, use words that the caregiver understands. Give her time to answer. If the caregiver is not sure if the child is vomiting everything, help her to make her answer clear. For example, ask the caregiver how often the child vomits. Also ask if each time the child swallows food or fluids, does the child vomit? If you are not sure of the caregiver's answers, ask her to offer the child a drink. See if the child vomits."
                },
                {
                    "type": "heading",
                    "text": "Ask - Has your child had convulsions?"
                },
                {
                    "type": "paragraph",
                    "text": "Ask the caregiver if the child has had more than one convulsion, or prolonged convulsions, during this current illness."
                },
                {
                    "type": "paragraph",
                    "text": "During a convulsion, the child's arms and legs stiffen because the muscles are contracting. The child may lose consciousness or not be able to respond to spoken directions. Use words the caregiver understands. For example, the caregiver may call convulsions \"fits\" or \"spasms.\""
                },
                {
                    "type": "heading",
                    "text": "Look - Is the child lethargic or unconscious?"
                },
                {
                    "type": "paragraph",
                    "text": "A lethargic child is not awake and alert when she should be. The child is drowsy and does not show interest in what is happening around her."
                },
                {
                    "type": "paragraph",
                    "text": "Often the lethargic child does not look at his caregiver or watch your face when you talk, or will not respond if you clap or snap your fingers. The child may stare blankly and appear not to notice what is going on around him."
                },
                {
                    "type": "paragraph",
                    "text": "An unconscious child cannot be wakened. He does not respond when he is touched, shaken, or spoken to. Ask the caregiver if the child seems unusually sleepy or if she cannot wake the child. Look to see if the child wakens when the caregiver talks or shakes the child or when you clap your hands."
                },
                {
                    "type": "heading",
                    "text": "What do you do if a child shows one or more general danger signs?"
                },
                {
                    "type": "paragraph",
                    "text": "A child with a general danger sign has a serious problem. Most children with a general danger sign need urgent referral to hospital. The child might need lifesaving treatment with injectable antibiotics, oxygen, or other treatments that may not be available in your clinic."
                },
                {
                    "type": "rich",
                    "text": "<p><strong>If a child has a general danger sign, you must take IMMEDIATE ACTION</strong></p><ol><li>Complete assessment immediately - the child has a severe problem. There must be no delay in treatment.</li><li>Provide urgent pre-referral treatment</li><li>Refer child to hospital</li></ol>"
                },
                {
                    "type": "rich",
                    "text": "<p><strong>Does Lebo show any general danger signs?</strong></p><blockquote><p>You ask if Lebo is able to drink or breastfeed, and Nthabeleng says, \"no, not today, he is too tired.\" You try to give him some water from a cup but he is too weak and does not swallow. You ask Nthabeleng if Lebo is vomiting, and she says \"no.\" You ask if Lebo is having convulsions, and Nthabeleng says \"no.\"</p></blockquote><blockquote><p>You look at Lebo's condition. He is not paying attention to you or Nthabeleng as you talk, and only stares ahead. You snap your fingers in front of his face, but he does not look at the fingers. You ask Nthabeleng to bounce Lebo and speak to him, and when she says \"Lebo! Lebo!\" he does not look up at her.</p></blockquote><blockquote><p>Lebo is showing two general danger signs - he is unable to drink and lethargic. He needs to be referred immediately to the hospital.</p></blockquote>"
                },
                {
                    "type": "rich",
                    "text": "<p><strong>What will you do for Lebo and Nthabeleng?</strong></p><blockquote><p>You tell Nthabeleng that you think Lebo needs further treatment at the hospital because he is unable to drink and now acting very tired. You tell her that it is very important that he go to the hospital right away. You will help arrange for her to get there.</p></blockquote><blockquote><p>She looks very scared and asks if Lebo will die like his mother. She says that this must be because of something she has done. You affirm Nthabeleng and tell her that this is because Lebo is sick, not because of her actions. You explain that the treatment in the hospital will be able to help. You reassure her that she was a very good grandmother to bring Lebo to the clinic for care. She was very alert to notice that he was unwell.</p></blockquote><blockquote><p>You tell her that you will start some immediate treatment now so that he can be stable during the journey to the hospital. Reassure her that you will help her, and that this treatment is very important.</p></blockquote><blockquote><p>You will then complete the assessment with Lebo and decide what pre-referral treatment is necessary. Nthabeleng told you that Lebo has a cough. You have determined that he has two general danger signs. You must complete his classification for the cough during your assessment to determine necessary pre-referral treatment.</p></blockquote><blockquote><p>Now you will learn more about how to identify and administer pre-referral treatment.</p></blockquote>"
                },
                {
                    "type": "heading",
                    "text": "How does the assessment continue after checking for general danger signs?"
                },
                {
                    "type": "paragraph",
                    "text": "A child with any general danger sign needs URGENT attention. You should complete the assessment and administer any pre-referral treatment immediately so that the referral is not delayed."
                },
                {
                    "type": "paragraph",
                    "text": "You will learn much more about this assessment process in the following self-study modules. For now, remember that you will follow the IMCI instructions through this process. Your chart booklet walks you through these instructions."
                },
                {
                    "type": "heading",
                    "text": "First, assess for main symptoms"
                },
                {
                    "type": "paragraph",
                    "text": "These are symptoms of the most common causes of illness and death in children under five years. When a main symptom is present, a child could have a serious illness. These symptoms include cough or difficult breathing (Module 3), diarrhoea (Module 4), and fever (Module 5). A number of illnesses - including pneumonia, malaria, or an infection - cause these symptoms."
                },
                {
                    "type": "heading",
                    "text": "Second, assess the child's nutritional status"
                },
                {
                    "type": "paragraph",
                    "text": "You have learned that undernutrition is a very common underlying cause of child mortality. Even children with mild and moderate malnutrition have an increased risk of death. When a caregiver brings her child to the clinic, it is usually because the child has an acute illness."
                },
                {
                    "type": "paragraph",
                    "text": "A sick child can be malnourished, but you or the child's family may not notice the problem. The child may have no complaints that point to malnutrition or anaemia. Module 6 discusses how to assess, classify, and treat malnutrition and anaemia."
                },
                {
                    "type": "heading",
                    "text": "Then check immunizations, HIV status, and other problems"
                },
                {
                    "type": "paragraph",
                    "text": "Modules 7, 8, 9, and additional modules explain these assessments."
                }
            ],
            "see": [
                {
                    "type": "rich",
                    "text": "<p><strong>Video script: Checking all sick children for general danger signs</strong> (to be produced; scene caption, then voiceover)</p><ol><li><strong>Every sick child is checked first</strong><br>The IMCI process always begins by checking every sick child for signs of serious illness. In a sick child aged 2 months up to 5 years, these are called general danger signs.</li><li><strong>Meet Lebo</strong><br>Lebo's grandmother carries him into the clinic. She has walked for one hour, and she is very worried. She says he is acting very unwell and has had a cough for 7 days. This is the first time she is bringing him to the clinic. What is the first thing you do?</li><li><strong>Greet the caregiver</strong><br>First, greet the caregiver and ask about the child. Greeting makes the caregiver feel welcome and begins to build trust. It also helps you learn why the child has come. Listen carefully. Use words she understands. Give her time to answer. Ask more questions when she is not sure. And praise her for what she is doing right.</li><li><strong>Gather the important information</strong><br>During the greeting, gather this information. The child's age tells you which charts to use: the young infant charts under 2 months, and the sick child charts from 2 months up to 5 years. Ask what the child's problems are. Check the child's card for weight and temperature. If they are not recorded, measure them later, and do not undress or disturb the child now. Last, ask if this is an initial visit for this problem, or a follow-up visit.</li><li><strong>Lebo's information</strong><br>Lebo is 19 months old, so you use the sick child charts. He has had a cough for 7 days, and for the past two days he cannot take anything at all. This is an initial visit. He weighs 10 kilograms, and his temperature is 37 degrees.</li><li><strong>Check for general danger signs</strong><br>Now check for general danger signs. Open your chart booklet. You will ASK three questions, and LOOK at the child.</li><li><strong>Ask: able to drink or breastfeed?</strong><br>Ask: is the child able to drink or breastfeed? A child has this sign if he is not able to suck or swallow when offered a drink or breast milk. If you are not sure, ask the caregiver to offer a drink of clean water or breast milk, and watch. If the nose is blocked, clear it first.</li><li><strong>Ask: vomits everything?</strong><br>Ask: does the child vomit everything? This means everything that goes down comes back up. A child who vomits several times but can hold down some fluids does not have this sign.</li><li><strong>Ask: convulsions?</strong><br>Ask: has the child had convulsions? Ask about more than one convulsion, or prolonged convulsions, during this illness. The caregiver may call them fits or spasms.</li><li><strong>Look: lethargic or unconscious?</strong><br>Then look: is the child lethargic or unconscious? A lethargic child is drowsy when he should be awake, and shows no interest in what is happening around him. An unconscious child cannot be wakened, even when touched, shaken or spoken to. Clap your hands, and see if the child responds.</li><li><strong>Lebo has two danger signs</strong><br>Lebo is too weak to swallow water from a cup. He does not look up when his grandmother calls his name. He has two general danger signs: he is not able to drink, and he is lethargic.</li><li><strong>Take immediate action</strong><br>A child with any general danger sign needs urgent attention. Take immediate action: complete the assessment quickly, give urgent pre-referral treatment, and refer the child to hospital. Now go to the Practise tab and complete Exercises A, B and C.</li></ol>"
                },
                {
                    "type": "rich",
                    "text": "<p><strong>Video: Introduction</strong> - This video will review the important steps of the IMCI greeting.</p><p><em>Not added yet: IMCI DVD disc 1: \"Introduction\". Add it as a video card once the clip is uploaded.</em></p>"
                },
                {
                    "type": "form",
                    "part": "child",
                    "sections": [
                        "danger"
                    ],
                    "caption": "The national recording form: the top lines and the general danger signs row"
                },
                {
                    "type": "booklet",
                    "part": "child",
                    "categories": [
                        "danger"
                    ],
                    "caption": "Chart booklet: check for general danger signs"
                },
                {
                    "type": "rich",
                    "text": "<p><strong>Video: Demonstration: danger signs</strong> - This video shows examples of children with general danger signs. It is very useful to see these signs in the clinical setting.</p><p><em>Not added yet: IMCI DVD disc 1: \"Demonstration: danger signs\". Add it as a video card once the clip is uploaded.</em></p>"
                }
            ],
            "practise": [
                {
                    "type": "exercise",
                    "exerciseId": "dimci-m1-ex-a",
                    "note": ""
                },
                {
                    "type": "rich",
                    "text": "<p><strong>DVD exercise - General danger signs</strong></p><p>Watch \"Assess general condition\" (disc 1) to identify if the four children are lethargic or unconscious. Write your answers and reasons below. The video will review the correct answers with you.</p><p><em>Not added yet: IMCI DVD disc 1: \"Assess general condition\". NOTE: All video exercises discuss answers in the video.</em></p>"
                },
                {
                    "type": "exercise",
                    "exerciseId": "dimci-m1-ex-b",
                    "note": ""
                },
                {
                    "type": "exercise",
                    "exerciseId": "dimci-m1-ex-c-salina",
                    "note": "Fill in the recording form for Salina."
                },
                {
                    "type": "exercise",
                    "exerciseId": "dimci-m1-lebo",
                    "note": "Practise on the module case: fill in the recording form for Lebo."
                }
            ],
            "bookFromPage": 8,
            "bookToPage": 17,
            "isPublished": true,
            "source": "dimci"
        },
        {
            "kind": "section",
            "legacyModuleKey": "dimci-m1",
            "title": "1.3 Care when urgent referral is required",
            "order": 3,
            "read": [
                {
                    "type": "heading",
                    "text": "When is urgent referral required?"
                },
                {
                    "type": "paragraph",
                    "text": "Children with general danger signs and/or any condition with a red classification require urgent pre-referral treatment and referral. These classifications indicate very serious illness. Review the CLASSIFY table for general danger signs below. This is a red classification. You will also see the identified treatments in the right-side TREAT column."
                },
                {
                    "type": "booklet",
                    "part": "child",
                    "categories": [
                        "danger"
                    ],
                    "caption": "General danger signs (Sudan national IMNCI booklet)"
                },
                {
                    "type": "note",
                    "label": "Sudan national protocol",
                    "text": "Sudan national booklet: Two rows: \"General danger sign: convulsing now\" and \"General danger sign present\". The diazepam step adds airway care and a repeat dose after 10 minutes. No \"keep the child warm\" line. WHO module (page 18): One pink row, \"Any general danger sign\" classified as VERY SEVERE DISEASE: give diazepam if convulsing now; quickly complete the assessment; give any pre-referral treatment immediately; treat to prevent low blood sugar; keep the child warm; refer URGENTLY."
                },
                {
                    "type": "paragraph",
                    "text": "It is important to remember that once you have identified a general danger sign, you must conduct the IMCI assessment and determine any pre-referral treatment so that you do not delay the referral."
                },
                {
                    "type": "heading",
                    "text": "How do you determine urgent pre-referral treatment?"
                },
                {
                    "type": "paragraph",
                    "text": "Urgent pre-referral treatments are in bold print on the classification charts in your chart booklet. Open your classification tables: do you see the treatment identified in bold? For example, the DYSENTERY classification below specifies ciprofloxacin as a pre-referral treatment."
                },
                {
                    "type": "booklet",
                    "part": "child",
                    "categories": [
                        "dysentery"
                    ],
                    "caption": "Dysentery (Sudan national IMNCI booklet)"
                },
                {
                    "type": "note",
                    "label": "Sudan national protocol",
                    "text": "Sudan national booklet: Ciprofloxacin for 3 days, zinc for 14 days, follow up in 3 days. WHO module (page 18): Give ciprofloxacin for 3 days; follow-up in 2 days (no zinc line)."
                },
                {
                    "type": "paragraph",
                    "text": "These are specified because some treatments should not be given before referral. Treatments that are not urgently needed will only delay referral. For example, do not teach a caregiver how to treat a local infection or give immunizations before referral."
                },
                {
                    "type": "heading",
                    "text": "Flip through your chart booklet to see the pre-referral treatments:"
                },
                {
                    "type": "paragraph",
                    "text": "As you look through your charts, can you see the bold pre-referral treatments? Look through each chart and identify the pre-referral treatments in bold. Here are some examples of what you will see. You will learn more about the classifications below in upcoming modules."
                },
                {
                    "type": "rich",
                    "text": "<p><em>Pre-referral treatments (Sudan national IMNCI booklet)</em></p><table style=\"width: 100%\"><tr><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">Classification</td><td style=\"background-color: #ffffff; color: #0f172a; padding: 6px\">Pre-referral treatment identified</td></tr><tr><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">SEVERE PNEUMONIA or VERY SEVERE DISEASE</td><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">First dose of antibiotic: oral amoxicillin if the child can take oral medicine; if the child cannot drink, vomits everything, is convulsing or lethargic, first dose of IM ampicillin and IM gentamicin. If wheezing, a rapid-acting inhaled bronchodilator. Treat to prevent low blood sugar</td></tr><tr><td style=\"background-color: #fef3c7; color: #78350f; padding: 6px\">PNEUMONIA</td><td style=\"background-color: #fef3c7; color: #78350f; padding: 6px\">Oral amoxicillin for 5 days (treated in the clinic)</td></tr><tr><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">SEVERE or SOME DEHYDRATION (with another severe classification)</td><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">Refer urgently with the mother giving frequent sips of ORS on the way, and advise her to continue breastfeeding</td></tr><tr><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">VERY SEVERE FEBRILE DISEASE</td><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">First dose of IM quinine; first dose of antibiotic (as for severe pneumonia); one dose of paracetamol for high fever (38.5 °C or above); treat to prevent low blood sugar</td></tr><tr><td style=\"background-color: #fef3c7; color: #78350f; padding: 6px\">MALARIA</td><td style=\"background-color: #fef3c7; color: #78350f; padding: 6px\">Artemether-lumefantrine; one dose of paracetamol in clinic for high fever (38.5 °C or above)</td></tr><tr><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">COMPLICATED SEVERE ACUTE MALNUTRITION</td><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">First dose of antibiotic (as for severe pneumonia); treat to prevent low blood sugar; advise the mother to keep the child warm</td></tr><tr><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">SEVERE COMPLICATED MEASLES (and other measles classifications)</td><td style=\"background-color: #ffe4e6; color: #881337; padding: 6px\">Vitamin A treatment, and treatment of eye or mouth complications</td></tr></table>"
                },
                {
                    "type": "note",
                    "label": "Sudan national protocol",
                    "text": "Sudan national booklet: Rows use the Sudan names and treatments listed above. WHO module (page 19): WHO table (p. 19): SEVERE PNEUMONIA or VERY SEVERE DISEASE - first dose of an appropriate antibiotic, treat for low blood sugar. PNEUMONIA - first dose of oral amoxicillin. SEVERE or SOME DEHYDRATION (with another severe classification) - frequent sips of ORS on the way, continue breastfeeding. VERY SEVERE FEBRILE DISEASE - treatment for malaria if necessary, first doses of antibiotic and paracetamol for high fever. MEASLES - treatment for malaria if necessary, first dose of paracetamol for high fever. SEVERE ACUTE MALNUTRITION - low blood sugar, keep warm, first dose of antibiotic. Measles-related classifications - Vitamin A, and treatment if complications."
                },
                {
                    "type": "heading",
                    "text": "How do you urgently refer the child?"
                },
                {
                    "type": "paragraph",
                    "text": "There are four steps to referring a child or a sick young infant to hospital:"
                },
                {
                    "type": "heading",
                    "text": "1. EXPLAIN to the caregiver the need for referral, and get her agreement to take the child."
                },
                {
                    "type": "paragraph",
                    "text": "If you suspect that she does not want to take the child, find out why. Possible reasons might be:"
                },
                {
                    "type": "list",
                    "items": [
                        "She thinks hospitals are places where people often die. She fears her child will die there too.",
                        "She does not think that the hospital will help the child.",
                        "She cannot leave home and stay in the hospital to care for her child, if there is no one to take care of her other children, or she is needed for farming, or she may lose a job.",
                        "She does not have money to pay for transportation, hospital bills, medicines, or food for herself during the hospital stay."
                    ]
                },
                {
                    "type": "heading",
                    "text": "2. CALM the caregiver's fears and help her resolve any problems."
                },
                {
                    "type": "paragraph",
                    "text": "For example: if the caregiver fears that her child will die at the hospital, reassure her that the hospital has physicians, supplies, and equipment that can help cure her child."
                },
                {
                    "type": "list",
                    "items": [
                        "Explain what will happen at the hospital and how that will help her child.",
                        "If the caregiver needs help at home while she is at the hospital, ask questions and make suggestions about who could help. For example, ask whether her husband, sister or caregiver could help with the other children or with meals while she is away.",
                        "Discuss how she can travel to the hospital. Help arrange transportation if necessary.",
                        "You may not be able to help the caregiver solve her problems and be sure that she goes to the hospital. However, it is important to do everything you can to help."
                    ]
                },
                {
                    "type": "heading",
                    "text": "3. WRITE A REFERRAL NOTE for the caregiver to carry."
                },
                {
                    "type": "paragraph",
                    "text": "Tell her to give it to the health worker there. The note should include:"
                },
                {
                    "type": "list",
                    "items": [
                        "The name and age of the infant or child",
                        "The date and time of referral",
                        "Description of the child's problems",
                        "The reason for referral (signs/symptoms for classification)",
                        "Treatment that you have given",
                        "Any other information that the hospital needs to know in order to care for the child, such as earlier treatment of the illness or immunizations needed",
                        "Your name and the name of your clinic"
                    ]
                },
                {
                    "type": "heading",
                    "text": "4. GIVE SUPPLIES AND INSTRUCTIONS NEEDED to care for her child on the way to the hospital:"
                },
                {
                    "type": "paragraph",
                    "text": "If the hospital is far, give the caregiver additional doses of antibiotic and tell her when to give them during the trip (according to dosage schedule on the TREAT chart). If you think the caregiver will not actually go to the hospital, give her the full course of antibiotics, and teach her how to give them."
                },
                {
                    "type": "list",
                    "items": [
                        "Tell the caregiver how to keep the young child warm during the trip.",
                        "Advise the caregiver to continue breastfeeding.",
                        "If the child has some or severe dehydration and can drink, give the caregiver some ORS solution for the child to sip frequently on the way."
                    ]
                },
                {
                    "type": "note",
                    "text": "REMEMBER: any child with a general danger sign or a serious classification requires urgent referral."
                },
                {
                    "type": "heading",
                    "text": "What if referral is not possible?"
                },
                {
                    "type": "paragraph",
                    "text": "The best possible treatment for a child with a very severe illness is usually at a hospital. Sometimes referral is not possible or not advisable. Distances to a hospital might be too far; the hospital might not have adequate equipment or staff to care for the child; transportation might not be available. Sometimes parents refuse to take a child to a hospital, in spite of the health worker's effort to explain the need for it."
                },
                {
                    "type": "paragraph",
                    "text": "If referral is not possible, you should do whatever you can to help the family care for the child. If referral is not possible, continue with pre-referral treatment until the child is able to leave for the hospital. If the child improves on pre-referral treatment, initiate treatment in the clinic (e.g. the YELLOW classification). Advise the caregiver on all available treatment."
                },
                {
                    "type": "paragraph",
                    "text": "To help reduce deaths in severely ill children who cannot be referred, you may need to arrange to have the child stay in or near the clinic where he may be seen several times a day. If not possible, arrange for visits at home. There is more information about when a referral is not possible in the ANNEX."
                },
                {
                    "type": "rich",
                    "text": "<p><strong>When you can refer, remember to:</strong></p><ol><li>Explain to the mother</li><li>Calm fears</li><li>Write a referral note</li><li>Give supplies &amp; instructions for journey</li></ol>"
                },
                {
                    "type": "rich",
                    "text": "<p><strong>How will you refer Lebo?</strong></p><blockquote><p>You have completed Lebo's assessment. You give him the urgent pre-referral treatments indicated in bold on the classification charts where you classified his other conditions.</p></blockquote><blockquote><p>You prepare the referral note for Nthabeleng and Lebo, give her the necessary instructions for treatment on the way to the hospital.</p></blockquote><blockquote><p>She is nervous but you tell her that this treatment is urgent and should help Lebo, and that she is taking very good care of him to be so alert and bring him to the clinic all herself. You tell her that she is being a very good grandmother for taking him to the hospital for this treatment, and that it is very important for his health.</p></blockquote>"
                }
            ],
            "see": [
                {
                    "type": "rich",
                    "text": "<p><strong>Video script: Care when urgent referral is required</strong> (to be produced; scene caption, then voiceover)</p><ol><li><strong>Who needs urgent referral?</strong><br>A child with any general danger sign, or with any red classification, has a very serious illness. This child needs urgent pre-referral treatment, and urgent referral to hospital.</li><li><strong>Convulsing now</strong><br>If the child is convulsing now, manage the airway and turn the child on the side. Give diazepam rectally. If the convulsions have not stopped after 10 minutes, repeat the dose. Treat the child to prevent low blood sugar, and refer urgently.</li><li><strong>Any other general danger sign</strong><br>For any other general danger sign, complete the assessment and any pre-referral treatment immediately, so that referral is not delayed. Treat the child to prevent low blood sugar, and refer urgently.</li><li><strong>Look for the bold treatments</strong><br>Urgent pre-referral treatments are printed in bold on the classification charts. Open your chart booklet and find them. Give only these before referral. Treatments that are not urgent, such as teaching how to treat a local infection or giving immunizations, will only delay the referral.</li><li><strong>Step 1. Explain</strong><br>There are four steps to referral. First, explain to the caregiver why the child must go to hospital, and get her agreement. If she does not want to go, find out why. She may fear the hospital, doubt it will help, have no one to care for her other children, or have no money for transport and food.</li><li><strong>Step 2. Calm her fears</strong><br>Second, calm her fears and help her solve her problems. Explain what will happen at the hospital and how it will help her child. Ask who could help at home while she is away, and help arrange transport if needed.</li><li><strong>Step 3. Write a referral note</strong><br>Third, write a referral note for her to give to the health worker at the hospital. Include the child's name and age, the date and time, the child's problems, the reason for referral, the treatment you gave, anything else the hospital needs to know, and your name and the name of your clinic.</li><li><strong>Step 4. Supplies and instructions</strong><br>Fourth, give the supplies and instructions she needs on the way. If the hospital is far, give extra doses of antibiotic and tell her when to give them. Tell her how to keep the child warm, and to continue breastfeeding. If the child has some or severe dehydration and can drink, give ORS for the child to sip often on the way.</li><li><strong>If referral is not possible</strong><br>Sometimes referral is not possible. Then do whatever you can to help the family. Continue pre-referral treatment until the child can leave. If the child improves, start treatment in the clinic. You may arrange for the child to stay in or near the clinic, to be seen several times a day, or arrange home visits.</li><li><strong>Lebo goes to hospital</strong><br>You have completed Lebo's assessment and given him the urgent pre-referral treatments in bold. You write the referral note, give Nthabeleng her instructions for the journey, and tell her she is a very good grandmother for bringing him. Now go to the Practise tab and complete Exercise D.</li></ol>"
                },
                {
                    "type": "booklet",
                    "part": "child",
                    "categories": [
                        "danger"
                    ],
                    "caption": "Chart booklet: check for general danger signs"
                },
                {
                    "type": "booklet",
                    "part": "child",
                    "categories": [
                        "dysentery"
                    ],
                    "caption": "Chart booklet: dysentery"
                }
            ],
            "practise": [
                {
                    "type": "exercise",
                    "exerciseId": "dimci-m1-ex-d",
                    "note": ""
                }
            ],
            "bookFromPage": 18,
            "bookToPage": 21,
            "isPublished": true,
            "source": "dimci"
        },
        {
            "kind": "section",
            "legacyModuleKey": "dimci-m1",
            "title": "1.4 Using this module in your clinic",
            "order": 4,
            "read": [
                {
                    "type": "heading",
                    "text": "How will you begin to apply the knowledge you have gained from this module in your clinic?"
                },
                {
                    "type": "paragraph",
                    "text": "Use your Chart Booklet and IMCI recording forms as you practice in the clinic. In the coming days, you should focus on the clinical skills below."
                },
                {
                    "type": "heading",
                    "text": "Greeting"
                },
                {
                    "type": "list",
                    "items": [
                        "Greet caregivers and use good communication skills to make them feel welcome in the clinic.",
                        "Ask for important information from the caregiver: child's name, age, problems, history, etc."
                    ]
                },
                {
                    "type": "heading",
                    "text": "General danger signs"
                },
                {
                    "type": "list",
                    "items": [
                        "Check all children for general danger signs",
                        "Use your Chart Booklet when checking children to ensure that you ASK, LOOK, and FEEL for all signs",
                        "Record what you find on the IMCI recording form for sick children",
                        "If the child has a general danger sign, classify as GENERAL DANGER SIGN PRESENT (VERY SEVERE DISEASE in the WHO module)",
                        "If a child has a danger sign, practice preparing a caregiver for referral"
                    ]
                },
                {
                    "type": "note",
                    "label": "Sudan national protocol",
                    "text": "Sudan national booklet: The classification for a child with any general danger sign is shown as \"General danger sign present\". WHO module (page 22): \"If the child has a general danger sign, classify as VERY SEVERE DISEASE\"."
                },
                {
                    "type": "heading",
                    "text": "Remember to use your logbook"
                },
                {
                    "type": "paragraph",
                    "text": "Now that you have completed the module, remember to complete your logbook for MODULE 1:"
                },
                {
                    "type": "list",
                    "items": [
                        "Complete Module 1 exercises",
                        "Record cases from your clinic as you check children for general danger signs",
                        "Take notes if you experience anything difficult, confusing, or interesting during these cases. These will be valuable notes to share with your study group and at the face-to-face meeting"
                    ]
                }
            ],
            "see": [],
            "practise": [
                {
                    "type": "rich",
                    "text": "<p><strong>Logbook: clinical practice</strong></p><p>Record at least 2 clinical cases from your clinic on the IMCI recording form, as you check children for general danger signs.</p><p>In the logbook (Logbook p. 6, Checklist of clinical signs (sick child)), tick each sign when you see it in a child at your clinic:</p><ul><li>Not able to drink or breastfeed</li><li>Vomits everything</li><li>History of convulsions (with this illness)</li><li>Convulsions now</li><li>Lethargic or unconscious</li></ul>"
                }
            ],
            "bookFromPage": 22,
            "bookToPage": 22,
            "isPublished": true,
            "source": "dimci"
        },
        {
            "kind": "section",
            "legacyModuleKey": "dimci-m1",
            "title": "1.5 Review questions and Module 1 test",
            "order": 5,
            "read": [],
            "see": [],
            "practise": [
                {
                    "type": "exercise",
                    "exerciseId": "dimci-m1-posttest",
                    "note": "Compare your score with the pre-test."
                },
                {
                    "type": "exercise",
                    "exerciseId": "dimci-m1-logbook",
                    "note": ""
                }
            ],
            "bookFromPage": 23,
            "bookToPage": 25,
            "isPublished": true,
            "source": "dimci"
        }
    ]
};
