// SkillsDashboardComponents.jsx
import React from 'react';
import { ScoreText } from './MentorshipDashboard'; // Adjust path if ScoreText is moved to a Common/Shared file
import { IMNCI_FORM_STRUCTURE } from './IMNCSkillsAssessmentForm.jsx';
import { 
    PREPARATION_ITEMS, 
    DRYING_STIMULATION_ITEMS, 
    NORMAL_BREATHING_ITEMS, 
    RESUSCITATION_ITEMS 
} from './EENCSkillsAssessmentForm.jsx';

// --- Dictionaries ---
export const IMNCI_ENGLISH_LABELS = {
    'تقييم مهارات التقييم والتصنيف': 'Assessment & Classification Skills',
    'القرار النهائي': 'Final Decision',
    'تقييم مهارات العلاج والنصح': 'Treatment & Counseling Skills',
    'استخدام الاستمارة': 'Recording Skills',
    'القياسات الجسمانية والحيوية': 'Physical & Vital Measurements',
    'قيم علامات الخطورة العامة بصورة صحيحة': 'General Danger Signs Assessment',
    'قيم الطفل بصورة صحيحة لوجود كل الأعراض الأساسية': 'Main Symptoms Assessment',
    'تحرى عن سوء التغذية الحاد': 'Acute Malnutrition Assessment',
    'تحرى عن الانيميا': 'Anemia Assessment',
    'تحرى عن التطعيم وفيتامين أ بصورة صحيحة': 'Immunization & Vitamin A Assessment',
    'تحرى عن الأمراض الأخرى': 'Other Problems Assessment',
    'الحالات التي تحتاج لتحويل ، تم تحويلها': 'Referral Cases Management',
    'في حالة الإلتهاب الرئوي': 'Pneumonia Management',
    'في حالة الإسهال': 'Diarrhea Management',
    'في حالة الدسنتاريا': 'Dysentery Management',
    'في حالة الملاريا': 'Malaria Management',
    'في حالة التهاب الأذن': 'Ear Infection Management',
    'في حالة سوء التغذية': 'Malnutrition Management',
    'في حالة فقر الدم': 'Anemia Management',
    'نصح الأم متى تعود للمتابعة': 'Follow-up Counseling',
    'تسجيل البيانات': 'Data Recording',
    'skill_weight': 'Weighed the child correctly',
    'skill_temp': 'Measured temperature correctly',
    'skill_height': 'Measured height/length correctly',
    'skill_ds_drink': 'Asked/Checked: Cannot drink or breastfeed',
    'skill_ds_vomit': 'Asked/Checked: Vomits everything',
    'skill_ds_convulsion': 'Asked/Checked: Convulsions',
    'skill_ds_conscious': 'Checked: Lethargic or unconscious',
    'skill_ask_cough': 'Asked about cough or difficult breathing',
    'skill_check_rr': 'Counted respiratory rate correctly',
    'skill_classify_cough': 'Classified cough correctly',
    'skill_ask_diarrhea': 'Asked about diarrhea',
    'skill_check_dehydration': 'Assessed dehydration correctly',
    'skill_classify_diarrhea': 'Classified diarrhea correctly',
    'skill_ask_fever': 'Asked about fever',
    'skill_check_rdt': 'Performed RDT correctly',
    'skill_classify_fever': 'Classified fever correctly',
    'skill_ask_ear': 'Asked about ear problem',
    'skill_check_ear': 'Checked for tender swelling behind the ear',
    'skill_classify_ear': 'Classified ear problem correctly',
    'skill_mal_muac': 'Measured MUAC correctly',
    'skill_mal_wfh': 'Measured WFH z-score correctly',
    'skill_mal_classify': 'Classified nutritional status correctly',
    'skill_anemia_pallor': 'Checked for palmar pallor correctly',
    'skill_anemia_classify': 'Classified anemia correctly',
    'skill_imm_vacc': 'Checked immunizations correctly',
    'skill_imm_vita': 'Checked Vitamin A correctly',
    'skill_other': 'Checked for other problems',
    'skill_ref_abx': 'Gave 1st dose of appropriate antibiotic before referral',
    'skill_ref_quinine': 'Gave IM Quinine before referral (if applicable)',
    'skill_pneu_abx': 'Prescribed Amoxicillin correctly',
    'skill_pneu_dose': 'Gave 1st dose of Amoxicillin in clinic',
    'skill_diar_ors': 'Determined ORS amount correctly',
    'skill_diar_counsel': 'Counseled mother on home care (fluids/feeding)',
    'skill_diar_zinc': 'Prescribed Zinc correctly',
    'skill_diar_zinc_dose': 'Gave 1st dose of Zinc in clinic',
    'skill_dyst_abx': 'Prescribed Ciprofloxacin correctly',
    'skill_dyst_dose': 'Gave 1st dose of Ciprofloxacin in clinic',
    'skill_mal_meds': 'Prescribed Coartem (ACT) correctly',
    'skill_mal_dose': 'Gave 1st dose of Coartem in clinic',
    'skill_ear_abx': 'Prescribed Amoxicillin for ear infection',
    'skill_ear_dose': 'Gave 1st dose of Amoxicillin for ear infection in clinic',
    'skill_ear_para': 'Prescribed Paracetamol correctly',
    'skill_ear_para_dose': 'Gave 1st dose of Paracetamol in clinic',
    'skill_nut_refer_otp': 'Referred child to OTP',
    'skill_nut_assess': 'Assessed feeding including breastfeeding problems',
    'skill_nut_counsel': 'Counseled mother on feeding including breastfeeding',
    'skill_anemia_iron': 'Prescribed Iron syrup correctly',
    'skill_anemia_iron_dose': 'Gave 1st dose of Iron syrup in clinic',
    'skill_fu_when': 'Advised on at least 2 signs to return immediately',
    'skill_fu_return': 'Specified when to return for follow-up',
    'skill_record_signs': 'Recorded signs correctly',
    'skill_record_classifications': 'Recorded classifications correctly',
    'skill_record_treatments': 'Recorded treatments correctly',
};

