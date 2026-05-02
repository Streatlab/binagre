# Job: Fix build OCR — errores TypeScript

## Contexto
Tras el deploy del job anterior (`2026-05-02-modulo-ocr.md`), Vercel está rompiendo el build con estos errores:

```
src/App.tsx(203,77): error TS2304: Cannot find name 'Importador'.
src/pages/Ocr.tsx(387,13): error TS2322: 'onCambio' does not exist on type SelectorFechaUniversalProps.
src/pages/Ocr.tsx(387,24-38): error TS7006: parámetros desde/hasta/label tipo 'any' implícito.
```

## Fixes a aplicar

### 1. `src/App.tsx` línea 203
Cambiar:
```tsx
<Route path="importador" element={<ProtectedRoute solo={['admin']}><Importador /></ProtectedRoute>} />
```

Por:
```tsx
<Route path="importador" element={<Navigate to="/ocr" replace />} />
<Route path="ocr" element={<ProtectedRoute solo={['admin']}><Ocr /></ProtectedRoute>} />
```

(El componente `Importador` ya no existe, se sustituye por redirect a la nueva ruta `/ocr` y se añade la ruta `/ocr` apuntando al nuevo componente `Ocr` ya importado en línea 60.)

### 2. `src/pages/Ocr.tsx` línea 387
El componente `SelectorFechaUniversal` usa la prop `onChange`, no `onCambio`. Hay que mirar la firma real en `src/components/ui/SelectorFechaUniversal.tsx` y replicar el uso EXACTO que hace `Conciliacion.tsx`:

```tsx
<SelectorFechaUniversal
  nombreModulo="ocr"
  defaultOpcion="mes_en_curso"
  onChange={(desde, hasta, label) => {
    setPeriodoDesde(desde)
    setPeriodoHasta(hasta)
    setPeriodoLabelSFU(label)
  }}
/>
```

Es decir: cambiar `onCambio` → `onChange`. Los tipos de los parámetros vienen de la prop, no son `any` implícito una vez que el nombre es correcto.

## Validación
1. Build de Vite limpio: `npm run build` debe pasar sin errores TS.
2. Verificar que `/ocr` carga y `/importador` redirige a `/ocr`.
3. Verificar que el SelectorFechaUniversal funciona en OCR igual que en Conciliación.

## Cierre
Commit con mensaje:
```
fix(ocr): elimina referencia Importador en App.tsx + onCambio→onChange en SelectorFechaUniversal
```
