import snapshot from "./data/trade.json";

export type TradeChart = {
  id: string;
  title: string;
  categories: string[];
  points: { month: string; values: number[]; total: number }[];
};

// Original amounts are retained as integer millions of yen. Convert only for display.
export const tradeData = snapshot;
export const tradeMonth = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
