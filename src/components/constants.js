// ----------------------------- CONSTANTS ------------------------------
export const STATE_LOCALITIES = {
 "Federal": ["Federal"],   
  "Aj Jazirah": [
    "Al Hasahisa",
    "Al Kamlin",
    "Al Manaqil",
    "Al Qurashi",
    "Janub Al Jazirah",
    "Medani Al Kubra",
    "Sharg Al Jazirah",
    "Um Algura"
  ],
  "Blue Nile": [
    "Al Kurmuk",
    "Ar Rusayris",
    "At Tadamon - BN",
    "Baw",
    "Ed Damazine",
    "Geisan",
    "Wad Al Mahi"
  ],
  "Central Darfur": [
    "Azum",
    "Bendasi",
    "Gharb Jabal Marrah",
    "Mukjar",
    "Shamal Jabal Marrah",
    "Um Dukhun",
    "Wadi Salih",
    "Wasat Jabal Marrah",
    "Zalingi"
  ],
  "East Darfur": [
    "Abu Jabrah",
    "Abu Karinka",
    "Ad Du'ayn",
    "Adila",
    "Al Firdous",
    "Assalaya",
    "Bahr Al Arab",
    "Shia'ria",
    "Yassin"
  ],
  "Gedaref": [
    "Al Butanah",
    "Al Fao",
    "Al Fashaga",
    "Al Galabat Al Gharbyah - Kassab",
    "Al Mafaza",
    "Al Qureisha",
    "Ar Rahad",
    "Basundah",
    "Gala'a Al Nahal",
    "Galabat Ash-Shargiah",
    "Madeinat Al Gedaref",
    "Wasat Al Gedaref"
  ],
  "Kassala": [
    "Halfa Aj Jadeedah",
    "Madeinat Kassala",
    "Reifi Aroma",
    "Reifi Gharb Kassala",
    "Reifi Hamashkureib",
    "Reifi Kassla",
    "Reifi Khashm Elgirba",
    "Reifi Nahr Atbara",
    "Reifi Shamal Ad Delta",
    "Reifi Telkok",
    "Reifi Wad Elhilaiw"
  ],
  "Khartoum": [
    "Bahri",
    "Jebel Awlia",
    "Karrari",
    "Khartoum",
    "Sharg An Neel",
    "Um Bada",
    "Um Durman"
  ],
  "North Darfur": [
    "Al Fasher",
    "Al Koma",
    "Al Lait",
    "Al Malha",
    "As Serief",
    "At Tawisha",
    "At Tina",
    "Dar As Salam",
    "Kebkabiya",
    "Kelemando",
    "Kernoi",
    "Kutum",
    "Melit",
    "Saraf Omra",
    "Tawila",
    "Um Baru",
    "Um Kadadah"
  ],
  "North Kordofan": [
    "Ar Rahad",
    "Bara",
    "Gebrat Al Sheikh",
    "Gharb Bara",
    "Sheikan",
    "Soudari",
    "Um Dam Haj Ahmed",
    "Um Rawaba"
  ],
  "Northern": [
    "Ad Dabbah",
    "Al Burgaig",
    "Al Golid",
    "Delgo",
    "Dongola",
    "Halfa",
    "Merwoe"
  ],
  "Red Sea": [
    "Agig",
    "Al Ganab",
    "Dordieb",
    "Hala'ib",
    "Haya",
    "Jubayt Elma'aadin",
    "Port Sudan",
    "Sawakin",
    "Sinkat",
    "Tawkar"
  ],
  "River Nile": [
    "Abu Hamad",
    "Ad Damar",
    "Al Buhaira",
    "Al Matama",
    "Atbara",
    "Barbar",
    "Shendi"
  ],
  "Sennar": [
    "Abu Hujar",
    "Ad Dali",
    "Ad Dinder",
    "As Suki",
    "Sennar",
    "Sharg Sennar",
    "Sinja"
  ],
  "South Darfur": [
    "Al Radoum",
    "Al Wihda",
    "As Salam - SD",
    "As Sunta",
    "Beliel",
    "Buram",
    "Damso",
    "Ed Al Fursan",
    "Gereida",
    "Kas",
    "Kateila",
    "Kubum",
    "Mershing",
    "Nitega",
    "Nyala Janoub",
    "Nyala Shimal",
    "Rehaid Albirdi",
    "Sharg Aj Jabal",
    "Shattaya",
    "Tulus",
    "Um Dafoug"
  ],
  "South Kordofan": [
    "Abassiya",
    "Abu Jubayhah",
    "Abu Kershola",
    "Al Buram",
    "Al Leri",
    "Al Quoz",
    "Ar Rashad",
    "Ar Reif Ash Shargi",
    "At Tadamon - SK",
    "Delami",
    "Dilling",
    "Ghadeer",
    "Habila - SK",
    "Heiban",
    "Kadugli",
    "Talawdi",
    "Um Durein"
  ],
  "West Darfur": [
    "Ag Geneina",
    "Beida",
    "Foro Baranga",
    "Habila - WD",
    "Jebel Moon",
    "Kereneik",
    "Kulbus",
    "Sirba"
  ],
  "West Kordofan": [
    "Abu Zabad",
    "Abyei",
    "Abyei PCA area",
    "Al Dibab",
    "Al Idia",
    "Al Khiwai",
    "Al Lagowa",
    "Al Meiram",
    "An Nuhud",
    "As Salam - WK",
    "As Sunut",
    "Babanusa",
    "Ghubaish",
    "Keilak",
    "Wad Bandah"
  ],
  "White Nile": [
    "Ad Diwaim",
    "Aj Jabalain",
    "Al Gitaina",
    "As Salam / Ar Rawat",
    "Guli",
    "Kosti",
    "Rabak",
    "Tendalti",
    "Um Rimta"
  ]

};
export const COURSE_TYPES_FACILITATOR = ["IMNCI", "ETAT", "EENC", "IPC"];
export const IMNCI_SUBCOURSE_TYPES = ["Standard 7 days course for medical assistants", "Standard 7 days course for medical doctor", "Refreshment course", "IMNCI in humanitarian setting", "online IMCI course", "preservice Course"];

