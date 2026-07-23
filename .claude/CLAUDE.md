# STREAT LAB ERP — CONTEXTO BASE

## STACK
React + TypeScript + Vite + Tailwind + Supabase + Vercel
Repo: github.com/Streatlab/binagre
Producción: https://binagre.vercel.app  (Vercel project: streatlabs-projects/binagre)
Supabase: eryauogxcpbgdryeimdq.supabase.co

## REGLAS ABSOLUTAS — SIEMPRE
1. Lee el archivo antes de tocarlo
2. npx tsc --no-emit antes de cada commit — si hay errores, corrígelos
3. fmtNum acepta solo 1 argumento — nunca pasar segundo argumento
4. Campos calculados: NUNCA input disabled — SIEMPRE div con style={{backgroundColor:'#2d1515',border:'1px solid #aa3030',color:'#ffaaaa'}}
5. Fondos modal: SIEMPRE style inline style={{backgroundColor:'#1a1a1a'}} — nunca clase Tailwind
6. Rama de trabajo SIEMPRE `trabajo`, nunca `master`. Commit siempre al final: git add . && git commit -m "descripcion" && git push origin trabajo. `master` = producción: solo Rubén ordena merge/push ahí. Ver CLAUDE.md raíz sección Deploy para el estado del freeze de pushes.

## DESIGN SYSTEM
Fondos:   app #111111 | sidebar #000000 | modal #1a1a1a | card-alt #141414 | thead #0a0a0a
Inputs:   edit #1e1e1e | readonly #181818 | calc #2d1515
Bordes:   normal #2a2a2a | strong #383838 | calc #aa3030 | focus #e8f442
Texto:    primary #ffffff | secondary #cccccc | muted #777777 | calc #ffaaaa
Acentos:  yellow #e8f442 | red #B01D23
Canales:  Uber #06C167 | Glovo dot #e8f442 | Glovo texto #aabc00 | JustEat #f5a623 | Web texto #ff6b70 | Web dot #B01D23 | Directa #66aaff
Botones:  Guardar bg #B01D23 blanco | Añadir bg #e8f442 texto #111111 | Cancelar bg #222222 border #383838
Calc:     style={{backgroundColor:'#2d1515',border:'1px solid #aa3030',color:'#ffaaaa'}}
Fuentes:  Lexend (todo) | Oswald (nav, tabs, th, botones, labels)

## FORMATO NÚMEROS
fmtEur(n) | fmtNum(n) — SOLO 1 argumento | fmtPct(n) | fmtDate(d)
Todos desde src/utils/format.ts

## SUPABASE — TABLAS
ingredientes, mermas, eps, eps_lineas, recetas, recetas_lineas,
config_canales, config_proveedores, configuracion, usuarios, facturacion_diario

## PROVEEDORES INTERNOS
ABV EPS → no aparece en tabla ingredientes
ABV MRM → no aparece en tabla ingredientes

## WATERFALL — src/utils/calcWaterfall.ts
Comisiones (decimal): Uber 0.30 | Glovo 0.30 | JustEat 0.30 | Web 0.07 | Directa 0.00
Orden canales: Uber → Glovo → JustEat → Web → Directa

## MÓDULOS
OK: Login | Dashboard | Facturación | Ingredientes | Mermas | Config | Sidebar
PENDIENTE: EPS | Recetas waterfall | Índice
PLACEHOLDER: POS | Marcas | Running

## PWA MÓVIL (LEY-PWA-MÓVIL-01)
El móvil = MISMO ERP con otra piel. NO hay pantallas ni datos móviles propios.
- Navegación = FUENTE ÚNICA `src/nav/navModel.ts` (la leen Sidebar Y móvil). Para
  añadir/mover un módulo se edita SOLO ahí; se refleja idéntico en web y PWA.
- Piel móvil: `src/mobile/AppMovil.tsx` (Cantera Alegre + dock Mac + nube + sol/luna).
  El contenido es `<Outlet/>` = pantallas reales con sus pestañas nativas.
- Detección: `src/hooks/useEsMovil.ts` (táctil/UA/ancho). Reparto en `Layout.tsx`.
- NO duplicar navegación ni pantallas. NO resucitar ShellMovil/mapaMovil (retirados).
- Contrato completo: `docs/LEY_PWA_MOVIL.md`.
