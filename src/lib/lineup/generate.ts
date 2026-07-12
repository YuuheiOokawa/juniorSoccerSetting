import { POSITION_CODES, type PositionCode } from "../constants";
import { validateLineup, validatePreconditions } from "./constraints";
import { createRng, weightedPick } from "./random";
import type {
  Assignment,
  GenerationConfig,
  GenerationResult,
  LineupPeriod,
  LineupPlayer,
} from "./types";

// ============================================================
// 自動編成アルゴリズム
//
// 方針:
//  1. 事前チェック (人数・GK対応者・固定配置の競合)
//  2. 区分を日全体の順序で処理し、配置が難しいポジション
//     (GK → 対応者が少ない順) から埋める
//  3. 候補者を評価点でスコアリングし、上位候補から
//     重み付きランダムで選択する
//  4. 全区分作成後、出場枠数の偏りをスワップで改善する
//  5. 最終検証を行い、違反があれば結果に含めて返す
// ============================================================

interface PlayerState {
  slotsPlayed: number; // その日の出場枠数
  consecutive: number; // 現在の連続出場区分数
  lastGlobalOrder: number; // 最後に出場した区分の通し順序 (-2 = 未出場)
  positionCounts: Map<PositionCode, number>; // ポジション別出場回数
  lastPositions: PositionCode[]; // 直近の出場ポジション履歴
}

export function generateLineup(
  players: LineupPlayer[],
  periods: LineupPeriod[],
  config: GenerationConfig,
  lockedAssignments: Assignment[] = []
): GenerationResult {
  const warnings: string[] = [];
  const rng = createRng(config.seed);

  // ---- 事前チェック ----
  const pre = validatePreconditions(players, lockedAssignments, periods, config);
  if (!pre.valid) {
    return {
      ok: false,
      assignments: [],
      errors: pre.errors,
      warnings: [],
      seed: config.seed,
    };
  }

  const available = players.filter((p) => p.canPlay);
  const sortedPeriods = [...periods].sort((a, b) => a.globalOrder - b.globalOrder);

  // ---- 目標出場枠数 ----
  // 全出場枠数 (区分数 × 8) ÷ 参加人数。割り切れない場合は
  // 一部の選手が1枠多くなることを許容する。
  const totalSlots = sortedPeriods.length * 8;
  const targetSlots = totalSlots / available.length;

  // ---- 選手ごとの状態 ----
  const states = new Map<string, PlayerState>();
  for (const p of available) {
    states.set(p.playerId, {
      slotsPlayed: 0,
      consecutive: 0,
      lastGlobalOrder: -2,
      positionCounts: new Map(),
      lastPositions: [],
    });
  }

  const lockedByPeriod = new Map<string, Assignment[]>();
  for (const a of lockedAssignments) {
    if (!a.isLocked) continue;
    const list = lockedByPeriod.get(a.periodId) ?? [];
    list.push(a);
    lockedByPeriod.set(a.periodId, list);
  }

  const result: Assignment[] = [];

  // ---- 区分ごとに配置 ----
  for (const period of sortedPeriods) {
    const periodAssignments: Assignment[] = [];
    const usedPlayers = new Set<string>();
    const usedPositions = new Set<PositionCode>();
    let beginnerCount = 0;

    // 固定配置を先に反映する (自動編成では変更しない)
    const locked = lockedByPeriod.get(period.periodId) ?? [];
    for (const a of locked) {
      periodAssignments.push({ ...a });
      usedPlayers.add(a.playerId);
      usedPositions.add(a.positionCode);
      const p = available.find((x) => x.playerId === a.playerId);
      if (p?.isBeginner) beginnerCount++;
    }

    // 残りのポジションを「配置が難しい順」に並べる。
    // GKを最優先とし、その後は対応可能な選手が少ない順。
    const remaining = POSITION_CODES.filter((c) => !usedPositions.has(c));
    const candidateCount = (code: PositionCode) =>
      available.filter((p) => p.aptitudes[code] > 0 && !usedPlayers.has(p.playerId))
        .length;
    const orderedPositions = [...remaining].sort((a, b) => {
      if (a === "GK") return -1;
      if (b === "GK") return 1;
      return candidateCount(a) - candidateCount(b);
    });

    for (const positionCode of orderedPositions) {
      const beginnerCapReached = beginnerCount >= config.beginnerLimit;

      // 候補者の抽出 (除外条件を適用)
      const buildCandidates = (allowNoAptitude: boolean) =>
        available.filter((p) => {
          if (usedPlayers.has(p.playerId)) return false;
          if (!allowNoAptitude && p.aptitudes[positionCode] <= 0) return false;
          if (beginnerCapReached && p.isBeginner) return false;
          const st = states.get(p.playerId)!;
          if (p.maxPlayingSlots != null && st.slotsPlayed >= p.maxPlayingSlots)
            return false;
          return true;
        });

      let candidates = buildCandidates(false);
      let isExceptional = false;

      if (candidates.length === 0) {
        // どうしても8人を配置できない場合は、対応不可ポジションへの
        // 例外配置を警告付きで許可する
        candidates = buildCandidates(true);
        isExceptional = true;
      }

      if (candidates.length === 0) {
        return {
          ok: false,
          assignments: [],
          errors: [
            `第${period.matchNumber}試合 区分${period.periodOrder} の ${positionCode} に配置できる選手がいません。参加人数や初心者設定、出場上限を確認してください。`,
          ],
          warnings,
          seed: config.seed,
        };
      }

      // 評価点を計算し、上位候補から重み付きランダムで選択
      const scored = candidates.map((p) => ({
        player: p,
        score: scoreCandidate(p, positionCode, states.get(p.playerId)!, {
          config,
          targetSlots,
          currentGlobalOrder: period.globalOrder,
          rng,
        }),
      }));
      scored.sort((a, b) => b.score - a.score);

      // 上位3人までを候補とし、スコア差に応じた重みで選ぶ
      const top = scored.slice(0, 3);
      const minScore = top[top.length - 1].score;
      const weights = top.map((s) => s.score - minScore + 1);
      const picked = top[weightedPick(weights, rng)];

      if (isExceptional) {
        warnings.push(
          `第${period.matchNumber}試合 区分${period.periodOrder}: 対応可能な選手が足りないため、「${picked.player.name}」を対応外の ${positionCode} に配置しました。`
        );
      }

      periodAssignments.push({
        periodId: period.periodId,
        positionCode,
        playerId: picked.player.playerId,
        isLocked: false,
        score: Math.round(picked.score * 10) / 10,
      });
      usedPlayers.add(picked.player.playerId);
      if (picked.player.isBeginner) beginnerCount++;
    }

    // 状態を更新 (連続出場・ポジション履歴)
    for (const p of available) {
      const st = states.get(p.playerId)!;
      const assignment = periodAssignments.find(
        (a) => a.playerId === p.playerId
      );
      if (assignment) {
        st.consecutive =
          st.lastGlobalOrder === period.globalOrder - 1 ? st.consecutive + 1 : 1;
        st.lastGlobalOrder = period.globalOrder;
        st.slotsPlayed++;
        st.positionCounts.set(
          assignment.positionCode,
          (st.positionCounts.get(assignment.positionCode) ?? 0) + 1
        );
        st.lastPositions.push(assignment.positionCode);
      } else if (st.lastGlobalOrder !== period.globalOrder) {
        st.consecutive = 0;
      }
    }

    result.push(...periodAssignments);
  }

  // ---- 偏り改善パス ----
  balancePlayingTime(available, sortedPeriods, result, config, rng);

  // ---- 最終検証 ----
  const validation = validateLineup(available, sortedPeriods, result, config);
  if (!validation.valid) {
    return {
      ok: false,
      assignments: result,
      errors: validation.errors,
      warnings,
      seed: config.seed,
    };
  }

  return { ok: true, assignments: result, errors: [], warnings, seed: config.seed };
}

