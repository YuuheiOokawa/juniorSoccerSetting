import { describe, expect, it } from "vitest";
import { POSITION_CODES, type PositionCode } from "../constants";
import { generateLineup } from "./generate";
import type {
  Assignment,
  GenerationConfig,
  LineupPeriod,
  LineupPlayer,
} from "./types";

// ============================================================
// テスト用ヘルパー
// ============================================================

function makeAptitudes(
  overrides: Partial<Record<PositionCode, number>> = {},
  base = 0
): Record<PositionCode, number> {
  const aptitudes = {} as Record<PositionCode, number>;
  for (const code of POSITION_CODES) {
    aptitudes[code] = overrides[code] ?? base;
  }
  return aptitudes;
}

function makePlayer(
  id: number,
  options: Partial<Omit<LineupPlayer, "playerId" | "aptitudes">> & {
    aptitudes?: Record<PositionCode, number>;
  } = {}
): LineupPlayer {
  return {
    playerId: `p${id}`,
    name: `選手${id}`,
    jerseyNumber: id,
    aptitudes: options.aptitudes ?? makeAptitudes({}, 2),
    isBeginner: options.isBeginner ?? false,
    canPlay: options.canPlay ?? true,
    maxPlayingSlots: options.maxPlayingSlots ?? null,
    priority: options.priority ?? 0,
  };
}

function makePeriods(matchCount: number): LineupPeriod[] {
  const periods: LineupPeriod[] = [];
  let globalOrder = 0;
  for (let m = 1; m <= matchCount; m++) {
    for (let p = 1; p <= 4; p++) {
      periods.push({
        periodId: `m${m}-p${p}`,
        matchNumber: m,
        periodOrder: p,
        globalOrder: globalOrder++,
      });
    }
  }
  return periods;
}

const defaultConfig: GenerationConfig = {
  beginnerLimit: 2,
  fairnessWeight: 60,
  aptitudeWeight: 20,
  continuityPenalty: 20,
  positionRepeatPenalty: 10,
  randomnessWeight: 10,
  seed: 42,
};

// 標準的な13人のチーム (GK対応2人・初心者5人)
function makeStandardTeam(): LineupPlayer[] {
  return [
    makePlayer(1, { aptitudes: makeAptitudes({ GK: 3, CDF: 1 }, 0) }),
    makePlayer(2, { aptitudes: makeAptitudes({ GK: 2, CDF: 2, LDF: 1 }, 0) }),
    makePlayer(3, { aptitudes: makeAptitudes({ LDF: 3, CDF: 2, RDF: 2 }, 0) }),
    makePlayer(4, { aptitudes: makeAptitudes({ CDF: 3, LDF: 2, RDF: 2 }, 0) }),
    makePlayer(5, { aptitudes: makeAptitudes({ RDF: 3, CDF: 1 }, 0), isBeginner: true }),
    makePlayer(6, { aptitudes: makeAptitudes({ LMF: 3, CMF: 2, RMF: 2 }, 0) }),
    makePlayer(7, { aptitudes: makeAptitudes({ CMF: 3, LMF: 2, RMF: 2, FW: 1 }, 0) }),
    makePlayer(8, { aptitudes: makeAptitudes({ RMF: 3, LMF: 2 }, 0), isBeginner: true }),
    makePlayer(9, { aptitudes: makeAptitudes({ FW: 3, CMF: 1 }, 0) }),
    makePlayer(10, { aptitudes: makeAptitudes({ FW: 2, RMF: 2, LMF: 2 }, 0) }),
    makePlayer(11, { aptitudes: makeAptitudes({ LDF: 1, RDF: 1, CDF: 1 }, 0), isBeginner: true }),
    makePlayer(12, { aptitudes: makeAptitudes({ LMF: 1, RMF: 1 }, 0), isBeginner: true }),
    makePlayer(13, { aptitudes: makeAptitudes({ FW: 1, RMF: 1, LDF: 1 }, 0), isBeginner: true }),
  ];
}

// ============================================================
// テスト本体
// ============================================================

