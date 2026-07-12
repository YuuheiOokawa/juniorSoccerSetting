// ポジション定義 (全フォーメーション共通のマスタ)
export const POSITION_CODES = [
  "GK",
  "LDF",
  "CDF",
  "RDF",
  "DMF",
  "LMF",
  "CMF",
  "RMF",
  "OMF",
  "LFW",
  "RFW",
  "FW",
] as const;

export type PositionCode = (typeof POSITION_CODES)[number];

export const POSITION_MASTER: {
  code: PositionCode;
  name: string;
  category: "GK" | "DF" | "MF" | "FW";
  sortOrder: number;
}[] = [
  { code: "GK", name: "ゴールキーパー", category: "GK", sortOrder: 1 },
  { code: "LDF", name: "左ディフェンダー", category: "DF", sortOrder: 2 },
  { code: "CDF", name: "中央ディフェンダー", category: "DF", sortOrder: 3 },
  { code: "RDF", name: "右ディフェンダー", category: "DF", sortOrder: 4 },
  { code: "DMF", name: "ボランチ (守備的MF)", category: "MF", sortOrder: 5 },
  { code: "LMF", name: "左ミッドフィルダー", category: "MF", sortOrder: 6 },
  { code: "CMF", name: "中央ミッドフィルダー", category: "MF", sortOrder: 7 },
  { code: "RMF", name: "右ミッドフィルダー", category: "MF", sortOrder: 8 },
  { code: "OMF", name: "トップ下 (攻撃的MF)", category: "MF", sortOrder: 9 },
  { code: "LFW", name: "左フォワード", category: "FW", sortOrder: 10 },
  { code: "RFW", name: "右フォワード", category: "FW", sortOrder: 11 },
  { code: "FW", name: "フォワード", category: "FW", sortOrder: 12 },
];

export const CATEGORY_LABEL: Record<string, string> = {
  GK: "GK",
  DF: "DF",
  MF: "MF",
  FW: "FW",
};

// カテゴリ別カラー (ウイイレ風カードのポジションバッジ配色)
export const CATEGORY_COLORS: Record<
  string,
  { badge: string; ring: string; hex: string }
> = {
  GK: {
    badge:
      "bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-amber-950",
    ring: "ring-amber-400",
    hex: "#f59e0b",
  },
  DF: {
    badge: "bg-gradient-to-b from-sky-400 via-sky-500 to-sky-700 text-white",
    ring: "ring-sky-400",
    hex: "#0284c7",
  },
  MF: {
    badge:
      "bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-700 text-white",
    ring: "ring-emerald-400",
    hex: "#059669",
  },
  FW: {
    badge: "bg-gradient-to-b from-rose-400 via-rose-500 to-rose-700 text-white",
    ring: "ring-rose-400",
    hex: "#e11d48",
  },
};

export function categoryOf(code: PositionCode): "GK" | "DF" | "MF" | "FW" {
  return POSITION_MASTER.find((p) => p.code === code)?.category ?? "MF";
}

// ============================================================
// フォーメーション定義 (8人制)
// positions: 使用する8ポジション / layout: コート上の座標 (%)
// ============================================================

export interface FormationDef {
  key: string;
  label: string;
  positions: PositionCode[];
  layout: Partial<Record<PositionCode, { x: number; y: number }>>;
}

export const FORMATIONS: Record<string, FormationDef> = {
  "3-3-1": {
    key: "3-3-1",
    label: "3-3-1",
    positions: ["GK", "LDF", "CDF", "RDF", "LMF", "CMF", "RMF", "FW"],
    layout: {
      FW: { x: 50, y: 12 },
      LMF: { x: 22, y: 36 },
      CMF: { x: 50, y: 40 },
      RMF: { x: 78, y: 36 },
      LDF: { x: 22, y: 62 },
      CDF: { x: 50, y: 66 },
      RDF: { x: 78, y: 62 },
      GK: { x: 50, y: 87 },
    },
  },
  "2-3-2": {
    key: "2-3-2",
    label: "2-3-2",
    positions: ["GK", "LDF", "RDF", "LMF", "CMF", "RMF", "LFW", "RFW"],
    layout: {
      LFW: { x: 32, y: 13 },
      RFW: { x: 68, y: 13 },
      LMF: { x: 20, y: 38 },
      CMF: { x: 50, y: 42 },
      RMF: { x: 80, y: 38 },
      LDF: { x: 32, y: 65 },
      RDF: { x: 68, y: 65 },
      GK: { x: 50, y: 87 },
    },
  },
  "2-4-1-W": {
    key: "2-4-1-W",
    label: "2-4-1 (ボランチ横2枚)",
    positions: ["GK", "LDF", "RDF", "LMF", "DMF", "CMF", "RMF", "FW"],
    layout: {
      FW: { x: 50, y: 12 },
      LMF: { x: 15, y: 36 },
      DMF: { x: 38, y: 44 },
      CMF: { x: 62, y: 44 },
      RMF: { x: 85, y: 36 },
      LDF: { x: 32, y: 66 },
      RDF: { x: 68, y: 66 },
      GK: { x: 50, y: 87 },
    },
  },
  "2-4-1-V": {
    key: "2-4-1-V",
    label: "2-4-1 (ボランチ縦2枚)",
    positions: ["GK", "LDF", "RDF", "DMF", "LMF", "RMF", "OMF", "FW"],
    layout: {
      FW: { x: 50, y: 11 },
      OMF: { x: 50, y: 29 },
      LMF: { x: 17, y: 40 },
      RMF: { x: 83, y: 40 },
      DMF: { x: 50, y: 51 },
      LDF: { x: 32, y: 68 },
      RDF: { x: 68, y: 68 },
      GK: { x: 50, y: 88 },
    },
  },
  "3-2-2": {
    key: "3-2-2",
    label: "3-2-2",
    positions: ["GK", "LDF", "CDF", "RDF", "DMF", "CMF", "LFW", "RFW"],
    layout: {
      LFW: { x: 32, y: 13 },
      RFW: { x: 68, y: 13 },
      DMF: { x: 35, y: 40 },
      CMF: { x: 65, y: 40 },
      LDF: { x: 22, y: 65 },
      CDF: { x: 50, y: 69 },
      RDF: { x: 78, y: 65 },
      GK: { x: 50, y: 88 },
    },
  },
};

