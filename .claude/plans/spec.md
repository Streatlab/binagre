# SPEC — Sesión 26-abr-2026 · PE Refactor + housekeeping Notion

## Bloque A · PE Refactor (PRINCIPAL)

### Contexto
El módulo `/finanzas/punto-equilibrio` hoy depende de `pe_parametros` (21 inputs manuales en tab Configuración). Esto desincroniza PE de la realidad: los fijos editados a mano no reflejan lo que se gasta de verdad. Además hay 2 KPIs duplicados con la tabla "Coste de mantener Streat Lab".

### Objetivo
PE debe responder 5 preguntas con datos en directo desde Running Financiero + Presupuestos (promedio 3 últimos meses cerrados):

1. ¿Somos rentables este mes? (SÍ/NO + delta proyectado vs PE)
2. ¿Desde qué día del mes cubrimos gastos?
3. ¿Cuánto facturar bruto al MES para ser rentables?
4. ¿Cuánto bruto/SEMANA cerrando 2 días variados/sem (5 días operativos)?
5. ¿Cuánto bruto/DÍA cerrando 2 días variados/sem (~22 días operativos/mes)?

### Decisiones de negocio (cerradas 26-abr)
- Cierre: 2 días variados/semana → 5 días operativos/sem, ~22 días operativos/mes (5 × 4.33)
- Fuente fijos: Running, promedio 3 últimos meses cerrados
- Fuente variables: Presupuestos + desviaciones reales 3 últimos meses cerrados
- Tab Configuración del módulo PE → ELIMINAR
- 5 parámetros que sí siguen siendo manuales (`tasa_fiscal_pct`, `objetivo_beneficio_mensual`, `caja_minima_verde`, `caja_minima_ambar`, `iva_pct`) → mover a página global `/configuracion/pe-parametros`

### CA-1 · Fuente de fijos = Running, no pe_parametros
- **DADO** que existen ≥3 meses cerrados en Facturación
- **CUANDO** Dashboard PE carga
- **ENTONCES** los fijos mensuales se calculan como `avg(Running.fijos[mes-3..mes-1])` por categoría, usando taxonomía `CATEGORIAS_ORDEN`/`CATEGORIA_COLOR` de `src/lib/running`.
- **Y** si <3 meses cerrados, mostrar fallback "Datos insuficientes · usando últimos N meses cerrados" sin romper la página.

### CA-2 · Fuente de variables = Presupuestos + reales últimos 3 meses
- **DADO** Presupuestos con desviaciones reales últimos 3 meses cerrados
- **CUANDO** se calcula margen bruto
- **ENTONCES** food_cost_pct = Σ compras PRD-ALI 3m / Σ bruto ventas 3m. packaging_pct = Σ PRD-PKG 3m / Σ bruto ventas 3m. comisión_ponderada_pct = Σ comisiones plataformas 3m / Σ bruto ventas 3m.
- **Y** estos 3 ratios sustituyen completamente los inputs manuales del antiguo tab Configuración.

### CA-3 · Tab Configuración eliminado
- **DADO** la nueva fuente de datos (CA-1 + CA-2)
- **CUANDO** el usuario navega a `/finanzas/punto-equilibrio`
- **ENTONCES** existen tabs: Dashboard, Presupuestos, Simulador, Día semana. NO existe tab Configuración.
- **Y** los 5 parámetros editables se editan desde `/configuracion/pe-parametros` (o equivalente), NO desde un tab dentro de PE.

### CA-4 · Dashboard rehecho con 2 KPIs principales + tabla 3×3
- **DADO** los datos calculados en CA-1/CA-2
- **CUANDO** el usuario abre tab Dashboard
- **ENTONCES** ve 2 KpiCards grandes arriba: "¿SOMOS RENTABLES?" (SÍ/NO + delta €) y "¿DESDE QUÉ DÍA?" (Día X verde si llega antes del 30, "Día 36 · faltan Y€" rojo si no).
- **Y** debajo ve sección "OBJETIVOS DE FACTURACIÓN" con tabla 3 filas × 3 columnas:
  - Filas: "Cubrir fijos" | "Ganar [objetivo] €/mes limpio" | "Estado actual (proyección)"
  - Columnas: MES | SEMANA (5d) | DÍA (5d/sem)
