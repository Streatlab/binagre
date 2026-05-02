# Job — Test pipeline visual (retry)

**Fecha:** 2026-05-02
**Tipo:** Fix visual mínimo
**Repo:** Streatlab/binagre

## Objetivo
Validar que el pipeline GitHub Action → Claude Code → Vercel funciona.

## Cambio exacto

**Archivo:** `src/pages/Conciliacion.tsx`

Buscar dentro del `<h2>` la cadena exacta `CONCILIACIÓN` (sin comillas) y reemplazarla por `CONCILIACIÓN.` (con un punto al final). Solo esa línea, ningún otro cambio.

## Verificación
- Solo `src/pages/Conciliacion.tsx` debe cambiar.
- El cambio debe ser exactamente añadir un punto al final del texto del título.
