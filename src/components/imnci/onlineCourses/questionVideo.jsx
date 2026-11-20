// A video on an exercise question: the learner watches it, then answers.
// `video` is { url, start, end } (seconds), so one question can show one child
// from a longer training video. YouTube plays in the lesson's own player (no
// related videos); a file plays from `start` and stops at `end`.
import React, { useRef } from 'react';
import { videoSource } from '../book';
import { YouTubePlayer, youtubeId } from './youtubePlayer';

export function QuestionVideo({ video }) {
    const src = videoSource(video?.url);
    const ref = useRef(null);
    if (!src) return null;
    const ytId = src.kind === 'embed' ? youtubeId(src.src) : null;
    const start = video.start != null ? Number(video.start) : null;
    const end = video.end != null ? Number(video.end) : null;
    return (
        <div className="relative w-full max-w-xl rounded-lg overflow-hidden border border-slate-200 bg-black mb-3" style={{ aspectRatio: '16 / 9' }}>
            {ytId ? (
                <YouTubePlayer id={ytId} title={video.title || ''} clipStart={start} clipEnd={end} />
            ) : src.kind === 'embed' ? (
                <iframe src={src.src} title={video.title || 'Video'} allowFullScreen className="absolute inset-0 w-full h-full" />
            ) : (
                <video ref={ref} src={src.src} controls playsInline className="absolute inset-0 w-full h-full"
                    onLoadedMetadata={start ? (e) => { e.currentTarget.currentTime = start; } : undefined}
                    onTimeUpdate={end ? (e) => { if (e.currentTarget.currentTime >= end) e.currentTarget.pause(); } : undefined} />
            )}
        </div>
    );
}
