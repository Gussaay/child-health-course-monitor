// ChildHealthServicesMap.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
// --- MODIFICATION: Added useMapEvents and useMap ---
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Modal, Button } from './CommonComponents';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';

// --- Icon Fix (unchanged) ---
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIconPng,
    iconRetinaUrl: markerIconPng,
    shadowUrl: markerShadowPng,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    shadowSize: [41, 41]
});

// --- SearchAndMoveMarker component (unchanged) ---
const SearchAndMoveMarker = ({ setPosition }) => {
    const map = useMap();
    useEffect(() => {
        const provider = new OpenStreetMapProvider();
        const searchControl = new GeoSearchControl({
            provider: provider,
            style: 'bar',
            showMarker: false,
            autoClose: true,
            keepResult: true,
        });
        map.addControl(searchControl);
        const onResult = (e) => {
            const { x: lng, y: lat } = e.location;
            map.flyTo([lat, lng], 16);
            setPosition([lat, lng]);
        };
        map.on('geosearch/showlocation', onResult);
        return () => {
            map.removeControl(searchControl);
            map.off('geosearch/showlocation', onResult);
        };
    }, [map, setPosition]);
    return null;
};

// --- ENHANCEMENT 1: Click Handler Component ---
// This component listens for map clicks ONLY when in edit mode
const MapClickHandler = ({ isEditing, setPosition }) => {
    useMapEvents({
        click(e) {
            if (isEditing) {
                setPosition([e.latlng.lat, e.latlng.lng]);
            }
        },
    });

    return null; // It doesn't render anything
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
        street: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
        light: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' },
        satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri &mdash; i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community' }
    };

    // Effect 1: Set/Reset position state
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
        }
    }, [isOpen, facility]);

    // Effect 2: Handle map resizing
    useEffect(() => {
        if (isOpen && mapRef.current) {
            const timer = setTimeout(() => {
                if (mapRef.current) {
                    mapRef.current.invalidateSize(true);
                }
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Effect 3: Handle flying to the position (but only when editing)
    useEffect(() => {
        // We only want to auto-fly if the position was changed by search/click
        // not when the component first loads.
        if (mapRef.current && position && isEditing) {
            // Check if position is different from original
            if (position[0] !== originalPosition[0] || position[1] !== originalPosition[1]) {
                mapRef.current.flyTo(position, 16);
            }
        }
    }, [position, isEditing, originalPosition]);
    
    // Effect 4: Fly to position on *initial load*
    useEffect(() => {
        if (mapRef.current && position && !isEditing) {
             mapRef.current.flyTo(position, 16);
        }
        // We only want this to run once on load, so we use isOpen
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps


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
    
    // --- ENHANCEMENT 2: Reset Position Handler ---
    const handleResetPosition = () => {
        setPosition(originalPosition);
         if (mapRef.current) {
            mapRef.current.flyTo(originalPosition, 16);
        }
    };

    if (!isOpen || !position) {
        return null;
    }

    const modalTitle = isEditing
        ? `Editing Location: ${facility?.['اسم_المؤسسة']}`
        : `Location of ${facility?.['اسم_المؤسسة']}`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
            {/* --- ENHANCEMENT 1b: Add custom cursor style --- */}
            {/* This style will apply a crosshair cursor when 'isEditing' is true */}
            <style>{`.leaflet-edit-cursor .leaflet-container { cursor: crosshair; }`}</style>
            
            <div className={`p-4 relative ${isEditing ? 'leaflet-edit-cursor' : ''}`} style={{ height: '500px', width: '100%' }}>
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
                
                {/* --- ENHANCEMENT 2: "Reset Position" Button --- */}
                {isEditing && (
                    <div className="absolute top-24 left-3 z-[1000] w-fit">
                        <Button 
                            variant="secondary"
                            size="sm"
                            onClick={handleResetPosition}
                            title="Reset marker to its original saved location"
                        >
                            Reset Position
                        </Button>
                    </div>
                )}

                <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} ref={mapRef}>
                    <TileLayer {...tileLayers[tileProvider]} key={tileProvider} />

                    {isEditing && <SearchAndMoveMarker setPosition={setPosition} />}

                    {/* --- ENHANCEMENT 1: Add Click Handler --- */}
                    <MapClickHandler isEditing={isEditing} setPosition={setPosition} />

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
                        <p className="text-xs">Drag, click, or use search to set the location.</p>
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

export default LocationMapModal;