export type CognitoOperation = "register" | "confirm" | "login";

export function cognitoErrorMessage(
  error: unknown,
  operation: CognitoOperation,
) {
  if (!(error instanceof Error)) return "処理に失敗しました。";

  const detail = error.message.toLowerCase();

  if (error.name === "UsernameExistsException") {
    return "このメールアドレスは登録済みです。ログインするか、未確認の場合は確認コードを入力してください。";
  }
  if (error.name === "InvalidPasswordException") {
    return "パスワードがCognitoのパスワード条件を満たしていません。文字数や必要な文字種を確認してください。";
  }
  if (error.name === "CodeMismatchException") {
    return "確認コードが違います。";
  }
  if (error.name === "ExpiredCodeException") {
    return "確認コードの有効期限が切れています。新しい確認コードを取得してください。";
  }
  if (error.name === "LimitExceededException" || error.name === "TooManyRequestsException") {
    return "Cognitoの送信または操作回数の上限に達しました。時間を空けてもう一度お試しください。";
  }
  if (error.name === "CodeDeliveryFailureException") {
    return "確認メールを送信できませんでした。Cognitoのメール送信設定を確認してください。";
  }
  if (error.name === "ResourceNotFoundException") {
    return "Cognitoのリージョン、ユーザープール、アプリクライアントの設定が一致していません。";
  }
  if (error.name === "NotAuthorizedException") {
    if (operation === "register" && detail.includes("secret hash")) {
      return "Cognitoアプリクライアントにシークレットが設定されています。シークレットなしのアプリクライアントを使用してください。";
    }
    if (
      operation === "register" &&
      (detail.includes("sign up") || detail.includes("signup"))
    ) {
      return "Cognitoユーザープールで自己登録が無効になっています。自己登録を有効にしてください。";
    }
    if (operation === "login") {
      return "メールアドレスまたはパスワードが違うか、メール確認が完了していません。";
    }
    return "Cognitoがこの操作を許可していません。ユーザープールとアプリクライアントの設定を確認してください。";
  }
  if (error.name === "InvalidParameterException") {
    return "登録情報またはCognitoの必須属性設定が正しくありません。";
  }

  return "認証処理に失敗しました。時間を空けても直らない場合は運営者へお問い合わせください。";
}
