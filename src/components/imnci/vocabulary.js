// ============================================================================
// ONE IMNCI VOCABULARY
//
// The patient form, Protocol management, the online course modules and the
// online IMNCI exercises all name the same classifications and treatments.
// They used to spell them four ways ("FEVER - NO MALARIA", "Fever: no
// malaria", "حمى لايوجد ملاريا", "حمى - لا توجد ملاريا"). Everything now reads
// its wording from the protocol:
//
//   1. the protocol saved in Protocol management (what the clinic uses), then
//   2. the built-in Sudan national protocol, then
//   3. the national Arabic dictionary for an Arabic line.
//
// Exercises still store their own option ids (attempts are keyed on them), so
// changing a word in Protocol management changes it in the exercises too,
// without touching a single recorded attempt.
// ============================================================================
import { NATIONAL_PROTOCOLS } from './nationalProtocol';
import { toArabic } from './nationalProtocolAr';

// Exercise / i18n classification keys (imci.classifications.<key>) and the
// protocol rule each one is.
export const CLASSIFICATION_RULES = {
    danger_sign: ['child', 'danger_sign'],
    severe_pneumonia: ['child', 'severe_pneumonia'],
    pneumonia: ['child', 'pneumonia'],
    cough_cold: ['child', 'cough_or_cold'],
    severe_dehydration: ['child', 'severe_dehydration'],
    some_dehydration: ['child', 'some_dehydration'],
    no_dehydration: ['child', 'no_dehydration'],
    severe_persistent_diarrhea: ['child', 'severe_persistent_diarrhea'],
    persistent_diarrhea: ['child', 'persistent_diarrhea'],
    dysentery: ['child', 'dysentery'],
    very_severe_febrile: ['child', 'very_severe_febrile_disease'],
    malaria: ['child', 'malaria'],
    fever_no_malaria: ['child', 'fever_no_malaria'],
    severe_complicated_measles: ['child', 'severe_complicated_measles'],
    measles_eye_mouth: ['child', 'measles_eye_mouth'],
    measles: ['child', 'measles'],
    mastoiditis: ['child', 'mastoiditis'],
    acute_ear_infection: ['child', 'acute_ear_infection'],
    chronic_ear_infection: ['child', 'chronic_ear_infection'],
    no_ear_infection: ['child', 'no_ear_infection'],
    severe_anemia: ['child', 'severe_anemia'],
    anemia: ['child', 'anemia'],
    no_anemia: ['child', 'no_anemia'],
    complicated_sam: ['child', 'complicated_sam'],
    uncomplicated_sam: ['child', 'uncomplicated_sam'],
    mam: ['child', 'moderate_acute_malnutrition'],
    no_malnutrition: ['child', 'no_acute_malnutrition'],
    possible_severe_bacterial_infection: ['infant', 'possible_serious_bacterial_infection'],
    local_bacterial_infection: ['infant', 'local_bacterial_infection'],
    severe_jaundice: ['infant', 'severe_jaundice'],
    jaundice: ['infant', 'jaundice'],
    no_jaundice: ['infant', 'no_jaundice'],
    feeding_problem_low_weight: ['infant', 'feeding_problem_or_low_weight'],
    no_feeding_problem: ['infant', 'no_feeding_problem'],
};

const CLASS_PREFIX = 'imci.classifications.';

// The protocol the app last loaded, so screens that cannot reach the data
// cache (the exercise pages load before it) still read the saved wording.
let liveProtocols = null;
export const rememberProtocols = (protocols) => { if (protocols && !Array.isArray(protocols)) liveProtocols = protocols; };
/** The saved protocol document for a part, when the app has loaded it. */
export const liveProtocol = (part) => liveProtocols?.[part] || null;

/** A protocol rule by id: the saved protocol's, else the national one. */
export const findRule = (part, ruleId, protocols) => {
    for (const source of [(protocols || liveProtocols)?.[part], NATIONAL_PROTOCOLS[part]]) {
        for (const cat of Object.values(source?.categories || {})) {
            const rule = (cat.rules || []).find((r) => r.id === ruleId);
            if (rule) return rule;
        }
    }
    return null;
};

const arabicOf = (en, savedAr) => (savedAr && String(savedAr).trim()) || toArabic(en) || en;

/** The protocol's classification wording for an exercise key, or null. */
export const classificationText = (key, lang = 'en', protocols = null) => {
    const k = String(key).startsWith(CLASS_PREFIX) ? String(key).slice(CLASS_PREFIX.length) : String(key);
    const target = CLASSIFICATION_RULES[k];
    if (!target) return null;
    const rule = findRule(target[0], target[1], protocols);
    const cls = rule?.classification;
    if (!cls?.label) return null;
    return lang === 'ar' ? arabicOf(cls.label, cls.labelAr) : cls.label;
};

/** The protocol colour (bg-red-500 / bg-yellow-400 / bg-green-500) for an exercise key. */
export const classificationColor = (key, protocols = null) => {
    const k = String(key).startsWith(CLASS_PREFIX) ? String(key).slice(CLASS_PREFIX.length) : String(key);
    const target = CLASSIFICATION_RULES[k];
    return target ? findRule(target[0], target[1], protocols)?.classification?.color || null : null;
};

/**
 * The words for one exercise option (classification or treatment) in one
 * language. Classification ids read the protocol; other options carry their
 * English label (written in the national wording) and, when it is not in the
 * national dictionary, their own labelAr.
 */
export const optionText = (option, lang = 'en', { protocols = null, t = null } = {}) => {
    const id = String(option?.id ?? '');
    if (id.startsWith(CLASS_PREFIX)) {
        return classificationText(id, lang, protocols) || (t ? t(id) : id);
    }
    if (id.startsWith('imci.') && t) return t(id);
    const en = option?.label || id;
    return lang === 'ar' ? arabicOf(en, option?.labelAr) : en;
};

/** Protocol colour -> the course-book severity id (constants.js IMNCI_SEVERITIES). */
export const SEVERITY_OF_COLOR = { 'bg-red-500': 'severe', 'bg-pink-500': 'severe', 'bg-yellow-400': 'moderate', 'bg-green-500': 'mild' };
