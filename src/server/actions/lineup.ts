"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { POSITION_CODES } from "@/lib/constants";
import { generateLineup } from "@/lib/lineup/generate";
import { validateLineup } from "@/lib/lineup/constraints";
import type { Assignment } from "@/lib/lineup/types";
import { saveLineupSchema, assignmentSchema } from "@/lib/validation";
import {
  loadMatchDayBundle,
  toLineupPeriods,
  toLineupPlayers,
} from "../lineupData";

export interface AssignmentDto {
  periodId: string;
  positionCode: string;
  playerId: string;
  isLocked: boolean;
  isManual: boolean;
}

export type LineupActionResult =
  | { ok: true; warnings: string[]; assignments?: AssignmentDto[] }
  | { ok: false; error: string; errors?: string[] };

// 割り当てをDBへ保存する (対象区分の既存データを置き換える)
async function persistAssignments(
  matchDayId: string,
  periodIds: string[],
  assignments: Assignment[],
  options: { manualPlayerIds?: Set<string> } = {}
) {
  const positions = await prisma.position.findMany();
  const positionByCode = new Map(positions.map((p) => [p.code, p.id]));

  await prisma.$transaction([
    prisma.lineupAssignment.deleteMany({
      where: { matchPeriodId: { in: periodIds } },
    }),
    prisma.lineupAssignment.createMany({
      data: assignments
        .filter((a) => periodIds.includes(a.periodId))
        .map((a) => ({
          matchPeriodId: a.periodId,
          playerId: a.playerId,
          positionId: positionByCode.get(a.positionCode)!,
          isLocked: a.isLocked,
          isManual:
            options.manualPlayerIds?.has(`${a.periodId}:${a.playerId}`) ?? false,
          generatedScore: a.score ?? null,
        })),
    }),
    prisma.matchDay.update({
      where: { id: matchDayId },
      data: { status: "GENERATED" },
    }),
  ]);
}

// 自動編成 (日全体 / 試合単位 / 区分単位)
// scope: { type: "day" } | { type: "match", matchId } | { type: "period", periodId }
// currentAssignments: 画面上の現在の割り当て (固定・手動編集を保持するため)
export async function generateLineupAction(input: {
  matchDayId: string;
  scope:
    | { type: "day" }
    | { type: "match"; matchId: string }
    | { type: "period"; periodId: string };
  currentAssignments: unknown;
  seed?: number;
}): Promise<LineupActionResult> {
  const bundle = await loadMatchDayBundle(input.matchDayId);
  if (!bundle) return { ok: false, error: "試合日が見つかりません。" };
  if (bundle.status === "CONFIRMED") {
    return {
      ok: false,
      error: "この編成は確定済みです。編集するには確定を解除してください。",
    };
  }

  const parsed = assignmentSchema.array().safeParse(input.currentAssignments);
  if (!parsed.success) {
    return { ok: false, error: "画面の編成データが不正です。再読み込みしてください。" };
  }
  const current: Assignment[] = parsed.data;

  const players = toLineupPlayers(bundle);
  const allPeriods = toLineupPeriods(bundle);

  // 再生成の対象区分を決める
  let targetPeriodIds: Set<string>;
  if (input.scope.type === "day") {
    targetPeriodIds = new Set(allPeriods.map((p) => p.periodId));
  } else if (input.scope.type === "match") {
    const matchId = input.scope.matchId;
    const match = bundle.matches.find((m) => m.id === matchId);
    if (!match) return { ok: false, error: "試合が見つかりません。" };
    targetPeriodIds = new Set(match.periods.map((p) => p.id));
  } else {
    targetPeriodIds = new Set([input.scope.periodId]);
  }

  // 対象外の区分の割り当ては「固定」として扱い、変更しない。
  // 対象区分では isLocked=true のものだけを維持する。
  const lockedAssignments: Assignment[] = current
    .filter((a) =>
      targetPeriodIds.has(a.periodId) ? a.isLocked : true
    )
    .map((a) => ({ ...a, isLocked: true }));

  const setting = bundle.generationSetting;
  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);

  const result = generateLineup(
    players,
    allPeriods,
    {
      beginnerLimit: setting?.beginnerLimit ?? 2,
      fairnessWeight: setting?.fairnessWeight ?? 50,
      aptitudeWeight: setting?.aptitudeWeight ?? 30,
      continuityPenalty: setting?.continuityPenalty ?? 20,
      positionRepeatPenalty: setting?.positionRepeatPenalty ?? 10,
      randomnessWeight: setting?.randomnessWeight ?? 15,
      seed,
    },
    lockedAssignments
  );

  if (!result.ok) {
    return {
      ok: false,
      error: "自動編成できませんでした。",
      errors: result.errors,
    };
  }

  // 元の isLocked 状態を復元する (対象外区分の割り当ても固定扱いで
  // アルゴリズムへ渡しているため)
  const lockedKeys = new Set(
    current
      .filter((a) => a.isLocked)
      .map((a) => `${a.periodId}:${a.positionCode}:${a.playerId}`)
  );
  const finalAssignments = result.assignments.map((a) => ({
    ...a,
    isLocked: lockedKeys.has(`${a.periodId}:${a.positionCode}:${a.playerId}`),
  }));

  const allPeriodIds = allPeriods.map((p) => p.periodId);
  await persistAssignments(input.matchDayId, allPeriodIds, finalAssignments);

  await prisma.generationHistory.create({
    data: {
      matchDayId: input.matchDayId,
      generationSeed: seed,
      generationType:
        input.scope.type === "day"
          ? "FULL_DAY"
          : input.scope.type === "match"
            ? "MATCH"
            : "PERIOD",
      resultSummary:
        result.warnings.length > 0 ? result.warnings.join(" / ") : "正常に作成",
    },
  });

  revalidatePath(`/match-days/${input.matchDayId}`);
  return {
    ok: true,
    warnings: result.warnings,
    assignments: finalAssignments.map((a) => ({
      periodId: a.periodId,
      positionCode: a.positionCode,
      playerId: a.playerId,
      isLocked: a.isLocked,
      isManual: false,
    })),
  };
}

