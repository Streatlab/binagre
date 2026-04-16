-- Ejecutar en Supabase SQL Editor ANTES de desplegar el código

ALTER TABLE ingredientes
ADD COLUMN IF NOT EXISTS nombre_base text,
ADD COLUMN IF NOT EXISTS abv text,
ADD COLUMN IF NOT EXISTS formato text,
ADD COLUMN IF NOT EXISTS uds numeric,
ADD COLUMN IF NOT EXISTS precio1 numeric,
ADD COLUMN IF NOT EXISTS precio2 numeric,
ADD COLUMN IF NOT EXISTS precio3 numeric,
ADD COLUMN IF NOT EXISTS precio_activo numeric,
ADD COLUMN IF NOT EXISTS ud_std text,
ADD COLUMN IF NOT EXISTS ud_min text,
ADD COLUMN IF NOT EXISTS merma_ef numeric,
ADD COLUMN IF NOT EXISTS coste_neto_std numeric,
ADD COLUMN IF NOT EXISTS ud_neto_std text,
ADD COLUMN IF NOT EXISTS coste_neto_min numeric,
ADD COLUMN IF NOT EXISTS ud_neto_min text;

ALTER TABLE eps
ADD COLUMN IF NOT EXISTS fecha date;

ALTER TABLE recetas_lineas
ADD COLUMN IF NOT EXISTS ingrediente_id uuid references ingredientes(id),
ADD COLUMN IF NOT EXISTS eps_id uuid references eps(id),
ADD COLUMN IF NOT EXISTS cantidad numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS unidad text,
ADD COLUMN IF NOT EXISTS eur_ud_neta numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS eur_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pct_total numeric DEFAULT 0;
