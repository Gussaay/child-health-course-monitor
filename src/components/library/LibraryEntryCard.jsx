// The "Child Health Library" bar above the sign-in box. Kept apart from the
// library page so the sign-in screen does not load the whole library.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Library } from 'lucide-react';

// The library is public, so nobody needs an account to open it.
export function LibraryEntryCard({ onOpen }) {
    const { t } = useTranslation();
    return (
        <button type="button" onClick={onOpen}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-2 ps-3 text-start hover:border-sky-400">
            <Library size={20} className="shrink-0 text-sky-600" />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">{t('library.title', 'Child Health Library')}</span>
                <span className="block truncate text-xs text-slate-500">{t('library.entry_hint', 'Training, guidelines, protocols and SOPs. No sign-in needed.')}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white">{t('library.open', 'Open')}</span>
        </button>
    );
}
