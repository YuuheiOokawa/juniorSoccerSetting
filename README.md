# Junior Soccer Lineup Manager

小学生8人制サッカーのポジション・出場時間管理アプリです。

試合ごとのスターティングメンバー・交代メンバー・各選手のポジションを自動作成し、
監督・コーチがメンバー編成を考える負担を減らします。

## 主な機能

- **選手管理**: 名前・背番号・顔写真・対応可能ポジション・適性レベル・初心者フラグ
- **試合日管理**: 1日に複数試合 (1〜6試合)、参加選手・欠席者の当日設定
- **自動編成**: 3-3-1 フォーメーション、7分30秒ごとの4区分、制約充足 + スコアリング + ランダム性
  - 出場時間を1日全体で均等化
  - 初心者は同一時間帯に最大2人まで (設定変更可)
  - 対応不可ポジションには原則配置しない
  - GK対応者をGKに優先配置
- **手動編集**: タップで選手入れ替え・交代、固定 (🔒)、区分/試合/1日単位の再生成、元に戻す
- **出場時間集計**: 区分数・時間・試合別・ポジション別・連続出場・平均との差
- **履歴**: 過去の試合日・確定済み編成の閲覧、試合結果 (勝/負/分) の表示
- **CSV出力**: 選手一覧・当日メンバー表・出場時間集計 (Excel対応のBOM付きUTF-8)
- **メンバー表の印刷・共有**: 全試合×4区分の一覧表 (A4印刷対応)、PNG画像の保存・Web Share APIによるLINE等への共有
- **スマートフォン対応**: 縦向きコート表示、ボトムナビゲーション

## 技術構成

- Next.js 15 (App Router) / TypeScript / React 19
- Tailwind CSS
- PostgreSQL + Prisma ORM (Neon 対応)
- Zod (サーバー側バリデーション)
- Vitest (単体テスト)
- Vercel + Vercel Blob (選手画像) にデプロイ可能

## ローカルでの起動方法

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` の `DATABASE_URL` にPostgreSQLの接続文字列を設定します。
ローカルにPostgreSQLがある場合の例:

```
DATABASE_URL="postgresql://dev:dev@localhost:5432/junior_soccer"
```

### 3. マイグレーションとシードデータ

```bash
npx prisma migrate dev   # テーブル作成
npx prisma db seed       # ポジションマスタ + ダミー選手15人を投入
```

### 4. 起動

```bash
npm run dev
```

http://localhost:3000 を開きます。

## テスト

```bash
npm test                              # 自動編成アルゴリズムの単体テスト (16件)
npx tsx scripts/integration-test.ts   # 実DBを使った結合テスト (要 DATABASE_URL)
npm run build                         # 型チェック + ビルド
npx next lint                         # ESLint
```

## Neon PostgreSQL の設定方法

1. [Neon](https://neon.tech) でアカウントを作成し、新しいプロジェクトを作成
2. ダッシュボードの「Connection Details」から接続文字列をコピー
   (例: `postgresql://user:pass@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`)
3. `.env` (ローカル) または Vercel の環境変数に `DATABASE_URL` として設定

テーブル作成 (マイグレーション) は **Vercel デプロイ時に自動で実行されます**
(`vercel-build` スクリプトに `prisma migrate deploy` を含めています)。
ポジションマスタ (GK〜FW の8件) もマイグレーションに含まれているため、
手動での初期データ投入は不要です。

手元から適用したい場合は次の1コマンドでも可能です:

```bash
DATABASE_URL="<Neonの接続文字列>" npx prisma migrate deploy
DATABASE_URL="<Neonの接続文字列>" npx prisma db seed   # ダミー選手15人 (任意・開発確認用)
```

## Vercel へのデプロイ方法

1. このリポジトリを GitHub に push し、[Vercel](https://vercel.com) でインポート
2. 環境変数 `DATABASE_URL` (Neonの接続文字列) を設定
3. デプロイを実行 — ビルド時に `prisma migrate deploy` が自動実行され、
   テーブル作成とポジションマスタ投入まで完了します

### 選手画像の保存 (Vercel Blob)

Vercel ダッシュボード → Storage → Blob でストアを作成し、
`BLOB_READ_WRITE_TOKEN` を環境変数に追加してください。

トークン未設定の場合、画像は圧縮のうえ data URL として PostgreSQL に保存されます
(この場合もデータは永続化されます)。

## 環境変数一覧

| 変数名 | 必須 | 説明 |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL 接続文字列 (Neon 推奨) |
| `BLOB_READ_WRITE_TOKEN` | - | Vercel Blob のトークン。選手画像の保存先。未設定時はDBに保存 |

## DBテーブル

| テーブル | 内容 |
| --- | --- |
| `Player` | 選手マスタ (名前・背番号・画像・初心者フラグなど) |
| `Position` | ポジションマスタ (GK/LDF/CDF/RDF/LMF/CMF/RMF/FW) |
| `PlayerPosition` | 選手ごとのポジション適性 (0=不可〜3=得意) |
| `MatchDay` | 試合日 (日付・大会名・会場・試合数・編成状態) |
| `MatchDayPlayer` | 当日の参加選手と当日限定設定 (出欠・GK可否・出場上限など) |
| `Match` | 試合 (対戦相手・開始時刻・得点など) |
| `MatchPeriod` | 時間帯区分 (1試合=4区分、各450秒) |
| `LineupAssignment` | 区分×ポジション×選手の割り当て (固定・手動フラグ付き) |
| `GenerationSetting` | 試合日ごとの自動編成設定 (初心者上限・各種重み) |
| `GenerationHistory` | 自動編成の実行履歴 (シード値含む) |

## 自動編成アルゴリズムの概要

`src/lib/lineup/` に UI から独立した純粋関数として実装しています。

1. **事前チェック**: 参加8人以上、GK対応者の存在、固定配置の競合を検証
2. **区分ごとの配置**: 日全体の通し順で処理。GK → 対応者が少ないポジションの順に、
   候補者を評価点でスコアリングし、上位3人から重み付きランダムで選択
   - 加点: 目標出場枠との差 (均等性)、ポジション適性、直前休憩、優先度
   - 減点: 連続出場、同ポジション連続 (GKは緩和)
   - 除外: 欠席、対応不可、初心者上限超過、出場上限到達、同区分配置済み
3. **偏り改善パス**: 出場枠の最大差が1以下になるまで、固定以外の割り当てを
   出場の少ない選手とスワップ (直接交換 + 第三者を介した2段階交換)
4. **最終検証**: 8人×8ポジション・重複なし・初心者上限・欠席者除外を確認し、
   違反があれば日本語のエラーメッセージを返す

シード付き乱数 (mulberry32) を使用しており、同じシードなら同じ結果を再現できます。
「再生成」では新しいシードを使うため、条件を維持したまま別パターンが得られます。

## 今後の拡張候補

- PDF出力
- 試合結果の詳細管理・対戦相手分析
- 体力・技術などの詳細能力値の編成への反映
- 複数チーム・複数ユーザー対応
