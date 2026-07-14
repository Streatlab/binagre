/**
 * Parser S1 — Sinqro Sold Products (sold_products_*.csv)
 * Separador: ;  |  SIN cabecera de nombres → mapear por posición
 *
 * POSICIONES REALES (verificadas contra archivo 20260625130142_sold_products_3976805.csv):
 *   0  id_pedido
 *   1  tienda|id_plataforma
 *   2  tipo (Delivery)
 *   3  canal (Glovo / JustEat / Uber)
 *   4  dirección → marca
 *   5  extra1 (ej: "No facilitada") — IGNORAR
 *   6  extra2 (vacío)               — IGNORAR
 *   7  cantidad
 *   8  nombre de producto o modificador
 *   9  origen (External platforms)
 *  10  descuento
 *  11  fecha+hora  YYYY-MM-DD HH:MM:SS
 *  12  precio de línea  (negativo = Promo/Descuento → excluir)
 *  13  total del pedido
 *  14  extra
 *
 * ── FIX 13-jul-26 ────────────────────────────────────────────────
 * El fichero de Sinqro SÍ trae la marca de cada pedido. El problema era que
 * este parser nombraba los canales de forma distinta a como están guardados
 * en `ventas_plato` ('sinqro' en vez de 'justeat', 'uber_eats' en vez de
 * 'uber'). Resultado: al reimportar no pisaba las filas existentes, creaba
 * filas nuevas en paralelo y la venta seguía apareciendo sin marca.
 *
 * Canales normalizados (los mismos que usa toda la BD):
 *   Glovo    → 'glovo'
 *   JustEat  → 'justeat'
 *   Uber     → 'uber'
 *
 * Output:
 *   - VentaPlato[]  → ventas_plato (estimado=false, origen='sincro')
 *   - VentaFranja[] → ventas_franja (hora, dia_semana)
 */

import type { VentaPlato } from './parserUberArticulos';

export interface VentaFranja {
  canal: string;
  marca: string;
  fecha: string;       // ISO date YYYY-MM-DD
  hora: number;        // 0-23
  dia_semana: number;  // 0=Lunes … 6=Domingo
  pedidos: number;
  unidades: number;
  importe: number;
}

// ── Posiciones reales ────────────────────────────────────────────
const POS = {
  PEDIDO: 0,
  CANAL:  3,
  MARCA:  4,
  UNIDS:  7,
  PLATO:  8,
  FECHA:  11,
  PRECIO: 12,
} as const;

// ── Exclusiones ──────────────────────────────────────────────────
const PALABRAS_EXCLUIR = [
  'agua', 'bebida', 'refresco', 'cola', 'fanta', 'nestea', 'cerveza',
  'pan', 'extra', 'adicional', 'cubiertos', 'servilleta',
  'bolsa', 'bag', 'packaging', 'cargo', 'envío',
];

function esModificadorOExtra(nombre: string): boolean {
  const n = nombre.trim();
  if (!n) return true;
  // Todo MAYÚSCULAS ≥3 chars (modificadores Sincro/Glovo)
  if (n.length >= 3 && n === n.toUpperCase() && /[A-ZÁÉÍÓÚ]/.test(n)) return true;
  // Empieza por '['
  if (n.startsWith('[')) return true;
  const nl = n.toLowerCase();
  return PALABRAS_EXCLUIR.some(p => nl.includes(p));
}

// ── Canal normalizado ────────────────────────────────────────────
// IMPORTANTE: estos valores tienen que ser EXACTAMENTE los que ya hay en la
// base de datos ('uber', 'glovo', 'justeat'). Si no, se duplican las ventas.
function normalizarCanal(raw: string): VentaPlato['canal'] {
  const c = (raw || '').toLowerCase();
  if (c.includes('uber')) return 'uber' as VentaPlato['canal'];
  if (c.includes('glovo')) return 'glovo' as VentaPlato['canal'];
  if (c.includes('just') || c.replace(/[^a-z]/g, '') === 'je') return 'justeat' as VentaPlato['canal'];
  return 'justeat' as VentaPlato['canal'];
}

// ── Marca desde la dirección (col 4) ─────────────────────────────
// Sinqro mete el nombre de la marca virtual delante de la dirección.
// Nos quedamos con lo que va antes de la primera coma.
function normalizarMarca(dir: string): string {
  if (!dir || !dir.trim()) return 'Streat Lab';
  const m = dir.match(/^([^,]+)/);
  const marca = (m ? m[1] : dir).trim();
  return marca || 'Streat Lab';
}

// ── Parseo CSV con separador ; ────────────────────────────────────
function parseCSVSemicolon(text: string): string[][] {
  const rows: string[][] = [];
  let current = '', inQuotes = false, row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ';') { row.push(current.trim()); current = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current.trim()); current = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = []; if (ch === '\r') i++;
      } else current += ch;
    }
  }
  if (current || row.length) { row.push(current.trim()); if (row.some(c => c !== '')) rows.push(row); }
  return rows;
}

// ── Fecha+hora YYYY-MM-DD HH:MM:SS ──────────────────────────────
interface FechaHora {
  fecha: string;
  mes: number;
  año: number;
  hora: number;
  dia_semana: number;
}

