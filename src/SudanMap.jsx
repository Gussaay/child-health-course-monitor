// SudanMap.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup 
} from "react-simple-maps";
import { geoCentroid } from "d3-geo";

// The two GeoJSON files are 3 MB together. Importing them compiled them into
// the JavaScript bundle, so they were parsed as JS on every load of any screen
// with a map, and re-downloaded whenever unrelated code changed. They now live
// in public/geo/ and are fetched once, then cached by the service worker and
// kept in this module so a second map does not fetch them again.
const geoCache = new Map();

function loadGeo(name) {
  if (!geoCache.has(name)) {
    geoCache.set(
      name,
      fetch(`/geo/${name}.json`)
        .then((response) => {
          if (!response.ok) throw new Error(`Could not load map data (${response.status})`);
          return response.json();
        })
        .catch((error) => {
          geoCache.delete(name); // let a later render retry
          throw error;
        })
    );
  }
  return geoCache.get(name);
}

// Maps app state names to the names used in the localities GeoJSON file.
const STATE_NAME_MAP = {
  "Gezira": "Al Jazirah",
  "Gedarif": "Gedaref",
};

/**
 * A map of Sudan that can zoom and focus on a specific state, showing localities.
 * * ENHANCED visual styles for better clarity and presentation.
 */
const SudanMap = ({
    data = [],
    focusedState = null,
    center,
    scale,
    localityData = [],
    facilityMarkers = [],
    choroplethEnabled = true,
    viewLevel = 'state', // 'state' or 'locality'
    onStateHover,
    onStateLeave,
    onFacilityHover,
    onFacilityLeave,
    onLocalityHover, 
    onLocalityLeave,
    isMovable, 
    pannable   
}) => {
  const [localities, setLocalities] = useState(null);
  const [localityFeatures, setLocalityFeatures] = useState([]);
  const [sudanGeoJson, setSudanGeoJson] = useState(null);
  const [geoError, setGeoError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadGeo('sudan')
      .then((geo) => { if (!cancelled) setSudanGeoJson(geo); })
      .catch((error) => { if (!cancelled) setGeoError(error.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGeo('sudan_localities')
      .then((localitiesGeoJson) => {
        if (cancelled) return;
        if (focusedState) {
          // State view: Filter localities for the focused state
          const localityStateName = STATE_NAME_MAP[focusedState] || focusedState;
          const filteredLocalities = {
            ...localitiesGeoJson,
            features: localitiesGeoJson.features.filter(
              feature => feature.properties.admin_1 === localityStateName
            )
          };
          setLocalities(filteredLocalities);
          setLocalityFeatures(filteredLocalities.features);
        } else {
          // National view: Load ALL localities
          setLocalities(localitiesGeoJson);
          setLocalityFeatures(localitiesGeoJson.features);
        }
      })
      .catch((error) => { if (!cancelled) setGeoError(error.message); });
    return () => { cancelled = true; };
  }, [focusedState]);

  const dataMap = useMemo(() => new Map((data || []).map(item => [item.state, item])), [data]);
  const localityDataMap = useMemo(() => new Map((localityData || []).map(item => [item.key, item])), [localityData]);

  const getColorForPercentage = (percentage) => {
    if (percentage === undefined || percentage === null || isNaN(percentage)) return "#6B6B6B";
    if (percentage < 40) return "#6B6B6B";
    if (percentage >= 75) return "#313695"; 
    if (percentage >= 40) return "#6266B1"; 
    return "#6B6B6B"; 
  };

  const getLabelStyle = (percentage) => {
    return { fill: "#FFFFFF", stroke: "#374151" }; 
  };

  const MapContent = (
    <>
      {/* 3. PASS THE IMPORTED JSON OBJECT TO GEOGRAPHIES */}
      <Geographies geography={sudanGeoJson}>
        {({ geographies }) =>
          geographies.map(geo => {
            const stateData = dataMap.get(geo.properties.name);
            const isFocused = focusedState === geo.properties.name;

            if (viewLevel === 'locality' && !isFocused) {
                return null;
            }
            
            let fillColor = (viewLevel === 'locality' && isFocused)
                ? "#525252" 
                : (choroplethEnabled ? (stateData?.statusColor || getColorForPercentage(stateData ? stateData.percentage : undefined)) : "#6B6B6B");

            if (!stateData?.statusColor && choroplethEnabled && viewLevel === 'state' && stateData && stateData.hasPlannedOnly) {
                fillColor = "#F59E0B";
            }

            const stateName = geo.properties.name;

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fillColor}
                stroke="#BEBEBE" 
                strokeWidth={0.5}
                onMouseEnter={(event) => {
                  if (viewLevel === 'state' && !focusedState && onStateHover) {
                    onStateHover(stateName, event);
                  }
                }}
                onMouseLeave={() => {
                  if (viewLevel === 'state' && !focusedState && onStateLeave) {
                    onStateLeave();
                  }
                }}
                style={{
                  default: { outline: "none" },
                  hover: { fill: "#0ea5e9", outline: "none" },
                  pressed: { fill: "#0ea5e9", outline: "none" }
                }}
              />
            );
          })
        }
      </Geographies>
      
      {localities && (viewLevel === 'locality' || focusedState) && ( 
        <Geographies geography={localities}>
          {({ geographies }) =>
            geographies.map(geo => {
              const lData = localityDataMap.get(geo.properties.admin_2);
              const coverage = lData ? (lData.percentage !== undefined ? lData.percentage : lData.coverage) : undefined;
              let fillColor = choroplethEnabled ? (lData?.statusColor || getColorForPercentage(coverage)) : "#6B6B6B";
              
              if (!lData?.statusColor && choroplethEnabled && lData && lData.hasPlannedOnly) {
                  fillColor = "#F59E0B";
              }
              
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillColor}
                  stroke="#BEBEBE"
                  strokeWidth={0.5}
                  style={{ 
                      default: { outline: "none" }, 
                      hover: { fill: "#0ea5e9", outline: "none", cursor: "pointer" }, 
                      pressed: { fill: "#0ea5e9", outline: "none" } 
                  }}
                  onMouseEnter={(event) => { 
                    if (onLocalityHover) {
                      onLocalityHover(geo.properties, event);
                    }
                  }}
                  onMouseLeave={() => { 
                    if (onLocalityLeave) {
                      onLocalityLeave();
                    }
                  }}
                />
              );
            })
          }
        </Geographies>
      )}

      {choroplethEnabled && viewLevel === 'state' && (data || []).map(({ state, coordinates, percentage }) => (
          <Marker key={state} coordinates={coordinates}>
            <text
              textAnchor="middle"
              y={6}
              style={{
                  fontFamily: "system-ui, sans-serif",
                  fill: getLabelStyle(percentage).fill,
                  fontSize: "14px",
                  fontWeight: "bold",
                  paintOrder: "stroke",
                  stroke: getLabelStyle(percentage).stroke,
                  strokeWidth: "0.8px",
                  strokeLinejoin: "round"
              }}>
              {`${percentage}%`}
            </text>
          </Marker>
      ))}

      {choroplethEnabled && localityFeatures.map(feature => {
          const lData = localityDataMap.get(feature.properties.admin_2);
          if (!lData || lData.coverage === undefined) return null;
          if (!focusedState) return null;

          const centroid = geoCentroid(feature);
          const displayName = lData.name;
          const labelStyle = getLabelStyle(lData.coverage);

          return (
              <Marker key={feature.properties.admin_2} coordinates={centroid}>
                  <text textAnchor="middle" style={{ fontFamily: "system-ui", fontSize: "10px", fontWeight: "bold", paintOrder: "stroke", strokeWidth: "0.4px", strokeLinejoin: "round", ...labelStyle }}>{displayName}</text>
                  <text
                    textAnchor="middle"
                    y={12}
                    style={{
                        fontFamily: "system-ui",
                        fontSize: "12px",
                        fontWeight: "bold",
                        paintOrder: "stroke",
                        strokeWidth: "0.5px",
                        strokeLinejoin: "round",
                        ...labelStyle
                    }}>
                    {`${lData.coverage}%`}
                  </text>
              </Marker>
          );
      })}

      {(facilityMarkers || []).map(({ key, coordinates, name, color }) => (
        <Marker key={key} coordinates={coordinates}>
          <circle
            r={4}
            fill={color || "#313695"} 
            stroke="#FFFFFF"
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(event) => {
                if (onFacilityHover) onFacilityHover(key, event);
            }}
            onMouseLeave={() => {
                if (onFacilityLeave) onFacilityLeave();
            }}
          >
            <title>{name}</title>
          </circle>
        </Marker>
      ))}
    </>
  );

  const isZoomable = isMovable !== false || pannable !== false;

  // The map data arrives over the network now, so the component has two states
  // it never had before. Both are silent failures if they are not handled: an
  // empty <ComposableMap> looks like "there is no data for this area".
  if (geoError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-gray-500">
        The map could not be loaded. Check your connection and try again.
      </div>
    );
  }

  if (!sudanGeoJson) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-600" aria-label="Loading map" />
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center, scale }}
        style={{ width: "100%", height: "100%" }}
      >
        {isZoomable ? (
          <ZoomableGroup center={center}>
            {MapContent}
          </ZoomableGroup>
        ) : (
          <>
            {MapContent}
          </>
        )}
      </ComposableMap>
    </div>
  );
};

export default SudanMap;