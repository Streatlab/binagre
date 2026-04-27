# Active Plan

## En curso
**Bloque B Conciliación** — deduplicador, ordenante/beneficiario, reglas multi-dim, sueldos.

## Cola de trabajo (ejecutar en orden tras Bloque B)
1. **Bloque C** — KPIs unificados + sueldos integrados + página /finanzas/socios.
   - Spec: `.claude/plans/spec-bloque-c.md`
   - Cerrado 100%, sin huecos.

2. **Bloque D** — Drop facturas masivo + OCR + auto-conciliación + Drive automático.
   - Spec: `.claude/plans/spec-bloque-d.md`
   - Cerrado 100%, sin huecos.

## Reglas globales
- RULES.md regla 8: ejecución autónoma, no preguntar lo resoluble.
- RULES.md regla 9: specs completos antes de implementar.
- RULES.md regla 3: NO Vercel mientras Rubén trabaja activamente.

## Bloques fuera de mi alcance
- **PE refactor** — lo lleva otro chat. NO tocar PE en Bloque B/C/D.

## Constantes globales del proyecto (uso en cualquier bloque)
```ts
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const DRIVE_OPERACIONES_ID = '1dB6REknvNl8JxGGuv8MXloUCJ3_evd7H'
const PLATAFORMAS = ['uber eats','uber bv','portier eats','glovo','glovoapp','just eat','takeaway','rushour']
```
