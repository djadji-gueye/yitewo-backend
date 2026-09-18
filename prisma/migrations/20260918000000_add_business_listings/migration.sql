CREATE TYPE "BusinessListingSource" AS ENUM ('GOOGLE', 'MANUAL', 'ADMIN', 'IMPORT');
CREATE TYPE "BusinessListingStatus" AS ENUM ('DRAFT', 'PENDING', 'VISIBLE', 'VERIFIED', 'REJECTED');

CREATE TABLE "BusinessListing" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT NOT NULL,
    "zone" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT,
    "imageUrl" TEXT,
    "source" "BusinessListingSource" NOT NULL DEFAULT 'MANUAL',
    "status" "BusinessListingStatus" NOT NULL DEFAULT 'PENDING',
    "isClaimed" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT false,
    "claimRequestedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessListing_slug_key"
    ON "BusinessListing"("slug");
