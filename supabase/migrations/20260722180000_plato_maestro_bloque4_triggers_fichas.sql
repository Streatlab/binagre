-- Plato maestro · Bloque 4: Fuente única Escandallo -> fichas_tecnicas (trigger BD)
-- ADR: .claude/plans/adr-plato-maestro.md (D4) — Tasks: .claude/plans/tasks-plato-maestro.md (BLOQUE 4)
-- Aplicado vía Supabase MCP apply_migration el 2026-07-22. Este archivo es el registro en repo.

-- T4.1: fn_split_pasos — parte elaboracion/preparacion en pasos[] por lineas, quita numeracion, determinista
CREATE OR REPLACE FUNCTION fn_split_pasos(txt text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (SELECT jsonb_agg(paso ORDER BY ord)
       FROM (
         SELECT ord,
                btrim(regexp_replace(linea, '^\s*(\d+[\.\):]|[-•])\s*', '')) AS paso
           FROM unnest(regexp_split_to_array(coalesce(txt, ''), E'\n')) WITH ORDINALITY AS u(linea, ord)
          WHERE btrim(linea) <> ''
       ) s
    ),
    '[]'::jsonb
  );
$$;

-- T4.2: indices unicos parciales para soportar upsert por receta_id / eps_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_fichas_receta_id ON fichas_tecnicas (receta_id) WHERE receta_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fichas_eps_id ON fichas_tecnicas (eps_id) WHERE eps_id IS NOT NULL;

-- T4.3: fn_ficha_desde_receta — upsert ficha desde receta. Anti-pisado: nunca toca foto_url/conservacion/gama/estado/edicion.
CREATE OR REPLACE FUNCTION fn_ficha_desde_receta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO fichas_tecnicas (tipo, codigo, nombre, raciones, alergenos, pasos, receta_id)
  VALUES ('receta', NEW.codigo, NEW.nombre, NEW.raciones, to_jsonb(NEW.alergenos), fn_split_pasos(NEW.elaboracion), NEW.id)
  ON CONFLICT (receta_id) WHERE receta_id IS NOT NULL
  DO UPDATE SET
    codigo    = EXCLUDED.codigo,
    nombre    = EXCLUDED.nombre,
    raciones  = EXCLUDED.raciones,
    alergenos = EXCLUDED.alergenos,
    pasos     = EXCLUDED.pasos;
  RETURN NEW;
END;
$$;

-- T4.4: fn_ficha_desde_ep — analoga para eps
CREATE OR REPLACE FUNCTION fn_ficha_desde_ep()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO fichas_tecnicas (tipo, codigo, nombre, raciones, alergenos, pasos, eps_id)
  VALUES ('ep', NEW.codigo, NEW.nombre, NEW.raciones, COALESCE(NEW.alergenos, '[]'::jsonb), fn_split_pasos(NEW.preparacion), NEW.id)
  ON CONFLICT (eps_id) WHERE eps_id IS NOT NULL
  DO UPDATE SET
    codigo    = EXCLUDED.codigo,
    nombre    = EXCLUDED.nombre,
    raciones  = EXCLUDED.raciones,
    alergenos = EXCLUDED.alergenos,
    pasos     = EXCLUDED.pasos;
  RETURN NEW;
END;
$$;

-- T4.5: triggers. Solo disparan cuando cambian columnas relevantes (evita reescrituras
-- innecesarias en updates de precio/coste que no tocan nombre/raciones/alergenos/elaboracion/codigo).
DROP TRIGGER IF EXISTS trg_ficha_desde_receta ON recetas;
CREATE TRIGGER trg_ficha_desde_receta
  AFTER INSERT OR UPDATE OF nombre, raciones, alergenos, elaboracion, codigo ON recetas
  FOR EACH ROW EXECUTE FUNCTION fn_ficha_desde_receta();

DROP TRIGGER IF EXISTS trg_ficha_desde_ep ON eps;
CREATE TRIGGER trg_ficha_desde_ep
  AFTER INSERT OR UPDATE OF nombre, raciones, alergenos, preparacion, codigo ON eps
  FOR EACH ROW EXECUTE FUNCTION fn_ficha_desde_ep();

-- NO se dispara backfill masivo aqui (se hace en Bloque 5 tras fusionar huerfanas).
