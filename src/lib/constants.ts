// ポジション定義 (3-3-1 フォーメーション)
export const POSITION_CODES = [
  "GK",
  "LDF",
  "CDF",
  "RDF",
  "LMF",
  "CMF",
  "RMF",
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
  { code: "LMF", name: "左ミッドフィルダー", category: "MF", sortOrder: 5 },
  { code: "CMF", name: "中央ミッドフィルダー", category: "MF", sortOrder: 6 },
  { code: "RMF", name: "右ミッドフィルダー", category: "MF", sortOrder: 7 },
  { code: "FW", name: "フォワード", category: "FW", sortOrder: 8 },
];

export const CATEGORY_LABEL: Record<string, string> = {
  GK: "GK",
  DF: "DF",
  MF: "MF",
  FW: "FW",
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