// ============================================================
// 候補者の評価点計算
// ============================================================

function scoreCandidate(
  player: LineupPlayer,
  positionCode: PositionCode,
  state: PlayerState,
  ctx: {
    config: GenerationConfig;
    targetSlots: number;
    currentGlobalOrder: number;
    rng: () => number;
  }
): number {
  const { config, targetSlots, currentGlobalOrder, rng } = ctx;
  let score = 0;

  // 加点: 目標出場枠数に対して出場が少ないほど高い
  const deficit = targetSlots - state.slotsPlayed;
  score += deficit * config.fairnessWeight;

  // 加点: ポジション適性 (0〜3)
  score += (player.aptitudes[positionCode] / 3) * config.aptitudeWeight;

  // 加点: 直前の区分で休んでいた
  const restedLastPeriod = state.lastGlobalOrder < currentGlobalOrder - 1;
  if (restedLastPeriod && state.slotsPlayed > 0) {
    score += config.continuityPenalty * 0.5;
  }

  // 減点: 連続出場中 (連続数が増えるほど大きく減点)
  const isConsecutive = state.lastGlobalOrder === currentGlobalOrder - 1;
  if (isConsecutive) {
    score -= state.consecutive * config.continuityPenalty;
  }

  // 減点: 同じポジションへの連続・偏り
  const positionCount = state.positionCounts.get(positionCode) ?? 0;
  // GKは専門性が高いため、同ポジション連続の減点を緩和する
  const repeatFactor = positionCode === "GK" ? 0.25 : 1;
  score -= positionCount * config.positionRepeatPenalty * repeatFactor;
  const lastPosition = state.lastPositions[state.lastPositions.length - 1];
  if (isConsecutive && lastPosition === positionCode && positionCode !== "GK") {
    score -= config.positionRepeatPenalty;
  }

  // 加点: 当日の出場優先度
  score += player.priority * 5;

  // ランダム性
  score += rng() * config.randomnessWeight * 2;

  return score;
}

