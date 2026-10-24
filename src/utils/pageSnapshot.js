// src/utils/pageSnapshot.js
//
// What the data assistant is told about the page that is open: the text on
// screen and the numbers behind each chart (a chart is a picture, so its text
// is not on screen). Only what this person already sees is sent.

const MAX_TEXT = 9000;
const MAX_POINTS = 40;

const num = (v) => {
    if (v && typeof v === 'object') return num(v.y ?? v.value ?? v.r ?? '');
    if (typeof v === 'number') return Math.round(v * 100) / 100;
    return String(v ?? '');
};

/** One chart's numbers as lines of text: "Title — Series: label 12, label 30". */
export function chartToText({ title = '', labels = [], datasets = [] } = {}) {
    const name = Array.isArray(title) ? title.join(' ') : String(title || '');
    const lines = (datasets || []).slice(0, 8).map((ds) => {
        const data = Array.isArray(ds?.data) ? ds.data : [];
        const points = data.slice(0, MAX_POINTS).map((v, i) => {
            const label = labels[i] ?? (v && typeof v === 'object' && v.x !== undefined ? v.x : i + 1);
            return `${Array.isArray(label) ? label.join(' ') : label} ${num(v)}`;
        });
        if (data.length > MAX_POINTS) points.push(`…${data.length - MAX_POINTS} more`);
        return `${ds?.label ? `${ds.label}: ` : ''}${points.join(', ')}`;
    }).filter((l) => l.trim());
    if (!lines.length) return '';
    return `Chart${name ? ` "${name}"` : ''}\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

/** Visible text of an element, cut to size, with runs of blank lines folded. */
export function cleanPageText(text, max = MAX_TEXT) {
    return String(text || '')
        .replace(/[ \t\u00a0]+/g, ' ')
        .split('\n').map((l) => l.trim()).filter(Boolean)
        .join('\n')
        .slice(0, max);
}

/**
 * The open page, ready to send. Chart numbers are read from Chart.js only when
 * the page has charts, so pages without them never load it.
 */
export async function snapshotPage(root, { view = '', title = '' } = {}) {
    if (!root) return { view, title, text: '' };
    const canvases = [...root.querySelectorAll('canvas')];
    let charts = '';
    if (canvases.length) {
        try {
            const { Chart } = await import('chart.js');
            charts = canvases.map((c) => Chart.getChart(c)).filter(Boolean).slice(0, 15).map((chart) => chartToText({
                title: chart.options?.plugins?.title?.text,
                labels: chart.data?.labels || [],
                datasets: chart.data?.datasets || [],
            })).filter(Boolean).join('\n\n');
        } catch { /* a page whose charts cannot be read still sends its text */ }
    }
    const text = cleanPageText(root.innerText, MAX_TEXT - Math.min(charts.length, 4000));
    // Charts first: the server cuts from the end when a provider takes less.
    return { view, title, text: charts ? `CHART DATA\n${charts.slice(0, 4000)}\n\nTEXT ON SCREEN\n${text}` : text };
}
