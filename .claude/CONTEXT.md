# CONTEXT.md — Cache de inicio (Binagre)

Se inyecta al arrancar cada sesion Claude Code. Aprovecha cache 90% en input tokens.

## Tokens canonicos
Rojo #B01D23, Negro #0a0a0a, Sidebar #1e2233, Panel #e8f442, Modal #484f66. Importar siempre desde src/styles/tokens.ts.

## Aislamiento
NUNCA tocar Supabase de David. NUNCA importar #16355C, #F26B1F. NUNCA mezclar logica Cade/Mercadona/Lidl/Carrefour/Dia.

## Format
es_ES. Coma decimal. fmtEur() desde src/lib/format.ts. IF SQL con `;`.

## Pipeline
pm-spec (Sonnet) -> architect-review (Opus) -> implementer (Sonnet) -> qa-reviewer (Haiku) -> integrator (Haiku) -> qa-visual (Haiku).

## Stack
Next.js + Supabase + Tailwind v4 + Vercel. Streatlab/binagre. binagre.vercel.app.
