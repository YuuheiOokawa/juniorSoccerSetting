"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { POSITION_CODES, type PositionCode } from "@/lib/constants";
import { playerSchema } from "@/lib/validation";
import { savePlayerImage } from "../image";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function parseAptitudes(formData: FormData): Record<PositionCode, number> {
  const aptitudes = {} as Record<PositionCode, number>;
  for (const code of POSITION_CODES) {
    const raw = formData.get(`aptitude_${code}`);
    const level = raw == null ? 0 : Number(raw);
    aptitudes[code] = Number.isInteger(level) && level >= 0 && level <= 5 ? level : 0;
  }
  return aptitudes;
}

async function parsePlayerForm(formData: FormData) {
  const gradeRaw = formData.get("grade");
  const parsed = playerSchema.safeParse({
    name: formData.get("name"),
    nameKana: formData.get("nameKana") ?? "",
    jerseyNumber: formData.get("jerseyNumber"),
    isBeginner: formData.get("isBeginner") === "on",
    isActive: formData.get("isActive") !== "off",
    notes: formData.get("notes") ?? "",
    grade: gradeRaw === "" || gradeRaw == null ? null : gradeRaw,
    dominantFoot: formData.get("dominantFoot") ?? "",
    isCaptainCandidate: formData.get("isCaptainCandidate") === "on",
    stamina: formData.get("stamina") ?? 0,
    technique: formData.get("technique") ?? 0,
    speed: formData.get("speed") ?? 0,
    defense: formData.get("defense") ?? 0,
    attack: formData.get("attack") ?? 0,
    aptitudes: parseAptitudes(formData),
  });
  return parsed;
}

// playerSchema の共通カラムを Prisma の data 形式へ変換
function toPlayerData(data: import("zod").infer<typeof playerSchema>) {
  return {
    name: data.name,
    nameKana: data.nameKana,
    jerseyNumber: data.jerseyNumber,
    isBeginner: data.isBeginner,
    canPlayGk: (data.aptitudes.GK ?? 0) > 0,
    isActive: data.isActive,
    notes: data.notes,
    grade: data.grade,
    dominantFoot: data.dominantFoot,
    isCaptainCandidate: data.isCaptainCandidate,
    stamina: data.stamina,
    technique: data.technique,
    speed: data.speed,
    defense: data.defense,
    attack: data.attack,
  };
}

export async function createPlayer(formData: FormData): Promise<ActionResult> {
  const parsed = await parsePlayerForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const duplicate = await prisma.player.findUnique({
    where: { jerseyNumber: data.jerseyNumber },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `背番号 ${data.jerseyNumber} は「${duplicate.name}」が既に使用しています。`,
    };
  }

  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const saved = await savePlayerImage(image);
    if (!saved.ok) return { ok: false, error: saved.error };
    imageUrl = saved.url;
  }

  const positions = await prisma.position.findMany();
  const positionByCode = new Map(positions.map((p) => [p.code, p.id]));

  const player = await prisma.player.create({
    data: {
      ...toPlayerData(data),
      imageUrl,
      positions: {
        create: POSITION_CODES.map((code) => ({
          positionId: positionByCode.get(code)!,
          aptitudeLevel: data.aptitudes[code] ?? 0,
          isAvailable: (data.aptitudes[code] ?? 0) > 0,
        })),
      },
    },
  });

  revalidatePath("/players");
  revalidatePath("/");
  return { ok: true, id: player.id };
}

export async function updatePlayer(
  playerId: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = await parsePlayerForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const existing = await prisma.player.findUnique({ where: { id: playerId } });
  if (!existing) return { ok: false, error: "選手が見つかりません。" };

  const duplicate = await prisma.player.findFirst({
    where: { jerseyNumber: data.jerseyNumber, id: { not: playerId } },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `背番号 ${data.jerseyNumber} は「${duplicate.name}」が既に使用しています。`,
    };
  }

  let imageUrl = existing.imageUrl;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const saved = await savePlayerImage(image);
    if (!saved.ok) return { ok: false, error: saved.error };
    imageUrl = saved.url;
  }

  const positions = await prisma.position.findMany();
  const positionByCode = new Map(positions.map((p) => [p.code, p.id]));

  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { ...toPlayerData(data), imageUrl },
    }),
    ...POSITION_CODES.map((code) =>
      prisma.playerPosition.upsert({
        where: {
          playerId_positionId: {
            playerId,
            positionId: positionByCode.get(code)!,
          },
        },
        update: {
          aptitudeLevel: data.aptitudes[code] ?? 0,
          isAvailable: (data.aptitudes[code] ?? 0) > 0,
        },
        create: {
          playerId,
          positionId: positionByCode.get(code)!,
          aptitudeLevel: data.aptitudes[code] ?? 0,
          isAvailable: (data.aptitudes[code] ?? 0) > 0,
        },
      })
    ),
  ]);

  revalidatePath("/players");
  revalidatePath("/");
  return { ok: true, id: playerId };
}

export async function deletePlayer(playerId: string): Promise<ActionResult> {
  const existing = await prisma.player.findUnique({ where: { id: playerId } });
  if (!existing) return { ok: false, error: "選手が見つかりません。" };

  await prisma.player.delete({ where: { id: playerId } });

  revalidatePath("/players");
  revalidatePath("/");
  return { ok: true };
}
