# Job — Test pipeline visual con Playwright

**Fecha:** 2026-05-02
**Tipo:** Fix visual mínimo (test de circuito completo)
**Repo:** Streatlab/binagre

## Objetivo
Validar que el pipeline GitHub Action → Claude Code → Vercel funciona de extremo a extremo añadiendo un punto al final del título de la página Conciliación.

## Cambio exacto

**Archivo:** `src/pages/Conciliacion.tsx`

**Buscar la cadena exacta:**
```
            CONCILIACIÓN
```

**Reemplazar por:**
```
            CONCILIACIÓN.
```

Solo cambia el texto del `<h2>` del header. Ningún otro cambio.

## Pipeline a seguir
1. Implementer (Sonnet) → editar el archivo con el cambio exacto.
2. qa-reviewer (Haiku) → confirmar:
   - El cambio es solo en una línea.
   - No hay otros archivos modificados.
   - Build pasa.
3. Integrator (Haiku) → commit con mensaje `test: añade punto final a título Conciliación (test pipeline)` y push a master.

## Definition of Done
- Commit en master con un único archivo modificado.
- Build de Vercel pasa.
- En `https://binagre.vercel.app/conciliacion` el título aparece como `CONCILIACIÓN.` con punto final.

## Después de validar
Rubén verificará con Claude (vía Playwright o web_fetch) y, si todo OK, pedirá el revert.
