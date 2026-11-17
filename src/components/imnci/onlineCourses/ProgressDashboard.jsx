// src/components/imnci/onlineCourses/ProgressDashboard.jsx
//
// Managers' view of the online courses: who has started and finished each
// course, by state and by person. Each learner's progress is private in the
// database, so it comes from the onlineProgressReport function, which also
// limits a state or locality manager to their own people.
//
// With one course chosen it also shows each module (started, finished) and
// each lesson in reading order (how many finished it), so a manager can see
// where learners stop, and each learner opens to their own module by module
// progress and the lesson they are on.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { RefreshCw, Users, PlayCircle, CheckCircle2, Search, Download, Moon, X, MapPin } from 'lucide-react';

import { Card, CardBody, Button, Table, EmptyState, SkeletonTable } from '../../CommonComponents';
import { getLocalizedStateName } from '../../constants';
import { STATUS_COLORS } from '../../../utils/statusColors';

const loadReport = () => httpsCallable(getFunctions(), 'onlineProgressReport', { timeout: 70000 })({});

const pct = (n, d) => (d ? Math.round((n * 100) / d) : 0);
const DAY = 24 * 60 * 60 * 1000;
// Started but no lesson finished or activity done for this long.
const QUIET_DAYS = 14;

/** The rows as a CSV file the browser saves. */
function downloadCsv(name, rows) {
    const cell = (v) => {
        const text = String(v ?? '');
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Kpi({ icon: Icon, label, value, sub }) {
    return (
        <div className="rounded-xl border border-line bg-white p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Icon size={14} />{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
            {sub && <div className="text-xs text-slate-500">{sub}</div>}
        </div>
    );
}

function Bar({ value }) {
    const tone = value >= 75 ? STATUS_COLORS.good : value >= 40 ? STATUS_COLORS.partial : STATUS_COLORS.poor;
    return (
        <div className="flex items-center gap-2 min-w-[7rem]">
            <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${value}%`, background: tone }} />
            </div>
            <span className="w-10 text-end text-xs tabular-nums text-slate-600">{value}%</span>
        </div>
    );
}

export function ProgressDashboard() {
    const { t, i18n } = useTranslation();
    const [report, setReport] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [courseId, setCourseId] = useState('');
    const [state, setState] = useState('');
    const [status, setStatus] = useState('');
    const [query, setQuery] = useState('');
    const [openUid, setOpenUid] = useState(null);
    const [now] = useState(() => Date.now());

    const load = () => {
        setLoading(true);
        setError('');
        loadReport()
            .then(({ data }) => {
                setReport(data);
                // One course: choose it, so the module and lesson views show straight away.
                if (data?.courses?.length === 1) setCourseId(data.courses[0].id);
            })
            .catch((e) => setError(e?.message || t('imnci_ui.progress.failed', 'The progress could not be loaded.')))
            .finally(() => setLoading(false));
    };
    useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

    const view = useMemo(() => {
        if (!report) return null;
        const courses = courseId ? report.courses.filter((c) => c.id === courseId) : report.courses;
        const total = courses.reduce((n, c) => n + c.sections, 0);
        const people = report.learners
            .filter((l) => !state || l.state === state)
            .map((l) => {
                const done = courses.reduce((n, c) => n + Math.min(l.perCourse[c.id] || 0, c.sections), 0);
                // Finished: the chosen course, or at least one course when all are shown.
                const finished = courses.some((c) => (l.perCourse[c.id] || 0) >= c.sections);
                const begun = done || courses.some((c) => (l.startedPerCourse || {})[c.id]);
                const quiet = begun && !finished && (!l.lastActive || now - l.lastActive > QUIET_DAYS * DAY);
                return { ...l, done, percent: pct(done, total), quiet, status: finished ? 'completed' : begun ? 'started' : 'not_started' };
            });
        const byState = new Map();
        people.forEach((p) => {
            const key = p.state || '';
            const g = byState.get(key) || { state: key, people: 0, started: 0, completed: 0, sum: 0 };
            g.people += 1;
            if (p.status !== 'not_started') g.started += 1;
            if (p.status === 'completed') g.completed += 1;
            g.sum += p.percent;
            byState.set(key, g);
        });
        const q = query.trim().toLowerCase();
        const listed = people
            .filter((p) => !status || (status === 'quiet' ? p.quiet : p.status === status))
            .filter((p) => !q || `${p.name} ${p.email} ${p.locality}`.toLowerCase().includes(q))
            .sort((a, b) => b.percent - a.percent || (b.lastActive || 0) - (a.lastActive || 0));
        return {
            total, people, listed,
            started: people.filter((p) => p.status !== 'not_started').length,
            completed: people.filter((p) => p.status === 'completed').length,
            quiet: people.filter((p) => p.quiet).length,
            average: people.length ? Math.round(people.reduce((n, p) => n + p.percent, 0) / people.length) : 0,
            byState: [...byState.values()].sort((a, b) => b.people - a.people),
        };
    }, [report, courseId, state, status, query, now]);

    // One course chosen: its modules and its lessons, for the people shown.
    const detail = useMemo(() => {
        if (!view || !courseId) return null;
        const course = report.courses.find((c) => c.id === courseId);
        if (!course?.lessons?.length) return null;
        const people = view.people;
        const modules = (course.modules || []).map((m) => {
            const started = people.filter((p) => (p.perModule || {})[m.id]).length;
            const finished = people.filter((p) => ((p.perModule || {})[m.id] || 0) >= m.sections).length;
            const avg = people.length ? Math.round(people.reduce((n, p) => n + pct(Math.min((p.perModule || {})[m.id] || 0, m.sections), m.sections), 0) / people.length) : 0;
            return { ...m, started, finished, avg };
        });
        // Lesson counts come from the server for everyone in scope; with a state
        // chosen they are counted again from the learners' "on lesson".
        const onLesson = {};
        people.forEach((p) => { const id = (p.at || {})[courseId]; if (id) onLesson[id] = (onLesson[id] || 0) + 1; });
        const scoped = !state;
        const order = course.lessons.map((l) => l.id);
        const lessons = course.lessons.map((l, i) => {
            const finished = scoped ? l.done : people.filter((p) => {
                const at = (p.at || {})[courseId];
                if ((p.perCourse[courseId] || 0) >= course.sections) return true;
                return at ? order.indexOf(at) > i : false;
            }).length;
            return { ...l, finished, here: onLesson[l.id] || 0, percent: pct(finished, people.length) };
        });
        return { course, modules, lessons, people: people.length };
    }, [view, report, courseId, state]);

    const stateLabel = (s) => (s ? getLocalizedStateName(s, i18n.language) : t('imnci_ui.progress.no_state', 'No state set'));
    const statusLabel = {
        not_started: t('imnci_ui.progress.not_started', 'Not started'),
        started: t('imnci_ui.progress.started', 'In progress'),
        completed: t('imnci_ui.progress.completed', 'Finished'),
        quiet: t('imnci_ui.progress.quiet', 'Quiet {{n}}+ days', { n: QUIET_DAYS }),
    };
    const lessonTitle = (cid, id) => report?.courses.find((c) => c.id === cid)?.lessons?.find((l) => l.id === id)?.title || '';
    const exportCsv = () => {
        const cs = courseId ? report.courses.filter((c) => c.id === courseId) : report.courses;
        const head = [t('imnci_ui.progress.name', 'Name'), 'Email', t('imnci_ui.progress.state', 'State'), t('imnci_ui.progress.locality', 'Locality'),
            ...cs.flatMap((c) => [`${c.title} (${c.sections})`, `${c.title}: ${t('imnci_ui.progress.on_lesson', 'On lesson')}`]),
            t('imnci_ui.progress.progress', 'Progress'), t('imnci_ui.progress.status', 'Status'), t('imnci_ui.progress.last_active', 'Last active')];
        const rows = view.listed.map((p) => [p.name, p.email, stateLabel(p.state), p.locality,
            ...cs.flatMap((c) => [p.perCourse[c.id] || 0, lessonTitle(c.id, (p.at || {})[c.id])]),
            `${p.percent}%`, statusLabel[p.status], p.lastActive ? new Date(p.lastActive).toISOString().slice(0, 10) : '']);
        downloadCsv(`online-course-progress-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows]);
    };
    const date = (ms) => (ms ? new Date(ms).toLocaleDateString(i18n.language?.startsWith('ar') ? 'ar' : 'en-GB') : '—');

    if (error) {
        return (
            <Card><CardBody className="space-y-3 text-center py-10">
                <p className="text-slate-600">{error}</p>
                <Button variant="secondary" onClick={load}><RefreshCw size={16} />{t('imnci_ui.progress.retry', 'Try again')}</Button>
            </CardBody></Card>
        );
    }
    if (!view) return <SkeletonTable rows={6} columns={4} />;

    const scope = report.scope.level === 'all' ? '' : report.scope.level === 'state'
        ? stateLabel(report.scope.state) : report.scope.locality;
    const states = [...new Set(report.learners.map((l) => l.state))].sort();

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col text-sm">
                    <span className="mb-1 text-slate-600">{t('imnci_ui.progress.course', 'Course')}</span>
                    <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-md border border-slate-300 p-2">
                        <option value="">{t('imnci_ui.progress.all_courses', 'All courses')}</option>
                        {report.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </label>
                {states.length > 1 && (
                    <label className="flex flex-col text-sm">
                        <span className="mb-1 text-slate-600">{t('imnci_ui.progress.state', 'State')}</span>
                        <select value={state} onChange={(e) => setState(e.target.value)} className="rounded-md border border-slate-300 p-2">
                            <option value="">{t('imnci_ui.progress.all_states', 'All states')}</option>
                            {states.map((s) => <option key={s} value={s}>{stateLabel(s)}</option>)}
                        </select>
                    </label>
                )}
                <Button variant="secondary" onClick={exportCsv} disabled={!view.listed.length} className="ms-auto">
                    <Download size={16} />{t('imnci_ui.progress.download', 'Download')}
                </Button>
                <Button variant="secondary" onClick={load} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{t('imnci_ui.progress.refresh', 'Refresh')}
                </Button>
            </div>
            {scope && <p className="text-xs text-slate-500">{t('imnci_ui.progress.scope', 'Showing the people of {{place}}', { place: scope })}</p>}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Kpi icon={Users} label={t('imnci_ui.progress.people', 'People')} value={view.people.length} />
                <Kpi icon={PlayCircle} label={t('imnci_ui.progress.started_kpi', 'Started')} value={view.started} sub={`${pct(view.started, view.people.length)}%`} />
                <Kpi icon={CheckCircle2} label={t('imnci_ui.progress.completed_kpi', 'Finished')} value={view.completed} sub={`${pct(view.completed, view.people.length)}%`} />
                <Kpi icon={PlayCircle} label={t('imnci_ui.progress.average', 'Average done')} value={`${view.average}%`} sub={t('imnci_ui.progress.of_lessons', 'of {{n}} lessons', { n: view.total })} />
                <Kpi icon={Moon} label={statusLabel.quiet} value={view.quiet} sub={t('imnci_ui.progress.quiet_sub', 'started, not finished')} />
            </div>

            {detail && detail.modules.length > 0 && (
                <Card><CardBody>
                    <h3 className="mb-2 font-semibold text-slate-800">{t('imnci_ui.progress.by_module', 'By module')}</h3>
                    <Table headers={[t('imnci_ui.progress.module', 'Module'), t('imnci_ui.progress.lessons', 'Lessons'), t('imnci_ui.progress.started_kpi', 'Started'), t('imnci_ui.progress.completed_kpi', 'Finished'), t('imnci_ui.progress.average', 'Average done')]}>
                        {detail.modules.map((m) => (
                            <tr key={m.id}>
                                <td className="font-medium">{m.title}</td>
                                <td className="tabular-nums">{m.sections}</td>
                                <td className="tabular-nums">{m.started} ({pct(m.started, detail.people)}%)</td>
                                <td className="tabular-nums">{m.finished} ({pct(m.finished, detail.people)}%)</td>
                                <td><Bar value={m.avg} /></td>
                            </tr>
                        ))}
                    </Table>
                </CardBody></Card>
            )}

            {detail && (
                <Card><CardBody>
                    <h3 className="font-semibold text-slate-800">{t('imnci_ui.progress.by_lesson', 'Where learners stop')}</h3>
                    <p className="mb-3 text-xs text-slate-500">{t('imnci_ui.progress.by_lesson_note', 'Each lesson in order: the share of people who finished it, and how many are on it now.')}</p>
                    <div className="space-y-3">
                        {(detail.modules.length ? detail.modules : [{ id: '', title: '' }]).map((m) => {
                            const ls = detail.lessons.filter((l) => !m.id || l.moduleId === m.id);
                            return (
                                <div key={m.id || 'all'}>
                                    {m.title && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{m.title}</div>}
                                    <ol className="space-y-1">
                                        {ls.map((l) => (
                                            <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_5rem] items-center gap-x-3 text-sm">
                                                <span className="truncate text-slate-700" title={l.title}>{l.title}</span>
                                                <span className="hidden sm:block"><Bar value={l.percent} /></span>
                                                <span className="text-end text-xs tabular-nums text-slate-500">
                                                    <span className="sm:hidden">{l.percent}% · </span>
                                                    {l.here > 0 && (
                                                        <span className="inline-flex items-center gap-0.5 text-sky-700" title={t('imnci_ui.progress.here_now', 'On this lesson now')}>
                                                            <MapPin size={11} />{l.here}
                                                        </span>
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            );
                        })}
                    </div>
                </CardBody></Card>
            )}

            {!courseId && report.courses.length > 1 && (
                <Card><CardBody>
                    <h3 className="mb-2 font-semibold text-slate-800">{t('imnci_ui.progress.by_course', 'By course')}</h3>
                    <Table headers={[t('imnci_ui.progress.course', 'Course'), t('imnci_ui.progress.started_kpi', 'Started'), t('imnci_ui.progress.completed_kpi', 'Finished')]}>
                        {report.courses.map((c) => {
                            const people = view.people;
                            const started = people.filter((p) => p.perCourse[c.id]).length;
                            const done = people.filter((p) => (p.perCourse[c.id] || 0) >= c.sections).length;
                            return (
                                <tr key={c.id}>
                                    <td>{c.title}</td>
                                    <td className="tabular-nums">{started} ({pct(started, people.length)}%)</td>
                                    <td className="tabular-nums">{done} ({pct(done, people.length)}%)</td>
                                </tr>
                            );
                        })}
                    </Table>
                </CardBody></Card>
            )}

            {view.byState.length > 1 && (
                <Card><CardBody>
                    <h3 className="mb-2 font-semibold text-slate-800">{t('imnci_ui.progress.by_state', 'By state')}</h3>
                    <Table headers={[t('imnci_ui.progress.state', 'State'), t('imnci_ui.progress.people', 'People'), t('imnci_ui.progress.started_kpi', 'Started'), t('imnci_ui.progress.completed_kpi', 'Finished'), t('imnci_ui.progress.average', 'Average done')]}>
                        {view.byState.map((g) => (
                            <tr key={g.state || '-'} className="cursor-pointer" onClick={() => setState(g.state)}>
                                <td>{stateLabel(g.state)}</td>
                                <td className="tabular-nums">{g.people}</td>
                                <td className="tabular-nums">{g.started}</td>
                                <td className="tabular-nums">{g.completed}</td>
                                <td><Bar value={Math.round(g.sum / g.people)} /></td>
                            </tr>
                        ))}
                    </Table>
                </CardBody></Card>
            )}

            <Card><CardBody>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{t('imnci_ui.progress.learners', 'Learners')}</h3>
                    <div className="flex rounded-md border border-slate-300 overflow-hidden text-sm">
                        {['', 'not_started', 'started', 'completed', 'quiet'].map((s) => (
                            <button key={s || 'all'} onClick={() => setStatus(s)}
                                className={`px-2.5 py-1 ${status === s ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                                {s ? statusLabel[s] : t('imnci_ui.progress.everyone', 'Everyone')}
                            </button>
                        ))}
                    </div>
                    <div className="relative ms-auto">
                        <Search size={15} className="absolute start-2 top-2.5 text-slate-400" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('imnci_ui.progress.search', 'Search a name')}
                            className="rounded-md border border-slate-300 py-1.5 ps-7 pe-2 text-sm" />
                    </div>
                </div>
                <Table cardsOnPhone headers={[t('imnci_ui.progress.name', 'Name'), t('imnci_ui.progress.place', 'Place'), t('imnci_ui.progress.progress', 'Progress'), courseId ? t('imnci_ui.progress.on_lesson', 'On lesson') : t('imnci_ui.progress.status', 'Status'), t('imnci_ui.progress.last_active', 'Last active')]}>
                    {view.listed.length === 0 ? (
                        <EmptyState message={t('imnci_ui.progress.nobody', 'Nobody here yet.')} filtered={!!(status || query)} onClearFilters={() => { setStatus(''); setQuery(''); }} />
                    ) : view.listed.slice(0, 300).map((p) => (
                        <tr key={p.uid} className="cursor-pointer hover:bg-sky-50/60" onClick={() => setOpenUid(p.uid)}>
                            <td><div className="font-medium text-sky-800">{p.name || '—'}</div><div className="text-xs text-slate-500" dir="ltr">{p.email}</div></td>
                            <td>{[stateLabel(p.state), p.locality].filter(Boolean).join(' – ')}</td>
                            <td><Bar value={p.percent} /><div className="text-xs text-slate-500 tabular-nums">{p.done}/{view.total}</div></td>
                            <td>
                                {courseId && (p.at || {})[courseId] ? <span className="text-sm">{lessonTitle(courseId, p.at[courseId])}</span> : statusLabel[p.status]}
                                {p.quiet && <div className="text-xs text-amber-700">{statusLabel.quiet}</div>}
                            </td>
                            <td className="tabular-nums">{date(p.lastActive)}</td>
                        </tr>
                    ))}
                </Table>
                {view.listed.length > 300 && (
                    <p className="text-xs text-slate-500">{t('imnci_ui.progress.more', '{{n}} more; search or filter to find them.', { n: view.listed.length - 300 })}</p>
                )}
            </CardBody></Card>

            {openUid && (() => {
                const p = view.people.find((x) => x.uid === openUid);
                return p ? <LearnerPanel person={p} report={report} onClose={() => setOpenUid(null)}
                    stateLabel={stateLabel} statusLabel={statusLabel} date={date} lessonTitle={lessonTitle} /> : null;
            })()}
        </div>
    );
}

/** One learner, course by course and module by module. */
function LearnerPanel({ person: p, report, onClose, stateLabel, statusLabel, date, lessonTitle }) {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose} role="dialog" aria-modal="true">
            <div className="h-full w-full max-w-md overflow-y-auto bg-white p-4 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-slate-900">{p.name || '—'}</h3>
                        <div className="text-xs text-slate-500" dir="ltr">{p.email}</div>
                        <div className="text-sm text-slate-600">{[stateLabel(p.state), p.locality].filter(Boolean).join(' – ')}</div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label={t('imnci_ui.progress.close', 'Close')}><X size={18} /></button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>{statusLabel[p.status]}</span>
                    {p.quiet && <span className="text-amber-700">{statusLabel.quiet}</span>}
                    <span>{t('imnci_ui.progress.last_active', 'Last active')}: {date(p.lastActive)}</span>
                </div>
                {report.courses.map((c) => {
                    const done = p.perCourse[c.id] || 0;
                    const at = (p.at || {})[c.id];
                    return (
                        <div key={c.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                            <div className="font-semibold text-slate-800">{c.title}</div>
                            <Bar value={pct(done, c.sections)} />
                            <div className="text-xs text-slate-500">
                                {t('imnci_ui.progress.lessons_done', '{{done}} of {{total}} lessons finished', { done, total: c.sections })}
                                {(p.startedPerCourse || {})[c.id] ? ` · ${t('imnci_ui.progress.n_started', '{{n}} started', { n: p.startedPerCourse[c.id] })}` : ''}
                            </div>
                            {at && <div className="text-sm"><MapPin size={13} className="inline text-sky-700" /> {t('imnci_ui.progress.on_lesson', 'On lesson')}: <span className="font-medium">{lessonTitle(c.id, at)}</span></div>}
                            {(c.modules || []).length > 0 && (
                                <ul className="space-y-1.5 pt-1">
                                    {c.modules.map((m) => {
                                        const n = Math.min((p.perModule || {})[m.id] || 0, m.sections);
                                        return (
                                            <li key={m.id} className="text-xs">
                                                <div className="flex justify-between gap-2 text-slate-600">
                                                    <span className="truncate">{m.title}</span>
                                                    <span className="tabular-nums shrink-0">{n}/{m.sections}</span>
                                                </div>
                                                <Bar value={pct(n, m.sections)} />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
