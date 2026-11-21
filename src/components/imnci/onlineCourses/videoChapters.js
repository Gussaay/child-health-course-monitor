// src/components/imnci/onlineCourses/videoChapters.js
//
// "Jump to the skill" chapters on a lesson's video, set by a manager while
// watching it (VideoBlock in Manage mode: "Mark the skill start here"). The
// video is never cut (licences such as Global Health Media Project's do not
// allow clipping); a chapter only starts the whole video at that moment.

const same = (a, b) => a?.type === 'video' && a.url === b.url && (a.title || '') === (b.title || '')
    && JSON.stringify(a.chapters || []) === JSON.stringify(b.chapters || []);

/**
 * The section with `chapters` set on the video block `block` (found by its
 * content in read, see or practise), sorted by time; null when not found.
 */
export function sectionWithChapters(section, block, chapters) {
    for (const tab of ['read', 'see', 'practise']) {
        const list = section?.[tab] || [];
        const i = list.findIndex((b) => same(b, block));
        if (i < 0) continue;
        const clean = (chapters || [])
            .map((c) => ({ at: Math.max(0, Math.round(Number(c.at) || 0)), label: String(c.label || '').trim() }))
            .filter((c) => c.label)
            .sort((x, y) => x.at - y.at);
        const next = [...list];
        const b = { ...list[i] };
        if (clean.length) b.chapters = clean; else delete b.chapters;
        next[i] = b;
        return { ...section, [tab]: next };
    }
    return null;
}
