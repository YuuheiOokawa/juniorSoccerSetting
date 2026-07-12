import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  PERIOD_SHORT_LABELS,
  POSITION_MASTER,
  formatSlots,
  type PeriodType,
} from "@/lib/constants";
import { PrintToolbar } from "@/components/PrintToolbar";

export const dynamic = "force-dynamic";

// メンバー表 (印刷・共有用)。全試合×4区分を一覧表示する。
export default async function PrintPage({
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
            include: {
              assignments: { include: { player: true, position: true } },
            },
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

  // 控え選手 (区分ごと) と出場数
  const slotCounts = new Map<string, number>();
  for (const m of matchDay.matches) {
    for (const p of m.periods) {
      for (const a of p.assignments) {
        slotCounts.set(a.playerId, (slotCounts.get(a.playerId) ?? 0) + 1);
      }
    }
  }
  const participants = matchDay.players.filter(
    (p) => p.canPlay && !["ABSENT", "INJURED", "SICK"].includes(p.attendanceStatus)
  );

  // 画像共有用のデータ (クライアントでcanvas描画)
  const shareData = {
    title: `${matchDay.matchDate.toLocaleDateString("ja-JP")} ${matchDay.eventName}`.trim(),
    matches: matchDay.matches.map((m) => ({
      matchNumber: m.matchNumber,
      opponentName: m.opponentName,
      startTime: m.startTime,
      periods: m.periods.map((p) => ({
        label: PERIOD_SHORT_LABELS[p.periodType as PeriodType] ?? p.periodType,
        positions: POSITION_MASTER.map((pos) => {
          const a = p.assignments.find((x) => x.position.code === pos.code);
          return {
            code: pos.code,
            player: a ? `${a.player.jerseyNumber} ${a.player.name}` : "-",
          };
        }),
      })),
    })),
  };

  return (
    <div className="space-y-4">
      <PrintToolbar matchDayId={id} shareData={shareData} />

      <div className="print-sheet space-y-6 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-xl font-bold">
            {matchDay.matchDate.toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "numeric",
              day: "numeric",
              weekday: "short",
            })}{" "}
            メンバー表
          </h1>
          <p className="text-sm text-slate-600">
            {matchDay.eventName || ""}
            {matchDay.venue && ` @ ${matchDay.venue}`}
            {matchDay.meetingTime && ` ・集合 ${matchDay.meetingTime}`}
          </p>
        </div>

        {matchDay.matches.map((m) => (
          <div key={m.id} className="break-inside-avoid">
            <h2 className="mb-1 font-bold">
              第{m.matchNumber}試合
              {m.opponentName && ` vs ${m.opponentName}`}
              {m.startTime && ` (${m.startTime}〜)`}
              {m.courtName && ` @ ${m.courtName}`}
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left">
                    ポジション
                  </th>
                  {m.periods.map((p) => (
                    <th
                      key={p.id}
                      className="border border-slate-300 bg-slate-100 px-2 py-1"
                    >
                      {PERIOD_SHORT_LABELS[p.periodType as PeriodType] ??
                        p.periodType}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {POSITION_MASTER.map((pos) => (
                  <tr key={pos.code}>
                    <td className="border border-slate-300 px-2 py-1 font-bold">
                      {pos.code}
                    </td>
                    {m.periods.map((p) => {
                      const a = p.assignments.find(
                        (x) => x.position.code === pos.code
                      );
                      return (
                        <td
                          key={p.id}
                          className="border border-slate-300 px-2 py-1"
                        >
                          {a ? (
                            <>
                              <span className="font-mono font-bold">
                                {a.player.jerseyNumber}
                              </span>{" "}
                              {a.player.name}
                              {a.isLocked && " 🔒"}
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="border border-slate-300 px-2 py-1 font-bold text-slate-500">
                    控え
                  </td>
                  {m.periods.map((p) => {
                    const onCourt = new Set(p.assignments.map((a) => a.playerId));
                    const bench = participants.filter(
                      (mdp) => !onCourt.has(mdp.playerId)
                    );
                    return (
                      <td
                        key={p.id}
                        className="border border-slate-300 px-2 py-1 text-xs text-slate-600"
                      >
                        {bench
                          .map((mdp) => `${mdp.player.jerseyNumber} ${mdp.player.name}`)
                          .join(" / ") || "-"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <div className="break-inside-avoid">
          <h2 className="mb-1 font-bold">出場時間</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {participants.map((mdp) => (
              <span key={mdp.id}>
                <span className="font-mono font-bold">
                  {mdp.player.jerseyNumber}
                </span>{" "}
                {mdp.player.name}: {formatSlots(slotCounts.get(mdp.playerId) ?? 0)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="no-print text-sm">
        <Link href={`/match-days/${id}`} className="text-emerald-700 underline">
          ← 試合日に戻る
        </Link>
      </p>
    </div>
  );
}
