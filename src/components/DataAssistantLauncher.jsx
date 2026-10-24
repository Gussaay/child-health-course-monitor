// src/components/DataAssistantLauncher.jsx
//
// The ways into "Ask the data" (DataAssistant.jsx): a round button at the
// bottom of every page and a bar on the main menu. Kept apart from the panel
// so every page can show them without loading the panel's code.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';

export function DataAssistantButton({ onClick }) {
    const { t } = useTranslation();
    const label = t('data_assistant.button', 'Ask the data');
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className="print-hide fixed z-50 end-4 bottom-[calc(var(--bottom-nav,0px)+1rem)] md:bottom-6 flex items-center gap-2 rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-700 active:bg-sky-800 h-12 w-12 md:w-auto md:px-4 justify-center"
        >
            <Sparkles size={20} className="shrink-0" />
            <span className="hidden md:inline text-sm font-semibold">{label}</span>
        </button>
    );
}

/** The "Ask the data" bar on the main menu; tapping it opens the panel. */
export function DataAssistantCard({ onOpen }) {
    const { t } = useTranslation();
    return (
        <button type="button" onClick={onOpen}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-2 ps-3 text-start hover:border-sky-400">
            <Sparkles size={20} className="shrink-0 text-sky-600" />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">{t('data_assistant.title', 'Ask the data')}</span>
                <span className="block truncate text-xs text-slate-500">{t('data_assistant.card_hint', 'Ask anything about courses, facilities, mentorship and plans. Answers come only from the app.')}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white">{t('data_assistant.ask', 'Ask')}</span>
        </button>
    );
}
