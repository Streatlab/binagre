# CLAUDE.md — Binagre ERP (Streat Lab)

Este archivo es la Constitución del proyecto. Máx 30 líneas.
Para detalle, ver `.claude/rules/` y `.claude/plans/active-plan.md`.

## Stack
- Next.js + Supabase + Tailwind v4 + Vercel
- URL prod: https://binagre.vercel.app
- Repo: github.com/Streatlab/binagre

## Design tokens (canónicos, nunca hardcodear otros)
- Rojo principal: #B01D23
- Negro: #0a0a0a
- Sidebar: #1e2233
- Panel global: #e8f442
- Modal: #484f66
- Master: src/styles/tokens.ts, src/styles/design-tokens.css

## Aislamiento absoluto Binagre ↔ David
- NUNCA tocar Supabase de David (idclhnxttdbwayxeowrm)
- NUNCA importar tokens Marino+Fuego (#16355C, #F26B1F)
- NUNCA mezclar lógica de negocio (rutas Cade, Mercadona/Lidl/Carrefour/Día)

## Pipeline obligatorio (ver .claude/plans/active-plan.md)
1. pm-spec → 2. architect-review → 3. implementer (ctx bifurcado) → 4. qa-reviewer → 5. integrator
- Cada etapa produce un archivo en `.claude/plans/`
- Commit antes de cada etapa
- Code NUNCA pregunta a Rubén durante ejecución
