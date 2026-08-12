import { describe, expect, it } from "vitest";
import { adInputSchema, sanitizeAdBody } from "@/lib/ads/validation";

describe("広告原稿", () => {
  it("3,000字を受け付ける", () => {
    expect(adInputSchema.safeParse({ title: "広告", companyName: "会社", body: "あ".repeat(3000) }).success).toBe(true);
  });
  it("3,001字を拒否する", () => {
    expect(adInputSchema.safeParse({ title: "広告", companyName: "会社", body: "あ".repeat(3001) }).success).toBe(false);
  });
  it("入力HTMLを無害化する", () => {
    expect(sanitizeAdBody("本文<script>alert(1)</script>")).toBe("本文");
  });
});
