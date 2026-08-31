import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { KpiCard, CopyImageButton, ScoreText } from './MentorshipDashboardShared';
import { Line, Bar } from 'react-chartjs-2';
import { SlidersHorizontal, Activity, AlertTriangle } from 'lucide-react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, BarElement, Title, Tooltip, Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler
);

/* ------------------------------------------------------------------
 * Key aliases.
 * Facility documents were written by several generations of the form,
 * so the same concept lives under different names (English snake_case,
 * Arabic, legacy). Every alias for a concept is tried in order.
 * ------------------------------------------------------------------ */
const KEY_ALIASES = {
    // --- EENC ---
    delivery_register: ['delivery_register', 'deliveryRegister', 'سجل_ولادات', 'وجود_سجل_ولادات', 'سجل_الولادات', 'eenc_register'],
    resuscitation_area: ['resuscitation_area', 'resuscitationArea', 'resuscitation_table', 'طاولة_إنعاش', 'ركن_إنعاش', 'وجود_ركن_إنعاش', 'منطقة_الإنعاش'],
    infant_warmer: ['infant_warmer', 'infantWarmer', 'warmer', 'جهاز_تدفئة', 'مدفأة', 'دفاية_أطفال'],
    suction_machine: ['suction_machine', 'suctionMachine', 'suction', 'شفاط', 'جهاز_شفط'],
    oxygen_supply: ['oxygen_supply', 'oxygenSupply', 'oxygen', 'أكسجين', 'مصدر_أكسجين'],
    handwashing_sink: ['handwashing_sink', 'handwashingSink', 'handwashing', 'مغسلة', 'حوض_غسل_الأيدي'],
    kmc_space: ['kmc_space', 'kmcSpace', 'kmc', 'رعاية_الكنغر', 'ركن_الكنغر'],
    anc_services: ['anc_services', 'ancServices', 'anc', 'رعاية_ما_قبل_الولادة'],
    pnc_services: ['pnc_services', 'pncServices', 'pnc', 'رعاية_ما_بعد_الولادة'],
    infection_control: ['infection_control', 'infectionControl', 'مكافحة_العدوى'],

    // --- IMNCI ---
    chartbook: ['chartbook', 'وجود_كتيب_لوحات', 'كتيب_لوحات'],
    recordForm: ['recordForm', 'record_form', 'وجود_سجل_علاج_متكامل', 'سجل_علاج_متكامل'],
    weightScale: ['weightScale', 'weight_scale', 'ميزان_وزن'],
    heightScale: ['heightScale', 'height_scale', 'ميزان_طول'],
    thermometer: ['thermometer', 'ميزان_حرارة'],
    timer: ['timer', 'ساعة_مؤقت'],
    orsCorner: ['orsCorner', 'ors_corner', 'غرفة_إرواء', 'ركن_الإرواء'],
    immunization: ['immunization', 'immunization_office_exists', 'مكتب_التطعيم'],
    nutrition: ['nutrition', 'nutrition_center_exists', 'مركز_التغذية'],
    growthMonitoring: ['growthMonitoring', 'growth_monitoring_service_exists', 'متابعة_النمو']
};

const TRUTHY = new Set(['yes', 'true', '1', 'نعم', 'متوفر', 'موجود', 'available', 'y']);

