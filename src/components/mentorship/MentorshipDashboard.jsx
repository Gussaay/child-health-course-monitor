// MentorshipDashboard.jsx
import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler 
} from 'chart.js';

import { Button, Spinner } from '../CommonComponents';

import { 
    IMNCI_FORM_STRUCTURE, 
    calculateScores, 
    rehydrateDraftData, 
    DIARRHEA_CLASSIFICATIONS, 
    FEVER_CLASSIFICATIONS 
} from './IMNCSkillsAssessmentForm.jsx';

import { 
    PREPARATION_ITEMS, 
    DRYING_STIMULATION_ITEMS, 
    NORMAL_BREATHING_ITEMS, 
    RESUSCITATION_ITEMS 
} from './EENCSkillsAssessmentForm.jsx';

// Register Filler plugin
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler 
);

const SERVICE_TITLES = {
    'IMNCI': 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)',
    'EENC': 'Early Essential Newborn Care (EENC)',
    'ETAT': 'Emergency Triage, Assessment and Treatment (ETAT)',
    'IPC': 'Infection Prevention and Control in Neonatal Units (IPC)'
};

// --- Dictionaries for English Translations ---
const IMNCI_ENGLISH_LABELS = {
    // Groups
    'تقييم مهارات التقييم والتصنيف': 'Assessment & Classification Skills',
    'القرار النهائي': 'Final Decision',
    'تقييم مهارات العلاج والنصح': 'Treatment & Counseling Skills',
    'استخدام الاستمارة': 'Recording Skills',
    
    // Subgroups
    'القياسات الجسمانية والحيوية': 'Physical & Vital Measurements',
    'قيم علامات الخطورة العامة بصورة صحيحة': 'General Danger Signs Assessment',
    'قيم الطفل بصورة صحيحة لوجود كل الأعراض الأساسية': 'Main Symptoms Assessment',
    'تحرى عن سوء التغذية الحاد': 'Acute Malnutrition Assessment',
    'تحرى عن الانيميا': 'Anemia Assessment',
    'تحرى عن التطعيم وفيتامين أ بصورة صحيحة': 'Immunization & Vitamin A Assessment',
    'تحرى عن الأمراض الأخرى': 'Other Problems Assessment',
    'الحالات التي تحتاج لتحويل ، تم تحويلها': 'Referral Cases Management',
    'في حالة الإلتهاب الرئوي': 'Pneumonia Management',
    'في حالة الإسهال': 'Diarrhea Management',
    'في حالة الدسنتاريا': 'Dysentery Management',
    'في حالة الملاريا': 'Malaria Management',
    'في حالة التهاب الأذن': 'Ear Infection Management',
    'في حالة سوء التغذية': 'Malnutrition Management',
    'في حالة فقر الدم': 'Anemia Management',
    'نصح الأم متى تعود للمتابعة': 'Follow-up Counseling',
    'تسجيل البيانات': 'Data Recording',
    
    // Skills
    'skill_weight': 'Weighed the child correctly',
    'skill_temp': 'Measured temperature correctly',
    'skill_height': 'Measured height/length correctly',
    'skill_ds_drink': 'Asked/Checked: Cannot drink or breastfeed',
    'skill_ds_vomit': 'Asked/Checked: Vomits everything',
    'skill_ds_convulsion': 'Asked/Checked: Convulsions',
    'skill_ds_conscious': 'Checked: Lethargic or unconscious',
    'skill_ask_cough': 'Asked about cough or difficult breathing',
    'skill_check_rr': 'Counted respiratory rate correctly',
    'skill_classify_cough': 'Classified cough correctly',
    'skill_ask_diarrhea': 'Asked about diarrhea',
    'skill_check_dehydration': 'Assessed dehydration correctly',
    'skill_classify_diarrhea': 'Classified diarrhea correctly',
    'skill_ask_fever': 'Asked about fever',
    'skill_check_rdt': 'Performed RDT correctly',
    'skill_classify_fever': 'Classified fever correctly',
    'skill_ask_ear': 'Asked about ear problem',
    'skill_check_ear': 'Checked for tender swelling behind the ear',
    'skill_classify_ear': 'Classified ear problem correctly',
    'skill_mal_muac': 'Measured MUAC correctly',
    'skill_mal_wfh': 'Measured WFH z-score correctly',
    'skill_mal_classify': 'Classified nutritional status correctly',
    'skill_anemia_pallor': 'Checked for palmar pallor correctly',
    'skill_anemia_classify': 'Classified anemia correctly',
    'skill_imm_vacc': 'Checked immunizations correctly',
    'skill_imm_vita': 'Checked Vitamin A correctly',
    'skill_other': 'Checked for other problems',
    'skill_ref_abx': 'Gave 1st dose of appropriate antibiotic before referral',
    'skill_ref_quinine': 'Gave IM Quinine before referral (if applicable)',
    'skill_pneu_abx': 'Prescribed Amoxicillin correctly',
    'skill_pneu_dose': 'Gave 1st dose of Amoxicillin in clinic',
    'skill_diar_ors': 'Determined ORS amount correctly',
    'skill_diar_counsel': 'Counseled mother on home care (fluids/feeding)',
    'skill_diar_zinc': 'Prescribed Zinc correctly',
    'skill_diar_zinc_dose': 'Gave 1st dose of Zinc in clinic',
    'skill_dyst_abx': 'Prescribed Ciprofloxacin correctly',
    'skill_dyst_dose': 'Gave 1st dose of Ciprofloxacin in clinic',
    'skill_mal_meds': 'Prescribed Coartem (ACT) correctly',
    'skill_mal_dose': 'Gave 1st dose of Coartem in clinic',
    'skill_ear_abx': 'Prescribed Amoxicillin for ear infection',
    'skill_ear_dose': 'Gave 1st dose of Amoxicillin for ear infection in clinic',
    'skill_ear_para': 'Prescribed Paracetamol correctly',
    'skill_ear_para_dose': 'Gave 1st dose of Paracetamol in clinic',
    'skill_nut_refer_otp': 'Referred child to OTP',
    'skill_nut_assess': 'Assessed feeding including breastfeeding problems',
    'skill_nut_counsel': 'Counseled mother on feeding including breastfeeding',
    'skill_anemia_iron': 'Prescribed Iron syrup correctly',
    'skill_anemia_iron_dose': 'Gave 1st dose of Iron syrup in clinic',
    'skill_fu_when': 'Advised on at least 2 signs to return immediately',
    'skill_fu_return': 'Specified when to return for follow-up',
    'skill_record_signs': 'Recorded signs correctly',
    'skill_record_classifications': 'Recorded classifications correctly',
    'skill_record_treatments': 'Recorded treatments correctly',
};

const EENC_SKILL_KEYS_TO_ENGLISH = {
    'prep_wash_1': 'Hand washing',
    'prep_wash_2': 'Second hand washing',
    'prep_gloves': 'Sterile gloves',
    'prep_cloths': 'Towels prepared',
    'prep_resuscitation_area': 'Resuscitation area prepared',
    'prep_ambu_check': 'Ambu bag checked',
    'dry_start_5sec': 'Drying started within 5s',
    'dry_skin_to_skin': 'Skin-to-skin contact',
    'dry_cover_baby': 'Baby covered with dry towel/hat',
    'normal_remove_outer_glove': 'Hygienic cord check',
    'normal_cord_pulse_check': 'Delayed cord clamping',
    'normal_cord_clamping': 'Correct cord clamping',
    'normal_breastfeeding_guidance': 'Early breastfeeding advice',
    'resus_position_head': 'Head positioned correctly',
    'resus_mask_position': 'Correct mask placement',
    'resus_check_chest_rise': 'Chest rise checked',
    'resus_ventilation_rate': 'Ventilation rate 30-50/min'
};

const IMNCI_SKILLS_LABELS = {
    skill_weight: "Weight Measurement",
    skill_height: "Height Measurement",
    skill_temp: "Temperature Measurement",
    skill_rr: "Respiratory Rate Measurement",
    skill_muac: "MUAC Measurement",
    skill_wfh: "Z-Score (WFH) Measurement",
    skill_edema: "Edema Assessment",
    skill_danger_signs: "Danger Signs Assessment",
    skill_chartbook: "Chartbook Use",
    skill_counseling_card: "Counseling Card Use",
    skill_immunization_referral: "Immunization Check/Referral",
    skill_record_signs: "Recording Signs",
    skill_record_classifications: "Recording Classifications",
    skill_record_treatments: "Recording Treatments",
};

const EENC_SKILLS_LABELS = {
    skill_pre_handwash: "Hand Washing",
    skill_pre_equip: "Equipment Preparation",
    skill_drying: "Drying",
    skill_skin_to_skin: "Skin-to-Skin Contact",
    skill_suction: "Suctioning",
    skill_cord_pulse_check: "Cord Pulse Check",
    skill_clamp_placement: "Clamp Placement",
    skill_transfer: "Baby Transfer",
    skill_airway: "Opening Airway",
    skill_ambubag_placement: "Ambu Bag Placement",
    skill_ambubag_use: "Ambu Bag Use",
    skill_ventilation_rate: "Ventilation Rate",
    skill_correction_steps: "Corrective Steps",
};

const IMNCI_MOTHER_SURVEY_ITEMS_EN = [
    { title: 'Mother Knowledge (Treatment & Medications)', items: [
        { key: 'knows_med_details', label: 'Mother knows medication details (dose, frequency, days)' },
        { key: 'knows_treatment_details', label: 'Mother knows combination treatment details' },
        { key: 'knows_diarrhea_4rules', label: 'Mother knows the 4 rules for home diarrhea management' },
        { key: 'knows_return_date', label: 'Mother knows follow-up return date' }
    ]},
    { title: 'Mother Knowledge (Fluids & ORS)', items: [
        { key: 'knows_ors_prep', label: 'Mother knows how to prepare ORS' },
        { key: 'knows_home_fluids', label: 'Mother knows allowed home fluids' },
        { key: 'knows_ors_water_qty', label: 'Mother knows correct water quantity for ORS' },
        { key: 'knows_ors_after_stool', label: 'Mother knows ORS amount to give after each stool' }
    ]},
    { title: 'Mother Satisfaction', items: [
        { key: 'time_spent', label: 'Satisfaction with time spent by health worker' },
        { key: 'assessment_method', label: 'Satisfaction with assessment method' },
        { key: 'treatment_given', label: 'Satisfaction with given treatment' },
        { key: 'communication_style', label: 'Satisfaction with communication style' },
        { key: 'what_learned', label: 'Satisfaction with what was learned' },
        { key: 'drug_availability', label: 'Satisfaction with drug availability at facility' }
    ]}
];

const EENC_MOTHER_SURVEY_ITEMS_EN = [
    { title: 'Skin-to-Skin Contact', items: [
        { key: 'skin_to_skin_immediate', label: 'Baby placed skin-to-skin immediately after birth?' },
        { key: 'skin_to_skin_90min', label: 'Baby kept skin-to-skin continuously for 90 minutes?' }
    ]},
    { title: 'Breastfeeding Initiation', items: [
        { key: 'breastfed_first_hour', label: 'Baby completed a full feed within first hour?' },
        { key: 'given_other_fluids', label: 'Baby given any fluids other than breastmilk?' },
        { key: 'given_other_fluids_bottle', label: 'Baby given any fluids via bottle?' }
    ]},
    { title: 'Skin, Eye & Cord Care', items: [
        { key: 'given_vitamin_k', label: 'Baby given Vitamin K?' },
        { key: 'given_tetracycline', label: 'Baby given Tetracycline eye ointment?' },
        { key: 'anything_on_cord', label: 'Anything applied to the cord?' },
        { key: 'rubbed_with_oil', label: 'Baby rubbed with oil?' },
        { key: 'baby_bathed', label: 'Baby bathed?' }
    ]},
    { title: 'Vaccinations', items: [
        { key: 'polio_zero_dose', label: 'Baby given zero-dose Polio vaccine?' },
        { key: 'bcg_dose', label: 'Baby given BCG vaccine?' }
    ]},
    { title: 'Measurements', items: [
        { key: 'baby_weighed', label: 'Baby weighed?' },
        { key: 'baby_temp_measured', label: 'Baby temperature measured?' }
    ]},
    { title: 'Registration', items: [
        { key: 'baby_registered', label: 'Baby registered in civil registry?' },
        { key: 'given_discharge_card', label: 'Baby given discharge card?' }
    ]}
];

// --- Helper Functions ---
const calculateAverage = (scores) => {
    if (!scores || !Array.isArray(scores)) return null;
    const validScores = scores.filter(s => isFinite(s) && !isNaN(s) && s !== null);
    if (validScores.length === 0) return null;
    const sum = validScores.reduce((a, b) => a + b, 0);
    return sum / validScores.length;
};

// --- Helper for Copying to Clipboard ---
const CopyImageButton = ({ targetRef, title }) => {
    const [isCopying, setIsCopying] = useState(false);

    const handleCopy = async () => {
        if (!targetRef.current) return;
        setIsCopying(true);
        try {
            const canvas = await html2canvas(targetRef.current, { 
                backgroundColor: '#ffffff', 
                scale: 2, 
                logging: false,
                useCORS: true 
            });
            
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                    alert(`"${title}" copied to clipboard!`);
                }
            }, 'image/png');
        } catch (error) {
            console.error('Error copying image:', error);
            alert('Failed to copy image to clipboard. Make sure your browser allows clipboard write access.');
        } finally {
            setIsCopying(false);
        }
    };

    return (
        <button 
            onClick={handleCopy} 
            disabled={isCopying}
            title="Copy as Image"
            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors border border-transparent hover:border-sky-200 focus:outline-none"
        >
            {isCopying ? (
                <Spinner size="xs" /> 
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
            )}
        </button>
    );
};

// --- Components (ScoreText, KpiCard, etc.) ---
const ScoreText = ({ value, showPercentage = true }) => {
    let colorClass = 'text-slate-800';
    let text = 'N/A';
    if (value !== null && !isNaN(value) && isFinite(value)) {
        const percentage = Math.round(value * 100);
        if (percentage >= 80) colorClass = 'text-emerald-700';
        else if (percentage >= 50) colorClass = 'text-amber-600';
        else colorClass = 'text-rose-700';
        text = showPercentage ? `${percentage}%` : percentage.toString();
    }
    return (<span className={`font-extrabold text-sm ${colorClass}`}>{text}</span>);
};

const KpiCard = ({ title, value, unit = '', scoreValue = null }) => (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-black border-t-4 border-t-sky-600 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-center items-center h-full">
        <h4 className="text-xs sm:text-sm font-bold text-slate-600 mb-3 text-center uppercase tracking-wider" title={title}>{title}</h4>
        <div className="flex items-baseline justify-center gap-1.5 mt-auto">
            {scoreValue !== null ? <ScoreText value={scoreValue} /> : <span className="text-4xl font-black text-slate-800 tracking-tight">{value}</span>}
            {unit && <span className="text-lg font-bold text-slate-500">{unit}</span>}
        </div>
    </div>
);

const KpiGridItem = ({ title, scoreValue }) => (
    <div className="bg-slate-50 p-4 rounded-xl border border-black text-center shadow-sm hover:border-sky-500 hover:bg-sky-50 transition-all flex flex-col justify-between h-full group">
        <h5 className="text-xs font-bold text-slate-700 mb-3 leading-snug group-hover:text-sky-800" title={title}>{title}</h5>
        <div className="mt-auto bg-white inline-block mx-auto px-4 py-1.5 rounded-lg border border-black shadow-sm">
            <ScoreText value={scoreValue} />
        </div>
    </div>
);

const KpiGridCard = ({ title, kpis, cols = 2 }) => {
    const cardRef = useRef(null);
    return (
        <div ref={cardRef} className="bg-white p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 relative">
            <div className="flex justify-between items-start mb-5">
                <h4 className="text-base font-extrabold text-slate-800 text-left tracking-wide w-full pr-8" title={title}>{title}</h4>
                <div className="absolute top-4 right-4"><CopyImageButton targetRef={cardRef} title={title} /></div>
            </div>
            <div className={`grid grid-cols-${cols} gap-4`}>{kpis.map(kpi => (<KpiGridItem key={kpi.title} title={kpi.title} scoreValue={kpi.scoreValue} />))}</div>
        </div>
    );
};

