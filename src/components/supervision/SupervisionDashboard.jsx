// src/components/supervision/SupervisionDashboard.jsx
//
// Results of one supervision checklist across facilities. Each facility counts
// once, at its latest visit: a hospital supervised three times would otherwise
// weigh three times as much as one visited once. Every figure is worked out
// from the saved answers with the same functions the form uses
// (checklists.js), so the dashboard and the form can never disagree.

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardBody, Select, Checkbox, EmptyState, Table } from '../CommonComponents';
import { STATE_LOCALITIES } from '../constants';
import { coverageColor } from '../../utils/statusColors';
import {
    INFANT_WARMER_COMPONENTS, pickLabel, pctText, toneFor, ratio, toNum,
    scoreAssessment, scoreSection, warmerResults, monthLabel,
} from './checklists';

const fmt = (v) => (v == null ? '—' : Math.round(v).toLocaleString());

const sum = (values) => {
    const known = values.filter((v) => v != null);
    return known.length ? known.reduce((a, b) => a + b, 0) : null;
};

const mean = (values) => {
    const known = values.filter((v) => v != null);
    return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
};

// The registry id when the facility was picked from the list; otherwise the typed name.
const facilityKey = (a) => a.facilityId || `${a.stateKey || ''}|${String(a.facilityName || '').trim().toLowerCase()}`;

function latestPerFacility(assessments) {
    const latest = new Map();
    assessments.forEach((a) => {
        const key = facilityKey(a);
        const prev = latest.get(key);
        if (!prev || String(a.assessmentDate || '') > String(prev.assessmentDate || '')) latest.set(key, a);
    });
    return [...latest.values()].sort((a, b) => String(a.facilityName || '').localeCompare(String(b.facilityName || '')));
}

// -----------------------------------------------------------------------------
// Building blocks
// -----------------------------------------------------------------------------

function StatTile({ label, value, hint, tone }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone ? '' : 'text-slate-800'}`} style={tone ? { color: tone } : undefined}>{value}</div>
            {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
        </div>
    );
}

// One horizontal bar. Status colour (good / partial / poor) for a percentage
// against a target; neutral sky for a plain count, where higher is not better.
function BarRow({ label, percent, detail, neutral = false }) {
    const width = percent == null ? 0 : Math.max(0, Math.min(100, percent));
    const color = neutral ? '#0284c7' : coverageColor(percent);
    return (
        <div className="grid grid-cols-12 items-center gap-2 py-1" title={`${label}: ${detail || pctText(percent)}`}>
            <div className="col-span-12 sm:col-span-5 text-sm text-slate-700">{label}</div>
            <div className="col-span-8 sm:col-span-5 h-3 rounded bg-slate-100 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${width}%`, backgroundColor: color }} />
            </div>
            <div className="col-span-4 sm:col-span-2 text-sm text-end tabular-nums text-slate-700">{detail || pctText(percent)}</div>
        </div>
    );
}

function Panel({ title, children, note }) {
    return (
        <Card>
            <CardBody className="space-y-2">
                <h4 className="font-semibold text-slate-800">{title}</h4>
                {note && <p className="text-xs text-slate-500">{note}</p>}
                {children}
            </CardBody>
        </Card>
    );
}

const Chip = ({ value }) => <span className={`px-2 py-0.5 rounded text-xs ${toneFor(value)}`}>{pctText(value)}</span>;

const stateName = (key, isArabic) => (isArabic ? STATE_LOCALITIES[key]?.ar : STATE_LOCALITIES[key]?.en) || key || '—';

// -----------------------------------------------------------------------------
// Portable infant warmer
// -----------------------------------------------------------------------------

