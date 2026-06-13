// ProviderSkillsTab.jsx
import React from 'react';
import { useTranslation } from 'react-i18next'; 
import { 
    KpiCard, 
    DetailedKpiCard, 
    KpiLineChart, 
    SummaryKpiTable, 
    KpiBarChart,
    CompactSkillsTable,
    EENCCompactSkillsTable
} from './MentorshipDashboardShared';

const calculateAverage = (arr) => {
    if (!arr || arr.length === 0) return null;
    const valid = arr.filter(n => n !== null && !isNaN(n));
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
};

const ProviderSkillsTab = ({
    activeService, overallKpis, chartData, geographicKpis, kpisByWorkerType,
    imnciSummaryDefs, eencSummaryDefs, scopeTitle, geographicLevelName,
    filteredSubmissions
}) => {
    const { t, i18n } = useTranslation(); 
    const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';

    // Helper functions to get absolute counts out of simple YES/NO skillStats
    const getStats = (keys) => {
        let yes = 0; let total = 0;
        keys.forEach(k => {
            yes += overallKpis.skillStats?.[k]?.yes || 0;
            total += (overallKpis.skillStats?.[k]?.yes || 0) + (overallKpis.skillStats?.[k]?.no || 0) + (overallKpis.skillStats?.[k]?.partial || 0);
        });
        return { yes, total };
    };

    const getVisitStats = (keys, visitNum) => {
        if (!filteredSubmissions || filteredSubmissions.length === 0) return { yes: undefined, total: undefined };
        const targetSubs = filteredSubmissions.filter(sub => parseInt(sub.visitNumber) === visitNum);
        if (targetSubs.length === 0) return { yes: undefined, total: undefined };

        let yes = 0; let total = 0;
        targetSubs.forEach(sub => {
            const as = sub.fullData?.assessmentSkills || {};
            const ts = sub.fullData?.treatmentSkills || {};
            const rs = sub.fullData?.recording_skills || sub.fullData?.recordingSkills || {};
            const eenc = sub.fullData?.skills || {};
            const allSkills = { ...as, ...ts, ...rs, ...eenc };
            
            keys.forEach(k => {
                const val = allSkills[k];
                if (val === 'yes' || val === 'correct' || val === true) {
                    yes++; total++;
                } else if (val === 'no' || val === 'incorrect' || val === false || val === 'partial') {
                    total++;
                }
            });
        });
        return { yes, total };
    };

    // Helper function to get absolute counts for COMPOSITE scores (Overall, Assessment, Decision, etc)
    const getCompositeStats = (scoreKey, maxScoreKey, visitNum = null) => {
        if (!filteredSubmissions || filteredSubmissions.length === 0) return { yes: undefined, total: undefined };
        
        let targetSubs = filteredSubmissions;
        if (visitNum !== null) {
            targetSubs = filteredSubmissions.filter(sub => parseInt(sub.visitNumber) === visitNum);
        }
        
        if (targetSubs.length === 0) return { yes: undefined, total: undefined };

        let yes = 0; let total = 0;
        targetSubs.forEach(sub => {
            const s = sub.scores || {};
            if (s[maxScoreKey] > 0) {
                yes += s[scoreKey] || 0;
                total += s[maxScoreKey] || 0;
            }
        });
        return { yes: Math.round(yes), total: Math.round(total) };
    };

    // --- Calculate Total States, Localities, and Facilities ---
    const uniqueStates = new Set();
    const uniqueLocalities = new Set();
    const uniqueFacilities = new Set();

    (filteredSubmissions || []).forEach(sub => {
        if (sub.state && sub.state !== 'N/A') uniqueStates.add(sub.state);
        if (sub.locality && sub.locality !== 'N/A') uniqueLocalities.add(`${sub.state}_${sub.locality}`);
        if (sub.facilityId && sub.facilityId !== 'N/A') uniqueFacilities.add(sub.facilityId);
    });

    const totalStates = uniqueStates.size;
    const totalLocalities = uniqueLocalities.size;
    const totalFacilities = uniqueFacilities.size;

    if (activeService === 'IMNCI') {
        const calcStat = (key) => overallKpis.skillStats?.[key]?.yes ? (overallKpis.skillStats[key].yes / (overallKpis.skillStats[key].yes + overallKpis.skillStats[key].no)) : null;
        
        const dangerSignsKpiList = [ 
            { title: t("Asked/Checked: Cannot Drink/Breastfeed"), scoreValue: calcStat('skill_ds_drink'), numerator: getStats(['skill_ds_drink']).yes, denominator: getStats(['skill_ds_drink']).total },
            { title: t("Asked/Checked: Vomits Everything"), scoreValue: calcStat('skill_ds_vomit'), numerator: getStats(['skill_ds_vomit']).yes, denominator: getStats(['skill_ds_vomit']).total },
            { title: t("Asked/Checked: Convulsions"), scoreValue: calcStat('skill_ds_convulsion'), numerator: getStats(['skill_ds_convulsion']).yes, denominator: getStats(['skill_ds_convulsion']).total },
            { title: t("Checked: Lethargic/Unconscious"), scoreValue: calcStat('skill_ds_conscious'), numerator: getStats(['skill_ds_conscious']).yes, denominator: getStats(['skill_ds_conscious']).total } 
        ];
        
        const measurementKpiGridList = [
            { title: t("Weight Measured Correctly"), scoreValue: overallKpis.avgHandsOnWeight, numerator: getStats(['skill_weight']).yes, denominator: getStats(['skill_weight']).total }, 
            { title: t("Temp Measured Correctly"), scoreValue: overallKpis.avgHandsOnTemp, numerator: getStats(['skill_temp']).yes, denominator: getStats(['skill_temp']).total }, 
            { title: t("Height Measured Correctly"), scoreValue: overallKpis.avgHandsOnHeight, numerator: getStats(['skill_height']).yes, denominator: getStats(['skill_height']).total }
        ];

        return (
            <div className="animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <KpiCard title={t("Total Completed Visits")} value={overallKpis.totalVisits} />
                    <KpiCard title={t("Total Health Workers Visited")} value={overallKpis.totalHealthWorkers} />
                    <KpiCard title={t("Total Cases Observed")} value={overallKpis.totalCasesObserved} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <KpiCard title={t("Total States")} value={totalStates} />
                    <KpiCard title={t("Total Localities")} value={totalLocalities} />
                    <KpiCard title={t("Total Health Facilities")} value={totalFacilities} />
                </div>
                
                {/* --- Split Individual Core Components --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("Overall IMNCI Adherence")} chartData={chartData} kpiKeys={[{ key: 'Overall', title: 'Overall Adherence', compositeKey: { score: 'overallScore_score', max: 'overallScore_maxScore' } }]} overallScore={overallKpis.avgOverall} totalNumerator={getCompositeStats('overallScore_score', 'overallScore_maxScore').yes} totalDenominator={getCompositeStats('overallScore_score', 'overallScore_maxScore').total} v1Numerator={getCompositeStats('overallScore_score', 'overallScore_maxScore', 1).yes} v1Denominator={getCompositeStats('overallScore_score', 'overallScore_maxScore', 1).total} v4Numerator={getCompositeStats('overallScore_score', 'overallScore_maxScore', 4).yes} v4Denominator={getCompositeStats('overallScore_score', 'overallScore_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                    <KpiLineChart title={t("Assess & Classify Adherence")} chartData={chartData} kpiKeys={[{ key: 'Assessment', title: 'Assess & Classify', compositeKey: { score: 'assessment_total_score_score', max: 'assessment_total_score_maxScore' } }]} overallScore={overallKpis.avgAssessment} totalNumerator={getCompositeStats('assessment_total_score_score', 'assessment_total_score_maxScore').yes} totalDenominator={getCompositeStats('assessment_total_score_score', 'assessment_total_score_maxScore').total} v1Numerator={getCompositeStats('assessment_total_score_score', 'assessment_total_score_maxScore', 1).yes} v1Denominator={getCompositeStats('assessment_total_score_score', 'assessment_total_score_maxScore', 1).total} v4Numerator={getCompositeStats('assessment_total_score_score', 'assessment_total_score_maxScore', 4).yes} v4Denominator={getCompositeStats('assessment_total_score_score', 'assessment_total_score_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("Final Decision Adherence")} chartData={chartData} kpiKeys={[{ key: 'Decision', title: 'Final Decision', compositeKey: { score: 'finalDecision_score', max: 'finalDecision_maxScore' } }]} overallScore={overallKpis.avgDecision} totalNumerator={getCompositeStats('finalDecision_score', 'finalDecision_maxScore').yes} totalDenominator={getCompositeStats('finalDecision_score', 'finalDecision_maxScore').total} v1Numerator={getCompositeStats('finalDecision_score', 'finalDecision_maxScore', 1).yes} v1Denominator={getCompositeStats('finalDecision_score', 'finalDecision_maxScore', 1).total} v4Numerator={getCompositeStats('finalDecision_score', 'finalDecision_maxScore', 4).yes} v4Denominator={getCompositeStats('finalDecision_score', 'finalDecision_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                    <KpiLineChart title={t("Treatment & Counsel Adherence")} chartData={chartData} kpiKeys={[{ key: 'Treatment', title: 'Treatment & Counsel', compositeKey: { score: 'treatment_total_score_score', max: 'treatment_total_score_maxScore' } }]} overallScore={overallKpis.avgTreatment} totalNumerator={getCompositeStats('treatment_total_score_score', 'treatment_total_score_maxScore').yes} totalDenominator={getCompositeStats('treatment_total_score_score', 'treatment_total_score_maxScore').total} v1Numerator={getCompositeStats('treatment_total_score_score', 'treatment_total_score_maxScore', 1).yes} v1Denominator={getCompositeStats('treatment_total_score_score', 'treatment_total_score_maxScore', 1).total} v4Numerator={getCompositeStats('treatment_total_score_score', 'treatment_total_score_maxScore', 4).yes} v4Denominator={getCompositeStats('treatment_total_score_score', 'treatment_total_score_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title={t("Danger Signs Assessment (Details)")} overallScore={overallKpis.avgDangerSigns} kpis={dangerSignsKpiList} />
                    <KpiLineChart title={t("Danger Signs Assessment (Overall)")} chartData={chartData} kpiKeys={[{ key: 'DangerSigns', title: 'Danger Signs Score', compositeKey: { score: 'dangerSigns_score', max: 'dangerSigns_maxScore' } }]} overallScore={overallKpis.avgDangerSigns} totalNumerator={getCompositeStats('dangerSigns_score', 'dangerSigns_maxScore').yes} totalDenominator={getCompositeStats('dangerSigns_score', 'dangerSigns_maxScore').total} v1Numerator={getCompositeStats('dangerSigns_score', 'dangerSigns_maxScore', 1).yes} v1Denominator={getCompositeStats('dangerSigns_score', 'dangerSigns_maxScore', 1).total} v4Numerator={getCompositeStats('dangerSigns_score', 'dangerSigns_maxScore', 4).yes} v4Denominator={getCompositeStats('dangerSigns_score', 'dangerSigns_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title={t("Correct Measurement Skills")} overallScore={calculateAverage([overallKpis.avgHandsOnWeight, overallKpis.avgHandsOnTemp, overallKpis.avgHandsOnHeight])} kpis={measurementKpiGridList} />
                    <KpiLineChart title={t("Correct Measurement Skills")} chartData={chartData} kpiKeys={[{ key: 'Measurement Skills', title: 'Measurement Skills Average' }]} overallScore={calculateAverage([overallKpis.avgHandsOnWeight, overallKpis.avgHandsOnTemp, overallKpis.avgHandsOnHeight])} totalNumerator={getStats(['skill_weight', 'skill_temp', 'skill_height']).yes} totalDenominator={getStats(['skill_weight', 'skill_temp', 'skill_height']).total} v1Numerator={getVisitStats(['skill_weight', 'skill_temp', 'skill_height'], 1).yes} v1Denominator={getVisitStats(['skill_weight', 'skill_temp', 'skill_height'], 1).total} v4Numerator={getVisitStats(['skill_weight', 'skill_temp', 'skill_height'], 4).yes} v4Denominator={getVisitStats(['skill_weight', 'skill_temp', 'skill_height'], 4).total} filteredSubmissions={filteredSubmissions} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("Correct Respiratory Rate Measurement")} chartData={chartData} kpiKeys={[{ key: 'Resp. Rate', title: 'Resp. Rate', rawKeys: ['skill_check_rr'] }]} overallScore={overallKpis.avgRespiratoryRateCalculation} totalNumerator={getStats(['skill_check_rr']).yes} totalDenominator={getStats(['skill_check_rr']).total} v1Numerator={getVisitStats(['skill_check_rr'], 1).yes} v1Denominator={getVisitStats(['skill_check_rr'], 1).total} v4Numerator={getVisitStats(['skill_check_rr'], 4).yes} v4Denominator={getVisitStats(['skill_check_rr'], 4).total} filteredSubmissions={filteredSubmissions} />
                    <KpiLineChart title={t("Correct Dehydration assessment")} chartData={chartData} kpiKeys={[{ key: 'Dehydration', title: 'Dehydration', rawKeys: ['skill_check_dehydration'] }]} overallScore={overallKpis.avgDehydrationAssessment} totalNumerator={getStats(['skill_check_dehydration']).yes} totalDenominator={getStats(['skill_check_dehydration']).total} v1Numerator={getVisitStats(['skill_check_dehydration'], 1).yes} v1Denominator={getVisitStats(['skill_check_dehydration'], 1).total} v4Numerator={getVisitStats(['skill_check_dehydration'], 4).yes} v4Denominator={getVisitStats(['skill_check_dehydration'], 4).total} filteredSubmissions={filteredSubmissions} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("Correct MUAC Measurement")} chartData={chartData} kpiKeys={[{ key: 'MUAC', title: 'MUAC', compositeKey: {score: 'handsOnMUAC_score', max: 'handsOnMUAC_maxScore'} }]} overallScore={overallKpis.avgHandsOnMUAC} totalNumerator={getCompositeStats('handsOnMUAC_score', 'handsOnMUAC_maxScore').yes} totalDenominator={getCompositeStats('handsOnMUAC_score', 'handsOnMUAC_maxScore').total} v1Numerator={getCompositeStats('handsOnMUAC_score', 'handsOnMUAC_maxScore', 1).yes} v1Denominator={getCompositeStats('handsOnMUAC_score', 'handsOnMUAC_maxScore', 1).total} v4Numerator={getCompositeStats('handsOnMUAC_score', 'handsOnMUAC_maxScore', 4).yes} v4Denominator={getCompositeStats('handsOnMUAC_score', 'handsOnMUAC_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                    <KpiLineChart title={t("Correct Z-Score (WFH) Measurement")} chartData={chartData} kpiKeys={[{ key: 'WFH', title: 'Z-Score WFH', compositeKey: {score: 'handsOnWFH_score', max: 'handsOnWFH_maxScore'} }]} overallScore={overallKpis.avgHandsOnWFH} totalNumerator={getCompositeStats('handsOnWFH_score', 'handsOnWFH_maxScore').yes} totalDenominator={getCompositeStats('handsOnWFH_score', 'handsOnWFH_maxScore').total} v1Numerator={getCompositeStats('handsOnWFH_score', 'handsOnWFH_maxScore', 1).yes} v1Denominator={getCompositeStats('handsOnWFH_score', 'handsOnWFH_maxScore', 1).total} v4Numerator={getCompositeStats('handsOnWFH_score', 'handsOnWFH_maxScore', 4).yes} v4Denominator={getCompositeStats('handsOnWFH_score', 'handsOnWFH_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("Correct Immunization assessment")} chartData={chartData} kpiKeys={[{ key: 'Immunization', title: 'Immunization', compositeKey: {score: 'immunization_score', max: 'immunization_maxScore'} }]} overallScore={overallKpis.avgImmunization} totalNumerator={getCompositeStats('immunization_score', 'immunization_maxScore').yes} totalDenominator={getCompositeStats('immunization_score', 'immunization_maxScore').total} v1Numerator={getCompositeStats('immunization_score', 'immunization_maxScore', 1).yes} v1Denominator={getCompositeStats('immunization_score', 'immunization_maxScore', 1).total} v4Numerator={getCompositeStats('immunization_score', 'immunization_maxScore', 4).yes} v4Denominator={getCompositeStats('immunization_score', 'immunization_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                    <KpiLineChart title={t("Correct vitamin A supplementation assessment")} chartData={chartData} kpiKeys={[{ key: 'Vitamin Assessment', title: 'Vitamin Assessment', rawKeys: ['skill_imm_vita'] }]} overallScore={overallKpis.avgVitaminAssessment} totalNumerator={getStats(['skill_imm_vita']).yes} totalDenominator={getStats(['skill_imm_vita']).total} v1Numerator={getVisitStats(['skill_imm_vita'], 1).yes} v1Denominator={getVisitStats(['skill_imm_vita'], 1).total} v4Numerator={getVisitStats(['skill_imm_vita'], 4).yes} v4Denominator={getVisitStats(['skill_imm_vita'], 4).total} filteredSubmissions={filteredSubmissions} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("Pneumonia cases Treated correctly with Amoxicillin")} chartData={chartData} kpiKeys={[{ key: 'Pneumonia Amox', title: 'Amoxicillin', rawKeys: ['skill_pneu_abx'] }]} overallScore={overallKpis.avgPneuAmox} totalNumerator={getStats(['skill_pneu_abx']).yes} totalDenominator={getStats(['skill_pneu_abx']).total} v1Numerator={getVisitStats(['skill_pneu_abx'], 1).yes} v1Denominator={getVisitStats(['skill_pneu_abx'], 1).total} v4Numerator={getVisitStats(['skill_pneu_abx'], 4).yes} v4Denominator={getVisitStats(['skill_pneu_abx'], 4).total} filteredSubmissions={filteredSubmissions} />
                    <KpiLineChart title={t("Diarrhea cases Treated with ORS")} chartData={chartData} kpiKeys={[{ key: 'Diarrhea ORS', title: 'ORS', rawKeys: ['skill_diar_ors'] }]} overallScore={overallKpis.avgDiarOrs} totalNumerator={getStats(['skill_diar_ors']).yes} totalDenominator={getStats(['skill_diar_ors']).total} v1Numerator={getVisitStats(['skill_diar_ors'], 1).yes} v1Denominator={getVisitStats(['skill_diar_ors'], 1).total} v4Numerator={getVisitStats(['skill_diar_ors'], 4).yes} v4Denominator={getVisitStats(['skill_diar_ors'], 4).total} filteredSubmissions={filteredSubmissions} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("Diarrhea cases Treated with Zinc")} chartData={chartData} kpiKeys={[{ key: 'Diarrhea Zinc', title: 'Zinc', rawKeys: ['skill_diar_zinc'] }]} overallScore={overallKpis.avgDiarZinc} totalNumerator={getStats(['skill_diar_zinc']).yes} totalDenominator={getStats(['skill_diar_zinc']).total} v1Numerator={getVisitStats(['skill_diar_zinc'], 1).yes} v1Denominator={getVisitStats(['skill_diar_zinc'], 1).total} v4Numerator={getVisitStats(['skill_diar_zinc'], 4).yes} v4Denominator={getVisitStats(['skill_diar_zinc'], 4).total} filteredSubmissions={filteredSubmissions} />
                    <KpiLineChart title={t("Malaria cases treated with Coartum")} chartData={chartData} kpiKeys={[{ key: 'Malaria Coartem', title: 'Coartem (ACT)', rawKeys: ['skill_mal_meds'] }]} overallScore={overallKpis.avgMalariaCoartem} totalNumerator={getStats(['skill_mal_meds']).yes} totalDenominator={getStats(['skill_mal_meds']).total} v1Numerator={getVisitStats(['skill_mal_meds'], 1).yes} v1Denominator={getVisitStats(['skill_mal_meds'], 1).total} v4Numerator={getVisitStats(['skill_mal_meds'], 4).yes} v4Denominator={getVisitStats(['skill_mal_meds'], 4).total} filteredSubmissions={filteredSubmissions} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("cases advised when to return immediately CORRECTLY")} chartData={chartData} kpiKeys={[{ key: 'Return Immediately', title: 'Return Immediately', rawKeys: ['skill_fu_when'] }]} overallScore={overallKpis.avgReturnImm} totalNumerator={getStats(['skill_fu_when']).yes} totalDenominator={getStats(['skill_fu_when']).total} v1Numerator={getVisitStats(['skill_fu_when'], 1).yes} v1Denominator={getVisitStats(['skill_fu_when'], 1).total} v4Numerator={getVisitStats(['skill_fu_when'], 4).yes} v4Denominator={getVisitStats(['skill_fu_when'], 4).total} filteredSubmissions={filteredSubmissions} />
                    <KpiLineChart title={t("cases advised to return for follow up correctly")} chartData={chartData} kpiKeys={[{ key: 'Return Followup', title: 'Return Followup', rawKeys: ['skill_fu_return'] }]} overallScore={overallKpis.avgReturnFu} totalNumerator={getStats(['skill_fu_return']).yes} totalDenominator={getStats(['skill_fu_return']).total} v1Numerator={getVisitStats(['skill_fu_return'], 1).yes} v1Denominator={getVisitStats(['skill_fu_return'], 1).total} v4Numerator={getVisitStats(['skill_fu_return'], 4).yes} v4Denominator={getVisitStats(['skill_fu_return'], 4).total} filteredSubmissions={filteredSubmissions} />
                </div>
                
                {/* --- Split Recording Form Use --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("correct recording Signs in IMNCI register")} chartData={chartData} kpiKeys={[{ key: 'Record Signs', title: 'Signs', rawKeys: ['skill_record_signs'] }]} overallScore={overallKpis.avgRecordSigns} totalNumerator={getStats(['skill_record_signs']).yes} totalDenominator={getStats(['skill_record_signs']).total} v1Numerator={getVisitStats(['skill_record_signs'], 1).yes} v1Denominator={getVisitStats(['skill_record_signs'], 1).total} v4Numerator={getVisitStats(['skill_record_signs'], 4).yes} v4Denominator={getVisitStats(['skill_record_signs'], 4).total} filteredSubmissions={filteredSubmissions} />
                    <KpiLineChart title={t("Correct Recording Classifications in IMNCI register")} chartData={chartData} kpiKeys={[{ key: 'Record Classifications', title: 'Classifications', rawKeys: ['skill_record_classifications'] }]} overallScore={overallKpis.avgRecordClass} totalNumerator={getStats(['skill_record_classifications']).yes} totalDenominator={getStats(['skill_record_classifications']).total} v1Numerator={getVisitStats(['skill_record_classifications'], 1).yes} v1Denominator={getVisitStats(['skill_record_classifications'], 1).total} v4Numerator={getVisitStats(['skill_record_classifications'], 4).yes} v4Denominator={getVisitStats(['skill_record_classifications'], 4).total} filteredSubmissions={filteredSubmissions} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiLineChart title={t("Correct Recording Treatments in IMNCI register")} chartData={chartData} kpiKeys={[{ key: 'Record Treatments', title: 'Treatments', rawKeys: ['skill_record_treatments'] }]} overallScore={overallKpis.avgRecordTreat} totalNumerator={getStats(['skill_record_treatments']).yes} totalDenominator={getStats(['skill_record_treatments']).total} v1Numerator={getVisitStats(['skill_record_treatments'], 1).yes} v1Denominator={getVisitStats(['skill_record_treatments'], 1).total} v4Numerator={getVisitStats(['skill_record_treatments'], 4).yes} v4Denominator={getVisitStats(['skill_record_treatments'], 4).total} filteredSubmissions={filteredSubmissions} />
                </div>

                <SummaryKpiTable title={`${t('KPI Summary by Job Description')} ${scopeTitle}`} kpiDefinitions={imnciSummaryDefs} overallKpis={overallKpis} kpisByWorkerType={kpisByWorkerType} />
                
                <h3 className="text-xl font-extrabold text-slate-800 mb-5 mt-10 text-left tracking-wide">{t('Overall Adherence by')} {t(geographicLevelName)} {scopeTitle}</h3>
                <div className="mb-10"><KpiBarChart title={`${t('Overall IMNCI Adherence by')} ${t(geographicLevelName)}`} chartData={geographicKpis} /></div>
                
                <h3 className="text-xl font-extrabold text-slate-800 mb-5 text-left tracking-wide">{t('Detailed Skill Performance')} {scopeTitle}</h3>
                <div className="mb-10"><CompactSkillsTable overallKpis={overallKpis} /></div>
            </div>
        );
    }

    // EENC
    const eencInfectionKpis = [
        { title: t("Hand Washing (1st)"), scoreValue: overallKpis.avgInfWash1, numerator: getStats(['prep_wash_1']).yes, denominator: getStats(['prep_wash_1']).total }, 
        { title: t("Hand Washing (2nd)"), scoreValue: overallKpis.avgInfWash2, numerator: getStats(['prep_wash_2']).yes, denominator: getStats(['prep_wash_2']).total }, 
        { title: t("Sterile Gloves Used"), scoreValue: overallKpis.avgInfGloves, numerator: getStats(['prep_gloves']).yes, denominator: getStats(['prep_gloves']).total }
    ];
    
    const eencPrepKpis = [
        { title: t("Towels Prepared"), scoreValue: overallKpis.avgPrepTowel, numerator: getStats(['prep_cloths']).yes, denominator: getStats(['prep_cloths']).total }, 
        { title: t("Resus Equipment Ready"), scoreValue: overallKpis.avgPrepEquip, numerator: getStats(['prep_resuscitation_area']).yes, denominator: getStats(['prep_resuscitation_area']).total }, 
        { title: t("Ambu Bag Checked"), scoreValue: overallKpis.avgPrepAmbu, numerator: getStats(['prep_ambu_check']).yes, denominator: getStats(['prep_ambu_check']).total }
    ];
    
    const eencCareKpis = [
        { title: t("Drying within 5 sec"), scoreValue: overallKpis.avgCareDry, numerator: getStats(['dry_start_5sec']).yes, denominator: getStats(['dry_start_5sec']).total }, 
        { title: t("Immediate Skin-to-Skin"), scoreValue: overallKpis.avgCareSkin, numerator: getStats(['dry_skin_to_skin']).yes, denominator: getStats(['dry_skin_to_skin']).total }, 
        { title: t("Dry Towel & Hat Used"), scoreValue: overallKpis.avgCareCover, numerator: getStats(['dry_cover_baby']).yes, denominator: getStats(['dry_cover_baby']).total }
    ];
    
    const eencCordKpis = [
        { title: t("Hygienic Cord Check"), scoreValue: overallKpis.avgCordHygiene, numerator: getStats(['normal_remove_outer_glove']).yes, denominator: getStats(['normal_remove_outer_glove']).total }, 
        { title: t("Delayed Clamping"), scoreValue: overallKpis.avgCordDelay, numerator: getStats(['normal_cord_pulse_check']).yes, denominator: getStats(['normal_cord_pulse_check']).total }, 
        { title: t("Correct Clamping"), scoreValue: overallKpis.avgCordClamp, numerator: getStats(['normal_cord_clamping']).yes, denominator: getStats(['normal_cord_clamping']).total }
    ];
    
    const eencBreastfeedingKpis = [
        { title: t("Early Breastfeeding Advice"), scoreValue: overallKpis.avgBfAdvice, numerator: getStats(['normal_breastfeeding_guidance']).yes, denominator: getStats(['normal_breastfeeding_guidance']).total }
    ];
    
    const eencResusExecKpis = [
        { title: t("Head Positioning"), scoreValue: overallKpis.avgResusHead, numerator: getStats(['resus_position_head']).yes, denominator: getStats(['resus_position_head']).total }, 
        { title: t("Good Mask Seal"), scoreValue: overallKpis.avgResusMask, numerator: getStats(['resus_mask_position']).yes, denominator: getStats(['resus_mask_position']).total }, 
        { title: t("Chest Rise (1st min)"), scoreValue: overallKpis.avgResusChest, numerator: getStats(['resus_check_chest_rise']).yes, denominator: getStats(['resus_check_chest_rise']).total }, 
        { title: t("Adequate Rate (30-50)"), scoreValue: overallKpis.avgResusRate, numerator: getStats(['resus_ventilation_rate']).yes, denominator: getStats(['resus_ventilation_rate']).total }
    ];

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <KpiCard title={t("Total Completed EENC Visits")} value={overallKpis.totalVisits} />
                <KpiCard title={t("Total Health Workers Visited")} value={overallKpis.totalHealthWorkers} />
                <KpiCard title={t("Total Cases Observed")} value={overallKpis.totalCasesObserved} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KpiCard title={t("Total States")} value={totalStates} />
                <KpiCard title={t("Total Localities")} value={totalLocalities} />
                <KpiCard title={t("Total Health Facilities")} value={totalFacilities} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Overall EENC Adherence")} chartData={chartData} kpiKeys={[{ key: 'Overall', title: 'Overall', compositeKey: { score: 'overallScore_score', max: 'overallScore_maxScore' } }]} overallScore={overallKpis.avgOverall} totalNumerator={getCompositeStats('overallScore_score', 'overallScore_maxScore').yes} totalDenominator={getCompositeStats('overallScore_score', 'overallScore_maxScore').total} v1Numerator={getCompositeStats('overallScore_score', 'overallScore_maxScore', 1).yes} v1Denominator={getCompositeStats('overallScore_score', 'overallScore_maxScore', 1).total} v4Numerator={getCompositeStats('overallScore_score', 'overallScore_maxScore', 4).yes} v4Denominator={getCompositeStats('overallScore_score', 'overallScore_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                <KpiLineChart title={t("Preparation Score")} chartData={chartData} kpiKeys={[{ key: 'Preparation', title: 'Preparation', compositeKey: { score: 'preparation_score', max: 'preparation_maxScore' } }]} overallScore={overallKpis.avgPreparation} totalNumerator={getCompositeStats('preparation_score', 'preparation_maxScore').yes} totalDenominator={getCompositeStats('preparation_score', 'preparation_maxScore').total} v1Numerator={getCompositeStats('preparation_score', 'preparation_maxScore', 1).yes} v1Denominator={getCompositeStats('preparation_score', 'preparation_maxScore', 1).total} v4Numerator={getCompositeStats('preparation_score', 'preparation_maxScore', 4).yes} v4Denominator={getCompositeStats('preparation_score', 'preparation_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Drying & Stimulation Score")} chartData={chartData} kpiKeys={[{ key: 'Drying', title: 'Drying', compositeKey: { score: 'drying_score', max: 'drying_maxScore' } }]} overallScore={overallKpis.avgDrying} totalNumerator={getCompositeStats('drying_score', 'drying_maxScore').yes} totalDenominator={getCompositeStats('drying_score', 'drying_maxScore').total} v1Numerator={getCompositeStats('drying_score', 'drying_maxScore', 1).yes} v1Denominator={getCompositeStats('drying_score', 'drying_maxScore', 1).total} v4Numerator={getCompositeStats('drying_score', 'drying_maxScore', 4).yes} v4Denominator={getCompositeStats('drying_score', 'drying_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                <KpiLineChart title={t("Breathing Baby Mgmt Score")} chartData={chartData} kpiKeys={[{ key: 'Breathing Mgmt', title: 'Breathing Mgmt', compositeKey: { score: 'normal_breathing_score', max: 'normal_breathing_maxScore' } }]} overallScore={overallKpis.avgNormalBreathing} totalNumerator={getCompositeStats('normal_breathing_score', 'normal_breathing_maxScore').yes} totalDenominator={getCompositeStats('normal_breathing_score', 'normal_breathing_maxScore').total} v1Numerator={getCompositeStats('normal_breathing_score', 'normal_breathing_maxScore', 1).yes} v1Denominator={getCompositeStats('normal_breathing_score', 'normal_breathing_maxScore', 1).total} v4Numerator={getCompositeStats('normal_breathing_score', 'normal_breathing_maxScore', 4).yes} v4Denominator={getCompositeStats('normal_breathing_score', 'normal_breathing_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Resuscitation Score")} chartData={chartData} kpiKeys={[{ key: 'Resuscitation', title: 'Resuscitation', compositeKey: { score: 'resuscitation_score', max: 'resuscitation_maxScore' } }]} overallScore={overallKpis.avgResuscitation} totalNumerator={getCompositeStats('resuscitation_score', 'resuscitation_maxScore').yes} totalDenominator={getCompositeStats('resuscitation_score', 'resuscitation_maxScore').total} v1Numerator={getCompositeStats('resuscitation_score', 'resuscitation_maxScore', 1).yes} v1Denominator={getCompositeStats('resuscitation_score', 'resuscitation_maxScore', 1).total} v4Numerator={getCompositeStats('resuscitation_score', 'resuscitation_maxScore', 4).yes} v4Denominator={getCompositeStats('resuscitation_score', 'resuscitation_maxScore', 4).total} filteredSubmissions={filteredSubmissions} />
                <DetailedKpiCard title={t("Infection Control (Details)")} overallScore={calculateAverage([overallKpis.avgInfWash1, overallKpis.avgInfWash2, overallKpis.avgInfGloves])} kpis={eencInfectionKpis} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Hand Washing (1st)")} chartData={chartData} kpiKeys={[{ key: 'Hand Washing (1st)', title: 'Hand Wash 1', rawKeys: ['prep_wash_1'] }]} overallScore={overallKpis.avgInfWash1} totalNumerator={getStats(['prep_wash_1']).yes} totalDenominator={getStats(['prep_wash_1']).total} v1Numerator={getVisitStats(['prep_wash_1'], 1).yes} v1Denominator={getVisitStats(['prep_wash_1'], 1).total} v4Numerator={getVisitStats(['prep_wash_1'], 4).yes} v4Denominator={getVisitStats(['prep_wash_1'], 4).total} filteredSubmissions={filteredSubmissions} />
                <KpiLineChart title={t("Hand Washing (2nd)")} chartData={chartData} kpiKeys={[{ key: 'Hand Washing (2nd)', title: 'Hand Wash 2', rawKeys: ['prep_wash_2'] }]} overallScore={overallKpis.avgInfWash2} totalNumerator={getStats(['prep_wash_2']).yes} totalDenominator={getStats(['prep_wash_2']).total} v1Numerator={getVisitStats(['prep_wash_2'], 1).yes} v1Denominator={getVisitStats(['prep_wash_2'], 1).total} v4Numerator={getVisitStats(['prep_wash_2'], 4).yes} v4Denominator={getVisitStats(['prep_wash_2'], 4).total} filteredSubmissions={filteredSubmissions} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Sterile Gloves Used")} chartData={chartData} kpiKeys={[{ key: 'Sterile Gloves', title: 'Gloves', rawKeys: ['prep_gloves'] }]} overallScore={overallKpis.avgInfGloves} totalNumerator={getStats(['prep_gloves']).yes} totalDenominator={getStats(['prep_gloves']).total} v1Numerator={getVisitStats(['prep_gloves'], 1).yes} v1Denominator={getVisitStats(['prep_gloves'], 1).total} v4Numerator={getVisitStats(['prep_gloves'], 4).yes} v4Denominator={getVisitStats(['prep_gloves'], 4).total} filteredSubmissions={filteredSubmissions} />
                <DetailedKpiCard title={t("Preparedness (Details)")} overallScore={overallKpis.avgPreparation} kpis={eencPrepKpis} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Towels Prepared")} chartData={chartData} kpiKeys={[{ key: 'Towels Ready', title: 'Towels', rawKeys: ['prep_cloths'] }]} overallScore={overallKpis.avgPrepTowel} totalNumerator={getStats(['prep_cloths']).yes} totalDenominator={getStats(['prep_cloths']).total} v1Numerator={getVisitStats(['prep_cloths'], 1).yes} v1Denominator={getVisitStats(['prep_cloths'], 1).total} v4Numerator={getVisitStats(['prep_cloths'], 4).yes} v4Denominator={getVisitStats(['prep_cloths'], 4).total} filteredSubmissions={filteredSubmissions} />
                <KpiLineChart title={t("Resus Equipment Ready")} chartData={chartData} kpiKeys={[{ key: 'Resus Equip Ready', title: 'Equip Ready', rawKeys: ['prep_resuscitation_area'] }]} overallScore={overallKpis.avgPrepEquip} totalNumerator={getStats(['prep_resuscitation_area']).yes} totalDenominator={getStats(['prep_resuscitation_area']).total} v1Numerator={getVisitStats(['prep_resuscitation_area'], 1).yes} v1Denominator={getVisitStats(['prep_resuscitation_area'], 1).total} v4Numerator={getVisitStats(['prep_resuscitation_area'], 4).yes} v4Denominator={getVisitStats(['prep_resuscitation_area'], 4).total} filteredSubmissions={filteredSubmissions} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Ambu Bag Checked")} chartData={chartData} kpiKeys={[{ key: 'Ambu Check', title: 'Ambu Check', rawKeys: ['prep_ambu_check'] }]} overallScore={overallKpis.avgPrepAmbu} totalNumerator={getStats(['prep_ambu_check']).yes} totalDenominator={getStats(['prep_ambu_check']).total} v1Numerator={getVisitStats(['prep_ambu_check'], 1).yes} v1Denominator={getVisitStats(['prep_ambu_check'], 1).total} v4Numerator={getVisitStats(['prep_ambu_check'], 4).yes} v4Denominator={getVisitStats(['prep_ambu_check'], 4).total} filteredSubmissions={filteredSubmissions} />
                <DetailedKpiCard title={t("Early Care (Details)")} overallScore={overallKpis.avgDrying} kpis={eencCareKpis} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Drying within 5 sec")} chartData={chartData} kpiKeys={[{ key: 'Drying < 5s', title: 'Drying < 5s', rawKeys: ['dry_start_5sec'] }]} overallScore={overallKpis.avgCareDry} totalNumerator={getStats(['dry_start_5sec']).yes} totalDenominator={getStats(['dry_start_5sec']).total} v1Numerator={getVisitStats(['dry_start_5sec'], 1).yes} v1Denominator={getVisitStats(['dry_start_5sec'], 1).total} v4Numerator={getVisitStats(['dry_start_5sec'], 4).yes} v4Denominator={getVisitStats(['dry_start_5sec'], 4).total} filteredSubmissions={filteredSubmissions} />
                <KpiLineChart title={t("Immediate Skin-to-Skin")} chartData={chartData} kpiKeys={[{ key: 'Skin-to-Skin', title: 'Skin-to-Skin', rawKeys: ['dry_skin_to_skin'] }]} overallScore={overallKpis.avgCareSkin} totalNumerator={getStats(['dry_skin_to_skin']).yes} totalDenominator={getStats(['dry_skin_to_skin']).total} v1Numerator={getVisitStats(['dry_skin_to_skin'], 1).yes} v1Denominator={getVisitStats(['dry_skin_to_skin'], 1).total} v4Numerator={getVisitStats(['dry_skin_to_skin'], 4).yes} v4Denominator={getVisitStats(['dry_skin_to_skin'], 4).total} filteredSubmissions={filteredSubmissions} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Dry Towel & Hat Used")} chartData={chartData} kpiKeys={[{ key: 'Dry Towel/Hat', title: 'Towel/Hat', rawKeys: ['dry_cover_baby'] }]} overallScore={overallKpis.avgCareCover} totalNumerator={getStats(['dry_cover_baby']).yes} totalDenominator={getStats(['dry_cover_baby']).total} v1Numerator={getVisitStats(['dry_cover_baby'], 1).yes} v1Denominator={getVisitStats(['dry_cover_baby'], 1).total} v4Numerator={getVisitStats(['dry_cover_baby'], 4).yes} v4Denominator={getVisitStats(['dry_cover_baby'], 4).total} filteredSubmissions={filteredSubmissions} />
                <DetailedKpiCard title={t("Cord Management (Details)")} overallScore={calculateAverage([overallKpis.avgCordHygiene, overallKpis.avgCordDelay, overallKpis.avgCordClamp])} kpis={eencCordKpis} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Hygienic Cord Check")} chartData={chartData} kpiKeys={[{ key: 'Hygienic Check', title: 'Hygienic Check', rawKeys: ['normal_remove_outer_glove'] }]} overallScore={overallKpis.avgCordHygiene} totalNumerator={getStats(['normal_remove_outer_glove']).yes} totalDenominator={getStats(['normal_remove_outer_glove']).total} v1Numerator={getVisitStats(['normal_remove_outer_glove'], 1).yes} v1Denominator={getVisitStats(['normal_remove_outer_glove'], 1).total} v4Numerator={getVisitStats(['normal_remove_outer_glove'], 4).yes} v4Denominator={getVisitStats(['normal_remove_outer_glove'], 4).total} filteredSubmissions={filteredSubmissions} />
                <KpiLineChart title={t("Delayed Clamping")} chartData={chartData} kpiKeys={[{ key: 'Delayed Clamp', title: 'Delayed Clamp', rawKeys: ['normal_cord_pulse_check'] }]} overallScore={overallKpis.avgCordDelay} totalNumerator={getStats(['normal_cord_pulse_check']).yes} totalDenominator={getStats(['normal_cord_pulse_check']).total} v1Numerator={getVisitStats(['normal_cord_pulse_check'], 1).yes} v1Denominator={getVisitStats(['normal_cord_pulse_check'], 1).total} v4Numerator={getVisitStats(['normal_cord_pulse_check'], 4).yes} v4Denominator={getVisitStats(['normal_cord_pulse_check'], 4).total} filteredSubmissions={filteredSubmissions} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Correct Clamping")} chartData={chartData} kpiKeys={[{ key: 'Correct Clamp', title: 'Correct Clamp', rawKeys: ['normal_cord_clamping'] }]} overallScore={overallKpis.avgCordClamp} totalNumerator={getStats(['normal_cord_clamping']).yes} totalDenominator={getStats(['normal_cord_clamping']).total} v1Numerator={getVisitStats(['normal_cord_clamping'], 1).yes} v1Denominator={getVisitStats(['normal_cord_clamping'], 1).total} v4Numerator={getVisitStats(['normal_cord_clamping'], 4).yes} v4Denominator={getVisitStats(['normal_cord_clamping'], 4).total} filteredSubmissions={filteredSubmissions} />
                <DetailedKpiCard title={t("Breastfeeding (Details)")} overallScore={overallKpis.avgBfAdvice} kpis={eencBreastfeedingKpis} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Early Breastfeeding Advice")} chartData={chartData} kpiKeys={[{ key: 'Early BF Advice', title: 'BF Advice', rawKeys: ['normal_breastfeeding_guidance'] }]} overallScore={overallKpis.avgBfAdvice} totalNumerator={getStats(['normal_breastfeeding_guidance']).yes} totalDenominator={getStats(['normal_breastfeeding_guidance']).total} v1Numerator={getVisitStats(['normal_breastfeeding_guidance'], 1).yes} v1Denominator={getVisitStats(['normal_breastfeeding_guidance'], 1).total} v4Numerator={getVisitStats(['normal_breastfeeding_guidance'], 4).yes} v4Denominator={getVisitStats(['normal_breastfeeding_guidance'], 4).total} filteredSubmissions={filteredSubmissions} />
                <DetailedKpiCard title={t("Resuscitation Execution (Details)")} overallScore={overallKpis.avgResuscitation} kpis={eencResusExecKpis} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Head Positioning")} chartData={chartData} kpiKeys={[{ key: 'Head Pos', title: 'Head Pos', rawKeys: ['resus_position_head'] }]} overallScore={overallKpis.avgResusHead} totalNumerator={getStats(['resus_position_head']).yes} totalDenominator={getStats(['resus_position_head']).total} v1Numerator={getVisitStats(['resus_position_head'], 1).yes} v1Denominator={getVisitStats(['resus_position_head'], 1).total} v4Numerator={getVisitStats(['resus_position_head'], 4).yes} v4Denominator={getVisitStats(['resus_position_head'], 4).total} filteredSubmissions={filteredSubmissions} />
                <KpiLineChart title={t("Good Mask Seal")} chartData={chartData} kpiKeys={[{ key: 'Mask Seal', title: 'Mask Seal', rawKeys: ['resus_mask_position'] }]} overallScore={overallKpis.avgResusMask} totalNumerator={getStats(['resus_mask_position']).yes} totalDenominator={getStats(['resus_mask_position']).total} v1Numerator={getVisitStats(['resus_mask_position'], 1).yes} v1Denominator={getVisitStats(['resus_mask_position'], 1).total} v4Numerator={getVisitStats(['resus_mask_position'], 4).yes} v4Denominator={getVisitStats(['resus_mask_position'], 4).total} filteredSubmissions={filteredSubmissions} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiLineChart title={t("Chest Rise (1st min)")} chartData={chartData} kpiKeys={[{ key: 'Chest Rise', title: 'Chest Rise', rawKeys: ['resus_check_chest_rise'] }]} overallScore={overallKpis.avgResusChest} totalNumerator={getStats(['resus_check_chest_rise']).yes} totalDenominator={getStats(['resus_check_chest_rise']).total} v1Numerator={getVisitStats(['resus_check_chest_rise'], 1).yes} v1Denominator={getVisitStats(['resus_check_chest_rise'], 1).total} v4Numerator={getVisitStats(['resus_check_chest_rise'], 4).yes} v4Denominator={getVisitStats(['resus_check_chest_rise'], 4).total} filteredSubmissions={filteredSubmissions} />
                <KpiLineChart title={t("Adequate Rate (30-50)")} chartData={chartData} kpiKeys={[{ key: 'Rate 30-50', title: 'Rate', rawKeys: ['resus_ventilation_rate'] }]} overallScore={overallKpis.avgResusRate} totalNumerator={getStats(['resus_ventilation_rate']).yes} totalDenominator={getStats(['resus_ventilation_rate']).total} v1Numerator={getVisitStats(['resus_ventilation_rate'], 1).yes} v1Denominator={getVisitStats(['resus_ventilation_rate'], 1).total} v4Numerator={getVisitStats(['resus_ventilation_rate'], 4).yes} v4Denominator={getVisitStats(['resus_ventilation_rate'], 4).total} filteredSubmissions={filteredSubmissions} />
            </div>
            
            <SummaryKpiTable title={`${t('KPI Summary by Job Description')} ${scopeTitle}`} kpiDefinitions={eencSummaryDefs} overallKpis={overallKpis} kpisByWorkerType={kpisByWorkerType} />

            <h3 className="text-xl font-bold text-slate-800 mb-5 mt-10 text-left tracking-wide">{t('Overall EENC Adherence by')} {t(geographicLevelName)} {scopeTitle}</h3>
            <div className="mb-10"><KpiBarChart title={`${t('Overall EENC Adherence by')} ${t(geographicLevelName)}`} chartData={geographicKpis} /></div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-5 text-left tracking-wide">{t('Detailed EENC Skill Performance')} {scopeTitle}</h3>
            <div className="mb-10"><EENCCompactSkillsTable overallKpis={overallKpis} /></div>
        </div>
    );
};

export default ProviderSkillsTab;