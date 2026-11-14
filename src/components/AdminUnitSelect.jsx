// src/components/AdminUnitSelect.jsx
//
// The third level of the place cascade: state → locality → administrative
// unit (ADMIN_UNITS). Any form can use it under its locality picker:
//
//   <AdminUnitSelect stateKey={s} localityKey={l} value={unit} onChange={setUnit} />
//
// The value is the unit's Arabic name, as in the Ministry list. "Other" (and
// any locality with no listed units) takes free text, so a missing unit never
// blocks a form.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminUnitsFor } from './adminUnits';

const FIELD = 'w-full min-w-0 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-500';
const OTHER = '__other__';

export default function AdminUnitSelect({ stateKey, localityKey, value = '', onChange, disabled = false, id }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const units = adminUnitsFor(stateKey, localityKey);
    const listed = !value || units.some((u) => u.ar === value);
    const [typing, setTyping] = useState(!listed);
    // A new locality starts from its own list again.
    useEffect(() => { setTyping(false); }, [stateKey, localityKey]);

    if (!units.length) {
        return (
            <input id={id} disabled={disabled} className={FIELD} value={value || ''} onChange={(e) => onChange(e.target.value)}
                placeholder={localityKey ? t('admin_units.type', 'Type the administrative unit') : t('admin_units.pick_locality', 'Choose the locality first')} />
        );
    }
    const showText = typing || !listed;
    return (
        <div className="space-y-2">
            <select id={id} disabled={disabled} className={FIELD}
                value={showText ? OTHER : value || ''}
                onChange={(e) => {
                    if (e.target.value === OTHER) { setTyping(true); onChange(''); return; }
                    setTyping(false); onChange(e.target.value);
                }}>
                <option value="">{t('admin_units.select', 'Select…')}</option>
                {units.map((u) => <option key={u.ar} value={u.ar}>{isArabic ? u.ar : `${u.en} (${u.ar})`}</option>)}
                <option value={OTHER}>{t('admin_units.other', 'Other (type it)')}</option>
            </select>
            {showText && (
                <input disabled={disabled} className={FIELD} value={value || ''} autoFocus={typing && !value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={t('admin_units.type', 'Type the administrative unit')} />
            )}
        </div>
    );
}
