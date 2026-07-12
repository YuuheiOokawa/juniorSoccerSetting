-- AlterTable
ALTER TABLE "MatchDay" ADD COLUMN     "formation" TEXT NOT NULL DEFAULT '3-3-1';

-- 新フォーメーション用のポジションを追加 (冪等)
INSERT INTO "Position" ("code", "name", "category", "sortOrder") VALUES
  ('DMF', 'ボランチ (守備的MF)', 'MF', 5),
  ('OMF', 'トップ下 (攻撃的MF)', 'MF', 9),
  ('LFW', '左フォワード', 'FW', 10),
  ('RFW', '右フォワード', 'FW', 11)
ON CONFLICT ("code") DO NOTHING;

-- 既存ポジションの表示順を新しい並びに更新
UPDATE "Position" SET "sortOrder" = 6 WHERE "code" = 'LMF';
UPDATE "Position" SET "sortOrder" = 7 WHERE "code" = 'CMF';
UPDATE "Position" SET "sortOrder" = 8 WHERE "code" = 'RMF';
UPDATE "Position" SET "sortOrder" = 12 WHERE "code" = 'FW';
