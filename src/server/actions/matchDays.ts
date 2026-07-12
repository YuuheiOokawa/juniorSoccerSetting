"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { PERIOD_TYPES, SLOT_SECONDS } from "@/lib/constants";
import {
  attendanceSchema,
  matchDaySchema,
  matchSchema,
  generationSettingSchema,
} from "@/lib/validation";
import type { ActionResult } from "./players";

// 1試合分の4区分を作る
function buildPeriods() {
  return PERIOD_TYPES.map((periodType, i) => ({
    periodType,
    periodOrder: i + 1,
    startSecond: i * SLOT_SECONDS,
    durationSecs: SLOT_SECONDS,
  }));
}

export async function createMatchDay(formData: FormData): Promise<ActionResult> {
  const parsed = matchDaySchema.safeParse({
    matchDate: formData.get("matchDate"),
    eventName: formData.get("eventName") ?? "",
    venue: formData.get("venue") ?? "",
    meetingTime: formData.get("meetingTime") ?? "",
    numberOfMatches: formData.get("numberOfMatches"),
    formation: formData.get("formation") ?? "3-3-1",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;
  const participantIds = formData.getAll("participantIds").map(String);

  const matchDay = await prisma.matchDay.create({
    data: {
      matchDate: new Date(data.matchDate),
      eventName: data.eventName,
      venue: data.venue,
      meetingTime: data.meetingTime,
      numberOfMatches: data.numberOfMatches,
      formation: data.formation,
      notes: data.notes,
      matches: {
        create: Array.from({ length: data.numberOfMatches }, (_, i) => ({
          matchNumber: i + 1,
          periods: { create: buildPeriods() },
        })),
      },
      generationSetting: { create: {} },
    },
  });

  // 参加選手 (当日設定の初期値は選手マスタから引き継ぐ)
  if (participantIds.length > 0) {
    const players = await prisma.player.findMany({
      where: { id: { in: participantIds } },
    });
    await prisma.matchDayPlayer.createMany({
      data: players.map((p) => ({
        matchDayId: matchDay.id,
        playerId: p.id,
        isBeginnerOnDay: p.isBeginner,
        canPlayGk: p.canPlayGk,
      })),
    });
  }

  revalidatePath("/match-days");
  revalidatePath("/");
  return { ok: true, id: matchDay.id };
}

export async function updateMatchDay(
  matchDayId: string,
  formData: FormData
): Promise<ActionResult> {
  const existing = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: { matches: { orderBy: { matchNumber: "asc" } } },
  });
  if (!existing) return { ok: false, error: "試合日が見つかりません。" };

  const parsed = matchDaySchema.safeParse({
    matchDate: formData.get("matchDate"),
    eventName: formData.get("eventName") ?? "",
    venue: formData.get("venue") ?? "",
    meetingTime: formData.get("meetingTime") ?? "",
    numberOfMatches: formData.get("numberOfMatches"),
    formation: formData.get("formation") ?? "3-3-1",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  // 試合数の増減に対応する。減らす場合は編成済みデータも消えるため
  // 画面側で確認ダイアログを表示している。
  const operations = [];
  if (data.numberOfMatches > existing.matches.length) {
    for (let n = existing.matches.length + 1; n <= data.numberOfMatches; n++) {
      operations.push(
        prisma.match.create({
          data: {
            matchDayId,
            matchNumber: n,
            periods: { create: buildPeriods() },
          },
        })
      );
    }
  } else if (data.numberOfMatches < existing.matches.length) {
    const toDelete = existing.matches.filter(
      (m) => m.matchNumber > data.numberOfMatches
    );
    operations.push(
      prisma.match.deleteMany({
        where: { id: { in: toDelete.map((m) => m.id) } },
      })
    );
  }

  // 参加選手の増減を反映する。既存メンバーの当日設定は維持し、
  // 新規メンバーは選手マスタの値を初期値にする。
  const participantIds = formData.getAll("participantIds").map(String);
  const currentPlayers = await prisma.matchDayPlayer.findMany({
    where: { matchDayId },
  });
  const currentIds = new Set(currentPlayers.map((p) => p.playerId));
  const addedIds = participantIds.filter((id) => !currentIds.has(id));
  const removedIds = [...currentIds].filter((id) => !participantIds.includes(id));
  const addedPlayers = await prisma.player.findMany({
    where: { id: { in: addedIds } },
  });

  await prisma.$transaction([
    prisma.matchDay.update({
      where: { id: matchDayId },
      data: {
        matchDate: new Date(data.matchDate),
        eventName: data.eventName,
        venue: data.venue,
        meetingTime: data.meetingTime,
        numberOfMatches: data.numberOfMatches,
        formation: data.formation,
        notes: data.notes,
      },
    }),
    ...(removedIds.length > 0
      ? [
          prisma.matchDayPlayer.deleteMany({
            where: { matchDayId, playerId: { in: removedIds } },
          }),
        ]
      : []),
    ...(addedPlayers.length > 0
      ? [
          prisma.matchDayPlayer.createMany({
            data: addedPlayers.map((p) => ({
              matchDayId,
              playerId: p.id,
              isBeginnerOnDay: p.isBeginner,
              canPlayGk: p.canPlayGk,
            })),
          }),
        ]
      : []),
    ...operations,
  ]);

  revalidatePath("/match-days");
  revalidatePath(`/match-days/${matchDayId}`);
  return { ok: true, id: matchDayId };
}

// フォーメーションのみを変更する (フォーメーション画面のセレクタから)
export async function updateFormationAction(
  matchDayId: string,
  formationKey: string
): Promise<ActionResult> {
  const parsed = matchDaySchema.shape.formation.safeParse(formationKey);
  if (!parsed.success) {
    return { ok: false, error: "不正なフォーメーションです。" };
  }

  const matchDay = await prisma.matchDay.findUnique({ where: { id: matchDayId } });
  if (!matchDay) return { ok: false, error: "試合日が見つかりません。" };
  if (matchDay.status === "CONFIRMED") {
    return {
      ok: false,
      error: "確定済みの編成はフォーメーションを変更できません。先に確定を解除してください。",
    };
  }

  await prisma.matchDay.update({
    where: { id: matchDayId },
    data: { formation: parsed.data },
  });

  revalidatePath(`/match-days/${matchDayId}`);
  return { ok: true };
}

export async function deleteMatchDay(matchDayId: string): Promise<ActionResult> {
  const existing = await prisma.matchDay.findUnique({ where: { id: matchDayId } });
  if (!existing) return { ok: false, error: "試合日が見つかりません。" };

  await prisma.matchDay.delete({ where: { id: matchDayId } });

  revalidatePath("/match-days");
  revalidatePath("/");
  return { ok: true };
}

export async function updateMatch(
  matchId: string,
  formData: FormData
): Promise<ActionResult> {
  const existing = await prisma.match.findUnique({ where: { id: matchId } });
  if (!existing) return { ok: false, error: "試合が見つかりません。" };

  const scoreForRaw = formData.get("scoreFor");
  const scoreAgainstRaw = formData.get("scoreAgainst");
  const parsed = matchSchema.safeParse({
    opponentName: formData.get("opponentName") ?? "",
    startTime: formData.get("startTime") ?? "",
    courtName: formData.get("courtName") ?? "",
    notes: formData.get("notes") ?? "",
    scoreFor: scoreForRaw === "" || scoreForRaw == null ? null : scoreForRaw,
    scoreAgainst:
      scoreAgainstRaw === "" || scoreAgainstRaw == null ? null : scoreAgainstRaw,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      opponentName: parsed.data.opponentName,
      startTime: parsed.data.startTime,
      courtName: parsed.data.courtName,
      notes: parsed.data.notes,
      scoreFor: parsed.data.scoreFor ?? null,
      scoreAgainst: parsed.data.scoreAgainst ?? null,
    },
  });

  revalidatePath(`/match-days/${existing.matchDayId}`);
  return { ok: true };
}

// 当日の参加選手の追加・削除・設定変更 (一括保存)
export async function saveAttendance(
  matchDayId: string,
  entries: unknown
): Promise<ActionResult> {
  const matchDay = await prisma.matchDay.findUnique({ where: { id: matchDayId } });
  if (!matchDay) return { ok: false, error: "試合日が見つかりません。" };

  const listSchema = attendanceSchema.array();
  const parsed = listSchema.safeParse(entries);
  if (!parsed.success) {
    return { ok: false, error: "入力内容に誤りがあります。画面を再読み込みしてやり直してください。" };
  }

  await prisma.$transaction(async (tx) => {
    // 一覧に含まれない選手の当日設定は削除 (=不参加扱い)
    await tx.matchDayPlayer.deleteMany({
      where: {
        matchDayId,
        playerId: { notIn: parsed.data.map((e) => e.playerId) },
      },
    });
    for (const entry of parsed.data) {
      await tx.matchDayPlayer.upsert({
        where: { matchDayId_playerId: { matchDayId, playerId: entry.playerId } },
        update: {
          attendanceStatus: entry.attendanceStatus,
          isBeginnerOnDay: entry.isBeginnerOnDay,
          canPlayGk: entry.canPlayGk,
          canPlay: entry.canPlay,
          maxPlayingSlots: entry.maxPlayingSlots,
          priority: entry.priority,
          notes: entry.notes,
        },
        create: {
          matchDayId,
          playerId: entry.playerId,
          attendanceStatus: entry.attendanceStatus,
          isBeginnerOnDay: entry.isBeginnerOnDay,
          canPlayGk: entry.canPlayGk,
          canPlay: entry.canPlay,
          maxPlayingSlots: entry.maxPlayingSlots,
          priority: entry.priority,
          notes: entry.notes,
        },
      });
    }
  });

  revalidatePath(`/match-days/${matchDayId}`);
  return { ok: true };
}

// 自動編成設定の保存
export async function saveGenerationSetting(
  matchDayId: string,
  formData: FormData
): Promise<ActionResult> {
  const matchDay = await prisma.matchDay.findUnique({ where: { id: matchDayId } });
  if (!matchDay) return { ok: false, error: "試合日が見つかりません。" };

  const parsed = generationSettingSchema.safeParse({
    beginnerLimit: formData.get("beginnerLimit"),
    fairnessWeight: formData.get("fairnessWeight"),
    aptitudeWeight: formData.get("aptitudeWeight"),
    continuityPenalty: formData.get("continuityPenalty"),
    positionRepeatPenalty: formData.get("positionRepeatPenalty"),
    randomnessWeight: formData.get("randomnessWeight"),
    presetType: formData.get("presetType"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.generationSetting.upsert({
    where: { matchDayId },
    update: parsed.data,
    create: { matchDayId, ...parsed.data },
  });

  revalidatePath(`/match-days/${matchDayId}`);
  return { ok: true };
}
