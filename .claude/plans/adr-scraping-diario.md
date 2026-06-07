# ADR — Arquitectura de extracción diaria por scraping

## Estado
Aceptado (scaffold). Selectores por portal: iterativo.

## Decisión 1 — Dónde corre el scraper: GitHub Actions (no Vercel)
**Contexto**: Vercel serverless no ejecuta navegador headless con 2FA de forma fiable
(límite de tiempo, sin display, anti-bot). 
**Decisión**: paquete aislado `scrapers/` con Playwright, ejecutado por
`.github/workflows/scraping-diario.yml` (cron + `workflow_dispatch`).
**Por qué**: gratis, soporta Playwright (`playwright install chromium`), tiene cron y
almacén de secrets cifrados. No mezcla dependencias pesadas con la app Vite.
DECISIÓN AUTÓNOMA.

## Decisión 2 — Reutilizar el pipeline de importación del ERP
El scraper SOLO obtiene el archivo (CSV/XLSX/PDF) que hoy llega por correo, y lo
reenvía a `/api/importar/plataforma` (Uber/Glovo/JustEat/Rushour) o
`/api/conciliacion/importar-emilio` (BBVA). Cero duplicación de parsers. DECISIÓN AUTÓNOMA.

## Decisión 3 — Sesión por `storageState` (cookies), no contraseña en cada run
Login manual una vez (`npm run login <portal>`) resolviendo el 2FA a mano; se guarda
`storageState` y se sube como secret. El cron reutiliza cookies. Si caducan, el portal
redirige a login y el scraper lanza error claro ("regenerar sesión"). DECISIÓN AUTÓNOMA.
**Trade-off**: hay que regenerar la sesión cuando caduquen las cookies (semanas/meses).
Es el camino más robusto sin API oficial.

## Decisión 4 — Credenciales nunca en base de datos
Los `storageState` van como **GitHub Secrets** cifrados, no en Supabase. Los ficheros
`.sesiones/*.json` están en `.gitignore`. DECISIÓN AUTÓNOMA (seguridad).

## Decisión 5 — Aislamiento del build de la app
`scrapers/` tiene su propio `package.json`/`tsconfig.json`. El build de la app
(`tsc -b` → solo `src` + configs Vite) no lo compila. No afecta a producción. DECISIÓN AUTÓNOMA.

## Aislamiento Binagre ↔ David
Solo Supabase Binagre (`eryauogxcpbgdryeimdq`), endpoints `binagre.vercel.app`. Sin
tokens Marino+Fuego. Sin lógica de rutas Cade/Mercadona/etc.

## Pendientes (siguiente iteración)
1. Cerrar `TODO(selector)` por portal con una sesión real (mapear botones/exportación).
2. Activar verificación `x-scraper-secret` en `/api/importar/plataforma` y
   `/api/conciliacion/importar-emilio` (el cliente ya envía la cabecera si hay
   `IMPORT_SECRET`).
3. Notificación a Rubén ante fallo (email/WhatsApp) reaprovechando `informes-envio`.
