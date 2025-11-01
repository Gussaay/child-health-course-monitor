// MentorshipDashboard.jsx
import React, { useMemo, useCallback } from 'react';
// --- NEW: Import Chart.js components ---
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
// --- END NEW ---

// --- NEW: Register Chart.js components ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);
// --- END NEW ---


// Copied from SkillsMentorshipView.jsx
const SERVICE_TITLES = {
    'IMNCI': 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)',
    'EENC': 'Early Essential Newborn Care (EENC)',
    'ETAT': 'Emergency Triage, Assessment and Treatment (ETAT)',
    'IPC': 'Infection Prevention and Control in Neonatal Units (IPC)'
};

// --- Dashboard Helper Components ---
const ScoreText = ({ value, showPercentage = true }) => {
    let colorClass = 'text-gray-700';
    let text = 'N/A';

    if (value !== null && !isNaN(value) && isFinite(value)) {
        const percentage = Math.round(value * 100);
        if (percentage >= 80) {
            colorClass = 'text-green-600';
        } else if (percentage >= 50) {
            colorClass = 'text-yellow-600';
        } else {
            colorClass = 'text-red-600';
        }
        text = showPercentage ? `${percentage}%` : percentage.toString();
    }

    return (
        <span className={`font-bold text-lg ${colorClass}`}>
            {text}
        </span>
    );
};

const KpiCard = ({ title, value, unit = '', scoreValue = null }) => {
    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 text-center">
            <h4 className="text-sm font-medium text-gray-500 mb-2 h-10 flex items-center justify-center" title={title}>
                {title}
            </h4>
            <div className="flex items-baseline justify-center gap-1">
                {scoreValue !== null ? (
                    <ScoreText value={scoreValue} />
                ) : (
                    <span className="text-3xl font-bold text-sky-800">{value}</span>
                )}
                {unit && <span className="text-lg font-medium text-gray-600">{unit}</span>}
            </div>
        </div>
    );
};

// --- KPI Grid Component ---
const KpiGridItem = ({ title, scoreValue }) => (
    <div className="bg-gray-50 p-3 rounded-lg border text-center shadow-inner">
        <h5 className="text-xs font-medium text-gray-500 mb-1 h-8 flex items-center justify-center" title={title}>
            {title}
        </h5>
        <ScoreText value={scoreValue} />
    </div>
);

const KpiGridCard = ({ title, kpis }) => (
    <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
        <h4 className="text-base font-bold text-sky-800 mb-3 text-center" title={title}>
            {title}
        </h4>
        <div className="grid grid-cols-2 gap-3">
            {kpis.map(kpi => (
                <KpiGridItem key={kpi.title} title={kpi.title} scoreValue={kpi.scoreValue} />
            ))}
        </div>
    </div>
);
// --- END KPI Grid Component ---


// --- KpiLineChart Component ---
const KpiLineChart = ({ title, chartData, kpiKeys }) => {
    
    const colors = {
        'Overall': '#0ea5e9', // sky
        'Assessment': '#10b981', // green
        'Decision': '#f59e0b', // yellow
        'Treatment': '#ef4444', // red
        'Cough': '#6366f1', // indigo
        'Pneumonia': '#a855f7', // purple
        'Diarrhea (Classify)': '#ec4899', // pink
        'Diarrhea (Mgmt)': '#f97316', // orange
    };

    const data = {
        labels: chartData.map(d => d.name),
        datasets: kpiKeys.map(kpi => ({
            label: kpi.title,
            data: chartData.map(d => d[kpi.key]),
            borderColor: colors[kpi.key] || '#6b7280',
            backgroundColor: (colors[kpi.key] || '#6b7280') + '33', // Add alpha
            fill: false,
            tension: 0.1,
            pointRadius: 1,
            borderWidth: 2,
        })),
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    fontSize: 10,
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    callback: (value) => `${value}%`, // Add percent sign
                },
            },
            x: {
                ticks: {
                    maxTicksLimit: 10, 
                    autoSkip: true,
                    maxRotation: 45, 
                    minRotation: 0,
                }
            }
        },
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
            <h4 className="text-base font-bold text-sky-800 mb-3 text-center">
                {title}
            </h4>
            <div className="relative h-[280px]">
                {chartData.length > 0 ? (
                    <Line options={options} data={data} />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        No data available for this period.
                    </div>
                )}
            </div>
        </div>
    );
};
// --- END KpiLineChart Component ---


