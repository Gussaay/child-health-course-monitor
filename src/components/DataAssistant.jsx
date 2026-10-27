// src/components/DataAssistant.jsx
//
// "Ask the data": a question box reachable from every page. It answers from
// the app's own data only (the page that is open, and what the aiAssistant
// Cloud Function reads as the signed-in person), and says so when the data
// does not hold the answer. No AI key is in the app.
//
// This file is the panel. Each page has its own conversation, saved on this
// device (aiChats.js), so coming back to a page shows what was asked there,
// and the same question asked again on that page within the hour is answered
// from the saved answer instead of asking the AI again. It is loaded the first
// time it is opened; the buttons that open it are in DataAssistantLauncher.jsx,
// which every page loads.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Sparkles, Send, X, Loader2, Copy, RotateCcw, FileText, Database, History, CornerDownRight } from 'lucide-react';

import { AiText } from './AiLibraryView';
import { notify } from './dialogs';
import { snapshotPage } from '../utils/pageSnapshot';
import { loadChats, saveChats, savedAnswer } from '../utils/aiChats';

const providerName = (p) => ({ groq: 'Groq', cerebras: 'Cerebras', gemini: 'Gemini' }[p] || p);

const askServer = (payload) => httpsCallable(getFunctions(), 'aiAssistant', { timeout: 130000 })(payload);

function examplesFor(view, t) {
    const page = t('data_assistant.example_page', 'Summarise what this page shows.');
    const plan = t('data_assistant.example_plan', 'What stands out on this page, and what actions do you suggest?');
    const byView = {
        landing: [
            t('data_assistant.example_courses_state', 'How many courses were run in each state this year?'),
            t('data_assistant.example_trained', 'How many participants were trained by course type?'),
        ],
        dashboard: [
            t('data_assistant.example_lowest', 'Which states have the lowest numbers on this dashboard?'),
            t('data_assistant.example_courses_state', 'How many courses were run in each state this year?'),
        ],
        courses: [
            t('data_assistant.example_scores', 'What is the average post-test score by course type?'),
            t('data_assistant.example_recent', 'Which courses started in the last three months?'),
        ],
        childHealthServices: [
            t('data_assistant.example_imnci_facilities', 'How many facilities provide IMNCI in each state?'),
            t('data_assistant.example_functioning', 'How many facilities are not functioning?'),
            t('data_assistant.example_coverage_plan', 'Which localities have the lowest IMNCI coverage, and what targets and activities would close the gap?'),
        ],
        skillsMentorship: [
            t('data_assistant.example_visits', 'How many mentorship visits were made per state this year?'),
        ],
        humanResources: [
            t('data_assistant.example_facilitators', 'How many facilitators are there for each course?'),
        ],
    };
    return [page, plan, ...(byView[view] || byView.landing)];
}

