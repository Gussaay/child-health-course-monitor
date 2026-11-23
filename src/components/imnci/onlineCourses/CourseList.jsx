// src/components/imnci/onlineCourses/CourseList.jsx
//
// The learner's first page: the courses, grouped by category and subcategory
// like the face-to-face courses, and their own progress. Writing courses,
// enrolment, groups and everyone's progress are on the separate Manage online
// courses page (ManageHome.jsx), so nothing here is a manager's tool.
import React, { Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen, GraduationCap, Layers, TrendingUp, Lock, Clock, Unlock, Users, Settings2, ArrowLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardBody, PageHeader, Button, Spinner, PageTabs, IS_NATIVE, useInPageBack } from '../../CommonComponents';
import { useFormTitle } from '../../../utils/pageChrome';
import { notify } from '../../dialogs';
import { MyProgress, ChHomeHero } from './lazyParts';
import { useCourseScreen } from './screen';
import { groupCourses } from './categories';
import { areaOf, coursesByArea } from './areas';
import { canStudy, groupName } from './enrolment';
import { IS_CH_SITE } from '../../../siteMode';

export function CourseList() {
    const { t } = useTranslation();
    const { courses, openOtherArea, permissions, setTopTab, topTab } = useCourseScreen();
    const shownTab = topTab === 'mine' ? 'mine' : 'courses';
    return (
        <div className="space-y-4">
            {IS_CH_SITE && (<Suspense fallback={null}><ChHomeHero /></Suspense>)}
            <PageHeader
                title={t('imnci_ui.courses.main.page_title', 'Online Courses')}
                subtitle={t('imnci_ui.courses.main.page_subtitle', 'Self-paced training')}
                actions={permissions.canManageOnlineLearners && openOtherArea ? (
                    <div className="flex flex-wrap gap-2 items-center">
                        {permissions.canManageOnlineLearners && openOtherArea && (
                            <Button variant="secondary" onClick={openOtherArea}
                                title={t('imnci_ui.manage.open', 'Manage online courses')}>
                                <Settings2 size={16} /> <span className="hidden sm:inline">{t('imnci_ui.manage.open_short', 'Manage')}</span>
                            </Button>
                        )}
                    </div>
                ) : null}
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

// The service page open, kept in the address (?area=newborn) so the back
// button returns to the services and a course opened from it returns to it.
function useAreaPlace() {
    const read = () => new URLSearchParams(window.location.search).get('area') || '';
    const [area, setArea] = useState(read);
    useEffect(() => {
        const onPop = () => setArea(read());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
    const open = useCallback((id) => {
        const url = new URL(window.location.href);
        url.searchParams.set('area', id);
        const st = window.history.state || {};
        window.history.pushState({ ...st, chmIdx: (st.chmIdx || 0) + 1, areaPushed: true }, '', url);
        setArea(id);
        window.scrollTo(0, 0);
    }, []);
    const close = useCallback(() => {
        if (window.history.state?.areaPushed) { window.history.back(); return; }
        const url = new URL(window.location.href);
        url.searchParams.delete('area');
        window.history.replaceState(window.history.state, '', url);
        setArea('');
    }, []);
    return [area, open, close];
}

// Course cards drawn as rows of a list (the service page) rather than tiles.
const RowLayout = React.createContext(false);

// The ch-sudan refresh gives each service its own colour, used for the
// icon tint on that site only; the main site keeps the slate chip.
const AREA_COLORS = { imnci: '#0284c7', etat: '#dc2626', newborn: '#db2777', adolescent: '#16a34a', program: '#7c3aed', other: '#475569' };

/**
 * The services (areas.js) and their courses, one page each:
 *   the services page: a card per service with its icon and full name
 *     (IMNCI, ETAT, Newborn, Adolescent, Program Management);
 *   a service page (?area=...): its own page, with a back arrow, listing that
 *     service's courses as rows with the course picture.
 * `render(course)` draws each course.
 */
export function GroupedCourses({ render, list }) {
    const { t } = useTranslation();
    const { courses } = useCourseScreen();
    const areas = useMemo(() => coursesByArea(list || courses), [list, courses]);
    const [chosen, open, close] = useAreaPlace();
    const name = (a) => t(`imnci_ui.areas.${a.id}.short`, a.short);
    const full = (a) => t(`imnci_ui.areas.${a.id}.full`, a.full);
    const current = areas.find((x) => x.area.id === chosen && x.courses.length) || null;
    // In the Android app the top bar names the open service and its arrow
    // (and the phone's back button) returns to the services.
    useFormTitle(current ? name(current.area) : '', '', IS_NATIVE && !!current);
    useInPageBack(close, IS_NATIVE && !!current);

    if (current) {
        const { area, courses: cs } = current;
        const sorted = groupCourses(cs).flatMap((g) => g.subgroups.flatMap((sg) => sg.courses));
        return (
            <div className="space-y-4" data-testid="service-page">
                {/* The Android app's top bar names the service and has the back
                    arrow; the web page draws them once here. */}
                {IS_NATIVE ? (
                    <p className="text-sm text-slate-500">{full(area)} · {t('imnci_ui.areas.n_courses', '{{count}} courses', { count: cs.length })}</p>
                ) : (
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={close} aria-label={t('imnci_ui.areas.back', 'All services')}
                            className="w-10 h-10 rounded-full border border-slate-200 bg-white grid place-items-center text-slate-700 hover:border-slate-400 shrink-0">
                            <ArrowLeft size={18} className="rtl:-scale-x-100" />
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-slate-900 leading-tight">{name(area)}</h2>
                            <p className="text-sm text-slate-500">{full(area)} · {t('imnci_ui.areas.n_courses', '{{count}} courses', { count: cs.length })}</p>
                        </div>
                    </div>
                )}
                <RowLayout.Provider value>
                    <div className="space-y-3" data-testid="service-course-list">{sorted.map(render)}</div>
                </RowLayout.Provider>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500">{t('imnci_ui.areas.services', 'Services')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="course-areas">
                {areas.map(({ area, courses: cs }) => {
                    const Icon = area.icon;
                    const color = AREA_COLORS[area.id] || AREA_COLORS.other;
                    return (
                        <button key={area.id} type="button" data-testid="course-area"
                            onClick={() => open(area.id)} disabled={!cs.length}
                            className="text-start rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-400 disabled:opacity-50 disabled:hover:border-slate-200 flex flex-col">
                            <span className="w-11 h-11 rounded-lg grid place-items-center bg-slate-100 text-slate-700"
                                style={IS_CH_SITE ? { backgroundColor: `${color}1A`, color } : undefined}>
                                <Icon size={24} strokeWidth={1.75} />
                            </span>
                            <span className="block mt-3 text-base font-bold text-slate-900 leading-tight">{name(area)}</span>
                            <span className="block text-xs text-slate-500 leading-snug mt-0.5 flex-1">{full(area)}</span>
                            <span className="mt-2 flex items-center justify-between text-xs font-medium text-slate-600">
                                {cs.length ? t('imnci_ui.areas.n_courses', '{{count}} courses', { count: cs.length }) : t('imnci_ui.areas.soon', 'Coming soon')}
                                {cs.length > 0 && <ChevronRight size={16} className="text-slate-400 rtl:-scale-x-100" />}
                            </span>
                        </button>
                    );
                })}
            </div>
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
    const area = areaOf(c);
    const AreaIcon = area.icon;
    const row = useContext(RowLayout);
    if (row) {
        // A row of the service page: the course picture (or the service icon) on the
        // left, its name, sub-course, size, progress and action on the right.
        return (
            <div className="rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition p-3 sm:p-4 flex gap-3 sm:gap-4" data-testid="course-row">
                <div className="w-24 h-24 sm:w-40 sm:h-28 rounded-lg overflow-hidden bg-slate-100 shrink-0 grid place-items-center">
                    {c.imageUrl
                        ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        : <AreaIcon size={40} strokeWidth={1.5} className="text-slate-500" />}
                </div>
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    {c.subcategory && <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 break-words">{c.subcategory}</span>}
                    <h3 className="font-bold text-slate-900 leading-snug break-words">{c.title}</h3>
                    {c.description && <p className="hidden sm:block text-sm text-slate-600 line-clamp-2">{c.description}</p>}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><Layers size={13} /> {t('imnci_ui.courses.main.n_modules', '{{n}} modules', { n: mods.length })}</span>
                        <span className="inline-flex items-center gap-1"><BookOpen size={13} /> {t('imnci_ui.courses.main.n_lessons', '{{n}} lessons', { n: secs.length })}</span>
                        {badge}
                    </div>
                    {secs.length > 0 && done > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex-1 max-w-xs">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{pct}%</span>
                        </div>
                    )}
                    <div className="flex gap-2 mt-auto pt-1 max-w-sm">{children({ done })}</div>
                </div>
            </div>
        );
    }
    return (
        <div className="rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition flex flex-col" data-testid="course-card">
            {/* The course's area colour and icon, with its full name. */}
            <div className="px-4 pt-4 flex items-start gap-3">
                {c.imageUrl
                    ? <img src={c.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0" />
                    : <span className="w-12 h-12 rounded-lg bg-slate-100 text-slate-700 grid place-items-center shrink-0"><AreaIcon size={26} strokeWidth={1.75} /></span>}
                <div className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 break-words">{c.subcategory || t(`imnci_ui.areas.${area.id}.short`, area.short)}</span>
                    <h3 className="font-bold text-base text-slate-900 leading-snug break-words">{c.title}</h3>
                </div>
            </div>
            <div className="p-4 flex flex-col flex-1 gap-3">
                {(badge || c.description) && (
                    <div className="min-w-0 space-y-1.5">
                        {badge && <div className="flex flex-wrap gap-1.5">{badge}</div>}
                        {c.description && <p className="text-sm text-slate-600 line-clamp-3">{c.description}</p>}
                    </div>
                )}
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
