// Copy one part of a page (a card, a KPI row, a table) as a PNG, ready to
// paste into WhatsApp. html-to-image draws Arabic text the way the browser
// does; html2canvas is the fallback. Wide tables are drawn in full, not cut at
// the screen edge. Elements marked .exclude-from-export are left out and
// elements marked .export-only (hidden on screen) are shown in the picture.
// Where the browser cannot put an image on the clipboard (the Android app,
// some phone browsers) the picture goes to the share sheet, or is downloaded.
// Returns 'copied', 'shared', 'downloaded' or 'cancelled'.
import { Capacitor } from '@capacitor/core';
import { runInLight } from './html2canvasLight';
import { shareFile } from './sharePdf';

const canvasBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

// Shows .export-only parts, opens horizontal scroll areas and widens the node
// so nothing is cut. Returns the function that puts everything back.
function prepare(node) {
    const undo = [];
    const set = (el, prop, value) => { undo.push([el, prop, el.style[prop]]); el.style[prop] = value; };
    node.querySelectorAll('.export-only').forEach((el) => set(el, 'display', 'block'));
    let extra = 0;
    node.querySelectorAll('.overflow-x-auto, .overflow-auto').forEach((el) => {
        extra = Math.max(extra, el.scrollWidth - el.clientWidth);
        set(el, 'overflow', 'visible');
    });
    // Arabic letters come apart when letter-spacing is set.
    node.querySelectorAll('*').forEach((el) => {
        const ls = window.getComputedStyle(el).letterSpacing;
        if (ls && ls !== 'normal' && parseFloat(ls) !== 0) set(el, 'letterSpacing', 'normal');
    });
    // A phone-width picture of a wide table is hard to read: draw at least
    // 640 px wide.
    const width = Math.max(node.offsetWidth + extra, 640);
    set(node, 'width', `${width}px`);
    set(node, 'maxWidth', 'none');
    return () => undo.reverse().forEach(([el, prop, value]) => { el.style[prop] = value; });
}

async function draw(node) {
    const filter = (el) => !el.classList || !el.classList.contains('exclude-from-export');
    try {
        const { toCanvas, getFontEmbedCSS } = await import('html-to-image');
        await document.fonts?.ready;
        let fontEmbedCSS;
        try { fontEmbedCSS = await getFontEmbedCSS(node); } catch { fontEmbedCSS = undefined; }
        return await toCanvas(node, {
            backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true, fontEmbedCSS, filter,
            // A little extra height: the copy can lay out a few pixels taller than
            // the page and would lose its bottom edge.
            width: node.scrollWidth, height: node.scrollHeight + 16, style: { margin: '0' },
        });
    } catch {
        const { default: html2canvas } = await import('html2canvas');
        return html2canvas(node, {
            backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true,
            ignoreElements: (el) => el.classList && el.classList.contains('exclude-from-export'),
        });
    }
}

/** The element as a PNG blob, drawn in the light theme. */
export function elementImage(node) {
    return runInLight(async () => {
        const restore = prepare(node);
        try {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return await canvasBlob(await draw(node));
        } finally {
            restore();
        }
    });
}

const canCopyImage = () => !Capacitor.isNativePlatform()
    && typeof window !== 'undefined' && window.isSecureContext
    && typeof window.ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

/** Copies the element as an image; falls back to share sheet / download. */
export async function copyElementImage(node, fileName = 'image.png', { title = '' } = {}) {
    if (!node) throw new Error('Nothing to copy.');
    if (canCopyImage()) {
        // The clipboard write starts at once (still inside the click) and gets
        // the picture when it is ready; Safari needs it this way.
        const blobPromise = elementImage(node).then((b) => { if (!b) throw new Error('The picture could not be made.'); return b; });
        try {
            await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blobPromise })]);
            return 'copied';
        } catch {
            const blob = await blobPromise; // a failed picture throws here
            return shareFile(blob, fileName, { title });
        }
    }
    const blob = await elementImage(node);
    if (!blob) throw new Error('The picture could not be made.');
    return shareFile(blob, fileName, { title });
}
