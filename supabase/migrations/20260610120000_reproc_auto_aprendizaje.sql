-- 20260610: reprocesado automático + autoaprendizaje propagado por NIF
-- Aplicada en Supabase eryauogxcpbgdryeimdq el 10/06/26.

-- A) fn_encolar_reproc_pendientes: crea un job en reproc_control para procesar facturas sin total
-- reproc_control es una tabla de jobs (no per-invoice), insertamos 1 fila de job.
CREATE OR REPLACE FUNCTION fn_encolar_reproc_pendientes()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
  v_job_id text;
BEGIN
  -- Contar facturas pendientes (total NULL o 0, con pdf, no conciliadas)
  SELECT COUNT(*) INTO v_count
  FROM facturas f
  WHERE (f.total IS NULL OR f.total = 0)
    AND f.pdf_drive_id IS NOT NULL
    AND (f.estado IS NULL OR f.estado NOT IN ('conciliada', 'asociada'));

  IF v_count = 0 THEN
    RETURN 0;
  END IF;

  -- Solo crear job si no hay uno activo ya
  IF NOT EXISTS (
    SELECT 1 FROM reproc_control WHERE activo = true
  ) THEN
    v_job_id := 'auto-' || to_char(now(), 'YYYYMMDD-HH24MI');
    INSERT INTO reproc_control (
      id, activo, solo_sin_leer, total_objetivo,
      procesadas, ok, errores, conciliadas,
      offset_actual, sesion_id, creado
    ) VALUES (
      v_job_id, true, true, v_count,
      0, 0, 0, 0,
      0, v_job_id, now()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN v_count;
END;
$$;

-- B) fn_propagar_aprendizaje_nif: propaga datos aprendidos a facturas del mismo NIF
CREATE OR REPLACE FUNCTION fn_propagar_aprendizaje_nif(
  p_nif text,
  p_total numeric,
  p_proveedor_nombre text DEFAULT NULL,
  p_categoria text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Upsert diccionario_nif_proveedor
  INSERT INTO diccionario_nif_proveedor (
    nif, proveedor_canonico, categoria_codigo,
    categoria_origen, veces_visto, actualizado_en
  )
  VALUES (
    p_nif, p_proveedor_nombre, p_categoria,
    'ocr_aprendizaje', 1, now()
  )
  ON CONFLICT (nif) DO UPDATE SET
    proveedor_canonico = COALESCE(EXCLUDED.proveedor_canonico, diccionario_nif_proveedor.proveedor_canonico),
    categoria_codigo   = COALESCE(EXCLUDED.categoria_codigo,   diccionario_nif_proveedor.categoria_codigo),
    veces_visto        = diccionario_nif_proveedor.veces_visto + 1,
    actualizado_en     = now();

  -- 2. Propagar categoria a facturas del mismo NIF que no la tengan
  IF p_categoria IS NOT NULL THEN
    UPDATE facturas
    SET categoria_factura = p_categoria,
        categoria_factura_origen = 'ocr_aprendizaje'
    WHERE nif_emisor = p_nif
      AND (categoria_factura IS NULL OR categoria_factura = '');
  END IF;
END;
$$;

-- C) Trigger: cuando una factura pasa de total=0/NULL a total>0, propagar aprendizaje
CREATE OR REPLACE FUNCTION fn_trg_reproc_auto_aprendizaje()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.total > 0
    AND (OLD.total IS NULL OR OLD.total = 0)
    AND NEW.nif_emisor IS NOT NULL
  THEN
    PERFORM fn_propagar_aprendizaje_nif(
      NEW.nif_emisor,
      NEW.total,
      NEW.proveedor_nombre,
      NEW.categoria_factura
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reproc_auto_aprendizaje ON facturas;
CREATE TRIGGER trg_reproc_auto_aprendizaje
  AFTER UPDATE ON facturas
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_reproc_auto_aprendizaje();

-- D) pg_cron si disponible
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('reproc-pendientes-hourly', '0 * * * *', 'SELECT fn_encolar_reproc_pendientes()');
  END IF;
END;
$$;
