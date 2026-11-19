// A small "Copy as image" button: puts the part of the page named by `target`
// (a ref) on the clipboard as a PNG, ready to paste into WhatsApp; where the
// browser cannot, it opens the share sheet or downloads the picture
// (utils/copyImage.js). Put it inside the card; it is left out of the picture.
import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { copyElementImage } from '../utils/copyImage';

export default function CopyImageButton({ target, fileName, label = '', title = '' }) {
    const [state, setState] = useState('');
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const onClick = async () => {
        if (state === 'busy') return;
        setState('busy');
        let next = '';
        try {
            const r = await copyElementImage(target.current, fileName, { title });
            next = r === 'copied' ? 'copied' : r === 'downloaded' ? 'downloaded' : r === 'shared' ? 'shared' : '';
        } catch (e) {
            console.error('Copy as image failed:', e);
            next = 'failed';
        }
        setState(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState(''), 2500);
    };
    const text = { busy: 'جارٍ النسخ…', copied: 'تم النسخ ✓', downloaded: 'تم التنزيل ✓', shared: 'تمت المشاركة ✓', failed: 'تعذّر النسخ' }[state] || label;
    return (
        <button type="button" onClick={onClick} disabled={state === 'busy'} title="نسخ كصورة · Copy as image"
            className={`exclude-from-export shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${state === 'failed' ? 'border-red-200 text-red-600 bg-red-50' : state && state !== 'busy' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-600 bg-white hover:text-sky-700 hover:border-sky-300 hover:bg-sky-50'}`}>
            {state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : state && state !== 'failed' ? <Check size={14} /> : <Copy size={14} />}
            {text && <span>{text}</span>}
        </button>
    );
}