- **Y** se eliminan los 2 KPIs antiguos: "CUBRIR GASTOS 11.331€" y "GANAR 3.000€ LIMPIO 20.982€".

### CA-5 · Cálculos canónicos
```
diasOperativosMes = 22       // 5 días/sem × 4.33 sem
diasOperativosSemana = 5
fijosMes = avg(Running.fijos[mes-3..mes-1])
margenBrutoPct = 1 - foodCostPct - packagingPct - comisionPonderadaPct
brutoMesParaCubrirFijos = fijosMes / margenBrutoPct
brutoSemanaParaCubrirFijos = brutoMesParaCubrirFijos / 4.33
brutoDiaParaCubrirFijos = brutoMesParaCubrirFijos / diasOperativosMes
brutoMesParaGanarObjetivo = (fijosMes + objetivo_beneficio_mensual / (1 - tasa_fiscal_pct/100)) / margenBrutoPct
brutoSemanaParaGanarObjetivo = brutoMesParaGanarObjetivo / 4.33
brutoDiaParaGanarObjetivo = brutoMesParaGanarObjetivo / diasOperativosMes
proyeccionMes = brutoMedioDiaPorDOW × diasRestantes + brutoAcumuladoHoy
margenProyectado = proyeccionMes × margenBrutoPct - fijosMes
esRentable = margenProyectado > 0
diasParaCubrir = ceil(brutoMesParaCubrirFijos / brutoMedioDia)
```

### CA-6 · Aislamiento absoluto Binagre ↔ David
- NO tocar nada del repo erp-david.
- Tokens Binagre obligatorios desde `src/styles/tokens.ts`: #B01D23, #1e2233, #e8f442, #484f66.
- KpiCards grandes con número gigante + delta + desglose. Cards soft wash. Recharts paleta CANALES.
- Locale es_ES vía `fmtEur` de `src/lib/format.ts` para todo importe.
- Respetar IVAContext (toggle Sin IVA / Con IVA) en cifras de bruto.

### CA-7 · Validación post-implementación (en localhost:5173)
- Tab Dashboard muestra 2 KPIs grandes + tabla 3×3
- NO existe tab Configuración en navegación
- Toggle Sin IVA / Con IVA funciona
- Cotejar 1 fijo manualmente (ej. alquiler) vs Running último mes → coherente
- Deploy a Vercel se hace **al final del día**, no por fix individual.

---

## Bloque B · Mobile friendly general

### Contexto
La tarea original "Mobile friendly general" (MEDIA, ACTIVO) se desglosó por error en 6 sub-tareas por módulo. Decisión de Rubén: mantener como UNA sola tarea paraguas global; pasada de mobile responsive cuando toque, no por módulo aislado.

### CA-MOB-1 · Limpieza Notion
- Las 6 sub-tareas creadas (Mobile friendly · Dashboard / Facturación / Conciliación / Bancos+Cobros+Pagos+Tesorería / PE / Configuración+Running+resto) deben eliminarse o fusionarse en la tarea paraguas única "Mobile friendly general".
- Esta acción NO toca código, solo Notion.

---

## Bloque C · Deploy Vercel diario

### CA-DEPLOY-1
- Durante la sesión de trabajo se desarrolla contra `localhost:5173`.
- Solo se hace `git push origin master && npx vercel --prod` UNA vez al día, al cierre.
- Documentación oficial del flujo: queda anotado aquí en `.claude/plans/spec.md` y se traslada a `CLAUDE.md` cuando proceda.
