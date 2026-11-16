// Weight-for-length/height chart with the child's own point plotted on the
// WHO z-score lines (-3, -2, 0, +2, +3) from the same reference rows the
// recording form uses to compute the z-score.
import React from 'react';
import { useTranslation } from 'react-i18next';
import zScoreData from '../zscore_reference_data.json';
import { weightForHeight } from './whz';

const LINES = [
    { z: '3', color: '#94a3b8', dash: '4 3' },
    { z: '2', color: '#64748b', dash: '' },
    { z: '0', color: '#15803d', dash: '' },
    { z: '-2', color: '#d97706', dash: '' },
    { z: '-3', color: '#dc2626', dash: '' },
];
const W = 360, H = 250, PAD = { l: 34, r: 30, t: 12, b: 30 };

export function chartWindow({ sex, ageMonths, weightKg, lengthCm }, data = zScoreData) {
    const weight = parseFloat(weightKg); const length = parseFloat(lengthCm); const age = parseFloat(ageMonths);
    if (!weight || !length || !age || !sex) return null;
    const groupKey = (sex === 'male') ? (age < 24 ? 'boys_0_2' : 'boys_2_5') : (age < 24 ? 'girls_0_2' : 'girls_2_5');
    const group = data[groupKey];
    if (!group) return null;
    const keys = Object.keys(group).map(Number).sort((a, b) => a - b);
    const lo = keys[0], hi = keys[keys.length - 1];
    if (length < lo || length > hi) return { outOfRange: true, lo, hi };
    let x0 = Math.max(lo, Math.floor((length - 10) / 5) * 5);
    let x1 = Math.min(hi, x0 + 20);
    if (x1 - x0 < 20) x0 = Math.max(lo, x1 - 20);
    const rows = keys.filter((k) => k >= x0 && k <= x1).map((k) => ({ x: k, ...group[k.toFixed(1)] }));
    const yMin = Math.floor(Math.min(weight, ...rows.map((r) => r['-3'])) - 0.5);
    const yMax = Math.ceil(Math.max(weight, ...rows.map((r) => r['3'])) + 0.5);
    return { rows, x0, x1, yMin: Math.max(0, yMin), yMax, weight, length, under2: age < 24 };
}

