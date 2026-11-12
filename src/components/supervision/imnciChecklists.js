// src/components/supervision/imnciChecklists.js
//
// The two IMNCI supervision forms, transcribed from the National Child Health
// Program's Arabic paper forms:
//
//   - imnci_facility_readiness: supervision of health centres and units and
//     readiness of the facility to apply IMNCI. Submitting it also updates the
//     facility's IMNCI information (the same fields the "Update IMNCI facility
//     information" form edits) through imnciFacilityPatch below.
//   - imnci_drugs: form 7-C, free medicine and availability of IMNCI drugs and
//     supplies.
//
// Both are plain checklist objects like the ones in checklists.js. What they
// add on top:
//   - a grid section may name a `presenceColumn`: its yes/no column counts
//     towards "present" (rows with an answerKind are information, not scored);
//   - `metrics(form)` gives the headline figures shown on the form, in the
//     list and on the dashboard; `headline` names the one the list shows.
//
// This file imports nothing from checklists.js so that checklists.js can
// import it without a cycle.

const toNum = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const pct = (num, den) => (num != null && den ? (num / den) * 100 : null);

const YES_NO_COMMENT = [
    { id: 'answer', label: 'Yes / No', ar: 'نعم / لا', kind: 'yesno' },
    { id: 'comment', label: 'Notes', ar: 'ملاحظات', kind: 'text', wide: true },
];

// Share of the presence rows of a grid section answered yes. Rows with an
// answerKind (counts, choices) and rows switched off by `dependsOn` are left out.
export function gridPresence(section, values = {}) {
    const col = section.presenceColumn;
    if (!col) return null;
    let answered = 0;
    let yes = 0;
    section.items.forEach((item) => {
        if (item.answerKind || item.notScored) return;
        if (item.dependsOn && values[item.dependsOn]?.answer === false) return;
        const v = values[item.id]?.[col];
        if (v === true || v === false) {
            answered += 1;
            if (v) yes += 1;
        }
    });
    return { answered, yes, total: section.items.filter((i) => !i.answerKind && !i.notScored).length, percent: pct(yes, answered) };
}

const presenceOver = (checklist, responses, sectionIds) => {
    let answered = 0;
    let yes = 0;
    checklist.sections.filter((s) => sectionIds.includes(s.id)).forEach((s) => {
        const p = gridPresence(s, responses?.[s.id]);
        if (!p) return;
        answered += p.answered;
        yes += p.yes;
    });
    return { answered, yes, percent: pct(yes, answered) };
};

// =============================================================================
// Health centre supervision and IMNCI facility readiness
// =============================================================================

const STAFF_ROWS = [
    { id: 'doctor', label: 'Doctor', ar: 'طبيب' },
    { id: 'medical_assistant', label: 'Medical assistant', ar: 'مساعد طبي' },
    { id: 'health_assistant', label: 'Health assistant', ar: 'معاون صحي' },
    { id: 'nurse', label: 'Nurse', ar: 'ممرض / ممرضة' },
    { id: 'other', label: 'Other (specify in notes)', ar: 'أخرى (حدد في الملاحظات)' },
];

export const READINESS_PART_ONE = ['measure', 'malaria', 'clinic', 'ort', 'epi', 'ipc'];

