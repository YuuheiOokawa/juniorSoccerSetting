import type { MetadataRoute } from "next";

// PWAマニフェスト: スマートフォンの「ホーム画面に追加」で
// アプリのように起動できるようにする
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Junior Soccer Lineup Manager",
    short_name: "Lineup",
    description: "小学生8人制サッカーのポジション・出場時間管理アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#047857",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
