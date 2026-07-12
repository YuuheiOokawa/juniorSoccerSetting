import { PlayerForm } from "@/components/PlayerForm";
import { POSITION_CODES, type PositionCode } from "@/lib/constants";

export default function NewPlayerPage() {
  const aptitudes = {} as Record<PositionCode, number>;
  for (const code of POSITION_CODES) aptitudes[code] = 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">選手の新規登録</h1>
      <PlayerForm
        initial={{
          name: "",
          nameKana: "",
          jerseyNumber: "",
          imageUrl: null,
          isBeginner: false,
          isActive: true,
          notes: "",
          grade: null,
          dominantFoot: "",
          isCaptainCandidate: false,
          stamina: 0,
          technique: 0,
          speed: 0,
          defense: 0,
          attack: 0,
          aptitudes,
        }}
      />
    </div>
  );
}
