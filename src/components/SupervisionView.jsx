// src/components/SupervisionView.jsx
//
// Supervision: structured facility assessments, grouped by service the same
// way skills mentorship is. Pick a service, then its checklists; each service
// has an Assessments tab (the records), a Dashboard tab (the results of each
// checklist) and, for federal managers, Deleted Items.
//
// The checklists themselves, their scoring and the dashboard figures live in
// supervision/checklists.js. This file renders them: one form renderer for
// every section type, so a new checklist needs no new screen.

import React, { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Save, ArrowLeft, Baby, ShieldCheck, Stethoscope, Siren, HeartPulse, ChevronRight, X } from 'lucide-react';

import {
    Card, CardBody, PageHeader, Button, Tabs, Table, EmptyState, Spinner,
    Input, Select, Textarea, IS_NATIVE, useInPageBack, SkeletonTable,
} from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import { useDataCache } from '../DataContext';
import { upsertSupervisionAssessment, deleteSupervisionAssessment } from '../data';
import { STATE_LOCALITIES } from './constants';
import { useLeaveGuard, leaveForm, formSaved } from '../utils/leaveGuard';
import {
    RESPONSE_TYPES, SUPERVISION_SERVICES, getChecklist, checklistsForService, pickLabel,
    scoreSection, scoreAssessment, pctText, toneFor, toNum,
    defaultPeriodStart, periodMonths, cascadeMonths, monthLabel,
    serviceDataCalc, warmerResults, estimateNeed,
} from './supervision/checklists';

const SupervisionDashboard = lazy(() => import('./supervision/SupervisionDashboard.jsx'));

// =============================================================================
// The assessment form
// =============================================================================


const GROUP_KEYS = { 'IPC programme': 'ipc_programme', 'IPC guideline': 'ipc_guideline', 'Training': 'training', 'Surveillance': 'surveillance' };
const itemKey = (item) => item.id.replace(/^l[23]_/, '');

