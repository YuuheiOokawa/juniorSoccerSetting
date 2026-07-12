"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  CATEGORY_COLORS,
  PERIOD_SHORT_LABELS,
  categoryOf,
  formatSlots,
  getFormation,
  type PeriodType,
  type PositionCode,
} from "@/lib/constants";
import {
  confirmLineupAction,
  generateLineupAction,
  saveLineupAction,
} from "@/server/actions/lineup";
import { PlayerAvatar } from "../PlayerAvatar";

// ============================================================
// 型
// ============================================================

export interface BoardPlayer {
  playerId: string;
  name: string;
  jerseyNumber: number;
  imageUrl: string | null;
  aptitudes: Record<PositionCode, number>;
  isBeginner: boolean;
  canPlay: boolean;
  maxPlayingSlots: number | null;
  priority: number;
  overall: number | null; // 能力値から算出した総合値 (未設定はnull)
}

// 総合値バッジ (金/銀/銅) の配色
function ratingClass(overall: number): string {
  if (overall >= 80)
    return "bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 text-amber-950";
  if (overall >= 60)
    return "bg-gradient-to-b from-slate-100 via-slate-300 to-slate-500 to-90% text-slate-800";
  return "bg-gradient-to-b from-orange-200 via-orange-400 to-orange-600 text-orange-950";
}

export interface BoardMatch {
  id: string;
  matchNumber: number;
  opponentName: string;
  periods: { id: string; periodType: string; periodOrder: number }[];
}

export interface BoardAssignment {
  periodId: string;
  positionCode: PositionCode;
  playerId: string;
  isLocked: boolean;
  isManual: boolean;
}

type Selection =
  | { type: "court"; positionCode: PositionCode }
  | { type: "bench"; playerId: string }
  | null;

// ドロップ先 (data-drop属性でヒットテストする)
type DropTarget =
  | { type: "court"; positionCode: PositionCode }
  | { type: "bench"; playerId: string }
  | { type: "bench-area" }
  | null;

// ドラッグ中の状態
interface DragState {
  source: NonNullable<Selection>;
  playerId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean; // 閾値を超えて実際にドラッグ中か (falseならタップ扱い)
}

const DRAG_THRESHOLD_PX = 8;

function parseDropTarget(el: Element | null): DropTarget {
  const dropEl = el?.closest("[data-drop]");
  const value = dropEl?.getAttribute("data-drop");
  if (!value) return null;
  if (value === "bench-area") return { type: "bench-area" };
  const [kind, key] = value.split(":");
  if (kind === "court") {
    return { type: "court", positionCode: key as PositionCode };
  }
  if (kind === "bench") return { type: "bench", playerId: key };
  return null;
}

// ============================================================
// 本体
// ============================================================

