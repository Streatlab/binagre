/**
 * JUST EAT · MARCA — lógica PURA (sin Playwright, sin Supabase) para desglosar
 * por marca las ventas Just Eat que sinqro-vivo.ts hoy inserta agregadas bajo
 * marca='Streat Lab'. Aislada aquí para poder testearla sin red (tests/).
 *
 * LEY-ANTIFALSOS: si CUALQUIER pedido del lote no resuelve marca (sin id, o
 * sin marca reconocible ni en caché ni en el detalle), el lote ENTERO cae al
 * agregado de siempre (marca='Streat Lab', el conjunto). Nunca se mezcla
 * desglose parcial con agregado, nunca se inventa una marca, nunca se pierde
 * importe: quien decide el fallback es agruparPorMarca, no el llamador.
 */

export type PedidoJE = { id: string | null; importe: number };

export type LineaJEMarca = { marca: string; pedidos: number; bruto: number; ids: string[] };

export type ResultadoDesglose =
  | { resuelto: true; lineas: LineaJEMarca[] }
  | { resuelto: false; motivo: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Extrae el id numérico de pedido de un href tipo
 * '#/sp/6416/online/orders/123' (o la URL completa). null si no reconoce el patrón. */
export function idDeHref(href: string | null | undefined): string | null {
  const m = (href || '').match(/\/online\/orders\/(\d+)/);
  return m ? m[1] : null;
}

/** ¿Aparece alguna marca conocida en el texto del detalle? Se prueba de más
 * larga a más corta para que un nombre más específico gane sobre un substring
 * suyo (p.ej. "Black Label by Streat Lab" antes que "Streat Lab"). */
export function marcaEnTexto(texto: string, candidatas: string[]): string | null {
  const t = (texto || '').toLowerCase();
  if (!t) return null;
  const ordenadas = [...new Set(candidatas.filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const m of ordenadas) {
    if (t.includes(m.toLowerCase())) return m;
  }
  return null;
}

/** Reconstruye la caché id→marca a partir de filas ya guardadas hoy en
 * ventas_vivo. Solo cuentan las filas que quedaron marcadas como resueltas
 * (crudo.resuelto=true); las filas de fallback no aportan caché porque no
 * sabemos a qué pedidos concretos corresponde el agregado. */
export function cacheDesdeHistorico(filas: { marca: string; crudo: unknown }[]): Map<string, string> {
  const cache = new Map<string, string>();
  for (const f of filas) {
    const c = f.crudo as { resuelto?: boolean; pedidos_ids?: unknown } | null;
    if (!c || c.resuelto !== true || !Array.isArray(c.pedidos_ids)) continue;
    for (const id of c.pedidos_ids) {
      if (typeof id === 'string') cache.set(id, f.marca);
    }
  }
  return cache;
}

/** Agrupa pedidos JE por marca usando `marcaDeId` para resolver cada pedido
 * (normalmente respaldado por caché + detalle ya visitado). Todo o nada. */
export function agruparPorMarca(pedidos: PedidoJE[], marcaDeId: (id: string) => string | null): ResultadoDesglose {
  const porMarca = new Map<string, { pedidos: number; bruto: number; ids: string[] }>();
  for (const p of pedidos) {
    if (!p.id) return { resuelto: false, motivo: 'pedido sin id en el listado (href no reconocido)' };
    const marca = marcaDeId(p.id);
    if (!marca) return { resuelto: false, motivo: `pedido ${p.id}: marca no reconocible en el detalle` };
    const cur = porMarca.get(marca) || { pedidos: 0, bruto: 0, ids: [] };
    cur.pedidos += 1;
    cur.bruto = r2(cur.bruto + p.importe);
    cur.ids.push(p.id);
    porMarca.set(marca, cur);
  }
  return {
    resuelto: true,
    lineas: [...porMarca.entries()].map(([marca, v]) => ({ marca, pedidos: v.pedidos, bruto: v.bruto, ids: v.ids })),
  };
}

/** ¿Es el mismo conjunto de filas (marca/pedidos/facturación) que la última
 * tanda guardada? Ignora orden. Se usa para no reinsertar si no ha cambiado nada. */
export function mismoConjuntoJE(
  a: { marca: string; pedidos: number; facturacion: number }[],
  b: { marca: string; pedidos: number; facturacion: number }[],
): boolean {
  if (a.length !== b.length) return false;
  const norm = (arr: typeof a) =>
    [...arr]
      .sort((x, y) => x.marca.localeCompare(y.marca))
      .map((r) => `${r.marca}|${r.pedidos}|${r.facturacion}`)
      .join(';');
  return norm(a) === norm(b);
}
