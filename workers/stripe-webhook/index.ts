import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import type Stripe from "stripe";
import { processStripeEvent } from "../../lib/stripe/processor";

// Log only runtime metadata once per cold start so the deployed patch is verifiable.
console.info("ReportBank Node.js runtime", { component: "stripe-webhook", node: process.versions.node });

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const failures: { itemIdentifier: string }[] = [];
  for (const record of event.Records) {
    try { await processStripeEvent(JSON.parse(record.body) as Stripe.Event); }
    catch { failures.push({ itemIdentifier: record.messageId }); }
  }
  return { batchItemFailures: failures };
}
