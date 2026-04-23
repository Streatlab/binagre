import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import type { Canal, CanalAbv } from '@/types/configuracion'

const ABV_ORDER: CanalAbv[] = ['UE', 'GL', 'JE', 'WEB', 'DIR']

interface MarcaConCanales {
  id: string
  nombre: string
  activa_por_abv: Record<CanalAbv, boolean>
}

interface MarcaCanalRow {
  activo: boolean
  canales: { abv: CanalAbv } | null
}

interface MarcaConJoinDb {
  id: string
  nombre: string
  estado: string
  marca_canal: MarcaCanalRow[]
}

export default function TabCanales() {
  const isDark = useIsDark()
  const [canales, setCanales] = useState<Canal[]>([])
  const [marcas, setMarcas] = useState<MarcaConCanales[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const cargar = async () => {
    const [c, m] = await Promise.all([
      supabase.from('canales').select('*').order('comision_pct', { ascending: false }),
      supabase.from('marcas').select('id, nombre, estado, marca_canal(activo, canales(abv))').order('nombre'),
    ])
    if (c.error) throw c.error
    if (m.error) throw m.error

    const canalesData = ((c.data ?? []) as unknown as Canal[]).map(x => ({
      ...x,
      comision_pct: Number(x.comision_pct) || 0,
      tarifa_fija: Number(x.tarifa_fija) || 0,
      iva_pct: Number(x.iva_pct) || 0,
      markup_pct: Number(x.markup_pct) || 0,
    }))

    const marcasData = ((m.data ?? []) as unknown as MarcaConJoinDb[])
      .filter(mm => mm.estado === 'activa')
      .map(mm => {
        const active: Record<CanalAbv, boolean> = { UE: false, GL: false, JE: false, WEB: false, DIR: false }
        for (const mc of (mm.marca_canal ?? [])) {
          if (mc.activo && mc.canales?.abv) active[mc.canales.abv] = true
        }
        return { id: mm.id, nombre: mm.nombre, activa_por_abv: active }
      })

    setCanales(canalesData)
    setMarcas(marcasData)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        await cargar()
        if (cancelled) return
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando canales')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const kpis = useMemo(() => {
    const activos = canales.filter(c => c.activo).length
    const comMediaCon = canales.filter(c => c.comision_pct > 0)
    const comMedia =
      comMediaCon.length > 0
        ? comMediaCon.reduce((a, c) => a + c.comision_pct, 0) / comMediaCon.length
        : 0
    const mejor = canales
      .filter(c => c.activo)
      .sort((a, b) => a.comision_pct - b.comision_pct)[0] ?? null
    const masAdoptado = ABV_ORDER
      .map(abv => ({
        abv,
        count: marcas.filter(m => m.activa_por_abv[abv]).length,
      }))
      .sort((a, b) => b.count - a.count)[0] ?? { abv: 'UE' as CanalAbv, count: 0 }
    const masAdoptadoNombre = canales.find(c => c.abv === masAdoptado.abv)?.nombre ?? masAdoptado.abv
    return { activos, comMedia, mejor, masAdoptado, masAdoptadoNombre }
  }, [canales, marcas])

  const toggleActivo = async (c: Canal) => {
    setSaving(c.id)
    const next = !c.activo
    setCanales(prev => prev.map(x => (x.id === c.id ? { ...x, activo: next } : x)))
    const { error } = await supabase.from('canales').update({ activo: next }).eq('id', c.id)
    setSaving(null)
    if (error) {
      setCanales(prev => prev.map(x => (x.id === c.id ? { ...x, activo: !next } : x)))
      alert(`No se pudo actualizar: ${error.message}`)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: isDark ? '#777' : '#9E9588' }}>Cargando canales…</div>
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

  const mut = isDark ? '#777777' : '#9E9588'

  return (
    <>
      <KpiGrid>
        <KpiCard
          label="Canales activos"
          value={kpis.activos}
          sub={`de ${canales.length} configurados`}
          subTone="muted"
        />
        <KpiCard
          label="Comisión media"
          value={`${kpis.comMedia.toFixed(1)}`}
          unit="%"
          sub="canales con comisión"
        />
        <KpiCard
          label="Mejor margen"
          value={kpis.mejor?.nombre ?? '—'}
          sub={
            kpis.mejor
              ? `${kpis.mejor.comision_pct.toFixed(1)}% comisión`
              : 'sin datos'
          }
          subTone="pos"
        />
        <KpiCard
          label="Canal más adoptado"
          value={kpis.masAdoptadoNombre}
          sub={`${kpis.masAdoptado.count} marca${kpis.masAdoptado.count !== 1 ? 's' : ''}`}
          subTone="muted"
        />
      </KpiGrid>

      <BigCard title="Canales de venta" count={`${canales.length} configurados`}>
        <Table>
          <THead>
            <tr>
              <TH>Canal</TH>
              <TH>ABV</TH>
              <TH num>Comisión</TH>
              <TH num>Tarifa fija</TH>
              <TH num>IVA</TH>
              <TH num>Markup precio</TH>
              <TH>Activo</TH>
            </tr>
          </THead>
          <TBody>
            {canales.map(c => (
              <TR key={c.id}>
                <TD bold>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: c.color,
                      marginRight: 10,
                      verticalAlign: 'middle',
                    }}
                  />
                  {c.nombre}
                </TD>
                <TD>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      background: '#1A1A1A',
                      color: '#ffffff',
                      borderRadius: 4,
                      fontSize: 10,
                      letterSpacing: '0.04em',
                      fontWeight: 700,
                      fontFamily: 'Oswald, sans-serif',
                    }}
                  >
                    {c.abv}
                  </span>
                </TD>
                <TD num bold>{c.comision_pct.toFixed(1)} %</TD>
                <TD num bold>{fmtEur(c.tarifa_fija)}</TD>
                <TD num bold>{c.iva_pct} %</TD>
                <TD num bold>+{c.markup_pct} %</TD>
                <TD>
                  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={c.activo}
                      disabled={saving === c.id}
                      onChange={() => toggleActivo(c)}
                      style={{ width: 36, height: 20, cursor: 'pointer', accentColor: '#B01D23' }}
                    />
                  </label>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </BigCard>

      <BigCard title="Canales activos por marca" count={`${marcas.length} marcas activas`}>
        {marcas.length === 0 ? (
          <div style={{ padding: 12, color: mut }}>
            Sin marcas activas. Crea una marca para ver la matriz.
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Marca</TH>
                {ABV_ORDER.map(abv => {
                  const c = canales.find(x => x.abv === abv)
                  return (
                    <TH key={abv} num style={{ background: c ? hexAlpha(c.color, isDark ? 0.18 : 0.22) : undefined, color: c?.color }}>
                      {abv}
                    </TH>
                  )
                })}
              </tr>
            </THead>
            <TBody>
              {marcas.map(m => (
                <TR key={m.id}>
                  <TD bold>{m.nombre}</TD>
                  {ABV_ORDER.map(abv => {
                    const on = m.activa_por_abv[abv]
                    const c = canales.find(x => x.abv === abv)
                    return (
                      <TD
                        key={abv}
                        num
                        bold
                        style={{
                          background: on && c ? hexAlpha(c.color, isDark ? 0.12 : 0.18) : undefined,
                          color: on && c ? c.color : mut,
                        }}
                      >
                        {on ? '✓' : '—'}
                      </TD>
                    )
                  })}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </BigCard>
    </>
  )
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
