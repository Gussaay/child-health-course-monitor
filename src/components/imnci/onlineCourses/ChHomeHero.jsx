// src/components/imnci/onlineCourses/ChHomeHero.jsx
//
// The ch-sudan learner home hero — the design refresh modelled on the
// BNMB banking app: a deep navy gradient with a soft bloom, a greeting,
// the learner's overall progress ring and streak, a one-tap Continue
// button, and four frosted-glass stat tiles that open My progress.
// CourseList renders it only on the ch-sudan site and its Android app
// (IS_CH_SITE); the main monitor site keeps its plain header, and the
// numbers come from the same learnerSummary() as My progress, so the
// hero can never disagree with it.
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, CalendarDays, CheckCircle2, Flame, PlayCircle, Target } from 'lucide-react';
import { useCourseScreen } from './screen';
import { learnerSummary } from './learnerProgress';
import { greetingKey, heroStats } from './chHero';

function ProgressRing({ pct }) {
    const r = 50;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative shrink-0" style={{ width: 116, height: 116 }} role="img" aria-label={`${pct}%`}>
            <svg width={116} height={116} className="-rotate-90">
                <circle cx={58} cy={58} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={11} />
                {pct > 0 && (
                    <circle cx={58} cy={58} r={r} fill="none" stroke="#6ee7b7" strokeWidth={11} strokeLinecap="round"
                        strokeDasharray={`${(c * pct) / 100} ${c}`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
                )}
            </svg>
            <div className="absolute inset-0 grid place-items-center">
                <span className="text-3xl font-extrabold tabular-nums">{pct}<span className="text-base">%</span></span>
            </div>
        </div>
    );
}

function GlassTile({ icon: Icon, value, label, onClick }) {
    return (
        <button type="button" onClick={onClick} className="ch-glass rounded-2xl px-1 py-2.5 text-center text-white transition hover:bg-white/15">
            <Icon size={17} className="mx-auto text-sky-300" />
            <div className="tabular-nums mt-0.5 truncate text-sm font-extrabold">{value}</div>
            <div className="truncate text-[11px] text-white/70">{label}</div>
        </button>
    );
}

export function ChHomeHero() {
    const { t } = useTranslation();
    const { courses, items, progress, go, user, setTopTab, isArabic } = useCourseScreen();
    const summary = useMemo(() => learnerSummary({ courses, items, progress }), [courses, items, progress]);
    const stats = heroStats(summary);
    const name = (user?.displayName || '').trim();
    const gk = greetingKey();
    const greeting = t(`imnci_ui.ch_hero.${gk}`, gk === 'greeting_morning' ? 'Good morning' : 'Good evening');
    const cont = stats.continueCourse;
    const resume = () => {
        if (!cont) return;
        if (cont.next) go({ course: cont.id, module: cont.next.moduleId, section: cont.next.id, book: null, tab: 'read' });
        else go({ course: cont.id, module: null, section: null, book: null, tab: 'read' });
    };
    const toMine = () => { if (setTopTab) setTopTab('mine'); };

    return (
        <section className="ch-hero overflow-hidden rounded-3xl p-5 text-white sm:p-6" data-testid="ch-home-hero">
            <p className="text-sm text-white/70">{t('imnci_ui.ch_hero.tagline', 'Your training, in one place')}</p>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight">
                {greeting}{name ? `${isArabic ? '، ' : ', '}${name}` : ''}
            </h2>

            <div className="mt-5 flex items-center gap-5">
                <ProgressRing pct={stats.pct} />
                <div className="min-w-0 space-y-3">
                    <div>
                        <p className="text-sm text-white/70">{t('imnci_ui.ch_hero.overall', 'Overall progress')}</p>
                        <p className="flex items-center gap-1.5 text-lg font-bold">
                            <Flame size={18} className="text-amber-300" />
                            {t('imnci_ui.my_progress.streak', 'Days in a row')}: <span className="tabular-nums">{stats.streak}</span>
                        </p>
                    </div>
                    {cont && (
                        <button type="button" onClick={resume}
                            className="flex max-w-full items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-start font-bold text-slate-900 shadow-sm transition hover:bg-slate-100">
                            <PlayCircle size={20} className="shrink-0 text-emerald-600" />
                            <span className="min-w-0">
                                <span className="block text-sm leading-tight">
                                    {stats.lessonsDone
                                        ? t('imnci_ui.ch_hero.continue', 'Continue learning')
                                        : t('imnci_ui.ch_hero.start', 'Start learning')}
                                </span>
                                <span className="block truncate text-xs font-medium text-slate-500">{cont.title}</span>
                            </span>
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
                <GlassTile icon={CheckCircle2} onClick={toMine}
                    value={`${stats.lessonsDone}/${stats.lessonsTotal}`}
                    label={t('imnci_ui.my_progress.lessons', 'Lessons finished')} />
                <GlassTile icon={Target} onClick={toMine}
                    value={`${stats.activitiesDone}/${stats.activities}`}
                    label={t('imnci_ui.my_progress.activities', 'Activities done')} />
                <GlassTile icon={CalendarDays} onClick={toMine}
                    value={stats.thisWeek}
                    label={t('imnci_ui.my_progress.this_week', 'Lessons this week')} />
                <GlassTile icon={Award} onClick={toMine}
                    value={stats.coursesDone}
                    label={t('imnci_ui.ch_hero.courses_done', 'Courses finished')} />
            </div>
        </section>
    );
}
