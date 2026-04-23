import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { exportCsv } from '@/lib/csv'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Toolbar, Spacer, BtnRed, BtnGhost, SearchInput } from '@/components/configuracion/Toolbar'
import { Ctag } from '@/components/configuracion/Ctag'
import { StatusTag } from '@/components/configuracion/StatusTag'
import { Table, THead, TBody, TH, TR, TD, TotalTR } from '@/components/configuracion/ConfigTable'
import type { CanalAbv, EstadoMarca } from '@/types/configuracion'

interface MarcaRow {
  id: string
  nombre: string
  cocina: string | null
  responsable_id: string | null
  tm_medio: number
  objetivo_mes: number
  estado: EstadoMarca
  es_anchor: boolean
  accesos: { plataforma: string; activo: boolean }[]
}

export default function TabMarcas() {
  const isDark = useIsDark()
  const [marcas, setMarcas] = useState<MarcaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('marcas')
          .select('id, nombre, cocina, responsable_id, tm_medio, objetivo_mes, estado, es_anchor, accesos:marca_plataforma_acceso(plataforma, activo)')
          .order('nombre')
        if (error) throw error
        if (cancelled) return
        setMarcas(((data ?? []) as unknown as MarcaRow[]).map(m => ({
          ...m,
          tm_medio: Number(m.tm_medio) || 0,
          objetivo_mes: Number(m.objetivo_mes) || 0,
          accesos: m.accesos ?? [],
        })))
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando marcas')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return marcas
    return marcas.filter(m => m.nombre.toLowerCase().includes(q))
  }, [marcas, search])

  const activas = marcas.filter(m => m.estado === 'activa')
  const pausadas = marcas.filter(m => m.estado === 'pausada')
  const objTotal = marcas.reduce((a, m) => a + (m.estado === 'activa' ? m.objetivo_mes : 0), 0)
  const enUE = marcas.filter(m => m.accesos.some(a => a.plataforma === 'UE' && a.activo)).length
  const enGL = marcas.filter(m => m.accesos.some(a => a.plataforma === 'GL' && a.activo)).length
  const enJE = marcas.filter(m => m.accesos.some(a => a.plataforma === 'JE' && a.activo)).length

  const handleExport = () => {
    const rows = marcas.map(m => ({
      Marca: m.nombre + (m.es_anchor ? ' (anchor)' : ''),
      Cocina: m.cocina ?? '',
      Canales: m.accesos.filter(a => a.activo).map(a => a.plataforma).join(' '),
      TM_medio: m.tm_medio,
      Objetivo_mes: m.objetivo_mes,
      Estado: m.estado,
    }))
    exportCsv('marcas.csv', rows)
  }

  const handleNueva = () => alert('Pendiente: formulario "Nueva marca"')

  const mut = isDark ? '#777777' : '#9E9588'

  if (loading) return <div style={{ padding: 24, color: mut }}>Cargando marcas…</div>
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
          label="Marcas activas"
          value={activas.length}
          sub={pausadas.length > 0 ? `${pausadas.length} pausada${pausadas.length !== 1 ? 's' : ''}` : 'todas activas'}
          subTone={pausadas.length > 0 ? 'neg' : 'pos'}
        />
        <KpiCard label="En Uber Eats" value={enUE} sub={`de ${marcas.length} marcas`} />
        <KpiCard label="En Glovo + JE" value={`${enGL} · ${enJE}`} sub="Glovo · Just Eat" />
        <KpiCard
          label="Obj. total mes"
          value={objTotal > 0 ? fmtEur(objTotal) : '—'}
          sub={objTotal > 0 ? 'suma marcas activas' : 'pendiente datos'}
          subTone="muted"
        />
      </KpiGrid>

      <Toolbar>
        <SearchInput
          placeholder="Buscar marca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Spacer />
        <BtnGhost onClick={handleExport}>Exportar CSV</BtnGhost>
        <BtnRed onClick={handleNueva}>+ Nueva marca</BtnRed>
      </Toolbar>

      <BigCard title="Portfolio de marcas virtuales" count={`${activas.length} activas`}>
        {filtradas.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: mut }}>
            {marcas.length === 0 ? 'Sin marcas registradas.' : 'Sin resultados para esa búsqueda.'}
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Marca</TH>
                <TH>Cocina</TH>
                <TH>Canales</TH>
                <TH num>TM</TH>
                <TH num>Obj. mes</TH>
                <TH>Estado</TH>
              </tr>
            </THead>
            <TBody>
              {filtradas.map(m => {
                const activos = m.accesos.filter(a => a.activo).map(a => a.plataforma as CanalAbv)
                return (
                  <TR key={m.id}>
                    <TD bold>
                      {m.nombre}
                      {m.es_anchor && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: mut }}>
                          · anchor brand
                        </span>
                      )}
                    </TD>
                    <TD muted>{m.cocina ?? '—'}</TD>
                    <TD>
                      {activos.length === 0
                        ? <span style={{ color: mut }}>—</span>
                        : activos.map(abv => <Ctag key={abv} abv={abv} />)}
                    </TD>
                    <TD num bold={m.tm_medio > 0} muted={m.tm_medio === 0}>
                      {m.tm_medio > 0 ? fmtEur(m.tm_medio) : '—'}
                    </TD>
                    <TD num bold={m.objetivo_mes > 0} muted={m.objetivo_mes === 0}>
                      {m.estado === 'pausada' || m.objetivo_mes === 0 ? '—' : fmtEur(m.objetivo_mes)}
                    </TD>
                    <TD>
                      <StatusTag variant={m.estado === 'activa' ? 'ok' : 'off'}>
                        {m.estado === 'activa' ? 'Activa' : 'Pausada'}
                      </StatusTag>
                    </TD>
                  </TR>
                )
              })}
              <TotalTR>
                <TD bold muted>TOTAL</TD>
                <TD>—</TD>
                <TD>—</TD>
                <TD>—</TD>
                <TD num bold>{objTotal > 0 ? fmtEur(objTotal) : '—'}</TD>
                <TD muted>{activas.length} act.</TD>
              </TotalTR>
            </TBody>
          </Table>
        )}
      </BigCard>
    </>
  )
}
