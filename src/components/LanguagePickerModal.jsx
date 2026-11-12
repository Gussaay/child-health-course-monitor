import React, { useState } from 'react';
import { Languages } from 'lucide-react';
import { setPreferredLanguage, currentLanguage } from '../utils/languagePreference';

// Shown once to a signed-in user who has no default language saved on their
// account. Both languages are written side by side because the user has not
// chosen yet. There is no close button: one tap on a language saves it.
const OPTIONS = [
    { code: 'ar', label: 'العربية', hint: 'Arabic', dir: 'rtl' },
    { code: 'en', label: 'English', hint: 'الإنجليزية', dir: 'ltr' },
];

export default function LanguagePickerModal({ onDone }) {
    const [saving, setSaving] = useState(null);
    const active = currentLanguage();

    const choose = async (code) => {
        if (saving) return;
        setSaving(code);
        await setPreferredLanguage(code);
        onDone?.(code);
    };

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="language-picker-title"
        >
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300">
                    <Languages size={24} />
                </div>
                <h2 id="language-picker-title" className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    <span dir="rtl" className="block">اختر لغتك المفضلة</span>
                    <span dir="ltr" className="block">Choose your language</span>
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span dir="rtl" className="block">ستُحفظ في حسابك وتُستخدم على كل أجهزتك. يمكنك تغييرها لاحقاً من زر E/ع.</span>
                    <span dir="ltr" className="block mt-1">It is saved on your account and used on all your devices. You can change it later with the E/ع button.</span>
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                    {OPTIONS.map((opt) => (
                        <button
                            key={opt.code}
                            type="button"
                            dir={opt.dir}
                            onClick={() => choose(opt.code)}
                            disabled={!!saving}
                            className={`rounded-xl border-2 px-3 py-4 transition-colors disabled:opacity-60 ${
                                active === opt.code
                                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30'
                                    : 'border-gray-200 dark:border-slate-600 hover:border-sky-400'
                            }`}
                        >
                            <span className="block text-lg font-bold text-gray-800 dark:text-gray-100">{opt.label}</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">{opt.hint}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
