# BATCH 2E · MULTI-TITULAR + IMPORT CUENTA EMILIO + FIX MATCHING PLATAFORMAS

**Objetivo:** Streat Lab opera internamente como unidad pero fiscalmente son 2 autónomos (Rubén + Emilio) con facturas y cuentas separadas. Este batch añade:

1. Tabla `titulares` + campo `titular_id` en tablas relevantes
2. OCR detecta NIF → asigna titular automáticamente
3. Drive separado `/RUBEN/` y `/EMILIO/`
4. Importar extracto BBVA Emilio
5. Matching cross-cuenta
6. Matching plataformas usa INGRESOS no gastos
7. Toggle UI: Unificado / Rubén / Emilio

## REGLAS
1. NO `git push` ni `npx vercel --prod`. Solo local.
2. SÍ commits locales.
3. Deja `npm run dev` corriendo.
4. SQL directo en Supabase `eryauogxcpbgdryeimdq`.

---

## 1. SQL

(Ver Supabase migración `batch_2e_multi_titular`.)

## 2. OCR · Extraer NIF cliente
## 3. Asignar titular al guardar
## 4. Drive split
## 5. Importar BBVA Emilio
## 6. Matching cross-cuenta
## 7. Matching plataformas con INGRESOS
## 8. UI · Toggle Titular
## 9. Endpoint `/api/titulares`
## 10. Placeholder gestoría
## 11. Scripts opcionales (NO ejecutar)

Ver contenido completo en conversación.

## NOTAS

- NIF Rubén placeholder: `00000000X`. Rubén lo actualizará en UI.
- NIF Emilio: `53484832B`.
- Aliases Mercadona ya existen (no volver a añadir).
- Scripts migración Drive y reprocesar facturas: crearlos pero NO ejecutarlos.
