// ServiceCoverageDashboard.jsx (Exports two distinct components)
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf'; // Import jsPDF
// Assuming CommonComponents are correctly defined elsewhere
import { Card, PageHeader, Spinner, FormGroup, Select, Table, Input, EmptyState } from './CommonComponents';
// --- MODIFICATION: Remove direct data import, add DataContext import ---
import { useDataCache } from '../DataContext';
// import { listHealthFacilities } from "../data.js"; // No longer needed
// --- END MODIFICATION ---
import { STATE_LOCALITIES } from "./constants.js";
import SudanMap from '../SudanMap';

// --- HELPER COMPONENTS (Available to all dashboards in this file) ---
// ... (All helper components like mapCoordinates, KPI cards, SortIcon, MapLegend, getCoverageBar, MapTooltip, FacilityTooltip remain unchanged) ...
const mapCoordinates = {
    // ... coordinates remain the same ...
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

// --- KPI Card Components (Unchanged) ---
const NumberPercentageCard = ({ title, value, percentage }) => (
    <Card className="border-2 border-gray-300">
        <div className="p-4">
            <h3 className="text-lg font-medium text-gray-700">{title}</h3>
            <div className="mt-2 text-center">
                 <span className="text-4xl font-bold text-sky-600 mr-2">{value}</span>
                 <span className="text-2xl font-semibold text-gray-500">({percentage}%)</span>
            </div>
        </div>
    </Card>
);
const ValueTotalPercentageCard = ({ title, value, total, percentage }) => (
    <Card className="border-2 border-gray-300">
        <div className="p-4">
            <h3 className="text-lg font-medium text-gray-700">{title}</h3>
            <div className="mt-2 text-center">
                <span className="text-4xl font-bold text-sky-600">{value}</span>
                <span className="text-2xl font-semibold text-gray-500 ml-1">({percentage}%)</span>
                { total > 0 && <p className="text-sm text-gray-500 mt-1">out of {total}</p>}
            </div>
        </div>
    </Card>
);
const ValueOutOfTotalPercentageCard_V2 = ({ title, value, total, percentage }) => (
    <Card className="border-2 border-gray-300">
        <div className="p-4">
            <h3 className="text-lg font-medium text-gray-700">{title}</h3>
            <div className="mt-2 text-center">
                <span className="text-4xl font-bold text-sky-600">{value}</span>
                { total > 0 && <span className="text-sm text-gray-500 mx-1">out of {total}</span> }
                <span className="text-2xl font-semibold text-gray-500 ml-1">({percentage}%)</span>
            </div>
        </div>
    </Card>
);
const TotalCountCard = ({ title, count }) => (
    <Card className="border-2 border-gray-300">
        <div className="p-4">
            <h3 className="text-lg font-medium text-gray-700">{title}</h3>
            <div className="mt-2 text-center">
                <span className="text-4xl font-bold text-slate-700">{count}</span>
            </div>
        </div>
    </Card>
);
// --- END KPI CARD Components ---

// --- HELPER FUNCTION FOR COPYING TABLES ---
const copyTableToClipboard = async (tableRef, setStatusCallback) => {
    if (!tableRef.current) return;
    try {
        const rows = Array.from(tableRef.current.querySelectorAll('tr'));
        // Construct TSV (Tab Separated Values) for Excel compatibility
        const tsv = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => {
                // Clean up text: remove newlines inside cells, trim whitespace
                return cell.innerText.replace(/[\n\r]+/g, ' ').trim();
            }).join('\t');
        }).join('\n');
        
        await navigator.clipboard.writeText(tsv);
        setStatusCallback('Copied!');
        setTimeout(() => setStatusCallback(''), 2000);
    } catch (err) {
        console.error('Copy failed', err);
        setStatusCallback('Failed');
        setTimeout(() => setStatusCallback(''), 2000);
    }
};


const SortIcon = ({ direction }) => {
    if (!direction) return <span className="text-gray-400 ml-1">▲▼</span>;
    return <span className="ml-1">{direction === 'ascending' ? '▲' : '▼'}</span>;
};
const MapLegend = () => (
    <div className="flex justify-center items-center gap-2 p-1 text-sm text-gray-600">
        <span className="font-bold">Legend:</span>
        <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: '#6B6B6B' }}></div><span className='text-xs'>0-39% (or No Data)</span></div>
        <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: '#6266B1' }}></div><span className='text-xs'>40-74%</span></div>
        <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: '#313695' }}></div><span className='text-xs'>&ge;75%</span></div>
        <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full border-2 border-white ring-1 ring-[#313695]" style={{ backgroundColor: '#313695' }}></div><span className='text-xs'>Facility</span></div>
    </div>
);
const getCoverageBar = (c) => {
    const coverage = Number(c) || 0;
    const isZero = coverage === 0;
    // This logic correctly handles all cases, including 0
    const colorClass = coverage >= 75 ? 'bg-sky-700' : coverage >= 40 ? 'bg-sky-400' : 'bg-gray-600';
    const barWidth = isZero ? '2px' : `${coverage}%`;
    const barStyle = { width: barWidth, minWidth: isZero ? '2px' : undefined };
    return (
        <div className="flex items-center w-full">
            <span className="text-sm font-medium w-10 text-right mr-2">{coverage}%</span>
            <div className="flex-grow bg-gray-200 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full ${colorClass}`} style={barStyle}></div>
            </div>
        </div>
    );
};
const MapTooltip = ({ title, dataRows = [], equipmentSummary }) => (
    <div className="absolute z-50 p-4 bg-white border border-gray-300 shadow-xl rounded-lg w-80 pointer-events-none transform -translate-x-full -translate-y-1/2">
        <h4 className="text-lg font-bold text-gray-800 border-b pb-2 mb-2">{title}</h4>
        <div className="text-sm space-y-1">
            {dataRows.map(row => ( <p key={row.label}><span className="font-semibold text-sky-700">{row.label}:</span> {row.value}</p> ))}
            {equipmentSummary && (
                <>
                    <p className="pt-2 font-bold border-t mt-2">{equipmentSummary.title || "Equipment Summary"}:</p>
                    <p className="text-xs text-gray-600">Total Units Reporting: {equipmentSummary.totalUnits}</p>
                    <ul className="list-disc list-inside text-xs mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                        {Object.entries(equipmentSummary.summary).map(([key, count]) => ( <li key={key} className={count === 0 ? 'text-red-500' : 'text-gray-700'}> {key}: <span className="font-bold">{count}</span> </li> ))}
                    </ul>
                </>
            )}
        </div>
    </div>
);
const FacilityTooltip = ({ data }) => (
    <div className="absolute z-50 p-3 bg-white border border-gray-300 shadow-xl rounded-lg w-64 pointer-events-none transform -translate-x-1/2">
        <h4 className="text-md font-bold text-gray-800 border-b pb-1 mb-2">{data.name}</h4>
        <p className="text-xs font-semibold text-sky-700 mb-1">Equipment Summary:</p>
        <ul className="list-disc list-inside text-xs space-y-0.5 max-h-48 overflow-y-auto">
            {Object.entries(data.summary).map(([key, count]) => ( <li key={key} className={count === 0 ? 'text-red-500' : 'text-gray-700'}> {key}: <span className="font-bold">{count}</span> </li> ))}
        </ul>
    </div>
);
// --- UNIFIED TOOLTIP COMPONENTS --- (Unchanged)


// --- NEONATAL COVERAGE DASHBOARD ---

const NEONATAL_EQUIPMENT_SPEC = { /* ... (unchanged) ... */
    'neonatal_total_beds': 'Total Beds', 'neonatal_total_incubators': 'Incubators', 'neonatal_total_cots': 'Cots', 'neonatal_phototherapy': 'Phototherapy Units', 'neonatal_oxygen_machine': 'Oxygen Machines', 'neonatal_oxygen_cylinder': 'Oxygen Cylinders', 'neonatal_respiration_monitor': 'Respiration Monitors', 'neonatal_cpap': 'CPAP Machines', 'neonatal_mechanical_ventilator': 'Mechanical Ventilators', 'neonatal_warmer': 'Neonatal Warmers', 'neonatal_infusion_pump': 'Infusion Pumps', 'neonatal_syringe_pump': 'Syringe Pumps', 'neonatal_sucker': 'Suction Devices', 'neonatal_ambu_bag': 'Resuscitation Bags', 'neonatal_portable_incubator': 'Portable Incubators'
};
const NEONATAL_EQUIPMENT_KEYS = Object.keys(NEONATAL_EQUIPMENT_SPEC);

