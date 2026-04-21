import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface Result {
  type: 'page' | 'ingrediente' | 'eps' | 'receta'
  label: string
  sub?: string
  path: string
}

const PAGES: Result[] = [
  { type: 'page', label: 'Dashboard',            path: '/' },
  { type: 'page', label: 'Escandallo',           path: '/escandallo' },
  { type: 'page', label: 'Facturación',          path: '/facturacion' },
  { type: 'page', label: 'Configuración',        path: '/configuracion' },
  { type: 'page', label: 'Revenue & Ticket Medio', sub: 'Analytics', path: '/analytics/revenue' },
  { type: 'page', label: 'Margen por Canal',     sub: 'Analytics', path: '/analytics/margen' },
  { type: 'page', label: 'COGS & Coste MP',      sub: 'Analytics', path: '/analytics/cogs' },
  { type: 'page', label: 'Compras / Pedidos',    sub: 'Stock',     path: '/stock/compras' },
  { type: 'page', label: 'Objetivos Financieros',sub: 'Finanzas',  path: '/finanzas/objetivos' },
]

const TYPE_COLOR: Record<string, string> = {
  page: '#777777', ingrediente: '#e8f442', eps: '#f5a623', receta: '#66aaff',
}
const TYPE_LABEL: Record<string, string> = {
  page: 'PAG', ingrediente: 'ING', eps: 'EPS', receta: 'REC',
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>(PAGES)
  const [loading, setLoading] = useState(false)
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (open) { setQuery(''); setResults(PAGES); setSel(0); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults(PAGES); setSel(0); return }
    const ql = q.toLowerCase()
    const matchedPages = PAGES.filter(p =>
      p.label.toLowerCase().includes(ql) || (p.sub ?? '').toLowerCase().includes(ql)
    )
    setLoading(true)
    const timer = setTimeout(async () => {
      const [{ data: ings }, { data: epsList }, { data: recs }] = await Promise.all([
        supabase.from('ingredientes').select('id, nombre, categoria').ilike('nombre', `%${q}%`).limit(6),
        supabase.from('eps').select('id, nombre').ilike('nombre', `%${q}%`).limit(4),
        supabase.from('recetas').select('id, nombre, categoria').ilike('nombre', `%${q}%`).limit(6),
      ])
      const db: Result[] = [
        ...(ings ?? []).map(i => ({ type: 'ingrediente' as const, label: i.nombre, sub: i.categoria ?? 'Ingrediente', path: '/escandallo' })),
        ...(epsList ?? []).map(e => ({ type: 'eps' as const, label: e.nombre, sub: 'EPS', path: '/escandallo' })),
        ...(recs ?? []).map(r => ({ type: 'receta' as const, label: r.nombre, sub: r.categoria ?? 'Receta', path: '/escandallo' })),
      ]
      setResults([...matchedPages, ...db])
      setSel(0)
      setLoading(false)
    }, 180)
    return () => { clearTimeout(timer); setLoading(false) }
  }, [query])

  const go = useCallback((r: Result) => { navigate(r.path); setOpen(false) }, [navigate])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && results[sel]) go(results[sel])
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[sel] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          backgroundColor: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}
      >
        {/* Input row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #2a2a2a', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar páginas, ingredientes, recetas…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#ffffff', fontFamily: 'Lexend, sans-serif', fontSize: 15,
            }}
          />
          {loading && (
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="#777" strokeWidth="2" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
          <kbd style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#555', background: '#222', border: '1px solid #333', borderRadius: 4, padding: '2px 6px' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 360, overflowY: 'auto' }}>
          {results.length === 0 && !loading && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#555', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
              Sin resultados para "{query}"
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.type}-${r.label}-${i}`}
              onClick={() => go(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px', cursor: 'pointer',
                backgroundColor: i === sel ? '#222222' : 'transparent',
                borderLeft: i === sel ? '2px solid #e8f442' : '2px solid transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setSel(i)}
            >
              <span style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.5px', color: TYPE_COLOR[r.type],
                background: TYPE_COLOR[r.type] + '20',
                padding: '2px 5px', borderRadius: 3, minWidth: 28, textAlign: 'center',
              }}>
                {TYPE_LABEL[r.type]}
              </span>
              <span style={{ flex: 1, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#ffffff' }}>{r.label}</span>
              {r.sub && (
                <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#555' }}>{r.sub}</span>
              )}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #222', display: 'flex', gap: 16 }}>
          {[['↑↓', 'navegar'], ['↵', 'abrir'], ['ESC', 'cerrar']].map(([key, label]) => (
            <span key={key} style={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, color: '#444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{ background: '#222', border: '1px solid #333', borderRadius: 3, padding: '1px 4px', color: '#666' }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
