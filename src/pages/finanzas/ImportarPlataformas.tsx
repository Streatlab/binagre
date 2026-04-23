import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Upload, FileCheck2, AlertTriangle } from 'lucide-react'
import { useTheme, FONT } from '@/styles/tokens'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import {
  buildMarcaMap, parseRushHour, parseUber, parseGlovo, parseJustEat,
  upsertFacturacionDiario, logImport, readWorkbookFromArrayBuffer, sheetToRows, csvToRows,
  type Plataforma, type ImportSummary,
} from '@/lib/importersPlataformas'

interface ImportLog {
  id: string
  creado_en: string
  plataforma: string
  archivo: string | null
  marca_nombre: string | null
  filas: number | null
  total_pedidos: number | null
  total_bruto: number | null
  estado: string | null
  error: string | null
}

const PLATAFORMAS: { key: Plataforma; label: string; color: string; bg: string; sub: string }[] = [
  { key: 'rushhour', label: 'RushHour',  color: '#7F77DD', bg: '#EFEDFB', sub: 'Agregador (todas las plataformas)' },
  { key: 'uber',     label: 'Uber Eats', color: '#06C167', bg: '#E8F5EC', sub: 'Pedidos individuales por restaurante' },
  { key: 'glovo',    label: 'Glovo',     color: '#aabc00', bg: '#FAFCE8', sub: 'Pedidos individuales por store' },
  { key: 'justeat',  label: 'Just Eat',  color: '#f5a623', bg: '#FDF3E4', sub: 'Pedidos individuales' },
]

