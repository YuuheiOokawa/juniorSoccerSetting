"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { duplicateMatchDay } from "@/server/actions/matchDays";

// 試合日をコピーして新しい日付で作成するボタン
export function DuplicateMatchDayButton({
  matchDayId,
  defaultDate,
}: {
  matchDayId: string;
  defaultDate: string; // YYYY-MM-DD (元の日付+7日など)
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);

  const handleDuplicate = () => {
    setError(null);
    startTransition(async () => {
      const result = await duplicateMatchDay(matchDayId, date);
      if (result.ok && result.id) {
        router.push(`/match-days/${result.id}`);
        router.refresh();
      } else if (!result.ok) {
        setError(result.error);
      }
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary !py-1.5 text-sm"
      >
        📋 この試合日をコピー
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <span className="w-full text-sm font-bold text-red-600">{error}</span>
      )}
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="input !w-auto !py-1.5"
      />
      <button
        onClick={handleDuplicate}
        disabled={isPending || !date}
        className="btn-primary !py-1.5 text-sm"
      >
        {isPending ? "作成中..." : "この日付で作成"}
      </button>
      <button
        onClick={() => setOpen(false)}
        disabled={isPending}
        className="btn-secondary !py-1.5 text-sm"
      >
        キャンセル
      </button>
    </div>
  );
}
