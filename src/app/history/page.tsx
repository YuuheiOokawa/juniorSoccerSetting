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
      awards: { include: { player: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const withLineup = matchDays.filter((d) =>
    d.matches.some((m) => m.periods.some((p) => p.assignments.length > 0))
  );

  // 通算成績 (スコア入力済みの試合のみ集計)
  const allMatches = matchDays.flatMap((d) => d.matches);
  const scored = allMatches.filter(
    (m) => m.scoreFor != null && m.scoreAgainst != null
  );
  const wins = scored.filter((m) => m.scoreFor! > m.scoreAgainst!).length;
  const draws = scored.filter((m) => m.scoreFor! === m.scoreAgainst!).length;
  const losses = scored.filter((m) => m.scoreFor! < m.scoreAgainst!).length;
  const goalsFor = scored.reduce((sum, m) => sum + (m.scoreFor ?? 0), 0);
  const goalsAgainst = scored.reduce((sum, m) => sum + (m.scoreAgainst ?? 0), 0);

  // 対戦相手別の成績
  const byOpponent = new Map<
    string,
    { games: number; w: number; d: number; l: number; gf: number; ga: number }
  >();
  for (const m of scored) {
    const name = m.opponentName.trim();
    if (!name) continue;
    const rec = byOpponent.get(name) ?? { games: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    rec.games++;
    if (m.scoreFor! > m.scoreAgainst!) rec.w++;
    else if (m.scoreFor! < m.scoreAgainst!) rec.l++;
    else rec.d++;
    rec.gf += m.scoreFor!;
    rec.ga += m.scoreAgainst!;
    byOpponent.set(name, rec);
  }
  const opponents = [...byOpponent.entries()].sort(
    (a, b) => b[1].games - a[1].games
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">過去の試合日・編成履歴</h1>

      {scored.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-bold">📈 通算成績</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 py-2">
              <div className="text-2xl font-black text-emerald-700">{wins}</div>
              <div className="text-xs font-bold text-emerald-700">勝ち</div>
            </div>
            <div className="rounded-xl bg-slate-100 py-2">
              <div className="text-2xl font-black text-slate-600">{draws}</div>
              <div className="text-xs font-bold text-slate-600">引き分け</div>
            </div>
            <div className="rounded-xl bg-red-50 py-2">
              <div className="text-2xl font-black text-red-600">{losses}</div>
              <div className="text-xs font-bold text-red-600">負け</div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-600">
            {scored.length}試合 ・ 得点 <b>{goalsFor}</b> / 失点 <b>{goalsAgainst}</b>{" "}
            (得失点差 {goalsFor - goalsAgainst >= 0 ? "+" : ""}
            {goalsFor - goalsAgainst})
          </p>

          {opponents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-1.5 pr-2">対戦相手</th>
                    <th className="py-1.5 pr-2 text-center">試合</th>
                    <th className="py-1.5 pr-2 text-center">勝-分-負</th>
                    <th className="py-1.5 text-center">得失点</th>
                  </tr>
                </thead>
                <tbody>
                  {opponents.map(([name, r]) => (
                    <tr key={name} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 font-bold">{name}</td>
                      <td className="py-1.5 pr-2 text-center">{r.games}</td>
                      <td className="py-1.5 pr-2 text-center font-mono">
                        {r.w}-{r.d}-{r.l}
                      </td>
                      <td className="py-1.5 text-center font-mono">
                        {r.gf}-{r.ga}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                  {d.matches.map((m) => {
                    const hasResult =
                      m.scoreFor != null && m.scoreAgainst != null;
                    const outcome = !hasResult
                      ? null
                      : m.scoreFor! > m.scoreAgainst!
                        ? { label: "勝", cls: "bg-emerald-100 text-emerald-700" }
                        : m.scoreFor! < m.scoreAgainst!
                          ? { label: "負", cls: "bg-red-100 text-red-700" }
                          : { label: "分", cls: "bg-slate-200 text-slate-600" };
                    return (
                      <span key={m.id} className="inline-flex items-center gap-1">
                        第{m.matchNumber}試合
                        {m.opponentName && ` vs ${m.opponentName}`}
                        {hasResult && (
                          <>
                            <span className="font-mono font-bold">
                              {m.scoreFor}-{m.scoreAgainst}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs font-bold ${outcome!.cls}`}
                            >
                              {outcome!.label}
                            </span>
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>

                {d.awards.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {d.awards.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800"
                      >
                        🏆 {a.awardName}: {a.player.jerseyNumber} {a.player.name}
                      </span>
                    ))}
                  </div>
                )}

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
