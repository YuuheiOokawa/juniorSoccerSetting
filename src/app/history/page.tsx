import Link from "next/link";
import { prisma } from "@/lib/db";
import { LINEUP_STATUS_LABELS, formatSlots } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const matchDays = await prisma.matchDay.findMany({
    orderBy: { matchDate: "desc" },
    include: {
      matches: {
        orderBy: { matchNumber: "asc" },
        include: {
          periods: { include: { assignments: true } },
        },
      },
      players: { include: { player: true } },
    },
  });

  const withLineup = matchDays.filter((d) =>
    d.matches.some((m) => m.periods.some((p) => p.assignments.length > 0))
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">過去の試合日・編成履歴</h1>

      {withLineup.length === 0 ? (
        <p className="card text-slate-500">まだ編成の履歴がありません。</p>
      ) : (
        <ul className="space-y-3">
          {withLineup.map((d) => {
            const slotByPlayer = new Map<string, number>();
            for (const m of d.matches) {
              for (const p of m.periods) {
                for (const a of p.assignments) {
                  slotByPlayer.set(
                    a.playerId,
                    (slotByPlayer.get(a.playerId) ?? 0) + 1
                  );
                }
              }
            }
            const playedPlayers = d.players.filter((mdp) =>
              slotByPlayer.has(mdp.playerId)
            );
            return (
              <li key={d.id} className="card space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/match-days/${d.id}/formation`}
                      className="text-lg font-bold text-emerald-700 hover:underline"
                    >
                      {d.matchDate.toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </Link>
                    <div className="text-sm text-slate-500">
                      {d.eventName || "(大会名なし)"}
                      {d.venue && ` @ ${d.venue}`}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      d.status === "CONFIRMED"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {LINEUP_STATUS_LABELS[d.status]}
                  </span>
                </div>

                <div className="text-sm text-slate-600">
                  {d.matches
                    .map((m) => {
                      const result =
                        m.scoreFor != null && m.scoreAgainst != null
                          ? ` ${m.scoreFor}-${m.scoreAgainst}`
                          : "";
                      return `第${m.matchNumber}試合${m.opponentName ? ` vs ${m.opponentName}` : ""}${result}`;
                    })
                    .join(" ・ ")}
                </div>

                <div className="flex flex-wrap gap-1">
                  {playedPlayers
                    .sort(
                      (a, b) => a.player.jerseyNumber - b.player.jerseyNumber
                    )
                    .map((mdp) => (
                      <span
                        key={mdp.id}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-600"
                      >
                        {mdp.player.jerseyNumber} {mdp.player.name}{" "}
                        {formatSlots(slotByPlayer.get(mdp.playerId) ?? 0)}
                      </span>
                    ))}
                </div>

                <div className="flex gap-3 text-sm">
                  <Link
                    href={`/match-days/${d.id}/formation`}
                    className="text-emerald-700 underline"
                  >
                    フォーメーションを見る
                  </Link>
                  <Link
                    href={`/match-days/${d.id}/stats`}
                    className="text-emerald-700 underline"
                  >
                    出場時間の詳細
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
