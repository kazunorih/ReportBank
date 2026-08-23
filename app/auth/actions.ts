"use server";

import {
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { cognitoClient } from "@/lib/aws/clients";
import {
  cognitoErrorMessage,
  type CognitoOperation,
} from "@/lib/auth/cognito-errors";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/session";

export type AuthState = { error?: string };

const PENDING_EMAIL_COOKIE = "reportbank_pending_email";
const RESET_EMAIL_COOKIE = "reportbank_reset_email";

function clientId() {
  const value = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID?.trim();
  if (!value) throw new Error("Cognito App Client IDが設定されていません。");
  return value;
}

function authFailure(error: unknown, operation: CognitoOperation): AuthState {
  const awsError = error as Error & { $metadata?: { requestId?: string } };
  console.error("Cognito認証処理に失敗しました。", {
    operation,
    name: awsError?.name,
    message: awsError?.message,
    requestId: awsError?.$metadata?.requestId,
  });
  return { error: cognitoErrorMessage(error, operation) };
}

async function rememberPendingEmail(email: string) {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 30 * 60,
  });
}

async function resendConfirmationCode(email: string) {
  await cognitoClient.send(new ResendConfirmationCodeCommand({
    ClientId: clientId(),
    Username: email,
  }));
  await rememberPendingEmail(email);
}

export async function registerAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) return { error: "メールアドレスと8文字以上のパスワードを入力してください。" };
  try {
    await cognitoClient.send(new SignUpCommand({ ClientId: clientId(), Username: email, Password: password, UserAttributes: [{ Name: "email", Value: email }] }));
  } catch (error) {
    if (error instanceof Error && error.name === "UsernameExistsException") {
      try {
        await resendConfirmationCode(email);
      } catch (resendError) {
        if (
          resendError instanceof Error &&
          resendError.name === "InvalidParameterException" &&
          resendError.message.toLowerCase().includes("confirmed")
        ) {
          return { error: "このメールアドレスは確認済みです。登録時のパスワードでログインしてください。" };
        }
        return authFailure(resendError, "register");
      }
      redirect("/auth/confirm");
    }
    return authFailure(error, "register");
  }
  await rememberPendingEmail(email);
  redirect("/auth/confirm");
}

export async function confirmAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const cookieStore = await cookies();
  const email = String(
    cookieStore.get(PENDING_EMAIL_COOKIE)?.value ?? formData.get("email") ?? "",
  ).trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  if (!email) return { error: "登録情報の有効期限が切れました。新規登録からやり直してください。" };
  try { await cognitoClient.send(new ConfirmSignUpCommand({ ClientId: clientId(), Username: email, ConfirmationCode: code })); }
  catch (error) { return authFailure(error, "confirm"); }
  cookieStore.delete(PENDING_EMAIL_COOKIE);
  redirect("/auth/login?confirmed=1");
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  try {
    const result = await cognitoClient.send(new InitiateAuthCommand({ AuthFlow: "USER_PASSWORD_AUTH", ClientId: clientId(), AuthParameters: { USERNAME: email, PASSWORD: password } }));
    if (!result.AuthenticationResult?.IdToken) return { error: "追加の認証操作が必要です。" };
    await setAuthCookies({ idToken: result.AuthenticationResult.IdToken, accessToken: result.AuthenticationResult.AccessToken, refreshToken: result.AuthenticationResult.RefreshToken });
  } catch (error) {
    if (error instanceof Error && error.name === "UserNotConfirmedException") {
      try {
        await resendConfirmationCode(email);
      } catch (resendError) {
        return authFailure(resendError, "login");
      }
      redirect("/auth/confirm");
    }
    return authFailure(error, "login");
  }
  redirect("/advertiser");
}

export async function forgotPasswordAction(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "メールアドレスを入力してください。" };

  try {
    await cognitoClient.send(new ForgotPasswordCommand({
      ClientId: clientId(),
      Username: email,
    }));
  } catch (error) {
    // ユーザーの存在を推測できる応答は避けつつ、設定・送信障害は表示する。
    if (
      !(error instanceof Error) ||
      (error.name !== "UserNotFoundException" &&
        error.name !== "NotAuthorizedException")
    ) {
      return authFailure(error, "forgot-password");
    }
  }

  (await cookies()).set(RESET_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 30 * 60,
  });
  redirect("/auth/reset-password");
}

export async function resetPasswordAction(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const cookieStore = await cookies();
  const email = cookieStore.get(RESET_EMAIL_COOKIE)?.value?.trim().toLowerCase() ?? "";
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) {
    return { error: "再設定情報の有効期限が切れました。最初からやり直してください。" };
  }
  if (!code || password.length < 8) {
    return { error: "確認コードと条件を満たす新しいパスワードを入力してください。" };
  }

  try {
    await cognitoClient.send(new ConfirmForgotPasswordCommand({
      ClientId: clientId(),
      Username: email,
      ConfirmationCode: code,
      Password: password,
    }));
  } catch (error) {
    return authFailure(error, "reset-password");
  }

  cookieStore.delete(RESET_EMAIL_COOKIE);
  redirect("/auth/login?reset=1");
}

export async function logoutAction() {
  await clearAuthCookies();
  redirect("/");
}
