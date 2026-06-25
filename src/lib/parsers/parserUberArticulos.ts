/**
 * Parser U4 — Uber Eats · Detalle de ganancias nivel artículo (emea)
 * ~1.614 filas, separador coma, CON cabecera
 *
 * Columnas clave:
 *   - id pedido
 *   - fecha
 *   - hora a la que se aceptó (HH:MM:SS)
 *   - canal
 *   - Nombre del artículo
 *   - precio unitario
 *   - cantidad
 *   - Estado de la membresía Uber (Prime)
 *   - ventas con/sin IVA
 *
 * Output:
 *   - VentaPlato[]  → ventas_plato (estimado=false, origen='uber')
 *   - VentaFranja[] → ventas_franja
 */

import type { VentaFranja } from './parserSinqroSoldProducts';

export interface VentaPlato {
  canal: 'uber_eats' | 'glovo' | 'sinqro' | 'rushour';
  marca: string;
  plato: string;
  mes: number;
  año: number;
  unidades: number;
  ingresos_brutos: number;
  precio_medio: number;
}

export interface UberArticulosResult {
  platos: VentaPlato[];
  franjas: VentaFranja[];
}

// ── Exclusiones ─────────────────────────────────────────────────
const PALABRAS_EXCLUIR = [
  'agua', 'bebida', 'refresco', 'cola', 'fanta', 'nestea', 'cerveza',
  'pan', 'extra', 'adicional', 'cubiertos', 'servilleta',
  'bolsa', 'bag', 'packaging', 'cargo', 'envío',
];

function esModificadorOExtra(nombre: string): boolean {
  const n = nombre.trim();
  if (n.length >= 3 && n === n.toUpperCase() && /[A-Z]/.test(n)) return true;
  if (n.startsWith('[')) return true;
  const nl = n.toLowerCase();
  return PALABRAS_EXCLUIR.some(p => nl.includes(p));
}

