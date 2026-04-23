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
import type { CanalAbv, EstadoMarca, MarcaConJoin } from '@/types/configuracion'

interface MarcaRow {
  id: string
  nombre: string
  cocina: string | null
  responsable_id: string | null
  tm_medio: number
  objetivo_mes: number
  estado: EstadoMarca
  es_anchor: boolean
  responsable: { id: string; nombre: string; avatar_color: string | null } | null
  marca_canal: { activo: boolean; canales: { abv: CanalAbv } | null }[]
}

export default function TabMarcas() {
  const isDark = useIsDark()
  const [marcas, setMarcas] = useState<MarcaConJoin[]>([])
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
          .select(`
            id, nombre, cocina, responsable_id, tm_medio, objetivo_mes, estado, es_anchor,
            responsable:usuarios!marcas_responsable_fk(id, nombre, avatar_color),
            marca_canal(activo, canales(abv))
          `)
          .order('es_anchor', { ascending: false })
          .order('objetivo_mes', { ascending: false })

        if (error) throw error
        if (cancelled) return

        const rows = (data as unknown as MarcaRow[] | null) ?? []
        const mapped: MarcaConJoin[] = rows.map(r => ({
          id: r.id,
          nombre: r.nombre,
          cocina: r.cocina,
          responsable_id: r.responsable_id,
          tm_medio: Number(r.tm_medio) || 0,
          objetivo_mes: Number(r.objetivo_mes) || 0,
          estado: r.estado,
          es_anchor: r.es_anchor,
          responsable_nombre: r.responsable?.nombre ?? null,
          responsable_avatar: r.responsable?.avatar_color ?? null,
          canales_abvs: (r.marca_canal ?? [])
            .filter(mc => mc.activo && mc.canales?.abv)
            .map(mc => mc.canales!.abv),
        }))
        setMarcas(mapped)
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

  const activas  = marcas.filter(m => m.estado === 'activa')
  const pausadas = marcas.filter(m => m.estado === 'pausada')
  const tmMedio = activas.length > 0
    ? activas.reduce((a, m) => a + m.tm_medio, 0) / activas.length
    : 0
  const objTotal = marcas.reduce((a, m) => a + (m.estado === 'activa' ? m.objetivo_mes : 0), 0)
  const responsablesSet = new Set(
    marcas.map(m => m.responsable_nombre).filter(Boolean) as string[]
  )
  const responsablesLabel = Array.from(responsablesSet).join(' · ') || '—'

  const handleExport = () => {
    const rows = marcas.map(m => ({
      Marca: m.nombre + (m.es_anchor ? ' (anchor)' : ''),
      Cocina: m.cocina ?? '',
      Responsable: m.responsable_nombre ?? '',
      Canales: m.canales_abvs.join(' '),
      TM_medio: m.tm_medio,
      Objetivo_mes: m.objetivo_mes,
      Estado: m.estado,
    }))
    exportCsv('marcas.csv', rows)
  }

  const handleNueva = () => {
    alert('Pendiente: formulario "Nueva marca" (próximo sprint)')
  }

  if (loading) {
    return <div style={{ padding: 24, color: isDark ? '#777' : '#9E9588' }}>Cargando marcas…</div>
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

  return (
    <>
      <KpiGrid>
        <KpiCard
          label="Marcas activas"
          value={activas.length}
          sub={pausadas.length > 0 ? `${pausadas.length} pausada${pausadas.length !== 1 ? 's' : ''}` : 'todas activas'}
          subTone={pausadas.length > 0 ? 'neg' : 'pos'}
        />
        <KpiCard label="TM medio" value={fmtEur(tmMedio)} sub="portfolio" />
        <KpiCard label="Obj. total mes" value={fmtEur(objTotal)} sub="suma marcas" />
        <KpiCard
          label="Responsables"
          value={responsablesSet.size}
          sub={responsablesLabel}
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
          <div style={{ padding: 24, color: isDark ? '#777' : '#9E9588', textAlign: 'center' }}>
            {marcas.length === 0 ? 'Sin marcas registradas.' : 'Sin resultados para esa búsqueda.'}
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Marca</TH>
                <TH>Cocina</TH>
                <TH>Resp.</TH>
                <TH>Canales</TH>
                <TH num>TM</TH>
                <TH num>Obj. mes</TH>
                <TH>Estado</TH>
              </tr>
            </THead>
            <TBody>
              {filtradas.map(m => (
                <TR key={m.id}>
                  <TD bold>
                    {m.nombre}
                    {m.es_anchor && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 400,
                          color: isDark ? '#777' : '#9E9588',
                        }}
                      >
                        · anchor brand
                      </span>
                    )}
                  </TD>
                  <TD muted>{m.cocina ?? '—'}</TD>
                  <TD muted>{m.responsable_nombre ?? '—'}</TD>
                  <TD>
                    {m.canales_abvs.length === 0
                      ? <span style={{ color: isDark ? '#777' : '#9E9588' }}>—</span>
                      : m.canales_abvs.map(abv => <Ctag key={abv} abv={abv} />)}
                  </TD>
                  <TD num bold>{fmtEur(m.tm_medio)}</TD>
                  <TD num bold>{m.estado === 'pausada' ? '—' : fmtEur(m.objetivo_mes)}</TD>
                  <TD>
                    <StatusTag variant={m.estado === 'activa' ? 'ok' : 'off'}>
                      {m.estado === 'activa' ? 'Activa' : 'Pausada'}
                    </StatusTag>
                  </TD>
                </TR>
              ))}
              <TotalTR>
                <TD bold muted>TOTAL</TD>
                <TD>—</TD>
                <TD>—</TD>
                <TD>—</TD>
                <TD num bold>{fmtEur(tmMedio)}</TD>
                <TD num bold>{fmtEur(objTotal)}</TD>
                <TD muted>{activas.length} act.</TD>
              </TotalTR>
            </TBody>
          </Table>
        )}
      </BigCard>
    </>
  )
}
