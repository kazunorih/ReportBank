import "server-only";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type AnalyticsPoint = {
  date: string;
  pageViews: number;
};

export type AnalyticsPeriod = {
  key: "year" | "month" | "week";
  label: string;
  total: number;
  points: AnalyticsPoint[];
};

const periodDefinitions = [
  { key: "year", label: "直近1年", days: 365 },
  { key: "month", label: "直近1か月", days: 30 },
  { key: "week", label: "直近1週間", days: 7 },
] as const;

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} が設定されていません。`);
  }

  return value;
}

function toIsoDate(gaDate: string) {
  return `${gaDate.slice(0, 4)}-${gaDate.slice(4, 6)}-${gaDate.slice(6, 8)}`;
}

export async function getPageViewPeriods(): Promise<AnalyticsPeriod[]> {
  const propertyId = requiredEnvironmentVariable("GA_PROPERTY_ID");
  const clientEmail = requiredEnvironmentVariable("GA_CLIENT_EMAIL");
  const privateKey = requiredEnvironmentVariable("GA_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );

  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "364daysAgo", endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 366,
  });

  const allPoints = (response.rows ?? []).map((row) => ({
    date: toIsoDate(row.dimensionValues?.[0]?.value ?? ""),
    pageViews: Number(row.metricValues?.[0]?.value ?? 0),
  }));

  return periodDefinitions.map(({ key, label, days }) => {
    const points = allPoints.slice(-days);

    return {
      key,
      label,
      points,
      total: points.reduce((sum, point) => sum + point.pageViews, 0),
    };
  });
}
