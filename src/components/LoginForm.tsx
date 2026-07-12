"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await loginAction(password, nextPath);
      // 成功時はサーバー側で redirect されるため、ここに戻るのは失敗時のみ
      if (result && !result.ok) {
        setError(result.error ?? "ログインできませんでした。");
        setPassword("");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 font-bold text-red-700">{error}</p>
      )}
      <div>
        <label className="label">パスワード</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          className="input"
        />
      </div>
      <button
        type="submit"
        disabled={isPending || password.length === 0}
        className="btn-primary w-full"
      >
        {isPending ? "確認中..." : "🔑 ログイン"}
      </button>
    </form>
  );
}
