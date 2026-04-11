// VisitReportDashboardTab.jsx
import React, { useRef } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { useTranslation } from './LanguageContext'; 
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

// Register ChartJS elements
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

// --- Local Component: Row containing Detailed Card (Left) and Horizontal Bar Chart (Right) ---
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
        indexAxis: 'y', // Horizontal Bar Chart
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
            }
        },
        scales: {
            x: { 
                reverse: isAr,
                beginAtZero: true, 
                grid: { color: '#e2e8f0', drawBorder: false },
                ticks: { precision: 0, color: '#475569', font: { family: "'Inter', sans-serif", weight: '500' } } 
            },
            y: { 
                position: isAr ? 'right' : 'left',
                grid: { display: false, drawBorder: false },
                ticks: { color: '#334155', font: { size: 11, family: "'Inter', sans-serif", weight: 'bold' } } 
            }
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
    EENC_SKILLS_LABELS,
    KpiCard,
    KpiBarChart,
    ScoreText,
    CopyImageButton
}) => {
    const { t, language } = useTranslation();
    const isAr = language === 'ar';

    if (!visitReportStats) return null;

    // --- AGGREGATE NEW KPIs DATA (Info System & Drug Availability) ---
    const infoSystemAgg = { total_examined: 0, examined_by_trained: 0, completed_forms: 0, completed_followup_forms: 0 };
    const drugAvailabilityOverall = { total: 0, amoxicillin: 0, zinc: 0, ors: 0, coartem: 0 };
    
    const infoSystemByVisit = { 
        1: { total_examined: 0, examined_by_trained: 0, completed_forms: 0, completed_followup_forms: 0 }, 
        2: { total_examined: 0, examined_by_trained: 0, completed_forms: 0, completed_followup_forms: 0 }, 
        3: { total_examined: 0, examined_by_trained: 0, completed_forms: 0, completed_followup_forms: 0 }, 
        4: { total_examined: 0, examined_by_trained: 0, completed_forms: 0, completed_followup_forms: 0 } 
    };

    const drugAvailabilityByVisit = { 
        1: { total: 0, amoxicillin: 0, zinc: 0, ors: 0, coartem: 0 }, 
        2: { total: 0, amoxicillin: 0, zinc: 0, ors: 0, coartem: 0 }, 
        3: { total: 0, amoxicillin: 0, zinc: 0, ors: 0, coartem: 0 }, 
        4: { total: 0, amoxicillin: 0, zinc: 0, ors: 0, coartem: 0 } 
    };

    const rawReports = visitReportStats.rawReports;

    if (activeService === 'IMNCI' && rawReports) {
        rawReports.forEach(rep => {
            const data = rep.fullData || rep;
            const vNum = parseInt(data.visitNumber) || parseInt(rep.visitNumber) || 1;
            
            // Aggregate Info System
            if (data.info_system) {
                const total = Number(data.info_system.total_examined) || 0;
                const trained = Number(data.info_system.examined_by_trained) || 0;
                const forms = Number(data.info_system.completed_forms) || 0;
                const followup = Number(data.info_system.completed_followup_forms) || 0;

                // Overall Totals
                infoSystemAgg.total_examined += total;
                infoSystemAgg.examined_by_trained += trained;
                infoSystemAgg.completed_forms += forms;
                infoSystemAgg.completed_followup_forms += followup;

                // By Visit Totals
                if (infoSystemByVisit[vNum]) {
                    infoSystemByVisit[vNum].total_examined += total;
                    infoSystemByVisit[vNum].examined_by_trained += trained;
                    infoSystemByVisit[vNum].completed_forms += forms;
                    infoSystemByVisit[vNum].completed_followup_forms += followup;
                }
            }

            // Aggregate Drug Availability 
            if (data.medication_shortage) {
                drugAvailabilityOverall.total += 1;
                if (drugAvailabilityByVisit[vNum]) drugAvailabilityByVisit[vNum].total += 1;
                
                ['amoxicillin', 'zinc', 'ors', 'coartem'].forEach(drug => {
                    // 'no' means NO SHORTAGE (i.e. the drug WAS available)
                    if (data.medication_shortage[drug] === 'no') {
                        drugAvailabilityOverall[drug] += 1;
                        if (drugAvailabilityByVisit[vNum]) drugAvailabilityByVisit[vNum][drug] += 1;
                    }
                });
            }
        });
    }

    // Calculations for OVERALL Info System Percentages
    const pctExaminedByTrained = infoSystemAgg.total_examined ? ((infoSystemAgg.examined_by_trained / infoSystemAgg.total_examined) * 100).toFixed(1) : 0;
    const pctCompletedForms = infoSystemAgg.examined_by_trained ? ((infoSystemAgg.completed_forms / infoSystemAgg.examined_by_trained) * 100).toFixed(1) : 0;
    const pctFollowupForms = infoSystemAgg.examined_by_trained ? ((infoSystemAgg.completed_followup_forms / infoSystemAgg.examined_by_trained) * 100).toFixed(1) : 0;

    // --- SETUP: Information System Line Chart ---
    const getInfoPct = (vNum, numeratorKey, denominatorKey) => {
        const d = infoSystemByVisit[vNum];
        return d && d[denominatorKey] > 0 ? ((d[numeratorKey] / d[denominatorKey]) * 100).toFixed(1) : null;
    };

    const infoLineLabels = [];
    const infoLineDataSets = { seenByTrained: [], recordingForm: [], followup: [] };

    [1, 2, 3, 4].forEach(vNum => {
        const d = infoSystemByVisit[vNum];
        if (d.total_examined > 0 || d.examined_by_trained > 0) {
            infoLineLabels.push(`${t('Visit')} ${vNum}`);
            infoLineDataSets.seenByTrained.push(getInfoPct(vNum, 'examined_by_trained', 'total_examined'));
            infoLineDataSets.recordingForm.push(getInfoPct(vNum, 'completed_forms', 'examined_by_trained'));
            infoLineDataSets.followup.push(getInfoPct(vNum, 'completed_followup_forms', 'examined_by_trained'));
        }
    });

    const infoSystemLineData = {
        labels: infoLineLabels,
        datasets: [
            { label: t('Seen by Trained Cadre (%)'), data: infoLineDataSets.seenByTrained, borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', tension: 0.3, pointRadius: 5 },
            { label: t('With Recording Form (%)'), data: infoLineDataSets.recordingForm, borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.3, pointRadius: 5 },
            { label: t('Return for Follow-up (%)'), data: infoLineDataSets.followup, borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.3, pointRadius: 5 }
        ]
    };

    // --- SETUP: Drug Availability Line Chart ---
    const getAvailabilityPct = (vNum, drug) => {
        const d = drugAvailabilityByVisit[vNum];
        return d && d.total > 0 ? ((d[drug] / d.total) * 100).toFixed(1) : null;
    };

    const drugLineLabels = [];
    const drugLineDataSets = { amoxicillin: [], zinc: [], ors: [], coartem: [] };

    [1, 2, 3, 4].forEach(vNum => {
        if (drugAvailabilityByVisit[vNum].total > 0) {
            drugLineLabels.push(`${t('Visit')} ${vNum}`);
            drugLineDataSets.amoxicillin.push(getAvailabilityPct(vNum, 'amoxicillin'));
            drugLineDataSets.zinc.push(getAvailabilityPct(vNum, 'zinc'));
            drugLineDataSets.ors.push(getAvailabilityPct(vNum, 'ors'));
            drugLineDataSets.coartem.push(getAvailabilityPct(vNum, 'coartem'));
        }
    });

    const drugLineData = {
        labels: drugLineLabels,
        datasets: [
            { label: t('Amoxicillin Availability'), data: drugLineDataSets.amoxicillin, borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.3, pointRadius: 5 },
            { label: t('Zinc Availability'), data: drugLineDataSets.zinc, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3, pointRadius: 5 },
            { label: t('ORS Availability'), data: drugLineDataSets.ors, borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.3, pointRadius: 5 },
            { label: t('Coartem Availability'), data: drugLineDataSets.coartem, borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.3, pointRadius: 5 }
        ]
    };

    // --- Shared Line Chart Options ---
    const getLineOptions = (yAxisTitle) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { font: { family: "'Inter', sans-serif", weight: 'bold' } } },
            tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.raw}%` } }
        },
        scales: {
            y: { beginAtZero: true, max: 100, title: { display: true, text: yAxisTitle, font: { weight: 'bold' } } },
            x: { reverse: isAr, grid: { display: false } }
        }
    });

    return (
        <div className="animate-fade-in">
            {activeService === 'IMNCI' ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <KpiCard title={t("Total Visit Reports")} value={visitReportStats.totalVisits} />
                        <KpiCard 
                            title={t("Total Number of Training Sessions")} 
                            value={visitReportStats.totalSkillsTrained} 
                            unit={`(${visitReportStats.totalVisits > 0 ? (visitReportStats.totalSkillsTrained / visitReportStats.totalVisits).toFixed(1) : 0} ${t('mean sessions per visit')})`}
                        />
                    </div>

                    {!rawReports && (
                        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-300 mb-8 font-bold text-sm" dir="rtl">
                            ⚠️ {t('Note: To view Information System and Drug Shortage data, ensure rawReports is included.')}
                        </div>
                    )}

                    {rawReports && (
                        <>
                            {/* --- Information System KPIs --- */}
                            <div className="bg-white p-6 rounded-2xl shadow-md border border-black mb-8">
                                <h4 className={`text-lg font-extrabold text-slate-800 mb-6 border-b border-black pb-2 ${isAr ? 'text-right' : 'text-left'}`}>{t('Information System KPIs (Overall)')}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <KpiCard 
                                        title={t("Children seen by IMNCI trained cadre")} 
                                        value={`${pctExaminedByTrained}%`} 
                                        unit={`(${infoSystemAgg.examined_by_trained} / ${infoSystemAgg.total_examined} ${t('total')})`}
                                    />
                                    <KpiCard 
                                        title={t("Children with IMNCI recording form")} 
                                        value={`${pctCompletedForms}%`} 
                                        unit={`(${infoSystemAgg.completed_forms} / ${infoSystemAgg.examined_by_trained} ${t('trained')})`}
                                    />
                                    <KpiCard 
                                        title={t("Children returning for follow up")} 
                                        value={`${pctFollowupForms}%`} 
                                        unit={`(${infoSystemAgg.completed_followup_forms} / ${infoSystemAgg.examined_by_trained} ${t('trained')})`}
                                    />
                                </div>

                                {/* Information System Trend Line Chart */}
                                {infoLineLabels.length > 0 && (
                                    <div className="relative h-[350px] w-full border-t border-slate-200 pt-6">
                                        <h5 className="text-sm font-bold text-slate-600 mb-4 text-center">{t('Information System Performance Over Time')}</h5>
                                        <div dir="ltr" className="h-full w-full">
                                            <Line options={getLineOptions(t('KPI Performance (%)'))} data={infoSystemLineData} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* --- Drug Availability KPIs & Chart --- */}
                            <div className="bg-white p-6 rounded-2xl shadow-md border border-black mb-8">
                                <h4 className={`text-lg font-extrabold text-slate-800 mb-6 border-b border-black pb-2 ${isAr ? 'text-right' : 'text-left'}`}>{t('Facility Drug Availability (Percentage of facilities reporting drugs always available)')}</h4>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                    {[
                                        { key: 'amoxicillin', label: 'Amoxicillin' },
                                        { key: 'zinc', label: 'Zinc' },
                                        { key: 'ors', label: 'ORS' },
                                        { key: 'coartem', label: 'Coartem' }
                                    ].map(drug => {
                                        const count = drugAvailabilityOverall[drug.key] || 0;
                                        const total = drugAvailabilityOverall.total || 1;
                                        const pct = ((count / total) * 100).toFixed(1);
                                        return (
                                            <div key={drug.key} className="bg-emerald-50 p-4 rounded-xl border border-emerald-300 shadow-sm text-center">
                                                <h5 className="text-sm font-extrabold text-emerald-800 mb-2">{t(drug.label)} {t('Availability')}</h5>
                                                <div className="text-2xl font-extrabold text-emerald-600 mb-1" dir="ltr">{pct}%</div>
                                                <div className="text-xs text-emerald-600 font-bold" dir="ltr">{count} {t('of')} {total} {t('facilities')}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Drug Availability Trend Line Chart */}
                                {drugLineLabels.length > 0 && (
                                    <div className="relative h-[350px] w-full border-t border-slate-200 pt-6">
                                        <h5 className="text-sm font-bold text-slate-600 mb-4 text-center">{t('Drug Availability Over Time')}</h5>
                                        <div dir="ltr" className="h-full w-full">
                                            <Line options={getLineOptions(t('Facilities with Drug Available (%)'))} data={drugLineData} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Grouped Trained Skills KPIs & Charts */}
                    <TrainedGroupRow 
                        title={IMNCI_SKILL_GROUPS.group1.title} 
                        details={visitReportStats.trainedSkillsGroups.group1.details} 
                        color={IMNCI_SKILL_GROUPS.group1.color} 
                        ScoreText={ScoreText}
                        CopyImageButton={CopyImageButton}
                    />
                    
                    <TrainedGroupRow 
                        title={IMNCI_SKILL_GROUPS.group2.title} 
                        details={visitReportStats.trainedSkillsGroups.group2.details} 
                        color={IMNCI_SKILL_GROUPS.group2.color} 
                        ScoreText={ScoreText}
                        CopyImageButton={CopyImageButton}
                    />
                    
                    <TrainedGroupRow 
                        title={IMNCI_SKILL_GROUPS.group3.title} 
                        details={visitReportStats.trainedSkillsGroups.group3.details} 
                        color={IMNCI_SKILL_GROUPS.group3.color} 
                        ScoreText={ScoreText}
                        CopyImageButton={CopyImageButton}
                    />
                </>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-6 mb-8">
                        <KpiCard title={t("Total Visit Reports")} value={visitReportStats.totalVisits} />
                    </div>
                    <div className="mb-8 bg-white rounded-2xl shadow-md border border-black overflow-hidden">
                        <h4 className={`text-lg font-extrabold text-slate-800 p-5 border-b border-black bg-slate-100 ${isAr ? 'text-right' : 'text-left'}`}>{t('Visit Breakdown & Skills Trained by Facility')}</h4>
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse" dir={isAr ? 'rtl' : 'ltr'}>
                            <thead className="bg-slate-200 text-xs uppercase text-slate-700 tracking-wider">
                                <tr>
                                    <th className={`px-5 py-4 border-b border-black ${isAr ? 'text-right border-l' : 'text-left border-r'}`}>{t('Facility')}</th>
                                    <th className={`px-5 py-4 border-b border-black text-center bg-sky-100 ${isAr ? 'border-l' : 'border-r'}`}>{t('Total Visits')}</th>
                                    {visitReportStats.distinctSkillKeys.map(skillKey => (
                                        <th key={skillKey} className={`px-3 py-4 border-b border-black text-center break-words whitespace-normal text-[11px] max-w-[120px] ${isAr ? 'border-l' : 'border-r'}`}>
                                            {t(EENC_SKILLS_LABELS[skillKey] || skillKey)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visitReportStats.facilityTableData.map(row => (
                                    <tr key={row.id} className="hover:bg-sky-50 transition-colors border-b border-black">
                                        <td className={`px-5 py-3 font-semibold text-slate-800 ${isAr ? 'text-right border-l' : 'text-left border-r'} border-black`}>{row.facilityName}</td>
                                        <td className={`px-5 py-3 text-center font-bold bg-sky-50 text-sky-800 ${isAr ? 'border-l' : 'border-r'} border-black`} dir="ltr">{row.visitCount}</td>
                                        {visitReportStats.distinctSkillKeys.map(skillKey => (
                                            <td key={skillKey} className={`px-3 py-3 text-center text-slate-700 font-medium ${isAr ? 'border-l' : 'border-r'} border-black`} dir="ltr">
                                                {row.skills[skillKey] || 0}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {visitReportStats.facilityTableData.length === 0 && (
                                    <tr><td colSpan={2 + visitReportStats.distinctSkillKeys.length} className="p-8 text-center text-slate-500 font-bold">{t('No visits found for current filter.')}</td></tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </>
            )}

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