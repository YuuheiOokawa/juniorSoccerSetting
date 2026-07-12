import {
  CATEGORY_COLORS,
  categoryOf,
  getFormation,
  type PositionCode,
} from "@/lib/constants";

// 掲示板投稿などに添付されたフォーメーション案の表示。
// ミニコートの上にポジションチップ (+選手名) を配置する。
export function FormationSnapshot({
  formationKey,
  assignments = {},
  className = "",
}: {
  formationKey: string;
  assignments?: Partial<Record<string, string>>;
  className?: string;
}) {
  const formation = getFormation(formationKey);

  return (
    <div className={className}>
      <div className="mb-1 inline-block rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white">
        ⚽ {formation.label}
      </div>
      <div
        className="relative aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-xl shadow ring-2 ring-slate-900/40"
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
          const name = assignments[code];
          return (
            <div
              key={code}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <span
                className={`rounded px-1 py-0.5 text-[9px] font-black leading-none shadow ring-1 ring-white/60 ${colors.badge}`}
              >
                {code}
              </span>
              {name && (
                <span className="mt-0.5 max-w-[74px] truncate rounded bg-black/60 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                  {name}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