// EENC SKILLS UPDATED WITH SCORING TYPE
export const SKILLS_EENC_BREATHING = { pre_birth: [{ text: "Checked room temperature and turned off fans" }, { text: "Told the mother (and her support person) what is going to be done" }, { text: "Washed hands (first of two hand washings)" }, { text: "Placed dry cloth on mother's abdomen" }, { text: "Prepared the newborn resuscitation area" }, { text: "Checked that bag and mask are functional" }, { text: "Washed hands (second of two hand washings)" }, { text: "Put on two pairs of clean gloves" }, { text: "Put forceps, cord clamp in easy-to-use order" }], eenc: [{ text: "Call out time of birth" }, { text: "Start Drying within 5 seconds of birth" }, { text: "Dry the baby thoroughly" }, { text: "Stimulate baby by gently rubbing" }, { text: "Suction only if airway blocked" }, { text: "Remove the wet cloth" }, { text: "Put baby in direct skin-to-skin contact" }, { text: "Cover baby’s body with dry cloth and the head with a hat" }], oxytocin: [{ text: "Check for a second baby" }, { text: "Give oxytocin to mother within 1 minute of delivery" }], cord_clamp: [{ text: "Removed outer pair of gloves" }, { text: "Check cord pulsations, clamp after cord pulsations stopped" }, { text: "Place clamp at 2 cm, forceps at 5 cm" }], placenta: [{ text: "Delivered placenta" }, { text: "Counsel mother on feeding cues" }] };
export const SKILLS_EENC_NOT_BREATHING = { pre_birth: [{ text: "Checked room temperature and turned off fans" }, { text: "Told the mother what is going to be done" }, { text: "Washed hands (first of two hand washings)" }, { text: "Placed dry cloth on mother's abdomen" }, { text: "Prepared the newborn resuscitation area" }, { text: "Checked that bag and mask are functional" }, { text: "Washed hands (second of two hand washings)" }, { text: "Put on two pairs of clean gloves" }, { text: "Put forceps, cord clamp in easy-to-use order" }], eenc_initial: [{ text: "Called out time of birth" }, { text: "Started Drying within 5 seconds of birth" }, { text: "Dried the baby thoroughly" }, { text: "Stimulated baby by gently rubbing" }, { text: "Suction only if airway blocked" }, { text: "Removed the wet cloth" }, { text: "Put baby in direct skin-to-skin contact" }, { text: "Covered baby’s body with cloth and the head with a hat" }], if_not_breathing: [{ text: "Called for help" }, { text: "Removed outer pair of gloves" }, { text: "Quickly clamped and cut cord" }, { text: "Moved baby to resuscitation area" }, { text: "Covered baby quickly during and after transfer" }], resuscitation: [{ text: "Positioned the head correctly to open airways" }, { text: "Applied face mask firmly" }, { text: "Gain chest rise within < 1 min of birth" }, { text: "Squeezed bag to give 30–50 breaths per minute" }, { text: "If chest not rising: Reposition head, reposition mask, check airway, squeeze harder" }], if_breathing_starts: [{ text: "Stop ventilation and monitor every 15 minutes" }, { text: "Return baby to skin-to-skin contact and cover baby" }, { text: "Counsel mother that baby is OK" }], post_resuscitation: [{ text: "Check for a second baby" }, { text: "Give oxytocin to mother within 1 minute of delivery" }, { text: "Delivered placenta" }, { text: "Counsel mother on feeding cues" }], if_not_breathing_after_10_min: [{ text: "If heart rate, continue ventilation, Refer and transport" }, { text: "If no heart rate, stop ventilation, provide emotional support" }] };
export const EENC_DOMAIN_LABEL_BREATHING = { pre_birth: "Pre-birth preparations", eenc: "Early Essential Newborn Care", oxytocin: "Give Oxytocin to mother", cord_clamp: "Clamp the cord", placenta: "Deliver the placenta and counsel the mother" };
export const EENC_DOMAINS_BREATHING = Object.keys(SKILLS_EENC_BREATHING);
export const EENC_DOMAIN_LABEL_NOT_BREATHING = { pre_birth: "Pre-birth preparations", eenc_initial: "Initial EENC Steps (40 sec)", if_not_breathing: "If baby not crying or not breathing", resuscitation: "Resuscitation", if_breathing_starts: "If baby starts breathing well", post_resuscitation: "Post-resuscitation care", if_not_breathing_after_10_min: "If baby not breathing after 10 minutes" };
export const EENC_DOMAINS_NOT_BREATHING = Object.keys(SKILLS_EENC_NOT_BREATHING);
export const SKILLS_ETAT = { triage: ["Triage Assessment", "Assigns Triage Category"], airway_breathing: ["Positions Airway", "Suctions", "Gives Oxygen", "Bag-Mask Ventilation"], circulation: ["Inserts IV/IO", "Gives IV fluids", "Checks blood sugar"], coma: ["Positions unresponsive child", "Gives IV fluids"], convulsion: ["Positions convulsing child", "Gives Diazepam"], dehydration: ["Assesses dehydration", "Gives IV fluids", "Reassesses"] };
export const ETAT_DOMAIN_LABEL = { triage: "Triage", airway_breathing: "Airway and Breathing", circulation: "Circulation", coma: "Coma", convulsion: "Convulsion", dehydration: "Dehydration (Severe)" };
export const ETAT_DOMAINS = Object.keys(SKILLS_ETAT);
export const CLASS_2_59M = { danger: ["Any Danger Sign"], respiratory: ["Severe pneumonia/disease", "Pneumonia", "Cough/cold", "Severe pneumonia/disease (Wheeze)", "Pneumonia (Wheeze)", "Cough/cold (Wheeze)"], diarrhoea: ["Severe dehydration", "Some dehydration", "No dehydration", "Severe persistent", "Persistent", "Dysentery"], fever_malaria: ["Very severe febrile disease", "Malaria", "Fever - malaria unlikely", "Severe complicated measles", "Measles - Eye/mouth complications", "Measles"], ear: ["Mastoiditis", "Acute ear infection", "Chronic ear infection", "No ear infection"], malnutrition: ["Complicated Severe Acute malnutrition (SAM)", "Un-complicated Severe Acute malnutrition (SAM)", "Moderate Acute malnutrition (MAM)", "No Acute Malnutrition"], anaemia: ["Severe Anaemia", "Anaemia", "No anaemia"], identify_treatment: ["IDENTIFY TREATMENTS NEEDED"], treatment_2_59m: ["ORAL DRUGS", "PLAN A", "PLAN B", "LOCAL INFECTION"], counsel: ["Assess and counsel for vaccination", "Asks feeding questions", "Feeding problems identified", "Gives advice on feeding problems", "COUNSEL WHEN TO RETURN"], };
export const CLASS_0_59D = { bacterial: ["Possible serious bacterial infection", "Local bacterial infection", "Bacterial infection unlikely"], jaundice: ["Severe Jaundice", "Jaundice", "No Jaundice"], vyi_diarrhoea: ["Severe dehydration", "Some dehydration", "No dehydration", "Persistent diarrhea", "Blood in Stool"], feeding: ["Breastfeeding attachment and suckling assessed", "Feeding problem or low weight", "No feeding problem"], identify_treatment: ["IDENTIFY TREATMENTS NEEDED"], treatment_0_59d: ["Teach correct positioning and attachment", "Advise on home care"], };
export const DOMAINS_BY_AGE_IMNCI = { GE2M_LE5Y: ["danger", "respiratory", "diarrhoea", "fever_malaria", "ear", "malnutrition", "anaemia", "identify_treatment", "treatment_2_59m", "counsel"], LT2M: ["bacterial", "jaundice", "vyi_diarrhoea", "feeding", "identify_treatment", "treatment_0_59d"], };
export const DOMAIN_LABEL_IMNCI = { danger: "Danger signs", respiratory: "COUGH:", diarrhoea: "DIARRHOEA:", fever_malaria: "FEVER:", ear: "EAR:", malnutrition: "MALNUTRITION:", anaemia: "ANAEMIA:", identify_treatment: "IDENTIFY TREATMENT:", treatment_2_59m: "TREAT:", counsel: "COUNSEL:", bacterial: "BACTERIAL:", jaundice: "JAUNDICE:", vyi_diarrhoea: "DIARRHOEA:", feeding: "FEEDING:", treatment_0_59d: "TREATMENT/COUNSEL:" };
export const getClassListImnci = (age, d) => (age === "GE2M_LE5Y" ? CLASS_2_59M[d] : CLASS_0_59D[d]) || [];
export const JOB_TITLES_IMNCI = ["Pediatric Doctor", "Family Medicine Doctor", "General Practioner", "Medical Assistance", "Treating Nurse", "Other"];
export const JOB_TITLES_ETAT = ["Pediatric Specialist", "Pediatric registrar", "Family Medicine Doctor", "Emergency doctor", "General Practioner", "Nurse Diploma", "Nurse Bachelor", "Other"];
export const JOB_TITLES_EENC = ["Pediatric doctor", "Obstetric Doctor", "Emergency doctor", "General Practioner", "Nurse Diploma", "Nurse Bachelor", "Sister Midwife", "Midwife", "Other"];

// ----------------------------- HELPER FUNCTIONS --------------------------------
export const calcPct = (c, s) => (!s ? NaN : (c * 100) / s);
export const fmtPct = v => (!isFinite(v) ? "—" : Math.round(v).toFixed(0) + " %");
export const pctBgClass = v => (!isFinite(v) ? "" : v < 50 ? "bg-red-100 text-red-800" : v <= 80 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800");
export const formatAsPercentageAndCount = (correct, total) => `${correct}/${total} (${fmtPct(calcPct(correct, total))})`;
export const formatAsPercentageAndScore = (score, maxScore) => maxScore === 0 ? "N/A" : `${score}/${maxScore} (${fmtPct(calcPct(score, maxScore))})`;