// MentorshipDashboard.jsx
import React, { useMemo, useCallback, useState } from 'react';
// --- MODIFICATION: Import Bar ---
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // <-- NEW IMPORT
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// --- *** THIS IS THE FIX (Part 1) *** ---
// --- Import the scoring logic to re-calculate old data ---
import { 
    IMNCI_FORM_STRUCTURE, 
    evaluateRelevance, 
    calculateScores, 
    rehydrateDraftData, 
    DIARRHEA_CLASSIFICATIONS, 
    FEVER_CLASSIFICATIONS 
} from './IMNCIFormPart.jsx';

// --- NEW EENC IMPORTS ---
import { 
    PREPARATION_ITEMS, 
    DRYING_STIMULATION_ITEMS, 
    NORMAL_BREATHING_ITEMS, 
    RESUSCITATION_ITEMS 
} from './EENCSkillsAssessmentForm.jsx'; // <-- IMPORT EENC STRUCTURE
// --- END EENC IMPORTS ---

// --- MODIFICATION: Register BarElement ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // <-- NEW
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

const ScoreText = ({ value, showPercentage = true }) => {
    let colorClass = 'text-gray-700';
    let text = 'N/A';

    if (value !== null && !isNaN(value) && isFinite(value)) {
        const percentage = Math.round(value * 100);
        if (percentage >= 80) {
            colorClass = 'text-green-600';
        } else if (percentage >= 50) {
            colorClass = 'text-yellow-600';
        } else {
            colorClass = 'text-red-600';
        }
        text = showPercentage ? `${percentage}%` : percentage.toString();
    }

    return (
        <span className={`font-bold text-sm ${colorClass}`}>
            {text}
        </span>
    );
};

const KpiCard = ({ title, value, unit = '', scoreValue = null }) => {
    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 text-center">
            <h4 className="text-sm font-medium text-gray-500 mb-2 h-10 flex items-center justify-center" title={title}>
                {title}
            </h4>
            <div className="flex items-baseline justify-center gap-1">
                {scoreValue !== null ? (
                    <ScoreText value={scoreValue} />
                ) : (
                    <span className="text-3xl font-bold text-sky-800">{value}</span>
                )}
                {unit && <span className="text-lg font-medium text-gray-600">{unit}</span>}
            </div>
        </div>
    );
};

const KpiGridItem = ({ title, scoreValue }) => (
    <div className="bg-gray-50 p-3 rounded-lg border text-center shadow-inner">
        <h5 className="text-xs font-medium text-gray-500 mb-1 h-8 flex items-center justify-center" title={title}>
            {title}
        </h5>
        <ScoreText value={scoreValue} />
    </div>
);

const KpiGridCard = ({ title, kpis, cols = 2 }) => (
    <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
        <h4 className="text-base font-bold text-sky-800 mb-3 text-center" title={title}>
            {title}
        </h4>
        <div className={`grid grid-cols-${cols} gap-3`}>
            {kpis.map(kpi => (
                <KpiGridItem key={kpi.title} title={kpi.title} scoreValue={kpi.scoreValue} />
            ))}
        </div>
    </div>
);

// --- START: NEW DetailedKpiCard Component ---
const DetailedKpiCard = ({ title, overallScore, kpis }) => (
    <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
        <div className="flex justify-between items-center mb-3">
            <h4 className="text-base font-bold text-sky-800 text-left" title={title}>
                {title}
            </h4>
            {overallScore !== null && (
                <div className="bg-gray-100 rounded-md px-2 py-0.5">
                    <ScoreText value={overallScore} />
                </div>
            )}
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
// --- END: NEW DetailedKpiCard Component ---

// --- START: Restored KpiLineChart Component ---
const KpiLineChart = ({ title, chartData, kpiKeys }) => {
    
    const colors = {
        'Overall': '#0ea5e9', // sky
        'Assessment': '#10b981', // green
        'Decision': '#f59e0b', // yellow
        'Treatment': '#ef4444', // red
        'Cough': '#6366f1', // indigo
        'Pneumonia': '#a855f7', // purple
        'Diarrhea (Classify)': '#ec4899', // pink
        'Diarrhea (Mgmt)': '#f97316', // orange
        'Weight': '#06b6d4', // cyan
        'Temp': '#3b82f6', // blue
        'Height': '#8b5cf6', // violet
        'Resp. Rate': '#14b8a6', // teal
        'RDT': '#d946ef', // fuchsia
        'MUAC': '#0891b2', // cyan-dark
        'WFH': '#0284c7', // sky-dark
        'Pallor': '#78716c', // stone
        'Referral Mgmt': '#be123c', // rose
        'Malaria Class.': '#65a30d', // lime
        'Malaria Mgmt': '#84cc16', // lime-light
        'Malnutrition Mgmt': '#ca8a04', // amber
        'Anemia Mgmt': '#dc2626', // red
        'Referral ID': '#f43f5e', // rose-dark
        'Malnutrition ID': '#eab308', // yellow-dark
        'DangerSigns': '#f97316', // orange

        // --- NEW EENC Colors ---
        'Preparation': '#10b981', // green
        'Drying': '#3b82f6', // blue
        'Breathing Mgmt': '#f59e0b', // yellow
        'Resuscitation': '#ef4444', // red
        // --- END EENC Colors ---
    };

    const data = {
        labels: chartData.map(d => d.name),
        datasets: kpiKeys.map(kpi => ({
            label: kpi.title,
            data: chartData.map(d => d[kpi.key]),
            borderColor: colors[kpi.key] || '#6b7280',
            backgroundColor: (colors[kpi.key] || '#6b7280') + '33', // Add alpha
            fill: false,
            tension: 0.1,
            pointRadius: 1,
            borderWidth: 2,
        })),
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    fontSize: 10,
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    callback: (value) => `${value}%`, // Add percent sign
                },
            },
            x: {
                ticks: {
                    maxTicksLimit: 10, 
                    autoSkip: true,
                    maxRotation: 45, 
                    minRotation: 0,
                }
            }
        },
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
            <h4 className="text-base font-bold text-sky-800 mb-3 text-center">
                {title}
            </h4>
            <div className="relative h-[280px]">
                {chartData.length > 0 ? (
                    <Line options={options} data={data} />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        No data available for this period.
                    </div>
                )}
            </div>
        </div>
    );
};
// --- END: Restored KpiLineChart Component ---


// --- START: NEW KpiCardWithChart Component ---
const KpiCardWithChart = ({ title, kpis, chartData, kpiKeys, cols = 2 }) => {
    
    // Color mapping for all possible chart keys
    const colors = {
        'Overall': '#0ea5e9', // sky
        'Assessment': '#10b981', // green
        'Decision': '#f59e0b', // yellow
        'Treatment': '#ef4444', // red
        'Cough': '#6366f1', // indigo
        'Pneumonia': '#a855f7', // purple
        'Diarrhea (Classify)': '#ec4899', // pink
        'Diarrhea (Mgmt)': '#f97316', // orange
        'Weight': '#06b6d4', // cyan
        'Temp': '#3b82f6', // blue
        'Height': '#8b5cf6', // violet
        'Resp. Rate': '#14b8a6', // teal
        'RDT': '#d946ef', // fuchsia
        'MUAC': '#0891b2', // cyan-dark
        'WFH': '#0284c7', // sky-dark
        'Pallor': '#78716c', // stone
        'Referral Mgmt': '#be123c', // rose
        'Malaria Class.': '#65a30d', // lime
        'Malaria Mgmt': '#84cc16', // lime-light
        'Malnutrition Mgmt': '#ca8a04', // amber
        'Anemia Mgmt': '#dc2626', // red
        'Referral ID': '#f43f5e', // rose-dark
        'Malnutrition ID': '#eab308', // yellow-dark
        'Danger Signs': '#f97316', // orange
    };

    const data = {
        labels: chartData.map(d => d.name),
        datasets: kpiKeys.map(kpi => ({
            label: kpi.title,
            data: chartData.map(d => d[kpi.key]),
            borderColor: colors[kpi.key] || '#6b7280',
            backgroundColor: (colors[kpi.key] || '#6b7280') + '33', // Add alpha
            fill: false,
            tension: 0.1,
            pointRadius: 1,
            borderWidth: 2,
        })),
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    fontSize: 10,
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    callback: (value) => `${value}%`, // Add percent sign
                },
            },
            x: {
                ticks: {
                    maxTicksLimit: 10, 
                    autoSkip: true,
                    maxRotation: 45, 
                    minRotation: 0,
                }
            }
        },
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
            {/* 1. Title */}
            <h4 className="text-base font-bold text-sky-800 mb-3 text-center" title={title}>
                {title}
            </h4>
            {/* 2. KPI Grid */}
            <div className={`grid grid-cols-${cols} gap-3 mb-4`}>
                {kpis.map(kpi => (
                    <KpiGridItem key={kpi.title} title={kpi.title} scoreValue={kpi.scoreValue} />
                ))}
            </div>
            {/* 3. Line Chart */}
            <div className="relative h-[250px]">
                {chartData.length > 0 ? (
                    <Line options={options} data={data} />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        No data available for this period.
                    </div>
                )}
            </div>
        </div>
    );
};
// --- END: NEW KpiCardWithChart Component ---

