import { AZUL, BLANCO, BORDE_SUAVE, CLARO, CREMA, GRANATE, GRIS, INK } from '@/styles/neobrutal'
import { CONFIG_AMBER_WASH, CANAL_UBER_DARK } from '@/styles/palettes'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT, useTheme } from '@/styles/tokens'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'
import { EditModal, Field } from '@/components/configuracion/EditModal'

interface ReglaGlobal {
  id: string
  modulo: 'ocr' | 'conciliacion' | 'global'
  codigo: string
  titulo: string
  descripcion: string
  prioridad: number
  activa: boolean
  bloqueante: boolean
  created_at: string
  updated_at: string
}

export default function ReglasGlobalesPanel() {
  const { T } = useTheme()
  const [reglas, setReglas] = useState<ReglaGlobal[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ReglaGlobal | null>(null)
  const [creating, setCreating] = useState(false)
  const [fModulo, setFModulo] = useState<'ocr' | 'conciliacion' | 'global'>('ocr')
  const [fCodigo, setFCodigo] = useState('')
  const [fTitulo, setFTitulo] = useState('')
  const [fDescripcion, setFDescripcion] = useState('')
  const [fPrioridad, setFPrioridad] = useState(100)
  const [fActiva, setFActiva] = useState(true)
  const [fBloqueante, setFBloqueante] = useState(true)
  const [saving, setSaving] = useState(false)

  async function refetch() {
    const { data } = await supabase
      .from('reglas_globales')
      .select('*')
      .order('modulo')
      .order('prioridad')
    setReglas((data ?? []) as ReglaGlobal[])
  }

  useEffect(() => { refetch().finally(() => setLoading(false)) }, [])

  function open(r?: ReglaGlobal) {
    if (r) {
      setEditing(r)
      setFModulo(r.modulo); setFCodigo(r.codigo); setFTitulo(r.titulo)
      setFDescripcion(r.descripcion); setFPrioridad(r.prioridad)
      setFActiva(r.activa); setFBloqueante(r.bloqueante)
    } else {
      setCreating(true)
      setFModulo('ocr'); setFCodigo(''); setFTitulo(''); setFDescripcion('')
      setFPrioridad(100); setFActiva(true); setFBloqueante(true)
    }
  }
  function close() { setEditing(null); setCreating(false) }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        modulo: fModulo,
        codigo: fCodigo.trim().toUpperCase(),
        titulo: fTitulo.trim(),
        descripcion: fDescripcion.trim(),
        prioridad: fPrioridad,
        activa: fActiva,
        bloqueante: fBloqueante,
        updated_at: new Date().toISOString(),
      }
      const q = editing
        ? supabase.from('reglas_globales').update(payload).eq('id', editing.id)
        : supabase.from('reglas_globales').insert(payload)
      const { error } = await q
      if (error) throw error
      await refetch(); close()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing) return
    if (!confirm(`Eliminar regla "${editing.codigo}"?`)) return
    await supabase.from('reglas_globales').delete().eq('id', editing.id)
    await refetch(); close()
  }

  async function toggleActiva(r: ReglaGlobal) {
    await supabase.from('reglas_globales').update({ activa: !r.activa }).eq('id', r.id)
    await refetch()
  }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando…</div>

  const moduloColor = {
    ocr: AZUL,
    conciliacion: CANAL_UBER_DARK,
    global: GRANATE,
  }
  const moduloLabel = {
    ocr: 'OCR',
    conciliacion: 'Conciliación',
    global: 'Global',
  }

  const reglasPorModulo: Record<string, ReglaGlobal[]> = { ocr: [], conciliacion: [], global: [] }
  for (const r of reglas) reglasPorModulo[r.modulo].push(r)

  return (
    <>
      <ConfigGroupCard
        title="Reglas globales del sistema"
        subtitle={`${reglas.length} reglas activas — políticas de comportamiento OCR / Conciliación`}
      >
        <div style={{ margin: '0 22px 14px', padding: 14, background: CONFIG_AMBER_WASH.bgLight, border: `1px solid ${CONFIG_AMBER_WASH.brdLight}`, borderRadius: 8, fontSize: 12.5, color: CONFIG_AMBER_WASH.txtSubLight, fontFamily: FONT.body }}>
          <strong style={{ color: CONFIG_AMBER_WASH.txtStrongLight }}>Cómo funcionan:</strong> Las reglas con <em>Bloqueante = sí</em> se aplican vía triggers en BBDD y no se pueden saltar. Las reglas con <em>Bloqueante = no</em> son políticas que la UI y los procesos respetan pero pueden tener excepciones. Cualquier chat o agente que toque OCR/Conciliación debe leer estas reglas antes de actuar.
        </div>

        {(['ocr', 'conciliacion', 'global'] as const).map(modulo => {
          const items = reglasPorModulo[modulo]
          if (items.length === 0) return null
          return (
            <div key={modulo} style={{ marginBottom: 18 }}>
              <div style={{ padding: '8px 22px', background: CREMA, borderTop: `0.5px solid ${BORDE_SUAVE}`, borderBottom: `0.5px solid ${BORDE_SUAVE}`, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: moduloColor[modulo] }}>
                {moduloLabel[modulo]} — {items.length} regla{items.length !== 1 ? 's' : ''}
              </div>
              {items.map(r => (
                <div key={r.id} onClick={() => open(r)} style={{ padding: '12px 22px', borderBottom: `0.5px solid ${CLARO}`, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14, background: BLANCO }}>
                  <div style={{ flexShrink: 0, fontFamily: FONT.heading, fontSize: 11, fontWeight: 500, color: moduloColor[modulo], letterSpacing: '1px', width: 70 }}>
                    {r.codigo}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT.body, fontSize: 13, fontWeight: 500, color: INK, marginBottom: 4 }}>{r.titulo}</div>
                    <div style={{ fontFamily: FONT.body, fontSize: 12, color: GRIS, lineHeight: 1.5 }}>{r.descripcion}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    {r.bloqueante && (
                      <span style={{ fontFamily: FONT.heading, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: GRANATE, background: '#B01D2315', padding: '2px 6px', borderRadius: 4 }}>Bloqueante</span>
                    )}
                    <label onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: GRIS, fontFamily: FONT.body, cursor: 'pointer' }}>
                      <input type="checkbox" checked={r.activa} onChange={() => toggleActiva(r)} style={{ cursor: 'pointer' }} />
                      Activa
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 22px 18px', borderTop: `0.5px solid ${BORDE_SUAVE}`, background: CREMA }}>
          <button onClick={() => open()} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: GRANATE, color: BLANCO, fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}>+ Nueva regla</button>
        </div>
      </ConfigGroupCard>

      {(editing || creating) && (
        <EditModal title={editing ? 'Editar regla global' : 'Nueva regla global'} onSave={handleSave} onCancel={close} onDelete={editing ? handleDelete : undefined} saving={saving} canSave={!!fCodigo && !!fTitulo && !!fDescripcion}>
          <Field label="Módulo">
            <div className="flex gap-3">
              {(['ocr', 'conciliacion', 'global'] as const).map(m => (
                <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={fModulo === m} onChange={() => setFModulo(m)} />
                  {moduloLabel[m]}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Código (ej. OCR-004)">
            <input value={fCodigo} onChange={e => setFCodigo(e.target.value)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--sl-border-focus)]" />
          </Field>
          <Field label="Título corto">
            <input value={fTitulo} onChange={e => setFTitulo(e.target.value)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" />
          </Field>
          <Field label="Descripción">
            <textarea value={fDescripcion} onChange={e => setFDescripcion(e.target.value)} rows={4} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" />
          </Field>
          <Field label="Prioridad (menor = aplicada antes)">
            <input type="number" value={fPrioridad} onChange={e => setFPrioridad(Number(e.target.value) || 100)} className="w-full px-3 py-2 border border-[var(--sl-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--sl-border-focus)]" />
          </Field>
          <Field label="Configuración">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={fActiva} onChange={e => setFActiva(e.target.checked)} /> Regla activa
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={fBloqueante} onChange={e => setFBloqueante(e.target.checked)} /> Bloqueante (se aplica vía trigger BBDD)
              </label>
            </div>
          </Field>
        </EditModal>
      )}
    </>
  )
}
