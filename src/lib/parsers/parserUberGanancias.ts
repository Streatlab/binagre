/**
 * Parser U1 — Uber Detalle de Ganancias CSV
 *
 * Input: CSV descargado de Uber Eats Manager > Informes > Detalle de ganancias
 * Output: Estadísticas % Prime (Uber One) y % Promo por marca y mes
 *
 * Estructura del CSV:
 * - Row 0: descripciones largas (ignorar)
 * - Row 1: nombres cortos de columna (usar como header)
 * - Row 2+: datos
 */

export interface EstadisticaPrimePromo {
  canal: 'uber_eats' | 'glovo';
  marca: string;
  mes: number;
  año: number;
  pedidos_total: number;
  pedidos_prime: number;
  pedidos_promo: number;
  pct_prime: number;
  pct_promo: number;
}

interface UberRow {
  [key: string]: string;
}

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

function parseFechaUber(fecha: string): { mes: number; año: number } | null {
  // Formatos: DD/MM/YY, DD/MM/YYYY, YYYY-MM-DD
  if (!fecha) return null;
  const parts = fecha.split(/[\/\-]/);
  if (parts.length < 3) return null;

  if (parts[0].length === 4) {
    // YYYY-MM-DD
    return { mes: parseInt(parts[1], 10), año: parseInt(parts[0], 10) };
  }
  // DD/MM/YY o DD/MM/YYYY
  let año = parseInt(parts[2], 10);
  if (año < 100) año += 2000;
  return { mes: parseInt(parts[1], 10), año };
}

export function parseUberGanancias(csvText: string): EstadisticaPrimePromo[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 3) return [];

  // Row 1 (index 1) = headers cortos
  const headers = allRows[1];
  const dataRows = allRows.slice(2);

  // Buscar columnas por nombre
  const colPedido = findCol(headers, 'Id. pedido', 'Order ID', 'Id pedido');
  const colMarca = findCol(headers, 'Nombre de la tienda', 'Store Name', 'Tienda');
  const colFecha = findCol(headers, 'Fecha del pedido', 'Order Date', 'Fecha');
  const colPrime = findCol(headers, 'Estado de la membresía de Uber', 'Uber membership', 'membresía');
  const colPromo = findCol(headers, 'Tarifa por canje de la oferta', 'Offer redemption', 'canje');
  const colEstado = findCol(headers, 'Estado del pedido', 'Order Status', 'Estado');

  if (colPedido === -1 || colMarca === -1 || colFecha === -1) {
    throw new Error(
      'CSV Uber: no se encuentran columnas obligatorias (Id. pedido, Nombre de la tienda, Fecha del pedido). Revisa que el archivo sea "Detalle de ganancias".'
    );
  }

  // Agrupar
  const grupos: Record<
    string,
    { total: number; prime: number; promo: number; marca: string; mes: number; año: number }
  > = {};

  for (const row of dataRows) {
    // Filtrar filas sin Id. pedido (son filas de ads)
    const pedidoId = row[colPedido] || '';
    if (!pedidoId) continue;

    // Filtrar solo estado Completado
    if (colEstado !== -1) {
      const estado = (row[colEstado] || '').toLowerCase();
      if (estado && !estado.includes('completado') && !estado.includes('completed')) continue;
    }

    const marca = row[colMarca] || 'Sin marca';
    const fechaStr = row[colFecha] || '';
    const parsed = parseFechaUber(fechaStr);
    if (!parsed) continue;

    const key = `${marca}|${parsed.mes}|${parsed.año}`;
    if (!grupos[key]) {
      grupos[key] = { total: 0, prime: 0, promo: 0, marca, mes: parsed.mes, año: parsed.año };
    }
    grupos[key].total++;

    // Prime = Uber One
    if (colPrime !== -1) {
      const val = (row[colPrime] || '').toLowerCase();
      if (val.includes('uber one') || val.includes('miembro')) {
        grupos[key].prime++;
      }
    }

    // Promo
    if (colPromo !== -1) {
      const val = parseFloat((row[colPromo] || '0').replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        grupos[key].promo++;
      }
    }
  }

  return Object.values(grupos).map((g) => ({
    canal: 'uber_eats' as const,
    marca: g.marca,
    mes: g.mes,
    año: g.año,
    pedidos_total: g.total,
    pedidos_prime: g.prime,
    pedidos_promo: g.promo,
    pct_prime: g.total > 0 ? Math.round((g.prime / g.total) * 10000) / 10000 : 0,
    pct_promo: g.total > 0 ? Math.round((g.promo / g.total) * 10000) / 10000 : 0,
  }));
}
