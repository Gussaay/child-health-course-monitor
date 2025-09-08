import React, { useState, useEffect } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";

const geoUrl = "/sudan.json";

const SudanMap = ({ data }) => {
  const [geographies, setGeographies] = useState([]);

  useEffect(() => {
    fetch(geoUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error("Could not load the local map file.");
        }
        return response.json();
      })
      .then(geoData => {
        setGeographies(geoData);
      })
      .catch(error => console.error("Error fetching map data:", error));
  }, []);

  const mapCenter = [30, 15.5];
  const mapScale = 2000;

  const maxCount = data.reduce((max, item) => Math.max(max, item.count), 0) || 1;

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{
        scale: mapScale,
        center: mapCenter,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <Geographies geography={geographies}>
        {({ geographies }) =>
          geographies.map(geo => {
            const stateNameFromGeoJSON = geo.properties.name ? geo.properties.name.toLowerCase() : '';
            
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                stroke="#D6D6DA"
                style={{
                  default: {
                    fill: "#EAEAEC",
                    stroke: "#D6D6DA",
                    outline: "none"
                  },
                  hover: {
                    fill: "#a2d2ff",
                    stroke: "#D6D6DA",
                    outline: "none"
                  },
                  pressed: {
                    fill: "#a2d2ff",
                    stroke: "#D6D6DA",
                    outline: "none"
                  }
                }}
              />
            );
          })
        }
      </Geographies>
      {data.map(({ state, coordinates, count }) => (
        <Marker key={state} coordinates={coordinates}>
          <circle
              r={Math.max(5, (count / maxCount) * 20)}
              fill="#0ea5e9"
              stroke="#fff"
              strokeWidth={2}
              opacity={0.8}
          />
          <text
              textAnchor="middle"
              // Adjusted y position to match the facilitator map
              y={-Math.max(5, (count / maxCount) * 20) - 5}
              style={{
                  fontFamily: "system-ui",
                  fill: "#5D5A6D",
                  fontSize: "10px",
                  fontWeight: "bold",
                  pointerEvents: "none"
              }}
          >
              {state} ({count})
          </text>
        </Marker>
      ))}
    </ComposableMap>
  );
};

export default SudanMap;