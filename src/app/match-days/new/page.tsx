import { prisma } from "@/lib/db";
import { MatchDayForm } from "@/components/MatchDayForm";

export const dynamic = "force-dynamic";

export default async function NewMatchDayPage() {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: { jerseyNumber: "asc" },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">試合日の作成</h1>
      <MatchDayForm
        initial={{
          matchDate: today,
          eventName: "",
          venue: "",
          meetingTime: "",
          numberOfMatches: 1,
          notes: "",
          participantIds: players.map((p) => p.id),
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
