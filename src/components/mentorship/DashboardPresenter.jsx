// DashboardPresenter.jsx
//
// Presentation mode for the mentorship dashboard: every chart, table and KPI
// group on the current tab becomes a slide, shown one at a time across the
// whole screen, PowerPoint-style, for presenting at meetings and events.
//
// Slides are the cards that carry a "Copy as Image" button — CopyImageButton
// tags its card with data-present-slide — so a new chart joins the deck
// without anyone remembering to register it here.
//
// The card itself is shown, not a copy: it is lifted to fill the screen with
// CSS and everything else on the page is hidden. Charts stay live (tooltips,
// crisp at any resolution) and Chart.js resizes them to the screen on its own.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chart } from 'chart.js';
import { useTranslation } from 'react-i18next';
import { Modal } from '../CommonComponents';

const PRESENTING_CLASS = 'mdp-presenting';
const ACTIVE_ATTR = 'data-present-active';
const ANCESTOR_ATTR = 'data-present-ancestor';
const GROW_ATTR = 'data-present-grow';
const AUTO_ADVANCE_OPTIONS = [0, 10, 20, 30, 60];
const CONTROLS_IDLE_MS = 2500;

const PRESENTER_CSS = `
html.${PRESENTING_CLASS}, html.${PRESENTING_CLASS} body { overflow: hidden !important; }
html.${PRESENTING_CLASS} body * { visibility: hidden !important; }
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}], html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] *,
html.${PRESENTING_CLASS} .mdp-overlay, html.${PRESENTING_CLASS} .mdp-overlay * { visibility: visible !important; }
html.${PRESENTING_CLASS} [${ANCESTOR_ATTR}] {
    transform: none !important; filter: none !important; backdrop-filter: none !important;
    perspective: none !important; contain: none !important; will-change: auto !important;
    animation: none !important; content-visibility: visible !important;
}
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] {
    position: fixed !important; inset: 0 !important; z-index: 2147483000 !important;
    width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important;
    margin: 0 !important; border: none !important; border-radius: 0 !important; box-shadow: none !important;
    transform: none !important; background: #fff !important; overflow: auto !important;
    padding: 4.5rem 4vw 5.5rem !important; box-sizing: border-box !important;
}
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}]:not([data-present-kind="kpi"]) { display: flex !important; flex-direction: column !important; }
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}][data-present-kind="kpi"] { align-content: center !important; gap: 2rem !important; }
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] [${GROW_ATTR}] {
    flex: 1 1 0 !important; min-height: 0 !important; height: auto !important; max-height: none !important;
    display: flex !important; flex-direction: column !important;
}
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] .exclude-from-export { display: none !important; }
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] h3, html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] h4 {
    font-size: clamp(1.4rem, 2.2vw, 2.6rem) !important; line-height: 1.25 !important; margin-bottom: 1.5rem !important;
}
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}][data-present-kind="kpi"] h4 { font-size: clamp(1rem, 1.5vw, 1.6rem) !important; margin-bottom: 1rem !important; }
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}][data-present-kind="kpi"] [class*="text-3xl"],
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}][data-present-kind="kpi"] [class*="text-4xl"],
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}][data-present-kind="kpi"] .font-extrabold { font-size: clamp(2.5rem, 5vw, 5.5rem) !important; line-height: 1.1 !important; }
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] table { font-size: clamp(0.9rem, 1.15vw, 1.35rem) !important; }
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] table [class*="text-xs"], html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] table [class*="text-sm"] { font-size: inherit !important; }
`;

const isVisible = (el) => !!el && el.isConnected && el.getClientRects().length > 0;

/**
 * The slides on the page, in reading order. KPI tiles are shown as their whole
 * row: a single number alone on a screen is not much of a slide.
 */
