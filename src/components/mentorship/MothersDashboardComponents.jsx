// MothersDashboardComponents.jsx
import React from 'react';
import { CompactSkillRow } from './SkillsDashboardComponents';

// --- Constants ---
export const IMNCI_MOTHER_SURVEY_ITEMS_EN = [
    { title: 'Mother Knowledge (Treatment & Medications)', items: [
        { key: 'knows_med_details', label: 'Mother knows medication details (dose, frequency, days)' },
        { key: 'knows_treatment_details', label: 'Mother knows combination treatment details' },
        { key: 'knows_diarrhea_4rules', label: 'Mother knows the 4 rules for home diarrhea management' },
        { key: 'knows_return_date', label: 'Mother knows follow-up return date' }
    ]},
    { title: 'Mother Knowledge (Fluids & ORS)', items: [
        { key: 'knows_ors_prep', label: 'Mother knows how to prepare ORS' },
        { key: 'knows_home_fluids', label: 'Mother knows allowed home fluids' },
        { key: 'knows_ors_water_qty', label: 'Mother knows correct water quantity for ORS' },
        { key: 'knows_ors_after_stool', label: 'Mother knows ORS amount to give after each stool' }
    ]},
    { title: 'Mother Satisfaction', items: [
        { key: 'time_spent', label: 'Satisfaction with time spent by health worker' },
        { key: 'assessment_method', label: 'Satisfaction with assessment method' },
        { key: 'treatment_given', label: 'Satisfaction with given treatment' },
        { key: 'communication_style', label: 'Satisfaction with communication style' },
        { key: 'what_learned', label: 'Satisfaction with what was learned' },
        { key: 'drug_availability', label: 'Satisfaction with drug availability at facility' }
    ]}
];

export const EENC_MOTHER_SURVEY_ITEMS_EN = [
    { title: 'Skin-to-Skin Contact', items: [
        { key: 'skin_to_skin_immediate', label: 'Baby placed skin-to-skin immediately after birth?' },
        { key: 'skin_to_skin_90min', label: 'Baby kept skin-to-skin continuously for 90 minutes?' }
    ]},
    { title: 'Breastfeeding Initiation', items: [
        { key: 'breastfed_first_hour', label: 'Baby completed a full feed within first hour?' },
        { key: 'given_other_fluids', label: 'Baby given any fluids other than breastmilk?' },
        { key: 'given_other_fluids_bottle', label: 'Baby given any fluids via bottle?' }
    ]},
    { title: 'Skin, Eye & Cord Care', items: [
        { key: 'given_vitamin_k', label: 'Baby given Vitamin K?' },
        { key: 'given_tetracycline', label: 'Baby given Tetracycline eye ointment?' },
        { key: 'anything_on_cord', label: 'Anything applied to the cord?' },
        { key: 'rubbed_with_oil', label: 'Baby rubbed with oil?' },
        { key: 'baby_bathed', label: 'Baby bathed?' }
    ]},
    { title: 'Vaccinations', items: [
        { key: 'polio_zero_dose', label: 'Baby given zero-dose Polio vaccine?' },
        { key: 'bcg_dose', label: 'Baby given BCG vaccine?' }
    ]},
    { title: 'Measurements', items: [
        { key: 'baby_weighed', label: 'Baby weighed?' },
        { key: 'baby_temp_measured', label: 'Baby temperature measured?' }
    ]},
    { title: 'Registration', items: [
        { key: 'baby_registered', label: 'Baby registered in civil registry?' },
        { key: 'given_discharge_card', label: 'Baby given discharge card?' }
    ]}
];

// --- Components ---
export const MothersCompactSkillsTable = ({ motherKpis, serviceType }) => {
    const skillStats = motherKpis?.skillStats;
    
    if (!motherKpis || !skillStats) {
        return (
            <div className="bg-white p-8 rounded-2xl shadow-md border border-black text-center text-slate-500 font-bold">
                No mother survey data available.
            </div>
        );
    }
    
    const items = serviceType === 'IMNCI' ? IMNCI_MOTHER_SURVEY_ITEMS_EN : EENC_MOTHER_SURVEY_ITEMS_EN;

    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden" dir="ltr">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 shadow-sm border-b border-black">
                    <tr className="bg-slate-200">
                        <th className="p-4 text-xs font-extrabold text-slate-800 w-3/5 text-left tracking-wide uppercase">Question (Mother Survey)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center tracking-wide uppercase">Count (Yes / Total)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center tracking-wide uppercase">Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(group => (
                        <React.Fragment key={group.title}>
                            <tr className="bg-slate-800 text-white border-b border-black">
                                <td className="p-3 text-sm font-bold text-left tracking-wide" colSpan="3">{group.title}</td>
                            </tr>
                            {group.items.map(item => (
                                <CompactSkillRow key={item.key} label={item.label} stats={skillStats[item.key]} />
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};