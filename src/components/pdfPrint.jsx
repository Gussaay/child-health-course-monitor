// Print mode for forms saved as PDF (see FormPdfButton).
//
// While a form is being saved as a PDF it switches to "print mode": every step
// and section is shown, folded sections are opened, and fields that normally
// appear only after a certain answer are shown too, each with a short note of
// the answer that brings it up ("Shown only if ..."). So the PDF is the whole
// form: a blank one to fill by hand, or a filled one with every question.
//
// How a form uses it:
//   const { printAll, beforeExport } = usePrintMode();
//   <PrintModeProvider value={printAll}> ...form... </PrintModeProvider>
//   <FormPdfButton beforeExport={beforeExport} ... />
// and in the form: show a part when (its condition || printAll), and put
// <ConditionNote>...</ConditionNote> next to it. Folded sections read
// usePrintAll() and open themselves.
import React, { createContext, useCallback, useContext, useState } from 'react';

const PrintAllContext = createContext(false);

export const PrintModeProvider = ({ value, children }) => (
    <PrintAllContext.Provider value={!!value}>{children}</PrintAllContext.Provider>
);

/** True while the form around it is being saved as a PDF. */
export const usePrintAll = () => useContext(PrintAllContext);

/**
 * State for a form's print mode. beforeExport (for FormPdfButton) turns it on
 * and returns the function that turns it off again after the capture.
 * extra: optional; runs too, and may return its own undo function.
 */
export function usePrintMode(extra) {
    const [printAll, setPrintAll] = useState(false);
    const beforeExport = useCallback(async () => {
        setPrintAll(true);
        const undo = extra ? await extra() : null;
        return () => {
            setPrintAll(false);
            if (typeof undo === 'function') undo();
        };
    }, [extra]);
    return { printAll, beforeExport };
}

const isArabic = (s) => /[؀-ۿ]/.test(String(s || ''));

/**
 * A short line under a field that only appears after a certain answer, shown
 * only in the PDF. children: the condition, e.g. 'Answer "Yes" to: Fever'.
 * The prefix ("Shown only if" / "يظهر فقط إذا") follows the text's language
 * unless lang is given.
 */
export const ConditionNote = ({ children, lang, className = '', force = false }) => {
    const printAll = usePrintAll();
    if (!printAll && !force) return null;
    const ar = lang ? lang === 'ar' : isArabic(typeof children === 'string' ? children : '');
    return (
        <div
            data-pdf-condition=""
            dir={ar ? 'rtl' : 'ltr'}
            className={`mx-1 my-1 rounded border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ${className}`}
        >
            {ar ? 'يظهر فقط إذا: ' : 'Shown only if: '}
            {children}
        </div>
    );
};

/** Joins choices for a condition note: «a» أو «b» / "a" or "b". */
export const anyOf = (values, ar = true) => values.map((v) => (ar ? `«${v}»` : `"${v}"`)).join(ar ? ' أو ' : ' or ');
