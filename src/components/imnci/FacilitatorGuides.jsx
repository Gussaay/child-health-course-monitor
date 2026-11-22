// ============================================================================
// FACILITATOR GUIDES
//
// Protocol & Course Management > a service > Facilitator guide.
//
// A facilitator guide is a guideline, not a course: it tells the facilitator of
// a real (face-to-face or online) course how to run it, day by day. It is read
// here like a book, word for word as printed: a contents list of its chapters
// and sections, one chapter on the page at a time, a search over the whole
// guide, previous / next chapter, print, a reading size, and the place the
// facilitator was last reading. No enrolment, progress or activities.
//
// The guide is stored as a document with audience "facilitators" (so the same
// upload and editing tools serve it) and never appears in a learner's list.
//
// A service whose courses have no guide document still has the notes kept in
// its lessons for the facilitator (the course timetable, "From your
// facilitator" prompts): those are listed lesson by lesson under the guides.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronDown, ChevronRight, ChevronLeft, ArrowUpRight, Users, CalendarClock,
    Search, Printer, List, X, ArrowUp, Minus, Plus, BookMarked,
} from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Plain text of a block, for the search: every string it holds but links,
// picture paths and the block's type.
// ---------------------------------------------------------------------------
const SKIP_KEYS = new Set(['type', 'url', 'path', 'src', 'imageUrl', 'id', 'script', 'course', 'module', 'lesson']);
export function blockText(b) {
    const out = [];
    const walk = (v, k) => {
        if (v == null || SKIP_KEYS.has(k)) return;
        if (typeof v === 'string') out.push(v);
        else if (Array.isArray(v)) v.forEach((x) => walk(x));
        else if (typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, kk));
    };
    walk(b);
    return out.join(' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

/** The guide as chapters (its modules) of sections, each with its blocks and text. */
export function guideOutline(course, items = []) {
    const mods = items.filter((i) => live(i) && i.kind === 'module' && i.courseId === course.id).sort(byOrder);
    return mods.map((m, mi) => {
        const sections = items.filter((i) => live(i) && i.kind === 'section' && i.courseId === course.id && i.moduleId === m.id)
            .sort(byOrder).map((s) => {
                const blocks = sectionContent(s);
                return { id: s.id, title: s.title, blocks, text: blocks.map(blockText).join(' ') };
            });
        return { id: m.id, number: mi + 1, title: m.title, sections };
    }).filter((c) => c.sections.length);
}

/** Search hits over a guide outline: [{ chapter, section, snippet }], at most `limit`. */
export function searchGuide(outline, query, limit = 60) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const words = q.split(/\s+/).filter(Boolean);
    const hits = [];
    outline.forEach((ch) => ch.sections.forEach((s) => {
        const hay = `${s.title} ${s.text}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return;
        const at = Math.max(0, s.text.toLowerCase().indexOf(words[0]));
        const start = Math.max(0, at - 70);
        const snippet = (start > 0 ? '…' : '') + s.text.slice(start, at + 150) + (at + 150 < s.text.length ? '…' : '');
        hits.push({ chapter: ch, section: s, snippet });
    }));
    return hits.slice(0, limit);
}

// The reader's place lives in the address (fg = guide, ch = chapter, fsec =
// section), so a link, refresh and the back button keep it.
const readParams = () => {
    const p = new URLSearchParams(window.location.search);
    return { fg: p.get('fg') || '', ch: p.get('ch') || '', fsec: p.get('fsec') || '' };
};
function useGuidePlace() {
    const [place, setPlace] = useState(readParams);
    useEffect(() => {
        const onPop = () => setPlace(readParams());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
    const go = useCallback((patch, { push = true } = {}) => {
        setPlace((cur) => {
            const next = { ...cur, ...patch };
            const url = new URL(window.location.href);
            Object.entries(next).forEach(([k, v]) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k)));
            const state = window.history.state || {};
            if (push) window.history.pushState({ ...state, chmIdx: (state.chmIdx || 0) + 1 }, '', url);
            else window.history.replaceState(state, '', url);
            return next;
        });
    }, []);
    return [place, go];
}

const remember = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };
const recall = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };

/** Prints a part of the page in its own window, so it can also be saved as a PDF. */
function printNode(title, node) {
    if (!node) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const css = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('');
    const safe = String(title).replace(/[<>&]/g, '');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe}</title>${css}</head><body style="background:#fff;padding:16px">${node.innerHTML}</body></html>`);
    w.document.close();
    w.addEventListener('load', () => { w.focus(); w.print(); });
}

// `category`: only the guides of one service (IMNCI, ETAT, Small & Sick
// Newborn ...); none shows every service.
export default function FacilitatorGuides({ category = '' }) {
    const { t } = useTranslation();
    const { onlineCourses, fetchOnlineCourses, onlineCourseItems, fetchOnlineCourseItems, isLoading } = useDataCache();
    useEffect(() => {
        if (!onlineCourses) fetchOnlineCourses(false);
        if (!onlineCourseItems) fetchOnlineCourseItems(false);
    }, [onlineCourses, onlineCourseItems, fetchOnlineCourses, fetchOnlineCourseItems]);

    const allCourses = useMemo(() => onlineCourses || [], [onlineCourses]);
    const courses = useMemo(() => allCourses.filter((c) => !category || categoryOf(c) === category), [allCourses, category]);
    const items = useMemo(() => dropReplacedLeftovers(onlineCourseItems || []), [onlineCourseItems]);
    const found = useMemo(() => guideCourses(courses, items), [courses, items]);
    const guides = found.filter((g) => g.isGuide);
    const noted = found.filter((g) => !g.isGuide);
    const [place, go] = useGuidePlace();
    // With one guide and nothing else, the guide opens straight away; otherwise the list comes first.
    const sole = guides.length === 1 && noted.length === 0;
    const current = guides.find((g) => g.course.id === place.fg) || (sole ? guides[0] : null);

    // Course links inside a guide ("the learners' lesson") open Online Courses.
    const screen = useMemo(() => ({
        allCourses, allItems: items,
        go: (p) => openLesson({ course: p.course, module: p.module, section: p.section }),
    }), [allCourses, items]);

    if ((isLoading?.onlineCourses && !onlineCourses) || (isLoading?.onlineCourseItems && !onlineCourseItems)) {
        return <div className="p-6 text-center text-slate-500">{t('clinical_ui.guides.loading', 'Loading the guides…')}</div>;
    }
    if (!found.length) {
        return <div className="p-6 text-center text-slate-500" data-testid="facilitator-guides-empty">{t('clinical_ui.guides.none_service', 'No facilitator guide for this service yet.')}</div>;
    }

    return (
        <CourseScreen.Provider value={screen}>
            <div className="space-y-5" data-testid="facilitator-guides">
                {current ? (
                    <GuideReader key={current.course.id} course={current.course} items={items}
                        place={place} go={go} onAllGuides={sole ? null : () => go({ fg: '', ch: '', fsec: '' })} />
                ) : guides.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-base font-bold text-slate-900">{t('clinical_ui.guides.pick', 'Choose a facilitator guide')}</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {guides.map((g) => (
                                <button key={g.course.id} type="button" onClick={() => go({ fg: g.course.id, ch: '', fsec: '' })} data-testid="guide-card"
                                    className="text-start rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-400 hover:shadow-sm flex gap-3">
                                    <span className="w-10 h-10 rounded-lg bg-sky-50 text-sky-700 grid place-items-center shrink-0"><BookMarked size={20} /></span>
                                    <span className="min-w-0">
                                        <span className="block font-bold text-slate-900">{g.course.title}</span>
                                        {g.course.description && <span className="block text-xs text-slate-500 mt-1 line-clamp-3">{g.course.description}</span>}
                                        {!g.course.isPublished && <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-slate-400">{t('clinical_ui.guides.draft', 'draft')}</span>}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {noted.length > 0 && !current && <LessonNotes guides={noted} items={items} />}
            </div>
        </CourseScreen.Provider>
    );
}

// ---------------------------------------------------------------------------
// The reader
// ---------------------------------------------------------------------------
export function GuideReader({ course, items, place, go, onAllGuides = null, kicker = null, actions = null }) {
    const { t } = useTranslation();
    const outline = useMemo(() => guideOutline(course, items), [course, items]);
    const lastKey = `guidePlace:${course.id}`;
    const [query, setQuery] = useState('');
    const [contentsOpen, setContentsOpen] = useState(false);
    const [scale, setScaleState] = useState(() => Number(recall('guideFontScale')) || 1);
    const setScale = (s) => { const v = Math.min(1.6, Math.max(0.8, Math.round(s * 10) / 10)); setScaleState(v); remember('guideFontScale', v); };
    const pageRef = useRef(null);

    // The chapter on the page: the address, else where this facilitator last read, else the first.
    const last = useMemo(() => recall(lastKey), [lastKey]);
    const chapter = outline.find((c) => c.id === place.ch) || outline.find((c) => c.id === last?.ch) || outline[0] || null;
    const idx = chapter ? outline.indexOf(chapter) : -1;
    useEffect(() => { if (chapter) remember(lastKey, { ch: chapter.id, fsec: place.fsec || '' }); }, [chapter, place.fsec, lastKey]);

    // Opening a section scrolls to it; opening another chapter goes to its top. The guide's
    // first opening stays where it is, with its search and contents in view (unless a link
    // named a section).
    const opened = useRef(false);
    useEffect(() => {
        const el = place.fsec && document.getElementById(`fg-sec-${place.fsec}`);
        if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        else if (opened.current) pageRef.current?.scrollIntoView({ block: 'start' });
        opened.current = true;
    }, [chapter?.id, place.fsec]);

    const openSection = (ch, s = null) => { setQuery(''); setContentsOpen(false); go({ fg: course.id, ch: ch.id, fsec: s?.id || '' }); };
    const hits = useMemo(() => searchGuide(outline, query), [outline, query]);
    const total = outline.reduce((n, c) => n + c.sections.length, 0);

    if (!outline.length) return <div className="p-6 text-center text-slate-500">{t('clinical_ui.guides.empty_guide', 'This guide has no content yet.')}</div>;

    const contents = (
        <nav aria-label={t('clinical_ui.guides.contents', 'Contents')} className="text-sm" data-testid="guide-contents">
            <ol className="space-y-0.5">
                {outline.map((c) => {
                    const on = c.id === chapter?.id;
                    return (
                        <li key={c.id}>
                            <button type="button" onClick={() => openSection(c)} aria-current={on ? 'true' : undefined}
                                className={`w-full text-start px-2 py-1.5 rounded-lg flex gap-2 items-start ${on ? 'bg-sky-100 text-sky-900 font-bold' : 'text-slate-700 hover:bg-slate-100'}`}>
                                <span className="w-6 shrink-0 text-xs font-bold text-slate-400 pt-0.5">{c.number}</span>
                                <span className="flex-1">{c.title}</span>
                                {on ? <ChevronDown size={14} className="mt-1 shrink-0" /> : <ChevronRight size={14} className="mt-1 shrink-0 rtl:-scale-x-100" />}
                            </button>
                            {on && c.sections.length > 1 && (
                                <ol className="ms-8 my-1 border-s border-slate-200">
                                    {c.sections.map((s) => (
                                        <li key={s.id}>
                                            <button type="button" onClick={() => openSection(c, s)}
                                                className={`w-full text-start ps-3 pe-2 py-1 text-[13px] ${place.fsec === s.id ? 'text-sky-800 font-semibold' : 'text-slate-600 hover:text-sky-700'}`}>
                                                {s.title === c.title ? t('clinical_ui.guides.overview', 'Overview') : s.title}
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );

    return (
        <div className="space-y-3" data-testid="guide-reader">
            {/* Where the facilitator is, always in words: guide, chapter. */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                    <span className="w-10 h-10 rounded-lg bg-sky-50 text-sky-700 grid place-items-center shrink-0"><BookMarked size={20} /></span>
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700">{kicker || t('clinical_ui.guides.kicker', 'Facilitator guide · how to run the course')}</div>
                        <h3 className="font-bold text-slate-900 text-lg leading-snug">{course.title}</h3>
                        <div className="text-xs text-slate-500">{t('clinical_ui.guides.size', '{{c}} chapters · {{s}} sections', { c: outline.length, s: total })}</div>
                    </div>
                    {actions}
                    {onAllGuides && (
                        <button type="button" onClick={onAllGuides} className="text-sm font-semibold text-sky-700 hover:underline">
                            {t('clinical_ui.guides.all', 'All guides and notes of this service')}
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="relative flex-1 min-w-[12rem]">
                        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
                        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="guide-search"
                            placeholder={t('clinical_ui.guides.search', 'Search the whole guide')}
                            className="w-full ps-9 pe-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-sky-500 focus:ring-sky-500" />
                    </label>
                    <button type="button" onClick={() => setContentsOpen((o) => !o)} aria-expanded={contentsOpen}
                        className="lg:hidden px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <List size={16} /> {t('clinical_ui.guides.contents', 'Contents')}
                    </button>
                    <div className="flex items-center rounded-lg border border-slate-300 bg-white">
                        <button type="button" onClick={() => setScale(scale - 0.1)} className="px-2 py-2 text-slate-600" title={t('clinical_ui.guides.smaller', 'Smaller text')}><Minus size={15} /></button>
                        <span className="text-xs font-semibold text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
                        <button type="button" onClick={() => setScale(scale + 0.1)} className="px-2 py-2 text-slate-600" title={t('clinical_ui.guides.larger', 'Larger text')}><Plus size={15} /></button>
                    </div>
                    <button type="button" onClick={() => printNode(`${course.title} · ${chapter?.title}`, pageRef.current)}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <Printer size={16} /> <span className="hidden sm:inline">{t('clinical_ui.guides.print_chapter', 'Print this chapter')}</span>
                    </button>
                </div>
                {contentsOpen && <div className="lg:hidden border-t border-slate-200 pt-2 max-h-[60vh] overflow-y-auto">{contents}</div>}
            </div>

            <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-4 items-start">
                <aside className="hidden lg:block sticky top-2 max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('clinical_ui.guides.contents', 'Contents')}</div>
                    {contents}
                </aside>

                <div className="min-w-0">
                    {query.trim().length >= 2 ? (
                        <div className="rounded-xl border border-slate-200 bg-white" data-testid="guide-results">
                            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-700">{t('clinical_ui.guides.results', '{{n}} places found', { n: hits.length })}</div>
                                <button type="button" onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-800"><X size={16} /></button>
                            </div>
                            {hits.length === 0
                                ? <div className="p-6 text-center text-slate-500 text-sm">{t('clinical_ui.guides.no_results', 'Nothing in this guide matches.')}</div>
                                : <ul className="divide-y divide-slate-100">
                                    {hits.map((h) => (
                                        <li key={h.section.id}>
                                            <button type="button" onClick={() => openSection(h.chapter, h.section)} className="w-full text-start px-4 py-3 hover:bg-slate-50">
                                                <div className="text-xs font-semibold text-sky-700">{h.chapter.number}. {h.chapter.title}</div>
                                                <div className="font-semibold text-slate-900">{h.section.title}</div>
                                                <div className="text-sm text-slate-600 mt-0.5">{h.snippet}</div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>}
                        </div>
                    ) : chapter && (
                        <article className="rounded-xl border border-slate-200 bg-white" data-testid="guide-chapter">
                            <div ref={pageRef} className="p-4 sm:p-6 scroll-mt-2">
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {t('clinical_ui.guides.chapter_n', 'Chapter {{n}} of {{total}}', { n: chapter.number, total: outline.length })}
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 mt-1">{chapter.title}</h2>
                                {chapter.sections.map((s, i) => (
                                    <section key={s.id} id={`fg-sec-${s.id}`} className="scroll-mt-3 mt-6" data-testid="guide-section">
                                        {s.title !== chapter.title && (
                                            <h3 className="text-lg font-bold text-sky-900 border-b border-slate-200 pb-1 mb-2">
                                                <span className="text-slate-400 me-2">{chapter.number}.{i + 1}</span>{s.title}
                                            </h3>
                                        )}
                                        <ContentBlocks blocks={s.blocks} scale={scale} />
                                    </section>
                                ))}
                            </div>
                            <div className="border-t border-slate-200 p-3 grid grid-cols-2 gap-2">
                                {idx > 0 ? (
                                    <button type="button" onClick={() => openSection(outline[idx - 1])} className="text-start rounded-lg border border-slate-200 p-3 hover:border-sky-400">
                                        <div className="text-xs text-slate-500 flex items-center gap-1"><ChevronLeft size={13} className="rtl:-scale-x-100" /> {t('clinical_ui.guides.previous', 'Previous chapter')}</div>
                                        <div className="text-sm font-semibold text-slate-800 line-clamp-2">{outline[idx - 1].title}</div>
                                    </button>
                                ) : <span />}
                                {idx < outline.length - 1 ? (
                                    <button type="button" onClick={() => openSection(outline[idx + 1])} className="text-end rounded-lg border border-slate-200 p-3 hover:border-sky-400" data-testid="guide-next">
                                        <div className="text-xs text-slate-500 flex items-center justify-end gap-1">{t('clinical_ui.guides.next', 'Next chapter')} <ChevronRight size={13} className="rtl:-scale-x-100" /></div>
                                        <div className="text-sm font-semibold text-slate-800 line-clamp-2">{outline[idx + 1].title}</div>
                                    </button>
                                ) : <span />}
                            </div>
                            <div className="px-3 pb-3 flex justify-center">
                                <button type="button" onClick={() => pageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                    className="text-xs font-semibold text-slate-500 hover:text-sky-700 flex items-center gap-1">
                                    <ArrowUp size={13} /> {t('clinical_ui.guides.top', 'Back to the top of the chapter')}
                                </button>
                            </div>
                        </article>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Notes for the facilitator kept inside the lessons of a learners' course
// ---------------------------------------------------------------------------
function LessonNotes({ guides, items }) {
    const { t } = useTranslation();
    const [chosen, setChosen] = useState(guides[0]?.course.id);
    const current = guides.find((g) => g.course.id === chosen) || guides[0];
    return (
        <div className="space-y-3" data-testid="lesson-notes">
            <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><Users size={17} className="text-slate-500" /> {t('clinical_ui.guides.notes_title', 'Facilitator notes inside the online lessons')}</h3>
                <p className="text-sm text-slate-600">{t('clinical_ui.guides.intro', 'The timetable, the prompts and the drills kept in the lessons for the facilitator, lesson by lesson. Learners do not see these notes.')}</p>
            </div>
            {guides.length > 1 && (
                <select value={current?.course.id} onChange={(e) => setChosen(e.target.value)} className="w-full sm:w-auto rounded-lg border-slate-300 text-sm">
                    {guides.map((g) => <option key={g.course.id} value={g.course.id}>{g.course.title}</option>)}
                </select>
            )}
            {current && <CourseNotes key={current.course.id} guide={current} items={items} />}
        </div>
    );
}

function CourseNotes({ guide, items }) {
    const { t } = useTranslation();
    const { course } = guide;
    const modules = items.filter((i) => live(i) && i.kind === 'module' && i.courseId === course.id).sort(byOrder);
    const sectionsOf = (m) => items.filter((i) => live(i) && i.kind === 'section' && i.courseId === course.id && i.moduleId === m.id).sort(byOrder);
    const [open, setOpen] = useState(() => (modules[0] ? { [modules[0].id]: true } : {}));
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">{t('clinical_ui.guides.notes_count', '{{n}} notes for the facilitator in this course.', { n: guide.notes })}</div>
                <button type="button" onClick={() => openLesson({ course: course.id })} className="text-sm font-semibold text-sky-700 hover:underline flex items-center gap-1">
                    {t('clinical_ui.guides.open_course', 'Open the course')} <ArrowUpRight size={14} className="rtl:-scale-x-100" />
                </button>
            </div>
            {modules.map((m) => {
                const lessons = sectionsOf(m).map((s) => ({ s, notes: facilitatorContent(s) })).filter((x) => x.notes.length);
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
                                            <button type="button" onClick={() => openLesson({ course: course.id, module: m.id, section: s.id })}
                                                className="text-xs font-semibold text-sky-700 hover:underline flex items-center gap-1">
                                                {t('clinical_ui.guides.open_lesson', 'Open the lesson')} <ArrowUpRight size={13} className="rtl:-scale-x-100" />
                                            </button>
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

