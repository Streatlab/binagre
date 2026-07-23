-- Plato maestro · Pieza 3: cola de revisión manual de fichas huérfanas (Bloque 5/6).
-- UI: src/pages/cocina/Recetario.tsx (Libro de Recetas), componente ColaRevisionFichas.
-- Objetivo: por cada ficha en fichas_tecnicas WHERE eps_id IS NULL AND receta_id IS NULL AND
-- estado='vigente', ofrecer candidatos (receta/EP) con similarity score y comparación de campos
-- (foto, elaboración, alérgenos, conservación), y 3 acciones humanas: enlazar, crear nueva,
-- descartar. Sin auto-resolución: el candidato único o no, siempre requiere clic de Rubén.

-- T3.1: fn_candidatos_ficha_huerfana — candidatos de recetas ∪ eps para una ficha huérfana,
-- con similarity() + norm_plato() (mismo patrón que fn_fusionar_fichas_huerfanas del Bloque 5),
-- y para cada candidato, qué aporta su ficha ya vinculada (si existe): foto, nº pasos, nº
-- alérgenos, nº métodos de conservación. Solo lectura, sin efectos.
CREATE OR REPLACE FUNCTION public.fn_candidatos_ficha_huerfana(p_orphan_id uuid, p_limit int DEFAULT 5)
RETURNS TABLE(
  target_tipo text, target_id uuid, target_nombre text, similitud numeric,
  ficha_id uuid, tiene_ficha boolean,
  foto_url text, elaboracion_len int, alergenos_n int, conservacion_n int
)
LANGUAGE sql STABLE AS $$
  WITH orphan AS (SELECT nombre FROM fichas_tecnicas WHERE id = p_orphan_id),
  cand AS (
    SELECT 'receta'::text AS tipo, r.id, r.nombre,
           similarity(norm_plato(o.nombre), norm_plato(r.nombre)) AS sim
    FROM recetas r, orphan o
    UNION ALL
    SELECT 'ep'::text AS tipo, e.id, e.nombre,
           similarity(norm_plato(o.nombre), norm_plato(e.nombre)) AS sim
    FROM eps e, orphan o
  )
  SELECT c.tipo, c.id, c.nombre, round(c.sim::numeric, 3) AS similitud,
         f.id AS ficha_id, (f.id IS NOT NULL) AS tiene_ficha,
         f.foto_url,
         coalesce(jsonb_array_length(f.pasos), 0) AS elaboracion_len,
         coalesce(jsonb_array_length(f.alergenos), 0) AS alergenos_n,
         coalesce(jsonb_array_length(f.conservacion), 0) AS conservacion_n
  FROM cand c
  LEFT JOIN fichas_tecnicas f
    ON (c.tipo = 'receta' AND f.receta_id = c.id) OR (c.tipo = 'ep' AND f.eps_id = c.id)
  WHERE c.sim > 0.15
  ORDER BY c.sim DESC, c.nombre
  LIMIT p_limit;
$$;

