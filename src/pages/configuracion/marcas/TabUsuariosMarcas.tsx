import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import type { MarcaPlataformaAcceso, PlataformaAbv } from '@/types/configuracion'

interface MarcaConAccesos {
  id: string
  nombre: string
  cocina: string | null
  accesos: MarcaPlataformaAcceso[]
}

export default function TabUsuariosMarcas() {
  const isDark = useIsDark()
  const [marcas, setMarcas] = useState<MarcaConAccesos[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase
      .from('marcas')
      .select('id, nombre, cocina, accesos:marca_plataforma_acceso(*)')
      .order('nombre')
    if (error) throw error
    setMarcas(((data ?? []) as unknown as MarcaConAccesos[]).map(m => ({
      ...m,
      accesos: m.accesos ?? [],
    })))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try { await refetch() }
      catch (e: any) { if (!cancelled) setError(e?.message ?? 'Error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  async function toggleAcceso(marcaId: string, plat: PlataformaAbv, actual: boolean) {
    const existing = marcas.find(m => m.id === marcaId)?.accesos.find(a => a.plataforma === plat)
    if (existing) {
      const { error } = await supabase
        .from('marca_plataforma_acceso')
        .update({ activo: !actual })
        .eq('id', existing.id)
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase
        .from('marca_plataforma_acceso')
        .insert({ marca_id: marcaId, plataforma: plat, activo: true })
      if (error) { setError(error.message); return }
    }
    await refetch()
  }

  async function updateEmail(accesoId: string, email: string) {
    const { error } = await supabase
      .from('marca_plataforma_acceso')
      .update({ email_acceso: email || null })
      .eq('id', accesoId)
    if (error) { setError(error.message); return }
    await refetch()
  }

  const mut = isDark ? '#777777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando accesos…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }

  const accesosUE = marcas.reduce((n, m) => n + m.accesos.filter(a => a.plataforma === 'UE' && a.activo).length, 0)
  const accesosGL = marcas.reduce((n, m) => n + m.accesos.filter(a => a.plataforma === 'GL' && a.activo).length, 0)
  const accesosJE = marcas.reduce((n, m) => n + m.accesos.filter(a => a.plataforma === 'JE' && a.activo).length, 0)

  const inputBg = isDark ? '#1e1e1e' : 'transparent'
  const inputColor = isDark ? '#ffffff' : '#1A1A1A'
  const inputBrd = isDark ? '#2a2a2a' : '#E9E1D0'

  return (
    <>
      <KpiGrid>
        <KpiCard label="Marcas" value={marcas.length} sub="portfolio total" />
        <KpiCard label="En Uber Eats" value={accesosUE} sub="con email de acceso" />
        <KpiCard label="En Glovo" value={accesosGL} sub="activas" />
        <KpiCard label="En Just Eat" value={accesosJE} sub="activas" />
      </KpiGrid>

      <BigCard title="Accesos por plataforma" count={`${marcas.length} marcas`}>
        <Table>
          <THead>
            <tr>
              <TH>Marca</TH>
              <TH>Cocina</TH>
              <TH>Email Uber Eats</TH>
              <TH num>Glovo</TH>
              <TH num>Just Eat</TH>
            </tr>
          </THead>
          <TBody>
            {marcas.map(m => {
              const ue = m.accesos.find(a => a.plataforma === 'UE')
              const gl = m.accesos.find(a => a.plataforma === 'GL')
              const je = m.accesos.find(a => a.plataforma === 'JE')
              return (
                <TR key={m.id}>
                  <TD bold>{m.nombre}</TD>
                  <TD muted>{m.cocina ?? '—'}</TD>
                  <TD>
                    {ue ? (
                      <input
                        defaultValue={ue.email_acceso ?? ''}
                        onBlur={e => updateEmail(ue.id, e.target.value.trim())}
                        placeholder="email@ubereats.com"
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          border: `1px solid transparent`,
                          borderRadius: 4,
                          fontSize: 12.5,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          background: inputBg,
                          color: inputColor,
                          outline: 'none',
                        }}
                        onFocus={e => (e.currentTarget.style.border = `1px solid #B01D23`)}
                        onBlurCapture={e => (e.currentTarget.style.border = `1px solid transparent`)}
                        onMouseEnter={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = `1px solid ${inputBrd}` }}
                        onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = `1px solid transparent` }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleAcceso(m.id, 'UE', false)}
                        style={{
                          background: 'none', border: 'none', color: '#B01D23',
                          fontSize: 12, cursor: 'pointer', padding: 0,
                          fontFamily: 'Oswald, sans-serif',
                        }}
                      >
                        + Activar UE
                      </button>
                    )}
                  </TD>
                  <TD num>
                    <Toggle checked={gl?.activo ?? false} onChange={() => toggleAcceso(m.id, 'GL', gl?.activo ?? false)} />
                  </TD>
                  <TD num>
                    <Toggle checked={je?.activo ?? false} onChange={() => toggleAcceso(m.id, 'JE', je?.activo ?? false)} />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      </BigCard>
    </>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  const isDark = useIsDark()
  const trackOff = isDark ? '#2a2a2a' : '#DDD4BF'
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? '#22B573' : trackOff,
          transition: 'background 0.15s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ffffff',
            transition: 'left 0.15s',
          }}
        />
      </span>
    </label>
  )
}
