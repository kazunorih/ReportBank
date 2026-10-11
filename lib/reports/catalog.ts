export const seriesCatalog = [
  { id: "jgb3", label: "国債3年", unit: "%", group: "markets" },
  { id: "jgb10", label: "国債10年", unit: "%", group: "markets" },
  { id: "jgb30", label: "国債30年", unit: "%", group: "markets" },
  { id: "flat35", label: "フラット35", unit: "%", group: "markets" },
  { id: "nikkei225", label: "日経平均株価", unit: "円", group: "markets" },
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
export const chartGroups = [
  { id: "markets", title: "金利と日経平均株価", description: "左軸：日経平均株価（円） ／ 右軸：国債・住宅ローン金利（%）" },
  { id: "equities", title: "株式市場の時価総額", description: "東京証券取引所の内国株式。全国の取引所の合算ではありません。市場再編による対象範囲の変更にご留意ください。" },
  { id: "construction", title: "建設工事受注高", description: "全国の建設工事受注動態統計。各半期の6か月合計。大手50社調査とは区別しています。" },
  { id: "lending", title: "民間金融機関の貸出と国債保有", description: "資金循環統計の預金取扱機関（国内銀行・信用金庫等）。企業は民間非金融法人、個人は家計、公共団体は地方公共団体。貸出と証券保有を分けた棒グラフです。" },
  { id: "boj", title: "日本銀行の総資産と国債保有", description: "日本銀行勘定の月末残高。国債保有は総資産の内数です。" },
] as const;
