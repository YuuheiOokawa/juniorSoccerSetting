"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBoardPost, deleteBoardPost } from "@/server/actions/community";

export interface BoardPostItem {
  id: string;
  authorName: string;
  body: string;
  createdAt: string; // 表示用文字列
}

// 掲示板の投稿一覧 + 投稿フォーム (学年別・試合日別で共用)
export function BoardPanel({
  boardType,
  grade,
  matchDayId,
  posts,
}: {
  boardType: "GRADE" | "MATCHDAY";
  grade?: number | null;
  matchDayId?: string | null;
  posts: BoardPostItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createBoardPost({
        boardType,
        grade: grade ?? null,
        matchDayId: matchDayId ?? null,
        authorName,
        body,
      });
      if (result.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const handleDelete = (postId: string) => {
    if (!window.confirm("この投稿を削除します。よろしいですか?")) return;
    startTransition(async () => {
      const result = await deleteBoardPost(postId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="card space-y-2">
        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            maxLength={20}
            placeholder="名前 (省略で匿名)"
            className="input !w-44"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="ポジション案・気づいたこと・連絡事項などを投稿できます"
          className="input"
        />
        <button
          type="submit"
          disabled={isPending || body.trim().length === 0}
          className="btn-primary w-full"
        >
          {isPending ? "投稿中..." : "📝 投稿する"}
        </button>
      </form>

      {posts.length === 0 ? (
        <p className="card text-slate-400">まだ投稿がありません。</p>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id} className="card">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-emerald-700">{p.authorName}</span>
                <span className="text-slate-400">{p.createdAt}</span>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={isPending}
                  className="ml-auto text-xs text-red-400 underline"
                >
                  削除
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words">{p.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
