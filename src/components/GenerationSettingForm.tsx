"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PRESETS, PRESET_LABELS } from "@/lib/constants";
import { saveGenerationSetting } from "@/server/actions/matchDays";

interface SettingValues {
  beginnerLimit: number;
  fairnessWeight: number;
  aptitudeWeight: number;
  continuityPenalty: number;
  positionRepeatPenalty: number;
  randomnessWeight: number;
  presetType: string;
}

const SLIDERS: {
  key: keyof Omit<SettingValues, "presetType" | "beginnerLimit">;
  label: string;
  hint: string;
}[] = [
  {
    key: "fairnessWeight",
    label: "出場時間の均等性",
    hint: "高いほど全員の出場時間を揃えようとします",
  },
  {
    key: "aptitudeWeight",
    label: "ポジション適性の優先",
    hint: "高いほど得意なポジションに配置します",
  },
  {
    key: "continuityPenalty",
    label: "連続出場を避ける度合い",
    hint: "高いほど適度に休憩を入れます",
  },
  {
    key: "positionRepeatPenalty",
    label: "ポジション経験の均等性",
    hint: "高いほど色々なポジションを経験させます",
  },
  {
    key: "randomnessWeight",
    label: "ランダム性の強さ",
    hint: "高いほど再生成ごとに違う編成になります",
  },
];

export function GenerationSettingForm({
  matchDayId,
  initial,
}: {
  matchDayId: string;
  initial: SettingValues;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const applyPreset = (presetType: string) => {
    const preset = PRESETS[presetType];
    if (!preset) return;
    setValues((prev) => ({ ...prev, ...preset, presetType }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, String(value));
    }
    startTransition(async () => {
      const result = await saveGenerationSetting(matchDayId, formData);
      if (result.ok) {
        setMessage({ ok: true, text: "設定を保存しました。" });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`rounded-lg p-3 font-bold ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="card space-y-2">
        <h2 className="font-bold">プリセット</h2>
        <p className="text-sm text-slate-500">
          迷ったら「均等出場重視」がおすすめです。
        </p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PRESET_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded-lg border-2 p-3 font-bold ${
                values.presetType === key
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="font-bold">初心者の同時出場上限</h2>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() =>
                setValues((prev) => ({
                  ...prev,
                  beginnerLimit: n,
                  presetType: "CUSTOM",
                }))
              }
              className={`flex-1 rounded-lg border-2 py-3 text-lg font-bold ${
                values.beginnerLimit === n
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {n}人
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-bold">詳細設定</h2>
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">{s.label}</label>
              <span className="font-mono font-bold text-emerald-700">
                {values[s.key]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={values[s.key]}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [s.key]: Number(e.target.value),
                  presetType: "CUSTOM",
                }))
              }
              className="w-full accent-emerald-600"
            />
            <p className="text-xs text-slate-500">{s.hint}</p>
          </div>
        ))}
      </div>

      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? "保存中..." : "設定を保存する"}
      </button>
    </form>
  );
}
