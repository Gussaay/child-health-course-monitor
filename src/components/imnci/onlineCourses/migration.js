// src/components/imnci/onlineCourses/migration.js
// =============================================================================
// Migration from the Android app's Realtime Database
//
// Read-only against the source, and it never guesses: a section whose module
// key is not in the export is reported rather than attached to something
// plausible.
// =============================================================================

const num = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
};

export const LEGACY_DB = 'https://child-health-courses-default-rtdb.firebaseio.com';

export function mapLegacyCourse(raw) {
    return {
        title: String(raw.course_title || '').trim() || 'Untitled course',
        description: String(raw.des || '').trim(),
        imageUrl: String(raw.img || '').trim(),
        isPublished: String(raw.publish) === 'true',
        legacyKey: raw.course_key || null,
        source: 'migrated',
    };
}

export function mapLegacyModule(raw) {
    return {
        kind: 'module',
        title: String(raw.module_title || '').trim() || 'Untitled module',
        order: num(raw.module_number) ?? 0,
        imageUrl: String(raw.img || '').trim(),
        isPublished: String(raw.publish) === 'true',
        legacyKey: raw.module_key || null,
        source: 'migrated',
    };
}

/**
 * Turns a Realtime Database export into one course plus its items.
 * @returns {{course, items, warnings}} warnings name anything that could not be
 *          attached, so a partial import is visible rather than quietly short.
 */
export function buildMigration(legacy, courseKey) {
    const courses = Object.values(legacy.course || {});
    const raw = courses.find((c) => c.course_key === courseKey) || courses[0];
    if (!raw) return { course: null, items: [], warnings: ['No course found in the export.'] };

    const key = raw.course_key;
    const modules = Object.values(legacy.module || {}).filter((m) => m.course_key === key);
    const legacySectionCount = Object.values(legacy.section || {}).filter((s) => s.course_key === key).length;
    const warnings = [];

    if (legacySectionCount) {
        warnings.push(`${legacySectionCount} sections in the original app are page references into a PDF. They are not imported — convert each module book instead, which produces readable text.`);
    }

    // Two modules in the live data share a title and hold no sections. Flagged,
    // not dropped: deciding what is a duplicate is the programme's call.
    const byTitle = {};
    modules.forEach((m) => {
        const t = String(m.module_title || '').trim().toLowerCase();
        byTitle[t] = (byTitle[t] || 0) + 1;
    });
    Object.entries(byTitle).forEach(([t, n]) => {
        if (n > 1) warnings.push(`${n} modules share the title "${t}".`);
    });

    return {
        course: mapLegacyCourse(raw),
        // Only the structure. The old records were page references into a
        // PDF, which is the model this module has moved away from; their
        // content now comes from converting the module book.
        items: modules.map(mapLegacyModule),
        warnings,
    };
}
