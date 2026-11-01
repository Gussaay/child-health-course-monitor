// src/components/imnci/onlineCourses/ProgressDashboard.jsx
//
// Managers' view of the online courses: who has started and finished each
// course, by state and by person. Each learner's progress is private in the
// database, so it comes from the onlineProgressReport function, which also
// limits a state or locality manager to their own people.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { RefreshCw, Users, PlayCircle, CheckCircle2, Search } from 'lucide-react';

import { Card, CardBody, Button, Table, EmptyState, SkeletonTable } from '../../CommonComponents';
import { getLocalizedStateName } from '../../constants';
import { STATUS_COLORS } from '../../../utils/statusColors';

const loadReport = () => httpsCallable(getFunctions(), 'onlineProgressReport', { timeout: 70000 })({});

const pct = (n, d) => (d ? Math.round((n * 100) / d) : 0);

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

    const load = () => {
        setLoading(true);
        setError('');
        loadReport()
            .then(({ data }) => setReport(data))
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
                return { ...l, done, percent: pct(done, total), status: finished ? 'completed' : done ? 'started' : 'not_started' };
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
            .filter((p) => !status || p.status === status)
            .filter((p) => !q || `${p.name} ${p.email} ${p.locality}`.toLowerCase().includes(q))
            .sort((a, b) => b.percent - a.percent || (b.lastActive || 0) - (a.lastActive || 0));
        return {
            total, people, listed,
            started: people.filter((p) => p.status !== 'not_started').length,
            completed: people.filter((p) => p.status === 'completed').length,
            average: people.length ? Math.round(people.reduce((n, p) => n + p.percent, 0) / people.length) : 0,
            byState: [...byState.values()].sort((a, b) => b.people - a.people),
        };
    }, [report, courseId, state, status, query]);

    const stateLabel = (s) => (s ? getLocalizedStateName(s, i18n.language) : t('imnci_ui.progress.no_state', 'No state set'));
    const statusLabel = {
        not_started: t('imnci_ui.progress.not_started', 'Not started'),
        started: t('imnci_ui.progress.started', 'In progress'),
        completed: t('imnci_ui.progress.completed', 'Finished'),
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
                <Button variant="secondary" onClick={load} disabled={loading} className="ms-auto">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{t('imnci_ui.progress.refresh', 'Refresh')}
                </Button>
            </div>
            {scope && <p className="text-xs text-slate-500">{t('imnci_ui.progress.scope', 'Showing the people of {{place}}', { place: scope })}</p>}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi icon={Users} label={t('imnci_ui.progress.people', 'People')} value={view.people.length} />
                <Kpi icon={PlayCircle} label={t('imnci_ui.progress.started_kpi', 'Started')} value={view.started} sub={`${pct(view.started, view.people.length)}%`} />
                <Kpi icon={CheckCircle2} label={t('imnci_ui.progress.completed_kpi', 'Finished')} value={view.completed} sub={`${pct(view.completed, view.people.length)}%`} />
                <Kpi icon={PlayCircle} label={t('imnci_ui.progress.average', 'Average done')} value={`${view.average}%`} sub={t('imnci_ui.progress.of_sections', 'of {{n}} sections', { n: view.total })} />
            </div>

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
                        {['', 'not_started', 'started', 'completed'].map((s) => (
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
                <Table cardsOnPhone headers={[t('imnci_ui.progress.name', 'Name'), t('imnci_ui.progress.place', 'Place'), t('imnci_ui.progress.progress', 'Progress'), t('imnci_ui.progress.status', 'Status'), t('imnci_ui.progress.last_active', 'Last active')]}>
                    {view.listed.length === 0 ? (
                        <EmptyState message={t('imnci_ui.progress.nobody', 'Nobody here yet.')} filtered={!!(status || query)} onClearFilters={() => { setStatus(''); setQuery(''); }} />
                    ) : view.listed.slice(0, 300).map((p) => (
                        <tr key={p.uid}>
                            <td><div className="font-medium">{p.name || '—'}</div><div className="text-xs text-slate-500" dir="ltr">{p.email}</div></td>
                            <td>{[stateLabel(p.state), p.locality].filter(Boolean).join(' – ')}</td>
                            <td><Bar value={p.percent} /><div className="text-xs text-slate-500 tabular-nums">{p.done}/{view.total}</div></td>
                            <td>{statusLabel[p.status]}</td>
                            <td className="tabular-nums">{date(p.lastActive)}</td>
                        </tr>
                    ))}
                </Table>
                {view.listed.length > 300 && (
                    <p className="text-xs text-slate-500">{t('imnci_ui.progress.more', '{{n}} more; search or filter to find them.', { n: view.listed.length - 300 })}</p>
                )}
            </CardBody></Card>
        </div>
    );
}
