/**
 * Parser G1 — Glovo orderDetails CSV
 *
 * Input: CSV descargado de Glovo Manager > Historial pedidos
 * Output: Estadísticas % Prime (Glovo Pro) por marca y mes
 */

import type { EstadisticaPrimePromo } from './parserUberGanancias';

// Detecta el separador real de la primera línea con datos (; , o tab)
function detectSep(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') || '';
  const counts: Record<string, number> = {
    ';': (firstLine.match(/;/g) || []).length,
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  };
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

function parseCSV(text: string): string[][] {
  const sep = detectSep(text);
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
      } else if (ch === sep) {
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

// Deja solo el nombre del local: corta en el primer "(" o salto de línea y limpia
function limpiarMarca(raw: string): string {
  let s = (raw || '').replace(/[\r\n]+/g, ' ');
  const corte = s.indexOf('(');
  if (corte > 0) s = s.slice(0, corte);
  return s.trim() || 'Sin marca';
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

  // Row 0 = headers
  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  // Buscar columnas por nombre (EN + ES)
  const colOrderId = findCol(
    headers,
    'Order ID', 'order_id', 'OrderID', 'Order code', 'Order number',
    'ID del pedido', 'Código de pedido', 'Codigo de pedido', 'Nº de pedido', 'Numero de pedido', 'Pedido',
  );
  const colMarca = findCol(
    headers,
    'Nombre del local', 'Nombre del establecimiento', 'Nombre de tienda',
    'Restaurant name', 'Store name', 'restaurant_name',
    'Local', 'Establecimiento', 'Restaurante', 'Marca',
    // 'Store'/'Tienda' al final: evita capturar "ID de tienda" antes que el nombre real
    'Store', 'Tienda',
  );
  const colPrime = findCol(
    headers,
    'Is Pro Order', 'is_pro', 'Pro Order', 'Glovo Prime', 'Prime',
    'Es Prime', 'Pedido Prime', 'Prime order',
  );
  const colEstado = findCol(
    headers,
    'Order status', 'order_status', 'Status', 'Estado', 'Estado del pedido',
  );

  // Buscar columna de fecha
  const colFecha = findCol(
    headers,
    'Order date', 'Date', 'Delivery date', 'order_date', 'Created',
    'Fecha', 'Fecha del pedido', 'Fecha de entrega', 'Fecha de pedido',
  );

  if (colOrderId === -1 || colMarca === -1) {
    throw new Error(
      'CSV Glovo: no se encuentran columnas obligatorias (pedido y establecimiento). Revisa que el archivo sea el "Historial de pedidos" de Glovo.'
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

    const marca = limpiarMarca(row[colMarca] || 'Sin marca');

    // Fecha
    let parsed: { mes: number; año: number } | null = null;
    if (colFecha !== -1) {
      parsed = parseFechaGlovo(row[colFecha] || '');
    }
    // Si no hay columna fecha, usar fecha actual
    if (!parsed) {
      const now = new Date();
      parsed = { mes: now.getMonth() + 1, año: now.getFullYear() };
    }

    const key = `${marca}|${parsed.mes}|${parsed.año}`;
    if (!grupos[key]) {
      grupos[key] = { total: 0, prime: 0, marca, mes: parsed.mes, año: parsed.año };
    }
    grupos[key].total++;

    // Prime = Is Pro Order = Y / Sí
    if (colPrime !== -1) {
      const val = (row[colPrime] || '').toUpperCase().trim();
      if (val === 'Y' || val === 'YES' || val === 'TRUE' || val === '1' || val === 'SÍ' || val === 'SI') {
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
