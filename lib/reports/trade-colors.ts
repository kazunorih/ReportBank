// Colors belong to the country/port, independently of its ranking in a chart.
const otherColor = "#cbd5e1";
const countryAliases: Record<string, string> = {
  "米国": "アメリカ合衆国",
  "アメリカ": "アメリカ合衆国",
  "中国": "中華人民共和国",
  "韓国": "大韓民国",
  "英国": "イギリス",
};
const countryColors: Record<string, string> = {
  "中華人民共和国": "#7bb9e5",
  "アメリカ合衆国": "#73c9b3",
  "台湾": "#b6a0df",
  "大韓民国": "#edc278",
  "香港": "#eca9ad",
  "タイ": "#82a6b1",
  "シンガポール": "#b7c98a",
  "インド": "#d8ad88",
  "オーストラリア": "#e78ac3",
  "ベトナム": "#8da0cb",
  "サウジアラビア": "#e6ab02",
  "オランダ": "#66a61e",
  "イギリス": "#7570b3",
  "スイス": "#a6761d",
};
const portColors: Record<string, string> = {
  "成田空港": "#7bb9e5",
  "名古屋港": "#73c9b3",
  "横浜港": "#b6a0df",
  "関西空港": "#edc278",
  "東京港": "#eca9ad",
  "神戸港": "#82a6b1",
  "大阪港": "#b7c98a",
  "博多港": "#d8ad88",
  "千葉港": "#e78ac3",
};

function fallbackColor(name: string) {
  // Newly ranked categories also keep their color across figures and updates.
  let hash = 0;
  for (const character of name) hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  return `hsl(${hash % 360} 45% 58%)`;
}

export function countryColor(name: string) {
  const normalized = name.normalize("NFKC").trim();
  const country = countryAliases[normalized] ?? normalized;
  return country === "その他" ? otherColor : countryColors[country] ?? fallbackColor(country);
}

export function portColor(name: string) {
  const port = name.normalize("NFKC").trim();
  return port === "その他" ? otherColor : portColors[port] ?? fallbackColor(port);
}
