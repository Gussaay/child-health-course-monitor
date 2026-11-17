// src/components/imnci/onlineCourses/MyProgress.jsx
//
// "My progress": every learner's own dashboard. For each course, how far they
// are, what comes next, and every module and lesson with its state (done,
// started, open or locked), with each open lesson one tap away. Worked out on
// the device from the learner's own record (see learnerProgress.js), so it
// needs no server call and works offline.
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, CheckCircle2, Flame, Lock, PlayCircle, Target, Clock, CalendarDays } from 'lucide-react';

import { Card, CardBody, Button } from '../../CommonComponents';
import { useCourseScreen } from './screen';
import { learnerSummary } from './learnerProgress';

const TONE = {
    done: 'bg-emerald-500 border-emerald-500 text-white',
    started: 'bg-amber-100 border-amber-400 text-amber-800',
    open: 'bg-white border-slate-300 text-slate-500',
    locked: 'bg-slate-100 border-slate-200 text-slate-300',
};

function Kpi({ icon: Icon, label, value, sub }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Icon size={14} />{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
            {sub && <div className="text-xs text-slate-500">{sub}</div>}
        </div>
    );
}

function Bar({ value, className = 'h-2' }) {
    return (
        <div className={`${className} flex-1 rounded-full bg-slate-100 overflow-hidden`}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${value}%` }} />
        </div>
    );
}

/** Lessons finished per week, the last eight weeks, as small columns. */
function Weeks({ weeks, label }) {
    const max = Math.max(1, ...weeks);
    return (
        <div aria-label={label} title={label}>
            <div className="flex items-end gap-1 h-10">
                {weeks.map((n, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end h-full">
                        <div className={`rounded-sm ${i === weeks.length - 1 ? 'bg-sky-600' : 'bg-sky-300'}`}
                            style={{ height: `${Math.max(n ? 12 : 4, (n * 100) / max)}%`, opacity: n ? 1 : 0.35 }}
                            title={String(n)} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function MyProgress() {
    const { t, i18n } = useTranslation();
    const { courses, items, progress, go, duration } = useCourseScreen();
    const summary = useMemo(() => learnerSummary({ courses, items, progress }), [courses, items, progress]);

    const statusLabel = {
        done: t('imnci_ui.my_progress.status_done', 'Done'),
        started: t('imnci_ui.my_progress.status_started', 'In progress'),
        open: t('imnci_ui.my_progress.status_open', 'Not started'),
        locked: t('imnci_ui.my_progress.status_locked', 'Locked'),
    };
    const date = (ms) => (ms ? new Date(ms).toLocaleDateString(i18n.language?.startsWith('ar') ? 'ar' : 'en-GB') : '—');
    const openLesson = (courseId, l) => go({ course: courseId, module: l.moduleId, section: l.id, book: null, tab: 'read' });
    const openModule = (courseId, m) => go({ course: courseId, module: m.id, section: null, book: null, tab: 'read' });

    if (!summary.courses.length) {
        return (
            <Card><CardBody className="text-center py-12 text-slate-500">
                <BookOpen size={32} className="mx-auto mb-3 text-slate-400" />
                {t('imnci_ui.my_progress.empty', 'Your progress shows here once a course has lessons.')}
            </CardBody></Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi icon={CheckCircle2} label={t('imnci_ui.my_progress.lessons', 'Lessons finished')}
                    value={`${summary.lessonsDone}/${summary.lessonsTotal}`}
                    sub={`${summary.lessonsTotal ? Math.round((summary.lessonsDone * 100) / summary.lessonsTotal) : 0}%`} />
                <Kpi icon={Target} label={t('imnci_ui.my_progress.activities', 'Activities done')}
                    value={`${summary.activitiesDone}/${summary.activities}`} />
                <Kpi icon={CalendarDays} label={t('imnci_ui.my_progress.this_week', 'Lessons this week')} value={summary.thisWeek}
                    sub={t('imnci_ui.my_progress.last_active', 'Last active {{date}}', { date: date(summary.lastActive) })} />
                <Kpi icon={Flame} label={t('imnci_ui.my_progress.streak', 'Days in a row')} value={summary.streak}
                    sub={summary.streak ? t('imnci_ui.my_progress.keep_going', 'Keep it going!') : t('imnci_ui.my_progress.start_streak', 'Finish a lesson today to start')} />
            </div>

            <Card><CardBody>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-800 text-sm">{t('imnci_ui.my_progress.weeks', 'Lessons finished, last 8 weeks')}</h3>
                    <span className="text-xs text-slate-500">{t('imnci_ui.my_progress.this_week_short', 'This week: {{n}}', { n: summary.thisWeek })}</span>
                </div>
                <Weeks weeks={summary.weeks} label={t('imnci_ui.my_progress.weeks', 'Lessons finished, last 8 weeks')} />
            </CardBody></Card>

            {summary.courses.map((c) => (
                <Card key={c.id}><CardBody className="space-y-4">
                    <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-800">{c.title}</h3>
                            <div className="mt-2 flex items-center gap-3">
                                <Bar value={c.percent} className="h-2.5" />
                                <span className="text-sm font-semibold tabular-nums text-slate-700">{c.percent}%</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span>{t('imnci_ui.my_progress.n_lessons', '{{done}} of {{total}} lessons', { done: c.done, total: c.total })}</span>
                                <span>{t('imnci_ui.my_progress.n_modules', '{{done}} of {{total}} modules', { done: c.modulesDone, total: c.modules.length })}</span>
                                {c.minutesLeft > 0 && (
                                    <span className="inline-flex items-center gap-1"><Clock size={12} />{t('imnci_ui.my_progress.left', 'About {{time}} left', { time: duration ? duration(c.minutesLeft) : `${c.minutesLeft} min` })}</span>
                                )}
                            </div>
                        </div>
                        {c.next ? (
                            <Button onClick={() => openLesson(c.id, c.next)} className="max-w-full">
                                <PlayCircle size={16} />
                                <span className="truncate">
                                    {c.done ? t('imnci_ui.my_progress.continue', 'Continue: {{title}}', { title: c.next.title })
                                        : t('imnci_ui.my_progress.start', 'Start: {{title}}', { title: c.next.title })}
                                </span>
                            </Button>
                        ) : c.status === 'done' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                                <CheckCircle2 size={16} />{t('imnci_ui.my_progress.course_done', 'Course finished')}
                            </span>
                        ) : null}
                    </div>

                    <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                        {c.modules.map((m, mi) => (
                            <li key={m.id} className={`p-3 ${m.status === 'locked' ? 'bg-slate-50' : ''}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold shrink-0 border ${TONE[m.status]}`}>
                                        {m.status === 'done' ? <CheckCircle2 size={14} /> : m.status === 'locked' ? <Lock size={12} /> : mi + 1}
                                    </span>
                                    <button type="button" disabled={m.status === 'locked'} onClick={() => openModule(c.id, m)}
                                        className={`min-w-0 flex-1 text-start font-medium ${m.status === 'locked' ? 'text-slate-400 cursor-not-allowed' : 'text-slate-800 hover:text-sky-700'}`}>
                                        {m.title}
                                    </button>
                                    <span className="text-xs text-slate-500 tabular-nums">{m.done}/{m.total}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${TONE[m.status]}`}>{statusLabel[m.status]}</span>
                                </div>
                                {m.status === 'locked' ? (
                                    <p className="mt-1 ms-9 text-xs text-slate-500">
                                        {t('imnci_ui.my_progress.module_locked', 'Opens when you finish {{title}}.', { title: c.modules[mi - 1]?.title || '' })}
                                    </p>
                                ) : (
                                    <>
                                        <div className="mt-2 ms-9 flex items-center gap-2"><Bar value={m.percent} className="h-1.5" /></div>
                                        <div className="mt-2 ms-9 flex flex-wrap gap-1.5">
                                            {m.lessons.map((l, li) => (
                                                <button key={l.id} type="button" disabled={l.status === 'locked'}
                                                    onClick={() => openLesson(c.id, l)}
                                                    title={`${li + 1}. ${l.title} · ${statusLabel[l.status]}${l.activities ? ` · ${l.activitiesDone}/${l.activities}` : ''}`}
                                                    aria-label={`${li + 1}. ${l.title}: ${statusLabel[l.status]}`}
                                                    className={`h-7 min-w-[1.75rem] px-1 rounded-md border text-[11px] font-semibold tabular-nums ${TONE[l.status]} ${l.status === 'locked' ? 'cursor-not-allowed' : 'hover:ring-2 hover:ring-sky-300'}`}>
                                                    {l.status === 'locked' ? <Lock size={10} className="mx-auto" /> : li + 1}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </li>
                        ))}
                    </ol>
                </CardBody></Card>
            ))}

            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {['done', 'started', 'open', 'locked'].map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                        <span className={`inline-block w-3.5 h-3.5 rounded border ${TONE[s]}`} />{statusLabel[s]}
                    </span>
                ))}
            </div>
        </div>
    );
}
