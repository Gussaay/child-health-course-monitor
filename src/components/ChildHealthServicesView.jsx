// ChildHealthServicesView.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAuth } from "firebase/auth";
import { writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useDataCache } from '../DataContext';

// Leaflet and React-Leaflet imports
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Geosearch imports
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';

// Turf.js for location checking
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

import {
    Card, PageHeader, Button, FormGroup, Select, Table,
    Modal, Spinner, EmptyState, Checkbox, Input
} from './CommonComponents';
import {
    saveFacilitySnapshot,
    upsertHealthFacility,
    listHealthFacilities,
    importHealthFacilities,
    deleteHealthFacility,
    deleteFacilitiesBatch,
    getHealthFacilityById,
    listPendingFacilitySubmissions,
    approveFacilitySubmission,
    rejectFacilitySubmission,
    submitFacilityDataForApproval, // --- CORRECTED: Was submitFacilityUpdateForApproval ---
} from "../data.js";
import {
    GenericFacilityForm,
    IMNCIFormFields,
    EENCFormFields,
    NeonatalFormFields,
    CriticalCareFormFields,
} from './FacilityForms.jsx';
import { STATE_LOCALITIES } from "./constants.js";

// Fix for a known issue with react-leaflet's default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


// --- COMPONENT FOR GEOSEARCH FUNCTIONALITY ---
const SearchAndMoveMarker = ({ setPosition }) => {
    const map = useMap();

    useEffect(() => {
        const provider = new OpenStreetMapProvider();

        const searchControl = new GeoSearchControl({
            provider: provider,
            style: 'bar',
            showMarker: false, // We use our own draggable marker
            autoClose: true,
            keepResult: true,
            searchLabel: 'Search for a location...',
        });

        map.addControl(searchControl);

        const onLocationFound = (e) => {
            const { location } = e;
            const newPos = [location.y, location.x];
            map.flyTo(newPos, 16);
            setPosition(newPos);
        };

        map.on('geosearch/showlocation', onLocationFound);

        return () => {
            map.removeControl(searchControl);
            map.off('geosearch/showlocation', onLocationFound);
        };
    }, [map, setPosition]);

    return null;
};


// --- MAP MODAL COMPONENT ---
const LocationMapModal = ({ isOpen, onClose, facility, onSaveLocation }) => {
    const [position, setPosition] = useState(null);
    const [originalPosition, setOriginalPosition] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [hasValidCoordinates, setHasValidCoordinates] = useState(false);
    const [tileProvider, setTileProvider] = useState('street');

    const markerRef = useRef(null);
    const mapRef = useRef(null);

    const tileLayers = {
        street: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        },
        light: {
            url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        },
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: 'Tiles &copy; Esri &mdash; i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }
    };

    useEffect(() => {
        if (isOpen) {
            setIsEditing(false);
            let initialPos = [15.5007, 32.5599]; // Default: Khartoum
            let validCoordsFound = false;

            if (facility?._الإحداثيات_latitude != null && facility?._الإحداثيات_longitude != null) {
                const lat = parseFloat(facility._الإحداثيات_latitude);
                const lng = parseFloat(facility._الإحداثيات_longitude);

                if (!isNaN(lat) && !isNaN(lng)) {
                    initialPos = [lat, lng];
                    validCoordsFound = true;
                }
            }
            setPosition(initialPos);
            setOriginalPosition(initialPos);
            setHasValidCoordinates(validCoordsFound);

            if (mapRef.current) {
                mapRef.current.flyTo(initialPos, 16);
            }
        }
    }, [isOpen, facility]);

    const eventHandlers = useMemo(() => ({
        dragend() {
            const marker = markerRef.current;
            if (marker != null) {
                const newPos = marker.getLatLng();
                setPosition([newPos.lat, newPos.lng]);
            }
        },
    }), []);

    const handleSave = async () => {
        if (!position) return;
        setIsSaving(true);
        try {
            await onSaveLocation({
                _الإحداثيات_latitude: position[0],
                _الإحداثيات_longitude: position[1],
            });
            onClose();
        } catch (error) {
            console.error("Failed to save location:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnterEditMode = () => {
        setIsEditing(true);
        setHasValidCoordinates(true);
    };

    const handleCancelEdit = () => {
        setPosition(originalPosition);
        setIsEditing(false);
        setHasValidCoordinates(!!(parseFloat(facility?._الإحداثيات_latitude) && parseFloat(facility?._الإحداثيات_longitude)));
    };

    if (!isOpen || !position) return null;

    const modalTitle = isEditing
        ? `Editing Location: ${facility?.['اسم_المؤسسة']}`
        : `Location of ${facility?.['اسم_المؤسسة']}`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
            <div className="p-4 relative" style={{ height: '500px', width: '100%' }}>
                 <div className="absolute top-6 right-6 z-[1000] bg-white p-1 rounded-md shadow-lg flex flex-col gap-1">
                    <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 rounded">
                        <input type="radio" name="tile-provider" value="street" checked={tileProvider === 'street'} onChange={(e) => setTileProvider(e.target.value)} className="form-radio"/>
                        Street (Detailed)
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 rounded">
                        <input type="radio" name="tile-provider" value="light" checked={tileProvider === 'light'} onChange={(e) => setTileProvider(e.target.value)} className="form-radio"/>
                        Light
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 rounded">
                        <input type="radio" name="tile-provider" value="satellite" checked={tileProvider === 'satellite'} onChange={(e) => setTileProvider(e.target.value)} className="form-radio"/>
                        Satellite
                    </label>
                </div>

                <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} ref={mapRef}>
                    <TileLayer {...tileLayers[tileProvider]} key={tileProvider} />

                    {isEditing && <SearchAndMoveMarker setPosition={setPosition} />}

                    {hasValidCoordinates && (
                        <Marker
                            draggable={isEditing}
                            eventHandlers={eventHandlers}
                            position={position}
                            ref={markerRef}
                        ></Marker>
                    )}
                </MapContainer>

                {!hasValidCoordinates && !isEditing && (
                    <div className="text-center bg-yellow-100 text-yellow-800 p-3 mt-4 rounded-md">
                        <p>No valid coordinates found for this facility.</p>
                        <p className="font-semibold">Click 'Edit' to set the location on the map.</p>
                    </div>
                )}

                {isEditing && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] w-fit text-center font-mono bg-white bg-opacity-80 p-2 rounded shadow-lg pointer-events-none">
                        <p className="text-xs">Drag the marker or use the search bar to set the location.</p>
                        <p className="text-sm"><b>Lat:</b> {position[0].toFixed(6)} | <b>Lon:</b> {position[1].toFixed(6)}</p>
                    </div>
                )}
            </div>
            <div className="flex justify-end p-4 border-t gap-2">
                {isEditing ? (
                    <>
                        <Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Location'}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button variant="secondary" onClick={onClose}>Close</Button>
                        <Button onClick={handleEnterEditMode}>Edit</Button>
                    </>
                )}
            </div>
        </Modal>
    );
};


// --- TABS & TITLES ---
const TABS = {
    PENDING: 'Pending Submissions',
    ALL: 'All Facilities',
    IMNCI: 'IMNCI Services',
    EENC: 'EENC Services',
    NEONATAL: 'Neonatal Care Unit',
    CRITICAL: 'Emergency & Critical Care',
};

const ARABIC_TITLES = {
    [TABS.IMNCI]: "خدمات العلاج المتكامل لأمراض الطفولة",
    [TABS.EENC]: "خدمات الرعاية الطارئة لحديثي الولادة",
    [TABS.NEONATAL]: "وحدة رعاية حديثي الولادة",
    [TABS.CRITICAL]: "الطوارئ والرعاية الحرجة",
};

// --- HELPER for Template/Download Configuration ---
const getServiceConfig = (serviceType) => {
    const baseConfig = { headers: ["ID", "الولاية", "المحلية", "اسم المؤسسة", "نوع المؤسسةالصحية", "نوع الخدمات", "Date of Visit"], dataKeys: ["id", "الولاية", "المحلية", "اسم_المؤسسة", "نوع_المؤسسةالصحية", "eenc_service_type", "date_of_visit"] };
    const baseImnciHeaders = ["هل المؤسسة تعمل", "هل توجد حوافز للاستاف", "ما هي المنظمة المقدم للحوافز", "هل تشارك المؤسسة في أي مشروع", "ما هو اسم المشروع", "رقم هاتف المسئول من المؤسسة", "وجود العلاج المتكامل لامراض الطفولة", "العدد الكلي للكوادر الطبية العاملة (أطباء ومساعدين)", "العدد الكلي للكودار المدربة על العلاج المتكامل", "وجود سجل علاج متكامل", "وجود كتيب لوحات", "ميزان وزن", "ميزان طول", "ميزان حرارة", "ساعة مؤقت", "غرفة إرواء", "وجود الدعم المادي", "_الإحداثيات_latitude", "_الإحداثيات_longitude", "هل يوجد مكتب تحصين", "اين يقع اقرب مركز تحصين", "هل يوجد مركز تغذية خارجي", "اين يقع اقرب مركز تغذية خارجي", "هل يوجد خدمة متابعة النمو"];
    const baseImnciDataKeys = ["هل_المؤسسة_تعمل", "staff_incentives", "staff_incentives_organization", "project_participation", "project_name", "person_in_charge_phone", "وجود_العلاج_المتكامل_لامراض_الطفولة", "العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين", "العدد_الكلي_للكودار_ المدربة_على_العلاج_المتكامل", "وجود_سجل_علاج_متكامل", "وجود_كتيب_لوحات", "ميزان_وزن", "ميزان_طول", "ميزان_حرارة", "ساعة_ مؤقت", "غرفة_إرواء", "وجود_الدعمادي", "_الإحداثيات_latitude", "_الإحداثيات_longitude", "immunization_office_exists", "nearest_immunization_center", "nutrition_center_exists", "nearest_nutrition_center", "growth_monitoring_service_exists"];
    const MAX_STAFF = 5;
    for (let i = 1; i <= MAX_STAFF; i++) { baseImnciHeaders.push(`اسم الكادر ${i}`, `الوصف الوظيفي للكادر ${i}`, `هل الكادر ${i} مدرب`, `تاريخ تدريب الكادر ${i}`, `رقم هاتف الكادر ${i}`); baseImnciDataKeys.push(`imnci_staff_${i}_name`, `imnci_staff_${i}_job_title`, `imnci_staff_${i}_is_trained`, `imnci_staff_${i}_training_date`, `imnci_staff_${i}_phone`); }
    const imnciConfig = { headers: baseImnciHeaders, dataKeys: baseImnciDataKeys };
    const eencConfig = { headers: ["هل تقدم الرعاية الضرورية المبكرة EENC", "عدد الكوادر الصحية المدربة", "العدد الكلي لسرير الولادة", "العدد الكلي لمحطات الانعاش", "العدد الكلي لاجهزة التدفئة", "العدد الكلي لجهاز الامبوباق", "العدد الكلي لجهاز الشفط اليدوي", "ساعة حائط", "جهاز التعقيم بالبخار", "تاريخ الزيارة لغرفة الولادة"], dataKeys: ["eenc_provides_essential_care", "eenc_trained_workers", "eenc_delivery_beds", "eenc_resuscitation_stations", "eenc_warmers", "eenc_ambu_bags", "eenc_manual_suction", "eenc_wall_clock", "eenc_steam_sterilizer", "eenc_delivery_room_visit_date"] };
    const neonatalConfig = { headers: ["Level of Care - Primary", "Level of Care - Secondary", "Level of Care - Tertiary", "وحدة رعاية الكنغر (KMC unit)", "وحدة الرضاعة الطبيعية (breastfeeding unit)", "وحدة تعقيم (sterilization unit)", "الترصد والحماية من عدوى التسمم الدموي", "إجمالي سعة الأسرة", "العدد الكلي للحضانات (incubators)", "العدد الكلي للاسرة للاطفال مكتملي النمو (cots)", "أجهزة CPAP", "جهاز تدفئة حرارية (warmer)", "مضخة تسريب (infusion pump)", "مضخات الحقن (Syringe pump)", "جهاز شفط (suction machine)", "وحدات العلاج الضوئي (Phototherapy)", "أكياس الإنعاش (Ambu Bag)", "جهاز مراقبة التنفس والاكسجين (Pulse and oxygen Monitor)", "جهاز أكسجين (Oxygen concentrator)", "أسطوانة الاكسجين (oxygen cylinder)", "جهاز تنفس صناعي (Mechanical ventilator)", "حاضنة محمولة (Portable Incubator)", "تاريخ زيارة وحدة حديثي الولادة"], dataKeys: ["neonatal_level_of_care_primary", "neonatal_level_of_care_secondary", "neonatal_level_of_care_tertiary", "neonatal_kmc_unit", "neonatal_breastfeeding_unit", "neonatal_sterilization_unit", "neonatal_sepsis_surveillance", "neonatal_total_beds", "neonatal_total_incubators", "neonatal_total_cots", "neonatal_cpap", "neonatal_warmer", "neonatal_infusion_pump", "neonatal_syringe_pump", "neonatal_sucker", "neonatal_phototherapy", "neonatal_ambu_bag", "neonatal_respiration_monitor", "neonatal_oxygen_machine", "neonatal_oxygen_cylinder", "neonatal_mechanical_ventilator", "neonatal_portable_incubator", "neonatal_unit_visit_date"] };
    const criticalCareConfig = { headers: ["etat_has_service", "etat_trained_workers", "hdu_has_service", "hdu_bed_capacity", "picu_has_service", "picu_bed_capacity"], dataKeys: ["etat_has_service", "etat_trained_workers", "hdu_has_service", "hdu_bed_capacity", "picu_has_service", "picu_has_service"] };
    let finalHeaders = [...baseConfig.headers], finalDataKeys = [...baseConfig.dataKeys], fileName = 'Facility_Template.xlsx';
    switch (serviceType) {
        case TABS.IMNCI: finalHeaders.push(...imnciConfig.headers); finalDataKeys.push(...imnciConfig.dataKeys); fileName = 'IMNCI_Template.xlsx'; break;
        case TABS.EENC: finalHeaders.push(...eencConfig.headers); finalDataKeys.push(...eencConfig.dataKeys); fileName = 'EENC_Template.xlsx'; break;
        case TABS.NEONATAL: finalHeaders.push(...eencConfig.headers, ...neonatalConfig.headers); finalDataKeys.push(...eencConfig.dataKeys, ...neonatalConfig.dataKeys); fileName = 'Neonatal_Care_Template.xlsx'; break;
        case TABS.CRITICAL: finalHeaders.push(...eencConfig.headers, ...criticalCareConfig.headers); finalDataKeys.push(...eencConfig.dataKeys, ...criticalCareConfig.dataKeys); fileName = 'Critical_Care_Template.xlsx'; break;
        default: finalHeaders.push(...imnciConfig.headers, ...eencConfig.headers, ...neonatalConfig.headers, ...criticalCareConfig.headers); finalDataKeys.push(...imnciConfig.dataKeys, ...imnciConfig.dataKeys, ...eencConfig.dataKeys, ...neonatalConfig.dataKeys, ...criticalCareConfig.dataKeys); fileName = 'All_Services_Template.xlsx';
    }
    return { headers: [...new Set(finalHeaders)], dataKeys: [...new Set(finalDataKeys)], fileName };
};

