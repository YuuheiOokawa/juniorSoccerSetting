import { describe, expect, it } from "vitest";
import { csvEscape, toCsv } from "./csv";

describe("csvEscape", () => {
  it("通常の値はそのまま返す", () => {
    expect(csvEscape("山田 太郎")).toBe("山田 太郎");
    expect(csvEscape(10)).toBe("10");
  });

  it("null / undefined は空文字になる", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("カンマ・改行・引用符を含む値は引用符で囲む", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape("a\nb")).toBe('"a\nb"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("toCsv", () => {
  it("BOM付きCRLF区切りのCSVを生成する", () => {
    const csv = toCsv([
      ["背番号", "名前"],
      [10, "山田, 太郎"],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿背番号,名前\r\n10,"山田, 太郎"\r\n');
  });
});
