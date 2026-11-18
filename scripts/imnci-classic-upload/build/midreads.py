# Activities placed in the middle of long reading (Qusay, 2026-11-18): after the book paragraph that
# starts with the given words, a question, cards or a think-first prompt is inserted. The book text is
# never changed or moved; every answer below is taken from the book's own words in that lesson.
# MID[module number][lesson title] = [(start of the paragraph to insert after, block), ...]
from lib import q, reveal, flip, steps, sort

MID = {
2: {
"Ask the mother what the child's problems are": [
    ("A mother (or other family member", q("When should the ASSESS & CLASSIFY chart be used?",
        ["When a mother brings her child because he is sick", "For a well-child brought for immunization", "For a child with an injury or a burn"], 0,
        "The steps on the ASSESS & CLASSIFY chart describe what you should do when a mother brings her child to the clinic because he is sick. The chart should not be used for a well-child brought for immunization or for a child with an injury or burn.")),
    ("Record what the mother tells you", reveal("Why is it important to have good communication with the mother from the beginning of the visit?",
        "Using good communication helps to reassure the mother that her child will receive good care. When you treat the child's illness later in the visit, you will need to teach and advise the mother about caring for her sick child at home.")),
    ("A follow-up visit has a different purpose", q("What does the health worker find out during a follow-up visit?",
        ["Whether the treatment given at the initial visit has helped the child", "The child's age", "Which chart to use"], 0,
        "During a follow-up visit, the health worker finds out if the treatment he gave during the initial visit has helped the child. If the child is not improving or is getting worse after a few days, the health worker refers the child to a hospital or changes the child's treatment.")),
],
"Ask and look for each general danger sign": [
    ("A child has the sign \"not able to drink or breastfeed\"", q("A breastfed child cannot suck because his nose is blocked. You clear the nose and he can then breastfeed. Does he have the danger sign?",
        ["Yes: not able to drink or breastfeed", "No: the nose was blocked, and he can breastfeed once it is cleared"], 1,
        "A child who is breastfed may have difficulty sucking when his nose is blocked. If the child can breastfeed after his nose is cleared, the child does not have the danger sign, \"not able to drink or breastfeed.\"")),
    ("A child who is not able to hold anything", q("A child vomits several times but holds down some fluids. Does he have the danger sign \"vomits everything\"?",
        ["Yes", "No"], 1,
        "A child who vomits several times but can hold down some fluids does not have this general danger sign.")),
    ("Convulsions may be the result of fever", reveal("Name two words a mother may use for convulsions, and say why you use words she understands.",
        "The mother may know convulsions as \"fits\" or \"spasms.\" Use words the mother understands.")),
    ("An unconscious child cannot be wakened", q("A sleeping child wakens when the mother talks to him or you clap your hands. Is he lethargic or unconscious?",
        ["Lethargic", "Unconscious", "Neither: he was asleep, which is not abnormal"], 2,
        "If the child wakens, it means the child was asleep. This is not abnormal.")),
],
"Assess cough or difficult breathing: how long, and count the breaths": [
    ("\"Difficult breathing\" is any unusual pattern", q("A child has had a cough for more than 2 weeks. What does the book say this may be a sign of?",
        ["Tuberculosis, asthma, whooping cough or another problem", "Only a common cold", "Nothing: ignore it"], 0,
        "A child who has a cough or difficulty breathing for more than 2 weeks has a chronic cough. This may be a sign of tuberculosis, asthma, whooping cough or another problem.")),
    ("If you are not sure about the number of breaths", flip("Fast breathing: the cut-off by age", [
        ("2 months up to 12 months", "50 breaths per minute or more"),
        ("12 months up to 5 years", "40 breaths per minute or more"),
        ("A child who is exactly 12 months old", "Fast breathing if you count 40 breaths per minute or more"),
    ])),
],
"Look for chest indrawing, stridor and wheeze": [
    ("LOOK for chest indrawing.", q("You see the lower chest wall go IN only when the child is crying. Does he have chest indrawing?",
        ["Yes", "No: it must be clearly visible and present all the time"], 1,
        "For chest indrawing to be present, it must be clearly visible and present all the time. If you only see chest indrawing when the child is crying or feeding, the child does not have chest indrawing.")),
    ("LOOK and LISTEN for Stridor:", reveal("When do you look and listen for stridor, and why?",
        "Be sure to look and listen for stridor when the child is calm. A child who is not very ill may have stridor only when he is crying or upset. A child who has stridor when calm has a dangerous condition.")),
],
"Fever: malaria, measles and other causes": [
    ("MALARIA:", q("A child has malaria and also cough with fast breathing. What does he need?",
        ["Treatment for malaria only", "Treatment for both falciparum malaria and pneumonia", "Treatment for pneumonia only"], 1,
        "Signs of malaria can overlap with signs of other illness. This child needs treatment for both falciparum malaria and pneumonia.")),
    ("Severe malaria is malaria", reveal("How soon can uncomplicated malaria become severe malaria?",
        "A case of uncomplicated malaria can develop into severe malaria as soon as 24 hours after the fever first appears. Severe malaria is malaria with complications such as cerebral malaria or severe anemia; the child can die if he does not receive urgent treatment.")),
    ("Complications of measles occur in about 30%", flip("The complications of measles", [
        ("Brain", "Encephalitis"), ("Gut", "Diarrhea (including dysentery and persistent diarrhea)"), ("Lung", "Pneumonia"),
        ("Mouth", "Mouth ulcers"), ("Ear", "Ear infection"), ("Eye", "Severe eye infection (which may lead to corneal ulceration and blindness)"),
    ])),
],
"Look for stiff neck, the rash of measles, other causes, and do a malaria test": [
    ("A child with fever and stiff neck", q("If the neck bends easily when you gently bend the head towards the chest, what does the child have?",
        ["A stiff neck", "No stiff neck"], 1,
        "If the neck bends easily, the child does not have stiff neck. If the neck feels stiff and there is resistance to bending, the child has a stiff neck.")),
    ("Generalized rash", q("Which rash does the book describe as measles?",
        ["A rash that itches and has blisters", "A red rash that begins behind the ears and on the neck, spreads to the face and then the body, and does not itch", "A rash on the hands, feet, ankles and elbows that itches"], 1,
        "A measles rash does not have vesicles (blisters) or pustules. The rash does not itch. Chickenpox is a generalized rash with vesicles; scabies occurs on the hands, feet, ankles, elbows, buttocks and axilla and itches.")),
    ("Assess the child for signs of any other infection", q("A child with fever has a danger sign or a stiff neck. Do you do a malaria test first?",
        ["Yes", "No: do not delay referral; give pre-referral antimalarial and antibiotic treatment and refer urgently"], 1,
        "Do not do a malaria test if a child has a danger sign or a stiff neck to avoid delay in referral but give pre-referral antimalarial and antibiotic treatment, and refer the child urgently.")),
],
"MUAC, medical complications and the appetite test": [
    ("Conducting an appetite test means", reveal("Why does a poor appetite matter in a child with severe acute malnutrition?",
        "Major complications lead to a loss of appetite. A poor appetite means that the child has a significant infection or a major metabolic abnormality. Such a child is at immediate risk of death.")),
],
"Contraindications to immunization": [
    ("There are only three situations", sort("Is it a contraindication to immunization? Sort each one the way the book says.", ["A contraindication", "Not a contraindication"], [
        ("BCG for a child known to have AIDS", "A contraindication"),
        ("Penta 2 or Penta 3 for a child who had convulsions or shock within 3 days of the most recent dose", "A contraindication"),
        ("Penta for a child with recurrent convulsions or another active neurological disease of the central nervous system", "A contraindication"),
        ("A sick child who is well enough to go home", "Not a contraindication"),
    ], "There are only three contraindications. There are no contraindications to immunization of a sick child if the child is well enough to go home.")),
],
},
}
