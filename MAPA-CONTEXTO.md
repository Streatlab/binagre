# MAPA-CONTEXTO · Binagre ERP (Streat Lab)

> Wiki viva que Claude lee al arrancar sesión y mantiene al cerrar. Fuente de verdad rápida del estado del repo. Pendientes detallados viven en Notion "99 Claude".
> Última actualización: 2026-06-29

---

## Qué es esto
ERP web de Streat Lab (dark kitchen, Vallecas). React + TypeScript + Vite, datos en Supabase, deploy en Vercel. Marca portfolio principal: Binagre. Multi-canal: Uber Eats, Glovo, Just Eat, tienda online.

## Repos y ramas
- Repo: `Streatlab/binagre`.
- **trabajo** = rama de trabajo diario (donde se hace TODO). Única rama activa.
- **master** = rama histórica de producción. Riesgo: queda por detrás si no se fusiona.
- Regla: nunca tocar master sin orden explícita "publica".

## Despliegue
- Vercel, proyecto `binagre`, team `streatlabs-projects`.
- Dominio producción: `binagre.vercel.app`.
- Builds 150-250s. Verificación post-push: confirmar deploy READY.

## Anti-rotura (capa de seguridad)
- Gate en el build: `vitest run && tsc -b && vite build`. Si un test falla, el deploy se bloquea y la versión mala NO sale.
- Tests: `tests/smoke.test.ts` (formato euro + waterfall margen) y `tests/modulos.test.ts` (6 módulos críticos existen y están sanos: Dashboard, Facturacion, Conciliacion, PagosCobros, PanelGlobal, Escandallo).
- Rollback: cada deploy de Vercel es un punto de restauración de 1 clic.

## Diseño
- Sistema neobrutal Food-Pop. Tokens canónicos en `src/styles/neobrutal.ts`.
- Reconversión estructural, no maquillaje. Bandas full-bleed, charts de barras planas, sin pie/donut/glow.

## OCR / Conciliación
- Cascada: reglas/template → Tesseract → Mistral bootstrap (1x por NIF) → revisión manual.
- Cuadre factura↔movimiento automático vía triggers BD. Importe ±0.05€ + proveedor normalizado + ventana de matching.

## Principios
- Datos honestos: nunca inventar lógica de negocio ni ventanas de pago sin confirmar.
- Streat Lab nunca paga facturas agrupadas (1 cargo = 1 factura) ni a 60 días.
- Pendientes en Notion "99 Claude" (4 tracks). Errores previos en 99 Claude › 03 Aprendizajes.

## Estado abierto (2026-06-29)
- Desfase master↔trabajo: producción puede ir por detrás del trabajo diario. Decisión pendiente: colapsar a una sola rama.
- Modales del Escandallo: reconversión estructural pendiente (requiere mockup aprobado).
- Robot ingesta Rushour/Sinqro: bloqueado en 4 GitHub Secrets.