export default function WhzChart({ child }) {
    const { t } = useTranslation();
    const win = chartWindow(child);
    if (!win) return null;
    if (win.outOfRange) {
        return <p className="text-xs text-slate-500">{t('imci.whz_chart.out_of_range', 'The length is outside the chart ({{lo}} to {{hi}} cm), so the point cannot be plotted.', { lo: win.lo, hi: win.hi })}</p>;
    }
    const { rows, x0, x1, yMin, yMax, weight, length, under2 } = win;
    const { zScore, status } = weightForHeight(child);
    const sx = (x) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const sy = (y) => H - PAD.b - ((y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
    const path = (z) => rows.map((r, i) => `${i ? 'L' : 'M'}${sx(r.x).toFixed(1)},${sy(r[z]).toFixed(1)}`).join(' ');
    const band = (zLow, zHigh) => {
        const top = rows.map((r) => `${sx(r.x).toFixed(1)},${sy(zHigh === null ? yMax : r[zHigh]).toFixed(1)}`);
        const bottom = rows.slice().reverse().map((r) => `${sx(r.x).toFixed(1)},${sy(zLow === null ? yMin : r[zLow]).toFixed(1)}`);
        return [...top, ...bottom].join(' ');
    };
    const yStep = yMax - yMin > 10 ? 2 : 1;
    const yTicks = []; for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) yTicks.push(y);
    const xTicks = []; for (let x = Math.ceil(x0 / 5) * 5; x <= x1; x += 5) xTicks.push(x);
    const dotColor = status === 'Less than -3Z' ? '#dc2626' : status === 'Between -3 and -2 Z' ? '#d97706' : '#15803d';
    const px = sx(length), py = sy(Math.min(Math.max(weight, yMin), yMax));
    const last = rows[rows.length - 1];
    const label = `${weight} ${t('imci.ui.kg', 'kg')} · ${length} ${t('imci.ui.cm', 'cm')}${zScore !== null && zScore !== undefined ? ` · z ${zScore}` : ''}`;
    const labelLeft = px > W / 2;

    return (
        <figure className="mt-2" data-testid="whz-chart">
            <figcaption className="text-xs font-semibold text-slate-600 mb-1">
                {under2 ? t('imci.whz_chart.title_length', 'Weight-for-length (under 2 years)') : t('imci.whz_chart.title_height', 'Weight-for-height (2 to 5 years)')}
                {' · '}{child.sex === 'male' ? t('imci.whz_chart.boys', 'boys') : t('imci.whz_chart.girls', 'girls')}
            </figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md h-auto bg-white border border-slate-200 rounded" role="img"
                aria-label={t('imci.whz_chart.aria', 'Weight {{w}} kg at length {{l}} cm plotted on the WHO z-score lines', { w: weight, l: length })}>
                <polygon points={band(null, '-3')} fill="#fee2e2" />
                <polygon points={band('-3', '-2')} fill="#fef3c7" />
                <polygon points={band('-2', null)} fill="#f0fdf4" />
                {yTicks.map((y) => <g key={`y${y}`}><line x1={PAD.l} x2={W - PAD.r} y1={sy(y)} y2={sy(y)} stroke="#e2e8f0" strokeWidth="0.5" />
                    <text x={PAD.l - 4} y={sy(y) + 3} fontSize="9" textAnchor="end" fill="#64748b">{y}</text></g>)}
                {xTicks.map((x) => <g key={`x${x}`}><line x1={sx(x)} x2={sx(x)} y1={PAD.t} y2={H - PAD.b} stroke="#e2e8f0" strokeWidth="0.5" />
                    <text x={sx(x)} y={H - PAD.b + 11} fontSize="9" textAnchor="middle" fill="#64748b">{x}</text></g>)}
                {LINES.map((l) => <g key={l.z}><path d={path(l.z)} fill="none" stroke={l.color} strokeWidth="1.5" strokeDasharray={l.dash} />
                    <text x={W - PAD.r + 3} y={sy(last[l.z]) + 3} fontSize="9" fill={l.color} fontWeight="bold">{l.z === '0' ? '0' : (l.z.startsWith('-') ? l.z : `+${l.z}`)}</text></g>)}
                <line x1={px} x2={px} y1={py} y2={H - PAD.b} stroke={dotColor} strokeDasharray="3 2" strokeWidth="1" />
                <line x1={PAD.l} x2={px} y1={py} y2={py} stroke={dotColor} strokeDasharray="3 2" strokeWidth="1" />
                <circle cx={px} cy={py} r="5" fill={dotColor} stroke="#fff" strokeWidth="1.5" data-testid="whz-point" />
                <text x={labelLeft ? px - 8 : px + 8} y={py - 8} fontSize="10" fontWeight="bold" fill={dotColor} stroke="#fff" strokeWidth="3" paintOrder="stroke" textAnchor={labelLeft ? 'end' : 'start'}>{label}</text>
                <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} fontSize="9" textAnchor="middle" fill="#475569">
                    {under2 ? t('imci.whz_chart.x_length', 'Length (cm)') : t('imci.whz_chart.x_height', 'Height (cm)')}</text>
                <text x={10} y={(PAD.t + H - PAD.b) / 2} fontSize="9" textAnchor="middle" fill="#475569" transform={`rotate(-90 10 ${(PAD.t + H - PAD.b) / 2})`}>
                    {t('imci.whz_chart.y_weight', 'Weight (kg)')}</text>
            </svg>
            <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-600">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#fee2e2', border: '1px solid #dc2626' }} />{t('imci.child.less_3z')}</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#fef3c7', border: '1px solid #d97706' }} />{t('imci.child.between_3_2')}</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#f0fdf4', border: '1px solid #15803d' }} />{t('imci.child.more_2z')}</span>
            </div>
        </figure>
    );
}
