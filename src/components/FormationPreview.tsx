import {
  CATEGORY_COLORS,
  categoryOf,
  getFormation,
} from "@/lib/constants";

// フォーメーションのミニコートプレビュー (選択UIや一覧表示用)
export function FormationPreview({
  formationKey,
  width = 72,
  className = "",
}: {
  formationKey: string;
  width?: number;
  className?: string;
}) {
  const formation = getFormation(formationKey);
  const height = (width * 4) / 3;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 80"
      className={`rounded-md ${className}`}
      aria-label={`フォーメーション ${formation.label}`}
    >
      {/* ピッチ */}
      <defs>
        <linearGradient id={`pitch-${formationKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3fae52" />
          <stop offset="100%" stopColor="#1c6e30" />
        </linearGradient>
        <radialGradient id={`light-${formationKey}`} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="60" height="80" fill={`url(#pitch-${formationKey})`} rx="4" />
      {/* 芝の縞 */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="0" y={i * 20} width="60" height="10" fill="rgba(255,255,255,0.05)" />
      ))}
      {/* ライン */}
      <rect x="2.5" y="2.5" width="55" height="75" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" rx="2" />
      <circle cx="30" cy="40" r="7" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <rect x="18" y="2.5" width="24" height="9" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <rect x="18" y="68.5" width="24" height="9" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />

      {/* 照明 */}
      <rect x="0" y="0" width="60" height="80" fill={`url(#light-${formationKey})`} rx="4" />

      {/* 選手ドット */}
      {formation.positions.map((code) => {
        const pos = formation.layout[code];
        if (!pos) return null;
        const color = CATEGORY_COLORS[categoryOf(code)].hex;
        return (
          <g key={code}>
            <circle
              cx={(pos.x / 100) * 60}
              cy={(pos.y / 100) * 80 + 0.8}
              r="3.6"
              fill="rgba(0,0,0,0.35)"
            />
            <circle
              cx={(pos.x / 100) * 60}
              cy={(pos.y / 100) * 80}
              r="3.6"
              fill={color}
              stroke="white"
              strokeWidth="1"
            />
          </g>
        );
      })}
    </svg>
  );
}
