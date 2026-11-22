// src/components/imnci/CourseAnnexes.jsx
//
// Protocol & Course Management > a service > Annexes. The material a course's
// lessons open when needed, kept once for every course of the service, like the
// protocol: the standard operating procedures for procedures and equipment, and
// later skill checklists, the chart booklet and other pages. They are not
// courses and learners never see them in a course list; a lesson shows a
// button (lesson editor: "Annex (SOP, checklist)") that opens a page over it.
// Read here like a guide: contents, search, print.
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { useDataCache } from '../../DataContext';
import { dropReplacedLeftovers } from '../../utils/replacedLeftovers';
import { CourseScreen } from './onlineCourses/screen';
import { categoryOf } from './onlineCourses/categories';
import { GuideReader, openLesson } from './FacilitatorGuides';

const live = (x) => x && x.isDeleted !== true;

/** The annexes of a service (course documents with audience "annex"). */
export const serviceAnnexes = (courses = [], category = '') =>
    courses.filter((c) => live(c) && c.audience === 'annex' && (!category || categoryOf(c) === category));

/** Opens an annex in the Course Manager's editor. */
const openInEditor = (courseId) => {
    window.history.pushState({}, '', `/online-courses-manage?oc=${encodeURIComponent(courseId)}`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    window.scrollTo(0, 0);
};

export default function CourseAnnexes({ category = '', canEdit = false }) {
    const { t } = useTranslation();
    const { onlineCourses, fetchOnlineCourses, onlineCourseItems, fetchOnlineCourseItems } = useDataCache();
    useEffect(() => {
        if (!onlineCourses) fetchOnlineCourses(false);
        if (!onlineCourseItems) fetchOnlineCourseItems(false);
    }, [onlineCourses, onlineCourseItems, fetchOnlineCourses, fetchOnlineCourseItems]);
    const allCourses = useMemo(() => onlineCourses || [], [onlineCourses]);
    const items = useMemo(() => dropReplacedLeftovers(onlineCourseItems || []), [onlineCourseItems]);
    const annexes = useMemo(() => serviceAnnexes(allCourses, category), [allCourses, category]);
    const [place, setPlace] = React.useState({ fg: '', ch: '', fsec: '' });
    const go = (p) => setPlace((c) => ({ ...c, ...p }));
    const screen = useMemo(() => ({ allCourses, allItems: items, go: (p) => openLesson({ course: p.course, module: p.module, section: p.section }) }), [allCourses, items]);
    const current = annexes.find((a) => a.id === place.fg) || annexes[0] || null;

    if (!annexes.length) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500" data-testid="annexes-empty">
                {t('protocol_manager.annexes_none', 'No annexes for this service yet. Annexes hold standard operating procedures, skill checklists, chart booklet pages and other material that any course of the service can open from its lessons.')}
            </div>
        );
    }
    return (
        <CourseScreen.Provider value={screen}>
            <div className="space-y-3" data-testid="course-annexes">
                <p className="text-sm text-slate-600">
                    {t('protocol_manager.annexes_intro', 'Shared by every course of this service. A lesson opens a page with a button: in the lesson editor, add "Annex (SOP, checklist)" and pick the page.')}
                </p>
                {annexes.length > 1 && (
                    <select value={current?.id} onChange={(e) => go({ fg: e.target.value, ch: '', fsec: '' })} className="rounded-lg border-slate-300 text-sm">
                        {annexes.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                )}
                {current && (
                    <GuideReader key={current.id} course={current} items={items} place={place} go={go}
                        kicker={t('protocol_manager.annex_kicker', 'Course annex · opened from the lessons')}
                        actions={canEdit ? (
                            <button type="button" onClick={() => openInEditor(current.id)}
                                className="text-sm font-semibold text-sky-700 hover:underline inline-flex items-center gap-1">
                                <Pencil size={14} /> {t('protocol_manager.annex_edit', 'Edit or add pages')}
                            </button>
                        ) : null} />
                )}
            </div>
        </CourseScreen.Provider>
    );
}
