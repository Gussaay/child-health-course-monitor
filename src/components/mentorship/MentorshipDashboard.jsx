// MentorshipDashboard.jsx
import React, { useMemo, useCallback, useState, useEffect } from 'react';
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
} from 'chart.js';

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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const SERVICE_TITLES = {
    'IMNCI': 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)',
    'EENC': 'Early Essential Newborn Care (EENC)',
    'ETAT': 'Emergency Triage, Assessment and Treatment (ETAT)',
    'IPC': 'Infection Prevention and Control in Neonatal Units (IPC)'
};

// --- Dictionaries for Skill Labels ---
const IMNCI_SKILLS_LABELS = {
    skill_weight: "قياس الوزن",
    skill_height: "قياس الطول",
    skill_temp: "قياس الحرارة",
    skill_rr: "قياس معدل التنفس",
    skill_muac: "قياس محيط منتصف الذراع",
    skill_wfh: "قياس الانحراف المعياري",
    skill_edema: "تقييم الورم",
    skill_danger_signs: "علامات الخطورة",
    skill_chartbook: "استخدام كتيب اللوحات",
    skill_counseling_card: "استخدام كرت النصح",
    skill_immunization_referral: "سواقط التطعيم",
};

const EENC_SKILLS_LABELS = {
    skill_pre_handwash: "غسل الايدي",
    skill_pre_equip: "تجهيز المعدات",
    skill_drying: "التجفيف",
    skill_skin_to_skin: "جلد بجلد",
    skill_suction: "الشفط",
    skill_cord_pulse_check: "نبض الحبل السري",
    skill_clamp_placement: "وضع المشبك",
    skill_transfer: "نقل الطفل",
    skill_airway: "فتح مجرى الهواء",
    skill_ambubag_placement: "وضع الامبوباق",
    skill_ambubag_use: "استخدام الامبوباق",
    skill_ventilation_rate: "معدل التهوية",
    skill_correction_steps: "التدخلات التصحيحية",
};

// --- Components (ScoreText, KpiCard, etc.) ---
const ScoreText = ({ value, showPercentage = true }) => {
    let colorClass = 'text-gray-700';
    let text = 'N/A';
    if (value !== null && !isNaN(value) && isFinite(value)) {
        const percentage = Math.round(value * 100);
        if (percentage >= 80) colorClass = 'text-green-600';
        else if (percentage >= 50) colorClass = 'text-yellow-600';
        else colorClass = 'text-red-600';
        text = showPercentage ? `${percentage}%` : percentage.toString();
    }
    return (<span className={`font-bold text-sm ${colorClass}`}>{text}</span>);
};

const KpiCard = ({ title, value, unit = '', scoreValue = null }) => (
    <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 text-center">
        <h4 className="text-sm font-medium text-gray-500 mb-2 h-10 flex items-center justify-center" title={title}>{title}</h4>
        <div className="flex items-baseline justify-center gap-1">
            {scoreValue !== null ? <ScoreText value={scoreValue} /> : <span className="text-3xl font-bold text-sky-800">{value}</span>}
            {unit && <span className="text-lg font-medium text-gray-600">{unit}</span>}
        </div>
    </div>
);

const KpiGridItem = ({ title, scoreValue }) => (
    <div className="bg-gray-50 p-3 rounded-lg border text-center shadow-inner">
        <h5 className="text-xs font-medium text-gray-500 mb-1 h-8 flex items-center justify-center" title={title}>{title}</h5>
        <ScoreText value={scoreValue} />
    </div>
);

const KpiGridCard = ({ title, kpis, cols = 2 }) => (
    <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
        <h4 className="text-base font-bold text-sky-800 mb-3 text-center" title={title}>{title}</h4>
        <div className={`grid grid-cols-${cols} gap-3`}>{kpis.map(kpi => (<KpiGridItem key={kpi.title} title={kpi.title} scoreValue={kpi.scoreValue} />))}</div>
    </div>
);

const DetailedKpiCard = ({ title, overallScore, kpis }) => (
    <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 h-full">
        <div className="flex justify-between items-center mb-3">
            <h4 className="text-base font-bold text-sky-800 text-left" title={title}>{title}</h4>
            {overallScore !== null && (<div className="bg-gray-100 rounded-md px-2 py-0.5"><ScoreText value={overallScore} /></div>)}
        </div>
        <div className="space-y-2">
            {kpis.map(kpi => (
                <div key={kpi.title} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border shadow-inner">
                    <h5 className="text-xs font-medium text-gray-600 text-left">{kpi.title}</h5>
                    <ScoreText value={kpi.scoreValue} />
                </div>
            ))}
        </div>
    </div>
);

const KpiLineChart = ({ title, chartData, kpiKeys }) => {
    const colors = {
        'Overall': '#0ea5e9', 'Assessment': '#10b981', 'Decision': '#f59e0b', 'Treatment': '#ef4444',
        // IMNCI Colors
        'Weight': '#06b6d4', 'Temp': '#3b82f6', 'Height': '#8b5cf6', 'Resp. Rate': '#14b8a6',
        'Dehydration': '#ec4899', 'Malaria RDT': '#d946ef', 'Ear Check': '#f97316',
        'Pneumonia Amox': '#a855f7', 'Diarrhea ORS': '#3b82f6', 'Diarrhea Zinc': '#eab308', 'Anemia Iron': '#dc2626',
        'MUAC': '#0891b2', 'WFH': '#0284c7', 'Pallor': '#78716c',
        'DangerSigns': '#f97316',
        // EENC Colors
        'Preparation': '#10b981', 'Drying': '#3b82f6', 'Breathing Mgmt': '#f59e0b', 'Resuscitation': '#ef4444',
        'Hand Washing (1st)': '#0d9488', 'Hand Washing (2nd)': '#14b8a6', 'Sterile Gloves': '#2dd4bf',
        'Towels Ready': '#7c3aed', 'Resus Equip Ready': '#8b5cf6', 'Ambu Check': '#a78bfa',
        'Drying < 5s': '#ea580c', 'Skin-to-Skin': '#f97316', 'Dry Towel/Hat': '#fb923c',
        'Hygienic Check': '#be123c', 'Delayed Clamp': '#e11d48', 'Correct Clamp': '#f43f5e',
        'Early BF Advice': '#d946ef', 'Head Pos': '#b91c1c', 'Mask Seal': '#dc2626', 'Chest Rise': '#ef4444', 'Rate 30-50': '#f87171',
        // EENC Mother Colors
        'Imm. Skin-to-Skin': '#f97316', '90min Skin-to-Skin': '#fdba74', 'BF 1st Hour': '#ec4899', 'Other Fluids': '#f43f5e', 
        'Bottle Feeding': '#be123c', 'Vitamin K': '#8b5cf6', 'Eye Ointment': '#a78bfa', 'Cord Substance': '#d946ef',
        'Skin Oiling': '#eab308', 'Bathing < 6hrs': '#f59e0b', 'Polio Vaccine': '#10b981', 'BCG Vaccine': '#34d399',
        'Weight Measured': '#06b6d4', 'Temp Measured': '#22d3ee', 'Civil Reg': '#3b82f6', 'Discharge Card': '#6366f1',
        // IMNCI Mother Colors
        'M: Knows Meds': '#4f46e5', 'M: Knows ORS': '#3b82f6', 'M: Knows Tx': '#0ea5e9', 'M: Knows 4 Rules': '#06b6d4',
        'M: Knows Return': '#14b8a6', 'M: Knows Fluids': '#10b981', 'M: Time Spent': '#f59e0b', 'M: Assess Method': '#f97316',
        'M: Tx Given': '#ef4444', 'M: Comm Style': '#ec4899', 'M: What Learned': '#d946ef', 'M: Drug Avail': '#8b5cf6'
    };
    const data = {
        labels: chartData.map(d => d.name),
        datasets: kpiKeys.map(kpi => ({
            label: kpi.title, data: chartData.map(d => d[kpi.key]),
            borderColor: colors[kpi.key] || '#6b7280', backgroundColor: (colors[kpi.key] || '#6b7280') + '33',
            fill: false, tension: 0.1, pointRadius: 2, borderWidth: 2,
        })),
    };
    const options = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, fontSize: 10 } }, tooltip: { mode: 'index', intersect: false } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } }, x: { ticks: { maxTicksLimit: 10, autoSkip: true } } },
    };
    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 h-full">
            <h4 className="text-base font-bold text-sky-800 mb-3 text-center">{title}</h4>
            <div className="relative h-[280px]">{chartData.length > 0 ? <Line options={options} data={data} /> : <div className="flex items-center justify-center h-full text-gray-500">No data available.</div>}</div>
        </div>
    );
};

