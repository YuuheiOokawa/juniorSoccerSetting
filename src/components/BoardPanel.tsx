"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FORMATIONS, getFormation, type PositionCode } from "@/lib/constants";
import { createBoardPost, deleteBoardPost } from "@/server/actions/community";
import {
  FormationSnapshot,
  type SnapshotAssignment,
} from "./FormationSnapshot";

export interface BoardPostItem {
  id: string;
  authorName: string;
  body: string;
  createdAt: string; // 表示用文字列
  formationKey?: string | null;
  formationAssignments?: Partial<Record<string, SnapshotAssignment>> | null;
}

export interface BoardPlayerOption {
  playerId: string;
  label: string; // "背番号 名前"
  imageUrl?: string | null;
}

// 掲示板の投稿一覧 + 投稿フォーム (学年別・試合日別で共用)
// players を渡すと、フォーメーション案にポジションごとの選手を割り当てられる
export function BoardPanel({
  boardType,
  grade,
  matchDayId,
  posts,
  players = [],
}: {
  boardType: "GRADE" | "MATCHDAY";
  grade?: number | null;
  matchDayId?: string | null;
  posts: BoardPostItem[];
  players?: BoardPlayerOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  // フォーメーション案の添付
  const [attachFormation, setAttachFormation] = useState(false);
  const [formationKey, setFormationKey] = useState("3-3-1");
  const [assignments, setAssignments] = useState<
    Partial<Record<string, { playerId: string; label: string }>>
  >({});
  const formation = getFormation(formationKey);
  const playerById = new Map(players.map((p) => [p.playerId, p]));

  // 送信・保存用 (選手IDと表示名)
  const assignedEntries = Object.fromEntries(
    Object.entries(assignments).filter(([, v]) => v && v.label)
  ) as Record<string, { playerId: string; label: string }>;
  // プレビュー用 (顔写真付き)
  const previewAssignments: Partial<Record<string, SnapshotAssignment>> =
    Object.fromEntries(
      Object.entries(assignedEntries).map(([code, v]) => [
        code,
        { label: v.label, imageUrl: playerById.get(v.playerId)?.imageUrl ?? null },
      ])
    );

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
        formationKey: attachFormation ? formationKey : null,
        formationAssignments: attachFormation ? assignedEntries : null,
      });
      if (result.ok) {
        setBody("");
        setAttachFormation(false);
        setAssignments({});
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

        {/* フォーメーション案の添付 */}
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={attachFormation}
            onChange={(e) => setAttachFormation(e.target.checked)}
            className="h-4 w-4"
          />
          ⚽ フォーメーション案を付ける
        </label>

        {attachFormation && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">フォーメーション</span>
              <select
                value={formationKey}
                onChange={(e) => {
                  setFormationKey(e.target.value);
                  setAssignments({});
                }}
                className="input !w-auto !py-1.5"
              >
                {Object.values(FORMATIONS).map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {players.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {formation.positions.map((code) => (
                  <label key={code} className="text-xs">
                    <span className="font-mono font-bold">{code}</span>
                    <select
                      value={assignments[code]?.playerId ?? ""}
                      onChange={(e) => {
                        const selected = playerById.get(e.target.value);
                        setAssignments((prev) => ({
                          ...prev,
                          [code as PositionCode]: selected
                            ? { playerId: selected.playerId, label: selected.label }
                            : undefined,
                        }));
                      }}
                      className="input mt-0.5 !py-1 text-xs"
                    >
                      <option value="">未定</option>
                      {players.map((p) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            {/* プレビュー */}
            <FormationSnapshot
              formationKey={formationKey}
              assignments={previewAssignments}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={
            isPending || (body.trim().length === 0 && !attachFormation)
          }
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
              {p.body && (
                <p className="mt-1 whitespace-pre-wrap break-words">{p.body}</p>
              )}
              {p.formationKey && (
                <FormationSnapshot
                  formationKey={p.formationKey}
                  assignments={p.formationAssignments ?? {}}
                  className="mt-2"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
