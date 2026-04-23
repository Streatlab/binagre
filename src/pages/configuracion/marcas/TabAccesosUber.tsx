import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'

interface MarcaAccesoUE {
  id: string
  nombre: string
  acceso_id: string
  email_acceso: string | null
}

export default function TabAccesosUber() {
  const { T } = useTheme()
  const [marcas, setMarcas] = useState<MarcaAccesoUE[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase
      .from('marcas')
      .select('id, nombre, accesos:marca_plataforma_acceso(id, plataforma, email_acceso, activo)')
      .order('nombre')
    if (error) throw error
    const resultado: MarcaAccesoUE[] = []
    for (const m of (data ?? [])) {
      const ue = (m as any).accesos?.find((a: any) => a.plataforma === 'UE' && a.activo)
      if (ue) resultado.push({ id: (m as any).id, nombre: (m as any).nombre, acceso_id: ue.id, email_acceso: ue.email_acceso })
    }
    setMarcas(resultado)
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function updateEmail(accesoId: string, email: string) {
    const { error } = await supabase.from('marca_plataforma_acceso').update({ email_acceso: email || null }).eq('id', accesoId)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: '#B01D2320', color: '#B01D23', borderRadius: 10, fontFamily: FONT.body }}>
        {error}
      </div>
    )
  }

  const th: React.CSSProperties = {
    padding: '10px 14px',
    fontFamily: FONT.heading,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: T.mut,
    fontWeight: 400,
    background: T.group,
    textAlign: 'left',
  }
  const td: React.CSSProperties = {
    padding: '10px 14px',
    fontFamily: FONT.body,
    fontSize: 13,
    color: T.pri,
  }

  return (
    <ConfigGroupCard title="Accesos Uber" subtitle={`${marcas.length} marcas`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: `0.5px solid ${T.brd}`, borderBottom: `0.5px solid ${T.brd}`, background: T.group }}>
              <th style={th}>Marca</th>
              <th style={th}>Usuario Uber Eats</th>
            </tr>
          </thead>
          <tbody>
            {marcas.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ padding: '32px 22px', textAlign: 'center', color: T.mut, fontFamily: FONT.body, fontSize: 13 }}>
                  Ninguna marca con acceso UE activo.
                </td>
              </tr>
            ) : marcas.map(m => (
              <tr key={m.id} style={{ borderBottom: `0.5px solid ${T.brd}` }}>
                <td style={{ ...td, fontWeight: 600 }}>{m.nombre}</td>
                <td style={td}>
                  <input
                    defaultValue={m.email_acceso ?? ''}
                    onBlur={(e) => updateEmail(m.acceso_id, e.target.value.trim())}
                    placeholder="email@ubereats.com"
                    style={{
                      width: '100%',
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: `0.5px solid transparent`,
                      background: 'transparent',
                      color: T.pri,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 12.5,
                      outline: 'none',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#B01D23'; e.currentTarget.style.background = T.inp }}
                    onMouseEnter={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = T.brd }}
                    onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'transparent' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ConfigGroupCard>
  )
}
