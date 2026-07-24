# IMPRESIÓN · PROGRESO AUTOLOOP

> Checklist-memoria del sistema de impresión (docs/HANDOFF_IMPRESION_CODE.md).
> Casilla `[x]` SOLO con evidencia objetiva (grep / build verde / fila en BD).

## Estado: FASE 0 → FASE 1

### Fase 0 · Base
- [x] Tablas `impresion_preferencias` + `impresion_envios` creadas en Supabase Binagre (migración `sistema_impresion_tablas`, verificada por apply_migration OK)
- [x] Semilla: 35 documentos del inventario insertados
- [x] RPC `fn_secreto_brevo()` creada (lee `brevo_api_key` del Vault; devuelve null si no existe)

### Fase 1 · Motor + Cocina
- [ ] `api/_puertas/imprimir.ts` + rama en puerta papeleo
- [ ] `src/lib/impresionEnvio.ts` (único llamador del endpoint)
- [ ] `src/components/BotonImprimir.tsx` + `src/components/ModalImprimir.tsx`
- [ ] Pantalla Ajustes → Impresión + navModel + ruta
- [ ] Botón en los 7 documentos de cocina con PDF existente
- [ ] PDFs nuevos: Menú Familia, Menu Engineering, Coste por plato

### Fase 2 · Equipo — pendiente
### Fase 3 · Operaciones/APPCC — pendiente
### Fase 4 · Finanzas — pendiente

### Cierre
- [ ] `npx tsc -b` + `npm run build` verdes
- [ ] Envío e2e registrado en `impresion_envios` con estado `enviado`
- [ ] Push único (sin `[deploy]` → Vercel NO construye, ver ignoreCommand en vercel.json)

## DECISIONES AUTÓNOMAS
1. **Brevo API key NO está en el Vault** (verificado: vault.secrets no tiene entrada brevo, ni robot_credenciales). El handler la busca en este orden: `process.env.BREVO_API_KEY` → RPC `fn_secreto_brevo()` (Vault `brevo_api_key`) → `robot_credenciales` plataforma='brevo'. Si no aparece, error limpio `Brevo no configurado`. **Pendiente de Rubén**: meter la key en el Vault con nombre `brevo_api_key` (o env var BREVO_API_KEY en Vercel).
2. **Copias**: Epson Connect imprime cada adjunto; para N copias se adjunta el mismo PDF N veces con sufijo `-copia-N`.
3. **Rama y push**: la sesión trabaja en `claude/erp-pwa-audit-fix-555u6t` (rama asignada por el entorno). Prohibido publicar: ni `trabajo` ni `master` se tocan, ningún commit lleva `[deploy]` (con el ignoreCommand actual de vercel.json, sin `[deploy]` Vercel no lanza build).
4. Endpoint colgado de la **puerta papeleo** (`/api/papeleo/imprimir`): el catch-all ya la captura, no hace falta rewrite nuevo en vercel.json.