function SectionEditor({ section, values, onChange, readOnly }) {
    const { t } = useTranslation();
    const set = (itemId, field, value) => onChange(itemId, { ...(values[itemId] || {}), [field]: value });

    const grouped = useMemo(() => {
        const out = [];
        section.items.forEach((item) => {
            const last = out[out.length - 1];
            if (item.group && (!last || last.group !== item.group)) out.push({ group: item.group, items: [item] });
            else if (item.group) last.items.push(item);
            else out.push({ group: null, items: [item] });
        });
        return out;
    }, [section.items]);

    const headerFor = () => {
        switch (section.type) {
            case 'staff': return [t('trackers.supervision.cols.name', 'Name'), t('trackers.supervision.cols.contact', 'Contact')];
            case 'yesno': return [t('trackers.supervision.cols.available', 'Available')];
            case 'present_action': return [t('trackers.supervision.cols.present', 'Present'), t('trackers.supervision.cols.action', 'Action needed')];
            case 'present_number': return [t('trackers.supervision.cols.present', 'Present'), t('trackers.supervision.cols.number', 'Number registered')];
            case 'standard_available_need': return [t('trackers.supervision.cols.standard', 'Standard'), t('trackers.supervision.cols.available', 'Available'), t('trackers.supervision.cols.needed', 'Needed')];
            default: return [t('trackers.supervision.cols.available', 'Available'), t('trackers.supervision.cols.need', 'Need')];
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
                <h4 className="font-semibold text-slate-800">{t(`trackers.supervision.sections.${section.id}`, section.title)}</h4>
                {(() => {
                    const s = scoreSection(section, values);
                    if (!s) return null;
                    return (
                        <div className="flex gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded ${toneFor(s.presencePercent)}`}>
                                {t('trackers.supervision.score.present', 'present {{pct}}', { pct: pctText(s.presencePercent) })}
                            </span>
                            {s.adequacyPercent != null && (
                                <span className={`px-2 py-0.5 rounded ${toneFor(s.adequacyPercent)}`}>
                                    {t('trackers.supervision.score.vs_standard', 'vs standard {{pct}}', { pct: pctText(s.adequacyPercent) })}
                                </span>
                            )}
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {t('trackers.supervision.score.answered', '{{answered}}/{{total}} answered', { answered: s.answered, total: s.total })}
                            </span>
                        </div>
                    );
                })()}
            </div>

            {section.note && <p className="text-xs text-gray-500">{t(`trackers.supervision.notes.${section.id}`, section.note)}</p>}

            <div className="border rounded overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-700">
                    <div className="col-span-5">{t('trackers.supervision.cols.item', 'Item')}</div>
                    {headerFor().map((h, i) => (
                        <div key={h} className={i === 0 && headerFor().length === 3 ? 'col-span-2' : 'col-span-3'}>{h}</div>
                    ))}
                </div>

                {grouped.map((block, bi) => (
                    <React.Fragment key={bi}>
                        {block.group && (
                            <div className="px-3 py-1 bg-slate-50 text-xs font-semibold text-slate-600 border-t">
                                {GROUP_KEYS[block.group] ? t(`trackers.supervision.groups.${GROUP_KEYS[block.group]}`, block.group) : block.group}
                            </div>
                        )}
                        {block.items.map((item) => {
                            const v = values[item.id] || {};
                            return (
                                <div key={item.id} className="grid grid-cols-12 gap-2 px-3 py-1.5 border-t items-center text-sm">
                                    <div className="col-span-5 text-gray-800">{t(`trackers.supervision.items.${itemKey(item)}`, item.label)}</div>

                                    {section.type === 'staff' && (
                                        <>
                                            <div className="col-span-3">
                                                <input disabled={readOnly} value={v.name || ''}
                                                    onChange={(e) => set(item.id, 'name', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                            <div className="col-span-4">
                                                <input disabled={readOnly} value={v.contact || ''}
                                                    onChange={(e) => set(item.id, 'contact', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                        </>
                                    )}

                                    {section.type === 'yesno' && (
                                        <div className="col-span-3">
                                            <select disabled={readOnly}
                                                value={v.available === true ? 'yes' : v.available === false ? 'no' : ''}
                                                onChange={(e) => set(item.id, 'available',
                                                    e.target.value === '' ? null : e.target.value === 'yes')}
                                                className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50">
                                                <option value="">—</option>
                                                <option value="yes">{t('trackers.supervision.yes', 'Yes')}</option>
                                                <option value="no">{t('trackers.supervision.no', 'No')}</option>
                                            </select>
                                        </div>
                                    )}

                                    {(section.type === 'present_action' || section.type === 'present_number') && (
                                        <>
                                            <div className="col-span-3">
                                                <select disabled={readOnly}
                                                    value={v.present === true ? 'yes' : v.present === false ? 'no' : ''}
                                                    onChange={(e) => set(item.id, 'present',
                                                        e.target.value === '' ? null : e.target.value === 'yes')}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50">
                                                    <option value="">—</option>
                                                    <option value="yes">{t('trackers.supervision.yes', 'Yes')}</option>
                                                    <option value="no">{t('trackers.supervision.no', 'No')}</option>
                                                </select>
                                            </div>
                                            <div className="col-span-4">
                                                <input disabled={readOnly}
                                                    type={section.type === 'present_number' ? 'number' : 'text'}
                                                    min={section.type === 'present_number' ? '0' : undefined}
                                                    value={(section.type === 'present_number' ? v.number : v.action) || ''}
                                                    onChange={(e) => set(item.id,
                                                        section.type === 'present_number' ? 'number' : 'action', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                        </>
                                    )}

                                    {(section.type === 'available_need' || section.type === 'standard_available_need') && (
                                        <>
                                            {section.type === 'standard_available_need' && (
                                                <div className="col-span-2 text-gray-500">{item.standard}</div>
                                            )}
                                            <div className="col-span-3">
                                                <input disabled={readOnly} type="number" inputMode="decimal" min="0"
                                                    value={v.available ?? ''}
                                                    onChange={(e) => set(item.id, 'available', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                            <div className="col-span-3">
                                                <input disabled={readOnly} type="number" inputMode="decimal" min="0"
                                                    value={v.need ?? ''}
                                                    onChange={(e) => set(item.id, 'need', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Table sections: grid, monthly, cascade and findings
// -----------------------------------------------------------------------------

const CELL = 'w-full min-w-[5rem] border rounded px-2 py-1 text-sm disabled:bg-gray-50';

// One answer cell. Yes/no is stored as true/false and a cleared choice as
// null — Firestore rejects undefined, so a field is never set to it.
function CellInput({ kind = 'number', value, onChange, readOnly, options = [], isArabic, placeholder }) {
    const { t } = useTranslation();
    if (kind === 'yesno') {
        return (
            <select disabled={readOnly} className={CELL}
                value={value === true ? 'yes' : value === false ? 'no' : ''}
                onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'yes')}>
                <option value="">—</option>
                <option value="yes">{t('trackers.supervision.yes', 'Yes')}</option>
                <option value="no">{t('trackers.supervision.no', 'No')}</option>
            </select>
        );
    }
    if (kind === 'select') {
        return (
            <select disabled={readOnly} className={CELL} value={value || ''} onChange={(e) => onChange(e.target.value)}>
                <option value="">—</option>
                {options.map((o) => <option key={o.value} value={o.value}>{pickLabel(o, isArabic)}</option>)}
            </select>
        );
    }
    return (
        <input disabled={readOnly} className={CELL}
            type={kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'}
            inputMode={kind === 'number' ? 'numeric' : undefined}
            min={kind === 'number' ? '0' : undefined}
            placeholder={placeholder}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)} />
    );
}

const fmt = (v) => (v == null ? '—' : Math.round(v).toLocaleString());

function SectionTitle({ section, isArabic, children }) {
    return (
        <div className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-semibold text-slate-800">{isArabic ? section.titleAr || section.title : section.title}</h4>
                {children}
            </div>
            {section.note && <p className="text-xs text-gray-500">{isArabic ? section.noteAr || section.note : section.note}</p>}
        </div>
    );
}

function GridEditor({ section, values, onChange, readOnly }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const set = (rowId, colId, value) => onChange(rowId, { ...(values[rowId] || {}), [colId]: value });

    return (
        <div className="space-y-2">
            <SectionTitle section={section} isArabic={isArabic} />
            <div className="border rounded overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-xs font-semibold text-gray-700">
                        <tr>
                            <th className="px-3 py-2 text-start min-w-[12rem]">{t('trackers.supervision.cols.item', 'Item')}</th>
                            {section.columns.map((c) => (
                                <th key={c.id} className={`px-2 py-2 text-start ${c.wide ? 'min-w-[12rem]' : ''}`}>{pickLabel(c, isArabic)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {section.items.map((item, i) => {
                            const startsLocation = item.group === 'location' && section.items[i - 1]?.group !== 'location';
                            return (
                                <React.Fragment key={item.id}>
                                    {startsLocation && (
                                        <tr><td colSpan={section.columns.length + 1} className="px-3 py-1 bg-slate-50 text-xs font-semibold text-slate-600 border-t">
                                            {t('trackers.supervision.warmer.location', 'Where they are')}
                                        </td></tr>
                                    )}
                                    <tr className="border-t align-middle">
                                        <td className="px-3 py-1.5 text-gray-800">{pickLabel(item, isArabic)}</td>
                                        {section.columns.map((c) => (
                                            <td key={c.id} className="px-2 py-1.5">
                                                <CellInput
                                                    kind={c.id === 'answer' && item.answerKind ? item.answerKind : c.kind}
                                                    options={c.options} isArabic={isArabic} readOnly={readOnly}
                                                    value={values[item.id]?.[c.id]}
                                                    onChange={(v) => set(item.id, c.id, v)} />
                                            </td>
                                        ))}
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Section D: indicators by month, then the coverage calculation the paper form
// asks the supervisor to work out by hand.
function MonthlyEditor({ section, values, onChange, readOnly, periodStart, responses }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const months = periodMonths(periodStart);
    const calc = useMemo(() => serviceDataCalc(responses, periodStart), [responses, periodStart]);
    const set = (rowId, month, value) => onChange(rowId, { ...(values[rowId] || {}), [month]: value });
    const rowTotal = (rowId) => {
        const known = months.map((m) => toNum(values[rowId]?.[m])).filter((v) => v != null);
        return known.length ? known.reduce((a, b) => a + b, 0) : null;
    };

    if (!months.length) {
        return (
            <div className="space-y-2">
                <SectionTitle section={section} isArabic={isArabic} />
                <p className="text-sm text-amber-700">{t('trackers.supervision.warmer.choose_period', 'Choose the reporting quarter above first.')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SectionTitle section={section} isArabic={isArabic} />
            <div className="border rounded overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-xs font-semibold text-gray-700">
                        <tr>
                            <th className="px-3 py-2 text-start min-w-[14rem]">{t('trackers.supervision.warmer.indicator', 'Indicator')}</th>
                            {months.map((m) => <th key={m} className="px-2 py-2 text-start">{monthLabel(m, isArabic)}</th>)}
                            <th className="px-2 py-2 text-start">{t('trackers.supervision.warmer.total', 'Total')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {section.items.map((item) => (
                            <tr key={item.id} className="border-t">
                                <td className="px-3 py-1.5 text-gray-800"><span className="text-gray-500 me-1">{item.code}</span>{pickLabel(item, isArabic)}</td>
                                {months.map((m) => (
                                    <td key={m} className="px-2 py-1.5">
                                        <CellInput readOnly={readOnly} value={values[item.id]?.[m]} onChange={(v) => set(item.id, m, v)} />
                                    </td>
                                ))}
                                <td className="px-2 py-1.5 font-medium text-gray-700">{fmt(rowTotal(item.id))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="border rounded overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-sky-50 text-xs font-semibold text-sky-900">
                        <tr>
                            <th className="px-3 py-2 text-start min-w-[14rem]">{t('trackers.supervision.warmer.calculation', 'Calculation (worked out from the table above)')}</th>
                            {months.map((m) => <th key={m} className="px-2 py-2 text-start">{monthLabel(m, isArabic)}</th>)}
                            <th className="px-2 py-2 text-start">{t('trackers.supervision.warmer.total', 'Total')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-t">
                            <td className="px-3 py-1.5">{t('trackers.supervision.warmer.est_need', 'Estimated babies needing warming')}</td>
                            {calc.months.map((m) => <td key={m.month} className="px-2 py-1.5">{fmt(m.need)}</td>)}
                            <td className="px-2 py-1.5 font-medium">{fmt(calc.total.need)}</td>
                        </tr>
                        <tr className="border-t">
                            <td className="px-3 py-1.5">{t('trackers.supervision.warmer.placed', 'Babies placed in portable warmer (D6, or D7 when not documented)')}</td>
                            {calc.months.map((m) => <td key={m.month} className="px-2 py-1.5">{fmt(m.placed)}</td>)}
                            <td className="px-2 py-1.5 font-medium">{fmt(calc.total.placed)}</td>
                        </tr>
                        <tr className="border-t">
                            <td className="px-3 py-1.5">{t('trackers.supervision.warmer.coverage', 'Coverage of portable warming')}</td>
                            {calc.months.map((m) => (
                                <td key={m.month} className="px-2 py-1.5"><span className={`px-2 py-0.5 rounded text-xs ${toneFor(m.coverage)}`}>{pctText(m.coverage)}</span></td>
                            ))}
                            <td className="px-2 py-1.5"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${toneFor(calc.total.coverage)}`}>{pctText(calc.total.coverage)}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// E1: January to the end of the quarter. The need column suggests the section D
// estimate for the months both tables cover.
function CascadeEditor({ section, values, onChange, readOnly, periodStart, responses }) {
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
    const totals = Object.fromEntries(section.columns.map((c) => [c.id, colTotal(c.id)]));
    const pct = (a, b) => (a != null && b ? (a / b) * 100 : null);
    const results = [
        { id: 'coverage', label: t('trackers.supervision.warmer.coverage', 'Coverage of portable warming'), value: pct(totals.received, totals.need) },
        { id: 'registration', label: t('trackers.supervision.warmer.registration', 'Registration completeness'), value: pct(totals.registered, totals.received) },
        { id: 'dhis2', label: t('trackers.supervision.warmer.dhis2', 'DHIS2 reporting completeness'), value: pct(totals.dhis2, totals.registered) },
    ];

    if (!months.length) {
        return (
            <div className="space-y-2">
                <SectionTitle section={section} isArabic={isArabic} />
                <p className="text-sm text-amber-700">{t('trackers.supervision.warmer.choose_period', 'Choose the reporting quarter above first.')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <SectionTitle section={section} isArabic={isArabic} />
            <div className="border rounded overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-xs font-semibold text-gray-700">
                        <tr>
                            <th className="px-3 py-2 text-start">{t('trackers.supervision.warmer.month', 'Month')}</th>
                            {section.columns.map((c) => <th key={c.id} className="px-2 py-2 text-start">{pickLabel(c, isArabic)}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {months.map((m) => (
                            <tr key={m} className="border-t">
                                <td className="px-3 py-1.5 text-gray-800 whitespace-nowrap">{monthLabel(m, isArabic)}</td>
                                {section.columns.map((c) => (
                                    <td key={c.id} className="px-2 py-1.5">
                                        <CellInput readOnly={readOnly} value={values[m]?.[c.id]}
                                            placeholder={c.id === 'need' ? suggestedNeed(m) : undefined}
                                            onChange={(v) => set(m, c.id, v)} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                        <tr className="border-t bg-slate-50 font-semibold">
                            <td className="px-3 py-1.5">{t('trackers.supervision.warmer.total', 'Total')}</td>
                            {section.columns.map((c) => <td key={c.id} className="px-2 py-1.5">{fmt(totals[c.id])}</td>)}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
                {results.map((r) => (
                    <span key={r.id} className={`px-2 py-1 rounded ${toneFor(r.value)}`}>{r.label}: {pctText(r.value)}</span>
                ))}
            </div>
        </div>
    );
}

const EMPTY_ACTIONS = [{}, {}, {}];

function FindingsEditor({ section, values, onSet, readOnly }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const actions = values.actions?.length ? values.actions : EMPTY_ACTIONS;
    const setAction = (index, field, value) => onSet('actions', actions.map((a, i) => (i === index ? { ...a, [field]: value } : a)));

    return (
        <div className="space-y-3">
            <SectionTitle section={section} isArabic={isArabic} />
            <Textarea label={t('trackers.supervision.warmer.strengths', 'Main strengths')} rows={3} disabled={readOnly}
                value={values.strengths || ''} onChange={(e) => onSet('strengths', e.target.value)} />
            <Textarea label={t('trackers.supervision.warmer.gaps', 'Main gaps / challenges')} rows={3} disabled={readOnly}
                value={values.gaps || ''} onChange={(e) => onSet('gaps', e.target.value)} />
            <div className="border rounded overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-xs font-semibold text-gray-700">
                        <tr>
                            <th className="px-2 py-2 w-8">#</th>
                            <th className="px-2 py-2 text-start min-w-[14rem]">{t('trackers.supervision.warmer.action', 'Action')}</th>
                            <th className="px-2 py-2 text-start">{t('trackers.supervision.warmer.responsible', 'Responsible')}</th>
                            <th className="px-2 py-2 text-start">{t('trackers.supervision.warmer.deadline', 'Deadline')}</th>
                            {!readOnly && <th className="w-8" />}
                        </tr>
                    </thead>
                    <tbody>
                        {actions.map((a, i) => (
                            <tr key={i} className="border-t">
                                <td className="px-2 py-1.5 text-gray-500 text-center">{i + 1}</td>
                                <td className="px-2 py-1.5"><CellInput kind="text" readOnly={readOnly} value={a.action} onChange={(v) => setAction(i, 'action', v)} /></td>
                                <td className="px-2 py-1.5"><CellInput kind="text" readOnly={readOnly} value={a.responsible} onChange={(v) => setAction(i, 'responsible', v)} /></td>
                                <td className="px-2 py-1.5"><CellInput kind="date" readOnly={readOnly} value={a.deadline} onChange={(v) => setAction(i, 'deadline', v)} /></td>
                                {!readOnly && (
                                    <td className="px-1">
                                        <button type="button" aria-label={t('trackers.supervision.warmer.remove_action', 'Remove action')}
                                            className="p-1 text-gray-400 hover:text-red-600"
                                            onClick={() => onSet('actions', actions.filter((_, j) => j !== i))}>
                                            <X size={16} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!readOnly && (
                <Button variant="secondary" onClick={() => onSet('actions', [...actions, {}])}>
                    <Plus size={16} /> {t('trackers.supervision.warmer.add_action', 'Add action')}
                </Button>
            )}
        </div>
    );
}

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
            <div className="flex flex-wrap gap-2 text-sm">
                {chips.map((c) => <span key={c.id} className={`px-2 py-1 rounded ${toneFor(c.value)}`}>{c.label}: {pctText(c.value)}</span>)}
            </div>
        );
    }
    const score = scoreAssessment(checklist, form.responses);
    return (
        <div className="flex flex-wrap gap-2 text-sm">
            <span className={`px-2 py-1 rounded ${toneFor(score.completionPercent)}`}>
                {t('trackers.supervision.score.completed', 'completed {{pct}}', { pct: pctText(score.completionPercent) })}
            </span>
            <span className={`px-2 py-1 rounded ${toneFor(score.presencePercent)}`}>
                {t('trackers.supervision.score.present', 'present {{pct}}', { pct: pctText(score.presencePercent) })}
            </span>
            <span className="px-2 py-1 rounded bg-slate-100 text-slate-600">
                {t('trackers.supervision.score.items_answered', '{{answered}} of {{total}} items answered', { answered: score.answered, total: score.total })}
            </span>
        </div>
    );
}

// What the list and the dashboard read without re-scoring every record.
function buildSummary(checklist, form) {
    if (checklist.id === 'infant_warmer') {
        const r = warmerResults(form.responses, form.periodStart);
        return {
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

function AssessmentForm({ checklist, initial, onBack, onSaved, canEdit }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    useLeaveGuard(canEdit);
    const back = () => leaveForm(onBack);
    useInPageBack(back);
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
    const [activeSection, setActiveSection] = useState(checklist.sections[0].id);

    const readOnly = !canEdit;
    const isHospital = checklist.scope === 'hospital';

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
            });
            await upsertSupervisionAssessment(payload);
            notify(status === 'submitted' ? t('trackers.supervision.form.submitted', 'Assessment submitted.') : t('trackers.supervision.form.draft_saved', 'Draft saved.'), 'success');
            formSaved();
            onSaved();
            if (status === 'submitted') onBack();
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

    const section = checklist.sections.find((s) => s.id === activeSection);
    const sectionValues = form.responses?.[section?.id] || {};
    const onSectionChange = (itemId, value) => setResponse(section.id, itemId, value);

    const renderSection = () => {
        if (!section) return null;
        const shared = { section, values: sectionValues, onChange: onSectionChange, readOnly };
        switch (section.type) {
            case 'grid': return <GridEditor {...shared} />;
            case 'monthly': return <MonthlyEditor {...shared} periodStart={form.periodStart} responses={form.responses || {}} />;
            case 'cascade': return <CascadeEditor {...shared} periodStart={form.periodStart} responses={form.responses || {}} />;
            case 'findings': return <FindingsEditor section={section} values={sectionValues} onSet={onSectionChange} readOnly={readOnly} />;
            default: return RESPONSE_TYPES[section.type] ? <SectionEditor {...shared} /> : null;
        }
    };

    return (
        <div className="space-y-4">
            {(!IS_NATIVE || canEdit) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
                {!IS_NATIVE && (
                <Button variant="secondary" onClick={back}>
                    <ArrowLeft size={16} /> {t('trackers.supervision.form.back', 'Back to assessments')}
                </Button>
                )}
                {canEdit && (
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => save('draft')} disabled={saving}>
                            <Save size={16} /> {t('trackers.supervision.form.save_draft', 'Save draft')}
                        </Button>
                        <Button onClick={() => save('submitted')} disabled={saving}>
                            {t('trackers.supervision.form.submit', 'Submit assessment')}
                        </Button>
                    </div>
                )}
            </div>
            )}

            <Card>
                <CardBody className="space-y-4">
                    <h3 className="font-semibold text-slate-800">{isArabic ? checklist.titleAr : t(`trackers.supervision.checklists.${checklist.id}`, checklist.title)}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <Select label={t('trackers.supervision.state', 'State')} value={form.stateKey} disabled={readOnly}
                            onChange={(e) => setForm((p) => ({ ...p, stateKey: e.target.value, localityKey: '' }))}>
                            <option value="">{t('trackers.supervision.select', 'Select…')}</option>
                            {Object.keys(STATE_LOCALITIES).filter((k) => k !== 'Federal')
                                .map((k) => <option key={k} value={k}>{isArabic ? STATE_LOCALITIES[k].ar || STATE_LOCALITIES[k].en : STATE_LOCALITIES[k].en}</option>)}
                        </Select>
                        <Select label={t('trackers.supervision.locality', 'Locality')} value={form.localityKey} disabled={readOnly || !form.stateKey}
                            onChange={(e) => setField('localityKey', e.target.value)}>
                            <option value="">{t('trackers.supervision.select', 'Select…')}</option>
                            {(STATE_LOCALITIES[form.stateKey]?.localities || [])
                                .map((l) => <option key={l.en} value={l.en}>{isArabic ? l.ar || l.en : l.en}</option>)}
                        </Select>
                        <Input label={isHospital ? t('trackers.supervision.form.hospital_name', 'Hospital name') : t('trackers.supervision.form.facility_name', 'Facility name')}
                            value={form.facilityName} disabled={readOnly}
                            onChange={(e) => setField('facilityName', e.target.value)} />
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
                    </div>
                    <Input label={isHospital ? t('trackers.supervision.form.assessor', 'Assessor name') : t('trackers.supervision.form.supervisors', 'Supervisor name(s)')}
                        value={form.assessorName || ''} disabled={readOnly}
                        onChange={(e) => setField('assessorName', e.target.value)} />

                    <ScoreChips checklist={checklist} form={form} />
                </CardBody>
            </Card>

            <Card>
                <CardBody className="space-y-4">
                    <div className="overflow-x-auto">
                        <Tabs
                            tabs={checklist.sections.map((s, i) => ({
                                id: s.id,
                                label: s.titleAr && isArabic ? s.titleAr : t(`trackers.supervision.sections.${s.id}`, s.title),
                                short: String(i + 1),
                            }))}
                            activeTab={activeSection}
                            onTabChange={setActiveSection}
                        />
                    </div>
                    {renderSection()}
                </CardBody>
            </Card>
        </div>
    );
}

// =============================================================================
// Service selection — the same first step as skills mentorship
// =============================================================================

const SERVICE_ICONS = { SSNC: Baby, IMNCI: Stethoscope, EENC: HeartPulse, ETAT: Siren, IPC: ShieldCheck };

function ServiceSelector({ onSelect }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    return (
        <div className="space-y-4">
            <PageHeader
                title={t('trackers.supervision.title', 'Supervision')}
                subtitle={t('trackers.supervision.choose_service', 'Choose the service to supervise')}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SUPERVISION_SERVICES.map((s) => {
                    const forms = checklistsForService(s.key);
                    const enabled = forms.length > 0;
                    const Icon = SERVICE_ICONS[s.key] || Baby;
                    return (
                        <button key={s.key} type="button" disabled={!enabled} onClick={() => onSelect(s.key)}
                            className={`group text-start rounded-xl border bg-white p-4 flex items-start gap-3 transition-colors ${enabled ? 'border-slate-200 hover:border-sky-400 hover:bg-sky-50' : 'border-slate-200 opacity-60 cursor-not-allowed'}`}>
                            <span className={`shrink-0 rounded-lg p-2 ${enabled ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}><Icon size={22} /></span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-slate-800">{isArabic ? s.titleAr : s.title} <span className="text-slate-500 font-normal">({s.key})</span></span>
                                <span className="block text-xs text-slate-500 mt-1">
                                    {enabled
                                        ? forms.map((c) => pickLabel({ label: c.short, ar: c.shortAr }, isArabic)).join(' · ')
                                        : t('trackers.supervision.no_forms', 'No checklists yet')}
                                </span>
                            </span>
                            {enabled && <ChevronRight size={18} className="text-slate-400 group-hover:text-sky-600 rtl:rotate-180 mt-1" />}
                        </button>
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
    const [stateFilter, setStateFilter] = useState('all');
    const canEmptyBin = !!permissions.canUseFederalManagerAdvancedFeatures;

    useEffect(() => {
        if (!supervisionAssessments) fetchSupervisionAssessments(false);
    }, [supervisionAssessments, fetchSupervisionAssessments]);

    const reload = useCallback(() => fetchSupervisionAssessments('full'), [fetchSupervisionAssessments]);

    // Android app: the top-bar arrow steps back from a service to the service list.
    useInPageBack(() => setService(null), !!service && editing === null);

    const serviceChecklists = useMemo(() => (service ? checklistsForService(service) : []), [service]);
    const checklist = getChecklist(checklistId) || serviceChecklists[0] || null;

    const serviceAssessments = useMemo(() => (supervisionAssessments || [])
        .filter((a) => a.isDeleted !== true && serviceOf(a) === service), [supervisionAssessments, service]);

    const rows = useMemo(() => serviceAssessments
        .filter((a) => a.checklistId === checklist?.id)
        .filter((a) => stateFilter === 'all' || a.stateKey === stateFilter)
        .sort((a, b) => String(b.assessmentDate || '').localeCompare(String(a.assessmentDate || ''))),
    [serviceAssessments, checklist, stateFilter]);

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

    if (!service) {
        return <ServiceSelector onSelect={(key) => { setService(key); setChecklistId(null); setTab(LIST_TAB); }} />;
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

    const serviceInfo = SUPERVISION_SERVICES.find((s) => s.key === service);
    const isWarmer = checklist?.id === 'infant_warmer';
    const headers = [
        t('trackers.supervision.table.date', 'Date'),
        isWarmer ? t('trackers.supervision.table.facility', 'Facility') : t('trackers.supervision.table.hospital', 'Hospital'),
        t('trackers.supervision.state', 'State'),
        t('trackers.supervision.table.status', 'Status'),
        ...(isWarmer
            ? [t('trackers.supervision.warmer.nest_functioning', 'Heating units functioning'), t('trackers.supervision.warmer.coverage', 'Coverage of portable warming')]
            : [t('trackers.supervision.table.completed', 'Completed'), t('trackers.supervision.table.present', 'Present')]),
        ...(canEdit ? [t('trackers.supervision.table.actions', 'Actions')] : []),
    ];
    const summaryCells = (row) => {
        const s = row.summary || {};
        if (isWarmer) {
            // Older drafts may predate the summary; work it out from the answers.
            const r = s.nestFunctioningPercent === undefined ? warmerResults(row.responses, row.periodStart) : null;
            const nest = r ? r.nestFunctioningPercent : s.nestFunctioningPercent;
            const coverage = r ? r.service.total.coverage : s.coveragePercent;
            return [
                <td key="a"><span className={`px-2 py-0.5 rounded text-xs ${toneFor(nest)}`}>{pctText(nest)}</span></td>,
                <td key="b"><span className={`px-2 py-0.5 rounded text-xs ${toneFor(coverage)}`}>{pctText(coverage)}</span></td>,
            ];
        }
        return [
            <td key="a" className="text-gray-600">{pctText(s.completionPercent)}</td>,
            <td key="b"><span className={`px-2 py-0.5 rounded text-xs ${toneFor(s.presencePercent)}`}>{pctText(s.presencePercent)}</span></td>,
        ];
    };

    return (
        <div className="space-y-4">
            {!IS_NATIVE && (
                <div>
                    <Button variant="secondary" onClick={() => setService(null)}>
                        <ArrowLeft size={16} /> {t('trackers.supervision.back_to_services', 'All services')}
                    </Button>
                </div>
            )}
            <PageHeader
                title={`${t('trackers.supervision.title', 'Supervision')} · ${isArabic ? serviceInfo?.titleAr : serviceInfo?.title}`}
                subtitle={t('trackers.supervision.subtitle', 'Facility assessment checklists by service')}
                actions={canEdit && tab === LIST_TAB && checklist ? (
                    <Button onClick={() => setEditing({ checklistId: checklist.id })}>
                        <Plus size={16} /> {t('trackers.supervision.new', 'New assessment')}
                    </Button>
                ) : null}
            />

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

                    {tab === DELETED_TAB && canEmptyBin ? (
                        <Suspense fallback={<Spinner />}>
                            <DeletedItemsPanel types={['supervisionAssessments']} />
                        </Suspense>
                    ) : (<>

                    <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('trackers.supervision.form_picker', 'Checklist')}>
                        {serviceChecklists.map((c) => {
                            const on = c.id === checklist?.id;
                            const count = serviceAssessments.filter((a) => a.checklistId === c.id).length;
                            return (
                                <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => setChecklistId(c.id)}
                                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}>
                                    {pickLabel({ label: c.short, ar: c.shortAr }, isArabic)}
                                    <span className={`ms-2 text-xs ${on ? 'text-slate-300' : 'text-slate-500'}`}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {tab === DASHBOARD_TAB ? (
                        isLoading?.supervisionAssessments && !supervisionAssessments ? <Spinner /> : (
                            <Suspense fallback={<Spinner />}>
                                <SupervisionDashboard
                                    checklist={checklist}
                                    assessments={serviceAssessments.filter((a) => a.checklistId === checklist?.id)}
                                />
                            </Suspense>
                        )
                    ) : (<>

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
                                    action={canEdit && checklist ? { label: t('trackers.supervision.new', 'New assessment'), onClick: () => setEditing({ checklistId: checklist.id }) } : undefined} />
                            ) : rows.map((row) => (
                                <tr key={row.id} onClick={canEdit ? undefined : () => setEditing(row)} className={canEdit ? '' : 'cursor-pointer'}>
                                    <td className="text-gray-600">{row.assessmentDate || '—'}</td>
                                    <td className="font-medium">{row.facilityName}</td>
                                    <td className="text-gray-600">
                                        {STATE_LOCALITIES[row.stateKey]?.en || row.stateKey}
                                    </td>
                                    <td>
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                            row.status === 'submitted'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-amber-100 text-amber-800'}`}>
                                            {row.status === 'submitted' ? t('trackers.supervision.status.submitted', 'Submitted') : t('trackers.supervision.status.draft', 'Draft')}
                                        </span>
                                    </td>
                                    {summaryCells(row)}
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
                    </>)}
                </CardBody>
            </Card>
        </div>
    );
}
