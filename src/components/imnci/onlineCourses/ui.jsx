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
    locked: 'bg-slate-100 text-slate-500 border-slate-200',
    plain: 'bg-white text-slate-600 border-slate-200',
};
export function Pill({ tone = 'plain', children, className = '' }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold tracking-wide whitespace-nowrap ${TONES[tone]} ${className}`}>
            {children}
        </span>
    );
}
