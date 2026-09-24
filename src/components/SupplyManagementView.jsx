// src/components/SupplyManagementView.jsx
//
// Part one of Supply Management: the essential supply lists.
//
// Three categories — drugs, equipment, information supplies — each broken down
// by service. Forecasting and the supply chain are built on top of this
// catalogue, which is why every item carries its own quantification parameters
// rather than leaving them to be guessed at forecast time. An item whose
// parameters live with the item can be reviewed and corrected by the person who
// knows the commodity; parameters entered during a forecast run cannot.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Package, Upload, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';

import {
    Card, CardBody, PageHeader, Button, Tabs, Table, EmptyState, Spinner,
    Modal, Input, Select, Textarea, Checkbox, FormGroup, ActionGroup,
} from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import { useDataCache } from '../DataContext';
import { upsertSupplyItem, deleteSupplyItem, bulkUpsertSupplyItems } from '../data';
import { COURSE_TYPES_FACILITATOR } from './constants';

// =============================================================================
// Domain vocabulary
//
// The three categories are the three kinds of thing a service needs in order
// to run: what you give the child (drugs), what you treat them with
// (equipment) and what you record it on (information supplies).
// =============================================================================

export const SUPPLY_CATEGORIES = [
    { id: 'drugs', label: 'Drugs & Medicines', labelAr: 'الأدوية' },
    { id: 'equipment', label: 'Equipment & Devices', labelAr: 'المعدات والأجهزة' },
    // Consumables are quantified from caseload like drugs, not from the number
    // of service points like equipment: a facility uses more gloves and more
    // RDTs when it sees more children, whereas it needs one weighing scale
    // either way. That is why their default basis is a cohort, not per-facility.
    { id: 'consumables', label: 'Consumables & Supplies', labelAr: 'المستهلكات' },
    { id: 'information', label: 'Information Supplies', labelAr: 'المستلزمات المعلوماتية' },
];

// The categories whose need scales with how many children are seen.
export const CASELOAD_CATEGORIES = ['drugs', 'consumables'];

export const SUPPLY_CATEGORY_IDS = SUPPLY_CATEGORIES.map((c) => c.id);

// The services an item can belong to. Deliberately the same list the rest of
// the app uses for course and mentorship types, so an item cannot be filed
// against a service that does not exist elsewhere in the system.
export const SUPPLY_SERVICES = COURSE_TYPES_FACILITATOR;

// Quantification is morbidity/demographic: a cohort size drives the estimate.
// `per_facility` is the exception and is how equipment and information supplies
// are quantified — those scale with the number of service points, not caseload.
export const TARGET_COHORTS = [
    { id: 'under_5', label: 'Children under 5', labelAr: 'الأطفال دون الخامسة' },
    { id: 'under_1', label: 'Infants under 1', labelAr: 'الرضع دون سنة' },
    { id: 'newborns', label: 'Newborns (0–28 days)', labelAr: 'حديثو الولادة' },
    { id: 'pregnant_women', label: 'Pregnant women', labelAr: 'النساء الحوامل' },
    { id: 'women_childbearing_age', label: 'Women of childbearing age', labelAr: 'النساء في سن الإنجاب' },
    { id: 'under_15', label: 'Under 15', labelAr: 'دون الخامسة عشرة' },
    { id: 'age_5_9', label: 'Children 5–9', labelAr: 'الأطفال 5-9 سنوات' },
    { id: 'age_10_14', label: 'Children 10–14', labelAr: 'الأطفال 10-14 سنة' },
    { id: 'age_15_19', label: 'Adolescents 15–19', labelAr: 'المراهقون 15-19 سنة' },
    { id: 'adolescents', label: 'Adolescents 10–19', labelAr: 'إجمالي المراهقين 10-19' },
    { id: 'total_population', label: 'Total population', labelAr: 'إجمالي السكان' },
    { id: 'per_facility', label: 'Per facility (not caseload based)', labelAr: 'لكل مؤسسة' },
];

export const COHORT_IDS = TARGET_COHORTS.map((c) => c.id);

export const DOSAGE_FORMS = [
    'Tablet', 'Capsule', 'Suspension', 'Syrup', 'Injection', 'Infusion',
    'Sachet', 'Drops', 'Ointment', 'Suppository', 'Oxygen', 'Other',
];

export const UNITS_OF_MEASURE = [
    'Tablet', 'Capsule', 'Bottle', 'Vial', 'Ampoule', 'Sachet', 'Tube',
    'Piece', 'Set', 'Kit', 'Pack', 'Box', 'Roll', 'Book', 'Copy', 'Cylinder',
];

export const CURRENCIES = ['USD', 'SDG', 'EUR'];

export const FACILITY_LEVELS = [
    { id: 'community', label: 'Community / iCCM', labelAr: 'المجتمع' },
    { id: 'phc', label: 'Primary health care unit/centre', labelAr: 'الرعاية الصحية الأولية' },
    { id: 'hospital', label: 'Hospital', labelAr: 'المستشفى' },
];

