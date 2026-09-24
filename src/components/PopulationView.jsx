// src/components/PopulationView.jsx
//
// Population targets: the projected denominators that Planning divides by and
// Supply quantifies against. Everything for the feature lives here — the field
// definitions, the workbook parser, the import template, the shared accessor
// hook, and the three screens — because splitting one feature across eight
// modules made it harder to follow than a single file of this size.
//
// The state and locality name aliases are the exception: they sit in
// constants.js next to STATE_LOCALITIES, which is the data they map onto.
//
// Exports:
//   usePopulation(year)          shared accessor — Planning and Supply both use it
//   annualCohortField / COHORT_TO_FIELD   bridge to the supply module's cohorts
//   parsePopulationRows(rows, year)       workbook parser (unit tested)
//   buildTemplateRows()                   import template (unit tested)
//   PopulationDashboard          named export, rendered on the main dashboard
//   default                      the management screen, rendered inside Planning
//
// Targets are keyed by year. They are reissued annually and a forecast has to
// stay reproducible after next year's projection lands, so nothing asks for
// "the latest" — a caller names the year it means.

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Upload, Pencil, AlertTriangle, CheckCircle2, Download, RefreshCw,
    Users, Baby, HeartPulse, MapPin,
} from 'lucide-react';

import {
    Card, CardBody, Button, Table, EmptyState, Spinner, Modal, Input, Select,
} from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import {
    STATE_LOCALITIES, canonicalState, canonicalLocality, TOTAL_ROW_PATTERN,
} from './constants';
import {
    upsertPopulationTarget, bulkUpsertPopulationTargets,
} from '../data';
import { useDataCache } from '../DataContext';

const fmt = (n) => (Number(n) || 0).toLocaleString();
const pct = (part, whole) => (whole ? ((part / whole) * 100).toFixed(1) + '%' : '—');

const localityLabel = (stateKey, localityKey, isArabic) => {
    const found = (STATE_LOCALITIES[stateKey]?.localities || []).find((l) => l.en === localityKey);
    return found ? (isArabic ? found.ar : found.en) : localityKey;
};

const stateLabel = (stateKey, isArabic) => {
    const s = STATE_LOCALITIES[stateKey];
    return s ? (isArabic ? s.ar : s.en) : stateKey;
};

// =============================================================================
// Field definitions and the bridge to the supply module
// =============================================================================


export const POPULATION_FIELDS = [
    {
        id: 'totalPopulation',
        label: 'Total population',
        labelAr: 'إجمالي السكان',
        sheetHeaders: ['Est.pop.2026', 'Est.pop', 'Total population', 'Population'],
        required: true,
    },
    {
        id: 'births',
        label: 'Births',
        labelAr: 'المواليد',
        sheetHeaders: ['Births', 'Births (EPI)', 'Live births'],
    },
    {
        id: 'survivingInfants',
        label: 'Surviving infants',
        labelAr: 'الرضع الباقون على قيد الحياة',
        sheetHeaders: ['Surviving Infants', 'Surviving infant'],
    },
    {
        id: 'under5',
        label: 'Children under 5',
        labelAr: 'الأطفال دون الخامسة',
        sheetHeaders: ['Under-five', 'Under five', 'Under-5'],
    },
    {
        id: 'infantDeaths',
        label: 'Infant deaths',
        labelAr: 'وفيات الرضع',
        // The published sheet misspells this as "dead infnt percentage" /
        // "dead infant"; both spellings are listed so neither edition breaks.
        sheetHeaders: ['dead infant', 'dead infnt', 'Infant deaths'],
    },
    {
        id: 'age5to9',
        label: 'Children 5–9',
        labelAr: 'الأطفال 5-9 سنوات',
        // The workbook writes the assumed share into the header — "5-9 year
        // (13%)" — and that share changes between editions, so the stored
        // spelling is the stem and the prefix match picks up the rest.
        sheetHeaders: ['5-9 years', '5-9 year', '5 to 9'],
    },
    {
        id: 'age10to14',
        label: 'Children 10–14',
        labelAr: 'الأطفال 10-14 سنة',
        sheetHeaders: ['10-14 years', '10-14 year', '10 to 14'],
    },
    {
        id: 'age15to19',
        label: 'Adolescents 15–19',
        labelAr: 'المراهقون 15-19 سنة',
        sheetHeaders: ['15-19 years', '15-19 year', '15 to 19'],
    },
    {
        id: 'adolescents',
        label: 'Adolescents 10–19 (total)',
        labelAr: 'إجمالي المراهقين 10-19',
        sheetHeaders: ['total adolscent', 'total adolescent', 'adolescents'],
    },
    {
        id: 'under15',
        label: 'Under 15',
        labelAr: 'دون الخامسة عشرة',
        sheetHeaders: ['Under 15', 'Under-15'],
    },
    {
        id: 'pregnantWomen',
        label: 'Pregnant women',
        labelAr: 'النساء الحوامل',
        sheetHeaders: ['Pregnants', 'Pregnant women', 'Pregnants (EPI)'],
    },
    {
        id: 'cbaw',
        label: 'Women of childbearing age',
        labelAr: 'النساء في سن الإنجاب',
        sheetHeaders: ['CBAW', 'WCBA', 'Women of childbearing age'],
    },
];

export const POPULATION_FIELD_IDS = POPULATION_FIELDS.map((f) => f.id);

// Bridges the supply module's TARGET_COHORTS to the fields stored here. When
// the forecaster asks for the `under_1` cohort it means surviving infants —
// the EPI denominator — not births, because a forecast of what infants will
// consume over a year cannot count children who did not survive to use it.
export const COHORT_TO_FIELD = {
    total_population: 'totalPopulation',
    under_5: 'under5',
    under_1: 'survivingInfants',
    newborns: 'births',
    pregnant_women: 'pregnantWomen',
    under_15: 'under15',
    age_5_9: 'age5to9',
    age_10_14: 'age10to14',
    age_15_19: 'age15to19',
    adolescents: 'adolescents',
    women_childbearing_age: 'cbaw',
    // per_facility is not population based and is resolved from the facility
    // count instead, so it deliberately has no entry here.
};

