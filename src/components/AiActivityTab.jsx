// src/components/AiActivityTab.jsx
//
// Admin › AI activity (super users): who used the AI features on a day, or
// over the last 7 or 30 days added up, for what, and how much of their own
// daily limit and of the shared free-tier pool it took. Reads aiLog, which
// the functions write (functions/aiLog.js); the sums are in utils/aiActivity.js.
import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { aiActivity, daysBefore, featureLabel } from '../utils/aiActivity';
import { Card, EmptyState, Spinner } from './CommonComponents';

// The limits count by UTC day, so the page does too.
const utcToday = () => new Date().toISOString().slice(0, 10);
const fmtPct = (p) => (p === null || p === undefined ? '–' : `${p}%`);
const time = (msAt) => (msAt ? new Date(msAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

function Bar({ pct, className = '' }) {
    const w = Math.min(100, Number(pct) || 0);
    return (
        <div className={`h-1.5 rounded-full bg-slate-100 overflow-hidden ${className}`}>
            <div className={`h-full rounded-full ${w >= 90 ? 'bg-red-500' : w >= 60 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${w}%` }} />
        </div>
    );
}

const STATUS_STYLE = {
    error: 'bg-red-50 text-red-700',
    limit: 'bg-amber-50 text-amber-800',
    cached: 'bg-sky-50 text-sky-700',
};

export default function AiActivityTab() {
    const { t } = useTranslation();
    const today = utcToday();
    const [range, setRange] = useState(1);
    const [day, setDay] = useState(today);
    const [lines, setLines] = useState(null);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const [who, setWho] = useState('');
    const [feature, setFeature] = useState('');

    const lastDay = range === 1 ? day : today;
    const firstDay = daysBefore(lastDay, range - 1);

    useEffect(() => {
        let live = true;
        setLines(null);
        setError('');
        setWho('');
        setFeature('');
        const q = query(collection(db, 'aiLog'), where('day', '>=', firstDay), where('day', '<=', lastDay), limit(5000));
        getDocs(q)
            .then((snap) => live && setLines(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
            .catch((e) => live && (setError(e.message), setLines([])));
        return () => {
            live = false;
        };
    }, [firstDay, lastDay, reload]);

    const a = useMemo(() => aiActivity(lines || [], { lastDay, dayCount: range }), [lines, lastDay, range]);
    const nameOf = (r) => r.name || r.email || String(r.uid).slice(0, 8);
    const names = useMemo(() => Object.fromEntries(a.rows.map((r) => [r.uid, nameOf(r)])), [a.rows]);
    const shown = a.lines.filter((l) => (!who || l.uid === who) && (!feature || l.feature === feature));
    const ranges = [
        { days: 1, label: t('admin_pages.ai_activity.day', 'Day') },
        { days: 7, label: t('admin_pages.ai_activity.last7', 'Last 7 days') },
        { days: 30, label: t('admin_pages.ai_activity.last30', 'Last 30 days') },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-xl p-1 flex-1 min-w-[260px]">
                    {ranges.map((r) => (
                        <button
                            key={r.days}
                            onClick={() => setRange(r.days)}
                            className={`rounded-lg py-2 text-xs font-semibold ${range === r.days ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setReload((n) => n + 1)} aria-label="Refresh">
                    <RefreshCw size={18} />
                </button>
            </div>

            {range === 1 && (
                <div className="flex items-center justify-between gap-2">
                    <button className="p-2 rounded-full hover:bg-slate-100" aria-label="Day before" onClick={() => setDay(daysBefore(day, 1))}>
                        <ChevronLeft size={20} />
                    </button>
                    <p className="font-semibold text-slate-800">{day === today ? `${t('admin_pages.ai_activity.today', 'Today')} (${day})` : day}</p>
                    <button
                        className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30"
                        aria-label="Day after"
                        disabled={day >= today}
                        onClick={() => setDay(daysBefore(day, -1))}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}

            <Card className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                        {t('admin_pages.ai_activity.pool', 'Free AI allowance')}
                        {range > 1 ? ` · ${range} days` : ''}
                    </p>
                    <p className="text-sm font-semibold text-slate-700">
                        {a.used}
                        {a.pool ? ` of ~${a.pool} · ${fmtPct(a.poolPct)}` : ''}
                    </p>
                </div>
                {a.pool > 0 && <Bar pct={a.poolPct} className="mt-2" />}
                <p className="text-xs text-slate-500 mt-2">
                    {a.people} {a.people === 1 ? 'person' : 'people'} · {a.uses} uses
                    {Object.keys(a.features).length > 0 && ' · '}
                    {Object.entries(a.features).map(([f, n]) => `${featureLabel(f)} ${n}`).join(', ')}
                </p>
                {range > 1 && (
                    <div className="mt-3 space-y-1">
                        {a.days.map((d) => (
                            <button
                                key={d.day}
                                onClick={() => {
                                    setDay(d.day);
                                    setRange(1);
                                }}
                                className="w-full flex items-center gap-2 text-[11px] text-slate-500"
                            >
                                <span className="w-12 text-left shrink-0">{d.day.slice(5)}</span>
                                <Bar pct={d.pct} className="flex-1" />
                                <span className="w-32 text-right shrink-0">
                                    {d.used}
                                    {a.poolPerDay ? ` / ~${a.poolPerDay}` : ''} · {d.people} {d.people === 1 ? 'person' : 'people'}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </Card>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {lines === null ? (
                <Spinner />
            ) : !a.rows.length ? (
                <EmptyState icon={<Sparkles className="w-8 h-8" />} message={t('admin_pages.ai_activity.empty', 'No AI use in this period.')} />
            ) : (
                <>
                    <Card className="divide-y divide-slate-100">
                        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t('admin_pages.ai_activity.people', 'People · tap one to see only their uses')}
                        </p>
                        {a.rows.map((r) => (
                            <button
                                key={r.uid}
                                onClick={() => setWho(who === r.uid ? '' : r.uid)}
                                className={`w-full text-left px-4 py-3 ${who === r.uid ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                            >
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-medium text-slate-800 truncate">{names[r.uid]}</span>
                                    <span className="shrink-0 text-sm font-semibold text-slate-700">
                                        {r.requests}
                                        {r.limit ? ` of ${r.limit} · ${fmtPct(r.ofLimit)}` : ''}
                                        {range > 1 ? ` · ${r.daysUsed} ${r.daysUsed === 1 ? 'day' : 'days'}` : ''}
                                    </span>
                                </div>
                                {r.limit > 0 && <Bar pct={r.ofLimit} className="mt-1.5" />}
                                <p className="text-xs text-slate-500 mt-1">
                                    {fmtPct(r.ofPool)} of the free allowance · {Object.entries(r.features).map(([f, n]) => `${featureLabel(f)} ${n}`).join(', ')}
                                    {r.cached > 0 && ` · ${r.cached} saved answers`}
                                    {r.limited > 0 && <span className="text-amber-700"> · hit the limit {r.limited}×</span>}
                                    {r.errors > 0 && <span className="text-red-600"> · {r.errors} failed</span>}
                                    {r.email && r.name ? ` · ${r.email}` : ''}
                                </p>
                            </button>
                        ))}
                    </Card>

                    <div className="flex flex-wrap gap-1.5">
                        {['', ...Object.keys(a.features)].map((f) => (
                            <button
                                key={f || 'all'}
                                onClick={() => setFeature(f)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${feature === f ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                                {f ? featureLabel(f) : t('admin_pages.ai_activity.all', 'All')}
                            </button>
                        ))}
                        {who && (
                            <button onClick={() => setWho('')} className="rounded-full px-3 py-1 text-xs font-semibold bg-sky-50 text-sky-700">
                                {names[who]} ✕
                            </button>
                        )}
                    </div>

                    <Card className="divide-y divide-slate-100">
                        {shown.map((l) => (
                            <div key={l.id} className="px-4 py-3">
                                <div className="flex items-baseline justify-between gap-2 text-xs text-slate-500">
                                    <span className="truncate">
                                        <b className="text-slate-700">{names[l.uid] || l.email}</b> · {featureLabel(l.feature)}
                                        {l.where ? ` · ${l.where}` : ''}
                                    </span>
                                    <span className="shrink-0">
                                        {range > 1 ? `${String(l.day).slice(5)} ` : ''}
                                        {time(l.atMs)}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-800 mt-1 break-words">{l.what || '—'}</p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    {l.limit ? `${l.used} of ${l.limit} today` : ''}
                                    {l.model ? ` · ${l.model}` : ''}
                                    {l.ms ? ` · ${(l.ms / 1000).toFixed(1)} s` : ''}
                                    {STATUS_STYLE[l.status] && (
                                        <span className={`ml-1.5 rounded px-1.5 py-0.5 font-semibold ${STATUS_STYLE[l.status]}`}>
                                            {l.status === 'limit' ? 'over limit' : l.status === 'cached' ? 'saved answer' : `failed${l.error ? `: ${l.error}` : ''}`}
                                        </span>
                                    )}
                                </p>
                            </div>
                        ))}
                    </Card>
                </>
            )}
            <p className="text-[11px] text-slate-400">
                {t(
                    'admin_pages.ai_activity.note',
                    "Days are UTC, like the daily limits. A use counts when it reached the AI; saved answers and refusals over the limit do not. The free allowance is an estimate of both providers' free tiers together; one question to Ask the data can take several AI steps. Logged from 25 Oct 2026."
                )}
            </p>
        </div>
    );
}
