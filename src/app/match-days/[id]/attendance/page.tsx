import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AttendanceEditor } from "@/components/AttendanceEditor";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
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
    },
  });
  if (!matchDay) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">
        当日の参加設定 ({matchDay.matchDate.toLocaleDateString("ja-JP")})
      </h1>
      <p className="text-sm text-slate-600">
        選手ごとの当日限定の設定です。通常の選手情報は変わりません。
      </p>
      <AttendanceEditor
        matchDayId={id}
        entries={matchDay.players.map((mdp) => ({
          playerId: mdp.playerId,
          name: mdp.player.name,
          jerseyNumber: mdp.player.jerseyNumber,
          imageUrl: mdp.player.imageUrl,
          attendanceStatus: mdp.attendanceStatus,
          isBeginnerOnDay: mdp.isBeginnerOnDay,
          canPlayGk: mdp.canPlayGk,
          canPlay: mdp.canPlay,
          maxPlayingSlots: mdp.maxPlayingSlots,
          priority: mdp.priority,
          notes: mdp.notes,
        }))}
      />
    </div>
  );
}
