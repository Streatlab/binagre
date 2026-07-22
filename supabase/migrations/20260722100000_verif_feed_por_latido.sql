-- El aviso feed_incompleto miraba el ÚLTIMO CAMBIO de ventas_vivo (que solo inserta
-- fila cuando el número varía). En noches sin pedidos nuevos tras cierta hora, esto
-- daba falsa alarma aunque el robot siguiera vivo. Se sustituye por el LATIDO REAL
-- del robot (robot_log fuente rushour_vivo, que registra cada pasada aunque no
-- cambie nada).

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
  v_hora_madrid text;
  r record;
begin
  -- 1) Comparación contra liquidación oficial (independiente del vivo). SIN CAMBIOS.
  for r in
    select plataforma, fecha_inicio_periodo, fecha_fin_periodo, sum(bruto) as oficial
    from ventas_plataforma
    where v_fecha between fecha_inicio_periodo and fecha_fin_periodo
    group by plataforma, fecha_inicio_periodo, fecha_fin_periodo
  loop
    v_col_bruto := case r.plataforma
      when 'uber' then 'uber_bruto' when 'glovo' then 'glovo_bruto'
      when 'just_eat' then 'je_bruto' when 'web' then 'web_bruto'
      when 'directa' then 'directa_bruto' else null end;
    if v_col_bruto is null then continue; end if;
    v_encontro_oficial := true;
    execute format(
      'select coalesce(sum(%I),0) from facturacion_diario where fecha between $1 and $2 and marca_id is null',
      v_col_bruto) into v_vivo_periodo using r.fecha_inicio_periodo, r.fecha_fin_periodo;
    v_diff := round(v_vivo_periodo - r.oficial, 2);
    if abs(v_diff) > 1 then
      insert into robot_log (fuente, estado, detalle)
      values ('verificacion_facturacion','divergencia_oficial',
        v_fecha||' · '||r.plataforma||' periodo '||r.fecha_inicio_periodo||'..'||r.fecha_fin_periodo||
        ': facturacion_diario='||round(v_vivo_periodo,2)||'€ vs oficial='||round(r.oficial,2)||'€ (diff '||v_diff||'€)');
    else
      insert into robot_log (fuente, estado, detalle)
      values ('verificacion_facturacion','ok',
        v_fecha||' · '||r.plataforma||' periodo '||r.fecha_inicio_periodo||'..'||r.fecha_fin_periodo||
        ': facturacion_diario = oficial ('||round(r.oficial,2)||'€)');
    end if;
  end loop;

  if not v_encontro_oficial then
    insert into robot_log (fuente, estado, detalle)
    values ('verificacion_facturacion','sin_liquidacion_oficial',
      v_fecha||': aún no hay liquidación oficial en ventas_plataforma que cubra esta fecha');
  end if;

  -- 2) Feed incompleto POR LATIDO REAL (no por último cambio de valor).
  --    Se considera completo si el robot 'rushour_vivo' hizo alguna pasada ese día a las 23:15 Madrid o más tarde.
  if not exists (
    select 1 from robot_log
    where fuente = 'rushour_vivo'
      and (ts at time zone 'Europe/Madrid')::date = v_fecha
      and (ts at time zone 'Europe/Madrid')::time >= time '23:15'
  ) then
    select to_char(max(ts) at time zone 'Europe/Madrid','HH24:MI') into v_hora_madrid
    from robot_log
    where fuente = 'rushour_vivo'
      and (ts at time zone 'Europe/Madrid')::date = v_fecha;
    insert into robot_log (fuente, estado, detalle)
    values ('verificacion_facturacion','feed_incompleto',
      v_fecha||': el robot dejó de latir a las '||coalesce(v_hora_madrid,'—')||' Madrid (antes de 23:15) · la cifra puede quedarse corta');
  end if;

  insert into robot_salud (fuente, ultima_ejecucion)
  values ('verificacion_facturacion', now())
  on conflict (fuente) do update set ultima_ejecucion = now();
end;
$function$;
