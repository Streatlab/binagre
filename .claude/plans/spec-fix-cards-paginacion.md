# Spec · Conciliación Movimientos · BUGS CARDS Y PAGINACIÓN

> Sonnet · NO Opus · Aislamiento Binagre absoluto

## BUGS

**BUG 1** Cards de Ingresos/Gastos/Pendientes/Titular suman TODOS los movimientos cargados (1000) en lugar de aplicar el filtro de fecha del SelectorFechaUniversal del header.

Ejemplo: filtro "Mes en curso" abril 2026, BD tiene 5060€ de ingresos abril, pero las cards muestran 57.663€ (suma todos los meses cargados).

**FIX 1**: las 4 cards deben recibir un dataset YA filtrado por fecha (mes en curso, último mes, etc según SelectorFechaUniversal). Aplicar el mismo filtro de fecha tanto a la tabla como a las cards.

**BUG 2** Tabla muestra "Mostrando 25 de 1000 movimientos" → paginación cap a 1000.

**FIX 2**: eliminar el cap de 1000. La query a Supabase debe traer TODOS los movimientos del periodo seleccionado (sin LIMIT 1000). 

Si hay preocupación de performance en periodos grandes (ej. "todo el histórico"), hacer paginación real con scroll infinito o paginación numérica al final de la tabla, pero NUNCA truncar silenciosamente con texto "25 de 1000".

**BUG 3** El contador "Pendientes 851" parece coherente con el dataset cargado pero también debe estar filtrado por el periodo seleccionado.

**FIX 3**: el contador de Pendientes y su importe asociado se calculan SOLO sobre el dataset filtrado por fecha activa.

## CRITERIOS

1. Filtro "Mes en curso" abril 2026 → cards muestran ~5060€ ingresos / ~5811€ gastos (datos BD reales)
2. Filtro "Últimos 3 meses" → cards muestran suma de feb+mar+abr 2026
3. Filtro "Todo" → cards muestran totales históricos completos (~283k ingresos / ~234k gastos)
4. Tabla muestra TODAS las filas del periodo (no truncado a 1000)
5. Contador Pendientes coherente con el periodo
6. Build limpio, deploy Vercel

## ENTREGABLES

1. Fix aplicado
2. git push master
3. npx vercel --prod
4. Informe con URL deploy y los 6 criterios pasados/fallados
