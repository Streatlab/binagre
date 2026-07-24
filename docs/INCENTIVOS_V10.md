# INCENTIVOS v10 — Modelo vigente (jul 2026)

Tope: 250 €/persona/mes. Base 180 € × multiplicador de facturación.

## Candado de facturación (facturacion_meses)
- < 25.000 € brutos → 0 €
- 25–28k → ×1 · 28–31k → ×1,2 · +31k → ×1,4

## Regla de muerte (incentivos_mes.muerte)
Pedido cancelado/sin aceptar por cocina o cierre de tienda en horario → 0 € para todos.

## Colectivo (incentivos_mes)
- Reembolsos del mes (reembolsos_total + reembolsos_sin_foto, los sin foto cuentan doble):
  0 € → 60 € (40 + 20 premio) · ≤50 € → 40 € · 50–100 € → 20 € · +100 € → 0 €
- Inventario permanente sin descuadres (examen sorpresa) → 45 €

## Individual (incentivos_medicion)
- Vacío de cámara (vacio_ok) → 40 €
- Checklists verificados con doble firma (checklist_ok + checklist_verificado_por) → 25 €
- Fechado y conservación (fechado_ok) → 10 €

## Penalizaciones
- Tardes: 2 gratis, después −10 €/ud (tardes)
- Tarde en apertura de turno: −20 €/ud (tardes_apertura)

## Bonus
- 3 meses seguidos al 100% → +50 € (pendiente de automatizar)

## Cálculo
total = muerte || k=0 ? 0 : min(250, max(0, colectivo + individual − penalización) × k)
Fuente de verdad en BD: vistas v_incentivos_mes / v_incentivos_total. UI: src/pages/equipo/TabIncentivos.tsx.
Empleados activos: Ray, Cristian, Fernando (incentivos_empleado).

## Fase 2 (pendiente)
Robot de métricas de plataforma (errores, no completados, reembolsos automáticos), panel de métricas, checklists digitales con foto, detección automática de muerte, bonus constancia automático.