const KpiCardWithChart = ({ title, kpis, chartData, kpiKeys, cols = 2 }) => {
    const colors = { 
        'Overall': '#0ea5e9', 'Assessment': '#10b981', 'Decision': '#f59e0b', 'Treatment': '#ef4444', 
        'Pallor': '#78716c',
        'Resp. Rate': '#14b8a6', 'Dehydration': '#ec4899', 
        'Malaria RDT': '#d946ef', 'Ear Check': '#f97316',
        'Pneumonia Amox': '#a855f7', 'Diarrhea ORS': '#3b82f6', 'Diarrhea Zinc': '#eab308', 'Anemia Iron': '#dc2626'
    };
    const data = { labels: chartData.map(d => d.name), datasets: kpiKeys.map(kpi => ({ label: kpi.title, data: chartData.map(d => d[kpi.key]), borderColor: colors[kpi.key] || '#6b7280', backgroundColor: (colors[kpi.key] || '#6b7280') + '33', fill: false, tension: 0.1, pointRadius: 1, borderWidth: 2 })) };
    const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, fontSize: 10 } }, tooltip: { mode: 'index', intersect: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }, x: { ticks: { maxTicksLimit: 10, autoSkip: true } } } };
    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 flex flex-col h-full">
            <h4 className="text-base font-bold text-sky-800 mb-3 text-center" title={title}>{title}</h4>
            <div className={`grid grid-cols-${cols} gap-3 mb-4`}>{kpis.map(kpi => (<KpiGridItem key={kpi.title} title={kpi.title} scoreValue={kpi.scoreValue} />))}</div>
            <div className="relative flex-grow min-h-[200px]">{chartData.length > 0 ? <Line options={options} data={data} /> : <div className="flex items-center justify-center h-full text-gray-500">No data available.</div>}</div>
        </div>
    );
};

