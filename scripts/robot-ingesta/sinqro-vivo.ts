/**
 * SINQRO VIVO · snapshot de pedidos Just Eat del día en curso, cada ~10 min
 * durante servicio (11:00–00:30 Madrid).
 *
 * INCIDENTE 16-jul: la primera versión escribía directo en `ventas_vivo` y una
 * lectura en 0 (login/scrape sin verificar aún) tumbó el Panel en vivo de
 * producción. Regla desde entonces, mientras este robot no esté validado:
 *   1. PROHIBIDO escribir en `ventas_vivo`. Se escribe en `ventas_vivo_pruebas`
 *      (mismo esquema) — el Panel no la lee.
 *   2. Solo cuando se confirme que lee bien de verdad, cambiar TABLA_VIVO a
 *      'ventas_vivo' más abajo.
 *   3. Nunca se escribe una lectura en 0 pedidos/0€ (probable fallo de login o
 *      scrape, no un "todavía no hay pedidos" fiable) — se salta esa pasada y
 *      se loguea como sospechosa en vez de guardar un dato falso.
 *   4. Cuando algún día se escriba en `ventas_vivo` de verdad: el Panel ancla
 *      el vivo a la fila plataforma=TOTAL de Rushour, así que esta tabla
 *      SOLO debe aportar su fila plataforma=just_eat (nunca una fila TOTAL
 *      propia que compita con la de Rushour).
 *
 * DECISIÓN AUTÓNOMA (plan-v2 T2): el plan pedía leer
 * app.sinqro.com/#/sp/6416/pos/services, una pantalla de punto de venta que no
 * se ha podido inspeccionar en vivo (sin acceso interactivo al portal desde
 * esta sesión). En vez de adivinar selectores contra una página no vista, este
 * robot reutiliza ingestaSinqro() de robot.ts — el mismo login (#login-email/
 * #login-password/#loginButton) y la misma lectura de app.sinqro.com/#/sp/
 * 6416/online/orders que YA funciona en producción (toma comida/cena) — pidiendo
 * como rango el día de hoy. Limitación conocida: esa vista es el listado de
 * pedidos del día, no un panel de "en preparación/en reparto" en tiempo real;
 * si Sinqro tarda en reflejar un pedido ahí, el vivo se retrasa lo mismo.
 * Pendiente: mapear pos/services (DOM real) para una lectura más instantánea.
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { ingestaSinqro } from './robot.js';
import { hoyMadrid, log, latido } from './_lib/bandeja.js';

const P = 'sinqro_vivo';
// TODO(validación pendiente): cambiar a 'ventas_vivo' cuando este robot lea
// bien de verdad varios días seguidos. Hasta entonces, tabla de pruebas.
const TABLA_VIVO = 'ventas_vivo_pruebas';
const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function main() {
  const fecha = hoyMadrid();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const filas = await ingestaSinqro(browser, fecha);
    const pedidos = filas.reduce((a, f) => a + (f.pedidos || 0), 0);
    const facturacion = Number(filas.reduce((a, f) => a + (f.bruto || 0), 0).toFixed(2));

    if (pedidos === 0 && facturacion === 0) {
      await log(P, 'sospechoso', `${fecha}: lectura en 0 pedidos/0€ — probable fallo de login o scrape, NO se guarda`);
      await latido(P, fecha, 'lectura en 0, descartada');
      return;
    }

    const { data: ultimo } = await sb
      .from(TABLA_VIVO)
      .select('pedidos, facturacion')
      .eq('fecha', fecha).eq('plataforma', 'just_eat').eq('marca', 'Streat Lab')
      .order('momento', { ascending: false })
      .limit(1)
      .maybeSingle();

    const cambiado = !ultimo || Number(ultimo.pedidos) !== pedidos || Number(ultimo.facturacion) !== facturacion;
    if (cambiado) {
      await sb.from(TABLA_VIVO).insert([{
        fecha, plataforma: 'just_eat', marca: 'Streat Lab',
        pedidos, facturacion, por_horas: null, crudo: { turnos: filas },
      }]);
    }

    await log(P, 'ok', `${fecha} · pedidos=${pedidos} facturacion=${facturacion} · ${cambiado ? 'guardado' : 'sin cambios'} · tabla=${TABLA_VIVO}`);
    await latido(P, fecha, `pedidos=${pedidos} facturacion=${facturacion} · tabla=${TABLA_VIVO}`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
