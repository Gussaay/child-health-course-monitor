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
    const { user } = useAuth();
    const [kindIdx, setKindIdx] = useState(0);
    const { kind, field, singular } = KINDS[kindIdx];
    const { allEntries } = useStandardNames(kind);

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
            setToast?.({ show: true, type: 'info', message: `"${name}" is already an official ${singular}.` });
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
            setToast?.({ show: true, type: 'success', message: `Standard ${kind} saved${updateRecords ? `; ${changedFacilities.length} facility record(s) updated` : ''}.` });
            onComplete?.();
        } catch (e) {
            console.error('Name standardization failed', e);
            setToast?.({ show: true, type: 'error', message: `Could not save: ${e.message}` });
        } finally {
            setSaving(null);
        }
    };

    const busy = !!saving;

    return (
        <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title="Standardize project & organization names">
            <div className="p-4 space-y-5" dir="ltr">
                <div className="flex flex-wrap gap-2">
                    {KINDS.map((k, i) => (
                        <Button key={k.kind} variant="tab" isActive={i === kindIdx} onClick={() => setKindIdx(i)} disabled={busy}>{k.label}</Button>
                    ))}
                </div>

                <p className="text-sm text-gray-600">
                    Nothing changes until you choose it below and press Save. Official names are the ones offered in every
                    form; dashboards and filters (including mentorship) show them. Past mentorship visits keep the project
                    recorded at the time; renamed or merged names are shown under the new name.
                </p>

                {/* --- Official names --- */}
                <section>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h4 className="font-bold text-gray-800">Official {kind} ({official.length})</h4>
                        <div className="flex gap-2">
                            <input value={newNameInput} onChange={(e) => setNewNameInput(e.target.value)} disabled={busy}
                                onKeyDown={(e) => { if (e.key === 'Enter') addNewName(); }}
                                placeholder={`New official ${singular}`} className={inputClass} dir="auto" />
                            <Button variant="secondary" onClick={addNewName} disabled={busy || !tidyName(newNameInput)}>Add</Button>
                        </div>
                    </div>
                    {officialRows.length === 0 ? (
                        <div className="p-4 text-sm text-center text-gray-500 bg-gray-50 rounded">No official {kind} yet. Add one, or make one from the recorded spellings below.</div>
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
                                            {isNew && <span className="text-[11px] font-bold uppercase text-sky-700 bg-sky-50 px-2 py-0.5 rounded">new</span>}
                                            <span className="text-xs text-gray-500">{total} facilit{total === 1 ? 'y' : 'ies'}</span>
                                            <div className="ms-auto flex flex-wrap items-center gap-2">
                                                {isNew ? (
                                                    <Button variant="secondary" onClick={() => setNewNames((prev) => prev.filter((n) => n !== entry.name))} disabled={busy}>Remove</Button>
                                                ) : (
                                                    <select className={selectClass} value={action.type} disabled={busy}
                                                        onChange={(e) => setOfficial(entry.name, { type: e.target.value, to: e.target.value === 'rename' ? entry.name : '' })}>
                                                        <option value="keep">Keep</option>
                                                        <option value="rename">Rename…</option>
                                                        <option value="merge">Merge into…</option>
                                                        <option value="delete">Delete</option>
                                                    </select>
                                                )}
                                                {action.type === 'rename' && (
                                                    <input className={inputClass} value={action.to} disabled={busy} dir="auto"
                                                        onChange={(e) => setOfficial(entry.name, { type: 'rename', to: e.target.value })} />
                                                )}
                                                {action.type === 'merge' && (
                                                    <select className={selectClass} value={action.to} disabled={busy}
                                                        onChange={(e) => setOfficial(entry.name, { type: 'merge', to: e.target.value })}>
                                                        <option value="">— choose —</option>
                                                        {officialNames.filter((n) => n !== entry.name).map((n) => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                        {action.type === 'delete' && (
                                            <p className="text-xs text-red-700 mt-1">Removed from every list{total ? `; cleared from ${total} facility record(s)` : ''}.</p>
                                        )}
                                        {action.type === 'merge' && action.to && (
                                            <p className="text-xs text-gray-600 mt-1">Its records and spellings will be shown as <strong>{action.to}</strong>.</p>
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
                                                                <button type="button" disabled={busy} title={off ? 'Keep with this name' : 'Detach this spelling (it then appears below, unmapped)'}
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
                        <h4 className="font-bold text-gray-800">Recorded spellings not in the list ({unmappedGroups.reduce((s, g) => s + g.variants.length, 0)})</h4>
                        {unmappedGroups.length > 0 && (
                            <Button variant="secondary" disabled={busy}
                                onClick={() => setGroupActions(Object.fromEntries(unmappedGroups.map((g) => [g.id, g.suggestion])))}>
                                Apply all suggestions
                            </Button>
                        )}
                    </div>
                    {unmappedGroups.length === 0 ? (
                        <div className="p-4 text-sm text-center text-gray-500 bg-gray-50 rounded">Every recorded {singular} is covered by an official name.</div>
                    ) : (
                        <div className="max-h-[32vh] overflow-y-auto space-y-2 pe-1">
                            {unmappedGroups.map((g) => {
                                const action = groupActions[g.id] || { type: 'leave' };
                                const total = g.variants.reduce((s, v) => s + v.count, 0);
                                const suggestionText = g.suggestion.type === 'map' ? `map to ${g.suggestion.to}` : `make “${g.suggestion.to}” official`;
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
                                            <span className="text-xs text-gray-500 self-center">{total} facilit{total === 1 ? 'y' : 'ies'}</span>
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
                                                <option value="leave">Leave as is</option>
                                                <option value="map">Map to official {singular}…</option>
                                                <option value="official">Make official as…</option>
                                                <option value="clear">Clear from facilities</option>
                                            </select>
                                            {action.type === 'map' && (
                                                <select className={selectClass} value={action.to} disabled={busy}
                                                    onChange={(e) => setGroup(g.id, { type: 'map', to: e.target.value })}>
                                                    <option value="">— choose —</option>
                                                    {mapTargets.map((n) => <option key={n} value={n}>{n}{officialNames.includes(n) ? '' : ' (new)'}</option>)}
                                                </select>
                                            )}
                                            {action.type === 'official' && (
                                                <input className={inputClass} value={action.to} disabled={busy} dir="auto"
                                                    onChange={(e) => setGroup(g.id, { type: 'official', to: e.target.value })} />
                                            )}
                                            {action.type === 'leave' && (
                                                <button type="button" disabled={busy} onClick={() => setGroup(g.id, g.suggestion)}
                                                    className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded px-2 py-1 hover:bg-sky-100">
                                                    Suggested: {suggestionText}
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
                        <strong>Changes:</strong>{' '}
                        {hasChanges ? [
                            summary.added && `${summary.added} new`,
                            summary.renamed && `${summary.renamed} renamed`,
                            summary.merged && `${summary.merged} merged`,
                            summary.deleted && `${summary.deleted} deleted`,
                            summary.mapped && `${summary.mapped} spelling(s) mapped`,
                            summary.detached && `${summary.detached} spelling(s) detached`,
                        ].filter(Boolean).join(' · ') || 'standardizing recorded spellings' : 'none yet'}
                    </div>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={updateRecords} onChange={(e) => setUpdateRecords(e.target.checked)} disabled={busy} className="accent-sky-600" />
                        Also rewrite the facility records ({changedFacilities.length} facilit{changedFacilities.length === 1 ? 'y' : 'ies'} will change)
                    </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    {saving && (
                        <span className="flex items-center gap-2 text-sm text-sky-700 me-auto">
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-600" />
                            {saving.total ? `Updating ${saving.done}/${saving.total}…` : 'Saving…'}
                        </span>
                    )}
                    <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={handleSave} disabled={busy || !hasChanges}>Save</Button>
                </div>
            </div>
        </Modal>
    );
}
