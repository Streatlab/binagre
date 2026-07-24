# INCENTIVOS v11 — Modelo vigente (jul 2026)

Tope: 250 €/persona/mes. Multiplicador de facturación sobre todo lo ganado.

## Candado de facturación
- Automático desde ventas; **override manual** en incentivos_mes.fact_override si algo falla.
- < 25.000 € brutos → 0 € · 25–28k → ×1 · 28–31k → ×1,2 · +31k → ×1,4

## Regla de muerte (incentivos_mes.muerte)
Pedido cancelado/sin aceptar por cocina o cierre de tienda en horario → 0 € para todos.

## Colectivo (incentivos_mes)
- Reembolsos (total + sin_foto que cuentan doble): 0 € → 60 € · ≤50 € → 40 € · 50–100 € → 20 € · +100 € → 0 €
- Inventario permanente sin descuadres (examen sorpresa) → 40 €
- Entregas a tiempo: sin retrasos al rider ni pedidos demorados (retrasos_ok) → 15 €
- Valoración de clientes se mantiene/mejora (valoracion_ok, nota en valoracion_nota) → 15 €

## Individual (incentivos_medicion)
- Vacío de cámara → 40 € · Checklists con doble firma → 25 € · Fechado y conservación → 10 €

## Penalizaciones
- Tardes: 2 gratis, después −10 €/ud · Tarde en apertura −20 €/ud

## Bonus
- 3 meses seguidos al 100% → +50 €

## Cálculo
total = muerte || k=0 ? 0 : min(250, max(0, colectivo + individual − penalización) × k)
Verdad en BD: v_incentivos_mes / v_incentivos_total. UI: TabIncentivos.tsx. Portal empleado: pestaña "Mis incentivos" (contador en vivo) en TabPortal.tsx, con selector de empleado para admin.

## Fase 2 (pendiente)
Robot de métricas de plataforma (errores, no completados, reembolsos, retrasos, valoraciones automáticas), panel de métricas, checklists digitales con foto, muerte automática, bonus constancia automático.
