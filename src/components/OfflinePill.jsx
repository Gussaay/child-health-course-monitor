// src/components/OfflinePill.jsx
//
// A small "Offline" pill while there is no internet.
//
// This replaces the full-width amber bar that pushed the whole header down and
// covered the top of every page. The pill floats at the top of the screen and:
//   - takes no layout space, so nothing on the page moves when it appears;
//   - lets taps pass through (pointer-events-none), so it never blocks a button;
//   - shows a word for a few seconds, then shrinks to an icon.
// It asks nothing. Writes are already queued offline (data.js
// executeOfflineSafeWrite) and firebase.js keeps re-checking the connection,
// so the pill simply disappears when the internet is back.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { useConnectivity } from '../firebase';

const LABEL_MS = 4000; // how long the word stays before the pill shrinks

export default function OfflinePill() {
    const { t } = useTranslation();
    const net = useConnectivity();
    const broken = net.status === 'offline' || net.status === 'no-internet';
    const [showLabel, setShowLabel] = useState(true);

    // Each new episode shows the word again, then shrinks.
    useEffect(() => {
        if (!broken) return undefined;
        setShowLabel(true);
        const timer = setTimeout(() => setShowLabel(false), LABEL_MS);
        return () => clearTimeout(timer);
    }, [broken]);

    if (!broken) return null;

    const label = net.status === 'offline'
        ? t('app.offline_pill', 'Offline')
        : t('app.no_internet_pill', 'No internet');

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={t('app.offline_pill_label', 'Offline. Showing saved data; changes sync later.')}
            className="pointer-events-none fixed inset-x-0 z-[100006] flex justify-center"
            style={{ top: 'calc(var(--app-top, 56px) + 6px)' }} // just under the header
        >
            <span
                data-testid="offline-pill"
                className="flex items-center gap-1.5 rounded-full bg-amber-500/90 px-2 py-1 text-[11px] font-bold text-white shadow-md transition-all"
            >
                <WifiOff className="w-3 h-3 shrink-0" />
                {showLabel && <span>{label}</span>}
            </span>
        </div>
    );
}
