-- fn_verificar_facturacion dejaba de ser útil porque comparaba facturacion_diario
-- contra ventas_vivo, que es la MISMA fuente que alimenta facturacion_diario
-- (circular: nunca podía detectar que faltara gente).
--
-- Nueva versión:
-- 1) Si hay liquidación real en ventas_plataforma que cubre la fecha revisada,
--    compara la suma de facturacion_diario del período contra ese total oficial
--    (fuente independiente, sin circularidad) y loguea ok / divergencia_oficial.
-- 2) Detecta feed incompleto: si el último latido de ventas_vivo (TOTAL) del día
--    es anterior a las 23:15 Madrid, o no existe, loguea feed_incompleto — señal
--    de que rushour-vivo murió antes del cierre y la cifra puede quedarse corta.
-- 3) Mantiene el upsert en robot_salud igual que antes.

CREATE OR REPLACE FUNCTION public.fn_verificar_facturacion(p_fecha date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_fecha date := coalesce(p_fecha, ((now() at time zone 'Europe/Madrid')::date - 1));
  v_encontro_oficial boolean := false;
  v_col_bruto text;
  v_vivo_periodo numeric;
  v_diff numeric;
  v_ultimo_momento timestamptz;
  v_hora_madrid text;
  r record;
begin
  -- 1) Comparación contra liquidación oficial (independiente del vivo).
  for r in
    select plataforma, fecha_inicio_periodo, fecha_fin_periodo, sum(bruto) as oficial
    from ventas_plataforma
    where v_fecha between fecha_inicio_periodo and fecha_fin_periodo
    group by plataforma, fecha_inicio_periodo, fecha_fin_periodo
  loop
    v_col_bruto := case r.plataforma
      when 'uber' then 'uber_bruto'
      when 'glovo' then 'glovo_bruto'
      when 'just_eat' then 'je_bruto'
      when 'web' then 'web_bruto'
      when 'directa' then 'directa_bruto'
      else null
    end;
    if v_col_bruto is null then
      continue;
    end if;

    v_encontro_oficial := true;

    execute format(
      'select coalesce(sum(%I),0) from facturacion_diario where fecha between $1 and $2 and marca_id is null',
      v_col_bruto
    ) into v_vivo_periodo using r.fecha_inicio_periodo, r.fecha_fin_periodo;

    v_diff := round(v_vivo_periodo - r.oficial, 2);

    if abs(v_diff) > 1 then
      insert into robot_log (fuente, estado, detalle)
      values (
        'verificacion_facturacion', 'divergencia_oficial',
        v_fecha || ' · ' || r.plataforma || ' periodo ' || r.fecha_inicio_periodo || '..' || r.fecha_fin_periodo ||
        ': facturacion_diario=' || round(v_vivo_periodo, 2) || '€ vs oficial=' || round(r.oficial, 2) || '€ (diff ' || v_diff || '€)'
      );
    else
      insert into robot_log (fuente, estado, detalle)
      values (
        'verificacion_facturacion', 'ok',
        v_fecha || ' · ' || r.plataforma || ' periodo ' || r.fecha_inicio_periodo || '..' || r.fecha_fin_periodo ||
        ': facturacion_diario = oficial (' || round(r.oficial, 2) || '€)'
      );
    end if;
  end loop;

  if not v_encontro_oficial then
    insert into robot_log (fuente, estado, detalle)
    values (
      'verificacion_facturacion', 'sin_liquidacion_oficial',
      v_fecha || ': aún no hay liquidación oficial en ventas_plataforma que cubra esta fecha'
    );
  end if;

  -- 2) Feed incompleto: último latido del vivo de ese día antes de las 23:15 Madrid.
  select v.momento into v_ultimo_momento
  from ventas_vivo v
  where v.fecha = v_fecha and v.plataforma = 'TOTAL'
  order by v.momento desc
  limit 1;

  if v_ultimo_momento is null then
    insert into robot_log (fuente, estado, detalle)
    values ('verificacion_facturacion', 'feed_incompleto', v_fecha || ': no hay ningún snapshot en vivo (TOTAL) para ese día');
  else
    v_hora_madrid := to_char(v_ultimo_momento at time zone 'Europe/Madrid', 'HH24:MI');
    if (v_ultimo_momento at time zone 'Europe/Madrid')::time < time '23:15' then
      insert into robot_log (fuente, estado, detalle)
      values (
        'verificacion_facturacion', 'feed_incompleto',
        v_fecha || ': último latido del vivo a las ' || v_hora_madrid || ' Madrid (antes de 23:15) · el robot pudo morir antes del cierre'
      );
    end if;
  end if;

  insert into robot_salud (fuente, ultima_ejecucion)
  values ('verificacion_facturacion', now())
  on conflict (fuente) do update set ultima_ejecucion = now();
end;
$function$;
