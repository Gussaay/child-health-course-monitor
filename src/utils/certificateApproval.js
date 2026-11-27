// src/utils/certificateApproval.js
//
// Small certificate and participant-name helpers, kept out of
// components/constants.js on purpose: constants.js is ~99 KB of mostly
// static reference data that only lazy-loaded screens need, and these were
// the pieces eager modules (data.js) imported from it. constants.js
// re-exports every name below, so existing importers keep working.

export const hasArabicScript = (text) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(text || ''));

/** The participant's name in one language ('en' | 'ar'), or '' when it is only known in the other. */
export const participantNameOnly = (participant, language) => {
    const own = String(participant?.[language === 'ar' ? 'nameAr' : 'nameEn'] || '').trim();
    if (own) return own;
    const main = String(participant?.name || '').trim();
    if (!main) return '';
    return (language === 'ar') === hasArabicScript(main) ? main : '';
};

/**
 * The name printed on a certificate in `language`: the name in that language,
 * else the one in the other language, else the record's name.
 */
export const participantNameIn = (participant, language) =>
    participantNameOnly(participant, language)
    || participantNameOnly(participant, language === 'ar' ? 'en' : 'ar')
    || String(participant?.name || '').trim();

/** What a participant's certificate approval snapshot is called on their record. */
export const CERT_APPROVAL_FIELD = 'certificateApproval';

/**
 * The sub-course a certificate prints for a participant.
 *
 * Their own record first, then their group's assignment, then the course
 * director's. Note this is deliberately NOT the order used by
 * participantsForModule: that decides which skills checklist applies and the
 * group is authoritative there, whereas this is the line of text printed on a
 * certificate, where what the participant's own record says has always won.
 * Changing it would silently reissue certificates with different wording.
 */
export const certificateSubCourseOf = (course, participant) => {
    if (participant?.imci_sub_type) return participant.imci_sub_type;
    const byGroup = (course?.facilitatorAssignments || [])
        .find((a) => a?.group === participant?.group)?.imci_sub_type;
    return byGroup || course?.director_imci_sub_type || null;
};

/**
 * What to write on a participant's record when their certificate is approved.
 *
 * Built here rather than at each call site so the snapshot and the comparison
 * can never read different fields — the fault that would make a certificate
 * look stale forever, or never.
 */
export const certificateApprovalSnapshot = (participant, course, approvedBy = '') => ({
    name: participant?.name || '',
    nameEn: participantNameIn(participant, 'en'),
    nameAr: participantNameIn(participant, 'ar'),
    subCourse: certificateSubCourseOf(course, participant) || '',
    at: new Date().toISOString(),
    by: approvedBy || '',
});