// Reads a concept out of an object by trying every known alias.
// Returns undefined when the object carries no information at all about it.
const readToolValue = (obj, key) => {
    if (!obj) return undefined;
    const aliases = KEY_ALIASES[key] || [key];
    for (const alias of aliases) {
        const v = obj[alias];
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
};

const isAvailable = (value) => {
    if (value === true || value === 1) return true;
    if (typeof value !== 'string') return false;
    return TRUTHY.has(value.trim().toLowerCase());
};

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

    const hasData = totalDenominator > 0 && lineLabels.length > 0;

    return (
        <div ref={cardRef} className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={title} /></div>
            <h4 className="text-sm sm:text-base font-extrabold text-slate-800 mb-4 sm:mb-6 text-center tracking-wide pr-8 break-words">{title}</h4>

            <div className="flex justify-between items-center gap-2 sm:gap-4 mb-6">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t('Visit 1')}</span>
                    <div className="border border-slate-300 bg-white rounded-lg px-3 sm:px-4 py-1.5 font-bold text-slate-700 shadow-sm text-sm flex flex-col items-center">
                        {v1Denominator > 0 && v1Value !== null && v1Value !== undefined ? `${Math.round(v1Value)}%` : '-'}
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5 whitespace-nowrap">
                            {v1Denominator > 0 ? `${v1Numerator} / ${v1Denominator}` : '- / -'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t('Average')}</span>
                    <div className="border border-slate-800 bg-white rounded-xl px-4 sm:px-10 py-2 sm:py-3 shadow-sm flex flex-col items-center justify-center">
                        <span className={`font-extrabold text-xl sm:text-2xl ${avgValue >= 80 ? 'text-emerald-700' : avgValue >= 50 ? 'text-amber-600' : 'text-rose-700'}`}>
                            {totalDenominator > 0 && avgValue !== null && avgValue !== undefined && !isNaN(avgValue) ? `${Math.round(avgValue)}%` : '-'}
                        </span>
                        {totalDenominator > 0 && (
                            <span className="text-xs font-bold text-slate-500 mt-0.5 whitespace-nowrap">
                                {totalNumerator} / {totalDenominator}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t('Visit 4')}</span>
                    <div className="border border-slate-300 bg-white rounded-lg px-3 sm:px-4 py-1.5 font-bold text-slate-700 shadow-sm text-sm flex flex-col items-center">
                        {v4Denominator > 0 && v4Value !== null && v4Value !== undefined ? `${Math.round(v4Value)}%` : '-'}
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5 whitespace-nowrap">
                            {v4Denominator > 0 ? `${v4Numerator} / ${v4Denominator}` : '- / -'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="relative flex-grow min-h-[220px]" dir="ltr">
                {hasData ? (
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
        labels: stats.labels,
        datasets: [{
            data: [stats.stat1, stats.stat2, stats.stat3],
            backgroundColor: ['#f97316', '#6366f1', '#84cc16'],
            borderRadius: 6,
            barPercentage: 0.5
        }]
    };

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
        layout: { padding: { top: 15 } }
    };

    return (
        <div ref={cardRef} className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-black hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative justify-center">
            <div className="absolute top-4 right-4 z-10"><CopyImageButton targetRef={cardRef} title={t('Integrated Child/Maternal Health Services')} /></div>
            <div className="flex items-center justify-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-sky-600" />
                <h4 className="text-sm sm:text-base font-extrabold text-slate-800 text-center tracking-wide pr-8 break-words">
                    {t('Integrated Core Health Services')}
                </h4>
            </div>
            <p className="text-center text-xs text-slate-500 font-semibold mb-6 px-2">
                {t('Percentage of supervised facilities integrating additional core services (Based on Baseline / First Visit).')}
            </p>
            <div className="relative flex-grow min-h-[220px]" dir="ltr">
                {stats.total > 0 ? (
                    <Bar data={data} options={options} plugins={[verticalBarLabelPlugin]} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 font-semibold text-xs text-center p-4">
                        {t('No data available.')}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Dashboard Tab Component ---
const FacilityInformationDashboardTab = ({
    facilities,
    visitReports,
    activeService,
    activeState,
    activeLocality,
    STATE_LOCALITIES
}) => {
    const { t, i18n } = useTranslation();
    const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';
    const isAr = language === 'ar';
    const isIMNCI = activeService === 'IMNCI';

    const toolsList = useMemo(() => {
        if (isIMNCI) {
            return [
                { key: 'chartbook', label: 'Clinical Chartbooklet', color: '#0ea5e9' },
                { key: 'recordForm', label: 'Recording Form registers', color: '#8b5cf6' },
                { key: 'weightScale', label: 'Infant Weight Scale', color: '#10b981' },
                { key: 'heightScale', label: 'Length/Height Board', color: '#f59e0b' },
                { key: 'thermometer', label: 'Clinical Thermometer', color: '#ec4899' },
                { key: 'timer', label: 'Respiratory Rate Timer', color: '#3b82f6' },
                { key: 'orsCorner', label: 'ORS Hydration Corner', color: '#14b8a6' }
            ];
        }
        return [
            { key: 'delivery_register', label: 'Delivery/EENC Registers', color: '#8b5cf6' },
            { key: 'resuscitation_area', label: 'Functional Resuscitation Area', color: '#0ea5e9' },
            { key: 'infant_warmer', label: 'Infant Warmer / Heater', color: '#10b981' },
            { key: 'suction_machine', label: 'Functional Suction Machine', color: '#f59e0b' },
            { key: 'oxygen_supply', label: 'Oxygen Supply', color: '#ec4899' },
            { key: 'handwashing_sink', label: 'Handwashing Sink (Water/Soap)', color: '#3b82f6' },
            { key: 'kmc_space', label: 'KMC Space/Unit', color: '#14b8a6' }
        ];
    }, [isIMNCI]);

    const integratedKeys = useMemo(() => {
        if (isIMNCI) {
            return [
                { key: 'immunization', label: 'Immunization' },
                { key: 'nutrition', label: 'Nutrition' },
                { key: 'growthMonitoring', label: 'Growth Monitoring' }
            ];
        }
        return [
            { key: 'anc_services', label: 'Antenatal Care (ANC)' },
            { key: 'pnc_services', label: 'Postnatal Care (PNC)' },
            { key: 'infection_control', label: 'Infection Control' }
        ];
    }, [isIMNCI]);

    // Facility lookup so reports written before essential_tools existed can
    // still resolve against the current facility record.
    const facilityMap = useMemo(() => {
        const map = new Map();
        (facilities || []).forEach(f => {
            if (f?.id) map.set(f.id, f);
        });
        return map;
    }, [facilities]);

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

    const allKeys = useMemo(
        () => [...toolsList.map(x => x.key), ...integratedKeys.map(x => x.key)],
        [toolsList, integratedKeys]
    );

    // Returns the object that actually holds tool answers for a report, or null.
    // Order: migrated essential_tools -> the report itself -> the facility record.
    // Returning null (instead of blindly falling back to the report) is what
    // keeps un-migrated reports out of the denominator.
    const resolveToolSource = useMemo(() => {
        const hasAnyKey = (obj) => obj && allKeys.some(k => readToolValue(obj, k) !== undefined);

        return (report) => {
            const et = report.fullData?.essential_tools || report.essential_tools;
            if (hasAnyKey(et)) return et;

            if (hasAnyKey(report.fullData)) return report.fullData;
            if (hasAnyKey(report)) return report;

            const facId = report.facilityId || report.fullData?.facilityId;
            const fac = facId ? facilityMap.get(facId) : null;
            if (hasAnyKey(fac)) return fac;

            return null;
        };
    }, [allKeys, facilityMap]);

    const { toolAggOverall, toolAggByVisit, coverage } = useMemo(() => {
        const aggOverall = {};
        const aggByVisit = { 1: {}, 2: {}, 3: {}, 4: {} };

        toolsList.forEach(tool => {
            aggOverall[tool.key] = { numerator: 0, denominator: 0 };
            [1, 2, 3, 4].forEach(v => {
                aggByVisit[v][tool.key] = { numerator: 0, denominator: 0 };
            });
        });

        let withData = 0;
        let withoutData = 0;

        scopedReports.forEach(r => {
            const vNum = parseInt(r.visitNumber || r.fullData?.visitNumber) || 1;
            const source = resolveToolSource(r);

            if (!source) { withoutData++; return; }
            withData++;

            if (!aggByVisit[vNum]) return;

            toolsList.forEach(tool => {
                const raw = readToolValue(source, tool.key);
                if (raw === undefined) return; // this facility never answered this item

                const available = isAvailable(raw);
                aggOverall[tool.key].numerator += available ? 1 : 0;
                aggOverall[tool.key].denominator += 1;

                aggByVisit[vNum][tool.key].numerator += available ? 1 : 0;
                aggByVisit[vNum][tool.key].denominator += 1;
            });
        });

        if (process.env.NODE_ENV !== 'production' && withoutData > 0) {
            const sample = scopedReports.find(r => !resolveToolSource(r));
            console.warn(
                `[FacilityInfo] ${withoutData}/${scopedReports.length} ${activeService} reports carry no tool data. ` +
                `Run the facility data migration, or add the real field names to KEY_ALIASES.`,
                { sampleReportKeys: sample ? Object.keys(sample.fullData || sample) : [] }
            );
        }

        return {
            toolAggOverall: aggOverall,
            toolAggByVisit: aggByVisit,
            coverage: { withData, withoutData, total: scopedReports.length }
        };
    }, [scopedReports, toolsList, resolveToolSource, activeService]);

    // Integrated services — baseline / first visit per facility only.
    const integratedStats = useMemo(() => {
        let total = 0;
        let count1 = 0;
        let count2 = 0;
        let count3 = 0;
        let fullyIntegratedCount = 0;

        const firstVisitsMap = new Map();

        const sortedReportsAsc = [...scopedReports].sort((a, b) =>
            new Date(a.visitDate || a.fullData?.visitDate || 0).getTime() - new Date(b.visitDate || b.fullData?.visitDate || 0).getTime()
        );

        sortedReportsAsc.forEach(r => {
            const facId = r.facilityId || r.fullData?.facilityId;
            if (facId && !firstVisitsMap.has(facId)) {
                firstVisitsMap.set(facId, r);
            }
        });

        Array.from(firstVisitsMap.values()).forEach(r => {
            const source = resolveToolSource(r);
            if (!source) return;

            total++;
            const has1 = isAvailable(readToolValue(source, integratedKeys[0].key));
            const has2 = isAvailable(readToolValue(source, integratedKeys[1].key));
            const has3 = isAvailable(readToolValue(source, integratedKeys[2].key));

            if (has1) count1++;
            if (has2) count2++;
            if (has3) count3++;
            if (has1 && has2 && has3) fullyIntegratedCount++;
        });

        return {
            total,
            fullyIntegratedCount,
            stat1: total > 0 ? (count1 / total) * 100 : 0,
            stat2: total > 0 ? (count2 / total) * 100 : 0,
            stat3: total > 0 ? (count3 / total) * 100 : 0,
            labels: [t(integratedKeys[0].label), t(integratedKeys[1].label), t(integratedKeys[2].label)]
        };
    }, [scopedReports, integratedKeys, resolveToolSource, t]);

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

            {coverage.withoutData > 0 && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-amber-900">
                        {t('{{count}} of {{total}} visit reports have no facility tool data recorded and are excluded from these figures. Run the facility data migration to include them.', {
                            count: coverage.withoutData,
                            total: coverage.total
                        })}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title={t("Monitored Facilities Under Supervision")} value={uniqueVisitedFacilitiesCount} />
                <KpiCard
                    title={isIMNCI ? t("IMNCI Case Recording Forms Register") : t("Delivery/EENC Registers Availability")}
                    scoreValue={getOverallPct(isIMNCI ? 'recordForm' : 'delivery_register')}
                />
                <KpiCard
                    title={isIMNCI ? t("Clinical Chartbooklet Availability") : t("Functional Resuscitation Area Availability")}
                    scoreValue={getOverallPct(isIMNCI ? 'chartbook' : 'resuscitation_area')}
                />
                <KpiCard
                    title={t("Facilities with Core Services Integrated")}
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

                        // Labels and points are built together so they can never
                        // drift out of alignment.
                        const labels = [];
                        const lineData = [];
                        [1, 2, 3, 4].forEach(vNum => {
                            if (toolAggByVisit[vNum]?.[tool.key]?.denominator > 0) {
                                labels.push(`${t('Visit')} ${vNum}`);
                                lineData.push(getToolPct(vNum, tool.key));
                            }
                        });

                        return (
                            <InfoKpiTrendCard
                                key={tool.key}
                                title={t(tool.label)}
                                avgValue={pct}
                                totalNumerator={count}
                                totalDenominator={total}
                                v1Value={getToolPct(1, tool.key)}
                                v1Numerator={toolAggByVisit[1]?.[tool.key]?.numerator || 0}
                                v1Denominator={toolAggByVisit[1]?.[tool.key]?.denominator || 0}
                                v4Value={getToolPct(4, tool.key)}
                                v4Numerator={toolAggByVisit[4]?.[tool.key]?.numerator || 0}
                                v4Denominator={toolAggByVisit[4]?.[tool.key]?.denominator || 0}
                                lineLabels={labels}
                                lineData={lineData}
                                color={tool.color}
                                isAr={isAr}
                                t={t}
                            />
                        );
                    })}

                    <IntegratedServicesBarKpi stats={integratedStats} t={t} />
                </div>
            </div>

        </div>
    );
};

export default FacilityInformationDashboardTab;
