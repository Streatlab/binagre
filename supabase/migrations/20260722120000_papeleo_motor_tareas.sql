-- Fase 1 · PROMPT MAESTRO PAPELEO DEFINITIVO v1 (20-jul-2026)
-- Retira los crons nocturnos vetados (fallaban en silencio) y crea el motor de
-- tareas del botón "Resolver pendientes": persistente, reanudable, sin crons
-- de mantenimiento nuevos (el tick solo despierta tareas creadas desde el botón).

select cron.unschedule(15); -- encolar-reproc-diario
select cron.unschedule(25); -- red-seguridad-10min

create table if not exists papeleo_tareas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('despertar_dormidos','releer_ocr','archivar_drive','limpieza','conciliar')),
  estado text not null default 'pendiente' check (estado in ('pendiente','programada','en_curso','pausada','completada','error')),
  programada_para timestamptz,          -- null = ahora
  lote_tamano int not null default 30,
  total_estimado int,
  procesados int not null default 0,
  ok int not null default 0,
  errores int not null default 0,
  cursor jsonb not null default '{}'::jsonb,   -- estado interno para reanudar (ids, offsets)
  ultimo_latido timestamptz,
  detalle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table papeleo_tareas enable row level security;
drop policy if exists papeleo_tareas_all on papeleo_tareas;
create policy papeleo_tareas_all on papeleo_tareas for all to authenticated, anon using (true) with check (true);

-- Ticker del motor (NO es un job de mantenimiento: solo despierta tareas que Rubén creó
-- desde el botón y quedaron programadas o cortadas). Cada 5 min.
select cron.schedule('papeleo-agenda-tick','*/5 * * * *', $cron$
  select net.http_get(url := 'https://binagre.vercel.app/api/facturas?action=agenda-tick')
  where exists (
    select 1 from papeleo_tareas
    where (estado='programada' and programada_para <= now())
       or (estado='en_curso' and ultimo_latido < now() - interval '10 minutes')
  );
$cron$);

-- Hook post-subida (decisión inamovible de Rubén): al completarse TODO un grupo
-- real de ocr_sessions (excluye los lotes internos de 'despertar_dormidos',
-- prefijo despertar_), encola automáticamente una tarea de conciliación para
-- las facturas nuevas de ese grupo.
create or replace function fn_papeleo_conciliar_post_subida() returns trigger
language plpgsql as $fn$
declare
  v_grupo text := new.grupo_id;
  v_pendientes int;
  v_ya_existe int;
  v_desde timestamptz;
begin
  if new.estado_cola is distinct from 'completada' then return new; end if;
  if old.estado_cola is not distinct from 'completada' then return new; end if;
  if v_grupo is null or v_grupo like 'despertar_%' then return new; end if;

  select count(*) into v_pendientes from ocr_sessions where grupo_id = v_grupo and estado_cola <> 'completada';
  if v_pendientes > 0 then return new; end if;

  select count(*) into v_ya_existe from papeleo_tareas
    where tipo = 'conciliar' and estado in ('pendiente','programada','en_curso')
      and cursor->>'grupo_id' = v_grupo;
  if v_ya_existe > 0 then return new; end if;

  select min(creado_en) into v_desde from ocr_sessions where grupo_id = v_grupo;

  insert into papeleo_tareas (tipo, estado, programada_para, cursor)
  values ('conciliar', 'programada', now(), jsonb_build_object('grupo_id', v_grupo, 'desde', coalesce(v_desde, now() - interval '1 day')));

  return new;
end;
$fn$;

drop trigger if exists trg_papeleo_conciliar_post_subida on ocr_sessions;
create trigger trg_papeleo_conciliar_post_subida
after update of estado_cola on ocr_sessions
for each row execute function fn_papeleo_conciliar_post_subida();