export const EENC_SKILL_KEYS_TO_ENGLISH = {
    'prep_wash_1': 'Hand washing',
    'prep_wash_2': 'Second hand washing',
    'prep_gloves': 'Sterile gloves',
    'prep_cloths': 'Towels prepared',
    'prep_resuscitation_area': 'Resuscitation area prepared',
    'prep_ambu_check': 'Ambu bag checked',
    'dry_start_5sec': 'Drying started within 5s',
    'dry_skin_to_skin': 'Skin-to-skin contact',
    'dry_cover_baby': 'Baby covered with dry towel/hat',
    'normal_remove_outer_glove': 'Hygienic cord check',
    'normal_cord_pulse_check': 'Delayed cord clamping',
    'normal_cord_clamping': 'Correct cord clamping',
    'normal_breastfeeding_guidance': 'Early breastfeeding advice',
    'resus_position_head': 'Head positioned correctly',
    'resus_mask_position': 'Correct mask placement',
    'resus_check_chest_rise': 'Chest rise checked',
    'resus_ventilation_rate': 'Ventilation rate 30-50/min'
};

// Helper for calculating average internally
const calculateAverage = (scores) => {
    if (!scores || !Array.isArray(scores)) return null;
    const validScores = scores.filter(s => isFinite(s) && !isNaN(s) && s !== null);
    if (validScores.length === 0) return null;
    const sum = validScores.reduce((a, b) => a + b, 0);
    return sum / validScores.length;
};

// --- Components ---

export const CompactSkillRow = ({ label, stats }) => {
    const yes = stats?.yes || 0; const no = stats?.no || 0; const total = yes + no; const percentage = total > 0 ? (yes / total) : null;
    return (
        <tr className="bg-white hover:bg-sky-50 transition-colors duration-150 group border-b border-black">
            <td className="p-3 text-xs font-bold text-slate-700 w-3/5 text-left group-hover:text-sky-800">{label}</td>
            <td className="p-3 text-xs font-bold text-slate-600 border-l border-black w-1/5 text-center">{yes} / {total}</td>
            <td className="p-3 border-l border-black w-1/5 text-center bg-slate-50/50 group-hover:bg-sky-100/50"><ScoreText value={percentage} /></td>
        </tr>
    );
};

