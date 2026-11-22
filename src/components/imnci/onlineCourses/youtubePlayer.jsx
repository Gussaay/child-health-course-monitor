// The lesson's own video player for YouTube videos.
//
// The video still streams from YouTube (free to host and to watch), but the
// learner never touches YouTube's player: it runs with its controls off, a
// transparent layer over it takes every tap, and the lesson draws its own
// controls. So YouTube's title bar, channel name, logo, "more videos" panel,
// end screen and links never come up.
//
// The two moments YouTube still shows its title on its own are the first
// seconds of playback and while paused. Before the picture is shown the video
// plays a few seconds muted behind the lesson's cover, then goes back to the
// start and the sound comes on; while paused or ended the cover is back.
//
// A clip of a longer video plays from `clipStart` to `clipEnd` (seconds), so a
// lesson can show only the part that shows the sign it has just described; the
// time and the seek bar count within the clip.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, RotateCcw, Maximize, Minimize, Captions, LoaderCircle, VolumeX, Download, CheckCircle2, Trash2 } from 'lucide-react';
import { getVideoIndex, isVideoSaved, savedVideoUrl, saveVideo, removeVideo, onSavedVideosChange, formatMB } from './offlineVideos';

export const youtubeId = (src) => (String(src || '').match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/) || [])[1] || null;

