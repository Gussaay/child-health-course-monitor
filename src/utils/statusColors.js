// Colours that always mean the same thing, on maps, chips, badges and charts.
// good: at or above target, partial: on the way, poor: below target or not
// working, none: no data. The Tailwind names (good/partial/poor) in
// tailwind.config.cjs use the same values.
export const STATUS_COLORS = {
    good: '#059669',    // emerald-600
    partial: '#d97706', // amber-600
    poor: '#dc2626',    // red-600
    none: '#cbd5e1',    // slate-300
};

// Coverage bands used by the dashboard map and its legend.
export function coverageColor(percentage) {
    if (percentage === undefined || percentage === null || Number.isNaN(Number(percentage))) return STATUS_COLORS.none;
    if (percentage >= 75) return STATUS_COLORS.good;
    if (percentage >= 40) return STATUS_COLORS.partial;
    return STATUS_COLORS.poor;
}

// Facility dots on the coverage map: dark so they read on every band.
export const FACILITY_DOT = '#334155'; // slate-700
