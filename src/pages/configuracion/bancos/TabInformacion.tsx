import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Toolbar, Spacer, BtnRed } from '@/components/configuracion/Toolbar'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import type { CuentaBancaria } from '@/types/configuracion'

export default function TabInformacion() {
  const isDark = useIsDark()
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('cuentas_bancarias')
        .select('*')
        .order('es_principal', { ascending: false })
        .order('alias')
      if (error) throw error
      setCuentas((data as CuentaBancaria[]) ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando cuentas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const saldoTotal = cuentas.reduce((a, c) => a + Number(c.saldo ?? 0), 0)

  const handleToggle = async (c: CuentaBancaria) => {
    const next = !c.activa
    setCuentas(prev => prev.map(x => x.id === c.id ? { ...x, activa: next } : x))
    const { error } = await supabase.from('cuentas_bancarias').update({ activa: next }).eq('id', c.id)
    if (error) {
      setCuentas(prev => prev.map(x => x.id === c.id ? { ...x, activa: c.activa } : x))
      setError(error.message)
    }
  }

  const handleNueva = () => alert('Pendiente: formulario "Nueva cuenta"')

  const muted = isDark ? '#777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: muted }}>Cargando cuentas…</div>
  if (error) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }

  return (
    <>
      <KpiGrid>
        <KpiCard
          label="Saldo total"
          value={cuentas.length > 0 ? fmtEur(saldoTotal) : '—'}
          sub={cuentas.length > 0 ? `${cuentas.length} cuenta${cuentas.length !== 1 ? 's' : ''}` : 'sin datos'}
        />
      </KpiGrid>

      <Toolbar>
        <Spacer />
        <BtnRed onClick={handleNueva}>+ Nueva cuenta</BtnRed>
      </Toolbar>

      <BigCard title="Cuentas bancarias" count={`${cuentas.length}`}>
        {cuentas.length === 0 ? (
          <div style={{ padding: 24, color: muted, textAlign: 'center' }}>
            Sin cuentas registradas.
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Alias</TH>
                <TH>Banco</TH>
                <TH>IBAN</TH>
                <TH>Uso principal</TH>
                <TH num>Saldo</TH>
                <TH>Activa</TH>
              </tr>
            </THead>
            <TBody>
              {cuentas.map(c => (
                <TR key={c.id}>
                  <TD bold={c.es_principal}>
                    {c.alias}
                    {c.es_principal && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: muted }}>
                        · principal
                      </span>
                    )}
                  </TD>
                  <TD muted>{c.banco}</TD>
                  <TD style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}>
                    {c.iban_mask}
                  </TD>
                  <TD muted>{c.uso_principal ?? '—'}</TD>
                  <TD num bold>{fmtEur(c.saldo)}</TD>
                  <TD>
                    <button
                      type="button"
                      onClick={() => handleToggle(c)}
                      aria-label={c.activa ? 'Desactivar cuenta' : 'Activar cuenta'}
                      style={{
                        width: 36, height: 20, borderRadius: 10,
                        background: c.activa ? '#06C167' : (isDark ? '#2a2a2a' : '#E9E1D0'),
                        border: 'none', cursor: 'pointer',
                        position: 'relative', transition: 'background 0.15s', padding: 0,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute', top: 2,
                          left: c.activa ? 18 : 2,
                          width: 16, height: 16, borderRadius: '50%',
                          background: '#ffffff', transition: 'left 0.15s',
                        }}
                      />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </BigCard>
    </>
  )
}