const KpiBarChart = ({ title, chartData, dataKey = 'avgOverall' }) => {
    const getBarColor = (value) => { if (value >= 80) return '#10b981'; if (value >= 50) return '#f59e0b'; if (value < 50) return '#ef4444'; return '#6b7280'; };
    const data = { 
        labels: chartData.map(d => d.stateName), 
        datasets: [{ 
            label: 'Value', 
            data: chartData.map(d => d[dataKey] ? Math.round(d[dataKey] * (dataKey === 'count' ? 1 : 100)) : null), 
            backgroundColor: chartData.map(d => dataKey === 'count' ? '#3b82f6' : getBarColor(d[dataKey] ? d[dataKey] * 100 : 0)), 
            borderColor: '#ffffff', borderWidth: 1 
        }] 
    };
    const options = { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw}${dataKey === 'count' ? '' : '%'}` } } }, scales: { x: { beginAtZero: true, max: dataKey === 'count' ? undefined : 100, ticks: { callback: (v) => `${v}${dataKey === 'count' ? '' : '%'}` } }, y: { ticks: { autoSkip: false, font: { size: 10 } } } } };
    const chartHeight = Math.max(280, chartData.length * 25);
    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
            <h4 className="text-base font-bold text-sky-800 mb-3 text-center">{title}</h4>
            <div className="relative" style={{ height: `${chartHeight}px` }}>{chartData.length > 0 ? <Bar options={options} data={data} /> : <div className="flex items-center justify-center h-full text-gray-500">No data available.</div>}</div>
        </div>
    );
};

const CompactSkillRow = ({ label, stats }) => {
    const yes = stats?.yes || 0; const no = stats?.no || 0; const total = yes + no; const percentage = total > 0 ? (yes / total) : null;
    return (
        <tr className="bg-white hover:bg-gray-50">
            <td className="p-1.5 text-xs font-medium text-gray-700 border border-gray-300 w-3/5">{label}</td>
            <td className="p-1.5 text-xs font-semibold text-gray-800 border border-gray-300 w-1/5 text-center">{yes} / {total}</td>
            <td className="p-1.5 border border-gray-300 w-1/5 text-center"><ScoreText value={percentage} /></td>
        </tr>
    );
};

const CompactSkillsTable = ({ overallKpis }) => {
    const skillStats = overallKpis?.skillStats;
    if (!overallKpis || !skillStats || Object.keys(skillStats).length === 0) return (<div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 text-center text-gray-500">No detailed skill data available.</div>);
    
    const subgroupScoreMap = { vitalSigns: overallKpis.avgVitalSigns, dangerSigns: overallKpis.avgDangerSigns, mainSymptoms: overallKpis.avgMainSymptoms, malnutrition: overallKpis.avgMalnutrition, anemia: overallKpis.avgAnemia, immunization: overallKpis.avgImmunization, otherProblems: overallKpis.avgOtherProblems, symptom_cough: overallKpis.avgSymptomCough, symptom_diarrhea: overallKpis.avgSymptomDiarrhea, symptom_fever: overallKpis.avgSymptomFever, symptom_ear: overallKpis.avgSymptomEar, ref_treatment: overallKpis.avgReferralManagement, pneu_treatment: overallKpis.avgPneumoniaManagement, diar_treatment: overallKpis.avgDiarrheaManagement, mal_treatment: overallKpis.avgMalariaManagement, nut_treatment: overallKpis.avgMalnutritionManagement, anemia_treatment: overallKpis.avgAnemiaManagement, dyst_treatment: overallKpis.avgDystTreatment, ear_treatment: overallKpis.avgEarTreatment, fu_treatment: overallKpis.avgFuTreatment };
    const SKILL_LABEL_MAP = { 'skill_ask_cough': 'هل سأل عن وجود الكحة أو ضيق التنفس', 'skill_check_rr': 'هل قاس معدل التنفس بصورة صحيحة', 'skill_classify_cough': 'هل صنف الكحة بصورة صحيحة', 'skill_ask_diarrhea': 'هل سأل عن وجود الاسهال', 'skill_check_dehydration': 'هل قيم فقدان السوائل بصورة صحيحة', 'skill_classify_diarrhea': 'هل صنف الاسهال بصورة صحيحة', 'skill_ask_fever': 'هل سأل عن وجود الحمى', 'skill_check_rdt': 'هل أجرى فحص الملاريا السريع بصورة صحيحة', 'skill_classify_fever': 'هل صنف الحمى بصورة صحيحة', 'skill_ask_ear': 'هل سأل عن وجود مشكلة في الأذن', 'skill_check_ear': 'هل فحص الفحص ورم مؤلم خلف الأذن', 'skill_classify_ear': 'هل صنف مشكلة الأذن بصورة صحيحة' };
    
    return (
        <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200" dir="rtl">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10"><tr className="bg-gray-50"><th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-3/5 text-right">المهارة</th><th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">العدد (نعم / الإجمالي)</th><th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">النسبة</th></tr></thead>
                <tbody>
                    {IMNCI_FORM_STRUCTURE.map(group => {
                        let groupAggregateScore = null; 
                        
                        // --- Mapping Logic ---
                        if (group.group.includes('التقييم والتصنيف')) groupAggregateScore = overallKpis.avgAssessment; 
                        else if (group.isDecisionSection) groupAggregateScore = overallKpis.avgDecision; 
                        else if (group.group.includes('العلاج والنصح')) groupAggregateScore = overallKpis.avgTreatment;
                        // Added Fixes:
                        else if (group.group.includes('القياسات')) groupAggregateScore = overallKpis.avgMeasurementSkills;
                        else if (group.group.includes('الخطورة')) groupAggregateScore = overallKpis.avgDangerSigns;

                        return (
                            <React.Fragment key={group.group}>
                                <tr className="bg-sky-900 text-white"><td className="p-1 text-sm font-bold text-right border border-gray-300" colSpan="2">{group.group}</td><td className="p-1 border border-gray-300 text-center">{groupAggregateScore !== null && (<div className="bg-white rounded-md px-2 py-0.5 inline-block"><ScoreText value={groupAggregateScore} /></div>)}</td></tr>
                                {group.subgroups?.map(subgroup => {
                                    if (subgroup.isSymptomGroupContainer) { return subgroup.symptomGroups.map(symptomGroup => { const symptomKey = symptomGroup.mainSkill.scoreKey; const symptomScore = subgroupScoreMap[symptomKey]; let skillsToRender = []; if (symptomKey === 'symptom_cough') skillsToRender = ['skill_ask_cough', 'skill_check_rr', 'skill_classify_cough']; else if (symptomKey === 'symptom_diarrhea') skillsToRender = ['skill_ask_diarrhea', 'skill_check_dehydration', 'skill_classify_diarrhea']; else if (symptomKey === 'symptom_fever') skillsToRender = ['skill_ask_fever', 'skill_check_rdt', 'skill_classify_fever']; else if (symptomKey === 'symptom_ear') skillsToRender = ['skill_ask_ear', 'skill_check_ear', 'skill_classify_ear']; return (<React.Fragment key={symptomKey}><tr className="bg-sky-700 text-white"><td className="p-1.5 text-xs font-bold text-right border border-gray-300" colSpan="2">{symptomGroup.mainSkill.label}</td><td className="p-1.5 border border-gray-300 text-center">{symptomScore !== null && (<div className="bg-white rounded-md px-2 py-0.5 inline-block"><ScoreText value={symptomScore} /></div>)}</td></tr>{skillsToRender.map(skillKey => (<CompactSkillRow key={skillKey} label={SKILL_LABEL_MAP[skillKey]} stats={skillStats[skillKey]} />))}</React.Fragment>); }); }
                                    const subgroupKey = subgroup.scoreKey || subgroup.subgroupTitle; const subgroupScore = subgroup.scoreKey ? subgroupScoreMap[subgroupKey] : null;
                                    return (<React.Fragment key={subgroup.subgroupTitle}><tr className="bg-sky-700 text-white"><td className="p-1.5 text-xs font-bold text-right border border-gray-300" colSpan="2">{subgroup.subgroupTitle}</td><td className="p-1.5 border border-gray-300 text-center">{subgroupScore !== null && (<div className="bg-white rounded-md px-2 py-0.5 inline-block"><ScoreText value={subgroupScore} /></div>)}</td></tr>{subgroup.skills?.map(skill => (<CompactSkillRow key={skill.key} label={skill.label} stats={skillStats[skill.key]} />))}</React.Fragment>);
                                })}
                                {group.isDecisionSection && (<CompactSkillRow label="هل يتطابق قرار العامل الصحي مع المشرف؟" stats={skillStats['decisionMatches']} />)}
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
    return (<tr className="bg-white hover:bg-gray-50"><td className="p-1.5 text-xs font-medium text-gray-700 border border-gray-300 w-3/5">{label}</td><td className="p-1.5 text-xs font-semibold text-gray-800 border border-gray-300 w-1/5 text-center"><span title="نعم">{yes}</span> / <span title="جزئياً">{partial}</span> / <span title="لا">{no}</span></td><td className="p-1.5 border border-gray-300 w-1/5 text-center"><ScoreText value={percentage} /></td></tr>);
};

const EENCCompactSkillsTable = ({ overallKpis }) => {
    const skillStats = overallKpis?.skillStats;
    if (!overallKpis || !skillStats || Object.keys(skillStats).length === 0) return (<div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 text-center text-gray-500">No detailed EENC skill data available.</div>);
    const sections = [{ title: 'تحضيرات ما قبل الولادة', items: PREPARATION_ITEMS, score: overallKpis.avgPreparation }, { title: 'التجفيف، التحفيز، التدفئة والشفط', items: DRYING_STIMULATION_ITEMS, score: overallKpis.avgDrying }, { title: 'متابعة طفل يتنفس طبيعياً', items: NORMAL_BREATHING_ITEMS, score: overallKpis.avgNormalBreathing }, { title: 'إنعاش الوليد (الدقيقة الذهبية)', items: RESUSCITATION_ITEMS, score: overallKpis.avgResuscitation }];
    return (
        <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200" dir="rtl">
            <table className="w-full border-collapse"><thead className="sticky top-0 z-10"><tr className="bg-gray-50"><th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-3/5 text-right">المهارة (EENC)</th><th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">العدد (نعم / جزئياً / لا)</th><th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">النسبة</th></tr></thead><tbody>{sections.map(section => { const hasData = section.items.some(item => skillStats[item.key] && (skillStats[item.key].yes > 0 || skillStats[item.key].partial > 0 || skillStats[item.key].no > 0)); if (!hasData) return null; return (<React.Fragment key={section.title}><tr className="bg-sky-900 text-white"><td className="p-1 text-sm font-bold text-right border border-gray-300" colSpan="2">{section.title}</td><td className="p-1 border border-gray-300 text-center">{section.score !== null && (<div className="bg-white rounded-md px-2 py-0.5 inline-block"><ScoreText value={section.score} /></div>)}</td></tr>{section.items.map(item => (<EENCCompactSkillRow key={item.key} label={item.label} stats={skillStats[item.key]} />))}</React.Fragment>); })}</tbody></table>
        </div>
    );
};

// --- EENC & IMNCI Mother Survey Constants ---
const EENC_MOTHER_SURVEY_ITEMS = [
    { title: 'وضع الطفل جلد بجلد', items: [{ key: 'skin_to_skin_immediate', label: 'هل تم وضع الطفل جلد بجلد مباشرة بعد الولادة؟' }, { key: 'skin_to_skin_90min', label: 'هل الطفل الان موضوع جلد بجلد أو تم وضعه جلد بجلد بصورة غير منقطعة مدة 90 دقيقة؟' }] },
    { title: 'بدء الرضاعة الطبيعية', items: [{ key: 'breastfed_first_hour', label: 'هل أكمل الطفل رضعة كاملة خلال الساعة الأولى من الولادة؟' }, { key: 'given_other_fluids', label: 'هل تم إعطاء أي سوائل اخرى غير حليب الأم؟' }, { key: 'given_other_fluids_bottle', label: 'هل تم إعطاء الطفل أي سائل اخر عن طريق البزة؟' }] },
    { title: 'رعاية الجلد والعين والسرة', items: [{ key: 'given_vitamin_k', label: 'هل تم إعطاء الطفل فيتامين ك ؟' }, { key: 'given_tetracycline', label: 'هل تم إعطاء الطفل جرعة تتراسيكلين للعين ؟' }, { key: 'anything_on_cord', label: 'هل تم وضع أي مادة على السرة ؟' }, { key: 'rubbed_with_oil', label: 'هل تم مسح الطفل باي نوع من الزيوت ؟' }, { key: 'baby_bathed', label: 'هل تم استحمام الطفل ؟' }] },
    { title: 'تطعيمات الطفل', items: [{ key: 'polio_zero_dose', label: 'هل تم تطعيم الطفل الجرعة الصفرية للشلل الفموي ؟' }, { key: 'bcg_dose', label: 'هل تم تطعيم الطفل جرعة الدرن ؟' }] },
    { title: 'قياسات الطفل', items: [{ key: 'baby_weighed', label: 'هل تم وزن الطفل ؟' }, { key: 'baby_temp_measured', label: 'هل تم قياس درجة حرارة الطفل ؟' }] },
    { title: 'تسجيلات الطفل', items: [{ key: 'baby_registered', label: 'هل تم تسجيل الطفل في السجل المدني؟' }, { key: 'given_discharge_card', label: 'هل تم إعطاء الطفل كرت الخروج؟' }] }
];

const IMNCI_MOTHER_SURVEY_ITEMS = [
    { title: 'معرفة الأمهات (العلاج والأدوية)', items: [
        { key: 'knows_med_details', label: 'الأم تعرف تفاصيل الدواء (الجرعة، التكرار، الأيام)' },
        { key: 'knows_treatment_details', label: 'الأم تعرف تفاصيل العلاج المركب (مضاد+ملاريا+إرواء)' },
        { key: 'knows_diarrhea_4rules', label: 'الأم تعرف القواعد الأربعة لعلاج الإسهال بالمنزل' },
        { key: 'knows_return_date', label: 'الأم تعرف متى تعود للمتابعة' }
    ]},
    { title: 'معرفة الأمهات (الإرواء والسوائل)', items: [
        { key: 'knows_ors_prep', label: 'الأم تعرف تحضير ملح الإرواء والكمية' },
        { key: 'knows_home_fluids', label: 'الأم تعرف السوائل المنزلية المسموحة' },
        { key: 'knows_ors_water_qty', label: 'الأم تعرف كمية الماء لملح الإرواء' },
        { key: 'knows_ors_after_stool', label: 'الأم تعرف كمية المحلول بعد كل تبرز' }
    ]},
    { title: 'رضاء الأمهات', items: [
        { key: 'time_spent', label: 'الزمن الذي قضاه الكادر الصحي مع الطفل' },
        { key: 'assessment_method', label: 'الطريقة التي كشف بها الكادر الصحي' },
        { key: 'treatment_given', label: 'العلاج الذي أعطى' },
        { key: 'communication_style', label: 'الطريقة التي تحدث بها الكادر الصحي' },
        { key: 'what_learned', label: 'ما تعلمته من الكادر الصحي' },
        { key: 'drug_availability', label: 'توفر الدواء بالوحدة الصحية' }
    ]}
];

const MothersCompactSkillsTable = ({ motherKpis, serviceType }) => {
    const skillStats = motherKpis?.skillStats;
    if (!motherKpis || !skillStats) return (<div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 text-center text-gray-500">No mother survey data available.</div>);
    const items = serviceType === 'IMNCI' ? IMNCI_MOTHER_SURVEY_ITEMS : EENC_MOTHER_SURVEY_ITEMS;

    return (
        <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200" dir="rtl">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50">
                        <th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-3/5 text-right">السؤال (استبيان الأم)</th>
                        <th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">العدد (نعم / الإجمالي)</th>
                        <th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">النسبة</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(group => (
                        <React.Fragment key={group.title}>
                            <tr className="bg-sky-900 text-white"><td className="p-1 text-sm font-bold text-right border border-gray-300" colSpan="3">{group.title}</td></tr>
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
        <label htmlFor={label} className="block text-sm font-medium text-gray-700">{label}</label>
        <select id={label} name={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md">
            <option value="">{defaultOption}</option>
            {options.map(option => (<option key={option.key || option} value={option.key || option}>{option.name || option}</option>))}
        </select>
    </div>
);

const MentorshipDashboard = ({ 
    allSubmissions, STATE_LOCALITIES, activeService, activeState, onStateChange, activeLocality, onLocalityChange, activeFacilityId, onFacilityIdChange, activeWorkerName, onWorkerNameChange, visitReports, canEditStatus, onUpdateStatus
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
        // 1. Update local state immediately
        const key = `${reportId}_${challengeId}_${fieldName}`;
        setLocalStatusUpdates(prev => ({ ...prev, [key]: newValue }));
        
        // 2. Call the parent handler to trigger DB update
        onUpdateStatus(reportId, challengeId, newValue, fieldName);
    };

    const calculateAverage = useCallback((scores) => {
        const validScores = scores.filter(s => isFinite(s) && !isNaN(s) && s !== null);
        if (validScores.length === 0) return null;
        const sum = validScores.reduce((a, b) => a + b, 0);
        return sum / validScores.length;
    }, []);

    // --- Visit Report Data Processor ---
    const visitReportStats = useMemo(() => {
        if (!visitReports) return null;
        let filtered = visitReports.filter(r => r.service === activeService);

        if (activeState) filtered = filtered.filter(r => r.state === activeState);
        if (activeLocality) filtered = filtered.filter(r => r.locality === activeLocality);
        if (activeFacilityId) filtered = filtered.filter(r => r.facilityId === activeFacilityId);

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
                            reportId: r.id, // Needed for updates
                            challengeId: ch.id, // Needed for updates
                            facility: r.facilityName,
                            date: r.visitDate,
                            problem: ch.problem,
                            
                            // Immediate Solution Fields
                            immediate: ch.immediate_solution,
                            immediate_status: ch.immediate_status || 'Pending',

                            // Long-term Solution Fields
                            longterm: ch.long_term_solution,
                            long_term_status: ch.long_term_status || 'Pending',

                            person: ch.responsible_person
                        });
                    }
                });
            }
        });

        return { totalVisits, stateChartData, facilityTableData, distinctSkillKeys, problemsList };

    }, [visitReports, activeService, activeState, activeLocality, activeFacilityId, STATE_LOCALITIES]);

    // --- Helper for rendering status badges/selects with Local Optimistic Update ---
    const renderStatusCell = (currentStatus, reportId, challengeId, fieldName) => {
        // Check if there is a pending local update for this cell
        const key = `${reportId}_${challengeId}_${fieldName}`;
        const displayStatus = localStatusUpdates[key] !== undefined ? localStatusUpdates[key] : currentStatus;

        if (canEditStatus) {
            return (
                <select
                    value={displayStatus}
                    onChange={(e) => handleLocalUpdate(reportId, challengeId, e.target.value, fieldName)}
                    className={`block w-full text-[10px] border-gray-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500 ${
                        displayStatus === 'Done' || displayStatus === 'Resolved' ? 'text-green-700 font-semibold' :
                        displayStatus === 'In Progress' ? 'text-blue-700' : 'text-yellow-700'
                    }`}
                >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                </select>
            );
        } else {
            return (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    displayStatus === 'Done' || displayStatus === 'Resolved' ? 'bg-green-100 text-green-800' :
                    displayStatus === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                }`}>
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
            vitalSigns: [], dangerSigns: [], mainSymptoms: [], malnutrition: [], immunization: [], otherProblems: [],
            measurementSkills: [], malnutritionAnemiaSkills: [],
        };
        
        let totalVisits = submissions.length;
        const skillStats = {};
        
        // Helper to safely initialize a key
        const initStat = (key) => { if (!skillStats[key]) skillStats[key] = { yes: 0, no: 0 }; };

        // Initialize keys
        ['skill_ask_cough', 'skill_check_rr', 'skill_classify_cough',
         'skill_ask_diarrhea', 'skill_check_dehydration', 'skill_classify_diarrhea',
         'skill_ask_fever', 'skill_check_rdt', 'skill_classify_fever',
         'skill_ask_ear', 'skill_check_ear', 'skill_classify_ear', 'decisionMatches'
        ].forEach(k => initStat(k));

        IMNCI_FORM_STRUCTURE.forEach(group => {
            group.subgroups?.forEach(sub => {
                sub.skills?.forEach(skill => initStat(skill.key));
            });
        });

        submissions.forEach(sub => {
            const s = sub.scores || {}; 
            const as = sub.fullData?.assessmentSkills || {};
            const ts = sub.fullData?.treatmentSkills || {};

            // --- 1. Standard Score Pushes ---
            if (s.overallScore_maxScore > 0) scores.overall.push(s.overallScore_score / s.overallScore_maxScore);
            if (s.assessment_total_score_maxScore > 0) scores.assessment.push(s.assessment_total_score_score / s.assessment_total_score_maxScore);
            if (s.finalDecision_maxScore > 0) scores.decision.push(s.finalDecision_score / s.finalDecision_maxScore);
            if (s.treatment_total_score_maxScore > 0) scores.treatment.push(s.treatment_total_score_score / s.treatment_total_score_maxScore);
            
            Object.keys(scores).forEach(key => {
                const maxKey = `${key}_maxScore`; const scKey = `${key}_score`;
                if (s[maxKey] > 0 && !['overall', 'assessment', 'decision', 'treatment', 'measurementSkills', 'malnutritionAnemiaSkills', 'respiratoryRateCalculation', 'dehydrationAssessment', 'pneuAmox', 'diarOrs', 'diarZinc', 'anemiaIron'].includes(key)) {
                    scores[key].push(s[scKey] / s[maxKey]);
                }
            });

            // --- 2. Robust Symptom Check Score Logic (Strictly based on Supervisor Confirmation) ---
            if (as['supervisor_confirms_cough'] === 'yes') {
                scores.respiratoryRateCalculation.push(as['skill_check_rr'] === 'yes' ? 1 : 0);
            }
            if (as['supervisor_confirms_diarrhea'] === 'yes') {
                scores.dehydrationAssessment.push(as['skill_check_dehydration'] === 'yes' ? 1 : 0);
            }

            // --- 3. Robust Treatment Logic (Strictly based on what was relevant) ---
            const pushSpecificTreatment = (skillKey, targetArr) => {
                const val = ts[skillKey];
                if (val === 'yes') targetArr.push(1);
                else if (val === 'no') targetArr.push(0);
            };
            pushSpecificTreatment('skill_pneu_abx', scores.pneuAmox);
            pushSpecificTreatment('skill_diar_ors', scores.diarOrs);
            pushSpecificTreatment('skill_diar_zinc', scores.diarZinc);
            pushSpecificTreatment('skill_anemia_iron', scores.anemiaIron);

            // --- 4. Robust Measurement Score Logic (with Fallback) ---
            const pushSkillWithFallback = (scoreVal, maxVal, skillKey, targetArr) => {
                if (maxVal > 0) {
                    targetArr.push(scoreVal / maxVal);
                } else if (as[skillKey]) {
                    // Fallback: Use raw data if score is missing
                    const val = as[skillKey];
                    targetArr.push((val === 'yes' || val === 'correct' || val === true) ? 1 : 0);
                }
            };

            pushSkillWithFallback(s.handsOnWeight_score, s.handsOnWeight_maxScore, 'skill_weight', scores.measurementSkills);
            pushSkillWithFallback(s.handsOnTemp_score, s.handsOnTemp_maxScore, 'skill_temp', scores.measurementSkills);
            pushSkillWithFallback(s.handsOnHeight_score, s.handsOnHeight_maxScore, 'skill_height', scores.measurementSkills);
            
            pushSkillWithFallback(s.handsOnMUAC_score, s.handsOnMUAC_maxScore, 'skill_muac', scores.malnutritionAnemiaSkills);
            pushSkillWithFallback(s.handsOnWFH_score, s.handsOnWFH_maxScore, 'skill_wfh', scores.malnutritionAnemiaSkills);
            
            // Pallor is a special case (often boolean in 'as' but missing in scores)
            const pallorVal = as['skill_anemia_pallor'];
            if (pallorVal === 'yes') { scores.handsOnPallor.push(1); scores.malnutritionAnemiaSkills.push(1); }
            else if (pallorVal === 'no') { scores.handsOnPallor.push(0); scores.malnutritionAnemiaSkills.push(0); }

            // --- 5. Populate skillStats for Table Rows ---
            const allSkills = { ...as, ...ts };
            Object.keys(skillStats).forEach(key => {
                if (key === 'decisionMatches') return; 
                const val = allSkills[key];
                if (val === 'yes' || val === 'correct' || val === true) skillStats[key].yes++;
                else if (val === 'no' || val === 'incorrect' || val === false) skillStats[key].no++;
            });

            const decisionMatch = sub.fullData?.decision_agreement || sub.fullData?.decision_score_agreement; 
            if (decisionMatch === 'yes' || decisionMatch === true) skillStats['decisionMatches'].yes++;
            else if (decisionMatch === 'no' || decisionMatch === false) skillStats['decisionMatches'].no++;
        });

        const avg = (arr) => calculateAverage(arr);
        return {
            totalVisits, skillStats,
            avgOverall: avg(scores.overall), avgAssessment: avg(scores.assessment), avgDecision: avg(scores.decision), avgTreatment: avg(scores.treatment),
            avgRespiratoryRateCalculation: avg(scores.respiratoryRateCalculation),
            avgDehydrationAssessment: avg(scores.dehydrationAssessment), 
            avgHandsOnWeight: avg(scores.handsOnWeight), avgHandsOnTemp: avg(scores.handsOnTemp), avgHandsOnHeight: avg(scores.handsOnHeight), 
            avgHandsOnMUAC: avg(scores.handsOnMUAC), avgHandsOnWFH: avg(scores.handsOnWFH), avgHandsOnPallor: avg(scores.handsOnPallor),
            avgPneuAmox: avg(scores.pneuAmox), avgDiarOrs: avg(scores.diarOrs), avgDiarZinc: avg(scores.diarZinc), avgAnemiaIron: avg(scores.anemiaIron),
            avgDangerSigns: avg(scores.dangerSigns),
            avgMeasurementSkills: avg(scores.measurementSkills), avgMalnutritionAnemiaSkills: avg(scores.malnutritionAnemiaSkills),
        };
    }, [calculateAverage]);

    const eencKpiHelper = useCallback((submissions) => {
        const scores = {
            overall: [], preparation: [], drying: [], normal_breathing: [], resuscitation: [],
            inf_wash1: [], inf_wash2: [], inf_gloves: [], prep_towel: [], prep_equip: [], prep_ambu: [],
            care_dry: [], care_skin: [], care_cover: [], cord_hygiene: [], cord_delay: [], cord_clamp: [],
            bf_advice: [], resus_head: [], resus_mask: [], resus_chest: [], resus_rate: []
        };
        let totalVisits = submissions.length;
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
            totalVisits, skillStats,
            avgOverall: avg(scores.overall), avgPreparation: avg(scores.preparation), avgDrying: avg(scores.drying), avgNormalBreathing: avg(scores.normal_breathing), avgResuscitation: avg(scores.resuscitation),
            avgInfWash1: avg(scores.inf_wash1), avgInfWash2: avg(scores.inf_wash2), avgInfGloves: avg(scores.inf_gloves),
            avgPrepTowel: avg(scores.prep_towel), avgPrepEquip: avg(scores.prep_equip), avgPrepAmbu: avg(scores.prep_ambu),
            avgCareDry: avg(scores.care_dry), avgCareSkin: avg(scores.care_skin), avgCareCover: avg(scores.care_cover),
            avgCordHygiene: avg(scores.cord_hygiene), avgCordDelay: avg(scores.cord_delay), avgCordClamp: avg(scores.cord_clamp),
            avgBfAdvice: avg(scores.bf_advice), avgResusHead: avg(scores.resus_head), avgResusMask: avg(scores.resus_mask), avgResusChest: avg(scores.resus_chest), avgResusRate: avg(scores.resus_rate),
        };
    }, [calculateAverage]);

    const eencMotherKpiHelper = useCallback((submissions) => {
        const motherSubmissions = submissions.filter(sub => sub.service === 'EENC_MOTHERS');
        const totalMothers = motherSubmissions.length;
        const scores = { skin_imm: [], skin_90min: [], bf_1hr: [], bf_substitute: [], bf_bottle: [], vit_k: [], eye_oint: [], cord_subs: [], skin_oil: [], bath_6hr: [], polio: [], bcg: [], weight: [], temp: [], civ_reg: [], dis_card: [] };
        const skillStats = {};
        EENC_MOTHER_SURVEY_ITEMS.forEach(g => g.items.forEach(i => skillStats[i.key] = { yes: 0, no: 0 }));

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
    }, [calculateAverage]);

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
        IMNCI_MOTHER_SURVEY_ITEMS.forEach(g => g.items.forEach(i => skillStats[i.key] = { yes: 0, no: 0 }));

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
    }, [calculateAverage]);


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
    const workerOptions = useMemo(() => {
        const map = new Map(); serviceCompletedSubmissions.filter(s => (!activeState || s.state === activeState) && (!activeLocality || s.locality === activeLocality) && (!activeFacilityId || s.facilityId === activeFacilityId)).forEach(s => { if (s.staff && !map.has(s.staff)) map.set(s.staff, { key: s.staff, name: s.staff }); });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId]);

    const filteredSubmissions = useMemo(() => serviceCompletedSubmissions.filter(sub => 
        (!activeState || sub.state === activeState) && (!activeLocality || sub.locality === activeLocality) && (!activeFacilityId || sub.facilityId === activeFacilityId) && (!activeWorkerName || sub.staff === activeWorkerName)
    ), [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId, activeWorkerName]);

    const overallKpis = useMemo(() => {
        if (activeService === 'IMNCI') {
            return imnciKpiHelper(filteredSubmissions.filter(s => s.service === 'IMNCI'));
        }
        if (activeService === 'EENC') {
            return eencKpiHelper(filteredSubmissions.filter(s => s.service === 'EENC'));
        }
        return { totalVisits: filteredSubmissions.length, skillStats: {} };
    }, [filteredSubmissions, imnciKpiHelper, eencKpiHelper, activeService]);

    const motherKpis = useMemo(() => {
        if (activeService === 'EENC') return eencMotherKpiHelper(filteredSubmissions);
        if (activeService === 'IMNCI') return imnciMotherKpiHelper(filteredSubmissions);
        return null;
    }, [filteredSubmissions, eencMotherKpiHelper, imnciMotherKpiHelper, activeService]);

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
                'Weight': [], 'Temp': [], 'Height': [], 'MUAC': [], 'WFH': [], 'Pallor': [], 'DangerSigns': []
            };
            const g = acc[visitNum];
            g['Overall'].push(calcPercent(s.overallScore_score, s.overallScore_maxScore));
            g['Assessment'].push(calcPercent(s.assessment_total_score_score, s.assessment_total_score_maxScore));
            g['Decision'].push(calcPercent(s.finalDecision_score, s.finalDecision_maxScore));
            g['Treatment'].push(calcPercent(s.treatment_total_score_score, s.treatment_total_score_maxScore));
            
            g['Weight'].push(calcPercent(s.handsOnWeight_score, s.handsOnWeight_maxScore));
            g['Temp'].push(calcPercent(s.handsOnTemp_score, s.handsOnTemp_maxScore));
            g['Height'].push(calcPercent(s.handsOnHeight_score, s.handsOnHeight_maxScore));
            g['MUAC'].push(calcPercent(s.handsOnMUAC_score, s.handsOnMUAC_maxScore));
            g['WFH'].push(calcPercent(s.handsOnWFH_score, s.handsOnWFH_maxScore));
            g['DangerSigns'].push(calcPercent(s.dangerSigns_score, s.dangerSigns_maxScore));
            
            const as = sub.fullData?.assessmentSkills;
            if (as) { 
                if (as['skill_anemia_pallor'] === 'yes') g['Pallor'].push(100); else if (as['skill_anemia_pallor'] === 'no') g['Pallor'].push(0); 

                // Symptom Checks Based STRICTLY on Denominator
                if (as['supervisor_confirms_cough'] === 'yes') {
                    g['Resp. Rate'].push(as['skill_check_rr'] === 'yes' ? 100 : 0);
                }
                if (as['supervisor_confirms_diarrhea'] === 'yes') {
                    g['Dehydration'].push(as['skill_check_dehydration'] === 'yes' ? 100 : 0);
                }
            }

            const ts = sub.fullData?.treatmentSkills || {};
            const pushTreatment = (key, label) => {
                if (ts[key] === 'yes') g[label].push(100);
                else if (ts[key] === 'no') g[label].push(0);
            };
            pushTreatment('skill_pneu_abx', 'Pneumonia Amox');
            pushTreatment('skill_diar_ors', 'Diarrhea ORS');
            pushTreatment('skill_diar_zinc', 'Diarrhea Zinc');
            pushTreatment('skill_anemia_iron', 'Anemia Iron');

            return acc;
        }, {});
        return Object.keys(visitGroups).map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] })).sort((a,b)=>a.visitNumber-b.visitNumber).map(({visitNumber, data}) => {
            const avg = (scores) => { const v = scores.filter(s => s !== null && !isNaN(s)); if(v.length===0)return null; return Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
            const res = { name: `Visit ${visitNumber}` };
            Object.keys(data).forEach(k => res[k] = avg(data[k]));
            return res;
        });
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
            const skills = sub.fullData?.skills;
            if (skills) {
                const pushSkill = (key, label) => { if (skills[key] === 'yes') g[label].push(100); else if (skills[key] === 'no' || skills[key] === 'partial') g[label].push(0); };
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
        });
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
            });
    }, [filteredSubmissions, activeService]);

    const eencMotherChartData = useMemo(() => {
        if (activeService !== 'EENC') return [];
        const sortedSubmissions = [...filteredSubmissions].sort((a, b) => (a.visitNumber || 1) - (b.visitNumber || 1));
        const visitGroups = sortedSubmissions.reduce((acc, sub) => {
            if (sub.service !== 'EENC_MOTHERS') return acc;
            const visitNum = sub.visitNumber || 1; 
            if (!acc[visitNum]) acc[visitNum] = { 'Imm. Skin-to-Skin': [], '90min Skin-to-Skin': [], 'BF 1st Hour': [], 'Other Fluids': [], 'Bottle Feeding': [], 'Vitamin K': [], 'Eye Ointment': [], 'Cord Substance': [], 'Skin Oiling': [], 'Bathing < 6hrs': [], 'Polio Vaccine': [], 'BCG Vaccine': [], 'Weight Measured': [], 'Temp Measured': [], 'Civil Reg': [], 'Discharge Card': [] };
            const g = acc[visitNum]; 
            const d = sub.eencMothersData || sub.fullData?.eencMothersData;
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
            });
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
    const isFiltered = activeState || activeLocality || activeFacilityId || activeWorkerName;
    const scopeTitle = isFiltered ? "(Filtered Data)" : "(All Sudan Data)";

    // IMNCI Constants
    const mainKpiGridList = [{ title: "Overall IMNCI Adherence", scoreValue: overallKpis.avgOverall }, { title: "Assess & Classify Score", scoreValue: overallKpis.avgAssessment }, { title: "Final Decision Score", scoreValue: overallKpis.avgDecision }, { title: "Treatment & Counsel Score", scoreValue: overallKpis.avgTreatment }];
    const mainKpiChartKeys = [{ key: 'Overall', title: 'Overall' }, { key: 'Assessment', title: 'Assessment' }, { key: 'Decision', title: 'Decision' }, { key: 'Treatment', title: 'Treatment' }];
    const dangerSignsKpiList = [ { title: "Asked/Checked: Cannot Drink/Breastfeed", scoreValue: calculateAverage(overallKpis.skillStats?.['skill_ds_drink'] ? [overallKpis.skillStats['skill_ds_drink'].yes / (overallKpis.skillStats['skill_ds_drink'].yes + overallKpis.skillStats['skill_ds_drink'].no)] : []) }, { title: "Asked/Checked: Vomits Everything", scoreValue: calculateAverage(overallKpis.skillStats?.['skill_ds_vomit'] ? [overallKpis.skillStats['skill_ds_vomit'].yes / (overallKpis.skillStats['skill_ds_vomit'].yes + overallKpis.skillStats['skill_ds_vomit'].no)] : []) }, { title: "Asked/Checked: Convulsions", scoreValue: calculateAverage(overallKpis.skillStats?.['skill_ds_convulsion'] ? [overallKpis.skillStats['skill_ds_convulsion'].yes / (overallKpis.skillStats['skill_ds_convulsion'].yes + overallKpis.skillStats['skill_ds_convulsion'].no)] : []) }, { title: "Checked: Lethargic/Unconscious", scoreValue: calculateAverage(overallKpis.skillStats?.['skill_ds_conscious'] ? [overallKpis.skillStats['skill_ds_conscious'].yes / (overallKpis.skillStats['skill_ds_conscious'].yes + overallKpis.skillStats['skill_ds_conscious'].no)] : []) } ];
    const dangerSignsChartKeys = [{ key: 'DangerSigns', title: 'Danger Signs Score' }];
    
    // Clinical Symptom Assessments 
    const respRateKpiList = [{ title: "Correct Resp. Rate", scoreValue: overallKpis.avgRespiratoryRateCalculation }];
    const respRateChartKeys = [{ key: 'Resp. Rate', title: 'Resp. Rate' }];

    const dehydrationKpiList = [{ title: "Correct Dehydration ID", scoreValue: overallKpis.avgDehydrationAssessment }];
    const dehydrationChartKeys = [{ key: 'Dehydration', title: 'Dehydration' }];

    // NEW: Management Adherence (Separated into individual blocks)
    const pneuAmoxKpiList = [{ title: "Pneumonia: Amoxicillin", scoreValue: overallKpis.avgPneuAmox }];
    const pneuAmoxChartKeys = [{ key: 'Pneumonia Amox', title: 'Amoxicillin' }];

    const diarOrsKpiList = [{ title: "Diarrhea: ORS", scoreValue: overallKpis.avgDiarOrs }];
    const diarOrsChartKeys = [{ key: 'Diarrhea ORS', title: 'ORS' }];

    const diarZincKpiList = [{ title: "Diarrhea: Zinc", scoreValue: overallKpis.avgDiarZinc }];
    const diarZincChartKeys = [{ key: 'Diarrhea Zinc', title: 'Zinc' }];

    const anemiaIronKpiList = [{ title: "Anemia: Iron", scoreValue: overallKpis.avgAnemiaIron }];
    const anemiaIronChartKeys = [{ key: 'Anemia Iron', title: 'Iron' }];

    const measurementKpiGridList = [{ title: "Weight Measured Correctly", scoreValue: overallKpis.avgHandsOnWeight }, { title: "Temp Measured Correctly", scoreValue: overallKpis.avgHandsOnTemp }, { title: "Height Measured Correctly", scoreValue: overallKpis.avgHandsOnHeight }];
    const measurementKpiChartKeys = [{ key: 'Weight', title: 'Weight' }, { key: 'Temp', title: 'Temp' }, { key: 'Height', title: 'Height' }];
    const malnutritionAnemiaSkillsKpiGridList = [{ title: "MUAC Measured Correctly", scoreValue: overallKpis.avgHandsOnMUAC }, { title: "Z-Score (WFH) Measured Correctly", scoreValue: overallKpis.avgHandsOnWFH }, { title: "Pallor Checked Correctly", scoreValue: overallKpis.avgHandsOnPallor }];
    const malnutritionAnemiaSkillsKpiChartKeys = [{ key: 'MUAC', title: 'MUAC' }, { key: 'WFH', title: 'WFH' }, { key: 'Pallor', title: 'Pallor' }];

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

    return (
        <div className="p-4" dir="ltr"> 
            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">Mentorship Dashboard: {serviceTitle} {scopeTitle}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 p-4 bg-gray-50 rounded-lg border">
                <FilterSelect label="State" value={activeState} onChange={(v) => { onStateChange(v); onLocalityChange(""); onFacilityIdChange(""); onWorkerNameChange(""); }} options={stateOptions} defaultOption="All States" />
                <FilterSelect label="Locality" value={activeLocality} onChange={(v) => { onLocalityChange(v); onFacilityIdChange(""); onWorkerNameChange(""); }} options={localityOptions} disabled={!activeState} defaultOption="All Localities" />
                <FilterSelect label="Health Facility Name" value={activeFacilityId} onChange={(v) => { onFacilityIdChange(v); onWorkerNameChange(""); }} options={facilityOptions} disabled={!activeLocality} defaultOption="All Facilities" />
                <FilterSelect label="Health Worker Name" value={activeWorkerName} onChange={onWorkerNameChange} options={workerOptions} disabled={!activeFacilityId} defaultOption="All Health Workers" />
            </div>
            
            {activeService === 'IMNCI' && (
                <>
                    <div className="flex mb-6 border-b border-gray-200">
                        <button className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeImnciTab === 'skills' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveImnciTab('skills')}>Skills Observation (Provider)</button>
                        <button className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeImnciTab === 'mothers' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveImnciTab('mothers')}>Mother Interviews</button>
                        <button className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeImnciTab === 'visit_reports' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveImnciTab('visit_reports')}>Visit Reports (Facility)</button>
                    </div>

                    {activeImnciTab === 'skills' && (
                        <div className="animate-fade-in">
                            <div className="grid grid-cols-1 gap-4 mb-6"><KpiCard title="Total Completed Visits" value={overallKpis.totalVisits} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><KpiGridCard title="Overall Adherence Scores (Average)" kpis={mainKpiGridList} cols={2} /><KpiLineChart title="Adherence Over Time (Main KPIs)" chartData={imnciChartData} kpiKeys={mainKpiChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Danger Signs Assessment" overallScore={overallKpis.avgDangerSigns} kpis={dangerSignsKpiList} /><KpiLineChart title="Adherence Over Time (Danger Signs)" chartData={imnciChartData} kpiKeys={dangerSignsChartKeys} /></div>
                            
                            {/* Correct Symptom Assessments */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <KpiCardWithChart 
                                    title="Correct Resp. Rate Measurement" 
                                    kpis={respRateKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={respRateChartKeys} 
                                    cols={1} 
                                />
                                <KpiCardWithChart 
                                    title="Correct Dehydration Identification" 
                                    kpis={dehydrationKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={dehydrationChartKeys} 
                                    cols={1} 
                                />
                            </div>

                            {/* Management Adherence - Row 1 (Pneumonia & ORS) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <KpiCardWithChart 
                                    title="Pneumonia Treated w/ Amoxicillin" 
                                    kpis={pneuAmoxKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={pneuAmoxChartKeys} 
                                    cols={1} 
                                />
                                <KpiCardWithChart 
                                    title="Diarrhea Treated w/ ORS" 
                                    kpis={diarOrsKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={diarOrsChartKeys} 
                                    cols={1} 
                                />
                            </div>

                            {/* Management Adherence - Row 2 (Zinc & Iron) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <KpiCardWithChart 
                                    title="Diarrhea Treated w/ Zinc" 
                                    kpis={diarZincKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={diarZincChartKeys} 
                                    cols={1} 
                                />
                                <KpiCardWithChart 
                                    title="Anemia Treated w/ Iron" 
                                    kpis={anemiaIronKpiList} 
                                    chartData={imnciChartData} 
                                    kpiKeys={anemiaIronChartKeys} 
                                    cols={1} 
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Measurement Skills (Average)" overallScore={overallKpis.avgMeasurementSkills} kpis={measurementKpiGridList} /><KpiLineChart title="Adherence Over Time (Measurement Skills)" chartData={imnciChartData} kpiKeys={measurementKpiChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Malnutrition and Anemia Signs" overallScore={overallKpis.avgMalnutritionAnemiaSkills} kpis={malnutritionAnemiaSkillsKpiGridList} /><KpiLineChart title="Adherence Over Time (Malnutrition & Anemia Signs)" chartData={imnciChartData} kpiKeys={malnutritionAnemiaSkillsKpiChartKeys} /></div>
                            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">Overall Adherence by State {scopeTitle}</h3>
                            <div className="mb-8"><KpiBarChart title="Overall IMNCI Adherence by State" chartData={stateKpis} /></div>
                            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">Detailed Skill Performance {scopeTitle}</h3>
                            <div className="mb-8"><CompactSkillsTable overallKpis={overallKpis} /></div>
                        </div>
                    )}

                    {activeImnciTab === 'mothers' && (
                        <div className="animate-fade-in">
                            <div className="grid grid-cols-1 gap-4 mb-6"><KpiCard title="Total Mother Interviews" value={motherKpis?.totalMothers || 0} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <DetailedKpiCard title="Mother Knowledge: Treatment" overallScore={calculateAverage([motherKpis?.avgKnowMed, motherKpis?.avgKnowTx])} kpis={imnciMotherKnowMedKpis} />
                                <KpiLineChart title="Knowledge (Meds) Over Time" chartData={imnciMotherChartData} kpiKeys={imnciMotherKnowMedChartKeys} />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <DetailedKpiCard title="Mother Knowledge: ORS & Fluids" overallScore={calculateAverage([motherKpis?.avgKnowOrsPrep, motherKpis?.avgKnowFluids])} kpis={imnciMotherKnowOrsKpis} />
                                <KpiLineChart title="Knowledge (ORS) Over Time" chartData={imnciMotherChartData} kpiKeys={imnciMotherKnowOrsChartKeys} />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <DetailedKpiCard title="Mother Satisfaction" overallScore={calculateAverage([motherKpis?.avgSatTime, motherKpis?.avgSatComm])} kpis={imnciMotherSatKpis} />
                                <KpiLineChart title="Satisfaction Over Time" chartData={imnciMotherChartData} kpiKeys={imnciMotherSatChartKeys} />
                            </div>
                            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">Overall Mother Interview Scores by State {scopeTitle}</h3>
                            <div className="mb-8"><KpiBarChart title="Average Mother Knowledge/Satisfaction by State" chartData={motherStateKpis} /></div>
                            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">Detailed Mother Interview Performance {scopeTitle}</h3>
                            <div className="mb-8"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="IMNCI" /></div>
                        </div>
                    )}

                    {activeImnciTab === 'visit_reports' && visitReportStats && (
                        <div className="animate-fade-in">
                            {/* 1. Total Card */}
                            <div className="grid grid-cols-1 gap-4 mb-6">
                                <KpiCard title="Total Visit Reports" value={visitReportStats.totalVisits} />
                            </div>

                            {/* 2. Table: Facility, Visits, Skills (Removed State/Locality) */}
                            <div className="mb-8 bg-white rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden">
                                <h4 className="text-lg font-bold text-sky-800 p-4 border-b bg-gray-50">Visit Breakdown & Skills Trained by Facility</h4>
                                <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 border">Facility</th>
                                            <th className="px-4 py-3 border text-center bg-blue-50">Total Visits</th>
                                            {visitReportStats.distinctSkillKeys.map(skillKey => (
                                                <th key={skillKey} className="px-2 py-3 border text-center break-words whitespace-normal text-xs">
                                                    {IMNCI_SKILLS_LABELS[skillKey] || skillKey}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visitReportStats.facilityTableData.map(row => (
                                            <tr key={row.id} className="hover:bg-gray-50 border-b">
                                                <td className="px-4 py-2 border font-medium">{row.facilityName}</td>
                                                <td className="px-4 py-2 border text-center font-bold bg-blue-50">{row.visitCount}</td>
                                                {visitReportStats.distinctSkillKeys.map(skillKey => (
                                                    <td key={skillKey} className="px-2 py-2 border text-center">
                                                        {row.skills[skillKey] || 0}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        {visitReportStats.facilityTableData.length === 0 && (
                                            <tr><td colSpan={2 + visitReportStats.distinctSkillKeys.length} className="p-4 text-center text-gray-500">No visits found for current filter.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>

                            {/* 3. Graph: Visits by State */}
                            <div className="mb-8">
                                <KpiBarChart title="Total Visits by State" chartData={visitReportStats.stateChartData} dataKey="count" />
                            </div>

                            {/* 4. Table: Problems and Solutions (UPDATED) */}
                            <div className="mb-8 bg-white rounded-lg shadow-lg border-2 border-gray-200">
                                <h4 className="text-lg font-bold text-sky-800 p-4 border-b bg-gray-50">Facility Problems & Solutions (Combined)</h4>
                                <div className="overflow-x-auto max-h-[600px]">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-gray-100 text-xs uppercase text-gray-700 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-2 py-3 border w-[15%]">Facility & Date</th>
                                                <th className="px-2 py-3 border w-[20%]">Problem / Challenge</th>
                                                <th className="px-2 py-3 border w-[20%]">Immediate Solution</th>
                                                <th className="px-2 py-3 border w-[10%]">Imm. Status</th>
                                                <th className="px-2 py-3 border w-[20%]">Long-term Solution</th>
                                                <th className="px-2 py-3 border w-[10%]">LT Status</th>
                                                <th className="px-2 py-3 border w-[5%]">Resp.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visitReportStats.problemsList.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 border-b border-gray-300">
                                                    <td className="px-2 py-2 border align-top text-xs">
                                                        <div className="font-bold text-gray-800">{item.facility}</div>
                                                        <div className="text-[10px] text-gray-500">{item.date}</div>
                                                    </td>
                                                    <td className="px-2 py-2 border align-top text-xs text-red-700 whitespace-pre-wrap">{item.problem}</td>
                                                    
                                                    {/* Immediate Solution Column */}
                                                    <td className="px-2 py-2 border align-top text-xs text-green-700 whitespace-pre-wrap">{item.immediate}</td>
                                                    <td className="px-2 py-2 border align-top text-center">
                                                        {renderStatusCell(item.immediate_status, item.reportId, item.challengeId, 'immediate_status')}
                                                    </td>

                                                    {/* Long-term Solution Column */}
                                                    <td className="px-2 py-2 border align-top text-xs text-blue-700 whitespace-pre-wrap">{item.longterm}</td>
                                                    <td className="px-2 py-2 border align-top text-center">
                                                        {renderStatusCell(item.long_term_status, item.reportId, item.challengeId, 'long_term_status')}
                                                    </td>

                                                    <td className="px-2 py-2 border align-top text-[10px] text-gray-600">{item.person}</td>
                                                </tr>
                                            ))}
                                            {visitReportStats.problemsList.length === 0 && (
                                                <tr><td colSpan="7" className="p-4 text-center text-gray-500">No problems recorded.</td></tr>
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
                     <div className="flex mb-6 border-b border-gray-200">
                        <button className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeEencTab === 'skills' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveEencTab('skills')}>Skills Observation (Provider)</button>
                        <button className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeEencTab === 'mothers' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveEencTab('mothers')}>Mother Interviews</button>
                        <button className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeEencTab === 'visit_reports' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveEencTab('visit_reports')}>Visit Reports (Facility)</button>
                    </div>

                    {activeEencTab === 'skills' && (
                        <div className="animate-fade-in">
                            <div className="grid grid-cols-1 gap-4 mb-6"><KpiCard title="Total Completed EENC Visits" value={overallKpis.totalVisits} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><KpiGridCard title="Overall EENC Adherence Scores (Average)" kpis={eencMainKpiGridList} cols={3} /><KpiLineChart title="EENC Adherence Over Time (Main KPIs)" chartData={eencChartData} kpiKeys={eencMainKpiChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="KPI 1: Infection Control (All Cases)" overallScore={calculateAverage([overallKpis.avgInfWash1, overallKpis.avgInfWash2, overallKpis.avgInfGloves])} kpis={eencInfectionKpis} /><KpiLineChart title="KPI 1 Over Time: Infection Control" chartData={eencChartData} kpiKeys={eencInfectionChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="KPI 2: Resuscitation Preparedness (All Cases)" overallScore={overallKpis.avgPreparation} kpis={eencPrepKpis} /><KpiLineChart title="KPI 2 Over Time: Preparedness" chartData={eencChartData} kpiKeys={eencPrepChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="KPI 3: Early Care (All Cases)" overallScore={overallKpis.avgDrying} kpis={eencCareKpis} /><KpiLineChart title="KPI 3 Over Time: Early Care" chartData={eencChartData} kpiKeys={eencCareChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="KPI 4: Cord Management (Breathing Babies)" overallScore={calculateAverage([overallKpis.avgCordHygiene, overallKpis.avgCordDelay, overallKpis.avgCordClamp])} kpis={eencCordKpis} /><KpiLineChart title="KPI 4 Over Time: Cord Mgmt" chartData={eencChartData} kpiKeys={eencCordChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="KPI 5: Breastfeeding (Breathing Babies)" overallScore={overallKpis.avgBfAdvice} kpis={eencBreastfeedingKpis} /><KpiLineChart title="KPI 5 Over Time: Breastfeeding" chartData={eencChartData} kpiKeys={eencBreastfeedingChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="KPI 6: Resuscitation Execution (Non-Breathing)" overallScore={overallKpis.avgResuscitation} kpis={eencResusExecKpis} /><KpiLineChart title="KPI 6 Over Time: Resuscitation" chartData={eencChartData} kpiKeys={eencResusExecChartKeys} /></div>
                            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">Overall EENC Adherence by State {scopeTitle}</h3>
                            <div className="mb-8"><KpiBarChart title="Overall EENC Adherence by State" chartData={stateKpis} /></div>
                            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">Detailed EENC Skill Performance {scopeTitle}</h3>
                            <div className="mb-8"><EENCCompactSkillsTable overallKpis={overallKpis} /></div>
                        </div>
                    )}

                     {activeEencTab === 'mothers' && (
                         <div className="animate-fade-in">
                            <div className="grid grid-cols-1 gap-4 mb-6"><KpiCard title="Total Mother Interviews" value={motherKpis?.totalMothers || 0} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Mother Interview: Skin-to-Skin Care" overallScore={calculateAverage([motherKpis?.avgSkinImm, motherKpis?.avgSkin90min])} kpis={eencMotherSkinKpis} /><KpiLineChart title="Skin-to-Skin Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherSkinChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Mother Interview: Breastfeeding" overallScore={calculateAverage([motherKpis?.avgBf1hr])} kpis={eencMotherBfKpis} /><KpiLineChart title="Breastfeeding Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherBfChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Mother Interview: Skin & Cord Care" overallScore={calculateAverage([motherKpis?.avgVitK, motherKpis?.avgEyeOint, motherKpis?.avgCordSubs])} kpis={eencMotherCareKpis} /><KpiLineChart title="Care Indicators Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherCareChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Mother Interview: Oiling & Bathing" overallScore={calculateAverage([motherKpis?.avgSkinOil, motherKpis?.avgBath6hr])} kpis={eencMotherHygieneKpis} /><KpiLineChart title="Hygiene Indicators Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherHygieneChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Mother Interview: Vaccination" overallScore={calculateAverage([motherKpis?.avgPolio, motherKpis?.avgBcg])} kpis={eencMotherVacKpis} /><KpiLineChart title="Vaccination Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherVacChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Mother Interview: Measurements" overallScore={calculateAverage([motherKpis?.avgWeight, motherKpis?.avgTemp])} kpis={eencMotherMeasureKpis} /><KpiLineChart title="Measurements Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherMeasureChartKeys} /></div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><DetailedKpiCard title="Mother Interview: Registration" overallScore={calculateAverage([motherKpis?.avgCivReg, motherKpis?.avgDisCard])} kpis={eencMotherRegKpis} /><KpiLineChart title="Registration Over Time" chartData={eencMotherChartData} kpiKeys={eencMotherRegChartKeys} /></div>
                            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">Overall Mother Interview Indicators by State {scopeTitle}</h3>
                            <div className="mb-8"><KpiBarChart title="Average Indicator Presence by State" chartData={motherStateKpis} /></div>
                            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">Detailed Mother Interview Performance {scopeTitle}</h3>
                            <div className="mb-8"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="EENC" /></div>
                         </div>
                     )}

                    {activeEencTab === 'visit_reports' && visitReportStats && (
                        <div className="animate-fade-in">
                            {/* 1. Total Card */}
                            <div className="grid grid-cols-1 gap-4 mb-6">
                                <KpiCard title="Total Visit Reports" value={visitReportStats.totalVisits} />
                            </div>

                            {/* 2. Table: Facility, Visits, Skills (Removed State/Locality) */}
                            <div className="mb-8 bg-white rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden">
                                <h4 className="text-lg font-bold text-sky-800 p-4 border-b bg-gray-50">Visit Breakdown & Skills Trained by Facility</h4>
                                <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 border">Facility</th>
                                            <th className="px-4 py-3 border text-center bg-blue-50">Total Visits</th>
                                            {visitReportStats.distinctSkillKeys.map(skillKey => (
                                                <th key={skillKey} className="px-2 py-3 border text-center break-words whitespace-normal text-xs">
                                                    {EENC_SKILLS_LABELS[skillKey] || skillKey}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visitReportStats.facilityTableData.map(row => (
                                            <tr key={row.id} className="hover:bg-gray-50 border-b">
                                                <td className="px-4 py-2 border font-medium">{row.facilityName}</td>
                                                <td className="px-4 py-2 border text-center font-bold bg-blue-50">{row.visitCount}</td>
                                                {visitReportStats.distinctSkillKeys.map(skillKey => (
                                                    <td key={skillKey} className="px-2 py-2 border text-center">
                                                        {row.skills[skillKey] || 0}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        {visitReportStats.facilityTableData.length === 0 && (
                                            <tr><td colSpan={2 + visitReportStats.distinctSkillKeys.length} className="p-4 text-center text-gray-500">No visits found for current filter.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>

                            {/* 3. Graph: Visits by State */}
                            <div className="mb-8">
                                <KpiBarChart title="Total Visits by State" chartData={visitReportStats.stateChartData} dataKey="count" />
                            </div>

                            {/* 4. Table: Problems and Solutions (UPDATED) */}
                            <div className="mb-8 bg-white rounded-lg shadow-lg border-2 border-gray-200">
                                <h4 className="text-lg font-bold text-sky-800 p-4 border-b bg-gray-50">Facility Problems & Solutions (Combined)</h4>
                                <div className="overflow-x-auto max-h-[600px]">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-gray-100 text-xs uppercase text-gray-700 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-2 py-3 border w-[15%]">Facility & Date</th>
                                                <th className="px-2 py-3 border w-[20%]">Problem / Challenge</th>
                                                <th className="px-2 py-3 border w-[20%]">Immediate Solution</th>
                                                <th className="px-2 py-3 border w-[10%]">Imm. Status</th>
                                                <th className="px-2 py-3 border w-[20%]">Long-term Solution</th>
                                                <th className="px-2 py-3 border w-[10%]">LT Status</th>
                                                <th className="px-2 py-3 border w-[5%]">Resp.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visitReportStats.problemsList.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 border-b border-gray-300">
                                                    <td className="px-2 py-2 border align-top text-xs">
                                                        <div className="font-bold text-gray-800">{item.facility}</div>
                                                        <div className="text-[10px] text-gray-500">{item.date}</div>
                                                    </td>
                                                    <td className="px-2 py-2 border align-top text-xs text-red-700 whitespace-pre-wrap">{item.problem}</td>
                                                    
                                                    {/* Immediate Solution Column */}
                                                    <td className="px-2 py-2 border align-top text-xs text-green-700 whitespace-pre-wrap">{item.immediate}</td>
                                                    <td className="px-2 py-2 border align-top text-center">
                                                        {renderStatusCell(item.immediate_status, item.reportId, item.challengeId, 'immediate_status')}
                                                    </td>

                                                    {/* Long-term Solution Column */}
                                                    <td className="px-2 py-2 border align-top text-xs text-blue-700 whitespace-pre-wrap">{item.longterm}</td>
                                                    <td className="px-2 py-2 border align-top text-center">
                                                        {renderStatusCell(item.long_term_status, item.reportId, item.challengeId, 'long_term_status')}
                                                    </td>

                                                    <td className="px-2 py-2 border align-top text-[10px] text-gray-600">{item.person}</td>
                                                </tr>
                                            ))}
                                            {visitReportStats.problemsList.length === 0 && (
                                                <tr><td colSpan="7" className="p-4 text-center text-gray-500">No problems recorded.</td></tr>
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