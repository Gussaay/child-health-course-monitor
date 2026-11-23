// src/components/PublicCertificateNames.jsx
//
// A public link a course shares so each participant writes their own name as it
// should be printed on the certificate:
//
//   /public/course/names/<courseId>            the name in English and in Arabic
//   /public/course/names/<courseId>?lang=ar    the Arabic name only
//   /public/course/names/<courseId>?lang=en    the English name only
//
// The participant finds themself in the course list and confirms the last four
// digits of the phone number on their record (when it has one), so a link
// passed around a group does not let one person change another's name. Only
// nameEn / nameAr are written; everything else on the record is left as it is.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Search, UserCheck } from 'lucide-react';
import { Card, Button, FormGroup, Input, EmptyState, PageSkeleton } from './CommonComponents';
import { getCourseById, getCachedParticipants, upsertParticipant } from '../data';
import { participantNameOnly, hasArabicScript } from './constants';
import { NameLanguageFields } from './Participants';
import { courseStateText } from './constants';

/** The language the link asks for: 'en', 'ar' or null for both. */
export const namesLinkLanguage = (search = (typeof window !== 'undefined' ? window.location.search : '')) => {
    const l = new URLSearchParams(search).get('lang');
    return l === 'ar' || l === 'en' ? l : null;
};

/** The link to share: both names, or only the one in `language`. */
export const certificateNamesLink = (baseUrl, courseId, language = null) =>
    `${baseUrl}/public/course/names/${courseId}${language === 'ar' || language === 'en' ? `?lang=${language}` : ''}`;

const digits = (v) => String(v || '').replace(/\D/g, '');

/** True when `typed` is the last four digits of the record's phone (or the record has none). */
export const phoneConfirms = (participant, typed) => {
    const phone = digits(participant?.phone);
    if (phone.length < 4) return true;
    return digits(typed).slice(-4) === phone.slice(-4) && digits(typed).length >= 4;
};

