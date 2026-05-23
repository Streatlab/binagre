/**
 * Parser U3 — Uber Detalle de ganancias nivel artículo
 * Input: CSV de Uber Eats Manager > Informes > Detalle de ganancias nivel artículo
 * Output: ventas por plato, marca, canal y mes
 */

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

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(current.trim()); current = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current.trim()); current = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = []; if (ch === '\r') i++;
      } else { current += ch; }
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
  const parts = s.split(/[\/\-]/);
  if (parts.length < 3) return null;
  if (parts[0].length === 4) return { mes: parseInt(parts[1]), año: parseInt(parts[0]) };
  let año = parseInt(parts[2]); if (año < 100) año += 2000;
  return { mes: parseInt(parts[1]), año };
}

export function parseUberArticulos(csvText: string): VentaPlato[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 3) return [];

  // Row 1 = headers cortos (igual que U1)
  const headers = allRows[1];
  const dataRows = allRows.slice(2);

  const colMarca   = findCol(headers, 'Nombre de la tienda', 'Store name', 'Tienda');
  const colPlato   = findCol(headers, 'Nombre del artículo', 'Item name', 'Artículo', 'Plato');
  const colFecha   = findCol(headers, 'Fecha del pedido', 'Order date', 'Fecha');
  const colUnids   = findCol(headers, 'Cantidad', 'Quantity', 'Unidades', 'Items');
  const colIngreso = findCol(headers, 'Subtotal', 'Ingresos', 'Precio', 'Price', 'Total');
  const colPedido  = findCol(headers, 'Id. pedido', 'Order ID');
  const colEstado  = findCol(headers, 'Estado del pedido', 'Order status');

  if (colMarca === -1 || colPlato === -1) {
    throw new Error('CSV Uber Artículos: no se encuentran columnas obligatorias (Nombre tienda, Nombre artículo). Verifica que sea "Detalle de ganancias nivel artículo".');
  }

  const grupos: Record<string, { marca: string; plato: string; mes: number; año: number; unidades: number; ingresos: number }> = {};

  for (const row of dataRows) {
    if (colPedido !== -1 && !row[colPedido]) continue;
    if (colEstado !== -1) {
      const est = (row[colEstado] || '').toLowerCase();
      if (est && !est.includes('completado') && !est.includes('completed')) continue;
    }
    const marca = row[colMarca] || 'Sin marca';
    const plato = row[colPlato] || 'Sin nombre';
    const parsed = colFecha !== -1 ? parseFecha(row[colFecha] || '') : null;
    const { mes, año } = parsed || { mes: new Date().getMonth() + 1, año: new Date().getFullYear() };
    const unidades = colUnids !== -1 ? Math.max(1, parseInt(row[colUnids] || '1') || 1) : 1;
    const ingreso = colIngreso !== -1 ? parseFloat((row[colIngreso] || '0').replace(',', '.')) || 0 : 0;

    const key = `${marca}|${plato}|${mes}|${año}`;
    if (!grupos[key]) grupos[key] = { marca, plato, mes, año, unidades: 0, ingresos: 0 };
    grupos[key].unidades += unidades;
    grupos[key].ingresos += ingreso;
  }

  return Object.values(grupos).map(g => ({
    canal: 'uber_eats' as const,
    marca: g.marca, plato: g.plato, mes: g.mes, año: g.año,
    unidades: g.unidades,
    ingresos_brutos: Math.round(g.ingresos * 100) / 100,
    precio_medio: g.unidades > 0 ? Math.round((g.ingresos / g.unidades) * 100) / 100 : 0,
  }));
}
