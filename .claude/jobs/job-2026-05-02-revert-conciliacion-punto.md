# Job — Revertir punto Conciliación

**Fecha:** 2026-05-02
**Tipo:** Revert del test
**Repo:** Streatlab/binagre

## Objetivo
Revertir el cambio del test anterior. Quitar el punto del título Conciliación.

## Cambio exacto

**Archivo:** `src/pages/Conciliacion.tsx`

Buscar dentro del `<h2>` la cadena exacta `CONCILIACIÓN.` (con punto al final) y reemplazarla por `CONCILIACIÓN` (sin punto). Solo esa línea, ningún otro cambio.

## Verificación
- Solo `src/pages/Conciliacion.tsx` debe cambiar.
- El cambio debe ser exactamente quitar el punto final.
