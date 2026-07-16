# BUG URGENTE · viola LEY-ANTIFALSOS-01

Al usar nombres oficiales largos/específicos (columna `nombre_super`, ej. "Cebolla blanca fresca", "Harina para freír", "Tiras de pimiento asado con ajo"), el emparejador por subcadena está devolviendo `estado_match='ok'` con productos que NO tienen relación real:

- "Cebolla blanca fresca" → casó con "Pasta fresca ravioli rellena de calabaza con cebolla Hacendado" (marcado ok, cargó precio)
- "Harina para freír" → casó con "Patatas especial para freír" (marcado ok, cargó precio)
- "Tiras de pimiento asado con ajo" → casó con "Hummus de garbanzos Hacendado con pimiento del piquillo asado" (marcado ok, cargó precio)

Esto es peor que quedar en `dudoso`: carga un precio incorrecto sin aviso, violando LEY-ANTIFALSOS-01 (bloqueante, docs/LEY_ANTIFALSOS.md).

## Sospecha
`mejorCoincidencia` con `porSubcadena` probablemente está haciendo match por solape de tokens sueltos, no por subcadena literal completa — con consultas largas de varias palabras, basta con que el producto contenga alguna palabra suelta (o el orden desordenado) para "colar". Revisar `normalizar()` + el filtro `includes(consultaNorm)`: confirmar que compara la CADENA COMPLETA normalizada, no tokens sueltos.

## Pide
1. Revertir a `dudoso` (no `ok`) cualquier match donde la confianza no sea alta — mejor pecar de cauto.
2. Antes de cerrar, corre estos 3 casos de prueba y confirma que NO casan como "ok": "Cebolla blanca fresca", "Harina para freír", "Tiras de pimiento asado con ajo" contra el catálogo real. Si el algoritmo no puede diferenciarlos con confianza, deben quedar `dudoso`.
3. Revisa también si algún otro `ok` de la tirada anterior tiene el mismo problema (falso positivo silencioso) — auditar los 219 "ok" actuales sería ideal, o al menos loguear el score de confianza para poder filtrar.