// Document ids are built by populationTargetId() in data.js, which sanitises
// them. An earlier copy of that logic lived here unsanitised, and two spellings
// of the same id is exactly the kind of thing that silently writes half an
// import to the wrong place.

// Projections are published for the coming year late in the preceding one, so
// the useful default from October onward is next year rather than this one.
export function currentTargetYear(now = new Date()) {
    return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

export function emptyTarget(year, stateKey, localityKey) {
    const base = { year, stateKey, localityKey, source: 'manual' };
    POPULATION_FIELD_IDS.forEach((id) => { base[id] = 0; });
    return base;
}


// =============================================================================
// Workbook parsing
//
// The published workbooks have three habits this has to survive:
//   1. The State column is merged, so it appears only on the first row of each
//      state's block and has to be carried down.
//   2. Each state's block ends with a subtotal row labelled TOTAL, Total,
//      "Total State" or "state". Importing those would double the national
//      figures.
//   3. Column headers are not in row 1 - there is usually a title row above -
//      and the spellings vary between editions.
//
// Nothing here guesses at a locality name: an unrecognised one is reported for
// the operator to resolve. A silent best-guess would put one locality's
// population under another's name.
// =============================================================================

const clean = (value) => String(value ?? '').trim();
const normHeader = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const toNumber = (value) => {
    if (value == null || value === '') return null;
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? Math.round(n) : null;
};

// The header row is the first one that mentions both a state and a locality
// column; scanning for it means a title row above costs nothing.
function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const cells = (rows[i] || []).map(normHeader);
        const hasState = cells.some((c) => c === 'state' || c === 'states');
        const hasLocality = cells.some((c) => c.startsWith('localit'));
        if (hasState && hasLocality) return i;
    }
    return -1;
}

function buildColumnIndex(headerRow) {
    const cells = (headerRow || []).map(normHeader);
    const index = {};

    index.state = cells.findIndex((c) => c === 'state' || c === 'states');
    index.locality = cells.findIndex((c) => c.startsWith('localit'));

    // The workbook pairs every count with the assumed share that produced it:
    // "birth percentage" sits beside "Births", "under 5 percentage" beside
    // "Under-five". A prefix match would happily take the percentage column and
    // import 0.039 where 17,185 belongs, which looks like a plausible number
    // and would be very hard to spot afterwards. Rate columns are never the
    // answer here, so they are excluded from matching entirely.
    const isRate = (c) => /percent|percentage|rate|ratio/.test(c);

    POPULATION_FIELDS.forEach((field) => {
        const wanted = field.sheetHeaders.map(normHeader);
        const usable = (c) => c && !isRate(c);
        let at = cells.findIndex((c) => usable(c) && wanted.includes(c));
        // Fall back to a prefix match so "Est.pop.2027" still finds Est.pop and
        // "5-9 year (13%)" still finds "5-9 year".
        if (at === -1) {
            at = cells.findIndex((c) => usable(c) && wanted.some((w) => c.startsWith(w) || w.startsWith(c)));
        }
        index[field.id] = at;
    });

    return index;
}

/**
 * Inspects a sheet and proposes a column mapping. Separate from parsing so the
 * import screen can show the proposal, let the operator correct it, and parse
 * again with their choice — auto-detection is a starting point, not a verdict.
 *
 * @param {Array<Array<*>>} rows  sheet_to_json output with header:1
 * @returns {{headerRowIndex: number, headers: string[], mapping: object, error?: string}}
 */
export function analyseSheet(rows) {
    const headerAt = findHeaderRow(rows);
    if (headerAt === -1) {
        return {
            headerRowIndex: -1, headers: [], mapping: {},
            error: 'Could not find a header row containing both "State" and "Localities". '
                + 'Pick the sheet that lists localities, or use the template.',
        };
    }
    const headerRow = rows[headerAt] || [];
    return {
        headerRowIndex: headerAt,
        // Index-based, because workbooks repeat header text across columns.
        headers: headerRow.map((h, i) => ({ index: i, label: clean(h) || `Column ${i + 1}` })),
        mapping: buildColumnIndex(headerRow),
    };
}

/**
 * @param {Array<Array<*>>} rows  sheet_to_json output with header:1
 * @param {number} year
 * @param {{headerRowIndex?: number, mapping?: object}} [options]
 *        An explicit mapping from the import screen. Omitted, the sheet is
 *        auto-detected, which is what the tests and the template rely on.
 */