export const CompactSkillsTable = ({ overallKpis }) => {
    const skillStats = overallKpis?.skillStats;
    if (!overallKpis || !skillStats || Object.keys(skillStats).length === 0) return (<div className="bg-white p-8 rounded-2xl shadow-md border border-black text-center text-slate-500 font-bold">No detailed skill data available.</div>);
    
    const getAggregatedScore = (skillKeys) => {
        if (!skillKeys || skillKeys.length === 0) return null;
        let totalYes = 0;
        let total = 0;
        skillKeys.forEach(key => {
            const stats = skillStats[key];
            if (stats) {
                totalYes += (stats.yes || 0);
                total += (stats.yes || 0) + (stats.no || 0);
            }
        });
        return total > 0 ? (totalYes / total) : null;
    };

    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden" dir="ltr">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 shadow-sm border-b border-black">
                    <tr className="bg-slate-200">
                        <th className="p-4 text-xs font-extrabold text-slate-800 w-3/5 text-left tracking-wide uppercase">Skill</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center tracking-wide uppercase">Count (Yes / Total)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center tracking-wide uppercase">Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    {IMNCI_FORM_STRUCTURE.map(group => {
                        let groupAggregateScore = null; 
                        
                        if (group.group.includes('التقييم والتصنيف')) groupAggregateScore = overallKpis.avgAssessment; 
                        else if (group.isDecisionSection) groupAggregateScore = overallKpis.avgDecision; 
                        else if (group.group.includes('العلاج والنصح')) groupAggregateScore = overallKpis.avgTreatment;
                        else if (group.group.includes('القياسات')) groupAggregateScore = overallKpis.avgMeasurementSkills;
                        else if (group.group.includes('الخطورة')) groupAggregateScore = overallKpis.avgDangerSigns;
                        else if (group.sectionKey === 'recording_skills') groupAggregateScore = calculateAverage([overallKpis.avgRecordSigns, overallKpis.avgRecordClass, overallKpis.avgRecordTreat]);

                        const groupNameEN = IMNCI_ENGLISH_LABELS[group.group] || group.group;

                        return (
                            <React.Fragment key={group.group}>
                                <tr className="bg-slate-800 text-white border-b border-black">
                                    <td className="p-3 text-sm font-bold text-left tracking-wide" colSpan="2">{groupNameEN}</td>
                                    <td className="p-3 text-center border-l border-black">
                                        {groupAggregateScore !== null && (<div className="bg-white/10 backdrop-blur-md rounded-lg px-3 py-1 inline-block border border-black shadow-inner"><ScoreText value={groupAggregateScore} showPercentage={true}/></div>)}
                                    </td>
                                </tr>
                                {group.subgroups?.map(subgroup => {
                                    if (subgroup.isSymptomGroupContainer) { 
                                        return subgroup.symptomGroups.map(symptomGroup => { 
                                            const symptomKey = symptomGroup.mainSkill.scoreKey; 
                                            let skillsToRender = []; 
                                            if (symptomKey === 'symptom_cough') skillsToRender = ['skill_ask_cough', 'skill_check_rr', 'skill_classify_cough']; 
                                            else if (symptomKey === 'symptom_diarrhea') skillsToRender = ['skill_ask_diarrhea', 'skill_check_dehydration', 'skill_classify_diarrhea']; 
                                            else if (symptomKey === 'symptom_fever') skillsToRender = ['skill_ask_fever', 'skill_check_rdt', 'skill_classify_fever']; 
                                            else if (symptomKey === 'symptom_ear') skillsToRender = ['skill_ask_ear', 'skill_check_ear', 'skill_classify_ear']; 
                                            
                                            const symptomScore = getAggregatedScore(skillsToRender);
                                            const symptomGroupNameEN = IMNCI_ENGLISH_LABELS[symptomGroup.mainSkill.key] || symptomGroup.mainSkill.label;
                                            
                                            return (
                                                <React.Fragment key={symptomKey}>
                                                    <tr className="bg-sky-600 text-white border-b border-black">
                                                        <td className="p-2.5 text-xs font-bold text-left" colSpan="2">{symptomGroupNameEN}</td>
                                                        <td className="p-2.5 text-center border-l border-black">
                                                            {symptomScore !== null && (<div className="bg-white/10 backdrop-blur-md rounded-md px-2 py-0.5 inline-block border border-black"><ScoreText value={symptomScore} showPercentage={true} /></div>)}
                                                        </td>
                                                    </tr>
                                                    {skillsToRender.map(skillKey => (<CompactSkillRow key={skillKey} label={IMNCI_ENGLISH_LABELS[skillKey] || skillKey} stats={skillStats[skillKey]} />))}
                                                </React.Fragment>
                                            ); 
                                        }); 
                                    }
                                    
                                    const skillsToRender = subgroup.skills?.map(s => s.key) || [];
                                    const subgroupScore = getAggregatedScore(skillsToRender);
                                    const subgroupTitleEN = IMNCI_ENGLISH_LABELS[subgroup.subgroupTitle] || subgroup.subgroupTitle;
                                    
                                    return (
                                        <React.Fragment key={subgroup.subgroupTitle}>
                                            <tr className="bg-sky-600 text-white border-b border-black">
                                                <td className="p-2.5 text-xs font-bold text-left" colSpan="2">{subgroupTitleEN}</td>
                                                <td className="p-2.5 text-center border-l border-black">
                                                    {subgroupScore !== null && (<div className="bg-white/10 backdrop-blur-md rounded-md px-2 py-0.5 inline-block border border-black"><ScoreText value={subgroupScore} showPercentage={true}/></div>)}
                                                </td>
                                            </tr>
                                            {subgroup.skills?.map(skill => (<CompactSkillRow key={skill.key} label={IMNCI_ENGLISH_LABELS[skill.key] || skill.label} stats={skillStats[skill.key]} />))}
                                        </React.Fragment>
                                    );
                                })}
                                {group.isDecisionSection && (<CompactSkillRow label="Did health worker's decision match the supervisor's?" stats={skillStats['decisionMatches']} />)}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export const EENCCompactSkillRow = ({ label, stats }) => {
    const yes = stats?.yes || 0; const partial = stats?.partial || 0; const no = stats?.no || 0; const totalResponses = yes + partial + no; const score = (yes * 2) + (partial * 1); const maxScore = totalResponses * 2; const percentage = maxScore > 0 ? (score / maxScore) : null;
    return (
        <tr className="bg-white hover:bg-sky-50 transition-colors duration-150 group border-b border-black">
            <td className="p-3 text-xs font-bold text-slate-700 w-3/5 text-left group-hover:text-sky-800">{label}</td>
            <td className="p-3 text-xs font-bold text-slate-600 border-l border-black w-1/5 text-center">
                <span title="Yes" className="text-emerald-600">{yes}</span> / <span title="Partial" className="text-amber-500">{partial}</span> / <span title="No" className="text-rose-600">{no}</span>
            </td>
            <td className="p-3 border-l border-black w-1/5 text-center bg-slate-50/50 group-hover:bg-sky-100/50"><ScoreText value={percentage} /></td>
        </tr>
    );
};

export const EENCCompactSkillsTable = ({ overallKpis }) => {
    const skillStats = overallKpis?.skillStats;
    if (!overallKpis || !skillStats || Object.keys(skillStats).length === 0) return (<div className="bg-white p-8 rounded-2xl shadow-md border border-black text-center text-slate-500 font-bold">No detailed EENC skill data available.</div>);
    
    const sections = [
        { title: 'Pre-delivery Preparation', items: PREPARATION_ITEMS, score: overallKpis.avgPreparation }, 
        { title: 'Drying, Stimulation, Warming & Suction', items: DRYING_STIMULATION_ITEMS, score: overallKpis.avgDrying }, 
        { title: 'Normal Breathing Baby Management', items: NORMAL_BREATHING_ITEMS, score: overallKpis.avgNormalBreathing }, 
        { title: 'Newborn Resuscitation (Golden Minute)', items: RESUSCITATION_ITEMS, score: overallKpis.avgResuscitation }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-md border border-black overflow-hidden" dir="ltr">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 shadow-sm border-b border-black">
                    <tr className="bg-slate-200">
                        <th className="p-4 text-xs font-extrabold text-slate-800 w-3/5 text-left uppercase tracking-wide">Skill (EENC)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center uppercase tracking-wide">Count (Yes / Partial / No)</th>
                        <th className="p-4 text-xs font-extrabold text-slate-800 border-l border-black w-1/5 text-center uppercase tracking-wide">Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    {sections.map(section => { 
                        const hasData = section.items.some(item => skillStats[item.key] && (skillStats[item.key].yes > 0 || skillStats[item.key].partial > 0 || skillStats[item.key].no > 0)); 
                        if (!hasData) return null; 
                        return (
                            <React.Fragment key={section.title}>
                                <tr className="bg-slate-800 text-white border-b border-black">
                                    <td className="p-3 text-sm font-bold text-left tracking-wide" colSpan="2">{section.title}</td>
                                    <td className="p-3 text-center border-l border-black">
                                        {section.score !== null && (<div className="bg-white/10 backdrop-blur-md rounded-lg px-3 py-1 inline-block border border-black shadow-inner"><ScoreText value={section.score} showPercentage={true}/></div>)}
                                    </td>
                                </tr>
                                {section.items.map(item => (
                                    <EENCCompactSkillRow key={item.key} label={EENC_SKILL_KEYS_TO_ENGLISH[item.key] || item.label} stats={skillStats[item.key]} />
                                ))}
                            </React.Fragment>
                        ); 
                    })}
                </tbody>
            </table>
        </div>
    );
};