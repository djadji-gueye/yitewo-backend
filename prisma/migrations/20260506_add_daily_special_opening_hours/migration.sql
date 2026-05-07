-- Migration: ajout isDailySpecial sur PartnerProduct et openingHours sur Partner

-- Plat du jour
ALTER TABLE "PartnerProduct" ADD COLUMN IF NOT EXISTS "isDailySpecial" BOOLEAN NOT NULL DEFAULT false;

-- Horaires d'ouverture (JSON stocké en texte)
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "openingHours" JSONB;
