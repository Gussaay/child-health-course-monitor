// ============================================================================
// FACILITATOR GUIDES
//
// Protocol management > Facilitator guides. One place for everything a
// facilitator needs to run a course, online or face to face:
//   - for a learners' course, the notes kept in its lessons for the
//     facilitator (the course timetable, "From your facilitator" prompts,
//     drills to run), lesson by lesson, with a button that opens the lesson;
//   - a facilitator guide written as a course of its own (audience
//     "facilitators", with answer keys and the examination), read in full.
// Learners never see either: the lesson player leaves those notes out
// (book.js, isFacilitatorBlock) and the course list hides guide courses.
// ============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronDown, ChevronRight, ArrowUpRight, Users, CalendarClock } from 'lucide-react';
import { useDataCache } from '../../DataContext';
import { dropReplacedLeftovers } from '../../utils/replacedLeftovers';
import { facilitatorContent, sectionContent } from './book';
import { ContentBlocks } from './onlineCourses/blocks';
import { CourseScreen } from './onlineCourses/screen';
import { searchForPlace } from './onlineCourses/place';
import { categoryOf } from './onlineCourses/categories';

const live = (x) => x && x.isDeleted !== true;
const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || String(a.title || '').localeCompare(String(b.title || ''));

/** Opens a lesson of Online Courses from here, as a link in the app would. */
export function openLesson({ course, module = null, section = null }) {
    const search = searchForPlace({ course, module, section, tab: 'read', book: null });
    window.history.pushState({}, '', `/online-courses?${search}`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    window.scrollTo(0, 0);
}

/** The courses that have something for the facilitator, guides first. */
export function guideCourses(courses = [], items = []) {
    const liveItems = items.filter(live);
    return courses.filter(live).map((c) => {
        const isGuide = c.audience === 'facilitators';
        const sections = liveItems.filter((i) => i.kind === 'section' && i.courseId === c.id);
        const notes = isGuide ? 0 : sections.reduce((n, s) => n + facilitatorContent(s).length, 0);
        return { course: c, isGuide, notes };
    }).filter((g) => g.isGuide || g.notes > 0)
        .sort((a, b) => (b.isGuide - a.isGuide) || byOrder(a.course, b.course));
}

// `category`: only the courses of one service (IMNCI, ETAT, EENC ...), as the
// Protocol Manager shows them; none shows every course.
export default function FacilitatorGuides({ category = '' }) {
    const { t } = useTranslation();
    const { onlineCourses, fetchOnlineCourses, onlineCourseItems, fetchOnlineCourseItems, isLoading } = useDataCache();
    useEffect(() => {
        if (!onlineCourses) fetchOnlineCourses(false);
        if (!onlineCourseItems) fetchOnlineCourseItems(false);
    }, [onlineCourses, onlineCourseItems, fetchOnlineCourses, fetchOnlineCourseItems]);

    const courses = useMemo(() => (onlineCourses || []).filter((c) => !category || categoryOf(c) === category), [onlineCourses, category]);
    const items = useMemo(() => dropReplacedLeftovers(onlineCourseItems || []), [onlineCourseItems]);
    const guides = useMemo(() => guideCourses(courses, items), [courses, items]);
    const [chosen, setChosen] = useState(null);
    const current = guides.find((g) => g.course.id === chosen) || guides[0] || null;

    // Course links inside a guide ("Open in the learners' course") read the
    // courses from the course screen; here they open Online Courses.
    const screen = useMemo(() => ({
        allCourses: courses, allItems: items,
        go: (p) => openLesson({ course: p.course, module: p.module, section: p.section }),
    }), [courses, items]);

    if ((isLoading?.onlineCourses && !onlineCourses) || (isLoading?.onlineCourseItems && !onlineCourseItems)) {
        return <div className="p-6 text-center text-slate-500">{t('clinical_ui.guides.loading', 'Loading the courses…')}</div>;
    }
    if (!guides.length) {
        return <div className="p-6 text-center text-slate-500" data-testid="facilitator-guides-empty">{t('clinical_ui.guides.none', 'No course has facilitator notes yet.')}</div>;
    }

    return (
        <CourseScreen.Provider value={screen}>
            <div className="space-y-4" data-testid="facilitator-guides">
                <p className="text-sm text-slate-600">
                    {t('clinical_ui.guides.intro', 'What the facilitator needs to run each course, online or face to face: the timetable, the prompts and the drills, lesson by lesson. Learners do not see these notes.')}
                </p>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('clinical_ui.guides.courses', 'Courses')}>
                    {guides.map((g) => {
                        const on = current?.course.id === g.course.id;
                        return (
                            <button key={g.course.id} type="button" role="tab" aria-selected={on} onClick={() => setChosen(g.course.id)}
                                className={`px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 ${on ? 'bg-sky-700 border-sky-700 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                                {g.isGuide ? <Users size={15} /> : <BookOpen size={15} />}
                                <span>{g.course.title}</span>
                                {!g.course.isPublished && <span className={`text-[10px] uppercase tracking-wider ${on ? 'text-sky-100' : 'text-slate-400'}`}>{t('clinical_ui.guides.draft', 'draft')}</span>}
                            </button>
                        );
                    })}
                </div>
                {current && <CourseGuide key={current.course.id} guide={current} items={items} />}
            </div>
        </CourseScreen.Provider>
    );
}

function CourseGuide({ guide, items }) {
    const { t } = useTranslation();
    const { course, isGuide } = guide;
    const modules = items.filter((i) => live(i) && i.kind === 'module' && i.courseId === course.id).sort(byOrder);
    const sectionsOf = (m) => items.filter((i) => live(i) && i.kind === 'section' && i.courseId === course.id && i.moduleId === m.id).sort(byOrder);
    const [open, setOpen] = useState(() => (modules[0] ? { [modules[0].id]: true } : {}));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                    {isGuide
                        ? t('clinical_ui.guides.guide_course', 'A facilitator guide, with answer keys. Its links open the learners\' lessons.')
                        : t('clinical_ui.guides.notes_count', '{{n}} notes for the facilitator in this course.', { n: guide.notes })}
                </div>
                <button type="button" onClick={() => openLesson({ course: course.id })}
                    className="text-sm font-semibold text-sky-700 hover:underline flex items-center gap-1">
                    {t('clinical_ui.guides.open_course', 'Open the course')} <ArrowUpRight size={14} className="rtl:-scale-x-100" />
                </button>
            </div>
            {modules.map((m) => {
                const lessons = sectionsOf(m).map((s) => ({ s, notes: isGuide ? sectionContent(s) : facilitatorContent(s) }))
                    .filter((x) => x.notes.length);
                if (!lessons.length) return null;
                const isOpen = !!open[m.id];
                return (
                    <div key={m.id} className="rounded-xl border border-slate-200 bg-white" data-testid="guide-module">
                        <button type="button" onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
                            className="w-full text-start px-4 py-3 flex items-center gap-2 font-bold text-slate-900">
                            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} className="rtl:-scale-x-100" />}
                            <span className="flex-1">{m.title}</span>
                            <span className="text-xs font-semibold text-slate-500">{t('clinical_ui.guides.lessons_n', '{{n}} lessons', { n: lessons.length })}</span>
                        </button>
                        {isOpen && (
                            <div className="border-t border-slate-200 divide-y divide-slate-100">
                                {lessons.map(({ s, notes }) => (
                                    <div key={s.id} className="px-4 py-3" data-testid="guide-lesson">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                <CalendarClock size={15} className="text-slate-400 shrink-0" /> {s.title}
                                            </div>
                                            {!isGuide && (
                                                <button type="button" onClick={() => openLesson({ course: course.id, module: m.id, section: s.id })}
                                                    className="text-xs font-semibold text-sky-700 hover:underline flex items-center gap-1">
                                                    {t('clinical_ui.guides.open_lesson', 'Open the lesson')} <ArrowUpRight size={13} className="rtl:-scale-x-100" />
                                                </button>
                                            )}
                                        </div>
                                        <ContentBlocks blocks={notes} scale={0.95} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
