-- AlterTable: add serviceCategories and profileImageUrl to Partner
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "serviceCategories" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;
