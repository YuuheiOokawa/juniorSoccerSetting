import { prisma } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import {
  PERIOD_LABELS,
  POSITION_MASTER,
  getFormation,
  type PeriodType,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

// 当日のメンバー表CSV (試合×区分×ポジション)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matchDay = await prisma.matchDay.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { matchNumber: "asc" },
        include: {
          periods: {
            orderBy: { periodOrder: "asc" },
            include: {
              assignments: {
                include: { player: true, position: true },
              },
            },
          },
        },
      },
    },
  });
  if (!matchDay) {
    return new Response("試合日が見つかりません。", { status: 404 });
  }

  const formationPositions = getFormation(matchDay.formation).positions;
  const positionRows = POSITION_MASTER.filter((pos) =>
    formationPositions.includes(pos.code)
  );

  const rows: (string | number)[][] = [
    [
      `${matchDay.matchDate.toLocaleDateString("ja-JP")} ${matchDay.eventName} (${getFormation(matchDay.formation).label})`.trim(),
    ],
    [],
  ];

  for (const match of matchDay.matches) {
    rows.push([
      `第${match.matchNumber}試合${match.opponentName ? ` vs ${match.opponentName}` : ""}${match.startTime ? ` (${match.startTime}〜)` : ""}`,
    ]);
    rows.push([
      "ポジション",
      ...match.periods.map(
        (p) => PERIOD_LABELS[p.periodType as PeriodType] ?? p.periodType
      ),
    ]);
    for (const pos of positionRows) {
      rows.push([
        `${pos.code} (${pos.name})`,
        ...match.periods.map((p) => {
          const a = p.assignments.find((x) => x.position.code === pos.code);
          return a ? `${a.player.jerseyNumber} ${a.player.name}` : "";
        }),
      ]);
    }
    rows.push([]);
  }

  const dateStr = matchDay.matchDate.toISOString().slice(0, 10);
  return csvResponse(toCsv(rows), `メンバー表_${dateStr}.csv`);
}
