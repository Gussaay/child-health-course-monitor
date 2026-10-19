// src/components/SupervisionView.jsx
//
// Supervision: structured facility assessments, grouped by service the same
// way skills mentorship is. Three pages before any record: the services, the
// forms of the chosen service, then the chosen form with its Assessments,
// Dashboard and Deleted Items tabs.
//
// The form itself is one long page of collapsible sections, each with its own
// progress bar, laid out as stacked cards so a phone never scrolls sideways,
// with Save at the bottom as in the mentorship forms. The same form is what a
// public link (/public/supervision/<form id>) opens, for people who fill it
// without the supervision module.
//
// The checklists, their scoring, progress and the dashboard figures live in
// supervision/checklists.js; this file only renders them.

import React, { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import {
    Plus, Pencil, Trash2, ArrowLeft, Baby, ShieldCheck, Stethoscope, Siren, HeartPulse, ChevronRight,
    ChevronDown, X, Hospital, Thermometer, ClipboardList, Share2, Copy, ExternalLink, CheckCircle2, Search,
} from 'lucide-react';

import {
    Card, CardBody, PageHeader, Button, Tabs, Table, EmptyState, Modal,
    Input, Select, Textarea, IS_NATIVE, useInPageBack, SkeletonTable,
} from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import { useDataCache } from '../DataContext';
import { upsertSupervisionAssessment, deleteSupervisionAssessment } from '../data';
import { STATE_LOCALITIES } from './constants';
import { useLeaveGuard, leaveForm, formSaved } from '../utils/leaveGuard';
import { publicBaseUrl } from '../utils/publicLink';
import {
    SUPERVISION_SERVICES, getChecklist, checklistsForService, pickLabel,
    scoreSection, scoreAssessment, pctText, toneFor, toNum,
    defaultPeriodStart, periodMonths, cascadeMonths, monthLabel,
    serviceDataCalc, warmerResults, estimateNeed, assessmentProgress,
} from './supervision/checklists';

const SupervisionDashboard = lazy(() => import('./supervision/SupervisionDashboard.jsx'));

// =============================================================================
// Answer controls
// =============================================================================

const FIELD = 'w-full min-w-0 border border-slate-300 rounded-md px-2 py-2 text-sm bg-white disabled:bg-slate-50';

// Yes / No as two buttons: one tap on a phone, and tapping the chosen one
// again clears it. Stored as true / false, cleared as null (Firestore rejects
// undefined).
function YesNo({ value, onChange, readOnly }) {
    const { t } = useTranslation();
    const opt = (v, label, on) => (
        <button type="button" disabled={readOnly} aria-pressed={value === v}
            onClick={() => onChange(value === v ? null : v)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-default ${value === v ? on : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            {label}
        </button>
    );
    return (
        <div className="flex gap-2">
            {opt(true, t('trackers.supervision.yes', 'Yes'), 'bg-emerald-600 text-white border-emerald-600')}
            {opt(false, t('trackers.supervision.no', 'No'), 'bg-red-600 text-white border-red-600')}
        </div>
    );
}

function CellInput({ kind = 'number', value, onChange, readOnly, options = [], isArabic, placeholder }) {
    if (kind === 'yesno') return <YesNo value={value} onChange={onChange} readOnly={readOnly} />;
    if (kind === 'select') {
        return (
            <select disabled={readOnly} className={FIELD} value={value || ''} onChange={(e) => onChange(e.target.value)}>
                <option value="">—</option>
                {options.map((o) => <option key={o.value} value={o.value}>{pickLabel(o, isArabic)}</option>)}
            </select>
        );
    }
    return (
        <input disabled={readOnly} className={FIELD}
            type={kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'}
            inputMode={kind === 'number' ? 'numeric' : undefined}
            min={kind === 'number' ? '0' : undefined}
            placeholder={placeholder}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)} />
    );
}

// One labelled answer inside an item card.
function Field({ label, wide, children }) {
    return (
        <label className={`flex min-w-0 flex-col gap-1 ${wide ? 'col-span-full' : ''}`}>
            <span className="text-xs text-slate-500">{label}</span>
            {/* Pushed to the bottom so answers line up when a label wraps. */}
            <span className="mt-auto">{children}</span>
        </label>
    );
}

// An item: its question, then its answers. Stacked on phones; question on the
// left and answers on the right from md up, so a long form stays compact.
function ItemCard({ label, code, hint, children, cols = 2 }) {
    const grid = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[cols] || 'grid-cols-2';
    return (
        <div className="rounded-lg border border-slate-200 p-3 md:flex md:items-start md:gap-4">
            <div className="mb-2 text-sm text-slate-800 md:mb-0 md:w-2/5 md:pt-1">
                {code && <span className="me-1 font-semibold text-slate-500">{code}</span>}
                {label}
                {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
            </div>
            <div className={`grid gap-2 md:flex-1 ${grid}`}>{children}</div>
        </div>
    );
}

const fmt = (v) => (v == null ? '—' : Math.round(v).toLocaleString());

const sectionNote = (section, isArabic) => (isArabic ? section.noteAr || section.note : section.note);

// =============================================================================
// Section bodies
// =============================================================================

// The NICU assessment's types: staff, yes/no, counts with or without a
// standard, present + action, present + number.
const GROUP_KEYS = { 'IPC programme': 'ipc_programme', 'IPC guideline': 'ipc_guideline', 'Training': 'training', 'Surveillance': 'surveillance' };
const itemKey = (item) => item.id.replace(/^l[23]_/, '');

function ClassicSection({ section, values, onChange, readOnly }) {
    const { t } = useTranslation();
    const set = (itemId, field, value) => onChange(itemId, { ...(values[itemId] || {}), [field]: value });
    const L = {
        name: t('trackers.supervision.cols.name', 'Name'),
        contact: t('trackers.supervision.cols.contact', 'Contact'),
        available: t('trackers.supervision.cols.available', 'Available'),
        need: t('trackers.supervision.cols.need', 'Need'),
        needed: t('trackers.supervision.cols.needed', 'Needed'),
        present: t('trackers.supervision.cols.present', 'Present'),
        action: t('trackers.supervision.cols.action', 'Action needed'),
        number: t('trackers.supervision.cols.number', 'Number registered'),
        standard: t('trackers.supervision.cols.standard', 'Standard'),
    };
    const s = scoreSection(section, values);

    return (
        <div className="space-y-2">
            {s && (
                <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded ${toneFor(s.presencePercent)}`}>
                        {t('trackers.supervision.score.present', 'present {{pct}}', { pct: pctText(s.presencePercent) })}
                    </span>
                    {s.adequacyPercent != null && (
                        <span className={`px-2 py-0.5 rounded ${toneFor(s.adequacyPercent)}`}>
                            {t('trackers.supervision.score.vs_standard', 'vs standard {{pct}}', { pct: pctText(s.adequacyPercent) })}
                        </span>
                    )}
                </div>
            )}
            {section.items.map((item, i) => {
                const v = values[item.id] || {};
                const startsGroup = item.group && section.items[i - 1]?.group !== item.group;
                const label = t(`trackers.supervision.items.${itemKey(item)}`, item.label);
                return (
                    <React.Fragment key={item.id}>
                        {startsGroup && (
                            <div className="pt-2 text-xs font-semibold text-slate-600">
                                {GROUP_KEYS[item.group] ? t(`trackers.supervision.groups.${GROUP_KEYS[item.group]}`, item.group) : item.group}
                            </div>
                        )}
                        {section.type === 'staff' && (
                            <ItemCard label={label}>
                                <Field label={L.name}><CellInput kind="text" readOnly={readOnly} value={v.name} onChange={(x) => set(item.id, 'name', x)} /></Field>
                                <Field label={L.contact}><CellInput kind="text" readOnly={readOnly} value={v.contact} onChange={(x) => set(item.id, 'contact', x)} /></Field>
                            </ItemCard>
                        )}
                        {section.type === 'yesno' && (
                            <ItemCard label={label} cols={1}>
                                <YesNo readOnly={readOnly} value={v.available} onChange={(x) => set(item.id, 'available', x)} />
                            </ItemCard>
                        )}
                        {(section.type === 'present_action' || section.type === 'present_number') && (
                            <ItemCard label={label}>
                                <Field label={L.present}><YesNo readOnly={readOnly} value={v.present} onChange={(x) => set(item.id, 'present', x)} /></Field>
                                {section.type === 'present_number' ? (
                                    <Field label={L.number}><CellInput readOnly={readOnly} value={v.number} onChange={(x) => set(item.id, 'number', x)} /></Field>
                                ) : (
                                    <Field label={L.action}><CellInput kind="text" readOnly={readOnly} value={v.action} onChange={(x) => set(item.id, 'action', x)} /></Field>
                                )}
                            </ItemCard>
                        )}
                        {(section.type === 'available_need' || section.type === 'standard_available_need') && (
                            <ItemCard label={label}
                                hint={section.type === 'standard_available_need' ? `${L.standard}: ${item.standard}` : undefined}>
                                <Field label={L.available}><CellInput readOnly={readOnly} value={v.available} onChange={(x) => set(item.id, 'available', x)} /></Field>
                                <Field label={section.type === 'standard_available_need' ? L.needed : L.need}><CellInput readOnly={readOnly} value={v.need} onChange={(x) => set(item.id, 'need', x)} /></Field>
                            </ItemCard>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function GridSection({ section, values, onChange, readOnly }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const set = (rowId, colId, value) => onChange(rowId, { ...(values[rowId] || {}), [colId]: value });
    const cols = section.columns.length >= 4 ? 4 : section.columns.length === 3 ? 3 : 2;

    return (
        <div className="space-y-2">
            {section.items.map((item, i) => {
                const startsLocation = item.group === 'location' && section.items[i - 1]?.group !== 'location';
                return (
                    <React.Fragment key={item.id}>
                        {startsLocation && (
                            <div className="pt-2 text-xs font-semibold text-slate-600">{t('trackers.supervision.warmer.location', 'Where they are')}</div>
                        )}
                        <ItemCard label={pickLabel(item, isArabic)} cols={cols}>
                            {section.columns.map((c) => {
                                const kind = c.id === 'answer' && item.answerKind ? item.answerKind : c.kind;
                                const label = kind === c.kind ? pickLabel(c, isArabic) : t('trackers.supervision.warmer.number', 'Number');
                                return (
                                    <Field key={c.id} label={label} wide={c.wide || kind === 'yesno'}>
                                        <CellInput kind={kind} options={c.options} isArabic={isArabic} readOnly={readOnly}
                                            value={values[item.id]?.[c.id]} onChange={(v) => set(item.id, c.id, v)} />
                                    </Field>
                                );
                            })}
                        </ItemCard>
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function NeedsPeriod() {
    const { t } = useTranslation();
    return <p className="text-sm text-amber-700">{t('trackers.supervision.warmer.choose_period', 'Choose the reporting quarter above first.')}</p>;
}

// Section D: each indicator with its three months and total, then the coverage
// calculation the paper form asks the supervisor to work out by hand.
function MonthlySection({ section, values, onChange, readOnly, periodStart, responses }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const months = periodMonths(periodStart);
    const calc = useMemo(() => serviceDataCalc(responses, periodStart), [responses, periodStart]);
    const set = (rowId, month, value) => onChange(rowId, { ...(values[rowId] || {}), [month]: value });
    const rowTotal = (rowId) => {
        const known = months.map((m) => toNum(values[rowId]?.[m])).filter((v) => v != null);
        return known.length ? known.reduce((a, b) => a + b, 0) : null;
    };
    if (!months.length) return <NeedsPeriod />;

    const total = t('trackers.supervision.warmer.total', 'Total');
    const short = (m) => monthLabel(m, isArabic).split(' ')[0];
    const calcRow = (label, valuesFor, totalValue, pct = false) => (
        <div className="rounded-lg bg-sky-50 p-3">
            <div className="mb-2 text-sm text-sky-900">{label}</div>
            <div className="grid grid-cols-4 gap-2 text-center text-sm tabular-nums">
                {calc.months.map((m) => (
                    <div key={m.month}>
                        <div className="text-xs text-slate-500">{short(m.month)}</div>
                        {pct ? <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${toneFor(valuesFor(m))}`}>{pctText(valuesFor(m))}</span> : fmt(valuesFor(m))}
                    </div>
                ))}
                <div>
                    <div className="text-xs text-slate-500">{total}</div>
                    {pct ? <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${toneFor(totalValue)}`}>{pctText(totalValue)}</span> : <span className="font-semibold">{fmt(totalValue)}</span>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-2">
            {section.items.map((item) => (
                <ItemCard key={item.id} code={item.code} label={pickLabel(item, isArabic)} cols={4}>
                    {months.map((m) => (
                        <Field key={m} label={short(m)}>
                            <CellInput readOnly={readOnly} value={values[item.id]?.[m]} onChange={(v) => set(item.id, m, v)} />
                        </Field>
                    ))}
                    <Field label={total}>
                        <div className="py-2 text-sm font-semibold tabular-nums text-slate-700">{fmt(rowTotal(item.id))}</div>
                    </Field>
                </ItemCard>
            ))}
            <div className="pt-2 text-xs font-semibold text-slate-600">{t('trackers.supervision.warmer.calculation', 'Calculation (worked out from the table above)')}</div>
            {calcRow(t('trackers.supervision.warmer.est_need', 'Estimated babies needing warming'), (m) => m.need, calc.total.need)}
            {calcRow(t('trackers.supervision.warmer.placed', 'Babies placed in portable warmer (D6, or D7 when not documented)'), (m) => m.placed, calc.total.placed)}
            {calcRow(t('trackers.supervision.warmer.coverage', 'Coverage of portable warming'), (m) => m.coverage, calc.total.coverage, true)}
        </div>
    );
}

// E1: January to the end of the quarter, one card per month. The need field
// suggests the section D estimate for the months both tables cover.
function CascadeSection({ section, values, onChange, readOnly, periodStart, responses }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const months = cascadeMonths(periodStart);
    const set = (month, colId, value) => onChange(month, { ...(values[month] || {}), [colId]: value });
    const d = responses.service_data || {};
    const suggestedNeed = (m) => {
        const need = estimateNeed(toNum(d.live_births?.[m]), toNum(d.preterm?.[m]), toNum(d.lbw?.[m]));
        return need == null ? undefined : String(need);
    };
    const colTotal = (colId) => {
        const known = months.map((m) => toNum(values[m]?.[colId])).filter((v) => v != null);
        return known.length ? known.reduce((a, b) => a + b, 0) : null;
    };
    if (!months.length) return <NeedsPeriod />;

    const totals = Object.fromEntries(section.columns.map((c) => [c.id, colTotal(c.id)]));
    const pct = (a, b) => (a != null && b ? (a / b) * 100 : null);
    const results = [
        { id: 'coverage', label: t('trackers.supervision.warmer.coverage', 'Coverage of portable warming'), value: pct(totals.received, totals.need) },
        { id: 'registration', label: t('trackers.supervision.warmer.registration', 'Registration completeness'), value: pct(totals.registered, totals.received) },
        { id: 'dhis2', label: t('trackers.supervision.warmer.dhis2', 'DHIS2 reporting completeness'), value: pct(totals.dhis2, totals.registered) },
    ];

    return (
        <div className="space-y-2">
            {months.map((m) => (
                <ItemCard key={m} label={monthLabel(m, isArabic)} cols={4}>
                    {section.columns.map((c) => (
                        <Field key={c.id} label={pickLabel(c, isArabic)}>
                            <CellInput readOnly={readOnly} value={values[m]?.[c.id]}
                                placeholder={c.id === 'need' ? suggestedNeed(m) : undefined}
                                onChange={(v) => set(m, c.id, v)} />
                        </Field>
                    ))}
                </ItemCard>
            ))}
            <ItemCard label={<span className="font-semibold">{t('trackers.supervision.warmer.total', 'Total')}</span>} cols={4}>
                {section.columns.map((c) => (
                    <Field key={c.id} label={pickLabel(c, isArabic)}>
                        <div className="py-2 text-sm font-semibold tabular-nums">{fmt(totals[c.id])}</div>
                    </Field>
                ))}
            </ItemCard>
            <div className="flex flex-wrap gap-2 pt-1 text-sm">
                {results.map((r) => (
                    <span key={r.id} className={`px-2 py-1 rounded ${toneFor(r.value)}`}>{r.label}: {pctText(r.value)}</span>
                ))}
            </div>
        </div>
    );
}

const EMPTY_ACTIONS = [{}, {}, {}];

function FindingsSection({ values, onSet, readOnly }) {
    const { t } = useTranslation();
    const actions = values.actions?.length ? values.actions : EMPTY_ACTIONS;
    const setAction = (index, field, value) => onSet('actions', actions.map((a, i) => (i === index ? { ...a, [field]: value } : a)));

    return (
        <div className="space-y-3">
            <Textarea label={t('trackers.supervision.warmer.strengths', 'Main strengths')} rows={3} disabled={readOnly}
                value={values.strengths || ''} onChange={(e) => onSet('strengths', e.target.value)} />
            <Textarea label={t('trackers.supervision.warmer.gaps', 'Main gaps / challenges')} rows={3} disabled={readOnly}
                value={values.gaps || ''} onChange={(e) => onSet('gaps', e.target.value)} />
            <div className="text-sm font-medium text-gray-700">{t('trackers.supervision.dash.actions', 'Action points')}</div>
            {actions.map((a, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">#{i + 1}</span>
                        {!readOnly && (
                            <button type="button" aria-label={t('trackers.supervision.warmer.remove_action', 'Remove action')}
                                className="p-1 text-slate-400 hover:text-red-600"
                                onClick={() => onSet('actions', actions.filter((_, j) => j !== i))}>
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        <Field label={t('trackers.supervision.warmer.action', 'Action')} wide>
                            <CellInput kind="text" readOnly={readOnly} value={a.action} onChange={(v) => setAction(i, 'action', v)} />
                        </Field>
                        <Field label={t('trackers.supervision.warmer.responsible', 'Responsible')}>
                            <CellInput kind="text" readOnly={readOnly} value={a.responsible} onChange={(v) => setAction(i, 'responsible', v)} />
                        </Field>
                        <Field label={t('trackers.supervision.warmer.deadline', 'Deadline')}>
                            <CellInput kind="date" readOnly={readOnly} value={a.deadline} onChange={(v) => setAction(i, 'deadline', v)} />
                        </Field>
                    </div>
                </div>
            ))}
            {!readOnly && (
                <Button variant="secondary" onClick={() => onSet('actions', [...actions, {}])}>
                    <Plus size={16} /> {t('trackers.supervision.warmer.add_action', 'Add action')}
                </Button>
            )}
        </div>
    );
}

// =============================================================================
// State, locality and facility — from the same lists as the mentorship form
// =============================================================================

const FACILITY_NAME = 'اسم_المؤسسة';
const FACILITY_STATE = 'الولاية';
const FACILITY_LOCALITY = 'المحلية';
const FACILITY_TYPE = 'نوع_المؤسسةالصحية';

// The registry's facility type, as the warmer form's choices.
const facilityTypeChoice = (registryType = '') => {
    if (registryType.includes('مستشفى')) return 'hospital';
    if (registryType.includes('مركز')) return 'health_centre';
    return registryType ? 'other' : '';
};

// Loads the facility registry once, from the data cache (memory, then the
// device store, then the server), as the mentorship form does.
function useFacilities() {
    const { healthFacilities, fetchHealthFacilities, isLoading } = useDataCache();
    const asked = useRef(false);
    useEffect(() => {
        if (asked.current || (healthFacilities && healthFacilities.length) || typeof fetchHealthFacilities !== 'function') return;
        asked.current = true;
        fetchHealthFacilities({}, false)?.catch?.((e) => console.error('Failed to load health facilities:', e));
    }, [healthFacilities, fetchHealthFacilities]);
    const reload = () => fetchHealthFacilities?.({}, true);
    return { facilities: healthFacilities || [], loading: !!isLoading?.healthFacilities && !(healthFacilities && healthFacilities.length), reload };
}

function FacilityPickerModal({ facilities, onSelect, onTypeName, onClose }) {
    const { t } = useTranslation();
    const [term, setTerm] = useState('');
    const list = useMemo(() => {
        const q = term.trim().toLowerCase();
        return q ? facilities.filter((f) => String(f[FACILITY_NAME] || '').toLowerCase().includes(q)) : facilities;
    }, [facilities, term]);
    return (
        <Modal isOpen onClose={onClose} title={t('trackers.supervision.facility.choose', 'Choose the facility')}>
            <div className="space-y-3 p-4">
                <div className="relative">
                    <Search size={18} className="pointer-events-none absolute start-3 top-2.5 text-slate-400" />
                    <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)}
                        placeholder={t('trackers.supervision.facility.search', 'Search facilities…')}
                        className={`${FIELD} ps-10`} />
                </div>
                <div className="max-h-[55vh] overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
                    {list.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500">{t('trackers.supervision.facility.none', 'No matching facility.')}</div>
                    ) : list.map((f) => (
                        <button key={f.id} type="button" onClick={() => onSelect(f)}
                            className="flex w-full items-center justify-between gap-2 p-3 text-start hover:bg-sky-50">
                            <span className="font-medium text-slate-700">{f[FACILITY_NAME]}</span>
                            {f[FACILITY_TYPE] && <span className="shrink-0 text-xs text-slate-500">{f[FACILITY_TYPE]}</span>}
                        </button>
                    ))}
                </div>
                <button type="button" onClick={onTypeName} className="text-sm font-medium text-sky-700 hover:underline">
                    {t('trackers.supervision.facility.not_listed', 'Not in the list? Type the name instead')}
                </button>
            </div>
        </Modal>
    );
}

function FacilityField({ form, label, readOnly, onPick, onTypeName }) {
    const { t } = useTranslation();
    const { facilities, loading, reload } = useFacilities();
    const [open, setOpen] = useState(false);
    const [typing, setTyping] = useState(() => !!form.facilityName && !form.facilityId);
    const options = useMemo(() => facilities
        .filter((f) => f[FACILITY_STATE] === form.stateKey && f[FACILITY_LOCALITY] === form.localityKey)
        .sort((a, b) => String(a[FACILITY_NAME] || '').localeCompare(String(b[FACILITY_NAME] || ''))),
    [facilities, form.stateKey, form.localityKey]);
    const ready = !!form.stateKey && !!form.localityKey;

    if (typing) {
        return (
            <div className="flex flex-col">
                <Input label={label} value={form.facilityName} disabled={readOnly} onChange={(e) => onTypeName(e.target.value)} />
                {!readOnly && (
                    <button type="button" className="mt-1 self-start text-xs font-medium text-sky-700 hover:underline"
                        onClick={() => { setTyping(false); onTypeName(''); }}>
                        {t('trackers.supervision.facility.use_list', 'Choose from the list')}
                    </button>
                )}
            </div>
        );
    }
    return (
        <div className="flex flex-col">
            <span className="mb-1 text-sm font-medium text-gray-700">{label}</span>
            <button type="button" disabled={readOnly || !ready} onClick={() => setOpen(true)}
                className={`${FIELD} flex items-center justify-between gap-2 text-start disabled:cursor-not-allowed`}>
                <span className={`truncate ${form.facilityName ? 'text-slate-800' : 'text-slate-400'}`}>
                    {form.facilityName || (ready
                        ? t('trackers.supervision.facility.placeholder', 'Choose or search…')
                        : t('trackers.supervision.facility.choose_locality', 'Choose the state and locality first'))}
                </span>
                <Search size={16} className="shrink-0 text-slate-400" />
            </button>
            {ready && !loading && options.length === 0 && !readOnly && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-red-600">{t('trackers.supervision.facility.empty', 'No facilities listed for this locality.')}</span>
                    <button type="button" className="font-medium text-sky-700 hover:underline" onClick={reload}>{t('trackers.supervision.facility.reload', 'Reload')}</button>
                    <button type="button" className="font-medium text-sky-700 hover:underline" onClick={() => setTyping(true)}>{t('trackers.supervision.facility.type', 'Type the name')}</button>
                </div>
            )}
            {loading && <span className="mt-1 text-xs text-slate-500">{t('trackers.supervision.facility.loading', 'Loading facilities…')}</span>}
            {open && (
                <FacilityPickerModal facilities={options} onClose={() => setOpen(false)}
                    onSelect={(f) => { onPick(f); setOpen(false); }}
                    onTypeName={() => { setOpen(false); setTyping(true); onTypeName(''); }} />
            )}
        </div>
    );
}

// =============================================================================
// Collapsible section with its progress
// =============================================================================

function ProgressBar({ percent, className = '' }) {
    const done = percent >= 100;
    return (
        <div className={`h-1.5 rounded-full bg-slate-100 overflow-hidden ${className}`}>
            <div className={`h-full rounded-full transition-all ${done ? 'bg-emerald-600' : 'bg-sky-600'}`} style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
    );
}

function SectionPanel({ index, section, progress, open, onToggle, children, isArabic }) {
    const { t } = useTranslation();
    const title = isArabic && section.titleAr ? section.titleAr : t(`trackers.supervision.sections.${section.id}`, section.title);
    const done = progress.total > 0 && progress.answered === progress.total;
    const note = sectionNote(section, isArabic);
    return (
        <section id={`sv-section-${section.id}`} className="rounded-xl border border-slate-200 bg-white scroll-mt-24">
            <button type="button" onClick={onToggle} aria-expanded={open}
                className="flex w-full items-center gap-3 p-3 text-start md:p-4">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {done ? <CheckCircle2 size={18} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-800">{title}</span>
                    <span className="mt-1 flex items-center gap-2">
                        <ProgressBar percent={progress.percent} className="flex-1" />
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">
                            {Math.round(progress.percent)}% · {progress.answered}/{progress.total}
                        </span>
                    </span>
                </span>
                <ChevronDown size={20} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="space-y-2 border-t border-slate-100 p-3 md:p-4">
                    {note && <p className="text-xs text-slate-500">{note}</p>}
                    {children}
                </div>
            )}
        </section>
    );
}

// =============================================================================
// Results and summary
// =============================================================================

// The headline figures shown at the top of the form while it is filled in.
function ScoreChips({ checklist, form }) {
    const { t } = useTranslation();
    if (checklist.id === 'infant_warmer') {
        const r = warmerResults(form.responses, form.periodStart);
        const chips = [
            { id: 'nest', label: t('trackers.supervision.warmer.nest_functioning', 'Heating units functioning'), value: r.nestFunctioningPercent },
            { id: 'practices', label: t('trackers.supervision.warmer.practices', 'Good use practices'), value: r.practices.percent },
            { id: 'coverage', label: t('trackers.supervision.warmer.coverage', 'Coverage of portable warming'), value: r.service.total.coverage },
            { id: 'info', label: t('trackers.supervision.warmer.info_system', 'Information system'), value: r.infoSystem.percent },
        ];
        return (
            <div className="flex flex-wrap gap-2 text-xs">
                {chips.map((c) => <span key={c.id} className={`px-2 py-1 rounded ${toneFor(c.value)}`}>{c.label}: {pctText(c.value)}</span>)}
            </div>
        );
    }
    const score = scoreAssessment(checklist, form.responses);
    return (
        <div className="flex flex-wrap gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${toneFor(score.presencePercent)}`}>
                {t('trackers.supervision.score.present', 'present {{pct}}', { pct: pctText(score.presencePercent) })}
            </span>
        </div>
    );
}

