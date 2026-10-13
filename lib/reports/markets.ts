import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/lib/aws/clients";
import snapshot from "./data/markets.json";
import { marketChartSchema } from "./schema";

export async function getMarketChart() {
  const TableName = process.env.WEEKLY_REPORTS_TABLE_NAME?.trim();
  if (TableName) {
    const result = await dynamoClient.send(new GetCommand({
      TableName, Key: { pk: "CHART", sk: "MARKETS" }, ConsistentRead: true,
    }));
    // A stored bank/minimum-rate chart must not acquire the new midpoint label.
    if (result.Item?.chart?.summaryScope === "four-figures-v1" && result.Item.chart.flat35Method === "range-midpoint-v1" && result.Item.chart.topixMethod === "annual-close-v1") return marketChartSchema.parse(result.Item.chart);
  }
  return marketChartSchema.parse(snapshot);
}
