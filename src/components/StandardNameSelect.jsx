// StandardNameSelect.jsx
//
// A project or organization picked from the standard list, with a way to add
// a new one. Before a new name is added, names that look like it are offered
// first, so "Unisef" or "share project" become UNICEF and SHARE rather than
// new entries.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStandardNames } from '../hooks/useNameRegistry';
import { useDataCache } from '../DataContext';
import { findSimilarNames, normalizeKey, tidyName } from '../utils/nameRegistry';

const TEXT = {
    ar: {
        placeholder: 'اختر من القائمة...',
        search: 'ابحث أو اكتب اسماً جديداً...',
        none: 'لا توجد نتائج',
        add: (v) => `إضافة "${v}" كاسم جديد`,
        similarTitle: 'هل تقصد أحد هذه الأسماء الموجودة؟',
        similarHint: 'يوجد اسم مشابه مسجل مسبقاً. استخدمه حتى لا يتكرر نفس الاسم بكتابات مختلفة.',
        use: 'استخدم',
        addAnyway: (v) => `لا، أضف "${v}" كاسم جديد`,
        back: 'رجوع',
        standard: (v) => `الاسم الموحد: ${v}`,
        useStandard: 'استخدم الاسم الموحد',
        clear: 'مسح',
    },
    en: {
        placeholder: 'Choose from the list...',
        search: 'Search or type a new name...',
        none: 'No matches',
        add: (v) => `Add "${v}" as a new name`,
        similarTitle: 'Did you mean one of these?',
        similarHint: 'A similar name is already recorded. Use it so the same name is not stored with different spellings.',
        use: 'Use',
        addAnyway: (v) => `No, add "${v}" as new`,
        back: 'Back',
        standard: (v) => `Standard name: ${v}`,
        useStandard: 'Use the standard name',
        clear: 'Clear',
    },
};

/**
 * @param {object} props
 * @param {'projects'|'organizations'} props.kind
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string[]} [props.observedValues]  spellings already in the data on this screen
 * @param {string} [props.facilityField]  otherwise, the facility field whose recorded
 *        names (from facilities already loaded on this device) are offered too
 * @param {boolean} [props.disabled]
 * @param {'ar'|'en'} [props.lang]
 */
export default function StandardNameSelect({ kind, value, onChange, observedValues, facilityField, disabled = false, lang = 'ar' }) {
    const t = TEXT[lang] || TEXT.ar;
    const facilities = useDataCache()?.healthFacilities;
    const observed = useMemo(() => {
        if (observedValues) return observedValues;
        if (!facilityField || !Array.isArray(facilities)) return [];
        return facilities.map((f) => f?.[facilityField]).filter(Boolean);
    }, [observedValues, facilityField, facilities]);
    const { options, canonicalize, addName } = useStandardNames(kind, observed);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [pendingNew, setPendingNew] = useState(null); // { text, similar }
    const wrapperRef = useRef(null);

    useEffect(() => {
        const close = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) { setOpen(false); setPendingNew(null); } };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const current = tidyName(value);
    const standard = current ? canonicalize(current) : '';
    const isNonStandard = current && standard && standard !== current;

    const filtered = useMemo(() => {
        const q = normalizeKey(query);
        if (!q) return options;
        return options.filter((o) => normalizeKey(o).includes(q));
    }, [options, query]);

    const typed = tidyName(query);
    const exact = typed ? options.find((o) => normalizeKey(o) === normalizeKey(typed) || normalizeKey(canonicalize(typed)) === normalizeKey(o)) : null;

    const choose = (name) => {
        onChange(name);
        setOpen(false);
        setQuery('');
        setPendingNew(null);
    };

    const requestAdd = () => {
        if (!typed) return;
        // Already known under another spelling: use the standard one, no question needed.
        if (exact) { choose(exact); return; }
        const similar = findSimilarNames(typed, options);
        if (similar.length) { setPendingNew({ text: typed, similar }); return; }
        confirmAdd(typed);
    };

    const confirmAdd = (text) => {
        choose(addName(text) || text);
    };

    return (
        <div ref={wrapperRef} className="relative" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                className="w-full border border-gray-300 rounded-md p-2 text-start bg-white flex items-center justify-between gap-2 disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-sky-500"
            >
                <span className={current ? 'text-gray-900' : 'text-gray-400'}>{current || t.placeholder}</span>
                <span className="text-gray-400 text-xs">▾</span>
            </button>

            {isNonStandard && !disabled && (
                <div className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-center justify-between gap-2">
                    <span>{t.standard(standard)}</span>
                    <button type="button" className="font-bold underline" onClick={() => onChange(standard)}>{t.useStandard}</button>
                </div>
            )}

            {open && !disabled && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
                    {pendingNew ? (
                        <div className="p-3 space-y-2">
                            <div className="font-semibold text-sm text-gray-800">{t.similarTitle}</div>
                            <p className="text-xs text-gray-600">{t.similarHint}</p>
                            {pendingNew.similar.map((m) => (
                                <button key={m.name} type="button" onClick={() => choose(m.name)}
                                    className="w-full text-start px-3 py-2 rounded border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sm flex justify-between">
                                    <span className="font-semibold">{m.name}</span>
                                    <span className="text-sky-700">{t.use}</span>
                                </button>
                            ))}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button type="button" onClick={() => confirmAdd(pendingNew.text)} className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">{t.addAnyway(pendingNew.text)}</button>
                                <button type="button" onClick={() => setPendingNew(null)} className="text-xs px-3 py-1.5 text-gray-500">{t.back}</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (filtered.length === 1 && !typed) choose(filtered[0]); else requestAdd(); } }}
                                placeholder={t.search}
                                className="w-full p-2 border-b border-gray-200 text-sm focus:outline-none"
                            />
                            <ul className="max-h-56 overflow-y-auto text-sm">
                                {filtered.map((o) => (
                                    <li key={o}>
                                        <button type="button" onClick={() => choose(o)}
                                            className={`w-full text-start px-3 py-2 hover:bg-sky-50 ${o === standard ? 'bg-sky-50 font-semibold' : ''}`}>
                                            {o}
                                        </button>
                                    </li>
                                ))}
                                {filtered.length === 0 && !typed && <li className="px-3 py-2 text-gray-400">{t.none}</li>}
                                {typed && !exact && (
                                    <li>
                                        <button type="button" onClick={requestAdd} className="w-full text-start px-3 py-2 text-sky-700 font-semibold hover:bg-sky-50 border-t border-gray-100">
                                            + {t.add(typed)}
                                        </button>
                                    </li>
                                )}
                                {current && (
                                    <li>
                                        <button type="button" onClick={() => choose('')} className="w-full text-start px-3 py-2 text-gray-500 hover:bg-gray-50 border-t border-gray-100">{t.clear}</button>
                                    </li>
                                )}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
