// VisitReportDashboardTab.jsx
import React, { useRef } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { useTranslation } from './LanguageContext'; 
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, BarElement, Title, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend
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

    const infoSystemLineData = {
        labels: infoLineLabels,
        datasets: isIMNCI ? [
            { label: t('Seen by Trained Cadre (%)'), data: infoLineDataSets.seenByTrained, borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', tension: 0.3, pointRadius: 5 },
            { label: t('With Recording Form (%)'), data: infoLineDataSets.recordingForm, borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.3, pointRadius: 5 },
            { label: t('Return for Follow-up (%)'), data: infoLineDataSets.followup, borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.3, pointRadius: 5 }
        ] : [
            { label: t('Deliveries by Trained Cadre (%)'), data: infoLineDataSets.seenByTrained, borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', tension: 0.3, pointRadius: 5 },
            { label: t('90min Skin-to-Skin (%)'), data: infoLineDataSets.s2s, borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.3, pointRadius: 5 },
            { label: t('Resuscitated with Ambu (%)'), data: infoLineDataSets.ambu, borderColor: '#ec4899', backgroundColor: '#ec4899', tension: 0.3, pointRadius: 5 },
            { label: t('Registered/Followed-up (%)'), data: infoLineDataSets.followup, borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.3, pointRadius: 5 }
        ]
    };

    const getAvailabilityPct = (vNum, drugKey) => {
        const d = drugAvailabilityByVisit[vNum];
        return d && d.total > 0 ? ((d[drugKey] / d.total) * 100).toFixed(1) : null;
    };

    const drugLineLabels = [];
    const drugLineDataSets = { d1: [], d2: [], d3: [], d4: [], d5: [], d6: [] };

    [1, 2, 3, 4].forEach(vNum => {
        if (drugAvailabilityByVisit[vNum].total > 0) {
            drugLineLabels.push(`${t('Visit')} ${vNum}`);
            drugLineDataSets.d1.push(getAvailabilityPct(vNum, drugList[0].key));
            drugLineDataSets.d2.push(getAvailabilityPct(vNum, drugList[1].key));
            drugLineDataSets.d3.push(getAvailabilityPct(vNum, drugList[2].key));
            drugLineDataSets.d4.push(getAvailabilityPct(vNum, drugList[3].key));
            if (!isIMNCI) {
                drugLineDataSets.d5.push(getAvailabilityPct(vNum, drugList[4].key));
                drugLineDataSets.d6.push(getAvailabilityPct(vNum, drugList[5].key));
            }
        }
    });

    const datasetsDrug = [
        { label: t(`${drugList[0].label} Availability`), data: drugLineDataSets.d1, borderColor: drugList[0].color, backgroundColor: drugList[0].color, tension: 0.3, pointRadius: 5 },
        { label: t(`${drugList[1].label} Availability`), data: drugLineDataSets.d2, borderColor: drugList[1].color, backgroundColor: drugList[1].color, tension: 0.3, pointRadius: 5 },
        { label: t(`${drugList[2].label} Availability`), data: drugLineDataSets.d3, borderColor: drugList[2].color, backgroundColor: drugList[2].color, tension: 0.3, pointRadius: 5 },
        { label: t(`${drugList[3].label} Availability`), data: drugLineDataSets.d4, borderColor: drugList[3].color, backgroundColor: drugList[3].color, tension: 0.3, pointRadius: 5 }
    ];
    if (!isIMNCI) {
        datasetsDrug.push({ label: t(`${drugList[4].label} Availability`), data: drugLineDataSets.d5, borderColor: drugList[4].color, backgroundColor: drugList[4].color, tension: 0.3, pointRadius: 5 });
        datasetsDrug.push({ label: t(`${drugList[5].label} Availability`), data: drugLineDataSets.d6, borderColor: drugList[5].color, backgroundColor: drugList[5].color, tension: 0.3, pointRadius: 5 });
    }

    const drugLineData = { labels: drugLineLabels, datasets: datasetsDrug };

    const getLineOptions = (yAxisTitle) => ({
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { family: "'Inter', sans-serif", weight: 'bold' } } }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.raw}%` } } },
        scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: yAxisTitle, font: { weight: 'bold' } } }, x: { reverse: isAr, grid: { display: false } } }
    });

    const SKILL_GROUPS = isIMNCI ? IMNCI_SKILL_GROUPS : EENC_SKILL_GROUPS;

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
                    <div className="bg-white p-6 rounded-2xl shadow-md border border-black mb-8">
                        <h4 className={`text-lg font-extrabold text-slate-800 mb-6 border-b border-black pb-2 ${isAr ? 'text-right' : 'text-left'}`}>{t('Information System KPIs (Overall)')}</h4>
                        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-8`}>
                            <KpiCard 
                                title={t(infoTrainedLabel)} 
                                value={`${pctExaminedByTrained}%`} 
                                unit={`(${infoSystemAgg.trained} / ${infoSystemAgg.total} ${t(infoTotalLabel)})`}
                            />
                            {isIMNCI ? (
                                <KpiCard 
                                    title={t("Children with IMNCI recording form")} 
                                    value={`${pctCompletedForms}%`} 
                                    unit={`(${infoSystemAgg.completed_forms} / ${infoSystemAgg.trained} ${t('trained')})`}
                                />
                            ) : (
                                <KpiCard 
                                    title={t("Babies skin-to-skin for 90min")} 
                                    value={`${pctS2s}%`} 
                                    unit={`(${infoSystemAgg.skin_to_skin_90min_count} / ${infoSystemAgg.total} ${t('total')})`}
                                />
                            )}
                            {isIMNCI ? (
                                <KpiCard 
                                    title={t("Children returning for follow up")} 
                                    value={`${pctFollowupForms}%`} 
                                    unit={`(${infoSystemAgg.completed_followup_forms} / ${infoSystemAgg.trained} ${t('trained')})`}
                                />
                            ) : (
                                <KpiCard 
                                    title={t("Babies resuscitated with Ambu bag")} 
                                    value={`${pctAmbu}%`} 
                                    unit={`(${infoSystemAgg.resuscitated_with_ambu_count} / ${infoSystemAgg.total} ${t('total')})`}
                                />
                            )}
                        </div>

                        {infoLineLabels.length > 0 && (
                            <div className="relative h-[350px] w-full border-t border-slate-200 pt-6">
                                <h5 className="text-sm font-bold text-slate-600 mb-4 text-center">{t('Information System Performance Over Time')}</h5>
                                <div dir="ltr" className="h-full w-full">
                                    <Line options={getLineOptions(t('KPI Performance (%)'))} data={infoSystemLineData} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Drug/Supplies Availability KPIs */}
                    <div className="bg-white p-6 rounded-2xl shadow-md border border-black mb-8">
                        <h4 className={`text-lg font-extrabold text-slate-800 mb-6 border-b border-black pb-2 ${isAr ? 'text-right' : 'text-left'}`}>{t('Facility Drug & Supplies Availability (Percentage of facilities reporting always available)')}</h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
                            {drugList.map(drug => {
                                const count = drugAvailabilityOverall[drug.key] || 0;
                                const total = drugAvailabilityOverall.total || 1;
                                const pct = ((count / total) * 100).toFixed(1);
                                return (
                                    <div key={drug.key} className="bg-emerald-50 p-4 rounded-xl border border-emerald-300 shadow-sm text-center">
                                        <h5 className="text-xs font-extrabold text-emerald-800 mb-2 h-8 flex items-center justify-center leading-tight">{t(drug.label)}</h5>
                                        <div className="text-xl font-extrabold text-emerald-600 mb-1" dir="ltr">{pct}%</div>
                                        <div className="text-[10px] text-emerald-600 font-bold" dir="ltr">{count} {t('of')} {total} {t('facilities')}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {drugLineLabels.length > 0 && (
                            <div className="relative h-[350px] w-full border-t border-slate-200 pt-6">
                                <h5 className="text-sm font-bold text-slate-600 mb-4 text-center">{t('Availability Over Time')}</h5>
                                <div dir="ltr" className="h-full w-full">
                                    <Line options={getLineOptions(t('Facilities with item available (%)'))} data={drugLineData} />
                                </div>
                            </div>
                        )}
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
                <h4 className={`text-lg font-extrabold text-slate-800 p-5 border-b border-black bg-slate-100 ${isAr ? 'text-right' : 'text-left'}`}>{t('Facility Problems & Solutions (Combined)')}</h4>
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
                            {visitReportStats.totalProblems === 0 && (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-500 font-bold">{t('No problems recorded.')}</td></tr>
                            )}
                            {Object.keys(visitReportStats.groupedProblems).sort().map(locName => {
                                const problems = visitReportStats.groupedProblems[locName];
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