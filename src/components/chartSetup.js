// src/components/chartSetup.js
//
// Chart.js registration, in one place.
//
// This used to run at the top of App.jsx and CommonComponents.jsx, both of
// which the entry chunk imports eagerly — so chart.js (192 KB) was downloaded
// and parsed before the login screen could render, on every visit, for every
// user, including the ones who never open a dashboard.
//
// Import this module from the components that actually draw charts. They are
// all lazy-loaded, so chart.js now arrives with the screen that needs it.
//
//   import './chartSetup';   // side-effect import, before rendering any chart
//
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
);

// One look for every chart: the app font, slate text and grid lines, and a
// dark rounded tooltip. Charts only set what is special about them.
ChartJS.defaults.font.family = '"IBM Plex Sans Arabic", system-ui, sans-serif';
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = '#475569';           // slate-600
ChartJS.defaults.borderColor = '#e2e8f0';     // slate-200
ChartJS.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
// Line charts draw hollow points; their legend shows a solid dot of the
// line's colour instead of a pale ring.
const defaultLegendLabels = ChartJS.defaults.plugins.legend.labels.generateLabels;
ChartJS.defaults.plugins.legend.labels.generateLabels = (chart) => {
    const items = defaultLegendLabels(chart);
    if (chart.config.type !== 'line') return items;
    return items.map((item) => ({ ...item, fillStyle: item.strokeStyle, pointStyle: 'circle' }));
};

// Series colours, in the order to use them. For good / partial / poor use
// STATUS_COLORS from utils/statusColors instead.
export const CHART_COLORS = [
    '#0284c7', // sky-600 (brand)
    '#059669', // emerald-600
    '#d97706', // amber-600
    '#7c3aed', // violet-600
    '#e11d48', // rose-600
    '#0d9488', // teal-600
    '#64748b', // slate-500
    '#c2410c', // orange-700
];

// The same colour, see-through, for filled areas behind a line.
export function fadeColor(hex, alpha = 0.15) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export { ChartJS };
