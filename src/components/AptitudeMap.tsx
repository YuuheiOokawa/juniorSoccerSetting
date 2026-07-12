import {
  POSITION_CODES,
  type PositionCode,
} from "@/lib/constants";

// 全12ポジションのコート上の代表座標 (適性マップ表示用)
const MAP_LAYOUT: Record<PositionCode, { x: number; y: number }> = {
  GK: { x: 50, y: 88 },
  LDF: { x: 22, y: 68 },
  CDF: { x: 50, y: 72 },
  RDF: { x: 78, y: 68 },
  DMF: { x: 50, y: 55 },
  LMF: { x: 17, y: 43 },
  CMF: { x: 50, y: 40 },
  RMF: { x: 83, y: 43 },
  OMF: { x: 50, y: 26 },
  LFW: { x: 26, y: 14 },
  RFW: { x: 74, y: 14 },
  FW: { x: 50, y: 10 },
};

// 適性レベルに応じたドット配色 (ウイイレの適性マップ風:
// 高いほど赤く光り、低いほど暗い)
function dotStyle(level: number): { fill: string; glow: string } {
  switch (level) {
    case 5:
      return { fill: "#ef4444", glow: "rgba(239,68,68,0.6)" };
    case 4:
      return { fill: "#f97316", glow: "rgba(249,115,22,0.55)" };
    case 3:
      return { fill: "#f59e0b", glow: "rgba(245,158,11,0.5)" };
    case 2:
      return { fill: "#eab308", glow: "rgba(234,179,8,0.4)" };
    default:
      return { fill: "#a3a3a3", glow: "rgba(163,163,163,0.3)" };
  }
}

// 選手の対応ポジションをコート上に可視化する (ウイイレの適性マップ風)
export function AptitudeMap({
  aptitudes,
  className = "",
}: {
  aptitudes: Partial<Record<string, number>>;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-[3/4] w-full max-w-[240px] overflow-hidden rounded-xl ring-2 ring-white/20 ${className}`}
      style={{ background: "linear-gradient(to bottom, #2e8b46, #17592a)" }}
    >
      {/* 芝とライン */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 12%, transparent 12% 24%)",
        }}
      />
      <div className="pointer-events-none absolute inset-1.5 rounded-lg border border-white/40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      <div className="pointer-events-none absolute left-1/4 right-1/4 top-1.5 h-5 border border-t-0 border-white/30" />
      <div className="pointer-events-none absolute bottom-1.5 left-1/4 right-1/4 h-6 border border-b-0 border-white/30" />

      {POSITION_CODES.map((code) => {
        const level = aptitudes[code] ?? 0;
        if (level <= 0) return null;
        const pos = MAP_LAYOUT[code];
        const style = dotStyle(level);
        return (
          <div
            key={code}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            title={`${code}: レベル${level}`}
          >
            <span
              className="h-4 w-4 rounded-full ring-1 ring-white/70"
              style={{
                backgroundColor: style.fill,
                boxShadow: `0 0 8px 2px ${style.glow}`,
              }}
            />
            <span className="mt-0.5 rounded bg-black/50 px-1 text-[9px] font-black leading-none text-white">
              {code}
            </span>
          </div>
        );
      })}
    </div>
  );
}