// Defaults used when a new item is created. Every one of these is editable per
// item: they are starting points for a federal manager to adjust, not fixed
// programme assumptions. Forecasting reads them, so a missing value would
// silently produce a zero need — hence explicit defaults rather than blanks.
export const DEFAULT_QUANTIFICATION = {
    targetCohort: 'under_5',
    // Episodes per 1000 of the cohort per year.
    incidencePer1000: 0,
    // Share of those episodes that actually reach a service point, as a
    // percentage. A forecast built on incidence alone over-orders, because not
    // every episode presents for care.
    attendanceRatePercent: 100,
    // Treatment courses needed per episode that presents.
    coursesPerCase: 1,
    // Dispensing units in one treatment course, e.g. 10 tablets.
    unitsPerCourse: 1,
    // Expected loss to breakage, expiry and damage, as a percentage.
    wastagePercent: 10,
    // Safety stock held against demand variation and late deliveries.
    bufferPercent: 25,
    // Used only when targetCohort is 'per_facility'.
    quantityPerFacility: 0,
    // The period a forecast covers, in months.
    reviewPeriodMonths: 12,
};

export const emptySupplyItem = (category = 'drugs', service = SUPPLY_SERVICES[0]) => ({
    category,
    service,
    name: '',
    nameAr: '',
    code: '',
    strength: '',
    form: '',
    unit: '',
    description: '',
    // Indicative only: a planning figure for costing a forecast, not a
    // contracted price. Currency is stored with it because the same item is
    // quoted in USD by international suppliers and in SDG locally, and a bare
    // number would silently mix the two in any total.
    indicativePrice: '',
    currency: 'USD',
    levels: [],
    isEssential: true,
    quantification: {
        ...DEFAULT_QUANTIFICATION,
        // Equipment and information supplies scale with service points, not
        // caseload, so they default to the per-facility basis.
        targetCohort: CASELOAD_CATEGORIES.includes(category) ? 'under_5' : 'per_facility',
    },
    notes: '',
});

export const categoryLabel = (id, isArabic) => {
    const found = SUPPLY_CATEGORIES.find((c) => c.id === id);
    if (!found) return id;
    return isArabic ? found.labelAr : found.label;
};

export const cohortLabel = (id, isArabic) => {
    const found = TARGET_COHORTS.find((c) => c.id === id);
    if (!found) return id;
    return isArabic ? found.labelAr : found.label;
};

const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

// The annual need for one item, from the item's own parameters. Exported so the
// forecasting screen uses exactly this calculation rather than a second copy
// that can drift away from it.
//
//   caseload   = cohort × incidence per 1000 ÷ 1000 × attendance rate
//   units      = caseload × courses per case × units per course
//   order      = units × (1 + wastage) × (1 + buffer)
//
// `cohortSize` comes from the demographic data on the dashboard. Until that
// exists the screen passes null and the preview shows the formula without a
// number, which is honest about what is missing rather than showing a zero that
// looks like a real answer.
export function annualNeed(quantification, cohortSize, facilityCount) {
    const q = quantification || {};
    const wastage = 1 + num(q.wastagePercent) / 100;
    const buffer = 1 + num(q.bufferPercent) / 100;
    const months = num(q.reviewPeriodMonths, 12) || 12;
    const periodFactor = months / 12;

    if (q.targetCohort === 'per_facility') {
        if (facilityCount == null) return null;
        return num(q.quantityPerFacility) * facilityCount * wastage * buffer * periodFactor;
    }

    if (cohortSize == null) return null;
    const caseload = (cohortSize * num(q.incidencePer1000)) / 1000
        * (num(q.attendanceRatePercent, 100) / 100);
    const units = caseload * num(q.coursesPerCase, 1) * num(q.unitsPerCourse, 1);
    return units * wastage * buffer * periodFactor;
}

// =============================================================================
// Add / edit form
// =============================================================================