export function DataAssistantPanel({ open, onClose, view, pageTitle, uid = '' }) {
    const { t, i18n } = useTranslation();
    // One conversation per page, keyed by the page's view.
    const [chats, setChats] = useState(() => loadChats(uid));
    const messages = useMemo(() => chats[view] || [], [chats, view]);
    const setMessages = useCallback((list) => setChats((all) => ({ ...all, [view]: list })), [view]);
    useEffect(() => { saveChats(uid, chats); }, [uid, chats]);
    const [question, setQuestion] = useState('');
    const [busy, setBusy] = useState(false);
    const [usePage, setUsePage] = useState(true);
    const endRef = useRef(null);
    const inputRef = useRef(null);
    const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';

    useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);
    useEffect(() => {
        if (!open) return undefined;
        const id = setTimeout(() => inputRef.current?.focus(), 50);
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => { clearTimeout(id); window.removeEventListener('keydown', onKey); };
    }, [open, onClose]);

    const ask = useCallback(async (asked, { fresh = false } = {}) => {
        const text = String(asked ?? question).trim();
        if (!text || busy) return;
        setQuestion('');
        const before = messages;
        const saved = fresh ? null : savedAnswer(before, text);
        if (saved) {
            setMessages([...before, { role: 'user', content: text }, { ...saved, cached: true }]);
            return;
        }
        setMessages([...before, { role: 'user', content: text }]);
        setBusy(true);
        try {
            const page = usePage
                ? await snapshotPage(document.querySelector('main'), { view, title: pageTitle, appName: t('app.title', 'National Child Health Program') })
                : null;
            const { data } = await askServer({
                question: text,
                lang,
                page,
                messages: before.filter((m) => !m.failed).map(({ role, content }) => ({ role, content })),
            });
            setMessages([...before, { role: 'user', content: text }, {
                role: 'assistant', content: data.reply, provider: data.provider, model: data.model,
                sources: data.sources || [], sourcePages: data.sourcePages || [], place: data.place || '',
                followUps: Array.isArray(data.followUps) ? data.followUps : [],
                usedPage: !!data.usedPage, seconds: data.seconds, at: Date.now(),
            }]);
        } catch (e) {
            setMessages([...before, { role: 'user', content: text }, {
                role: 'assistant', failed: true,
                content: e?.message || t('data_assistant.failed', 'That could not be answered. Try again.'),
            }]);
        } finally {
            setBusy(false);
        }
    }, [question, busy, messages, setMessages, usePage, view, pageTitle, lang, t]);

    const copy = async (text) => {
        try { await navigator.clipboard.writeText(text); notify(t('data_assistant.copied', 'Copied'), 'success'); }
        catch { notify(t('data_assistant.copy_failed', 'Could not copy on this device'), 'error'); }
    };

    if (!open) return null;

    return (
        <div className="print-hide fixed inset-0 z-[100005] flex justify-end bg-black/30" onClick={onClose}>
            <div
                role="dialog"
                aria-label={t('data_assistant.title', 'Ask the data')}
                className="w-full sm:max-w-md bg-white h-full flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-slate-800 text-white shrink-0">
                    <div className="mt-0.5 rounded-lg bg-sky-500/20 p-1.5 text-sky-300"><Sparkles size={18} /></div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold leading-tight">{t('data_assistant.title', 'Ask the data')}</h2>
                        <p className="text-xs text-slate-300">{t('data_assistant.subtitle', 'Answers only from this app\'s data')}</p>
                    </div>
                    {messages.length > 0 && (
                        <button onClick={() => setMessages([])} disabled={busy} className="p-1.5 rounded hover:bg-white/15 disabled:opacity-50"
                            title={t('data_assistant.new_chat', 'New conversation')} aria-label={t('data_assistant.new_chat', 'New conversation')}>
                            <RotateCcw size={18} />
                        </button>
                    )}
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-white/15" aria-label={t('data_assistant.close', 'Close')}>
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface">
                    {messages.length === 0 && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                                {t('data_assistant.intro', 'Ask about anything in the app: courses, participants, facilities, mentorship, plans and the dashboards. Answers come only from the app\'s data that your account can open. When the data does not hold the answer, it says so.')}
                                {' '}{t('data_assistant.intro_more', 'It can also compare places, point out what stands out, and suggest actions, targets and plans here in the chat. It never changes anything in the app.')}
                            </p>
                            <div className="space-y-2">
                                {examplesFor(view, t).map((example) => (
                                    <button key={example} onClick={() => ask(example)}
                                        className="block w-full text-start rounded-lg border border-line bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-400 hover:text-sky-700">
                                        {example}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((m, i) => (m.role === 'user' ? (
                        <div key={i} className="flex justify-end">
                            <div className="max-w-[85%] rounded-2xl rounded-se-sm bg-sky-600 px-3 py-2 text-sm text-white whitespace-pre-wrap" dir="auto">{m.content}</div>
                        </div>
                    ) : (
                        <div key={i} className={`rounded-xl border px-3 py-2.5 ${m.failed ? 'border-red-200 bg-red-50 text-sm text-red-800' : 'border-line bg-white'}`}>
                            {m.failed ? m.content : <AiText text={m.content} />}
                            {!m.failed && (
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-400">
                                    {m.usedPage && <span className="inline-flex items-center gap-1"><FileText size={12} />{m.place || t('data_assistant.read_page', 'this page')}</span>}
                                    {(m.sourcePages?.length > 0 ? m.sourcePages : m.sources || []).length > 0 && (
                                        <span className="inline-flex items-center gap-1"><Database size={12} />{(m.sourcePages?.length > 0 ? m.sourcePages : m.sources).join(' · ')}</span>
                                    )}
                                    {m.cached && (
                                        <button onClick={() => ask(messages[i - 1]?.content, { fresh: true })} disabled={busy}
                                            className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700">
                                            <History size={12} />{t('data_assistant.saved_answer', 'Saved answer')} · {t('data_assistant.ask_again', 'Ask again')}
                                        </button>
                                    )}
                                    {m.model && <span>{providerName(m.provider)}{m.seconds ? ` · ${m.seconds} s` : ''}</span>}
                                    <button onClick={() => copy(m.content)} className="ms-auto inline-flex items-center gap-1 hover:text-slate-600">
                                        <Copy size={12} />{t('data_assistant.copy', 'Copy')}
                                    </button>
                                </div>
                            )}
                            {/* Next questions, offered under the latest answer only. */}
                            {!m.failed && i === messages.length - 1 && m.followUps?.length > 0 && (
                                <div className="mt-2 flex flex-col gap-1.5">
                                    {m.followUps.map((f) => (
                                        <button key={f} onClick={() => ask(f)} disabled={busy} dir="auto"
                                            className="inline-flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-start text-xs text-sky-800 hover:border-sky-400 disabled:opacity-50">
                                            <CornerDownRight size={13} className="mt-0.5 shrink-0 rtl:-scale-x-100" />{f}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )))}

                    {busy && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 size={15} className="animate-spin" /> {t('data_assistant.reading', 'Reading and analysing the app\'s data…')}
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                <div className="border-t border-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={usePage} onChange={(e) => setUsePage(e.target.checked)} className="rounded border-slate-300" />
                        <span className="truncate">{t('data_assistant.include_page', 'Include the page I have open')}{pageTitle ? `: ${pageTitle}` : ''}</span>
                    </label>
                    <div className="flex gap-2">
                        <textarea
                            ref={inputRef}
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
                            rows={2}
                            dir="auto"
                            placeholder={t('data_assistant.placeholder', 'Ask a question about the data…')}
                            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                        />
                        <button onClick={() => ask()} disabled={busy || !question.trim()}
                            aria-label={t('data_assistant.send', 'Send')}
                            className="self-end h-10 w-10 grid place-items-center rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40">
                            <Send size={17} className="rtl:-scale-x-100" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
