import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, getAuthSecret, isAuthEnabled, verifyToken } from "@/lib/auth";

// APP_PASSWORD が設定されている場合、全ページ・APIを認証必須にする。
// 未設定の場合は認証なしで動作する (ローカル開発用)。
export async function middleware(request: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (await verifyToken(token, getAuthSecret())) {
    return NextResponse.next();
  }

  // 未認証: ページ遷移はログイン画面へ、それ以外 (API等) は401
  if (request.method === "GET" && !pathname.startsWith("/api/")) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return new NextResponse("認証が必要です。", { status: 401 });
}

export const config = {
  // 静的ファイルと Next.js 内部パスは対象外
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
