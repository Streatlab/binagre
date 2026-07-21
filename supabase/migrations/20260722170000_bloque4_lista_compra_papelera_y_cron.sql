-- BLOQUE 4: papelera de la lista de compra + refresco semanal (cron lunes 09:00 Europe/Madrid).
create table if not exists lista_compra_excluidos (
  ingrediente_id uuid primary key references ingredientes(id) on delete cascade,
  excluido_at timestamptz not null default now()
);

-- Sincroniza precio_robot del diccionario con el último precio del robot en ingredientes.
create or replace function fn_refrescar_lista_compra() returns integer
language plpgsql as $$
declare n integer;
begin
  update ingrediente_productos ip
     set precio_robot = i.precio_activo, updated_at = now()
    from ingredientes i
   where i.id = ip.ingrediente_id
     and ip.activo is true
     and i.precio_activo is not null
     and coalesce(ip.precio_robot, -1) is distinct from i.precio_activo;
  get diagnostics n = row_count;
  return n;
end $$;

-- Guardia DST: pg_cron corre en UTC; disparamos cada hora los lunes y solo ejecutamos a las 09:00 Madrid.
create or replace function fn_cron_lista_compra_lunes() returns void
language plpgsql as $$
begin
  if extract(hour from (now() at time zone 'Europe/Madrid')) = 9 then
    perform fn_refrescar_lista_compra();
  end if;
end $$;

select cron.unschedule('lista_compra_lunes') where exists (select 1 from cron.job where jobname='lista_compra_lunes');
select cron.schedule('lista_compra_lunes', '0 * * * 1', $cmd$ select fn_cron_lista_compra_lunes(); $cmd$);
