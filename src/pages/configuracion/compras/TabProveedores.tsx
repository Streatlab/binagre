import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Toolbar, Spacer, BtnRed, SearchInput } from '@/components/configuracion/Toolbar'
import { AbvBadge } from '@/components/configuracion/AbvBadge'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import type { Proveedor } from '@/types/configuracion'

function fmtFrecuencia(f: string | null): string {
  if (!f) return '—'
  const map: Record<string, string> = {
    diario: 'Diario',
    semanal: 'Semanal',
    '2x_semana': '2x semana',
    quincenal: 'Quincenal',
    mensual: 'Mensual',
  }
  return map[f] ?? f
}

export default function TabProveedores() {
  const isDark = useIsDark()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [counts, setCounts] = useState({ ingredientes: 0, eps: 0, mermas: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [pv, ing, eps, mrm] = await Promise.all([
          supabase.from('proveedores').select('*').order('nombre'),
          supabase.from('ingredientes').select('id', { count: 'exact', head: true }),
          supabase.from('eps').select('id', { count: 'exact', head: true }),
          supabase.from('mermas').select('id', { count: 'exact', head: true }),
        ])
        if (pv.error) throw pv.error
        if (cancelled) return
        setProveedores((pv.data ?? []) as unknown as Proveedor[])
        setCounts({
          ingredientes: ing.count ?? 0,
          eps: eps.count ?? 0,
          mermas: mrm.count ?? 0,
        })
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando datos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const externos = useMemo(
    () => proveedores.filter(p => p.tipo_proveedor === 'externo'),
    [proveedores]
  )

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return externos
    return externos.filter(p =>
      (p.abv ?? '').toLowerCase().includes(q) ||
      p.nombre.toLowerCase().includes(q)
    )
  }, [externos, search])

  const mut = isDark ? '#777777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando proveedores…</div>
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

  return (
    <>
      <KpiGrid>
        <KpiCard label="Externos" value={externos.length} sub="abreviaturas" />
        <KpiCard
          label="Ingredientes"
          value={counts.ingredientes}
          sub={`+${counts.eps} EPS · ${counts.mermas} MRM`}
        />
        <KpiCard label="Compra mes" value="—" sub="pendiente métrica" subTone="muted" />
        <KpiCard label="Top proveedor" value="—" sub="pendiente métrica" subTone="muted" />
      </KpiGrid>

      <Toolbar>
        <SearchInput
          placeholder="Buscar proveedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Spacer />
        <BtnRed onClick={() => alert('Pendiente: modal nuevo proveedor')}>
          + Nuevo proveedor
        </BtnRed>
      </Toolbar>

      <BigCard title="Externos" count={`${filtrados.length} activos`}>
        {filtrados.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: mut }}>
            {search ? 'Sin resultados' : 'Sin proveedores registrados'}
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>ABV</TH>
                <TH>Nombre</TH>
                <TH>Tipo</TH>
                <TH>Frecuencia</TH>
                <TH num>Ingredientes</TH>
                <TH num>Compra mes</TH>
              </tr>
            </THead>
            <TBody>
              {filtrados.map(p => (
                <TR key={p.id}>
                  <TD>{p.abv ? <AbvBadge abv={p.abv} /> : <span style={{ color: mut }}>—</span>}</TD>
                  <TD bold>{p.nombre}</TD>
                  <TD muted>{p.tipo ?? '—'}</TD>
                  <TD muted>{fmtFrecuencia(p.frecuencia)}</TD>
                  <TD num muted>—</TD>
                  <TD num muted>—</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </BigCard>

      <BigCard title="Internos" count="elaboraciones propias">
        <Table>
          <THead>
            <tr>
              <TH>ABV</TH>
              <TH>Nombre</TH>
              <TH>Tipo</TH>
              <TH num>Nº elementos</TH>
            </tr>
          </THead>
          <TBody>
            <TR>
              <TD><AbvBadge abv="EPS" bg="#6AA0D6" /></TD>
              <TD bold>Elaboraciones Propias</TD>
              <TD muted>Sub-receta de cocina</TD>
              <TD num bold>{counts.eps}</TD>
            </TR>
            <TR>
              <TD><AbvBadge abv="MRM" bg="#E89A2B" /></TD>
              <TD bold>Mermas técnicas</TD>
              <TD muted>Aprovechamiento</TD>
              <TD num bold>{counts.mermas}</TD>
            </TR>
          </TBody>
        </Table>
      </BigCard>
    </>
  )
}
