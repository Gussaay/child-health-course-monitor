// src/components/AiVote.jsx
//
// 👍 / 👎 under an AI answer. The vote goes on the answer's line in aiLog
// (functions/aiLog.js aiVote), which the super users see on Admin › AI
// activity. Votes are also kept on this device, so a saved answer shows how
// it was rated.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

const KEY = 'aiVotes.v1';
const readVotes = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
};
const keepVote = (logId, vote) => {
    try {
        const all = readVotes();
        if (vote) all[logId] = vote; else delete all[logId];
        // Only the latest 300 are kept.
        const ids = Object.keys(all);
        ids.slice(0, Math.max(0, ids.length - 300)).forEach((id) => delete all[id]);
        localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* storage may be off */ }
};

export default function AiVote({ logId, className = '' }) {
    const { t } = useTranslation();
    const [vote, setVote] = useState(() => (logId ? readVotes()[logId] || 0 : 0));
    const [busy, setBusy] = useState(false);
    if (!logId) return null;

    const cast = async (v) => {
        const next = vote === v ? 0 : v;
        const before = vote;
        setVote(next);
        setBusy(true);
        try {
            await httpsCallable(getFunctions(), 'aiVote')({ logId, vote: next });
            keepVote(logId, next);
        } catch {
            setVote(before);
        } finally {
            setBusy(false);
        }
    };

    const btn = (v, Icon, label, on) => (
        <button type="button" onClick={() => cast(v)} disabled={busy} aria-pressed={vote === v} title={label} aria-label={label}
            className={`rounded p-1 disabled:opacity-50 ${vote === v ? on : 'hover:text-slate-600'}`}>
            <Icon size={13} fill={vote === v ? 'currentColor' : 'none'} />
        </button>
    );
    return (
        <span className={`inline-flex items-center ${className}`}>
            {btn(1, ThumbsUp, t('ai_vote.good', 'Good answer'), 'text-emerald-600')}
            {btn(-1, ThumbsDown, t('ai_vote.bad', 'Poor answer'), 'text-red-500')}
        </span>
    );
}
