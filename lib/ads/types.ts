export const AD_STATUSES = [
  "draft",
  "under_review",
  "published",
  "cancellation_scheduled",
  "ended",
  "payment_failed",
] as const;

export type AdStatus = (typeof AD_STATUSES)[number];
export type PaymentStatus =
  | "unpaid"
  | "paid"
  | "past_due"
  | "cancellation_scheduled"
  | "ended";

export type AdContract = {
  advertiserId: string;
  adId: string;
  title: string;
  body: string;
  companyName: string;
  status: AdStatus;
  paymentStatus: PaymentStatus;
  monthlyAmount: 5000 | 50000;
  priceTier: "early" | "standard";
  stripeCheckoutSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  microCmsContentId?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  cancellationRequestedAt?: string;
  publishedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export const STATUS_LABELS: Record<AdStatus, string> = {
  draft: "入力中・決済前",
  under_review: "審査待ち",
  published: "掲載中",
  cancellation_scheduled: "掲載終了予約済み",
  ended: "掲載終了",
  payment_failed: "支払い失敗",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "未払い",
  paid: "支払い済み",
  past_due: "支払い確認が必要",
  cancellation_scheduled: "契約終了予約済み",
  ended: "契約終了",
};
