// Turns a form on screen into an A4 PDF for printing, under the official
// letterhead: the FMOH logo, the program lines (Federal Ministry of Health,
// General Directorate of PHC, Maternal and Child Health Directorate, National
// Child Health Program), the form's name and the program logo.
//
// The form is captured as it is on screen, so an empty form gives a blank
// form to fill by hand and a filled one gives a record of the answers.
// Buttons rows (Save / Cancel / Next ...) and anything marked data-pdf-hide
// are left out. The page is laid out at desktop width whatever the screen,
// and pages break at blank rows so a line of text is not cut in half.
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import html2canvasLight from './html2canvasLight';
import { safeFileName } from './uploadValidation';
import fmohLogo from '../assets/print/fmoh-logo.jpg';
import programLogo from '../assets/print/nchp-logo.jpg';

export const LETTERHEAD_LINES = [
    'Federal Ministry of Health',
    'General Directorate of Primary Health Care',
    'Maternal and Child Health Directorate',
    'National Child Health Program',
];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 10;
const FOOTER_H = 8;
const CONTENT_W = PAGE_W - MARGIN * 2;
// Width the form is laid out at for the capture (desktop layout, fits A4).
const CAPTURE_WIDTH = 900;
const SCALE = 2;
// Phones refuse canvases much over ~16 million pixels, so long forms are
// captured at a lower resolution.
const MAX_CANVAS_PIXELS = 16_000_000;

const loadImage = (img) => (img.complete && img.naturalWidth
    ? Promise.resolve()
    : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; }));

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * html2canvas finds where text sits on its line with a 1px <img> beside a
 * sample word, in a hidden box it adds to the page body. Tailwind's base
 * styles make every img a block, which drops that img below the word, so all
 * text came out a few pixels too low (outside its boxes). While capturing,
 * keep that img inline. Returns a function that removes the fix.
 */
function fixTextBaseline() {
    const style = document.createElement('style');
    style.textContent = 'body > div[style*="hidden"] > img[width="1"][height="1"] { display: inline !important; }';
    document.head.appendChild(style);
    return () => style.remove();
}

