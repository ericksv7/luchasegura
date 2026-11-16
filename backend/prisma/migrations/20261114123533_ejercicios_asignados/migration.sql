-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "zone" TEXT;

-- CreateTable
CREATE TABLE "ExerciseAssignment" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "assignedById" TEXT,
    "dosage" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseAssignment_athleteId_idx" ON "ExerciseAssignment"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseAssignment_athleteId_exerciseId_key" ON "ExerciseAssignment"("athleteId", "exerciseId");

-- CreateIndex
CREATE INDEX "Exercise_component_idx" ON "Exercise"("component");

-- AddForeignKey
ALTER TABLE "ExerciseAssignment" ADD CONSTRAINT "ExerciseAssignment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAssignment" ADD CONSTRAINT "ExerciseAssignment_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAssignment" ADD CONSTRAINT "ExerciseAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
