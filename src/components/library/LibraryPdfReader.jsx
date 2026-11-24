// src/components/library/LibraryPdfReader.jsx
//
// Reading a library book inside the app: the downloaded PDF is rendered
// page by page with pdf.js (loaded on demand, the way aiLibrary/bookText.js
// loads it), so reading never hands the book to another app and works with
// no connection. Pages are drawn as they near the screen and cleared when
// they scroll away, so even a long guideline stays light on the phone.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button, Spinner } from '../CommonComponents';
import { downloadedBookBytes } from './libraryDownload';

const loadPdfjs = async () => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjs;
};

export default function LibraryPdfReader({ item, onClose }) {
    const { t } = useTranslation();
    const [phase, setPhase] = useState('loading'); // loading | ready | error
    const [count, setCount] = useState(0);
    const [current, setCurrent] = useState(1);
    const [ratio, setRatio] = useState(null); // { w, h } of the first page
    const scrollRef = useRef(null);
    const holdersRef = useRef([]);
    const pdfRef = useRef(null);
    const renderedRef = useRef(new Set());
    const tasksRef = useRef(new Map());

    // Keep the page behind the reader from scrolling.
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [pdfjs, data] = await Promise.all([loadPdfjs(), downloadedBookBytes(item)]);
                if (!alive) return;
                const pdf = await pdfjs.getDocument({ data }).promise;
                if (!alive) { pdf.destroy(); return; }
                pdfRef.current = pdf;
                const first = await pdf.getPage(1);
                const v = first.getViewport({ scale: 1 });
                if (!alive) return;
                setRatio({ w: v.width, h: v.height });
                setCount(pdf.numPages);
                setPhase('ready');
            } catch (e) {
                console.error('PDF reader failed:', e);
                if (alive) setPhase('error');
            }
        })();
        return () => {
            alive = false;
            tasksRef.current.forEach((task) => { try { task.cancel(); } catch { /* done */ } });
            tasksRef.current.clear();
            pdfRef.current?.destroy?.();
            pdfRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item?.id]);

    const renderPage = async (n) => {
        const pdf = pdfRef.current;
        const holder = holdersRef.current[n - 1];
        if (!pdf || !holder || renderedRef.current.has(n)) return;
        renderedRef.current.add(n);
        try {
            const page = await pdf.getPage(n);
            const canvas = holder.querySelector('canvas');
            if (!canvas || !renderedRef.current.has(n)) return;
            const unscaled = page.getViewport({ scale: 1 });
            holder.style.aspectRatio = `${unscaled.width} / ${unscaled.height}`;
            const width = holder.clientWidth || window.innerWidth;
            const scale = (width / unscaled.width) * Math.min(window.devicePixelRatio || 1, 2);
            const viewport = page.getViewport({ scale });
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const task = page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport });
            tasksRef.current.set(n, task);
            await task.promise;
            tasksRef.current.delete(n);
        } catch (e) {
            if (e?.name !== 'RenderingCancelledException') console.warn('Page render failed:', e);
            renderedRef.current.delete(n);
        }
    };

    const clearPage = (n) => {
        if (!renderedRef.current.has(n)) return;
        renderedRef.current.delete(n);
        const task = tasksRef.current.get(n);
        if (task) { try { task.cancel(); } catch { /* done */ } tasksRef.current.delete(n); }
        const canvas = holdersRef.current[n - 1]?.querySelector('canvas');
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    };

    // Draw pages as they approach the screen; release them as they leave.
    useEffect(() => {
        if (phase !== 'ready' || !scrollRef.current) return undefined;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const n = Number(entry.target.dataset.page);
                if (entry.isIntersecting) renderPage(n);
                else clearPage(n);
            });
        }, { root: scrollRef.current, rootMargin: '800px 0px' });
        holdersRef.current.forEach((h) => { if (h) observer.observe(h); });
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, count]);

    const onScroll = () => {
        const box = scrollRef.current;
        if (!box) return;
        const probe = box.scrollTop + box.clientHeight * 0.4;
        let page = 1;
        holdersRef.current.forEach((h, i) => { if (h && h.offsetTop <= probe) page = i + 1; });
        setCurrent((prev) => (prev === page ? prev : page));
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-200" role="dialog" aria-label={item.name}>
            <div className="flex items-center gap-2 bg-white px-3 py-2 shadow-sm">
                <button type="button" onClick={onClose} aria-label={t('library.close', 'Close')} className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100">
                    <X size={20} />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
                    {phase === 'ready' && (
                        <p className="text-xs text-slate-500">{t('library.reader.page_of', 'Page {{current}} of {{count}}', { current, count })}</p>
                    )}
                </div>
            </div>
            <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto">
                {phase === 'loading' && (
                    <div className="grid place-items-center gap-3 py-24 text-slate-600">
                        <Spinner />
                        <p className="text-sm">{t('library.reader.opening', 'Opening the book…')}</p>
                    </div>
                )}
                {phase === 'error' && (
                    <div className="mx-auto max-w-md space-y-4 p-6 text-center">
                        <p className="text-sm leading-relaxed text-slate-700">{t('library.reader.failed', 'This book could not be opened in the app. You can still open it in another app.')}</p>
                        <Button variant="secondary" onClick={onClose}>{t('library.close', 'Close')}</Button>
                    </div>
                )}
                {phase === 'ready' && (
                    <div className="mx-auto max-w-3xl space-y-3 p-3">
                        {Array.from({ length: count }, (_, i) => (
                            <div
                                key={i}
                                data-page={i + 1}
                                ref={(el) => { holdersRef.current[i] = el; }}
                                className="bg-white shadow"
                                style={ratio ? { aspectRatio: `${ratio.w} / ${ratio.h}` } : undefined}
                            >
                                <canvas className="block h-full w-full" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
