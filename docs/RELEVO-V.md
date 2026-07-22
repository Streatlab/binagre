# RELEVO · Bloque V (restyling visual al kit v5-B)

> Documento de continuidad. Lo escribe la sesión que se agota para que la siguiente
> retome sin perder contexto. Rama de trabajo: **`trabajo`** (nunca master, nunca PR).

## Última pantalla terminada
**V1 · Finanzas — todo `src/pages/finanzas/` a CERO hex y al kit.** Migradas en esta tanda:
1. Papeleo·**Gestor Documental** (`GestionFacturas.tsx`) — estados de factura a lavados del kit; árbol Drive a `palettes.ts`.
2. Papeleo·**Gestoría** (`Gestoria.tsx`) — conversión dark→kit claro completa.
3. **Objetivos** (`Objetivos.tsx`) — theme-aware por `T.*`; tintes de día a `palettes.ts`. (Además arreglado bug F1: guardado de presupuestos idempotente.)
4. **PyG** (`PyG.tsx`) — dark→kit claro.
5. **Running / TicketMedio / PanelAlertas / PanelInteligenciaVentas** — hex sueltos a tokens.
6. Chrome de pestañas de **VentasPage / TesoreriaPage / ResultadosPage / RentabilidadPage** → `var(--sl-yellow)` / `var(--sl-text-nav)`.
7. **Ventas / Cashflow / PuntoEquilibrio** — chips de canal, paletas terrosas y de grupo a tokens.

Comprobación: `grep -rInE "#[0-9a-fA-F]{3,6}" src/pages/finanzas` → **0**.

## Siguiente pantalla (retomar aquí)
V1 aún tiene sus **componentes** (no las páginas) con hex. Por orden de peso:
1. `src/components/tesoreria/FondoReserva.tsx` (~50 hex) — pestaña Tesorería·Fondo & Reserva.
2. Resto de Tesorería (`src/components/tesoreria/*`, `src/pages/finanzas/TesoreriaPage` ya hecho).
3. Estados Financieros: componentes de `ResultadosPage` (P&G ya en `PyG.tsx`; faltan Estados/Evolución en `src/components/panel/*`).
4. `src/components/panel/resumen/tokens.ts` (22 hex) — **OJO**: es un módulo de tokens compartido (`COLORS`, `FONT`). Tokenízalo/muévelo a `src/styles/` con cuidado: lo usan MUCHAS pantallas.
5. Panel de Alertas (la página ya está; revisar su componente si tiene hex).

Luego seguir el orden fijado: **V2** (Home/"Hoy", Panel Global, Tareas, Command Palette) → V3 Ventas y Clientes → V4 Cocina → V5 Compras → V6 Operaciones → V7 Ajustes → V8 pieles.
Nota: hay **otra sesión trabajando EQUIPO (V6)** en paralelo sobre `trabajo`. Coordina para no colisionar; haz rebase antes de cada push.

## Reglas vivas (kit v5-B)

### Fuente de verdad del color
- Tokens estructurales y semánticos: **`src/styles/neobrutal.ts`** (theme-aware vía `var(--neo-*)`). `src/styles/kit.ts` es la capa de compat (reexporta + helpers `cardWash`, `pill`, `chip`, `fmtPct`, `CANAL_TAG`).
- Componentes del kit: `src/components/kit/` → `HeroTocho`, `FraseHero` (+ `Resaltado`, `Sub`), `TabsContainer`.
- **Paletas de DATOS** (colores que codifican datos/estado sin equivalente semántico en el kit: trimestres, festivos, canales, grises de PDF, tablas terrosas): van a **`src/styles/palettes.ts`** (creado en esta tanda). Así el componente queda a 0 hex y el color vive en `src/styles/` (que el grep de cierre excluye).

