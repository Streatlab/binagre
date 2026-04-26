# CLAUDE.md — Binagre ERP (Streat Lab)

## Proyecto
ERP web de Binagre, marca portfolio principal de Streat Lab (dark kitchen Madrid).
Multi-marca virtual delivery: Uber Eats, Glovo, Just Eat, tienda online, Rushour como agregador.

## Stack
- Next.js + Supabase + Tailwind v4 + Vercel
- URL prod: https://binagre.vercel.app
- Default branch: master
- Path local Rubén (casa): C:\streatlab-erp

## Aislamiento absoluto Binagre ↔ David
NUNCA tocar repo erp-david, su Supabase ni sus tokens (#16355C, #F26B1F) desde aquí.
Si una tarea menciona David, Cade, Marino+Fuego, Mercadona/Lidl/Carrefour/Día → STOP.

## Design tokens canónicos
- Rojo principal: #B01D23
- Sidebar: #1e2233
- Panel global: #e8f442
- Modal: #484f66
- Negro: #0a0a0a
Archivos master: src/styles/tokens.ts, src/styles/design-tokens.css

## Lógica de negocio integrada
Escandallo (EPS, IDING, INGREDIENTES), recetas, mermas, Menú Engineering.
Ya NO es Apps Script, todo vive dentro del ERP.

## Cadena git+vercel obligatoria
git add . && git commit -m "..." && git push origin master && npx vercel --prod && git pull origin master

## Pipeline
.claude/agents/ → 4 subagentes: pm-spec, architect-review, implementer, qa-reviewer
.claude/plans/ → spec.md, adr.md, tasks.md, summary.md por fix activo
.claude/rules/ → reglas duras (aislamiento, tokens, deploy)

## Comunicación con Rubén
Modo corto por defecto. Listas numeradas. Sin preámbulo. Confirmaciones de una línea.
