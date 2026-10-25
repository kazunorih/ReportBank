import { describe, expect, it } from "vitest";
import data from "./data/equity-valuations.json";
import { chartGroups } from "./catalog";

describe("JPX market valuations", () => {
  it("uses only the requested consolidated first and second sections", () => {
    expect(data.basis).toBe("consolidated-simple-average");
    expect(data.sourcePage).toBe("https://www.jpx.co.jp/markets/statistics-equities/misc/04.html");
    expect(data.sourceSheet).toBe("Consolidated(AVG)～202203");
    expect(data.sourceColumns).toEqual({ first: { per: "I", pbr: "J" }, second: { per: "N", pbr: "O" } });
    expect(data.markets).toEqual([{ id: "first", label: "市場第一部" }, { id: "second", label: "市場第二部" }]);
    expect(data.dashPolicy).toBe("zero");
    expect(data.blankPolicy).toBe("null");
    expect(new Set(data.observations.map(row => `${row.month}:${row.market}`)).size).toBe(data.observations.length);
    for (const row of data.observations) {
      expect(["first", "second"]).toContain(row.market);
      expect(row.month <= "2022-03").toBe(true);
      expect([row.per, row.pbr].every(value => value === null || (Number.isFinite(value) && value >= 0))).toBe(true);
    }
    expect(data.observations[0].month).toBe("1999-01");
  });
  it("matches the original columns and converts a published dash to zero", () => {
    const observation = (month: string, market: string) => data.observations.find(row => row.month === month && row.market === market);
    expect(observation("1999-12", "first")).toMatchObject({ per: 0, pbr: 1.5 });
    expect(observation("1999-12", "second")).toMatchObject({ per: 208.9, pbr: 1.4 });
    expect(observation("2003-12", "first")).toMatchObject({ per: 96.7, pbr: 1.2 });
    expect(observation("2003-12", "second")).toMatchObject({ per: 66.4, pbr: 0.8 });
    expect(data.observations.filter(row => row.per !== null || row.pbr !== null).at(-1)?.month).toBe("2022-03");
  });
  it("places monetary policy before bank lending", () => {
    expect(chartGroups.slice(0, 3).map(group => group.title)).toEqual(["株価評価指標", "日本銀行の金融政策", "金利と国内銀行の貸出残高"]);
  });
});