export default function ImportarPlataformas() {
  const { T, isDark } = useTheme()
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Plataforma | null>(null)
  const [lastResult, setLastResult] = useState<Record<Plataforma, ImportSummary | null>>({
    rushhour: null, uber: null, glovo: null, justeat: null,
  })

  async function refetchLogs() {
    const { data, error } = await supabase
      .from('imports_plataformas')
      .select('id, creado_en, plataforma, archivo, marca_nombre, filas, total_pedidos, total_bruto, estado, error')
      .order('creado_en', { ascending: false })
      .limit(20)
    if (error) { console.error(error); return }
    setLogs((data ?? []) as ImportLog[])
  }

  useEffect(() => {
    refetchLogs().finally(() => setLoading(false))
  }, [])

  async function handleFile(plataforma: Plataforma, file: File) {
    setBusy(plataforma)
    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv')
      const buf = await file.arrayBuffer()
      let rows: unknown[][]
      if (isCsv) {
        const text = new TextDecoder('utf-8').decode(buf)
        rows = csvToRows(text)
      } else {
        const wb = readWorkbookFromArrayBuffer(buf)
        rows = sheetToRows(wb)
      }

      const marcaMap = await buildMarcaMap()
      let summary: ImportSummary
      switch (plataforma) {
        case 'rushhour': summary = parseRushHour(rows, marcaMap); break
        case 'uber':     summary = parseUber(rows, marcaMap); break
        case 'glovo':    summary = parseGlovo(rows, marcaMap); break
        case 'justeat':  summary = parseJustEat(rows, marcaMap); break
      }

      if (summary.filas === 0) {
        await logImport({
          plataforma, archivo: file.name, filas: 0, totalPedidos: 0, totalBruto: 0,
          estado: 'error', error: 'No se detectaron filas (cabecera o columnas no reconocidas)',
        })
        alert(`${file.name}: no se detectaron filas. Comprueba que el archivo tiene cabecera y columnas reconocibles.`)
        setLastResult(p => ({ ...p, [plataforma]: summary }))
        return
      }

      const { upserted, saltadas } = await upsertFacturacionDiario(summary.rows)
      await logImport({
        plataforma, archivo: file.name,
        filas: summary.filas, totalPedidos: summary.totalPedidos, totalBruto: summary.totalBruto,
        estado: 'ok',
      })
      setLastResult(p => ({ ...p, [plataforma]: summary }))

      const partes: string[] = [`${upserted} filas guardadas en facturación diaria`]
      if (saltadas > 0) partes.push(`${saltadas} sin marca encontrada (omitidas)`)
      if (summary.marcasNoMatcheadas.length > 0) {
        partes.push(`marcas no encontradas: ${summary.marcasNoMatcheadas.slice(0, 5).join(', ')}${summary.marcasNoMatcheadas.length > 5 ? '…' : ''}`)
      }
      alert(partes.join(' · '))
    } catch (e: any) {
      console.error('Import error:', e)
      await logImport({
        plataforma, archivo: file.name, filas: 0, totalPedidos: 0, totalBruto: 0,
        estado: 'error', error: e?.message ?? 'Error desconocido',
      })
      alert(`Error: ${e?.message ?? e}`)
    } finally {
      setBusy(null)
      await refetchLogs()
    }
  }

  /* ─────────── styles ─────────── */
  const wrapPage: CSSProperties = {
    background: T.group, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px',
  }
  const labelCard: CSSProperties = {
    fontFamily: FONT.heading, fontSize: 11, color: T.mut, letterSpacing: 1.3,
    textTransform: 'uppercase', marginBottom: 8, fontWeight: 500,
  }
  const th: CSSProperties = {
    padding: '10px 14px', fontFamily: FONT.heading, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 2, color: T.mut, fontWeight: 400,
    background: T.group, textAlign: 'left',
  }
  const td: CSSProperties = { padding: '10px 14px', fontFamily: FONT.body, fontSize: 13, color: T.pri }

  return (
    <div style={wrapPage}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{
          color: '#B01D23', fontFamily: FONT.heading, fontSize: 22, fontWeight: 500,
          letterSpacing: 1, margin: 0, textTransform: 'uppercase',
        }}>
          Importar ventas por marca
        </h2>
        <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
          Sube CSV/XLSX desde RushHour, Uber Eats, Glovo o Just Eat
        </span>
      </div>

      {/* Grid 2x2 de drop zones */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 28,
      }} className="rf-import-grid">
        {PLATAFORMAS.map(p => (
          <DropZone
            key={p.key}
            plataforma={p.key}
            label={p.label}
            sub={p.sub}
            color={p.color}
            bg={isDark ? 'rgba(255,255,255,0.04)' : p.bg}
            busy={busy === p.key}
            result={lastResult[p.key]}
            onFile={(f) => handleFile(p.key, f)}
            T={T}
          />
        ))}
      </div>

      {/* Tabla histórico */}
      <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.brd}` }}>
          <div style={labelCard}>Imports recientes</div>
        </div>
        {loading ? (
          <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>Cargando…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
            Sin imports todavía.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Plataforma</th>
                  <th style={th}>Archivo</th>
                  <th style={{ ...th, textAlign: 'right' }}>Filas</th>
                  <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                  <th style={{ ...th, textAlign: 'right' }}>Total bruto</th>
                  <th style={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                    <td style={{ ...td, color: T.sec }}>
                      {new Date(l.creado_en).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ ...td, textTransform: 'uppercase', fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5 }}>
                      {l.plataforma}
                    </td>
                    <td style={{ ...td, color: T.sec, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.archivo ?? '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.filas ?? 0}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.total_pedidos ?? 0}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: FONT.heading, fontSize: 12 }}>{fmtEur(Number(l.total_bruto ?? 0))}</td>
                    <td style={td}>
                      {l.estado === 'ok' ? (
                        <span style={{ color: '#06C167', fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>OK</span>
                      ) : (
                        <span title={l.error ?? ''} style={{ color: '#B01D23', fontFamily: FONT.heading, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                          ⚠ Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@media (max-width: 900px) { .rf-import-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

/* ─────────────────  DropZone  ───────────────── */

interface DropZoneProps {
  plataforma: Plataforma
  label: string
  sub: string
  color: string
  bg: string
  busy: boolean
  result: ImportSummary | null
  onFile: (file: File) => void
  T: ReturnType<typeof useTheme>['T']
}

function DropZone({ label, sub, color, bg, busy, result, onFile, T }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false)
        const f = e.dataTransfer.files[0]
        if (f && !busy) onFile(f)
      }}
      onClick={() => !busy && inputRef.current?.click()}
      style={{
        background: T.card,
        border: `${drag ? 2 : 1}px ${result ? 'solid' : 'dashed'} ${drag ? color : (result ? color : T.brd)}`,
        borderRadius: 14, padding: '20px 22px', minHeight: 160,
        display: 'flex', flexDirection: 'column', gap: 8,
        cursor: busy ? 'wait' : 'pointer', transition: 'border 120ms',
        opacity: busy ? 0.7 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
        <span style={{ fontFamily: FONT.heading, fontSize: 13, color: T.pri, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
          {label}
        </span>
        {busy && <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut, marginLeft: 'auto' }}>Procesando…</span>}
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>{sub}</div>

      {result ? (
        <div style={{
          marginTop: 'auto',
          padding: '10px 12px',
          background: bg,
          border: `1px solid ${color}33`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <FileCheck2 size={16} color={color} />
          <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.pri }}>
            <strong>✓ {result.totalPedidos} pedidos · {fmtEur(result.totalBruto)}</strong>
            {' · '}{result.filas} filas
          </span>
          {result.marcasNoMatcheadas.length > 0 && (
            <span style={{ fontFamily: FONT.body, fontSize: 11, color: '#B01D23', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} /> {result.marcasNoMatcheadas.length} marca(s) sin match
            </span>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, color: T.mut, fontFamily: FONT.body, fontSize: 12 }}>
          <Upload size={16} /> Arrastra CSV/XLSX o haz click
        </div>
      )}
    </div>
  )
}
