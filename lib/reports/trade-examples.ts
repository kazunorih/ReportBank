export const commodityExamples: Record<string, string[]> = {
  食料品: ["魚介類", "肉類", "穀物"],
  原料品: ["木材", "鉄鉱石", "大豆"],
  鉱物性燃料: ["原油", "液化天然ガス（LNG）", "石炭"],
  化学製品: ["医薬品", "プラスチック", "有機化合物"],
  原料別製品: ["鉄鋼", "非鉄金属（銅・アルミなど）", "紙・紙製品"],
  一般機械: ["パソコンなどの電算機類", "エンジンなどの原動機", "ポンプ"],
  電気機器: ["半導体（ICなど）", "通信機（電話機など）", "テレビ"],
  輸送用機器: ["自動車", "自動車部品", "船舶"],
};

export function examplesForCommodity(name: string, selected: string[]) {
  if (name !== "その他") return commodityExamples[name] ?? [];
  // Our residual includes unselected major groups as well as the published
  // "other" group; choose examples from the groups actually in the residual.
  const unselected = Object.entries(commodityExamples).filter(([category]) => !selected.includes(category));
  return [...unselected.map(([, examples]) => examples[0]), "科学光学機器"].slice(0, 3);
}