// What the list and the dashboard read without re-scoring every record.
function buildSummary(checklist, form) {
    const progress = assessmentProgress(checklist, form).percent;
    if (checklist.id === 'infant_warmer') {
        const r = warmerResults(form.responses, form.periodStart);
        return {
            completionPercent: progress,
            nestFunctioningPercent: r.nestFunctioningPercent,
            practicesPercent: r.practices.percent,
            coveragePercent: r.service.total.coverage,
            infoSystemPercent: r.infoSystem.percent,
            registrationPercent: r.cascade.registration,
            dhis2Percent: r.cascade.dhis2,
        };
    }
    const score = scoreAssessment(checklist, form.responses);
    return {
        completionPercent: score.completionPercent,
        presencePercent: score.presencePercent,
        sections: score.sections,
    };
}

// Firestore refuses undefined anywhere in a document.
const withoutUndefined = (value) => JSON.parse(JSON.stringify(value));

// =============================================================================
// The assessment form
// =============================================================================

function AssessmentForm({ checklist, initial, onBack, onSaved, canEdit, publicMode = false }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    useLeaveGuard(canEdit);
    const back = () => leaveForm(onBack);
    useInPageBack(back, !publicMode);
    const [form, setForm] = useState(() => {
        const today = new Date().toISOString().slice(0, 10);
        const base = initial || {
            checklistId: checklist.id,
            service: checklist.service,
            stateKey: '', localityKey: '', facilityName: '',
            assessmentDate: today,
            assessorName: '', status: 'draft', responses: {}, details: {},
        };
        return checklist.usesPeriod && !base.periodStart
            ? { ...base, periodStart: defaultPeriodStart(base.assessmentDate) }
            : base;
    });
    const [saving, setSaving] = useState(false);
    const [openSections, setOpenSections] = useState(() => new Set([checklist.sections[0].id]));

    const readOnly = !canEdit;
    const isHospital = checklist.scope === 'hospital';
    const progress = useMemo(() => assessmentProgress(checklist, form), [checklist, form]);
    const allOpen = openSections.size === checklist.sections.length;

    const toggle = (id) => setOpenSections((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));
    const setDetail = (name, value) => setForm((p) => ({ ...p, details: { ...(p.details || {}), [name]: value } }));
    const setResponse = useCallback((sectionId, itemId, value) => {
        setForm((p) => ({
            ...p,
            responses: {
                ...p.responses,
                [sectionId]: { ...(p.responses?.[sectionId] || {}), [itemId]: value },
            },
        }));
    }, []);

    const save = async (status) => {
        if (!form.facilityName?.trim()) {
            notify(isHospital
                ? t('trackers.supervision.form.err_hospital', 'Enter the hospital name.')
                : t('trackers.supervision.form.err_facility', 'Enter the facility name.'), 'error');
            return;
        }
        if (!form.stateKey) { notify(t('trackers.supervision.form.err_state', 'Choose the state.'), 'error'); return; }
        setSaving(true);
        try {
            const payload = withoutUndefined({
                ...form, status,
                facilityName: form.facilityName.trim(),
                summary: buildSummary(checklist, form),
                ...(publicMode ? { submittedVia: 'public_link' } : {}),
            });
            const id = await upsertSupervisionAssessment(payload);
            notify(status === 'submitted' ? t('trackers.supervision.form.submitted', 'Assessment submitted.') : t('trackers.supervision.form.draft_saved', 'Draft saved.'), 'success');
            formSaved();
            if (!form.id && id) setForm((p) => ({ ...p, id }));
            onSaved?.(status);
            if (status === 'submitted' && !publicMode) onBack();
        } catch (error) {
            console.error('Failed to save assessment:', error);
            const raw = String(error?.message || error);
            notify(/insufficient permissions|permission-denied/i.test(raw)
                ? t('trackers.supervision.form.permission_denied', 'Firestore refused the write. Your account may not have supervision rights.')
                : t('trackers.supervision.form.save_failed', 'Could not save the assessment. {{error}}', { error: raw }), 'error');
        } finally {
            setSaving(false);
        }
    };

    const renderBody = (section) => {
        const values = form.responses?.[section.id] || {};
        const onChange = (itemId, value) => setResponse(section.id, itemId, value);
        const shared = { section, values, onChange, readOnly };
        switch (section.type) {
            case 'grid': return <GridSection {...shared} />;
            case 'monthly': return <MonthlySection {...shared} periodStart={form.periodStart} responses={form.responses || {}} />;
            case 'cascade': return <CascadeSection {...shared} periodStart={form.periodStart} responses={form.responses || {}} />;
            case 'findings': return <FindingsSection values={values} onSet={onChange} readOnly={readOnly} />;
            default: return <ClassicSection {...shared} />;
        }
    };

    const stateLabel = (k) => (isArabic ? STATE_LOCALITIES[k].ar || STATE_LOCALITIES[k].en : STATE_LOCALITIES[k].en);
    const cancelLabel = publicMode ? null : t('trackers.supervision.form.cancel', 'Cancel');
    const draftLabel = saving ? t('trackers.supervision.form.saving', 'Saving…') : t('trackers.supervision.form.save_draft', 'Save draft');
    const submitLabel = saving ? t('trackers.supervision.form.saving', 'Saving…') : t('trackers.supervision.form.submit', 'Submit assessment');

    return (
        <div className={`space-y-3 ${canEdit ? 'pb-24 sm:pb-0' : ''}`}>
            {!IS_NATIVE && !publicMode && (
                <Button variant="secondary" onClick={back}>
                    <ArrowLeft size={16} /> {t('trackers.supervision.form.back', 'Back to assessments')}
                </Button>
            )}

            <Card>
                <CardBody className="space-y-4">
                    <div className="flex items-start gap-3">
                        <FormIcon checklist={checklist} />
                        <div className="min-w-0">
                            <h3 className="font-semibold text-slate-800">{isArabic ? checklist.titleAr : t(`trackers.supervision.checklists.${checklist.id}`, checklist.title)}</h3>
                            <p className="text-xs text-slate-500">{t('trackers.supervision.form.general_info', 'General information')}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Select label={t('trackers.supervision.state', 'State')} value={form.stateKey} disabled={readOnly}
                            onChange={(e) => setForm((p) => ({ ...p, stateKey: e.target.value, localityKey: '', facilityId: null, facilityName: '' }))}>
                            <option value="">{t('trackers.supervision.select', 'Select…')}</option>
                            {Object.keys(STATE_LOCALITIES).filter((k) => k !== 'Federal')
                                .map((k) => <option key={k} value={k}>{stateLabel(k)}</option>)}
                        </Select>
                        <Select label={t('trackers.supervision.locality', 'Locality')} value={form.localityKey} disabled={readOnly || !form.stateKey}
                            onChange={(e) => setForm((p) => ({ ...p, localityKey: e.target.value, facilityId: null, facilityName: '' }))}>
                            <option value="">{t('trackers.supervision.select', 'Select…')}</option>
                            {(STATE_LOCALITIES[form.stateKey]?.localities || [])
                                .map((l) => <option key={l.en} value={l.en}>{isArabic ? l.ar || l.en : l.en}</option>)}
                        </Select>
                        <FacilityField form={form} readOnly={readOnly}
                            label={isHospital ? t('trackers.supervision.form.hospital_name', 'Hospital name') : t('trackers.supervision.form.facility_name', 'Facility name')}
                            onTypeName={(name) => setForm((p) => ({ ...p, facilityId: null, facilityName: name }))}
                            onPick={(f) => setForm((p) => {
                                const type = facilityTypeChoice(f[FACILITY_TYPE]);
                                const wantsType = (checklist.headerFields || []).some((h) => h.id === 'facilityType');
                                return {
                                    ...p, facilityId: f.id, facilityName: f[FACILITY_NAME] || '',
                                    ...(wantsType && type && !p.details?.facilityType ? { details: { ...(p.details || {}), facilityType: type } } : {}),
                                };
                            })} />
                        <Input label={isHospital ? t('trackers.supervision.form.date', 'Assessment date') : t('trackers.supervision.form.visit_date', 'Date of visit')}
                            type="date" value={form.assessmentDate} disabled={readOnly}
                            onChange={(e) => setField('assessmentDate', e.target.value)} />
                        {(checklist.headerFields || []).map((f) => (f.kind === 'select' ? (
                            <Select key={f.id} label={pickLabel(f, isArabic)} value={form.details?.[f.id] || ''} disabled={readOnly}
                                onChange={(e) => setDetail(f.id, e.target.value)}>
                                <option value="">{t('trackers.supervision.select', 'Select…')}</option>
                                {f.options.map((o) => <option key={o.value} value={o.value}>{pickLabel(o, isArabic)}</option>)}
                            </Select>
                        ) : (
                            <Input key={f.id} label={pickLabel(f, isArabic)} type={f.type || 'text'} value={form.details?.[f.id] || ''} disabled={readOnly}
                                onChange={(e) => setDetail(f.id, e.target.value)} />
                        )))}
                        {checklist.usesPeriod && (
                            <Input label={t('trackers.supervision.warmer.period', 'Service data quarter — first month')} type="month"
                                value={form.periodStart || ''} disabled={readOnly}
                                onChange={(e) => setField('periodStart', e.target.value)} />
                        )}
                        <div className="sm:col-span-2 lg:col-span-4">
                            <Input label={isHospital ? t('trackers.supervision.form.assessor', 'Assessor name') : t('trackers.supervision.form.supervisors', 'Supervisor name(s)')}
                                value={form.assessorName || ''} disabled={readOnly}
                                onChange={(e) => setField('assessorName', e.target.value)} />
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Overall progress and headline results; pinned under the top bar while scrolling. */}
            <div className="sticky top-[calc(var(--app-top,0px)+4px)] z-20 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-800">
                        {t('trackers.supervision.form.progress', 'Completed {{pct}}', { pct: `${Math.round(progress.percent)}%` })}
                    </span>
                    <ProgressBar percent={progress.percent} className="flex-1" />
                    <button type="button" className="shrink-0 text-xs font-medium text-sky-700 hover:underline"
                        onClick={() => setOpenSections(allOpen ? new Set() : new Set(checklist.sections.map((s) => s.id)))}>
                        {allOpen ? t('trackers.supervision.form.collapse_all', 'Collapse all') : t('trackers.supervision.form.expand_all', 'Expand all')}
                    </button>
                </div>
            </div>
            <ScoreChips checklist={checklist} form={form} />

            {checklist.sections.map((section, i) => (
                <SectionPanel key={section.id} index={i} section={section} isArabic={isArabic}
                    progress={progress.sections[section.id]}
                    open={openSections.has(section.id)} onToggle={() => toggle(section.id)}>
                    {renderBody(section)}
                </SectionPanel>
            ))}

            {canEdit && (
                <>
                    {/* Wider screens: the bar stays at the bottom of the form while it scrolls. */}
                    <div className="hidden sm:flex sticky bottom-0 z-20 items-center justify-end gap-2 rounded-xl border border-slate-200 bg-slate-50/95 p-3 backdrop-blur">
                        {cancelLabel && <Button variant="secondary" onClick={back} disabled={saving}>{cancelLabel}</Button>}
                        {!publicMode && <Button variant="secondary" onClick={() => save('draft')} disabled={saving}>{draftLabel}</Button>}
                        <Button onClick={() => save('submitted')} disabled={saving}>{submitLabel}</Button>
                    </div>
                    {/* Phones: a bar fixed above the bottom navigation, as in the mentorship forms. */}
                    <div className="sm:hidden fixed inset-x-0 bottom-[var(--bottom-nav,0px)] z-30 flex h-16 items-center justify-around gap-2 border-t border-slate-700 bg-slate-900 px-3 shadow-lg">
                        {cancelLabel && <Button variant="secondary" onClick={back} disabled={saving}>{cancelLabel}</Button>}
                        {!publicMode && <Button variant="secondary" onClick={() => save('draft')} disabled={saving}>{draftLabel}</Button>}
                        <Button onClick={() => save('submitted')} disabled={saving} className="flex-1">{submitLabel}</Button>
                    </div>
                </>
            )}
        </div>
    );
}