export const IMNCI_FACILITY_READINESS = {
    id: 'imnci_facility_readiness',
    service: 'IMNCI',
    title: 'Health centre supervision and IMNCI facility readiness',
    titleAr: 'استمارة الإشراف على المراكز والوحدات الصحية وتقييم جاهزية المرفق الصحي لتطبيق العلاج المتكامل',
    short: 'IMNCI facility readiness',
    shortAr: 'جاهزية المرفق للعلاج المتكامل',
    description: 'Equipment, malaria testing, IMNCI clinic, ORT corner, immunization, IPC, staff, records and an action plan. Submitting updates the facility\'s IMNCI information.',
    descriptionAr: 'معدات القياس وفحص الملاريا وعيادة العلاج المتكامل وركن الإرواء والتحصين والوقاية من العدوى والكوادر والسجلات وخطة الإجراءات. الإرسال يحدّث معلومات العلاج المتكامل للمرفق.',
    icon: 'stethoscope',
    scope: 'facility',
    syncsFacility: true,
    headline: 'readiness',
    headerFields: [
        {
            id: 'facilityType', label: 'Facility type', ar: 'نوع المرفق', kind: 'select',
            options: [
                { value: 'health_centre', label: 'Health centre', ar: 'مركز صحي' },
                { value: 'health_unit', label: 'Health unit', ar: 'وحدة صحية' },
                { value: 'other', label: 'Other', ar: 'أخرى' },
            ],
        },
        { id: 'supervisorOrg', label: 'Supervisor\'s organisation', ar: 'الجهة التي يعمل بها المشرف' },
        { id: 'facilityInCharge', label: 'Person in charge of the facility', ar: 'المسؤول عن المرفق' },
        { id: 'lastSupervisionDate', label: 'Date of last supervision visit', ar: 'تاريخ آخر زيارة إشرافية', type: 'date' },
        { id: 'avgDailyUnder5', label: 'Average under-5 attendance per day', ar: 'متوسط تردد الأطفال دون 5 سنوات يومياً', type: 'number' },
    ],
    sections: [
        {
            id: 'measure',
            title: '1. Measuring equipment (working)',
            titleAr: '1/ معدات القياس (تعمل)',
            type: 'grid',
            presenceColumn: 'answer',
            columns: YES_NO_COMMENT,
            items: [
                { id: 'scale', label: 'Weighing scale (infants and children)', ar: 'ميزان وزن (رضع وأطفال)' },
                { id: 'height', label: 'Height / length board', ar: 'مقياس طول' },
                { id: 'thermometer', label: 'Thermometer', ar: 'مقياس درجة الحرارة' },
                { id: 'timer', label: 'Watch or breath timer (at least one per clinic)', ar: 'ساعة ضبط أو مؤقت تنفس (واحد على الأقل لكل عيادة)' },
                { id: 'muac', label: 'MUAC tape', ar: 'شريط قياس محيط منتصف الذراع (MUAC)' },
            ],
        },
        {
            id: 'malaria',
            title: '2. Malaria testing equipment',
            titleAr: '2/ معدات فحص الملاريا',
            type: 'grid',
            presenceColumn: 'answer',
            columns: YES_NO_COMMENT,
            items: [
                { id: 'microscope', label: 'Working microscope', ar: 'مايكروسكوب يعمل' },
                { id: 'rdt', label: 'Malaria rapid diagnostic tests', ar: 'شرائط فحص الملاريا السريع' },
                { id: 'slides', label: 'Malaria slides', ar: 'شرائح فحص الملاريا' },
                { id: 'giemsa', label: 'Giemsa stain', ar: 'صبغة جيمسا' },
            ],
        },
        {
            id: 'clinic',
            title: '3. IMNCI clinic and records',
            titleAr: '3/ عيادة العلاج المتكامل والسجلات',
            type: 'grid',
            presenceColumn: 'answer',
            columns: YES_NO_COMMENT,
            items: [
                { id: 'space', label: 'Examination space, table and chairs, waiting seats for mother and child', ar: 'مكان للمعاينة، طاولة وكراسي، ومقاعد انتظار للأم والطفل' },
                { id: 'wall_charts', label: 'Up-to-date wall charts', ar: 'لوحات حائط محدثة' },
                { id: 'chart_booklet', label: 'Chart booklet: a copy for each treating health worker', ar: 'كتيب اللوحات: نسخة لكل كادر معالج' },
                { id: 'form_sick_child', label: 'IMNCI recording form, sick child (2 months – 5 years), enough for at least 3 months', ar: 'استمارة العلاج المتكامل للطفل المريض (شهران - 5 سنوات) تكفي 3 أشهر على الأقل' },
                { id: 'form_young_infant', label: 'IMNCI recording form, young infant (under 2 months), enough for at least 3 months', ar: 'استمارة العلاج المتكامل للوليد (أقل من شهرين) تكفي 3 أشهر على الأقل' },
                { id: 'daily_register', label: 'Daily case register', ar: 'سجل التسجيل اليومي للحالات' },
                { id: 'mother_cards', label: 'Mother\'s counselling cards', ar: 'كروت إرشاد الأم' },
                { id: 'referral_form', label: 'Referral form', ar: 'استمارة الإحالة' },
            ],
        },
        {
            id: 'ort',
            title: '4. ORT corner (room)',
            titleAr: '4/ ركن (غرفة) الإرواء',
            type: 'grid',
            presenceColumn: 'answer',
            columns: YES_NO_COMMENT,
            items: [
                { id: 'ort_corner', label: 'A working ORT corner', ar: 'يوجد ركن إرواء عامل' },
                { id: 'ort_equipment', label: 'ORT corner equipment complete (table and chairs, cups, spoons, jug, measuring and mixing tools)', ar: 'معدات ركن الإرواء مكتملة (طاولة وكراسي، أكواب، ملاعق، جك، أدوات قياس وخلط)' },
                { id: 'safe_water', label: 'Safe water source close to the health worker', ar: 'مصدر ماء آمن قريب من العامل الصحي' },
                { id: 'ort_register', label: 'ORS administration register', ar: 'سجل مراقبة إعطاء محلول الإرواء' },
                { id: 'health_education', label: 'Health education sessions for mothers are held there', ar: 'تُعقد به جلسات تثقيف صحي للأمهات' },
            ],
        },
        {
            id: 'epi',
            title: '5. Immunization services',
            titleAr: '5/ خدمات التحصين',
            note: 'If the facility has no immunization services, the rest of this section is skipped.',
            noteAr: 'إذا لا توجد خدمات تحصين بالمرفق، تُتخطى بقية هذا القسم.',
            type: 'grid',
            presenceColumn: 'answer',
            columns: YES_NO_COMMENT,
            items: [
                { id: 'epi_services', label: 'The facility offers immunization services', ar: 'توجد خدمات تحصين بالمرفق' },
                { id: 'strategy_fixed', label: 'Strategy: fixed', ar: 'استراتيجية التحصين: ثابتة', answerKind: 'yesno', dependsOn: 'epi_services', optional: true, group: 'strategy' },
                { id: 'fixed_days', label: 'Fixed immunization days per week', ar: 'عدد أيام التحصين الثابت بالمرفق في الأسبوع', answerKind: 'number', dependsOn: 'epi_services', optional: true, group: 'strategy' },
                { id: 'strategy_outreach', label: 'Strategy: outreach', ar: 'استراتيجية التحصين: فرعي', answerKind: 'yesno', dependsOn: 'epi_services', optional: true, group: 'strategy' },
                { id: 'strategy_mobile', label: 'Strategy: mobile', ar: 'استراتيجية التحصين: جوال', answerKind: 'yesno', dependsOn: 'epi_services', optional: true, group: 'strategy' },
                { id: 'outreach_sessions', label: 'Outreach / mobile sessions per month', ar: 'عدد جلسات التحصين الفرعي / الجوال في الشهر', answerKind: 'number', dependsOn: 'epi_services', optional: true, group: 'strategy' },
                { id: 'road_to_health', label: 'Road-to-health cards available', ar: 'توجد كروت الطريق إلى الصحة', dependsOn: 'epi_services' },
                { id: 'vaccines_available', label: 'All vaccines available on immunization day (if not, note the shortage)', ar: 'كل اللقاحات متوفرة في يوم التحصين (إذا لا، حدد النقص في الملاحظات)', dependsOn: 'epi_services' },
                { id: 'fridge', label: 'Vaccine fridge works and its temperature chart is filled', ar: 'ثلاجة اللقاحات تعمل ويُسجَّل فيها جدول درجة الحرارة', dependsOn: 'epi_services' },
                { id: 'vaccine_storage', label: 'Vaccines are stored correctly', ar: 'تُحفظ اللقاحات بطريقة صحيحة', dependsOn: 'epi_services' },
            ],
            groups: { strategy: { label: 'Immunization strategy', ar: 'نوع استراتيجية التحصين' } },
        },
        {
            id: 'ipc',
            title: '6. Infection prevention (always available)',
            titleAr: '6/ الوقاية من العدوى (متوفر دائماً)',
            type: 'grid',
            presenceColumn: 'answer',
            columns: YES_NO_COMMENT,
            items: [
                { id: 'handwash', label: 'Water and soap or sanitiser for hand washing', ar: 'ماء وصابون أو مطهر لغسل الأيدي' },
                { id: 'sharps_box', label: 'Safety box for sharps, and auto-disable syringes', ar: 'صندوق آمن للنفايات الحادة، وحقن ذاتية التعطيل' },
            ],
        },
        {
            id: 'staff',
            title: '7. Health workers at the facility',
            titleAr: '7/ معلومات مقدمي الخدمة العاملين بالمرفق',
            note: 'Readiness minimum: at least one trained treating health worker, and 60% or more of treating staff trained in IMNCI.',
            noteAr: 'الحد الأدنى للجاهزية: كادر مدرَّب واحد على الأقل، و60% فأكثر من الكوادر المعالجة مدرَّبة.',
            type: 'grid',
            totalRow: true,
            columns: [
                { id: 'total', label: 'Number', ar: 'العدد', kind: 'number' },
                { id: 'trained', label: 'Trained in IMNCI', ar: 'مدرَّب على المعالجة القياسية', kind: 'number' },
                { id: 'notes', label: 'Notes', ar: 'ملاحظات', kind: 'text', wide: true },
            ],
            items: STAFF_ROWS.map((r) => ({ ...r, optional: r.id === 'other' })),
        },
        {
            id: 'records',
            title: 'Part 2. Records and reports',
            titleAr: 'الجزء الثاني: السجلات والتقارير',
            type: 'grid',
            presenceColumn: 'answer',
            columns: YES_NO_COMMENT,
            items: [
                { id: 'forms_filled', label: 'A form was filled for every child treated (check a sample of 10 forms)', ar: 'مُلئت استمارة لكل طفل عولج في الفترة السابقة (راجع عينة من 10 استمارات)' },
                { id: 'register_correct', label: 'Daily register filled in correctly', ar: 'سجل التسجيل اليومي مملوء بطريقة صحيحة' },
                { id: 'monthly_report_copy', label: 'Copy of last month\'s monthly report available', ar: 'توجد نسخة من التقرير الشهري للشهر السابق' },
                { id: 'report_sent', label: 'Monthly report sent to the locality on time', ar: 'أُرسل التقرير الشهري للمحلية في موعده' },
            ],
        },
        {
            id: 'findings',
            title: 'Part 3. Conclusion and action plan',
            titleAr: 'الجزء الثالث: الخلاصة وخطة الإجراءات',
            type: 'findings',
            gapsLabel: { label: 'Main gaps in readiness and tools', ar: 'أهم الفجوات في الجاهزية والأدوات' },
            actionLabel: { label: 'Agreed action', ar: 'الإجراء المتفق عليه' },
            extraActionColumns: [
                { id: 'problem', label: 'Problem', ar: 'المشكلة', kind: 'text' },
                {
                    id: 'level', label: 'Level to solve', ar: 'مستوى الحل', kind: 'select',
                    options: [
                        { value: 'facility', label: 'Facility', ar: 'المرفق' },
                        { value: 'locality', label: 'Locality', ar: 'المحلية' },
                        { value: 'state', label: 'State', ar: 'الولاية' },
                    ],
                },
            ],
        },
        {
            id: 'follow_up',
            title: 'Follow-up',
            titleAr: 'المتابعة',
            type: 'fields',
            items: [
                {
                    id: 'previous_actions', label: 'Were the previous visit\'s actions carried out?', ar: 'هل نُفذت إجراءات الزيارة السابقة؟', kind: 'select',
                    options: [
                        { value: 'all', label: 'All', ar: 'كلها' },
                        { value: 'some', label: 'Some', ar: 'بعضها' },
                        { value: 'none', label: 'No', ar: 'لا' },
                        { value: 'first_visit', label: 'First visit', ar: 'أول زيارة' },
                    ],
                },
                { id: 'next_visit', label: 'Next visit date', ar: 'موعد الزيارة القادمة', kind: 'date' },
            ],
        },
    ],
};

