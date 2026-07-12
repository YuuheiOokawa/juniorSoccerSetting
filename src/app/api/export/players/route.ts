import { prisma } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import { APTITUDE_LABELS, POSITION_CODES } from "@/lib/constants";

export const dynamic = "force-dynamic";

// 選手一覧CSV
export async function GET() {
  const players = await prisma.player.findMany({
    orderBy: { jerseyNumber: "asc" },
    include: { positions: { include: { position: true } } },
  });

  const rows: (string | number)[][] = [
    [
      "背番号",
      "選手名",
      "ふりがな",
      "初心者",
      "在籍状態",
      ...POSITION_CODES.map((c) => `適性:${c}`),
      "メモ",
    ],
  ];

  for (const p of players) {
    const aptitudeByCode = new Map(
      p.positions.map((pp) => [
        pp.position.code,
        pp.isAvailable ? pp.aptitudeLevel : 0,
      ])
    );
    rows.push([
      p.jerseyNumber,
      p.name,
      p.nameKana,
      p.isBeginner ? "○" : "",
      p.isActive ? "在籍" : "休部",
      ...POSITION_CODES.map(
        (c) => APTITUDE_LABELS[aptitudeByCode.get(c) ?? 0]
      ),
      p.notes,
    ]);
  }

  return csvResponse(toCsv(rows), "選手一覧.csv");
}
