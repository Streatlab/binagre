// ─── Tabla extractos subidos — SIN filtro por periodo, siempre todos ──────────
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/utils/format'

interface Props {
  refreshTick: number
  titulares: { id: string; nombre: string }[]
}

export default function ExtractosTabla({ refreshTick, titulares }: Props) {
  const [extractos, setExtractos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    supabase.from('facturas')
      .select('id, fecha_factura, pdf_filename, pdf_drive_url, titular_id, created_at')
      .eq('tipo', 'otro')
      .eq('categoria_factura', 'extracto_bancario')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setExtractos(data ?? []); setCargando(false) })
  }, [refreshTick])

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

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
      <thead>
        <tr>
          {['Fecha subida', 'Archivo', 'Titular', 'Drive'].map(h => (
            <th key={h} style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', color: '#7a8090', textTransform: 'uppercase', textAlign: 'left', padding: '10px 16px', background: '#f5f3ef', borderBottom: '0.5px solid #d0c8bc' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {extractos.map((e, idx) => {
          const isLast = idx === extractos.length - 1
          const tdBase: React.CSSProperties = { padding: '8px 16px', borderBottom: isLast ? 'none' : '0.5px solid #ebe8e2', verticalAlign: 'middle' }
          const titNombre = titulares.find(t => t.id === e.titular_id)?.nombre?.toLowerCase() ?? ''
          const isRuben = titNombre.includes('rubén') || titNombre.includes('ruben')
          const isEmilio = titNombre.includes('emilio')
          return (
            <tr key={e.id}>
              <td style={{ ...tdBase, color: '#7a8090', fontSize: 12, whiteSpace: 'nowrap' }}>
                {e.created_at ? fmtDate(e.created_at.slice(0, 10)) : '—'}
              </td>
              <td style={{ ...tdBase, color: '#111', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.pdf_filename || '—'}
              </td>
              <td style={tdBase}>
                {isRuben
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#F26B1F15', color: '#F26B1F', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F26B1F', flexShrink: 0 }} />Rubén</span>
                  : isEmilio
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 500, background: '#1E5BCC15', color: '#1E5BCC', whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E5BCC', flexShrink: 0 }} />Emilio</span>
                  : <span style={{ color: '#7a8090', fontSize: 12 }}>—</span>
                }
              </td>
              <td style={{ ...tdBase, textAlign: 'center' }}>
                {e.pdf_drive_url
                  ? <a href={e.pdf_drive_url} target="_blank" rel="noreferrer" style={{ fontSize: 20 }}>📎</a>
                  : <span style={{ color: '#d0c8bc' }}>—</span>
                }
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
