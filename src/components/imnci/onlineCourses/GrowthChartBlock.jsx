// src/components/imnci/onlineCourses/GrowthChartBlock.jsx
//
// "Plot on the chart": a lesson activity on the official WHO chart from the
// Sudan chart booklet. The learner reads a child's weight and length (or age
// for weight-for-age), taps where the point goes, checks it against the
// right place, then says which z-score band it falls in.
//
// A block without a weight is free practice: the learner types a child's
// numbers and sees them plotted.
//
// Block fields: title, text (the case), chart ('wfl' | 'wfh' | 'wfa'; by age
// when left out), sex ('male' | 'female'), ageMonths (or ageWeeks / ageDays
// for weight-for-age), weightKg, lengthCm, lowWeightForAge (weight-for-age
// only: the answer to "is the weight low for age?"), explanation.
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { useActivity, Frame, Html } from './interactive';
import OfficialGrowthChart, { STATUS_COLORS } from '../OfficialGrowthChart';
import { plotChild, kindForAge, ageInWeeks } from '../growthCharts';
import { weightForHeight } from '../whz';

const BANDS = ['Less than -3Z', 'Between -3 and -2 Z', '-2 Z or more'];
const BAND_KEYS = { 'Less than -3Z': 'imci.child.less_3z', 'Between -3 and -2 Z': 'imci.child.between_3_2', '-2 Z or more': 'imci.child.more_2z' };
const BAND_TEXT = { 'Less than -3Z': 'Less than -3 Z', 'Between -3 and -2 Z': 'Between -3 and -2 Z', '-2 Z or more': '-2 Z or more' };

/** How close a mark must be to count as well placed: 1 cm (or 1 week) and 0.2 kg. */
export const isClose = (a, b) => Math.abs(a.x - b.x) <= 1 + 1e-9 && Math.abs(a.kg - b.kg) <= 0.2 + 1e-9;

/** The chart kind a block uses. */
export const blockKind = (b) => b.chart || (b.ageMonths !== undefined && b.ageMonths !== '' ? kindForAge(b.ageMonths) : 'wfl');

/** The right answer to the band question for a block. */
export function blockBand(b) {
    if (blockKind(b) === 'wfa') return b.lowWeightForAge ? 'low' : 'notlow';
    return weightForHeight(b).status;
}

const fmt = (v) => (Number.isFinite(v) ? Number(v.toFixed(1)) : '');

function Facts({ block, kind }) {
    const { t } = useTranslation();
    const age = kind === 'wfa'
        ? (block.ageDays !== undefined && block.ageDays !== ''
            ? t('imci.growth_chart.age_days', '{{n}} days', { n: block.ageDays })
            : t('imci.growth_chart.age_weeks', '{{n}} weeks', { n: fmt(ageInWeeks(block)) }))
        : t('imci.growth_chart.age_months', '{{n}} months', { n: block.ageMonths });
    const facts = [
        [t('imci.growth_chart.sex', 'Sex'), block.sex === 'male' ? t('imci.growth_chart.boy', 'Boy') : t('imci.growth_chart.girl', 'Girl')],
        [t('imci.growth_chart.age', 'Age'), age],
        [t('imci.growth_chart.weight', 'Weight'), `${block.weightKg} ${t('imci.ui.kg', 'kg')}`],
    ];
    if (kind !== 'wfa') facts.push([kind === 'wfl' ? t('imci.growth_chart.length', 'Length') : t('imci.growth_chart.height', 'Height'), `${block.lengthCm} ${t('imci.ui.cm', 'cm')}`]);
    return (
        <div className="flex flex-wrap gap-2 my-2">
            {facts.map(([k, v]) => (
                <span key={k} className="inline-flex items-baseline gap-1 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-sm">
                    <span className="text-slate-500">{k}</span> <span className="font-bold text-slate-900">{v}</span>
                </span>
            ))}
        </div>
    );
}

const xUnit = (t, kind) => (kind === 'wfa' ? t('imci.growth_chart.weeks_short', 'weeks') : t('imci.ui.cm', 'cm'));

