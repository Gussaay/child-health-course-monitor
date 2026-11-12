// src/components/QrScanLauncher.jsx
//
// The "Scan QR code" bar on the phone app's main menu, just above "Ask the
// data", and above the sign-in box when nobody is signed in. Kept apart from
// the scanner itself so the menu does not load the camera code.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';

export function ScanQrCard({ onOpen }) {
    const { t } = useTranslation();
    return (
        <button type="button" onClick={onOpen}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-2 ps-3 text-start hover:border-sky-400">
            <QrCode size={20} className="shrink-0 text-sky-600" />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">{t('qr_scanner.row_title', 'Scan QR code')}</span>
                <span className="block truncate text-xs text-slate-500">{t('qr_scanner.row_hint', 'Open a pre-test, post-test, evaluation or other app QR code here.')}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white">{t('qr_scanner.scan', 'Scan')}</span>
        </button>
    );
}