function SupplyItemModal({ isOpen, onClose, onSaved, item, defaultCategory, defaultService, section = 'list' }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [form, setForm] = useState(() => item || emptySupplyItem(defaultCategory, defaultService));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) setForm(item || emptySupplyItem(defaultCategory, defaultService));
    }, [isOpen, item, defaultCategory, defaultService]);

    const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));
    const setQuant = (name, value) => setForm((prev) => ({
        ...prev, quantification: { ...prev.quantification, [name]: value },
    }));

    const toggleLevel = (levelId) => setForm((prev) => {
        const levels = prev.levels || [];
        return {
            ...prev,
            levels: levels.includes(levelId)
                ? levels.filter((l) => l !== levelId)
                : [...levels, levelId],
        };
    });

    const isDrug = form.category === 'drugs';
    const perFacility = form.quantification?.targetCohort === 'per_facility';

    const handleSave = async () => {
        if (!form.name?.trim()) {
            notify('Please enter the item name.', 'error');
            return;
        }
        if (!form.service) {
            notify('Please choose the service this item belongs to.', 'error');
            return;
        }
        setSaving(true);
        try {
            await upsertSupplyItem({ ...form, name: form.name.trim() });
            notify(item?.id ? 'Item updated.' : 'Item added to the essential list.', 'success');
            onSaved();
            onClose();
        } catch (error) {
            console.error('Failed to save supply item:', error);
            notify('Could not save the item. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={item?.id
                ? (section === 'quantification' ? 'Quantification parameters' : 'Edit supply item')
                : 'Add supply item'}
        >
            <div className="space-y-6">
                {/* Strictly one half or the other, never both. Adding an item is
                    deciding it belongs on the essential list; quantifying it is a
                    separate judgement made later, against an item that already
                    exists. A new item therefore gets its category's default
                    parameters and is refined from the Quantification tab. */}
                <section className={`space-y-4 ${section === 'quantification' ? 'hidden' : ''}`}>
                    <h4 className="font-semibold text-gray-800 border-b pb-2">Item details</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Category"
                            value={form.category}
                            onChange={(e) => {
                                const category = e.target.value;
                                setForm((prev) => ({
                                    ...prev,
                                    category,
                                    quantification: {
                                        ...prev.quantification,
                                        targetCohort: CASELOAD_CATEGORIES.includes(category)
                                            ? (prev.quantification?.targetCohort === 'per_facility'
                                                ? 'under_5' : prev.quantification?.targetCohort)
                                            : 'per_facility',
                                    },
                                }));
                            }}
                        >
                            {SUPPLY_CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>{isArabic ? c.labelAr : c.label}</option>
                            ))}
                        </Select>

                        <Select label="Service" value={form.service} onChange={(e) => setField('service', e.target.value)}>
                            {SUPPLY_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </Select>

                        <Input
                            label="Item name (English)"
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            placeholder="e.g. Amoxicillin dispersible"
                        />
                        <Input
                            label="Item name (Arabic)"
                            value={form.nameAr || ''}
                            onChange={(e) => setField('nameAr', e.target.value)}
                            dir="rtl"
                        />

                        <Input
                            label="Item code"
                            value={form.code || ''}
                            onChange={(e) => setField('code', e.target.value)}
                            placeholder="Optional"
                        />

                        <Select label="Unit of measure" value={form.unit || ''} onChange={(e) => setField('unit', e.target.value)}>
                            <option value="">Select a unit…</option>
                            {UNITS_OF_MEASURE.map((u) => <option key={u} value={u}>{u}</option>)}
                        </Select>

                        <Input
                            label="Indicative price (per unit)"
                            type="number" min="0" step="any"
                            value={form.indicativePrice ?? ''}
                            onChange={(e) => setField('indicativePrice', e.target.value)}
                            placeholder="e.g. 0.85"
                        />
                        <Select label="Currency" value={form.currency || 'USD'}
                            onChange={(e) => setField('currency', e.target.value)}>
                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>

                        {isDrug && (
                            <>
                                <Input
                                    label="Strength"
                                    value={form.strength || ''}
                                    onChange={(e) => setField('strength', e.target.value)}
                                    placeholder="e.g. 250 mg"
                                />
                                <Select label="Dosage form" value={form.form || ''} onChange={(e) => setField('form', e.target.value)}>
                                    <option value="">Select a form…</option>
                                    {DOSAGE_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                                </Select>
                            </>
                        )}
                    </div>

                    <Textarea
                        label="Description"
                        rows={2}
                        value={form.description || ''}
                        onChange={(e) => setField('description', e.target.value)}
                        placeholder="Specification, presentation or any detail a procurement officer needs"
                    />

                    <FormGroup label="Required at">
                        <div className="flex flex-wrap gap-4">
                            {FACILITY_LEVELS.map((level) => (
                                <label key={level.id} className="flex items-center gap-2 text-sm text-gray-700">
                                    <Checkbox
                                        checked={(form.levels || []).includes(level.id)}
                                        onChange={() => toggleLevel(level.id)}
                                    />
                                    {isArabic ? level.labelAr : level.label}
                                </label>
                            ))}
                        </div>
                    </FormGroup>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <Checkbox
                            checked={form.isEssential !== false}
                            onChange={(e) => setField('isEssential', e.target.checked)}
                        />
                        On the essential list
                    </label>
                </section>

                <section className={`space-y-4 ${section === 'list' ? 'hidden' : ''}`}>
                    <h4 className="font-semibold text-gray-800 border-b pb-2">
                        Quantification parameters
                    </h4>
                    <p className="text-sm text-gray-600">
                        These drive the forecast. They are estimates for this item and can be
                        revised at any time.
                    </p>

                    <Select
                        label="Quantification basis"
                        value={form.quantification?.targetCohort || 'under_5'}
                        onChange={(e) => setQuant('targetCohort', e.target.value)}
                    >
                        {TARGET_COHORTS.map((c) => (
                            <option key={c.id} value={c.id}>{isArabic ? c.labelAr : c.label}</option>
                        ))}
                    </Select>

                    {perFacility ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                type="number" min="0" step="any"
                                label="Quantity per facility"
                                value={form.quantification?.quantityPerFacility ?? 0}
                                onChange={(e) => setQuant('quantityPerFacility', e.target.value)}
                            />
                            <Input
                                type="number" min="1" step="1"
                                label="Replacement period (months)"
                                value={form.quantification?.reviewPeriodMonths ?? 12}
                                onChange={(e) => setQuant('reviewPeriodMonths', e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                type="number" min="0" step="any"
                                label="Incidence per 1000 per year"
                                value={form.quantification?.incidencePer1000 ?? 0}
                                onChange={(e) => setQuant('incidencePer1000', e.target.value)}
                            />
                            <Input
                                type="number" min="0" max="100" step="any"
                                label="Share of cases reaching care (%)"
                                value={form.quantification?.attendanceRatePercent ?? 100}
                                onChange={(e) => setQuant('attendanceRatePercent', e.target.value)}
                            />
                            <Input
                                type="number" min="0" step="any"
                                label="Treatment courses per case"
                                value={form.quantification?.coursesPerCase ?? 1}
                                onChange={(e) => setQuant('coursesPerCase', e.target.value)}
                            />
                            <Input
                                type="number" min="0" step="any"
                                label="Units per treatment course"
                                value={form.quantification?.unitsPerCourse ?? 1}
                                onChange={(e) => setQuant('unitsPerCourse', e.target.value)}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            type="number" min="0" max="100" step="any"
                            label="Wastage allowance (%)"
                            value={form.quantification?.wastagePercent ?? 10}
                            onChange={(e) => setQuant('wastagePercent', e.target.value)}
                        />
                        <Input
                            type="number" min="0" max="100" step="any"
                            label="Buffer stock (%)"
                            value={form.quantification?.bufferPercent ?? 25}
                            onChange={(e) => setQuant('bufferPercent', e.target.value)}
                        />
                        {!perFacility && (
                            <Input
                                type="number" min="1" step="1"
                                label="Forecast period (months)"
                                value={form.quantification?.reviewPeriodMonths ?? 12}
                                onChange={(e) => setQuant('reviewPeriodMonths', e.target.value)}
                            />
                        )}
                    </div>

                    <div className="bg-sky-50 border border-sky-200 rounded p-3 text-sm text-sky-900">
                        <strong>How this item will be forecast:</strong>{' '}
                        {perFacility ? (
                            <>
                                {form.quantification?.quantityPerFacility || 0} per facility ×
                                number of facilities offering {form.service}, plus{' '}
                                {form.quantification?.wastagePercent ?? 10}% wastage and{' '}
                                {form.quantification?.bufferPercent ?? 25}% buffer.
                            </>
                        ) : (
                            <>
                                {cohortLabel(form.quantification?.targetCohort, isArabic)} ×{' '}
                                {form.quantification?.incidencePer1000 || 0} per 1000 ×{' '}
                                {form.quantification?.attendanceRatePercent ?? 100}% reaching care ×{' '}
                                {form.quantification?.coursesPerCase ?? 1} course(s) ×{' '}
                                {form.quantification?.unitsPerCourse ?? 1} unit(s), plus{' '}
                                {form.quantification?.wastagePercent ?? 10}% wastage and{' '}
                                {form.quantification?.bufferPercent ?? 25}% buffer.
                            </>
                        )}
                        <div className="mt-1 text-sky-700">
                            Population figures come from the dashboard demographic data, so the
                            forecast screen will fill in the cohort size.
                        </div>
                    </div>

                    <Textarea
                        label="Notes"
                        rows={2}
                        value={form.notes || ''}
                        onChange={(e) => setField('notes', e.target.value)}
                    />
                </section>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save item'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// =============================================================================
// Bulk import of the essential list
//
// Separate from quantification on purpose: a workbook of item names is the
// thing programmes actually circulate and agree on, and it should be loadable
// without anyone having to fill in incidence rates first. Imported items get
// the default quantification for their category, which the Quantification tab
// then refines.
// =============================================================================

const IMPORT_COLUMNS = [
    { id: 'category', label: 'Category', required: true, headers: ['category', 'type'] },
    { id: 'service', label: 'Service', required: true, headers: ['service', 'programme', 'program'] },
    { id: 'name', label: 'Item name', required: true, headers: ['item name', 'name', 'item'] },
    { id: 'nameAr', label: 'Name (Arabic)', headers: ['name arabic', 'arabic name', 'الاسم'] },
    { id: 'code', label: 'Code', headers: ['code', 'item code', 'sku'] },
    { id: 'strength', label: 'Strength', headers: ['strength', 'dose'] },
    { id: 'form', label: 'Form', headers: ['form', 'dosage form'] },
    { id: 'unit', label: 'Unit', headers: ['unit', 'unit of measure', 'uom'] },
    { id: 'description', label: 'Description', headers: ['description', 'specification', 'details'] },
    { id: 'indicativePrice', label: 'Indicative price', headers: ['indicative price', 'price', 'unit price', 'unit cost'] },
    { id: 'currency', label: 'Currency', headers: ['currency', 'ccy'] },
];

const normCell = (v) => String(v ?? '').trim();
const normKey = (v) => normCell(v).toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');

// Accepts the category by id, by English label or by Arabic label, so a sheet
// can say "Drugs & Medicines", "drugs" or "الأدوية" and all three land.
function matchCategory(value) {
    const n = normKey(value);
    if (!n) return null;
    const hit = SUPPLY_CATEGORIES.find((c) => normKey(c.id) === n
        || normKey(c.label) === n || normKey(c.labelAr) === n
        || normKey(c.label).startsWith(n) || n.startsWith(normKey(c.id)));
    return hit ? hit.id : null;
}

function matchService(value) {
    const n = normKey(value);
    if (!n) return null;
    return SUPPLY_SERVICES.find((s) => normKey(s) === n) || null;
}

export function parseSupplyRows(rows) {
    if (!Array.isArray(rows) || rows.length < 2) {
        return { rows: [], unknown: [], error: 'The sheet needs a header row and at least one item.' };
    }

    // Find the header row: the first that mentions an item-name column.
    let headerAt = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const cells = (rows[i] || []).map(normKey);
        if (cells.some((c) => c === 'itemname' || c === 'name' || c === 'item')) { headerAt = i; break; }
    }
    if (headerAt === -1) {
        return { rows: [], unknown: [], error: 'Could not find a header row containing an "Item name" column.' };
    }

    const header = (rows[headerAt] || []).map(normKey);
    const columns = {};
    IMPORT_COLUMNS.forEach((col) => {
        columns[col.id] = header.findIndex((h) => h && col.headers.some((c) => normKey(c) === h));
    });

    const missing = IMPORT_COLUMNS.filter((c) => c.required && columns[c.id] < 0).map((c) => c.label);
    if (missing.length) {
        return { rows: [], unknown: [], error: `These required columns are missing: ${missing.join(', ')}.` };
    }

    const parsed = [];
    const unknown = [];
    for (let i = headerAt + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const name = normCell(row[columns.name]);
        if (!name) continue;

        const category = matchCategory(row[columns.category]);
        const service = matchService(row[columns.service]);
        if (!category || !service) {
            unknown.push({
                row: i + 1, name,
                rawCategory: normCell(row[columns.category]),
                rawService: normCell(row[columns.service]),
                reason: !category ? 'unrecognised category' : 'unrecognised service',
            });
            continue;
        }

        const item = emptySupplyItem(category, service);
        item.name = name;
        ['nameAr', 'code', 'strength', 'form', 'unit', 'description'].forEach((id) => {
            if (columns[id] >= 0) item[id] = normCell(row[columns[id]]);
        });

        // A price has to be a number to be summed in a forecast; a blank cell
        // stays blank rather than becoming 0, which would read as "free".
        if (columns.indicativePrice >= 0) {
            const raw = normCell(row[columns.indicativePrice]).replace(/[, ]/g, '');
            const n = Number(raw);
            item.indicativePrice = raw !== '' && Number.isFinite(n) && n >= 0 ? n : '';
        }
        // Only overwrite the default when the sheet actually says something,
        // otherwise an empty column would blank the currency on every row.
        if (columns.currency >= 0) {
            const ccy = normCell(row[columns.currency]).toUpperCase();
            if (CURRENCIES.includes(ccy)) item.currency = ccy;
        }
        parsed.push(item);
    }

    // Two rows for the same item in the same service is a data problem, not
    // something to silently collapse.
    const seen = new Map();
    const duplicates = [];
    parsed.forEach((r) => {
        const key = `${r.category}|${r.service}|${r.name.toLowerCase()}`;
        if (seen.has(key)) duplicates.push(r); else seen.set(key, r);
    });

    return { rows: [...seen.values()], unknown, duplicates, headerRowNumber: headerAt + 1 };
}

export async function downloadSupplyTemplate() {
    const XLSX = await import('xlsx');
    const header = IMPORT_COLUMNS.map((c) => c.label);
    const example = [
        ['Drugs & Medicines', 'IMNCI', 'Amoxicillin dispersible', 'أموكسيسيلين', 'AMX250', '250 mg', 'Tablet', 'Tablet',
            'Dispersible tablet, blister of 10', 0.05, 'USD'],
        ['Consumables & Supplies', 'IMNCI', 'Malaria RDT', 'اختبار الملاريا السريع', 'RDT01', '', '', 'Piece',
            'Rapid diagnostic test, individually wrapped', 0.35, 'USD'],
        ['Equipment & Devices', 'ETAT', 'Pulse oximeter', 'مقياس التأكسج', 'EQ-POX', '', '', 'Piece',
            'Handheld, paediatric probe included', 120, 'USD'],
        ['Information Supplies', 'IMNCI', 'IMNCI recording form', 'استمارة تسجيل', 'FRM01', '', '', 'Book',
            'A4, 100 pages per book', 1.2, 'USD'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...example]);
    ws['!cols'] = IMPORT_COLUMNS.map(() => ({ wch: 24 }));

    const notes = [
        ['Column', 'Meaning', 'Required'],
        ...IMPORT_COLUMNS.map((c) => [c.label, '', c.required ? 'Yes' : 'Optional']),
        [],
        ['Category must be one of', SUPPLY_CATEGORIES.map((c) => c.label).join(' | '), ''],
        ['Service must be one of', SUPPLY_SERVICES.join(' | '), ''],
        ['Currency must be one of', CURRENCIES.join(' | ') + ' (defaults to USD if blank)', ''],
        ['Indicative price', 'Per unit, a planning figure only — not a contracted price.', ''],
        [],
        ['', 'Quantification is NOT set here. Imported items get their category default,', ''],
        ['', 'which you then refine on the Quantification tab.', ''],
    ];
    const wsNotes = XLSX.utils.aoa_to_sheet(notes);
    wsNotes['!cols'] = [{ wch: 24 }, { wch: 70 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Essential list');
    XLSX.utils.book_append_sheet(wb, wsNotes, 'How to fill in');
    XLSX.writeFile(wb, 'essential-supply-list-template.xlsx');
}

function SupplyImportModal({ isOpen, onClose, onImported }) {
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { if (isOpen) { setPreview(null); setError(''); } }, [isOpen]);

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setBusy(true); setError('');
        try {
            const XLSX = await import('xlsx');
            const wb = XLSX.read(await file.arrayBuffer());
            const sheet = wb.SheetNames.find((n) => /item|list|supply/i.test(n)) || wb.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null });
            const result = parseSupplyRows(rows);
            if (result.error) setError(result.error);
            setPreview({ ...result, sheet, fileName: file.name });
        } catch (err) {
            console.error('Failed to read supply workbook:', err);
            setError('Could not read that file. Is it a valid Excel workbook?');
        } finally {
            setBusy(false);
            event.target.value = '';
        }
    };

    const commit = async () => {
        if (!preview?.rows?.length) return;
        const ok = await confirmDialog(
            `Add ${preview.rows.length} items to the essential list? Existing items are not removed.`,
            { title: 'Import essential list', confirmLabel: 'Import' }
        );
        if (!ok) return;
        setBusy(true); setError('');
        try {
            const count = await bulkUpsertSupplyItems(preview.rows);
            notify(`Imported ${count} items.`, 'success');
            onImported();
            onClose();
        } catch (err) {
            console.error('Supply import failed:', err);
            const raw = String(err?.message || err);
            setError(/insufficient permissions|permission-denied/i.test(raw)
                ? 'Firestore refused the write. Your account needs federal manager or super user rights. Nothing was saved.'
                : `The import failed and nothing was saved. ${raw}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import essential supply list">
            <div className="space-y-4">
                {error && (
                    <div className="flex gap-2 bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <div>{error}</div>
                    </div>
                )}

                <div className="p-3 bg-sky-50 border border-sky-200 rounded space-y-2">
                    <div className="text-sm text-sky-900">
                        The template lists the exact category and service names the system
                        accepts, with one worked example per category.
                    </div>
                    <Button variant="secondary" onClick={downloadSupplyTemplate}>
                        <Download size={16} /> Download template
                    </Button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Choose an Excel workbook
                    </label>
                    <input
                        type="file"
                        accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={handleFile}
                        disabled={busy}
                        className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                    />
                </div>

                {busy && <Spinner />}

                {preview && !preview.error && (
                    <div className="space-y-3">
                        <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                            <div>
                                <strong>{preview.rows.length} items</strong> read from
                                {' '}&ldquo;{preview.sheet}&rdquo;.
                                {preview.duplicates?.length > 0 && (
                                    <> {preview.duplicates.length} duplicate row(s) ignored.</>
                                )}
                                <div className="mt-1 text-xs">
                                    {SUPPLY_CATEGORIES.map((c) => {
                                        const n = preview.rows.filter((r) => r.category === c.id).length;
                                        return n ? <span key={c.id} className="mr-3">{c.label}: {n}</span> : null;
                                    })}
                                </div>
                            </div>
                        </div>

                        {preview.unknown?.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                                <div className="font-semibold flex items-center gap-2">
                                    <AlertTriangle size={16} />
                                    {preview.unknown.length} row(s) skipped
                                </div>
                                <ul className="mt-2 ml-5 list-disc space-y-0.5 max-h-32 overflow-y-auto">
                                    {preview.unknown.slice(0, 10).map((u, i) => (
                                        <li key={i}>
                                            Row {u.row}: &ldquo;{u.name}&rdquo; — {u.reason}
                                            {u.reason.includes('category')
                                                ? ` ("${u.rawCategory}")`
                                                : ` ("${u.rawService}")`}
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-2 text-xs">
                                    Category must be one of: {SUPPLY_CATEGORIES.map((c) => c.label).join(', ')}.
                                    Service must be one of: {SUPPLY_SERVICES.join(', ')}.
                                </div>
                            </div>
                        )}

                        <div className="overflow-auto max-h-48 border rounded">
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        {['Category', 'Service', 'Item', 'Code', 'Unit'].map((h) => (
                                            <th key={h} className="border-b p-2 text-left">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.rows.slice(0, 8).map((r, i) => (
                                        <tr key={i}>
                                            <td className="border-b p-2">{categoryLabel(r.category, false)}</td>
                                            <td className="border-b p-2">{r.service}</td>
                                            <td className="border-b p-2">{r.name}</td>
                                            <td className="border-b p-2">{r.code || '—'}</td>
                                            <td className="border-b p-2">{r.unit || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={commit} disabled={busy || !preview?.rows?.length}>
                        Import {preview?.rows?.length || 0} items
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// =============================================================================
// Main view
// =============================================================================

export default function SupplyManagementView({ permissions = {} }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const canManage = !!permissions.canManageSupplyChain;

    const { supplyItems, fetchSupplyItems, isLoading } = useDataCache();

    // Two jobs, kept apart because they are done by different people at
    // different times: agreeing WHAT belongs on the essential list, and setting
    // the assumptions used to quantify it. Mixing them into one form made every
    // routine edit to an item name scroll past a wall of forecasting numbers.
    const [section, setSection] = useState('list');
    const [category, setCategory] = useState('drugs');
    const [service, setService] = useState('all');
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [importOpen, setImportOpen] = useState(false);

    useEffect(() => {
        if (!supplyItems) fetchSupplyItems(false);
    }, [supplyItems, fetchSupplyItems]);

    const reload = useCallback(() => fetchSupplyItems(true), [fetchSupplyItems]);

    const visibleItems = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (supplyItems || [])
            .filter((item) => item.isDeleted !== true)
            .filter((item) => item.category === category)
            .filter((item) => service === 'all' || item.service === service)
            .filter((item) => !term
                || (item.name || '').toLowerCase().includes(term)
                || (item.nameAr || '').includes(search.trim())
                || (item.code || '').toLowerCase().includes(term))
            .sort((a, b) => (a.service || '').localeCompare(b.service || '')
                || (a.name || '').localeCompare(b.name || ''));
    }, [supplyItems, category, service, search]);

    // Counts per service for the current category, so a federal manager can see
    // at a glance which service still has an empty list.
    const countsByService = useMemo(() => {
        const counts = {};
        (supplyItems || [])
            .filter((i) => i.isDeleted !== true && i.category === category)
            .forEach((i) => { counts[i.service] = (counts[i.service] || 0) + 1; });
        return counts;
    }, [supplyItems, category]);

    const handleDelete = async (item) => {
        const ok = await confirmDialog(
            `Remove "${item.name}" from the essential list? It will no longer appear in forecasts.`,
            { title: 'Remove item', confirmLabel: 'Remove', danger: true }
        );
        if (!ok) return;
        try {
            await deleteSupplyItem(item.id);
            notify('Item removed.', 'success');
            reload();
        } catch (error) {
            console.error('Failed to delete supply item:', error);
            notify('Could not remove the item.', 'error');
        }
    };

    const openAdd = () => { setEditing(null); setModalOpen(true); };
    const openEdit = (item) => { setEditing(item); setModalOpen(true); };

    const isDrugTab = category === 'drugs';
    const isQuant = section === 'quantification';

    // Adding and importing belong to the essential list. On the quantification
    // tab there is nothing to add: you are revising parameters on items that
    // already exist, which is why the action buttons are gated on the section.
    const headers = isQuant
        ? ['Item', 'Service', 'Basis', 'Incidence /1000', 'Reach %', 'Units/case',
            'Wastage %', 'Buffer %', ...(canManage ? ['Actions'] : [])]
        : ['Item', 'Description', 'Code', isDrugTab ? 'Strength / form' : 'Required at',
            'Unit', 'Indicative price', 'Service', ...(canManage ? ['Actions'] : [])];

    return (
        <div className="space-y-4">
            <PageHeader
                title="Supply Management"
                subtitle="Essential supply lists for child health services"
                actions={canManage && section === 'list' ? (
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setImportOpen(true)}>
                            <Upload size={16} /> Bulk upload
                        </Button>
                        <Button onClick={openAdd}>
                            <Plus size={16} /> Add item
                        </Button>
                    </div>
                ) : null}
            />

            <Card>
                <CardBody className="space-y-4">
                    <Tabs
                        tabs={[
                            { id: 'list', label: isArabic ? 'القائمة الأساسية' : 'Essential list' },
                            { id: 'quantification', label: isArabic ? 'التقدير الكمي' : 'Quantification' },
                        ]}
                        activeTab={section}
                        onTabChange={setSection}
                    />

                    <Tabs
                        tabs={SUPPLY_CATEGORIES.map((c) => ({
                            id: c.id,
                            label: isArabic ? c.labelAr : c.label,
                        }))}
                        activeTab={category}
                        onTabChange={setCategory}
                    />

                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="min-w-[200px]">
                            <Select
                                label="Service"
                                value={service}
                                onChange={(e) => setService(e.target.value)}
                            >
                                <option value="all">All services</option>
                                {SUPPLY_SERVICES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}{countsByService[s] ? ` (${countsByService[s]})` : ''}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <Input
                                label="Search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Item name or code"
                            />
                        </div>
                        <div className="text-sm text-gray-600 pb-2">
                            <Package size={16} className="inline mr-1" />
                            {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}
                        </div>
                    </div>

                    {isLoading?.supplyItems && !supplyItems ? <Spinner /> : (
                        <Table headers={headers}>
                            {visibleItems.length === 0 ? (
                                <EmptyState
                                    colSpan={headers.length}
                                    message={
                                        search || service !== 'all'
                                            ? 'No items match this filter.'
                                            : `No ${categoryLabel(category, isArabic).toLowerCase()} on the list yet.`
                                    }
                                />
                            ) : visibleItems.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <div className="font-medium">{item.name}</div>
                                        {item.nameAr && (
                                            <div className="text-gray-500 text-xs" dir="rtl">{item.nameAr}</div>
                                        )}
                                    </td>
                                    {isQuant ? (
                                        <>
                                            <td>
                                                <span className="px-2 py-1 bg-sky-100 text-sky-800 rounded text-xs">
                                                    {item.service}
                                                </span>
                                            </td>
                                            <td className="text-gray-600 text-xs">
                                                {cohortLabel(item.quantification?.targetCohort, isArabic)}
                                            </td>
                                            {item.quantification?.targetCohort === 'per_facility' ? (
                                                <td className="text-gray-600" colSpan={3}>
                                                    {item.quantification?.quantityPerFacility || 0} per facility
                                                </td>
                                            ) : (
                                                <>
                                                    <td className="text-gray-600">{item.quantification?.incidencePer1000 ?? 0}</td>
                                                    <td className="text-gray-600">{item.quantification?.attendanceRatePercent ?? 100}</td>
                                                    <td className="text-gray-600">
                                                        {(item.quantification?.coursesPerCase ?? 1) * (item.quantification?.unitsPerCourse ?? 1)}
                                                    </td>
                                                </>
                                            )}
                                            <td className="text-gray-600">{item.quantification?.wastagePercent ?? 10}</td>
                                            <td className="text-gray-600">{item.quantification?.bufferPercent ?? 25}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="text-gray-600 max-w-xs">
                                                <span className="line-clamp-2">{item.description || '—'}</span>
                                            </td>
                                            <td className="text-gray-600">{item.code || '—'}</td>
                                            <td className="text-gray-600">
                                                {isDrugTab
                                                    ? [item.strength, item.form].filter(Boolean).join(' · ') || '—'
                                                    : (item.levels || [])
                                                        .map((l) => {
                                                            const found = FACILITY_LEVELS.find((f) => f.id === l);
                                                            return found ? (isArabic ? found.labelAr : found.label) : l;
                                                        })
                                                        .join(', ') || '—'}
                                            </td>
                                            <td className="text-gray-600">{item.unit || '—'}</td>
                                            <td className="text-gray-700 whitespace-nowrap">
                                                {item.indicativePrice === '' || item.indicativePrice == null
                                                    ? '—'
                                                    : `${Number(item.indicativePrice).toLocaleString()} ${item.currency || 'USD'}`}
                                            </td>
                                            <td>
                                                <span className="px-2 py-1 bg-sky-100 text-sky-800 rounded text-xs">
                                                    {item.service}
                                                </span>
                                                {item.isEssential === false && (
                                                    <span className="ml-1 text-gray-400 text-xs">(not on list)</span>
                                                )}
                                            </td>
                                        </>
                                    )}
                                    {canManage && (
                                        <td>
                                            <ActionGroup>
                                                <Button variant="secondary" onClick={() => openEdit(item)}>
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button variant="danger" onClick={() => handleDelete(item)}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </ActionGroup>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </Table>
                    )}
                </CardBody>
            </Card>

            <SupplyImportModal
                isOpen={canManage && importOpen}
                onClose={() => setImportOpen(false)}
                onImported={reload}
            />
            <SupplyItemModal
                section={section}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSaved={reload}
                item={editing}
                defaultCategory={category}
                defaultService={service === 'all' ? SUPPLY_SERVICES[0] : service}
            />
        </div>
    );
}
