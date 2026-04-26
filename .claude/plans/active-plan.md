# Active Plan

## Fix actual
**Bloque B Conciliación** — 4 fixes encadenados en código:
1. Deduplicador robusto (UNIQUE INDEX + dedup_key + ON CONFLICT)
2. Capturar ordenante/beneficiario en parser BBVA
3. Auto-borrado traspasos internos Emilio
4. Cálculo sueldo Emilio en Running (plataformas + complemento SL)

## Estado pipeline
1. ✅ pm-spec → spec.md
2. ✅ tasks → tasks.md
3. ⏳ implementer (contexto bifurcado)
4. ⏳ qa-reviewer
5. ⏳ cierre git+pull (NO Vercel — regla 3 localhost)

## Bloque A ya cerrado en BD (sin tocar código)
- 887 movs con proveedor canónico (de 0).
- 100% movs con categoría (5.716/5.716).
- 0 facturas zombie en "Procesando".
- 7 traspasos internos Emilio borrados retroactivamente.
- 1.032,59€ Emilio re-categorizado como ING-IVA Hacienda (devolución IVA 2025).
- Decálogo categorización documentado para chat David.

## Pendiente identificación manual de Rubén
14 transferencias salientes "Transferencia realizada" sin beneficiario conocido. Rubén identificará cuáles son a Emilio y se etiquetarán como RRH-NOM-EMI manualmente. Tras Bloque B, futuras llevarán beneficiario explícito.

## Siguiente bloque tras este
Carga masiva facturas históricas Q1 2026 + Punto de Equilibrio (módulo PE completo).
