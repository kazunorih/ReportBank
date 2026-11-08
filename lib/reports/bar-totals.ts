import { chartScale } from "./chart-scale";

export function formatBarTotal(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 1 ? 3 : 1 });
}

export const barTotalLabel = { position: "top" as const, offset: 6, fontSize: 11, fill: "#475569", formatter: formatBarTotal };

export function sumBarValues(values: unknown[]): number | null {
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) : null;
}

// Put a stack's label on the highest rendered segment, even when later series
// are missing. Lines and other measures are excluded by the supplied keys.
export function stackLabelValue(row: Record<string, unknown>, keys: string[], key: string, totalKey?: string) {
  const present = keys.filter(id => typeof row[id] === "number" && Number.isFinite(row[id]));
  if (present.at(-1) !== key) return null;
  const total = totalKey ? row[totalKey] : undefined;
  return typeof total === "number" && Number.isFinite(total) ? total : sumBarValues(present.map(id => row[id]));
}

export function barLabelScale(values: (number | null | undefined)[]) {
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!finite.length) return chartScale(values);
  const max = Math.max(0, ...finite);
  const min = Math.min(0, ...finite);
  return chartScale([...values, max + (max - min || 1) * 0.1]);
}
