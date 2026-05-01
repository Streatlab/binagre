# /fix-color — Skill

Patron estandar para cambiar un color o token visual.

## Cuando usar
Cambio de color en cualquier componente. Ajuste de paleta. Aplicacion de token.

## Reglas duras
1. NO hex hardcoded en componentes. Siempre desde src/styles/tokens.ts.
2. Si el color no existe en tokens.ts, anadirlo alli primero, luego usarlo.
3. Tailwind v4: usar `bg-[var(--token-rojo)]` o variantes definidas en design-tokens.css.

## Tokens disponibles Binagre
- tokens.rojo = #B01D23
- tokens.negro = #0a0a0a
- tokens.sidebar = #1e2233
- tokens.panelGlobal = #e8f442
- tokens.modal = #484f66

## Pipeline reducido
implementer + qa-reviewer + qa-visual. Sin pm-spec ni ADR.

## Skip QA si
Cambio < 5 lineas y solo toca un color hex -> directo a integrator.
