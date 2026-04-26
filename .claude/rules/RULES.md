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

## 3. Cadena de deploy obligatoria
Todo prompt o tarea de fix termina con:
```bash
git add . && git commit -m "..." && git push origin master && npx vercel --prod && git pull origin master
```
Sin la cadena completa, el fix no está cerrado.

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
