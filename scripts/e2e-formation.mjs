// フォーメーション画面のE2Eテスト (ドラッグ&ドロップ / タップ交代 / 保存)
//
// 前提:
//   - DATABASE_URL のDBにシード済み (npx prisma db seed)
//   - アプリが起動していること (npm run dev または next start)
// 実行:
//   BASE_URL=http://localhost:3000 node scripts/e2e-formation.mjs
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const EXECUTABLE =
  process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

const prisma = new PrismaClient();
let failed = 0;
const check = (name, cond) => {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) failed++;
};

// ---- テスト用試合日を作成 ----
const players = await prisma.player.findMany({ where: { isActive: true } });
if (players.length < 13) {
  console.error("選手が13人未満です。npx prisma db seed を実行してください。");
  process.exit(1);
}
const PERIOD_TYPES = [
  "FIRST_HALF_FIRST",
  "FIRST_HALF_SECOND",
  "SECOND_HALF_FIRST",
  "SECOND_HALF_SECOND",
];
const matchDay = await prisma.matchDay.create({
  data: {
    matchDate: new Date("2099-01-01"),
    eventName: "E2Eテスト(自動削除されます)",
    numberOfMatches: 1,
    matches: {
      create: [
        {
          matchNumber: 1,
          periods: {
            create: PERIOD_TYPES.map((t, i) => ({
              periodType: t,
              periodOrder: i + 1,
              startSecond: i * 450,
              durationSecs: 450,
            })),
          },
        },
      ],
    },
    generationSetting: { create: {} },
  },
});
await prisma.matchDayPlayer.createMany({
  data: players.slice(0, 13).map((p) => ({
    matchDayId: matchDay.id,
    playerId: p.id,
    isBeginnerOnDay: p.isBeginner,
    canPlayGk: p.canPlayGk,
  })),
});

const browser = await chromium.launch({ executablePath: EXECUTABLE });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1700 } });
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE_URL}/match-days/${matchDay.id}/formation`, {
    waitUntil: "networkidle",
  });

  // 1. 自動編成
  await page.click("text=🔄 1日全体");
  await page.waitForSelector("text=編成を作成しました", { timeout: 15000 });
  check("自動編成が成功", true);
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  // ドラッグ用ヘルパー (中心から中心へ段階的に移動)
  const dragTo = async (fromLoc, toLoc) => {
    const from = await fromLoc.boundingBox();
    const to = await toLoc.boundingBox();
    const fx = from.x + from.width / 2;
    const fy = from.y + from.height / 2;
    const tx = to.x + to.width / 2;
    const ty = to.y + to.height / 2;
    await page.mouse.move(fx, fy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(fx + ((tx - fx) * i) / 10, fy + ((ty - fy) * i) / 10);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  const nameOf = (t) => (t ?? "").replace(/GK|FW|CMF|🔒|✋|🔰/g, "").trim();

  // 2. コート内ドラッグ: GK ↔ FW
  const gkBefore = await page.locator('[data-drop="court:GK"]').textContent();
  const fwBefore = await page.locator('[data-drop="court:FW"]').textContent();
  await dragTo(page.locator('[data-drop="court:GK"]'), page.locator('[data-drop="court:FW"]'));
  const gkAfter = await page.locator('[data-drop="court:GK"]').textContent();
  const fwAfter = await page.locator('[data-drop="court:FW"]').textContent();
  check(
    "ドラッグでGKとFWの選手が入れ替わる",
    nameOf(gkAfter) === nameOf(fwBefore) && nameOf(fwAfter) === nameOf(gkBefore)
  );
  check("「未保存の変更あり」が表示される", await page.isVisible("text=未保存の変更あり"));

  // 3. 控え → コート (交代)
  const benchBtn = page.locator('[data-drop^="bench:"]').first();
  const benchText = (await benchBtn.textContent()) ?? "";
  const benchPlayerName = benchText.match(/\d+ ([^\d🔰]+)/)?.[1]?.trim() ?? "";
  await dragTo(benchBtn, page.locator('[data-drop="court:CMF"]'));
  const cmfAfter = (await page.locator('[data-drop="court:CMF"]').textContent()) ?? "";
  check(
    `控え選手(${benchPlayerName})をCMFへドラッグで交代`,
    benchPlayerName !== "" && cmfAfter.includes(benchPlayerName)
  );

  // 4. タップ選択も引き続き動作
  await page.click('[data-drop="court:CMF"]');
  check("タップ選択が引き続き動作", await page.isVisible("text=選択解除"));
  await page.click("text=選択解除");

  // 5. 保存
  await page.click("text=💾 保存する");
  await page.waitForSelector("text=保存しました", { timeout: 10000 });
  check("手動編集の保存が成功", true);
} finally {
  await browser.close();
  await prisma.matchDay.delete({ where: { id: matchDay.id } });
  await prisma.$disconnect();
}

console.log(failed === 0 ? "\n=== 全テスト成功 ===" : `\n=== ${failed}件失敗 ===`);
process.exit(failed === 0 ? 0 : 1);
