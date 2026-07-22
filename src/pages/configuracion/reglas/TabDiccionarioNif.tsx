import { VERDE } from '@/styles/neobrutal'
import { DICCIONARIO_PLANTILLA_AZUL } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'

interface Entrada {
  nif: string
  proveedor_canonico: string | null
  categoria_codigo: string | null
  categoria_origen: string | null
  veces_visto: number | null
  actualizado_en: string | null
}

// Diccionario NIF <-> proveedor. Se alimenta SOLO (facturas + banco + reglas):
// cada factura aporta NIF->proveedor, cada movimiento del banco propaga su
// categoria al proveedor, y las plantillas por NIF tambien entran aqui.
// De aqui sale la contraparte y la categoria que se copian a cada factura nueva.
export default function TabDiccionarioNif() {
  const { T } = useTheme()
  const [filas, setFilas] = useState<Entrada[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('diccionario_nif_proveedor')
      .select('nif, proveedor_canonico, categoria_codigo, categoria_origen, veces_visto, actualizado_en')
      .order('veces_visto', { ascending: false })
    setFilas((data as Entrada[]) ?? [])
    setLoading(false)
  }

  const visibles = filas.filter(f => !busca ||
    (f.nif ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (f.proveedor_canonico ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (f.categoria_codigo ?? '').toLowerCase().includes(busca.toLowerCase()))

  const inp: React.CSSProperties = { background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' }

  function badgeOrigen(o: string | null) {
    const map: Record<string, { txt: string; bg: string; fg: string }> = {
      banco:   { txt: 'Banco',   bg: '#06C16722', fg: VERDE },
      regla:   { txt: 'Plantilla', bg: DICCIONARIO_PLANTILLA_AZUL + '22', fg: DICCIONARIO_PLANTILLA_AZUL },
      factura: { txt: 'Factura', bg: '#9999991f', fg: T.sec },
    }
    const m = map[o ?? ''] ?? { txt: '—', bg: 'transparent', fg: T.mut }
    return <span style={{ background: m.bg, color: m.fg, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{m.txt}</span>
  }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando diccionario…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
        Diccionario NIF ↔ proveedor. Se rellena solo: cada factura aporta el NIF y su proveedor, cada movimiento del banco aporta la categoría real, y las plantillas por NIF entran también aquí. De esta tabla salen la contraparte y la categoría que se copian automáticamente a cada factura nueva con ese NIF. La categoría del banco manda sobre cualquier otra.
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por NIF, proveedor o categoría…" style={{ ...inp, maxWidth: 320 }} />

      <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 14 }}>
          <thead>
            <tr style={{ background: T.group }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>NIF</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Proveedor (contraparte)</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Categoría</th>
              <th style={{ width: 110, textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Origen cat.</th>
              <th style={{ width: 80, textAlign: 'center', padding: '10px 8px', fontSize: 11, color: T.mut, textTransform: 'uppercase' }}>Visto</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(f => (
              <tr key={f.nif} style={{ borderTop: `0.5px solid ${T.brd}` }}>
                <td style={{ padding: '10px 14px', color: T.pri, fontWeight: 600 }}>{f.nif}</td>
                <td style={{ padding: '10px 14px', color: T.pri }}>{f.proveedor_canonico ?? '—'}</td>
                <td style={{ padding: '10px 14px', color: T.sec }}>{f.categoria_codigo ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>{badgeOrigen(f.categoria_origen)}</td>
                <td style={{ textAlign: 'center', color: T.sec }}>{f.veces_visto ?? 1}</td>
              </tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: T.mut }}>Diccionario vacío todavía. Se irá llenando solo según entren facturas y movimientos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
