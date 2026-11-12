// src/training/TrainingLinkShare.jsx
//
// The "Training link" box in a course's Share Public Links modal. Sharing
// stamps the course with its practice window (course.training) from the
// course's start date and duration, which both the app (TrainingGate) and the
// security rules check, then hands the link to the normal QR / share sheet.

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap } from 'lucide-react';
import { doc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from '../components/CommonComponents';
import { courseTrainingWindow, trainingStatus } from './trainingSession.js';
import { seedSandbox } from './trainingSeed.js';

const sameMillis = (ts, date) => !!ts && typeof ts.toMillis === 'function' && ts.toMillis() === date.getTime();

export function trainingLinkFor(baseUrl, courseId) {
    return `${baseUrl}/training/${courseId}`;
}

export default function TrainingLinkShare({ course, baseUrl, onShare, notify }) {
    const { t, i18n } = useTranslation();
    const ar = (i18n.language || '').toLowerCase().startsWith('ar');
    const [busy, setBusy] = useState(false);
    // Preparing the practice copy: null, { n, total }, 'done' or 'failed'.
    const [prep, setPrep] = useState(null);
    const [training, setTraining] = useState(course.training || null);

    const win = courseTrainingWindow(course);
    const fmt = (d) => d.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const status = trainingStatus({ ...course, training });

    const share = async () => {
        if (!win) {
            notify?.(t('course_page.share.training_needs_dates', 'Set the course start date and duration first.'), 'error');
            return;
        }
        setBusy(true);
        try {
            // Stamp (or refresh, if the course dates moved) the practice window.
            const upToDate = training?.enabled === true
                && sameMillis(training.startsAt, win.start)
                && sameMillis(training.endsAt, win.end);
            if (!upToDate) {
                const next = {
                    enabled: true,
                    startsAt: Timestamp.fromDate(win.start),
                    endsAt: Timestamp.fromDate(win.end),
                    updatedAt: serverTimestamp(),
                };
                await updateDoc(doc(db, 'courses', course.id), { training: next });
                setTraining({ ...next, updatedAt: null });
            }
            onShare(trainingLinkFor(baseUrl, course.id));
            // Fill the practice copy now, so trainees never wait for it.
            if (prep !== 'done') {
                setPrep({ n: 0, total: 0 });
                seedSandbox(course.id, course, (n, total) => setPrep({ n, total }))
                    .then(() => setPrep('done'))
                    .catch((e) => { console.warn('[training] practice copy not prepared:', e?.code || e?.message); setPrep('failed'); });
            }
        } catch (e) {
            console.error('[training link]', e);
            notify?.(t('course_page.share.training_save_failed', 'Could not switch on the training link. Check your connection and permissions.'), 'error');
        } finally {
            setBusy(false);
        }
    };

    const stop = async () => {
        setBusy(true);
        try {
            await updateDoc(doc(db, 'courses', course.id), { 'training.enabled': false, 'training.updatedAt': serverTimestamp() });
            setTraining((prev) => ({ ...(prev || {}), enabled: false }));
            notify?.(t('course_page.share.training_stopped', 'Training link switched off.'));
        } catch (e) {
            console.error('[training link]', e);
            notify?.(t('course_page.share.training_save_failed', 'Could not switch on the training link. Check your connection and permissions.'), 'error');
        } finally {
            setBusy(false);
        }
    };

    const statusLabel = {
        open: t('course_page.share.training_status_open', 'Open now'),
        not_started: t('course_page.share.training_status_not_started', 'Opens on the first course day'),
        expired: t('course_page.share.training_status_expired', 'Expired'),
    }[status];

    return (
        <div className="bg-amber-50 p-3 rounded border border-amber-200">
            <div className="flex justify-between items-center gap-2 mb-1">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                    <GraduationCap size={16} className="text-amber-700" />
                    {t('course_page.share.training_link', 'Training link (practice app)')}
                </span>
                <Button variant="secondary" size="sm" className="flex items-center gap-1 shrink-0" onClick={share} disabled={busy}>
                    <GraduationCap size={14} /> {t('course_page.buttons.share', 'Share')}
                </Button>
            </div>
            <p className="text-xs text-slate-600">
                {t('course_page.share.training_help', 'Opens the full app for practice. Everything saved goes to a separate training copy for this course, never to real data.')}
            </p>
            <p className="text-xs text-slate-600 mt-1">
                {win
                    ? t('course_page.share.training_window', 'Works only during the course: {{from}} to {{to}}.', { from: fmt(win.start), to: fmt(new Date(win.end.getTime() - 1)) })
                    : t('course_page.share.training_needs_dates', 'Set the course start date and duration first.')}
                {statusLabel && <span className="ms-1 font-semibold text-amber-800">({statusLabel})</span>}
            </p>
            {prep && (
                <p className="text-xs mt-1 text-slate-600" role="status">
                    {prep === 'done'
                        ? t('course_page.share.training_ready', 'Practice copy ready: facilities, facilitators, coordinators and partners.')
                        : prep === 'failed'
                            ? t('course_page.share.training_prep_failed', 'Could not prepare the practice copy now; the first trainee will prepare it instead.')
                            : prep.total > 0
                                ? t('course_page.share.training_preparing_n', 'Preparing the practice copy… {{n}} / {{total}} facilities (keep this open)', { n: prep.n, total: prep.total })
                                : t('course_page.share.training_preparing', 'Preparing the practice copy… (keep this open)')}
                </p>
            )}
            {training?.enabled === true && (
                <button type="button" onClick={stop} disabled={busy} className="mt-1 text-xs text-red-600 underline">
                    {t('course_page.share.training_stop', 'Switch off this link')}
                </button>
            )}
        </div>
    );
}
