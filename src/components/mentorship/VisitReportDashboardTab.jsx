// VisitReportDashboardTab.jsx
import React, { useRef, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { useTranslation } from './LanguageContext'; 
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler
);

const TrainedGroupRow = ({ title, details, color, ScoreText, CopyImageButton }) => {
    const { t, language } = useTranslation();
    const isAr = language === 'ar';
    const cardRef = useRef(null);

    const chartData = {
        labels: details.map(d => t(d.label)),
        datasets: [{
            label: t('Times Trained'),
            data: details.map(d => d.count),
            backgroundColor: color,
            hoverBackgroundColor: color + 'CC',
            borderRadius: 6,
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
            tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', titleFont: { size: 13, family: "'Inter', sans-serif" }, bodyFont: { size: 12, family: "'Inter', sans-serif", weight: 'bold' }, padding: 10, cornerRadius: 8 }
        },
        scales: {
            x: { reverse: isAr, beginAtZero: true, grid: { color: '#e2e8f0', drawBorder: false }, ticks: { precision: 0, color: '#475569', font: { family: "'Inter', sans-serif", weight: '500' } } },
            y: { position: isAr ? 'right' : 'left', grid: { display: false, drawBorder: false }, ticks: { color: '#334155', font: { size: 11, family: "'Inter', sans-serif", weight: 'bold' } } }
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8" ref={cardRef}>
            <div className="bg-white p-6 rounded-2xl shadow-md border border-black flex flex-col relative h-full">
                <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-black pr-10">
                    <h4 className={`text-base font-extrabold text-slate-800 ${isAr ? 'text-right' : 'text-left'}`}>{t(title)}</h4>
                </div>
                <div className="space-y-3 flex-grow">
                    {details.map((d, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-black shadow-sm group hover:border-sky-500 hover:bg-sky-50 transition-all duration-200">
                            <h5 className={`text-xs font-bold text-slate-700 ${isAr ? 'text-right pl-4' : 'text-left pr-4'} group-hover:text-sky-800`}>{t(d.label)}</h5>
                            <div className="flex items-center gap-3" dir="ltr">
                                <span className="text-xs font-extrabold text-slate-500 bg-white px-2 py-1 rounded border border-black">{t('Count')}: {d.count}</span>
                                <div className="bg-white px-3 py-1 rounded-lg shadow-sm border border-black min-w-[60px] text-center" title={t("% of Total Training Sessions")}>
                                    <ScoreText value={d.pct / 100} showPercentage={true} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-md border border-black flex flex-col h-full min-h-[300px] relative">
                <h4 className="text-sm font-extrabold text-slate-800 mb-4 text-center tracking-wide">{t(title)} ({t('Count')})</h4>
                <div className="relative flex-grow w-full" dir="ltr">
                    {details.some(d => d.count > 0) ? <Bar options={options} data={chartData} /> : <div className="flex items-center justify-center h-full text-slate-500 font-semibold text-xs">{t('No training data recorded.')}</div>}
                </div>
            </div>
        </div>
    );
};

const InfoKpiTrendCard = ({ 
    title, 
    avgValue, totalNumerator, totalDenominator,
    v1Value, v1Numerator, v1Denominator,
    v4Value, v4Numerator, v4Denominator,
    lineLabels, lineData, color, isAr, t, CopyImageButton 
}) => {
    const cardRef = useRef(null);
    
    const chartData = {
        labels: lineLabels,
        datasets: [{
            label: title,
            data: lineData,
            borderColor: color,
            backgroundColor: color + '26',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: color,
            pointBorderWidth: 2,
            borderWidth: 2.5
        }]
    };

    const options = {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1000, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: { 
            legend: { display: false }, 
            tooltip: { 
                backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                titleFont: { size: 13, family: "'Inter', sans-serif", weight: 'bold' }, 
                bodyFont: { size: 12, family: "'Inter', sans-serif" }, 
                padding: 12, cornerRadius: 8, boxPadding: 6,
                callbacks: { label: (context) => ` ${context.dataset.label}: ${context.raw}%` } 
            } 
        },
        scales: { 
            y: { 
                beginAtZero: true, max: 100, 
                grid: { color: '#e2e8f0', drawBorder: false },
                ticks: { stepSize: 20, callback: (value) => `${value}%`, color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' } }
            }, 
            x: { 
                reverse: isAr, grid: { display: false },
                ticks: { color: '#475569', font: { family: "'Inter', sans-serif", size: 11, weight: '600' } }
            } 
        }
    };

    return (
        <div ref={cardRef} className="bg-white p-2 sm:p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-base font-extrabold text-slate-800 mb-2 sm:mb-5 text-center tracking-wide pr-8 break-words">{title}</h4>
            
            <div className="flex justify-between items-center gap-1 sm:gap-4 mb-6 px-1 sm:px-6">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t('Visit 1')}</span>
                    <div className="border border-slate-300 bg-white rounded-lg px-2 sm:px-4 py-1.5 font-bold text-slate-700 shadow-sm text-sm flex flex-col items-center">
                        {v1Value !== null && v1Value !== undefined ? `${Math.round(v1Value)}%` : '-'}
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5 whitespace-nowrap">
                            {v1Numerator !== undefined && v1Denominator !== undefined ? `${v1Numerator} / ${v1Denominator}` : '- / -'}
                        </span>
                    </div>
                </div>
                
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t('Average')}</span>
                    <div className="border border-slate-800 bg-white rounded-xl px-3 sm:px-10 py-2 sm:py-3 shadow-sm flex flex-col items-center justify-center">
                        <span className={`font-extrabold text-xl sm:text-2xl ${avgValue >= 80 ? 'text-emerald-700' : avgValue >= 50 ? 'text-amber-600' : 'text-rose-700'}`}>
                            {avgValue !== null && avgValue !== undefined && !isNaN(avgValue) ? `${Math.round(avgValue)}%` : '-'}
                        </span>
                        {totalNumerator !== undefined && totalDenominator !== undefined && totalDenominator > 0 && (
                            <span className="text-xs font-bold text-slate-500 mt-0.5 whitespace-nowrap">
                                {totalNumerator} / {totalDenominator}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t('Visit 4')}</span>
                    <div className="border border-slate-300 bg-white rounded-lg px-2 sm:px-4 py-1.5 font-bold text-slate-700 shadow-sm text-sm flex flex-col items-center">
                        {v4Value !== null && v4Value !== undefined ? `${Math.round(v4Value)}%` : '-'}
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5 whitespace-nowrap">
                            {v4Numerator !== undefined && v4Denominator !== undefined ? `${v4Numerator} / ${v4Denominator}` : '- / -'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="relative flex-grow min-h-[250px]" dir="ltr">
                {lineLabels.length > 0 ? (
                    <Line options={options} data={chartData} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 font-semibold text-xs">{t('No data available.')}</div>
                )}
            </div>
        </div>
    );
};

const VisitReportDashboardTab = ({
    activeService,
    visitReportStats,
    geographicLevelName,
    dynamicLocationLabel,
    dynamicLocationLevel,
    renderStatusCell,
    IMNCI_SKILL_GROUPS,
    EENC_SKILL_GROUPS,
    EENC_SKILLS_LABELS,
    KpiCard,
    KpiBarChart,
    ScoreText,
    CopyImageButton
}) => {
    const { t, language } = useTranslation();
    const isAr = language === 'ar';
    
    // State for filtering problems by their status
    const [statusFilter, setStatusFilter] = useState('All');

    if (!visitReportStats) return null;

    const rawReports = visitReportStats.rawReports;
    const isIMNCI = activeService === 'IMNCI';

    const infoTotalKey = isIMNCI ? 'total_examined' : 'total_deliveries';
    const infoTrainedKey = isIMNCI ? 'examined_by_trained' : 'deliveries_by_trained';
    const infoTotalLabel = isIMNCI ? 'total examined' : 'total deliveries';
    const infoTrainedLabel = isIMNCI ? 'Children seen by IMNCI trained cadre' : 'Deliveries attended by EENC trained cadre';
    
    const drugList = isIMNCI 
        ? [ { key: 'amoxicillin', label: 'Amoxicillin', color: '#10b981' }, { key: 'zinc', label: 'Zinc', color: '#3b82f6' }, { key: 'ors', label: 'ORS', color: '#8b5cf6' }, { key: 'coartem', label: 'Coartem', color: '#f59e0b' } ]
        : [ { key: 'surgical_gloves', label: 'Surgical Gloves', color: '#10b981' }, { key: 'vitamin_k', label: 'Vitamin K', color: '#3b82f6' }, { key: 'tetracycline', label: 'Tetracycline', color: '#8b5cf6' }, { key: 'ambu_bag', label: 'Ambu Bag', color: '#f59e0b' }, { key: 'cord_clamp', label: 'Cord Clamp', color: '#ec4899' }, { key: 'manual_suction', label: 'Manual Suction', color: '#0ea5e9'} ];

    const infoSystemAgg = { total: 0, trained: 0, completed_forms: 0, completed_followup_forms: 0, skin_to_skin_90min_count: 0, resuscitated_with_ambu_count: 0 };
    const drugAvailabilityOverall = { total: 0, [drugList[0].key]: 0, [drugList[1].key]: 0, [drugList[2].key]: 0, [drugList[3].key]: 0 };
    if (!isIMNCI) {
        drugAvailabilityOverall[drugList[4].key] = 0;
        drugAvailabilityOverall[drugList[5].key] = 0;
    }
    
    const infoSystemByVisit = { 
        1: { total: 0, trained: 0, completed_forms: 0, completed_followup_forms: 0, skin_to_skin_90min_count: 0, resuscitated_with_ambu_count: 0 }, 
        2: { total: 0, trained: 0, completed_forms: 0, completed_followup_forms: 0, skin_to_skin_90min_count: 0, resuscitated_with_ambu_count: 0 }, 
        3: { total: 0, trained: 0, completed_forms: 0, completed_followup_forms: 0, skin_to_skin_90min_count: 0, resuscitated_with_ambu_count: 0 }, 
        4: { total: 0, trained: 0, completed_forms: 0, completed_followup_forms: 0, skin_to_skin_90min_count: 0, resuscitated_with_ambu_count: 0 } 
    };

    const drugAvailabilityByVisit = { 
        1: { total: 0, [drugList[0].key]: 0, [drugList[1].key]: 0, [drugList[2].key]: 0, [drugList[3].key]: 0 }, 
        2: { total: 0, [drugList[0].key]: 0, [drugList[1].key]: 0, [drugList[2].key]: 0, [drugList[3].key]: 0 }, 
        3: { total: 0, [drugList[0].key]: 0, [drugList[1].key]: 0, [drugList[2].key]: 0, [drugList[3].key]: 0 }, 
        4: { total: 0, [drugList[0].key]: 0, [drugList[1].key]: 0, [drugList[2].key]: 0, [drugList[3].key]: 0 } 
    };

    if (!isIMNCI) {
        [1,2,3,4].forEach(v => {
            drugAvailabilityByVisit[v][drugList[4].key] = 0;
            drugAvailabilityByVisit[v][drugList[5].key] = 0;
        });
    }

    if (rawReports) {
        rawReports.forEach(rep => {
            const data = rep.fullData || rep;
            const vNum = parseInt(data.visitNumber) || parseInt(rep.visitNumber) || 1;
            
            if (data.info_system) {
                const total = Number(data.info_system[infoTotalKey]) || 0;
                const trained = Number(data.info_system[infoTrainedKey]) || 0;
                const forms = Number(data.info_system.completed_forms) || 0;
                const followup = Number(data.info_system.completed_followup_forms) || 0;
                const s2s = Number(data.info_system.skin_to_skin_90min_count) || 0;
                const ambu = Number(data.info_system.resuscitated_with_ambu_count) || 0;

                infoSystemAgg.total += total;
                infoSystemAgg.trained += trained;
                infoSystemAgg.completed_forms += forms;
                infoSystemAgg.completed_followup_forms += followup;
                infoSystemAgg.skin_to_skin_90min_count += s2s;
                infoSystemAgg.resuscitated_with_ambu_count += ambu;

                if (infoSystemByVisit[vNum]) {
                    infoSystemByVisit[vNum].total += total;
                    infoSystemByVisit[vNum].trained += trained;
                    infoSystemByVisit[vNum].completed_forms += forms;
                    infoSystemByVisit[vNum].completed_followup_forms += followup;
                    infoSystemByVisit[vNum].skin_to_skin_90min_count += s2s;
                    infoSystemByVisit[vNum].resuscitated_with_ambu_count += ambu;
                }
            }

            if (data.medication_shortage) {
                drugAvailabilityOverall.total += 1;
                if (drugAvailabilityByVisit[vNum]) drugAvailabilityByVisit[vNum].total += 1;
                
                drugList.forEach(drug => {
                    if (data.medication_shortage[drug.key] === 'no') {
                        drugAvailabilityOverall[drug.key] += 1;
                        if (drugAvailabilityByVisit[vNum]) drugAvailabilityByVisit[vNum][drug.key] += 1;
                    }
                });
            }
        });
    }

    const pctExaminedByTrained = infoSystemAgg.total ? ((infoSystemAgg.trained / infoSystemAgg.total) * 100).toFixed(1) : 0;
    const pctCompletedForms = infoSystemAgg.trained ? ((infoSystemAgg.completed_forms / infoSystemAgg.trained) * 100).toFixed(1) : 0;
    const pctFollowupForms = infoSystemAgg.trained ? ((infoSystemAgg.completed_followup_forms / infoSystemAgg.trained) * 100).toFixed(1) : 0;
    const pctS2s = infoSystemAgg.total ? ((infoSystemAgg.skin_to_skin_90min_count / infoSystemAgg.total) * 100).toFixed(1) : 0;
    const pctAmbu = infoSystemAgg.total ? ((infoSystemAgg.resuscitated_with_ambu_count / infoSystemAgg.total) * 100).toFixed(1) : 0;

    const getInfoPct = (vNum, numeratorKey, denominatorKey) => {
        const d = infoSystemByVisit[vNum];
        return d && d[denominatorKey] > 0 ? ((d[numeratorKey] / d[denominatorKey]) * 100).toFixed(1) : null;
    };

    const infoLineLabels = [];
    const infoLineDataSets = isIMNCI 
        ? { seenByTrained: [], recordingForm: [], followup: [] }
        : { seenByTrained: [], followup: [], s2s: [], ambu: [] };

    [1, 2, 3, 4].forEach(vNum => {
        const d = infoSystemByVisit[vNum];
        if (d.total > 0 || d.trained > 0) {
            infoLineLabels.push(`${t('Visit')} ${vNum}`);
            infoLineDataSets.seenByTrained.push(getInfoPct(vNum, 'trained', 'total'));
            infoLineDataSets.followup.push(getInfoPct(vNum, 'completed_followup_forms', 'trained'));
            if (isIMNCI) {
                infoLineDataSets.recordingForm.push(getInfoPct(vNum, 'completed_forms', 'trained'));
            } else {
                infoLineDataSets.s2s.push(getInfoPct(vNum, 'skin_to_skin_90min_count', 'total'));
                infoLineDataSets.ambu.push(getInfoPct(vNum, 'resuscitated_with_ambu_count', 'total'));
            }
        }
    });

    const getAvailabilityPct = (vNum, drugKey) => {
        const d = drugAvailabilityByVisit[vNum];
        return d && d.total > 0 ? ((d[drugKey] / d.total) * 100).toFixed(1) : null;
    };

    const drugLineLabels = [];
    const drugLineDataSets = {};
    drugList.forEach(d => { drugLineDataSets[d.key] = []; });

    [1, 2, 3, 4].forEach(vNum => {
        if (drugAvailabilityByVisit[vNum].total > 0) {
            drugLineLabels.push(`${t('Visit')} ${vNum}`);
            drugList.forEach(drug => {
                drugLineDataSets[drug.key].push(getAvailabilityPct(vNum, drug.key));
            });
        }
    });

    const SKILL_GROUPS = isIMNCI ? IMNCI_SKILL_GROUPS : EENC_SKILL_GROUPS;

    // Filter problems by status
    const filteredGroupedProblems = {};
    let filteredTotalProblems = 0;
    
    if (visitReportStats?.groupedProblems) {
        Object.keys(visitReportStats.groupedProblems).forEach(locName => {
            const problems = visitReportStats.groupedProblems[locName];
            const filtered = problems.filter(item => {
                if (statusFilter === 'All') return true;
                // Combine Done and Resolved check
                if (statusFilter === 'Resolved/Done') {
                    return item.status === 'Resolved' || item.status === 'Done' || item.status === 'Resolved/Done';
                }
                return item.status === statusFilter;
            });
            if (filtered.length > 0) {
                filteredGroupedProblems[locName] = filtered;
                filteredTotalProblems += filtered.length;
            }
        });
    }

    return (
        <div className="animate-fade-in">
            {/* Common Top Level KPI row for both services */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <KpiCard title={t("Total Visit Reports")} value={visitReportStats.totalVisits} />
                <KpiCard title={t("Total Number of Training Sessions")} value={visitReportStats.totalSkillsTrained} unit={`(${visitReportStats.totalVisits > 0 ? (visitReportStats.totalSkillsTrained / visitReportStats.totalVisits).toFixed(1) : 0} ${t('mean sessions per visit')})`} />
            </div>

            {!rawReports && (
                <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-300 mb-8 font-bold text-sm" dir="rtl">
                    ⚠️ {t('Note: To view Information System and Drug/Supply Shortage data, ensure rawReports is included.')}
                </div>
            )}

            {/* Shared UI: Info System & Drugs logic */}
            {rawReports && (
                <>
                    {/* Information System KPIs */}
                    <h3 className={`text-xl font-extrabold text-slate-800 mb-5 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                        {t('Information System KPIs (Overall)')}
                    </h3>

                    {isIMNCI ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <InfoKpiTrendCard 
                                title={t(infoTrainedLabel)} 
                                avgValue={pctExaminedByTrained} totalNumerator={infoSystemAgg.trained} totalDenominator={infoSystemAgg.total}
                                v1Value={getInfoPct(1, 'trained', 'total')} v1Numerator={infoSystemByVisit[1]?.trained || 0} v1Denominator={infoSystemByVisit[1]?.total || 0}
                                v4Value={getInfoPct(4, 'trained', 'total')} v4Numerator={infoSystemByVisit[4]?.trained || 0} v4Denominator={infoSystemByVisit[4]?.total || 0}
                                lineLabels={infoLineLabels}
                                lineData={infoLineDataSets.seenByTrained}
                                color="#0ea5e9"
                                isAr={isAr} t={t} CopyImageButton={CopyImageButton}
                            />
                            <InfoKpiTrendCard 
                                title={t("Children with IMNCI recording form")} 
                                avgValue={pctCompletedForms} totalNumerator={infoSystemAgg.completed_forms} totalDenominator={infoSystemAgg.trained}
                                v1Value={getInfoPct(1, 'completed_forms', 'trained')} v1Numerator={infoSystemByVisit[1]?.completed_forms || 0} v1Denominator={infoSystemByVisit[1]?.trained || 0}
                                v4Value={getInfoPct(4, 'completed_forms', 'trained')} v4Numerator={infoSystemByVisit[4]?.completed_forms || 0} v4Denominator={infoSystemByVisit[4]?.trained || 0}
                                lineLabels={infoLineLabels}
                                lineData={infoLineDataSets.recordingForm}
                                color="#8b5cf6"
                                isAr={isAr} t={t} CopyImageButton={CopyImageButton}
                            />
                            <InfoKpiTrendCard 
                                title={t("Children returning for follow up")} 
                                avgValue={pctFollowupForms} totalNumerator={infoSystemAgg.completed_followup_forms} totalDenominator={infoSystemAgg.trained}
                                v1Value={getInfoPct(1, 'completed_followup_forms', 'trained')} v1Numerator={infoSystemByVisit[1]?.completed_followup_forms || 0} v1Denominator={infoSystemByVisit[1]?.trained || 0}
                                v4Value={getInfoPct(4, 'completed_followup_forms', 'trained')} v4Numerator={infoSystemByVisit[4]?.completed_followup_forms || 0} v4Denominator={infoSystemByVisit[4]?.trained || 0}
                                lineLabels={infoLineLabels}
                                lineData={infoLineDataSets.followup}
                                color="#f59e0b"
                                isAr={isAr} t={t} CopyImageButton={CopyImageButton}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <InfoKpiTrendCard 
                                title={t(infoTrainedLabel)} 
                                avgValue={pctExaminedByTrained} totalNumerator={infoSystemAgg.trained} totalDenominator={infoSystemAgg.total}
                                v1Value={getInfoPct(1, 'trained', 'total')} v1Numerator={infoSystemByVisit[1]?.trained || 0} v1Denominator={infoSystemByVisit[1]?.total || 0}
                                v4Value={getInfoPct(4, 'trained', 'total')} v4Numerator={infoSystemByVisit[4]?.trained || 0} v4Denominator={infoSystemByVisit[4]?.total || 0}
                                lineLabels={infoLineLabels}
                                lineData={infoLineDataSets.seenByTrained}
                                color="#0ea5e9"
                                isAr={isAr} t={t} CopyImageButton={CopyImageButton}
                            />
                            <InfoKpiTrendCard 
                                title={t("Babies skin-to-skin for 90min")} 
                                avgValue={pctS2s} totalNumerator={infoSystemAgg.skin_to_skin_90min_count} totalDenominator={infoSystemAgg.total}
                                v1Value={getInfoPct(1, 'skin_to_skin_90min_count', 'total')} v1Numerator={infoSystemByVisit[1]?.skin_to_skin_90min_count || 0} v1Denominator={infoSystemByVisit[1]?.total || 0}
                                v4Value={getInfoPct(4, 'skin_to_skin_90min_count', 'total')} v4Numerator={infoSystemByVisit[4]?.skin_to_skin_90min_count || 0} v4Denominator={infoSystemByVisit[4]?.total || 0}
                                lineLabels={infoLineLabels}
                                lineData={infoLineDataSets.s2s}
                                color="#8b5cf6"
                                isAr={isAr} t={t} CopyImageButton={CopyImageButton}
                            />
                            <InfoKpiTrendCard 
                                title={t("Babies resuscitated with Ambu bag")} 
                                avgValue={pctAmbu} totalNumerator={infoSystemAgg.resuscitated_with_ambu_count} totalDenominator={infoSystemAgg.total}
                                v1Value={getInfoPct(1, 'resuscitated_with_ambu_count', 'total')} v1Numerator={infoSystemByVisit[1]?.resuscitated_with_ambu_count || 0} v1Denominator={infoSystemByVisit[1]?.total || 0}
                                v4Value={getInfoPct(4, 'resuscitated_with_ambu_count', 'total')} v4Numerator={infoSystemByVisit[4]?.resuscitated_with_ambu_count || 0} v4Denominator={infoSystemByVisit[4]?.total || 0}
                                lineLabels={infoLineLabels}
                                lineData={infoLineDataSets.ambu}
                                color="#ec4899"
                                isAr={isAr} t={t} CopyImageButton={CopyImageButton}
                            />
                            <InfoKpiTrendCard 
                                title={t("Registered/Followed-up")} 
                                avgValue={pctFollowupForms} totalNumerator={infoSystemAgg.completed_followup_forms} totalDenominator={infoSystemAgg.trained}
                                v1Value={getInfoPct(1, 'completed_followup_forms', 'trained')} v1Numerator={infoSystemByVisit[1]?.completed_followup_forms || 0} v1Denominator={infoSystemByVisit[1]?.trained || 0}
                                v4Value={getInfoPct(4, 'completed_followup_forms', 'trained')} v4Numerator={infoSystemByVisit[4]?.completed_followup_forms || 0} v4Denominator={infoSystemByVisit[4]?.trained || 0}
                                lineLabels={infoLineLabels}
                                lineData={infoLineDataSets.followup}
                                color="#f59e0b"
                                isAr={isAr} t={t} CopyImageButton={CopyImageButton}
                            />
                        </div>
                    )}

                    {/* Drug/Supplies Availability KPIs */}
                    <h3 className={`text-xl font-extrabold text-slate-800 mb-5 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                        {t('Facility Drug & Supplies Availability (Percentage of facilities reporting always available)')}
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {drugList.map(drug => {
                            const count = drugAvailabilityOverall[drug.key] || 0;
                            const total = drugAvailabilityOverall.total || 0;
                            const safeTotal = total > 0 ? total : 1;
                            const pct = ((count / safeTotal) * 100).toFixed(1);
                            
                            return (
                                <InfoKpiTrendCard 
                                    key={drug.key}
                                    title={t(`${drug.label} Availability`)} 
                                    avgValue={total > 0 ? pct : null} 
                                    totalNumerator={count} 
                                    totalDenominator={total}
                                    v1Value={getAvailabilityPct(1, drug.key)} 
                                    v1Numerator={drugAvailabilityByVisit[1]?.[drug.key] || 0} 
                                    v1Denominator={drugAvailabilityByVisit[1]?.total || 0}
                                    v4Value={getAvailabilityPct(4, drug.key)} 
                                    v4Numerator={drugAvailabilityByVisit[4]?.[drug.key] || 0} 
                                    v4Denominator={drugAvailabilityByVisit[4]?.total || 0}
                                    lineLabels={drugLineLabels}
                                    lineData={drugLineDataSets[drug.key]}
                                    color={drug.color}
                                    isAr={isAr} 
                                    t={t} 
                                    CopyImageButton={CopyImageButton}
                                />
                            );
                        })}
                    </div>
                </>
            )}

            {/* Unified Trained Skills Groups for BOTH IMNCI and EENC */}
            <TrainedGroupRow title={SKILL_GROUPS.group1.title} details={visitReportStats.trainedSkillsGroups.group1.details} color={SKILL_GROUPS.group1.color} ScoreText={ScoreText} CopyImageButton={CopyImageButton} />
            <TrainedGroupRow title={SKILL_GROUPS.group2.title} details={visitReportStats.trainedSkillsGroups.group2.details} color={SKILL_GROUPS.group2.color} ScoreText={ScoreText} CopyImageButton={CopyImageButton} />
            <TrainedGroupRow title={SKILL_GROUPS.group3.title} details={visitReportStats.trainedSkillsGroups.group3.details} color={SKILL_GROUPS.group3.color} ScoreText={ScoreText} CopyImageButton={CopyImageButton} />

            {/* Geographical Stats & Challenges (Common to both) */}
            <div className="mb-8">
                <KpiBarChart title={`${t('Total Visits by')} ${t(geographicLevelName)}`} chartData={visitReportStats.geographicChartData} dataKey="count" />
            </div>

            <div className="mb-8 bg-white rounded-2xl shadow-md border border-black overflow-hidden">
                <div className={`p-5 border-b border-black bg-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isAr ? 'text-right' : 'text-left'}`}>
                    <h4 className="text-lg font-extrabold text-slate-800">{t('Facility Problems & Solutions (Combined)')}</h4>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-slate-600">{t('Filter by Status')}:</label>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-sky-500 focus:border-sky-500 shadow-sm"
                        >
                            <option value="All">{t('All')}</option>
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved/Done">Resolved / Done</option>
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse" dir={isAr ? 'rtl' : 'ltr'}>
                        <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider sticky top-0 z-10 shadow-sm border-b border-black">
                            <tr>
                                <th className={`px-4 py-4 border-black ${isAr ? 'border-l text-right' : 'border-r text-left'} w-[15%]`}>{t(dynamicLocationLabel)}</th>
                                <th className={`px-4 py-4 border-black ${isAr ? 'border-l text-right' : 'border-r text-left'} w-[30%]`}>{t('Problem / Challenge')}</th>
                                <th className={`px-4 py-4 border-black ${isAr ? 'border-l text-right' : 'border-r text-left'} w-[30%]`}>{t('Implemented Solution')}</th>
                                <th className={`px-4 py-4 border-black ${isAr ? 'border-l' : 'border-r'} w-[15%] text-center`}>{t('Status')}</th>
                                <th className="px-4 py-4 w-[10%] text-center">{t('Responsible Person')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTotalProblems === 0 && (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-500 font-bold">{t('No problems match the selected filter.')}</td></tr>
                            )}
                            {Object.keys(filteredGroupedProblems).sort().map(locName => {
                                const problems = filteredGroupedProblems[locName];
                                return problems.map((item, idx) => (
                                    <tr key={`${locName}-${idx}`} className="hover:bg-sky-50 transition-colors border-b border-black">
                                        {idx === 0 && (
                                            <td rowSpan={problems.length} className={`px-4 py-3 border-black ${isAr ? 'border-l' : 'border-r'} align-top font-extrabold text-slate-800 bg-slate-100 w-[15%] border-b border-black`}>
                                                {locName}
                                            </td>
                                        )}
                                        <td className={`px-4 py-3 border-black ${isAr ? 'border-l text-right' : 'border-r text-left'} align-top text-xs text-rose-700 whitespace-pre-wrap font-medium`}>
                                            {item.problem}
                                            {dynamicLocationLevel !== 'Facility' && (
                                                <div className="mt-2 text-[10px] text-slate-500 font-bold bg-white inline-block px-1.5 py-0.5 rounded border border-slate-300" dir="ltr">
                                                    {item.facility} - {item.date}
                                                </div>
                                            )}
                                        </td>
                                        
                                        <td className={`px-4 py-3 border-black ${isAr ? 'border-l text-right' : 'border-r text-left'} align-top text-xs text-emerald-700 whitespace-pre-wrap font-medium`}>
                                            {item.solution}
                                        </td>

                                        <td className={`px-4 py-3 border-black ${isAr ? 'border-l' : 'border-r'} align-top text-center`}>
                                            {renderStatusCell(item.status, item.reportId, item.challengeId, 'status')}
                                        </td>

                                        <td className="px-4 py-3 align-top text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            {item.person}
                                        </td>
                                    </tr>
                                ));
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VisitReportDashboardTab;