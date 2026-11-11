// src/training/TrainingGate.jsx
//
// Wraps the app when the tab was opened from a course's training link
// (see trainingSession.js). It:
//  1. reads the REAL course document to find the practice window,
//  2. shows "this link was for training and has expired" (or "not open yet")
//     outside that window, and keeps checking every minute while open,
//  3. on first use fills the course's sandbox with a copy of the real health
//     facilities of the course's state, so facility pickers, mentorship and
//     services screens have something to practise on,
//  4. shows a thin "Training mode" bar above the app with an Exit button.
// Outside training mode it renders the app untouched.

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as fs from '@firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import {
    isTrainingMode, trainingCourseId, exitTraining, trainingStatus,
    trainingEndsAt, trainingStartsAt, SANDBOX_ROOT,
} from './trainingSession.js';

const SEEDED_KEY = 'chm_training_seeded';
const BATCH_SIZE = 400;

function useL() {
    const { i18n } = useTranslation();
    const ar = (i18n.language || '').toLowerCase().startsWith('ar');
    return { ar, L: (arText, enText) => (ar ? arText : enText) };
}

const fmtDate = (d, ar) => (d ? d.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

// Copies the real facilities of the course's state into the sandbox once.
// Uses the raw SDK on purpose: the app's wrapped imports would read the
// (empty) sandbox instead of the real list.
async function seedSandbox(courseId, course) {
    const markerRef = fs.doc(db, SANDBOX_ROOT, courseId);
    const marker = await fs.getDoc(markerRef);
    if (marker.exists() && marker.data()?.seededAt) return;

    let copied = 0;
    if (course.state) {
        const snap = await fs.getDocs(fs.query(fs.collection(db, 'healthFacilities'), fs.where('الولاية', '==', course.state)));
        const docs = snap.docs.filter((d) => d.data()?.isDeleted !== true);
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batch = fs.writeBatch(db);
            docs.slice(i, i + BATCH_SIZE).forEach((d) => {
                batch.set(fs.doc(db, SANDBOX_ROOT, courseId, 'healthFacilities', d.id), d.data());
            });
            await batch.commit();
            copied += Math.min(BATCH_SIZE, docs.length - i);
        }
    }
    await fs.setDoc(markerRef, {
        courseId,
        courseType: course.course_type || '',
        state: course.state || '',
        facilitiesCopied: copied,
        seededAt: fs.serverTimestamp(),
    }, { merge: true });
}

function Centered({ children }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                {children}
            </div>
        </div>
    );
}

export function TrainingClosed({ status, course }) {
    const { ar, L } = useL();
    const notStarted = status === 'not_started';
    return (
        <Centered>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-2xl" aria-hidden="true">🎓</div>
            <h1 className="text-lg font-bold text-slate-800 mb-2">
                {notStarted
                    ? L('رابط التدريب لم يُفتح بعد', 'This training link is not open yet')
                    : status === 'disabled'
                        ? L('رابط التدريب غير متاح', 'This training link is not available')
                        : L('انتهت صلاحية رابط التدريب', 'This training link has expired')}
            </h1>
            <p className="text-sm text-slate-600 mb-1">
                {L('هذا الرابط مخصّص للتدريب والممارسة فقط، ولا يحفظ أي بيانات حقيقية.',
                    'This link is for training and practice only. It never saves real data.')}
            </p>
            {course?.course_type && (
                <p className="text-sm text-slate-600 mb-1">{L('الدورة', 'Course')}: <strong>{course.course_type}</strong>{course.state ? ` · ${course.state}` : ''}</p>
            )}
            <p className="text-sm text-slate-600 mb-5">
                {notStarted
                    ? L(`يعمل الرابط من ${fmtDate(trainingStartsAt(course), ar)} حتى نهاية الدورة.`, `It works from ${fmtDate(trainingStartsAt(course), ar)} until the course ends.`)
                    : status === 'disabled'
                        ? L('هذا الرابط غير مفعّل لهذه الدورة.', 'Training is not switched on for this course.')
                        : L('كان يعمل خلال فترة الدورة فقط، وقد انتهت.', 'It only worked during the course period, which has now ended.')}
            </p>
            <button type="button" onClick={exitTraining} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700">
                {L('فتح التطبيق', 'Open the app')}
            </button>
        </Centered>
    );
}

