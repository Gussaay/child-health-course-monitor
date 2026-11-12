// "Print / PDF" button for a form. It saves the form as an A4 PDF under the
// official letterhead (FMOH and program logos, the program lines and the
// form's name), ready to print. Put it anywhere inside the form: it prints the
// element given in targetRef, else the nearest [data-pdf-root], else the
// nearest <form>. The button itself never appears in the PDF.
// beforeExport: optional; runs first (for example to open every folded
// section so the whole form is printed) and may return a function that puts
// things back afterwards.
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';

export default function FormPdfButton({ formName, subtitle = '', fileName, targetRef, beforeExport, className = '', compact = false }) {
    const { t } = useTranslation();
    const btnRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const handleClick = async () => {
        setError('');
        const btn = btnRef.current;
        const root = targetRef?.current || btn?.closest('[data-pdf-root]') || btn?.closest('form');
        if (!root) { setError(t('form_pdf.not_found', 'Could not find the form to print.')); return; }
        setBusy(true);
        let restore = null;
        try {
            const { exportFormPdf } = await import('../utils/formPdf');
            if (beforeExport) {
                restore = await beforeExport();
                // Let React draw what was just opened before it is captured.
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50))));
            }
            await exportFormPdf(root, { formName, subtitle, fileName });
        } catch (e) {
            console.error('Form PDF failed:', e);
            setError(t('form_pdf.failed', 'Could not make the PDF: {{error}}', { error: e?.message || '' }));
        } finally {
            if (typeof restore === 'function') restore();
            setBusy(false);
        }
    };

    const label = busy ? t('form_pdf.preparing', 'Preparing PDF...') : t('form_pdf.button', 'Print / PDF');
    return (
        <span data-pdf-hide="" className={`inline-flex flex-col items-end gap-1 ${className}`}>
            <button
                ref={btnRef}
                type="button"
                onClick={handleClick}
                disabled={busy}
                title={t('form_pdf.hint', 'Save this form as a PDF with the ministry letterhead, ready to print')}
                aria-label={label}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-sky-50 hover:text-sky-800 disabled:cursor-wait disabled:opacity-60"
            >
                <Printer size={16} aria-hidden="true" className={busy ? 'animate-pulse' : ''} />
                {!compact && <span>{label}</span>}
            </button>
            {error && <span role="alert" className="max-w-xs text-xs font-semibold text-red-600">{error}</span>}
        </span>
    );
}
