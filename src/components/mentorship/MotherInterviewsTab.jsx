// MotherInterviewsTab.jsx
import React from 'react';
import { useTranslation } from './LanguageContext'; // <-- ADDED TRANSLATION HOOK
import { 
    KpiCard, 
    DetailedKpiCard, 
    KpiLineChart, 
    KpiBarChart, 
    MothersCompactSkillsTable 
} from './MentorshipDashboardShared';

const calculateAverage = (arr) => {
    if (!arr || arr.length === 0) return null;
    const valid = arr.filter(n => n !== null && !isNaN(n));
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
};

const MotherInterviewsTab = ({
    activeService, motherKpis, chartData, motherGeographicKpis, scopeTitle, geographicLevelName
}) => {
    
    const { t } = useTranslation(); // <-- INITIALIZED TRANSLATION

    if (activeService === 'IMNCI') {
        const imnciMotherKnowMedKpis = [{ title: t("Knows Med Details"), scoreValue: motherKpis?.avgKnowMed }, { title: t("Knows Treatment Details"), scoreValue: motherKpis?.avgKnowTx }, { title: t("Knows Return Date"), scoreValue: motherKpis?.avgKnowReturn }];
        const imnciMotherKnowOrsKpis = [{ title: t("Knows ORS Prep"), scoreValue: motherKpis?.avgKnowOrsPrep }, { title: t("Knows Home Fluids"), scoreValue: motherKpis?.avgKnowFluids }, { title: t("Knows 4 Rules"), scoreValue: motherKpis?.avgKnow4Rules }];
        const imnciMotherSatKpis = [{ title: t("Satisfaction: Time Spent"), scoreValue: motherKpis?.avgSatTime }, { title: t("Satisfaction: Communication"), scoreValue: motherKpis?.avgSatComm }, { title: t("Satisfaction: Learned Something"), scoreValue: motherKpis?.avgSatLearn }];

        return (
            <div className="animate-fade-in">
                <div className="grid grid-cols-1 gap-6 mb-8"><KpiCard title={t("Total Mother Interviews")} value={motherKpis?.totalMothers || 0} /></div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title={t("Mother Knowledge: Treatment")} overallScore={calculateAverage([motherKpis?.avgKnowMed, motherKpis?.avgKnowTx])} kpis={imnciMotherKnowMedKpis} />
                    <KpiLineChart title={t("Knowledge (Meds) Over Time")} chartData={chartData} kpiKeys={[{ key: 'M: Knows Meds', title: 'Meds' }, { key: 'M: Knows Tx', title: 'Tx' }, { key: 'M: Knows Return', title: 'Return' }]} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title={t("Mother Knowledge: ORS & Fluids")} overallScore={calculateAverage([motherKpis?.avgKnowOrsPrep, motherKpis?.avgKnowFluids])} kpis={imnciMotherKnowOrsKpis} />
                    <KpiLineChart title={t("Knowledge (ORS) Over Time")} chartData={chartData} kpiKeys={[{ key: 'M: Knows ORS', title: 'ORS' }, { key: 'M: Knows Fluids', title: 'Fluids' }, { key: 'M: Knows 4 Rules', title: 'Rules' }]} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title={t("Mother Satisfaction")} overallScore={calculateAverage([motherKpis?.avgSatTime, motherKpis?.avgSatComm])} kpis={imnciMotherSatKpis} />
                    <KpiLineChart title={t("Satisfaction Over Time")} chartData={chartData} kpiKeys={[{ key: 'M: Time Spent', title: 'Time' }, { key: 'M: Comm Style', title: 'Comm' }, { key: 'M: What Learned', title: 'Learned' }]} />
                </div>

                <h3 className="text-xl font-extrabold text-slate-800 mb-5 mt-10 text-left tracking-wide">{t('Overall Mother Interview Scores by')} {t(geographicLevelName)} {scopeTitle}</h3>
                <div className="mb-10"><KpiBarChart title={`${t('Average Mother Knowledge/Satisfaction by')} ${t(geographicLevelName)}`} chartData={motherGeographicKpis} /></div>
                
                <h3 className="text-xl font-extrabold text-slate-800 mb-5 text-left tracking-wide">{t('Detailed Mother Interview Performance')} {scopeTitle}</h3>
                <div className="mb-10"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="IMNCI" /></div>
            </div>
        );
    }

    const eencMotherSkinKpis = [{ title: t("Immediate Skin-to-Skin"), scoreValue: motherKpis?.avgSkinImm }, { title: t("Uninterrupted 90min S2S"), scoreValue: motherKpis?.avgSkin90min }];
    const eencMotherBfKpis = [{ title: t("Feeding in 1st Hour"), scoreValue: motherKpis?.avgBf1hr }, { title: t("Given Substitutes (Yes)"), scoreValue: motherKpis?.avgBfSub }, { title: t("Feeding with Bottle (Yes)"), scoreValue: motherKpis?.avgBfBottle }];
    const eencMotherCareKpis = [{ title: t("Vitamin K Given"), scoreValue: motherKpis?.avgVitK }, { title: t("Eye Ointment Given"), scoreValue: motherKpis?.avgEyeOint }, { title: t("Cord Substance Applied"), scoreValue: motherKpis?.avgCordSubs }];
    const eencMotherHygieneKpis = [{ title: t("Skin Oiling (Yes)"), scoreValue: motherKpis?.avgSkinOil }, { title: t("Bathing < 6hrs (Yes)"), scoreValue: motherKpis?.avgBath6hr }];
    const eencMotherVacKpis = [{ title: t("Polio Vaccine (Zero)"), scoreValue: motherKpis?.avgPolio }, { title: t("BCG Vaccine"), scoreValue: motherKpis?.avgBcg }];
    const eencMotherMeasureKpis = [{ title: t("Weight Measured"), scoreValue: motherKpis?.avgWeight }, { title: t("Temp Measured"), scoreValue: motherKpis?.avgTemp }];
    const eencMotherRegKpis = [{ title: t("Civil Registration"), scoreValue: motherKpis?.avgCivReg }, { title: t("Discharge Card Given"), scoreValue: motherKpis?.avgDisCard }];

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 gap-6 mb-8"><KpiCard title={t("Total Mother Interviews")} value={motherKpis?.totalMothers || 0} /></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("Mother Interview: Skin-to-Skin Care")} overallScore={calculateAverage([motherKpis?.avgSkinImm, motherKpis?.avgSkin90min])} kpis={eencMotherSkinKpis} /><KpiLineChart title={t("Skin-to-Skin Over Time")} chartData={chartData} kpiKeys={[{ key: 'Imm. Skin-to-Skin', title: 'Imm. S2S' }, { key: '90min Skin-to-Skin', title: '90min S2S' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("Mother Interview: Breastfeeding")} overallScore={calculateAverage([motherKpis?.avgBf1hr])} kpis={eencMotherBfKpis} /><KpiLineChart title={t("Breastfeeding Over Time")} chartData={chartData} kpiKeys={[{ key: 'BF 1st Hour', title: '1st Hr' }, { key: 'Other Fluids', title: 'Subs' }, { key: 'Bottle Feeding', title: 'Bottle' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("Mother Interview: Skin & Cord Care")} overallScore={calculateAverage([motherKpis?.avgVitK, motherKpis?.avgEyeOint, motherKpis?.avgCordSubs])} kpis={eencMotherCareKpis} /><KpiLineChart title={t("Care Indicators Over Time")} chartData={chartData} kpiKeys={[{ key: 'Vitamin K', title: 'Vit K' }, { key: 'Eye Ointment', title: 'Eye' }, { key: 'Cord Substance', title: 'Cord Sub' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("Mother Interview: Oiling & Bathing")} overallScore={calculateAverage([motherKpis?.avgSkinOil, motherKpis?.avgBath6hr])} kpis={eencMotherHygieneKpis} /><KpiLineChart title={t("Hygiene Indicators Over Time")} chartData={chartData} kpiKeys={[{ key: 'Skin Oiling', title: 'Oiling' }, { key: 'Bathing < 6hrs', title: 'Bath <6h' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("Mother Interview: Vaccination")} overallScore={calculateAverage([motherKpis?.avgPolio, motherKpis?.avgBcg])} kpis={eencMotherVacKpis} /><KpiLineChart title={t("Vaccination Over Time")} chartData={chartData} kpiKeys={[{ key: 'Polio Vaccine', title: 'Polio' }, { key: 'BCG Vaccine', title: 'BCG' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("Mother Interview: Measurements")} overallScore={calculateAverage([motherKpis?.avgWeight, motherKpis?.avgTemp])} kpis={eencMotherMeasureKpis} /><KpiLineChart title={t("Measurements Over Time")} chartData={chartData} kpiKeys={[{ key: 'Weight Measured', title: 'Weight' }, { key: 'Temp Measured', title: 'Temp' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title={t("Mother Interview: Registration")} overallScore={calculateAverage([motherKpis?.avgCivReg, motherKpis?.avgDisCard])} kpis={eencMotherRegKpis} /><KpiLineChart title={t("Registration Over Time")} chartData={chartData} kpiKeys={[{ key: 'Civil Reg', title: 'Civil Reg' }, { key: 'Discharge Card', title: 'Card' }]} /></div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-5 mt-10 text-left tracking-wide">{t('Overall Mother Interview Indicators by')} {t(geographicLevelName)} {scopeTitle}</h3>
            <div className="mb-10"><KpiBarChart title={`${t('Average Indicator Presence by')} ${t(geographicLevelName)}`} chartData={motherGeographicKpis} /></div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-5 text-left tracking-wide">{t('Detailed Mother Interview Performance')} {scopeTitle}</h3>
            <div className="mb-10"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="EENC" /></div>
        </div>
    );
};

export default MotherInterviewsTab;