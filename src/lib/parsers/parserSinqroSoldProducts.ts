/**
 * Parser S1 — Sinqro Sold Products (sold_products_*.csv)
 * Separador: ;  |  SIN cabecera de nombres → mapear por posición
 *
 * Posiciones (0-based):
 *   0  id_pedido
 *   1  tienda|id_plataforma
 *   2  tipo (Delivery)
 *   3  canal (Glovo / Uber / JE / web)
 *   4  dirección → marca
 *   5  cantidad
 *   6  nombre de producto o modificador
 *   7  origen
 *   8  descuento
 *   9  fecha+hora  YYYY-MM-DD HH:MM:SS
 *  10  precio de línea
 *  11  total del pedido
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

// ── Exclusiones ─────────────────────────────────────────────────
// Modificadores: texto en MAYÚSCULAS o que empieza por '['
// Extras genéricos a excluir de ventas_plato
const PALABRAS_EXCLUIR = [
  'agua', 'bebida', 'refresco', 'cola', 'fanta', 'nestea', 'cerveza',
  'pan', 'extra', 'adicional', 'modificador', 'cubiertos', 'servilleta',
  'bolsa', 'bag', 'packaging', 'cargo', 'envío',
];

function esModificadorOExtra(nombre: string): boolean {
  const n = nombre.trim();
  // Todo MAYÚSCULAS (>=3 chars y ninguna minúscula)
  if (n.length >= 3 && n === n.toUpperCase() && /[A-Z]/.test(n)) return true;
  // Empieza por '['
  if (n.startsWith('[')) return true;
  // Lista de exclusión
  const nl = n.toLowerCase();
  return PALABRAS_EXCLUIR.some(p => nl.includes(p));
}

// ── Canal normalizado ────────────────────────────────────────────
function normalizarCanal(raw: string): VentaPlato['canal'] {
  const c = (raw || '').toLowerCase();
  if (c.includes('uber')) return 'uber_eats';
  if (c.includes('glovo')) return 'glovo';
  if (c.includes('just') || c.includes('je')) return 'sinqro';
  return 'sinqro';
}

// ── Marca desde dirección ────────────────────────────────────────
// La columna 4 contiene la dirección que identifica la marca.
// Extraemos la parte más significativa (hasta la primera coma).
function normalizarMarca(dir: string): string {
  if (!dir) return 'Sin marca';
  return dir.split(',')[0].trim() || dir.trim();
}

// ── Parseo CSV con separador ; ───────────────────────────────────
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

// ── Fecha+hora ───────────────────────────────────────────────────
interface FechaHora {
  fecha: string;     // YYYY-MM-DD
  mes: number;
  año: number;
  hora: number;
  dia_semana: number; // 0=Lunes, 6=Domingo
}

function parseFechaHora(s: string): FechaHora | null {
  if (!s) return null;
  // Espera "YYYY-MM-DD HH:MM:SS"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):\d{2}:\d{2})?/);
  if (!m) return null;
  const año = parseInt(m[1]);
  const mes = parseInt(m[2]);
  const dia = parseInt(m[3]);
  const hora = m[4] ? parseInt(m[4]) : 12; // fallback mediodía
  const fecha = `${m[1]}-${m[2]}-${m[3]}`;
  // getDay(): 0=Dom, 1=Lun … 6=Sab → convertimos a 0=Lun, 6=Dom
  const d = new Date(año, mes - 1, dia);
  const dia_semana = (d.getDay() + 6) % 7;
  return { fecha, mes, año, hora, dia_semana };
}

// ── Export principal ─────────────────────────────────────────────
export interface SinqroResult {
  platos: VentaPlato[];
  franjas: VentaFranja[];
}

export function parseSinqroSoldProducts(csvText: string): VentaPlato[] {
  return parseSinqroSoldProductsFull(csvText).platos;
}

export function parseSinqroSoldProductsFull(csvText: string): SinqroResult {
  const allRows = parseCSVSemicolon(csvText);
  if (allRows.length < 1) return { platos: [], franjas: [] };

  // Detectar si la primera fila es cabecera (contiene texto no numérico en col 0)
  const primeraCeldaEsTexto = isNaN(Number(allRows[0][0]));
  const dataRows = primeraCeldaEsTexto ? allRows.slice(1) : allRows;

  // Posiciones fijas según spec del handoff
  const POS_PEDIDO  = 0;
  const POS_CANAL   = 3;
  const POS_MARCA   = 4;
  const POS_UNIDS   = 5;
  const POS_PLATO   = 6;
  const POS_FECHA   = 9;
  const POS_PRECIO  = 10;

  const gruposPlato: Record<string, {
    canal: VentaPlato['canal']; marca: string; plato: string;
    mes: number; año: number; unidades: number; ingresos: number;
  }> = {};

  const gruposFranja: Record<string, {
    canal: string; marca: string; fecha: string; hora: number;
    dia_semana: number; pedidos: Set<string>; unidades: number; importe: number;
  }> = {};

  for (const row of dataRows) {
    if (!row[POS_PEDIDO]) continue; // fila vacía

    const platoRaw = row[POS_PLATO] || '';
    if (!platoRaw || esModificadorOExtra(platoRaw)) continue;

    const plato = platoRaw.trim();
    const marca = normalizarMarca(row[POS_MARCA] || '');
    const canal = normalizarCanal(row[POS_CANAL] || '');
    const unidades = Math.max(1, parseInt(row[POS_UNIDS] || '1') || 1);
    const ingreso = parseFloat((row[POS_PRECIO] || '0').replace(',', '.')) || 0;
    const fh = parseFechaHora(row[POS_FECHA] || '');
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
      gruposFranja[keyFranja].pedidos.add(row[POS_PEDIDO]);
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

  return { platos, franjas };
}