function WarmerDashboard({ checklist, records }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const sectionOf = (id) => checklist.sections.find((s) => s.id === id);

    const data = useMemo(() => {
        const results = records.map((a) => ({ a, r: warmerResults(a.responses, a.periodStart) }));

        const components = INFANT_WARMER_COMPONENTS.map((c) => {
            const pick = (field) => sum(results.map(({ r }) => r.components[c.id][field]));
            const distributed = pick('distributed');
            const functioning = pick('functioning');
            return { ...c, distributed, functioning, needsRepair: pick('needsRepair'), lost: pick('lost'), percent: ratio(functioning, distributed) };
        });

        const locations = ['in_labour', 'in_theatre', 'in_postnatal', 'in_neonatal', 'in_store'].map((id) => ({
            id, count: sum(results.map(({ r }) => r.components.nest.locations[id])),
        }));

        const yesRows = (sectionId) => sectionOf(sectionId).items.filter((i) => !i.answerKind).map((item) => {
            let yes = 0;
            let answered = 0;
            records.forEach((a) => {
                const v = a.responses?.[sectionId]?.[item.id]?.answer;
                if (v === true || v === false) { answered += 1; if (v) yes += 1; }
            });
            return { item, yes, answered, percent: ratio(yes, answered) };
        });
        const practices = yesRows('use_practices');
        const infoSystem = yesRows('information_system');

        const equipment = sectionOf('thermal_equipment').items.map((item) => {
            const total = sum(records.map((a) => toNum(a.responses?.thermal_equipment?.[item.id]?.total)));
            const functioning = sum(records.map((a) => toNum(a.responses?.thermal_equipment?.[item.id]?.functioning)));
            return { item, total, functioning, percent: ratio(functioning, total) };
        });

        const need = sum(results.map(({ r }) => r.service.total.need));
        const placed = sum(results.map(({ r }) => r.service.total.placed));
        const cascade = ['need', 'received', 'registered', 'dhis2'].map((id) => ({
            id, value: sum(results.map(({ r }) => r.cascade.totals[id])),
        }));
        const c = Object.fromEntries(cascade.map((x) => [x.id, x.value]));

        const yesTotal = (rows) => ratio(sum(rows.map((x) => x.yes)), sum(rows.map((x) => x.answered)));

        return {
            results, components, locations, practices, infoSystem, equipment, cascade,
            staffTrained: sum(results.map(({ r }) => r.staffTrained)),
            kpi: {
                nest: components[0].percent,
                coverage: ratio(placed, need),
                need, placed,
                registration: ratio(c.registered, c.received),
                dhis2: ratio(c.dhis2, c.registered),
                practices: yesTotal(practices),
                info: yesTotal(infoSystem),
            },
            actions: results.flatMap(({ a }) => (a.responses?.findings?.actions || [])
                .filter((x) => x?.action?.trim())
                .map((x) => ({ ...x, facility: a.facilityName, state: a.stateKey }))),
        };
    // sectionOf reads the static checklist definition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [records, checklist]);

    const { kpi } = data;
    const periods = [...new Set(records.map((a) => a.periodStart).filter(Boolean))].sort();
    const locationLabel = Object.fromEntries(sectionOf('devices').items.map((i) => [i.id, pickLabel(i, isArabic)]));
    const nestDistributed = data.components[0].distributed;

    const cascadeLabels = Object.fromEntries(sectionOf('reporting_cascade').columns.map((c) => [c.id, pickLabel(c, isArabic)]));
    const cascadeBase = data.cascade[0].value;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <StatTile label={t('trackers.supervision.dash.facilities', 'Facilities supervised')} value={records.length}
                    hint={periods.length ? periods.map((p) => monthLabel(p, isArabic)).join(', ') : undefined} />
                <StatTile label={t('trackers.supervision.warmer.nest_functioning', 'Heating units functioning')} value={pctText(kpi.nest)} tone={coverageColor(kpi.nest)}
                    hint={t('trackers.supervision.dash.of_distributed', '{{n}} of {{d}} distributed', { n: fmt(data.components[0].functioning), d: fmt(nestDistributed) })} />
                <StatTile label={t('trackers.supervision.warmer.coverage', 'Coverage of portable warming')} value={pctText(kpi.coverage)} tone={coverageColor(kpi.coverage)}
                    hint={t('trackers.supervision.dash.placed_of_need', '{{n}} placed of {{d}} needing', { n: fmt(kpi.placed), d: fmt(kpi.need) })} />
                <StatTile label={t('trackers.supervision.warmer.practices', 'Good use practices')} value={pctText(kpi.practices)} tone={coverageColor(kpi.practices)} />
                <StatTile label={t('trackers.supervision.warmer.registration', 'Registration completeness')} value={pctText(kpi.registration)} tone={coverageColor(kpi.registration)} />
                <StatTile label={t('trackers.supervision.warmer.dhis2', 'DHIS2 reporting completeness')} value={pctText(kpi.dhis2)} tone={coverageColor(kpi.dhis2)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title={t('trackers.supervision.dash.devices', 'Portable warmer devices')}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-slate-500">
                                <tr>
                                    <th className="text-start py-1">{t('trackers.supervision.dash.component', 'Component')}</th>
                                    <th className="text-end py-1">{t('trackers.supervision.dash.distributed', 'Distributed')}</th>
                                    <th className="text-end py-1">{t('trackers.supervision.dash.functioning', 'Functioning')}</th>
                                    <th className="text-end py-1">{t('trackers.supervision.dash.repair', 'Need repair')}</th>
                                    <th className="text-end py-1">{t('trackers.supervision.dash.lost', 'Lost')}</th>
                                    <th className="text-end py-1">%</th>
                                </tr>
                            </thead>
                            <tbody className="tabular-nums">
                                {data.components.map((c) => (
                                    <tr key={c.id} className="border-t">
                                        <td className="py-1.5 text-slate-700">{pickLabel(c, isArabic)}</td>
                                        <td className="py-1.5 text-end">{fmt(c.distributed)}</td>
                                        <td className="py-1.5 text-end">{fmt(c.functioning)}</td>
                                        <td className="py-1.5 text-end">{fmt(c.needsRepair)}</td>
                                        <td className="py-1.5 text-end">{fmt(c.lost)}</td>
                                        <td className="py-1.5 text-end"><Chip value={c.percent} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel title={t('trackers.supervision.dash.locations', 'Where the heating units are')}
                    note={t('trackers.supervision.dash.locations_note', 'Share of the heating units distributed.')}>
                    {data.locations.map((l) => (
                        <BarRow key={l.id} neutral label={locationLabel[l.id]} percent={ratio(l.count, nestDistributed)}
                            detail={l.count == null ? '—' : `${fmt(l.count)} · ${pctText(ratio(l.count, nestDistributed))}`} />
                    ))}
                </Panel>

                <Panel title={t('trackers.supervision.warmer.practices', 'Good use practices')}
                    note={t('trackers.supervision.dash.yes_share', 'Share of facilities answering yes. Staff trained: {{n}}.', { n: fmt(data.staffTrained) })}>
                    {data.practices.map((p) => (
                        <BarRow key={p.item.id} label={pickLabel(p.item, isArabic)} percent={p.percent}
                            detail={p.answered ? `${p.yes}/${p.answered} · ${pctText(p.percent)}` : '—'} />
                    ))}
                </Panel>

                <Panel title={t('trackers.supervision.warmer.info_system', 'Information system')}
                    note={t('trackers.supervision.dash.yes_share_plain', 'Share of facilities answering yes.')}>
                    {data.infoSystem.map((p) => (
                        <BarRow key={p.item.id} label={pickLabel(p.item, isArabic)} percent={p.percent}
                            detail={p.answered ? `${p.yes}/${p.answered} · ${pctText(p.percent)}` : '—'} />
                    ))}
                </Panel>

                <Panel title={t('trackers.supervision.dash.cascade', 'Reporting cascade')}
                    note={t('trackers.supervision.dash.cascade_note', 'January to the end of each facility\'s reporting quarter, as a share of the estimated need.')}>
                    {data.cascade.map((s) => (
                        <BarRow key={s.id} neutral label={cascadeLabels[s.id]} percent={ratio(s.value, cascadeBase)}
                            detail={s.value == null ? '—' : `${fmt(s.value)}${s.id === 'need' ? '' : ` · ${pctText(ratio(s.value, cascadeBase))}`}`} />
                    ))}
                </Panel>

                <Panel title={t('trackers.supervision.dash.thermal', 'Other thermal care equipment')}
                    note={t('trackers.supervision.dash.thermal_note', 'Functioning out of the total counted.')}>
                    {data.equipment.map((e) => (
                        <BarRow key={e.item.id} label={pickLabel(e.item, isArabic)} percent={e.percent}
                            detail={e.total == null ? '—' : `${fmt(e.functioning)}/${fmt(e.total)}`} />
                    ))}
                </Panel>
            </div>

            <Panel title={t('trackers.supervision.dash.by_facility', 'By facility')}>
                <Table headers={[
                    t('trackers.supervision.table.facility', 'Facility'), t('trackers.supervision.state', 'State'), t('trackers.supervision.table.date', 'Date'),
                    t('trackers.supervision.warmer.nest_functioning', 'Heating units functioning'), t('trackers.supervision.warmer.practices', 'Good use practices'),
                    t('trackers.supervision.warmer.coverage', 'Coverage of portable warming'), t('trackers.supervision.warmer.registration', 'Registration completeness'),
                    t('trackers.supervision.warmer.dhis2', 'DHIS2 reporting completeness'),
                ]} cardsOnPhone>
                    {data.results.map(({ a, r }) => (
                        <tr key={a.id}>
                            <td className="font-medium">{a.facilityName}</td>
                            <td className="text-gray-600">{stateName(a.stateKey, isArabic)}</td>
                            <td className="text-gray-600">{a.assessmentDate || '—'}</td>
                            <td><Chip value={r.nestFunctioningPercent} /></td>
                            <td><Chip value={r.practices.percent} /></td>
                            <td><Chip value={r.service.total.coverage} /></td>
                            <td><Chip value={r.cascade.registration} /></td>
                            <td><Chip value={r.cascade.dhis2} /></td>
                        </tr>
                    ))}
                </Table>
            </Panel>

            {data.actions.length > 0 && (
                <Panel title={t('trackers.supervision.dash.actions', 'Action points')}>
                    <Table headers={[
                        t('trackers.supervision.table.facility', 'Facility'), t('trackers.supervision.warmer.action', 'Action'),
                        t('trackers.supervision.warmer.responsible', 'Responsible'), t('trackers.supervision.warmer.deadline', 'Deadline'),
                    ]} cardsOnPhone>
                        {data.actions.map((x, i) => (
                            <tr key={i}>
                                <td className="font-medium">{x.facility}</td>
                                <td>{x.action}</td>
                                <td className="text-gray-600">{x.responsible || '—'}</td>
                                <td className="text-gray-600">{x.deadline || '—'}</td>
                            </tr>
                        ))}
                    </Table>
                </Panel>
            )}
        </div>
    );
}

// -----------------------------------------------------------------------------
// NICU Centre of Excellence (and any checklist scored by presence)
// -----------------------------------------------------------------------------

function PresenceDashboard({ checklist, records }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const scored = checklist.sections.filter((s) => scoreSection(s, {}) !== null);
    const standardSections = scored.filter((s) => s.type === 'standard_available_need');

    const data = useMemo(() => {
        const results = records.map((a) => ({ a, s: scoreAssessment(checklist, a.responses) }));
        const sections = scored.map((section) => ({
            section,
            presence: mean(results.map(({ s }) => s.sections[section.id]?.presencePercent)),
            adequacy: mean(results.map(({ s }) => s.sections[section.id]?.adequacyPercent)),
        }));

        // Items most often missing: answered "no" or a count of zero.
        const missing = [];
        scored.forEach((section) => {
            section.items.forEach((item) => {
                let answered = 0;
                let absent = 0;
                records.forEach((a) => {
                    const r = a.responses?.[section.id]?.[item.id] || {};
                    if (section.type === 'yesno' || section.type.startsWith('present_')) {
                        const v = section.type === 'yesno' ? r.available : r.present;
                        if (v === true || v === false) { answered += 1; if (!v) absent += 1; }
                    } else {
                        const n = toNum(r.available);
                        if (n != null) { answered += 1; if (n <= 0) absent += 1; }
                    }
                });
                if (absent > 0) missing.push({ section, item, answered, absent, percent: ratio(absent, answered) });
            });
        });
        missing.sort((x, y) => y.percent - x.percent || y.absent - x.absent);

        return {
            results, sections, missing: missing.slice(0, 12),
            completion: mean(results.map(({ s }) => s.completionPercent)),
            presence: mean(results.map(({ s }) => s.presencePercent)),
        };
    // scored is derived from the static checklist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [records, checklist]);

    const sectionTitle = (s) => (isArabic ? s.titleAr : t(`trackers.supervision.sections.${s.id}`, s.title));
    const itemLabel = (item) => t(`trackers.supervision.items.${item.id.replace(/^l[23]_/, '')}`, item.label);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatTile label={t('trackers.supervision.dash.facilities', 'Facilities supervised')} value={records.length} />
                <StatTile label={t('trackers.supervision.dash.avg_present', 'Average present')} value={pctText(data.presence)} tone={coverageColor(data.presence)} />
                <StatTile label={t('trackers.supervision.dash.avg_completed', 'Average completed')} value={pctText(data.completion)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title={t('trackers.supervision.dash.by_section', 'Present, by section')}
                    note={t('trackers.supervision.dash.by_section_note', 'Average across facilities of the share of items present.')}>
                    {data.sections.map((x) => (
                        <BarRow key={x.section.id} label={sectionTitle(x.section)} percent={x.presence} />
                    ))}
                    {standardSections.length > 0 && data.sections.filter((x) => x.adequacy != null).map((x) => (
                        <BarRow key={`${x.section.id}-std`}
                            label={`${sectionTitle(x.section)} · ${t('trackers.supervision.dash.vs_standard', 'vs standard')}`}
                            percent={x.adequacy} />
                    ))}
                </Panel>

                <Panel title={t('trackers.supervision.dash.missing', 'Most often missing')}
                    note={t('trackers.supervision.dash.missing_note', 'Facilities answering no, or counting none.')}>
                    {data.missing.length === 0 ? (
                        <p className="text-sm text-slate-500">{t('trackers.supervision.dash.none_missing', 'Nothing reported missing.')}</p>
                    ) : data.missing.map((m) => (
                        <BarRow key={`${m.section.id}-${m.item.id}`} label={`${itemLabel(m.item)} (${sectionTitle(m.section)})`}
                            percent={100 - m.percent}
                            detail={t('trackers.supervision.dash.missing_count', '{{n}} of {{d}} missing', { n: m.absent, d: m.answered })} />
                    ))}
                </Panel>
            </div>

            <Panel title={t('trackers.supervision.dash.by_facility', 'By facility')}>
                <Table headers={[
                    t('trackers.supervision.table.hospital', 'Hospital'), t('trackers.supervision.state', 'State'), t('trackers.supervision.table.date', 'Date'),
                    t('trackers.supervision.table.completed', 'Completed'), t('trackers.supervision.table.present', 'Present'),
                    ...standardSections.map((s) => `${sectionTitle(s)} · ${t('trackers.supervision.dash.vs_standard', 'vs standard')}`),
                ]} cardsOnPhone>
                    {data.results.map(({ a, s }) => (
                        <tr key={a.id}>
                            <td className="font-medium">{a.facilityName}</td>
                            <td className="text-gray-600">{stateName(a.stateKey, isArabic)}</td>
                            <td className="text-gray-600">{a.assessmentDate || '—'}</td>
                            <td className="text-gray-600">{pctText(s.completionPercent)}</td>
                            <td><Chip value={s.presencePercent} /></td>
                            {standardSections.map((sec) => <td key={sec.id}><Chip value={s.sections[sec.id]?.adequacyPercent} /></td>)}
                        </tr>
                    ))}
                </Table>
            </Panel>
        </div>
    );
}

// -----------------------------------------------------------------------------

export default function SupervisionDashboard({ checklist, assessments = [] }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [stateFilter, setStateFilter] = useState('all');
    const [includeDrafts, setIncludeDrafts] = useState(false);

    const drafts = assessments.filter((a) => a.status !== 'submitted').length;
    const records = useMemo(() => latestPerFacility(assessments
        .filter((a) => includeDrafts || a.status === 'submitted')
        .filter((a) => stateFilter === 'all' || a.stateKey === stateFilter)),
    [assessments, includeDrafts, stateFilter]);

    if (!checklist) return null;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
                <div className="w-full md:w-56">
                    <Select label={t('trackers.supervision.state', 'State')} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                        <option value="all">{t('trackers.supervision.all_states', 'All states')}</option>
                        {Object.keys(STATE_LOCALITIES).filter((k) => k !== 'Federal')
                            .map((k) => <option key={k} value={k}>{stateName(k, isArabic)}</option>)}
                    </Select>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                    <Checkbox checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} />
                    {t('trackers.supervision.dash.include_drafts', 'Include drafts ({{n}})', { n: drafts })}
                </label>
                <p className="text-xs text-slate-500 pb-2">{t('trackers.supervision.dash.latest_note', 'Each facility counts once, at its latest visit.')}</p>
            </div>

            {records.length === 0 ? (
                <EmptyState
                    filtered={stateFilter !== 'all'}
                    onClearFilters={stateFilter !== 'all' ? () => setStateFilter('all') : undefined}
                    message={drafts && !includeDrafts
                        ? t('trackers.supervision.dash.only_drafts', 'No submitted assessments yet. Tick Include drafts to see the drafts.')
                        : t('trackers.supervision.dash.empty', 'No assessments to show yet.')} />
            ) : checklist.id === 'infant_warmer'
                ? <WarmerDashboard checklist={checklist} records={records} />
                : <PresenceDashboard checklist={checklist} records={records} />}
        </div>
    );
}
