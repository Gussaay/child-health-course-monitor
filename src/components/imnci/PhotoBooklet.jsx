// ============================================================================
// PHOTOGRAPH BOOKLET
//
// The IMNCI photograph booklet (photographs 1 to 82) as its own part of
// Protocol management. The pictures live once in Storage
// (online-courses/imnci-photos/photo-NN.jpg) and every course that needs a
// photograph points at the same file, so a photograph replaced here is
// replaced everywhere. Captions are the explanations printed in the books;
// an exercise photograph carries the exercise question instead.
// ============================================================================
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Images } from 'lucide-react';
import { BookImage } from './onlineCourses/blocks';
import BOOKLET from './photoBooklet.json';

export const PHOTO_SECTIONS = BOOKLET.sections;
export const PHOTOS = BOOKLET.photos;

/** The Storage path (under online-courses/) of photograph n. */
export const photoPath = (n) => PHOTOS.find((p) => p.n === Number(n))?.file || null;

const sectionOf = (n) => PHOTO_SECTIONS.find((s) => n >= s.from && n <= s.to);

export default function PhotoBooklet() {
    const { t } = useTranslation();
    const [section, setSection] = useState('all');
    const [find, setFind] = useState('');

    const shown = useMemo(() => {
        const q = find.trim();
        return PHOTO_SECTIONS
            .filter((s) => section === 'all' || s.id === section)
            .map((s) => ({
                ...s,
                photos: PHOTOS.filter((p) => p.n >= s.from && p.n <= s.to)
                    .filter((p) => !q || String(p.n) === q || p.caption.toLowerCase().includes(q.toLowerCase())),
            }))
            .filter((s) => s.photos.length);
    }, [section, find]);

    return (
        <div className="space-y-5" data-testid="photo-booklet">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 me-auto">
                    <Images size={18} /> {t('clinical_ui.protocol.photos.title', 'Photograph booklet')}
                    <span className="text-xs font-normal text-slate-500">
                        {t('clinical_ui.protocol.photos.count', '{{count}} photographs', { count: PHOTOS.length })}
                    </span>
                </h3>
                <select value={section} onChange={(e) => setSection(e.target.value)}
                    className="p-2 border border-slate-300 rounded text-sm" aria-label={t('clinical_ui.protocol.photos.section', 'Section')}>
                    <option value="all">{t('clinical_ui.protocol.photos.all', 'All sections')}</option>
                    {PHOTO_SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.from}–{s.to} · {s.title}</option>)}
                </select>
                <input type="search" value={find} onChange={(e) => setFind(e.target.value)}
                    placeholder={t('clinical_ui.protocol.photos.find', 'Photograph number or word…')}
                    className="w-full sm:w-56 p-2 border border-slate-300 rounded text-sm" />
            </div>
            <p className="text-xs text-slate-600">
                {t('clinical_ui.protocol.photos.hint', 'These are the photographs the course modules use. Tap a photograph to see it full size.')}
            </p>
            {shown.length === 0 && <p className="text-sm text-slate-500">{t('clinical_ui.protocol.photos.none', 'No photograph matches.')}</p>}
            {shown.map((s) => (
                <section key={s.id} className="space-y-2">
                    <h4 className="font-bold text-sky-800 border-b border-slate-200 pb-1">
                        {s.title} <span className="text-xs font-normal text-slate-500">· {s.module} · {s.from}–{s.to}</span>
                    </h4>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {s.photos.map((p) => (
                            <div key={p.n} id={`photo-${p.n}`} className="bg-white border border-slate-200 rounded-lg p-2" data-testid="booklet-photo">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold bg-sky-700 text-white rounded px-2 py-0.5">
                                        {t('clinical_ui.protocol.photos.n', 'Photograph {{n}}', { n: p.n })}
                                    </span>
                                    {p.use && <span className="text-[11px] text-slate-500">{p.use}</span>}
                                </div>
                                <BookImage block={{ type: 'image', path: p.file, alt: `${p.n}` }} />
                                <p className="text-sm text-slate-700">{p.caption}</p>
                                {p.answer && (
                                    <details className="mt-1 text-sm">
                                        <summary className="cursor-pointer text-sky-800 font-semibold">{t('clinical_ui.protocol.photos.answer', 'Show the answer')}</summary>
                                        <p className="text-slate-700 mt-1" data-testid="photo-answer">{p.answer}</p>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

export { sectionOf };