// ============================================================
// 偏り改善パス
// 出場枠数の最大と最小の差が1以下になるよう、固定されていない
// 割り当てを出場の少ない選手と入れ替える。
// ============================================================

function balancePlayingTime(
  players: LineupPlayer[],
  periods: LineupPeriod[],
  assignments: Assignment[],
  config: GenerationConfig,
  rng: () => number
): void {
  const playerMap = new Map(players.map((p) => [p.playerId, p]));

  const countSlots = () => {
    const counts = new Map<string, number>();
    for (const p of players) counts.set(p.playerId, 0);
    for (const a of assignments) {
      counts.set(a.playerId, (counts.get(a.playerId) ?? 0) + 1);
    }
    return counts;
  };

  // 出場過多の選手 (over) を区分から外し、出場過少の選手 (under) を
  // 入れる交換を試みる。直接交換できない場合は、同じ区分内の第三の
  // 選手にポジションを移ってもらう2段階交換も試す。
  // 交換を実行できた場合は true を返す。
  const trySwap = (
    overId: string,
    underId: string,
    underCount: number,
    rng: () => number
  ): boolean => {
    const underPlayer = playerMap.get(underId)!;

    // 出場上限チェック
    if (
      underPlayer.maxPlayingSlots != null &&
      underCount >= underPlayer.maxPlayingSlots
    )
      return false;

    // under を追加しても初心者上限を守れるか (over は抜ける前提)
    const beginnerOk = (periodId: string) => {
      if (!underPlayer.isBeginner) return true;
      const periodBeginners = assignments.filter(
        (b) =>
          b.periodId === periodId &&
          b.playerId !== overId &&
          playerMap.get(b.playerId)?.isBeginner
      ).length;
      return periodBeginners + 1 <= config.beginnerLimit;
    };

    const overAssignments = assignments.filter(
      (a) =>
        a.playerId === overId &&
        !a.isLocked &&
        !assignments.some(
          (b) => b.periodId === a.periodId && b.playerId === underId
        ) &&
        beginnerOk(a.periodId)
    );

    // 1) 直接交換: under が over のポジションに対応可能
    const direct = overAssignments.filter(
      (a) => underPlayer.aptitudes[a.positionCode] > 0
    );
    if (direct.length > 0) {
      const target = direct[Math.floor(rng() * direct.length)];
      target.playerId = underId;
      target.score = undefined;
      return true;
    }

    // 2) 2段階交換: 同区分の第三の選手が over のポジションへ移り、
    //    空いたポジションに under が入る
    for (const a of overAssignments) {
      const mediators = assignments.filter((b) => {
        if (b.periodId !== a.periodId || b.isLocked) return false;
        if (b.playerId === overId) return false;
        const mediator = playerMap.get(b.playerId);
        if (!mediator) return false;
        return (
          mediator.aptitudes[a.positionCode] > 0 &&
          underPlayer.aptitudes[b.positionCode] > 0
        );
      });
      if (mediators.length > 0) {
        const mediator = mediators[Math.floor(rng() * mediators.length)];
        const mediatorPosition = mediator.positionCode;
        mediator.positionCode = a.positionCode;
        mediator.score = undefined;
        a.positionCode = mediatorPosition;
        a.playerId = underId;
        a.score = undefined;
        return true;
      }
    }

    return false;
  };

  for (let iter = 0; iter < 300; iter++) {
    const counts = countSlots();
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (entries[0][1] - entries[entries.length - 1][1] <= 1) break;

    // 差が2以上あるすべての (過多, 過少) ペアを差が大きい順に試す。
    // 極値のペアが制約 (初心者上限・適性など) で交換できない場合も、
    // 別のペアで改善できることがある。
    let swapped = false;
    outer: for (let hi = 0; hi < entries.length - 1; hi++) {
      for (let lo = entries.length - 1; lo > hi; lo--) {
        const [overId, overCount] = entries[hi];
        const [underId, underCount] = entries[lo];
        if (overCount - underCount <= 1) continue;
        if (trySwap(overId, underId, underCount, rng)) {
          swapped = true;
          break outer;
        }
      }
    }
    if (!swapped) break;
  }
}