/** The letterhead as an element off screen, ready to capture. */
function buildLetterhead(formName, subtitle) {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;left:-10000px;top:0;width:${CAPTURE_WIDTH}px;background:#fff;color:#0f172a;font-family:Arial,'Amiri',sans-serif;padding:8px 4px 10px;box-sizing:border-box;`;
    el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;" dir="ltr">
            <img src="${fmohLogo}" alt="" style="width:110px;height:110px;object-fit:contain;flex-shrink:0;" />
            <div style="flex:1;text-align:center;line-height:1.35;">
                ${LETTERHEAD_LINES.map((line, i) => `<div style="font-size:${i === 0 ? 21 : 17}px;font-weight:${i === 0 || i === 3 ? 700 : 600};">${escapeHtml(line)}</div>`).join('')}
            </div>
            <img src="${programLogo}" alt="" style="width:110px;height:110px;object-fit:contain;flex-shrink:0;" />
        </div>
        <div style="margin-top:10px;border-top:3px solid #1e3a8a;border-bottom:1px solid #1e3a8a;padding:9px 6px 7px;text-align:center;" dir="auto">
            <div style="font-size:23px;font-weight:800;color:#1e3a8a;">${escapeHtml(formName)}</div>
            ${subtitle ? `<div style="font-size:15px;color:#334155;margin-top:2px;">${escapeHtml(subtitle)}</div>` : ''}
        </div>`;
    document.body.appendChild(el);
    return el;
}

/**
 * In the copy that is captured: drop button rows and pinned bars, unpin
 * anything sticky (a pinned score would otherwise land mid-page), and let
 * the form take the full capture width.
 */
function prepareClone(clonedRoot) {
    const win = clonedRoot.ownerDocument.defaultView;
    clonedRoot.style.width = `${CAPTURE_WIDTH}px`;
    clonedRoot.style.maxWidth = 'none';
    clonedRoot.style.margin = '0';
    clonedRoot.style.boxShadow = 'none';
    clonedRoot.querySelectorAll('[data-pdf-hide], button[type="submit"]').forEach((n) => { n.style.display = 'none'; });
    clonedRoot.querySelectorAll('*').forEach((n) => {
        const pos = win.getComputedStyle(n).position;
        if (pos !== 'sticky' && pos !== 'fixed') return;
        const hasFields = n.querySelector('input, select, textarea');
        const hasButtons = n.querySelector('button');
        if (pos === 'fixed' || (hasButtons && !hasFields)) {
            n.style.display = 'none';
        } else {
            n.style.position = 'static';
            n.style.boxShadow = 'none';
        }
    });
    // Text boxes become plain boxes holding their answer: html2canvas draws
    // Arabic inside inputs with the letters unjoined, but joins them in
    // ordinary text. Placeholders are dropped (on paper they read as answers).
    const SKIP = new Set(['checkbox', 'radio', 'hidden', 'button', 'submit', 'reset', 'range', 'file', 'color', 'image']);
    clonedRoot.querySelectorAll('input, textarea, select').forEach((n) => {
        if (n.tagName === 'INPUT' && SKIP.has((n.type || 'text').toLowerCase())) return;
        const cs = win.getComputedStyle(n);
        if (cs.display === 'none') return;
        let text = n.value || '';
        if (n.tagName === 'SELECT') {
            const opt = n.options[n.selectedIndex];
            text = opt && opt.value !== '' ? opt.text : '';
        }
        const box = n.ownerDocument.createElement('div');
        box.className = n.className;
        // One block per line: html2canvas misplaces text that wraps at "\n".
        String(text).split('\n').forEach((line) => {
            const row = n.ownerDocument.createElement('div');
            row.setAttribute('dir', 'auto');
            row.textContent = line || '\u00a0';
            box.appendChild(row);
        });
        box.style.cssText = `box-sizing:border-box;width:${cs.width};min-height:${cs.height};padding:${cs.padding};border:${cs.border};border-radius:${cs.borderRadius};`
            + `font-size:${cs.fontSize};font-weight:${cs.fontWeight};line-height:1.5;color:#0f172a;background:#fff;text-align:${cs.textAlign};`
            + 'white-space:normal;overflow-wrap:anywhere;';
        box.style.display = n.tagName === 'TEXTAREA' || cs.display === 'block' ? 'block' : 'inline-block';
        if (n.tagName === 'TEXTAREA') box.style.padding = '6px 8px';
        box.setAttribute('dir', 'auto');
        n.replaceWith(box);
    });
}

/**
 * Where to end a page: the lowest row between minY and maxY whose pixels are
 * all (nearly) one colour, so the cut falls between lines, not through them.
 */
function findBreak(canvas, minY, maxY) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const h = Math.max(1, maxY - minY);
    let data;
    try {
        data = ctx.getImageData(0, minY, canvas.width, h).data;
    } catch {
        return maxY;
    }
    const w = canvas.width;
    const step = Math.max(1, Math.floor(w / 400));
    for (let row = h - 1; row >= 0; row -= 1) {
        const base = row * w * 4;
        const r0 = data[base]; const g0 = data[base + 1]; const b0 = data[base + 2];
        let uniform = true;
        for (let x = step; x < w; x += step) {
            const i = base + x * 4;
            if (Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0) > 24) { uniform = false; break; }
        }
        if (uniform) return minY + row;
    }
    return maxY;
}

async function saveDoc(doc, fileName) {
    if (!Capacitor.isNativePlatform()) {
        doc.save(fileName);
        return 'downloaded';
    }
    const data = doc.output('datauristring').split('base64,')[1];
    try { await Filesystem.mkdir({ path: 'NCHP_Downloads', directory: Directory.Documents, recursive: true }); } catch { /* exists */ }
    const { uri } = await Filesystem.writeFile({ path: `NCHP_Downloads/${fileName}`, data, directory: Directory.Documents, recursive: true });
    try {
        await FileOpener.open({ filePath: uri, contentType: 'application/pdf' });
    } catch { /* saved; no app to open it */ }
    return 'saved';
}

