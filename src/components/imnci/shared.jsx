// src/components/imnci/shared.jsx
//
// What the four IMNCI screens have in common.
//
// The protocol, the exercises, the course books and the patient form are one
// body of work: the protocol decides what a classification means, the exercises
// test that decision, the course books teach it and the form applies it at the
// bedside. They used to sit in four folders and each fetched its own copy of
// the same data, so opening Online Courses after Online Exercises re-read every
// exercise definition, and a case corrected in one screen was still wrong in
// the other until a reload.
//
// Two things live here:
//   ImnciProvider / useImnci   one load of the shared data, shared by all four
//   RichText / RichTextEditor  the in-place editor the course text is written
//                              in, and the sanitiser that makes storing HTML
//                              safe to render back
import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
    Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter,
    AlignRight, ImagePlus, Link2, Palette, Type, Eraser, Heading2, Table2,
} from 'lucide-react';

import { promptDialog } from '../dialogs';
import { ONLINE_SUB_COURSE } from './exercises';
import { loadAllExercises } from './exercises.jsx';

// =============================================================================
// Shared data
// =============================================================================

const ImnciContext = createContext(null);

/**
 * One load of the exercise definitions for every IMNCI screen.
 *
 * Deliberately lazy: mounting the provider fetches nothing, and the first
 * screen that asks for exercises triggers the read. A clinician recording a
 * patient never touches the exercise collection, and should not pay for it.
 */
