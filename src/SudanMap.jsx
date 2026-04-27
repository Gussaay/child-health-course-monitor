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

// 1. IMPORT THE JSON FILES DIRECTLY (Make sure they are in the same folder as this component)
import sudanGeoJson from "./sudan.json"; 
import localitiesGeoJson from "./sudan_localities.json";

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

  useEffect(() => {
    // 2. USE THE IMPORTED JSON DIRECTLY (No fetch network request needed)
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