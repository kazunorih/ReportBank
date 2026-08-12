import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "@/lib/aws/clients";
import { getStripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const queueUrl = process.env.STRIPE_EVENTS_QUEUE_URL?.trim();
  if (!signature || !secret || !queueUrl) return Response.json({ error: "Webhook設定が不足しています。" }, { status: 500 });
  const rawBody = await request.text();
  let event;
  try { event = getStripe().webhooks.constructEvent(rawBody, signature, secret); }
  catch { return Response.json({ error: "署名を検証できません。" }, { status: 400 }); }
  await sqsClient.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(event), MessageGroupId: "stripe-events", MessageDeduplicationId: event.id }));
  return Response.json({ received: true });
}
