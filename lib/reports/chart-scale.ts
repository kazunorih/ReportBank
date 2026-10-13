export function chartScale(values: (number | null | undefined)[]) {
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  const min = Math.min(0, ...finite);
  const max = Math.max(0, ...finite);
  const rough = (max - min || 1) / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find(value => value * power >= rough) ?? 10) * power;
  const low = Math.floor(min / step);
  const high = Math.max(low + 1, Math.ceil(max / step));
  const ticks = Array.from({ length: high - low + 1 }, (_, index) => Number(((low + index) * step).toPrecision(12)));
  return { domain: [ticks[0], ticks[ticks.length - 1]] as [number, number], ticks };
}

export type ChartScale = ReturnType<typeof chartScale>;
