"use client";

import { usePathname, useRouter } from "next/navigation";

// ボトムナビに存在するトップレベル画面では戻るボタンを表示しない
const TOP_LEVEL_PATHS = new Set([
  "/",
  "/players",
  "/match-days",
  "/boards",
  "/history",
  "/login",
]);

// 全下層画面共通の「← 戻る」バー
export function BackBar() {
  const pathname = usePathname();
  const router = useRouter();

  if (TOP_LEVEL_PATHS.has(pathname)) return null;

  // ブラウザ履歴がない場合 (直接URLを開いた場合など) は親パスへ移動する
  const parentPath = pathname.split("/").slice(0, -1).join("/") || "/";

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(parentPath);
    }
  };

  return (
    <div className="no-print mx-auto max-w-5xl px-3 pt-3 sm:px-4">
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400 active:scale-95"
      >
        <span aria-hidden>←</span> 戻る
      </button>
    </div>
  );
}
