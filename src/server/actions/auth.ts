"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE,
  TOKEN_TTL_MS,
  createToken,
  getAuthSecret,
  isAuthEnabled,
  timingSafeEqual,
} from "@/lib/auth";

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginAction(
  password: string,
  nextPath: string
): Promise<LoginResult> {
  if (!isAuthEnabled()) {
    redirect("/");
  }

  const expected = process.env.APP_PASSWORD!;
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    !timingSafeEqual(password, expected)
  ) {
    // 総当たり対策の簡易ディレイ
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { ok: false, error: "パスワードが違います。" };
  }

  const token = await createToken(getAuthSecret());
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TOKEN_TTL_MS / 1000,
    path: "/",
  });

  // オープンリダイレクト防止: サイト内パスのみ許可
  const safePath =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  redirect(safePath);
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect("/login");
}
