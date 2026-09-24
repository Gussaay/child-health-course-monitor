// src/components/SupervisionView.jsx
//
// Supervision: structured facility assessments, one checklist per service.
//
// The first is the NICU Centre of Excellence initial assessment, transcribed
// from the National Child Health Program form. Everything for the module lives
// here — the checklist definitions, the scoring, the assessment form and the
// list screen — so a second service's checklist is added by appending one
// object to SUPERVISION_CHECKLISTS rather than by creating more files.
//
// A checklist is DATA, not a component. That is what lets the same form renderer
// handle a yes/no service list, an "available vs need" equipment count and an
// IPC present/action grid without a bespoke screen for each one.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Save, ArrowLeft } from 'lucide-react';

import {
    Card, CardBody, PageHeader, Button, Tabs, Table, EmptyState, Spinner,
    Input, Select,
} from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import { useDataCache } from '../DataContext';
import { upsertSupervisionAssessment, deleteSupervisionAssessment } from '../data';
import { STATE_LOCALITIES } from './constants';

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

export const SUPERVISION_CHECKLISTS = [NICU_COE];

export const getChecklist = (id) => SUPERVISION_CHECKLISTS.find((c) => c.id === id) || null;

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

const toNum = (v) => {
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

const pctText = (v) => (v == null ? '—' : `${Math.round(v)}%`);

const toneFor = (v) => {
    if (v == null) return 'bg-gray-100 text-gray-600';
    if (v < 50) return 'bg-red-100 text-red-800';
    if (v < 80) return 'bg-amber-100 text-amber-800';
    return 'bg-green-100 text-green-800';
};

// =============================================================================
// The assessment form
// =============================================================================

function SectionEditor({ section, values, onChange, readOnly }) {
    const set = (itemId, field, value) => onChange(itemId, { ...(values[itemId] || {}), [field]: value });

    const grouped = useMemo(() => {
        const out = [];
        section.items.forEach((item) => {
            const last = out[out.length - 1];
            if (item.group && (!last || last.group !== item.group)) out.push({ group: item.group, items: [item] });
            else if (item.group) last.items.push(item);
            else out.push({ group: null, items: [item] });
        });
        return out;
    }, [section.items]);

    const headerFor = () => {
        switch (section.type) {
            case 'staff': return ['Name', 'Contact'];
            case 'yesno': return ['Available'];
            case 'present_action': return ['Present', 'Action needed'];
            case 'present_number': return ['Present', 'Number registered'];
            case 'standard_available_need': return ['Standard', 'Available', 'Needed'];
            default: return ['Available', 'Need'];
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
                <h4 className="font-semibold text-slate-800">{section.title}</h4>
                {(() => {
                    const s = scoreSection(section, values);
                    if (!s) return null;
                    return (
                        <div className="flex gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded ${toneFor(s.presencePercent)}`}>
                                present {pctText(s.presencePercent)}
                            </span>
                            {s.adequacyPercent != null && (
                                <span className={`px-2 py-0.5 rounded ${toneFor(s.adequacyPercent)}`}>
                                    vs standard {pctText(s.adequacyPercent)}
                                </span>
                            )}
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {s.answered}/{s.total} answered
                            </span>
                        </div>
                    );
                })()}
            </div>

            {section.note && <p className="text-xs text-gray-500">{section.note}</p>}

            <div className="border rounded overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-700">
                    <div className="col-span-5">Item</div>
                    {headerFor().map((h, i) => (
                        <div key={h} className={i === 0 && headerFor().length === 3 ? 'col-span-2' : 'col-span-3'}>{h}</div>
                    ))}
                </div>

                {grouped.map((block, bi) => (
                    <React.Fragment key={bi}>
                        {block.group && (
                            <div className="px-3 py-1 bg-slate-50 text-xs font-semibold text-slate-600 border-t">
                                {block.group}
                            </div>
                        )}
                        {block.items.map((item) => {
                            const v = values[item.id] || {};
                            return (
                                <div key={item.id} className="grid grid-cols-12 gap-2 px-3 py-1.5 border-t items-center text-sm">
                                    <div className="col-span-5 text-gray-800">{item.label}</div>

                                    {section.type === 'staff' && (
                                        <>
                                            <div className="col-span-3">
                                                <input disabled={readOnly} value={v.name || ''}
                                                    onChange={(e) => set(item.id, 'name', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                            <div className="col-span-4">
                                                <input disabled={readOnly} value={v.contact || ''}
                                                    onChange={(e) => set(item.id, 'contact', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                        </>
                                    )}

                                    {section.type === 'yesno' && (
                                        <div className="col-span-3">
                                            <select disabled={readOnly}
                                                value={v.available === true ? 'yes' : v.available === false ? 'no' : ''}
                                                onChange={(e) => set(item.id, 'available',
                                                    e.target.value === '' ? undefined : e.target.value === 'yes')}
                                                className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50">
                                                <option value="">—</option>
                                                <option value="yes">Yes</option>
                                                <option value="no">No</option>
                                            </select>
                                        </div>
                                    )}

                                    {(section.type === 'present_action' || section.type === 'present_number') && (
                                        <>
                                            <div className="col-span-3">
                                                <select disabled={readOnly}
                                                    value={v.present === true ? 'yes' : v.present === false ? 'no' : ''}
                                                    onChange={(e) => set(item.id, 'present',
                                                        e.target.value === '' ? undefined : e.target.value === 'yes')}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50">
                                                    <option value="">—</option>
                                                    <option value="yes">Yes</option>
                                                    <option value="no">No</option>
                                                </select>
                                            </div>
                                            <div className="col-span-4">
                                                <input disabled={readOnly}
                                                    type={section.type === 'present_number' ? 'number' : 'text'}
                                                    min={section.type === 'present_number' ? '0' : undefined}
                                                    value={(section.type === 'present_number' ? v.number : v.action) || ''}
                                                    onChange={(e) => set(item.id,
                                                        section.type === 'present_number' ? 'number' : 'action', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                        </>
                                    )}

                                    {(section.type === 'available_need' || section.type === 'standard_available_need') && (
                                        <>
                                            {section.type === 'standard_available_need' && (
                                                <div className="col-span-2 text-gray-500">{item.standard}</div>
                                            )}
                                            <div className="col-span-3">
                                                <input disabled={readOnly} type="number" min="0"
                                                    value={v.available ?? ''}
                                                    onChange={(e) => set(item.id, 'available', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                            <div className="col-span-3">
                                                <input disabled={readOnly} type="number" min="0"
                                                    value={v.need ?? ''}
                                                    onChange={(e) => set(item.id, 'need', e.target.value)}
                                                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50" />
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

function AssessmentForm({ checklist, initial, onBack, onSaved, canEdit }) {
    const [form, setForm] = useState(() => initial || {
        checklistId: checklist.id,
        service: checklist.service,
        stateKey: '', localityKey: '', facilityName: '',
        assessmentDate: new Date().toISOString().slice(0, 10),
        assessorName: '', status: 'draft', responses: {},
    });
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState(checklist.sections[0].id);

    const readOnly = !canEdit;
    const score = useMemo(() => scoreAssessment(checklist, form.responses), [checklist, form.responses]);

    const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));
    const setResponse = useCallback((sectionId, itemId, value) => {
        setForm((p) => ({
            ...p,
            responses: {
                ...p.responses,
                [sectionId]: { ...(p.responses?.[sectionId] || {}), [itemId]: value },
            },
        }));
    }, []);

    const save = async (status) => {
        if (!form.facilityName?.trim()) { notify('Enter the hospital name.', 'error'); return; }
        if (!form.stateKey) { notify('Choose the state.', 'error'); return; }
        setSaving(true);
        try {
            const payload = {
                ...form, status,
                facilityName: form.facilityName.trim(),
                summary: {
                    completionPercent: score.completionPercent,
                    presencePercent: score.presencePercent,
                    sections: score.sections,
                },
            };
            await upsertSupervisionAssessment(payload);
            notify(status === 'submitted' ? 'Assessment submitted.' : 'Draft saved.', 'success');
            onSaved();
            if (status === 'submitted') onBack();
        } catch (error) {
            console.error('Failed to save assessment:', error);
            const raw = String(error?.message || error);
            notify(/insufficient permissions|permission-denied/i.test(raw)
                ? 'Firestore refused the write. Your account may not have supervision rights.'
                : `Could not save the assessment. ${raw}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const section = checklist.sections.find((s) => s.id === activeSection);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="secondary" onClick={onBack}>
                    <ArrowLeft size={16} /> Back to assessments
                </Button>
                {canEdit && (
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => save('draft')} disabled={saving}>
                            <Save size={16} /> Save draft
                        </Button>
                        <Button onClick={() => save('submitted')} disabled={saving}>
                            Submit assessment
                        </Button>
                    </div>
                )}
            </div>

            <Card>
                <CardBody className="space-y-4">
                    <h3 className="font-semibold text-slate-800">{checklist.title}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <Select label="State" value={form.stateKey} disabled={readOnly}
                            onChange={(e) => setForm((p) => ({ ...p, stateKey: e.target.value, localityKey: '' }))}>
                            <option value="">Select…</option>
                            {Object.keys(STATE_LOCALITIES).filter((k) => k !== 'Federal')
                                .map((k) => <option key={k} value={k}>{STATE_LOCALITIES[k].en}</option>)}
                        </Select>
                        <Select label="Locality" value={form.localityKey} disabled={readOnly || !form.stateKey}
                            onChange={(e) => setField('localityKey', e.target.value)}>
                            <option value="">Select…</option>
                            {(STATE_LOCALITIES[form.stateKey]?.localities || [])
                                .map((l) => <option key={l.en} value={l.en}>{l.en}</option>)}
                        </Select>
                        <Input label="Hospital name" value={form.facilityName} disabled={readOnly}
                            onChange={(e) => setField('facilityName', e.target.value)} />
                        <Input label="Assessment date" type="date" value={form.assessmentDate} disabled={readOnly}
                            onChange={(e) => setField('assessmentDate', e.target.value)} />
                    </div>
                    <Input label="Assessor name" value={form.assessorName || ''} disabled={readOnly}
                        onChange={(e) => setField('assessorName', e.target.value)} />

                    <div className="flex flex-wrap gap-2 text-sm">
                        <span className={`px-2 py-1 rounded ${toneFor(score.completionPercent)}`}>
                            completed {pctText(score.completionPercent)}
                        </span>
                        <span className={`px-2 py-1 rounded ${toneFor(score.presencePercent)}`}>
                            present {pctText(score.presencePercent)}
                        </span>
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-600">
                            {score.answered} of {score.total} items answered
                        </span>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardBody className="space-y-4">
                    <div className="overflow-x-auto">
                        <Tabs
                            tabs={checklist.sections.map((s) => ({ id: s.id, label: s.title }))}
                            activeTab={activeSection}
                            onTabChange={setActiveSection}
                        />
                    </div>
                    {section && (
                        <SectionEditor
                            section={section}
                            values={form.responses?.[section.id] || {}}
                            onChange={(itemId, value) => setResponse(section.id, itemId, value)}
                            readOnly={readOnly}
                        />
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

// =============================================================================
// Main screen
// =============================================================================

export default function SupervisionView({ permissions = {} }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const canEdit = !!(permissions.canManageSupervision ?? permissions.canUseFederalManagerAdvancedFeatures);

    const { supervisionAssessments, fetchSupervisionAssessments, isLoading } = useDataCache();

    const [checklistId, setChecklistId] = useState(SUPERVISION_CHECKLISTS[0].id);
    const [editing, setEditing] = useState(null);
    const [stateFilter, setStateFilter] = useState('all');

    useEffect(() => {
        if (!supervisionAssessments) fetchSupervisionAssessments(false);
    }, [supervisionAssessments, fetchSupervisionAssessments]);

    const reload = useCallback(() => fetchSupervisionAssessments('full'), [fetchSupervisionAssessments]);

    const checklist = getChecklist(checklistId);

    const rows = useMemo(() => (supervisionAssessments || [])
        .filter((a) => a.isDeleted !== true)
        .filter((a) => a.checklistId === checklistId)
        .filter((a) => stateFilter === 'all' || a.stateKey === stateFilter)
        .sort((a, b) => String(b.assessmentDate || '').localeCompare(String(a.assessmentDate || ''))),
    [supervisionAssessments, checklistId, stateFilter]);

    const handleDelete = async (row) => {
        const ok = await confirmDialog(
            `Delete the assessment for ${row.facilityName}?`,
            { title: 'Delete assessment', confirmLabel: 'Delete', danger: true }
        );
        if (!ok) return;
        try {
            await deleteSupervisionAssessment(row.id);
            notify('Assessment deleted.', 'success');
            reload();
        } catch (error) {
            console.error('Failed to delete assessment:', error);
            notify('Could not delete the assessment.', 'error');
        }
    };

    if (editing !== null) {
        return (
            <AssessmentForm
                checklist={getChecklist(editing.checklistId) || checklist}
                initial={editing.id ? editing : null}
                canEdit={canEdit}
                onBack={() => setEditing(null)}
                onSaved={reload}
            />
        );
    }

    const headers = ['Date', 'Hospital', 'State', 'Status', 'Completed', 'Present',
        ...(canEdit ? ['Actions'] : [])];

    return (
        <div className="space-y-4">
            <PageHeader
                title="Supervision"
                subtitle="Facility assessment checklists by service"
                actions={canEdit ? (
                    <Button onClick={() => setEditing({ checklistId })}>
                        <Plus size={16} /> New assessment
                    </Button>
                ) : null}
            />

            <Card>
                <CardBody className="space-y-4">
                    <Tabs
                        tabs={SUPERVISION_CHECKLISTS.map((c) => ({
                            id: c.id,
                            label: `${c.service} · ${isArabic ? c.titleAr : c.title}`,
                        }))}
                        activeTab={checklistId}
                        onTabChange={setChecklistId}
                    />

                    <div className="w-56">
                        <Select label="State" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                            <option value="all">All states</option>
                            {Object.keys(STATE_LOCALITIES).filter((k) => k !== 'Federal')
                                .map((k) => <option key={k} value={k}>{STATE_LOCALITIES[k].en}</option>)}
                        </Select>
                    </div>

                    {isLoading?.supervisionAssessments && !supervisionAssessments ? <Spinner /> : (
                        <Table headers={headers}>
                            {rows.length === 0 ? (
                                <EmptyState colSpan={headers.length}
                                    message="No assessments yet. Use New assessment to start one." />
                            ) : rows.map((row) => (
                                <tr key={row.id}>
                                    <td className="text-gray-600">{row.assessmentDate || '—'}</td>
                                    <td className="font-medium">{row.facilityName}</td>
                                    <td className="text-gray-600">
                                        {STATE_LOCALITIES[row.stateKey]?.en || row.stateKey}
                                    </td>
                                    <td>
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                            row.status === 'submitted'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-amber-100 text-amber-800'}`}>
                                            {row.status === 'submitted' ? 'Submitted' : 'Draft'}
                                        </span>
                                    </td>
                                    <td className="text-gray-600">{pctText(row.summary?.completionPercent)}</td>
                                    <td>
                                        <span className={`px-2 py-0.5 rounded text-xs ${toneFor(row.summary?.presencePercent)}`}>
                                            {pctText(row.summary?.presencePercent)}
                                        </span>
                                    </td>
                                    {canEdit && (
                                        <td>
                                            <div className="flex gap-2">
                                                <Button variant="secondary" onClick={() => setEditing(row)}>
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button variant="danger" onClick={() => handleDelete(row)}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
