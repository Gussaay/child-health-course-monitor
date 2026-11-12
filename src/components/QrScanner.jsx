// src/components/QrScanner.jsx
//
// The phone app's QR scanner. Reads the app's own QR codes (pre-test,
// post-test, daily evaluation, attendance, registration, certificates,
// mentorship and the rest) and opens the page in the app straight away,
// signed in or not. Any other code is shown with a way to open or copy it.
//
// The camera is read in the page itself (getUserMedia), so the scanner works
// from a live update without a new APK. When the camera cannot be opened
// (permission refused, or an older APK that never asked for it), a photo of
// the code, taken or chosen from the gallery, is read instead.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Camera, Image as ImageIcon, Link2, ExternalLink, Copy, RotateCcw, QrCode, Loader2 } from 'lucide-react';
import { parseScannedCode } from '../utils/appLinks';
import { addInPageBack } from '../utils/inPageBack';

// The fastest reader the phone has: Android's own (BarcodeDetector) where the
// WebView offers it, otherwise jsQR, loaded only when the scanner opens.
let decoderPromise = null;
function getDecoder() {
    if (!decoderPromise) {
        decoderPromise = (async () => {
            try {
                if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
                    const formats = await window.BarcodeDetector.getSupportedFormats();
                    if (formats.includes('qr_code')) {
                        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                        return async (source) => {
                            const found = await detector.detect(source);
                            return found?.[0]?.rawValue || null;
                        };
                    }
                }
            } catch { /* fall back to jsQR */ }
            const { default: jsQR } = await import('jsqr');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            return async (source, { thorough = false } = {}) => {
                const w = source.videoWidth || source.naturalWidth || source.width;
                const h = source.videoHeight || source.naturalHeight || source.height;
                if (!w || !h) return null;
                const scale = Math.min(1, (thorough ? 1280 : 720) / Math.max(w, h));
                canvas.width = Math.round(w * scale);
                canvas.height = Math.round(h * scale);
                ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(img.data, img.width, img.height, { inversionAttempts: thorough ? 'attemptBoth' : 'dontInvert' });
                return code?.data || null;
            };
        })();
    }
    return decoderPromise;
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 0); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
        img.src = url;
    });
}

async function openExternal(url) {
    try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url });
    } catch {
        window.open(url, '_blank', 'noopener');
    }
}

