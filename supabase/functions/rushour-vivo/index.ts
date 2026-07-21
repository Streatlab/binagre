// RUSHOUR EN VIVO v3 · lee facturación, pedidos y productos del día directamente
// de Rushour, sin navegador, y los guarda en ventas_vivo. Coste 0.
//
// Rushour devuelve los importes en céntimos y desglosados por marca y plataforma.
// Guardamos una fila por marca/plataforma más una fila TOTAL del día.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'npm:amazon-cognito-identity-js@6.3.12';

const POOL_ID = 'eu-west-2_YYLWn5dFb';
const CLIENT_ID = '1bd0m949ev07re75kgc8r4v46d';
const RESTAURANTE = '51a3d71b-db53-48a2-b4ea-8b6029cdea17';
const API = 'https://trq34eqsph.execute-api.eu-west-3.amazonaws.com/production';
const LLAVE = 'sl-vivo-2026';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const hoyMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const log = (estado: string, detalle: string) =>
  sb.from('robot_log').insert([{ fuente: 'rushour_vivo', estado, detalle }]);
const latido = (ultimoDato: string, detalle: string) =>
  sb.from('robot_salud').upsert([{ fuente: 'rushour_vivo', ultima_ejecucion: new Date().toISOString(), ultimo_dato: ultimoDato, estado: 'ok', detalle }]);

function token(usuario: string, clave: string): Promise<string> {
  const pool = new CognitoUserPool({ UserPoolId: POOL_ID, ClientId: CLIENT_ID });
  const user = new CognitoUser({ Username: usuario, Pool: pool });
  const auth = new AuthenticationDetails({ Username: usuario, Password: clave });
  return new Promise((ok, ko) => {
    user.authenticateUser(auth, {
      onSuccess: (s: any) => ok(s.getIdToken().getJwtToken()),
      onFailure: (e: any) => ko(new Error(e?.message || 'login Rushour KO')),
      newPasswordRequired: () => ko(new Error('Rushour pide cambiar la contraseña')),
    });
  });
}

// 'rrn:brand:<idMarca>:source:<idPlataforma>' → partes
function trocea(clave: string) {
  const m = clave.match(/brand:([^:]+):source:([^:]+)/);
  return { marca: m?.[1] ?? clave, plataforma: m?.[2] ?? 'desconocida' };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.searchParams.get('llave') !== LLAVE) return new Response('no', { status: 401 });

  try {
    const { data: cred } = await sb
      .from('robot_credenciales')
      .select('usuario, password')
      .eq('plataforma', 'rushour')
      .eq('activo', true)
      .maybeSingle();
    if (!cred?.usuario || !cred?.password) {
      await log('sin_credenciales', 'no hay claves de Rushour');
      return new Response(JSON.stringify({ error: 'sin credenciales' }), { status: 200 });
    }

    const jwt = await token(cred.usuario, cred.password);
    const fecha = url.searchParams.get('fecha') || hoyMadrid();
    const res = await fetch(
      `${API}/statsv3/restaurants/${RESTAURANTE}/stats?to=${fecha}&from=${fecha}&merge=false&statsByHours=true`,
      { headers: { Authorization: `Bearer ${jwt}`, accept: 'application/json' } },
    );
    if (!res.ok) {
      await log('error', `stats ${res.status}`);
      return new Response(JSON.stringify({ error: res.status }), { status: 200 });
    }
    const datos = await res.json();
    const plataformas = datos?.stats?.merged?.platforms ?? {};

    const filas: any[] = [];
    let totPedidos = 0;
    let totFact = 0;

    let totRealizados = 0;
    let totEnCurso = 0;
    let totCancelPago = 0;

    for (const [clave, v] of Object.entries<any>(plataformas)) {
      const { marca, plataforma } = trocea(clave);

      // Realizados: completed (fallback a delivery si no existe completed), sin duplicar.
      const c = v?.completed ?? v?.delivery ?? {};
      const pedidosRealizados = Number(c.volumeOfOrders ?? 0);
      const factRealizados = Number(c.revenue ?? 0) / 100;

      // En curso: pedidos aceptados/en preparación (ready) o en reparto (in transit), ya pagados, aún no entregados.
      const ready = v?.ready ?? {};
      const enReparto = v?.['in transit'] ?? {};
      const pedidosEnCurso = Number(ready.volumeOfOrders ?? 0) + Number(enReparto.volumeOfOrders ?? 0);
      const factEnCurso = (Number(ready.revenue ?? 0) + Number(enReparto.revenue ?? 0)) / 100;

      // Cancelados con pago: solo si generaron cobro (revenue > 0).
      const cancel = v?.canceled ?? {};
      const cancelRevenue = Number(cancel.revenue ?? 0);
      const pedidosCancelPago = cancelRevenue > 0 ? Number(cancel.volumeOfOrders ?? 0) : 0;
      const factCancelPago = cancelRevenue > 0 ? cancelRevenue / 100 : 0;

      const pedidos = pedidosRealizados + pedidosEnCurso + pedidosCancelPago;
      const facturacion = factRealizados + factEnCurso + factCancelPago;

      totPedidos += pedidos;
      totFact += facturacion;
      totRealizados += pedidosRealizados;
      totEnCurso += pedidosEnCurso;
      totCancelPago += pedidosCancelPago;

      filas.push({
        fecha,
        plataforma,
        marca,
        pedidos,
        facturacion,
        por_horas: v?.statsByHours ?? null,
        crudo: { topProducts: v?.topProducts ?? null, newCustomer: v?.newCustomer ?? null, recurringCustomer: v?.recurringCustomer ?? null },
      });
    }

    filas.push({
      fecha,
      plataforma: 'TOTAL',
      marca: 'Streat Lab',
      pedidos: totPedidos,
      facturacion: Number(totFact.toFixed(2)),
      por_horas: null,
      crudo: null,
    });

    // Solo guardamos si algo ha cambiado desde la última toma (no ensuciar la tabla).
    const { data: ultimo } = await sb
      .from('ventas_vivo')
      .select('pedidos, facturacion')
      .eq('fecha', fecha)
      .eq('plataforma', 'TOTAL')
      .order('momento', { ascending: false })
      .limit(1)
      .maybeSingle();

    const cambiado = !ultimo || Number(ultimo.pedidos) !== totPedidos || Number(ultimo.facturacion) !== Number(totFact.toFixed(2));
    if (cambiado) await sb.from('ventas_vivo').insert(filas);

    await log('ok', `${fecha} · pedidos=${totPedidos} (${totRealizados} realizados +${totEnCurso} en_curso +${totCancelPago} cancelados_pago) facturacion=${totFact.toFixed(2)} · ${cambiado ? 'guardado' : 'sin cambios'}`);
    await latido(fecha, `pedidos=${totPedidos} facturacion=${totFact.toFixed(2)}`);
    return new Response(JSON.stringify({ fecha, pedidos: totPedidos, facturacion: Number(totFact.toFixed(2)), guardado: cambiado }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    await log('error', String((e as Error)?.message || e));
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 200 });
  }
});