// 手動編集した編成の保存
export async function saveLineupAction(input: unknown): Promise<LineupActionResult> {
  const parsed = saveLineupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "編成データの形式が不正です。" };
  }
  const { matchDayId, assignments } = parsed.data;

  const bundle = await loadMatchDayBundle(matchDayId);
  if (!bundle) return { ok: false, error: "試合日が見つかりません。" };
  if (bundle.status === "CONFIRMED") {
    return {
      ok: false,
      error: "この編成は確定済みです。編集するには確定を解除してください。",
    };
  }

  // サーバー側でも制約を検証する (重複配置・8人未満などは警告として返す)
  const players = toLineupPlayers(bundle);
  const periods = toLineupPeriods(bundle);
  const validPeriodIds = new Set(periods.map((p) => p.periodId));
  const validPlayerIds = new Set(players.map((p) => p.playerId));

  for (const a of assignments) {
    if (!validPeriodIds.has(a.periodId)) {
      return { ok: false, error: "不正な時間帯区分が含まれています。" };
    }
    if (!validPlayerIds.has(a.playerId)) {
      return {
        ok: false,
        error: "参加選手に含まれない選手が配置されています。当日参加設定を確認してください。",
      };
    }
  }

  const setting = bundle.generationSetting;
  const validation = validateLineup(players, periods, assignments, {
    beginnerLimit: setting?.beginnerLimit ?? 2,
  });

  const manualKeys = new Set(
    assignments.filter((a) => a.isManual).map((a) => `${a.periodId}:${a.playerId}`)
  );
  await persistAssignments(
    matchDayId,
    periods.map((p) => p.periodId),
    assignments,
    { manualPlayerIds: manualKeys }
  );

  await prisma.matchDay.update({
    where: { id: matchDayId },
    data: { status: "EDITING" },
  });

  revalidatePath(`/match-days/${matchDayId}`);
  // 制約違反があっても保存はする (途中保存を許可) が、警告として返す
  return { ok: true, warnings: validation.errors };
}

// 編成の確定 / 確定解除
export async function confirmLineupAction(
  matchDayId: string,
  confirm: boolean
): Promise<LineupActionResult> {
  const bundle = await loadMatchDayBundle(matchDayId);
  if (!bundle) return { ok: false, error: "試合日が見つかりません。" };

  if (confirm) {
    // 確定前に全区分が正しく埋まっているか検証する
    const players = toLineupPlayers(bundle);
    const periods = toLineupPeriods(bundle);
    const assignments: Assignment[] = [];
    for (const match of bundle.matches) {
      for (const period of match.periods) {
        for (const a of period.assignments) {
          assignments.push({
            periodId: period.id,
            positionCode: a.position.code as (typeof POSITION_CODES)[number],
            playerId: a.playerId,
            isLocked: a.isLocked,
          });
        }
      }
    }
    const validation = validateLineup(players, periods, assignments, {
      beginnerLimit: bundle.generationSetting?.beginnerLimit ?? 2,
    });
    if (!validation.valid) {
      return {
        ok: false,
        error: "制約違反があるため確定できません。",
        errors: validation.errors,
      };
    }
  }

  await prisma.matchDay.update({
    where: { id: matchDayId },
    data: { status: confirm ? "CONFIRMED" : "EDITING" },
  });

  revalidatePath(`/match-days/${matchDayId}`);
  revalidatePath("/history");
  return { ok: true, warnings: [] };
}
