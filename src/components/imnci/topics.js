// ============================================================================
// PROTOCOL MANAGEMENT BY DISEASE
//
// Protocol management shows one tab per illness (pneumonia, diarrhoea, fever…)
// and, on that tab, everything about it in the order a health worker uses it:
// the classification table, the doses it calls for, the treatment boxes, the
// counselling and the follow-up. The data stays in its four documents
// (classification, doses, treatment & counselling, recording form); this file
// only decides which parts of them belong to which illness.
//
//   topic             one booklet page (bookletLayout.js), plus 'general' for
//                     what belongs to no single illness (vaccination, feeding
//                     counselling, when to return), plus 'form'.
//   a dose            belongs to the illness whose classification table points
//                     at it ({{dose:id}}); drug.topic, or DEFAULT_DRUG_TOPIC
//                     for a dose no rule points at.
//   a guide box       belongs to the illnesses in block.topic when it is set
//                     (a box added on a disease tab), otherwise to
//                     DEFAULT_BLOCK_TOPICS; a box in neither shows on General.
// ============================================================================
import { BOOKLET_PAGES } from './bookletLayout';

export const GENERAL = 'general';
export const FORM = 'form';

// group.block -> illnesses. Listed under 'general' too when a box is useful on
// every visit, so it is not hidden behind one illness.
const DEFAULT_BLOCK_TOPICS = {
    child: {
        'inhaler.salbutamol': ['cough'],
        'inhaler.spacer_use': ['cough'],
        'inhaler.spacer_make': ['cough'],
        'inhaler.oral_salbutamol': ['cough'],
        'local.throat': ['cough'],
        'local.eye': ['fever'],
        'local.mouth': ['fever'],
        'local.ear': ['ear'],
        'fluids.plan_a': ['diarrhea'],
        'fluids.plan_b': ['diarrhea'],
        'fluids.plan_c': ['diarrhea'],
        'fluids.rutf': ['malnutrition'],
        'counsel.appetite': ['malnutrition'],
        'counsel.persistent': ['diarrhea'],
        'counsel.feeding': ['cough', 'malnutrition', 'anemia', GENERAL],
        'counsel.fluids_illness': ['cough', 'diarrhea', 'fever', 'ear', GENERAL],
        'followup.return_now': ['cough', 'diarrhea', 'fever', GENERAL],
        'followup.fu_pneumonia': ['cough'],
        'followup.fu_dysentery': ['diarrhea'],
        'followup.fu_diarrhoea': ['diarrhea'],
        'followup.fu_malaria': ['fever'],
        'followup.fu_fever': ['fever'],
        'followup.fu_measles': ['fever'],
        'followup.fu_ear': ['ear'],
        'followup.fu_anaemia': ['anemia'],
        'followup.fu_sam': ['malnutrition'],
        'followup.fu_mam': ['malnutrition'],
    },
    infant: {
        'local.warm': ['bacterial_infection'],
        'local.skin': ['bacterial_infection'],
        'local.thrush': ['feeding_problem'],
        'local.diarrhoea': ['diarrhea'],
        'counsel.home_care': ['bacterial_infection', 'jaundice', 'diarrhea', GENERAL],
        'counsel.attachment': ['feeding_problem'],
        'counsel.express': ['feeding_problem'],
        'followup.return_now': ['bacterial_infection', 'diarrhea', GENERAL],
        'followup.fu_local': ['bacterial_infection'],
        'followup.fu_diarrhoea': ['diarrhea'],
        'followup.fu_jaundice': ['jaundice'],
        'followup.fu_feeding': ['feeding_problem'],
        'followup.fu_thrush': ['feeding_problem'],
        'followup.fu_lwa': ['feeding_problem'],
    },
};

// Doses no classification line points at.
const DEFAULT_DRUG_TOPIC = {
    child: { dhap: 'fever', quinine_oral: 'fever', vitamin_a: GENERAL },
    infant: {},
};

/** Which part of a disease tab a guide heading's boxes go under. */
export const kindOfGroup = (groupId) => (groupId === 'counsel' ? 'counsel' : groupId === 'followup' ? 'followup' : 'treat');

/** The disease tabs of a part: the booklet pages, then General and the form. */
export const topicsFor = (part, classifyDoc) => [
    ...pagesFor(part, classifyDoc?.categories || {}).map((p) => ({ id: p.id, title: p.title, page: p })),
    { id: GENERAL },
    { id: FORM },
];

