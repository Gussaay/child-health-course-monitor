// MotherInterviewsTab.jsx
import React, { useMemo } from 'react';
import { useTranslation } from './LanguageContext'; 
import { 
    KpiCard, 
    KpiLineChart, 
    KpiBarChart, 
    MothersCompactSkillsTable 
} from './MentorshipDashboardShared';

const MotherInterviewsTab = ({
    activeService, motherKpis, chartData, motherGeographicKpis, scopeTitle, geographicLevelName,
    filteredSubmissions 
}) => {
    const { t, language } = useTranslation();
    const isAr = language === 'ar';

    // Calculate Total Facilities specific to Mother Interviews
    const targetMotherService = activeService === 'IMNCI' ? 'IMNCI_MOTHERS' : 'EENC_MOTHERS';
    const motherSubmissions = (filteredSubmissions || []).filter(sub => sub.service === targetMotherService);
    const totalFacilities = new Set(motherSubmissions.map(s => s.facilityId).filter(Boolean)).size;

    // Helper to get overall 'yes' and 'total' counts from motherKpis for simple YES/NO questions
    const getStats = (key) => {
        const stats = motherKpis?.skillStats?.[key] || { yes: 0, no: 0 };
        return { yes: stats.yes || 0, total: (stats.yes || 0) + (stats.no || 0) };
    };

    // Helper to calculate specific visit iteration counts for simple YES/NO questions
    const getVisitStats = (key, visitNum) => {
        if (!filteredSubmissions || filteredSubmissions.length === 0) return { yes: undefined, total: undefined };
        
        const targetSubs = filteredSubmissions.filter(sub => {
            const matchesService = sub.service === targetMotherService;
            const parsedV = parseInt(sub.visitNumber || sub.fullData?.visitNumber);
            const actualVNum = isNaN(parsedV) ? 1 : parsedV;
            return matchesService && actualVNum === visitNum;
        });

        if (targetSubs.length === 0) return { yes: undefined, total: undefined };

        let yes = 0; let total = 0;
        targetSubs.forEach(sub => {
            if (activeService === 'IMNCI') {
                const k = sub.mothersKnowledge || sub.fullData?.mothersKnowledge || sub.fullData?.knowledge || {};
                const s = sub.mothersSatisfaction || sub.fullData?.mothersSatisfaction || sub.fullData?.satisfaction || {};
                const val = k[key] || s[key];
                
                if (val === 'نعم' || val === 'نعم ') { yes++; total++; }
                else if (val === 'لا' || val === 'لا ') { total++; }
            } else {
                const d = sub.eencMothersData || sub.fullData?.eencMothersData || sub.fullData?.skills || {};
                const val = d[key];
                if (val === 'yes' || val === 'نعم' || val === true) { yes++; total++; }
                else if (val === 'no' || val === 'لا' || val === false) { total++; }
            }
        });
        
        if (total === 0) return { yes: undefined, total: undefined };
        return { yes, total };
    };

    // Helper to calculate Composite Scores (Overall Knowledge & Satisfaction)
    const getCompositeStats = (scoreKey, maxScoreKey, visitNum = null) => {
        if (!filteredSubmissions || filteredSubmissions.length === 0) return { yes: undefined, total: undefined };
        
        const targetSubs = filteredSubmissions.filter(sub => {
            if (sub.service !== targetMotherService) return false;
            if (visitNum !== null) {
                const parsedV = parseInt(sub.visitNumber || sub.fullData?.visitNumber);
                const actualVNum = isNaN(parsedV) ? 1 : parsedV;
                return actualVNum === visitNum;
            }
            return true;
        });

        if (targetSubs.length === 0) return { yes: undefined, total: undefined };

        let yes = 0; let total = 0;
        targetSubs.forEach(sub => {
            const s = sub.scores || {};
            if (s[maxScoreKey] > 0) {
                yes += s[scoreKey] || 0;
                total += s[maxScoreKey] || 0;
            }
        });
        
        if (total === 0) return { yes: undefined, total: undefined };
        return { yes: Math.round(yes), total: Math.round(total) };
    };

    // Local Chart Data calculation fortified to include the new Overall Scores
    const localChartData = useMemo(() => {
        if (!filteredSubmissions || filteredSubmissions.length === 0) return [];
        
        const visitGroups = [...filteredSubmissions].sort((a, b) => {
            const vA = parseInt(a.visitNumber || a.fullData?.visitNumber); 
            const vB = parseInt(b.visitNumber || b.fullData?.visitNumber);
            return (isNaN(vA) ? 1 : vA) - (isNaN(vB) ? 1 : vB);
        }).reduce((acc, sub) => {
            const sService = sub.service;
            if (sService !== targetMotherService) return acc;

            const parsedV = parseInt(sub.visitNumber || sub.fullData?.visitNumber);
            const visitNum = isNaN(parsedV) ? 1 : parsedV; 
            
            if (!acc[visitNum]) {
                if (activeService === 'IMNCI') {
                    acc[visitNum] = { 'M: Knows Meds': [], 'M: Knows ORS': [], 'M: Knows Tx': [], 'M: Knows 4 Rules': [], 'M: Knows Return': [], 'M: Knows Fluids': [], 'M: ORS Water': [], 'M: ORS Stool': [], 'M: Time Spent': [], 'M: Assess Method': [], 'M: Tx Given': [], 'M: Comm Style': [], 'M: What Learned': [], 'M: Drug Avail': [], 'M: Overall Knowledge': [], 'M: Overall Satisfaction': [] };
                } else {
                    acc[visitNum] = { 'Imm. Skin-to-Skin': [], '90min Skin-to-Skin': [], 'BF 1st Hour': [], 'Other Fluids': [], 'Bottle Feeding': [], 'Vitamin K': [], 'Eye Ointment': [], 'Cord Substance': [], 'Skin Oiling': [], 'Bathing < 6hrs': [], 'Polio Vaccine': [], 'BCG Vaccine': [], 'Weight Measured': [], 'Temp Measured': [], 'Civil Reg': [], 'Discharge Card': [], 'M: Overall Score': [] };
                }
            }
            const g = acc[visitNum]; 
            
            if (activeService === 'IMNCI') {
                const k = sub.mothersKnowledge || sub.fullData?.mothersKnowledge || sub.fullData?.knowledge || {}; 
                const s = sub.mothersSatisfaction || sub.fullData?.mothersSatisfaction || sub.fullData?.satisfaction || {};
                const sc = sub.scores || {};
                
                const pushIMNCI = (val, label) => {
                    if (val === 'نعم' || val === 'نعم ') g[label].push(100);
                    else if (val === 'لا' || val === 'لا ') g[label].push(0);
                };
                
                pushIMNCI(k.knows_med_details, 'M: Knows Meds'); 
                pushIMNCI(k.knows_ors_prep, 'M: Knows ORS'); 
                pushIMNCI(k.knows_treatment_details, 'M: Knows Tx'); 
                pushIMNCI(k.knows_diarrhea_4rules, 'M: Knows 4 Rules'); 
                pushIMNCI(k.knows_return_date, 'M: Knows Return'); 
                pushIMNCI(k.knows_home_fluids, 'M: Knows Fluids');
                pushIMNCI(k.knows_ors_water_qty, 'M: ORS Water'); 
                pushIMNCI(k.knows_ors_after_stool, 'M: ORS Stool'); 
                
                pushIMNCI(s.time_spent, 'M: Time Spent'); 
                pushIMNCI(s.assessment_method, 'M: Assess Method'); 
                pushIMNCI(s.treatment_given, 'M: Tx Given'); 
                pushIMNCI(s.communication_style, 'M: Comm Style'); 
                pushIMNCI(s.what_learned, 'M: What Learned'); 
                pushIMNCI(s.drug_availability, 'M: Drug Avail');

                if (sc.knowledge_maxScore > 0) g['M: Overall Knowledge'].push((sc.knowledge_score / sc.knowledge_maxScore) * 100);
                if (sc.satisfaction_maxScore > 0) g['M: Overall Satisfaction'].push((sc.satisfaction_score / sc.satisfaction_maxScore) * 100);

            } else {
                const d = sub.eencMothersData || sub.fullData?.eencMothersData || sub.fullData?.skills || {};
                const sc = sub.scores || {};
                const pushEENC = (val, label) => {
                    if (val === 'yes' || val === 'نعم' || val === true) g[label].push(100);
                    else if (val === 'no' || val === 'لا' || val === false) g[label].push(0);
                };
                
                pushEENC(d.skin_to_skin_immediate, 'Imm. Skin-to-Skin'); pushEENC(d.skin_to_skin_90min, '90min Skin-to-Skin'); 
                pushEENC(d.breastfed_first_hour, 'BF 1st Hour'); pushEENC(d.given_other_fluids, 'Other Fluids'); pushEENC(d.given_other_fluids_bottle, 'Bottle Feeding');
                pushEENC(d.given_vitamin_k, 'Vitamin K'); pushEENC(d.given_tetracycline, 'Eye Ointment'); pushEENC(d.anything_on_cord, 'Cord Substance'); 
                pushEENC(d.rubbed_with_oil, 'Skin Oiling'); pushEENC(d.baby_bathed, 'Bathing < 6hrs');
                pushEENC(d.polio_zero_dose, 'Polio Vaccine'); pushEENC(d.bcg_dose, 'BCG Vaccine'); 
                pushEENC(d.baby_weighed, 'Weight Measured'); pushEENC(d.baby_temp_measured, 'Temp Measured'); 
                pushEENC(d.baby_registered, 'Civil Reg'); pushEENC(d.given_discharge_card, 'Discharge Card');

                if (sc.overall_maxScore > 0) g['M: Overall Score'].push((sc.overall_score / sc.overall_maxScore) * 100);
            }
            
            return acc;
        }, {});
        
        return Object.keys(visitGroups).map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] })).sort((a,b) => a.visitNumber - b.visitNumber).map(({visitNumber, data}) => {
            const avg = (scoreArray) => { const v = scoreArray.filter(s => s !== null && !isNaN(s) && s !== undefined); return v.length === 0 ? null : Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
            const res = { name: `Visit ${visitNumber}` }; 
            Object.keys(data).forEach(k => res[k] = avg(data[k])); 
            return res;
        }).slice(0, 4);
    }, [filteredSubmissions, activeService, targetMotherService]);

    const renderKpiGrid = (items) => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {items.map(item => {
                let v1Stats, v4Stats, totalStats;

                if (item.isComposite) {
                    v1Stats = getCompositeStats(item.scoreKey, item.maxKey, 1);
                    v4Stats = getCompositeStats(item.scoreKey, item.maxKey, 4);
                    totalStats = getCompositeStats(item.scoreKey, item.maxKey, null);
                } else {
                    v1Stats = getVisitStats(item.key, 1);
                    v4Stats = getVisitStats(item.key, 4);
                    totalStats = getStats(item.key);
                }
                
                const v1Val = v1Stats.total > 0 ? (v1Stats.yes / v1Stats.total) * 100 : null;
                const v4Val = v4Stats.total > 0 ? (v4Stats.yes / v4Stats.total) * 100 : null;

                return (
                    <KpiLineChart 
                        key={item.key || item.chartKey}
                        title={t(item.title)} 
                        chartData={chartData} 
                        kpiKeys={[{ key: item.chartKey, title: item.title, rawKeys: item.key ? [item.key] : [] }]} 
                        overallScore={item.avg} 
                        totalNumerator={totalStats.yes} 
                        totalDenominator={totalStats.total} 
                        v1Value={v1Val}
                        v1Numerator={v1Stats.yes} 
                        v1Denominator={v1Stats.total} 
                        v4Value={v4Val}
                        v4Numerator={v4Stats.yes} 
                        v4Denominator={v4Stats.total} 
                        filteredSubmissions={filteredSubmissions} 
                    />
                );
            })}
        </div>
    );

    if (activeService === 'IMNCI') {
        const imnciOverallSections = [
            {
                title: "Overall Scores",
                items: [
                    { title: "Overall Knowledge Score", chartKey: 'M: Overall Knowledge', avg: motherKpis?.avgKnowledge, isComposite: true, scoreKey: 'knowledge_score', maxKey: 'knowledge_maxScore' },
                    { title: "Overall Satisfaction Score", chartKey: 'M: Overall Satisfaction', avg: motherKpis?.avgSatisfaction, isComposite: true, scoreKey: 'satisfaction_score', maxKey: 'satisfaction_maxScore' }
                ]
            }
        ];

        const imnciSections = [
            {
                title: "Mother Knowledge: Treatment",
                items: [
                    { title: "The Mother Know About the dose , the frequency and duration of oral drugs prescribed", key: 'knows_med_details', chartKey: 'M: Knows Meds', avg: motherKpis?.avgKnowMed },
                    { title: "Knows 4 Rules of Home Tratment of Diarrhea", key: 'knows_diarrhea_4rules', chartKey: 'M: Knows 4 Rules', avg: motherKpis?.avgKnow4Rules }
                ]
            },
            {
                title: "Mother Knowledge: ORS & Fluids",
                items: [
                    { title: "Knows Home Fluids fluides for Diarheal managment", key: 'knows_home_fluids', chartKey: 'M: Knows Fluids', avg: motherKpis?.avgKnowFluids },
                    { title: "The Mother Know how to prepare ORS", key: 'knows_ors_water_qty', chartKey: 'M: ORS Water', avg: motherKpis?.avgKnowOrsQty },
                    { title: "Knows ORS Amount to be given after each Stool", key: 'knows_ors_after_stool', chartKey: 'M: ORS Stool', avg: motherKpis?.avgKnowOrsStool },
                    { title: "Knows Return for follow up", key: 'knows_return_date', chartKey: 'M: Knows Return', avg: motherKpis?.avgKnowReturn }
                ]
            },
            {
                title: "Mother Satisfaction",
                items: [
                    { title: "Satisfaction: Time Spent", key: 'time_spent', chartKey: 'M: Time Spent', avg: motherKpis?.avgSatTime },
                    { title: "Satisfaction: Assessment Method", key: 'assessment_method', chartKey: 'M: Assess Method', avg: motherKpis?.avgSatAssess },
                    { title: "Satisfaction: Treatment Given", key: 'treatment_given', chartKey: 'M: Tx Given', avg: motherKpis?.avgSatTx },
                    { title: "Satisfaction: Communication", key: 'communication_style', chartKey: 'M: Comm Style', avg: motherKpis?.avgSatComm },
                    { title: "Satisfaction: Learned Something", key: 'what_learned', chartKey: 'M: What Learned', avg: motherKpis?.avgSatLearn },
                    { title: "Satisfaction: Drug Availability", key: 'drug_availability', chartKey: 'M: Drug Avail', avg: motherKpis?.avgSatAvail }
                ]
            }
        ];

        return (
            <div className="animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <KpiCard title={t("Total Mother Interviews")} value={motherKpis?.totalMothers || 0} />
                    <KpiCard title={t("Total Facilities Visited")} value={totalFacilities} />
                </div>
                
                {[...imnciOverallSections, ...imnciSections].map((section, idx) => (
                    <div key={idx}>
                        <h3 className={`text-xl font-extrabold text-slate-800 mb-5 mt-8 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                            {t(section.title)}
                        </h3>
                        {renderKpiGrid(section.items)}
                    </div>
                ))}

                {/* UPDATED: Separate Bar Charts for Knowledge vs Satisfaction, enforcing correct layout string order for Arabic rendering layout structures */}
                <h3 className={`text-xl font-extrabold text-slate-800 mb-5 mt-10 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                    {t('Overall Mother Interview Scores by')} {t(geographicLevelName)} {scopeTitle}
                </h3>
                <div className="grid grid-cols-1 gap-8 mb-10">
                    <KpiBarChart title={`${t('Average Mother Knowledge by')} ${t(geographicLevelName)}`} chartData={motherGeographicKpis} dataKey="avgKnowledge" />
                    <KpiBarChart title={`${t('Average Mother Satisfaction by')} ${t(geographicLevelName)}`} chartData={motherGeographicKpis} dataKey="avgSatisfaction" />
                </div>
                
                <h3 className={`text-xl font-extrabold text-slate-800 mb-5 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                    {t('Detailed Mother Interview Performance')} {scopeTitle}
                </h3>
                <div className="mb-10"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="IMNCI" /></div>
            </div>
        );
    }

    const eencOverallSections = [
        {
            title: "Overall Score",
            items: [
                { title: "Overall Mother Interview Score", chartKey: 'M: Overall Score', avg: motherKpis?.avgOverallScore, isComposite: true, scoreKey: 'overall_score', maxKey: 'overall_maxScore' }
            ]
        }
    ];

    const eencSections = [
        {
            title: "Skin-to-Skin Care",
            items: [
                { title: "Immediate Skin-to-Skin", key: 'skin_to_skin_immediate', chartKey: 'Imm. Skin-to-Skin', avg: motherKpis?.avgSkinImm },
                { title: "Uninterrupted 90min S2S", key: 'skin_to_skin_90min', chartKey: '90min Skin-to-Skin', avg: motherKpis?.avgSkin90min }
            ]
        },
        {
            title: "Breastfeeding",
            items: [
                { title: "Feeding in 1st Hour", key: 'breastfed_first_hour', chartKey: 'BF 1st Hour', avg: motherKpis?.avgBf1hr },
                { title: "Given Substitutes (Yes)", key: 'given_other_fluids', chartKey: 'Other Fluids', avg: motherKpis?.avgBfSub },
                { title: "Feeding with Bottle (Yes)", key: 'given_other_fluids_bottle', chartKey: 'Bottle Feeding', avg: motherKpis?.avgBfBottle }
            ]
        },
        {
            title: "Skin & Cord Care",
            items: [
                { title: "Vitamin K Given", key: 'given_vitamin_k', chartKey: 'Vitamin K', avg: motherKpis?.avgVitK },
                { title: "Eye Ointment Given", key: 'given_tetracycline', chartKey: 'Eye Ointment', avg: motherKpis?.avgEyeOint },
                { title: "Cord Substance Applied", key: 'anything_on_cord', chartKey: 'Cord Substance', avg: motherKpis?.avgCordSubs },
                { title: "Skin Oiling (Yes)", key: 'rubbed_with_oil', chartKey: 'Skin Oiling', avg: motherKpis?.avgSkinOil },
                { title: "Bathing < 6hrs (Yes)", key: 'baby_bathed', chartKey: 'Bathing < 6hrs', avg: motherKpis?.avgBath6hr }
            ]
        },
        {
            title: "Vaccination",
            items: [
                { title: "Polio Vaccine (Zero)", key: 'polio_zero_dose', chartKey: 'Polio Vaccine', avg: motherKpis?.avgPolio },
                { title: "BCG Vaccine", key: 'bcg_dose', chartKey: 'BCG Vaccine', avg: motherKpis?.avgBcg }
            ]
        },
        {
            title: "Measurements",
            items: [
                { title: "Weight Measured", key: 'baby_weighed', chartKey: 'Weight Measured', avg: motherKpis?.avgWeight },
                { title: "Temp Measured", key: 'baby_temp_measured', chartKey: 'Temp Measured', avg: motherKpis?.avgTemp }
            ]
        },
        {
            title: "Registration",
            items: [
                { title: "Civil Registration", key: 'baby_registered', chartKey: 'Civil Reg', avg: motherKpis?.avgCivReg },
                { title: "Discharge Card Given", key: 'given_discharge_card', chartKey: 'Discharge Card', avg: motherKpis?.avgDisCard }
            ]
        }
    ];

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <KpiCard title={t("Total Mother Interviews")} value={motherKpis?.totalMothers || 0} />
                <KpiCard title={t("Total Facilities Visited")} value={totalFacilities} />
            </div>
            
            {[...eencOverallSections, ...eencSections].map((section, idx) => (
                <div key={idx}>
                    <h3 className={`text-xl font-extrabold text-slate-800 mb-5 mt-8 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                        {t(section.title)}
                    </h3>
                    {renderKpiGrid(section.items)}
                </div>
            ))}
            
            <h3 className={`text-xl font-bold text-slate-800 mb-5 mt-10 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                {t('Overall Mother Interview Indicators by')} {t(geographicLevelName)} {scopeTitle}
            </h3>
            <div className="mb-10"><KpiBarChart title={`${t('Average Indicator Presence by')} ${t(geographicLevelName)}`} chartData={motherGeographicKpis} dataKey="avgOverall" /></div>
            
            <h3 className={`text-xl font-bold text-slate-800 mb-5 tracking-wide ${isAr ? 'text-right' : 'text-left'}`}>
                {t('Detailed Mother Interview Performance')} {scopeTitle}
            </h3>
            <div className="mb-10"><MothersCompactSkillsTable motherKpis={motherKpis} serviceType="EENC" /></div>
        </div>
    );
};

export default MotherInterviewsTab;