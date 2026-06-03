// Tabla extractos bancarios - lee de tabla dedicada extractos_bancarios
// v3: ordenación canónica multi-criterio
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/utils/format'
import SortableHeader, { ClearSortButton } from '@/components/ui/SortableHeader'
import { useMultiSort } from '@/hooks/useMultiSort'

interface Props {
  refreshTick: number
  titulares: { id: string; nombre: string }[]
}

interface Extracto {
  id: string
  titular_id: string
  filename: string
  fecha_subida: string
  movimientos_total: number
  movimientos_insertados: number
  movimientos_saltados: number
  fecha_min: string | null
  fecha_max: string | null
  notas: string | null
  created_at: string
}

type SortCol = 'subido' | 'archivo' | 'titular' | 'movs' | 'periodo'

export default function ExtractosTabla({ refreshTick, titulares }: Props) {
  const [extractos, setExtractos] = useState<Extracto[]>([])
  const [cargando, setCargando] = useState(true)
  const ms = useMultiSort<Extracto, SortCol>({
    getValue: (row, col) => {
      const tit = titulares.find(t => t.id === row.titular_id)?.nombre ?? ''
      switch(col) {
        case 'subido':  return row.fecha_subida
        case 'archivo': return row.filename
        case 'titular': return tit
        case 'movs':    return row.movimientos_insertados
        case 'periodo': return row.fecha_min ?? ''
        default:        return ''
      }
    }
  })

  useEffect(() => {
    setCargando(true)
    supabase.from('extractos_bancarios')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setExtractos((data as Extracto[]) ?? []); setCargando(false) })
  }, [refreshTick])

  const filas = useMemo(() => ms.applySorts(extractos), [extractos, ms])

  if (cargando) return (
    <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>
      Cargando…
    </div>
  )

  if (extractos.length === 0) return (
    <div style={{ padding: '32px 28px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090' }}>
      No hay extractos subidos aún
    </div>
  )

  const HEADERS: { label: string; col: SortCol; align: 'left'|'right'|'center' }[] = [
    { label: 'Subido', col: 'subido', align: 'left' },
    { label: 'Archivo', col: 'archivo', align: 'left' },
    { label: 'Titular', col: 'titular', align: 'left' },
    { label: 'Movs', col: 'movs', align: 'left' },
    { label: 'Periodo', col: 'periodo', align: 'left' },
  ]

  return (
    <>
      {ms.showClearButton && (
        <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #d0c8bc' }}>
          <ClearSortButton show={true} onClear={ms.clearSorts} />
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
        <thead>
          <tr>
            {HEADERS.map(h => (
              <SortableHeader key={h.col} col={h.col} label={h.label}
                sortIndex={ms.sortIndex(h.col)} sortDir={ms.sortDir(h.col)}
                onToggle={ms.toggleSort} align={h.align} />
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((e, idx) => {
            const isLast = idx === filas.length - 1
            const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle' }
            const titNombre = titulares.find(t => t.id === e.titular_id)?.nombre?.toLowerCase() ?? ''
            const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben')
            const isEmilio = titNombre.includes('emilio')
            const periodo = (e.fecha_min && e.fecha_max)
              ? `${fmtDate(e.fecha_min)} – ${fmtDate(e.fecha_max)}`
              : '—'
            return (
              <tr key={e.id} title={e.notas ?? ''}>
                <td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {fmtDate(e.fecha_subida)}
                </td>
                <td style={{ ...tdBase, color: '#111', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.filename}
                </td>
                <td style={tdBase}>
                  {isRuben
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#F26B1F15', color: '#F26B1F', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F26B1F', flexShrink: 0 }} />Rubén</span>
                    : isEmilio
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#1E5BCC15', color: '#1E5BCC', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E5BCC', flexShrink: 0 }} />Emilio</span>
                    : <span style={{ color: '#7a8090', fontSize: 12 }}>—</span>
                  }
                </td>
                <td style={{ ...tdBase, fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 500 }}>
                  <span style={{ color: '#1D9E75' }}>{e.movimientos_insertados}</span>
                  {e.movimientos_saltados > 0 && <span style={{ color: '#7a8090', fontSize: 11, marginLeft: 6 }}>+{e.movimientos_saltados} dup</span>}
                </td>
                <td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {periodo}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
