# Active Plan

## Fix actual
**Bloque B Conciliación + Facturas** — 4 fixes encadenados:
1. OCR robusto sin zombies
2. Reparar 4 facturas sin Drive
3. Importar excel BBVA Emilio (51 movs)
4. Matching cross-cuenta Emilio (caso Mercadona 240,94€)

## Estado pipeline
1. ✅ pm-spec → spec.md
2. ✅ tasks → tasks.md
3. ⏳ implementer (contexto bifurcado)
4. ⏳ qa-reviewer
5. ⏳ cierre git+pull (NO Vercel — regla 3 localhost)

## Bloque A ya cerrado en BD (sin tocar código)
- 873 movs con proveedor canónico (de 0).
- 17 alias nuevos en proveedor_alias.
- 45 movs CTR-ELE renombrados a "Luz".
- 32 huecos facturación auditados: 22 son cierres miércoles+jueves (correcto), 6 son Semana Santa, 4 sueltos a verificar manualmente.
- 40 movs grandes huérfanos auditados: préstamos, embargos, traspasos internos.

## Siguiente bloque tras este
Carga masiva facturas históricas Q1 2026 + Punto de Equilibrio (módulo PE completo).