/**
 * Builds the PDF of `root` (the form element) and downloads it, or on the
 * phone app saves it to Downloads and opens it.
 * @param {HTMLElement} root
 * @param {{ formName: string, subtitle?: string, fileName?: string, footerNote?: string }} options
 * @returns {Promise<'downloaded'|'saved'>}
 */
export async function exportFormPdf(root, { formName, subtitle = '', fileName, footerNote = '' } = {}) {
    if (!root) throw new Error('Form not found');
    const unfix = fixTextBaseline();
    let headerCanvas;
    let formCanvas;
    try {
        const header = buildLetterhead(formName, subtitle);
        try {
            await Promise.all([...header.querySelectorAll('img')].map(loadImage));
            if (document.fonts?.ready) await document.fonts.ready;
            headerCanvas = await html2canvasLight(header, { scale: SCALE, backgroundColor: '#ffffff', useCORS: true, logging: false });
        } finally {
            header.remove();
        }
        const estHeight = Math.max(root.scrollHeight, 1);
        const formScale = Math.max(1, Math.min(SCALE, Math.sqrt(MAX_CANVAS_PIXELS / (CAPTURE_WIDTH * estHeight))));
        formCanvas = await html2canvasLight(root, {
            scale: formScale,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            windowWidth: Math.max(CAPTURE_WIDTH + 100, window.innerWidth),
            scrollX: 0,
            scrollY: -window.scrollY,
            onclone: (_doc, clonedRoot) => prepareClone(clonedRoot),
        });
    } finally {
        unfix();
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const headerH = (headerCanvas.height * CONTENT_W) / headerCanvas.width;
    const pxPerMm = formCanvas.width / CONTENT_W;
    const bottom = PAGE_H - MARGIN - FOOTER_H;

    let y = 0; // px of the form already placed
    let page = 0;
    while (y < formCanvas.height - 1) {
        if (page > 0) doc.addPage();
        let top = MARGIN;
        if (page === 0) {
            doc.addImage(headerCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, top, CONTENT_W, headerH);
            top += headerH + 4;
        }
        const roomPx = Math.floor((bottom - top) * pxPerMm);
        let end = Math.min(formCanvas.height, y + roomPx);
        if (end < formCanvas.height) {
            // Look back up to a quarter of the page for a clean place to cut.
            const cut = findBreak(formCanvas, Math.max(y + 1, end - Math.floor(roomPx / 4)), end);
            if (cut > y) end = cut;
        }
        const sliceH = end - y;
        const slice = document.createElement('canvas');
        slice.width = formCanvas.width;
        slice.height = sliceH;
        const sctx = slice.getContext('2d');
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(0, 0, slice.width, slice.height);
        sctx.drawImage(formCanvas, 0, y, formCanvas.width, sliceH, 0, 0, formCanvas.width, sliceH);
        doc.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', MARGIN, top, CONTENT_W, sliceH / pxPerMm);
        y = end;
        page += 1;
    }
    if (page === 0) {
        doc.addImage(headerCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, CONTENT_W, headerH);
    }

    // Footer: program name, print date and page number on every page.
    const pages = doc.internal.getNumberOfPages();
    const printed = new Date().toISOString().slice(0, 10);
    for (let i = 1; i <= pages; i += 1) {
        doc.setPage(i);
        doc.setDrawColor(203, 213, 225);
        doc.line(MARGIN, PAGE_H - MARGIN - 5, PAGE_W - MARGIN, PAGE_H - MARGIN - 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`FMOH - National Child Health Program${footerNote ? ` - ${footerNote}` : ''}`, MARGIN, PAGE_H - MARGIN - 1);
        doc.text(`Printed ${printed}   |   Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - MARGIN - 1, { align: 'right' });
    }

    const name = fileName || `${safeFileName(formName)}_${printed}.pdf`;
    return saveDoc(doc, name.endsWith('.pdf') ? name : `${name}.pdf`);
}