export function staffTotals(responses = {}) {
    const s = responses.staff || {};
    let total = null;
    let trained = null;
    STAFF_ROWS.forEach(({ id }) => {
        const n = toNum(s[id]?.total);
        const tr = toNum(s[id]?.trained);
        if (n != null) total = (total || 0) + n;
        if (tr != null) trained = (trained || 0) + tr;
    });
    const trainedPercent = pct(trained, total);
    return {
        total, trained,
        untrained: total != null ? Math.max(0, total - (trained || 0)) : null,
        trainedPercent,
        // The paper form's minimum: one trained worker and 60% trained.
        // Unknown until the trained column is filled: a blank is not zero.
        meetsMinimum: total && trained != null ? trained >= 1 && trainedPercent >= 60 : null,
    };
}

function readinessMetrics(form = {}) {
    const r = form.responses || {};
    const partOne = presenceOver(IMNCI_FACILITY_READINESS, r, READINESS_PART_ONE);
    const records = presenceOver(IMNCI_FACILITY_READINESS, r, ['records']);
    const staff = staffTotals(r);
    return [
        { id: 'readiness', label: 'Readiness items present', ar: 'عناصر الجاهزية المتوفرة', kind: 'pct', value: partOne.percent, detail: partOne.answered ? `${partOne.yes}/${partOne.answered}` : null },
        { id: 'trained', label: 'Treating staff trained', ar: 'الكوادر المعالجة المدرَّبة', kind: 'pct', value: staff.trainedPercent, detail: staff.total != null ? `${staff.trained || 0}/${staff.total}` : null },
        { id: 'staffing_ready', label: 'Meets staffing minimum', ar: 'يستوفي الحد الأدنى للكوادر', kind: 'bool', value: staff.meetsMinimum },
        { id: 'records', label: 'Records and reports', ar: 'السجلات والتقارير', kind: 'pct', value: records.percent },
    ];
}
IMNCI_FACILITY_READINESS.metrics = readinessMetrics;

