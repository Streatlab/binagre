# Registro de publicaciones · ERP Binagre

Cada línea es una salida a producción (binagre.vercel.app).

| Fecha | Qué salió |
|-------|-----------|
| 24-jul-2026 | Fichaje en tablet (quiosco con candado, registro legal RD-ley 8/2019) · Incentivos v13 + Plan de incentivos en PDF · Reembolsos de Just Eat leídos desde la factura · Inventario permanente rev.01 · Cantera Alegre en el área Equipo. Consolidación de todas las ramas de trabajo abiertas. |

## Nota sobre los despliegues

Vercel solo construye si el mensaje del commit lleva `[deploy]` (LEY-BUILD-01).
Si se encolan varios envíos a la vez, Vercel cancela los builds antiguos: si una
publicación aparece como CANCELED, basta con un commit nuevo en `master` con
`[deploy]` para relanzarla.
