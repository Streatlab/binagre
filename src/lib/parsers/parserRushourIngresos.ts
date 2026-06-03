/**
 * Parser R4+R5 — Rushour Ingresos + Volumen pedidos (Fase 3)
 * Input: CSVs de Rushour > Informes > Ingresos totales / Volumen pedidos
 * Output: serie diaria de ingresos y pedidos
 */

export interface SerieDiaria {
  fecha: string; // YYYY-MM-DD
  mes: number;
  año: number;
  marca: string;
  canal: string;
  pedidos: number;
  ingresos: number;
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

function normalizarFecha(s: string): { fecha: string; mes: number; año: number } | null {
  if (!s) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.split('-');
    return { fecha: `${y}-${m}-${d.substring(0,2)}`, mes: parseInt(m), año: parseInt(y) };
  }
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split('/');
    return { fecha: `${y}-${m}-${d}`, mes: parseInt(m), año: parseInt(y) };
  }
  // DD/MM/YY
  if (/^\d{2}\/\d{2}\/\d{2}/.test(s)) {
    const [d, m, y] = s.split('/');
    const año = 2000 + parseInt(y);
    return { fecha: `${año}-${m}-${d}`, mes: parseInt(m), año };
  }
  return null;
}

export function parseRushourIngresos(csvText: string, tipo: 'ingresos' | 'volumen'): SerieDiaria[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  const colFecha   = findCol(headers, 'date', 'fecha', 'day', 'dia', 'día', 'period', 'periodo');
  const colMarca   = findCol(headers, 'brand', 'marca', 'restaurant', 'store', 'tienda');
  const colCanal   = findCol(headers, 'platform', 'plataforma', 'canal', 'channel');
  const colValor   = tipo === 'ingresos'
    ? findCol(headers, 'revenue', 'ingresos', 'total', 'sales', 'ventas', 'gmv', 'amount')
    : findCol(headers, 'orders', 'pedidos', 'quantity', 'count', 'volume', 'volumen');

  if (colFecha === -1) {
    throw new Error(`CSV Rushour ${tipo}: no se encuentra columna de fecha. Verifica el archivo.`);
  }

  const rows: SerieDiaria[] = [];

  for (const row of dataRows) {
    const fechaRaw = row[colFecha] || '';
    const parsedFecha = normalizarFecha(fechaRaw);
    if (!parsedFecha) continue;

    const marca = colMarca !== -1 ? (row[colMarca] || 'Global') : 'Global';
    const canal = colCanal !== -1 ? (row[colCanal] || 'Global') : 'Global';
    const valor = colValor !== -1 ? parseFloat((row[colValor] || '0').replace(',', '.')) || 0 : 0;

    rows.push({
      fecha: parsedFecha.fecha,
      mes: parsedFecha.mes,
      año: parsedFecha.año,
      marca, canal,
      pedidos: tipo === 'volumen' ? Math.round(valor) : 0,
      ingresos: tipo === 'ingresos' ? Math.round(valor * 100) / 100 : 0,
    });
  }

  return rows;
}
