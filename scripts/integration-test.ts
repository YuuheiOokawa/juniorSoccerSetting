// 結合テスト: 実DBを使い、試合日作成 → 参加設定 → 自動編成 →
// 固定 → 再生成 → 確定 までの一連の流れを検証する。
// 実行: npx tsx scripts/integration-test.ts
import { PrismaClient } from "@prisma/client";
import { PERIOD_TYPES, SLOT_SECONDS } from "../src/lib/constants";
import { generateLineup } from "../src/lib/lineup/generate";
import type { Assignment } from "../src/lib/lineup/types";

const prisma = new PrismaClient();

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name} ${detail}`);
  }
}

async function main() {
  console.log("=== 結合テスト開始 ===");

  // --- 1. シード済み選手を取得 (15人) ---
  const players = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: { jerseyNumber: "asc" },
    include: { positions: { include: { position: true } } },
  });
  check("選手が15人登録されている", players.length === 15, `実際: ${players.length}`);
  const beginners = players.filter((p) => p.isBeginner);
  check("初心者が5人いる", beginners.length === 5, `実際: ${beginners.length}`);

  // --- 2. 試合日を作成 (3試合) ---
  const matchDay = await prisma.matchDay.create({
    data: {
      matchDate: new Date("2026-07-20"),
      eventName: "結合テストカップ",
      venue: "テストグラウンド",
      numberOfMatches: 3,
      matches: {
        create: [1, 2, 3].map((n) => ({
          matchNumber: n,
          periods: {
            create: PERIOD_TYPES.map((periodType, i) => ({
              periodType,
              periodOrder: i + 1,
              startSecond: i * SLOT_SECONDS,
              durationSecs: SLOT_SECONDS,
            })),
          },
        })),
      },
      generationSetting: { create: {} },
    },
    include: { matches: { include: { periods: true } } },
  });
  check("3試合×4区分が作成された",
    matchDay.matches.length === 3 &&
    matchDay.matches.every((m) => m.periods.length === 4));

  // --- 3. 参加者13人・欠席2人を設定 ---
  const absentIds = new Set([players[13].id, players[14].id]);
  await prisma.matchDayPlayer.createMany({
    data: players.map((p) => ({
      matchDayId: matchDay.id,
      playerId: p.id,
      attendanceStatus: absentIds.has(p.id) ? "ABSENT" : "PRESENT",
      isBeginnerOnDay: p.isBeginner,
      canPlayGk: p.canPlayGk,
    })),
  });

  // --- 4. 自動編成を実行 (アルゴリズム + DB保存) ---
  const bundle = await prisma.matchDay.findUniqueOrThrow({
    where: { id: matchDay.id },
    include: {
      matches: { orderBy: { matchNumber: "asc" }, include: { periods: { orderBy: { periodOrder: "asc" } } } },
      players: { include: { player: { include: { positions: { include: { position: true } } } } } },
      generationSetting: true,
    },
  });

  const lineupPlayers = bundle.players.map((mdp) => {
    const aptitudes: Record<string, number> = {
      GK: 0, LDF: 0, CDF: 0, RDF: 0, LMF: 0, CMF: 0, RMF: 0, FW: 0,
    };
    for (const pp of mdp.player.positions) {
      aptitudes[pp.position.code] = pp.isAvailable ? pp.aptitudeLevel : 0;
    }
    if (!mdp.canPlayGk) aptitudes.GK = 0;
    return {
      playerId: mdp.playerId,
      name: mdp.player.name,
      jerseyNumber: mdp.player.jerseyNumber,
      aptitudes: aptitudes as Record<import("../src/lib/constants").PositionCode, number>,
      isBeginner: mdp.isBeginnerOnDay,
      canPlay: mdp.canPlay && mdp.attendanceStatus !== "ABSENT",
      maxPlayingSlots: mdp.maxPlayingSlots,
      priority: mdp.priority,
    };
  });

  const periods = bundle.matches.flatMap((m, mi) =>
    m.periods.map((p, pi) => ({
      periodId: p.id,
      matchNumber: m.matchNumber,
      periodOrder: p.periodOrder,
      globalOrder: mi * 4 + pi,
    }))
  );

  const config = {
    beginnerLimit: 2,
    fairnessWeight: 60,
    aptitudeWeight: 20,
    continuityPenalty: 20,
    positionRepeatPenalty: 10,
    randomnessWeight: 10,
    seed: 20260720,
  };

  const result = generateLineup(lineupPlayers, periods, config);
  check("自動編成が成功する", result.ok, result.errors.join(", "));

  // DBへ保存
  const positions = await prisma.position.findMany();
  const positionByCode = new Map(positions.map((p) => [p.code, p.id]));
  await prisma.lineupAssignment.createMany({
    data: result.assignments.map((a) => ({
      matchPeriodId: a.periodId,
      playerId: a.playerId,
      positionId: positionByCode.get(a.positionCode)!,
      isLocked: a.isLocked,
    })),
  });
  await prisma.matchDay.update({
    where: { id: matchDay.id },
    data: { status: "GENERATED" },
  });

  // --- 5. DB上の編成を検証 ---
  const saved = await prisma.lineupAssignment.findMany({
    where: { matchPeriod: { match: { matchDayId: matchDay.id } } },
    include: { matchPeriod: true, position: true },
  });
  check("全96枠 (12区分×8人) が保存された", saved.length === 96, `実際: ${saved.length}`);

  const byPeriod = new Map<string, typeof saved>();
  for (const a of saved) {
    const list = byPeriod.get(a.matchPeriodId) ?? [];
    list.push(a);
    byPeriod.set(a.matchPeriodId, list);
  }

  const beginnerIdSet = new Set(
    bundle.players.filter((p) => p.isBeginnerOnDay).map((p) => p.playerId)
  );
  let allPeriodsOk = true;
  let beginnersOk = true;
  let noAbsent = true;
  for (const list of byPeriod.values()) {
    if (list.length !== 8) allPeriodsOk = false;
    if (new Set(list.map((a) => a.position.code)).size !== 8) allPeriodsOk = false;
    if (new Set(list.map((a) => a.playerId)).size !== 8) allPeriodsOk = false;
    const bc = list.filter((a) => beginnerIdSet.has(a.playerId)).length;
    if (bc > 2) beginnersOk = false;
    if (list.some((a) => absentIds.has(a.playerId))) noAbsent = false;
  }
  check("全12区分で8人・8ポジション・重複なし", allPeriodsOk);
  check("全12区分で初心者は最大2人", beginnersOk);
  check("欠席者が配置されていない", noAbsent);

  // 出場均等 (グループ内で差2以内)
  const countBy = new Map<string, number>();
  for (const a of saved) countBy.set(a.playerId, (countBy.get(a.playerId) ?? 0) + 1);
  const participantIds = lineupPlayers.filter((p) => p.canPlay);
  const regularCounts = participantIds.filter((p) => !p.isBeginner).map((p) => countBy.get(p.playerId) ?? 0);
  const beginnerCounts = participantIds.filter((p) => p.isBeginner).map((p) => countBy.get(p.playerId) ?? 0);
  check(
    "出場枠が均等 (一般選手内で差2以内)",
    Math.max(...regularCounts) - Math.min(...regularCounts) <= 2,
    `counts=${regularCounts.join(",")}`
  );
  check(
    "出場枠が均等 (初心者内で差2以内)",
    Math.max(...beginnerCounts) - Math.min(...beginnerCounts) <= 2,
    `counts=${beginnerCounts.join(",")}`
  );

  // --- 6. 固定して再生成 ---
  const firstPeriod = bundle.matches[0].periods[0];
  const gkAssignment = saved.find(
    (a) => a.matchPeriodId === firstPeriod.id && a.position.code === "GK"
  )!;
  await prisma.lineupAssignment.update({
    where: { id: gkAssignment.id },
    data: { isLocked: true },
  });

  const lockedForRegen: Assignment[] = [
    {
      periodId: firstPeriod.id,
      positionCode: "GK",
      playerId: gkAssignment.playerId,
      isLocked: true,
    },
  ];
  const regen = generateLineup(
    lineupPlayers,
    periods,
    { ...config, seed: 99999 },
    lockedForRegen
  );
  check("再生成が成功する", regen.ok, regen.errors.join(", "));
  const regenGk = regen.assignments.find(
    (a) => a.periodId === firstPeriod.id && a.positionCode === "GK"
  );
  check(
    "固定したGKが再生成後も維持される",
    regenGk?.playerId === gkAssignment.playerId
  );

  // 再生成結果で置き換え
  await prisma.lineupAssignment.deleteMany({
    where: { matchPeriod: { match: { matchDayId: matchDay.id } } },
  });
  await prisma.lineupAssignment.createMany({
    data: regen.assignments.map((a) => ({
      matchPeriodId: a.periodId,
      playerId: a.playerId,
      positionId: positionByCode.get(a.positionCode)!,
      isLocked: a.isLocked,
    })),
  });

  // --- 7. 確定 → 履歴確認 ---
  await prisma.matchDay.update({
    where: { id: matchDay.id },
    data: { status: "CONFIRMED" },
  });
  const confirmed = await prisma.matchDay.findUniqueOrThrow({
    where: { id: matchDay.id },
  });
  check("編成が確定済みになる", confirmed.status === "CONFIRMED");

  const historyCount = await prisma.lineupAssignment.count({
    where: { matchPeriod: { match: { matchDayId: matchDay.id } } },
  });
  check("履歴 (確定済み編成) が96枠保持されている", historyCount === 96);

  // --- 後片付け ---
  await prisma.matchDay.delete({ where: { id: matchDay.id } });
  console.log(failed === 0 ? "\n=== 全テスト成功 ===" : `\n=== ${failed}件失敗 ===`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