-- T3.2: fn_enlazar_ficha_huerfana — enlaza una ficha huérfana al candidato ELEGIDO por Rubén
-- (nunca auto-elegido). Dos casos:
--  a) El candidato (receta/EP) ya tiene su propia ficha vinculada (caso normal hoy: recetas_sin_
--     ficha=0 y eps_sin_ficha=0 tras el Bloque 5) → se fusiona de forma no destructiva el
--     contenido de la huérfana DENTRO de esa ficha ya vinculada (mismo criterio anti-pisado que
--     fn_fusionar_fichas_huerfanas del Bloque 5: solo se rellenan campos vacíos, nunca se pisa
--     un campo con dato) y se borra la huérfana (fusión = 1 sola ficha viva por receta/EP).
--  b) El candidato no tiene ficha propia todavía (hueco futuro) → se enlaza la huérfana
--     directamente (UPDATE receta_id/eps_id), sin fusión ni borrado.
CREATE OR REPLACE FUNCTION public.fn_enlazar_ficha_huerfana(p_orphan_id uuid, p_target_tipo text, p_target_id uuid)
RETURNS TABLE(ok boolean, motivo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existe boolean;
  v_sibling_id uuid;
BEGIN
  IF p_target_tipo NOT IN ('receta', 'ep') THEN
    ok := false; motivo := 'Tipo de candidato inválido.'; RETURN NEXT; RETURN;
  END IF;

  SELECT true INTO v_existe FROM fichas_tecnicas
   WHERE id = p_orphan_id AND eps_id IS NULL AND receta_id IS NULL AND estado = 'vigente';
  IF v_existe IS NOT TRUE THEN
    ok := false; motivo := 'Ficha no encontrada, ya no está huérfana o fue descartada.'; RETURN NEXT; RETURN;
  END IF;

  IF p_target_tipo = 'receta' THEN
    SELECT id INTO v_sibling_id FROM fichas_tecnicas WHERE receta_id = p_target_id;
  ELSE
    SELECT id INTO v_sibling_id FROM fichas_tecnicas WHERE eps_id = p_target_id;
  END IF;

  IF v_sibling_id IS NULL THEN
    -- Caso (b): el candidato no tiene ficha propia. Enlace directo, sin fusión.
    UPDATE fichas_tecnicas
       SET receta_id = CASE WHEN p_target_tipo = 'receta' THEN p_target_id ELSE receta_id END,
           eps_id    = CASE WHEN p_target_tipo = 'ep'     THEN p_target_id ELSE eps_id END
     WHERE id = p_orphan_id;
    ok := true; motivo := 'Ficha vinculada directamente (el destino no tenía ficha previa).';
    RETURN NEXT; RETURN;
  END IF;

  IF v_sibling_id = p_orphan_id THEN
    ok := false; motivo := 'El candidato elegido es la propia ficha huérfana.'; RETURN NEXT; RETURN;
  END IF;

  -- Caso (a): fusión no destructiva sobre la ficha ya vinculada (anti-pisado, patrón Bloque 5).
  UPDATE fichas_tecnicas AS dst
     SET foto_url     = COALESCE(NULLIF(dst.foto_url, ''), src.foto_url),
         conservacion = CASE WHEN dst.conservacion IS NULL OR jsonb_array_length(dst.conservacion) = 0
                              THEN src.conservacion ELSE dst.conservacion END,
         alergenos    = CASE WHEN dst.alergenos IS NULL OR jsonb_array_length(dst.alergenos) = 0
                              THEN src.alergenos ELSE dst.alergenos END,
         gama         = COALESCE(dst.gama, src.gama),
         pasos        = CASE WHEN dst.pasos IS NULL OR jsonb_array_length(dst.pasos) = 0
                              THEN src.pasos ELSE dst.pasos END
    FROM fichas_tecnicas AS src
   WHERE dst.id = v_sibling_id AND src.id = p_orphan_id;

  -- Propaga también hacia la receta/EP destino (mismo criterio anti-pisado que Bloque 5),
  -- para que Escandallo (que lee recetas.elaboracion / eps.preparacion, no fichas_tecnicas.pasos)
  -- también reciba el dato si le faltaba.
  IF p_target_tipo = 'receta' THEN
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
      FROM fichas_tecnicas f
     WHERE f.id = p_orphan_id AND r.id = p_target_id;
  ELSE
    UPDATE eps e
       SET alergenos = CASE WHEN (e.alergenos IS NULL OR jsonb_array_length(e.alergenos) = 0)
                              AND f.alergenos IS NOT NULL AND jsonb_array_length(f.alergenos) > 0
                            THEN f.alergenos ELSE e.alergenos END,
           preparacion = CASE WHEN (e.preparacion IS NULL OR btrim(e.preparacion) = '')
                                AND f.pasos IS NOT NULL AND jsonb_array_length(f.pasos) > 0
                              THEN (SELECT string_agg(x, E'\n' ORDER BY ord)
                                    FROM jsonb_array_elements_text(f.pasos) WITH ORDINALITY AS t(x, ord))
                              ELSE e.preparacion END
      FROM fichas_tecnicas f
     WHERE f.id = p_orphan_id AND e.id = p_target_id;
  END IF;

  DELETE FROM fichas_tecnicas WHERE id = p_orphan_id;

  ok := true; motivo := 'Fusionada en la ficha ya vinculada del candidato elegido.';
  RETURN NEXT;
END;
$$;

-- T3.3: "descartar" no necesita función — reutiliza fichas_tecnicas.estado (ya usado como
-- 'vigente' en todo el front). Un update directo a estado='descartada' saca la ficha de la
-- cola (que filtra estado='vigente') sin borrar el registro ni volver a ofrecerlo.
