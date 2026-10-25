import { describe, expect, it } from "vitest";
import data from "./data/equity-valuations.json";
import { chartGroups } from "./catalog";

describe("JPX market valuations", () => {
  it("uses only the requested consolidated first/second section total", () => {
    expect(data.basis).toBe("consolidated-simple-average");
    expect(data.sourcePage).toBe("https://www.jpx.co.jp/markets/statistics-equities/misc/04.html");
    expect(data.sourceSheet).toBe("Consolidated(AVG)～202203");
    expect(data.sourceColumns).toEqual({ per: "D", pbr: "E" });
    expect(data.markets).toEqual([{ id: "firstSecondTotal", label: "市場第一部・二部合計" }]);
    expect(new Set(data.observations.map(row => `${row.month}:${row.market}`)).size).toBe(data.observations.length);
    for (const row of data.observations) {
      expect(row.market).toBe("firstSecondTotal");
      expect(row.month <= "2022-03").toBe(true);
      expect([row.per, row.pbr].every(value => value === null || (Number.isFinite(value) && value >= 0))).toBe(true);
    }
    expect(data.observations[0].month).toBe("1999-01");
  });
  it("matches the aggregate columns and preserves missing values after 2012", () => {
    expect(data.observations.find(row => row.month === "1999-12")).toMatchObject({ per: null, pbr: 1.5 });
    expect(data.observations.find(row => row.month === "2003-12")).toMatchObject({ per: 88.5, pbr: 1 });
    expect(data.observations.find(row => row.month === "2012-12")).toMatchObject({ per: 18.2, pbr: 0.8 });
    expect(data.observations.filter(row => row.month >= "2013-01").every(row => row.per === null && row.pbr === null)).toBe(true);
    expect(data.observations.filter(row => row.per !== null || row.pbr !== null).at(-1)?.month).toBe("2012-12");
  });
  it("places monetary policy before bank lending", () => {
    expect(chartGroups.slice(0, 3).map(group => group.title)).toEqual(["株価評価指標", "日本銀行の金融政策", "金利と国内銀行の貸出残高"]);
  });
});
