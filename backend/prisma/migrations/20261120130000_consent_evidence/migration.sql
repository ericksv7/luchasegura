ALTER TABLE "Consent"
ADD COLUMN "textDigest" TEXT,
ADD COLUMN "textSnapshot" JSONB,
ADD COLUMN "acceptanceMode" TEXT;