export const collectSlides = (container) => {
    if (!container) return [];
    const seen = new Set();
    const slides = [];
    container.querySelectorAll('[data-present-slide]').forEach((el) => {
        if (!isVisible(el)) return;
        const kind = el.getAttribute('data-present-kind') || 'chart';
        let target = el;
        let title = el.getAttribute('data-present-slide') || '';
        if (kind === 'kpi' && el.parentElement && el.parentElement !== container) {
            target = el.parentElement;
            const tiles = Array.from(target.querySelectorAll('[data-present-kind="kpi"]'));
            title = tiles.map((t) => t.getAttribute('data-present-slide')).filter(Boolean).join(' · ');
        }
        // A slide inside one already taken (a KPI row) is shown with it.
        if (seen.has(target) || slides.some((s) => s.el.contains(target) && s.kind === 'kpi')) return;
        seen.add(target);
        slides.push({ el: target, title, kind, hasChart: !!target.querySelector('canvas') });
    });
    return slides;
};

const markAncestors = (el, on) => {
    let node = el?.parentElement;
    while (node && node !== document.documentElement) {
        if (on) node.setAttribute(ANCESTOR_ATTR, '');
        else node.removeAttribute(ANCESTOR_ATTR);
        node = node.parentElement;
    }
};

// Let each chart's box take the room left on the screen: Chart.js sizes the
// canvas to its parent, so that parent and every wrapper up to the card grow.
const markGrowPath = (slideEl) => {
    const marked = [];
    slideEl.querySelectorAll('canvas').forEach((canvas) => {
        let node = canvas.parentElement;
        while (node && node !== slideEl) {
            if (!node.hasAttribute(GROW_ATTR)) { node.setAttribute(GROW_ATTR, ''); marked.push(node); }
            node = node.parentElement;
        }
    });
    return marked;
};

// Chart text is set for a dashboard card; on a projector it needs to grow with
// the screen. Every font a chart sets — or would take from the 12px default —
// is scaled for as long as its slide is up, then put back exactly as it was.
//
// Fonts are remembered by path, not by object: Chart.js rebuilds
// options.scales on every update, so the objects changed here are not the
// ones in use by the time they are put back.
const DEFAULT_FONT_SIZE = 12;
const getPath = (root, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), root);
const ensurePath = (root, path) => path.reduce((o, k) => (o[k] && typeof o[k] === 'object' ? o[k] : (o[k] = {})), root);

const fontPaths = (options) => {
    const paths = [];
    const plugins = options.plugins || {};
    if (plugins.legend?.display !== false) paths.push([['plugins', 'legend', 'labels'], 'font']);
    if (plugins.title?.display) paths.push([['plugins', 'title'], 'font']);
    if (plugins.datalabels && plugins.datalabels.display !== false) paths.push([['plugins', 'datalabels'], 'font']);
    paths.push([['plugins', 'tooltip'], 'bodyFont'], [['plugins', 'tooltip'], 'titleFont']);
    Object.entries(options.scales || {}).forEach(([id, scale]) => {
        if (!scale || scale.display === false) return;
        paths.push([['scales', id, 'ticks'], 'font']);
        if (scale.title?.display) paths.push([['scales', id, 'title'], 'font']);
    });
    return paths;
};

const enlargeCharts = (slideEl) => {
    const factor = Math.min(2, Math.max(1.25, window.innerWidth / 1100));
    const charts = [];
    slideEl.querySelectorAll('canvas').forEach((canvas) => {
        const chart = Chart.getChart(canvas);
        const options = chart?.config?.options;
        if (!options) return;
        const saved = [];
        fontPaths(options).forEach(([path, key]) => {
            const prev = getPath(options, [...path, key]);
            // A scriptable font (a function) is left alone.
            if (typeof prev === 'function') return;
            saved.push({ path, key, prev: prev && typeof prev === 'object' ? { ...prev } : prev });
            ensurePath(options, path)[key] = { ...(prev || {}), size: Math.round((prev?.size || DEFAULT_FONT_SIZE) * factor) };
        });
        chart.update('none');
        charts.push({ chart, saved });
    });
    return charts;
};

const restoreCharts = (charts) => {
    charts.forEach(({ chart, saved }) => {
        const options = chart?.config?.options;
        if (!options || !chart.canvas) return;
        saved.forEach(({ path, key, prev }) => {
            const holder = getPath(options, path);
            if (!holder) return;
            if (prev === undefined) delete holder[key]; else holder[key] = prev;
        });
        chart.update('none');
    });
};

