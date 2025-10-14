// ----------------------------- CONSTANTS ------------------------------
export const STATE_LOCALITIES = {
  "Federal": {
    "en": "Federal",
    "ar": "إتحادي",
    "localities": [{ "en": "Federal", "ar": "إتحادية" }]
  },
  "Gezira": {
    "en": "Aj Jazirah",
    "ar": "الجزيرة",
    "localities": [
      { "en": "Al Hasahisa", "ar": "الحصاحيصا" },
      { "en": "Al Kamlin", "ar": "الكاملين" },
      { "en": "Al Manaqil", "ar": "المناقل" },
      { "en": "Al Qurashi", "ar": "القرشي" },
      { "en": "Janub Al Jazirah", "ar": "جنوب الجزيرة" },
      { "en": "Medani Al Kubra", "ar": "مدني الكبرى" },
      { "en": "Sharg Al Jazirah", "ar": "شرق الجزيرة" },
      { "en": "Um Algura", "ar": "أم القرى" }
    ]
  },
  "Blue Nile": {
    "en": "Blue Nile",
    "ar": "النيل الأزرق",
    "localities": [
      { "en": "Al Kurmuk", "ar": "الكرمك" },
      { "en": "Ar Rusayris", "ar": "الروصيرص" },
      { "en": "At Tadamon - BN", "ar": "التضامن" },
      { "en": "Baw", "ar": "باو" },
      { "en": "Ed Damazine", "ar": "الدمازين" },
      { "en": "Geisan", "ar": "قيسان" },
      { "en": "Wad Al Mahi", "ar": "ود الماحي" }
    ]
  },
  "Central Darfur": {
    "en": "Central Darfur",
    "ar": "وسط دارفور",
    "localities": [
      { "en": "Azum", "ar": "أزوم" },
      { "en": "Bendasi", "ar": "بندسي" },
      { "en": "Gharb Jabal Marrah", "ar": "غرب جبل مرة" },
      { "en": "Mukjar", "ar": "مكجر" },
      { "en": "Shamal Jabal Marrah", "ar": "شمال جبل مرة" },
      { "en": "Um Dukhun", "ar": "أم دخن" },
      { "en": "Wadi Salih", "ar": "وادي صالح" },
      { "en": "Wasat Jabal Marrah", "ar": "وسط جبل مرة" },
      { "en": "Zalingi", "ar": "زالنجي" }
    ]
  },
  "East Darfur": {
    "en": "East Darfur",
    "ar": "شرق دارفور",
    "localities": [
      { "en": "Abu Jabrah", "ar": "أبو جابرة" },
      { "en": "Abu Karinka", "ar": "أبو كارنكا" },
      { "en": "Ad Du'ayn", "ar": "الضعين" },
      { "en": "Adila", "ar": "عديلة" },
      { "en": "Al Firdous", "ar": "الفردوس" },
      { "en": "Assalaya", "ar": "عسلاية" },
      { "en": "Bahr Al Arab", "ar": "بحر العرب" },
      { "en": "Shia'ria", "ar": "شعيرية" },
      { "en": "Yassin", "ar": "ياسين" }
    ]
  },
  "Gedaref": {
    "en": "Gedaref",
    "ar": "القضارف",
    "localities": [
      { "en": "Al Butanah", "ar": "البطانة" },
      { "en": "Al Fao", "ar": "الفاو" },
      { "en": "Al Fashaga", "ar": "الفشقة" },
      { "en": "Al Galabat Al Gharbyah - Kassab", "ar": "القلابات الغربية" },
      { "en": "Al Mafaza", "ar": "المفازة" },
      { "en": "Al Qureisha", "ar": "القريشة" },
      { "en": "Ar Rahad", "ar": "الرهد" },
      { "en": "Basundah", "ar": "باسندة" },
      { "en": "Gala'a Al Nahal", "ar": "قلع النحل" },
      { "en": "Galabat Ash-Shargiah", "ar": "القلابات الشرقية" },
      { "en": "Madeinat Al Gedaref", "ar": "مدينة القضارف" },
      { "en": "Wasat Al Gedaref", "ar": "وسط القضارف" }
    ]
  },
  "Kassala": {
    "en": "Kassala",
    "ar": "كسلا",
    "localities": [
      { "en": "Halfa Aj Jadeedah", "ar": "حلفا الجديدة" },
      { "en": "Madeinat Kassala", "ar": "مدينة كسلا" },
      { "en": "Reifi Aroma", "ar": "ريفى أروما" },
      { "en": "Reifi Gharb Kassala", "ar": "ريفى غرب كسلا" },
      { "en": "Reifi Hamashkureib", "ar": "ريفى همشكوريب" },
      { "en": "Reifi Kassla", "ar": "ريفى كسلا" },
      { "en": "Reifi Khashm Elgirba", "ar": "ريفى خشم القربة" },
      { "en": "Reifi Nahr Atbara", "ar": "ريفى نهر عطبرة" },
      { "en": "Reifi Shamal Ad Delta", "ar": "ريفى شمال الدلتا" },
      { "en": "Reifi Telkok", "ar": "ريفى تلكوك" },
      { "en": "Reifi Wad Elhilaiw", "ar": "ريفى ود الحليو" }
    ]
  },
  "Khartoum": {
    "en": "Khartoum",
    "ar": "الخرطوم",
    "localities": [
      { "en": "Bahri", "ar": "بحري" },
      { "en": "Jebel Awlia", "ar": "جبل أولياء" },
      { "en": "Karrari", "ar": "كرري" },
      { "en": "Khartoum", "ar": "الخرطوم" },
      { "en": "Sharg An Neel", "ar": "شرق النيل" },
      { "en": "Um Bada", "ar": "أمبدة" },
      { "en": "Um Durman", "ar": "أم درمان" }
    ]
  },
  "North Darfur": {
    "en": "North Darfur",
    "ar": "شمال دارفور",
    "localities": [
      { "en": "Al Fasher", "ar": "الفاشر" },
      { "en": "Al Koma", "ar": "الكومة" },
      { "en": "Al Lait", "ar": "اللعيت" },
      { "en": "Al Malha", "ar": "المالحة" },
      { "en": "As Serief", "ar": "السريف" },
      { "en": "At Tawisha", "ar": "الطويشة" },
      { "en": "At Tina", "ar": "الطينة" },
      { "en": "Dar As Salam", "ar": "دار السلام" },
      { "en": "Kebkabiya", "ar": "كبكابية" },
      { "en": "Kelemando", "ar": "كلمندو" },
      { "en": "Kernoi", "ar": "كرنوي" },
      { "en": "Kutum", "ar": "كتم" },
      { "en": "Melit", "ar": "مليط" },
      { "en": "Saraf Omra", "ar": "سرف عمرة" },
      { "en": "Tawila", "ar": "طويلة" },
      { "en": "Um Baru", "ar": "أم برو" },
      { "en": "Um Kadadah", "ar": "أم كدادة" }
    ]
  },
  "North Kordofan": {
    "en": "North Kordofan",
    "ar": "شمال كردفان",
    "localities": [
      { "en": "Ar Rahad", "ar": "الرهد" },
      { "en": "Bara", "ar": "بارا" },
      { "en": "Gebrat Al Sheikh", "ar": "جبرة الشيخ" },
      { "en": "Gharb Bara", "ar": "غرب بارا" },
      { "en": "Sheikan", "ar": "شيكان" },
      { "en": "Soudari", "ar": "سودري" },
      { "en": "Um Dam Haj Ahmed", "ar": "أم دم حاج أحمد" },
      { "en": "Um Rawaba", "ar": "أم روابة" }
    ]
  },
  "Northern": {
    "en": "Northern",
    "ar": "الشمالية",
    "localities": [
      { "en": "Ad Dabbah", "ar": "الدبة" },
      { "en": "Al Burgaig", "ar": "البرقيق" },
      { "en": "Al Golid", "ar": "القولد" },
      { "en": "Delgo", "ar": "دلقو" },
      { "en": "Dongola", "ar": "دنقلا" },
      { "en": "Halfa", "ar": "حلفا" },
      { "en": "Merwoe", "ar": "مروي" }
    ]
  },
  "Red Sea": {
    "en": "Red Sea",
    "ar": "البحر الأحمر",
    "localities": [
      { "en": "Agig", "ar": "عقيق" },
      { "en": "Al Ganab", "ar": "القنب" },
      { "en": "Dordieb", "ar": "درديب" },
      { "en": "Hala'ib", "ar": "حلايب" },
      { "en": "Haya", "ar": "هيا" },
      { "en": "Jubayt Elma'aadin", "ar": "جبيت المعادن" },
      { "en": "Port Sudan", "ar": "بورتسودان" },
      { "en": "Sawakin", "ar": "سواكن" },
      { "en": "Sinkat", "ar": "سنكات" },
      { "en": "Tawkar", "ar": "طوكر" }
    ]
  },
  "River Nile": {
    "en": "River Nile",
    "ar": "نهر النيل",
    "localities": [
      { "en": "Abu Hamad", "ar": "أبو حمد" },
      { "en": "Ad Damar", "ar": "الدامر" },
      { "en": "Al Buhaira", "ar": "البحيرة" },
      { "en": "Al Matama", "ar": "المتمة" },
      { "en": "Atbara", "ar": "عطبرة" },
      { "en": "Barbar", "ar": "بربر" },
      { "en": "Shendi", "ar": "شندي" }
    ]
  },
  "Sennar": {
    "en": "Sennar",
    "ar": "سنار",
    "localities": [
      { "en": "Abu Hujar", "ar": "أبو حجار" },
      { "en": "Ad Dali", "ar": "الدالي" },
      { "en": "Ad Dinder", "ar": "الدندر" },
      { "en": "As Suki", "ar": "السوكي" },
      { "en": "Sennar", "ar": "سنار" },
      { "en": "Sharg Sennar", "ar": "شرق سنار" },
      { "en": "Sinja", "ar": "سنجة" }
    ]
  },
  "South Darfur": {
    "en": "South Darfur",
    "ar": "جنوب دارفور",
    "localities": [
      { "en": "Al Radoum", "ar": "الردم" },
      { "en": "Al Wihda", "ar": "الوحدة" },
      { "en": "As Salam - SD", "ar": "السلام" },
      { "en": "As Sunta", "ar": "السنطة" },
      { "en": "Beliel", "ar": "بليل" },
      { "en": "Buram", "ar": "برام" },
      { "en": "Damso", "ar": "دمسو" },
      { "en": "Ed Al Fursan", "ar": "عد الفرسان" },
      { "en": "Gereida", "ar": "قريضة" },
      { "en": "Kas", "ar": "كاس" },
      { "en": "Kateila", "ar": "كتيلة" },
      { "en": "Kubum", "ar": "كبم" },
      { "en": "Mershing", "ar": "مرشينج" },
      { "en": "Nitega", "ar": "نتيقة" },
      { "en": "Nyala Janoub", "ar": "نيالا جنوب" },
      { "en": "Nyala Shimal", "ar": "نيالا شمال" },
      { "en": "Rehaid Albirdi", "ar": "رهيد البردي" },
      { "en": "Sharg Aj Jabal", "ar": "شرق الجبل" },
      { "en": "Shattaya", "ar": "شطاية" },
      { "en": "Tulus", "ar": "تلس" },
      { "en": "Um Dafoug", "ar": "أم دافوق" }
    ]
  },
  "South Kordofan": {
    "en": "South Kordofan",
    "ar": "جنوب كردفان",
    "localities": [
      { "en": "Abassiya", "ar": "العباسية" },
      { "en": "Abu Jubayhah", "ar": "أبو جبيهة" },
      { "en": "Abu Kershola", "ar": "أبو كرشولا" },
      { "en": "Al Buram", "ar": "البرام" },
      { "en": "Al Leri", "ar": "الليري" },
      { "en": "Al Quoz", "ar": "القوز" },
      { "en": "Ar Rashad", "ar": "الرشاد" },
      { "en": "Ar Reif Ash Shargi", "ar": "الريف الشرقي" },
      { "en": "At Tadamon - SK", "ar": "التضامن" },
      { "en": "Delami", "ar": "دلامي" },
      { "en": "Dilling", "ar": "الدلنج" },
      { "en": "Ghadeer", "ar": "غدير" },
      { "en": "Habila - SK", "ar": "هبيلة" },
      { "en": "Heiban", "ar": "هيبان" },
      { "en": "Kadugli", "ar": "كادقلي" },
      { "en": "Talawdi", "ar": "تلودي" },
      { "en": "Um Durein", "ar": "أم دورين" }
    ]
  },
  "West Darfur": {
    "en": "West Darfur",
    "ar": "غرب دارفور",
    "localities": [
      { "en": "Ag Geneina", "ar": "الجنينة" },
      { "en": "Beida", "ar": "بيضة" },
      { "en": "Foro Baranga", "ar": "فوربرنقا" },
      { "en": "Habila - WD", "ar": "هبيلة" },
      { "en": "Jebel Moon", "ar": "جبل مون" },
      { "en": "Kereneik", "ar": "كرينك" },
      { "en": "Kulbus", "ar": "كلبس" },
      { "en": "Sirba", "ar": "سربا" }
    ]
  },
  "West Kordofan": {
    "en": "West Kordofan",
    "ar": "غرب كردفان",
    "localities": [
      { "en": "Abu Zabad", "ar": "أبو زبد" },
      { "en": "Abyei", "ar": "أبيي" },
      { "en": "Abyei PCA area", "ar": "منطقة أبيي الإدارية" },
      { "en": "Al Dibab", "ar": "الدبب" },
      { "en": "Al Idia", "ar": "النهود" },
      { "en": "Al Khiwai", "ar": "الخوي" },
      { "en": "Al Lagowa", "ar": "لقاوة" },
      { "en": "Al Meiram", "ar": "الميرم" },
      { "en": "An Nuhud", "ar": "النهود" },
      { "en": "As Salam - WK", "ar": "السلام" },
      { "en": "As Sunut", "ar": "السنوط" },
      { "en": "Babanusa", "ar": "بابنوسة" },
      { "en": "Ghubaish", "ar": "غبيش" },
      { "en": "Keilak", "ar": "كيلك" },
      { "en": "Wad Bandah", "ar": "ود بندة" }
    ]
  },
  "White Nile": {
    "en": "White Nile",
    "ar": "النيل الأبيض",
    "localities": [
      { "en": "Ad Diwaim", "ar": "الدويم" },
      { "en": "Aj Jabalain", "ar": "الجبلين" },
      { "en": "Al Gitaina", "ar": "القطينة" },
      { "en": "As Salam / Ar Rawat", "ar": "السلام / الروات" },
      { "en": "Guli", "ar": "قلي" },
      { "en": "Kosti", "ar": "كوستي" },
      { "en": "Rabak", "ar": "ربك" },
      { "en": "Tendalti", "ar": "تندلتي" },
      { "en": "Um Rimta", "ar": "أم رمته" }
    ]
  }
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