"use client";

import { useEffect, useRef, useState } from "react";
import { SLOT_SECONDS } from "@/lib/constants";

// 交代タイマー音 (Web Audioでビープ3回)
function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      const start = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.start(start);
      osc.stop(start + 0.3);
    }
  } catch {
    // 音が出せない環境では無視 (バイブのみ)
  }
}

// 試合当日用の交代タイマー (7分30秒カウントダウン)
// 終了時に音とバイブで知らせ、「次の区分へ」の切替を促す
export function PeriodTimer({
  periodLabel,
  hasNext,
  onNext,
}: {
  periodLabel: string;
  hasNext: boolean;
  onNext: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(SLOT_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          setFinished(true);
          playBeep();
          navigator.vibrate?.([300, 100, 300, 100, 600]);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const reset = () => {
    setRunning(false);
    setFinished(false);
    setRemaining(SLOT_SECONDS);
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${minutes}:${String(seconds).padStart(2, "0")}`;
  const progress = 1 - remaining / SLOT_SECONDS;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary w-full !py-2 text-sm"
      >
        ⏱ 交代タイマーを表示 (7分30秒)
      </button>
    );
  }

  return (
    <div
      className={`card space-y-2 ${
        finished ? "border-orange-400 bg-orange-50" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-slate-500">{periodLabel}</div>
          <div
            className={`font-mono text-4xl font-black tabular-nums ${
              finished
                ? "text-orange-600"
                : remaining <= 60
                  ? "text-red-600"
                  : "text-slate-800"
            }`}
          >
            {display}
          </div>
        </div>
        <div className="flex gap-1.5">
          {!finished && (
            <button
              onClick={() => setRunning(!running)}
              className={`btn ${running ? "btn-secondary" : "btn-primary"} !px-4 !py-2.5`}
            >
              {running ? "⏸ 停止" : "▶ 開始"}
            </button>
          )}
          <button onClick={reset} className="btn-secondary !px-3 !py-2.5">
            ↺
          </button>
          <button
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="btn-secondary !px-3 !py-2.5"
            aria-label="タイマーを閉じる"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 進行バー */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            finished ? "bg-orange-500" : remaining <= 60 ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {finished && (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm font-bold text-orange-700">
            🔔 交代の時間です!
          </span>
          {hasNext && (
            <button
              onClick={() => {
                reset();
                onNext();
              }}
              className="btn-primary !py-2"
            >
              次の区分へ →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
