import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.env.REPORTBANK_DATA_ROOT || process.cwd();
const read = name => JSON.parse(fs.readFileSync(path.join(root, "lib/reports/data", name), "utf8"));
const trade = read("trade.json");
const fdi = read("fdi-stock.json");
const evidenceHash = createHash("sha256").update(JSON.stringify({
  trade: { firstMonth: trade.firstMonth, latestMonth: trade.latestMonth, charts: trade.charts },
  fdi: { firstYear: fdi.firstYear, latestYear: fdi.latestYear, categories: fdi.categories, points: fdi.points },
})).digest("hex");
const previous = read("trade-insight.json");
if (previous.evidenceHash !== evidenceHash) {
  const exp = trade.charts[0].points.at(-1).total / 1e6;
  const imp = trade.charts[1].points.at(-1).total / 1e6;
  const difference = exp - imp;
  const period = `${trade.latestMonth.slice(0, 4)}年${Number(trade.latestMonth.slice(5))}月`;
  const balance = difference === 0 ? "収支は均衡" : `差額は${Math.abs(difference).toFixed(2)}兆円の${difference > 0 ? "黒字" : "赤字"}`;
  const summary = `${period}の輸出は${exp.toFixed(2)}兆円、輸入は${imp.toFixed(2)}兆円で、${balance}。輸出先の首位は${trade.charts[0].categories[0]}、輸入元の首位は${trade.charts[1].categories[0]}。品目別では輸出は${trade.charts[2].categories[0]}、輸入は${trade.charts[3].categories[0]}が最大。最新月の順位を全期間で固定している。金額は名目値で価格・為替変動を含む。${fdi.latestYear}年末の対外直接投資残高は${(fdi.points.at(-1).total / 1e6).toFixed(2)}兆米ドルで、月次貿易とは期間・通貨が異なる年末資産残高。`;
  if ([...summary].length > 400) throw new Error("Trade summary exceeds 400 characters");
  fs.writeFileSync(path.join(root, "lib/reports/data/trade-insight.json"), JSON.stringify({
    summary, generatedAt: new Date().toISOString(), model: "statistical-template", evidenceHash,
  }, null, 2) + "\n");
}
