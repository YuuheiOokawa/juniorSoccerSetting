import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  ATTENDANCE_LABELS,
  LINEUP_STATUS_LABELS,
  getFormation,
} from "@/lib/constants";
import { DuplicateMatchDayButton } from "@/components/DuplicateMatchDayButton";
import { GenerateButton } from "@/components/GenerateButton";
import { MatchEditForm } from "@/components/MatchEditForm";

export const dynamic = "force-dynamic";

export default async function MatchDayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchDay = await prisma.matchDay.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { matchNumber: "asc" },
        include: {
          periods: {
            orderBy: { periodOrder: "asc" },
            include: { assignments: { include: { position: true } } },
          },
        },
      },
      players: {
        include: { player: true },
        orderBy: { player: { jerseyNumber: "asc" } },
      },
    },
  });
  if (!matchDay) notFound();

  const participants = matchDay.players.filter(
    (p) => p.canPlay && !["ABSENT", "INJURED", "SICK"].includes(p.attendanceStatus)
  );
  const absent = matchDay.players.filter(
    (p) => !p.canPlay || ["ABSENT", "INJURED", "SICK"].includes(p.attendanceStatus)
  );
  const hasAssignments = matchDay.matches.some((m) =>
    m.periods.some((p) => p.assignments.length > 0)
  );

  // 再生成時に固定情報を引き継ぐため、現在の割り当てを渡す
  const currentAssignments = matchDay.matches.flatMap((m) =>
    m.periods.flatMap((p) =>
      p.assignments.map((a) => ({
        periodId: p.id,
        positionCode: a.position.code,
        playerId: a.playerId,
        isLocked: a.isLocked,
        isManual: a.isManual,
      }))
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">
            {matchDay.matchDate.toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "numeric",
              day: "numeric",
              weekday: "short",
            })}
          </h1>
          <p className="text-slate-500">
            {matchDay.eventName || "(大会名なし)"}
            {matchDay.venue && ` @ ${matchDay.venue}`}
            {matchDay.meetingTime && ` ・集合 ${matchDay.meetingTime}`}
            {" ・"}
            <span className="font-bold text-slate-700">
              ⚽ {getFormation(matchDay.formation).label}
            </span>
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            matchDay.status === "CONFIRMED"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {LINEUP_STATUS_LABELS[matchDay.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link href={`/match-days/${id}/attendance`} className="btn-secondary">
          👥 参加設定
        </Link>
        <Link href={`/match-days/${id}/settings`} className="btn-secondary">
          ⚙️ 編成設定
        </Link>
        <Link href={`/match-days/${id}/formation`} className="btn-secondary">
          ⚽ フォーメーション
        </Link>
        <Link href={`/match-days/${id}/stats`} className="btn-secondary">
          📊 出場時間
        </Link>
        <Link href={`/match-days/${id}/print`} className="btn-secondary">
          📋 メンバー表
        </Link>
        <Link href={`/match-days/${id}/awards`} className="btn-secondary">
          🏆 優秀選手
        </Link>
        <Link href={`/match-days/${id}/board`} className="btn-secondary">
          💬 掲示板
        </Link>
      </div>

      <div className="card space-y-2">
        <h2 className="font-bold">自動編成</h2>
        <p className="text-sm text-slate-600">
          参加 {participants.length}人 / 欠席等 {absent.length}人 ・{" "}
          {matchDay.matches.length}試合 ({matchDay.matches.length * 4}区分)
        </p>
        {participants.length < 8 && (
          <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-700">
            参加できる選手が{participants.length}
            人のため編成できません。8人以上必要です。参加設定を確認してください。
          </p>
        )}
        <GenerateButton
          matchDayId={id}
          currentAssignments={currentAssignments}
          hasExisting={hasAssignments}
          disabled={participants.length < 8 || matchDay.status === "CONFIRMED"}
        />
        {matchDay.status === "CONFIRMED" && (
          <p className="text-sm text-slate-500">
            確定済みのため再生成できません。フォーメーション画面から確定を解除してください。
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">試合情報</h2>
          <div className="flex flex-wrap gap-2">
            <DuplicateMatchDayButton
              matchDayId={id}
              defaultDate={new Date(
                matchDay.matchDate.getTime() + 7 * 24 * 60 * 60 * 1000
              )
                .toISOString()
                .slice(0, 10)}
            />
            <Link href={`/match-days/${id}/edit`} className="btn-secondary !py-1.5 text-sm">
              試合日を編集
            </Link>
          </div>
        </div>
        {matchDay.matches.map((m) => (
          <MatchEditForm
            key={m.id}
            match={{
              id: m.id,
              matchNumber: m.matchNumber,
              opponentName: m.opponentName,
              startTime: m.startTime,
              courtName: m.courtName,
              notes: m.notes,
              scoreFor: m.scoreFor,
              scoreAgainst: m.scoreAgainst,
              assigned: m.periods.every((p) => p.assignments.length === 8),
            }}
          />
        ))}
      </div>

      <div className="card">
        <h2 className="font-bold">当日の参加者</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {matchDay.players.map((mdp) => {
            const isOut =
              !mdp.canPlay ||
              ["ABSENT", "INJURED", "SICK"].includes(mdp.attendanceStatus);
            return (
              <span
                key={mdp.id}
                className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                  isOut
                    ? "bg-slate-200 text-slate-400 line-through"
                    : "bg-emerald-50 text-emerald-800"
                }`}
              >
                {mdp.player.jerseyNumber} {mdp.player.name}
                {mdp.isBeginnerOnDay && " 🔰"}
                {mdp.attendanceStatus !== "PRESENT" &&
                  ` (${ATTENDANCE_LABELS[mdp.attendanceStatus]})`}
              </span>
            );
          })}
          {matchDay.players.length === 0 && (
            <span className="text-slate-400">参加者が未設定です。</span>
          )}
        </div>
      </div>
    </div>
  );
}
