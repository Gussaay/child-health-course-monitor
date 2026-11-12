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

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as fs from '@firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import {
    isTrainingMode, trainingCourseId, trainingStatus,
    trainingEndsAt, trainingStartsAt, SANDBOX_ROOT,
} from './trainingSession.js';
import {
    loadTrainee, loadCourseParticipants, linkTrainee, startTrainingRecorder, stopTrainingRecorder,
} from './trainingProgress.js';
import { suggestParticipant, autoLinkParticipant, norm, digits } from './trainingRows.js';

const SEEDED_KEY = 'chm_training_seeded';

function useL() {
    const { i18n } = useTranslation();
    const ar = (i18n.language || '').toLowerCase().startsWith('ar');
    return { ar, L: (arText, enText) => (ar ? arText : enText) };
}

const fmtDate = (d, ar) => (d ? d.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
// Raise when the seed copies more. A sandbox seeded by an older version gets
// only what was added since (copying again would overwrite practice edits).
const SEED_VERSION = 2;
const MAX_BATCH_DOCS = 400;
const MAX_BATCH_BYTES = 8 * 1024 * 1024; // Firestore refuses commits over 10 MB

// The people and organisation lists the forms pick from (facilitators,
// coordinators, partners/funders). Copied whole: trainees choose real names
// in their practice courses and can add or edit them in the copy.
const SEED_LISTS = ['facilitators', 'funders', 'federalCoordinators', 'stateCoordinators', 'localityCoordinators', 'coordinators'];

async function copyDocs(courseId, collectionName, docs) {
    let batch = fs.writeBatch(db);
    let count = 0;
    let bytes = 0;
    for (const d of docs) {
        const data = d.data();
        const size = (() => { try { return JSON.stringify(data).length; } catch { return 50000; } })();
        if (count > 0 && (count >= MAX_BATCH_DOCS || bytes + size > MAX_BATCH_BYTES)) {
            await batch.commit();
            batch = fs.writeBatch(db);
            count = 0;
            bytes = 0;
        }
        batch.set(fs.doc(db, SANDBOX_ROOT, courseId, collectionName, d.id), data);
        count += 1;
        bytes += size;
    }
    if (count > 0) await batch.commit();
    return docs.length;
}

// Fills the course's sandbox with copies of real reference data, once.
// Uses the raw SDK on purpose: the app's wrapped imports would read the
// (empty) sandbox instead of the real lists.
async function seedSandbox(courseId, course) {
    const markerRef = fs.doc(db, SANDBOX_ROOT, courseId);
    const marker = await fs.getDoc(markerRef);
    const done = marker.exists() ? (marker.data()?.seedVersion || (marker.data()?.seededAt ? 1 : 0)) : 0;
    if (done >= SEED_VERSION) return;

    const counts = {};
    // Version 1: the health facilities of the course's state.
    if (done < 1 && course.state) {
        const snap = await fs.getDocs(fs.query(fs.collection(db, 'healthFacilities'), fs.where('الولاية', '==', course.state)));
        counts.healthFacilities = await copyDocs(courseId, 'healthFacilities', snap.docs.filter((d) => d.data()?.isDeleted !== true));
    }
    // Version 2: facilitators, coordinators and partners.
    if (done < 2) {
        for (const name of SEED_LISTS) {
            try {
                const snap = await fs.getDocs(fs.collection(db, name));
                counts[name] = await copyDocs(courseId, name, snap.docs);
            } catch (e) {
                console.warn(`[training] could not copy ${name}:`, e?.code || e?.message);
            }
        }
    }
    await fs.setDoc(markerRef, {
        courseId,
        courseType: course.course_type || '',
        state: course.state || '',
        ...(counts.healthFacilities !== undefined ? { facilitiesCopied: counts.healthFacilities } : {}),
        copied: counts,
        seedVersion: SEED_VERSION,
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
        </Centered>
    );
}

function TrainingBar({ course, trainee, onChangeWho }) {
    const { ar, L } = useL();
    const who = trainee?.participantName || (trainee?.linked ? L('ضيف', 'guest') : '');
    return (
        <div dir={ar ? 'rtl' : 'ltr'} className="bg-amber-400 text-amber-950 text-xs sm:text-sm px-3 py-1.5 flex items-center justify-center gap-3 flex-wrap" role="status">
            <span className="font-bold">🎓 {L('وضع التدريب', 'Training mode')}</span>
            <span>
                {L('ما تحفظه هنا للتدريب فقط ولا يغيّر البيانات الحقيقية.', 'What you save here is practice only and never changes real data.')}
                {' '}
                {L(`ينتهي ${fmtDate(trainingEndsAt(course), ar)}.`, `Ends ${fmtDate(trainingEndsAt(course), ar)}.`)}
            </span>
            {who && (
                <button type="button" onClick={onChangeWho} className="underline" title={L('تغيير', 'Change')}>
                    {L(`تتدرّب باسم: ${who}`, `Practising as: ${who}`)}
                </button>
            )}
        </div>
    );
}

// "Who are you?" — links the signed-in account to the course participant, so
// the course's Training tab shows each participant's practice.
function WhoAreYou({ courseId, course, user, existing, onDone }) {
    const { ar, L } = useL();
    const [participants, setParticipants] = useState(null);
    const [search, setSearch] = useState('');
    const [chosen, setChosen] = useState(existing?.participantId || null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        loadCourseParticipants(courseId)
            .then((list) => {
                if (cancelled) return;
                setParticipants(list);
                if (!existing?.participantId) setChosen(suggestParticipant(list, user)?.id || null);
            })
            .catch(() => { if (!cancelled) setParticipants([]); });
        return () => { cancelled = true; };
    }, [courseId, user, existing]);

    const shown = useMemo(() => {
        const q = norm(search);
        const list = participants || [];
        return q ? list.filter((p) => norm(p.name).includes(q) || digits(p.phone).includes(q.replace(/\D/g, '') || '~')) : list;
    }, [participants, search]);

    const save = async (participant) => {
        setSaving(true);
        setError(null);
        try {
            onDone(await linkTrainee(courseId, user, participant, existing));
        } catch (e) {
            console.warn('[training] could not link participant:', e?.code || e?.message);
            setError(L('تعذّر الحفظ. تحقق من الاتصال ثم أعد المحاولة.', 'Could not save. Check your connection and try again.'));
            setSaving(false);
        }
    };

    return (
        <div dir={ar ? 'rtl' : 'ltr'} className="min-h-screen flex items-start sm:items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs font-bold text-amber-700 mb-1">🎓 {L('وضع التدريب', 'Training mode')} · {course.course_type}</div>
                <h1 className="text-lg font-bold text-slate-800 mb-1">{L('من أنت؟', 'Who are you?')}</h1>
                <p className="text-sm text-slate-600 mb-3">
                    {L('اختر اسمك من قائمة المشاركين في الدورة، حتى يرى المدرّبون تدريبك.', 'Pick your name from the course participants, so your trainers can follow your practice.')}
                </p>
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={L('ابحث بالاسم أو رقم الهاتف', 'Search by name or phone')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
                />
                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 mb-3">
                    {participants === null && <p className="p-3 text-sm text-slate-500">{L('جارٍ التحميل…', 'Loading…')}</p>}
                    {participants !== null && shown.length === 0 && <p className="p-3 text-sm text-slate-500">{L('لا يوجد مشاركون مطابقون.', 'No matching participants.')}</p>}
                    {shown.map((p) => (
                        <label key={p.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${chosen === p.id ? 'bg-amber-50' : ''}`}>
                            <input type="radio" name="trainee" checked={chosen === p.id} onChange={() => setChosen(p.id)} />
                            <span className="min-w-0">
                                <span className="block text-sm font-medium text-slate-800 truncate">{p.name}</span>
                                {(p.job_title || p.phone) && <span className="block text-xs text-slate-500 truncate" dir="ltr">{[p.job_title, p.phone].filter(Boolean).join(' · ')}</span>}
                            </span>
                        </label>
                    ))}
                </div>
                {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                <button
                    type="button"
                    disabled={!chosen || saving}
                    onClick={() => save(participants.find((p) => p.id === chosen))}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50"
                >
                    {L('هذا أنا، ابدأ التدريب', "That's me, start practising")}
                </button>
                <button type="button" disabled={saving} onClick={() => save(null)} className="w-full mt-2 text-sm text-slate-600 underline">
                    {L('لست في القائمة (مدرّب أو ضيف)', "I'm not on the list (trainer or guest)")}
                </button>
            </div>
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
        try { return sessionStorage.getItem(SEEDED_KEY) === `${courseId}:v${SEED_VERSION}` ? 'done' : 'idle'; } catch { return 'idle'; }
    });
    // undefined = not loaded yet, null = this account never linked.
    const [trainee, setTrainee] = useState(undefined);
    const [choosing, setChoosing] = useState(false);

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
                try { sessionStorage.setItem(SEEDED_KEY, `${courseId}:v${SEED_VERSION}`); } catch { /* storage blocked */ }
                setSeedState('done');
            })
            .catch((e) => {
                // The app still works without the copied facilities.
                console.warn('[training] could not prepare the practice copy:', e?.code || e?.message || e);
                setSeedState('done');
            });
    }, [status, user, seedState, courseId, course]);

    // Who is practising: load the account's link once signed in.
    useEffect(() => {
        if (status !== 'open' || !user) { setTrainee(undefined); return undefined; }
        let cancelled = false;
        // Already linked: carry on. Otherwise link automatically when the
        // account matches a registered participant (saved link, e-mail or
        // phone), and only ask "Who are you?" when it does not.
        (async () => {
            const t = await loadTrainee(courseId, user.uid);
            if (t?.linked) return t;
            let list = [];
            try { list = await loadCourseParticipants(courseId); } catch { /* ask instead */ }
            const auto = autoLinkParticipant(list, user);
            if (!auto) return t;
            return linkTrainee(courseId, user, auto.participant, t, auto.method);
        })()
            .then((t) => { if (!cancelled) setTrainee(t); })
            .catch((e) => {
                console.warn('[training] could not load trainee:', e?.code || e?.message);
                if (!cancelled) setTrainee(null);
            });
        return () => { cancelled = true; };
    }, [status, user, courseId]);

    // Record what this trainee saves and opens, for the course's Training tab.
    useEffect(() => {
        if (!user || !trainee?.linked) return undefined;
        startTrainingRecorder(courseId, user, trainee);
        return () => stopTrainingRecorder();
    }, [courseId, user, trainee]);

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
    if (!authLoading && user) {
        if (trainee === undefined) {
            return <Centered><p className="text-sm text-slate-600">{L('جارٍ فتح رابط التدريب…', 'Opening the training link…')}</p></Centered>;
        }
        if (choosing || !trainee?.linked) {
            return (
                <WhoAreYou
                    courseId={courseId}
                    course={course}
                    user={user}
                    existing={trainee}
                    onDone={(t) => { setTrainee(t); setChoosing(false); }}
                />
            );
        }
    }

    return (
        <>
            <TrainingBar course={course} trainee={user ? trainee : null} onChangeWho={() => setChoosing(true)} />
            {children}
        </>
    );
}

export default function TrainingGate({ children }) {
    if (!isTrainingMode()) return children;
    return <TrainingGateInner>{children}</TrainingGateInner>;
}
