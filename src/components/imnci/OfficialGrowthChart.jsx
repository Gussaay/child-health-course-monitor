// The official WHO chart from the Sudan chart booklet with a point plotted
// on it, drawn as an SVG laid over the booklet image in the image's own
// pixels, so the point lands exactly where a health worker would mark it
// with a pen.
//
// Used by the recording form (the child's own weight and length) and by the
// "Plot on the chart" lesson activity, where the learner taps where they
// think the point goes before the right place is shown.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { toPixel, fromPixel, inChart, plotChild, getChart, kindForAge } from './growthCharts';
import { weightForHeight } from './whz';
import WhzChart from './WhzChart';

export const STATUS_COLORS = { 'Less than -3Z': '#dc2626', 'Between -3 and -2 Z': '#d97706', '-2 Z or more': '#15803d' };
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const round = (v, step) => Math.round(v / step) * step;

/** Turns a tap on the chart into a value, rounded to what can be read off the grid. */
export function pickValue(chart, px, py) {
    const { x, kg } = fromPixel(chart, px, py);
    const xStep = 0.5; // half a centimetre, or half a week
    return {
        x: Number(clamp(round(x, xStep), chart.x[0] < 0.5 ? 0 : chart.x[0], chart.x[1]).toFixed(1)),
        kg: Number(clamp(round(kg, 0.1), chart.kg[0], chart.kg[1]).toFixed(1)),
    };
}

function Marker({ chart, x, kg, color, label, hollow, testId }) {
    const { px, py } = toPixel(chart, x, kg);
    const { px: left } = toPixel(chart, chart.x[0], 0);
    const { py: bottom } = toPixel(chart, 0, chart.kg[0]);
    const labelLeft = px > chart.width * 0.6;
    return (
        <g>
            {!hollow && <>
                <line x1={px} x2={px} y1={py} y2={bottom} stroke={color} strokeWidth="3" strokeDasharray="10 6" />
                <line x1={left} x2={px} y1={py} y2={py} stroke={color} strokeWidth="3" strokeDasharray="10 6" />
            </>}
            <circle cx={px} cy={py} r={hollow ? 13 : 11} fill={hollow ? 'none' : color} stroke={hollow ? color : '#fff'}
                strokeWidth={hollow ? 5 : 4} data-testid={testId} />
            {label && (
                <text x={labelLeft ? px - 20 : px + 20} y={py - 18} fontSize="30" fontWeight="bold" fill={color}
                    stroke="#fff" strokeWidth="8" paintOrder="stroke" textAnchor={labelLeft ? 'end' : 'start'}>{label}</text>
            )}
        </g>
    );
}

/**
 * chart: from getChart(). point: { x, kg, color, label } drawn solid with
 * guide lines to both axes. mark: { x, kg, color } drawn hollow (the
 * learner's own mark). onPick(x, kg): when given, a tap on the grid calls it.
 */
