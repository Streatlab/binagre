# ORDEN · MERGE FIX PAPELEO A `trabajo` · 13-jul-2026

Tarea corta y mecánica. Repo Streatlab/binagre.

El fix completo de Papeleo (motor OCR + candado de pago + plantillas + duplicados + cartero universal + descartar + toast + cards, con sus migraciones y tests) está terminado en la rama **`claude/new-session-omkuva`**, que cuelga de `master`. La rama `trabajo` no lo tiene, por eso Rubén no ve nada en el preview.

## Qué hacer

```
git checkout trabajo
git merge --no-ff claude/new-session-omkuva -m "merge: fix Papeleo completo (motor OCR, candado pago, plantillas, duplicados, cartero universal, descartar, toast, cards) + robots de plataforma [deploy]"
```

Salen **2 conflictos**, ya diagnosticados. Resolver exactamente así:

1. **`vercel.json`** → quedarse con la versión de `trabajo` (HEAD): el `ignoreCommand` que comprueba `VERCEL_GIT_COMMIT_REF != trabajo`. Descartar la de la otra rama.

2. **`api/_puertas/bootstrap-ocr.ts`** (conflicto de renombrado: en `master` vivía en `api/bootstrap-ocr.ts`) → mantener el fichero en `api/_puertas/`, con el CUERPO de la rama nueva (usa Anthropic + Tesseract) y las RUTAS de import de `trabajo` (`../_lib/…`). Bloque de imports final:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabase-admin.js'
import { descargarArchivoDeDrive } from '../_lib/google-drive.js'
import { anthropicBootstrapActivo, extraerFacturaAnthropicTexto, extraerFacturaAnthropicVisionUltimoRecurso } from '../_lib/ocr-anthropic.js'
import { extraerTextoOCRGratis } from '../_lib/ocr-tesseract.js'
import { matchFactura, aplicarMatching } from '../_lib/matching.js'
```
Asegurarse de que NO queda un duplicado en `api/bootstrap-ocr.ts`.

## Verificación (ya probada en local: pasa)
`npx tsc --noEmit` limpio · `npx vitest run` → 220 tests OK · `npm run build` OK.
Push a `trabajo`. Confirmar deployment Vercel READY con el SHA del merge y avisar en una línea.

No tocar producción. No cambiar nada más.
