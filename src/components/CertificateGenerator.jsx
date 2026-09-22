import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from "jspdf";
import { QRCodeCanvas } from 'qrcode.react';

// 🟢 NEW: Capacitor Native Imports
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

// Common Components & Icons
import { 
    Button, Card, EmptyState, PageHeader, 
    Spinner, Table, Modal, CardBody, CardFooter, FormGroup, Select, Input
} from './CommonComponents'; 
import { Award, FileSignature, Stamp, CheckCircle, Settings, Upload, ArrowLeft, Plus, Trash2, Layers, Eye, Download, RefreshCw, X } from 'lucide-react'; 

// Data & Firebase
import { STATE_LOCALITIES } from './constants'; 
import { db } from '../firebase'; 
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc, deleteDoc, serverTimestamp, deleteField } from 'firebase/firestore'; 
import { useDataCache } from '../DataContext';
import { 
    getParticipantById, 
    getCourseById, 
    listAllParticipantsForCourse, 
    listFederalCoordinators, 
    unapproveCourseCertificates, 
    uploadFile 
} from '../data.js';
import { notify, confirmDialog } from './dialogs';

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

const getArabicMonthName = (monthIndex) => {
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return months[monthIndex];
};

const getEnglishMonthName = (monthIndex) => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months[monthIndex];
};

const getDayWithSuffix = (day) => {
    let suffix;
    if (day > 3 && day < 21) suffix = 'th';
    else {
        switch (day % 10) {
            case 1: suffix = 'st'; break;
            case 2: suffix = 'nd'; break;
            case 3: suffix = 'rd'; break;
            default: suffix = 'th';
        }
    }
    return `${day}<sup style="font-size: 0.6em; line-height: 0;">${suffix}</sup>`;
};

/**
 * Formats an explicit start/end pair chosen from the calendar, using exactly the
 * same conventions as the auto-computed course date: ordinal suffixes in English,
 * Arabic month names in Arabic, and a collapsed month or year when both dates
 * share one. Returns an HTML string. `endISO` may be omitted for a single day.
 */
