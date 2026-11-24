// functions/problemCategoriesCore.js
//
// CommonJS copy of src/utils/problemCategories.js for the public mentorship
// copy (the server sorts each facility problem into a category, so the
// public link never carries the problem text). tests/problemCategories.test.js
// checks this copy against the app's: change one, change both.
//
// Facility problems are recorded on visit reports as free text (Arabic or
// English) with a status. The mentorship dashboard no longer lists them one
// by one; it shows overall numbers, the problems sorted into categories, and
// where each stands (pending, in progress, resolved).
//
// The category is worked out from the problem's own words: each category has
// keywords, and the category with most matches wins (ties go to the earlier
// category). Text that matches nothing is "Other".

// Arabic letters that are written several ways are folded to one form, and
// short vowels removed, so "الأدوية" and "الادويه" match the same keyword.
function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[ً-ْٰـ]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي');
}

const PROBLEM_CATEGORIES = [
    {
        key: 'medicines_supplies',
        en: 'Medicines & supplies',
        ar: 'الأدوية والإمداد',
        color: '#10b981',
        words: ['دواء', 'ادويه', 'الدواء', 'عقار', 'امداد', 'امدادات', 'مستهلكات', 'محاليل', 'محلول', 'قفاز', 'جوانتي', 'اموكسيل', 'اموكسيسيلين', 'زنك', 'كوارتم', 'فيتامين', 'تتراسايكلين', 'مضاد', 'لقاح', 'ملقط', 'مخزون', 'drug', 'medicine', 'medication', 'supply', 'supplies', 'stock', 'amoxicillin', 'zinc', 'ors', 'coartem', 'gloves', 'vitamin', 'tetracycline', 'antibiotic', 'clamp', 'consumable'],
    },
    {
        key: 'staff_training',
        en: 'Staff & training',
        ar: 'الكوادر والتدريب',
        color: '#3b82f6',
        words: ['كادر', 'كوادر', 'عامل', 'عاملين', 'العاملين', 'موظف', 'تدريب', 'مدرب', 'تاهيل', 'ممرض', 'ممرضه', 'طبيب', 'اطباء', 'مساعد طبي', 'قابله', 'قابلات', 'حوافز', 'حافز', 'غياب', 'دوران', 'نقل الكادر', 'staff', 'training', 'trained', 'untrained', 'nurse', 'doctor', 'midwife', 'workforce', 'turnover', 'incentive', 'absent', 'shortage of staff'],
    },
    {
        key: 'equipment',
        en: 'Equipment',
        ar: 'الأجهزة والمعدات',
        color: '#8b5cf6',
        words: ['جهاز', 'اجهزه', 'معدات', 'ميزان', 'ترمومتر', 'مقياس', 'ساعه', 'مؤقت', 'موقت', 'امبو', 'شفاط', 'اكسجين', 'دفايه', 'حاضنه', 'equipment', 'device', 'scale', 'thermometer', 'timer', 'ambu', 'bag and mask', 'suction', 'oxygen', 'warmer', 'incubator', 'tools'],
    },
    {
        key: 'infrastructure',
        en: 'Building & utilities',
        ar: 'المبنى والخدمات',
        color: '#f59e0b',
        words: ['كهرباء', 'كهربا', 'مياه', 'ماء', 'مبني', 'غرفه', 'غرف', 'مكان', 'مساحه', 'اثاث', 'سرير', 'نظافه', 'صرف', 'حمام', 'مولد', 'اناره', 'سقف', 'تكييف', 'electricity', 'power', 'water', 'building', 'room', 'space', 'furniture', 'bed', 'sanitation', 'toilet', 'generator', 'lighting', 'roof'],
    },
    {
        key: 'records_reporting',
        en: 'Records & reporting',
        ar: 'السجلات والتقارير',
        color: '#0ea5e9',
        words: ['سجل', 'سجلات', 'استماره', 'استمارات', 'نماذج', 'نموذج', 'كرت', 'كروت', 'تسجيل', 'تقرير', 'تقارير', 'دفتر', 'كتيب', 'لوحات', 'بيانات', 'متابعه', 'register', 'record', 'form', 'booklet', 'chart', 'reporting', 'report', 'data', 'documentation', 'follow-up', 'follow up'],
    },
    {
        key: 'funding_logistics',
        en: 'Funding & transport',
        ar: 'التمويل والترحيل',
        color: '#ef4444',
        words: ['تمويل', 'ميزانيه', 'رسوم', 'ترحيل', 'مواصلات', 'وقود', 'عربه', 'اسعاف', 'تكلفه', 'funding', 'budget', 'money', 'fees', 'cost', 'transport', 'fuel', 'vehicle', 'ambulance'],
    },
    {
        key: 'community',
        en: 'Community & caregivers',
        ar: 'المجتمع والأمهات',
        color: '#ec4899',
        words: ['امهات', 'مجتمع', 'وعي', 'توعيه', 'مرافقين', 'community', 'mother', 'caregiver', 'awareness', 'families', 'family'],
    },
];

