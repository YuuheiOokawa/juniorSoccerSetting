"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateLineupAction } from "@/server/actions/lineup";

interface AssignmentDto {
  periodId: string;
  positionCode: string;
  playerId: string;
  isLocked: boolean;
  isManual: boolean;
}

export function GenerateButton({
  matchDayId,
  currentAssignments,
  hasExisting,
  disabled,
}: {
  matchDayId: string;
  currentAssignments: AssignmentDto[];
  hasExisting: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleGenerate = () => {
    if (
      hasExisting &&
      !window.confirm(
        "既存の編成を作り直します。固定した配置は維持されます。よろしいですか?"
      )
    )
      return;
    setErrors([]);
    setWarnings([]);
    startTransition(async () => {
      const result = await generateLineupAction({
        matchDayId,
        scope: { type: "day" },
        currentAssignments,
      });
      if (result.ok) {
        setWarnings(result.warnings);
        router.push(`/match-days/${matchDayId}/formation`);
        router.refresh();
      } else {
        setErrors([result.error, ...(result.errors ?? [])]);
      }
    });
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleGenerate}
        disabled={disabled || isPending}
        className="btn-primary w-full text-lg"
      >
        {isPending ? "編成を作成中..." : hasExisting ? "🔄 全体を再生成する" : "✨ 自動編成を実行する"}
      </button>
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-700">
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
