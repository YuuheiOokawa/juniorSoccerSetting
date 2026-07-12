import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GenerationSettingForm } from "@/components/GenerationSettingForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchDay = await prisma.matchDay.findUnique({
    where: { id },
    include: { generationSetting: true },
  });
  if (!matchDay) notFound();

  const s = matchDay.generationSetting;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">自動編成の設定</h1>
      <GenerationSettingForm
        matchDayId={id}
        initial={{
          beginnerLimit: s?.beginnerLimit ?? 2,
          fairnessWeight: s?.fairnessWeight ?? 50,
          aptitudeWeight: s?.aptitudeWeight ?? 30,
          continuityPenalty: s?.continuityPenalty ?? 20,
          positionRepeatPenalty: s?.positionRepeatPenalty ?? 10,
          randomnessWeight: s?.randomnessWeight ?? 15,
          presetType: s?.presetType ?? "FAIRNESS",
        }}
      />
    </div>
  );
}
