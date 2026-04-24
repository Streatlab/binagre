-- Añadir parámetros fiscales y umbrales de caja a pe_parametros
ALTER TABLE pe_parametros
  ADD COLUMN IF NOT EXISTS tasa_fiscal_pct NUMERIC DEFAULT 25,
  ADD COLUMN IF NOT EXISTS objetivo_beneficio_mensual NUMERIC DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS caja_minima_verde NUMERIC DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS caja_minima_ambar NUMERIC DEFAULT 500,
  ADD COLUMN IF NOT EXISTS iva_pct NUMERIC DEFAULT 10;

UPDATE pe_parametros SET tasa_fiscal_pct = 25 WHERE tasa_fiscal_pct IS NULL;
UPDATE pe_parametros SET objetivo_beneficio_mensual = 3000 WHERE objetivo_beneficio_mensual IS NULL;
UPDATE pe_parametros SET caja_minima_verde = 3000 WHERE caja_minima_verde IS NULL;
UPDATE pe_parametros SET caja_minima_ambar = 500 WHERE caja_minima_ambar IS NULL;
UPDATE pe_parametros SET iva_pct = 10 WHERE iva_pct IS NULL;
