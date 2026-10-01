// src/components/ClaudeAssistant.jsx
//
// Two things, both about reaching programme data through Claude:
//
//   ConnectClaudeScreen  the consent step when somebody adds this server as a
//                        connector in claude.ai — they land here, signed in,
//                        and say yes before any code is issued
//   ClaudeChatPanel      asking questions inside the app
//
// Neither holds an API key or a token. The consent screen asks a Cloud Function
// to mint the authorisation code; the chat panel asks a Cloud Function to talk
// to Claude. Both run as the signed-in person and can reach only what that
// person can already reach.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    Sparkles, Send, ShieldCheck, X, Loader2, AlertTriangle, Database,
} from 'lucide-react';

import { Button, Card, CardBody, Spinner } from './CommonComponents';
import { notify } from './dialogs';

const fn = (name) => httpsCallable(getFunctions(), name);

// =============================================================================
// Consent
// =============================================================================

/**
 * Shown when the address carries ?connect_claude=<id>.
 *
 * The person is told plainly what they are about to allow before anything is
 * granted, because "connect an app" is the step where people click through
 * without reading and end up handing over more than they meant to.
 */
export function ConnectClaudeScreen({ requestId, user, authLoading = false, onDone }) {
    const [state, setState] = useState({ loading: true, error: '', client: null });
    const [granting, setGranting] = useState(false);

    useEffect(() => {
        // Nothing can be read until we know who is asking: describeClaudeConnection
        // is a callable and refuses an unauthenticated caller.
        if (authLoading || !user) return undefined;
        let alive = true;
        fn('describeClaudeConnection')({ requestId })
            .then(({ data }) => { if (alive) setState({ loading: false, error: '', client: data }); })
            .catch((e) => { if (alive) setState({ loading: false, error: e.message || 'That request could not be read.', client: null }); });
        return () => { alive = false; };
    }, [requestId, user, authLoading]);

    if (authLoading) {
        return <div className="min-h-screen grid place-items-center bg-slate-100"><Spinner /></div>;
    }

    // In the popup this window opened in, nobody may be signed in yet. Saying so
    // beats the dashboard shell wrapped around a sign-in box, which is what it
    // used to show and which reads as nothing at all.
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
                <Card className="w-full max-w-md">
                    <CardBody className="space-y-4 text-center">
                        <div className="mx-auto p-2.5 bg-sky-100 text-sky-700 rounded-lg w-fit">
                            <Sparkles size={22} />
                        </div>
                        <h1 className="text-lg font-bold text-slate-800">Sign in to connect Claude</h1>
                        <p className="text-sm text-slate-600">
                            Claude is asking to read programme data as you. Sign in to the National
                            Child Health Programme in this window, and you will be asked to approve it.
                        </p>
                        <Button className="w-full justify-center"
                            onClick={() => {
                                // Back here afterwards: the request id is carried
                                // through so the approval can still be completed.
                                const back = `${window.location.origin}/?connect_claude=${encodeURIComponent(requestId)}`;
                                window.location.assign(back);
                            }}>
                            Sign in
                        </Button>
                        <p className="text-xs text-slate-400">
                            If you are already signed in on this device, this window may just need
                            reloading.
                        </p>
                    </CardBody>
                </Card>
            </div>
        );
    }

    const approve = async () => {
        setGranting(true);
        try {
            const { data } = await fn('approveClaudeConnection')({ requestId });
            // Straight back to Claude with the code. Nothing is stored here.
            window.location.replace(data.redirectTo);
        } catch (e) {
            notify(e.message || 'The connection could not be completed.', 'error');
            setGranting(false);
        }
    };

    if (state.loading) return <div className="p-10"><Spinner /></div>;

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <Card className="w-full max-w-lg">
                <CardBody className="space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-sky-100 text-sky-700 rounded-lg"><Sparkles size={22} /></div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800">
                                Connect {state.client?.clientName || 'Claude'}
                            </h1>
                            <p className="text-sm text-slate-500">
                                to the National Child Health Programme
                            </p>
                        </div>
                    </div>

                    {state.error ? (
                        <div className="flex gap-2 bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <div>{state.error}</div>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm text-slate-700">
                                <div className="flex gap-2">
                                    <ShieldCheck size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <span>
                                        Claude will read programme data <strong>as you</strong> — exactly what
                                        your account can already open in this app, and nothing more.
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Database size={17} className="text-slate-500 shrink-0 mt-0.5" />
                                    <span>It can read. It cannot add, change or delete anything.</span>
                                </div>
                                <div className="flex gap-2">
                                    <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                                    <span>
                                        Every question it answers is recorded against your name, and what
                                        it reads leaves this system to be answered.
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500">
                                Signed in as <strong>{user?.email}</strong>. Approving sends you back to
                                {' '}{state.client?.redirectHost || 'Claude'}.
                            </p>

                            <div className="flex gap-2 justify-end">
                                <Button variant="secondary" onClick={onDone} disabled={granting}>Cancel</Button>
                                <Button onClick={approve} disabled={granting}>
                                    {granting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                    {granting ? 'Connecting…' : 'Allow'}
                                </Button>
                            </div>
                        </>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

// =============================================================================
// Chat
// =============================================================================

export function ClaudeChatPanel({ isOpen, onClose }) {
    const [messages, setMessages] = useState([]);
    const [question, setQuestion] = useState('');
    const [busy, setBusy] = useState(false);
    const endRef = useRef(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

    const ask = useCallback(async () => {
        const text = question.trim();
        if (!text || busy) return;
        setQuestion('');
        const asked = [...messages, { role: 'user', content: text }];
        setMessages(asked);
        setBusy(true);
        try {
            const { data } = await fn('claudeChat')({
                question: text,
                // Only the plain turns travel back, not the tool traffic: the
                // model rebuilds what it needs, and sending every row back on
                // each turn would grow the request without end.
                messages: messages.filter((m) => typeof m.content === 'string'),
            });
            setMessages([...asked, { role: 'assistant', content: data.reply, usedTools: data.usedTools }]);
        } catch (e) {
            setMessages([...asked, {
                role: 'assistant',
                content: e.message || 'That could not be answered.',
                failed: true,
            }]);
        } finally {
            setBusy(false);
        }
    }, [question, busy, messages]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
            <div className="w-full sm:max-w-lg bg-white h-full flex flex-col shadow-xl"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-slate-800 text-white shrink-0">
                    <Sparkles size={18} />
                    <span className="font-bold flex-1">Ask about the data</span>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-white/15"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-sm text-slate-500 space-y-3">
                            <p>Ask about the programme data you have access to. For example:</p>
                            <ul className="space-y-1.5">
                                {[
                                    'How many IMNCI courses were run in each state this year?',
                                    'Which localities have the lowest post-test scores?',
                                    'Compare planned against achieved for the current quarter.',
                                ].map((example) => (
                                    <li key={example}>
                                        <button onClick={() => setQuestion(example)}
                                            className="text-start text-sky-700 hover:underline">
                                            {example}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-xs text-slate-400 pt-2 border-t">
                                It reads only what your own account can open, and it cannot change
                                anything. Questions are recorded.
                            </p>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} className={m.role === 'user' ? 'text-end' : ''}>
                            <div className={`inline-block max-w-[90%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap text-start ${
                                m.role === 'user' ? 'bg-sky-600 text-white'
                                    : m.failed ? 'bg-red-50 border border-red-200 text-red-800'
                                        : 'bg-slate-100 text-slate-800'}`}>
                                {m.content}
                            </div>
                            {m.usedTools?.length > 0 && (
                                <div className="text-[11px] text-slate-400 mt-1">
                                    read: {[...new Set(m.usedTools.map((t) => t.input?.collection).filter(Boolean))].join(', ') || 'catalogue'}
                                </div>
                            )}
                        </div>
                    ))}

                    {busy && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 size={15} className="animate-spin" /> Reading the data…
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                <div className="p-3 border-t flex gap-2 shrink-0">
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
                        }}
                        rows={2}
                        placeholder="Ask a question…"
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-sky-500"
                    />
                    <Button onClick={ask} disabled={busy || !question.trim()} className="self-end">
                        <Send size={16} />
                    </Button>
                </div>
            </div>
        </div>
    );
}
