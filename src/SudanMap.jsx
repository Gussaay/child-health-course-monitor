import React, { useState, useEffect } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";

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

  // Optimized projection settings for Sudan
  const mapCenter = [30, 15.5];
  const mapScale = 2000;

  // Create a linear color scale for a lighter blue saturation
  const maxCount = data.reduce((max, item) => Math.max(max, item.count), 0) || 1;
  const colorScale = scaleLinear()
    .domain([0, maxCount])
    .range(["#deebf7", "#2171b5"]);

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{
        scale: mapScale,
        center: mapCenter,
      }}
      style={{ width: "100%", height: "600px" }}
    >
      <Geographies geography={geographies}>
        {({ geographies }) =>
          geographies.map(geo => {
            const stateNameFromGeoJSON = geo.properties.name ? geo.properties.name.toLowerCase() : '';
            const stateData = data.find(item => item.state.toLowerCase() === stateNameFromGeoJSON);
            
            const fill = stateData ? colorScale(stateData.count) : "#EAEAEC";

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke="#D6D6DA"
              />
            );
          })
        }
      </Geographies>
      {data.map(({ state, coordinates, count }) => (
        <Marker key={state} coordinates={coordinates}>
          <g transform="translate(0, 0)">
            <text
              textAnchor="middle"
              y="-10"
              style={{
                fontFamily: "system-ui",
                fill: "white",
                fontSize: "12px",
                fontWeight: "normal"
              }}
            >
              {count}
            </text>
            <text
              textAnchor="middle"
              y="5"
              style={{
                fontFamily: "system-ui",
                fill: "black", // Changed color to black
                fontSize: "10px",
                pointerEvents: "none"
              }}
            >
              {state}
            </text>
          </g>
        </Marker>
      ))}
    </ComposableMap>
  );
};

export default SudanMap;