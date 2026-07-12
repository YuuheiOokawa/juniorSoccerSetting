import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  APTITUDE_LABELS,
  CATEGORY_COLORS,
  POSITION_CODES,
  categoryOf,
  formatSlots,
  type PositionCode,
} from "@/lib/constants";
import { AbilityRadar } from "@/components/AbilityRadar";
import { AptitudeMap } from "@/components/AptitudeMap";
import { PlayerAvatar } from "@/components/PlayerAvatar";

export const dynamic = "force-dynamic";

const FOOT_LABELS: Record<string, string> = {
  RIGHT: "右足",
  LEFT: "左足",
  BOTH: "両足",
};

// 選手詳細 (ウイイレ風の選手情報画面)
export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      positions: { include: { position: true } },
      awards: {
        include: { matchDay: true },
        orderBy: { createdAt: "desc" },
      },
      lineupAssignments: { include: { position: true } },
    },
  });
  if (!player) notFound();

  // 適性マップ用データ
  const aptitudes: Partial<Record<string, number>> = {};
  for (const pp of player.positions) {
    if (pp.isAvailable && pp.aptitudeLevel > 0) {
      aptitudes[pp.position.code] = pp.aptitudeLevel;
    }
  }

  // メインポジション (適性が最も高いもの)
  const best = [...player.positions]
    .filter((pp) => pp.isAvailable && pp.aptitudeLevel > 0)
    .sort((a, b) => b.aptitudeLevel - a.aptitudeLevel)[0];
  const bestCode = (best?.position.code ?? "CMF") as PositionCode;
  const colors = CATEGORY_COLORS[categoryOf(bestCode)];

  // 出場記録
  const totalSlots = player.lineupAssignments.length;
  const positionCounts = new Map<string, number>();
  for (const a of player.lineupAssignments) {
    positionCounts.set(
      a.position.code,
      (positionCounts.get(a.position.code) ?? 0) + 1
    );
  }
  const topPositions = POSITION_CODES.filter((c) => positionCounts.has(c))
    .map((c) => ({ code: c, count: positionCounts.get(c)! }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return (
    <div className="space-y-4">
      {/* ヒーローカード */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-900 to-black p-5 text-white shadow-[0_12px_32px_rgba(0,0,0,0.4)] ring-1 ring-amber-300/40">
        {/* 光沢と背番号ウォーターマーク */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
        <span className="pointer-events-none absolute -right-3 -top-8 select-none font-mono text-[130px] font-black leading-none text-white/10">
          {player.jerseyNumber}
        </span>

        <div className="relative flex items-center gap-4">
          <div className="shrink-0">
            <PlayerAvatar
              imageUrl={player.imageUrl}
              name={player.name}
              size={96}
              className={`ring-4 shadow-[0_0_20px_rgba(255,255,255,0.25)] ${colors.ring}`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-sm font-black shadow ring-1 ring-white/50 ${colors.badge}`}
              >
                {bestCode}
              </span>
              <span className="font-mono text-2xl font-black text-amber-300 drop-shadow">
                {player.jerseyNumber}
              </span>
            </div>
            {player.nameKana && (
              <div className="mt-1 text-xs text-slate-300">{player.nameKana}</div>
            )}
            <h1 className="truncate text-2xl font-black drop-shadow">
              {player.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-bold">
              {player.grade != null && (
                <span className="rounded-full bg-white/15 px-2 py-0.5">
                  {player.grade}年
                </span>
              )}
              {player.dominantFoot && (
                <span className="rounded-full bg-white/15 px-2 py-0.5">
                  {FOOT_LABELS[player.dominantFoot]}
                </span>
              )}
              {player.isCaptainCandidate && (
                <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-amber-950">
                  Ⓒ キャプテン候補
                </span>
              )}
              {player.isBeginner && (
                <span className="rounded-full bg-sky-400/90 px-2 py-0.5 text-sky-950">
                  🔰 初心者
                </span>
              )}
              {!player.isActive && (
                <span className="rounded-full bg-slate-500/80 px-2 py-0.5">
                  休部
                </span>
              )}
            </div>
          </div>
        </div>

        {/* レーダー + 適性マップ */}
        <div className="relative mt-4 grid grid-cols-2 items-center gap-2">
          <div className="flex flex-col items-center">
            <AbilityRadar
              abilities={{
                stamina: player.stamina,
                technique: player.technique,
                speed: player.speed,
                defense: player.defense,
                attack: player.attack,
              }}
              size={190}
            />
            <span className="text-[10px] font-bold text-slate-400">能力バランス</span>
          </div>
          <div className="flex flex-col items-center">
            <AptitudeMap aptitudes={aptitudes} />
            <span className="mt-1 text-[10px] font-bold text-slate-400">
              ポジション適性マップ
            </span>
          </div>
        </div>

        <div className="relative mt-4 flex gap-2">
          <Link
            href={`/players/${player.id}/edit`}
            className="btn-primary flex-1 !py-2.5"
          >
            ✏️ 編集する
          </Link>
        </div>
      </div>

      {/* 対応ポジションの内訳 */}
      <div className="card">
        <h2 className="font-bold">対応ポジション</h2>
        {Object.keys(aptitudes).length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">未設定です。</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {POSITION_CODES.filter((c) => (aptitudes[c] ?? 0) > 0).map((c) => (
              <span
                key={c}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                  (aptitudes[c] ?? 0) >= 4
                    ? "bg-emerald-200 text-emerald-900"
                    : (aptitudes[c] ?? 0) === 3
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                <span className="font-mono font-black">{c}</span>
                {APTITUDE_LABELS[aptitudes[c] ?? 0]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 出場記録 */}
      <div className="card">
        <h2 className="font-bold">出場記録 (累計)</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs text-slate-500">累計出場時間</div>
            <div className="text-xl font-black">{formatSlots(totalSlots)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">出場区分数</div>
            <div className="text-xl font-black">{totalSlots}区分</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="text-xs text-slate-500">よく出るポジション</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {topPositions.length === 0 ? (
                <span className="text-sm text-slate-400">記録なし</span>
              ) : (
                topPositions.map((p) => (
                  <span
                    key={p.code}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-700"
                  >
                    {p.code}×{p.count}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 表彰 */}
      <div className="card">
        <h2 className="font-bold">🏆 表彰</h2>
        {player.awards.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">まだ表彰はありません。</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {player.awards.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm"
              >
                <span>🏆</span>
                <span className="font-bold">{a.awardName}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {a.matchDay.matchDate.toLocaleDateString("ja-JP")}{" "}
                  {a.matchDay.eventName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {player.notes && (
        <div className="card">
          <h2 className="font-bold">メモ</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {player.notes}
          </p>
        </div>
      )}
    </div>
  );
}
