"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ATTENDANCE_LABELS } from "@/lib/constants";
import { saveAttendance } from "@/server/actions/matchDays";
import { PlayerAvatar } from "./PlayerAvatar";

export interface AttendanceEntry {
  playerId: string;
  name: string;
  jerseyNumber: number;
  imageUrl: string | null;
  attendanceStatus: string;
  isBeginnerOnDay: boolean;
  canPlayGk: boolean;
  canPlay: boolean;
  maxPlayingSlots: number | null;
  priority: number;
  notes: string;
}

export function AttendanceEditor({
  matchDayId,
  entries: initialEntries,
}: {
  matchDayId: string;
  entries: AttendanceEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState(initialEntries);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [dirty, setDirty] = useState(false);

  const update = (playerId: string, patch: Partial<AttendanceEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.playerId === playerId ? { ...e, ...patch } : e))
    );
    setDirty(true);
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveAttendance(
        matchDayId,
        entries.map((e) => ({
          playerId: e.playerId,
          attendanceStatus: e.attendanceStatus,
          isBeginnerOnDay: e.isBeginnerOnDay,
          canPlayGk: e.canPlayGk,
          canPlay: e.canPlay,
          maxPlayingSlots: e.maxPlayingSlots,
          priority: e.priority,
          notes: e.notes,
        }))
      );
      if (result.ok) {
        setDirty(false);
        setMessage({ ok: true, text: "保存しました。" });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  };

  const presentCount = entries.filter(
    (e) => e.canPlay && !["ABSENT", "INJURED", "SICK"].includes(e.attendanceStatus)
  ).length;

  // 一括設定
  const setAllAttendance = (status: "PRESENT" | "ABSENT") => {
    if (
      status === "ABSENT" &&
      !window.confirm("全員を「欠席」にします。よろしいですか?")
    )
      return;
    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        attendanceStatus: status,
        canPlay: status === "PRESENT",
      }))
    );
    setDirty(true);
  };

  return (
    <div className="space-y-3">
      <div className="sticky top-14 z-30 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="font-bold">出場可能: {presentCount}人</span>
        <button
          onClick={() => setAllAttendance("PRESENT")}
          className="btn-secondary !py-1 text-xs"
        >
          全員参加
        </button>
        <button
          onClick={() => setAllAttendance("ABSENT")}
          className="btn-secondary !py-1 text-xs"
        >
          全員欠席
        </button>
        {dirty && (
          <span className="text-sm font-bold text-amber-600">未保存の変更あり</span>
        )}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="btn-primary ml-auto !py-2"
        >
          {isPending ? "保存中..." : "保存する"}
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 font-bold ${
            message.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <ul className="space-y-2">
        {entries.map((e) => {
          const isOut =
            !e.canPlay ||
            ["ABSENT", "INJURED", "SICK"].includes(e.attendanceStatus);
          return (
            <li key={e.playerId} className={`card ${isOut ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
                <PlayerAvatar imageUrl={e.imageUrl} name={e.name} size={40} />
                <span className="font-mono font-bold text-slate-500">
                  {e.jerseyNumber}
                </span>
                <span className="flex-1 font-bold">{e.name}</span>
                <select
                  value={e.attendanceStatus}
                  onChange={(ev) =>
                    update(e.playerId, { attendanceStatus: ev.target.value })
                  }
                  className="input w-auto !py-1.5"
                >
                  {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <label className="flex items-center gap-1.5 font-bold">
                  <input
                    type="checkbox"
                    checked={e.canPlay}
                    onChange={(ev) => update(e.playerId, { canPlay: ev.target.checked })}
                    className="h-4 w-4"
                  />
                  出場可
                </label>
                <label className="flex items-center gap-1.5 font-bold">
                  <input
                    type="checkbox"
                    checked={e.canPlayGk}
                    onChange={(ev) =>
                      update(e.playerId, { canPlayGk: ev.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  GK可
                </label>
                <label className="flex items-center gap-1.5 font-bold">
                  <input
                    type="checkbox"
                    checked={e.isBeginnerOnDay}
                    onChange={(ev) =>
                      update(e.playerId, { isBeginnerOnDay: ev.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  🔰初心者扱い
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="font-bold">出場上限</span>
                  <select
                    value={e.maxPlayingSlots ?? ""}
                    onChange={(ev) =>
                      update(e.playerId, {
                        maxPlayingSlots:
                          ev.target.value === "" ? null : Number(ev.target.value),
                      })
                    }
                    className="input w-auto !py-1"
                  >
                    <option value="">なし</option>
                    {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}枠
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="font-bold">優先度</span>
                  <select
                    value={e.priority}
                    onChange={(ev) =>
                      update(e.playerId, { priority: Number(ev.target.value) })
                    }
                    className="input w-auto !py-1"
                  >
                    {[2, 1, 0, -1, -2].map((n) => (
                      <option key={n} value={n}>
                        {n > 0 ? `+${n}` : n}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  value={e.notes}
                  onChange={(ev) => update(e.playerId, { notes: ev.target.value })}
                  placeholder="当日メモ"
                  maxLength={200}
                  className="input !w-40 !py-1"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
