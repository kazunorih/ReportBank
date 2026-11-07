import orders from "./data/machinery-orders.json";

type MonthlyOrder = { month: string; domestic: number; exports: number; total: number; sourceMonth: string };

export function annualMachineryOrders(points: MonthlyOrder[]) {
  return Array.from({ length: 7 }, (_, index) => {
    const year = 2020 + index;
    const monthCount = year === 2026 ? 8 : 12;
    const months = points.filter(point => point.month.startsWith(`${year}-`) && Number(point.month.slice(5)) <= monthCount).toSorted((a, b) => a.month.localeCompare(b.month));
    const expected = Array.from({ length: monthCount }, (_, month) => `${year}-${String(month + 1).padStart(2, "0")}`);
    if (months.length !== monthCount || months.some((point, month) => point.month !== expected[month])) {
      throw new Error(`Incomplete calendar year: ${year}`);
    }
    if (months.some(point => point.domestic + point.exports !== point.total)) throw new Error(`Inconsistent orders: ${year}`);
    return {
      year,
      months: monthCount,
      label: year === 2026 ? "2026年1～8月（8か月分）" : `${year}年`,
      domestic: months.reduce((sum, point) => sum + point.domestic, 0),
      exports: months.reduce((sum, point) => sum + point.exports, 0),
      total: months.reduce((sum, point) => sum + point.total, 0),
      sourceMonths: [...new Set(months.map(point => point.sourceMonth))].toSorted(),
    };
  });
}

export const annualOrders = annualMachineryOrders(orders.points);
