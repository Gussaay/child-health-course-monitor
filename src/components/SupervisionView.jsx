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
    Plus, Trash2, ArrowLeft, RefreshCw, Baby, ShieldCheck, Stethoscope, Siren, HeartPulse, ChevronRight,
    ChevronDown, X, Hospital, Thermometer, ClipboardList, Share2, Copy, ExternalLink, CheckCircle2, Search, Pill,
} from 'lucide-react';

import {
    Card, CardBody, PageHeader, Button, EmptyState, Modal, PageTabs, FilterPanel, PageActions, PhoneCards,
    PullToRefresh, FormGroup, Spinner,
    Input, Select, Textarea, IS_NATIVE, useInPageBack, SkeletonTable, MenuTile, MenuGrid, BackArrow,
} from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import { useDataCache } from '../DataContext';
import {
    upsertSupervisionAssessment, deleteSupervisionAssessment,
    saveFacilitySnapshot, submitFacilityDataForApproval, getHealthFacilityById,
} from '../data';
import { auth } from '../firebase';
import { STATE_LOCALITIES } from './constants';
import { useLeaveGuard, leaveForm, formSaved } from '../utils/leaveGuard';
import { publicBaseUrl } from '../utils/publicLink';
import { isDateInRange, DATE_RANGE_OPTIONS } from '../utils/dateRange';
import FormPdfButton from './FormPdfButton';
import {
    SUPERVISION_SERVICES, getChecklist, checklistsForService, pickLabel,
    scoreSection, scoreAssessment, pctText, toneFor, toNum,
    defaultPeriodStart, periodMonths, cascadeMonths, monthLabel,
    serviceDataCalc, warmerResults, estimateNeed, assessmentProgress,
} from './supervision/checklists';
import { imnciFacilityPatch } from './supervision/imnciChecklists';

const SupervisionDashboard = lazy(() => import('./supervision/SupervisionDashboard.jsx'));

// =============================================================================
// Answer controls
// =============================================================================

