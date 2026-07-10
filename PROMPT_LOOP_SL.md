# PROMPT CLAUDE CODE · MIGRACIÓN VISUAL TOTAL BINAGRE → LEY VISUAL SL
# Repo: Streatlab/binagre · Branch: trabajo (NUNCA master) · Modo: loop hasta terminar

## CONTEXTO
El ERP Binagre abandona el estilo Neobrutal Food-Pop. El nuevo sistema oficial es
**LEY VISUAL SL**: estilo Toast adaptado a la identidad corporativa de Streat Lab.
Manual completo en Notion (CEREBRO-SL > "LEY VISUAL SL — Sistema de diseño Binagre ERP v1").
Mock de referencia validado por Rubén: componentes hero / KPI / gráfico / barras / tabla.

## BLOQUE 0 · TOKENS (ya creado: src/styles/streatlab.ts — verificar y completar carga de fuentes)
- Añadir Nunito (600,700,800,900) y JetBrains Mono (600,700,800) a la carga de fuentes global.
- Definir variables CSS globales duales (light/dark) en el punto de entrada de estilos, con
  toggle de modo oscuro persistido (localStorage) — si ya existe ThemeToggle.tsx, adaptarlo.
- `src/styles/neobrutal.ts` NO se borra todavía: marcar como @deprecated en cabecera.

## BLOQUE 1 · COMPONENTES BASE COMPARTIDOS
Migrar primero (todo lo demás los reutiliza):
- src/components/Layout.tsx, Sidebar.tsx, NavIcon.tsx, ThemeToggle.tsx
- src/components/KpiCard.tsx y KpiCardGrande.tsx → patrón KPI de LEY VISUAL SL:
  card blanca, borde 1px LINE, radio 18, icono 36px en soft de color, número JetBrains Mono
  30px tabular, delta en píldora soft semántica, sparkline opcional ROJO_SL.
- src/components/ResponsiveTables.tsx y src/components/ui/* → patrón tabla:
  cabecera mayúsculas 11px GRIS_CL borde inferior 2px, **filas alternas ZEBRA**, hover HOVER,
  importes a la derecha en mono tabular, píldoras estado con puntito
  (ok=VERDE, pendiente=ROJO_SEM, revisar=AMBAR), primera columna peso 700.

## BLOQUE 2 · MIGRACIÓN MASIVA POR MÓDULOS (loop)
Recorrer TODOS los .tsx bajo `src/pages/**` y `src/components/**` (glob completo; inventario
de referencia: raíz de pages — Dashboard, Facturacion, FacturacionMobile, Conciliacion, Ocr,
POS, PagosCobros, PanelDireccion, PanelGlobal, Proveedores, Carta, CocinaInventario,
CocinaRecetas, Escandallo, ImportarVentas, Marcas, Equipo, Tareas, BandejaPendientes, Login,
Placeholder, OcrConToast — y subcarpetas: finanzas/ (23 archivos, incl. Cashflow, Objetivos,
PuntoEquilibrio, Gestoria, GestionFacturas, Running, Ventas, EstadosFinancieros,
Tesoreria13Semanas, PyG, RoiCanal, TicketMedio, PanelAlertas...), marketing/, equipo/,
cocina/, ops/, informes/, clientes/, analytics/, stock/, integraciones/, configuracion/ y
components/: alerts, compras, conciliacion, configuracion, documentacion, equipo, escandallo,
facturas, importador, inventario, ocr, panel, tareas, ui).

En cada archivo, sustituir el patrón Neobrutal por LEY VISUAL SL:
1. Imports de neobrutal.ts (OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA,
   VERDE, ROJO, GRIS, eyebrow) → equivalentes de streatlab.ts.
2. Bordes negros/INK de 2px+ y sombras duras desplazadas (Xpx Xpx 0) → borde 1px LINE +
   SHADOW suave. Radios → 18px cards / 999 píldoras.
3. Fondos crema/claro antiguos → CANVAS; celdas de color → blanco CARD (color solo en
   valores semánticos y píldoras soft).
4. Cabeceras INK oscuras de tabla → cabecera clara mayúsculas GRIS_CL + zebra ZEBRA.
5. Números: envolver KPIs, importes, porcentajes y celdas numéricas con FONT_NUM +
   tabular-nums. Alinear importes a la derecha.
6. Heros/cabeceras de módulo → degradado ROJO_DEEP→NARANJA_SL con titular Nunito 900 y
   dato principal en mono blanco (donde el módulo tenga cabecera destacada).
7. Gráficos Recharts: línea/área principal ROJO_SL con área degradada naranja; series
   secundarias AMARILLO_SL / NARANJA_SL / VERDE; grid LINE; nunca colores neobrutal.
8. Responsive: mantener/añadir 880px (2 col KPIs, 1 col grid, hero apilado) y 480px
   (1 col, tabla scroll-x min-width 520px).
9. Modo oscuro: todo color vía token dual, jamás hex suelto.

## BLOQUE 3 · LIMPIEZA Y DOCUMENTACIÓN
- Cuando NINGÚN archivo importe ya neobrutal.ts: moverlo a src/styles/_legacy/ y dejar
  stub con re-export de streatlab.ts para no romper imports olvidados.
- Crear docs/LEY_VISUAL_SL.md con el contenido del manual (tokens y reglas).
- Actualizar docs/LEY_IMPRESION.md solo si referencia colores neobrutal (sustituir por SL).

## REGLAS DEL LOOP
- Todo a branch `trabajo`. NUNCA master. Commits pequeños por módulo:
  "LEY VISUAL SL: migrar <módulo>".
- Validar cada .tsx antes de commit:
  npx -y esbuild archivo.tsx --loader:.tsx=tsx --jsx=automatic --outfile=/dev/null
- No tocar lógica de negocio, queries, ni props funcionales: SOLO estilo.
- NO tocar: src/pages/api/**, nada de erp-david, migraciones, Supabase.
- Si un archivo supera 15KB y falla la edición directa: clonar a /tmp, editar con
  python/sed, push vía git bash.
- Checklist de progreso en MIGRACION_SL.md en la raíz (módulo → estado), actualizado en
  cada iteración. Loop hasta que TODOS los archivos del glob estén migrados.
- Al terminar: build completo; si build OK, commit final "LEY VISUAL SL: migración completa".

## CRITERIO DE ÉXITO
1. `grep -r "neobrutal" src/` solo devuelve el stub _legacy.
2. Build sin errores.
3. Dashboard, Facturación, Conciliación, Cashflow y Running renderizan con el nuevo
   sistema (hero llama, KPIs mono, zebra naranja, modo oscuro cálido).