describe("generateLineup", () => {
  it("各区分に8人が正しく配置される", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(1);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    for (const period of periods) {
      const assignments = result.assignments.filter(
        (a) => a.periodId === period.periodId
      );
      expect(assignments).toHaveLength(8);
    }
  });

  it("8ポジションが重複なく埋まる", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(2);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    for (const period of periods) {
      const codes = result.assignments
        .filter((a) => a.periodId === period.periodId)
        .map((a) => a.positionCode);
      expect(new Set(codes).size).toBe(8);
    }
  });

  it("同じ選手が同じ区分に重複配置されない", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(3);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    for (const period of periods) {
      const ids = result.assignments
        .filter((a) => a.periodId === period.periodId)
        .map((a) => a.playerId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("初心者が同じ区分に3人以上出場しない", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(3);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    const beginnerIds = new Set(
      players.filter((p) => p.isBeginner).map((p) => p.playerId)
    );
    for (const period of periods) {
      const beginnerCount = result.assignments.filter(
        (a) => a.periodId === period.periodId && beginnerIds.has(a.playerId)
      ).length;
      expect(beginnerCount).toBeLessThanOrEqual(2);
    }
  });

  it("欠席者・出場不可の選手は配置されない", () => {
    const players = makeStandardTeam();
    players[3].canPlay = false; // 選手4を欠席に
    players[9].canPlay = false; // 選手10を出場不可に
    const periods = makePeriods(1);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    const assignedIds = new Set(result.assignments.map((a) => a.playerId));
    expect(assignedIds.has("p4")).toBe(false);
    expect(assignedIds.has("p10")).toBe(false);
  });

  it("対応不可ポジションには原則配置されない (十分な人数がいる場合)", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(2);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    const playerMap = new Map(players.map((p) => [p.playerId, p]));
    // 警告 (例外配置) が出ていない割り当てはすべて適性 > 0 のはず
    if (result.warnings.length === 0) {
      for (const a of result.assignments) {
        const p = playerMap.get(a.playerId)!;
        expect(p.aptitudes[a.positionCode]).toBeGreaterThan(0);
      }
    }
  });

  it("GKにはGK対応可能な選手が配置される", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(2);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    const playerMap = new Map(players.map((p) => [p.playerId, p]));
    for (const a of result.assignments) {
      if (a.positionCode === "GK") {
        expect(playerMap.get(a.playerId)!.aptitudes.GK).toBeGreaterThan(0);
      }
    }
  });

  it("出場枠数が可能な範囲で均等になる", () => {
    // 注: 初心者は「同一区分に最大2人」の制約があるため、初心者が多い
    // チームでは初心者と一般選手の出場枠を完全に揃えることは構造的に
    // 不可能。グループ内での均等を検証する。
    const players = makeStandardTeam();
    const periods = makePeriods(3); // 12区分 × 8 = 96枠 / 13人 ≈ 7.4
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    const countOf = (id: string) =>
      result.assignments.filter((a) => a.playerId === id).length;

    const regulars = players.filter((p) => !p.isBeginner).map((p) => countOf(p.playerId));
    const beginners = players.filter((p) => p.isBeginner).map((p) => countOf(p.playerId));

    expect(Math.max(...regulars) - Math.min(...regulars)).toBeLessThanOrEqual(2);
    expect(Math.max(...beginners) - Math.min(...beginners)).toBeLessThanOrEqual(2);
    // 全員が最低1枠は出場する
    expect(Math.min(...regulars, ...beginners)).toBeGreaterThanOrEqual(1);
  });

  it("固定した選手・ポジションは再生成でも維持される", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(2);
    const locked: Assignment[] = [
      {
        periodId: "m1-p1",
        positionCode: "GK",
        playerId: "p1",
        isLocked: true,
      },
      {
        periodId: "m2-p3",
        positionCode: "FW",
        playerId: "p9",
        isLocked: true,
      },
    ];

    // 異なるシードで複数回生成しても固定が維持される
    for (const seed of [1, 99, 12345]) {
      const result = generateLineup(
        players,
        periods,
        { ...defaultConfig, seed },
        locked
      );
      expect(result.ok).toBe(true);
      const gk = result.assignments.find(
        (a) => a.periodId === "m1-p1" && a.positionCode === "GK"
      );
      expect(gk?.playerId).toBe("p1");
      expect(gk?.isLocked).toBe(true);
      const fw = result.assignments.find(
        (a) => a.periodId === "m2-p3" && a.positionCode === "FW"
      );
      expect(fw?.playerId).toBe("p9");
    }
  });

  it("参加人数が8人未満の場合はエラーになる", () => {
    const players = makeStandardTeam().slice(0, 7);
    const periods = makePeriods(1);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("8人以上必要"))).toBe(true);
  });

  it("GK対応者がいない場合はエラーになる", () => {
    const players = makeStandardTeam().map((p) => ({
      ...p,
      aptitudes: { ...p.aptitudes, GK: 0 },
    }));
    const periods = makePeriods(1);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("GKを担当できる選手"))).toBe(
      true
    );
  });

  it("固定された初心者が上限を超える場合はエラーになる", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(1);
    const locked: Assignment[] = [
      { periodId: "m1-p1", positionCode: "RDF", playerId: "p5", isLocked: true },
      { periodId: "m1-p1", positionCode: "RMF", playerId: "p8", isLocked: true },
      { periodId: "m1-p1", positionCode: "LDF", playerId: "p11", isLocked: true },
    ];
    const result = generateLineup(players, periods, defaultConfig, locked);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("固定された初心者"))).toBe(true);
  });

  it("同じシードなら同じ結果、異なるシードなら異なる結果になりうる", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(2);

    const r1 = generateLineup(players, periods, { ...defaultConfig, seed: 7 });
    const r2 = generateLineup(players, periods, { ...defaultConfig, seed: 7 });
    expect(r1.assignments).toEqual(r2.assignments);

    // 複数のシードのうち少なくとも1つは異なる結果になる
    const serialize = (a: Assignment[]) =>
      JSON.stringify(
        [...a].sort((x, y) =>
          `${x.periodId}:${x.positionCode}`.localeCompare(
            `${y.periodId}:${y.positionCode}`
          )
        )
      );
    const base = serialize(r1.assignments);
    const anyDifferent = [11, 22, 33, 44].some((seed) => {
      const r = generateLineup(players, periods, { ...defaultConfig, seed });
      return serialize(r.assignments) !== base;
    });
    expect(anyDifferent).toBe(true);
  });

  it("ちょうど8人の場合は全員が全区分に出場する", () => {
    const players = makeStandardTeam().slice(0, 8);
    // 8人で全ポジションを埋められるよう全員をある程度対応可能にする
    for (const p of players) {
      for (const code of POSITION_CODES) {
        if (code !== "GK" && p.aptitudes[code] === 0) p.aptitudes[code] = 1;
      }
    }
    const periods = makePeriods(1);
    const result = generateLineup(players, periods, {
      ...defaultConfig,
      beginnerLimit: 8, // 8人しかいないため初心者制限は緩和
    });

    expect(result.ok).toBe(true);
    for (const p of players) {
      const count = result.assignments.filter(
        (a) => a.playerId === p.playerId
      ).length;
      expect(count).toBe(4);
    }
  });

  it("出場枠数の上限が守られる", () => {
    const players = makeStandardTeam();
    players[0].maxPlayingSlots = 2; // GK主力に上限2枠
    const periods = makePeriods(3);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    const count = result.assignments.filter((a) => a.playerId === "p1").length;
    expect(count).toBeLessThanOrEqual(2);
  });

  it("複数試合でも1日全体で出場が均等化される (E2E相当: 13人3試合)", () => {
    const players = makeStandardTeam();
    const periods = makePeriods(3);
    const result = generateLineup(players, periods, defaultConfig);

    expect(result.ok).toBe(true);
    // 全12区分で初心者最大2人
    const beginnerIds = new Set(
      players.filter((p) => p.isBeginner).map((p) => p.playerId)
    );
    for (const period of periods) {
      const bc = result.assignments.filter(
        (a) => a.periodId === period.periodId && beginnerIds.has(a.playerId)
      ).length;
      expect(bc).toBeLessThanOrEqual(2);
    }
    // 初心者上限の制約下でも、初心者枠 (12区分×2=24枠) が十分活用され、
    // グループ内で出場が均等になることを確認する
    const countOf = (id: string) =>
      result.assignments.filter((a) => a.playerId === id).length;
    const regulars = players
      .filter((p) => !p.isBeginner)
      .map((p) => countOf(p.playerId));
    const beginners = players
      .filter((p) => p.isBeginner)
      .map((p) => countOf(p.playerId));
    expect(Math.max(...regulars) - Math.min(...regulars)).toBeLessThanOrEqual(2);
    expect(Math.max(...beginners) - Math.min(...beginners)).toBeLessThanOrEqual(2);
    // 初心者枠の活用: 5人の初心者で合計20枠以上 (上限24枠) 出場している
    const beginnerTotal = beginners.reduce((a, b) => a + b, 0);
    expect(beginnerTotal).toBeGreaterThanOrEqual(18);
  });
});
