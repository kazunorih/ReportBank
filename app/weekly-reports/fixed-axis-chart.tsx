"use client";

import type { ReactNode } from "react";
import type { ChartScale } from "@/lib/reports/chart-scale";

// These dimensions are shared with the scrolling Recharts plot.
export const plotMargin = { top: 12, right: 12, bottom: 12, left: 12 };
export const xAxisHeight = 65;

function Axis({ scale, height, right = false, suffix = "" }: { scale: ChartScale; height: number; right?: boolean; suffix?: string }) {
  const bottom = height - plotMargin.bottom - xAxisHeight;
  const x = right ? 0 : 64;
  return <svg width={right ? 48 : 65} height={height} className="shrink-0 overflow-visible text-slate-500" aria-hidden="true">
    <line x1={x} x2={x} y1={plotMargin.top} y2={bottom} stroke="#94a3b8" />
    {scale.ticks.map(value => {
      const y = bottom - (value - scale.domain[0]) / (scale.domain[1] - scale.domain[0]) * (bottom - plotMargin.top);
      return <g key={value}>
        <line x1={x} x2={x + (right ? 5 : -5)} y1={y} y2={y} stroke="#94a3b8" />
        <text x={x + (right ? 8 : -8)} y={y} dominantBaseline="middle" textAnchor={right ? "start" : "end"} fill="currentColor" fontSize={11}>{value.toLocaleString("ja-JP", { maximumFractionDigits: 6 })}{suffix}</text>
      </g>;
    })}
  </svg>;
}

export default function FixedAxisChart({ left, right, leftUnit, rightUnit, minWidth, height, label, children, leftTickSuffix = "", rightTickSuffix = "%" }: {
  left: ChartScale; right?: ChartScale; leftUnit: string; rightUnit?: string; minWidth: number; height: number; label: string; children: ReactNode; leftTickSuffix?: string; rightTickSuffix?: string;
}) {
  return <div className="mt-5 min-w-0" role="group" aria-label={label}>
    <div className="mb-2 flex justify-between gap-3 text-xs text-slate-500"><span>{leftUnit}</span>{right && <span>{rightUnit}</span>}</div>
    <div className="flex min-w-0" data-fixed-axis-chart>
      <Axis scale={left} height={height} suffix={leftTickSuffix} />
      <div className="min-w-0 flex-1 overflow-x-auto" tabIndex={0} role="region" aria-label={`${label}（横スクロール）`}>
        <div style={{ minWidth: minWidth - 65 - (right ? 48 : 0), height }}>{children}</div>
      </div>
      {right && <Axis scale={right} height={height} right suffix={rightTickSuffix} />}
    </div>
  </div>;
}
