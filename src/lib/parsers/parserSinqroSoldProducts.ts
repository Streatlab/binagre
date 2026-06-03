/**
 * Parser S1 — Sinqro Sold Products
 * Input: CSV de Sinqro > Exports > Sold products
 * Output: ventas por plato multi-plataforma
 */

import type { VentaPlato } from './parserUberArticulos';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '', inQuotes = false, row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i+1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(current.trim()); current = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i+1] === '\n')) {
        row.push(current.trim()); current = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = []; if (ch === '\r') i++;
      } else current += ch;
    }
  }
  if (current || row.length) { row.push(current.trim()); if (row.some(c => c !== '')) rows.push(row); }
  return rows;
}

function findCol(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseFecha(s: string): { mes: number; año: number } | null {
  if (!s) return null;
  const parts = s.split(/[\/\-\s]/);
  if (parts.length < 3) return null;
  if (parts[0].length === 4) return { mes: parseInt(parts[1]), año: parseInt(parts[0]) };
  let año = parseInt(parts[2]); if (año < 100) año += 2000;
  return { mes: parseInt(parts[1]), año };
}

function normalizarCanal(canal: string): VentaPlato['canal'] {
  const c = canal.toLowerCase();
  if (c.includes('uber')) return 'uber_eats';
  if (c.includes('glovo')) return 'glovo';
  return 'sinqro';
}

export function parseSinqroSoldProducts(csvText: string): VentaPlato[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  const colPlato   = findCol(headers, 'product', 'producto', 'item', 'name', 'nombre');
  const colMarca   = findCol(headers, 'brand', 'marca', 'restaurant', 'store', 'tienda');
  const colCanal   = findCol(headers, 'channel', 'canal', 'platform', 'plataforma', 'source');
  const colUnids   = findCol(headers, 'quantity', 'cantidad', 'units', 'unidades', 'qty');
  const colIngreso = findCol(headers, 'revenue', 'ingresos', 'total', 'price', 'precio', 'subtotal');
  const colFecha   = findCol(headers, 'date', 'fecha', 'created', 'order_date', 'day');

  if (colPlato === -1) {
    throw new Error('CSV Sinqro: no se encuentra columna de producto/plato. Verifica que sea "Sold products".');
  }

  const grupos: Record<string, { canal: VentaPlato['canal']; marca: string; plato: string; mes: number; año: number; unidades: number; ingresos: number }> = {};

  for (const row of dataRows) {
    const plato = row[colPlato] || 'Sin nombre';
    const marca = colMarca !== -1 ? (row[colMarca] || 'Sin marca') : 'Sin marca';
    const canalRaw = colCanal !== -1 ? (row[colCanal] || 'sinqro') : 'sinqro';
    const canal = normalizarCanal(canalRaw);
    const unidades = colUnids !== -1 ? Math.max(1, parseInt(row[colUnids] || '1') || 1) : 1;
    const ingreso = colIngreso !== -1 ? parseFloat((row[colIngreso] || '0').replace(',', '.')) || 0 : 0;
    const parsed = colFecha !== -1 ? parseFecha(row[colFecha] || '') : null;
    const { mes, año } = parsed || { mes: new Date().getMonth() + 1, año: new Date().getFullYear() };

    const key = `${canal}|${marca}|${plato}|${mes}|${año}`;
    if (!grupos[key]) grupos[key] = { canal, marca, plato, mes, año, unidades: 0, ingresos: 0 };
    grupos[key].unidades += unidades;
    grupos[key].ingresos += ingreso;
  }

  return Object.values(grupos).map(g => ({
    canal: g.canal, marca: g.marca, plato: g.plato, mes: g.mes, año: g.año,
    unidades: g.unidades,
    ingresos_brutos: Math.round(g.ingresos * 100) / 100,
    precio_medio: g.unidades > 0 ? Math.round((g.ingresos / g.unidades) * 100) / 100 : 0,
  }));
}
