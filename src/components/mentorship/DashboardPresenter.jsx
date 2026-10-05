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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chart } from 'chart.js';
import { useTranslation } from 'react-i18next';
import { Modal } from '../CommonComponents';

const PRESENTING_CLASS = 'mdp-presenting';
const ACTIVE_ATTR = 'data-present-active';
const ANCESTOR_ATTR = 'data-present-ancestor';
const GROW_ATTR = 'data-present-grow';
const CHARTBOX_ATTR = 'data-present-chartbox';
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
/* The box Chart.js draws into. On a tall screen (a phone held upright, a
   portrait monitor) filling all the height turned every chart into a narrow
   strip, so a chart is never taller than about 60% of its width; it is
   centred in whatever height is left. */
html.${PRESENTING_CLASS} [${ACTIVE_ATTR}] [${CHARTBOX_ATTR}] {
    max-height: min(100%, 56vw) !important; margin-block: auto !important; width: 100% !important;
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
        canvas.parentElement?.setAttribute(CHARTBOX_ATTR, '');
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

// Wait for a tab's cards to render: until the number of slides on the page
// stops changing (charts mount a little after their tab does).
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const waitForSlides = async (container, timeoutMs = 3000) => {
    await nextFrame(); await nextFrame();
    const startedAt = Date.now();
    let last = -1;
    let stable = 0;
    while (Date.now() - startedAt < timeoutMs) {
        const count = collectSlides(container).length;
        stable = count === last && count > 0 ? stable + 1 : 0;
        if (stable >= 2) break;
        last = count;
        await new Promise((r) => setTimeout(r, 150));
    }
};

// Slides are remembered by tab, title and position rather than by element:
// the element is gone as soon as its tab is switched away.
const describeSlides = (slides, section, sectionLabel) => {
    const seenTitles = {};
    return slides.map((s) => {
        const occurrence = seenTitles[s.title] = (seenTitles[s.title] ?? -1) + 1;
        return {
            key: `${section ?? ''}::${s.title}::${occurrence}`,
            section, sectionLabel, title: s.title, kind: s.kind, hasChart: s.hasChart, occurrence,
        };
    });
};

const findSlideElement = (container, slide) => {
    const matches = collectSlides(container).filter((s) => s.title === slide.title);
    return (matches[slide.occurrence] || matches[0])?.el || null;
};

/**
 * "Present" button plus the presentation itself.
 *
 * @param {object} props
 * @param {React.RefObject<HTMLElement>} props.containerRef  the dashboard area whose cards become slides
 * @param {string} props.deckTitle    shown in the corner of every slide (service)
 * @param {string} [props.deckSubtitle]  e.g. the filters in force
 * @param {{id: string, label: string}[]} [props.sections]  the dashboard's tabs, so one
 *        presentation can take slides from several of them
 * @param {string} [props.activeSection]  the tab on screen
 * @param {(id: string) => void} [props.onSelectSection]  switches the dashboard's tab
 */
export default function DashboardPresenter({ containerRef, deckTitle, deckSubtitle, sections = [], activeSection, onSelectSection }) {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language?.startsWith('ar');
    const hasSections = sections.length > 1 && !!onSelectSection;

    const [setupOpen, setSetupOpen] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [includedSections, setIncludedSections] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [startKey, setStartKey] = useState('');
    const [autoAdvance, setAutoAdvance] = useState(0);

    const [deck, setDeck] = useState(null); // slides being presented, or null
    const [index, setIndex] = useState(0);
    const [slideMissing, setSlideMissing] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [blackout, setBlackout] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const enteredFullscreen = useRef(false);
    const lockedOrientation = useRef(false);
    const touchStart = useRef(null);
    const sectionRef = useRef(activeSection);
    const homeSection = useRef(activeSection);
    sectionRef.current = activeSection;

    const showSection = useCallback(async (id) => {
        if (!hasSections || !id || sectionRef.current === id) return;
        onSelectSection(id);
        sectionRef.current = id;
        await waitForSlides(containerRef.current);
    }, [hasSections, onSelectSection, containerRef]);

    // --- Setup ---
    const sectionLabel = (id) => sections.find((s) => s.id === id)?.label || '';

    // Visits each chosen tab in turn and lists its cards, then goes back to
    // the tab the user was on.
    const scan = async (sectionIds) => {
        setScanning(true);
        const home = sectionRef.current;
        const found = [];
        try {
            if (!hasSections) {
                found.push(...describeSlides(collectSlides(containerRef.current), null, ''));
            } else {
                for (const id of sectionIds) {
                    await showSection(id);
                    found.push(...describeSlides(collectSlides(containerRef.current), id, sectionLabel(id)));
                }
                await showSection(home);
            }
        } finally {
            setScanning(false);
        }
        setCandidates(found);
        setSelected(new Set(found.map((c) => c.key)));
        setStartKey(found[0]?.key || '');
    };

    const openSetup = () => {
        const initial = hasSections ? [activeSection] : [];
        setIncludedSections(initial);
        setSetupOpen(true);
        scan(initial);
    };

    const toggleSection = (id) => {
        const next = includedSections.includes(id)
            ? includedSections.filter((s) => s !== id)
            : sections.map((s) => s.id).filter((s) => s === id || includedSections.includes(s));
        setIncludedSections(next);
        scan(next);
    };

    const toggleSelected = (key) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const deckSlides = candidates.filter((c) => selected.has(c.key));
    const effectiveStartKey = deckSlides.some((c) => c.key === startKey) ? startKey : deckSlides[0]?.key;

    const start = async () => {
        if (!deckSlides.length) return;
        setSetupOpen(false);
        homeSection.current = sectionRef.current;
        // Must be asked for inside the click; a browser without it (iOS Safari)
        // still gets the full-window view.
        try {
            if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
                enteredFullscreen.current = true;
            }
        } catch { /* full-window view only */ }
        // A phone held upright squeezes every chart into a tall, narrow strip.
        // Turning to landscape is only possible in full screen, so it is asked
        // for and quietly skipped where the device says no.
        try {
            if (window.matchMedia?.('(pointer: coarse)').matches && screen.orientation?.lock) {
                await screen.orientation.lock('landscape');
                lockedOrientation.current = true;
            }
        } catch { /* stays as it is */ }
        setIndex(Math.max(0, deckSlides.findIndex((c) => c.key === effectiveStartKey)));
        setPlaying(autoAdvance > 0);
        setBlackout(false);
        setShowGrid(false);
        setDeck(deckSlides);
    };

    const stop = useCallback(() => {
        setDeck(null);
        setPlaying(false);
        if (lockedOrientation.current) {
            try { screen.orientation?.unlock?.(); } catch { /* nothing to undo */ }
            lockedOrientation.current = false;
        }
        if (enteredFullscreen.current && document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => {});
        }
        enteredFullscreen.current = false;
    }, []);

    // The page is hidden for the whole show, not slide by slide, so moving
    // between tabs never flashes the dashboard; the presenter's tab is put back after.
    useEffect(() => {
        if (!deck) return undefined;
        const html = document.documentElement;
        html.classList.add(PRESENTING_CLASS);
        return () => {
            html.classList.remove(PRESENTING_CLASS);
            const home = homeSection.current;
            if (hasSections && home && sectionRef.current !== home) onSelectSection(home);
        };
    }, [deck, hasSections, onSelectSection]);

    // --- Apply the current slide to the page ---
    useEffect(() => {
        if (!deck) return undefined;
        const slide = deck[index];
        let cancelled = false;
        let undo = null;
        setSlideMissing(false);

        (async () => {
            if (slide.section) await showSection(slide.section);
            if (cancelled) return;
            const el = findSlideElement(containerRef.current, slide);
            if (!el) { setSlideMissing(true); return; }

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

            undo = () => {
                cancelAnimationFrame(raf);
                restoreCharts(enlarged);
                el.removeAttribute(ACTIVE_ATTR);
                if (addedKind) el.removeAttribute('data-present-kind');
                markAncestors(el, false);
                grown.forEach((n) => { n.removeAttribute(GROW_ATTR); n.removeAttribute(CHARTBOX_ATTR); });
                sizes.forEach(({ chart, width, height }) => { if (chart.canvas) chart.resize(width, height); });
                requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
            };
        })();

        return () => { cancelled = true; undo?.(); };
    }, [deck, index, containerRef, showSection]);


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

    const btn = 'p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

    const overlay = deck && createPortal(
        <div className="mdp-overlay" dir={isAr ? 'rtl' : 'ltr'}>
            {/* Behind the slide: covers the page while a tab is switching. */}
            <div className="fixed inset-0 bg-white z-[2147482999] flex items-center justify-center">
                {slideMissing ? (
                    <div className="text-center text-slate-500 px-6">
                        <div className="text-lg font-bold text-slate-700 mb-1">{deck[index]?.title}</div>
                        {t('This chart is not on the dashboard any more (the data or filters may have changed).')}
                    </div>
                ) : (
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600" />
                )}
            </div>
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
                                    <div className="text-sky-300 text-xs font-bold mb-1">{i + 1} · {s.sectionLabel ? `${s.sectionLabel} · ` : ''}{s.kind === 'kpi' ? t('Key figures') : s.hasChart ? t('Chart') : t('Table')}</div>
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
                    {/* Start first: everything is selected already, so one click presents. */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <label className="flex-1 min-w-0 flex flex-col gap-1 text-sm font-semibold text-slate-700">
                            {t('Start from')}
                            <select
                                value={effectiveStartKey || ''}
                                onChange={(e) => setStartKey(e.target.value)}
                                disabled={scanning || deckSlides.length === 0}
                                className="border border-slate-300 rounded-md p-2 text-sm bg-white w-full"
                            >
                                {deckSlides.map((c, i) => (
                                    <option key={c.key} value={c.key}>
                                        {i + 1}. {c.sectionLabel ? `${c.sectionLabel} — ` : ''}{c.title || t('Untitled')}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={start}
                            disabled={scanning || deckSlides.length === 0}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm shadow-sm flex items-center justify-center gap-2 shrink-0"
                        >
                            <Icon d={ICONS.play} className="w-4 h-4" /> {t('Start presentation')} ({deckSlides.length})
                        </button>
                    </div>

                    {hasSections && (
                        <div>
                            <div className="text-sm font-semibold text-slate-700 mb-2">{t('Present from these tabs')}</div>
                            <div className="flex flex-wrap gap-2">
                                {sections.map((s) => {
                                    const on = includedSections.includes(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            disabled={scanning || (on && includedSections.length === 1)}
                                            onClick={() => toggleSection(s.id)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:cursor-not-allowed ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-sky-400'}`}
                                        >
                                            {on ? '✓ ' : ''}{s.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3 items-center justify-between">
                        <div className="flex gap-3 text-sm">
                            <button type="button" className="text-sky-700 font-semibold hover:underline" onClick={() => setSelected(new Set(candidates.map((c) => c.key)))}>{t('Select all')}</button>
                            <button type="button" className="text-sky-700 font-semibold hover:underline" onClick={() => setSelected(new Set(candidates.filter((c) => c.hasChart).map((c) => c.key)))}>{t('Charts only')}</button>
                            <button type="button" className="text-sky-700 font-semibold hover:underline" onClick={() => setSelected(new Set())}>{t('Clear')}</button>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            {t('Auto-advance')}
                            <select value={autoAdvance} onChange={(e) => setAutoAdvance(Number(e.target.value))} className="border border-slate-300 rounded-md p-1.5 text-sm">
                                {AUTO_ADVANCE_OPTIONS.map((s) => <option key={s} value={s}>{s === 0 ? t('Off') : `${s} ${t('seconds')}`}</option>)}
                            </select>
                        </label>
                    </div>

                    {scanning ? (
                        <div className="flex items-center justify-center gap-3 p-6 text-sky-700 text-sm font-semibold">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-600" />
                            {t('Collecting charts…')}
                        </div>
                    ) : candidates.length === 0 ? (
                        <p className="text-slate-600 text-sm">{t('There are no charts to present. Wait for the data to load, or choose another tab.')}</p>
                    ) : (
                        <ol className="max-h-[40vh] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {candidates.map((c, i) => (
                                <li key={c.key} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50">
                                    <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggleSelected(c.key)} className="h-4 w-4 accent-sky-600" id={`mdp-slide-${i}`} />
                                    <label htmlFor={`mdp-slide-${i}`} className="flex-1 text-sm cursor-pointer min-w-0">
                                        <span className="text-slate-400 font-semibold me-2">{i + 1}.</span>
                                        {c.sectionLabel && <span className="text-sky-700 font-semibold me-1">{c.sectionLabel} —</span>}
                                        <span className="font-semibold text-slate-800">{c.title || t('Untitled')}</span>
                                        <span className="ms-2 text-[11px] font-bold uppercase text-slate-400">{c.kind === 'kpi' ? t('Key figures') : c.hasChart ? t('Chart') : t('Table')}</span>
                                    </label>
                                </li>
                            ))}
                        </ol>
                    )}

                    <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                        <strong>{t('Controls')}:</strong> {t('→ / Space / Page Down: next')} · {t('← / Page Up: previous')} · {t('G: all slides')} · {t('B: black screen')} · {t('F: full screen')} · {t('Esc: end')}. {t('Presentation clickers work too. On a phone or tablet, swipe.')}
                    </div>
                    <div className="flex justify-end pt-2 border-t border-slate-200">
                        <button type="button" onClick={() => setSetupOpen(false)} className="px-4 py-2 text-slate-600 font-bold text-sm">{t('Cancel')}</button>
                    </div>
                </div>
            </Modal>

            {overlay}
        </>
    );
}
