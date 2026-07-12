import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BoardPanel } from "@/components/BoardPanel";

export const dynamic = "force-dynamic";

export default async function MatchDayBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchDay = await prisma.matchDay.findUnique({
    where: { id },
    include: {
      boardPosts: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!matchDay) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          💬 試合日の掲示板 (
          {matchDay.matchDate.toLocaleDateString("ja-JP")}{" "}
          {matchDay.eventName || ""})
        </h1>
        <Link
          href={`/match-days/${id}`}
          className="text-sm text-emerald-700 underline"
        >
          ← 試合日に戻る
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        この試合日のポジション案や気づいたことをスタッフ同士で共有できます。
      </p>

      <BoardPanel
        boardType="MATCHDAY"
        matchDayId={id}
        posts={matchDay.boardPosts.map((p) => ({
          id: p.id,
          authorName: p.authorName,
          body: p.body,
          createdAt: p.createdAt.toLocaleString("ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        }))}
      />
    </div>
  );
}