// =============================================================================
// Public link
// =============================================================================

export const supervisionPublicUrl = (checklistId) => `${publicBaseUrl()}/public/supervision/${checklistId}`;

function ShareLinkModal({ checklist, onClose }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const url = supervisionPublicUrl(checklist.id);
    const title = isArabic ? checklist.titleAr : checklist.title;
    const copy = async () => {
        try { await navigator.clipboard.writeText(url); notify(t('trackers.supervision.share.copied', 'Link copied.'), 'success'); }
        catch { notify(t('trackers.supervision.share.copy_failed', 'Could not copy the link.'), 'error'); }
    };
    const share = async () => {
        if (navigator.share) {
            try { await navigator.share({ title, url }); return; }
            catch (e) { if (e?.name === 'AbortError') return; }
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank');
    };
    return (
        <Modal isOpen onClose={onClose} title={t('trackers.supervision.share.title', 'Public link to fill this form')}>
            <CardBody className="flex flex-col items-center gap-4">
                <p className="text-sm text-slate-600 text-center">
                    {t('trackers.supervision.share.hint', 'Anyone with the link signs in and fills the form directly. Their assessment appears here as submitted.')}
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><QRCodeCanvas value={url} size={200} level="L" /></div>
                <p className="text-xs text-slate-500 break-all text-center select-all">{url}</p>
                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
                    <Button variant="secondary" onClick={copy}><Copy size={16} /> {t('trackers.supervision.share.copy', 'Copy link')}</Button>
                    <Button variant="secondary" onClick={() => window.open(url, '_blank')}><ExternalLink size={16} /> {t('trackers.supervision.share.open', 'Open')}</Button>
                    <Button onClick={share}><Share2 size={16} /> {t('trackers.supervision.share.share', 'Share')}</Button>
                </div>
            </CardBody>
        </Modal>
    );
}

// What /public/supervision/<form id> shows: the form alone, Submit only, then
// a thank-you with the option to fill another.
export function PublicSupervisionForm({ checklistId }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const checklist = getChecklist(checklistId);
    const [round, setRound] = useState(0);
    const [done, setDone] = useState(false);

    if (!checklist) {
        return <Card><CardBody className="text-center text-red-600 font-semibold">{t('trackers.supervision.share.not_found', 'This form link is not valid.')}</CardBody></Card>;
    }
    if (done) {
        return (
            <Card>
                <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
                    <CheckCircle2 size={48} className="text-emerald-600" />
                    <h3 className="text-lg font-semibold text-slate-800">{t('trackers.supervision.share.thanks', 'Assessment submitted')}</h3>
                    <p className="text-sm text-slate-600">{isArabic ? checklist.titleAr : checklist.title}</p>
                    <Button onClick={() => { setDone(false); setRound((r) => r + 1); }}>
                        <Plus size={16} /> {t('trackers.supervision.share.another', 'Fill another')}
                    </Button>
                </CardBody>
            </Card>
        );
    }
    return (
        <div className="mx-auto max-w-5xl p-2 md:p-4">
            <AssessmentForm key={round} checklist={checklist} initial={null} canEdit publicMode
                onBack={() => {}} onSaved={(status) => { if (status === 'submitted') { setDone(true); window.scrollTo(0, 0); } }} />
        </div>
    );
}

// =============================================================================
// Pickers: services, then the forms of a service
// =============================================================================

const SERVICE_ICONS = { SSNC: Baby, IMNCI: Stethoscope, EENC: HeartPulse, ETAT: Siren, IPC: ShieldCheck };
const FORM_ICONS = { hospital: Hospital, thermometer: Thermometer };
const FORM_TONES = {
    hospital: 'bg-violet-100 text-violet-700',
    thermometer: 'bg-orange-100 text-orange-700',
};

function FormIcon({ checklist, large = false }) {
    const Icon = FORM_ICONS[checklist.icon] || ClipboardList;
    return (
        <span className={`flex shrink-0 items-center justify-center rounded-xl ${FORM_TONES[checklist.icon] || 'bg-sky-100 text-sky-700'} ${large ? 'h-16 w-16' : 'h-10 w-10'}`}>
            <Icon size={large ? 34 : 22} />
        </span>
    );
}

function PickerTile({ icon, tone, title, subtitle, meta, disabled, onClick }) {
    return (
        <button type="button" disabled={disabled} onClick={onClick}
            className={`group flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-start transition-colors md:p-5 ${disabled ? 'border-slate-200 opacity-60 cursor-not-allowed' : 'border-slate-200 hover:border-sky-400 hover:bg-sky-50'}`}>
            <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${tone}`}>{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-800">{title}</span>
                {subtitle && <span className="mt-1 block text-sm text-slate-500">{subtitle}</span>}
                {meta && <span className="mt-1 block text-xs text-slate-500">{meta}</span>}
            </span>
            {!disabled && <ChevronRight size={20} className="shrink-0 text-slate-400 group-hover:text-sky-600 rtl:rotate-180" />}
        </button>
    );
}

function ServicePicker({ onSelect }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    return (
        <div className="space-y-4">
            <PageHeader
                title={t('trackers.supervision.title', 'Supervision')}
                subtitle={t('trackers.supervision.choose_service', 'Choose the service to supervise')}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {SUPERVISION_SERVICES.map((s) => {
                    const forms = checklistsForService(s.key);
                    const enabled = forms.length > 0;
                    const Icon = SERVICE_ICONS[s.key] || Baby;
                    return (
                        <PickerTile key={s.key} disabled={!enabled} onClick={() => onSelect(s.key)}
                            icon={<Icon size={34} />}
                            tone={enabled ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}
                            title={`${isArabic ? s.titleAr : s.title} (${s.key})`}
                            subtitle={enabled
                                ? t('trackers.supervision.form_count', '{{count}} forms', { count: forms.length })
                                : t('trackers.supervision.no_forms', 'No checklists yet')} />
                    );
                })}
            </div>
        </div>
    );
}

function FormPicker({ service, assessments, onSelect, onBack }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const info = SUPERVISION_SERVICES.find((s) => s.key === service);
    return (
        <div className="space-y-4">
            {!IS_NATIVE && (
                <Button variant="secondary" onClick={onBack}>
                    <ArrowLeft size={16} /> {t('trackers.supervision.back_to_services', 'All services')}
                </Button>
            )}
            <PageHeader
                title={isArabic ? info?.titleAr : info?.title}
                subtitle={t('trackers.supervision.choose_form', 'Choose a supervision form')}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {checklistsForService(service).map((c) => {
                    const records = assessments.filter((a) => a.checklistId === c.id);
                    const submitted = records.filter((a) => a.status === 'submitted').length;
                    const Icon = FORM_ICONS[c.icon] || ClipboardList;
                    return (
                        <PickerTile key={c.id} onClick={() => onSelect(c.id)}
                            icon={<Icon size={34} />}
                            tone={FORM_TONES[c.icon] || 'bg-sky-100 text-sky-700'}
                            title={isArabic ? c.titleAr : c.title}
                            subtitle={isArabic ? c.descriptionAr : c.description}
                            meta={t('trackers.supervision.form_meta', '{{total}} assessments · {{submitted}} submitted', { total: records.length, submitted })} />
                    );
                })}
            </div>
        </div>
    );
}

// =============================================================================
// Main screen
// =============================================================================

const DeletedItemsPanel = lazy(() => import('./DeletedItemsPanel.jsx'));
const LIST_TAB = 'list';
const DASHBOARD_TAB = 'dashboard';
const DELETED_TAB = 'deleted';

// Older records were saved before the service split and may lack `service`.
const serviceOf = (a) => a.service || getChecklist(a.checklistId)?.service;

export default function SupervisionView({ permissions = {} }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const canEdit = !!(permissions.canManageSupervision ?? permissions.canUseFederalManagerAdvancedFeatures);

    const { supervisionAssessments, fetchSupervisionAssessments, isLoading } = useDataCache();

    const [service, setService] = useState(null);
    const [checklistId, setChecklistId] = useState(null);
    const [tab, setTab] = useState(LIST_TAB);
    const [editing, setEditing] = useState(null);
    const [sharing, setSharing] = useState(false);
    const [stateFilter, setStateFilter] = useState('all');
    const canEmptyBin = !!permissions.canUseFederalManagerAdvancedFeatures;
    const topRef = useRef(null);

    useEffect(() => {
        if (!supervisionAssessments) fetchSupervisionAssessments(false);
    }, [supervisionAssessments, fetchSupervisionAssessments]);

    // Each page starts at its top.
    useEffect(() => { topRef.current?.scrollIntoView?.({ block: 'start' }); }, [service, checklistId, editing]);

    const reload = useCallback(() => fetchSupervisionAssessments('full'), [fetchSupervisionAssessments]);

    // Android app: the top-bar arrow steps back one page: form → forms → services.
    useInPageBack(() => (checklistId ? setChecklistId(null) : setService(null)), !!service && editing === null);

    const checklist = getChecklist(checklistId);

    const serviceAssessments = useMemo(() => (supervisionAssessments || [])
        .filter((a) => a.isDeleted !== true && serviceOf(a) === service), [supervisionAssessments, service]);

    const formAssessments = useMemo(() => serviceAssessments.filter((a) => a.checklistId === checklistId),
        [serviceAssessments, checklistId]);

    const rows = useMemo(() => formAssessments
        .filter((a) => stateFilter === 'all' || a.stateKey === stateFilter)
        .sort((a, b) => String(b.assessmentDate || '').localeCompare(String(a.assessmentDate || ''))),
    [formAssessments, stateFilter]);

    const handleDelete = async (row) => {
        const ok = await confirmDialog(
            t('trackers.supervision.delete_confirm', 'Delete the assessment for {{name}}?', { name: row.facilityName }),
            { title: t('trackers.supervision.delete_title', 'Delete assessment'), confirmLabel: t('trackers.supervision.delete', 'Delete'), danger: true }
        );
        if (!ok) return;
        try {
            await deleteSupervisionAssessment(row.id);
            notify(t('trackers.supervision.deleted', 'Assessment deleted.'), 'success');
            // A soft delete stamps lastUpdatedAt, so the delta sync is enough.
            fetchSupervisionAssessments('sync');
        } catch (error) {
            console.error('Failed to delete assessment:', error);
            notify(t('trackers.supervision.delete_failed', 'Could not delete the assessment.'), 'error');
        }
    };

    const page = (() => {
        if (!service) {
            return <ServicePicker onSelect={(key) => { setService(key); setChecklistId(null); }} />;
        }
        if (!checklist) {
            return (
                <FormPicker service={service} assessments={serviceAssessments}
                    onBack={() => setService(null)}
                    onSelect={(id) => { setChecklistId(id); setTab(LIST_TAB); setStateFilter('all'); }} />
            );
        }
        if (editing !== null) {
            return (
                <AssessmentForm
                    checklist={getChecklist(editing.checklistId) || checklist}
                    initial={editing.id ? editing : null}
                    canEdit={canEdit}
                    onBack={() => setEditing(null)}
                    onSaved={reload}
                />
            );
        }
        return null;
    })();

    if (page) return <div ref={topRef}>{page}</div>;

    const isWarmer = checklist.id === 'infant_warmer';
    const headers = [
        t('trackers.supervision.table.date', 'Date'),
        isWarmer ? t('trackers.supervision.table.facility', 'Facility') : t('trackers.supervision.table.hospital', 'Hospital'),
        t('trackers.supervision.state', 'State'),
        t('trackers.supervision.table.status', 'Status'),
        t('trackers.supervision.table.completed', 'Completed'),
        ...(isWarmer
            ? [t('trackers.supervision.warmer.coverage', 'Coverage of portable warming')]
            : [t('trackers.supervision.table.present', 'Present')]),
        ...(canEdit ? [t('trackers.supervision.table.actions', 'Actions')] : []),
    ];
    const resultCell = (row) => {
        const s = row.summary || {};
        if (isWarmer) {
            const coverage = s.coveragePercent !== undefined ? s.coveragePercent : warmerResults(row.responses, row.periodStart).service.total.coverage;
            return <td><span className={`px-2 py-0.5 rounded text-xs ${toneFor(coverage)}`}>{pctText(coverage)}</span></td>;
        }
        return <td><span className={`px-2 py-0.5 rounded text-xs ${toneFor(s.presencePercent)}`}>{pctText(s.presencePercent)}</span></td>;
    };
    const completed = (row) => (row.summary?.completionPercent !== undefined
        ? row.summary.completionPercent
        : assessmentProgress(checklist, row).percent);

    return (
        <div ref={topRef} className="space-y-4">
            {!IS_NATIVE && (
                <Button variant="secondary" onClick={() => setChecklistId(null)}>
                    <ArrowLeft size={16} /> {t('trackers.supervision.back_to_forms', 'All forms')}
                </Button>
            )}
            <div className="flex flex-wrap items-center gap-3">
                <FormIcon checklist={checklist} large />
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold text-slate-800">{isArabic ? checklist.titleAr : checklist.title}</h2>
                    <p className="text-sm text-slate-500">{isArabic ? SUPERVISION_SERVICES.find((s) => s.key === service)?.titleAr : SUPERVISION_SERVICES.find((s) => s.key === service)?.title}</p>
                </div>
                {canEdit && (
                    <div className="flex w-full gap-2 sm:w-auto">
                        <Button variant="secondary" onClick={() => setSharing(true)} className="flex-1 sm:flex-none">
                            <Share2 size={16} /> {t('trackers.supervision.share.button', 'Public link')}
                        </Button>
                        <Button onClick={() => setEditing({ checklistId: checklist.id })} className="flex-1 sm:flex-none">
                            <Plus size={16} /> {t('trackers.supervision.new', 'New assessment')}
                        </Button>
                    </div>
                )}
            </div>

            <Card>
                <CardBody className="space-y-4">
                    <Tabs
                        tabs={[
                            { id: LIST_TAB, label: t('trackers.supervision.tabs.assessments', 'Assessments'), short: t('trackers.supervision.tabs.assessments_short', 'Forms') },
                            { id: DASHBOARD_TAB, label: t('trackers.supervision.tabs.dashboard', 'Dashboard'), short: t('trackers.supervision.tabs.dashboard', 'Dashboard') },
                            ...(canEmptyBin ? [{ id: DELETED_TAB, label: t('trackers.supervision.deleted_items', 'Deleted Items'), short: t('ui.short.deleted', 'Deleted') }] : []),
                        ]}
                        activeTab={tab}
                        onTabChange={setTab}
                    />

                    {tab === DELETED_TAB && canEmptyBin && (
                        <Suspense fallback={<SkeletonTable />}>
                            <DeletedItemsPanel types={['supervisionAssessments']} />
                        </Suspense>
                    )}

                    {tab === DASHBOARD_TAB && (
                        isLoading?.supervisionAssessments && !supervisionAssessments ? <SkeletonTable /> : (
                            <Suspense fallback={<SkeletonTable />}>
                                <SupervisionDashboard checklist={checklist} assessments={formAssessments} />
                            </Suspense>
                        )
                    )}

                    {tab === LIST_TAB && (<>
                        <div className="w-full md:w-56">
                            <Select label={t('trackers.supervision.state', 'State')} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                                <option value="all">{t('trackers.supervision.all_states', 'All states')}</option>
                                {Object.keys(STATE_LOCALITIES).filter((k) => k !== 'Federal')
                                    .map((k) => <option key={k} value={k}>{isArabic ? STATE_LOCALITIES[k].ar || STATE_LOCALITIES[k].en : STATE_LOCALITIES[k].en}</option>)}
                            </Select>
                        </div>

                        {isLoading?.supervisionAssessments && !supervisionAssessments ? <SkeletonTable /> : (
                            <Table headers={headers} cardsOnPhone>
                                {rows.length === 0 ? (
                                    <EmptyState colSpan={headers.length}
                                        message={t('trackers.supervision.empty', 'No assessments yet. Use New assessment to start one.')}
                                        action={canEdit ? { label: t('trackers.supervision.new', 'New assessment'), onClick: () => setEditing({ checklistId: checklist.id }) } : undefined} />
                                ) : rows.map((row) => (
                                    <tr key={row.id} onClick={canEdit ? undefined : () => setEditing(row)} className={canEdit ? '' : 'cursor-pointer'}>
                                        <td className="text-gray-600">{row.assessmentDate || '—'}</td>
                                        <td className="font-medium">{row.facilityName}</td>
                                        <td className="text-gray-600">
                                            {STATE_LOCALITIES[row.stateKey]?.[isArabic ? 'ar' : 'en'] || row.stateKey}
                                        </td>
                                        <td>
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                row.status === 'submitted'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-amber-100 text-amber-800'}`}>
                                                {row.status === 'submitted' ? t('trackers.supervision.status.submitted', 'Submitted') : t('trackers.supervision.status.draft', 'Draft')}
                                            </span>
                                            {row.submittedVia === 'public_link' && (
                                                <span className="ms-1 px-2 py-0.5 rounded text-xs bg-sky-100 text-sky-800">{t('trackers.supervision.status.via_link', 'Via link')}</span>
                                            )}
                                        </td>
                                        <td className="text-gray-600">{pctText(completed(row))}</td>
                                        {resultCell(row)}
                                        {canEdit && (
                                            <td>
                                                <div className="flex gap-2">
                                                    <Button variant="secondary" onClick={() => setEditing(row)}>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button variant="danger" onClick={() => handleDelete(row)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </>)}
                </CardBody>
            </Card>

            {sharing && <ShareLinkModal checklist={checklist} onClose={() => setSharing(false)} />}
        </div>
    );
}
