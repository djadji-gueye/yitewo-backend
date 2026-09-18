ALTER TYPE "BusinessListingSource" ADD VALUE IF NOT EXISTS 'OPENSTREETMAP';
ALTER TABLE "BusinessListing" ADD COLUMN IF NOT EXISTS "externalSourceId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessListing_externalSourceId_key" ON "BusinessListing"("externalSourceId");
