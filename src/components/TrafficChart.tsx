import React, { useState } from 'react';
import type { TrafficDataPoint } from '../types/sentinel';

interface TrafficChartProps {
  data: TrafficDataPoint[];
}

export const TrafficChart: React.FC<TrafficChartProps> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = data.length > 0 ? data : [
    { time: '12:00', normal: 0, suspicious: 0, blocked: 0 },
    { time: '12:01', normal: 0, suspicious: 0, blocked: 0 },
  ];

  const maxVal = Math.max(
    5,
    ...points.map((p) => Math.max(p.normal, p.suspicious, p.blocked, p.normal + p.suspicious + p.blocked))
  );

  const height = 180;
  const width = 640;
  const paddingX = 40;
  const paddingY = 25;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const getX = (idx: number) => paddingX + (idx / Math.max(1, points.length - 1)) * chartWidth;
  const getY = (val: number) => paddingY + chartHeight - (val / maxVal) * chartHeight;

  // Generate SVG path for a metric
  const makeLinePath = (getter: (p: TrafficDataPoint) => number) => {
    return points
      .map((p, idx) => {
        const x = getX(idx);
        const y = getY(getter(p));
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const makeAreaPath = (getter: (p: TrafficDataPoint) => number) => {
    const line = makeLinePath(getter);
    const lastX = getX(points.length - 1);
    const firstX = getX(0);
    const bottomY = getY(0);
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const normalPath = makeLinePath((p) => p.normal);
  const normalArea = makeAreaPath((p) => p.normal);

  const suspPath = makeLinePath((p) => p.suspicious);
  const suspArea = makeAreaPath((p) => p.suspicious);

  const blockedPath = makeLinePath((p) => p.blocked);
  const blockedArea = makeAreaPath((p) => p.blocked);

  return (
    <div className="w-full">
      {/* Legend Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
        <div className="flex items-center gap-4 text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Normal Traffic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Suspicious (Risk 30+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Blocked / 403 (Critical)</span>
          </div>
        </div>

        {hoveredIdx !== null && points[hoveredIdx] && (
          <div className="font-mono text-slate-400 text-xs flex items-center gap-2">
            <span>At {points[hoveredIdx].time}:</span>
            <span className="text-emerald-400">Normal: {points[hoveredIdx].normal}</span>
            <span className="text-amber-400">Suspicious: {points[hoveredIdx].suspicious}</span>
            <span className="text-rose-400">Blocked: {points[hoveredIdx].blocked}</span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full aspect-[640/180] overflow-hidden bg-slate-900/60 rounded-lg border border-slate-800">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="suspGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="blockGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = paddingY + chartHeight * (1 - pct);
            const val = Math.round(maxVal * pct);
            return (
              <g key={pct}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#64748b"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area fills */}
          <path d={normalArea} fill="url(#normalGrad)" />
          <path d={suspArea} fill="url(#suspGrad)" />
          <path d={blockedArea} fill="url(#blockGrad)" />

          {/* Lines */}
          <path d={normalPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
          <path d={suspPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          <path d={blockedPath} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />

          {/* Hover hit-boxes & Markers */}
          {points.map((p, idx) => {
            const x = getX(idx);
            const yNormal = getY(p.normal);
            const ySusp = getY(p.suspicious);
            const yBlock = getY(p.blocked);
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Invisible hover bar */}
                <rect
                  x={x - 15}
                  y={0}
                  width="30"
                  height={height}
                  fill="transparent"
                />

                {isHovered && (
                  <>
                    <line
                      x1={x}
                      y1={paddingY}
                      x2={x}
                      y2={height - paddingY}
                      stroke="#475569"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle cx={x} cy={yNormal} r="3.5" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                    {p.suspicious > 0 && (
                      <circle cx={x} cy={ySusp} r="3.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />
                    )}
                    {p.blocked > 0 && (
                      <circle cx={x} cy={yBlock} r="4" fill="#f43f5e" stroke="#0f172a" strokeWidth="1.5" />
                    )}
                  </>
                )}

                {/* X Axis Time Labels (every 2-3 points) */}
                {idx % 2 === 0 && (
                  <text
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#64748b"
                    fontFamily="monospace"
                  >
                    {p.time}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
