// src/components/ChildHealthIndicatorsView.jsx
//
// Two dashboard tabs built on published figures rather than the app's records:
//   ChildMortalityDashboard  UN IGME interagency estimates for Sudan (trend + KPIs)
//   SudanMicsDashboard       Sudan MICS 2014 indicators by state
//   SudanS3mDashboard        Sudan S3M II 2018 indicators by state and locality
// The figures themselves are in childHealthIndicatorsData.js and s3mData.js.

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Line, Bar } from 'react-chartjs-2';
import { Baby, HeartPulse, Users, Info, Activity, Syringe } from 'lucide-react';

import './chartSetup';
import { CHART_COLORS, fadeColor } from './chartSetup';
import { Card, CardBody, Select } from './CommonComponents';
import { STATE_LOCALITIES } from './constants';
import { STATUS_COLORS } from '../utils/statusColors';
import {
    IGME_SOURCE, IGME_SERIES, STILLBIRTH_SERIES, MATERNAL_SERIES, SDG_TARGETS,
    STILLBIRTH_TARGET, ADOLESCENT_SERIES,
    MICS_SOURCE, MICS_INDICATORS, MICS_NATIONAL, MICS_STATES,
} from './childHealthIndicatorsData';
import { S3M_SOURCE, S3M_INDICATORS, S3M_NATIONAL, S3M_NATIONAL_CI, S3M_STATES } from './s3mData';

// One decimal throughout, as the sources publish them; digits = 0 for whole numbers.
const fmt = (value, digits = 1) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));

const MORTALITY = [
    { id: 'nmr', color: CHART_COLORS[0], icon: Baby },
    { id: 'imr', color: CHART_COLORS[2], icon: HeartPulse },
    { id: 'u5mr', color: CHART_COLORS[4], icon: Users },
];

// The trend chart adds stillbirths to the three IGME rates. Stillbirths come
// from the earlier round in the RMNCH sheet and have no published bounds.
const TREND = [{ id: 'sb', color: CHART_COLORS[3] }, ...MORTALITY];
const TREND_ROWS = { ...IGME_SERIES, sb: STILLBIRTH_SERIES.map(([year, value]) => [year, value, null, null]) };
const TREND_TARGETS = { ...SDG_TARGETS, sb: STILLBIRTH_TARGET };

const ADOLESCENT = [
    { id: 'early', column: 1, color: CHART_COLORS[5] },
    { id: 'late', column: 2, color: CHART_COLORS[7] },
];

function SourceNote({ children }) {
    return (
        <div className="flex items-start gap-2 text-xs text-slate-500">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>{children}</span>
        </div>
    );
}

function SectionTitle({ children }) {
    return <h2 className="text-base font-bold text-slate-800">{children}</h2>;
}

