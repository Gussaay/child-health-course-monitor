// MentorshipDashboard.jsx
import React, { useMemo, useCallback } from 'react';

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
        // MODIFIED: Enhanced border and shadow
        <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 text-center">
            {/* MODIFIED: Removed 'uppercase' class */}
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

// --- NEW: Filter Helper Component ---
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
    // NEW Props for filters
    activeState,
    onStateChange,
    activeLocality,
    onLocalityChange,
    activeFacilityType,
    onFacilityTypeChange,
    activeWorkerType,
    onWorkerTypeChange
}) => {

    // 1. Helper function to calculate average, ignoring NaN/Infinity
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
            diarrheaClassification: [], // NEW
            diarrheaManagement: [], // NEW
        };
        let totalVisits = submissions.length;

        submissions.forEach(sub => {
            const s = sub.scores;
            if (!s) {
                return;
            }
            
            // Note: score keys are based on SkillsAssessmentForm's calculateScores function
            if (s.overallScore_maxScore > 0) {
                scores.overall.push(s.overallScore_score / s.overallScore_maxScore);
            }

            if (s.assessment_total_score_maxScore > 0) {
                scores.assessment.push(s.assessment_total_score_score / s.assessment_total_score_maxScore);
            }

            if (s.finalDecision_maxScore > 0) {
                scores.decision.push(s.finalDecision_score / s.finalDecision_maxScore);
            }
            
            // Use the treatment keys from SkillsAssessmentForm
            if (s.treatment_maxScore > 0) {
                scores.treatment.push(s.treatment_score / s.treatment_maxScore);
            }

            // --- KPI EXTRACTION ---
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
            // --- END KPI EXTRACTION ---
        });

        return {
            totalVisits,
            avgOverall: calculateAverage(scores.overall),
            avgAssessment: calculateAverage(scores.assessment),
            avgDecision: calculateAverage(scores.decision),
            avgTreatment: calculateAverage(scores.treatment),
            avgCoughClassification: calculateAverage(scores.coughClassification),
            avgPneumoniaManagement: calculateAverage(scores.pneumoniaManagement),
            avgDiarrheaClassification: calculateAverage(scores.diarrheaClassification), // NEW
            avgDiarrheaManagement: calculateAverage(scores.diarrheaManagement), // NEW
        };
    }, []);

    // 3. Get base completed submissions for this service (used for filters and data)
    const serviceCompletedSubmissions = useMemo(() => {
        // FIX: Add guard for allSubmissions being undefined
        return (allSubmissions || []).filter(sub => 
            sub.service === activeService && 
            sub.status === 'complete'
        );
    }, [allSubmissions, activeService]);


    // 4. --- NEW: Derive options for filters ---

    // State options from STATE_LOCALITIES prop (using .ar for display)
    const stateOptions = useMemo(() => {
        if (!STATE_LOCALITIES) return []; // Guard
        return Object.keys(STATE_LOCALITIES)
            .map(stateKey => ({
                key: stateKey,
                name: STATE_LOCALITIES[stateKey]?.ar || stateKey // Use Arabic name
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar')); // Sort by Arabic
    }, [STATE_LOCALITIES]);

    // Locality options based on selected state (using array structure)
    const localityOptions = useMemo(() => {
        if (!activeState || !STATE_LOCALITIES[activeState]?.localities) {
            return [];
        }
        const localities = STATE_LOCALITIES[activeState].localities; // localities is an array
        return localities
            .map(loc => ({
                key: loc.en, // Use 'en' as the key
                name: loc.ar  // Use 'ar' as the name
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar')); // Sort by Arabic
    }, [activeState, STATE_LOCALITIES]);

    // Facility and Worker Type options derived from the data itself
    const { facilityTypeOptions, workerTypeOptions } = useMemo(() => {
        const facilityTypes = new Set();
        const workerTypes = new Set();
        
        serviceCompletedSubmissions.forEach(sub => {
            // Use the fields added in SkillsMentorshipView's processedSubmissions
            if (sub.facilityType) facilityTypes.add(sub.facilityType);
            if (sub.workerType) workerTypes.add(sub.workerType);
        });
        
        return {
            facilityTypeOptions: [...facilityTypes].sort(),
            workerTypeOptions: [...workerTypes].sort(),
        };
    }, [serviceCompletedSubmissions]);


    // 5. --- NEW: Filter submissions based on active filters ---
    const filteredSubmissions = useMemo(() => {
        return serviceCompletedSubmissions.filter(sub => {
            // Check each filter. If the filter is not set (""), skip it.
            const stateMatch = !activeState || sub.state === activeState;
            const localityMatch = !activeLocality || sub.locality === activeLocality;
            const facilityTypeMatch = !activeFacilityType || sub.facilityType === activeFacilityType;
            const workerTypeMatch = !activeWorkerType || sub.workerType === activeWorkerType;
            
            return stateMatch && localityMatch && facilityTypeMatch && workerTypeMatch;
        });
    }, [
        serviceCompletedSubmissions, 
        activeState, 
        activeLocality, 
        activeFacilityType, 
        activeWorkerType
    ]);


    // 6. Calculate Overall KPIs based on *filtered* submissions
    const overallKpis = useMemo(() => {
        return kpiHelper(filteredSubmissions);
    }, [filteredSubmissions, kpiHelper]);

    // 7. Calculate State-level KPIs based on *filtered* submissions
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
            const stateName = STATE_LOCALITIES[stateKey]?.ar || stateKey; // Use Arabic name
            const stateSubmissions = submissionsByState[stateKey];
            const kpis = kpiHelper(stateSubmissions);
            return {
                stateKey,
                stateName,
                ...kpis
            };
        }).sort((a, b) => a.stateName.localeCompare(b.stateName, 'ar')); // Sort by Arabic
    }, [filteredSubmissions, kpiHelper, STATE_LOCALITIES]);


    // --- Render Component ---
    const serviceTitle = SERVICE_TITLES[activeService] || activeService;
    const isFiltered = activeState || activeLocality || activeFacilityType || activeWorkerType;
    const scopeTitle = isFiltered ? "(Filtered Data)" : "(All Sudan Data)";

    return (
        <div className="p-4" dir="ltr"> {/* Set LTR for dashboard layout */}
            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">
                Mentorship Dashboard: {serviceTitle} {scopeTitle}
            </h3>

            {/* --- NEW: Filter Controls --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 p-4 bg-gray-50 rounded-lg border">
                <FilterSelect
                    label="State"
                    value={activeState}
                    onChange={(value) => {
                        onStateChange(value);
                        onLocalityChange(""); // Reset locality when state changes
                    }}
                    options={stateOptions}
                    defaultOption="All States"
                />
                <FilterSelect
                    label="Locality"
                    value={activeLocality}
                    onChange={onLocalityChange}
                    options={localityOptions}
                    disabled={!activeState}
                    defaultOption="All Localities"
                />
                <FilterSelect
                    label="Health Facility Type"
                    value={activeFacilityType}
                    onChange={onFacilityTypeChange}
                    options={facilityTypeOptions.map(opt => ({ key: opt, name: opt }))}
                    defaultOption="All Facility Types"
                />
                <FilterSelect
                    label="Health Worker Type"
                    value={activeWorkerType}
                    onChange={onWorkerTypeChange}
                    options={workerTypeOptions.map(opt => ({ key: opt, name: opt }))}
                    defaultOption="All Worker Types"
                />
            </div>
            
            {/* KPI Cards: Row 1 (Main KPIs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <KpiCard title="Total Completed Visits" value={overallKpis.totalVisits} />
                <KpiCard title="Overall IMNCI Assessment Adherence" scoreValue={overallKpis.avgOverall} />
                <KpiCard title="Assess & Classify Score" scoreValue={overallKpis.avgAssessment} />
                <KpiCard title="Final Decision Score" scoreValue={overallKpis.avgDecision} />
                <KpiCard title="Treatment & Counsel Score" scoreValue={overallKpis.avgTreatment} />
            </div>

            {/* KPI Cards: Row 2 (Disease-Specific KPIs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <KpiCard title="Cough Classification" scoreValue={overallKpis.avgCoughClassification} />
                <KpiCard title="Pneumonia Management Score" scoreValue={overallKpis.avgPneumoniaManagement} />
                <KpiCard title="Diarrhea Classification Score" scoreValue={overallKpis.avgDiarrheaClassification} />
                <KpiCard title="Diarrhea Management Score" scoreValue={overallKpis.avgDiarrheaManagement} />
            </div>

            {/* State-level Table */}
            <h3 className="text-xl font-bold text-sky-800 mb-4 text-left">
                Data by State
            </h3>
            {/* MODIFIED: Added overflow-x-auto as a fallback, but used table-fixed and reduced padding */}
            <div className="overflow-x-auto shadow-md rounded-lg border">
                <table className="w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            {/* MODIFIED: Removed 'uppercase', changed text to Title Case, adjusted padding/wrapping */}
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
                                {/* MODIFIED: Updated colSpan to 10 */}
                                <td colSpan="10" className="px-2 py-4 text-center text-gray-500">
                                    No completed visits match the current filters.
                                </td>
                            </tr>
                        ) : (
                            stateKpis.map(state => (
                                <tr key={state.stateKey}>
                                    {/* MODIFIED: Reduced padding (px-2) and removed whitespace-nowrap */}
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