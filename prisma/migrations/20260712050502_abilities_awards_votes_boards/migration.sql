-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "attack" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defense" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dominantFoot" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "isCaptainCandidate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "speed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stamina" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "technique" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlayerAward" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "awardName" TEXT NOT NULL DEFAULT '優秀選手賞',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MvpVote" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MvpVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardPost" (
    "id" TEXT NOT NULL,
    "boardType" TEXT NOT NULL,
    "grade" INTEGER,
    "matchDayId" TEXT,
    "authorName" TEXT NOT NULL DEFAULT '匿名',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerAward_matchDayId_idx" ON "PlayerAward"("matchDayId");

-- CreateIndex
CREATE INDEX "PlayerAward_playerId_idx" ON "PlayerAward"("playerId");

-- CreateIndex
CREATE INDEX "MvpVote_matchDayId_idx" ON "MvpVote"("matchDayId");

-- CreateIndex
CREATE INDEX "BoardPost_boardType_grade_createdAt_idx" ON "BoardPost"("boardType", "grade", "createdAt");

-- CreateIndex
CREATE INDEX "BoardPost_matchDayId_createdAt_idx" ON "BoardPost"("matchDayId", "createdAt");

-- CreateIndex
CREATE INDEX "Player_grade_idx" ON "Player"("grade");

-- AddForeignKey
ALTER TABLE "PlayerAward" ADD CONSTRAINT "PlayerAward_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAward" ADD CONSTRAINT "PlayerAward_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpVote" ADD CONSTRAINT "MvpVote_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpVote" ADD CONSTRAINT "MvpVote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardPost" ADD CONSTRAINT "BoardPost_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
