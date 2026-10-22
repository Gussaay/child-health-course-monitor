// src/components/imnci/onlineCourses/OfflineSave.jsx
//
// "Save for offline" on a module: downloads its pictures so the module reads
// in full without a connection. See offline.js.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudDownload, CloudOff, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../CommonComponents';
import { notify, confirmDialog } from '../../dialogs';
import {
    canSaveOffline, savedModules, picturePaths, offlineState, saveModuleOffline, removeModuleOffline,
} from './offline';

export const megabytes = (bytes) => (bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0);

/** Whether the device is online, kept up to date. */
export function useOnline() {
    const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);
    return online;
}

export function OfflineSave({ moduleId, sections }) {
    const { t } = useTranslation();
    const online = useOnline();
    const [record, setRecord] = useState(() => savedModules()[moduleId] || null);
    const [run, setRun] = useState(null); // { done, total } while saving
    useEffect(() => { setRecord(savedModules()[moduleId] || null); }, [moduleId]);

    if (!canSaveOffline()) return null;
    const pictures = picturePaths(sections).length;
    const state = offlineState(record, sections);

    const save = async () => {
        setRun({ done: 0, total: pictures });
        try {
            const r = await saveModuleOffline(moduleId, sections, (done, total) => setRun({ done, total }));
            setRecord(savedModules()[moduleId] || null);
            if (!r.saved) {
                notify(t('imnci_ui.courses.offline.failed', 'The pictures could not be saved. Check the connection and try again.'), 'error');
            } else if (r.failed) {
                notify(t('imnci_ui.courses.offline.partly', '{{saved}} of {{total}} pictures saved. Save again with a better connection to get the rest.', { saved: r.saved, total: pictures }), 'info');
            } else {
                notify(t('imnci_ui.courses.offline.done', 'Saved. This module now opens without a connection.'), 'success');
            }
        } finally {
            setRun(null);
        }
    };

    const remove = async () => {
        if (!await confirmDialog(t('imnci_ui.courses.offline.remove_confirm', 'Remove this module\'s pictures from this device? The text stays, and you can save it again.'),
            { title: t('imnci_ui.courses.offline.remove_title', 'Remove offline copy'), confirmLabel: t('imnci_ui.courses.offline.remove', 'Remove') })) return;
        await removeModuleOffline(moduleId);
        setRecord(null);
    };

    // Nothing to download: the text is already kept on the device.
    if (pictures === 0) {
        return (
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                {t('imnci_ui.courses.offline.text_only', 'Text only: this module can be read offline as it is.')}
            </div>
        );
    }

    if (run) {
        return (
            <div className="flex items-center gap-2 text-xs text-slate-600">
                <Loader2 size={14} className="animate-spin shrink-0" />
                {t('imnci_ui.courses.offline.saving', 'Saving pictures {{done}} of {{total}}…', { done: run.done, total: run.total })}
            </div>
        );
    }

    if (state === 'none') {
        return online ? (
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" className="px-3 py-1.5 h-auto" onClick={save}>
                    <CloudDownload size={15} /> {t('imnci_ui.courses.offline.save', 'Save for offline')}
                </Button>
                <span className="text-xs text-slate-500">
                    {t('imnci_ui.courses.offline.save_help', '{{n}} pictures, so the charts and book pages open without a connection.', { n: pictures })}
                </span>
            </div>
        ) : (
            <div className="flex items-start gap-2 text-xs text-amber-800">
                <CloudOff size={14} className="shrink-0 mt-0.5" />
                {t('imnci_ui.courses.offline.offline_unsaved', 'You are offline. The text can be read; the pictures show once the module is saved while online.')}
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 size={14} />
                {t('imnci_ui.courses.offline.saved', 'Saved on this device')}
                {record?.bytes > 0 && <span className="font-normal text-slate-500">· {t('imnci_ui.courses.offline.mb', '{{n}} MB', { n: megabytes(record.bytes) })}</span>}
            </span>
            {state === 'stale' && online && (
                <button type="button" onClick={save} className="inline-flex items-center gap-1 text-sky-700 font-semibold hover:underline">
                    <RefreshCw size={12} /> {t('imnci_ui.courses.offline.update', 'New pictures were added. Update')}
                </button>
            )}
            <button type="button" onClick={remove} className="text-slate-500 hover:text-rose-700 hover:underline">
                {t('imnci_ui.courses.offline.remove', 'Remove')}
            </button>
        </div>
    );
}
