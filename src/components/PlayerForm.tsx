"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  APTITUDE_LABELS,
  APTITUDE_SHORT_LABELS,
  POSITION_MASTER,
  type PositionCode,
} from "@/lib/constants";
import {
  createPlayer,
  deletePlayer,
  updatePlayer,
  type ActionResult,
} from "@/server/actions/players";
import { PlayerAvatar } from "./PlayerAvatar";

export interface PlayerFormValues {
  id?: string;
  name: string;
  nameKana: string;
  jerseyNumber: number | "";
  imageUrl: string | null;
  isBeginner: boolean;
  isActive: boolean;
  notes: string;
  grade: number | null;
  dominantFoot: string;
  isCaptainCandidate: boolean;
  stamina: number;
  technique: number;
  speed: number;
  defense: number;
  attack: number;
  aptitudes: Record<PositionCode, number>;
}

// 能力値の項目定義
const ABILITY_FIELDS: { key: "stamina" | "technique" | "speed" | "defense" | "attack"; label: string }[] = [
  { key: "stamina", label: "体力" },
  { key: "technique", label: "技術" },
  { key: "speed", label: "スピード" },
  { key: "defense", label: "守備力" },
  { key: "attack", label: "攻撃力" },
];

// カテゴリ一括設定: 「DF」を押すと LDF/CDF/RDF をまとめて設定できる
const CATEGORY_GROUPS: { label: string; codes: PositionCode[] }[] = [
  { label: "DF", codes: ["LDF", "CDF", "RDF"] },
  { label: "MF", codes: ["DMF", "LMF", "CMF", "RMF", "OMF"] },
  { label: "FW", codes: ["LFW", "RFW", "FW"] },
];

// スマートフォン写真をアップロード前に縮小・正方形化する
async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // 中央を正方形に切り抜く (縦横比を統一)
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) return file;
  return new File([blob], "player.jpg", { type: "image/jpeg" });
}

