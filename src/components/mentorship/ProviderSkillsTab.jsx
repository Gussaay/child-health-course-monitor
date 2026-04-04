// ProviderSkillsTab.jsx
import React from 'react';
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
    
    if (activeService === 'IMNCI') {
        const overallImnciKpiList = [{ title: "Overall Adherence Score", scoreValue: overallKpis.avgOverall }];
        const mainKpiGridList = [{ title: "Assess & Classify", scoreValue: overallKpis.avgAssessment }, { title: "Final Decision", scoreValue: overallKpis.avgDecision }, { title: "Treatment & Counsel", scoreValue: overallKpis.avgTreatment }];
        
        const calcStat = (key) => overallKpis.skillStats?.[key]?.yes ? (overallKpis.skillStats[key].yes / (overallKpis.skillStats[key].yes + overallKpis.skillStats[key].no)) : null;
        const dangerSignsKpiList = [ 
            { title: "Asked/Checked: Cannot Drink/Breastfeed", scoreValue: calcStat('skill_ds_drink') },
            { title: "Asked/Checked: Vomits Everything", scoreValue: calcStat('skill_ds_vomit') },
            { title: "Asked/Checked: Convulsions", scoreValue: calcStat('skill_ds_convulsion') },
            { title: "Checked: Lethargic/Unconscious", scoreValue: calcStat('skill_ds_conscious') } 
        ];
        
        const measurementKpiGridList = [{ title: "Weight Measured Correctly", scoreValue: overallKpis.avgHandsOnWeight }, { title: "Temp Measured Correctly", scoreValue: overallKpis.avgHandsOnTemp }, { title: "Height Measured Correctly", scoreValue: overallKpis.avgHandsOnHeight }];
        const malnutritionSignsKpiList = [{ title: "MUAC Measured Correctly", scoreValue: overallKpis.avgHandsOnMUAC }, { title: "Z-Score (WFH) Measured Correctly", scoreValue: overallKpis.avgHandsOnWFH }];
        const recordingKpiGridList = [{ title: "Registering Signs", scoreValue: overallKpis.avgRecordSigns }, { title: "Registering Classifications", scoreValue: overallKpis.avgRecordClass }, { title: "Registering Treatments", scoreValue: overallKpis.avgRecordTreat }];

        return (
            <div className="animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <KpiCard title="Total Completed Visits" value={overallKpis.totalVisits} />
                    <KpiCard title="Total Health Workers Visited" value={overallKpis.totalHealthWorkers} />
                    <KpiCard title="Total Cases Observed" value={overallKpis.totalCasesObserved} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title="Overall IMNCI Adherence" kpis={overallImnciKpiList} chartData={chartData} kpiKeys={[{ key: 'Overall', title: 'Overall Adherence' }]} cols={1} />
                    <KpiCardWithChart title="Core Components Adherence" kpis={mainKpiGridList} chartData={chartData} kpiKeys={[{ key: 'Assessment', title: 'Assessment' }, { key: 'Decision', title: 'Decision' }, { key: 'Treatment', title: 'Treatment' }]} cols={3} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title="Danger Signs Assessment" overallScore={overallKpis.avgDangerSigns} kpis={dangerSignsKpiList} />
                    <KpiLineChart title="Adherence Over Time (Danger Signs)" chartData={chartData} kpiKeys={[{ key: 'DangerSigns', title: 'Danger Signs Score' }]} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title="Measurement Skills (Average)" overallScore={calculateAverage([overallKpis.avgHandsOnWeight, overallKpis.avgHandsOnTemp, overallKpis.avgHandsOnHeight])} kpis={measurementKpiGridList} />
                    <KpiLineChart title="Adherence Over Time (Measurement Skills)" chartData={chartData} kpiKeys={[{ key: 'Measurement Skills', title: 'Measurement Skills Average' }]} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title="Correct Respiratory Rate Measurement" kpis={[{ title: " ", scoreValue: overallKpis.avgRespiratoryRateCalculation }]} chartData={chartData} kpiKeys={[{ key: 'Resp. Rate', title: 'Resp. Rate' }]} cols={1} />
                    <KpiCardWithChart title="Correct Dehydration assessment" kpis={[{ title: " ", scoreValue: overallKpis.avgDehydrationAssessment }]} chartData={chartData} kpiKeys={[{ key: 'Dehydration', title: 'Dehydration' }]} cols={1} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title="Correct Malnutrition Assessment" overallScore={calculateAverage([overallKpis.avgHandsOnMUAC, overallKpis.avgHandsOnWFH])} kpis={malnutritionSignsKpiList} />
                    <KpiLineChart title="Adherence Over Time (Malnutrition Signs)" chartData={chartData} kpiKeys={[{ key: 'Malnutrition Assessment', title: 'Malnutrition Assessment' }]} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title="Percentage of cases assessed for Immunization correctly" kpis={[{ title: " ", scoreValue: overallKpis.avgImmunization }]} chartData={chartData} kpiKeys={[{ key: 'Immunization', title: 'Immunization' }]} cols={1} />
                    <KpiCardWithChart title="Percentage of cases assessed for vitamin supplementation correctly" kpis={[{ title: " ", scoreValue: overallKpis.avgVitaminAssessment }]} chartData={chartData} kpiKeys={[{ key: 'Vitamin Assessment', title: 'Vitamin Assessment' }]} cols={1} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title="Percentage of Pneumonia cases Treated correctly with Amoxicillin" kpis={[{ title: " ", scoreValue: overallKpis.avgPneuAmox }]} chartData={chartData} kpiKeys={[{ key: 'Pneumonia Amox', title: 'Amoxicillin' }]} cols={1} />
                    <KpiCardWithChart title="Percentage of Diarrhea cases Treated with ORS" kpis={[{ title: " ", scoreValue: overallKpis.avgDiarOrs }]} chartData={chartData} kpiKeys={[{ key: 'Diarrhea ORS', title: 'ORS' }]} cols={1} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title="Percentage of Diarrhea cases Treated with Zinc" kpis={[{ title: " ", scoreValue: overallKpis.avgDiarZinc }]} chartData={chartData} kpiKeys={[{ key: 'Diarrhea Zinc', title: 'Zinc' }]} cols={1} />
                    <KpiCardWithChart title="Percentage of malaria cases treated with Coartum" kpis={[{ title: " ", scoreValue: overallKpis.avgMalariaCoartem }]} chartData={chartData} kpiKeys={[{ key: 'Malaria Coartem', title: 'Coartem (ACT)' }]} cols={1} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <KpiCardWithChart title="Percentage of cases advised when to return immediately" kpis={[{ title: " ", scoreValue: overallKpis.avgReturnImm }]} chartData={chartData} kpiKeys={[{ key: 'Return Immediately', title: 'Return Immediately' }]} cols={1} />
                    <KpiCardWithChart title="Percentage of cases advised to return for follow up" kpis={[{ title: " ", scoreValue: overallKpis.avgReturnFu }]} chartData={chartData} kpiKeys={[{ key: 'Return Followup', title: 'Return Followup' }]} cols={1} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title="Recording Form Use" overallScore={calculateAverage([overallKpis.avgRecordSigns, overallKpis.avgRecordClass, overallKpis.avgRecordTreat])} kpis={recordingKpiGridList} />
                    <KpiLineChart title="Recording Form Use Over Time" chartData={chartData} kpiKeys={[{ key: 'Record Signs', title: 'Signs' }, { key: 'Record Classifications', title: 'Classifications' }, { key: 'Record Treatments', title: 'Treatments' }]} />
                </div>

                <SummaryKpiTable title={`KPI Summary by Job Description ${scopeTitle}`} kpiDefinitions={imnciSummaryDefs} overallKpis={overallKpis} kpisByWorkerType={kpisByWorkerType} />
                <h3 className="text-xl font-extrabold text-slate-800 mb-5 mt-10 text-left tracking-wide">Overall Adherence by {geographicLevelName} {scopeTitle}</h3>
                <div className="mb-10"><KpiBarChart title={`Overall IMNCI Adherence by ${geographicLevelName}`} chartData={geographicKpis} /></div>
                
                <h3 className="text-xl font-extrabold text-slate-800 mb-5 text-left tracking-wide">Detailed Skill Performance {scopeTitle}</h3>
                <div className="mb-10"><CompactSkillsTable overallKpis={overallKpis} /></div>
            </div>
        );
    }

    // EENC
    const eencMainKpiGridList = [{ title: "Overall EENC Adherence", scoreValue: overallKpis.avgOverall }, { title: "Preparation Score", scoreValue: overallKpis.avgPreparation }, { title: "Drying & Stimulation Score", scoreValue: overallKpis.avgDrying }, { title: "Breathing Baby Mgmt Score", scoreValue: overallKpis.avgNormalBreathing }, { title: "Resuscitation Score", scoreValue: overallKpis.avgResuscitation }];
    const eencInfectionKpis = [{ title: "Hand Washing (1st)", scoreValue: overallKpis.avgInfWash1 }, { title: "Hand Washing (2nd)", scoreValue: overallKpis.avgInfWash2 }, { title: "Sterile Gloves Used", scoreValue: overallKpis.avgInfGloves }];
    const eencPrepKpis = [{ title: "Towels Prepared", scoreValue: overallKpis.avgPrepTowel }, { title: "Resus Equipment Ready", scoreValue: overallKpis.avgPrepEquip }, { title: "Ambu Bag Checked", scoreValue: overallKpis.avgPrepAmbu }];
    const eencCareKpis = [{ title: "Drying within 5 sec", scoreValue: overallKpis.avgCareDry }, { title: "Immediate Skin-to-Skin", scoreValue: overallKpis.avgCareSkin }, { title: "Dry Towel & Hat Used", scoreValue: overallKpis.avgCareCover }];
    const eencCordKpis = [{ title: "Hygienic Cord Check", scoreValue: overallKpis.avgCordHygiene }, { title: "Delayed Clamping", scoreValue: overallKpis.avgCordDelay }, { title: "Correct Clamping", scoreValue: overallKpis.avgCordClamp }];
    const eencBreastfeedingKpis = [{ title: "Early Breastfeeding Advice", scoreValue: overallKpis.avgBfAdvice }];
    const eencResusExecKpis = [{ title: "Head Positioning", scoreValue: overallKpis.avgResusHead }, { title: "Good Mask Seal", scoreValue: overallKpis.avgResusMask }, { title: "Chest Rise (1st min)", scoreValue: overallKpis.avgResusChest }, { title: "Adequate Rate (30-50)", scoreValue: overallKpis.avgResusRate }];

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KpiCard title="Total Completed EENC Visits" value={overallKpis.totalVisits} />
                <KpiCard title="Total Health Workers Visited" value={overallKpis.totalHealthWorkers} />
                <KpiCard title="Total Cases Observed" value={overallKpis.totalCasesObserved} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <KpiGridCard title="Overall EENC Adherence Scores (Average)" kpis={eencMainKpiGridList} cols={3} />
                <KpiLineChart title="EENC Adherence Over Time (Main KPIs)" chartData={chartData} kpiKeys={[{ key: 'Overall', title: 'Overall' }, { key: 'Preparation', title: 'Preparation' }, { key: 'Drying', title: 'Drying' }, { key: 'Breathing Mgmt', title: 'Breathing Mgmt' }]} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 1: Infection Control (All Cases)" overallScore={calculateAverage([overallKpis.avgInfWash1, overallKpis.avgInfWash2, overallKpis.avgInfGloves])} kpis={eencInfectionKpis} /><KpiLineChart title="KPI 1 Over Time: Infection Control" chartData={chartData} kpiKeys={[{ key: 'Hand Washing (1st)', title: 'Hand Wash 1' }, { key: 'Hand Washing (2nd)', title: 'Hand Wash 2' }, { key: 'Sterile Gloves', title: 'Gloves' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 2: Resuscitation Preparedness (All Cases)" overallScore={overallKpis.avgPreparation} kpis={eencPrepKpis} /><KpiLineChart title="KPI 2 Over Time: Preparedness" chartData={chartData} kpiKeys={[{ key: 'Towels Ready', title: 'Towels' }, { key: 'Resus Equip Ready', title: 'Equip Ready' }, { key: 'Ambu Check', title: 'Ambu Check' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 3: Early Care (All Cases)" overallScore={overallKpis.avgDrying} kpis={eencCareKpis} /><KpiLineChart title="KPI 3 Over Time: Early Care" chartData={chartData} kpiKeys={[{ key: 'Drying < 5s', title: 'Drying < 5s' }, { key: 'Skin-to-Skin', title: 'Skin-to-Skin' }, { key: 'Dry Towel/Hat', title: 'Towel/Hat' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 4: Cord Management (Breathing Babies)" overallScore={calculateAverage([overallKpis.avgCordHygiene, overallKpis.avgCordDelay, overallKpis.avgCordClamp])} kpis={eencCordKpis} /><KpiLineChart title="KPI 4 Over Time: Cord Mgmt" chartData={chartData} kpiKeys={[{ key: 'Hygienic Check', title: 'Hygienic Check' }, { key: 'Delayed Clamp', title: 'Delayed Clamp' }, { key: 'Correct Clamp', title: 'Correct Clamp' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 5: Breastfeeding (Breathing Babies)" overallScore={overallKpis.avgBfAdvice} kpis={eencBreastfeedingKpis} /><KpiLineChart title="KPI 5 Over Time: Breastfeeding" chartData={chartData} kpiKeys={[{ key: 'Early BF Advice', title: 'BF Advice' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="KPI 6: Resuscitation Execution (Non-Breathing)" overallScore={overallKpis.avgResuscitation} kpis={eencResusExecKpis} /><KpiLineChart title="KPI 6 Over Time: Resuscitation" chartData={chartData} kpiKeys={[{ key: 'Head Pos', title: 'Head Pos' }, { key: 'Mask Seal', title: 'Mask Seal' }, { key: 'Chest Rise', title: 'Chest Rise' }, { key: 'Rate 30-50', title: 'Rate' }]} /></div>
            
            <SummaryKpiTable title={`KPI Summary by Job Description ${scopeTitle}`} kpiDefinitions={eencSummaryDefs} overallKpis={overallKpis} kpisByWorkerType={kpisByWorkerType} />

            <h3 className="text-xl font-bold text-slate-800 mb-5 mt-10 text-left tracking-wide">Overall EENC Adherence by {geographicLevelName} {scopeTitle}</h3>
            <div className="mb-10"><KpiBarChart title={`Overall EENC Adherence by ${geographicLevelName}`} chartData={geographicKpis} /></div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-5 text-left tracking-wide">Detailed EENC Skill Performance {scopeTitle}</h3>
            <div className="mb-10"><EENCCompactSkillsTable overallKpis={overallKpis} /></div>
        </div>
    );
};

export default ProviderSkillsTab;