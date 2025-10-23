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

  const getColorForPercentage = (percentage) => {
    if (percentage === undefined || percentage === null || isNaN(percentage)) return "#CFD8DC"; // Gray/Neutral

    // Use light pink instead of red for low coverage
    if (percentage < 40) return "#FECACA"; // Light Pink (Red-200)
    if (percentage >= 75) return "#16A34A"; // Green
    if (percentage >= 40) return "#FACC15"; // Yellow

    return "#CFD8DC";
  };

  const getLabelStyle = (percentage) => {
    if (percentage === undefined || percentage === null) return { fill: "#333", stroke: "white" };
    // Use dark red text on the new light pink background for contrast
    if (percentage < 40) return { fill: "#991B1B", stroke: "#FEF2F2" };
    if (percentage >= 40 && percentage < 75) return { fill: "#1f2937", stroke: "white" };
    return { fill: "#FFFFFF", stroke: "black" };
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
            
            const fillColor = (viewLevel === 'locality' && isFocused)
                ? "#E0E0E0" // Focused state is gray background
                : (choroplethEnabled ? getColorForPercentage(stateData ? stateData.percentage : undefined) : "#F0F0F0"); // State view gets colors

            const stateName = geo.properties.name;

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fillColor}
                stroke="#FFF"
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
                  hover: { fill: (choroplethEnabled && viewLevel === 'state') ? "#0e7490" : "#E0E0E0", outline: "none" },
                  pressed: { fill: (choroplethEnabled && viewLevel === 'state') ? "#0e7490" : "#E0E0E0", outline: "none" }
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
              const fillColor = choroplethEnabled ? getColorForPercentage(coverage) : "#F0F0F0";
              
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillColor}
                  stroke="#000000"
                  strokeWidth={0.5}
                  style={{ 
                      default: { outline: "none" }, 
                      hover: { fill: "#0e7490", outline: "none", cursor: "pointer" }, // Added hover style
                      pressed: { fill: "#0e7490", outline: "none" } 
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
          {/* Facility markers are now larger and a more prominent blue */}
          <circle
            r={4}
            fill="#0369A1"
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