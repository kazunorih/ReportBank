import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

const ID_TOKEN_COOKIE = "reportbank_id_token";
const ACCESS_TOKEN_COOKIE = "reportbank_access_token";
const REFRESH_TOKEN_COOKIE = "reportbank_refresh_token";

export type CurrentUser = {
  id: string;
  email: string;
  isAdmin: boolean;
};

function cognitoConfig() {
  const region = process.env.COGNITO_AWS_REGION?.trim() || "ap-northeast-1";
  const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID?.trim();
  if (!userPoolId || !clientId) throw new Error("Cognitoの環境変数が設定されていません。");
  return { region, userPoolId, clientId };
}

export async function setAuthCookies(tokens: {
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
}) {
  const store = await cookies();
  const common = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  if (tokens.idToken) store.set(ID_TOKEN_COOKIE, tokens.idToken, { ...common, maxAge: 3600 });
  if (tokens.accessToken) store.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, { ...common, maxAge: 3600 });
  if (tokens.refreshToken) store.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, { ...common, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ID_TOKEN_COOKIE);
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}

async function verifyIdToken(token: string): Promise<JWTPayload> {
  const { region, userPoolId, clientId } = cognitoConfig();
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, { issuer });
  if (payload.token_use !== "id" || payload.aud !== clientId) throw new Error("無効なIDトークンです。");
  return payload;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(ID_TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await verifyIdToken(token);
    const groups = Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"] : [];
    return {
      id: String(payload.sub),
      email: String(payload.email ?? ""),
      isAdmin: groups.includes("admin"),
    };
  } catch {
    return null;
  }
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/advertiser");
  return user;
}
