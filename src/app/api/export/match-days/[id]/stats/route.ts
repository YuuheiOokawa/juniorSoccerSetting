import { prisma } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import {
  ATTENDANCE_LABELS,
  POSITION_CODES,
  formatSlots,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

// 出場時間集計CSV
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
            include: { assignments: { include: { position: true } } },
          },
        },
      },
      players: {
        include: { player: true },
        orderBy: { player: { jerseyNumber: "asc" } },
      },
    },
  });
  if (!matchDay) {
    return new Response("試合日が見つかりません。", { status: 404 });
  }

  // 集計
  const slots = new Map<string, number>();
  const perMatch = new Map<string, Map<number, number>>();
  const perPosition = new Map<string, Map<string, number>>();
  for (const m of matchDay.matches) {
    for (const p of m.periods) {
      for (const a of p.assignments) {
        slots.set(a.playerId, (slots.get(a.playerId) ?? 0) + 1);
        const pm = perMatch.get(a.playerId) ?? new Map<number, number>();
        pm.set(m.matchNumber, (pm.get(m.matchNumber) ?? 0) + 1);
        perMatch.set(a.playerId, pm);
        const pp = perPosition.get(a.playerId) ?? new Map<string, number>();
        pp.set(a.position.code, (pp.get(a.position.code) ?? 0) + 1);
        perPosition.set(a.playerId, pp);
      }
    }
  }

  const rows: (string | number)[][] = [
    [
      "背番号",
      "選手名",
      "出欠",
      "初心者",
      "出場区分数",
      "出場時間",
      ...matchDay.matches.map((m) => `第${m.matchNumber}試合`),
      ...POSITION_CODES.map((c) => `回数:${c}`),
    ],
  ];

  for (const mdp of matchDay.players) {
    const count = slots.get(mdp.playerId) ?? 0;
    rows.push([
      mdp.player.jerseyNumber,
      mdp.player.name,
      ATTENDANCE_LABELS[mdp.attendanceStatus] ?? mdp.attendanceStatus,
      mdp.isBeginnerOnDay ? "○" : "",
      count,
      formatSlots(count),
      ...matchDay.matches.map(
        (m) => perMatch.get(mdp.playerId)?.get(m.matchNumber) ?? 0
      ),
      ...POSITION_CODES.map(
        (c) => perPosition.get(mdp.playerId)?.get(c) ?? 0
      ),
    ]);
  }

  const dateStr = matchDay.matchDate.toISOString().slice(0, 10);
  return csvResponse(toCsv(rows), `出場時間集計_${dateStr}.csv`);
}
