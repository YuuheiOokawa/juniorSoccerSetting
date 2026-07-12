// CSV生成ユーティリティ
// Excel (日本語環境) で文字化けしないよう UTF-8 BOM を付与する

export function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  return "\uFEFF" + body + "\r\n";
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
