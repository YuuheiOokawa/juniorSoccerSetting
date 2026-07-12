import { PrismaClient } from "@prisma/client";
import { POSITION_MASTER } from "../src/lib/constants";

const prisma = new PrismaClient();

// 開発確認用シードデータ
// GK専門2人 / DF中心4人 / MF中心4人 / FW中心3人 / 複数対応2人 (計15人、うち初心者5人)
const PLAYERS: {
  name: string;
  nameKana: string;
  jerseyNumber: number;
  isBeginner: boolean;
  aptitudes: Record<string, number>; // code -> level
}[] = [
  // GK専門
  { name: "佐藤 大翔", nameKana: "さとう ひろと", jerseyNumber: 1, isBeginner: false, aptitudes: { GK: 3, CDF: 1 } },
  { name: "鈴木 陽太", nameKana: "すずき ようた", jerseyNumber: 12, isBeginner: false, aptitudes: { GK: 2, CDF: 2, RDF: 1 } },
  // DF中心
  { name: "高橋 蓮", nameKana: "たかはし れん", jerseyNumber: 2, isBeginner: false, aptitudes: { LDF: 3, CDF: 2, RDF: 2 } },
  { name: "田中 湊", nameKana: "たなか みなと", jerseyNumber: 3, isBeginner: false, aptitudes: { CDF: 3, LDF: 2, RDF: 2, CMF: 1 } },
  { name: "伊藤 悠真", nameKana: "いとう ゆうま", jerseyNumber: 4, isBeginner: false, aptitudes: { RDF: 3, CDF: 2, LDF: 1 } },
  { name: "渡辺 朝陽", nameKana: "わたなべ あさひ", jerseyNumber: 5, isBeginner: true, aptitudes: { LDF: 1, CDF: 1, RDF: 1 } },
  // MF中心
  { name: "山本 樹", nameKana: "やまもと いつき", jerseyNumber: 6, isBeginner: false, aptitudes: { CMF: 3, LMF: 2, RMF: 2, FW: 1 } },
  { name: "中村 律", nameKana: "なかむら りつ", jerseyNumber: 7, isBeginner: false, aptitudes: { LMF: 3, CMF: 2, RMF: 2 } },
  { name: "小林 颯真", nameKana: "こばやし そうま", jerseyNumber: 8, isBeginner: false, aptitudes: { RMF: 3, LMF: 2, CMF: 1 } },
  { name: "加藤 陽翔", nameKana: "かとう はると", jerseyNumber: 14, isBeginner: true, aptitudes: { LMF: 1, RMF: 1 } },
  // FW中心
  { name: "吉田 蒼", nameKana: "よしだ あおい", jerseyNumber: 9, isBeginner: false, aptitudes: { FW: 3, CMF: 1, RMF: 1 } },
  { name: "山田 廉", nameKana: "やまだ れん", jerseyNumber: 10, isBeginner: false, aptitudes: { FW: 2, LMF: 2, RMF: 2 } },
  { name: "佐々木 新", nameKana: "ささき あらた", jerseyNumber: 11, isBeginner: true, aptitudes: { FW: 1, RMF: 1 } },
  // 複数ポジション対応
  { name: "山口 奏太", nameKana: "やまぐち そうた", jerseyNumber: 13, isBeginner: true, aptitudes: { LDF: 1, LMF: 1, FW: 1, RDF: 1 } },
  { name: "松本 陸", nameKana: "まつもと りく", jerseyNumber: 15, isBeginner: true, aptitudes: { CDF: 1, CMF: 1, GK: 1 } },
];

async function main() {
  // ポジションマスタ (upsert で冪等に)
  for (const p of POSITION_MASTER) {
    await prisma.position.upsert({
      where: { code: p.code },
      update: { name: p.name, category: p.category, sortOrder: p.sortOrder },
      create: p,
    });
  }
  console.log(`ポジションマスタ: ${POSITION_MASTER.length}件`);

  const positions = await prisma.position.findMany();
  const positionByCode = new Map(positions.map((p) => [p.code, p.id]));

  let created = 0;
  for (const seed of PLAYERS) {
    const existing = await prisma.player.findUnique({
      where: { jerseyNumber: seed.jerseyNumber },
    });
    if (existing) continue;

    await prisma.player.create({
      data: {
        name: seed.name,
        nameKana: seed.nameKana,
        jerseyNumber: seed.jerseyNumber,
        isBeginner: seed.isBeginner,
        canPlayGk: (seed.aptitudes.GK ?? 0) > 0,
        isActive: true,
        positions: {
          create: Object.entries(seed.aptitudes).map(([code, level]) => ({
            positionId: positionByCode.get(code)!,
            aptitudeLevel: level,
            isAvailable: level > 0,
          })),
        },
      },
    });
    created++;
  }
  console.log(`選手: ${created}件作成 (既存はスキップ)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
