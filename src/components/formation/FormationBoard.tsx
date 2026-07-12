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
        {/* サッカーコート */}
        <div
          className="relative mx-auto aspect-[3/4] w-full max-w-md rounded-xl border-4 border-white bg-gradient-to-b from-emerald-600 to-emerald-700 shadow-lg"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 40px, transparent 40px 80px)",
          }}
        >
          {/* コートのライン */}
          <div className="pointer-events-none absolute inset-2 rounded-lg border-2 border-white/50" />
          <div className="pointer-events-none absolute left-1/2 top-2 h-[calc(50%-0.5rem)] w-0 border-l-2 border-white/0" />
          <div className="pointer-events-none absolute left-1/4 right-1/4 top-2 h-10 rounded-b-lg border-2 border-t-0 border-white/50" />
          <div className="pointer-events-none absolute bottom-2 left-1/4 right-1/4 h-14 rounded-t-lg border-2 border-b-0 border-white/50" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50" />

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
                  // ウイイレ風の選手カード
                  <div className="relative flex flex-col items-center rounded-xl bg-gradient-to-b from-slate-700 via-slate-900 to-black px-1 pb-1 pt-2 shadow-lg ring-1 ring-white/25">
                    <span
                      className={`absolute -left-1 -top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-black shadow ${colors.badge}`}
                    >
                      {code}
                    </span>
                    {(assignment?.isLocked ||
                      (assignment?.isManual && !assignment.isLocked)) && (
                      <span className="absolute -right-1 -top-1.5 rounded-full bg-white/90 px-1 text-[11px] shadow">
                        {assignment.isLocked ? "🔒" : "✋"}
                      </span>
                    )}
                    <PlayerAvatar
                      imageUrl={player.imageUrl}
                      name={player.name}
                      size={38}
                      className={`ring-2 ${colors.ring}`}
                    />
                    <div className="mt-0.5 flex w-full items-center justify-center gap-1">
                      <span className="font-mono text-[11px] font-black text-amber-300">
                        {player.jerseyNumber}
                      </span>
                      <span className="max-w-[62px] truncate text-[11px] font-bold text-white">
                        {player.name}
                      </span>
                      {player.isBeginner && <span className="text-[9px]">🔰</span>}
                    </div>
                    <div className="text-[9px] leading-tight text-slate-300">
                      {formatSlots(slotCounts.get(player.playerId) ?? 0)}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-white/70 bg-white/15 px-1 py-3 text-white">
                    <div className="text-[10px] font-black">{code}</div>
                    <div className="text-xs font-bold">タップで配置</div>
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
                        <PlayerAvatar
                          imageUrl={p.imageUrl}
                          name={p.name}
                          size={32}
                          className="ring-2 ring-white/40"
                        />
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
