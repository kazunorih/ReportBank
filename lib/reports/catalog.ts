export const seriesCatalog = [
  { id: "jgb3", label: "国債3年", unit: "%", group: "markets" },
  { id: "jgb10", label: "国債10年", unit: "%", group: "markets" },
  { id: "jgb30", label: "国債30年", unit: "%", group: "markets" },
  { id: "flat35", label: "フラット35（中間値）", unit: "%", group: "markets" },
  { id: "topix", label: "TOPIX", unit: "ポイント", group: "markets" },
  { id: "marketCap", label: "内国株式時価総額（東証）", unit: "兆円", group: "equities" },
  { id: "construction", label: "建設工事受注高", unit: "兆円", group: "construction" },
  { id: "corporateLoans", label: "民間非金融法人向け貸出", unit: "兆円", group: "lending" },
  { id: "householdLoans", label: "家計向け貸出", unit: "兆円", group: "lending" },
  { id: "bankJgb", label: "預金取扱機関の国債・財投債保有", unit: "兆円", group: "lending" },
  { id: "publicLoans", label: "地方公共団体向け貸出", unit: "兆円", group: "lending" },
  { id: "bojAssets", label: "日本銀行の総資産", unit: "兆円", group: "boj" },
  { id: "bojJgb", label: "日本銀行の国債保有", unit: "兆円", group: "boj" },
] as const;

export type SeriesId = (typeof seriesCatalog)[number]["id"];
export const lendingSeriesCatalog = [
  { id: "housingLoans", label: "住宅資金", unit: "兆円", group: "loanComparison" },
  { id: "otherLoans", label: "それ以外", unit: "兆円", group: "loanComparison" },
] as const;
export const chartGroups = [
  { id: "markets", title: "金利とTOPIX", description: "棒グラフ・左軸：TOPIXの年末終値（ポイント） ／ 折れ線・右軸：国債10年・30年、フラット35の金利（%、6月・12月）" },
  { id: "loanComparison", title: "金利と国内銀行の貸出残高", description: "積み上げ棒グラフ・左軸：住宅資金とそれ以外（兆円、合計は総貸出残高） ／ 折れ線・右軸：国債10年・30年、フラット35の金利（%）。" },
  { id: "bojComparison", title: "金利と日本銀行の資産", description: "積み上げ棒グラフ・左軸：日本国債とその他資産（兆円、3月末・9月末の帳簿価額） ／ 折れ線・右軸：国債10年・30年、フラット35の金利（%、6月末・12月末）。残高と金利の観測日は異なります。" },
  { id: "equities", title: "株式市場の時価総額", description: "東京証券取引所の内国株式。全国の取引所の合算ではありません。市場再編による対象範囲の変更にご留意ください。" },
  { id: "construction", title: "建設工事受注高", description: "全国の建設工事受注動態統計。各半期の6か月合計。大手50社調査とは区別しています。" },
  { id: "lending", title: "民間金融機関の貸出と国債保有", description: "資金循環統計の預金取扱機関（国内銀行・信用金庫等）。企業は民間非金融法人、個人は家計、公共団体は地方公共団体。貸出と証券保有を分けた棒グラフです。" },
  { id: "boj", title: "日本銀行の総資産と国債保有", description: "日本銀行勘定の月末残高。国債保有は総資産の内数です。" },
] as const;
