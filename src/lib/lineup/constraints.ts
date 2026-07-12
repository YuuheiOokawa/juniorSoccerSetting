import { POSITION_CODES, type PositionCode } from "../constants";
import type {
  Assignment,
  GenerationConfig,
  LineupPeriod,
  LineupPlayer,
  ValidationResult,
} from "./types";

// 編成結果の最終検証。制約違反を日本語メッセージで返す。
export function validateLineup(
  players: LineupPlayer[],
  periods: LineupPeriod[],
  assignments: Assignment[],
  config: Pick<GenerationConfig, "beginnerLimit">
): ValidationResult {
  const errors: string[] = [];
  const playerMap = new Map(players.map((p) => [p.playerId, p]));

  for (const period of periods) {
    const periodAssignments = assignments.filter(
      (a) => a.periodId === period.periodId
    );
    const label = `第${period.matchNumber}試合 区分${period.periodOrder}`;

    if (periodAssignments.length !== 8) {
      errors.push(
        `${label}: 8人配置されていません (現在${periodAssignments.length}人)。`
      );
    }

    // ポジション重複・不足
    const positionSet = new Set(periodAssignments.map((a) => a.positionCode));
    for (const code of POSITION_CODES) {
      const count = periodAssignments.filter(
        (a) => a.positionCode === code
      ).length;
      if (count > 1) {
        errors.push(`${label}: ${code} に複数の選手が配置されています。`);
      }
    }
    if (periodAssignments.length === 8 && positionSet.size !== 8) {
      errors.push(`${label}: 8つのポジションがすべて埋まっていません。`);
    }

    // 選手重複
    const playerIds = periodAssignments.map((a) => a.playerId);
    if (new Set(playerIds).size !== playerIds.length) {
      errors.push(`${label}: 同じ選手が複数ポジションに配置されています。`);
    }

    // 初心者上限
    const beginnerCount = periodAssignments.filter(
      (a) => playerMap.get(a.playerId)?.isBeginner
    ).length;
    if (beginnerCount > config.beginnerLimit) {
      errors.push(
        `${label}: 初心者の同時出場上限は${config.beginnerLimit}人ですが、${beginnerCount}人配置されています。`
      );
    }

    // 出場不可の選手が配置されていないか
    for (const a of periodAssignments) {
      const p = playerMap.get(a.playerId);
      if (!p) {
        errors.push(`${label}: 参加者に含まれない選手が配置されています。`);
      } else if (!p.canPlay) {
        errors.push(
          `${label}: 欠席または出場不可の「${p.name}」が配置されています。`
        );
      }
    }
  }

  // 出場枠数の上限チェック
  for (const player of players) {
    if (player.maxPlayingSlots == null) continue;
    const count = assignments.filter(
      (a) => a.playerId === player.playerId
    ).length;
    if (count > player.maxPlayingSlots) {
      errors.push(
        `「${player.name}」の出場枠数(${count})が上限(${player.maxPlayingSlots})を超えています。`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// 編成を開始できるかの事前チェック
export function validatePreconditions(
  players: LineupPlayer[],
  lockedAssignments: Assignment[],
  periods: LineupPeriod[],
  config: Pick<GenerationConfig, "beginnerLimit">
): ValidationResult {
  const errors: string[] = [];
  const available = players.filter((p) => p.canPlay);

  if (available.length < 8) {
    errors.push(
      `参加できる選手が${available.length}人しかいないため、編成できません。8人以上必要です。`
    );
  }

  const gkCapable = available.filter((p) => p.aptitudes.GK > 0);
  if (gkCapable.length === 0) {
    errors.push(
      "GKを担当できる選手が参加者にいないため、自動編成できません。選手のポジション設定を確認してください。"
    );
  }

  // 固定配置の競合チェック
  const playerMap = new Map(players.map((p) => [p.playerId, p]));
  for (const period of periods) {
    const locked = lockedAssignments.filter(
      (a) => a.periodId === period.periodId && a.isLocked
    );
    const label = `第${period.matchNumber}試合 区分${period.periodOrder}`;

    const posCounts = new Map<PositionCode, number>();
    const playerCounts = new Map<string, number>();
    let beginnerCount = 0;
    for (const a of locked) {
      posCounts.set(a.positionCode, (posCounts.get(a.positionCode) ?? 0) + 1);
      playerCounts.set(a.playerId, (playerCounts.get(a.playerId) ?? 0) + 1);
      const p = playerMap.get(a.playerId);
      if (p?.isBeginner) beginnerCount++;
      if (p && !p.canPlay) {
        errors.push(
          `${label}: 欠席または出場不可の「${p.name}」が固定されています。固定を解除してください。`
        );
      }
    }
    for (const [code, count] of posCounts) {
      if (count > 1) {
        errors.push(`${label}: ${code} に複数の選手が固定されています。`);
      }
    }
    for (const [playerId, count] of playerCounts) {
      if (count > 1) {
        const name = playerMap.get(playerId)?.name ?? playerId;
        errors.push(
          `${label}: 「${name}」が複数のポジションに固定されています。`
        );
      }
    }
    if (beginnerCount > config.beginnerLimit) {
      errors.push(
        `${label}: 初心者の同時出場上限が${config.beginnerLimit}人ですが、固定された初心者が${beginnerCount}人います。`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
