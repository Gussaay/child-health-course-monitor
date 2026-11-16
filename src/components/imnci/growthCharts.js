// The WHO growth charts printed in the Sudan IMNCI chart booklet (English
// and Arabic editions, September 2023), with the scale of each one so a
// child's weight and length can be plotted on the official chart itself.
//
// Each chart image is the booklet page, cropped to the chart. The numbers in
// growthCharts.json map a value to a pixel on that image:
//   px = xA + xB * x    (x is length/height in cm, or age in weeks)
//   py = yA + yB * kg
// They were measured from the gridlines of each page and checked by
// plotting the WHO reference values (-3, -2, 0, +2, +3) and confirming each
// lands on its printed line (see tests/growthCharts.test.js).
//
// Weight-for-age charts run in weeks to 13 weeks, then in months, so age is
// turned into weeks (days / 7) before plotting.
import CHARTS from './growthCharts.json';

const IMAGES = import.meta.glob('../../assets/growth-charts/*.webp', { eager: true, query: '?url', import: 'default' });
const imageUrl = (id) => IMAGES[`../../assets/growth-charts/${id}.webp`] || '';

export const WEEKS_PER_MONTH = 30.4375 / 7;
export const KINDS = ['wfl', 'wfh', 'wfa'];

const normSex = (sex) => {
    const s = String(sex || '').toLowerCase();
    if (['male', 'boy', 'boys', 'm'].includes(s)) return 'male';
    if (['female', 'girl', 'girls', 'f'].includes(s)) return 'female';
    return '';
};

/** Weight-for-length under 2 years, weight-for-height from 2 years (as the recording form does). */
export const kindForAge = (ageMonths) => (parseFloat(ageMonths) < 24 ? 'wfl' : 'wfh');

/** The official chart for a kind and sex, in the booklet of the given language. */
export function getChart(kind, sex, lang = 'en') {
    const s = normSex(sex);
    if (!KINDS.includes(kind) || !s) return null;
    const l = String(lang || 'en').startsWith('ar') ? 'ar' : 'en';
    const id = `${l}-${kind}-${s === 'male' ? 'boys' : 'girls'}`;
    const c = CHARTS[id];
    return c ? { id, ...c, url: imageUrl(id) } : null;
}

/** Pixel on the chart image for a value on the x axis (cm or weeks) and a weight. */
export const toPixel = (chart, x, kg) => ({ px: chart.xA + chart.xB * x, py: chart.yA + chart.yB * kg });

/** The value under a pixel of the chart image. */
export const fromPixel = (chart, px, py) => ({ x: (px - chart.xA) / chart.xB, kg: (py - chart.yA) / chart.yB });

/** Whether a value sits inside the printed grid. */
export const inChart = (chart, x, kg) => x >= chart.x[0] && x <= chart.x[1] && kg >= chart.kg[0] && kg <= chart.kg[1];

/** Age in weeks from days, weeks or months, for weight-for-age. */
export function ageInWeeks({ ageDays, ageWeeks, ageMonths } = {}) {
    const d = parseFloat(ageDays); if (Number.isFinite(d)) return d / 7;
    const w = parseFloat(ageWeeks); if (Number.isFinite(w)) return w;
    const m = parseFloat(ageMonths); if (Number.isFinite(m)) return m * WEEKS_PER_MONTH;
    return NaN;
}

/**
 * Where a child goes on the official chart.
 * `child` is { sex, ageMonths, weightKg, lengthCm } (ageDays or ageWeeks for
 * weight-for-age). `kind` defaults to weight-for-length/height by age.
 * Returns null when something needed is missing, otherwise
 * { chart, kind, x, kg, inRange }.
 */
export function plotChild(child = {}, { kind, lang } = {}) {
    const k = kind || (child.ageMonths !== undefined && child.ageMonths !== '' ? kindForAge(child.ageMonths) : null);
    if (!k) return null;
    const chart = getChart(k, child.sex, lang);
    const kg = parseFloat(child.weightKg);
    const x = k === 'wfa' ? ageInWeeks(child) : parseFloat(child.lengthCm);
    if (!chart || !Number.isFinite(kg) || kg <= 0 || !Number.isFinite(x)) return chart ? { chart, kind: k, x: null, kg: null, inRange: false } : null;
    return { chart, kind: k, x, kg, inRange: inChart(chart, x, kg) };
}
