"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createMatchDay,
  deleteMatchDay,
  updateMatchDay,
} from "@/server/actions/matchDays";
import { PlayerAvatar } from "./PlayerAvatar";

export interface MatchDayFormPlayer {
  id: string;
  name: string;
  jerseyNumber: number;
  imageUrl: string | null;
  isBeginner: boolean;
}

export interface MatchDayFormValues {
  id?: string;
  matchDate: string;
  eventName: string;
  venue: string;
  meetingTime: string;
  numberOfMatches: number;
  notes: string;
  participantIds: string[];
  hasLineup?: boolean;
}

export function MatchDayForm({
  initial,
  allPlayers,
}: {
  initial: MatchDayFormValues;
  allPlayers: MatchDayFormPlayer[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial.participantIds)
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const newCount = Number(formData.get("numberOfMatches"));
    if (
      initial.id &&
      initial.hasLineup &&
      newCount < initial.numberOfMatches &&
      !window.confirm(
        "試合数を減らすと、削除される試合の編成データも消えます。よろしいですか?"
      )
    ) {
      return;
    }

    for (const id of selected) formData.append("participantIds", id);

    startTransition(async () => {
      const result = initial.id
        ? await updateMatchDay(initial.id, formData)
        : await createMatchDay(formData);
      if (result.ok) {
        router.push(`/match-days/${result.id}`);
        router.refresh();
      } else {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const handleDelete = () => {
    if (!initial.id) return;
    if (
      !window.confirm(
        "この試合日を削除します。試合・編成・出場記録もすべて削除されます。よろしいですか?"
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteMatchDay(initial.id!);
      if (result.ok) {
        router.push("/match-days");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">日付 *</label>
          <input
            type="date"
            name="matchDate"
            defaultValue={initial.matchDate}
            required
            className="input"
          />
        </div>
        <div>
          <label className="label">大会名・イベント名</label>
          <input
            name="eventName"
            defaultValue={initial.eventName}
            maxLength={100}
            className="input"
            placeholder="○○カップ"
          />
        </div>
        <div>
          <label className="label">会場</label>
          <input
            name="venue"
            defaultValue={initial.venue}
            maxLength={100}
            className="input"
            placeholder="○○グラウンド"
          />
        </div>
        <div>
          <label className="label">集合時間</label>
          <input
            type="time"
            name="meetingTime"
            defaultValue={initial.meetingTime}
            className="input"
          />
        </div>
        <div>
          <label className="label">試合数 *</label>
          <select
            name="numberOfMatches"
            defaultValue={initial.numberOfMatches}
            className="input"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}試合
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">メモ</label>
          <textarea
            name="notes"
            defaultValue={initial.notes}
            maxLength={500}
            rows={2}
            className="input"
          />
        </div>
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">
            参加選手 ({selected.size}人選択中 / 8人以上必要)
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary !py-1 text-sm"
              onClick={() => setSelected(new Set(allPlayers.map((p) => p.id)))}
            >
              全員
            </button>
            <button
              type="button"
              className="btn-secondary !py-1 text-sm"
              onClick={() => setSelected(new Set())}
            >
              解除
            </button>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {allPlayers.map((p) => {
            const active = selected.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border-2 p-2 text-left ${
                    active
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 bg-white opacity-60"
                  }`}
                >
                  <PlayerAvatar imageUrl={p.imageUrl} name={p.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {p.jerseyNumber} {p.name}
                    </span>
                    {p.isBeginner && <span className="text-xs">🔰</span>}
                  </span>
                  <span className="text-lg">{active ? "✅" : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? "保存中..." : "保存する"}
        </button>
        {initial.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="btn-danger"
          >
            削除
          </button>
        )}
      </div>
    </form>
  );
}
