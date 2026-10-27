// src/components/AiLibraryView.jsx
//
// The AI side of Online Courses: the course books (IMNCI chart booklet, EENC
// and ETAT manuals, guidelines) with AI summaries and questions answered from
// them, and the AI study helper on each course section.
//
// The library (the Books tab of Online Courses) has three pages: the
// services, the books of the chosen service (with a question box across all
// of them), then one book, where a chapter or page range is summarised or
// asked about. Every answer cites the pages it came from. Course authors add a
// book by picking its PDF; the text is read in the browser
// (aiLibrary/bookText.js) and the AI work happens in the aiBooks Cloud
// Function, so no AI key is ever in the app.
//
// Adding a book never changes a course: the book is stored on its own and
// only points at the course (and module) it serves.

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, BookOpen, Plus, Pencil, Trash2, Sparkles, Send, Copy, Loader2, RotateCcw,
    Library, FileText, Upload, AlertTriangle, ChevronRight, X, MessageSquare,
} from 'lucide-react';

import {
    PageHeader, Button, EmptyState, Modal, Input, Select, IS_NATIVE, useInPageBack, SkeletonCard, Tabs,
} from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import { AI_SERVICES, SCANNED_SHARE, readBook, cleanSections, parseAiText } from './aiLibrary/bookText';
import {
    listBooks, addBook, updateBook, setBookDeleted, deleteBookForever,
    listSummaries, deleteSummary, summarise, ask, summariseSection,
} from './aiLibrary/aiLibraryData';

const providerName = (p) => ({ groq: 'Groq', cerebras: 'Cerebras', gemini: 'Gemini' }[p] || p);

const STYLE_KEYS = ['summary', 'key_points', 'teaching', 'quiz'];
const STYLE_FALLBACK = { summary: 'Summary', key_points: 'Key points', teaching: 'Teaching notes', quiz: 'Quiz questions' };

const errorText = (e, t) => e?.message || t('ai_library.failed', 'That did not work. Try again.');

// =============================================================================
// Showing AI text
// =============================================================================

export function AiText({ text }) {
    return (
        <div className="space-y-1.5 text-sm leading-relaxed text-slate-700" dir="auto">
            {parseAiText(text).map((b, i) => {
                const body = b.parts.map((p, j) => {
                    if (p.bold) return <b key={j} className="text-slate-900">{p.text}</b>;
                    if (p.cite) return <span key={j} className="whitespace-nowrap rounded bg-sky-50 px-1 text-xs font-medium text-sky-700">{p.text}</span>;
                    return <span key={j}>{p.text}</span>;
                });
                if (b.type === 'hr') return <hr key={i} className="!my-3 border-slate-200" />;
                if (b.type === 'h') return <p key={i} className="pt-2 font-semibold text-slate-900">{body}</p>;
                if (b.type === 'li') return <p key={i} className={`relative ${b.depth ? 'ps-8 before:start-4' : 'ps-4 before:start-0'} before:absolute before:text-sky-600 before:content-['•']`}>{body}</p>;
                if (b.type === 'ol') return <p key={i} className="relative ps-6"><span className="absolute start-0 font-semibold text-slate-500">{b.n}.</span>{body}</p>;
                return <p key={i}>{body}</p>;
            })}
        </div>
    );
}

function ModelLine({ provider, model, pages }) {
    const { t } = useTranslation();
    if (!model) return null;
    return (
        <p className="mt-2 text-xs text-slate-400">
            {providerName(provider)} · {model}
            {pages ? ` · ${t('ai_library.pages_range', 'pages {{from}}-{{to}}', pages)}` : ''}
        </p>
    );
}

async function copyText(text, t) {
    try {
        await navigator.clipboard.writeText(text);
        notify(t('ai_library.copied', 'Copied'), 'success');
    } catch {
        notify(t('ai_library.copy_failed', 'Could not copy on this device'), 'error');
    }
}

// =============================================================================
// Asking questions
// =============================================================================

