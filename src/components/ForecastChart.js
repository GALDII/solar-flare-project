import React, { useState, useEffect, useRef, useMemo } from "react";
// ✨ 1. IMPORT THE JSON FILE DIRECTLY
import forecastJsonData from "../data/forecast_data.json";

function ForecastChart() {
  const [forecastData, setForecastData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    // ✨ 2. REMOVE THE FETCH LOGIC AND USE THE IMPORTED DATA
    try {
      setIsLoading(true);
      if (!forecastJsonData) throw new Error("Forecast data is empty.");

      const processedData = forecastJsonData.map((d) => ({
        date: new Date(d.ds),
        yhat: d.yhat,
        yhat_lower: d.yhat_lower,
        yhat_upper: d.yhat_upper,
      }));

      setForecastData(processedData);
      setError(null);
    } catch (e) {
      console.error("Failed to process local forecast data:", e);
      setError("Could not load or parse forecast data.");
    } finally {
      setIsLoading(false);
    }
  }, []); // The empty array ensures this runs only once on mount

  const chartWidth = 900;
  const chartHeight = 350;
  const padding = { top: 30, right: 50, bottom: 80, left: 80 };

  const { points, pathData, areaPathData, yAxisLabels, xAxisLabels } =
    useMemo(() => {
      if (forecastData.length === 0)
        return {
          points: [],
          pathData: "",
          areaPathData: "",
          yAxisLabels: [],
          xAxisLabels: [],
        };

      const plotWidth = chartWidth - padding.left - padding.right;
      const plotHeight = chartHeight - padding.top - padding.bottom;

      const minDate = forecastData[0].date;
      const maxDate = forecastData[forecastData.length - 1].date;
      const timeRange = maxDate.getTime() - minDate.getTime();

      const allYValues = forecastData.flatMap((d) => [
        d.yhat_lower,
        d.yhat_upper,
      ]);
      let minY = Math.min(...allYValues);
      let maxY = Math.max(...allYValues);

      if (minY === maxY) {
        minY = minY - 1;
        maxY = maxY + 1;
      }

      const yRange = maxY - minY;

      const xScale = (date) =>
        padding.left +
        ((date.getTime() - minDate.getTime()) / timeRange) * plotWidth;
      const yScale = (value) =>
        padding.top + plotHeight - ((value - minY) / yRange) * plotHeight;

      const points = forecastData.map((d) => ({
        x: xScale(d.date),
        y: yScale(d.yhat),
        y_upper: yScale(d.yhat_upper),
        y_lower: yScale(d.yhat_lower),
        ...d,
      }));

      const pathData = points
        .map(
          (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
        )
        .join(" ");

      const upperPath = points
        .map(
          (p, i) =>
            `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y_upper.toFixed(2)}`
        )
        .join(" ");
      const lowerPathReversed = points
        .slice()
        .reverse()
        .map((p) => `L ${p.x.toFixed(2)} ${p.y_lower.toFixed(2)}`)
        .join(" ");
      const areaPathData = `${upperPath} ${lowerPathReversed} Z`;

      const yAxisLabels = Array.from({ length: 6 }, (_, i) => {
        const value = minY + (i / 5) * yRange;
        return { value: value.toFixed(2), y: yScale(value) };
      });

      const xAxisLabels = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(minDate.getTime() + (i / 5) * timeRange);
        return {
          date: date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
          }),
          x: xScale(date),
        };
      });

      return { points, pathData, areaPathData, yAxisLabels, xAxisLabels };
    }, [forecastData]);

  const handleMouseMove = (event) => {
    if (!svgRef.current || points.length === 0) return;
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;

    const inverted = svgPoint.matrixTransform(
      svgRef.current.getScreenCTM().inverse()
    );

    let closestPoint = points[0];
    let minDistance = Infinity;

    points.forEach((p) => {
      const distance = Math.abs(p.x - inverted.x);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = p;
      }
    });
    setHoveredPoint(closestPoint);
  };

  const handleMouseLeave = () => setHoveredPoint(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-cyan-400 border-r-cyan-400"></div>
          <div className="absolute inset-2 animate-pulse rounded-full bg-cyan-400/20"></div>
        </div>
        <p className="text-cyan-400 mt-4 text-lg font-medium">
          Loading Forecast Data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full group">
      <style>{`
        .forecast-line {
          stroke-dasharray: 3000; stroke-dashoffset: 3000;
          animation: draw-line 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.5s forwards;
          filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.6));
        }
        .forecast-area {
          opacity: 0;
          animation: fade-in-area 2s ease-out 1.5s forwards;
        }
        .tooltip-enter {
          animation: tooltip-slide-in 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        @keyframes draw-line { to { stroke-dashoffset: 0; } }
        @keyframes fade-in-area { to { opacity: 1; } }
        @keyframes tooltip-slide-in {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-800/80 to-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-600/50 shadow-2xl"></div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="relative z-10 overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient
            id="forecast-area-gradient"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0891B2" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient
            id="forecast-line-gradient"
            x1="0%"
            x2="100%"
            y1="0%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#A5F3FC" />
            <stop offset="50%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
          <filter id="glow-cyan">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="text-glow-cyan">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {yAxisLabels.map(({ value, y }) => (
          <g key={y}>
            <line
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="3,3"
            />
            <text
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              fill="rgba(255,255,255,0.8)"
              fontSize="11"
            >
              {value}
            </text>
          </g>
        ))}

        {xAxisLabels.map(({ date, x }) => (
          <g key={x}>
            <line
              x1={x}
              y1={chartHeight - padding.bottom}
              x2={x}
              y2={padding.top}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="2,4"
            />
            <text
              x={x}
              y={chartHeight - padding.bottom + 25}
              textAnchor="middle"
              fill="rgba(255,255,255,0.8)"
              fontSize="11"
            >
              {date}
            </text>
          </g>
        ))}

        <path
          d={areaPathData}
          fill="url(#forecast-area-gradient)"
          className="forecast-area"
        />
        <path
          d={pathData}
          fill="none"
          stroke="url(#forecast-line-gradient)"
          strokeWidth="3"
          className="forecast-line"
        />

        <text
          x={chartWidth / 2}
          y={chartHeight - 15}
          textAnchor="middle"
          fill="#22D3EE"
          fontSize="14"
          fontWeight="600"
          filter="url(#text-glow-cyan)"
        >
          Forecast Date
        </text>
        <text
          x={35}
          y={chartHeight / 2}
          textAnchor="middle"
          fill="#22D3EE"
          fontSize="14"
          fontWeight="600"
          transform={`rotate(-90, 35, ${chartHeight / 2})`}
          filter="url(#text-glow-cyan)"
        >
          Predicted Value (yhat)
        </text>

        {hoveredPoint && (
          <g className="tooltip-enter" style={{ pointerEvents: "none" }}>
            <line
              x1={hoveredPoint.x}
              y1={padding.top}
              x2={hoveredPoint.x}
              y2={chartHeight - padding.bottom}
              stroke="rgba(34, 211, 238, 0.7)"
              strokeWidth="2"
              strokeDasharray="5,5"
              filter="url(#glow-cyan)"
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="8"
              fill="#22D3EE"
              stroke="#A5F3FC"
              strokeWidth="3"
              filter="url(#glow-cyan)"
            />
            <g
              transform={`translate(${Math.min(
                hoveredPoint.x + 15,
                chartWidth - 140
              )}, ${padding.top + 10})`}
            >
              <rect
                x="0"
                y="0"
                width="130"
                height="75"
                rx="8"
                fill="rgba(17, 24, 39, 0.95)"
                stroke="rgba(34, 211, 238, 0.8)"
                strokeWidth="2"
                filter="url(#glow-cyan)"
              />
              <text x="15" y="22" fill="#FFFFFF" fontSize="13" fontWeight="600">
                {hoveredPoint.date.toLocaleDateString()}
              </text>
              <text x="15" y="42" fill="#A5F3FC" fontSize="12">
                Pred:{" "}
                <tspan fontWeight="bold">{hoveredPoint.yhat.toFixed(4)}</tspan>
              </text>
              <text x="15" y="62" fill="#67E8F9" fontSize="12">
                Range: {hoveredPoint.yhat_lower.toFixed(2)} -{" "}
                {hoveredPoint.yhat_upper.toFixed(2)}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

export default ForecastChart;
