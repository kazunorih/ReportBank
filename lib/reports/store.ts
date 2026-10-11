import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/lib/aws/clients";
import { reportSchema, summarySchema } from "./schema";

export async function getWeeklyReports(before?: string) {
  const TableName = process.env.WEEKLY_REPORTS_TABLE_NAME?.trim();
  if (!TableName) return { report: null, history: [], nextCursor: undefined, stale: false };
  const cursor = before && /^\d{4}-\d{2}-\d{2}$/.test(before) ? before : undefined;
  const [latest, history] = await Promise.all([
    dynamoClient.send(new GetCommand({ TableName, Key: { pk: "REPORT", sk: "LATEST" }, ConsistentRead: true })),
    dynamoClient.send(new QueryCommand({
      TableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk AND sk < :before",
      ExpressionAttributeValues: { ":pk": "HISTORY", ":before": cursor || "9999-12-31" },
      ScanIndexForward: false, Limit: 20,
    })),
  ]);
  const report = latest.Item ? reportSchema.parse(latest.Item.report) : null;
  return {
    report,
    history: (history.Items || []).map((item) => summarySchema.parse(item)),
    nextCursor: history.LastEvaluatedKey?.sk as string | undefined,
    stale: !!report && Date.now() - new Date(report.generatedAt).getTime() > 8 * 86400000,
  };
}
