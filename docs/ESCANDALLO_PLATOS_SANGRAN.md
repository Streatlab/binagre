# ESCANDALLO · Platos que sangran (impacto real del coste en el margen)

Cierra el bucle entre la ingesta de facturas y el negocio: la ingesta mantiene el
coste del escandallo al día → esto traduce ese coste en **cuánto dinero real pierdes al
mes** por cada plato cuyo food cost está por encima del objetivo.

## Cómo se calcula (sin recalcular nada nuevo)

Función `fn_escandallo_platos_sangran(p_target)` sobre la vista canónica `v_margen_plato`
(margen por plato/canal con ventas reales). Para el último periodo con ventas, agrupa por
plato+marca y calcula:

- `food_cost_pct` = coste materia prima real ÷ ingresos brutos.
- `sangria_eur` = coste MP real − (ingresos × objetivo). Solo platos por encima del objetivo.

`p_target` es el food cost objetivo en decimal (por defecto **0,35 = 35 %**). Se reutiliza
la fuente canónica de margen; la feature no inventa fórmulas propias.

## Dónde se ve

- `GET /api/papeleo/escandallo-auto?action=platos-sangran&target=0.35` → platos ordenados
  por € perdidos/mes + el objetivo aplicado.
- Card "Platos que sangran" en la pestaña Auto: plato · marca · uds/mes · food cost real
  (rojo) · pierdes/mes (rojo).

## Por qué importa

Un plato con food cost del 53 % (objetivo 35 %) que vende bien te está comiendo el margen
sin que se note en ninguna alerta de precio. Aquí sale ordenado por sangría en €, así se
ataca primero lo que más duele: subir el PVP o abaratar el escandallo (¡mira el Radar de
ahorro!).

## Notas

- Usa `v_margen_plato`, que compara coste de materia prima vs precio (food margin). No es
  el waterfall completo con comisiones de plataforma — es el food cost, la palanca que
  controla cocina y la que mueve la ingesta.
- El objetivo por defecto (35 %) es parametrizable por query; se puede exponer un selector
  en la UI más adelante si Rubén quiere otro umbral.

---

## Cuadro de mando de la pestaña Auto (features acumuladas)

Todas se alimentan de la misma ingesta y comparten estilo de card:

- **Precios sospechosos (guardián anti-error de lectura)** — vista
  `v_escandallo_precios_sospechosos`: el último precio que se dispara ×4 o cae a ¼ frente
  a la mediana histórica del ingrediente (probable coma mal leída en la factura). Se marca
  en rojo con botón "Revisar" para corregir antes de que contamine el escandallo. Acción
  `precios-sospechosos`.
- **Termómetro de la despensa (inflación)** — vista `v_escandallo_inflacion`: precio medio
  de cada ingrediente 45 días recientes vs 45-135 anteriores. Titular = variación mediana;
  card con top movers. Indicativo. Acción `inflacion`.
- **PVP recomendado** — `fn_escandallo_platos_sangran` ahora devuelve `pvp_actual`,
  `pvp_objetivo` (coste ración ÷ objetivo) y `subida_eur`: en "Platos que sangran" se ve a
  cuánto subir el PVP para llegar al food cost objetivo.
- **Dónde se va el dinero (Pareto de compras)** — vista `v_escandallo_pareto_compras`:
  gasto por partida en 90 días con % y % acumulado. Acción `pareto-compras`.