const KpiBarChart = ({ title, chartData }) => {
    
    const getBarColor = (value) => {
        if (value >= 80) return '#10b981'; // green
        if (value >= 50) return '#f59e0b'; // yellow
        if (value < 50) return '#ef4444'; // red
        return '#6b7280'; // gray
    };

    const data = {
        labels: chartData.map(d => d.stateName),
        datasets: [
            {
                label: 'Overall Adherence',
                data: chartData.map(d => d.avgOverall ? Math.round(d.avgOverall * 100) : null),
                backgroundColor: chartData.map(d => getBarColor(d.avgOverall ? d.avgOverall * 100 : 0)),
                borderColor: '#ffffff',
                borderWidth: 1,
            }
        ],
    };

    const options = {
        indexAxis: 'y', // <-- Makes it a horizontal bar chart
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false, // Hide legend since there's only one dataset
            },
            tooltip: {
                callbacks: {
                    label: (context) => `${context.dataset.label}: ${context.raw}%`
                }
            },
        },
        scales: {
            x: { // <-- Horizontal axis is now 'x'
                beginAtZero: true,
                max: 100,
                ticks: {
                    callback: (value) => `${value}%`, // Add percent sign
                },
            },
            y: { // <-- Vertical axis is now 'y'
                ticks: {
                    autoSkip: false,
                    font: {
                        size: 10
                    }
                }
            }
        },
    };

    // Calculate dynamic height
    const chartHeight = Math.max(280, chartData.length * 25); // 25px per bar, min 280px

    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
            <h4 className="text-base font-bold text-sky-800 mb-3 text-center">
                {title}
            </h4>
            <div className="relative" style={{ height: `${chartHeight}px` }}>
                {chartData.length > 0 ? (
                    <Bar options={options} data={data} />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        No data available for this period.
                    </div>
                )}
            </div>
        </div>
    );
};
// --- END: NEW KpiBarChart Component ---


// --- START: IMNCI Compact Skills Table Component ---

const SKILL_LABEL_MAP = {
    'skill_ask_cough': 'هل سأل عن وجود الكحة أو ضيق التنفس',
    'skill_check_rr': 'هل قاس معدل التنفس بصورة صحيحة',
    'skill_classify_cough': 'هل صنف الكحة بصورة صحيحة',
    'skill_ask_diarrhea': 'هل سأل عن وجود الاسهال',
    'skill_check_dehydration': 'هل قيم فقدان السوائل بصورة صحيحة',
    'skill_classify_diarrhea': 'هل صنف الاسهال بصورة صحيحة',
    'skill_ask_fever': 'هل سأل عن وجود الحمى',
    'skill_check_rdt': 'هل أجرى فحص الملاريا السريع بصورة صحيحة',
    'skill_classify_fever': 'هل صنف الحمى بصورة صحيحة',
    'skill_ask_ear': 'هل سأل عن وجود مشكلة في الأذن',
    'skill_check_ear': 'هل فحص الفحص ورم مؤلم خلف الأذن',
    'skill_classify_ear': 'هل صنف مشكلة الأذن بصورة صحيحة',
};

const CompactSkillRow = ({ label, stats }) => {
    const yes = stats?.yes || 0;
    const no = stats?.no || 0;
    const total = yes + no;
    const percentage = total > 0 ? (yes / total) : null;

    return (
        <tr className="bg-white hover:bg-gray-50">
            <td className="p-1.5 text-xs font-medium text-gray-700 border border-gray-300 w-3/5">{label}</td>
            <td className="p-1.5 text-xs font-semibold text-gray-800 border border-gray-300 w-1/5 text-center">{yes} / {total}</td>
            <td className="p-1.5 border border-gray-300 w-1/5 text-center">
                <ScoreText value={percentage} />
            </td>
        </tr>
    );
};

