import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

import type { AdContract } from "@/lib/ads/types";

const snsClient = new SNSClient({
  region:
    process.env.APP_AWS_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "ap-northeast-1",
});

function topicArn() {
  const value = process.env.ADMIN_NOTIFICATION_TOPIC_ARN?.trim();
  if (!value) {
    throw new Error("ADMIN_NOTIFICATION_TOPIC_ARNが設定されていません。");
  }
  return value;
}

export function buildAdminReviewNotification(ad: AdContract) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const reviewUrl = `${appUrl}/admin/ads/${encodeURIComponent(ad.adId)}?advertiserId=${encodeURIComponent(ad.advertiserId)}`;

  return {
    subject: "[ReportBank] 新しい広告記事の審査依頼",
    message: [
      "支払いが完了し、広告記事が審査待ちになりました。",
      "",
      `会社名: ${ad.companyName}`,
      `記事タイトル: ${ad.title}`,
      `広告ID: ${ad.adId}`,
      "支払い状況: 支払い済み",
      "掲載状況: 審査待ち",
      "",
      `管理画面: ${reviewUrl}`,
    ].join("\n"),
  };
}

export async function notifyAdminOfReview(ad: AdContract) {
  const notification = buildAdminReviewNotification(ad);
  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn(),
      Subject: notification.subject,
      Message: notification.message,
    }),
  );
}