export function parsePopulationRows(rows, year, options = {}) {
    const analysis = options.mapping
        ? { headerRowIndex: options.headerRowIndex ?? findHeaderRow(rows), mapping: options.mapping }
        : analyseSheet(rows);

    if (analysis.error) {
        return { rows: [], skipped: [], unknown: [], duplicates: [], columns: null, error: analysis.error };
    }

    const headerAt = analysis.headerRowIndex;
    const columns = analysis.mapping;

    // What each field was matched to, in the sheet's own words.
    const headerRow = rows[headerAt] || [];
    const detected = {};
    [...POPULATION_FIELDS.map((f) => f.id), 'state', 'locality'].forEach((id) => {
        const at = columns[id];
        detected[id] = at >= 0 ? (clean(headerRow[at]) || `Column ${at + 1}`) : null;
    });

    const missing = [];
    if (!(columns.state >= 0)) missing.push('State');
    if (!(columns.locality >= 0)) missing.push('Locality');
    if (!(columns.totalPopulation >= 0)) missing.push('Total population');
    if (missing.length) {
        return {
            rows: [], skipped: [], unknown: [], duplicates: [], columns, detected,
            error: `These required columns are not mapped: ${missing.join(', ')}.`,
        };
    }

    const parsed = [];
    const skipped = [];
    const unknown = [];
    let currentState = null;

    for (let i = headerAt + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const rawState = clean(row[columns.state]);
        if (rawState) currentState = rawState;

        const rawLocality = clean(row[columns.locality]);
        if (!rawLocality) continue;

        if (TOTAL_ROW_PATTERN.test(rawLocality)) {
            skipped.push({ row: i + 1, state: currentState, locality: rawLocality, reason: 'subtotal row' });
            continue;
        }

        const total = toNumber(row[columns.totalPopulation]);
        if (total == null) {
            skipped.push({ row: i + 1, state: currentState, locality: rawLocality, reason: 'no population value' });
            continue;
        }

        // Read the figures before deciding whether the name is recognised, so
        // an unrecognised row still carries its numbers. That is what lets the
        // import screen offer the row for correction instead of discarding it
        // and making the operator edit the workbook and start again.
        const values = { year: Number(year), source: 'bulk_upload' };
        POPULATION_FIELDS.forEach((field) => {
            const at = columns[field.id];
            values[field.id] = at >= 0 ? (toNumber(row[at]) ?? 0) : 0;
        });

        const stateKey = canonicalState(currentState);
        if (!stateKey) {
            unknown.push({
                row: i + 1, state: currentState, locality: rawLocality,
                reason: 'unrecognised state', values,
            });
            continue;
        }

        const localityKey = canonicalLocality(stateKey, rawLocality);
        if (!localityKey) {
            unknown.push({
                row: i + 1, state: currentState, stateKey, locality: rawLocality,
                reason: 'unrecognised locality', values,
            });
            continue;
        }

        parsed.push({ ...values, stateKey, localityKey });
    }

    // A workbook listing the same locality twice would otherwise import as one
    // row silently overwriting the other, hiding a real data problem.
    const seen = new Map();
    const duplicates = [];
    parsed.forEach((r) => {
        const key = `${r.stateKey}|${r.localityKey}`;
        if (seen.has(key)) duplicates.push({ ...r, reason: 'duplicate locality' });
        else seen.set(key, r);
    });

    return { rows: [...seen.values()], skipped, unknown, duplicates, columns, detected, headerRowNumber: headerAt + 1 };
}



// =============================================================================
// Import template
//
// Pre-filled with every state and locality, spelled exactly as the rest of the
// system spells them, so a template that is filled in and uploaded cannot fail
// name matching - the names never had to be typed.
// =============================================================================

export const TEMPLATE_HEADERS = ['State', 'Localities', ...POPULATION_FIELDS.map((f) => f.sheetHeaders[0])];

export function buildTemplateRows() {
    const rows = [TEMPLATE_HEADERS];
    Object.entries(STATE_LOCALITIES).forEach(([stateKey, state]) => {
        if (stateKey === 'Federal') return;
        (state.localities || []).forEach((loc, index) => {
            rows.push([
                // Written on every row rather than only the first. The published
                // workbooks merge this column and the parser carries it down,
                // but a template a person edits should not depend on that.
                stateKey,
                loc.en,
                ...POPULATION_FIELDS.map(() => null),
            ]);
            void index;
        });
    });
    return rows;
}

