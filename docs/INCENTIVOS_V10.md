# INCENTIVOS v13 — Modelo vigente (jul 2026)

Tope: 250 €/persona/mes. Multiplicador de facturación sobre todo lo ganado.

## Candado de facturación
- Automático desde ventas; override manual (incentivos_mes.fact_override).
- < 25.000 € → 0 € · 25–28k → ×1 · 28–31k → ×1,2 · +31k → ×1,4

## Reglas de muerte
- **Grupal** (incentivos_mes.muerte): cancelación/no aceptado por cocina o cierre en horario → 0 € para todos.
- **Personal / regla de compañerismo** (incentivos_medicion.muerte_personal): falta de respeto, incidente grave de actitud o dejar tirado al equipo → 0 € solo para esa persona.

## Colectivo (incentivos_mes)
- **Entregas a tiempo**: sin retrasos al rider y tiempo de preparación cumplido → **50 €** (mayor peso: es lo que más premian los algoritmos)
- Reembolsos (total + sin_foto doble): 0 € → 40 € (30+10 premio) · ≤50 € → 30 € · 50–100 € → 15 € · +100 € → 0 €
- Inventario permanente: examen sorpresa con descuadre ≤ 2% del valor contado → 35 €
- Valoración de clientes se mantiene/mejora → 10 €

## Individual (incentivos_medicion)
- Vacío de cámara → 40 € · Checklists con doble firma → 25 € · Fechado y conservación → 10 €

## Penalizaciones
- Tardes: 2 gratis, después −10 €/ud · Tarde en apertura −20 €/ud

## Bonus
- 3 meses seguidos al 100% → +50 €

## Cálculo
total = muerte || muerte_personal || k=0 ? 0 : min(250, max(0, colectivo + individual − penalización) × k)
Verdad en BD: v_incentivos_mes / v_incentivos_total. UI: TabIncentivos.tsx. Portal: pestaña "Mis incentivos".

## Fase 2 (pendiente)
Robot de métricas de plataforma (retrasos, tiempo preparación, errores, no completados, reembolsos, valoraciones), panel de métricas, checklists digitales con foto, muerte automática, bonus constancia automático.
