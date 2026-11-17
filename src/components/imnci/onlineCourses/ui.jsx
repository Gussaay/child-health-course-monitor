// src/components/imnci/onlineCourses/ui.jsx
//
// Small pieces of the online courses' look, shared by the course and section
// pages.
import React from 'react';

// A small pill used for the course's numbers and for each status.
const TONES = {
    done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    active: 'bg-sky-50 text-sky-800 border-sky-200',
    next: 'bg-amber-50 text-amber-800 border-amber-200',
    locked: 'bg-red-50 text-red-700 border-red-200',
    plain: 'bg-white text-slate-600 border-slate-200',
};
export function Pill({ tone = 'plain', children, className = '' }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold tracking-wide whitespace-nowrap ${TONES[tone]} ${className}`}>
            {children}
        </span>
    );
}

// A locked module or lesson says so plainly: a striped band with a padlock,
// what it is waiting for, and (on its own page) the way back to what must be
// done first. `compact` is the band across a card in a list.
export function LockedBanner({ title, reason, action, compact = false }) {
    const stripes = { backgroundImage: 'repeating-linear-gradient(135deg, rgba(100,116,139,0.10) 0 10px, rgba(100,116,139,0.02) 10px 20px)' };
    if (compact) {
        return (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600" style={stripes} data-testid="locked-banner">
                <LockIcon size={12} /> <span className="truncate">{title}</span>
                {reason && <span className="ms-auto normal-case tracking-normal font-semibold text-slate-500 truncate">{reason}</span>}
            </div>
        );
    }
    return (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 sm:p-6 text-center space-y-2" style={stripes} role="status" data-testid="locked-banner">
            <span className="mx-auto w-12 h-12 rounded-full bg-slate-700 text-white grid place-items-center"><LockIcon size={22} /></span>
            <div className="font-extrabold text-lg text-slate-900">{title}</div>
            {reason && <div className="text-sm text-slate-600 max-w-md mx-auto">{reason}</div>}
            {action}
        </div>
    );
}

// The red "Locked" badge on a module or lesson in a list. The row itself keeps
// its normal look; only the badge (and the padlock in its number circle) says
// it cannot be opened yet.
export function LockedBadge({ children }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold tracking-wide whitespace-nowrap" data-testid="locked-badge">
            <LockIcon size={11} /> {children}
        </span>
    );
}

// Inline padlock so this file stays free of the icon library's import cost.
function LockIcon({ size = 14 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
    );
}
