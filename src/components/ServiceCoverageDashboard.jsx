// src/components/ServiceCoverageDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import html2canvas from 'html2canvas';
import { Card, Spinner, FormGroup, Select } from './CommonComponents';
import { useDataCache } from '../DataContext';
import { STATE_LOCALITIES, getLocalizedStateName, getLocalizedLocalityName } from "./constants.js";
import SudanMap from '../SudanMap';

// --- HELPER COMPONENTS ---

const mapCoordinates = {
    "Khartoum":       { lat: 15.60, lng: 32.50, scale: 35000 },
    "Gezira":         { lat: 14.40, lng: 33.51, scale: 14000 },
    "White Nile":     { lat: 13.16, lng: 32.66, scale: 9000 },
    "Blue Nile":      { lat: 11.76, lng: 34.35, scale: 12000 },
    "Sennar":         { lat: 13.15, lng: 33.93, scale: 12000 },
    "Gedaref":        { lat: 14.03, lng: 35.38, scale: 11000 },
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

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
);

// --- KPI Card Components ---
const KPIWrapper = ({ children, borderClass = 'border-s-slate-400', decorationColor = 'bg-slate-500', className = '', percentage, colorTheme = 'slate' }) => {
    const bgLight = `bg-${colorTheme}-100`;
    const textDark = `text-${colorTheme}-700`;
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-s-4 ${borderClass} hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center relative overflow-hidden text-center min-h-[140px] ${className}`}>
            <div className={`absolute -start-8 -bottom-8 w-28 h-28 rounded-full opacity-10 ${decorationColor} pointer-events-none`}></div>
            {percentage !== undefined && (
                <div className={`absolute top-2 end-2 w-14 h-14 rounded-full flex items-center justify-center font-black text-[15px] ${bgLight} ${textDark} ring-4 ring-white shadow-md z-20`}>
                    {percentage}%
                </div>
            )}
            <div className="relative z-10 w-full flex flex-col items-center justify-center h-full mt-2">
                {children}
            </div>
        </div>
    );
};

const ValueTotalPercentageCard = ({ title, value, total, percentage, borderClass = 'border-s-sky-500', valueClass = 'text-sky-600', decorationColor = 'bg-sky-500', colorTheme='sky', className = '' }) => {
    const { t } = useTranslation();
    return (
    <KPIWrapper borderClass={borderClass} decorationColor={decorationColor} percentage={percentage} colorTheme={colorTheme} className={className}>
        <h3 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider leading-snug mb-1">{title}</h3>
        <div className="flex flex-col items-center justify-center">
            <span className={`text-4xl font-black ${valueClass}`}>{value}</span>
            {total > 0 && <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mt-1">{t('dashboard.cards.out_of', 'out of')} {total}</span>}
        </div>
    </KPIWrapper>
)};

const TotalCountCard = ({ title, count, borderClass = 'border-s-slate-500', valueClass = 'text-slate-700', decorationColor = 'bg-slate-500', className = '' }) => (
    <KPIWrapper borderClass={borderClass} decorationColor={decorationColor} className={className}>
        <h3 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider leading-snug mb-1">{title}</h3>
        <div className="flex items-center justify-center">
            <span className={`text-4xl font-black ${valueClass}`}>{count}</span>
        </div>
    </KPIWrapper>
);

// --- HELPER FUNCTIONS ---
const copyTableAsImage = async (tableRef, setStatusCallback) => {
    if (!tableRef.current) return;
    setStatusCallback('Copying...');
    try {
        const canvas = await html2canvas(tableRef.current, { useCORS: true, scale: 2, backgroundColor: '#ffffff' });
        canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                    setStatusCallback('Copied!');
                } catch (writeErr) { setStatusCallback('Failed'); }
            }
        });
    } catch (err) { setStatusCallback('Failed'); } 
    finally { setTimeout(() => setStatusCallback(''), 2000); }
};

// --- UPDATED MAP LEGEND ---
const MapLegend = ({ showPlanned = false }) => {
    const { t } = useTranslation();
    return (
    <div className="flex justify-center items-center flex-wrap gap-4 text-sm text-gray-700">
        <span className="font-bold">{t('dashboard.map.legend', 'Legend:')}</span>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full shadow-sm bg-[#6B6B6B]"></div><span className='text-xs font-medium'>{t('dashboard.map.no_data', '0-39% (or No Data)')}</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full shadow-sm bg-[#6266B1]"></div><span className='text-xs font-medium'>{t('dashboard.map.range_mid', '40-74%')}</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full shadow-sm bg-[#313695]"></div><span className='text-xs font-medium'>{t('dashboard.map.range_high', '≥75%')}</span></div>
        {showPlanned && <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full shadow-sm bg-[#F59E0B]"></div><span className='text-xs font-medium'>{t('dashboard.map.planned_locality', 'Planned Only')}</span></div>}
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full border-2 border-white shadow-sm ring-1 ring-[#313695] bg-[#313695]"></div><span className='text-xs font-medium'>{t('dashboard.map.facility', 'Facility (Active)')}</span></div>
        {showPlanned && <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full border-2 border-white shadow-sm ring-1 ring-[#EAB308] bg-[#EAB308]"></div><span className='text-xs font-medium'>{t('dashboard.map.planned', 'Facility (Planned)')}</span></div>}
        {showPlanned && <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full border-2 border-white shadow-sm ring-1 ring-[#EF4444] bg-[#EF4444]"></div><span className='text-xs font-medium'>{t('dashboard.map.no_facility', 'Facility (No)')}</span></div>}
    </div>
)};

const MapTooltip = ({ title, dataRows = [], equipmentSummary }) => {
    const { t } = useTranslation();
    return (
    <div className="absolute z-50 p-4 bg-white border border-gray-300 shadow-xl rounded-lg w-80 pointer-events-none transform -translate-x-full -translate-y-1/2">
        <h4 className="text-lg font-bold text-gray-800 border-b pb-2 mb-2">{title}</h4>
        <div className="text-sm space-y-1">
            {dataRows.map(row => ( <p key={row.label}><span className="font-semibold text-sky-700">{row.label}:</span> {row.value}</p> ))}
            {equipmentSummary && (
                <>
                    <p className="pt-2 font-bold border-t mt-2">{equipmentSummary.title || "Equipment Summary"}:</p>
                    <p className="text-xs text-gray-600">Total Units Reporting: {equipmentSummary.totalUnits}</p>
                    <ul className="list-disc list-inside text-xs mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                        {Object.entries(equipmentSummary.summary).map(([key, count]) => ( <li key={key} className={count === 0 ? 'text-red-500' : 'text-gray-700'}> {t(`dashboard.equip.${key}`, key)}: <span className="font-bold">{count}</span> </li> ))}
                    </ul>
                </>
            )}
        </div>
    </div>
)};

const FacilityTooltip = ({ data }) => {
    const { t } = useTranslation();
    return (
    <div className="absolute z-50 p-3 bg-white border border-gray-300 shadow-xl rounded-lg w-64 pointer-events-none transform -translate-x-1/2">
        <h4 className="text-md font-bold text-gray-800 border-b pb-1 mb-2">{data.name}</h4>
        <p className="text-xs font-semibold text-sky-700 mb-1">Equipment Summary:</p>
        <ul className="list-disc list-inside text-xs space-y-0.5 max-h-48 overflow-y-auto">
            {Object.entries(data.summary).map(([key, count]) => ( <li key={key} className={count === 0 ? 'text-red-500' : 'text-gray-700'}> {t(`dashboard.equip.${key}`, key)}: <span className="font-bold">{count}</span> </li> ))}
        </ul>
    </div>
)};

const OWNERSHIP_OPTIONS = ['حكومي', 'خاص', 'منظمات', 'اهلي'];

// --- FULLY UPDATED NEONATAL DASHBOARD ---
const NEONATAL_EQUIPMENT_SPEC = { 'neonatal_total_beds': 'Total Beds', 'neonatal_total_incubators': 'Incubators', 'neonatal_total_cots': 'Cots', 'neonatal_phototherapy': 'Phototherapy Units', 'neonatal_oxygen_machine': 'Oxygen Machines', 'neonatal_oxygen_cylinder': 'Oxygen Cylinders', 'neonatal_respiration_monitor': 'Respiration Monitors', 'neonatal_cpap': 'CPAP Machines', 'neonatal_mechanical_ventilator': 'Mechanical Ventilators', 'neonatal_warmer': 'Neonatal Warmers', 'neonatal_infusion_pump': 'Infusion Pumps', 'neonatal_syringe_pump': 'Syringe Pumps', 'neonatal_sucker': 'Suction Devices', 'neonatal_ambu_bag': 'Resuscitation Bags', 'neonatal_portable_incubator': 'Portable Incubators' };
const NEONATAL_EQUIPMENT_KEYS = Object.keys(NEONATAL_EQUIPMENT_SPEC);

export const NeonatalCoverageDashboard = ({ userStates, userLocalities }) => {
    const { t, i18n } = useTranslation();
    const { healthFacilities: allFacilities, isLoading } = useDataCache();
    const loading = isLoading.healthFacilities || allFacilities === null;
    const activeFacilities = useMemo(() => (allFacilities || []).filter(f => f.isDeleted !== true && f.isDeleted !== "true"), [allFacilities]);

    const [stateFilter, setStateFilter] = useState(userStates?.length === 1 ? userStates[0] : ''); 
    const [localityFilter, setLocalityFilter] = useState(userLocalities?.length === 1 ? userLocalities[0] : ''); 
    const [ownershipFilter, setOwnershipFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [equipmentFilter, setEquipmentFilter] = useState('');
    
    // Filters
    const [neonatalLevelFilter, setNeonatalLevelFilter] = useState('');
    const [neonatalStatusFilter, setNeonatalStatusFilter] = useState('');

    const [isMapFullscreen, setIsMapFullscreen] = useState(false); 
    const [mapViewLevel, setMapViewLevel] = useState('state');
    
    const [copyStatus, setCopyStatus] = useState(''); 
    const [table1CopyStatus, setTable1CopyStatus] = useState(''); 
    const [table2CopyStatus, setTable2CopyStatus] = useState(''); 
    const [table3CopyStatus, setTable3CopyStatus] = useState(''); 

    const [tooltipData, setTooltipData] = useState(null); 
    const [hoveredFacilityData, setHoveredFacilityData] = useState(null); 
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [showFacilityMarkers, setShowFacilityMarkers] = useState(true);
    
    const dashboardSectionRef = useRef(null);
    const fullscreenModalRef = useRef(null);
    const coverageTableRef = useRef(null); 
    const equipmentTableRef = useRef(null); 
    const scnuListTableRef = useRef(null); 
    
    const projectOptions = useMemo(() => [...new Set(activeFacilities.filter(f => f.project_name?.trim()).map(f => f.project_name.trim()))].sort(), [activeFacilities]);

    const locationFilteredFacilities = useMemo(() => {
        return activeFacilities.filter(f => {
            if(f['الولاية'] === 'إتحادي') return false;
            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;
            if (ownershipFilter && f.facility_ownership !== ownershipFilter) return false;
            if (projectFilter && f.project_name !== projectFilter) return false;
            if (equipmentFilter && (Number(f[equipmentFilter]) || 0) === 0) return false;

            return true;
        });
    }, [activeFacilities, stateFilter, localityFilter, ownershipFilter, projectFilter, equipmentFilter]); 

    const targetLevel = neonatalLevelFilter || 'secondary';

    const isFacilitySupposedToProvideCare = useCallback((f) => {
        let levelVal = f[`neonatal_level_${targetLevel}`];
        if (!levelVal && f.neonatal_level_of_care && f.neonatal_level_of_care[targetLevel] !== undefined) {
            levelVal = f.neonatal_level_of_care[targetLevel] ? 'Yes' : 'No';
        }
        
        // FIX: If explicitly marked as Yes or Planned, it strictly enters the denominator
        if (levelVal === 'Yes' || levelVal === 'Planned') {
            return true;
        }

        if (targetLevel === 'secondary') {
            return ['CEmONC', 'pediatric'].includes(f.eenc_service_type);
        } else if (targetLevel === 'primary') {
            return ['BEmONC', 'CEmONC', 'pediatric'].includes(f.eenc_service_type);
        } else if (targetLevel === 'tertiary') {
            let level2Val = f.neonatal_level_secondary;
            if (!level2Val && f.neonatal_level_of_care && f.neonatal_level_of_care.secondary !== undefined) {
                level2Val = f.neonatal_level_of_care.secondary ? 'Yes' : 'No';
            }
            return f['هل_المؤسسة_تعمل'] === 'Yes' && level2Val === 'Yes';
        }
        return false;
    }, [targetLevel]);

    // 1. Establish the clean denominator representing Target Facilities
    const targetFacilities = useMemo(() => locationFilteredFacilities.filter(isFacilitySupposedToProvideCare), [locationFilteredFacilities, isFacilitySupposedToProvideCare]);

    // 2. Establish the dynamically displayed facilities applying the Status Filter
    const displayedFacilities = useMemo(() => {
        return targetFacilities.filter(f => {
            let levelVal = f[`neonatal_level_${targetLevel}`];
            if (!levelVal && f.neonatal_level_of_care && f.neonatal_level_of_care[targetLevel] !== undefined) {
                levelVal = f.neonatal_level_of_care[targetLevel] ? 'Yes' : 'No';
            }
            if (!levelVal) levelVal = 'No';

            if (neonatalStatusFilter === 'Planned') return levelVal === 'Planned';
            if (neonatalStatusFilter === 'Yes') return f['هل_المؤسسة_تعمل'] === 'Yes' && levelVal === 'Yes';
            if (neonatalStatusFilter === 'No') return f['هل_المؤسسة_تعمل'] === 'Yes' && levelVal === 'No';
            
            // Default behavior (no status filter)
            return f['هل_المؤسسة_تعمل'] === 'Yes' && levelVal === 'Yes';
        });
    }, [targetFacilities, targetLevel, neonatalStatusFilter]);

    const kpiData = useMemo(() => {
        const totalSupposed = targetFacilities.length;
        const totalWithUnit = displayedFacilities.length;
        const totalWithCPAP = displayedFacilities.filter(f => (Number(f['neonatal_cpap']) || 0) > 0).length;
        return {
            totalSupposed,
            totalWithUnit,
            unitCoveragePercentage: totalSupposed > 0 ? Math.round((totalWithUnit / totalSupposed) * 100) : 0,
            totalWithCPAP,
            cpapPercentage: totalWithUnit > 0 ? Math.round((totalWithCPAP / totalWithUnit) * 100) : 0,
        };
    }, [targetFacilities, displayedFacilities]); 

    const isLocalityView = !!stateFilter;
    const aggregationLevelName = isLocalityView ? t('dashboard.table.locality', 'Locality') : t('dashboard.table.state', 'State');

    const { stateData } = useMemo(() => {
        const sum = {};
        const aggF = isLocalityView ? 'المحلية' : 'الولاية';

        targetFacilities.forEach(f => {
            const key = f[aggF];
            if (!key || key === 'إتحادي') return;
            if (!sum[key]) sum[key] = { 
                name: isLocalityView ? getLocalizedLocalityName(stateFilter, key, i18n.language) : getLocalizedStateName(key, i18n.language), 
                key, totalSupposed: 0, totalWithUnit: 0, totalActive: 0, totalPlanned: 0 
            };
            
            sum[key].totalSupposed++;

            let levelVal = f[`neonatal_level_${targetLevel}`];
            if (!levelVal && f.neonatal_level_of_care && f.neonatal_level_of_care[targetLevel] !== undefined) {
                levelVal = f.neonatal_level_of_care[targetLevel] ? 'Yes' : 'No';
            }
            if (!levelVal) levelVal = 'No';

            if (f['هل_المؤسسة_تعمل'] === 'Yes' && levelVal === 'Yes') sum[key].totalActive++;
            if (levelVal === 'Planned') sum[key].totalPlanned++;
        });

        const sD = Object.values(sum).map(s => ({ 
            ...s, 
            totalWithUnit: s.totalActive, // Maintains normal coverage chart output independently
            coverage: s.totalSupposed > 0 ? Math.round((s.totalActive / s.totalSupposed) * 100) : 0,
            hasPlannedOnly: s.totalActive === 0 && s.totalPlanned > 0
        }));
        return { stateData: sD };
    }, [targetFacilities, stateFilter, isLocalityView, i18n.language, targetLevel]); 

    const sortedTableData = useMemo(() => [...stateData].sort((a,b) => b.coverage - a.coverage), [stateData]);

    const equipmentTableData = useMemo(() => {
        const aggK = !!stateFilter ? 'اسم_المؤسسة' : 'الولاية';
        const sum = {};
        displayedFacilities.forEach(f => {
            const key = f[aggK];
            if (!key || key === 'إتحادي') return;
            if (!sum[key]) sum[key] = { 
                name: !!stateFilter ? f['اسم_المؤسسة'] : getLocalizedStateName(key, i18n.language), 
                key, hasData: false, ...Object.fromEntries(NEONATAL_EQUIPMENT_KEYS.map(k => [k, 0])) 
            };
            NEONATAL_EQUIPMENT_KEYS.forEach(eK => {
                const fV = Number(f[eK]) || 0;
                sum[key][eK] += fV;
                if (fV > 0) sum[key].hasData = true;
            });
        });
        return Object.values(sum).filter(s => s.key !== 'إتحادي' && s.hasData).sort((a, b) => (b.neonatal_total_beds || 0) - (a.neonatal_total_beds || 0)).slice(0, 30);
    }, [displayedFacilities, stateFilter, i18n.language]);

    const facilityNeonatalTableData = useMemo(() => {
        return displayedFacilities.map(f => {
            let localityEn = f['المحلية'];
            const state = f['الولاية'];
            return { 
                id: f.id, 
                state: getLocalizedStateName(state, i18n.language) || '', 
                locality: getLocalizedLocalityName(state, localityEn, i18n.language) || '', 
                facilityName: f['اسم_المؤسسة'] || '', 
                incubators: Number(f['neonatal_total_incubators']) || 0, 
                cots: Number(f['neonatal_total_cots']) || 0, 
                totalBeds: (Number(f['neonatal_total_incubators']) || 0) + (Number(f['neonatal_total_cots']) || 0) 
            };
        }).sort((a, b) => 
            String(a.state).localeCompare(String(b.state)) || 
            String(a.locality).localeCompare(String(b.locality)) || 
            String(a.facilityName).localeCompare(String(b.facilityName))
        );
    }, [displayedFacilities, i18n.language]);

    const facilityLocationMarkers = useMemo(() => displayedFacilities.filter(f=>f['_الإحداثيات_longitude']&&f['_الإحداثيات_latitude']).map(f=>{
        let levelVal = f[`neonatal_level_${targetLevel}`];
        if (!levelVal && f.neonatal_level_of_care && f.neonatal_level_of_care[targetLevel] !== undefined) {
            levelVal = f.neonatal_level_of_care[targetLevel] ? 'Yes' : 'No';
        }
        if (!levelVal) levelVal = 'No';
        
        let color = '#313695';
        if (levelVal === 'Planned') color = '#EAB308'; // Yellow for Planned
        else if (levelVal === 'No' || f['هل_المؤسسة_تعمل'] !== 'Yes') color = '#EF4444'; // Red for No/Not Functioning

        return {
            key:f.id,
            name:f['اسم_المؤسسة'],
            coordinates:[f['_الإحداثيات_longitude'],f['_الإحداثيات_latitude']],
            color
        };
    }), [displayedFacilities, targetLevel]);
    
    const mapViewConfig = useMemo(() => { const sC=stateFilter?mapCoordinates[stateFilter]:null; return sC ? {center:[sC.lng,sC.lat],scale:sC.scale,focusedState:stateFilter} : {center:[30,15.5],scale:2000,focusedState:null}; }, [stateFilter]);
    
    const nationalMapData = useMemo(() => { 
        const s={};
        targetFacilities.forEach(f=>{
            const k=f['الولاية'];
            if(!k||k==='إتحادي')return;
            if(!s[k])s[k]={totalSupposed:0,totalActive: 0, totalPlanned: 0};
            
            s[k].totalSupposed++;

            let levelVal = f[`neonatal_level_${targetLevel}`];
            if (!levelVal && f.neonatal_level_of_care && f.neonatal_level_of_care[targetLevel] !== undefined) {
                levelVal = f.neonatal_level_of_care[targetLevel] ? 'Yes' : 'No';
            }
            if (!levelVal) levelVal = 'No';

            if (f['هل_المؤسسة_تعمل'] === 'Yes' && levelVal === 'Yes') s[k].totalActive++;
            if (levelVal === 'Planned') s[k].totalPlanned++;
        });
        return Object.entries(s).map(([sK,c])=>({
            state:sK,
            percentage:c.totalSupposed>0?Math.round((c.totalActive/c.totalSupposed)*100):0,
            hasPlannedOnly: c.totalActive === 0 && c.totalPlanned > 0,
            coordinates:mapCoordinates[sK]?[mapCoordinates[sK].lng,mapCoordinates[sK].lat]:[0,0]
        })); 
    }, [targetFacilities, targetLevel]);
    
    const handleStateChange = (e) => { setStateFilter(e.target.value); setLocalityFilter(''); };
    const handleMapHover = useCallback((key, event) => setHoverPosition({ x: event.clientX, y: event.clientY }), []);
    const handleMapMouseLeave = useCallback(() => { setTooltipData(null); }, []);
    const handleFacilityHover = useCallback((facilityId, event) => setHoverPosition({ x: event.clientX, y: event.clientY }), []);
    const handleFacilityLeave = useCallback(() => { setHoveredFacilityData(null); }, []);
    const handleMouseMove = useCallback((event) => { if (tooltipData || hoveredFacilityData) setHoverPosition({ x: event.clientX, y: event.clientY }); }, [tooltipData, hoveredFacilityData]);
    const currentMapViewLevel = isLocalityView ? 'locality' : mapViewLevel;

    const handleCopyImage = useCallback(async () => {
        if (dashboardSectionRef.current && navigator.clipboard?.write) {
            setCopyStatus('Copying...');
            try {
                const canvas = await html2canvas(dashboardSectionRef.current, { useCORS: true, scale: 2, backgroundColor: '#ffffff', ignoreElements: (e) => e.classList.contains('ignore-for-export') });
                canvas.toBlob(async (blob) => { if (blob) { await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]); setCopyStatus('Copied!'); } }, 'image/png', 0.95);
            } catch (err) { setCopyStatus('Failed'); }
            finally { setTimeout(() => setCopyStatus(''), 2000); }
        }
    }, []);

    const equipmentHeaders = [
        !!stateFilter ? t('dashboard.table.hospital_name', 'Hospital Name') : aggregationLevelName,
        ...Object.values(NEONATAL_EQUIPMENT_SPEC).map(h => t(`dashboard.equip.${h}`, h))
    ];

    const displayTargetLevel = targetLevel.charAt(0).toUpperCase() + targetLevel.slice(1);
    
    const displayDynamicTitle = neonatalStatusFilter === 'Planned' 
        ? t('dashboard.cards.planned_scnu', `Planned ${displayTargetLevel} Facilities`) 
        : neonatalStatusFilter === 'No' 
        ? t('dashboard.cards.no_scnu', `Facilities without ${displayTargetLevel}`) 
        : t('dashboard.cards.functioning_scnu', `Functioning ${displayTargetLevel} Facilities`);

    return (
        <div onMouseMove={handleMouseMove}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm ignore-for-export mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    <FormGroup label={t('dashboard.filters.state', 'State')}>
                        <Select value={stateFilter} onChange={handleStateChange}>
                            <option value="">{t('dashboard.filters.all_states', 'All States')}</option>
                            {Object.keys(STATE_LOCALITIES).filter(s => s !== 'إتحادي').sort().map(sKey => <option key={sKey} value={sKey}>{getLocalizedStateName(sKey, i18n.language)}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label={t('dashboard.filters.locality', 'Locality')}>
                        <Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}>
                            <option value="">{t('dashboard.filters.all_localities', 'All Localities')}</option>
                            {stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a,b) => a.en.localeCompare(b.en)).map(l => <option key={l.en} value={l.en}>{getLocalizedLocalityName(stateFilter, l.en, i18n.language)}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label={t('dashboard.filters.ownership', 'Ownership')}>
                        <Select value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value)}>
                            <option value="">{t('dashboard.filters.all_ownerships', 'All Ownerships')}</option>
                            {OWNERSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label={t('dashboard.filters.project', 'Project')}>
                        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                            <option value="">{t('dashboard.filters.all_projects', 'All Projects')}</option>
                            {projectOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label={t('dashboard.filters.has_equipment', 'Has Equipment')}>
                        <Select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}>
                            <option value="">{t('dashboard.filters.any', 'Any')}</option>
                            {Object.entries(NEONATAL_EQUIPMENT_SPEC).map(([key, label]) => <option key={key} value={key}>{t(`dashboard.equip.${label}`, label)}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label={t('dashboard.filters.neonatal_level', 'Neonatal Level')}>
                        <Select value={neonatalLevelFilter} onChange={(e) => { setNeonatalLevelFilter(e.target.value); setNeonatalStatusFilter(''); }}>
                            <option value="">{t('dashboard.filters.any_level', 'All Levels (Sec. Default)')}</option>
                            <option value="primary">{t('dashboard.filters.primary', 'Primary')}</option>
                            <option value="secondary">{t('dashboard.filters.secondary', 'Secondary (SCNU)')}</option>
                            <option value="tertiary">{t('dashboard.filters.tertiary', 'Tertiary (NICU)')}</option>
                        </Select>
                    </FormGroup>
                    <FormGroup label={t('dashboard.filters.availability_status', 'Level Status')}>
                        <Select value={neonatalStatusFilter} onChange={(e) => setNeonatalStatusFilter(e.target.value)}>
                            <option value="">{t('dashboard.filters.any_status', 'Any Status')}</option>
                            <option value="Yes">{t('dashboard.filters.status_yes', 'Yes')}</option>
                            <option value="No">{t('dashboard.filters.status_no', 'No')}</option>
                            <option value="Planned">{t('dashboard.filters.status_planned', 'Planned')}</option>
                        </Select>
                    </FormGroup>
                </div>
            </div>

            <div ref={dashboardSectionRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch relative">
                <div className="lg:col-span-1 flex flex-col gap-4 h-full">
                    {loading ? <Spinner/> : (
                        <>
                            <TotalCountCard title={t('dashboard.cards.total_pediatrics_emonc', 'Total Target Facilities')} count={kpiData.totalSupposed} className="flex-1" borderClass="border-s-slate-400" valueClass="text-slate-700" decorationColor="bg-slate-500" colorTheme="slate" />
                            <ValueTotalPercentageCard title={displayDynamicTitle} value={kpiData.totalWithUnit} total={kpiData.totalSupposed} percentage={kpiData.unitCoveragePercentage} className="flex-1" borderClass="border-s-sky-500" valueClass="text-sky-600" decorationColor="bg-sky-500" colorTheme="sky" />
                            <ValueTotalPercentageCard title={t('dashboard.cards.facilities_with_cpap', 'Facilities with CPAP')} value={kpiData.totalWithCPAP} total={kpiData.totalWithUnit} percentage={kpiData.cpapPercentage} className="flex-1" borderClass="border-s-teal-500" valueClass="text-teal-600" decorationColor="bg-teal-500" colorTheme="teal" />
                        </>
                    )}
                </div>
                 {loading ? <div className="lg:col-span-2 flex justify-center items-center h-64"><Spinner/></div> : (
                    <div className="lg:col-span-2 flex flex-col h-full">
                        <Card className="p-0 flex flex-col flex-grow shadow-sm border border-gray-200 rounded-xl h-full">
                            <div className="p-4 md:p-5 border-b bg-slate-50/50 rounded-t-xl flex justify-between items-start gap-4">
                                <h3 className="text-lg font-bold text-gray-800 leading-tight">{t('dashboard.headers.geographic_map', 'Geographical Map')}</h3>
                                <button onClick={handleCopyImage} className="text-gray-400 hover:text-sky-600 transition-colors p-1 shrink-0" disabled={!!copyStatus && copyStatus !== 'Failed'}>{copyStatus ? <span className="text-[10px] font-semibold text-sky-600">{copyStatus}</span> : <CopyIcon />}</button>
                            </div>
                            <div className="flex-grow min-h-[400px] p-2 relative flex flex-col">
                                <div className='flex-grow min-h-0 h-full w-full'>
                                    <SudanMap data={!isLocalityView && currentMapViewLevel === 'state' ? nationalMapData : []} localityData={isLocalityView ? stateData : []} facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []} viewLevel={currentMapViewLevel} {...mapViewConfig} isMovable={false} pannable={false} />
                                </div>
                            </div>
                            <div className="bg-slate-50 border-t border-gray-200 rounded-b-xl py-3 px-4 flex flex-col xl:flex-row justify-between items-center gap-4">
                                <MapLegend showPlanned={true} />
                                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto w-full xl:w-auto justify-end ignore-for-export">
                                    {!isLocalityView && (
                                        <div className="flex rounded-md shadow-sm shrink-0 mx-1">
                                            <button onClick={() => setMapViewLevel('state')} className={`px-3 py-1.5 text-xs font-semibold rounded-s-md ${mapViewLevel === 'state' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>{t('dashboard.map.state', 'State')}</button>
                                            <button onClick={() => setMapViewLevel('locality')} className={`px-3 py-1.5 text-xs font-semibold rounded-e-md ${mapViewLevel === 'locality' ? 'bg-sky-700 text-white border border-sky-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-s-0 border-gray-200'}`}>{t('dashboard.map.locality', 'Locality')}</button>
                                        </div>
                                    )}
                                    <button onClick={() => setShowFacilityMarkers(!showFacilityMarkers)} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-sm shrink-0 ${showFacilityMarkers ? 'bg-slate-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{showFacilityMarkers ? t('dashboard.map.hide_fac', 'Hide Fac.') : t('dashboard.map.show_fac', 'Show Fac.')}</button>
                                    <button onClick={() => setIsMapFullscreen(true)} className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-100 rounded-md hover:bg-sky-200 transition-colors shadow-sm shrink-0">{t('dashboard.map.full', 'Full')}</button>
                                </div>
                            </div>
                        </Card>
                    </div>
                 )}
            </div>
            
            {!loading && (
            <>
                {/* HORIZONTAL SCNU Chart & Table */}
                <div className="mt-6 grid grid-cols-1 gap-6 items-stretch relative">
                    <Card className="p-0 flex flex-col overflow-hidden border border-gray-200 rounded-xl">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{t('dashboard.headers.scnu_coverage', `Neonatal (${displayTargetLevel}) Coverage by`)} {aggregationLevelName}</h3>
                            <button onClick={() => copyTableAsImage(coverageTableRef, setTable1CopyStatus)} className="text-gray-400 hover:text-sky-600 transition-colors p-1"> {table1CopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{table1CopyStatus}</span> : <CopyIcon />} </button>
                        </div>
                        <div className="flex-grow overflow-x-auto p-4">
                           <table ref={coverageTableRef} className='min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden'>
                                <thead>
                                    <tr>
                                        <th className="p-3 border-b border-gray-200 bg-slate-50 text-start font-semibold text-gray-600 uppercase tracking-wider w-[25%]">{aggregationLevelName}</th>
                                        <th className="p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase tracking-wider w-[15%]">{t('dashboard.table.total_supposed', 'Total Supposed')}</th>
                                        <th className="p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase tracking-wider w-[15%]">{t('dashboard.table.with_scnu', 'With Unit')}</th>
                                        <th className="p-3 border-b border-gray-200 bg-slate-50 text-start font-semibold text-gray-600 uppercase tracking-wider w-[45%]">{t('dashboard.table.coverage_chart', 'Coverage Chart')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTableData.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-gray-500">{t('dashboard.table.no_data', 'No data matches the current filters.')}</td></tr> :
                                     sortedTableData.map(row => (
                                        <tr key={row.key} className='hover:bg-blue-50/50 transition-colors border-b border-gray-100'>
                                            <td className="p-3 whitespace-nowrap font-medium text-gray-700 text-start">{row.name}</td>
                                            <td className="p-3 text-center align-middle font-medium">{row.totalSupposed}</td>
                                            <td className="p-3 text-center font-bold text-sky-700 align-middle">{row.totalWithUnit} <span className="text-gray-400 font-normal ms-1">({row.coverage}%)</span></td>
                                            <td className="p-3 align-middle text-start">
                                                <div className="flex items-center w-full">
                                                    <div className="flex-grow bg-gray-200 rounded-sm h-3 overflow-hidden flex"><div className={`h-full transition-all shadow-sm ${row.coverage >= 75 ? 'bg-sky-700' : row.coverage >= 40 ? 'bg-sky-400' : 'bg-gray-600'}`} style={{ width: `${Math.max(row.coverage, 1)}%` }}></div></div>
                                                    <span className="ms-3 text-[11px] font-bold text-gray-700 w-8 text-end">{row.coverage}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div className="mt-6">
                    <Card className="p-0 overflow-hidden border border-gray-200 rounded-xl">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{t('dashboard.headers.neonatal_equipment', 'Neonatal Unit Equipment Availability')}</h3>
                            <button onClick={() => copyTableAsImage(equipmentTableRef, setTable2CopyStatus)} className="text-gray-400 hover:text-sky-600 transition-colors p-1"> {table2CopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{table2CopyStatus}</span> : <CopyIcon />} </button>
                        </div>
                        <div className="w-full overflow-x-auto p-4">
                            <table ref={equipmentTableRef} className="w-full table-fixed border-collapse text-[10px] border border-gray-200">
                                <thead className="bg-slate-50 border-b border-gray-200">
                                    <tr>{equipmentHeaders.map((header, index) => ( <th key={index} className={`p-2 text-start font-semibold tracking-wider text-gray-600 uppercase align-bottom leading-tight ${index === 0 ? 'w-[15%]' : ''}`}> <div className='font-bold break-words text-center'>{header}</div> </th> ))}</tr>
                                </thead>
                                <tbody>
                                    {equipmentTableData.map(row => ( 
                                        <tr key={row.name} className="hover:bg-slate-50 transition-colors border-b border-gray-100">
                                            <td className="font-medium text-gray-700 p-2 break-words leading-tight text-start">{row.name}</td>
                                            {NEONATAL_EQUIPMENT_KEYS.map(key => { const value = row[key]; const cellClass = value === 0 ? 'bg-red-50 text-red-600 font-bold' : 'text-gray-700 font-medium'; return ( <td key={key} className={`p-2 ${cellClass} text-center border-s border-gray-100`}> {value} </td> ); })}
                                        </tr> 
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div className="mt-6">
                    <Card className="p-0 overflow-hidden border border-gray-200 rounded-xl">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{
                                neonatalStatusFilter === 'Planned' ? t('dashboard.headers.planned_neonatal_units', 'Planned Neonatal Units List') :
                                neonatalStatusFilter === 'No' ? t('dashboard.headers.no_neonatal_units', 'Facilities without Neonatal Units List') :
                                t('dashboard.headers.functioning_neonatal_units', 'Functioning Neonatal Units List')
                            }</h3>
                            <button onClick={() => copyTableAsImage(scnuListTableRef, setTable3CopyStatus)} className="text-gray-400 hover:text-sky-600 transition-colors p-1"> {table3CopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{table3CopyStatus}</span> : <CopyIcon />} </button>
                        </div>
                        <div className="overflow-x-auto w-full max-h-[500px] overflow-y-auto p-4">
                            <table ref={scnuListTableRef} className="min-w-full table-auto border-collapse text-sm border border-gray-200">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                                    <tr>
                                        <th className="p-3 text-start font-semibold text-gray-600 uppercase text-[11px] tracking-wider">{t('dashboard.table.state', 'State')}</th>
                                        <th className="p-3 text-start font-semibold text-gray-600 uppercase text-[11px] tracking-wider">{t('dashboard.table.locality', 'Locality')}</th>
                                        <th className="p-3 text-start font-semibold text-gray-600 uppercase text-[11px] tracking-wider">{t('dashboard.table.hospital_name', 'Facility Name')}</th>
                                        <th className="p-3 text-center font-semibold text-gray-600 uppercase text-[11px] tracking-wider">{t('dashboard.table.incubators', 'Incubators')}</th>
                                        <th className="p-3 text-center font-semibold text-gray-600 uppercase text-[11px] tracking-wider">{t('dashboard.table.cots', 'Cots')}</th>
                                        <th className="p-3 text-center font-semibold text-gray-600 uppercase text-[11px] tracking-wider">{t('dashboard.table.total_beds', 'Total Beds')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {facilityNeonatalTableData.length === 0 ? <tr><td colSpan="6" className="p-4 text-center text-gray-500">{t('dashboard.table.no_data', 'No facilities found matching the current filters.')}</td></tr> : facilityNeonatalTableData.map(row => (
                                            <tr key={row.id} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                                                <td className="p-3 font-medium text-gray-800 text-start">{row.state}</td>
                                                <td className="p-3 text-gray-600 text-start">{row.locality}</td>
                                                <td className="p-3 font-bold text-sky-700 text-start">{row.facilityName}</td>
                                                <td className="p-3 text-center font-medium">{row.incubators}</td>
                                                <td className="p-3 text-center font-medium">{row.cots}</td>
                                                <td className="p-3 text-center font-black text-indigo-700 bg-indigo-50/30">{row.totalBeds}</td>
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
                             <h3 className="text-xl font-bold text-gray-800">{t('dashboard.headers.geographic_map', 'Geographical Map')}</h3>
                             <div className='flex items-center gap-2 ignore-for-export'>
                                <button onClick={() => setIsMapFullscreen(false)} className="px-4 py-2 text-sm font-bold text-white bg-slate-800 rounded-md hover:bg-slate-700 ms-2 shadow-sm">{t('dashboard.map.close', 'Close')}</button>
                             </div>
                        </div>

                        <div className="flex-grow min-h-0 flex gap-4">
                            <div className={`flex-grow min-h-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 relative flex flex-col ${isLocalityView ? 'w-2/3' : 'w-full'}`}>
                                <div className="flex-grow min-h-0">
                                    <SudanMap
                                        data={!isLocalityView && currentMapViewLevel === 'state' ? nationalMapData : []}
                                        localityData={isLocalityView ? stateData : []}
                                        facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []}
                                        viewLevel={currentMapViewLevel}
                                        {...mapViewConfig}
                                        onStateHover={handleMapHover} onStateLeave={handleMapMouseLeave}
                                        onFacilityHover={handleFacilityHover} onFacilityLeave={handleFacilityLeave}
                                        onLocalityHover={handleMapHover} onLocalityLeave={handleMapMouseLeave}
                                        isMovable={false}
                                        pannable={false}
                                    />
                                </div>
                                <div className="bg-slate-50 border-t border-gray-200 py-2 shrink-0">
                                    <MapLegend showPlanned={true} />
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

// --- EENC DASHBOARD ---
const EENC_EQUIPMENT_SPEC = { 'eenc_delivery_beds': 'Delivery Beds', 'eenc_resuscitation_stations': 'Resuscitation Stations', 'eenc_warmers': 'Warmers', 'eenc_ambu_bags': 'Ambu Bags', 'eenc_manual_suction': 'Manual Suction', 'eenc_wall_clock': 'Wall Clock', 'eenc_steam_sterilizer': 'Steam Sterilizer' };
const EENC_EQUIPMENT_KEYS = Object.keys(EENC_EQUIPMENT_SPEC);

export const EENCCoverageDashboard = ({ userStates, userLocalities }) => {
    const { t, i18n } = useTranslation();
    const { healthFacilities: allFacilities, isLoading } = useDataCache();
    const loading = isLoading.healthFacilities || allFacilities === null;
    const activeFacilities = useMemo(() => (allFacilities || []).filter(f => f.isDeleted !== true && f.isDeleted !== "true"), [allFacilities]);

    const [stateFilter, setStateFilter] = useState(userStates?.length === 1 ? userStates[0] : ''); 
    const [localityFilter, setLocalityFilter] = useState(userLocalities?.length === 1 ? userLocalities[0] : ''); 
    const [ownershipFilter, setOwnershipFilter] = useState(''); 
    const [projectFilter, setProjectFilter] = useState('');
    const [equipmentFilter, setEquipmentFilter] = useState('');
    const [mapViewLevel, setMapViewLevel] = useState('state');
    const [copyStatus, setCopyStatus] = useState('');
    const [tooltipData, setTooltipData] = useState(null); 
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [showFacilityMarkers, setShowFacilityMarkers] = useState(true);
    const [table1CopyStatus, setTable1CopyStatus] = useState('');
    const [table2CopyStatus, setTable2CopyStatus] = useState('');
    const dashboardSectionRef = useRef(null);
    const coverageTableRef = useRef(null);
    const equipmentTableRef = useRef(null);
    const [isMapFullscreen, setIsMapFullscreen] = useState(false);
    
    const isLocalityView = !!stateFilter; 
    const projectOptions = useMemo(() => [...new Set(activeFacilities.map(f => f.project_name?.trim()).filter(Boolean))].sort(), [activeFacilities]);

    const isEmONCFacility = useCallback((f) => ['BEmONC', 'CEmONC'].includes(f['eenc_service_type']), []);
    const isEmONCFunctional = useCallback((f) => isEmONCFacility(f) && f['هل_المؤسسة_تعمل'] === 'Yes', [isEmONCFacility]);
    const providesEENC = useCallback((f) => isEmONCFacility(f) && f['eenc_provides_essential_care'] === 'Yes', [isEmONCFacility]);
    
    const locationFilteredFacilities = useMemo(() => {
        return activeFacilities.filter(f => {
            if(f['الولاية'] === 'إتحادي') return false;
            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;
            if (ownershipFilter && f.facility_ownership !== ownershipFilter) return false;
            if (projectFilter && f.project_name !== projectFilter) return false;
            if (equipmentFilter) { const val = f[equipmentFilter]; if (val !== 'Yes' && (Number(val) || 0) === 0) return false; } 
            return true;
        });
    }, [activeFacilities, stateFilter, localityFilter, ownershipFilter, projectFilter, equipmentFilter]); 

    const kpiData = useMemo(() => {
        const totalEmONC = locationFilteredFacilities.filter(isEmONCFacility).length;
        const totalFunctionalEmONC = locationFilteredFacilities.filter(isEmONCFunctional).length;
        const totalEENCProviders = locationFilteredFacilities.filter(isEmONCFunctional).filter(providesEENC).length;
        return {
            totalEmONC, totalFunctionalEmONC, totalEENCProviders, 
            eencCoveragePercentage: totalFunctionalEmONC > 0 ? Math.round((totalEENCProviders / totalFunctionalEmONC) * 100) : 0
        };
    }, [locationFilteredFacilities, isEmONCFacility, isEmONCFunctional, providesEENC]); 

    const { tableData, mapData } = useMemo(() => {
        const s = {};
        const aggF = stateFilter ? 'المحلية' : 'الولاية';
        locationFilteredFacilities.forEach(f => {
            const key = f[aggF];
            if (!key || key === 'إتحادي') return;
            if (!s[key]) s[key] = { 
                name: stateFilter ? getLocalizedLocalityName(stateFilter, key, i18n.language) : getLocalizedStateName(key, i18n.language), 
                key, functionalEmONC: 0, eencProviders: 0 
            };
            if (isEmONCFunctional(f)) {
                s[key].functionalEmONC++;
                if (providesEENC(f)) s[key].eencProviders++;
            }
        });
        const tD = Object.values(s).map(st => ({ ...st, eencCoverage: st.functionalEmONC > 0 ? Math.round((st.eencProviders / st.functionalEmONC) * 100) : 0 })).sort((a, b) => b.eencCoverage - a.eencCoverage);
        const mD = tD.map(st => ({ state: st.key, percentage: st.eencCoverage, coordinates: mapCoordinates[st.key] ? [mapCoordinates[st.key].lng, mapCoordinates[st.key].lat] : [0, 0] }));
        return { tableData: tD, mapData: mD };
    }, [locationFilteredFacilities, stateFilter, isEmONCFunctional, providesEENC, i18n.language]); 

    const equipmentTableData = useMemo(() => {
        const aggK = stateFilter ? 'اسم_المؤسسة' : 'الولاية';
        const facP = locationFilteredFacilities.filter(f => isEmONCFunctional(f) && providesEENC(f)); 
        const s = {};
        facP.forEach(f => {
            const key = f[aggK];
            if (!key || key === 'إتحادي') return;
            if (!s[key]) s[key] = { 
                name: stateFilter ? f['اسم_المؤسسة'] : getLocalizedStateName(key, i18n.language), 
                key, ...Object.fromEntries(EENC_EQUIPMENT_KEYS.map(k => [k, 0])) 
            };
            EENC_EQUIPMENT_KEYS.forEach(eK => { const val = f[eK]; s[key][eK] += (val === 'Yes') ? 1 : (Number(val) || 0); });
        });
        return Object.values(s).filter(st => st.key !== 'إتحادي').sort((a, b) => (b.eenc_delivery_beds || 0) - (a.eenc_delivery_beds || 0));
    }, [locationFilteredFacilities, stateFilter, isEmONCFunctional, providesEENC, i18n.language]);

    const facilityLocationMarkers = useMemo(() => locationFilteredFacilities.filter(f=> isEmONCFunctional(f) && providesEENC(f) &&f['_الإحداثيات_longitude']).map(f=>({key:f.id,name:f['اسم_المؤسسة'],coordinates:[f['_الإحداثيات_longitude'],f['_الإحداثيات_latitude']]})), [locationFilteredFacilities, isEmONCFunctional, providesEENC]);
    const mapViewConfig = useMemo(() => { const sC=stateFilter?mapCoordinates[stateFilter]:null; return sC ? {center:[sC.lng,sC.lat],scale:sC.scale,focusedState:stateFilter} : {center:[30,15.5],scale:2000,focusedState:null}; }, [stateFilter]);
    const handleStateChange = (e) => { setStateFilter(e.target.value); setLocalityFilter(''); };
    const currentMapViewLevel = stateFilter ? 'locality' : mapViewLevel;
    const aggregationLevelName = stateFilter ? t('dashboard.table.locality', 'Locality') : t('dashboard.table.state', 'State');

    const getEENCStateEquipmentSummary = useCallback((stateKey) => { 
        const rel = activeFacilities.filter(f => f['الولاية'] === stateKey && isEmONCFunctional(f) && providesEENC(f) && (!ownershipFilter || f.facility_ownership === ownershipFilter) && (!projectFilter || f.project_name === projectFilter));
        const sum = {};
        EENC_EQUIPMENT_KEYS.forEach(k => { sum[EENC_EQUIPMENT_SPEC[k]] = 0; });
        rel.forEach(f => {
            EENC_EQUIPMENT_KEYS.forEach(k => {
                const val = f[k];
                sum[EENC_EQUIPMENT_SPEC[k]] += (val === 'Yes') ? 1 : (Number(val) || 0);
            });
        });
        return { totalUnits: rel.length, summary: sum }; 
    }, [activeFacilities, isEmONCFunctional, providesEENC, ownershipFilter, projectFilter]);

    const getEENCLocalityEquipmentSummary = useCallback((localityKey, stateKey) => { 
        const rel = activeFacilities.filter(f => f['الولاية'] === stateKey && f['المحلية'] === localityKey && isEmONCFunctional(f) && providesEENC(f) && (!ownershipFilter || f.facility_ownership === ownershipFilter) && (!projectFilter || f.project_name === projectFilter));
        const sum = {};
        EENC_EQUIPMENT_KEYS.forEach(k => { sum[EENC_EQUIPMENT_SPEC[k]] = 0; });
        rel.forEach(f => {
            EENC_EQUIPMENT_KEYS.forEach(k => {
                const val = f[k];
                sum[EENC_EQUIPMENT_SPEC[k]] += (val === 'Yes') ? 1 : (Number(val) || 0);
            });
        });
        return { totalUnits: rel.length, summary: sum }; 
    }, [activeFacilities, isEmONCFunctional, providesEENC, ownershipFilter, projectFilter]);
    
    const handleStateHover = useCallback((stateKey, event)=>{ if(stateFilter||mapViewLevel==='locality')return; const rowData=tableData.find(d=>d.key===stateKey); if(!rowData) return; const eqSum=getEENCStateEquipmentSummary(stateKey);setTooltipData({title:`${rowData.name} (${rowData.key})`,dataRows:[{label:t('dashboard.headers.eenc_coverage', "EENC Coverage"),value:`${rowData.eencCoverage}% (${rowData.eencProviders} / ${rowData.functionalEmONC})`}],equipmentSummary:{...eqSum,title:t('dashboard.headers.eenc_equipment', "EENC Equipment Summary")}});setHoverPosition({x:event.clientX,y:event.clientY}); }, [tableData, stateFilter, mapViewLevel, getEENCStateEquipmentSummary, t]);
    
    const handleMapLocalityHover = useCallback((geoProps, event)=>{ 
        const locKey=geoProps.admin_2;
        if (!locKey) return; 
        const locData = tableData.find(l=>l.key===locKey);
        if(!locData) return;
        const stateKey = stateFilter;
        const eqSum = getEENCLocalityEquipmentSummary(locKey,stateKey);
        setTooltipData({
            title: `${locData.name} (${locData.key})`,
            dataRows: [{label: t('dashboard.headers.eenc_coverage', "EENC Coverage"), value: `${locData.eencCoverage}% (${locData.eencProviders} / ${locData.functionalEmONC})`}],
            equipmentSummary: {...eqSum, title: t('dashboard.headers.eenc_equipment', "EENC Equipment Summary")}
        });
        setHoverPosition({x:event.clientX,y:event.clientY}); 
    }, [tableData, stateFilter, getEENCLocalityEquipmentSummary, t]);

    const handleMapMouseLeave = useCallback(()=>{ setTooltipData(null); }, []);
    const handleMouseMove = useCallback((event)=>{ if(tooltipData){setHoverPosition({x:event.clientX,y:event.clientY});} }, [tooltipData]);

    const handleCopyImage = useCallback(async () => {
        if (dashboardSectionRef.current && navigator.clipboard?.write) {
            setCopyStatus('Copying...');
            try {
                const canvas = await html2canvas(dashboardSectionRef.current, { useCORS: true, scale: 2, backgroundColor: '#ffffff', ignoreElements: (e) => e.classList.contains('ignore-for-export') });
                canvas.toBlob(async (blob) => { if (blob) { await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]); setCopyStatus('Copied!'); } }, 'image/png', 0.95);
            } catch (err) { setCopyStatus('Failed'); } finally { setTimeout(() => setCopyStatus(''), 2000); }
        }
    }, []);

    return (
        <div onMouseMove={handleMouseMove}>
            
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm ignore-for-export mb-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <FormGroup label={t('dashboard.filters.state', 'State')}><Select value={stateFilter} onChange={handleStateChange}><option value="">{t('dashboard.filters.all_states', 'All States')}</option>{Object.keys(STATE_LOCALITIES).filter(s => s !== 'إتحادي').sort().map(sKey => <option key={sKey} value={sKey}>{getLocalizedStateName(sKey, i18n.language)}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.locality', 'Locality')}><Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}><option value="">{t('dashboard.filters.all_localities', 'All Localities')}</option>{stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a,b) => a.en.localeCompare(b.en)).map(l => <option key={l.en} value={l.en}>{getLocalizedLocalityName(stateFilter, l.en, i18n.language)}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.ownership', 'Ownership')}><Select value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value)}><option value="">{t('dashboard.filters.all_ownerships', 'All Ownerships')}</option>{OWNERSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.project', 'Project')}><Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="">{t('dashboard.filters.all_projects', 'All Projects')}</option>{projectOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.has_equipment', 'Has Equipment')}><Select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}><option value="">{t('dashboard.filters.any', 'Any')}</option>{Object.entries(EENC_EQUIPMENT_SPEC).map(([key, label]) => <option key={key} value={key}>{t(`dashboard.equip.${label}`, label)}</option>)}</Select></FormGroup>
                </div>
            </div>

             <div ref={dashboardSectionRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch relative">
                 <div className="lg:col-span-1 flex flex-col gap-4 h-full">
                    {loading ? <Spinner/> : (
                        <>
                            <TotalCountCard title={t('dashboard.cards.total_emonc', 'Total EmONC Facilities')} count={kpiData.totalEmONC} className="flex-1" borderClass="border-s-slate-400" valueClass="text-slate-700" decorationColor="bg-slate-500" />
                            <TotalCountCard title={t('dashboard.cards.functional_emonc', 'Functional EmONC Facilities')} count={kpiData.totalFunctionalEmONC} className="flex-1" borderClass="border-s-indigo-400" valueClass="text-indigo-700" decorationColor="bg-indigo-500" />
                            <ValueTotalPercentageCard title={t('dashboard.cards.eenc_coverage_functional', 'EENC Coverage in Functional EmONC')} value={kpiData.totalEENCProviders} total={kpiData.totalFunctionalEmONC} percentage={kpiData.eencCoveragePercentage} className="flex-1" borderClass="border-s-sky-500" valueClass="text-sky-600" decorationColor="bg-sky-500" colorTheme="sky" />
                        </>
                    )}
                </div>

                 {loading ? <div className="lg:col-span-2 flex justify-center items-center h-64"><Spinner/></div> : (
                    <div className="lg:col-span-2 flex flex-col h-full">
                        <Card className="p-0 flex flex-col flex-grow shadow-sm border border-gray-200 rounded-xl h-full">
                             <div className="p-4 md:p-5 border-b bg-slate-50/50 rounded-t-xl flex justify-between items-start gap-4">
                                 <h3 className="text-lg font-bold text-gray-800 leading-tight">{t('dashboard.headers.geographic_map', 'Geographical Map')}</h3>
                                 <button onClick={handleCopyImage} className="text-gray-400 hover:text-sky-600 transition-colors p-1 mt-0.5 shrink-0" disabled={!!copyStatus && copyStatus !== 'Failed'}>{copyStatus ? <span className="text-[10px] font-semibold text-sky-600">{copyStatus}</span> : <CopyIcon />}</button>
                            </div>
                            <div className="flex-grow min-h-[400px] p-2 relative flex flex-col">
                                 <div className='flex-grow min-h-0 h-full w-full'>
                                    <SudanMap data={!stateFilter && currentMapViewLevel === 'state' ? mapData : []} localityData={stateFilter ? tableData : []} facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []} viewLevel={currentMapViewLevel} {...mapViewConfig} isMovable={false} pannable={false} />
                                </div>
                            </div>
                            <div className="bg-slate-50 border-t border-gray-200 rounded-b-xl py-3 px-4 flex flex-col xl:flex-row justify-between items-center gap-4">
                                <MapLegend />
                                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto w-full xl:w-auto justify-end ignore-for-export">
                                    {!stateFilter && (
                                        <div className="flex rounded-md shadow-sm shrink-0 mx-1">
                                            <button onClick={() => setMapViewLevel('state')} className={`px-3 py-1.5 text-xs font-semibold rounded-s-md ${mapViewLevel === 'state' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`} > {t('dashboard.map.state', 'State')} </button>
                                            <button onClick={() => setMapViewLevel('locality')} className={`px-3 py-1.5 text-xs font-semibold rounded-e-md ${mapViewLevel === 'locality' ? 'bg-sky-700 text-white border border-sky-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-s-0 border-gray-200'}`} > {t('dashboard.map.locality', 'Locality')} </button>
                                        </div>
                                    )}
                                    <button onClick={() => setShowFacilityMarkers(!showFacilityMarkers)} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-sm shrink-0 ${showFacilityMarkers ? 'bg-slate-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{showFacilityMarkers ? t('dashboard.map.hide_fac', 'Hide Fac.') : t('dashboard.map.show_fac', 'Show Fac.')}</button>
                                    <button onClick={() => setIsMapFullscreen(true)} className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-100 rounded-md hover:bg-sky-200 transition-colors shadow-sm shrink-0">{t('dashboard.map.full', 'Full')}</button>
                                </div>
                            </div>
                        </Card>
                    </div>
                 )}
             </div>

            {!loading && (
            <>
                {/* HORIZONTAL EENC Chart & Table Combo */}
                <div className="mt-6 grid grid-cols-1 gap-6 items-stretch relative">
                    <Card className="p-0 flex flex-col overflow-hidden border border-gray-200 rounded-xl">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{t('dashboard.headers.eenc_coverage', 'EENC Coverage by')} {aggregationLevelName}</h3>
                            <button onClick={() => copyTableAsImage(coverageTableRef, setTable1CopyStatus)} className="text-gray-400 hover:text-sky-600 transition-colors p-1"> {table1CopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{table1CopyStatus}</span> : <CopyIcon />} </button>
                        </div>
                        <div className="flex-grow overflow-x-auto p-4">
                            <table ref={coverageTableRef} className='min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden'>
                                <thead>
                                    <tr>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-start font-semibold text-gray-600 uppercase tracking-wider w-[25%]'>{aggregationLevelName}</th>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase tracking-wider w-[15%]'>{t('dashboard.table.functional_emonc', 'Functional EmONC')}</th>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase tracking-wider w-[15%]'>{t('dashboard.table.with_eenc', 'With EENC')}</th>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-start font-semibold text-gray-600 uppercase tracking-wider w-[45%]'>{t('dashboard.table.coverage_chart', 'Coverage Chart')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-gray-500">{t('dashboard.table.no_data', 'No data matches the current filters.')}</td></tr> :
                                     tableData.map(row => ( 
                                        <tr key={row.key} className='hover:bg-blue-50/50 transition-colors border-b border-gray-100'>
                                            <td className="p-3 font-medium text-gray-700 text-start">{row.name}</td>
                                            <td className="p-3 text-center align-middle font-medium">{row.functionalEmONC}</td>
                                            <td className="p-3 text-center font-bold text-sky-700 align-middle">{row.eencProviders} <span className="text-gray-400 font-normal ms-1">({row.eencCoverage}%)</span></td>
                                            <td className="p-3 align-middle text-start">
                                                <div className="flex items-center w-full">
                                                    <div className="flex-grow bg-gray-200 rounded-sm h-3 overflow-hidden flex"><div className={`h-full transition-all shadow-sm ${row.eencCoverage >= 75 ? 'bg-sky-700' : row.eencCoverage >= 40 ? 'bg-sky-400' : 'bg-gray-600'}`} style={{ width: `${Math.max(row.eencCoverage, 1)}%` }}></div></div>
                                                    <span className="ms-3 text-[11px] font-bold text-gray-700 w-8 text-end">{row.eencCoverage}%</span>
                                                </div>
                                            </td>
                                        </tr> 
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div className="mt-6">
                    <Card className="p-0 overflow-hidden border border-gray-200 rounded-xl">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{t('dashboard.headers.eenc_equipment', 'EENC Equipment Availability by Unit')}</h3>
                            <button onClick={() => copyTableAsImage(equipmentTableRef, setTable2CopyStatus)} className="text-gray-400 hover:text-sky-600 transition-colors p-1"> {table2CopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{table2CopyStatus}</span> : <CopyIcon />} </button>
                        </div>
                        <div className="overflow-x-auto p-4">
                            <table ref={equipmentTableRef} className="min-w-full table-auto border-collapse text-[10px] border border-gray-200">
                                <thead className="bg-slate-50 border-b border-gray-200">
                                    <tr>
                                        <th className={`p-2 text-start font-semibold tracking-wider text-gray-600 uppercase align-bottom w-40`}><div className='font-bold break-words text-center'>{stateFilter ? t('dashboard.table.hospital_name', 'Hospital Name') : aggregationLevelName}</div></th>
                                        {Object.values(EENC_EQUIPMENT_SPEC).map((header, index) => ( <th key={index} className={`p-2 text-start font-semibold tracking-wider text-gray-600 uppercase align-bottom w-20`}><div className='font-bold break-words text-center'>{t(`dashboard.equip.${header}`, header)}</div></th> ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipmentTableData.map(row => ( 
                                        <tr key={row.name} className="hover:bg-slate-50 transition-colors border-b border-gray-100">
                                            <td className={`font-medium text-gray-700 p-2 break-words text-start`}>{row.name}</td>
                                            {EENC_EQUIPMENT_KEYS.map(key => { const value = row[key]; const cellClass = value === 0 ? 'bg-red-50 text-red-600 font-bold' : 'text-gray-700 font-medium'; return ( <td key={key} className={`p-2 ${cellClass} text-center border-s border-gray-100`}> {value} </td> ); })}
                                        </tr> 
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </>
            )}
        </div>
    );
};

// --- IMNCI DASHBOARD ---
// Updated to include all IMNCI tools and exactly match the FacilityForms keys
const IMNCI_FILTER_SPEC = { 
    'ميزان_وزن': 'Weight Scale', 
    'ميزان_طول': 'Height Scale', 
    'ميزان_حرارة': 'Thermometer', 
    'ساعة_مؤقت': 'Timer',
    'وجود_كتيب_لوحات': 'Chart Booklet', 
    'وجود_سجل_علاج_متكامل': 'IMNCI Register'
};

export const IMNCICoverageDashboard = ({ userStates, userLocalities }) => {
    const { t, i18n } = useTranslation();
    const { healthFacilities: allFacilities, isLoading, fetchHealthFacilities } = useDataCache();
    const loading = isLoading.healthFacilities || allFacilities === null;
    
    const activeFacilities = useMemo(() => (allFacilities || []).filter(f => f.isDeleted !== true && f.isDeleted !== "true"), [allFacilities]);

    const [stateFilter, setStateFilter] = useState(userStates?.length === 1 ? userStates[0] : '');
    const [localityFilter, setLocalityFilter] = useState(userLocalities?.length === 1 ? userLocalities[0] : '');
    const [ownershipFilter, setOwnershipFilter] = useState(''); 
    const [projectFilter, setProjectFilter] = useState('');
    const [equipmentFilter, setEquipmentFilter] = useState('');
    const [mapViewLevel, setMapViewLevel] = useState('state');
    const [copyStatus, setCopyStatus] = useState('');
    const [tooltipData, setTooltipData] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [showFacilityMarkers, setShowFacilityMarkers] = useState(false); 

    const [table1CopyStatus, setTable1CopyStatus] = useState('');
    const [table2CopyStatus, setTable2CopyStatus] = useState('');

    const dashboardSectionRef = useRef(null);
    const coverageTableRef = useRef(null);
    const toolsTableRef = useRef(null);
    
    useEffect(() => {
        if (activeFacilities !== null && activeFacilities.length > 0) {
            const intervalId = setInterval(() => { fetchHealthFacilities({}, true); }, 15 * 60 * 1000); 
            return () => clearInterval(intervalId);
        }
    }, [activeFacilities, fetchHealthFacilities]);

    const projectOptions = useMemo(() => [...new Set(activeFacilities.map(f => f.project_name?.trim()).filter(Boolean))].sort(), [activeFacilities]);

    const locationFilteredFacilities = useMemo(() => {
        return activeFacilities.filter(f => {
            if(f['الولاية'] === 'إتحادي') return false;
            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;
            if (ownershipFilter && f.facility_ownership !== ownershipFilter) return false;
            if (projectFilter && f.project_name !== projectFilter) return false;
            if (equipmentFilter && f[equipmentFilter] !== 'Yes') return false; 
            return true;
        });
    }, [activeFacilities, stateFilter, localityFilter, ownershipFilter, projectFilter, equipmentFilter]); 

    const functioningPhcs = useMemo(() => locationFilteredFacilities.filter(f => f['هل_المؤسسة_تعمل'] === 'Yes' && ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية'])), [locationFilteredFacilities]);
    const imnciInPhcs = useMemo(() => functioningPhcs.filter(f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes'), [functioningPhcs]);
    const imnciCoveragePercentage = useMemo(() => functioningPhcs.length > 0 ? Math.round((imnciInPhcs.length / functioningPhcs.length) * 100) : 0, [imnciInPhcs, functioningPhcs]);

    const isLocalityView = !!stateFilter && !localityFilter;
    const isFacilityView = !!localityFilter;
    const aggregationLevelName = isFacilityView ? t('dashboard.table.hospital_name', 'Facility') : (isLocalityView ? t('dashboard.table.locality', 'Locality') : t('dashboard.table.state', 'State'));

    const tableCoverageData = useMemo(() => {
        const s={};
        const aggKey = isFacilityView ? 'اسم_المؤسسة' : (isLocalityView ? 'المحلية' : 'الولاية');

        locationFilteredFacilities.forEach(f=>{
            const isPhc=f['هل_المؤسسة_تعمل']==='Yes' && ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية']);
            if(!isPhc) return;

            const key=f[aggKey];
            if(!key || key === 'إتحادي')return;
            
            if(!s[key]){
                s[key]={
                    name: isFacilityView ? key : (isLocalityView ? getLocalizedLocalityName(stateFilter, key, i18n.language) : getLocalizedStateName(key, i18n.language)), 
                    key, totalFunctioningPhc:0, totalPhcWithImnci:0
                };
            }
            s[key].totalFunctioningPhc++;
            if(f['وجود_العلاج_المتكامل_لامراض_الطفولة']==='Yes') s[key].totalPhcWithImnci++;
        });

        return Object.values(s).map(st=>({...st,coverage:st.totalFunctioningPhc>0?Math.round((st.totalPhcWithImnci/st.totalFunctioningPhc)*100):0})).sort((a,b) => b.coverage - a.coverage);
    }, [locationFilteredFacilities, stateFilter, isLocalityView, isFacilityView, i18n.language]); 

    // --- Tools calculation aligned with exact FacilityForms keys ---
    const tableToolsData = useMemo(() => {
        const s={};
        const aggKey = isFacilityView ? 'اسم_المؤسسة' : (isLocalityView ? 'المحلية' : 'الولاية');
        
        functioningPhcs.forEach(f=>{
            const key=f[aggKey];
             if(!key || key === 'إتحادي')return;
            if(!s[key]){
                s[key]={
                    name: isFacilityView ? key : (isLocalityView ? getLocalizedLocalityName(stateFilter, key, i18n.language) : getLocalizedStateName(key, i18n.language)), 
                    key, totalPhcs:0, countWithRegister:0, countWithChartbooklet:0, countWithWeightScale:0, countWithHeightScale:0, countWithThermometer:0, countWithTimer:0
                };
            }
            s[key].totalPhcs++;
            if(f['وجود_سجل_علاج_متكامل']==='Yes')s[key].countWithRegister++;
            if(f['وجود_كتيب_لوحات']==='Yes')s[key].countWithChartbooklet++;
            if(f['ميزان_وزن']==='Yes')s[key].countWithWeightScale++;
            if(f['ميزان_طول']==='Yes')s[key].countWithHeightScale++;
            if(f['ميزان_حرارة']==='Yes')s[key].countWithThermometer++;
            if(f['ساعة_مؤقت']==='Yes')s[key].countWithTimer++;
        });
        
        return Object.values(s).map(st=>{
            const total=st.totalPhcs;
            return {
                ...st,
                percentageWithRegister: total>0 ? Math.round((st.countWithRegister/total)*100) : 0,
                percentageWithChartbooklet: total>0 ? Math.round((st.countWithChartbooklet/total)*100) : 0,
                percentageWithWeightScale: total>0 ? Math.round((st.countWithWeightScale/total)*100) : 0,
                percentageWithHeightScale: total>0 ? Math.round((st.countWithHeightScale/total)*100) : 0,
                percentageWithThermometer: total>0 ? Math.round((st.countWithThermometer/total)*100) : 0,
                percentageWithTimer: total>0 ? Math.round((st.countWithTimer/total)*100) : 0
            };
        }).sort((a,b)=> String(a.name).localeCompare(String(b.name)));
    }, [functioningPhcs, isLocalityView, isFacilityView, i18n.language]);

    const toolsAverages = useMemo(() => {
        if (functioningPhcs.length === 0) return null;
        let totalRegister = 0, totalChart = 0, totalScale = 0, totalHeight = 0, totalThermometer = 0, totalTimer = 0;
        
        functioningPhcs.forEach(f => {
            if(f['وجود_سجل_علاج_متكامل']==='Yes') totalRegister++;
            if(f['وجود_كتيب_لوحات']==='Yes') totalChart++;
            if(f['ميزان_وزن']==='Yes') totalScale++;
            if(f['ميزان_طول']==='Yes') totalHeight++;
            if(f['ميزان_حرارة']==='Yes') totalThermometer++;
            if(f['ساعة_مؤقت']==='Yes') totalTimer++;
        });
        
        const total = functioningPhcs.length;
        return { 
            total, 
            totalRegister, pRegister: total > 0 ? Math.round((totalRegister/total)*100) : 0, 
            totalChart, pChart: total > 0 ? Math.round((totalChart/total)*100) : 0, 
            totalScale, pScale: total > 0 ? Math.round((totalScale/total)*100) : 0, 
            totalHeight, pHeight: total > 0 ? Math.round((totalHeight/total)*100) : 0, 
            totalThermometer, pThermometer: total > 0 ? Math.round((totalThermometer/total)*100) : 0, 
            totalTimer, pTimer: total > 0 ? Math.round((totalTimer/total)*100) : 0 
        };
    }, [functioningPhcs]);

    const facilityLocationMarkers = useMemo(() => imnciInPhcs.filter(f => f['_الإحداثيات_longitude'] && f['_الإحداثيات_latitude']).map(f => ({key: f.id, name: f['اسم_المؤسسة'], coordinates: [f['_الإحداثيات_longitude'], f['_الإحداثيات_latitude']]})), [imnciInPhcs]);
    
    const nationalMapData = useMemo(() => { 
        const s = {};
        locationFilteredFacilities.forEach(f => {
            const k = f['الولاية'];
            if (!k || k === 'إتحادي') return;
            if (!s[k]) s[k] = { tFP: 0, tPI: 0 };
            if (f['هل_المؤسسة_تعمل'] === 'Yes' && ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية'])) {
                s[k].tFP++;
                if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') s[k].tPI++;
            }
        });
        return Object.entries(s).map(([sK, c]) => ({ state: sK, percentage: c.tFP > 0 ? Math.round((c.tPI / c.tFP) * 100) : 0, coordinates: mapCoordinates[sK] ? [mapCoordinates[sK].lng, mapCoordinates[sK].lat] : [0, 0] }));
    }, [locationFilteredFacilities]);

    const mapViewConfig = useMemo(() => { const sC=stateFilter?mapCoordinates[stateFilter]:null; return sC ? {center:[sC.lng,sC.lat],scale:sC.scale,focusedState:stateFilter} : {center:[30,15.5],scale:2000,focusedState:null}; }, [stateFilter]);
    const handleStateChange = (e) => { setStateFilter(e.target.value); setLocalityFilter(''); };
    
    const handleMapHover = useCallback((key, event) => setHoverPosition({ x: event.clientX, y: event.clientY }), []);
    const handleMapMouseLeave = useCallback(() => setTooltipData(null), []);
    const handleMouseMove = useCallback((e) => { if (tooltipData) setHoverPosition({ x: e.clientX, y: e.clientY }); }, [tooltipData]);
    const currentMapViewLevel = stateFilter && !localityFilter ? 'locality' : mapViewLevel;

    const handleCopyImage = useCallback(async () => {
        if (dashboardSectionRef.current && navigator.clipboard?.write) {
            setCopyStatus('Copying...');
            try {
                const canvas = await html2canvas(dashboardSectionRef.current, { useCORS: true, scale: 2, backgroundColor: '#ffffff', ignoreElements: (e) => e.classList.contains('ignore-for-export') });
                canvas.toBlob(async (blob) => { if (blob) { await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]); setCopyStatus('Copied!'); } }, 'image/png', 0.95);
            } catch (err) { setCopyStatus('Failed'); } finally { setTimeout(() => setCopyStatus(''), 2000); }
        }
    }, []);

    const getPercentageColorClass = (percentage) => {
        if (percentage >= 75) return 'bg-green-50 text-green-800 font-bold';
        if (percentage >= 50) return 'bg-yellow-50 text-yellow-800 font-bold';
        return 'bg-red-50 text-red-800 font-bold';
    };

    return (
        <div onMouseMove={handleMouseMove}>
            
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm ignore-for-export mb-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <FormGroup label={t('dashboard.filters.state', 'State')}><Select value={stateFilter} onChange={handleStateChange}><option value="">{t('dashboard.filters.all_states', 'All States')}</option>{Object.keys(STATE_LOCALITIES).filter(s => s !== 'إتحادي').sort().map(sKey => <option key={sKey} value={sKey}>{getLocalizedStateName(sKey, i18n.language)}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.locality', 'Locality')}><Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}><option value="">{t('dashboard.filters.all_localities', 'All Localities')}</option>{stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a,b) => a.en.localeCompare(b.en)).map(l => <option key={l.en} value={l.en}>{getLocalizedLocalityName(stateFilter, l.en, i18n.language)}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.ownership', 'Ownership')}><Select value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value)}><option value="">{t('dashboard.filters.all_ownerships', 'All Ownerships')}</option>{OWNERSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.project', 'Project')}><Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="">{t('dashboard.filters.all_projects', 'All Projects')}</option>{projectOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.has_equipment', 'Has Tool')}><Select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}><option value="">{t('dashboard.filters.any', 'Any')}</option>{Object.entries(IMNCI_FILTER_SPEC).map(([key, label]) => <option key={key} value={key}>{t(`dashboard.table.${label.replace(/ /g, '_').toLowerCase()}`, label)}</option>)}</Select></FormGroup>
                </div>
            </div>

             <div ref={dashboardSectionRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch relative">
                 <div className="lg:col-span-1 flex flex-col gap-4 h-full">
                    {loading ? <Spinner/> : (
                        <>
                            <TotalCountCard title={t('dashboard.cards.total_functioning_phc', 'Total Functioning PHC Facilities')} count={functioningPhcs.length} className="flex-1" borderClass="border-s-slate-400" valueClass="text-slate-700" decorationColor="bg-slate-500" />
                            <TotalCountCard title={t('dashboard.cards.total_phc_imnci', 'Total PHC Facilities with IMNCI')} count={imnciInPhcs.length} className="flex-1" borderClass="border-s-indigo-400" valueClass="text-indigo-700" decorationColor="bg-indigo-500" />
                            <ValueTotalPercentageCard title={t('dashboard.cards.imnci_coverage_phc', 'IMNCI Service Coverage in PHCs')} value={imnciInPhcs.length} total={functioningPhcs.length} percentage={imnciCoveragePercentage} className="flex-1" borderClass="border-s-sky-500" valueClass="text-sky-600" decorationColor="bg-sky-500" colorTheme="sky" />
                        </>
                    )}
                </div>

                 {loading ? <div className="lg:col-span-2 flex justify-center items-center h-64"><Spinner/></div> : (
                    <div className="lg:col-span-2 flex flex-col h-full">
                        <Card className="p-0 flex flex-col flex-grow shadow-sm border border-gray-200 rounded-xl h-full">
                             <div className="p-4 md:p-5 border-b bg-slate-50/50 rounded-t-xl flex justify-between items-start gap-4">
                                 <h3 className="text-lg font-bold text-gray-800 leading-tight">{t('dashboard.headers.geographic_map', 'Geographical Map')}</h3>
                                 <button onClick={handleCopyImage} className="text-gray-400 hover:text-sky-600 transition-colors p-1 mt-0.5 shrink-0" disabled={!!copyStatus && copyStatus !== 'Failed'}>{copyStatus ? <span className="text-[10px] font-semibold text-sky-600">{copyStatus}</span> : <CopyIcon />}</button>
                            </div>
                            <div className="flex-grow min-h-[400px] p-2 relative flex flex-col">
                                 <div className='flex-grow min-h-0 h-full w-full'>
                                    <SudanMap data={!stateFilter && currentMapViewLevel === 'state' ? nationalMapData : []} localityData={stateFilter ? tableCoverageData : []} facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []} viewLevel={currentMapViewLevel} {...mapViewConfig} isMovable={false} pannable={false} />
                                </div>
                            </div>
                            <div className="bg-slate-50 border-t border-gray-200 rounded-b-xl py-3 px-4 flex flex-col xl:flex-row justify-between items-center gap-4">
                                <MapLegend />
                                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto w-full xl:w-auto justify-end ignore-for-export">
                                    {!stateFilter && (
                                        <div className="flex rounded-md shadow-sm shrink-0 mx-1">
                                            <button onClick={() => setMapViewLevel('state')} className={`px-3 py-1.5 text-xs font-semibold rounded-s-md ${mapViewLevel === 'state' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`} > {t('dashboard.map.state', 'State')} </button>
                                            <button onClick={() => setMapViewLevel('locality')} className={`px-3 py-1.5 text-xs font-semibold rounded-e-md ${mapViewLevel === 'locality' ? 'bg-sky-700 text-white border border-sky-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-s-0 border-gray-200'}`} > {t('dashboard.map.locality', 'Locality')} </button>
                                        </div>
                                    )}
                                    <button onClick={() => setShowFacilityMarkers(!showFacilityMarkers)} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-sm shrink-0 ${showFacilityMarkers ? 'bg-slate-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{showFacilityMarkers ? t('dashboard.map.hide_fac', 'Hide Fac.') : t('dashboard.map.show_fac', 'Show Fac.')}</button>
                                </div>
                            </div>
                        </Card>
                    </div>
                 )}
             </div>

            {!loading && (
            <>
                <div className="mt-6 grid grid-cols-1 gap-6 items-stretch relative">
                    <Card className="p-0 flex flex-col overflow-hidden border border-gray-200 rounded-xl">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{t('dashboard.headers.imnci_coverage', 'IMNCI Coverage by')} {aggregationLevelName}</h3>
                            <button onClick={() => copyTableAsImage(coverageTableRef, setTable1CopyStatus)} className="text-gray-400 hover:text-sky-600 transition-colors p-1"> {table1CopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{table1CopyStatus}</span> : <CopyIcon />} </button>
                        </div>
                        <div className="flex-grow overflow-x-auto p-4">
                            <table ref={coverageTableRef} className="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                                <thead>
                                    <tr>
                                        <th className="p-3 border-b border-gray-200 bg-slate-50 text-start font-semibold text-gray-600 uppercase text-[11px] tracking-wider w-[25%]">{aggregationLevelName}</th>
                                        <th className="p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase text-[11px] tracking-wider w-[15%]">{t('dashboard.table.functioning_phcs', 'Functioning PHCs')}</th>
                                        <th className="p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase text-[11px] tracking-wider w-[15%]">{t('dashboard.table.phcs_with_imnci', 'PHCs with IMNCI')}</th>
                                        <th className="p-3 border-b border-gray-200 bg-slate-50 text-start font-semibold text-gray-600 uppercase text-[11px] tracking-wider w-[45%]">{t('dashboard.table.coverage_chart', 'Coverage Chart')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                 {tableCoverageData.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-gray-500">{t('dashboard.table.no_data', 'No data matches the current filters.')}</td></tr> :
                                 tableCoverageData.map(row => (
                                     <tr key={row.key} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                                         <td className="p-3 font-medium text-gray-800 align-middle text-start">{row.name}</td>
                                         <td className="p-3 text-center align-middle font-medium">{row.totalFunctioningPhc}</td>
                                         <td className="p-3 text-center font-bold text-sky-700 align-middle">
                                             {row.totalPhcWithImnci} <span className="text-gray-400 font-normal ms-1">({row.coverage}%)</span>
                                         </td>
                                         <td className="p-3 align-middle text-start">
                                            <div className="flex items-center w-full">
                                                <div className="flex-grow bg-gray-200 rounded-sm h-3 overflow-hidden flex">
                                                    <div 
                                                        className={`h-full transition-all shadow-sm ${row.coverage >= 75 ? 'bg-sky-700' : row.coverage >= 40 ? 'bg-sky-400' : 'bg-gray-600'}`} 
                                                        style={{ width: `${Math.max(row.coverage, 1)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="ms-3 text-[11px] font-bold text-gray-700 w-8 text-end">{row.coverage}%</span>
                                            </div>
                                         </td>
                                     </tr>
                                 ))
                                 }
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
                
                {/* --- MODIFIED TABLE: Tools Availability (Calculated out of Total PHCs) --- */}
                <div className="mt-6">
                    <Card className="p-0 overflow-hidden border border-gray-200 rounded-xl">
                        <div className="p-4 border-b flex flex-col gap-2 bg-slate-50/50">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800"> {t('dashboard.headers.imnci_tools', 'IMNCI Tools Availability by')} {aggregationLevelName} </h3>
                                <button onClick={() => copyTableAsImage(toolsTableRef, setTable2CopyStatus)} className="text-gray-400 hover:text-sky-600 transition-colors p-1"> {table2CopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{table2CopyStatus}</span> : <CopyIcon />} </button>
                            </div>
                            <div className="flex items-center gap-3 text-xs mt-2">
                                <span className="font-bold text-gray-600">{t('dashboard.map.legend', 'Legend:')}</span>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-50 border border-green-300 rounded-sm"></div> <span className="text-gray-600 font-medium">≥ 75%</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-50 border border-yellow-300 rounded-sm"></div> <span className="text-gray-600 font-medium">50% - 74%</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-50 border border-red-300 rounded-sm"></div> <span className="text-gray-600 font-medium">&lt; 50%</span></div>
                            </div>
                        </div>
                         <div className="overflow-x-auto p-4">
                             <table ref={toolsTableRef} className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                                <thead>
                                    <tr>
                                        {[
                                            aggregationLevelName, 
                                            t('dashboard.table.total_functioning_phcs', 'Total PHCs'), 
                                            t('dashboard.table.weight_scale', 'Weight Scale'), 
                                            t('dashboard.table.height_scale', 'Height Scale'),
                                            t('dashboard.table.thermometer', 'Thermometer'),
                                            t('dashboard.table.timer', 'Timer'),
                                            t('dashboard.table.imnci_chartbooklet', 'Chart Booklet'), 
                                            t('dashboard.table.imnci_registers', 'Register') 
                                        ].map((h, i) => (
                                            <th key={i} className="p-3 border-b border-gray-200 bg-slate-50 text-start font-semibold text-gray-600 uppercase text-[11px] tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                 {toolsAverages && !isFacilityView && (
                                     <tr className="bg-slate-100/80 font-bold border-b-2 border-gray-300">
                                         <td className="p-3 border-e border-gray-200 text-gray-800 uppercase text-[11px] tracking-wider text-start">{t('dashboard.table.overall_average', 'Overall Average')}</td>
                                         <td className="p-3 border-e border-gray-200 text-center font-black text-slate-700">{toolsAverages.total}</td>
                                         <td className={`p-3 border-e border-gray-200 text-center ${getPercentageColorClass(toolsAverages.pScale)}`}>{toolsAverages.totalScale} <span className="text-gray-500 font-normal ms-1">({toolsAverages.pScale}%)</span></td>
                                         <td className={`p-3 border-e border-gray-200 text-center ${getPercentageColorClass(toolsAverages.pHeight)}`}>{toolsAverages.totalHeight} <span className="text-gray-500 font-normal ms-1">({toolsAverages.pHeight}%)</span></td>
                                         <td className={`p-3 border-e border-gray-200 text-center ${getPercentageColorClass(toolsAverages.pThermometer)}`}>{toolsAverages.totalThermometer} <span className="text-gray-500 font-normal ms-1">({toolsAverages.pThermometer}%)</span></td>
                                         <td className={`p-3 border-e border-gray-200 text-center ${getPercentageColorClass(toolsAverages.pTimer)}`}>{toolsAverages.totalTimer} <span className="text-gray-500 font-normal ms-1">({toolsAverages.pTimer}%)</span></td>
                                         <td className={`p-3 border-e border-gray-200 text-center ${getPercentageColorClass(toolsAverages.pChart)}`}>{toolsAverages.totalChart} <span className="text-gray-500 font-normal ms-1">({toolsAverages.pChart}%)</span></td>
                                         <td className={`p-3 text-center ${getPercentageColorClass(toolsAverages.pRegister)}`}>{toolsAverages.totalRegister} <span className="text-gray-500 font-normal ms-1">({toolsAverages.pRegister}%)</span></td>
                                     </tr>
                                 )}
                                 {tableToolsData.length === 0 ? <tr><td colSpan={8} className="p-4 text-center text-gray-500">{t('dashboard.table.no_data', 'No data matches the current filters.')}</td></tr> :
                                  tableToolsData.map(row => (
                                      <tr key={row.key} className="hover:bg-gray-50 border-b border-gray-100">
                                          <td className="p-3 border-e border-gray-100 font-medium text-gray-800 text-start">{row.name}</td>
                                          <td className="p-3 border-e border-gray-100 text-center font-medium text-slate-600">{row.totalPhcs}</td>
                                          <td className={`p-3 border-e border-gray-100 text-center ${getPercentageColorClass(row.percentageWithWeightScale)}`}>{row.countWithWeightScale} <span className="text-gray-400 font-normal ms-1">({row.percentageWithWeightScale}%)</span></td>
                                          <td className={`p-3 border-e border-gray-100 text-center ${getPercentageColorClass(row.percentageWithHeightScale)}`}>{row.countWithHeightScale} <span className="text-gray-400 font-normal ms-1">({row.percentageWithHeightScale}%)</span></td>
                                          <td className={`p-3 border-e border-gray-100 text-center ${getPercentageColorClass(row.percentageWithThermometer)}`}>{row.countWithThermometer} <span className="text-gray-400 font-normal ms-1">({row.percentageWithThermometer}%)</span></td>
                                          <td className={`p-3 border-e border-gray-100 text-center ${getPercentageColorClass(row.percentageWithTimer)}`}>{row.countWithTimer} <span className="text-gray-400 font-normal ms-1">({row.percentageWithTimer}%)</span></td>
                                          <td className={`p-3 border-e border-gray-100 text-center ${getPercentageColorClass(row.percentageWithChartbooklet)}`}>{row.countWithChartbooklet} <span className="text-gray-400 font-normal ms-1">({row.percentageWithChartbooklet}%)</span></td>
                                          <td className={`p-3 text-center ${getPercentageColorClass(row.percentageWithRegister)}`}>{row.countWithRegister} <span className="text-gray-400 font-normal ms-1">({row.percentageWithRegister}%)</span></td>
                                      </tr>
                                  ))
                                  }
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </>
            )}
        </div>
    );
};

// --- CRITICAL CARE DASHBOARD ---
const CRITICAL_EQUIPMENT_SPEC = { 
    'etat_cpap': 'ETAT CPAP', 
    'etat_suction_machine': 'ETAT Suction',
    'hdu_bed_capacity': 'HDU Beds', 
    'hdu_cpap': 'HDU CPAP', 
    'picu_bed_capacity': 'PICU Beds' 
};
const CRITICAL_EQUIPMENT_KEYS = Object.keys(CRITICAL_EQUIPMENT_SPEC);

export const CriticalCareCoverageDashboard = ({ userStates, userLocalities }) => {
    const { t, i18n } = useTranslation();
    const { healthFacilities: allFacilities, isLoading } = useDataCache();
    const loading = isLoading.healthFacilities || allFacilities === null;
    const activeFacilities = useMemo(() => (allFacilities || []).filter(f => f.isDeleted !== true && f.isDeleted !== "true"), [allFacilities]);

    const [stateFilter, setStateFilter] = useState(userStates?.length === 1 ? userStates[0] : ''); 
    const [localityFilter, setLocalityFilter] = useState(userLocalities?.length === 1 ? userLocalities[0] : ''); 
    const [ownershipFilter, setOwnershipFilter] = useState(''); 
    const [projectFilter, setProjectFilter] = useState('');
    const [mapViewLevel, setMapViewLevel] = useState('state');
    
    const [copyStatus, setCopyStatus] = useState('');
    const [table1CopyStatus, setTable1CopyStatus] = useState('');
    const [table2CopyStatus, setTable2CopyStatus] = useState('');
    
    const [tooltipData, setTooltipData] = useState(null); 
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [showFacilityMarkers, setShowFacilityMarkers] = useState(true);

    const dashboardSectionRef = useRef(null);
    const coverageTableRef = useRef(null);
    const equipmentTableRef = useRef(null);
    
    const isLocalityView = !!stateFilter; 
    const projectOptions = useMemo(() => [...new Set(activeFacilities.map(f => f.project_name?.trim()).filter(Boolean))].sort(), [activeFacilities]);

    const isTargetFacility = useCallback((f) => ['مستشفى', 'مستشفى ريفي'].includes(f['نوع_المؤسسةالصحية']) || f.eenc_service_type === 'pediatric', []);
    const hasETAT = useCallback((f) => isTargetFacility(f) && f.etat_has_service === 'Yes', [isTargetFacility]);
    const hasHDU = useCallback((f) => f.hdu_has_service === 'Yes', []);
    const hasPICU = useCallback((f) => f.picu_has_service === 'Yes', []);
    
    const locationFilteredFacilities = useMemo(() => {
        return activeFacilities.filter(f => {
            if(f['الولاية'] === 'إتحادي') return false;
            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;
            if (ownershipFilter && f.facility_ownership !== ownershipFilter) return false;
            if (projectFilter && f.project_name !== projectFilter) return false;
            return true;
        });
    }, [activeFacilities, stateFilter, localityFilter, ownershipFilter, projectFilter]); 

    const kpiData = useMemo(() => {
        const totalTarget = locationFilteredFacilities.filter(isTargetFacility).length;
        const totalETAT = locationFilteredFacilities.filter(hasETAT).length;
        const totalHDU = locationFilteredFacilities.filter(hasHDU).length;
        const totalPICU = locationFilteredFacilities.filter(hasPICU).length;
        return {
            totalTarget, totalETAT, totalHDU, totalPICU,
            etatCoveragePercentage: totalTarget > 0 ? Math.round((totalETAT / totalTarget) * 100) : 0
        };
    }, [locationFilteredFacilities, isTargetFacility, hasETAT, hasHDU, hasPICU]); 

    const { tableData, mapData } = useMemo(() => {
        const s = {};
        const aggF = stateFilter ? 'المحلية' : 'الولاية';
        locationFilteredFacilities.forEach(f => {
            const key = f[aggF];
            if (!key || key === 'إتحادي') return;
            if (!s[key]) s[key] = { 
                name: stateFilter ? getLocalizedLocalityName(stateFilter, key, i18n.language) : getLocalizedStateName(key, i18n.language), 
                key, totalTarget: 0, withETAT: 0, withHDU: 0, withPICU: 0 
            };
            
            if (isTargetFacility(f)) {
                s[key].totalTarget++;
                if (hasETAT(f)) s[key].withETAT++;
            }
            if (hasHDU(f)) s[key].withHDU++;
            if (hasPICU(f)) s[key].withPICU++;
        });
        const tD = Object.values(s).map(st => ({ ...st, etatCoverage: st.totalTarget > 0 ? Math.round((st.withETAT / st.totalTarget) * 100) : 0 })).sort((a, b) => b.etatCoverage - a.etatCoverage); 
        const mD = tD.map(st => ({ state: st.key, percentage: st.etatCoverage, coordinates: mapCoordinates[st.key] ? [mapCoordinates[st.key].lng, mapCoordinates[st.key].lat] : [0, 0] }));
        return { tableData: tD, mapData: mD };
    }, [locationFilteredFacilities, stateFilter, isTargetFacility, hasETAT, hasHDU, hasPICU, i18n.language]); 

    const equipmentTableData = useMemo(() => {
        const aggK = stateFilter ? 'اسم_المؤسسة' : 'الولاية';
        const facP = locationFilteredFacilities.filter(f => hasETAT(f) || hasHDU(f) || hasPICU(f)); 
        const s = {};
        facP.forEach(f => {
            const key = f[aggK];
            if (!key || key === 'إتحادي') return;
            if (!s[key]) s[key] = { 
                name: stateFilter ? f['اسم_المؤسسة'] : getLocalizedStateName(key, i18n.language), 
                key, ...Object.fromEntries(CRITICAL_EQUIPMENT_KEYS.map(k => [k, 0])) 
            };
            CRITICAL_EQUIPMENT_KEYS.forEach(eK => { const val = f[eK]; s[key][eK] += (Number(val) || 0); });
        });
        return Object.values(s).filter(st => st.key !== 'إتحادي').sort((a, b) => (b.hdu_bed_capacity || 0) - (a.hdu_bed_capacity || 0));
    }, [locationFilteredFacilities, stateFilter, hasETAT, hasHDU, hasPICU, i18n.language]);

    const facilityLocationMarkers = useMemo(() => locationFilteredFacilities.filter(f => (hasETAT(f) || hasHDU(f) || hasPICU(f)) && f['_الإحداثيات_longitude']).map(f=>({key:f.id,name:f['اسم_المؤسسة'],coordinates:[f['_الإحداثيات_longitude'],f['_الإحداثيات_latitude']]})), [locationFilteredFacilities, hasETAT, hasHDU, hasPICU]);
    const mapViewConfig = useMemo(() => { const sC=stateFilter?mapCoordinates[stateFilter]:null; return sC ? {center:[sC.lng,sC.lat],scale:sC.scale,focusedState:stateFilter} : {center:[30,15.5],scale:2000,focusedState:null}; }, [stateFilter]);
    
    const handleStateChange = (e) => { setStateFilter(e.target.value); setLocalityFilter(''); };
    const currentMapViewLevel = stateFilter ? 'locality' : mapViewLevel;
    const aggregationLevelName = stateFilter ? t('dashboard.table.locality', 'Locality') : t('dashboard.table.state', 'State');

    const handleMapLocalityHover = useCallback((geoProps, event)=>{ 
        const locKey=geoProps.admin_2;
        if (!locKey) return; 
        const locData = tableData.find(l=>l.key===locKey);
        if(!locData) return;
        setTooltipData({
            title: `${locData.name} (${locData.key})`,
            dataRows: [{label: "ETAT Coverage", value: `${locData.etatCoverage}% (${locData.withETAT} / ${locData.totalTarget})`}]
        });
        setHoverPosition({x:event.clientX,y:event.clientY}); 
    }, [tableData]);

    const handleStateHover = useCallback((stateKey, event)=>{ 
        if(stateFilter||mapViewLevel==='locality')return; 
        const rowData=tableData.find(d=>d.key===stateKey); 
        if(!rowData) return; 
        setTooltipData({
            title: `${rowData.name} (${rowData.key})`,
            dataRows: [{label: "ETAT Coverage", value: `${rowData.etatCoverage}% (${rowData.withETAT} / ${rowData.totalTarget})`}]
        });
        setHoverPosition({x:event.clientX,y:event.clientY}); 
    }, [tableData, stateFilter, mapViewLevel]);

    const handleMapMouseLeave = useCallback(()=>{ setTooltipData(null); }, []);
    const handleMouseMove = useCallback((event)=>{ if(tooltipData){setHoverPosition({x:event.clientX,y:event.clientY});} }, [tooltipData]);

    const handleCopyImage = useCallback(async () => {
        if (dashboardSectionRef.current && navigator.clipboard?.write) {
            setCopyStatus('Copying...');
            try {
                const canvas = await html2canvas(dashboardSectionRef.current, { useCORS: true, scale: 2, backgroundColor: '#ffffff', ignoreElements: (e) => e.classList.contains('ignore-for-export') });
                canvas.toBlob(async (blob) => { if (blob) { await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]); setCopyStatus('Copied!'); } }, 'image/png', 0.95);
            } catch (err) { setCopyStatus('Failed'); } finally { setTimeout(() => setCopyStatus(''), 2000); }
        }
    }, []);

    return (
        <div onMouseMove={handleMouseMove}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm ignore-for-export mb-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormGroup label={t('dashboard.filters.state', 'State')}><Select value={stateFilter} onChange={handleStateChange}><option value="">{t('dashboard.filters.all_states', 'All States')}</option>{Object.keys(STATE_LOCALITIES).filter(s => s !== 'إتحادي').sort().map(sKey => <option key={sKey} value={sKey}>{getLocalizedStateName(sKey, i18n.language)}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.locality', 'Locality')}><Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}><option value="">{t('dashboard.filters.all_localities', 'All Localities')}</option>{stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a,b) => a.en.localeCompare(b.en)).map(l => <option key={l.en} value={l.en}>{getLocalizedLocalityName(stateFilter, l.en, i18n.language)}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.ownership', 'Ownership')}><Select value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value)}><option value="">{t('dashboard.filters.all_ownerships', 'All Ownerships')}</option>{OWNERSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Select></FormGroup>
                    <FormGroup label={t('dashboard.filters.project', 'Project')}><Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="">{t('dashboard.filters.all_projects', 'All Projects')}</option>{projectOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Select></FormGroup>
                </div>
            </div>

            <div ref={dashboardSectionRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch relative">
                <div className="lg:col-span-1 flex flex-col gap-4 h-full">
                    {loading ? <Spinner/> : (
                        <>
                            <TotalCountCard title={t('dashboard.cards.target_hospitals_etat', 'Target Hospitals (ETAT)')} count={kpiData.totalTarget} className="flex-1" borderClass="border-s-slate-400" valueClass="text-slate-700" decorationColor="bg-slate-500" />
                            <ValueTotalPercentageCard title={t('dashboard.cards.hospitals_etat', 'Hospitals with ETAT')} value={kpiData.totalETAT} total={kpiData.totalTarget} percentage={kpiData.etatCoveragePercentage} className="flex-1" borderClass="border-s-sky-500" valueClass="text-sky-600" decorationColor="bg-sky-500" colorTheme="sky" />
                            <div className="flex gap-4 flex-1">
                                <TotalCountCard title={t('dashboard.cards.facilities_hdu', 'Facilities with HDU')} count={kpiData.totalHDU} className="flex-1" borderClass="border-s-teal-500" valueClass="text-teal-700" decorationColor="bg-teal-500" />
                                <TotalCountCard title={t('dashboard.cards.facilities_picu', 'Facilities with PICU')} count={kpiData.totalPICU} className="flex-1" borderClass="border-s-indigo-500" valueClass="text-indigo-700" decorationColor="bg-indigo-500" />
                            </div>
                        </>
                    )}
                </div>

                {loading ? <div className="lg:col-span-2 flex justify-center items-center h-64"><Spinner/></div> : (
                    <div className="lg:col-span-2 flex flex-col h-full">
                        <Card className="p-0 flex flex-col flex-grow shadow-sm border border-gray-200 rounded-xl h-full">
                             <div className="p-4 md:p-5 border-b bg-slate-50/50 rounded-t-xl flex justify-between items-start gap-4">
                                 <h3 className="text-lg font-bold text-gray-800 leading-tight">{t('dashboard.headers.geographic_map', 'Geographical Map')}</h3>
                                 <button onClick={handleCopyImage} className="text-gray-400 hover:text-sky-600 transition-colors p-1 mt-0.5 shrink-0" disabled={!!copyStatus && copyStatus !== 'Failed'}>{copyStatus ? <span className="text-[10px] font-semibold text-sky-600">{copyStatus}</span> : <CopyIcon />}</button>
                            </div>
                            <div className="flex-grow min-h-[400px] p-2 relative flex flex-col">
                                 <div className='flex-grow min-h-0 h-full w-full'>
                                    <SudanMap data={!stateFilter && currentMapViewLevel === 'state' ? mapData : []} localityData={stateFilter ? tableData : []} facilityMarkers={showFacilityMarkers ? facilityLocationMarkers : []} viewLevel={currentMapViewLevel} {...mapViewConfig} onStateHover={handleStateHover} onLocalityHover={handleMapLocalityHover} onStateLeave={handleMapMouseLeave} onLocalityLeave={handleMapMouseLeave} isMovable={false} pannable={false} />
                                </div>
                            </div>
                            <div className="bg-slate-50 border-t border-gray-200 rounded-b-xl py-3 px-4 flex flex-col xl:flex-row justify-between items-center gap-4">
                                <MapLegend />
                                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto w-full xl:w-auto justify-end ignore-for-export">
                                    {!stateFilter && (
                                        <div className="flex rounded-md shadow-sm shrink-0 mx-1">
                                            <button onClick={() => setMapViewLevel('state')} className={`px-3 py-1.5 text-xs font-semibold rounded-s-md ${mapViewLevel === 'state' ? 'bg-sky-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`} > {t('dashboard.map.state', 'State')} </button>
                                            <button onClick={() => setMapViewLevel('locality')} className={`px-3 py-1.5 text-xs font-semibold rounded-e-md ${mapViewLevel === 'locality' ? 'bg-sky-700 text-white border border-sky-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-s-0 border-gray-200'}`} > {t('dashboard.map.locality', 'Locality')} </button>
                                        </div>
                                    )}
                                    <button onClick={() => setShowFacilityMarkers(!showFacilityMarkers)} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-sm shrink-0 ${showFacilityMarkers ? 'bg-slate-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{showFacilityMarkers ? t('dashboard.map.hide_fac', 'Hide Fac.') : t('dashboard.map.show_fac', 'Show Fac.')}</button>
                                </div>
                            </div>
                        </Card>
                    </div>
                 )}
            </div>

            {!loading && (
            <>
                <div className="mt-6 grid grid-cols-1 gap-6 items-stretch relative">
                    <Card className="p-0 flex flex-col overflow-hidden border border-gray-200 rounded-xl">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{t('dashboard.headers.critical_care_coverage', 'Critical Care Coverage by')} {aggregationLevelName}</h3>
                            <button onClick={() => copyTableAsImage(coverageTableRef, setTable1CopyStatus)} className="text-gray-400 hover:text-sky-600 transition-colors p-1"> {table1CopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{table1CopyStatus}</span> : <CopyIcon />} </button>
                        </div>
                        <div className="flex-grow overflow-x-auto p-4">
                            <table ref={coverageTableRef} className='min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden'>
                                <thead>
                                    <tr>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-start font-semibold text-gray-600 uppercase tracking-wider'>{aggregationLevelName}</th>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase tracking-wider'>{t('dashboard.table.target_hospitals', 'Target Hospitals')}</th>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase tracking-wider'>{t('dashboard.table.with_hdu', 'With HDU')}</th>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase tracking-wider'>{t('dashboard.table.with_picu', 'With PICU')}</th>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-center font-semibold text-gray-600 uppercase tracking-wider'>{t('dashboard.table.with_etat', 'With ETAT')}</th>
                                        <th className='p-3 border-b border-gray-200 bg-slate-50 text-start font-semibold text-gray-600 uppercase tracking-wider w-[35%]'>{t('dashboard.table.coverage_chart', 'Coverage Chart')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-gray-500">{t('dashboard.table.no_data', 'No data matches the current filters.')}</td></tr> :
                                     tableData.map(row => ( 
                                        <tr key={row.key} className='hover:bg-blue-50/50 transition-colors border-b border-gray-100'>
                                            <td className="p-3 font-medium text-gray-700 text-start">{row.name}</td>
                                            <td className="p-3 text-center align-middle font-medium">{row.totalTarget}</td>
                                            <td className="p-3 text-center align-middle font-medium">{row.withHDU}</td>
                                            <td className="p-3 text-center align-middle font-medium">{row.withPICU}</td>
                                            <td className="p-3 text-center font-bold text-sky-700 align-middle">{row.withETAT}</td>
                                            <td className="p-3 align-middle text-start">
                                                <div className="flex items-center w-full">
                                                    <div className="flex-grow bg-gray-200 rounded-sm h-3 overflow-hidden flex"><div className={`h-full transition-all shadow-sm ${row.etatCoverage >= 75 ? 'bg-sky-700' : row.etatCoverage >= 40 ? 'bg-sky-400' : 'bg-gray-600'}`} style={{ width: `${Math.max(row.etatCoverage, 1)}%` }}></div></div>
                                                    <span className="ms-3 text-[11px] font-bold text-gray-700 w-8 text-end">{row.etatCoverage}%</span>
                                                </div>
                                            </td>
                                        </tr> 
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div className="mt-6">
                    <Card className="p-0 overflow-hidden border border-gray-200 rounded-xl">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-gray-800">{t('dashboard.headers.critical_care_capacity', 'Critical Care Capacity & Equipment')}</h3>
                            <button onClick={() => copyTableAsImage(equipmentTableRef, setTable2CopyStatus)} className="text-gray-400 hover:text-sky-600 transition-colors p-1"> {table2CopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{table2CopyStatus}</span> : <CopyIcon />} </button>
                        </div>
                        <div className="overflow-x-auto p-4">
                            <table ref={equipmentTableRef} className="min-w-full table-auto border-collapse text-[10px] border border-gray-200">
                                <thead className="bg-slate-50 border-b border-gray-200">
                                    <tr>
                                        <th className={`p-2 text-start font-semibold tracking-wider text-gray-600 uppercase align-bottom w-40`}><div className='font-bold break-words text-center'>{stateFilter ? t('dashboard.table.hospital_name', 'Hospital Name') : aggregationLevelName}</div></th>
                                        {Object.values(CRITICAL_EQUIPMENT_SPEC).map((header, index) => ( <th key={index} className={`p-2 text-start font-semibold tracking-wider text-gray-600 uppercase align-bottom w-20`}><div className='font-bold break-words text-center'>{t(`dashboard.equip.${header}`, header)}</div></th> ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipmentTableData.map(row => ( 
                                        <tr key={row.name} className="hover:bg-slate-50 transition-colors border-b border-gray-100">
                                            <td className={`font-medium text-gray-700 p-2 break-words text-start`}>{row.name}</td>
                                            {CRITICAL_EQUIPMENT_KEYS.map(key => { const value = row[key]; const cellClass = value === 0 ? 'bg-red-50 text-red-600 font-bold' : 'text-gray-700 font-medium'; return ( <td key={key} className={`p-2 ${cellClass} text-center border-s border-gray-100`}> {value} </td> ); })}
                                        </tr> 
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
                {tooltipData && ( <div style={{ position: 'fixed', left: hoverPosition.x - 40, top: hoverPosition.y, pointerEvents: 'none', zIndex: 50 }}> <MapTooltip title={tooltipData.title} dataRows={tooltipData.dataRows} /> </div> )}
            </>
            )}
        </div>
    );
};


// --- COMPACT KPI CARD ---
const CompactKPICard = ({ percentage, title, numeratorLabel, numeratorValue, denominatorLabel, denominatorValue, colorClass = "bg-sky-600", className = "" }) => (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow ${className}`}>
        <div className={`px-3 py-2.5 text-white flex justify-between items-center ${colorClass}`}>
            <h3 className="text-xs md:text-sm font-bold leading-tight w-2/3 text-end" dir="rtl">{title}</h3>
            <span className="text-xl md:text-2xl font-extrabold">% {percentage}</span>
        </div>
        <div className="px-3 py-2 bg-gray-50 text-[11px] md:text-xs text-gray-700 space-y-1.5 flex flex-col justify-center flex-grow" dir="rtl">
            <div className="flex justify-between border-b border-gray-200 pb-1.5">
                <span className="text-gray-500">{numeratorLabel}:</span>
                <span className="font-bold text-gray-900">{numeratorValue}</span>
            </div>
            <div className="flex justify-between pt-0.5">
                <span className="text-gray-500">{denominatorLabel}:</span>
                <span className="font-bold text-gray-900">{denominatorValue}</span>
            </div>
        </div>
    </div>
);

// --- CUSTOM COMBINED MAP TOOLTIP ---
const CombinedMapTooltip = ({ data }) => {
    const { t } = useTranslation();
    if (!data) return null;
    return (
        <div className="absolute z-50 p-4 bg-white border border-gray-300 shadow-2xl rounded-lg w-72 pointer-events-none transform -translate-x-full -translate-y-1/2">
            <h4 className="text-lg font-bold text-gray-800 border-b pb-2 mb-2 text-start">{data.name}</h4>
            <div className="text-sm font-bold text-sky-700 mb-3 text-start">
                {t('dashboard.kpi.overall_coverage', 'Overall Coverage')}: {data.percentage}%
            </div>
            <div className="space-y-2 text-xs text-start" dir="rtl">
                <div className="flex justify-between items-center bg-sky-50 p-1.5 rounded">
                    <span className="font-semibold text-gray-700">IMNCI:</span>
                    <span>{data.raw.imnci.perc}% <span className="text-gray-500 font-normal">({data.raw.imnci.n}/{data.raw.imnci.d})</span></span>
                </div>
                <div className="flex justify-between items-center bg-teal-50 p-1.5 rounded">
                    <span className="font-semibold text-gray-700">ETAT:</span>
                    <span>{data.raw.etat.perc}% <span className="text-gray-500 font-normal">({data.raw.etat.n}/{data.raw.etat.d})</span></span>
                </div>
                <div className="flex justify-between items-center bg-indigo-50 p-1.5 rounded">
                    <span className="font-semibold text-gray-700">EENC:</span>
                    <span>{data.raw.eenc.perc}% <span className="text-gray-500 font-normal">({data.raw.eenc.n}/{data.raw.eenc.d})</span></span>
                </div>
                <div className="flex justify-between items-center bg-purple-50 p-1.5 rounded">
                    <span className="font-semibold text-gray-700">SCNU:</span>
                    <span>{data.raw.scnu.perc}% <span className="text-gray-500 font-normal">({data.raw.scnu.n}/{data.raw.scnu.d})</span></span>
                </div>
            </div>
        </div>
    );
};

// --- COMBINED SERVICES DASHBOARD ---
export const CombinedServiceDashboard = ({ userStates, userLocalities }) => {
    const { t, i18n } = useTranslation();
    const { healthFacilities: allFacilities, isLoading } = useDataCache();
    const loading = isLoading?.healthFacilities || allFacilities === null;
    
    // --- APPLY SOFT DELETE FILTER ---
    const activeFacilities = useMemo(() => (allFacilities || []).filter(f => f.isDeleted !== true && f.isDeleted !== "true"), [allFacilities]);

    const [stateFilter, setStateFilter] = useState(userStates?.length === 1 ? userStates[0] : ''); 
    const [localityFilter, setLocalityFilter] = useState(userLocalities?.length === 1 ? userLocalities[0] : ''); 
    
    const combinedExportRef = useRef(null);
    const [combinedCopyStatus, setCombinedCopyStatus] = useState('');

    const [hoverData, setHoverData] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

    // Filter facilities based on State/Locality
    const locationFilteredFacilities = useMemo(() => {
        return activeFacilities.filter(f => {
            if(f['الولاية'] === 'إتحادي') return false;
            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;
            return true;
        });
    }, [activeFacilities, stateFilter, localityFilter]); 

    // --- KPI CALCULATIONS (Global or Filtered) ---
    const kpiData = useMemo(() => {
        // 1. IMNCI
        const functioningPhcs = locationFilteredFacilities.filter(f => f['هل_المؤسسة_تعمل'] === 'Yes' && ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية']));
        const imnciInPhcs = functioningPhcs.filter(f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes');
        const imnciPerc = functioningPhcs.length > 0 ? Math.round((imnciInPhcs.length / functioningPhcs.length) * 100) : 0;

        // 2. ETAT (Pediatric + General Hospitals)
        const supposedEtatFacilities = locationFilteredFacilities.filter(f => ['مستشفى', 'مستشفى ريفي'].includes(f['نوع_المؤسسةالصحية']) || f.eenc_service_type === 'pediatric');
        const facilitiesWithEtat = supposedEtatFacilities.filter(f => f.etat_has_service === 'Yes');
        const etatPerc = supposedEtatFacilities.length > 0 ? Math.round((facilitiesWithEtat.length / supposedEtatFacilities.length) * 100) : 0;

        // 3. EENC
        const emoncFacilities = locationFilteredFacilities.filter(f => ['BEmONC', 'CEmONC'].includes(f.eenc_service_type) && f['هل_المؤسسة_تعمل'] === 'Yes');
        const eencProviders = emoncFacilities.filter(f => f.eenc_provides_essential_care === 'Yes');
        const eencPerc = emoncFacilities.length > 0 ? Math.round((eencProviders.length / emoncFacilities.length) * 100) : 0;

        // 4. SCNU (Neonatal)
        const supposedScnuFacilities = locationFilteredFacilities.filter(f => 
            ['CEmONC', 'pediatric'].includes(f.eenc_service_type) || 
            f.neonatal_level_of_care?.primary || f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary ||
            f.neonatal_level_primary === 'Yes' || f.neonatal_level_secondary === 'Yes' || f.neonatal_level_tertiary === 'Yes' ||
            f.neonatal_level_primary === 'Planned' || f.neonatal_level_secondary === 'Planned' || f.neonatal_level_tertiary === 'Planned'
        );
        const functioningScnus = supposedScnuFacilities.filter(f => f['هل_المؤسسة_تعمل'] === 'Yes' && (f.neonatal_level_secondary === 'Yes' || f.neonatal_level_of_care?.secondary));
        const scnuPerc = supposedScnuFacilities.length > 0 ? Math.round((functioningScnus.length / supposedScnuFacilities.length) * 100) : 0;

        return {
            imnci: { num: imnciInPhcs.length, den: functioningPhcs.length, perc: imnciPerc },
            etat: { num: facilitiesWithEtat.length, den: supposedEtatFacilities.length, perc: etatPerc },
            eenc: { num: eencProviders.length, den: emoncFacilities.length, perc: eencPerc },
            scnu: { num: functioningScnus.length, den: supposedScnuFacilities.length, perc: scnuPerc }
        };
    }, [locationFilteredFacilities]);

    // --- MAP AGGREGATION HELPER ---
    const aggregateCoverage = useCallback((facilitiesToAggregate, groupByField) => {
        const agg = {};
        facilitiesToAggregate.forEach(f => {
            const key = f[groupByField];
            if (!key || key === 'إتحادي') return;
            if (!agg[key]) {
                agg[key] = { imnci: {n:0, d:0}, etat: {n:0, d:0}, eenc: {n:0, d:0}, scnu: {n:0, d:0} };
            }

            if (f['هل_المؤسسة_تعمل'] === 'Yes' && ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية'])) {
                agg[key].imnci.d++;
                if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') agg[key].imnci.n++;
            }
            if (['مستشفى', 'مستشفى ريفي'].includes(f['نوع_المؤسسةالصحية']) || f.eenc_service_type === 'pediatric') {
                agg[key].etat.d++;
                if (f.etat_has_service === 'Yes') agg[key].etat.n++;
            }
            if (['BEmONC', 'CEmONC'].includes(f.eenc_service_type) && f['هل_المؤسسة_تعمل'] === 'Yes') {
                agg[key].eenc.d++;
                if (f.eenc_provides_essential_care === 'Yes') agg[key].eenc.n++;
            }
            if (['CEmONC', 'pediatric'].includes(f.eenc_service_type) || f.neonatal_level_of_care?.primary || f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary || f.neonatal_level_primary === 'Yes' || f.neonatal_level_secondary === 'Yes' || f.neonatal_level_tertiary === 'Yes' || f.neonatal_level_primary === 'Planned' || f.neonatal_level_secondary === 'Planned' || f.neonatal_level_tertiary === 'Planned') {
                agg[key].scnu.d++;
                if (f['هل_المؤسسة_تعمل'] === 'Yes' && (f.neonatal_level_secondary === 'Yes' || f.neonatal_level_of_care?.secondary)) agg[key].scnu.n++;
            }
        });

        // Calculate percentages and overall average
        Object.keys(agg).forEach(key => {
            const counts = agg[key];
            counts.imnci.perc = counts.imnci.d > 0 ? Math.round((counts.imnci.n / counts.imnci.d) * 100) : 0;
            counts.etat.perc  = counts.etat.d > 0 ? Math.round((counts.etat.n / counts.etat.d) * 100) : 0;
            counts.eenc.perc  = counts.eenc.d > 0 ? Math.round((counts.eenc.n / counts.eenc.d) * 100) : 0;
            counts.scnu.perc  = counts.scnu.d > 0 ? Math.round((counts.scnu.n / counts.scnu.d) * 100) : 0;
            counts.overallAvg = Math.round((counts.imnci.perc + counts.etat.perc + counts.eenc.perc + counts.scnu.perc) / 4);
        });

        return agg;
    }, []);

    // State Map Data
    const stateMapData = useMemo(() => {
        const stateAgg = aggregateCoverage(activeFacilities, 'الولاية');
        return Object.entries(stateAgg).map(([st, counts]) => ({
            name: getLocalizedStateName(st, i18n.language),
            state: st,
            percentage: counts.overallAvg,
            raw: counts,
            coordinates: typeof mapCoordinates !== 'undefined' && mapCoordinates[st] ? [mapCoordinates[st].lng, mapCoordinates[st].lat] : [0, 0]
        }));
    }, [activeFacilities, aggregateCoverage, i18n.language]);

    // Locality Map Data (Drilldown)
    const localityMapData = useMemo(() => {
        if (!stateFilter) return [];
        const filteredForState = activeFacilities.filter(f => f['الولاية'] === stateFilter);
        const localityAgg = aggregateCoverage(filteredForState, 'المحلية');
        return Object.entries(localityAgg).map(([loc, counts]) => ({
            key: loc,
            name: getLocalizedLocalityName(stateFilter, loc, i18n.language),
            state: stateFilter,
            coverage: counts.overallAvg, 
            percentage: counts.overallAvg,
            raw: counts
        }));
    }, [activeFacilities, stateFilter, aggregateCoverage, i18n.language]);

    // Dynamic Map Config (Zoom logic for container)
    const mapViewConfig = useMemo(() => { 
        const sC = stateFilter && typeof mapCoordinates !== 'undefined' ? mapCoordinates[stateFilter] : null;
        if(sC) return { center: [sC.lng, sC.lat], scale: sC.scale * 1.8, focusedState: stateFilter };
        return { center: [30, 15.5], scale: 2300, focusedState: null }; 
    }, [stateFilter]);

    // --- HANDLERS ---
    const handleCopyCombined = async () => {
        if (!combinedExportRef.current || !navigator.clipboard?.write) {
            console.error("Clipboard API not available or target element not found.");
            setCombinedCopyStatus('Failed');
            setTimeout(() => setCombinedCopyStatus(''), 2000);
            return;
        }

        setCombinedCopyStatus('Copying...');
        try {
            const canvas = await html2canvas(combinedExportRef.current, { 
                useCORS: true, 
                scale: 2, 
                backgroundColor: '#ffffff', 
                ignoreElements: (el) => el.classList.contains('ignore-for-export') 
            });

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
            if (blob) { 
                await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]); 
                setCombinedCopyStatus('Copied!'); 
            } else {
                throw new Error('Canvas to Blob failed');
            }
        } catch (err) { 
            console.error("Failed to copy image:", err); 
            setCombinedCopyStatus('Failed'); 
        } finally { 
            setTimeout(() => setCombinedCopyStatus(''), 2000); 
        }
    };

    const handleMapHover = useCallback((isLocality, key, event) => {
        const data = isLocality 
            ? localityMapData.find(d => d.key === key) 
            : stateMapData.find(d => d.state === key);
        
        if (data) {
            setHoverData(data);
            setHoverPosition({ x: event.clientX, y: event.clientY });
        }
    }, [stateMapData, localityMapData]);

    const handleMouseMove = useCallback((e) => {
        if (hoverData) setHoverPosition({ x: e.clientX, y: e.clientY });
    }, [hoverData]);

    const currentMapViewLevel = stateFilter ? 'locality' : 'state';

    return (
        <div className="flex flex-col gap-6" onMouseMove={handleMouseMove}>
            
            {/* Filters Row */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm ignore-for-export mb-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                    <FormGroup label={t('dashboard.filters.state', 'Filter by State')}>
                        <Select value={stateFilter} onChange={(e) => {setStateFilter(e.target.value); setLocalityFilter('');}}>
                            <option value="">{t('dashboard.filters.all_states', 'All States')}</option>
                            {Object.keys(STATE_LOCALITIES).filter(s => s !== 'إتحادي').sort().map(sKey => <option key={sKey} value={sKey}>{getLocalizedStateName(sKey, i18n.language)}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label={t('dashboard.filters.locality', 'Filter by Locality')}>
                        <Select value={localityFilter} onChange={(e) => setLocalityFilter(e.target.value)} disabled={!stateFilter}>
                            <option value="">{t('dashboard.filters.all_localities', 'All Localities')}</option>
                            {stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a,b) => a.en.localeCompare(b.en)).map(l => <option key={l.en} value={l.en}>{getLocalizedLocalityName(stateFilter, l.en, i18n.language)}</option>)}
                        </Select>
                    </FormGroup>
                </div>
            </div>

            {loading ? <div className="flex justify-center items-center h-64"><Spinner/></div> : (
                <div ref={combinedExportRef}>
                    <Card className="p-0 flex flex-col shadow-sm border border-gray-200 rounded-xl">
                        <div className="p-4 md:p-5 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-50/50 rounded-t-xl gap-4 sm:gap-0">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-gray-800">{t('dashboard.headers.geographic_coverage', 'Geographic Coverage & Service Performance')}</h3>
                                <button onClick={handleCopyCombined} title="Copy Dashboard Image" className="text-gray-400 hover:text-sky-600 transition-colors p-1" disabled={!!combinedCopyStatus && combinedCopyStatus !== 'Failed'}>
                                    {combinedCopyStatus ? <span className="text-[10px] font-semibold text-sky-600">{combinedCopyStatus}</span> : <CopyIcon />}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row items-stretch bg-white rounded-b-xl">
                            {/* LEFT COLUMN: FULL MAP (2/3 width) */}
                            <div className="lg:w-2/3 flex flex-col border-b lg:border-b-0 lg:border-e border-gray-200 relative">
                                <div className="flex-grow min-h-[550px] relative p-2">
                                    <SudanMap
                                        data={currentMapViewLevel === 'state' ? stateMapData : []}
                                        localityData={currentMapViewLevel === 'locality' ? localityMapData : []}
                                        facilityMarkers={[]} 
                                        viewLevel={currentMapViewLevel}
                                        center={mapViewConfig.center}
                                        scale={mapViewConfig.scale}
                                        focusedState={mapViewConfig.focusedState}
                                        isMovable={false}
                                        pannable={false}
                                        onStateHover={(k, e) => handleMapHover(false, k, e)}
                                        onLocalityHover={(g, e) => handleMapHover(true, g.admin_2, e)}
                                        onStateLeave={() => setHoverData(null)}
                                        onLocalityLeave={() => setHoverData(null)}
                                    />
                                </div>
                                <div className="bg-slate-50 border-t border-gray-200 py-3 px-4 flex justify-center items-center rounded-bl-xl">
                                    <MapLegend />
                                </div>
                            </div>

                            {/* RIGHT COLUMN: KPI CARDS (1/3 width) */}
                            <div className="lg:w-1/3 flex flex-col p-5 bg-slate-50/50">
                                <div className="flex flex-col gap-4 overflow-y-auto h-full justify-between">
                                    <CompactKPICard 
                                        percentage={kpiData.imnci.perc}
                                        title={t('dashboard.kpi.imnci.title', "العلاج المتكامل للاطفال قل من 5 سنوات (IMNCI)")}
                                        numeratorLabel={t('dashboard.kpi.imnci.num', "المراكز المطبقة")}
                                        numeratorValue={kpiData.imnci.num}
                                        denominatorLabel={t('dashboard.kpi.imnci.den', "المراكز الكلية المستهدفة")}
                                        denominatorValue={kpiData.imnci.den}
                                        colorClass="bg-sky-600"
                                        className="flex-1"
                                    />
                                    <CompactKPICard 
                                        percentage={kpiData.etat.perc}
                                        title={t('dashboard.kpi.etat.title', "الفرز والتقييم والمعالجة للاطفال في الطوارئ (ETAT)")}
                                        numeratorLabel={t('dashboard.kpi.etat.num', "المستشفيات المطبقة")}
                                        numeratorValue={kpiData.etat.num}
                                        denominatorLabel={t('dashboard.kpi.etat.den', "المستشفيات المستهدفة (أطفال/عامة)")}
                                        denominatorValue={kpiData.etat.den}
                                        colorClass="bg-teal-600"
                                        className="flex-1"
                                    />
                                    <CompactKPICard 
                                        percentage={kpiData.eenc.perc}
                                        title={t('dashboard.kpi.eenc.title', "الرعاية الضرورية المبكرة للاطفال حديثي الولادة (EENC)")}
                                        numeratorLabel={t('dashboard.kpi.eenc.num', "المستشفيات المطبقة")}
                                        numeratorValue={kpiData.eenc.num}
                                        denominatorLabel={t('dashboard.kpi.eenc.den', "مستشفيات طوارئ الحمل والولادة")}
                                        denominatorValue={kpiData.eenc.den}
                                        colorClass="bg-indigo-600"
                                        className="flex-1"
                                    />
                                    <CompactKPICard 
                                        percentage={kpiData.scnu.perc}
                                        title={t('dashboard.kpi.scnu.title', "الرعاية الخاصة للاطفال حديثي الولادة SCNU")}
                                        numeratorLabel={t('dashboard.kpi.scnu.num', "المستشفيات المطبقة")}
                                        numeratorValue={kpiData.scnu.num}
                                        denominatorLabel={t('dashboard.kpi.scnu.den', "المستشفيات المستهدفة")}
                                        denominatorValue={kpiData.scnu.den}
                                        colorClass="bg-purple-600"
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
            
            {/* TOOLTIP RENDER */}
            {hoverData && (
                <div style={{ position: 'fixed', left: hoverPosition.x - 20, top: hoverPosition.y, pointerEvents: 'none', zIndex: 999 }}>
                    <CombinedMapTooltip data={hoverData} />
                </div>
            )}
        </div>
    );
};