export function PlayerForm({ initial }: { initial: PlayerFormValues }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aptitudes, setAptitudes] = useState(initial.aptitudes);
  const [abilities, setAbilities] = useState({
    stamina: initial.stamina,
    technique: initial.technique,
    speed: initial.speed,
    defense: initial.defense,
    attack: initial.attack,
  });
  const [preview, setPreview] = useState<string | null>(initial.imageUrl);
  const imageFileRef = useRef<File | null>(null);

  const setLevel = (code: PositionCode, level: number) =>
    setAptitudes((prev) => ({ ...prev, [code]: level }));

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      imageFileRef.current = compressed;
      setPreview(URL.createObjectURL(compressed));
    } catch {
      setError("画像の読み込みに失敗しました。別の画像をお試しください。");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.delete("imageRaw");
    const isActiveEl = form.elements.namedItem("isActive") as HTMLInputElement;
    formData.set("isActive", isActiveEl.checked ? "on" : "off");
    if (imageFileRef.current) {
      formData.set("image", imageFileRef.current);
    }
    for (const [code, level] of Object.entries(aptitudes)) {
      formData.set(`aptitude_${code}`, String(level));
    }
    for (const [key, level] of Object.entries(abilities)) {
      formData.set(key, String(level));
    }

    startTransition(async () => {
      const result: ActionResult = initial.id
        ? await updatePlayer(initial.id, formData)
        : await createPlayer(formData);
      if (result.ok) {
        router.push("/players");
        router.refresh();
      } else {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const handleDelete = () => {
    if (!initial.id) return;
    if (!window.confirm(`「${initial.name}」を削除します。過去の出場記録も削除されます。よろしいですか?`))
      return;
    startTransition(async () => {
      const result = await deletePlayer(initial.id!);
      if (result.ok) {
        router.push("/players");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex items-center gap-4">
          <PlayerAvatar imageUrl={preview} name={initial.name || "?"} size={72} />
          <div className="flex-1">
            <label className="label">選手画像</label>
            <input
              type="file"
              name="imageRaw"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="block w-full text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              スマートフォンの写真をそのまま選べます (自動で縮小されます)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">選手名 *</label>
            <input
              name="name"
              defaultValue={initial.name}
              required
              maxLength={50}
              className="input"
              placeholder="山田 太郎"
            />
          </div>
          <div>
            <label className="label">ふりがな</label>
            <input
              name="nameKana"
              defaultValue={initial.nameKana}
              maxLength={50}
              className="input"
              placeholder="やまだ たろう"
            />
          </div>
          <div>
            <label className="label">背番号 *</label>
            <input
              name="jerseyNumber"
              type="number"
              inputMode="numeric"
              defaultValue={initial.jerseyNumber}
              required
              min={0}
              max={999}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">学年</label>
              <select name="grade" defaultValue={initial.grade ?? ""} className="input">
                <option value="">未設定</option>
                {[1, 2, 3, 4, 5, 6].map((g) => (
                  <option key={g} value={g}>
                    {g}年
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">利き足</label>
              <select
                name="dominantFoot"
                defaultValue={initial.dominantFoot}
                className="input"
              >
                <option value="">未設定</option>
                <option value="RIGHT">右</option>
                <option value="LEFT">左</option>
                <option value="BOTH">両足</option>
              </select>
            </div>
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 text-base font-bold">
              <input
                type="checkbox"
                name="isBeginner"
                defaultChecked={initial.isBeginner}
                className="h-5 w-5"
              />
              🔰 初心者
            </label>
            <label className="flex items-center gap-2 text-base font-bold">
              <input
                type="checkbox"
                name="isActive"
                value="on"
                defaultChecked={initial.isActive}
                className="h-5 w-5"
              />
              在籍中
            </label>
            <label className="flex items-center gap-2 text-base font-bold">
              <input
                type="checkbox"
                name="isCaptainCandidate"
                defaultChecked={initial.isCaptainCandidate}
                className="h-5 w-5"
              />
              Ⓒ キャプテン候補
            </label>
          </div>
        </div>

        <div>
          <label className="label">メモ</label>
          <textarea
            name="notes"
            defaultValue={initial.notes}
            maxLength={500}
            rows={2}
            className="input"
          />
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">能力値</h2>
        <p className="text-xs text-slate-500">
          星をタップして設定します (もう一度同じ星をタップで解除)。将来の自動編成の参考値になります。
        </p>
        <div className="space-y-2">
          {ABILITY_FIELDS.map((f) => (
            <div
              key={f.key}
              className="flex items-center gap-3 rounded-lg bg-slate-50 p-2"
            >
              <span className="w-20 font-bold">{f.label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-label={`${f.label} ${level}`}
                    onClick={() =>
                      setAbilities((prev) => ({
                        ...prev,
                        [f.key]: prev[f.key] === level ? 0 : level,
                      }))
                    }
                    className={`text-2xl leading-none transition ${
                      abilities[f.key] >= level
                        ? "text-amber-400"
                        : "text-slate-300"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <span className="ml-auto text-sm font-bold text-slate-500">
                {abilities[f.key] === 0 ? "未設定" : `${abilities[f.key]} / 5`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">対応可能ポジションと適性</h2>
        <div className="flex gap-2">
          {CATEGORY_GROUPS.map((g) => (
            <button
              key={g.label}
              type="button"
              className="btn-secondary !py-1.5 text-sm"
              onClick={() =>
                setAptitudes((prev) => {
                  const next = { ...prev };
                  const anyZero = g.codes.some((c) => prev[c] === 0);
                  for (const c of g.codes) next[c] = anyZero ? 2 : 0;
                  return next;
                })
              }
            >
              {g.label} 一括
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {[5, 4, 3, 2, 1, 0]
            .map((l) => `${APTITUDE_SHORT_LABELS[l]}=${APTITUDE_LABELS[l]}`)
            .join(" / ")}
        </p>
        <div className="space-y-2">
          {POSITION_MASTER.map((pos) => (
            <div
              key={pos.code}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2"
            >
              <span className="w-14 font-mono font-bold">{pos.code}</span>
              <span className="w-40 flex-1 text-sm text-slate-600 sm:flex-none">
                {pos.name}
              </span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLevel(pos.code, level)}
                    title={APTITUDE_LABELS[level]}
                    aria-label={`${pos.code} ${APTITUDE_LABELS[level]}`}
                    className={`min-w-[42px] rounded-lg px-2 py-1.5 text-sm font-bold border ${
                      aptitudes[pos.code] === level
                        ? level === 0
                          ? "bg-slate-500 text-white border-slate-500"
                          : "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-slate-600 border-slate-300"
                    }`}
                  >
                    {APTITUDE_SHORT_LABELS[level]}
                  </button>
                ))}
              </div>
              <span className="ml-auto w-20 text-right text-xs font-bold text-slate-500">
                {APTITUDE_LABELS[aptitudes[pos.code]]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? "保存中..." : "保存する"}
        </button>
        {initial.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="btn-danger"
          >
            削除
          </button>
        )}
      </div>
    </form>
  );
}
