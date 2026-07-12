import { prisma } from "@/lib/db";
import { POSITION_CODES, type PositionCode } from "@/lib/constants";
import type { Assignment, LineupPeriod, LineupPlayer } from "@/lib/lineup/types";

// 試合日の編成に必要なデータを一括で読み込む (N+1を避ける)
export async function loadMatchDayBundle(matchDayId: string) {
  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: {
      matches: {
        orderBy: { matchNumber: "asc" },
        include: {
          periods: {
            orderBy: { periodOrder: "asc" },
            include: {
              assignments: {
                include: { position: true },
              },
            },
          },
        },
      },
      players: {
        include: {
          player: {
            include: { positions: { include: { position: true } } },
          },
        },
      },
      generationSetting: true,
    },
  });
  return matchDay;
}

export type MatchDayBundle = NonNullable<
  Awaited<ReturnType<typeof loadMatchDayBundle>>
>;

// DBデータを自動編成アルゴリズムの入力形式へ変換する
export function toLineupPlayers(bundle: MatchDayBundle): LineupPlayer[] {
  return bundle.players.map((mdp) => {
    const aptitudes = {} as Record<PositionCode, number>;
    for (const code of POSITION_CODES) aptitudes[code] = 0;
    for (const pp of mdp.player.positions) {
      const code = pp.position.code as PositionCode;
      if (POSITION_CODES.includes(code)) {
        aptitudes[code] = pp.isAvailable ? pp.aptitudeLevel : 0;
      }
    }
    // 当日のGK可否設定が優先される
    if (!mdp.canPlayGk) aptitudes.GK = 0;
    else if (mdp.canPlayGk && aptitudes.GK === 0) aptitudes.GK = 1;

    const canPlay =
      mdp.canPlay &&
      mdp.attendanceStatus !== "ABSENT" &&
      mdp.attendanceStatus !== "INJURED" &&
      mdp.attendanceStatus !== "SICK";

    return {
      playerId: mdp.playerId,
      name: mdp.player.name,
      jerseyNumber: mdp.player.jerseyNumber,
      aptitudes,
      isBeginner: mdp.isBeginnerOnDay,
      canPlay,
      maxPlayingSlots: mdp.maxPlayingSlots,
      priority: mdp.priority,
    };
  });
}

export function toLineupPeriods(bundle: MatchDayBundle): LineupPeriod[] {
  const periods: LineupPeriod[] = [];
  let globalOrder = 0;
  for (const match of bundle.matches) {
    for (const period of match.periods) {
      periods.push({
        periodId: period.id,
        matchNumber: match.matchNumber,
        periodOrder: period.periodOrder,
        globalOrder: globalOrder++,
      });
    }
  }
  return periods;
}

export function toAssignments(bundle: MatchDayBundle): Assignment[] {
  const assignments: Assignment[] = [];
  for (const match of bundle.matches) {
    for (const period of match.periods) {
      for (const a of period.assignments) {
        assignments.push({
          periodId: period.id,
          positionCode: a.position.code as PositionCode,
          playerId: a.playerId,
          isLocked: a.isLocked,
        });
      }
    }
  }
  return assignments;
}