export function FormationBoard({
  matchDayId,
  status: initialStatus,
  players,
  matches,
  initialAssignments,
  beginnerLimit,
  formation: formationKey,
}: {
  matchDayId: string;
  status: string;
  players: BoardPlayer[];
  matches: BoardMatch[];
  initialAssignments: BoardAssignment[];
  beginnerLimit: number;
  formation: string;
}) {
  const formation = getFormation(formationKey);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [history, setHistory] = useState<BoardAssignment[][]>([]);
  const [status, setStatus] = useState(initialStatus);
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverTarget, setHoverTarget] = useState<DropTarget>(null);
  const dragRef = useRef<DragState | null>(null);
  const [matchIndex, setMatchIndex] = useState(0);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [messages, setMessages] = useState<{ type: "error" | "warn" | "ok"; text: string }[]>([]);

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.playerId, p])),
    [players]
  );

  const currentMatch = matches[matchIndex];
  const currentPeriod = currentMatch?.periods[periodIndex];
  const readonly = status === "CONFIRMED";

  const periodAssignments = useMemo(
    () =>
      currentPeriod
        ? assignments.filter((a) => a.periodId === currentPeriod.id)
        : [],
    [assignments, currentPeriod]
  );

  const slotCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of players) counts.set(p.playerId, 0);
    for (const a of assignments) {
      counts.set(a.playerId, (counts.get(a.playerId) ?? 0) + 1);
    }
    return counts;
  }, [assignments, players]);

  const avgSlots = useMemo(() => {
    const playable = players.filter((p) => p.canPlay);
    if (playable.length === 0) return 0;
    const total = [...slotCounts.entries()]
      .filter(([id]) => playerMap.get(id)?.canPlay)
      .reduce((sum, [, c]) => sum + c, 0);
    return total / playable.length;
  }, [players, slotCounts, playerMap]);

  const benchPlayers = useMemo(() => {
    const onCourt = new Set(periodAssignments.map((a) => a.playerId));
    return players
      .filter((p) => p.canPlay && !onCourt.has(p.playerId))
      .sort(
        (a, b) =>
          (slotCounts.get(a.playerId) ?? 0) - (slotCounts.get(b.playerId) ?? 0)
      );
  }, [players, periodAssignments, slotCounts]);

  const beginnerCount = periodAssignments.filter(
    (a) => playerMap.get(a.playerId)?.isBeginner
  ).length;

  // ---- 編集操作 ----

  const pushHistory = () => {
    setHistory((prev) => [...prev.slice(-30), assignments.map((a) => ({ ...a }))]);
    setDirty(true);
  };

  const undo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      setAssignments(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
    setSelection(null);
  };

  const mutate = (fn: (list: BoardAssignment[]) => BoardAssignment[]) => {
    pushHistory();
    setAssignments((prev) => fn(prev.map((a) => ({ ...a }))));
    setSelection(null);
  };

  // コート上のポジションをタップしたとき
  const handleCourtTap = (positionCode: PositionCode) => {
    if (readonly) return;
    const current = periodAssignments.find((a) => a.positionCode === positionCode);

    if (!selection) {
      if (current) setSelection({ type: "court", positionCode });
      return;
    }

    if (selection.type === "court") {
      if (selection.positionCode === positionCode) {
        setSelection(null);
        return;
      }
      // コート上同士: ポジションを入れ替え
      const a = periodAssignments.find(
        (x) => x.positionCode === selection.positionCode
      );
      const b = current;
      if (!a) {
        setSelection(null);
        return;
      }
      mutate((list) =>
        list.map((x) => {
          if (x.periodId !== currentPeriod!.id) return x;
          if (x.positionCode === selection.positionCode) {
            // 移動元: 相手がいれば選手を入れ替え、空きなら移動
            return b
              ? { ...x, playerId: b.playerId, isManual: true, isLocked: false }
              : { ...x, positionCode, isManual: true, isLocked: false };
          }
          if (x.positionCode === positionCode && b) {
            return { ...x, playerId: a.playerId, isManual: true, isLocked: false };
          }
          return x;
        })
      );
    } else {
      // 控え選手 → コート: 交代
      const benchPlayer = playerMap.get(selection.playerId);
      if (!benchPlayer) return;
      mutate((list) => {
        const idx = list.findIndex(
          (x) =>
            x.periodId === currentPeriod!.id && x.positionCode === positionCode
        );
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            playerId: selection.playerId,
            isManual: true,
            isLocked: false,
          };
        } else {
          list.push({
            periodId: currentPeriod!.id,
            positionCode,
            playerId: selection.playerId,
            isLocked: false,
            isManual: true,
          });
        }
        return list;
      });
    }
  };

  const handleBenchTap = (playerId: string) => {
    if (readonly) return;
    if (!selection) {
      setSelection({ type: "bench", playerId });
      return;
    }
    if (selection.type === "bench") {
      setSelection(
        selection.playerId === playerId ? null : { type: "bench", playerId }
      );
      return;
    }
    // コート → 控え: そのポジションに控え選手を入れる
    mutate((list) =>
      list.map((x) =>
        x.periodId === currentPeriod!.id &&
        x.positionCode === selection.positionCode
          ? { ...x, playerId, isManual: true, isLocked: false }
          : x
      )
    );
  };

  const toggleLock = (positionCode: PositionCode) => {
    if (readonly) return;
    mutate((list) =>
      list.map((x) =>
        x.periodId === currentPeriod!.id && x.positionCode === positionCode
          ? { ...x, isLocked: !x.isLocked }
          : x
      )
    );
  };

  // ---- ドラッグ&ドロップ ----

  const performDrop = (source: NonNullable<Selection>, target: DropTarget) => {
    if (!target || readonly || !currentPeriod) return;

    if (source.type === "court") {
      const sourceAssignment = periodAssignments.find(
        (a) => a.positionCode === source.positionCode
      );
      if (!sourceAssignment) return;

      if (target.type === "court") {
        // コート内: 選手を入れ替え (空きポジションなら移動)
        if (target.positionCode === source.positionCode) return;
        const targetAssignment = periodAssignments.find(
          (a) => a.positionCode === target.positionCode
        );
        mutate((list) =>
          list.map((x) => {
            if (x.periodId !== currentPeriod.id) return x;
            if (x.positionCode === source.positionCode) {
              return targetAssignment
                ? {
                    ...x,
                    playerId: targetAssignment.playerId,
                    isManual: true,
                    isLocked: false,
                  }
                : {
                    ...x,
                    positionCode: target.positionCode,
                    isManual: true,
                    isLocked: false,
                  };
            }
            if (x.positionCode === target.positionCode && targetAssignment) {
              return {
                ...x,
                playerId: sourceAssignment.playerId,
                isManual: true,
                isLocked: false,
              };
            }
            return x;
          })
        );
      } else if (target.type === "bench") {
        // 控え選手カードへドロップ: その控え選手と交代
        mutate((list) =>
          list.map((x) =>
            x.periodId === currentPeriod.id &&
            x.positionCode === source.positionCode
              ? { ...x, playerId: target.playerId, isManual: true, isLocked: false }
              : x
          )
        );
      } else {
        // 控えエリアへドロップ: ポジションから外す (空きスロットになる)
        mutate((list) =>
          list.filter(
            (x) =>
              !(
                x.periodId === currentPeriod.id &&
                x.positionCode === source.positionCode
              )
          )
        );
      }
    } else if (target.type === "court") {
      // 控え選手 → コートのポジション (交代または空きへ配置)
      mutate((list) => {
        const idx = list.findIndex(
          (x) =>
            x.periodId === currentPeriod.id &&
            x.positionCode === target.positionCode
        );
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            playerId: source.playerId,
            isManual: true,
            isLocked: false,
          };
        } else {
          list.push({
            periodId: currentPeriod.id,
            positionCode: target.positionCode,
            playerId: source.playerId,
            isLocked: false,
            isManual: true,
          });
        }
        return list;
      });
    }
  };

  // カード上でポインターを押した時。playerId が null (空きポジション) の
  // 場合はドラッグせずタップのみ受け付ける。
  const handlePointerDown = (
    e: React.PointerEvent,
    source: NonNullable<Selection>,
    playerId: string | null
  ) => {
    if (readonly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const d: DragState = {
      source,
      playerId: playerId ?? "",
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
    };
    dragRef.current = d;
    setDrag(d);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.active) {
      // 空きポジションはドラッグ不可
      if (!d.playerId) return;
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (dist < DRAG_THRESHOLD_PX) return;
      d.active = true;
    }
    d.x = e.clientX;
    d.y = e.clientY;
    setDrag({ ...d });
    // ゴーストは pointer-events: none のためヒットテストを妨げない
    setHoverTarget(
      parseDropTarget(document.elementFromPoint(e.clientX, e.clientY))
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    setHoverTarget(null);
    if (!d) return;
    if (d.active) {
      performDrop(
        d.source,
        parseDropTarget(document.elementFromPoint(e.clientX, e.clientY))
      );
      setSelection(null);
    } else {
      // 動かさず離した場合は従来どおりタップとして扱う
      if (d.source.type === "court") handleCourtTap(d.source.positionCode);
      else handleBenchTap(d.source.playerId);
    }
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    setDrag(null);
    setHoverTarget(null);
  };

  // ---- サーバー操作 ----

  const runGenerate = (
    scope:
      | { type: "day" }
      | { type: "match"; matchId: string }
      | { type: "period"; periodId: string },
    confirmText: string
  ) => {
    if (!window.confirm(confirmText)) return;
    setMessages([]);
    startTransition(async () => {
      const result = await generateLineupAction({
        matchDayId,
        scope,
        currentAssignments: assignments,
      });
      if (result.ok) {
        if (result.assignments) {
          setAssignments(result.assignments as BoardAssignment[]);
        }
        setHistory([]);
        setDirty(false);
        setStatus("GENERATED");
        setMessages([
          { type: "ok", text: "編成を作成しました。" },
          ...result.warnings.map((w) => ({ type: "warn" as const, text: w })),
        ]);
        router.refresh();
      } else {
        setMessages(
          [result.error, ...(result.errors ?? [])].map((text) => ({
            type: "error",
            text,
          }))
        );
      }
    });
  };

  const save = () => {
    setMessages([]);
    startTransition(async () => {
      const result = await saveLineupAction({ matchDayId, assignments });
      if (result.ok) {
        setDirty(false);
        setStatus("EDITING");
        setMessages([
          { type: "ok", text: "保存しました。" },
          ...result.warnings.map((w) => ({ type: "warn" as const, text: w })),
        ]);
        router.refresh();
      } else {
        setMessages([{ type: "error", text: result.error }]);
      }
    });
  };

  const confirmLineup = (confirm: boolean) => {
    if (confirm && dirty) {
      setMessages([
        { type: "error", text: "先に保存してから確定してください。" },
      ]);
      return;
    }
    if (
      !window.confirm(
        confirm
          ? "編成を確定します。よろしいですか?"
          : "確定を解除して編集できるようにします。よろしいですか?"
      )
    )
      return;
    setMessages([]);
    startTransition(async () => {
      const result = await confirmLineupAction(matchDayId, confirm);
      if (result.ok) {
        setStatus(confirm ? "CONFIRMED" : "EDITING");
        setMessages([
          { type: "ok", text: confirm ? "確定しました。" : "確定を解除しました。" },
        ]);
        router.refresh();
      } else {
        setMessages(
          [result.error, ...(result.errors ?? [])].map((text) => ({
            type: "error",
            text,
          }))
        );
      }
    });
  };

  if (!currentMatch || !currentPeriod) {
    return <p className="card text-slate-500">試合が登録されていません。</p>;
  }

  const selectedCourtAssignment =
    selection?.type === "court"
      ? periodAssignments.find((a) => a.positionCode === selection.positionCode)
      : null;

  // ---- 描画 ----

  return (
    <div className="space-y-3">
      {/* メッセージ */}
      {messages.length > 0 && (
        <div className="no-print space-y-1">
          {messages.map((m, i) => (
            <p
              key={i}
              className={`rounded-lg p-2.5 text-sm font-bold ${
                m.type === "error"
                  ? "bg-red-50 text-red-700"
                  : m.type === "warn"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {m.text}
            </p>
          ))}
        </div>
      )}

      {/* 試合タブ */}
      <div className="no-print flex gap-1 overflow-x-auto">
        {matches.map((m, i) => (
          <button
            key={m.id}
            onClick={() => {
              setMatchIndex(i);
              setSelection(null);
            }}
            className={`shrink-0 rounded-lg px-4 py-2 font-bold ${
              i === matchIndex
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 border border-slate-300"
            }`}
          >
            第{m.matchNumber}試合
            {m.opponentName && (
              <span className="ml-1 text-xs font-normal">vs {m.opponentName}</span>
            )}
          </button>
        ))}
      </div>

      {/* 時間帯タブ */}
      <div className="no-print grid grid-cols-4 gap-1">
        {currentMatch.periods.map((p, i) => (
          <button
            key={p.id}
            onClick={() => {
              setPeriodIndex(i);
              setSelection(null);
            }}
            className={`rounded-lg px-1 py-2 text-sm font-bold ${
              i === periodIndex
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 border border-slate-300"
            }`}
          >
            {PERIOD_SHORT_LABELS[p.periodType as PeriodType] ?? p.periodType}
          </button>
        ))}
      </div>

      {/* 状態バー */}
      <div className="no-print flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-slate-800 px-2.5 py-1 font-bold text-white">
          ⚽ {formation.label}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 font-bold ${
            beginnerCount > beginnerLimit
              ? "bg-red-100 text-red-700"
              : "bg-sky-100 text-sky-700"
          }`}
        >
          🔰 {beginnerCount}/{beginnerLimit}人
        </span>
        {periodAssignments.length < 8 && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 font-bold text-red-700">
            ⚠️ {8 - periodAssignments.length}ポジション空き
          </span>
        )}
        {dirty && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-700">
            未保存の変更あり
          </span>
        )}
        {readonly && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-700">
            ✅ 確定済み (編集するには確定解除)
          </span>
        )}
      </div>

      <div className="gap-3 lg:grid lg:grid-cols-[1fr_320px]">
        {/* サッカーコート (スタジアム風) */}
        <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-4 ring-slate-900/70">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 300 400"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="grassBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3fae52" />
                <stop offset="55%" stopColor="#2c9142" />
                <stop offset="100%" stopColor="#1c6e30" />
              </linearGradient>
              <radialGradient id="stadiumLight" cx="50%" cy="30%" r="80%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
                <stop offset="55%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
              </radialGradient>
            </defs>

            {/* 芝 + 刈り込み模様 (横縞と薄い縦縞) */}
            <rect width="300" height="400" fill="url(#grassBase)" />
            {Array.from({ length: 5 }, (_, i) => (
              <rect
                key={`h${i}`}
                x="0"
                y={i * 80}
                width="300"
                height="40"
                fill="rgba(255,255,255,0.06)"
              />
            ))}
            {Array.from({ length: 4 }, (_, i) => (
              <rect
                key={`v${i}`}
                x={i * 75}
                y="0"
                width="37.5"
                height="400"
                fill="rgba(0,0,0,0.045)"
              />
            ))}

            {/* ライン */}
            <g
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              <rect x="10" y="10" width="280" height="380" rx="2" />
              <line x1="10" y1="200" x2="290" y2="200" />
              <circle cx="150" cy="200" r="36" />
              {/* 上側 (相手陣) ペナルティエリア */}
              <rect x="70" y="10" width="160" height="52" />
              <rect x="112" y="10" width="76" height="20" />
              <path d="M 116 62 A 34 34 0 0 0 184 62" />
              {/* 下側 (自陣) ペナルティエリア */}
              <rect x="70" y="338" width="160" height="52" />
              <rect x="112" y="370" width="76" height="20" />
              <path d="M 116 338 A 34 34 0 0 1 184 338" />
              {/* コーナーアーク */}
              <path d="M 10 18 A 8 8 0 0 0 18 10" />
              <path d="M 282 10 A 8 8 0 0 0 290 18" />
              <path d="M 10 382 A 8 8 0 0 1 18 390" />
              <path d="M 282 390 A 8 8 0 0 1 290 382" />
            </g>
            {/* スポット */}
            <g fill="rgba(255,255,255,0.85)">
              <circle cx="150" cy="200" r="2.5" />
              <circle cx="150" cy="48" r="2.5" />
              <circle cx="150" cy="352" r="2.5" />
            </g>
            {/* ゴール */}
            <g fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5">
              <rect x="126" y="4" width="48" height="6" />
              <rect x="126" y="390" width="48" height="6" />
            </g>

            {/* スタジアム照明のグラデーション */}
            <rect width="300" height="400" fill="url(#stadiumLight)" />
          </svg>

          {formation.positions.map((code) => {
            const layout = formation.layout[code] ?? { x: 50, y: 50 };
            const assignment = periodAssignments.find(
              (a) => a.positionCode === code
            );
            const player = assignment ? playerMap.get(assignment.playerId) : null;
            const colors = CATEGORY_COLORS[categoryOf(code)];
            const isSelected =
              selection?.type === "court" && selection.positionCode === code;
            const isDropHover =
              drag?.active &&
              hoverTarget?.type === "court" &&
              hoverTarget.positionCode === code;
            const isDragSource =
              drag?.active &&
              drag.source.type === "court" &&
              drag.source.positionCode === code;
            return (
              <button
                key={code}
                data-drop={`court:${code}`}
                onPointerDown={(e) =>
                  handlePointerDown(
                    e,
                    { type: "court", positionCode: code },
                    assignment?.playerId ?? null
                  )
                }
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                className={`absolute w-[92px] -translate-x-1/2 -translate-y-1/2 touch-none select-none rounded-xl text-center transition sm:w-[100px] ${
                  isDragSource ? "opacity-40 " : ""
                }${
                  isDropHover
                    ? "ring-4 ring-sky-400"
                    : isSelected
                      ? "ring-4 ring-yellow-400"
                      : ""
                }`}
                style={{ left: `${layout.x}%`, top: `${layout.y}%` }}
              >
                {player ? (
                  // ウイイレ風の選手カード (金縁 + 光沢)
                  <div className="relative flex flex-col items-center overflow-visible rounded-xl bg-gradient-to-b from-slate-600 via-slate-900 to-black px-1 pb-1 pt-2 shadow-[0_6px_14px_rgba(0,0,0,0.5)] ring-1 ring-amber-300/50">
                    {/* 光沢ハイライト */}
                    <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                    <span
                      className={`absolute -left-1.5 -top-2 rounded-md px-1.5 py-0.5 text-[10px] font-black shadow-md ring-1 ring-white/50 ${colors.badge}`}
                    >
                      {code}
                    </span>
                    {(assignment?.isLocked ||
                      (assignment?.isManual && !assignment.isLocked)) && (
                      <span className="absolute -right-1.5 -top-2 rounded-full bg-white/95 px-1 text-[11px] shadow-md ring-1 ring-slate-300">
                        {assignment.isLocked ? "🔒" : "✋"}
                      </span>
                    )}
                    <span className="relative">
                      <PlayerAvatar
                        imageUrl={player.imageUrl}
                        name={player.name}
                        size={40}
                        className={`ring-2 shadow-[0_0_10px_rgba(255,255,255,0.25)] ${colors.ring}`}
                      />
                      {player.overall != null && (
                        <span
                          className={`absolute -bottom-1 -right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-black shadow ring-1 ring-white/80 ${ratingClass(player.overall)}`}
                        >
                          {player.overall}
                        </span>
                      )}
                    </span>
                    <div className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-black/40 px-0.5">
                      <span className="font-mono text-[11px] font-black text-amber-300 drop-shadow">
                        {player.jerseyNumber}
                      </span>
                      <span className="max-w-[58px] truncate text-[11px] font-bold text-white drop-shadow">
                        {player.name}
                      </span>
                      {player.isBeginner && <span className="text-[9px]">🔰</span>}
                    </div>
                    <div className="text-[9px] leading-tight text-emerald-200/90">
                      {formatSlots(slotCounts.get(player.playerId) ?? 0)}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-white/80 bg-white/15 px-1 py-3 text-white shadow-inner backdrop-blur-[1px]">
                    <div className="text-[10px] font-black drop-shadow">{code}</div>
                    <div className="text-xs font-bold drop-shadow">タップで配置</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 右カラム: 選択中の操作 + 控え */}
        <div className="mt-3 space-y-3 lg:mt-0">
          {selectedCourtAssignment && !readonly && (
            <div className="no-print card flex items-center gap-2 border-yellow-300 bg-yellow-50">
              <span className="flex-1 text-sm font-bold">
                {playerMap.get(selectedCourtAssignment.playerId)?.name} (
                {selectedCourtAssignment.positionCode})
              </span>
              <button
                onClick={() => toggleLock(selectedCourtAssignment.positionCode)}
                className="btn-secondary !py-1.5 text-sm"
              >
                {selectedCourtAssignment.isLocked ? "🔓 固定解除" : "🔒 固定"}
              </button>
              <button
                onClick={() => setSelection(null)}
                className="btn-secondary !py-1.5 text-sm"
              >
                選択解除
              </button>
            </div>
          )}

          <div
            data-drop="bench-area"
            className={`card ${
              drag?.active &&
              drag.source.type === "court" &&
              hoverTarget?.type === "bench-area"
                ? "ring-4 ring-sky-400"
                : ""
            }`}
          >
            <h2 className="font-bold">
              控え選手 ({benchPlayers.length}人)
              <span className="ml-2 text-xs font-normal text-slate-500">
                出場時間が少ない順
              </span>
            </h2>
            {benchPlayers.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">全員出場中です。</p>
            ) : (
              <ul className="mt-2 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
                {benchPlayers.map((p) => {
                  const slots = slotCounts.get(p.playerId) ?? 0;
                  const needsPlay = slots < avgSlots - 0.5;
                  const isSelected =
                    selection?.type === "bench" && selection.playerId === p.playerId;
                  const isDropHover =
                    drag?.active &&
                    drag.source.type === "court" &&
                    hoverTarget?.type === "bench" &&
                    hoverTarget.playerId === p.playerId;
                  const isDragSource =
                    drag?.active &&
                    drag.source.type === "bench" &&
                    drag.source.playerId === p.playerId;
                  return (
                    <li key={p.playerId}>
                      <button
                        data-drop={`bench:${p.playerId}`}
                        onPointerDown={(e) =>
                          handlePointerDown(
                            e,
                            { type: "bench", playerId: p.playerId },
                            p.playerId
                          )
                        }
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        disabled={readonly}
                        className={`flex w-full touch-none select-none items-center gap-2 rounded-xl p-1.5 text-left shadow ring-1 transition ${
                          isDragSource ? "opacity-40 " : ""
                        }${
                          isDropHover
                            ? "bg-sky-800 ring-4 ring-sky-400"
                            : isSelected
                              ? "bg-slate-800 ring-4 ring-yellow-400"
                              : needsPlay
                                ? "bg-gradient-to-r from-slate-800 to-orange-950 ring-orange-400/60"
                                : "bg-gradient-to-r from-slate-700 to-slate-900 ring-white/20"
                        }`}
                      >
                        <span className="relative shrink-0">
                          <PlayerAvatar
                            imageUrl={p.imageUrl}
                            name={p.name}
                            size={32}
                            className="ring-2 ring-white/40"
                          />
                          {p.overall != null && (
                            <span
                              className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black shadow ring-1 ring-white/80 ${ratingClass(p.overall)}`}
                            >
                              {p.overall}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-white">
                            <span className="mr-1 font-mono font-black text-amber-300">
                              {p.jerseyNumber}
                            </span>
                            {p.name}
                            {p.isBeginner && "🔰"}
                          </span>
                          <span className="text-xs text-slate-300">
                            {formatSlots(slots)}
                            {needsPlay && (
                              <span className="ml-1 font-bold text-orange-400">
                                ↑優先
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-400">
              選手カードをドラッグしてポジションへドロップすると入れ替え・交代できます
              (タップで選択→タップでも可)。コートの選手をこのエリアへドロップすると
              ポジションから外せます。
            </p>
          </div>
        </div>
      </div>

      {/* 操作ボタン */}
      <div className="no-print space-y-2">
        {!readonly && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() =>
                  runGenerate(
                    { type: "period", periodId: currentPeriod.id },
                    "この時間帯だけを再生成します。固定した配置は維持されます。よろしいですか?"
                  )
                }
                disabled={isPending}
                className="btn-secondary text-sm"
              >
                🔄 この時間帯
              </button>
              <button
                onClick={() =>
                  runGenerate(
                    { type: "match", matchId: currentMatch.id },
                    `第${currentMatch.matchNumber}試合を再生成します。固定した配置は維持されます。よろしいですか?`
                  )
                }
                disabled={isPending}
                className="btn-secondary text-sm"
              >
                🔄 この試合
              </button>
              <button
                onClick={() =>
                  runGenerate(
                    { type: "day" },
                    "1日全体を再生成します。固定した配置は維持されます。よろしいですか?"
                  )
                }
                disabled={isPending}
                className="btn-secondary text-sm"
              >
                🔄 1日全体
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={history.length === 0 || isPending}
                className="btn-secondary"
              >
                ↩️ 元に戻す
              </button>
              <button
                onClick={save}
                disabled={!dirty || isPending}
                className="btn-primary flex-1"
              >
                {isPending ? "処理中..." : "💾 保存する"}
              </button>
              <button
                onClick={() => confirmLineup(true)}
                disabled={isPending}
                className="btn-primary bg-sky-600 hover:bg-sky-700"
              >
                ✅ 確定
              </button>
            </div>
          </>
        )}
        {readonly && (
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="btn-secondary flex-1"
            >
              🖨️ 印刷
            </button>
            <button
              onClick={() => confirmLineup(false)}
              disabled={isPending}
              className="btn-secondary flex-1"
            >
              🔓 確定を解除して編集
            </button>
          </div>
        )}
      </div>

      {/* ドラッグ中のゴースト表示 */}
      {drag?.active &&
        (() => {
          const p = playerMap.get(drag.playerId);
          if (!p) return null;
          return (
            <div
              className="pointer-events-none fixed z-50 flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-xl ring-2 ring-emerald-500"
              style={{
                left: drag.x,
                top: drag.y,
                transform: "translate(-50%, -120%)",
              }}
            >
              <PlayerAvatar imageUrl={p.imageUrl} name={p.name} size={28} />
              <span className="text-sm font-bold">
                {p.jerseyNumber} {p.name}
              </span>
            </div>
          );
        })()}
    </div>
  );
}