export default function OfficialGrowthChart({ chart, point, mark, onPick, title }) {
    const { t } = useTranslation();
    const [zoom, setZoom] = useState(false);
    if (!chart) return null;
    const handleClick = (e) => {
        if (!onPick) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * chart.width;
        const py = ((e.clientY - r.top) / r.height) * chart.height;
        const v = fromPixel(chart, px, py);
        // A tap outside the grid (on the title or the axis labels) is ignored.
        if (!inChart(chart, v.x, v.kg)) return;
        const p = pickValue(chart, px, py);
        onPick(p.x, p.kg);
    };
    const shown = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.kg) && inChart(chart, p.x, p.kg);
    return (
        <figure className="not-prose my-2" data-testid="official-growth-chart" data-chart={chart.id}>
            <div className="flex items-center gap-2 mb-1">
                <figcaption className="flex-1 text-xs font-semibold text-slate-600">
                    {title || t('imci.growth_chart.source', 'WHO chart from the Sudan IMNCI chart booklet')}
                </figcaption>
                <button type="button" onClick={() => setZoom(!zoom)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50">
                    {zoom ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
                    {zoom ? t('imci.growth_chart.zoom_out', 'Fit to screen') : t('imci.growth_chart.zoom_in', 'Enlarge')}
                </button>
            </div>
            <div className={zoom ? 'overflow-auto max-h-[80vh] border border-slate-200 rounded' : ''}>
                <div className="relative w-full" dir="ltr" style={{ aspectRatio: `${chart.width} / ${chart.height}`, minWidth: zoom ? 1100 : undefined }}>
                    <img src={chart.url} alt="" draggable="false" loading="lazy"
                        className="absolute inset-0 w-full h-full select-none border border-slate-200 rounded bg-white" />
                    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className={`absolute inset-0 w-full h-full ${onPick ? 'cursor-crosshair' : ''}`}
                        onClick={handleClick} role="img"
                        aria-label={shown(point) ? t('imci.growth_chart.aria', 'Point plotted at {{x}} and {{kg}} kg', { x: point.x, kg: point.kg }) : t('imci.growth_chart.aria_empty', 'Growth chart')}>
                        {shown(mark) && <Marker chart={chart} {...mark} color={mark.color || '#7c3aed'} hollow testId="growth-mark" />}
                        {shown(point) && <Marker chart={chart} {...point} color={point.color || '#0f172a'} testId="growth-point" />}
                    </svg>
                </div>
            </div>
        </figure>
    );
}

/**
 * On the recording form: the child's weight and length on the booklet's own
 * chart, with the close-up drawn chart one tap away.
 */
export function FormGrowthChart({ child }) {
    const { t, i18n } = useTranslation();
    const [view, setView] = useState('booklet');
    const plot = plotChild(child, { lang: i18n?.language });
    if (!plot?.chart || plot.x === null) return null;
    const { zScore, status } = weightForHeight(child);
    const color = STATUS_COLORS[status] || '#0f172a';
    const label = `${plot.kg} ${t('imci.ui.kg', 'kg')} · ${plot.x} ${t('imci.ui.cm', 'cm')}${zScore ? ` · z ${zScore}` : ''}`;
    const tab = (id, text) => (
        <button type="button" onClick={() => setView(id)}
            className={`px-2.5 py-1 text-xs rounded border ${view === id ? 'bg-sky-700 text-white border-sky-700' : 'bg-white border-slate-300 hover:bg-slate-50'}`}>{text}</button>
    );
    return (
        <div className="mt-2" data-testid="form-growth-chart">
            <div className="flex gap-2 mb-1">
                {tab('booklet', t('imci.growth_chart.tab_booklet', 'Chart booklet'))}
                {tab('closeup', t('imci.growth_chart.tab_closeup', 'Close-up'))}
            </div>
            {view === 'closeup' ? <WhzChart child={child} /> : (
                plot.inRange
                    ? <OfficialGrowthChart chart={plot.chart} point={{ x: plot.x, kg: plot.kg, color, label }} />
                    : <p className="text-xs text-slate-500">{t('imci.growth_chart.off_chart', 'This weight and length fall outside the printed chart, so the point cannot be plotted on it.')}</p>
            )}
        </div>
    );
}

const KIND_TITLES = {
    wfl: ['imci.growth_chart.kind_wfl', 'Weight-for-length (birth to 2 years)'],
    wfh: ['imci.growth_chart.kind_wfh', 'Weight-for-height (2 to 5 years)'],
    wfa: ['imci.growth_chart.kind_wfa', 'Weight-for-age (birth to 6 months)'],
};

/**
 * The booklet's growth charts in protocol management: pick boys or girls and
 * the chart, and optionally plot a child by typing their numbers.
 * kinds: ['wfl', 'wfh'] or ['wfa']. lang: the booklet edition to show.
 */
export function GrowthChartsBox({ kinds = ['wfl', 'wfh'], lang = 'en' }) {
    const { t } = useTranslation();
    const [sex, setSex] = useState('female');
    const [kind, setKind] = useState(kinds[0]);
    const [v, setV] = useState({ age: '', weightKg: '', x: '' });
    const wfa = kind === 'wfa';
    const chart = getChart(kind, sex, lang);
    const age = parseFloat(v.age); const kg = parseFloat(v.weightKg);
    const x = wfa ? age : parseFloat(v.x);
    const ready = Number.isFinite(kg) && Number.isFinite(x);
    // The length/height chart follows the age typed, as on the recording form.
    const autoKind = !wfa && Number.isFinite(age) ? kindForAge(age) : kind;
    const status = ready && !wfa && Number.isFinite(age) ? weightForHeight({ sex, ageMonths: age, weightKg: kg, lengthCm: x }).status : null;
    const show = autoKind !== kind && kinds.includes(autoKind) ? getChart(autoKind, sex, lang) : chart;
    const point = ready && show && inChart(show, x, kg) ? { x, kg, color: STATUS_COLORS[status] || '#0f172a', label: `${kg} ${t('imci.ui.kg', 'kg')} · ${x} ${wfa ? t('imci.growth_chart.weeks_short', 'weeks') : t('imci.ui.cm', 'cm')}` } : null;
    const chip = (on, onClick, text) => (
        <button type="button" onClick={onClick}
            className={`px-2.5 py-1 text-xs rounded-full border ${on ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-300 hover:bg-slate-50'}`}>{text}</button>
    );
    const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }));
    const field = 'w-24 p-1 border border-slate-300 rounded text-xs';
    return (
        <div className="space-y-2" data-testid="growth-charts-box">
            <div className="flex flex-wrap gap-1.5">
                {chip(sex === 'female', () => setSex('female'), t('imci.growth_chart.girls', 'Girls'))}
                {chip(sex === 'male', () => setSex('male'), t('imci.growth_chart.boys', 'Boys'))}
                {kinds.length > 1 && kinds.map((k) => <React.Fragment key={k}>{chip(show?.kind === k, () => { setKind(k); setV((p) => ({ ...p, age: '' })); }, t(...KIND_TITLES[k]))}</React.Fragment>)}
            </div>
            <div className="flex flex-wrap items-end gap-2 text-xs text-slate-600">
                <span className="font-semibold">{t('imci.growth_chart.plot_child', 'Plot a child:')}</span>
                <label className="flex flex-col">{wfa ? t('imci.growth_chart.age_in_weeks', 'Age (weeks)') : t('imci.growth_chart.age_in_months', 'Age (months)')}
                    <input type="number" inputMode="decimal" value={v.age} onChange={set('age')} className={field} /></label>
                <label className="flex flex-col">{t('imci.growth_chart.weight_kg', 'Weight (kg)')}
                    <input type="number" inputMode="decimal" step="0.1" value={v.weightKg} onChange={set('weightKg')} className={field} /></label>
                {!wfa && <label className="flex flex-col">{t('imci.growth_chart.length_cm', 'Length or height (cm)')}
                    <input type="number" inputMode="decimal" step="0.5" value={v.x} onChange={set('x')} className={field} /></label>}
                {status && point && <span className="font-bold" style={{ color: STATUS_COLORS[status] }}>{t({ 'Less than -3Z': 'imci.child.less_3z', 'Between -3 and -2 Z': 'imci.child.between_3_2', '-2 Z or more': 'imci.child.more_2z' }[status], status)}</span>}
            </div>
            <OfficialGrowthChart chart={show} point={point} />
        </div>
    );
}
