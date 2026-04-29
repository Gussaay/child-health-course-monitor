// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      general: {
        app_title: "National Child Health Program",
        dashboard: "Mentorship Dashboard",
        btn_refresh: "Refresh",
        btn_back: "Back to Main Menu",
        loading: "Loading Dashboard Data...",
        please_wait: "Please wait while we fetch the latest records."
      },
      filters: {
        date: "Date Filter", state: "State", locality: "Locality", facility: "Health Facility", project: "Project / Partner", job_title: "Job Title", worker_name: "Health Worker Name"
      },
      programs: {
        imnci: "Integrated Management of Newborn and Childhood Illnesses (IMNCI)", eenc: "Early Essential Newborn Care (EENC)", infection_control: "Infection Control", cord_management: "Cord Management (Breathing Babies)"
      },
      skills: {
        overall_score: "Overall Adherence Score", assess_classify: "Assess & Classify", treatment_counsel: "Treatment & Counsel", danger_signs: "Danger Signs Assessment", measurements: "Measurement Skills"
      },
      mothers: {
        total_interviews: "Total Mother Interviews", knowledge_treatment: "Mother Knowledge: Treatment", satisfaction: "Mother Satisfaction"
      },
      dashboard: {
        service_coverage_title: "Service Coverage Dashboard", refresh_data: "↻ Refresh Data Cache", syncing: "Syncing Dashboard Data...",
        tabs: { combined: "Combined Coverage", neonatal: "Neonatal Care Coverage", eenc: "EENC Coverage", imnci: "IMNCI Coverage", critical: "Emergency & Critical Care" },
        filters: { state: "State", locality: "Locality", ownership: "Ownership", project: "Project", has_equipment: "Has Equipment", all_states: "All States", all_localities: "All Localities", all_ownerships: "All Ownerships", all_projects: "All Projects", any: "Any" },
        cards: { total_pediatrics_emonc: "Total Pediatrics & EmONC", functioning_scnu: "Functioning SCNU Facilities", facilities_with_cpap: "Facilities with CPAP", total_emonc: "Total EmONC Facilities", functional_emonc: "Functional EmONC Facilities", eenc_coverage_functional: "EENC Coverage in Functional EmONC", total_functioning_phc: "Total Functioning PHC Facilities", total_phc_imnci: "Total PHC Facilities with IMNCI", imnci_coverage_phc: "IMNCI Service Coverage in PHCs", target_hospitals_etat: "Target Hospitals (ETAT)", hospitals_etat: "Hospitals with ETAT", facilities_hdu: "Facilities with HDU", facilities_picu: "Facilities with PICU", out_of: "out of" },
        headers: { scnu_coverage: "SCNU Coverage by", neonatal_equipment: "Neonatal Unit Equipment Availability", functioning_neonatal_units: "Functioning Neonatal Units (SCNU) List", eenc_coverage: "EENC Coverage by", eenc_equipment: "EENC Equipment Availability by Unit", imnci_coverage: "IMNCI Coverage by", imnci_tools: "IMNCI Tools Availability by", critical_care_coverage: "Critical Care Coverage by", critical_care_capacity: "Critical Care Capacity & Equipment", geographic_map: "Geographical Map", geographic_coverage: "Geographic Coverage & Service Performance" },
        table: { state: "State", locality: "Locality", hospital_name: "Hospital Name", total_supposed: "Total Supposed", with_scnu: "With SCNU", coverage_chart: "Coverage Chart", incubators: "Incubators", cots: "Cots", total_beds: "Total Beds", functional_emonc: "Functional EmONC", with_eenc: "With EENC", functioning_phcs: "Functioning PHCs", phcs_with_imnci: "PHCs with IMNCI", target_hospitals: "Target Hospitals", with_hdu: "With HDU", with_picu: "With PICU", with_etat: "With ETAT", overall_average: "Overall Average", imnci_register: "IMNCI Register", imnci_registers: "IMNCI Registers", chart_booklet: "Chart Booklet", imnci_chartbooklet: "IMNCI Chart Booklet", weight_scale: "Weight Scale", height_scale: "Height Scale", thermometer: "Thermometer", timer: "Timer", ort_corner: "ORT Corner", total_functioning_phcs: "Total PHCs", no_data: "No data matches the current filters." },
        map: { legend: "Legend (Avg Coverage):", no_data: "0-39% (or No Data)", range_mid: "40-74%", range_high: "≥75%", facility: "Facility", state: "State", locality: "Locality", hide_fac: "Hide Fac.", show_fac: "Show Fac.", full: "Full", close: "Close" },
        kpi: { imnci: { title: "Integrated Management of Childhood Illness (IMNCI)", num: "Implementing Centers", den: "Targeted Centers" }, etat: { title: "Emergency Triage Assessment and Treatment (ETAT)", num: "Implementing Hospitals", den: "Targeted Hospitals" }, eenc: { title: "Early Essential Newborn Care (EENC)", num: "Implementing Hospitals", den: "EmONC Hospitals" }, scnu: { title: "Special Care Newborn Unit (SCNU)", num: "Implementing Hospitals", den: "Targeted Hospitals" }, overall_coverage: "Overall Coverage" },
        equip: { "Total Beds": "Total Beds", "Incubators": "Incubators", "Cots": "Cots", "Phototherapy Units": "Phototherapy Units", "Oxygen Machines": "Oxygen Machines", "Oxygen Cylinders": "Oxygen Cylinders", "Respiration Monitors": "Respiration Monitors", "CPAP Machines": "CPAP Machines", "Mechanical Ventilators": "Mechanical Ventilators", "Neonatal Warmers": "Neonatal Warmers", "Infusion Pumps": "Infusion Pumps", "Syringe Pumps": "Syringe Pumps", "Suction Devices": "Suction Devices", "Resuscitation Bags": "Resuscitation Bags", "Portable Incubators": "Portable Incubators", "Delivery Beds": "Delivery Beds", "Resuscitation Stations": "Resuscitation Stations", "Warmers": "Warmers", "Ambu Bags": "Ambu Bags", "Manual Suction": "Manual Suction", "Wall Clock": "Wall Clock", "Steam Sterilizer": "Steam Sterilizer", "ETAT CPAP": "ETAT CPAP", "ETAT Suction": "ETAT Suction", "HDU Beds": "HDU Beds", "HDU CPAP": "HDU CPAP", "PICU Beds": "PICU Beds" }
      },
      landing: {
        welcome: "Welcome", subtitle: "Select a module to get started", no_permissions: "You do not have permissions to view any modules. Please contact an administrator.",
        modules: { dashboard: "Dashboard", courses: "Courses", human_resources: "Human Resources", facilities: "Child Health Services", mentorship: "Skills Mentorship", imci: "IMCI Assessment", projects: "Project Tracker", planning: "Master Plan", admin: "Admin", home: "Home" }
      },
      app: {
        title: "National Child Health Program", subtitle: "Program & Course Monitoring System", loading_system: "Loading application, please wait...", offline: "You are offline. Changes are saved locally and will sync when reconnected.", syncing: "Syncing offline data to the cloud...", welcome: "Welcome", logout: "Logout"
      },
      imci: {
        form_title: "IMNCI Recording Form",
        infant_title: "Management of the sick young infant up to 2 months",
        child_title: "Management of the sick child age 2 month up to 5 years",
        placeholders: {
          child_name: "Enter child's full name",
          age_days: "e.g. 3 weeks",
          age_months: "e.g. 24",
          weight: "e.g. 12.5",
          length: "e.g. 85.0",
          temp: "e.g. 37.8",
          problems: "Briefly describe the main problems...",
          other_problems: "Describe other problems..."
        },
        common_phrases: {
          no_treatments: "No treatments identified",
          next_vaccine: "Next vaccine dose",
          next_vit_a: "Next Vitamin A dose",
          note: "Note: ",
          treatment_needed_other: "Treatment needed for other problem"
        },
        vaccines: {
          opv0: "OPV 0", bcg: "BCG", opv1: "OPV 1", rota1: "Rota 1", pcv1: "PCV 1", penta1: "Penta 1", ipv1: "IPV 1",
          opv2: "OPV 2", rota2: "Rota 2", pcv2: "PCV 2", penta2: "Penta 2",
          opv3: "OPV 3", rota3: "Rota 3", pcv3: "PCV 3", penta3: "Penta 3", ipv2: "IPV 2",
          mr: "MR", yellowFever: "Yellow fever", menA: "Men A", mrBooster: "MR (booster)", vitA: "Vitamin A (start at 6 months and given every 6 month)",
          w10: "10 weeks", w14: "14 weeks", m9: "9 months", m18: "18 month"
        },
        treatments: {
          refer_urgently: "Refer urgently",
          im_antibiotic: "IM antibiotic",
          prevent_low_blood_sugar: "Treat to prevent low blood sugar",
          keep_warm: "Advice to keep infant warm",
          oral_antibiotic: "Give oral antibiotic",
          treat_local_infection: "Treat local infection",
          home_care: "Home care for young infant",
          iv_fluids: "IV fluids",
          ors: "ORS",
          treat_thrush: "Treat thrush",
          council_breastfeeding: "Council on breast feeding",
          teach_position: "Teach correct Position",
          teach_attachment: "Teach correct attachment",
          give_first_dose_antibiotic: "Give first dose of an appropriate antibiotic.",
          refer_urgently_hospital: "Refer URGENTLY to hospital",
          give_appropriate_antibiotics_5days: "Give appropriate antibiotics for 5 days",
          wheeze_inhaled_bronchodilator: "If wheezing (or disappeared after rapidly acting bronchodilator) give an inhaled bronchodilator for 5 days.",
          soothe_throat_cough: "Soothe the throat and relieve the cough with a safe remedy.",
          cough_14_days_refer: "If coughing for 14 days or more refer for assessment.",
          return_immediately: "Advise mother when to return immediately.",
          follow_up_3_days: "Follow-up in 3 days.",
          follow_up_5_days: "Follow up in 5 days if not improving.",
          treat_wheezing: "Treat wheezing if present.",
          plan_c: "Give fluid for severe dehydration (Plan C)",
          continue_breastfeeding: "Advise the mother to continue breastfeeding.",
          cholera_antibiotic: "If child is 2 years or older and there is cholera in your area, give antibiotic for cholera.",
          plan_b: "Give fluid for some dehydration (Plan B)",
          plan_a_50_100: "Give fluid and food to treat diarrhea at home (Plan A): 50-100 ml after loose stool",
          plan_a_100_200: "Give fluid and food to treat diarrhea at home (Plan A): 100-200 ml after loose stool",
          zinc_10mg: "Give Zinc: 10 mg (1/2 tab) x 14 days",
          zinc_20mg: "Give Zinc: 20 mg (1 tab) x 14 days",
          zinc_greater_2mo: "Give Zinc (if >2mo)",
          cipro_3days: "Give an oral ciprofloxacin for 3 days.",
          treat_dehydration_before_referral: "Treat dehydration before referral unless the child has another severe classification.",
          advise_feeding_persistent_diarrhea: "Advise the mother on feeding a child who has PERSISTENT DIARRHOEA.",
          vit_a_dose: "Give dose of Vitamin A",
          assess_other_fever: "Assess for other cause of fever and treat accordingly.",
          fever_7_days_refer: "If fever for 7 days or more refer for assessment",
          follow_up_fever_3_days: "Follow-up in 3 days if fever persist.",
          coartem_first_line: "Give first line of oral antimalarial (Coartem).",
          primaquine_vivax: "In case of Vivax give primaquine after completion of the first line antimalaria",
          measles_vit_a: "Give Vitamin A treatment",
          tetracycline_eye: "If clouding of the cornea or pus draining from the eye, apply tetracycline eye ointment.",
          tetracycline_pus: "If pus draining from the eye, treat eye infection with tetracycline eye ointment.",
          gentian_violet_mouth: "If mouth ulcers, treat with gentian violet.",
          advise_feed_child: "Advise the mother to feed the child.",
          paracetamol_pain: "Give first dose of paracetamol for pain",
          dry_ear_wicking: "Dry the ear by wicking.",
          quinolones_ear_drop: "Give Quinolones ear drop",
          no_treatment_advised: "No treatment advised.",
          refer_hearing_problem: "Refer for assessment if there is hearing problems",
          give_iron: "Give iron*",
          mebendazole_dose: "Give mebendazole if child is 1 year or older and has not received dose in the last 6 months",
          follow_up_14_days: "Follow-up in 14 days.",
          assess_feeding_less_2yrs: "If child is less than 2 years old, assess the child's feeding and counsel the mother on feeding according to the feeding recommendations.",
          no_additional_treatment: "No additional treatment",
          keep_child_warm: "Keep the child warm.",
          refer_otp_rutf: "Refer for Outpatient Therapeutic Program (OTP) for ready-to-use therapeutic food (RUTF) if a child aged 6 months or more.",
          counsel_feed_child: "Counsel the mother on how to feed the child.",
          refer_supplementary_feeding: "Refer for the child for Supplementary feeding program if available.",
          assess_feeding_growth_monitoring: "Assess the child's feeding and counsel the mother on the feeding recommendations and refer for growth monitoring and health promotion.",
          follow_up_feeding_7_days: "If feeding problem, follow up in 7 days.",
          follow_up_30_days: "Follow-up in 30 days.",
          counsel_feeding_mother_card: "Counsel on feeding problem using mother card",
          praise_mother_feeding: "Praise the mother for feeding the child well",
          diazepam_rectally: "Give Diazepam rectally",
          give_paracetamol_high_fever: "Give one dose of paracetamol in clinic for high fever (38.5° or above)",
          im_quinine: "IM Quinine (first dose)"
        },
        common: {
          child_name: "Child Name", date: "Date", sex: "Sex", male: "Male", female: "Female", age_days_weeks: "Age (Days-Weeks)", age_months: "Age (Months)", weight: "Weight (kg)", length: "Length/Ht (cm)", temp: "Temp (°C)", ask_problems: "Ask: What are the child problems?", visit_type: "Visit Type", initial_visit: "Initial Visit", follow_up: "Follow up", ask_look: "Ask & Look", classify: "Classify", identify_treatment: "Identify Treatment", yes: "Yes", no: "No", duration: "Duration", days: "Days", save_infant: "Save Infant Assessment", save_child: "Save Child Assessment", return_follow_up: "Return follow up after:", select_age_group: "Select age group to begin assessment", infant_button: "Sick Young Infant (Up to 2 Months)", child_button: "Sick Child (2 Months up to 5 Years)"
        },
        classifications: {
          possible_severe_bacterial_infection: "POSSIBLE SEVERE BACTERIAL INFECTION", local_bacterial_infection: "LOCAL BACTERIAL INFECTION", severe_jaundice: "SEVERE JAUNDICE", jaundice: "JAUNDICE", no_jaundice: "NO JAUNDICE", feeding_problem_low_weight: "FEEDING PROBLEM OR LOW WEIGHT", danger_sign: "DANGER SIGN PRESENT", severe_pneumonia: "SEVERE PNEUMONIA OR VERY SEVERE DISEASE", pneumonia: "PNEUMONIA", cough_cold: "COUGH OR COLD", severe_dehydration: "SEVERE DEHYDRATION", some_dehydration: "SOME DEHYDRATION", no_dehydration: "NO DEHYDRATION", severe_persistent_diarrhea: "SEVERE PERSISTENT DIARRHOEA", persistent_diarrhea: "PERSISTENT DIARRHOEA", dysentery: "DYSENTERY", very_severe_febrile: "VERY SEVERE FEBRILE DISEASE", malaria: "MALARIA", fever_no_malaria: "FEVER - NO MALARIA", severe_complicated_measles: "SEVERE COMPLICATED MEASLES", measles_eye_mouth: "MEASLES WITH EYE OR MOUTH COMPLICATIONS", measles: "MEASLES", mastoiditis: "MASTOIDITIS", chronic_ear_infection: "CHRONIC EAR INFECTION", acute_ear_infection: "ACUTE EAR INFECTION", no_ear_infection: "NO EAR INFECTION (other ear problems)", severe_anemia: "SEVERE ANAEMIA", anemia: "ANAEMIA", no_anemia: "NO ANAEMIA", complicated_sam: "COMPLICATED SEVERE ACUTE MALNUTRITION (SAM)", uncomplicated_sam: "UNCOMPLICATED SEVERE ACUTE MALNUTRITION (SAM)", mam: "MODERATE ACUTE MALNUTRITION (MAM)", no_malnutrition: "NO ACUTE MALNUTRITION", fully_vaccinated: "FULLY VACCINATED", partially_vaccinated: "PARTIALLY VACCINATED", not_vaccinated: "NOT VACCINATED", feeding_problem: "FEEDING PROBLEM", no_feeding_problem: "NO FEEDING PROBLEM", other_problem_noted: "OTHER PROBLEM NOTED"
        },
        infant: {
          check_severe_disease: "CHECK FOR SEVERE DISEASE AND LOCAL BACTERIAL INFECTION", ask: "Ask", look: "Look", diff_feeding: "Is the infant having difficulty in feeding or not feeding well?", convulsions: "Has the infant had convulsions?", convulsing_now: "Is the infant convulsing now?", movement: "Look at young infant movement, does it Move only when stimulated or No movement at all?", count_breaths: "Count the breaths in one minute:", repeat_60: "Repeat if 60 breath/min or more:", fast_breathing: "Fast breathing?", chest_indrawing: "Look for severe chest indrawing.", fever_38: "Fever (temperature 37.5°C or above feels hot)", low_temp: "Low body temperature (below 35.5°C or feels cool)", umbilicus: "Look at the umbilicus. Is it red or draining pus?", pus_eyes: "Look for pus draining from the eyes.", skin_pustules: "Look for skin pustules.", check_jaundice: "CHECK FOR JAUNDICE", if_jaundice_ask: "If jaundice present asks:", jaundice_24h: "Did the jaundice appear in the first 24 hours?", jaundice_low_weight: "Is the infant weighing less than 2.5kg and has jaundice in any part of the body?", jaundice_palms_soles: "Look at the palms and soles. Are they yellow?", check_diarrhea: "DOES THE YOUNG INFANT HAVE DIARRHOEA?", blood_in_stool: "Blood in stool", general_condition: "General condition:", diarrhea_movement: "Movement only when stimulated or no movement at all?", diarrhea_restless: "Restless and irritable?", sunken_eyes: "Sunken eyes.", skin_pinch: "Skin pinch returns:", very_slowly: "very slowly (more than 2 seconds)", slowly: "slowly", check_feeding: "CHECK FOR FEEDING PROBLEM OR LOW WEIGHT", any_diff_feeding: "Is there any difficulty feeding?", is_breastfed: "Is the infant breastfed?", times_24h: "If yes, how many times in 24 hours?", times: "times", other_foods: "Does infant usually receive any other foods or drinks?", how_often: "If yes, how often?", what_use_feed: "What do you use to feed the child?", determine_weight: "Determine weight for age.", low: "Low", not_low: "Not Low", thrush: "Ulcers or patches in the mouth (thrush).", assess_breastfeeding: "ASSESS BREASTFEEDING:", if_no_refer: "If no indication to refer urgently to hospital", well_positioned: "Is the infant well positioned?", pos_well: "Well positioned", pos_not_well: "Not well positioned", pos_in_line: "Infant's head and body in line.", pos_nose: "Infant approaching breast with nose opposite to the nipple.", pos_close: "Infant held close to the mother's body.", pos_supported: "Infant's whole body supported not just neck and shoulder.", able_to_attach: "Is the infant able to attach?", att_good: "Good attachment", att_not_well: "Not well attached", att_chin: "Chin touching breast.", att_mouth_wide: "Mouth wide open.", att_lower_lip: "Lower lip turned outward.", att_areola: "More areola above than below the mouth.", sucking_effectively: "Is the infant sucking effectively?", suck_effective: "Sucking effectively", suck_not_effective: "Not suckling effectively", check_vaccination: "Check for vaccination", check_given: "(check on given vaccine and circle missed vaccine)", at_birth: "At birth", weeks_6: "6 weeks", any_other_problems: "Any other problems?", describe_other: "Describe other problems..."
        },
        child: {
          danger_signs: "Check for general danger signs (for all patient)", not_able_drink: "Not able to drink or breastfeed", lethargic_unconscious: "Lethargic or unconscious", vomits_everything: "Vomits every thing", convulsing_now: "Convulsing now", history_convulsions: "Convulsions in current illness", cough_title: "Does the child have cough or shortness of breath?", breath_rate: "Breath rate =", breath_per_min: "breath/min", fast_breathing: "Fast breathing?", chest_indrawing: "Chest indrawing", look_listen: "Look and listen for:", stridor: "Stridor", wheeze: "Wheeze", diarrhea_title: "Does the child have diarrhea?", lethargic: "Lethargic", restless_irritable: "Restless, irritable", offer_drink: "Offer child to drink:", drink_poorly: "Not able or drink poorly", drink_eagerly: "Drink eagerly", fever_title: "Does the child have fever? (By temp 37.5 or more - history of fever – feeling hot)", daily_fever_7: "Daily Fever for more than 7 days", measles_3m: "Measles in last 3 months", neck_stiffness: "Neck stiffness", measles_rash: "Generalized rash of measles", malaria_test: "Malaria test", if_no_danger: "(if no danger sign or neck stiffness)", positive: "Positive (Falciparum or Vivax)", negative: "Negative", if_measles: "If the child have rash of measles or history of measles in the last 3 month", mouth_ulcers: "Mouth ulcers,", deep_ulcers: "are they deep and extensive?", pus_eye: "Pus draining from the eye", cornea: "Clouding of the cornea", ear_title: "Does child had ear problem?", ear_pain: "Ear pain", ear_discharge: "Ear discharge, duration", tender_swelling: "Tender swelling behind ear", pus_ear: "Pus is seen draining from the ear", anemia_title: "Check for anemia (for all patient)", severe_pallor: "Severe palmar pallor", some_pallor: "Some palmar pallor", no_pallor: "No palmar pallor", malnutrition_title: "Check for malnutrition (for all patient)", edema: "Edema of both feet", z_score: "Z score:", less_3z: "Less than -3Z", between_3_2: "Between -3 and -2 Z", more_2z: "-2 Z or more", muac: "MUAC:", enter_muac: "(Enter value to check complications)", if_z_muac: "If Z score less than -3 or MUAC less than 11.5 cm, check for:", med_comp: "Medical complication: General danger sign • Severe classification • Chest indrawing", appetite_test: "Appetite test if no medical complications:", passed: "Passed appetite test", failed: "Failed appetite test", vaccine_title: "Check for vaccination and vitamin A supplementation", vit_a_desc: "Vitamin A (start at 6 months and given every 6 month)", feeding_title: "Use Mother card to Assess child feeding if", check_applicable: "Check if applicable:", age_less_2: "Age less than 2 years", had_mam: "Had moderate acute malnutrition", had_anemia: "Had anemia", feeding_status: "Feeding Status:", feeding_problem_btn: "Feeding problem", no_feeding_problem_btn: "No feeding problem"
        }
      }
    }
  },
  ar: {
    translation: {
      general: {
        app_title: "البرنامج القومي لصحة الطفل", dashboard: "لوحة متابعة الإشراف", btn_refresh: "تحديث", btn_back: "العودة للقائمة الرئيسية", loading: "جاري تحميل بيانات اللوحة...", please_wait: "يرجى الانتظار بينما نقوم بجلب أحدث السجلات."
      },
      filters: {
        date: "تصفية حسب التاريخ", state: "الولاية", locality: "المحلية", facility: "المؤسسة الصحية", project: "المشروع / الشريك", job_title: "الوصف الوظيفي", worker_name: "اسم العامل الصحي"
      },
      programs: {
        imnci: "المعالجة المتكاملة لأمراض الطفولة وحديثي الولادة (IMNCI)", eenc: "الرعاية الأساسية المبكرة لحديثي الولادة (EENC)", infection_control: "مكافحة العدوى", cord_management: "العناية بالحبل السري (للحالات المستقرة)"
      },
      skills: {
        overall_score: "درجة الالتزام الكلية", assess_classify: "التقييم والتصنيف", treatment_counsel: "العلاج والنصح", danger_signs: "تقييم علامات الخطورة", measurements: "مهارات القياس"
      },
      mothers: {
        total_interviews: "إجمالي مقابلات الأمهات", knowledge_treatment: "معرفة الأم: العلاج", satisfaction: "رضا الأم"
      },
      dashboard: {
        service_coverage_title: "لوحة تغطية الخدمات", refresh_data: "تحديث البيانات", syncing: "جاري مزامنة بيانات اللوحة...",
        tabs: { combined: "ملخص التغطية", neonatal: "تغطية الرعاية الخاصة لحديثي الولادة", eenc: "تغطية الرعاية الضرورية لحديثي الولادة (EENC)", imnci: "تغطية العلاج المتكامل لأمراض الطفولة (IMNCI)", critical: "الطوارئ والعناية الحرجة" },
        filters: { state: "الولاية", locality: "المحلية", ownership: "الملكية", project: "المشروع", has_equipment: "توفر الأجهزة", all_states: "كل الولايات", all_localities: "كل المحليات", all_ownerships: "كل الملكيات", all_projects: "كل المشاريع", any: "الكل" },
        cards: { total_pediatrics_emonc: "إجمالي مستشفيات الأطفال وطوارئ الولادة", functioning_scnu: "وحدات الرعاية الخاصة للاطفال حديثي الولادة العاملة", facilities_with_cpap: "مؤسسات تتوفر بها أجهزة التنفس الصناعي بالضغط الهوائي المستمر CPAP", total_emonc: "إجمالي مؤسسات طوارئ الولادة", functional_emonc: "مؤسسات طوارئ الولادة العاملة", eenc_coverage_functional: "تغطية الرعاية الضرورية المبكرة للاطفال حديثي الولادة في المؤسسات العاملة", total_functioning_phc: "إجمالي مراكز الرعاية الأساسية العاملة", total_phc_imnci: "مراكز الرعاية الأساسية المطبقة لـ العلاج المتكامل لامراض الطفولة", imnci_coverage_phc: "تغطية العلاج المتكامل لامراض الطفولة في الرعاية الأساسية", target_hospitals_etat: "المستشفيات المستهدفة (الفرز والتقييم والمعالجة للاطفال في الطوارئ)", hospitals_etat: "مستشفيات تتوفر بها الفرز والتقييم والمعالجة للاطفال في الطوارئ", facilities_hdu: "مؤسسات تتوفر بها عناية وسيطة للاطفال", facilities_picu: "مؤسسات تتوفر بها العناية المكثفة PICU", out_of: "من أصل" },
        headers: { scnu_coverage: "تغطية الرعاية الخاصة للاطفال حديثي الولادة (الحضانة) حسب", neonatal_equipment: "توفر معدات وحدات حديثي الولادة", functioning_neonatal_units: "قائمة وحدات الرعاية الخاصة للاطفال حديثي الولادة (SCNU) العاملة", eenc_coverage: "تغطية الرعاية الضرورية المبكرة للاطفال حديثي الولادة حسب", eenc_equipment: "توفر معدات الرعاية الضرورية المبكرة للاطفال حديثي الولادة بالوحدة", imnci_coverage: "تغطية العلاج المتكامل لامراض الطفولة حسب", imnci_tools: "توفر أدوات العلاج المتكامل لامراض الطفولة حسب", critical_care_coverage: "تغطية العناية الحرجة حسب", critical_care_capacity: "سعة ومعدات العناية الحرجة", geographic_map: "الخريطة الجغرافية", geographic_coverage: "التغطية الجغرافية وأداء الخدمات" },
        table: { state: "الولاية", locality: "المحلية", hospital_name: "اسم المستشفى", total_supposed: "المستهدف", with_scnu: "تطبق الرعاية الخاصة للاطفال حديثي الولادة (الحضانة)", coverage_chart: "مخطط التغطية", incubators: "الحضانات", cots: "الأسرة", total_beds: "إجمالي الأسرة", functional_emonc: "طوارئ ولادة عاملة", with_eenc: "تطبق الرعاية الضرورية المبكرة للاطفال حديثي الولادة", functioning_phcs: "مراكز عاملة", phcs_with_imnci: "مراكز تطبيق العلاج المتكامل", target_hospitals: "المستشفيات المستهدفة", with_hdu: "تطبق العناية الوسيطة للاطفال", with_picu: "تطبق العناية المكثفة للاطفال", with_etat: "تطبق الفرز والتقييم والمعالجة للاطفال في الطوارئ", overall_average: "المتوسط الكلي", imnci_register: "سجل العلاج المتكامل", imnci_registers: "سجلات العلاج المتكامل", chart_booklet: "كتيب اللوحات", imnci_chartbooklet: "كتيبات لوحات العلاج المتكامل", weight_scale: "ميزان وزن", height_scale: "مقياس طول", thermometer: "مقياس حرارة", timer: "ساعة مؤقت", ort_corner: "زاوية إرواء", total_functioning_phcs: "إجمالي المراكز العاملة", no_data: "لا توجد بيانات تطابق الفلاتر الحالية." },
        map: { legend: "المفتاح (متوسط التغطية):", no_data: "0-39٪ (أو لا توجد بيانات)", range_mid: "40-74٪", range_high: "≥75٪", facility: "مؤسسة صحية", state: "الولاية", locality: "المحلية", hide_fac: "إخفاء المؤسسات", show_fac: "إظهار المؤسسات", full: "تكبير", close: "إغلاق" },
        kpi: { imnci: { title: "العلاج المتكامل لأمراض الطفولة (IMNCI)", num: "المراكز المطبقة", den: "المراكز الكلية المستهدفة" }, etat: { title: "الفرز والتقييم والمعالجة في الطوارئ (ETAT)", num: "المستشفيات المطبقة", den: "المستشفيات المستهدفة (أطفال/عامة)" }, eenc: { title: "الرعاية الضرورية المبكرة لحديثي الولادة (EENC)", num: "المستشفيات المطبقة", den: "مستشفيات طوارئ الحمل والولادة" }, scnu: { title: "الرعاية الخاصة لحديثي الولادة (SCNU)", num: "المستشفيات المطبقة", den: "المستشفيات المستهدفة" }, overall_coverage: "التغطية الكلية" },
        equip: { "Total Beds": "إجمالي الأسرة", "Incubators": "حضانات", "Cots": "سرير أطفال حديثي ولادة", "Phototherapy Units": "وحدات علاج ضوئي", "Oxygen Machines": "أجهزة أكسجين", "Oxygen Cylinders": "أسطوانات أكسجين", "Respiration Monitors": "أجهزة مراقبة تنفس", "CPAP Machines": "أجهزة تنفس صناعي بالضغط الهوائي المستمر CPAP", "Mechanical Ventilators": "أجهزة تنفس صناعي", "Neonatal Warmers": "دفايات لحديثي الولادة", "Infusion Pumps": "مضخات سوائل", "Syringe Pumps": "مضخات حقن", "Suction Devices": "أجهزة شفط", "Resuscitation Bags": "امبوباق", "Portable Incubators": "دفايات محمولة", "Delivery Beds": "سرير ولادة", "Resuscitation Stations": "محطات إنعاش", "Warmers": "دفايات", "Ambu Bags": "أمبوباق", "Manual Suction": "شفاط يدوي", "Wall Clock": "ساعة حائط", "Steam Sterilizer": "معقم بخاري", "ETAT CPAP": "CPAP طوارئ", "ETAT Suction": "شفاط طوارئ", "HDU Beds": "أسرة عناية وسيطة", "HDU CPAP": "CPAP عناية وسيطة", "PICU Beds": "أسرة عناية مكثفة" }
      },
      landing: {
        welcome: "مرحباً", subtitle: "اختر الوحدة للبدء", no_permissions: "لا تملك الصلاحيات لعرض أي وحدات. يرجى التواصل مع مسؤول النظام.",
        modules: { dashboard: "منصة المعلومات", courses: "الدورات", human_resources: "الموارد البشرية", facilities: "خدمات صحة الطفل", mentorship: "الإرشاد السريري", imci: "تقييم IMCI", projects: "متابعة المشاريع", planning: "الخطة الرئيسية", admin: "المدير", home: "الرئيسية" }
      },
      app: {
        title: "البرنامج القومي لصحة الطفل", subtitle: "نظام متابعة البرامج والدورات", loading_system: "جاري تحميل النظام، يرجى الانتظار...", offline: "أنت غير متصل بالإنترنت. يتم حفظ التغييرات محلياً وستتم مزامنتها عند الاتصال.", syncing: "جاري مزامنة البيانات غير المتصلة مع السحابة...", welcome: "مرحباً", logout: "تسجيل الخروج"
      },
      imci: {
        form_title: "استمارة تقييم الرعاية المتكاملة (IMNCI)",
        infant_title: "معالجة الرضيع المريض حتى عمر شهرين", child_title: "معالجة الطفل المريض من عمر شهرين إلى أقل من 5 سنوات",
        placeholders: {
          child_name: "أدخل اسم الطفل بالكامل",
          age_days: "مثال: 3 أسابيع",
          age_months: "مثال: 24",
          weight: "مثال: 12.5",
          length: "مثال: 85.0",
          temp: "مثال: 37.8",
          problems: "صف المشاكل الأساسية باختصار...",
          other_problems: "أذكر المشاكل الأخرى..."
        },
        common_phrases: {
          no_treatments: "لا توجد علاجات محددة",
          next_vaccine: "جرعة التطعيم القادمة",
          next_vit_a: "جرعة فيتامين أ القادمة",
          note: "ملاحظة: ",
          treatment_needed_other: "يحتاج لعلاج للمشكلة الأخرى"
        },
        vaccines: {
          opv0: "الشلل 0", bcg: "السل (بي سي جي)", opv1: "الشلل 1", rota1: "الروتا 1", pcv1: "المكورات 1", penta1: "الخماسي 1", ipv1: "الشلل العضلي 1",
          opv2: "الشلل 2", rota2: "الروتا 2", pcv2: "المكورات 2", penta2: "الخماسي 2",
          opv3: "الشلل 3", rota3: "الروتا 3", pcv3: "المكورات 3", penta3: "الخماسي 3", ipv2: "الشلل العضلي 2",
          mr: "الحصبة والحصبة الألمانية", yellowFever: "الحمى الصفراء", menA: "السحائي أ", mrBooster: "الحصبة التعزيزية", vitA: "فيتامين أ (جرعة كل 6 شهور ابتداء من عمر 6 شهور)",
          w10: "10 أسابيع", w14: "14 أسبوع", m9: "9 أشهر", m18: "18 شهر"
        },
        treatments: {
          refer_urgently: "حوله عاجلاً للمستشفى",
          im_antibiotic: "مضاد حيوي بالعضل",
          prevent_low_blood_sugar: "تجنب انخفاض السكر في الدم",
          keep_warm: "انصح الأم بتدفئة الطفل",
          oral_antibiotic: "أعط مضاد حيوي بالفم",
          treat_local_infection: "عالج الالتهاب الموضعي",
          home_care: "رعاية منزلية للوليد",
          iv_fluids: "سوائل وريدية",
          ors: "محلول معالجة الجفاف (ORS)",
          treat_thrush: "عالج القلاع (فطريات الفم)",
          council_breastfeeding: "قدم النصح حول الرضاعة الطبيعية",
          teach_position: "علم الأم الوضع الصحيح للرضاعة",
          teach_attachment: "علم الأم التعلق الصحيح",
          give_first_dose_antibiotic: "أعط الجرعة الأولى من المضاد الحيوي المناسب.",
          refer_urgently_hospital: "حوله عاجلاً للمستشفى",
          give_appropriate_antibiotics_5days: "أعط المضاد الحيوي المناسب لمدة 5 أيام",
          wheeze_inhaled_bronchodilator: "عالج الأزيز إذا وجد أو كان موجوداً واختفى بإعطاء موسع الشعب الهوائية لمدة 5 أيام.",
          soothe_throat_cough: "لطف الحلق وعالج الكحة بملطف مناسب.",
          cough_14_days_refer: "إذا كانت الكحة لمدة 14 يوم أو أكثر، حول الطفل للمستشفى لمزيد من التقييم.",
          return_immediately: "انصح الأم متى تعود بالطفل فوراً.",
          follow_up_3_days: "تابع حالته بعد 3 أيام.",
          follow_up_5_days: "تابع حالته بعد 5 أيام إذا لم يتحسن.",
          treat_wheezing: "عالج الأزيز إن وجد.",
          plan_c: "أعط الطفل سوائل لعلاج الجفاف الشديد حسب خطة المعالجة (ج)",
          continue_breastfeeding: "أنصح الأم لتستمر في إرضاع الطفل.",
          cholera_antibiotic: "إذا كان عمر الطفل سنتين أو أكثر وتوجد كوليرا في المنطقة، أعط المضاد الحيوي المناسب للكوليرا.",
          plan_b: "أعط الطفل سوائل وطعام لعلاج بعض الجفاف حسب خطة المعالجة (ب)",
          plan_a_50_100: "أعط سوائل وطعام للطفل لعلاج الإسهال في المنزل حسب خطة المعالجة (أ): 50-100 مل بعد كل إسهال",
          plan_a_100_200: "أعط سوائل وطعام للطفل لعلاج الإسهال في المنزل حسب خطة المعالجة (أ): 100-200 مل بعد كل إسهال",
          zinc_10mg: "أعط زنك: 10 مجم (نصف حبة) لمدة 14 يوم",
          zinc_20mg: "أعط زنك: 20 مجم (حبة كاملة) لمدة 14 يوم",
          zinc_greater_2mo: "أعط زنك (إذا كان العمر > شهرين)",
          cipro_3days: "أعط سيبروفلوكساسين بالفم لمدة 3 أيام.",
          treat_dehydration_before_referral: "عالج الجفاف قبل التحويل إلا إذا كان للطفل تصنيف شديد آخر.",
          advise_feeding_persistent_diarrhea: "انصح الأم عن تغذية الطفل المصاب بالإسهال المستمر.",
          vit_a_dose: "أعط جرعة فيتامين أ",
          assess_other_fever: "ابحث عن أسباب أخرى للحمى وعالجها بناءً على ذلك.",
          fever_7_days_refer: "يحول لمزيد من التقييم إذا كانت الحمى موجودة لأكثر من 7 أيام.",
          follow_up_fever_3_days: "تابع حالته بعد 3 أيام إذا استمرت الحمى.",
          coartem_first_line: "أعط خط العلاج الأول الموصى به للملاريا بالفم.",
          primaquine_vivax: "في حالة (ملاريا فيفاكس) أعط برايمكوين بعد إكمال خط العلاج الأول.",
          measles_vit_a: "أعط فيتامين أ",
          tetracycline_eye: "في حالة تعتيم القرنية أو صديد في العين أعط مرهم تتراسيكلين.",
          tetracycline_pus: "في حالة وجود صديد في العين أعط مرهم تتراسيكلين.",
          gentian_violet_mouth: "في حالة وجود قرح في الفم عالج بواسطة الجنشن.",
          advise_feed_child: "أرشد الأم عن تغذية الطفل.",
          paracetamol_pain: "أعط جرعة من الباراسيتامول للألم",
          dry_ear_wicking: "جفف الأذن من الصديد بفتيلة.",
          quinolones_ear_drop: "أعط قطرة كينولون للأذن",
          no_treatment_advised: "لا يحتاج الطفل لعلاج",
          refer_hearing_problem: "حول لمزيد من التقييم إذا كان هنالك مشكلة في السمع",
          give_iron: "أعط حديد",
          mebendazole_dose: "أعط ميبندازول إذا كان عمر الطفل سنة فأكثر ولم يأخذ جرعة ميبندازول خلال ال 6 شهور الماضية",
          follow_up_14_days: "تابع حالته بعد 14 يوم.",
          assess_feeding_less_2yrs: "إذا كان عمر الطفل أقل من سنتين قيم تغذيته وأرشد الأم عن تغذية الطفل على حسب ارشادات التغذية.",
          no_additional_treatment: "لا يوجد علاج إضافي",
          keep_child_warm: "أنصح الأم بتدفئة الطفل.",
          refer_otp_rutf: "قم بتحويل الطفل إلى مركز التغذية الخارجي (أو أعط الوجبة العلاجية الجاهزة إذا كان عمر الطفل 6 شهور فأكثر).",
          counsel_feed_child: "قيم تغذية الطفل وأرشد الأم عن تغذية الطفل على حسب إرشادات التغذية.",
          refer_supplementary_feeding: "قم بتحويل الطفل إلى مركز التغذية الخارجي.",
          assess_feeding_growth_monitoring: "قيم تغذية الطفل وأرشد الأم عن تغذية الطفل على حسب إرشادات التغذية.",
          follow_up_feeding_7_days: "في حالة وجود مشكلة تغذية تابع حالته بعد 7 أيام.",
          follow_up_30_days: "تابع حالته بعد 30 يوم.",
          counsel_feeding_mother_card: "أرشد الأم باستخدام كرت التغذية",
          praise_mother_feeding: "امدح الأم على تغذية الطفل بشكل جيد",
          diazepam_rectally: "أعط ديازيبام شرجياً",
          give_paracetamol_high_fever: "أعط جرعة من الباراسيتامول للحمى العالية (38.5م أو أكثر)",
          im_quinine: "اعط الجرعة الأولى من الكينين بالعضل"
        },
        common: { child_name: "اسم الطفل", date: "التاريخ", sex: "الجنس", male: "ذكر", female: "أنثى", age_days_weeks: "العمر (أيام-أسابيع)", age_months: "العمر (أشهر)", weight: "الوزن (كجم)", length: "الطول أو الارتفاع (سم)", temp: "درجة الحرارة", ask_problems: "اسأل: ماهي مشاكل الطفل؟", visit_type: "نوع الزيارة", initial_visit: "زيارة ابتدائية", follow_up: "زيارة متابعة", ask_look: "اسأل وانظر", classify: "التصنيف", identify_treatment: "العلاج", yes: "نعم", no: "لا", duration: "منذ متى؟", days: "أيام", save_infant: "حفظ تقييم الرضيع", save_child: "حفظ تقييم الطفل", return_follow_up: "يعود للمتابعة بعد:", select_age_group: "اختر الفئة العمرية للبدء بالتقييم", infant_button: "الرضيع المريض (حتى شهرين)", child_button: "الطفل المريض (شهرين إلى 5 سنوات)" },
        classifications: {
          possible_severe_bacterial_infection: "احتمال الإصابة بالتهاب بكتيري خطير", local_bacterial_infection: "التهاب بكتيري موضعي", severe_jaundice: "يرقان شديد", jaundice: "يرقان", no_jaundice: "لا يوجد يرقان", feeding_problem_low_weight: "مشكلة في التغذية أو نقص الوزن", danger_sign: "توجد علامة خطورة عامة", severe_pneumonia: "التهاب رئوي شديد أو مرض شديد جداً", pneumonia: "التهاب رئوي", cough_cold: "كحة أو نزلة برد", severe_dehydration: "جفاف شديد", some_dehydration: "بعض الجفاف", no_dehydration: "لا يوجد جفاف", severe_persistent_diarrhea: "إسهال مستمر شديد", persistent_diarrhea: "إسهال مستمر", dysentery: "دسنتاريا", very_severe_febrile: "مرض حمي شديد", malaria: "ملاريا", fever_no_malaria: "حمى لايوجد ملاريا", severe_complicated_measles: "حصبه مصحوبه بمضاعفات شديدة", measles_eye_mouth: "حصبه مصحوب بمضاعفات في العين أو الفم", measles: "حصبه", mastoiditis: "التهاب العظمة خلف الأذن (الماستويد)", chronic_ear_infection: "التهاب أذن مزمن", acute_ear_infection: "التهاب أذن حاد", no_ear_infection: "لا يوجد التهاب في الأذن", severe_anemia: "فقر دم شديد", anemia: "فقر دم", no_anemia: "لايوجد فقر دم", complicated_sam: "سوء تغذية حاد شديد بمضاعفات طبية", uncomplicated_sam: "سوء تغذية حاد شديد غير مصحوب بمضاعفات طبية", mam: "سوء تغذية حاد متوسط", no_malnutrition: "لا يوجد سوء تغذية حاد", fully_vaccinated: "مكتمل التطعيم", partially_vaccinated: "تطعيم جزئي", not_vaccinated: "غير مطعم", feeding_problem: "توجد مشكلة في التغذية", no_feeding_problem: "لا توجد مشكلة في التغذية", other_problem_noted: "توجد مشاكل أخرى"
        },
        infant: {
          check_severe_disease: "ابحث عن احتمال الإصابة بالتهاب بكتيري خطير أو التهاب بكتيري موضعي", ask: "أسأل", look: "أنظر", diff_feeding: "هل توجد أي صعوبة في التغذية أو لا يتغذى جيداً؟", convulsions: "هل هنالك تشنجات؟", convulsing_now: "هل الوليد يتشنج الآن؟", movement: "أنظر حركة الوليد: لا يتحرك أبدا أو لا يتحرك الا بعد التحفيز", count_breaths: "أحسب التنفس في دقيقة واحدة:", repeat_60: "أعد حساب التنفس إذا كان 60 نفس على الدقيقة أو أكثر:", fast_breathing: "تنفس سريع؟", chest_indrawing: "أنظر إلى انسحاب الصدر الشديد للداخل", fever_38: "هل توجد حمى (درجة الحرارة 37.5 أو أكثر أو ملمسه ساخن)", low_temp: "هل حرارة الجسم منخفضة (الحرارة أقل من 35.5 أو ملمسه بارد)", umbilicus: "أنظر للسرة هل بها احمرار أو ينزل منها صديد؟", pus_eyes: "أنظر لصديد خارج من العين", skin_pustules: "أنظر لوجود بثور في الجلد", check_jaundice: "تأكد من وجود اليرقان؟", if_jaundice_ask: "إذا وجد يرقان أسال:", jaundice_24h: "هل ظهر اليرقان خلال ال 24 ساعة الأولى؟", jaundice_low_weight: "هل يزن الوليد أقل من 2.5كجم ولديه يرقان في اي مكان من جسمه؟", jaundice_palms_soles: "هل يمتد اليرقان للكفين وباطن القدمين؟", check_diarrhea: "هل يعاني الطفل من إسهال؟", blood_in_stool: "هل يوجد دم بالبراز؟", general_condition: "أنظر إلى الحالة العامة للوليد:", diarrhea_movement: "لا يتحرك الا بعد التحفيز أو لا يتحرك أبدا", diarrhea_restless: "قلق أو متوتر", sunken_eyes: "انظر هل العينان غائرتان.", skin_pinch: "خذ قرصة من جلد البطن. هل يعود لحالته:", very_slowly: "ببطء شديد (أكثر من ثانيتين)", slowly: "ببطء", check_feeding: "تحر عن وجود مشكلة في التغذية أو نقص في الوزن:", any_diff_feeding: "هل توجد أي صعوبة في التغذية؟", is_breastfed: "هل الوليد يرضع؟", times_24h: "إذا نعم، كم مرة في 24 ساعة؟", times: "مرات", other_foods: "هل يتناول الوليد أي أطعمة أو مشروبات أخرى؟", how_often: "إذا نعم. كم مرة في اليوم؟", what_use_feed: "ما هي الأدوات المستعملة لتغذية الطفل؟", determine_weight: "حدد الوزن بالنسبة للعمر:", low: "ناقص", not_low: "غير ناقص", thrush: "انظر لوجود قرح أو نقاط بيضاء في الفم", assess_breastfeeding: "تأكد من وضع وتعلّق الوليد:", if_no_refer: "اذا لم يتم إرضاعه في الساعة الماضية، أطلب من الأم إرضاعه", well_positioned: "تأكد من وضع الوليد:", pos_well: "وضع صحيح", pos_not_well: "وضع غير صحيح", pos_in_line: "رأس الوليد في وضع مستقيم مع جسمه", pos_nose: "الوليد يواجه ثدي الأم ويكون أنفه مقابل للحلمة", pos_close: "جسم الوليد قريبا من جسم الام", pos_supported: "تسند بيديها جسم الوليد كله وليس فقط عنقه وكتفيه", able_to_attach: "تأكد من تعلق الوليد:", att_good: "تعلق جيد", att_not_well: "تعلق غير جيد", att_chin: "حنك الوليد يلامس الثدي", att_mouth_wide: "الفم مفتوح واسعا", att_lower_lip: "الشفة السفلى متجهة إلى الخارج", att_areola: "هالة الثدي أعلى فم الرضيع أكبر من الجزء أسفله", sucking_effectively: "هل الرضيع يرضع بصورة فعالة؟", suck_effective: "يرضع بفاعلية", suck_not_effective: "لا يرضع بفاعلية", check_vaccination: "تحر عن تطعيم الطفل", check_given: "(ضع دائرة حول التطعيم الذي يحتاجه الطفل)", at_birth: "عند الولادة", weeks_6: "6 أسابيع", any_other_problems: "قيم أي مشاكل أخرى", describe_other: "أذكر المشاكل الأخرى..."
        },
        child: {
          danger_signs: "اسأل وتأكد من وجود علامات الخطورة العامة:", not_able_drink: "لا يستطيع أن يشرب أو يرضع", lethargic_unconscious: "خامل أو فاقد الوعي", vomits_everything: "يتقيأ كل شيء", convulsing_now: "متشنج الآن", history_convulsions: "تشنجات أثناء المرض الحالي", cough_title: "هل يعاني الطفل من الكحة أو صعوبة في التنفس؟", breath_rate: "أحسب التنفس في دقيقة =", breath_per_min: "نفس في الدقيقة", fast_breathing: "تنفس سريع؟", chest_indrawing: "انظر انسحاب الصدر للداخل", look_listen: "انظر واستمع لـ:", stridor: "الصرير", wheeze: "الأزيز", diarrhea_title: "هل يعاني الطفل من إسهال؟", lethargic: "خامل أو فاقد الوعي", restless_irritable: "قلق أو متوتر", offer_drink: "أعط الطفل شيئا ليشربه:", drink_poorly: "لا يستطيع الشرب/شربه ضعيف", drink_eagerly: "يشرب بلهفة /عطشان", fever_title: "هل يعاني الطفل من حمى (بالشكوى/ملمسه ساخن/ درجة حرارته 37.5 م أو أكثر)؟", daily_fever_7: "حمى يوميا لمدة أكثر من 7 يوم", measles_3m: "هل أصيب الطفل بالحصبة خلال ال 3 أشهر الأخيرة؟", neck_stiffness: "انظر وتحسس لتيبس العنق", measles_rash: "انظر لعلامات الحصبة: طفح جلدي عام", malaria_test: "افحص الدم للملاريا", if_no_danger: "(إذا لم يكن هنالك علامة خطورة أو تيبس للعنق)", positive: "موجب (فاليسبرم – فيفاكس)", negative: "سالب", if_measles: "إذا كان الطفل يعاني الآن من حصبة أو خلال ال 3 شهور الأخيرة", mouth_ulcers: "انظر لقرح أو نقاط بيضاء في الفم،", deep_ulcers: "هل هي عميقة أو منتشرة؟", pus_eye: "انظر لصديد نازل من العين", cornea: "انظر لتعيم القرنية", ear_title: "هل يعاني الطفل من مشكلة في الأذن؟", ear_pain: "هل يوجد ألم أذن؟", ear_discharge: "هل يوجد إفراز من الأذن؟", tender_swelling: "تحسس الورم مؤلم خلف الأذن", pus_ear: "انظر لصديد نازل من الأذن", anemia_title: "تحر عن فقر الدم (ابحث عن شحوب الكف)", severe_pallor: "شحوب الكف الشديد", some_pallor: "شحوب الكف الغير شديد", no_pallor: "لا يوجد شحوب بالكف", malnutrition_title: "تحر عن سوء التغذية", edema: "أبحث عن تورم في كلا القدمين", z_score: "حدد الوزن بالنسبة للطول أو الارتفاع:", less_3z: "اقل من -3", between_3_2: "بين -3 و -2", more_2z: "-2 أو أكثر", muac: "قس المواك للطفل اكبرمن 6 اشهر:", enter_muac: "(سم)", if_z_muac: "اذا كان مواك الطفل اقل من 11.5سم او الوزن بالنسبة للارتفاع اقل من -3", med_comp: "تحر من وجود مضاعفات طبية: •علامة خطورة • تصنيف احمر •التهاب مصحوب بانسحاب أسفل الصدر", appetite_test: "اختبار الشهية اذا كان العمر 6شهور فاكثر ولا توجد مضاعفات طبية:", passed: "اجتاز اختبار الشهية", failed: "لم يجتز اختبار الشهية", vaccine_title: "تحر عن تطعيم الطفل واعطاءه جرعة فايتمين أ الوقائية", vit_a_desc: "فيتامين أ (جرعة كل 6 شهور ابتداء من عمر 6 شهور)", feeding_title: "قيم غذاء الطفل باستخدام كرت تقييم التغذية إذا كان:", check_applicable: "تحقق مما إذا كان ينطبق:", age_less_2: "العمر اقل من سنتين", had_mam: "يوجد سوء تغذية حاد متوسط", had_anemia: "يوجد فقر دم", feeding_status: "حالة التغذية:", feeding_problem_btn: "توجد مشكلة في التغذية", no_feeding_problem_btn: "لا يوجد مشكلة في التغذية"
        }
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, 
    },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.setAttribute('dir', i18n.dir(lng));
  document.documentElement.setAttribute('lang', lng);
  localStorage.setItem('app_language', lng);
});

document.documentElement.setAttribute('dir', i18n.dir(i18n.language));
document.documentElement.setAttribute('lang', i18n.language);

export default i18n;