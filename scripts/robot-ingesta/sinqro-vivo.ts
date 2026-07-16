/**
 * SINQRO VIVO · snapshot de pedidos Just Eat del día en curso, cada ~10 min
 * durante servicio (11:00–00:30 Madrid). Alimenta ventas_vivo (mismo contrato
 * que rushour-vivo: Uber/Glovo en vivo).
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
const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function main() {
  const fecha = hoyMadrid();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const filas = await ingestaSinqro(browser, fecha);
    const pedidos = filas.reduce((a, f) => a + (f.pedidos || 0), 0);
    const facturacion = Number(filas.reduce((a, f) => a + (f.bruto || 0), 0).toFixed(2));

    const { data: ultimo } = await sb
      .from('ventas_vivo')
      .select('pedidos, facturacion')
      .eq('fecha', fecha).eq('plataforma', 'just_eat').eq('marca', 'Streat Lab')
      .order('momento', { ascending: false })
      .limit(1)
      .maybeSingle();

    const cambiado = !ultimo || Number(ultimo.pedidos) !== pedidos || Number(ultimo.facturacion) !== facturacion;
    if (cambiado) {
      await sb.from('ventas_vivo').insert([{
        fecha, plataforma: 'just_eat', marca: 'Streat Lab',
        pedidos, facturacion, por_horas: null, crudo: { turnos: filas },
      }]);
    }

    await log(P, 'ok', `${fecha} · pedidos=${pedidos} facturacion=${facturacion} · ${cambiado ? 'guardado' : 'sin cambios'}`);
    await latido(P, fecha, `pedidos=${pedidos} facturacion=${facturacion}`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
