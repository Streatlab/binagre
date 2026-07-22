-- PROMPT CORRECCIÓN · PAPELEO · FIX-v1 (21-jul-2026)
-- FIX 1 (bloqueante): "dormido" = huérfano de verdad. Excluye del recuento y
-- de la reconstrucción cualquier fila de ocr_manifiesto cuyo storage_path ya
-- esté en la cola de una sesión de subida VIVA (en_espera/procesando) — así
-- el motor nunca duplica el trabajo de una subida que Rubén tiene en curso.
-- Margen de 30 min tras el último cambio para dar tiempo a que la subida
-- arranque su sesión antes de considerar el archivo dormido.

create or replace view v_ocr_dormidos_reales as
select m.*
from ocr_manifiesto m
where m.estado = 'en_storage'
  and not exists (
    select 1 from ocr_sessions s
    where s.estado_cola in ('en_espera','procesando')
      and s.archivos_pendientes @> jsonb_build_array(jsonb_build_object('storagePath', m.storage_path))
  )
  and m.actualizado < now() - interval '30 minutes';

-- FIX 3: confirma que el trigger existente (Fase 1) ya excluye los grupos
-- internos de despertar_dormidos (prefijo 'despertar_') al encolar conciliar
-- tras completarse un grupo de ocr_sessions. No se toca ni se duplica: solo
-- se deja constancia aquí de la comprobación (ver commit).
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(oid) into v_def
  from pg_proc where proname = 'fn_papeleo_conciliar_post_subida';
  if v_def is null then
    raise exception 'fn_papeleo_conciliar_post_subida no existe (Fase 1 no aplicada)';
  end if;
  if v_def not like '%despertar_%' then
    raise exception 'fn_papeleo_conciliar_post_subida ya no excluye los grupos despertar_ — revisar antes de continuar';
  end if;
  raise notice 'OK: fn_papeleo_conciliar_post_subida ya excluye grupo_id like despertar_%%';
end $$;