const FIELD = 'w-full min-w-0 border border-slate-300 rounded-md px-2 py-2 text-sm bg-white disabled:bg-slate-50';
// Inside a table cell: narrower padding and no number spinners, so four
// number columns fit beside the question on a phone.
const CELL_FIELD = 'w-full min-w-0 border border-slate-300 rounded px-1.5 py-1.5 text-sm bg-white disabled:bg-slate-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// Yes / No as two small buttons: one tap on a phone, and tapping the chosen
// one again clears it. Stored as true / false, cleared as null (Firestore
// rejects undefined).
function YesNo({ value, onChange, readOnly }) {
    const { t } = useTranslation();
    const opt = (v, label, on) => (
        <button type="button" disabled={readOnly} aria-pressed={value === v}
            onClick={() => onChange(value === v ? null : v)}
            className={`flex-1 min-w-0 rounded border px-1 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default ${value === v ? on : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            {label}
        </button>
    );
    return (
        <div className="flex gap-1">
            {opt(true, t('trackers.supervision.yes', 'Yes'), 'bg-emerald-600 text-white border-emerald-600')}
            {opt(false, t('trackers.supervision.no', 'No'), 'bg-red-600 text-white border-red-600')}
        </div>
    );
}

function CellInput({ kind = 'number', value, onChange, readOnly, options = [], isArabic, placeholder }) {
    if (kind === 'yesno') return <YesNo value={value} onChange={onChange} readOnly={readOnly} />;
    if (kind === 'select') {
        return (
            <select disabled={readOnly} className={CELL_FIELD} value={value || ''} onChange={(e) => onChange(e.target.value)}>
                <option value="">—</option>
                {options.map((o) => <option key={o.value} value={o.value}>{pickLabel(o, isArabic)}</option>)}
            </select>
        );
    }
    return (
        <input disabled={readOnly} className={CELL_FIELD}
            type={kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'}
            inputMode={kind === 'number' ? 'numeric' : undefined}
            min={kind === 'number' ? '0' : undefined}
            placeholder={placeholder}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)} />
    );
}

const fmt = (v) => (v == null ? '—' : Math.round(v).toLocaleString());

const sectionNote = (section, isArabic) => (isArabic ? section.noteAr || section.note : section.note);

// =============================================================================
// The answer table
//
// Every section is a real table, sized to the screen (table-fixed, full
// width), so nothing ever scrolls sideways. Short answers — numbers, yes/no —
// sit in columns beside the question. Long ones — free text, dates, choices —
// would squeeze the row on a phone, so there they drop to a line of their own
// under the question; from md up they are ordinary columns again.
//
// columns: [{ id, label, below? }]  below: goes under the row on phones
// rows:    [{ id, label, code?, hint?, groupTitle?, strong? }]
// cell(row, column) renders the answer.
// =============================================================================

function AnswerTable({ itemLabel, columns, rows, cell, labelWidth = 'w-[38%] md:w-[34%]' }) {
    const inline = columns.filter((c) => !c.below);
    const below = columns.filter((c) => c.below);
    const span = 1 + inline.length;
    return (
        <div className="rounded-lg border border-slate-200">
            <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-100 text-xs font-semibold text-slate-700">
                    <tr>
                        <th className={`${labelWidth} px-2 py-2 text-start align-bottom`}>{itemLabel}</th>
                        {columns.map((c) => (
                            <th key={c.id} className={`px-1 py-2 text-start align-bottom break-words ${c.width || ''} ${c.below ? 'hidden md:table-cell' : ''}`}>{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <React.Fragment key={row.id}>
                            {row.groupTitle && (
                                <tr className="border-t border-slate-200 bg-slate-50">
                                    <td colSpan={1 + columns.length} className="px-2 py-1 text-xs font-semibold text-slate-600">{row.groupTitle}</td>
                                </tr>
                            )}
                            <tr className={`border-t border-slate-200 align-middle ${row.strong ? 'bg-slate-50 font-semibold' : ''}`}>
                                <td className="px-2 py-1.5 text-slate-800 break-words">
                                    {row.code && <span className="me-1 font-semibold text-slate-500">{row.code}</span>}
                                    {row.label}
                                    {row.hint && <div className="text-xs font-normal text-slate-500">{row.hint}</div>}
                                </td>
                                {columns.map((c) => (
                                    <td key={c.id} className={`px-1 py-1.5 ${c.below ? 'hidden md:table-cell' : ''}`}>{cell(row, c)}</td>
                                ))}
                            </tr>
                            {below.length > 0 && !row.strong && (
                                <tr className="md:hidden">
                                    <td colSpan={span} className="px-2 pb-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            {below.map((c) => (
                                                <label key={c.id} className={`flex min-w-0 flex-col gap-0.5 ${c.full ? 'col-span-2' : ''}`}>
                                                    <span className="text-xs text-slate-500">{c.label}</span>
                                                    {cell(row, c)}
                                                </label>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

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
        item: t('trackers.supervision.cols.item', 'Item'),
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
    const columns = {
        staff: [{ id: 'name', label: L.name, kind: 'text' }, { id: 'contact', label: L.contact, kind: 'text' }],
        yesno: [{ id: 'available', label: L.available, kind: 'yesno' }],
        present_action: [{ id: 'present', label: L.present, kind: 'yesno' }, { id: 'action', label: L.action, kind: 'text', below: true, full: true }],
        present_number: [{ id: 'present', label: L.present, kind: 'yesno' }, { id: 'number', label: L.number, kind: 'number' }],
        available_need: [{ id: 'available', label: L.available, kind: 'number' }, { id: 'need', label: L.need, kind: 'number' }],
        standard_available_need: [
            { id: 'standard', label: L.standard, kind: 'fixed' },
            { id: 'available', label: L.available, kind: 'number' },
            { id: 'need', label: L.needed, kind: 'number' },
        ],
    }[section.type] || [];
    const rows = section.items.map((item, i) => ({
        id: item.id,
        item,
        label: t(`trackers.supervision.items.${itemKey(item)}`, item.label),
        groupTitle: item.group && section.items[i - 1]?.group !== item.group
            ? (GROUP_KEYS[item.group] ? t(`trackers.supervision.groups.${GROUP_KEYS[item.group]}`, item.group) : item.group)
            : null,
    }));
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
            <AnswerTable itemLabel={L.item} columns={columns} rows={rows}
                labelWidth={section.type === 'yesno' ? 'w-[62%] md:w-[60%]' : undefined}
                cell={(row, c) => (c.kind === 'fixed'
                    ? <span className="block text-center tabular-nums text-slate-500">{row.item.standard}</span>
                    : <CellInput kind={c.kind} readOnly={readOnly} value={values[row.id]?.[c.id]} onChange={(x) => set(row.id, c.id, x)} />)} />
        </div>
    );
}

function GridSection({ section, values, onChange, readOnly }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const set = (rowId, colId, value) => onChange(rowId, { ...(values[rowId] || {}), [colId]: value });
    // Text, dates and choices drop under the row on phones; numbers and yes/no stay beside it.
    const columns = section.columns.map((c) => ({
        ...c, label: pickLabel(c, isArabic),
        below: c.kind === 'text' || c.kind === 'date' || c.kind === 'select',
        full: c.wide,
    }));
    // Rows behind a gate question ("does the facility offer immunization?")
    // are hidden while the gate is answered no.
    const items = section.items.filter((item) => !(item.dependsOn && values[item.dependsOn]?.answer === false));
    const groupTitle = (item, prev) => {
        if (!item.group || prev?.group === item.group) return null;
        if (section.groups?.[item.group]) return pickLabel(section.groups[item.group], isArabic);
        return item.group === 'location' ? t('trackers.supervision.warmer.location', 'Where they are') : null;
    };
    const rows = items.map((item, i) => ({
        id: item.id, item, code: item.code, label: pickLabel(item, isArabic),
        hint: isArabic ? item.hintAr || item.hint : item.hint,
        groupTitle: groupTitle(item, items[i - 1]),
    }));
    // A total row under count tables (the staff table): the sum of each number column.
    const totalId = '__total';
    if (section.totalRow) {
        rows.push({ id: totalId, label: t('trackers.supervision.warmer.total', 'Total'), strong: true });
    }
    const colTotal = (colId) => {
        const known = section.items.map((i) => toNum(values[i.id]?.[colId])).filter((v) => v != null);
        return known.length ? known.reduce((a, b) => a + b, 0) : null;
    };
    return (
        <AnswerTable itemLabel={t('trackers.supervision.cols.item', 'Item')} columns={columns} rows={rows}
            cell={(row, c) => {
                if (row.id === totalId) {
                    return c.kind === 'number' ? <span className="block text-center font-semibold tabular-nums">{fmt(colTotal(c.id))}</span> : null;
                }
                const kind = (c.id === 'answer' || c.id === section.presenceColumn) && row.item.answerKind ? row.item.answerKind : c.kind;
                return (
                    <CellInput kind={kind}
                        options={row.item.options || c.options} isArabic={isArabic} readOnly={readOnly}
                        value={values[row.id]?.[c.id]} onChange={(v) => set(row.id, c.id, v)} />
                );
            }} />
    );
}

// A few labelled answers one under the other; with showMetrics, the form's
// worked-out results first (the drugs form's summary).
function FieldsSection({ section, values, onChange, readOnly, checklist, form }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    return (
        <div className="space-y-3">
            {section.showMetrics && checklist.metrics && <MetricList checklist={checklist} form={form} />}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {section.items.filter((f) => !f.showIf || values[f.showIf] === true).map((f) => {
                    const label = pickLabel(f, isArabic);
                    const wide = f.kind === 'textarea' ? 'sm:col-span-2' : '';
                    if (f.kind === 'textarea') {
                        return (
                            <div key={f.id} className={wide}>
                                <Textarea label={label} rows={3} disabled={readOnly} value={values[f.id] || ''}
                                    onChange={(e) => onChange(f.id, e.target.value)} />
                            </div>
                        );
                    }
                    if (f.kind === 'yesno') {
                        return (
                            <div key={f.id} className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-gray-700">{label}</span>
                                <div className="max-w-[12rem]"><YesNo value={values[f.id]} readOnly={readOnly} onChange={(v) => onChange(f.id, v)} /></div>
                            </div>
                        );
                    }
                    if (f.kind === 'select') {
                        return (
                            <Select key={f.id} label={label} value={values[f.id] || ''} disabled={readOnly}
                                onChange={(e) => onChange(f.id, e.target.value)}>
                                <option value="">—</option>
                                {f.options.map((o) => <option key={o.value} value={o.value}>{pickLabel(o, isArabic)}</option>)}
                            </Select>
                        );
                    }
                    return (
                        <Input key={f.id} label={label} type={f.kind || 'text'} value={values[f.id] ?? ''} disabled={readOnly}
                            inputMode={f.kind === 'number' ? 'numeric' : undefined} min={f.kind === 'number' ? '0' : undefined}
                            onChange={(e) => onChange(f.id, e.target.value)} />
                    );
                })}
            </div>
        </div>
    );
}

function NeedsPeriod() {
    const { t } = useTranslation();
    return <p className="text-sm text-amber-700">{t('trackers.supervision.warmer.choose_period', 'Choose the reporting quarter above first.')}</p>;
}

// Section D: indicators by month with a total, then the coverage calculation
// the paper form asks the supervisor to work out by hand.
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

    const totalId = '__total';
    const short = (m) => monthLabel(m, isArabic).split(' ')[0];
    const columns = [...months.map((m) => ({ id: m, label: short(m) })), { id: totalId, label: t('trackers.supervision.warmer.total', 'Total') }];
    const byMonth = Object.fromEntries(calc.months.map((m) => [m.month, m]));
    const calcRows = [
        { id: 'need', label: t('trackers.supervision.warmer.est_need', 'Estimated babies needing warming'), get: (m) => m.need, total: calc.total.need },
        { id: 'placed', label: t('trackers.supervision.warmer.placed', 'Babies placed in portable warmer (D6, or D7 when not documented)'), get: (m) => m.placed, total: calc.total.placed },
        { id: 'coverage', label: t('trackers.supervision.warmer.coverage', 'Coverage of portable warming'), get: (m) => m.coverage, total: calc.total.coverage, pct: true },
    ];

    return (
        <div className="space-y-3">
            <AnswerTable itemLabel={t('trackers.supervision.warmer.indicator', 'Indicator')} columns={columns}
                rows={section.items.map((item) => ({ id: item.id, code: item.code, label: pickLabel(item, isArabic) }))}
                cell={(row, c) => (c.id === totalId
                    ? <span className="block text-center font-semibold tabular-nums text-slate-700">{fmt(rowTotal(row.id))}</span>
                    : <CellInput readOnly={readOnly} value={values[row.id]?.[c.id]} onChange={(v) => set(row.id, c.id, v)} />)} />
            <AnswerTable itemLabel={t('trackers.supervision.warmer.calculation', 'Calculation (worked out from the table above)')} columns={columns}
                rows={calcRows}
                cell={(row, c) => {
                    const v = c.id === totalId ? row.total : row.get(byMonth[c.id] || {});
                    return row.pct
                        ? <span className={`block rounded px-1 py-0.5 text-center text-xs ${c.id === totalId ? 'font-semibold' : ''} ${toneFor(v)}`}>{pctText(v)}</span>
                        : <span className={`block text-center tabular-nums ${c.id === totalId ? 'font-semibold' : ''}`}>{fmt(v)}</span>;
                }} />
        </div>
    );
}

// E1: January to the end of the quarter. The need column suggests the section
// D estimate for the months both tables cover.
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
    const rows = [
        ...months.map((m) => ({ id: m, label: monthLabel(m, isArabic).split(' ')[0] })),
        { id: '__total', label: t('trackers.supervision.warmer.total', 'Total'), strong: true },
    ];

    return (
        <div className="space-y-2">
            <AnswerTable itemLabel={t('trackers.supervision.warmer.month', 'Month')} labelWidth="w-[18%] md:w-[20%]"
                columns={section.columns.map((c) => ({ ...c, label: pickLabel(c, isArabic) }))}
                rows={rows}
                cell={(row, c) => (row.id === '__total'
                    ? <span className="block text-center tabular-nums">{fmt(totals[c.id])}</span>
                    : <CellInput readOnly={readOnly} value={values[row.id]?.[c.id]}
                        placeholder={c.id === 'need' ? suggestedNeed(row.id) : undefined}
                        onChange={(v) => set(row.id, c.id, v)} />)} />
            <div className="flex flex-wrap gap-2 pt-1 text-sm">
                {results.map((r) => (
                    <span key={r.id} className={`px-2 py-1 rounded ${toneFor(r.value)}`}>{r.label}: {pctText(r.value)}</span>
                ))}
            </div>
        </div>
    );
}

const EMPTY_ACTIONS = [{}, {}, {}];

function FindingsSection({ section = {}, values, onSet, readOnly }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const actions = values.actions?.length ? values.actions : EMPTY_ACTIONS;
    const setAction = (index, field, value) => onSet('actions', actions.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
    // A form can ask more of each action (the IMNCI form's problem and the
    // level that solves it); they sit before the responsible person.
    const extra = (section.extraActionColumns || []).map((c) => ({ ...c, label: pickLabel(c, isArabic), below: true }));
    const columns = [
        ...extra,
        { id: 'responsible', label: t('trackers.supervision.warmer.responsible', 'Responsible'), kind: 'text', below: true },
        { id: 'deadline', label: t('trackers.supervision.warmer.deadline', 'Deadline'), kind: 'date', below: true },
        ...(!readOnly ? [{ id: 'remove', label: '', width: 'w-9' }] : []),
    ];

    return (
        <div className="space-y-3">
            <Textarea label={t('trackers.supervision.warmer.strengths', 'Main strengths')} rows={3} disabled={readOnly}
                value={values.strengths || ''} onChange={(e) => onSet('strengths', e.target.value)} />
            <Textarea label={section.gapsLabel ? pickLabel(section.gapsLabel, isArabic) : t('trackers.supervision.warmer.gaps', 'Main gaps / challenges')} rows={3} disabled={readOnly}
                value={values.gaps || ''} onChange={(e) => onSet('gaps', e.target.value)} />
            <AnswerTable itemLabel={section.actionLabel ? pickLabel(section.actionLabel, isArabic) : t('trackers.supervision.warmer.action', 'Action')} labelWidth="w-auto"
                columns={columns.map((c) => (c.id === 'remove' ? { ...c, label: <span className="sr-only">{t('trackers.supervision.warmer.remove_action', 'Remove action')}</span> } : c))}
                rows={actions.map((a, i) => ({ id: String(i), index: i, label: (
                    <span className="flex items-center gap-1">
                        <span className="w-5 shrink-0 text-xs text-slate-500">{i + 1}</span>
                        <CellInput kind="text" readOnly={readOnly} value={a.action} onChange={(v) => setAction(i, 'action', v)} />
                    </span>
                ) }))}
                cell={(row, c) => (c.id === 'remove' ? (
                    <button type="button" aria-label={t('trackers.supervision.warmer.remove_action', 'Remove action')}
                        className="p-1 text-slate-400 hover:text-red-600"
                        onClick={() => onSet('actions', actions.filter((_, j) => j !== row.index))}>
                        <X size={16} />
                    </button>
                ) : (
                    <CellInput kind={c.kind} options={c.options} isArabic={isArabic} readOnly={readOnly} value={actions[row.index]?.[c.id]} onChange={(v) => setAction(row.index, c.id, v)} />
                ))} />
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
    if (registryType.includes('وحدة')) return 'health_unit';
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

// Figures of a checklist with its own metrics (the IMNCI forms): a
// percentage, a count, or a yes / no.
function metricText(m, t) {
    if (m.value == null) return '—';
    if (m.kind === 'pct') return pctText(m.value);
    if (m.kind === 'bool') return m.value ? t('trackers.supervision.yes', 'Yes') : t('trackers.supervision.no', 'No');
    return Math.round(m.value).toLocaleString();
}

function metricTone(m) {
    if (m.value == null) return 'bg-gray-100 text-gray-600';
    if (m.kind === 'pct') return toneFor(m.value);
    if (m.kind === 'bool') return m.value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    // Counts on these forms are problems (stock-outs): none is good.
    return m.value === 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800';
}

export function MetricChip({ metric, label }) {
    const { t } = useTranslation();
    return (
        <span className={`px-2 py-1 rounded ${metricTone(metric)}`}>
            {label ? `${label}: ` : ''}{metricText(metric, t)}{metric.detail ? ` (${metric.detail})` : ''}
        </span>
    );
}

function MetricList({ checklist, form }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const metrics = checklist.metrics(form);
    return (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {metrics.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-slate-700">{pickLabel(m, isArabic)}</span>
                    <span className="shrink-0 text-xs"><MetricChip metric={m} /></span>
                </div>
            ))}
        </div>
    );
}

// The headline figures shown at the top of the form while it is filled in.
function ScoreChips({ checklist, form }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    if (checklist.metrics) {
        return (
            <div className="flex flex-wrap gap-2 text-xs">
                {checklist.metrics(form).map((m) => <MetricChip key={m.id} metric={m} label={pickLabel(m, isArabic)} />)}
            </div>
        );
    }
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
    if (checklist.metrics) {
        return {
            completionPercent: progress,
            metrics: Object.fromEntries(checklist.metrics(form).map((m) => [m.id, m.value ?? null])),
        };
    }
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

// The IMNCI readiness form also updates the facility's IMNCI information in
// the registry: written straight away for people who can approve facility
// updates, otherwise sent for approval like the "Update IMNCI facility
// information" form. Returns what happened, for the message after saving.
async function syncFacilityFromAssessment({ form, cachedFacilities, direct, publicMode }) {
    if (!form.facilityId) return 'no_facility';
    const patch = imnciFacilityPatch(form);
    if (!Object.keys(patch).length) return 'nothing';
    let facility = null;
    try { facility = await getHealthFacilityById(form.facilityId); } catch (e) { console.warn('Facility read failed, using the cached copy:', e); }
    if (!facility) facility = (cachedFacilities || []).find((f) => f.id === form.facilityId) || null;
    if (!facility) return 'not_found';
    const who = auth.currentUser?.email || (publicMode ? 'PublicSupervisionForm' : 'SupervisionForm');
    const payload = {
        ...facility, ...patch,
        date_of_visit: form.assessmentDate || new Date().toISOString().slice(0, 10),
        updated_by: who,
        'اخر تحديث': new Date().toISOString(),
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    if (direct) {
        await saveFacilitySnapshot(payload);
        return 'saved';
    }
    await submitFacilityDataForApproval(payload, who);
    return 'pending';
}

function AssessmentForm({ checklist, initial, onBack, onSaved, canEdit, canApproveFacility = false, publicMode = false }) {
    const { t, i18n } = useTranslation();
    const { healthFacilities } = useDataCache();
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
            if (status === 'submitted' && checklist.syncsFacility) {
                // The assessment is already saved; a failed facility update only warns.
                try {
                    const result = await syncFacilityFromAssessment({
                        form, cachedFacilities: healthFacilities, direct: canApproveFacility && !publicMode, publicMode,
                    });
                    if (result === 'saved') notify(t('trackers.supervision.facility_sync.saved', 'The facility\'s IMNCI information was updated.'), 'success');
                    else if (result === 'pending') notify(t('trackers.supervision.facility_sync.pending', 'The facility\'s IMNCI information update was sent for approval.'), 'success');
                    else if (result === 'no_facility' || result === 'not_found') notify(t('trackers.supervision.facility_sync.no_facility', 'The facility is not in the registry, so its IMNCI information was not updated.'), 'info');
                } catch (syncError) {
                    console.error('Failed to update the facility from the assessment:', syncError);
                    notify(t('trackers.supervision.facility_sync.failed', 'The assessment was saved, but the facility\'s IMNCI information could not be updated. {{error}}', { error: String(syncError?.message || syncError) }), 'error');
                }
            }
            formSaved();
            if (!form.id && id) setForm((p) => ({ ...p, id }));
            onSaved?.(status);
            // Save draft and Submit both return to the list; the public form
            // shows its own thank-you instead.
            if (!publicMode) onBack();
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
            case 'findings': return <FindingsSection section={section} values={values} onSet={onChange} readOnly={readOnly} />;
            case 'fields': return <FieldsSection {...shared} checklist={checklist} form={form} />;
            default: return <ClassicSection {...shared} />;
        }
    };

    const stateLabel = (k) => (isArabic ? STATE_LOCALITIES[k].ar || STATE_LOCALITIES[k].en : STATE_LOCALITIES[k].en);
    const cancelLabel = publicMode ? null : t('trackers.supervision.form.cancel', 'Cancel');
    const draftLabel = saving ? t('trackers.supervision.form.saving', 'Saving…') : t('trackers.supervision.form.save_draft', 'Save draft');
    const submitLabel = saving ? t('trackers.supervision.form.saving', 'Saving…') : t('trackers.supervision.form.submit', 'Submit assessment');

    // For the PDF every section is opened, then folded back as it was.
    const openAllForPdf = () => {
        const before = openSections;
        setOpenSections(new Set(checklist.sections.map((s) => s.id)));
        return () => setOpenSections(before);
    };

    return (
        <div data-pdf-root="" className={`space-y-3 ${canEdit ? 'pb-24 sm:pb-0' : ''}`}>
            {!IS_NATIVE && !publicMode && (
                <span data-pdf-hide="">
                <Button variant="secondary" onClick={back}>
                    <ArrowLeft size={16} /> {t('trackers.supervision.form.back', 'Back to assessments')}
                </Button>
                </span>
            )}
            <div className="flex justify-end" data-pdf-hide="">
                <FormPdfButton
                    formName={checklist.title}
                    subtitle={checklist.titleAr && checklist.titleAr !== checklist.title ? checklist.titleAr : ''}
                    beforeExport={openAllForPdf} />
            </div>

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
                                const typeField = (checklist.headerFields || []).find((h) => h.id === 'facilityType');
                                const choice = facilityTypeChoice(f[FACILITY_TYPE]);
                                // A type this form does not offer (a hospital on the health-centre form) is "other".
                                const type = choice && typeField && !typeField.options.some((o) => o.value === choice) ? 'other' : choice;
                                const wantsType = !!typeField;
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

            {checklist.syncsFacility && canEdit && (
                <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    {canApproveFacility && !publicMode
                        ? t('trackers.supervision.facility_sync.note_direct', 'Submitting also updates this facility\'s IMNCI information (equipment, chart booklet, register, ORT corner, immunization, nutrition services and trained staff).')
                        : t('trackers.supervision.facility_sync.note_approval', 'Submitting also sends an update of this facility\'s IMNCI information (equipment, chart booklet, register, ORT corner, immunization, nutrition services and trained staff) for approval.')}
                </p>
            )}

            {/* Overall progress and headline results; pinned under the top bar while scrolling. */}
            <div className="relative z-20 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-800">
                        {t('trackers.supervision.form.progress', 'Completed {{pct}}', { pct: `${Math.round(progress.percent)}%` })}
                    </span>
                    <ProgressBar percent={progress.percent} className="flex-1" />
                    <button type="button" data-pdf-hide="" className="shrink-0 text-xs font-medium text-sky-700 hover:underline"
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
                    <div className="sm:hidden fixed inset-x-0 bottom-[var(--bottom-nav,0px)] z-40 flex h-16 items-center justify-around gap-2 border-t border-slate-700 bg-slate-900 px-3 shadow-lg">
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
const FORM_ICONS = { hospital: Hospital, thermometer: Thermometer, stethoscope: Stethoscope, pill: Pill };
const FORM_TONES = {
    stethoscope: 'bg-sky-100 text-sky-700',
    pill: 'bg-emerald-100 text-emerald-700',
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
            <MenuGrid columns="lg:grid-cols-4">
                {SUPERVISION_SERVICES.map((s) => {
                    const forms = checklistsForService(s.key);
                    const enabled = forms.length > 0;
                    const Icon = SERVICE_ICONS[s.key] || Baby;
                    return (
                        <MenuTile key={s.key} disabled={!enabled} onClick={() => onSelect(s.key)}
                            icon={Icon}
                            label={s.key}
                            title={isArabic ? s.titleAr : s.title}
                            hint={enabled
                                ? t('trackers.supervision.form_count', '{{count}} forms', { count: forms.length })
                                : t('trackers.supervision.no_forms', 'No checklists yet')} />
                    );
                })}
            </MenuGrid>
        </div>
    );
}

function FormPicker({ service, assessments, onSelect, onBack }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const info = SUPERVISION_SERVICES.find((s) => s.key === service);
    return (
        <div className="space-y-4">
            <PageHeader
                onBack={onBack}
                backLabel={t('trackers.supervision.back_to_services', 'All services')}
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

// Who filled the assessment: the assessor's name, else the account that saved it.
const supervisorOf = (a) => (a.assessorName || '').trim() || a.createdByEmail || '';

const EMPTY_FILTERS = { start: '', end: '', range: '', state: '', locality: '', facility: '', supervisor: '', status: '' };

const localityLabel = (stateKey, localityKey, isArabic) => {
    const loc = (STATE_LOCALITIES[stateKey]?.localities || []).find((l) => l.en === localityKey);
    return loc ? (isArabic ? loc.ar || loc.en : loc.en) : localityKey || '';
};

// The assessments of one form, laid out like the mentorship lists: a numbered,
// bordered table with tick boxes, coloured status, the result and
// View / Edit / Del on every row; cards on a phone.
function AssessmentsTable({ rows, checklist, canEdit, selectedIds, onSelectionChange, onView, onEdit, onDelete, isLoading, filtered, onClearFilters, onNew }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const isWarmer = checklist.id === 'infant_warmer';
    const headline = (row) => {
        if (!checklist.metrics) return null;
        const all = checklist.metrics(row);
        return all.find((m) => m.id === checklist.headline) || all[0];
    };
    const resultLabel = checklist.metrics
        ? pickLabel(checklist.metrics({}).find((m) => m.id === checklist.headline) || {}, isArabic)
        : isWarmer ? t('trackers.supervision.warmer.coverage', 'Coverage of portable warming') : t('trackers.supervision.table.present', 'Present');
    const resultCell = (row) => {
        const h = headline(row);
        if (h) return <MetricChip metric={h} />;
        const s = row.summary || {};
        const value = isWarmer
            ? (s.coveragePercent !== undefined ? s.coveragePercent : warmerResults(row.responses, row.periodStart).service.total.coverage)
            : s.presencePercent;
        return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${toneFor(value)}`}>{pctText(value)}</span>;
    };
    const completed = (row) => (row.summary?.completionPercent !== undefined
        ? row.summary.completionPercent
        : assessmentProgress(checklist, row).percent);

    const ids = rows.map((r) => r.id);
    const allSelected = rows.length > 0 && ids.every((id) => selectedIds.includes(id));
    const someSelected = ids.some((id) => selectedIds.includes(id));
    const toggleAll = (e) => onSelectionChange(e.target.checked
        ? Array.from(new Set([...selectedIds, ...ids]))
        : selectedIds.filter((id) => !ids.includes(id)));
    const toggleRow = (id) => onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

    const th = 'px-2 py-3 text-start text-xs font-medium text-gray-500 border border-gray-300';
    const td = 'px-2 py-2 text-xs text-gray-600 text-start border border-gray-300 break-words whitespace-normal';
    const columns = 9 + (canEdit ? 1 : 0);

    if (isLoading) return <SkeletonTable rows={8} columns={6} />;

    return (
        <PhoneCards className="w-full overflow-x-auto border border-gray-300 rounded-lg shadow-sm">
            <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                    <tr>
                        {canEdit && (
                            <th className="px-3 py-3 text-center w-10 border border-gray-300">
                                <input type="checkbox" checked={allSelected}
                                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                    onChange={toggleAll} aria-label={t('trackers.supervision.list.select_all', 'Select all')}
                                    className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer" />
                            </th>
                        )}
                        <th className={th}>#</th>
                        <th className={th}>{checklist.scope === 'hospital' ? t('trackers.supervision.table.hospital', 'Hospital') : t('trackers.supervision.table.facility', 'Facility')}</th>
                        <th className={th}>{t('trackers.supervision.state', 'State')}</th>
                        <th className={th}>{t('trackers.supervision.list.supervisor', 'Supervisor')}</th>
                        <th className={th}>{t('trackers.supervision.table.date', 'Date')}</th>
                        <th className={th}>{t('trackers.supervision.table.status', 'Status')}</th>
                        <th className={th}>{t('trackers.supervision.table.completed', 'Completed')}</th>
                        <th className={th}>{resultLabel}</th>
                        <th className={th}>{t('trackers.supervision.table.actions', 'Actions')}</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rows.length === 0 ? (
                        <tr><td colSpan={columns} className="border border-gray-300">
                            <EmptyState filtered={filtered} onClearFilters={filtered ? onClearFilters : undefined}
                                title={filtered ? t('mentorship_page.empty.no_records', 'No Records Found') : undefined}
                                message={filtered
                                    ? t('trackers.supervision.list.no_match', 'No assessments matched the current filters.')
                                    : t('trackers.supervision.empty', 'No assessments yet. Use New assessment to start one.')}
                                action={!filtered && canEdit ? { label: t('trackers.supervision.new', 'New assessment'), onClick: onNew } : undefined} />
                        </td></tr>
                    ) : rows.map((row, index) => {
                        const selected = selectedIds.includes(row.id);
                        const draft = row.status !== 'submitted';
                        const locality = localityLabel(row.stateKey, row.localityKey, isArabic);
                        return (
                            <tr key={row.id} className={selected ? 'bg-sky-50' : draft ? 'bg-yellow-50' : 'bg-white'}>
                                {canEdit && (
                                    <td className="px-3 py-2 text-center border border-gray-300">
                                        <input type="checkbox" checked={selected} onChange={() => toggleRow(row.id)}
                                            aria-label={row.facilityName}
                                            className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer" />
                                    </td>
                                )}
                                <td className="px-2 py-2 text-sm font-medium text-gray-900 text-start border border-gray-300">{index + 1}</td>
                                <td className={td}>
                                    <div>
                                        <span className="block font-semibold text-gray-800">{row.facilityName}</span>
                                        {locality && <span className="block text-gray-500">{locality}</span>}
                                    </div>
                                </td>
                                <td className={td}>{STATE_LOCALITIES[row.stateKey]?.[isArabic ? 'ar' : 'en'] || row.stateKey || '—'}</td>
                                <td className={td}>{supervisorOf(row) || '—'}</td>
                                <td className={`${td} whitespace-nowrap`}>{row.assessmentDate || '—'}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${draft ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                        {draft ? t('trackers.supervision.status.draft', 'Draft') : t('trackers.supervision.status.submitted', 'Submitted')}
                                    </span>
                                    {row.submittedVia === 'public_link' && (
                                        <span className="ms-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-sky-100 text-sky-800">{t('trackers.supervision.status.via_link', 'Via link')}</span>
                                    )}
                                </td>
                                <td className={`${td} whitespace-nowrap font-medium text-gray-800`}>{pctText(completed(row))}</td>
                                <td className={td}>{resultCell(row)}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                    <div className="flex flex-wrap gap-1">
                                        <Button size="sm" variant="info" onClick={() => onView(row)} className="text-xs px-2 py-1">{t('mentorship_page.buttons.view', 'View')}</Button>
                                        {canEdit && <Button size="sm" variant="warning" onClick={() => onEdit(row)} className="text-xs px-2 py-1">{t('mentorship_page.buttons.edit', 'Edit')}</Button>}
                                        {canEdit && <Button size="sm" variant="danger" onClick={() => onDelete(row)} className="text-xs px-2 py-1">{t('mentorship_page.buttons.del', 'Del')}</Button>}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </PhoneCards>
    );
}

export default function SupervisionView({ permissions = {} }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const canEdit = !!(permissions.canManageSupervision ?? permissions.canUseFederalManagerAdvancedFeatures);

    const { supervisionAssessments, fetchSupervisionAssessments, isLoading } = useDataCache();

    const [service, setService] = useState(null);
    const [checklistId, setChecklistId] = useState(null);
    const [tab, setTab] = useState(LIST_TAB);
    const [editing, setEditing] = useState(null);
    const [viewOnly, setViewOnly] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [selectedIds, setSelectedIds] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const canEmptyBin = !!permissions.canUseFederalManagerAdvancedFeatures;
    const topRef = useRef(null);

    useEffect(() => {
        if (!supervisionAssessments) fetchSupervisionAssessments(false);
    }, [supervisionAssessments, fetchSupervisionAssessments]);

    // Each page starts at its top.
    useEffect(() => { topRef.current?.scrollIntoView?.({ block: 'start' }); }, [service, checklistId, editing]);

    const reload = useCallback(() => fetchSupervisionAssessments('full'), [fetchSupervisionAssessments]);
    const refresh = async () => {
        setRefreshing(true);
        try { await fetchSupervisionAssessments('full'); } finally { setRefreshing(false); }
    };

    // Android app: the top-bar arrow steps back one page: form → forms → services.
    useInPageBack(() => (checklistId ? setChecklistId(null) : setService(null)), !!service && editing === null);

    const checklist = getChecklist(checklistId);

    const serviceAssessments = useMemo(() => (supervisionAssessments || [])
        .filter((a) => a.isDeleted !== true && serviceOf(a) === service), [supervisionAssessments, service]);

    const formAssessments = useMemo(() => serviceAssessments.filter((a) => a.checklistId === checklistId),
        [serviceAssessments, checklistId]);

    const setFilter = (name, value) => {
        setFilters((f) => {
            const next = { ...f, [name]: value };
            // A wider place clears the narrower choices under it.
            if (name === 'state') { next.locality = ''; next.facility = ''; }
            if (name === 'locality') next.facility = '';
            return next;
        });
        setSelectedIds([]);
    };
    const clearFilters = () => { setFilters(EMPTY_FILTERS); setSelectedIds([]); };
    const activeFilters = Object.values(filters).filter(Boolean).length;

    // Choices offered by each filter come from the records of this form.
    const options = useMemo(() => {
        const inState = formAssessments.filter((a) => !filters.state || a.stateKey === filters.state);
        const inLocality = inState.filter((a) => !filters.locality || a.localityKey === filters.locality);
        const uniq = (list) => Array.from(new Set(list.filter(Boolean))).sort((a, b) => a.localeCompare(b));
        return {
            states: uniq(formAssessments.map((a) => a.stateKey)),
            localities: uniq(inState.map((a) => a.localityKey)),
            facilities: uniq(inLocality.map((a) => a.facilityName)),
            supervisors: uniq(formAssessments.map(supervisorOf)),
        };
    }, [formAssessments, filters.state, filters.locality]);

    const rows = useMemo(() => formAssessments
        .filter((a) => !filters.state || a.stateKey === filters.state)
        .filter((a) => !filters.locality || a.localityKey === filters.locality)
        .filter((a) => !filters.facility || a.facilityName === filters.facility)
        .filter((a) => !filters.supervisor || supervisorOf(a) === filters.supervisor)
        .filter((a) => !filters.status || (filters.status === 'submitted') === (a.status === 'submitted'))
        .filter((a) => (!filters.range && !filters.start && !filters.end) || isDateInRange(a.assessmentDate, filters.range, filters.start, filters.end))
        .sort((a, b) => String(b.assessmentDate || '').localeCompare(String(a.assessmentDate || ''))),
    [formAssessments, filters]);

    const draftCount = formAssessments.filter((a) => a.status !== 'submitted').length;

    const handleDelete = async (row) => {
        const ok = await confirmDialog(
            t('trackers.supervision.delete_confirm', 'Delete the assessment for {{name}}?', { name: row.facilityName }),
            { title: t('trackers.supervision.delete_title', 'Delete assessment'), confirmLabel: t('trackers.supervision.delete', 'Delete'), danger: true }
        );
        if (!ok) return;
        try {
            await deleteSupervisionAssessment(row.id);
            notify(t('trackers.supervision.deleted', 'Assessment deleted.'), 'success');
            setSelectedIds((ids) => ids.filter((id) => id !== row.id));
            // A soft delete stamps lastUpdatedAt, so the delta sync is enough.
            fetchSupervisionAssessments('sync');
        } catch (error) {
            console.error('Failed to delete assessment:', error);
            notify(t('trackers.supervision.delete_failed', 'Could not delete the assessment.'), 'error');
        }
    };

    const handleBulkDelete = async () => {
        const count = selectedIds.length;
        const ok = await confirmDialog(
            t('trackers.supervision.list.delete_selected_confirm', 'Delete {{count}} selected assessments?', { count }),
            { title: t('trackers.supervision.delete_title', 'Delete assessment'), confirmLabel: t('trackers.supervision.delete', 'Delete'), danger: true }
        );
        if (!ok) return;
        let failed = 0;
        for (const id of selectedIds) {
            try { await deleteSupervisionAssessment(id); } catch (error) { failed += 1; console.error('Failed to delete assessment:', id, error); }
        }
        setSelectedIds([]);
        notify(failed
            ? t('trackers.supervision.list.delete_some_failed', '{{failed}} of {{count}} could not be deleted.', { failed, count })
            : t('trackers.supervision.list.deleted_n', '{{count}} assessments deleted.', { count }), failed ? 'error' : 'success');
        fetchSupervisionAssessments('sync');
    };

    const openRecord = (row, readOnlyView) => { setViewOnly(readOnlyView); setEditing(row); };
    const startNew = () => { setViewOnly(false); setEditing({ checklistId: checklist.id }); };

    const page = (() => {
        if (!service) {
            return <ServicePicker onSelect={(key) => { setService(key); setChecklistId(null); }} />;
        }
        if (!checklist) {
            return (
                <FormPicker service={service} assessments={serviceAssessments}
                    onBack={() => setService(null)}
                    onSelect={(id) => { setChecklistId(id); setTab(LIST_TAB); setFilters(EMPTY_FILTERS); setSelectedIds([]); }} />
            );
        }
        if (editing !== null) {
            return (
                <AssessmentForm
                    checklist={getChecklist(editing.checklistId) || checklist}
                    initial={editing.id ? editing : null}
                    canEdit={canEdit && !viewOnly}
                    canApproveFacility={!!permissions.canApproveSubmissions}
                    onBack={() => setEditing(null)}
                    onSaved={reload}
                />
            );
        }
        return null;
    })();

    if (page) return <div ref={topRef}>{page}</div>;

    const serviceInfo = SUPERVISION_SERVICES.find((s) => s.key === service);
    const loadingList = isLoading?.supervisionAssessments && !supervisionAssessments;
    const stateName = (k) => STATE_LOCALITIES[k]?.[isArabic ? 'ar' : 'en'] || k;

    return (
        <div ref={topRef}>
            <Card>
                <div className="p-3 md:p-6">
                    {/* Title row, as in the mentorship lists: back, the form, refresh. */}
                    <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3 mb-3 md:mb-6 border-b border-gray-200 pb-2">
                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                            <BackArrow onClick={() => setChecklistId(null)} label={t('trackers.supervision.back_to_forms', 'All forms')} className="-ms-2" />
                            <FormIcon checklist={checklist} />
                            <div className="min-w-0">
                                <h2 className="text-lg md:text-xl font-semibold text-slate-800">{isArabic ? checklist.titleAr : checklist.title}</h2>
                                <p className="text-xs md:text-sm text-slate-500">{isArabic ? serviceInfo?.titleAr : serviceInfo?.title}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <PullToRefresh onRefresh={refresh} disabled={refreshing} />
                            <Button variant="secondary" onClick={refresh} disabled={refreshing} className="flex items-center gap-2">
                                {refreshing ? <Spinner size="sm" /> : <RefreshCw size={16} />}
                                <span className="hidden sm:inline">{refreshing ? t('mentorship_page.buttons.refreshing', 'Refreshing...') : t('mentorship_page.buttons.refresh', 'Refresh')}</span>
                            </Button>
                        </div>
                    </div>

                    <PageTabs
                        className="md:!mb-6"
                        active={tab}
                        onChange={(id) => { setTab(id); setSelectedIds([]); }}
                        tabs={[
                            { id: LIST_TAB, label: t('trackers.supervision.tabs.assessments', 'Assessments'), short: t('trackers.supervision.tabs.assessments_short', 'Forms'), count: formAssessments.length },
                            { id: DASHBOARD_TAB, label: t('trackers.supervision.tabs.dashboard', 'Dashboard'), short: t('trackers.supervision.tabs.dashboard', 'Dashboard') },
                            canEmptyBin && { id: DELETED_TAB, label: t('trackers.supervision.deleted_items', 'Deleted Items'), short: t('ui.short.deleted', 'Deleted') },
                        ]}
                    />

                    {tab === DELETED_TAB && canEmptyBin && (
                        <Suspense fallback={<SkeletonTable />}>
                            <DeletedItemsPanel types={['supervisionAssessments']} />
                        </Suspense>
                    )}

                    {tab === DASHBOARD_TAB && (
                        loadingList ? <SkeletonTable /> : (
                            <Suspense fallback={<SkeletonTable />}>
                                <SupervisionDashboard checklist={checklist} assessments={formAssessments} />
                            </Suspense>
                        )
                    )}

                    {tab === LIST_TAB && (<>
                        <FilterPanel className="mb-4 md:mb-6" activeCount={activeFilters}>
                            <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4">
                                <FormGroup label={t('mentorship_page.filters.start_date', 'Start Date')}>
                                    <Input type="date" value={filters.start} onChange={(e) => setFilter('start', e.target.value)} className="w-full" />
                                </FormGroup>
                                <FormGroup label={t('mentorship_page.filters.end_date', 'End Date')}>
                                    <Input type="date" value={filters.end} onChange={(e) => setFilter('end', e.target.value)} className="w-full" />
                                </FormGroup>
                                <FormGroup label={t('mentorship_page.filters.date_range', 'Date Range')}>
                                    <Select value={filters.range} onChange={(e) => setFilter('range', e.target.value)}>
                                        <option value="">{t('mentorship_page.filters.all_time', 'All Time')}</option>
                                        {DATE_RANGE_OPTIONS.map((r) => <option key={r} value={r}>{t(`mentorship_page.filters.${r}`, r)}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label={t('mentorship_page.filters.state', 'State')}>
                                    <Select value={filters.state} onChange={(e) => setFilter('state', e.target.value)}>
                                        <option value="">{t('trackers.supervision.all_states', 'All states')}</option>
                                        {options.states.map((k) => <option key={k} value={k}>{stateName(k)}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label={t('mentorship_page.filters.locality', 'Locality')}>
                                    <Select value={filters.locality} onChange={(e) => setFilter('locality', e.target.value)} disabled={!filters.state}>
                                        <option value="">{t('trackers.supervision.list.all_localities', 'All localities')}</option>
                                        {options.localities.map((k) => <option key={k} value={k}>{localityLabel(filters.state, k, isArabic)}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label={checklist.scope === 'hospital' ? t('trackers.supervision.table.hospital', 'Hospital') : t('mentorship_page.filters.facility', 'Facility')}>
                                    <Select value={filters.facility} onChange={(e) => setFilter('facility', e.target.value)}>
                                        <option value="">{t('mentorship_page.filters.all_facilities', 'All Facilities')}</option>
                                        {options.facilities.map((f) => <option key={f} value={f}>{f}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label={t('mentorship_page.filters.supervisor', 'Supervisor')}>
                                    <Select value={filters.supervisor} onChange={(e) => setFilter('supervisor', e.target.value)}>
                                        <option value="">{t('mentorship_page.filters.all_supervisors', 'All Supervisors')}</option>
                                        {options.supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label={t('mentorship_page.filters.status', 'Status')}>
                                    <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
                                        <option value="">{t('mentorship_page.filters.all_statuses', 'All Statuses')}</option>
                                        <option value="submitted">{t('trackers.supervision.status.submitted', 'Submitted')}</option>
                                        <option value="draft">{t('trackers.supervision.status.draft', 'Draft')}</option>
                                    </Select>
                                </FormGroup>
                            </div>
                        </FilterPanel>

                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <PageActions keep={1}>
                                {canEdit && selectedIds.length === 0 && (
                                    <Button onClick={startNew}><Plus size={16} /> {t('trackers.supervision.new', 'New assessment')}</Button>
                                )}
                                {canEdit && selectedIds.length > 0 && (
                                    <Button variant="danger" onClick={handleBulkDelete}>
                                        <Trash2 size={16} /> {t('mentorship_page.buttons.delete_selected', 'Delete Selected ({{count}})', { count: selectedIds.length })}
                                    </Button>
                                )}
                                {canEdit && (
                                    <Button variant="secondary" onClick={() => setSharing(true)}>
                                        <Share2 size={16} /> {t('trackers.supervision.share.button', 'Public link')}
                                    </Button>
                                )}
                            </PageActions>
                            {!loadingList && (
                                <p className="text-xs text-slate-500">
                                    {t('trackers.supervision.list.count', '{{shown}} of {{total}} assessments · {{drafts}} drafts', { shown: rows.length, total: formAssessments.length, drafts: draftCount })}
                                </p>
                            )}
                        </div>

                        <AssessmentsTable
                            rows={rows}
                            checklist={checklist}
                            canEdit={canEdit}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                            onView={(row) => openRecord(row, true)}
                            onEdit={(row) => openRecord(row, false)}
                            onDelete={handleDelete}
                            isLoading={loadingList}
                            filtered={activeFilters > 0}
                            onClearFilters={clearFilters}
                            onNew={startNew}
                        />
                    </>)}
                </div>
            </Card>

            {sharing && <ShareLinkModal checklist={checklist} onClose={() => setSharing(false)} />}
        </div>
    );
}
