import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MatchDayForm } from "@/components/MatchDayForm";

export const dynamic = "force-dynamic";

export default async function EditMatchDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [matchDay, players] = await Promise.all([
    prisma.matchDay.findUnique({
      where: { id },
      include: {
        players: true,
        matches: {
          include: { periods: { include: { _count: { select: { assignments: true } } } } },
        },
      },
    }),
    prisma.player.findMany({
      where: { isActive: true },
      orderBy: { jerseyNumber: "asc" },
    }),
  ]);
  if (!matchDay) notFound();

  const hasLineup = matchDay.matches.some((m) =>
    m.periods.some((p) => p._count.assignments > 0)
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">試合日の編集</h1>
      <MatchDayForm
        initial={{
          id: matchDay.id,
          matchDate: matchDay.matchDate.toISOString().slice(0, 10),
          eventName: matchDay.eventName,
          venue: matchDay.venue,
          meetingTime: matchDay.meetingTime,
          numberOfMatches: matchDay.numberOfMatches,
          formation: matchDay.formation,
          notes: matchDay.notes,
          participantIds: matchDay.players.map((p) => p.playerId),
          hasLineup,
        }}
        allPlayers={players.map((p) => ({
          id: p.id,
          name: p.name,
          jerseyNumber: p.jerseyNumber,
          imageUrl: p.imageUrl,
          isBeginner: p.isBeginner,
        }))}
      />
    </div>
  );
}