### Método por pantalla (idéntico siempre)
a) Cabecera con patrón del molde (título, frase insight, acciones).
b) KPIs/cards con helpers del kit (`cardWash`, `card`, `HeroTocho`), no cards artesanales.
c) Tablas: cuerpo claro; cabecera y filas de totales como **banda oscura** (`background: INK` + texto `CREMA`/`BLANCO`) — patrón usado en Gestoría y PyG.
d) Botones/pills/pestañas/modales del kit. Botón guardar `GRANATE`/blanco; secundario/Cancelar `CLARO` + `BORDER_FINO`.
e) Cero maquetación heredada: adaptar al patrón más cercano del molde.
f) **Cero hex al terminar**: cada hex → token. Si no hay token, créalo en `neobrutal.ts` (estructural/semántico) o `palettes.ts` (dato).
g) Móvil: LEY MÓVIL (una columna, táctil, sin scroll horizontal).

### Conversión dark→kit claro (patrón probado en Gestoría/PyG)
- `background: INK` (card oscura) → `BLANCO` + `BORDER_CARD` + `boxShadow: SHADOW`.
- Texto `BLANCO` sobre card → `INK`. `color: GRIS` (muted) se mantiene.
- **No** flipear cabeceras `thead` ni filas de totales: se dejan oscuras (banda de énfasis del kit).
- Pares theme-aware `isDark ? '#dark' : '#light'` → usar el token de tema `T.card` / `T.brd` (de `useTheme()`), que ya es theme-aware.
- Acentos `LIMA` como TEXTO sobre fondo claro → no contrastan: usar `NAR`/`AMA` (estimado) o `INK`. `LIMA` sí vale sobre banda oscura o como fondo de badge con texto `INK`.

### Marco de documentos (NO usar el kit)
Toda superficie imprimible va con `HojaDoc` + tokens `--m-*`, nunca el rojo de marca dentro de la hoja. Ya migradas (no pisar): Producción, Esquemas, Lista de Compra, Ficha EP/Receta. Archivos marco: `src/lib/marcoDoc.ts`, `src/components/marco/HojaDoc.tsx`.

### Zona prohibida (lógica intocable; SOLO su piel visual)
Robots (Uber/Glovo/JustEat/Rushour/Sinqro/ingesta/turno), informes y sus envíos, WhatsApp, Papeleo-mantenimiento (Resolver pendientes/Drive/OCR/dormidos), crons de `vercel.json`, `.github/workflows`, `auto_match_factura` + LEY_CONCILIACION, `netoResolver.ts` + LEY_NETO, `src/lib/marcoDoc.ts`, `src/components/marco/HojaDoc.tsx`.
En V8 se toca SOLO la piel de: OCR/subida, Conciliación (`TabMovimientos`, `ModalDetalleMovimiento`), Importador. Si piel y lógica están mezcladas, cambiar solo estilos; ante la duda, no tocar y anotar.

### Aislamiento
Binagre nunca toca David/Cade ni sus tokens (`#16355C`, `#F26B1F`) ni su Supabase (`idclhnxttdbwayxeowrm`).

## Gate (verde antes de cada commit `[deploy]`)
```
npx tsc -b && npx vitest run && npx vite build
```
Commits pequeños, uno por pantalla. Push con rebase (sesión concurrente activa):
```
git fetch origin trabajo && git rebase origin/trabajo && git push origin trabajo
```

## Estado numérico (al cerrar esta sesión)
- `src/pages/finanzas/`: **0 hex**.
- Global `src/` (fuera de `styles/` y `marco/`): ~**184 archivos** con hex aún. Zonas top pendientes: `pages/configuracion` (26), `components/escandallo` (18), `components/configuracion` (14), `components/panel` (11), `pages/ops` (10).
- Bugs: **F1 cerrado**. F2 (Running visual) y F3 (Alt+K, ya con test `tests/palette-destinos.test.ts`) — F3 verificado; F2 pendiente de repaso visual. R2 cubierto por test. E1–E4 y R1 quedan para después de V.
