import * as XLSX from 'xlsx'

export interface MovimientoBBVA {
  fecha: string
  concepto: string
  importe: number
  observaciones: string
}

function parseFecha(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') {
    const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
    const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return val.slice(0, 10)
    return val
  }
  if (typeof val === 'number') {
    // Serial date Excel (days since 1899-12-30)
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(epoch.getTime() + val * 86_400_000)
    return d.toISOString().slice(0, 10)
  }
  return String(val)
}

export function parsearBBVA(buffer: Buffer): MovimientoBBVA[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })

  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const joined = r.map((c) => (c == null ? '' : String(c))).join('|').toLowerCase()
    if (joined.includes('f.valor') && joined.includes('concepto')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) throw new Error('No se encontró cabecera BBVA (F.Valor + Concepto)')

  const movs: MovimientoBBVA[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const fechaRaw = r[2]
    const importe = r[5]
    if (!fechaRaw || importe == null || importe === '') continue
    const n = typeof importe === 'number' ? importe : parseFloat(String(importe).replace(',', '.'))
    if (isNaN(n)) continue
    movs.push({
      fecha: parseFecha(fechaRaw),
      concepto: String(r[3] || '').trim(),
      importe: n,
      observaciones: String(r[9] || '').trim(),
    })
  }
  return movs
}
