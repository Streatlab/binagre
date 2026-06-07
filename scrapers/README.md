# Scrapers — Extracción diaria de facturación

Extrae automáticamente cada día los datos de facturación de **Uber Eats, Glovo,
Just Eat, Rushour y BBVA** entrando a sus portales con un navegador headless
(Playwright) y reenviando el reporte al pipeline de importación del ERP.

No corre en Vercel (serverless no puede con login + 2FA). Corre en **GitHub Actions**
(gratis, con cron y secrets).

## Cómo funciona

```
GitHub Actions (cron diario)
        │
        ▼
  scrapers/src/run.ts ──► por cada portal activo:
        │                   1. carga storageState (cookies)
        │                   2. descarga el reporte de AYER
        │                   3. POST base64 ─► ERP
        ▼
  binagre.vercel.app
   /api/importar/plataforma        (Uber / Glovo / JustEat / Rushour)
   /api/conciliacion/importar-emilio (BBVA)
        │
        ▼
  Parseo + almacenamiento (lógica que YA existe en el ERP)
```

La sesión se basa en **cookies (`storageState`)**: se hace login una sola vez a mano
(resolviendo el 2FA) y el cron reutiliza esas cookies. Cuando caducan, el run falla con
un mensaje claro y hay que regenerarlas.

## Puesta en marcha (una vez por portal)

```bash
cd scrapers
npm install
npx playwright install chromium

# Abre un navegador visible, inicia sesión a mano (incl. 2FA) y pulsa ENTER:
npm run login uber        # luego glovo, justeat, rushour, bbva
```

El comando imprime un **base64**. Pégalo como **GitHub Secret** con el nombre que
indica (`UBER_STORAGE_STATE`, `GLOVO_STORAGE_STATE`, etc.) en
`Settings → Secrets and variables → Actions`.

Secrets/variables a configurar en GitHub:

| Nombre | Tipo | Para qué |
|---|---|---|
| `UBER_STORAGE_STATE` | secret | sesión Uber Eats |
| `GLOVO_STORAGE_STATE` | secret | sesión Glovo |
| `JUSTEAT_STORAGE_STATE` | secret | sesión Just Eat |
| `RUSHOUR_STORAGE_STATE` | secret | sesión Rushour |
| `BBVA_STORAGE_STATE` | secret | sesión BBVA |
| `IMPORT_SECRET` | secret | (opcional) autenticar la importación |
| `IMPORT_BASE` | variable | (opcional) URL del ERP; por defecto `https://binagre.vercel.app` |

## Ejecución

- **Automática**: cron en `.github/workflows/scraping-diario.yml` (~06:00/07:00 Madrid).
- **Manual / local**:

```bash
cd scrapers
SCRAPER_PORTALES=uber npm run run     # usa .sesiones/uber.json si existe
```

## Estado / pendiente

- Los **selectores DOM** de cada portal están marcados con `TODO(selector)`: se
  cierran iterativamente con una sesión real (`npm run login <portal>` + Playwright
  Inspector). El esqueleto (login, descarga, importación) ya funciona.
- BBVA es el portal más frágil (2FA frecuente). Su sesión caducará a menudo.
- Para activar la cabecera `x-scraper-secret`, hay que añadir la verificación en los
  endpoints del ERP (hoy el cliente ya la envía si `IMPORT_SECRET` está definido).