export default function PublicCertificateNamesView({ courseId }) {
    const { t, i18n } = useTranslation();
    const only = namesLinkLanguage();
    // The page speaks the language of the name it asks for.
    const ar = only ? only === 'ar' : i18n.language === 'ar';
    const L = (a, e) => (ar ? a : e);

    const [course, setCourse] = useState(null);
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [picked, setPicked] = useState(null);
    const [phone, setPhone] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [nameEn, setNameEn] = useState('');
    const [nameAr, setNameAr] = useState('');
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        Promise.all([getCourseById(courseId, 'server'), getCachedParticipants(courseId, { force: true })])
            .then(([c, list]) => {
                if (!c) throw new Error(L('لم يتم العثور على الدورة.', 'Course not found.'));
                setCourse(c);
                setPeople((list || []).filter((p) => !p.isPractice).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        return people.filter((p) => [p.name, p.nameEn, p.nameAr].some((n) => String(n || '').toLowerCase().includes(q))).slice(0, 12);
    }, [people, query]);

    const pick = (p) => {
        setPicked(p); setPhone(''); setConfirmed(!digits(p.phone) || digits(p.phone).length < 4);
        setNameEn(participantNameOnly(p, 'en')); setNameAr(participantNameOnly(p, 'ar'));
    };

    const save = async () => {
        const en = nameEn.trim(), arName = nameAr.trim();
        if (only !== 'ar' && !en) return setError(L('اكتب اسمك بالإنجليزية.', 'Write your name in English.'));
        if (only !== 'en' && !arName) return setError(L('اكتب اسمك بالعربية.', 'Write your name in Arabic.'));
        if (en && hasArabicScript(en)) return setError(L('اكتب الاسم الإنجليزي بالحروف الإنجليزية.', 'Write the English name in English letters.'));
        if (arName && !hasArabicScript(arName)) return setError(L('اكتب الاسم العربي بالحروف العربية.', 'Write the Arabic name in Arabic letters.'));
        setSaving(true); setError('');
        try {
            await upsertParticipant({ id: picked.id, ...(only !== 'ar' ? { nameEn: en } : {}), ...(only !== 'en' ? { nameAr: arName } : {}) });
            setDone(true);
        } catch (e) {
            setError(e.message || L('تعذر الحفظ، حاول مرة أخرى.', 'Could not save. Try again.'));
        } finally { setSaving(false); }
    };

    if (loading) return <PageSkeleton />;
    if (!course) return <EmptyState message={error || L('الرابط غير صالح.', 'Invalid link.')} />;

    const heading = only === 'ar' ? L('اسمك بالعربية للشهادة', 'Your name in Arabic for the certificate')
        : only === 'en' ? L('اسمك بالإنجليزية للشهادة', 'Your name in English for the certificate')
        : L('اسمك للشهادة بالعربية والإنجليزية', 'Your name for the certificate, in English and Arabic');

    return (
        <div className="max-w-xl mx-auto mt-6 p-4" dir={ar ? 'rtl' : 'ltr'} data-testid="certificate-names-page">
            <Card className="p-6 space-y-5">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 bg-sky-100 rounded-full flex items-center justify-center mb-3"><UserCheck className="h-8 w-8 text-sky-600" /></div>
                    <h1 className="text-xl font-bold text-gray-900">{heading}</h1>
                    <p className="text-sm text-gray-600 mt-1">{course.course_type}{courseStateText(course) ? ` · ${courseStateText(course)}` : ''}{course.start_date ? ` · ${course.start_date}` : ''}</p>
                    <p className="text-xs text-gray-500 mt-2">{L('اكتب اسمك كما تريده أن يُطبع على الشهادة.', 'Write your name exactly as it should be printed on your certificate.')}</p>
                </div>

                {done ? (
                    <div className="text-center space-y-3" data-testid="names-saved">
                        <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                        <p className="font-semibold text-gray-800">{L('تم حفظ اسمك. شكراً.', 'Your name is saved. Thank you.')}</p>
                        <Button variant="secondary" onClick={() => { setDone(false); setPicked(null); setQuery(''); }}>{L('اسم مشارك آخر', 'Another participant')}</Button>
                    </div>
                ) : !picked ? (
                    <div className="space-y-2">
                        <FormGroup label={L('ابحث عن اسمك في قائمة الدورة', 'Find your name in the course list')}>
                            <div className="relative">
                                <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400" />
                                <input value={query} onChange={(e) => setQuery(e.target.value)} data-testid="names-search"
                                    className="w-full ps-9 pe-3 py-2 rounded-lg border border-gray-300 text-sm" placeholder={L('اكتب جزءاً من اسمك', 'Type part of your name')} />
                            </div>
                        </FormGroup>
                        {query.trim().length >= 2 && (shown.length ? (
                            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                                {shown.map((p) => (
                                    <li key={p.id}>
                                        <button type="button" onClick={() => pick(p)} className="w-full text-start px-3 py-2.5 hover:bg-sky-50">
                                            <span className="font-semibold text-gray-800">{p.name}</span>
                                            {p.group && <span className="text-xs text-gray-500 ms-2">{p.group}</span>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-sm text-gray-500">{L('لم نجد هذا الاسم. اطلب من منسق الدورة إضافتك.', 'Not found. Ask the course coordinator to add you.')}</p>)}
                    </div>
                ) : !confirmed ? (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-700"><strong>{picked.name}</strong></p>
                        <FormGroup label={L('آخر 4 أرقام من رقم هاتفك المسجل', 'The last 4 digits of your registered phone number')}>
                            <Input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="names-phone" />
                        </FormGroup>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <div className="flex gap-2">
                            <Button onClick={() => { if (phoneConfirms(picked, phone)) { setConfirmed(true); setError(''); } else setError(L('الرقم لا يطابق المسجل.', 'That does not match the number on record.')); }}>{L('متابعة', 'Continue')}</Button>
                            <Button variant="secondary" onClick={() => { setPicked(null); setError(''); }}>{L('رجوع', 'Back')}</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700">{L('الاسم في سجل الدورة:', 'Name in the course record:')} <strong>{picked.name}</strong></p>
                        <NameLanguageFields name={picked.name} nameEn={nameEn} nameAr={nameAr} setNameEn={setNameEn} setNameAr={setNameAr} disabled={saving} L={L} only={only} />
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <div className="flex gap-2">
                            <Button onClick={save} disabled={saving} data-testid="names-save">{saving ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ الاسم', 'Save my name')}</Button>
                            <Button variant="secondary" onClick={() => { setPicked(null); setError(''); }} disabled={saving}>{L('رجوع', 'Back')}</Button>
                        </div>
                    </div>
                )}
            </Card>
            <p className="text-center text-xs text-gray-400 mt-3">{t('app_extra.footer_short', 'Child Health Program')}</p>
        </div>
    );
}
