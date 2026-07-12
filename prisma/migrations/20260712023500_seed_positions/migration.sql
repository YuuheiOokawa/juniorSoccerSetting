-- ポジションマスタの初期データ (アプリの動作に必須)
-- 冪等: 既に存在する場合は何もしない
INSERT INTO "Position" ("code", "name", "category", "sortOrder") VALUES
  ('GK',  'ゴールキーパー',       'GK', 1),
  ('LDF', '左ディフェンダー',     'DF', 2),
  ('CDF', '中央ディフェンダー',   'DF', 3),
  ('RDF', '右ディフェンダー',     'DF', 4),
  ('LMF', '左ミッドフィルダー',   'MF', 5),
  ('CMF', '中央ミッドフィルダー', 'MF', 6),
  ('RMF', '右ミッドフィルダー',   'MF', 7),
  ('FW',  'フォワード',           'FW', 8)
ON CONFLICT ("code") DO NOTHING;
