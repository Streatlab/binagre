# AUTOLOOP · Reembolsos + Incentivos + Checklists (24-jul-2026)

Protocolo: AUTOLOOP v1 (Notion). Rama de origen: `claude/reembolsos-reclamaciones-plataformas-z1r8md`
(consolidada en `trabajo` el 24-jul-2026; la rama queda archivada).

## Criterios objetivos de HECHO
1. `npx tsc -b` limpio y `npm run build` limpio al cierre.
2. Robot Uber creado en Supabase (función + cron 05:15 + latido robot_salud + vigilante ampliado) y probado con `select fn_robot_reembolsos_uber()`.
3. Barrido de cobro/detección por factura creado y probado con select directo.
4. Pantalla Reembolsos muestra: estados devuelto(detectado)/aprobada, causa, cliente, contador de días para reclamar, banner de avisos del robot.
5. Scorecard de incentivos leyendo datos reales (rpc `fn_incentivo_scorecard`).
6. Documento marco de incentivos: `docs/INCENTIVO_MARCO_COCINA.md` + versión imprimible desde el ERP.

## Checklist
### Fase 1 — BD (Supabase)
- [x] M1 reclamaciones: causa, cliente_nombre, detectado_por, estado 'aprobada'; vista pendientes ampliada
- [x] M2 fn_robot_reembolsos_uber + cron 15 5 * * * + latido + vigilante
- [x] M3 fn_barrido_reembolsos (detección Glovo por factura + cobro Uber + aging 21d)
- [x] M4 fn_incentivo_scorecard(anio, mes)
### Fase 2 — Frontend
- [x] F1 useReclamaciones: tipos/labels/métricas nuevos
- [x] F2 ReclamacionReembolsos: tabs, causa, cliente, contador días, banner avisos
- [x] F3 TabIncentivos: scorecard + impresión documento marco
- [ ] F4 Checklists: 7º checklist de mantenimiento semanal — PENDIENTE de aplicar en
      `src/pages/ops/ChecklistsAperturaCierre.tsx` (añadir tipo, defaults, label y pestaña
      'mantenimiento'). Los 6 existentes ya son accionables + imprimibles + lectura por foto.
### Fase 3 — Documento marco
- [x] D1 docs/INCENTIVO_MARCO_COCINA.md
### Fase 4 — Cierre
- [x] Gate build completo + commits

## CONSOLIDACIÓN 24-jul-2026 (decisión)
Al unificar esta rama con `trabajo` había dos versiones de la pestaña de Incentivos:
- `trabajo`: **v13** (candado 25/28/31k con multiplicador, regla de compañerismo, colectivo).
- esta rama: scorecard automático desde datos reales.

**Manda la v13**, por ser la validada con Rubén y la que ya sostiene el Plan de Incentivos
imprimible. El scorecard automático (`fn_incentivo_scorecard`) sigue vivo en la base de datos
y puede añadirse a la v13 como pestaña de apoyo cuando se decida.

## DECISIONES (autónomas, corregibles)
- Plazo para reclamar: 14 días desde la fecha del pedido (constante en código, comentada).
- No se tocan tramos ni importes en incentivos_config: el documento marco es PROPUESTA; Rubén valida antes de cargar.
- Robot usa estado 'devuelto' (=detectado, ya existente) para lo que encuentra; 'pendiente' sigue siendo alta manual.

## Detección (estado real 24-jul, tras corrección de Rubén)
- Reembolso = descuento por queja de cliente. Las cancelaciones NO cuentan.
- Uber: ajuste negativo por pedido en el CSV de pagos (`uber_pedidos.otros_pagos < 0`).
- Glovo / Just Eat / Uber: historial de pedidos ya cargado en el ERP
  (`pedidos_operativa.incidencia = 'reclamacion'`). Primer barrido: 9 reclamaciones
  reales de Glovo (227,02 €, jun-jul) detectadas y en pantalla.
- Vigilancia de cobro: con cada factura nueva del canal posterior a la reclamación que
  no traiga el abono → aviso en pantalla + bitácora, y se repite factura a factura
  hasta que se cobra (campo `facturas_revisadas`).

## Just Eat (calibrado con facturas reales del Drive, 24-jul)
- Descuento: línea de factura "Ajuste Pedido NNN (Sujeto a IVA @ 21%) X€" → se registra
  como reclamación detectada (importe con IVA).
- Devolución: línea del estado de cuenta "Compensacion pedido NNN GLxxx fecha X€" → marca
  el cobro de la reclamación (o la registra ya cobrada si no existía).
- Implementado en el lector de facturas JE del cartero (extraerReembolsosJustEat +
  registrarReembolsosJustEat): cada factura nueva se procesa sola.
- Backfill hecho a mano de las facturas almacenadas: 1 ajuste (186115822, 8,17 €,
  Comida Casera, jun) + 2 compensaciones cobradas el 15-jul (13,95 € Ramen & Katsu,
  2,50 € Greta la Green).

## Nota fuente historial
- `pedidos_operativa` la alimenta la ingesta de Sinqro (robot-ingesta), no una subida
  manual: la detección temprana de Glovo/Uber es automática mientras Sinqro siga vivo
  (vigilado en robot_salud).
