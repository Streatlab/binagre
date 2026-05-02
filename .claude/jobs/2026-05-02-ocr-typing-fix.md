# Job: fix 2 errores TS implicit any en Ocr.tsx

## Contexto
El archivo `src/pages/Ocr.tsx` tiene 2 errores TS que rompen el build:
- src/pages/Ocr.tsx(194,35): error TS7006: Parameter 'f' implicitly has an 'any' type.
- src/pages/Ocr.tsx(196,35): error TS7006: Parameter 'f' implicitly has an 'any' type.

## Fix exacto
En `src/pages/Ocr.tsx`, dentro de `cargarPagina`, hay un bloque así:

```tsx
let filtradas = mapped
if (filtroCard === 'conciliadas') {
  filtradas = mapped.filter(f => calcularEstado(f) === 'conciliado')
} else if (filtroCard === 'sin_conciliar') {
  filtradas = mapped.filter(f => calcularEstado(f) === 'pendiente')
}
```

Cambiarlo a (anotar `f` con tipo `Factura`):

```tsx
let filtradas: Factura[] = mapped
if (filtroCard === 'conciliadas') {
  filtradas = mapped.filter((f: Factura) => calcularEstado(f) === 'conciliado')
} else if (filtroCard === 'sin_conciliar') {
  filtradas = mapped.filter((f: Factura) => calcularEstado(f) === 'pendiente')
}
```

Adicionalmente, justo antes en la misma función, declarar `mapped` así (tipo explícito):

Buscar:
```tsx
const mapped = (data ?? []).map((m: any): Factura => ({
```

Cambiar a:
```tsx
const mapped: Factura[] = (data ?? []).map((m: any) => ({
```

## Verificación
1. Ejecutar `npm run build`. Debe terminar sin errores.

## Commit
```
fix(ocr): tipar mapped y filter callbacks como Factura para satisfacer TS
```
