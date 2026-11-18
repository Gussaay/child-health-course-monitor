// src/components/imnci/onlineCourses/CourseList.jsx
//
// The learner's first page: the courses, grouped by category and subcategory
// like the face-to-face courses, and their own progress. Writing courses,
// enrolment, groups and everyone's progress are on the separate Manage online
// courses page (ManageHome.jsx), so nothing here is a manager's tool.
import React, { Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen, GraduationCap, Layers, RefreshCw, TrendingUp, Lock, Clock, Unlock, Users, Settings2,
} from 'lucide-react';
import { Card, CardBody, PageHeader, Button, Spinner, PageTabs } from '../../CommonComponents';
import { notify } from '../../dialogs';
import { MyProgress } from './lazyParts';
import { useCourseScreen } from './screen';
import { groupCourses } from './categories';
import { canStudy, groupName } from './enrolment';

export function CourseList() {
    const { t } = useTranslation();
    const { courses, openOtherArea, permissions, resync, setTopTab, syncing, topTab } = useCourseScreen();
    const shownTab = topTab === 'mine' ? 'mine' : 'courses';
    return (
        <div className="space-y-4">
            <PageHeader
                title={t('imnci_ui.courses.main.page_title', 'Online Courses')}
                subtitle={t('imnci_ui.courses.main.page_subtitle', 'Self-paced training')}
                actions={
                    <div className="flex flex-wrap gap-2 items-center">
                        <Button variant="secondary" onClick={resync} disabled={syncing}
                            title={t('imnci_ui.courses.main.refresh_title', 'Look for anything added on another device')}>
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">{syncing ? t('imnci_ui.courses.main.checking', 'Checking…') : t('imnci_ui.courses.main.refresh', 'Refresh')}</span>
                        </Button>
                        {permissions.canManageOnlineLearners && openOtherArea && (
                            <Button variant="secondary" onClick={openOtherArea}
                                title={t('imnci_ui.manage.open', 'Manage online courses')}>
                                <Settings2 size={16} /> <span className="hidden sm:inline">{t('imnci_ui.manage.open_short', 'Manage')}</span>
                            </Button>
                        )}
                    </div>
                }
            />
            <PageTabs active={shownTab} onChange={setTopTab} tabs={[
                { id: 'courses', label: t('imnci_ui.courses.main.tab_courses', 'Courses'), icon: GraduationCap },
                { id: 'mine', label: t('imnci_ui.my_progress.tab', 'My progress'), short: t('imnci_ui.my_progress.tab_short', 'Mine'), icon: TrendingUp },
            ]} />
            {shownTab === 'mine'
                ? <Suspense fallback={<Spinner />}><MyProgress /></Suspense>
                : courses.length === 0 ? (
                    <Card><CardBody className="text-center py-12 text-slate-500">
                        <BookOpen size={32} className="mx-auto mb-3 text-slate-400" />
                        <div className="font-medium text-slate-700">{t('imnci_ui.courses.main.no_courses', 'No courses yet')}</div>
                    </CardBody></Card>
                ) : <GroupedCourses render={(c) => <LearnerCourseCard key={c.id} course={c} />} />}
        </div>
    );
}

/**
 * The courses under their category and subcategory headings, with a row of
 * category chips to show one category. `render(course)` draws each card.
 */
export function GroupedCourses({ render, list }) {
    const { t } = useTranslation();
    const { courses } = useCourseScreen();
    const groups = useMemo(() => groupCourses(list || courses), [list, courses]);
    const [only, setOnly] = useState('');
    const shown = only ? groups.filter((g) => g.category === only) : groups;
    const chip = (active) => `px-3 py-1.5 rounded-full text-sm font-semibold border whitespace-nowrap ${active ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-300 hover:border-sky-400'}`;
    return (
        <div className="space-y-6">
            {groups.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
                    <button className={chip(!only)} onClick={() => setOnly('')}>{t('imnci_ui.categories.all', 'All')}</button>
                    {groups.map((g) => (
                        <button key={g.category} className={chip(only === g.category)} onClick={() => setOnly(g.category)}>
                            {g.category === 'Other' ? t('imnci_ui.categories.other', 'Other') : g.category}
                        </button>
                    ))}
                </div>
            )}
            {shown.map((g) => (
                <section key={g.category} className="space-y-3" data-testid="course-category">
                    <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                        <span className="w-1.5 h-5 rounded-full bg-sky-600" />
                        {g.category === 'Other' ? t('imnci_ui.categories.other', 'Other') : g.category}
                    </h2>
                    {g.subgroups.map((sg) => (
                        <div key={sg.subcategory || '_'} className="space-y-2">
                            {sg.subcategory && <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">{sg.subcategory}</h3>}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {sg.courses.map(render)}
                            </div>
                        </div>
                    ))}
                </section>
            ))}
        </div>
    );
}

