import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../utils/theme';

const ORDER = ['light', 'dark', 'system'];
const ICONS = { light: Sun, dark: Moon, system: Monitor };

/** One button that cycles light -> dark -> system. */
export default function ThemeToggle({ className = '', iconSize = 16 }) {
    const { t } = useTranslation();
    const [pref, setPref] = useTheme();
    const labels = {
        light: t('theme.light', 'Light mode'),
        dark: t('theme.dark', 'Dark mode'),
        system: t('theme.system', 'Follow device'),
    };
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    const Icon = ICONS[pref];
    return (
        <button
            type="button"
            onClick={() => setPref(next)}
            title={`${labels[pref]} — ${labels[next]}`}
            aria-label={`${t('theme.title', 'Appearance')}: ${labels[pref]}`}
            className={`p-1.5 text-sky-400 bg-slate-700 border border-slate-600 rounded hover:bg-slate-600 hover:text-sky-300 transition-colors flex items-center justify-center min-w-[32px] sm:min-w-[36px] ${className}`}
        >
            <Icon size={iconSize} />
        </button>
    );
}
