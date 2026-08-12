import type Stripe from "stripe";
import { completeEarlyReservation, completeStripeEvent, getAd, recordStripeEvent, releaseEarlyReservation, updateAdStatus } from "@/lib/db/ads";
import { changeMicroCmsStatus, upsertMicroCmsDraft } from "@/lib/microcms-ads";
import { getStripe } from "@/lib/stripe/client";

type Metadata = { advertiserId?: string; adId?: string; reservationId?: string; priceTier?: string };

async function subscriptionFromInvoice(invoice: Stripe.Invoice) {
  const parent = invoice.parent as { subscription_details?: { subscription?: string | Stripe.Subscription } } | null;
  const value = parent?.subscription_details?.subscription;
  const id = typeof value === "string" ? value : value?.id;
  return id ? getStripe().subscriptions.retrieve(id) : null;
}

async function paid(subscription: Stripe.Subscription, invoiceId?: string) {
  const metadata = subscription.metadata as Metadata;
  if (!metadata.advertiserId || !metadata.adId) throw new Error("Stripe metadataが不足しています。");
  const ad = await getAd(metadata.advertiserId, metadata.adId);
  if (!ad) throw new Error("広告契約が見つかりません。");
  const contentId = await upsertMicroCmsDraft(ad);
  const periodEnd = subscription.items.data[0]?.current_period_end;
  await updateAdStatus(metadata.advertiserId, metadata.adId, ad.status === "published" ? "published" : "under_review", "paid", {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    microCmsContentId: contentId,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    lastPaidInvoiceId: invoiceId,
  });
  if (metadata.reservationId && metadata.priceTier === "early") await completeEarlyReservation(metadata.reservationId);
}

export async function processStripeEvent(event: Stripe.Event) {
  if (!(await recordStripeEvent(event.id, event.type))) return;
  try {
    if (event.type === "checkout.session.expired") {
      const metadata = event.data.object.metadata as Metadata | null;
      if (metadata?.reservationId && metadata.priceTier === "early") await releaseEarlyReservation(metadata.reservationId);
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const metadata = session.metadata as Metadata | null;
      if (metadata?.advertiserId && metadata.adId) await updateAdStatus(metadata.advertiserId, metadata.adId, "draft", "unpaid", { stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id, stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id });
    }
    if (event.type === "invoice.paid") {
      const subscription = await subscriptionFromInvoice(event.data.object);
      if (subscription) await paid(subscription, event.data.object.id);
    }
    if (event.type === "invoice.payment_failed") {
      const subscription = await subscriptionFromInvoice(event.data.object);
      const metadata = subscription?.metadata as Metadata | undefined;
      if (metadata?.advertiserId && metadata.adId) await updateAdStatus(metadata.advertiserId, metadata.adId, "payment_failed", "past_due", { stripeSubscriptionId: subscription?.id });
    }
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object; const metadata = subscription.metadata as Metadata;
      if (metadata.advertiserId && metadata.adId && subscription.cancel_at_period_end) {
        const periodEnd = subscription.items.data[0]?.current_period_end;
        await updateAdStatus(metadata.advertiserId, metadata.adId, "cancellation_scheduled", "cancellation_scheduled", { cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined });
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object; const metadata = subscription.metadata as Metadata;
      if (metadata.advertiserId && metadata.adId) {
        const ad = await getAd(metadata.advertiserId, metadata.adId);
        if (ad?.microCmsContentId && ["published", "cancellation_scheduled", "payment_failed"].includes(ad.status)) await changeMicroCmsStatus(ad.microCmsContentId, "DRAFT");
        await updateAdStatus(metadata.advertiserId, metadata.adId, "ended", "ended", { endedAt: new Date().toISOString(), cancelAtPeriodEnd: false });
      }
    }
    await completeStripeEvent(event.id);
  } catch (error) {
    await completeStripeEvent(event.id, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
