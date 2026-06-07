# SPEC — Extracción diaria automática de facturación (scraping de portales)

## Petición de Rubén
"Facturación automática: que [el sistema] se meta en 3-4 páginas y extraiga datos
automáticamente cada día a horas determinadas."

Decisiones cerradas con Rubén (AskUserQuestion):
- **Plataformas**: todas — Uber Eats, Glovo, Just Eat, BBVA (banco) — **y Rushour**.
- **Enfoque**: scraper de navegador headless (no API oficial, no solo email).

## Contexto existente (reutilizar, NO reinventar)
- `POST /api/importar/plataforma` ya detecta plataforma (Uber/Glovo/JustEat/Rushour)
  por NIF/cabeceras y parsea + almacena. Acepta `{ base64, nombre, mimeType }`.
- `POST /api/conciliacion/importar-emilio` parsea Excel BBVA → tabla `conciliacion`.
  Acepta `{ base64, nombre }`.
- Cron de Vercel ya existe (`vercel.json`) para el "cartero" de correo a las 05:00.
- `imports_plataformas` registra cada importación (estado ok/error/pendiente).

## Restricción técnica dura
Vercel (serverless) NO puede ejecutar un navegador headless con login + 2FA de forma
fiable. Por eso el scraper NO vive en Vercel: vive en **GitHub Actions** (gratis,
soporta Playwright + cron + secrets). El scraper descarga el reporte del día de cada
portal y lo reenvía al endpoint de importación que YA existe.

## Criterios de aceptación (DADO / CUANDO / ENTONCES)

### CA-1 — Orquestación diaria
- DADO el workflow `scraping-diario.yml` programado por cron
- CUANDO llega la hora determinada (06:00–07:00 Madrid)
- ENTONCES se ejecuta `npm run run` en `scrapers/`, recorriendo todos los portales
  activos (`SCRAPER_PORTALES`).

### CA-2 — Reutilización del pipeline
- DADO un reporte descargado de un portal
- CUANDO el scraper termina la descarga
- ENTONCES hace `POST` (base64) al endpoint de importación correspondiente y NO
  duplica lógica de parseo (la hace el ERP).

### CA-3 — Sesión sin 2FA en cada ejecución
- DADO que los portales exigen 2FA en el primer login
- CUANDO se ejecuta el cron
- ENTONCES usa un `storageState` (cookies) generado una sola vez con
  `npm run login <portal>`, sin pedir 2FA en cada ejecución.

### CA-4 — Fallo aislado por portal
- DADO que un portal falla (sesión caducada, cambio de UI)
- CUANDO el orquestador lo procesa
- ENTONCES registra el fallo, continúa con el resto y termina con `exitCode=1`
  para que GitHub Actions marque el run en rojo (visibilidad).

### CA-5 — Fecha = día anterior
- DADO que el cron corre por la mañana
- CUANDO calcula el rango
- ENTONCES extrae los datos de **ayer** en hora de Madrid (`Europe/Madrid`).

## Fuera de alcance (esta entrega)
- Selectores DOM finales de cada portal: requieren una sesión real para mapearse
  y se afinan iterativamente (marcados con `TODO(selector)`).
- Notificación a Rubén ante fallo (de momento: run rojo en GitHub Actions).
- Endurecer `/api/importar/plataforma` con secreto `x-scraper-secret` (preparado en
  el cliente; falta activarlo en el endpoint — ver ADR §Pendientes).

## Pendiente de Rubén (operativo, no bloquea el scaffold)
1. Credenciales: hacer login una vez por portal (`npm run login <portal>`) y pegar el
   `storageState` resultante como **secret** en GitHub (`UBER_STORAGE_STATE`, etc.).
2. Confirmar URLs/flujo real de cada portal para cerrar los `TODO(selector)`.
3. Decidir hora exacta del cron (por defecto 05:00 UTC ≈ 06:00/07:00 Madrid).
