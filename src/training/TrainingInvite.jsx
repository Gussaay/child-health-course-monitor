// src/training/TrainingInvite.jsx
//
// In the normal app: when the signed-in person is a participant of a course
// whose training link is open now, show a bar that takes them into that
// course's practice app. Trainees who open the normal app (for example the
// Android app, or a bookmark) instead of the training link would otherwise
// land in the real data, where an ordinary account has no rights and every
// save is refused.
//
// The person is matched like the training link does: the account saved on the
// participant record (trainingLink.uid), or the participant's e-mail.

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { isTrainingMode, trainingStatus } from './trainingSession.js';

/** The courses with an open training link that this account is a participant of. */
export async function findOpenTrainingCourses(user, now = Date.now()) {
    if (!user?.uid) return [];
    const queries = [getDocs(query(collection(db, 'participants'), where('trainingLink.uid', '==', user.uid)))];
    if (user.email) {
        queries.push(getDocs(query(collection(db, 'participants'), where('email', '==', user.email))));
        const lower = user.email.trim().toLowerCase();
        if (lower !== user.email) queries.push(getDocs(query(collection(db, 'participants'), where('email', '==', lower))));
    }
    const snaps = await Promise.allSettled(queries);
    const courseIds = new Set();
    for (const s of snaps) {
        if (s.status !== 'fulfilled') continue;
        s.value.docs.forEach((d) => {
            const p = d.data();
            if (p?.courseId && p.isDeleted !== true) courseIds.add(p.courseId);
        });
    }
    const courses = await Promise.all([...courseIds].slice(0, 20).map(async (id) => {
        try {
            const snap = await getDoc(doc(db, 'courses', id));
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch { return null; }
    }));
    return courses.filter((c) => c && trainingStatus(c, now) === 'open');
}

export default function TrainingInvite({ user }) {
    const { i18n } = useTranslation();
    const ar = (i18n.language || '').toLowerCase().startsWith('ar');
    const L = (a, e) => (ar ? a : e);
    const [courses, setCourses] = useState([]);

    useEffect(() => {
        if (isTrainingMode() || !user?.uid) { setCourses([]); return undefined; }
        let cancelled = false;
        findOpenTrainingCourses(user)
            .then((list) => { if (!cancelled) setCourses(list); })
            .catch(() => { /* no invitation then */ });
        return () => { cancelled = true; };
    }, [user]);

    if (courses.length === 0) return null;
    return (
        <div dir={ar ? 'rtl' : 'ltr'} className="bg-amber-400 text-amber-950 px-3 py-2 text-sm" role="status">
            {courses.map((c) => (
                <div key={c.id} className="flex items-center justify-center gap-3 flex-wrap">
                    <span>
                        🎓 {L(`دورتك ${c.course_type || ''} لها تطبيق تدريب مفتوح الآن. تدرّب هناك، لا هنا.`,
                            `Your ${c.course_type || ''} course has a practice app open now. Practise there, not here.`)}
                    </span>
                    <button
                        type="button"
                        onClick={() => window.location.assign(`/training/${c.id}`)}
                        className="px-3 py-1 rounded-lg bg-slate-900 text-white font-semibold"
                    >
                        {L('فتح تطبيق التدريب', 'Open the practice app')}
                    </button>
                </div>
            ))}
        </div>
    );
}
