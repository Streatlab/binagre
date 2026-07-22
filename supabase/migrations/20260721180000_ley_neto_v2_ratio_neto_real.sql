-- LEY-NETO v2 — calibracion sobre BRUTO REAL + ratio_neto_real
-- Denominador de los ratios (Uber y Glovo) pasa de sum(ventas_bruto) a
-- sum(ventas_bruto) - sum(abs(promo_autofinanciada)) (= bruto real). Uber usa
-- `promociones`; Glovo usa `otros_cargos` (promo asumida por partner).
-- Nuevo ratio maestro: ratio_neto_real = sum(pago_neto)/sum(bruto_real), 183 dias.
alter table config_canales add column if not exists ratio_neto_real numeric;

create or replace function public.fn_recalibrar_calcneto()
returns void language plpgsql security definer as $function$
declare
  v_ventana int := 183;
  v_min_peds int := 120;
  v_min_liq  int := 3;
  cfg record; s record;
  v_prime numeric; v_promo numeric; v_promosub numeric; v_ads numeric; v_ratio numeric;
  v_bruto_real numeric;
begin
  -- UBER: bruto_real = ventas_bruto - promo autofinanciada (LEY-NETO v2)
  select coalesce(sum(num_pedidos),0) peds, count(*) liq,
         coalesce(sum(ventas_bruto),0) bruto,
         coalesce(sum(abs(coalesce(promociones,0))),0) promo_abs,
         coalesce(sum(comision_uber),0) comision,
         coalesce(sum(otros_cargos_promo),0) fee_promo,
         coalesce(sum(coalesce(promociones,0)),0) promo_sub,
         coalesce(sum(coalesce(ads,0)),0) ads,
         coalesce(sum(coalesce(pago_neto,0)),0) neto
    into s from uber_liquidaciones
   where ventas_bruto>0 and num_pedidos>0 and fecha_fin_periodo >= current_date - v_ventana;

  select * into cfg from config_canales where canal='Uber Eats';
  v_bruto_real := s.bruto - s.promo_abs;
  if found and v_bruto_real > 0 and (s.peds >= v_min_peds or s.liq >= v_min_liq) then
    v_promo := least(1, greatest(0,
      case when coalesce(cfg.fee_promo_eur,0) > 0
           then (s.fee_promo / (cfg.fee_promo_eur * 1.21)) / s.peds else 0 end));
    v_prime := case
      when coalesce(cfg.comision_pct_prime,0) > coalesce(cfg.comision_pct,0)
      then least(1, greatest(0, ((s.comision / v_bruto_real) - cfg.comision_pct) / (cfg.comision_pct_prime - cfg.comision_pct)))
      else coalesce(cfg.pct_pedidos_prime_estim,0) end;
    v_promosub := least(0.6, greatest(0, s.promo_sub / v_bruto_real));
    v_ads      := least(0.3, greatest(0, s.ads / v_bruto_real));
    v_ratio    := least(1, greatest(0, s.neto / v_bruto_real));

    insert into calcneto_calibracion_log (canal, campo, valor_anterior, valor_nuevo, pedidos_muestra, liquidaciones_muestra, ventana_dias)
    values
      ('Uber Eats','pct_pedidos_promo_estim',      cfg.pct_pedidos_promo_estim,       v_promo,    s.peds, s.liq, v_ventana),
      ('Uber Eats','pct_pedidos_prime_estim',      cfg.pct_pedidos_prime_estim,       v_prime,    s.peds, s.liq, v_ventana),
      ('Uber Eats','pct_promo_subvencionada_estim',cfg.pct_promo_subvencionada_estim, v_promosub, s.peds, s.liq, v_ventana),
      ('Uber Eats','pct_ads_estim',                cfg.pct_ads_estim,                 v_ads,      s.peds, s.liq, v_ventana),
      ('Uber Eats','ratio_neto_real',              cfg.ratio_neto_real,               v_ratio,    s.peds, s.liq, v_ventana);

    update config_canales
       set pct_pedidos_promo_estim=v_promo, pct_pedidos_prime_estim=v_prime,
           pct_promo_subvencionada_estim=v_promosub, pct_ads_estim=v_ads,
           ratio_neto_real=v_ratio,
           calibrado_at=now(), calibrado_pedidos=s.peds, calibrado_liquidaciones=s.liq
     where canal='Uber Eats';
  end if;

  -- GLOVO: bruto_real = ventas_bruto - promo autofinanciada (otros_cargos)
  select coalesce(sum(g.ventas_bruto),0) bruto,
         coalesce(sum(abs(coalesce(g.otros_cargos,0))),0) promo_abs,
         coalesce(sum(g.marketing),0) marketing,
         coalesce(sum(coalesce(g.ingreso_colaborador,0)),0) neto,
         count(*) liq,
         coalesce((select sum(vp.pedidos) from ventas_plataforma vp
                    where lower(vp.plataforma) like 'glovo%'
                      and vp.fecha_fin_periodo >= current_date - v_ventana),0) peds
    into s from glovo_liquidaciones g
   where g.fecha_fin_periodo >= current_date - v_ventana;

  select * into cfg from config_canales where canal='Glovo';
  v_bruto_real := s.bruto - s.promo_abs;
  if found and v_bruto_real > 0 and s.peds >= v_min_peds and s.liq >= v_min_liq then
    v_prime := least(1, greatest(0,
      case when coalesce(cfg.fee_prime_eur,0) > 0
           then (s.marketing / (cfg.fee_prime_eur * 1.21)) / s.peds
           else coalesce(cfg.pct_pedidos_prime_estim,0) end));
    v_ads   := least(0.3, greatest(0, s.marketing / v_bruto_real));
    v_ratio := least(1, greatest(0, s.neto / v_bruto_real));

    insert into calcneto_calibracion_log (canal, campo, valor_anterior, valor_nuevo, pedidos_muestra, liquidaciones_muestra, ventana_dias)
    values
      ('Glovo','pct_pedidos_prime_estim', cfg.pct_pedidos_prime_estim, v_prime, s.peds, s.liq, v_ventana),
      ('Glovo','pct_ads_estim',           cfg.pct_ads_estim,           v_ads,   s.peds, s.liq, v_ventana),
      ('Glovo','ratio_neto_real',         cfg.ratio_neto_real,         v_ratio, s.peds, s.liq, v_ventana);

    update config_canales
       set pct_pedidos_prime_estim=v_prime, pct_ads_estim=v_ads, ratio_neto_real=v_ratio,
           calibrado_at=now(), calibrado_pedidos=s.peds, calibrado_liquidaciones=s.liq
     where canal='Glovo';
  end if;
end;
$function$;

select fn_recalibrar_calcneto();
