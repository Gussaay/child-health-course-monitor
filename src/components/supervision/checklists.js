// src/components/supervision/checklists.js
//
// Supervision checklists: the definitions, the scoring and the results each
// dashboard shows. A checklist is DATA, not a component. That is what lets the
// same form renderer handle a yes/no service list, an "available vs need"
// equipment count, an IPC present/action grid or a month-by-month service data
// table without a bespoke screen for each one. A new checklist is added by
// appending one object to SUPERVISION_CHECKLISTS.

// =============================================================================
// Response types
//
// Each one names the columns a section renders and how it scores. Keeping the
// scoring beside the shape means a new section type cannot be added without
// deciding what it contributes to the total.
// =============================================================================

export const RESPONSE_TYPES = {
    // Name and contact for a post. Never scored — it is contact detail.
    staff: { columns: ['name', 'contact'], scored: false },
    // Is the service offered at all?
    yesno: { columns: ['available'], scored: true, boolean: true },
    // How many are there, and how many more are needed?
    available_need: { columns: ['available', 'need'], scored: true },
    // Present, plus the action required when it is not.
    present_action: { columns: ['present', 'action'], scored: true, boolean: true },
    // Present, plus how many records are registered.
    present_number: { columns: ['present', 'number'], scored: true, boolean: true },
    // A published standard to measure against, then what is actually there.
    standard_available_need: {
        columns: ['available', 'need'], scored: true, hasStandard: true,
    },
    // Rows × the section's own columns (numbers, text, dates, choices).
    grid: { scored: false },
    // Rows × the three months of the reporting quarter, with a total.
    monthly: { scored: false },
    // Months from January to the end of the quarter × the section's columns.
    cascade: { scored: false },
    // Strengths, gaps and an action plan.
    findings: { scored: false },
};

// =============================================================================
// NICU Centre of Excellence — initial assessment
//
// Standards in the equipment sections are the UNICEF Toolkit for Setting Up
// Special Care Newborn Units figures printed on the form. They are per unit of
// the stated bed count, so a hospital with a larger unit scales them up; the
// form records the standard as published and the assessor notes the difference.
// =============================================================================

