/**
 * SINQRO VIVO · snapshot de pedidos Just Eat del día en curso, cada ~10 min
 * durante servicio (11:00–00:30 Madrid).
 *
 * 16-jul (noche) · CAMBIO DE PANTALLA: la vista online/orders quedó VACÍA desde
 * el ~11-jul (comprobado con DOM volcado: cuenta y filtros bien, 0 pedidos, con
 * o sin fechas tecleadas). Los pedidos viven ahora en la pantalla de POS que
 * Rubén indicó desde el principio: app.sinqro.com/#/sp/6416/pos/services.
 * Este robot va a esa pantalla. Como su DOM aún no está mapeado, en cada pasada
 * vuelca el HTML a robot_debug (fuente 'sinqro_pos_dom') y hace una lectura
 * genérica (bloques que mencionen Just Eat con un importe €). Cuando el volcado
 * confirme los selectores reales, se afina el lector.
 *
 * Reglas vigentes del incidente del 16-jul:
 *   1. Escribe en `ventas_vivo_pruebas` hasta validarse (cambiar TABLA_VIVO).
 *   2. Nunca guardar lecturas en 0 (se loguean como sospechosas).
 *   3. Cuando pase a `ventas_vivo`: solo fila plataforma=just_eat, jamás TOTAL.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { hoyMadrid, log, latido } from './_lib/bandeja.js';

const P = 'sinqro_vivo';
const TABLA_VIVO = 'ventas_vivo_pruebas';
const URL_POS = 'https://app.sinqro.com/#/sp/6416/pos/services';
const sb = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const USER = process.env.SINQRO_USER || '';
const PASS = process.env.SINQRO_PASS || '';

function numES(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function volcarDom(page: Page, fuente: string, fecha: string) {
  try {
    const html = await page.content().catch(() => '');
    if (html) await sb.from('robot_debug').insert([{ fuente, fecha, html }]);
  } catch {}
}

async function login(page: Page) {
  await page.goto('https://app.sinqro.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const email = page.locator('#login-email').first();
  if (await email.count().catch(() => 0)) {
    await email.fill(USER).catch(() => {});
    await page.locator('#login-password').first().fill(PASS).catch(() => {});
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      page.locator('#loginButton').first().click().catch(() => {}),
    ]);
    await page.waitForTimeout(3000);
  }
}

async function main() {
  if (!USER || !PASS) { await log(P, 'error', 'sin credenciales SINQRO_USER/PASS'); return; }
  const fecha = hoyMadrid();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await login(page);

    await page.goto(URL_POS, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(6000);

    // Volcado SIEMPRE (pantalla aún sin mapear): así se pueden fijar los
    // selectores reales leyendo robot_debug por SQL.
    await volcarDom(page, 'sinqro_pos_dom', fecha);

    // Lectura genérica provisional: elementos que mencionen Just Eat y tengan
    // un importe € en su texto. Sirve para validar que la pantalla ES la buena;
    // el lector fino se escribe con el DOM volcado.
    const candidatos = page.locator('div,li,tr').filter({ hasText: /just\s?eat/i });
    const n = Math.min(await candidatos.count().catch(() => 0), 200);
    let pedidos = 0; let bruto = 0;
    const vistos = new Set<string>();
    for (let i = 0; i < n; i++) {
      const txt = ((await candidatos.nth(i).textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      if (txt.length > 400) continue;            // contenedores grandes, no un pedido
      const m = txt.match(/(\d+[.,]\d{2})\s*€/);
      if (!m) continue;
      if (vistos.has(txt)) continue;             // el mismo bloque anidado repetido
      vistos.add(txt);
      pedidos += 1;
      bruto += numES(m[1]) || 0;
    }
    bruto = Math.round(bruto * 100) / 100;

    if (pedidos === 0) {
      await log(P, 'sospechoso', `${fecha}: lectura en 0 en pos/services — DOM volcado (sinqro_pos_dom), afinar lector con él`);
      await latido(P, fecha, 'lectura en 0 en pos/services, DOM volcado');
      return;
    }

    const { data: ultimo } = await sb
      .from(TABLA_VIVO)
      .select('pedidos, facturacion')
      .eq('fecha', fecha).eq('plataforma', 'just_eat').eq('marca', 'Streat Lab')
      .order('momento', { ascending: false })
      .limit(1)
      .maybeSingle();

    const cambiado = !ultimo || Number(ultimo.pedidos) !== pedidos || Number(ultimo.facturacion) !== bruto;
    if (cambiado) {
      await sb.from(TABLA_VIVO).insert([{
        fecha, plataforma: 'just_eat', marca: 'Streat Lab',
        pedidos, facturacion: bruto, por_horas: null, crudo: { origen: 'pos/services', lector: 'generico_v1' },
      }]);
    }

    await log(P, 'ok', `${fecha} · pedidos=${pedidos} facturacion=${bruto} · ${cambiado ? 'guardado' : 'sin cambios'} · tabla=${TABLA_VIVO} · pos/services`);
    await latido(P, fecha, `pedidos=${pedidos} facturacion=${bruto} · pos/services`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
