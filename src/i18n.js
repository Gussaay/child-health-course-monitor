// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Standardized National Child Health Glossary
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
        date: "Date Filter",
        state: "State",
        locality: "Locality",
        facility: "Health Facility",
        project: "Project / Partner",
        job_title: "Job Title",
        worker_name: "Health Worker Name"
      },
      programs: {
        imnci: "Integrated Management of Newborn and Childhood Illnesses (IMNCI)",
        eenc: "Early Essential Newborn Care (EENC)",
        infection_control: "Infection Control",
        cord_management: "Cord Management (Breathing Babies)"
      },
      skills: {
        overall_score: "Overall Adherence Score",
        assess_classify: "Assess & Classify",
        treatment_counsel: "Treatment & Counsel",
        danger_signs: "Danger Signs Assessment",
        measurements: "Measurement Skills"
      },
      mothers: {
        total_interviews: "Total Mother Interviews",
        knowledge_treatment: "Mother Knowledge: Treatment",
        satisfaction: "Mother Satisfaction"
      },
      dashboard: {
        service_coverage_title: "Service Coverage Dashboard",
        refresh_data: "↻ Refresh Data Cache",
        syncing: "Syncing Dashboard Data...",
        tabs: {
          combined: "Combined Coverage",
          neonatal: "Neonatal Care Coverage",
          eenc: "EENC Coverage",
          imnci: "IMNCI Coverage",
          critical: "Emergency & Critical Care"
        },
        filters: {
          state: "State",
          locality: "Locality",
          ownership: "Ownership",
          project: "Project",
          has_equipment: "Has Equipment",
          all_states: "All States",
          all_localities: "All Localities",
          all_ownerships: "All Ownerships",
          all_projects: "All Projects",
          any: "Any"
        },
        cards: {
          total_pediatrics_emonc: "Total Pediatrics & EmONC",
          functioning_scnu: "Functioning SCNU Facilities",
          facilities_with_cpap: "Facilities with CPAP",
          total_emonc: "Total EmONC Facilities",
          functional_emonc: "Functional EmONC Facilities",
          eenc_coverage_functional: "EENC Coverage in Functional EmONC",
          total_functioning_phc: "Total Functioning PHC Facilities",
          total_phc_imnci: "Total PHC Facilities with IMNCI",
          imnci_coverage_phc: "IMNCI Service Coverage in PHCs",
          target_hospitals_etat: "Target Hospitals (ETAT)",
          hospitals_etat: "Hospitals with ETAT",
          facilities_hdu: "Facilities with HDU",
          facilities_picu: "Facilities with PICU",
          out_of: "out of"
        },
        headers: {
          scnu_coverage: "SCNU Coverage by",
          neonatal_equipment: "Neonatal Unit Equipment Availability",
          functioning_neonatal_units: "Functioning Neonatal Units (SCNU) List",
          eenc_coverage: "EENC Coverage by",
          eenc_equipment: "EENC Equipment Availability by Unit",
          imnci_coverage: "IMNCI Coverage by",
          imnci_tools: "IMNCI Tools Availability by",
          critical_care_coverage: "Critical Care Coverage by",
          critical_care_capacity: "Critical Care Capacity & Equipment",
          geographic_map: "Geographical Map",
          geographic_coverage: "Geographic Coverage & Service Performance"
        },
        table: {
          state: "State",
          locality: "Locality",
          hospital_name: "Hospital Name",
          total_supposed: "Total Supposed",
          with_scnu: "With SCNU",
          coverage_chart: "Coverage Chart",
          incubators: "Incubators",
          cots: "Cots",
          total_beds: "Total Beds",
          functional_emonc: "Functional EmONC",
          with_eenc: "With EENC",
          functioning_phcs: "Functioning PHCs",
          phcs_with_imnci: "PHCs with IMNCI",
          target_hospitals: "Target Hospitals",
          with_hdu: "With HDU",
          with_picu: "With PICU",
          with_etat: "With ETAT",
          overall_average: "Overall Average",
          imnci_registers: "IMNCI registers",
          imnci_chartbooklet: "IMNCI chartbooklet",
          weight_scale: "weight scale",
          ort_corner: "ORT corner",
          no_data: "No data matches the current filters."
        },
        map: {
          legend: "Legend (Avg Coverage):",
          no_data: "0-39% (or No Data)",
          range_mid: "40-74%",
          range_high: "≥75%",
          facility: "Facility",
          state: "State",
          locality: "Locality",
          hide_fac: "Hide Fac.",
          show_fac: "Show Fac.",
          full: "Full",
          close: "Close"
        },
        kpi: {
          imnci: {
            title: "Integrated Management of Childhood Illness (IMNCI)",
            num: "Implementing Centers",
            den: "Targeted Centers"
          },
          etat: {
            title: "Emergency Triage Assessment and Treatment (ETAT)",
            num: "Implementing Hospitals",
            den: "Targeted Hospitals"
          },
          eenc: {
            title: "Early Essential Newborn Care (EENC)",
            num: "Implementing Hospitals",
            den: "EmONC Hospitals"
          },
          scnu: {
            title: "Special Care Newborn Unit (SCNU)",
            num: "Implementing Hospitals",
            den: "Targeted Hospitals"
          },
          overall_coverage: "Overall Coverage"
        },
        equip: {
            "Total Beds": "Total Beds",
            "Incubators": "Incubators",
            "Cots": "Cots",
            "Phototherapy Units": "Phototherapy Units",
            "Oxygen Machines": "Oxygen Machines",
            "Oxygen Cylinders": "Oxygen Cylinders",
            "Respiration Monitors": "Respiration Monitors",
            "CPAP Machines": "CPAP Machines",
            "Mechanical Ventilators": "Mechanical Ventilators",
            "Neonatal Warmers": "Neonatal Warmers",
            "Infusion Pumps": "Infusion Pumps",
            "Syringe Pumps": "Syringe Pumps",
            "Suction Devices": "Suction Devices",
            "Resuscitation Bags": "Resuscitation Bags",
            "Portable Incubators": "Portable Incubators",
            "Delivery Beds": "Delivery Beds",
            "Resuscitation Stations": "Resuscitation Stations",
            "Warmers": "Warmers",
            "Ambu Bags": "Ambu Bags",
            "Manual Suction": "Manual Suction",
            "Wall Clock": "Wall Clock",
            "Steam Sterilizer": "Steam Sterilizer",
            "ETAT CPAP": "ETAT CPAP",
            "ETAT Suction": "ETAT Suction",
            "HDU Beds": "HDU Beds",
            "HDU CPAP": "HDU CPAP",
            "PICU Beds": "PICU Beds"
        }
      },
      landing: {
        welcome: "Welcome",
        subtitle: "Select a module to get started",
        no_permissions: "You do not have permissions to view any modules. Please contact an administrator.",
        modules: {
          dashboard: "Dashboard",
          courses: "Courses",
          human_resources: "Human Resources",
          facilities: "Child Health Services",
          mentorship: "Skills Mentorship",
          imci: "IMCI Assessment",
          projects: "Project Tracker",
          planning: "Master Plan",
          admin: "Admin",
          home: "Home"
        }
      },
      app: {
        title: "National Child Health Program",
        subtitle: "Program & Course Monitoring System",
        loading_system: "Loading application, please wait...",
        offline: "You are offline. Changes are saved locally and will sync when reconnected.",
        syncing: "Syncing offline data to the cloud...",
        welcome: "Welcome",
        logout: "Logout"
      }
    }
  },
  ar: {
    translation: {
      general: {
        app_title: "البرنامج القومي لصحة الطفل",
        dashboard: "لوحة متابعة الإشراف",
        btn_refresh: "تحديث",
        btn_back: "العودة للقائمة الرئيسية",
        loading: "جاري تحميل بيانات اللوحة...",
        please_wait: "يرجى الانتظار بينما نقوم بجلب أحدث السجلات."
      },
      filters: {
        date: "تصفية حسب التاريخ",
        state: "الولاية",
        locality: "المحلية",
        facility: "المؤسسة الصحية",
        project: "المشروع / الشريك",
        job_title: "الوصف الوظيفي",
        worker_name: "اسم العامل الصحي"
      },
      programs: {
        imnci: "المعالجة المتكاملة لأمراض الطفولة وحديثي الولادة (IMNCI)",
        eenc: "الرعاية الأساسية المبكرة لحديثي الولادة (EENC)",
        infection_control: "مكافحة العدوى",
        cord_management: "العناية بالحبل السري (للحالات المستقرة)"
      },
      skills: {
        overall_score: "درجة الالتزام الكلية",
        assess_classify: "التقييم والتصنيف",
        treatment_counsel: "العلاج والنصح",
        danger_signs: "تقييم علامات الخطورة",
        measurements: "مهارات القياس"
      },
      mothers: {
        total_interviews: "إجمالي مقابلات الأمهات",
        knowledge_treatment: "معرفة الأم: العلاج",
        satisfaction: "رضا الأم"
      },
      dashboard: {
        service_coverage_title: "لوحة تغطية الخدمات",
        refresh_data: "تحديث البيانات",
        syncing: "جاري مزامنة بيانات اللوحة...",
        tabs: {
          combined: "ملخص التغطية",
          neonatal: "تغطية الرعاية الخاصة لحديثي الولادة",
          eenc: "تغطية الرعاية الضرورية لحديثي الولادة (EENC)",
          imnci: "تغطية العلاج المتكامل لأمراض الطفولة (IMNCI)",
          critical: "الطوارئ والعناية الحرجة"
        },
        filters: {
          state: "الولاية",
          locality: "المحلية",
          ownership: "الملكية",
          project: "المشروع",
          has_equipment: "توفر الأجهزة",
          all_states: "كل الولايات",
          all_localities: "كل المحليات",
          all_ownerships: "كل الملكيات",
          all_projects: "كل المشاريع",
          any: "الكل"
        },
        cards: {
          total_pediatrics_emonc: "إجمالي مستشفيات الأطفال وطوارئ الولادة",
          functioning_scnu: "وحدات SCNU العاملة",
          facilities_with_cpap: "مؤسسات تتوفر بها أجهزة CPAP",
          total_emonc: "إجمالي مؤسسات طوارئ الولادة",
          functional_emonc: "مؤسسات طوارئ الولادة العاملة",
          eenc_coverage_functional: "تغطية EENC في المؤسسات العاملة",
          total_functioning_phc: "إجمالي مراكز الرعاية الأساسية العاملة",
          total_phc_imnci: "مراكز الرعاية الأساسية المطبقة لـ IMNCI",
          imnci_coverage_phc: "تغطية IMNCI في الرعاية الأساسية",
          target_hospitals_etat: "المستشفيات المستهدفة (ETAT)",
          hospitals_etat: "مستشفيات تتوفر بها ETAT",
          facilities_hdu: "مؤسسات تتوفر بها HDU",
          facilities_picu: "مؤسسات تتوفر بها العناية المكثفة PICU",
          out_of: "من أصل"
        },
        headers: {
          scnu_coverage: "تغطية SCNU حسب",
          neonatal_equipment: "توفر معدات وحدات حديثي الولادة",
          functioning_neonatal_units: "قائمة وحدات حديثي الولادة (SCNU) العاملة",
          eenc_coverage: "تغطية EENC حسب",
          eenc_equipment: "توفر معدات EENC بالوحدة",
          imnci_coverage: "تغطية IMNCI حسب",
          imnci_tools: "توفر أدوات IMNCI حسب",
          critical_care_coverage: "تغطية العناية الحرجة حسب",
          critical_care_capacity: "سعة ومعدات العناية الحرجة",
          geographic_map: "الخريطة الجغرافية",
          geographic_coverage: "التغطية الجغرافية وأداء الخدمات"
        },
        table: {
          state: "الولاية",
          locality: "المحلية",
          hospital_name: "اسم المستشفى",
          total_supposed: "المستهدف",
          with_scnu: "تطبق SCNU",
          coverage_chart: "مخطط التغطية",
          incubators: "الحضانات",
          cots: "الأسرة",
          total_beds: "إجمالي الأسرة",
          functional_emonc: "طوارئ ولادة عاملة",
          with_eenc: "تطبق EENC",
          functioning_phcs: "مراكز عاملة",
          phcs_with_imnci: "مراكز مع IMNCI",
          target_hospitals: "المستشفيات المستهدفة",
          with_hdu: "تطبق HDU",
          with_picu: "تطبق PICU",
          with_etat: "تطبق ETAT",
          overall_average: "المتوسط الكلي",
          imnci_registers: "سجلات IMNCI",
          imnci_chartbooklet: "كتيبات IMNCI",
          weight_scale: "ميزان وزن",
          ort_corner: "زاوية إرواء",
          no_data: "لا توجد بيانات تطابق الفلاتر الحالية."
        },
        map: {
          legend: "المفتاح (متوسط التغطية):",
          no_data: "0-39٪ (أو لا توجد بيانات)",
          range_mid: "40-74٪",
          range_high: "≥75٪",
          facility: "مؤسسة صحية",
          state: "الولاية",
          locality: "المحلية",
          hide_fac: "إخفاء المؤسسات",
          show_fac: "إظهار المؤسسات",
          full: "تكبير",
          close: "إغلاق"
        },
        kpi: {
          imnci: {
            title: "العلاج المتكامل لأمراض الطفولة (IMNCI)",
            num: "المراكز المطبقة",
            den: "المراكز الكلية المستهدفة"
          },
          etat: {
            title: "الفرز والتقييم والمعالجة في الطوارئ (ETAT)",
            num: "المستشفيات المطبقة",
            den: "المستشفيات المستهدفة (أطفال/عامة)"
          },
          eenc: {
            title: "الرعاية الضرورية المبكرة لحديثي الولادة (EENC)",
            num: "المستشفيات المطبقة",
            den: "مستشفيات طوارئ الحمل والولادة"
          },
          scnu: {
            title: "الرعاية الخاصة لحديثي الولادة (SCNU)",
            num: "المستشفيات المطبقة",
            den: "المستشفيات المستهدفة"
          },
          overall_coverage: "التغطية الكلية"
        },
        equip: {
            "Total Beds": "إجمالي الأسرة",
            "Incubators": "حضانات",
            "Cots": "أسرة أطفال",
            "Phototherapy Units": "وحدات علاج ضوئي",
            "Oxygen Machines": "أجهزة أكسجين",
            "Oxygen Cylinders": "أسطوانات أكسجين",
            "Respiration Monitors": "أجهزة مراقبة تنفس",
            "CPAP Machines": "أجهزة CPAP",
            "Mechanical Ventilators": "أجهزة تنفس صناعي",
            "Neonatal Warmers": "دفايات لحديثي الولادة",
            "Infusion Pumps": "مضخات حقن",
            "Syringe Pumps": "مضخات سرنجة",
            "Suction Devices": "أجهزة شفط",
            "Resuscitation Bags": "حقائب إنعاش (Ambu)",
            "Portable Incubators": "حضانات محمولة",
            "Delivery Beds": "أسرة ولادة",
            "Resuscitation Stations": "محطات إنعاش",
            "Warmers": "دفايات",
            "Ambu Bags": "حقائب إنعاش",
            "Manual Suction": "شفط يدوي",
            "Wall Clock": "ساعة حائط",
            "Steam Sterilizer": "معقم بخاري",
            "ETAT CPAP": "CPAP طوارئ",
            "ETAT Suction": "شفط طوارئ",
            "HDU Beds": "أسرة HDU",
            "HDU CPAP": "HDU CPAP",
            "PICU Beds": "أسرة PICU"
        }
      },
      landing: {
        welcome: "مرحباً",
        subtitle: "اختر الوحدة للبدء",
        no_permissions: "لا تملك الصلاحيات لعرض أي وحدات. يرجى التواصل مع مسؤول النظام.",
        modules: {
          dashboard: "منصة المعلومات",
          courses: "الدورات",
          human_resources: "الموارد البشرية",
          facilities: "خدمات صحة الطفل",
          mentorship: "الإرشاد السريري",
          imci: "تقييم IMCI",
          projects: "متابعة المشاريع",
          planning: "الخطة الرئيسية",
          admin: "المدير",
          home: "الرئيسية"
        }
      },
      app: {
        title: "البرنامج القومي لصحة الطفل",
        subtitle: "نظام متابعة البرامج والدورات",
        loading_system: "جاري تحميل النظام، يرجى الانتظار...",
        offline: "أنت غير متصل بالإنترنت. يتم حفظ التغييرات محلياً وستتم مزامنتها عند الاتصال.",
        syncing: "جاري مزامنة البيانات غير المتصلة مع السحابة...",
        welcome: "مرحباً",
        logout: "تسجيل الخروج"
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
      escapeValue: false, // React already safely escapes HTML
    },
  });

// --- FULL RTL SUPPORT LOGIC ---
// Automatically updates the HTML tag attributes for full RTL DOM flow 
// (Tailwind/CSS will respect this natively if you use LTR/RTL variants)
i18n.on('languageChanged', (lng) => {
  document.documentElement.setAttribute('dir', i18n.dir(lng));
  document.documentElement.setAttribute('lang', lng);
  localStorage.setItem('app_language', lng);
});

// Run once on initialization to set correct direction on page load
document.documentElement.setAttribute('dir', i18n.dir(i18n.language));
document.documentElement.setAttribute('lang', i18n.language);

export default i18n;