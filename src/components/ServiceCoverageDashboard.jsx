// ServiceCoverageDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, PageHeader, Spinner, FormGroup, Select, Table } from './CommonComponents';
import { listHealthFacilities } from "../data.js";
import { STATE_LOCALITIES } from "./constants.js";
import SudanMap from '../SudanMap'; // Import the new map component

// --- COORDINATES AND SCALE FOR MAP ---
// Each state now has a custom scale for optimal zoom
const mapCoordinates = {
    "Khartoum":       { lat: 15.60, lng: 32.50, scale: 35000 },
    "Gezira":         { lat: 14.40, lng: 33.51, scale: 14000 },
    "White Nile":     { lat: 13.16, lng: 32.66, scale: 9000 },
    "Blue Nile":      { lat: 11.76, lng: 34.35, scale: 12000 },
    "Sennar":         { lat: 13.15, lng: 33.93, scale: 12000 },
    "Gedarif":        { lat: 14.03, lng: 35.38, scale: 11000 },
    "Kassala":        { lat: 15.45, lng: 36.40, scale: 10000 },
    "Red Sea":        { lat: 19.61, lng: 37.21, scale: 6000 },
    "Northern":       { lat: 19.16, lng: 30.47, scale: 5000 },
    "River Nile":     { lat: 17.59, lng: 33.96, scale: 7000 },
    "North Kordofan": { lat: 13.18, lng: 30.21, scale: 7000 },
    "South Kordofan": { lat: 11.01, lng: 29.71, scale: 7500 },
    "West Kordofan":  { lat: 11.71, lng: 28.34, scale: 7000 },
    "North Darfur":   { lat: 13.63, lng: 25.35, scale: 6000 },
    "South Darfur":   { lat: 12.05, lng: 24.88, scale: 7000 },
    "West Darfur":    { lat: 13.45, lng: 22.45, scale: 9000 },
    "Central Darfur": { lat: 12.90, lng: 23.48, scale: 8000 },
    "East Darfur":    { lat: 11.46, lng: 26.12, scale: 7500 }
};


// --- KPI CARD COMPONENTS ---
const ServiceIndicatorCard = ({ title, value, total, percentage }) => (
    <Card><div className="p-4"><h3 className="text-lg font-medium text-gray-700">{title}</h3><div className="mt-2 text-center"><span className="text-4xl font-bold text-sky-600">{percentage}%</span><p className="text-sm text-gray-500 mt-1">({value} out of {total} facilities)</p></div></div></Card>
);
const TotalCountCard = ({ title, count }) => (
    <Card><div className="p-4"><h3 className="text-lg font-medium text-gray-700">{title}</h3><div className="mt-2 text-center"><span className="text-4xl font-bold text-slate-700">{count}</span></div></div></Card>
);

