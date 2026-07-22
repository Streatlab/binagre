-- Fase 3 · PROMPT MAESTRO PAPELEO DEFINITIVO v1 (20-jul-2026)
-- Amplía fn_resolver_aviso para que el tipo 'lectura_fallida' tenga su propia
-- rama de resolución (botón "Reintentar lectura" → pendiente_releer_ocr=true).
-- El resto de tipos nuevos (destino_pendiente, extracto_recibido,
-- doc_equipo_recibido) ya quedan resueltos por el housekeeping genérico
-- existente (marca resuelto + aprendizaje por NIF si lo hay).

alter table facturas add column if not exists pendiente_releer_ocr boolean not null default false;

create or replace function public.fn_resolver_aviso(p_aviso uuid, p_decision jsonb)
 returns jsonb
 language plpgsql
as $function$
declare
  v_a avisos_papeleo;
  v_nif text;
  v_cat text := p_decision->>'categoria';
  v_tit uuid := nullif(p_decision->>'titular_id','')::uuid;
  v_dup boolean := (p_decision->>'es_duplicado')::boolean;
  v_reintentar boolean := (p_decision->>'reintentar')::boolean;
  v_afectadas int := 0;
begin
  SELECT * INTO v_a FROM avisos_papeleo WHERE id = p_aviso;
  IF v_a IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'aviso no encontrado'); END IF;
  v_nif := v_a.payload->>'nif';

  -- Aprender en el diccionario (fuente única de verdad)
  IF v_nif IS NOT NULL AND (v_cat IS NOT NULL OR v_tit IS NOT NULL) THEN
    INSERT INTO diccionario_nif_proveedor (nif, proveedor_canonico, categoria_codigo, titular_id, categoria_origen)
    VALUES (v_nif, coalesce(v_a.payload->>'proveedor', v_nif), v_cat, v_tit, 'aviso_resuelto')
    ON CONFLICT (nif) DO UPDATE SET
      categoria_codigo = coalesce(EXCLUDED.categoria_codigo, diccionario_nif_proveedor.categoria_codigo),
      titular_id = coalesce(EXCLUDED.titular_id, diccionario_nif_proveedor.titular_id),
      actualizado_en = now();
  END IF;

  -- Propagar a todas las facturas existentes de ese NIF
  IF v_nif IS NOT NULL AND v_cat IS NOT NULL THEN
    UPDATE facturas SET categoria_factura = v_cat, categoria_factura_origen = 'aviso_resuelto', updated_at = now()
    WHERE nif_emisor = v_nif AND (categoria_factura IS NULL OR categoria_factura = '');
    GET DIAGNOSTICS v_afectadas = ROW_COUNT;
  END IF;
  IF v_nif IS NOT NULL AND v_tit IS NOT NULL THEN
    UPDATE facturas SET titular_id = v_tit,
      estado = CASE WHEN estado = 'pendiente_titular_manual' THEN 'pendiente_revision' ELSE estado END,
      titular_revisado = true, updated_at = now()
    WHERE nif_emisor = v_nif AND (titular_id IS NULL OR estado = 'pendiente_titular_manual');
  END IF;

  -- Duplicado confirmado o descartado
  IF v_a.tipo = 'posible_duplicado' AND v_a.factura_id IS NOT NULL THEN
    IF v_dup IS TRUE THEN
      UPDATE facturas SET estado='no_conciliable', no_conciliable=true,
        motivo_no_conciliable='Duplicado confirmado por Rubén', duplicado_revisado=true, updated_at=now()
      WHERE id = v_a.factura_id;
    ELSE
      UPDATE facturas SET posible_duplicado=false, duplicado_revisado=true, updated_at=now()
      WHERE id = v_a.factura_id;
    END IF;
  END IF;

  -- Lectura fallida: "Reintentar lectura" marca la factura para releer_ocr.
  IF v_a.tipo = 'lectura_fallida' AND v_reintentar IS TRUE AND v_a.factura_id IS NOT NULL THEN
    UPDATE facturas SET pendiente_releer_ocr = true, updated_at = now() WHERE id = v_a.factura_id;
  END IF;

  UPDATE avisos_papeleo SET estado='resuelto', resuelto_at=now(), resolucion=p_decision WHERE id = p_aviso;
  -- Cerrar avisos hermanos del mismo NIF y tipo (ya aprendido)
  UPDATE avisos_papeleo SET estado='resuelto', resuelto_at=now(),
    resolucion = p_decision || '{"auto":"aprendido de otro aviso"}'::jsonb
  WHERE estado='abierto' AND tipo=v_a.tipo AND payload->>'nif' = v_nif AND v_nif IS NOT NULL;

  RETURN jsonb_build_object('ok', true, 'facturas_actualizadas', v_afectadas);
END;
$function$;
