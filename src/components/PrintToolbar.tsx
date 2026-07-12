"use client";

import { useState } from "react";

export interface ShareData {
  title: string;
  matches: {
    matchNumber: number;
    opponentName: string;
    startTime: string;
    periods: {
      label: string;
      positions: { code: string; player: string }[];
    }[];
  }[];
}

// メンバー表をcanvasでPNG画像化する。
// 選手写真は使わず文字ベースで描画するため、外部画像による
// canvas汚染 (CORS) の問題が発生しない。
function renderShareImage(data: ShareData): HTMLCanvasElement {
  const width = 1080;
  const headerH = 90;
  const matchTitleH = 56;
  const rowH = 44;
  const tableHeaderH = 48;
  const matchGap = 28;
  const rows = 8; // 8ポジション
  const matchBlockH = matchTitleH + tableHeaderH + rows * rowH + matchGap;
  const height = headerH + data.matches.length * matchBlockH + 30;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // 背景
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // ヘッダー
  ctx.fillStyle = "#047857";
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`⚽ ${data.title} メンバー表`, 24, headerH / 2);

  let y = headerH + 10;
  const colX = (i: number) => 150 + i * ((width - 170) / 4);

  for (const match of data.matches) {
    // 試合タイトル
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(
      `第${match.matchNumber}試合${match.opponentName ? ` vs ${match.opponentName}` : ""}${match.startTime ? ` (${match.startTime}〜)` : ""}`,
      24,
      y + matchTitleH / 2
    );
    y += matchTitleH;

    // 表ヘッダー
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(16, y, width - 32, tableHeaderH);
    ctx.fillStyle = "#334155";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("ポジション", 24, y + tableHeaderH / 2);
    match.periods.forEach((p, i) => {
      ctx.fillText(p.label, colX(i), y + tableHeaderH / 2);
    });
    y += tableHeaderH;

    // 行
    const codes = match.periods[0]?.positions.map((p) => p.code) ?? [];
    codes.forEach((code, rowIdx) => {
      if (rowIdx % 2 === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(16, y, width - 32, rowH);
      }
      ctx.fillStyle = "#047857";
      ctx.font = "bold 22px monospace";
      ctx.fillText(code, 24, y + rowH / 2);
      ctx.fillStyle = "#0f172a";
      ctx.font = "22px sans-serif";
      match.periods.forEach((p, i) => {
        const cell = p.positions.find((x) => x.code === code);
        ctx.fillText(cell?.player ?? "-", colX(i), y + rowH / 2, (width - 170) / 4 - 16);
      });
      y += rowH;
    });
    y += matchGap;
  }

  return canvas;
}

export function PrintToolbar({
  matchDayId,
  shareData,
}: {
  matchDayId: string;
  shareData: ShareData;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const makeBlob = async (): Promise<Blob> => {
    const canvas = renderShareImage(shareData);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) throw new Error("画像の生成に失敗しました。");
    return blob;
  };

  const handleShare = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await makeBlob();
      const file = new File([blob], "メンバー表.png", { type: "image/png" });
      // Web Share API (スマートフォンではLINE等のアプリへ直接共有できる)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: shareData.title });
      } else {
        downloadBlob(blob);
        setMessage("この端末は共有に対応していないため、画像をダウンロードしました。");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessage("共有できませんでした。画像の保存をお試しください。");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      downloadBlob(await makeBlob());
    } catch {
      setMessage("画像の生成に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "メンバー表.png";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="no-print space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button onClick={() => window.print()} className="btn-secondary">
          🖨️ 印刷
        </button>
        <button onClick={handleShare} disabled={busy} className="btn-secondary">
          📤 画像で共有
        </button>
        <button onClick={handleDownload} disabled={busy} className="btn-secondary">
          💾 画像を保存
        </button>
        <a
          href={`/api/export/match-days/${matchDayId}/roster`}
          className="btn-secondary"
        >
          📄 CSV出力
        </a>
      </div>
      {message && (
        <p className="rounded-lg bg-amber-50 p-2 text-sm font-bold text-amber-700">
          {message}
        </p>
      )}
    </div>
  );
}
