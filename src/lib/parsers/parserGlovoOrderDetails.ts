/**
 * Parser G1 — Glovo orderDetails CSV
 *
 * Input: CSV descargado de Glovo Manager > Historial pedidos
 * Output: Estadísticas % Prime (Glovo Pro) por marca y mes
 */

import type { EstadisticaPrimePromo } from './parserUberGanancias';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current.trim());
        current = '';
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length) {
    row.push(current.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }
  return rows;
}

function findCol(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const idx = headers.findIndex((h) => h.toLowerCase().includes(lower));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseFechaGlovo(fecha: string): { mes: number; año: number } | null {
  if (!fecha) return null;
  // Formatos comunes: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD/MM/YY
  const parts = fecha.split(/[\/\-\s]/);
  if (parts.length < 3) return null;

  if (parts[0].length === 4) {
    return { mes: parseInt(parts[1], 10), año: parseInt(parts[0], 10) };
  }
  let año = parseInt(parts[2], 10);
  if (año < 100) año += 2000;
  return { mes: parseInt(parts[1], 10), año };
}

export function parseGlovoOrderDetails(csvText: string): EstadisticaPrimePromo[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  // Row 0 = headers (inglés)
  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  // Buscar columnas por nombre
  const colOrderId = findCol(headers, 'Order ID', 'order_id', 'OrderID');
  const colMarca = findCol(headers, 'Restaurant name', 'Store name', 'restaurant_name');
  const colPrime = findCol(headers, 'Is Pro Order', 'is_pro', 'Pro Order');
  const colEstado = findCol(headers, 'Order status', 'order_status', 'Status');

  // Buscar columna de fecha — puede ser "Order date", "Date", "Delivery date", etc.
  const colFecha = findCol(headers, 'Order date', 'Date', 'Delivery date', 'order_date', 'Created');

  if (colOrderId === -1 || colMarca === -1) {
    throw new Error(
      'CSV Glovo: no se encuentran columnas obligatorias (Order ID, Restaurant name). Revisa que el archivo sea "orderDetails".'
    );
  }

  const grupos: Record<
    string,
    { total: number; prime: number; marca: string; mes: number; año: number }
  > = {};

  for (const row of dataRows) {
    // Filtrar filas sin Order ID
    const orderId = row[colOrderId] || '';
    if (!orderId) continue;

    // Filtrar solo delivered
    if (colEstado !== -1) {
      const estado = (row[colEstado] || '').toLowerCase();
      if (estado && !estado.includes('delivered') && !estado.includes('entregado')) continue;
    }

    const marca = row[colMarca] || 'Sin marca';

    // Fecha
    let parsed: { mes: number; año: number } | null = null;
    if (colFecha !== -1) {
      parsed = parseFechaGlovo(row[colFecha] || '');
    }
    // Si no hay columna fecha, intentar extraer de Order ID o usar fecha actual
    if (!parsed) {
      const now = new Date();
      parsed = { mes: now.getMonth() + 1, año: now.getFullYear() };
    }

    const key = `${marca}|${parsed.mes}|${parsed.año}`;
    if (!grupos[key]) {
      grupos[key] = { total: 0, prime: 0, marca, mes: parsed.mes, año: parsed.año };
    }
    grupos[key].total++;

    // Prime = Is Pro Order = Y
    if (colPrime !== -1) {
      const val = (row[colPrime] || '').toUpperCase().trim();
      if (val === 'Y' || val === 'YES' || val === 'TRUE' || val === '1') {
        grupos[key].prime++;
      }
    }
  }

  return Object.values(grupos).map((g) => ({
    canal: 'glovo' as const,
    marca: g.marca,
    mes: g.mes,
    año: g.año,
    pedidos_total: g.total,
    pedidos_prime: g.prime,
    pedidos_promo: 0,
    pct_prime: g.total > 0 ? Math.round((g.prime / g.total) * 10000) / 10000 : 0,
    pct_promo: 0,
  }));
}
