import { afterEach, describe, expect, it } from "vitest";

import { buildAdminReviewNotification } from "@/lib/notifications/admin";
import type { AdContract } from "@/lib/ads/types";

const ad: AdContract = {
  advertiserId: "user+admin@example.com",
  adId: "ad/123",
  title: "新商品のご案内",
  body: "本文",
  companyName: "株式会社サンプル",
  status: "under_review",
  paymentStatus: "paid",
  monthlyAmount: 50000,
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
};

describe("buildAdminReviewNotification", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("審査に必要な情報と管理画面へのリンクを含める", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://reportbankwebsite.com/";

    const notification = buildAdminReviewNotification(ad);

    expect(notification.subject).toContain("審査依頼");
    expect(notification.message).toContain("株式会社サンプル");
    expect(notification.message).toContain("新商品のご案内");
    expect(notification.message).toContain("支払い状況: 支払い済み");
    expect(notification.message).toContain(
      "https://reportbankwebsite.com/admin/ads/ad%2F123?advertiserId=user%2Badmin%40example.com",
    );
  });
});