const NICU_COE = {
    id: 'nicu_coe',
    service: 'SSNC',
    title: 'NICU Centre of Excellence — initial assessment',
    titleAr: 'تقييم مبدئي لمركز التميز للعناية المركزة لحديثي الولادة',
    short: 'NICU Centre of Excellence',
    shortAr: 'مركز التميز للعناية المركزة',
    scope: 'hospital',
    sections: [
        {
            id: 'managerial_staff',
            title: 'Managerial staff',
            titleAr: 'الكادر الإداري',
            type: 'staff',
            items: [
                { id: 'hospital_manager', label: 'Hospital manager' },
                { id: 'medical_manager', label: 'Medical manager' },
                { id: 'nurse_manager', label: 'Nurse manager' },
                { id: 'head_nicu', label: 'Head of NICU' },
                { id: 'head_nurse_nicu', label: 'Head Nurse of NICU' },
            ],
        },
        {
            id: 'service_availability',
            title: 'Service availability',
            titleAr: 'توفر الخدمات',
            type: 'yesno',
            items: [
                { id: 'resuscitation', label: 'Resuscitation of asphyxiated / not breathing newborns' },
                { id: 'ward_level1', label: 'Managing sick newborns at neonatal ward (level 1)' },
                { id: 'nicu_level2', label: 'Managing sick newborn at NICU level 2' },
                { id: 'nicu_level3', label: 'Managing sick newborn at NICU level 3' },
                { id: 'followup_clinic', label: 'Follow-up clinic for newborns' },
                { id: 'referral', label: 'Referral services' },
                { id: 'screening', label: 'Routine screening service' },
                { id: 'immunization', label: 'Immunization services' },
                { id: 'bf_counselling', label: 'Breastfeeding counselling service' },
            ],
        },
        {
            id: 'infrastructure',
            title: 'Infrastructure — space',
            titleAr: 'البنية التحتية',
            type: 'available_need',
            items: [
                { id: 'triage_area', label: 'Newborn triaging area' },
                { id: 'stabilizing_area', label: 'Newborn stabilizing area' },
                { id: 'neonatal_ward', label: 'Neonatal ward' },
                { id: 'gowning_room', label: 'Gowning room' },
                { id: 'l2_preterm', label: 'Level 2 pre-term room' },
                { id: 'l2_term', label: 'Level 2 term room' },
                { id: 'l3_room', label: 'Level 3 room' },
                { id: 'sterilization', label: 'Sterilization room' },
                { id: 'isolation', label: 'Isolation room' },
                { id: 'breastfeeding_area', label: 'Breastfeeding area' },
                { id: 'followup_clinic_space', label: 'Follow-up clinic' },
            ],
        },
        {
            id: 'wash',
            title: 'WASH services',
            titleAr: 'خدمات المياه والإصحاح',
            type: 'available_need',
            items: [
                { id: 'toilets', label: 'Number of toilet facilities' },
                { id: 'handwashing', label: 'Number of hand washing facilities' },
                { id: 'water_filter', label: 'Filter for water' },
                { id: 'waste_area', label: 'Waste management area' },
            ],
        },
        {
            id: 'human_resources',
            title: 'Human resources',
            titleAr: 'الموارد البشرية',
            type: 'available_need',
            items: [
                { id: 'neonatologist', label: 'Neonatologist' },
                { id: 'paed_specialist', label: 'Pediatric specialist' },
                { id: 'paed_registrar', label: 'Pediatric registrar' },
                { id: 'paed_medical_officer', label: 'Pediatric medical officer' },
                { id: 'paed_nephrologist', label: 'Pediatric nephrologist' },
                { id: 'paed_cardiologist', label: 'Pediatric cardiologist' },
                { id: 'paed_sister', label: 'Pediatric sister' },
                { id: 'paed_nurse', label: 'Pediatric nurse' },
                { id: 'nutrition_assistant', label: 'Nutrition assistant' },
                { id: 'bf_specialist', label: 'Breastfeeding specialist' },
                { id: 'xray_technician', label: 'X-ray technician' },
            ],
        },
        {
            id: 'ipc',
            title: 'IPC system',
            titleAr: 'نظام مكافحة العدوى',
            type: 'present_action',
            items: [
                { id: 'ipc_focal_person', label: 'IPC focal person', group: 'IPC programme' },
                { id: 'ipc_committee', label: 'IPC committee', group: 'IPC programme' },
                { id: 'ipc_guideline', label: 'Available guideline', group: 'IPC guideline' },
                { id: 'ipc_train_doctors', label: 'Medical doctors trained on IPC', group: 'Training' },
                { id: 'ipc_train_nurses', label: 'Nurses and sisters trained on IPC', group: 'Training' },
                { id: 'ipc_train_managers', label: 'Managerial staff trained on IPC', group: 'Training' },
                { id: 'ipc_train_cleaners', label: 'Cleaners trained on IPC', group: 'Training' },
                { id: 'ipc_surveillance_focal', label: 'Focal person for surveillance', group: 'Surveillance' },
                { id: 'ipc_surveillance_tools', label: 'Tools for surveillance system', group: 'Surveillance' },
            ],
        },
        {
            id: 'information_system',
            title: 'Information system',
            titleAr: 'نظام المعلومات',
            type: 'present_number',
            items: [
                { id: 'register_neonatal', label: 'Available registers for neonatal units' },
                { id: 'register_mortality', label: 'Available registers for neonatal mortality' },
            ],
        },
        {
            id: 'general_tools',
            title: 'General tools',
            titleAr: 'المعينات العامة',
            type: 'available_need',
            items: [
                { id: 'refrigerator', label: 'Refrigerator' },
                { id: 'voltage_stabilizer', label: 'Voltage stabilizer' },
                { id: 'generator', label: 'Generator' },
                { id: 'computer_printer', label: 'Computer with printer' },
                { id: 'ac', label: 'Air conditioning' },
                { id: 'washing_machine', label: 'Washing machine' },
            ],
        },
        {
            id: 'equipment_l2',
            title: 'Level 2 NICU equipment — unit of 12 beds',
            titleAr: 'معدات المستوى الثاني',
            note: 'Special care neonatal unit: infants over 32 weeks and above 1500 g with '
                + 'physiologic immaturity, moderately ill infants expected to resolve rapidly, '
                + 'or infants convalescing from intensive care. Standards from the UNICEF '
                + 'Toolkit for Setting Up Special Care Newborn Units.',
            type: 'standard_available_need',
            items: [
                { id: 'l2_incubator', label: 'Incubator', standard: 9 },
                { id: 'l2_portable_incubator', label: 'Portable incubator', standard: 2 },
                { id: 'l2_baby_cot', label: 'Baby cot', standard: 6 },
                { id: 'l2_infusion_pump', label: 'Infusion pump', standard: 12 },
                { id: 'l2_syringe_pump', label: 'Syringe pump', standard: 3 },
                { id: 'l2_monitor', label: 'Monitor', standard: 12 },
                { id: 'l2_portable_monitor', label: 'Portable monitor', standard: 6 },
                { id: 'l2_phototherapy', label: 'Phototherapy machine (LED type)', standard: 6 },
                { id: 'l2_radiant_warmer', label: 'Radiant warmers / heaters', standard: 2 },
                { id: 'l2_suction', label: 'Suction machines (2 bottles)', standard: 4 },
                { id: 'l2_ambu_bag', label: 'Self-inflating bag (Ambu bag)', standard: 6 },
                { id: 'l2_laryngoscope', label: 'Laryngoscope', standard: 6 },
                { id: 'l2_portable_ventilator', label: 'Portable ventilator', standard: 1 },
                { id: 'l2_bubble_cpap', label: 'Bubble CPAP', standard: 2 },
                { id: 'l2_oxygen_concentrator', label: 'Oxygen concentrator', standard: 4 },
                { id: 'l2_portable_xray', label: 'Portable X-ray', standard: 1 },
                { id: 'l2_portable_ultrasound', label: 'Portable ultrasound', standard: 1 },
                { id: 'l2_glucometer', label: 'Glucometer', standard: 3 },
                { id: 'l2_autoclave', label: 'Autoclave', standard: 1 },
                { id: 'l2_hot_air_oven', label: 'Hot air oven', standard: 1 },
                { id: 'l2_nebulizer', label: 'Nebulizer', standard: 1 },
                { id: 'l2_thermometer', label: 'Thermometer', standard: 12 },
                { id: 'l2_stethoscope', label: 'Stethoscope', standard: 12 },
                { id: 'l2_light_source', label: 'Light source for procedures', standard: 6 },
                { id: 'l2_weighing_scale', label: 'Electronic infant weighing scales', standard: 4 },
            ],
        },
        {
            id: 'equipment_l3',
            title: 'Level 3 NICU equipment — unit of 6 beds',
            titleAr: 'معدات المستوى الثالث',
            note: 'Subspecialty NICU: continuous life support and comprehensive care for '
                + 'extremely high-risk newborns and infants with complex and critical illness.',
            type: 'standard_available_need',
            items: [
                { id: 'l3_incubator', label: 'Incubator', standard: 9 },
                { id: 'l3_portable_incubator', label: 'Portable incubator', standard: 2 },
                { id: 'l3_infusion_pump', label: 'Infusion pump', standard: 12 },
                { id: 'l3_syringe_pump', label: 'Syringe pump', standard: 12 },
                { id: 'l3_apnea_monitor', label: 'Apnea monitor', standard: 1 },
                { id: 'l3_monitor', label: 'Monitor', standard: 6 },
                { id: 'l3_portable_monitor', label: 'Portable monitor', standard: 2 },
                { id: 'l3_phototherapy', label: 'Phototherapy machine (LED type)', standard: 6 },
                { id: 'l3_capsule_phototherapy', label: 'Capsule phototherapy', standard: 1 },
                { id: 'l3_radiant_warmer', label: 'Radiant warmers / heaters', standard: 2 },
                { id: 'l3_suction', label: 'Suction machines (2 bottles)', standard: 2 },
                { id: 'l3_ambu_peep', label: 'Self-inflating bag with PEEP valve', standard: 12 },
                { id: 'l3_laryngoscope', label: 'Laryngoscope', standard: 3 },
                { id: 'l3_ventilator', label: 'Ventilator (neonate)', standard: 3 },
                { id: 'l3_portable_ventilator', label: 'Portable ventilator', standard: 1 },
                { id: 'l3_bipap_cpap', label: 'BiPAP / CPAP', standard: 2 },
                { id: 'l3_bubble_cpap', label: 'Bubble CPAP', standard: 2 },
                { id: 'l3_hfnc', label: 'High flow nasal cannula', standard: 3 },
                { id: 'l3_oxygen_blender', label: 'Oxygen blender', standard: 2 },
                { id: 'l3_blood_gas', label: 'Blood gas analyzer', standard: 1 },
                { id: 'l3_portable_eeg', label: 'Portable EEG', standard: 1 },
                { id: 'l3_portable_ecg', label: 'Portable ECG', standard: 1 },
                { id: 'l3_portable_xray', label: 'Portable X-ray', standard: 1 },
                { id: 'l3_portable_ultrasound', label: 'Portable ultrasound', standard: 1 },
                { id: 'l3_portable_echo', label: 'Portable echocardiography', standard: 1 },
                { id: 'l3_glucometer', label: 'Glucometer', standard: 3 },
                { id: 'l3_autoclave', label: 'Autoclave', standard: 1 },
                { id: 'l3_hot_air_oven', label: 'Hot air oven', standard: 1 },
                { id: 'l3_nebulizer', label: 'Nebulizer', standard: 1 },
                { id: 'l3_thermometer', label: 'Thermometer', standard: 12 },
                { id: 'l3_stethoscope', label: 'Stethoscope', standard: 12 },
                { id: 'l3_light_source', label: 'Light source for procedures', standard: 1 },
                { id: 'l3_weighing_scale', label: 'Electronic infant weighing scales', standard: 3 },
            ],
        },
    ],
};

