/**
 * Test Visual — Shell.
 * Navegación por submódulos (desde el sidebar). Dentro de cada uno, un toggle
 * de 3 estados para comparar el diseño: Actual / Food Pop / Dark.
 * Todo es copia VISUAL (datos de ejemplo), no toca los módulos reales.
 */
import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { SKINS, type SkinId } from './testvisual/skins'
import PanelGlobalMock from './testvisual/PanelGlobalMock'
import EnPreparacion from './testvisual/EnPreparacion'

export const TV_MODULOS: { slug: string; label: string }[] = [
  { slug: 'panel-global',     label: 'Panel Global' },
  { slug: 'facturacion',      label: 'Facturación' },
  { slug: 'objetivos',        label: 'Objetivos' },
  { slug: 'running',          label: 'Running' },
  { slug: 'escandallo',       label: 'Escandallo' },
  { slug: 'menu-engineering', label: 'Menú Engineering' },
  { slug: 'recetario',        label: 'Recetario' },
  { slug: 'esquemas',         label: 'Esquemas' },
  { slug: 'produccion',       label: 'Producción' },
  { slug: 'horarios',         label: 'Horarios' },
]

const SKIN_LS_KEY = 'tv-skin'

export default function TestVisual() {
  const { modulo } = useParams<{ modulo: string }>()
  const [skinId, setSkinId] = useState<SkinId>(() => {
    const v = localStorage.getItem(SKIN_LS_KEY)
    return (v === 'foodpop' || v === 'dark' || v === 'actual') ? v : 'actual'
  })

  if (!modulo) return <Navigate to="/test-visual/panel-global" replace />

  const cambiar = (id: SkinId) => { setSkinId(id); localStorage.setItem(SKIN_LS_KEY, id) }
  const mod = TV_MODULOS.find(m => m.slug === modulo) ?? TV_MODULOS[0]
  const s = SKINS[skinId]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Barra de control — siempre legible */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#15192a', borderBottom: '1px solid #2a3050', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '2px', color: '#B01D23', textTransform: 'uppercase' }}>Test Visual</span>
        <span style={{ color: '#9ba8c0', fontSize: 13, fontFamily: "'Lexend',sans-serif" }}>· {mod.label}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', background: '#0d1120', borderRadius: 9, padding: 3, gap: 3 }}>
          {(['actual', 'foodpop', 'dark'] as SkinId[]).map(id => {
            const on = id === skinId
            const c = id === 'actual' ? '#B01D23' : id === 'foodpop' ? '#15BDB8' : '#7b61ff'
            return (
              <button key={id} onClick={() => cambiar(id)} style={{
                padding: '6px 14px', borderRadius: 7, cursor: 'pointer', border: 'none',
                fontFamily: "'Lexend',sans-serif", fontSize: 12.5, fontWeight: 700,
                background: on ? c : 'transparent', color: on ? (id === 'foodpop' ? '#06302d' : '#fff') : '#9ba8c0',
              }}>{SKINS[id].label}</button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {mod.slug === 'panel-global'
          ? <PanelGlobalMock s={s} />
          : <EnPreparacion s={s} nombre={mod.label} />}
      </div>
    </div>
  )
}