// --- MAIN DASHBOARD COMPONENT ---
const ServiceCoverageDashboard = () => {
    const [facilities, setFacilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [facilityTypeFilter, setFacilityTypeFilter] = useState('');
    const [healthWorkerFilter, setHealthWorkerFilter] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const facilitiesData = await listHealthFacilities();
                setFacilities(facilitiesData);
            } catch (err) {
                setError("Failed to load health facilities data.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);
    
    const facilityTypes = useMemo(() => Array.from(new Set(facilities.map(f => f['نوع_المؤسسةالصحية']).filter(Boolean))).sort(), [facilities]);
    const healthWorkerTypes = ["طبيب", "مساعد طبي", "ممرض معالج"];

    const filteredFacilities = useMemo(() => {
        if (!facilities.length) return [];
        return facilities.filter(f => 
            (!stateFilter || f['الولاية'] === stateFilter) &&
            (!localityFilter || f['المحلية'] === localityFilter) &&
            (!facilityTypeFilter || f['نوع_المؤسسةالصحية'] === facilityTypeFilter) &&
            (!healthWorkerFilter || f.imnci_staff?.some(staff => staff.job_title === healthWorkerFilter))
        );
    }, [facilities, stateFilter, localityFilter, facilityTypeFilter, healthWorkerFilter]);

    const functioningPhcs = useMemo(() => filteredFacilities.filter(f => f['هل_المؤسسة_تعمل'] === 'Yes' && (f['نوع_المؤسسةالصحية'] === 'وحدة صحة الاسرة' || f['نوع_المؤسسةالصحية'] === 'مركز صحة الاسرة')), [filteredFacilities]);
    const imnciInPhcs = useMemo(() => functioningPhcs.filter(f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes'), [functioningPhcs]);
    const imnciCoveragePercentage = useMemo(() => functioningPhcs.length > 0 ? Math.round((imnciInPhcs.length / functioningPhcs.length) * 100) : 0, [imnciInPhcs, functioningPhcs]);

    const isLocalityView = !!stateFilter;
    const aggregationLevelName = isLocalityView ? 'Locality' : 'State';
    
    const tableCoverageData = useMemo(() => {
        const summary = {};
        const aggregationKey = isLocalityView ? 'المحلية' : 'الولاية';
        const facilitiesToProcess = isLocalityView ? filteredFacilities.filter(f => f['الولاية'] === stateFilter) : filteredFacilities;

        facilitiesToProcess.forEach(facility => {
            const key = facility[aggregationKey];
            if (!key) return;
            if (!summary[key]) {
                let name;
                if (isLocalityView) {
                    const localityInfo = STATE_LOCALITIES[stateFilter]?.localities.find(l => l.en === key);
                    name = localityInfo?.ar || key;
                } else {
                    name = STATE_LOCALITIES[key]?.ar || key;
                }
                summary[key] = { name, key, totalFunctioningPhc: 0, totalPhcWithImnci: 0 };
            }
            const isPhc = facility['نوع_المؤسسةالصحية'] === 'وحدة صحة الاسرة' || facility['نوع_المؤسسةالصحية'] === 'مركز صحة الاسرة';
            if (isPhc && facility['هل_المؤسسة_تعمل'] === 'Yes') {
                summary[key].totalFunctioningPhc++;
                if (facility['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') {
                    summary[key].totalPhcWithImnci++;
                }
            }
        });
        return Object.values(summary).map(s => ({ ...s, coverage: s.totalFunctioningPhc > 0 ? Math.round((s.totalPhcWithImnci / s.totalFunctioningPhc) * 100) : 0 })).sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredFacilities, stateFilter, isLocalityView]);

    const tableToolsData = useMemo(() => {
        const summary = {};
        const aggregationKey = isLocalityView ? 'المحلية' : 'الولاية';
        const facilitiesToProcess = (isLocalityView ? imnciInPhcs.filter(f => f['الولاية'] === stateFilter) : imnciInPhcs);

        facilitiesToProcess.forEach(facility => {
            const key = facility[aggregationKey];
            if (!key) return;
            if (!summary[key]) {
                let name;
                if (isLocalityView) {
                    const localityInfo = STATE_LOCALITIES[stateFilter]?.localities.find(l => l.en === key);
                    name = localityInfo?.ar || key;
                } else {
                    name = STATE_LOCALITIES[key]?.ar || key;
                }
                summary[key] = { name, totalImnciPhcs: 0, countWithRegister: 0, countWithChartbooklet: 0, countWithWeightScale: 0, countWithOrtCorner: 0 };
            }
            summary[key].totalImnciPhcs++;
            if (facility['وجود_سجل_علاج_متكامل'] === 'Yes') summary[key].countWithRegister++;
            if (facility['وجود_كتيب_لوحات'] === 'Yes') summary[key].countWithChartbooklet++;
            if (facility['ميزان_وزن'] === 'Yes') summary[key].countWithWeightScale++;
            if (facility['غرفة_إرواء'] === 'Yes') summary[key].countWithOrtCorner++;
        });
        return Object.values(summary).map(s => {
            const total = s.totalImnciPhcs;
            return { ...s, percentageWithRegister: total > 0 ? Math.round((s.countWithRegister / total) * 100) : 0, percentageWithChartbooklet: total > 0 ? Math.round((s.countWithChartbooklet / total) * 100) : 0, percentageWithWeightScale: total > 0 ? Math.round((s.countWithWeightScale / total) * 100) : 0, percentageWithOrtCorner: total > 0 ? Math.round((s.countWithOrtCorner / total) * 100) : 0 };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [imnciInPhcs, stateFilter, isLocalityView]);

    const stateLevelMapData = useMemo(() => {
        const summary = {};
        // Use all facilities for state-level summary, not filtered ones, to get a stable total
        facilities.forEach(f => {
            const key = f['الولاية'];
            if (!key) return;
            if (!summary[key]) summary[key] = { totalFunctioningPhc: 0, totalPhcWithImnci: 0 };
            const isPhc = f['نوع_المؤسسةالصحية'] === 'وحدة صحة الاسرة' || f['نوع_المؤسسةالصحية'] === 'مركز صحة الاسرة';
            if (isPhc && f['هل_المؤسسة_تعمل'] === 'Yes') {
                summary[key].totalFunctioningPhc++;
                if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') summary[key].totalPhcWithImnci++;
            }
        });
        return Object.entries(summary).map(([stateKey, counts]) => ({
            state: stateKey,
            percentage: counts.totalFunctioningPhc > 0 ? Math.round((counts.totalPhcWithImnci / counts.totalFunctioningPhc) * 100) : 0,
            coordinates: mapCoordinates[stateKey] ? [mapCoordinates[stateKey].lng, mapCoordinates[stateKey].lat] : [0,0]
        }));
    }, [facilities]); // Depend on all facilities for a complete state overview

    const selectedStateData = useMemo(() => {
        if (!stateFilter) return null;
        return stateLevelMapData.find(s => s.state === stateFilter);
    }, [stateFilter, stateLevelMapData]);
    
    const mapViewConfig = useMemo(() => {
        const stateConfig = stateFilter ? mapCoordinates[stateFilter] : null;
        if (stateConfig) {
            return {
                center: [stateConfig.lng, stateConfig.lat],
                scale: stateConfig.scale,
                focusedState: stateFilter
            };
        }
        return { center: [30, 15.5], scale: 2000, focusedState: null };
    }, [stateFilter]);

    const handleStateChange = (e) => {
        setStateFilter(e.target.value);
        setLocalityFilter('');
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    if (error) return <div className="p-4 text-red-600 bg-red-100 rounded-md">{error}</div>;

    return (
        <div>
            <PageHeader title="IMNCI Service Coverage Overview" subtitle="Key performance indicators for child health services." />
            <Card>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormGroup label="Filter by State"><Select value={stateFilter} onChange={handleStateChange}><option value="">All States</option>{Object.keys(STATE_LOCALITIES).sort().map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>)}</Select></FormGroup>
                    <FormGroup label="Filter by Locality"><Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}><option value="">All Localities</option>{stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}</Select></FormGroup>
                    <FormGroup label="Filter by Facility Type"><Select value={facilityTypeFilter} onChange={(e) => setFacilityTypeFilter(e.target.value)}><option value="">All Types</option>{facilityTypes.map(type => <option key={type} value={type}>{type}</option>)}</Select></FormGroup>
                    <FormGroup label="Filter by Health Worker"><Select value={healthWorkerFilter} onChange={(e) => setHealthWorkerFilter(e.target.value)}><option value="">All Worker Types</option>{healthWorkerTypes.map(type => <option key={type} value={type}>{type}</option>)}</Select></FormGroup>
                </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                <TotalCountCard title="Total Functioning PHC Facilities" count={functioningPhcs.length} />
                <TotalCountCard title="Total PHC Facilities with IMNCI" count={imnciInPhcs.length} />
                <ServiceIndicatorCard title="IMNCI Service Coverage in PHCs" value={imnciInPhcs.length} total={functioningPhcs.length} percentage={imnciCoveragePercentage} />
            </div>
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <div className="p-4 border-b">
                        <h3 className="text-lg font-medium text-gray-700">
                            {isLocalityView && selectedStateData
                                ? `IMNCI Coverage in ${STATE_LOCALITIES[stateFilter].ar} (State Overall: ${selectedStateData.percentage}%)`
                                : `IMNCI Coverage by ${aggregationLevelName}`
                            }
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Summary of PHC facilities based on current filters.</p>
                    </div>
                    <Table headers={[aggregationLevelName, 'Functioning PHCs', 'PHCs with IMNCI', 'Coverage (%)']}>
                        {tableCoverageData.map(row => (<tr key={row.name}><td className="font-medium text-gray-800">{row.name}</td><td>{row.totalFunctioningPhc}</td><td>{row.totalPhcWithImnci}</td><td><div className="flex items-center"><div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${row.coverage >= 75 ? 'bg-green-600' : row.coverage >= 40 ? 'bg-yellow-400' : 'bg-red-600'}`} style={{ width: `${row.coverage}%` }}></div></div><span className="ml-3 font-medium text-sm text-gray-700 w-10 text-right">{row.coverage}%</span></div></td></tr>))}
                    </Table>
                </Card>
                <Card>
                    <div className="p-4 border-b">
                        <h3 className="text-lg font-medium text-gray-700">
                             {isLocalityView && selectedStateData
                                ? `Geographical Distribution: ${STATE_LOCALITIES[stateFilter].ar}`
                                : 'Geographical Distribution'
                            }
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                             {isLocalityView && selectedStateData
                                ? `Localities colored by coverage. State overall: ${selectedStateData.percentage}%.`
                                : 'States are colored by IMNCI service coverage percentage.'
                            }
                        </p>
                    </div>
                    <div className="p-2">
                        <SudanMap 
                            data={stateLevelMapData} 
                            localityData={isLocalityView ? tableCoverageData : []}
                            {...mapViewConfig} 
                        />
                    </div>
                </Card>
            </div>
            <div className="mt-6">
                <Card>
                    <div className="p-4 border-b">
                        <h3 className="text-lg font-medium text-gray-700">
                             {isLocalityView && selectedStateData
                                ? `IMNCI Tools Availability in ${STATE_LOCALITIES[stateFilter].ar} (State Overall: ${selectedStateData.percentage}%)`
                                : `IMNCI Tools Availability by ${aggregationLevelName}`
                            }
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Availability of key supplies in PHC facilities providing IMNCI services.</p>
                    </div>
                    <Table headers={[aggregationLevelName, 'PHCs w/ IMNCI', 'سجلات', 'كتيبات', 'ميزان وزن', 'غرفة ارواء']}>
                        {tableToolsData.map(row => (<tr key={row.name}><td className="font-medium text-gray-800">{row.name}</td><td>{row.totalImnciPhcs}</td><td>{`${row.countWithRegister} (${row.percentageWithRegister}%)`}</td><td>{`${row.countWithChartbooklet} (${row.percentageWithChartbooklet}%)`}</td><td>{`${row.countWithWeightScale} (${row.percentageWithWeightScale}%)`}</td><td>{`${row.countWithOrtCorner} (${row.percentageWithOrtCorner}%)`}</td></tr>))}
                    </Table>
                </Card>
            </div>
        </div>
    );
};

export default ServiceCoverageDashboard;