// ── CSV parser robusto (comas, comillas dobles) ──────────────────
function parseCSV(text: string): string[][] {
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
      else if (ch === ',') { row.push(current.trim()); current = ''; }
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

// ── Búsqueda flexible de columnas ───────────────────────────────
function findCol(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ── Fecha y hora ─────────────────────────────────────────────────
interface FechaHora {
  fecha: string;
  mes: number;
  año: number;
  hora: number;
  dia_semana: number;
}

function parseFecha(s: string): { mes: number; año: number; fecha: string } | null {
  if (!s) return null;
  const parts = s.split(/[\/\-]/);
  if (parts.length < 3) return null;
  let año: number, mes: number, dia: number;
  if (parts[0].length === 4) {
    año = parseInt(parts[0]); mes = parseInt(parts[1]); dia = parseInt(parts[2]);
  } else {
    dia = parseInt(parts[0]); mes = parseInt(parts[1]);
    año = parseInt(parts[2]); if (año < 100) año += 2000;
  }
  const fecha = `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return { mes, año, fecha };
}

function parseHora(s: string): number {
  if (!s) return 12;
  const m = s.match(/^(\d{1,2}):/);
  return m ? parseInt(m[1]) : 12;
}

function diaSemanaFromFecha(fecha: string): number {
  const d = new Date(fecha);
  return (d.getDay() + 6) % 7; // 0=Lun, 6=Dom
}

function buildFechaHora(fechaStr: string, horaStr: string): FechaHora | null {
  const fParsed = parseFecha(fechaStr);
  if (!fParsed) return null;
  const hora = parseHora(horaStr);
  return {
    fecha: fParsed.fecha, mes: fParsed.mes, año: fParsed.año,
    hora, dia_semana: diaSemanaFromFecha(fParsed.fecha),
  };
}

// ── Export principal ─────────────────────────────────────────────
export function parseUberArticulos(csvText: string): VentaPlato[] {
  return parseUberArticulosFull(csvText).platos;
}

export function parseUberArticulosFull(csvText: string): UberArticulosResult {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return { platos: [], franjas: [] };

  // Uber emea: primera fila metadatos, segunda cabecera — o directamente cabecera
  // Detectamos: si la primera celda parece cabecera real (texto) o metadato
  let headerRowIdx = 0;
  if (allRows[0][0] && allRows[1] && allRows[1].length > allRows[0].length) {
    headerRowIdx = 1;
  }
  // Si la primera fila NO tiene 'artículo' ni 'item', intentamos fila 1
  const primeraFila = allRows[0].join('|').toLowerCase();
  if (!primeraFila.includes('artículo') && !primeraFila.includes('item') && allRows.length > 1) {
    headerRowIdx = 1;
  }

  const headers = allRows[headerRowIdx].map(h => h.trim());
  const dataRows = allRows.slice(headerRowIdx + 1);

  const colMarca   = findCol(headers, 'Nombre de la tienda', 'Store name', 'Tienda', 'Restaurant');
  const colPlato   = findCol(headers, 'Nombre del artículo', 'Item name', 'Artículo', 'Nombre artículo');
  const colFecha   = findCol(headers, 'Fecha del pedido', 'Order date', 'Fecha');
  const colHora    = findCol(headers, 'hora', 'time', 'aceptó', 'accepted');
  const colUnids   = findCol(headers, 'Cantidad', 'Quantity', 'Unidades', 'Items');
  const colIngreso = findCol(headers, 'Subtotal', 'ventas sin iva', 'ventas con iva', 'Ingresos', 'Price', 'Total');
  const colPedido  = findCol(headers, 'Id. pedido', 'Order ID', 'id pedido', 'order_id');
  const colEstado  = findCol(headers, 'Estado del pedido', 'Order status', 'status');

  if (colPlato === -1) {
    throw new Error('CSV Uber Artículos: no se encuentra columna de artículo. Verifica que sea "Detalle de ganancias nivel artículo".');
  }

  const gruposPlato: Record<string, {
    marca: string; plato: string; mes: number; año: number;
    unidades: number; ingresos: number;
  }> = {};

  const gruposFranja: Record<string, {
    marca: string; fecha: string; hora: number; dia_semana: number;
    pedidos: Set<string>; unidades: number; importe: number;
  }> = {};

  for (const row of dataRows) {
    // Filtrar cancelados
    if (colEstado !== -1) {
      const est = (row[colEstado] || '').toLowerCase();
      if (est && !est.includes('completado') && !est.includes('completed')) continue;
    }
    // Filtrar pedido vacío
    if (colPedido !== -1 && !row[colPedido]) continue;

    const platoRaw = row[colPlato] || '';
    if (!platoRaw || esModificadorOExtra(platoRaw)) continue;

    const plato = platoRaw.trim();
    const marca = colMarca !== -1 ? (row[colMarca] || 'Sin marca') : 'Sin marca';
    const unidades = colUnids !== -1 ? Math.max(1, parseInt(row[colUnids] || '1') || 1) : 1;
    const ingreso = colIngreso !== -1 ? parseFloat((row[colIngreso] || '0').replace(',', '.')) || 0 : 0;

    const fechaRaw = colFecha !== -1 ? (row[colFecha] || '') : '';
    const horaRaw  = colHora  !== -1 ? (row[colHora]  || '') : '';
    const fh = buildFechaHora(fechaRaw, horaRaw);
    const mes = fh?.mes ?? (new Date().getMonth() + 1);
    const año = fh?.año ?? new Date().getFullYear();

    // — ventas_plato —
    const keyPlato = `${marca}|${plato}|${mes}|${año}`;
    if (!gruposPlato[keyPlato]) {
      gruposPlato[keyPlato] = { marca, plato, mes, año, unidades: 0, ingresos: 0 };
    }
    gruposPlato[keyPlato].unidades += unidades;
    gruposPlato[keyPlato].ingresos += ingreso;

    // — ventas_franja —
    if (fh) {
      const keyFranja = `uber_eats|${marca}|${fh.fecha}|${fh.hora}`;
      if (!gruposFranja[keyFranja]) {
        gruposFranja[keyFranja] = {
          marca, fecha: fh.fecha, hora: fh.hora, dia_semana: fh.dia_semana,
          pedidos: new Set(), unidades: 0, importe: 0,
        };
      }
      if (colPedido !== -1 && row[colPedido]) gruposFranja[keyFranja].pedidos.add(row[colPedido]);
      gruposFranja[keyFranja].unidades += unidades;
      gruposFranja[keyFranja].importe += ingreso;
    }
  }

  const platos: VentaPlato[] = Object.values(gruposPlato).map(g => ({
    canal: 'uber_eats' as const,
    marca: g.marca, plato: g.plato, mes: g.mes, año: g.año,
    unidades: g.unidades,
    ingresos_brutos: Math.round(g.ingresos * 100) / 100,
    precio_medio: g.unidades > 0 ? Math.round((g.ingresos / g.unidades) * 100) / 100 : 0,
  }));

  const franjas: VentaFranja[] = Object.values(gruposFranja).map(g => ({
    canal: 'uber_eats', marca: g.marca, fecha: g.fecha, hora: g.hora,
    dia_semana: g.dia_semana,
    pedidos: g.pedidos.size,
    unidades: g.unidades,
    importe: Math.round(g.importe * 100) / 100,
  }));

  return { platos, franjas };
}
