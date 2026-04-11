// ProviderSkillsTab.jsx
import React from 'react';
import { useTranslation } from './LanguageContext'; // <-- ADDED TRANSLATION HOOK
import { 
    KpiCard, 
    KpiCardWithChart, 
    DetailedKpiCard, 
    KpiLineChart, 
    SummaryKpiTable, 
    KpiBarChart, 
    KpiGridCard,
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
    imnciSummaryDefs, eencSummaryDefs, scopeTitle, geographicLevelName
}) => {
    const { t } = useTranslation(); // <-- INITIALIZE TRANSLATION

    if (activeService === 'IMNCI') {
        const overallImnciKpiList = [{ title: t("Overall Adherence Score"), scoreValue: overallKpis.avgOverall }];
        const mainKpiGridList = [{ title: t("Assess & Classify"), scoreValue: overallKpis.avgAssessment }, { title: t("Final Decision"), scoreValue: overallKpis.avgDecision }, { title: t("Treatment & Counsel"), scoreValue: overallKpis.avgTreatment }];
        
        const calcStat = (key) => overallKpis.skillStats?.[key]?.yes ? (overallKpis.skillStats[key].yes / (overallKpis.skillStats[key].yes + overallKpis.skillStats[key].no)) : null;
        const dangerSignsKpiList = [ 
            { title: t("Asked/Checked: Cannot Drink/Breastfeed"), scoreValue: calcStat('skill_ds_drink') },
            { title: t("Asked/Checked: Vomits Everything"), scoreValue: calcStat('skill_ds_vomit') },
            { title: t("Asked/Checked: Convulsions"), scoreValue: calcStat('skill_ds_convulsion') },
            { title: t("Checked: Lethargic/Unconscious"), scoreValue: calcStat('skill_ds_conscious') } 
        ];
        
        const measurementKpiGridList = [{ title: t("Weight Measured Correctly"), scoreValue: overallKpis.avgHandsOnWeight }, { title: t("Temp Measured Correctly"), scoreValue: overallKpis.avgHandsOnTemp }, { title: t("Height Measured Correctly"), scoreValue: overallKpis.avgHandsOnHeight }];
        const malnutritionSignsKpiList = [{ title: t("MUAC Measured Correctly"), scoreValue: overallKpis.avgHandsOnMUAC }, { title: t("Z-Score (WFH) Measured Correctly"), scoreValue: overallKpis.avgHandsOnWFH }];
        const recordingKpiGridList = [{ title: t("Registering Signs"), scoreValue: overallKpis.avgRecordSigns }, { title: t("Registering Classifications"), scoreValue: overallKpis.avgRecordClass }, { title: t("Registering Treatments"), scoreValue: overallKpis.avgRecordTreat }];

        return (
            <div className="animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <KpiCard title={t("Total Completed Visits")} value={overallKpis.totalVisits} />
                    <KpiCard title={t("Total Health Workers Visited")} value={overallKpis.totalHealthWorkers} />
                    <KpiCard title={t("Total Cases Observed")} value={overallKpis.totalCasesObserved} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title={t("Overall IMNCI Adherence")} kpis={overallImnciKpiList} chartData={chartData} kpiKeys={[{ key: 'Overall', title: 'Overall Adherence' }]} cols={1} />
                    <KpiCardWithChart title={t("Core Components Adherence")} kpis={mainKpiGridList} chartData={chartData} kpiKeys={[{ key: 'Assessment', title: 'Assessment' }, { key: 'Decision', title: 'Decision' }, { key: 'Treatment', title: 'Treatment' }]} cols={3} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title={t("Danger Signs Assessment")} overallScore={overallKpis.avgDangerSigns} kpis={dangerSignsKpiList} />
                    <KpiLineChart title={t("Adherence Over Time (Danger Signs)")} chartData={chartData} kpiKeys={[{ key: 'DangerSigns', title: 'Danger Signs Score' }]} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title={t("Measurement Skills (Average)")} overallScore={calculateAverage([overallKpis.avgHandsOnWeight, overallKpis.avgHandsOnTemp, overallKpis.avgHandsOnHeight])} kpis={measurementKpiGridList} />
                    <KpiLineChart title={t("Adherence Over Time (Measurement Skills)")} chartData={chartData} kpiKeys={[{ key: 'Measurement Skills', title: 'Measurement Skills Average' }]} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title={t("Correct Respiratory Rate Measurement")} kpis={[{ title: " ", scoreValue: overallKpis.avgRespiratoryRateCalculation }]} chartData={chartData} kpiKeys={[{ key: 'Resp. Rate', title: 'Resp. Rate' }]} cols={1} />
                    <KpiCardWithChart title={t("Correct Dehydration assessment")} kpis={[{ title: " ", scoreValue: overallKpis.avgDehydrationAssessment }]} chartData={chartData} kpiKeys={[{ key: 'Dehydration', title: 'Dehydration' }]} cols={1} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title={t("Correct Malnutrition Assessment")} overallScore={calculateAverage([overallKpis.avgHandsOnMUAC, overallKpis.avgHandsOnWFH])} kpis={malnutritionSignsKpiList} />
                    <KpiLineChart title={t("Adherence Over Time (Malnutrition Signs)")} chartData={chartData} kpiKeys={[{ key: 'Malnutrition Assessment', title: 'Malnutrition Assessment' }]} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title={t("Percentage of cases assessed for Immunization correctly")} kpis={[{ title: " ", scoreValue: overallKpis.avgImmunization }]} chartData={chartData} kpiKeys={[{ key: 'Immunization', title: 'Immunization' }]} cols={1} />
                    <KpiCardWithChart title={t("Percentage of cases assessed for vitamin supplementation correctly")} kpis={[{ title: " ", scoreValue: overallKpis.avgVitaminAssessment }]} chartData={chartData} kpiKeys={[{ key: 'Vitamin Assessment', title: 'Vitamin Assessment' }]} cols={1} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title={t("Percentage of Pneumonia cases Treated correctly with Amoxicillin")} kpis={[{ title: " ", scoreValue: overallKpis.avgPneuAmox }]} chartData={chartData} kpiKeys={[{ key: 'Pneumonia Amox', title: 'Amoxicillin' }]} cols={1} />
                    <KpiCardWithChart title={t("Percentage of Diarrhea cases Treated with ORS")} kpis={[{ title: " ", scoreValue: overallKpis.avgDiarOrs }]} chartData={chartData} kpiKeys={[{ key: 'Diarrhea ORS', title: 'ORS' }]} cols={1} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title={t("Percentage of Diarrhea cases Treated with Zinc")} kpis={[{ title: " ", scoreValue: overallKpis.avgDiarZinc }]} chartData={chartData} kpiKeys={[{ key: 'Diarrhea Zinc', title: 'Zinc' }]} cols={1} />
                    <KpiCardWithChart title={t("Percentage of malaria cases treated with Coartum")} kpis={[{ title: " ", scoreValue: overallKpis.avgMalariaCoartem }]} chartData={chartData} kpiKeys={[{ key: 'Malaria Coartem', title: 'Coartem (ACT)' }]} cols={1} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title={t("Percentage of cases advised when to return immediately")} kpis={[{ title: " ", scoreValue: overallKpis.avgReturnImm }]} chartData={chartData} kpiKeys={[{ key: 'Return Immediately', title: 'Return Immediately' }]} cols={1} />
                    <KpiCardWithChart title={t("Percentage of cases advised to return for follow up")} kpis={[{ title: " ", scoreValue: overallKpis.avgReturnFu }]} chartData={chartData} kpiKeys={[{ key: 'Return Followup', title: 'Return Followup' }]} cols={1} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title={t("Recording Form Use")} overallScore={calculateAverage([overallKpis.avgRecordSigns, overallKpis.avgRecordClass, overallKpis.avgRecordTreat])} kpis={recordingKpiGridList} />
                    <KpiLineChart title={t("Recording Form Use Over Time")} chartData={chartData} kpiKeys={[{ key: 'Record Signs', title: 'Signs' }, { key: 'Record Classifications', title: 'Classifications' }, { key: 'Record Treatments', title: 'Treatments' }]} />
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
    const eencMainKpiGridList = [{ title: t("Overall EENC Adherence"), scoreValue: overallKpis.avgOverall }, { title: t("Preparation Score"), scoreValue: overallKpis.avgPreparation }, { title: t("Drying & Stimulation Score"), scoreValue: overallKpis.avgDrying }, { title: t("Breathing Baby Mgmt Score"), scoreValue: overallKpis.avgNormalBreathing }, { title: t("Resuscitation Score"), scoreValue: overallKpis.avgResuscitation }];
    const eencInfectionKpis = [{ title: t("Hand Washing (1st)"), scoreValue: overallKpis.avgInfWash1 }, { title: t("Hand Washing (2nd)"), scoreValue: overallKpis.avgInfWash2 }, { title: t("Sterile Gloves Used"), scoreValue: overallKpis.avgInfGloves }];
    const eencPrepKpis = [{ title: t("Towels Prepared"), scoreValue: overallKpis.avgPrepTowel }, { title: t("Resus Equipment Ready"), scoreValue: overallKpis.avgPrepEquip }, { title: t("Ambu Bag Checked"), scoreValue: overallKpis.avgPrepAmbu }];
    const eencCareKpis = [{ title: t("Drying within 5 sec"), scoreValue: overallKpis.avgCareDry }, { title: t("Immediate Skin-to-Skin"), scoreValue: overallKpis.avgCareSkin }, { title: t("Dry Towel & Hat Used"), scoreValue: overallKpis.avgCareCover }];
    const eencCordKpis = [{ title: t("Hygienic Cord Check"), scoreValue: overallKpis.avgCordHygiene }, { title: t("Delayed Clamping"), scoreValue: overallKpis.avgCordDelay }, { title: t("Correct Clamping"), scoreValue: overallKpis.avgCordClamp }];
    const eencBreastfeedingKpis = [{ title: t("Early Breastfeeding Advice"), scoreValue: overallKpis.avgBfAdvice }];
    const eencResusExecKpis = [{ title: t("Head Positioning"), scoreValue: overallKpis.avgResusHead }, { title: t("Good Mask Seal"), scoreValue: overallKpis.avgResusMask }, { title: t("Chest Rise (1st min)"), scoreValue: overallKpis.avgResusChest }, { title: t("Adequate Rate (30-50)"), scoreValue: overallKpis.avgResusRate }];

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KpiCard title={t("Total Completed EENC Visits")} value={overallKpis.totalVisits} />
                <KpiCard title={t("Total Health Workers Visited")} value={overallKpis.totalHealthWorkers} />
                <KpiCard title={t("Total Cases Observed")} value={overallKpis.totalCasesObserved} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiGridCard title={t("Overall EENC Adherence Scores (Average)")} kpis={eencMainKpiGridList} cols={3} />
                <KpiLineChart title={t("EENC Adherence Over Time (Main KPIs)")} chartData={chartData} kpiKeys={[{ key: 'Overall', title: 'Overall' }, { key: 'Preparation', title: 'Preparation' }, { key: 'Drying', title: 'Drying' }, { key: 'Breathing Mgmt', title: 'Breathing Mgmt' }]} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("KPI 1: Infection Control (All Cases)")} overallScore={calculateAverage([overallKpis.avgInfWash1, overallKpis.avgInfWash2, overallKpis.avgInfGloves])} kpis={eencInfectionKpis} /><KpiLineChart title={t("KPI 1 Over Time: Infection Control")} chartData={chartData} kpiKeys={[{ key: 'Hand Washing (1st)', title: 'Hand Wash 1' }, { key: 'Hand Washing (2nd)', title: 'Hand Wash 2' }, { key: 'Sterile Gloves', title: 'Gloves' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("KPI 2: Resuscitation Preparedness (All Cases)")} overallScore={overallKpis.avgPreparation} kpis={eencPrepKpis} /><KpiLineChart title={t("KPI 2 Over Time: Preparedness")} chartData={chartData} kpiKeys={[{ key: 'Towels Ready', title: 'Towels' }, { key: 'Resus Equip Ready', title: 'Equip Ready' }, { key: 'Ambu Check', title: 'Ambu Check' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("KPI 3: Early Care (All Cases)")} overallScore={overallKpis.avgDrying} kpis={eencCareKpis} /><KpiLineChart title={t("KPI 3 Over Time: Early Care")} chartData={chartData} kpiKeys={[{ key: 'Drying < 5s', title: 'Drying < 5s' }, { key: 'Skin-to-Skin', title: 'Skin-to-Skin' }, { key: 'Dry Towel/Hat', title: 'Towel/Hat' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("KPI 4: Cord Management (Breathing Babies)")} overallScore={calculateAverage([overallKpis.avgCordHygiene, overallKpis.avgCordDelay, overallKpis.avgCordClamp])} kpis={eencCordKpis} /><KpiLineChart title={t("KPI 4 Over Time: Cord Mgmt")} chartData={chartData} kpiKeys={[{ key: 'Hygienic Check', title: 'Hygienic Check' }, { key: 'Delayed Clamp', title: 'Delayed Clamp' }, { key: 'Correct Clamp', title: 'Correct Clamp' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("KPI 5: Breastfeeding (Breathing Babies)")} overallScore={overallKpis.avgBfAdvice} kpis={eencBreastfeedingKpis} /><KpiLineChart title={t("KPI 5 Over Time: Breastfeeding")} chartData={chartData} kpiKeys={[{ key: 'Early BF Advice', title: 'BF Advice' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("KPI 6: Resuscitation Execution (Non-Breathing)")} overallScore={overallKpis.avgResuscitation} kpis={eencResusExecKpis} /><KpiLineChart title={t("KPI 6 Over Time: Resuscitation")} chartData={chartData} kpiKeys={[{ key: 'Head Pos', title: 'Head Pos' }, { key: 'Mask Seal', title: 'Mask Seal' }, { key: 'Chest Rise', title: 'Chest Rise' }, { key: 'Rate 30-50', title: 'Rate' }]} /></div>
            
            <SummaryKpiTable title={`${t('KPI Summary by Job Description')} ${scopeTitle}`} kpiDefinitions={eencSummaryDefs} overallKpis={overallKpis} kpisByWorkerType={kpisByWorkerType} />

            <h3 className="text-xl font-bold text-slate-800 mb-5 mt-10 text-left tracking-wide">{t('Overall EENC Adherence by')} {t(geographicLevelName)} {scopeTitle}</h3>
            <div className="mb-10"><KpiBarChart title={`${t('Overall EENC Adherence by')} ${t(geographicLevelName)}`} chartData={geographicKpis} /></div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-5 text-left tracking-wide">{t('Detailed EENC Skill Performance')} {scopeTitle}</h3>
            <div className="mb-10"><EENCCompactSkillsTable overallKpis={overallKpis} /></div>
        </div>
    );
};

export default ProviderSkillsTab;