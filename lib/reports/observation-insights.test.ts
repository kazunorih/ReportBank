import { describe, expect, it } from "vitest";
import { getTradeInsight, tradeEvidenceHash } from "./trade-insight";
import { tradeData } from "./trade";
import { fdiStockData } from "./fdi-stock";
import { coreInflationData } from "./core-inflation";
import market from "./data/markets.json";
import { marketChartSchema } from "./schema";
import valuations from "./data/equity-valuations.json";

describe("published observation insights", () => {
  it("validates both summaries within 400 Unicode characters", () => {
    const macro = marketChartSchema.parse(market).insight!;
    const trade = getTradeInsight()!;
    for (const insight of [macro, trade]) {
      expect(insight).toBeTruthy();
      expect([...insight.summary].length).toBeGreaterThan(0);
      expect([...insight.summary].length).toBeLessThanOrEqual(400);
      expect(insight.model).toBe("initial");
    }
    expect(macro.generatedAt).toBe("2026-10-25T12:00:21Z");
    expect(trade.generatedAt).toBe("2026-10-20T13:56:53Z");
    const exports = tradeData.charts[0].points.at(-1)!.total / 1_000_000;
    const imports = tradeData.charts[1].points.at(-1)!.total / 1_000_000;
    expect(trade.summary).toContain(`輸出は${exports.toFixed(2)}兆円`);
    expect(trade.summary).toContain(`輸入は${imports.toFixed(2)}兆円`);
    expect(trade.summary).toContain(`${(imports - exports).toFixed(2)}兆円の赤字`);
    expect(macro.summary).toContain(`${coreInflationData.observations.at(-1)!.trimmedMean!.toFixed(2)}％`);
    const prime = valuations.observations.find(row => row.month === "2025-12" && row.market === "prime")!;
    const standard = valuations.observations.find(row => row.month === "2025-12" && row.market === "standard")!;
    expect(macro.summary).toContain(`PERは${prime.per!.toFixed(1)}倍、PBRは${prime.pbr!.toFixed(1)}倍`);
    expect(macro.summary).toContain(`スタンダードは${standard.per!.toFixed(1)}倍、${standard.pbr!.toFixed(1)}倍`);
    expect(macro.summary).toContain('「-」を0表示した年も割安さの根拠にはならない');
  });

  it("hides trade text when any figure is revised, including FDI", () => {
    const revisedTrade = structuredClone(tradeData);
    revisedTrade.charts[0].points[0].total += 1;
    expect(getTradeInsight(revisedTrade)).toBeNull();
    const revisedFdi = structuredClone(fdiStockData);
    revisedFdi.points.at(-1)!.values[0] += 1;
    expect(getTradeInsight(tradeData, revisedFdi)).toBeNull();
    expect(tradeEvidenceHash({ ...tradeData, retrievedAt: "2026-10-21T00:00:00Z" })).toBe(tradeEvidenceHash());
  });
});
