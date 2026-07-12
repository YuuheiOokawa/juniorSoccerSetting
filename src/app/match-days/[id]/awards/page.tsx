import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AwardsPanel } from "@/components/AwardsPanel";

export const dynamic = "force-dynamic";

export default async function AwardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchDay = await prisma.matchDay.findUnique({
    where: { id },
    include: {
      players: {
        include: { player: true },
        orderBy: { player: { jerseyNumber: "asc" } },
      },
      awards: {
        include: { player: true },
        orderBy: { createdAt: "asc" },
      },
      mvpVotes: true,
    },
  });
  if (!matchDay) notFound();

  const voteCounts = new Map<string, number>();
  for (const v of matchDay.mvpVotes) {
    voteCounts.set(v.playerId, (voteCounts.get(v.playerId) ?? 0) + 1);
  }

  const participants = matchDay.players.filter(
    (p) =>
      p.canPlay && !["ABSENT", "INJURED", "SICK"].includes(p.attendanceStatus)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          🏆 優秀選手 (
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

      <AwardsPanel
        matchDayId={id}
        players={participants.map((mdp) => ({
          playerId: mdp.playerId,
          name: mdp.player.name,
          jerseyNumber: mdp.player.jerseyNumber,
          imageUrl: mdp.player.imageUrl,
          votes: voteCounts.get(mdp.playerId) ?? 0,
        }))}
        totalVotes={matchDay.mvpVotes.length}
        awards={matchDay.awards.map((a) => ({
          id: a.id,
          awardName: a.awardName,
          playerName: `${a.player.jerseyNumber} ${a.player.name}`,
          notes: a.notes,
        }))}
      />
    </div>
  );
}
