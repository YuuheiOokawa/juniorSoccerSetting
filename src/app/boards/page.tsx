import Link from "next/link";
import { prisma } from "@/lib/db";
import { BoardPanel } from "@/components/BoardPanel";
import { resolvePostFormations } from "@/server/boardData";

export const dynamic = "force-dynamic";

const TABS = [
  { grade: 0, label: "全体" },
  ...[1, 2, 3, 4, 5, 6].map((g) => ({ grade: g, label: `${g}年` })),
];

export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>;
}) {
  const { g } = await searchParams;
  const grade = Math.min(6, Math.max(0, Number(g ?? 0) || 0));

  const [posts, allPlayers] = await Promise.all([
    prisma.boardPost.findMany({
      where: { boardType: "GRADE", grade },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        comments: { orderBy: { createdAt: "asc" } },
        reactions: true,
      },
    }),
    prisma.player.findMany({
      where: { isActive: true },
      orderBy: { jerseyNumber: "asc" },
      select: { id: true, name: true, jerseyNumber: true, imageUrl: true },
    }),
  ]);
  const formationsByPost = await resolvePostFormations(posts);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">💬 掲示板</h1>
      <p className="text-sm text-slate-600">
        スタッフ同士でポジション案や連絡事項を共有できます。学年ごとのタブに分かれています。
      </p>

      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.grade}
            href={t.grade === 0 ? "/boards" : `/boards?g=${t.grade}`}
            className={`shrink-0 rounded-lg px-4 py-2 font-bold ${
              grade === t.grade
                ? "bg-emerald-600 text-white"
                : "border border-slate-300 bg-white text-slate-600"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <BoardPanel
        boardType="GRADE"
        grade={grade}
        players={allPlayers.map((p) => ({
          playerId: p.id,
          label: `${p.jerseyNumber} ${p.name}`,
          imageUrl: p.imageUrl,
        }))}
        posts={posts.map((p) => ({
          id: p.id,
          authorName: p.authorName,
          body: p.body,
          createdAt: p.createdAt.toLocaleString("ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          formationKey: p.formationKey,
          formationAssignments: formationsByPost.get(p.id) ?? null,
          comments: (p.comments ?? []).map((c) => ({
            id: c.id,
            authorName: c.authorName,
            body: c.body,
            createdAt: c.createdAt.toLocaleString("ja-JP", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })),
          reactions: Object.fromEntries(
            Object.entries(
              (p.reactions ?? []).reduce<Record<string, number>>((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                return acc;
              }, {})
            )
          ),
        }))}
      />
    </div>
  );
}