// The facility registry's IMNCI fields this form answers, keyed as the
// "Update IMNCI facility information" form (IMNCIFormFields) stores them.
// Only answered questions are written, so a blank row never clears what the
// registry already holds.
export function imnciFacilityPatch(form = {}) {
    const r = form.responses || {};
    const patch = {};
    const yn = (section, item, field) => {
        const v = r[section]?.[item]?.answer;
        if (v === true) patch[field] = 'Yes';
        else if (v === false) patch[field] = 'No';
    };
    yn('measure', 'scale', 'ميزان_وزن');
    yn('measure', 'height', 'ميزان_طول');
    yn('measure', 'thermometer', 'ميزان_حرارة');
    yn('measure', 'timer', 'ساعة_مؤقت');
    yn('clinic', 'chart_booklet', 'وجود_كتيب_لوحات');
    yn('clinic', 'daily_register', 'وجود_سجل_علاج_متكامل');
    yn('ort', 'ort_corner', 'غرفة_إرواء');
    yn('epi', 'epi_services', 'immunization_office_exists');

    const staff = r.staff || {};
    const num = (row, col, field) => {
        const n = toNum(staff[row]?.[col]);
        if (n != null) patch[field] = n;
    };
    num('doctor', 'total', 'imnci_doctors_total');
    num('doctor', 'trained', 'imnci_doctors_trained');
    num('medical_assistant', 'total', 'imnci_medical_assistants_total');
    num('medical_assistant', 'trained', 'imnci_medical_assistants_trained');

    // The registry's "IMNCI service available" question is defined on its own
    // form as "staff at the facility are 50% or more trained".
    const totals = staffTotals(r);
    // Only when the trained counts are known, so a blank column never writes a false "No".
    if (totals.total && totals.trained != null) {
        patch['وجود_العلاج_المتكامل_لامراض_الطفولة'] = totals.trained >= 1 && totals.trainedPercent >= 50 ? 'Yes' : 'No';
    }
    return patch;
}

