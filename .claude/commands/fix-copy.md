# /fix-copy — Skill

Cambio de texto/copy en componentes.

## Pipeline express
Si el cambio es solo de strings y < 10 lineas:
1. implementer (Sonnet) edita.
2. qa-visual valida que el copy aparece en produccion.
3. Skip qa-reviewer.

## Reglas
- Texto en es_ES.
- No alterar markup ni clases.
- Si el copy va en multiple sitios, buscar todas las ocurrencias antes.
