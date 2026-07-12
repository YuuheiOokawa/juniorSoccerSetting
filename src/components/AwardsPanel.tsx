"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addAward, deleteAward, voteMvp } from "@/server/actions/community";
import { PlayerAvatar } from "./PlayerAvatar";

interface VotePlayer {
  playerId: string;
  name: string;
  jerseyNumber: number;
  imageUrl: string | null;
  votes: number;
}

interface AwardItem {
  id: string;
  awardName: string;
  playerName: string;
  notes: string;
}

export function AwardsPanel({
  matchDayId,
  players,
  totalVotes,
  awards,
}: {
  matchDayId: string;
  players: VotePlayer[];
  totalVotes: number;
  awards: AwardItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [voted, setVoted] = useState(false);
  const [awardPlayer, setAwardPlayer] = useState<string>("");
  const [awardName, setAwardName] = useState("優秀選手賞");

  // 同じ端末からの二重投票を防ぐ簡易制御 (匿名のためサーバー側では制限しない)
  const votedKey = `mvpVoted:${matchDayId}`;
  useEffect(() => {
    setVoted(localStorage.getItem(votedKey) === "1");
  }, [votedKey]);

  const maxVotes = Math.max(1, ...players.map((p) => p.votes));
  const sorted = [...players].sort((a, b) => b.votes - a.votes);

  const handleVote = () => {
    if (!selectedPlayer) return;
    setMessage(null);
    startTransition(async () => {
      const result = await voteMvp(matchDayId, selectedPlayer);
      if (result.ok) {
        localStorage.setItem(votedKey, "1");
        setVoted(true);
        setMessage({ ok: true, text: "投票しました。ご協力ありがとうございます!" });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  };

  const handleAddAward = () => {
    if (!awardPlayer) {
      setMessage({ ok: false, text: "受賞する選手を選択してください。" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await addAward({
        matchDayId,
        playerId: awardPlayer,
        awardName,
        notes: "",
      });
      if (result.ok) {
        setMessage({ ok: true, text: "表彰を登録しました。" });
        setAwardPlayer("");
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  };

  const handleDeleteAward = (awardId: string, label: string) => {
    if (!window.confirm(`「${label}」の表彰を削除します。よろしいですか?`)) return;
    startTransition(async () => {
      const result = await deleteAward(awardId);
      if (result.ok) router.refresh();
      else setMessage({ ok: false, text: result.error });
    });
  };

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-lg p-3 font-bold ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 匿名投票 */}
      <div className="card space-y-3">
        <h2 className="font-bold">優秀選手の投票 (匿名)</h2>
        <p className="text-sm text-slate-600">
          誰が投票したかは記録されません。スタッフそれぞれの端末から1回ずつ投票してください。
        </p>
        {voted ? (
          <p className="rounded-lg bg-emerald-50 p-3 font-bold text-emerald-700">
            ✅ この端末からは投票済みです
          </p>
        ) : (
          <div className="flex gap-2">
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="input flex-1"
            >
              <option value="">選手を選択...</option>
              {players.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {p.jerseyNumber} {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleVote}
              disabled={!selectedPlayer || isPending}
              className="btn-primary"
            >
              {isPending ? "送信中..." : "🗳️ 投票する"}
            </button>
          </div>
        )}
      </div>

      {/* 集計 */}
      <div className="card space-y-2">
        <h2 className="font-bold">投票結果 (合計 {totalVotes}票)</h2>
        {totalVotes === 0 ? (
          <p className="text-sm text-slate-400">まだ投票がありません。</p>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((p, i) => (
              <li key={p.playerId} className="flex items-center gap-2">
                <span className="w-6 text-center font-bold text-slate-400">
                  {p.votes > 0 ? i + 1 : "-"}
                </span>
                <PlayerAvatar imageUrl={p.imageUrl} name={p.name} size={28} />
                <span className="w-32 truncate text-sm font-bold sm:w-40">
                  {p.jerseyNumber} {p.name}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      p.votes === maxVotes && p.votes > 0
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                    style={{ width: `${(p.votes / maxVotes) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono font-bold">
                  {p.votes}票
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 表彰の登録 */}
      <div className="card space-y-3">
        <h2 className="font-bold">表彰の記録</h2>
        {awards.length > 0 && (
          <ul className="space-y-1.5">
            {awards.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-lg bg-amber-50 p-2.5"
              >
                <span className="text-xl">🏆</span>
                <span className="font-bold">{a.awardName}</span>
                <span className="flex-1 truncate">{a.playerName}</span>
                <button
                  onClick={() => handleDeleteAward(a.id, `${a.awardName} ${a.playerName}`)}
                  disabled={isPending}
                  className="text-sm text-red-500 underline"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            value={awardName}
            onChange={(e) => setAwardName(e.target.value)}
            maxLength={50}
            placeholder="賞の名前"
            className="input !w-40"
          />
          <select
            value={awardPlayer}
            onChange={(e) => setAwardPlayer(e.target.value)}
            className="input flex-1"
          >
            <option value="">受賞選手を選択...</option>
            {players.map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.jerseyNumber} {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddAward}
            disabled={isPending}
            className="btn-primary"
          >
            登録
          </button>
        </div>
        <p className="text-xs text-slate-500">
          招待杯などでもらった優秀選手賞のほか、チーム内MVPなど自由な名前で記録できます。
        </p>
      </div>
    </div>
  );
}