// =============================================================================
// Form 7-C: free medicine and availability of IMNCI drugs and supplies
// =============================================================================

const DRUG_COLUMNS = [
    { id: 'available', label: 'Available on the day', ar: 'متوفر أثناء الزيارة', kind: 'yesno' },
    { id: 'stockout', label: 'Stock-out in last 3 months', ar: 'انقطاع خلال الثلاثة أشهر السابقة', kind: 'yesno' },
    { id: 'balance', label: 'Current balance', ar: 'الرصيد الحالي', kind: 'number' },
];

const min = (n) => ({ hint: `Minimum: ${n} or more`, hintAr: `الحد الأدنى: ${n} فأكثر`, min: n });

const STORAGE_OPTIONS = [
    { value: 'pharmacy', label: 'Pharmacy', ar: 'صيدلية' },
    { value: 'locked_cabinet', label: 'Locked cabinet', ar: 'خزانة مغلقة' },
    { value: 'other', label: 'Other (notes)', ar: 'أخرى (الملاحظات)' },
];

const DISPOSAL_OPTIONS = [
    { value: 'returned', label: 'Returned to locality / state', ar: 'إرجاع للمحلية / الولاية' },
    { value: 'destroyed_record', label: 'Destroyed with a record', ar: 'إتلاف بمحضر' },
    { value: 'none', label: 'No mechanism', ar: 'لا توجد آلية' },
    { value: 'other', label: 'Other (notes)', ar: 'أخرى (الملاحظات)' },
];

