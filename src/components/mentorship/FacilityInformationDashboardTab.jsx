import React, { useMemo, useRef } from 'react';
import { useTranslation } from './LanguageContext';
import { KpiCard, CopyImageButton, ScoreText } from './MentorshipDashboardShared';
import { Line, Bar } from 'react-chartjs-2';
import { SlidersHorizontal, Activity } from 'lucide-react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, BarElement, Title, Tooltip, Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler
);

// --- Detailed KPI Trend Card ---
const InfoKpiTrendCard = ({ 
    title, 
    avgValue, totalNumerator, totalDenominator,
    v1Value, v1Numerator, v1Denominator,
    v4Value, v4Numerator, v4Denominator,
    lineLabels, lineData, color, isAr, t 
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
        <div ref={cardRef} className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-sm sm:text-base font-extrabold text-slate-800 mb-4 sm:mb-6 text-center tracking-wide pr-8 break-words">{title}</h4>
            
            <div className="flex justify-between items-center gap-2 sm:gap-4 mb-6">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t('Visit 1')}</span>
                    <div className="border border-slate-300 bg-white rounded-lg px-3 sm:px-4 py-1.5 font-bold text-slate-700 shadow-sm text-sm flex flex-col items-center">
                        {v1Value !== null && v1Value !== undefined ? `${Math.round(v1Value)}%` : '-'}
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5 whitespace-nowrap">
                            {v1Numerator !== undefined && v1Denominator !== undefined ? `${v1Numerator} / ${v1Denominator}` : '- / -'}
                        </span>
                    </div>
                </div>
                
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t('Average')}</span>
                    <div className="border border-slate-800 bg-white rounded-xl px-4 sm:px-10 py-2 sm:py-3 shadow-sm flex flex-col items-center justify-center">
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
                    <div className="border border-slate-300 bg-white rounded-lg px-3 sm:px-4 py-1.5 font-bold text-slate-700 shadow-sm text-sm flex flex-col items-center">
                        {v4Value !== null && v4Value !== undefined ? `${Math.round(v4Value)}%` : '-'}
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5 whitespace-nowrap">
                            {v4Numerator !== undefined && v4Denominator !== undefined ? `${v4Numerator} / ${v4Denominator}` : '- / -'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="relative flex-grow min-h-[220px]" dir="ltr">
                {lineLabels.length > 0 ? (
                    <Line options={options} data={chartData} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 font-semibold text-xs text-center p-4">
                        {t('No data available.')}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Custom Bar Chart KPI for Integrated Services ---
const IntegratedServicesBarKpi = ({ stats, t }) => {
    const cardRef = useRef(null);

    const data = {
        labels: [t('Immunization'), t('Nutrition'), t('Growth Monitoring')],
        datasets: [{
            data: [stats.immunization, stats.nutrition, stats.growthMonitoring],
            backgroundColor: ['#f97316', '#6366f1', '#84cc16'],
            borderRadius: 6,
            barPercentage: 0.5
        }]
    };

    // Custom plugin to draw the percentage text above each vertical bar
    const verticalBarLabelPlugin = {
        id: 'verticalBarLabelPlugin',
        afterDatasetsDraw(chart) {
            const { ctx, data } = chart;
            const datasetMeta = chart.getDatasetMeta(0);
            if (!datasetMeta || !datasetMeta.data) return;

            ctx.save();
            datasetMeta.data.forEach((datapoint, index) => {
                const value = data.datasets[0].data[index];
                if (value === null || value === undefined) return;
                
                const text = `${value.toFixed(1)}%`;
                ctx.font = 'bold 12px "Inter", sans-serif';
                ctx.fillStyle = '#334155'; 
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                
                // Draw text slightly above the top of the bar
                ctx.fillText(text, datapoint.x, datapoint.y - 5);
            });
            ctx.restore();
        }
    };

    const options = {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { 
            legend: { display: false }, 
            tooltip: { 
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                callbacks: { label: c => ` ${c.raw.toFixed(1)}%` } 
            } 
        },
        scales: {
            y: { 
                min: 0, 
                max: 100, 
                display: true, 
                grid: { color: '#e2e8f0', drawBorder: false },
                ticks: { callback: (val) => `${val}%`, color: '#475569', font: { family: "'Inter', sans-serif", size: 10, weight: '600' } }
            },
            x: { 
                grid: { display: false, drawBorder: false }, 
                ticks: { font: { size: 11, weight: 'bold' }, color: '#475569' } 
            }
        },
        layout: {
            padding: {
                top: 15 // Ensure room for the top label
            }
        }
    };

    return (
        <div ref={cardRef} className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative justify-center">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={t('Integrated Child Health Services')} /></div>
            <div className="flex items-center justify-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-sky-600" />
                <h4 className="text-sm sm:text-base font-extrabold text-slate-800 text-center tracking-wide pr-8 break-words">
                    {t('Integrated Child Health Services')}
                </h4>
            </div>
            <p className="text-center text-xs text-slate-500 font-semibold mb-6 px-2">
                {t('Percentage of supervised facilities integrating additional core child health services (Based on Baseline / First Visit).')}
            </p>
            <div className="relative flex-grow min-h-[220px]" dir="ltr">
                <Bar data={data} options={options} plugins={[verticalBarLabelPlugin]} />
            </div>
        </div>
    );
};

// --- Main Dashboard Tab Component ---
const FacilityInformationDashboardTab = ({
    visitReports,
    activeService,
    activeState,
    activeLocality,
    STATE_LOCALITIES
}) => {
    const { t, language } = useTranslation();
    const isAr = language === 'ar';

    // Scoped reports strictly matched to active Service
    const scopedReports = useMemo(() => {
        if (!visitReports) return [];
        return visitReports.filter(r => {
            const reportService = r.service || r.fullData?.service;
            if (reportService !== activeService) return false;
            
            const rState = r.state || r.fullData?.state;
            const rLocality = r.locality || r.fullData?.locality;

            const matchState = !activeState || rState === activeState || rState === STATE_LOCALITIES?.[activeState]?.ar;
            const matchLocality = !activeLocality || rLocality === activeLocality || rLocality === STATE_LOCALITIES?.[activeState]?.localities?.find(l => l.en === activeLocality)?.ar;
            
            return matchState && matchLocality;
        });
    }, [visitReports, activeService, activeState, activeLocality, STATE_LOCALITIES]);

    const uniqueVisitedFacilitiesCount = useMemo(() => {
        const uniqueIds = new Set(scopedReports.map(r => r.facilityId || r.fullData?.facilityId));
        return uniqueIds.size;
    }, [scopedReports]);

    const toolsList = useMemo(() => [
        { key: 'chartbook', label: 'Clinical Chartbooklet (كتيب اللوحات)', color: '#0ea5e9' },
        { key: 'recordForm', label: 'Recording Form (سجل العلاج المتكامل)', color: '#8b5cf6' },
        { key: 'weightScale', label: 'Infant Weight Scale (ميزان الوزن)', color: '#10b981' },
        { key: 'heightScale', label: 'Length/Height Board (ميزان الطول)', color: '#f59e0b' },
        { key: 'thermometer', label: 'Clinical Thermometer (ميزان الحرارة)', color: '#ec4899' },
        { key: 'timer', label: 'Respiratory Rate Timer (ساعة مؤقت)', color: '#3b82f6' },
        { key: 'orsCorner', label: 'ORS Hydration Corner (غرفة إرواء)', color: '#14b8a6' }
    ], []);

    const checkToolAvailability = (toolsObj, key) => {
        if (!toolsObj) return false;
        const status = toolsObj[key];
        return status === 'yes' || status === 'Yes' || status === true || status === 'true';
    };

    // Calculate aggregated overall parameters for the tools list
    const { toolAggOverall, toolAggByVisit } = useMemo(() => {
        const aggOverall = {};
        const aggByVisit = { 1: {}, 2: {}, 3: {}, 4: {} };

        toolsList.forEach(t => {
            aggOverall[t.key] = { numerator: 0, denominator: 0 };
            [1, 2, 3, 4].forEach(v => {
                aggByVisit[v][t.key] = { numerator: 0, denominator: 0 };
            });
        });

        scopedReports.forEach(r => {
            const vNum = parseInt(r.visitNumber || r.fullData?.visitNumber) || 1;
            const tools = r.fullData?.essential_tools || r.essential_tools;

            if (tools && aggByVisit[vNum]) {
                toolsList.forEach(tool => {
                    const available = checkToolAvailability(tools, tool.key);
                    aggOverall[tool.key].numerator += available ? 1 : 0;
                    aggOverall[tool.key].denominator += 1;

                    aggByVisit[vNum][tool.key].numerator += available ? 1 : 0;
                    aggByVisit[vNum][tool.key].denominator += 1;
                });
            }
        });

        return { toolAggOverall: aggOverall, toolAggByVisit: aggByVisit };
    }, [scopedReports, toolsList]);

    // Calculate specific stats for the Integrated Services (Bar Chart + Top KPI)
    // IMPORTANT: Calculated ONLY based on Baseline / First Visit per facility
    const integratedStats = useMemo(() => {
        let total = 0;
        let imm = 0;
        let nut = 0;
        let gm = 0;
        let fullyIntegratedCount = 0;

        // Group by facility and extract ONLY the earliest visit
        const firstVisitsMap = new Map();
        
        // Sort chronologically ascending
        const sortedReportsAsc = [...scopedReports].sort((a, b) => 
            new Date(a.visitDate || a.fullData?.visitDate || 0).getTime() - new Date(b.visitDate || b.fullData?.visitDate || 0).getTime()
        );

        sortedReportsAsc.forEach(r => {
            const facId = r.facilityId || r.fullData?.facilityId;
            if (facId && !firstVisitsMap.has(facId)) {
                firstVisitsMap.set(facId, r);
            }
        });

        const firstVisitReports = Array.from(firstVisitsMap.values());

        firstVisitReports.forEach(r => {
            const tools = r.fullData?.essential_tools || r.essential_tools;
            if (tools) {
                total++;
                const hasImm = checkToolAvailability(tools, 'immunization');
                const hasNut = checkToolAvailability(tools, 'nutrition');
                const hasGm = checkToolAvailability(tools, 'growthMonitoring');
                
                if (hasImm) imm++;
                if (hasNut) nut++;
                if (hasGm) gm++;
                
                if (hasImm && hasNut && hasGm) fullyIntegratedCount++;
            }
        });

        return {
            total,
            fullyIntegratedCount,
            immunization: total > 0 ? (imm / total) * 100 : 0,
            nutrition: total > 0 ? (nut / total) * 100 : 0,
            growthMonitoring: total > 0 ? (gm / total) * 100 : 0
        };
    }, [scopedReports]);

    const lineLabels = useMemo(() => {
        const labels = [];
        [1, 2, 3, 4].forEach(v => {
            if (toolAggByVisit[v]['chartbook']?.denominator > 0) labels.push(`${t('Visit')} ${v}`);
        });
        return labels;
    }, [toolAggByVisit, t]);

    const getToolPct = (vNum, toolKey) => {
        const d = toolAggByVisit[vNum]?.[toolKey];
        return d && d.denominator > 0 ? ((d.numerator / d.denominator) * 100).toFixed(1) : null;
    };

    const getOverallPct = (toolKey) => {
        const d = toolAggOverall[toolKey];
        return d && d.denominator > 0 ? (d.numerator / d.denominator) : 0;
    };

    return (
        <div className="animate-fade-in" dir={isAr ? 'rtl' : 'ltr'}>
            
            {/* Top Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title={t("Monitored Facilities Under Supervision")} value={uniqueVisitedFacilitiesCount} />
                <KpiCard title={t("IMNCI Case Recording Forms Register")} scoreValue={getOverallPct('recordForm')} />
                <KpiCard title={t("Clinical Chartbooklet Availability")} scoreValue={getOverallPct('chartbook')} />
                <KpiCard 
                    title={t("Facilities with All 4 Services Integrated")} 
                    value={integratedStats.fullyIntegratedCount} 
                    unit={`(${integratedStats.total > 0 ? Math.round((integratedStats.fullyIntegratedCount / integratedStats.total) * 100) : 0}%)`}
                />
            </div>

            <div className="mb-10">
                <h3 className={`text-xl font-extrabold text-slate-800 mb-5 tracking-wide flex items-center gap-2 ${isAr ? 'text-right' : 'text-left'}`}>
                    <SlidersHorizontal className="w-6 h-6 text-sky-600" />
                    {t('Essential Infrastructure & Tools Availability Progress')}
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {toolsList.map(tool => {
                        const cellData = toolAggOverall[tool.key];
                        const count = cellData?.numerator || 0;
                        const total = cellData?.denominator || 0;
                        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : null;

                        const lineData = [];
                        [1, 2, 3, 4].forEach(vNum => {
                            if (toolAggByVisit[vNum]?.[tool.key]?.denominator > 0) {
                                lineData.push(getToolPct(vNum, tool.key));
                            }
                        });

                        return (
                            <InfoKpiTrendCard 
                                key={tool.key}
                                title={t(tool.label)}
                                avgValue={pct}
                                totalNumerator={Number(count.toFixed(1))}
                                totalDenominator={total}
                                v1Value={getToolPct(1, tool.key)}
                                v1Numerator={Number((toolAggByVisit[1]?.[tool.key]?.numerator || 0).toFixed(1))}
                                v1Denominator={toolAggByVisit[1]?.[tool.key]?.denominator || 0}
                                v4Value={getToolPct(4, tool.key)}
                                v4Numerator={Number((toolAggByVisit[4]?.[tool.key]?.numerator || 0).toFixed(1))}
                                v4Denominator={toolAggByVisit[4]?.[tool.key]?.denominator || 0}
                                lineLabels={lineLabels}
                                lineData={lineData}
                                color={tool.color}
                                isAr={isAr}
                                t={t}
                            />
                        );
                    })}
                    
                    {/* Integrated Services Bar Chart rendered directly alongside the others */}
                    <IntegratedServicesBarKpi stats={integratedStats} t={t} />
                </div>
            </div>

        </div>
    );
};

export default FacilityInformationDashboardTab;