// Remember each chart's size on the dashboard. A chart's box there often takes
// its height from the canvas, so once stretched to the screen it would never
// shrink back on its own.
const rememberChartSizes = (slideEl) => Array.from(slideEl.querySelectorAll('canvas'))
    .map((canvas) => Chart.getChart(canvas))
    .filter(Boolean)
    .map((chart) => ({ chart, width: chart.width, height: chart.height }));

const Icon = ({ d, className = 'w-5 h-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
);
const ICONS = {
    present: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v-5.5m3 5.5V8.25m3 3v-2',
    prev: 'M15.75 19.5L8.25 12l7.5-7.5',
    next: 'M8.25 4.5l7.5 7.5-7.5 7.5',
    close: 'M6 18L18 6M6 6l12 12',
    play: 'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z',
    pause: 'M15.75 5.25v13.5m-7.5-13.5v13.5',
    expand: 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15',
    grid: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
};

/**
 * "Present" button plus the presentation itself.
 *
 * @param {object} props
 * @param {React.RefObject<HTMLElement>} props.containerRef  the dashboard area whose cards become slides
 * @param {string} props.deckTitle    shown in the corner of every slide (service)
 * @param {string} [props.deckSubtitle]  e.g. the filters in force
 */
export default function DashboardPresenter({ containerRef, deckTitle, deckSubtitle }) {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language?.startsWith('ar');

    const [setupOpen, setSetupOpen] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [autoAdvance, setAutoAdvance] = useState(0);

    const [deck, setDeck] = useState(null); // slides being presented, or null
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [blackout, setBlackout] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const enteredFullscreen = useRef(false);
    const touchStart = useRef(null);

    // --- Setup ---
    const openSetup = () => {
        const found = collectSlides(containerRef.current);
        setCandidates(found);
        setSelected(new Set(found.map((_, i) => i)));
        setSetupOpen(true);
    };

    const toggleSelected = (i) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i); else next.add(i);
        return next;
    });

    const start = async (fromIndex = 0, selection = selected) => {
        const slides = candidates.filter((_, i) => selection.has(i));
        if (!slides.length) return;
        setSetupOpen(false);
        // Must be asked for inside the click; a browser without it (iOS Safari)
        // still gets the full-window view.
        try {
            if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
                enteredFullscreen.current = true;
            }
        } catch { /* full-window view only */ }
        setIndex(fromIndex);
        setPlaying(autoAdvance > 0);
        setBlackout(false);
        setShowGrid(false);
        setDeck(slides);
    };

    const stop = useCallback(() => {
        setDeck(null);
        setPlaying(false);
        if (enteredFullscreen.current && document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => {});
        }
        enteredFullscreen.current = false;
    }, []);

    // --- Apply the current slide to the page ---
    useEffect(() => {
        if (!deck) return undefined;
        const slide = deck[index];
        let el = slide?.el;
        // The dashboard may have re-rendered underneath: find the card again by title.
        if (el && !el.isConnected) {
            const again = collectSlides(containerRef.current).find((s) => s.title === slide.title);
            el = again?.el;
        }
        if (!el) return undefined;

        const html = document.documentElement;
        html.classList.add(PRESENTING_CLASS);
        el.setAttribute(ACTIVE_ATTR, '');
        // A KPI row's container is not a card of its own, so it is tagged here
        // and untagged again after; a card keeps the kind CopyImageButton gave it.
        const addedKind = !el.hasAttribute('data-present-kind');
        if (addedKind) el.setAttribute('data-present-kind', slide.kind);
        const sizes = rememberChartSizes(el);
        markAncestors(el, true);
        const grown = markGrowPath(el);
        el.scrollTop = 0;
        // Chart.js listens for its box resizing; nudge anything that does not.
        let enlarged = [];
        const raf = requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
            enlarged = enlargeCharts(el);
        });

        return () => {
            cancelAnimationFrame(raf);
            restoreCharts(enlarged);
            el.removeAttribute(ACTIVE_ATTR);
            if (addedKind) el.removeAttribute('data-present-kind');
            markAncestors(el, false);
            grown.forEach((n) => n.removeAttribute(GROW_ATTR));
            html.classList.remove(PRESENTING_CLASS);
            sizes.forEach(({ chart, width, height }) => { if (chart.canvas) chart.resize(width, height); });
            requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
        };
    }, [deck, index, containerRef]);

    const go = useCallback((delta) => {
        if (!deck) return;
        setBlackout(false);
        setIndex((i) => Math.min(deck.length - 1, Math.max(0, i + delta)));
    }, [deck]);

    // --- Auto-advance ---
    useEffect(() => {
        if (!deck || !playing || !autoAdvance) return undefined;
        const timer = setTimeout(() => {
            if (index >= deck.length - 1) setPlaying(false);
            else setIndex(index + 1);
        }, autoAdvance * 1000);
        return () => clearTimeout(timer);
    }, [deck, playing, autoAdvance, index]);

    // --- Keyboard, fullscreen exit, idle controls ---
    useEffect(() => {
        if (!deck) return undefined;
        const forward = isAr ? 'ArrowLeft' : 'ArrowRight';
        const back = isAr ? 'ArrowRight' : 'ArrowLeft';
        const onKey = (e) => {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const k = e.key;
            if ([forward, 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(k)) { e.preventDefault(); go(1); }
            else if ([back, 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(k)) { e.preventDefault(); go(-1); }
            else if (k === 'Home') { e.preventDefault(); setIndex(0); }
            else if (k === 'End') { e.preventDefault(); setIndex(deck.length - 1); }
            else if (k === 'Escape') { e.preventDefault(); if (showGrid) setShowGrid(false); else stop(); }
            else if (k === 'b' || k === 'B' || k === '.') setBlackout((v) => !v);
            else if (k === 'g' || k === 'G') setShowGrid((v) => !v);
            else if (k === 'f' || k === 'F') toggleFullscreen();
        };
        const onFs = () => {
            const fs = !!document.fullscreenElement;
            setIsFullscreen(fs);
            // Esc in fullscreen is taken by the browser, so leaving it ends the show.
            if (!fs && enteredFullscreen.current) stop();
        };
        let idleTimer;
        const onMove = () => {
            setControlsVisible(true);
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => setControlsVisible(false), CONTROLS_IDLE_MS);
        };
        // Swipe anywhere, except along something that scrolls sideways (a wide table).
        const scrollsSideways = (node) => {
            for (let n = node; n && n !== document.body; n = n.parentElement) {
                if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
            }
            return false;
        };
        const onTouchStart = (e) => {
            const p = e.touches[0];
            touchStart.current = scrollsSideways(e.target) ? null : { x: p.clientX, y: p.clientY };
            onMove();
        };
        const onTouchEnd = (e) => {
            const st = touchStart.current; touchStart.current = null;
            if (!st) return;
            const p = e.changedTouches[0];
            const dx = p.clientX - st.x; const dy = p.clientY - st.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go((dx < 0) !== isAr ? 1 : -1);
        };
        onMove();
        setIsFullscreen(!!document.fullscreenElement);
        window.addEventListener('keydown', onKey);
        document.addEventListener('fullscreenchange', onFs);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            clearTimeout(idleTimer);
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('fullscreenchange', onFs);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [deck, go, stop, showGrid, isAr]);

    // Never leave the page stuck in presentation mode.
    useEffect(() => () => {
        document.documentElement.classList.remove(PRESENTING_CLASS);
    }, []);

    const toggleFullscreen = () => {
        if (document.fullscreenElement) {
            enteredFullscreen.current = false;
            document.exitFullscreen?.().catch(() => {});
        } else {
            document.documentElement.requestFullscreen?.().then(() => { enteredFullscreen.current = true; }).catch(() => {});
        }
    };

    const progress = deck ? ((index + 1) / deck.length) * 100 : 0;
    const chartCount = useMemo(() => candidates.filter((c) => c.hasChart).length, [candidates]);

    const btn = 'p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

    const overlay = deck && createPortal(
        <div className="mdp-overlay" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="fixed top-0 inset-x-0 z-[2147483001] flex items-center justify-between px-[4vw] py-3 pointer-events-none">
                <div className="min-w-0">
                    <div className="text-sm sm:text-base font-extrabold text-slate-800 truncate">{deckTitle}</div>
                    {deckSubtitle && <div className="text-xs sm:text-sm font-semibold text-sky-700 truncate">{deckSubtitle}</div>}
                </div>
                <div className="text-sm font-bold text-slate-500 tabular-nums shrink-0" dir="ltr">{index + 1} / {deck.length}</div>
            </div>
            <div className="fixed bottom-0 inset-x-0 h-1 bg-slate-200 z-[2147483001]">
                <div className="h-full bg-sky-600 transition-all duration-300" style={{ width: `${progress}%`, marginInlineStart: 0 }} />
            </div>

            <div className="fixed inset-x-0 bottom-0 z-[2147483002] flex justify-center pb-4 pointer-events-none">
                <div className={`pointer-events-auto flex items-center gap-1 bg-slate-900/85 backdrop-blur rounded-2xl px-2 py-1.5 shadow-2xl transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
                    <button className={btn} onClick={() => go(-1)} disabled={index === 0} title={t('Previous')}><Icon d={isAr ? ICONS.next : ICONS.prev} /></button>
                    <span className="text-white/90 text-sm font-bold tabular-nums px-2 min-w-[4.5rem] text-center" dir="ltr">{index + 1} / {deck.length}</span>
                    <button className={btn} onClick={() => go(1)} disabled={index === deck.length - 1} title={t('Next')}><Icon d={isAr ? ICONS.prev : ICONS.next} /></button>
                    <span className="w-px h-6 bg-white/20 mx-1" />
                    {autoAdvance > 0 && (
                        <button className={btn} onClick={() => setPlaying((v) => !v)} title={playing ? t('Pause') : t('Play')}><Icon d={playing ? ICONS.pause : ICONS.play} /></button>
                    )}
                    <button className={btn} onClick={() => setShowGrid((v) => !v)} title={`${t('All slides')} (G)`}><Icon d={ICONS.grid} /></button>
                    {document.documentElement.requestFullscreen && (
                        <button className={btn} onClick={toggleFullscreen} title={`${isFullscreen ? t('Exit full screen') : t('Full screen')} (F)`}><Icon d={ICONS.expand} /></button>
                    )}
                    <button className={btn} onClick={stop} title={`${t('End presentation')} (Esc)`}><Icon d={ICONS.close} /></button>
                </div>
            </div>

            {blackout && (
                <button type="button" className="fixed inset-0 z-[2147483003] bg-black cursor-none" onClick={() => setBlackout(false)} aria-label={t('Resume')} />
            )}

            {showGrid && (
                <div className="fixed inset-0 z-[2147483004] bg-slate-900/95 overflow-auto p-6 sm:p-10">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-white text-xl font-extrabold">{t('Go to slide')}</h2>
                        <button className={btn} onClick={() => setShowGrid(false)}><Icon d={ICONS.close} /></button>
                    </div>
                    <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {deck.map((s, i) => (
                            <li key={i}>
                                <button
                                    onClick={() => { setIndex(i); setShowGrid(false); setBlackout(false); }}
                                    className={`w-full text-start p-4 rounded-xl border-2 transition-colors ${i === index ? 'border-sky-400 bg-sky-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                                >
                                    <div className="text-sky-300 text-xs font-bold mb-1">{i + 1} · {s.kind === 'kpi' ? t('Key figures') : s.hasChart ? t('Chart') : t('Table')}</div>
                                    <div className="text-white font-semibold text-sm line-clamp-2">{s.title || t('Untitled')}</div>
                                </button>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>,
        document.body,
    );

    return (
        <>
            <style>{PRESENTER_CSS}</style>
            <button
                type="button"
                onClick={openSetup}
                className="exclude-from-export flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-sm transition-colors"
                title={t('Show each chart full screen, one at a time, for presenting')}
            >
                <Icon d={ICONS.present} />
                {t('Present')}
            </button>

            <Modal isOpen={setupOpen} onClose={() => setSetupOpen(false)} title={t('Present dashboard')}>
                <div className="p-4 sm:p-6 space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
                    {candidates.length === 0 ? (
                        <p className="text-slate-600">{t('There are no charts on this tab to present. Wait for the data to load, or switch tabs.')}</p>
                    ) : (
                        <>
                            <p className="text-sm text-slate-600">
                                {t('Each chart is shown full screen, one at a time. Slides come from the tab you are on')} ({candidates.length} {t('slides')}, {chartCount} {t('charts')}).
                            </p>
                            <div className="flex flex-wrap gap-3 items-center justify-between">
                                <div className="flex gap-3 text-sm">
                                    <button type="button" className="text-sky-700 font-semibold hover:underline" onClick={() => setSelected(new Set(candidates.map((_, i) => i)))}>{t('Select all')}</button>
                                    <button type="button" className="text-sky-700 font-semibold hover:underline" onClick={() => setSelected(new Set(candidates.map((c, i) => (c.hasChart ? i : -1)).filter((i) => i >= 0)))}>{t('Charts only')}</button>
                                    <button type="button" className="text-sky-700 font-semibold hover:underline" onClick={() => setSelected(new Set())}>{t('Clear')}</button>
                                </div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    {t('Auto-advance')}
                                    <select value={autoAdvance} onChange={(e) => setAutoAdvance(Number(e.target.value))} className="border border-slate-300 rounded-md p-1.5 text-sm">
                                        {AUTO_ADVANCE_OPTIONS.map((s) => <option key={s} value={s}>{s === 0 ? t('Off') : `${s} ${t('seconds')}`}</option>)}
                                    </select>
                                </label>
                            </div>
                            <ol className="max-h-[45vh] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                                {candidates.map((c, i) => (
                                    <li key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50">
                                        <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelected(i)} className="h-4 w-4 accent-sky-600" id={`mdp-slide-${i}`} />
                                        <label htmlFor={`mdp-slide-${i}`} className="flex-1 text-sm cursor-pointer min-w-0">
                                            <span className="text-slate-400 font-semibold me-2">{i + 1}.</span>
                                            <span className="font-semibold text-slate-800">{c.title || t('Untitled')}</span>
                                            <span className="ms-2 text-[11px] font-bold uppercase text-slate-400">{c.kind === 'kpi' ? t('Key figures') : c.hasChart ? t('Chart') : t('Table')}</span>
                                        </label>
                                        <button type="button" className="text-xs font-bold text-sky-700 hover:underline shrink-0" onClick={() => {
                                            const selection = new Set(selected).add(i);
                                            setSelected(selection);
                                            start(candidates.filter((_, j) => selection.has(j)).indexOf(c), selection);
                                        }}>
                                            {t('Start here')}
                                        </button>
                                    </li>
                                ))}
                            </ol>
                            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                                <strong>{t('Controls')}:</strong> {t('→ / Space / Page Down: next')} · {t('← / Page Up: previous')} · {t('G: all slides')} · {t('B: black screen')} · {t('F: full screen')} · {t('Esc: end')}. {t('Presentation clickers work too. On a phone or tablet, swipe.')}
                            </div>
                        </>
                    )}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                        <button type="button" onClick={() => setSetupOpen(false)} className="px-4 py-2 text-slate-600 font-bold text-sm">{t('Cancel')}</button>
                        <button
                            type="button"
                            onClick={() => start(0)}
                            disabled={selected.size === 0}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm shadow-sm flex items-center gap-2"
                        >
                            <Icon d={ICONS.play} className="w-4 h-4" /> {t('Start presentation')} ({selected.size})
                        </button>
                    </div>
                </div>
            </Modal>

            {overlay}
        </>
    );
}