export const IMNCI_DRUGS = {
    id: 'imnci_drugs',
    service: 'IMNCI',
    title: 'Free medicine and IMNCI drugs and supplies (form 7-C)',
    titleAr: 'استمارة الإشراف على الدواء المجاني وتوفر أدوية ومستلزمات العلاج المتكامل',
    short: 'IMNCI drugs (7-C)',
    shortAr: 'أدوية العلاج المتكامل',
    description: 'How free medicine is managed at the facility, availability and stock-outs of IMNCI drugs and supplies, and a summary.',
    descriptionAr: 'إدارة الدواء المجاني بالمرفق، وتوفر أدوية ومستلزمات العلاج المتكامل وانقطاعها، وملخص النتيجة.',
    icon: 'pill',
    scope: 'facility',
    headline: 'available',
    headerFields: [
        { id: 'coordinatorName', label: 'Coordinator name', ar: 'اسم المنسق' },
        { id: 'pharmacyResponsible', label: 'Person in charge of the pharmacy / store', ar: 'المسؤول عن الصيدلية / المخزن' },
        {
            id: 'staffTrained', label: 'Treating staff trained in IMNCI', ar: 'الكادر المعالج مدرَّب على المعالجة القياسية', kind: 'select',
            options: [{ value: 'yes', label: 'Yes', ar: 'نعم' }, { value: 'no', label: 'No', ar: 'لا' }],
        },
    ],
    sections: [
        {
            id: 'management',
            title: 'Part 1. Managing free medicine at the facility',
            titleAr: 'الجزء الأول: إدارة الدواء المجاني بالمرفق',
            note: 'If no, say why in the notes.',
            noteAr: 'إذا لا، اذكر السبب في الملاحظات.',
            type: 'grid',
            presenceColumn: 'answer',
            columns: YES_NO_COMMENT,
            items: [
                { id: 'staff_present', label: 'Health staff present at the facility during the visit', ar: 'الكادر الصحي موجود بالمرفق أثناء الزيارة' },
                { id: 'focal_person', label: 'A person is responsible for free medicine at the facility', ar: 'يوجد شخص مسؤول عن الدواء المجاني داخل المرفق' },
                { id: 'pharmacy', label: 'The facility has a pharmacy (if not, note how medicine is kept)', ar: 'توجد صيدلية بالمرفق (إذا لا، اذكر في الملاحظات كيف يُحفظ الدواء)' },
                { id: 'receipt_mechanism', label: 'Clear mechanism for receiving and issuing medicine (receipt and issue documents)', ar: 'توجد آلية واضحة لاستلام وتسليم الدواء (مستندات استلام وصرف)' },
                { id: 'regular_supply', label: 'Medicine is received regularly on schedule (no delay)', ar: 'يُستلم الدواء بانتظام حسب الجدول (دون تأخير)' },
                { id: 'need_small', label: 'Small quantities of medicine are needed (if yes, specify in notes)', ar: 'توجد حاجة لأدوية بكميات بسيطة (إذا نعم، حددها في الملاحظات)', notScored: true },
                { id: 'need_large', label: 'Large quantities of medicine are needed (if yes, specify in notes)', ar: 'توجد حاجة لأدوية بكميات كبيرة (إذا نعم، حددها في الملاحظات)', notScored: true },
                { id: 'drug_records', label: 'Medicine records available (stock card, issue book)', ar: 'سجلات الدواء متوفرة بالمرفق (كرت الصنف، دفتر الصرف)' },
                { id: 'reports', label: 'Reports available at the facility', ar: 'التقارير متوفرة بالمرفق' },
                { id: 'monthly_reports', label: 'Monthly reports are sent to the locality', ar: 'تُرفع التقارير الشهرية للمحلية' },
                { id: 'supervised', label: 'The facility is supervised regularly', ar: 'يتم الإشراف على المرفق بصورة دورية' },
                { id: 'posters', label: 'Posters showing medicine is free are displayed', ar: 'توجد ملصقات (بوسترات) توضح مجانية الدواء في المرفق' },
                { id: 'storage', label: 'How medicine is kept', ar: 'طريقة حفظ الدواء', answerKind: 'select', options: STORAGE_OPTIONS, group: 'storage' },
                { id: 'disposal', label: 'Disposal of expired medicine', ar: 'التخلص من الأدوية منتهية الصلاحية', answerKind: 'select', options: DISPOSAL_OPTIONS, group: 'storage' },
            ],
            groups: { storage: { label: 'Storage and disposal of expired medicine', ar: 'طريقة حفظ الدواء والتخلص من الأدوية منتهية الصلاحية' } },
        },
        {
            id: 'drugs_clinic',
            title: 'Part 2.1 Clinic treatment drugs',
            titleAr: 'الجزء الثاني: 1/ أدوية العلاج بالعيادة',
            note: 'Available = usable stock on the day of the visit. Stock-out = the item ran out for one day or more in the last 3 months (from the stock card). The minimum is the stock that should not be undercut on the day of the visit.',
            noteAr: '«متوفر» = يوجد رصيد صالح للاستعمال يوم الزيارة. «انقطاع» = نفد الصنف يوماً واحداً أو أكثر خلال آخر 3 أشهر (من كرت الصنف). الحد الأدنى هو الرصيد الذي يجب ألا يقل عنه المخزون يوم الزيارة.',
            type: 'grid',
            presenceColumn: 'available',
            columns: DRUG_COLUMNS,
            items: [
                { id: 'amox_125_syrup', code: '1', label: 'Amoxicillin syrup 125 mg / 5 ml', ar: 'أموكسيسيلين شراب 125 ملغ / 5 مل', tracer: 'amoxicillin', ...min(3) },
                { id: 'amox_250_syrup', code: '2', label: 'Amoxicillin syrup 250 mg / 5 ml', ar: 'أموكسيسيلين شراب 250 ملغ / 5 مل', tracer: 'amoxicillin', ...min(3) },
                { id: 'amox_250_dt', code: '3', label: 'Amoxicillin 250 mg dispersible tablets', ar: 'أموكسيسيلين 250 ملغ أقراص منتشرة', tracer: 'amoxicillin', ...min(3) },
                { id: 'paracetamol_syrup', code: '4', label: 'Paracetamol syrup 120 mg / 5 ml', ar: 'باراسيتامول (بندول) شراب 120 ملغ / 5 مل', tracer: 'paracetamol', ...min(3) },
                { id: 'coartem', code: '5', label: 'Coartem tablets (20/120 mg)', ar: 'كوارتم أقراص (20/120 ملغ)', tracer: 'antimalarial', ...min(3) },
                { id: 'dhap', code: '6', label: 'DHA-PPQ tablets', ar: 'دهب أقراص', tracer: 'antimalarial' },
                { id: 'quinine_tabs', code: '7', label: 'Quinine tablets 300 mg', ar: 'كينين أقراص 300 ملغ' },
                { id: 'tetracycline_tabs', code: '8', label: 'Tetracycline tablets 250 mg', ar: 'تتراسيكلين أقراص 250 ملغ' },
                { id: 'erythromycin', code: '9', label: 'Erythromycin tablets / syrup 250 mg', ar: 'إريثرومايسين أقراص / شراب 250 ملغ' },
                { id: 'zinc_syrup', code: '10', label: 'Zinc syrup 10 mg / 5 ml', ar: 'زنك شراب 10 ملغ / 5 مل', tracer: 'zinc', ...min(3) },
                { id: 'zinc_tabs', code: '11', label: 'Zinc tablets 20 mg', ar: 'زنك أقراص 20 ملغ', tracer: 'zinc', ...min(3) },
                { id: 'ors', code: '12', label: 'Low-osmolarity ORS', ar: 'محلول الإرواء منخفض الأسمولية', tracer: 'ors', ...min(10) },
                { id: 'ciprofloxacin', code: '13', label: 'Ciprofloxacin tablets 250 mg', ar: 'سيبروفلوكساسين أقراص 250 ملغ' },
                { id: 'iron_syrup', code: '14', label: 'Iron syrup 50 mg / 5 ml', ar: 'حديد شراب 50 ملغ / 5 مل' },
                { id: 'mebendazole', code: '15', label: 'Mebendazole syrup 100 mg', ar: 'ميبيندازول شراب 100 ملغ' },
                { id: 'vitamin_a', code: '16', label: 'Vitamin A capsules', ar: 'فيتامين (أ) كبسولات', ...min(10) },
                { id: 'salbutamol_inhaler', code: '17', label: 'Salbutamol inhaler', ar: 'سالبيوتامول بخاخ' },
                { id: 'salbutamol_syrup', code: '18', label: 'Salbutamol syrup 2 mg / 5 ml', ar: 'سالبيوتامول شراب 2 ملغ / 5 مل' },
                { id: 'tetracycline_eye', code: '19', label: 'Tetracycline eye ointment', ar: 'تتراسيكلين مرهم عين' },
                { id: 'gentian_violet', code: '20', label: 'Gentian violet', ar: 'جنشن فيوليت' },
            ],
        },
        {
            id: 'drugs_prereferral',
            title: 'Part 2.2 Pre-referral drugs',
            titleAr: 'الجزء الثاني: 2/ أدوية ما قبل الإحالة',
            type: 'grid',
            presenceColumn: 'available',
            columns: DRUG_COLUMNS,
            items: [
                { id: 'gentamicin', code: '21', label: 'Gentamicin injection 80 mg / 2 ml', ar: 'جنتامايسين حقن 80 ملغ / 2 مل', ...min(3) },
                { id: 'ampicillin', code: '22', label: 'Ampicillin injection 500 mg', ar: 'أمبيسيلين حقن 500 ملغ', ...min(3) },
                { id: 'quinine_inj', code: '23', label: 'Quinine injection 600 mg', ar: 'كينين حقن 600 ملغ', ...min(3) },
                { id: 'artesunate', code: '24', label: 'Artesunate (injection or suppositories)', ar: 'أرتيسونيت (حقن أو تحاميل)', ...min(3) },
                { id: 'diazepam', code: '25', label: 'Diazepam injection 10 mg', ar: 'ديازيبام حقن 10 ملغ', ...min(3) },
                { id: 'iv_fluids', code: '26', label: 'Normal saline / Ringer\'s drip 500 ml', ar: 'درب ملح طعام / رينجر 500 مل' },
            ],
        },
        {
            id: 'supplies',
            title: 'Part 2.3 Supplies',
            titleAr: 'الجزء الثاني: 3/ المستلزمات',
            type: 'grid',
            presenceColumn: 'available',
            columns: DRUG_COLUMNS,
            items: [
                { id: 'cannula', code: '27', label: 'Paediatric cannulas / scalp vein sets', ar: 'كانيولات / فراشات وريدية للأطفال', ...min(3) },
                { id: 'ng_tube', code: '28', label: 'Paediatric nasogastric tubes', ar: 'أنابيب تغذية معدية للأطفال' },
                { id: 'antiseptic', code: '29', label: 'Antiseptic (chlorhexidine or other)', ar: 'مطهر (كلورهيكسيدين أو غيره)' },
                { id: 'cotton_gauze', code: '30', label: 'Cotton and gauze', ar: 'قطن وشاش' },
            ],
        },
        {
            id: 'summary',
            title: 'Part 3. Summary of results',
            titleAr: 'الجزء الثالث: ملخص النتيجة',
            note: 'The counts and the tracer-drug result are worked out from part 2.',
            noteAr: 'الأعداد ونتيجة أدوية التتبع تُحسب تلقائياً من الجزء الثاني.',
            type: 'fields',
            showMetrics: true,
            items: [
                { id: 'kits_received', label: 'IMNCI kits received this quarter (national standard: 4 kits per 10,000 children a year)', ar: 'عدد حزم العلاج المتكامل المستلمة خلال الربع (المعيار القومي: 4 حزم لكل 10,000 طفل في السنة)', kind: 'number' },
                { id: 'last_order', label: 'Date of last order / last receipt', ar: 'تاريخ آخر طلبية / آخر استلام', kind: 'date' },
                { id: 'missing_items', label: 'Items out of stock or short', ar: 'الأصناف المنقطعة أو الناقصة', kind: 'textarea', optional: true },
                { id: 'obstacles', label: 'Are there obstacles to the work?', ar: 'هل توجد معوقات للعمل؟', kind: 'yesno' },
                { id: 'obstacles_detail', label: 'If yes, what are they?', ar: 'إذا نعم، ما هي؟', kind: 'textarea', optional: true, showIf: 'obstacles' },
                { id: 'suggestions', label: 'Suggestions to improve the work', ar: 'مقترحات لتحسين سير العمل', kind: 'textarea', optional: true },
            ],
        },
    ],
};

