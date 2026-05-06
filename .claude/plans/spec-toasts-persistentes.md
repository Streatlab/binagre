# SPEC — Toasts persistentes en módulo Importar Facturas

## Contexto
Al subir lotes de facturas en módulo Importar Facturas, los toasts de progreso desaparecen al refrescar la página (F5) o al navegar. Rubén quiere que persistan hasta:
1. Que el usuario los cierre manualmente con el aspa, O
2. Que pasen 5 minutos desde su creación.

## Constantes
```ts
const TOAST_TTL_MS = 5 * 60 * 1000 // 5 minutos
const STORAGE_KEY = 'binagre_facturas_toasts'
```

## Criterios DADO/CUANDO/ENTONCES

### CA-1 · Persistencia tras F5
- DADO un toast de subida activo en pantalla
- CUANDO el usuario refresca la página (F5)
- ENTONCES el toast vuelve a aparecer en la misma posición con la misma información, hasta que se cumpla CA-2 o CA-3.

### CA-2 · Auto-cierre a los 5 minutos
- DADO un toast con timestamp de creación
- CUANDO han pasado 5 minutos desde la creación
- ENTONCES el toast se cierra automáticamente y se elimina del storage.

### CA-3 · Cierre manual con aspa
- DADO un toast en pantalla
- CUANDO el usuario hace click en el aspa de cerrar
- ENTONCES el toast desaparece y se elimina del storage. NO reaparece tras F5.

### CA-4 · Múltiples toasts coexistiendo
- DADO el usuario sube un lote, luego otro lote 30 segundos después
- CUANDO ambos están en proceso
- ENTONCES ambos toasts aparecen apilados y persisten independientemente.

### CA-5 · Actualización en tiempo real del progreso
- DADO un toast con contador "X de Y facturas procesadas"
- CUANDO el backend actualiza estados de facturas
- ENTONCES el toast se actualiza cada 3 segundos (polling) con los nuevos números.
- DADO refresco F5
- CUANDO se reanuda el toast
- ENTONCES retoma el polling automáticamente y sigue actualizando.

## Diseño técnico

### Persistencia (localStorage)
Estructura por toast:
```ts
interface ToastFactura {
  id: string                    // uuid del lote
  createdAt: number             // timestamp ms
  totalFacturas: number         // tamaño del lote
  facturaIds: string[]          // ids facturas del lote para polling
  cerradoManualmente: boolean
}
```

Guardar array de toasts en `localStorage[STORAGE_KEY]`.

### Hook `useToastsFacturas.ts` (NUEVO)
1. Al montar componente raíz: leer storage, filtrar toasts NO caducados (< 5 min) y NO cerrados manualmente.
2. Cada 3 segundos: polling al endpoint `/api/facturas?ids=...` para refrescar contadores de cada toast vivo.
3. Cada vez que se modifica el array de toasts: persistir a storage.
4. Cleanup: timeout que elimina toast al cumplir 5 min.

### Componente `ToastProgresoFactura.tsx` (NUEVO o modificar existente)
- Renderiza toast individual con:
  - Texto: "📥 X de Y facturas procesadas · Z pendientes"
  - Detalle: "✅ A asociadas · ⏳ B pendientes · ❌ C errores"
  - Botón aspa cierre
- Posición: bottom-right, apilados verticalmente con gap.

### Integración
- En `src/pages/finanzas/Facturas.tsx`: al iniciar lote, llamar `crearToast(facturaIds)`.
- En `App.tsx` o layout raíz: montar `<ToastsFacturasContainer />` para que persista entre navegaciones.

## No-objetivos
- NO usar Supabase Realtime (sobreingeniería para esto, polling es suficiente).
- NO sincronizar entre pestañas distintas del navegador (se acepta que cada pestaña tenga sus propios toasts en su storage).

## Validaciones
1. `npm run build` 0 errores.
2. Subir 10 facturas → toast aparece → F5 → toast sigue apareciendo y contador sigue actualizándose.
3. Esperar 5 minutos → toast desaparece solo.
4. Subir otro lote → cerrar con aspa → F5 → no reaparece.
5. Subir 2 lotes consecutivos → ambos toasts apilados.

## Cierre
git+pull. NO Vercel.
