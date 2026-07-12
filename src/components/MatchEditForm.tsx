"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateMatch } from "@/server/actions/matchDays";

export interface MatchDto {
  id: string;
  matchNumber: number;
  opponentName: string;
  startTime: string;
  courtName: string;
  notes: string;
  scoreFor: number | null;
  scoreAgainst: number | null;
  assigned: boolean;
}

export function MatchEditForm({ match }: { match: MatchDto }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateMatch(match.id, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <span className="font-bold">第{match.matchNumber}試合</span>
          <span className="ml-2 text-slate-600">
            {match.opponentName ? `vs ${match.opponentName}` : "(対戦相手未定)"}
            {match.startTime && ` ・${match.startTime}〜`}
          </span>
          {match.scoreFor != null && match.scoreAgainst != null && (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="font-mono font-bold">
                {match.scoreFor} - {match.scoreAgainst}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                  match.scoreFor > match.scoreAgainst
                    ? "bg-emerald-100 text-emerald-700"
                    : match.scoreFor < match.scoreAgainst
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-200 text-slate-600"
                }`}
              >
                {match.scoreFor > match.scoreAgainst
                  ? "勝"
                  : match.scoreFor < match.scoreAgainst
                    ? "負"
                    : "分"}
              </span>
            </span>
          )}
        </div>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              match.assigned
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {match.assigned ? "編成済み" : "未編成"}
          </span>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3 border-t pt-3">
          {error && (
            <p className="rounded bg-red-50 p-2 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">対戦相手</label>
              <input
                name="opponentName"
                defaultValue={match.opponentName}
                maxLength={100}
                className="input"
              />
            </div>
            <div>
              <label className="label">開始時刻</label>
              <input
                type="time"
                name="startTime"
                defaultValue={match.startTime}
                className="input"
              />
            </div>
            <div>
              <label className="label">コート名</label>
              <input
                name="courtName"
                defaultValue={match.courtName}
                maxLength={100}
                className="input"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label">得点</label>
                <input
                  type="number"
                  name="scoreFor"
                  defaultValue={match.scoreFor ?? ""}
                  min={0}
                  className="input"
                />
              </div>
              <span className="pb-3 font-bold">-</span>
              <div className="flex-1">
                <label className="label">失点</label>
                <input
                  type="number"
                  name="scoreAgainst"
                  defaultValue={match.scoreAgainst ?? ""}
                  min={0}
                  className="input"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">メモ</label>
              <input
                name="notes"
                defaultValue={match.notes}
                maxLength={500}
                className="input"
              />
            </div>
          </div>
          <button type="submit" disabled={isPending} className="btn-primary w-full">
            {isPending ? "保存中..." : "試合情報を保存"}
          </button>
        </form>
      )}
    </div>
  );
}