function CaseChart({ block, activityKey }) {
    const { t, i18n } = useTranslation();
    const [done, markDone] = useActivity(activityKey);
    const [mark, setMark] = useState(null);
    const [checked, setChecked] = useState(false);
    const [band, setBand] = useState(null);
    const kind = blockKind(block);
    const plot = plotChild(block, { kind, lang: i18n?.language });
    if (!plot?.chart || plot.x === null) return null;
    const right = { x: plot.x, kg: plot.kg };
    const close = mark && isClose(mark, right);
    const answer = blockBand(block);
    const options = kind === 'wfa'
        ? [['low', t('imci.growth_chart.low_wfa', 'Low weight for age (below the -2 line)')], ['notlow', t('imci.growth_chart.not_low_wfa', 'Not low weight for age')]]
        : BANDS.map((s) => [s, t(BAND_KEYS[s], BAND_TEXT[s])]);
    const color = kind === 'wfa' ? (answer === 'low' ? '#d97706' : '#15803d') : (STATUS_COLORS[answer] || '#0f172a');
    const reset = () => { setMark(null); setChecked(false); setBand(null); };
    const label = `${fmt(plot.kg)} ${t('imci.ui.kg', 'kg')} · ${fmt(plot.x)} ${xUnit(t, kind)}`;
    return (
        <Frame icon={LineChart} tone="emerald" done={done}
            label={block.label || t('imci.growth_chart.activity', 'Plot on the chart')} title={block.title}>
            {block.text && <div className="text-sm sm:text-base text-slate-800"><Html html={block.text} /></div>}
            <Facts block={block} kind={kind} />
            <div className="text-sm font-semibold text-slate-900 mt-2">
                {checked ? t('imci.growth_chart.step2', 'Step 2. Which band is the point in?')
                    : t('imci.growth_chart.step1', 'Step 1. Tap the chart where this child\'s point goes.')}
            </div>
            <OfficialGrowthChart chart={plot.chart}
                mark={mark ? { ...mark, color: '#7c3aed' } : null}
                point={checked ? { ...right, color, label } : null}
                onPick={checked ? undefined : (x, kg) => setMark({ x, kg })} />
            {!checked && (
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-slate-600" data-testid="growth-mark-value">
                        {mark ? t('imci.growth_chart.your_mark', 'Your mark: {{x}} {{unit}}, {{kg}} kg', { x: mark.x, unit: xUnit(t, kind), kg: mark.kg })
                            : t('imci.growth_chart.no_mark', 'No mark yet.')}
                    </span>
                    <button type="button" disabled={!mark} onClick={() => setChecked(true)}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-40">
                        <CheckCircle2 size={16} /> {t('imci.growth_chart.check', 'Check my point')}
                    </button>
                </div>
            )}
            {checked && (
                <>
                    <div className={`rounded-lg border p-3 text-sm ${close ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                        {close ? t('imci.growth_chart.well_placed', 'Well placed. The solid dot is the exact place; your mark is the ring.')
                            : t('imci.growth_chart.not_placed', 'Not quite. The solid dot shows where {{x}} {{unit}} and {{kg}} kg meet; your mark is the ring. Follow the dashed lines from each axis.', { x: fmt(plot.x), unit: xUnit(t, kind), kg: fmt(plot.kg) })}
                    </div>
                    <div className="space-y-1.5 mt-3">
                        {options.map(([id, text], oi) => {
                            const isAns = id === answer;
                            const tone = band && isAns ? 'border-sky-500 bg-sky-50' : band === id ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50 hover:border-sky-400';
                            return (
                                <button key={id} type="button" disabled={!!band} onClick={() => { setBand(id); markDone(); }}
                                    className={`w-full text-start min-h-[40px] px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${tone}`}>
                                    <span className="w-6 h-6 rounded-full border border-slate-300 bg-white grid place-items-center text-[11px] font-bold shrink-0">{String.fromCharCode(65 + oi)}</span>
                                    <span className="flex-1">{text}</span>
                                    {band && isAns && <CheckCircle2 size={16} className="text-sky-700" />}
                                    {band === id && !isAns && <XCircle size={16} className="text-rose-600" />}
                                </button>
                            );
                        })}
                    </div>
                    {band && (
                        <div className={`mt-2 rounded-lg border p-3 text-sm ${band === answer ? 'bg-sky-50 border-sky-200' : 'bg-rose-50 border-rose-200'}`}>
                            <span className={`font-semibold ${band === answer ? 'text-sky-900' : 'text-rose-900'}`}>
                                {band === answer ? t('imnci_ui.courses.question.correct', 'Correct.') : t('imnci_ui.courses.question.not_quite', 'Not quite.')}
                            </span>{' '}
                            {block.explanation && <span className="text-slate-700"><Html html={block.explanation} /></span>}
                        </div>
                    )}
                    {band && (
                        <button type="button" onClick={reset}
                            className="mt-3 inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50">
                            <RotateCcw size={15} /> {t('imci.growth_chart.again', 'Plot it again')}
                        </button>
                    )}
                </>
            )}
        </Frame>
    );
}

function FreeChart({ block, activityKey }) {
    const { t, i18n } = useTranslation();
    const [done, markDone] = useActivity(activityKey);
    const wfa = block.chart === 'wfa';
    const [v, setV] = useState({ sex: block.sex || 'female', age: '', weightKg: '', lengthCm: '' });
    const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }));
    const child = wfa ? { sex: v.sex, ageWeeks: v.age, weightKg: v.weightKg } : { sex: v.sex, ageMonths: v.age, weightKg: v.weightKg, lengthCm: v.lengthCm };
    const ready = v.age !== '' && v.weightKg !== '' && (wfa || v.lengthCm !== '');
    const kind = wfa ? 'wfa' : (v.age !== '' ? kindForAge(v.age) : (block.chart || 'wfl'));
    const plot = plotChild(child, { kind, lang: i18n?.language });
    const status = !wfa && ready ? weightForHeight(child).status : null;
    const ok = ready && plot?.inRange;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (ok && !done) markDone(); }, [ok, done]);
    const field = 'block w-full rounded-md border border-slate-300 p-2 text-sm bg-white';
    return (
        <Frame icon={LineChart} tone="emerald" done={done}
            label={block.label || t('imci.growth_chart.activity', 'Plot on the chart')} title={block.title || t('imci.growth_chart.free_title', 'Try your own numbers')}>
            {block.text && <div className="text-sm sm:text-base text-slate-800 mb-2"><Html html={block.text} /></div>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="text-xs text-slate-600">{t('imci.growth_chart.sex', 'Sex')}
                    <select value={v.sex} onChange={set('sex')} className={field}>
                        <option value="female">{t('imci.growth_chart.girl', 'Girl')}</option>
                        <option value="male">{t('imci.growth_chart.boy', 'Boy')}</option>
                    </select></label>
                <label className="text-xs text-slate-600">{wfa ? t('imci.growth_chart.age_in_weeks', 'Age (weeks)') : t('imci.growth_chart.age_in_months', 'Age (months)')}
                    <input type="number" inputMode="decimal" value={v.age} onChange={set('age')} className={field} /></label>
                <label className="text-xs text-slate-600">{t('imci.growth_chart.weight_kg', 'Weight (kg)')}
                    <input type="number" inputMode="decimal" step="0.1" value={v.weightKg} onChange={set('weightKg')} className={field} /></label>
                {!wfa && <label className="text-xs text-slate-600">{t('imci.growth_chart.length_cm', 'Length or height (cm)')}
                    <input type="number" inputMode="decimal" step="0.5" value={v.lengthCm} onChange={set('lengthCm')} className={field} /></label>}
            </div>
            {plot?.chart && (
                <OfficialGrowthChart chart={plot.chart}
                    point={ok ? { x: plot.x, kg: plot.kg, color: STATUS_COLORS[status] || '#0f172a', label: `${fmt(plot.kg)} ${t('imci.ui.kg', 'kg')} · ${fmt(plot.x)} ${xUnit(t, kind)}` } : null} />
            )}
            {ready && plot && !plot.inRange && (
                <p className="text-sm text-amber-800">{t('imci.growth_chart.off_chart', 'This weight and length fall outside the printed chart, so the point cannot be plotted on it.')}</p>
            )}
            {ok && status && (
                <p className="text-sm font-semibold" style={{ color: STATUS_COLORS[status] }}>{t(BAND_KEYS[status], BAND_TEXT[status])}</p>
            )}
        </Frame>
    );
}

export default function GrowthChartBlock({ block, activityKey }) {
    const hasCase = block.weightKg !== undefined && block.weightKg !== '' && block.sex;
    return hasCase ? <CaseChart block={block} activityKey={activityKey} /> : <FreeChart block={block} activityKey={activityKey} />;
}
