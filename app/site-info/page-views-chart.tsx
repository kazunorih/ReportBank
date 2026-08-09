"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AnalyticsPoint } from "@/lib/google-analytics";

type PageViewsChartProps = {
  data: AnalyticsPoint[];
  label: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default function PageViewsChart({ data, label }: PageViewsChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        表示できるデータがありません。
      </p>
    );
  }

  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={`${label}の日別PV数の折れ線グラフ`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            minTickGap={32}
            tickFormatter={formatDate}
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} />
          <Tooltip
            labelFormatter={(value) => `${value}`}
            formatter={(value) => [
              `${Number(value).toLocaleString("ja-JP")} PV`,
              "PV数",
            ]}
          />
          <Line
            type="monotone"
            dataKey="pageViews"
            stroke="#0284c7"
            strokeWidth={2}
            dot={data.length <= 31}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