// The course's numbers: modules, lessons, and how far this learner has got.
export function CourseCardBody({ course: c, children, badge }) {
    const { t } = useTranslation();
    const { items, progress } = useCourseScreen();
    const secs = items.filter((i) => i.kind === 'section' && i.courseId === c.id);
    const mods = items.filter((i) => i.kind === 'module' && i.courseId === c.id);
    const done = secs.filter((s) => progress.completed?.[s.id]).length;
    const pct = secs.length ? Math.round((done / secs.length) * 100) : 0;
    return (
        <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-sky-300 transition flex flex-col">
            <div className="p-4 flex flex-col flex-1 gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-lg bg-sky-50 text-sky-700 grid place-items-center shrink-0">
                        <BookOpen size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800 flex items-start gap-2 flex-wrap">
                            <span className="min-w-0">{c.title}</span>
                            {badge}
                        </h3>
                        {c.description && <p className="text-sm text-slate-600 line-clamp-2 mt-0.5">{c.description}</p>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Layers size={13} /> {t('imnci_ui.courses.main.n_modules', '{{n}} modules', { n: mods.length })}</span>
                    <span className="inline-flex items-center gap-1"><BookOpen size={13} /> {t('imnci_ui.courses.main.n_lessons', '{{n}} lessons', { n: secs.length })}</span>
                </div>
                {secs.length > 0 && done > 0 && (
                    <div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            {t('imnci_ui.courses.main.card_progress_lessons', '{{done}} of {{total}} lessons complete', { done, total: secs.length })}
                        </div>
                    </div>
                )}
                <div className="flex gap-2 mt-auto pt-1">{children({ done })}</div>
            </div>
        </div>
    );
}

function LearnerCourseCard({ course: c }) {
    const { t } = useTranslation();
    const { accessOf, enrolments, go, isArabic } = useCourseScreen();
    const [busy, setBusy] = useState(false);
    const access = accessOf(c);
    const mine = enrolments.byCourse[c.id];
    const group = mine?.status === 'approved' ? enrolments.groupById[mine.groupId] : null;
    const open = () => go({ course: c.id, module: null, section: null, book: null, tab: 'read' });
    const ask = async () => {
        setBusy(true);
        try {
            const res = await enrolments.request(c.id);
            notify(res?.status === 'open'
                ? t('imnci_ui.enrol.is_open', 'This course is open. You can start now.')
                : t('imnci_ui.enrol.requested_note', 'Your request was sent. A manager will approve it.'), 'success');
        } catch (e) {
            console.error(e);
            notify(t('imnci_ui.enrol.request_failed', 'Could not send your request. Check your connection and try again.'), 'error');
        } finally { setBusy(false); }
    };
    const badge = access === 'open'
        ? <Pill tone="open"><Unlock size={11} /> {t('imnci_ui.enrol.open', 'Open')}</Pill>
        : access === 'requested' ? <Pill tone="wait"><Clock size={11} /> {t('imnci_ui.enrol.waiting', 'Waiting for approval')}</Pill>
            : access === 'none' || access === 'declined' ? <Pill tone="lock"><Lock size={11} /> {t('imnci_ui.enrol.needs_enrolment', 'Enrolment needed')}</Pill>
                : null;
    return (
        <CourseCardBody course={c} badge={badge}>
            {({ done }) => (
                <div className="flex-1 space-y-2">
                    {group && (
                        <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                            <Users size={12} /> {groupName(group, isArabic)}
                            {group.facilitator?.name && <> · {t('imnci_ui.groups.facilitator', 'Facilitator')}: {group.facilitator.name}</>}
                        </div>
                    )}
                    {canStudy(access) ? (
                        <Button className="w-full justify-center" onClick={open}>
                            {done ? t('imnci_ui.courses.main.continue', 'Continue') : t('imnci_ui.courses.main.start', 'Start')}
                        </Button>
                    ) : access === 'requested' ? (
                        <Button variant="secondary" className="w-full justify-center" onClick={open}>{t('imnci_ui.enrol.see_request', 'See request')}</Button>
                    ) : (
                        <Button className="w-full justify-center" onClick={ask} disabled={busy}>
                            {busy ? t('imnci_ui.enrol.sending', 'Sending…') : t('imnci_ui.enrol.ask', 'Ask to join')}
                        </Button>
                    )}
                </div>
            )}
        </CourseCardBody>
    );
}

const PILL = {
    open: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    wait: 'bg-amber-50 text-amber-800 border-amber-200',
    lock: 'bg-slate-100 text-slate-600 border-slate-200',
    draft: 'bg-amber-100 text-amber-900 border-amber-200',
};
export function Pill({ tone, children }) {
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold shrink-0 ${PILL[tone]}`}>{children}</span>;
}
