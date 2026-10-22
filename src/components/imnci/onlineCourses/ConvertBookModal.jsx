// src/components/imnci/onlineCourses/ConvertBookModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Sparkles, X, Loader2 } from 'lucide-react';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { Button, Spinner, Modal, Select } from '../../CommonComponents';
import { notify, confirmDialog } from '../../dialogs';
import { storage } from '../../../firebase';
import { addOnlineSections } from '../../../data';
import { extractPdfPages, parsePdfIntoSections, countWords, renderPdfPages } from '../book';
import { tidySection } from '../../aiLibrary/aiLibraryData';
import { aiTextToBlocks } from '../../aiLibrary/bookText';
import { ASSET_ROOT } from './assets';
import { ContentBlocks } from './blocks';

// =============================================================================
// Book -> readable sections
//
// The reason this exists: handing a learner a 95-page PDF and a page range is
// not training, it is a filing system. Converting a book once turns every
// section into text they can actually read on a phone.
// =============================================================================

export function ConvertBookModal({ isOpen, onClose, courseId, modules, existingFor, onRefresh }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [moduleId, setModuleId] = useState('');
    // Off unless asked for: an author adding one chapter should not find the
    // module's other sections gone.
    const [replace, setReplace] = useState(false);
    const [progress, setProgress] = useState(null);
    // Kept after the parse. The classification charts in these books are drawn
    // as vector paths, so no amount of text extraction recovers their grid or
    // their colour; the page has to be captured as printed. Extraction finds
    // roughly 24 raster figures in module 2 against some 7,800 path operations,
    // which is why this defaults on.
    const [file, setFile] = useState(null);
    const [capturePages, setCapturePages] = useState(true);
    // The AI conversion, tried beside the standard one on the same sections:
    // drafts[i] is the AI version of section i, choice[i] which version goes
    // into the course. Nothing is written until Create sections.
    const [drafts, setDrafts] = useState({});
    const [choice, setChoice] = useState({});
    const [aiRun, setAiRun] = useState(null); // { done, total } while running
    const [viewing, setViewing] = useState(null); // section index shown side by side
    const stopAi = useRef(false);

    useEffect(() => {
        if (isOpen) {
            setResult(null); setError(''); setFile(null); setModuleId(modules[0]?.id || '');
            setDrafts({}); setChoice({}); setViewing(null); setReplace(false);
        }
    }, [isOpen, modules]);
    const existingCount = moduleId ? existingFor(moduleId).length : 0;

    // A section's raw text for the AI: its pages as extracted. The section
    // can start and end mid-page; the AI is told to keep only its own part.
    const rawText = (sec) => (result?.pages || [])
        .filter((pg) => pg.page >= sec.startPage && pg.page <= sec.endPage)
        .map((pg) => (pg.lines || []).join('\n')).join('\n\n');

    const runAi = async () => {
        if (!result?.sections?.length) return;
        stopAi.current = false;
        const total = result.sections.length;
        setAiRun({ done: 0, total });
        for (let i = 0; i < total; i++) {
            if (stopAi.current) break;
            if (drafts[i]?.blocks) { setAiRun({ done: i + 1, total }); continue; }
            const sec = result.sections[i];
            try {
                const out = await tidySection({ number: sec.number, title: sec.title, text: rawText(sec) });
                setDrafts((d) => ({ ...d, [i]: { ...out, blocks: aiTextToBlocks(out.text) } }));
            } catch (e) {
                setDrafts((d) => ({ ...d, [i]: { error: e?.message || 'failed' } }));
                // Out of quota: every section after this would fail the same way.
                if (e?.code === 'functions/resource-exhausted') break;
            }
            setAiRun({ done: i + 1, total });
        }
        setAiRun(null);
    };

    const aiReady = Object.values(drafts).filter((d) => d?.blocks).length;
    const chooseForAll = (version) => setChoice(Object.fromEntries(result.sections.map((_, i) => [i, version === 'ai' && drafts[i]?.blocks ? 'ai' : 'standard'])));
    const aiCount = result ? result.sections.filter((_, i) => choice[i] === 'ai' && drafts[i]?.blocks).length : 0;

    const handleFile = async (event) => {
        const picked = event.target.files?.[0];
        if (!picked) return;
        setBusy(true); setError(''); setResult(null); setProgress(null); setFile(picked);
        try {
            const pages = await extractPdfPages(picked, setProgress, true);
            const parsed = parsePdfIntoSections(pages);
            // Kept beside the parse so the blobs are still in hand at commit.
            parsed.images = pages.flatMap((pg) => pg.images || []);
            // The page text, for the AI conversion.
            parsed.pages = pages.map(({ page, lines }) => ({ page, lines }));
            setDrafts({}); setChoice({}); setViewing(null);
            if (parsed.sections.length === 0) {
                setError(t('imnci_ui.courses.convert.no_headings', 'No numbered headings were found. This converter expects the IMNCI module books, which number their headings like "2.0" and "5.2.1".'));
            }
            setResult({ ...parsed, fileName: picked.name, pageCount: pages.length });
        } catch (e) {
            console.error('PDF conversion failed:', e);
            setError(t('imnci_ui.courses.convert.read_failed', 'Could not read that PDF. {{msg}}', { msg: e?.message || '' }).trim());
        } finally {
            setBusy(false);
            event.target.value = '';
        }
    };

    const commit = async () => {
        if (!result?.sections?.length || !moduleId) return;
        const module = modules.find((m) => m.id === moduleId);
        const ok = await confirmDialog(
            t('imnci_ui.courses.convert.confirm', 'Create {{n}} readable sections under "{{module}}"?', { n: result.sections.length, module: module?.title })
            + (aiCount ? ' ' + t('imnci_ui.courses.convert.confirm_ai', '{{n}} of them use the AI version.', { n: aiCount }) : '')
            + (replace && existingCount ? ' ' + t('imnci_ui.courses.convert.confirm_hide_n', 'The {{n}} sections already in that module will be hidden (they stay in Deleted).', { n: existingCount }) : ''),
            { title: t('imnci_ui.courses.convert.confirm_title', 'Convert book'), confirmLabel: t('imnci_ui.courses.convert.create_sections', 'Create sections') });
        if (!ok) return;

        setBusy(true);
        try {
            // Figures go to Storage first: a section that references an image
            // which was never uploaded renders a gap, and the learner has no
            // way to tell whether the figure is missing or simply absent.
            const uploadedPaths = {};
            for (let i = 0; i < (result.images || []).length; i++) {
                const img = result.images[i];
                if (!img?.blob) continue;
                const path = `${ASSET_ROOT}/figures/${courseId}/${moduleId}/${i}.png`;
                try {
                    await uploadBytes(storageRef(storage, path), img.blob, { contentType: 'image/png' });
                    uploadedPaths[i] = path.slice(ASSET_ROOT.length + 1);
                } catch (err) {
                    console.error('Figure upload failed:', path, err);
                }
            }

            // Page pictures. Rendered once per page number even where two
            // sections meet on the same page, so a shared page is not uploaded
            // twice and the two sections point at the same file.
            const pagePaths = {};
            if (capturePages && file) {
                const wanted = [...new Set(result.sections.flatMap((sec) => {
                    const out = [];
                    for (let p = sec.startPage; p <= sec.endPage; p++) out.push(p);
                    return out;
                }))].sort((a, b) => a - b);

                let done = 0;
                for (const p of wanted) {
                    setProgress({ phase: 'pages', page: done + 1, total: wanted.length });
                    try {
                        const [shot] = await renderPdfPages(file, [p], 1.6);
                        if (shot?.blob) {
                            const path = `${ASSET_ROOT}/pages/${courseId}/${moduleId}/p${p}.png`;
                            await uploadBytes(storageRef(storage, path), shot.blob, { contentType: 'image/png' });
                            pagePaths[p] = path.slice(ASSET_ROOT.length + 1);
                        }
                    } catch (err) {
                        console.error('Page capture failed:', p, err);
                    }
                    done += 1;
                }
            }

            // Added after the module's own sections unless they are being replaced.
            const after = replace ? 0 : Math.max(0, ...existingFor(moduleId).map((x) => Number(x.order) || 0));
            const sections = result.sections.map((sec, index) => {
                const withPaths = (list) => (list || []).map((b) => (
                    b.type === 'image'
                        ? { ...b, path: uploadedPaths[b.imageIndex] || null }
                        : b
                ));
                const useAi = choice[index] === 'ai' && drafts[index]?.blocks;
                // The AI version is text only, so the figures the standard
                // converter placed in the text move to the See tab.
                const see = useAi
                    ? [...withPaths(sec.read).filter((b) => b.type === 'image'), ...withPaths(sec.see)]
                    : withPaths(sec.see);
                for (let p = sec.startPage; p <= sec.endPage; p++) {
                    if (pagePaths[p]) see.push({ type: 'page', page: p, path: pagePaths[p] });
                }
                return {
                    kind: 'section', courseId, moduleId,
                    title: `${sec.number} ${sec.title}`,
                    order: after + index + 1,
                    read: useAi ? drafts[index].blocks : withPaths(sec.read),
                    see,
                    practise: [],
                    bookFromPage: sec.startPage,
                    bookToPage: sec.endPage,
                    isPublished: true,
                    source: useAi ? 'ai-converted' : 'converted',
                };
            });
            // The new sections are written together, and the old ones are
            // hidden only after they have all landed, so a failure part way
            // leaves the module as it was rather than half replaced.
            const n = await addOnlineSections(sections, replace ? existingFor(moduleId).map((x) => x.id) : []);
            notify(t('imnci_ui.courses.convert.created', 'Created {{n}} readable sections.', { n }), 'success');
            onRefresh();
            onClose();
        } catch (e) {
            console.error('Could not create sections:', e);
            setError(t('imnci_ui.courses.convert.save_failed', 'Saving failed part way through. {{msg}}', { msg: e?.message || '' }).trim());
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('imnci_ui.courses.convert.title', 'Convert a book into readable sections')}>
            <div className="space-y-4">
                {error && (
                    <div className="flex gap-2 bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" /><div>{error}</div>
                    </div>
                )}

                <p className="text-sm text-slate-600">
                    {t('imnci_ui.courses.convert.intro', 'Reads an IMNCI module book and splits it at its numbered headings, so each section becomes text the learner reads in the app rather than a page number in a PDF. The file is read in your browser and is not uploaded.')}
                </p>

                <Select label={t('imnci_ui.courses.convert.add_to', 'Add the sections to')} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
                    <option value="">{t('imnci_ui.courses.convert.choose_module', '— choose a module —')}</option>
                    {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </Select>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('imnci_ui.courses.convert.module_book', 'Module book (PDF)')}</label>
                    <input type="file" accept=".pdf,application/pdf" onChange={handleFile} disabled={busy}
                        className="block w-full text-sm text-slate-600 file:me-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100" />
                </div>

                {busy && (
                    <div className="space-y-2">
                        {progress ? (
                            <>
                                <div className="h-2 bg-slate-200 rounded overflow-hidden">
                                    <div className="h-full bg-sky-600 transition-all duration-150"
                                        style={{ width: `${Math.round((progress.page / progress.total) * 100)}%` }} />
                                </div>
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>
                                        {progress.phase === 'pages' ? t('imnci_ui.courses.convert.capturing_page', 'Capturing page {{page}} of {{total}}', { page: progress.page, total: progress.total })
                                            : progress.phase === 'figures' ? t('imnci_ui.courses.convert.figures_page', 'Reading figures on page {{page}} of {{total}}', { page: progress.page, total: progress.total })
                                                : t('imnci_ui.courses.convert.reading_page', 'Reading page {{page}} of {{total}}', { page: progress.page, total: progress.total })}
                                    </span>
                                    <span>{Math.round((progress.page / progress.total) * 100)}%</span>
                                </div>
                            </>
                        ) : <Spinner />}
                    </div>
                )}

                {result && result.sections.length > 0 && (
                    <>
                        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                            {t('imnci_ui.courses.convert.found', '{{sections}} sections and {{figures}} figures found in {{pages}} pages of {{file}}. The text becomes the Read tab and the figures the See tab.', { sections: result.sections.length, figures: result.images?.length || 0, pages: result.pageCount, file: result.fileName })}
                        </div>

                        {result.warnings.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                                <div className="font-semibold mb-1">{t('imnci_ui.courses.convert.worth_knowing', 'Worth knowing')}</div>
                                <ul className="list-disc ms-5 space-y-0.5 max-h-28 overflow-y-auto">
                                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}

                        {/* The AI conversion: tried beside the standard one, section by
                            section, and chosen by the author after looking at both. */}
                        <div className="p-3 rounded border border-sky-200 bg-sky-50/50 space-y-2 text-sm">
                            <div className="flex flex-wrap items-center gap-2 justify-between">
                                <span className="flex items-center gap-1.5 font-semibold text-sky-900">
                                    <Sparkles size={15} /> {t('imnci_ui.courses.convert.ai_title', 'AI conversion')}
                                </span>
                                {aiRun ? (
                                    <Button variant="secondary" className="px-2 py-1 h-auto" onClick={() => { stopAi.current = true; }}>
                                        <X size={14} /> {t('imnci_ui.courses.convert.ai_stop', 'Stop')}
                                    </Button>
                                ) : aiReady < result.sections.length && (
                                    <Button variant="secondary" className="px-2 py-1 h-auto" onClick={runAi} disabled={busy}>
                                        <Sparkles size={14} /> {aiReady ? t('imnci_ui.courses.convert.ai_continue', 'Convert the rest with AI') : t('imnci_ui.courses.convert.ai_try', 'Try the AI conversion')}
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-slate-600">
                                {t('imnci_ui.courses.convert.ai_help', 'The AI rewrites each section\'s extracted text as clean reading text: lists, headings and bold restored, page headers removed, nothing added. Compare it with the standard version below and choose per section. Nothing is saved until Create sections.')}
                            </p>
                            {aiRun && (
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Loader2 size={14} className="animate-spin" />
                                    {t('imnci_ui.courses.convert.ai_progress', 'Section {{done}} of {{total}}', { done: Math.min(aiRun.done + 1, aiRun.total), total: aiRun.total })}
                                </div>
                            )}
                            {aiReady > 0 && !aiRun && (
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="ghost" className="px-2 py-1 h-auto" onClick={() => chooseForAll('ai')}>{t('imnci_ui.courses.convert.use_ai_all', 'Use AI for all')}</Button>
                                    <Button variant="ghost" className="px-2 py-1 h-auto" onClick={() => chooseForAll('standard')}>{t('imnci_ui.courses.convert.use_standard_all', 'Use standard for all')}</Button>
                                </div>
                            )}
                        </div>

                        <div className="border rounded max-h-80 overflow-y-auto divide-y text-sm">
                            {result.sections.map((sec, i) => {
                                const draft = drafts[i];
                                const picked = choice[i] === 'ai' && draft?.blocks ? 'ai' : 'standard';
                                return (
                                    <div key={i}>
                                        <div className="px-3 py-1.5 flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-xs text-slate-500 w-14 shrink-0">{sec.number}</span>
                                            <button type="button" className="flex-1 min-w-0 truncate text-start hover:text-sky-700"
                                                onClick={() => setViewing(viewing === i ? null : i)}>{sec.title}</button>
                                            <span className="text-xs text-slate-400 shrink-0">
                                                p{sec.startPage}-{sec.endPage} · {countWords(sec)}w
                                            </span>
                                            {draft?.error && <span className="text-xs text-red-600" title={draft.error}>{t('imnci_ui.courses.convert.ai_failed', 'AI failed')}</span>}
                                            {draft?.truncated && <span className="text-xs text-amber-700">{t('imnci_ui.courses.convert.ai_cut', 'AI cut short')}</span>}
                                            {draft?.blocks && (
                                                <span className="flex rounded border border-slate-300 overflow-hidden text-xs shrink-0">
                                                    {['standard', 'ai'].map((v) => (
                                                        <button key={v} type="button" onClick={() => setChoice((c) => ({ ...c, [i]: v }))}
                                                            className={`px-2 py-0.5 ${picked === v ? 'bg-sky-600 text-white' : 'bg-white text-slate-600'}`}>
                                                            {v === 'ai' ? 'AI' : t('imnci_ui.courses.convert.standard', 'Standard')}
                                                        </button>
                                                    ))}
                                                </span>
                                            )}
                                        </div>
                                        {viewing === i && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-3 pb-3">
                                                <div className={`rounded border p-2 max-h-72 overflow-y-auto ${picked === 'standard' ? 'border-sky-400' : 'border-slate-200'}`}>
                                                    <div className="text-xs font-semibold text-slate-500 mb-1">{t('imnci_ui.courses.convert.standard', 'Standard')}</div>
                                                    <ContentBlocks blocks={(sec.read || []).filter((b) => b.type !== 'image')} scale={0.85} />
                                                </div>
                                                <div className={`rounded border p-2 max-h-72 overflow-y-auto ${picked === 'ai' ? 'border-sky-400' : 'border-slate-200'}`}>
                                                    <div className="text-xs font-semibold text-slate-500 mb-1">AI{draft?.model ? ` · ${draft.model}` : ''}</div>
                                                    {draft?.blocks ? <ContentBlocks blocks={draft.blocks} scale={0.85} />
                                                        : <p className="text-xs text-slate-400">{draft?.error || t('imnci_ui.courses.convert.ai_not_yet', 'Not converted with AI yet.')}</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <label className="flex items-start gap-2 text-sm">
                            <input type="checkbox" className="mt-1" checked={capturePages}
                                onChange={(e) => setCapturePages(e.target.checked)} />
                            <span>
                                {t('imnci_ui.courses.convert.capture_pages', 'Capture each page as a picture for the See tab')}
                                <span className="block text-xs text-slate-500">
                                    {t('imnci_ui.courses.convert.capture_help', 'The classification charts are drawn, not typed, so their colours survive only as a picture of the page. Adds about {{n}} uploads.', { n: result.sections.length ? (result.sections[result.sections.length - 1].endPage
                                        - result.sections[0].startPage + 1) : 0 })}
                                </span>
                            </span>
                        </label>

                        {existingCount > 0 && (
                            <label className="flex items-start gap-2 text-sm">
                                <input type="checkbox" className="mt-1" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                                <span>
                                    {t('imnci_ui.courses.convert.hide_existing_n', 'Hide the {{n}} sections already in that module', { n: existingCount })}
                                    <span className="block text-xs text-slate-500">
                                        {t('imnci_ui.courses.convert.hide_help', 'Leave this off to add the new sections beside them. Hidden sections can be restored from Deleted.')}
                                    </span>
                                </span>
                            </label>
                        )}
                    </>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={busy || !!aiRun}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={commit} disabled={busy || !!aiRun || !result?.sections?.length || !moduleId}>
                        {t('imnci_ui.courses.convert.create_n', 'Create {{n}} sections', { n: result?.sections?.length || 0 })}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
