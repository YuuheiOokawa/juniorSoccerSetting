-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT NOT NULL DEFAULT '',
    "jerseyNumber" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "isBeginner" BOOLEAN NOT NULL DEFAULT false,
    "canPlayGk" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerPosition" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,
    "aptitudeLevel" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlayerPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchDay" (
    "id" TEXT NOT NULL,
    "matchDate" DATE NOT NULL,
    "eventName" TEXT NOT NULL DEFAULT '',
    "venue" TEXT NOT NULL DEFAULT '',
    "meetingTime" TEXT NOT NULL DEFAULT '',
    "numberOfMatches" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchDayPlayer" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "attendanceStatus" TEXT NOT NULL DEFAULT 'PRESENT',
    "isBeginnerOnDay" BOOLEAN NOT NULL DEFAULT false,
    "canPlayGk" BOOLEAN NOT NULL DEFAULT false,
    "canPlay" BOOLEAN NOT NULL DEFAULT true,
    "maxPlayingSlots" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "condition" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MatchDayPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "opponentName" TEXT NOT NULL DEFAULT '',
    "startTime" TEXT NOT NULL DEFAULT '',
    "courtName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scoreFor" INTEGER,
    "scoreAgainst" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPeriod" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodOrder" INTEGER NOT NULL,
    "startSecond" INTEGER NOT NULL,
    "durationSecs" INTEGER NOT NULL DEFAULT 450,

    CONSTRAINT "MatchPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupAssignment" (
    "id" TEXT NOT NULL,
    "matchPeriodId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "generatedScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineupAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationSetting" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "beginnerLimit" INTEGER NOT NULL DEFAULT 2,
    "fairnessWeight" INTEGER NOT NULL DEFAULT 50,
    "aptitudeWeight" INTEGER NOT NULL DEFAULT 30,
    "continuityPenalty" INTEGER NOT NULL DEFAULT 20,
    "positionRepeatPenalty" INTEGER NOT NULL DEFAULT 10,
    "randomnessWeight" INTEGER NOT NULL DEFAULT 15,
    "presetType" TEXT NOT NULL DEFAULT 'FAIRNESS',

    CONSTRAINT "GenerationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationHistory" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "generationSeed" INTEGER NOT NULL,
    "generationType" TEXT NOT NULL,
    "resultSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_isActive_idx" ON "Player"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Player_jerseyNumber_key" ON "Player"("jerseyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Position_code_key" ON "Position"("code");

-- CreateIndex
CREATE INDEX "PlayerPosition_positionId_idx" ON "PlayerPosition"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPosition_playerId_positionId_key" ON "PlayerPosition"("playerId", "positionId");

-- CreateIndex
CREATE INDEX "MatchDay_matchDate_idx" ON "MatchDay"("matchDate");

-- CreateIndex
CREATE INDEX "MatchDayPlayer_playerId_idx" ON "MatchDayPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchDayPlayer_matchDayId_playerId_key" ON "MatchDayPlayer"("matchDayId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_matchDayId_matchNumber_key" ON "Match"("matchDayId", "matchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPeriod_matchId_periodOrder_key" ON "MatchPeriod"("matchId", "periodOrder");

-- CreateIndex
CREATE INDEX "LineupAssignment_playerId_idx" ON "LineupAssignment"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupAssignment_matchPeriodId_positionId_key" ON "LineupAssignment"("matchPeriodId", "positionId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupAssignment_matchPeriodId_playerId_key" ON "LineupAssignment"("matchPeriodId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationSetting_matchDayId_key" ON "GenerationSetting"("matchDayId");

-- CreateIndex
CREATE INDEX "GenerationHistory_matchDayId_idx" ON "GenerationHistory"("matchDayId");

-- AddForeignKey
ALTER TABLE "PlayerPosition" ADD CONSTRAINT "PlayerPosition_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPosition" ADD CONSTRAINT "PlayerPosition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDayPlayer" ADD CONSTRAINT "MatchDayPlayer_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDayPlayer" ADD CONSTRAINT "MatchDayPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPeriod" ADD CONSTRAINT "MatchPeriod_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupAssignment" ADD CONSTRAINT "LineupAssignment_matchPeriodId_fkey" FOREIGN KEY ("matchPeriodId") REFERENCES "MatchPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupAssignment" ADD CONSTRAINT "LineupAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupAssignment" ADD CONSTRAINT "LineupAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationSetting" ADD CONSTRAINT "GenerationSetting_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationHistory" ADD CONSTRAINT "GenerationHistory_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
