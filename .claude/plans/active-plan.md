# Active plan — Binagre ERP

> Este archivo se sobrescribe en cada fix activo. Marca QUÉ se está trabajando ahora mismo.
> Pipeline: pm-spec → architect-review → implementer → qa-reviewer.
> Estado actual: SIN FIX ACTIVO.

## Pendientes Binagre (origen Notion 99 Claude)
Ver track BINAGRE-ERP en Notion. Abrir cuando se inicie un fix.

## Cuando arranque un fix
1. pm-spec genera `spec.md`
2. Aprobación Rubén
3. architect-review genera `adr.md` y `tasks.md`
4. Aprobación Rubén
5. implementer ejecuta y genera `implementation-summary.md`
6. qa-reviewer genera `qa-report.md` con veredicto
7. Si veredicto verde → cerrar fix y limpiar `plans/` (mover a `plans/archive/`)
