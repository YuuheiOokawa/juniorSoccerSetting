import Link from "next/link";
import { prisma } from "@/lib/db";
import { LINEUP_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function MatchDaysPage() {
  const matchDays = await prisma.matchDay.findMany({
    orderBy: { matchDate: "desc" },
    include: {
      _count: {
        select: {
          matches: true,
          players: { where: { attendanceStatus: { not: "ABSENT" } } },
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">試合日一覧</h1>
        <Link href="/match-days/new" className="btn-primary">
          ＋ 試合日を作成
        </Link>
      </div>

      {matchDays.length === 0 ? (
        <p className="card text-slate-500">まだ試合日がありません。</p>
      ) : (
        <ul className="space-y-2">
          {matchDays.map((d) => (
            <li key={d.id}>
              <Link
                href={`/match-days/${d.id}`}
                className="card flex items-center justify-between hover:border-emerald-400"
              >
                <div>
                  <div className="text-lg font-bold">
                    {d.matchDate.toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </div>
                  <div className="text-sm text-slate-500">
                    {d.eventName || "(大会名なし)"}
                    {d.venue && ` @ ${d.venue}`}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {d._count.matches}試合 ・ 参加{d._count.players}人
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    d.status === "CONFIRMED"
                      ? "bg-emerald-100 text-emerald-700"
                      : d.status === "NOT_GENERATED"
                        ? "bg-slate-100 text-slate-500"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {LINEUP_STATUS_LABELS[d.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
