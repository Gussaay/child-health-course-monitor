// An upload "replace" deletes a course's old modules and lessons for good and
// writes new ones under the same importBatch. Phones sync lessons by what
// changed, so they never hear of the deletion and keep the old copies, which
// then show next to the new ones (each module twice, with the old progress).
//
// This drops those leftovers on the device, with no download: within one
// course and import batch, a module whose number also belongs to a module
// written at least ten minutes later is an old copy, and so are its lessons.
// Modules and lessons added in the app carry no importBatch and are kept.
const GAP_MS = 10 * 60 * 1000;
const ms = (v) => (v?.toMillis ? v.toMillis() : (typeof v?.seconds === 'number' ? v.seconds * 1000 : (typeof v === 'string' ? Date.parse(v) || 0 : Number(v) || 0)));

export function dropReplacedLeftovers(items) {
    if (!Array.isArray(items) || items.length === 0) return items || [];
    const newest = new Map(); // course|batch|order -> newest createdAt
    const slot = (m) => `${m.courseId}|${m.importBatch}|${m.order}`;
    items.forEach((i) => {
        if (i?.kind !== 'module' || !i.importBatch || i.isDeleted === true) return;
        const t = ms(i.createdAt);
        if (t > (newest.get(slot(i)) || 0)) newest.set(slot(i), t);
    });
    const old = new Set();
    items.forEach((i) => {
        if (i?.kind !== 'module' || !i.importBatch) return;
        const t = ms(i.createdAt);
        if (t > 0 && (newest.get(slot(i)) || 0) - t >= GAP_MS) old.add(i.id);
    });
    if (old.size === 0) return items;
    return items.filter((i) => !old.has(i.id)
        && !(i.kind === 'section' && i.importBatch && old.has(i.moduleId)));
}
