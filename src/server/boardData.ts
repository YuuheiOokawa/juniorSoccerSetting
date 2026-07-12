import { prisma } from "@/lib/db";
import type { SnapshotAssignment } from "@/components/FormationSnapshot";

interface PostWithFormation {
  id: string;
  formationData: string | null;
}

// 保存形式: 旧 = {"GK":"1 佐藤"} / 新 = {"GK":{"playerId":"...","label":"1 佐藤"}}
type StoredAssignment = string | { playerId?: string; label?: string };

// 投稿に添付されたフォーメーション案の選手IDから顔写真URLを解決し、
// 表示用の割り当てマップを投稿IDごとに返す
export async function resolvePostFormations(
  posts: PostWithFormation[]
): Promise<Map<string, Partial<Record<string, SnapshotAssignment>>>> {
  const parsed = new Map<string, Record<string, StoredAssignment>>();
  const playerIds = new Set<string>();

  for (const post of posts) {
    if (!post.formationData) continue;
    try {
      const data = JSON.parse(post.formationData) as Record<
        string,
        StoredAssignment
      >;
      parsed.set(post.id, data);
      for (const v of Object.values(data)) {
        if (typeof v === "object" && v?.playerId) playerIds.add(v.playerId);
      }
    } catch {
      // 壊れたJSONは無視 (投稿本文は表示される)
    }
  }

  const images = new Map<string, string | null>();
  if (playerIds.size > 0) {
    const players = await prisma.player.findMany({
      where: { id: { in: [...playerIds] } },
      select: { id: true, imageUrl: true },
    });
    for (const p of players) images.set(p.id, p.imageUrl);
  }

  const result = new Map<string, Partial<Record<string, SnapshotAssignment>>>();
  for (const [postId, data] of parsed) {
    const assignments: Partial<Record<string, SnapshotAssignment>> = {};
    for (const [code, v] of Object.entries(data)) {
      if (typeof v === "string") {
        assignments[code] = v;
      } else if (v?.label) {
        assignments[code] = {
          label: v.label,
          imageUrl: v.playerId ? (images.get(v.playerId) ?? null) : null,
        };
      }
    }
    result.set(postId, assignments);
  }
  return result;
}
