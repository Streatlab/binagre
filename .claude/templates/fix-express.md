# Plantillas Fix Express — Binagre

Specs de 5 lineas para fixes recurrentes. Saltan pm-spec largo.

## 1. Cambio de color
```
DADO: componente X usa color Y
CUANDO: aplicar token Z desde tokens.ts
ENTONCES: color cambia a Z, sin hex hardcoded, build pasa
```

## 2. Cambio de copy
```
DADO: texto "antiguo" en path X
CUANDO: reemplazar por "nuevo"
ENTONCES: copy aparece en produccion, sin afectar markup
```

## 3. Fix modal
```
DADO: modal X con problema Y
CUANDO: aplicar patron canonico /fix-modal
ENTONCES: modal cumple patron SL, scroll OK, botones OK, Esc cierra
```

## 4. Cambio cifra/numero
```
DADO: valor X = N en path P
CUANDO: cambiar a M
ENTONCES: valor M aparece en produccion
```

## 5. Fix formato euro
```
DADO: euros formateados manualmente en X
CUANDO: usar fmtEur() desde src/lib/format.ts
ENTONCES: formato consistente es_ES
```

## 6. Cambio de query Supabase
```
DADO: query Q en path P
CUANDO: ajustar a Q' segun escandallo/EPS
ENTONCES: datos correctos en componente, sin errores 500
```

## 7. Anadir columna en tabla
```
DADO: tabla T en modulo M
CUANDO: anadir columna C entre X e Y
ENTONCES: columna visible, datos correctos, ordenable si aplica
```

## 8. Validacion de input
```
DADO: input I en formulario F
CUANDO: anadir validacion V
ENTONCES: error visible si no cumple V, no envia si invalido
```

## 9. Fix responsive
```
DADO: componente C rompe en breakpoint B
CUANDO: aplicar clases tailwind para B
ENTONCES: layout correcto en B, sin afectar otros breakpoints
```

## 10. Fix permisos/acceso
```
DADO: ruta R con problema de acceso
CUANDO: ajustar middleware/RLS
ENTONCES: solo usuarios autorizados acceden, sin errores
```