export default function QrScanner({ open, onClose, onOpenLink }) {
    const { t } = useTranslation();
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const loopRef = useRef(null);
    const doneRef = useRef(false);
    const photoInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    // 'starting' | 'live' | 'blocked'
    const [camera, setCamera] = useState('starting');
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [typing, setTyping] = useState(false);
    const [typed, setTyped] = useState('');
    const [copied, setCopied] = useState(false);

    const stopCamera = useCallback(() => {
        if (loopRef.current) { clearTimeout(loopRef.current); loopRef.current = null; }
        if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    // One code read: the app's own links open at once, anything else is shown.
    const handleCode = useCallback((text) => {
        if (doneRef.current || !text) return;
        doneRef.current = true;
        stopCamera();
        try { navigator.vibrate?.(60); } catch { /* not offered */ }
        const parsed = parseScannedCode(text);
        if (parsed.type === 'app') { onOpenLink(parsed); return; }
        setResult(parsed);
    }, [onOpenLink, stopCamera]);

    const startCamera = useCallback(async () => {
        doneRef.current = false;
        setResult(null); setNotice(''); setCopied(false);
        setCamera('starting');
        if (!navigator.mediaDevices?.getUserMedia) { setCamera('blocked'); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            if (doneRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
            streamRef.current = stream;
            const video = videoRef.current;
            if (!video) { stopCamera(); return; }
            video.srcObject = stream;
            video.setAttribute('playsinline', 'true');
            await video.play().catch(() => {});
            setCamera('live');
            const decode = await getDecoder();
            const tick = async () => {
                if (doneRef.current || !streamRef.current) return;
                try {
                    if (video.readyState >= 2) {
                        const text = await decode(video);
                        if (text) { handleCode(text); return; }
                    }
                } catch { /* a frame that cannot be read; try the next */ }
                loopRef.current = setTimeout(tick, 180);
            };
            tick();
        } catch {
            stopCamera();
            setCamera('blocked');
        }
    }, [handleCode, stopCamera]);

    useEffect(() => {
        if (!open) return undefined;
        startCamera();
        return () => { doneRef.current = true; stopCamera(); };
    }, [open, startCamera, stopCamera]);

    // The phone's back button (and Escape) closes the scanner, not the page under it.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const removeBack = addInPageBack(onClose);
        return () => { window.removeEventListener('keydown', onKey); removeBack(); };
    }, [open, onClose]);

    const readPhoto = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setBusy(true); setNotice('');
        try {
            const img = await loadImage(file);
            const decode = await getDecoder();
            const text = await decode(img, { thorough: true });
            if (text) { doneRef.current = false; handleCode(text); }
            else setNotice(t('qr_scanner.no_code_in_photo', 'No QR code was found in that picture. Try again closer, with the whole code in view.'));
        } catch {
            setNotice(t('qr_scanner.photo_failed', 'That picture could not be read.'));
        } finally {
            setBusy(false);
        }
    };

    const submitTyped = (e) => {
        e.preventDefault();
        if (!typed.trim()) return;
        doneRef.current = false;
        handleCode(typed.trim());
    };

    const copy = async (text) => {
        try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* not allowed */ }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={t('qr_scanner.title', 'Scan QR code')}
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex items-center gap-2 px-3 py-3">
                <QrCode size={20} className="shrink-0 text-sky-400" />
                <h2 className="flex-1 truncate text-base font-semibold">{t('qr_scanner.title', 'Scan QR code')}</h2>
                <button type="button" onClick={onClose} aria-label={t('qr_scanner.close', 'Close')} className="rounded-full p-2 hover:bg-white/10 active:bg-white/20">
                    <X size={22} />
                </button>
            </div>

            <div className="relative flex-1 overflow-hidden">
                <video ref={videoRef} muted playsInline className={`absolute inset-0 h-full w-full object-cover ${camera === 'live' && !result ? '' : 'invisible'}`} />

                {camera === 'live' && !result && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-64 w-64 max-w-[75vw] max-h-[75vw] rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                        <p className="absolute bottom-6 inset-x-4 text-center text-sm text-white/90">{t('qr_scanner.point', 'Point the camera at the QR code')}</p>
                    </div>
                )}

                {camera === 'starting' && !result && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
                        <Loader2 size={32} className="animate-spin" />
                        <p className="text-sm">{t('qr_scanner.starting', 'Opening the camera…')}</p>
                    </div>
                )}

                {camera === 'blocked' && !result && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                        <Camera size={40} className="text-white/60" />
                        <p className="text-base font-semibold">{t('qr_scanner.camera_blocked', 'The camera could not be opened here')}</p>
                        <p className="text-sm text-white/70">{t('qr_scanner.camera_blocked_hint', 'Take a photo of the QR code, or choose one from your pictures, and it will be read from the photo.')}</p>
                        <button type="button" onClick={startCamera} className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10">
                            <RotateCcw size={16} /> {t('qr_scanner.try_camera_again', 'Try the camera again')}
                        </button>
                    </div>
                )}

                {result && (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white p-4 text-slate-800 shadow-xl dark:bg-slate-800 dark:text-slate-100">
                            <p className="text-sm font-semibold">
                                {result.type === 'web' ? t('qr_scanner.web_link', 'This code holds a web link that is not part of the app') : t('qr_scanner.text_found', 'This code holds text')}
                            </p>
                            <p className="mt-2 max-h-40 overflow-auto break-all rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-700" dir="auto">{result.type === 'web' ? result.url : result.text}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {result.type === 'web' && (
                                    <button type="button" onClick={() => openExternal(result.url)} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                                        <ExternalLink size={16} /> {t('qr_scanner.open_in_browser', 'Open in browser')}
                                    </button>
                                )}
                                <button type="button" onClick={() => copy(result.type === 'web' ? result.url : result.text)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <Copy size={16} /> {copied ? t('qr_scanner.copied', 'Copied') : t('qr_scanner.copy', 'Copy')}
                                </button>
                                <button type="button" onClick={startCamera} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <RotateCcw size={16} /> {t('qr_scanner.scan_again', 'Scan again')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-2 px-3 pb-3 pt-2">
                {notice && <p className="rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-100">{notice}</p>}
                {typing ? (
                    <form onSubmit={submitTyped} className="flex gap-2">
                        <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} dir="ltr" inputMode="url"
                            placeholder={t('qr_scanner.link_placeholder', 'Paste or type the link')}
                            className="min-w-0 flex-1 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50" />
                        <button type="submit" className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold hover:bg-sky-700">{t('qr_scanner.open', 'Open')}</button>
                    </form>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        <button type="button" disabled={busy} onClick={() => photoInputRef.current?.click()} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 px-2 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-50">
                            {busy ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />} {t('qr_scanner.take_photo', 'Take photo')}
                        </button>
                        <button type="button" disabled={busy} onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 px-2 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-50">
                            <ImageIcon size={20} /> {t('qr_scanner.choose_image', 'From pictures')}
                        </button>
                        <button type="button" onClick={() => setTyping(true)} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 px-2 py-2 text-xs font-semibold hover:bg-white/20">
                            <Link2 size={20} /> {t('qr_scanner.type_link', 'Type a link')}
                        </button>
                    </div>
                )}
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={readPhoto} />
                <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={readPhoto} />
            </div>
        </div>
    );
}
