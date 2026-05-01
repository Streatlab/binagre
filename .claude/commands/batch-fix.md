# /batch-fix — Skill

Agrupa multiples fixes pequenos en una sola spec.

## Cuando usar
Cuando hay 3+ fixes del mismo modulo o area.

## Beneficio
- 1 build + 1 deploy en vez de N.
- Ahorro 80% tiempo.

## Como
1. pm-spec lista todos los fixes en una sola spec.
2. implementer los aplica todos en paralelo si son independientes.
3. qa-reviewer valida el conjunto.
4. integrator hace 1 commit y 1 push.
5. qa-visual valida cada fix en produccion.

## Limite
Maximo 5 fixes por batch. Mas genera mas riesgo que ahorro.
