// NameStandardizationModal.jsx
//
// Maps the project and organization names already recorded on facilities to
// one standard name each, saves those names (with the old spellings as known
// variants) for every form and dashboard, and rewrites the facility records.
import React, { useEffect, useMemo, useState } from 'react';
import { writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { saveFacilitySnapshot } from '../data.js';
import { useAuth } from '../hooks/useAuth';
import { useNameRegistry, useStandardNames, updateNameRegistry } from '../hooks/useNameRegistry';
import { groupVariants, applyMappingsToRegistry, tidyName } from '../utils/nameRegistry';
import { Modal, Button } from './CommonComponents';

const KINDS = [
    { kind: 'projects', field: 'project_name', label: 'Projects (اسم المشروع)' },
    { kind: 'organizations', field: 'staff_incentives_organization', label: 'Organizations (المنظمة المقدمة للحوافز)' },
];

// Each facility update writes the facility and a history snapshot: two of a
// batch's 500 operations.
const FACILITIES_PER_BATCH = 200;

export default function NameStandardizationModal({ isOpen, onClose, facilities = [], onComplete, setToast }) {
    const { user } = useAuth();
    const { registry } = useNameRegistry();
    const [kindIdx, setKindIdx] = useState(0);
    const { kind, field } = KINDS[kindIdx];
    const { names } = useStandardNames(kind);

    const values = useMemo(() => {
        const counts = new Map();
        (facilities || []).forEach((f) => {
            const raw = f?.[field];
            if (typeof raw !== 'string' || !tidyName(raw)) return;
            counts.set(raw, (counts.get(raw) || 0) + 1);
        });
        return [...counts.entries()].map(([value, count]) => ({ value, count }));
    }, [facilities, field]);

    const groups = useMemo(() => groupVariants(values, registry[kind] || []), [values, registry, kind]);

    // Per group: the standard name, and which spellings are included.
    const [targets, setTargets] = useState({});
    const [excluded, setExcluded] = useState({});
    const [updateRecords, setUpdateRecords] = useState(true);
    const [saving, setSaving] = useState(null); // { done, total }

    useEffect(() => {
        setTargets(Object.fromEntries(groups.map((g, i) => [i, g.suggested])));
        setExcluded({});
    }, [groups]);

    const mappings = useMemo(() => groups.flatMap((g, i) => {
        const to = tidyName(targets[i] ?? g.suggested);
        if (!to) return [];
        return g.variants.filter((v) => !excluded[`${i}::${v.value}`]).map((v) => ({ from: v.value, to }));
    }), [groups, targets, excluded]);

    const changedFacilities = useMemo(() => {
        const map = new Map(mappings.map((m) => [m.from, m.to]));
        return (facilities || []).filter((f) => map.has(f?.[field]) && map.get(f[field]) !== f[field]);
    }, [mappings, facilities, field]);

    const handleSave = async () => {
        const who = user?.displayName ? `${user.displayName} (${user.email})` : (user?.email || 'Unknown');
        try {
            setSaving({ done: 0, total: updateRecords ? changedFacilities.length : 0 });
            await updateNameRegistry(kind, applyMappingsToRegistry(registry[kind] || [], mappings), who);

            if (updateRecords && changedFacilities.length) {
                const map = new Map(mappings.map((m) => [m.from, m.to]));
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

    return (
        <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title="Standardize project & organization names">
            <div className="p-4 space-y-4" dir="ltr">
                <div className="flex flex-wrap gap-2">
                    {KINDS.map((k, i) => (
                        <Button key={k.kind} variant="tab" isActive={i === kindIdx} onClick={() => setKindIdx(i)} disabled={!!saving}>{k.label}</Button>
                    ))}
                </div>

                <p className="text-sm text-gray-600">
                    Spellings that look like the same name are grouped. Set the standard name for each group — type a name
                    from another group to merge them (e.g. <em>يونيسيف</em> → <em>UNICEF</em>) — and untick any spelling that
                    does not belong. Saving makes these the names offered in every form, and every dashboard and filter
                    (including mentorship) shows the standard name.
                </p>

                {groups.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 bg-gray-50 rounded">No {kind} are recorded on the facilities in view.</div>
                ) : (
                    <div className="max-h-[50vh] overflow-y-auto space-y-3 pe-1">
                        <datalist id={`std-names-${kind}`}>
                            {[...new Set([...names, ...groups.map((g) => g.suggested)])].map((n) => <option key={n} value={n} />)}
                        </datalist>
                        {groups.map((g, i) => {
                            const total = g.variants.reduce((s, v) => s + v.count, 0);
                            return (
                                <div key={`${kind}-${i}-${g.suggested}`} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <label className="text-sm font-semibold text-gray-700">Standard name</label>
                                        <input
                                            list={`std-names-${kind}`}
                                            value={targets[i] ?? g.suggested}
                                            onChange={(e) => setTargets((prev) => ({ ...prev, [i]: e.target.value }))}
                                            className="border border-gray-300 rounded-md p-1.5 text-sm flex-1 min-w-[12rem]"
                                            disabled={!!saving}
                                        />
                                        <span className="text-xs text-gray-500">{total} facilit{total === 1 ? 'y' : 'ies'}</span>
                                        {g.fromRegistry && <span className="text-[11px] font-bold uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded">official</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {g.variants.map((v) => {
                                            const key = `${i}::${v.value}`;
                                            const on = !excluded[key];
                                            return (
                                                <label key={key} className={`text-sm px-2 py-1 rounded border cursor-pointer ${on ? 'bg-sky-50 border-sky-200' : 'bg-white border-gray-200 text-gray-400 line-through'}`}>
                                                    <input type="checkbox" className="me-1 accent-sky-600" checked={on} disabled={!!saving}
                                                        onChange={() => setExcluded((prev) => ({ ...prev, [key]: on }))} />
                                                    <span dir="auto">“{v.value}”</span> <span className="text-xs text-gray-500">×{v.count}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={updateRecords} onChange={(e) => setUpdateRecords(e.target.checked)} disabled={!!saving} className="accent-sky-600" />
                    Also rewrite the facility records ({changedFacilities.length} facilit{changedFacilities.length === 1 ? 'y' : 'ies'} will change)
                </label>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    {saving && <span className="flex items-center gap-2 text-sm text-sky-700 me-auto"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-600" />{saving.total ? `Updating ${saving.done}/${saving.total}…` : 'Saving…'}</span>}
                    <Button variant="secondary" onClick={onClose} disabled={!!saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!!saving || mappings.length === 0}>Save standard names</Button>
                </div>
            </div>
        </Modal>
    );
}
