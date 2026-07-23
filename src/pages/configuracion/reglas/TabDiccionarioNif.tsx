import { VERDE, GRIS, GRANATE, LEX } from '@/styles/neobrutal'
import { DICCIONARIO_PLANTILLA_AZUL } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { PantallaCantera, HeroCantera, Papel } from '@/components/kit/cantera'

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

  const inp: React.CSSProperties = { background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 0, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' }

  function badgeOrigen(o: string | null) {
    const map: Record<string, { txt: string; bg: string; fg: string }> = {
      banco:   { txt: 'Banco',   bg: `${VERDE}22`, fg: VERDE },
      regla:   { txt: 'Plantilla', bg: DICCIONARIO_PLANTILLA_AZUL + '22', fg: DICCIONARIO_PLANTILLA_AZUL },
      factura: { txt: 'Factura', bg: `${GRIS}1f`, fg: T.sec },
    }
    const m = map[o ?? ''] ?? { txt: '—', bg: 'transparent', fg: T.mut }
    return <span style={{ background: m.bg, color: m.fg, borderRadius: 0, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{m.txt}</span>
  }

  if (loading) return (
    <PantallaCantera embedded>
      <Papel ceja={GRIS}><div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>Cargando diccionario…</div></Papel>
    </PantallaCantera>
  )

  const conCategoria = filas.filter(f => !!f.categoria_codigo).length

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular={filas.length === 0 ? 'El diccionario NIF todavía está vacío' : 'Así relaciona el sistema cada NIF con su proveedor y categoría'}
        etiquetaDato={filas.length > 0 ? 'Entradas en el diccionario' : undefined}
        cifra={filas.length > 0 ? String(filas.length) : undefined}
        resumen={filas.length > 0
          ? <>{conCategoria} con categoría asignada · se rellena solo con facturas, banco y plantillas.</>
          : 'Se irá llenando solo según entren facturas y movimientos del banco.'}
      />

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por NIF, proveedor o categoría…" style={{ ...inp, maxWidth: 320 }} />

      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
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
      </Papel>
    </PantallaCantera>
  )
}
