// src/components/imnci/onlineCourses/CourseLinkBlock.jsx
//
// A link from one course to a module or lesson of another, used by the
// facilitator guide to open the learner's module it is talking about.
//
//   { type: 'courselink', course: 'IMNCI distance learning modules',
//     module: 3, lesson: 'Count the breaths: does the child have fast breathing?',
//     label: 'Open Module 3', text: 'What to check with the participant here.' }
//
// Ids are not known when a course file is written, so the course is found by
// its title, the module by its number (its order) and the lesson by its title.
// A link whose target is not in the app yet says so instead of breaking.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { useCourseScreen } from './screen';

const live = (x) => x && x.isDeleted !== true;
const norm = (s) => String(s || '').trim().toLowerCase();

function resolveIn(course, block, items) {
    const modules = items.filter((i) => live(i) && i.kind === 'module' && i.courseId === course.id);
    const n = Number(block.module);
    const module = modules.find((m) => Number(m.order) === n)
        || modules.find((m) => new RegExp(`^module\\s+${n}\\b`, 'i').test(String(m.title || '')))
        || null;
    const section = module && block.lesson
        ? items.find((i) => live(i) && i.kind === 'section' && i.moduleId === module.id && norm(i.title) === norm(block.lesson)) || null
        : null;
    return { course, module, section, found: !!module && (!block.lesson || !!section) };
}

/**
 * The course, module and lesson a link points to, from what is loaded.
 * Several courses can share a title (an older import, a draft upload): the
 * one that holds the module and lesson wins, a published one before a draft.
 */
export function resolveCourseLink(block, courses = [], items = []) {
    const same = courses.filter(live).filter((c) => norm(c.title) === norm(block.course))
        .sort((a, b) => (b.isPublished === true) - (a.isPublished === true));
    if (!same.length) return { course: null, module: null, section: null };
    const tried = same.map((c) => resolveIn(c, block, items));
    const best = tried.find((r) => r.found) || tried.find((r) => r.module) || tried[0];
    return { course: best.course, module: best.module, section: best.section };
}

export default function CourseLinkBlock({ block }) {
    const { t } = useTranslation();
    const screen = useCourseScreen();
    const { course, module, section } = resolveCourseLink(block, screen?.allCourses || [], screen?.allItems || []);
    const found = !!module && (!block.lesson || !!section);
    const where = [
        block.module ? t('imnci_ui.courses.link.module_n', 'Module {{n}}', { n: block.module }) : null,
        block.lesson || null,
    ].filter(Boolean).join(' · ');
    const open = () => {
        if (!found || !screen?.go) return;
        screen.openFromGuide?.({ moduleId: module.id, sectionId: section?.id || null });
        screen.go({ course: course.id, module: module.id, section: section?.id || null, tab: 'read', book: null });
    };
    return (
        <div className="not-prose my-4" data-testid="course-link" data-found={found ? 'true' : 'false'}>
            <button type="button" onClick={open} disabled={!found}
                className="w-full text-start flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 hover:bg-indigo-100 hover:border-indigo-300 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-indigo-50/70 transition-colors">
                <span className="w-9 h-9 rounded-lg bg-white border border-indigo-200 text-indigo-700 grid place-items-center shrink-0">
                    <BookOpen size={17} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                        {block.label || t('imnci_ui.courses.link.open', 'Open in the learners\' course')}
                    </span>
                    {where && <span className="block font-semibold text-slate-900 truncate">{where}</span>}
                    {block.text && <span className="block text-sm text-slate-600">{block.text}</span>}
                    {!found && (
                        <span className="block text-xs text-slate-500 mt-0.5">
                            {t('imnci_ui.courses.link.missing', 'This part of "{{course}}" is not in the app yet.', { course: block.course || '' })}
                        </span>
                    )}
                </span>
                {found && <ArrowUpRight size={18} className="text-indigo-700 shrink-0 rtl:-scale-x-100" />}
            </button>
        </div>
    );
}
