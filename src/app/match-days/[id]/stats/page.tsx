import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  POSITION_CODES,
  formatSlots,
  type PositionCode,
} from "@/lib/constants";
import { PlayerAvatar } from "@/components/PlayerAvatar";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  if (!matchDay) notFound();

  // 選手ごとの集計
  interface Stat {
    slots: number;
    perMatch: Map<number, number>;
    perPosition: Map<string, number>;
    maxConsecutive: number;
  }
  const stats = new Map<string, Stat>();
  for (const mdp of matchDay.players) {
    stats.set(mdp.playerId, {
      slots: 0,
      perMatch: new Map(),
      perPosition: new Map(),
      maxConsecutive: 0,
    });
  }

  // 通し順に区分を並べ、連続出場も計算する
  const orderedPeriods = matchDay.matches.flatMap((m) =>
    m.periods.map((p) => ({ matchNumber: m.matchNumber, period: p }))
  );
  const consecutive = new Map<string, number>();
  for (const { matchNumber, period } of orderedPeriods) {
    const playing = new Set(period.assignments.map((a) => a.playerId));
    for (const a of period.assignments) {
      const stat = stats.get(a.playerId);
      if (!stat) continue;
      stat.slots++;
      stat.perMatch.set(matchNumber, (stat.perMatch.get(matchNumber) ?? 0) + 1);
      stat.perPosition.set(
        a.position.code,
        (stat.perPosition.get(a.position.code) ?? 0) + 1
      );
      const run = (consecutive.get(a.playerId) ?? 0) + 1;
      consecutive.set(a.playerId, run);
      stat.maxConsecutive = Math.max(stat.maxConsecutive, run);
    }
    for (const playerId of stats.keys()) {
      if (!playing.has(playerId)) consecutive.set(playerId, 0);
    }
  }

  const playablePlayers = matchDay.players.filter(
    (p) => p.canPlay && !["ABSENT", "INJURED", "SICK"].includes(p.attendanceStatus)
  );
  const totalSlots = [...stats.values()].reduce((sum, s) => sum + s.slots, 0);
  const avg = playablePlayers.length > 0 ? totalSlots / playablePlayers.length : 0;
  const maxSlots = Math.max(1, ...[...stats.values()].map((s) => s.slots));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          出場時間集計 ({matchDay.matchDate.toLocaleDateString("ja-JP")})
        </h1>
        <div className="flex items-center gap-3">
          <a
            href={`/api/export/match-days/${id}/stats`}
            className="btn-secondary !py-1.5 text-sm"
          >
            📄 CSV
          </a>
          <Link href={`/match-days/${id}`} className="text-sm text-emerald-700 underline">
            ← 試合日に戻る
          </Link>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        平均出場: {formatSlots(Math.round(avg * 10) / 10)} (
        {Math.round(avg * 10) / 10}区分) / 1区分 = 7分30秒
      </p>

      <div className="space-y-2">
        {matchDay.players.map((mdp) => {
          const stat = stats.get(mdp.playerId)!;
          const diff = stat.slots - avg;
          const isOut =
            !mdp.canPlay ||
            ["ABSENT", "INJURED", "SICK"].includes(mdp.attendanceStatus);
          return (
            <div key={mdp.id} className={`card ${isOut ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-3">
                <PlayerAvatar
                  imageUrl={mdp.player.imageUrl}
                  name={mdp.player.name}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-500">
                      {mdp.player.jerseyNumber}
                    </span>
                    <span className="truncate font-bold">{mdp.player.name}</span>
                    {mdp.isBeginnerOnDay && <span>🔰</span>}
                  </div>
                  {/* 出場時間バー */}
                  <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        diff < -1
                          ? "bg-orange-400"
                          : diff > 1
                            ? "bg-sky-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${(stat.slots / maxSlots) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatSlots(stat.slots)}</div>
                  <div
                    className={`text-xs font-bold ${
                      diff < -1
                        ? "text-orange-600"
                        : diff > 1
                          ? "text-sky-600"
                          : "text-slate-400"
                    }`}
                  >
                    平均{diff >= 0 ? "+" : ""}
                    {Math.round(diff * 10) / 10}区分
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>
                  試合別:{" "}
                  {matchDay.matches
                    .map(
                      (m) =>
                        `第${m.matchNumber}試合 ${stat.perMatch.get(m.matchNumber) ?? 0}区分`
                    )
                    .join(" / ")}
                </span>
                <span>最大連続: {stat.maxConsecutive}区分</span>
                {stat.perPosition.size > 0 && (
                  <span>
                    ポジション:{" "}
                    {POSITION_CODES.filter((c: PositionCode) =>
                      stat.perPosition.has(c)
                    )
                      .map((c) => `${c}×${stat.perPosition.get(c)}`)
                      .join(" ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
