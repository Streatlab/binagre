/**
 * Parser G5 — Glovo Clientes CSV (Fase 4)
 * Input: CSV de Glovo Manager > Rendimiento > Clientes
 * Output: métricas de clientes nuevos vs recurrentes por marca y mes
 */

export interface MetricasClientes {
  marca: string;
  mes: number;
  año: number;
  clientes_total: number;
  clientes_nuevos: number;
  clientes_recurrentes: number;
  pct_nuevos: number;
  pct_recurrentes: number;
  impresiones: number;
  tasa_conversion: number;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '', inQuotes = false, row: string[] = [];
  const sep = text.indexOf(';') !== -1 && text.indexOf(';') < (text.indexOf(',') === -1 ? 9999 : text.indexOf(',')) ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i+1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep) { row.push(current.trim()); current = ''; }
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
  if (parts.length < 2) return null;
  if (parts[0].length === 4) return { mes: parseInt(parts[1]), año: parseInt(parts[0]) };
  let año = parseInt(parts[parts.length - 1]); if (año < 100) año += 2000;
  return { mes: parseInt(parts[1]), año };
}

export function parseGlovoClientes(csvText: string): MetricasClientes[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  const colMarca      = findCol(headers, 'restaurant', 'brand', 'marca', 'store', 'tienda', 'nombre');
  const colFecha      = findCol(headers, 'date', 'fecha', 'month', 'mes', 'period', 'periodo');
  const colTotal      = findCol(headers, 'total_customers', 'total clients', 'clientes_total', 'customers', 'clients');
  const colNuevos     = findCol(headers, 'new_customers', 'new clients', 'nuevos', 'new');
  const colRecur      = findCol(headers, 'returning', 'recurrentes', 'repeat', 'loyal');
  const colImpresiones= findCol(headers, 'impressions', 'impresiones', 'views', 'vistas');
  const colConversion = findCol(headers, 'conversion', 'conversi', 'rate');

  if (colMarca === -1 && colTotal === -1) {
    throw new Error('CSV Glovo Clientes: no se encuentran columnas esperadas. Verifica que sea "Rendimiento > Clientes".');
  }

  const grupos: Record<string, { marca: string; mes: number; año: number; total: number; nuevos: number; recurrentes: number; impresiones: number; conversion: number; count: number }> = {};

  for (const row of dataRows) {
    const marca = colMarca !== -1 ? (row[colMarca] || 'Sin marca') : 'Sin marca';
    const parsed = colFecha !== -1 ? parseFecha(row[colFecha] || '') : null;
    const { mes, año } = parsed || { mes: new Date().getMonth() + 1, año: new Date().getFullYear() };

    const total       = colTotal !== -1       ? parseInt(row[colTotal] || '0') || 0       : 0;
    const nuevos      = colNuevos !== -1      ? parseInt(row[colNuevos] || '0') || 0      : 0;
    const recurrentes = colRecur !== -1       ? parseInt(row[colRecur] || '0') || 0       : total - nuevos;
    const impresiones = colImpresiones !== -1 ? parseInt(row[colImpresiones] || '0') || 0 : 0;
    const conversion  = colConversion !== -1  ? parseFloat((row[colConversion] || '0').replace(',', '.').replace('%', '')) || 0 : 0;

    const key = `${marca}|${mes}|${año}`;
    if (!grupos[key]) grupos[key] = { marca, mes, año, total: 0, nuevos: 0, recurrentes: 0, impresiones: 0, conversion: 0, count: 0 };
    grupos[key].total       += total;
    grupos[key].nuevos      += nuevos;
    grupos[key].recurrentes += recurrentes;
    grupos[key].impresiones += impresiones;
    grupos[key].conversion  += conversion;
    grupos[key].count++;
  }

  return Object.values(grupos).map(g => ({
    marca: g.marca, mes: g.mes, año: g.año,
    clientes_total:      g.total,
    clientes_nuevos:     g.nuevos,
    clientes_recurrentes: g.recurrentes,
    pct_nuevos:      g.total > 0 ? Math.round((g.nuevos / g.total) * 10000) / 10000 : 0,
    pct_recurrentes: g.total > 0 ? Math.round((g.recurrentes / g.total) * 10000) / 10000 : 0,
    impresiones: g.impresiones,
    tasa_conversion: g.count > 0 ? Math.round((g.conversion / g.count) * 100) / 100 : 0,
  }));
}