const CompactSkillsTable = ({ overallKpis }) => {
    const skillStats = overallKpis?.skillStats;

    // Map scoreKeys to their average values from overallKpis
    const subgroupScoreMap = {
        vitalSigns: overallKpis.avgVitalSigns,
        dangerSigns: overallKpis.avgDangerSigns,
        mainSymptoms: overallKpis.avgMainSymptoms,
        malnutrition: overallKpis.avgMalnutrition,
        anemia: overallKpis.avgAnemia,
        immunization: overallKpis.avgImmunization,
        otherProblems: overallKpis.avgOtherProblems,
        symptom_cough: overallKpis.avgSymptomCough,
        symptom_diarrhea: overallKpis.avgSymptomDiarrhea,
        symptom_fever: overallKpis.avgSymptomFever,
        symptom_ear: overallKpis.avgSymptomEar,
        ref_treatment: overallKpis.avgReferralManagement,
        pneu_treatment: overallKpis.avgPneumoniaManagement,
        diar_treatment: overallKpis.avgDiarrheaManagement,
        mal_treatment: overallKpis.avgMalariaManagement,
        nut_treatment: overallKpis.avgMalnutritionManagement,
        anemia_treatment: overallKpis.avgAnemiaManagement,
        dyst_treatment: overallKpis.avgDystTreatment,
        ear_treatment: overallKpis.avgEarTreatment,
        fu_treatment: overallKpis.avgFuTreatment,
    };

    if (!overallKpis || !skillStats || Object.keys(skillStats).length === 0) {
        return (
            <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 text-center text-gray-500">
                No detailed skill data available for the current filters.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200" dir="rtl">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50">
                        <th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-3/5 text-right">المهارة</th>
                        <th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">العدد (نعم / الإجمالي)</th>
                        <th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">النسبة</th>
                    </tr>
                </thead>
                <tbody>
                    {IMNCI_FORM_STRUCTURE.map(group => {
                        let groupAggregateScore = null;
                        if (group.group.includes('التقييم والتصنيف')) {
                            groupAggregateScore = overallKpis.avgAssessment;
                        } else if (group.isDecisionSection) {
                            groupAggregateScore = overallKpis.avgDecision;
                        } else if (group.group.includes('العلاج والنصح')) {
                            groupAggregateScore = overallKpis.avgTreatment;
                        }

                        return (
                            <React.Fragment key={group.group}>
                                <tr className="bg-sky-900 text-white">
                                    <td className="p-1 text-sm font-bold text-right border border-gray-300" colSpan="2">
                                        {group.group}
                                    </td>
                                    <td className="p-1 border border-gray-300 text-center">
                                        {groupAggregateScore !== null && (
                                            <div className="bg-white rounded-md px-2 py-0.5 inline-block">
                                                <ScoreText value={groupAggregateScore} />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                
                                {/* Subgroup Rows and Skill Rows */}
                                {group.subgroups?.map(subgroup => {
                                    
                                    if (subgroup.isSymptomGroupContainer) {
                                        return subgroup.symptomGroups.map(symptomGroup => {
                                            const symptomKey = symptomGroup.mainSkill.scoreKey; // e.g., 'symptom_cough'
                                            const symptomScore = subgroupScoreMap[symptomKey];
                                            const symptomLabel = symptomGroup.mainSkill.label; // e.g., 'هل سأل عن وجود الكحة...'

                                            let skillsToRender = [];
                                            if (symptomKey === 'symptom_cough') {
                                                skillsToRender = ['skill_ask_cough', 'skill_check_rr', 'skill_classify_cough'];
                                            } else if (symptomKey === 'symptom_diarrhea') {
                                                skillsToRender = ['skill_ask_diarrhea', 'skill_check_dehydration', 'skill_classify_diarrhea'];
                                            } else if (symptomKey === 'symptom_fever') {
                                                skillsToRender = ['skill_ask_fever', 'skill_check_rdt', 'skill_classify_fever'];
                                            } else if (symptomKey === 'symptom_ear') {
                                                skillsToRender = ['skill_ask_ear', 'skill_check_ear', 'skill_classify_ear'];
                                            }

                                            return (
                                                <React.Fragment key={symptomKey}>
                                                    <tr className="bg-sky-700 text-white">
                                                        <td className="p-1.5 text-xs font-bold text-right border border-gray-300" colSpan="2">
                                                            {symptomLabel}
                                                        </td>
                                                        <td className="p-1.5 border border-gray-300 text-center">
                                                            {symptomScore !== null && (
                                                                <div className="bg-white rounded-md px-2 py-0.5 inline-block">
                                                                    <ScoreText value={symptomScore} />
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    {skillsToRender.map(skillKey => (
                                                        <CompactSkillRow
                                                            key={skillKey}
                                                            label={SKILL_LABEL_MAP[skillKey]}
                                                            stats={skillStats[skillKey]}
                                                        />
                                                    ))}
                                                </React.Fragment>
                                            );
                                        });
                                    }

                                    const subgroupKey = subgroup.scoreKey || subgroup.subgroupTitle;
                                    const subgroupScore = subgroup.scoreKey ? subgroupScoreMap[subgroupKey] : null;

                                    return (
                                        <React.Fragment key={subgroup.subgroupTitle}>
                                            <tr className="bg-sky-700 text-white">
                                                <td className="p-1.5 text-xs font-bold text-right border border-gray-300" colSpan="2">
                                                    {subgroup.subgroupTitle}
                                                </td>
                                                <td className="p-1.5 border border-gray-300 text-center">
                                                    {subgroupScore !== null && (
                                                        <div className="bg-white rounded-md px-2 py-0.5 inline-block">
                                                            <ScoreText value={subgroupScore} />
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            
                                            {subgroup.skills?.map(skill => (
                                                <CompactSkillRow
                                                    key={skill.key}
                                                    label={skill.label}
                                                    stats={skillStats[skill.key]}
                                                />
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                                
                                {group.isDecisionSection && (
                                    <CompactSkillRow
                                        label="هل يتطابق قرار العامل الصحي مع المشرف؟"
                                        stats={skillStats['decisionMatches']}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
// --- END: IMNCI Compact Skills Table Component ---


// --- START: NEW EENC Compact Skills Table Component ---
const EENCCompactSkillRow = ({ label, stats }) => {
    const yes = stats?.yes || 0;
    const partial = stats?.partial || 0;
    const no = stats?.no || 0;
    const na = stats?.na || 0;
    
    const totalResponses = yes + partial + no;
    const score = (yes * 2) + (partial * 1);
    const maxScore = totalResponses * 2;
    
    const percentage = maxScore > 0 ? (score / maxScore) : null;

    return (
        <tr className="bg-white hover:bg-gray-50">
            <td className="p-1.5 text-xs font-medium text-gray-700 border border-gray-300 w-3/5">{label}</td>
            <td className="p-1.5 text-xs font-semibold text-gray-800 border border-gray-300 w-1/5 text-center">
                {/* Show Yes / Partial / No counts */}
                <span title="نعم">{yes}</span> / <span title="جزئياً">{partial}</span> / <span title="لا">{no}</span>
                {/* <span className="text-green-600" title="نعم">{yes}</span> / <span className="text-yellow-600" title="جزئياً">{partial}</span> / <span className="text-red-600" title="لا">{no}</span> */}
            </td>
            <td className="p-1.5 border border-gray-300 w-1/5 text-center">
                <ScoreText value={percentage} />
            </td>
        </tr>
    );
};

const EENCCompactSkillsTable = ({ overallKpis }) => {
    const skillStats = overallKpis?.skillStats;

    if (!overallKpis || !skillStats || Object.keys(skillStats).length === 0) {
        return (
            <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 text-center text-gray-500">
                No detailed EENC skill data available for the current filters.
            </div>
        );
    }

    const sections = [
        { title: 'تحضيرات ما قبل الولادة', items: PREPARATION_ITEMS, score: overallKpis.avgPreparation },
        { title: 'التجفيف، التحفيز، التدفئة والشفط', items: DRYING_STIMULATION_ITEMS, score: overallKpis.avgDrying },
        { title: 'متابعة طفل يتنفس طبيعياً', items: NORMAL_BREATHING_ITEMS, score: overallKpis.avgNormalBreathing },
        { title: 'إنعاش الوليد (الدقيقة الذهبية)', items: RESUSCITATION_ITEMS, score: overallKpis.avgResuscitation },
    ];

    return (
        <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200" dir="rtl">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50">
                        <th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-3/5 text-right">المهارة (EENC)</th>
                        <th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">العدد (نعم / جزئياً / لا)</th>
                        <th className="p-1.5 text-xs font-bold text-gray-600 border border-gray-300 w-1/5 text-center">النسبة</th>
                    </tr>
                </thead>
                <tbody>
                    {sections.map(section => {
                        // Only render sections that have data (i.e., at least one skill was not 'na')
                        const hasData = section.items.some(item => skillStats[item.key] && (skillStats[item.key].yes > 0 || skillStats[item.key].partial > 0 || skillStats[item.key].no > 0));
                        if (!hasData) return null;

                        return (
                            <React.Fragment key={section.title}>
                                <tr className="bg-sky-900 text-white">
                                    <td className="p-1 text-sm font-bold text-right border border-gray-300" colSpan="2">
                                        {section.title}
                                    </td>
                                    <td className="p-1 border border-gray-300 text-center">
                                        {section.score !== null && (
                                            <div className="bg-white rounded-md px-2 py-0.5 inline-block">
                                                <ScoreText value={section.score} />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                {section.items.map(item => (
                                    <EENCCompactSkillRow
                                        key={item.key}
                                        label={item.label}
                                        stats={skillStats[item.key]}
                                    />
                                ))}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
// --- END: NEW EENC Compact Skills Table Component ---


// --- Filter Helper Component ---
const FilterSelect = ({ label, value, onChange, options, disabled = false, defaultOption }) => (
    <div>
        <label htmlFor={label} className="block text-sm font-medium text-gray-700">
            {label}
        </label>
        <select
            id={label}
            name={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"
        >
            <option value="">{defaultOption}</option>
            {options.map(option => (
                <option key={option.key || option} value={option.key || option}>
                    {option.name || option}
                </option>
            ))}
        </select>
    </div>
);


// --- Mentorship Dashboard Component ---
const MentorshipDashboard = ({ 
    allSubmissions, 
    STATE_LOCALITIES, 
    activeService,
    activeState,
    onStateChange,
    activeLocality,
    onLocalityChange,
    activeFacilityId,
    onFacilityIdChange,
    activeWorkerName,
    onWorkerNameChange
}) => {

    // 1. Helper function to calculate average
    const calculateAverage = (scores) => {
        const validScores = scores.filter(s => isFinite(s) && !isNaN(s) && s !== null);
        if (validScores.length === 0) return null;
        const sum = validScores.reduce((a, b) => a + b, 0);
        return sum / validScores.length;
    };

    // --- *** THIS IS THE FIX (Part 2) *** ---
    // --- NEW: Re-calculate old/buggy scores on the fly ---
    const reCalculatedSubmissions = useMemo(() => {
        if (!allSubmissions) return [];
        
        return allSubmissions.map(sub => {
            // Check if this submission is an IMNCI 'skills' form
            if (sub.service !== 'IMNCI' || !sub.fullData) {
                return sub; // Not an IMNCI form, or has no raw data, return as-is
            }

            const s = sub.scores || {};
            
            // Check if it's OLD data (missing the new treatment key)
            if (s.treatment_total_score_maxScore === undefined) {
                try {
                    // This is old data, we must re-calculate
                    const rehydratedData = rehydrateDraftData(sub.fullData, DIARRHEA_CLASSIFICATIONS, FEVER_CLASSIFICATIONS);
                    const reCalculatedScores = calculateScores(rehydratedData);

                    // Build a new scores object in the correct format
                    const newScoresPayload = {};
                    for (const key in reCalculatedScores) { 
                        if (key !== 'treatmentScoreForSave' && reCalculatedScores[key]?.score !== undefined && reCalculatedScores[key]?.maxScore !== undefined) {
                            newScoresPayload[`${key}_score`] = reCalculatedScores[key].score;
                            newScoresPayload[`${key}_maxScore`] = reCalculatedScores[key].maxScore;
                        }
                    }
                    
                    // Return a new submission object with the *fixed* scores
                    return {
                        ...sub,
                        scores: newScoresPayload
                    };

                } catch (e) {
                    console.error("Failed to re-calculate score for old submission:", sub.id, e);
                    return sub; // Return original on error
                }
            }

            // This is NEW data, it's already correct.
            return sub;
        });
    }, [allSubmissions]);
    // --- END: Re-calculation ---


    // 2. --- MODIFIED: kpiHelper now calculates all subgroup averages ---
    const imnciKpiHelper = useCallback((submissions) => {
        // This object will hold arrays of scores for averaging
        const scores = {
            overall: [], assessment: [], decision: [], treatment: [],
            coughClassification: [], pneumoniaManagement: [], diarrheaClassification: [], diarrheaManagement: [],
            handsOnWeight: [], handsOnTemp: [], handsOnHeight: [], handsOnRR: [], handsOnRDT: [], handsOnMUAC: [], handsOnWFH: [],
            referralCaseCount: [], referralManagement: [], malariaClassification: [], malariaManagement: [],
            malnutritionCaseCount: [], malnutritionManagement: [], anemiaManagement: [],
            
            vitalSigns: [], dangerSigns: [], mainSymptoms: [], malnutrition: [], anemia: [], immunization: [], otherProblems: [],
            symptom_cough: [], symptom_diarrhea: [], symptom_fever: [], symptom_ear: [],
            ref_treatment: [], pneu_treatment: [], diar_treatment: [], dyst_treatment: [], mal_treatment: [],
            ear_treatment: [], nut_treatment: [], anemia_treatment: [], fu_treatment: [],
            handsOnPallor: [],
            // --- NEW: Add aggregate arrays ---
            measurementSkills: [],
            malnutritionAnemiaSkills: [],
        };
        let totalVisits = submissions.length;
        const skillStats = {};

        submissions.forEach(sub => {
            const s = sub.scores; // This is the scoresPayload from the database
            if (!s) return;
            
            // --- Aggregate KPIs ---
            if (s.overallScore_maxScore > 0) scores.overall.push(s.overallScore_score / s.overallScore_maxScore);
            if (s.assessment_total_score_maxScore > 0) scores.assessment.push(s.assessment_total_score_score / s.assessment_total_score_maxScore);
            if (s.finalDecision_maxScore > 0) scores.decision.push(s.finalDecision_score / s.finalDecision_maxScore);
            
            // --- *** THIS IS THE FIX (Part 3) *** ---
            // --- FIX: Only read the correct "_total_score" keys ---
            // (The data is now clean thanks to reCalculatedSubmissions)
            if (s.treatment_total_score_maxScore > 0) {
                scores.treatment.push(s.treatment_total_score_score / s.treatment_total_score_maxScore);
            }
            // --- *** END OF FIX *** ---

            if (s.coughClassification_maxScore > 0) scores.coughClassification.push(s.coughClassification_score / s.coughClassification_maxScore);
            if (s.pneumoniaManagement_maxScore > 0) scores.pneumoniaManagement.push(s.pneumoniaManagement_score / s.pneumoniaManagement_maxScore);
            if (s.diarrheaClassification_maxScore > 0) scores.diarrheaClassification.push(s.diarrheaClassification_score / s.diarrheaClassification_maxScore);
            if (s.diarrheaManagement_maxScore > 0) scores.diarrheaManagement.push(s.diarrheaManagement_score / s.diarrheaManagement_maxScore);
            if (s.handsOnWeight_maxScore > 0) scores.handsOnWeight.push(s.handsOnWeight_score / s.handsOnWeight_maxScore);
            if (s.handsOnTemp_maxScore > 0) scores.handsOnTemp.push(s.handsOnTemp_score / s.handsOnTemp_maxScore);
            if (s.handsOnHeight_maxScore > 0) scores.handsOnHeight.push(s.handsOnHeight_score / s.handsOnHeight_maxScore);
            if (s.handsOnRR_maxScore > 0) scores.handsOnRR.push(s.handsOnRR_score / s.handsOnRR_maxScore);
            if (s.handsOnRDT_maxScore > 0) scores.handsOnRDT.push(s.handsOnRDT_score / s.handsOnRDT_maxScore);
            if (s.handsOnMUAC_maxScore > 0) scores.handsOnMUAC.push(s.handsOnMUAC_score / s.handsOnMUAC_maxScore);
            if (s.handsOnWFH_maxScore > 0) scores.handsOnWFH.push(s.handsOnWFH_score / s.handsOnWFH_maxScore);
            if (s.referralCaseCount_maxScore > 0) scores.referralCaseCount.push(s.referralCaseCount_score / s.referralCaseCount_maxScore);
            if (s.referralManagement_maxScore > 0) scores.referralManagement.push(s.referralManagement_score / s.referralManagement_maxScore);
            if (s.malariaClassification_maxScore > 0) scores.malariaClassification.push(s.malariaClassification_score / s.malariaClassification_maxScore);
            if (s.malariaManagement_maxScore > 0) scores.malariaManagement.push(s.malariaManagement_score / s.malariaManagement_maxScore);
            if (s.malnutritionCaseCount_maxScore > 0) scores.malnutritionCaseCount.push(s.malnutritionCaseCount_score / s.malnutritionCaseCount_maxScore);
            if (s.malnutritionManagement_maxScore > 0) scores.malnutritionManagement.push(s.malnutritionManagement_score / s.malnutritionManagement_maxScore);
            if (s.anemiaManagement_maxScore > 0) scores.anemiaManagement.push(s.anemiaManagement_score / s.anemiaManagement_maxScore);
            
            // --- NEW: Subgroup KPIs ---
            Object.keys(scores).forEach(key => {
                const maxScoreKey = `${key}_maxScore`;
                const scoreKey = `${key}_score`;
                if (s[maxScoreKey] !== undefined && s[scoreKey] !== undefined && s[maxScoreKey] > 0) {
                    if (!['overall', 'assessment', 'decision', 'treatment', 'coughClassification', 'pneumoniaManagement', 'diarrheaClassification', 'diarrheaManagement', 'handsOnWeight', 'handsOnTemp', 'handsOnHeight', 'handsOnRR', 'handsOnRDT', 'handsOnMUAC', 'handsOnWFH', 'referralCaseCount', 'referralManagement', 'malariaClassification', 'malariaManagement', 'malnutritionCaseCount', 'malnutritionManagement', 'anemiaManagement', 'handsOnPallor', 'measurementSkills', 'malnutritionAnemiaSkills'].includes(key)) {
                        scores[key].push(s[scoreKey] / s[maxScoreKey]);
                    }
                }
            });

            // --- Detailed Skill Stats ---
            const as = sub.fullData?.assessmentSkills;
            const ts = sub.fullData?.treatmentSkills;
            
            const rehydrateMultiSelect = (classifications, savedData) => {
                if (!savedData) return {};
                if (Array.isArray(savedData)) {
                    return classifications.reduce((acc, c) => {
                        acc[c] = savedData.includes(c);
                        return acc;
                    }, {});
                }
                return savedData; 
            };

            const formData = {
                ...sub.fullData,
                assessment_skills: {
                    ...as,
                    worker_diarrhea_classification: rehydrateMultiSelect(
                        ['جفاف شديد', 'بعض الجفاف', 'لا يوجد جفاف', 'إسهال مستمر شديد', 'إسهال مستمر', 'دسنتاريا'],
                        as?.worker_diarrhea_classification
                    ),
                    supervisor_correct_diarrhea_classification: rehydrateMultiSelect(
                        ['جفاف شديد', 'بعض الجفاف', 'لا يوجد جفاف', 'إسهال مستمر شديد', 'إسهال مستمر', 'دسنتاريا'],
                        as?.supervisor_correct_diarrhea_classification
                    ),
                    worker_fever_classification: rehydrateMultiSelect(
                        ['مرض حمي شديد', 'ملاريا', 'حمى لا توجد ملAR', 'حصبة مصحوبة بمضاعفات شديدة', 'حصبة مصحوبة بمضاعفات في العين والفم', 'حصبة'],
                        as?.worker_fever_classification
                    ),
                    supervisor_correct_fever_classification: rehydrateMultiSelect(
                        ['مرض حمي شديد', 'ملارIA', 'حمى لا توجد ملAR', 'حصبة مصحوبة بمضاعفات شديدة', 'حصبة مصحوبة بمضاعفات في العين والفم', 'حصبة'],
                        as?.supervisor_correct_fever_classification
                    ),
                },
                treatment_skills: ts
            };

            if (as && ts) {
                if (as['skill_anemia_pallor'] === 'yes') scores.handsOnPallor.push(1);
                if (as['skill_anemia_pallor'] === 'no') scores.handsOnPallor.push(0);

                // --- NEW: Populate aggregate skill arrays ---
                if (s.handsOnWeight_maxScore > 0) scores.measurementSkills.push(s.handsOnWeight_score / s.handsOnWeight_maxScore);
                if (s.handsOnTemp_maxScore > 0) scores.measurementSkills.push(s.handsOnTemp_score / s.handsOnTemp_maxScore);
                if (s.handsOnHeight_maxScore > 0) scores.measurementSkills.push(s.handsOnHeight_score / s.handsOnHeight_maxScore);
                if (s.handsOnRR_maxScore > 0) scores.measurementSkills.push(s.handsOnRR_score / s.handsOnRR_maxScore);

                if (s.handsOnMUAC_maxScore > 0) scores.malnutritionAnemiaSkills.push(s.handsOnMUAC_score / s.handsOnMUAC_maxScore);
                if (s.handsOnWFH_maxScore > 0) scores.malnutritionAnemiaSkills.push(s.handsOnWFH_score / s.handsOnWFH_maxScore);
                if (as['skill_anemia_pallor'] === 'yes') scores.malnutritionAnemiaSkills.push(1);
                if (as['skill_anemia_pallor'] === 'no') scores.malnutritionAnemiaSkills.push(0);
                // --- END NEW ---

                IMNCI_FORM_STRUCTURE.forEach(group => {
                    if (group.sectionKey === 'assessment_skills') {
                        group.subgroups?.forEach(subgroup => {
                            subgroup.skills?.forEach(skill => {
                                const key = skill.key;
                                const value = as[key];
                                if (!skillStats[key]) skillStats[key] = { yes: 0, no: 0 };
                                if (value === 'yes') skillStats[key].yes++;
                                if (value === 'no') skillStats[key].no++;
                            });
                            if (subgroup.isSymptomGroupContainer) {
                                subgroup.symptomGroups.forEach(sg => {
                                    const prefix = sg.mainSkill.key.split('_')[2];
                                    const askKey = `skill_ask_${prefix}`;
                                    const checkKey = `skill_check_${prefix === 'cough' ? 'rr' : prefix === 'diarrhea' ? 'dehydration' : prefix === 'fever' ? 'rdt' : 'ear'}`;
                                    const classifyKey = `skill_classify_${prefix}`;
                                    [askKey, checkKey, classifyKey].forEach(key => {
                                        const value = as[key];
                                        if (!skillStats[key]) skillStats[key] = { yes: 0, no: 0 };
                                        if (value === 'yes') skillStats[key].yes++;
                                        if (value === 'no') skillStats[key].no++;
                                    });
                                });
                            }
                        });
                    } else if (group.sectionKey === 'treatment_skills') {
                        group.subgroups?.forEach(subgroup => {
                            let isSubgroupRelevant = true;
                            if (subgroup.relevant) {
                                if (typeof subgroup.relevant === 'function') {
                                    isSubgroupRelevant = subgroup.relevant(formData);
                                } else if (typeof subgroup.relevant === 'string') {
                                    isSubgroupRelevant = evaluateRelevance(subgroup.relevant, formData);
                                }
                            }
                            subgroup.skills?.forEach(skill => {
                                let isSkillRelevant = isSubgroupRelevant;
                                if (isSkillRelevant && skill.relevant) {
                                    if (typeof skill.relevant === 'function') {
                                        isSkillRelevant = skill.relevant(formData);
                                    } else if (typeof skill.relevant === 'string') {
                                        isSkillRelevant = evaluateRelevance(skill.relevant, formData);
                                    }
                                }
                                const key = skill.key;
                                if (isSkillRelevant) {
                                    const value = ts[key];
                                    if (!skillStats[key]) skillStats[key] = { yes: 0, no: 0 };
                                    if (value === 'yes') skillStats[key].yes++;
                                    if (value === 'no') skillStats[key].no++;
                                } else {
                                    if (!skillStats[key]) skillStats[key] = { yes: 0, no: 0 };
                                }
                            });
                        });
                    } else if (group.isDecisionSection) {
                        const key = 'decisionMatches';
                        const value = sub.fullData?.[key];
                        if (!skillStats[key]) skillStats[key] = { yes: 0, no: 0 };
                        if (value === 'yes') skillStats[key].yes++;
                        if (value === 'no') skillStats[key].no++;
                    }
                });
            }
        });

        // --- Calculate Averages ---
        const averages = {
            totalVisits,
            skillStats,
            avgOverall: calculateAverage(scores.overall),
            avgAssessment: calculateAverage(scores.assessment),
            avgDecision: calculateAverage(scores.decision),
            avgTreatment: calculateAverage(scores.treatment),
            avgCoughClassification: calculateAverage(scores.coughClassification),
            avgPneumoniaManagement: calculateAverage(scores.pneumoniaManagement),
            avgDiarrheaClassification: calculateAverage(scores.diarrheaClassification),
            avgDiarrheaManagement: calculateAverage(scores.diarrheaManagement),
            avgHandsOnWeight: calculateAverage(scores.handsOnWeight),
            avgHandsOnTemp: calculateAverage(scores.handsOnTemp),
            avgHandsOnHeight: calculateAverage(scores.handsOnHeight),
            avgHandsOnRR: calculateAverage(scores.handsOnRR),
            avgHandsOnRDT: calculateAverage(scores.handsOnRDT),
            avgHandsOnMUAC: calculateAverage(scores.handsOnMUAC),
            avgHandsOnWFH: calculateAverage(scores.handsOnWFH),
            avgReferralCaseCount: calculateAverage(scores.referralCaseCount),
            avgReferralManagement: calculateAverage(scores.referralManagement),
            avgMalariaClassification: calculateAverage(scores.malariaClassification),
            avgMalariaManagement: calculateAverage(scores.malariaManagement),
            avgMalnutritionCaseCount: calculateAverage(scores.malnutritionCaseCount),
            avgMalnutritionManagement: calculateAverage(scores.malnutritionManagement),
            avgAnemiaManagement: calculateAverage(scores.anemiaManagement),
            avgVitalSigns: calculateAverage(scores.vitalSigns),
            avgDangerSigns: calculateAverage(scores.dangerSigns),
            avgMainSymptoms: calculateAverage(scores.mainSymptoms),
            avgMalnutrition: calculateAverage(scores.malnutrition),
            avgAnemia: calculateAverage(scores.anemia),
            avgImmunization: calculateAverage(scores.immunization),
            avgOtherProblems: calculateAverage(scores.otherProblems),
            avgSymptomCough: calculateAverage(scores.symptom_cough),
            avgSymptomDiarrhea: calculateAverage(scores.symptom_diarrhea),
            avgSymptomFever: calculateAverage(scores.symptom_fever),
            avgSymptomEar: calculateAverage(scores.symptom_ear),
            avgRefTreatment: calculateAverage(scores.ref_treatment),
            avgPneuTreatment: calculateAverage(scores.pneu_treatment),
            avgDiarTreatment: calculateAverage(scores.diar_treatment),
            avgDystTreatment: calculateAverage(scores.dyst_treatment),
            avgMalTreatment: calculateAverage(scores.mal_treatment),
            avgEarTreatment: calculateAverage(scores.ear_treatment),
            avgNutTreatment: calculateAverage(scores.nut_treatment),
            avgAnemiaTreatment: calculateAverage(scores.anemia_treatment),
            avgFuTreatment: calculateAverage(scores.fu_treatment),
            avgHandsOnPallor: calculateAverage(scores.handsOnPallor),
            
            // --- NEW: Add aggregate skill averages ---
            avgMeasurementSkills: calculateAverage(scores.measurementSkills),
            avgMalnutritionAnemiaSkills: calculateAverage(scores.malnutritionAnemiaSkills),
        };
        
        return averages;
    }, [calculateAverage]);
    // --- END: imnciKpiHelper modification ---


    // --- START: NEW eencKpiHelper ---
    const eencKpiHelper = useCallback((submissions) => {
        const scores = {
            overall: [],
            preparation: [],
            drying: [],
            normal_breathing: [],
            resuscitation: []
        };
        let totalVisits = submissions.length;
        const skillStats = {};

        const allSkillItems = [
            ...PREPARATION_ITEMS,
            ...DRYING_STIMULATION_ITEMS,
            ...NORMAL_BREATHING_ITEMS,
            ...RESUSCITATION_ITEMS
        ];

        // Initialize skillStats
        allSkillItems.forEach(item => {
            skillStats[item.key] = { yes: 0, no: 0, partial: 0, na: 0 };
        });

        submissions.forEach(sub => {
            const s = sub.scores; // This is the scoresPayload from the database
            if (s) {
                if (s.overallScore_maxScore > 0) scores.overall.push(s.overallScore_score / s.overallScore_maxScore);
                if (s.preparation_maxScore > 0) scores.preparation.push(s.preparation_score / s.preparation_maxScore);
                if (s.drying_maxScore > 0) scores.drying.push(s.drying_score / s.drying_maxScore);
                if (s.normal_breathing_maxScore > 0) scores.normal_breathing.push(s.normal_breathing_score / s.normal_breathing_maxScore);
                if (s.resuscitation_maxScore > 0) scores.resuscitation.push(s.resuscitation_score / s.resuscitation_maxScore);
            }

            // --- Detailed Skill Stats ---
            const eencSkills = sub.fullData?.skills;
            if (eencSkills) {
                allSkillItems.forEach(item => {
                    const key = item.key;
                    const value = eencSkills[key];
                    if (value === 'yes') {
                        skillStats[key].yes++;
                    } else if (value === 'no') {
                        skillStats[key].no++;
                    } else if (value === 'partial') {
                        skillStats[key].partial++;
                    } else if (value === 'na') {
                        skillStats[key].na++;
                    }
                });
            }
        });

        // --- Calculate Averages ---
        const averages = {
            totalVisits,
            skillStats,
            avgOverall: calculateAverage(scores.overall),
            avgPreparation: calculateAverage(scores.preparation),
            avgDrying: calculateAverage(scores.drying),
            avgNormalBreathing: calculateAverage(scores.normal_breathing),
            avgResuscitation: calculateAverage(scores.resuscitation),
        };
        
        return averages;
    }, [calculateAverage]); // Dependency on the helper function
    // --- END: NEW eencKpiHelper ---


    // 3. Get base completed submissions for this service
    const serviceCompletedSubmissions = useMemo(() => {
        // --- *** THIS IS THE FIX (Part 2) *** ---
        // --- Use reCalculatedSubmissions instead of allSubmissions ---
        return (reCalculatedSubmissions || []).filter(sub => 
            sub.service === activeService && 
            sub.status === 'complete'
        );
    }, [reCalculatedSubmissions, activeService]);


    // 4. Derive options for filters 
    const stateOptions = useMemo(() => {
        if (!STATE_LOCALITIES) return []; 
        return Object.keys(STATE_LOCALITIES)
            .map(stateKey => ({
                key: stateKey,
                name: STATE_LOCALITIES[stateKey]?.ar || stateKey 
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar')); 
    }, [STATE_LOCALITIES]);

    const localityOptions = useMemo(() => {
        if (!activeState || !STATE_LOCALITIES[activeState]?.localities) {
            return [];
        }
        const localities = STATE_LOCALITIES[activeState].localities; 
        return localities
            .map(loc => ({
                key: loc.en, 
                name: loc.ar  
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar')); 
    }, [activeState, STATE_LOCALITIES]);

    const facilityOptions = useMemo(() => {
        const facilityMap = new Map();
        serviceCompletedSubmissions
            .filter(sub => {
                const stateMatch = !activeState || sub.state === activeState;
                const localityMatch = !activeLocality || sub.locality === activeLocality;
                return stateMatch && localityMatch;
            })
            .forEach(sub => {
                if (sub.facilityId && !facilityMap.has(sub.facilityId)) {
                    facilityMap.set(sub.facilityId, {
                        key: sub.facilityId,
                        name: sub.facility || 'Unknown Facility' 
                    });
                }
            });
        return [...facilityMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality]);

    const workerOptions = useMemo(() => {
        const workerMap = new Map(); 
        serviceCompletedSubmissions
            .filter(sub => {
                const stateMatch = !activeState || sub.state === activeState;
                const localityMatch = !activeLocality || sub.locality === activeLocality;
                const facilityMatch = !activeFacilityId || sub.facilityId === activeFacilityId;
                return stateMatch && localityMatch && facilityMatch;
            })
            .forEach(sub => {
                if (sub.staff && !workerMap.has(sub.staff)) {
                     workerMap.set(sub.staff, {
                        key: sub.staff,
                        name: sub.staff
                    });
                }
            });
        return [...workerMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId]);


    // 5. Filter submissions based on active filters
    const filteredSubmissions = useMemo(() => {
        return serviceCompletedSubmissions.filter(sub => {
            const stateMatch = !activeState || sub.state === activeState;
            const localityMatch = !activeLocality || sub.locality === activeLocality;
            const facilityIdMatch = !activeFacilityId || sub.facilityId === activeFacilityId; 
            const workerNameMatch = !activeWorkerName || sub.staff === activeWorkerName; 
            
            return stateMatch && localityMatch && facilityIdMatch && workerNameMatch; 
        });
    }, [
        serviceCompletedSubmissions, 
        activeState, 
        activeLocality, 
        activeFacilityId, 
        activeWorkerName 
    ]);


    // 6. Calculate Overall KPIs based on *filtered* submissions
    const overallKpis = useMemo(() => {
        if (activeService === 'IMNCI') {
            return imnciKpiHelper(filteredSubmissions);
        }
        if (activeService === 'EENC') {
            return eencKpiHelper(filteredSubmissions);
        }
        // Default empty state
        return { totalVisits: filteredSubmissions.length, skillStats: {} };
    }, [filteredSubmissions, imnciKpiHelper, eencKpiHelper, activeService]);

    // 7. Calculate Chart Data by averaging per visit number (IMNCI)
    const imnciChartData = useMemo(() => {
        if (activeService !== 'IMNCI') return [];

        const calcPercent = (score, max) => (max > 0) ? (score / max) * 100 : null;

        const visitGroups = filteredSubmissions.reduce((acc, sub) => {
            const s = sub.scores;
            const visitNum = sub.visitNumber || 'N/A'; 
            if (!s || visitNum === 'N/A') return acc;

            if (!acc[visitNum]) {
                acc[visitNum] = {
                    'Overall': [], 'Assessment': [], 'Decision': [], 'Treatment': [],
                    'Cough': [], 'Pneumonia': [], 'Diarrhea (Classify)': [], 'Diarrhea (Mgmt)': [],
                    'Weight': [], 'Temp': [], 'Height': [], 'Resp. Rate': [], 'RDT': [], 'MUAC': [], 'WFH': [],
                    'Referral Mgmt': [], 'Malaria Class.': [], 'Malaria Mgmt': [], 'Malnutrition Mgmt': [], 'Anemia Mgmt': [],
                    'Pallor': [], 'Referral ID': [], 'Malnutrition ID': [],
                    'DangerSigns': [], // <-- NEW
                    count: 0
                };
            }
            
            const group = acc[visitNum];
            group.count++;
            
            group['Overall'].push(calcPercent(s.overallScore_score, s.overallScore_maxScore));
            group['Assessment'].push(calcPercent(s.assessment_total_score_score, s.assessment_total_score_maxScore));
            group['Decision'].push(calcPercent(s.finalDecision_score, s.finalDecision_maxScore));
            
            // --- *** THIS IS THE FIX (Part 3) *** ---
            // --- FIX: Only read the correct "_total_score" keys ---
            // (The data is now clean thanks to reCalculatedSubmissions)
            group['Treatment'].push(calcPercent(s.treatment_total_score_score, s.treatment_total_score_maxScore));
            // --- *** END OF FIX *** ---

            group['Cough'].push(calcPercent(s.coughClassification_score, s.coughClassification_maxScore));
            group['Pneumonia'].push(calcPercent(s.pneumoniaManagement_score, s.pneumoniaManagement_maxScore));
            group['Diarrhea (Classify)'].push(calcPercent(s.diarrheaClassification_score, s.diarrheaClassification_maxScore));
            group['Diarrhea (Mgmt)'].push(calcPercent(s.diarrheaManagement_score, s.diarrheaManagement_maxScore));
            group['Weight'].push(calcPercent(s.handsOnWeight_score, s.handsOnWeight_maxScore));
            group['Temp'].push(calcPercent(s.handsOnTemp_score, s.handsOnTemp_maxScore));
            group['Height'].push(calcPercent(s.handsOnHeight_score, s.handsOnHeight_maxScore));
            group['Resp. Rate'].push(calcPercent(s.handsOnRR_score, s.handsOnRR_maxScore));
            group['RDT'].push(calcPercent(s.handsOnRDT_score, s.handsOnRDT_maxScore));
            group['MUAC'].push(calcPercent(s.handsOnMUAC_score, s.handsOnMUAC_maxScore));
            group['WFH'].push(calcPercent(s.handsOnWFH_score, s.handsOnWFH_maxScore));
            group['Referral Mgmt'].push(calcPercent(s.referralManagement_score, s.referralManagement_maxScore));
            group['Malaria Class.'].push(calcPercent(s.malariaClassification_score, s.malariaClassification_maxScore));
            group['Malaria Mgmt'].push(calcPercent(s.malariaManagement_score, s.malariaManagement_maxScore));
            group['Malnutrition Mgmt'].push(calcPercent(s.malnutritionManagement_score, s.malnutritionManagement_maxScore));
            group['Anemia Mgmt'].push(calcPercent(s.anemiaManagement_score, s.anemiaManagement_maxScore));
            group['Referral ID'].push(calcPercent(s.referralCaseCount_score, s.referralCaseCount_maxScore));
            group['Malnutrition ID'].push(calcPercent(s.malnutritionCaseCount_score, s.malnutritionCaseCount_maxScore));
            
            // --- NEW: Add DangerSigns score ---
            group['DangerSigns'].push(calcPercent(s.dangerSigns_score, s.dangerSigns_maxScore));

            const as = sub.fullData?.assessmentSkills;
            if (as) {
                if (as['skill_anemia_pallor'] === 'yes') group['Pallor'].push(100);
                if (as['skill_anemia_pallor'] === 'no') group['Pallor'].push(0);
            }

            return acc;
        }, {});

        // 2. Calculate averages for each group and sort by visit number
        return Object.keys(visitGroups)
            .map(visitNumStr => ({
                visitNumber: parseInt(visitNumStr, 10),
                data: visitGroups[visitNumStr]
            }))
            .sort((a, b) => a.visitNumber - b.visitNumber)
            .map(({ visitNumber, data }) => {
                
                const averageScores = (scores) => {
                    const validScores = scores.filter(s => s !== null && !isNaN(s));
                    if (validScores.length === 0) return null;
                    const sum = validScores.reduce((a, b) => a + b, 0);
                    return Math.round(sum / validScores.length);
                };

                return {
                    name: `Visit ${visitNumber}`, // X-axis label
                    'Overall': averageScores(data['Overall']),
                    'Assessment': averageScores(data['Assessment']),
                    'Decision': averageScores(data['Decision']),
                    'Treatment': averageScores(data['Treatment']),
                    'Cough': averageScores(data['Cough']),
                    'Pneumonia': averageScores(data['Pneumonia']),
                    'Diarrhea (Classify)': averageScores(data['Diarrhea (Classify)']),
                    'Diarrhea (Mgmt)': averageScores(data['Diarrhea (Mgmt)']),
                    'Weight': averageScores(data['Weight']),
                    'Temp': averageScores(data['Temp']),
                    'Height': averageScores(data['Height']),
                    'Resp. Rate': averageScores(data['Resp. Rate']),
                    'RDT': averageScores(data['RDT']),
                    'MUAC': averageScores(data['MUAC']),
                    'WFH': averageScores(data['WFH']),
                    'Referral Mgmt': averageScores(data['Referral Mgmt']),
                    'Malaria Class.': averageScores(data['Malaria Class.']),
                    'Malaria Mgmt': averageScores(data['Malaria Mgmt']),
                    'Malnutrition Mgmt': averageScores(data['Malnutrition Mgmt']),
                    'Anemia Mgmt': averageScores(data['Anemia Mgmt']),
                    'Pallor': averageScores(data['Pallor']),
                    'Referral ID': averageScores(data['Referral ID']),
                    'Malnutrition ID': averageScores(data['Malnutrition ID']),
                    'DangerSigns': averageScores(data['DangerSigns']), // <-- NEW
                };
            });
    }, [filteredSubmissions, activeService]);
    // --- END MODIFICATION ---

    // --- START: NEW eencChartData ---
    const eencChartData = useMemo(() => {
        if (activeService !== 'EENC') return [];

        const calcPercent = (score, max) => (max > 0) ? (score / max) * 100 : null;

        const visitGroups = filteredSubmissions.reduce((acc, sub) => {
            const s = sub.scores;
            const visitNum = sub.visitNumber || 'N/A'; 
            if (!s || visitNum === 'N/A') return acc;

            if (!acc[visitNum]) {
                acc[visitNum] = {
                    'Overall': [],
                    'Preparation': [],
                    'Drying': [],
                    'Breathing Mgmt': [], // Combined key
                    'Resuscitation': [], // Separate key for granularity
                    count: 0
                };
            }
            
            const group = acc[visitNum];
            group.count++;
            
            group['Overall'].push(calcPercent(s.overallScore_score, s.overallScore_maxScore));
            group['Preparation'].push(calcPercent(s.preparation_score, s.preparation_maxScore));
            group['Drying'].push(calcPercent(s.drying_score, s.drying_maxScore));
            
            // Combine Normal Breathing and Resuscitation into one 'Breathing Mgmt' line
            // This assumes only one of them has a max score > 0 per submission
            if (s.normal_breathing_maxScore > 0) {
                group['Breathing Mgmt'].push(calcPercent(s.normal_breathing_score, s.normal_breathing_maxScore));
            } else if (s.resuscitation_maxScore > 0) {
                group['Breathing Mgmt'].push(calcPercent(s.resuscitation_score, s.resuscitation_maxScore));
            }
            // Also keep resuscitation separate if needed, though 'Breathing Mgmt' is cleaner
            group['Resuscitation'].push(calcPercent(s.resuscitation_score, s.resuscitation_maxScore));

            return acc;
        }, {});

        // 2. Calculate averages for each group and sort by visit number
        return Object.keys(visitGroups)
            .map(visitNumStr => ({
                visitNumber: parseInt(visitNumStr, 10),
                data: visitGroups[visitNumStr]
            }))
            .sort((a, b) => a.visitNumber - b.visitNumber)
            .map(({ visitNumber, data }) => {
                
                const averageScores = (scores) => {
                    const validScores = scores.filter(s => s !== null && !isNaN(s));
                    if (validScores.length === 0) return null;
                    const sum = validScores.reduce((a, b) => a + b, 0);
                    return Math.round(sum / validScores.length);
                };

                return {
                    name: `Visit ${visitNumber}`, // X-axis label
                    'Overall': averageScores(data['Overall']),
                    'Preparation': averageScores(data['Preparation']),
                    'Drying': averageScores(data['Drying']),
                    'Breathing Mgmt': averageScores(data['Breathing Mgmt']),
                    'Resuscitation': averageScores(data['Resuscitation']), // This will be sparse
                };
            });
    }, [filteredSubmissions, activeService]);
    // --- END: NEW eencChartData ---


    // 8. Calculate State-level KPIs
    const stateKpis = useMemo(() => {
        // --- MODIFICATION: Select the correct helper --- 
        const kpisHelper = activeService === 'IMNCI' ? imnciKpiHelper : (activeService === 'EENC' ? eencKpiHelper : null);
        if (!kpisHelper) return [];
        // --- END MODIFICATION ---

        const submissionsByState = filteredSubmissions.reduce((acc, sub) => {
            const stateKey = sub.state || 'UNKNOWN';
            if (!acc[stateKey]) {
                acc[stateKey] = [];
            }
            acc[stateKey].push(sub);
            return acc;
        }, {});

        return Object.keys(submissionsByState).map(stateKey => {
            const stateName = STATE_LOCALITIES[stateKey]?.ar || stateKey;
            const stateSubmissions = submissionsByState[stateKey];
            const kpis = kpisHelper(stateSubmissions);
            return {
                stateKey,
                stateName,
                ...kpis // This includes avgOverall
            };
        }).sort((a, b) => a.stateName.localeCompare(b.name, 'ar'));
    }, [filteredSubmissions, imnciKpiHelper, eencKpiHelper, activeService, STATE_LOCALITIES]);


    // --- Render Component --- 
    const serviceTitle = SERVICE_TITLES[activeService] || activeService;
    const isFiltered = activeState || activeLocality || activeFacilityId || activeWorkerName;
    const scopeTitle = isFiltered ? "(Filtered Data)" : "(All Sudan Data)";

    // --- KPI lists for the IMNCI layout ---
    const mainKpiGridList = [
        { title: "Overall IMNCI Adherence", scoreValue: overallKpis.avgOverall },
        { title: "Assess & Classify Score", scoreValue: overallKpis.avgAssessment },
        { title: "Final Decision Score", scoreValue: overallKpis.avgDecision },
        { title: "Treatment & Counsel Score", scoreValue: overallKpis.avgTreatment },
    ];
    
    const mainKpiChartKeys = [
        { key: 'Overall', title: 'Overall' },
        { key: 'Assessment', title: 'Assessment' },
        { key: 'Decision', title: 'Decision' },
        { key: 'Treatment', title: 'Treatment' },
    ];
    
    const dangerSignsKpiList = [
        { title: "Asked/Checked: Cannot Drink/Breastfeed", scoreValue: calculateAverage(overallKpis.skillStats['skill_ds_drink'] ? [overallKpis.skillStats['skill_ds_drink'].yes / (overallKpis.skillStats['skill_ds_drink'].yes + overallKpis.skillStats['skill_ds_drink'].no)] : []) },
        { title: "Asked/Checked: Vomits Everything", scoreValue: calculateAverage(overallKpis.skillStats['skill_ds_vomit'] ? [overallKpis.skillStats['skill_ds_vomit'].yes / (overallKpis.skillStats['skill_ds_vomit'].yes + overallKpis.skillStats['skill_ds_vomit'].no)] : []) },
        { title: "Asked/Checked: Convulsions", scoreValue: calculateAverage(overallKpis.skillStats['skill_ds_convulsion'] ? [overallKpis.skillStats['skill_ds_convulsion'].yes / (overallKpis.skillStats['skill_ds_convulsion'].yes + overallKpis.skillStats['skill_ds_convulsion'].no)] : []) },
        { title: "Checked: Lethargic/Unconscious", scoreValue: calculateAverage(overallKpis.skillStats['skill_ds_conscious'] ? [overallKpis.skillStats['skill_ds_conscious'].yes / (overallKpis.skillStats['skill_ds_conscious'].yes + overallKpis.skillStats['skill_ds_conscious'].no)] : []) },
    ];
    const dangerSignsChartKeys = [
        { key: 'DangerSigns', title: 'Danger Signs Score' },
    ];

    const referralKpiList = [
        { title: "Referral Cases Correctly Identified", scoreValue: overallKpis.avgReferralCaseCount },
        { title: "Referral Management Score", scoreValue: overallKpis.avgReferralManagement },
    ];
    const referralChartKeys = [
        { key: 'Referral ID', title: 'Referral ID' },
        { key: 'Referral Mgmt', title: 'Referral Mgmt' },
    ];

    const pneumoniaKpiList = [
        { title: "Cough Classification Score", scoreValue: overallKpis.avgCoughClassification },
        { title: "Pneumonia Management Score", scoreValue: overallKpis.avgPneumoniaManagement },
    ];
    const pneumoniaChartKeys = [
        { key: 'Cough', title: 'Cough Class.' },
        { key: 'Pneumonia', title: 'Pneumonia Mgmt' },
    ];

    const diarrheaKpiList = [
        { title: "Diarrhea Classification Score", scoreValue: overallKpis.avgDiarrheaClassification },
        { title: "Diarrhea Management Score", scoreValue: overallKpis.avgDiarrheaManagement },
    ];
    const diarrheaChartKeys = [
        { key: 'Diarrhea (Classify)', title: 'Diarrhea Class.' },
        { key: 'Diarrhea (Mgmt)', title: 'Diarrhea Mgmt' },
    ];

    const malariaKpiList = [
        { title: "Malaria Classification Score", scoreValue: overallKpis.avgMalariaClassification },
        { title: "Malaria Management Score", scoreValue: overallKpis.avgMalariaManagement },
    ];
    const malariaChartKeys = [
        { key: 'Malaria Class.', title: 'Malaria Class.' },
        { key: 'Malaria Mgmt', title: 'Malaria Mgmt' },
    ];

    const malnutritionKpiList = [
        { title: "Malnutrition Case Identification", scoreValue: overallKpis.avgMalnutritionCaseCount },
        { title: "Malnutrition Management Score", scoreValue: overallKpis.avgMalnutritionManagement },
    ];
    const malnutritionChartKeys = [
        { key: 'Malnutrition ID', title: 'Malnutrition ID' },
        { key: 'Malnutrition Mgmt', title: 'Malnutrition Mgmt' },
    ];

    const anemiaKpiList = [
        { title: "Anemia Assessment (Pallor)", scoreValue: overallKpis.avgHandsOnPallor },
        { title: "Anemia Management Score", scoreValue: overallKpis.avgAnemiaManagement },
    ];
    const anemiaChartKeys = [
        { key: 'Pallor', title: 'Anemia Assess' },
        { key: 'Anemia Mgmt', title: 'Anemia Mgmt' },
    ];

    const measurementKpiGridList = [
        { title: "Weight Measured Correctly", scoreValue: overallKpis.avgHandsOnWeight },
        { title: "Temp Measured Correctly", scoreValue: overallKpis.avgHandsOnTemp },
        { title: "Height Measured Correctly", scoreValue: overallKpis.avgHandsOnHeight },
        { title: "Resp. Rate Measured Correctly", scoreValue: overallKpis.avgHandsOnRR },
    ];
    
    const measurementKpiChartKeys = [
        { key: 'Weight', title: 'Weight' }, { key: 'Temp', title: 'Temp' },
        { key: 'Height', title: 'Height' }, { key: 'Resp. Rate', title: 'Resp. Rate' },
    ];

    const malnutritionAnemiaSkillsKpiGridList = [
        { title: "MUAC Measured Correctly", scoreValue: overallKpis.avgHandsOnMUAC },
        { title: "Z-Score (WFH) Measured Correctly", scoreValue: overallKpis.avgHandsOnWFH },
        { title: "Pallor Checked Correctly", scoreValue: overallKpis.avgHandsOnPallor },
    ];

    const malnutritionAnemiaSkillsKpiChartKeys = [
        { key: 'MUAC', title: 'MUAC' },
        { key: 'WFH', title: 'WFH' },
        { key: 'Pallor', title: 'Pallor' },
    ];

    // --- NEW: KPI lists for the EENC layout ---
    const eencMainKpiGridList = [
        { title: "Overall EENC Adherence", scoreValue: overallKpis.avgOverall },
        { title: "Preparation Score", scoreValue: overallKpis.avgPreparation },
        { title: "Drying & Stimulation Score", scoreValue: overallKpis.avgDrying },
        { title: "Breathing Baby Mgmt Score", scoreValue: overallKpis.avgNormalBreathing },
        { title: "Resuscitation Score", scoreValue: overallKpis.avgResuscitation },
    ];

    const eencMainKpiChartKeys = [
        { key: 'Overall', title: 'Overall' },
        { key: 'Preparation', title: 'Preparation' },
        { key: 'Drying', title: 'Drying' },
        { key: 'Breathing Mgmt', title: 'Breathing Mgmt' }, // Use the combined key
    ];
    // --- END NEW KPI Lists ---
    
    return (
        <div className="p-4" dir="ltr"> 
            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">
                Mentorship Dashboard: {serviceTitle} {scopeTitle}
            </h3>

            {/* --- Filter Controls --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 p-4 bg-gray-50 rounded-lg border">
                <FilterSelect
                    label="State"
                    value={activeState}
                    onChange={(value) => {
                        onStateChange(value);
                        onLocalityChange(""); 
                        onFacilityIdChange(""); 
                        onWorkerNameChange(""); 
                    }}
                    options={stateOptions}
                    defaultOption="All States"
                />
                <FilterSelect
                    label="Locality"
                    value={activeLocality}
                    onChange={(value) => {
                        onLocalityChange(value);
                        onFacilityIdChange(""); 
                        onWorkerNameChange(""); 
                    }}
                    options={localityOptions}
                    disabled={!activeState}
                    defaultOption="All Localities"
                />
                <FilterSelect
                    label="Health Facility Name" 
                    value={activeFacilityId} 
                    onChange={(value) => {
                        onFacilityIdChange(value);
                        onWorkerNameChange(""); 
                    }}
                    options={facilityOptions} 
                    disabled={!activeLocality} 
                    defaultOption="All Facilities" 
                />
                <FilterSelect
                    label="Health Worker Name" 
                    value={activeWorkerName} 
                    onChange={onWorkerNameChange} 
                    options={workerOptions} 
                    disabled={!activeFacilityId} 
                    defaultOption="All Health Workers" 
                />
            </div>
            
            
            {/* --- START: Conditional Rendering for IMNCI --- */}
            {activeService === 'IMNCI' && (
                <>
                    {/* Row 1: Total Visits */}
                    <div className="grid grid-cols-1 gap-4 mb-6">
                        <KpiCard title="Total Completed Visits" value={overallKpis.totalVisits} />
                    </div>

                    {/* Row 2: Main KPIs & Danger Signs */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <KpiGridCard
                            title="Overall Adherence Scores (Average)"
                            kpis={mainKpiGridList}
                            cols={2}
                        />
                        <KpiLineChart 
                            title="Adherence Over Time (Main KPIs)"
                            chartData={imnciChartData}
                            kpiKeys={mainKpiChartKeys}
                        />
                    </div>

                    {/* --- NEW: Row 3: Danger Signs --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <DetailedKpiCard
                            title="Danger Signs Assessment"
                            overallScore={overallKpis.avgDangerSigns}
                            kpis={dangerSignsKpiList}
                        />
                        <KpiLineChart 
                            title="Adherence Over Time (Danger Signs)"
                            chartData={imnciChartData}
                            kpiKeys={dangerSignsChartKeys}
                        />
                    </div>

                    {/* --- NEW: Row 4: Referral & Pneumonia KPIs --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <KpiCardWithChart
                            title="Referral KPIs"
                            kpis={referralKpiList}
                            chartData={imnciChartData}
                            kpiKeys={referralChartKeys}
                            cols={2}
                        />
                        <KpiCardWithChart
                            title="Cough & Pneumonia KPIs"
                            kpis={pneumoniaKpiList}
                            chartData={imnciChartData}
                            kpiKeys={pneumoniaChartKeys}
                            cols={2}
                        />
                    </div>

                    {/* --- NEW: Row 5: Diarrhea & Malaria KPIs --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <KpiCardWithChart
                            title="Diarrhea KPIs"
                            kpis={diarrheaKpiList}
                            chartData={imnciChartData}
                            kpiKeys={diarrheaChartKeys}
                            cols={2}
                        />
                        <KpiCardWithChart
                            title="Malaria KPIs"
                            kpis={malariaKpiList}
                            chartData={imnciChartData}
                            kpiKeys={malariaChartKeys}
                            cols={2}
                        />
                    </div>

                    {/* --- NEW: Row 6: Malnutrition & Anemia KPIs --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <KpiCardWithChart
                            title="Malnutrition KPIs"
                            kpis={malnutritionKpiList}
                            chartData={imnciChartData}
                            kpiKeys={malnutritionChartKeys}
                            cols={2}
                        />
                        <KpiCardWithChart
                            title="Anemia KPIs"
                            kpis={anemiaKpiList}
                            chartData={imnciChartData}
                            kpiKeys={anemiaChartKeys}
                            cols={2}
                        />
                    </div>

                    {/* --- NEW: Row 7: Hands-on Skills --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                         <DetailedKpiCard
                            title="Measurement Skills (Average)"
                            overallScore={overallKpis.avgMeasurementSkills}
                            kpis={measurementKpiGridList}
                        />
                        <KpiLineChart 
                            title="Adherence Over Time (Measurement Skills)"
                            chartData={imnciChartData}
                            kpiKeys={measurementKpiChartKeys}
                        />
                    </div>

                    {/* --- NEW: Row 8: Malnutrition/Anemia Skills --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                         <DetailedKpiCard
                            title="Malnutrition and Anemia Signs"
                            overallScore={overallKpis.avgMalnutritionAnemiaSkills}
                            kpis={malnutritionAnemiaSkillsKpiGridList}
                        />
                        <KpiLineChart 
                            title="Adherence Over Time (Malnutrition & Anemia Signs)"
                            chartData={imnciChartData}
                            kpiKeys={malnutritionAnemiaSkillsKpiChartKeys}
                        />
                    </div>
                    
                    {/* --- NEW: Bar Chart by State --- */}
                    <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">
                        Overall Adherence by State {scopeTitle}
                    </h3>
                    <div className="mb-8">
                        <KpiBarChart
                            title="Overall IMNCI Adherence by State"
                            chartData={stateKpis}
                        />
                    </div>
                    {/* --- END: NEW Bar Chart by State --- */}


                    {/* --- NEW: Detailed Skills Table --- */}
                    <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">
                        Detailed Skill Performance {scopeTitle}
                    </h3>
                    <div className="mb-8">
                        <CompactSkillsTable overallKpis={overallKpis} />
                    </div>
                    {/* --- END NEW: Detailed Skills Table --- */}
                </>
            )}
            {/* --- END: Conditional Rendering for IMNCI --- */}


            {/* --- START: NEW Conditional Rendering for EENC --- */}
            {activeService === 'EENC' && (
                <>
                    {/* Row 1: Total Visits */}
                    <div className="grid grid-cols-1 gap-4 mb-6">
                        <KpiCard title="Total Completed EENC Visits" value={overallKpis.totalVisits} />
                    </div>

                    {/* Row 2: Main EENC KPIs & Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <KpiGridCard
                            title="Overall EENC Adherence Scores (Average)"
                            kpis={eencMainKpiGridList}
                            cols={3} // Use 3 cols for the 5 items
                        />
                        <KpiLineChart 
                            title="EENC Adherence Over Time (Main KPIs)"
                            chartData={eencChartData}
                            kpiKeys={eencMainKpiChartKeys}
                        />
                    </div>

                    {/* EENC Bar Chart by State */}
                    <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">
                        Overall EENC Adherence by State {scopeTitle}
                    </h3>
                    <div className="mb-8">
                        <KpiBarChart
                            title="Overall EENC Adherence by State"
                            chartData={stateKpis}
                        />
                    </div>

                    {/* EENC Detailed Skills Table */}
                    <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">
                        Detailed EENC Skill Performance {scopeTitle}
                    </h3>
                    <div className="mb-8">
                        <EENCCompactSkillsTable overallKpis={overallKpis} />
                    </div>
                </>
            )}
            {/* --- END: NEW Conditional Rendering for EENC --- */}

        </div>
    );
};

export default MentorshipDashboard;