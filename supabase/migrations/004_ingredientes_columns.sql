-- PASO 1: Anadir columnas faltantes a ingredientes
ALTER TABLE ingredientes
  ADD COLUMN IF NOT EXISTS nombre_base text,
  ADD COLUMN IF NOT EXISTS abv text,
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS formato text,
  ADD COLUMN IF NOT EXISTS uds numeric,
  ADD COLUMN IF NOT EXISTS ud_std text,
  ADD COLUMN IF NOT EXISTS ud_min text,
  ADD COLUMN IF NOT EXISTS precio1 numeric,
  ADD COLUMN IF NOT EXISTS precio2 numeric,
  ADD COLUMN IF NOT EXISTS precio3 numeric,
  ADD COLUMN IF NOT EXISTS precio_activo numeric,
  ADD COLUMN IF NOT EXISTS eur_std numeric,
  ADD COLUMN IF NOT EXISTS eur_min numeric,
  ADD COLUMN IF NOT EXISTS tipo_merma text,
  ADD COLUMN IF NOT EXISTS merma_ef numeric,
  ADD COLUMN IF NOT EXISTS coste_neto_std numeric,
  ADD COLUMN IF NOT EXISTS ud_neto_std text,
  ADD COLUMN IF NOT EXISTS coste_neto_min numeric,
  ADD COLUMN IF NOT EXISTS ud_neto_min text;

-- Asegurar que eps tiene tamano_rac
ALTER TABLE eps
  ADD COLUMN IF NOT EXISTS tamano_rac numeric;
