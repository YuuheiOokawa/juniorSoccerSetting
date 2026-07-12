import {
  CATEGORY_COLORS,
  categoryOf,
  getFormation,
  type PositionCode,
} from "@/lib/constants";
import { PlayerAvatar } from "./PlayerAvatar";

// 割り当て情報: 旧形式 (表示名のみ) と新形式 (選手情報付き) の両方に対応
export type SnapshotAssignment =
  | string
  | { label: string; imageUrl?: string | null };

function normalize(
  value: SnapshotAssignment | undefined
): { label: string; imageUrl: string | null } | null {
  if (!value) return null;
  if (typeof value === "string") return { label: value, imageUrl: null };
  if (!value.label) return null;
  return { label: value.label, imageUrl: value.imageUrl ?? null };
}

// 掲示板投稿などに添付されたフォーメーション案の表示。
// ミニコートの上にポジションバッジ + 選手ミニカード (顔写真付き) を配置する。
export function FormationSnapshot({
  formationKey,
  assignments = {},
  className = "",
}: {
  formationKey: string;
  assignments?: Partial<Record<string, SnapshotAssignment>>;
  className?: string;
}) {
  const formation = getFormation(formationKey);

  return (
    <div className={className}>
      <div className="mb-1 inline-block rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white">
        ⚽ {formation.label}
      </div>
      <div
        className="relative aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-xl shadow ring-2 ring-slate-900/40"
        style={{
          background: "linear-gradient(to bottom, #3fae52, #1c6e30)",
        }}
      >
        {/* 芝の縞とライン */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 12%, transparent 12% 24%)",
          }}
        />
        <div className="pointer-events-none absolute inset-1.5 rounded-lg border border-white/50" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
        <div className="pointer-events-none absolute left-1/4 right-1/4 top-1.5 h-6 border border-t-0 border-white/40" />
        <div className="pointer-events-none absolute bottom-1.5 left-1/4 right-1/4 h-7 border border-b-0 border-white/40" />

        {formation.positions.map((code) => {
          const pos = formation.layout[code as PositionCode];
          if (!pos) return null;
          const colors = CATEGORY_COLORS[categoryOf(code as PositionCode)];
          const player = normalize(assignments[code]);
          return (
            <div
              key={code}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              {player ? (
                // 選手ミニカード (顔写真 + 名前)
                <div className="relative flex flex-col items-center rounded-lg bg-gradient-to-b from-slate-700 to-black px-1 pb-0.5 pt-1 shadow ring-1 ring-white/30">
                  <span
                    className={`absolute -left-1 -top-1.5 rounded px-1 py-0.5 text-[8px] font-black leading-none shadow ring-1 ring-white/60 ${colors.badge}`}
                  >
                    {code}
                  </span>
                  <PlayerAvatar
                    imageUrl={player.imageUrl}
                    name={player.label.replace(/^\d+\s*/, "") || player.label}
                    size={24}
                    className={`ring-1 ${colors.ring}`}
                  />
                  <span className="mt-0.5 max-w-[64px] truncate text-[9px] font-bold leading-none text-white">
                    {player.label}
                  </span>
                </div>
              ) : (
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-black leading-none shadow ring-1 ring-white/60 ${colors.badge}`}
                >
                  {code}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
