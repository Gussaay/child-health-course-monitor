// Child Health Library: the services and categories it is organised by, and
// the pure rules for a library item. No Firebase here, so it can be tested.
//
// An item is one document in `libraryItems`:
//   { service, category, name, description, imageUrl, imagePath,
//     linkUrl, filePath, fileName, createdAt, createdBy, updatedAt }
// `imageUrl` is the photo (uploaded, then `imagePath` is its storage path, or a
// direct link). `linkUrl` is the content itself (an uploaded file, then
// `filePath` is set, or a direct link to a page, video or document).

// The child health services shown on the library's first page, as on the
// Courses page.
export const LIBRARY_SERVICES = [
    { key: 'IMNCI', short: 'IMNCI', titleKey: 'imnci', title: 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)' },
    { key: 'ICCM', short: 'iCCM', titleKey: 'iccm', title: 'Integrated Community Case Management for under 5 children (iCCM)' },
    { key: 'ETAT', short: 'ETAT', titleKey: 'etat', title: 'Emergency Triage, Assessment & Treatment (ETAT)' },
    { key: 'EENC', short: 'EENC', titleKey: 'eenc', title: 'Early Essential Newborn Care (EENC)' },
    { key: 'EmONC', short: 'EmONC', titleKey: 'emonc', title: 'Emergency Obstetric and Newborn Care (EmONC)' },
    { key: 'Small & Sick Newborn', short: 'Small & Sick Newborn', titleKey: 'ssnc', title: 'Small & Sick Newborn Care' },
    { key: 'IPC', short: 'IPC', titleKey: 'ipc', title: 'Infection Prevention & Control (Neonatal Unit)' },
    { key: 'Comprehensive Package For Community Midwives', short: 'Community Midwives', titleKey: 'midwives', title: 'Comprehensive Package For Community Midwives' },
    { key: 'Program Management', short: 'Program Management', titleKey: 'program_management', title: 'Program Management' },
];

// The sub-categories inside every service.
export const LIBRARY_CATEGORIES = [
    { key: 'training', label: 'Training', hint: 'Training packages, modules and materials' },
    { key: 'guidelines', label: 'Guidelines & Protocols', hint: 'National guidelines and clinical protocols' },
    { key: 'operational', label: 'Operational Guides & SOP', hint: 'Operational guides and standard operating procedures' },
];

export const LIBRARY_COLLECTION = 'libraryItems';

// Photos stay small; content files (books, guides) may be larger.
export const LIBRARY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const LIBRARY_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const LIBRARY_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
export const LIBRARY_FILE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4',
    ...LIBRARY_IMAGE_TYPES,
];

export const isLibraryService = (key) => LIBRARY_SERVICES.some((s) => s.key === key);
export const isLibraryCategory = (key) => LIBRARY_CATEGORIES.some((c) => c.key === key);

// Federal managers and super users add, edit and remove library content.
export function canManageLibrary(permissions) {
    return !!permissions?.canUseFederalManagerAdvancedFeatures;
}

// A web address the library will store: http(s) only, so a typed
// "javascript:" or "data:" link can never be opened from a card.
export function normaliseLink(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(withScheme);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
        return url.href;
    } catch {
        return null;
    }
}

/** A message for a file the library will not take, or null when it is fine. */
export function validateLibraryFile(file, kind) {
    if (!file) return 'No file selected.';
    const isImage = kind === 'image';
    const types = isImage ? LIBRARY_IMAGE_TYPES : LIBRARY_FILE_TYPES;
    const max = isImage ? LIBRARY_IMAGE_MAX_BYTES : LIBRARY_FILE_MAX_BYTES;
    if (!types.includes(file.type)) {
        return isImage
            ? 'The photo must be a PNG, JPEG, WebP or GIF image.'
            : 'The file must be a PDF, Word, PowerPoint, Excel, MP4 video or image.';
    }
    if (typeof file.size === 'number' && file.size >= max) {
        return `The file is too large (limit ${Math.round(max / 1024 / 1024)} MB).`;
    }
    return null;
}

// What each error code of validateLibraryItem() says (translated under library.errors).
export const LIBRARY_ERROR_TEXT = {
    name: 'Enter a name.',
    name_long: 'The name is too long (200 characters at most).',
    description: 'The description is too long (3000 characters at most).',
    service: 'Choose a service.',
    category: 'Choose a section.',
    image: 'Enter a valid web address for the photo (https://...).',
    link: 'Enter a valid web address (https://...).',
    content: 'Upload a file or add a direct link to the content.',
};

/**
 * Checks a filled-in item form. Returns { errors, item }: `errors` maps a
 * field to an error code of LIBRARY_ERROR_TEXT (empty when the form is fine) and `item` is the cleaned
 * record to save. Photo and content each come from an uploaded file OR a link.
 */
export function validateLibraryItem(form) {
    const errors = {};
    const name = String(form?.name || '').trim();
    const description = String(form?.description || '').trim();
    if (!name) errors.name = 'name';
    else if (name.length > 200) errors.name = 'name_long';
    if (description.length > 3000) errors.description = 'description';
    if (!isLibraryService(form?.service)) errors.service = 'service';
    if (!isLibraryCategory(form?.category)) errors.category = 'category';

    let imageUrl = '';
    if (form?.imageMode === 'link') {
        imageUrl = normaliseLink(form.imageLink);
        if (imageUrl === null) errors.image = 'image';
    }
    let linkUrl = '';
    if (form?.contentMode === 'link') {
        linkUrl = normaliseLink(form.contentLink);
        if (linkUrl === null) errors.content = 'link';
    }
    const hasUploadedContent = form?.contentMode === 'upload' && (form.contentFile || form.existingLinkUrl);
    if (!linkUrl && !hasUploadedContent && !errors.content) {
        errors.content = 'content';
    }

    return {
        errors,
        item: { service: form?.service, category: form?.category, name, description, imageUrl: imageUrl || '', linkUrl: linkUrl || '' },
    };
}

/** Items of one service and category, newest first, filtered by a search. */
export function itemsFor(items, service, category, search = '') {
    const q = String(search || '').trim().toLowerCase();
    return (items || [])
        .filter((it) => it.service === service && (!category || it.category === category))
        .filter((it) => !q || `${it.name || ''} ${it.description || ''}`.toLowerCase().includes(q))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

/** How many items each service (or each category of one service) holds. */
export function countBy(items, field, service) {
    const out = {};
    (items || []).forEach((it) => {
        if (service && it.service !== service) return;
        const key = it[field];
        out[key] = (out[key] || 0) + 1;
    });
    return out;
}

function toMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const n = new Date(value).getTime();
    return Number.isFinite(n) ? n : 0;
}
