// MentorshipDashboardShared.jsx
import React, { useState, useRef, useMemo } from 'react';
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

import { Spinner } from '../CommonComponents'; // Adjust path if needed

import { 
    IMNCI_FORM_STRUCTURE 
} from './IMNCSkillsAssessmentForm.jsx'; // Adjust path if needed

import { 
    PREPARATION_ITEMS, 
    DRYING_STIMULATION_ITEMS, 
    NORMAL_BREATHING_ITEMS, 
    RESUSCITATION_ITEMS 
} from './EENCSkillsAssessmentForm.jsx'; // Adjust path if needed

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

// --- Dictionaries for English Translations ---
export const IMNCI_ENGLISH_LABELS = {
    'تقييم مهارات التقييم والتصنيف': 'Assessment & Classification Skills',
    'القرار النهائي': 'Final Decision',
    'تقييم مهارات العلاج والنصح': 'Treatment & Counseling Skills',
    'استخدام الاستمارة': 'Recording Skills',
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

export const EENC_SKILL_KEYS_TO_ENGLISH = {
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

export const IMNCI_MOTHER_SURVEY_ITEMS_EN = [
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

export const EENC_MOTHER_SURVEY_ITEMS_EN = [
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

// Helper functions locally scoped
const calculateAverage = (scores) => {
    if (!scores || !Array.isArray(scores)) return null;
    const validScores = scores.filter(s => isFinite(s) && !isNaN(s) && s !== null);
    if (validScores.length === 0) return null;
    const sum = validScores.reduce((a, b) => a + b, 0);
    return sum / validScores.length;
};

// --- Shared UI Components ---
export const CopyImageButton = ({ targetRef, title }) => {
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

export const ScoreText = ({ value, showPercentage = true }) => {
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

export const KpiCard = ({ title, value, unit = '', scoreValue = null }) => (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-black border-t-4 border-t-sky-600 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-center items-center h-full">
        <h4 className="text-xs sm:text-sm font-bold text-slate-600 mb-3 text-center uppercase tracking-wider" title={title}>{title}</h4>
        <div className="flex items-baseline justify-center gap-1.5 mt-auto">
            {scoreValue !== null ? <ScoreText value={scoreValue} /> : <span className="text-4xl font-black text-slate-800 tracking-tight">{value}</span>}
            {unit && <span className="text-sm font-bold text-slate-500">{unit}</span>}
        </div>
    </div>
);

export const KpiGridItem = ({ title, scoreValue }) => (
    <div className="bg-slate-50 p-4 rounded-xl border border-black text-center shadow-sm hover:border-sky-500 hover:bg-sky-50 transition-all flex flex-col justify-between h-full group">
        <h5 className="text-xs font-bold text-slate-700 mb-3 leading-snug group-hover:text-sky-800" title={title}>{title}</h5>
        <div className="mt-auto bg-white inline-block mx-auto px-4 py-1.5 rounded-lg border border-black shadow-sm">
            <ScoreText value={scoreValue} />
        </div>
    </div>
);

export const KpiGridCard = ({ title, kpis, cols = 2 }) => {
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

export const DetailedKpiCard = ({ title, overallScore, kpis }) => {
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

export const FilterSelect = ({ label, value, onChange, options, disabled = false, defaultOption }) => (
    <div>
        <label htmlFor={label} className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">{label}</label>
        <select id={label} name={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="block w-full pl-4 pr-10 py-3 text-sm font-bold border border-black focus:outline-none focus:ring-sky-500 focus:border-sky-500 rounded-xl shadow-sm bg-white hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <option value="">{defaultOption}</option>
            {options.map(option => (<option key={option.key || option} value={option.key || option}>{option.name || option}</option>))}
        </select>
    </div>
);

// --- Charts ---
export const getSharedChartOptions = () => ({
    responsive: true, 
    maintainAspectRatio: false,
    animation: { duration: 1000, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: { 
        legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 12, family: "'Inter', sans-serif", weight: '600' }, color: '#334155' } }, 
        tooltip: { 
            backgroundColor: 'rgba(15, 23, 42, 0.95)', titleFont: { size: 13, family: "'Inter', sans-serif", weight: 'bold' }, bodyFont: { size: 12, family: "'Inter', sans-serif" },
            padding: 12, cornerRadius: 8, boxPadding: 6,
            callbacks: { label: (context) => ` ${context.dataset.label}: ${context.parsed.y}%` }
        } 
    },
    scales: { 
        y: { beginAtZero: true, max: 100, grid: { color: '#e2e8f0', drawBorder: false }, ticks: { callback: (value) => `${value}%`, color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' }, padding: 8 } }, 
        x: { grid: { display: false, drawBorder: false }, ticks: { maxTicksLimit: 10, autoSkip: true, color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' }, padding: 8 } } 
    }
});

export const getLineDatasetStyle = (title, key, colors, data) => ({
    label: title, data: data, borderColor: colors[key] || '#64748b', backgroundColor: (colors[key] || '#64748b') + '26',
    fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#ffffff', pointBorderColor: colors[key] || '#64748b', pointBorderWidth: 2, borderWidth: 2.5, 
});

export const VolumeLineChart = ({ title, chartData, kpiKeys }) => {
    const cardRef = useRef(null);
    const colors = { 'Cases Observed': '#3b82f6', 'Completed Visits': '#10b981' };
    
    const options = {
        responsive: true, maintainAspectRatio: false, animation: { duration: 1000, easing: 'easeOutQuart' }, interaction: { mode: 'index', intersect: false },
        plugins: { 
            legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 12, family: "'Inter', sans-serif", weight: '600' }, color: '#334155' } }, 
            tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', titleFont: { size: 13, family: "'Inter', sans-serif", weight: 'bold' }, bodyFont: { size: 12, family: "'Inter', sans-serif" }, padding: 12, cornerRadius: 8, boxPadding: 6, callbacks: { label: (context) => ` ${context.dataset.label}: ${context.parsed.y}` } } 
        },
        scales: { 
            y: { beginAtZero: true, grid: { color: '#e2e8f0', drawBorder: false }, ticks: { precision: 0, color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' }, padding: 8 } }, 
            x: { grid: { display: false, drawBorder: false }, ticks: { maxTicksLimit: 10, autoSkip: true, color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' }, padding: 8 } } 
        }
    };

    const data = { labels: chartData.map(d => d.name), datasets: kpiKeys.map(kpi => getLineDatasetStyle(kpi.title, kpi.key, colors, chartData.map(d => d[kpi.key]))) };
    return (
        <div ref={cardRef} className="bg-white p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-base font-extrabold text-slate-800 mb-5 text-center tracking-wide pr-8">{title}</h4>
            <div className="relative flex-grow min-h-[250px]">{chartData.length > 0 ? <Line options={options} data={data} /> : <div className="flex items-center justify-center h-full text-slate-500 font-semibold">No data available.</div>}</div>
        </div>
    );
};

export const KpiLineChart = ({ title, chartData, kpiKeys }) => {
    const cardRef = useRef(null);
    const colors = {
        'Overall': '#0ea5e9', 'Assessment': '#10b981', 'Decision': '#f59e0b', 'Treatment': '#ef4444',
        'Weight': '#06b6d4', 'Temp': '#3b82f6', 'Height': '#8b5cf6', 'Resp. Rate': '#14b8a6',
        'Dehydration': '#ec4899', 'Malaria RDT': '#d946ef', 'Ear Check': '#f97316',
        'Pneumonia Amox': '#a855f7', 'Diarrhea ORS': '#3b82f6', 'Diarrhea Zinc': '#eab308', 'Anemia Iron': '#dc2626',
        'MUAC': '#0891b2', 'WFH': '#0284c7', 'Pallor': '#78716c', 'DangerSigns': '#f97316',
        'Malnutrition Assessment': '#0284c7', 'Measurement Skills': '#8b5cf6',
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
    
    const data = { labels: chartData.map(d => d.name), datasets: kpiKeys.map(kpi => getLineDatasetStyle(kpi.title, kpi.key, colors, chartData.map(d => d[kpi.key]))) };
    return (
        <div ref={cardRef} className="bg-white p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-base font-extrabold text-slate-800 mb-5 text-center tracking-wide pr-8">{title}</h4>
            <div className="relative flex-grow min-h-[250px]">{chartData.length > 0 ? <Line options={getSharedChartOptions()} data={data} /> : <div className="flex items-center justify-center h-full text-slate-500 font-semibold">No data available.</div>}</div>
        </div>
    );
};

export const KpiCardWithChart = ({ title, kpis, chartData, kpiKeys, cols = 2 }) => {
    const cardRef = useRef(null);
    const colors = { 
        'Overall': '#0ea5e9', 'Assessment': '#10b981', 'Decision': '#f59e0b', 'Treatment': '#ef4444', 
        'Pallor': '#78716c', 'Anemia Mgmt': '#dc2626', 'Resp. Rate': '#14b8a6', 'Dehydration': '#ec4899', 
        'Malaria RDT': '#d946ef', 'Ear Check': '#f97316', 'Pneumonia Amox': '#a855f7', 'Diarrhea ORS': '#3b82f6', 'Diarrhea Zinc': '#eab308', 'Anemia Iron': '#dc2626',
        'Immunization': '#10b981', 'Vitamin Assessment': '#f59e0b', 'Malaria Coartem': '#d946ef', 'Return Immediately': '#ef4444', 'Return Followup': '#3b82f6',
        'Record Signs': '#06b6d4', 'Record Classifications': '#3b82f6', 'Record Treatments': '#8b5cf6'
    };
    const data = { labels: chartData.map(d => d.name), datasets: kpiKeys.map(kpi => getLineDatasetStyle(kpi.title, kpi.key, colors, chartData.map(d => d[kpi.key]))) };

    return (
        <div ref={cardRef} className="bg-white p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 flex flex-col h-full relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-base font-extrabold text-slate-800 mb-5 text-center tracking-wide pr-8" title={title}>{title}</h4>
            <div className={`grid grid-cols-${cols} gap-4 mb-6`}>{kpis.map(kpi => (<KpiGridItem key={kpi.title} title={kpi.title} scoreValue={kpi.scoreValue} />))}</div>
            <div className="relative flex-grow min-h-[200px]">{chartData.length > 0 ? <Line options={getSharedChartOptions()} data={data} /> : <div className="flex items-center justify-center h-full text-slate-500 font-semibold">No data available.</div>}</div>
        </div>
    );
};

export const KpiBarChart = ({ title, chartData, dataKey = 'avgOverall' }) => {
    const cardRef = useRef(null);
    const getBarColor = (value) => { if (value >= 80) return '#10b981'; if (value >= 50) return '#f59e0b'; return '#ef4444'; };
    const getHoverColor = (value) => { if (value >= 80) return '#059669'; if (value >= 50) return '#d97706'; return '#dc2626'; };

    const data = { 
        labels: chartData.map(d => d.stateName), 
        datasets: [{ 
            label: 'Value', data: chartData.map(d => d[dataKey] ? Math.round(d[dataKey] * (dataKey === 'count' ? 1 : 100)) : null), 
            backgroundColor: chartData.map(d => dataKey === 'count' ? '#3b82f6' : getBarColor(d[dataKey] ? d[dataKey] * 100 : 0)), 
            hoverBackgroundColor: chartData.map(d => dataKey === 'count' ? '#2563eb' : getHoverColor(d[dataKey] ? d[dataKey] * 100 : 0)), 
            borderRadius: 6, borderSkipped: false, barPercentage: 0.6,
        }] 
    };
    
    const options = { 
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 1000, easing: 'easeOutQuart' },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', titleFont: { size: 13, family: "'Inter', sans-serif" }, bodyFont: { size: 12, family: "'Inter', sans-serif", weight: 'bold' }, padding: 10, cornerRadius: 8, callbacks: { label: (c) => `${c.dataset.label}: ${c.raw}${dataKey === 'count' ? '' : '%'}` } } }, 
        scales: { 
            x: { beginAtZero: true, max: dataKey === 'count' ? undefined : 100, grid: { color: '#e2e8f0', drawBorder: false }, ticks: { callback: (v) => `${v}${dataKey === 'count' ? '' : '%'}`, color: '#475569', font: { family: "'Inter', sans-serif", weight: '500' } } }, 
            y: { grid: { display: false, drawBorder: false }, ticks: { autoSkip: false, color: '#334155', font: { size: 12, family: "'Inter', sans-serif", weight: 'bold' } } } 
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

// --- Tables ---
export const CompactSkillRow = ({ label, stats }) => {
    const yes = stats?.yes || 0; const no = stats?.no || 0; const total = yes + no; const percentage = total > 0 ? (yes / total) : null;
    return (
        <tr className="bg-white hover:bg-sky-50 transition-colors duration-150 group border-b border-black">
            <td className="p-3 text-xs font-bold text-slate-700 w-3/5 text-left group-hover:text-sky-800">{label}</td>
            <td className="p-3 text-xs font-bold text-slate-600 border-l border-black w-1/5 text-center">{yes} / {total}</td>
            <td className="p-3 border-l border-black w-1/5 text-center bg-slate-50/50 group-hover:bg-sky-100/50"><ScoreText value={percentage} /></td>
        </tr>
    );
};

export const CompactSkillsTable = ({ overallKpis }) => {
    const skillStats = overallKpis?.skillStats;
    if (!overallKpis || !skillStats || Object.keys(skillStats).length === 0) return (<div className="bg-white p-8 rounded-2xl shadow-md border border-black text-center text-slate-500 font-bold">No detailed skill data available.</div>);
    
    const getAggregatedScore = (skillKeys) => {
        if (!skillKeys || skillKeys.length === 0) return null;
        let totalYes = 0; let total = 0;
        skillKeys.forEach(key => { const stats = skillStats[key]; if (stats) { totalYes += (stats.yes || 0); total += (stats.yes || 0) + (stats.no || 0); } });
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
                                                    <tr className="bg-sky-600 text-white border-b border-black"><td className="p-2.5 text-xs font-bold text-left" colSpan="2">{symptomGroupNameEN}</td><td className="p-2.5 text-center border-l border-black">{symptomScore !== null && (<div className="bg-white/10 backdrop-blur-md rounded-md px-2 py-0.5 inline-block border border-black"><ScoreText value={symptomScore} showPercentage={true} /></div>)}</td></tr>
                                                    {skillsToRender.map(skillKey => (<CompactSkillRow key={skillKey} label={IMNCI_ENGLISH_LABELS[skillKey] || skillKey} stats={skillStats[skillKey]} />))}
                                                </React.Fragment>
                                            ); 
                                        }); 
                                    }
                                    const skillsToRender = subgroup.skills?.map(s => s.key) || []; const subgroupScore = getAggregatedScore(skillsToRender); const subgroupTitleEN = IMNCI_ENGLISH_LABELS[subgroup.subgroupTitle] || subgroup.subgroupTitle;
                                    return (
                                        <React.Fragment key={subgroup.subgroupTitle}>
                                            <tr className="bg-sky-600 text-white border-b border-black"><td className="p-2.5 text-xs font-bold text-left" colSpan="2">{subgroupTitleEN}</td><td className="p-2.5 text-center border-l border-black">{subgroupScore !== null && (<div className="bg-white/10 backdrop-blur-md rounded-md px-2 py-0.5 inline-block border border-black"><ScoreText value={subgroupScore} showPercentage={true}/></div>)}</td></tr>
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

export const EENCCompactSkillRow = ({ label, stats }) => {
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

export const EENCCompactSkillsTable = ({ overallKpis }) => {
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
                                <tr className="bg-slate-800 text-white border-b border-black"><td className="p-3 text-sm font-bold text-left tracking-wide" colSpan="2">{section.title}</td><td className="p-3 text-center border-l border-black">{section.score !== null && (<div className="bg-white/10 backdrop-blur-md rounded-lg px-3 py-1 inline-block border border-black shadow-inner"><ScoreText value={section.score} showPercentage={true}/></div>)}</td></tr>
                                {section.items.map(item => (<EENCCompactSkillRow key={item.key} label={EENC_SKILL_KEYS_TO_ENGLISH[item.key] || item.label} stats={skillStats[item.key]} />))}
                            </React.Fragment>
                        ); 
                    })}
                </tbody>
            </table>
        </div>
    );
};

export const MothersCompactSkillsTable = ({ motherKpis, serviceType }) => {
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

export const renderTrendArrows = (val, type) => {
    const numVal = parseFloat(val);
    if (isNaN(numVal)) return null;

    if (type === 'visits') {
        if (numVal < 2) return <span className="text-red-500 text-[10px] ml-1" title="Critically below ideal (4)">▼▼▼</span>;
        if (numVal < 3) return <span className="text-red-500 text-[10px] ml-1" title="Below ideal (4)">▼▼</span>;
        if (numVal < 4) return <span className="text-red-500 text-[10px] ml-1" title="Slightly below ideal (4)">▼</span>;
        if (numVal > 4) return <span className="text-emerald-500 text-[10px] ml-1" title="Above ideal (4)">▲</span>;
    } else if (type === 'cases') {
        if (numVal < 2) return <span className="text-red-500 text-[10px] ml-1" title="Critically below ideal (3)">▼▼</span>;
        if (numVal < 3) return <span className="text-red-500 text-[10px] ml-1" title="Below ideal (3)">▼</span>;
        if (numVal > 5) return <span className="text-emerald-500 text-[10px] ml-1" title="Exceptionally above ideal (3)">▲▲▲</span>;
        if (numVal > 4) return <span className="text-emerald-500 text-[10px] ml-1" title="Well above ideal (3)">▲▲</span>;
        if (numVal > 3) return <span className="text-emerald-500 text-[10px] ml-1" title="Above ideal (3)">▲</span>;
    }
    return null;
};

export const GeographicVolumeTable = ({ title, data, locationLabel }) => {
    if (!data || data.length === 0) return null;
    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden mb-10">
            <div className="p-5 border-b border-black bg-slate-100 flex justify-between items-center"><h4 className="text-lg font-extrabold text-slate-800">{title}</h4></div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider">
                        <tr>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold">{locationLabel}</th>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold text-center bg-sky-50">Total Completed Visits</th>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold text-center bg-sky-50">Visits per HW</th>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold text-center">Total HWs Visited</th>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold text-center bg-emerald-50">Total Cases Observed</th>
                            <th className="px-5 py-4 border-b border-black font-extrabold text-center bg-emerald-50">Cases per Visit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => {
                            const visitsPerHw = row.totalHealthWorkers > 0 ? (row.totalVisits / row.totalHealthWorkers).toFixed(1) : '0';
                            const casesPerVisit = row.totalVisits > 0 ? (row.totalCasesObserved / row.totalVisits).toFixed(1) : '0';
                            return (
                                <tr key={idx} className="hover:bg-sky-50 transition-colors border-b border-black">
                                    <td className="px-5 py-3 border-r border-black font-bold text-slate-800">{row.stateName}</td>
                                    <td className="px-5 py-3 border-r border-black text-center font-bold text-sky-800 bg-sky-50/50">{row.totalVisits}</td>
                                    <td className="px-5 py-3 border-r border-black text-center text-slate-600 bg-sky-50/50"><div className="flex items-center justify-center"><span>{visitsPerHw}</span>{renderTrendArrows(visitsPerHw, 'visits')}</div></td>
                                    <td className="px-5 py-3 border-r border-black text-center font-bold text-slate-700">{row.totalHealthWorkers}</td>
                                    <td className="px-5 py-3 border-r border-black text-center font-bold text-emerald-800 bg-emerald-50/50">{row.totalCasesObserved}</td>
                                    <td className="px-5 py-3 text-center text-slate-600 bg-emerald-50/50"><div className="flex items-center justify-center"><span>{casesPerVisit}</span>{renderTrendArrows(casesPerVisit, 'cases')}</div></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const SummaryKpiTable = ({ title, kpiDefinitions, overallKpis, kpisByWorkerType }) => {
    if (!overallKpis || !kpisByWorkerType || kpisByWorkerType.length === 0) return null;
    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden mb-10">
            <div className="p-5 border-b border-black bg-slate-100 flex justify-between items-center"><h4 className="text-lg font-extrabold text-slate-800">{title}</h4></div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider">
                        <tr>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold min-w-[200px]">KPI Name</th>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold text-center bg-sky-100 whitespace-nowrap">Overall Score</th>
                            {kpisByWorkerType.map(group => (<th key={group.workerType} className="px-5 py-4 border-b border-r border-black font-extrabold text-center whitespace-nowrap">{group.workerType}</th>))}
                        </tr>
                    </thead>
                    <tbody>
                        {kpiDefinitions.map((kpi, idx) => (
                            <tr key={idx} className="hover:bg-sky-50 transition-colors border-b border-black">
                                <td className="px-5 py-3 border-r border-black font-bold text-slate-800">{kpi.label}</td>
                                <td className="px-5 py-3 border-r border-black text-center bg-sky-50/50"><ScoreText value={kpi.getValue(overallKpis)} /></td>
                                {kpisByWorkerType.map(group => (<td key={group.workerType} className="px-5 py-3 border-r border-black text-center"><ScoreText value={kpi.getValue(group.kpis)} /></td>))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const MentorPerformanceTable = ({ title, submissions, visitReports, activeService }) => {
    const data = useMemo(() => {
        if (!submissions) return [];
        const mentorMap = {}; 
        submissions.forEach(sub => {
            const mentor = sub.supervisorDisplay || sub.supervisorEmail || 'Unknown';
            if (!mentorMap[mentor]) mentorMap[mentor] = { mentorName: mentor, healthWorkers: new Set(), visits: new Set(), totalCases: 0, motherForms: 0, visitReports: 0 };
            if (sub.service === activeService) {
                mentorMap[mentor].totalCases += 1;
                if (sub.staff) mentorMap[mentor].healthWorkers.add(sub.staff);
                if (sub.facilityId && sub.staff && sub.date) mentorMap[mentor].visits.add(`${sub.facilityId}_${sub.staff}_${sub.date}`);
            } else if (sub.service === `${activeService}_MOTHERS`) {
                mentorMap[mentor].motherForms += 1;
            }
        });

        if (visitReports) {
            visitReports.forEach(rep => {
                if (rep.service === activeService) {
                    const mentor = rep.mentorDisplay || rep.mentorEmail || 'Unknown';
                    if (mentorMap[mentor]) mentorMap[mentor].visitReports += 1;
                    else mentorMap[mentor] = { mentorName: mentor, healthWorkers: new Set(), visits: new Set(), totalCases: 0, motherForms: 0, visitReports: 1 };
                }
            });
        }

        return Object.values(mentorMap).map(m => {
            const hwCount = m.healthWorkers.size; const visitCount = m.visits.size; const cases = m.totalCases; const mothers = m.motherForms; const reports = m.visitReports;
            return {
                mentorName: m.mentorName, hwCount, visitCount, visitsPerHw: hwCount > 0 ? (visitCount / hwCount).toFixed(1) : '0',
                cases, casesPerVisit: visitCount > 0 ? (cases / visitCount).toFixed(1) : '0', mothers, mothersPerVisit: visitCount > 0 ? (mothers / visitCount).toFixed(1) : '0',
                reports, reportCompliance: visitCount > 0 ? Math.round((reports / visitCount) * 100) : 0
            };
        }).sort((a, b) => a.mentorName.localeCompare(b.mentorName));
    }, [submissions, visitReports, activeService]);

    if (!data || data.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden mb-10">
            <div className="p-5 border-b border-black bg-slate-100 flex justify-between items-center"><h4 className="text-lg font-extrabold text-slate-800">{title}</h4></div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider">
                        <tr>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold">Mentor Name</th>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold text-center">Health Workers</th>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold text-center bg-sky-50">Total Visits<div className="text-[10px] text-slate-500 normal-case mt-1 tracking-normal">Visits per HW</div></th>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold text-center">Total Cases<div className="text-[10px] text-slate-500 normal-case mt-1 tracking-normal">Cases per Visit</div></th>
                            <th className="px-5 py-4 border-b border-r border-black font-extrabold text-center bg-emerald-50">Mother Forms<div className="text-[10px] text-slate-500 normal-case mt-1 tracking-normal">Forms per Visit</div></th>
                            <th className="px-5 py-4 border-b border-black font-extrabold text-center bg-purple-50">Visit Reports<div className="text-[10px] text-slate-500 normal-case mt-1 tracking-normal">% of Completed Visits</div></th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-sky-50 transition-colors border-b border-black">
                                <td className="px-5 py-3 border-r border-black font-bold text-slate-800">{row.mentorName}</td>
                                <td className="px-5 py-3 border-r border-black text-center font-bold text-slate-700">{row.hwCount}</td>
                                <td className="px-5 py-3 border-r border-black text-center bg-sky-50/50"><div className="font-bold text-sky-800 text-base">{row.visitCount}</div><div className="text-xs text-slate-500 font-semibold">{row.visitsPerHw} visits/hw</div></td>
                                <td className="px-5 py-3 border-r border-black text-center"><div className="font-bold text-slate-700 text-base">{row.cases}</div><div className="text-xs text-slate-500 font-semibold">{row.casesPerVisit} cases/visit</div></td>
                                <td className="px-5 py-3 border-r border-black text-center bg-emerald-50/50"><div className="font-bold text-emerald-800 text-base">{row.mothers}</div><div className="text-xs text-slate-500 font-semibold">{row.mothersPerVisit} forms/visit</div></td>
                                <td className="px-5 py-3 text-center bg-purple-50/50"><div className="font-bold text-purple-800 text-base">{row.reports}</div><div className={`text-xs font-bold ${row.reportCompliance >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>{row.reportCompliance}% submitted</div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};