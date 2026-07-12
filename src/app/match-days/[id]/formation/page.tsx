import Link from "next/link";
import { notFound } from "next/navigation";
import { POSITION_CODES, type PositionCode } from "@/lib/constants";
import { FormationBoard } from "@/components/formation/FormationBoard";
import {
  loadMatchDayBundle,
  toLineupPlayers,
} from "@/server/lineupData";

export const dynamic = "force-dynamic";

export default async function FormationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await loadMatchDayBundle(id);
  if (!bundle) notFound();

  const lineupPlayers = toLineupPlayers(bundle);
  const playerInfo = new Map(
    bundle.players.map((mdp) => [mdp.playerId, mdp.player])
  );

  const players = lineupPlayers.map((p) => ({
    ...p,
    imageUrl: playerInfo.get(p.playerId)?.imageUrl ?? null,
  }));

  const matches = bundle.matches.map((m) => ({
    id: m.id,
    matchNumber: m.matchNumber,
    opponentName: m.opponentName,
    periods: m.periods.map((p) => ({
      id: p.id,
      periodType: p.periodType,
      periodOrder: p.periodOrder,
    })),
  }));

  const assignments = bundle.matches.flatMap((m) =>
    m.periods.flatMap((p) =>
      p.assignments
        .filter((a) =>
          POSITION_CODES.includes(a.position.code as PositionCode)
        )
        .map((a) => ({
          periodId: p.id,
          positionCode: a.position.code as PositionCode,
          playerId: a.playerId,
          isLocked: a.isLocked,
          isManual: a.isManual,
        }))
    )
  );

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <h1 className="text-xl font-bold">フォーメーション</h1>
        <Link href={`/match-days/${id}`} className="text-sm text-emerald-700 underline">
          ← 試合日に戻る
        </Link>
      </div>
      <FormationBoard
        matchDayId={id}
        status={bundle.status}
        players={players}
        matches={matches}
        initialAssignments={assignments}
        beginnerLimit={bundle.generationSetting?.beginnerLimit ?? 2}
      />
    </div>
  );
}
