// 能力値の五角形レーダーチャート (ウイイレ風)
// 数値は表示せず、形で能力バランスを表現する

const AXES = [
  { key: "attack", label: "攻撃" },
  { key: "technique", label: "技術" },
  { key: "speed", label: "スピード" },
  { key: "stamina", label: "体力" },
  { key: "defense", label: "守備" },
] as const;

export function AbilityRadar({
  abilities,
  size = 220,
}: {
  abilities: {
    stamina: number;
    technique: number;
    speed: number;
    defense: number;
    attack: number;
  };
  size?: number;
}) {
  const center = 100;
  const radius = 72;
  const labelRadius = 90;

  const pointAt = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * radius * ratio,
      y: center + Math.sin(angle) * radius * ratio,
    };
  };

  const ringPath = (ratio: number) =>
    AXES.map((_, i) => {
      const p = pointAt(i, ratio);
      return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(" ") + " Z";

  const values = AXES.map((a) => Math.max(0, Math.min(5, abilities[a.key])));
  const hasAny = values.some((v) => v > 0);
  const dataPath =
    AXES.map((_, i) => {
      const p = pointAt(i, Math.max(values[i] / 5, 0.06));
      return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(" ") + " Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="能力レーダーチャート"
    >
      {/* 目盛りリング */}
      {[1, 0.8, 0.6, 0.4, 0.2].map((r) => (
        <path
          key={r}
          d={ringPath(r)}
          fill={r === 1 ? "rgba(255,255,255,0.06)" : "none"}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
      ))}
      {/* 軸線 */}
      {AXES.map((_, i) => {
        const p = pointAt(i, 1);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
        );
      })}
      {/* データ */}
      {hasAny ? (
        <>
          <path
            d={dataPath}
            fill="rgba(52,211,153,0.35)"
            stroke="#34d399"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {AXES.map((_, i) => {
            const p = pointAt(i, Math.max(values[i] / 5, 0.06));
            return (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill="#a7f3d0" />
            );
          })}
        </>
      ) : (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize="11"
          fontWeight="bold"
        >
          能力値 未設定
        </text>
      )}
      {/* ラベル */}
      {AXES.map((axis, i) => {
        const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
        const x = center + Math.cos(angle) * labelRadius;
        const y = center + Math.sin(angle) * labelRadius;
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.85)"
            fontSize="11"
            fontWeight="bold"
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}
