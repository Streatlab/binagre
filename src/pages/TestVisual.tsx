import React, { Suspense, useMemo, useState } from 'react'
import { ThemeContext } from '@/contexts/ThemeContext'
import { useTheme, FONT } from '@/styles/tokens'

/* ════════════════════════════════════════════════════════════════
   TEST VISUAL
   Fotos fijas de los módulos reales del ERP, vistas con dos pieles
   candidatas: Food Pop (claro) y Dark Operativo (oscuro).
   El botón alterna la piel para comparar. El contenido es el real.
   ════════════════════════════════════════════════════════════════ */

type Piel = 'foodpop' | 'darkops'

const MODULOS: { key: string; label: string; load: () => Promise<{ default: React.ComponentType<any> }> }[] = [
  { key: 'panel',      label: 'Panel Global',     load: () => import('@/pages/PanelGlobal') },
  { key: 'facturacion',label: 'Facturación',      load: () => import('@/pages/Facturacion') },
  { key: 'objetivos',  label: 'Objetivos',        load: () => import('@/pages/finanzas/Objetivos') },
  { key: 'running',    label: 'Running',          load: () => import('@/pages/finanzas/Running') },
  { key: 'escandallo', label: 'Escandallo',       load: () => import('@/pages/Escandallo') },
  { key: 'menu',       label: 'Menú Engineering', load: () => import('@/pages/cocina/MenuEngineering') },
  { key: 'recetario',  label: 'Recetario',        load: () => import('@/pages/cocina/Recetario') },
  { key: 'esquemas',   label: 'Esquemas',         load: () => import('@/pages/cocina/Esquemas') },
  { key: 'produccion', label: 'Producción',       load: () => import('@/pages/cocina/Produccion') },
  { key: 'horarios',   label: 'Horarios',         load: () => import('@/pages/equipo/Horarios') },
]

const lazyCache: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {}
function getLazy(key: string, load: () => Promise<{ default: React.ComponentType<any> }>) {
  if (!lazyCache[key]) lazyCache[key] = React.lazy(load)
  return lazyCache[key]
}

const PIEL_LS_KEY = 'tv-piel'

export default function TestVisual() {
  const [piel, setPiel] = useState<Piel>(() => {
    const s = localStorage.getItem(PIEL_LS_KEY)
    return (s === 'darkops' ? 'darkops' : 'foodpop')
  })
  const [activo, setActivo] = useState<string>('panel')

  const cambiarPiel = (p: Piel) => { setPiel(p); localStorage.setItem(PIEL_LS_KEY, p) }

  const mod = MODULOS.find(m => m.key === activo) ?? MODULOS[0]
  const Comp = getLazy(mod.key, mod.load)

  const pielCtx = useMemo(() => ({
    theme: piel,
    toggleTheme: () => cambiarPiel(piel === 'foodpop' ? 'darkops' : 'foodpop'),
    setTheme: (t: any) => { if (t === 'foodpop' || t === 'darkops') cambiarPiel(t) },
  }), [piel])

  const esDark = piel === 'darkops'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100vh' }}>
      {/* Barra de control — fuera de la piel, legible siempre */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#15192a', borderBottom: '1px solid #2a3050',
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 14, letterSpacing: '2px', color: '#B01D23', textTransform: 'uppercase' }}>
          Test Visual
        </span>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {MODULOS.map(m => {
            const on = m.key === activo
            return (
              <button
                key={m.key}
                onClick={() => setActivo(m.key)}
                style={{
                  padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                  fontFamily: FONT.body, fontSize: 12.5, fontWeight: on ? 700 : 500,
                  border: on ? 'none' : '1px solid #2a3050',
                  background: on ? '#B01D23' : 'transparent',
                  color: on ? '#fff' : '#9ba8c0', whiteSpace: 'nowrap',
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Toggle de piel */}
        <div style={{ display: 'flex', background: '#0d1120', borderRadius: 9, padding: 3, gap: 3 }}>
          <button
            onClick={() => cambiarPiel('foodpop')}
            style={{
              padding: '6px 13px', borderRadius: 7, cursor: 'pointer', border: 'none',
              fontFamily: FONT.body, fontSize: 12.5, fontWeight: 700,
              background: piel === 'foodpop' ? '#15BDB8' : 'transparent',
              color: piel === 'foodpop' ? '#062e2c' : '#9ba8c0',
            }}
          >
            ☀ Food Pop
          </button>
          <button
            onClick={() => cambiarPiel('darkops')}
            style={{
              padding: '6px 13px', borderRadius: 7, cursor: 'pointer', border: 'none',
              fontFamily: FONT.body, fontSize: 12.5, fontWeight: 700,
              background: piel === 'darkops' ? '#7b61ff' : 'transparent',
              color: piel === 'darkops' ? '#fff' : '#9ba8c0',
            }}
          >
            ☾ Dark Operativo
          </button>
        </div>
      </div>

      {/* Escenario con la piel aplicada (contenido real) */}
      <ThemeContext.Provider value={pielCtx}>
        <TVStage>
          <Suspense fallback={<TVLoading dark={esDark} />}>
            <Comp />
          </Suspense>
        </TVStage>
      </ThemeContext.Provider>
    </div>
  )
}

function TVStage({ children }: { children: React.ReactNode }) {
  const { T } = useTheme()
  return (
    <div style={{ flex: 1, background: T.bg, color: T.pri, minHeight: 0 }}>
      {children}
    </div>
  )
}

function TVLoading({ dark }: { dark: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320,
      fontFamily: FONT.body, fontSize: 14, color: dark ? '#8b91a0' : '#3f6f6c',
    }}>
      Cargando módulo…
    </div>
  )
}
