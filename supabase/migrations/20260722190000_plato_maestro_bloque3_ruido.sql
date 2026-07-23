-- Bloque 3 · Plato maestro — marcado de ruido de plataforma (reversible)
-- Rama trabajo. Supabase eryauogxcpbgdryeimdq. Aplicada vía apply_migration MCP;
-- este archivo es el registro en repo, no se re-ejecuta automáticamente.

ALTER TABLE mapeo_plato_receta
  ADD COLUMN IF NOT EXISTS tipo_linea text NOT NULL DEFAULT 'plato';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mapeo_plato_receta_tipo_linea_check'
  ) THEN
    ALTER TABLE mapeo_plato_receta
      ADD CONSTRAINT mapeo_plato_receta_tipo_linea_check
      CHECK (tipo_linea IN ('plato','ruido'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mapeo_plato_receta_tipo_linea
  ON mapeo_plato_receta (tipo_linea);

-- Marcado de ruido (reversible, nunca DELETE). Reglas ADR-D3 / tasks T3.2.
-- No se toca ninguna fila con receta_id ya enlazado (43 enlaces manuales/sugeridos protegidos).
UPDATE mapeo_plato_receta
SET tipo_linea = 'ruido',
    updated_at = now()
WHERE receta_id IS NULL
  AND (
    plato_muestra ~ '^\s*[0-9]+([.,][0-9]+)?\s*$'                 -- solo dígitos/decimales
    OR plato_muestra ILIKE 'Descuento%'
    OR plato_muestra ILIKE 'Gastos de envío%'
    OR plato_muestra ~ '^(SIN |CON |PREFIERO |TAMAÑO )'           -- modificadores en mayúsculas
    OR plato_muestra ILIKE '%media ración%'
    OR plato_muestra ILIKE '%ración entera%'
    OR euros = 0                                                  -- salsas sueltas / extras a coste 0
  );

-- Reencaminado del front: v_mapeo_resuelto (Bloque 2) expone tipo_linea para que CostePlato.tsx
-- pueda excluir el ruido de la cola y de los KPIs. Postgres exige que las columnas nuevas de un
-- CREATE OR REPLACE VIEW vayan al final (no se puede reordenar/renombrar columnas existentes).
CREATE OR REPLACE VIEW v_mapeo_resuelto AS
SELECT mpr.id,
    mpr.plato_norm,
    mpr.plato_muestra,
    mpr.receta_id AS receta_id_manual,
    mpr.origen AS origen_manual,
    mpr.confianza AS confianza_manual,
    mpr.euros,
    mpr.unidades,
    pa.id AS alias_id,
    pa.maestro_id,
    pm.receta_id AS receta_id_maestro,
    COALESCE(mpr.receta_id, pm.receta_id) AS receta_efectiva,
    mpr.updated_at,
    mpr.tipo_linea
   FROM mapeo_plato_receta mpr
     LEFT JOIN platos_alias pa ON pa.alias_norm = mpr.plato_norm
     LEFT JOIN platos_maestros pm ON pm.id = pa.maestro_id;

-- Revertir (si hiciera falta): UPDATE mapeo_plato_receta SET tipo_linea='plato' WHERE tipo_linea='ruido';