// Small choice chips; used for the period and the indicator on the trend chart.
function Chips({ options, value, onChange }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    onClick={() => onChange(option.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${value === option.id ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50'}`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Child mortality (UN IGME)
// ---------------------------------------------------------------------------

function MortalityKpi({ indicator, label }) {
    const { t } = useTranslation();
    const series = IGME_SERIES[indicator.id];
    const [year, value, lower, upper] = series[series.length - 1];
    const base = series.find((row) => row[0] === 1990);
    const decline = base ? Math.round((1 - value / base[1]) * 100) : null;
    const target = SDG_TARGETS[indicator.id];
    const Icon = indicator.icon;

    return (
        <Card>
            <CardBody className="py-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: fadeColor(indicator.color, 0.12), color: indicator.color }}>
                        <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-bold text-slate-800 leading-tight">{fmt(value)}</span>
                            <span className="text-xs text-gray-500">{t('child_indicators.per_1000', 'per 1,000 live births')}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                            {t('child_indicators.range', '{{year}} estimate · 90% range {{lower}}–{{upper}}', { year, lower: fmt(lower), upper: fmt(upper) })}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                            {decline !== null && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                    {decline >= 0
                                        ? t('child_indicators.down_since', '{{pct}}% lower than 1990', { pct: decline })
                                        : t('child_indicators.up_since', '{{pct}}% higher than 1990', { pct: -decline })}
                                </span>
                            )}
                            {target && (
                                <span className={`px-2 py-0.5 rounded-full ${value <= target ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                    {t('child_indicators.sdg_target', 'SDG 2030 target: {{target}} or less', { target })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}

function SmallKpi({ label, value, unit, sub, digits = 1 }) {
    return (
        <Card>
            <CardBody className="py-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-slate-800">{fmt(value, digits)}</span>
                    <span className="text-xs text-gray-500">{unit}</span>
                </div>
                {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
            </CardBody>
        </Card>
    );
}

export function ChildMortalityDashboard() {
    const { t } = useTranslation();
    const [period, setPeriod] = useState('1990');
    const [focus, setFocus] = useState('all');

    const labels = {
        nmr: t('child_indicators.nmr', 'Neonatal mortality rate'),
        imr: t('child_indicators.imr', 'Infant mortality rate'),
        u5mr: t('child_indicators.u5mr', 'Under-five mortality rate'),
        sb: t('child_indicators.stillbirth', 'Stillbirth rate'),
        early: t('child_indicators.early_adolescent', 'Early adolescent (10–14)'),
        late: t('child_indicators.late_adolescent', 'Late adolescent (15–19)'),
    };

    const chart = useMemo(() => {
        const from = period === '1990' ? 1990 : 0;
        // The series start in different years (U5MR 1953, IMR 1955, NMR 1969),
        // so the axis is the union of years and a missing year stays empty.
        const years = [...new Set(TREND.flatMap((m) => TREND_ROWS[m.id].map((row) => row[0])))]
            .filter((y) => y >= from)
            .sort((a, b) => a - b);
        const pick = (id, column) => {
            const byYear = new Map(TREND_ROWS[id].map((row) => [row[0], row[column]]));
            return years.map((y) => byYear.get(y) ?? null);
        };
        const shown = focus === 'all' ? TREND : TREND.filter((m) => m.id === focus);
        const datasets = [];
        shown.forEach((m) => {
            datasets.push({
                label: labels[m.id],
                data: pick(m.id, 1),
                borderColor: m.color,
                backgroundColor: m.color,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.2,
                spanGaps: false,
            });
        });
        if (focus !== 'all' && focus !== 'sb') {
            const m = shown[0];
            // Upper bound fills down to the lower bound: the 90% uncertainty band.
            datasets.push({
                label: t('child_indicators.upper', 'Upper bound (90%)'),
                data: pick(m.id, 3),
                borderColor: 'transparent',
                backgroundColor: fadeColor(m.color, 0.15),
                pointRadius: 0,
                fill: '+1',
                tension: 0.2,
            });
            datasets.push({
                label: t('child_indicators.lower', 'Lower bound (90%)'),
                data: pick(m.id, 2),
                borderColor: 'transparent',
                pointRadius: 0,
                fill: false,
                tension: 0.2,
            });
        }
        if (focus !== 'all') {
            const m = shown[0];
            if (TREND_TARGETS[m.id]) {
                datasets.push({
                    label: m.id === 'sb' ? t('child_indicators.enap_line', 'ENAP 2030 target') : t('child_indicators.sdg_line', 'SDG 2030 target'),
                    data: years.map(() => TREND_TARGETS[m.id]),
                    borderColor: STATUS_COLORS.good,
                    borderDash: [6, 4],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                });
            }
        }
        return { labels: years, datasets };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, focus, t]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'bottom', labels: { filter: (item) => !/90%/.test(item.text) } },
            tooltip: { callbacks: { label: (ctx) => (ctx.parsed.y === null ? null : `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`) } },
        },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 12, autoSkip: true, maxRotation: 0 } },
            y: { beginAtZero: true, title: { display: true, text: t('child_indicators.axis_rate', 'Deaths per 1,000 live births') } },
        },
    };

    const adolescentChart = {
        labels: ADOLESCENT_SERIES.map((row) => row[0]),
        datasets: ADOLESCENT.map((a) => ({
            label: labels[a.id],
            data: ADOLESCENT_SERIES.map((row) => row[a.column]),
            borderColor: a.color,
            backgroundColor: a.color,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.2,
        })),
    };
    const adolescentOptions = {
        ...options,
        scales: {
            ...options.scales,
            y: { beginAtZero: true, title: { display: true, text: t('child_indicators.axis_adolescent', 'Deaths per 1,000 adolescents') } },
        },
    };
    const lastAdolescent = ADOLESCENT_SERIES[ADOLESCENT_SERIES.length - 1];

    const keyYears = [1990, 2000, 2010, 2015, 2020, 2022, 2023, 2024];
    const valueAt = (id, y) => IGME_SERIES[id].find((row) => row[0] === y)?.[1];
    const lastStillbirth = STILLBIRTH_SERIES[STILLBIRTH_SERIES.length - 1];
    const lastMaternal = MATERNAL_SERIES[MATERNAL_SERIES.length - 1];

    return (
        <div className="space-y-4 px-3 md:px-0">
            <SourceNote>
                {t('child_indicators.igme_source', 'Interagency estimates for Sudan from the UN Inter-agency Group for Child Mortality Estimation (UN IGME), {{round}} round. Figures are modelled estimates, not facility reports.', { round: IGME_SOURCE.round })}
            </SourceNote>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {MORTALITY.map((m) => <MortalityKpi key={m.id} indicator={m} label={labels[m.id]} />)}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SmallKpi
                    label={t('child_indicators.stillbirth', 'Stillbirth rate')}
                    value={lastStillbirth[1]}
                    unit={t('child_indicators.per_1000_births', 'per 1,000 total births')}
                    sub={t('child_indicators.estimate_year', '{{year}} estimate', { year: lastStillbirth[0] })}
                />
                <SmallKpi
                    label={t('child_indicators.mmr', 'Maternal mortality ratio')}
                    value={lastMaternal[1]}
                    digits={0}
                    unit={t('child_indicators.per_100k', 'per 100,000 live births')}
                    sub={t('child_indicators.estimate_year', '{{year}} estimate', { year: lastMaternal[0] })}
                />
                {ADOLESCENT.map((a) => (
                    <SmallKpi
                        key={a.id}
                        label={labels[a.id]}
                        value={lastAdolescent[a.column]}
                        unit={t('child_indicators.per_1000_adolescents', 'per 1,000')}
                        sub={t('child_indicators.estimate_year', '{{year}} estimate', { year: lastAdolescent[0] })}
                    />
                ))}
            </div>

            <Card>
                <CardBody className="space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <SectionTitle>{t('child_indicators.trend_title', 'Under-five mortality: stillbirth, neonatal, infant and under-five')}</SectionTitle>
                        <Chips
                            value={period}
                            onChange={setPeriod}
                            options={[
                                { id: '1990', label: t('child_indicators.since_1990', 'Since 1990') },
                                { id: 'all', label: t('child_indicators.all_years', 'All years') },
                            ]}
                        />
                    </div>
                    <Chips
                        value={focus}
                        onChange={setFocus}
                        options={[
                            { id: 'all', label: t('child_indicators.all_four', 'All four') },
                            ...TREND.map((m) => ({ id: m.id, label: labels[m.id] })),
                        ]}
                    />
                    <div className="h-72 md:h-96">
                        <Line data={chart} options={options} />
                    </div>
                    <SourceNote>
                        {focus === 'all'
                            ? t('child_indicators.pick_one', 'Pick one rate to see its 90% uncertainty band and the 2030 target.')
                            : focus === 'sb'
                                ? t('child_indicators.sb_note', 'Stillbirths are per 1,000 total births, 2000–2023, from the earlier estimates round; no uncertainty range is published with them.')
                                : t('child_indicators.band_note', 'The shaded band is the 90% uncertainty range of the estimate.')}
                        {' '}
                        {t('child_indicators.spikes', 'The sharp peaks (1983–85, 1988, 1998, 2004–05 and 2023) are crisis deaths included in the published estimates.')}
                    </SourceNote>
                </CardBody>
            </Card>

            <Card>
                <CardBody className="space-y-3">
                    <SectionTitle>{t('child_indicators.adolescent_title', 'Adolescent mortality: early and late adolescence')}</SectionTitle>
                    <div className="h-64 md:h-80">
                        <Line data={adolescentChart} options={adolescentOptions} />
                    </div>
                    <SourceNote>
                        {t('child_indicators.adolescent_note', 'UN IGME, 1990–2023. Probability of dying between ages 10–14 (early) and 15–19 (late), per 1,000 adolescents alive at the start of each age group. The 2003–05 and 2008 peaks are as published.')}
                    </SourceNote>
                </CardBody>
            </Card>

            <Card>
                <CardBody className="space-y-3">
                    <SectionTitle>{t('child_indicators.key_years', 'Key years')}</SectionTitle>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-200">
                                    <th className="sticky-col bg-white text-start font-semibold py-2 pe-3">{t('child_indicators.indicator', 'Indicator')}</th>
                                    {keyYears.map((y) => <th key={y} className="text-end font-semibold py-2 px-2">{y}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {MORTALITY.map((m) => (
                                    <tr key={m.id} className="border-b border-slate-100">
                                        <td className="sticky-col bg-white py-2 pe-3 font-medium text-slate-700 whitespace-nowrap">{labels[m.id]}</td>
                                        {keyYears.map((y) => <td key={y} className="text-end py-2 px-2 tabular-nums">{fmt(valueAt(m.id, y))}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sudan MICS
// ---------------------------------------------------------------------------

function useMicsLabels() {
    const { t } = useTranslation();
    return {
        diarrhoea: t('child_indicators.mics.diarrhoea', 'Diarrhoea prevalence'),
        diarrhoea_care: t('child_indicators.mics.diarrhoea_care', 'Care-seeking for diarrhoea'),
        diarrhoea_home: t('child_indicators.mics.diarrhoea_home', 'Home treatment for diarrhoea (ORT + continued feeding)'),
        pneumonia: t('child_indicators.mics.pneumonia', 'Pneumonia (ARI symptoms) prevalence'),
        pneumonia_care: t('child_indicators.mics.pneumonia_care', 'Care-seeking for pneumonia'),
        pneumonia_antibiotic: t('child_indicators.mics.pneumonia_antibiotic', 'Antibiotics for pneumonia'),
        nmr: t('child_indicators.nmr', 'Neonatal mortality rate'),
        imr: t('child_indicators.imr', 'Infant mortality rate'),
        u5mr: t('child_indicators.u5mr', 'Under-five mortality rate'),
    };
}

// Better or worse than the national figure, in the indicator's good direction.
function compare(indicator, value, national) {
    if (value === null || value === undefined || value === national) return 'same';
    const better = indicator.better === 'lower' ? value < national : value > national;
    return better ? 'better' : 'worse';
}

// One survey screen, used by both MICS and S3M: national figures grouped into
// cards, one indicator ranked by state (or by locality inside a state when the
// survey has locality results), and a table of every indicator.
//   indicators  [{ id, group, better, unit? }]   unit '%' (default) or 'rate'
//   national    values in indicators order; nationalCi optional [lower, upper] per value
//   states      { stateKey: { values, localities?: [[name, values]] } }
function SurveyDashboard({ id, source, indicators, labels, groups, national, nationalCi, states, defaultIndicator, tableNote, defaultTableGroup = 'all' }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [selected, setSelected] = useState(defaultIndicator);
    const [area, setArea] = useState('');
    const [tableGroup, setTableGroup] = useState(defaultTableGroup);

    const stateName = (key) => (isArabic ? STATE_LOCALITIES[key]?.ar : STATE_LOCALITIES[key]?.en) || key;
    const unitLabel = (indicator) => (indicator.unit === 'rate' ? t('child_indicators.per_1000_short', 'per 1,000') : '%');
    const hasLocalities = Object.values(states).some((s) => s.localities?.length);

    const index = indicators.findIndex((ind) => ind.id === selected);
    const indicator = indicators[index];
    // Inside a state, localities are compared with that state's own figure.
    const reference = area ? states[area].values[index] : national[index];
    const referenceLabel = area ? stateName(area) : t('child_indicators.mics.sudan', 'Sudan (national)');

    const rowsForArea = useMemo(() => (area
        ? states[area].localities.map(([name, values]) => ({ key: name, label: name, values }))
        : Object.entries(states).map(([key, s]) => ({ key, label: stateName(key), values: s.values }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [area, states, isArabic]);

    const bars = useMemo(() => {
        const rows = rowsForArea
            .filter((row) => row.values[index] !== null)
            .map((row) => ({ key: row.key, label: row.label, value: row.values[index] }));
        if (reference !== null) rows.push({ key: '__reference', label: referenceLabel, value: reference });
        // Best first, so the places needing attention collect at the bottom.
        rows.sort((a, b) => (indicator.better === 'lower' ? a.value - b.value : b.value - a.value));
        return rows;
    }, [rowsForArea, index, indicator, reference, referenceLabel]);

    const missing = rowsForArea.filter((row) => row.values[index] === null).map((row) => row.label);

    const barData = {
        labels: bars.map((row) => row.label),
        datasets: [{
            label: labels[selected],
            data: bars.map((row) => row.value),
            backgroundColor: bars.map((row) => {
                if (row.key === '__reference') return '#334155';
                const c = compare(indicator, row.value, reference);
                return c === 'better' ? STATUS_COLORS.good : c === 'worse' ? STATUS_COLORS.poor : '#94a3b8';
            }),
            borderRadius: 4,
            barThickness: 14,
        }],
    };

    const barOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${fmt(ctx.parsed.x)} ${unitLabel(indicator)}` } },
        },
        scales: {
            x: { beginAtZero: true, max: indicator.unit === 'rate' ? undefined : 100, ticks: { callback: (v) => (indicator.unit === 'rate' ? v : `${v}%`) } },
            y: { grid: { display: false }, ticks: { autoSkip: false } },
        },
    };

    const tone = { better: 'text-emerald-700 bg-emerald-50', worse: 'text-red-700 bg-red-50', same: 'text-slate-700' };
    const columns = indicators.map((ind, i) => ({ ind, i })).filter(({ ind }) => tableGroup === 'all' || ind.group === tableGroup);

    return (
        <div className="space-y-4 px-3 md:px-0">
            <SourceNote>{source}</SourceNote>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groups.map((group) => {
                    const Icon = group.icon;
                    return (
                        <Card key={group.id}>
                            <CardBody className="py-4 space-y-3">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                    <Icon size={16} className="text-sky-600" />
                                    {group.label}
                                </div>
                                {indicators.map((ind, i) => (ind.group !== group.id ? null : (
                                    <button
                                        key={ind.id}
                                        type="button"
                                        onClick={() => setSelected(ind.id)}
                                        title={nationalCi?.[i] ? t('child_indicators.ci95', '95% CI {{lower}}–{{upper}}', { lower: fmt(nationalCi[i][0]), upper: fmt(nationalCi[i][1]) }) : undefined}
                                        className={`w-full flex items-baseline justify-between gap-3 text-start rounded-lg px-2 py-1.5 -mx-2 transition-colors ${selected === ind.id ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'}`}
                                    >
                                        <span className="text-xs text-gray-600">{labels[ind.id]}</span>
                                        <span className="shrink-0">
                                            <span className="text-xl font-bold text-slate-800 tabular-nums">{fmt(national[i])}</span>
                                            <span className="text-xs text-gray-500 ms-1">{unitLabel(ind)}</span>
                                        </span>
                                    </button>
                                )))}
                            </CardBody>
                        </Card>
                    );
                })}
            </div>

            <Card>
                <CardBody className="space-y-3">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                        <SectionTitle>{area ? t('child_indicators.s3m.by_locality', 'By locality: {{state}}', { state: stateName(area) }) : t('child_indicators.mics.by_state', 'By state')}</SectionTitle>
                        <div className="flex flex-col sm:flex-row gap-3 md:w-auto">
                            {hasLocalities && (
                                <div className="sm:w-48">
                                    <Select name={`${id}-area`} label={t('dashboard.filters.state', 'State')} value={area} onChange={(e) => setArea(e.target.value)}>
                                        <option value="">{t('dashboard.filters.all_states', 'All States')}</option>
                                        {Object.keys(states).map((key) => <option key={key} value={key}>{stateName(key)}</option>)}
                                    </Select>
                                </div>
                            )}
                            <div className="sm:w-80">
                                <Select name={`${id}-indicator`} label={t('child_indicators.indicator', 'Indicator')} value={selected} onChange={(e) => setSelected(e.target.value)}>
                                    {groups.map((group) => (
                                        <optgroup key={group.id} label={group.label}>
                                            {indicators.filter((ind) => ind.group === group.id).map((ind) => <option key={ind.id} value={ind.id}>{labels[ind.id]}</option>)}
                                        </optgroup>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS.good }} />{t('child_indicators.better_than', 'Better than {{place}}', { place: referenceLabel })}</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS.poor }} />{t('child_indicators.worse_than', 'Worse than {{place}}', { place: referenceLabel })}</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-700" />{referenceLabel}</span>
                    </div>
                    <div style={{ height: `${bars.length * 24 + 40}px` }}>
                        <Bar data={barData} options={barOptions} />
                    </div>
                    {missing.length > 0 && (
                        <SourceNote>{t('child_indicators.mics.not_reported', 'Not reported: {{states}}', { states: missing.join(', ') })}</SourceNote>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardBody className="space-y-3">
                    <SectionTitle>{area ? t('child_indicators.s3m.all_by_locality', 'All indicators by locality: {{state}}', { state: stateName(area) }) : t('child_indicators.mics.all_indicators', 'All indicators by state')}</SectionTitle>
                    {groups.length > 1 && (
                        <Chips
                            value={tableGroup}
                            onChange={setTableGroup}
                            options={[{ id: 'all', label: t('child_indicators.all_groups', 'All') }, ...groups.map((g) => ({ id: g.id, label: g.label }))]}
                        />
                    )}
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-200 align-bottom">
                                    <th className="sticky-col bg-white text-start font-semibold py-2 pe-3">{area ? t('dashboard.table.locality', 'Locality') : t('dashboard.table.state', 'State')}</th>
                                    {columns.map(({ ind }) => (
                                        <th key={ind.id} className="text-end font-semibold py-2 px-2 min-w-[96px]">
                                            {labels[ind.id]}
                                            <span className="block font-normal">({unitLabel(ind)})</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-slate-200 bg-slate-50 font-bold">
                                    <td className="sticky-col bg-slate-50 py-2 pe-3 text-slate-800 whitespace-nowrap">{referenceLabel}</td>
                                    {columns.map(({ i }) => <td key={i} className="text-end py-2 px-2 tabular-nums">{fmt(area ? states[area].values[i] : national[i])}</td>)}
                                </tr>
                                {rowsForArea.map((row) => (
                                    <tr key={row.key} className="border-b border-slate-100">
                                        <td className="sticky-col bg-white py-2 pe-3 font-medium text-slate-700 whitespace-nowrap">{row.label}</td>
                                        {columns.map(({ ind, i }) => (
                                            <td key={i} className="text-end py-1 px-1 tabular-nums">
                                                <span className={`inline-block rounded px-1.5 py-0.5 ${tone[compare(ind, row.values[i], area ? states[area].values[i] : national[i])]}`}>{fmt(row.values[i])}</span>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <SourceNote>{tableNote}</SourceNote>
                </CardBody>
            </Card>
        </div>
    );
}

export function SudanMicsDashboard() {
    const { t } = useTranslation();
    const labels = useMicsLabels();
    const states = useMemo(() => Object.fromEntries(Object.entries(MICS_STATES).map(([key, values]) => [key, { values }])), []);
    return (
        <SurveyDashboard
            id="mics"
            source={t('child_indicators.mics.source', '{{name}} {{year}} (Multiple Indicator Cluster Survey). Household survey results; mortality rates refer to the years before the survey.', { name: MICS_SOURCE.name, year: MICS_SOURCE.year })}
            indicators={MICS_INDICATORS}
            labels={labels}
            groups={[
                { id: 'diarrhoea', label: t('child_indicators.mics.group_diarrhoea', 'Diarrhoea'), icon: Activity },
                { id: 'pneumonia', label: t('child_indicators.mics.group_pneumonia', 'Pneumonia'), icon: HeartPulse },
                { id: 'mortality', label: t('child_indicators.mics.group_mortality', 'Child mortality'), icon: Baby },
            ]}
            national={MICS_NATIONAL}
            states={states}
            defaultIndicator="u5mr"
            tableNote={t('child_indicators.mics.table_note', 'Green: better than the national figure. Red: worse. For prevalence and mortality lower is better; for care-seeking and treatment higher is better.')}
        />
    );
}

// ---------------------------------------------------------------------------
// Sudan S3M II (2018)
// ---------------------------------------------------------------------------

function useS3mLabels() {
    const { t } = useTranslation();
    return {
        diarrhoea: t('child_indicators.s3m.diarrhoea', 'Diarrhoea (period prevalence)'),
        ari: t('child_indicators.s3m.ari', 'ARI (period prevalence)'),
        fever: t('child_indicators.s3m.fever', 'Fever (period prevalence)'),
        hf_diarrhoea: t('child_indicators.s3m.hf_diarrhoea', 'Taken to a health facility for diarrhoea'),
        hf_ari: t('child_indicators.s3m.hf_ari', 'Taken to a health facility for ARI'),
        treat_ari: t('child_indicators.s3m.treat_ari', 'Treated for ARI'),
        ors_any: t('child_indicators.s3m.ors_any', 'Diarrhoea treated with ORS'),
        ors_zinc: t('child_indicators.s3m.ors_zinc', 'Diarrhoea treated with ORS and zinc'),
        itn: t('child_indicators.s3m.itn', 'Slept under a bed net (ITN)'),
        stunting: t('child_indicators.s3m.stunting', 'Stunting (HAZ < -2)'),
        wasting: t('child_indicators.s3m.wasting', 'Wasting (WHZ < -2)'),
        sam: t('child_indicators.s3m.sam', 'Severe wasting (WHZ < -3)'),
        underweight: t('child_indicators.s3m.underweight', 'Underweight (WAZ < -2)'),
        muac_gam: t('child_indicators.s3m.muac_gam', 'Acute malnutrition by MUAC (< 125 mm)'),
        child_anaemia: t('child_indicators.s3m.child_anaemia', 'Anaemia in children'),
        ebf: t('child_indicators.s3m.ebf', 'Exclusive breastfeeding'),
        cont_bf: t('child_indicators.s3m.cont_bf', 'Continued breastfeeding'),
        diet_div: t('child_indicators.s3m.diet_div', 'Minimum dietary diversity'),
        meal_freq: t('child_indicators.s3m.meal_freq', 'Minimum meal frequency'),
        bcg: t('child_indicators.s3m.bcg', 'BCG'),
        penta1: t('child_indicators.s3m.penta1', 'Pentavalent 1'),
        penta3: t('child_indicators.s3m.penta3', 'Pentavalent 3'),
        measles1: t('child_indicators.s3m.measles1', 'Measles 1'),
        full_epi: t('child_indicators.s3m.full_epi', 'Fully immunised (under 12 months)'),
        vit_a: t('child_indicators.s3m.vit_a', 'Vitamin A supplementation'),
        anc4: t('child_indicators.s3m.anc4', 'Four or more ANC visits'),
        no_anc: t('child_indicators.s3m.no_anc', 'No ANC visit'),
        pnc: t('child_indicators.s3m.pnc', 'Postnatal care'),
        tt2: t('child_indicators.s3m.tt2', 'Tetanus vaccine (2 doses)'),
        fefol3: t('child_indicators.s3m.fefol3', 'Iron-folic acid for 3+ months in pregnancy'),
        carer_anaemia: t('child_indicators.s3m.carer_anaemia', 'Anaemia in mothers'),
        hf_1h: t('child_indicators.s3m.hf_1h', 'Health facility within 1 hour'),
    };
}

export function SudanS3mDashboard() {
    const { t } = useTranslation();
    const labels = useS3mLabels();
    return (
        <SurveyDashboard
            id="s3m"
            source={t('child_indicators.s3m.source', '{{name}} ({{year}}), Simple Spatial Survey Method, Federal Ministry of Health. Data collected August–December 2018. Results by state and locality; percentages.', { name: S3M_SOURCE.name, year: S3M_SOURCE.year })}
            indicators={S3M_INDICATORS}
            labels={labels}
            groups={[
                { id: 'illness', label: t('child_indicators.s3m.group_illness', 'Childhood illness and care'), icon: Activity },
                { id: 'nutrition', label: t('child_indicators.s3m.group_nutrition', 'Nutrition'), icon: Baby },
                { id: 'iycf', label: t('child_indicators.s3m.group_iycf', 'Infant and young child feeding'), icon: HeartPulse },
                { id: 'epi', label: t('child_indicators.s3m.group_epi', 'Immunisation (under 12 months)'), icon: Syringe },
                { id: 'maternal', label: t('child_indicators.s3m.group_maternal', 'Mothers and access'), icon: Users },
            ]}
            national={S3M_NATIONAL}
            nationalCi={S3M_NATIONAL_CI}
            states={S3M_STATES}
            defaultIndicator="diarrhoea"
            defaultTableGroup="illness"
            tableNote={t('child_indicators.s3m.table_note', 'Green: better than the comparison figure (national, or the state when a state is picked). Red: worse. For prevalence, malnutrition and anaemia lower is better; for care, feeding and immunisation higher is better. Pick a state to see its localities.')}
        />
    );
}

// ---------------------------------------------------------------------------
// The dashboard tab: the three views as sub-tabs
// ---------------------------------------------------------------------------

// The national figures of the sub-tabs that are not open, as text for the data
// assistant: it reads only what is on screen, and a question often compares
// one survey with another. Hidden, so the page looks the same.
function useOtherSubTabs(view) {
    const { t } = useTranslation();
    const micsLabels = useMicsLabels();
    const s3mLabels = useS3mLabels();
    const survey = (name, year, indicators, labels, national) => `${name} ${year}, national (Sudan):\n${indicators
        .map((ind, i) => `- ${labels[ind.id] || ind.id}: ${fmt(national[i])}${ind.unit === 'rate' ? ' per 1,000 live births' : '%'}`)
        .join('\n')}`;
    const latest = (rows) => rows[rows.length - 1];
    const igme = () => {
        const rates = MORTALITY.map(({ id }) => {
            const [year, value, lower, upper] = latest(IGME_SERIES[id]);
            return `- ${t(`child_indicators.${id}`, id)} ${year}: ${fmt(value)} per 1,000 live births (90% range ${fmt(lower)}–${fmt(upper)}; SDG 2030 target ${SDG_TARGETS[id] ?? '—'})`;
        });
        const [sbYear, sb] = latest(STILLBIRTH_SERIES);
        const [mmYear, mm] = latest(MATERNAL_SERIES);
        const [adYear, early, late] = latest(ADOLESCENT_SERIES);
        return [`${IGME_SOURCE.name} ${IGME_SOURCE.round} estimates (Sudan):`, ...rates,
            `- ${t('child_indicators.stillbirth', 'Stillbirth rate')} ${sbYear}: ${fmt(sb)} per 1,000 total births`,
            `- ${t('child_indicators.mmr', 'Maternal mortality ratio')} ${mmYear}: ${fmt(mm, 0)} per 100,000 live births`,
            `- ${t('child_indicators.early_adolescent', 'Early adolescent (10–14)')} ${adYear}: ${fmt(early)}; ${t('child_indicators.late_adolescent', 'Late adolescent (15–19)')}: ${fmt(late)} per 1,000`,
        ].join('\n');
    };
    const parts = {
        igme,
        mics: () => survey(MICS_SOURCE.name, MICS_SOURCE.year, MICS_INDICATORS, micsLabels, MICS_NATIONAL),
        s3m: () => survey(S3M_SOURCE.name, S3M_SOURCE.year, S3M_INDICATORS, s3mLabels, S3M_NATIONAL),
    };
    return Object.entries(parts).filter(([id]) => id !== view).map(([, make]) => make()).join('\n\n')
        + '\n(Figures by state and locality show when that sub-tab is open.)';
}

export default function MorbidityMortalityDashboard() {
    const { t } = useTranslation();
    const [view, setView] = useState('igme');
    const otherSubTabs = useOtherSubTabs(view);
    return (
        <div className="space-y-4">
            <div hidden data-assistant-reference={otherSubTabs} />
            <div className="px-3 md:px-0">
                <Chips
                    value={view}
                    onChange={setView}
                    options={[
                        { id: 'igme', label: t('child_indicators.sub_igme', 'Interagency estimates (UN IGME)') },
                        { id: 'mics', label: t('child_indicators.sub_mics', 'Sudan MICS') },
                        { id: 's3m', label: t('child_indicators.sub_s3m', 'Sudan S3M 2018') },
                    ]}
                />
            </div>
            {view === 'igme' && <ChildMortalityDashboard />}
            {view === 'mics' && <SudanMicsDashboard />}
            {view === 's3m' && <SudanS3mDashboard />}
        </div>
    );
}
