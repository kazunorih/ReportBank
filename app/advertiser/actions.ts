"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { adInputSchema, sanitizeAdBody } from "@/lib/ads/validation";
import { requireUser } from "@/lib/auth/session";
import { createDraft, getAd, submitAdRevision, updateAdStatus } from "@/lib/db/ads";
import { updateMicroCmsDraft } from "@/lib/microcms-ads";
import { getStripe, stripePrice } from "@/lib/stripe/client";

export type AdFormState = { error?: string };

export type AdRevisionFormState = { error?: string };

export async function createAdAction(_state: AdFormState, formData: FormData): Promise<AdFormState> {
  const user = await requireUser();
  const parsed = adInputSchema.safeParse({ title: formData.get("title"), companyName: formData.get("companyName"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  const adId = randomUUID();
  await createDraft({ advertiserId: user.id, adId, title: parsed.data.title, companyName: parsed.data.companyName, body: sanitizeAdBody(parsed.data.body) });
  redirect(`/advertiser/ads/${adId}`);
}

export async function submitAdRevisionAction(
  _state: AdRevisionFormState,
  formData: FormData,
): Promise<AdRevisionFormState> {
  const user = await requireUser();
  const adId = String(formData.get("adId") ?? "");
  const parsed = adInputSchema.safeParse({
    title: formData.get("title"),
    companyName: formData.get("companyName"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    };
  }

  // 広告主IDをフォームから受け取らず、ログイン中の所有者IDで取得する。
  const ad = await getAd(user.id, adId);
  if (
    !ad ||
    !["under_review", "published"].includes(ad.status) ||
    ad.paymentStatus !== "paid" ||
    !ad.microCmsContentId
  ) {
    return { error: "修正版を提出できる広告記事が見つかりません。" };
  }

  const revision = {
    title: parsed.data.title,
    companyName: parsed.data.companyName,
    body: sanitizeAdBody(parsed.data.body),
  };

  try {
    // 公開中コンテンツは維持し、修正版をmicroCMSの下書きとして保存する。
    await updateMicroCmsDraft({ ...ad, ...revision });
    await submitAdRevision(user.id, ad.adId, revision);
  } catch (error) {
    console.error("広告記事の修正版を提出できませんでした。", error);
    return {
      error: "修正版を提出できませんでした。しばらくしてからもう一度お試しください。",
    };
  }

  revalidatePath("/advertiser");
  revalidatePath(`/advertiser/ads/${ad.adId}`);
  revalidatePath("/admin/ads");
  revalidatePath(`/admin/ads/${ad.adId}`);
  redirect(`/advertiser/ads/${ad.adId}?revision=submitted`);
}

export async function startCheckoutAction(formData: FormData) {
  const user = await requireUser();
  const adId = String(formData.get("adId") ?? "");
  const ad = await getAd(user.id, adId);
  if (!ad || ad.status !== "draft") throw new Error("決済できる原稿が見つかりません。");
  const checkoutId = randomUUID();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: [{ price: stripePrice(), quantity: 1 }],
    success_url: `${appUrl}/advertiser/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/advertiser/ads/${adId}?checkout=cancelled`,
    client_reference_id: adId,
    expires_at: expiresAt,
    metadata: { advertiserId: user.id, adId },
    subscription_data: { metadata: { advertiserId: user.id, adId } },
    }, { idempotencyKey: `checkout-${adId}-${checkoutId}` });
  await updateAdStatus(user.id, adId, "draft", "unpaid", { stripeCheckoutSessionId: session.id, stripePriceId: stripePrice(), monthlyAmount: 50000 });
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
