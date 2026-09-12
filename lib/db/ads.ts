import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import type { AdContract, AdStatus, PaymentStatus } from "@/lib/ads/types";
import { dynamoClient } from "@/lib/aws/clients";

function tableName() {
  const value = process.env.ADS_TABLE_NAME?.trim();
  if (!value) throw new Error("ADS_TABLE_NAMEが設定されていません。");
  return value;
}

const adKey = (advertiserId: string, adId: string) => ({ PK: `ADVERTISER#${advertiserId}`, SK: `AD#${adId}` });

export async function createDraft(input: Pick<AdContract, "advertiserId" | "adId" | "title" | "body" | "companyName">) {
  const now = new Date().toISOString();
  const item: AdContract & Record<string, unknown> = {
    ...input,
    status: "draft",
    paymentStatus: "unpaid",
    monthlyAmount: 50000,
    createdAt: now,
    updatedAt: now,
    ...adKey(input.advertiserId, input.adId),
    GSI1PK: "STATUS#draft",
    GSI1SK: `${now}#${input.adId}`,
    entityType: "AD",
  };
  await dynamoClient.send(new PutCommand({ TableName: tableName(), Item: item, ConditionExpression: "attribute_not_exists(PK)" }));
  return item;
}

export async function getAd(advertiserId: string, adId: string) {
  const result = await dynamoClient.send(new GetCommand({ TableName: tableName(), Key: adKey(advertiserId, adId), ConsistentRead: true }));
  return (result.Item as AdContract | undefined) ?? null;
}

export async function listAdvertiserAds(advertiserId: string) {
  const result = await dynamoClient.send(new QueryCommand({
    TableName: tableName(),
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": `ADVERTISER#${advertiserId}`, ":sk": "AD#" },
    ScanIndexForward: false,
  }));
  return (result.Items ?? []) as AdContract[];
}

export async function listAdsByStatus(status: AdStatus) {
  const result = await dynamoClient.send(new QueryCommand({
    TableName: tableName(), IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk",
    ExpressionAttributeValues: { ":pk": `STATUS#${status}` },
    ScanIndexForward: false,
  }));
  return (result.Items ?? []) as AdContract[];
}

export async function updateAdStatus(advertiserId: string, adId: string, status: AdStatus, paymentStatus: PaymentStatus, values: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  const names: Record<string, string> = { "#status": "status", "#payment": "paymentStatus" };
  const attributes: Record<string, unknown> = { ":status": status, ":payment": paymentStatus, ":updated": now, ":gsi": `STATUS#${status}`, ":gsk": `${now}#${adId}` };
  const sets = ["#status = :status", "#payment = :payment", "updatedAt = :updated", "GSI1PK = :gsi", "GSI1SK = :gsk"];
  const removes: string[] = [];
  Object.entries(values).forEach(([key, value], index) => {
    names[`#v${index}`] = key;
    if (value === undefined) {
      removes.push(`#v${index}`);
    } else {
      attributes[`:v${index}`] = value;
      sets.push(`#v${index} = :v${index}`);
    }
  });
  const removeExpression = removes.length ? ` REMOVE ${removes.join(", ")}` : "";
  await dynamoClient.send(new UpdateCommand({ TableName: tableName(), Key: adKey(advertiserId, adId), UpdateExpression: `SET ${sets.join(", ")}${removeExpression}`, ExpressionAttributeNames: names, ExpressionAttributeValues: attributes, ConditionExpression: "attribute_exists(PK)" }));
}

export async function submitAdRevision(
  advertiserId: string,
  adId: string,
  input: Pick<AdContract, "title" | "body" | "companyName">,
) {
  const now = new Date().toISOString();
  await dynamoClient.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: adKey(advertiserId, adId),
      UpdateExpression:
        "SET title = :title, body = :body, companyName = :company, #status = :review, updatedAt = :updated, revisionSubmittedAt = :updated, GSI1PK = :gsi, GSI1SK = :gsk",
      ExpressionAttributeNames: {
        "#status": "status",
        "#payment": "paymentStatus",
      },
      ExpressionAttributeValues: {
        ":title": input.title,
        ":body": input.body,
        ":company": input.companyName,
        ":review": "under_review",
        ":published": "published",
        ":paid": "paid",
        ":updated": now,
        ":gsi": "STATUS#under_review",
        ":gsk": `${now}#${adId}`,
      },
      ConditionExpression:
        "attribute_exists(PK) AND (#status = :review OR #status = :published) AND #payment = :paid",
    }),
  );
}

export async function recordStripeEvent(eventId: string, eventType: string) {
  try {
    await dynamoClient.send(new PutCommand({ TableName: tableName(), Item: { PK: `STRIPE_EVENT#${eventId}`, SK: "EVENT", eventType, processingStatus: "processing", createdAt: new Date().toISOString() }, ConditionExpression: "attribute_not_exists(PK)" }));
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      try {
        await dynamoClient.send(new UpdateCommand({
          TableName: tableName(), Key: { PK: `STRIPE_EVENT#${eventId}`, SK: "EVENT" },
          UpdateExpression: "SET processingStatus = :processing, attemptCount = if_not_exists(attemptCount, :one) + :one",
          ConditionExpression: "processingStatus = :failed",
          ExpressionAttributeValues: { ":processing": "processing", ":failed": "failed", ":one": 1 },
        }));
        return true;
      } catch { return false; }
    }
    throw error;
  }
}

export async function completeStripeEvent(eventId: string, error?: string) {
  await dynamoClient.send(new UpdateCommand({ TableName: tableName(), Key: { PK: `STRIPE_EVENT#${eventId}`, SK: "EVENT" }, UpdateExpression: "SET processingStatus = :status, completedAt = :now, lastError = :error", ExpressionAttributeValues: { ":status": error ? "failed" : "completed", ":now": new Date().toISOString(), ":error": error ?? "" } }));
}
