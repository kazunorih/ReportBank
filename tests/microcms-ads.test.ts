import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  publishMicroCmsRevision,
  updateMicroCmsDraft,
} from "@/lib/microcms-ads";
import type { AdContract } from "@/lib/ads/types";

const ad: AdContract = {
  advertiserId: "advertiser-1",
  adId: "ad-1",
  title: "修正版タイトル",
  companyName: "会社",
  body: "1行目\n2行目",
  status: "under_review",
  paymentStatus: "paid",
  monthlyAmount: 50000,
  microCmsContentId: "content-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("microCMS広告記事の修正", () => {
  beforeEach(() => {
    vi.stubEnv("MICROCMS_SERVICE_ID", "service");
    vi.stubEnv("MICROCMS_ADS_WRITE_API_KEY", "write-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("修正版を公開内容とは分離した下書きとして保存する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await updateMicroCmsDraft(ad);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://service.microcms.io/api/v1/articles/content-1?status=draft",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("承認時は修正版を公開内容へ反映する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await publishMicroCmsRevision(ad);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://service.microcms.io/api/v1/articles/content-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          title: "修正版タイトル",
          content: "1行目<br>2行目",
        }),
      }),
    );
  });
});
