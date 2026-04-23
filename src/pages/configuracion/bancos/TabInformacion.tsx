import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Toolbar, Spacer, BtnRed } from '@/components/configuracion/Toolbar'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import type { CuentaBancaria, CuentaCategoria, TipoMovimiento } from '@/types/configuracion'

const TIPO_MOV_LABEL: Record<TipoMovimiento, string> = {
  ingresos: 'Ingresos',
  gastos_fijos: 'Gastos fijos',
  gastos_variables: 'Gastos variables',
  personal: 'Personal',
  marketing: 'Marketing',
  impuestos: 'Impuestos',
}

const CANAL_BG: Record<string, { bg: string; color: string }> = {
  'ING-UE':  { bg: '#06C167', color: '#ffffff' },
  'ING-GL':  { bg: '#e8f442', color: '#5c550d' },
  'ING-JE':  { bg: '#f5a623', color: '#ffffff' },
  'ING-WEB': { bg: '#B01D23', color: '#ffffff' },
  'ING-DIR': { bg: '#66aaff', color: '#ffffff' },
}

function CategoriaBadge({ codigo }: { codigo: string }) {
  const s = CANAL_BG[codigo] ?? { bg: '#1A1A1A', color: '#ffffff' }
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 5,
        fontSize: 10,
        letterSpacing: '0.06em',
        fontWeight: 700,
        textTransform: 'uppercase',
        background: s.bg,
        color: s.color,
        fontFamily: 'Oswald, sans-serif',
        marginRight: 4,
        marginBottom: 2,
      }}
    >
      {codigo}
    </span>
  )
}

export default function TabInformacion() {
  const isDark = useIsDark()
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [categorias, setCategorias] = useState<CuentaCategoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const [cRes, ccRes] = await Promise.all([
        supabase.from('cuentas_bancarias').select('*').order('es_principal', { ascending: false }).order('alias'),
        supabase.from('cuenta_categoria').select('*'),
      ])
      if (cRes.error) throw cRes.error
      if (ccRes.error) throw ccRes.error
      setCuentas((cRes.data as CuentaBancaria[]) ?? [])
      setCategorias((ccRes.data as CuentaCategoria[]) ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando cuentas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const activas = cuentas.filter(c => c.activa)
  const bancosUnicos = Array.from(new Set(activas.map(c => c.banco)))
  const saldoTotal = cuentas.reduce((a, c) => a + Number(c.saldo ?? 0), 0)
  const principal = cuentas.find(c => c.es_principal) ?? null
  const proveedores = cuentas.find(c => (c.uso_principal ?? '').toLowerCase().includes('proveedor')) ?? null

  const categoriasPorCuenta = useMemo(() => {
    const map = new Map<string, Map<TipoMovimiento, string[]>>()
    for (const c of categorias) {
      if (!map.has(c.cuenta_id)) map.set(c.cuenta_id, new Map())
      const inner = map.get(c.cuenta_id)!
      if (!inner.has(c.tipo_movimiento)) inner.set(c.tipo_movimiento, [])
      inner.get(c.tipo_movimiento)!.push(c.categoria_codigo)
    }
    return map
  }, [categorias])

  const handleToggle = async (c: CuentaBancaria) => {
    const next = !c.activa
    setCuentas(prev => prev.map(x => x.id === c.id ? { ...x, activa: next } : x))
    const { error } = await supabase.from('cuentas_bancarias').update({ activa: next }).eq('id', c.id)
    if (error) {
      setCuentas(prev => prev.map(x => x.id === c.id ? { ...x, activa: c.activa } : x))
      setError(error.message)
    }
  }

  const handleNueva = () => {
    alert('Pendiente: formulario "Nueva cuenta" (próximo sprint)')
  }

  if (loading) {
    return <div style={{ padding: 24, color: isDark ? '#777' : '#9E9588' }}>Cargando cuentas…</div>
  }
  if (error) {
    return (
      <div
        style={{
          padding: 16,
          background: isDark ? '#3a1a1a' : '#FCE0E2',
          color: isDark ? '#ff8080' : '#B01D23',
          borderRadius: 12,
        }}
      >
        {error}
      </div>
    )
  }

  const muted = isDark ? '#777' : '#9E9588'

  return (
    <>
      <KpiGrid>
        <KpiCard
          label="Cuentas activas"
          value={activas.length}
          sub={bancosUnicos.length > 0 ? bancosUnicos.join(' · ') : 'sin cuentas'}
        />
        <KpiCard
          label="Saldo total"
          value={fmtEur(saldoTotal)}
          sub={cuentas.length > 0 ? `${cuentas.length} cuenta${cuentas.length !== 1 ? 's' : ''}` : 'sin datos'}
        />
        <KpiCard
          label="Principal"
          value={principal ? fmtEur(principal.saldo) : '—'}
          sub={principal ? `${principal.banco} · ingresos` : 'sin cuenta principal'}
        />
        <KpiCard
          label="Proveedores"
          value={proveedores ? fmtEur(proveedores.saldo) : '—'}
          sub={proveedores ? `${proveedores.banco} · pagos` : 'sin cuenta proveedores'}
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
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        background: c.activa ? '#06C167' : (isDark ? '#2a2a2a' : '#E9E1D0'),
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background 0.15s',
                        padding: 0,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: c.activa ? 18 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#ffffff',
                          transition: 'left 0.15s',
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

      <BigCard title="Categorías asociadas por cuenta">
        {cuentas.length === 0 || categorias.length === 0 ? (
          <div style={{ padding: 24, color: muted, textAlign: 'center' }}>
            Sin categorías asociadas.
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Cuenta</TH>
                <TH>Tipo movimiento</TH>
                <TH>Categorías contables</TH>
              </tr>
            </THead>
            <TBody>
              {cuentas.flatMap(c => {
                const inner = categoriasPorCuenta.get(c.id)
                if (!inner || inner.size === 0) return []
                return Array.from(inner.entries()).map(([tipo, codigos]) => (
                  <TR key={`${c.id}-${tipo}`}>
                    <TD bold>{c.alias}</TD>
                    <TD muted>{TIPO_MOV_LABEL[tipo]}</TD>
                    <TD>
                      {codigos.map(cod => <CategoriaBadge key={cod} codigo={cod} />)}
                    </TD>
                  </TR>
                ))
              })}
            </TBody>
          </Table>
        )}
      </BigCard>
    </>
  )
}
