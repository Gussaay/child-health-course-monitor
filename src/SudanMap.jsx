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

const geoUrl = "./sudan.json"; // <-- FIXED
const localitiesGeoUrl = "./sudan_localities.json"; // <-- FIXED

// Maps app state names to the names used in the localities GeoJSON file.
const STATE_NAME_MAP = {
  "Gezira": "Al Jazirah",
  "Gedarif": "Al Qadarif",
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
    isMovable, // <-- Prop is still accepted
    pannable   // <-- Prop is still accepted
}) => {
  const [localities, setLocalities] = useState(null);
  const [localityFeatures, setLocalityFeatures] = useState([]);

  useEffect(() => {
    fetch(localitiesGeoUrl)
      .then(res => res.json())
      .then(geoJson => {
        if (focusedState) {
          // State view: Filter localities for the focused state
          const localityStateName = STATE_NAME_MAP[focusedState] || focusedState;
          const filteredLocalities = {
            ...geoJson,
            features: geoJson.features.filter(
              feature => feature.properties.admin_1 === localityStateName
            )
          };
          setLocalities(filteredLocalities);
          setLocalityFeatures(filteredLocalities.features);
        } else {
          // National view: Load ALL localities (for locality view)
          setLocalities(geoJson);
          setLocalityFeatures(geoJson.features);
        }
      });
  }, [focusedState]);

  const dataMap = useMemo(() => new Map((data || []).map(item => [item.state, item])), [data]);
  const localityDataMap = useMemo(() => new Map((localityData || []).map(item => [item.key, item])), [localityData]);

  // --- MODIFICATION: Updated to new color scale from image ---
  const getColorForPercentage = (percentage) => {
    // Dark Gray for undefined, null, or NaN (from image)
    if (percentage === undefined || percentage === null || isNaN(percentage)) return "#6B6B6B";

    // < 40: Dark Gray (from image)
    if (percentage < 40) return "#6B6B6B";
    
    // >= 75: Dark Blue (from image)
    if (percentage >= 75) return "#313695"; 
    
    // 40-74: A lighter version of the image's blue
    if (percentage >= 40) return "#6266B1"; 

    return "#6B6B6B"; // Fallback to dark gray
  };

  // --- MODIFICATION: Updated label colors for new dark background ---
  const getLabelStyle = (percentage) => {
    // All backgrounds are dark, so use white text with a dark stroke for contrast.
    return { fill: "#FFFFFF", stroke: "#374151" }; 
  };


  // --- MODIFICATION START ---
  // We define the map's content here so it can be reused.
  const MapContent = (
    <>
      <Geographies geography={geoUrl}>
        {({ geographies }) =>
          geographies.map(geo => {
            const stateData = dataMap.get(geo.properties.name);
            const isFocused = focusedState === geo.properties.name;

            if (viewLevel === 'locality' && !isFocused) {
                // In locality view (either national or focused), hide non-focused states.
                return null;
            }
            
            // --- MODIFICATION: Use new dark gray as base/disabled color ---
            const fillColor = (viewLevel === 'locality' && isFocused)
                ? "#525252" // Focused state is slightly lighter gray
                : (choroplethEnabled ? getColorForPercentage(stateData ? stateData.percentage : undefined) : "#6B6B6B"); // State view gets colors

            const stateName = geo.properties.name;

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fillColor}
                stroke="#BEBEBE" // --- MODIFICATION: Light gray border ---
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
                  // --- MODIFICATION: Use bright blue hover for contrast ---
                  hover: { fill: "#0ea5e9", outline: "none" },
                  pressed: { fill: "#0ea5e9", outline: "none" }
                }}
              />
            );
          })
        }
      </Geographies>
      {localities && (viewLevel === 'locality' || focusedState) && ( // Show localities if in locality view OR a state is focused
        <Geographies geography={localities}>
          {({ geographies }) =>
            geographies.map(geo => {
              const lData = localityDataMap.get(geo.properties.admin_2);
              const coverage = lData ? lData.coverage : undefined;
              // --- MODIFICATION: Use new dark gray as base/disabled color ---
              const fillColor = choroplethEnabled ? getColorForPercentage(coverage) : "#6B6B6B";
              
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillColor}
                  // --- MODIFICATION: Set locality border to light gray ---
                  stroke="#BEBEBE"
                  strokeWidth={0.5}
                  style={{ 
                      default: { outline: "none" }, 
                      // --- MODIFICATION: Use bright blue hover for contrast ---
                      hover: { fill: "#0ea5e9", outline: "none", cursor: "pointer" }, 
                      pressed: { fill: "#0ea5e9", outline: "none" } 
                  }}
                  onMouseEnter={(event) => { // Added event handler
                    if (onLocalityHover) {
                      onLocalityHover(geo.properties, event);
                    }
                  }}
                  onMouseLeave={() => { // Added event handler
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

      {/* State-level percentage labels (re-added) */}
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

      {/* Locality labels (only for focused state) */}
      {choroplethEnabled && localityFeatures.map(feature => {
          const lData = localityDataMap.get(feature.properties.admin_2);
          if (!lData || lData.coverage === undefined) return null;
          // Only show labels if in focused state view
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

      {(facilityMarkers || []).map(({ key, coordinates, name }) => (
        <Marker key={key} coordinates={coordinates}>
          {/* --- MODIFICATION: Update facility marker to match new blue --- */}
          <circle
            r={4}
            fill="#313695" 
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

  // If isMovable or pannable is not explicitly set to false, we assume it's zoomable.
  const isZoomable = isMovable !== false || pannable !== false;
  // --- MODIFICATION END ---

  return (
    <div className="w-full h-full">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center, scale }}
        style={{ width: "100%", height: "100%" }}
      >
        {/*
          MODIFICATION: 
          We conditionally render ZoomableGroup.
          If the map is zoomable, we wrap MapContent in it.
          If not (isMovable={false} and pannable={false}), we render MapContent directly.
          This avoids passing disableZoom/disablePanning and triggering the warning.
        */}
        {isZoomable ? (
          <ZoomableGroup 
            center={center}
            // No need to pass disableZoom/disablePanning here
          >
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