export const DRUG_SECTIONS = ['drugs_clinic', 'drugs_prereferral', 'supplies'];

const TRACERS = [
    { id: 'amoxicillin', label: 'Amoxicillin', ar: 'أموكسيسيلين' },
    { id: 'ors', label: 'ORS', ar: 'محلول الإرواء' },
    { id: 'zinc', label: 'Zinc', ar: 'الزنك' },
    { id: 'antimalarial', label: 'Antimalarial', ar: 'مضاد الملاريا' },
    { id: 'paracetamol', label: 'Paracetamol', ar: 'باراسيتامول' },
];

export function drugResults(responses = {}) {
    const items = [];
    IMNCI_DRUGS.sections.filter((s) => DRUG_SECTIONS.includes(s.id)).forEach((s) => {
        s.items.forEach((item) => items.push({ item, r: responses[s.id]?.[item.id] || {} }));
    });
    const answered = items.filter(({ r }) => r.available === true || r.available === false);
    const available = answered.filter(({ r }) => r.available === true);
    const stockouts = items.filter(({ r }) => r.stockout === true);
    const missing = items.filter(({ r }) => r.available === false || r.stockout === true);

    // A tracer is met when at least one of its products is in stock today and
    // none of the answered ones ran out in the last three months.
    const tracers = TRACERS.map((tr) => {
        const rows = items.filter(({ item }) => item.tracer === tr.id);
        const known = rows.some(({ r }) => typeof r.available === 'boolean');
        if (!known) return { ...tr, met: null };
        const inStock = rows.some(({ r }) => r.available === true);
        const ranOut = rows.some(({ r }) => r.stockout === true);
        return { ...tr, met: inStock && !ranOut };
    });
    const tracerKnown = tracers.filter((x) => x.met !== null);
    const tracerOk = tracerKnown.length === TRACERS.length
        ? tracers.every((x) => x.met)
        : (tracerKnown.some((x) => x.met === false) ? false : null);

    return {
        total: items.length,
        answered: answered.length,
        available: available.length,
        availablePercent: pct(available.length, answered.length),
        stockouts: stockouts.length,
        missing: missing.map(({ item }) => item),
        tracers,
        tracerOk,
    };
}

function drugMetrics(form = {}) {
    const r = form.responses || {};
    const d = drugResults(r);
    const management = presenceOver(IMNCI_DRUGS, r, ['management']);
    return [
        { id: 'available', label: 'Items available on the day', ar: 'الأصناف المتوفرة يوم الزيارة', kind: 'pct', value: d.availablePercent, detail: d.answered ? `${d.available}/${d.answered}` : null },
        { id: 'stockouts', label: 'Items with a stock-out in the last 3 months', ar: 'الأصناف التي حدث فيها انقطاع خلال آخر 3 أشهر', kind: 'count', value: d.answered ? d.stockouts : null },
        { id: 'tracer_ok', label: 'Tracer drugs available without stock-out', ar: 'أدوية التتبع الأساسية متوفرة دون انقطاع', kind: 'bool', value: d.tracerOk },
        { id: 'management', label: 'Free medicine management', ar: 'إدارة الدواء المجاني', kind: 'pct', value: management.percent },
    ];
}
IMNCI_DRUGS.metrics = drugMetrics;

export const IMNCI_CHECKLISTS = [IMNCI_FACILITY_READINESS, IMNCI_DRUGS];
