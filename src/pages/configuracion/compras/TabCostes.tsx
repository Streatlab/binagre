import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { BtnRed } from '@/components/configuracion/Toolbar'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import type { ParametrosEscandallo } from '@/types/configuracion'

interface Draft {
  estructura_pct_legacy: number
  margen_deseado_pct: number
  estructura_pct: number
  merma_default_pct: number
  semaforo_verde_pct: number
  semaforo_amarillo_pct: number
}

interface ConfigCanalLite {
  id: string
  canal: string
  comision_pct: number
  coste_fijo: number
  margen_obj_pct: number
}

function num(v: string | number): number {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
  return isNaN(n) ? 0 : n
}

export default function TabCostes() {
  const isDark = useIsDark()
  const [params, setParams] = useState<ParametrosEscandallo | null>(null)
  const [estructuraLegacyValor, setEstructuraLegacyValor] = useState<string>('30')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [canales, setCanales] = useState<ConfigCanalLite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [pRes, eRes, cRes] = await Promise.all([
        supabase.from('parametros_escandallo').select('*').limit(1).maybeSingle(),
        supabase.from('configuracion').select('valor').eq('clave', 'estructura_pct').maybeSingle(),
        supabase.from('config_canales').select('id, canal, comision_pct, coste_fijo, margen_obj_pct').order('comision_pct', { ascending: false }),
      ])
      if (pRes.error) throw pRes.error
      if (cRes.error) throw cRes.error

      const legacyValor = eRes.data?.valor ?? '30'
      setEstructuraLegacyValor(legacyValor)

      const p = pRes.data as ParametrosEscandallo | null
      if (p) {
        const parsed = {
          id: p.id,
          margen_deseado_pct: Number(p.margen_deseado_pct) || 0,
          estructura_pct: Number(p.estructura_pct) || 0,
          merma_default_pct: Number(p.merma_default_pct) || 0,
          semaforo_verde_pct: Number(p.semaforo_verde_pct) || 0,
          semaforo_amarillo_pct: Number(p.semaforo_amarillo_pct) || 0,
        }
        setParams(parsed)
        setDraft({
          estructura_pct_legacy: parseFloat(legacyValor) || 30,
          margen_deseado_pct: parsed.margen_deseado_pct,
          estructura_pct: parsed.estructura_pct,
          merma_default_pct: parsed.merma_default_pct,
          semaforo_verde_pct: parsed.semaforo_verde_pct,
          semaforo_amarillo_pct: parsed.semaforo_amarillo_pct,
        })
      } else {
        setDraft({
          estructura_pct_legacy: parseFloat(legacyValor) || 30,
          margen_deseado_pct: 0,
          estructura_pct: 0,
          merma_default_pct: 0,
          semaforo_verde_pct: 0,
          semaforo_amarillo_pct: 0,
        })
      }

      setCanales(((cRes.data ?? []) as unknown as ConfigCanalLite[]).map(c => ({
        ...c,
        comision_pct: Number(c.comision_pct) || 0,
        coste_fijo: Number(c.coste_fijo) || 0,
        margen_obj_pct: Number(c.margen_obj_pct) || 0,
      })))
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando parámetros')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const mut = isDark ? '#777' : '#9E9588'
  const labelColor = isDark ? '#777' : '#9E9588'
  const textPri = isDark ? '#ffffff' : '#1A1A1A'
  const border = isDark ? '#2a2a2a' : '#E9E1D0'
  const inputBg = isDark ? '#1e1e1e' : '#ffffff'
  const subtle = isDark ? '#aaa' : '#6E6656'

  const dirty = useMemo(() => {
    if (!draft) return false
    const legacyDirty = String(draft.estructura_pct_legacy) !== estructuraLegacyValor
    if (!params) return legacyDirty
    return (
      legacyDirty ||
      params.margen_deseado_pct !== draft.margen_deseado_pct ||
      params.estructura_pct !== draft.estructura_pct ||
      params.merma_default_pct !== draft.merma_default_pct ||
      params.semaforo_verde_pct !== draft.semaforo_verde_pct ||
      params.semaforo_amarillo_pct !== draft.semaforo_amarillo_pct
    )
  }, [params, draft, estructuraLegacyValor])

  const validation = useMemo<string | null>(() => {
    if (!draft) return null
    if (draft.estructura_pct_legacy < 0 || draft.estructura_pct_legacy > 100) return 'Coste estructura fuera de rango 0–100'
    if (draft.margen_deseado_pct < 0 || draft.margen_deseado_pct > 100) return 'Margen deseado fuera de rango 0–100'
    if (draft.estructura_pct < 0 || draft.estructura_pct > 50) return 'Estructura fuera de rango 0–50'
    if (draft.merma_default_pct < 0 || draft.merma_default_pct > 30) return 'Merma default fuera de rango 0–30'
    if (draft.semaforo_verde_pct <= draft.semaforo_amarillo_pct) return 'Verde debe ser mayor que amarillo'
    return null
  }, [draft])

  const handleGuardar = async () => {
    if (!draft || validation) return
    try {
      setSaving(true)
      setError(null)

      const r1 = await supabase
        .from('configuracion')
        .upsert({ clave: 'estructura_pct', valor: String(draft.estructura_pct_legacy) }, { onConflict: 'clave' })
      if (r1.error) throw r1.error

      if (params) {
        const r2 = await supabase
          .from('parametros_escandallo')
          .update({
            margen_deseado_pct: draft.margen_deseado_pct,
            estructura_pct: draft.estructura_pct,
            merma_default_pct: draft.merma_default_pct,
            semaforo_verde_pct: draft.semaforo_verde_pct,
            semaforo_amarillo_pct: draft.semaforo_amarillo_pct,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)
        if (r2.error) throw r2.error
      } else {
        const r2 = await supabase
          .from('parametros_escandallo')
          .insert({
            margen_deseado_pct: draft.margen_deseado_pct,
            estructura_pct: draft.estructura_pct,
            merma_default_pct: draft.merma_default_pct,
            semaforo_verde_pct: draft.semaforo_verde_pct,
            semaforo_amarillo_pct: draft.semaforo_amarillo_pct,
          })
        if (r2.error) throw r2.error
      }

      await load()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e?.message ?? 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !draft) {
    return <div style={{ padding: 24, color: mut }}>Cargando parámetros…</div>
  }
  if (error && !draft) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }

  const labelSt: React.CSSProperties = {
    display: 'block',
    fontFamily: 'Oswald, sans-serif',
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: labelColor,
    marginBottom: 8,
    fontWeight: 500,
  }
  const inputWrap: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: inputBg,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '8px 12px',
  }
  const inputSt: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: textPri,
    fontFamily: 'Lexend, sans-serif',
    fontSize: 14,
  }

  return (
    <>
      <KpiGrid>
        <KpiCard label="Coste estructura" value={`${draft.estructura_pct_legacy}`} unit="%" sub="sobre PVP neto" />
        <KpiCard label="Margen objetivo" value={`${draft.margen_deseado_pct}`} unit="%" sub="deseado" />
        <KpiCard label="Merma default" value={`${draft.merma_default_pct}`} unit="%" sub="técnica" />
        <KpiCard
          label="Semáforo"
          value={`${draft.semaforo_verde_pct}/${draft.semaforo_amarillo_pct}`}
          sub="verde / amarillo %"
        />
      </KpiGrid>

      <BigCard title="Coste estructura">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 300px)', gap: 8 }}>
          <div>
            <label style={labelSt}>Coste estructura (%)</label>
            <div style={inputWrap}>
              <input
                type="number"
                step="0.1"
                value={draft.estructura_pct_legacy}
                onChange={e => setDraft({ ...draft, estructura_pct_legacy: num(e.target.value) })}
                style={inputSt}
              />
              <span style={{ color: mut, fontSize: 13 }}>%</span>
            </div>
            <p style={{ marginTop: 6, fontSize: 12, color: subtle, fontFamily: 'Lexend, sans-serif' }}>
              Se aplica sobre PVP neto (sin IVA) en todas las recetas
            </p>
          </div>
        </div>
      </BigCard>

      <BigCard title="Parámetros de escandallo">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelSt}>Margen deseado</label>
            <div style={inputWrap}>
              <input type="number" step="0.5" value={draft.margen_deseado_pct}
                onChange={e => setDraft({ ...draft, margen_deseado_pct: num(e.target.value) })} style={inputSt} />
              <span style={{ color: mut, fontSize: 13 }}>%</span>
            </div>
          </div>
          <div>
            <label style={labelSt}>Estructura (escandallo)</label>
            <div style={inputWrap}>
              <input type="number" step="0.5" value={draft.estructura_pct}
                onChange={e => setDraft({ ...draft, estructura_pct: num(e.target.value) })} style={inputSt} />
              <span style={{ color: mut, fontSize: 13 }}>%</span>
            </div>
          </div>
          <div>
            <label style={labelSt}>Merma técnica default</label>
            <div style={inputWrap}>
              <input type="number" step="0.5" value={draft.merma_default_pct}
                onChange={e => setDraft({ ...draft, merma_default_pct: num(e.target.value) })} style={inputSt} />
              <span style={{ color: mut, fontSize: 13 }}>%</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <div>
            <label style={labelSt}>Semáforo verde (≥)</label>
            <div style={inputWrap}>
              <input type="number" step="1" value={draft.semaforo_verde_pct}
                onChange={e => setDraft({ ...draft, semaforo_verde_pct: num(e.target.value) })} style={inputSt} />
              <span style={{ color: mut, fontSize: 13 }}>%</span>
            </div>
          </div>
          <div>
            <label style={labelSt}>Semáforo amarillo (≥)</label>
            <div style={inputWrap}>
              <input type="number" step="1" value={draft.semaforo_amarillo_pct}
                onChange={e => setDraft({ ...draft, semaforo_amarillo_pct: num(e.target.value) })} style={inputSt} />
              <span style={{ color: mut, fontSize: 13 }}>%</span>
            </div>
          </div>
        </div>
      </BigCard>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <BtnRed
          onClick={handleGuardar}
          disabled={!dirty || !!validation || saving}
          style={{ opacity: (!dirty || !!validation || saving) ? 0.5 : 1, cursor: (!dirty || !!validation || saving) ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </BtnRed>
        {validation && <span style={{ fontSize: 13, color: '#B01D23' }}>{validation}</span>}
        {error && <span style={{ fontSize: 13, color: '#B01D23' }}>{error}</span>}
        {!dirty && !saving && !saved && !validation && !error && (
          <span style={{ fontSize: 12, color: mut }}>Sin cambios pendientes</span>
        )}
      </div>

      <BigCard title="Pricing por canal" count="desde config_canales">
        {canales.length === 0 ? (
          <div style={{ padding: 24, color: mut, textAlign: 'center' }}>Sin canales configurados.</div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Canal</TH>
                <TH num>Comisión</TH>
                <TH num>Coste fijo</TH>
                <TH num>Margen obj.</TH>
                <TH num>Margen neto estim.</TH>
              </tr>
            </THead>
            <TBody>
              {canales.map(c => {
                const margenNeto = 100 - c.comision_pct - draft.estructura_pct_legacy
                return (
                  <TR key={c.id}>
                    <TD bold>{c.canal}</TD>
                    <TD num>{c.comision_pct.toFixed(1)} %</TD>
                    <TD num>{fmtEur(c.coste_fijo)}</TD>
                    <TD num>{c.margen_obj_pct.toFixed(1)} %</TD>
                    <TD num bold>{margenNeto.toFixed(0)} %</TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </BigCard>
    </>
  )
}
