/* eslint-disable @next/next/no-img-element */
// 選手画像 (未登録時はデフォルトのシルエットを表示)
export function PlayerAvatar({
  imageUrl,
  name,
  size = 40,
  className = "",
}: {
  imageUrl: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover bg-slate-200 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-slate-300 text-slate-600 font-bold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-label={name}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
