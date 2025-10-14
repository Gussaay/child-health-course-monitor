// SudanMap.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { geoCentroid } from "d3-geo";

const geoUrl = "/sudan.json";
const localitiesGeoUrl = "/sudan_localities.json";

// Maps app state names to the names used in the localities GeoJSON file.
const STATE_NAME_MAP = {
  "Gezira": "Al Jazirah",
  "Gedarif": "Al Qadarif",
  // Add other name inconsistencies here if you find more
};


/**
 * A map of Sudan that can zoom and focus on a specific state, showing localities.
 * @param {Array<object>} data - An array of state objects, e.g., [{ state, percentage, coordinates }]
 * @param {Array<object>} localityData - Array of locality coverage data for the focused state.
 * @param {string|null} focusedState - The key of the state to focus on (e.g., "Gezira").
 * @param {Array<number>} center - The center coordinates for the map projection.
 * @param {number} scale - The scale/zoom level for the map projection.
 */
const SudanMap = ({ data, focusedState = null, center, scale, localityData = [] }) => {
  const [localities, setLocalities] = useState(null);
  const [localityFeatures, setLocalityFeatures] = useState([]);

  useEffect(() => {
    if (focusedState) {
      // Use the mapped name for filtering, or the original if no mapping exists
      const localityStateName = STATE_NAME_MAP[focusedState] || focusedState;

      fetch(localitiesGeoUrl)
        .then(res => res.json())
        .then(geoJson => {
          const filteredLocalities = {
            ...geoJson,
            features: geoJson.features.filter(
              feature => feature.properties.admin_1 === localityStateName
            )
          };
          setLocalities(filteredLocalities);
          setLocalityFeatures(filteredLocalities.features);
        });
    } else {
      setLocalities(null);
      setLocalityFeatures([]);
    }
  }, [focusedState]);

  // Create Maps for efficient data lookup
  const dataMap = useMemo(() => new Map(data.map(item => [item.state, item])), [data]);
  const localityDataMap = useMemo(() => new Map(localityData.map(item => [item.key, item])), [localityData]);

  const getColorForPercentage = (percentage) => {
    if (percentage === undefined || percentage === null || isNaN(percentage) || percentage < 1) {
      return "#CFD8DC"; // Grey for no data
    }
    if (percentage >= 75) {
      return "#16A34A"; // green-600
    }
    if (percentage >= 40) {
      return "#FACC15"; // yellow-400
    }
    return "#DC2626";   // red-600
  };

  /**
   * Determines the best text color and style based on the coverage percentage
   * to ensure high contrast against the background color.
   */
  const getLabelStyle = (percentage) => {
    // Style for medium coverage (yellow background)
    if (percentage >= 40 && percentage < 75) {
      return { fill: "#1f2937", stroke: "white" };
    }
    // Style for low (red) and high (green) coverage
    return { fill: "#FFFFFF", stroke: "black" };
  };


  return (
    <div className="w-full h-full">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          center: center,
          scale: scale
        }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map(geo => {
              const stateData = dataMap.get(geo.properties.name);
              const isFocused = focusedState === geo.properties.name;
              // If a state is focused, only render that state's geography
              if (focusedState && !isFocused) {
                return null;
              }
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  // If focused, the background is neutral; otherwise, color by state coverage
                  fill={focusedState ? "#E0E0E0" : getColorForPercentage(stateData ? stateData.percentage : undefined)}
                  stroke="#FFF"
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#0e7490", outline: "none" },
                    pressed: { fill: "#0e7490", outline: "none" }
                  }}
                />
              );
            })
          }
        </Geographies>
        {localities && (
          <Geographies geography={localities}>
            {({ geographies }) =>
              geographies.map(geo => {
                const lData = localityDataMap.get(geo.properties.admin_2);
                const coverage = lData ? lData.coverage : undefined;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getColorForPercentage(coverage)}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        )}
        
        {/* State-level markers (only show if no state is focused) */}
        {!focusedState && data.map(({ state, coordinates, percentage }) => (
            <Marker key={state} coordinates={coordinates}>
              <text textAnchor="middle" style={{ fontFamily: "system-ui", fill: "#333", fontSize: "10px", fontWeight: "bold", paintOrder: "stroke", stroke: "#FFFFFF", strokeWidth: "0.5px" }}>
                {state}
              </text>
              <text textAnchor="middle" y={12} style={{ fontFamily: "system-ui", fill: "#111", fontSize: "10px", fontWeight: "600", paintOrder: "stroke", stroke: "#FFFFFF", strokeWidth: "0.5px" }}>
                {`${percentage}%`}
              </text>
            </Marker>
        ))}

        {/* Locality-level markers (only show if a state is focused) */}
        {localityFeatures.map(feature => {
            const lData = localityDataMap.get(feature.properties.admin_2);
            if (!lData || lData.coverage === undefined) return null;

            const centroid = geoCentroid(feature);
            const displayName = lData.name; // Arabic name from dashboard data
            const labelStyle = getLabelStyle(lData.coverage);

            return (
                <Marker key={feature.properties.admin_2} coordinates={centroid}>
                    <text
                        textAnchor="middle"
                        style={{
                            fontFamily: "system-ui",
                            fontSize: "10px",
                            fontWeight: "bold",
                            paintOrder: "stroke",
                            strokeWidth: "0.4px",
                            strokeLinejoin: "round",
                            ...labelStyle
                        }}>
                        {displayName}
                    </text>
                    <text
                        textAnchor="middle"
                        y={12}
                        style={{
                            fontFamily: "system-ui",
                            fontSize: "9px",
                            fontWeight: "600",
                            paintOrder: "stroke",
                            strokeWidth: "0.4px",
                            strokeLinejoin: "round",
                            ...labelStyle
                        }}>
                        {`${lData.coverage}%`}
                    </text>
                </Marker>
            );
        })}
      </ComposableMap>
      <div className="flex items-center justify-center p-2 text-gray-600">
        <span className="text-xs font-medium mr-2">Low Coverage</span>
        <div className="w-40 h-4 rounded" style={{ background: 'linear-gradient(to right, #DC2626, #FACC15, #16A34A)' }}></div>
        <span className="text-xs font-medium ml-2">High Coverage</span>
      </div>
    </div>
  );
};

export default SudanMap;