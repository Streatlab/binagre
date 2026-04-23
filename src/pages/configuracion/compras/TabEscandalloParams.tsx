import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsDark } from '@/hooks/useIsDark'
import { KpiCard, KpiGrid } from '@/components/configuracion/KpiCard'
import { BigCard } from '@/components/configuracion/BigCard'
import { BtnRed } from '@/components/configuracion/Toolbar'
import { Table, THead, TBody, TH, TR, TD } from '@/components/configuracion/ConfigTable'
import type { ParametrosEscandallo, Canal } from '@/types/configuracion'

interface Editable {
  margen_deseado_pct: number
  estructura_pct: number
  merma_default_pct: number
  semaforo_verde_pct: number
  semaforo_amarillo_pct: number
}

function num(v: string | number): number {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
  return isNaN(n) ? 0 : n
}

export default function TabEscandalloParams() {
  const isDark = useIsDark()
  const [params, setParams] = useState<ParametrosEscandallo | null>(null)
  const [draft, setDraft] = useState<Editable | null>(null)
  const [canales, setCanales] = useState<Canal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [pRes, cRes] = await Promise.all([
        supabase.from('parametros_escandallo').select('*').limit(1).maybeSingle(),
        supabase.from('canales').select('*').eq('activo', true).order('nombre'),
      ])
      if (pRes.error) throw pRes.error
      if (cRes.error) throw cRes.error
      const p = pRes.data as ParametrosEscandallo | null
      if (p) {
        const parsed: ParametrosEscandallo = {
          id: p.id,
          margen_deseado_pct: Number(p.margen_deseado_pct) || 0,
          estructura_pct: Number(p.estructura_pct) || 0,
          merma_default_pct: Number(p.merma_default_pct) || 0,
          semaforo_verde_pct: Number(p.semaforo_verde_pct) || 0,
          semaforo_amarillo_pct: Number(p.semaforo_amarillo_pct) || 0,
        }
        setParams(parsed)
        setDraft({
          margen_deseado_pct: parsed.margen_deseado_pct,
          estructura_pct: parsed.estructura_pct,
          merma_default_pct: parsed.merma_default_pct,
          semaforo_verde_pct: parsed.semaforo_verde_pct,
          semaforo_amarillo_pct: parsed.semaforo_amarillo_pct,
        })
      }
      setCanales((cRes.data as Canal[]) ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando parámetros')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const muted = isDark ? '#777' : '#9E9588'
  const labelColor = isDark ? '#777' : '#9E9588'
  const textPri = isDark ? '#ffffff' : '#1A1A1A'
  const border = isDark ? '#2a2a2a' : '#E9E1D0'
  const inputBg = isDark ? '#1e1e1e' : '#ffffff'

  const dirty = useMemo(() => {
    if (!params || !draft) return false
    return (
      params.margen_deseado_pct !== draft.margen_deseado_pct ||
      params.estructura_pct !== draft.estructura_pct ||
      params.merma_default_pct !== draft.merma_default_pct ||
      params.semaforo_verde_pct !== draft.semaforo_verde_pct ||
      params.semaforo_amarillo_pct !== draft.semaforo_amarillo_pct
    )
  }, [params, draft])

  const validation = useMemo<string | null>(() => {
    if (!draft) return null
    if (draft.margen_deseado_pct < 0 || draft.margen_deseado_pct > 100) return 'Margen deseado fuera de rango 0–100'
    if (draft.estructura_pct < 0 || draft.estructura_pct > 50) return 'Estructura fuera de rango 0–50'
    if (draft.merma_default_pct < 0 || draft.merma_default_pct > 30) return 'Merma default fuera de rango 0–30'
    if (draft.semaforo_verde_pct <= draft.semaforo_amarillo_pct) return 'Verde debe ser mayor que amarillo'
    return null
  }, [draft])

  const handleGuardar = async () => {
    if (!params || !draft || validation) return
    try {
      setSaving(true)
      setError(null)
      const { error: upErr } = await supabase
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
      if (upErr) throw upErr
      await load()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e?.message ?? 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: muted }}>Cargando parámetros…</div>
  }
  if (error && !params) {
    return (
      <div style={{ padding: 16, background: isDark ? '#3a1a1a' : '#FCE0E2', color: isDark ? '#ff8080' : '#B01D23', borderRadius: 12 }}>
        {error}
      </div>
    )
  }
  if (!params || !draft) {
    return <div style={{ padding: 24, color: muted }}>Sin parámetros de escandallo.</div>
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
        <KpiCard label="Margen objetivo" value={`${params.margen_deseado_pct}`} unit="%" sub="deseado" />
        <KpiCard label="Estructura" value={`${params.estructura_pct}`} unit="%" sub="sobre PVP" />
        <KpiCard label="Merma default" value={`${params.merma_default_pct}`} unit="%" sub="técnica" />
        <KpiCard
          label="Semáforo"
          value={`${params.semaforo_verde_pct} / ${params.semaforo_amarillo_pct}`}
          sub="verde / amarillo %"
        />
      </KpiGrid>

      <BigCard title="Parámetros de coste">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelSt}>Margen deseado</label>
            <div style={inputWrap}>
              <input
                type="number"
                step="0.5"
                value={draft.margen_deseado_pct}
                onChange={e => setDraft({ ...draft, margen_deseado_pct: num(e.target.value) })}
                style={inputSt}
              />
              <span style={{ color: muted, fontSize: 13 }}>%</span>
            </div>
          </div>
          <div>
            <label style={labelSt}>Estructura</label>
            <div style={inputWrap}>
              <input
                type="number"
                step="0.5"
                value={draft.estructura_pct}
                onChange={e => setDraft({ ...draft, estructura_pct: num(e.target.value) })}
                style={inputSt}
              />
              <span style={{ color: muted, fontSize: 13 }}>%</span>
            </div>
          </div>
          <div>
            <label style={labelSt}>Merma técnica default</label>
            <div style={inputWrap}>
              <input
                type="number"
                step="0.5"
                value={draft.merma_default_pct}
                onChange={e => setDraft({ ...draft, merma_default_pct: num(e.target.value) })}
                style={inputSt}
              />
              <span style={{ color: muted, fontSize: 13 }}>%</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelSt}>Semáforo verde (≥)</label>
            <div style={inputWrap}>
              <input
                type="number"
                step="1"
                value={draft.semaforo_verde_pct}
                onChange={e => setDraft({ ...draft, semaforo_verde_pct: num(e.target.value) })}
                style={inputSt}
              />
              <span style={{ color: muted, fontSize: 13 }}>%</span>
            </div>
          </div>
          <div>
            <label style={labelSt}>Semáforo amarillo (≥)</label>
            <div style={inputWrap}>
              <input
                type="number"
                step="1"
                value={draft.semaforo_amarillo_pct}
                onChange={e => setDraft({ ...draft, semaforo_amarillo_pct: num(e.target.value) })}
                style={inputSt}
              />
              <span style={{ color: muted, fontSize: 13 }}>%</span>
            </div>
          </div>
        </div>

        {validation && (
          <div style={{ marginBottom: 12, fontSize: 13, color: '#B01D23', fontFamily: 'Lexend, sans-serif' }}>
            {validation}
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 12, fontSize: 13, color: '#B01D23', fontFamily: 'Lexend, sans-serif' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BtnRed
            onClick={handleGuardar}
            disabled={!dirty || !!validation || saving}
            style={{ opacity: (!dirty || !!validation || saving) ? 0.5 : 1, cursor: (!dirty || !!validation || saving) ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar cambios'}
          </BtnRed>
          {!dirty && !saving && !saved && (
            <span style={{ fontSize: 12, color: muted, fontFamily: 'Lexend, sans-serif' }}>
              Sin cambios pendientes
            </span>
          )}
        </div>
      </BigCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        <BigCard title="Semáforo de margen">
          <Table>
            <THead>
              <tr>
                <TH>Color</TH>
                <TH>Estado</TH>
                <TH num>Margen</TH>
                <TH>Uso</TH>
              </tr>
            </THead>
            <TBody>
              <TR>
                <TD>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#22B573', marginRight: 8 }} />
                  Verde
                </TD>
                <TD bold>Óptimo</TD>
                <TD num>≥ {draft.semaforo_verde_pct} %</TD>
                <TD muted>Potenciar en carta</TD>
              </TR>
              <TR>
                <TD>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#E89A2B', marginRight: 8 }} />
                  Amarillo
                </TD>
                <TD bold>Aceptable</TD>
                <TD num>{draft.semaforo_amarillo_pct}–{draft.semaforo_verde_pct} %</TD>
                <TD muted>Revisar precio</TD>
              </TR>
              <TR>
                <TD>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#E94B5A', marginRight: 8 }} />
                  Rojo
                </TD>
                <TD bold>Crítico</TD>
                <TD num>&lt; {draft.semaforo_amarillo_pct} %</TD>
                <TD muted>Eliminar / reformular</TD>
              </TR>
            </TBody>
          </Table>
        </BigCard>

        <BigCard title="Pricing por canal">
          {canales.length === 0 ? (
            <div style={{ padding: 24, color: muted, textAlign: 'center' }}>Sin canales activos.</div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Canal</TH>
                  <TH num>Markup</TH>
                  <TH num>Comisión</TH>
                  <TH num>Margen neto</TH>
                </tr>
              </THead>
              <TBody>
                {canales.map(c => {
                  const markup = Number(c.markup_pct) || 0
                  const comision = Number(c.comision_pct) || 0
                  const margenNeto = 100 - comision - 5
                  return (
                    <TR key={c.id}>
                      <TD>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c.color, marginRight: 8 }} />
                        {c.nombre}
                      </TD>
                      <TD num>{markup > 0 ? `+${markup} %` : '0 %'}</TD>
                      <TD num>{comision} %</TD>
                      <TD num bold>{margenNeto.toFixed(0)} %</TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </BigCard>
      </div>
    </>
  )
}
