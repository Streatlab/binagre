/**
 * Parser R3 — Rushour Desglose plataformas
 * Input: CSV de Rushour > Negocio > Desglose plataforma > Pedidos
 * Output: pedidos e ingresos por plataforma y marca por mes
 */

export interface ResumenPlataforma {
  canal: string;
  marca: string;
  mes: number;
  año: number;
  pedidos: number;
  ingresos: number;
  ticket_medio: number;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '', inQuotes = false, row: string[] = [];
  // Detectar separador: coma o punto y coma
  const sep = text.indexOf(';') !== -1 && text.indexOf(';') < text.indexOf(',') ? ';' : ',';
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

export function parseRushourPlataformas(csvText: string): ResumenPlataforma[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  const colCanal   = findCol(headers, 'platform', 'plataforma', 'canal', 'channel', 'source');
  const colMarca   = findCol(headers, 'brand', 'marca', 'restaurant', 'store', 'tienda', 'nombre');
  const colPedidos = findCol(headers, 'orders', 'pedidos', 'quantity', 'count', 'total_orders');
  const colIngreso = findCol(headers, 'revenue', 'ingresos', 'total', 'sales', 'ventas', 'gmv');
  const colFecha   = findCol(headers, 'date', 'fecha', 'month', 'mes', 'period', 'periodo');

  if (colCanal === -1 && colMarca === -1) {
    throw new Error('CSV Rushour Plataformas: no se encuentran columnas de plataforma o marca. Verifica que sea "Desglose plataforma".');
  }

  const grupos: Record<string, { canal: string; marca: string; mes: number; año: number; pedidos: number; ingresos: number }> = {};

  for (const row of dataRows) {
    const canal = colCanal !== -1 ? (row[colCanal] || 'Sin canal') : 'Sin canal';
    const marca = colMarca !== -1 ? (row[colMarca] || 'Sin marca') : 'Sin marca';
    const pedidos = colPedidos !== -1 ? parseInt(row[colPedidos] || '0') || 0 : 0;
    const ingreso = colIngreso !== -1 ? parseFloat((row[colIngreso] || '0').replace(',', '.')) || 0 : 0;
    const parsed = colFecha !== -1 ? parseFecha(row[colFecha] || '') : null;
    const { mes, año } = parsed || { mes: new Date().getMonth() + 1, año: new Date().getFullYear() };

    const key = `${canal}|${marca}|${mes}|${año}`;
    if (!grupos[key]) grupos[key] = { canal, marca, mes, año, pedidos: 0, ingresos: 0 };
    grupos[key].pedidos += pedidos;
    grupos[key].ingresos += ingreso;
  }

  return Object.values(grupos).map(g => ({
    canal: g.canal, marca: g.marca, mes: g.mes, año: g.año,
    pedidos: g.pedidos,
    ingresos: Math.round(g.ingresos * 100) / 100,
    ticket_medio: g.pedidos > 0 ? Math.round((g.ingresos / g.pedidos) * 100) / 100 : 0,
  }));
}
