/**
 * SINQRO VIVO · pedidos Just Eat del día, cada 5 min durante servicio.
 *
 * PANTALLA REAL (mapeada 16-jul con DOM volcado): app.sinqro.com/#/sp/6416/pos/services
 *   - Cada pedido activo = tarjeta `.posOrderBox`
 *   - Plataforma = icono `img[src*='..._icon']` dentro de la tarjeta
 *     (glovo_icon.jpg para Glovo; para Just Eat el src contiene 'just'/'justeat')
 *   - `.orderNumberBox`: "#88531591 (862 | 101715306442) | 20.00 €"
 *   - `.orderPreparationTimeBox`: "Preparación: 16/07 20:18"
 *
 * La pantalla solo enseña pedidos ACTIVOS (en preparación / en reparto), no el
 * acumulado del día → el total diario se construye ACUMULANDO: cada pasada
 * registra los números de pedido Just Eat vistos en `sinqro_pedidos_vivo`
 * (pk fecha+numero, idempotente) y el snapshot que se guarda es la SUMA del día.
 *
 * DEDUPE de plataformas: aquí SOLO Just Eat (Glovo y Uber se cuentan por
 * Rushour; regla canónica anti doble conteo).
 *
 * PRODUCCIÓN (16-jul noche, validado por Rubén): escribe en `ventas_vivo`.
 * El Panel lo integra: v_vivo_snapshot une el lote TOTAL de Rushour + la última
 * fila just_eat del día; v_vivo_hoy y "Por dónde entran" suman ambas fuentes.
 * Reglas que siguen vigentes del incidente del 16-jul:
 *   1. No guardar snapshots en 0 (se loguean como 'sin_actividad').
 *   2. SOLO fila plataforma=just_eat, jamás una fila TOTAL propia.
 */
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { hoyMadrid, log, latido } from './_lib/bandeja.js';

const P = 'sinqro_vivo';
const TABLA_VIVO = 'ventas_vivo';
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
  const hoyDDMM = fecha.slice(8, 10) + '/' + fecha.slice(5, 7); // '16/07'
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await login(page);

    await page.goto(URL_POS, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(6000);

    // Tarjetas de pedido activas
    const tarjetas = page.locator('.posOrderBox');
    const n = await tarjetas.count().catch(() => 0);
    const nuevosJE: { numero: string; importe: number | null; hora: string | null }[] = [];
    let vistosGlovo = 0;

    for (let i = 0; i < n; i++) {
      const t = tarjetas.nth(i);
      const icono = (await t.locator('img').first().getAttribute('src').catch(() => '')) || '';
      // 16-jul (noche, fix): el logo de Just Eat en Sinqro NO lleva 'just' en la URL
      // (es un png con nombre hasheado en content.sinqro.com); el de Glovo SI lleva
      // 'glovo_icon'. En esta pantalla solo entran Glovo y Just Eat, asi que la regla
      // se invierte: tarjeta con icono que NO sea Glovo (ni Uber, por si acaso) = JE.
      const esGlovo = /glovo/i.test(icono);
      const esJE = !!icono && !esGlovo && !/uber|rushour/i.test(icono);
      if (!esJE) { if (esGlovo) vistosGlovo++; continue; }

      const numTxt = ((await t.locator('.orderNumberBox').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      const numero = (numTxt.match(/#(\d+)/) || [])[1];
      if (!numero) continue;
      const importe = numES((numTxt.match(/(\d+[.,]\d{2})\s*€/) || [])[1] || null);
      const prepTxt = ((await t.locator('.orderPreparationTimeBox').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      const mPrep = prepTxt.match(/(\d{2}\/\d{2})\s+(\d{1,2}:\d{2})/);
      // Solo pedidos preparados HOY (la pantalla podría arrastrar pedidos programados de otro día)
      if (mPrep && mPrep[1] !== hoyDDMM) continue;
      nuevosJE.push({ numero, importe, hora: mPrep ? mPrep[2] : null });
    }

    // Acumular: alta idempotente de cada pedido JE visto (pk fecha+numero)
    if (nuevosJE.length) {
      await sb.from('sinqro_pedidos_vivo').upsert(
        nuevosJE.map((p) => ({ fecha, numero: p.numero, plataforma: 'just_eat', importe: p.importe, hora_prep: p.hora })),
        { onConflict: 'fecha,numero', ignoreDuplicates: true },
      );
    }

    // Total del día = SUMA del acumulador (no lo que haya activo ahora)
    const { data: acum } = await sb
      .from('sinqro_pedidos_vivo')
      .select('numero, importe')
      .eq('fecha', fecha).eq('plataforma', 'just_eat');
    const pedidos = acum?.length || 0;
    const bruto = Math.round(((acum || []).reduce((a, r: any) => a + (Number(r.importe) || 0), 0)) * 100) / 100;

    if (pedidos === 0) {
      // No es un fallo: puede que aún no haya habido JE hoy o no haya activos y
      // el acumulador esté vacío. Se registra sin ensuciar la tabla del vivo.
      await log(P, 'sin_actividad', `${fecha}: 0 JE acumulados (tarjetas activas: ${n}, glovo: ${vistosGlovo})`);
      await latido(P, fecha, `0 JE acumulados · tarjetas activas ${n}`);
      if (n === 0) await volcarDom(page, 'sinqro_pos_dom', fecha); // pantalla vacía del todo → volcar por si cambió
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
        pedidos, facturacion: bruto, por_horas: null,
        crudo: { origen: 'pos/services', acumulados: pedidos },
      }]);
    }

    await log(P, 'ok', `${fecha} · JE acumulados=${pedidos} bruto=${bruto} · activos ahora=${nuevosJE.length} · ${cambiado ? 'guardado' : 'sin cambios'} · tabla=${TABLA_VIVO}`);
    await latido(P, fecha, `JE=${pedidos} bruto=${bruto}`);
  } catch (e: any) {
    await log(P, 'error', String(e?.message || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
