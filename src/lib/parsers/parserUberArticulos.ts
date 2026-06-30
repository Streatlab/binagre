/**
 * Parser U4 — Uber Eats · Detalle de ganancias nivel artículo (emea)
 *
 * ESTRUCTURA REAL DEL CSV (verificada contra archivo real):
 * Hay DOS tipos de filas intercaladas, enlazadas por col1 (workflow_id):
 *
 * FILA-PEDIDO (col0 = "#XXXXX", col2 = marca):
 *   col0  = Id pedido
 *   col1  = workflow_id (clave de join)
 *   col2  = Nombre de la tienda (marca)
 *   col5  = Fecha (DD/MM/YY o DD/MM/YYYY)
 *   col6  = Hora aceptación (HH:MM)
 *   col23 = Estado membresía Uber ("Miembro de Uber One" / "No miembro")
 *
 * FILA-ARTÍCULO (col0 vacío, col10 = nombre artículo):
 *   col1  = workflow_id (clave de join con fila-pedido)
 *   col10 = Nombre del artículo
 *   col20 = Cantidad solicitada
 *   col21 = Cantidad final
 *   col22 = Precio unitario
 *
 * Output:
 *   - VentaPlato[]  → ventas_plato (estimado=false, origen='uber')
 *   - VentaFranja[] → ventas_franja (hora, dia_semana)
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

// ── Exclusiones ──────────────────────────────────────────────────
const PALABRAS_EXCLUIR = [
  'agua', 'bebida', 'refresco', 'cola', 'fanta', 'nestea', 'cerveza',
  'pan', 'extra', 'adicional', 'cubiertos', 'servilleta',
  'bolsa', 'bag', 'packaging', 'cargo', 'envío',
];

function esModificadorOExtra(nombre: string): boolean {
  const n = nombre.trim();
  if (!n) return true;
  // Todo mayúsculas ≥3 chars
  if (n.length >= 3 && n === n.toUpperCase() && /[A-Z]/.test(n)) return true;
  // Empieza por '['
  if (n.startsWith('[')) return true;
  const nl = n.toLowerCase();
  return PALABRAS_EXCLUIR.some(p => nl.includes(p));
}

// ── CSV robusto (comas, comillas) ────────────────────────────────
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

// ── Fecha DD/MM/YY o YYYY-MM-DD ─────────────────────────────────
function parseFecha(s: string): { mes: number; año: number; fecha: string } | null {
  if (!s) return null;
  s = s.trim();
  // DD/MM/YY o DD/MM/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const dia = parseInt(m[1]), mes = parseInt(m[2]);
    let año = parseInt(m[3]); if (año < 100) año += 2000;
    const fecha = `${año}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    return { mes, año, fecha };
  }
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const año = parseInt(m[1]), mes = parseInt(m[2]);
    return { mes, año, fecha: `${m[1]}-${m[2]}-${m[3]}` };
  }
  return null;
}

function parseHora(s: string): number {
  if (!s) return 12;
  const m = s.trim().match(/^(\d{1,2}):/);
  return m ? parseInt(m[1]) : 12;
}

function diaSemana(fecha: string): number {
  const d = new Date(fecha);
  return (d.getDay() + 6) % 7; // 0=Lun, 6=Dom
}

// ── Exports ──────────────────────────────────────────────────────
export function parseUberArticulos(csvText: string): VentaPlato[] {
  return parseUberArticulosFull(csvText).platos;
}

export function parseUberArticulosFull(csvText: string): UberArticulosResult {
  // Quitar BOM si hay
  const text = csvText.replace(/^\uFEFF/, '');
  const allRows = parseCSV(text);
  if (allRows.length < 2) return { platos: [], franjas: [] };

  // Fila 0 = cabecera real (verificado: "Id. del pedido", "Nombre del artículo" en col 10, etc.)
  const dataRows = allRows.slice(1);

  // PASO 1 — construir mapa workflow_id → datos del pedido (marca, fecha, hora, membresía)
  interface PedidoMeta {
    marca: string;
    fecha: string;
    mes: number;
    año: number;
    hora: number;
    dia_semana: number;
    id_pedido: string;
  }
  const pedidoMeta = new Map<string, PedidoMeta>();

  for (const row of dataRows) {
    const id_pedido = (row[0] || '').trim();
    const workflow_id = (row[1] || '').trim();
    const marca = (row[2] || '').trim();
    if (!workflow_id || !marca) continue; // no es fila-pedido

    const fp = parseFecha(row[5] || '');
    if (!fp) continue;
    const hora = parseHora(row[6] || '');
    pedidoMeta.set(workflow_id, {
      marca,
      fecha: fp.fecha,
      mes: fp.mes,
      año: fp.año,
      hora,
      dia_semana: diaSemana(fp.fecha),
      id_pedido,
    });
  }

  // PASO 2 — procesar filas-artículo y cruzar con pedidoMeta
  const gruposPlato: Record<string, {
    marca: string; plato: string; mes: number; año: number;
    unidades: number; ingresos: number;
  }> = {};

  const gruposFranja: Record<string, {
    marca: string; fecha: string; hora: number; dia_semana: number;
    pedidos: Set<string>; unidades: number; importe: number;
  }> = {};

  for (const row of dataRows) {
    const id_pedido = (row[0] || '').trim();
    const workflow_id = (row[1] || '').trim();
    const nombre_art = (row[10] || '').trim();

    // Fila-artículo: col0 vacío + col10 lleno
    if (id_pedido !== '' || !nombre_art || !workflow_id) continue;
    if (esModificadorOExtra(nombre_art)) continue;

    const meta = pedidoMeta.get(workflow_id);
    if (!meta) continue; // sin pedido padre, ignorar

    const unidades = Math.max(1, parseInt(row[21] || row[20] || '1') || 1); // col21=final, col20=solicitada
    const precio_unit = parseFloat((row[22] || '0').replace(',', '.')) || 0;
    const ingreso = precio_unit * unidades;

    // — ventas_plato —
    const keyPlato = `${meta.marca}|${nombre_art}|${meta.mes}|${meta.año}`;
    if (!gruposPlato[keyPlato]) {
      gruposPlato[keyPlato] = { marca: meta.marca, plato: nombre_art, mes: meta.mes, año: meta.año, unidades: 0, ingresos: 0 };
    }
    gruposPlato[keyPlato].unidades += unidades;
    gruposPlato[keyPlato].ingresos += ingreso;

    // — ventas_franja —
    const keyFranja = `uber_eats|${meta.marca}|${meta.fecha}|${meta.hora}`;
    if (!gruposFranja[keyFranja]) {
      gruposFranja[keyFranja] = {
        marca: meta.marca, fecha: meta.fecha, hora: meta.hora,
        dia_semana: meta.dia_semana, pedidos: new Set(), unidades: 0, importe: 0,
      };
    }
    gruposFranja[keyFranja].pedidos.add(meta.id_pedido);
    gruposFranja[keyFranja].unidades += unidades;
    gruposFranja[keyFranja].importe += ingreso;
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
