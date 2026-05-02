# Job — Limpiar título Conciliación a estado original

**Fecha:** 2026-05-02
**Tipo:** Cleanup
**Repo:** Streatlab/binagre

## Estado actual del archivo
El título dentro del `<h2>` actualmente es: `CONCILIACIÓN..` (con dos puntos al final, por error de un test anterior).

## Cambio exacto

**Archivo:** `src/pages/Conciliacion.tsx`

Buscar la cadena exacta `CONCILIACIÓN..` (con DOS puntos al final) y reemplazarla por `CONCILIACIÓN` (sin puntos). Solo esa línea, ningún otro cambio.

## Verificación
- Solo `src/pages/Conciliacion.tsx` debe cambiar.
- El título queda como `CONCILIACIÓN` sin puntos.
- Tras aplicar el cambio, eliminar este archivo de job.
