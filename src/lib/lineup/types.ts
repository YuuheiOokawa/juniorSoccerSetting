import type { PositionCode } from "../constants";

// 自動編成の入力となる選手情報 (選手マスタ + 当日設定をマージ済み)
export interface LineupPlayer {
  playerId: string;
  name: string;
  jerseyNumber: number;
  // ポジションコード → 適性レベル (0=対応不可, 1=経験あり, 2=普通, 3=得意)
  aptitudes: Record<PositionCode, number>;
  isBeginner: boolean; // 当日の初心者扱い
  canPlay: boolean; // 出場可能か (欠席・出場不可は false)
  maxPlayingSlots: number | null; // 出場枠数上限 (null=無制限)
  priority: number; // 出場優先度
}

// 1つの時間帯区分 (試合をまたいで日全体で順序を持つ)
export interface LineupPeriod {
  periodId: string; // MatchPeriod.id
  matchNumber: number;
  periodOrder: number; // 1〜4 (試合内)
  globalOrder: number; // 日全体での通し順序 (0始まり)
}

// 1つの割り当て
export interface Assignment {
  periodId: string;
  positionCode: PositionCode;
  playerId: string;
  isLocked: boolean;
  score?: number;
}

// 編成設定
export interface GenerationConfig {
  beginnerLimit: number;
  fairnessWeight: number;
  aptitudeWeight: number;
  continuityPenalty: number;
  positionRepeatPenalty: number;
  randomnessWeight: number;
  seed: number;
}

export interface GenerationResult {
  ok: boolean;
  assignments: Assignment[];
  errors: string[]; // 編成不能な致命的エラー (日本語)
  warnings: string[]; // 例外配置などの警告 (日本語)
  seed: number;
}

// 検証結果
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
