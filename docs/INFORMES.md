# INFORMES AUTOMÁTICOS · Streat Lab ERP

Actualizado: 18 jul 2026

## Los 6 informes (hora Madrid)

| Informe | Cuándo | Canal por defecto |
|---|---|---|
| ☀️ Resumen de la mañana | Todos los días · 08:00 | Email |
| 💰 Cobros de la semana | Lunes · 09:00 | Email |
| 📈 Cierre mensual | Día 1 · 09:00 | Email |
| ⏱ Pulso de la tarde | Todos los días · 16:30 | WhatsApp |
| 📅 Cierre diario | Lun-Sáb · 23:29 | WhatsApp |
| 📊 Cierre semanal | Domingo · 23:30 | Email |

Todo se controla desde la app, sin tocar código:
- **/informes** — ver estado, pausar/activar y "Enviar ahora" cualquier informe al momento.
- **/informes/destinatarios** — quién recibe qué informe y por qué canal (WhatsApp / email).
- **/informes/configuracion** — canal por informe y estado de conexiones.
- **/informes/historial** — registro de todos los envíos.

## Cómo funciona por dentro

- Crons de Vercel (en UTC, doble disparo para cubrir horario de invierno y verano)
  llaman a `/api/informes/cron`; la ventana horaria en `informes-cron.ts` filtra por
  hora real de Madrid. Protección anti-duplicados: no reenvía si el último envío del
  mismo tipo fue hace menos de 2 horas.
- WhatsApp: Green API plan Developer (máx 3 chats/mes — Rubén + Emilio).
  Credenciales en Supabase `robot_credenciales` (plataforma `green_api`);
  las env vars `GREEN_API_*` funcionan como override.
- Email: Resend (`RESEND_API_KEY` + `RESEND_FROM` en Vercel).
- Datos: `facturacion_diario` (total_bruto/total_pedidos, intradía),
  `objetivos_dia_semana` (dia 1=lunes…7=domingo, importe),
  `ingresos_mensuales` (tipo='neto'), `gastos`, `presupuestos_mensuales` (tope),
  `facturas_esperadas`.
