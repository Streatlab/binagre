-- GLOVO NETO REAL v3 — puente ventas_plataforma(glovo) -> glovo_liquidaciones
-- Diagnostico: el parser payout (parserGlovoLiquidacion via volcarVentasPlataforma)
-- ya escribe bruto/neto/pedidos REALES en ventas_plataforma, pero NADA poblaba
-- glovo_liquidaciones, que es de donde la calibracion (fn_recalibrar_calcneto,
-- bloque Glovo) lee bruto/marketing/otros. Ese era el enganche roto.
-- Este puente sincroniza ambas, idempotente, sin derivar bruto de comision ni
-- neto = bruto*% (prohibido v3 §4). config_canales solo lo escribe la calibracion.

create unique index if not exists ux_glovo_liq_periodo_marca
  on glovo_liquidaciones (plataforma, marca, fecha_inicio_periodo, fecha_fin_periodo);
alter table glovo_liquidaciones add column if not exists origen text default 'settlement_real';

create or replace function fn_glovo_sync_liquidaciones()
returns void
language plpgsql
security definer
as $$
begin
  delete from glovo_liquidaciones g
   where g.origen='settlement_real'
     and not exists (
       select 1 from ventas_plataforma v
        where lower(v.plataforma) like 'glovo%' and coalesce(v.bruto,0)>0
          and v.marca=g.marca
          and v.fecha_inicio_periodo=g.fecha_inicio_periodo
          and v.fecha_fin_periodo=g.fecha_fin_periodo);

  insert into glovo_liquidaciones as g
    (plataforma, marca, numero_factura, fecha_factura, fecha_inicio_periodo, fecha_fin_periodo,
     ventas_bruto, comision_base, marketing, otros_cargos, ingreso_colaborador, estado, origen)
  select 'glovo', v.marca,
         coalesce((v.facturas_origen)[1], 'GLV-'||to_char(v.fecha_inicio_periodo,'YYYYMMDD')||'-'||left(v.marca,12)),
         v.fecha_fin_periodo, v.fecha_inicio_periodo, v.fecha_fin_periodo,
         v.bruto, coalesce(v.comision_eur,0), coalesce(v.ads_eur,0), coalesce(v.promo_eur,0),
         coalesce(v.neto, v.ingreso_colaborador),
         'settlement_real', 'settlement_real'
    from ventas_plataforma v
   where lower(v.plataforma) like 'glovo%' and coalesce(v.bruto,0)>0
  on conflict (plataforma, marca, fecha_inicio_periodo, fecha_fin_periodo) do update
    set ventas_bruto=excluded.ventas_bruto, comision_base=excluded.comision_base,
        marketing=excluded.marketing, otros_cargos=excluded.otros_cargos,
        ingreso_colaborador=excluded.ingreso_colaborador, origen='settlement_real',
        updated_at=now();
end;
$$;

create or replace function trg_glovo_ventas_sync()
returns trigger
language plpgsql
security definer
as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  perform fn_glovo_sync_liquidaciones();
  return null;
end;
$$;

drop trigger if exists tg_glovo_ventas_sync_iu on ventas_plataforma;
create trigger tg_glovo_ventas_sync_iu
  after insert or update on ventas_plataforma
  for each row when (new.plataforma ilike 'glovo%')
  execute function trg_glovo_ventas_sync();

drop trigger if exists tg_glovo_ventas_sync_del on ventas_plataforma;
create trigger tg_glovo_ventas_sync_del
  after delete on ventas_plataforma
  for each row when (old.plataforma ilike 'glovo%')
  execute function trg_glovo_ventas_sync();

select fn_glovo_sync_liquidaciones();