function parseFechaHora(s: string): FechaHora | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):\d{2}:\d{2})?/);
  if (!m) return null;
  const año = parseInt(m[1]), mes = parseInt(m[2]), dia = parseInt(m[3]);
  const hora = m[4] ? parseInt(m[4]) : 12;
  const fecha = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(año, mes - 1, dia);
  const dia_semana = (d.getDay() + 6) % 7; // 0=Lun, 6=Dom
  return { fecha, mes, año, hora, dia_semana };
}

// ── Export principal ─────────────────────────────────────────────
export interface SinqroResult {
  platos: VentaPlato[];
  franjas: VentaFranja[];
  /** Diagnóstico: cuántas líneas venían sin marca en el fichero. */
  sinMarca: number;
  /** Diagnóstico: marcas distintas encontradas en el fichero. */
  marcasDetectadas: string[];
}

export function parseSinqroSoldProducts(csvText: string): VentaPlato[] {
  return parseSinqroSoldProductsFull(csvText).platos;
}

export function parseSinqroSoldProductsFull(csvText: string): SinqroResult {
  const allRows = parseCSVSemicolon(csvText);
  if (allRows.length < 1) return { platos: [], franjas: [], sinMarca: 0, marcasDetectadas: [] };

  // Detectar si la primera fila es cabecera textual (col 0 no numérico)
  const primeraCeldaEsTexto = allRows[0][0] && isNaN(Number(allRows[0][0]));
  const dataRows = primeraCeldaEsTexto ? allRows.slice(1) : allRows;

  const gruposPlato: Record<string, {
    canal: VentaPlato['canal']; marca: string; plato: string;
    mes: number; año: number; unidades: number; ingresos: number;
  }> = {};

  const gruposFranja: Record<string, {
    canal: string; marca: string; fecha: string; hora: number;
    dia_semana: number; pedidos: Set<string>; unidades: number; importe: number;
  }> = {};

  let sinMarca = 0;
  const marcasSet = new Set<string>();

  for (const row of dataRows) {
    if (!row[POS.PEDIDO]) continue; // fila vacía

    const platoRaw = row[POS.PLATO] || '';
    if (!platoRaw || esModificadorOExtra(platoRaw)) continue;

    const ingreso = parseFloat((row[POS.PRECIO] || '0').replace(',', '.')) || 0;
    // Excluir líneas de descuento/promo (precio negativo o cero)
    if (ingreso <= 0) continue;

    const plato = platoRaw.trim();
    const canal = normalizarCanal(row[POS.CANAL] || '');

    const marcaRaw = row[POS.MARCA] || '';
    if (!marcaRaw.trim()) sinMarca++;
    const marca = normalizarMarca(marcaRaw);
    marcasSet.add(marca);

    const unidades = Math.max(1, parseInt(row[POS.UNIDS] || '1') || 1);
    const fh = parseFechaHora(row[POS.FECHA] || '');
    const mes = fh?.mes ?? (new Date().getMonth() + 1);
    const año = fh?.año ?? new Date().getFullYear();

    // — ventas_plato —
    const keyPlato = `${canal}|${marca}|${plato}|${mes}|${año}`;
    if (!gruposPlato[keyPlato]) {
      gruposPlato[keyPlato] = { canal, marca, plato, mes, año, unidades: 0, ingresos: 0 };
    }
    gruposPlato[keyPlato].unidades += unidades;
    gruposPlato[keyPlato].ingresos += ingreso;

    // — ventas_franja —
    if (fh) {
      const keyFranja = `${canal}|${marca}|${fh.fecha}|${fh.hora}`;
      if (!gruposFranja[keyFranja]) {
        gruposFranja[keyFranja] = {
          canal, marca, fecha: fh.fecha, hora: fh.hora,
          dia_semana: fh.dia_semana, pedidos: new Set(), unidades: 0, importe: 0,
        };
      }
      gruposFranja[keyFranja].pedidos.add(row[POS.PEDIDO]);
      gruposFranja[keyFranja].unidades += unidades;
      gruposFranja[keyFranja].importe += ingreso;
    }
  }

  const platos: VentaPlato[] = Object.values(gruposPlato).map(g => ({
    canal: g.canal, marca: g.marca, plato: g.plato, mes: g.mes, año: g.año,
    unidades: g.unidades,
    ingresos_brutos: Math.round(g.ingresos * 100) / 100,
    precio_medio: g.unidades > 0 ? Math.round((g.ingresos / g.unidades) * 100) / 100 : 0,
  }));

  const franjas: VentaFranja[] = Object.values(gruposFranja).map(g => ({
    canal: g.canal, marca: g.marca, fecha: g.fecha, hora: g.hora,
    dia_semana: g.dia_semana,
    pedidos: g.pedidos.size,
    unidades: g.unidades,
    importe: Math.round(g.importe * 100) / 100,
  }));

  return {
    platos,
    franjas,
    sinMarca,
    marcasDetectadas: [...marcasSet].sort((a, b) => a.localeCompare(b, 'es')),
  };
}
