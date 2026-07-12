"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { awardSchema, boardPostSchema } from "@/lib/validation";
import type { ActionResult } from "./players";

// ============================================================
// 掲示板
// ============================================================

export async function createBoardPost(input: unknown): Promise<ActionResult> {
  const parsed = boardPostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  if (data.boardType === "MATCHDAY") {
    if (!data.matchDayId) {
      return { ok: false, error: "対象の試合日が指定されていません。" };
    }
    const matchDay = await prisma.matchDay.findUnique({
      where: { id: data.matchDayId },
    });
    if (!matchDay) return { ok: false, error: "試合日が見つかりません。" };
  }

  await prisma.boardPost.create({
    data: {
      boardType: data.boardType,
      grade: data.boardType === "GRADE" ? (data.grade ?? 0) : null,
      matchDayId: data.boardType === "MATCHDAY" ? data.matchDayId : null,
      authorName: data.authorName || "匿名",
      body: data.body,
    },
  });

  revalidatePath("/boards");
  if (data.matchDayId) revalidatePath(`/match-days/${data.matchDayId}/board`);
  return { ok: true };
}

export async function deleteBoardPost(postId: string): Promise<ActionResult> {
  const post = await prisma.boardPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false, error: "投稿が見つかりません。" };

  await prisma.boardPost.delete({ where: { id: postId } });

  revalidatePath("/boards");
  if (post.matchDayId) revalidatePath(`/match-days/${post.matchDayId}/board`);
  return { ok: true };
}

// ============================================================
// 優秀選手の匿名投票
// 投票者の情報 (名前・IPなど) は一切保存しない。
// 二重投票の防止はクライアント側 (localStorage) の簡易制御のみ。
// ============================================================

export async function voteMvp(
  matchDayId: string,
  playerId: string
): Promise<ActionResult> {
  const [matchDay, participant] = await Promise.all([
    prisma.matchDay.findUnique({ where: { id: matchDayId } }),
    prisma.matchDayPlayer.findUnique({
      where: { matchDayId_playerId: { matchDayId, playerId } },
    }),
  ]);
  if (!matchDay) return { ok: false, error: "試合日が見つかりません。" };
  if (!participant) {
    return { ok: false, error: "この大会の参加選手ではありません。" };
  }

  await prisma.mvpVote.create({ data: { matchDayId, playerId } });

  revalidatePath(`/match-days/${matchDayId}/awards`);
  return { ok: true };
}

// ============================================================
// 表彰 (優秀選手賞など)
// ============================================================

export async function addAward(input: unknown): Promise<ActionResult> {
  const parsed = awardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const matchDay = await prisma.matchDay.findUnique({
    where: { id: data.matchDayId },
  });
  if (!matchDay) return { ok: false, error: "試合日が見つかりません。" };
  const player = await prisma.player.findUnique({
    where: { id: data.playerId },
  });
  if (!player) return { ok: false, error: "選手が見つかりません。" };

  await prisma.playerAward.create({ data });

  revalidatePath(`/match-days/${data.matchDayId}/awards`);
  revalidatePath("/history");
  return { ok: true };
}

export async function deleteAward(awardId: string): Promise<ActionResult> {
  const award = await prisma.playerAward.findUnique({ where: { id: awardId } });
  if (!award) return { ok: false, error: "表彰が見つかりません。" };

  await prisma.playerAward.delete({ where: { id: awardId } });

  revalidatePath(`/match-days/${award.matchDayId}/awards`);
  revalidatePath("/history");
  return { ok: true };
}
