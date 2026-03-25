-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('PENDING','CONFIRMED','PREPARING','DELIVERING','DELIVERED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING','ASSIGNED','IN_PROGRESS','DONE','CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OpportunityCategory" AS ENUM ('IMMOBILIER','EMPLOI','SERVICE','COMMERCE','FORMATION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('NEW_ORDER','ORDER_STATUS_CHANGED','NEW_SERVICE_REQUEST','NEW_OPPORTUNITY_INTEREST','NEW_OPPORTUNITY_SUBMISSION','NEW_PARTNER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Orders
CREATE TABLE IF NOT EXISTS "Order" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "status"        "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "city"          TEXT NOT NULL,
  "quarter"       TEXT NOT NULL,
  "deliveryFee"   INTEGER NOT NULL DEFAULT 500,
  "totalPrice"    INTEGER NOT NULL,
  "customerName"  TEXT,
  "customerPhone" TEXT,
  "note"          TEXT,
  "partnerId"     TEXT REFERENCES "Partner"("id"),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId"   TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "Product"("id"),
  "quantity"  INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL
);

-- ServiceRequest
CREATE TABLE IF NOT EXISTS "ServiceRequest" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "service"       TEXT NOT NULL,
  "city"          TEXT NOT NULL,
  "quarter"       TEXT NOT NULL,
  "description"   TEXT,
  "customerName"  TEXT,
  "customerPhone" TEXT,
  "status"        "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Opportunity (drop old, create new)
DROP TABLE IF EXISTS "Opportunity" CASCADE;
CREATE TABLE "Opportunity" (
  "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title"       TEXT NOT NULL,
  "slug"        TEXT NOT NULL UNIQUE,
  "category"    "OpportunityCategory" NOT NULL DEFAULT 'IMMOBILIER',
  "location"    TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price"       TEXT,
  "badge"       TEXT,
  "details"     TEXT[] NOT NULL DEFAULT '{}',
  "imageUrl"    TEXT,
  "contact"     TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OpportunityInterest" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "opportunityId" TEXT NOT NULL REFERENCES "Opportunity"("id") ON DELETE CASCADE,
  "name"          TEXT NOT NULL,
  "phone"         TEXT NOT NULL,
  "message"       TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OpportunitySubmission" (
  "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title"       TEXT NOT NULL,
  "category"    "OpportunityCategory" NOT NULL,
  "location"    TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price"       TEXT,
  "contact"     TEXT NOT NULL,
  "status"      "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partner updatedAt column rename
ALTER TABLE "Partner" RENAME COLUMN "updateAt" TO "updatedAt" IF EXISTS;

-- Notifications
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "type"      "NotificationType" NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "entityId"  TEXT,
  "isRead"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