export function youtubeEmbed(id, { start = null, end = null, autoplay = false, captions = false } = {}) {
    const params = new URLSearchParams({
        controls: '0', disablekb: '1', fs: '0', rel: '0', modestbranding: '1', iv_load_policy: '3',
        playsinline: '1', enablejsapi: '1', color: 'white',
    });
    if (typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) params.set('origin', window.location.origin);
    if (start != null) params.set('start', String(Math.floor(Number(start) || 0)));
    if (end != null && Number(end) > Number(start || 0)) params.set('end', String(Math.ceil(Number(end))));
    if (autoplay) { params.set('autoplay', '1'); params.set('mute', '1'); }
    if (captions) { params.set('cc_load_policy', '1'); params.set('cc_lang_pref', 'en'); }
    return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

// How long the video plays hidden and muted at the start, while YouTube shows
// its title over the picture.
const WARM_UP_MS = 3200;
// How long the controls stay up after a tap while the video plays.
const CONTROLS_MS = 3000;
const RATES = [1, 1.25, 1.5, 0.75];

const clock = (sec) => {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const loadPref = (k, fallback) => {
    try { const v = window.localStorage.getItem(`oc-video-${k}`); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
};
const savePref = (k, v) => { try { window.localStorage.setItem(`oc-video-${k}`, JSON.stringify(v)); } catch { /* private mode */ } };

const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

function StreamPlayer({ id, title, startAt, onEnded, onTime = null, clipStart = null, clipEnd = null, pauseAt = null, onPauseAt = null }) {
    const onTimeRef = useRef(onTime);
    onTimeRef.current = onTime;
    // A skill button ("jump to the skill") plays to the end of that skill and
    // pauses there; the learner can carry on with the rest of the video.
    const pauseAtRef = useRef(pauseAt);
    pauseAtRef.current = pauseAt;
    const onPauseAtRef = useRef(onPauseAt);
    onPauseAtRef.current = onPauseAt;
    const { t } = useTranslation();
    const root = useRef(null);
    const frame = useRef(null);
    const from = clipStart != null ? Math.max(0, Number(clipStart) || 0) : 0;
    const to = clipEnd != null && Number(clipEnd) > from ? Number(clipEnd) : null;

    // 'cover' before the first play; 'loading' while the video starts hidden;
    // then 'playing', 'paused' or 'ended'.
    const [phase, setPhase] = useState('cover');
    const phaseRef = useRef(phase);
    phaseRef.current = phase;
    const [time, setTime] = useState(from);
    const [duration, setDuration] = useState(null);
    const [muted, setMuted] = useState(false);
    const [controls, setControls] = useState(false);
    const [rate, setRate] = useState(() => loadPref('rate', 1));
    const [captions, setCaptions] = useState(() => loadPref('captions', false));
    const [full, setFull] = useState(false);          // real fullscreen
    const [pseudo, setPseudo] = useState(false);      // fills the window where fullscreen is not offered
    const [seekDrag, setSeekDrag] = useState(null);
    const ended = useRef(onEnded);
    ended.current = onEnded;
    const firstStart = useRef(startAt != null ? Number(startAt) : from);
    const warm = useRef(null);
    const hideTimer = useRef(null);
    const timeRef = useRef(from);
    const srcRef = useRef(null);

    const send = useCallback((func, args = []) => {
        frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    }, []);

    // Ask the player to report its state and time (the IFrame API's handshake).
    const listen = () => {
        const w = frame.current?.contentWindow;
        if (!w) return;
        w.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
        w.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 1, channel: 'widget' }), '*');
    };

    const finish = useCallback(() => {
        send('pauseVideo');
        setPhase('ended');
        setControls(false);
        if (fullscreenElement() === root.current) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
        setPseudo(false);
        ended.current?.();
    }, [send]);

    useEffect(() => {
        const onMessage = (e) => {
            if (!frame.current || e.source !== frame.current.contentWindow) return;
            let data = e.data;
            try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
            const info = data?.info;
            if (data?.event === 'onReady' || data?.event === 'initialDelivery') listen();
            const ps = info && typeof info === 'object' ? info.playerState : (data?.event === 'onStateChange' ? info : undefined);
            if (info && typeof info === 'object') {
                if (typeof info.currentTime === 'number') { timeRef.current = info.currentTime; setTime(info.currentTime); onTimeRef.current?.(info.currentTime); }
                if (pauseAtRef.current != null && typeof info.currentTime === 'number' && info.currentTime >= pauseAtRef.current
                    && phaseRef.current === 'playing') {
                    pauseAtRef.current = null;
                    send('pauseVideo'); setPhase('paused'); setControls(true);
                    onPauseAtRef.current?.();
                }
                if (typeof info.duration === 'number' && info.duration > 0) setDuration(info.duration);
                if (typeof info.muted === 'boolean' && phaseRef.current !== 'loading') setMuted(info.muted);
                if (to != null && typeof info.currentTime === 'number' && info.currentTime >= to - 0.15
                    && (phaseRef.current === 'playing')) { finish(); return; }
            }
            if (ps === 1) {
                if (phaseRef.current === 'loading' && !warm.current) {
                    // Playing hidden and muted; show it once YouTube's title has gone.
                    warm.current = setTimeout(() => {
                        send('seekTo', [firstStart.current, true]);
                        send('setPlaybackRate', [rate]);
                        send('unMute');
                        send('setVolume', [100]);
                        timeRef.current = firstStart.current;
                        setTime(firstStart.current);
                        setPhase('playing');
                    }, WARM_UP_MS);
                } else if (phaseRef.current === 'paused') setPhase('playing');
            } else if (ps === 2 && phaseRef.current === 'playing') setPhase('paused');
            else if (ps === 0 && phaseRef.current !== 'ended' && phaseRef.current !== 'cover') finish();
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [to, rate, finish, send]);

    useEffect(() => () => { clearTimeout(warm.current); clearTimeout(hideTimer.current); }, []);

    // A chapter link jumps to a moment.
    useEffect(() => {
        if (startAt == null) return;
        if (phaseRef.current === 'cover') { firstStart.current = Number(startAt); setPhase('loading'); return; }
        if (phaseRef.current === 'loading') { firstStart.current = Number(startAt); return; }
        send('seekTo', [Number(startAt), true]);
        send('playVideo');
        setPhase('playing');
    }, [startAt, send]);

    useEffect(() => {
        const onChange = () => {
            const isFull = !!fullscreenElement() && fullscreenElement() === root.current;
            setFull(isFull);
            if (!isFull) { try { window.screen?.orientation?.unlock?.(); } catch { /* not supported */ } }
        };
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    // Escape leaves the window-filling view too.
    useEffect(() => {
        if (!pseudo) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setPseudo(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pseudo]);

    const showControls = () => {
        setControls(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => { if (phaseRef.current === 'playing') setControls(false); }, CONTROLS_MS);
    };

    const start = () => { firstStart.current = from; setPhase('loading'); };
    const play = () => {
        if (phase === 'ended') {
            send('seekTo', [from, true]);
            timeRef.current = from;
            setTime(from);
        }
        send('playVideo');
        setPhase('playing');
        showControls();
    };
    const pause = () => { send('pauseVideo'); setPhase('paused'); setControls(true); clearTimeout(hideTimer.current); };
    const seekTo = (abs) => {
        const target = Math.max(from, to != null ? Math.min(abs, to - 0.5) : abs);
        send('seekTo', [target, true]);
        timeRef.current = target;
        setTime(target);
        if (phase === 'ended') { send('playVideo'); setPhase('playing'); }
        if (phaseRef.current === 'playing') showControls();
    };
    const back10 = () => seekTo(timeRef.current - 10);
    const cycleRate = () => {
        const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length] || 1;
        setRate(next);
        savePref('rate', next);
        send('setPlaybackRate', [next]);
        showControls();
    };
    const toggleCaptions = () => {
        const next = !captions;
        setCaptions(next);
        savePref('captions', next);
        if (next) {
            send('loadModule', ['captions']);
            send('setOption', ['captions', 'track', { languageCode: 'en' }]);
        } else send('unloadModule', ['captions']);
        showControls();
    };
    const unmute = () => { send('unMute'); send('setVolume', [100]); setMuted(false); };
    const toggleFull = async () => {
        const el = root.current;
        if (!el) return;
        if (full) { try { await (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); } catch { /* ignore */ } return; }
        if (pseudo) { setPseudo(false); return; }
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
            try {
                await req.call(el);
                try { await window.screen?.orientation?.lock?.('landscape'); } catch { /* phone may refuse */ }
                return;
            } catch { /* fall through to the window-filling view */ }
        }
        setPseudo(true);
    };

    const clipLen = to != null ? to - from : (duration != null ? duration - from : null);
    const shownTime = (seekDrag ?? time) - from;
    const pct = clipLen ? Math.min(100, Math.max(0, (shownTime / clipLen) * 100)) : 0;
    const big = full || pseudo;
    const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    // Built once when the video first starts: changing it later would reload the
    // player and lose the place. Captions switched later go through the player.
    if (phase !== 'cover' && !srcRef.current) {
        srcRef.current = youtubeEmbed(id, { start: firstStart.current, end: to, autoplay: true, captions });
    }
    const src = srcRef.current;

    const rootClass = pseudo
        ? 'fixed inset-0 z-[1000] bg-black'
        : 'absolute inset-0 bg-black';

    if (phase === 'cover') {
        return (
            <button type="button" onClick={start} aria-label={t('imnci_ui.courses.video.play', 'Play the video')}
                className="absolute inset-0 w-full h-full group" data-testid="video-start">
                <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <span className="absolute inset-0 bg-black/40" />
                <span className="absolute inset-0 grid place-items-center">
                    <span className="w-16 h-16 rounded-full bg-white/95 text-sky-800 grid place-items-center shadow-lg group-hover:scale-105 transition-transform">
                        <Play size={30} className="ms-1" fill="currentColor" />
                    </span>
                </span>
                {title && <span className="absolute bottom-0 inset-x-0 p-3 text-start text-white text-sm font-semibold bg-black/50">{title}</span>}
            </button>
        );
    }

    const btn = 'grid place-items-center rounded-full text-white hover:bg-white/15 active:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
    const iconSize = big ? 26 : 20;
    const barShown = controls || phase === 'paused' || phase === 'ended';

    return (
        <div ref={root} className={rootClass} dir="ltr" data-testid="video-player">
            <div className="absolute inset-0">
                <iframe ref={frame} src={src} title={title || t('imnci_ui.courses.video.video', 'Video')} onLoad={listen}
                    tabIndex={-1} className="absolute inset-0 w-full h-full pointer-events-none"
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture" />
            </div>

            {/* Takes every tap, so YouTube's own player never shows its title, logo or links. */}
            <div className="absolute inset-0" data-testid="video-tap"
                onClick={() => { if (phase === 'playing') { if (controls) pause(); else showControls(); } }} />

            {(phase === 'loading' || phase === 'paused' || phase === 'ended') && (
                <div className="absolute inset-0 pointer-events-none bg-slate-900">
                    <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <span className="absolute inset-0 bg-slate-900/60" />
                </div>
            )}

            {phase === 'loading' && (
                <div className="absolute inset-0 grid place-items-center text-white">
                    <span className="flex flex-col items-center gap-2">
                        <LoaderCircle size={40} className="animate-spin" />
                        <span className="text-sm font-semibold">{t('imnci_ui.courses.video.loading', 'Loading the video…')}</span>
                    </span>
                </div>
            )}

            {(phase === 'paused' || phase === 'ended' || (phase === 'playing' && controls)) && (
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <button type="button" data-testid={phase === 'playing' ? 'video-pause' : 'video-cover'}
                        onClick={phase === 'playing' ? pause : play}
                        aria-label={phase === 'playing' ? t('imnci_ui.courses.video.pause', 'Pause')
                            : phase === 'ended' ? t('imnci_ui.courses.video.again', 'Watch again') : t('imnci_ui.courses.video.resume', 'Continue watching')}
                        className="pointer-events-auto flex flex-col items-center gap-2 text-white">
                        <span className={`${big ? 'w-20 h-20' : 'w-14 h-14'} rounded-full bg-white/95 text-sky-800 grid place-items-center shadow-lg`}>
                            {phase === 'playing' ? <Pause size={big ? 34 : 26} fill="currentColor" />
                                : phase === 'ended' ? <RotateCcw size={big ? 32 : 26} /> : <Play size={big ? 34 : 28} className="ms-1" fill="currentColor" />}
                        </span>
                        {phase !== 'playing' && (
                            <span className="text-sm font-semibold drop-shadow">
                                {phase === 'ended' ? t('imnci_ui.courses.video.again', 'Watch again') : t('imnci_ui.courses.video.resume', 'Continue watching')}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {phase === 'playing' && muted && (
                <button type="button" onClick={unmute}
                    className="absolute top-2 start-2 flex items-center gap-1.5 rounded-full bg-white/95 text-slate-900 text-xs font-semibold px-3 py-1.5 shadow">
                    <VolumeX size={14} /> {t('imnci_ui.courses.video.unmute', 'Tap for sound')}
                </button>
            )}

            {phase !== 'loading' && (
                <div className={`absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-200 ${barShown ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <input type="range" min={0} max={clipLen || 0} step={0.5} value={Math.max(0, shownTime)}
                        aria-label={t('imnci_ui.courses.video.seek', 'Position in the video')}
                        disabled={!clipLen}
                        onChange={(e) => setSeekDrag(from + Number(e.target.value))}
                        onPointerUp={() => { if (seekDrag != null) { seekTo(seekDrag); setSeekDrag(null); } }}
                        onKeyUp={() => { if (seekDrag != null) { seekTo(seekDrag); setSeekDrag(null); } }}
                        className="w-full h-1.5 accent-sky-400 cursor-pointer"
                        style={{ background: `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255,255,255,.35) ${pct}%)` }} />
                    <div className="flex items-center gap-1 text-white">
                        <button type="button" onClick={phase === 'playing' ? pause : play} className={`${btn} w-9 h-9`}
                            aria-label={phase === 'playing' ? t('imnci_ui.courses.video.pause', 'Pause') : t('imnci_ui.courses.video.play', 'Play the video')}>
                            {phase === 'playing' ? <Pause size={iconSize} fill="currentColor" /> : <Play size={iconSize} fill="currentColor" />}
                        </button>
                        <button type="button" onClick={back10} className={`${btn} w-9 h-9 relative`}
                            aria-label={t('imnci_ui.courses.video.back10', 'Back 10 seconds')}>
                            <RotateCcw size={iconSize} />
                            <span className="absolute text-[8px] font-bold">10</span>
                        </button>
                        <span className="text-xs tabular-nums ms-1">
                            {clock(shownTime)}{clipLen ? ` / ${clock(clipLen)}` : ''}
                        </span>
                        <span className="flex-1" />
                        <button type="button" onClick={cycleRate} className={`${btn} h-9 px-2 text-xs font-bold`}
                            aria-label={t('imnci_ui.courses.video.speed', 'Playback speed')}>{rate}×</button>
                        <button type="button" onClick={toggleCaptions} aria-pressed={captions}
                            className={`${btn} w-9 h-9 ${captions ? 'text-sky-300' : ''}`}
                            aria-label={t('imnci_ui.courses.video.captions', 'Captions')}>
                            <Captions size={iconSize} />
                        </button>
                        <button type="button" onClick={toggleFull} className={`${btn} w-9 h-9`} data-testid="video-fullscreen"
                            aria-label={big ? t('imnci_ui.courses.video.exit_full', 'Exit full screen') : t('imnci_ui.courses.video.full', 'Full screen')}>
                            {big ? <Minimize size={iconSize} /> : <Maximize size={iconSize} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// A video saved on the device plays from there, with the phone's own player.
// A clip starts at `clipStart` and stops at `clipEnd`.
function SavedPlayer({ url, id, title, startAt, onEnded, onTime = null, clipStart = null, clipEnd = null, pauseAt = null, onPauseAt = null }) {
    const ref = useRef(null);
    const from = clipStart != null ? Math.max(0, Number(clipStart) || 0) : 0;
    const to = clipEnd != null && Number(clipEnd) > from ? Number(clipEnd) : null;
    const endedRef = useRef(onEnded);
    endedRef.current = onEnded;
    const reported = useRef(false);
    const end = () => { if (!reported.current) { reported.current = true; endedRef.current?.(); } };
    useEffect(() => {
        const v = ref.current;
        if (v && startAt != null) { v.currentTime = Number(startAt) || 0; v.play?.().catch(() => {}); }
    }, [startAt]);
    return (
        <video ref={ref} src={url} controls playsInline controlsList="nodownload" preload="metadata"
            poster={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} title={title || undefined}
            className="absolute inset-0 w-full h-full bg-black" data-testid="video-saved"
            onLoadedMetadata={(e) => { if (from) e.currentTarget.currentTime = from; }}
            onPlay={(e) => {
                const v = e.currentTarget;
                reported.current = false;
                if (v.currentTime < from - 0.5 || (to != null && v.currentTime >= to - 0.3)) v.currentTime = from;
            }}
            onTimeUpdate={(to != null || onTime || pauseAt != null) ? (e) => {
                onTime?.(e.currentTarget.currentTime);
                if (pauseAt != null && e.currentTarget.currentTime >= pauseAt) { e.currentTarget.pause(); onPauseAt?.(); return; }
                if (to != null && e.currentTarget.currentTime >= to) { e.currentTarget.pause(); end(); }
            } : undefined}
            onEnded={end} />
    );
}

/** The saved copy of a video on this device: { url } once known, url null when not saved. */
function useSavedVideo(id) {
    const [url, setUrl] = useState(undefined);
    useEffect(() => {
        let alive = true;
        let current = null;
        const load = () => savedVideoUrl(id).then((u) => {
            if (!alive) { if (u) URL.revokeObjectURL(u); return; }
            if (current) URL.revokeObjectURL(current);
            current = u;
            setUrl(u);
        });
        load();
        const off = onSavedVideosChange((changed) => { if (changed === id) load(); });
        return () => { alive = false; off(); if (current) URL.revokeObjectURL(current); };
    }, [id]);
    return url;
}

export function YouTubePlayer(props) {
    const url = useSavedVideo(props.id);
    if (url === undefined) return <div className="absolute inset-0 bg-black" />;
    return url ? <SavedPlayer url={url} {...props} /> : <StreamPlayer {...props} />;
}

/**
 * "Download for offline" under a video: shown when a copy of the video is
 * offered for download. Saved videos can be removed to free space.
 */
export function OfflineVideoButton({ id }) {
    const { t } = useTranslation();
    const [entry, setEntry] = useState(null);
    const [saved, setSaved] = useState(false);
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        let alive = true;
        if (!id) return undefined;
        getVideoIndex().then((index) => { if (alive) setEntry(index?.[id] || null); });
        const check = () => isVideoSaved(id).then((s) => { if (alive) setSaved(s); });
        check();
        const off = onSavedVideosChange((changed) => { if (changed === id) check(); });
        return () => { alive = false; off(); };
    }, [id]);
    if (!id || (!entry && !saved)) return null;
    const download = async () => {
        setError(null);
        setProgress(0);
        try { await saveVideo(id, entry, setProgress); setSaved(true); } catch (e) {
            setError(navigator.onLine === false
                ? t('imnci_ui.courses.video.offline_no_net', 'No internet. Try again when you are connected.')
                : t('imnci_ui.courses.video.offline_failed', 'The download did not finish. Try again.'));
            console.warn('[offline video]', e);
        } finally { setProgress(null); }
    };
    const pill = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold';
    return (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs" data-testid="video-offline">
            {saved ? (
                <>
                    <span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-800`}>
                        <CheckCircle2 size={14} /> {t('imnci_ui.courses.video.offline_saved', 'Saved on this device')}
                    </span>
                    <button type="button" onClick={() => removeVideo(id).then(() => setSaved(false))}
                        className={`${pill} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
                        <Trash2 size={14} /> {t('imnci_ui.courses.video.offline_remove', 'Remove')}
                    </button>
                </>
            ) : progress != null ? (
                <span className={`${pill} border-sky-200 bg-sky-50 text-sky-800 min-w-[12rem]`}>
                    <LoaderCircle size={14} className="animate-spin" />
                    {t('imnci_ui.courses.video.offline_progress', 'Downloading {{pct}}%', { pct: Math.round(progress * 100) })}
                    <span className="flex-1 h-1.5 rounded-full bg-sky-100 overflow-hidden">
                        <span className="block h-full bg-sky-600" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                </span>
            ) : (
                <button type="button" onClick={download}
                    className={`${pill} border-sky-200 bg-white text-sky-800 hover:bg-sky-50`}>
                    <Download size={14} /> {t('imnci_ui.courses.video.offline_download', 'Download for offline')}
                    {entry?.bytes ? <span className="font-normal text-slate-500">({formatMB(entry.bytes)})</span> : null}
                </button>
            )}
            {error && <span className="w-full text-center text-rose-700">{error}</span>}
        </div>
    );
}
