-- Batería de frases-insight del Panel Global (Binagre / Streat Lab)
-- Espejo de src/components/panel/resumen/frasesInsight.ts
-- Ejecutar en el editor SQL de Supabase (proyecto Binagre: eryauogxcpbgdryeimdq)
-- cuando el conector esté disponible. La UI puede pasar a leer de esta tabla
-- sin cambios de diseño: mismos campos (campo · op · umbral + plantillas).

create table if not exists public.frases_insight (
  id           text primary key,
  categoria    text not null check (categoria in ('general','canales','costes','objetivos','caja')),
  campo        text not null,               -- métrica a evaluar (ej. comisionPct)
  op           text not null check (op in ('>','>=','<','<=')),
  umbral       numeric not null,
  impacto_base numeric not null default 0,  -- peso para ordenar (mayor = antes)
  lead         text not null,
  mark         text not null,               -- valor destacado (placeholder {campo:fmt})
  tail         text not null,
  sub          text not null,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

alter table public.frases_insight enable row level security;

insert into public.frases_insight (id, categoria, campo, op, umbral, impacto_base, lead, mark, tail, sub) values
('comision_alta','general','comisionPct','>=',35,3400,'Las comisiones se llevan','{comisionPct:pct}','de lo que vendes.','Tu web trae el {webPct:pct}. Cada cliente que vuelve por la web es comida que cobras entera, sin comisión.'),
('web_floja','canales','webPct','<',10,800,'Tu web solo trae','{webPct:pct}','de las ventas.','Es el canal sin comisión: cada punto que sube va directo a tu margen.'),
('web_fuerte','canales','webPct','>=',20,60,'Tu web ya pesa un','{webPct:pct}','de las ventas.','Bien: ese volumen va sin comisión de plataforma. Sigue empujándolo.'),
('canal_rentable','canales','mejorCanalNetoPed','>',0,40,'El canal que más te deja es','{mejorCanal}','.','Te quedan {mejorCanalNetoPed:eur} limpios por pedido ahí. Prioriza ese canal en marketing.'),
('prime_alto','costes','primeCostPct','>',65,600,'Tu prime cost está en','{primeCostPct:pct}','de lo que ingresas.','Por encima del 60% objetivo: vigila food cost y horas de cocina.'),
('prime_ok','costes','primeCostPct','<=',55,30,'Tu prime cost está controlado en','{primeCostPct:pct}','.','Por debajo del 60% objetivo. Margen sano para crecer.'),
('food_alto','costes','foodCostPct','>',32,400,'El food cost se ha ido al','{foodCostPct:pct}','sobre neto.','Revisa escandallos y mermas: el objetivo está en torno al 28-30%.'),
('labor_alto','costes','laborPct','>',42,300,'El coste de equipo está en','{laborPct:pct}','sobre neto.','Ajusta turnos a los días pico: el objetivo ronda el 40%.'),
('caida_fuerte','general','variacionVentas','<',-8,900,'Estás','{variacionVentas:pct}','bajo tu media.','Caída notable. Revisa qué canal ha bajado y reacciona hoy mismo.'),
('caida_leve','general','variacionVentas','<',-3,300,'Bajas un','{variacionVentas:pct}','respecto a tu media.','Ligera bajada. Vigila la semana antes de que se consolide.'),
('subida_fuerte','general','variacionVentas','>',8,200,'Vas','{variacionVentas:pct}','sobre tu media.','Buen ritmo. Mantén el empuje en los canales que más tiran.'),
('pedidos_arriba','general','variacionPedidos','>',10,120,'Has hecho un','{variacionPedidos:pct}','más de pedidos.','Sube el volumen. Asegura cocina y stock para sostener el ritmo.'),
('ticket_baja','general','variacionTM','<',-5,150,'Tu ticket medio cae un','{variacionTM:pct}','.','Más pedidos pero más pequeños. Revisa combos y upselling para subirlo.'),
('pe_lejos','caja','pePctProgreso','<',70,500,'Para cubrir gastos te faltan','{faltaPE:eur}','este mes.','Vas al {pePctProgreso:pct} del punto de equilibrio. Aprieta los días fuertes.'),
('pe_cerca','caja','pePctProgreso','>=',90,80,'Estás al','{pePctProgreso:pct}','del punto de equilibrio.','A un empujón de cubrir todos los gastos del mes.'),
('pe_superado','caja','pePctProgreso','>=',100,100,'Ya cubres gastos:','{pePctProgreso:pct}','del equilibrio.','Lo que entra a partir de aquí es beneficio. Buen mes.'),
('ratio_bajo','objetivos','ratioGap','<',0,250,'Ganas','{ratioActual:x}','lo que gastas.','Por debajo de tu objetivo de {ratioObjetivo:x}. Sube ventas o recorta gasto fijo.'),
('ratio_bueno','objetivos','ratioGap','>=',0,50,'Ganas','{ratioActual:x}','lo que gastas.','Por encima de tu objetivo de {ratioObjetivo:x}. Vas con holgura.'),
('dia_flojo','objetivos','diaFlojoValor','>',0,70,'Tu día más flojo es el','{diaFlojo}','.','Solo {diaFlojoValor:eur}. Plantea una promo o combo para levantarlo.'),
('resultado_negativo','general','ebitda','<',0,1500,'El periodo está en negativo:','{ebitda:eur}','.','Los costes se comen el margen. Revisa comisiones, food cost y horas.')
on conflict (id) do update set
  categoria=excluded.categoria, campo=excluded.campo, op=excluded.op, umbral=excluded.umbral,
  impacto_base=excluded.impacto_base, lead=excluded.lead, mark=excluded.mark, tail=excluded.tail, sub=excluded.sub;
