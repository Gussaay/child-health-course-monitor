// src/components/DataAssistantLauncher.jsx
//
// The way into "Ask the data" (DataAssistant.jsx): a bar on the main menu,
// which answers questions about any page. Also the page "Add" button that
// took the old floating assistant button's place. Kept apart from the panel
// so every page can show them without loading the panel's code.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Sparkles } from 'lucide-react';

/**
 * The round "Add" button at the bottom corner of a page, where "Ask the data"
 * used to float. Pages turn it on with usePageAddButton (utils/pageChrome.js).
 */
export function PageAddButton({ label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            data-app-chrome="add"
            className="print-hide fixed z-40 end-4 bottom-[calc(var(--bottom-nav,0px)+1rem)] flex items-center gap-2 rounded-full bg-sky-600 text-white shadow-lg shadow-sky-600/30 hover:bg-sky-700 active:bg-sky-800 active:scale-95 h-14 w-14 md:h-12 md:w-auto md:px-4 justify-center"
        >
            <Plus size={26} className="shrink-0 md:w-5 md:h-5" />
            <span className="hidden md:inline text-sm font-semibold whitespace-nowrap">{label}</span>
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
