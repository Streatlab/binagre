# RELEVO · Bloque V — COMPLETO (V1→V8)

> Documento de continuidad. Rama de trabajo: **`trabajo`** (nunca master, nunca PR).

## Estado: Bloque V CERRADO

Las 8 tandas (V1→V8) están completas y verificadas con gate verde (`tsc -b && vitest run && vite build`)
en cada commit. Resumen por tanda:

- **V1 · Finanzas**: `pages/finanzas/*` completo + `components/tesoreria/FondoReserva`,
  `components/panel/TabEvolucion`/`TabFinanzas` → 0 hex.
- **V2 · Portada y transversales**: Home, PanelGlobal, todo `components/panel/*`
  (incl. `resumen/tokens.ts` — módulo compartido, tokenizado con cuidado), Tareas,
  Command Palette → 0 hex.
- **V3 · Ventas y Clientes**: Marketing, Analytics (5), Clientes, `finanzas/Ventas` → 0 hex.
- **V4 · Cocina**: Escandallo completo (5 tablas + 6 modales + auxiliares), MenuFamilia,
  Pareto/MenuEngineering/CocinaInventario, chrome de Producción/Esquemas/ListaCompra/
  TabHojaInventario (hoja intacta, es marco) → 0 hex.
- **V5 · Compras**: `components/compras/*`, `components/inventario/*`, Proveedores,
  TabCostes → 0 hex (excepto el campo calculado oficial, ver abajo).
- **V6 · Operaciones + Equipo**: `pages/ops/*` (10 pantallas), `pages/equipo/*`,
  `components/equipo/*` (incl. Horarios) → 0 hex.
- **V7 · Ajustes**: `components/configuracion/*` (base compartida) + `pages/configuracion/*`
  (8 apartados: Usuarios, Bancos y Cuentas, Calendario, Aprendizajes, calcNeto, Mapeo
  Marcas, Reglas, Cocina/Cuentas) → 0 hex. Contenedor de Informes: ya estaba a 0
  (su contenido es zona prohibida, no se tocó).
- **V8 · Pieles de zona prohibida**: OCR (9 archivos), Conciliación
  (`TabMovimientos` + `ModalDetalleMovimiento`, solo los 2 nombrados), Importador
  (6 archivos) → 0 hex. **Cero líneas de lógica tocadas** en ninguno.

## Excepciones documentadas (correctas, no son huecos)

