// MotherInterviewsTab.jsx
import React from 'react';
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

    if (activeService === 'IMNCI') {
        const imnciMotherKnowMedKpis = [{ title: "Knows Med Details", scoreValue: motherKpis?.avgKnowMed }, { title: "Knows Treatment Details", scoreValue: motherKpis?.avgKnowTx }, { title: "Knows Return Date", scoreValue: motherKpis?.avgKnowReturn }];
        const imnciMotherKnowOrsKpis = [{ title: "Knows ORS Prep", scoreValue: motherKpis?.avgKnowOrsPrep }, { title: "Knows Home Fluids", scoreValue: motherKpis?.avgKnowFluids }, { title: "Knows 4 Rules", scoreValue: motherKpis?.avgKnow4Rules }];
        const imnciMotherSatKpis = [{ title: "Satisfaction: Time Spent", scoreValue: motherKpis?.avgSatTime }, { title: "Satisfaction: Communication", scoreValue: motherKpis?.avgSatComm }, { title: "Satisfaction: Learned Something", scoreValue: motherKpis?.avgSatLearn }];

        return (
            <div className="animate-fade-in">
                <div className="grid grid-cols-1 gap-6 mb-8"><KpiCard title="Total Mother Interviews" value={motherKpis?.totalMothers || 0} /></div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title="Mother Knowledge: Treatment" overallScore={calculateAverage([motherKpis?.avgKnowMed, motherKpis?.avgKnowTx])} kpis={imnciMotherKnowMedKpis} />
                    <KpiLineChart title="Knowledge (Meds) Over Time" chartData={chartData} kpiKeys={[{ key: 'M: Knows Meds', title: 'Meds' }, { key: 'M: Knows Tx', title: 'Tx' }, { key: 'M: Knows Return', title: 'Return' }]} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title="Mother Knowledge: ORS & Fluids" overallScore={calculateAverage([motherKpis?.avgKnowOrsPrep, motherKpis?.avgKnowFluids])} kpis={imnciMotherKnowOrsKpis} />
                    <KpiLineChart title="Knowledge (ORS) Over Time" chartData={chartData} kpiKeys={[{ key: 'M: Knows ORS', title: 'ORS' }, { key: 'M: Knows Fluids', title: 'Fluids' }, { key: 'M: Knows 4 Rules', title: 'Rules' }]} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <DetailedKpiCard title="Mother Satisfaction" overallScore={calculateAverage([motherKpis?.avgSatTime, motherKpis?.avgSatComm])} kpis={imnciMotherSatKpis} />
                    <KpiLineChart title="Satisfaction Over Time" chartData={chartData} kpiKeys={[{ key: 'M: Time Spent', title: 'Time' }, { key: 'M: Comm Style', title: 'Comm' }, { key: 'M: What Learned', title: 'Learned' }]} />
                </div>

                <h3 className="text-xl font-extrabold text-slate-800 mb-5 mt-10 text-left tracking-wide">Overall Mother Interview Scores by {geographicLevelName} {scopeTitle}</h3>
                <div className="mb-10"><KpiBarChart title={`Average Mother Knowledge/Satisfaction by ${geographicLevelName}`} chartData={motherGeographicKpis} /></div>
                
                <h3 className="text-xl font-extrabold text-slate-800 mb-5 text-left tracking-wide">Detailed Mother Interview Performance {scopeTitle}</h3>
                <div className="mb-10"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="IMNCI" /></div>
            </div>
        );
    }

    const eencMotherSkinKpis = [{ title: "Immediate Skin-to-Skin", scoreValue: motherKpis?.avgSkinImm }, { title: "Uninterrupted 90min S2S", scoreValue: motherKpis?.avgSkin90min }];
    const eencMotherBfKpis = [{ title: "Feeding in 1st Hour", scoreValue: motherKpis?.avgBf1hr }, { title: "Given Substitutes (Yes)", scoreValue: motherKpis?.avgBfSub }, { title: "Feeding with Bottle (Yes)", scoreValue: motherKpis?.avgBfBottle }];
    const eencMotherCareKpis = [{ title: "Vitamin K Given", scoreValue: motherKpis?.avgVitK }, { title: "Eye Ointment Given", scoreValue: motherKpis?.avgEyeOint }, { title: "Cord Substance Applied", scoreValue: motherKpis?.avgCordSubs }];
    const eencMotherHygieneKpis = [{ title: "Skin Oiling (Yes)", scoreValue: motherKpis?.avgSkinOil }, { title: "Bathing < 6hrs (Yes)", scoreValue: motherKpis?.avgBath6hr }];
    const eencMotherVacKpis = [{ title: "Polio Vaccine (Zero)", scoreValue: motherKpis?.avgPolio }, { title: "BCG Vaccine", scoreValue: motherKpis?.avgBcg }];
    const eencMotherMeasureKpis = [{ title: "Weight Measured", scoreValue: motherKpis?.avgWeight }, { title: "Temp Measured", scoreValue: motherKpis?.avgTemp }];
    const eencMotherRegKpis = [{ title: "Civil Registration", scoreValue: motherKpis?.avgCivReg }, { title: "Discharge Card Given", scoreValue: motherKpis?.avgDisCard }];

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 gap-6 mb-8"><KpiCard title="Total Mother Interviews" value={motherKpis?.totalMothers || 0} /></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Skin-to-Skin Care" overallScore={calculateAverage([motherKpis?.avgSkinImm, motherKpis?.avgSkin90min])} kpis={eencMotherSkinKpis} /><KpiLineChart title="Skin-to-Skin Over Time" chartData={chartData} kpiKeys={[{ key: 'Imm. Skin-to-Skin', title: 'Imm. S2S' }, { key: '90min Skin-to-Skin', title: '90min S2S' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Breastfeeding" overallScore={calculateAverage([motherKpis?.avgBf1hr])} kpis={eencMotherBfKpis} /><KpiLineChart title="Breastfeeding Over Time" chartData={chartData} kpiKeys={[{ key: 'BF 1st Hour', title: '1st Hr' }, { key: 'Other Fluids', title: 'Subs' }, { key: 'Bottle Feeding', title: 'Bottle' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Skin & Cord Care" overallScore={calculateAverage([motherKpis?.avgVitK, motherKpis?.avgEyeOint, motherKpis?.avgCordSubs])} kpis={eencMotherCareKpis} /><KpiLineChart title="Care Indicators Over Time" chartData={chartData} kpiKeys={[{ key: 'Vitamin K', title: 'Vit K' }, { key: 'Eye Ointment', title: 'Eye' }, { key: 'Cord Substance', title: 'Cord Sub' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Oiling & Bathing" overallScore={calculateAverage([motherKpis?.avgSkinOil, motherKpis?.avgBath6hr])} kpis={eencMotherHygieneKpis} /><KpiLineChart title="Hygiene Indicators Over Time" chartData={chartData} kpiKeys={[{ key: 'Skin Oiling', title: 'Oiling' }, { key: 'Bathing < 6hrs', title: 'Bath <6h' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Vaccination" overallScore={calculateAverage([motherKpis?.avgPolio, motherKpis?.avgBcg])} kpis={eencMotherVacKpis} /><KpiLineChart title="Vaccination Over Time" chartData={chartData} kpiKeys={[{ key: 'Polio Vaccine', title: 'Polio' }, { key: 'BCG Vaccine', title: 'BCG' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Measurements" overallScore={calculateAverage([motherKpis?.avgWeight, motherKpis?.avgTemp])} kpis={eencMotherMeasureKpis} /><KpiLineChart title="Measurements Over Time" chartData={chartData} kpiKeys={[{ key: 'Weight Measured', title: 'Weight' }, { key: 'Temp Measured', title: 'Temp' }]} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"><DetailedKpiCard title="Mother Interview: Registration" overallScore={calculateAverage([motherKpis?.avgCivReg, motherKpis?.avgDisCard])} kpis={eencMotherRegKpis} /><KpiLineChart title="Registration Over Time" chartData={chartData} kpiKeys={[{ key: 'Civil Reg', title: 'Civil Reg' }, { key: 'Discharge Card', title: 'Card' }]} /></div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-5 mt-10 text-left tracking-wide">Overall Mother Interview Indicators by {geographicLevelName} {scopeTitle}</h3>
            <div className="mb-10"><KpiBarChart title={`Average Indicator Presence by ${geographicLevelName}`} chartData={motherGeographicKpis} /></div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-5 text-left tracking-wide">Detailed Mother Interview Performance {scopeTitle}</h3>
            <div className="mb-10"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="EENC" /></div>
        </div>
    );
};

export default MotherInterviewsTab;