// --- Filter Helper Component ---
const FilterSelect = ({ label, value, onChange, options, disabled = false, defaultOption }) => (
    <div>
        <label htmlFor={label} className="block text-sm font-medium text-gray-700">
            {label}
        </label>
        <select
            id={label}
            name={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"
        >
            <option value="">{defaultOption}</option>
            {options.map(option => (
                <option key={option.key || option} value={option.key || option}>
                    {option.name || option}
                </option>
            ))}
        </select>
    </div>
);


// --- Mentorship Dashboard Component ---
const MentorshipDashboard = ({ 
    allSubmissions, 
    STATE_LOCALITIES, 
    activeService,
    activeState,
    onStateChange,
    activeLocality,
    onLocalityChange,
    activeFacilityId,
    onFacilityIdChange,
    activeWorkerName,
    onWorkerNameChange
}) => {

    // 1. Helper function to calculate average
    const calculateAverage = (scores) => {
        const validScores = scores.filter(s => isFinite(s) && !isNaN(s) && s !== null);
        if (validScores.length === 0) return null;
        const sum = validScores.reduce((a, b) => a + b, 0);
        return sum / validScores.length;
    };

    // 2. Helper function to process a list of submissions
    const kpiHelper = useCallback((submissions) => {
        const scores = {
            overall: [],
            assessment: [],
            decision: [],
            treatment: [],
            coughClassification: [],
            pneumoniaManagement: [],
            diarrheaClassification: [], 
            diarrheaManagement: [], 
        };
        let totalVisits = submissions.length;

        submissions.forEach(sub => {
            const s = sub.scores;
            if (!s) {
                return;
            }
            
            if (s.overallScore_maxScore > 0) {
                scores.overall.push(s.overallScore_score / s.overallScore_maxScore);
            }
            if (s.assessment_total_score_maxScore > 0) {
                scores.assessment.push(s.assessment_total_score_score / s.assessment_total_score_maxScore);
            }
            if (s.finalDecision_maxScore > 0) {
                scores.decision.push(s.finalDecision_score / s.finalDecision_maxScore);
            }
            if (s.treatment_maxScore > 0) {
                scores.treatment.push(s.treatment_score / s.treatment_maxScore);
            }
            if (s.coughClassification_maxScore > 0) {
                scores.coughClassification.push(s.coughClassification_score / s.coughClassification_maxScore);
            }
            if (s.pneumoniaManagement_maxScore > 0) {
                scores.pneumoniaManagement.push(s.pneumoniaManagement_score / s.pneumoniaManagement_maxScore);
            }
            if (s.diarrheaClassification_maxScore > 0) {
                scores.diarrheaClassification.push(s.diarrheaClassification_score / s.diarrheaClassification_maxScore);
            }
            if (s.diarrheaManagement_maxScore > 0) {
                scores.diarrheaManagement.push(s.diarrheaManagement_score / s.diarrheaManagement_maxScore);
            }
        });

        return {
            totalVisits,
            avgOverall: calculateAverage(scores.overall),
            avgAssessment: calculateAverage(scores.assessment),
            avgDecision: calculateAverage(scores.decision),
            avgTreatment: calculateAverage(scores.treatment),
            avgCoughClassification: calculateAverage(scores.coughClassification),
            avgPneumoniaManagement: calculateAverage(scores.pneumoniaManagement),
            avgDiarrheaClassification: calculateAverage(scores.diarrheaClassification), 
            avgDiarrheaManagement: calculateAverage(scores.diarrheaManagement), 
        };
    }, []);

    // 3. Get base completed submissions for this service
    const serviceCompletedSubmissions = useMemo(() => {
        return (allSubmissions || []).filter(sub => 
            sub.service === activeService && 
            sub.status === 'complete'
        );
    }, [allSubmissions, activeService]);


    // 4. Derive options for filters 
    const stateOptions = useMemo(() => {
        if (!STATE_LOCALITIES) return []; 
        return Object.keys(STATE_LOCALITIES)
            .map(stateKey => ({
                key: stateKey,
                name: STATE_LOCALITIES[stateKey]?.ar || stateKey 
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar')); 
    }, [STATE_LOCALITIES]);

    const localityOptions = useMemo(() => {
        if (!activeState || !STATE_LOCALITIES[activeState]?.localities) {
            return [];
        }
        const localities = STATE_LOCALITIES[activeState].localities; 
        return localities
            .map(loc => ({
                key: loc.en, 
                name: loc.ar  
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar')); 
    }, [activeState, STATE_LOCALITIES]);

    const facilityOptions = useMemo(() => {
        const facilityMap = new Map();
        serviceCompletedSubmissions
            .filter(sub => {
                const stateMatch = !activeState || sub.state === activeState;
                const localityMatch = !activeLocality || sub.locality === activeLocality;
                return stateMatch && localityMatch;
            })
            .forEach(sub => {
                if (sub.facilityId && !facilityMap.has(sub.facilityId)) {
                    facilityMap.set(sub.facilityId, {
                        key: sub.facilityId,
                        name: sub.facility || 'Unknown Facility' 
                    });
                }
            });
        return [...facilityMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality]);

    const workerOptions = useMemo(() => {
        const workerMap = new Map(); 
        serviceCompletedSubmissions
            .filter(sub => {
                const stateMatch = !activeState || sub.state === activeState;
                const localityMatch = !activeLocality || sub.locality === activeLocality;
                const facilityMatch = !activeFacilityId || sub.facilityId === activeFacilityId;
                return stateMatch && localityMatch && facilityMatch;
            })
            .forEach(sub => {
                if (sub.staff && !workerMap.has(sub.staff)) {
                     workerMap.set(sub.staff, {
                        key: sub.staff,
                        name: sub.staff
                    });
                }
            });
        return [...workerMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId]);


    // 5. Filter submissions based on active filters
    const filteredSubmissions = useMemo(() => {
        return serviceCompletedSubmissions.filter(sub => {
            const stateMatch = !activeState || sub.state === activeState;
            const localityMatch = !activeLocality || sub.locality === activeLocality;
            const facilityIdMatch = !activeFacilityId || sub.facilityId === activeFacilityId; 
            const workerNameMatch = !activeWorkerName || sub.staff === activeWorkerName; 
            
            return stateMatch && localityMatch && facilityIdMatch && workerNameMatch; 
        });
    }, [
        serviceCompletedSubmissions, 
        activeState, 
        activeLocality, 
        activeFacilityId, 
        activeWorkerName 
    ]);


    // 6. Calculate Overall KPIs based on *filtered* submissions
    const overallKpis = useMemo(() => {
        return kpiHelper(filteredSubmissions);
    }, [filteredSubmissions, kpiHelper]);

    // 7. --- MODIFIED: Calculate Chart Data by averaging per visit number ---
    const chartData = useMemo(() => {
        
        // Helper to calculate percentage
        const calcPercent = (score, max) => (max > 0) ? (score / max) * 100 : null;

        // 1. Group all scores by visit number
        const visitGroups = filteredSubmissions.reduce((acc, sub) => {
            const s = sub.scores;
            // Use index + 1 if visitNumber is missing, but prioritize visitNumber
            const visitNum = sub.visitNumber || 'N/A'; 
            
            // Skip submissions without scores or visit numbers
            if (!s || visitNum === 'N/A') return acc;

            if (!acc[visitNum]) {
                acc[visitNum] = {
                    'Overall': [],
                    'Assessment': [],
                    'Decision': [],
                    'Treatment': [],
                    'Cough': [],
                    'Pneumonia': [],
                    'Diarrhea (Classify)': [],
                    'Diarrhea (Mgmt)': [],
                    count: 0 // To track how many entries
                };
            }
            
            const group = acc[visitNum];
            group.count++;
            
            // Add scores to arrays for averaging
            group['Overall'].push(calcPercent(s.overallScore_score, s.overallScore_maxScore));
            group['Assessment'].push(calcPercent(s.assessment_total_score_score, s.assessment_total_score_maxScore));
            group['Decision'].push(calcPercent(s.finalDecision_score, s.finalDecision_maxScore));
            group['Treatment'].push(calcPercent(s.treatment_score, s.treatment_maxScore));
            group['Cough'].push(calcPercent(s.coughClassification_score, s.coughClassification_maxScore));
            group['Pneumonia'].push(calcPercent(s.pneumoniaManagement_score, s.pneumoniaManagement_maxScore));
            group['Diarrhea (Classify)'].push(calcPercent(s.diarrheaClassification_score, s.diarrheaClassification_maxScore));
            group['Diarrhea (Mgmt)'].push(calcPercent(s.diarrheaManagement_score, s.diarrheaManagement_maxScore));

            return acc;
        }, {});

        // 2. Calculate averages for each group and sort by visit number
        return Object.keys(visitGroups)
            .map(visitNumStr => ({
                visitNumber: parseInt(visitNumStr, 10),
                data: visitGroups[visitNumStr]
            }))
            .sort((a, b) => a.visitNumber - b.visitNumber) // Sort by visit number
            .map(({ visitNumber, data }) => {
                
                // Helper to average an array of scores
                const averageScores = (scores) => {
                    const validScores = scores.filter(s => s !== null && !isNaN(s));
                    if (validScores.length === 0) return null;
                    const sum = validScores.reduce((a, b) => a + b, 0);
                    return Math.round(sum / validScores.length); // Return rounded percentage
                };

                return {
                    name: `Visit ${visitNumber}`, // X-axis label
                    'Overall': averageScores(data['Overall']),
                    'Assessment': averageScores(data['Assessment']),
                    'Decision': averageScores(data['Decision']),
                    'Treatment': averageScores(data['Treatment']),
                    'Cough': averageScores(data['Cough']),
                    'Pneumonia': averageScores(data['Pneumonia']),
                    'Diarrhea (Classify)': averageScores(data['Diarrhea (Classify)']),
                    'Diarrhea (Mgmt)': averageScores(data['Diarrhea (Mgmt)']),
                };
            });
    }, [filteredSubmissions]);
    // --- END MODIFICATION ---

    // 8. Calculate State-level KPIs
    const stateKpis = useMemo(() => {
        const submissionsByState = filteredSubmissions.reduce((acc, sub) => {
            const stateKey = sub.state || 'UNKNOWN';
            if (!acc[stateKey]) {
                acc[stateKey] = [];
            }
            acc[stateKey].push(sub);
            return acc;
        }, {});

        return Object.keys(submissionsByState).map(stateKey => {
            const stateName = STATE_LOCALITIES[stateKey]?.ar || stateKey;
            const stateSubmissions = submissionsByState[stateKey];
            const kpis = kpiHelper(stateSubmissions);
            return {
                stateKey,
                stateName,
                ...kpis
            };
        }).sort((a, b) => a.stateName.localeCompare(b.stateName, 'ar'));
    }, [filteredSubmissions, kpiHelper, STATE_LOCALITIES]);


    // --- Render Component ---
    const serviceTitle = SERVICE_TITLES[activeService] || activeService;
    const isFiltered = activeState || activeLocality || activeFacilityId || activeWorkerName;
    const scopeTitle = isFiltered ? "(Filtered Data)" : "(All Sudan Data)";

    // --- KPI lists for the new layout ---
    const mainKpiGridList = [
        { title: "Overall IMNCI Assessment Adherence", scoreValue: overallKpis.avgOverall },
        { title: "Assess & Classify Score", scoreValue: overallKpis.avgAssessment },
        { title: "Final Decision Score", scoreValue: overallKpis.avgDecision },
        { title: "Treatment & Counsel Score", scoreValue: overallKpis.avgTreatment },
    ];
    
    const mainKpiChartKeys = [
        { key: 'Overall', title: 'Overall' },
        { key: 'Assessment', title: 'Assessment' },
        { key: 'Decision', title: 'Decision' },
        { key: 'Treatment', title: 'Treatment' },
    ];
    
    const diseaseKpiGridList = [
        { title: "Cough Classification", scoreValue: overallKpis.avgCoughClassification },
        { title: "Pneumonia Management Score", scoreValue: overallKpis.avgPneumoniaManagement },
        { title: "Diarrhea Classification Score", scoreValue: overallKpis.avgDiarrheaClassification },
        { title: "Diarrhea Management Score", scoreValue: overallKpis.avgDiarrheaManagement },
    ];

    const diseaseKpiChartKeys = [
        { key: 'Cough', title: 'Cough Classification' },
        { key: 'Pneumonia', title: 'Pneumonia Mgmt' },
        { key: 'Diarrhea (Classify)', title: 'Diarrhea Classify' },
        { key: 'Diarrhea (Mgmt)', title: 'Diarrhea Mgmt' },
    ];
    // --- END KPI lists ---

    return (
        <div className="p-4" dir="ltr"> 
            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">
                Mentorship Dashboard: {serviceTitle} {scopeTitle}
            </h3>

            {/* --- Filter Controls --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 p-4 bg-gray-50 rounded-lg border">
                <FilterSelect
                    label="State"
                    value={activeState}
                    onChange={(value) => {
                        onStateChange(value);
                        onLocalityChange(""); 
                        onFacilityIdChange(""); 
                        onWorkerNameChange(""); 
                    }}
                    options={stateOptions}
                    defaultOption="All States"
                />
                <FilterSelect
                    label="Locality"
                    value={activeLocality}
                    onChange={(value) => {
                        onLocalityChange(value);
                        onFacilityIdChange(""); 
                        onWorkerNameChange(""); 
                    }}
                    options={localityOptions}
                    disabled={!activeState}
                    defaultOption="All Localities"
                />
                <FilterSelect
                    label="Health Facility Name" 
                    value={activeFacilityId} 
                    onChange={(value) => {
                        onFacilityIdChange(value);
                        onWorkerNameChange(""); 
                    }}
                    options={facilityOptions} 
                    disabled={!activeLocality} 
                    defaultOption="All Facilities" 
                />
                <FilterSelect
                    label="Health Worker Name" 
                    value={activeWorkerName} 
                    onChange={onWorkerNameChange} 
                    options={workerOptions} 
                    disabled={!activeFacilityId} 
                    defaultOption="All Health Workers" 
                />
            </div>
            
            
            {/* --- MODIFIED: KPI Layout --- */}

            {/* Row 1: Total Visits */}
            <div className="grid grid-cols-1 gap-4 mb-6">
                <KpiCard title="Total Completed Visits" value={overallKpis.totalVisits} />
            </div>

            {/* Row 2: KPI Grid and Line Chart (Main) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <KpiGridCard
                    title="Overall Adherence Scores (Average)"
                    kpis={mainKpiGridList}
                />
                <KpiLineChart 
                    title="Adherence Over Time (Main KPIs)"
                    chartData={chartData}
                    kpiKeys={mainKpiChartKeys}
                />
            </div>

            {/* Row 3: KPI Grid and Line Chart (Disease-Specific) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                 <KpiGridCard
                    title="Disease-Specific Scores (Average)"
                    kpis={diseaseKpiGridList}
                />
                <KpiLineChart 
                    title="Adherence Over Time (Disease-Specific)"
                    chartData={chartData}
                    kpiKeys={diseaseKpiChartKeys}
                />
            </div>
            
            {/* --- END MODIFIED KPI Layout --- */}


            {/* State-level Table */}
            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">
                Data by State {scopeTitle}
            </h3>
            <div className="overflow-x-auto shadow-md rounded-lg border">
                <table className="w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words w-1/6">State</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words">Total Visits</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words">Overall IMNCI Assessment Adherence</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words">Assess & Classify Score</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words">Final Decision Score</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words">Treatment & Counsel Score</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words">Cough Classification</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words">Pneumonia Management Score</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words">Diarrhea Classification Score</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 tracking-wider break-words">Diarrhea Management Score</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {stateKpis.length === 0 ? (
                            <tr>
                                <td colSpan="10" className="px-2 py-4 text-center text-gray-500">
                                    No completed visits match the current filters.
                                </td>
                            </tr>
                        ) : (
                            stateKpis.map(state => (
                                <tr key={state.stateKey}>
                                    <td className="px-2 py-4 text-sm font-medium text-gray-900 break-words">{state.stateName}</td>
                                    <td className="px-2 py-4 text-sm text-gray-700">{state.totalVisits}</td>
                                    <td className="px-2 py-4 text-sm"><ScoreText value={state.avgOverall} /></td>
                                    <td className="px-2 py-4 text-sm"><ScoreText value={state.avgAssessment} /></td>
                                    <td className="px-2 py-4 text-sm"><ScoreText value={state.avgDecision} /></td>
                                    <td className="px-2 py-4 text-sm"><ScoreText value={state.avgTreatment} /></td>
                                    <td className="px-2 py-4 text-sm"><ScoreText value={state.avgCoughClassification} /></td>
                                    <td className="px-2 py-4 text-sm"><ScoreText value={state.avgPneumoniaManagement} /></td>
                                    <td className="px-2 py-4 text-sm"><ScoreText value={state.avgDiarrheaClassification} /></td>
                                    <td className="px-2 py-4 text-sm"><ScoreText value={state.avgDiarrheaManagement} /></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MentorshipDashboard;