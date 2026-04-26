# Active Plan

## Fix actual
**Conciliación · matching automático de proveedor** — desbloquear columna Contraparte vacía.

## Estado pipeline
1. ✅ `pm-spec` → `.claude/plans/spec.md`
2. ✅ tasks → `.claude/plans/tasks.md`
3. ⏳ `implementer` (contexto bifurcado) → ejecutar T1 + T2
4. ⏳ `qa-reviewer` → T3
5. ⏳ cierre git+vercel → T4

## Backfill SQL aplicado (fuera de pipeline, ya en prod)
- 873/5655 movs con proveedor canónico (15,4% cobertura).
- 17 alias nuevos añadidos a `proveedor_alias` (Punto Q, Huijia, Octopus, Europastry, Lactalis, Hacienda, Seguridad Social…).
- 4.782 movs restantes sin proveedor → transferencias/Bizum/traspasos genéricos. No matcheables sin enriquecimiento manual.

## Siguiente fix tras este
OCR robusto: nunca dejar facturas zombie 'Procesando' (#16 backlog Notion).