export const NeonatalCoverageDashboard = () => {
    // --- MODIFICATION: Use DataCache and fetcher, adding fetchHealthFacilities ---
    const { healthFacilities: allFacilities, isLoading, fetchHealthFacilities } = useDataCache();
    const loading = isLoading.healthFacilities;
    // --- END MODIFICATION ---
    
    // Local state for filters and UI remains
    const [stateFilter, setStateFilter] = useState(''); 
    const [localityFilter, setLocalityFilter] = useState(''); 
    const [equipmentFilter, setEquipmentFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'coverage', direction: 'descending' }); 
    const [isMapFullscreen, setIsMapFullscreen] = useState(false); 
    const [mapViewLevel, setMapViewLevel] = useState('locality');
    
    // Copy States
    const [copyStatus, setCopyStatus] = useState(''); // For Map
    const [table1CopyStatus, setTable1CopyStatus] = useState(''); // For Coverage Table
    const [table2CopyStatus, setTable2CopyStatus] = useState(''); // For Equipment Table

    const [tooltipData, setTooltipData] = useState(null); 
    const [hoveredFacilityData, setHoveredFacilityData] = useState(null); 
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [showFacilityMarkers, setShowFacilityMarkers] = useState(true);
    
    // Refs
    const mapContainerRef = useRef(null);
    const fullscreenMapContainerRef = useRef(null);
    const dashboardSectionRef = useRef(null);
    const fullscreenModalRef = useRef(null);
    const coverageTableRef = useRef(null); // Ref for Coverage Table
    const equipmentTableRef = useRef(null); // Ref for Equipment Table
    
    // --- Polling useEffect for Incremental Facility Fetch (15 minutes) ---
    useEffect(() => {
        if (allFacilities !== null && allFacilities.length > 0) {
            const intervalId = setInterval(() => {
                console.log("Polling for new facility data (Neonatal Dashboard)...");
                fetchHealthFacilities(false, true); 
            }, 15 * 60 * 1000); 

            return () => clearInterval(intervalId);
        }
    }, [allFacilities, fetchHealthFacilities]);
    // --- END Polling ---

    const filteredNationalFacilities = useMemo(() => allFacilities?.filter(f => f['الولاية'] !== 'إتحادي') || [], [allFacilities]);

    const isFacilitySupposedToProvideCare = useCallback((f) => {
        const pediatricOrCEmONC = ['CEmONC', 'pediatric'].includes(f.eenc_service_type);
        const hasNeonatalCare = f.neonatal_level_of_care?.primary || f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary;
        return pediatricOrCEmONC || hasNeonatalCare;
    }, []);

    const hasFunctioningSCNU = useCallback((f) => f['هل_المؤسسة_تعمل'] === 'Yes' && f.neonatal_level_of_care?.secondary, []);

    // --- MODIFICATION: Create DENOMINATOR base list (location filter only) ---
    const locationFilteredFacilities = useMemo(() => {
        return (allFacilities || []).filter(f => {
            if(f['الولاية'] === 'إتحادي') return false;
            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;
            return true;
        });
    }, [allFacilities, stateFilter, localityFilter]); 
    // --- END MODIFICATION ---

    // --- MODIFICATION: Create NUMERATOR base list (location + equipment filter) ---
    const filteredFacilities = useMemo(() => {
        if (!equipmentFilter) {
            return locationFilteredFacilities; 
        }
        return locationFilteredFacilities.filter(f => {
            return (Number(f[equipmentFilter]) || 0) > 0;
        });
    }, [locationFilteredFacilities, equipmentFilter]); 
    // --- END MODIFICATION ---

    const hospitalsWithSCNU = useMemo(() => filteredFacilities.filter(hasFunctioningSCNU), [filteredFacilities, hasFunctioningSCNU]);

    // --- MODIFICATION: Update kpiData to use correct lists ---
    const kpiData = useMemo(() => {
        let totalLocalitiesCount;
        if (stateFilter) {
            totalLocalitiesCount = STATE_LOCALITIES[stateFilter]?.localities.length || 0;
        } else {
            totalLocalitiesCount = Object.entries(STATE_LOCALITIES)
                .filter(([stateKeyAbbr]) => stateKeyAbbr !== 'إتحادي')
                .reduce((a, [, s]) => a + s.localities.length, 0);
        }

        // NUMERATOR (uses equipment-filtered list)
        const functioningScnus = filteredFacilities.filter(hasFunctioningSCNU);
        const localitiesWithScnuSet = new Set(functioningScnus.map(f => `${f['الولاية']}-${f['المحلية']}`));
        
        // DENOMINATOR (uses location-filtered list)
        const totalSupposedFacilities = locationFilteredFacilities.filter(isFacilitySupposedToProvideCare).length;
        
        const totalFunctioningScnusCount = functioningScnus.length;
        const facilitiesWithCpapCount = functioningScnus.filter(f => (Number(f['neonatal_cpap']) || 0) > 0).length;
        const cpapPercentage = totalFunctioningScnusCount > 0 ? Math.round((facilitiesWithCpapCount / totalFunctioningScnusCount) * 100) : 0;
        const localitiesWithScnuCount = localitiesWithScnuSet.size;
        const localityCoveragePercentage = totalLocalitiesCount > 0 ? Math.round((localitiesWithScnuCount / totalLocalitiesCount) * 100) : 0;

        return {
            totalSupposed: totalSupposedFacilities, // <-- DENOMINATOR
            totalWithSCNU: totalFunctioningScnusCount, // <-- NUMERATOR
            scnuCoveragePercentage: totalSupposedFacilities > 0 ? Math.round((totalFunctioningScnusCount / totalSupposedFacilities) * 100) : 0,
            totalLocalitiesCount: totalLocalitiesCount,
            totalLocalitiesWithSCNU: localitiesWithScnuCount,
            localityCoveragePercentage: localityCoveragePercentage,
            totalWithCPAP: facilitiesWithCpapCount,
            cpapPercentage: cpapPercentage,
        };
    }, [filteredFacilities, locationFilteredFacilities, stateFilter, hasFunctioningSCNU, isFacilitySupposedToProvideCare]); 
    // --- END MODIFICATION ---

    const allLocalitiesCoverageData = useMemo(() => { const s={};Object.entries(STATE_LOCALITIES).forEach(([sK,sD])=>{if(sK==='إتحادي')return;sD.localities.forEach(l=>{const k=l.en;s[k]={key:k,name:l.ar,state:sK,totalSupposed:0,totalWithSCNU:0};});});filteredNationalFacilities.forEach(f=>{const k=f['المحلية'];if(!k||!s[k])return;if(isFacilitySupposedToProvideCare(f))s[k].totalSupposed++;if(hasFunctioningSCNU(f))s[k].totalWithSCNU++;});return Object.values(s).map(l=>({...l,coverage:l.totalSupposed>0?Math.round((l.totalWithSCNU/l.totalSupposed)*100):0,})); }, [filteredNationalFacilities, isFacilitySupposedToProvideCare, hasFunctioningSCNU]);

    const isLocalityView = !!stateFilter;
    const aggregationLevelName = isLocalityView ? 'Locality' : 'State';

    // --- MODIFICATION: Update stateData to use correct lists ---
    const { nationalAverageRow, stateData } = useMemo(() => {
        // National Calculations 
        const allFunctioningScnusNational = filteredNationalFacilities.filter(hasFunctioningSCNU);
        const natLS = new Set(allFunctioningScnusNational.map(f => `${f['الولاية']}-${f['المحلية']}`));
        const totNL = Object.entries(STATE_LOCALITIES)
            .filter(([stateKeyAbbr]) => stateKeyAbbr !== 'إتحادي')
            .reduce((a, [, s]) => a + s.localities.length, 0);
        const natTS = filteredNationalFacilities.filter(isFacilitySupposedToProvideCare).length;
        const natTW = allFunctioningScnusNational.length;
        const natAR = { name: 'National Average', key: 'national', totalSupposed: natTS, totalWithSCNU: natTW, coverage: natTS > 0 ? Math.round((natTW / natTS) * 100) : 0, localitiesWithSCNUCount: natLS.size, totalLocalities: totNL, localityCoverage: totNL > 0 ? Math.round((natLS.size / totNL) * 100) : 0, };

        // State/Locality Data
        const sum = {};
        const aggF = isLocalityView ? 'المحلية' : 'الولاية';

        // DENOMINATOR loop 
        locationFilteredFacilities.forEach(f => {
            const key = f[aggF];
            if (!key || key === 'إتحادي') return;
            if (!sum[key]) {
                let name = isLocalityView ? (STATE_LOCALITIES[stateFilter]?.localities.find(l => l.en === key)?.ar || key) : (STATE_LOCALITIES[key]?.ar || key);
                let totL = isLocalityView ? 1 : (STATE_LOCALITIES[key]?.localities.length || 0);
                sum[key] = { name, key, totalSupposed: 0, totalWithSCNU: 0, localitiesWithSCNUSet: new Set(), totalLocalities: totL };
            }
            if (isFacilitySupposedToProvideCare(f)) sum[key].totalSupposed++;
        });

        // NUMERATOR loop 
        filteredFacilities.forEach(f => { 
            const key = f[aggF];
            if (!key || key === 'إتحادي' || !sum[key]) return; 

            if (hasFunctioningSCNU(f)) {
                sum[key].totalWithSCNU++;
                if (!isLocalityView) sum[key].localitiesWithSCNUSet.add(f['المحلية']);
            }
        });

        const sD = Object.values(sum).map(s => { const lC = isLocalityView ? (s.totalWithSCNU > 0 ? 1 : 0) : s.localitiesWithSCNUSet.size; return { ...s, coverage: s.totalSupposed > 0 ? Math.round((s.totalWithSCNU / s.totalSupposed) * 100) : 0, localitiesWithSCNUCount: lC, localityCoverage: s.totalLocalities > 0 ? Math.round((lC / s.totalLocalities) * 100) : 0 }; });
        return { nationalAverageRow: natAR, stateData: sD };
    }, [filteredNationalFacilities, locationFilteredFacilities, filteredFacilities, stateFilter, isLocalityView, hasFunctioningSCNU, isFacilitySupposedToProvideCare]); 
    // --- END MODIFICATION ---

    const handleSort = (key) => { let d=(sortConfig.key===key&&sortConfig.direction==='descending')?'ascending':'descending';setSortConfig({key,direction:d}); };
    const sortedTableData = useMemo(() => { const items=[...stateData];items.sort((a,b)=>{if(a[sortConfig.key]<b[sortConfig.key])return sortConfig.direction==='ascending'?-1:1;if(a[sortConfig.key]>b[sortConfig.key])return sortConfig.direction==='ascending'?1:-1;return 0;});return items; }, [stateData, sortConfig]);
    const getEquipmentSummary = useCallback((stateKey) => { if(isLocalityView)return null;const rel=filteredNationalFacilities.filter(f=>f['الولاية']===stateKey&&hasFunctioningSCNU(f));const sum={};NEONATAL_EQUIPMENT_KEYS.forEach(k=>{sum[NEONATAL_EQUIPMENT_SPEC[k]]=0;});rel.forEach(f=>{NEONATAL_EQUIPMENT_KEYS.forEach(k=>{sum[NEONATAL_EQUIPMENT_SPEC[k]]+=(Number(f[k])||0);});});return{totalUnits:rel.length,summary:sum}; }, [filteredNationalFacilities, isLocalityView, hasFunctioningSCNU]);
    const getLocalityEquipmentSummary = useCallback((localityKey, stateKey) => { if(!stateKey||!localityKey){return{totalUnits:0,summary:Object.fromEntries(NEONATAL_EQUIPMENT_KEYS.map(k=>[NEONATAL_EQUIPMENT_SPEC[k],0]))};} const rel=filteredNationalFacilities.filter(f=>f['الولاية']===stateKey&&f['المحلية']===localityKey&&hasFunctioningSCNU(f));const sum={};NEONATAL_EQUIPMENT_KEYS.forEach(k=>{sum[NEONATAL_EQUIPMENT_SPEC[k]]=0;});rel.forEach(f=>{NEONATAL_EQUIPMENT_KEYS.forEach(k=>{sum[NEONATAL_EQUIPMENT_SPEC[k]]+=(Number(f[k])||0);});});return{totalUnits:rel.length,summary:sum}; }, [filteredNationalFacilities, hasFunctioningSCNU]);

    // Equipment table data
    const equipmentTableData = useMemo(() => {
        const isH = !!stateFilter;
        const aggK = isH ? 'اسم_المؤسسة' : 'الولاية';
        const dL = 30; const oL = 60;
        const facP = filteredFacilities.filter(f => hasFunctioningSCNU(f)); 
        const sum = {};
        facP.forEach(f => {
            const key = f[aggK];
            if (!key || key === 'إتحادي') return;
            if (!sum[key]) {
                let name = isH ? f['اسم_المؤسسة'] : (STATE_LOCALITIES[key]?.ar || key);
                sum[key] = { name, key, hasData: false, ...Object.fromEntries(NEONATAL_EQUIPMENT_KEYS.map(k => [k, 0])) };
            }
            NEONATAL_EQUIPMENT_KEYS.forEach(eK => {
                const fV = Number(f[eK]) || 0;
                sum[key][eK] += fV;
                if (fV > 0) sum[key].hasData = true;
            });
        });
        let allR = Object.values(sum).filter(s => s.key !== 'إتحادي');
        allR.sort((a, b) => (b.neonatal_total_beds || 0) - (a.neonatal_total_beds || 0));
        const rWd = allR.filter(r => r.hasData);
        const rWoD = allR.filter(r => !r.hasData);
        const fRWd = rWd.slice(0, dL);
        const rL = oL - fRWd.length;
        const fRWoD = rWoD.slice(0, rL); 
        return [...fRWd, ...fRWoD];
    }, [filteredFacilities, stateFilter, hasFunctioningSCNU]);

    const facilityLocationMarkers = useMemo(() => hospitalsWithSCNU.filter(f=>f['_الإحداثيات_longitude']&&f['_الإحداثيات_latitude']).map(f=>({key:f.id,name:f['اسم_المؤسسة'],coordinates:[f['_الإحداثيات_longitude'],f['_الإحداثيات_latitude']]})), [hospitalsWithSCNU]);
    
    const mapViewConfig = useMemo(() => { const sC=stateFilter?mapCoordinates[stateFilter]:null;if(sC)return{center:[sC.lng,sC.lat],scale:sC.scale,focusedState:stateFilter};return{center:[30,15.5],scale:2000,focusedState:null}; }, [stateFilter]);
    const fullscreenMapViewConfig = useMemo(() => ({ ...mapViewConfig }), [mapViewConfig]);
    const nationalMapData = useMemo(() => { const s={};filteredNationalFacilities.forEach(f=>{const k=f['الولاية'];if(!k||k==='إتحادي')return;if(!s[k])s[k]={totalSupposed:0,totalWithSCNU:0};if(isFacilitySupposedToProvideCare(f))s[k].totalSupposed++;if(hasFunctioningSCNU(f))s[k].totalWithSCNU++;});return Object.entries(s).map(([sK,c])=>({state:sK,percentage:c.totalSupposed>0?Math.round((c.totalWithSCNU/c.totalSupposed)*100):0,coordinates:mapCoordinates[sK]?[mapCoordinates[sK].lng,mapCoordinates[sK].lat]:[0,0]})); }, [filteredNationalFacilities, isFacilitySupposedToProvideCare, hasFunctioningSCNU]);
    const handleStateChange = (e) => { setStateFilter(e.target.value); setLocalityFilter(''); };

     const coverageTableHeaders = [
        {key:'name',label:aggregationLevelName,class:'w-[25%]'},
        {key:'totalSupposed',label:'total pediatric and Comperhensive EmONC',class:'w-[15%] text-center'},
        {key:'totalWithSCNU',label:'Facilities with SCNU',class:'w-[15%] text-center'},
        {key:'coverage',label:'Facility Coverage (%)',class:'w-[17%] text-left'},
        {key:'localitiesWithSCNUCount',label:'Localities with SCNU',class:'w-[10%] text-center'},
        {key:'localityCoverage',label:'Locality Coverage (%)',class:'w-[18%] text-left'}
    ];

    const tableHeadersJsx = coverageTableHeaders.map(h => {
        const isSortable = h.key === 'coverage' || h.key === 'localityCoverage';
        return (
            <th
                key={h.key}
                onClick={isSortable ? () => handleSort(h.key) : undefined}
                className={`py-3 px-4 font-semibold tracking-wider border border-gray-200 bg-gray-100 ${isSortable ? 'cursor-pointer' : ''} ${h.class}`}
            >
                {h.label}
                {isSortable && (sortConfig.key === h.key ? <SortIcon direction={sortConfig.direction} /> : <SortIcon />)}
            </th>
        );
    });

    const selectedStateData = useMemo(() => { if(!stateFilter)return{stateName:'All States',coverage:null};const sE=stateData.find(d=>d.key===stateFilter);const sAN=STATE_LOCALITIES[stateFilter]?.ar||stateFilter;return{stateName:sAN,coverage:sE?sE.coverage:'N/A'}; }, [stateFilter, stateData]);
    const dynamicTitlePrefix = isLocalityView ? `${selectedStateData.stateName} (${selectedStateData.coverage}%) - ` : '';
    const equipmentTitlePrefix = isLocalityView ? ` (${selectedStateData.stateName})` : '';
    
    // --- LAYOUT ADJUSTMENT FOR VISIBILITY ---
    // Removed fixed widths like w-32, w-12 to allow flex/table-fixed to distribute.
    // Reduced padding and font size significantly.
    const isEquipmentByHospital = !!stateFilter && !localityFilter;
    const equipmentHeaders = [isEquipmentByHospital?'Hospital Name':aggregationLevelName, ...Object.values(NEONATAL_EQUIPMENT_SPEC)];
    
    const currentMapViewLevel = isLocalityView ? 'locality' : mapViewLevel;

    // Tooltip Handlers
     const handleStateHover = useCallback((key, event) => {
        const rowData = key === 'national' ? nationalAverageRow : stateData.find(d => d.key === key);
        if (!rowData || isLocalityView || mapViewLevel === 'locality') return;
        const equipmentSummary = getEquipmentSummary(rowData.key);
        setTooltipData({
            title: `${rowData.name}${rowData.key !== 'national' ? ` (${rowData.key})` : ''}`,
            dataRows: [
                { label: "Facility Coverage", value: `${rowData.coverage}% (${rowData.totalWithSCNU} / ${rowData.totalSupposed})` },
                { label: "Locality Coverage", value: `${rowData.localityCoverage}% (${rowData.localitiesWithSCNUCount} / ${rowData.totalLocalities})` }
            ],
            equipmentSummary: { ...equipmentSummary, title: "SCNU Equipment Summary" }
        });
        setHoverPosition({ x: event.clientX, y: event.clientY });
    }, [stateData, nationalAverageRow, isLocalityView, mapViewLevel, getEquipmentSummary]);


    const handleMapLocalityHover = useCallback((geoProps, event) => { const localityKey=geoProps.admin_2;if(!localityKey)return;let dataStore=isLocalityView?stateData:allLocalitiesCoverageData;const localityData=dataStore.find(l=>l.key===localityKey);if(localityData){const stateKey=isLocalityView?stateFilter:localityData.state;const equipmentSummary=getLocalityEquipmentSummary(localityKey,stateKey);setTooltipData({title:`${localityData.name} (${localityData.key})`,dataRows:[{label:"Facility Coverage",value:`${localityData.coverage}% (${localityData.totalWithSCNU} / ${localityData.totalSupposed})`}],equipmentSummary:{...equipmentSummary,title:"SCNU Equipment Summary"}});setHoverPosition({x:event.clientX,y:event.clientY});} }, [isLocalityView, stateData, allLocalitiesCoverageData, stateFilter, getLocalityEquipmentSummary]);
    const handleMapMouseLeave = useCallback(() => { setTooltipData(null); }, []);
    const getFacilityEquipmentDetails = useCallback((facilityId) => { const facility=(allFacilities || []).find(f=>f.id===facilityId);if(!facility)return null;const summary={};NEONATAL_EQUIPMENT_KEYS.forEach(key=>{summary[NEONATAL_EQUIPMENT_SPEC[key]]=Number(facility[key])||0;});return{name:facility['اسم_المؤسسة'],summary:summary}; }, [allFacilities]);
    const handleFacilityHover = useCallback((facilityId, event) => { const details=getFacilityEquipmentDetails(facilityId);if(details){setHoveredFacilityData(details);setHoverPosition({x:event.clientX,y:event.clientY});} }, [getFacilityEquipmentDetails]);
    const handleFacilityLeave = useCallback(() => { setHoveredFacilityData(null); }, []);
    const handleMouseMove = useCallback((event) => { if (tooltipData || hoveredFacilityData) { setHoverPosition({ x: event.clientX, y: event.clientY }); } }, [tooltipData, hoveredFacilityData]);

    const handleDownloadMap = useCallback((format = 'jpg') => {
        const targetRef = isMapFullscreen ? fullscreenModalRef : dashboardSectionRef;
        if (targetRef.current) { 
            html2canvas(targetRef.current, { 
                useCORS: true, 
                scale: 2, 
                backgroundColor: '#ffffff',
                ignoreElements: (element) => element.classList.contains('ignore-for-export')
            }).then(canvas => { 
                const baseName = isMapFullscreen ? 'scnu-map-fullscreen' : 'scnu-dashboard';
                const filename = `${baseName}-${stateFilter || 'sudan'}.${format}`; 
                if (format === 'pdf') { 
                    const imgData = canvas.toDataURL('image/jpeg', 0.9); 
                    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] }); 
                    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height); 
                    pdf.save(filename); 
                } else { 
                    const image = canvas.toDataURL("image/jpeg", 0.9); 
                    const link = document.createElement('a'); 
                    link.href = image; 
                    link.download = filename; 
                    document.body.appendChild(link); 
                    link.click(); 
                    document.body.removeChild(link); 
                } 
            }).catch(err => console.error("Error generating map image:", err)); 
        }
    }, [stateFilter, currentMapViewLevel, isMapFullscreen, dashboardSectionRef, fullscreenModalRef]); 

    const handleCopyImage = useCallback(async () => {
        const targetRef = dashboardSectionRef;
        if (targetRef.current && navigator.clipboard?.write) {
            setCopyStatus('Copying...');
            try {
                const canvas = await html2canvas(targetRef.current, {
                    useCORS: true, scale: 2, backgroundColor: '#ffffff', logging: false,
                    ignoreElements: (element) => element.classList.contains('ignore-for-export')
                });
                canvas.toBlob(async (blob) => { if (blob) { await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]); setCopyStatus('Copied!'); } else { throw new Error('Canvas to Blob failed'); } }, 'image/png', 0.95);
            } catch (err) { console.error("Failed to copy image:", err); setCopyStatus('Failed'); }
            finally { setTimeout(() => setCopyStatus(''), 2000); }
        } else { console.error("Clipboard API not available or target element not found."); setCopyStatus('Failed'); setTimeout(() => setCopyStatus(''), 2000); }
    }, []);

    const mapLocationName = stateFilter ? STATE_LOCALITIES[stateFilter]?.ar || stateFilter : 'Sudan';
    const mapTitle = `Functioning Special Care Newborn Unit in (${mapLocationName}) (${kpiData.totalWithSCNU} out of ${kpiData.totalSupposed}, ${kpiData.scnuCoveragePercentage}%)`;


    return (
        <div onMouseMove={handleMouseMove}>

            <div ref={dashboardSectionRef} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch relative">

                <div className="flex flex-col gap-6 lg:col-span-1">
                    <Card className="ignore-for-export">
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <FormGroup label="State">
                                <Select value={stateFilter} onChange={handleStateChange}>
                                    <option value="">All States</option>
                                    {Object.keys(STATE_LOCALITIES).filter(s => s !== 'إتحادي').sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Locality">
                                <Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}>
                                    <option value="">All Localities</option>
                                    {stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Has Equipment">
                                <Select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}>
                                    <option value="">Any</option>
                                    {Object.entries(NEONATAL_EQUIPMENT_SPEC).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                        </div>
                    </Card>

                    {loading ? <Spinner/> : (
                        <>
                            <TotalCountCard title="Total Pediatrics and Comprehensive EmONC Hospital" count={kpiData.totalSupposed}/>
                            <ValueOutOfTotalPercentageCard_V2
                                title="Total Number of Functioning special care newborn units (SCNU)"
                                value={kpiData.totalWithSCNU}
                                total={kpiData.totalSupposed}
                                percentage={kpiData.scnuCoveragePercentage}
                            />
                             <ValueTotalPercentageCard
                                title="Localities with at least one SCNU"
                                value={kpiData.totalLocalitiesWithSCNU}
                                total={kpiData.totalLocalitiesCount}
                                percentage={kpiData.localityCoveragePercentage}
                            />
                            <ValueTotalPercentageCard
                                title="Facilities with at least one CPAP"
                                value={kpiData.totalWithCPAP}
                                total={kpiData.totalWithSCNU}
                                percentage={kpiData.cpapPercentage}
                            />
                        </>
                    )}
                </div>
                
                 {loading ? <div className="lg:col-span-2 flex justify-center items-center h-64"><Spinner/></div> : (
                    <Card className="p-0 flex flex-col flex-grow lg:col-span-2">
                         <div className="p-4 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center flex-shrink-0 gap-2 sm:gap-0">
                            <h3 className="text-xl font-medium text-gray-700 text-left sm:text-center">SCNU Geographical Distribution</h3>
                            <div className="flex items-center flex-wrap justify-start sm:justify-end gap-1 w-full sm:w-auto ignore-for-export">
                                {!isLocalityView && (
                                    <>
                                        <div className="text-sm font-medium text-gray-500">View:</div>
                                        <div className="flex rounded-md shadow-sm">
                                            <button onClick={() => setMapViewLevel('state')} className={`px-2 py-1 text-xs font-semibold rounded-l-md ${mapViewLevel === 'state' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>State</button>
                                            <button onClick={() => setMapViewLevel('locality')} className={`px-2 py-1 text-xs font-semibold rounded-r-md border-l border-gray-300 ${mapViewLevel === 'locality' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Locality</button>
                                        </div>
                                    </>
                                )}
                                <button onClick={() => handleDownloadMap('jpg')} title="Download Map as JPG" className="ml-1 px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">JPG</button>
                                <button onClick={() => handleDownloadMap('pdf')} title="Download Map as PDF" className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">PDF</button>
                                <button
                                    onClick={handleCopyImage}
                                    title="Copy Dashboard Image"
                                    disabled={!!copyStatus && copyStatus !== 'Failed'}
                                    className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors relative min-w-[70px] text-center disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {copyStatus || 'Copy Image'}
                                </button>
                                <button
                                    onClick={() => setShowFacilityMarkers(!showFacilityMarkers)}
                                    title={showFacilityMarkers ? "Hide Facilities" : "Show Facilities"}
                                    className={`ml-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        showFacilityMarkers ? 'bg-sky-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {showFacilityMarkers ? 'Hide' : 'Show'} Facilities
                                </button>
                                <button onClick={() => setIsMapFullscreen(true)} className="px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-100 rounded-md hover:bg-sky-200 transition-colors">Full</button>
                            </div>
                        </div>

                        <div ref={mapContainerRef} className="flex-grow flex flex-col bg-white">
                            <h4 className="text-center text-lg font-bold text-gray-600 py-1 flex-shrink-0">{mapTitle}</h4>
                            <MapLegend />
                            <div className="flex-grow min-h-[450px]">
                                <div className='flex-grow min-h-0 h-full'>
                                    <SudanMap
                                        data={!isLocalityView && currentMapViewLevel === 'state' ? nationalMapData : []}
                                        localityData={isLocalityView ? stateData : (currentMapViewLevel === 'locality' ? allLocalitiesCoverageData : [])}
                                        facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []}
                                        viewLevel={currentMapViewLevel}
                                        {...mapViewConfig}
                                        onStateHover={handleStateHover} onStateLeave={handleMapMouseLeave}
                                        onFacilityHover={handleFacilityHover} onFacilityLeave={handleFacilityLeave}
                                        onLocalityHover={handleMapLocalityHover} onLocalityLeave={handleMapMouseLeave}
                                        isMovable={false}
                                        pannable={false}
                                     />
                                </div>
                            </div>
                        </div>
                    </Card>
                 )}
            </div>
            
            {!loading && (
            <>
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-1 gap-6 items-stretch relative">
                    <Card className="p-0 flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-700">{dynamicTitlePrefix}SCNU Coverage by {aggregationLevelName} (Facility & Locality)</h3>
                            <button
                                onClick={() => copyTableToClipboard(coverageTableRef, setTable1CopyStatus)}
                                className="px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 transition-colors"
                            >
                                {table1CopyStatus || 'Copy Table'}
                            </button>
                        </div>
                        <div className="flex-grow relative overflow-x-auto">
                           <table ref={coverageTableRef} className='min-w-full table-fixed text-sm'>
                                <thead><tr>{tableHeadersJsx}</tr></thead>
                                <tbody>
                                    {!isLocalityView && nationalAverageRow && (
                                        <tr key="national-average" className="bg-slate-100 font-bold text-slate-800">
                                            <td className="p-2 whitespace-nowrap w-[25%]">{nationalAverageRow.name}</td>
                                            <td className="p-2 text-center w-[15%]">{nationalAverageRow.totalSupposed}</td>
                                            <td className="p-2 text-center w-[15%]">{nationalAverageRow.totalWithSCNU}</td>
                                            <td className="p-2 w-[17%]">{getCoverageBar(nationalAverageRow.coverage)}</td>
                                            <td className="p-2 text-center w-[10%]">{nationalAverageRow.localitiesWithSCNUCount}</td>
                                            <td className="p-2 w-[18%]">{getCoverageBar(nationalAverageRow.localityCoverage)}</td>
                                        </tr>
                                    )}
                                    {sortedTableData.map(row => (
                                        <tr key={row.key} className='hover:bg-blue-50 transition-colors cursor-pointer relative' onMouseEnter={(e) => handleStateHover(row.key, e)} onMouseLeave={handleMapMouseLeave} >
                                            <td className="p-2 whitespace-nowrap font-medium text-gray-800 w-[25%]">{row.name}</td>
                                            <td className="p-2 text-center w-[15%]">{row.totalSupposed}</td>
                                            <td className="p-2 text-center w-[15%]">{row.totalWithSCNU}</td>
                                            <td className="p-2 w-[17%]">{getCoverageBar(row.coverage)}</td>
                                            <td className="p-2 text-center w-[10%]">{row.localitiesWithSCNUCount}</td>
                                            <td className="p-2 w-[18%]">{getCoverageBar(row.localityCoverage)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div className="mt-6">
                    <Card>
                        <div className="p-4 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-medium text-gray-700">Neonatal Unit Equipment Availability by Unit{equipmentTitlePrefix}</h3>
                                <p className="text-sm text-gray-500 mt-1">Total number of equipment items available per facility/unit.</p>
                            </div>
                            <button
                                onClick={() => copyTableToClipboard(equipmentTableRef, setTable2CopyStatus)}
                                className="px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 transition-colors"
                            >
                                {table2CopyStatus || 'Copy Table'}
                            </button>
                        </div>
                        {/* MODIFICATION: Removed overflow-x-auto to force full visibility.
                            Changed table to 'w-full table-fixed' and reduced text size/padding significantly.
                        */}
                        <div className="w-full">
                            <table ref={equipmentTableRef} className="w-full table-fixed border-collapse text-[10px]">
                                <thead className="bg-gray-100">
                                    <tr>
                                        {equipmentHeaders.map((header, index) => ( 
                                            <th key={index} className={`p-1 text-left font-semibold tracking-wider border-b border-gray-200 bg-gray-100 align-bottom leading-tight ${index === 0 ? 'w-[15%]' : ''}`}> 
                                                <div className='font-bold break-words text-center'>{header}</div> 
                                            </th> 
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipmentTableData.map(row => ( 
                                        <tr key={row.name}>
                                            <td className="font-medium text-gray-800 p-1 break-words border-b border-gray-100 leading-tight">{row.name}</td>
                                            {NEONATAL_EQUIPMENT_KEYS.map(key => { 
                                                const value = row[key]; 
                                                const cellClass = value === 0 ? 'bg-red-200 font-bold' : ''; 
                                                return ( <td key={key} className={`p-1 ${cellClass} text-center border-b border-gray-100`}> {value} </td> ); 
                                            })}
                                        </tr> 
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {isMapFullscreen && (
                    <div ref={fullscreenModalRef} className="fixed inset-0 bg-white z-50 p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                             <h3 className="text-xl font-bold text-gray-800">{mapTitle}</h3>
                             <div className='flex items-center gap-1 ignore-for-export'>
                                <button onClick={() => handleDownloadMap('jpg')} title="Download Map as JPG" className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">JPG</button>
                                <button onClick={() => handleDownloadMap('pdf')} title="Download Map as PDF" className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">PDF</button>
                                <button onClick={() => setIsMapFullscreen(false)} className="px-4 py-2 text-sm font-bold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 ml-1">Close</button>
                             </div>
                        </div>
                        <div className="flex-grow min-h-0 flex gap-4">
                            <div ref={fullscreenMapContainerRef} className="flex-grow min-h-0 bg-white w-2/3">
                                <SudanMap
                                    data={nationalMapData}
                                    localityData={isLocalityView ? stateData : (currentMapViewLevel === 'locality' ? allLocalitiesCoverageData : [])}
                                    facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []}
                                    viewLevel={currentMapViewLevel}
                                    {...fullscreenMapViewConfig}
                                    onStateHover={handleStateHover} onStateLeave={handleMapMouseLeave}
                                    onFacilityHover={handleFacilityHover} onFacilityLeave={handleFacilityLeave}
                                    onLocalityHover={handleMapLocalityHover} onLocalityLeave={handleMapMouseLeave}
                                    isMovable={false}
                                    pannable={false}
                                />
                            </div>
                            <div className="w-1/3 flex flex-col border border-gray-200 rounded-lg">
                                <h4 className="text-lg font-semibold p-3 border-b bg-gray-50">Facilities with SCNU ({facilityLocationMarkers.length})</h4>
                                <div className="overflow-y-auto flex-grow min-h-0">
                                    <ul className="divide-y divide-gray-200">
                                        {facilityLocationMarkers.map(facility => (
                                            <li key={facility.key} className="p-3 text-sm">
                                                {facility.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {tooltipData && ( <div style={{ position: 'fixed', left: hoverPosition.x - 40, top: hoverPosition.y, pointerEvents: 'none', zIndex: 50 }}> <MapTooltip title={tooltipData.title} dataRows={tooltipData.dataRows} equipmentSummary={tooltipData.equipmentSummary} /> </div> )}
                {hoveredFacilityData && ( <div style={{ position: 'fixed', left: hoverPosition.x, top: hoverPosition.y, pointerEvents: 'none', zIndex: 51 }}> <FacilityTooltip data={hoveredFacilityData} /> </div> )}
            </>
            )}
        </div>
    );
};


export const EENCCoverageDashboard = () => {
    // --- MODIFICATION: Use DataContext and fetcher, adding fetchHealthFacilities ---
    const { healthFacilities: allFacilities, isLoading, fetchHealthFacilities } = useDataCache();
    const loading = isLoading.healthFacilities;
    // --- END MODIFICATION ---
    
    // Local state for filters and UI remains
    const [stateFilter, setStateFilter] = useState(''); 
    const [localityFilter, setLocalityFilter] = useState(''); 
    const [equipmentFilter, setEquipmentFilter] = useState('');
    const [mapViewLevel, setMapViewLevel] = useState('state');
    const [copyStatus, setCopyStatus] = useState('');
    const [tooltipData, setTooltipData] = useState(null); 
    const [hoveredFacilityData, setHoveredFacilityData] = useState(null); 
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [isMapFullscreen, setIsMapFullscreen] = useState(false);
    const [showFacilityMarkers, setShowFacilityMarkers] = useState(true);

    // Copy Table States
    const [table1CopyStatus, setTable1CopyStatus] = useState('');
    const [table2CopyStatus, setTable2CopyStatus] = useState('');

    const mapContainerRef = useRef(null);
    const fullscreenMapContainerRef = useRef(null);
    const dashboardSectionRef = useRef(null);
    const fullscreenModalRef = useRef(null);
    const coverageTableRef = useRef(null);
    const equipmentTableRef = useRef(null);
    
    // --- Polling useEffect for Incremental Facility Fetch (15 minutes) ---
    useEffect(() => {
        if (allFacilities !== null && allFacilities.length > 0) {
            const intervalId = setInterval(() => {
                console.log("Polling for new facility data (EENC Dashboard)...");
                fetchHealthFacilities(false, true); 
            }, 15 * 60 * 1000); 

            return () => clearInterval(intervalId);
        }
    }, [allFacilities, fetchHealthFacilities]);
    // --- END Polling ---

    const filteredNationalFacilities = useMemo(() => allFacilities?.filter(f => f['الولاية'] !== 'إتحادي') || [], [allFacilities]);
    const isEmONCFacility = useCallback((f) => { const s = f['eenc_service_type']; return s === 'BEmONC' || s === 'CEmONC'; }, []);
    const isEmONCFunctional = useCallback((f) => isEmONCFacility(f) && f['هل_المؤسسة_تعمل'] === 'Yes', [isEmONCFacility]);
    const providesEENC = useCallback((f) => isEmONCFacility(f) && f['eenc_provides_essential_care'] === 'Yes', [isEmONCFacility]);
    
    // --- MODIFICATION: Create DENOMINATOR base list (location filter only) ---
    const locationFilteredFacilities = useMemo(() => {
        return (allFacilities || []).filter(f => {
            if(f['الولاية'] === 'إتحادي') return false;
            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;
            return true;
        });
    }, [allFacilities, stateFilter, localityFilter]); 
    // --- END MODIFICATION ---
    
    // --- MODIFICATION: Rename old 'facilitiesByFilter' to 'facilitiesByFilter' (NUMERATOR)
    const facilitiesByFilter = useMemo(() => {
        if (!equipmentFilter) {
            return locationFilteredFacilities; 
        }
        return locationFilteredFacilities.filter(f => {
            return (Number(f[equipmentFilter]) || 0) > 0;
        });
    }, [locationFilteredFacilities, equipmentFilter]); 
    // --- END MODIFICATION ---

    // --- MODIFICATION: Update kpiData to use correct lists ---
    const kpiData = useMemo(() => {
        // DENOMINATOR (uses location-filtered list)
        const relevantFacilities = locationFilteredFacilities.filter(isEmONCFacility);
        const functionalFacilities = relevantFacilities.filter(isEmONCFunctional);

        // NUMERATOR (uses equipment-filtered list)
        const eencProviders = facilitiesByFilter.filter(isEmONCFunctional).filter(providesEENC);

        const totalEmONC = relevantFacilities.length;
        const totalFunctionalEmONC = functionalFacilities.length;
        const totalEENCProviders = eencProviders.length;
        const eencCoveragePercentage = totalFunctionalEmONC > 0 ? Math.round((totalEENCProviders / totalFunctionalEmONC) * 100) : 0;

        return {
            totalEmONC: totalEmONC, 
            totalFunctionalEmONC: totalFunctionalEmONC, 
            totalEENCProviders: totalEENCProviders, 
            eencCoveragePercentage: eencCoveragePercentage
        };
    }, [facilitiesByFilter, locationFilteredFacilities, isEmONCFacility, isEmONCFunctional, providesEENC]); 
    // --- END MODIFICATION ---

    const allLocalitiesCoverageDataEENC = useMemo(() => { const s={};Object.entries(STATE_LOCALITIES).forEach(([sK,sD])=>{if(sK==='إتحادي')return;sD.localities.forEach(l=>{s[l.en]={key:l.en,name:l.ar,state:sK,totalEmONC:0, functionalEmONC: 0, eencProviders:0};});});filteredNationalFacilities.forEach(f=>{const key=f['المحلية'];if(!key||!s[key])return;if(isEmONCFacility(f)){s[key].totalEmONC++; if(isEmONCFunctional(f)){ s[key].functionalEmONC++; if(providesEENC(f)){s[key].eencProviders++;} } }});return Object.values(s).map(l=>({...l,coverage:l.functionalEmONC>0?Math.round((l.eencProviders/l.functionalEmONC)*100):0})); }, [filteredNationalFacilities, isEmONCFacility, isEmONCFunctional, providesEENC]);

    // --- MODIFICATION: Update tableData to use correct lists ---
    const { tableData, mapData } = useMemo(() => {
        const s = {};
        const aggF = stateFilter ? 'المحلية' : 'الولاية';

        // DENOMINATOR loop 
        locationFilteredFacilities.forEach(f => {
            const key = f[aggF];
            if (!key || key === 'إتحادي') return;
            if (!s[key]) {
                let name = stateFilter ? (STATE_LOCALITIES[stateFilter]?.localities.find(l => l.en === key)?.ar || key) : (STATE_LOCALITIES[key]?.ar || key);
                s[key] = { name, key, totalEmONC: 0, functionalEmONC: 0, eencProviders: 0 };
            }
            if (isEmONCFacility(f)) {
                s[key].totalEmONC++;
                if (isEmONCFunctional(f)) {
                    s[key].functionalEmONC++;
                }
            }
        });

        // NUMERATOR loop 
        facilitiesByFilter.forEach(f => {
            const key = f[aggF];
            if (!key || key === 'إتحادي' || !s[key]) return; 

            if (isEmONCFunctional(f) && providesEENC(f)) {
                s[key].eencProviders++;
            }
        });
        
        const tD = Object.values(s).map(st => ({ ...st, eencCoverage: st.functionalEmONC > 0 ? Math.round((st.eencProviders / st.functionalEmONC) * 100) : 0 })).sort((a, b) => a.name.localeCompare(b.name));

        // Map data 
        const mapDataSource = stateFilter ? [] : filteredNationalFacilities;
        const mapS = {};
         mapDataSource.filter(isEmONCFacility).forEach(f => {
            const key = f['الولاية'];
            if (!key || key === 'إتحادي') return;
             if (!mapS[key]) mapS[key] = {functionalEmONC: 0, eencProviders: 0 };
              if (isEmONCFunctional(f)) {
                  mapS[key].functionalEmONC++;
                  if (providesEENC(f)) mapS[key].eencProviders++;
              }
         });
         const mD = Object.entries(mapS).map(([stKey, counts]) => ({
             state: stKey,
             percentage: counts.functionalEmONC > 0 ? Math.round((counts.eencProviders / counts.functionalEmONC) * 100) : 0,
             coordinates: mapCoordinates[stKey] ? [mapCoordinates[stKey].lng, mapCoordinates[stKey].lat] : [0, 0]
         }));

        return { tableData: tD, mapData: mD };
    }, [facilitiesByFilter, locationFilteredFacilities, filteredNationalFacilities, stateFilter, isEmONCFacility, isEmONCFunctional, providesEENC]); 
    // --- END MODIFICATION ---

    const equipmentTableData = useMemo(() => {
        const aggK=stateFilter?'اسم_المؤسسة':'الولاية';
        const facP=facilitiesByFilter.filter(f => isEmONCFunctional(f) && providesEENC(f)); 
        const s={};
        facP.forEach(f=>{
            const key=f[aggK];
            if(!key||key==='إتحادي')return;
            if(!s[key]){
                let name=stateFilter?f['اسم_المؤسسة']:(STATE_LOCALITIES[key]?.ar||key);
                s[key]={name,key,...Object.fromEntries(EENC_EQUIPMENT_KEYS.map(k=>[k,0]))};
            }
            EENC_EQUIPMENT_KEYS.forEach(eK=>{s[key][eK]+=(Number(f[eK])||0);});
        });
        let allR=Object.values(s).filter(st=>st.key!=='إتحادي');
        allR.sort((a,b)=>(b.eenc_delivery_beds||0)-(a.eenc_delivery_beds||0));
        return allR;
    }, [facilitiesByFilter, stateFilter, isEmONCFunctional, providesEENC]);

    const facilityLocationMarkers = useMemo(() => facilitiesByFilter.filter(f=> isEmONCFunctional(f) && providesEENC(f) &&f['_الإحداثيات_longitude']&&f['_الإحداثيات_latitude']).map(f=>({key:f.id,name:f['اسم_المؤسسة'],coordinates:[f['_الإحداثيات_longitude'],f['_الإحداثيات_latitude']]})), [facilitiesByFilter, isEmONCFunctional, providesEENC]);
    
    const mapViewConfig = useMemo(() => { const sC=stateFilter?mapCoordinates[stateFilter]:null;if(sC)return{center:[sC.lng,sC.lat],scale:sC.scale,focusedState:stateFilter};return{center:[30,15.5],scale:2000,focusedState:null}; }, [stateFilter]);
    const fullscreenMapViewConfig = useMemo(() => ({ ...mapViewConfig }), [mapViewConfig]);
    const handleStateChange = (e) => { setStateFilter(e.target.value); setLocalityFilter(''); };
    
    const getEENCStateEquipmentSummary = useCallback((stateKey)=>{ const rel=filteredNationalFacilities.filter(f=>f['الولاية']===stateKey&& isEmONCFunctional(f) &&providesEENC(f));const sum={};EENC_EQUIPMENT_KEYS.forEach(k=>{sum[EENC_EQUIPMENT_SPEC[k]]=0;});rel.forEach(f=>{EENC_EQUIPMENT_KEYS.forEach(k=>{sum[EENC_EQUIPMENT_SPEC[k]]+=(Number(f[k])||0);});});return{totalUnits:rel.length,summary:sum}; }, [filteredNationalFacilities, isEmONCFunctional, providesEENC]);
    const getEENCLocalityEquipmentSummary = useCallback((localityKey, stateKey)=>{ const rel=filteredNationalFacilities.filter(f=>f['الولاية']===stateKey&&f['المحلية']===localityKey&&isEmONCFunctional(f)&&providesEENC(f));const sum={};EENC_EQUIPMENT_KEYS.forEach(k=>{sum[EENC_EQUIPMENT_SPEC[k]]=0;});rel.forEach(f=>{EENC_EQUIPMENT_KEYS.forEach(k=>{sum[EENC_EQUIPMENT_SPEC[k]]+=(Number(f[k])||0);});});return{totalUnits:rel.length,summary:sum}; }, [filteredNationalFacilities, isEmONCFunctional, providesEENC]);
    const handleStateHover = useCallback((stateKey, event)=>{ if(stateFilter||mapViewLevel==='locality')return; const rowData=tableData.find(d=>d.key===stateKey); if(!rowData) return; const eqSum=getEENCStateEquipmentSummary(stateKey);setTooltipData({title:`${rowData.name} (${rowData.key})`,dataRows:[{label:"EENC Coverage",value:`${rowData.eencCoverage}% (${rowData.eencProviders} / ${rowData.functionalEmONC})`}],equipmentSummary:{...eqSum,title:"EENC Equipment Summary"}});setHoverPosition({x:event.clientX,y:event.clientY}); }, [tableData, stateFilter, mapViewLevel, getEENCStateEquipmentSummary]);
    const handleMapLocalityHover = useCallback((geoProps, event)=>{ const locKey=geoProps.admin_2;if (!locKey) return; let dataStore=stateFilter?tableData:allLocalitiesCoverageDataEENC;const locData=dataStore.find(l=>l.key===locKey);if(!locData)return;const stateKey=stateFilter?stateFilter:locData.state;const eqSum=getEENCLocalityEquipmentSummary(locKey,stateKey);const cov=locData.eencCoverage!==undefined?locData.eencCoverage:locData.coverage;setTooltipData({title:`${locData.name} (${locData.key})`,dataRows:[{label:"EENC Coverage",value:`${cov}% (${locData.eencProviders} / ${locData.functionalEmONC})`}],equipmentSummary:{...eqSum,title:"EENC Equipment Summary"}});setHoverPosition({x:event.clientX,y:event.clientY}); }, [tableData, stateFilter, allLocalitiesCoverageDataEENC, getEENCLocalityEquipmentSummary]);
    const getFacilityEquipmentDetails = useCallback((facilityId)=>{ const facility=(allFacilities || []).find(f=>f.id===facilityId);if(!facility)return null;const summary={};EENC_EQUIPMENT_KEYS.forEach(key=>{summary[EENC_EQUIPMENT_SPEC[key]]=Number(facility[key])||0;});return{name:facility['اسم_المؤسسة'],summary:summary}; }, [allFacilities]);
    const handleFacilityHover = useCallback((facilityId, event)=>{ const details=getFacilityEquipmentDetails(facilityId);if(details){setHoveredFacilityData(details);setHoverPosition({x:event.clientX,y:event.clientY});} }, [getFacilityEquipmentDetails]);
    const handleFacilityLeave = useCallback(()=>{ setHoveredFacilityData(null); }, []);
    const handleMapMouseLeave = useCallback(()=>{ setTooltipData(null); }, []);
    const handleMouseMove = useCallback((event)=>{ if(tooltipData||hoveredFacilityData){setHoverPosition({x:event.clientX,y:event.clientY});} }, [tooltipData, hoveredFacilityData]);

    const currentMapViewLevel = stateFilter ? 'locality' : mapViewLevel;

    const handleDownloadMap = useCallback((format = 'jpg') => {
        const targetRef = isMapFullscreen ? fullscreenModalRef : dashboardSectionRef; 
        if (targetRef.current) { 
            html2canvas(targetRef.current, { 
                useCORS: true, 
                scale: 2, 
                backgroundColor: '#ffffff',
                ignoreElements: (element) => element.classList.contains('ignore-for-export')
            }).then(canvas => { 
                const baseName = isMapFullscreen ? 'eenc-map-fullscreen' : 'eenc-dashboard';
                const filename = `${baseName}-${stateFilter || 'sudan'}.${format}`; 
                if (format === 'pdf') { 
                    const imgData = canvas.toDataURL('image/jpeg', 0.9); 
                    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] }); 
                    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height); 
                    pdf.save(filename); 
                } else { 
                    const image = canvas.toDataURL("image/jpeg", 0.9); 
                    const link = document.createElement('a'); 
                    link.href = image; 
                    link.download = filename; 
                    document.body.appendChild(link); 
                    link.click(); 
                    document.body.removeChild(link); 
                } 
            }).catch(err => console.error("Error generating map image:", err)); 
        }
    }, [stateFilter, currentMapViewLevel, isMapFullscreen, dashboardSectionRef, fullscreenModalRef]); 

    const handleCopyImage = useCallback(async () => {
        const targetRef = dashboardSectionRef;
        if (targetRef.current && navigator.clipboard?.write) {
            setCopyStatus('Copying...');
            try {
                const canvas = await html2canvas(targetRef.current, { 
                    useCORS: true, 
                    scale: 2, 
                    backgroundColor: '#ffffff', 
                    logging: false, 
                    ignoreElements: (element) => element.classList.contains('ignore-for-export') 
                });
                canvas.toBlob(async (blob) => { if (blob) { await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]); setCopyStatus('Copied!'); } else { throw new Error('Canvas to Blob failed'); } }, 'image/png', 0.95);
            } catch (err) { console.error("Failed to copy image:", err); setCopyStatus('Failed'); }
            finally { setTimeout(() => setCopyStatus(''), 2000); }
        } else { console.error("Clipboard API not available or target element not found."); setCopyStatus('Failed'); setTimeout(() => setCopyStatus(''), 2000); }
    }, []);

    const aggregationLevelName = stateFilter ? 'Locality' : 'State';
    const dynamicTitlePrefix = stateFilter ? `${STATE_LOCALITIES[stateFilter]?.ar || stateFilter} - ` : '';
    const mapLocationName = stateFilter ? STATE_LOCALITIES[stateFilter]?.ar || stateFilter : 'Sudan';
    const mapTitle = `EENC Coverage & Facility Locations in ${mapLocationName} (${facilityLocationMarkers.length})`;

    return (
        <div onMouseMove={handleMouseMove}>
            <PageHeader title="Early Essential Newborn Care (EENC) Coverage" subtitle="Key indicators for EmONC facilities providing EENC."/>

             <div ref={dashboardSectionRef} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch relative">

                 <div className="flex flex-col gap-6 lg:col-span-1">
                    <Card className="ignore-for-export">
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <FormGroup label="State">
                                <Select value={stateFilter} onChange={handleStateChange}>
                                    <option value="">All States</option>
                                    {Object.keys(STATE_LOCALITIES).filter(s => s !== 'إتحادي').sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Locality">
                                <Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}>
                                    <option value="">All Localities</option>
                                    {stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Has Equipment">
                                <Select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}>
                                    <option value="">Any</option>
                                    {Object.entries(EENC_EQUIPMENT_SPEC).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                        </div>
                    </Card>

                    {loading ? <Spinner/> : (
                        <>
                            <TotalCountCard title="Total EmONC Facilities" count={kpiData.totalEmONC}/>
                            <TotalCountCard title="Functional EmONC Facilities" count={kpiData.totalFunctionalEmONC}/>
                            <ValueTotalPercentageCard
                                title="EENC Coverage in Functional EmONC Facilities"
                                value={kpiData.totalEENCProviders}
                                total={kpiData.totalFunctionalEmONC}
                                percentage={kpiData.eencCoveragePercentage} />
                        </>
                    )}
                </div>

                 {loading ? <div className="lg:col-span-2 flex justify-center items-center h-64"><Spinner/></div> : (
                    <Card className="p-0 flex flex-col flex-grow lg:col-span-2">
                        <div className="p-4 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center flex-shrink-0 gap-2 sm:gap-0">
                            <h3 className="text-xl font-medium text-gray-700 text-left sm:text-center">EENC Geographical Distribution</h3>
                            <div className="flex items-center flex-wrap justify-start sm:justify-end gap-1 w-full sm:w-auto ignore-for-export">
                                {!stateFilter && (
                                     <>
                                        <div className="text-sm font-medium text-gray-500">View:</div>
                                        <div className="flex rounded-md shadow-sm">
                                            <button onClick={() => setMapViewLevel('state')} className={`px-2 py-1 text-xs font-semibold rounded-l-md ${mapViewLevel === 'state' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}> State </button>
                                            <button onClick={() => setMapViewLevel('locality')} className={`px-2 py-1 text-xs font-semibold rounded-r-md border-l border-gray-300 ${mapViewLevel === 'locality' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}> Locality </button>
                                        </div>
                                     </>
                                )}
                                <button onClick={() => handleDownloadMap('jpg')} title="Download Map as JPG" className="ml-1 px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">JPG</button>
                                <button onClick={() => handleDownloadMap('pdf')} title="Download Map as PDF" className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">PDF</button>
                                <button
                                    onClick={handleCopyImage}
                                    title="Copy Dashboard Image"
                                    disabled={!!copyStatus && copyStatus !== 'Failed'}
                                    className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors relative min-w-[70px] text-center disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {copyStatus || 'Copy Image'}
                                </button>
                                <button
                                    onClick={() => setShowFacilityMarkers(!showFacilityMarkers)}
                                    title={showFacilityMarkers ? "Hide Facilities" : "Show Facilities"}
                                    className={`ml-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        showFacilityMarkers ? 'bg-sky-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {showFacilityMarkers ? 'Hide' : 'Show'} Facilities
                                </button>
                                <button onClick={() => setIsMapFullscreen(true)} className="px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-100 rounded-md hover:bg-sky-200 transition-colors">Full</button>
                             </div>
                        </div>
                        <div ref={mapContainerRef} className="flex-grow flex flex-col bg-white">
                             <h4 className="text-center text-lg font-bold text-gray-600 py-1 flex-shrink-0">{mapTitle}</h4>
                             <MapLegend />
                            <div className='flex-grow min-h-[450px]'>
                                 <div className='flex-grow min-h-0 h-full'>
                                    <SudanMap
                                        data={!stateFilter && currentMapViewLevel === 'state' ? mapData : []}
                                        localityData={stateFilter ? tableData : (!stateFilter && currentMapViewLevel === 'locality' ? allLocalitiesCoverageDataEENC : [])}
                                        facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []}
                                        viewLevel={currentMapViewLevel}
                                        {...mapViewConfig}
                                        onStateHover={handleStateHover} onStateLeave={handleMapMouseLeave}
                                        onLocalityHover={handleMapLocalityHover} onLocalityLeave={handleMapMouseLeave}
                                        onFacilityHover={handleFacilityHover} onFacilityLeave={handleFacilityLeave}
                                        isMovable={false}
                                        pannable={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                 )}
            </div>
             
            {!loading && (
            <>
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-1 gap-6 items-stretch">
                    <Card className="p-0 flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-700">{dynamicTitlePrefix}EENC Coverage by {aggregationLevelName}</h3>
                            <button onClick={() => copyTableToClipboard(coverageTableRef, setTable1CopyStatus)} className="px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 transition-colors"> {table1CopyStatus || 'Copy Table'} </button>
                        </div>
                        <div className="flex-grow overflow-x-auto">
                            <table ref={coverageTableRef} className='min-w-full text-sm'>
                                <thead>
                                    <tr>
                                        <th className='py-3 px-4 font-semibold tracking-wider border border-gray-200 bg-gray-100 w-[20%]'>{aggregationLevelName}</th>
                                        <th className='py-3 px-4 font-semibold tracking-wider border border-gray-200 bg-gray-100 w-[15%] text-center'>Total EmONC</th>
                                        <th className='py-3 px-4 font-semibold tracking-wider border border-gray-200 bg-gray-100 w-[15%] text-center'>Functional EmONC</th>
                                        <th className='py-3 px-4 font-semibold tracking-wider border border-gray-200 bg-gray-100 w-[20%] text-center'>Facilities with EENC</th>
                                        <th className='py-3 px-4 font-semibold tracking-wider border border-gray-200 bg-gray-100 w-[30%] text-left'>EENC Coverage (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.map(row => ( <tr key={row.key} className='hover:bg-blue-50 transition-colors'><td className="p-2 whitespace-nowrap font-medium text-gray-800">{row.name}</td><td className="p-2 text-center">{row.totalEmONC}</td><td className="p-2 text-center">{row.functionalEmONC}</td><td className="p-2 text-center">{row.eencProviders}</td><td className="p-2">{getCoverageBar(row.eencCoverage)}</td></tr> ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div className="mt-6">
                    <Card>
                        <div className="p-4 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-medium text-gray-700">EENC Equipment Availability by Unit ({stateFilter ? 'Hospitals' : 'State'}){stateFilter ? ` in ${STATE_LOCALITIES[stateFilter]?.ar || stateFilter}` : ''}</h3>
                                <p className="text-sm text-gray-500 mt-1">Total number of equipment items available per facility/unit providing EENC.</p>
                            </div>
                            <button onClick={() => copyTableToClipboard(equipmentTableRef, setTable2CopyStatus)} className="px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 transition-colors"> {table2CopyStatus || 'Copy Table'} </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table ref={equipmentTableRef} className="min-w-full table-auto border-collapse">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className={`p-2 text-left font-semibold tracking-wider border-b border-gray-200 bg-gray-100 text-xs align-top w-40`}><div className='font-bold break-words text-center'>{stateFilter ? 'Hospital Name' : aggregationLevelName}</div></th>
                                        {Object.values(EENC_EQUIPMENT_SPEC).map((header, index) => ( <th key={index} className={`p-2 text-left font-semibold tracking-wider border-b border-gray-200 bg-gray-100 text-xs align-top w-20`}><div className='font-bold break-words text-center'>{header}</div></th> ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipmentTableData.map(row => ( <tr key={row.name}><td className={`font-medium text-gray-800 p-2 break-words`}>{row.name}</td>{EENC_EQUIPMENT_KEYS.map(key => { const value = row[key]; const cellClass = value === 0 ? 'bg-red-200 font-bold' : ''; return ( <td key={key} className={`p-2 ${cellClass} text-center`}> {value} </td> ); })}</tr> ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {isMapFullscreen && (
                    <div ref={fullscreenModalRef} className="fixed inset-0 bg-white z-50 p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                             <h3 className="text-xl font-bold text-gray-800">{mapTitle}</h3>
                             <div className='flex items-center gap-1 ignore-for-export'>
                                <button onClick={() => handleDownloadMap('jpg')} title="Download Map as JPG" className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">JPG</button>
                                <button onClick={() => handleDownloadMap('pdf')} title="Download Map as PDF" className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">PDF</button>
                                <button onClick={() => setIsMapFullscreen(false)} className="px-4 py-2 text-sm font-bold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 ml-1">Close</button>
                             </div>
                        </div>

                        <div className="flex-grow min-h-0 flex gap-4">
                            <div ref={fullscreenMapContainerRef} className="flex-grow min-h-0 bg-white w-2/3">
                                <SudanMap
                                    data={!stateFilter && currentMapViewLevel === 'state' ? mapData : []}
                                    localityData={stateFilter ? tableData : (!stateFilter && currentMapViewLevel === 'locality' ? allLocalitiesCoverageDataEENC : [])}
                                    facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []}
                                    viewLevel={currentMapViewLevel}
                                    {...fullscreenMapViewConfig}
                                    onStateHover={handleStateHover} onStateLeave={handleMapMouseLeave}
                                    onLocalityHover={handleMapLocalityHover} onLocalityLeave={handleMapMouseLeave}
                                    onFacilityHover={handleFacilityHover} onFacilityLeave={handleFacilityLeave}
                                    isMovable={false}
                                    pannable={false}
                                />
                            </div>

                            <div className="w-1/3 flex flex-col border border-gray-200 rounded-lg">
                                <h4 className="text-lg font-semibold p-3 border-b bg-gray-50">Facilities Providing EENC ({facilityLocationMarkers.length})</h4>
                                <div className="overflow-y-auto flex-grow min-h-0">
                                    <ul className="divide-y divide-gray-200">
                                        {facilityLocationMarkers.map(facility => (
                                            <li key={facility.key} className="p-3 text-sm">
                                                {facility.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {tooltipData && ( <div style={{ position: 'fixed', left: hoverPosition.x - 40, top: hoverPosition.y, pointerEvents: 'none', zIndex: 50 }}> <MapTooltip title={tooltipData.title} dataRows={tooltipData.dataRows} equipmentSummary={tooltipData.equipmentSummary} /> </div> )}
                {hoveredFacilityData && ( <div style={{ position: 'fixed', left: hoverPosition.x, top: hoverPosition.y, pointerEvents: 'none', zIndex: 51 }}> <FacilityTooltip data={hoveredFacilityData} /> </div> )}
            </>
            )}
        </div>
    );
};

export const IMNCICoverageDashboard = () => {
    // --- MODIFICATION: Use DataContext and fetcher, adding fetchHealthFacilities ---
    const { healthFacilities: allFacilities, isLoading, fetchHealthFacilities } = useDataCache();
    const loading = isLoading.healthFacilities;
    // --- END MODIFICATION ---
    
    // Local state for filters and UI remains
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [equipmentFilter, setEquipmentFilter] = useState('');
    const [mapViewLevel, setMapViewLevel] = useState('state');
    const [copyStatus, setCopyStatus] = useState('');
    const [tooltipData, setTooltipData] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [isMapFullscreen, setIsMapFullscreen] = useState(false);
    const [showFacilityMarkers, setShowFacilityMarkers] = useState(true);

    // Copy Table States
    const [table1CopyStatus, setTable1CopyStatus] = useState('');
    const [table2CopyStatus, setTable2CopyStatus] = useState('');

    const mapContainerRef = useRef(null);
    const fullscreenMapContainerRef = useRef(null);
    const dashboardSectionRef = useRef(null);
    const fullscreenModalRef = useRef(null);
    const coverageTableRef = useRef(null);
    const toolsTableRef = useRef(null);
    

    // --- Polling useEffect for Incremental Facility Fetch (15 minutes) ---
    useEffect(() => {
        if (allFacilities !== null && allFacilities.length > 0) {
            const intervalId = setInterval(() => {
                console.log("Polling for new facility data (IMNCI Dashboard)...");
                fetchHealthFacilities(false, true); 
            }, 15 * 60 * 1000); 

            return () => clearInterval(intervalId);
        }
    }, [allFacilities, fetchHealthFacilities]);
    // --- END Polling ---

    // --- MODIFICATION: Create DENOMINATOR base list (location filter only) ---
    const locationFilteredFacilities = useMemo(() => {
        return (allFacilities || []).filter(f => {
             if(f['الولاية'] === 'إتحادي') return false;
            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;
            return true;
        });
    }, [allFacilities, stateFilter, localityFilter]); 
    // --- END MODIFICATION ---

    // --- MODIFICATION: Create NUMERATOR base list (location + equipment filter) ---
    const filteredFacilities = useMemo(() => {
        if (!equipmentFilter) {
            return locationFilteredFacilities; 
        }
        return locationFilteredFacilities.filter(f => {
            return f[equipmentFilter] === 'Yes';
        });
    }, [locationFilteredFacilities, equipmentFilter]); 
    // --- END MODIFICATION ---

    // --- MODIFICATION: Update KPI hooks to use correct lists ---
    // DENOMINATOR for KPI
    const functioningPhcs = useMemo(() => locationFilteredFacilities.filter(f => f['هل_المؤسسة_تعمل'] === 'Yes' && (f['نوع_المؤسسةالصحية'] === 'وحدة صحة الاسرة' || f['نوع_المؤسسةالصحية'] === 'مركز صحة الاسرة')), [locationFilteredFacilities]);
    
    // NUMERATOR for KPI (filters by location, equipment, *and* service)
    const imnciInPhcs = useMemo(() => filteredFacilities.filter(f => 
        f['هل_المؤسسة_تعمل'] === 'Yes' && 
        (f['نوع_المؤسسةالصحية'] === 'وحدة صحة الاسرة' || f['نوع_المؤسسةالصحية'] === 'مركز صحة الاسرة') && 
        f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes'
    ), [filteredFacilities]);

    // KPI Percentage (Numerator / Denominator)
    const imnciCoveragePercentage = useMemo(() => functioningPhcs.length > 0 ? Math.round((imnciInPhcs.length / functioningPhcs.length) * 100) : 0, [imnciInPhcs, functioningPhcs]);
    // --- END MODIFICATION ---

    const isLocalityView = !!stateFilter;
    const aggregationLevelName = isLocalityView ? 'Locality' : 'State';

    const allLocalitiesCoverageDataIMNCI = useMemo(() => {
        const filteredNationalFacilities = (allFacilities || []).filter(f => f['الولاية'] !== 'إتحادي');
        const s={};
        Object.entries(STATE_LOCALITIES).forEach(([sK,sD])=>{
            if(sK==='إتحادي')return;
            sD.localities.forEach(l=>{s[l.en]={key:l.en,name:l.ar,state:sK,totalFunctioningPhc:0,totalPhcWithImnci:0};});
        });
        filteredNationalFacilities.forEach(f=>{
            const key=f['المحلية'];
            if(!key||!s[key])return;
            const isPhc=f['نوع_المؤسسةالصحية']==='وحدة صحة الاسرة'||f['نوع_المؤسسةالصحية']==='مركز صحة الاسرة';
            if(isPhc&&f['هل_المؤسسة_تعمل']==='Yes'){
                s[key].totalFunctioningPhc++;
                if(f['وجود_العلاج_المتكامل_لامراض_الطفولة']==='Yes'){s[key].totalPhcWithImnci++;}
            }
        });
        return Object.values(s).map(l=>({...l,coverage:l.totalFunctioningPhc>0?Math.round((l.totalPhcWithImnci/l.totalFunctioningPhc)*100):0,}));
    }, [allFacilities]);

    // --- MODIFICATION: Update tableCoverageData to use correct lists ---
    const tableCoverageData = useMemo(() => {
        const s={};
        const aggKey=isLocalityView?'المحلية':'الولاية';

        // DENOMINATOR loop 
        locationFilteredFacilities.forEach(f=>{
            const key=f[aggKey];
            if(!key || key === 'إتحادي')return;
            if(!s[key]){
                let name;
                if(isLocalityView){
                    const lI=STATE_LOCALITIES[stateFilter]?.localities.find(l=>l.en===key);
                    name=lI?.ar||key;
                }else{
                    name=STATE_LOCALITIES[key]?.ar||key;
                }
                s[key]={name,key,totalFunctioningPhc:0,totalPhcWithImnci:0};
            }
            const isPhc=f['نوع_المؤسسةالصحية']==='وحدة صحة الاسرة'||f['نوع_المؤسسةالصحية']==='مركز صحة الاسرة';
            if(isPhc&&f['هل_المؤسسة_تعمل']==='Yes'){
                s[key].totalFunctioningPhc++;
            }
        });

        // NUMERATOR loop 
        filteredFacilities.forEach(f => {
            const key=f[aggKey];
            if(!key || key === 'إتحادي' || !s[key]) return; 
            
            const isPhc=f['نوع_المؤسسةالصحية']==='وحدة صحة الاسرة'||f['نوع_المؤسسةالصحية']==='مركز صحة الاسرة';
            if(isPhc && f['هل_المؤسسة_تعمل']==='Yes' && f['وجود_العلاج_المتكامل_لامراض_الطفولة']==='Yes'){
                s[key].totalPhcWithImnci++;
            }
        });

        return Object.values(s).map(st=>({...st,coverage:st.totalFunctioningPhc>0?Math.round((st.totalPhcWithImnci/st.totalFunctioningPhc)*100):0})).sort((a,b)=>a.name.localeCompare(b.name));
    }, [locationFilteredFacilities, filteredFacilities, stateFilter, isLocalityView]); 
    // --- END MODIFICATION ---

    const tableToolsData = useMemo(() => {
        const s={};
        const aggKey=isLocalityView?'المحلية':'الولاية';
        const facProc = imnciInPhcs; 
        facProc.forEach(f=>{
            const key=f[aggKey];
             if(!key || key === 'إتحادي')return;
            if(!s[key]){
                let name;
                if(isLocalityView){
                    const lI=STATE_LOCALITIES[stateFilter]?.localities.find(l=>l.en===key);
                    name=lI?.ar||key;
                }else{
                    name=STATE_LOCALITIES[key]?.ar||key;
                }
                s[key]={name,key,totalImnciPhcs:0,countWithRegister:0,countWithChartbooklet:0,countWithWeightScale:0,countWithOrtCorner:0};
            }
            s[key].totalImnciPhcs++;
            if(f['وجود_سجل_علاج_متكامل']==='Yes')s[key].countWithRegister++;
            if(f['وجود_كتيب_لوحات']==='Yes')s[key].countWithChartbooklet++;
            if(f['ميزان_وزن']==='Yes')s[key].countWithWeightScale++;
            if(f['غرفة_إرواء']==='Yes')s[key].countWithOrtCorner++;
        });
        return Object.values(s).map(st=>{const total=st.totalImnciPhcs;return{...st,percentageWithRegister:total>0?Math.round((st.countWithRegister/total)*100):0,percentageWithChartbooklet:total>0?Math.round((st.countWithChartbooklet/total)*100):0,percentageWithWeightScale:total>0?Math.round((st.countWithWeightScale/total)*100):0,percentageWithOrtCorner:total>0?Math.round((st.countWithOrtCorner/total)*100):0};}).sort((a,b)=>a.name.localeCompare(b.name));
    }, [imnciInPhcs, stateFilter, isLocalityView]);

    const facilityLocationMarkers = useMemo(() =>
        imnciInPhcs.filter(f => f['_الإحداثيات_longitude'] && f['_الإحداثيات_latitude'])
                   .map(f => ({
                       key: f.id,
                       name: f['اسم_المؤسسة'],
                       coordinates: [f['_الإحداثيات_longitude'], f['_الإحداثيات_latitude']]
                   })),
        [imnciInPhcs]
    );
    
    const nationalMapData = useMemo(() => {
        if (!(allFacilities || []).length) return [];
        const s = {};
        (allFacilities || []).forEach(f => {
            const k = f['الولاية'];
            if (!k || k === 'إتحادي') return;
            if (!s[k]) s[k] = { tFP: 0, tPI: 0 };
            const isPhc = f['نوع_المؤسسةالصحية'] === 'وحدة صحة الاسرة' || f['نوع_المؤسسةالصحية'] === 'مركز صحة الاسرة';
            if (isPhc && f['هل_المؤسسة_تعمل'] === 'Yes') {
                s[k].tFP++;
                if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') s[k].tPI++;
            }
        });
        return Object.entries(s).map(([sK, c]) => ({
            state: sK,
            percentage: c.tFP > 0 ? Math.round((c.tPI / c.tFP) * 100) : 0,
            coordinates: mapCoordinates[sK] ? [mapCoordinates[sK].lng, mapCoordinates[sK].lat] : [0, 0]
        }));
    }, [allFacilities]);

    const selectedStateMapData = useMemo(() => { if(!stateFilter)return null;return nationalMapData.find(s=>s.state===stateFilter); }, [stateFilter, nationalMapData]);
    const mapViewConfig = useMemo(() => { const sC=stateFilter?mapCoordinates[stateFilter]:null;if(sC){return{center:[sC.lng,sC.lat],scale:sC.scale,focusedState:stateFilter};}return{center:[30,15.5],scale:2000,focusedState:null}; }, [stateFilter]);
    const fullscreenMapViewConfig = useMemo(() => ({ ...mapViewConfig }), [mapViewConfig]);
    const handleStateChange = (e) => { setStateFilter(e.target.value); setLocalityFilter(''); };
    const getIMNCIStateToolsSummary = useCallback((stateKey)=>{ const rel=(allFacilities || []).filter(f=>f['الولاية']===stateKey&&f['وجود_العلاج_المتكامل_لامراض_الطفولة']==='Yes'&&(f['نوع_المؤسسةالصحية']==='وحدة صحة الاسرة'||f['نوع_المؤسسةالصحية']==='مركز صحة الاسرة') && f['هل_المؤسسة_تعمل']==='Yes');const sum={...Object.fromEntries(IMNCI_TOOLS_KEYS.map(k=>[IMNCI_TOOLS_SPEC[k],0]))};rel.forEach(f=>{if(f['وجود_سجل_علاج_متكامل']==='Yes')sum[IMNCI_TOOLS_SPEC.countWithRegister]++;if(f['وجود_كتيب_لوحات']==='Yes')sum[IMNCI_TOOLS_SPEC.countWithChartbooklet]++;if(f['ميزان_وزن']==='Yes')sum[IMNCI_TOOLS_SPEC.countWithWeightScale]++;if(f['غرفة_إرواء']==='Yes')sum[IMNCI_TOOLS_SPEC.countWithOrtCorner]++;});return{totalUnits:rel.length,summary:sum}; }, [allFacilities]);
    const getIMNCILocalityToolsSummary = useCallback((localityKey, stateKey)=>{ const rel=(allFacilities || []).filter(f=>f['الولاية']===stateKey&&f['المحلية']===localityKey&&f['وجود_العلاج_المتكامل_لامراض_الطفولة']==='Yes'&&(f['نوع_المؤسسةالصحية']==='وحدة صحة الاسرة'||f['نوع_المؤسسةالصحية']==='مركز صحة الاسرة') && f['هل_المؤسسة_تعمل']==='Yes');const sum={...Object.fromEntries(IMNCI_TOOLS_KEYS.map(k=>[IMNCI_TOOLS_SPEC[k],0]))};rel.forEach(f=>{if(f['وجود_سجل_علاج_متكامل']==='Yes')sum[IMNCI_TOOLS_SPEC.countWithRegister]++;if(f['وجود_كتيب_لوحات']==='Yes')sum[IMNCI_TOOLS_SPEC.countWithChartbooklet]++;if(f['ميزان_وزن']==='Yes')sum[IMNCI_TOOLS_SPEC.countWithWeightScale]++;if(f['غرفة_إرواء']==='Yes')sum[IMNCI_TOOLS_SPEC.countWithOrtCorner]++;});return{totalUnits:rel.length,summary:sum}; }, [allFacilities]);
    const handleStateHover = useCallback((stateKey, event)=>{ if(stateFilter||mapViewLevel==='locality')return; const rowData=nationalMapData.find(d=>d.state===stateKey); if(!rowData)return; const toolsSummary=getIMNCIStateToolsSummary(stateKey); const statePhcs = (allFacilities || []).filter(f => f['الولاية'] === stateKey && f['هل_المؤسسة_تعمل'] === 'Yes' && (f['نوع_المؤسسةالصحية'] === 'وحدة صحة الاسرة' || f['نوع_المؤسسةالصحية'] === 'مركز صحة الاسرة')); const stateImnciPhcs = statePhcs.filter(f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes'); setTooltipData({title:`${STATE_LOCALITIES[stateKey]?.ar || stateKey} (${stateKey})`,dataRows:[{label:"IMNCI Coverage",value:`${rowData.percentage}% (${stateImnciPhcs.length} / ${statePhcs.length})`}],equipmentSummary:{...toolsSummary,title:"IMNCI Tools Summary"}});setHoverPosition({x:event.clientX,y:event.clientY}); }, [allFacilities, nationalMapData, stateFilter, mapViewLevel, getIMNCIStateToolsSummary]);
    const handleMapLocalityHover = useCallback((geoProps, event)=>{ const locKey=geoProps.admin_2;if(!locKey) return; let dataStore=stateFilter?tableCoverageData:allLocalitiesCoverageDataIMNCI; const locData=dataStore.find(l=>l.key===locKey);if(!locData)return;const stateKey=stateFilter?stateFilter:locData.state; const toolsSummary=getIMNCILocalityToolsSummary(locKey,stateKey);setTooltipData({title:`${locData.name} (${locData.key})`,dataRows:[{label:"IMNCI Coverage",value:`${locData.coverage}% (${locData.totalPhcWithImnci} / ${locData.totalFunctioningPhc})`}],equipmentSummary:{...toolsSummary,title:"IMNCI Tools Summary"}});setHoverPosition({x:event.clientX,y:event.clientY}); }, [tableCoverageData, allLocalitiesCoverageDataIMNCI, stateFilter, getIMNCILocalityToolsSummary]);
    const handleMapMouseLeave = useCallback(() => { setTooltipData(null); }, []);
    const handleMouseMove = useCallback((event) => { if (tooltipData) { setHoverPosition({ x: event.clientX, y: event.clientY }); } }, [tooltipData]);
    const currentMapViewLevel = isLocalityView ? 'locality' : mapViewLevel;
    
    const handleDownloadMap = useCallback((format = 'jpg') => {
        const targetRef = isMapFullscreen ? fullscreenModalRef : dashboardSectionRef;
         if (targetRef.current) { 
            html2canvas(targetRef.current, { 
                useCORS: true, 
                scale: 2, 
                backgroundColor: '#ffffff',
                ignoreElements: (element) => element.classList.contains('ignore-for-export')
            }).then(canvas => { 
                const baseName = isMapFullscreen ? 'imnci-map-fullscreen' : 'imnci-dashboard';
                const filename = `${baseName}-${stateFilter || 'sudan'}.${format}`; 
                if (format === 'pdf') { 
                    const imgData = canvas.toDataURL('image/jpeg', 0.9); 
                    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] }); 
                    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height); 
                    pdf.save(filename); 
                } else { 
                    const image = canvas.toDataURL("image/jpeg", 0.9); 
                    const link = document.createElement('a'); 
                    link.href = image; 
                    link.download = filename; 
                    document.body.appendChild(link); 
                    link.click(); 
                    document.body.removeChild(link); 
                } 
            }).catch(err => console.error("Error generating map image:", err)); 
        }
    }, [stateFilter, currentMapViewLevel, isMapFullscreen, dashboardSectionRef, fullscreenModalRef]); 
    
    const handleCopyImage = useCallback(async () => {
        const targetRef = dashboardSectionRef;
        if (targetRef.current && navigator.clipboard?.write) {
            setCopyStatus('Copying...');
            try {
                const canvas = await html2canvas(targetRef.current, { 
                    useCORS: true, 
                    scale: 2, 
                    backgroundColor: '#ffffff', 
                    logging: false, 
                    ignoreElements: (element) => element.classList.contains('ignore-for-export') 
                });
                canvas.toBlob(async (blob) => { if (blob) { await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]); setCopyStatus('Copied!'); } else { throw new Error('Canvas to Blob failed'); } }, 'image/png', 0.95);
            } catch (err) { console.error("Failed to copy image:", err); setCopyStatus('Failed'); }
            finally { setTimeout(() => setCopyStatus(''), 2000); }
        } else { console.error("Clipboard API not available or target element not found."); setCopyStatus('Failed'); setTimeout(() => setCopyStatus(''), 2000); }
    }, []);

    const mapLocationName = stateFilter ? STATE_LOCALITIES[stateFilter]?.ar || stateFilter : 'Sudan';
    const mapTitle = `IMNCI Geographical Distribution in ${mapLocationName}`;

    return (
        <div onMouseMove={handleMouseMove}>
            <PageHeader title="IMNCI Service Coverage Overview" subtitle="Key performance indicators for child health services." />

             <div ref={dashboardSectionRef} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch relative">

                 <div className="flex flex-col gap-6 lg:col-span-1">
                    <Card className="ignore-for-export">
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <FormGroup label="State"><Select value={stateFilter} onChange={handleStateChange}><option value="">All States</option>{Object.keys(STATE_LOCALITIES).filter(s => s !== 'إتحادي').sort((a,b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>)}</Select></FormGroup>
                            <FormGroup label="Locality"><Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}><option value="">All Localities</option>{stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}</Select></FormGroup>
                            <FormGroup label="Has Tool">
                                <Select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}>
                                    <option value="">Any</option>
                                    {Object.entries(IMNCI_FILTER_SPEC).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                        </div>
                    </Card>

                    {loading ? <Spinner/> : (
                        <>
                            <TotalCountCard title="Total Functioning PHC Facilities" count={functioningPhcs.length} />
                            <TotalCountCard title="Total PHC Facilities with IMNCI" count={imnciInPhcs.length} />
                            <ValueTotalPercentageCard title="IMNCI Service Coverage in PHCs" value={imnciInPhcs.length} total={functioningPhcs.length} percentage={imnciCoveragePercentage} />
                        </>
                    )}
                </div>

                 {loading ? <div className="lg:col-span-2 flex justify-center items-center h-64"><Spinner/></div> : (
                    <Card className="p-0 flex flex-col flex-grow lg:col-span-2">
                         <div className="p-4 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center flex-shrink-0 gap-2 sm:gap-0">
                             <h3 className="text-xl font-medium text-gray-700 text-left sm:text-center">IMNCI Geographical Distribution</h3>
                             <div className="flex items-center flex-wrap justify-start sm:justify-end gap-1 w-full sm:w-auto ignore-for-export">
                                {!isLocalityView && (
                                    <>
                                        <div className="text-sm font-medium text-gray-500">View:</div>
                                        <div className="flex rounded-md shadow-sm">
                                            <button onClick={() => setMapViewLevel('state')} className={`px-2 py-1 text-xs font-semibold rounded-l-md ${mapViewLevel === 'state' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`} > State </button>
                                            <button onClick={() => setMapViewLevel('locality')} className={`px-2 py-1 text-xs font-semibold rounded-r-md border-l border-gray-300 ${mapViewLevel === 'locality' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`} > Locality </button>
                                        </div>
                                    </>
                                )}
                                <button onClick={() => handleDownloadMap('jpg')} title="Download Map as JPG" className="ml-1 px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">JPG</button>
                                <button onClick={() => handleDownloadMap('pdf')} title="Download Map as PDF" className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">PDF</button>
                                 <button
                                    onClick={handleCopyImage}
                                    title="Copy Dashboard Image"
                                    disabled={!!copyStatus && copyStatus !== 'Failed'}
                                    className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors relative min-w-[70px] text-center disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {copyStatus || 'Copy Image'}
                                </button>
                                <button
                                    onClick={() => setShowFacilityMarkers(!showFacilityMarkers)}
                                    title={showFacilityMarkers ? "Hide Facilities" : "Show Facilities"}
                                    className={`ml-1 px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        showFacilityMarkers ? 'bg-sky-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {showFacilityMarkers ? 'Hide' : 'Show'} Facilities
                                </button>
                                <button onClick={() => setIsMapFullscreen(true)} className="px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-100 rounded-md hover:bg-sky-200 transition-colors">Full</button>
                            </div>
                        </div>
                        <div ref={mapContainerRef} className="flex-grow flex flex-col bg-white">
                             <h4 className="text-center text-lg font-bold text-gray-600 py-1 flex-shrink-0">{mapTitle}</h4>
                             <div className="flex justify-center items-center gap-2 p-1 text-sm text-gray-600">
                                <span className="font-bold">Legend:</span>
                                <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: '#6B6B6B' }}></div><span className='text-xs'>0-39% (or No Data)</span></div>
                                <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: '#6266B1' }}></div><span className='text-xs'>40-74%</span></div>
                                <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: '#313695' }}></div><span className='text-xs'>&ge;75%</span></div>
                                <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-full border-2 border-white ring-1 ring-[#313695]" style={{ backgroundColor: '#313695' }}></div><span className='text-xs'>Facility</span></div>
                             </div>
                             <div className='flex-grow min-h-[450px]'>
                                <div className='flex-grow min-h-0 h-full'>
                                    <SudanMap
                                        data={!isLocalityView && currentMapViewLevel === 'state' ? nationalMapData : []}
                                        localityData={isLocalityView ? tableCoverageData : (!isLocalityView && currentMapViewLevel === 'locality' ? allLocalitiesCoverageDataIMNCI : [])}
                                        facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []}
                                        viewLevel={currentMapViewLevel}
                                        center={mapViewConfig.center}
                                        scale={mapViewConfig.scale}
                                        focusedState={mapViewConfig.focusedState}
                                        onStateHover={handleStateHover} onStateLeave={handleMapMouseLeave}
                                        onLocalityHover={handleMapLocalityHover} onLocalityLeave={handleMapMouseLeave}
                                        isMovable={false}
                                        pannable={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                 )}
             </div>

            {!loading && (
            <>
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-1 gap-6">
                    <Card className="p-0">
                        <div className="p-4 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-medium text-gray-700"> {isLocalityView && selectedStateMapData ? `IMNCI Coverage in ${STATE_LOCALITIES[stateFilter].ar} (State Overall: ${selectedStateMapData.percentage}%)` : `IMNCI Coverage by ${aggregationLevelName}` } </h3>
                                <p className="text-sm text-gray-500 mt-1">Summary of PHC facilities based on current filters.</p>
                            </div>
                            <button onClick={() => copyTableToClipboard(coverageTableRef, setTable1CopyStatus)} className="px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 transition-colors"> {table1CopyStatus || 'Copy Table'} </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table ref={coverageTableRef} className="min-w-full text-sm">
                                <thead>
                                    <tr>
                                        {[aggregationLevelName, 'Functioning PHCs', 'PHCs with IMNCI', 'Coverage (%)'].map((h, i) => (
                                            <th key={i} className="p-2 border bg-gray-100 text-left font-semibold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                 {tableCoverageData.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-gray-500">No data matches the current filters.</td></tr> :
                                 tableCoverageData.map(row => (<tr key={row.key}><td className="p-2 border font-medium text-gray-800">{row.name}</td><td className="p-2 border text-center">{row.totalFunctioningPhc}</td><td className="p-2 border text-center">{row.totalPhcWithImnci}</td><td className="p-2 border">{getCoverageBar(row.coverage)}</td></tr>))
                                 }
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
                <div className="mt-6">
                    <Card className="p-0">
                        <div className="p-4 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-medium text-gray-700"> {isLocalityView && selectedStateMapData ? `IMNCI Tools Availability in ${STATE_LOCALITIES[stateFilter].ar}` : `IMNCI Tools Availability by ${aggregationLevelName}` } </h3>
                                <p className="text-sm text-gray-500 mt-1">Availability of key supplies in PHC facilities providing IMNCI services.</p>
                            </div>
                            <button onClick={() => copyTableToClipboard(toolsTableRef, setTable2CopyStatus)} className="px-2 py-1 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded hover:bg-sky-100 transition-colors"> {table2CopyStatus || 'Copy Table'} </button>
                        </div>
                         <div className="overflow-x-auto">
                             <table ref={toolsTableRef} className="min-w-full text-sm">
                                <thead>
                                    <tr>
                                        {[aggregationLevelName, 'PHCs w/ IMNCI', 'سجلات', 'كتيبات', 'ميزان وزن', 'غرفة ارواء'].map((h, i) => (
                                            <th key={i} className="p-2 border bg-gray-100 text-left font-semibold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                 {tableToolsData.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-gray-500">No data matches the current filters.</td></tr> :
                                  tableToolsData.map(row => (<tr key={row.key}><td className="p-2 border font-medium text-gray-800">{row.name}</td><td className="p-2 border text-center">{row.totalImnciPhcs}</td><td className="p-2 border text-center">{`${row.countWithRegister} (${row.percentageWithRegister}%)`}</td><td className="p-2 border text-center">{`${row.countWithChartbooklet} (${row.percentageWithChartbooklet}%)`}</td><td className="p-2 border text-center">{`${row.countWithWeightScale} (${row.percentageWithWeightScale}%)`}</td><td className="p-2 border text-center">{`${row.countWithOrtCorner} (${row.percentageWithOrtCorner}%)`}</td></tr>))
                                  }
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {isMapFullscreen && (
                    <div ref={fullscreenModalRef} className="fixed inset-0 bg-white z-50 p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                             <h3 className="text-xl font-bold text-gray-800">{mapTitle}</h3>
                             <div className='flex items-center gap-1 ignore-for-export'>
                                <button onClick={() => handleDownloadMap('jpg')} title="Download Map as JPG" className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">JPG</button>
                                <button onClick={() => handleDownloadMap('pdf')} title="Download Map as PDF" className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">PDF</button>
                                <button onClick={() => setIsMapFullscreen(false)} className="px-4 py-2 text-sm font-bold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 ml-1">Close</button>
                             </div>
                        </div>

                        <div className="flex-grow min-h-0 flex gap-4">
                            <div ref={fullscreenMapContainerRef} className={`flex-grow min-h-0 bg-white ${isLocalityView ? 'w-2/3' : 'w-full'}`}>
                                <SudanMap
                                    data={!isLocalityView && currentMapViewLevel === 'state' ? nationalMapData : []}
                                    localityData={isLocalityView ? tableCoverageData : (!isLocalityView && currentMapViewLevel === 'locality' ? allLocalitiesCoverageDataIMNCI : [])}
                                    facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []}
                                    viewLevel={currentMapViewLevel}
                                    center={fullscreenMapViewConfig.center}
                                    scale={fullscreenMapViewConfig.scale}
                                    focusedState={fullscreenMapViewConfig.focusedState}
                                    onStateHover={handleStateHover} onStateLeave={handleMapMouseLeave}
                                    onLocalityHover={handleMapLocalityHover} onLocalityLeave={handleMapMouseLeave}
                                    isMovable={false}
                                    pannable={false}
                                />
                            </div>

                            {isLocalityView && (
                                <div className="w-1/3 flex flex-col border border-gray-200 rounded-lg">
                                    <h4 className="text-lg font-semibold p-3 border-b bg-gray-50">PHCs with IMNCI ({facilityLocationMarkers.length})</h4>
                                    <div className="overflow-y-auto flex-grow min-h-0">
                                        <ul className="divide-y divide-gray-200">
                                            {facilityLocationMarkers.map(facility => (
                                                <li key={facility.key} className="p-3 text-sm">
                                                    {facility.name}
                                                </li>

                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {tooltipData && ( <div style={{ position: 'fixed', left: hoverPosition.x - 40, top: hoverPosition.y, pointerEvents: 'none', zIndex: 50 }}> <MapTooltip title={tooltipData.title} dataRows={tooltipData.dataRows} equipmentSummary={tooltipData.equipmentSummary} /> </div> )}
            </>
            )}
        </div>
    );
};