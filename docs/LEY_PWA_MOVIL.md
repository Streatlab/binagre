# LEY DEL PWA MÓVIL · Binagre / Streat Lab

Norma de obligado cumplimiento para el móvil. Vive junto a `docs/LEY_MOVIL.md`
(responsive) y la amplía: define **cómo se traduce TODO el ERP a la app móvil**.

---

## 0. Regla de oro

**El móvil es el MISMO ERP, con otra piel.**
No hay una "app móvil" con sus propias pantallas ni sus propios datos. Hay una
sola aplicación. En móvil se le pone una **chrome** distinta (Cantera Alegre:
pergamino, dock Mac, nube de palabras, sol/luna) y dentro se renderizan las
**pantallas reales del ERP**, con sus pestañas y subpestañas nativas.

Consecuencia directa: **cualquier cambio en el ERP de escritorio aparece idéntico
en el móvil sin tocar nada del móvil.** Si no es así, algo se ha duplicado y está
mal.

---

## 1. Las tres piezas

| Pieza | Archivo | Qué hace |
|---|---|---|
| Detección | `src/hooks/useEsMovil.ts` | Decide móvil vs escritorio |
| Reparto | `src/components/Layout.tsx` | Si es móvil → `AppMovil`; si no → sidebar de siempre |
| Piel móvil | `src/mobile/AppMovil.tsx` | La chrome: topbar, dock, nube, sol/luna. El contenido es `<Outlet/>` (pantallas reales) |
| **Navegación (única)** | `src/nav/navModel.ts` | **Fuente ÚNICA** de módulos. La leen el sidebar Y el móvil |

**No hay más.** No existe `mapaMovil.ts`, ni `ShellMovil`, ni pantallas móviles
duplicadas. Se retiraron a propósito.

---

## 2. Fuente única de navegación — `src/nav/navModel.ts`

Es el corazón del "cero duplicación". Exporta:

- `SECTIONS` — las 6 secciones del ERP (Finanzas, Cocina, Operaciones, Compras,
  Ventas y Clientes, Ajustes) con sus módulos.
- `SECTION_ICONS` — color e icono de cada sección (paleta Cantera Alegre).
- `DIRECTOS` — accesos directos del dock (Hoy, Panel, Tareas).
- Helpers: `seccionesVisibles(perfil)`, `tituloDeRuta(pathname)`.

**Lo consumen a la vez:**
- `src/components/Sidebar.tsx` (escritorio)
- `src/mobile/AppMovil.tsx` (móvil)

### Cómo añadir / mover / renombrar un módulo (única vía correcta)
1. Editas **solo** `SECTIONS` (o `DIRECTOS`) en `src/nav/navModel.ts`.
2. Aparece automáticamente en el sidebar de escritorio **y** en el dock/nube del
   móvil, con el mismo texto, ruta y perfil.
3. **Nunca** vuelvas a declarar módulos dentro de `Sidebar.tsx` ni de `AppMovil.tsx`.

### Pestañas y subpestañas
No se listan en `navModel`. Viven dentro de cada pantalla (su `TabsContainer`).
En móvil se renderiza la pantalla real, así que sus pestañas salen solas. Cambiar
una pestaña en el ERP la cambia también en móvil sin tocar nada del móvil.

---

## 3. Piel móvil — `src/mobile/AppMovil.tsx`

Traducción 1:1 del mockup de Claude Design "Binagre Mobile":

- **Tokens:** pergamino `#FCEFD6` (oscuro `#17120c`), tinta `#241D12` (oscuro
  `#FCEFD6`), Oswald (títulos/nav) + Lexend (texto), bordes 3px, sombra dura
  `3px 3px 0`.
- **Topbar:** logo + STREAT LAB + botón sol/luna (tema real, `ThemeContext`) +
  buscador (abre el Command Palette con Alt+K).
- **Dock Mac infinito:** carrusel de 9 iconos (3 directos + 6 secciones) con
  imán al centro, inercia (momentum), bucle infinito y `magnify` (el del centro
  crece). Física portada literal del mockup.
- **Nube de palabras:** al tocar una sección, flota una nube con sus módulos;
  cada uno navega a la pantalla real.
- **Contenido:** `<Outlet/>` con clase `.movil-scope` (legibilidad móvil, ver
  `src/styles/movil-scope.css`).
- **PWA:** aviso "Instalar Binagre" (banner) + service worker (`public/sw.js`,
  registrado en `main.tsx`).

**No inventar** colores, iconos ni módulos: todo sale del ERP real / navModel.

---

## 4. Detección — `src/hooks/useEsMovil.ts`

Un móvil ve SIEMPRE la PWA, aunque entre con "modo escritorio" del navegador.
Criterio, en orden:
1. **Hardware táctil** (`navigator.maxTouchPoints > 0`) — sobrevive al modo
   escritorio, es hardware y no se puede ocultar.
2. Puntero grueso (`pointer: coarse`).
3. Viewport ≤ 768px.
4. User-Agent de móvil.

Es **detección en cliente**, no en el edge. Motivo técnico: el ERP es una SPA de
Vite con un único bundle (`index.html`); un rewrite de Edge Middleware no puede
servir "otra app", solo la misma. La decisión móvil/escritorio es de render, y el
criterio por hardware táctil ya cumple "el móvil siempre ve la PWA". Si en el
futuro se quiere una capa en el edge, sería solo para fijar una cookie/hint de UA
que el cliente lea antes del primer pintado (evitar parpadeo); no cambia la
arquitectura.

---

## 5. Qué NO se hace

- No se crean pantallas "versión móvil". Se reusa la real.
- No se declara navegación fuera de `src/nav/navModel.ts`.
- No se tocan las tuberías (datos/lógica/Supabase) para el móvil: solo la piel.
- No se resucita `ShellMovil` ni `mapaMovil` (retirados).

*De obligado cumplimiento, como `docs/LEY_MOVIL.md` y `docs/LEY_IMPRESION.md`.*