1. **Campo calculado oficial** (regla dura `.claude/CLAUDE.md` #4): `backgroundColor:'#2d1515', border:'1px solid #aa3030', color:'#ffaaaa'`.
   Aparece intacto en `TabConteos.tsx` (inventario) y era el único hex legítimo en
   `TareasOperativas.tsx` antes de mi paso — **nunca tocar este triplete exacto**.
2. **CSS embebido del marco** (`FICHA_CSS`/`PRINT_CSS`/`CSS` en `Produccion.tsx`,
   `ListaCompra.tsx`, `TabHojaInventario.tsx`, `TabFichas.tsx`): usa `var(--m-*)` +
   algunos `#fff`/`#111` fijos de impresión — es el sistema de marco, fuera de alcance.
3. **`src/lib/marcoDoc.ts`**: define los propios tokens `--m-*`; contiene hex porque
   ES la fuente de esos tokens. No tocar.

## Lo que queda FUERA del Bloque V (no era parte de las 8 tandas)

Un barrido global (`grep hex src/ fuera de styles/ y marco/`) tras cerrar V8 muestra
~53 archivos con hex restante. Se dejaron **deliberadamente sin tocar** porque no
pertenecen a ninguna de las 8 áreas numeradas (V1-V8) ni a los 2 archivos de
Conciliación explícitamente nombrados:

- **Chrome transversal fuera de las áreas**: `Sidebar.tsx`, `NavIcon.tsx`,
  `ThemeToggle.tsx`, `ToastSL.tsx`, `SidebarBadge.tsx`, `TabsPastilla.tsx`,
  `SortableHeader.tsx`, `EditableInline.tsx`, `SelectorFechaUniversal.tsx`,
  `IVAToggle.tsx`, `CardFiltro.tsx`, `MargenBanner.tsx`.
- **`src/mobile/*`** (LEY MÓVIL): `mapaMovil.ts`, `kit.tsx`, `pwa.tsx`,
  `usePanelMovil.ts`, `PantallasMovil.tsx`.
- **Zona prohibida fuera de la lista explícita de V8** (informes/robots/papeleo-
  mantenimiento — lógica Y piel intocables salvo lo ya nombrado): `Facturacion.tsx`,
  `PagosCobros.tsx`, `Conciliacion.tsx` (página contenedora, distinta de
  `TabMovimientos`/`ModalDetalleMovimiento`), `Ocr.tsx`, `BandejaEntrada.tsx`,
  `ResolverPendientes.tsx`, `ModalDescartarFactura.tsx`, `AvisosBandeja.tsx`,
  `ColaRevisionFichas.tsx`, `ChuletaPlataformas.tsx`, `Destinatarios.tsx`,
  `ConfiguracionInformes.tsx`.
- **Otros archivos sueltos de página/lib** con 1-8 hex cada uno: `Login.tsx`,
  `Carta.tsx`, `Escandallo.tsx`, `CocinaRecetas.tsx`, `PanelDireccion.tsx`,
  `Placeholder.tsx`, `BandejaPendientes.tsx`, `running.ts`, `calcPorCobrar.ts`,
  `impresion.ts`.

**Si una futura sesión quiere seguir puliendo**: el chrome transversal (Sidebar,
NavIcon, ThemeToggle, etc.) y `mobile/*` son candidatos naturales de "V9" o
ampliación de V2 (son fundacionales, no zona prohibida). Los archivos de zona
prohibida fuera de la lista de V8 **no deben tocarse** sin una orden explícita
nueva que los nombre, igual que se hizo con OCR/Conciliación/Importador en V8.

## Reglas vivas (kit v5-B) — para cualquier trabajo futuro

### Fuente de verdad del color
- Tokens estructurales y semánticos: **`src/styles/neobrutal.ts`** (theme-aware vía `var(--neo-*)`).
- `src/styles/kit.ts`: capa de compat + helpers (`cardWash`, `pill`, `chip`, `fmtPct`, `CANAL_TAG`).
- Componentes del kit: `src/components/kit/` → `HeroTocho`, `FraseHero`, `TabsContainer`.
- **`src/styles/palettes.ts`**: paletas de DATOS sin equivalente semántico en el kit
  (trimestres, festivos, canales, badges de estado, washes oscuros, etc.). Creado
  en V1, creció a ~90 tokens a lo largo de V1-V8. **Revisar este archivo antes de
  crear un token nuevo — puede que el color ya exista** (p.ej. `GRANATE`=`#B01D23`,
  `COBERTURA_VERDE`=`#1D9E75`, `CORP.glovo`/`CORP.je` para canales).
- Puentes Tailwind en `src/index.css` (`@theme`): para clases arbitrarias con hex
  (`bg-[#xxxxxx]`) que resultan ser snapshots congelados de tokens ya theme-aware
  (`--color-ink`→`var(--neo-ink)`, `--color-crema`→`var(--neo-bg)`) o valores fijos
  reutilizables (`--color-config-*`, `--color-margenok-bg`, etc.).

### Método por pantalla
a) Cabecera con patrón del molde. b) KPIs/cards con helpers del kit. c) Tablas:
cuerpo claro, cabecera/totales como banda oscura (`INK`+`CREMA`/`BLANCO`).
d) Botones/pills/pestañas/modales del kit. e) Cero maquetación heredada.
f) Cero hex al terminar. g) LEY MÓVIL.

### Conversión dark→kit claro
`background: INK` → `BLANCO`+`BORDER_CARD`+`SHADOW`. Texto `BLANCO`→`INK`. No
flipear cabeceras/totales (quedan oscuros). `isDark ? hex : hex` → sustituir por
el token de tema (`T.card`/`T.brd`) si existe, o por un par de tokens dedicados en
`palettes.ts` si no.

### Marco de documentos (NO tocar)
`HojaDoc` + tokens `--m-*`. Ya migradas: Producción, Esquemas, Lista de Compra,
Ficha EP/Receta. Archivos: `src/lib/marcoDoc.ts`, `src/components/marco/HojaDoc.tsx`.

### Zona prohibida (lógica intocable)
Robots, informes y sus envíos, WhatsApp, Papeleo-mantenimiento, crons, LEY_CONCILIACION,
LEY_NETO, marco. V8 tocó SOLO la piel de OCR/Conciliación(2 archivos)/Importador —
cualquier otra pantalla de zona prohibida necesita una orden explícita nueva.

## Gate
```
npx tsc -b && npx vitest run && npx vite build
```
Push con rebase (puede haber sesiones concurrentes):
```
git fetch origin trabajo && git rebase origin/trabajo && git push origin trabajo
```

## Siguiente bloque (según la orden original)
**E** (4 automatizaciones: alerta precio→margen, retención 48-72h, círculo venta→
escandallo→inventario→lista de compra, cargo sin factura), **R1** (barrido de
huérfanas/duplicados de la reconciliación), **F2** (verificar Running visual tras
el restyling — F1 y F3 ya cerrados con fix/test). Bloque V terminado, no se toca
salvo pulido opcional del chrome transversal listado arriba.