export function AskPanel({ scope, title, hint }) {
    const { t, i18n } = useTranslation();
    const [messages, setMessages] = useState([]);
    const [question, setQuestion] = useState('');
    const [busy, setBusy] = useState(false);
    const scopeKey = JSON.stringify(scope);

    // A new chapter or book starts a new conversation.
    useEffect(() => { setMessages([]); }, [scopeKey]);

    const send = async () => {
        const text = question.trim();
        if (!text || busy) return;
        setQuestion('');
        const asked = [...messages, { role: 'user', content: text }];
        setMessages(asked);
        setBusy(true);
        try {
            const data = await ask({
                ...scope, question: text, lang: i18n.language === 'ar' ? 'ar' : 'en',
                messages: messages.filter((m) => !m.failed).map(({ role, content }) => ({ role, content })),
            });
            setMessages([...asked, { role: 'assistant', content: data.text, provider: data.provider, model: data.model, pagesUsed: data.pagesUsed }]);
        } catch (e) {
            setMessages([...asked, { role: 'assistant', content: errorText(e, t), failed: true }]);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <MessageSquare size={18} className="text-sky-600" />
                <h3 className="flex-1 font-semibold text-slate-800">{title}</h3>
                {messages.length > 0 && (
                    <button type="button" onClick={() => setMessages([])} className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-700">
                        <RotateCcw size={14} /> {t('ai_library.new_chat', 'New')}
                    </button>
                )}
            </div>
            <div className="space-y-3 p-4">
                {messages.length === 0 && <p className="text-sm text-slate-500">{hint}</p>}
                {messages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'text-end' : ''}>
                        {m.role === 'user' ? (
                            <div className="inline-block max-w-[90%] whitespace-pre-wrap rounded-lg bg-sky-600 px-3 py-2 text-start text-sm text-white" dir="auto">{m.content}</div>
                        ) : (
                            <div className={`rounded-lg px-3 py-2 ${m.failed ? 'border border-red-200 bg-red-50 text-sm text-red-800' : 'bg-slate-50'}`}>
                                {m.failed ? m.content : <AiText text={m.content} />}
                                {!m.failed && (
                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                                        {m.model && <span>{providerName(m.provider)} · {m.model}</span>}
                                        {m.pagesUsed?.length > 0 && <span>{t('ai_library.read_pages', 'Read {{count}} pages', { count: m.pagesUsed.length })}</span>}
                                        <button type="button" onClick={() => copyText(m.content, t)} className="flex items-center gap-1 hover:text-sky-700"><Copy size={12} /> {t('ai_library.copy', 'Copy')}</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {busy && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 size={15} className="animate-spin" /> {t('ai_library.reading', 'Reading the book…')}
                    </div>
                )}
            </div>
            <div className="flex gap-2 border-t border-slate-200 p-3">
                <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={2}
                    dir="auto"
                    placeholder={t('ai_library.ask_placeholder', 'Ask a question…')}
                    className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                />
                <Button onClick={send} disabled={busy || !question.trim()} className="self-end" aria-label={t('ai_library.send', 'Send')}>
                    <Send size={16} className="rtl:rotate-180" />
                </Button>
            </div>
        </section>
    );
}

// =============================================================================
// Adding and editing a book
// =============================================================================

function SectionsEditor({ sections, pageCount, onChange }) {
    const { t } = useTranslation();
    const set = (i, key, value) => onChange(sections.map((s, j) => (j === i ? { ...s, [key]: value } : s)));
    const cell = 'w-full min-w-0 rounded border border-slate-300 px-2 py-1.5 text-sm';
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">{t('ai_library.chapters', 'Chapters')}</p>
                <button type="button" className="flex items-center gap-1 text-sm font-semibold text-sky-700"
                    onClick={() => {
                        const last = sections[sections.length - 1];
                        const from = Math.min(pageCount, (last?.to || 0) + 1);
                        onChange([...sections, { title: '', from, to: pageCount, level: 0 }]);
                    }}>
                    <Plus size={15} /> {t('ai_library.add_chapter', 'Add chapter')}
                </button>
            </div>
            {sections.length === 0 && (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                    {t('ai_library.no_bookmarks', 'This PDF has no bookmarks, so no chapters were found. Add the chapters you want to summarise by their page ranges, or leave it empty and pick pages each time.')}
                </p>
            )}
            {sections.length > 0 && (
                <div className="max-h-72 space-y-1.5 overflow-y-auto pe-1">
                    <div className="grid grid-cols-[1fr_4rem_4rem_2rem] gap-1.5 text-xs text-slate-500">
                        <span>{t('ai_library.chapter_title', 'Title')}</span>
                        <span>{t('ai_library.from_page', 'From')}</span>
                        <span>{t('ai_library.to_page', 'To')}</span>
                        <span />
                    </div>
                    {sections.map((s, i) => (
                        <div key={i} className="grid grid-cols-[1fr_4rem_4rem_2rem] items-center gap-1.5">
                            <input className={`${cell} ${s.level ? 'border-s-4 border-s-sky-200' : ''}`} value={s.title} dir="auto" onChange={(e) => set(i, 'title', e.target.value)} />
                            <input className={cell} type="number" min={1} max={pageCount} value={s.from} onChange={(e) => set(i, 'from', e.target.value)} />
                            <input className={cell} type="number" min={1} max={pageCount} value={s.to} onChange={(e) => set(i, 'to', e.target.value)} />
                            <button type="button" aria-label={t('ai_library.remove', 'Remove')} className="p-1 text-slate-400 hover:text-red-600"
                                onClick={() => onChange(sections.filter((_, j) => j !== i))}>
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function BookFormModal({ book, defaultService, defaultCourseId = '', courses = [], modules = [], onClose, onSaved }) {
    const { t } = useTranslation();
    const editing = !!book;
    const [read, setRead] = useState(null); // what readBook() found, when adding
    const [title, setTitle] = useState(book?.title || '');
    const [service, setService] = useState(book?.service || defaultService || 'IMNCI');
    const [sections, setSections] = useState(book?.sections || []);
    const [courseId, setCourseId] = useState(book?.courseId ?? defaultCourseId);
    const [moduleId, setModuleId] = useState(book?.moduleId || '');
    const courseModules = modules.filter((m) => m.courseId === courseId);
    const [progress, setProgress] = useState(null); // { label, done, total }
    const [error, setError] = useState('');
    const pageCount = book?.pageCount || read?.pages.length || 0;
    const busy = !!progress;

    const pick = async (file) => {
        if (!file) return;
        setError('');
        setRead(null);
        try {
            setProgress({ label: t('ai_library.reading_pdf', 'Reading the PDF'), done: 0, total: 0 });
            const out = await readBook(file, (done, total) => setProgress({ label: t('ai_library.reading_pdf', 'Reading the PDF'), done, total }));
            setRead({ ...out, fileName: file.name });
            setTitle(out.title);
            setSections(out.sections);
        } catch (e) {
            setError(t('ai_library.pdf_unreadable', 'This PDF could not be read: {{reason}}', { reason: e.message }));
        } finally {
            setProgress(null);
        }
    };

    const save = async () => {
        const clean = cleanSections(sections, pageCount);
        if (!title.trim()) { setError(t('ai_library.need_title', 'Give the book a title.')); return; }
        try {
            if (editing) {
                setProgress({ label: t('ai_library.saving', 'Saving'), done: 0, total: 0 });
                await updateBook(book.id, { title: title.trim(), service, courseId, moduleId: courseId ? moduleId : '', sections: clean });
            } else {
                await addBook({ ...read, title: title.trim(), service, courseId, moduleId: courseId ? moduleId : '', sections: clean },
                    (done, total) => setProgress({ label: t('ai_library.uploading', 'Saving the text'), done, total }));
            }
            notify(editing ? t('ai_library.book_saved', 'Book saved') : t('ai_library.book_added', 'Book added'), 'success');
            onSaved();
        } catch (e) {
            setError(errorText(e, t));
            setProgress(null);
        }
    };

    const scanned = read && read.textPages < read.pages.length * SCANNED_SHARE;

    return (
        <Modal isOpen onClose={busy ? undefined : onClose} title={editing ? t('ai_library.edit_book', 'Edit book') : t('ai_library.add_book', 'Add book')}>
            <div className="space-y-4">
                {!editing && (
                    <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-5 text-center hover:border-sky-400 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
                        <Upload size={24} className="text-sky-600" />
                        <span className="text-sm font-semibold text-slate-700">{read ? read.fileName : t('ai_library.choose_pdf', 'Choose a PDF')}</span>
                        <span className="text-xs text-slate-500">{t('ai_library.pdf_note', 'The text is read on this device; the PDF itself is not uploaded. Course modules and sections are not changed.')}</span>
                        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                    </label>
                )}

                {progress && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Loader2 size={16} className="animate-spin" />
                        {progress.label}{progress.total ? ` ${progress.done}/${progress.total}` : '…'}
                    </div>
                )}

                {read && (
                    <p className="text-sm text-slate-600">
                        {t('ai_library.read_result', '{{pages}} pages, {{text}} with text, {{chapters}} chapters found.', { pages: read.pages.length, text: read.textPages, chapters: read.sections.length })}
                    </p>
                )}
                {scanned && (
                    <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                        <span>{t('ai_library.scanned', 'Most pages have no text, so this looks like a scanned book. The AI can only use pages with text; run it through OCR first (for example "Make searchable" in a PDF tool) for better results.')}</span>
                    </div>
                )}

                {(editing || read) && (
                    <>
                        <Input label={t('ai_library.book_title', 'Title')} name="aiBookTitle" value={title} dir="auto" onChange={(e) => setTitle(e.target.value)} />
                        <Select label={t('ai_library.service', 'Service')} name="aiBookService" value={service} onChange={(e) => setService(e.target.value)}>
                            {AI_SERVICES.map((s) => <option key={s} value={s}>{s === 'General' ? t('ai_library.general', 'General') : s}</option>)}
                        </Select>
                        {courses.length > 0 && (
                            <Select label={t('ai_library.course', 'Course')} name="aiBookCourse" value={courseId}
                                onChange={(e) => { setCourseId(e.target.value); setModuleId(''); }}>
                                <option value="">{t('ai_library.no_course', '— library only —')}</option>
                                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </Select>
                        )}
                        {courseId && courseModules.length > 0 && (
                            <div>
                                <Select label={t('ai_library.module_book', 'Module book (optional)')} name="aiBookModule" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
                                    <option value="">{t('ai_library.no_module', '— not a module book —')}</option>
                                    {courseModules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                                </Select>
                                <p className="mt-1 text-xs text-slate-500">{t('ai_library.module_book_hint', "If this is the book a module's sections were converted from, the AI helper on those sections reads its pages and cites them. The sections themselves are not changed.")}</p>
                            </div>
                        )}
                        <SectionsEditor sections={sections} pageCount={pageCount} onChange={setSections} />
                    </>
                )}

                {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>{t('ai_library.cancel', 'Cancel')}</Button>
                    <Button onClick={save} disabled={busy || (!editing && !read)}>
                        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                        {editing ? t('ai_library.save', 'Save') : t('ai_library.add', 'Add to library')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// =============================================================================
// One book
// =============================================================================

export function BookPage({ book, canManage, onBack, onEdit, backLabel }) {
    const { t, i18n } = useTranslation();
    const sections = useMemo(() => book.sections || [], [book.sections]);
    const [pick, setPick] = useState('all'); // 'all' | section index | 'pages'
    const [range, setRange] = useState({ from: 1, to: Math.min(book.pageCount, 10) });
    const [style, setStyle] = useState('summary');
    const [lang, setLang] = useState(i18n.language === 'ar' ? 'ar' : 'en');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [saved, setSaved] = useState(null);

    const scope = useMemo(() => {
        if (pick === 'pages') {
            const from = Math.max(1, Math.min(book.pageCount, parseInt(range.from, 10) || 1));
            const to = Math.max(from, Math.min(book.pageCount, parseInt(range.to, 10) || from));
            return { title: t('ai_library.pages_range_title', 'Pages {{from}}-{{to}}', { from, to }), from, to };
        }
        if (pick !== 'all' && sections[pick]) return sections[pick];
        return { title: t('ai_library.whole_book', 'Whole book'), from: 1, to: book.pageCount };
    }, [pick, range, sections, book.pageCount, t]);

    const loadSaved = useCallback(() => {
        listSummaries(book.id).then(setSaved).catch(() => setSaved([]));
    }, [book.id]);
    useEffect(() => { loadSaved(); }, [loadSaved]);

    const forScope = (saved || []).filter((s) => s.from === scope.from && s.to === scope.to);

    const run = async () => {
        setBusy(true);
        setResult(null);
        try {
            const data = await summarise({ bookId: book.id, from: scope.from, to: scope.to, style, lang, sectionTitle: scope.title });
            setResult({ ...data, style, lang });
            loadSaved();
        } catch (e) {
            setResult({ error: errorText(e, t) });
        } finally {
            setBusy(false);
        }
    };

    const removeSaved = async (s) => {
        if (!await confirmDialog(t('ai_library.confirm_delete_summary', 'Delete this saved summary?'), { danger: true })) return;
        try {
            await deleteSummary(book.id, s.id);
            loadSaved();
        } catch (e) { notify(errorText(e, t), 'error'); }
    };

    const chapterButton = (key, label, sub, level = 0) => (
        <button key={key} type="button" onClick={() => { setPick(key); setResult(null); }}
            className={`w-full rounded-lg px-3 py-2 text-start text-sm transition-colors ${level ? 'ps-6' : ''} ${pick === key ? 'bg-sky-600 text-white' : 'text-slate-700 hover:bg-sky-50'}`}>
            <span className="block leading-snug" dir="auto">{label}</span>
            <span className={`block text-xs ${pick === key ? 'text-sky-100' : 'text-slate-400'}`}>{sub}</span>
        </button>
    );

    return (
        <div className="space-y-4">
            {!IS_NATIVE && (
                <Button variant="secondary" onClick={onBack}><ArrowLeft size={16} className="rtl:rotate-180" /> {backLabel || t('ai_library.back_books', 'Books')}</Button>
            )}
            <PageHeader
                title={book.title}
                subtitle={`${book.service === 'General' ? t('ai_library.general', 'General') : book.service} · ${t('ai_library.page_count', '{{count}} pages', { count: book.pageCount })}`}
                actions={canManage ? <Button variant="ghost" onClick={onEdit}><Pencil size={16} /> {t('ai_library.edit_chapters', 'Edit chapters')}</Button> : null}
            />

            <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
                {/* Chapters: a list beside the work on wider screens, a menu on phones. */}
                <aside className="hidden max-h-[70vh] space-y-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 md:block">
                    {chapterButton('all', t('ai_library.whole_book', 'Whole book'), t('ai_library.pages_range', 'pages {{from}}-{{to}}', { from: 1, to: book.pageCount }))}
                    {sections.map((s, i) => chapterButton(i, s.title, t('ai_library.pages_range', 'pages {{from}}-{{to}}', s), s.level))}
                    {chapterButton('pages', t('ai_library.custom_pages', 'Choose pages'), t('ai_library.custom_pages_hint', 'any page range'))}
                </aside>
                <div className="md:hidden">
                    <Select label={t('ai_library.chapter', 'Chapter')} name="aiChapter" value={String(pick)}
                        onChange={(e) => { const v = e.target.value; setPick(v === 'all' || v === 'pages' ? v : Number(v)); setResult(null); }}>
                        <option value="all">{t('ai_library.whole_book', 'Whole book')}</option>
                        {sections.map((s, i) => <option key={i} value={i}>{s.level ? '— ' : ''}{s.title} ({s.from}-{s.to})</option>)}
                        <option value="pages">{t('ai_library.custom_pages', 'Choose pages')}</option>
                    </Select>
                </div>

                <div className="min-w-0 space-y-4">
                    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                        <div>
                            <h3 className="font-semibold text-slate-800" dir="auto">{scope.title}</h3>
                            <p className="text-xs text-slate-500">{t('ai_library.pages_range', 'pages {{from}}-{{to}}', scope)}</p>
                        </div>
                        {pick === 'pages' && (
                            <div className="grid max-w-xs grid-cols-2 gap-2">
                                <Input label={t('ai_library.from_page', 'From')} name="aiFrom" type="number" min={1} max={book.pageCount} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                                <Input label={t('ai_library.to_page', 'To')} name="aiTo" type="number" min={1} max={book.pageCount} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
                            </div>
                        )}
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('ai_library.what_to_make', 'What to make')}>
                            {STYLE_KEYS.map((k) => (
                                <button key={k} type="button" role="radio" aria-checked={style === k} onClick={() => setStyle(k)}
                                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${style === k ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 text-slate-700 hover:border-sky-400'}`}>
                                    {t(`ai_library.styles.${k}`, STYLE_FALLBACK[k])}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
                                {[['en', 'English'], ['ar', 'العربية']].map(([k, label]) => (
                                    <button key={k} type="button" onClick={() => setLang(k)} aria-pressed={lang === k}
                                        className={`px-3 py-1.5 ${lang === k ? 'bg-slate-800 text-white' : 'text-slate-700'}`}>{label}</button>
                                ))}
                            </div>
                            <Button onClick={run} disabled={busy}>
                                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                {busy ? t('ai_library.working', 'Reading and writing…') : t('ai_library.make', 'Make it')}
                            </Button>
                        </div>
                        {busy && <p className="text-xs text-slate-500">{t('ai_library.slow_note', 'A long chapter can take a minute or two.')}</p>}

                        {result?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{result.error}</p>}
                        {result?.text && (
                            <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
                                <AiText text={result.text} />
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <ModelLine provider={result.provider} model={result.model} />
                                    <Button variant="ghost" onClick={() => copyText(result.text, t)}><Copy size={14} /> {t('ai_library.copy', 'Copy')}</Button>
                                </div>
                            </div>
                        )}
                    </section>

                    {forScope.length > 0 && (
                        <section className="space-y-2">
                            <h3 className="text-sm font-semibold text-slate-500">{t('ai_library.saved_for_part', 'Saved for this part')}</h3>
                            {forScope.filter((s) => s.id !== result?.id).map((s) => (
                                <details key={s.id} className="group rounded-xl border border-slate-200 bg-white">
                                    <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
                                        <FileText size={16} className="shrink-0 text-slate-400" />
                                        <span className="flex-1 text-sm font-medium text-slate-700">
                                            {t(`ai_library.styles.${s.style}`, STYLE_FALLBACK[s.style] || s.style)} · {s.lang === 'ar' ? 'العربية' : 'English'}
                                        </span>
                                        <span className="text-xs text-slate-400">{s.createdByName} {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString() : ''}</span>
                                        <ChevronRight size={16} className="text-slate-400 transition-transform group-open:rotate-90 rtl:rotate-180" />
                                    </summary>
                                    <div className="border-t border-slate-100 px-4 py-3">
                                        <AiText text={s.text} />
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                            <ModelLine provider={s.provider} model={s.model} />
                                            <div className="flex gap-2">
                                                <Button variant="ghost" onClick={() => copyText(s.text, t)}><Copy size={14} /> {t('ai_library.copy', 'Copy')}</Button>
                                                {canManage && <Button variant="ghost" onClick={() => removeSaved(s)}><Trash2 size={14} /></Button>}
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            ))}
                        </section>
                    )}

                    <AskPanel
                        scope={{ bookId: book.id, from: scope.from, to: scope.to }}
                        title={t('ai_library.ask_part', 'Ask about this part')}
                        hint={t('ai_library.ask_part_hint', 'Questions are answered only from {{part}}, with the pages they come from.', { part: scope.title })}
                    />
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// The library
// =============================================================================

export function BookCard({ book, canManage, onOpen, onEdit, onDelete }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-stretch rounded-xl border border-slate-200 bg-white transition hover:border-sky-300 hover:shadow-md">
            <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 p-4 text-start">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><BookOpen size={22} /></div>
                <div className="min-w-0">
                    <p className="font-semibold leading-snug text-slate-800" dir="auto">{book.title}</p>
                    <p className="text-xs text-slate-500">
                        {t('ai_library.page_count', '{{count}} pages', { count: book.pageCount })} · {t('ai_library.chapter_count', '{{count}} chapters', { count: (book.sections || []).length })}
                    </p>
                </div>
            </button>
            {canManage && (
                <div className="flex flex-col justify-center border-s border-slate-100 px-1">
                    <button type="button" onClick={onEdit} className="p-2 text-slate-400 hover:text-sky-700" aria-label={t('ai_library.edit_book', 'Edit book')}><Pencil size={16} /></button>
                    <button type="button" onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600" aria-label={t('ai_library.delete_book', 'Delete book')}><Trash2 size={16} /></button>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Inside a course
// =============================================================================

/** The books of one course, on the course page, with a question box across them. */
export function CourseBooks({ courseId, books, canManage, onOpen, onAdd }) {
    const { t } = useTranslation();
    const mine = books.filter((b) => !b.isDeleted && b.courseId === courseId);
    if (!mine.length && !canManage) return null;
    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-bold text-slate-800"><Library size={18} className="text-sky-600" /> {t('ai_library.course_books', 'Course books')}</h3>
                {canManage && <Button variant="secondary" onClick={onAdd}><Plus size={16} /> {t('ai_library.add_book', 'Add book')}</Button>}
            </div>
            {mine.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                    {t('ai_library.no_course_books', 'No books for this course yet. Add the course book to get AI summaries by chapter and answers with page numbers. The course content is not changed.')}
                </p>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-2">
                        {mine.map((b) => <BookCard key={b.id} book={b} canManage={false} onOpen={() => onOpen(b.id)} />)}
                    </div>
                    <AskPanel
                        scope={{ courseId }}
                        title={t('ai_library.ask_course', 'Ask the course books')}
                        hint={t('ai_library.ask_service_hint', 'The answer comes from the pages that best match your question, with book and page.')}
                    />
                </>
            )}
        </section>
    );
}

const SECTION_STYLES = ['summary', 'key_points', 'quiz'];

/**
 * The AI study helper under a course section: a summary, key points or quiz
 * of what the section says, and questions about it. Read-only: it reads the
 * section (or the module book's pages for it) and writes nothing to the course.
 */
export function SectionAiPanel({ section, canRefresh = false }) {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const [style, setStyle] = useState('summary');
    const [lang, setLang] = useState(i18n.language === 'ar' ? 'ar' : 'en');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => { setResult(null); }, [section.id]);

    const run = async (fresh = false) => {
        setBusy(true);
        setResult(null);
        try {
            setResult(await summariseSection({ sectionId: section.id, style, lang, fresh }));
        } catch (e) {
            setResult({ error: errorText(e, t) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-xl border border-sky-200 bg-white shadow-sm">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
                className="flex w-full items-center gap-3 px-4 py-3 text-start">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><Sparkles size={18} /></span>
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-800">{t('ai_library.helper_title', 'AI study helper')}</span>
                    <span className="block text-xs text-slate-500">{t('ai_library.helper_hint', 'Summary, key points or a quiz of this section, and answers to your questions')}</span>
                </span>
                <ChevronRight size={18} className={`text-slate-400 transition-transform ${open ? 'rotate-90' : 'rtl:rotate-180'}`} />
            </button>
            {open && (
                <div className="space-y-4 border-t border-slate-100 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {SECTION_STYLES.map((k) => (
                            <button key={k} type="button" aria-pressed={style === k} onClick={() => setStyle(k)}
                                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${style === k ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 text-slate-700 hover:border-sky-400'}`}>
                                {t(`ai_library.styles.${k}`, STYLE_FALLBACK[k])}
                            </button>
                        ))}
                        <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
                            {[['en', 'English'], ['ar', 'العربية']].map(([k, label]) => (
                                <button key={k} type="button" onClick={() => setLang(k)} aria-pressed={lang === k}
                                    className={`px-3 py-1.5 ${lang === k ? 'bg-slate-800 text-white' : 'text-slate-700'}`}>{label}</button>
                            ))}
                        </div>
                        <Button onClick={() => run(false)} disabled={busy}>
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {busy ? t('ai_library.working', 'Reading and writing…') : t('ai_library.make', 'Make it')}
                        </Button>
                    </div>
                    {result?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{result.error}</p>}
                    {result?.text && (
                        <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
                            <AiText text={result.text} />
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-slate-400">
                                    {result.cached ? `${t('ai_library.shared_copy', 'Saved copy')} · ` : ''}{providerName(result.provider)} · {result.model}
                                    {result.fromBook ? ` · ${t('ai_library.from_book', 'from the module book')}` : ''}
                                </p>
                                <div className="flex gap-2">
                                    {canRefresh && result.cached && (
                                        <Button variant="ghost" onClick={() => run(true)} disabled={busy}><RotateCcw size={14} /> {t('ai_library.make_fresh', 'Make a fresh one')}</Button>
                                    )}
                                    <Button variant="ghost" onClick={() => copyText(result.text, t)}><Copy size={14} /> {t('ai_library.copy', 'Copy')}</Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <AskPanel
                        scope={{ sectionId: section.id }}
                        title={t('ai_library.ask_section', 'Ask about this section')}
                        hint={t('ai_library.ask_section_hint', 'Answers come only from this section.')}
                    />
                </div>
            )}
        </section>
    );
}

// The Books tab of Online Courses. `canManage` is the course author in Manage
// mode; `courses` and `modules` let a book be tied to the course it serves.
export default function AiLibraryView({ canManage = false, courses = [], modules = [] }) {
    const { t } = useTranslation();
    const [books, setBooks] = useState(null);
    const [service, setService] = useState(null);
    const [bookId, setBookId] = useState(null);
    const [tab, setTab] = useState('library');
    const [form, setForm] = useState(null); // { book? } while the add/edit dialog is open
    const topRef = useRef(null);

    const load = useCallback(() => {
        listBooks().then(setBooks).catch((e) => { notify(errorText(e, t), 'error'); setBooks([]); });
    }, [t]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { topRef.current?.scrollIntoView?.({ block: 'start' }); }, [service, bookId]);

    useInPageBack(() => (bookId ? setBookId(null) : setService(null)), !!service && !form);

    const live = useMemo(() => (books || []).filter((b) => !b.isDeleted), [books]);
    const deleted = useMemo(() => (books || []).filter((b) => b.isDeleted), [books]);
    const book = live.find((b) => b.id === bookId);
    const serviceBooks = live.filter((b) => b.service === service);
    const serviceName = (s) => (s === 'General' ? t('ai_library.general', 'General') : s);

    const remove = async (b) => {
        if (!await confirmDialog(t('ai_library.confirm_delete', 'Move "{{title}}" to Deleted? It can be restored from the Deleted tab.', { title: b.title }), { danger: true })) return;
        try { await setBookDeleted(b.id, true); load(); } catch (e) { notify(errorText(e, t), 'error'); }
    };
    const restore = async (b) => {
        try { await setBookDeleted(b.id, false); load(); notify(t('ai_library.restored', 'Book restored'), 'success'); } catch (e) { notify(errorText(e, t), 'error'); }
    };
    const purge = async (b) => {
        if (!await confirmDialog(t('ai_library.confirm_purge', 'Delete "{{title}}" and its saved summaries for good? This cannot be undone.', { title: b.title }), { danger: true })) return;
        try { await deleteBookForever(b.id); load(); } catch (e) { notify(errorText(e, t), 'error'); }
    };

    const dialog = form && (
        <BookFormModal book={form.book} defaultService={service} courses={courses} modules={modules}
            onClose={() => setForm(null)}
            onSaved={() => { setForm(null); load(); }} />
    );

    let page;
    if (books === null) {
        page = <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>;
    } else if (book) {
        page = <BookPage key={book.id} book={book} canManage={canManage} onBack={() => setBookId(null)} onEdit={() => setForm({ book })} />;
    } else if (service) {
        page = (
            <div className="space-y-4">
                {!IS_NATIVE && (
                    <Button variant="secondary" onClick={() => setService(null)}><ArrowLeft size={16} className="rtl:rotate-180" /> {t('ai_library.back_services', 'All services')}</Button>
                )}
                <PageHeader
                    title={t('ai_library.service_books', '{{service}} books', { service: serviceName(service) })}
                    subtitle={t('ai_library.service_books_hint', 'Open a book to summarise a chapter, or ask across all of them below.')}
                    actions={canManage ? <Button onClick={() => setForm({})}><Plus size={16} /> {t('ai_library.add_book', 'Add book')}</Button> : null}
                />
                {serviceBooks.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white">
                        <EmptyState icon={BookOpen}
                            message={t('ai_library.no_books', 'No books for this service yet.')}
                            action={canManage ? { label: t('ai_library.add_book', 'Add book'), onClick: () => setForm({}) } : undefined} />
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3 md:grid-cols-2">
                            {serviceBooks.map((b) => (
                                <BookCard key={b.id} book={b} canManage={canManage}
                                    onOpen={() => setBookId(b.id)} onEdit={() => setForm({ book: b })} onDelete={() => remove(b)} />
                            ))}
                        </div>
                        <AskPanel
                            scope={{ service }}
                            title={t('ai_library.ask_service', 'Ask across all {{service}} books', { service: serviceName(service) })}
                            hint={t('ai_library.ask_service_hint', 'The answer comes from the pages that best match your question, with book and page.')}
                        />
                    </>
                )}
            </div>
        );
    } else {
        page = (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">{t('ai_library.subtitle', 'The course books, with AI summaries and answers by service and chapter')}</p>
                    {canManage && <Button onClick={() => setForm({})}><Plus size={16} /> {t('ai_library.add_book', 'Add book')}</Button>}
                </div>
                {canManage && (
                    <Tabs activeTab={tab} onTabChange={setTab} tabs={[
                        { id: 'library', label: t('ai_library.tab_library', 'Library'), icon: Library },
                        { id: 'deleted', label: t('ai_library.tab_deleted', 'Deleted'), icon: Trash2, count: deleted.length },
                    ]} />
                )}
                {tab === 'deleted' && canManage ? (
                    deleted.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white"><EmptyState icon={Trash2} message={t('ai_library.no_deleted', 'No deleted books.')} /></div>
                    ) : (
                        <div className="space-y-2">
                            {deleted.map((b) => (
                                <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                                    <BookOpen size={18} className="text-slate-400" />
                                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-700" dir="auto">{b.title} <span className="text-slate-400">· {serviceName(b.service)}</span></span>
                                    <Button variant="ghost" onClick={() => restore(b)}><RotateCcw size={14} /> {t('ai_library.restore', 'Restore')}</Button>
                                    <Button variant="danger" onClick={() => purge(b)}><Trash2 size={14} /> {t('ai_library.delete_forever', 'Delete for good')}</Button>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {AI_SERVICES.map((s) => {
                            const count = live.filter((b) => b.service === s).length;
                            return (
                                <button key={s} type="button" onClick={() => setService(s)}
                                    className={`rounded-2xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-md ${count ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50'}`}>
                                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${count ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-400'}`}><Library size={22} /></div>
                                    <p className="mt-3 font-bold text-slate-900">{serviceName(s)}</p>
                                    <p className="text-xs text-slate-500">{t('ai_library.book_count', '{{count}} books', { count })}</p>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div ref={topRef} className="scroll-mt-24">
            {page}
            {dialog}
        </div>
    );
}