export const DEFAULT_FORMATION = "3-3-1";

export function getFormation(key: string | null | undefined): FormationDef {
  return FORMATIONS[key ?? DEFAULT_FORMATION] ?? FORMATIONS[DEFAULT_FORMATION];
}

// 新ポジションの適性が未設定の場合に代わりに参照するポジション。
// 例: DMF が未設定なら CMF の適性で判断する。
export const APTITUDE_FALLBACK: Partial<Record<PositionCode, PositionCode[]>> = {
  DMF: ["CMF", "CDF"],
  OMF: ["CMF", "FW"],
  LFW: ["FW", "LMF"],
  RFW: ["FW", "RMF"],
};

// 適性レベル (0=対応不可、数字が大きいほど適性が高い)
// 既存データとの互換のため 1〜3 の意味は変えず、上位の 4・5 を追加している
export const APTITUDE_MAX = 5;
export const APTITUDE_LABELS: Record<number, string> = {
  5: "最適",
  4: "かなり得意",
  3: "得意",
  2: "普通",
  1: "経験あり",
  0: "対応不可",
};
// ボタン表示用の短いラベル
export const APTITUDE_SHORT_LABELS: Record<number, string> = {
  5: "◎+",
  4: "◎",
  3: "○",
  2: "△",
  1: "▲",
  0: "×",
};

// 時間帯区分 (1試合 = 4区分、各450秒 = 7分30秒)
export const PERIOD_TYPES = [
  "FIRST_HALF_FIRST",
  "FIRST_HALF_SECOND",
  "SECOND_HALF_FIRST",
  "SECOND_HALF_SECOND",
] as const;

export type PeriodType = (typeof PERIOD_TYPES)[number];

export const PERIOD_LABELS: Record<PeriodType, string> = {
  FIRST_HALF_FIRST: "前半 0:00〜7:30",
  FIRST_HALF_SECOND: "前半 7:30〜15:00",
  SECOND_HALF_FIRST: "後半 0:00〜7:30",
  SECOND_HALF_SECOND: "後半 7:30〜15:00",
};

export const PERIOD_SHORT_LABELS: Record<PeriodType, string> = {
  FIRST_HALF_FIRST: "前半①",
  FIRST_HALF_SECOND: "前半②",
  SECOND_HALF_FIRST: "後半①",
  SECOND_HALF_SECOND: "後半②",
};

export const SLOT_SECONDS = 450; // 7分30秒

// 出席状態
export const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: "参加",
  ABSENT: "欠席",
  LATE: "遅刻",
  LEAVE_EARLY: "早退",
  INJURED: "ケガ",
  SICK: "体調不良",
};

// 編成状態
export const LINEUP_STATUS_LABELS: Record<string, string> = {
  NOT_GENERATED: "未作成",
  GENERATED: "自動作成済み",
  EDITING: "編集中",
  CONFIRMED: "確定済み",
};

// 編成プリセット
export const PRESET_LABELS: Record<string, string> = {
  FAIRNESS: "均等出場重視",
  WIN: "勝利重視",
  DEVELOPMENT: "育成重視",
  RANDOM: "完全おまかせ",
};

export const PRESETS: Record<
  string,
  {
    fairnessWeight: number;
    aptitudeWeight: number;
    continuityPenalty: number;
    positionRepeatPenalty: number;
    randomnessWeight: number;
  }
> = {
  FAIRNESS: {
    fairnessWeight: 60,
    aptitudeWeight: 20,
    continuityPenalty: 20,
    positionRepeatPenalty: 10,
    randomnessWeight: 10,
  },
  WIN: {
    fairnessWeight: 20,
    aptitudeWeight: 60,
    continuityPenalty: 10,
    positionRepeatPenalty: 5,
    randomnessWeight: 5,
  },
  DEVELOPMENT: {
    fairnessWeight: 40,
    aptitudeWeight: 15,
    continuityPenalty: 20,
    positionRepeatPenalty: 30,
    randomnessWeight: 15,
  },
  RANDOM: {
    fairnessWeight: 30,
    aptitudeWeight: 15,
    continuityPenalty: 10,
    positionRepeatPenalty: 10,
    randomnessWeight: 40,
  },
};

// 秒数を「15分」「7分30秒」のような表示に変換
export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes}分`;
  return `${minutes}分${seconds}秒`;
}

export function formatSlots(slotCount: number): string {
  return formatSeconds(slotCount * SLOT_SECONDS);
}
