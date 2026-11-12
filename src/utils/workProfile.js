// Work details every account is asked for after sign in / sign up, and the
// requests to be added to a human-resource group (program team, partner
// organization, facilitators).
//
// Both live on the person's own users/{uid} document:
//   workProfile: { jobTitle, jobTitleOther, phone, state, locality,
//                  workplaceType, facilityId, facilityName, program,
//                  programOther, organizationName, completedAt, updatedAt }
//   hrRequest:   { group, status, requestedAt, decidedBy, decidedAt, hrRecordId }
// Neither is a privileged field in firestore.rules, so a person can write their
// own; a manager reads them in Admin > Registrations and approves a request,
// which adds the person to the matching HR list. Approving never changes a
// role: roles are still given in Admin > Roles.

import { doc, collection, serverTimestamp, updateDoc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export const JOB_TITLES = [
    { id: 'doctor', en: 'Doctor', ar: 'طبيب' },
    { id: 'public_health', en: 'Public health', ar: 'صحة عامة' },
    { id: 'nurse', en: 'Nurse', ar: 'ممرض' },
    { id: 'nutritionist', en: 'Nutritionist', ar: 'أخصائي تغذية' },
    { id: 'pharmacist', en: 'Pharmacist', ar: 'صيدلي' },
    { id: 'other', en: 'Other', ar: 'أخرى' },
];

export const WORKPLACE_TYPES = [
    { id: 'facility', en: 'Health facility', ar: 'مؤسسة صحية' },
    { id: 'moh', en: 'Ministry of Health', ar: 'وزارة الصحة' },
    { id: 'locality', en: 'Locality health office', ar: 'إدارة الصحة بالمحلية' },
    { id: 'organization', en: 'Organization', ar: 'منظمة' },
];

export const PROGRAMS = [
    { id: 'child_health', en: 'Child health program', ar: 'برنامج صحة الطفل' },
    { id: 'nutrition', en: 'Nutrition program', ar: 'برنامج التغذية' },
    { id: 'epi', en: 'EPI', ar: 'التحصين الموسع' },
    { id: 'reproductive_health', en: 'Reproductive health', ar: 'الصحة الإنجابية' },
    { id: 'mch', en: 'MCH', ar: 'صحة الأم والطفل' },
    { id: 'phc', en: 'PHC', ar: 'الرعاية الصحية الأولية' },
    { id: 'malaria', en: 'Malaria', ar: 'الملاريا' },
    { id: 'expansion', en: 'Expansion', ar: 'التوسع' },
    { id: 'other', en: 'Other', ar: 'أخرى' },
];

// The groups a person can ask to join, and the HR list approval adds them to.
export const HR_GROUPS = [
    { id: 'program_team_federal', en: 'Program team (federal)', ar: 'فريق البرنامج (اتحادي)', collection: 'federalCoordinators' },
    { id: 'program_team_state', en: 'Program team (state)', ar: 'فريق البرنامج (ولائي)', collection: 'stateCoordinators' },
    { id: 'program_team_locality', en: 'Program team (locality)', ar: 'فريق البرنامج (محلية)', collection: 'localityCoordinators' },
    { id: 'partner', en: 'Partner organization', ar: 'منظمة شريكة', collection: 'funders' },
    { id: 'facilitator', en: 'Facilitators', ar: 'الميسرون', collection: 'facilitators' },
];

const byId = (list) => Object.fromEntries(list.map((o) => [o.id, o]));
const JOBS = byId(JOB_TITLES);
const PLACES = byId(WORKPLACE_TYPES);
const PROGS = byId(PROGRAMS);
const GROUPS = byId(HR_GROUPS);

export const optionLabel = (list, id, lang = 'en') => {
    const o = list.find((x) => x.id === id);
    if (!o) return id || '';
    return lang === 'ar' ? o.ar : o.en;
};

// Which program-team level fits the workplace, used to suggest a group.
export function suggestedGroup(profile = {}) {
    if (profile.workplaceType === 'organization') return 'partner';
    if (profile.state === 'Federal') return 'program_team_federal';
    if (profile.workplaceType === 'locality') return 'program_team_locality';
    return 'program_team_state';
}

// The fields a workplace type needs. Returns the list of missing field names.
export function missingWorkFields(p = {}) {
    const missing = [];
    const has = (v) => typeof v === 'string' ? v.trim().length > 0 : !!v;
    if (!JOBS[p.jobTitle]) missing.push('jobTitle');
    else if (p.jobTitle === 'other' && !has(p.jobTitleOther)) missing.push('jobTitleOther');
    if (!has(p.state)) missing.push('state');
    if (!has(p.locality)) missing.push('locality');
    if (!PLACES[p.workplaceType]) {
        missing.push('workplaceType');
        return missing;
    }
    if (p.workplaceType === 'facility') {
        if (!has(p.facilityName)) missing.push('facilityName');
    } else if (p.workplaceType === 'organization') {
        if (!has(p.organizationName)) missing.push('organizationName');
    } else {
        if (!PROGS[p.program]) missing.push('program');
        else if (p.program === 'other' && !has(p.programOther)) missing.push('programOther');
    }
    return missing;
}

export const isWorkProfileComplete = (p) => !!p && missingWorkFields(p).length === 0;

// Keeps only the fields that belong to the chosen workplace type, trimmed.
export function cleanWorkProfile(p = {}) {
    const s = (v) => (typeof v === 'string' ? v.trim() : '');
    const out = {
        jobTitle: p.jobTitle || '',
        jobTitleOther: p.jobTitle === 'other' ? s(p.jobTitleOther) : '',
        phone: s(p.phone),
        state: s(p.state),
        locality: s(p.locality),
        workplaceType: p.workplaceType || '',
        facilityId: '',
        facilityName: '',
        program: '',
        programOther: '',
        organizationName: '',
    };
    if (p.workplaceType === 'facility') {
        out.facilityId = p.facilityId || '';
        out.facilityName = s(p.facilityName);
    } else if (p.workplaceType === 'organization') {
        out.organizationName = s(p.organizationName);
    } else if (p.workplaceType === 'moh' || p.workplaceType === 'locality') {
        out.program = p.program || '';
        out.programOther = p.program === 'other' ? s(p.programOther) : '';
    }
    return out;
}

// One line that says where someone works, for lists and the profile card.
export function describeWorkplace(p = {}, lang = 'en') {
    if (!p || !p.workplaceType) return '';
    const place = optionLabel(WORKPLACE_TYPES, p.workplaceType, lang);
    let detail = '';
    if (p.workplaceType === 'facility') detail = p.facilityName;
    else if (p.workplaceType === 'organization') detail = p.organizationName;
    else detail = p.program === 'other' ? p.programOther : optionLabel(PROGRAMS, p.program, lang);
    return [place, detail].filter(Boolean).join(': ');
}

export const describeJob = (p = {}, lang = 'en') =>
    (p?.jobTitle === 'other' && p.jobTitleOther) ? p.jobTitleOther : optionLabel(JOB_TITLES, p?.jobTitle, lang);

// Saves the person's own work details, and a join request when one is picked.
// A request already decided is not reopened unless a different group is asked for.
export async function saveWorkProfile(uid, profile, requestGroup, previousRequest) {
    const clean = cleanWorkProfile(profile);
    const update = {
        workProfile: {
            ...clean,
            completedAt: profile.completedAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
        },
    };
    if (requestGroup && GROUPS[requestGroup]) {
        const same = previousRequest && previousRequest.group === requestGroup && previousRequest.status !== 'rejected';
        if (!same) {
            update.hrRequest = { group: requestGroup, status: 'pending', requestedAt: serverTimestamp() };
        }
    } else if (previousRequest?.status === 'pending') {
        update.hrRequest = { ...previousRequest, status: 'cancelled', decidedAt: serverTimestamp() };
    }
    await updateDoc(doc(db, 'users', uid), update);
    return clean;
}

// The record an approved request adds to the group's HR list.
export function hrRecordFor(user, groupId) {
    const p = user.workProfile || {};
    const name = user.displayName || user.name || '';
    const jobTitle = describeJob(p, 'en');
    const base = { source: 'app_registration', userId: user.id || '', addedFromRegistrationAt: serverTimestamp() };
    if (groupId === 'facilitator') {
        return { ...base, name, phone: p.phone || '', email: user.email || '', isUserEmail: true,
            currentState: p.state || '', currentLocality: p.locality || '', backgroundQualification: jobTitle, courses: [] };
    }
    if (groupId === 'partner') {
        return { ...base, orgName: p.organizationName || name, focalPerson: name, phoneNumber: p.phone || '', email: user.email || '',
            state: p.state || '', projects: [] };
    }
    const unit = p.workplaceType === 'facility' ? p.facilityName
        : p.workplaceType === 'organization' ? p.organizationName
            : (p.program === 'other' ? p.programOther : optionLabel(PROGRAMS, p.program, 'en'));
    return { ...base, name, phone: p.phone || '', email: user.email || '',
        state: groupId === 'program_team_federal' ? (p.state || 'Federal') : (p.state || ''),
        locality: groupId === 'program_team_locality' ? (p.locality || '') : '',
        jobTitle, jobTitleOther: '', role: '', unit: unit || '' };
}

// Approve: add the person to the HR list (once) and mark the request approved.
// A partner request joins an existing partner with the same name instead of
// adding a second copy of the organization.
export async function approveHrRequest(user, approverEmail) {
    const group = GROUPS[user.hrRequest?.group];
    if (!group) throw new Error('Unknown group');
    const batch = writeBatch(db);
    let recordId = '';
    const record = hrRecordFor(user, group.id);

    let existing = null;
    if (group.id === 'partner' && record.orgName) {
        const snap = await getDocs(query(collection(db, 'funders'), where('orgName', '==', record.orgName)));
        existing = snap.docs[0] || null;
    } else if (user.email) {
        const snap = await getDocs(query(collection(db, group.collection), where('email', '==', user.email)));
        existing = snap.docs.find((d) => d.data().isDeleted !== true) || null;
    }
    if (existing) {
        recordId = existing.id;
    } else {
        const ref = doc(collection(db, group.collection));
        recordId = ref.id;
        batch.set(ref, { ...record, lastUpdatedAt: serverTimestamp() });
    }
    batch.update(doc(db, 'users', user.id), {
        hrRequest: { ...user.hrRequest, status: 'approved', decidedBy: approverEmail || '', decidedAt: serverTimestamp(), hrRecordId: recordId, alreadyListed: !!existing },
    });
    await batch.commit();
    return { recordId, alreadyListed: !!existing };
}

export async function rejectHrRequest(user, approverEmail) {
    await updateDoc(doc(db, 'users', user.id), {
        hrRequest: { ...user.hrRequest, status: 'rejected', decidedBy: approverEmail || '', decidedAt: serverTimestamp() },
    });
}

// --- Dashboard helpers (pure) -------------------------------------------------

export const tsMillis = (v) => {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    const n = new Date(v).getTime();
    return Number.isFinite(n) ? n : 0;
};

// "new" = account created within `days` days; accounts with no creation date
// were made before the date was recorded, so they count as existing.
export function registrationKind(user, now = Date.now(), days = 30) {
    const created = tsMillis(user.createdAt);
    if (created && now - created <= days * 86400000) return 'new';
    return 'existing';
}

export function summarizeRegistrations(users = [], now = Date.now(), days = 30) {
    const out = { total: 0, newUsers: 0, existing: 0, completed: 0, missing: 0, pending: 0, byJob: {}, byWorkplace: {}, byState: {} };
    for (const u of users) {
        out.total += 1;
        if (registrationKind(u, now, days) === 'new') out.newUsers += 1; else out.existing += 1;
        const done = isWorkProfileComplete(u.workProfile);
        if (done) {
            out.completed += 1;
            const p = u.workProfile;
            out.byJob[p.jobTitle] = (out.byJob[p.jobTitle] || 0) + 1;
            out.byWorkplace[p.workplaceType] = (out.byWorkplace[p.workplaceType] || 0) + 1;
            out.byState[p.state] = (out.byState[p.state] || 0) + 1;
        } else {
            out.missing += 1;
        }
        if (u.hrRequest?.status === 'pending') out.pending += 1;
    }
    return out;
}
