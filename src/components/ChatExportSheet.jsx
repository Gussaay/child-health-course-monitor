// src/components/ChatExportSheet.jsx
//
// The conversation drawn for sharing (utils/chatExport.js takes the picture or
// the PDF from it): off screen, a fixed width, and every question with its
// answer in full, which the panel's scrolling list cannot give. Each
// [data-export-block] is one piece of a PDF page; [data-export-image] is the
// picture of one answer.
import React, { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';

import { AiText } from './AiLibraryView';

const AiChart = lazy(() => import('./AiChart'));

/** The conversation as question-and-answer pairs; a failed answer is left out. */
export function pairsOf(messages) {
    const pairs = [];
    messages.forEach((m, i) => {
        if (m.role !== 'assistant' || m.failed) return;
        const asked = messages[i - 1]?.role === 'user' ? messages[i - 1].content : '';
        pairs.push({ question: asked, answer: m, index: i });
    });
    return pairs;
}

function Header({ place, date }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-start gap-3 rounded-xl bg-slate-800 px-4 py-3 text-white">
            <div className="mt-0.5 rounded-lg bg-sky-500/20 p-1.5 text-sky-300"><Sparkles size={18} /></div>
            <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{t('app.title', 'National Child Health Program')} · {t('data_assistant.title', 'Ask the data')}</p>
                <p className="text-xs text-slate-300">{[place, date].filter(Boolean).join(' · ')}</p>
            </div>
        </div>
    );
}

function Pair({ pair }) {
    const { answer } = pair;
    const sources = answer.sourcePages?.length > 0 ? answer.sourcePages : answer.sources || [];
    return (
        <div className="space-y-2">
            {pair.question && (
                <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-se-sm bg-sky-600 px-3 py-2 text-sm text-white whitespace-pre-wrap" dir="auto">{pair.question}</div>
                </div>
            )}
            <div className="rounded-xl border border-line bg-white px-3 py-2.5">
                <AiText text={answer.content} />
                {answer.chart && <Suspense fallback={null}><AiChart chart={answer.chart} pixelRatio={2} /></Suspense>}
                {(answer.usedPage || sources.length > 0) && (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400" dir="auto">
                        {[answer.usedPage ? answer.place : '', ...sources].filter(Boolean).join(' · ')}
                    </p>
                )}
            </div>
        </div>
    );
}

const ChatExportSheet = React.forwardRef(function ChatExportSheet({ sheet, place, lang }, ref) {
    const { t } = useTranslation();
    if (!sheet) return null;
    const date = new Date().toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const footer = <p className="pt-1 text-center text-xs text-slate-400">{t('data_assistant.export_footer', 'Answered from the app\'s own data')}</p>;
    return (
        <div ref={ref} aria-hidden="true" dir={lang === 'ar' ? 'rtl' : 'ltr'}
            style={{ position: 'fixed', top: 0, left: -20000, width: sheet.width, pointerEvents: 'none' }}>
            {sheet.kind === 'image' ? (
                <div data-export-image className="space-y-3 bg-surface p-4">
                    <Header place={place} date={date} />
                    {sheet.pairs.map((p) => <Pair key={p.index} pair={p} />)}
                    {footer}
                </div>
            ) : (
                <div className="bg-white">
                    <div data-export-block className="bg-white pb-2"><Header place={place} date={date} /></div>
                    {sheet.pairs.map((p) => <div key={p.index} data-export-block className="bg-white py-1"><Pair pair={p} /></div>)}
                    <div data-export-block className="bg-white">{footer}</div>
                </div>
            )}
        </div>
    );
});

export default ChatExportSheet;
