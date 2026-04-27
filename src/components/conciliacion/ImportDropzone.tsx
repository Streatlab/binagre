import { useRef, useState, useEffect } from 'react'
import { Upload, FileCheck2 } from 'lucide-react'
import { useTheme, FONT } from '@/styles/tokens'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

/* ── Constantes para auto-detección titular ── */
const NIF_RUBEN  = '21669051S'
const NIF_EMILIO = '53484832B'
const RUBEN_ID   = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID  = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

export function resolverTitularPorNif(nif: string | null | undefined): string | null {
  if (!nif) return null
  const n = nif.trim().toUpperCase()
  if (n === NIF_RUBEN)  return RUBEN_ID
  if (n === NIF_EMILIO) return EMILIO_ID
  return null
}

export interface ParsedRow {
  fecha: string
  concepto: string
  importe: number
  contraparte?: string
  notas?: string
  ordenante?: string | null
  beneficiario?: string | null
  titular_id?: string | null
}

interface Props {
  onFileLoaded: (rows: ParsedRow[], meta: { fileName: string }) => void
  importResult?: { insertados: number; duplicados: number; omitidos: number } | null
}

/* ─────────────────────────  HELPERS  ───────────────────────── */

function parseFechaISO(raw: unknown): string {
  if (raw == null) return ''
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(raw).trim()
  if (!s) return ''
  // DD/MM/YYYY o DD-MM-YYYY
  let m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  // DD/MM/YY
  m = /^(\d{2})[\/-](\d{2})[\/-](\d{2})$/.exec(s)
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`
  // YYYY-MM-DD (ISO)
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return ''
}

function parseImporte(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (raw == null) return NaN
  let s = String(raw).trim().replace(/€/g, '').replace(/EUR/gi, '').trim()
  if (!s) return NaN
  // Paréntesis = negativo (formato contable)
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1).trim()
  // Formato ES: "1.234,56" o "-1.234,56" o "12,34"
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? NaN : n
}

/* ─────────────────────────  XLSX PARSER  ───────────────────────── */

function parseXLSX(wb: XLSX.WorkBook): ParsedRow[] {
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })

  // Localizar fila de cabecera (escanear hasta fila 20). En BBVA está en fila 5 (idx 4).
  let headerIdx = -1
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const cells = (rows[i] || []).map(c => String(c ?? '').trim().toLowerCase())
    const tieneFecha    = cells.some(c => c === 'fecha' || c === 'f.valor' || c === 'f. valor')
    const tieneConcepto = cells.some(c => c === 'concepto' || c.includes('concepto') || c.includes('descrip'))
    const tieneImporte  = cells.some(c => c === 'importe' || c.includes('importe') || c.includes('amount'))
    if (tieneFecha && tieneConcepto && tieneImporte) { headerIdx = i; break }
  }
  if (headerIdx === -1) return []

  const headers = (rows[headerIdx] || []).map(c => String(c ?? '').trim().toLowerCase())
  const find = (...names: string[]) => headers.findIndex(h => names.some(n => h === n || h.includes(n)))

  const idxFecha        = find('fecha')
  const idxFvalor       = find('f.valor', 'f. valor')
  const idxConcepto     = find('concepto', 'descripcion', 'descripción')
  const idxMovimiento   = find('movimiento')
  const idxImporte      = find('importe', 'amount')
  const idxObserv       = find('observaciones', 'observ')
  // beneficiario: columna BBVA "Beneficiario" (también "contraparte", "origen")
  const idxBenef        = find('beneficiario', 'contraparte', 'origen')
  // ordenante: columna BBVA "Ordenante"
  const idxOrdenante    = find('ordenante')

  const out: ParsedRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const fechaRaw =
      idxFecha   >= 0 && row[idxFecha]   != null && row[idxFecha]   !== '' ? row[idxFecha]   :
      idxFvalor  >= 0 && row[idxFvalor]  != null && row[idxFvalor]  !== '' ? row[idxFvalor]  :
      null
    const importeRaw = idxImporte >= 0 ? row[idxImporte] : null
    if (fechaRaw == null || fechaRaw === '' || importeRaw == null || importeRaw === '') continue

    const fechaISO = parseFechaISO(fechaRaw)
    if (!fechaISO) continue
    const importe = parseImporte(importeRaw)
    if (isNaN(importe)) continue

    const concepto    = String(idxConcepto   >= 0 ? row[idxConcepto]   ?? '' : '').trim()
    const movimiento  = String(idxMovimiento >= 0 ? row[idxMovimiento] ?? '' : '').trim()
    const observ      = String(idxObserv     >= 0 ? row[idxObserv]     ?? '' : '').trim()
    const benef       = String(idxBenef      >= 0 ? row[idxBenef]      ?? '' : '').trim()
    const ordenante   = idxOrdenante >= 0 ? String(row[idxOrdenante] ?? '').trim() || null : null

    out.push({
      fecha: fechaISO,
      concepto: concepto || movimiento || '(sin concepto)',
      importe,
      contraparte: benef || undefined,
      notas: observ || undefined,
      ordenante,
      beneficiario: benef || null,
    })
  }
  return out
}

/* ─────────────────────────  CSV PARSER  ───────────────────────── */

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(/[;,\t]/).map(h => h.trim().toLowerCase())
  const idxFecha = header.findIndex(h => h.includes('fecha'))
  const idxConcepto = header.findIndex(h => h.includes('concepto') || h.includes('descrip'))
  const idxImporte = header.findIndex(h => h.includes('importe') || h.includes('amount'))
  const idxContra = header.findIndex(h => h.includes('contraparte') || h.includes('benefic') || h.includes('origen'))
  const idxOrdenante = header.findIndex(h => h.includes('ordenante'))
  return lines.slice(1).map(line => {
    const cells = line.split(/[;,\t]/)
    const benef = idxContra >= 0 ? cells[idxContra]?.trim() ?? null : null
    return {
      fecha: parseFechaISO(cells[idxFecha]?.trim() ?? ''),
      concepto: cells[idxConcepto]?.trim() ?? '',
      importe: parseImporte(cells[idxImporte] ?? '0'),
      contraparte: benef || undefined,
      ordenante: idxOrdenante >= 0 ? cells[idxOrdenante]?.trim() || null : null,
      beneficiario: benef || null,
    }
  }).filter(r => r.fecha && r.concepto && !isNaN(r.importe))
}

/* ─────────────────────────  COMPONENT  ───────────────────────── */

export default function ImportDropzone({ onFileLoaded, importResult }: Props) {
  const { T } = useTheme()
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [titularId, setTitularId] = useState<string | null>(null)
  const [titulares, setTitulares] = useState<Array<{ id: string; nombre: string }>>([])

  useEffect(() => {
    supabase.from('titulares').select('id, nombre').eq('activo', true).order('orden').then(({ data }) => {
      setTitulares((data ?? []) as Array<{ id: string; nombre: string }>)
    })
  }, [])

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    const lower = file.name.toLowerCase()

    /* Determina titular: si el extracto tiene columna nif_emisor, usar auto-detección;
       como fallback usar la selección manual del dropdown */
    function sealTitular(r: ParsedRow): string | null {
      // Si la fila ya trae nif_emisor (OCR facturas), auto-detectar
      const nifEmistor = (r as ParsedRow & { nif_emisor?: string | null }).nif_emisor
      if (nifEmistor) {
        const autoId = resolverTitularPorNif(nifEmistor)
        if (autoId) return autoId
      }
      // Fallback a selección manual del dropdown
      return titularId
    }

    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const rows = parseXLSX(wb)
        const sealed = rows.map(r => ({ ...r, titular_id: sealTitular(r) }))
        onFileLoaded(sealed, { fileName: file.name })
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = (e) => {
        const text = String(e.target?.result ?? '')
        const rows = parseCSV(text)
        const sealed = rows.map(r => ({ ...r, titular_id: sealTitular(r) }))
        onFileLoaded(sealed, { fileName: file.name })
      }
      reader.readAsText(file, 'UTF-8')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontFamily: FONT.heading, fontSize: 11, color: '#777777', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Titular bancario
        </label>
        <select
          value={titularId ?? ''}
          onChange={e => setTitularId(e.target.value || null)}
          style={{
            backgroundColor: '#1e1e1e',
            border: '1px solid #2a2a2a',
            color: titularId ? '#ffffff' : '#777777',
            padding: '6px 10px',
            borderRadius: 6,
            fontFamily: FONT.body,
            fontSize: 13,
            outline: 'none',
          }}
        >
          <option value="" disabled>Selecciona titular bancario...</option>
          {titulares.map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </div>
      <div
        onDragOver={(e) => { if (!titularId) return; e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!titularId) return
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) handleFile(f)
        }}
        onClick={() => { if (!titularId) return; inputRef.current?.click() }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 18px',
          borderRadius: 10,
          border: `2px dashed ${dragging ? '#B01D23' : T.brd}`,
          backgroundColor: dragging ? T.card : 'transparent',
          cursor: titularId ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s ease',
          minWidth: 280,
          opacity: titularId ? 1 : 0.5,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.tsv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        {fileName ? (
          <>
            <FileCheck2 size={20} color={T.accent} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Archivo cargado
              </span>
              <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{fileName}</span>
            </div>
          </>
        ) : (
          <>
            <Upload size={20} color="#B01D23" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 12, color: '#B01D23', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
                Importar extracto
              </span>
              <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
                Arrastra CSV / XLSX (BBVA, genérico) o haz click
              </span>
            </div>
          </>
        )}
      </div>
      {importResult != null && (
        <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.sec }}>
          {`✅ ${importResult.insertados} importados, ${importResult.duplicados} duplicados (ya existían), ${importResult.omitidos} omitidos por reglas`}
        </span>
      )}
    </div>
  )
}
