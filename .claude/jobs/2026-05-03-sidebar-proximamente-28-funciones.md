# Job: añadir 28 funciones a sección PRÓXIMAMENTE del sidebar

## Contexto
Tras análisis de los 20 ERPs/TPV hostelería más relevantes del mercado (España + globales), se han identificado 33 funciones recurrentes. De ellas, 5 ya estaban en el array `PROXIMAMENTE` del sidebar (Predicción Demanda, Tienda en Línea, Club Fidelización, CRM Tienda Propia, Pedidos a Proveedores). Las 28 restantes deben añadirse al final del array como nuevas entradas placeholder no clicables.

## Archivo
`src/components/Sidebar.tsx`

## Fix exacto

Buscar el array `PROXIMAMENTE` y añadir las 28 nuevas entradas justo antes del cierre `]` del array, después de la última entrada actual (`{ label: 'Integraciones', emoji: '🔌' },`).

Buscar este bloque exacto:

```tsx
  { label: 'Integraciones',                emoji: '🔌' },
]
```

Reemplazar por:

```tsx
  { label: 'Integraciones',                emoji: '🔌' },
  // ── Nuevos (análisis ERPs hostelería 2026) ──
  { label: 'Alérgenos',                    emoji: '🥜' },
  { label: 'Alertas Caducidad',            emoji: '⏰' },
  { label: 'Automatización Impuestos',     emoji: '🧾' },
  { label: 'BI / Informes Avanzados',      emoji: '📈' },
  { label: 'Caja',                         emoji: '💵' },
  { label: 'Combos y Promociones',         emoji: '🎁' },
  { label: 'Control Mermas',               emoji: '📉' },
  { label: 'Control Presencia / Fichaje',  emoji: '🕒' },
  { label: 'Email Marketing',              emoji: '✉️' },
  { label: 'Estadísticas Horas Punta',     emoji: '📊' },
  { label: 'Exportación a Gestoría',       emoji: '📤' },
  { label: 'Gestión Clientes',             emoji: '👥' },
  { label: 'Gestión Impuestos',            emoji: '🧮' },
  { label: 'Menús Dinámicos',              emoji: '🍴' },
  { label: 'Gestión Pedidos',              emoji: '🧾' },
  { label: 'Stock e Inventario',           emoji: '📦' },
  { label: 'Informes Financieros',         emoji: '💼' },
  { label: 'Informes de Ventas',           emoji: '📑' },
  { label: 'Integración Delivery',         emoji: '🛵' },
  { label: 'Inventario Tiempo Real',       emoji: '📡' },
  { label: 'Marketing Automation',         emoji: '🤖' },
  { label: 'Notificaciones Empleados',     emoji: '🔔' },
  { label: 'Pagos Proveedores Auto',       emoji: '💸' },
  { label: 'Panel KPIs Global',            emoji: '📊' },
  { label: 'Planificación Turnos',         emoji: '🗓️' },
  { label: 'Pop-ups y Dark Kitchens',      emoji: '🏪' },
  { label: 'Predicción Plantilla',         emoji: '👥' },
  { label: 'Promociones por Día/Hora',     emoji: '⏰' },
]
```

## Reglas
- NO modificar las 60 entradas actuales del array `PROXIMAMENTE`. Solo añadir las 28 nuevas al final.
- NO duplicar entradas existentes. Las 5 que ya existían (Predicción Demanda, Tienda en Línea, Club Fidelización, CRM Tienda Propia, Pedidos a Proveedores) NO se vuelven a añadir.
- NO tocar ningún otro archivo del repo.
- Mantener el comentario `// ── Nuevos (análisis ERPs hostelería 2026) ──` como separador para futura referencia.

## Verificación
1. Ejecutar `npm run build`. Debe terminar sin errores TS.
2. Confirmar que el array `PROXIMAMENTE` pasa de 60 a 88 entradas.

## Commit
```
feat(sidebar): añadir 28 funciones a PRÓXIMAMENTE desde análisis ERPs hostelería 2026
```
