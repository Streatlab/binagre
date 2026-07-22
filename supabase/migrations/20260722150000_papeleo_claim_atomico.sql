-- Mejora 21-jul: claim atómico de tareas (evita doble ejecución).
-- agendaTick hacía SELECT + UPDATE en dos pasos: el tick inmediato del botón y
-- el del cron podían coincidir y agarrar la misma tarea -> doble proceso. Este
-- RPC toma la tarea elegible más antigua con FOR UPDATE SKIP LOCKED y la marca
-- en_curso en una sola transacción, así dos invocaciones concurrentes nunca
-- cogen la misma fila (la segunda salta a la siguiente o no coge ninguna).

create or replace function fn_papeleo_claim_tarea()
returns papeleo_tareas
language plpgsql
as $fn$
declare
  v_tarea papeleo_tareas;
begin
  select * into v_tarea
  from papeleo_tareas
  where (estado = 'programada' and programada_para <= now())
     or (estado = 'en_curso' and ultimo_latido < now() - interval '10 minutes')
  order by programada_para asc nulls first
  limit 1
  for update skip locked;

  if v_tarea.id is null then
    return null;
  end if;

  update papeleo_tareas
  set estado = 'en_curso', ultimo_latido = now(), updated_at = now()
  where id = v_tarea.id
  returning * into v_tarea;

  return v_tarea;
end;
$fn$;
