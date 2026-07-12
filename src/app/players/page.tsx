import Link from "next/link";
import { prisma } from "@/lib/db";
import { PlayerAvatar } from "@/components/PlayerAvatar";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter } = await searchParams;

  const players = await prisma.player.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { nameKana: { contains: q } },
            ],
          }
        : {}),
      ...(filter === "beginner" ? { isBeginner: true } : {}),
      ...(filter === "inactive" ? { isActive: false } : { isActive: true }),
    },
    orderBy: { jerseyNumber: "asc" },
    include: {
      positions: {
        where: { isAvailable: true },
        include: { position: true },
        orderBy: { position: { sortOrder: "asc" } },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">選手一覧</h1>
        <div className="flex gap-2">
          <a href="/api/export/players" className="btn-secondary">
            📄 CSV
          </a>
          <Link href="/players/new" className="btn-primary">
            ＋ 新規登録
          </Link>
        </div>
      </div>

      <form className="flex gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="名前・ふりがなで検索"
          className="input flex-1"
        />
        <select name="filter" defaultValue={filter ?? ""} className="input w-auto">
          <option value="">在籍中</option>
          <option value="beginner">初心者のみ</option>
          <option value="inactive">退団・休部</option>
        </select>
        <button type="submit" className="btn-secondary">
          検索
        </button>
      </form>

      {players.length === 0 ? (
        <p className="card text-slate-500">該当する選手がいません。</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <li key={p.id}>
              <Link
                href={`/players/${p.id}`}
                className="card flex items-center gap-3 hover:border-emerald-400"
              >
                <PlayerAvatar imageUrl={p.imageUrl} name={p.name} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-slate-500">
                      {p.jerseyNumber}
                    </span>
                    <span className="truncate text-lg font-bold">{p.name}</span>
                    {p.grade != null && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                        {p.grade}年
                      </span>
                    )}
                    {p.isCaptainCandidate && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                        Ⓒ
                      </span>
                    )}
                    {p.isBeginner && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
                        🔰初心者
                      </span>
                    )}
                    {!p.isActive && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">
                        休部
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {p.positions.map((pp) => (
                      <span
                        key={pp.id}
                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                          pp.aptitudeLevel >= 4
                            ? "bg-emerald-200 text-emerald-900"
                            : pp.aptitudeLevel === 3
                              ? "bg-emerald-100 text-emerald-700"
                              : pp.aptitudeLevel === 2
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {pp.position.code}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
