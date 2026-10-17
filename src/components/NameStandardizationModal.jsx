// NameStandardizationModal.jsx
//
// Manages the standard project and organization names, and the names already
// recorded on facilities. Nothing changes unless it is chosen here: each
// official name can be renamed, merged into another or deleted, and each
// recorded spelling not yet in the list can be mapped to an official name,
// made official, cleared, or left as it is. Suggestions are shown but only
// applied when clicked.
import React, { useEffect, useMemo, useState } from 'react';
import { writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { saveFacilitySnapshot } from '../data.js';
import { useAuth } from '../hooks/useAuth';
import { useStandardNames, updateNameRegistry } from '../hooks/useNameRegistry';
import {
    groupVariants, findSimilarNames, normalizeKey, tidyName, planStandardization, activeEntries,
} from '../utils/nameRegistry';
import { Modal, Button } from './CommonComponents';
import { useTranslation } from 'react-i18next';

const KINDS = [
    { kind: 'projects', field: 'project_name', label: 'Projects (اسم المشروع)', singular: 'project' },
    { kind: 'organizations', field: 'staff_incentives_organization', label: 'Organizations (المنظمة المقدمة للحوافز)', singular: 'organization' },
];

// Each facility update writes the facility and a history snapshot: two of a
// batch's 500 operations.
const FACILITIES_PER_BATCH = 200;

const selectClass = 'border border-gray-300 rounded-md p-1.5 text-sm bg-white';
const inputClass = 'border border-gray-300 rounded-md p-1.5 text-sm';

export default function NameStandardizationModal({ isOpen, onClose, facilities = [], onComplete, setToast }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [kindIdx, setKindIdx] = useState(0);
    const { kind, field, singular } = KINDS[kindIdx];
    const { allEntries } = useStandardNames(kind);
    const kindWord = t(`admin_pages.name_standardization.plural.${kind}`, kind);
    const singularWord = t(`admin_pages.name_standardization.singular.${kind}`, singular);

    // The choices. Reset when switching between projects and organizations.
    const [newNames, setNewNames] = useState([]);
    const [newNameInput, setNewNameInput] = useState('');
    const [officialActions, setOfficialActions] = useState({});
    const [removedAliases, setRemovedAliases] = useState({});
    const [groupActions, setGroupActions] = useState({});
    const [excludedSpellings, setExcludedSpellings] = useState({});
    const [updateRecords, setUpdateRecords] = useState(true);
    const [saving, setSaving] = useState(null); // { done, total }

    useEffect(() => {
        setNewNames([]); setNewNameInput(''); setOfficialActions({}); setRemovedAliases({});
        setGroupActions({}); setExcludedSpellings({});
    }, [kind]);

    // Spellings recorded on facilities, with how many facilities use each.
    const counts = useMemo(() => {
        const map = new Map();
        (facilities || []).forEach((f) => {
            const raw = f?.[field];
            if (typeof raw !== 'string' || !tidyName(raw)) return;
            map.set(raw, (map.get(raw) || 0) + 1);
        });
        return map;
    }, [facilities, field]);

    const entries = useMemo(
        () => [...allEntries, ...newNames.map((name) => ({ name, aliases: [] }))],
        [allEntries, newNames],
    );
    const official = useMemo(() => activeEntries(entries), [entries]);
    const officialNames = useMemo(() => official.map((e) => e.name), [official]);

    // Which recorded spellings each official name already covers.
    const officialRows = useMemo(() => official.map((e) => {
        const keys = new Set([e.name, ...(e.aliases || [])].map(normalizeKey));
        const spellings = [...counts.entries()]
            .filter(([raw]) => keys.has(normalizeKey(raw)))
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count);
        return { entry: e, spellings, total: spellings.reduce((s, v) => s + v.count, 0) };
    }).sort((a, b) => b.total - a.total || a.entry.name.localeCompare(b.entry.name)), [official, counts]);

    // Recorded spellings no official name covers, grouped when they look alike.
    const unmappedGroups = useMemo(() => {
        const known = new Set(entries.flatMap((e) => [e.name, ...(e.aliases || [])]).map(normalizeKey));
        const values = [...counts.entries()]
            .filter(([raw]) => !known.has(normalizeKey(raw)))
            .map(([value, count]) => ({ value, count }));
        return groupVariants(values).map((g, i) => {
            const close = findSimilarNames(g.suggested, officialNames)[0];
            return {
                id: `${kind}-${i}-${g.suggested}`,
                ...g,
                suggestion: close ? { type: 'map', to: close.name } : { type: 'official', to: g.suggested },
            };
        });
    }, [entries, counts, officialNames, kind]);

    // Official names to map onto: the list, plus names being made official in this save.
    const mapTargets = useMemo(() => [...new Set([
        ...officialNames,
        ...Object.values(groupActions).filter((a) => a?.type === 'official' && tidyName(a.to)).map((a) => tidyName(a.to)),
    ])].sort((a, b) => a.localeCompare(b)), [officialNames, groupActions]);

    const spellingActions = useMemo(() => {
        const out = {};
        unmappedGroups.forEach((g) => {
            const action = groupActions[g.id];
            if (!action || action.type === 'leave') return;
            g.variants.forEach((v) => {
                if (!excludedSpellings[`${g.id}::${v.value}`]) out[v.value] = action;
            });
        });
        return out;
    }, [unmappedGroups, groupActions, excludedSpellings]);

    const plan = useMemo(() => planStandardization({
        entries,
        values: [...counts.keys()],
        officialActions,
        removedAliases,
        spellingActions,
    }), [entries, counts, officialActions, removedAliases, spellingActions]);

    const changedFacilities = useMemo(() => {
        const map = new Map(plan.rewrites.map((r) => [r.from, r.to]));
        return (facilities || []).filter((f) => map.has(f?.[field]));
    }, [plan, facilities, field]);

    const summary = useMemo(() => {
        const acts = Object.values(officialActions).filter((a) => a && a.type !== 'keep');
        return {
            renamed: acts.filter((a) => a.type === 'rename' && tidyName(a.to)).length,
            merged: acts.filter((a) => a.type === 'merge' && a.to).length,
            deleted: acts.filter((a) => a.type === 'delete').length,
            mapped: Object.keys(spellingActions).length,
            added: newNames.length,
            detached: Object.values(removedAliases).reduce((s, list) => s + list.length, 0),
        };
    }, [officialActions, spellingActions, newNames, removedAliases]);
    const hasChanges = Object.values(summary).some(Boolean) || plan.rewrites.length > 0;

    const setOfficial = (name, action) => setOfficialActions((prev) => ({ ...prev, [name]: action }));
    const setGroup = (id, action) => setGroupActions((prev) => ({ ...prev, [id]: action }));

    const addNewName = () => {
        const name = tidyName(newNameInput);
        if (!name) return;
        if (official.some((e) => normalizeKey(e.name) === normalizeKey(name))) {
            setToast?.({ show: true, type: 'info', message: t('admin_pages.name_standardization.already_official', '"{{name}}" is already an official {{singular}}.', { name, singular: singularWord }) });
            return;
        }
        setNewNames((prev) => [...prev, name]);
        setNewNameInput('');
    };

    const handleSave = async () => {
        const who = user?.displayName ? `${user.displayName} (${user.email})` : (user?.email || 'Unknown');
        try {
            setSaving({ done: 0, total: updateRecords ? changedFacilities.length : 0 });
            await updateNameRegistry(kind, plan.entries, who);

            if (updateRecords && changedFacilities.length) {
                const map = new Map(plan.rewrites.map((r) => [r.from, r.to]));
                const today = new Date().toISOString().split('T')[0];
                for (let i = 0; i < changedFacilities.length; i += FACILITIES_PER_BATCH) {
                    const chunk = changedFacilities.slice(i, i + FACILITIES_PER_BATCH);
                    const batch = writeBatch(db);
                    await Promise.all(chunk.map((f) => saveFacilitySnapshot({
                        ...f,
                        [field]: map.get(f[field]),
                        date_of_visit: today,
                        updated_by: `Names standardized by ${who}`,
                    }, batch)));
                    await batch.commit();
                    setSaving({ done: Math.min(i + chunk.length, changedFacilities.length), total: changedFacilities.length });
                }
            }
            setToast?.({ show: true, type: 'success', message: updateRecords ? t('admin_pages.name_standardization.saved_with_records', 'Standard {{kind}} saved; {{count}} facility record(s) updated.', { kind: kindWord, count: changedFacilities.length }) : t('admin_pages.name_standardization.saved', 'Standard {{kind}} saved.', { kind: kindWord }) });
            onComplete?.();
        } catch (e) {
            console.error('Name standardization failed', e);
            setToast?.({ show: true, type: 'error', message: t('admin_pages.name_standardization.save_failed', 'Could not save: {{message}}', { message: e.message }) });
        } finally {
            setSaving(null);
        }
    };

    const busy = !!saving;

    return (
        <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title={t('admin_pages.name_standardization.title', 'Standardize project & organization names')}>
            <div className="p-4 space-y-5" dir="ltr">
                <div className="flex flex-wrap gap-2">
                    {KINDS.map((k, i) => (
                        <Button key={k.kind} variant="tab" isActive={i === kindIdx} onClick={() => setKindIdx(i)} disabled={busy}>{t(`admin_pages.name_standardization.kinds.${k.kind}`, k.label)}</Button>
                    ))}
                </div>

                <p className="text-sm text-gray-600">
                    {t('admin_pages.name_standardization.intro', 'Nothing changes until you choose it below and press Save. Official names are the ones offered in every form; dashboards and filters (including mentorship) show them. Past mentorship visits keep the project recorded at the time; renamed or merged names are shown under the new name.')}
                </p>

                {/* --- Official names --- */}
                <section>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h4 className="font-bold text-gray-800">{t('admin_pages.name_standardization.official_heading', 'Official {{kind}} ({{count}})', { kind: kindWord, count: official.length })}</h4>
                        <div className="flex gap-2">
                            <input value={newNameInput} onChange={(e) => setNewNameInput(e.target.value)} disabled={busy}
                                onKeyDown={(e) => { if (e.key === 'Enter') addNewName(); }}
                                placeholder={t('admin_pages.name_standardization.new_official_placeholder', 'New official {{singular}}', { singular: singularWord })} className={inputClass} dir="auto" />
                            <Button variant="secondary" onClick={addNewName} disabled={busy || !tidyName(newNameInput)}>{t('admin_pages.name_standardization.add', 'Add')}</Button>
                        </div>
                    </div>
                    {officialRows.length === 0 ? (
                        <div className="p-4 text-sm text-center text-gray-500 bg-gray-50 rounded">{t('admin_pages.name_standardization.no_official', 'No official {{kind}} yet. Add one, or make one from the recorded spellings below.', { kind: kindWord })}</div>
                    ) : (
                        <div className="max-h-[32vh] overflow-y-auto space-y-2 pe-1">
                            {officialRows.map(({ entry, spellings, total }) => {
                                const action = officialActions[entry.name] || { type: 'keep' };
                                const detached = removedAliases[entry.name] || [];
                                const isNew = newNames.includes(entry.name);
                                return (
                                    <div key={entry.name} className={`border rounded-lg p-3 ${action.type === 'delete' ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`font-semibold ${action.type === 'delete' ? 'line-through text-red-700' : 'text-gray-900'}`} dir="auto">{entry.name}</span>
                                            {isNew && <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">{t('admin_pages.name_standardization.new_badge', 'new')}</span>}
                                            <span className="text-xs text-gray-500">{(total === 1 ? t('admin_pages.name_standardization.one_facility', '1 facility') : t('admin_pages.name_standardization.n_facilities', '{{count}} facilities', { count: total }))}</span>
                                            <div className="ms-auto flex flex-wrap items-center gap-2">
                                                {isNew ? (
                                                    <Button variant="secondary" onClick={() => setNewNames((prev) => prev.filter((n) => n !== entry.name))} disabled={busy}>{t('admin_pages.name_standardization.remove', 'Remove')}</Button>
                                                ) : (
                                                    <select className={selectClass} value={action.type} disabled={busy}
                                                        onChange={(e) => setOfficial(entry.name, { type: e.target.value, to: e.target.value === 'rename' ? entry.name : '' })}>
                                                        <option value="keep">{t('admin_pages.name_standardization.actions.keep', 'Keep')}</option>
                                                        <option value="rename">{t('admin_pages.name_standardization.actions.rename', 'Rename…')}</option>
                                                        <option value="merge">{t('admin_pages.name_standardization.actions.merge', 'Merge into…')}</option>
                                                        <option value="delete">{t('admin_pages.name_standardization.actions.delete', 'Delete')}</option>
                                                    </select>
                                                )}
                                                {action.type === 'rename' && (
                                                    <input className={inputClass} value={action.to} disabled={busy} dir="auto"
                                                        onChange={(e) => setOfficial(entry.name, { type: 'rename', to: e.target.value })} />
                                                )}
                                                {action.type === 'merge' && (
                                                    <select className={selectClass} value={action.to} disabled={busy}
                                                        onChange={(e) => setOfficial(entry.name, { type: 'merge', to: e.target.value })}>
                                                        <option value="">{t('admin_pages.name_standardization.choose', '— choose —')}</option>
                                                        {officialNames.filter((n) => n !== entry.name).map((n) => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                        {action.type === 'delete' && (
                                            <p className="text-xs text-red-700 mt-1">{total ? t('admin_pages.name_standardization.removed_and_cleared', 'Removed from every list; cleared from {{count}} facility record(s).', { count: total }) : t('admin_pages.name_standardization.removed_everywhere', 'Removed from every list.')}</p>
                                        )}
                                        {action.type === 'merge' && action.to && (
                                            <p className="text-xs text-gray-600 mt-1">{t('admin_pages.name_standardization.merge_note', 'Its records and spellings will be shown as')} <strong>{action.to}</strong>.</p>
                                        )}
                                        {(spellings.length > 0 || entry.aliases?.length > 0) && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {[
                                                    ...spellings.map((s) => s.value),
                                                    // Stored spellings not on any facility in view, once each.
                                                    ...(entry.aliases || []).filter((a) => !spellings.some((s) => normalizeKey(s.value) === normalizeKey(a))),
                                                ].map((value) => {
                                                    const count = counts.get(value) || 0;
                                                    const isName = value === entry.name;
                                                    const off = detached.some((d) => normalizeKey(d) === normalizeKey(value));
                                                    return (
                                                        <span key={value} className={`text-xs px-2 py-0.5 rounded border flex items-center gap-1 ${off ? 'line-through text-gray-400 border-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                                            <span dir="auto">“{value}”</span>{count > 0 && <span className="text-gray-400">×{count}</span>}
                                                            {!isName && !isNew && (
                                                                <button type="button" disabled={busy} title={off ? t('admin_pages.name_standardization.keep_with_name', 'Keep with this name') : t('admin_pages.name_standardization.detach_spelling', 'Detach this spelling (it then appears below, unmapped)')}
                                                                    className="text-gray-400 hover:text-red-600 font-bold"
                                                                    onClick={() => setRemovedAliases((prev) => {
                                                                        const list = prev[entry.name] || [];
                                                                        return { ...prev, [entry.name]: off ? list.filter((d) => normalizeKey(d) !== normalizeKey(value)) : [...list, value] };
                                                                    })}>{off ? '↺' : '×'}</button>
                                                            )}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* --- Recorded spellings not yet in the list --- */}
                <section>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h4 className="font-bold text-gray-800">{t('admin_pages.name_standardization.unmapped_heading', 'Recorded spellings not in the list ({{count}})', { count: unmappedGroups.reduce((s, g) => s + g.variants.length, 0) })}</h4>
                        {unmappedGroups.length > 0 && (
                            <Button variant="secondary" disabled={busy}
                                onClick={() => setGroupActions(Object.fromEntries(unmappedGroups.map((g) => [g.id, g.suggestion])))}>
                                {t('admin_pages.name_standardization.apply_all', 'Apply all suggestions')}
                            </Button>
                        )}
                    </div>
                    {unmappedGroups.length === 0 ? (
                        <div className="p-4 text-sm text-center text-gray-500 bg-gray-50 rounded">{t('admin_pages.name_standardization.all_covered', 'Every recorded {{singular}} is covered by an official name.', { singular: singularWord })}</div>
                    ) : (
                        <div className="max-h-[32vh] overflow-y-auto space-y-2 pe-1">
                            {unmappedGroups.map((g) => {
                                const action = groupActions[g.id] || { type: 'leave' };
                                const total = g.variants.reduce((s, v) => s + v.count, 0);
                                const suggestionText = g.suggestion.type === 'map' ? t('admin_pages.name_standardization.suggest_map', 'map to {{name}}', { name: g.suggestion.to }) : t('admin_pages.name_standardization.suggest_official', 'make “{{name}}” official', { name: g.suggestion.to });
                                return (
                                    <div key={g.id} className="border border-gray-200 rounded-lg p-3">
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {g.variants.map((v) => {
                                                const key = `${g.id}::${v.value}`;
                                                const on = !excludedSpellings[key];
                                                return (
                                                    <label key={key} className={`text-xs px-2 py-0.5 rounded border cursor-pointer ${on ? 'bg-amber-50 border-amber-200 text-gray-800' : 'border-gray-200 text-gray-400 line-through'}`}>
                                                        {g.variants.length > 1 && (
                                                            <input type="checkbox" className="me-1 accent-sky-600" checked={on} disabled={busy}
                                                                onChange={() => setExcludedSpellings((prev) => ({ ...prev, [key]: on }))} />
                                                        )}
                                                        <span dir="auto">“{v.value}”</span> <span className="text-gray-400">×{v.count}</span>
                                                    </label>
                                                );
                                            })}
                                            <span className="text-xs text-gray-500 self-center">{(total === 1 ? t('admin_pages.name_standardization.one_facility', '1 facility') : t('admin_pages.name_standardization.n_facilities', '{{count}} facilities', { count: total }))}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <select className={selectClass} value={action.type} disabled={busy}
                                                onChange={(e) => {
                                                    const type = e.target.value;
                                                    setGroup(g.id, {
                                                        type,
                                                        to: type === 'official' ? g.suggested : type === 'map' ? (g.suggestion.type === 'map' ? g.suggestion.to : '') : '',
                                                    });
                                                }}>
                                                <option value="leave">{t('admin_pages.name_standardization.group.leave', 'Leave as is')}</option>
                                                <option value="map">{t('admin_pages.name_standardization.group.map', 'Map to official {{singular}}…', { singular: singularWord })}</option>
                                                <option value="official">{t('admin_pages.name_standardization.group.official', 'Make official as…')}</option>
                                                <option value="clear">{t('admin_pages.name_standardization.group.clear', 'Clear from facilities')}</option>
                                            </select>
                                            {action.type === 'map' && (
                                                <select className={selectClass} value={action.to} disabled={busy}
                                                    onChange={(e) => setGroup(g.id, { type: 'map', to: e.target.value })}>
                                                    <option value="">{t('admin_pages.name_standardization.choose', '— choose —')}</option>
                                                    {mapTargets.map((n) => <option key={n} value={n}>{n}{officialNames.includes(n) ? '' : t('admin_pages.name_standardization.new_suffix', ' (new)')}</option>)}
                                                </select>
                                            )}
                                            {action.type === 'official' && (
                                                <input className={inputClass} value={action.to} disabled={busy} dir="auto"
                                                    onChange={(e) => setGroup(g.id, { type: 'official', to: e.target.value })} />
                                            )}
                                            {action.type === 'leave' && (
                                                <button type="button" disabled={busy} onClick={() => setGroup(g.id, g.suggestion)}
                                                    className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded px-2 py-1 hover:bg-sky-100">
                                                    {t('admin_pages.name_standardization.suggested', 'Suggested: {{text}}', { text: suggestionText })}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <div className="text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                    <div>
                        <strong>{t('admin_pages.name_standardization.changes', 'Changes:')}</strong>{' '}
                        {hasChanges ? [
                            summary.added && t('admin_pages.name_standardization.sum.added', '{{count}} new', { count: summary.added }),
                            summary.renamed && t('admin_pages.name_standardization.sum.renamed', '{{count}} renamed', { count: summary.renamed }),
                            summary.merged && t('admin_pages.name_standardization.sum.merged', '{{count}} merged', { count: summary.merged }),
                            summary.deleted && t('admin_pages.name_standardization.sum.deleted', '{{count}} deleted', { count: summary.deleted }),
                            summary.mapped && t('admin_pages.name_standardization.sum.mapped', '{{count}} spelling(s) mapped', { count: summary.mapped }),
                            summary.detached && t('admin_pages.name_standardization.sum.detached', '{{count}} spelling(s) detached', { count: summary.detached }),
                        ].filter(Boolean).join(' · ') || t('admin_pages.name_standardization.sum.standardizing', 'standardizing recorded spellings') : t('admin_pages.name_standardization.sum.none', 'none yet')}
                    </div>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={updateRecords} onChange={(e) => setUpdateRecords(e.target.checked)} disabled={busy} className="accent-sky-600" />
                        {t('admin_pages.name_standardization.rewrite_records', 'Also rewrite the facility records ({{facilities}} will change)', { facilities: (changedFacilities.length === 1 ? t('admin_pages.name_standardization.one_facility', '1 facility') : t('admin_pages.name_standardization.n_facilities', '{{count}} facilities', { count: changedFacilities.length })) })}
                    </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    {saving && (
                        <span className="flex items-center gap-2 text-sm text-sky-700 me-auto">
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-600" />
                            {saving.total ? t('admin_pages.name_standardization.updating', 'Updating {{done}}/{{total}}…', { done: saving.done, total: saving.total }) : t('admin_pages.name_standardization.saving', 'Saving…')}
                        </span>
                    )}
                    <Button variant="secondary" onClick={onClose} disabled={busy}>{t('admin_pages.name_standardization.cancel', 'Cancel')}</Button>
                    <Button onClick={handleSave} disabled={busy || !hasChanges}>{t('admin_pages.name_standardization.save', 'Save')}</Button>
                </div>
            </div>
        </Modal>
    );
}
