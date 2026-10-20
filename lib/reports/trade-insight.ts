import { createHash } from "node:crypto";
import { z } from "zod";
import { tradeData } from "./trade";
import { fdiStockData } from "./fdi-stock";
import snapshot from "./data/trade-insight.json";

const schema = z.object({
  summary: z.string().min(1).refine(text => [...text].length <= 400),
  generatedAt: z.string().datetime(),
  model: z.literal("initial"),
  evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export function tradeEvidenceHash(trade = tradeData, fdi = fdiStockData) {
  return createHash("sha256").update(JSON.stringify({
    trade: { firstMonth: trade.firstMonth, latestMonth: trade.latestMonth, charts: trade.charts },
    fdi: { firstYear: fdi.firstYear, latestYear: fdi.latestYear, categories: fdi.categories, points: fdi.points },
  })).digest("hex");
}

export function getTradeInsight(trade = tradeData, fdi = fdiStockData) {
  const insight = schema.parse(snapshot);
  // A revised figure must not silently retain text about older observations.
  return insight.evidenceHash === tradeEvidenceHash(trade, fdi) ? insight : null;
}
