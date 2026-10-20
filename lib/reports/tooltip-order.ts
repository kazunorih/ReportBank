// Recharts defaults to sorting tooltip entries by name. Use the same explicit
// sequence as the legend instead, independent of labels and current values.
export function tooltipOrder(keys: readonly string[]) {
  const ranks = new Map(keys.map((key, index) => [key, index]));
  return (entry: { dataKey?: unknown }) => ranks.get(String(entry.dataKey)) ?? keys.length;
}
