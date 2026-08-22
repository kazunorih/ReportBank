"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { adInputSchema, sanitizeAdBody } from "@/lib/ads/validation";
import { requireUser } from "@/lib/auth/session";
import { createDraft, getAd, releaseEarlyReservation, reserveEarlyPrice, updateAdStatus } from "@/lib/db/ads";
import { getStripe, stripePrice } from "@/lib/stripe/client";

export type AdFormState = { error?: string };

export async function createAdAction(_state: AdFormState, formData: FormData): Promise<AdFormState> {
  const user = await requireUser();
  const parsed = adInputSchema.safeParse({ title: formData.get("title"), companyName: formData.get("companyName"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const adId = randomUUID();
  await createDraft({ advertiserId: user.id, adId, title: parsed.data.title, companyName: parsed.data.companyName, body: sanitizeAdBody(parsed.data.body) });
  redirect(`/advertiser/ads/${adId}`);
}

export async function startCheckoutAction(formData: FormData) {
  const user = await requireUser();
  const adId = String(formData.get("adId") ?? "");
  const ad = await getAd(user.id, adId);
  if (!ad || ad.status !== "draft") throw new Error("決済できる原稿が見つかりません。");
  const reservationId = randomUUID();
  const early = await reserveEarlyPrice(user.id, adId, reservationId);
  const tier = early ? "early" : "standard";
  const amount = early ? 5000 : 50000;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
  let session;
  try {
    session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: [{ price: stripePrice(tier), quantity: 1 }],
    success_url: `${appUrl}/advertiser/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/advertiser/ads/${adId}?checkout=cancelled`,
    client_reference_id: adId,
    expires_at: expiresAt,
    metadata: { advertiserId: user.id, adId, reservationId, priceTier: tier },
    subscription_data: { metadata: { advertiserId: user.id, adId, reservationId, priceTier: tier } },
    }, { idempotencyKey: `checkout-${adId}-${reservationId}` });
  } catch (error) {
    if (early) await releaseEarlyReservation(reservationId);
    throw error;
  }
  await updateAdStatus(user.id, adId, "draft", "unpaid", { stripeCheckoutSessionId: session.id, stripePriceId: stripePrice(tier), priceTier: tier, monthlyAmount: amount });
  if (!session.url) throw new Error("Stripe Checkout URLを作成できませんでした。");
  redirect(session.url);
}

export async function openCancellationPortalAction(formData: FormData) {
  const user = await requireUser();
  const adId = String(formData.get("adId") ?? "");
  const ad = await getAd(user.id, adId);
  if (
    !ad?.stripeCustomerId ||
    !ad.stripeSubscriptionId ||
    !["under_review", "published", "payment_failed"].includes(ad.status)
  ) {
    throw new Error("解約対象の契約が見つかりません。");
  }

  // URLのadIdだけでは操作せず、Stripe上でもこの広告に紐づく契約か検証する。
  const subscription = await getStripe().subscriptions.retrieve(ad.stripeSubscriptionId);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  if (
    customerId !== ad.stripeCustomerId ||
    subscription.metadata.advertiserId !== user.id ||
    subscription.metadata.adId !== ad.adId
  ) {
    throw new Error("契約情報を確認できませんでした。");
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const returnUrl = `${appUrl}/advertiser/ads/${ad.adId}`;
  const portal = await getStripe().billingPortal.sessions.create({
    customer: ad.stripeCustomerId,
    return_url: returnUrl,
    flow_data: {
      type: "subscription_cancel",
      subscription_cancel: { subscription: ad.stripeSubscriptionId },
      after_completion: {
        type: "redirect",
        redirect: { return_url: returnUrl },
      },
    },
  });

  redirect(portal.url);
}