const OTHER_CATEGORY = { key: 'other', en: 'Other', ar: 'أخرى', color: '#64748b', words: [] };

// A keyword must start a word: at the start, after a non-letter, or after a
// common Arabic prefix (ال، و، ب، ل، ف...). So "ors" does not match inside
// "doctors" and "كرت" not inside "ذكرت". The end is left open so plurals
// and endings still match.
const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const keywordRe = (w) => new RegExp(`(?:^|[^\\p{L}])(?:ال|وال|بال|لل|و|ب|ل|ف)?${escapeRe(w)}`, 'u');
const NORMALIZED = PROBLEM_CATEGORIES.map((c) => ({ ...c, res: c.words.map(normalizeText).filter(Boolean).map(keywordRe) }));

/** The category key for one problem's text. */
function categorizeProblem(text) {
    const s = normalizeText(text);
    if (!s.trim()) return OTHER_CATEGORY.key;
    let best = null;
    let bestHits = 0;
    NORMALIZED.forEach((c) => {
        const hits = c.res.reduce((n, re) => (re.test(s) ? n + 1 : n), 0);
        if (hits > bestHits) { best = c; bestHits = hits; }
    });
    return best ? best.key : OTHER_CATEGORY.key;
}

const STATUS_BUCKETS = [
    { key: 'pending', en: 'Pending', ar: 'قيد الانتظار', color: '#f59e0b' },
    { key: 'in_progress', en: 'In progress', ar: 'جاري العمل', color: '#3b82f6' },
    { key: 'resolved', en: 'Resolved / done', ar: 'تم الحل', color: '#10b981' },
];

/** pending | in_progress | resolved, from the stored status (any spelling). */
function statusBucket(status) {
    const s = normalizeText(status);
    if (/resolv|done|complete|closed|solved|تم|حل|منجز|اكتمل/.test(s)) return 'resolved';
    if (/progress|ongoing|started|جاري|جار|قيد التنفيذ|بدا/.test(s)) return 'in_progress';
    return 'pending';
}

const categoryInfo = (key) => PROBLEM_CATEGORIES.find((c) => c.key === key) || OTHER_CATEGORY;
const statusInfo = (key) => STATUS_BUCKETS.find((s) => s.key === key) || STATUS_BUCKETS[0];

/**
 * Overall numbers for a list of problems ({ problem, status }):
 *   total, byStatus { pending, in_progress, resolved }, resolvedPct,
 *   categories: [{ key, total, pending, in_progress, resolved, resolvedPct }]
 *   (largest first, empty categories left out).
 */
function summarizeProblems(problems = []) {
    const empty = () => ({ total: 0, pending: 0, in_progress: 0, resolved: 0 });
    const overall = empty();
    const byCat = {};
    (problems || []).forEach((p) => {
        // A problem may arrive already categorized (the public copy sends the
        // category, not the text).
        const known = p && p.category && (p.category === OTHER_CATEGORY.key || PROBLEM_CATEGORIES.some((c) => c.key === p.category));
        if (!p || (!known && !String(p.problem || '').trim())) return;
        const cat = known ? p.category : categorizeProblem(p.problem);
        const st = statusBucket(p.status);
        overall.total += 1; overall[st] += 1;
        if (!byCat[cat]) byCat[cat] = empty();
        byCat[cat].total += 1; byCat[cat][st] += 1;
    });
    const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
    const order = [...PROBLEM_CATEGORIES.map((c) => c.key), OTHER_CATEGORY.key];
    const categories = Object.entries(byCat)
        .map(([key, v]) => ({ key, ...v, resolvedPct: pct(v.resolved, v.total) }))
        .sort((a, b) => (b.total - a.total) || (order.indexOf(a.key) - order.indexOf(b.key)));
    return {
        total: overall.total,
        byStatus: { pending: overall.pending, in_progress: overall.in_progress, resolved: overall.resolved },
        resolvedPct: pct(overall.resolved, overall.total),
        categories,
    };
}

module.exports = {
    normalizeText, PROBLEM_CATEGORIES, OTHER_CATEGORY, categorizeProblem,
    STATUS_BUCKETS, statusBucket, categoryInfo, statusInfo, summarizeProblems,
};
