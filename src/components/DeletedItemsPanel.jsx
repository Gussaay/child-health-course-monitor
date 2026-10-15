// src/components/DeletedItemsPanel.jsx
//
// The "Deleted" tab each page shows to federal managers: the records of that
// page's types that were deleted (deleting only hides a record, isDeleted:
// true), with a way to remove them for good.
//
//   <DeletedItemsPanel types={['projects']} />
//
// A permanent delete trims exactly the removed ids from the local caches
// (removeFromCache); nothing is re-downloaded.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { Button, FormGroup, Select, Spinner } from './CommonComponents';
import { RECYCLE_BIN_TYPES, recordTitle, recordSubtitle, mergeRemovals } from '../utils/recycleBin.js';
import { listSoftDeletedRecords, permanentlyDeleteRecord, RECYCLE_BIN_PAGE } from '../data.js';
import { useDataCache } from '../DataContext';
import { alertDialog, confirmDialog, notify } from './dialogs';

const formatWhen = (ts) => {
    const ms = ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds * 1000 : null);
    return ms ? new Date(ms).toLocaleString() : '';
};

/**
 * @param {string[]} types      the collections this page deletes, from RECYCLE_BIN_TYPES
 * @param {string}  [note]      an extra line under the controls
 * @param {Function} [onDeleted] called with the removals after a permanent delete
 */
export default function DeletedItemsPanel({ types, note, onDeleted }) {
    const { removeFromCache } = useDataCache();
    const available = useMemo(
        () => RECYCLE_BIN_TYPES.filter((t) => !types || types.includes(t.collection)),
        [types]
    );
    const [type, setType] = useState(available[0]?.collection);
    const [rows, setRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selected, setSelected] = useState(() => new Set());
    const [busy, setBusy] = useState(false);

    const typeInfo = useMemo(() => available.find((t) => t.collection === type), [available, type]);

    const load = useCallback(async () => {
        if (!type) return;
        setIsLoading(true);
        setSelected(new Set());
        try {
            setRows(await listSoftDeletedRecords(type));
        } catch (error) {
            setRows([]);
            await alertDialog(`Could not load deleted ${typeInfo?.label.toLowerCase() || 'records'}: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [type, typeInfo]);

    useEffect(() => { load(); }, [load]);

    const toggle = (id) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const allSelected = rows.length > 0 && selected.size === rows.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

    const deleteForGood = async (ids) => {
        if (!ids.length) return;
        const names = rows.filter((r) => ids.includes(r.id)).slice(0, 5).map((r) => `• ${recordTitle(r)}`).join('\n');
        const more = ids.length > 5 ? `\n…and ${ids.length - 5} more` : '';
        const linked = typeInfo?.children?.length
            ? `\n\nRecords that belong to ${ids.length === 1 ? 'it' : 'them'} (${typeInfo.children.map((c) => c.collection).join(', ')}) are removed too.`
            : '';
        const ok = await confirmDialog(
            `Permanently delete ${ids.length} ${typeInfo.label.toLowerCase()}?\n\n${names}${more}${linked}\n\nThis cannot be undone.`,
            { title: 'Delete permanently', confirmLabel: 'Delete permanently', danger: true }
        );
        if (!ok) return;

        setBusy(true);
        let removed = {};
        const done = [];
        const failed = [];
        for (const id of ids) {
            try {
                removed = mergeRemovals(removed, await permanentlyDeleteRecord(type, id));
                done.push(id);
            } catch (error) {
                failed.push(`${recordTitle(rows.find((r) => r.id === id)) || id}: ${error.message}`);
            }
        }
        for (const [key, keyIds] of Object.entries(removed)) await removeFromCache(key, keyIds);
        if (done.length) onDeleted?.(removed);
        setRows((list) => list.filter((r) => !done.includes(r.id)));
        setSelected(new Set());
        setBusy(false);

        if (failed.length) {
            await alertDialog(`${done.length} deleted. ${failed.length} could not be deleted:\n\n${failed.join('\n')}`, { title: 'Some records were not deleted' });
        } else {
            notify(`${done.length} permanently deleted.`, 'success');
        }
    };

    return (
        <div className="space-y-4" dir="ltr">
                <p className="text-sm text-gray-600">
                    Deleting only hides a record. Delete it here permanently to remove it for good.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                    {available.length > 1 && (
                        <FormGroup label="Record type">
                            <Select value={type} onChange={(e) => setType(e.target.value)} disabled={busy}>
                                {available.map((t) => (
                                    <option key={t.collection} value={t.collection}>{t.label}</option>
                                ))}
                            </Select>
                        </FormGroup>
                    )}
                    <Button variant="secondary" onClick={load} disabled={busy || isLoading}>
                        <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                    </Button>
                    <Button variant="danger" onClick={() => deleteForGood([...selected])} disabled={busy || selected.size === 0}>
                        {busy ? <Spinner size="sm" /> : <><Trash2 className="w-4 h-4 mr-1" /> Delete selected permanently ({selected.size})</>}
                    </Button>
                </div>

                {note && <p className="text-xs text-gray-500">{note}</p>}

                {isLoading ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                ) : rows.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-500">No deleted {typeInfo?.label.toLowerCase()}.</p>
                ) : (
                    <>
                        {rows.length >= RECYCLE_BIN_PAGE && (
                            <div className="p-2 text-xs rounded bg-amber-50 border border-amber-200 text-amber-800">
                                Showing the first {RECYCLE_BIN_PAGE}. Delete these and press Refresh to see more.
                            </div>
                        )}
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={busy} />
                            Select all ({rows.length})
                        </label>
                        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                            {rows.map((r) => (
                                <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
                                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} disabled={busy} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-gray-900 truncate">{recordTitle(r)}</div>
                                        <div className="text-xs text-gray-500 truncate">{recordSubtitle(r)}</div>
                                        {(r.deletedAt || r.lastUpdatedAt) && (
                                            <div className="text-xs text-gray-400">
                                                Deleted {formatWhen(r.deletedAt || r.lastUpdatedAt)}{r.deletedBy || r.updatedBy ? ` by ${r.deletedBy || r.updatedBy}` : ''}
                                            </div>
                                        )}
                                    </div>
                                    <Button variant="danger" onClick={() => deleteForGood([r.id])} disabled={busy} className="shrink-0">
                                        <Trash2 className="w-4 h-4" />
                                        <span className="sr-only">Delete permanently</span>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
        </div>
    );
}
