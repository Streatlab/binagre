# Reglas duras — Binagre ERP

## 1. Aislamiento absoluto Binagre ↔ David
- NUNCA tocar repo `Streatlab/erp-david` desde este proyecto
- NUNCA usar tokens Marino+Fuego (`#16355C`, `#F26B1F`) en este código
- NUNCA referenciar Supabase de David (`idclhnxttdbwayxeowrm`)
- Si una tarea menciona David, Cade, Mercadona/Lidl/Carrefour/Día, Alcoi, Ontinyent → STOP y avisar a Rubén

## 2. Design tokens canónicos
- Solo usar: `#B01D23` (rojo), `#1e2233` (sidebar), `#e8f442` (panel), `#484f66` (modal), `#0a0a0a` (negro)
- Archivos master: `src/styles/tokens.ts`, `src/styles/design-tokens.css`
- Nunca hardcodear hex fuera de estos archivos

## 3. Cadena de cierre obligatoria — MODO LOCALHOST
**Mientras Rubén esté trabajando activamente, NO desplegar a Vercel.** Solo validar en localhost.

Todo fix termina con:
```bash
git add . && git commit -m "..." && git push origin master && git pull origin master
```

Validación obligatoria antes del commit:
1. `npm run build` sin errores
2. `npm run dev` corriendo en `http://localhost:5173` (o puerto del proyecto)
3. Rubén verifica el fix en localhost manualmente

**NO ejecutar `npx vercel --prod` bajo ninguna circunstancia hasta que Rubén lo autorice explícitamente con la frase "deploy Vercel".**

## 4. Lógica de negocio
- Escandallo, EPS, IDING, INGREDIENTES viven dentro del ERP (NO es Apps Script)
- IDs numéricos en INGREDIENTES, ordenable
- Recetas referencian ingredientes + EPS

## 5. Pipeline obligatorio para fixes grandes
1. `pm-spec` genera `.claude/plans/spec.md`
2. Rubén aprueba
3. `architect-review` genera `.claude/plans/adr.md` y `tasks.md`
4. Rubén aprueba
5. `implementer` ejecuta y genera `summary.md`
6. `qa-reviewer` valida
7. Push solo si todo pasa

Para fixes pequeños (1-2 archivos, sin riesgo): pipeline opcional.

## 6. Comunicación
- Prompts a Claude Code siempre como artifact
- Modo corto por defecto, listas numeradas
- Sin preámbulo, sin justificaciones técnicas

## 7. Seguridad
- Nunca commitear secretos (claves Supabase, PATs)
- Variables sensibles en `.env.local` (gitignored) y en Vercel env vars

## 8. EJECUCIÓN AUTÓNOMA — NO PREGUNTAR LO RESOLUBLE
**Regla crítica: implementer/qa-reviewer NO deben hacer preguntas a Rubén que puedan deducirse del contexto, del spec, de la BD o del repo.**

Si el subagente detecta una decisión pendiente:
1. Buscar respuesta en spec.md, tasks.md, RULES.md, código existente, esquema BD, datos reales en Supabase
2. Si la respuesta NO está → tomar la opción más sensata y dejarla anotada como `DECISIÓN AUTÓNOMA` en el `summary.md`
3. SOLO preguntar a Rubén si la decisión tiene riesgo alto (borra datos, cambia lógica de negocio crítica, modifica precios)

**Ejemplos de preguntas PROHIBIDAS** (deben resolverse autónomamente):
- "¿Qué titular asigno a los movimientos del Excel?" → leer si el Excel tiene columna titular, o pedir a Rubén que añada selector en UI ANTES de procesar, NO interrumpir
- "¿Qué versión de Postgres usar para el índice?" → consultar `SELECT version()` en Supabase MCP
- "¿Cómo se llama la tabla X?" → `SELECT table_name FROM information_schema.tables` en Supabase MCP
- "¿Dónde está el archivo Y?" → buscar con grep/ripgrep en el repo
- "¿Qué color/token usar?" → leer RULES.md sección 2

**Ejemplos de preguntas LEGÍTIMAS** (sí preguntar):
- "Voy a borrar 5.000 filas de conciliación, ¿confirmas?"
- "Esta lógica afecta al cálculo de PVP de cara al cliente final, ¿apruebas?"
- "Hay 2 enfoques con trade-offs grandes en arquitectura, ¿prefieres A o B?"

## 9. SPECS COMPLETOS — RUBÉN NO DEBE COMPLETARLOS
**Cuando Claude (chat principal) escribe un spec en `.claude/plans/spec.md`, debe dejar TODAS las decisiones cerradas.**

Antes de cerrar un spec, Claude verifica:
1. Toda variable externa (titular, fecha, importe, ruta) tiene origen definido (UI, BD, parámetro, config)
2. Todo edge case tiene comportamiento decidido (NULL, vacío, duplicado, error)
3. Todo criterio CA tiene los datos necesarios para validarse en `qa-reviewer`

Si un spec deja huecos, el implementer va a parar a preguntar a Rubén → coste de tiempo y contexto. Mejor invertir 5 minutos extra en cerrar el spec que 10 minutos de ida y vuelta con el implementer.