const LOCALITY_EN_TO_AR_MAP = Object.values(STATE_LOCALITIES).flatMap(s => s.localities).reduce((acc, loc) => {
    acc[loc.en] = loc.ar;
    return acc;
}, {});

// --- SERVICE-SPECIFIC TAB COMPONENTS ---

// --- MODIFIED: AllFacilitiesTab ---
const AllFacilitiesTab = ({ facilities, onEdit, onDelete, onGenerateLink, onOpenMap, selectedFacilities, onToggleSelection, onToggleAll, emptyMessage, canApproveSubmissions, canManageFacilities }) => {
    const getServiceBadges = (f) => {
        const services = [];
        if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') services.push({ name: 'IMNCI', color: 'bg-sky-100 text-sky-800' });
        if (f.eenc_provides_essential_care === 'Yes') services.push({ name: 'EENC', color: 'bg-teal-100 text-teal-800' });
        if (f.neonatal_level_of_care && (f.neonatal_level_of_care.primary || f.neonatal_level_of_care.secondary || f.neonatal_level_of_care.tertiary)) services.push({ name: 'Neonatal', color: 'bg-indigo-100 text-indigo-800' });
        if (f.etat_has_service === 'Yes' || f.hdu_has_service === 'Yes' || f.picu_has_service === 'Yes') services.push({ name: 'Critical', color: 'bg-red-100 text-red-800' });
        if (services.length === 0) return <span className="text-xs text-gray-500">None</span>;
        return <div className="flex flex-wrap gap-1">{services.map(s => <span key={s.name} className={`px-2 py-1 text-xs font-medium rounded-full ${s.color}`}>{s.name}</span>)}</div>;
    };
    const getStateName = (stateKey) => STATE_LOCALITIES[stateKey]?.ar || stateKey || 'N/A';
    const getLocalityName = (stateKey, localityKey) => { if (!stateKey || !localityKey) return 'N/A'; const state = STATE_LOCALITIES[stateKey]; if (!state) return localityKey; const locality = state.localities.find(l => l.en === localityKey); return locality?.ar || localityKey; };
    const areAllSelected = facilities.length > 0 && facilities.every(f => selectedFacilities.has(f.id));

    return (
        <Table headers={[<Checkbox key="select-all" onChange={onToggleAll} checked={areAllSelected} />, '#', 'State', 'Locality', 'Facility Name', 'Facility Type', 'Functioning', 'Services Available', 'Actions']}>
            {facilities.length > 0 ? (
                facilities.map((f, index) => (
                    <tr key={f.id}>
                        <td><Checkbox onChange={() => onToggleSelection(f.id)} checked={selectedFacilities.has(f.id)} /></td>
                        <td>{index + 1}</td><td>{getStateName(f['الولاية'])}</td><td>{getLocalityName(f['الولاية'], f['المحلية'])}</td><td>{f['اسم_المؤسسة']}</td><td>{f['نوع_المؤسسةالصحية'] || 'N/A'}</td><td>{ (f['هل_المؤسسة_تعمل'] === 'Yes' || f['هل_المؤسسة_تعمل'] === 'No') ? <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${f['هل_المؤسسة_تعمل'] === 'Yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{f['هل_المؤسسة_تعمل']}</span> : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Not Set</span> }</td><td>{getServiceBadges(f)}</td>
                        <td className="min-w-[280px]">
                            <div className="flex flex-wrap gap-2">
                                {/* --- MODIFIED: Buttons are now conditional --- */}
                                {canManageFacilities && (
                                    <>
                                        <Button variant="info" size="sm" onClick={() => onEdit(f.id)}>Edit</Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => onDelete(f.id)}
                                        >
                                            Delete
                                        </Button>
                                    </>
                                )}
                                <Button size="sm" onClick={() => onGenerateLink(f.id)}>Link</Button>
                                <Button variant="secondary" size="sm" onClick={() => onOpenMap(f)}>Map</Button>
                            </div>
                        </td>
                    </tr>
                ))
            ) : (
                <tr>
                  <td colSpan={9}> {/* Adjusted colspan */}
                    <EmptyState message={emptyMessage} />
                  </td>
                </tr>
              )}
        </Table>
    );
};

const IMNCIServiceTab = ({ facilities, onEdit, onDelete, onGenerateLink, emptyMessage, canApproveSubmissions, canManageFacilities }) => (
    <Table headers={['Facility Name', 'Total Staff', 'Trained Staff', 'Actions']}>
        {facilities.length > 0 ? (
            facilities.map(f => (
                <tr key={f.id}>
                    <td>{f.اسم_المؤسسة}</td>
                    <td>{f['العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين'] || 'N/A'}</td>
                    <td>{f['العدد_الكلي_للكودار_ المدربة_على_العلاج_المتكامل'] || 'N/A'}</td>
                    <td className="min-w-[240px]">
                        <div className="flex flex-wrap gap-2">
                            {/* --- MODIFIED: Button is now conditional --- */}
                            {canManageFacilities && <Button variant="info" onClick={() => onEdit(f.id)}>Edit</Button>}
                            {/* Deletion handled via All Facilities Tab */}
                            <Button onClick={() => onGenerateLink(f.id)}>Generate Link</Button>
                        </div>
                    </td>
                </tr>
            ))
        ) : (
            <tr>
              <td colSpan={4}> {/* Adjusted colspan */}
                <EmptyState message={emptyMessage} />
              </td>
            </tr>
          )}
    </Table>
);

const EENCServiceTab = ({ facilities, onEdit, onDelete, emptyMessage, canApproveSubmissions, canManageFacilities }) => (
    <Table headers={['Facility Name', 'State', 'Operational', 'Service Type', 'Trained Workers', 'Actions']}>
        {facilities.length > 0 ? (
            facilities.map(f => (
                <tr key={f.id}>
                    <td>{f.اسم_المؤسسة}</td>
                    <td>{f.الولاية}</td>
                    <td>{f.هل_المؤسسة_تعمل}</td>
                    <td>{f.eenc_service_type || 'N/A'}</td>
                    <td>{f.eenc_trained_workers || 'N/A'}</td>
                    <td className="min-w-[180px]">
                        <div className="flex flex-wrap gap-2">
                            {/* --- MODIFIED: Button is now conditional --- */}
                            {canManageFacilities && <Button variant="info" onClick={() => onEdit(f.id)}>Edit</Button>}
                            {/* Deletion handled via All Facilities Tab */}
                        </div>
                    </td>
                </tr>
            ))
        ) : (
             <tr>
              <td colSpan={6}> {/* Adjusted colspan */}
                <EmptyState message={emptyMessage} />
              </td>
            </tr>
          )}
    </Table>
);

const NeonatalServiceTab = ({ facilities, onEdit, onDelete, emptyMessage, canApproveSubmissions, canManageFacilities }) => (
    <Table headers={['Facility Name', 'Level of Care', 'Total Beds', 'Incubators', 'Sepsis Surveillance', 'Actions']}>
        {facilities.length > 0 ? (
            facilities.map(f => {
                let levelOfCareDisplay = 'N/A';
                const levelData = f.neonatal_level_of_care;
                if (typeof levelData === 'string' && levelData) {
                    levelOfCareDisplay = levelData;
                } else if (typeof levelData === 'object' && levelData !== null) {
                    const levels = [];
                    if (levelData.primary) levels.push('Primary');
                    if (levelData.secondary) levels.push('Special Care');
                    if (levelData.tertiary) levels.push('NICU');
                    if (levels.length > 0) levelOfCareDisplay = levels.join(', ');
                }
                return (
                    <tr key={f.id}>
                        <td>{f.اسم_المؤسسة}</td>
                        <td>{levelOfCareDisplay}</td>
                        <td>{f.neonatal_total_beds || 'N/A'}</td>
                        <td>{f.neonatal_total_incubators || 'N/A'}</td>
                        <td>{f.neonatal_sepsis_surveillance || 'No'}</td>
                        <td className="min-w-[180px]">
                            <div className="flex flex-wrap gap-2">
                                {/* --- MODIFIED: Button is now conditional --- */}
                                {canManageFacilities && <Button variant="info" onClick={() => onEdit(f.id)}>Edit</Button>}
                                {/* Deletion handled via All Facilities Tab */}
                            </div>
                        </td>
                    </tr>
                );
            })
        ) : (
             <tr>
              <td colSpan={6}> {/* Adjusted colspan */}
                <EmptyState message={emptyMessage} />
              </td>
            </tr>
          )}
    </Table>
);

const CriticalCareServiceTab = ({ facilities, onEdit, onDelete, emptyMessage, canApproveSubmissions, canManageFacilities }) => (
    <Table headers={['Facility Name', 'Has ETAT', 'Has HDU', 'Has PICU', 'Actions']}>
        {facilities.length > 0 ? (
            facilities.map(f => (
                <tr key={f.id}>
                    <td>{f.اسم_المؤسسة}</td>
                    <td>{f.etat_has_service || 'No'}</td>
                    <td>{f.hdu_has_service || 'No'}</td>
                    <td>{f.picu_has_service || 'No'}</td>
                    <td className="min-w-[180px]">
                        <div className="flex flex-wrap gap-2">
                            {/* --- MODIFIED: Button is now conditional --- */}
                            {canManageFacilities && <Button variant="info" onClick={() => onEdit(f.id)}>Edit</Button>}
                           {/* Deletion handled via All Facilities Tab */}
                        </div>
                    </td>
                </tr>
            ))
        ) : (
            <tr>
              <td colSpan={5}> {/* Adjusted colspan */}
                <EmptyState message={emptyMessage} />
              </td>
            </tr>
          )}
    </Table>
);

// --- MODIFIED: PendingSubmissionsTab ---
const PendingSubmissionsTab = ({ submissions, onApprove, onReject }) => {
    return (
        <Table headers={['Submission Date', 'Facility Name', 'State', 'Locality', 'Submitted By', 'Actions']}>
            {(!submissions || submissions.length === 0) ? (
                 <tr>
                  <td colSpan={6}> {/* Adjusted colspan */}
                    <EmptyState message="No pending submissions found." />
                  </td>
                 </tr>
            ) : (
                submissions.map(s => (
                    <tr key={s.submissionId}>
                        <td>{s.submittedAt?.toDate ? s.submittedAt.toDate().toLocaleDateString() : 'N/A'}</td>
                        <td>
                            {s['اسم_المؤسسة']}
                            {/* Badge remains the same */}
                            {s._action === 'DELETE' && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Deletion Request</span>
                            )}
                        </td>
                        <td>{s['الولاية']}</td>
                        <td>{s['المحلية']}</td>
                        <td>{s.updated_by || 'Public Submission'}</td>
                        <td className="flex flex-wrap gap-2">
                            <Button variant="success" size="sm" onClick={() => onApprove(s)}>View / Approve</Button>
                            {/* Rejection logic remains the same */}
                            <Button variant="danger" size="sm" onClick={() => onReject(s.submissionId, s._action === 'DELETE')}>Reject</Button>
                        </td>
                    </tr>
                ))
            )}
        </Table>
    );
};
// ... (rest of BulkUploadModal, DuplicateFinderModal, DataCleanupModal, LocationMismatchModal implementations - unchanged) ...
const MappingRow = React.memo(({ field, headers, selectedValue, onMappingChange }) => ( <div className="flex items-center"><label className="w-1/2 font-medium text-sm capitalize">{field.label}{field.key === 'اسم_المؤسسة' && '*'}</label><Select value={selectedValue || ''} onChange={(e) => onMappingChange(field.key, e.target.value)} className="flex-1"><option value="">-- Select Excel Column --</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</Select></div> ));

