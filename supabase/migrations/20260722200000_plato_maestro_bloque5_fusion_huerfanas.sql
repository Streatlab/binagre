-- Plato maestro · Bloque 5: fusión de fichas_tecnicas huérfanas (eps_id IS NULL AND receta_id IS NULL)
-- ADR: .claude/plans/adr-plato-maestro.md (D5) — Tasks: .claude/plans/tasks-plato-maestro.md (BLOQUE 5)
-- Aplicado vía Supabase MCP apply_migration el 2026-07-22. Este archivo es el registro en repo.

-- T5.1: fn_fusionar_fichas_huerfanas — clona el patrón "candidato único o nada" de
-- fn_sugerir_receta_platos (sim1 >= 0.55 AND sim1-sim2 >= 0.08) sobre recetas ∪ eps que
-- todavía no tienen ficha. Enlaza receta_id/eps_id y, de forma no destructiva, rellena los
-- campos vacíos de la receta/EP con el dato de la ficha (foto_url, alergenos, elaboracion/
-- preparacion). NUNCA pisa un campo ya relleno en receta/EP ni toca foto_url/conservacion/gama
-- de la propia ficha.
--
-- DECISIÓN AUTÓNOMA (orden de operaciones): se enlaza la ficha PRIMERO y el merge de contenido
-- hacia recetas/eps se hace DESPUÉS. Los triggers del Bloque 4 (trg_ficha_desde_receta /
-- trg_ficha_desde_ep) disparan con "UPDATE OF nombre, raciones, alergenos, elaboracion/
-- preparacion, codigo" — si se mergea el contenido antes de enlazar, el trigger intenta crear
-- una ficha NUEVA para esa receta/EP (todavía no tiene ninguna) y choca con el índice único
-- parcial contra la ficha huérfana que se está a punto de enlazar. Enlazando primero, el
-- ON CONFLICT (receta_id)/(eps_id) del trigger encuentra la fila ya enlazada y la actualiza in
-- situ, sin colisión.
CREATE OR REPLACE FUNCTION public.fn_fusionar_fichas_huerfanas()
RETURNS TABLE(fusionadas integer, a_revision integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fusionadas int := 0;
  v_revision int := 0;
BEGIN
  DROP TABLE IF EXISTS _claros_fusion;
  CREATE TEMP TABLE _claros_fusion ON COMMIT DROP AS
  WITH candidatos AS (
    SELECT
      f.id AS ficha_id,
      top1.cand_id   AS candidato_id,
      top1.cand_tipo AS candidato_tipo,
      top1.sim       AS sim1,
      top2.sim       AS sim2
    FROM fichas_tecnicas f
    CROSS JOIN LATERAL (
      SELECT c.id AS cand_id, c.tipo AS cand_tipo,
             similarity(norm_plato(f.nombre), norm_plato(c.nombre)) AS sim
      FROM (
        SELECT r.id, r.nombre, 'receta'::text AS tipo FROM recetas r
        WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas ft WHERE ft.receta_id = r.id)
        UNION ALL
        SELECT e.id, e.nombre, 'ep'::text AS tipo FROM eps e
        WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas ft WHERE ft.eps_id = e.id)
      ) c
      ORDER BY similarity(norm_plato(f.nombre), norm_plato(c.nombre)) DESC
      LIMIT 1
    ) top1
    LEFT JOIN LATERAL (
      SELECT similarity(norm_plato(f.nombre), norm_plato(c.nombre)) AS sim
      FROM (
        SELECT r.id, r.nombre, 'receta'::text AS tipo FROM recetas r
        WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas ft WHERE ft.receta_id = r.id)
        UNION ALL
        SELECT e.id, e.nombre, 'ep'::text AS tipo FROM eps e
        WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas ft WHERE ft.eps_id = e.id)
      ) c
      ORDER BY similarity(norm_plato(f.nombre), norm_plato(c.nombre)) DESC
      OFFSET 1 LIMIT 1
    ) top2 ON true
    WHERE f.eps_id IS NULL AND f.receta_id IS NULL
  ),
  claros AS (
    SELECT *,
           row_number() OVER (PARTITION BY candidato_id ORDER BY sim1 DESC) AS rn
    FROM candidatos
    WHERE candidato_id IS NOT NULL
      AND sim1 >= 0.55
      AND (sim1 - COALESCE(sim2, 0)) >= 0.08
  )
  SELECT ficha_id, candidato_id, candidato_tipo, sim1, sim2
  FROM claros
  WHERE rn = 1;

  -- 1) Vincular PRIMERO la ficha huérfana a su candidato único.
  UPDATE fichas_tecnicas f
  SET receta_id = CASE WHEN c.candidato_tipo = 'receta' THEN c.candidato_id ELSE f.receta_id END,
      eps_id    = CASE WHEN c.candidato_tipo = 'ep' THEN c.candidato_id ELSE f.eps_id END
  FROM _claros_fusion c
  WHERE f.id = c.ficha_id;

  GET DIAGNOSTICS v_fusionadas = ROW_COUNT;

  -- 2) Merge no destructivo hacia receta: solo rellena campos vacíos del destino.
  UPDATE recetas r
  SET foto_url = COALESCE(NULLIF(r.foto_url, ''), f.foto_url),
      alergenos = CASE WHEN (r.alergenos IS NULL OR cardinality(r.alergenos) = 0)
                         AND f.alergenos IS NOT NULL AND jsonb_array_length(f.alergenos) > 0
                       THEN ARRAY(SELECT jsonb_array_elements_text(f.alergenos))
                       ELSE r.alergenos END,
      elaboracion = CASE WHEN (r.elaboracion IS NULL OR btrim(r.elaboracion) = '')
                           AND f.pasos IS NOT NULL AND jsonb_array_length(f.pasos) > 0
                         THEN (SELECT string_agg(x, E'\n' ORDER BY ord)
                               FROM jsonb_array_elements_text(f.pasos) WITH ORDINALITY AS t(x, ord))
                         ELSE r.elaboracion END
  FROM _claros_fusion c
  JOIN fichas_tecnicas f ON f.id = c.ficha_id
  WHERE c.candidato_tipo = 'receta' AND r.id = c.candidato_id;

  -- 3) Merge no destructivo hacia EP (eps no tiene columnas foto_url ni conservacion).
  UPDATE eps e
  SET alergenos = CASE WHEN (e.alergenos IS NULL OR jsonb_array_length(e.alergenos) = 0)
                         AND f.alergenos IS NOT NULL AND jsonb_array_length(f.alergenos) > 0
                       THEN f.alergenos ELSE e.alergenos END,
      preparacion = CASE WHEN (e.preparacion IS NULL OR btrim(e.preparacion) = '')
                           AND f.pasos IS NOT NULL AND jsonb_array_length(f.pasos) > 0
                         THEN (SELECT string_agg(x, E'\n' ORDER BY ord)
                               FROM jsonb_array_elements_text(f.pasos) WITH ORDINALITY AS t(x, ord))
                         ELSE e.preparacion END
  FROM _claros_fusion c
  JOIN fichas_tecnicas f ON f.id = c.ficha_id
  WHERE c.candidato_tipo = 'ep' AND e.id = c.candidato_id;

  SELECT count(*) INTO v_revision
  FROM fichas_tecnicas
  WHERE eps_id IS NULL AND receta_id IS NULL;

  RETURN QUERY SELECT v_fusionadas, v_revision;
END;
$$;

-- T5.2: ejecución en firme (registrado aquí para trazabilidad; ya aplicado vía MCP).
-- SELECT * FROM fn_fusionar_fichas_huerfanas();  -- resultado real: fusionadas=75, a_revision=5

-- T5.3: backfill — para recetas/EPs que tras la fusión siguen sin ficha, un UPDATE no-op sobre
-- una columna vigilada por el trigger (nombre) fuerza la creación de su fichas_tecnicas vía
-- fn_ficha_desde_receta / fn_ficha_desde_ep (INSERT; no hay fila previa, no aplica ON CONFLICT).
UPDATE recetas r SET nombre = nombre
WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas f WHERE f.receta_id = r.id);

UPDATE eps e SET nombre = nombre
WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas f WHERE f.eps_id = e.id);

-- Resultado real verificado: 75 fusionadas automáticamente, 5 en cola de revisión manual
-- (fichas_tecnicas WHERE eps_id IS NULL AND receta_id IS NULL — la consume el Bloque 6), 13
-- fichas nuevas creadas por backfill. Total fichas_tecnicas: 83 -> 96. 34 recetas y 57 eps con
-- ficha al 100%.
