// src/components/NameLanguageFields.jsx
// The two name boxes (English, Arabic) used wherever a participant is
// registered: Add participant, the online registration link, the pre-test
// form, and the public "your name for the certificate" link.
import React from 'react';
import { FormGroup, Input } from './CommonComponents';
import { participantNameOnly, hasArabicScript } from './constants';

/**
 * The participant's name in English and in Arabic, for the certificate in each
 * language. An empty box shows, greyed, the name it will take: the main name
 * when that is written in the box's language.
 */
export function NameLanguageFields({ name, nameEn, nameAr, setNameEn, setNameAr, disabled = false, L, only = null }) {
    const fromName = (lang) => participantNameOnly({ name }, lang);
    return (
        <div className={`grid gap-3 ${only ? '' : 'sm:grid-cols-2'}`} data-testid="name-language-fields">
            {only !== 'ar' && (
                <FormGroup label={L('الاسم بالإنجليزية (للشهادة الإنجليزية)', 'Name in English (English certificate)')}>
                    <Input dir="ltr" disabled={disabled} value={nameEn} onChange={(e) => setNameEn(e.target.value)}
                        placeholder={fromName('en') || L('مثال: Ahmed Mohamed Ali', 'e.g. Ahmed Mohamed Ali')} data-testid="name-en" />
                    {nameEn && hasArabicScript(nameEn) && <p className="text-xs text-amber-700 mt-1">{L('هذا الحقل للاسم بالحروف الإنجليزية.', 'This box is for the name in English letters.')}</p>}
                </FormGroup>
            )}
            {only !== 'en' && (
                <FormGroup label={L('الاسم بالعربية (للشهادة العربية)', 'Name in Arabic (Arabic certificate)')}>
                    <Input dir="rtl" disabled={disabled} value={nameAr} onChange={(e) => setNameAr(e.target.value)}
                        placeholder={fromName('ar') || L('مثال: أحمد محمد علي', 'e.g. أحمد محمد علي')} data-testid="name-ar" />
                    {nameAr && !hasArabicScript(nameAr) && <p className="text-xs text-amber-700 mt-1">{L('هذا الحقل للاسم بالحروف العربية.', 'This box is for the name in Arabic letters.')}</p>}
                </FormGroup>
            )}
        </div>
    );
}

