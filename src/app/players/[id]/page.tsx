import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PlayerForm } from "@/components/PlayerForm";
import { POSITION_CODES, type PositionCode } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = await prisma.player.findUnique({
    where: { id },
    include: { positions: { include: { position: true } } },
  });
  if (!player) notFound();

  const aptitudes = {} as Record<PositionCode, number>;
  for (const code of POSITION_CODES) aptitudes[code] = 0;
  for (const pp of player.positions) {
    const code = pp.position.code as PositionCode;
    if (POSITION_CODES.includes(code)) {
      aptitudes[code] = pp.isAvailable ? pp.aptitudeLevel : 0;
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">選手の編集</h1>
      <PlayerForm
        initial={{
          id: player.id,
          name: player.name,
          nameKana: player.nameKana,
          jerseyNumber: player.jerseyNumber,
          imageUrl: player.imageUrl,
          isBeginner: player.isBeginner,
          isActive: player.isActive,
          notes: player.notes,
          grade: player.grade,
          dominantFoot: player.dominantFoot,
          isCaptainCandidate: player.isCaptainCandidate,
          stamina: player.stamina,
          technique: player.technique,
          speed: player.speed,
          defense: player.defense,
          attack: player.attack,
          aptitudes,
        }}
      />
    </div>
  );
}
