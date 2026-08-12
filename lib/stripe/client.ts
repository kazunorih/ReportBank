import Stripe from "stripe";

let stripeClient: Stripe | undefined;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEYが設定されていません。");
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

export function stripePrice(tier: "early" | "standard") {
  const name = tier === "early" ? "STRIPE_EARLY_PRICE_ID" : "STRIPE_STANDARD_PRICE_ID";
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}が設定されていません。`);
  return value;
}