export function ImnciProvider({ children }) {
    const [exercises, setExercises] = useState(null);
    const [loading, setLoading] = useState(false);
    const asked = useRef(false);
    const exercisesRef = useRef(null);

    // Resolves to the list as well as storing it, so the caller that triggered
    // a refresh can act on what came back without waiting for a re-render.
    const loadExercises = useCallback(async (force = false) => {
        if (asked.current && !force) return exercisesRef.current;
        asked.current = true;
        setLoading(true);
        try {
            const list = await loadAllExercises(ONLINE_SUB_COURSE, { includeDrafts: true, force });
            exercisesRef.current = list;
            setExercises(list);
            return list;
        } catch (e) {
            // Not fatal anywhere: every screen that uses these can show what it
            // has without them, and saying so beats an empty list with no
            // explanation.
            console.error('Could not load the exercises:', e);
            exercisesRef.current = [];
            setExercises([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    // Called after the exercise builder saves, from wherever it was opened.
    const refreshExercises = useCallback(() => loadExercises(true), [loadExercises]);

    const value = useMemo(() => ({
        exercises, exercisesLoading: loading, loadExercises, refreshExercises,
    }), [exercises, loading, loadExercises, refreshExercises]);

    return <ImnciContext.Provider value={value}>{children}</ImnciContext.Provider>;
}

/**
 * The shared IMNCI data. Safe outside the provider — a screen mounted on its
 * own falls back to loading for itself rather than throwing, so a route that
 * has not been wrapped yet still works.
 */
export function useImnci() {
    const ctx = useContext(ImnciContext);
    const [own, setOwn] = useState(null);

    useEffect(() => {
        if (ctx) { ctx.loadExercises(); return undefined; }
        let alive = true;
        loadAllExercises(ONLINE_SUB_COURSE, { includeDrafts: true })
            .then((x) => { if (alive) setOwn(x); })
            .catch((e) => { console.error('Could not load the exercises:', e); if (alive) setOwn([]); });
        return () => { alive = false; };
    }, [ctx]);

    if (ctx) return ctx;
    return {
        exercises: own,
        exercisesLoading: own === null,
        loadExercises: () => {},
        refreshExercises: async () => {
            const fresh = await loadAllExercises(ONLINE_SUB_COURSE, { includeDrafts: true, force: true })
                .catch(() => []);
            setOwn(fresh);
            return fresh;
        },
    };
}

// =============================================================================
// Rich text
//
// Course text is written in place on the page it will be read on, so what the
// author sees while typing is what the learner gets. It is stored as HTML,
// which means it has to be cleaned both going in and coming out: an author
// account is trusted, but what it saves is rendered to every learner, so a
// compromised account must not be able to put a script in front of them.
// =============================================================================

// Only what the toolbar can produce, plus what a paste is likely to bring.
const ALLOWED = {
    P: [], BR: [], DIV: [], SPAN: [], B: [], STRONG: [], I: [], EM: [],
    U: [], S: [], SUB: [], SUP: [], H2: [], H3: [], H4: [],
    UL: [], OL: [], LI: [], BLOCKQUOTE: [],
    A: ['href', 'title'], IMG: ['src', 'alt', 'title', 'width', 'height'],
    TABLE: [], THEAD: [], TBODY: [], TR: [], TH: ['colspan', 'rowspan'], TD: ['colspan', 'rowspan'],
};

// Removed WITH their contents, unlike everything else unknown. A <script> that
// is merely unwrapped leaves `alert(1)` behind as visible text in the middle of
// the guidance — inert, but nonsense on the page.
const DROP_WHOLE = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED',
    'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'SVG', 'MATH', 'LINK', 'META',
]);

// Inline style is what carries colour, size and alignment, so it is kept — but
// only these properties, and only values that cannot fetch anything. Layout
// properties are on the list because a classification chart built here carries
// its own padding and width: without them the chart came out as a cramped
// table with its cells touching.
const STYLE_PROPS = [
    'color', 'background-color', 'font-size', 'font-family', 'font-weight',
    'font-style', 'text-align', 'text-decoration',
    'padding', 'width', 'border', 'border-collapse', 'vertical-align', 'max-width',
];

const safeUrl = (raw) => {
    const v = String(raw || '').trim();
    // Anything that is not plainly http(s), a data image, or a relative path is
    // dropped. `javascript:` is the obvious one; `vbscript:` and a leading
    // control character to smuggle it past a naive check are the other two.
    if (/^(https?:|mailto:|\/|\.\/|#)/i.test(v)) return v;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(v)) return v;
    return '';
};

const safeStyle = (raw) => String(raw || '')
    .split(';')
    .map((bit) => {
        const at = bit.indexOf(':');
        if (at < 0) return '';
        const prop = bit.slice(0, at).trim().toLowerCase();
        const val = bit.slice(at + 1).trim();
        if (!STYLE_PROPS.includes(prop)) return '';
        if (/url\s*\(|expression|javascript:/i.test(val)) return '';
        return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join('; ');

/**
 * Strips everything the editor is not allowed to produce.
 *
 * Parsed with DOMParser rather than a regular expression. A regular expression
 * over HTML is defeated by things like `<img/**\/onerror=...>`, and this has to
 * hold against a stored payload, not just against a typo.
 *
 * @param {string} html
 * @returns {string} html safe to render with dangerouslySetInnerHTML
 */
export function sanitiseHtml(html) {
    const input = String(html || '');
    if (!input.trim()) return '';
    if (typeof DOMParser === 'undefined') return input.replace(/<[^>]*>/g, '');

    const doc = new DOMParser().parseFromString(`<body>${input}</body>`, 'text/html');

    const walk = (node) => {
        const tag = node.tagName;
        if (DROP_WHOLE.has(tag)) { node.remove(); return; }
        [...node.children].forEach(walk);
        if (!ALLOWED[tag]) {
            // The element goes, its text stays: dropping the children with it
            // would silently lose a paragraph because of one stray wrapper.
            node.replaceWith(...node.childNodes);
            return;
        }
        [...node.attributes].forEach((attr) => {
            const name = attr.name.toLowerCase();
            if (name === 'style') {
                const clean = safeStyle(attr.value);
                if (clean) node.setAttribute('style', clean); else node.removeAttribute('style');
                return;
            }
            if (!ALLOWED[tag].includes(name)) { node.removeAttribute(attr.name); return; }
            if (name === 'href' || name === 'src') {
                const clean = safeUrl(attr.value);
                if (clean) node.setAttribute(name, clean); else node.removeAttribute(attr.name);
            }
        });
        if (tag === 'A') {
            node.setAttribute('rel', 'noreferrer noopener');
            node.setAttribute('target', '_blank');
        }
    };

    [...doc.body.children].forEach(walk);
    return doc.body.innerHTML;
}

/** Rich text as the learner sees it. */
export function RichText({ html, className = '' }) {
    const clean = useMemo(() => sanitiseHtml(html), [html]);
    if (!clean) return null;
    return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}

const FONTS = [
    { label: 'Default', value: '' },
    { label: 'Serif', value: 'Georgia, serif' },
    { label: 'Sans', value: 'system-ui, sans-serif' },
    { label: 'Mono', value: 'ui-monospace, monospace' },
];

// Named rather than a colour wheel: these are the ones that mean something in
// this programme, and the IMNCI three are the classification colours.
const COLOURS = [
    { label: 'Text', value: '#0f172a' },
    { label: 'Muted', value: '#64748b' },
    { label: 'Severe (pink)', value: '#be123c' },
    { label: 'Treat (yellow)', value: '#b45309' },
    { label: 'Home care (green)', value: '#047857' },
    { label: 'Link blue', value: '#0369a1' },
];

const SIZES = [
    { label: 'Normal', value: '1rem' },
    { label: 'Small', value: '0.875rem' },
    { label: 'Large', value: '1.25rem' },
    { label: 'Extra large', value: '1.5rem' },
];

function ToolButton({ onClick, title, active = false, children }) {
    return (
        <button type="button" title={title}
            // The selection is lost the moment the button takes focus, so the
            // press is handled before focus moves.
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            className={`p-1.5 rounded hover:bg-slate-200 ${active ? 'bg-slate-200 text-sky-700' : 'text-slate-600'}`}>
            {children}
        </button>
    );
}

/**
 * Edits rich text where it sits on the page.
 *
 * Built on contentEditable and execCommand. execCommand is deprecated and every
 * browser still implements it; the alternative was a third editor library in an
 * app that is already installed over a phone connection, which is a worse trade
 * than a deprecated API that works.
 *
 * @param {string} value          the HTML being edited
 * @param {(html: string) => void} onChange   called on blur, with clean HTML
 * @param {(file: File) => Promise<string>} onInsertImage  uploads and returns a URL
 */
export function RichTextEditor({
    value, onChange, onInsertImage, onInsertChart, registerInsert,
    placeholder = 'Write here…', className = '', autoFocus = false,
}) {
    const ref = useRef(null);
    const file = useRef(null);
    const saved = useRef(null);
    const mine = useRef(false);
    const [busy, setBusy] = useState(false);

    // Seeded from outside ONCE, and then left alone.
    //
    // The editor used to write innerHTML back whenever `value` changed, and
    // `value` changed on every keystroke because the editor itself reported it.
    // Every character therefore replaced the whole document and put the caret
    // back at the start — which is what made typing feel like it was hanging.
    // `mine` marks changes this editor caused, so they are not echoed back into
    // it; anything else (a different section opening) still reseeds it.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (mine.current) { mine.current = false; return; }
        const clean = sanitiseHtml(value);
        if (el.innerHTML !== clean) el.innerHTML = clean;
    }, [value]);

    useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

    // Where the caret was when focus left the editor. A toolbar select or a
    // dialog takes focus away, and without this the insert lands at the top of
    // the document instead of where the author was working.
    const remember = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
            saved.current = sel.getRangeAt(0).cloneRange();
        }
    };

    const restore = () => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        if (!saved.current) return;
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(saved.current);
    };

    const cmd = (name, arg = null) => {
        restore();
        document.execCommand(name, false, arg);
        commit();
    };

    // Puts a block of HTML — a chart, a picture — where the caret is.
    const insertHtml = (fragment) => {
        restore();
        document.execCommand('insertHTML', false, fragment);
        commit();
    };

    // Handed out through a ref rather than directly: the function is rebuilt
    // every render, and registering the new one each time would re-run the
    // parent's effect on every keystroke.
    const insertRef = useRef(insertHtml);
    insertRef.current = insertHtml;
    useEffect(() => { registerInsert?.((fragment) => insertRef.current(fragment)); }, [registerInsert]);

    const style = (prop, val) => {
        restore();
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;   // nothing selected, nothing to style
        const span = document.createElement('span');
        span.style[prop] = val;
        try {
            span.appendChild(sel.getRangeAt(0).extractContents());
            sel.getRangeAt(0).insertNode(span);
            sel.removeAllRanges();
        } catch (e) {
            console.error('Could not apply that style:', e);
        }
        commit();
    };

    // Reported up, but NOT sanitised on every keystroke: cleaning the whole
    // document through DOMParser on each character is most of what made this
    // slow, and the save path sanitises anyway — as does render, which is the
    // one that actually matters for safety.
    const commit = () => {
        const el = ref.current;
        if (!el) return;
        mine.current = true;
        onChange(el.innerHTML);
    };

    const insertImage = async (picked) => {
        if (!picked || !onInsertImage) return;
        setBusy(true);
        try {
            const url = await onInsertImage(picked);
            if (url) insertHtml(`<img src="${url}" alt="" style="max-width: 100%" />`);
        } catch (e) {
            console.error('Could not insert that image:', e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
            {/* Sticky, because the document is now the whole tab: scrolling
                three screens down should not leave the author without a bold
                button. */}
            <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200 sticky top-16 z-10">
                <ToolButton title="Bold" onClick={() => cmd('bold')}><Bold size={15} /></ToolButton>
                <ToolButton title="Italic" onClick={() => cmd('italic')}><Italic size={15} /></ToolButton>
                <ToolButton title="Underline" onClick={() => cmd('underline')}><Underline size={15} /></ToolButton>
                <ToolButton title="Heading" onClick={() => cmd('formatBlock', 'H3')}><Heading2 size={15} /></ToolButton>

                <span className="w-px h-5 bg-slate-300 mx-1" />

                <ToolButton title="Bulleted list" onClick={() => cmd('insertUnorderedList')}><List size={15} /></ToolButton>
                <ToolButton title="Numbered list" onClick={() => cmd('insertOrderedList')}><ListOrdered size={15} /></ToolButton>

                <span className="w-px h-5 bg-slate-300 mx-1" />

                <ToolButton title="Align start" onClick={() => cmd('justifyLeft')}><AlignLeft size={15} /></ToolButton>
                <ToolButton title="Centre" onClick={() => cmd('justifyCenter')}><AlignCenter size={15} /></ToolButton>
                <ToolButton title="Align end" onClick={() => cmd('justifyRight')}><AlignRight size={15} /></ToolButton>

                <span className="w-px h-5 bg-slate-300 mx-1" />

                <label className="inline-flex items-center gap-1 text-slate-600" title="Colour">
                    <Palette size={15} />
                    <select onMouseDown={(e) => e.stopPropagation()} defaultValue=""
                        onChange={(e) => { if (e.target.value) style('color', e.target.value); e.target.value = ''; }}
                        className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white max-w-[7.5rem]">
                        <option value="">Colour</option>
                        {COLOURS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                </label>

                <label className="inline-flex items-center gap-1 text-slate-600 ms-1" title="Font">
                    <Type size={15} />
                    <select defaultValue=""
                        onChange={(e) => { if (e.target.value) style('fontFamily', e.target.value); e.target.value = ''; }}
                        className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white">
                        <option value="">Font</option>
                        {FONTS.filter((f) => f.value).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                </label>

                <select defaultValue="" title="Size"
                    onChange={(e) => { if (e.target.value) style('fontSize', e.target.value); e.target.value = ''; }}
                    className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white ms-1">
                    <option value="">Size</option>
                    {SIZES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                </select>

                <span className="w-px h-5 bg-slate-300 mx-1" />

                {onInsertImage && (
                    <>
                        <ToolButton title="Insert a picture" onClick={() => { remember(); file.current?.click(); }}>
                            <ImagePlus size={15} />
                        </ToolButton>
                        <input ref={file} type="file" accept="image/*" className="hidden"
                            onChange={(e) => { insertImage(e.target.files?.[0]); e.target.value = ''; }} />
                    </>
                )}
                {onInsertChart && (
                    <ToolButton title="Insert a classification chart"
                        onClick={() => { remember(); onInsertChart(); }}>
                        <Table2 size={15} />
                    </ToolButton>
                )}
                <ToolButton title="Add a link" onClick={async () => {
                    remember();
                    const url = await promptDialog('Address to link to', { title: 'Add a link' });
                    if (url) cmd('createLink', url);
                }}><Link2 size={15} /></ToolButton>
                <ToolButton title="Clear the formatting" onClick={() => cmd('removeFormat')}>
                    <Eraser size={15} />
                </ToolButton>

                {busy && <span className="text-xs text-sky-700 ms-2">Uploading…</span>}
            </div>

            <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                data-placeholder={placeholder}
                onInput={commit}
                onBlur={() => { remember(); commit(); }}
                onKeyUp={remember}
                onMouseUp={remember}
                // Pasted content is cleaned on the way in as well as on the way
                // out, so a paste from Word does not fill the page with its own
                // markup before anyone presses save.
                onPaste={(e) => {
                    e.preventDefault();
                    const html = e.clipboardData.getData('text/html');
                    const text = e.clipboardData.getData('text/plain');
                    document.execCommand('insertHTML', false,
                        html ? sanitiseHtml(html) : text.replace(/[<>&]/g, (c) => (
                            { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])));
                    commit();
                }}
                className={`p-4 min-h-[8rem] outline-none prose prose-slate max-w-none
                           empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400
                           ${className.includes('min-h') ? className : ''}`}
            />
        </div>
    );
}