const DetailedKpiCard = ({ title, overallScore, kpis }) => {
    const cardRef = useRef(null);
    return (
        <div ref={cardRef} className="bg-white p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-black pr-10">
                <h4 className="text-base font-extrabold text-slate-800 text-left tracking-wide" title={title}>{title}</h4>
                {overallScore !== null && (<div className="bg-sky-50 border border-black rounded-lg px-3 py-1 shadow-sm"><ScoreText value={overallScore} /></div>)}
            </div>
            <div className="space-y-3 flex-grow">
                {kpis.map(kpi => (
                    <div key={kpi.title} className="flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-black shadow-sm hover:border-sky-500 hover:bg-sky-50 transition-all duration-200 group">
                        <h5 className="text-xs font-bold text-slate-700 text-left pr-4 group-hover:text-sky-800">{kpi.title}</h5>
                        <div className="bg-white px-3 py-1 rounded-lg shadow-sm border border-black"><ScoreText value={kpi.scoreValue} /></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Shared Chart Options ---
const getSharedChartOptions = () => ({
    responsive: true, 
    maintainAspectRatio: false,
    animation: {
        duration: 1000,
        easing: 'easeOutQuart'
    },
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: { 
        legend: { 
            position: 'bottom', 
            labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 12, family: "'Inter', sans-serif", weight: '600' }, color: '#334155' } 
        }, 
        tooltip: { 
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { size: 13, family: "'Inter', sans-serif", weight: 'bold' },
            bodyFont: { size: 12, family: "'Inter', sans-serif" },
            padding: 12,
            cornerRadius: 8,
            boxPadding: 6,
            callbacks: {
                label: (context) => ` ${context.dataset.label}: ${context.parsed.y}%`
            }
        } 
    },
    scales: { 
        y: { 
            beginAtZero: true, 
            max: 100, 
            grid: { color: '#e2e8f0', drawBorder: false }, 
            ticks: { callback: (value) => `${value}%`, color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' }, padding: 8 } 
        }, 
        x: { 
            grid: { display: false, drawBorder: false }, 
            ticks: { maxTicksLimit: 10, autoSkip: true, color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' }, padding: 8 } 
        } 
    }
});

const getLineDatasetStyle = (title, key, colors, data) => ({
    label: title,
    data: data,
    borderColor: colors[key] || '#64748b', 
    backgroundColor: (colors[key] || '#64748b') + '26',
    fill: true,
    tension: 0.4,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBackgroundColor: '#ffffff',
    pointBorderColor: colors[key] || '#64748b',
    pointBorderWidth: 2,
    borderWidth: 2.5, 
});

// Component for non-percentage data like volume (Cases/Visits)
const VolumeLineChart = ({ title, chartData, kpiKeys }) => {
    const cardRef = useRef(null);
    const colors = {
        'Cases Observed': '#3b82f6', 
        'Completed Visits': '#10b981'
    };
    
    const options = {
        responsive: true, 
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: { 
            legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 12, family: "'Inter', sans-serif", weight: '600' }, color: '#334155' } }, 
            tooltip: { 
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleFont: { size: 13, family: "'Inter', sans-serif", weight: 'bold' },
                bodyFont: { size: 12, family: "'Inter', sans-serif" },
                padding: 12, cornerRadius: 8, boxPadding: 6,
                callbacks: { label: (context) => ` ${context.dataset.label}: ${context.parsed.y}` } 
            } 
        },
        scales: { 
            y: { 
                beginAtZero: true, 
                grid: { color: '#e2e8f0', drawBorder: false }, 
                ticks: { precision: 0, color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' }, padding: 8 } 
            }, 
            x: { 
                grid: { display: false, drawBorder: false }, 
                ticks: { maxTicksLimit: 10, autoSkip: true, color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' }, padding: 8 } 
            } 
        }
    };

    const data = {
        labels: chartData.map(d => d.name),
        datasets: kpiKeys.map(kpi => getLineDatasetStyle(kpi.title, kpi.key, colors, chartData.map(d => d[kpi.key]))),
    };
    
    return (
        <div ref={cardRef} className="bg-white p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-base font-extrabold text-slate-800 mb-5 text-center tracking-wide pr-8">{title}</h4>
            <div className="relative flex-grow min-h-[250px]">{chartData.length > 0 ? <Line options={options} data={data} /> : <div className="flex items-center justify-center h-full text-slate-500 font-semibold">No data available.</div>}</div>
        </div>
    );
};

const KpiLineChart = ({ title, chartData, kpiKeys }) => {
    const cardRef = useRef(null);
    const colors = {
        'Overall': '#0ea5e9', 'Assessment': '#10b981', 'Decision': '#f59e0b', 'Treatment': '#ef4444',
        'Weight': '#06b6d4', 'Temp': '#3b82f6', 'Height': '#8b5cf6', 'Resp. Rate': '#14b8a6',
        'Dehydration': '#ec4899', 'Malaria RDT': '#d946ef', 'Ear Check': '#f97316',
        'Pneumonia Amox': '#a855f7', 'Diarrhea ORS': '#3b82f6', 'Diarrhea Zinc': '#eab308', 'Anemia Iron': '#dc2626',
        'MUAC': '#0891b2', 'WFH': '#0284c7', 'Pallor': '#78716c', 'DangerSigns': '#f97316',
        'Malnutrition Assessment': '#0284c7',
        'Measurement Skills': '#8b5cf6',
        'Immunization': '#10b981', 'Vitamin Assessment': '#f59e0b', 'Malaria Coartem': '#d946ef', 'Return Immediately': '#ef4444', 'Return Followup': '#3b82f6',
        'Record Signs': '#06b6d4', 'Record Classifications': '#3b82f6', 'Record Treatments': '#8b5cf6',
        'Preparation': '#10b981', 'Drying': '#3b82f6', 'Breathing Mgmt': '#f59e0b', 'Resuscitation': '#ef4444',
        'Hand Washing (1st)': '#0d9488', 'Hand Washing (2nd)': '#14b8a6', 'Sterile Gloves': '#2dd4bf',
        'Towels Ready': '#7c3aed', 'Resus Equip Ready': '#8b5cf6', 'Ambu Check': '#a78bfa',
        'Drying < 5s': '#ea580c', 'Skin-to-Skin': '#f97316', 'Dry Towel/Hat': '#fb923c',
        'Hygienic Check': '#be123c', 'Delayed Clamp': '#e11d48', 'Correct Clamp': '#f43f5e',
        'Early BF Advice': '#d946ef', 'Head Pos': '#b91c1c', 'Mask Seal': '#dc2626', 'Chest Rise': '#ef4444', 'Rate 30-50': '#f87171',
        'Imm. Skin-to-Skin': '#f97316', '90min Skin-to-Skin': '#fdba74', 'BF 1st Hour': '#ec4899', 'Other Fluids': '#f43f5e', 
        'Bottle Feeding': '#be123c', 'Vitamin K': '#8b5cf6', 'Eye Ointment': '#a78bfa', 'Cord Substance': '#d946ef',
        'Skin Oiling': '#eab308', 'Bathing < 6hrs': '#f59e0b', 'Polio Vaccine': '#10b981', 'BCG Vaccine': '#34d399',
        'Weight Measured': '#06b6d4', 'Temp Measured': '#22d3ee', 'Civil Reg': '#3b82f6', 'Discharge Card': '#6366f1',
        'M: Knows Meds': '#4f46e5', 'M: Knows ORS': '#3b82f6', 'M: Knows Tx': '#0ea5e9', 'M: Knows 4 Rules': '#06b6d4',
        'M: Knows Return': '#14b8a6', 'M: Knows Fluids': '#10b981', 'M: Time Spent': '#f59e0b', 'M: Assess Method': '#f97316',
        'M: Tx Given': '#ef4444', 'M: Comm Style': '#ec4899', 'M: What Learned': '#d946ef', 'M: Drug Avail': '#8b5cf6'
    };
    
    const data = {
        labels: chartData.map(d => d.name),
        datasets: kpiKeys.map(kpi => getLineDatasetStyle(kpi.title, kpi.key, colors, chartData.map(d => d[kpi.key]))),
    };
    
    return (
        <div ref={cardRef} className="bg-white p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-base font-extrabold text-slate-800 mb-5 text-center tracking-wide pr-8">{title}</h4>
            <div className="relative flex-grow min-h-[250px]">{chartData.length > 0 ? <Line options={getSharedChartOptions()} data={data} /> : <div className="flex items-center justify-center h-full text-slate-500 font-semibold">No data available.</div>}</div>
        </div>
    );
};

const KpiCardWithChart = ({ title, kpis, chartData, kpiKeys, cols = 2 }) => {
    const cardRef = useRef(null);
    const colors = { 
        'Overall': '#0ea5e9', 'Assessment': '#10b981', 'Decision': '#f59e0b', 'Treatment': '#ef4444', 
        'Pallor': '#78716c', 'Anemia Mgmt': '#dc2626',
        'Resp. Rate': '#14b8a6', 'Dehydration': '#ec4899', 
        'Malaria RDT': '#d946ef', 'Ear Check': '#f97316',
        'Pneumonia Amox': '#a855f7', 'Diarrhea ORS': '#3b82f6', 'Diarrhea Zinc': '#eab308', 'Anemia Iron': '#dc2626',
        'Immunization': '#10b981', 'Vitamin Assessment': '#f59e0b', 'Malaria Coartem': '#d946ef', 'Return Immediately': '#ef4444', 'Return Followup': '#3b82f6',
        'Record Signs': '#06b6d4', 'Record Classifications': '#3b82f6', 'Record Treatments': '#8b5cf6'
    };
    
    const data = { 
        labels: chartData.map(d => d.name), 
        datasets: kpiKeys.map(kpi => getLineDatasetStyle(kpi.title, kpi.key, colors, chartData.map(d => d[kpi.key])))
    };

    return (
        <div ref={cardRef} className="bg-white p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 flex flex-col h-full relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-base font-extrabold text-slate-800 mb-5 text-center tracking-wide pr-8" title={title}>{title}</h4>
            <div className={`grid grid-cols-${cols} gap-4 mb-6`}>{kpis.map(kpi => (<KpiGridItem key={kpi.title} title={kpi.title} scoreValue={kpi.scoreValue} />))}</div>
            <div className="relative flex-grow min-h-[200px]">{chartData.length > 0 ? <Line options={getSharedChartOptions()} data={data} /> : <div className="flex items-center justify-center h-full text-slate-500 font-semibold">No data available.</div>}</div>
        </div>
    );
};

const KpiBarChart = ({ title, chartData, dataKey = 'avgOverall' }) => {
    const cardRef = useRef(null);
    const getBarColor = (value) => { if (value >= 80) return '#10b981'; if (value >= 50) return '#f59e0b'; return '#ef4444'; };
    const getHoverColor = (value) => { if (value >= 80) return '#059669'; if (value >= 50) return '#d97706'; return '#dc2626'; };

    const data = { 
        labels: chartData.map(d => d.stateName), 
        datasets: [{ 
            label: 'Value', 
            data: chartData.map(d => d[dataKey] ? Math.round(d[dataKey] * (dataKey === 'count' ? 1 : 100)) : null), 
            backgroundColor: chartData.map(d => dataKey === 'count' ? '#3b82f6' : getBarColor(d[dataKey] ? d[dataKey] * 100 : 0)), 
            hoverBackgroundColor: chartData.map(d => dataKey === 'count' ? '#2563eb' : getHoverColor(d[dataKey] ? d[dataKey] * 100 : 0)), 
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.6,
        }] 
    };
    
    const options = { 
        indexAxis: 'y', 
        responsive: true, 
        maintainAspectRatio: false, 
        animation: { duration: 1000, easing: 'easeOutQuart' },
        plugins: { 
            legend: { display: false }, 
            tooltip: { 
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleFont: { size: 13, family: "'Inter', sans-serif" },
                bodyFont: { size: 12, family: "'Inter', sans-serif", weight: 'bold' },
                padding: 10,
                cornerRadius: 8,
                callbacks: { label: (c) => `${c.dataset.label}: ${c.raw}${dataKey === 'count' ? '' : '%'}` } 
            } 
        }, 
        scales: { 
            x: { 
                beginAtZero: true, 
                max: dataKey === 'count' ? undefined : 100, 
                grid: { color: '#e2e8f0', drawBorder: false },
                ticks: { callback: (v) => `${v}${dataKey === 'count' ? '' : '%'}`, color: '#475569', font: { family: "'Inter', sans-serif", weight: '500' } } 
            }, 
            y: { 
                grid: { display: false, drawBorder: false },
                ticks: { autoSkip: false, color: '#334155', font: { size: 12, family: "'Inter', sans-serif", weight: 'bold' } } 
            } 
        } 
    };
    const chartHeight = Math.max(300, chartData.length * 40); 
    
    return (
        <div ref={cardRef} className="bg-white p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-base font-extrabold text-slate-800 mb-5 text-center tracking-wide pr-8">{title}</h4>
            <div className="relative" style={{ height: `${chartHeight}px` }}>{chartData.length > 0 ? <Bar options={options} data={data} /> : <div className="flex items-center justify-center h-full text-slate-500 font-semibold">No data available.</div>}</div>
        </div>
    );
};

const CompactSkillRow = ({ label, stats }) => {
    const yes = stats?.yes || 0; const no = stats?.no || 0; const total = yes + no; const percentage = total > 0 ? (yes / total) : null;
    return (
        <tr className="bg-white hover:bg-sky-50 transition-colors duration-150 group border-b border-black">
            <td className="p-3 text-xs font-bold text-slate-700 w-3/5 text-left group-hover:text-sky-800">{label}</td>
            <td className="p-3 text-xs font-bold text-slate-600 border-l border-black w-1/5 text-center">{yes} / {total}</td>
            <td className="p-3 border-l border-black w-1/5 text-center bg-slate-50/50 group-hover:bg-sky-100/50"><ScoreText value={percentage} /></td>
        </tr>
    );
};

const CompactSkillsTable = ({ overallKpis }) => {
    const skillStats = overallKpis?.skillStats;
    if (!overallKpis || !skillStats || Object.keys(skillStats).length === 0) return (<div className="bg-white p-8 rounded-2xl shadow-md border border-black text-center text-slate-500 font-bold">No detailed skill data available.</div>);
    
    // Use the EN map to properly show skills in English inside the table
    const getAggregatedScore = (skillKeys) => {
        if (!skillKeys || skillKeys.length === 0) return null;
        let totalYes = 0;
        let total = 0;
        skillKeys.forEach(key => {
            const stats = skillStats[key];
            if (stats) {
                totalYes += (stats.yes || 0);
                total += (stats.yes || 0) + (stats.no || 0);
            }
        });
        return total > 0 ? (totalYes / total) : null;
    };

    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden" dir="ltr">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 shadow-sm border-b border-black">
                    <tr className="bg-slate-200">
                        <th className="p-4 text-xs font-extrabold text-slate-800 w-3/5 text-left tracking-wide uppercase">Skill</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center tracking-wide uppercase">Count (Yes / Total)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center tracking-wide uppercase">Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    {IMNCI_FORM_STRUCTURE.map(group => {
                        let groupAggregateScore = null; 
                        
                        if (group.group.includes('التقييم والتصنيف')) groupAggregateScore = overallKpis.avgAssessment; 
                        else if (group.isDecisionSection) groupAggregateScore = overallKpis.avgDecision; 
                        else if (group.group.includes('العلاج والنصح')) groupAggregateScore = overallKpis.avgTreatment;
                        else if (group.group.includes('القياسات')) groupAggregateScore = overallKpis.avgMeasurementSkills;
                        else if (group.group.includes('الخطورة')) groupAggregateScore = overallKpis.avgDangerSigns;
                        else if (group.sectionKey === 'recording_skills') groupAggregateScore = calculateAverage([overallKpis.avgRecordSigns, overallKpis.avgRecordClass, overallKpis.avgRecordTreat]);

                        const groupNameEN = IMNCI_ENGLISH_LABELS[group.group] || group.group;

                        return (
                            <React.Fragment key={group.group}>
                                <tr className="bg-slate-800 text-white border-b border-black">
                                    <td className="p-3 text-sm font-bold text-left tracking-wide" colSpan="2">{groupNameEN}</td>
                                    <td className="p-3 text-center border-l border-black">
                                        {groupAggregateScore !== null && (<div className="bg-white/10 backdrop-blur-md rounded-lg px-3 py-1 inline-block border border-black shadow-inner"><ScoreText value={groupAggregateScore} showPercentage={true}/></div>)}
                                    </td>
                                </tr>
                                {group.subgroups?.map(subgroup => {
                                    if (subgroup.isSymptomGroupContainer) { 
                                        return subgroup.symptomGroups.map(symptomGroup => { 
                                            const symptomKey = symptomGroup.mainSkill.scoreKey; 
                                            let skillsToRender = []; 
                                            if (symptomKey === 'symptom_cough') skillsToRender = ['skill_ask_cough', 'skill_check_rr', 'skill_classify_cough']; 
                                            else if (symptomKey === 'symptom_diarrhea') skillsToRender = ['skill_ask_diarrhea', 'skill_check_dehydration', 'skill_classify_diarrhea']; 
                                            else if (symptomKey === 'symptom_fever') skillsToRender = ['skill_ask_fever', 'skill_check_rdt', 'skill_classify_fever']; 
                                            else if (symptomKey === 'symptom_ear') skillsToRender = ['skill_ask_ear', 'skill_check_ear', 'skill_classify_ear']; 
                                            
                                            const symptomScore = getAggregatedScore(skillsToRender);
                                            const symptomGroupNameEN = IMNCI_ENGLISH_LABELS[symptomGroup.mainSkill.key] || symptomGroup.mainSkill.label;
                                            
                                            return (
                                                <React.Fragment key={symptomKey}>
                                                    <tr className="bg-sky-600 text-white border-b border-black">
                                                        <td className="p-2.5 text-xs font-bold text-left" colSpan="2">{symptomGroupNameEN}</td>
                                                        <td className="p-2.5 text-center border-l border-black">
                                                            {symptomScore !== null && (<div className="bg-white/10 backdrop-blur-md rounded-md px-2 py-0.5 inline-block border border-black"><ScoreText value={symptomScore} showPercentage={true} /></div>)}
                                                        </td>
                                                    </tr>
                                                    {skillsToRender.map(skillKey => (<CompactSkillRow key={skillKey} label={IMNCI_ENGLISH_LABELS[skillKey] || skillKey} stats={skillStats[skillKey]} />))}
                                                </React.Fragment>
                                            ); 
                                        }); 
                                    }
                                    
                                    const skillsToRender = subgroup.skills?.map(s => s.key) || [];
                                    const subgroupScore = getAggregatedScore(skillsToRender);
                                    const subgroupTitleEN = IMNCI_ENGLISH_LABELS[subgroup.subgroupTitle] || subgroup.subgroupTitle;
                                    
                                    return (
                                        <React.Fragment key={subgroup.subgroupTitle}>
                                            <tr className="bg-sky-600 text-white border-b border-black">
                                                <td className="p-2.5 text-xs font-bold text-left" colSpan="2">{subgroupTitleEN}</td>
                                                <td className="p-2.5 text-center border-l border-black">
                                                    {subgroupScore !== null && (<div className="bg-white/10 backdrop-blur-md rounded-md px-2 py-0.5 inline-block border border-black"><ScoreText value={subgroupScore} showPercentage={true}/></div>)}
                                                </td>
                                            </tr>
                                            {subgroup.skills?.map(skill => (<CompactSkillRow key={skill.key} label={IMNCI_ENGLISH_LABELS[skill.key] || skill.label} stats={skillStats[skill.key]} />))}
                                        </React.Fragment>
                                    );
                                })}
                                {group.isDecisionSection && (<CompactSkillRow label="Did health worker's decision match the supervisor's?" stats={skillStats['decisionMatches']} />)}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const EENCCompactSkillRow = ({ label, stats }) => {
    const yes = stats?.yes || 0; const partial = stats?.partial || 0; const no = stats?.no || 0; const totalResponses = yes + partial + no; const score = (yes * 2) + (partial * 1); const maxScore = totalResponses * 2; const percentage = maxScore > 0 ? (score / maxScore) : null;
    return (
        <tr className="bg-white hover:bg-sky-50 transition-colors duration-150 group border-b border-black">
            <td className="p-3 text-xs font-bold text-slate-700 w-3/5 text-left group-hover:text-sky-800">{label}</td>
            <td className="p-3 text-xs font-bold text-slate-600 border-l border-black w-1/5 text-center">
                <span title="Yes" className="text-emerald-600">{yes}</span> / <span title="Partial" className="text-amber-500">{partial}</span> / <span title="No" className="text-rose-600">{no}</span>
            </td>
            <td className="p-3 border-l border-black w-1/5 text-center bg-slate-50/50 group-hover:bg-sky-100/50"><ScoreText value={percentage} /></td>
        </tr>
    );
};

const EENCCompactSkillsTable = ({ overallKpis }) => {
    const skillStats = overallKpis?.skillStats;
    if (!overallKpis || !skillStats || Object.keys(skillStats).length === 0) return (<div className="bg-white p-8 rounded-2xl shadow-md border border-black text-center text-slate-500 font-bold">No detailed EENC skill data available.</div>);
    
    const sections = [
        { title: 'Pre-delivery Preparation', items: PREPARATION_ITEMS, score: overallKpis.avgPreparation }, 
        { title: 'Drying, Stimulation, Warming & Suction', items: DRYING_STIMULATION_ITEMS, score: overallKpis.avgDrying }, 
        { title: 'Normal Breathing Baby Management', items: NORMAL_BREATHING_ITEMS, score: overallKpis.avgNormalBreathing }, 
        { title: 'Newborn Resuscitation (Golden Minute)', items: RESUSCITATION_ITEMS, score: overallKpis.avgResuscitation }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden" dir="ltr">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 shadow-sm border-b border-black">
                    <tr className="bg-slate-200">
                        <th className="p-4 text-xs font-extrabold text-slate-800 w-3/5 text-left uppercase tracking-wide">Skill (EENC)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center uppercase tracking-wide">Count (Yes / Partial / No)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center uppercase tracking-wide">Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    {sections.map(section => { 
                        const hasData = section.items.some(item => skillStats[item.key] && (skillStats[item.key].yes > 0 || skillStats[item.key].partial > 0 || skillStats[item.key].no > 0)); 
                        if (!hasData) return null; 
                        return (
                            <React.Fragment key={section.title}>
                                <tr className="bg-slate-800 text-white border-b border-black">
                                    <td className="p-3 text-sm font-bold text-left tracking-wide" colSpan="2">{section.title}</td>
                                    <td className="p-3 text-center border-l border-black">
                                        {section.score !== null && (<div className="bg-white/10 backdrop-blur-md rounded-lg px-3 py-1 inline-block border border-black shadow-inner"><ScoreText value={section.score} showPercentage={true}/></div>)}
                                    </td>
                                </tr>
                                {section.items.map(item => (
                                    <EENCCompactSkillRow key={item.key} label={EENC_SKILL_KEYS_TO_ENGLISH[item.key] || item.label} stats={skillStats[item.key]} />
                                ))}
                            </React.Fragment>
                        ); 
                    })}
                </tbody>
            </table>
        </div>
    );
};

const MothersCompactSkillsTable = ({ motherKpis, serviceType }) => {
    const skillStats = motherKpis?.skillStats;
    if (!motherKpis || !skillStats) return (<div className="bg-white p-8 rounded-2xl shadow-md border border-black text-center text-slate-500 font-bold">No mother survey data available.</div>);
    const items = serviceType === 'IMNCI' ? IMNCI_MOTHER_SURVEY_ITEMS_EN : EENC_MOTHER_SURVEY_ITEMS_EN;

    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden" dir="ltr">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 shadow-sm border-b border-black">
                    <tr className="bg-slate-200">
                        <th className="p-4 text-xs font-extrabold text-slate-800 w-3/5 text-left tracking-wide uppercase">Question (Mother Survey)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center tracking-wide uppercase">Count (Yes / Total)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center tracking-wide uppercase">Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(group => (
                        <React.Fragment key={group.title}>
                            <tr className="bg-slate-800 text-white border-b border-black"><td className="p-3 text-sm font-bold text-left tracking-wide" colSpan="3">{group.title}</td></tr>
                            {group.items.map(item => (<CompactSkillRow key={item.key} label={item.label} stats={skillStats[item.key]} />))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const FilterSelect = ({ label, value, onChange, options, disabled = false, defaultOption }) => (
    <div>
        <label htmlFor={label} className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">{label}</label>
        <select id={label} name={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="block w-full pl-4 pr-10 py-3 text-sm font-bold border border-black focus:outline-none focus:ring-sky-500 focus:border-sky-500 rounded-xl shadow-sm bg-white hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <option value="">{defaultOption}</option>
            {options.map(option => (<option key={option.key || option} value={option.key || option}>{option.name || option}</option>))}
        </select>
    </div>
);

const MentorshipDashboard = ({ 
    allSubmissions, STATE_LOCALITIES, activeService, activeState, onStateChange, activeLocality, onLocalityChange, activeFacilityId, onFacilityIdChange, activeWorkerName, onWorkerNameChange, activeProject, onProjectChange, visitReports, canEditStatus, onUpdateStatus, activeWorkerType, onWorkerTypeChange = () => {},
    publicDashboardMode = false, handleRefresh = () => {}, isRefreshing = false, isLoading = false
}) => {

    const [activeEencTab, setActiveEencTab] = useState('skills'); 
    const [activeImnciTab, setActiveImnciTab] = useState('skills'); 

    // --- Local State for Optimistic Updates ---
    const [localStatusUpdates, setLocalStatusUpdates] = useState({});

    // Clear local updates when new data arrives to prevent stale data
    useEffect(() => {
        setLocalStatusUpdates({});
    }, [visitReports]);

    const handleLocalUpdate = (reportId, challengeId, newValue, fieldName) => {
        const key = `${reportId}_${challengeId}_${fieldName}`;
        setLocalStatusUpdates(prev => ({ ...prev, [key]: newValue }));
        onUpdateStatus(reportId, challengeId, newValue, fieldName);
    };

    // --- Visit Report Data Processor ---
    const visitReportStats = useMemo(() => {
        if (!visitReports) return null;
        let filtered = visitReports.filter(r => r.service === activeService);

        if (activeState) filtered = filtered.filter(r => r.state === activeState);
        if (activeLocality) filtered = filtered.filter(r => r.locality === activeLocality);
        if (activeFacilityId) filtered = filtered.filter(r => r.facilityId === activeFacilityId);
        if (activeProject) filtered = filtered.filter(r => r.project === activeProject);

        const totalVisits = filtered.length;

        const stateCounts = {};
        filtered.forEach(r => {
            const s = r.state || 'Unknown';
            stateCounts[s] = (stateCounts[s] || 0) + 1;
        });
        const stateChartData = Object.keys(stateCounts).map(k => ({
            stateName: STATE_LOCALITIES[k]?.ar || k,
            count: stateCounts[k]
        }));

        const facilityMap = {};
        const skillKeys = new Set();

        filtered.forEach(r => {
            const fid = r.facilityId;
            if (!facilityMap[fid]) {
                facilityMap[fid] = {
                    id: fid,
                    facilityName: r.facilityName,
                    state: r.state,
                    locality: r.locality,
                    visitCount: 0,
                    skills: {}
                };
            }
            facilityMap[fid].visitCount++;

            if (r.fullData && r.fullData.trained_skills) {
                Object.keys(r.fullData.trained_skills).forEach(k => {
                    if (r.fullData.trained_skills[k]) {
                        facilityMap[fid].skills[k] = (facilityMap[fid].skills[k] || 0) + 1;
                        skillKeys.add(k);
                    }
                });
            }
        });
        const facilityTableData = Object.values(facilityMap);
        const distinctSkillKeys = Array.from(skillKeys);

        const problemsList = [];
        filtered.forEach(r => {
            if (r.fullData && r.fullData.challenges_table) {
                r.fullData.challenges_table.forEach(ch => {
                    if (ch.problem) {
                        problemsList.push({
                            reportId: r.id, challengeId: ch.id, facility: r.facilityName, date: r.visitDate, problem: ch.problem,
                            immediate: ch.immediate_solution, immediate_status: ch.immediate_status || 'Pending',
                            longterm: ch.long_term_solution, long_term_status: ch.long_term_status || 'Pending',
                            person: ch.responsible_person
                        });
                    }
                });
            }
        });

        return { totalVisits, stateChartData, facilityTableData, distinctSkillKeys, problemsList };

    }, [visitReports, activeService, activeState, activeLocality, activeFacilityId, activeProject, STATE_LOCALITIES]);

    // --- Helper for rendering status badges/selects with Local Optimistic Update ---
    const renderStatusCell = (currentStatus, reportId, challengeId, fieldName) => {
        const key = `${reportId}_${challengeId}_${fieldName}`;
        const displayStatus = localStatusUpdates[key] !== undefined ? localStatusUpdates[key] : currentStatus;

        if (canEditStatus) {
            return (
                <select value={displayStatus} onChange={(e) => handleLocalUpdate(reportId, challengeId, e.target.value, fieldName)} className={`block w-full text-[11px] font-bold border border-black rounded-lg shadow-sm focus:border-sky-500 focus:ring-sky-500 bg-white ${displayStatus === 'Done' || displayStatus === 'Resolved' ? 'text-emerald-700' : displayStatus === 'In Progress' ? 'text-sky-700' : 'text-amber-700'}`}>
                    <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Done">Done</option>
                </select>
            );
        } else {
            return (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-sm border border-black ${displayStatus === 'Done' || displayStatus === 'Resolved' ? 'bg-emerald-50 text-emerald-700' : displayStatus === 'In Progress' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                    {displayStatus}
                </span>
            );
        }
    };

    const reCalculatedSubmissions = useMemo(() => {
        if (!allSubmissions) return [];
        return allSubmissions.map(sub => {
            if (sub.service === 'EENC_MOTHERS' || sub.service === 'IMNCI_MOTHERS') return sub; 
            if (sub.service !== 'IMNCI' || !sub.fullData) return sub;
            const s = sub.scores || {};
            if (s.treatment_total_score_maxScore === undefined) {
                try {
                    const rehydratedData = rehydrateDraftData(sub.fullData, DIARRHEA_CLASSIFICATIONS, FEVER_CLASSIFICATIONS);
                    const reCalculatedScores = calculateScores(rehydratedData);
                    const newScoresPayload = {};
                    for (const key in reCalculatedScores) { 
                        if (key !== 'treatmentScoreForSave' && reCalculatedScores[key]?.score !== undefined && reCalculatedScores[key]?.maxScore !== undefined) {
                            newScoresPayload[`${key}_score`] = reCalculatedScores[key].score;
                            newScoresPayload[`${key}_maxScore`] = reCalculatedScores[key].maxScore;
                        }
                    }
                    return { ...sub, scores: newScoresPayload };
                } catch (e) { return sub; }
            }
            return sub;
        });
    }, [allSubmissions]);

   const imnciKpiHelper = useCallback((submissions) => {
        const scores = {
            overall: [], assessment: [], decision: [], treatment: [],
            handsOnWeight: [], handsOnTemp: [], handsOnHeight: [],
            respiratoryRateCalculation: [], dehydrationAssessment: [],
            handsOnMUAC: [], handsOnWFH: [], handsOnPallor: [],
            pneuAmox: [], diarOrs: [], diarZinc: [], anemiaIron: [],
            immunization: [], vitaminAssessment: [], malariaCoartem: [], returnImm: [], returnFu: [],
            recordSigns: [], recordClassifications: [], recordTreatments: [],
            vitalSigns: [], dangerSigns: [], mainSymptoms: [], malnutrition: [], otherProblems: [],
            measurementSkills: [], malnutritionAnemiaSkills: [],
        };
        
        const totalCasesObserved = submissions.length;
        const uniqueVisits = new Set(submissions.map(s => `${s.facilityId || 'unk'}_${s.staff || 'unk'}_${s.date || 'unk'}`));
        const totalVisits = uniqueVisits.size;
        const uniqueWorkers = new Set(submissions.map(s => `${s.facilityId || 'unk'}_${s.staff || 'unk'}`));
        const totalHealthWorkers = uniqueWorkers.size;

        const skillStats = {};
        
        const initStat = (key) => { if (!skillStats[key]) skillStats[key] = { yes: 0, no: 0 }; };

        ['skill_ask_cough', 'skill_check_rr', 'skill_classify_cough', 'skill_ask_diarrhea', 'skill_check_dehydration', 'skill_classify_diarrhea', 'skill_ask_fever', 'skill_check_rdt', 'skill_classify_fever', 'skill_ask_ear', 'skill_check_ear', 'skill_classify_ear', 'decisionMatches'].forEach(k => initStat(k));

        IMNCI_FORM_STRUCTURE.forEach(group => { group.subgroups?.forEach(sub => { sub.skills?.forEach(skill => initStat(skill.key)); }); });

        submissions.forEach(sub => {
            const s = sub.scores || {}; const as = sub.fullData?.assessmentSkills || {}; const ts = sub.fullData?.treatmentSkills || {};

            if (s.overallScore_maxScore > 0) scores.overall.push(s.overallScore_score / s.overallScore_maxScore);
            if (s.assessment_total_score_maxScore > 0) scores.assessment.push(s.assessment_total_score_score / s.assessment_total_score_maxScore);
            if (s.finalDecision_maxScore > 0) scores.decision.push(s.finalDecision_score / s.finalDecision_maxScore);
            if (s.treatment_total_score_maxScore > 0) scores.treatment.push(s.treatment_total_score_score / s.treatment_total_score_maxScore);
            if (s.immunization_maxScore > 0) scores.immunization.push(s.immunization_score / s.immunization_maxScore);
            
            Object.keys(scores).forEach(key => {
                const maxKey = `${key}_maxScore`; const scKey = `${key}_score`;
                if (s[maxKey] > 0 && !['overall', 'assessment', 'decision', 'treatment', 'immunization', 'vitaminAssessment', 'malariaCoartem', 'returnImm', 'returnFu', 'measurementSkills', 'malnutritionAnemiaSkills', 'respiratoryRateCalculation', 'dehydrationAssessment', 'pneuAmox', 'diarOrs', 'diarZinc', 'anemiaIron', 'recordSigns', 'recordClassifications', 'recordTreatments'].includes(key)) {
                    scores[key].push(s[scKey] / s[maxKey]);
                }
            });

            if (as['supervisor_confirms_cough'] === 'yes') scores.respiratoryRateCalculation.push(as['skill_check_rr'] === 'yes' ? 1 : 0);
            if (as['supervisor_confirms_diarrhea'] === 'yes') scores.dehydrationAssessment.push(as['skill_check_dehydration'] === 'yes' ? 1 : 0);

            const pushSpecificTreatment = (skillKey, targetArr) => { const val = ts[skillKey]; if (val === 'yes') targetArr.push(1); else if (val === 'no') targetArr.push(0); };
            pushSpecificTreatment('skill_pneu_abx', scores.pneuAmox); pushSpecificTreatment('skill_diar_ors', scores.diarOrs); pushSpecificTreatment('skill_diar_zinc', scores.diarZinc); pushSpecificTreatment('skill_anemia_iron', scores.anemiaIron);

            let vitAVal = null;
            if (as['skill_imm_vita'] === 'yes') vitAVal = 1;
            else if (as['skill_imm_vita'] === 'no' || as['skill_imm_vita'] === 'na') vitAVal = 0;
            if (vitAVal !== null) scores.vitaminAssessment.push(vitAVal);

            let coartemVal = null;
            if (ts['skill_mal_meds'] === 'yes') coartemVal = 1;
            else if (ts['skill_mal_meds'] === 'no') coartemVal = 0;
            if (coartemVal !== null) scores.malariaCoartem.push(coartemVal);

            let returnImmVal = null;
            if (ts['skill_fu_when'] === 'yes') returnImmVal = 1;
            else if (ts['skill_fu_when'] === 'no') returnImmVal = 0;
            if (returnImmVal !== null) scores.returnImm.push(returnImmVal);

            let returnFuVal = null;
            if (ts['skill_fu_return'] === 'yes') returnFuVal = 1;
            else if (ts['skill_fu_return'] === 'no') returnFuVal = 0;
            if (returnFuVal !== null) scores.returnFu.push(returnFuVal);
            
            const rs = sub.fullData?.recording_skills || sub.fullData?.recordingSkills || {};
            
            let recSignsVal = null;
            if (rs['skill_record_signs'] === 'yes') recSignsVal = 1;
            else if (rs['skill_record_signs'] === 'no') recSignsVal = 0;
            if (recSignsVal !== null) scores.recordSigns.push(recSignsVal);

            let recClassVal = null;
            if (rs['skill_record_classifications'] === 'yes') recClassVal = 1;
            else if (rs['skill_record_classifications'] === 'no') recClassVal = 0;
            if (recClassVal !== null) scores.recordClassifications.push(recClassVal);

            let recTreatVal = null;
            if (rs['skill_record_treatments'] === 'yes') recTreatVal = 1;
            else if (rs['skill_record_treatments'] === 'no') recTreatVal = 0;
            if (recTreatVal !== null) scores.recordTreatments.push(recTreatVal);

            const pushSkillWithFallback = (scoreVal, maxVal, skillKey, targetArr) => { if (maxVal > 0) { targetArr.push(scoreVal / maxVal); } else if (as[skillKey]) { targetArr.push((as[skillKey] === 'yes' || as[skillKey] === 'correct' || as[skillKey] === true) ? 1 : 0); } };
            pushSkillWithFallback(s.handsOnWeight_score, s.handsOnWeight_maxScore, 'skill_weight', scores.measurementSkills); pushSkillWithFallback(s.handsOnTemp_score, s.handsOnTemp_maxScore, 'skill_temp', scores.measurementSkills); pushSkillWithFallback(s.handsOnHeight_score, s.handsOnHeight_maxScore, 'skill_height', scores.measurementSkills);
            pushSkillWithFallback(s.handsOnMUAC_score, s.handsOnMUAC_maxScore, 'skill_muac', scores.malnutritionAnemiaSkills); pushSkillWithFallback(s.handsOnWFH_score, s.handsOnWFH_maxScore, 'skill_wfh', scores.malnutritionAnemiaSkills);
            
            const pallorVal = as['skill_anemia_pallor'];
            if (pallorVal === 'yes') { scores.handsOnPallor.push(1); scores.malnutritionAnemiaSkills.push(1); } else if (pallorVal === 'no') { scores.handsOnPallor.push(0); scores.malnutritionAnemiaSkills.push(0); }

            const allSkills = { ...as, ...ts, ...rs };
            Object.keys(skillStats).forEach(key => {
                if (key === 'decisionMatches') return; 
                const val = allSkills[key];
                if (val === 'yes' || val === 'correct' || val === true) skillStats[key].yes++; else if (val === 'no' || val === 'incorrect' || val === false) skillStats[key].no++;
            });

            const decisionMatch = sub.fullData?.decision_agreement || sub.fullData?.decision_score_agreement; 
            if (decisionMatch === 'yes' || decisionMatch === true) skillStats['decisionMatches'].yes++; else if (decisionMatch === 'no' || decisionMatch === false) skillStats['decisionMatches'].no++;
        });

        const avg = (arr) => calculateAverage(arr);
        return {
            totalVisits, totalCasesObserved, totalHealthWorkers, skillStats,
            avgOverall: avg(scores.overall), avgAssessment: avg(scores.assessment), avgDecision: avg(scores.decision), avgTreatment: avg(scores.treatment),
            avgRespiratoryRateCalculation: avg(scores.respiratoryRateCalculation), avgDehydrationAssessment: avg(scores.dehydrationAssessment), 
            avgHandsOnWeight: avg(scores.handsOnWeight), avgHandsOnTemp: avg(scores.handsOnTemp), avgHandsOnHeight: avg(scores.handsOnHeight), 
            avgHandsOnMUAC: avg(scores.handsOnMUAC), avgHandsOnWFH: avg(scores.handsOnWFH), avgHandsOnPallor: avg(scores.handsOnPallor),
            avgPneuAmox: avg(scores.pneuAmox), avgDiarOrs: avg(scores.diarOrs), avgDiarZinc: avg(scores.diarZinc), avgAnemiaIron: avg(scores.anemiaIron),
            avgImmunization: avg(scores.immunization), avgVitaminAssessment: avg(scores.vitaminAssessment), avgMalariaCoartem: avg(scores.malariaCoartem), avgReturnImm: avg(scores.returnImm), avgReturnFu: avg(scores.returnFu),
            avgRecordSigns: avg(scores.recordSigns), avgRecordClass: avg(scores.recordClassifications), avgRecordTreat: avg(scores.recordTreatments),
            avgDangerSigns: avg(scores.dangerSigns),
            avgMeasurementSkills: avg(scores.measurementSkills), avgMalnutritionAnemiaSkills: avg(scores.malnutritionAnemiaSkills),
        };
    }, []);

    const eencKpiHelper = useCallback((submissions) => {
        const scores = {
            overall: [], preparation: [], drying: [], normal_breathing: [], resuscitation: [],
            inf_wash1: [], inf_wash2: [], inf_gloves: [], prep_towel: [], prep_equip: [], prep_ambu: [],
            care_dry: [], care_skin: [], care_cover: [], cord_hygiene: [], cord_delay: [], cord_clamp: [],
            bf_advice: [], resus_head: [], resus_mask: [], resus_chest: [], resus_rate: []
        };
        const totalCasesObserved = submissions.length;
        const uniqueVisits = new Set(submissions.map(s => `${s.facilityId || 'unk'}_${s.staff || 'unk'}_${s.date || 'unk'}`));
        const totalVisits = uniqueVisits.size;
        const uniqueWorkers = new Set(submissions.map(s => `${s.facilityId || 'unk'}_${s.staff || 'unk'}`));
        const totalHealthWorkers = uniqueWorkers.size;

        const skillStats = {};
        const allSkillItems = [...PREPARATION_ITEMS, ...DRYING_STIMULATION_ITEMS, ...NORMAL_BREATHING_ITEMS, ...RESUSCITATION_ITEMS];

        allSkillItems.forEach(item => { skillStats[item.key] = { yes: 0, no: 0, partial: 0, na: 0 }; });

        submissions.forEach(sub => {
            const s = sub.scores; const skills = sub.fullData?.skills; const status = sub.fullData?.eenc_breathing_status;
            if (s) {
                if (s.overallScore_maxScore > 0) scores.overall.push(s.overallScore_score / s.overallScore_maxScore);
                if (s.preparation_maxScore > 0) scores.preparation.push(s.preparation_score / s.preparation_maxScore);
                if (s.drying_maxScore > 0) scores.drying.push(s.drying_score / s.drying_maxScore);
                if (s.normal_breathing_maxScore > 0) scores.normal_breathing.push(s.normal_breathing_score / s.normal_breathing_maxScore);
                if (s.resuscitation_maxScore > 0) scores.resuscitation.push(s.resuscitation_score / s.resuscitation_maxScore);
            }
            if (skills) {
                allSkillItems.forEach(item => {
                    const value = skills[item.key];
                    if (value === 'yes') skillStats[item.key].yes++; else if (value === 'no') skillStats[item.key].no++;
                    else if (value === 'partial') skillStats[item.key].partial++; else if (value === 'na') skillStats[item.key].na++;
                });
                const pushScore = (key, arrayName) => { if (skills[key] === 'yes') scores[arrayName].push(1); else if (skills[key] === 'no' || skills[key] === 'partial') scores[arrayName].push(0); };
                pushScore('prep_wash_1', 'inf_wash1'); pushScore('prep_wash_2', 'inf_wash2'); pushScore('prep_gloves', 'inf_gloves');
                pushScore('prep_cloths', 'prep_towel'); pushScore('prep_resuscitation_area', 'prep_equip'); pushScore('prep_ambu_check', 'prep_ambu');
                pushScore('dry_start_5sec', 'care_dry'); pushScore('dry_skin_to_skin', 'care_skin'); pushScore('dry_cover_baby', 'care_cover');
                if (status === 'yes') { pushScore('normal_remove_outer_glove', 'cord_hygiene'); pushScore('normal_cord_pulse_check', 'cord_delay'); pushScore('normal_cord_clamping', 'cord_clamp'); pushScore('normal_breastfeeding_guidance', 'bf_advice'); }
                if (status === 'no') { pushScore('resus_position_head', 'resus_head'); pushScore('resus_mask_position', 'resus_mask'); pushScore('resus_check_chest_rise', 'resus_chest'); pushScore('resus_ventilation_rate', 'resus_rate'); }
            }
        });

        const avg = (arr) => calculateAverage(arr);
        return {
            totalVisits, totalCasesObserved, totalHealthWorkers, skillStats,
            avgOverall: avg(scores.overall), avgPreparation: avg(scores.preparation), avgDrying: avg(scores.drying), avgNormalBreathing: avg(scores.normal_breathing), avgResuscitation: avg(scores.resuscitation),
            avgInfWash1: avg(scores.inf_wash1), avgInfWash2: avg(scores.inf_wash2), avgInfGloves: avg(scores.inf_gloves),
            avgPrepTowel: avg(scores.prep_towel), avgPrepEquip: avg(scores.prep_equip), avgPrepAmbu: avg(scores.prep_ambu),
            avgCareDry: avg(scores.care_dry), avgCareSkin: avg(scores.care_skin), avgCareCover: avg(scores.care_cover),
            avgCordHygiene: avg(scores.cord_hygiene), avgCordDelay: avg(scores.cord_delay), avgCordClamp: avg(scores.cord_clamp),
            avgBfAdvice: avg(scores.bf_advice), avgResusHead: avg(scores.resus_head), avgResusMask: avg(scores.resus_mask), avgResusChest: avg(scores.resus_chest), avgResusRate: avg(scores.resus_rate),
        };
    }, []);

    const eencMotherKpiHelper = useCallback((submissions) => {
        const motherSubmissions = submissions.filter(sub => sub.service === 'EENC_MOTHERS');
        const totalMothers = motherSubmissions.length;
        const scores = { skin_imm: [], skin_90min: [], bf_1hr: [], bf_substitute: [], bf_bottle: [], vit_k: [], eye_oint: [], cord_subs: [], skin_oil: [], bath_6hr: [], polio: [], bcg: [], weight: [], temp: [], civ_reg: [], dis_card: [] };
        const skillStats = {};
        EENC_MOTHER_SURVEY_ITEMS_EN.forEach(g => g.items.forEach(i => skillStats[i.key] = { yes: 0, no: 0 }));

        motherSubmissions.forEach(sub => {
            const d = sub.eencMothersData || sub.fullData?.eencMothersData;
            if (d) {
                const push = (val, arr, key) => { const isYes = val === 'yes'; arr.push(isYes ? 1 : 0); if(skillStats[key]) { if(isYes) skillStats[key].yes++; else if(val === 'no') skillStats[key].no++; } };
                push(d.skin_to_skin_immediate, scores.skin_imm, 'skin_to_skin_immediate'); push(d.skin_to_skin_90min, scores.skin_90min, 'skin_to_skin_90min');
                push(d.breastfed_first_hour, scores.bf_1hr, 'breastfed_first_hour'); push(d.given_other_fluids, scores.bf_substitute, 'given_other_fluids'); push(d.given_other_fluids_bottle, scores.bf_bottle, 'given_other_fluids_bottle');
                push(d.given_vitamin_k, scores.vit_k, 'given_vitamin_k'); push(d.given_tetracycline, scores.eye_oint, 'given_tetracycline'); push(d.anything_on_cord, scores.cord_subs, 'anything_on_cord');
                push(d.rubbed_with_oil, scores.skin_oil, 'rubbed_with_oil'); push(d.baby_bathed, scores.bath_6hr, 'baby_bathed');
                push(d.polio_zero_dose, scores.polio, 'polio_zero_dose'); push(d.bcg_dose, scores.bcg, 'bcg_dose');
                push(d.baby_weighed, scores.weight, 'baby_weighed'); push(d.baby_temp_measured, scores.temp, 'baby_temp_measured');
                push(d.baby_registered, scores.civ_reg, 'baby_registered'); push(d.given_discharge_card, scores.dis_card, 'given_discharge_card');
            }
        });

        const avg = (arr) => calculateAverage(arr);
        const allScores = Object.values(scores).flat();
        const avgOverall = calculateAverage(allScores);

        return {
            totalMothers, skillStats, avgOverall,
            avgSkinImm: avg(scores.skin_imm), avgSkin90min: avg(scores.skin_90min), avgBf1hr: avg(scores.bf_1hr), avgBfSub: avg(scores.bf_substitute), avgBfBottle: avg(scores.bf_bottle),
            avgVitK: avg(scores.vit_k), avgEyeOint: avg(scores.eye_oint), avgCordSubs: avg(scores.cord_subs), avgSkinOil: avg(scores.skin_oil), avgBath6hr: avg(scores.bath_6hr),
            avgPolio: avg(scores.polio), avgBcg: avg(scores.bcg), avgWeight: avg(scores.weight), avgTemp: avg(scores.temp), avgCivReg: avg(scores.civ_reg), avgDisCard: avg(scores.dis_card),
        };
    }, []);

    const imnciMotherKpiHelper = useCallback((submissions) => {
        const motherSubmissions = submissions.filter(sub => sub.service === 'IMNCI_MOTHERS');
        const totalMothers = motherSubmissions.length;
        
        const scores = {
            // Knowledge
            know_med: [], know_ors_prep: [], know_tx: [], know_4rules: [], know_return: [], know_fluids: [], know_ors_qty: [], know_ors_stool: [],
            // Satisfaction
            sat_time: [], sat_assess: [], sat_tx: [], sat_comm: [], sat_learn: [], sat_avail: []
        };

        const skillStats = {};
        IMNCI_MOTHER_SURVEY_ITEMS_EN.forEach(g => g.items.forEach(i => skillStats[i.key] = { yes: 0, no: 0 }));

        motherSubmissions.forEach(sub => {
            const k = sub.mothersKnowledge || sub.fullData?.mothersKnowledge || {};
            const s = sub.mothersSatisfaction || sub.fullData?.mothersSatisfaction || {};
            
            const push = (val, arr, key) => { 
                const isYes = val === 'نعم'; // IMNCI Form uses Arabic 'نعم'
                arr.push(isYes ? 1 : 0); 
                if(skillStats[key]) { 
                    if(isYes) skillStats[key].yes++; 
                    else if(val === 'لا') skillStats[key].no++; 
                } 
            };

            push(k.knows_med_details, scores.know_med, 'knows_med_details');
            push(k.knows_ors_prep, scores.know_ors_prep, 'knows_ors_prep');
            push(k.knows_treatment_details, scores.know_tx, 'knows_treatment_details');
            push(k.knows_diarrhea_4rules, scores.know_4rules, 'knows_diarrhea_4rules');
            push(k.knows_return_date, scores.know_return, 'knows_return_date');
            push(k.knows_home_fluids, scores.know_fluids, 'knows_home_fluids');
            push(k.knows_ors_water_qty, scores.know_ors_qty, 'knows_ors_water_qty');
            push(k.knows_ors_after_stool, scores.know_ors_stool, 'knows_ors_after_stool');

            push(s.time_spent, scores.sat_time, 'time_spent');
            push(s.assessment_method, scores.sat_assess, 'assessment_method');
            push(s.treatment_given, scores.sat_tx, 'treatment_given');
            push(s.communication_style, scores.sat_comm, 'communication_style');
            push(s.what_learned, scores.sat_learn, 'what_learned');
            push(s.drug_availability, scores.sat_avail, 'drug_availability');
        });

        const avg = (arr) => calculateAverage(arr);
        const allScores = Object.values(scores).flat();
        const avgOverall = calculateAverage(allScores);

        return {
            totalMothers, skillStats, avgOverall,
            avgKnowMed: avg(scores.know_med), avgKnowOrsPrep: avg(scores.know_ors_prep), avgKnowTx: avg(scores.know_tx), avgKnow4Rules: avg(scores.know_4rules),
            avgKnowReturn: avg(scores.know_return), avgKnowFluids: avg(scores.know_fluids), avgKnowOrsQty: avg(scores.know_ors_qty), avgKnowOrsStool: avg(scores.know_ors_stool),
            avgSatTime: avg(scores.sat_time), avgSatAssess: avg(scores.sat_assess), avgSatTx: avg(scores.sat_tx), avgSatComm: avg(scores.sat_comm), avgSatLearn: avg(scores.sat_learn), avgSatAvail: avg(scores.sat_avail)
        };
    }, []);


    const serviceCompletedSubmissions = useMemo(() => (reCalculatedSubmissions || []).filter(sub => 
        (activeService === 'EENC' ? (sub.service === 'EENC' || sub.service === 'EENC_MOTHERS') : 
         activeService === 'IMNCI' ? (sub.service === 'IMNCI' || sub.service === 'IMNCI_MOTHERS') : 
         sub.service === activeService) 
        && sub.status === 'complete'
    ), [reCalculatedSubmissions, activeService]);

    const stateOptions = useMemo(() => !STATE_LOCALITIES ? [] : Object.keys(STATE_LOCALITIES).map(k => ({ key: k, name: STATE_LOCALITIES[k]?.ar || k })).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [STATE_LOCALITIES]);
    const localityOptions = useMemo(() => (!activeState || !STATE_LOCALITIES[activeState]?.localities) ? [] : STATE_LOCALITIES[activeState].localities.map(l => ({ key: l.en, name: l.ar })).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [activeState, STATE_LOCALITIES]);
    const facilityOptions = useMemo(() => {
        const map = new Map(); serviceCompletedSubmissions.filter(s => (!activeState || s.state === activeState) && (!activeLocality || s.locality === activeLocality)).forEach(s => { if (s.facilityId && !map.has(s.facilityId)) map.set(s.facilityId, { key: s.facilityId, name: s.facility || 'Unknown' }); });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality]);
    
    // Derived project options based on state and locality
    const projectOptions = useMemo(() => {
        const map = new Map(); 
        serviceCompletedSubmissions.filter(s => 
            (!activeState || s.state === activeState) && 
            (!activeLocality || s.locality === activeLocality) &&
            (!activeFacilityId || s.facilityId === activeFacilityId)
        ).forEach(s => { 
            if (s.project && s.project !== 'N/A' && !map.has(s.project)) {
                map.set(s.project, { key: s.project, name: s.project }); 
            }
        });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId]);

    const workerOptions = useMemo(() => {
        const map = new Map(); serviceCompletedSubmissions.filter(s => (!activeState || s.state === activeState) && (!activeLocality || s.locality === activeLocality) && (!activeFacilityId || s.facilityId === activeFacilityId) && (!activeProject || s.project === activeProject)).forEach(s => { if (s.staff && !map.has(s.staff)) map.set(s.staff, { key: s.staff, name: s.staff }); });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId, activeProject]);

    // NEW: Extract Worker Type (Job Description) options
    const workerTypeOptions = useMemo(() => {
        const types = new Set();
        serviceCompletedSubmissions.forEach(s => {
            if (
                (!activeState || s.state === activeState) &&
                (!activeLocality || s.locality === activeLocality) &&
                (!activeFacilityId || s.facilityId === activeFacilityId) &&
                (!activeProject || s.project === activeProject)
            ) {
                if (s.workerType && s.workerType !== 'N/A') types.add(s.workerType);
            }
        });
        return Array.from(types).map(t => ({ key: t, name: t })).sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId, activeProject]);

    const filteredSubmissions = useMemo(() => serviceCompletedSubmissions.filter(sub => 
        (!activeState || sub.state === activeState) && 
        (!activeLocality || sub.locality === activeLocality) && 
        (!activeFacilityId || sub.facilityId === activeFacilityId) && 
        (!activeWorkerName || sub.staff === activeWorkerName) &&
        (!activeProject || sub.project === activeProject) &&
        (!activeWorkerType || sub.workerType === activeWorkerType)
    ), [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId, activeWorkerName, activeProject, activeWorkerType]);

    const overallKpis = useMemo(() => {
        if (activeService === 'IMNCI') return imnciKpiHelper(filteredSubmissions.filter(s => s.service === 'IMNCI'));
        if (activeService === 'EENC') return eencKpiHelper(filteredSubmissions.filter(s => s.service === 'EENC'));
        return { totalVisits: filteredSubmissions.length, totalCasesObserved: filteredSubmissions.length, totalHealthWorkers: 0, skillStats: {} };
    }, [filteredSubmissions, imnciKpiHelper, eencKpiHelper, activeService]);

    const motherKpis = useMemo(() => {
        if (activeService === 'EENC') return eencMotherKpiHelper(filteredSubmissions);
        if (activeService === 'IMNCI') return imnciMotherKpiHelper(filteredSubmissions);
        return null;
    }, [filteredSubmissions, eencMotherKpiHelper, imnciMotherKpiHelper, activeService]);

    // Data Processor for Volume (Visits & Cases per Visit Number)
    const volumeChartData = useMemo(() => {
        const targetMotherService = activeService === 'IMNCI' ? 'IMNCI_MOTHERS' : 'EENC_MOTHERS';
        const visitGroups = filteredSubmissions.reduce((acc, sub) => {
            if (sub.service === targetMotherService) return acc;
            const visitNum = sub.visitNumber || 'N/A';
            if (visitNum === 'N/A') return acc;
            if (!acc[visitNum]) {
                acc[visitNum] = { cases: 0, visits: new Set() };
            }
            acc[visitNum].cases += 1;
            acc[visitNum].visits.add(`${sub.facilityId || 'unk'}_${sub.staff || 'unk'}_${sub.date || 'unk'}`);
            return acc;
        }, {});

        return Object.keys(visitGroups)
            .map(v => ({
                visitNumber: parseInt(v),
                name: `Visit ${v}`,
                'Cases Observed': visitGroups[v].cases,
                'Completed Visits': visitGroups[v].visits.size
            }))
            .sort((a,b) => a.visitNumber - b.visitNumber)
            .slice(0, 4);
    }, [filteredSubmissions, activeService]);


    const imnciChartData = useMemo(() => {
        if (activeService !== 'IMNCI') return [];
        const calcPercent = (score, max) => (max > 0) ? (score / max) * 100 : null;
        const visitGroups = filteredSubmissions.reduce((acc, sub) => {
            if (sub.service === 'IMNCI_MOTHERS') return acc; // Skip mothers
            const s = sub.scores; const visitNum = sub.visitNumber || 'N/A'; if (!s || visitNum === 'N/A') return acc;
            if (!acc[visitNum]) acc[visitNum] = {
                'Overall': [], 'Assessment': [], 'Decision': [], 'Treatment': [], 
                'Resp. Rate': [], 'Dehydration': [],
                'Pneumonia Amox': [], 'Diarrhea ORS': [], 'Diarrhea Zinc': [], 'Anemia Iron': [],
                'Weight': [], 'Temp': [], 'Height': [], 'MUAC': [], 'WFH': [], 'Pallor': [], 'DangerSigns': [],
                'Malnutrition Assessment': [], 'Measurement Skills': [],
                'Immunization': [], 'Vitamin Assessment': [], 'Malaria Coartem': [], 'Return Immediately': [], 'Return Followup': [],
                'Record Signs': [], 'Record Classifications': [], 'Record Treatments': []
            };
            const g = acc[visitNum];
            g['Overall'].push(calcPercent(s.overallScore_score, s.overallScore_maxScore));
            g['Assessment'].push(calcPercent(s.assessment_total_score_score, s.assessment_total_score_maxScore));
            g['Decision'].push(calcPercent(s.finalDecision_score, s.finalDecision_maxScore));
            g['Treatment'].push(calcPercent(s.treatment_total_score_score, s.treatment_total_score_maxScore));
            g['Immunization'].push(calcPercent(s.immunization_score, s.immunization_maxScore));
            
            const weightPct = calcPercent(s.handsOnWeight_score, s.handsOnWeight_maxScore);
            const tempPct = calcPercent(s.handsOnTemp_score, s.handsOnTemp_maxScore);
            const heightPct = calcPercent(s.handsOnHeight_score, s.handsOnHeight_maxScore);

            g['Weight'].push(weightPct);
            g['Temp'].push(tempPct);
            g['Height'].push(heightPct);
            
            // Average for the Measurement Skills chart
            g['Measurement Skills'].push(weightPct);
            g['Measurement Skills'].push(tempPct);
            g['Measurement Skills'].push(heightPct);
            
            const muacPct = calcPercent(s.handsOnMUAC_score, s.handsOnMUAC_maxScore);
            const wfhPct = calcPercent(s.handsOnWFH_score, s.handsOnWFH_maxScore);
            g['MUAC'].push(muacPct);
            g['WFH'].push(wfhPct);
            g['Malnutrition Assessment'].push(muacPct);
            g['Malnutrition Assessment'].push(wfhPct);
            
            g['DangerSigns'].push(calcPercent(s.dangerSigns_score, s.dangerSigns_maxScore));
            
            const as = sub.fullData?.assessmentSkills || {};
            const ts = sub.fullData?.treatmentSkills || {};

            if (as) { 
                if (as['skill_anemia_pallor'] === 'yes') g['Pallor'].push(100); else if (as['skill_anemia_pallor'] === 'no') g['Pallor'].push(0); 
                if (as['supervisor_confirms_cough'] === 'yes') g['Resp. Rate'].push(as['skill_check_rr'] === 'yes' ? 100 : 0);
                if (as['supervisor_confirms_diarrhea'] === 'yes') g['Dehydration'].push(as['skill_check_dehydration'] === 'yes' ? 100 : 0);
            }

            const pushTreatment = (key, label) => { if (ts[key] === 'yes') g[label].push(100); else if (ts[key] === 'no') g[label].push(0); };
            pushTreatment('skill_pneu_abx', 'Pneumonia Amox'); pushTreatment('skill_diar_ors', 'Diarrhea ORS'); pushTreatment('skill_diar_zinc', 'Diarrhea Zinc'); pushTreatment('skill_anemia_iron', 'Anemia Iron');

            let vitAChartVal = null;
            if (as['skill_imm_vita'] === 'yes') vitAChartVal = 100;
            else if (as['skill_imm_vita'] === 'no' || as['skill_imm_vita'] === 'na') vitAChartVal = 0;
            if (vitAChartVal !== null) g['Vitamin Assessment'].push(vitAChartVal);

            let coartemChartVal = null;
            if (ts['skill_mal_meds'] === 'yes') coartemChartVal = 100;
            else if (ts['skill_mal_meds'] === 'no') coartemChartVal = 0;
            if (coartemChartVal !== null) g['Malaria Coartem'].push(coartemChartVal);

            let returnImmChartVal = null;
            if (ts['skill_fu_when'] === 'yes') returnImmChartVal = 100;
            else if (ts['skill_fu_when'] === 'no') returnImmChartVal = 0;
            if (returnImmChartVal !== null) g['Return Immediately'].push(returnImmChartVal);

            let returnFuChartVal = null;
            if (ts['skill_fu_return'] === 'yes') returnFuChartVal = 100;
            else if (ts['skill_fu_return'] === 'no') returnFuChartVal = 0;
            if (returnFuChartVal !== null) g['Return Followup'].push(returnFuChartVal);
            
            const rs = sub.fullData?.recording_skills || sub.fullData?.recordingSkills || {};
            
            let recSignsChartVal = null;
            if (rs['skill_record_signs'] === 'yes') recSignsChartVal = 100;
            else if (rs['skill_record_signs'] === 'no') recSignsChartVal = 0;
            if (recSignsChartVal !== null) g['Record Signs'].push(recSignsChartVal);

            let recClassChartVal = null;
            if (rs['skill_record_classifications'] === 'yes') recClassChartVal = 100;
            else if (rs['skill_record_classifications'] === 'no') recClassChartVal = 0;
            if (recClassChartVal !== null) g['Record Classifications'].push(recClassChartVal);

            let recTreatChartVal = null;
            if (rs['skill_record_treatments'] === 'yes') recTreatChartVal = 100;
            else if (rs['skill_record_treatments'] === 'no') recTreatChartVal = 0;
            if (recTreatChartVal !== null) g['Record Treatments'].push(recTreatChartVal);

            return acc;
        }, {});
        return Object.keys(visitGroups).map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] })).sort((a,b)=>a.visitNumber-b.visitNumber).map(({visitNumber, data}) => {
            const avg = (scores) => { const v = scores.filter(s => s !== null && !isNaN(s)); if(v.length===0)return null; return Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
            const res = { name: `Visit ${visitNumber}` };
            Object.keys(data).forEach(k => res[k] = avg(data[k]));
            return res;
        }).slice(0, 4);
    }, [filteredSubmissions, activeService]);

    const eencChartData = useMemo(() => {
        if (activeService !== 'EENC') return [];
        const calcPercent = (score, max) => (max > 0) ? (score / max) * 100 : null;
        const visitGroups = filteredSubmissions.reduce((acc, sub) => {
            if (sub.service === 'EENC_MOTHERS') return acc;
            const s = sub.scores; const visitNum = sub.visitNumber || 'N/A'; if (!s || visitNum === 'N/A') return acc;
            if (!acc[visitNum]) acc[visitNum] = {
                'Overall': [], 'Preparation': [], 'Drying': [], 'Breathing Mgmt': [], 'Resuscitation': [],
                'Hand Washing (1st)': [], 'Hand Washing (2nd)': [], 'Sterile Gloves': [], 'Towels Ready': [], 'Resus Equip Ready': [], 'Ambu Check': [],
                'Drying < 5s': [], 'Skin-to-Skin': [], 'Dry Towel/Hat': [], 'Hygienic Check': [], 'Delayed Clamp': [], 'Correct Clamp': [],
                'Early BF Advice': [], 'Head Pos': [], 'Mask Seal': [], 'Chest Rise': [], 'Rate 30-50': []
            };
            const g = acc[visitNum];
            g['Overall'].push(calcPercent(s.overallScore_score, s.overallScore_maxScore));
            g['Preparation'].push(calcPercent(s.preparation_score, s.preparation_maxScore));
            g['Drying'].push(calcPercent(s.drying_score, s.drying_maxScore));
            if (s.normal_breathing_maxScore > 0) g['Breathing Mgmt'].push(calcPercent(s.normal_breathing_score, s.normal_breathing_maxScore)); else if (s.resuscitation_maxScore > 0) g['Breathing Mgmt'].push(calcPercent(s.resuscitation_score, s.resuscitation_maxScore));
            g['Resuscitation'].push(calcPercent(s.resuscitation_score, s.resuscitation_maxScore));
            const skills = sub.fullData?.skills || {};
            if (skills) {
                const pushSkill = (key, label) => { if (skills[key] === 'yes') g[label].push(100); else if (skills[key] === 'no') g[label].push(0); };
                pushSkill('prep_wash_1', 'Hand Washing (1st)'); pushSkill('prep_wash_2', 'Hand Washing (2nd)'); pushSkill('prep_gloves', 'Sterile Gloves'); pushSkill('prep_cloths', 'Towels Ready'); pushSkill('prep_resuscitation_area', 'Resus Equip Ready'); pushSkill('prep_ambu_check', 'Ambu Check');
                pushSkill('dry_start_5sec', 'Drying < 5s'); pushSkill('dry_skin_to_skin', 'Skin-to-Skin'); pushSkill('dry_cover_baby', 'Dry Towel/Hat'); pushSkill('normal_remove_outer_glove', 'Hygienic Check'); pushSkill('normal_cord_pulse_check', 'Delayed Clamp'); pushSkill('normal_cord_clamping', 'Correct Clamp'); pushSkill('normal_breastfeeding_guidance', 'Early BF Advice');
                pushSkill('resus_position_head', 'Head Pos'); pushSkill('resus_mask_position', 'Mask Seal'); pushSkill('resus_check_chest_rise', 'Chest Rise'); pushSkill('resus_ventilation_rate', 'Rate 30-50');
            }
            return acc;
        }, {});
        return Object.keys(visitGroups).map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] })).sort((a,b)=>a.visitNumber-b.visitNumber).map(({visitNumber, data}) => {
            const avg = (scores) => { const v = scores.filter(s => s !== null && !isNaN(s)); if(v.length===0)return null; return Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
            const res = { name: `Visit ${visitNumber}` };
            Object.keys(data).forEach(k => res[k] = avg(data[k]));
            return res;
        }).slice(0, 4);
    }, [filteredSubmissions, activeService]);

    const imnciMotherChartData = useMemo(() => {
        if (activeService !== 'IMNCI') return [];
        const sortedSubmissions = [...filteredSubmissions].sort((a, b) => (a.visitNumber || 1) - (b.visitNumber || 1));
        const visitGroups = sortedSubmissions.reduce((acc, sub) => {
            if (sub.service !== 'IMNCI_MOTHERS') return acc;
            const visitNum = sub.visitNumber || 1; 
            if (!acc[visitNum]) acc[visitNum] = {
                'M: Knows Meds': [], 'M: Knows ORS': [], 'M: Knows Tx': [], 'M: Knows 4 Rules': [],
                'M: Knows Return': [], 'M: Knows Fluids': [], 'M: Time Spent': [], 'M: Assess Method': [],
                'M: Tx Given': [], 'M: Comm Style': [], 'M: What Learned': [], 'M: Drug Avail': []
            };
            const g = acc[visitNum];
            const k = sub.mothersKnowledge || sub.fullData?.mothersKnowledge || {};
            const s = sub.mothersSatisfaction || sub.fullData?.mothersSatisfaction || {};
            const push = (val, label) => g[label].push(val === 'نعم' ? 100 : 0);
            push(k.knows_med_details, 'M: Knows Meds'); push(k.knows_ors_prep, 'M: Knows ORS');
            push(k.knows_treatment_details, 'M: Knows Tx'); push(k.knows_diarrhea_4rules, 'M: Knows 4 Rules');
            push(k.knows_return_date, 'M: Knows Return'); push(k.knows_home_fluids, 'M: Knows Fluids');
            push(s.time_spent, 'M: Time Spent'); push(s.assessment_method, 'M: Assess Method');
            push(s.treatment_given, 'M: Tx Given'); push(s.communication_style, 'M: Comm Style');
            push(s.what_learned, 'M: What Learned'); push(s.drug_availability, 'M: Drug Avail');
            return acc;
        }, {});
        return Object.keys(visitGroups)
            .map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] }))
            .sort((a,b) => a.visitNumber - b.visitNumber)
            .map(({visitNumber, data}) => {
                const avg = (scores) => { const v = scores.filter(s => s !== null && !isNaN(s)); if(v.length===0)return null; return Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
                const res = { name: `Visit ${visitNumber}` };
                Object.keys(data).forEach(k => res[k] = avg(data[k]));
                return res;
            }).slice(0, 4);
    }, [filteredSubmissions, activeService]);

    const eencMotherChartData = useMemo(() => {
        if (activeService !== 'EENC') return [];
        const sortedSubmissions = [...filteredSubmissions].sort((a, b) => (a.visitNumber || 1) - (b.visitNumber || 1));
        const visitGroups = sortedSubmissions.reduce((acc, sub) => {
            if (sub.service !== 'EENC_MOTHERS') return acc;
            const visitNum = sub.visitNumber || 1; 
            if (!acc[visitNum]) acc[visitNum] = { 'Imm. Skin-to-Skin': [], '90min Skin-to-Skin': [], 'BF 1st Hour': [], 'Other Fluids': [], 'Bottle Feeding': [], 'Vitamin K': [], 'Eye Ointment': [], 'Cord Substance': [], 'Skin Oiling': [], 'Bathing < 6hrs': [], 'Polio Vaccine': [], 'BCG Vaccine': [], 'Weight Measured': [], 'Temp Measured': [], 'Civil Reg': [], 'Discharge Card': [] };
            const g = acc[visitNum]; 
            const d = sub.eencMothersData || sub.fullData?.eencMothersData || {};
            if(d) {
                const push = (val, label) => g[label].push(val === 'yes' ? 100 : 0);
                push(d.skin_to_skin_immediate, 'Imm. Skin-to-Skin'); push(d.skin_to_skin_90min, '90min Skin-to-Skin'); push(d.breastfed_first_hour, 'BF 1st Hour'); push(d.given_other_fluids, 'Other Fluids'); push(d.given_other_fluids_bottle, 'Bottle Feeding');
                push(d.given_vitamin_k, 'Vitamin K'); push(d.given_tetracycline, 'Eye Ointment'); push(d.anything_on_cord, 'Cord Substance'); push(d.rubbed_with_oil, 'Skin Oiling'); push(d.baby_bathed, 'Bathing < 6hrs');
                push(d.polio_zero_dose, 'Polio Vaccine'); push(d.bcg_dose, 'BCG Vaccine'); push(d.baby_weighed, 'Weight Measured'); push(d.baby_temp_measured, 'Temp Measured'); push(d.baby_registered, 'Civil Reg'); push(d.given_discharge_card, 'Discharge Card');
            }
            return acc;
        }, {});
        return Object.keys(visitGroups)
            .map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] }))
            .sort((a,b) => a.visitNumber - b.visitNumber)
            .map(({visitNumber, data}) => {
                const avg = (scores) => { const v = scores.filter(s => s !== null && !isNaN(s)); if(v.length===0)return null; return Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
                const res = { name: `Visit ${visitNumber}` };
                Object.keys(data).forEach(k => res[k] = avg(data[k]));
                return res;
            }).slice(0, 4);
    }, [filteredSubmissions, activeService]);


    const stateKpis = useMemo(() => {
        const kpisHelper = activeService === 'IMNCI' ? imnciKpiHelper : (activeService === 'EENC' ? eencKpiHelper : null);
        if (!kpisHelper) return [];
        const submissionsByState = filteredSubmissions.reduce((acc, sub) => {
            if (sub.service === 'EENC_MOTHERS' || sub.service === 'IMNCI_MOTHERS') return acc;
            const stateKey = sub.state || 'UNKNOWN';
            if (!acc[stateKey]) acc[stateKey] = [];
            acc[stateKey].push(sub);
            return acc;
        }, {});
        return Object.keys(submissionsByState).map(stateKey => {
            const stateName = STATE_LOCALITIES[stateKey]?.ar || stateKey;
            return { stateKey, stateName, ...kpisHelper(submissionsByState[stateKey]) };
        }).sort((a, b) => a.stateName.localeCompare(b.name, 'ar'));
    }, [filteredSubmissions, imnciKpiHelper, eencKpiHelper, activeService, STATE_LOCALITIES]);

    const motherStateKpis = useMemo(() => {
        if (activeService !== 'EENC' && activeService !== 'IMNCI') return [];
        const isEenc = activeService === 'EENC';
        const submissionsByState = filteredSubmissions.reduce((acc, sub) => {
            if (isEenc && sub.service !== 'EENC_MOTHERS') return acc;
            if (!isEenc && sub.service !== 'IMNCI_MOTHERS') return acc;
            const stateKey = sub.state || 'UNKNOWN';
            if (!acc[stateKey]) acc[stateKey] = [];
            acc[stateKey].push(sub);
            return acc;
        }, {});
        const helper = isEenc ? eencMotherKpiHelper : imnciMotherKpiHelper;
        return Object.keys(submissionsByState).map(stateKey => {
            const stateName = STATE_LOCALITIES[stateKey]?.ar || stateKey;
            const kpis = helper(submissionsByState[stateKey]);
            return { stateKey, stateName, ...kpis };
        }).sort((a, b) => a.stateName.localeCompare(b.name, 'ar'));
    }, [filteredSubmissions, eencMotherKpiHelper, imnciMotherKpiHelper, activeService, STATE_LOCALITIES]);

    // --- Constants for Rendering ---
    const serviceTitle = SERVICE_TITLES[activeService] || activeService;
    const isFiltered = activeState || activeLocality || activeFacilityId || activeProject || activeWorkerName || activeWorkerType;
    const scopeTitle = isFiltered ? "(Filtered Data)" : "(All Sudan Data)";

    const volumeChartKeys = [
        { key: 'Completed Visits', title: 'Completed Visits' },
        { key: 'Cases Observed', title: 'Cases Observed' }
    ];

    // IMNCI Constants
    const overallImnciKpiList = [{ title: "Overall Adherence Score", scoreValue: overallKpis.avgOverall }];
    const overallImnciChartKeys = [{ key: 'Overall', title: 'Overall Adherence' }];

    const mainKpiGridList = [{ title: "Assess & Classify", scoreValue: overallKpis.avgAssessment }, { title: "Final Decision", scoreValue: overallKpis.avgDecision }, { title: "Treatment & Counsel", scoreValue: overallKpis.avgTreatment }];
    const mainKpiChartKeys = [{ key: 'Assessment', title: 'Assessment' }, { key: 'Decision', title: 'Decision' }, { key: 'Treatment', title: 'Treatment' }];
    
    const dangerSignsKpiList = [ { title: "Asked/Checked: Cannot Drink/Breastfeed", scoreValue: calculateAverage(overallKpis.skillStats?.['skill_ds_drink'] ? [overallKpis.skillStats['skill_ds_drink'].yes / (overallKpis.skillStats['skill_ds_drink'].yes + overallKpis.skillStats['skill_ds_drink'].no)] : []) }, { title: "Asked/Checked: Vomits Everything", scoreValue: calculateAverage(overallKpis.skillStats?.['skill_ds_vomit'] ? [overallKpis.skillStats['skill_ds_vomit'].yes / (overallKpis.skillStats['skill_ds_vomit'].yes + overallKpis.skillStats['skill_ds_vomit'].no)] : []) }, { title: "Asked/Checked: Convulsions", scoreValue: calculateAverage(overallKpis.skillStats?.['skill_ds_convulsion'] ? [overallKpis.skillStats['skill_ds_convulsion'].yes / (overallKpis.skillStats['skill_ds_convulsion'].yes + overallKpis.skillStats['skill_ds_convulsion'].no)] : []) }, { title: "Checked: Lethargic/Unconscious", scoreValue: calculateAverage(overallKpis.skillStats?.['skill_ds_conscious'] ? [overallKpis.skillStats['skill_ds_conscious'].yes / (overallKpis.skillStats['skill_ds_conscious'].yes + overallKpis.skillStats['skill_ds_conscious'].no)] : []) } ];
    const dangerSignsChartKeys = [{ key: 'DangerSigns', title: 'Danger Signs Score' }];
    
    // Measurement Skills
    const measurementKpiGridList = [{ title: "Weight Measured Correctly", scoreValue: overallKpis.avgHandsOnWeight }, { title: "Temp Measured Correctly", scoreValue: overallKpis.avgHandsOnTemp }, { title: "Height Measured Correctly", scoreValue: overallKpis.avgHandsOnHeight }];
    const measurementKpiChartKeys = [{ key: 'Measurement Skills', title: 'Measurement Skills Average' }];

    // Clinical Symptom Assessments 
    const respRateKpiList = [{ title: " ", scoreValue: overallKpis.avgRespiratoryRateCalculation }];
    const respRateChartKeys = [{ key: 'Resp. Rate', title: 'Resp. Rate' }];

    const dehydrationKpiList = [{ title: " ", scoreValue: overallKpis.avgDehydrationAssessment }];
    const dehydrationChartKeys = [{ key: 'Dehydration', title: 'Dehydration' }];

    // Malnutrition
    const malnutritionSignsKpiList = [
        { title: "MUAC Measured Correctly", scoreValue: overallKpis.avgHandsOnMUAC },
        { title: "Z-Score (WFH) Measured Correctly", scoreValue: overallKpis.avgHandsOnWFH }
    ];
    const malnutritionSignsChartKeys = [
        { key: 'Malnutrition Assessment', title: 'Malnutrition Assessment' }
    ];

    // New Pre-treatment Indicators
    const immunizationKpiList = [{ title: " ", scoreValue: overallKpis.avgImmunization }];
    const immunizationChartKeys = [{ key: 'Immunization', title: 'Immunization' }];

    const vitaminKpiList = [{ title: " ", scoreValue: overallKpis.avgVitaminAssessment }];
    const vitaminChartKeys = [{ key: 'Vitamin Assessment', title: 'Vitamin Assessment' }];

    // Management Adherence 
    const pneuAmoxKpiList = [{ title: " ", scoreValue: overallKpis.avgPneuAmox }];
    const pneuAmoxChartKeys = [{ key: 'Pneumonia Amox', title: 'Amoxicillin' }];

    const diarOrsKpiList = [{ title: " ", scoreValue: overallKpis.avgDiarOrs }];
    const diarOrsChartKeys = [{ key: 'Diarrhea ORS', title: 'ORS' }];

    const diarZincKpiList = [{ title: " ", scoreValue: overallKpis.avgDiarZinc }];
    const diarZincChartKeys = [{ key: 'Diarrhea Zinc', title: 'Zinc' }];

    const malariaCoartemKpiList = [{ title: " ", scoreValue: overallKpis.avgMalariaCoartem }];
    const malariaCoartemChartKeys = [{ key: 'Malaria Coartem', title: 'Coartem (ACT)' }];

    // Counseling & Return
    const returnImmKpiList = [{ title: " ", scoreValue: overallKpis.avgReturnImm }];
    const returnImmChartKeys = [{ key: 'Return Immediately', title: 'Return Immediately' }];

    const returnFuKpiList = [{ title: " ", scoreValue: overallKpis.avgReturnFu }];
    const returnFuChartKeys = [{ key: 'Return Followup', title: 'Return Followup' }];
    
    // NEW: Recording Skills
    const recordingKpiGridList = [
        { title: "Registering Signs", scoreValue: overallKpis.avgRecordSigns },
        { title: "Registering Classifications", scoreValue: overallKpis.avgRecordClass },
        { title: "Registering Treatments", scoreValue: overallKpis.avgRecordTreat }
    ];
    const recordingKpiChartKeys = [
        { key: 'Record Signs', title: 'Signs' },
        { key: 'Record Classifications', title: 'Classifications' },
        { key: 'Record Treatments', title: 'Treatments' }
    ];

    // IMNCI Mother Constants
    const imnciMotherKnowMedKpis = [{ title: "Knows Med Details", scoreValue: motherKpis?.avgKnowMed }, { title: "Knows Treatment Details", scoreValue: motherKpis?.avgKnowTx }, { title: "Knows Return Date", scoreValue: motherKpis?.avgKnowReturn }];
    const imnciMotherKnowMedChartKeys = [{ key: 'M: Knows Meds', title: 'Meds' }, { key: 'M: Knows Tx', title: 'Tx' }, { key: 'M: Knows Return', title: 'Return' }];
    const imnciMotherKnowOrsKpis = [{ title: "Knows ORS Prep", scoreValue: motherKpis?.avgKnowOrsPrep }, { title: "Knows Home Fluids", scoreValue: motherKpis?.avgKnowFluids }, { title: "Knows 4 Rules", scoreValue: motherKpis?.avgKnow4Rules }];
    const imnciMotherKnowOrsChartKeys = [{ key: 'M: Knows ORS', title: 'ORS' }, { key: 'M: Knows Fluids', title: 'Fluids' }, { key: 'M: Knows 4 Rules', title: 'Rules' }];
    const imnciMotherSatKpis = [{ title: "Satisfaction: Time Spent", scoreValue: motherKpis?.avgSatTime }, { title: "Satisfaction: Communication", scoreValue: motherKpis?.avgSatComm }, { title: "Satisfaction: Learned Something", scoreValue: motherKpis?.avgSatLearn }];
    const imnciMotherSatChartKeys = [{ key: 'M: Time Spent', title: 'Time' }, { key: 'M: Comm Style', title: 'Comm' }, { key: 'M: What Learned', title: 'Learned' }];

    // EENC Constants
    const eencMainKpiGridList = [{ title: "Overall EENC Adherence", scoreValue: overallKpis.avgOverall }, { title: "Preparation Score", scoreValue: overallKpis.avgPreparation }, { title: "Drying & Stimulation Score", scoreValue: overallKpis.avgDrying }, { title: "Breathing Baby Mgmt Score", scoreValue: overallKpis.avgNormalBreathing }, { title: "Resuscitation Score", scoreValue: overallKpis.avgResuscitation }];
    const eencMainKpiChartKeys = [{ key: 'Overall', title: 'Overall' }, { key: 'Preparation', title: 'Preparation' }, { key: 'Drying', title: 'Drying' }, { key: 'Breathing Mgmt', title: 'Breathing Mgmt' }];
    const eencInfectionKpis = [{ title: "Hand Washing (1st)", scoreValue: overallKpis.avgInfWash1 }, { title: "Hand Washing (2nd)", scoreValue: overallKpis.avgInfWash2 }, { title: "Sterile Gloves Used", scoreValue: overallKpis.avgInfGloves }];
    const eencInfectionChartKeys = [{ key: 'Hand Washing (1st)', title: 'Hand Wash 1' }, { key: 'Hand Washing (2nd)', title: 'Hand Wash 2' }, { key: 'Sterile Gloves', title: 'Gloves' }];
    const eencPrepKpis = [{ title: "Towels Prepared", scoreValue: overallKpis.avgPrepTowel }, { title: "Resus Equipment Ready", scoreValue: overallKpis.avgPrepEquip }, { title: "Ambu Bag Checked", scoreValue: overallKpis.avgPrepAmbu }];
    const eencPrepChartKeys = [{ key: 'Towels Ready', title: 'Towels' }, { key: 'Resus Equip Ready', title: 'Equip Ready' }, { key: 'Ambu Check', title: 'Ambu Check' }];
    const eencCareKpis = [{ title: "Drying within 5 sec", scoreValue: overallKpis.avgCareDry }, { title: "Immediate Skin-to-Skin", scoreValue: overallKpis.avgCareSkin }, { title: "Dry Towel & Hat Used", scoreValue: overallKpis.avgCareCover }];
    const eencCareChartKeys = [{ key: 'Drying < 5s', title: 'Drying < 5s' }, { key: 'Skin-to-Skin', title: 'Skin-to-Skin' }, { key: 'Dry Towel/Hat', title: 'Towel/Hat' }];
    const eencCordKpis = [{ title: "Hygienic Cord Check", scoreValue: overallKpis.avgCordHygiene }, { title: "Delayed Clamping", scoreValue: overallKpis.avgCordDelay }, { title: "Correct Clamping", scoreValue: overallKpis.avgCordClamp }];
    const eencCordChartKeys = [{ key: 'Hygienic Check', title: 'Hygienic Check' }, { key: 'Delayed Clamp', title: 'Delayed Clamp' }, { key: 'Correct Clamp', title: 'Correct Clamp' }];
    const eencBreastfeedingKpis = [{ title: "Early Breastfeeding Advice", scoreValue: overallKpis.avgBfAdvice }];
    const eencBreastfeedingChartKeys = [{ key: 'Early BF Advice', title: 'BF Advice' }];
    const eencResusExecKpis = [{ title: "Head Positioning", scoreValue: overallKpis.avgResusHead }, { title: "Good Mask Seal", scoreValue: overallKpis.avgResusMask }, { title: "Chest Rise (1st min)", scoreValue: overallKpis.avgResusChest }, { title: "Adequate Rate (30-50)", scoreValue: overallKpis.avgResusRate }];
    const eencResusExecChartKeys = [{ key: 'Head Pos', title: 'Head Pos' }, { key: 'Mask Seal', title: 'Mask Seal' }, { key: 'Chest Rise', title: 'Chest Rise' }, { key: 'Rate 30-50', title: 'Rate' }];
    const eencMotherSkinKpis = [{ title: "Immediate Skin-to-Skin", scoreValue: motherKpis?.avgSkinImm }, { title: "Uninterrupted 90min S2S", scoreValue: motherKpis?.avgSkin90min }];
    const eencMotherSkinChartKeys = [{ key: 'Imm. Skin-to-Skin', title: 'Imm. S2S' }, { key: '90min Skin-to-Skin', title: '90min S2S' }];
    const eencMotherBfKpis = [{ title: "Feeding in 1st Hour", scoreValue: motherKpis?.avgBf1hr }, { title: "Given Substitutes (Yes)", scoreValue: motherKpis?.avgBfSub }, { title: "Feeding with Bottle (Yes)", scoreValue: motherKpis?.avgBfBottle }];
    const eencMotherBfChartKeys = [{ key: 'BF 1st Hour', title: '1st Hr' }, { key: 'Other Fluids', title: 'Subs' }, { key: 'Bottle Feeding', title: 'Bottle' }];
    const eencMotherCareKpis = [{ title: "Vitamin K Given", scoreValue: motherKpis?.avgVitK }, { title: "Eye Ointment Given", scoreValue: motherKpis?.avgEyeOint }, { title: "Cord Substance Applied", scoreValue: motherKpis?.avgCordSubs }];
    const eencMotherCareChartKeys = [{ key: 'Vitamin K', title: 'Vit K' }, { key: 'Eye Ointment', title: 'Eye' }, { key: 'Cord Substance', title: 'Cord Sub' }];
    const eencMotherHygieneKpis = [{ title: "Skin Oiling (Yes)", scoreValue: motherKpis?.avgSkinOil }, { title: "Bathing < 6hrs (Yes)", scoreValue: motherKpis?.avgBath6hr }];
    const eencMotherHygieneChartKeys = [{ key: 'Skin Oiling', title: 'Oiling' }, { key: 'Bathing < 6hrs', title: 'Bath <6h' }];
    const eencMotherVacKpis = [{ title: "Polio Vaccine (Zero)", scoreValue: motherKpis?.avgPolio }, { title: "BCG Vaccine", scoreValue: motherKpis?.avgBcg }];
    const eencMotherVacChartKeys = [{ key: 'Polio Vaccine', title: 'Polio' }, { key: 'BCG Vaccine', title: 'BCG' }];
    const eencMotherMeasureKpis = [{ title: "Weight Measured", scoreValue: motherKpis?.avgWeight }, { title: "Temp Measured", scoreValue: motherKpis?.avgTemp }];
    const eencMotherMeasureChartKeys = [{ key: 'Weight Measured', title: 'Weight' }, { key: 'Temp Measured', title: 'Temp' }];
    const eencMotherRegKpis = [{ title: "Civil Registration", scoreValue: motherKpis?.avgCivReg }, { title: "Discharge Card Given", scoreValue: motherKpis?.avgDisCard }];
    const eencMotherRegChartKeys = [{ key: 'Civil Reg', title: 'Civil Reg' }, { key: 'Discharge Card', title: 'Card' }];

    // --- Loading State Check ---
    if (isLoading || !allSubmissions || !visitReports || !STATE_LOCALITIES) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50/50 p-6">
                <svg className="animate-spin h-14 w-14 text-sky-600 mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight animate-pulse mb-2">Loading Dashboard Data...</h3>
                <p className="text-sm font-semibold text-slate-500">Please wait while we fetch the latest records.</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-slate-50/50 min-h-screen" dir="ltr">             
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-extrabold text-slate-800 text-left tracking-tight">
                    Mentorship Dashboard: {serviceTitle} <span className="text-sky-600 text-xl font-semibold">{scopeTitle}</span>
                </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-8 p-5 bg-white rounded-2xl shadow-md border border-black">
                <FilterSelect label="State" value={activeState} onChange={(v) => { onStateChange(v); onLocalityChange(""); onFacilityIdChange(""); onProjectChange(""); onWorkerNameChange(""); onWorkerTypeChange?.(""); }} options={stateOptions} defaultOption="All States" />
                <FilterSelect label="Locality" value={activeLocality} onChange={(v) => { onLocalityChange(v); onFacilityIdChange(""); onProjectChange(""); onWorkerNameChange(""); onWorkerTypeChange?.(""); }} options={localityOptions} disabled={!activeState} defaultOption="All Localities" />
                <FilterSelect label="Health Facility" value={activeFacilityId} onChange={(v) => { onFacilityIdChange(v); onProjectChange(""); onWorkerNameChange(""); onWorkerTypeChange?.(""); }} options={facilityOptions} disabled={!activeLocality} defaultOption="All Facilities" />
                <FilterSelect label="Project / Partner" value={activeProject} onChange={(v) => { onProjectChange(v); onWorkerNameChange(""); onWorkerTypeChange?.(""); }} options={projectOptions} defaultOption="All Projects" />
                <FilterSelect label="Job Title" value={activeWorkerType || ""} onChange={(v) => { if(onWorkerTypeChange) onWorkerTypeChange(v); onWorkerNameChange(""); }} options={workerTypeOptions || []} defaultOption="All Titles" />
                <FilterSelect label="Health Worker Name" value={activeWorkerName} onChange={onWorkerNameChange} options={workerOptions} disabled={!activeFacilityId} defaultOption="All Workers" />
            </div>
            
            {activeService === 'IMNCI' && (
                <>
                    <div className="flex flex-wrap gap-2 mb-8 bg-slate-200 p-1.5 rounded-xl border border-black w-fit">
                        <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeImnciTab === 'skills' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveImnciTab('skills')}>Skills Observation (Provider)</button>
                        <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeImnciTab === 'mothers' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveImnciTab('mothers')}>Mother Interviews</button>
                        <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeImnciTab === 'visit_reports' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveImnciTab('visit_reports')}>Visit Reports (Facility)</button>
                    </div>

                    {activeImnciTab === 'skills' && (
                        <div className="animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <KpiCard title="Total Completed Visits" value={overallKpis.totalVisits} unit={overallKpis.totalHealthWorkers > 0 ? `(${(overallKpis.totalVisits / overallKpis.totalHealthWorkers).toFixed(1)} visits per HW)` : ''} />
                                <KpiCard title="Total Health Workers Visited" value={overallKpis.totalHealthWorkers} />
                                <KpiCard title="Total Cases Observed" value={overallKpis.totalCasesObserved} unit={overallKpis.totalVisits > 0 ? `(${ (overallKpis.totalCasesObserved / overallKpis.totalVisits).toFixed(1) } cases per visit)` : ''} />
                            </div>

                            <div className="mb-8">
                                <VolumeLineChart title="Visits & Cases by Visit Number" chartData={volumeChartData} kpiKeys={volumeChartKeys} />
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <KpiCardWithChart 
                                    title="Overall IMNCI Adherence" 
                                    kpis={overallImnciKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={overallImnciChartKeys} 
                                    cols={1} 
                                />
                                <KpiCardWithChart 
                                    title="Core Components Adherence" 
                                    kpis={mainKpiGridList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={mainKpiChartKeys} 
                                    cols={3} 
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <DetailedKpiCard title="Danger Signs Assessment" overallScore={overallKpis.avgDangerSigns} kpis={dangerSignsKpiList} />
                                <KpiLineChart title="Adherence Over Time (Danger Signs)" chartData={imnciChartData} kpiKeys={dangerSignsChartKeys} />
                            </div>
                            
                            {/* Measurement Skills Moved Here */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <DetailedKpiCard 
                                    title="Measurement Skills (Average)" 
                                    overallScore={calculateAverage([overallKpis.avgHandsOnWeight, overallKpis.avgHandsOnTemp, overallKpis.avgHandsOnHeight])} 
                                    kpis={measurementKpiGridList} 
                                />
                                <KpiLineChart title="Adherence Over Time (Measurement Skills)" chartData={imnciChartData} kpiKeys={measurementKpiChartKeys} />
                            </div>

                            {/* Correct Symptom Assessments */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <KpiCardWithChart 
                                    title="Correct Respiratory Rate Measurement" 
                                    kpis={respRateKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={respRateChartKeys} 
                                    cols={1} 
                                />
                                <KpiCardWithChart 
                                    title="Correct Dehydration assessment" 
                                    kpis={dehydrationKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={dehydrationChartKeys} 
                                    cols={1} 
                                />
                            </div>

                            {/* Malnutrition and Anemia Signs Separated and Moved Here */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <DetailedKpiCard 
                                    title="Correct Malnutrition Assessment" 
                                    overallScore={calculateAverage([overallKpis.avgHandsOnMUAC, overallKpis.avgHandsOnWFH])} 
                                    kpis={malnutritionSignsKpiList} 
                                />
                                <KpiLineChart 
                                    title="Adherence Over Time (Malnutrition Signs)" 
                                    chartData={imnciChartData} 
                                    kpiKeys={malnutritionSignsChartKeys} 
                                />
                            </div>

                            {/* Immunization & Vitamin Assessment (Before Pneumonia) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <KpiCardWithChart 
                                    title="Percentage of cases assessed for Immunization correctly" 
                                    kpis={immunizationKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={immunizationChartKeys} 
                                    cols={1} 
                                />
                                <KpiCardWithChart 
                                    title="Percentage of cases assessed for vitamin supplementation correctly" 
                                    kpis={vitaminKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={vitaminChartKeys} 
                                    cols={1} 
                                />
                            </div>

                            {/* Management Adherence - Row 1 (Pneumonia & ORS) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <KpiCardWithChart 
                                    title="Percentage of Pneumonia cases Treated correctly with Amoxicillin" 
                                    kpis={pneuAmoxKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={pneuAmoxChartKeys} 
                                    cols={1} 
                                />
                                <KpiCardWithChart 
                                    title="Percentage of Diarrhea cases Treated with ORS" 
                                    kpis={diarOrsKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={diarOrsChartKeys} 
                                    cols={1} 
                                />
                            </div>

                            {/* Management Adherence - Row 2 (Zinc & Malaria Coartem) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <KpiCardWithChart 
                                    title="Percentage of Diarrhea cases Treated with Zinc" 
                                    kpis={diarZincKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={diarZincChartKeys} 
                                    cols={1} 
                                />
                                <KpiCardWithChart 
                                    title="Percentage of malaria cases treated with Coartum" 
                                    kpis={malariaCoartemKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={malariaCoartemChartKeys} 
                                    cols={1} 
                                />
                            </div>

                            {/* Counseling & Return Advice */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <KpiCardWithChart 
                                    title="Percentage of cases advised when to return immediately" 
                                    kpis={returnImmKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={returnImmChartKeys} 
                                    cols={1} 
                                />
                                <KpiCardWithChart 
                                    title="Percentage of cases advised to return for follow up" 
                                    kpis={returnFuKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={returnFuChartKeys} 
                                    cols={1} 
                                />
                            </div>
                            
                            {/* NEW: Recording Form Use Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <DetailedKpiCard 
                                    title="Recording Form Use" 
                                    overallScore={calculateAverage([overallKpis.avgRecordSigns, overallKpis.avgRecordClass, overallKpis.avgRecordTreat])} 
                                    kpis={recordingKpiGridList} 
                                />
                                <KpiLineChart 
                                    title="Recording Form Use Over Time" 
                                    chartData={imnciChartData} 
                                    kpiKeys={recordingKpiChartKeys} 
                                />
                            </div>
                            
                            <h3 className="text-xl font-extrabold text-slate-800 mb-5 mt-10 text-left tracking-wide">Overall Adherence by State {scopeTitle}</h3>
                            <div className="mb-10"><KpiBarChart title="Overall IMNCI Adherence by State" chartData={stateKpis} /></div>
                            
                            <h3 className="text-xl font-extrabold text-slate-800 mb-5 text-left tracking-wide">Detailed Skill Performance {scopeTitle}</h3>
                            <div className="mb-10"><CompactSkillsTable overallKpis={overallKpis} /></div>
                        </div>
                    )}

                    {activeImnciTab === 'mothers' && (
                        <div className="animate-fade-in">
                            <div className="grid grid-cols-1 gap-6 mb-8"><KpiCard title="Total Mother Interviews" value={motherKpis?.totalMothers || 0} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <DetailedKpiCard title="Mother Knowledge: Treatment" overallScore={calculateAverage([motherKpis?.avgKnowMed, motherKpis?.avgKnowTx])} kpis={imnciMotherKnowMedKpis} />
                                <KpiLineChart title="Knowledge (Meds) Over Time" chartData={imnciMotherChartData} kpiKeys={imnciMotherKnowMedChartKeys} />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <DetailedKpiCard title="Mother Knowledge: ORS & Fluids" overallScore={calculateAverage([motherKpis?.avgKnowOrsPrep, motherKpis?.avgKnowFluids])} kpis={imnciMotherKnowOrsKpis} />
                                <KpiLineChart title="Knowledge (ORS) Over Time" chartData={imnciMotherChartData} kpiKeys={imnciMotherKnowOrsChartKeys} />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <DetailedKpiCard title="Mother Satisfaction" overallScore={calculateAverage([motherKpis?.avgSatTime, motherKpis?.avgSatComm])} kpis={imnciMotherSatKpis} />
                                <KpiLineChart title="Satisfaction Over Time" chartData={imnciMotherChartData} kpiKeys={imnciMotherSatChartKeys} />
                            </div>
                            
                            <h3 className="text-xl font-extrabold text-slate-800 mb-5 mt-10 text-left tracking-wide">Overall Mother Interview Scores by State {scopeTitle}</h3>
                            <div className="mb-10"><KpiBarChart title="Average Mother Knowledge/Satisfaction by State" chartData={motherStateKpis} /></div>
                            
                            <h3 className="text-xl font-extrabold text-slate-800 mb-5 text-left tracking-wide">Detailed Mother Interview Performance {scopeTitle}</h3>
                            <div className="mb-10"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="IMNCI" /></div>
                        </div>
                    )}

                    {activeImnciTab === 'visit_reports' && visitReportStats && (
                        <div className="animate-fade-in">
                            <div className="grid grid-cols-1 gap-6 mb-8">
                                <KpiCard title="Total Visit Reports" value={visitReportStats.totalVisits} />
                            </div>

                            <div className="mb-8 bg-white rounded-2xl shadow-md border border-black overflow-hidden">
                                <h4 className="text-lg font-extrabold text-slate-800 p-5 border-b border-black bg-slate-100">Visit Breakdown & Skills Trained by Facility</h4>
                                <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider">
                                        <tr>
                                            <th className="px-5 py-4 border-b border-black">Facility</th>
                                            <th className="px-5 py-4 border-b border-black border-l border-black text-center bg-sky-100">Total Visits</th>
                                            {visitReportStats.distinctSkillKeys.map(skillKey => (
                                                <th key={skillKey} className="px-3 py-4 border-b border-l border-black text-center break-words whitespace-normal text-[11px] max-w-[120px]">
                                                    {IMNCI_SKILLS_LABELS[skillKey] || skillKey}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visitReportStats.facilityTableData.map(row => (
                                            <tr key={row.id} className="hover:bg-sky-50 transition-colors border-b border-black">
                                                <td className="px-5 py-3 font-semibold text-slate-800">{row.facilityName}</td>
                                                <td className="px-5 py-3 border-l border-black text-center font-bold bg-sky-50 text-sky-800">{row.visitCount}</td>
                                                {visitReportStats.distinctSkillKeys.map(skillKey => (
                                                    <td key={skillKey} className="px-3 py-3 border-l border-black text-center text-slate-700 font-medium">
                                                        {row.skills[skillKey] || 0}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        {visitReportStats.facilityTableData.length === 0 && (
                                            <tr><td colSpan={2 + visitReportStats.distinctSkillKeys.length} className="p-8 text-center text-slate-500 font-bold">No visits found for current filter.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>

                            <div className="mb-8">
                                <KpiBarChart title="Total Visits by State" chartData={visitReportStats.stateChartData} dataKey="count" />
                            </div>

                            <div className="mb-8 bg-white rounded-2xl shadow-md border border-black overflow-hidden">
                                <h4 className="text-lg font-extrabold text-slate-800 p-5 border-b border-black bg-slate-100">Facility Problems & Solutions (Combined)</h4>
                                <div className="overflow-x-auto max-h-[600px]">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider sticky top-0 z-10 shadow-sm border-b border-black">
                                            <tr>
                                                <th className="px-4 py-4 border-r border-black w-[15%]">Facility & Date</th>
                                                <th className="px-4 py-4 border-r border-black w-[20%]">Problem / Challenge</th>
                                                <th className="px-4 py-4 border-r border-black w-[20%]">Immediate Solution</th>
                                                <th className="px-4 py-4 border-r border-black w-[10%] text-center">Imm. Status</th>
                                                <th className="px-4 py-4 border-r border-black w-[20%]">Long-term Solution</th>
                                                <th className="px-4 py-4 border-r border-black w-[10%] text-center">LT Status</th>
                                                <th className="px-4 py-4 w-[5%]">Resp.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visitReportStats.problemsList.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-sky-50 transition-colors border-b border-black">
                                                    <td className="px-4 py-3 border-r border-black align-top">
                                                        <div className="font-bold text-slate-800 mb-1">{item.facility}</div>
                                                        <div className="text-xs font-semibold text-slate-600 bg-slate-100 inline-block px-2 py-0.5 rounded border border-black">{item.date}</div>
                                                    </td>
                                                    <td className="px-4 py-3 border-r border-black align-top text-xs text-rose-700 whitespace-pre-wrap font-medium">{item.problem}</td>
                                                    
                                                    <td className="px-4 py-3 border-r border-black align-top text-xs text-emerald-700 whitespace-pre-wrap font-medium">{item.immediate}</td>
                                                    <td className="px-4 py-3 border-r border-black align-top text-center">
                                                        {renderStatusCell(item.immediate_status, item.reportId, item.challengeId, 'immediate_status')}
                                                    </td>

                                                    <td className="px-4 py-3 border-r border-black align-top text-xs text-sky-700 whitespace-pre-wrap font-medium">{item.longterm}</td>
                                                    <td className="px-4 py-3 border-r border-black align-top text-center">
                                                        {renderStatusCell(item.long_term_status, item.reportId, item.challengeId, 'long_term_status')}
                                                    </td>

                                                    <td className="px-4 py-3 align-top text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.person}</td>
                                                </tr>
                                            ))}
                                            {visitReportStats.problemsList.length === 0 && (
                                                <tr><td colSpan="7" className="p-8 text-center text-slate-500 font-bold">No problems recorded.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {activeService === 'EENC' && (
                <>
                     <div className="flex flex-wrap gap-2 mb-8 bg-slate-200 p-1.5 rounded-xl border border-black w-fit">
                        <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeEencTab === 'skills' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveEencTab('skills')}>Skills Observation (Provider)</button>
                        <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeEencTab === 'mothers' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveEencTab('mothers')}>Mother Interviews</button>
                        <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeEencTab === 'visit_reports' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveEencTab('visit_reports')}>Visit Reports (Facility)</button>
                    </div>

                    {activeEencTab === 'skills' && (
                        <div className="animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <KpiCard title="Total Completed EENC Visits" value={overallKpis.totalVisits} unit={overallKpis.totalHealthWorkers > 0 ? `(${(overallKpis.totalVisits / overallKpis.totalHealthWorkers).toFixed(1)} visits per HW)` : ''} />
                                <KpiCard title="Total Health Workers Visited" value={overallKpis.totalHealthWorkers} />
                                <KpiCard title="Total Cases Observed" value={overallKpis.totalCasesObserved} unit={overallKpis.totalVisits > 0 ? `(${ (overallKpis.totalCasesObserved / overallKpis.totalVisits).toFixed(1) } cases per visit)` : ''} />
                            </div>

                            <div className="mb-8">
                                <VolumeLineChart title="Visits & Cases by Visit Number" chartData={volumeChartData} kpiKeys={volumeChartKeys} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><KpiGridCard title="Overall EENC Adherence Scores (Average)" kpis={eencMainKpiGridList} cols={3} /><KpiLineChart title="EENC Adherence Over Time (Main KPIs)" chartData={eencChartData} kpiKeys={eencMainKpiChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 1: Infection Control (All Cases)" overallScore={calculateAverage([overallKpis.avgInfWash1, overallKpis.avgInfWash2, overallKpis.avgInfGloves])} kpis={eencInfectionKpis} /><KpiLineChart title="KPI 1 Over Time: Infection Control" chartData={eencChartData} kpiKeys={eencInfectionChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 2: Resuscitation Preparedness (All Cases)" overallScore={overallKpis.avgPreparation} kpis={eencPrepKpis} /><KpiLineChart title="KPI 2 Over Time: Preparedness" chartData={eencChartData} kpiKeys={eencPrepChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 3: Early Care (All Cases)" overallScore={overallKpis.avgDrying} kpis={eencCareKpis} /><KpiLineChart title="KPI 3 Over Time: Early Care" chartData={eencChartData} kpiKeys={eencCareChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 4: Cord Management (Breathing Babies)" overallScore={calculateAverage([overallKpis.avgCordHygiene, overallKpis.avgCordDelay, overallKpis.avgCordClamp])} kpis={eencCordKpis} /><KpiLineChart title="KPI 4 Over Time: Cord Mgmt" chartData={eencChartData} kpiKeys={eencCordChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 5: Breastfeeding (Breathing Babies)" overallScore={overallKpis.avgBfAdvice} kpis={eencBreastfeedingKpis} /><KpiLineChart title="KPI 5 Over Time: Breastfeeding" chartData={eencChartData} kpiKeys={eencBreastfeedingChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 6: Resuscitation Execution (Non-Breathing)" overallScore={overallKpis.avgResuscitation} kpis={eencResusExecKpis} /><KpiLineChart title="KPI 6 Over Time: Resuscitation" chartData={eencChartData} kpiKeys={eencResusExecChartKeys} /></div>
                            <h3 className="text-xl font-bold text-slate-800 mb-5 mt-10 text-left tracking-wide">Overall EENC Adherence by State {scopeTitle}</h3>
                            <div className="mb-10"><KpiBarChart title="Overall EENC Adherence by State" chartData={stateKpis} /></div>
                            <h3 className="text-xl font-bold text-slate-800 mb-5 text-left tracking-wide">Detailed EENC Skill Performance {scopeTitle}</h3>
                            <div className="mb-10"><EENCCompactSkillsTable overallKpis={overallKpis} /></div>
                        </div>
                    )}

                     {activeEencTab === 'mothers' && (
                         <div className="animate-fade-in">
                            <div className="grid grid-cols-1 gap-6 mb-8"><KpiCard title="Total Mother Interviews" value={motherKpis?.totalMothers || 0} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Skin-to-Skin Care" overallScore={calculateAverage([motherKpis?.avgSkinImm, motherKpis?.avgSkin90min])} kpis={eencMotherSkinKpis} /><KpiLineChart title="Skin-to-Skin Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherSkinChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Breastfeeding" overallScore={calculateAverage([motherKpis?.avgBf1hr])} kpis={eencMotherBfKpis} /><KpiLineChart title="Breastfeeding Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherBfChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Skin & Cord Care" overallScore={calculateAverage([motherKpis?.avgVitK, motherKpis?.avgEyeOint, motherKpis?.avgCordSubs])} kpis={eencMotherCareKpis} /><KpiLineChart title="Care Indicators Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherCareChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Oiling & Bathing" overallScore={calculateAverage([motherKpis?.avgSkinOil, motherKpis?.avgBath6hr])} kpis={eencMotherHygieneKpis} /><KpiLineChart title="Hygiene Indicators Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherHygieneChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Vaccination" overallScore={calculateAverage([motherKpis?.avgPolio, motherKpis?.avgBcg])} kpis={eencMotherVacKpis} /><KpiLineChart title="Vaccination Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherVacChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Measurements" overallScore={calculateAverage([motherKpis?.avgWeight, motherKpis?.avgTemp])} kpis={eencMotherMeasureKpis} /><KpiLineChart title="Measurements Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherMeasureChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Registration" overallScore={calculateAverage([motherKpis?.avgCivReg, motherKpis?.avgDisCard])} kpis={eencMotherRegKpis} /><KpiLineChart title="Registration Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherRegChartKeys} /></div>
                            <h3 className="text-xl font-bold text-slate-800 mb-5 mt-10 text-left tracking-wide">Overall Mother Interview Indicators by State {scopeTitle}</h3>
                            <div className="mb-10"><KpiBarChart title="Average Indicator Presence by State" chartData={motherStateKpis} /></div>
                            <h3 className="text-xl font-bold text-slate-800 mb-5 text-left tracking-wide">Detailed Mother Interview Performance {scopeTitle}</h3>
                            <div className="mb-10"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="EENC" /></div>
                         </div>
                     )}

                    {activeEencTab === 'visit_reports' && visitReportStats && (
                        <div className="animate-fade-in">
                            <div className="grid grid-cols-1 gap-6 mb-8">
                                <KpiCard title="Total Visit Reports" value={visitReportStats.totalVisits} />
                            </div>

                            <div className="mb-8 bg-white rounded-2xl shadow-md border border-black overflow-hidden">
                                <h4 className="text-lg font-extrabold text-slate-800 p-5 border-b border-black bg-slate-100">Visit Breakdown & Skills Trained by Facility</h4>
                                <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider">
                                        <tr>
                                            <th className="px-5 py-4 border-b border-black">Facility</th>
                                            <th className="px-5 py-4 border-b border-black border-l border-black text-center bg-sky-100">Total Visits</th>
                                            {visitReportStats.distinctSkillKeys.map(skillKey => (
                                                <th key={skillKey} className="px-3 py-4 border-b border-l border-black text-center break-words whitespace-normal text-[11px] max-w-[120px]">
                                                    {EENC_SKILLS_LABELS[skillKey] || skillKey}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visitReportStats.facilityTableData.map(row => (
                                            <tr key={row.id} className="hover:bg-sky-50 transition-colors border-b border-black">
                                                <td className="px-5 py-3 font-semibold text-slate-800">{row.facilityName}</td>
                                                <td className="px-5 py-3 border-l border-black text-center font-bold bg-sky-50 text-sky-800">{row.visitCount}</td>
                                                {visitReportStats.distinctSkillKeys.map(skillKey => (
                                                    <td key={skillKey} className="px-3 py-3 border-l border-black text-center text-slate-700 font-medium">
                                                        {row.skills[skillKey] || 0}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        {visitReportStats.facilityTableData.length === 0 && (
                                            <tr><td colSpan={2 + visitReportStats.distinctSkillKeys.length} className="p-8 text-center text-slate-500 font-bold">No visits found for current filter.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>

                            <div className="mb-8">
                                <KpiBarChart title="Total Visits by State" chartData={visitReportStats.stateChartData} dataKey="count" />
                            </div>

                            <div className="mb-8 bg-white rounded-2xl shadow-md border border-black overflow-hidden">
                                <h4 className="text-lg font-extrabold text-slate-800 p-5 border-b border-black bg-slate-100">Facility Problems & Solutions (Combined)</h4>
                                <div className="overflow-x-auto max-h-[600px]">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider sticky top-0 z-10 shadow-sm border-b border-black">
                                            <tr>
                                                <th className="px-4 py-4 border-r border-black w-[15%]">Facility & Date</th>
                                                <th className="px-4 py-4 border-r border-black w-[20%]">Problem / Challenge</th>
                                                <th className="px-4 py-4 border-r border-black w-[20%]">Immediate Solution</th>
                                                <th className="px-4 py-4 border-r border-black w-[10%] text-center">Imm. Status</th>
                                                <th className="px-4 py-4 border-r border-black w-[20%]">Long-term Solution</th>
                                                <th className="px-4 py-4 border-r border-black w-[10%] text-center">LT Status</th>
                                                <th className="px-4 py-4 w-[5%]">Resp.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visitReportStats.problemsList.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-sky-50 transition-colors border-b border-black">
                                                    <td className="px-4 py-3 border-r border-black align-top">
                                                        <div className="font-bold text-slate-800 mb-1">{item.facility}</div>
                                                        <div className="text-xs font-semibold text-slate-600 bg-slate-100 inline-block px-2 py-0.5 rounded border border-black">{item.date}</div>
                                                    </td>
                                                    <td className="px-4 py-3 border-r border-black align-top text-xs text-rose-700 whitespace-pre-wrap font-medium">{item.problem}</td>
                                                    
                                                    <td className="px-4 py-3 border-r border-black align-top text-xs text-emerald-700 whitespace-pre-wrap font-medium">{item.immediate}</td>
                                                    <td className="px-4 py-3 border-r border-black align-top text-center">
                                                        {renderStatusCell(item.immediate_status, item.reportId, item.challengeId, 'immediate_status')}
                                                    </td>

                                                    <td className="px-4 py-3 border-r border-black align-top text-xs text-sky-700 whitespace-pre-wrap font-medium">{item.longterm}</td>
                                                    <td className="px-4 py-3 border-r border-black align-top text-center">
                                                        {renderStatusCell(item.long_term_status, item.reportId, item.challengeId, 'long_term_status')}
                                                    </td>

                                                    <td className="px-4 py-3 align-top text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.person}</td>
                                                </tr>
                                            ))}
                                            {visitReportStats.problemsList.length === 0 && (
                                                <tr><td colSpan="7" className="p-8 text-center text-slate-500 font-bold">No problems recorded.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MentorshipDashboard;