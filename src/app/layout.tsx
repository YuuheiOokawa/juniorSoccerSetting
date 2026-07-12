import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BackBar } from "@/components/BackBar";
import { isAuthEnabled } from "@/lib/auth";
import { logoutAction } from "@/server/actions/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Junior Soccer Lineup Manager",
  description: "小学生8人制サッカーのポジション・出場時間管理アプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/players", label: "選手", icon: "👥" },
  { href: "/match-days", label: "試合日", icon: "📅" },
  { href: "/boards", label: "掲示板", icon: "💬" },
  { href: "/history", label: "履歴", icon: "📖" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-screen pb-20 sm:pb-0">
        <header className="no-print sticky top-0 z-40 bg-gradient-to-r from-emerald-700 to-green-600 text-white shadow-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-wide">
              ⚽ Lineup Manager
            </Link>
            <div className="flex items-center gap-1">
              <nav className="hidden gap-1 sm:flex">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 font-bold transition hover:bg-white/15"
                  >
                    {item.icon} {item.label}
                  </Link>
                ))}
              </nav>
              {isAuthEnabled() && (
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-2 text-sm font-bold transition hover:bg-white/15"
                    title="ログアウト"
                  >
                    🔓
                  </button>
                </form>
              )}
            </div>
          </div>
        </header>
        <BackBar />
        <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
          {children}
        </main>
        {/* スマートフォン用ボトムナビ */}
        <nav className="no-print fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white/95 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold text-slate-600 transition active:bg-emerald-50 active:text-emerald-700"
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}