export async function downloadPopulationTemplate(year) {
    const XLSX = await import('xlsx');
    const rows = buildTemplateRows();

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 26 }, ...POPULATION_FIELDS.map(() => ({ wch: 18 }))];

    // A second sheet explaining each column, so the person filling it in knows
    // what "Surviving Infants" is meant to contain without asking.
    const notes = [
        ['Column', 'Meaning', 'Required'],
        ['State', 'Leave exactly as provided — it matches the system’s state names.', 'Yes'],
        ['Localities', 'Leave exactly as provided — it matches the system’s locality names.', 'Yes'],
        ...POPULATION_FIELDS.map((f) => [
            f.sheetHeaders[0],
            f.label + (f.id === 'survivingInfants' ? ' (births minus infant deaths)' : ''),
            f.required ? 'Yes' : 'Optional',
        ]),
        [],
        ['Notes', '', ''],
        ['', 'Do not add a TOTAL row — the system calculates totals itself.', ''],
        ['', 'Leave a cell blank or zero if a figure is not available.', ''],
        ['', `These figures will be saved as the ${year} targets.`, ''],
    ];
    const wsNotes = XLSX.utils.aoa_to_sheet(notes);
    wsNotes['!cols'] = [{ wch: 22 }, { wch: 70 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Localities ${year}`);
    XLSX.utils.book_append_sheet(wb, wsNotes, 'How to fill in');
    XLSX.writeFile(wb, `population-targets-template-${year}.xlsx`);

    return rows.length - 1;
}


// =============================================================================
// Shared accessor
// =============================================================================

const sumField = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

export function usePopulation(year) {
    const { populationTargets, fetchPopulationTargets, isLoading } = useDataCache();

    useEffect(() => {
        if (!populationTargets) fetchPopulationTargets(false);
    }, [populationTargets, fetchPopulationTargets]);

    const live = useMemo(
        () => (populationTargets || []).filter((row) => row.isDeleted !== true),
        [populationTargets]
    );

    const availableYears = useMemo(() => {
        const years = [...new Set(live.map((row) => Number(row.year)).filter(Boolean))];
        return years.sort((a, b) => b - a);
    }, [live]);

    const activeYear = year ?? (availableYears[0] ?? currentTargetYear());

    const rowsForYear = useMemo(
        () => live.filter((row) => Number(row.year) === Number(activeYear)),
        [live, activeYear]
    );

    // Indexed for the forecaster, which asks per locality across a whole
    // catalogue and would otherwise scan the array once per item.
    const byLocality = useMemo(() => {
        const index = {};
        rowsForYear.forEach((row) => { index[`${row.stateKey}|${row.localityKey}`] = row; });
        return index;
    }, [rowsForYear]);

    const byState = useMemo(() => {
        const index = {};
        rowsForYear.forEach((row) => {
            const bucket = index[row.stateKey] || (index[row.stateKey] = { stateKey: row.stateKey, localities: 0 });
            bucket.localities += 1;
            POPULATION_FIELD_IDS.forEach((f) => { bucket[f] = (bucket[f] || 0) + (Number(row[f]) || 0); });
        });
        return index;
    }, [rowsForYear]);

    const national = useMemo(() => {
        const totals = { localities: rowsForYear.length, states: Object.keys(byState).length };
        POPULATION_FIELD_IDS.forEach((f) => { totals[f] = sumField(rowsForYear, f); });
        return totals;
    }, [rowsForYear, byState]);

    // Returns null when the scope has no figures for this year, so a caller can
    // say "no population data" instead of quietly dividing by zero.
    const getScope = useCallback((scope = {}) => {
        const { stateKey, localityKey } = scope;
        if (stateKey && localityKey) return byLocality[`${stateKey}|${localityKey}`] || null;
        if (stateKey) return byState[stateKey] || null;
        return rowsForYear.length ? national : null;
    }, [byLocality, byState, national, rowsForYear.length]);

    // The bridge the supply forecaster calls: a TARGET_COHORTS id in, a number
    // out. `per_facility` is not population based and returns null by design.
    const getCohort = useCallback((cohortId, scope = {}) => {
        const field = COHORT_TO_FIELD[cohortId];
        if (!field) return null;
        const row = getScope(scope);
        if (!row) return null;
        const value = Number(row[field]);
        return Number.isFinite(value) ? value : null;
    }, [getScope]);

    // Which localities in the constants have no row for this year. Surfaced in
    // the UI so gaps are visible before a forecast is run on partial data.
    const missingLocalities = useMemo(() => {
        const gaps = [];
        Object.entries(STATE_LOCALITIES).forEach(([stateKey, state]) => {
            if (stateKey === 'Federal') return;
            (state.localities || []).forEach((loc) => {
                if (!byLocality[`${stateKey}|${loc.en}`]) {
                    gaps.push({ stateKey, localityKey: loc.en });
                }
            });
        });
        return gaps;
    }, [byLocality]);

    return {
        activeYear,
        availableYears,
        rows: rowsForYear,
        byLocality,
        byState,
        national,
        getScope,
        getCohort,
        missingLocalities,
        hasData: rowsForYear.length > 0,
        isLoading: !!isLoading?.populationTargets && !populationTargets,
        // 'full' rather than 'sync'. A sync asks only for documents newer than
        // the stored watermark, and that watermark can already sit past an
        // import that failed to land in time — in which case a sync can never
        // see those rows again and the table stays empty for good. The whole
        // collection is one document per locality, so a full reload is cheap
        // and cannot be defeated by a poisoned watermark.
        refresh: (mode = 'full') => fetchPopulationTargets(mode),
    };
}



// =============================================================================
// Bulk import panel
//
// Inline rather than a Modal, on purpose. CommonComponents' Modal is a native
// <dialog> opened with showModal(), and it closes on any click whose target is
// the dialog element. Returning from the operating system's file picker
// delivers exactly such a click, so the panel closed the moment a file was
// chosen and the file never appeared to be selected at all.
// =============================================================================


// Two pages, matching ExcelImportModal (the participants/facility importer):
// page 0 picks the file, page 1 maps the columns and previews the result.
//
// The workbook and every choice made about it live in the PARENT, not here.
// This modal has been reported closing on its own after a file was chosen, and
// if the state lived inside it that would throw away the upload silently.
// Held above, reopening puts the operator back exactly where they were.
function ImportModal({
    isOpen, year, onClose, onImported,
    draft, setDraft,
}) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const { page = 0, fileName = null, sheetNames = [], sheetName = null,
        rows = null, headers = [], mapping = {}, headerRowIndex = -1, fixes = {} } = draft || {};

    const patch = useCallback((changes) => setDraft((prev) => ({ ...prev, ...changes })), [setDraft]);

    const loadSheet = useCallback((allRows, name) => {
        const analysis = analyseSheet(allRows);
        if (analysis.error) {
            setError(analysis.error);
            patch({ sheetName: name, rows: allRows, headers: [], mapping: {}, headerRowIndex: -1, page: 1, fixes: {} });
            return;
        }
        setError('');
        patch({
            sheetName: name, rows: allRows, headers: analysis.headers,
            mapping: analysis.mapping, headerRowIndex: analysis.headerRowIndex,
            page: 1, fixes: {},
        });
    }, [patch]);

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setBusy(true);
        setError('');
        try {
            const XLSX = await import('xlsx');
            const wb = XLSX.read(await file.arrayBuffer());
            const preferred = wb.SheetNames.find((n) => /localit|محلي/i.test(n)) || wb.SheetNames[0];
            const allRows = XLSX.utils.sheet_to_json(wb.Sheets[preferred], { header: 1, defval: null });
            patch({ fileName: file.name, sheetNames: wb.SheetNames, workbookRef: wb });
            loadSheet(allRows, preferred);
        } catch (err) {
            console.error('Failed to read workbook:', err);
            setError('Could not read that file. Is it a valid Excel workbook?');
        } finally {
            setBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const switchSheet = async (name) => {
        const wb = draft?.workbookRef;
        if (!wb) return;
        const XLSX = await import('xlsx');
        loadSheet(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }), name);
    };

    const setMapping = (fieldId, value) => {
        patch({ mapping: { ...mapping, [fieldId]: value === '' ? -1 : Number(value) }, fixes: {} });
    };

    // Re-parsed on every mapping change, so the preview always reflects the
    // choices currently on screen.
    const preview = useMemo(() => {
        if (!rows || headerRowIndex < 0) return null;
        return parsePopulationRows(rows, year, { headerRowIndex, mapping });
    }, [rows, headerRowIndex, mapping, year]);

    const claimed = useMemo(() => {
        const set = new Set((preview?.rows || []).map((r) => `${r.stateKey}|${r.localityKey}`));
        Object.values(fixes).forEach((f) => {
            if (f && f !== 'skip') set.add(`${f.stateKey}|${f.localityKey}`);
        });
        return set;
    }, [preview, fixes]);

    const unresolved = (preview?.unknown || []).filter((u) => !fixes[u.row]);

    const finalRows = useMemo(() => {
        const base = [...(preview?.rows || [])];
        (preview?.unknown || []).forEach((u) => {
            const fix = fixes[u.row];
            if (!fix || fix === 'skip') return;
            base.push({ ...u.values, stateKey: fix.stateKey, localityKey: fix.localityKey });
        });
        return base;
    }, [preview, fixes]);

    const setFix = (rowNo, value) => patch({ fixes: { ...fixes, [rowNo]: value } });

    const getTemplate = async () => {
        try {
            const count = await downloadPopulationTemplate(year);
            notify(`Template downloaded with ${count} localities already filled in.`, 'success');
        } catch (err) {
            console.error('Template download failed:', err);
            notify('Could not build the template.', 'error');
        }
    };

    const handleImport = async () => {
        if (!finalRows.length) { setError('There is nothing to import.'); return; }
        const skippedCount = Object.values(fixes).filter((f) => f === 'skip').length;
        const ok = await confirmDialog(
            `Import ${finalRows.length} localities as the ${year} population targets?`
            + (skippedCount ? ` ${skippedCount} row(s) will be skipped.` : '')
            + ' Existing figures for this year will be replaced.',
            { title: `Import ${year} targets`, confirmLabel: 'Import' }
        );
        if (!ok) return;
        setBusy(true);
        setError('');
        try {
            const count = await bulkUpsertPopulationTargets(finalRows);
            notify(`Imported ${count} localities for ${year}.`, 'success');
            onImported();
            setDraft({});
            onClose();
        } catch (err) {
            console.error('Population import failed:', err);
            // The two failures seen in the field are worth naming: the fix for
            // each is completely different and neither is obvious from a
            // generic message.
            const raw = String(err?.message || err);
            setError(
                /insufficient permissions|permission-denied/i.test(raw)
                    ? 'Firestore refused the write: the security rules for populationTargets are not deployed yet. Ask a developer to run "npm run deploy:rules". Nothing was saved.'
                    : /even number of segments|Invalid document reference/i.test(raw)
                        ? 'A locality name contains a character Firestore cannot use in a document id. Please report this — it needs a code fix. Nothing was saved.'
                        : `The import failed and nothing was saved. ${raw}`
            );
        } finally {
            setBusy(false);
        }
    };

    const stateKeys = Object.keys(STATE_LOCALITIES).filter((k) => k !== 'Federal');
    const headerOptions = headers.map((h) => (
        <option key={h.index} value={h.index}>{h.label}</option>
    ));

    const mappableFields = [
        { id: 'state', label: 'State', required: true },
        { id: 'locality', label: 'Locality', required: true },
        ...POPULATION_FIELDS.map((f) => ({ id: f.id, label: f.label, required: !!f.required })),
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Import population targets — ${year}`}>
            <div className="space-y-4">
                {error && (
                    <div className="flex gap-2 bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <div>{error}</div>
                    </div>
                )}

                {page === 0 && (
                    <>
                        <div className="p-3 bg-sky-50 border border-sky-200 rounded space-y-2">
                            <div className="text-sm text-sky-900">
                                <strong>No file ready?</strong> The template already contains every
                                state and locality under the names the system expects, so you only
                                enter numbers.
                            </div>
                            <Button variant="secondary" onClick={getTemplate}>
                                <Download size={16} /> Download template
                            </Button>
                        </div>

                        <p className="text-sm text-gray-600">
                            Upload the EPI projected-denominator workbook. You will be able to
                            check and change which column feeds which field before anything is
                            saved.
                        </p>

                        <input
                            type="file"
                            /* Extensions and MIME types both: Windows reports one or the other
                               depending on how the file was created, and a workbook reporting
                               only its MIME type is greyed out by an extension-only filter. */
                            accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12"
                            onChange={handleFileUpload}
                            ref={fileInputRef}
                            disabled={busy}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                        />
                        <div className="text-xs text-gray-500">
                            If your file appears greyed out, it may be an online-only Google Drive
                            file — open it once so it downloads locally, then try again.
                        </div>
                        {busy && <Spinner />}
                    </>
                )}

                {page === 1 && (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <div className="text-gray-700">
                                <strong>{fileName}</strong>
                                {headerRowIndex >= 0 && (
                                    <span className="text-gray-500"> · header on row {headerRowIndex + 1}</span>
                                )}
                            </div>
                            {sheetNames.length > 1 && (
                                <select
                                    value={sheetName || ''}
                                    onChange={(e) => switchSheet(e.target.value)}
                                    className="border rounded px-2 py-1 text-sm"
                                >
                                    {sheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                            )}
                        </div>

                        <div>
                            <h4 className="font-medium mb-2">Map Excel columns to population fields</h4>
                            <div className="grid gap-2">
                                {mappableFields.map((field) => (
                                    <div key={field.id} className="flex items-center gap-3">
                                        <label className="w-44 text-sm text-gray-700 shrink-0">
                                            {field.label}{field.required && <span className="text-red-600">*</span>}
                                        </label>
                                        <select
                                            value={mapping[field.id] >= 0 ? mapping[field.id] : ''}
                                            onChange={(e) => setMapping(field.id, e.target.value)}
                                            className={`flex-1 border rounded px-2 py-1 text-sm ${
                                                field.required && !(mapping[field.id] >= 0)
                                                    ? 'border-red-400 bg-red-50' : 'border-gray-300'
                                            }`}
                                        >
                                            <option value="">
                                                {field.required ? '-- Select Excel column --' : '-- Not in this file (saved as 0) --'}
                                            </option>
                                            {headerOptions}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {preview && !preview.error && (
                            <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                                <div>
                                    <strong>{finalRows.length} localities</strong> ready.
                                    {preview.skipped?.length > 0 && (
                                        <> {preview.skipped.length} subtotal or empty rows ignored.</>
                                    )}
                                    <div className="mt-1">
                                        Total population{' '}
                                        <strong>{fmt(finalRows.reduce((s, r) => s + r.totalPopulation, 0))}</strong>
                                        {' · '}under 5{' '}
                                        <strong>{fmt(finalRows.reduce((s, r) => s + r.under5, 0))}</strong>
                                    </div>
                                </div>
                            </div>
                        )}

                        {preview?.error && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                                {preview.error}
                            </div>
                        )}

                        {/* Data preview, the same reassurance the participants
                            importer gives: see the real cells before committing. */}
                        {rows && headerRowIndex >= 0 && (
                            <div className="overflow-auto max-h-48 border rounded">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            {headers.map((h) => (
                                                <th key={h.index} className="border-b border-gray-300 p-2 text-left whitespace-nowrap">
                                                    {h.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.slice(headerRowIndex + 1, headerRowIndex + 6).map((row, rowIdx) => (
                                            <tr key={rowIdx}>
                                                {headers.map((h) => (
                                                    <td key={h.index} className="border-b border-gray-200 p-2 whitespace-nowrap">
                                                        {row?.[h.index] == null ? '' : String(row[h.index])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Names the system did not recognise, each fixable here.
                            Editing the workbook and starting over is the slow way to
                            resolve four spellings out of two hundred. */}
                        {preview?.unknown?.length > 0 && (
                            <div className="border border-amber-300 rounded overflow-hidden">
                                <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-sm font-semibold text-amber-900 flex items-center gap-2">
                                    <AlertTriangle size={16} />
                                    {preview.unknown.length} name(s) not recognised
                                    {unresolved.length === 0 ? ' — all resolved' : ` — ${unresolved.length} to resolve`}
                                </div>
                                <div className="divide-y max-h-60 overflow-y-auto">
                                    {preview.unknown.map((u) => {
                                        const fix = fixes[u.row];
                                        const chosenState = fix && fix !== 'skip' ? fix.stateKey : (u.stateKey || '');
                                        const options = (STATE_LOCALITIES[chosenState]?.localities || [])
                                            .filter((l) => !claimed.has(`${chosenState}|${l.en}`)
                                                || (fix && fix !== 'skip' && fix.localityKey === l.en));
                                        return (
                                            <div key={u.row} className="px-3 py-2 text-sm space-y-2">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span>
                                                        Row {u.row}: <strong>&ldquo;{u.locality}&rdquo;</strong>
                                                        <span className="text-gray-500"> in {u.state}</span>
                                                    </span>
                                                    <span className="text-gray-500 text-xs shrink-0">
                                                        pop {fmt(u.values?.totalPopulation)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    <select
                                                        value={chosenState}
                                                        onChange={(e) => setFix(u.row, { stateKey: e.target.value, localityKey: '' })}
                                                        className="border rounded px-2 py-1 text-sm"
                                                    >
                                                        <option value="">Select state…</option>
                                                        {stateKeys.map((k) => (
                                                            <option key={k} value={k}>{stateLabel(k, isArabic)}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={fix && fix !== 'skip' ? fix.localityKey : ''}
                                                        disabled={!chosenState}
                                                        onChange={(e) => setFix(u.row, e.target.value
                                                            ? { stateKey: chosenState, localityKey: e.target.value }
                                                            : undefined)}
                                                        className="border rounded px-2 py-1 text-sm disabled:bg-gray-100"
                                                    >
                                                        <option value="">Select locality…</option>
                                                        {options.map((l) => (
                                                            <option key={l.en} value={l.en}>{isArabic ? l.ar : l.en}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFix(u.row, fix === 'skip' ? undefined : 'skip')}
                                                        className={`px-2 py-1 rounded text-xs border ${
                                                            fix === 'skip'
                                                                ? 'bg-slate-200 text-slate-800 border-slate-300'
                                                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {fix === 'skip' ? 'Skipped' : 'Skip row'}
                                                    </button>
                                                    {fix && fix !== 'skip' && fix.localityKey && (
                                                        <span className="text-green-700 text-xs flex items-center gap-1">
                                                            <CheckCircle2 size={14} /> mapped
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-900">
                                    Corrections apply to this import only. To make a spelling
                                    permanent, add it to LOCALITY_ALIASES in constants.js.
                                </div>
                            </div>
                        )}

                        {preview?.duplicates?.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                                {preview.duplicates.length} locality appears more than once and only
                                the first was kept. Check the file if that is not what you expect.
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="secondary" onClick={() => patch({ page: 0 })} disabled={busy}>
                                Back
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={busy || !preview || !!preview.error || unresolved.length > 0 || !finalRows.length}
                            >
                                {unresolved.length > 0
                                    ? `Resolve ${unresolved.length} name(s) first`
                                    : `Import ${finalRows.length} localities`}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
// =============================================================================
// Manual edit and the management screen (rendered inside Planning)
// =============================================================================


// =============================================================================
// Manual edit
// =============================================================================

function EditModal({ isOpen, onClose, target, year, onSaved }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [form, setForm] = useState(target || {});
    const [saving, setSaving] = useState(false);

    React.useEffect(() => { if (isOpen) setForm(target || {}); }, [isOpen, target]);

    const save = async () => {
        setSaving(true);
        try {
            const payload = { ...form, year, source: 'manual' };
            POPULATION_FIELD_IDS.forEach((id) => { payload[id] = Number(form[id]) || 0; });
            await upsertPopulationTarget(payload);
            notify('Population figures updated.', 'success');
            onSaved();
            onClose();
        } catch (error) {
            console.error('Failed to save population target:', error);
            notify('Could not save the figures.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!target) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`${localityLabel(target.stateKey, target.localityKey, isArabic)} — ${year}`}
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    {stateLabel(target.stateKey, isArabic)}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {POPULATION_FIELDS.map((field) => (
                        <Input
                            key={field.id}
                            type="number"
                            min="0"
                            step="1"
                            label={isArabic ? field.labelAr : field.label}
                            value={form[field.id] ?? 0}
                            onChange={(e) => setForm((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        />
                    ))}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </div>
        </Modal>
    );
}

// =============================================================================
// Main screen
// =============================================================================

export default function PopulationManagementView({ permissions = {} }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    // canManagePopulation is new, so accounts whose stored permissions map was
    // written before it existed have no value for it. Those maps are not
    // migrated, so falling back to the federal flag keeps the people who
    // already reach this screen — Planning is gated on it — able to use it.
    const canEdit = !!(permissions.canManagePopulation ?? permissions.canUseFederalManagerAdvancedFeatures);

    const [year, setYear] = useState(null);
    const population = usePopulation(year);
    const activeYear = population.activeYear;

    const [stateFilter, setStateFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [importOpen, setImportOpen] = useState(false);
    // The upload lives here rather than inside the modal. The modal has been
    // reported closing on its own after a file was chosen; held at this level
    // the work survives that, and reopening returns to the same place.
    const [importDraft, setImportDraft] = useState({});
    const closeImport = useCallback(() => setImportOpen(false), []);
    const [editing, setEditing] = useState(null);

    const yearOptions = useMemo(() => {
        const base = new Set(population.availableYears);
        const now = currentTargetYear();
        [now - 1, now, now + 1].forEach((y) => base.add(y));
        return [...base].sort((a, b) => b - a);
    }, [population.availableYears]);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return population.rows
            .filter((r) => stateFilter === 'all' || r.stateKey === stateFilter)
            .filter((r) => !term
                || r.localityKey.toLowerCase().includes(term)
                || localityLabel(r.stateKey, r.localityKey, true).includes(search.trim()))
            .sort((a, b) => a.stateKey.localeCompare(b.stateKey) || a.localityKey.localeCompare(b.localityKey));
    }, [population.rows, stateFilter, search]);

    const openEdit = useCallback((row) => setEditing(row), []);

    const addMissing = useCallback(async (gap) => {
        setEditing(emptyTarget(activeYear, gap.stateKey, gap.localityKey));
    }, [activeYear]);

    const headers = [
        'State', 'Locality', 'Total population', 'Births', 'Surviving infants',
        'Under 5', 'Pregnant women', ...(canEdit ? [''] : []),
    ];

    return (
        <div className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-3 items-end justify-between bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="w-32">
                        <Select
                            label="Target year"
                            value={activeYear}
                            onChange={(e) => setYear(Number(e.target.value))}
                        >
                            {yearOptions.map((y) => (
                                <option key={y} value={y}>
                                    {y}{population.availableYears.includes(y) ? '' : ' (empty)'}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="w-48">
                        <Select label="State" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                            <option value="all">All states</option>
                            {Object.keys(STATE_LOCALITIES)
                                .filter((k) => k !== 'Federal')
                                .map((k) => <option key={k} value={k}>{stateLabel(k, isArabic)}</option>)}
                        </Select>
                    </div>
                    <div className="w-56">
                        <Input
                            label="Search locality"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    {/* Forces a full re-download. Needed when the delta watermark
                        has moved past rows that are in Firestore but not on
                        screen — otherwise a sync can never fetch them again. */}
                    <Button variant="secondary" onClick={() => population.refresh('full')}>
                        <RefreshCw size={16} /> Reload
                    </Button>
                    {canEdit && (
                        <Button onClick={() => setImportOpen(true)}>
                            <Upload size={16} /> Bulk upload
                        </Button>
                    )}
                </div>
            </div>

            {population.hasData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Localities with data', value: population.national.localities },
                        { label: 'Total population', value: fmt(population.national.totalPopulation) },
                        { label: 'Children under 5', value: fmt(population.national.under5) },
                        { label: 'Pregnant women', value: fmt(population.national.pregnantWomen) },
                    ].map((kpi) => (
                        <Card key={kpi.label}>
                            <CardBody className="py-3">
                                <div className="text-xs text-gray-500">{kpi.label}</div>
                                <div className="text-xl font-bold text-slate-800">{kpi.value}</div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            {population.missingLocalities.length > 0 && population.hasData && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                    <div className="font-semibold flex items-center gap-2">
                        <AlertTriangle size={16} />
                        {population.missingLocalities.length} localities have no {activeYear} figures
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {population.missingLocalities.slice(0, 10).map((gap) => (
                            <button
                                key={`${gap.stateKey}|${gap.localityKey}`}
                                type="button"
                                onClick={() => canEdit && addMissing(gap)}
                                className="px-2 py-1 bg-white border border-amber-300 rounded text-xs hover:bg-amber-100"
                            >
                                {localityLabel(gap.stateKey, gap.localityKey, isArabic)}
                                <span className="text-amber-700"> · {stateLabel(gap.stateKey, isArabic)}</span>
                            </button>
                        ))}
                        {population.missingLocalities.length > 10 && (
                            <span className="text-xs self-center">
                                and {population.missingLocalities.length - 10} more
                            </span>
                        )}
                    </div>
                </div>
            )}

            <Card>
                <CardBody>
                    {population.isLoading ? <Spinner /> : (
                        <Table headers={headers}>
                            {visible.length === 0 ? (
                                <EmptyState
                                    colSpan={headers.length}
                                    message={population.hasData
                                        ? 'No localities match this filter.'
                                        : `No population targets for ${activeYear} yet. Use Bulk upload to import them.`}
                                />
                            ) : visible.map((row) => (
                                <tr key={row.id || `${row.stateKey}|${row.localityKey}`}>
                                    <td className="text-gray-600">{stateLabel(row.stateKey, isArabic)}</td>
                                    <td className="font-medium">{localityLabel(row.stateKey, row.localityKey, isArabic)}</td>
                                    <td>{fmt(row.totalPopulation)}</td>
                                    <td className="text-gray-600">{fmt(row.births)}</td>
                                    <td className="text-gray-600">{fmt(row.survivingInfants)}</td>
                                    <td className="text-gray-600">{fmt(row.under5)}</td>
                                    <td className="text-gray-600">{fmt(row.pregnantWomen)}</td>
                                    {canEdit && (
                                        <td>
                                            <Button variant="secondary" onClick={() => openEdit(row)}>
                                                <Pencil size={14} />
                                            </Button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </Table>
                    )}
                </CardBody>
            </Card>

            <ImportModal
                isOpen={canEdit && importOpen}
                year={activeYear}
                onClose={closeImport}
                onImported={population.refresh}
                draft={importDraft}
                setDraft={setImportDraft}
            />
            <EditModal
                isOpen={!!editing}
                onClose={() => setEditing(null)}
                target={editing}
                year={activeYear}
                onSaved={population.refresh}
            />
        </div>
    );
}


// =============================================================================
// Dashboard panel (rendered on the main dashboard)
// =============================================================================



// Written out rather than interpolated: Tailwind only ships classes it can see
// as complete strings in the source, so `bg-${tone}-100` compiles to nothing.
const TONES = {
    sky: 'bg-sky-100 text-sky-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
};

function Kpi({ icon: Icon, label, value, sub, tone = 'sky' }) {
    return (
        <Card>
            <CardBody className="py-4">
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${TONES[tone] || TONES.sky}`}>
                        <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
                        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}

export function PopulationDashboard() {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';

    const [year, setYear] = useState(null);
    const population = usePopulation(year);
    const { national, availableYears, activeYear, byState, hasData, missingLocalities } = population;

    const stateRows = useMemo(
        () => Object.values(byState).sort((a, b) => b.totalPopulation - a.totalPopulation),
        [byState]
    );

    if (population.isLoading) return <Spinner />;

    if (!hasData) {
        return (
            <Card>
                <CardBody className="text-center py-12 text-gray-500">
                    <Users size={32} className="mx-auto mb-3 text-gray-400" />
                    <div className="font-medium text-gray-700">
                        No population targets for {activeYear}
                    </div>
                    <div className="text-sm mt-1">
                        Import them from Planning → Population to enable coverage denominators
                        and supply forecasting.
                    </div>
                </CardBody>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="w-32">
                    <Select label="Year" value={activeYear} onChange={(e) => setYear(Number(e.target.value))}>
                        {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                    </Select>
                </div>
                <div className="text-sm text-gray-600">
                    {national.localities} localities across {national.states} states
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi
                    icon={Users}
                    label={isArabic ? 'إجمالي السكان' : 'Total population'}
                    value={fmt(national.totalPopulation)}
                    sub={`${activeYear} projection`}
                />
                <Kpi
                    icon={Baby}
                    label={isArabic ? 'الأطفال دون الخامسة' : 'Children under 5'}
                    value={fmt(national.under5)}
                    sub={`${pct(national.under5, national.totalPopulation)} of population`}
                    tone="emerald"
                />
                <Kpi
                    icon={HeartPulse}
                    label={isArabic ? 'الرضع الباقون' : 'Surviving infants'}
                    value={fmt(national.survivingInfants)}
                    sub={`${fmt(national.births)} births`}
                    tone="amber"
                />
                <Kpi
                    icon={Users}
                    label={isArabic ? 'النساء الحوامل' : 'Pregnant women'}
                    value={fmt(national.pregnantWomen)}
                    sub={`${fmt(national.cbaw)} of childbearing age`}
                    tone="rose"
                />
            </div>

            {missingLocalities.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                    <AlertTriangle size={16} className="shrink-0" />
                    {missingLocalities.length} localities have no {activeYear} figures, so any
                    coverage or forecast covering them will be understated.
                </div>
            )}

            <Card>
                <CardBody>
                    <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                        <MapPin size={18} className="text-sky-600" />
                        {isArabic ? 'السكان حسب الولاية' : 'Population by state'}
                    </h3>
                    <Table headers={[
                        isArabic ? 'الولاية' : 'State',
                        isArabic ? 'المحليات' : 'Localities',
                        isArabic ? 'إجمالي السكان' : 'Total population',
                        isArabic ? 'دون الخامسة' : 'Under 5',
                        isArabic ? 'المواليد' : 'Births',
                        isArabic ? 'الحوامل' : 'Pregnant women',
                        '% ' + (isArabic ? 'من السكان' : 'of national'),
                    ]}>
                        {stateRows.length === 0 ? (
                            <EmptyState colSpan={7} message="No data." />
                        ) : stateRows.map((row) => (
                            <tr key={row.stateKey}>
                                <td className="font-medium">{stateLabel(row.stateKey, isArabic)}</td>
                                <td className="text-gray-600">{row.localities}</td>
                                <td>{fmt(row.totalPopulation)}</td>
                                <td className="text-gray-600">{fmt(row.under5)}</td>
                                <td className="text-gray-600">{fmt(row.births)}</td>
                                <td className="text-gray-600">{fmt(row.pregnantWomen)}</td>
                                <td className="text-gray-600">{pct(row.totalPopulation, national.totalPopulation)}</td>
                            </tr>
                        ))}
                    </Table>
                </CardBody>
            </Card>
        </div>
    );
}

