// html2canvas that always captures the light look (certificates, reports, PDFs),
// whatever theme is on screen. While dark, the page flips to light for the
// moment of capture (charts are canvases and must be redrawn in light colours),
// then flips back.
import html2canvas from 'html2canvas';
import { isDarkNow, applyTheme, getThemePref } from './theme';

/** Runs fn with the page in light colours, then restores the theme. */
export async function runInLight(fn) {
    if (!isDarkNow()) return fn();
    applyTheme('light');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
        return await fn();
    } finally {
        applyTheme(getThemePref());
    }
}

export default function html2canvasLight(element, options = {}) {
    return runInLight(() => html2canvas(element, options));
}
