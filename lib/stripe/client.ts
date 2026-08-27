import Stripe from "stripe";

let stripeClient: Stripe | undefined;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEYが設定されていません。");
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

export function stripePrice() {
  const value = process.env.STRIPE_STANDARD_PRICE_ID?.trim();
  if (!value) throw new Error("STRIPE_STANDARD_PRICE_IDが設定されていません。");
  return value;
}