// =============================================================================
// Scoring
//
// Two different questions, deliberately not averaged into one number:
//   presence  — what share of the things that should exist are there at all
//   adequacy  — for counted items, how close the count is to the standard
//
// An item with no answer is not counted either way. Scoring a blank as zero
// would make a half-finished assessment look like a failing facility.
// =============================================================================

// A cleared input is '' — and Number('') is 0, which would score a blank as an
// answer of nothing. Blank stays blank.
export const toNum = (v) => {
    if (v == null || (typeof v === 'string' && v.trim() === '')) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export function scoreSection(section, responses = {}) {
    const type = RESPONSE_TYPES[section.type];
    if (!type?.scored) return null;

    let answered = 0;
    let present = 0;
    let standardTotal = 0;
    let availableTotal = 0;

    section.items.forEach((item) => {
        const r = responses[item.id] || {};

        if (type.boolean) {
            const value = section.type === 'yesno' ? r.available : r.present;
            if (value === true || value === false) {
                answered += 1;
                if (value === true) present += 1;
            }
            return;
        }

        const available = toNum(r.available);
        if (available == null) return;
        answered += 1;
        if (available > 0) present += 1;

        if (type.hasStandard && item.standard > 0) {
            standardTotal += item.standard;
            // Capped per item: three spare glucometers do not compensate for a
            // missing ventilator, and an uncapped sum would let them.
            availableTotal += Math.min(available, item.standard);
        }
    });

    return {
        answered,
        total: section.items.length,
        present,
        presencePercent: answered ? (present / answered) * 100 : null,
        adequacyPercent: standardTotal ? (availableTotal / standardTotal) * 100 : null,
    };
}

export function scoreAssessment(checklist, responses = {}) {
    const sections = {};
    let answered = 0;
    let total = 0;
    let present = 0;

    (checklist?.sections || []).forEach((section) => {
        const s = scoreSection(section, responses[section.id] || {});
        if (!s) return;
        sections[section.id] = s;
        answered += s.answered;
        total += s.total;
        present += s.present;
    });

    return {
        sections,
        answered,
        total,
        present,
        completionPercent: total ? (answered / total) * 100 : 0,
        presencePercent: answered ? (present / answered) * 100 : null,
    };
}

export const pctText = (v) => (v == null ? '—' : `${Math.round(v)}%`);

export const toneFor = (v) => {
    if (v == null) return 'bg-gray-100 text-gray-600';
    if (v < 50) return 'bg-red-100 text-red-800';
    if (v < 80) return 'bg-amber-100 text-amber-800';
    return 'bg-green-100 text-green-800';
};

// =============================================================================
// Portable Infant Warmer — supervision checklist
//
// Transcribed from the National Child Health Program "Portable Infant Warmer
// Supervision Checklist". Unlike the NICU assessment it is mostly counts in
// tables (component × status, month × indicator), so its sections use the
// grid, monthly and cascade types below and it has its own results
// (warmerResults) instead of the presence score.
//
// Labels carry their Arabic beside the English (`ar`) rather than living in
// i18n.js: they are form content, and keeping both languages next to the item
// is what makes the next checklist a single object to paste.
// =============================================================================

const WARMER_COMPONENTS = [
    { id: 'nest', label: 'Heating unit (Nest)', ar: 'وحدة التدفئة (Nest)' },
    { id: 'warmpak', label: 'Warmpak (thermal material)', ar: 'Warmpak (المادة الحرارية)' },
    { id: 'wrap', label: 'Baby wrap', ar: 'لفافة الطفل' },
];

const YES_NO_COMMENT_COLUMNS = [
    { id: 'answer', label: 'Yes / No', ar: 'نعم / لا', kind: 'yesno' },
    { id: 'comment', label: 'Comment', ar: 'ملاحظة', kind: 'text', wide: true },
];

const INFANT_WARMER = {
    id: 'infant_warmer',
    service: 'SSNC',
    title: 'Portable infant warmer — supervision checklist',
    titleAr: 'قائمة الإشراف على الدفايات المحمولة لحديثي الولادة',
    short: 'Infant warmer',
    shortAr: 'الدفاية المحمولة',
    scope: 'facility',
    // Section D asks for one quarter of service data and E1 for the year to
    // date, so the form records which quarter it covers.
    usesPeriod: true,
    headerFields: [
        {
            id: 'facilityType', label: 'Facility type', ar: 'نوع المنشأة', kind: 'select',
            options: [
                { value: 'hospital', label: 'Hospital', ar: 'مستشفى' },
                { value: 'health_centre', label: 'Health centre', ar: 'مركز صحي' },
                { value: 'other', label: 'Other', ar: 'أخرى' },
            ],
        },
        { id: 'focalName', label: 'Focal person name', ar: 'اسم ضابط الاتصال' },
        { id: 'focalTitle', label: 'Focal person job title', ar: 'المسمى الوظيفي لضابط الاتصال' },
        { id: 'focalPhone', label: 'Focal person phone', ar: 'هاتف ضابط الاتصال', type: 'tel' },
    ],
    sections: [
        {
            id: 'devices',
            title: 'B. Portable warmer devices — availability and location',
            titleAr: 'ب. أجهزة التدفئة المحمولة — التوفر والموقع',
            type: 'grid',
            columns: WARMER_COMPONENTS.map((c) => ({ ...c, kind: 'number' })),
            items: [
                { id: 'distributed', label: 'Number distributed to facility', ar: 'العدد الموزع للمنشأة' },
                { id: 'functioning', label: 'Number functioning', ar: 'العدد الذي يعمل' },
                { id: 'needs_repair', label: 'Number needing repair', ar: 'العدد الذي يحتاج صيانة' },
                { id: 'lost', label: 'Number lost / missing', ar: 'العدد المفقود' },
                { id: 'in_labour', label: 'Number in labour / delivery room', ar: 'العدد في غرفة الولادة', group: 'location' },
                { id: 'in_theatre', label: 'Number in operating theatre', ar: 'العدد في غرفة العمليات', group: 'location' },
                { id: 'in_postnatal', label: 'Number in postnatal ward', ar: 'العدد في عنبر ما بعد الولادة', group: 'location' },
                { id: 'in_neonatal', label: 'Number in neonatal unit', ar: 'العدد في وحدة حديثي الولادة', group: 'location' },
                { id: 'in_store', label: 'Number in store / not in use', ar: 'العدد في المخزن / غير مستخدم', group: 'location' },
            ],
        },
        {
            id: 'repairs',
            title: 'B. Devices needing repair',
            titleAr: 'ب. الأجهزة التي تحتاج صيانة',
            note: 'Common faults to probe: not heating, indicator light not working, Warmpak damaged or leaking, '
                + 'wrap torn or soiled, charger missing, unstable power supply.',
            noteAr: 'أعطال شائعة للسؤال عنها: لا يسخن، ضوء المؤشر لا يعمل، تلف أو تسرب Warmpak، '
                + 'تمزق أو اتساخ اللفافة، فقدان الشاحن، عدم استقرار الكهرباء.',
            type: 'grid',
            columns: [
                { id: 'number', label: 'Number needing repair', ar: 'العدد', kind: 'number' },
                { id: 'fault', label: 'Fault description', ar: 'وصف العطل', kind: 'text', wide: true },
                { id: 'since', label: 'Date fault started', ar: 'تاريخ بدء العطل', kind: 'date' },
                {
                    id: 'reported_to', label: 'Reported to', ar: 'تم الإبلاغ إلى', kind: 'select',
                    options: [
                        { value: 'state', label: 'State', ar: 'الولاية' },
                        { value: 'embrace', label: 'Embrace', ar: 'Embrace' },
                        { value: 'other', label: 'Other', ar: 'أخرى' },
                        { value: 'not_reported', label: 'Not reported', ar: 'لم يُبلّغ' },
                    ],
                },
            ],
            items: [
                ...WARMER_COMPONENTS,
                { id: 'charger', label: 'Charger / power cable', ar: 'الشاحن / كابل الكهرباء' },
            ],
        },
        {
            id: 'use_practices',
            title: 'B. Use practices (observe / ask)',
            titleAr: 'ب. ممارسات الاستخدام (ملاحظة / سؤال)',
            type: 'grid',
            columns: YES_NO_COMMENT_COLUMNS,
            items: [
                { id: 'staff_trained', label: 'Staff trained on portable warmer use in this unit', ar: 'الكادر مدرب على استخدام الدفاية المحمولة في هذه الوحدة' },
                { id: 'staff_trained_number', label: 'Number of staff trained', ar: 'عدد الكادر المدرب', answerKind: 'number' },
                { id: 'charged_ready', label: 'Warmer charged / ready for use at time of visit', ar: 'الدفاية مشحونة / جاهزة للاستخدام وقت الزيارة' },
                { id: 'cleaned', label: 'Warmer cleaned after each use', ar: 'تنظيف الدفاية بعد كل استخدام' },
                { id: 'temp_checked', label: 'Warmer temperature checked before use', ar: 'فحص حرارة الدفاية قبل الاستخدام' },
                { id: 'baby_temp_monitored', label: 'Baby temperature monitored during use', ar: 'متابعة حرارة الطفل أثناء الاستخدام' },
            ],
        },
        {
            id: 'thermal_equipment',
            title: 'C. Other thermal care equipment',
            titleAr: 'ج. معدات الرعاية الحرارية الأخرى',
            type: 'grid',
            columns: [
                { id: 'total', label: 'Total number', ar: 'العدد الكلي', kind: 'number' },
                { id: 'functioning', label: 'Number functioning', ar: 'العدد الذي يعمل', kind: 'number' },
                { id: 'not_functioning', label: 'Number not functioning', ar: 'العدد الذي لا يعمل', kind: 'number' },
            ],
            items: [
                { id: 'incubator_nicu', label: 'Incubator — neonatal unit', ar: 'حضانة — وحدة حديثي الولادة' },
                { id: 'radiant_labour', label: 'Radiant warmer — labour / delivery room', ar: 'دفاية إشعاعية — غرفة الولادة' },
                { id: 'radiant_theatre', label: 'Radiant warmer — operating theatre', ar: 'دفاية إشعاعية — غرفة العمليات' },
                { id: 'radiant_nicu', label: 'Radiant warmer — neonatal unit', ar: 'دفاية إشعاعية — وحدة حديثي الولادة' },
                { id: 'transport_incubator', label: 'Transport incubator', ar: 'حضانة نقل' },
                { id: 'kmc_beds', label: 'KMC beds / chairs — KMC unit / ward', ar: 'أسرّة / كراسي رعاية الكنغر' },
            ],
        },
        {
            id: 'service_data',
            title: 'D. Facility service data',
            titleAr: 'د. بيانات خدمات المنشأة',
            note: 'When use is not documented, ask staff how many babies are placed in the warmer per day or week and '
                + 'enter it in D7. Estimated need = the larger of preterm (D3) and low birth weight (D4) babies; when '
                + 'neither is recorded, 18% of live births (D2).',
            noteAr: 'عند عدم توثيق الاستخدام، اسأل الكادر عن عدد الأطفال الذين يوضعون في الدفاية يومياً أو أسبوعياً وسجّله في D7. '
                + 'الاحتياج المقدّر = الأكبر بين الخدج (D3) وناقصي الوزن (D4)؛ وإن لم يُسجّلا، 18% من المواليد الأحياء (D2).',
            type: 'monthly',
            items: [
                { id: 'deliveries', code: 'D1', label: 'Number of deliveries in the facility', ar: 'عدد الولادات في المنشأة' },
                { id: 'live_births', code: 'D2', label: 'Number of live births', ar: 'عدد المواليد الأحياء' },
                { id: 'preterm', code: 'D3', label: 'Number of preterm babies (< 37 weeks)', ar: 'عدد الخدج (أقل من 37 أسبوعاً)' },
                { id: 'lbw', code: 'D4', label: 'Number of low birth weight babies (< 2.5 kg)', ar: 'عدد ناقصي الوزن (أقل من 2.5 كجم)' },
                { id: 'neonatal_deaths', code: 'D5', label: 'Number of neonatal deaths', ar: 'عدد وفيات حديثي الولادة' },
                { id: 'placed_documented', code: 'D6', label: 'Babies placed in portable warmer (documented)', ar: 'عدد الأطفال الذين وُضعوا في الدفاية (موثّق)' },
                { id: 'placed_estimated', code: 'D7', label: 'Babies placed in portable warmer (staff estimate, when not documented)', ar: 'عدد الأطفال الذين وُضعوا في الدفاية (تقدير الكادر عند عدم التوثيق)' },
            ],
        },
        {
            id: 'information_system',
            title: 'E. Information system',
            titleAr: 'هـ. نظام المعلومات',
            type: 'grid',
            columns: YES_NO_COMMENT_COLUMNS,
            items: [
                { id: 'register_available', label: 'Portable warmer register / usage form available in the facility', ar: 'سجل / استمارة استخدام الدفاية متوفر في المنشأة' },
                { id: 'national_register_used', label: 'National portable warmer register used to fill information', ar: 'استخدام السجل القومي للدفاية لتعبئة المعلومات' },
                { id: 'forms_complete', label: 'Forms filled completely (5 random forms: monitoring table and final outcome)', ar: 'الاستمارات مكتملة (5 استمارات عشوائية: جدول المتابعة والنتيجة النهائية)' },
                { id: 'dhis2_entered', label: 'Data entered in DHIS2', ar: 'إدخال البيانات في DHIS2' },
            ],
        },
        {
            id: 'reporting_cascade',
            title: 'E1. Reporting cascade',
            titleAr: 'هـ1. تسلسل الإبلاغ',
            note: 'January to the end of the reporting quarter. Estimated need uses the method in section D.',
            noteAr: 'من يناير حتى نهاية ربع الإبلاغ. الاحتياج المقدّر يُحسب بطريقة القسم د.',
            type: 'cascade',
            columns: [
                { id: 'need', label: 'Estimated babies needing warming', ar: 'الأطفال المقدّر احتياجهم للتدفئة', kind: 'number' },
                { id: 'received', label: 'Received portable warming', ar: 'تلقّوا التدفئة المحمولة', kind: 'number' },
                { id: 'registered', label: 'Registered in warmer register', ar: 'مسجّلون في سجل الدفاية', kind: 'number' },
                { id: 'dhis2', label: 'Entered in DHIS2', ar: 'مُدخلون في DHIS2', kind: 'number' },
            ],
        },
        {
            id: 'findings',
            title: 'F. Findings and action points',
            titleAr: 'و. النتائج ونقاط العمل',
            type: 'findings',
        },
    ],
};

// =============================================================================
// Services
//
// The same split as skills mentorship: pick the service first, then its
// checklists. A service with no checklist yet is shown but disabled.
// =============================================================================

export const SUPERVISION_SERVICES = [
    { key: 'SSNC', title: 'Small and sick newborn care', titleAr: 'رعاية حديثي الولادة المرضى وناقصي الوزن' },
    { key: 'IMNCI', title: 'Integrated Management of Newborn and Childhood Illness', titleAr: 'المعالجة المتكاملة لأمراض الطفولة وحديثي الولادة' },
    { key: 'EENC', title: 'Early Essential Newborn Care', titleAr: 'الرعاية الأساسية المبكرة لحديثي الولادة' },
    { key: 'ETAT', title: 'Emergency Triage, Assessment and Treatment', titleAr: 'الفرز والتقييم والعلاج في الطوارئ' },
    { key: 'IPC', title: 'Infection Prevention and Control', titleAr: 'الوقاية من العدوى ومكافحتها' },
];

export const SUPERVISION_CHECKLISTS = [NICU_COE, INFANT_WARMER];

export const getChecklist = (id) => SUPERVISION_CHECKLISTS.find((c) => c.id === id) || null;

export const checklistsForService = (service) => SUPERVISION_CHECKLISTS.filter((c) => c.service === service);

// Picks the Arabic or English text of a label object ({ label, ar } or
// { title, titleAr }).
export const pickLabel = (obj, isArabic) => {
    if (!obj) return '';
    if (isArabic) return obj.ar || obj.titleAr || obj.label || obj.title || '';
    return obj.label || obj.title || '';
};

// =============================================================================
// Reporting period
//
// periodStart is the first month of the quarter, as 'YYYY-MM'. Monthly answers
// are keyed by that same 'YYYY-MM', so moving the period never relabels data
// already entered for other months.
// =============================================================================

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const monthKey = (year, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

// The quarter before the visit: a visit in October reports July to September.
export function defaultPeriodStart(visitDate) {
    const d = visitDate ? new Date(`${visitDate}T00:00:00`) : new Date();
    const valid = Number.isFinite(d.getTime()) ? d : new Date();
    let year = valid.getFullYear();
    let quarter = Math.floor(valid.getMonth() / 3) - 1;
    if (quarter < 0) { quarter = 3; year -= 1; }
    return monthKey(year, quarter * 3);
}

const parsePeriod = (periodStart) => {
    const m = /^(\d{4})-(\d{2})$/.exec(periodStart || '');
    if (!m) return null;
    const monthIndex = Number(m[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) return null;
    return { year: Number(m[1]), monthIndex };
};

export const monthLabel = (key, isArabic) => {
    const p = parsePeriod(key);
    if (!p) return key;
    return `${(isArabic ? MONTH_NAMES_AR : MONTH_NAMES)[p.monthIndex]} ${p.year}`;
};

// The three months of section D.
export function periodMonths(periodStart) {
    const p = parsePeriod(periodStart);
    if (!p) return [];
    return [0, 1, 2].map((i) => {
        const idx = p.monthIndex + i;
        return monthKey(p.year + Math.floor(idx / 12), idx % 12);
    });
}

// The months of E1: January of the quarter's last month's year, up to it.
export function cascadeMonths(periodStart) {
    const months = periodMonths(periodStart);
    if (!months.length) return [];
    const last = parsePeriod(months[2]);
    return Array.from({ length: last.monthIndex + 1 }, (_, i) => monthKey(last.year, i));
}

// =============================================================================
// Infant warmer results
//
// Every figure the form's calculation table and the dashboard show comes from
// here, so the two can never disagree. Blank answers are left out of a ratio,
// not counted as zero, for the same reason as the presence score above.
// =============================================================================

const sumKnown = (values) => {
    const known = values.filter((v) => v != null);
    return known.length ? known.reduce((a, b) => a + b, 0) : null;
};

export const ratio = (num, den) => (num != null && den ? (num / den) * 100 : null);

// Estimated need for one month, as section D's "how to estimate" describes.
export function estimateNeed(liveBirths, preterm, lbw) {
    if (preterm != null || lbw != null) return Math.max(preterm || 0, lbw || 0);
    if (liveBirths != null) return Math.round(liveBirths * 0.18);
    return null;
}

export function serviceDataCalc(responses = {}, periodStart) {
    const d = responses.service_data || {};
    const val = (row, m) => toNum(d[row]?.[m]);
    const months = periodMonths(periodStart).map((m) => {
        const need = estimateNeed(val('live_births', m), val('preterm', m), val('lbw', m));
        const documented = val('placed_documented', m);
        const placed = documented != null ? documented : val('placed_estimated', m);
        return { month: m, need, placed, coverage: ratio(placed, need) };
    });
    const need = sumKnown(months.map((m) => m.need));
    const placed = sumKnown(months.map((m) => m.placed));
    return { months, total: { need, placed, coverage: ratio(placed, need) } };
}

export function cascadeCalc(responses = {}, periodStart) {
    const c = responses.reporting_cascade || {};
    const totals = {};
    ['need', 'received', 'registered', 'dhis2'].forEach((col) => {
        totals[col] = sumKnown(cascadeMonths(periodStart).map((m) => toNum(c[m]?.[col])));
    });
    return {
        totals,
        coverage: ratio(totals.received, totals.need),
        registration: ratio(totals.registered, totals.received),
        dhis2: ratio(totals.dhis2, totals.registered),
    };
}

const yesShare = (section, responses, skip = []) => {
    let answered = 0;
    let yes = 0;
    section.items.forEach((item) => {
        if (item.answerKind || skip.includes(item.id)) return;
        const a = responses?.[item.id]?.answer;
        if (a === true || a === false) { answered += 1; if (a) yes += 1; }
    });
    return { answered, yes, percent: ratio(yes, answered) };
};

export function warmerResults(responses = {}, periodStart) {
    const sectionOf = (id) => INFANT_WARMER.sections.find((s) => s.id === id);
    const devices = responses.devices || {};
    const components = {};
    WARMER_COMPONENTS.forEach(({ id }) => {
        const get = (row) => toNum(devices[row]?.[id]);
        const distributed = get('distributed');
        const functioning = get('functioning');
        components[id] = {
            distributed, functioning,
            needsRepair: get('needs_repair'),
            lost: get('lost'),
            locations: Object.fromEntries(['in_labour', 'in_theatre', 'in_postnatal', 'in_neonatal', 'in_store'].map((r) => [r, get(r)])),
            functioningPercent: ratio(functioning, distributed),
        };
    });

    const equipment = responses.thermal_equipment || {};
    const eqTotal = sumKnown(sectionOf('thermal_equipment').items.map((i) => toNum(equipment[i.id]?.total)));
    const eqFunctioning = sumKnown(sectionOf('thermal_equipment').items.map((i) => toNum(equipment[i.id]?.functioning)));

    const service = serviceDataCalc(responses, periodStart);
    const cascade = cascadeCalc(responses, periodStart);

    return {
        components,
        nestFunctioningPercent: components.nest.functioningPercent,
        practices: yesShare(sectionOf('use_practices'), responses.use_practices),
        staffTrained: toNum(responses.use_practices?.staff_trained_number?.answer),
        infoSystem: yesShare(sectionOf('information_system'), responses.information_system),
        equipment: { total: eqTotal, functioning: eqFunctioning, percent: ratio(eqFunctioning, eqTotal) },
        service,
        cascade,
        actionCount: (responses.findings?.actions || []).filter((a) => a?.action?.trim()).length,
    };
}

export const INFANT_WARMER_COMPONENTS = WARMER_COMPONENTS;
