import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  LINEUP_STATUS_LABELS,
  formatSlots,
} from "@/lib/constants";
import { PlayerAvatar } from "@/components/PlayerAvatar";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [playerCount, nextMatchDay, recentMatchDays, players] =
    await Promise.all([
      prisma.player.count({ where: { isActive: true } }),
      prisma.matchDay.findFirst({
        where: { matchDate: { gte: today } },
        orderBy: { matchDate: "asc" },
        include: { _count: { select: { players: true, matches: true } } },
      }),
      prisma.matchDay.findMany({
        orderBy: { matchDate: "desc" },
        take: 5,
        include: { _count: { select: { players: true, matches: true } } },
      }),
      prisma.player.findMany({
        where: { isActive: true },
        orderBy: { jerseyNumber: "asc" },
      }),
    ]);

  // 出場時間は大会 (試合日) 単位で管理する。
  // ダッシュボードには編成のある直近の大会の出場時間を表示する。
  const latestWithLineup = await prisma.matchDay.findFirst({
    where: {
      matches: { some: { periods: { some: { assignments: { some: {} } } } } },
    },
    orderBy: { matchDate: "desc" },
    select: { id: true, matchDate: true, eventName: true },
  });
  const latestSlotCounts = latestWithLineup
    ? await prisma.lineupAssignment.groupBy({
        by: ["playerId"],
        where: {
          matchPeriod: { match: { matchDayId: latestWithLineup.id } },
        },
        _count: { id: true },
      })
    : [];
  const slotByPlayer = new Map(
    latestSlotCounts.map((s) => [s.playerId, s._count.id])
  );
  const unconfirmed = recentMatchDays.filter(
    (d) => d.status !== "CONFIRMED" && d.status !== "NOT_GENERATED"
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ダッシュボード</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="text-sm text-slate-500">登録選手数</div>
          <div className="text-3xl font-bold">{playerCount}人</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">次回の試合日</div>
          {nextMatchDay ? (
            <Link
              href={`/match-days/${nextMatchDay.id}`}
              className="block text-emerald-700"
            >
              <div className="text-xl font-bold">
                {nextMatchDay.matchDate.toLocaleDateString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  weekday: "short",
                })}
              </div>
              <div className="text-sm">
                {nextMatchDay._count.matches}試合 / 参加
                {nextMatchDay._count.players}人
              </div>
            </Link>
          ) : (
            <div className="text-slate-400 text-sm mt-1">予定なし</div>
          )}
        </div>
      </div>

      {unconfirmed.length > 0 && (
        <div className="card border-amber-300 bg-amber-50">
          <h2 className="font-bold text-amber-800">⚠️ 未確定の編成</h2>
          <ul className="mt-2 space-y-1">
            {unconfirmed.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/match-days/${d.id}/formation`}
                  className="text-emerald-700 underline"
                >
                  {d.matchDate.toLocaleDateString("ja-JP")} {d.eventName}(
                  {LINEUP_STATUS_LABELS[d.status]})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">最近の試合日</h2>
          <Link href="/match-days/new" className="btn-primary text-sm !py-2">
            ＋ 試合日を作成
          </Link>
        </div>
        {recentMatchDays.length === 0 ? (
          <p className="mt-3 text-slate-400">まだ試合日がありません。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {recentMatchDays.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/match-days/${d.id}`}
                  className="flex items-center justify-between py-3 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-bold">
                      {d.matchDate.toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </div>
                    <div className="text-sm text-slate-500">
                      {d.eventName || "(大会名なし)"} ・ {d._count.matches}試合
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {LINEUP_STATUS_LABELS[d.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="font-bold">
          直近の大会の出場時間
          {latestWithLineup && (
            <span className="ml-2 text-sm font-normal text-slate-500">
              {latestWithLineup.matchDate.toLocaleDateString("ja-JP")}{" "}
              {latestWithLineup.eventName}
            </span>
          )}
        </h2>
        {players.length === 0 ? (
          <p className="mt-3 text-slate-400">
            <Link href="/players/new" className="text-emerald-700 underline">
              選手を登録
            </Link>
            してください。
          </p>
        ) : (
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              >
                <PlayerAvatar imageUrl={p.imageUrl} name={p.name} size={32} />
                <span className="w-8 text-center font-mono font-bold text-slate-500">
                  {p.jerseyNumber}
                </span>
                <span className="flex-1 truncate font-bold">{p.name}</span>
                <span className="text-sm text-slate-600">
                  {formatSlots(slotByPlayer.get(p.id) ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