const BulkUploadModal = ({ isOpen, onClose, onImport, uploadStatus, activeTab, filteredData, cleanupConfig }) => {
    // ... (BulkUploadModal implementation - unchanged) ...
     const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [validationIssues, setValidationIssues] = useState([]);
    const [userCorrections, setUserCorrections] = useState({});
    const [failedRows, setFailedRows] = useState([]);
    const fileInputRef = useRef(null);
    const MAX_STAFF = 5;

    useEffect(() => {
        if (uploadStatus.inProgress) {
            setCurrentPage(2);
        } else if (uploadStatus.message) {
            const detailedErrors = uploadStatus.errors?.filter(e => e.rowData);
            if (detailedErrors && detailedErrors.length > 0) {
                setFailedRows(detailedErrors);
                setCurrentPage('correction');
            } else {
                setCurrentPage(3);
            }
        }
    }, [uploadStatus.inProgress, uploadStatus.message, uploadStatus.errors]);

    useEffect(() => {
        if (isOpen) {
            setCurrentPage(0);
            setError('');
            setExcelData([]);
            setHeaders([]);
            setFieldMappings({});
            setValidationIssues([]);
            setUserCorrections({});
            setFailedRows([]);
        }
    }, [isOpen]);

    const FIELD_LABELS = useMemo(() => ({ 'eenc_service_type': 'نوع الخدمات المقدمة', }), []);
    const allFacilityFields = useMemo(() => { if (!activeTab) return []; const config = getServiceConfig(activeTab); return [{ key: 'id', label: 'ID (for updates)' }, ...config.dataKeys.filter(key => key !== 'id').map(key => ({ key, label: FIELD_LABELS[key] || key.replace(/_/g, ' ') }))]; }, [activeTab, FIELD_LABELS]);

    const handleFileUpload = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { try { const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, { type: 'array' }); const worksheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", cellDates: true }); if (jsonData.length < 1) { setError('Excel file appears to be empty.'); return; } setHeaders(jsonData[0].map(h => String(h).trim())); setExcelData(jsonData.slice(1)); setCurrentPage(1); setError(''); } catch (err) { setError('Error reading Excel file: ' + err.message); } }; reader.readAsArrayBuffer(file); };

    const handleDownloadTemplate = () => {
        const { headers: finalHeaders, dataKeys: finalDataKeys, fileName } = getServiceConfig(activeTab);
        let downloadFileName = `New_Facilities_${fileName}`;
        let worksheetData = [finalHeaders];

        if (filteredData && filteredData.length > 0) {
            downloadFileName = `Update_Template_For_${fileName}`;
            const rowsData = filteredData.map(facility => {
                const flatFacilityData = { ...facility };
                if (facility.imnci_staff && Array.isArray(facility.imnci_staff)) {
                    facility.imnci_staff.slice(0, MAX_STAFF).forEach((staff, index) => {
                        const i = index + 1;
                        flatFacilityData[`imnci_staff_${i}_name`] = staff.name;
                        flatFacilityData[`imnci_staff_${i}_job_title`] = staff.job_title;
                        flatFacilityData[`imnci_staff_${i}_is_trained`] = staff.is_trained || 'No';
                        flatFacilityData[`imnci_staff_${i}_training_date`] = staff.training_date;
                        flatFacilityData[`imnci_staff_${i}_phone`] = staff.phone;
                    });
                }
                if (facility.neonatal_level_of_care && typeof facility.neonatal_level_of_care === 'object') {
                    flatFacilityData.neonatal_level_of_care_primary = facility.neonatal_level_of_care.primary ? 'Yes' : 'No';
                    flatFacilityData.neonatal_level_of_care_secondary = facility.neonatal_level_of_care.secondary ? 'Yes' : 'No';
                    flatFacilityData.neonatal_level_of_care_tertiary = facility.neonatal_level_of_care.tertiary ? 'Yes' : 'No';
                }

                return finalDataKeys.map(key => {
                    let value = flatFacilityData[key];
                    if (value === undefined || value === null || value === '') {
                        return '';
                    }
                    return value;
                });
            });
            worksheetData.push(...rowsData);
        }
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facilities");
        XLSX.writeFile(workbook, downloadFileName);
    };

    const handleMappingChange = useCallback((appField, excelHeader) => { setFieldMappings(prev => { const newMappings = { ...prev }; if (excelHeader) newMappings[appField] = excelHeader; else delete newMappings[appField]; return newMappings; }); }, []);

    const handleValidation = () => {
        if (!fieldMappings['اسم_المؤسسة']) {
            setError('The "Facility Name" (اسم_المؤسسة) field must be mapped to an Excel column.');
            return;
        }
        setError('');

        const issues = [];
        const checkedFields = {};
        const mappedFields = Object.keys(fieldMappings);

        for (const appField of mappedFields) {
            const config = cleanupConfig[appField];
            if (config && config.standardValues && !checkedFields[appField]) {
                const excelHeader = fieldMappings[appField];
                const headerIndex = headers.indexOf(excelHeader);
                if (headerIndex === -1) continue;

                const invalidValues = new Set();
                const standardValuesLower = new Set(config.standardValues.map(v => String(v).toLowerCase()));

                excelData.forEach(row => {
                    const cellValue = row[headerIndex];
                    if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                        const cleanCellValue = String(cellValue).trim().toLowerCase();
                        if (!standardValuesLower.has(cleanCellValue)) {
                            invalidValues.add(String(cellValue).trim());
                        }
                    }
                });

                if (invalidValues.size > 0) {
                    issues.push({
                        columnName: excelHeader,
                        appField: appField,
                        invalidValues: Array.from(invalidValues).sort(),
                        options: config.standardValues
                    });
                }
                checkedFields[appField] = true;
            }
        }

        if (issues.length > 0) {
            setValidationIssues(issues);
            setCurrentPage('validation');
        } else {
            startImportProcess();
        }
    };

    const handleCorrectionChange = (originalValue, mappedValue) => {
        setUserCorrections(prev => ({ ...prev, [originalValue]: mappedValue }));
    };

    const processAndStartImport = (dataForProcessing, originalRawData) => {
        const normalizeBoolean = (value) => { if (value === null || value === undefined) return value; const strValue = String(value).toLowerCase().trim(); const yesValues = ['yes', 'نعم', 'توجد', 'يوجد', true]; const noValues = ['no', 'لا', 'لاتوجد', 'لا توجد', false]; if (yesValues.includes(strValue)) return 'Yes'; if (noValues.includes(strValue)) return 'No'; return value; };

        const serviceGroups = { eenc: { dateKey: 'eenc_delivery_room_visit_date', dataKeys: getServiceConfig(TABS.EENC).dataKeys.filter(k => k.startsWith('eenc_')) }, neonatal: { dateKey: 'neonatal_unit_visit_date', dataKeys: getServiceConfig(TABS.NEONATAL).dataKeys.filter(k => k.startsWith('neonatal_')) }, critical: { dateKey: 'date_of_visit', dataKeys: getServiceConfig(TABS.CRITICAL).dataKeys.filter(k => k.startsWith('etat_') || k.startsWith('hdu_') || k.startsWith('picu_')) }, imnci: { dateKey: 'date_of_visit', dataKeys: getServiceConfig(TABS.IMNCI).dataKeys.filter(k => !k.startsWith('eenc_') && !k.startsWith('neonatal_') && !k.startsWith('etat_') && !k.startsWith('hdu_') && !k.startsWith('picu_')) } };
        const allServiceDataKeys = Object.values(serviceGroups).flatMap(g => g.dataKeys);

        let allPayloads = [];
        dataForProcessing.forEach(row => {
            const facilityFromRow = {};
            if (Array.isArray(row)) {
                Object.entries(fieldMappings).forEach(([appFieldKey, excelHeader]) => {
                    const headerIndex = headers.indexOf(excelHeader);
                    if (headerIndex !== -1) {
                        let cellValue = row[headerIndex];
                        if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                            const finalValue = cellValue instanceof Date ? cellValue.toISOString().split('T')[0] : userCorrections[String(cellValue).trim()] ?? cellValue;
                            facilityFromRow[appFieldKey] = finalValue;
                        }
                    }
                });
            } else {
                 Object.assign(facilityFromRow, row);
            }

            if (!facilityFromRow['اسم_المؤسسة']) return;

            const commonData = Object.keys(facilityFromRow).filter(key => !allServiceDataKeys.includes(key)).reduce((obj, key) => { obj[key] = facilityFromRow[key]; return obj; }, {});
            const payloadsByDate = new Map();
            Object.values(serviceGroups).forEach(group => { const visitDate = facilityFromRow[group.dateKey]; if (visitDate) { const serviceDataForDate = group.dataKeys.reduce((obj, key) => { if (facilityFromRow[key] !== undefined) obj[key] = facilityFromRow[key]; return obj; }, {}); if (Object.keys(serviceDataForDate).length > 0) { const existingPayload = payloadsByDate.get(visitDate) || { ...commonData }; const updatedPayload = { ...existingPayload, ...serviceDataForDate, date_of_visit: visitDate }; payloadsByDate.set(visitDate, updatedPayload); } } });
            if (payloadsByDate.size === 0) { const defaultDate = facilityFromRow['date_of_visit'] || new Date().toISOString().split('T')[0]; payloadsByDate.set(defaultDate, { ...facilityFromRow, date_of_visit: defaultDate }); }
            allPayloads.push(...Array.from(payloadsByDate.values()));
        });

        const booleanFields = ['هل_المؤسسة_تعمل', 'staff_incentives', 'project_participation', 'وجود_العلاج_المتكامل_لامراض_الطفولة', 'وجود_سجل_علاج_متكامل', 'وجود_كتيب_لوحات', 'ميزان_وزن', 'ميزان_طول', 'ميزان_حرارة', 'ساعة_مؤقت', 'غرفة_إرواء', 'eenc_provides_essential_care', 'eenc_steam_sterilizer', 'eenc_wall_clock', 'etat_has_service', 'hdu_has_service', 'picu_has_service', 'neonatal_level_of_care_primary', 'neonatal_level_of_care_secondary', 'neonatal_level_of_care_tertiary', 'neonatal_kmc_unit', 'neonatal_breastfeeding_unit', 'neonatal_sterilization_unit', 'immunization_office_exists', 'nutrition_center_exists', 'growth_monitoring_service_exists', 'neonatal_sepsis_surveillance'];
        const serviceTypeNormalizationMap = { 'comprehensive emonc': 'CEmONC', 'cemonc': 'CEmONC', 'basic emonc pediatric': 'BEmONC', 'bemoc': 'BEmONC', 'general': 'general', 'pediatric': 'pediatric' };
        const auth = getAuth(); const user = auth.currentUser; const uploadTimestamp = new Date().toISOString(); let uploaderIdentifier = user ? (user.displayName || user.email) : 'Unknown Uploader';

        const processedFacilities = allPayloads.map(payload => {
            const newFacility = { ...payload }; newFacility.updated_by = uploaderIdentifier; newFacility['اخر تحديث'] = uploadTimestamp; if (newFacility.eenc_service_type) { const lowerValue = String(newFacility.eenc_service_type).toLowerCase().trim(); newFacility.eenc_service_type = serviceTypeNormalizationMap[lowerValue] || newFacility.eenc_service_type; }
            for (const field of booleanFields) { if (newFacility.hasOwnProperty(field)) newFacility[field] = normalizeBoolean(newFacility[field]); }
            const staffList = []; for (let i = 1; i <= MAX_STAFF; i++) { if (newFacility[`imnci_staff_${i}_name`]) { staffList.push({ name: newFacility[`imnci_staff_${i}_name`], job_title: newFacility[`imnci_staff_${i}_job_title`] || '', is_trained: normalizeBoolean(newFacility[`imnci_staff_${i}_is_trained`]) || 'No', training_date: newFacility[`imnci_staff_${i}_training_date`] || '', phone: newFacility[`imnci_staff_${i}_phone`] || '' }); } delete newFacility[`imnci_staff_${i}_name`]; delete newFacility[`imnci_staff_${i}_job_title`]; delete newFacility[`imnci_staff_${i}_is_trained`]; delete newFacility[`imnci_staff_${i}_training_date`]; delete newFacility[`imnci_staff_${i}_phone`]; }
            if (staffList.length > 0) newFacility.imnci_staff = staffList;
            const key1 = 'neonatal_level_of_care_primary', key2 = 'neonatal_level_of_care_secondary', key3 = 'neonatal_level_of_care_tertiary'; if (newFacility[key1] || newFacility[key2] || newFacility[key3]) { newFacility.neonatal_level_of_care = { primary: newFacility[key1] === 'Yes', secondary: newFacility[key2] === 'Yes', tertiary: newFacility[key3] === 'Yes', }; } delete newFacility[key1]; delete newFacility[key2]; delete newFacility[key3];
            return newFacility;
        });

        if (processedFacilities.length === 0) {
            setError('No valid facilities with a name were found after mapping and filtering.');
            setCurrentPage(1);
            return;
        }

        onImport(processedFacilities, originalRawData);
    };

    const startImportProcess = () => processAndStartImport(excelData, excelData);

    const handleRetryUpload = () => {
        const dataToRetry = failedRows.map(failedRow => {
            const correctedObject = {};
            headers.forEach((header, index) => {
                const appField = Object.keys(fieldMappings).find(key => fieldMappings[key] === header);
                if(appField) {
                    correctedObject[appField] = failedRow.rowData[index];
                }
            });
            return correctedObject;
        });

        setFailedRows([]);
        const originalFailedRows = failedRows.map(fr => fr.rowData);
        processAndStartImport(dataToRetry, originalFailedRows);
    };


    const handleCorrectionDataChange = (errorIndex, cellIndex, value) => {
        const updatedFailedRows = [...failedRows];
        const newRowData = [...updatedFailedRows[errorIndex].rowData];
        newRowData[cellIndex] = value;
        updatedFailedRows[errorIndex].rowData = newRowData;
        setFailedRows(updatedFailedRows);
    };

    const renderPreview = () => (excelData.length === 0) ? null : (<div className="mt-4 overflow-auto max-h-60"><h4 className="font-medium mb-2">Data Preview (first 5 rows)</h4><table className="min-w-full border border-gray-200"><thead><tr className="bg-gray-100">{headers.map((header, idx) => <th key={idx} className="border border-gray-300 p-2 text-left text-xs">{header}</th>)}</tr></thead><tbody>{excelData.slice(0, 5).map((row, rowIdx) => <tr key={rowIdx}>{row.map((cell, cellIdx) => <td key={cellIdx} className="border border-gray-300 p-2 text-xs">{cell instanceof Date ? cell.toLocaleDateString() : cell}</td>)}</tr>)}</tbody></table></div>);
    const renderValidationScreen = () => { const allCorrectionsMade = validationIssues.every(issue => issue.invalidValues.every(val => userCorrections[val])); return (<div><h4 className="font-medium text-lg mb-2">Review Data Mismatches</h4><p className="text-sm text-gray-600 mb-4">Some values in your file don't match the expected options. Please map your values to the correct ones.</p><div className="space-y-4 max-h-96 overflow-y-auto p-2 border rounded bg-gray-50">{validationIssues.map(issue => (<div key={issue.columnName}><h5 className="font-semibold text-gray-800">Mismatches for Column: <span className="font-bold">"{issue.columnName}"</span></h5>{issue.invalidValues.map(val => (<div key={val} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 mt-2 p-2 bg-white rounded border"><span className="bg-red-50 text-red-800 p-2 rounded text-sm truncate" title={val}>Your value: "{val}"</span><span className="text-center font-bold text-gray-500 hidden md:block">&rarr;</span><Select value={userCorrections[val] || ''} onChange={(e) => handleCorrectionChange(val, e.target.value)}><option value="">-- Choose correct option --</option>{issue.options.map(opt => <option key={opt} value={opt}>{STATE_LOCALITIES[opt]?.ar || opt}</option>)}</Select></div>))}</div>))}</div><div className="flex justify-end mt-6 space-x-2"><Button variant="secondary" onClick={() => setCurrentPage(1)}>Back to Mapping</Button><Button onClick={startImportProcess} disabled={!allCorrectionsMade}>Apply and Import</Button></div>{!allCorrectionsMade && <p className="text-right text-sm text-red-600 mt-2">Please resolve all mismatches.</p>}</div>); };
    const renderProgressView = () => (<div><h4 className="font-medium text-lg mb-2">Import in Progress...</h4><p className="text-sm text-gray-600 mb-4">Please wait while the facilities are being uploaded.</p><div className="w-full bg-gray-200 rounded-full h-4"><div className="bg-blue-600 h-4 rounded-full transition-all duration-500" style={{ width: `${uploadStatus.total > 0 ? (uploadStatus.processed / uploadStatus.total) * 100 : 0}%` }}></div></div><p className="text-center mt-2 font-medium">{uploadStatus.processed} / {uploadStatus.total}</p></div>);
    const renderResultView = () => (<div><h4 className="font-medium text-lg mb-2">Import Complete</h4><div className="bg-gray-50 p-4 rounded-md"><p className="font-semibold whitespace-pre-wrap">{uploadStatus.message}</p>{uploadStatus.errors && uploadStatus.errors.length > 0 && !uploadStatus.errors.some(e => e.rowData) && (<div className="mt-4 max-h-40 overflow-y-auto"><h5 className="font-semibold text-red-700">Errors encountered (unrecoverable):</h5><ul className="list-disc list-inside text-sm text-red-600">{uploadStatus.errors.map((err, index) => <li key={index}>{err.message || err.toString()}</li>)}</ul></div>)}</div><div className="flex justify-end mt-6"><Button onClick={onClose}>Close</Button></div></div>);

    const renderCorrectionScreen = () => (
        <div>
            <h4 className="font-medium text-lg text-red-700 mb-2">Import Errors</h4>
            <p className="text-sm text-gray-600 mb-4">Some rows failed to import. You can correct the data below and retry uploading only the failed rows.</p>
            <div className="overflow-x-auto max-h-[60vh] border rounded-md">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-2 border-r text-left">Row #</th>
                            <th className="p-2 border-r text-left">Error</th>
                            {headers.map(header => <th key={header} className="p-2 border-r text-left whitespace-nowrap">{header}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {failedRows.map((error, errorIndex) => (
                            <tr key={error.rowIndex} className="bg-white hover:bg-red-50">
                                <td className="p-1 border-r font-medium">{error.rowIndex + 2}</td>
                                <td className="p-1 border-r text-red-600 max-w-xs">{error.message}</td>
                                {error.rowData.map((cell, cellIndex) => (
                                    <td key={cellIndex} className="p-0 border-r">
                                        <Input
                                            type="text"
                                            value={cell || ''}
                                            onChange={(e) => handleCorrectionDataChange(errorIndex, cellIndex, e.target.value)}
                                            className="w-full border-0 rounded-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleRetryUpload}>Retry Upload for {failedRows.length} Corrected Row(s)</Button>
            </div>
        </div>
    );

    return (<Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload" size="full"><div className="p-4">{error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}{currentPage === 0 && (<div><p className="mb-4">Download the template to get started. If you have filtered the facility list, the template will be pre-filled for easy updates.</p><Button variant="secondary" onClick={handleDownloadTemplate} className="mb-4">Download Template</Button><hr className="my-4"/><p className="mb-2">Or, upload your own Excel file (first row must be headers).</p><input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} ref={fileInputRef} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/></div>)}{currentPage === 1 && (<div><h4 className="font-medium mb-4">Map Excel columns to application fields</h4><p className="text-sm text-gray-600 mb-4">Match the columns from your Excel file to the application fields. To update existing records, ensure the 'ID' field is correctly mapped.</p><div className="grid grid-cols-2 gap-3 mb-4 max-h-80 overflow-y-auto p-2 border rounded">{allFacilityFields.map(field => <MappingRow key={field.key} field={field} headers={headers} selectedValue={fieldMappings[field.key]} onMappingChange={handleMappingChange}/>)}</div>{renderPreview()}<div className="flex justify-end mt-6 space-x-2"><Button variant="secondary" onClick={() => setCurrentPage(0)}>Back</Button><Button onClick={handleValidation}>Validate and Continue</Button></div></div>)}{currentPage === 'validation' && renderValidationScreen()}{currentPage === 'correction' && renderCorrectionScreen()}{currentPage === 2 && renderProgressView()}{currentPage === 3 && renderResultView()}</div></Modal>);
};

const DuplicateFinderModal = ({ isOpen, onClose, facilities, onDuplicatesDeleted }) => {
    // ... (DuplicateFinderModal implementation - unchanged) ...
     const [isLoading, setIsLoading] = useState(false); const [duplicateGroups, setDuplicateGroups] = useState([]); const [selectedGroups, setSelectedGroups] = useState({});
    const findDuplicates = useCallback(() => { setIsLoading(true); const groups = new Map(); facilities.forEach(facility => { const key = `${facility['الولاية'] || 'N/A'}-${facility['المحلية'] || 'N/A'}-${facility['اسم_المؤسسة'] || 'N/A'}`.toLowerCase(); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(facility); }); const foundDuplicates = []; groups.forEach((group, key) => { if (group.length > 1) { group.sort((a, b) => (b.lastSnapshotAt?.toMillis() || 0) - (a.lastSnapshotAt?.toMillis() || 0)); foundDuplicates.push({ key, original: group[0], duplicates: group.slice(1) }); } }); setDuplicateGroups(foundDuplicates); const initialSelection = {}; foundDuplicates.forEach(group => { initialSelection[group.key] = true; }); setSelectedGroups(initialSelection); setIsLoading(false); }, [facilities]);
    useEffect(() => { if (isOpen) findDuplicates(); else { setDuplicateGroups([]); setSelectedGroups({}); } }, [isOpen, findDuplicates]);
    const handleSelectionChange = (key) => { setSelectedGroups(prev => ({ ...prev, [key]: !prev[key] })); };
    const handleDeleteSelected = async () => {
        const idsToDelete = []; duplicateGroups.forEach(group => { if (selectedGroups[group.key]) group.duplicates.forEach(d => idsToDelete.push(d.id)); });
        if (idsToDelete.length === 0) { alert("No duplicates selected for deletion."); return; }
        if (window.confirm(`Are you sure you want to permanently delete ${idsToDelete.length} duplicate records?`)) { try { await deleteFacilitiesBatch(idsToDelete); alert(`${idsToDelete.length} duplicates deleted successfully.`); onDuplicatesDeleted(); onClose(); } catch (error) { alert(`Failed to delete duplicates: ${error.message}`); } }
    };
    const totalDuplicates = duplicateGroups.reduce((acc, group) => acc + group.duplicates.length, 0);
    return (<Modal isOpen={isOpen} onClose={onClose} title="Find & Fix Duplicates"><div className="p-4">{isLoading && <div className="text-center"><Spinner /></div>}{!isLoading && duplicateGroups.length === 0 && <div className="text-center p-4"><EmptyState message="No duplicate facilities found." /></div>}{!isLoading && duplicateGroups.length > 0 && (<div><p className="mb-4 text-sm text-gray-700">Found <strong>{totalDuplicates}</strong> duplicate records across <strong>{duplicateGroups.length}</strong> groups. Uncheck any group you do not want to clean up.</p><div className="space-y-4 max-h-96 overflow-y-auto p-2 border rounded">{duplicateGroups.map(group => (<div key={group.key} className="p-3 border rounded-md bg-gray-50"><div className="flex items-center justify-between mb-2"><h4 className="font-bold text-gray-800">{group.original['اسم_المؤسسة']}<span className="text-sm font-normal text-gray-500 ml-2">({group.original['الولاية']} / {group.original['المحلية']})</span></h4><label className="flex items-center gap-2 cursor-pointer">
        <Checkbox label="" checked={!!selectedGroups[group.key]} onChange={() => handleSelectionChange(group.key)}/>
        <span>Clean up</span>
    </label></div><div className="text-xs space-y-1"><p className="p-1 rounded bg-green-100 text-green-800"><strong>Keep (Original):</strong> ID {group.original.id} <span className="text-gray-600 italic ml-2"> (Last updated: {group.original.lastSnapshotAt?.toDate().toLocaleString() || 'N/A'})</span></p>{group.duplicates.map(dup => <p key={dup.id} className="p-1 rounded bg-red-100 text-red-800"><strong>Delete (Duplicate):</strong> ID {dup.id}<span className="text-gray-600 italic ml-2"> (Last updated: {dup.lastSnapshotAt?.toDate().toLocaleString() || 'N/A'})</span></p>)}</div></div>))}</div><div className="flex justify-end mt-6"><Button variant="danger" onClick={handleDeleteSelected}>Delete Selected ({Object.values(selectedGroups).filter(Boolean).length})</Button></div></div>)}</div></Modal>);
};

const DataCleanupModal = ({ isOpen, onClose, facilities, onCleanupComplete, setToast, cleanupConfig }) => {
    // ... (DataCleanupModal implementation - unchanged) ...
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedFieldKey, setSelectedFieldKey] = useState('');
    const [nonStandardValues, setNonStandardValues] = useState([]);
    const [mappings, setMappings] = useState({});
    const auth = getAuth();

    useEffect(() => {
        if (!isOpen) {
            setSelectedFieldKey('');
        }
        setNonStandardValues([]);
        setMappings({});
    }, [isOpen]);

    useEffect(() => {
        if (selectedFieldKey) {
            setIsLoading(true);
            const config = cleanupConfig[selectedFieldKey];
            const values = new Set();
            facilities.forEach(facility => {
                if (config.isStaffField && Array.isArray(facility.imnci_staff)) {
                    facility.imnci_staff.forEach(staff => {
                        const value = staff[selectedFieldKey];
                        if (value && !config.standardValues.includes(value)) {
                            values.add(value);
                        }
                    });
                } else if (!config.isStaffField) {
                    const value = facility[selectedFieldKey];
                    if (value && !config.standardValues.includes(value)) {
                        values.add(value);
                    }
                }
            });
            setNonStandardValues(Array.from(values).sort());
            setMappings({});
            setIsLoading(false);
        }
    }, [selectedFieldKey, facilities, cleanupConfig]);

    const handleMappingChange = (oldValue, newValue) => {
        setMappings(prev => ({ ...prev, [oldValue]: newValue }));
    };

    const handleApplyFixes = async () => {
        const user = auth.currentUser;
        if (!user) {
            setToast({ show: true, message: 'You must be logged in to perform this action.', type: 'error' });
            return;
        }

        const config = cleanupConfig[selectedFieldKey];

        const facilitiesToUpdate = facilities.filter(f => {
            if (config.isStaffField) {
                return f.imnci_staff?.some(staff => Object.keys(mappings).includes(staff[selectedFieldKey]));
            } else {
                return Object.keys(mappings).includes(f[selectedFieldKey]);
            }
        });

        if (facilitiesToUpdate.length === 0) {
            setToast({ show: true, message: 'No changes to apply.', type: 'info' });
            onClose();
            return;
        }

        setIsUpdating(true);
        const batch = writeBatch(db);
        const today = new Date().toISOString().split('T')[0];
        const updaterIdentifier = user.displayName ? `${user.displayName} (${user.email})` : user.email;

        const updatePromises = facilitiesToUpdate.map(facility => {
            let payload;
            if (config.isStaffField) {
                const updatedStaff = facility.imnci_staff.map(staff => ({
                    ...staff,
                    [selectedFieldKey]: mappings[staff[selectedFieldKey]] || staff[selectedFieldKey],
                }));
                payload = { ...facility, imnci_staff: updatedStaff };
            } else {
                payload = { ...facility, [selectedFieldKey]: mappings[facility[selectedFieldKey]] || facility[selectedFieldKey] };
            }

            const finalPayload = {
                ...payload,
                date_of_visit: today,
                updated_by: `Cleaned by ${updaterIdentifier}`,
            };

            return saveFacilitySnapshot(finalPayload, batch);
        });

        try {
            await Promise.all(updatePromises);
            await batch.commit();
            setToast({ show: true, message: `${facilitiesToUpdate.length} facilities updated successfully for field "${config.label}".`, type: 'success' });
            onCleanupComplete();
        } catch (error) {
            setToast({ show: true, message: `An error occurred: ${error.message}`, type: 'error' });
        } finally {
            setIsUpdating(false);
            onClose();
        }
    };

    const renderSelectionScreen = () => (
        <div>
            <FormGroup label="Select a data field to clean">
                <Select value={selectedFieldKey} onChange={(e) => setSelectedFieldKey(e.target.value)}>
                    <option value="">-- Choose field --</option>
                    {Object.entries(cleanupConfig).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </Select>
            </FormGroup>
        </div>
    );

    const renderMappingScreen = () => {
        const config = cleanupConfig[selectedFieldKey];
        return (
            <div>
                {isLoading && <div className="text-center"><Spinner /></div>}
                {!isLoading && nonStandardValues.length === 0 && (
                     <div className="text-center p-4">
                        <EmptyState message={`All values for "${config.label}" are already standardized.`} />
                     </div>
                )}
                {!isLoading && nonStandardValues.length > 0 && (
                    <div>
                        <p className="mb-4 text-sm text-gray-700">
                            Found <strong>{nonStandardValues.length}</strong> non-standard value(s) for <strong>{config.label}</strong>. Map them to a standard value to clean up your data.
                        </p>
                        <div className="space-y-3 max-h-80 overflow-y-auto p-2 border rounded bg-gray-50">
                            {nonStandardValues.map(value => (
                                <div key={value} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 p-2 bg-white rounded border">
                                    <span className="bg-yellow-50 text-yellow-800 p-2 rounded text-sm truncate" title={value}>
                                        Current: "{value}"
                                    </span>
                                    <span className="text-center font-bold text-gray-500 hidden md:block">&rarr;</span>
                                    <Select value={mappings[value] || ''} onChange={(e) => handleMappingChange(value, e.target.value)}>
                                        <option value="">-- Map to standard value --</option>
                                        {config.standardValues.map(opt => {
                                            let displayValue = opt;
                                            if (selectedFieldKey === 'الولاية') {
                                                displayValue = STATE_LOCALITIES[opt]?.ar || opt;
                                            } else if (selectedFieldKey === 'المحلية') {
                                                displayValue = LOCALITY_EN_TO_AR_MAP[opt] || opt;
                                            }
                                            return <option key={opt} value={opt}>{displayValue}</option>;
                                        })}
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center mt-6">
                    <Button variant="secondary" onClick={() => setSelectedFieldKey('')}>Back to Selection</Button>
                    <Button onClick={handleApplyFixes} disabled={isUpdating || Object.keys(mappings).length === 0 || nonStandardValues.length === 0}>
                        {isUpdating ? 'Applying Fixes...' : `Apply Fixes for ${Object.keys(mappings).length} Value(s)`}
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Clean Facility Data">
            <div className="p-4">
                {!selectedFieldKey ? renderSelectionScreen() : renderMappingScreen()}
            </div>
        </Modal>
    );
};

// --- NEW COMPONENT for Location Mismatch ---
const LocationMismatchModal = ({ isOpen, onClose, mismatches, onFix }) => {
     // ... (LocationMismatchModal implementation - unchanged) ...
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Location Mismatches Found (${mismatches.length})`} size="lg">
            <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                    The following facilities have coordinates that do not fall within the geographical boundaries of their assigned State and Locality.
                </p>
                {mismatches.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto">
                        <Table headers={['Facility Name', 'Assigned State', 'Assigned Locality', 'Actions']}>
                            {mismatches.map(facility => (
                                <tr key={facility.id}>
                                    <td>{facility['اسم_المؤسسة']}</td>
                                    <td>{STATE_LOCALITIES[facility['الولاية']]?.ar || facility['الولاIAة']}</td>
                                    <td>{LOCALITY_EN_TO_AR_MAP[facility['المحلية']] || facility['المحلية']}</td>
                                    <td>
                                        <Button size="sm" onClick={() => onFix(facility)}>
                                            Fix Location
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </div>
                ) : (
                     <div className="text-center p-4">
                       <EmptyState message="No location mismatches were found." />
                     </div>
                )}
            </div>
            <div className="flex justify-end p-4 border-t">
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
        </Modal>
    );
};


// --- MAIN COMPONENT ---

const ChildHealthServicesView = ({
    permissions, setToast,
    userStates,
    userLocalities, // --- ADDED ---
    canBulkUploadFacilities,
    canCleanFacilityData,
    canFindFacilityDuplicates,
    canCheckFacilityLocations
}) => {
    // ... (State declarations - unchanged) ...
    const { healthFacilities, fetchHealthFacilities, isFacilitiesLoading } = useDataCache();
    const [editingFacility, setEditingFacility] = useState(null);
    const [view, setView] = useState('list');
    const [activeTab, setActiveTab] = useState(TABS.ALL);
    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [facilityTypeFilter, setFacilityTypeFilter] = useState('');
    const [functioningFilter, setFunctioningFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [serviceTypeFilter, setServiceTypeFilter] = useState('');
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);
    const [uploadStatus, setUploadStatus] = useState({ inProgress: false, processed: 0, total: 0, errors: [], message: '' });
    const [submissionForReview, setSubmissionForReview] = useState(null);
    const [comparisonFacilities, setComparisonFacilities] = useState([]);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFacilities, setSelectedFacilities] = useState(new Set());
    const [pendingStartDate, setPendingStartDate] = useState('');
    const [pendingEndDate, setPendingEndDate] = useState('');
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [facilityForMap, setFacilityForMap] = useState(null);
    const [localityBoundaries, setLocalityBoundaries] = useState(null);
    const [isMismatchModalOpen, setIsMismatchModalOpen] = useState(false);
    const [mismatchedFacilities, setMismatchedFacilities] = useState([]);
    const [isCheckingLocations, setIsCheckingLocations] = useState(false);
    const auth = getAuth();

    // ... (Hooks and helper functions like availableStates, handleOpenMapModal, etc. - unchanged) ...
      // Memoize state options based on user permissions
    const availableStates = useMemo(() => {
        const allStates = Object.keys(STATE_LOCALITIES).sort((a, b) =>
            STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)
        );

        if (!userStates || userStates.length === 0) {
            // Federal/Super user: can see all states + 'All States' and 'Not Assigned'
            return [
                { key: "", label: "-- Select State --" },
                { key: "ALL_STATES", label: "All States" },
                { key: "NOT_ASSIGNED", label: "Not Assigned" },
                ...allStates.map(sKey => ({ key: sKey, label: STATE_LOCALITIES[sKey].ar }))
            ];
        }

        // State/Locality user: can only see their assigned states
        return [
            { key: "", label: "-- Select State --" },
            ...allStates
                .filter(sKey => userStates.includes(sKey))
                .map(sKey => ({ key: sKey, label: STATE_LOCALITIES[sKey].ar }))
        ];
    }, [userStates]);

    // Effect to auto-select state if user is restricted
    useEffect(() => {
        if (userStates && userStates.length === 1) {
            setStateFilter(userStates[0]);
        } else if (userStates && userStates.length > 1) {
            if (!stateFilter || !userStates.includes(stateFilter)) {
                setStateFilter(userStates[0]);
            }
        }
    }, [userStates, stateFilter]);

    // --- NEW: Effect to auto-select locality if user is restricted ---
    useEffect(() => {
        // Only set locality filter automatically if user has EXACTLY ONE locality assigned
        if (permissions.manageScope === 'locality' && userLocalities && userLocalities.length === 1) {
            setLocalityFilter(userLocalities[0]);
        }
        // If they are locality scope but have 0 or >1 localities, don't auto-set.
        // The filtering logic in filteredFacilities will handle showing nothing if unassigned.
        // If they have >1, they need to use the (now correctly populated) dropdown.
    }, [userLocalities, permissions.manageScope]); // Re-run if scope or assigned localities change


    useEffect(() => {
        const fetchBoundaries = async () => {
            try {
                const response = await fetch('./sudan_localities.json');
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                setLocalityBoundaries(data);
            } catch (error) {
                console.error("Failed to load locality boundaries:", error);
                setToast({ show: true, message: 'Could not load map boundaries for location checking.', type: 'error' });
            }
        };
        fetchBoundaries();
    }, [setToast]);

    // --- NEW: Helper function to get the current filter object for forced refreshes ---
    const getCurrentFilters = () => {
         // --- *** MODIFIED: Respect Locality Scope *** ---
         let effectiveLocalityFilter = localityFilter;
         if (permissions.manageScope === 'locality') {
             // If locality manager, use their assigned locality, not the UI state
             // If multiple assigned, this gets tricky, default to first for now or empty if none
             effectiveLocalityFilter = userLocalities?.[0] || '';
         }
         // --- *** END MODIFICATION *** ---

        const filters = {
            locality: effectiveLocalityFilter, // Use the determined filter
            facilityType: facilityTypeFilter,
            functioningStatus: functioningFilter,
            project: projectFilter,
        };
        if (stateFilter && stateFilter !== 'ALL_STATES') {
            filters.state = stateFilter;
        }
        
        // Return null if no state is selected and user is a restricted (state/locality) user
        if (!stateFilter && (userStates && userStates.length > 0)) {
            return null;
        }
        // Return null if locality manager has no locality assigned
        if (permissions.manageScope === 'locality' && !effectiveLocalityFilter) {
            return null;
        }

        // Prevent full scan for federal user on initial load
        if ((!userStates || userStates.length === 0) && !stateFilter && Object.keys(filters).every(k => !filters[k] )) {
             return null;
        }

        return filters;
    };


    const handleOpenMapModal = (facility) => {
        setFacilityForMap(facility);
        setIsMapModalOpen(true);
    };

    const handleSaveLocation = async (newLocation) => {
        if (!facilityForMap) return;

        const payload = {
            ...facilityForMap,
            _الإحداثيات_latitude: newLocation._الإحداثيات_latitude,
            _الإحداثيات_longitude: newLocation._الإحداثيات_longitude,
            date_of_visit: facilityForMap.date_of_visit || new Date().toISOString().split('T')[0],
        };

        try {
            // Location updates always need approval unless user can approve
            if (permissions.canApproveSubmissions) {
                await saveFacilitySnapshot(payload);
                setToast({ show: true, message: "Facility location updated directly.", type: "success" });
            } else {
                 // --- CORRECTED: Was submitFacilityUpdateForApproval ---
                 await submitFacilityDataForApproval(payload, auth.currentUser?.email || 'Unknown User');
                 setToast({ show: true, message: "Facility location update submitted for approval.", type: "info" });
            }
             
            // --- UPDATED: Force refresh current view ---
            const currentFilters = getCurrentFilters();
            if (currentFilters) {
                fetchHealthFacilities(currentFilters, true);
            }
        } catch (error) {
            setToast({ show: true, message: `Failed to update location: ${error.message}`, type: 'error' });
        }
    };

   const handleCheckLocations = useCallback(() => {
        if (!localityBoundaries || !healthFacilities) {
            setToast({ show: true, message: 'Boundary data or facility list is not yet loaded.', type: 'info' });
            return;
        }
        setIsCheckingLocations(true);

        const stateKeyToEnName = Object.entries(STATE_LOCALITIES).reduce((acc, [key, value]) => {
            acc[key] = value.en;
            return acc;
        }, {});

        const mismatches = healthFacilities.filter(facility => {
            const lat = parseFloat(facility._الإحداثيات_latitude);
            const lng = parseFloat(facility._الإحداثيات_longitude);
            const stateKey = facility['الولاية'];
            const localityKey = facility['المحلية']; // This is the EN locality name

            if (isNaN(lat) || isNaN(lng) || !stateKey || !localityKey || stateKey === 'NOT_ASSIGNED') {
                return false; // Cannot check facilities without complete/valid data
            }

            // Turf.js requires [longitude, latitude] - this is correct.
            const facilityPoint = point([lng, lat]);
            const stateEn = stateKeyToEnName[stateKey];
            if (!stateEn) return false; // Cannot check if state key is invalid

            // 1. Try to find the precise Locality boundary feature
            const preciseBoundaryFeature = localityBoundaries.features.find(f =>
                f.properties.state_en?.toLowerCase() === stateEn.toLowerCase() &&
                f.properties.locality_e?.toLowerCase() === localityKey.toLowerCase()
            );

            if (preciseBoundaryFeature) {
                // If precise boundary exists, check against it
                return !booleanPointInPolygon(facilityPoint, preciseBoundaryFeature.geometry);
            }

            // 2. If precise boundary is missing, try to find the overall State boundary
            const stateBoundaryFeatures = localityBoundaries.features.filter(f =>
                f.properties.state_en?.toLowerCase() === stateEn.toLowerCase()
            );

            if (stateBoundaryFeatures.length > 0) {
                const isWithinState = stateBoundaryFeatures.some(f =>
                    booleanPointInPolygon(facilityPoint, f.geometry)
                );

                if (!isWithinState) {
                    return true;
                }
            } else {
                 console.warn(`No boundary features found for state: ${stateEn}`);
            }

            return false;
        });

        setMismatchedFacilities(mismatches);
        setIsMismatchModalOpen(true);
        setIsCheckingLocations(false);
    }, [localityBoundaries, healthFacilities, setToast]);

    const handleFixMismatch = (facility) => {
        setIsMismatchModalOpen(false);
        handleOpenMapModal(facility);
    };

    const CLEANABLE_FIELDS_CONFIG = {
        'الولاية': { label: 'State', standardValues: Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)), isStaffField: false },
        'المحلية': { label: 'Locality', standardValues: Object.values(STATE_LOCALITIES).flatMap(s => s.localities.map(l => l.en)).sort((a, b) => (LOCALITY_EN_TO_AR_MAP[a] || a).localeCompare(LOCALITY_EN_TO_AR_MAP[b] || b)), isStaffField: false },
        'job_title': { label: 'Staff Job Title', standardValues: ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"], isStaffField: true },
        'نوع_المؤسسةالصحية': { label: 'Facility Type', standardValues: ["مركز صحة الاسرة", "مستشفى ريفي", "وحدة صحة الاسرة", "مستشفى"], isStaffField: false },
        'eenc_service_type': { label: 'Service Type', standardValues: ["CEmONC", "BEmONC", "general", "pediatric"], isStaffField: false },
        'هل_المؤسسة_تعمل': { label: 'Is Facility Functioning', standardValues: ['Yes', 'No'], isStaffField: false },
        'staff_incentives': { label: 'Staff Incentives', standardValues: ['Yes', 'No'], isStaffField: false },
        'project_participation': { label: 'Project Participation', standardValues: ['Yes', 'No'], isStaffField: false },
        'وجود_العلاج_المتكامل_لامراض_الطفولة': { label: 'IMNCI Service Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'وجود_سجل_علاج_متكامل': { label: 'IMNCI Register Availability (السجلات)', standardValues: ['Yes', 'No'], isStaffField: false },
        'وجود_كتيب_لوحات': { label: 'Chart Booklet Availability (كتيب اللوحات)', standardValues: ['Yes', 'No'], isStaffField: false },
        'ميزان_وزن': { label: 'Weight Scale Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'ميزان_طول': { label: 'Height Scale Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'ميزان_حرارة': { label: 'Thermometer Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'ساعة_مؤقت': { label: 'Timer Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'غرفة_إرواء': { label: 'ORS Corner Availability', standardValues: ['Yes', 'No'], isStaffField: false },
        'eenc_provides_essential_care': { label: 'EENC Service Provided', standardValues: ['Yes', 'No'], isStaffField: false },
        'neonatal_sepsis_surveillance': { label: 'Sepsis Surveillance and Prevention', standardValues: ['Yes', 'No'], isStaffField: false },
    };

    const refreshSubmissions = useCallback(async () => {
        if (!permissions.canManageFacilities) return;
        setIsSubmissionsLoading(true);
        try {
            const subs = await listPendingFacilitySubmissions();
            setPendingSubmissions(subs);
        } catch (error) {
            setToast({ show: true, message: "Failed to load pending submissions.", type: "error" });
        } finally {
            setIsSubmissionsLoading(false);
        }
    }, [permissions, setToast]);


    // --- *** MAJOR UPDATE: Data Fetching useEffect *** ---
    useEffect(() => {
        if (view === 'list') {
            const isLocalityMgr = permissions.manageScope === 'locality';
            const hasAssignedLocality = userLocalities && userLocalities.length > 0;

            // --- EARLY EXIT FOR UNASSIGNED LOCALITY MANAGER ---
            if (isLocalityMgr && !hasAssignedLocality) {
                 if (activeTab === TABS.PENDING) {
                     refreshSubmissions(); // Still refresh pending submissions
                 }
                 // Do not fetch health facilities if locality manager is unassigned
                 return;
             }
            // --- END EARLY EXIT ---

            // Determine the locality to use for filtering the fetch itself
            let fetchLocalityFilter = '';
            if (isLocalityMgr && hasAssignedLocality) {
                // Force fetch based on assigned locality (assuming only one for now)
                fetchLocalityFilter = userLocalities[0];
            } else if (!isLocalityMgr) {
                // Non-locality managers use the UI filter state
                fetchLocalityFilter = localityFilter;
            }
             // If isLocalityMgr but !hasAssignedLocality, fetchLocalityFilter remains '',
             // but we already exited above, so no fetch happens.

            const filters = {
                locality: fetchLocalityFilter, // Use the determined locality for the fetch
                facilityType: facilityTypeFilter,
                functioningStatus: functioningFilter,
                project: projectFilter,
            };

            if (stateFilter && stateFilter !== 'ALL_STATES') {
                filters.state = stateFilter;
            }

            // Conditions under which to trigger a fetch:
            const shouldFetch =
                // 1. A state filter is active (implies state/locality user OR federal user selected one)
                (stateFilter && stateFilter !== 'ALL_STATES') ||
                // 2. User is federal/super (no userStates) AND has selected 'All States' or 'Not Assigned'
                ((!userStates || userStates.length === 0) && (stateFilter === 'ALL_STATES' || stateFilter === 'NOT_ASSIGNED')) ||
                // 3. User is federal/super AND has applied a non-state filter (e.g., facility type) even without a state selected
                 ((!userStates || userStates.length === 0) && !stateFilter && (filters.locality || filters.facilityType || filters.functioningStatus || filters.project)) ||
                 // 4. User is a Locality Manager with an assigned state AND locality (already handled by stateFilter check + early exit)
                 (isLocalityMgr && stateFilter && hasAssignedLocality);


            if (shouldFetch) {
                 // Call fetch (not forced). DataContext handles caching.
                 fetchHealthFacilities(filters);
            }

            // Always refresh pending submissions if on that tab
            if (activeTab === TABS.PENDING) {
                refreshSubmissions();
            }
        }
    }, [
        // Dependencies:
        view,
        stateFilter,
        localityFilter, // Keep UI locality filter as dependency for potential UI updates
        facilityTypeFilter,
        functioningFilter,
        projectFilter,
        activeTab,
        fetchHealthFacilities,
        refreshSubmissions,
        userStates,
        userLocalities, // Add userLocalities
        permissions.manageScope // Add permissions scope
     ]);
     // --- *** END MAJOR UPDATE *** ---


    const projectNames = useMemo(() => {
        if (!healthFacilities) return [];
        const names = new Set();
        healthFacilities.forEach(f => {
            if (f.project_name) {
                names.add(f.project_name);
            }
        });
        return Array.from(names).sort();
    }, [healthFacilities]);

    const uniquePendingSubmissions = useMemo(() => {
        if (!pendingSubmissions) return [];
        const unique = new Map();
        pendingSubmissions.forEach(s => {
            const key = `${s['اسم_المؤسسة']}-${s['الولاية']}-${s['المحلية']}`;
            if (!unique.has(key) || s.submittedAt > unique.get(key).submittedAt) {
                unique.set(key, s);
            }
        });
        
        let filtered = Array.from(unique.values());

        if (pendingStartDate) {
            const start = new Date(pendingStartDate);
            start.setHours(0, 0, 0, 0);
            filtered = filtered.filter(s => s.submittedAt?.toDate() >= start);
        }
        if (pendingEndDate) {
            const end = new Date(pendingEndDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(s => s.submittedAt?.toDate() <= end);
        }
        
        return filtered.sort((a, b) => b.submittedAt?.toMillis() - a.submittedAt?.toMillis());
    }, [pendingSubmissions, pendingStartDate, pendingEndDate]);

    // --- *** UPDATED filteredFacilities Memo *** ---
    // Enforces scope strictly based on permissions *before* applying UI filters.
    const filteredFacilities = useMemo(() => {
        if (!healthFacilities) return [];

        let facilitiesInScope = [];
        const userScope = permissions.manageScope;

        // 1. Determine base list based on user's scope and assignments
        if (userScope === 'locality') {
            if (userLocalities && userLocalities.length > 0) {
                const allowedLocalities = new Set(userLocalities);
                // Ensure state also matches if stateFilter is set (it should be for locality managers)
                 facilitiesInScope = healthFacilities.filter(f =>
                    allowedLocalities.has(f['المحلية']) &&
                    (!stateFilter || f['الولاية'] === stateFilter) // Check state match
                 );
            } else {
                 return []; // Unassigned locality manager sees nothing.
            }
        } else if (userScope === 'state') {
             if (userStates && userStates.length > 0) {
                 const allowedStates = new Set(userStates);
                 facilitiesInScope = healthFacilities.filter(f => allowedStates.has(f['الولاية']));
             } else {
                 return []; // Unassigned state manager sees nothing.
             }
        } else {
            // Federal, Super User, Course Coordinator etc. - potentially see all fetched data
             facilitiesInScope = healthFacilities;
        }

        // 2. Apply UI filters ON TOP of the scoped list
        let filtered = facilitiesInScope.filter(f => {
            // Apply state filter (only relevant for non-state/locality managers picking a state)
            if (userScope !== 'state' && userScope !== 'locality') {
                if (stateFilter && stateFilter !== 'ALL_STATES' && stateFilter !== 'NOT_ASSIGNED' && f['الولاية'] !== stateFilter) {
                    return false;
                }
                if (stateFilter === 'NOT_ASSIGNED' && f['الولاية']) {
                    return false;
                }
            }
            // Apply locality filter (only relevant for non-locality managers picking a locality)
            if (userScope !== 'locality') {
                if (localityFilter && f['المحلية'] !== localityFilter) {
                    return false;
                }
            }
            // Apply other UI filters
            if (facilityTypeFilter && f['نوع_المؤسسةالصحية'] !== facilityTypeFilter) return false;
            if (projectFilter && f.project_name !== projectFilter) return false;
            if (functioningFilter && functioningFilter !== 'NOT_SET' && f['هل_المؤسسة_تعمل'] !== functioningFilter) return false;
            if (functioningFilter === 'NOT_SET' && (f['هل_المؤسسة_تعمل'] != null && f['هل_المؤسسة_تعمل'] !== '')) return false;
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                if (!f['اسم_المؤسسة']?.toLowerCase().includes(lowerQuery)) return false;
            }
            if (serviceTypeFilter) {
                 switch (serviceTypeFilter) {
                    case 'IMNCI': if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] !== 'Yes') return false; break;
                    case 'EENC': if (f.eenc_provides_essential_care !== 'Yes') return false; break;
                    case 'Neonatal': if (!f.neonatal_level_of_care || !(f.neonatal_level_of_care.primary || f.neonatal_level_of_care.secondary || f.neonatal_level_of_care.tertiary)) return false; break;
                    case 'Critical Care': if (f.etat_has_service !== 'Yes' && f.hdu_has_service !== 'Yes' && f.picu_has_service !== 'Yes') return false; break;
                    default: break;
                }
            }
            return true;
        });

        return filtered;
    }, [
        healthFacilities,
        stateFilter,
        localityFilter, // UI filter state
        facilityTypeFilter,
        functioningFilter,
        projectFilter,
        searchQuery,
        serviceTypeFilter,
        userStates,
        userLocalities, // User's assigned localities
        permissions.manageScope // User's role scope
    ]);
     // --- *** END UPDATED Memo *** ---


    const handleStateChange = (e) => {
        setStateFilter(e.target.value);
        // Reset locality filter ONLY if the user is NOT a locality manager
        if (permissions.manageScope !== 'locality') {
             setLocalityFilter('');
        }
     };

    // --- UPDATED: handleSaveFacility ---
    const handleSaveFacility = async (payload) => {
        const user = auth.currentUser;
        if (!user) {
            setToast({ show: true, message: 'You must be logged in.', type: 'error' });
            return;
        }
        
        // --- FIX: Conditionally add ID ---
        const finalPayload = { ...payload };
        if (editingFacility?.id) {
            finalPayload.id = editingFacility.id;
        }
        // --- END FIX ---

        try {
            if (permissions.canApproveSubmissions) {
                // User is an approver (Federal/Super), save directly
                await saveFacilitySnapshot(finalPayload);
                setToast({ show: true, message: 'Facility saved directly.', type: 'success' });
            } else {
                // User is a scoped manager, submit for approval
                await submitFacilityDataForApproval(finalPayload, user.email || 'Unknown User');
                setToast({ show: true, message: 'Facility update submitted for approval.', type: 'info' });
            }

            setEditingFacility(null);
            setView('list');
            
            // --- UPDATED: Force refresh current view ---
            const currentFilters = getCurrentFilters();
            if (currentFilters) {
                fetchHealthFacilities(currentFilters, true);
            }
        } catch (error) {
             setToast({ show: true, message: `Failed to save/submit: ${error.message}`, type: 'error' });
        }
    };

    const handleEditFacility = async (facilityId) => {
        // Try to get from cache first
        // Ensure we only allow editing if the facility is within the user's scope
        let facility = (filteredFacilities || []).find(f => f.id === facilityId);

        if (!facility) {
             // Maybe it wasn't in the current filter view but is accessible? Fetch directly.
             // This path is less common if filtering is correct.
             console.warn("Attempting to edit facility not in current filtered list:", facilityId);
             facility = await getHealthFacilityById(facilityId);
             // Double check scope after fetching
             if (facility) {
                  const userScope = permissions.manageScope;
                  if (userScope === 'locality' && (!userLocalities || !userLocalities.includes(facility['المحلية']))) {
                      facility = null; // Deny access
                  } else if (userScope === 'state' && (!userStates || !userStates.includes(facility['الولاية']))) {
                      facility = null; // Deny access
                  }
             }
        }
        
        if (facility) {
            setEditingFacility(facility);
            setView('form');
        } else {
            setToast({ show: true, message: 'Facility not found or you do not have permission to edit it.', type: 'error' });
        }
    };

    // --- UPDATED: handleDeleteFacility (Implements approval pathway) ---
    const handleDeleteFacility = async (facilityId) => {
        const user = auth.currentUser;
        if (!user) {
            setToast({ show: true, message: 'You must be logged in.', type: 'error' });
            return;
        }

        // Get facility data for confirmation - ensuring it's within scope first
        let facility = (filteredFacilities || []).find(f => f.id === facilityId);
        if (!facility) {
            // Fetch directly ONLY IF necessary and then re-check scope
            console.warn("Attempting to delete facility not in current filtered list:", facilityId);
             facility = await getHealthFacilityById(facilityId);
             if (facility) {
                  const userScope = permissions.manageScope;
                   if (userScope === 'locality' && (!userLocalities || !userLocalities.includes(facility['المحلية']))) {
                       facility = null;
                   } else if (userScope === 'state' && (!userStates || !userStates.includes(facility['الولاية']))) {
                       facility = null;
                   }
             }
        }

        if (!facility) {
             setToast({ show: true, message: 'Facility not found or you do not have permission to delete it.', type: 'error' });
             return;
        }

        const confirmMessage = permissions.canApproveSubmissions
            ? `Are you sure you want to permanently delete "${facility['اسم_المؤسسة']}"? This action cannot be undone.`
            : `Are you sure you want to request deletion for "${facility['اسم_المؤسسة']}"? This will be sent for approval.`;

        if (window.confirm(confirmMessage)) {
            try {
                if (permissions.canApproveSubmissions) {
                    // User is an approver, delete directly
                    await deleteHealthFacility(facilityId);
                    setToast({ show: true, message: 'Facility deleted.', type: 'success' });
                } else {
                    // User is a scoped manager, submit a deletion request for approval
                    const updaterIdentifier = user.displayName ? `${user.displayName} (${user.email})` : user.email;
                    const payload = {
                        ...facility,
                        _action: 'DELETE', // Flag this submission as a deletion request
                        updated_by: updaterIdentifier,
                        'اخر تحديث': new Date().toISOString(),
                    };
                    // Use the same approval function as editing
                    await submitFacilityDataForApproval(payload, user.email || 'Unknown User');
                    setToast({ show: true, message: 'Deletion request submitted for approval.', type: 'info' });
                }

                // --- UPDATED: Force refresh current view ---
                const currentFilters = getCurrentFilters();
                if (currentFilters) {
                    fetchHealthFacilities(currentFilters, true);
                }
            } catch (error) {
                setToast({ show: true, message: `Failed to process request: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleToggleSelection = (facilityId) => {
        setSelectedFacilities(prev => {
            const newSet = new Set(prev);
            if (newSet.has(facilityId)) {
                newSet.delete(facilityId);
            } else {
                newSet.add(facilityId);
            }
            return newSet;
        });
    };

    const handleToggleAll = () => {
        if (!filteredFacilities) return;
        if (filteredFacilities.length === selectedFacilities.size) {
            setSelectedFacilities(new Set());
        } else {
            setSelectedFacilities(new Set(filteredFacilities.map(f => f.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (!permissions.canApproveSubmissions) {
             setToast({ show: true, message: 'You do not have permission to delete facilities.', type: 'error' });
            return;
        }
        const idsToDelete = Array.from(selectedFacilities);
        if (idsToDelete.length === 0) return;

        if (window.confirm(`Are you sure you want to permanently delete ${idsToDelete.length} selected facilities? This action cannot be undone.`)) {
            try {
                await deleteFacilitiesBatch(idsToDelete);
                setToast({ show: true, message: `${idsToDelete.length} facilities deleted.`, type: 'success' });
                setSelectedFacilities(new Set());
                
                // --- UPDATED: Force refresh current view ---
                const currentFilters = getCurrentFilters();
                if (currentFilters) {
                    fetchHealthFacilities(currentFilters, true);
                }
            } catch (error) {
                setToast({ show: true, message: `Failed to delete facilities: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleImport = async (data, originalRows) => {
        if (!permissions.canApproveSubmissions) {
             setToast({ show: true, message: 'You do not have permission to import facilities.', type: 'error' });
             return;
        }
        setUploadStatus({ inProgress: true, processed: 0, total: data.length, errors: [], message: '' });
        try {
            const { successes, errors, failedRowsData } = await importHealthFacilities(data, originalRows, (progress) => {
                setUploadStatus(prev => ({ ...prev, processed: progress.processed }));
            });

            const successCount = successes.length;
            const errorCount = errors.length;
            let message = `${successCount} facilities imported/updated successfully.`;
            if (errorCount > 0) {
                message += `\n${errorCount} rows failed to import.`;
            }

             setUploadStatus(prev => ({ ...prev, inProgress: false, message, errors: failedRowsData }));
             
             // --- UPDATED: Force refresh current view ---
            const currentFilters = getCurrentFilters();
            if (currentFilters) {
                fetchHealthFacilities(currentFilters, true);
            }

        } catch (error) {
             setUploadStatus({ inProgress: false, processed: 0, total: 0, errors: [{ message: error.message }], message: `Import failed: ${error.message}` });
        }
    };

    const handleConfirmApproval = async (submissionData) => {
        if (!permissions.canApproveSubmissions) return;
        try {
            if (submissionData._action === 'DELETE') {
                 await deleteHealthFacility(submissionData.id); // This is the actual facility ID
                 
                 // --- FIX 1 (Deletion-Approval) ---
                 await rejectFacilitySubmission(submissionData.submissionId, auth.currentUser?.email || 'Unknown Approver'); // This cleans up the submission doc
                 
                 setToast({ show: true, message: "Facility deletion approved and completed.", type: "success" });
            } else {

                // --- FIX 2 (Standard Approval) ---
                await approveFacilitySubmission(submissionData, auth.currentUser?.email || 'Unknown Approver');
                
                setToast({ show: true, message: "Submission approved and facility data updated.", type: "success" });
            }
            setSubmissionForReview(null);
            setComparisonFacilities([]);
            refreshSubmissions();

            // --- UPDATED: Force refresh current view ---
            const currentFilters = getCurrentFilters();
            if (currentFilters) {
                fetchHealthFacilities(currentFilters, true);
            }
        } catch (error) {
             setToast({ show: true, message: `Approval failed: ${error.message}`, type: 'error' });
        }
    };

    const handleReject = async (submissionId, isDeletionRequest = false) => {
        if (!permissions.canApproveSubmissions) return;
        const action = isDeletionRequest ? "deletion request" : "submission";
        if (window.confirm(`Are you sure you want to reject this ${action}?`)) {
            try {

                // --- FIX 3 (Rejection) ---
                await rejectFacilitySubmission(submissionId, auth.currentUser?.email || 'Unknown Rejector');
                
                setToast({ show: true, message: "Submission rejected.", type: "success" });
                refreshSubmissions();
            } catch (error) {
                setToast({ show: true, message: `Rejection failed: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleReviewSubmission = useCallback(async (submission) => {
        setIsReviewLoading(true);
        setSubmissionForReview(submission);
        try {
            // NOTE: We are comparing against the *cached* facilities,
            // which is much faster than re-fetching all.
            // Ensure comparison data is also scoped if the approver has scope limitations (e.g., State Manager approving)
             let relevantFacilities = healthFacilities || [];
             const userScope = permissions.manageScope;
             if(userScope === 'state' && userStates && userStates.length > 0) {
                 const allowedStates = new Set(userStates);
                 relevantFacilities = relevantFacilities.filter(f => allowedStates.has(f['الولاية']));
             } // Add locality check if needed for future roles
            setComparisonFacilities(relevantFacilities);
        } catch (error) {
            setToast({ show: true, message: 'Failed to load comparison data.', type: 'error' });
        } finally {
            setIsReviewLoading(false);
        }
    }, [healthFacilities, setToast, permissions.manageScope, userStates]); // Add scope deps


    const handleGenerateLink = (facilityId) => {
        const url = `${window.location.origin}/facilities/data-entry/${facilityId}`;
        navigator.clipboard.writeText(url).then(() => {
            setToast({ show: true, message: 'Public update link copied to clipboard!', type: 'success' });
        }, (err) => {
            setToast({ show: true, message: 'Failed to copy link.', type: 'error' });
        });
    };

    const handleShareLink = () => {
         const url = `${window.location.origin}/facilities/data-entry/new`;
         navigator.clipboard.writeText(url).then(() => {
            setToast({ show: true, message: 'Public "Add New Facility" link copied to clipboard!', type: 'success' });
        }, (err) => {
            setToast({ show: true, message: 'Failed to copy link.', type: 'error' });
        });
    };

    const handleExportExcel = () => {
        if (!filteredFacilities) return;
        const { headers: finalHeaders, dataKeys: finalDataKeys, fileName } = getServiceConfig(activeTab);

        const data = filteredFacilities.map(f => {
             const flatFacilityData = { ...f };
             if (f.imnci_staff && Array.isArray(f.imnci_staff)) {
                f.imnci_staff.slice(0, 5).forEach((staff, index) => {
                    const i = index + 1;
                    flatFacilityData[`imnci_staff_${i}_name`] = staff.name;
                    flatFacilityData[`imnci_staff_${i}_job_title`] = staff.job_title;
                    flatFacilityData[`imnci_staff_${i}_is_trained`] = staff.is_trained || 'No';
                    flatFacilityData[`imnci_staff_${i}_training_date`] = staff.training_date;
                    flatFacilityData[`imnci_staff_${i}_phone`] = staff.phone;
                });
             }
             if (f.neonatal_level_of_care && typeof f.neonatal_level_of_care === 'object') {
                flatFacilityData.neonatal_level_of_care_primary = f.neonatal_level_of_care.primary ? 'Yes' : 'No';
                flatFacilityData.neonatal_level_of_care_secondary = f.neonatal_level_of_care.secondary ? 'Yes' : 'No';
                flatFacilityData.neonatal_level_of_care_tertiary = f.neonatal_level_of_care.tertiary ? 'Yes' : 'No';
             }
             return finalDataKeys.map(key => flatFacilityData[key] ?? '');
        });

        const worksheet = XLSX.utils.aoa_to_sheet([finalHeaders, ...data]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facilities");
        XLSX.writeFile(workbook, `Export_${fileName}`);
    };

    const handleExportPDF = () => {
        if (!filteredFacilities) return;
        const doc = new jsPDF();
        const { headers: finalHeaders, dataKeys: finalDataKeys } = getServiceConfig(activeTab);

        const body = filteredFacilities.map(f => {
            const flatFacilityData = { ...f };
             if (f.neonatal_level_of_care && typeof f.neonatal_level_of_care === 'object') {
                flatFacilityData.neonatal_level_of_care_primary = f.neonatal_level_of_care.primary ? 'Yes' : 'No';
                flatFacilityData.neonatal_level_of_care_secondary = f.neonatal_level_of_care.secondary ? 'Yes' : 'No';
                flatFacilityData.neonatal_level_of_care_tertiary = f.neonatal_level_of_care.tertiary ? 'Yes' : 'No';
             }
            return finalDataKeys.map(key => {
                let val = flatFacilityData[key];
                if (val === true) return 'Yes';
                if (val === false) return 'No';
                return val ?? '';
            });
        });

        autoTable(doc, {
            head: [finalHeaders],
            body: body,
            styles: { font: 'Arial', fontSize: 8 },
            headStyles: { fillColor: [22, 160, 133] },
        });
        doc.save(`Facility_Export_${activeTab}.pdf`);
    };

    // --- UPDATED: renderListView ---
    const renderListView = () => {
        const FACILITY_TYPES = ["مركز صحة الاسرة", "مستشفى ريفي", "وحدة صحة الاسرة", "مستشفى"];
        const SERVICE_TYPES = ['IMNCI', 'EENC', 'Neonatal', 'Critical Care'];
        
        // --- UPDATED: Empty state message reflects new logic ---
        const isLocalityManager = permissions.manageScope === 'locality';
        const isStateManager = permissions.manageScope === 'state';
        const isRestrictedUser = isLocalityManager || isStateManager;
        const isUnassignedLocalityManager = isLocalityManager && (!userLocalities || userLocalities.length === 0);
        const isUnassignedStateManager = isStateManager && (!userStates || userStates.length === 0);

        let emptyStateMessage = "No health facilities found for the selected criteria."; // Default

        if (isUnassignedLocalityManager) {
             emptyStateMessage = "You are a Locality Manager but do not have a locality assigned. Please contact an administrator.";
        } else if (isUnassignedStateManager) {
             emptyStateMessage = "You are a State Manager but do not have a state assigned. Please contact an administrator.";
        } else if (!stateFilter && isRestrictedUser) {
             // State/Locality manager hasn't selected their state yet (should be auto-selected, but maybe edge case)
             emptyStateMessage = "Please select your assigned State to view facilities.";
        } else if (!stateFilter && !isRestrictedUser) {
             // Federal user hasn't selected anything
             emptyStateMessage = "Please select a State or apply other filters to begin viewing facilities.";
        }


        const tabsContent = {
            [TABS.PENDING]: <PendingSubmissionsTab submissions={uniquePendingSubmissions || []} onApprove={handleReviewSubmission} onReject={handleReject} />,
            // Pass canApproveSubmissions and canManageFacilities to relevant tabs
            [TABS.ALL]: <AllFacilitiesTab facilities={filteredFacilities || []} onEdit={handleEditFacility} onDelete={handleDeleteFacility} onGenerateLink={handleGenerateLink} onOpenMap={handleOpenMapModal} selectedFacilities={selectedFacilities} onToggleSelection={handleToggleSelection} onToggleAll={handleToggleAll} emptyMessage={emptyStateMessage} canApproveSubmissions={permissions.canApproveSubmissions} canManageFacilities={permissions.canManageFacilities} />,
            [TABS.IMNCI]: <IMNCIServiceTab facilities={filteredFacilities || []} onEdit={handleEditFacility} onDelete={handleDeleteFacility} onGenerateLink={handleGenerateLink} emptyMessage={emptyStateMessage} canApproveSubmissions={permissions.canApproveSubmissions} canManageFacilities={permissions.canManageFacilities}/>,
            [TABS.EENC]: <EENCServiceTab facilities={filteredFacilities || []} onEdit={handleEditFacility} onDelete={handleDeleteFacility} emptyMessage={emptyStateMessage} canApproveSubmissions={permissions.canApproveSubmissions} canManageFacilities={permissions.canManageFacilities}/>,
            [TABS.NEONATAL]: <NeonatalServiceTab facilities={filteredFacilities || []} onEdit={handleEditFacility} onDelete={handleDeleteFacility} emptyMessage={emptyStateMessage} canApproveSubmissions={permissions.canApproveSubmissions} canManageFacilities={permissions.canManageFacilities}/>,
            [TABS.CRITICAL]: <CriticalCareServiceTab facilities={filteredFacilities || []} onEdit={handleEditFacility} onDelete={handleDeleteFacility} emptyMessage={emptyStateMessage} canApproveSubmissions={permissions.canApproveSubmissions} canManageFacilities={permissions.canManageFacilities}/>
        };
        // Use permissions.canManageFacilities for tab visibility check
        const availableTabs = Object.values(TABS).filter(tab => tab === TABS.PENDING ? permissions.canManageFacilities : true);
        const showFiltersAndActions = activeTab !== TABS.PENDING;

        const isStateFilterDisabled = userStates && userStates.length === 1; // Only disable if exactly one state assigned
        // Locality dropdown disabled if locality manager OR state isn't selected OR is special value
        const isLocalityFilterDisabled = isLocalityManager || !stateFilter || stateFilter === 'NOT_ASSIGNED' || stateFilter === 'ALL_STATES';


        return (<Card>
            <div className="p-6">
                <PageHeader title="Child Health Services Management" subtitle="Manage health facilities and their pediatric services."/>
                {/* --- FIX 1 APPLIED HERE --- */}
                <div className="border-b border-gray-200 mt-6"><nav className="-mb-px flex space-x-4 overflow-x-auto">{availableTabs.map(tabName => (<button key={tabName} onClick={() => setActiveTab(tabName)} className={`${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm`}>{tabName}{tabName === TABS.PENDING && uniquePendingSubmissions && uniquePendingSubmissions.length > 0 && <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{uniquePendingSubmissions.length}</span>}</button>))}</nav></div>

                {activeTab === TABS.PENDING && (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4 items-end">
                        <FormGroup label="Filter by Submission Start Date">
                            <Input type="date" value={pendingStartDate} onChange={(e) => setPendingStartDate(e.target.value)} />
                        </FormGroup>
                        <FormGroup label="Filter by Submission End Date">
                            <Input type="date" value={pendingEndDate} onChange={(e) => setPendingEndDate(e.target.value)} />
                        </FormGroup>
                    </div>
                )}

                {showFiltersAndActions && (<>
                    <div className="flex flex-wrap gap-4 my-4 items-end">
                       {/* State Filter */}
                       <div className="flex-1 min-w-[160px]">
                            <FormGroup label="Filter by State">
                                <Select value={stateFilter} onChange={handleStateChange} disabled={isStateFilterDisabled}>
                                    {availableStates.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </Select>
                            </FormGroup>
                        </div>
                        {/* --- *** UPDATED LOCALITY DROPDOWN *** --- */}
                        <div className="flex-1 min-w-[160px]">
                            <FormGroup label="Filter by Locality">
                                <Select
                                    value={localityFilter}
                                    onChange={(e) => setLocalityFilter(e.target.value)}
                                    disabled={isLocalityFilterDisabled}
                                >
                                    {isLocalityManager ? (
                                        userLocalities && userLocalities.length > 0 ? (
                                            // Render assigned localities for Locality Manager
                                            userLocalities.map(locEn => {
                                                // Find the Arabic name based on the currently selected stateFilter
                                                const locAr = stateFilter && STATE_LOCALITIES[stateFilter]?.localities.find(l => l.en === locEn)?.ar || locEn;
                                                return <option key={locEn} value={locEn}>{locAr}</option>;
                                            })
                                        ) : (
                                            // Unassigned Locality Manager
                                            <option value="">-- No Locality Assigned --</option>
                                        )
                                    ) : (
                                         // Non-Locality Manager
                                         <>
                                            <option value="">All Localities</option>
                                            {/* Only show localities if a valid state is selected */}
                                            {stateFilter && STATE_LOCALITIES[stateFilter]?.localities.sort((a, b) => a.ar.localeCompare(b.ar)).map(l =>
                                                <option key={l.en} value={l.en}>{l.ar}</option>
                                            )}
                                         </>
                                    )}
                                </Select>
                            </FormGroup>
                        </div>
                        {/* --- *** END UPDATED DROPDOWN *** --- */}
                        {/* Other Filters (unchanged) */}
                        <div className="flex-1 min-w-[160px]"><FormGroup label="Filter by Facility Type"><Select value={facilityTypeFilter} onChange={(e) => setFacilityTypeFilter(e.target.value)}><option value="">All Types</option>{FACILITY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</Select></FormGroup></div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label="Filter by Service"><Select value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value)}><option value="">All Services</option>{SERVICE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</Select></FormGroup></div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label="Functioning Status"><Select value={functioningFilter} onChange={(e) => setFunctioningFilter(e.target.value)}><option value="">All</option><option value="Yes">Yes</option><option value="No">No</option><option value="NOT_SET">Not Set</option></Select></FormGroup></div>
                        <div className="flex-1 min-w-[160px]"><FormGroup label="Filter by Project Name"><Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="">All Projects</option>{(projectNames || []).map(name => <option key={name} value={name}>{name}</option>)}</Select></FormGroup></div>
                    </div>

                     {/* Action Buttons (unchanged) */}
                    <div className="flex justify-between items-center my-4">
                         {/* Left Actions */}
                        <div className="flex flex-wrap gap-2">
                            {permissions.canManageFacilities && ( <Button onClick={() => { setEditingFacility(null); setView('form'); }}>Add New</Button> )}
                            {canBulkUploadFacilities && ( <Button onClick={() => setIsBulkUploadModalOpen(true)}>Bulk Upload</Button> )}
                            <Button variant="info" onClick={handleShareLink}>Share Entry Link</Button>
                            <Button variant="secondary" onClick={handleExportExcel} disabled={!filteredFacilities || filteredFacilities.length === 0}>Export Excel</Button>
                            <Button variant="secondary" onClick={handleExportPDF} disabled={!filteredFacilities || filteredFacilities.length === 0}>Export PDF</Button>
                        </div>
                         {/* Right Actions */}
                        <div className="flex flex-wrap gap-2">
                             {canFindFacilityDuplicates && ( <Button variant="secondary" onClick={() => setIsDuplicateModalOpen(true)}>Find Duplicates</Button> )}
                             {canCleanFacilityData && ( <Button variant="secondary" onClick={() => setIsCleanupModalOpen(true)}>Clean Data</Button> )}
                             {canCheckFacilityLocations && ( <Button variant="secondary" onClick={handleCheckLocations} disabled={isCheckingLocations || !localityBoundaries}>{isCheckingLocations ? 'Checking...' : 'Check Locations'}</Button> )}
                             {permissions.canApproveSubmissions && ( <Button variant="danger" onClick={handleDeleteSelected} disabled={selectedFacilities.size === 0}>Delete Selected ({selectedFacilities.size})</Button> )}
                        </div>
                    </div>

                    {/* Display Count & Search (unchanged) */}
                    <p className="text-sm text-gray-600 mb-2">Showing <strong>{filteredFacilities ? filteredFacilities.length : 0}</strong> facilities. {selectedFacilities.size > 0 && <span className="ml-2 font-semibold">{selectedFacilities.size} selected.</span>}</p>
                     <div className="my-4">
                        <Input type="search" placeholder="Search by Facility Name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                </>)}

                 {/* Loading Spinner or Tab Content (unchanged) */}
                {isFacilitiesLoading || isReviewLoading || (activeTab === TABS.PENDING && isSubmissionsLoading) ? (
                    <div className="flex justify-center items-center h-48"><Spinner /></div>
                ) : (
                    <div className="mt-4">{tabsContent[activeTab]}</div>
                )}
            </div>
        </Card>);
    };

    // --- UPDATED: renderFormView ---
    const renderFormView = () => {
        const formFields = {
            [TABS.IMNCI]: IMNCIFormFields,
            [TABS.EENC]: EENCFormFields,
            [TABS.NEONATAL]: NeonatalFormFields,
            [TABS.CRITICAL]: CriticalCareFormFields,
        };
        const currentTabForForm = [TABS.ALL, TABS.PENDING].includes(activeTab) ? TABS.IMNCI : activeTab;
        const FormComponent = formFields[currentTabForForm];
        const arabicTitle = ARABIC_TITLES[currentTabForForm] || currentTabForForm;

        // Determine button text based on permission
        const saveButtonText = permissions.canApproveSubmissions ? "Save Directly" : "Submit for Approval";

        // --- Create initial data for form, pre-filling from user's scope ---
        const formInitialData = useMemo(() => {
            if (editingFacility) {
                return editingFacility; // Use existing data for editing
            }
            
            // For a new facility, pre-fill based on user scope
            const prefilledData = {};
            if (userStates && userStates.length === 1) {
                prefilledData['الولاية'] = userStates[0];
            }
            if (userLocalities && userLocalities.length === 1) {
                prefilledData['المحلية'] = userLocalities[0];
            }
            return prefilledData;

        }, [editingFacility, userStates, userLocalities]);
        // --- END ---

        return (
            <GenericFacilityForm
                initialData={formInitialData} // Use pre-filled or editing data
                onSave={handleSaveFacility}
                onCancel={() => { setEditingFacility(null); setView('list'); }}
                setToast={setToast}
                title={editingFacility ? `Edit ${arabicTitle}` : `Add New ${arabicTitle}`}
                subtitle={editingFacility ? `تعديل تفاصيل ${arabicTitle}` : `أدخل تفاصيل ${arabicTitle}`}
                saveButtonText={saveButtonText}
                // Pass user's scope for potential disabling in the form
                userAssignedState={userStates && userStates.length === 1 ? userStates[0] : null}
                userAssignedLocality={userLocalities && userLocalities.length === 1 ? userLocalities[0] : null}
            >
                {(props) => <FormComponent {...props} />}
            </GenericFacilityForm>
        );
    };
    
    // --- Main return and Modals (unchanged) ---
    return (
        <>
            {view === 'list' ? renderListView() : renderFormView()}
            <ApprovalComparisonModal
                submission={submissionForReview}
                allFacilities={comparisonFacilities} // Pass potentially scoped comparison data
                onClose={() => {
                    setSubmissionForReview(null);
                    setComparisonFacilities([]);
                }}
                onConfirm={handleConfirmApproval}
                setToast={setToast}
            />
            <BulkUploadModal
                isOpen={isBulkUploadModalOpen}
                onClose={() => {
                    setIsBulkUploadModalOpen(false);
                    setUploadStatus({ inProgress: false, processed: 0, total: 0, errors: [], message: '' });
                }}
                onImport={handleImport}
                uploadStatus={uploadStatus}
                activeTab={activeTab}
                filteredData={filteredFacilities || []} // Pass the correctly filtered data
                cleanupConfig={CLEANABLE_FIELDS_CONFIG}
            />
            <DuplicateFinderModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                facilities={filteredFacilities || []} // Operate on filtered data
                onDuplicatesDeleted={() => {
                    const currentFilters = getCurrentFilters();
                    if (currentFilters) fetchHealthFacilities(currentFilters, true);
                }}
            />
            <DataCleanupModal
                isOpen={isCleanupModalOpen}
                onClose={() => setIsCleanupModalOpen(false)}
                facilities={filteredFacilities || []} // Operate on filtered data
                onCleanupComplete={() => {
                    const currentFilters = getCurrentFilters();
                    if (currentFilters) fetchHealthFacilities(currentFilters, true);
                }}
                setToast={setToast}
                cleanupConfig={CLEANABLE_FIELDS_CONFIG}
            />
            <LocationMapModal
                isOpen={isMapModalOpen}
                onClose={() => setIsMapModalOpen(false)}
                facility={facilityForMap}
                onSaveLocation={handleSaveLocation}
            />
            <LocationMismatchModal
                isOpen={isMismatchModalOpen}
                onClose={() => setIsMismatchModalOpen(false)}
                mismatches={mismatchedFacilities} // Mismatches are based on full data check
                onFix={handleFixMismatch}
            />
        </>
    );
};

// --- Comparison and Approval Modal Components ---

const deepEqual = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

const getDisplayableValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === 'object' && value !== null) {
         if (Array.isArray(value)) {
             return value.length > 0 ? value.map(v => v.name || JSON.stringify(v)).join(', ') : 'N/A';
         }
         // Handle neonatal_level_of_care object
         if ('primary' in value || 'secondary' in value || 'tertiary' in value) {
             const levels = [];
             if (value.primary) levels.push('Primary');
             if (value.secondary) levels.push('Special Care');
             if (value.tertiary) levels.push('NICU');
             return levels.length > 0 ? levels.join(', ') : 'N/A';
         }
         return JSON.stringify(value);
    }
    return String(value);
};
const FIELD_LABELS_FOR_COMPARISON = {
    'اسم_المؤسسة': 'Facility Name',
    'الولاية': 'State',
    'المحلية': 'Locality',
    'نوع_المؤسسةالصحية': 'Facility Type',
    'هل_المؤسسة_تعمل': 'Functioning',
    '_الإحداثيات_latitude': 'Latitude',
    '_الإحداثيات_longitude': 'Longitude',
    'وجود_العلاج_المتكامل_لامراض_الطفولة': 'IMNCI Service',
    'العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين': 'IMNCI Total Staff',
    'العدد_الكلي_للكودار_ المدربة_على_العلاج_المتكامل': 'IMNCI Trained Staff',
    'eenc_provides_essential_care': 'EENC Service',
    'eenc_trained_workers': 'EENC Trained Workers',
    'neonatal_level_of_care': 'Neonatal Level of Care',
    'neonatal_total_beds': 'Neonatal Total Beds',
    'neonatal_total_incubators': 'Neonatal Incubators',
    'etat_has_service': 'ETAT Service',
    'hdu_has_service': 'HDU Service',
    'picu_has_service': 'PICU Service',
    'imnci_staff': 'IMNCI Staff List'
};
const compareFacilities = (oldData, newData) => {
    const changes = [];
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]); // Add null checks

    allKeys.forEach(key => {
        if (key.startsWith('_') || key === 'id' || key === 'submissionId' || key === 'submittedAt' || key === 'updated_by' || key === 'اخر تحديث' || key === 'date_of_visit') {
            return;
        }

        const oldValue = oldData?.[key]; // Use optional chaining
        const newValue = newData?.[key]; // Use optional chaining

        if (!deepEqual(oldValue, newValue)) {
            changes.push({
                key: key,
                label: FIELD_LABELS_FOR_COMPARISON[key] || key.replace(/_/g, ' '),
                from: getDisplayableValue(oldValue),
                to: getDisplayableValue(newValue)
            });
        }
    });
    return changes;
};

// --- UPDATED: ApprovalComparisonModal (Layout and Button Changes) ---
const ApprovalComparisonModal = ({ submission, allFacilities, onClose, onConfirm, setToast }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef(null);
    const [isEditing, setIsEditing] = useState(false); // State for View/Edit toggle

    // Reset to view mode when submission changes
    useEffect(() => {
        setIsEditing(false);
    }, [submission]);

    const comparison = useMemo(() => {
        if (!submission) return null;
        // Find existing based on Name, State, Locality within the provided (potentially scoped) allFacilities
        const existingFacility = (allFacilities || []).find(f => // Add null check for allFacilities
            String(f?.['اسم_المؤسسة'] || '').trim().toLowerCase() === String(submission['اسم_المؤسسة'] || '').trim().toLowerCase() &&
            f?.['الولاية'] === submission['الولاية'] &&
            f?.['المحلية'] === submission['المحلية']
        );

        if (existingFacility) {
            const changes = compareFacilities(existingFacility, submission);
            return { isUpdate: true, changes, hasChanges: changes.length > 0 };
        }
        // If no matching facility found in the (potentially scoped) list, treat as new
        return { isUpdate: false, changes: compareFacilities({}, submission), hasChanges: true }; // Compare new data against empty object

    }, [submission, allFacilities]);

    // This function is called ONLY when the form's internal save button is clicked
    const handleSaveFromForm = async (formData) => {
        setIsSubmitting(true);
        try {
            if (submission?._action === 'DELETE') {
                formData._action = 'DELETE';
            }
            await onConfirm(formData); // This calls handleConfirmApproval
        } finally {
            setIsSubmitting(false);
        }
    };

     // Handles "Approve" or "Approve Deletion" clicks from the top button
    const handleDirectApprove = async () => {
         setIsSubmitting(true);
         try {
             // Pass the original submission data directly
             await onConfirm({ ...submission });
         } finally {
             setIsSubmitting(false);
         }
     };

    // Handles Cancel click inside the form (cancels edit mode)
    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    if (!submission) return null;

    const isDeletionRequest = submission?._action === 'DELETE';
    const modalTitle = isDeletionRequest
        ? `Review Deletion Request: ${submission['اسم_المؤسسة']}`
        : `Review Submission: ${submission['اسم_المؤسسة']}`;

    return (
        <Modal isOpen={!!submission} onClose={onClose} title={modalTitle} size="full">
            <div className="p-6 h-full flex flex-col relative"> {/* Added relative positioning */}

                 {/* --- Top Action Buttons --- */}
                 <div className="absolute top-4 right-4 z-10 flex gap-2"> {/* Positioned top right */}
                     {/* Approve Button (Visible unless editing a non-deletion request) */}
                     {(!isEditing || isDeletionRequest) && (
                         <Button
                             variant={isDeletionRequest ? "danger" : "success"} // Adjust color
                             onClick={handleDirectApprove}
                             disabled={isSubmitting}
                         >
                             {isSubmitting
                                ? (isDeletionRequest ? 'Deleting...' : 'Approving...')
                                : (isDeletionRequest ? 'Confirm Deletion' : 'Approve')
                             }
                         </Button>
                     )}
                     {/* Close button always visible unless submitting */}
                     {!isSubmitting && (
                        <Button variant="secondary" onClick={onClose} >
                           Close
                        </Button>
                     )}
                 </div>


                {/* --- Deletion Request Notice --- */}
                {isDeletionRequest && (
                    <div className="p-4 bg-red-100 border border-red-300 rounded-md mb-4 mt-12 flex-shrink-0"> {/* Added margin top */}
                        <h4 className="font-semibold text-lg text-red-800">DELETION REQUEST</h4>
                        <p className="text-red-700">A user has requested to **permanently delete** this facility. Review the details below. Approving will remove the facility.</p>
                    </div>
                )}

                {/* --- Summary of Changes / New Data --- */}
                {!isDeletionRequest && comparison && ( // Ensure comparison exists
                     <div className={`p-4 border rounded-md mb-4 mt-12 flex-shrink-0 ${comparison.isUpdate ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
                        <h4 className={`font-semibold text-lg ${comparison.isUpdate ? 'text-yellow-800' : 'text-blue-800'}`}>
                             {comparison.isUpdate ? "Summary of Changes" : "New Facility Submission"}
                        </h4>
                            {comparison.hasChanges ? (
                            <div className="max-h-60 overflow-y-auto mt-2"> {/* Added max-h and overflow */}
                                <Table headers={comparison.isUpdate ? ['Field', 'Previous Value', 'New Value'] : ['Field', 'Submitted Value']}>
                                     {comparison.changes
                                         .filter(c => c.to !== 'N/A') // Don't show fields that were empty and remain empty implicitly
                                         .map(({ label, from, to }) => (
                                        <tr key={label}>
                                            <td className="font-medium capitalize align-top py-2">{label}</td>
                                            {comparison.isUpdate && <td className="align-top py-2"><div className="text-sm bg-red-100 text-red-800 p-2 rounded">{from}</div></td>}
                                            <td className="align-top py-2"><div className="text-sm bg-green-100 text-green-800 p-2 rounded">{to}</div></td>
                                        </tr>
                                    ))}
                                </Table>
                            </div>
                            ) : <p className={`mt-1 ${comparison.isUpdate ? 'text-yellow-700' : 'text-blue-700'}`}>
                                 {comparison.isUpdate ? "No changes were detected compared to the existing record." : "No data submitted?"} {/* Adjust message */}
                                </p>}
                    </div>
                )}

                {/* --- Form Section (Conditionally Rendered) --- */}
                {/* Only render form if editing OR if it's a deletion request (for viewing details) */}
                {(isEditing || isDeletionRequest) && (
                    <div className={`flex-grow overflow-y-auto mb-4 ${!isDeletionRequest && !comparison?.isUpdate ? 'mt-12' : ''}`}> {/* Add margin top if no summary/deletion notice */}
                        <GenericFacilityForm
                            ref={formRef}
                            initialData={submission}
                            onSave={handleSaveFromForm} // Internal form save triggers actual confirm
                            onCancel={handleCancelEdit} // Internal form cancel stops editing
                            setToast={setToast}
                            title={isDeletionRequest ? "Facility Details (Read-Only)" : "Edit & Approve Submission"}
                            subtitle={isDeletionRequest
                                ? "Review the data below before approving deletion."
                                : "Make necessary corrections and click 'Approve'."
                            }
                            isReadOnly={isDeletionRequest} // Only read-only for deletion
                            saveButtonText="Approve Changes" // Form always says Approve now
                            saveButtonVariant="success" // Form save is always green
                            cancelButtonText="Cancel Edit"
                            isSubmitting={isSubmitting}
                            // Pass scope down if needed by form fields
                             userAssignedState={null} // Approver likely sees all, pass null or actual scope if needed
                             userAssignedLocality={null}
                        >
                            {(props) => ( // Pass isReadOnly explicitly if needed by children
                                <>
                                    <IMNCIFormFields {...props} isReadOnly={isDeletionRequest} />
                                    <hr className="my-6" />
                                    <EENCFormFields {...props} isReadOnly={isDeletionRequest} />
                                    <hr className="my-6" />
                                    <NeonatalFormFields {...props} isReadOnly={isDeletionRequest} />
                                    <hr className="my-6" />
                                    <CriticalCareFormFields {...props} isReadOnly={isDeletionRequest} />
                                </>
                            )}
                        </GenericFacilityForm>
                    </div>
                )}

                 {/* --- Edit Button (Only visible when viewing a non-deletion request) --- */}
                 {!isEditing && !isDeletionRequest && (
                     <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
                          <Button variant="info" onClick={() => setIsEditing(true)} disabled={isSubmitting}>
                              Edit Before Approving
                          </Button>
                          {/* Close button moved to top right */}
                     </div>
                 )}
                 {/* Footer space reserved by the top-right buttons */}
                 {(isEditing || isDeletionRequest) && <div className="pt-4 flex-shrink-0"></div>}
            </div>
        </Modal>
    );
};

export default ChildHealthServicesView;