const formatCertificateDateRange = (startISO, endISO, isArabic) => {
    const parse = (iso) => {
        if (!iso || typeof iso !== 'string') return null;
        const [y, m, d] = iso.split('-').map(Number);
        if (!y || !m || !d) return null;
        const dt = new Date(Date.UTC(y, m - 1, d));
        return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const s = parse(startISO);
    if (!s) return '';
    const e = parse(endISO) || s;

    const sd = s.getUTCDate(), sm = s.getUTCMonth(), sy = s.getUTCFullYear();
    const ed = e.getUTCDate(), em = e.getUTCMonth(), ey = e.getUTCFullYear();
    const sameDay = sd === ed && sm === em && sy === ey;

    if (isArabic) {
        const sMon = getArabicMonthName(sm), eMon = getArabicMonthName(em);
        if (sameDay) return `${sd} ${sMon} ${sy}`;
        if (sm === em && sy === ey) return `${sd} - ${ed} ${sMon} ${sy}`;
        if (sy === ey) return `${sd} ${sMon} - ${ed} ${eMon} ${ey}`;
        return `${sd} ${sMon} ${sy} - ${ed} ${eMon} ${ey}`;
    }

    const sMon = getEnglishMonthName(sm), eMon = getEnglishMonthName(em);
    const sDay = getDayWithSuffix(sd), eDay = getDayWithSuffix(ed);
    if (sameDay) return `${sDay} ${sMon} ${sy}`;
    if (sm === em && sy === ey) return `${sDay} - ${eDay} ${sMon} ${sy}`;
    if (sy === ey) return `${sDay} ${sMon} - ${eDay} ${eMon} ${ey}`;
    return `${sDay} ${sMon} ${sy} - ${eDay} ${eMon} ${ey}`;
};

/**
 * Normalises a participant name for printing: each of the name parts (Sudanese
 * names usually run to four) gets one leading capital and the rest lower case,
 * so records entered as "AHMED MOHAMED ALI HASSAN" or "ahmed mohamed ali hassan"
 * both print as "Ahmed Mohamed Ali Hassan".
 *
 * Compound parts joined by a hyphen or apostrophe are capitalised on both sides
 * of the joiner, which matters for transliterated names — "abdel-rahman" becomes
 * "Abdel-Rahman", not "Abdel-rahman". Runs of whitespace collapse to one space.
 *
 * Arabic script has no letter case, so this is effectively a whitespace tidy for
 * Arabic names and safe to apply in both languages.
 *
 * Note this deliberately lower-cases the rest of every part, exactly as asked,
 * so an intentional inner capital ("McDonald") would print as "Mcdonald". Tick
 * "Keep name exactly as entered" on the Participant name element for such cases.
 */
export const normalizeParticipantName = (raw) => {
    if (!raw || typeof raw !== 'string') return raw || '';

    const capitalisePart = (part) =>
        part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase();

    return raw
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map(word =>
            // Keep the joiners by capturing them in the split.
            word
                .split(/([-'’])/)
                .map(part => (/^[-'’]$/.test(part) || part === '' ? part : capitalisePart(part)))
                .join('')
        )
        .join(' ');
};

/** Adds (duration - 1) days to an ISO date, for prefilling the end-date picker. */
const addDaysISO = (startISO, days) => {
    if (!startISO) return '';
    const [y, m, d] = startISO.split('-').map(Number);
    if (!y || !m || !d) return '';
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
};

const getCertificateCourseTitle = (courseType, language = 'en', subCourse = '') => {
    const normalizedType = courseType ? courseType.trim() : '';
    const normalizedSub = subCourse ? subCourse.trim().toLowerCase() : '';
    
    const isEencSub = normalizedType === 'EmONC' && 
                     (normalizedSub === 'eenc orientation' || 
                      normalizedSub === 'eenc tot' || 
                      normalizedSub === 'eenc mentorship');

    if (language === 'ar') {
        if (isEencSub) return 'الرعاية الضرورية المبكرة للاطفال حديثي الولادة';

        switch (normalizedType) {
            case 'ICCM': return 'العلاج المتكامل للأطفال أقل من 5 سنوات في المجتمع';
            case 'IMNCI': return 'العلاج المتكامل للاطفال اقل من 5 سنوات (IMNCI)';
            case 'ETAT': return 'الفرز والتقييم والعلاج للاطفال اقل من 5 سنوات (ETAT)';
            case 'EENC': return 'الرعاية الضرورية المبكرة لحديثي الولادة (EENC)';
            case 'IPC': return 'مكافحة العدوى (وحدة حديثي الولادة)';
            case 'Small & Sick Newborn': return 'رعاية الاطفال حديثي الولادة المرضى والصغار';
            case 'Program Management': return 'إدارة برنامج صحة الطفل';
            case 'Comprehensive Package For Community Midwives': return 'الحزمة الشاملة لقابلات المجتمع';
            default: return normalizedType;
        }
    }

    if (isEencSub) return 'Early Essential Newborn Care';

    switch (normalizedType) {
        case 'IMNCI': return 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)';
        case 'ICCM': return 'Integrated Community case management for under 5 children (iCCM)';
        case 'ETAT': return 'Emergency Triage, Assessment & Treatment (ETAT)';
        case 'EENC': return 'Early Essential Newborn Care (EENC)';
        case 'IPC': return 'Infection Prevention & Control (Neonatal Unit)';
        case 'Small & Sick Newborn': return 'Small & Sick Newborn Case Management';
        case 'Program Management': return 'Program Management';
        case 'Comprehensive Package For Community Midwives': return 'Comprehensive Package For Community Midwives';
        default: return normalizedType;
    }
};

const getSmallAndSickSubCourseArabic = (subCourse) => {
    if (!subCourse) return '';
    const normalized = subCourse.trim();
    switch (normalized) {
        case 'Portable warmer training': return 'التدريب على المدفأة المحمولة';
        case 'CPAP training': return 'التدريب على جهاز CPAP';
        case 'Kangaroo Mother Care': return 'رعاية الأم الكنغر (KMC)';
        case 'Module (1) Emergency and Essential Newborn Care': return 'الوحدة (1) الطوارئ والرعاية الأساسية لحديثي الولادة';
        case 'Module (2) Special Newborn Care': return 'الوحدة (2) رعاية حديثي الولادة الخاصة';
        case 'Module (3) Intensive Newborn Care': return 'الوحدة (3) العناية المكثفة لحديثي الولادة';
        default: return subCourse; 
    }
};

const fetchArabicNameHelper = async (cachedList, collectionName, englishName, fieldName, specificId = null) => {
    if (specificId) {
        if (cachedList && cachedList.length > 0) {
            const match = cachedList.find(item => item.id === specificId);
            if (match && match[fieldName]) return match[fieldName];
        }
        try {
            const docSnap = await getDoc(doc(db, collectionName, specificId));
            if (docSnap.exists() && docSnap.data()[fieldName]) return docSnap.data()[fieldName];
        } catch (e) { console.error("Error fetching Arabic name by ID", e); }
    }

    if (!englishName) return null;
    const searchName = englishName.trim().toLowerCase();
    const cleanSearchName = searchName.replace(/^dr\.?\s*/i, '').trim();

    if (cachedList && cachedList.length > 0) {
        const match = cachedList.find(item => {
            const itemName = (item.name || '').trim().toLowerCase();
            const cleanItemName = itemName.replace(/^dr\.?\s*/i, '').trim();
            return itemName === searchName || cleanItemName === cleanSearchName;
        });
        if (match && match[fieldName]) return match[fieldName];
    }

    try {
        let q = query(collection(db, collectionName), where("name", "==", englishName.trim()));
        let snapshot = await getDocs(q);

        if (snapshot.empty) {
            q = query(collection(db, collectionName), where("name", "==", `Dr. ${englishName.trim()}`));
            snapshot = await getDocs(q);
        }

        if (snapshot.empty) {
            q = query(collection(db, collectionName), where("name", "==", `Dr ${englishName.trim()}`));
            snapshot = await getDocs(q);
        }

        if (snapshot.empty) {
            const stripped = englishName.trim().replace(/^Dr\.?\s*/i, '').trim();
            q = query(collection(db, collectionName), where("name", "==", stripped));
            snapshot = await getDocs(q);
        }

        if (!snapshot.empty) {
            return snapshot.docs[0].data()[fieldName] || null;
        } else {
            const allDocsSnapshot = await getDocs(collection(db, collectionName));
            const match = allDocsSnapshot.docs.find(doc => {
                const itemName = (doc.data().name || '').trim().toLowerCase();
                const cleanItemName = itemName.replace(/^dr\.?\s*/i, '').trim();
                return itemName === searchName || cleanItemName === cleanSearchName;
            });
            if (match && match.data()[fieldName]) return match.data()[fieldName];
        }
    } catch (error) { console.error(`Error fetching Arabic name from ${collectionName}:`, error); }
    return null;
};

const imageUrlToBase64 = async (url) => {
    if (!url) return null;
    // Already inline (a signature encoded client-side) — nothing to fetch.
    if (/^data:/i.test(url)) return url;
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting image to base64:", error);
        return null; 
    }
};

// -----------------------------------------------------------------------------
// SIGNATURE / STAMP HANDLING — NO FIREBASE STORAGE
//
// Signatures and stamps are never uploaded to Firebase Storage. A Storage object
// gets a permanent, unauthenticated download URL: anyone who ever sees that link
// keeps a working copy of an official signature even after the certificate is
// revoked, and it cannot be protected by Firestore rules. Instead the image is
// downscaled and encoded in the browser and the resulting data URL is written
// into the course document, so it is covered by the same Firestore rules as the
// rest of the course, is delivered only to users who can already read that
// course, and disappears the instant the field is cleared on revoke.
//
// The cost is the 1 MiB Firestore document ceiling, so images are aggressively
// shrunk and each one is size-checked before it can be stored.
// -----------------------------------------------------------------------------

// Keep well under the 1 MiB document limit: several signatures, a stamp and the
// rest of the course data all share one document.
const MAX_SIGNATURE_BYTES = 90 * 1024;
const SIGNATURE_MAX_DIM = 600;
// Firestore hard-limits a document to 1 MiB; stop well short of it.
const MAX_CUSTOM_CERT_BYTES = 700 * 1024;

/**
 * Reads an image file and returns a downscaled PNG data URL. PNG (not JPEG) so
 * that a signature scanned on a transparent background stays transparent and
 * does not print as a white box over the certificate border.
 */
export const fileToSignatureDataUrl = (file, maxDim = SIGNATURE_MAX_DIM) => new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided.'));
    if (!/^image\//i.test(file.type)) return reject(new Error('Please choose an image file (PNG or JPEG).'));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('That file is not a readable image.'));
        img.onload = () => {
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            let dataUrl;
            try {
                dataUrl = canvas.toDataURL('image/png');
            } catch (err) {
                return reject(new Error('Could not process that image.'));
            }

            // Approximate decoded size of the base64 payload.
            const bytes = Math.ceil((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75);
            if (bytes > MAX_SIGNATURE_BYTES) {
                return reject(new Error(
                    `That image is too large to store securely (${Math.round(bytes / 1024)} KB after compression, limit ${Math.round(MAX_SIGNATURE_BYTES / 1024)} KB). ` +
                    `Please crop it tightly around the signature and remove any background before uploading.`
                ));
            }
            resolve(dataUrl);
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
});

/** Every field that can hold a signature or stamp image, across both storage shapes. */
export const SIGNATURE_FIELDS = {
    courseLevel: [
        'approvedByManagerSignatureUrl',
        'approvedDirectorSignatureUrl',
        'approvedProgramStampUrl',
        'approvedThirdPartySignatureUrl',
        'approvedFourthPartySignatureUrl'
    ],
    customLevel: ['thirdPartySignatureUrl', 'fourthPartySignatureUrl']
};

// -----------------------------------------------------------------------------
// CERTIFICATE CUSTOMIZATION DEFAULTS & SHARED RESOLVERS
// -----------------------------------------------------------------------------

export const CERT_DEFAULTS = {
    honorificEn: 'Dr.',
    honorificAr: 'د.',
    directorRoleEn: 'Course Director',
    directorRoleAr: 'مدير الدورة',
    managerRoleEn: 'National Program Manager',
    managerRoleAr: 'مدير البرنامج',
    thirdPartyRoleEn: 'Partner Representative',
    thirdPartyRoleAr: 'ممثل الجهة الشريكة',
    fourthPartyRoleEn: 'Partner Representative',
    fourthPartyRoleAr: 'ممثل الجهة الشريكة',
    placeLabelEn: 'Place : ',
    placeLabelAr: 'المكان : ',
    dateLabelEn: 'Date : ',
    dateLabelAr: 'التاريخ : ',
    signatureTop: 175,
    stampTop: 162,
    stampLeft: 50,
    stampWidth: 40,
    stampOpacity: 0.9,
    // Vertical position (mm from the top of the 210mm page) of every block.
    logoTop: 25,
    headerTop: 14,
    titleTop: 60,
    nameTop: 90,
    completionTop: 108,
    courseTitleTop: 120,
    subCourseTop: 135,
    placeDateTop: 148,
    qrTop: 60,
    // Horizontal centre (% of the 297mm page width) and block width (% of page).
    headerLeft: 50, headerWidth: 100,
    titleLeft: 50, titleWidth: 100,
    nameLeft: 50, nameWidth: 80,
    completionLeft: 50, completionWidth: 66,
    courseTitleLeft: 50, courseTitleWidth: 93,
    subCourseLeft: 50, subCourseWidth: 100,
    placeDateLeft: 50, placeDateWidth: 100,
    qrLeft: 87.4,
    qrSize: 87,
    // Logo group centres (%) and per-image heights (mm). Each of the four logos
    // can also be placed on its own with logo1Top / logo1Left ... logo4Top /
    // logo4Left. When those are blank the logo falls back to the shared logoTop
    // and to its group centre, so templates saved before per-logo positioning
    // keep exactly the layout they had.
    logoGroup1Left: 16, logoGroup2Left: 84,
    logoSpread: 5.5,
    logoHeight1: 30, logoHeight2: 35,
    logoHeight3: 30, logoHeight4: 30,
    // Colours.
    headerColor: '#000000',
    titleColor: '#FF0000',
    nameColor: '#000000',
    completionColor: '#000000',
    courseTitleColor: '#FF0000',
    subCourseColor: '#000000',
    placeDateColor: '#000000',
    placeDateLabelColor: '#FF0000',
    signatureColor: '#000000',
    nameRuleColor: '#000000',
    // Signature IMAGE box inside each block (mm). Shared defaults; each of the
    // four signatures can override any of them.
    signatureImageWidth: 30,
    signatureImageHeight: 20,
    // Distance the image is lifted above the block baseline. 9mm parks the scan
    // right on top of the signatory's name instead of floating above it. Each
    // block can override it with e.g. managerSignatureImageBottom.
    signatureImageBottom: 9,
    signatureImageOffsetX: 0,
    // Optional footer stating the printed page needs the physical seal.
    sealNoticeEn: 'This certificate is not valid without the official seal.',
    sealNoticeAr: 'هذه الشهادة غير صالحة بدون الختم الرسمي.',
    sealNoticeTop: 200,
    sealNoticeLeft: 50,
    sealNoticeWidth: 80,
    sealNoticeFontSize: 12,
    sealNoticeColor: '#555555',
    // Font sizes (px) for the editable titles on the certificate.
    headerFontSizeEn: 24,
    headerFontSizeAr: 22,
    titleFontSize: 60,
    nameFontSize: 35,
    completionFontSize: 22,
    courseTitleFontSize: 28,
    subCourseFontSize: 20,
    placeDateFontSize: 24,
    signatureNameFontSize: 20,
    signatureRoleFontSize: 20,
    // Width (mm) of each signature block. Any single block can override the
    // shared value with managerSignatureWidth / directorSignatureWidth /
    // thirdSignatureWidth / fourthSignatureWidth, its own row height with
    // <block>SignatureTop, and its own text sizes with
    // <block>SignatureNameFontSize / <block>SignatureRoleFontSize.
    signatureWidth: 90,
    thirdSignatureWidth: 80
};

// -----------------------------------------------------------------------------
// LOGO SLOTS
// The certificate carries four logos. Each is positioned independently; a blank
// per-logo value falls back to the group centre it belongs to, which is what
// every previously saved template relies on.
// -----------------------------------------------------------------------------

export const LOGO_SLOTS = [
    { n: 1, imageKey: 'logoTopRight1', label: 'Logo 1', heightKey: 'logoHeight1', groupKey: 'logoGroup1Left', side: -1, defaultName: 'FMOH' },
    { n: 2, imageKey: 'logoTopRight2', label: 'Logo 2', heightKey: 'logoHeight2', groupKey: 'logoGroup1Left', side: 1, defaultName: 'NCHP' },
    { n: 3, imageKey: 'logoTopLeft1', label: 'Logo 3', heightKey: 'logoHeight3', groupKey: 'logoGroup2Left', side: -1, defaultName: 'WHO' },
    { n: 4, imageKey: 'logoTopLeft2', label: 'Logo 4', heightKey: 'logoHeight4', groupKey: 'logoGroup2Left', side: 1, defaultName: 'UNICEF' }
];

// Shared numeric reader: an explicit 0 is honoured, blank/garbage falls back.
const cfgNum = (raw, fallback) => {
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
};

/** Vertical position a logo uses when it has no value of its own. */
export const defaultLogoTop = (cfg = {}) => cfgNum(cfg.logoTop, CERT_DEFAULTS.logoTop);

/** Horizontal centre (% of page width) a logo uses when it has none of its own. */
export const defaultLogoLeft = (cfg = {}, slot, isArabic = false) => {
    const groupFallback = isArabic ? 100 - CERT_DEFAULTS[slot.groupKey] : CERT_DEFAULTS[slot.groupKey];
    const groupLeft = cfgNum(cfg[slot.groupKey], groupFallback);
    const spread = cfgNum(cfg.logoSpread, CERT_DEFAULTS.logoSpread);
    return Math.min(100, Math.max(0, groupLeft + slot.side * spread));
};

// -----------------------------------------------------------------------------
// EXTRA LOGOS
// Any number of additional logos can be added on top of the four built-in
// slots. They are stored as flat keys so the designer's element table can drive
// them exactly like every other element:
//   extraLogoIds: ['k3x9aa', ...]
//   xlogo_<id>_Src / _Top / _Left / _Height / _Label / _Hidden
// A logo with no image yet is a PLACEHOLDER: it shows as a dashed box in the
// designer so it can be positioned first, and prints nothing.
// -----------------------------------------------------------------------------

export const EXTRA_LOGO_DEFAULT_HEIGHT = 25;
export const xlogoKey = (id, prop) => `xlogo_${id}_${prop}`;
const EXTRA_LOGO_SRC_RE = /^xlogo_.+_Src$/;
export const newExtraLogoId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const getExtraLogoIds = (cfg) => (Array.isArray(cfg?.extraLogoIds) ? cfg.extraLogoIds.filter(Boolean) : []);

// -----------------------------------------------------------------------------
// TEMPLATE LAYERS: GENERAL → COURSE TYPE → COURSE
//
// A certificate is built from up to three layers, each overriding the one
// before it field by field:
//   1. the GENERAL template        certificateTemplates/general
//   2. the COURSE-TYPE template    certificateTemplates/type_<courseType>
//   3. the course's own overrides  courses/<id>.customCertificate
// A blank value in a higher layer means "inherit", so a course only has to store
// what is genuinely different about it.
//
// Signature images, dates and place are never stored in a shared template:
// signatures because one scan must not silently print on every course (see the
// signature-handling notes below), dates and place because they belong to a
// single course. The general template also leaves course names alone.
// -----------------------------------------------------------------------------

export const CERT_TEMPLATES_COLLECTION = 'certificateTemplates';
export const GENERAL_TEMPLATE_ID = 'general';
export const courseTypeTemplateId = (courseType) => `type_${encodeURIComponent((courseType || '').trim())}`;

export const TEMPLATE_EXCLUDED_KEYS = [
    'thirdPartySignatureUrl', 'fourthPartySignatureUrl',
    'dateStart', 'dateEnd', 'dateEn', 'dateAr',
    'placeEn', 'placeAr'
];
export const GENERAL_TEMPLATE_EXCLUDED_KEYS = [
    ...TEMPLATE_EXCLUDED_KEYS,
    'courseTitleEn', 'courseTitleAr', 'subCourseEn', 'subCourseAr'
];

const isBlank = (v) => v === '' || v === undefined || v === null;

/**
 * Layers configs left to right. Blank values never override. extraLogoIds is a
 * union, so a course keeps the logos its templates add (it can hide one with
 * xlogo_<id>_Hidden, but not delete it).
 */
export const mergeCertificateConfigs = (...layers) => {
    const out = {};
    const ids = [];
    layers.forEach(layer => {
        if (!layer || typeof layer !== 'object') return;
        Object.entries(layer).forEach(([k, v]) => {
            if (k === 'extraLogoIds') {
                if (Array.isArray(v)) v.forEach(id => { if (id && !ids.includes(id)) ids.push(id); });
                return;
            }
            if (isBlank(v)) return;
            out[k] = v;
        });
    });
    if (ids.length) out.extraLogoIds = ids;
    return out;
};

/** Removes blanks (and, for shared templates, course-only keys) before saving. */
export const cleanCertificateConfig = (cfg = {}, scopeKind = 'course') => {
    const excluded = scopeKind === 'general'
        ? GENERAL_TEMPLATE_EXCLUDED_KEYS
        : scopeKind === 'courseType' ? TEMPLATE_EXCLUDED_KEYS : [];
    const out = {};
    Object.entries(cfg).forEach(([k, v]) => {
        if (excluded.includes(k)) return;
        if (k === 'extraLogoIds') {
            const ids = Array.isArray(v) ? v.filter(Boolean) : [];
            if (ids.length) out.extraLogoIds = ids;
            return;
        }
        if (isBlank(v)) return;
        out[k] = v;
    });
    // In a shared template, drop keys of extra logos that were deleted. A course
    // layer keeps them all, because it may be hiding a logo a template adds.
    if (scopeKind !== 'course') {
        const live = new Set(out.extraLogoIds || []);
        Object.keys(out).forEach(k => {
            const m = k.match(/^xlogo_(.+)_(Src|Top|Left|Height|Label|Hidden)$/);
            if (m && !live.has(m[1])) delete out[k];
        });
    }
    return out;
};

// Short-lived cache so a bulk run of 40 certificates reads each template once.
const TEMPLATE_CACHE_TTL = 60 * 1000;
const templateCache = new Map();
export const invalidateCertificateTemplateCache = () => templateCache.clear();

const readTemplateDoc = async (id) => {
    const hit = templateCache.get(id);
    if (hit && Date.now() - hit.at < TEMPLATE_CACHE_TTL) return hit.data;
    try {
        const snap = await getDoc(doc(db, CERT_TEMPLATES_COLLECTION, id));
        const data = snap.exists() ? snap.data() : null;
        templateCache.set(id, { at: Date.now(), data });
        return data;
    } catch (error) {
        // Offline, or rules deny the read: print from the course alone.
        console.warn(`[Certificate] Could not read template "${id}".`, error);
        return hit ? hit.data : null;
    }
};

/** The config a course inherits before its own overrides (general + its type). */
export const loadInheritedCertificateConfig = async (courseType) => {
    const [general, typed] = await Promise.all([
        readTemplateDoc(GENERAL_TEMPLATE_ID),
        courseType ? readTemplateDoc(courseTypeTemplateId(courseType)) : Promise.resolve(null)
    ]);
    // Cleaned on read as well as on save, so a template edited by hand in the
    // console still can't put a signature or a date on every course.
    return mergeCertificateConfigs(
        cleanCertificateConfig(general?.config || {}, 'general'),
        cleanCertificateConfig(typed?.config || {}, 'courseType')
    );
};

/** Returns the course with customCertificate replaced by the fully layered config. */
export const applyCertificateTemplates = async (course) => {
    if (!course) return course;
    const own = course.__ownCustomCertificate !== undefined ? course.__ownCustomCertificate : (course.customCertificate || {});
    const inherited = await loadInheritedCertificateConfig(course.course_type);
    return {
        ...course,
        __ownCustomCertificate: own,
        customCertificate: mergeCertificateConfigs(inherited, own)
    };
};

/** Same layering, synchronously, from template docs already in memory. */
export const layerCourseWithTemplates = (course, templateDocs = {}) => {
    if (!course) return course;
    return {
        ...course,
        customCertificate: mergeCertificateConfigs(
            cleanCertificateConfig(templateDocs[GENERAL_TEMPLATE_ID]?.config || {}, 'general'),
            course.course_type ? cleanCertificateConfig(templateDocs[courseTypeTemplateId(course.course_type)]?.config || {}, 'courseType') : null,
            course.customCertificate
        )
    };
};

/**
 * A stand-in course for previewing a shared template. Uses the most recent real
 * course of that type for realistic titles, but strips every signature, stamp
 * and override so nothing course-specific leaks into (or can be deleted from)
 * the template designer.
 */
export const buildTemplateSampleCourse = (courseType, allCourses = []) => {
    const candidates = (allCourses || [])
        .filter(c => !c.isDeleted && (!courseType || c.course_type === courseType))
        .sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
    const base = candidates[0] ? { ...candidates[0] } : {};
    [
        ...SIGNATURE_FIELDS.courseLevel,
        'approvedThirdPartyName', 'approvedThirdPartyRole',
        'approvedFourthPartyName', 'approvedFourthPartyRole',
        'customCertificate'
    ].forEach(k => { delete base[k]; });
    return {
        ...base,
        id: base.id || 'template-sample',
        course_type: courseType || base.course_type || 'IMNCI',
        __templateSample: true
    };
};

// Assets stored on the custom template that must be inlined before html2canvas runs.
const CUSTOM_ASSET_KEYS = [
    'logoTopRight1', 'logoTopRight2', 'logoTopLeft1', 'logoTopLeft2',
    'thirdPartySignatureUrl', 'fourthPartySignatureUrl'
];

// Strips an existing honorific only when it is unambiguous ("Dr." / "Dr " / "د.").
const stripHonorific = (name) => (name || '').trim().replace(/^(dr\.\s*|dr\s+|د\.\s*)/i, '').trim();

const applyHonorific = (name, honorific) => {
    const clean = stripHonorific(name);
    if (!clean) return '';
    if (!honorific) return clean;
    return `${honorific} ${clean}`;
};

const firstFilled = (...values) => {
    for (const v of values) {
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
};

/**
 * Single source of truth for who signs a certificate. Used by the template,
 * by the approval confirmation dialog, and when writing approval data to Firestore,
 * so all three always agree.
 */
export const resolveCertificateSignatories = (course = {}, fallbackManagerName = '', extra = {}) => {
    const cfg = course.customCertificate || {};
    const { directorNameAr = null, programManagerNameAr = null } = extra;

    const courseDirector = firstFilled(course.approvedDirectorName, course.director);
    const courseManager = firstFilled(course.approvedByManagerName, fallbackManagerName);

    const honorificEn = cfg.hideHonorific ? '' : firstFilled(cfg.honorificEn, CERT_DEFAULTS.honorificEn);
    const honorificAr = cfg.hideHonorific ? '' : firstFilled(cfg.honorificAr, CERT_DEFAULTS.honorificAr);

    const directorEn = firstFilled(cfg.directorTitleEn, courseDirector);
    const directorAr = firstFilled(cfg.directorTitleAr, directorNameAr, courseDirector);
    const managerEn = firstFilled(cfg.managerTitleEn, courseManager);
    const managerAr = firstFilled(cfg.managerTitleAr, programManagerNameAr, courseManager);

    // --- THIRD SIGNATORY VISIBILITY ---
    // Content-driven, NOT flag-driven. Previously this required cfg.thirdPartyEnabled
    // to be truthy, so if that single boolean was ever lost (dropped on save, absent on
    // an older course document, or written before the toggle existed) the whole block
    // vanished even though the name/role/signature were all sitting right there in the
    // document. Now: if there is a name or a signature image, it prints. The toggle is
    // honoured only as an explicit "off", so unchecking it still removes the block.
    const thirdPartyHasContent = !!firstFilled(
        cfg.thirdPartyNameEn, cfg.thirdPartyNameAr, cfg.thirdPartySignatureUrl,
        course.approvedThirdPartyName, course.approvedThirdPartySignatureUrl
    );
    const thirdPartyExplicitlyOff = cfg.thirdPartyEnabled === false || !!cfg.hideThirdParty;
    const thirdPartyEnabled = thirdPartyHasContent && !thirdPartyExplicitlyOff;

    // Fourth signatory — same content-driven rule as the third.
    const fourthPartyHasContent = !!firstFilled(
        cfg.fourthPartyNameEn, cfg.fourthPartyNameAr, cfg.fourthPartySignatureUrl,
        course.approvedFourthPartyName, course.approvedFourthPartySignatureUrl
    );
    const fourthPartyExplicitlyOff = cfg.fourthPartyEnabled === false || !!cfg.hideFourthParty;
    const fourthPartyEnabled = fourthPartyHasContent && !fourthPartyExplicitlyOff;

    return {
        // Raw names (no honorific) — safe to store in Firestore.
        directorEn,
        directorAr,
        managerEn,
        managerAr,
        // Display names (honorific applied, never duplicated).
        directorDisplayEn: applyHonorific(directorEn, honorificEn),
        directorDisplayAr: applyHonorific(directorAr, honorificAr),
        managerDisplayEn: applyHonorific(managerEn, honorificEn),
        managerDisplayAr: applyHonorific(managerAr, honorificAr),
        // Role captions.
        directorRoleEn: firstFilled(cfg.directorRoleEn, CERT_DEFAULTS.directorRoleEn),
        directorRoleAr: firstFilled(cfg.directorRoleAr, CERT_DEFAULTS.directorRoleAr),
        managerRoleEn: firstFilled(cfg.managerRoleEn, CERT_DEFAULTS.managerRoleEn),
        managerRoleAr: firstFilled(cfg.managerRoleAr, CERT_DEFAULTS.managerRoleAr),
        // Third signatory (centre bottom).
        thirdPartyEnabled,
        thirdPartyEn: firstFilled(cfg.thirdPartyNameEn, cfg.thirdPartyNameAr, course.approvedThirdPartyName),
        thirdPartyAr: firstFilled(cfg.thirdPartyNameAr, cfg.thirdPartyNameEn, course.approvedThirdPartyName),
        thirdPartyRoleEn: firstFilled(cfg.thirdPartyRoleEn, course.approvedThirdPartyRole, CERT_DEFAULTS.thirdPartyRoleEn),
        thirdPartyRoleAr: firstFilled(cfg.thirdPartyRoleAr, course.approvedThirdPartyRole, CERT_DEFAULTS.thirdPartyRoleAr),
        thirdPartySignatureUrl: cfg.thirdPartySignatureUrl || course.approvedThirdPartySignatureUrl || '',

        // Fourth signatory.
        fourthPartyEnabled,
        fourthPartyEn: firstFilled(cfg.fourthPartyNameEn, cfg.fourthPartyNameAr, course.approvedFourthPartyName),
        fourthPartyAr: firstFilled(cfg.fourthPartyNameAr, cfg.fourthPartyNameEn, course.approvedFourthPartyName),
        fourthPartyRoleEn: firstFilled(cfg.fourthPartyRoleEn, course.approvedFourthPartyRole, CERT_DEFAULTS.fourthPartyRoleEn),
        fourthPartyRoleAr: firstFilled(cfg.fourthPartyRoleAr, course.approvedFourthPartyRole, CERT_DEFAULTS.fourthPartyRoleAr),
        fourthPartySignatureUrl: cfg.fourthPartySignatureUrl || course.approvedFourthPartySignatureUrl || '',
        // Visibility flags.
        hideDirector: !!cfg.hideDirector,
        hideManager: !!cfg.hideManager,
        hideThirdParty: thirdPartyExplicitlyOff,
        thirdPartyHasContent,
        hideFourthParty: fourthPartyExplicitlyOff,
        fourthPartyHasContent,
        // Which fields came from the custom template (used to badge the approval dialog).
        overrides: {
            directorEn: !!firstFilled(cfg.directorTitleEn),
            directorAr: !!firstFilled(cfg.directorTitleAr),
            managerEn: !!firstFilled(cfg.managerTitleEn),
            managerAr: !!firstFilled(cfg.managerTitleAr),
            directorRoleEn: !!firstFilled(cfg.directorRoleEn),
            directorRoleAr: !!firstFilled(cfg.directorRoleAr),
            managerRoleEn: !!firstFilled(cfg.managerRoleEn),
            managerRoleAr: !!firstFilled(cfg.managerRoleAr)
        }
    };
};

/**
 * The course object handed to the generators comes from the app's in-memory /
 * offline course cache (DataContext), which is populated by delta sync. If that
 * cached copy is stale or was written before a field existed, customCertificate
 * (and with it the third signature) silently goes missing at render time even
 * though the document in Firestore is correct.
 *
 * So: always re-read the course document before drawing, and let the server copy
 * win. Falls back to the passed-in object when offline or on any error.
 */
const loadAuthoritativeCourse = async (course) => {
    if (!course || course.__certCourseResolved) return course;
    let base = course;
    if (course.id) {
        try {
            const fresh = await getCourseById(course.id, navigator.onLine ? 'default' : 'cache');
            // A fresh read carries the course's OWN overrides, so any previously
            // layered copy is discarded and the templates are applied again.
            if (fresh) base = { ...course, ...fresh, __ownCustomCertificate: undefined };
        } catch (error) {
            console.warn('[Certificate] Could not re-read course from Firestore; using the cached copy.', error);
        }
    }
    // General template → course-type template → this course.
    const layered = await applyCertificateTemplates(base);
    return { ...layered, __certCourseResolved: true };
};

/** Prints exactly what the third signature resolved to, so a blank one is diagnosable. */
const logThirdPartyDiagnostics = (course) => {
    const cfg = course?.customCertificate || {};
    const sig = resolveCertificateSignatories(course || {});
    console.info('[Certificate] third signature →', {
        customCertificatePresent: !!course?.customCertificate,
        thirdPartyEnabledFlag: cfg.thirdPartyEnabled,
        nameEn: cfg.thirdPartyNameEn || '(empty)',
        nameAr: cfg.thirdPartyNameAr || '(empty)',
        signatureImage: cfg.thirdPartySignatureUrl ? 'yes' : 'no',
        approvedFallbackName: course?.approvedThirdPartyName || '(none)',
        WILL_PRINT: sig.thirdPartyEnabled
    });
    if (!sig.thirdPartyEnabled) {
        console.warn('[Certificate] The third signature will NOT print. If you entered a name in the customizer, the course document does not contain it — check courses/' + (course?.id || '?') + ' → customCertificate in Firestore.');
    }
};

/** Inlines every remote custom asset as base64 so html2canvas can rasterise it. */
const resolveCustomAssets = async (course) => {
    const cfg = course?.customCertificate;
    if (!cfg) return course;

    const resolved = { ...cfg };
    const keys = [...CUSTOM_ASSET_KEYS, ...Object.keys(cfg).filter(k => EXTRA_LOGO_SRC_RE.test(k))];
    await Promise.all(keys.map(async (key) => {
        const value = cfg[key];
        if (value && /^https?:\/\//i.test(value)) {
            const base64 = await imageUrlToBase64(value);
            if (base64) resolved[key] = base64;
        }
    }));

    return { ...course, customCertificate: resolved };
};

// -----------------------------------------------------------------------------
// COMPONENT: SignatureBlock (shared by all three signatories)
// -----------------------------------------------------------------------------

const SignatureBlock = ({ signatureUrl, name, role, positionStyle, nameFontSize = 20, roleFontSize = 20, nameColor = '#000000', roleColor = null, imgWidth = 30, imgHeight = 20, imgBottom = 12, imgOffsetX = 0 }) => (
    <div style={{ position: 'absolute', textAlign: 'center', fontWeight: 'bold', zIndex: 2, ...positionStyle }}>
        <div style={{ position: 'relative' }}>
            {signatureUrl && (
                <img
                    src={signatureUrl}
                    alt="Signature"
                    crossOrigin="anonymous"
                    style={{
                        display: 'block', margin: '0 auto', position: 'absolute', zIndex: 1,
                        maxWidth: `${imgWidth}mm`,
                        maxHeight: `${imgHeight}mm`,
                        bottom: `${imgBottom}mm`,
                        left: '50%',
                        transform: `translateX(calc(-50% + ${imgOffsetX}mm))`
                    }}
                />
            )}
            <div style={{ marginBottom: '1mm', position: 'relative', zIndex: 2, fontSize: `${nameFontSize}px`, lineHeight: 1.25, color: nameColor }}>{name}</div>
            <div style={{ fontSize: `${roleFontSize}px`, lineHeight: 1.25, color: roleColor || nameColor }}>{role}</div>
        </div>
    </div>
);

// -----------------------------------------------------------------------------
// COMPONENT: CertificateTemplate (FULLY CUSTOMIZABLE)
// -----------------------------------------------------------------------------

const CertificateTemplate = React.memo(function CertificateTemplate({ 
    course, participant, federalProgramManagerName, participantSubCourse, language = 'en',
    directorNameAr, programManagerNameAr, programManagerSignatureUrl, directorName, directorSignatureUrl,  
    programStampUrl, thirdPartySignatureUrl: approvedThirdPartySignature = null,
    fourthPartySignatureUrl: approvedFourthPartySignature = null, isTemplate = false,
    showPlaceholders = false
}) {
    const isArabic = language === 'ar';
    const courseType = course.course_type ? course.course_type.trim() : '';
    
    // --- CUSTOMIZATION CONFIG ---
    const customConfig = course.customCertificate || {};
    
    // Fallbacks to default logos if none provided in custom config
    const logoTopRight1 = customConfig.logoTopRight1 || "/certificate/fmoh-logo.jpg";
    const logoTopRight2 = customConfig.logoTopRight2 || "/certificate/ch-logo.png";
    const logoTopLeft1 = customConfig.logoTopLeft1 || "/certificate/who-logo.png";
    const logoTopLeft2 = customConfig.logoTopLeft2 || "/certificate/unicef-logo.png";

    // Text overrides
    const headerAr = customConfig.headerAr || "جمهورية السودان\nوزارة الصحة الاتحادية\nالإدارة العامة للرعاية الصحية الاساسية\nإدارة صحة الأم والطفل\nالبرنامج القومي لصحة الطفل";
    const headerEn = customConfig.headerEn || "Republic of Sudan\nFederal Ministry of Health\nDirectorate General of PHC\nMaternal and Child Health Directorate\nNational Child Health Program";
    const titleCert = isArabic ? (customConfig.titleAr || 'شهادة') : (customConfig.titleEn || 'CERTIFICATE');
    const completionText = isArabic ? (customConfig.completionTextAr || 'أكمل/ت بنجاح الدورة التدريبية على : ') : (customConfig.completionTextEn || 'Has successfully completed:');

    // Course Titles
    let baseCourseTitle = getCertificateCourseTitle(courseType, language, participantSubCourse);
    if (isArabic && customConfig.courseTitleAr) baseCourseTitle = customConfig.courseTitleAr;
    if (!isArabic && customConfig.courseTitleEn) baseCourseTitle = customConfig.courseTitleEn;
    
    let displaySubCourse = participantSubCourse;
    if (participantSubCourse) {
        const isRefreshment = participantSubCourse.toLowerCase().includes('refreshment');
        const normalizedSub = participantSubCourse.trim().toLowerCase();

        if (isArabic) {
            if (customConfig.subCourseAr) displaySubCourse = customConfig.subCourseAr;
            else if (courseType === 'ICCM') displaySubCourse = "تدريب العامل الصحي المجتمعي";
            else if (courseType === 'IMNCI') displaySubCourse = isRefreshment ? "ورشة تنشيطية" : "المعالجة القياسية للاطفال اقل من 5 سنوات";
            else if (courseType === 'Small & Sick Newborn') displaySubCourse = getSmallAndSickSubCourseArabic(participantSubCourse);
            else if (courseType === 'Program Management') {
                if (participantSubCourse.includes('IMNCI implementation operational Guide')) displaySubCourse = "دورة تدريب المدريبين على الدليل التشغيلي لتطبيق العلاج المتكامل في مؤسسات الرعاية الصحية الأساسية";
                else if (participantSubCourse.includes('planning, Monitoring and evaluation')) displaySubCourse = "التخطيط والمتابعة والتقييم";
            }
            else if (courseType === 'Comprehensive Package For Community Midwives') displaySubCourse = "الرعاية الضرورية للاطفال حديثي الولادة + مساعدة الأطفال حديثي الولادة على التنفس";
            else if (courseType === 'EmONC') {
                if (normalizedSub === 'eenc orientation') displaySubCourse = "ورشة تنويرية";
                else if (normalizedSub === 'eenc mentorship') displaySubCourse = "ورشة ارشاد سريري";
                else if (normalizedSub === 'eenc tot') displaySubCourse = "ورشة تدريب مدربين";
            }
        } else {
            if (customConfig.subCourseEn) displaySubCourse = customConfig.subCourseEn;
            else if (courseType === 'IMNCI' && isRefreshment) displaySubCourse = "IMNCI refreshment course";
        }
    } else {
        // No sub-course on the participant record. A line typed in the customizer
        // still prints, and falls back to the other language so one entry is
        // enough when the wording is the same in both.
        displaySubCourse = isArabic
            ? (customConfig.subCourseAr || customConfig.subCourseEn || '')
            : (customConfig.subCourseEn || customConfig.subCourseAr || '');
    }

    // Sub-course line mode:
    //   'auto'       participant's sub-course, or the typed text if any (default,
    //                keeps every existing certificate unchanged)
    //   'customOnly' only the text typed in the designer; the participant's
    //                sub-course is ignored
    //   'hide'       never printed
    const subCourseMode = customConfig.subCourseMode || 'auto';
    if (subCourseMode === 'hide') {
        displaySubCourse = '';
    } else if (subCourseMode === 'customOnly') {
        displaySubCourse = isArabic
            ? (customConfig.subCourseAr || customConfig.subCourseEn || '')
            : (customConfig.subCourseEn || customConfig.subCourseAr || '');
    }

    let stateDisplay = course.state || '';
    if (isArabic) {
        if (course.states && Array.isArray(course.states)) stateDisplay = course.states.map(s => STATE_LOCALITIES[s] ? STATE_LOCALITIES[s].ar : s).join('، ');
        else if (STATE_LOCALITIES[course.state]) stateDisplay = STATE_LOCALITIES[course.state].ar;
    } else {
        if (course.states && Array.isArray(course.states)) stateDisplay = course.states.join(', ');
    }

    const hallDisplay = (!isArabic && course.hall_english) ? course.hall_english : (course.hall || '');
    const computedLocation = hallDisplay ? `${stateDisplay} - ${hallDisplay}` : stateDisplay;

    // --- PLACE (custom overridable) ---
    const placeOverride = isArabic ? customConfig.placeAr : customConfig.placeEn;
    const displayPlace = (placeOverride && placeOverride.trim()) ? placeOverride.trim() : computedLocation;
    const placeLabel = isArabic
        ? (customConfig.placeLabelAr || CERT_DEFAULTS.placeLabelAr)
        : (customConfig.placeLabelEn || CERT_DEFAULTS.placeLabelEn);
    const showPlace = !customConfig.hidePlace && !!displayPlace;

    // --- DATE (custom overridable) ---
    let courseDate = '';
    let courseDuration = course.course_duration;
    
    if (courseType === 'IMNCI' && participantSubCourse) {
        const subTypeLower = participantSubCourse.toLowerCase();
        if (subTypeLower.includes('standard')) courseDuration = 7;
        else if (subTypeLower.includes('refreshment')) courseDuration = 3;
        else courseDuration = 4;
    }
    
    if (courseDuration && course.start_date) {
        const [startYear, startMonth, startDay] = course.start_date.split('-').map(Number);
        const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
        const endDateObj = new Date(startDateObj);
        endDateObj.setUTCDate(startDateObj.getUTCDate() + (courseDuration - 1));
        
        const startDayOfMonth = startDateObj.getUTCDate();
        const startMonthIndex = startDateObj.getUTCMonth();
        const startYearNum = startDateObj.getUTCFullYear();
        const endDayOfMonth = endDateObj.getUTCDate();
        const endMonthIndex = endDateObj.getUTCMonth();
        const endYearNum = endDateObj.getUTCFullYear();

        if (isArabic) {
            const startMonthName = getArabicMonthName(startMonthIndex);
            const endMonthName = getArabicMonthName(endMonthIndex);
            if (startMonthIndex === endMonthIndex) courseDate = `${startDayOfMonth} - ${endDayOfMonth} ${startMonthName} ${startYearNum}`;
            else courseDate = `${startDayOfMonth} ${startMonthName} - ${endDayOfMonth} ${endMonthName} ${endYearNum}`;
        } else {
            const startMonthName = getEnglishMonthName(startMonthIndex);
            const endMonthName = getEnglishMonthName(endMonthIndex);
            const startDayHtml = getDayWithSuffix(startDayOfMonth);
            const endDayHtml = getDayWithSuffix(endDayOfMonth);
            if (startMonthIndex === endMonthIndex) courseDate = `${startDayHtml} - ${endDayHtml} ${startMonthName} ${startYearNum}`;
            else courseDate = `${startDayHtml} ${startMonthName} - ${endDayHtml} ${endMonthName} ${endYearNum}`;
        }
    } else {
        courseDate = course.start_date ? course.start_date.split('-').reverse().join('/') : 'N/A';
    }

    // Precedence: calendar range → free-text override → auto-computed course date.
    // The calendar range and the computed date both carry HTML (ordinal <sup>),
    // whereas a typed override is shown verbatim.
    const rangeDate = formatCertificateDateRange(customConfig.dateStart, customConfig.dateEnd, isArabic);
    const textDateOverride = isArabic ? customConfig.dateAr : customConfig.dateEn;
    const hasTextDateOverride = !!(textDateOverride && textDateOverride.trim());

    let displayDate, dateIsHtml;
    if (rangeDate) {
        displayDate = rangeDate;
        dateIsHtml = true;
    } else if (hasTextDateOverride) {
        displayDate = textDateOverride.trim();
        dateIsHtml = false;
    } else {
        displayDate = courseDate;
        dateIsHtml = true;
    }

    const dateLabel = isArabic
        ? (customConfig.dateLabelAr || CERT_DEFAULTS.dateLabelAr)
        : (customConfig.dateLabelEn || CERT_DEFAULTS.dateLabelEn);
    const showDate = !customConfig.hideDate && !!displayDate;

    const verificationUrl = isTemplate ? '' : `${window.location.origin}/verify/certificate/${participant?.id}`;

    const containerStyle = { width: '297mm', height: '210mm', boxSizing: 'border-box', fontFamily: isArabic ? 'Arial, sans-serif' : 'Times New Roman, serif', color: 'black', backgroundColor: 'white', position: 'relative', direction: isArabic ? 'rtl' : 'ltr' };
    const qrContainerStyle = { position: 'absolute', top: '60mm', width: '45mm', height: 'auto', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', left: isArabic ? '15mm' : 'auto', right: isArabic ? 'auto' : '15mm' };
    const finalDirectorName = directorName || course.director;

    // --- SIGNATORIES (director / manager / optional third party) ---
    const signatories = resolveCertificateSignatories(
        { ...course, approvedDirectorName: finalDirectorName, approvedByManagerName: federalProgramManagerName },
        federalProgramManagerName,
        { directorNameAr, programManagerNameAr }
    );

    const directorDisplayName = (isArabic ? signatories.directorDisplayAr : signatories.directorDisplayEn) || (isArabic ? 'د. ...' : 'Dr. ...');
    const directorRole = isArabic ? signatories.directorRoleAr : signatories.directorRoleEn;
    const managerDisplayName = (isArabic ? signatories.managerDisplayAr : signatories.managerDisplayEn) || (isArabic ? 'د. ...' : 'Federal Program Manager');
    const managerRole = isArabic ? signatories.managerRoleAr : signatories.managerRoleEn;

    const thirdPartyName = isArabic ? signatories.thirdPartyAr : signatories.thirdPartyEn;
    const thirdPartyRole = isArabic ? signatories.thirdPartyRoleAr : signatories.thirdPartyRoleEn;
    const thirdPartySignature = customConfig.thirdPartySignatureUrl || approvedThirdPartySignature || '';
    const showThirdParty = signatories.thirdPartyEnabled;

    // Printed name. Normalised by default; `rawParticipantName` opts out for the
    // occasional record whose capitalisation is deliberate.
    const participantDisplayName = customConfig.rawParticipantName
        ? (participant?.name || '')
        : normalizeParticipantName(participant?.name);

    const fourthPartyName = isArabic ? signatories.fourthPartyAr : signatories.fourthPartyEn;
    const fourthPartyRole = isArabic ? signatories.fourthPartyRoleAr : signatories.fourthPartyRoleEn;
    const fourthPartySignature = customConfig.fourthPartySignatureUrl || approvedFourthPartySignature || '';
    const showFourthParty = signatories.fourthPartyEnabled;

    // --- LAYOUT (numbers are mm, all overridable) ---
    const signatureTop = Number(customConfig.signatureTop) || CERT_DEFAULTS.signatureTop;
    const stampTop = Number(customConfig.stampTop) || (showThirdParty ? 168 : CERT_DEFAULTS.stampTop);
    const stampLeft = customConfig.stampLeft === undefined || customConfig.stampLeft === '' ? CERT_DEFAULTS.stampLeft : Number(customConfig.stampLeft);
    const stampWidth = Number(customConfig.stampWidth) || (showThirdParty ? 32 : CERT_DEFAULTS.stampWidth);
    const stampOpacity = customConfig.stampOpacity === undefined || customConfig.stampOpacity === '' ? (showThirdParty ? 0.55 : CERT_DEFAULTS.stampOpacity) : Number(customConfig.stampOpacity);

    // --- FONT SIZES (px, all overridable) ---
    const headerFontSize = Number(customConfig.headerFontSize) || (isArabic ? CERT_DEFAULTS.headerFontSizeAr : CERT_DEFAULTS.headerFontSizeEn);
    const titleFontSize = Number(customConfig.titleFontSize) || CERT_DEFAULTS.titleFontSize;
    const nameFontSize = Number(customConfig.nameFontSize) || CERT_DEFAULTS.nameFontSize;
    const completionFontSize = Number(customConfig.completionFontSize) || CERT_DEFAULTS.completionFontSize;
    const courseTitleFontSize = Number(customConfig.courseTitleFontSize) || CERT_DEFAULTS.courseTitleFontSize;
    const subCourseFontSize = Number(customConfig.subCourseFontSize) || CERT_DEFAULTS.subCourseFontSize;
    const placeDateFontSize = Number(customConfig.placeDateFontSize) || CERT_DEFAULTS.placeDateFontSize;
    const signatureNameFontSize = Number(customConfig.signatureNameFontSize) || CERT_DEFAULTS.signatureNameFontSize;
    const signatureRoleFontSize = Number(customConfig.signatureRoleFontSize) || CERT_DEFAULTS.signatureRoleFontSize;

    // --- VERTICAL POSITIONS (mm from the top of the 210mm page, all overridable) ---
    // numOr (not `Number(x) || default`) so that an explicit 0 is honoured.
    const numOr = (raw, fallback) => {
        if (raw === undefined || raw === null || raw === '') return fallback;
        const n = Number(raw);
        return Number.isFinite(n) ? n : fallback;
    };
    const logoTop = numOr(customConfig.logoTop, CERT_DEFAULTS.logoTop);
    const headerTop = numOr(customConfig.headerTop, CERT_DEFAULTS.headerTop);
    const titleTop = numOr(customConfig.titleTop, CERT_DEFAULTS.titleTop);
    const nameTop = numOr(customConfig.nameTop, CERT_DEFAULTS.nameTop);
    const completionTop = numOr(customConfig.completionTop, CERT_DEFAULTS.completionTop);
    const courseTitleTop = numOr(customConfig.courseTitleTop, CERT_DEFAULTS.courseTitleTop);
    const subCourseTop = numOr(customConfig.subCourseTop, CERT_DEFAULTS.subCourseTop);
    const placeDateTop = numOr(customConfig.placeDateTop, CERT_DEFAULTS.placeDateTop);
    const qrTop = numOr(customConfig.qrTop, CERT_DEFAULTS.qrTop);

    // --- HORIZONTAL CENTRES / WIDTHS (% of page width) ---
    const headerLeft = numOr(customConfig.headerLeft, CERT_DEFAULTS.headerLeft);
    const headerWidth = numOr(customConfig.headerWidth, CERT_DEFAULTS.headerWidth);
    const titleLeft = numOr(customConfig.titleLeft, CERT_DEFAULTS.titleLeft);
    const titleWidth = numOr(customConfig.titleWidth, CERT_DEFAULTS.titleWidth);
    const nameLeft = numOr(customConfig.nameLeft, CERT_DEFAULTS.nameLeft);
    const nameWidth = numOr(customConfig.nameWidth, CERT_DEFAULTS.nameWidth);
    const completionLeft = numOr(customConfig.completionLeft, CERT_DEFAULTS.completionLeft);
    const completionWidth = numOr(customConfig.completionWidth, CERT_DEFAULTS.completionWidth);
    const courseTitleLeft = numOr(customConfig.courseTitleLeft, CERT_DEFAULTS.courseTitleLeft);
    const courseTitleWidth = numOr(customConfig.courseTitleWidth, CERT_DEFAULTS.courseTitleWidth);
    const subCourseLeft = numOr(customConfig.subCourseLeft, CERT_DEFAULTS.subCourseLeft);
    const subCourseWidth = numOr(customConfig.subCourseWidth, CERT_DEFAULTS.subCourseWidth);
    const placeDateLeft = numOr(customConfig.placeDateLeft, CERT_DEFAULTS.placeDateLeft);
    const placeDateWidth = numOr(customConfig.placeDateWidth, CERT_DEFAULTS.placeDateWidth);
    const qrLeft = numOr(customConfig.qrLeft, isArabic ? 100 - CERT_DEFAULTS.qrLeft : CERT_DEFAULTS.qrLeft);
    const qrSize = numOr(customConfig.qrSize, CERT_DEFAULTS.qrSize);

    // Optional "seal required" footer. Off unless explicitly enabled, so existing
    // certificates are unchanged.
    const showSealNotice = !!customConfig.showSealNotice;
    const sealNoticeText = isArabic
        ? (customConfig.sealNoticeAr || CERT_DEFAULTS.sealNoticeAr)
        : (customConfig.sealNoticeEn || CERT_DEFAULTS.sealNoticeEn);
    const sealNoticeTop = numOr(customConfig.sealNoticeTop, CERT_DEFAULTS.sealNoticeTop);
    const sealNoticeLeft = numOr(customConfig.sealNoticeLeft, CERT_DEFAULTS.sealNoticeLeft);
    const sealNoticeWidth = numOr(customConfig.sealNoticeWidth, CERT_DEFAULTS.sealNoticeWidth);
    const sealNoticeFontSize = numOr(customConfig.sealNoticeFontSize, CERT_DEFAULTS.sealNoticeFontSize);

    // --- LOGOS ---
    // Every logo carries its own top, left and height. Blank values fall back to
    // the shared logo row and to the logo's group centre, so an old template is
    // rendered exactly as before until one of the logos is actually moved.
    const logoSources = {
        logoTopRight1, logoTopRight2, logoTopLeft1, logoTopLeft2
    };
    const logoBoxes = LOGO_SLOTS
        .filter(slot => !customConfig[`hideLogo${slot.n}`])
        .map(slot => ({
            slot,
            src: logoSources[slot.imageKey],
            top: numOr(customConfig[`logo${slot.n}Top`], logoTop),
            left: numOr(customConfig[`logo${slot.n}Left`], defaultLogoLeft(customConfig, slot, isArabic)),
            height: numOr(customConfig[slot.heightKey], CERT_DEFAULTS[slot.heightKey])
        }));

    // Extra logos. One without an image is a placeholder: drawn only in the
    // designer, never in a generated PDF.
    const extraLogoBoxes = getExtraLogoIds(customConfig)
        .filter(id => !customConfig[xlogoKey(id, 'Hidden')])
        .map((id, i) => ({
            id,
            src: customConfig[xlogoKey(id, 'Src')] || '',
            label: customConfig[xlogoKey(id, 'Label')] || `Logo ${LOGO_SLOTS.length + i + 1}`,
            top: numOr(customConfig[xlogoKey(id, 'Top')], logoTop),
            left: numOr(customConfig[xlogoKey(id, 'Left')], 50),
            height: numOr(customConfig[xlogoKey(id, 'Height')], EXTRA_LOGO_DEFAULT_HEIGHT)
        }));

    // --- COLOURS ---
    const col = (key) => customConfig[key] || CERT_DEFAULTS[key];
    const headerColor = col('headerColor');
    const titleColor = col('titleColor');
    const nameColor = col('nameColor');
    const nameRuleColor = col('nameRuleColor');
    const completionColor = col('completionColor');
    const courseTitleColor = col('courseTitleColor');
    const subCourseColor = col('subCourseColor');
    const placeDateColor = col('placeDateColor');
    const placeDateLabelColor = col('placeDateLabelColor');
    const signatureColor = col('signatureColor');

    // Per-signature colour, in order of specificity:
    //   this block's own colour → the shared signature colour → black.
    // Titles fall back to their own block's name colour, so setting one colour
    // still recolours the whole block.
    const sigNameColor = (block) => customConfig[`${block}SignatureColor`] || signatureColor;
    const sigRoleColor = (block) => customConfig[`${block}SignatureRoleColor`] || customConfig.signatureRoleColor || sigNameColor(block);

    // Signature IMAGE geometry: this block's own value → the shared value → the
    // built-in default. Lets one signature be scanned larger than the rest
    // without forcing every block to match.
    const sigImg = (block, prop) => numOr(
        customConfig[`${block}SignatureImage${prop}`],
        numOr(customConfig[`signatureImage${prop}`], CERT_DEFAULTS[`signatureImage${prop}`])
    );
    const sigImgProps = (block) => ({
        imgWidth: sigImg(block, 'Width'),
        imgHeight: sigImg(block, 'Height'),
        imgBottom: sigImg(block, 'Bottom'),
        imgOffsetX: sigImg(block, 'OffsetX')
    });

    // Each signature block can sit at its own height and print at its own text
    // size. Blank falls back to the shared row value, so a template that never
    // touches these is laid out exactly as before.
    const sigTopOf = (block) => numOr(customConfig[`${block}SignatureTop`], signatureTop);
    const sigNameFsOf = (block) => numOr(customConfig[`${block}SignatureNameFontSize`], signatureNameFontSize);
    const sigRoleFsOf = (block) => numOr(customConfig[`${block}SignatureRoleFontSize`], signatureRoleFontSize);

    // Centre-anchored positioning: an element sits at `left`% of the page and is
    // pulled back by half its own width, so changing `left` slides it sideways
    // without disturbing its internal centring.
    const centred = (leftPct, widthPct) => ({
        position: 'absolute',
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        transform: 'translateX(-50%)',
        textAlign: 'center'
    });

    // Signature blocks have to share one 297mm row, so both the block width and
    // the spacing depend on how many are actually printing. All still overridable.
    const signatureCount = 2 + (showThirdParty ? 1 : 0) + (showFourthParty ? 1 : 0);
    const defaultSideWidth = signatureCount >= 4 ? 65 : signatureCount === 3 ? 80 : CERT_DEFAULTS.signatureWidth;
    const sideSignatureWidth = Number(customConfig.signatureWidth) || defaultSideWidth;
    const thirdSignatureWidth = Number(customConfig.thirdSignatureWidth) || defaultSideWidth;

    // Centres as a % of page width. The outermost blocks keep the original 5mm
    // edge margin; any middle blocks are spaced evenly between them.
    const sideCentrePct = ((5 + sideSignatureWidth / 2) / 297) * 100;
    const span = 100 - 2 * sideCentrePct;
    const slot = (i) => sideCentrePct + (span * i) / (signatureCount - 1);

    // Per-block width. `thirdSignatureWidth` is the long-standing key and keeps
    // working, because for block 'third' the generated name is the same key.
    const sigWidthOf = (block) => numOr(
        customConfig[`${block}SignatureWidth`],
        (block === 'third' || block === 'fourth') ? thirdSignatureWidth : sideSignatureWidth
    );

    const sigLeftLeft = numOr(customConfig.sigLeftLeft, slot(0));
    const sigRightLeft = numOr(customConfig.sigRightLeft, slot(signatureCount - 1));
    const sigThirdLeft = numOr(customConfig.sigThirdLeft, signatureCount >= 3 ? slot(1) : 50);
    const sigFourthLeft = numOr(customConfig.sigFourthLeft, signatureCount >= 4 ? slot(2) : 50);

    // In RTL the manager sits on the right, the director on the left (unchanged behaviour).
    const rightSignatory = isArabic
        ? { url: programManagerSignatureUrl, name: managerDisplayName, role: managerRole, hidden: signatories.hideManager, block: 'manager' }
        : { url: directorSignatureUrl, name: directorDisplayName, role: directorRole, hidden: signatories.hideDirector, block: 'director' };

    const leftSignatory = isArabic
        ? { url: directorSignatureUrl, name: directorDisplayName, role: directorRole, hidden: signatories.hideDirector, block: 'director' }
        : { url: programManagerSignatureUrl, name: managerDisplayName, role: managerRole, hidden: signatories.hideManager, block: 'manager' };

    return (
        <div id="certificate-template" style={containerStyle}>
            <img src="/certificate/border.jpg" alt="Certificate Border" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />
            
            {logoBoxes.map(({ slot, src, top, left, height }) => src ? (
                <img
                    key={slot.imageKey}
                    src={src}
                    crossOrigin="anonymous"
                    alt={slot.label}
                    style={{
                        position: 'absolute',
                        top: `${top}mm`,
                        left: `${left}%`,
                        transform: 'translateX(-50%)',
                        zIndex: 1,
                        height: `${height}mm`,
                        width: 'auto'
                    }}
                />
            ) : null)}

            {extraLogoBoxes.map(({ id, src, label, top, left, height }) => src ? (
                <img
                    key={`xlogo-${id}`}
                    src={src}
                    crossOrigin="anonymous"
                    alt={label}
                    style={{ position: 'absolute', top: `${top}mm`, left: `${left}%`, transform: 'translateX(-50%)', zIndex: 1, height: `${height}mm`, width: 'auto' }}
                />
            ) : showPlaceholders ? (
                <div
                    key={`xlogo-${id}`}
                    style={{
                        position: 'absolute', top: `${top}mm`, left: `${left}%`, transform: 'translateX(-50%)', zIndex: 1,
                        height: `${height}mm`, width: `${height}mm`, boxSizing: 'border-box',
                        border: '2px dashed #94a3b8', borderRadius: '2mm', background: 'rgba(241,245,249,0.85)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                        fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#64748b', padding: '1mm', lineHeight: 1.2
                    }}
                >
                    {label}<br />(logo)
                </div>
            ) : null)}

            <div style={{ ...centred(headerLeft, headerWidth), top: `${headerTop}mm`, fontSize: `${headerFontSize}px`, fontWeight: 'bold', color: headerColor, lineHeight: '1.5', zIndex: 2, whiteSpace: 'pre-line' }}>
                {isArabic ? headerAr : headerEn}
            </div>

             <div style={{ ...centred(titleLeft, titleWidth), top: `${titleTop}mm`, fontSize: `${titleFontSize}px`, fontWeight: 'bold', textDecoration: 'underline', color: titleColor, zIndex: 2, fontFamily: isArabic ? 'Arial, sans-serif' : 'Times New Roman, serif' }}>
                {titleCert}
            </div>

            <div style={{ ...centred(nameLeft, nameWidth), top: `${nameTop}mm`, fontSize: `${nameFontSize}px`, fontWeight: 'bold', color: nameColor, zIndex: 2, borderBottom: `3px dotted ${nameRuleColor}`, paddingBottom: '10px', minHeight: '40px' }}>
                {!isTemplate && participantDisplayName}
            </div>

            <div style={{ ...centred(completionLeft, completionWidth), top: `${completionTop}mm`, fontSize: `${completionFontSize}px`, color: completionColor, fontStyle: isArabic ? 'normal' : 'italic', zIndex: 2 }}>
                {completionText}
            </div>

            <div style={{ ...centred(courseTitleLeft, courseTitleWidth), top: `${courseTitleTop}mm`, fontSize: `${courseTitleFontSize}px`, fontWeight: 'bold', color: courseTitleColor, zIndex: 2, lineHeight: '1.3' }}>
                {baseCourseTitle}
            </div>
            
            {(displaySubCourse) && (
                <div style={{ ...centred(subCourseLeft, subCourseWidth), top: `${subCourseTop}mm`, fontSize: `${subCourseFontSize}px`, fontWeight: 'normal', color: subCourseColor, zIndex: 2 }}>
                   ({displaySubCourse})
                </div>
            )}

            <div style={{ ...centred(placeDateLeft, placeDateWidth), top: `${placeDateTop}mm`, zIndex: 2 }}>
                {showPlace && (
                    <div style={{ fontSize: `${placeDateFontSize}px`, fontWeight: 'bold', color: placeDateColor, display: 'inline-block', marginRight: isArabic ? '0' : '20px', marginLeft: isArabic ? '20px' : '0' }}>
                        <span style={{ color: placeDateLabelColor }}>{placeLabel}</span> {displayPlace}
                    </div>
                )}
                {showDate && (
                    <div style={{ marginTop: '3mm', fontSize: `${placeDateFontSize}px`, fontWeight: 'bold', color: placeDateColor, display: 'block' }}>
                        <span style={{ color: placeDateLabelColor }}>{dateLabel}</span>{' '}
                        {dateIsHtml
                            ? <span dangerouslySetInnerHTML={{ __html: displayDate }}></span>
                            : <span>{displayDate}</span>}
                    </div>
                )}
            </div>

            {!isTemplate && (
                <div style={{ ...qrContainerStyle, top: `${qrTop}mm`, left: `${qrLeft}%`, right: 'auto', transform: 'translateX(-50%)' }}>
                    <div style={{ marginBottom: '8px', lineHeight: '1.5', fontSize: '16px', fontWeight: 'bold', fontFamily: isArabic ? 'Arial, sans-serif' : 'sans-serif' }}>
                        {isArabic ? 'أمسح وتحقق' : 'Scan & Verify'}
                    </div>
                    <div style={{ display: 'block' }}>
                        <QRCodeCanvas value={verificationUrl} size={qrSize} bgColor={"#ffffff"} fgColor={"#000000"} level={"L"} includeMargin={false} />
                    </div>
                </div>
            )}

            {programStampUrl && (
                <div style={{ position: 'absolute', top: `${stampTop}mm`, left: `${stampLeft}%`, transform: 'translateX(-50%)', zIndex: 1, opacity: stampOpacity, pointerEvents: 'none' }}>
                    <img src={programStampUrl} alt="Program Stamp" crossOrigin="anonymous" style={{ width: `${stampWidth}mm`, height: 'auto', maxHeight: `${stampWidth}mm` }} />
                </div>
            )}

            {!rightSignatory.hidden && (
                <SignatureBlock
                    signatureUrl={rightSignatory.url}
                    name={rightSignatory.name}
                    role={rightSignatory.role}
                    nameFontSize={sigNameFsOf(rightSignatory.block)}
                    roleFontSize={sigRoleFsOf(rightSignatory.block)}
                    nameColor={sigNameColor(rightSignatory.block)}
                    roleColor={sigRoleColor(rightSignatory.block)}
                    {...sigImgProps(rightSignatory.block)}
                    positionStyle={{ top: `${sigTopOf(rightSignatory.block)}mm`, left: `${sigRightLeft}%`, width: `${sigWidthOf(rightSignatory.block)}mm`, transform: 'translateX(-50%)' }}
                />
            )}

            {!leftSignatory.hidden && (
                <SignatureBlock
                    signatureUrl={leftSignatory.url}
                    name={leftSignatory.name}
                    role={leftSignatory.role}
                    nameFontSize={sigNameFsOf(leftSignatory.block)}
                    roleFontSize={sigRoleFsOf(leftSignatory.block)}
                    nameColor={sigNameColor(leftSignatory.block)}
                    roleColor={sigRoleColor(leftSignatory.block)}
                    {...sigImgProps(leftSignatory.block)}
                    positionStyle={{ top: `${sigTopOf(leftSignatory.block)}mm`, left: `${sigLeftLeft}%`, width: `${sigWidthOf(leftSignatory.block)}mm`, transform: 'translateX(-50%)' }}
                />
            )}

            {showThirdParty && (
                <SignatureBlock
                    signatureUrl={thirdPartySignature}
                    name={thirdPartyName}
                    role={thirdPartyRole}
                    nameFontSize={sigNameFsOf('third')}
                    roleFontSize={sigRoleFsOf('third')}
                    nameColor={sigNameColor('third')}
                    roleColor={sigRoleColor('third')}
                    {...sigImgProps('third')}
                    positionStyle={{ top: `${sigTopOf('third')}mm`, left: `${sigThirdLeft}%`, width: `${sigWidthOf('third')}mm`, transform: 'translateX(-50%)' }}
                />
            )}

            {showFourthParty && (
                <SignatureBlock
                    signatureUrl={fourthPartySignature}
                    name={fourthPartyName}
                    role={fourthPartyRole}
                    nameFontSize={sigNameFsOf('fourth')}
                    roleFontSize={sigRoleFsOf('fourth')}
                    nameColor={sigNameColor('fourth')}
                    roleColor={sigRoleColor('fourth')}
                    {...sigImgProps('fourth')}
                    positionStyle={{ top: `${sigTopOf('fourth')}mm`, left: `${sigFourthLeft}%`, width: `${sigWidthOf('fourth')}mm`, transform: 'translateX(-50%)' }}
                />
            )}

            {showSealNotice && (
                <div style={{
                    ...centred(sealNoticeLeft, sealNoticeWidth),
                    top: `${sealNoticeTop}mm`,
                    fontSize: `${sealNoticeFontSize}px`,
                    fontStyle: 'italic',
                    color: col('sealNoticeColor'),
                    zIndex: 2
                }}>
                    {sealNoticeText}
                </div>
            )}
        </div>
    );
});

// -----------------------------------------------------------------------------
// GENERATION FUNCTIONS
// -----------------------------------------------------------------------------

export const saveAndOpenPdf = async (doc, fileName) => {
    if (Capacitor.isNativePlatform()) {
        try {
            const base64Data = doc.output('datauristring').split('base64,')[1];
            const folderPath = 'downloads';
            const filePath = `${folderPath}/${fileName}`;

            try {
                await Filesystem.mkdir({ path: folderPath, directory: Directory.Documents, recursive: true });
            } catch (e) {}

            const writeResult = await Filesystem.writeFile({ 
                path: filePath, 
                data: base64Data, 
                directory: Directory.Documents,
                recursive: true
            });

            try {
                await FileOpener.open({ filePath: writeResult.uri, contentType: 'application/pdf' });
            } catch (openError) {
                console.error("FileOpener Error:", openError);
                notify("Certificate saved to your Documents/downloads folder, but no PDF viewer was found on your device to open it automatically.");
            }

        } catch (err) {
            console.error("Native export error:", err);
            throw new Error(`Failed to process PDF natively: ${err.message}`);
        }
    } else {
        doc.save(fileName);
    }
};

export const generateCertificatePdf = async (inputCourse, participant, federalProgramManagerName, participantSubCourse, language = 'en', cachedFacilitators = null, cachedCoordinators = null) => {
    // Re-read from Firestore so a stale cached course can't drop customCertificate.
    const course = await loadAuthoritativeCourse(inputCourse);
    logThirdPartyDiagnostics(course);

    const finalManagerName = (course.approvedByManagerName || federalProgramManagerName || '').trim();
    const rawManagerSignature = course.approvedByManagerSignatureUrl || null;

    const finalDirectorName = (course.approvedDirectorName || course.director || '').trim();
    const rawDirectorSignature = course.approvedDirectorSignatureUrl || null;
    const rawProgramStamp = course.approvedProgramStampUrl || null;
    const rawThirdPartySignature = course.approvedThirdPartySignatureUrl || null;
    const rawFourthPartySignature = course.approvedFourthPartySignatureUrl || null;

    const finalManagerSignature = await imageUrlToBase64(rawManagerSignature);
    const finalDirectorSignature = await imageUrlToBase64(rawDirectorSignature);
    const finalProgramStamp = await imageUrlToBase64(rawProgramStamp);
    const finalThirdPartySignature = await imageUrlToBase64(rawThirdPartySignature);
    const finalFourthPartySignature = await imageUrlToBase64(rawFourthPartySignature);

    // Inline custom logos + third-party signature so html2canvas can draw them.
    const preparedCourse = await resolveCustomAssets(course);

    let directorNameAr = null;
    let programManagerNameAr = null;

    if (language === 'ar') {
        directorNameAr = await fetchArabicNameHelper(cachedFacilitators, 'facilitators', finalDirectorName, 'arabicName', course.approvedDirectorId || course.directorId);
        programManagerNameAr = await fetchArabicNameHelper(cachedCoordinators, 'federalCoordinators', finalManagerName, 'nameAr', course.approvedByManagerId);
    }

    try {
        await new Promise((resolve, reject) => {
            const img = new Image();
            img.src = '/certificate/border.jpg';
            img.onload = resolve;
            img.onerror = () => reject(new Error("Failed to load certificate background image."));
        });
    } catch (error) {
        console.error(error);
        notify(error.message);
        return null;
    }

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px'; 
    container.style.top = '0';
    container.style.zIndex = '-1'; 
    document.body.appendChild(container);

    const root = createRoot(container);
    
    let canvas = null;
    try {
        root.render(<CertificateTemplate course={preparedCourse} participant={participant} federalProgramManagerName={finalManagerName} participantSubCourse={participantSubCourse} language={language} directorNameAr={directorNameAr} programManagerNameAr={programManagerNameAr} programManagerSignatureUrl={finalManagerSignature} directorName={finalDirectorName} directorSignatureUrl={finalDirectorSignature} programStampUrl={finalProgramStamp} thirdPartySignatureUrl={finalThirdPartySignature} fourthPartySignatureUrl={finalFourthPartySignature} />);
        await new Promise(resolve => setTimeout(resolve, 1000)); 

        const element = container.querySelector('#certificate-template');
        if (!element) throw new Error("Certificate template element not found.");

        canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
        return canvas;
    } catch (error) {
        console.error("Error generating certificate:", error);
        notify(`Could not generate certificate for ${participant.name}. See console for details.`);
        return null;
    } finally {
        if (container.parentNode === document.body) { root.unmount(); document.body.removeChild(container); }
    }
};

export const generateBlankCertificatePdf = async (inputCourse, federalProgramManagerName, language = 'en', cachedFacilitators = null, cachedCoordinators = null) => {
    const course = await loadAuthoritativeCourse(inputCourse);
    logThirdPartyDiagnostics(course);

    const finalManagerName = (course.approvedByManagerName || federalProgramManagerName || '').trim();
    const rawManagerSignature = course.approvedByManagerSignatureUrl || null;

    const finalDirectorName = (course.approvedDirectorName || course.director || '').trim();
    const rawDirectorSignature = course.approvedDirectorSignatureUrl || null;
    const rawProgramStamp = course.approvedProgramStampUrl || null;
    const rawThirdPartySignature = course.approvedThirdPartySignatureUrl || null;
    const rawFourthPartySignature = course.approvedFourthPartySignatureUrl || null;

    const finalManagerSignature = await imageUrlToBase64(rawManagerSignature);
    const finalDirectorSignature = await imageUrlToBase64(rawDirectorSignature);
    const finalProgramStamp = await imageUrlToBase64(rawProgramStamp);
    const finalThirdPartySignature = await imageUrlToBase64(rawThirdPartySignature);
    const finalFourthPartySignature = await imageUrlToBase64(rawFourthPartySignature);

    const preparedCourse = await resolveCustomAssets(course);

    let directorNameAr = null;
    let programManagerNameAr = null;

    if (language === 'ar') {
        directorNameAr = await fetchArabicNameHelper(cachedFacilitators, 'facilitators', finalDirectorName, 'arabicName', course.approvedDirectorId || course.directorId);
        programManagerNameAr = await fetchArabicNameHelper(cachedCoordinators, 'federalCoordinators', finalManagerName, 'nameAr', course.approvedByManagerId);
    }

    try {
        await new Promise((resolve, reject) => {
            const img = new Image();
            img.src = '/certificate/border.jpg';
            img.onload = resolve;
            img.onerror = () => reject(new Error("Failed to load certificate background image."));
        });
    } catch (error) { console.error(error); notify(error.message); return null; }

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px'; 
    container.style.top = '0';
    container.style.zIndex = '-1'; 
    document.body.appendChild(container);
    const root = createRoot(container);
    
    let canvas = null;
    try {
        const dummyParticipant = { name: '', id: 'template' };
        let sampleSubCourse = null;
        if (course.facilitatorAssignments && course.facilitatorAssignments.length > 0) {
            const assignment = course.facilitatorAssignments.find(a => a.imci_sub_type);
            if (assignment) sampleSubCourse = assignment.imci_sub_type;
        }
        if (!sampleSubCourse && course.course_type === 'Small & Sick Newborn') sampleSubCourse = "Module (1) Emergency and Essential Newborn Care";

        root.render(<CertificateTemplate course={preparedCourse} participant={dummyParticipant} federalProgramManagerName={finalManagerName} participantSubCourse={sampleSubCourse} language={language} directorNameAr={directorNameAr} programManagerNameAr={programManagerNameAr} programManagerSignatureUrl={finalManagerSignature} directorName={finalDirectorName} directorSignatureUrl={finalDirectorSignature} programStampUrl={finalProgramStamp} thirdPartySignatureUrl={finalThirdPartySignature} fourthPartySignatureUrl={finalFourthPartySignature} isTemplate={true} />);
        await new Promise(resolve => setTimeout(resolve, 1000)); 

        const element = container.querySelector('#certificate-template');
        if (!element) throw new Error("Certificate template element not found.");

        canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
        return canvas;
    } catch (error) { console.error("Error generating certificate template:", error); notify("Could not generate certificate template."); return null; } 
    finally { if (container.parentNode === document.body) { root.unmount(); document.body.removeChild(container); } }
};

export const generateAllCertificatesPdf = async (inputCourse, participants, federalProgramManagerName, language = 'en', onProgress = null, cachedFacilitators = null, cachedCoordinators = null) => {
    if (!participants || participants.length === 0) { notify("No participants found to generate certificates."); return; }

    // Resolve once for the whole batch instead of once per participant.
    const course = await loadAuthoritativeCourse(inputCourse);
    logThirdPartyDiagnostics(course);

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const imgWidth = 297; 
    const imgHeight = 210; 
    let firstPage = true;

    for (let i = 0; i < participants.length; i++) {
        if (onProgress) { onProgress(i + 1, participants.length); await new Promise(resolve => setTimeout(resolve, 0)); }

        const participant = participants[i];
        let participantSubCourse = participant.imci_sub_type;
        if (!participantSubCourse) {
             const participantAssignment = course.facilitatorAssignments?.find((a) => a.group === participant.group);
            participantSubCourse = participantAssignment?.imci_sub_type;
        }

        const canvas = await generateCertificatePdf(course, participant, federalProgramManagerName, participantSubCourse, language, cachedFacilitators, cachedCoordinators);

        if (canvas) {
            if (!firstPage) doc.addPage();
            firstPage = false;
            const imgData = canvas.toDataURL('image/jpeg', 1); 
            doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
        }
    }

    if (!firstPage) {
        const langSuffix = language === 'ar' ? 'AR' : 'EN';
        const fileName = `All_Certificates_${langSuffix}_${course.course_type}_${course.start_date}.pdf`;
        await saveAndOpenPdf(doc, fileName);
    } else { notify("Failed to generate any certificates."); }
};


// -----------------------------------------------------------------------------
// CUSTOMIZER: small stable sub-components (declared outside so inputs keep focus)
// -----------------------------------------------------------------------------

const AssetUploader = ({ label, fieldKey, value, uploading, onPick, onClear, height = 'h-12' }) => (
    <div className="flex flex-col gap-2 p-3 border rounded-lg bg-gray-50">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        {value ? (
            <div className="relative">
                <img src={value} alt={label} className={`${height} w-auto mx-auto object-contain bg-white p-1 border rounded`} />
                <button
                    type="button"
                    onClick={() => onClear(fieldKey)}
                    aria-label={`Remove ${label}`}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                >x</button>
            </div>
        ) : (
            <Button size="sm" variant="secondary" onClick={() => onPick(fieldKey)} disabled={uploading} className="w-full text-xs flex justify-center">
                {uploading ? <Spinner size="sm" /> : <><Upload size={12} className="mr-1" /> Upload image</>}
            </Button>
        )}
    </div>
);

// A single vertical-position control: ▲ / ▼ arrows for quick nudging plus a
// number box for typing an exact millimetre value. Blank = system default.
const NudgeRow = ({ label, fieldKey, value, defaultValue, onChange, min = 0, max = 210, step = 1 }) => {
    const current = value === '' || value === undefined || value === null ? defaultValue : Number(value);
    const nudge = (delta) => {
        const next = Math.min(max, Math.max(min, current + delta));
        onChange(fieldKey, String(next));
    };
    return (
        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
            <span className="text-xs text-gray-700 flex-1 truncate" title={label}>{label}</span>
            <div className="flex items-center gap-1 shrink-0">
                <button
                    type="button"
                    onClick={() => nudge(-step)}
                    aria-label={`Move ${label} up`}
                    className="w-6 h-6 rounded border border-gray-300 bg-white text-gray-700 text-xs leading-none hover:bg-gray-100"
                >▲</button>
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={value ?? ''}
                    onChange={e => onChange(fieldKey, e.target.value)}
                    placeholder={String(defaultValue)}
                    className="w-16 text-center border rounded px-1 py-0.5 text-xs"
                />
                <button
                    type="button"
                    onClick={() => nudge(step)}
                    aria-label={`Move ${label} down`}
                    className="w-6 h-6 rounded border border-gray-300 bg-white text-gray-700 text-xs leading-none hover:bg-gray-100"
                >▼</button>
            </div>
        </div>
    );
};

const CheckRow = ({ label, hint, checked, onChange }) => (
    <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer select-none">
        <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
        <span>
            <span className="font-medium">{label}</span>
            {hint && <span className="block text-xs text-gray-500">{hint}</span>}
        </span>
    </label>
);

// -----------------------------------------------------------------------------
// LIVE PREVIEW — renders the real CertificateTemplate against the unsaved edits,
// scaled down to fit. Because it uses the same component the PDF uses, what you
// see here is what gets printed; there is no second layout to keep in sync.
// -----------------------------------------------------------------------------

const MM_TO_PX = 96 / 25.4;          // CSS reference pixels per millimetre
const PAGE_W_PX = 297 * MM_TO_PX;    // A4 landscape width
const PAGE_H_PX = 210 * MM_TO_PX;

const LiveCertificatePreview = ({ course, data, language }) => {
    const wrapRef = useRef(null);
    const [scale, setScale] = useState(0.35);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const update = () => {
            const w = el.clientWidth;
            if (w > 0) setScale(w / PAGE_W_PX);
        };
        update();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
        }
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // The unsaved form state is spliced in as the course's customCertificate, so
    // every field the user is editing takes effect on the next render.
    const previewCourse = useMemo(() => ({ ...course, customCertificate: data || {} }), [course, data]);

    return (
        <div
            ref={wrapRef}
            style={{ width: '100%', height: PAGE_H_PX * scale, position: 'relative', overflow: 'hidden' }}
            className="border border-gray-300 rounded bg-white shadow-inner"
        >
            <div
                style={{
                    width: PAGE_W_PX,
                    height: PAGE_H_PX,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0
                }}
            >
                <CertificateTemplate
                    course={previewCourse}
                    participant={{ name: language === 'ar' ? 'اسم المشارك' : 'Participant Name', id: 'preview' }}
                    federalProgramManagerName={course?.approvedByManagerName || ''}
                    participantSubCourse={course?.director_imci_sub_type || null}
                    language={language}
                    programManagerSignatureUrl={course?.approvedByManagerSignatureUrl || null}
                    directorName={course?.approvedDirectorName || course?.director || ''}
                    directorSignatureUrl={course?.approvedDirectorSignatureUrl || null}
                    programStampUrl={course?.approvedProgramStampUrl || null}
                    thirdPartySignatureUrl={course?.approvedThirdPartySignatureUrl || null}
                                fourthPartySignatureUrl={course?.approvedFourthPartySignatureUrl || null}
                />
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// DRAG & DROP LAYOUT EDITOR
// Renders the real template underneath and puts a draggable handle over each
// block. Dragging converts screen pixels back into millimetres and writes the
// same *Top keys the form edits, so both views stay in agreement.
// -----------------------------------------------------------------------------

const readNum = (data, key, fallback) => {
    const raw = data?.[key];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
};

const readColor = (data, key) => data?.[key] || CERT_DEFAULTS[key] || '#000000';

/**
 * Describes every selectable element on the certificate: where its handle goes,
 * which config keys it owns, and which property controls to show. The editor is
 * driven entirely off this table, so adding a new adjustable property means
 * adding one entry here rather than touching the UI.
 */
const buildEditorElements = (ctx) => {
    const {
        isArabic, hasStamp, hasThirdParty, hasFourthParty, hasSubCourse, slotFor, sigCount,
        subCourseMode = 'auto', autoSubCourse = '',
        hideManager, hideDirector, showSealNotice, signatureImages = [],
        logoTopDef, logoLeftFor, hiddenLogos = {}, extraLogos = [], sharedSigTop, sharedNameFs, sharedRoleFs, sideWidthDef, thirdWidthDef
    } = ctx;

    // Per-signature controls, generated so every block gets the same set.
    const sigNumbers = (block, widthDef, widthLabel = 'This block width (mm)') => [
        { key: `${block}SignatureNameFontSize`, label: 'This name size (px)', def: sharedNameFs, min: 6, max: 60 },
        { key: `${block}SignatureRoleFontSize`, label: 'This title size (px)', def: sharedRoleFs, min: 6, max: 60 },
        { key: `${block}SignatureWidth`, label: widthLabel, def: widthDef, min: 30, max: 140 }
    ];

    return [
        {
            id: 'logoRow', label: 'Logo row (all four)',
            topKey: 'logoTop', topDef: CERT_DEFAULTS.logoTop,
            box: { widthPct: 96, heightMm: 8 },
            numbers: [
                { key: 'logoGroup1Left', label: 'Left pair centre (%)', def: isArabic ? 100 - CERT_DEFAULTS.logoGroup1Left : CERT_DEFAULTS.logoGroup1Left, min: 0, max: 100 },
                { key: 'logoGroup2Left', label: 'Right pair centre (%)', def: isArabic ? 100 - CERT_DEFAULTS.logoGroup2Left : CERT_DEFAULTS.logoGroup2Left, min: 0, max: 100 },
                { key: 'logoSpread', label: 'Gap from pair centre (%)', def: CERT_DEFAULTS.logoSpread, min: 0, max: 25, step: 0.5 }
            ],
            note: 'The baseline every logo follows until it is given a position of its own. A logo that has been moved individually ignores this.'
        },
        // One entry per logo: each drags, resizes and uploads on its own.
        ...LOGO_SLOTS.map(slot => ({
            id: `logo${slot.n}`,
            label: `${slot.label} (default: ${slot.defaultName})`,
            logoKey: slot.imageKey,
            topKey: `logo${slot.n}Top`, topDef: logoTopDef,
            leftKey: `logo${slot.n}Left`, leftDef: logoLeftFor(slot),
            box: { widthPct: 11, heightMm: 34 },
            boxHeightKey: slot.heightKey, boxHeightDef: CERT_DEFAULTS[slot.heightKey],
            numbers: [
                { key: slot.heightKey, label: 'Height (mm)', def: CERT_DEFAULTS[slot.heightKey], min: 5, max: 80 }
            ],
            inactive: !!hiddenLogos[slot.n],
            inactiveNote: 'Hidden. Untick “Hide this logo” below to print it again.',
            checks: [{ key: `hideLogo${slot.n}`, label: 'Hide this logo' }],
            note: 'This logo moves and resizes on its own. Reset it to follow the shared logo row again.'
        })),
        // Extra logos added with “Add logo”. Without an image they are placeholders.
        ...extraLogos.map((x, i) => ({
            id: `xlogo:${x.id}`,
            label: `${x.label || `Logo ${LOGO_SLOTS.length + i + 1}`}${x.src ? '' : ' (placeholder)'}`,
            logoKey: xlogoKey(x.id, 'Src'),
            extraLogoId: x.id,
            extraInherited: x.inherited,
            topKey: xlogoKey(x.id, 'Top'), topDef: logoTopDef,
            leftKey: xlogoKey(x.id, 'Left'), leftDef: 50,
            box: { widthPct: 11, heightMm: 34 },
            boxHeightKey: xlogoKey(x.id, 'Height'), boxHeightDef: EXTRA_LOGO_DEFAULT_HEIGHT,
            numbers: [
                { key: xlogoKey(x.id, 'Height'), label: 'Height (mm)', def: EXTRA_LOGO_DEFAULT_HEIGHT, min: 5, max: 80 }
            ],
            texts: [
                { key: xlogoKey(x.id, 'Label'), label: 'Name (shown in the designer only)', placeholder: 'e.g. Partner logo' }
            ],
            inactive: x.hidden,
            inactiveNote: 'Hidden. Untick “Hide this logo” below to print it again.',
            checks: [{ key: xlogoKey(x.id, 'Hidden'), label: 'Hide this logo' }],
            note: x.src
                ? 'An added logo. Drag it anywhere on the page.'
                : 'A placeholder: position and size it now, upload the image whenever it is ready. Nothing prints until an image is added.'
        })),
        {
            id: 'header', label: 'Header text',
            topKey: 'headerTop', topDef: CERT_DEFAULTS.headerTop,
            leftKey: 'headerLeft', leftDef: CERT_DEFAULTS.headerLeft,
            widthKey: 'headerWidth', widthDef: CERT_DEFAULTS.headerWidth,
            box: { widthPct: 48, heightMm: 44 },
            texts: [
                { key: 'headerEn', label: 'Text (English)', multiline: true, placeholder: 'Republic of Sudan\nFederal Ministry of Health...' },
                { key: 'headerAr', label: 'Text (Arabic)', multiline: true, rtl: true, placeholder: 'جمهورية السودان\nوزارة الصحة الاتحادية...' }
            ],
            colors: [{ key: 'headerColor', label: 'Text colour' }],
            fontKey: 'headerFontSize', fontDef: CERT_DEFAULTS.headerFontSizeEn
        },
        {
            id: 'title', label: 'Certificate title',
            topKey: 'titleTop', topDef: CERT_DEFAULTS.titleTop,
            leftKey: 'titleLeft', leftDef: CERT_DEFAULTS.titleLeft,
            widthKey: 'titleWidth', widthDef: CERT_DEFAULTS.titleWidth,
            box: { widthPct: 48, heightMm: 22 },
            texts: [
                { key: 'titleEn', label: 'Text (English)', placeholder: 'CERTIFICATE' },
                { key: 'titleAr', label: 'Text (Arabic)', rtl: true, placeholder: 'شهادة' }
            ],
            colors: [{ key: 'titleColor', label: 'Text colour' }],
            fontKey: 'titleFontSize', fontDef: CERT_DEFAULTS.titleFontSize
        },
        {
            id: 'name', label: 'Participant name',
            topKey: 'nameTop', topDef: CERT_DEFAULTS.nameTop,
            leftKey: 'nameLeft', leftDef: CERT_DEFAULTS.nameLeft,
            widthKey: 'nameWidth', widthDef: CERT_DEFAULTS.nameWidth,
            box: { widthPct: 76, heightMm: 15 },
            colors: [
                { key: 'nameColor', label: 'Name colour' },
                { key: 'nameRuleColor', label: 'Dotted rule colour' }
            ],
            fontKey: 'nameFontSize', fontDef: CERT_DEFAULTS.nameFontSize,
            checks: [{ key: 'rawParticipantName', label: 'Keep name exactly as entered' }],
            note: 'The name comes from the participant record. It is printed with one capital per name part (e.g. "AHMED ALI" prints as "Ahmed Ali") unless you tick the box above.'
        },
        {
            id: 'completion', label: 'Completion line',
            topKey: 'completionTop', topDef: CERT_DEFAULTS.completionTop,
            leftKey: 'completionLeft', leftDef: CERT_DEFAULTS.completionLeft,
            widthKey: 'completionWidth', widthDef: CERT_DEFAULTS.completionWidth,
            box: { widthPct: 56, heightMm: 9 },
            texts: [
                { key: 'completionTextEn', label: 'Text (English)', placeholder: 'Has successfully completed:' },
                { key: 'completionTextAr', label: 'Text (Arabic)', rtl: true, placeholder: 'أكمل/ت بنجاح الدورة التدريبية على : ' }
            ],
            colors: [{ key: 'completionColor', label: 'Text colour' }],
            fontKey: 'completionFontSize', fontDef: CERT_DEFAULTS.completionFontSize
        },
        {
            id: 'courseTitle', label: 'Course title',
            topKey: 'courseTitleTop', topDef: CERT_DEFAULTS.courseTitleTop,
            leftKey: 'courseTitleLeft', leftDef: CERT_DEFAULTS.courseTitleLeft,
            widthKey: 'courseTitleWidth', widthDef: CERT_DEFAULTS.courseTitleWidth,
            box: { widthPct: 90, heightMm: 12 },
            texts: [
                { key: 'courseTitleEn', label: 'Override title (English)', placeholder: 'Leave blank to use the course name' },
                { key: 'courseTitleAr', label: 'Override title (Arabic)', rtl: true, placeholder: 'اتركه فارغاً لاستخدام اسم الدورة' }
            ],
            colors: [{ key: 'courseTitleColor', label: 'Text colour' }],
            fontKey: 'courseTitleFontSize', fontDef: CERT_DEFAULTS.courseTitleFontSize
        },
        {
            id: 'subCourse', label: 'Sub-course line',
            topKey: 'subCourseTop', topDef: CERT_DEFAULTS.subCourseTop,
            leftKey: 'subCourseLeft', leftDef: CERT_DEFAULTS.subCourseLeft,
            widthKey: 'subCourseWidth', widthDef: CERT_DEFAULTS.subCourseWidth,
            box: { widthPct: 56, heightMm: 8 },
            inactive: !hasSubCourse,
            inactiveNote: subCourseMode === 'hide'
                ? 'Set to “Never print”. Change “What prints” below to bring it back.'
                : 'Nothing on this line yet. Type the wording below and it appears on the certificate.',
            selects: [{
                key: 'subCourseMode',
                label: 'What prints',
                def: 'auto',
                options: [
                    { value: 'auto', label: 'Automatic — each participant’s sub-course (or the text below)' },
                    { value: 'customOnly', label: 'Only the text typed below' },
                    { value: 'hide', label: 'Never print this line' }
                ]
            }],
            texts: [
                { key: 'subCourseEn', label: 'Text (English)', placeholder: subCourseMode === 'customOnly' ? 'Type the line to print' : 'Blank = participant’s sub-course' },
                { key: 'subCourseAr', label: 'Text (Arabic)', rtl: true, placeholder: subCourseMode === 'customOnly' ? 'اكتب النص المطلوب' : 'فارغ = النوع الفرعي للمشارك' }
            ],
            colors: [{ key: 'subCourseColor', label: 'Text colour' }],
            fontKey: 'subCourseFontSize', fontDef: CERT_DEFAULTS.subCourseFontSize,
            note: subCourseMode === 'auto' && autoSubCourse
                ? `Printing automatically from the participant records: “${autoSubCourse}”. Choose “Only the text typed below” or “Never print” if you don’t want it.`
                : 'Prints in brackets under the course title. Filling only one language makes that text print in both.'
        },
        {
            id: 'placeDate', label: 'Place & date',
            topKey: 'placeDateTop', topDef: CERT_DEFAULTS.placeDateTop,
            leftKey: 'placeDateLeft', leftDef: CERT_DEFAULTS.placeDateLeft,
            widthKey: 'placeDateWidth', widthDef: CERT_DEFAULTS.placeDateWidth,
            box: { widthPct: 56, heightMm: 20 },
            texts: [
                { key: 'placeEn', label: 'Place (English)', placeholder: 'e.g. Khartoum - Grand Hall' },
                { key: 'placeAr', label: 'Place (Arabic)', rtl: true, placeholder: 'مثال: الخرطوم - القاعة الكبرى' },
                { key: 'placeLabelEn', label: 'Place label (English)', placeholder: 'Place : ' },
                { key: 'placeLabelAr', label: 'Place label (Arabic)', rtl: true, placeholder: 'المكان : ' },
                { key: 'dateLabelEn', label: 'Date label (English)', placeholder: 'Date : ' },
                { key: 'dateLabelAr', label: 'Date label (Arabic)', rtl: true, placeholder: 'التاريخ : ' }
            ],
            dates: true,
            colors: [
                { key: 'placeDateColor', label: 'Value colour' },
                { key: 'placeDateLabelColor', label: 'Label colour' }
            ],
            fontKey: 'placeDateFontSize', fontDef: CERT_DEFAULTS.placeDateFontSize
        },
        // The manager and director swap sides between LTR and RTL, so these two
        // entries are keyed by ROLE and pick up whichever side key applies. That
        // keeps the name/title fields unambiguous in both languages.
        {
            id: 'sigRow', label: 'Signature row (all)',
            topKey: 'signatureTop', topDef: CERT_DEFAULTS.signatureTop,
            box: { widthPct: 96, heightMm: 8 },
            numbers: [
                { key: 'signatureNameFontSize', label: 'Name size (px)', def: CERT_DEFAULTS.signatureNameFontSize, min: 6, max: 60 },
                { key: 'signatureRoleFontSize', label: 'Title size (px)', def: CERT_DEFAULTS.signatureRoleFontSize, min: 6, max: 60 },
                { key: 'signatureWidth', label: 'Side block width (mm)', def: sideWidthDef, min: 30, max: 140 },
                { key: 'thirdSignatureWidth', label: 'Middle block width (mm)', def: thirdWidthDef, min: 30, max: 140 }
            ],
            colors: [
                { key: 'signatureColor', label: 'ALL signatures — name colour' },
                { key: 'signatureRoleColor', label: 'ALL signatures — title colour' }
            ],
            note: 'The baseline for every signature. A block that has been given its own height, width or text size ignores this row.'
        },
        {
            id: 'sigManager', label: 'Program Manager signature',
            topKey: 'managerSignatureTop', topDef: sharedSigTop,
            leftKey: isArabic ? 'sigRightLeft' : 'sigLeftLeft',
            leftDef: slotFor(isArabic ? sigCount - 1 : 0),
            box: { widthPct: 26, heightMm: 22 },
            texts: [
                { key: 'managerTitleEn', label: 'Name (English)', placeholder: 'Blank = approved manager name' },
                { key: 'managerTitleAr', label: 'Name (Arabic)', rtl: true, placeholder: 'فارغ = الاسم المعتمد' },
                { key: 'managerRoleEn', label: 'Title (English)', placeholder: CERT_DEFAULTS.managerRoleEn },
                { key: 'managerRoleAr', label: 'Title (Arabic)', rtl: true, placeholder: CERT_DEFAULTS.managerRoleAr }
            ],
            inactive: hideManager,
            inactiveNote: 'Currently hidden. Untick “Hide this signature” below to print it.',
            checks: [{ key: 'hideManager', label: 'Hide this signature' }],
            colors: [
                { key: 'managerSignatureColor', label: 'This name colour' },
                { key: 'managerSignatureRoleColor', label: 'This title colour' }
            ],
            numbers: sigNumbers('manager', sideWidthDef),
            note: 'Every box here affects this signature only. Leave one blank to follow "Signature row (all)". The signature IMAGE is uploaded from the certificate list, not here.'
        },
        {
            id: 'sigDirector', label: 'Course Director signature',
            topKey: 'directorSignatureTop', topDef: sharedSigTop,
            leftKey: isArabic ? 'sigLeftLeft' : 'sigRightLeft',
            leftDef: slotFor(isArabic ? 0 : sigCount - 1),
            box: { widthPct: 26, heightMm: 22 },
            texts: [
                { key: 'directorTitleEn', label: 'Name (English)', placeholder: 'Blank = course director name' },
                { key: 'directorTitleAr', label: 'Name (Arabic)', rtl: true, placeholder: 'فارغ = اسم مدير الدورة' },
                { key: 'directorRoleEn', label: 'Title (English)', placeholder: CERT_DEFAULTS.directorRoleEn },
                { key: 'directorRoleAr', label: 'Title (Arabic)', rtl: true, placeholder: CERT_DEFAULTS.directorRoleAr },
                { key: 'honorificEn', label: 'Honorific (English)', placeholder: CERT_DEFAULTS.honorificEn },
                { key: 'honorificAr', label: 'Honorific (Arabic)', rtl: true, placeholder: CERT_DEFAULTS.honorificAr }
            ],
            inactive: hideDirector,
            inactiveNote: 'Currently hidden. Untick “Hide this signature” below to print it.',
            checks: [
                { key: 'hideDirector', label: 'Hide this signature' },
                { key: 'hideHonorific', label: 'Drop the honorific from both names' }
            ],
            colors: [
                { key: 'directorSignatureColor', label: 'This name colour' },
                { key: 'directorSignatureRoleColor', label: 'This title colour' }
            ],
            numbers: sigNumbers('director', sideWidthDef),
            note: 'Honorific settings apply to the director and manager names together. Every other box here affects this signature only; leave one blank to follow the shared signature row.'
        },
        {
            id: 'sigThird', label: 'Signature (third party)',
            topKey: 'thirdSignatureTop', topDef: sharedSigTop,
            leftKey: 'sigThirdLeft', leftDef: slotFor(1),
            box: { widthPct: 24, heightMm: 22 },
            inactive: !hasThirdParty,
            signatureKey: 'thirdPartySignatureUrl',
            texts: [
                { key: 'thirdPartyNameEn', label: 'Name (English)' },
                { key: 'thirdPartyNameAr', label: 'Name (Arabic)', rtl: true },
                { key: 'thirdPartyRoleEn', label: 'Title (English)', placeholder: CERT_DEFAULTS.thirdPartyRoleEn },
                { key: 'thirdPartyRoleAr', label: 'Title (Arabic)', rtl: true, placeholder: CERT_DEFAULTS.thirdPartyRoleAr }
            ],
            colors: [
                { key: 'thirdSignatureColor', label: 'This name colour' },
                { key: 'thirdSignatureRoleColor', label: 'This title colour' }
            ],
            numbers: sigNumbers('third', thirdWidthDef, 'Block width (mm)'),
            note: 'Prints as soon as a name or signature image is added. Height, width and text size here apply to this signature only.'
        },
        {
            id: 'sigFourth', label: 'Signature (fourth party)',
            topKey: 'fourthSignatureTop', topDef: sharedSigTop,
            leftKey: 'sigFourthLeft', leftDef: slotFor(hasFourthParty ? 2 : 1),
            box: { widthPct: 24, heightMm: 22 },
            inactive: !hasFourthParty,
            signatureKey: 'fourthPartySignatureUrl',
            texts: [
                { key: 'fourthPartyNameEn', label: 'Name (English)' },
                { key: 'fourthPartyNameAr', label: 'Name (Arabic)', rtl: true },
                { key: 'fourthPartyRoleEn', label: 'Title (English)', placeholder: CERT_DEFAULTS.fourthPartyRoleEn },
                { key: 'fourthPartyRoleAr', label: 'Title (Arabic)', rtl: true, placeholder: CERT_DEFAULTS.fourthPartyRoleAr }
            ],
            colors: [
                { key: 'fourthSignatureColor', label: 'This name colour' },
                { key: 'fourthSignatureRoleColor', label: 'This title colour' }
            ],
            numbers: sigNumbers('fourth', thirdWidthDef, 'Block width (mm)'),
            note: 'Prints as soon as a name or signature image is added. Adding it re-spaces all four signatures automatically.'
        },
        // --- Draggable signature IMAGES -------------------------------------
        // Only listed when that signatory actually has an image, since there is
        // nothing to position otherwise. These drag on their own axes: both in
        // millimetres relative to their block, with the vertical value measured
        // UPWARD from the name, so `yInvert` flips the drag direction.
        ...signatureImages.map(({ block, label, blockLeftKey, blockLeftDef }) => ({
            id: `${block}Image`,
            label: `${label} — image`,
            imageOf: block,
            blockLeftKey,
            blockLeftDef,
            axes: {
                xKey: `${block}SignatureImageOffsetX`, xDef: CERT_DEFAULTS.signatureImageOffsetX, xMin: -80, xMax: 80,
                yKey: `${block}SignatureImageBottom`, yDef: CERT_DEFAULTS.signatureImageBottom, yMin: -30, yMax: 70, yInvert: true
            },
            numbers: [
                { key: `${block}SignatureImageWidth`, label: 'Max width (mm)', def: CERT_DEFAULTS.signatureImageWidth, min: 5, max: 120 },
                { key: `${block}SignatureImageHeight`, label: 'Max height (mm)', def: CERT_DEFAULTS.signatureImageHeight, min: 5, max: 80 },
                { key: `${block}SignatureImageBottom`, label: 'Height above name (mm)', def: CERT_DEFAULTS.signatureImageBottom, min: -30, max: 70 },
                { key: `${block}SignatureImageOffsetX`, label: 'Nudge left/right (mm)', def: CERT_DEFAULTS.signatureImageOffsetX, min: -80, max: 80 }
            ],
            note: 'Drag the image itself on the canvas, or use the boxes here. Width and height are limits — the scan keeps its own aspect ratio.'
        })),
        {
            id: 'sealNotice', label: 'Seal-required notice',
            topKey: 'sealNoticeTop', topDef: CERT_DEFAULTS.sealNoticeTop,
            leftKey: 'sealNoticeLeft', leftDef: CERT_DEFAULTS.sealNoticeLeft,
            widthKey: 'sealNoticeWidth', widthDef: CERT_DEFAULTS.sealNoticeWidth,
            box: { widthPct: 60, heightMm: 8 },
            inactive: !showSealNotice,
            inactiveNote: 'Not printing. Tick “Print this notice” below to add it.',
            checks: [{ key: 'showSealNotice', label: 'Print this notice' }],
            texts: [
                { key: 'sealNoticeEn', label: 'Text (English)', placeholder: CERT_DEFAULTS.sealNoticeEn },
                { key: 'sealNoticeAr', label: 'Text (Arabic)', rtl: true, placeholder: CERT_DEFAULTS.sealNoticeAr }
            ],
            colors: [{ key: 'sealNoticeColor', label: 'Text colour' }],
            fontKey: 'sealNoticeFontSize', fontDef: CERT_DEFAULTS.sealNoticeFontSize,
            note: 'For workflows where the paper is sealed by hand: states on the page that an unsealed printout is not valid.'
        },
        {
            id: 'qr', label: 'QR code',
            topKey: 'qrTop', topDef: CERT_DEFAULTS.qrTop,
            leftKey: 'qrLeft', leftDef: isArabic ? 100 - CERT_DEFAULTS.qrLeft : CERT_DEFAULTS.qrLeft,
            box: { widthPct: 16, heightMm: 34 },
            numbers: [{ key: 'qrSize', label: 'QR size (px)', def: CERT_DEFAULTS.qrSize, min: 40, max: 200 }]
        },
        ...(hasStamp ? [{
            id: 'stamp', label: 'Program stamp',
            topKey: 'stampTop', topDef: CERT_DEFAULTS.stampTop,
            leftKey: 'stampLeft', leftDef: CERT_DEFAULTS.stampLeft,
            box: { widthMm: 40, heightMm: 40 },
            numbers: [
                { key: 'stampWidth', label: 'Stamp width (mm)', def: CERT_DEFAULTS.stampWidth, min: 10, max: 120 },
                { key: 'stampOpacity', label: 'Opacity (0-1)', def: CERT_DEFAULTS.stampOpacity, min: 0, max: 1, step: 0.05 }
            ]
        }] : [])
    ];
};

// --- Small reusable property controls -----------------------------------------

const PropRow = ({ label, children, hint }) => (
    <div className="mb-3">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</label>
        {children}
        {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
);

const ColorField = ({ value, defaultValue, onChange }) => (
    <div className="flex items-center gap-2">
        <input
            type="color"
            value={value || defaultValue}
            onChange={e => onChange(e.target.value)}
            className="h-8 w-10 rounded border border-gray-300 cursor-pointer bg-white p-0.5"
        />
        <input
            type="text"
            value={value || ''}
            placeholder={defaultValue}
            onChange={e => onChange(e.target.value)}
            className="flex-1 border rounded px-2 py-1 text-xs font-mono"
        />
        {value && (
            <button type="button" onClick={() => onChange('')} className="text-[11px] text-gray-500 hover:text-red-600" title="Reset to default">reset</button>
        )}
    </div>
);

const StepField = ({ value, defaultValue, min, max, step = 1, unit, onChange }) => {
    const current = value === '' || value === undefined || value === null ? defaultValue : Number(value);
    const bump = (d) => {
        const next = Math.min(max, Math.max(min, Number((current + d).toFixed(2))));
        onChange(String(next));
    };
    return (
        <div className="flex items-center gap-1">
            <button type="button" onClick={() => bump(-step)} className="w-7 h-7 border rounded text-sm hover:bg-gray-100">−</button>
            <input
                type="number"
                min={min} max={max} step={step}
                value={value ?? ''}
                placeholder={String(defaultValue)}
                onChange={e => onChange(e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm text-center"
            />
            <button type="button" onClick={() => bump(step)} className="w-7 h-7 border rounded text-sm hover:bg-gray-100">+</button>
            {unit && <span className="text-[11px] text-gray-400 w-6">{unit}</span>}
        </div>
    );
};

// -----------------------------------------------------------------------------
// GRID & ALIGNMENT
// The grid is drawn in page millimetres (an SVG with a 297 × 210 viewBox), so it
// lines up exactly with the values stored in the template at every zoom level.
// -----------------------------------------------------------------------------

const PAGE_W_MM = 297;
const PAGE_H_MM = 210;
const SNAP_THRESHOLD_MM = 1.5;
const GRID_PREFS_KEY = 'certDesigner.gridPrefs';

const loadGridPrefs = () => {
    try {
        const raw = window.localStorage?.getItem(GRID_PREFS_KEY);
        if (raw) return { gridSize: 10, snapToGrid: false, smartGuides: true, showRulers: true, ...JSON.parse(raw) };
    } catch (e) { /* storage unavailable */ }
    return { gridSize: 10, snapToGrid: false, smartGuides: true, showRulers: true };
};

const pctToMm = (pct) => (pct / 100) * PAGE_W_MM;
const mmToPct = (mm) => (mm / PAGE_W_MM) * 100;
const round2 = (v) => Math.round(v * 100) / 100;

const GridOverlay = ({ gridSize, showRulers, guides }) => {
    const lines = [];
    if (gridSize > 0) {
        const majorEvery = gridSize >= 10 ? 5 : 10; // a darker line every 50mm
        for (let x = gridSize, i = 1; x < PAGE_W_MM; x += gridSize, i++) {
            const major = i % majorEvery === 0;
            lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={PAGE_H_MM} stroke={major ? 'rgba(14,116,144,0.45)' : 'rgba(14,116,144,0.18)'} strokeWidth={major ? 0.3 : 0.15} />);
            if (showRulers && major) lines.push(<text key={`vt${x}`} x={x + 0.8} y={3.2} fontSize={2.6} fill="rgba(14,116,144,0.9)">{x}</text>);
        }
        for (let y = gridSize, i = 1; y < PAGE_H_MM; y += gridSize, i++) {
            const major = i % majorEvery === 0;
            lines.push(<line key={`h${y}`} x1={0} y1={y} x2={PAGE_W_MM} y2={y} stroke={major ? 'rgba(14,116,144,0.45)' : 'rgba(14,116,144,0.18)'} strokeWidth={major ? 0.3 : 0.15} />);
            if (showRulers && major) lines.push(<text key={`ht${y}`} x={0.8} y={y - 0.8} fontSize={2.6} fill="rgba(14,116,144,0.9)">{y}</text>);
        }
    }
    return (
        <svg
            viewBox={`0 0 ${PAGE_W_MM} ${PAGE_H_MM}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }}
        >
            {lines}
            {/* Page centre lines */}
            <line x1={PAGE_W_MM / 2} y1={0} x2={PAGE_W_MM / 2} y2={PAGE_H_MM} stroke="rgba(239,68,68,0.55)" strokeWidth={0.3} strokeDasharray="2 1.5" />
            <line x1={0} y1={PAGE_H_MM / 2} x2={PAGE_W_MM} y2={PAGE_H_MM / 2} stroke="rgba(239,68,68,0.35)" strokeWidth={0.3} strokeDasharray="2 1.5" />
            {/* Live alignment guides while dragging */}
            {(guides?.v || []).map(mm => (
                <line key={`gv${mm}`} x1={mm} y1={0} x2={mm} y2={PAGE_H_MM} stroke="#d946ef" strokeWidth={0.45} />
            ))}
            {(guides?.h || []).map(mm => (
                <line key={`gh${mm}`} x1={0} y1={mm} x2={PAGE_W_MM} y2={mm} stroke="#d946ef" strokeWidth={0.45} />
            ))}
        </svg>
    );
};

// -----------------------------------------------------------------------------
// APP BRANDING
// Single place to change how the web app identifies itself inside the designer
// so it reads as a page of the site rather than a floating tool. Edit these
// three values (or pass `branding` into CertificateDesigner) to match the rest
// of the app. logoSrc points at a file in /public.
// -----------------------------------------------------------------------------

export const APP_BRANDING = {
    name: 'National Child Health Program',
    subtitle: 'Training & Certification System',
    logoSrc: '/certificate/ch-logo.png'
};

// -----------------------------------------------------------------------------
// REAL CERTIFICATE PREVIEW
// Runs the exact pipeline a download uses (layering, asset inlining, Arabic name
// lookup, html2canvas) and shows the resulting page. Nothing is approximated, so
// what appears here is what the PDF will contain.
//
// `course` is either a stored course (the pipeline re-reads it and applies the
// templates, exactly like a download) or, from the designer, an already-layered
// course marked __certCourseResolved so the UNSAVED edits are what gets drawn.
// -----------------------------------------------------------------------------

const SAMPLE_PARTICIPANT = {
    en: { id: 'preview', name: 'Ahmed Mohamed Ali Hassan' },
    ar: { id: 'preview', name: 'أحمد محمد علي حسن' }
};

const subCourseFor = (course, participant) => {
    if (participant?.imci_sub_type) return participant.imci_sub_type;
    const byGroup = course?.facilitatorAssignments?.find(a => a.group === participant?.group)?.imci_sub_type;
    return byGroup || course?.director_imci_sub_type || null;
};

export function CertificatePreviewModal({ course, federalProgramManagerName = '', onClose, defaultLanguage = 'en', note = '' }) {
    const [language, setLanguage] = useState(defaultLanguage);
    const [participants, setParticipants] = useState([]);
    const [participantId, setParticipantId] = useState('__sample');
    const [imageUrl, setImageUrl] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [zoomed, setZoomed] = useState(false);
    const canvasRef = useRef(null);
    const runRef = useRef(0);

    const canListParticipants = !!course?.id && !course.__templateSample;

    useEffect(() => {
        if (!canListParticipants) return;
        let alive = true;
        (async () => {
            try {
                const list = await listAllParticipantsForCourse(course.id, { source: navigator.onLine ? 'server' : 'cache' });
                if (alive) setParticipants((list || []).filter(p => !p.isDeleted).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            } catch (err) {
                console.warn('[Certificate preview] Could not load participants.', err);
            }
        })();
        return () => { alive = false; };
    }, [course?.id, canListParticipants]);

    const participant = participantId === '__sample'
        ? SAMPLE_PARTICIPANT[language]
        : participants.find(p => p.id === participantId) || SAMPLE_PARTICIPANT[language];

    const render = useCallback(async () => {
        const run = ++runRef.current;
        setBusy(true);
        setError('');
        try {
            const canvas = await generateCertificatePdf(
                course,
                participant,
                federalProgramManagerName,
                subCourseFor(course, participant),
                language
            );
            if (run !== runRef.current) return; // a newer render started
            if (!canvas) throw new Error('The certificate could not be drawn. See the console for details.');
            canvasRef.current = canvas;
            setImageUrl(canvas.toDataURL('image/jpeg', 0.92));
        } catch (err) {
            if (run === runRef.current) setError(err.message || String(err));
        } finally {
            if (run === runRef.current) setBusy(false);
        }
    }, [course, participant, federalProgramManagerName, language]);

    // Redraw whenever the language or participant changes.
    useEffect(() => { render(); }, [language, participantId]); // eslint-disable-line react-hooks/exhaustive-deps

    const buildPdf = () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const pdf = new jsPDF('landscape', 'mm', 'a4');
        pdf.addImage(canvas.toDataURL('image/jpeg', 1), 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
        return pdf;
    };

    const openPdf = async () => {
        const pdf = buildPdf();
        if (!pdf) return;
        if (Capacitor.isNativePlatform()) {
            await saveAndOpenPdf(pdf, `Certificate_Preview_${language.toUpperCase()}.pdf`);
            return;
        }
        const url = pdf.output('bloburl');
        const win = window.open(url, '_blank');
        if (!win) await saveAndOpenPdf(pdf, `Certificate_Preview_${language.toUpperCase()}.pdf`); // pop-up blocked
    };

    const downloadPdf = async () => {
        const pdf = buildPdf();
        if (!pdf) return;
        const who = participantId === '__sample' ? 'Sample' : (participant.name || 'Participant').replace(/\s+/g, '_');
        await saveAndOpenPdf(pdf, `Certificate_Preview_${who}_${language.toUpperCase()}.pdf`);
    };

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/80 flex flex-col" role="dialog" aria-modal="true" aria-label="Certificate preview">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200 shadow">
                <Eye className="h-4 w-4 text-sky-700" />
                <h2 className="font-bold text-gray-900 text-sm mr-2">Certificate preview</h2>
                <span className="text-[11px] text-gray-500 hidden md:inline">
                    Drawn by the same engine as the download — this is exactly what will be produced.
                </span>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <div className="flex rounded overflow-hidden border border-gray-300">
                        <button type="button" onClick={() => setLanguage('en')} disabled={busy} className={`px-2.5 py-1 text-xs font-semibold ${language === 'en' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700'}`}>EN</button>
                        <button type="button" onClick={() => setLanguage('ar')} disabled={busy} className={`px-2.5 py-1 text-xs font-semibold ${language === 'ar' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700'}`}>عربي</button>
                    </div>

                    <select
                        value={participantId}
                        onChange={e => setParticipantId(e.target.value)}
                        disabled={busy}
                        className="border border-gray-300 rounded px-2 py-1 text-xs bg-white max-w-[14rem]"
                        title="Whose certificate to draw"
                    >
                        <option value="__sample">Sample name</option>
                        {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    <button type="button" onClick={render} disabled={busy} className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50" title="Draw again">
                        <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <button type="button" onClick={openPdf} disabled={busy || !imageUrl} className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50">
                        <Eye className="h-3.5 w-3.5" /> Open as PDF
                    </button>
                    <button type="button" onClick={downloadPdf} disabled={busy || !imageUrl} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
                        <Download className="h-3.5 w-3.5" /> Download
                    </button>
                    <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-gray-100" aria-label="Close preview">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {note && (
                <div className="px-4 py-1.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border-b border-amber-200">{note}</div>
            )}

            <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
                {error ? (
                    <div className="bg-white rounded-lg p-6 max-w-md text-center">
                        <p className="font-semibold text-red-700 mb-2">Preview failed</p>
                        <p className="text-sm text-gray-600 mb-4">{error}</p>
                        <Button onClick={render}>Try again</Button>
                    </div>
                ) : (
                    <div className="relative" style={{ width: zoomed ? 'min(1600px, 200%)' : 'min(100%, calc((100vh - 140px) * 297 / 210))' }}>
                        {imageUrl && (
                            <img
                                src={imageUrl}
                                alt="Certificate preview"
                                onClick={() => setZoomed(z => !z)}
                                className={`w-full h-auto bg-white shadow-2xl ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'} ${busy ? 'opacity-40' : ''}`}
                            />
                        )}
                        {busy && (
                            <div className={`${imageUrl ? 'absolute inset-0' : 'bg-white rounded-lg shadow-2xl'} flex flex-col items-center justify-center gap-2`} style={imageUrl ? undefined : { aspectRatio: '297 / 210' }}>
                                <Spinner />
                                <span className="text-xs font-semibold text-gray-700 bg-white/90 rounded px-2 py-0.5">Rendering certificate…</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <p className="text-center text-[11px] text-slate-300 pb-2">Click the page to zoom. Esc closes.</p>
        </div>
    );
}

// -----------------------------------------------------------------------------
// FULL-PAGE CERTIFICATE DESIGNER
// Click an element on the canvas (or in the list) to select it, drag it to move
// it on both axes, and edit its text, colour, size and position in the side
// panel. Everything writes into the same customCertificate keys the PDF reads.
// -----------------------------------------------------------------------------

export function CertificateDesigner({
    course, onBack, onSaveSuccess, branding = APP_BRANDING,
    // scope.kind: 'course' (this course's own overrides), 'courseType' (the
    // template for scope.courseType) or 'general' (the template for everything).
    scope = { kind: 'course' },
    // For template scopes: the stored template config to start from.
    initialConfig = null,
    // Only used for the preview, so the manager's name matches a real download.
    federalProgramManagerName = ''
}) {
    const scopeKind = scope?.kind || 'course';
    const isTemplateScope = scopeKind !== 'course';
    const templateDocId = scopeKind === 'general'
        ? GENERAL_TEMPLATE_ID
        : scopeKind === 'courseType' ? courseTypeTemplateId(scope.courseType) : null;
    const excludedKeys = scopeKind === 'general'
        ? GENERAL_TEMPLATE_EXCLUDED_KEYS
        : scopeKind === 'courseType' ? TEMPLATE_EXCLUDED_KEYS : [];
    const scopeLabel = scopeKind === 'general'
        ? 'General template (all courses)'
        : scopeKind === 'courseType' ? `Course-type template: ${scope.courseType}` : 'This course only';

    const startingOwn = () => (isTemplateScope ? (initialConfig || {}) : (course?.customCertificate || {}));

    // ownData = what this layer stores. inherited = the layers beneath it.
    // data = what actually prints (inherited, then ownData on top); every
    // position / preview calculation reads `data`, every edit writes `ownData`.
    const [ownData, setOwnData] = useState(startingOwn);
    const [inherited, setInherited] = useState({});
    const data = useMemo(() => mergeCertificateConfigs(inherited, ownData), [inherited, ownData]);
    const [language, setLanguage] = useState('en');
    const [selectedId, setSelectedId] = useState('title');
    const [isSaving, setIsSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [zoom, setZoom] = useState('fit');
    const [showGuides, setShowGuides] = useState(true);
    const [showRealPreview, setShowRealPreview] = useState(false);
    const [gridPrefs, setGridPrefs] = useState(loadGridPrefs);
    const [activeGuides, setActiveGuides] = useState(null);
    const updateGridPrefs = (patch) => setGridPrefs(prev => {
        const next = { ...prev, ...patch };
        try { window.localStorage?.setItem(GRID_PREFS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
        return next;
    });
    const gridPrefsRef = useRef(gridPrefs);
    useEffect(() => { gridPrefsRef.current = gridPrefs; }, [gridPrefs]);

    const canvasRef = useRef(null);
    const [fitScale, setFitScale] = useState(0.5);
    const scaleRef = useRef(fitScale);
    const dragRef = useRef(null);

    const fileRef = useRef(null);
    const [activeUploadKey, setActiveUploadKey] = useState(null);
    const [uploadingAsset, setUploadingAsset] = useState(null);

    useEffect(() => { setOwnData(startingOwn()); setDirty(false); }, [course, initialConfig]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let alive = true;
        (async () => {
            let cfg = {};
            if (scopeKind === 'course') cfg = await loadInheritedCertificateConfig(course?.course_type);
            else if (scopeKind === 'courseType') cfg = await loadInheritedCertificateConfig(null); // general only
            if (alive) setInherited(cfg || {});
        })();
        return () => { alive = false; };
    }, [scopeKind, course?.course_type]);

    const scale = zoom === 'fit' ? fitScale : Number(zoom);
    useEffect(() => { scaleRef.current = scale; }, [scale]);

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const update = () => { const w = el.clientWidth; if (w > 0) setFitScale(w / PAGE_W_PX); };
        update();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
        }
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const set = useCallback((key, value) => {
        setOwnData(prev => ({ ...prev, [key]: value }));
        setDirty(true);
    }, []);

    const isArabic = language === 'ar';
    // Course-level signature images (manager, director, stamp) are not part of
    // `data`, so removing one has to be written to Firestore immediately. This
    // shadow layer lets the canvas reflect the removal without waiting for the
    // parent to hand down a refreshed course.
    const [courseOverrides, setCourseOverrides] = useState({});
    const liveCourse = useMemo(() => ({ ...(course || {}), ...courseOverrides }), [course, courseOverrides]);

    const hasStamp = !!liveCourse.approvedProgramStampUrl;
    // Resolved from the UNSAVED edits, not just the stored doc, so typing a name
    // makes the third/fourth signature appear on the canvas immediately.
    const sigInfo = useMemo(
        () => resolveCertificateSignatories({ ...liveCourse, customCertificate: data || {} }),
        [liveCourse, data]
    );
    const hasThirdParty = sigInfo.thirdPartyEnabled;
    const hasFourthParty = sigInfo.fourthPartyEnabled;
    // The sub-course that prints is the PARTICIPANT's, so look where the real
    // download looks: participant records first, then group assignments, then the
    // course. Otherwise the designer can hide a line that still prints.
    const [participantSubCourse, setParticipantSubCourse] = useState('');
    useEffect(() => {
        setParticipantSubCourse('');
        if (isTemplateScope || !course?.id) return;
        let alive = true;
        (async () => {
            try {
                const list = await listAllParticipantsForCourse(course.id, { source: navigator.onLine ? 'default' : 'cache' });
                const found = (list || []).find(p => !p.isDeleted && p.imci_sub_type)?.imci_sub_type || '';
                if (alive) setParticipantSubCourse(found);
            } catch (err) {
                console.warn('[Certificate designer] Could not check participant sub-courses.', err);
            }
        })();
        return () => { alive = false; };
    }, [course?.id, isTemplateScope]);

    const autoSubCourse = participantSubCourse
        || course?.facilitatorAssignments?.find(a => a.imci_sub_type)?.imci_sub_type
        || course?.director_imci_sub_type
        || '';
    const subCourseMode = data.subCourseMode || 'auto';
    const typedSubCourse = !!(data.subCourseEn || data.subCourseAr);
    const hasSubCourse = subCourseMode === 'hide'
        ? false
        : subCourseMode === 'customOnly'
            ? typedSubCourse
            : !!(autoSubCourse || course?.course_type === 'IMNCI' || typedSubCourse);

    // Mirrors the template's own signature geometry so the drag handles sit on
    // top of where the blocks actually render.
    const sigCount = 2 + (hasThirdParty ? 1 : 0) + (hasFourthParty ? 1 : 0);
    const defaultSideWidth = sigCount >= 4 ? 65 : sigCount === 3 ? 80 : CERT_DEFAULTS.signatureWidth;
    const sideWidth = readNum(data, 'signatureWidth', defaultSideWidth);
    const sideCentrePct = ((5 + sideWidth / 2) / 297) * 100;
    const slotFor = useCallback(
        (i) => sideCentrePct + ((100 - 2 * sideCentrePct) * i) / (sigCount - 1),
        [sideCentrePct, sigCount]
    );

    // Which signatories actually have an image to position. The manager/director
    // images live on the course document; the third/fourth may also be sitting in
    // the unsaved form state.
    const managerImg = !!liveCourse.approvedByManagerSignatureUrl;
    const directorImg = !!liveCourse.approvedDirectorSignatureUrl;
    const thirdImg = !!(data.thirdPartySignatureUrl || liveCourse.approvedThirdPartySignatureUrl);
    const fourthImg = !!(data.fourthPartySignatureUrl || liveCourse.approvedFourthPartySignatureUrl);

    const signatureImages = useMemo(() => {
        const mgrLeftKey = isArabic ? 'sigRightLeft' : 'sigLeftLeft';
        const dirLeftKey = isArabic ? 'sigLeftLeft' : 'sigRightLeft';
        const mgrLeftDef = slotFor(isArabic ? sigCount - 1 : 0);
        const dirLeftDef = slotFor(isArabic ? 0 : sigCount - 1);
        return [
            managerImg && { block: 'manager', label: 'Program Manager', blockLeftKey: mgrLeftKey, blockLeftDef: mgrLeftDef },
            directorImg && { block: 'director', label: 'Course Director', blockLeftKey: dirLeftKey, blockLeftDef: dirLeftDef },
            thirdImg && hasThirdParty && { block: 'third', label: 'Third signature', blockLeftKey: 'sigThirdLeft', blockLeftDef: slotFor(1) },
            fourthImg && hasFourthParty && { block: 'fourth', label: 'Fourth signature', blockLeftKey: 'sigFourthLeft', blockLeftDef: slotFor(hasFourthParty ? 2 : 1) }
        ].filter(Boolean);
    }, [isArabic, slotFor, sigCount, managerImg, directorImg, thirdImg, fourthImg, hasThirdParty, hasFourthParty]);

    // Values a per-element override falls back to. They are read from the live
    // edits, so the placeholder in each box always shows what the certificate
    // would actually print if that box were left blank.
    const sharedSigTop = readNum(data, 'signatureTop', CERT_DEFAULTS.signatureTop);
    const sharedNameFs = readNum(data, 'signatureNameFontSize', CERT_DEFAULTS.signatureNameFontSize);
    const sharedRoleFs = readNum(data, 'signatureRoleFontSize', CERT_DEFAULTS.signatureRoleFontSize);
    const thirdWidthDef = readNum(data, 'thirdSignatureWidth', defaultSideWidth);
    const logoTopDef = defaultLogoTop(data);
    const logoLeftFor = useCallback((slot) => defaultLogoLeft(data, slot, isArabic), [data, isArabic]);

    const hiddenLogos = useMemo(
        () => Object.fromEntries(LOGO_SLOTS.map(s => [s.n, !!data[`hideLogo${s.n}`]])),
        [data]
    );
    const ownExtraIds = getExtraLogoIds(ownData);
    const extraLogos = useMemo(() => getExtraLogoIds(data).map(id => ({
        id,
        label: data[xlogoKey(id, 'Label')] || '',
        src: data[xlogoKey(id, 'Src')] || '',
        hidden: !!data[xlogoKey(id, 'Hidden')],
        inherited: !ownExtraIds.includes(id)
    })), [data, ownExtraIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

    const addExtraLogo = () => {
        const id = newExtraLogoId();
        setOwnData(prev => ({
            ...prev,
            extraLogoIds: [...getExtraLogoIds(prev), id],
            [xlogoKey(id, 'Top')]: String(Math.round(logoTopDef)),
            [xlogoKey(id, 'Left')]: '50',
            [xlogoKey(id, 'Height')]: String(EXTRA_LOGO_DEFAULT_HEIGHT)
        }));
        setDirty(true);
        setSelectedId(`xlogo:${id}`);
    };

    const deleteExtraLogo = async (id) => {
        if (!await confirmDialog('Delete this logo from the template?')) return;
        setOwnData(prev => {
            const next = {};
            Object.entries(prev).forEach(([k, v]) => { if (!k.startsWith(`xlogo_${id}_`)) next[k] = v; });
            next.extraLogoIds = getExtraLogoIds(prev).filter(x => x !== id);
            return next;
        });
        setDirty(true);
        setSelectedId('logoRow');
    };

    const elements = useMemo(
        () => buildEditorElements({
            isArabic, hasStamp, hasThirdParty, hasFourthParty, hasSubCourse, slotFor, sigCount,
            subCourseMode, autoSubCourse,
            hideManager: !!data.hideManager, hideDirector: !!data.hideDirector,
            showSealNotice: !!data.showSealNotice, signatureImages,
            logoTopDef, logoLeftFor, hiddenLogos, extraLogos,
            sharedSigTop, sharedNameFs, sharedRoleFs,
            sideWidthDef: defaultSideWidth, thirdWidthDef
        }),
        [isArabic, hasStamp, hasThirdParty, hasFourthParty, hasSubCourse, slotFor, sigCount, subCourseMode, autoSubCourse,
         data.hideManager, data.hideDirector, data.showSealNotice, signatureImages,
         logoTopDef, logoLeftFor, hiddenLogos, extraLogos, sharedSigTop, sharedNameFs, sharedRoleFs, defaultSideWidth, thirdWidthDef]
    );

    const selected = elements.find(e => e.id === selectedId) || elements[0];

    // Text blocks that sit on top of each other (like a sub-course line under a
    // moved place/date block). Box sizes are the designer's estimates of each
    // block's printed footprint, so this is a warning, not a guarantee.
    const overlaps = useMemo(() => {
        const TEXT_IDS = ['header', 'title', 'name', 'completion', 'courseTitle', 'subCourse', 'placeDate', 'sealNotice'];
        const boxes = elements
            .filter(el => TEXT_IDS.includes(el.id) && !el.inactive)
            .map(el => {
                const top = readNum(data, el.topKey, el.topDef);
                const centre = el.leftKey ? readNum(data, el.leftKey, el.leftDef) : 50;
                return { el, top, bottom: top + el.box.heightMm, left: centre - el.box.widthPct / 2, right: centre + el.box.widthPct / 2 };
            });
        const pairs = [];
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i], b = boxes[j];
                const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                const horizontal = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                if (vertical > 1 && horizontal > 0) pairs.push([a.el, b.el]);
            }
        }
        return pairs;
    }, [elements, data]);
    const overlappingIds = useMemo(() => new Set(overlaps.flat().map(el => el.id)), [overlaps]);

    const previewCourse = useMemo(() => ({ ...liveCourse, customCertificate: data || {} }), [liveCourse, data]);

    // For the real preview: already layered with the unsaved edits, and marked
    // resolved so the pipeline doesn't re-read the stored copy over them.
    const realPreviewCourse = useMemo(() => ({
        ...liveCourse,
        customCertificate: data || {},
        __ownCustomCertificate: ownData,
        __certCourseResolved: true
    }), [liveCourse, data, ownData]);

    // Where each positioned element sits, in page millimetres. Used by the smart
    // guides and by the “Align” tools. Signature images are left out: they move
    // in their own block-relative frame.
    const anchorOf = useCallback((el) => {
        if (!el || el.axes || !el.topKey) return null;
        const top = readNum(data, el.topKey, el.topDef);
        const height = el.boxHeightKey ? readNum(data, el.boxHeightKey, el.boxHeightDef) : null;
        return {
            id: el.id,
            top,
            bottom: height !== null ? top + height : null,
            centreX: el.leftKey ? pctToMm(readNum(data, el.leftKey, el.leftDef)) : null
        };
    }, [data]);

    // --- dragging ---
    const onMove = useCallback((e) => {
        const d = dragRef.current;
        if (!d) return;
        const s = scaleRef.current;
        const dyMm = (e.clientY - d.startY) / (MM_TO_PX * s);
        const dxMm = (e.clientX - d.startX) / (MM_TO_PX * s);
        const clamp = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)));

        // Signature images use a different frame from the layout blocks: both axes
        // are in millimetres relative to their own block, and the vertical value is
        // a distance UP from the baseline, so dragging down has to decrease it.
        if (d.axes) {
            const a = d.axes;
            if (a.xKey) set(a.xKey, String(clamp(d.startX2 + dxMm, a.xMin, a.xMax)));
            if (a.yKey) set(a.yKey, String(clamp(d.startY2 + (a.yInvert ? -dyMm : dyMm), a.yMin, a.yMax)));
            return;
        }

        const prefs = gridPrefsRef.current;
        const grid = Number(prefs.gridSize) || 0;
        const clampF = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

        let top = d.startTop + dyMm;
        let centreX = d.leftKey ? pctToMm(d.startLeft) + dxMm : null;
        const guides = { v: [], h: [] };

        // 1. Snap to the grid.
        if (prefs.snapToGrid && grid > 0 && !e.altKey) {
            top = Math.round(top / grid) * grid;
            if (centreX !== null) centreX = Math.round(centreX / grid) * grid;
        }

        // 2. Smart guides win over the grid: line up with the page centre or with
        //    another element's top, bottom or centre. Hold Alt to move freely.
        if (prefs.smartGuides && !e.altKey) {
            const bestMatch = (value, candidates) => {
                let best = null;
                candidates.forEach(c => {
                    if (c === null || c === undefined) return;
                    const dist = Math.abs(c - value);
                    if (dist <= SNAP_THRESHOLD_MM && (!best || dist < best.dist)) best = { value: c, dist };
                });
                return best;
            };
            const heightMm = d.heightMm || 0;
            const yTargets = [PAGE_H_MM / 2];
            d.others.forEach(o => { yTargets.push(o.top); if (o.bottom !== null) yTargets.push(o.bottom); });

            const topHit = bestMatch(top, yTargets);
            const bottomHit = heightMm ? bestMatch(top + heightMm, yTargets) : null;
            if (topHit && (!bottomHit || topHit.dist <= bottomHit.dist)) {
                top = topHit.value; guides.h.push(topHit.value);
            } else if (bottomHit) {
                top = bottomHit.value - heightMm; guides.h.push(bottomHit.value);
            }

            if (centreX !== null) {
                const xTargets = [PAGE_W_MM / 2, ...d.others.map(o => o.centreX)];
                const xHit = bestMatch(centreX, xTargets);
                if (xHit) { centreX = xHit.value; guides.v.push(xHit.value); }
            }
        }

        set(d.topKey, String(round2(clampF(top, 0, 205))));
        if (d.leftKey && centreX !== null) {
            set(d.leftKey, String(round2(clampF(mmToPct(centreX), 0, 100))));
        }
        setActiveGuides(guides.v.length || guides.h.length ? guides : null);
    }, [set]);

    const onUp = useCallback(() => {
        dragRef.current = null;
        setActiveGuides(null);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
    }, [onMove]);

    const startDrag = (e, el) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedId(el.id);
        dragRef.current = el.axes
            ? {
                axes: el.axes,
                startY: e.clientY,
                startX: e.clientX,
                startX2: readNum(data, el.axes.xKey, el.axes.xDef),
                startY2: readNum(data, el.axes.yKey, el.axes.yDef)
            }
            : {
                topKey: el.topKey,
                leftKey: el.leftKey || null,
                heightMm: el.boxHeightKey ? readNum(data, el.boxHeightKey, el.boxHeightDef) : 0,
                // Snapshot of everything else on the page to align against.
                others: elements
                    .filter(o => o.id !== el.id && !o.inactive)
                    .map(anchorOf)
                    .filter(Boolean),
                startY: e.clientY,
                startX: e.clientX,
                startTop: readNum(data, el.topKey, el.topDef),
                startLeft: el.leftKey ? readNum(data, el.leftKey, el.leftDef) : null
            };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    useEffect(() => () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
    }, [onMove, onUp]);

    // Arrow keys nudge the selected element.
    useEffect(() => {
        const onKey = (e) => {
            if (!selected) return;
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
            const gridStep = Number(gridPrefsRef.current.gridSize) || 5;
            const step = e.shiftKey ? gridStep : 1;

            // Image elements move on their own mm axes, with the vertical value
            // measured upward, so Up must increase it.
            if (selected.axes) {
                const a = selected.axes;
                const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const cur = readNum(data, a.yKey, a.yDef);
                    set(a.yKey, String(clamp(cur + (e.key === 'ArrowUp' ? step : -step), a.yMin, a.yMax)));
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const cur = readNum(data, a.xKey, a.xDef);
                    set(a.xKey, String(clamp(cur + (e.key === 'ArrowRight' ? step : -step), a.xMin, a.xMax)));
                }
                return;
            }

            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const cur = readNum(data, selected.topKey, selected.topDef);
                set(selected.topKey, String(Math.min(205, Math.max(0, cur + (e.key === 'ArrowDown' ? step : -step)))));
            } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selected.leftKey) {
                e.preventDefault();
                const cur = readNum(data, selected.leftKey, selected.leftDef);
                set(selected.leftKey, String(Math.min(100, Math.max(0, cur + (e.key === 'ArrowRight' ? step : -step)))));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected, data, set]);

    // --- asset upload (signature / logo / stamp images) ---
    const triggerUpload = (key) => { setActiveUploadKey(key); fileRef.current?.click(); };
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !activeUploadKey) return;
        setUploadingAsset(activeUploadKey);
        try {
            // Signature images stay inline (never uploaded to Storage); decorative
            // logos are not sensitive and keep using Storage to save document space.
            const isSignature = /Signature/i.test(activeUploadKey);
            const url = isSignature
                ? await fileToSignatureDataUrl(file)
                : await uploadFile(
                    file,
                    isTemplateScope
                        ? `certificate_templates/${templateDocId}/${activeUploadKey}_${Date.now()}`
                        : `courses/${course.id}/certificate_assets/${activeUploadKey}_${Date.now()}`
                );
            set(activeUploadKey, url);
        } catch (err) {
            console.error(err);
            notify('Upload failed. Please try again.');
        } finally {
            setUploadingAsset(null);
            setActiveUploadKey(null);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const cleaned = cleanCertificateConfig(ownData, scopeKind);

            // Inline signatures live in this document, so guard the 1 MiB ceiling
            // with a readable message rather than letting Firestore reject it.
            const approxBytes = new Blob([JSON.stringify(cleaned)]).size;
            if (approxBytes > MAX_CUSTOM_CERT_BYTES) {
                notify(
                    `This template is too large to save (${Math.round(approxBytes / 1024)} KB, limit ${Math.round(MAX_CUSTOM_CERT_BYTES / 1024)} KB). ` +
                    `Signature images are stored inside the course record for security. ` +
                    `Remove or re-crop one of the signature images and try again.`
                );
                setIsSaving(false);
                return;
            }

            if (isTemplateScope) {
                await setDoc(doc(db, CERT_TEMPLATES_COLLECTION, templateDocId), {
                    scope: scopeKind,
                    courseType: scopeKind === 'courseType' ? scope.courseType : null,
                    config: cleaned,
                    updatedAt: serverTimestamp()
                });
                invalidateCertificateTemplateCache();
            } else {
                await updateDoc(doc(db, 'courses', course.id), {
                    customCertificate: cleaned,
                    lastUpdatedAt: serverTimestamp()
                });
            }
            setDirty(false);
            if (onSaveSuccess) onSaveSuccess();
            notify('Template saved.');
        } catch (err) {
            console.error(err);
            notify('Could not save the template. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Course scope only: push this course's overrides into a shared template so
    // other courses pick them up. The course's own overrides can then be cleared
    // (signature images and dates stay on the course either way).
    const promoteToTemplate = async (target) => {
        if (!course?.id || isTemplateScope) return;
        const kind = target === 'general' ? 'general' : 'courseType';
        if (kind === 'courseType' && !course.course_type) return;
        const id = kind === 'general' ? GENERAL_TEMPLATE_ID : courseTypeTemplateId(course.course_type);
        const targetName = kind === 'general' ? 'the GENERAL template (all courses)' : `the "${course.course_type}" template`;
        if (!await confirmDialog(`Copy this course's layout into ${targetName}? Settings already in that template are kept unless this course changes them.`)) return;

        setIsSaving(true);
        try {
            const snap = await getDoc(doc(db, CERT_TEMPLATES_COLLECTION, id));
            const existing = snap.exists() ? (snap.data().config || {}) : {};
            const config = cleanCertificateConfig(mergeCertificateConfigs(existing, ownData), kind);
            await setDoc(doc(db, CERT_TEMPLATES_COLLECTION, id), {
                scope: kind,
                courseType: kind === 'courseType' ? course.course_type : null,
                config,
                updatedAt: serverTimestamp()
            });
            invalidateCertificateTemplateCache();

            if (await confirmDialog('Saved to the template. Clear this course\'s own overrides so it simply follows the template now?')) {
                // Whatever the template could not take stays on the course.
                const courseOnlyKeys = kind === 'general' ? GENERAL_TEMPLATE_EXCLUDED_KEYS : TEMPLATE_EXCLUDED_KEYS;
                const keep = cleanCertificateConfig(
                    Object.fromEntries(Object.entries(ownData).filter(([k]) => courseOnlyKeys.includes(k))),
                    'course'
                );
                await updateDoc(doc(db, 'courses', course.id), { customCertificate: keep, lastUpdatedAt: serverTimestamp() });
                setOwnData(keep);
                setDirty(false);
            }
            const fresh = await loadInheritedCertificateConfig(course.course_type);
            setInherited(fresh || {});
            if (onSaveSuccess) onSaveSuccess();
        } catch (err) {
            console.error(err);
            notify('Could not save to the template. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBack = async () => {
        if (dirty && !await confirmDialog('You have unsaved changes. Leave without saving?')) return;
        onBack?.();
    };

    // Which stored fields hold each signatory's image. Manager/director/stamp are
    // course-level only; third/fourth are mirrored in customCertificate as well.
    const IMAGE_FIELDS = {
        manager: { courseKey: 'approvedByManagerSignatureUrl' },
        director: { courseKey: 'approvedDirectorSignatureUrl' },
        stamp: { courseKey: 'approvedProgramStampUrl' },
        third: { courseKey: 'approvedThirdPartySignatureUrl', customKey: 'thirdPartySignatureUrl' },
        fourth: { courseKey: 'approvedFourthPartySignatureUrl', customKey: 'fourthPartySignatureUrl' }
    };

    const [removingImage, setRemovingImage] = useState(null);

    /**
     * Deletes a signature or stamp image. This writes to Firestore straight away
     * rather than waiting for Save, because the course-level fields are not part
     * of the template `data` that Save persists — deferring would silently lose
     * the removal. The name and title are left alone; only the image goes.
     */
    const removeSignatureImage = async (block) => {
        const field = IMAGE_FIELDS[block];
        if (!field || !course?.id || isTemplateScope) return;
        if (!await confirmDialog('Remove this signature image? The stored image is deleted immediately and will have to be uploaded again.')) return;

        setRemovingImage(block);
        try {
            const payload = { lastUpdatedAt: serverTimestamp(), [field.courseKey]: null };
            if (field.customKey) payload[`customCertificate.${field.customKey}`] = deleteField();
            await updateDoc(doc(db, 'courses', course.id), payload);

            setCourseOverrides(prev => ({ ...prev, [field.courseKey]: null }));
            if (field.customKey) setOwnData(prev => ({ ...prev, [field.customKey]: '' }));
            if (onSaveSuccess) onSaveSuccess();
        } catch (err) {
            console.error(err);
            notify('Could not remove the image. Please try again.');
        } finally {
            setRemovingImage(null);
        }
    };

    // What colour this field would actually print if left blank. Mirrors the
    // template's own fallback chain so an empty swatch shows the inherited
    // colour rather than a misleading black.
    const effectiveColor = (key) => {
        if (key === 'signatureColor') return CERT_DEFAULTS.signatureColor;
        if (key === 'signatureRoleColor') return data.signatureColor || CERT_DEFAULTS.signatureColor;
        const m = key.match(/^(manager|director|third|fourth)Signature(Role)?Color$/);
        if (m) {
            if (m[2]) {
                return data.signatureRoleColor
                    || data[`${m[1]}SignatureColor`]
                    || data.signatureColor
                    || CERT_DEFAULTS.signatureColor;
            }
            return data.signatureColor || CERT_DEFAULTS.signatureColor;
        }
        return CERT_DEFAULTS[key] || '#000000';
    };

    // What a blank box falls back to: the inherited template value, else the default.
    const inh = (key, def) => readNum(inherited, key, def);

    const resetSelected = () => {
        if (!selected) return;
        const keys = [
            selected.topKey, selected.leftKey, selected.widthKey, selected.fontKey,
            ...(selected.colors || []).map(c => c.key),
            ...(selected.numbers || []).map(n => n.key),
            ...(selected.texts || []).map(t => t.key),
            ...(selected.checks || []).map(c => c.key),
            ...(selected.selects || []).map(c => c.key)
        ].filter(Boolean);
        setOwnData(prev => {
            const next = { ...prev };
            keys.forEach(k => { next[k] = ''; });
            return next;
        });
        setDirty(true);
    };

    return (
        <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col">
            <input type="file" ref={fileRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" />

            {/* ---- Site brand bar ---- */}
            <div className="bg-sky-800 text-white shrink-0">
                <div className="flex items-center gap-3 px-4 py-2">
                    {branding?.logoSrc && (
                        <img
                            src={branding.logoSrc}
                            alt=""
                            className="h-8 w-auto bg-white/95 rounded p-0.5 shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    )}
                    <div className="min-w-0 leading-tight">
                        <div className="text-sm font-bold truncate">{branding?.name}</div>
                        {branding?.subtitle && <div className="text-[11px] text-sky-200 truncate">{branding.subtitle}</div>}
                    </div>
                    <div className="ml-auto flex items-center gap-2 text-[11px] text-sky-100">
                        <Award className="h-4 w-4" />
                        <span className="hidden sm:inline">Certificate Designer</span>
                    </div>
                </div>
            </div>

            {/* ---- Page toolbar ---- */}
            <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm shrink-0">
                <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-gray-700 hover:bg-gray-100 border border-gray-300"
                >
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <div className="h-6 w-px bg-gray-200" />

                <nav className="min-w-0 text-xs text-gray-500 flex items-center gap-1.5 truncate">
                    <span className="hover:text-gray-700 cursor-pointer" onClick={handleBack}>Certificate Approvals</span>
                    <span className="text-gray-300">/</span>
                    <span className="font-semibold text-gray-800 truncate">
                        {scopeKind === 'general' ? 'General template' : scopeKind === 'courseType' ? `${scope.courseType} template` : (course?.course_type || 'Course')}
                    </span>
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isTemplateScope ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                        <Layers className="inline h-3 w-3 mr-0.5 -mt-0.5" />{scopeLabel}
                    </span>
                    {!isTemplateScope && (course?.state || course?.locality) && (
                        <span className="text-gray-400 truncate hidden md:inline">— {course?.state} {course?.locality}</span>
                    )}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    {dirty && <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span>}

                    <div className="flex rounded overflow-hidden border border-gray-300">
                        <button type="button" onClick={() => setLanguage('en')} className={`px-2.5 py-1 text-xs font-semibold ${!isArabic ? 'bg-sky-600 text-white' : 'bg-white text-gray-700'}`}>EN</button>
                        <button type="button" onClick={() => setLanguage('ar')} className={`px-2.5 py-1 text-xs font-semibold ${isArabic ? 'bg-sky-600 text-white' : 'bg-white text-gray-700'}`}>عربي</button>
                    </div>

                    <select
                        value={zoom}
                        onChange={e => setZoom(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                    >
                        <option value="fit">Fit</option>
                        <option value="0.5">50%</option>
                        <option value="0.75">75%</option>
                        <option value="1">100%</option>
                    </select>

                    <div className="flex items-center gap-1.5 border border-gray-300 rounded px-2 py-0.5 bg-white">
                        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none" title="Show the grid, rulers and centre lines">
                            <input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} />
                            Grid
                        </label>
                        <select
                            value={String(gridPrefs.gridSize)}
                            onChange={e => updateGridPrefs({ gridSize: Number(e.target.value) })}
                            className="text-xs bg-transparent outline-none"
                            title="Grid spacing"
                        >
                            <option value="0">Centre lines only</option>
                            <option value="2">2 mm</option>
                            <option value="5">5 mm</option>
                            <option value="10">10 mm</option>
                            <option value="20">20 mm</option>
                        </select>
                        <span className="h-4 w-px bg-gray-200" />
                        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none" title="Moved elements jump to the nearest grid line">
                            <input type="checkbox" checked={!!gridPrefs.snapToGrid} disabled={!gridPrefs.gridSize} onChange={e => updateGridPrefs({ snapToGrid: e.target.checked })} />
                            Snap
                        </label>
                        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none" title="Pink lines appear and the element locks on when it lines up with another element or the page centre">
                            <input type="checkbox" checked={!!gridPrefs.smartGuides} onChange={e => updateGridPrefs({ smartGuides: e.target.checked })} />
                            Smart guides
                        </label>
                        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none" title="Millimetre labels along the edges">
                            <input type="checkbox" checked={!!gridPrefs.showRulers} onChange={e => updateGridPrefs({ showRulers: e.target.checked })} />
                            mm
                        </label>
                    </div>

                    {!isTemplateScope && (
                        <select
                            value=""
                            disabled={isSaving}
                            onChange={e => { const v = e.target.value; e.target.value = ''; if (v) promoteToTemplate(v); }}
                            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                            title="Copy this layout into a shared template"
                        >
                            <option value="">Save as template…</option>
                            {course?.course_type && <option value="courseType">For all {course.course_type} courses</option>}
                            <option value="general">As the general template</option>
                        </select>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowRealPreview(true)}
                        disabled={!!uploadingAsset}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold border border-sky-600 text-sky-700 bg-white hover:bg-sky-50 disabled:opacity-50"
                        title="Render the actual certificate, exactly as the PDF will be"
                    >
                        <Eye className="h-4 w-4" /> Preview certificate
                    </button>

                    <Button variant="secondary" onClick={handleBack} disabled={isSaving}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={isSaving || !!uploadingAsset}>
                        {isSaving ? <Spinner size="sm" /> : 'Save Template'}
                    </Button>
                </div>
            </header>

            {showRealPreview && (
                <CertificatePreviewModal
                    course={realPreviewCourse}
                    federalProgramManagerName={federalProgramManagerName || liveCourse.approvedByManagerName || ''}
                    defaultLanguage={language}
                    onClose={() => setShowRealPreview(false)}
                    note={[
                        dirty ? 'Includes your unsaved changes.' : '',
                        isTemplateScope ? 'Template preview: uses a sample course, so no signatures or stamp are shown.' : ''
                    ].filter(Boolean).join(' ')}
                />
            )}

            <div className="flex-1 flex min-h-0">
                {/* ---- Element list ---- */}
                <aside className="w-52 shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
                    <div className="px-3 py-2 border-b flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Elements</span>
                        <button
                            type="button"
                            onClick={addExtraLogo}
                            className="flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900 border border-sky-200 rounded px-1.5 py-0.5 hover:bg-sky-50"
                            title="Add a logo placeholder"
                        >
                            <Plus className="h-3 w-3" /> Add logo
                        </button>
                    </div>
                    <p className="px-3 py-2 text-[10px] leading-snug text-gray-500 bg-gray-50 border-b">
                        {scopeKind === 'general' && 'Applies to every course unless a course-type template or the course itself changes it.'}
                        {scopeKind === 'courseType' && `Applies to every ${scope.courseType} course. Blank boxes follow the general template.`}
                        {scopeKind === 'course' && 'Changes here apply to this course only. Blank boxes follow the course-type and general templates.'}
                    </p>
                    {elements.map(el => (
                        <button
                            key={el.id}
                            type="button"
                            onClick={() => setSelectedId(el.id)}
                            className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 flex items-center gap-2 ${selectedId === el.id ? 'bg-sky-50 text-sky-800 font-semibold border-l-4 border-l-sky-600' : el.inactive ? 'text-gray-400 hover:bg-gray-50' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                            <span className="truncate">{el.label}</span>
                            {el.inactive && <span className="ml-auto text-[10px] border border-gray-300 rounded px-1 text-gray-500">add</span>}
                            {!el.inactive && overlappingIds.has(el.id) && <span className="ml-auto text-[10px] font-bold text-red-600" title="Overlaps another element">overlap</span>}
                        </button>
                    ))}
                </aside>

                {/* ---- Canvas ---- */}
                <main className="flex-1 min-w-0 overflow-auto p-6 bg-gray-200">
                    <div
                        ref={canvasRef}
                        className="mx-auto bg-white shadow-lg"
                        style={{ width: zoom === 'fit' ? '100%' : PAGE_W_PX * scale, maxWidth: '100%', position: 'relative', height: PAGE_H_PX * scale, touchAction: 'none' }}
                    >
                        <div
                            style={{
                                width: PAGE_W_PX, height: PAGE_H_PX,
                                transform: `scale(${scale})`, transformOrigin: 'top left',
                                position: 'absolute', top: 0, left: 0, pointerEvents: 'none'
                            }}
                        >
                            <CertificateTemplate
                                course={previewCourse}
                                participant={{ name: isArabic ? 'اسم المشارك' : 'Participant Name', id: 'preview' }}
                                federalProgramManagerName={liveCourse.approvedByManagerName || ''}
                                participantSubCourse={autoSubCourse || null}
                                language={language}
                                programManagerSignatureUrl={liveCourse.approvedByManagerSignatureUrl || null}
                                directorName={liveCourse.approvedDirectorName || liveCourse.director || ''}
                                directorSignatureUrl={liveCourse.approvedDirectorSignatureUrl || null}
                                programStampUrl={liveCourse.approvedProgramStampUrl || null}
                                thirdPartySignatureUrl={liveCourse.approvedThirdPartySignatureUrl || null}
                                fourthPartySignatureUrl={liveCourse.approvedFourthPartySignatureUrl || null}
                                showPlaceholders
                            />
                        </div>

                        {(showGuides || activeGuides) && (
                            <GridOverlay
                                gridSize={showGuides ? Number(gridPrefs.gridSize) || 0 : 0}
                                showRulers={showGuides && gridPrefs.showRulers}
                                guides={activeGuides}
                            />
                        )}

                        {elements.filter(el => !el.inactive).map(el => {
                            const isSel = selectedId === el.id;

                            let topMm, leftPct, boxW, boxH;

                            if (el.imageOf) {
                                // Reconstruct where the <img> lands: it is anchored to the
                                // BOTTOM of its block's text, which is the name line plus the
                                // role line, then lifted by `...ImageBottom` millimetres.
                                const b = el.imageOf;
                                const px = (k, sharedK) => readNum(data, `${b}${k}`, readNum(data, sharedK, CERT_DEFAULTS[sharedK]));
                                const imgW = px('SignatureImageWidth', 'signatureImageWidth');
                                const imgH = px('SignatureImageHeight', 'signatureImageHeight');
                                const imgBottom = px('SignatureImageBottom', 'signatureImageBottom');
                                const imgOffsetX = px('SignatureImageOffsetX', 'signatureImageOffsetX');

                                // Text sizes and the row height are read per block, since each
                                // signature can now carry its own.
                                const nameFs = readNum(data, `${b}SignatureNameFontSize`, readNum(data, 'signatureNameFontSize', CERT_DEFAULTS.signatureNameFontSize));
                                const roleFs = readNum(data, `${b}SignatureRoleFontSize`, readNum(data, 'signatureRoleFontSize', CERT_DEFAULTS.signatureRoleFontSize));
                                const textMm = ((nameFs + roleFs) * 1.25) / MM_TO_PX + 1;

                                const blockTop = readNum(data, `${b}SignatureTop`, readNum(data, 'signatureTop', CERT_DEFAULTS.signatureTop));
                                const blockLeft = readNum(data, el.blockLeftKey, el.blockLeftDef);

                                topMm = blockTop + textMm - imgBottom - imgH;
                                leftPct = blockLeft + (imgOffsetX / 297) * 100;
                                boxW = imgW * MM_TO_PX * scale;
                                boxH = imgH * MM_TO_PX * scale;
                            } else {
                                topMm = readNum(data, el.topKey, el.topDef);
                                leftPct = el.leftKey ? readNum(data, el.leftKey, el.leftDef) : 50;
                                boxW = el.box.widthMm
                                    ? el.box.widthMm * MM_TO_PX * scale
                                    : (el.box.widthPct / 100) * PAGE_W_PX * scale;
                                const hMm = el.boxHeightKey ? readNum(data, el.boxHeightKey, el.boxHeightDef) : el.box.heightMm;
                                if (el.boxHeightKey) boxW = Math.max(hMm * 1.2, 12) * MM_TO_PX * scale;
                                boxH = Math.max(16, hMm * MM_TO_PX * scale);
                            }

                            return (
                                <div
                                    key={el.id}
                                    onPointerDown={(e) => startDrag(e, el)}
                                    title={`${el.label} — drag to move`}
                                    style={{
                                        position: 'absolute',
                                        top: topMm * MM_TO_PX * scale,
                                        left: `calc(${leftPct}% - ${boxW / 2}px)`,
                                        width: boxW,
                                        height: Math.max(12, boxH),
                                        cursor: 'move',
                                        zIndex: isSel ? 45 : (el.imageOf ? 35 : 30),
                                        border: `1px ${isSel ? 'solid' : 'dashed'} ${isSel ? '#0284c7' : overlappingIds.has(el.id) ? '#dc2626' : el.imageOf ? 'rgba(217,119,6,0.65)' : 'rgba(2,132,199,0.4)'}`,
                                        background: isSel ? 'rgba(2,132,199,0.16)' : overlappingIds.has(el.id) ? 'rgba(220,38,38,0.12)' : (el.imageOf ? 'rgba(217,119,6,0.10)' : 'rgba(2,132,199,0.04)'),
                                        borderRadius: 3
                                    }}
                                >
                                    {isSel && (
                                        <span style={{
                                            position: 'absolute', top: -16, left: -1,
                                            fontSize: 9, lineHeight: '15px', padding: '0 5px',
                                            background: '#0284c7', color: 'white',
                                            borderRadius: '3px 3px 0 0', whiteSpace: 'nowrap'
                                        }}>
                                            {el.imageOf
                                                ? `${el.label} · ${readNum(data, el.axes.yKey, el.axes.yDef)}mm up · ${readNum(data, el.axes.xKey, el.axes.xDef)}mm across`
                                                : `${el.label} · ${Math.round(topMm)}mm${el.leftKey ? ` · ${Math.round(leftPct)}%` : ''}`}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {overlaps.length > 0 && (
                        <div className="max-w-3xl mx-auto mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                            <span className="font-bold">Overlapping on the certificate: </span>
                            {overlaps.map(([a, b], i) => (
                                <span key={`${a.id}-${b.id}`}>
                                    {i > 0 && ' · '}
                                    <button type="button" className="underline font-semibold" onClick={() => setSelectedId(a.id)}>{a.label}</button>
                                    {' and '}
                                    <button type="button" className="underline font-semibold" onClick={() => setSelectedId(b.id)}>{b.label}</button>
                                </span>
                            ))}
                            <span className="text-red-600"> — move one of them, or hide the line you don’t need.</span>
                        </div>
                    )}

                    <p className="text-center text-xs text-gray-500 mt-3">
                        Drag any box to move it — pink lines show when it lines up with something (hold Alt to move freely).
                        Arrow keys nudge by 1mm, Shift+Arrow by one grid step.
                    </p>
                </main>

                {/* ---- Properties panel ---- */}
                <aside className="w-80 shrink-0 bg-white border-l border-gray-200 overflow-y-auto p-4">
                    {selected && (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-gray-900">{selected.label}</h3>
                                <button type="button" onClick={resetSelected} className="text-[11px] text-gray-500 hover:text-red-600 underline">Reset</button>
                            </div>

                            {selected.inactive && (
                                <p className="text-[11px] font-semibold text-amber-700 mb-3 bg-amber-50 border border-amber-200 rounded p-2">
                                    {selected.inactiveNote || 'Not on the certificate yet. Enter a name below (or upload a signature image) and it will appear.'}
                                </p>
                            )}

                            {selected.note && <p className="text-[11px] text-gray-500 mb-3 bg-gray-50 border border-gray-200 rounded p-2">{selected.note}</p>}

                            <PropRow label="Vertical position" hint="Millimetres from the top of the page (0–210)">
                                <StepField
                                    value={ownData[selected.topKey]}
                                    defaultValue={inh(selected.topKey, selected.topDef)}
                                    min={0} max={205} unit="mm"
                                    onChange={v => set(selected.topKey, v)}
                                />
                            </PropRow>

                            {selected.leftKey && (
                                <PropRow label="Horizontal position" hint="Centre of the element, as % of page width">
                                    <StepField
                                        value={ownData[selected.leftKey]}
                                        defaultValue={inh(selected.leftKey, selected.leftDef)}
                                        min={0} max={100} unit="%"
                                        onChange={v => set(selected.leftKey, v)}
                                    />
                                </PropRow>
                            )}

                            {!selected.axes && selected.topKey && (() => {
                                const targets = elements.filter(o => o.id !== selected.id && !o.inactive && !o.axes && o.topKey);
                                const withHeight = targets.filter(o => o.boxHeightKey);
                                const alignTo = (mode, targetId) => {
                                    const t = anchorOf(elements.find(o => o.id === targetId));
                                    if (!t) return;
                                    if (mode === 'top') set(selected.topKey, String(round2(t.top)));
                                    if (mode === 'bottom' && t.bottom !== null) {
                                        const h = readNum(data, selected.boxHeightKey, selected.boxHeightDef);
                                        set(selected.topKey, String(round2(t.bottom - h)));
                                    }
                                    if (mode === 'centre' && t.centreX !== null && selected.leftKey) {
                                        set(selected.leftKey, String(round2(mmToPct(t.centreX))));
                                    }
                                };
                                const AlignSelect = ({ mode, label, options }) => (
                                    <select
                                        value=""
                                        onChange={e => { const v = e.target.value; if (v) alignTo(mode, v); }}
                                        className="w-full border rounded px-1.5 py-1 text-xs bg-white"
                                    >
                                        <option value="">{label}</option>
                                        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                    </select>
                                );
                                return (
                                    <PropRow label="Align" hint="Lines this element up with another one. Logos align best by top or bottom edge.">
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {selected.leftKey && (
                                                <button type="button" onClick={() => set(selected.leftKey, '50')} className="border rounded px-1.5 py-1 text-xs hover:bg-gray-100">
                                                    ⇔ Centre on page
                                                </button>
                                            )}
                                            {gridPrefs.gridSize > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const g = Number(gridPrefs.gridSize);
                                                        const a = anchorOf(selected);
                                                        set(selected.topKey, String(Math.round(a.top / g) * g));
                                                        if (selected.leftKey && a.centreX !== null) set(selected.leftKey, String(round2(mmToPct(Math.round(a.centreX / g) * g))));
                                                    }}
                                                    className="border rounded px-1.5 py-1 text-xs hover:bg-gray-100"
                                                >
                                                    ⌗ Snap to grid
                                                </button>
                                            )}
                                            <AlignSelect mode="top" label="Top with…" options={targets} />
                                            {selected.leftKey && (
                                                <AlignSelect mode="centre" label="Centre with…" options={targets.filter(o => o.leftKey)} />
                                            )}
                                            {selected.boxHeightKey && withHeight.length > 0 && (
                                                <AlignSelect mode="bottom" label="Bottom with…" options={withHeight} />
                                            )}
                                        </div>
                                    </PropRow>
                                );
                            })()}

                            {selected.widthKey && (
                                <PropRow label="Block width" hint="Wider blocks wrap less; narrower blocks wrap sooner">
                                    <StepField
                                        value={ownData[selected.widthKey]}
                                        defaultValue={inh(selected.widthKey, selected.widthDef)}
                                        min={10} max={100} unit="%"
                                        onChange={v => set(selected.widthKey, v)}
                                    />
                                </PropRow>
                            )}

                            {selected.fontKey && (
                                <PropRow label="Font size">
                                    <StepField
                                        value={ownData[selected.fontKey]}
                                        defaultValue={inh(selected.fontKey, selected.fontDef)}
                                        min={6} max={140} unit="px"
                                        onChange={v => set(selected.fontKey, v)}
                                    />
                                </PropRow>
                            )}

                            {(selected.numbers || []).map(n => (
                                <PropRow key={n.key} label={n.label}>
                                    <StepField
                                        value={ownData[n.key]}
                                        defaultValue={inh(n.key, n.def)}
                                        min={n.min} max={n.max} step={n.step || 1}
                                        onChange={v => set(n.key, v)}
                                    />
                                </PropRow>
                            ))}

                            {(selected.selects || []).map(sel => {
                                const inheritedValue = inherited[sel.key] || sel.def;
                                const inheritedLabel = sel.options.find(o => o.value === inheritedValue)?.label || inheritedValue;
                                return (
                                    <PropRow key={sel.key} label={sel.label}>
                                        <select
                                            value={ownData[sel.key] || ''}
                                            onChange={e => set(sel.key, e.target.value)}
                                            className="w-full border rounded px-2 py-1 text-sm bg-white"
                                        >
                                            <option value="">{isTemplateScope && scopeKind === 'general' ? 'Default' : 'Inherit'}: {inheritedLabel}</option>
                                            {sel.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </PropRow>
                                );
                            })}

                            {(selected.checks || []).map(c => (
                                <label key={c.key} className="flex items-center gap-2 mb-2 text-sm text-gray-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={!!data[c.key]}
                                        onChange={e => set(c.key, e.target.checked)}
                                    />
                                    {c.label}
                                </label>
                            ))}

                            {(selected.colors || []).map(c => (
                                <PropRow key={c.key} label={c.label}>
                                    <ColorField
                                        value={ownData[c.key]}
                                        defaultValue={inherited[c.key] || effectiveColor(c.key)}
                                        onChange={v => set(c.key, v)}
                                    />
                                </PropRow>
                            ))}

                            {(selected.texts || []).filter(t => !excludedKeys.includes(t.key)).map(t => (
                                <PropRow key={t.key} label={t.label}>
                                    {t.multiline ? (
                                        <textarea
                                            dir={t.rtl ? 'rtl' : 'ltr'}
                                            value={ownData[t.key] || ''}
                                            placeholder={inherited[t.key] || t.placeholder}
                                            onChange={e => set(t.key, e.target.value)}
                                            className="w-full border rounded p-2 text-sm h-24"
                                        />
                                    ) : (
                                        <input
                                            dir={t.rtl ? 'rtl' : 'ltr'}
                                            value={ownData[t.key] || ''}
                                            placeholder={inherited[t.key] || t.placeholder}
                                            onChange={e => set(t.key, e.target.value)}
                                            className="w-full border rounded px-2 py-1 text-sm"
                                        />
                                    )}
                                </PropRow>
                            ))}

                            {selected.dates && !isTemplateScope && (
                                <div className="border-t pt-3 mt-3">
                                    <PropRow label="Start date">
                                        <input type="date" value={data.dateStart || ''} onChange={e => set('dateStart', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                                    </PropRow>
                                    <PropRow label="End date">
                                        <input type="date" value={data.dateEnd || ''} min={data.dateStart || undefined} onChange={e => set('dateEnd', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                                    </PropRow>
                                    {data.dateStart && (
                                        <p className="text-xs bg-gray-50 border rounded p-2">
                                            <span className="text-gray-500 mr-1">Prints as</span>
                                            <span dangerouslySetInnerHTML={{ __html: formatCertificateDateRange(data.dateStart, data.dateEnd, isArabic) }} />
                                        </p>
                                    )}
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            type="button"
                                            className="text-[11px] underline text-sky-700"
                                            onClick={() => {
                                                const start = course?.start_date || '';
                                                const dur = Number(course?.course_duration) || 1;
                                                setOwnData(prev => ({ ...prev, dateStart: start, dateEnd: addDaysISO(start, dur - 1) }));
                                                setDirty(true);
                                            }}
                                        >Fill from course</button>
                                        <button
                                            type="button"
                                            className="text-[11px] underline text-gray-500"
                                            onClick={() => { setOwnData(prev => ({ ...prev, dateStart: '', dateEnd: '' })); setDirty(true); }}
                                        >Clear</button>
                                    </div>
                                </div>
                            )}

                            {!isTemplateScope && (selected.imageOf || selected.id === 'stamp') && (
                                <PropRow label="Stored image">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {(() => {
                                            const blk = selected.imageOf || 'stamp';
                                            const f = IMAGE_FIELDS[blk];
                                            const src = (f.customKey && data[f.customKey]) || liveCourse[f.courseKey] || null;
                                            return src
                                                ? <img src={src} alt="" className="h-10 border rounded bg-white px-1" />
                                                : <span className="text-xs text-gray-400">None</span>;
                                        })()}
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            className="text-xs"
                                            disabled={!!removingImage}
                                            onClick={() => removeSignatureImage(selected.imageOf || 'stamp')}
                                        >
                                            {removingImage === (selected.imageOf || 'stamp') ? <Spinner size="sm" /> : 'Remove image'}
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        Deletes the stored image straight away — it is not part of Save. The name and title stay.
                                    </p>
                                </PropRow>
                            )}

                            {isTemplateScope && selected.signatureKey && (
                                <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded p-2 mb-3">
                                    Signature images are never stored in a shared template. Upload them on each course.
                                </p>
                            )}

                            {!isTemplateScope && selected.signatureKey && (() => {
                                const blk = selected.signatureKey === 'fourthPartySignatureUrl' ? 'fourth' : 'third';
                                const courseKey = IMAGE_FIELDS[blk].courseKey;
                                const src = data[selected.signatureKey] || liveCourse[courseKey] || null;
                                return (
                                    <PropRow label="Signature image">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {src
                                                ? <img src={src} alt="" className="h-8 border rounded bg-white px-1" />
                                                : <span className="text-xs text-gray-400">None</span>}
                                            <Button size="sm" variant="secondary" className="text-xs" onClick={() => triggerUpload(selected.signatureKey)} disabled={!!uploadingAsset || !!removingImage}>
                                                {uploadingAsset === selected.signatureKey ? <Spinner size="sm" /> : (src ? 'Replace' : 'Upload')}
                                            </Button>
                                            {src && (
                                                // Clears BOTH copies. Clearing only the customCertificate
                                                // key would leave the approved* fallback in place and the
                                                // signature would keep printing.
                                                <Button size="sm" variant="danger" className="text-xs" disabled={!!removingImage} onClick={() => removeSignatureImage(blk)}>
                                                    {removingImage === blk ? <Spinner size="sm" /> : 'Remove'}
                                                </Button>
                                            )}
                                        </div>
                                    </PropRow>
                                );
                            })()}

                            {selected.logoKey && (
                                <div className="border-t pt-3 mt-3">
                                    <PropRow label="Image" hint="Blank uses the built-in default logo.">
                                        <div className="flex items-center gap-2">
                                            {data[selected.logoKey] && <img src={data[selected.logoKey]} alt="" className="h-8 border rounded bg-white" />}
                                            <Button size="sm" variant="secondary" className="text-xs" onClick={() => triggerUpload(selected.logoKey)} disabled={!!uploadingAsset}>
                                                {uploadingAsset === selected.logoKey ? <Spinner size="sm" /> : (data[selected.logoKey] ? 'Replace' : 'Upload')}
                                            </Button>
                                            {ownData[selected.logoKey] && (
                                                <button type="button" onClick={() => set(selected.logoKey, '')} className="text-[11px] text-red-600 underline">Remove</button>
                                            )}
                                        </div>
                                        {!ownData[selected.logoKey] && inherited[selected.logoKey] && (
                                            <p className="text-[11px] text-gray-400 mt-1">Image comes from a template. Upload to replace it here, or tick “Hide this logo”.</p>
                                        )}
                                    </PropRow>
                                    {selected.extraLogoId && (
                                        selected.extraInherited ? (
                                            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded p-2">
                                                Added by a template. Edit that template to delete it, or hide it here.
                                            </p>
                                        ) : (
                                            <Button size="sm" variant="danger" className="text-xs flex items-center gap-1" onClick={() => deleteExtraLogo(selected.extraLogoId)}>
                                                <Trash2 className="h-3 w-3" /> Delete this logo
                                            </Button>
                                        )
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// COMPONENT: CertificateCustomizerModal
// -----------------------------------------------------------------------------
export function CertificateCustomizerModal({ isOpen, onClose, course, onSaveSuccess, onOpenDesigner }) {
    const [data, setData] = useState({});
    
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingAsset, setUploadingAsset] = useState(null);
    const fileRef = useRef(null);
    const [activeUploadKey, setActiveUploadKey] = useState(null);
    const [previewLang, setPreviewLang] = useState('en');
    const [showPreview, setShowPreview] = useState(true);
    const [editorMode, setEditorMode] = useState('form');

    useEffect(() => {
        if (isOpen && course) {
            setData(course.customCertificate || {});
        }
    }, [isOpen, course]);

    const handleInputChange = (field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    // Mirrors the certificate's own visibility rule so the modal can never claim
    // something different from what actually gets printed.
    const thirdPartyHasContent = !!firstFilled(data.thirdPartyNameEn, data.thirdPartyNameAr, data.thirdPartySignatureUrl);
    const thirdPartyWillPrint = thirdPartyHasContent && data.thirdPartyEnabled !== false;

    const handleFileTrigger = (key) => {
        setActiveUploadKey(key);
        if (fileRef.current) fileRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeUploadKey) return;
        const key = activeUploadKey;
        setUploadingAsset(key);
        try {
            const isSignature = /Signature/i.test(key);
            const url = isSignature
                ? await fileToSignatureDataUrl(file)
                : await uploadFile(file, `courses/${course.id}/logos/${key}_${Date.now()}`);
            setData(prev => ({ ...prev, [key]: url }));
        } catch (err) {
            notify("Upload failed: " + err.message);
        } finally {
            setUploadingAsset(null);
            setActiveUploadKey(null);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Drop empty strings so the template falls back to system defaults cleanly.
            const cleaned = Object.fromEntries(
                Object.entries(data).filter(([, v]) => !(v === '' || v === undefined || v === null))
            );

            await updateDoc(doc(db, 'courses', course.id), {
                customCertificate: cleaned,
                lastUpdatedAt: serverTimestamp()
            });
            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (err) {
            notify("Failed to save template: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClear = async () => {
        if (await confirmDialog("Revert to the default template? This erases every custom override for this course.")) {
            setData({});
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={isSaving ? null : onClose} title="Customize Certificate Template" size="2xl">
            <input type="file" ref={fileRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" />
            <CardBody className="p-6 max-h-[70vh] overflow-y-auto space-y-6">

                <div className="flex items-center gap-1 border-b border-gray-200 -mx-6 px-6 -mt-6 pt-4 pb-0 sticky top-0 z-30 bg-white">
                    <button
                        type="button"
                        onClick={() => setEditorMode('form')}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-t border-b-2 ${editorMode === 'form' ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >Edit fields</button>
                    <button
                        type="button"
                        onClick={() => setEditorMode('drag')}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-t border-b-2 ${editorMode === 'drag' ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >Designer (full screen)</button>
                    <div className="ml-auto flex rounded overflow-hidden border border-gray-300 mb-1">
                        <button
                            type="button"
                            onClick={() => setPreviewLang('en')}
                            className={`px-2 py-0.5 text-xs font-semibold ${previewLang === 'en' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700'}`}
                        >EN</button>
                        <button
                            type="button"
                            onClick={() => setPreviewLang('ar')}
                            className={`px-2 py-0.5 text-xs font-semibold ${previewLang === 'ar' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700'}`}
                        >عربي</button>
                    </div>
                </div>

                {editorMode === 'drag' ? (
                    <div className="text-center py-10">
                        <p className="text-sm text-gray-700 mb-1 font-semibold">Full-screen Certificate Designer</p>
                        <p className="text-xs text-gray-500 mb-5 max-w-md mx-auto">
                            Drag elements on a large canvas, pick colours, resize logos and edit text with everything
                            visible at once. Unsaved changes here are kept.
                        </p>
                        <Button variant="primary" onClick={() => onOpenDesigner?.()}>Open the Designer</Button>
                    </div>
                ) : (
                <>

                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Live Preview</span>
                        <button
                            type="button"
                            onClick={() => setShowPreview(p => !p)}
                            className="text-xs font-semibold text-sky-700 hover:underline"
                        >{showPreview ? 'Hide' : 'Show'}</button>
                    </div>
                    {showPreview && <LiveCertificatePreview course={course} data={data} language={previewLang} />}
                    {showPreview && (
                        <p className="text-[11px] text-gray-500 mt-1">
                            Updates as you type. Participant name and QR code are placeholders. Use the “Drag &amp; drop layout” tab to move things by hand.
                        </p>
                    )}
                </div>
                
                <div className="bg-sky-50 p-4 rounded-lg text-sm text-sky-800 mb-4 border border-sky-100">
                    <p className="font-semibold mb-1">Customize Template for: {course?.course_type}</p>
                    <p>Leave a field blank to use the default system value (FMOH/NCHP logos, computed place and date, default text). Everything set here applies to this course only.</p>
                </div>

                <div>
                    <h3 className="font-bold border-b pb-2 mb-3">1. Custom Logos</h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Every logo is uploaded, moved and sized on its own. Leave a position box blank and that logo
                        follows the shared logo row (section 8) and the centre of its side of the page.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {LOGO_SLOTS.map(slot => (
                            <div key={slot.imageKey} className="space-y-2">
                                <AssetUploader
                                    label={`${slot.label} (Default: ${slot.defaultName})`}
                                    fieldKey={slot.imageKey}
                                    value={data[slot.imageKey]}
                                    uploading={uploadingAsset === slot.imageKey}
                                    onPick={handleFileTrigger}
                                    onClear={k => handleInputChange(k, '')}
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <FormGroup label="Top mm">
                                        <Input
                                            type="number"
                                            value={data[`logo${slot.n}Top`] ?? ''}
                                            onChange={e => handleInputChange(`logo${slot.n}Top`, e.target.value)}
                                            placeholder={String(defaultLogoTop(data))}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Left %">
                                        <Input
                                            type="number"
                                            value={data[`logo${slot.n}Left`] ?? ''}
                                            onChange={e => handleInputChange(`logo${slot.n}Left`, e.target.value)}
                                            placeholder={String(Math.round(defaultLogoLeft(data, slot, previewLang === 'ar')))}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Height mm">
                                        <Input
                                            type="number"
                                            value={data[slot.heightKey] ?? ''}
                                            onChange={e => handleInputChange(slot.heightKey, e.target.value)}
                                            placeholder={String(CERT_DEFAULTS[slot.heightKey])}
                                        />
                                    </FormGroup>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="font-bold border-b pb-2 mb-3 mt-6">2. Headers & Main Titles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormGroup label="Header Text (English)">
                            <textarea className="w-full border rounded p-2 text-sm h-24" value={data.headerEn || ''} onChange={e => handleInputChange('headerEn', e.target.value)} placeholder="Republic of Sudan&#10;Federal Ministry of Health..." />
                        </FormGroup>
                        <FormGroup label="Header Text (Arabic) - نص الرأسية">
                            <textarea className="w-full border rounded p-2 text-sm h-24 text-right" dir="rtl" value={data.headerAr || ''} onChange={e => handleInputChange('headerAr', e.target.value)} placeholder="جمهورية السودان&#10;وزارة الصحة الاتحادية..." />
                        </FormGroup>
                        <FormGroup label="Certificate Label (English)"><Input value={data.titleEn || ''} onChange={e => handleInputChange('titleEn', e.target.value)} placeholder="CERTIFICATE" /></FormGroup>
                        <FormGroup label="Certificate Label (Arabic) - عنوان الشهادة"><Input dir="rtl" value={data.titleAr || ''} onChange={e => handleInputChange('titleAr', e.target.value)} placeholder="شهادة" /></FormGroup>
                        <FormGroup label="Completion Text (English)"><Input value={data.completionTextEn || ''} onChange={e => handleInputChange('completionTextEn', e.target.value)} placeholder="Has successfully completed:" /></FormGroup>
                        <FormGroup label="Completion Text (Arabic) - نص الإكمال"><Input dir="rtl" value={data.completionTextAr || ''} onChange={e => handleInputChange('completionTextAr', e.target.value)} placeholder="أكمل/ت بنجاح الدورة التدريبية على : " /></FormGroup>
                    </div>
                </div>

                <div>
                    <h3 className="font-bold border-b pb-2 mb-3 mt-6">3. Course Name Overrides</h3>
                    <p className="text-xs text-gray-500 mb-3">
                        The sub-course line prints in brackets under the course title. It works on any course, not only
                        the ones that carry a sub-type, and filling in one language alone makes that wording print in both.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormGroup label="Main Course Title (English)"><Input value={data.courseTitleEn || ''} onChange={e => handleInputChange('courseTitleEn', e.target.value)} placeholder="Default used if empty" /></FormGroup>
                        <FormGroup label="Main Course Title (Arabic)"><Input dir="rtl" value={data.courseTitleAr || ''} onChange={e => handleInputChange('courseTitleAr', e.target.value)} placeholder="الافتراضي يستخدم اذا كان فارغ" /></FormGroup>
                        <FormGroup label="Sub-course Title (English)"><Input value={data.subCourseEn || ''} onChange={e => handleInputChange('subCourseEn', e.target.value)} placeholder="Leave blank for default" /></FormGroup>
                        <FormGroup label="Sub-course Title (Arabic)"><Input dir="rtl" value={data.subCourseAr || ''} onChange={e => handleInputChange('subCourseAr', e.target.value)} placeholder="يترك فارغاً للافتراضي" /></FormGroup>
                    </div>
                </div>

                <div>
                    <h3 className="font-bold border-b pb-2 mb-3 mt-6">4. Place & Date</h3>
                    <p className="text-xs text-gray-500 mb-3">Blank keeps the automatic values: place comes from the course state and hall, date is calculated from the start date and duration.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormGroup label="Place (English)"><Input value={data.placeEn || ''} onChange={e => handleInputChange('placeEn', e.target.value)} placeholder="e.g. Khartoum - Grand Hall" /></FormGroup>
                        <FormGroup label="Place (Arabic) - المكان"><Input dir="rtl" value={data.placeAr || ''} onChange={e => handleInputChange('placeAr', e.target.value)} placeholder="مثال: الخرطوم - القاعة الكبرى" /></FormGroup>
                        <FormGroup label="Place Label (English)"><Input value={data.placeLabelEn || ''} onChange={e => handleInputChange('placeLabelEn', e.target.value)} placeholder="Place : " /></FormGroup>
                        <FormGroup label="Place Label (Arabic)"><Input dir="rtl" value={data.placeLabelAr || ''} onChange={e => handleInputChange('placeLabelAr', e.target.value)} placeholder="المكان : " /></FormGroup>

                        <FormGroup label="Date Label (English)"><Input value={data.dateLabelEn || ''} onChange={e => handleInputChange('dateLabelEn', e.target.value)} placeholder="Date : " /></FormGroup>
                        <FormGroup label="Date Label (Arabic)"><Input dir="rtl" value={data.dateLabelAr || ''} onChange={e => handleInputChange('dateLabelAr', e.target.value)} placeholder="التاريخ : " /></FormGroup>
                    </div>

                    <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-800 mb-1">Course dates</p>
                        <p className="text-xs text-gray-500 mb-3">
                            Pick the start and end dates from the calendar. They are formatted automatically for each
                            language — ordinal suffixes in English, Arabic month names in Arabic — and the month or year
                            is collapsed when both dates share one. Leave blank to use the dates calculated from the
                            course record.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormGroup label="Start date">
                                <Input
                                    type="date"
                                    value={data.dateStart || ''}
                                    onChange={e => handleInputChange('dateStart', e.target.value)}
                                />
                            </FormGroup>
                            <FormGroup label="End date">
                                <Input
                                    type="date"
                                    value={data.dateEnd || ''}
                                    min={data.dateStart || undefined}
                                    onChange={e => handleInputChange('dateEnd', e.target.value)}
                                />
                            </FormGroup>
                        </div>

                        {data.dateStart && data.dateEnd && data.dateEnd < data.dateStart && (
                            <p className="text-xs font-semibold text-red-600 mt-2">
                                The end date is before the start date.
                            </p>
                        )}

                        {data.dateStart && (
                            <div className="mt-3 text-sm bg-white border border-gray-200 rounded p-2">
                                <span className="text-xs text-gray-500 uppercase tracking-wide mr-2">Prints as</span>
                                <span dangerouslySetInnerHTML={{ __html: formatCertificateDateRange(data.dateStart, data.dateEnd, previewLang === 'ar') }} />
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-3">
                            <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs"
                                disabled={!course?.start_date}
                                onClick={() => {
                                    const start = course?.start_date || '';
                                    const dur = Number(course?.course_duration) || 1;
                                    setData(prev => ({ ...prev, dateStart: start, dateEnd: addDaysISO(start, dur - 1) }));
                                }}
                            >Fill from course record</Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs"
                                onClick={() => setData(prev => ({ ...prev, dateStart: '', dateEnd: '' }))}
                            >Clear dates</Button>
                        </div>

                        <details className="mt-3">
                            <summary className="text-xs text-gray-600 cursor-pointer">Type the date manually instead</summary>
                            <p className="text-xs text-gray-500 mt-2 mb-2">
                                Only used when no start date is picked above. Useful for wording the calendar can't
                                produce, such as “Every Tuesday, January – June 2026”.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormGroup label="Date text (English)"><Input value={data.dateEn || ''} onChange={e => handleInputChange('dateEn', e.target.value)} placeholder="e.g. 3rd - 7th March 2026" disabled={!!data.dateStart} /></FormGroup>
                                <FormGroup label="Date text (Arabic) - التاريخ"><Input dir="rtl" value={data.dateAr || ''} onChange={e => handleInputChange('dateAr', e.target.value)} placeholder="مثال: 3 - 7 مارس 2026" disabled={!!data.dateStart} /></FormGroup>
                            </div>
                        </details>
                    </div>
                    <div className="flex flex-wrap gap-6 mt-3">
                        <CheckRow label="Hide place line" checked={data.hidePlace} onChange={v => handleInputChange('hidePlace', v)} />
                        <CheckRow label="Hide date line" checked={data.hideDate} onChange={v => handleInputChange('hideDate', v)} />
                    </div>
                </div>

                <div>
                    <h3 className="font-bold border-b pb-2 mb-3 mt-6">5. Signatories</h3>

                    <div className="flex flex-wrap gap-6 mb-4">
                        <CheckRow label="No honorific prefix" hint="Removes Dr. / د. in front of both names" checked={data.hideHonorific} onChange={v => handleInputChange('hideHonorific', v)} />
                        <CheckRow label="Hide course director" checked={data.hideDirector} onChange={v => handleInputChange('hideDirector', v)} />
                        <CheckRow label="Hide national program manager" checked={data.hideManager} onChange={v => handleInputChange('hideManager', v)} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormGroup label="Honorific (English)"><Input value={data.honorificEn || ''} onChange={e => handleInputChange('honorificEn', e.target.value)} placeholder="Dr." disabled={!!data.hideHonorific} /></FormGroup>
                        <FormGroup label="Honorific (Arabic)"><Input dir="rtl" value={data.honorificAr || ''} onChange={e => handleInputChange('honorificAr', e.target.value)} placeholder="د." disabled={!!data.hideHonorific} /></FormGroup>

                        <FormGroup label="Course Director Name (English)"><Input value={data.directorTitleEn || ''} onChange={e => handleInputChange('directorTitleEn', e.target.value)} placeholder="e.g. Omer Ali" /></FormGroup>
                        <FormGroup label="Course Director Name (Arabic)"><Input dir="rtl" value={data.directorTitleAr || ''} onChange={e => handleInputChange('directorTitleAr', e.target.value)} placeholder="اسم مدير الدورة" /></FormGroup>
                        <FormGroup label="Course Director Title (English)"><Input value={data.directorRoleEn || ''} onChange={e => handleInputChange('directorRoleEn', e.target.value)} placeholder="Course Director" /></FormGroup>
                        <FormGroup label="Course Director Title (Arabic)"><Input dir="rtl" value={data.directorRoleAr || ''} onChange={e => handleInputChange('directorRoleAr', e.target.value)} placeholder="مدير الدورة" /></FormGroup>

                        <FormGroup label="National Program Manager Name (English)"><Input value={data.managerTitleEn || ''} onChange={e => handleInputChange('managerTitleEn', e.target.value)} placeholder="e.g. Ali Ahmed" /></FormGroup>
                        <FormGroup label="National Program Manager Name (Arabic)"><Input dir="rtl" value={data.managerTitleAr || ''} onChange={e => handleInputChange('managerTitleAr', e.target.value)} placeholder="اسم مدير البرنامج" /></FormGroup>
                        <FormGroup label="National Program Manager Title (English)"><Input value={data.managerRoleEn || ''} onChange={e => handleInputChange('managerRoleEn', e.target.value)} placeholder="National Program Manager" /></FormGroup>
                        <FormGroup label="National Program Manager Title (Arabic)"><Input dir="rtl" value={data.managerRoleAr || ''} onChange={e => handleInputChange('managerRoleAr', e.target.value)} placeholder="مدير البرنامج" /></FormGroup>
                    </div>
                </div>

                <div>
                    <h3 className="font-bold border-b pb-2 mb-3 mt-6">6. Third Signature (centre bottom)</h3>
                    <p className="text-xs text-gray-500 mb-3">Adds a third signatory between the director and the program manager — for a partner organisation, donor, or state ministry.</p>

                    <CheckRow
                        label="Add a third signature"
                        hint="Prints as soon as a name or a signature image is provided"
                        checked={thirdPartyWillPrint || !!data.thirdPartyEnabled}
                        onChange={v => handleInputChange('thirdPartyEnabled', v)}
                    />

                    <div className={`mt-2 text-xs font-semibold ${thirdPartyWillPrint ? 'text-green-700' : 'text-amber-700'}`}>
                        {thirdPartyWillPrint
                            ? 'This third signature WILL be printed on the certificate.'
                            : data.thirdPartyEnabled === false
                                ? 'Turned off — it will not be printed.'
                                : 'Not printed yet: enter a name or upload a signature image below.'}
                    </div>

                    {(data.thirdPartyEnabled || thirdPartyHasContent) && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormGroup label="Third Party Name (English)"><Input value={data.thirdPartyNameEn || ''} onChange={e => handleInputChange('thirdPartyNameEn', e.target.value)} placeholder="e.g. Dr. Sara Mohamed" /></FormGroup>
                            <FormGroup label="Third Party Name (Arabic)"><Input dir="rtl" value={data.thirdPartyNameAr || ''} onChange={e => handleInputChange('thirdPartyNameAr', e.target.value)} placeholder="اسم ممثل الجهة" /></FormGroup>
                            <FormGroup label="Third Party Title (English)"><Input value={data.thirdPartyRoleEn || ''} onChange={e => handleInputChange('thirdPartyRoleEn', e.target.value)} placeholder="Partner Representative" /></FormGroup>
                            <FormGroup label="Third Party Title (Arabic)"><Input dir="rtl" value={data.thirdPartyRoleAr || ''} onChange={e => handleInputChange('thirdPartyRoleAr', e.target.value)} placeholder="ممثل الجهة الشريكة" /></FormGroup>
                            <div className="md:col-span-2">
                                <AssetUploader
                                    label="Third Party Signature Image"
                                    fieldKey="thirdPartySignatureUrl"
                                    value={data.thirdPartySignatureUrl}
                                    uploading={uploadingAsset === 'thirdPartySignatureUrl'}
                                    onPick={handleFileTrigger}
                                    onClear={k => handleInputChange(k, '')}
                                    height="h-16"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="font-bold border-b pb-2 mb-3 mt-6">7. Font Sizes (pixels)</h3>
                    <p className="text-xs text-gray-500 mb-3">Leave blank to use the default size for each title.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormGroup label={`Header text (default ${CERT_DEFAULTS.headerFontSizeEn}/${CERT_DEFAULTS.headerFontSizeAr})`}>
                            <Input type="number" min="8" value={data.headerFontSize ?? ''} onChange={e => handleInputChange('headerFontSize', e.target.value)} placeholder={String(CERT_DEFAULTS.headerFontSizeEn)} />
                        </FormGroup>
                        <FormGroup label={`"CERTIFICATE" title (default ${CERT_DEFAULTS.titleFontSize})`}>
                            <Input type="number" min="8" value={data.titleFontSize ?? ''} onChange={e => handleInputChange('titleFontSize', e.target.value)} placeholder={String(CERT_DEFAULTS.titleFontSize)} />
                        </FormGroup>
                        <FormGroup label={`Participant name (default ${CERT_DEFAULTS.nameFontSize})`}>
                            <Input type="number" min="8" value={data.nameFontSize ?? ''} onChange={e => handleInputChange('nameFontSize', e.target.value)} placeholder={String(CERT_DEFAULTS.nameFontSize)} />
                        </FormGroup>
                        <FormGroup label={`Completion line (default ${CERT_DEFAULTS.completionFontSize})`}>
                            <Input type="number" min="8" value={data.completionFontSize ?? ''} onChange={e => handleInputChange('completionFontSize', e.target.value)} placeholder={String(CERT_DEFAULTS.completionFontSize)} />
                        </FormGroup>
                        <FormGroup label={`Course title (default ${CERT_DEFAULTS.courseTitleFontSize})`}>
                            <Input type="number" min="8" value={data.courseTitleFontSize ?? ''} onChange={e => handleInputChange('courseTitleFontSize', e.target.value)} placeholder={String(CERT_DEFAULTS.courseTitleFontSize)} />
                        </FormGroup>
                        <FormGroup label={`Sub-course line (default ${CERT_DEFAULTS.subCourseFontSize})`}>
                            <Input type="number" min="8" value={data.subCourseFontSize ?? ''} onChange={e => handleInputChange('subCourseFontSize', e.target.value)} placeholder={String(CERT_DEFAULTS.subCourseFontSize)} />
                        </FormGroup>
                        <FormGroup label={`Place & date (default ${CERT_DEFAULTS.placeDateFontSize})`}>
                            <Input type="number" min="8" value={data.placeDateFontSize ?? ''} onChange={e => handleInputChange('placeDateFontSize', e.target.value)} placeholder={String(CERT_DEFAULTS.placeDateFontSize)} />
                        </FormGroup>
                        <FormGroup label={`Signature names (default ${CERT_DEFAULTS.signatureNameFontSize})`}>
                            <Input type="number" min="8" value={data.signatureNameFontSize ?? ''} onChange={e => handleInputChange('signatureNameFontSize', e.target.value)} placeholder={String(CERT_DEFAULTS.signatureNameFontSize)} />
                        </FormGroup>
                        <FormGroup label={`Signature titles (default ${CERT_DEFAULTS.signatureRoleFontSize})`}>
                            <Input type="number" min="8" value={data.signatureRoleFontSize ?? ''} onChange={e => handleInputChange('signatureRoleFontSize', e.target.value)} placeholder={String(CERT_DEFAULTS.signatureRoleFontSize)} />
                        </FormGroup>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Signature sizes apply to all three signatories. Lower the title size if a long role caption wraps past the border.</p>
                </div>

                <div>
                    <h3 className="font-bold border-b pb-2 mb-3 mt-6">8. Vertical Spacing (millimetres from top)</h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Use ▲ / ▼ to nudge a line up or down by 1mm, or type an exact value. Blank uses the default.
                        The page is 210mm tall, so keep values between 0 and 210 and in increasing order down the page.
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setData(prev => ({
                                ...prev,
                                logoTop: '22', headerTop: '12', titleTop: '55', nameTop: '86',
                                completionTop: '104', courseTitleTop: '116', subCourseTop: '131',
                                placeDateTop: '145', qrTop: '55', signatureTop: '172'
                            }))}
                            className="text-xs"
                        >Preset: more breathing room</Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setData(prev => {
                                const next = { ...prev };
                                [
                                    'logoTop','headerTop','titleTop','nameTop','completionTop','courseTitleTop',
                                    'subCourseTop','placeDateTop','qrTop','signatureTop',
                                    // per-logo and per-signature overrides go back to following the row
                                    'logo1Top','logo2Top','logo3Top','logo4Top',
                                    'logo1Left','logo2Left','logo3Left','logo4Left',
                                    'managerSignatureTop','directorSignatureTop','thirdSignatureTop','fourthSignatureTop'
                                ].forEach(k => { next[k] = ''; });
                                return next;
                            })}
                            className="text-xs"
                        >Reset spacing to defaults</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <div>
                            <NudgeRow label="Logos" fieldKey="logoTop" value={data.logoTop} defaultValue={CERT_DEFAULTS.logoTop} onChange={handleInputChange} />
                            <NudgeRow label="Header text" fieldKey="headerTop" value={data.headerTop} defaultValue={CERT_DEFAULTS.headerTop} onChange={handleInputChange} />
                            <NudgeRow label='"CERTIFICATE" title' fieldKey="titleTop" value={data.titleTop} defaultValue={CERT_DEFAULTS.titleTop} onChange={handleInputChange} />
                            <NudgeRow label="Participant name" fieldKey="nameTop" value={data.nameTop} defaultValue={CERT_DEFAULTS.nameTop} onChange={handleInputChange} />
                            <NudgeRow label="QR code" fieldKey="qrTop" value={data.qrTop} defaultValue={CERT_DEFAULTS.qrTop} onChange={handleInputChange} />
                        </div>
                        <div>
                            <NudgeRow label="Completion line" fieldKey="completionTop" value={data.completionTop} defaultValue={CERT_DEFAULTS.completionTop} onChange={handleInputChange} />
                            <NudgeRow label="Course title" fieldKey="courseTitleTop" value={data.courseTitleTop} defaultValue={CERT_DEFAULTS.courseTitleTop} onChange={handleInputChange} />
                            <NudgeRow label="Sub-course line" fieldKey="subCourseTop" value={data.subCourseTop} defaultValue={CERT_DEFAULTS.subCourseTop} onChange={handleInputChange} />
                            <NudgeRow label="Place & date" fieldKey="placeDateTop" value={data.placeDateTop} defaultValue={CERT_DEFAULTS.placeDateTop} onChange={handleInputChange} />
                            <NudgeRow label="Signature row" fieldKey="signatureTop" value={data.signatureTop} defaultValue={CERT_DEFAULTS.signatureTop} onChange={handleInputChange} />
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="font-bold border-b pb-2 mb-3 mt-6">9. Signature & Stamp Layout (millimetres)</h3>

                    <p className="text-xs text-gray-500 mb-2">
                        Each signature can sit at its own height, width and text size. Blank boxes follow the shared
                        signature row above, so you only fill in the ones you want to move.
                    </p>
                    <div className="overflow-x-auto mb-5">
                        <table className="w-full text-xs border border-gray-200 rounded">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-left font-semibold px-2 py-1.5">Signature</th>
                                    <th className="font-semibold px-2 py-1.5">Top (mm)</th>
                                    <th className="font-semibold px-2 py-1.5">Width (mm)</th>
                                    <th className="font-semibold px-2 py-1.5">Name (px)</th>
                                    <th className="font-semibold px-2 py-1.5">Title (px)</th>
                                    <th className="font-semibold px-2 py-1.5">Image lift (mm)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { block: 'manager', label: 'Program Manager' },
                                    { block: 'director', label: 'Course Director' },
                                    { block: 'third', label: 'Third signature' },
                                    { block: 'fourth', label: 'Fourth signature' }
                                ].map(({ block, label }) => (
                                    <tr key={block} className="border-t border-gray-100">
                                        <td className="px-2 py-1.5 font-medium text-gray-700 whitespace-nowrap">{label}</td>
                                        {[
                                            { key: `${block}SignatureTop`, ph: data.signatureTop || CERT_DEFAULTS.signatureTop },
                                            { key: `${block}SignatureWidth`, ph: (block === 'third' || block === 'fourth') ? (data.thirdSignatureWidth || CERT_DEFAULTS.thirdSignatureWidth) : (data.signatureWidth || CERT_DEFAULTS.signatureWidth) },
                                            { key: `${block}SignatureNameFontSize`, ph: data.signatureNameFontSize || CERT_DEFAULTS.signatureNameFontSize },
                                            { key: `${block}SignatureRoleFontSize`, ph: data.signatureRoleFontSize || CERT_DEFAULTS.signatureRoleFontSize },
                                            { key: `${block}SignatureImageBottom`, ph: data.signatureImageBottom || CERT_DEFAULTS.signatureImageBottom }
                                        ].map(({ key, ph }) => (
                                            <td key={key} className="px-1 py-1">
                                                <input
                                                    type="number"
                                                    value={data[key] ?? ''}
                                                    onChange={e => handleInputChange(key, e.target.value)}
                                                    placeholder={String(ph)}
                                                    className="w-full text-center border rounded px-1 py-0.5 text-xs"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="text-[11px] text-gray-500 mt-1">
                            “Image lift” is how far the scanned signature is raised above its name — smaller sits closer
                            to the name, larger floats it higher.
                        </p>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">Fine-tune the shared widths if the third signature and the stamp overlap. The page is 297 × 210 mm.</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <FormGroup label="Side signature width"><Input type="number" value={data.signatureWidth ?? ''} onChange={e => handleInputChange('signatureWidth', e.target.value)} placeholder={thirdPartyWillPrint ? '80' : String(CERT_DEFAULTS.signatureWidth)} /></FormGroup>
                        <FormGroup label="Third signature width"><Input type="number" value={data.thirdSignatureWidth ?? ''} onChange={e => handleInputChange('thirdSignatureWidth', e.target.value)} placeholder={String(CERT_DEFAULTS.thirdSignatureWidth)} /></FormGroup>
                        <FormGroup label="Stamp top"><Input type="number" value={data.stampTop ?? ''} onChange={e => handleInputChange('stampTop', e.target.value)} placeholder={data.thirdPartyEnabled ? '168' : '162'} /></FormGroup>
                        <FormGroup label="Stamp left (%)"><Input type="number" value={data.stampLeft ?? ''} onChange={e => handleInputChange('stampLeft', e.target.value)} placeholder="50" /></FormGroup>
                        <FormGroup label="Stamp width"><Input type="number" value={data.stampWidth ?? ''} onChange={e => handleInputChange('stampWidth', e.target.value)} placeholder={data.thirdPartyEnabled ? '32' : '40'} /></FormGroup>
                        <FormGroup label="Stamp opacity"><Input type="number" step="0.05" min="0" max="1" value={data.stampOpacity ?? ''} onChange={e => handleInputChange('stampOpacity', e.target.value)} placeholder={data.thirdPartyEnabled ? '0.55' : '0.9'} /></FormGroup>
                    </div>
                </div>
                </>
                )}

            </CardBody>
            <CardFooter className="flex justify-between items-center bg-gray-50 border-t">
                <Button variant="danger" onClick={handleClear} disabled={isSaving}>Revert to Defaults</Button>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={isSaving || !!uploadingAsset}>
                        {isSaving ? <Spinner size="sm" /> : 'Save Template'}
                    </Button>
                </div>
            </CardFooter>
        </Modal>
    );
}

// ============================================================================
// PUBLIC & ADMIN CERTIFICATE VIEWS
// ============================================================================

export function CertificateVerificationView({ participant, course }) {
    if (!participant || !course) return <EmptyState message="Invalid certificate data." />;
    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg text-center border border-gray-100">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6 shadow-inner">
                <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Certificate Verified</h2>
            <p className="text-gray-600 mb-4 font-medium">This certificate was authentically issued to:</p>
            <h3 className="text-2xl font-black text-sky-700 mb-2">{participant.name}</h3>
            <p className="text-sm text-gray-500 mb-6 font-semibold uppercase tracking-wider">For completing: {course.course_type}</p>
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-left text-sm text-gray-700 space-y-2">
                <p className="flex justify-between border-b border-gray-200 pb-2"><strong className="text-gray-500 uppercase tracking-wide text-xs">Course Location:</strong> <span className="font-bold">{course.state} - {course.locality}</span></p>
                <p className="flex justify-between"><strong className="text-gray-500 uppercase tracking-wide text-xs">Date:</strong> <span className="font-bold">{course.start_date}</span></p>
            </div>
        </div>
    );
}

export function PublicCertificateDownloadView({ participantId }) {
    const { facilitators, federalCoordinators, fetchFacilitators, fetchFederalCoordinators } = useDataCache();
    useEffect(() => { fetchFacilitators(); fetchFederalCoordinators(); }, []);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const p = await getParticipantById(participantId, 'server');
                if (!p) throw new Error("Participant not found.");
                const c = await getCourseById(p.courseId, 'server');
                if (!c) throw new Error("Course not found.");
                if (!c.isCertificateApproved) throw new Error("Certificates for this course are not yet approved or have been revoked.");
                setData({ participant: p, course: c });
            } catch(e) { setError(e.message); }
            finally { setLoading(false); }
        };
        load();
    }, [participantId]);

    const handleDownload = async (lang) => {
        setDownloading(true);
        try {
            const managerName = data.course.approvedByManagerName || "Federal Program Manager";
            let subcourse = data.participant.imci_sub_type || data.course.director_imci_sub_type;
            const canvas = await generateCertificatePdf(data.course, data.participant, managerName, subcourse, lang, facilitators, federalCoordinators);
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 297, 210);
                await saveAndOpenPdf(doc, `Certificate_${data.participant.name.replace(/\s+/g, '_')}_${lang}.pdf`);
            }
        } catch(e) { notify("Download failed: " + e.message); }
        finally { setDownloading(false); }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;

    return (
        <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-2xl shadow-xl text-center border border-gray-100">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-sky-100 mb-6 shadow-inner">
                <Award className="h-10 w-10 text-sky-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Download Certificate</h2>
            <p className="text-gray-500 mb-6 text-sm">Participant:</p>
            <h3 className="text-xl font-bold text-sky-700 mb-8">{data.participant.name}</h3>
            <div className="flex flex-col gap-3">
                <Button onClick={() => handleDownload('en')} disabled={downloading} className="w-full justify-center shadow-md">
                    {downloading ? <Spinner size="sm" /> : 'Download (English)'}
                </Button>
                <Button onClick={() => handleDownload('ar')} disabled={downloading} variant="secondary" className="w-full justify-center">
                    {downloading ? <Spinner size="sm" /> : 'Download (Arabic - عربي)'}
                </Button>
            </div>
        </div>
    );
}

export function PublicCourseCertificatesView({ courseId }) {
    const { facilitators, federalCoordinators, fetchFacilitators, fetchFederalCoordinators } = useDataCache();
    useEffect(() => { fetchFacilitators(); fetchFederalCoordinators(); }, []);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const c = await getCourseById(courseId, 'server');
                if (!c) throw new Error("Course not found.");
                if (!c.isCertificateApproved) throw new Error("Certificates for this course are not yet approved or have been revoked.");
                const parts = await listAllParticipantsForCourse(courseId, { source: 'server' });
                const activeParts = parts.filter(p => !p.isDeleted);
                setData({ course: c, participants: activeParts });
            } catch(e) { setError(e.message); }
            finally { setLoading(false); }
        };
        load();
    }, [courseId]);

    const handleDownload = async (p, lang) => {
        setDownloadingId(p.id);
        try {
            const managerName = data.course.approvedByManagerName || "Federal Program Manager";
            let subcourse = p.imci_sub_type || data.course.director_imci_sub_type;
            const canvas = await generateCertificatePdf(data.course, p, managerName, subcourse, lang, facilitators, federalCoordinators);
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 297, 210);
                await saveAndOpenPdf(doc, `Certificate_${p.name.replace(/\s+/g, '_')}_${lang}.pdf`);
            }
        } catch(e) { notify("Download failed: " + e.message); }
        finally { setDownloadingId(null); }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;

    return (
        <Card className="p-6">
            <PageHeader title="Course Certificates" subtitle={`${data.course.course_type} - ${data.course.state} / ${data.course.locality}`} />
            
            <div className="bg-sky-50 text-sky-800 p-4 rounded-lg text-sm border border-sky-100 mb-6 flex items-start">
                <Award className="w-5 h-5 mr-3 shrink-0" />
                <p>Welcome. You can download certificates for any active participant from this course using the buttons below.</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <Table headers={["Participant Name", "Job Title", "Download Action"]}>
                    {data.participants.map(p => (
                        <tr key={p.id} className="hover:bg-sky-50/50 transition-colors">
                            <td className="p-4 font-bold text-gray-800">{p.name}</td>
                            <td className="p-4 text-gray-600 font-medium">{p.job_title}</td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <Button size="sm" onClick={() => handleDownload(p, 'en')} disabled={!!downloadingId}>
                                    {downloadingId === p.id ? <Spinner size="sm" /> : 'English'}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => handleDownload(p, 'ar')} disabled={!!downloadingId}>
                                    {downloadingId === p.id ? <Spinner size="sm" /> : 'عربي'}
                                </Button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// APPROVAL DIALOG: signatory preview row
// -----------------------------------------------------------------------------

const ApprovalSignatoryRow = ({ position, roleEn, roleAr, nameEn, nameAr, isCustom, isHidden }) => (
    <div className={`p-3 rounded-lg border ${isHidden ? 'bg-gray-100 border-gray-200 opacity-70' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{position}</span>
            {isCustom && !isHidden && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">Customized</span>
            )}
            {isHidden && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Hidden</span>
            )}
        </div>
        {isHidden ? (
            <p className="text-sm text-gray-500 italic">Not printed on this certificate.</p>
        ) : (
            <>
                <p className="text-sm font-bold text-gray-900">{nameEn || <span className="text-red-600 font-medium">Missing</span>}</p>
                <p className="text-xs text-gray-500">{roleEn}</p>
                <p className="text-sm font-bold text-gray-900 mt-2 text-right" dir="rtl">{nameAr || <span className="text-red-600 font-medium">غير محدد</span>}</p>
                <p className="text-xs text-gray-500 text-right" dir="rtl">{roleAr}</p>
            </>
        )}
    </div>
);

// -----------------------------------------------------------------------------
// TEMPLATES PANEL — general template + one template per course type
// -----------------------------------------------------------------------------

const templateSummary = (tpl) => {
    const cfg = tpl?.config || {};
    const n = Object.keys(cfg).filter(k => k !== 'extraLogoIds').length;
    const logos = getExtraLogoIds(cfg).length;
    if (!tpl) return 'Not set — built-in layout';
    return `${n} setting${n === 1 ? '' : 's'}${logos ? ` · ${logos} extra logo${logos === 1 ? '' : 's'}` : ''}`;
};

const CertificateTemplatesPanel = ({ templateDocs, courseTypes, canEdit, onEdit, onClear, busy }) => {
    const [newType, setNewType] = useState('');
    const general = templateDocs[GENERAL_TEMPLATE_ID];
    const rows = courseTypes.map(t => ({ type: t, tpl: templateDocs[courseTypeTemplateId(t)] }));

    return (
        <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50/40">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-violet-200">
                <Layers className="h-4 w-4 text-violet-700" />
                <h3 className="font-bold text-gray-800 text-sm">Certificate templates</h3>
                <span className="text-[11px] text-gray-500 hidden md:inline">
                    Each certificate is built from: General → Course type → the course’s own changes.
                </span>
            </div>

            <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-800 text-sm">General template</div>
                        <div className="text-[11px] text-gray-500">{templateSummary(general)} · used by every course</div>
                    </div>
                    {canEdit && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="primary" className="text-xs" disabled={busy} onClick={() => onEdit({ kind: 'general' })}>
                                {general ? 'Edit' : 'Set up'}
                            </Button>
                            {general && (
                                <Button size="sm" variant="danger" className="text-xs" disabled={busy} onClick={() => onClear(GENERAL_TEMPLATE_ID, 'the general template')}>
                                    Clear
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="text-left px-3 py-2 font-semibold">Course type</th>
                                <th className="text-left px-3 py-2 font-semibold">Template</th>
                                {canEdit && <th className="px-3 py-2" />}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr><td colSpan={3} className="px-3 py-3 text-xs text-gray-500">No course types yet.</td></tr>
                            )}
                            {rows.map(({ type, tpl }) => (
                                <tr key={type} className="border-t border-gray-100">
                                    <td className="px-3 py-2 font-medium text-gray-800">{type}</td>
                                    <td className="px-3 py-2 text-xs">
                                        {tpl
                                            ? <span className="text-violet-700 font-semibold">{templateSummary(tpl)}</span>
                                            : <span className="text-gray-400">Uses general template</span>}
                                    </td>
                                    {canEdit && (
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <Button size="sm" variant="secondary" className="text-xs mr-1" disabled={busy} onClick={() => onEdit({ kind: 'courseType', courseType: type })}>
                                                {tpl ? 'Edit' : 'Create'}
                                            </Button>
                                            {tpl && (
                                                <Button size="sm" variant="danger" className="text-xs" disabled={busy} onClick={() => onClear(courseTypeTemplateId(type), `the ${type} template`)}>
                                                    Clear
                                                </Button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {canEdit && (
                    <div className="flex flex-wrap items-end gap-2">
                        <FormGroup label="Template for another course type">
                            <Input value={newType} onChange={e => setNewType(e.target.value)} placeholder="Course type exactly as stored, e.g. ETAT" />
                        </FormGroup>
                        <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs mb-1"
                            disabled={busy || !newType.trim()}
                            onClick={() => { onEdit({ kind: 'courseType', courseType: newType.trim() }); setNewType(''); }}
                        >
                            <Plus className="inline h-3 w-3 mr-1" />Create
                        </Button>
                    </div>
                )}
                {!canEdit && (
                    <p className="text-[11px] text-gray-500">Only the Federal Program Manager can change shared templates.</p>
                )}
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// SEPARATED CERTIFICATE APPROVALS VIEW
// -----------------------------------------------------------------------------
export const CertificateApprovalsView = ({ allCourses, setToast, currentUserRole, canUseFederalManagerAdvancedFeatures, singleCourseMode = false, title = 'Certificate Approvals' }) => {
    const { fetchCourses } = useDataCache(); 
    const [managerName, setManagerName] = React.useState('');
    const [loadingApprovals, setLoadingApprovals] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const [localCourseUpdates, setLocalCourseUpdates] = React.useState({});

    const fileInputRef = React.useRef(null);
    const [uploadContext, setUploadContext] = React.useState({ course: null, assetType: null });
    const [courseToApprove, setCourseToApprove] = React.useState(null);
    // { scope: {kind, courseType}, course, initialConfig } — null when closed.
    const [designTarget, setDesignTarget] = React.useState(null);
    const [templateDocs, setTemplateDocs] = React.useState({});
    const [templatesBusy, setTemplatesBusy] = React.useState(false);
    const [courseToPreview, setCourseToPreview] = React.useState(null);

    const reloadTemplates = React.useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, CERT_TEMPLATES_COLLECTION));
            const map = {};
            snap.forEach(d => { map[d.id] = d.data(); });
            setTemplateDocs(map);
            invalidateCertificateTemplateCache();
        } catch (err) {
            console.warn('[Certificate] Could not load templates.', err);
        }
    }, []);

    React.useEffect(() => { reloadTemplates(); }, [reloadTemplates]);

    // The course as it will actually print: templates layered under its own changes.
    const effective = React.useCallback((c) => layerCourseWithTemplates(c, templateDocs), [templateDocs]);

    const openCourseDesigner = (c) => setDesignTarget({ scope: { kind: 'course' }, course: c, initialConfig: null });
    const openTemplateDesigner = (scope) => {
        const id = scope.kind === 'general' ? GENERAL_TEMPLATE_ID : courseTypeTemplateId(scope.courseType);
        setDesignTarget({
            scope,
            course: buildTemplateSampleCourse(scope.kind === 'courseType' ? scope.courseType : null, allCourses),
            initialConfig: templateDocs[id]?.config || {}
        });
    };

    const clearTemplate = async (id, label) => {
        if (!await confirmDialog(`Delete ${label}? Courses that rely on it go back to the next layer down.`)) return;
        setTemplatesBusy(true);
        try {
            await deleteDoc(doc(db, CERT_TEMPLATES_COLLECTION, id));
            await reloadTemplates();
            setToast({ show: true, message: 'Template cleared.', type: 'info' });
        } catch (err) {
            setToast({ show: true, message: `Could not clear the template: ${err.message}`, type: 'error' });
        } finally { setTemplatesBusy(false); }
    };

    const [filterState, setFilterState] = React.useState('All');
    const [filterLocality, setFilterLocality] = React.useState('All');
    const [filterCourseType, setFilterCourseType] = React.useState('All');
    const [filterStatus, setFilterStatus] = React.useState('All');

    const isFederalProgramManager = currentUserRole === 'federal_manager' || currentUserRole === 'super_user';

    const states = React.useMemo(() => ['All', ...new Set(allCourses.map(c => c.state).filter(Boolean))].sort(), [allCourses]);
    const localities = React.useMemo(() => {
        const locs = new Set();
        allCourses.forEach(c => {
            if (filterState === 'All' || c.state === filterState) if (c.locality) locs.add(c.locality);
        });
        return ['All', ...Array.from(locs).sort()];
    }, [allCourses, filterState]);
    const courseTypes = React.useMemo(() => ['All', ...new Set(allCourses.map(c => c.course_type).filter(Boolean))].sort(), [allCourses]);
    // Every type that has courses or already has a template.
    const templateCourseTypes = React.useMemo(() => {
        const set = new Set(allCourses.map(c => c.course_type).filter(Boolean));
        Object.values(templateDocs).forEach(t => { if (t?.scope === 'courseType' && t.courseType) set.add(t.courseType); });
        return [...set].sort();
    }, [allCourses, templateDocs]);

    const courses = React.useMemo(() => {
        let filtered = allCourses.map(c => ({
            ...c,
            ...(localCourseUpdates[c.id] || {})
        }));

        if (filterState !== 'All') filtered = filtered.filter(c => c.state === filterState);
        if (filterLocality !== 'All') filtered = filtered.filter(c => c.locality === filterLocality);
        if (filterCourseType !== 'All') filtered = filtered.filter(c => c.course_type === filterCourseType);
        if (filterStatus !== 'All') {
            const isApproved = filterStatus === 'Approved';
            filtered = filtered.filter(c => !!c.isCertificateApproved === isApproved);
        }
        return filtered.sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
    }, [allCourses, localCourseUpdates, filterState, filterLocality, filterCourseType, filterStatus]);

    // Everything the approval dialog shows, resolved through the same rules as the certificate.
    const approvalPreview = React.useMemo(() => {
        if (!courseToApprove) return null;
        return resolveCertificateSignatories(effective(courseToApprove), managerName);
    }, [courseToApprove, managerName, effective]);

    const loadData = async () => {
        setLoadingApprovals(true);
        try {
            await fetchCourses(true);
            const coords = await listFederalCoordinators({ source: 'cache' });
            const manager = coords.find(c => c.role === 'مدير البرنامج' || c.role === 'Federal Program Manager');
            if (manager) setManagerName(manager.name);
        } catch (err) {
            setToast({ show: true, message: "Error loading approval data", type: 'error' });
        } finally {
            setLoadingApprovals(false);
        }
    };

    React.useEffect(() => { loadData(); }, []);

    const executeApprove = async () => {
        if (!courseToApprove) return;
        setIsProcessing(true);
        try {
            const sig = resolveCertificateSignatories(effective(courseToApprove), managerName);

            // Persist the names that will actually be printed, so approval records
            // and generated certificates never disagree.
            const approvedManager = sig.managerEn || courseToApprove.approvedByManagerName || managerName || '';
            const approvedDirector = sig.directorEn || courseToApprove.approvedDirectorName || courseToApprove.director || '';

            const approvalPayload = {
                isCertificateApproved: true,
                approvedByManagerName: approvedManager,
                approvedDirectorName: approvedDirector,
                approvedThirdPartyName: sig.thirdPartyEnabled ? sig.thirdPartyEn : '',
                approvedThirdPartyRole: sig.thirdPartyEnabled ? sig.thirdPartyRoleEn : '',
                approvedThirdPartySignatureUrl: sig.thirdPartyEnabled ? sig.thirdPartySignatureUrl : '',
                approvedFourthPartyName: sig.fourthPartyEnabled ? sig.fourthPartyEn : '',
                approvedFourthPartyRole: sig.fourthPartyEnabled ? sig.fourthPartyRoleEn : '',
                approvedFourthPartySignatureUrl: sig.fourthPartyEnabled ? sig.fourthPartySignatureUrl : ''
            };

            setLocalCourseUpdates(prev => ({
                ...prev,
                [courseToApprove.id]: {
                    ...(prev[courseToApprove.id] || {}),
                    ...approvalPayload,
                    certificateApprovedAt: new Date()
                }
            }));

            const courseRef = doc(db, 'courses', courseToApprove.id);
            await updateDoc(courseRef, {
                ...approvalPayload,
                certificateApprovedAt: serverTimestamp(),
                lastUpdatedAt: serverTimestamp() // FORCE TIMESTAMP UPDATE
            });
            
            setToast({ show: true, message: "Certificates Approved Successfully.", type: 'success' });
            await fetchCourses(true); 
            setCourseToApprove(null);
        } catch (err) {
            setToast({ show: true, message: `Error: ${err.message}`, type: 'error' });
        } finally { setIsProcessing(false); }
    };

    const handleUnapprove = async (course) => {
        if (await confirmDialog(
            `Revoke approval for ${course.course_type}?\n\n` +
            `This also ERASES every stored signature and stamp image for this course. ` +
            `They will have to be uploaded again before certificates can be re-approved.`
        )) {
            setIsProcessing(true);
            try {
                const cleared = { isCertificateApproved: false };
                SIGNATURE_FIELDS.courseLevel.forEach(f => { cleared[f] = null; });

                setLocalCourseUpdates(prev => ({
                    ...prev,
                    [course.id]: { ...(prev[course.id] || {}), ...cleared }
                }));

                await unapproveCourseCertificates(course.id);

                // "Destamped" has to mean the images are gone, not merely unused.
                // unapproveCourseCertificates only clears the manager signature, so
                // wipe the remaining signature/stamp fields — including the two held
                // inside customCertificate — in the same operation.
                const purge = { lastUpdatedAt: serverTimestamp() };
                SIGNATURE_FIELDS.courseLevel.forEach(f => { purge[f] = null; });
                SIGNATURE_FIELDS.customLevel.forEach(f => { purge[`customCertificate.${f}`] = deleteField(); });
                await updateDoc(doc(db, 'courses', course.id), purge);

                setToast({ show: true, message: "Approval revoked and signatures erased.", type: 'info' });
                await fetchCourses(true); 
            } catch (err) { setToast({ show: true, message: err.message, type: 'error' }); } 
            finally { setIsProcessing(false); }
        }
    };

    const triggerUpload = (course, assetType) => {
        setUploadContext({ course, assetType });
        if (fileInputRef.current) fileInputRef.current.click();
    };

    // Delete a stored signature/stamp image. Clears the course-level field and,
    // for the third/fourth signatures, the mirrored customCertificate copy too —
    // leaving either one behind would keep the image printing.
    const removeAsset = async (course, assetType) => {
        const map = {
            managerSignature: { courseKey: 'approvedByManagerSignatureUrl' },
            directorSignature: { courseKey: 'approvedDirectorSignatureUrl' },
            stamp: { courseKey: 'approvedProgramStampUrl' },
            thirdSignature: { courseKey: 'approvedThirdPartySignatureUrl', customKey: 'thirdPartySignatureUrl' },
            fourthSignature: { courseKey: 'approvedFourthPartySignatureUrl', customKey: 'fourthPartySignatureUrl' }
        };
        const field = map[assetType];
        if (!field) return;
        if (!await confirmDialog('Remove this stored image? It will have to be uploaded again.')) return;

        setIsProcessing(true);
        try {
            const payload = { lastUpdatedAt: serverTimestamp(), [field.courseKey]: null };
            if (field.customKey) payload[`customCertificate.${field.customKey}`] = deleteField();
            await updateDoc(doc(db, 'courses', course.id), payload);
            setToast({ show: true, message: "Image removed.", type: 'info' });
            await fetchCourses(true);
        } catch (err) {
            setToast({ show: true, message: err.message, type: 'error' });
        } finally { setIsProcessing(false); }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !uploadContext.course) return;
        const { course, assetType } = uploadContext;
        setIsProcessing(true);
        try {
            // Encoded in the browser — deliberately NOT uploaded to Storage.
            const url = await fileToSignatureDataUrl(file);
            
            const updatePayload = { lastUpdatedAt: serverTimestamp() }; 
            const sig = resolveCertificateSignatories(effective(course), managerName);
            
            if (assetType === 'managerSignature') { updatePayload.approvedByManagerSignatureUrl = url; updatePayload.approvedByManagerName = sig.managerEn || managerName; }
            else if (assetType === 'directorSignature') { updatePayload.approvedDirectorSignatureUrl = url; updatePayload.approvedDirectorName = sig.directorEn || course.director || ''; }
            else if (assetType === 'stamp') { updatePayload.approvedProgramStampUrl = url; }
            else if (assetType === 'thirdSignature') {
                updatePayload.approvedThirdPartySignatureUrl = url;
                updatePayload['customCertificate.thirdPartySignatureUrl'] = url;
                if (sig.thirdPartyEn) updatePayload.approvedThirdPartyName = sig.thirdPartyEn;
                if (sig.thirdPartyRoleEn) updatePayload.approvedThirdPartyRole = sig.thirdPartyRoleEn;
            }
            else if (assetType === 'fourthSignature') {
                updatePayload.approvedFourthPartySignatureUrl = url;
                updatePayload['customCertificate.fourthPartySignatureUrl'] = url;
                if (sig.fourthPartyEn) updatePayload.approvedFourthPartyName = sig.fourthPartyEn;
                if (sig.fourthPartyRoleEn) updatePayload.approvedFourthPartyRole = sig.fourthPartyRoleEn;
            }
            
            setLocalCourseUpdates(prev => ({
                ...prev,
                [course.id]: {
                    ...(prev[course.id] || {}),
                    ...updatePayload,
                    lastUpdatedAt: new Date() 
                }
            }));

            await updateDoc(doc(db, 'courses', course.id), updatePayload);
            setToast({ show: true, message: `Asset uploaded successfully!`, type: 'success' });
            
            await fetchCourses(true);
        } catch (err) { setToast({ show: true, message: `Upload failed: ${err.message}`, type: 'error' }); } 
        finally { setIsProcessing(false); setUploadContext({ course: null, assetType: null }); fileInputRef.current.value = ""; }
    };

    if (loadingApprovals && courses.length === 0) return <div className="flex justify-center p-8"><Spinner /></div>;

    return (
        <>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" />

            {courseToPreview && (
                <CertificatePreviewModal
                    // A stored course: the pipeline re-reads it and applies the
                    // templates, exactly as a real download does.
                    course={courseToPreview}
                    federalProgramManagerName={managerName}
                    onClose={() => setCourseToPreview(null)}
                    note={courseToPreview.isCertificateApproved ? '' : 'Not approved yet — participants cannot download this until it is approved.'}
                />
            )}

            {designTarget && (
                <CertificateDesigner
                    course={designTarget.course}
                    scope={designTarget.scope}
                    initialConfig={designTarget.initialConfig}
                    federalProgramManagerName={managerName}
                    onBack={() => setDesignTarget(null)}
                    onSaveSuccess={() => {
                        setToast({ show: true, message: "Certificate template saved.", type: 'success' });
                        reloadTemplates();
                        fetchCourses(true);
                    }}
                />
            )}


            <Modal isOpen={!!courseToApprove} onClose={() => setCourseToApprove(null)} title="Confirm Approval">
                <CardBody className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">These are the exact signatories that will be printed on every certificate for this course, in both languages.</p>

                    <div className="space-y-3 bg-gray-50 border rounded-lg p-4">
                        <ApprovalSignatoryRow
                            position="Course Director"
                            roleEn={approvalPreview?.directorRoleEn}
                            roleAr={approvalPreview?.directorRoleAr}
                            nameEn={approvalPreview?.directorDisplayEn}
                            nameAr={approvalPreview?.directorDisplayAr}
                            isCustom={approvalPreview?.overrides.directorEn || approvalPreview?.overrides.directorAr || approvalPreview?.overrides.directorRoleEn || approvalPreview?.overrides.directorRoleAr}
                            isHidden={approvalPreview?.hideDirector}
                        />
                        <ApprovalSignatoryRow
                            position="National Program Manager"
                            roleEn={approvalPreview?.managerRoleEn}
                            roleAr={approvalPreview?.managerRoleAr}
                            nameEn={approvalPreview?.managerDisplayEn}
                            nameAr={approvalPreview?.managerDisplayAr}
                            isCustom={approvalPreview?.overrides.managerEn || approvalPreview?.overrides.managerAr || approvalPreview?.overrides.managerRoleEn || approvalPreview?.overrides.managerRoleAr}
                            isHidden={approvalPreview?.hideManager}
                        />
                        {approvalPreview?.thirdPartyEnabled && (
                            <ApprovalSignatoryRow
                                position="Third Signature"
                                roleEn={approvalPreview?.thirdPartyRoleEn}
                                roleAr={approvalPreview?.thirdPartyRoleAr}
                                nameEn={approvalPreview?.thirdPartyEn}
                                nameAr={approvalPreview?.thirdPartyAr}
                                isCustom
                            />
                        )}
                        {approvalPreview?.fourthPartyEnabled && (
                            <ApprovalSignatoryRow
                                position="Fourth Signature"
                                roleEn={approvalPreview?.fourthPartyRoleEn}
                                roleAr={approvalPreview?.fourthPartyRoleAr}
                                nameEn={approvalPreview?.fourthPartyEn}
                                nameAr={approvalPreview?.fourthPartyAr}
                                isCustom
                            />
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className={`px-2 py-1 rounded font-semibold ${courseToApprove?.approvedDirectorSignatureUrl ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {courseToApprove?.approvedDirectorSignatureUrl ? 'Director signature uploaded' : 'No director signature'}
                        </span>
                        <span className={`px-2 py-1 rounded font-semibold ${courseToApprove?.approvedByManagerSignatureUrl ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {courseToApprove?.approvedByManagerSignatureUrl ? 'Manager signature uploaded' : 'No manager signature'}
                        </span>
                        {approvalPreview?.fourthPartyEnabled && (
                            <span className={`px-2 py-1 rounded font-semibold ${approvalPreview?.fourthPartySignatureUrl ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                {approvalPreview?.fourthPartySignatureUrl ? 'Fourth signature uploaded' : 'No fourth signature image'}
                            </span>
                        )}

                        {approvalPreview?.thirdPartyEnabled && (
                            <span className={`px-2 py-1 rounded font-semibold ${approvalPreview?.thirdPartySignatureUrl ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                {approvalPreview?.thirdPartySignatureUrl ? 'Third signature uploaded' : 'No third signature image'}
                            </span>
                        )}
                        <span className={`px-2 py-1 rounded font-semibold ${courseToApprove?.approvedProgramStampUrl ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {courseToApprove?.approvedProgramStampUrl ? 'Stamp uploaded' : 'No stamp'}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => { openCourseDesigner(courseToApprove); setCourseToApprove(null); }}
                        className="text-sm text-sky-700 font-semibold hover:underline flex items-center gap-1"
                    >
                        <Settings size={14} /> Edit these names first
                    </button>
                    <button
                        type="button"
                        onClick={() => setCourseToPreview(courseToApprove)}
                        className="text-sm text-sky-700 font-semibold hover:underline flex items-center gap-1"
                    >
                        <Eye size={14} /> Preview the certificate before approving
                    </button>
                </CardBody>
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setCourseToApprove(null)} disabled={isProcessing}>Cancel</Button>
                    <Button variant="success" onClick={executeApprove} disabled={isProcessing}>
                        {isProcessing ? <Spinner size="sm" /> : 'Confirm & Approve'}
                    </Button>
                </CardFooter>
            </Modal>

            <Card>
                <PageHeader title={title} />
                
                {/* In single-course mode the list is already one row, so the filters
                    would only be noise. */}
                {!singleCourseMode && (
                    <CertificateTemplatesPanel
                        templateDocs={templateDocs}
                        courseTypes={templateCourseTypes}
                        canEdit={isFederalProgramManager}
                        busy={templatesBusy || isProcessing}
                        onEdit={openTemplateDesigner}
                        onClear={clearTemplate}
                    />
                )}

                {!singleCourseMode && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <FormGroup label="State"><Select value={filterState} onChange={e => setFilterState(e.target.value)}>{states.map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                        <FormGroup label="Course Type"><Select value={filterCourseType} onChange={e => setFilterCourseType(e.target.value)}>{courseTypes.map(c => <option key={c} value={c}>{c}</option>)}</Select></FormGroup>
                        <FormGroup label="Status"><Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="All">All</option><option value="Approved">Approved</option><option value="Pending">Pending</option></Select></FormGroup>
                    </div>
                )}

                <div className="overflow-hidden rounded-xl border border-slate-300 shadow-sm bg-white">
                    <table className="w-full text-left border-collapse text-sm table-fixed">
                        <thead>
                            <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                                <th className="p-3 font-semibold border-b border-slate-300 w-[18%]">Course</th>
                                <th className="p-3 font-semibold border-b border-slate-300 w-[18%]">Location & Date</th>
                                <th className="p-3 font-semibold border-b border-slate-300 w-[8%]">Status</th>
                                <th className="p-3 font-semibold border-b border-slate-300 w-[56%] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.map(c => {
                                const isApproved = c.isCertificateApproved === true;
                                const canModify = isApproved && (!c.approvedByManagerName || c.approvedByManagerName === managerName || isFederalProgramManager);
                                const hasCustomTemplate = !!(c.customCertificate && Object.keys(c.customCertificate).length > 0);
                                const isCustomized = hasCustomTemplate;
                                // Resolve the row's signatories so the 3rd/4th upload
                                // buttons appear only for courses that actually use them.
                                const rowSig = resolveCertificateSignatories(effective(c), managerName);
                                const hasTypeTemplate = !!(c.course_type && templateDocs[courseTypeTemplateId(c.course_type)]);
                                const hasGeneralTemplate = !!templateDocs[GENERAL_TEMPLATE_ID];
                                
                                return (
                                    <tr key={c.id} className={`transition-colors hover:bg-gray-50 group ${isApproved ? "bg-green-50/20" : ""}`}>
                                        <td className="p-3 align-middle border-b border-slate-200">
                                            <div className="font-bold text-sky-700 truncate" title={c.course_type}>{c.course_type}</div>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {hasCustomTemplate && <span className="text-[9px] font-bold uppercase tracking-wider text-sky-600">Course changes</span>}
                                                {hasTypeTemplate && <span className="text-[9px] font-bold uppercase tracking-wider text-violet-600">Type template</span>}
                                                {!hasTypeTemplate && hasGeneralTemplate && <span className="text-[9px] font-bold uppercase tracking-wider text-violet-500">General template</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 align-middle border-b border-slate-200 overflow-hidden">
                                            <div className="font-semibold text-gray-800 truncate" title={`${c.state} - ${c.locality}`}>{c.state} - {c.locality}</div>
                                            <div className="text-[10px] text-gray-500 whitespace-nowrap">{c.start_date}</div>
                                        </td>
                                        <td className="p-3 align-middle border-b border-slate-200">
                                            {isApproved ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800">
                                                    Ready
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        
                                        <td className="p-3 align-middle border-b border-slate-200 text-right">
                                            <div className="flex flex-nowrap items-center justify-end gap-1">
                                                
                                                <Button onClick={() => openCourseDesigner(c)} disabled={isProcessing} variant="secondary" className="px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1 border-gray-300">
                                                    <Settings size={12} /> Customize
                                                </Button>

                                                <Button onClick={() => setCourseToPreview(c)} disabled={isProcessing} variant="secondary" className="px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1 border-gray-300" title="See the real certificate">
                                                    <Eye size={12} /> Preview
                                                </Button>

                                                {isApproved ? (
                                                    <Button onClick={() => handleUnapprove(c)} disabled={!canModify || isProcessing} variant="danger" className="px-2 py-1 text-[10px] whitespace-nowrap">Revoke</Button>
                                                ) : (
                                                    <Button onClick={() => setCourseToApprove(c)} disabled={isProcessing} variant="success" className="px-2 py-1 text-[10px] whitespace-nowrap font-bold bg-green-600 text-white hover:bg-green-700 border-transparent">Approve</Button>
                                                )}

                                                <Button onClick={() => triggerUpload(c, 'managerSignature')} disabled={!isFederalProgramManager || isProcessing} variant={c.approvedByManagerSignatureUrl ? "success" : "secondary"} className={`px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1 ${c.approvedByManagerSignatureUrl ? 'bg-green-600 text-white hover:bg-green-700 border-transparent' : ''}`}>
                                                    {c.approvedByManagerSignatureUrl ? <CheckCircle size={12} /> : <FileSignature size={12} />} PM Signature
                                                </Button>
                                                {c.approvedByManagerSignatureUrl && (
                                                    <button type="button" title="Remove PM signature image" onClick={() => removeAsset(c, 'managerSignature')} disabled={!isFederalProgramManager || isProcessing} className="px-1.5 py-1 text-[10px] rounded border border-red-200 text-red-600 hover:bg-red-50">×</button>
                                                )}

                                                <Button onClick={() => triggerUpload(c, 'directorSignature')} disabled={isProcessing} variant={c.approvedDirectorSignatureUrl ? "success" : "secondary"} className={`px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1 ${c.approvedDirectorSignatureUrl ? 'bg-green-600 text-white hover:bg-green-700 border-transparent' : ''}`}>
                                                    {c.approvedDirectorSignatureUrl ? <CheckCircle size={12} /> : <FileSignature size={12} />} Dir Signature
                                                </Button>
                                                {c.approvedDirectorSignatureUrl && (
                                                    <button type="button" title="Remove director signature image" onClick={() => removeAsset(c, 'directorSignature')} disabled={isProcessing} className="px-1.5 py-1 text-[10px] rounded border border-red-200 text-red-600 hover:bg-red-50">×</button>
                                                )}

                                                {rowSig.thirdPartyEnabled && (
                                                    <Button onClick={() => triggerUpload(c, 'thirdSignature')} disabled={isProcessing} variant={rowSig.thirdPartySignatureUrl ? "success" : "secondary"} className={`px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1 ${rowSig.thirdPartySignatureUrl ? 'bg-green-600 text-white hover:bg-green-700 border-transparent' : ''}`}>
                                                        {rowSig.thirdPartySignatureUrl ? <CheckCircle size={12} /> : <FileSignature size={12} />} 3rd Signature
                                                    </Button>
                                                )}
                                                {rowSig.thirdPartyEnabled && rowSig.thirdPartySignatureUrl && (
                                                    <button type="button" title="Remove third signature image" onClick={() => removeAsset(c, 'thirdSignature')} disabled={isProcessing} className="px-1.5 py-1 text-[10px] rounded border border-red-200 text-red-600 hover:bg-red-50">×</button>
                                                )}

                                                {rowSig.fourthPartyEnabled && (
                                                    <Button onClick={() => triggerUpload(c, 'fourthSignature')} disabled={isProcessing} variant={rowSig.fourthPartySignatureUrl ? "success" : "secondary"} className={`px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1 ${rowSig.fourthPartySignatureUrl ? 'bg-green-600 text-white hover:bg-green-700 border-transparent' : ''}`}>
                                                        {rowSig.fourthPartySignatureUrl ? <CheckCircle size={12} /> : <FileSignature size={12} />} 4th Signature
                                                    </Button>
                                                )}
                                                {rowSig.fourthPartyEnabled && rowSig.fourthPartySignatureUrl && (
                                                    <button type="button" title="Remove fourth signature image" onClick={() => removeAsset(c, 'fourthSignature')} disabled={isProcessing} className="px-1.5 py-1 text-[10px] rounded border border-red-200 text-red-600 hover:bg-red-50">×</button>
                                                )}

                                                {/* The stamp action disappears once the certificate has been
                                                    customised: those courses are sealed by hand after printing,
                                                    so a digital stamp is both unnecessary and one more sensitive
                                                    image stored for no reason. */}
                                                {!isCustomized && (
                                                    <Button onClick={() => triggerUpload(c, 'stamp')} disabled={!canUseFederalManagerAdvancedFeatures || isProcessing} variant={c.approvedProgramStampUrl ? "success" : "secondary"} className={`px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1 ${c.approvedProgramStampUrl ? 'bg-green-600 text-white hover:bg-green-700 border-transparent' : ''}`}>
                                                        {c.approvedProgramStampUrl ? <CheckCircle size={12} /> : <Stamp size={12} />} Stamp
                                                    </Button>
                                                )}
                                                {c.approvedProgramStampUrl && (
                                                    <button type="button" title="Remove stamp image" onClick={() => removeAsset(c, 'stamp')} disabled={!canUseFederalManagerAdvancedFeatures || isProcessing} className="px-1.5 py-1 text-[10px] rounded border border-red-200 text-red-600 hover:bg-red-50">×</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </>
    );
};
