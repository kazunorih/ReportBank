import sanitizeHtml from "sanitize-html";
import { z } from "zod";

export const adInputSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください。 ").max(100),
  companyName: z.string().trim().min(1, "会社名を入力してください。").max(100),
  body: z.string().trim().min(1, "本文を入力してください。").max(3000, "本文は3,000字以内で入力してください。"),
});

export function sanitizeAdBody(body: string) {
  return sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} }).trim();
}
