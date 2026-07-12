import { IMAGE_ALLOWED_TYPES, IMAGE_MAX_BYTES } from "@/lib/validation";

// 選手画像の保存。
// - BLOB_READ_WRITE_TOKEN が設定されていれば Vercel Blob に保存 (本番推奨)
// - 未設定の場合は data URL として DB に保存 (PostgreSQL 上で永続化される)
// どちらの方式でも再デプロイ後にデータは消えない。
export async function savePlayerImage(
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "画像は JPEG / PNG / WebP 形式のみアップロードできます。",
    };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, error: "画像サイズは4MB以下にしてください。" };
  }
  if (file.size === 0) {
    return { ok: false, error: "画像ファイルが空です。" };
  }

  // マジックバイトの簡易検証 (拡張子偽装の拒否)
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isValidImageBuffer(buffer, file.type)) {
    return { ok: false, error: "画像ファイルとして認識できませんでした。" };
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const blob = await put(`players/${crypto.randomUUID()}.${ext}`, buffer, {
      access: "public",
      contentType: file.type,
    });
    return { ok: true, url: blob.url };
  }

  // フォールバック: data URL (クライアント側で圧縮済みのため小さい)
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  return { ok: true, url: dataUrl };
}

function isValidImageBuffer(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  switch (mimeType) {
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8;
    case "image/png":
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case "image/webp":
      return (
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );
    default:
      return false;
  }
}
