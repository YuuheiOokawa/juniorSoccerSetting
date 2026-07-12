import { z } from "zod";
import { POSITION_CODES } from "./constants";

// ============================================================
// 選手
// ============================================================

const abilityLevel = z.coerce.number().int().min(0).max(5);

export const playerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "選手名を入力してください。")
    .max(50, "選手名は50文字以内で入力してください。"),
  nameKana: z.string().trim().max(50, "ふりがなは50文字以内で入力してください。").default(""),
  jerseyNumber: z.coerce
    .number()
    .int("背番号は整数で入力してください。")
    .min(0, "背番号は0以上で入力してください。")
    .max(999, "背番号は999以下で入力してください。"),
  isBeginner: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  notes: z.string().trim().max(500).default(""),
  grade: z.coerce.number().int().min(1).max(6).nullable(),
  dominantFoot: z.enum(["", "RIGHT", "LEFT", "BOTH"]).default(""),
  isCaptainCandidate: z.coerce.boolean().default(false),
  stamina: abilityLevel.default(0),
  technique: abilityLevel.default(0),
  speed: abilityLevel.default(0),
  defense: abilityLevel.default(0),
  attack: abilityLevel.default(0),
  aptitudes: z
    .record(z.enum(POSITION_CODES), z.number().int().min(0).max(3))
    .refine(
      (a) => Object.values(a).some((level) => level > 0),
      "対応可能なポジションを1つ以上設定してください。"
    ),
});

export type PlayerInput = z.infer<typeof playerSchema>;

// 画像ファイルの検証
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024; // 4MB
export const IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ============================================================
// 試合日
// ============================================================

export const matchDaySchema = z.object({
  matchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください。"),
  eventName: z.string().trim().max(100).default(""),
  venue: z.string().trim().max(100).default(""),
  meetingTime: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "集合時間は「08:30」の形式で入力してください。")
    .or(z.literal(""))
    .default(""),
  numberOfMatches: z.coerce
    .number()
    .int()
    .min(1, "試合数は1以上で入力してください。")
    .max(6, "試合数は6以下で入力してください。"),
  notes: z.string().trim().max(500).default(""),
});

export type MatchDayInput = z.infer<typeof matchDaySchema>;

export const matchSchema = z.object({
  opponentName: z.string().trim().max(100).default(""),
  startTime: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "開始時刻は「10:00」の形式で入力してください。")
    .or(z.literal(""))
    .default(""),
  courtName: z.string().trim().max(100).default(""),
  notes: z.string().trim().max(500).default(""),
  scoreFor: z.coerce.number().int().min(0).nullable().optional(),
  scoreAgainst: z.coerce.number().int().min(0).nullable().optional(),
});

// ============================================================
// 当日参加設定
// ============================================================

export const attendanceSchema = z.object({
  playerId: z.string().min(1),
  attendanceStatus: z.enum([
    "PRESENT",
    "ABSENT",
    "LATE",
    "LEAVE_EARLY",
    "INJURED",
    "SICK",
  ]),
  isBeginnerOnDay: z.boolean(),
  canPlayGk: z.boolean(),
  canPlay: z.boolean(),
  maxPlayingSlots: z.number().int().min(0).max(24).nullable(),
  priority: z.number().int().min(-5).max(5),
  notes: z.string().trim().max(200).default(""),
});

export type AttendanceInput = z.infer<typeof attendanceSchema>;

// ============================================================
// 自動編成設定
// ============================================================

export const generationSettingSchema = z.object({
  beginnerLimit: z.coerce.number().int().min(0).max(8),
  fairnessWeight: z.coerce.number().int().min(0).max(100),
  aptitudeWeight: z.coerce.number().int().min(0).max(100),
  continuityPenalty: z.coerce.number().int().min(0).max(100),
  positionRepeatPenalty: z.coerce.number().int().min(0).max(100),
  randomnessWeight: z.coerce.number().int().min(0).max(100),
  presetType: z.enum(["FAIRNESS", "WIN", "DEVELOPMENT", "RANDOM", "CUSTOM"]),
});

export type GenerationSettingInput = z.infer<typeof generationSettingSchema>;

// ============================================================
// 編成の手動保存
// ============================================================

export const assignmentSchema = z.object({
  periodId: z.string().min(1),
  positionCode: z.enum(POSITION_CODES),
  playerId: z.string().min(1),
  isLocked: z.boolean(),
  isManual: z.boolean().default(false),
});

export const saveLineupSchema = z.object({
  matchDayId: z.string().min(1),
  assignments: z.array(assignmentSchema),
});

export type SaveLineupInput = z.infer<typeof saveLineupSchema>;

// ============================================================
// 掲示板・表彰・投票
// ============================================================

export const boardPostSchema = z.object({
  boardType: z.enum(["GRADE", "MATCHDAY"]),
  grade: z.coerce.number().int().min(0).max(6).nullable(), // 0=全体
  matchDayId: z.string().nullable(),
  authorName: z
    .string()
    .trim()
    .max(20, "名前は20文字以内で入力してください。")
    .default(""),
  body: z
    .string()
    .trim()
    .min(1, "本文を入力してください。")
    .max(1000, "本文は1000文字以内で入力してください。"),
});

export const awardSchema = z.object({
  matchDayId: z.string().min(1),
  playerId: z.string().min(1),
  awardName: z
    .string()
    .trim()
    .min(1, "賞の名前を入力してください。")
    .max(50, "賞の名前は50文字以内で入力してください。"),
  notes: z.string().trim().max(200).default(""),
});
