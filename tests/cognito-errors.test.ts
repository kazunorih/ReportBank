import { describe, expect, it } from "vitest";

import { cognitoErrorMessage } from "@/lib/auth/cognito-errors";

function cognitoError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe("Cognitoエラー表示", () => {
  it("新規登録禁止をパスワード違いとして表示しない", () => {
    const error = cognitoError(
      "NotAuthorizedException",
      "SignUp is not permitted for this user pool",
    );
    expect(cognitoErrorMessage(error, "register")).toContain("自己登録が無効");
  });

  it("シークレットハッシュ不足を特定する", () => {
    const error = cognitoError(
      "NotAuthorizedException",
      "Unable to verify secret hash for client",
    );
    expect(cognitoErrorMessage(error, "register")).toContain("シークレットなし");
  });

  it("ログイン時だけ認証情報の不一致を案内する", () => {
    const error = cognitoError(
      "NotAuthorizedException",
      "Incorrect username or password",
    );
    expect(cognitoErrorMessage(error, "login")).toContain("パスワード");
    expect(cognitoErrorMessage(error, "register")).not.toContain("パスワードが違う");
  });
});
