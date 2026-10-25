import { describe, expect, it } from "vitest";
import data from "./data/equity-valuations.json";
import { chartGroups } from "./catalog";

describe("JPX market valuations", () => {
  it("keeps consolidated simple averages and distinguishes market reforms", () => {
    expect(data.basis).toBe("consolidated-simple-average");
    expect(data.sourcePage).toBe("https://www.jpx.co.jp/markets/statistics-equities/misc/04.html");
    expect(data.markets).toHaveLength(7);
    expect(new Set(data.observations.map(row => `${row.month}:${row.market}`)).size).toBe(data.observations.length);
    for (const row of data.observations) {
      const current = ["prime", "standard", "growth"].includes(row.market);
      expect(current ? row.month >= "2022-04" : row.month <= "2022-03").toBe(true);
      expect([row.per, row.pbr].every(value => value === null || (Number.isFinite(value) && value >= 0))).toBe(true);
    }
    expect(data.observations[0].month).toBe("1999-01");
  });
  it("matches the separately published September 2026 monthly workbook", () => {
    expect(data.observations.find(row => row.month === "2026-09" && row.market === "prime")).toMatchObject({ per: 18.9, pbr: 1.5 });
    expect(data.observations.find(row => row.month === "2026-09" && row.market === "standard")).toMatchObject({ per: 14.5, pbr: 0.9 });
    expect(data.observations.find(row => row.month === "2026-09" && row.market === "growth")).toMatchObject({ per: 31.7, pbr: 2.9 });
  });
  it("places monetary policy before bank lending", () => {
    expect(chartGroups.slice(0, 3).map(group => group.title)).toEqual(["株価評価指標", "日本銀行の金融政策", "金利と国内銀行の貸出残高"]);
  });
});