const DOSE_TAGS = /{{dose:(.*?)}}/g;
const doseIdsIn = (rule) => [...(rule.treatments || []), ...(rule.treatmentsAr || [])]
    .flatMap((line) => [...String(line).matchAll(DOSE_TAGS)].map((m) => m[1].trim()));

/** drug id -> topic, for every dose of the part. The first page to use a dose owns it. */
export const drugTopics = (part, classifyDoc, doseDoc) => {
    const owner = {};
    pagesFor(part, classifyDoc?.categories || {}).forEach((page) => {
        page.categories.forEach((catKey) => (classifyDoc.categories[catKey]?.rules || []).forEach((rule) => {
            doseIdsIn(rule).forEach((id) => { if (!owner[id]) owner[id] = page.id; });
        }));
    });
    const topics = {};
    (doseDoc?.drugs || []).forEach((d) => {
        topics[d.id] = d.topic || owner[d.id] || DEFAULT_DRUG_TOPIC[part]?.[d.id] || GENERAL;
    });
    return topics;
};

/** Indexes (into doseDoc.drugs) of the doses shown on a topic, in booklet order of first use. */
export const drugsForTopic = (part, topicId, classifyDoc, doseDoc) => {
    const owners = drugTopics(part, classifyDoc, doseDoc);
    const drugs = doseDoc?.drugs || [];
    const page = pagesFor(part, classifyDoc?.categories || {}).find((p) => p.id === topicId);
    const order = [];
    if (page) {
        page.categories.forEach((catKey) => (classifyDoc.categories[catKey]?.rules || []).forEach((rule) => {
            doseIdsIn(rule).forEach((id) => { if (!order.includes(id)) order.push(id); });
        }));
    }
    const rank = (d) => { const i = order.indexOf(d.id); return i === -1 ? order.length : i; };
    return drugs
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => owners[d.id] === topicId)
        .sort((a, b) => rank(a.d) - rank(b.d) || a.i - b.i)
        .map(({ i }) => i);
};

const blockTopics = (part, group, block) => {
    if (block.topic) return Array.isArray(block.topic) ? block.topic : [block.topic];
    return DEFAULT_BLOCK_TOPICS[part]?.[`${group.id}.${block.id}`] || [GENERAL];
};

/**
 * The guide boxes on a topic, split into treat / counsel / followup.
 * Each entry is { gi, bi } into guideDoc.groups[gi].blocks[bi].
 * `known` is the list of topic ids that exist, so a box tied to an illness
 * whose table was deleted still shows on General instead of disappearing.
 */
export const guideForTopic = (part, topicId, guideDoc, known = []) => {
    const out = { treat: [], counsel: [], followup: [] };
    (guideDoc?.groups || []).forEach((group, gi) => (group.blocks || []).forEach((block, bi) => {
        const topics = blockTopics(part, group, block);
        const live = topics.filter((tp) => tp === GENERAL || known.includes(tp));
        const shown = live.length ? live : [GENERAL];
        if (shown.includes(topicId)) out[kindOfGroup(group.id)].push({ gi, bi });
    }));
    return out;
};

/** Where a box added under one part of a disease tab is stored. */
export const groupForNewBox = (guideDoc, kind, existing = []) => {
    const groups = guideDoc?.groups || [];
    if (kind === 'counsel' || kind === 'followup') return groups.findIndex((g) => g.id === kind);
    if (existing.length) return existing[0].gi;
    const local = groups.findIndex((g) => g.id === 'local');
    return local !== -1 ? local : groups.findIndex((g) => kindOfGroup(g.id) === 'treat');
};

/**
 * The booklet pages of a part, each with the tables it shows. Unlike the
 * booklet view, a table with no rules yet still gets its page, so a table just
 * added in the rule builder has a tab to be filled in on.
 */
export const pagesFor = (part, categories = {}) => {
    const known = (BOOKLET_PAGES[part] || [])
        .map((p) => ({ ...p, categories: p.categories.filter((k) => categories[k]) }))
        .filter((p) => p.categories.length);
    const covered = new Set(known.flatMap((p) => p.categories));
    const extra = Object.entries(categories)
        .filter(([k]) => !covered.has(k))
        .map(([k, c]) => ({ id: k, title: c?.title || k, categories: [k] }));
    return [...known, ...extra];
};
