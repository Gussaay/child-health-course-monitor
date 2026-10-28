// src/utils/chatExport.js
//
// "Ask the data" conversations out of the app: one answer as a picture, the
// whole conversation as text or as a PDF. The picture and the PDF are taken
// from the conversation as the app draws it (ChatExportSheet), so the layout,
// the Arabic shaping and the app's font are kept; a PDF written as text would
// lose the Arabic joins.
import { shareFile, shareText } from './sharePdf';

const MM_PAGE = { w: 210, h: 297 };
const MM_MARGIN = 10;

/** The answer's markdown as plain text: headings and bold marks dropped. */
const plain = (s) => String(s || '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').trim();

/** The whole conversation as text, in the order it was asked. */
export function conversationText(messages, { title = '', heading = '' } = {}) {
    const lines = [heading, title].filter(Boolean);
    messages.filter((m) => !m.failed).forEach((m) => {
        lines.push('', m.role === 'user' ? `❓ ${m.content.trim()}` : plain(m.content));
        if (m.role !== 'user' && m.sourcePages?.length) lines.push(`(${m.sourcePages.join(' · ')})`);
    });
    return lines.join('\n').trim();
}

// html-to-image draws the element as the browser does (fonts included);
// html2canvas is the fallback where that fails.
async function drawOne(node, fontEmbedCSS) {
    try {
        const { toCanvas } = await import('html-to-image');
        return await toCanvas(node, {
            backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true, fontEmbedCSS,
            width: node.offsetWidth, height: node.offsetHeight,
        });
    } catch {
        const { default: html2canvas } = await import('html2canvas');
        return html2canvas(node, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true });
    }
}

async function fontsOf(node) {
    await document.fonts?.ready;
    try {
        const { getFontEmbedCSS } = await import('html-to-image');
        return await getFontEmbedCSS(node);
    } catch {
        return undefined;
    }
}

const canvasBlob = (canvas, type = 'image/png', quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/** The element (one question and its answer) as a PNG, to the share sheet. */
export async function shareImage(node, fileName, options) {
    const canvas = await drawOne(node, await fontsOf(node));
    return shareFile(await canvasBlob(canvas), fileName, options);
}

/**
 * The element's blocks ([data-export-block], drawn one at a time so a long
 * conversation never needs one huge canvas) on A4 pages. A block goes to the
 * next page when it does not fit; one taller than a page is cut across pages.
 */
export async function sharePdf(node, fileName, options) {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const fontEmbedCSS = await fontsOf(node);
    const width = MM_PAGE.w - MM_MARGIN * 2;
    const bottom = MM_PAGE.h - MM_MARGIN;
    let y = MM_MARGIN;
    for (const block of node.querySelectorAll('[data-export-block]')) {
        const canvas = await drawOne(block, fontEmbedCSS);
        const mmPerPx = width / canvas.width;
        let from = 0;
        while (from < canvas.height) {
            const room = bottom - y;
            const left = (canvas.height - from) * mmPerPx;
            const take = Math.min(canvas.height - from, Math.floor(room / mmPerPx));
            // A block that fits on a fresh page starts one rather than being cut.
            if (y > MM_MARGIN && (take < 40 || (left > room && left <= bottom - MM_MARGIN))) {
                pdf.addPage();
                y = MM_MARGIN;
                continue;
            }
            const piece = document.createElement('canvas');
            piece.width = canvas.width;
            piece.height = take;
            piece.getContext('2d').drawImage(canvas, 0, from, canvas.width, take, 0, 0, canvas.width, take);
            pdf.addImage(piece.toDataURL('image/jpeg', 0.92), 'JPEG', MM_MARGIN, y, width, take * mmPerPx);
            from += take;
            y += take * mmPerPx + 3;
        }
    }
    const pages = pdf.getNumberOfPages();
    for (let p = 1; p <= pages; p += 1) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`${p} / ${pages}`, MM_PAGE.w / 2, MM_PAGE.h - 5, { align: 'center' });
    }
    return shareFile(pdf.output('blob'), fileName, options);
}

export { shareText };

/** "Ask_the_data_2026-10-28.pdf" */
export const exportName = (kind, ext) => `${kind}_${new Date().toISOString().slice(0, 10)}.${ext}`;