function TrainingBar({ course }) {
    const { ar, L } = useL();
    return (
        <div dir={ar ? 'rtl' : 'ltr'} className="bg-amber-400 text-amber-950 text-xs sm:text-sm px-3 py-1.5 flex items-center justify-center gap-3 flex-wrap" role="status">
            <span className="font-bold">🎓 {L('وضع التدريب', 'Training mode')}</span>
            <span>
                {L('ما تحفظه هنا للتدريب فقط ولا يغيّر البيانات الحقيقية.', 'What you save here is practice only and never changes real data.')}
                {' '}
                {L(`ينتهي ${fmtDate(trainingEndsAt(course), ar)}.`, `Ends ${fmtDate(trainingEndsAt(course), ar)}.`)}
            </span>
            <button type="button" onClick={exitTraining} className="underline font-semibold">
                {L('خروج', 'Exit')}
            </button>
        </div>
    );
}

function TrainingGateInner({ children }) {
    const { L } = useL();
    const { user, authLoading } = useAuth();
    const courseId = trainingCourseId();
    const [course, setCourse] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [now, setNow] = useState(() => Date.now());
    const [seedState, setSeedState] = useState(() => {
        try { return sessionStorage.getItem(SEEDED_KEY) === courseId ? 'done' : 'idle'; } catch { return 'idle'; }
    });

    useEffect(() => {
        let cancelled = false;
        fs.getDoc(fs.doc(db, 'courses', courseId))
            .then((snap) => { if (!cancelled) setCourse(snap.exists() ? { id: snap.id, ...snap.data() } : { missing: true }); })
            .catch((e) => { if (!cancelled) setLoadError(e); });
        return () => { cancelled = true; };
    }, [courseId]);

    // The window closes while people are using it: check every minute.
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    const status = course && !course.missing ? trainingStatus(course, now) : null;

    useEffect(() => {
        if (status !== 'open' || !user || seedState !== 'idle') return;
        setSeedState('running');
        seedSandbox(courseId, course)
            .then(() => {
                try { sessionStorage.setItem(SEEDED_KEY, courseId); } catch { /* storage blocked */ }
                setSeedState('done');
            })
            .catch((e) => {
                // The app still works without the copied facilities.
                console.warn('[training] could not prepare the practice copy:', e?.code || e?.message || e);
                setSeedState('done');
            });
    }, [status, user, seedState, courseId, course]);

    if (loadError) {
        return (
            <Centered>
                <p className="text-sm text-slate-700 mb-4">{L('تعذّر فتح رابط التدريب. تحقق من الاتصال ثم أعد المحاولة.', 'Could not open the training link. Check your connection and try again.')}</p>
                <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold">{L('إعادة المحاولة', 'Try again')}</button>
            </Centered>
        );
    }
    if (!course) {
        return <Centered><p className="text-sm text-slate-600">{L('جارٍ فتح رابط التدريب…', 'Opening the training link…')}</p></Centered>;
    }
    if (course.missing) return <TrainingClosed status="disabled" course={null} />;
    if (status !== 'open') return <TrainingClosed status={status} course={course} />;

    if (!authLoading && user && seedState !== 'done') {
        return <Centered><p className="text-sm text-slate-600">{L('جارٍ تجهيز نسخة التدريب…', 'Preparing your practice copy…')}</p></Centered>;
    }

    return (
        <>
            <TrainingBar course={course} />
            {children}
        </>
    );
}

export default function TrainingGate({ children }) {
    if (!isTrainingMode()) return children;
    return <TrainingGateInner>{children}</TrainingGateInner>;
}
