import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Ingrediente } from './types'
import { fmt, fmtPct, n, getProveedor } from './types'
import { fmtNum } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { useConfig } from '@/hooks/useConfig'
import { INK, CREMA, CLARO, OSW, LEX, AMA, VERDE, ROJO, NAR, AZUL, GRANATE, GRIS, SHADOW } from '@/styles/neobrutal'

interface Props {
  ingredientes: Ingrediente[]
  busqueda?: string
  onSelect?: (i: Ingrediente) => void
  onNew?: () => void
}

type Filter = 'todos' | 'enuso' | 'sinuso'

// ── Alias a tokens neobrutal (src/styles/neobrutal.ts) ──
const PG = {
  bg: CREMA, group: INK, card: '#ffffff', brd: INK,
  pri: INK, sec: '#5a4f3a', mut: GRIS,
  red: GRANATE, ok: VERDE, warn: NAR, err: ROJO,
  head: INK, headTx: CREMA, blue: AZUL,
}

const colorUsos = (usos: number) => (usos === 0 ? PG.err : usos <= 4 ? PG.warn : PG.ok)
const esUltimo = (sel?: string | null) => !/media/i.test(sel ?? 'Último')
const labelSelector = (sel?: string | null) => (esUltimo(sel) ? 'Último' : 'Media')

const CAMPOS_NUMERICOS = ['precio1', 'precio2', 'precio3', 'uds', 'merma_pct']

const scrollBtn: CSSProperties = {
  fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '0.5px',
  background: '#fff', color: INK, border: `2px solid ${INK}`, boxShadow: `2px 2px 0 ${INK}`, borderRadius: 0,
  padding: '7px 13px', cursor: 'pointer', minHeight: 36, minWidth: 42,
}

const ZEBRA_A = CREMA
const ZEBRA_B = CLARO

const thBase: CSSProperties = {
  fontFamily: OSW, fontSize: 12, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase',
  color: CREMA, background: INK, padding: '11px 12px', textAlign: 'left', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, zIndex: 20, borderRight: `1px solid #4a3f2c`,
}
const thR: CSSProperties = { ...thBase, textAlign: 'right' }
const thC: CSSProperties = { ...thBase, textAlign: 'center' }

const tdBase: CSSProperties = {
  fontFamily: LEX, fontSize: 13, color: PG.pri, padding: '9px 12px',
  borderBottom: `2px solid ${INK}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const tdNum: CSSProperties = { ...tdBase, fontFamily: OSW, fontWeight: 600, textAlign: 'right' }
const tdUd: CSSProperties = { ...tdBase, fontFamily: LEX, fontSize: 12, color: PG.mut }

const editInputStyle: CSSProperties = {
  background: '#fff', border: `2px solid ${AZUL}`, borderRadius: 0, color: INK,
  width: '100%', outline: 'none', fontFamily: LEX, fontSize: 13, padding: '3px 6px',
}
const editSelectStyle: CSSProperties = { ...editInputStyle, padding: '3px 4px' }

export default function TabIngredientes({ ingredientes, busqueda = '', onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [localIngs, setLocalIngs] = useState<Ingrediente[]>(ingredientes)
  const [usosMap, setUsosMap] = useState<Record<string, number>>({})
  const [editingCell, setEditingCell] = useState<{ id: string; campo: string } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const desplazar = (dx: number) => scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' })
  const irExtremo = (fin: boolean) => { const el = scrollRef.current; if (el) el.scrollTo({ left: fin ? el.scrollWidth : 0, behavior: 'smooth' }) }
  const cfg = useConfig()

  useEffect(() => { setLocalIngs(ingredientes) }, [ingredientes])

  const recalcularUsos = async () => {
    const [{ data: epsL }, { data: recL }] = await Promise.all([
      supabase.from('eps_lineas').select('ingrediente_id'),
      supabase.from('recetas_lineas').select('ingrediente_id'),
    ])
    const conteo: Record<string, number> = {}
    ;[...(epsL ?? []), ...(recL ?? [])].forEach((u: { ingrediente_id: string | null }) => {
      if (!u.ingrediente_id) return
      const id = String(u.ingrediente_id)
      conteo[id] = (conteo[id] ?? 0) + 1
    })
    setUsosMap(conteo)
  }

  useEffect(() => { recalcularUsos() }, [ingredientes])

  const categoriasUnicas = useMemo(() => {
    const s = new Set<string>()
    localIngs.forEach(i => { if (i.categoria) s.add(i.categoria) })
    cfg.categorias.forEach(c => s.add(c))
    return Array.from(s).filter(Boolean).sort()
  }, [localIngs, cfg.categorias])

  const abvUnicos = useMemo(() => {
    const s = new Set<string>()
    localIngs.forEach(i => { if (i.abv) s.add(i.abv) })
    cfg.proveedores.forEach(p => s.add(p.abv))
    return Array.from(s).filter(Boolean).sort()
  }, [localIngs, cfg.proveedores])

  const formatosUnicos = useMemo(() => {
    const s = new Set<string>()
    localIngs.forEach(i => { if (i.formato) s.add(i.formato) })
    cfg.formatos.forEach(f => s.add(f))
    return Array.from(s).filter(Boolean).sort()
  }, [localIngs, cfg.formatos])

  const udStdOptions = cfg.unidades_std?.length ? cfg.unidades_std : ['Kg.', 'L.', 'Ud.']
  const udMinOptions = cfg.unidades_min?.length ? cfg.unidades_min : ['gr.', 'ml.', 'ud.']

  const { total, enUso, sinUso, filtered } = useMemo(() => {
    const base = localIngs.filter(i =>
      i.abv !== 'EPS' && i.abv !== 'MRM' && (i as { tipo_merma?: string }).tipo_merma !== 'EPS'
    )
    const getUsos = (ing: Ingrediente) => usosMap[String(ing.id)] ?? n(ing.usos)
    const totalCount = base.length
    const enUsoCount = base.filter(i => getUsos(i) > 0).length
    let filteredList = base
    if (filter === 'enuso') filteredList = base.filter(i => getUsos(i) > 0)
    else if (filter === 'sinuso') filteredList = base.filter(i => getUsos(i) === 0)
    const q = busqueda.trim().toLowerCase()
    if (q) {
      filteredList = filteredList.filter(i =>
        (i.nombre ?? '').toLowerCase().includes(q) ||
        (i.nombre_base ?? '').toLowerCase().includes(q) ||
        (i.categoria ?? '').toLowerCase().includes(q) ||
        (i.abv ?? '').toLowerCase().includes(q) ||
        (i.marca ?? '').toLowerCase().includes(q) ||
        (i.formato ?? '').toLowerCase().includes(q)
      )
    }
    return { total: totalCount, enUso: enUsoCount, sinUso: totalCount - enUsoCount, filtered: filteredList }
  }, [localIngs, usosMap, filter, busqueda])

  const toggle = (f: Filter) => setFilter(prev => prev === f ? 'todos' : f)

  const startEdit = (e: React.MouseEvent, id: string, campo: string, valor: unknown) => {
    e.stopPropagation()
    setEditingCell({ id, campo })
    setEditingValue(valor == null ? '' : String(valor))
  }

  const saveEdit = async (id: string, campo: string, rawValor: string) => {
    const valor: string = rawValor
    const isNum = CAMPOS_NUMERICOS.includes(campo)
    const parsed: string | number | null = isNum
      ? (valor === '' ? null : (parseFloat(valor) || 0))
      : (valor === '' ? null : valor)
    const update: Record<string, string | number | null> = { [campo]: parsed }
    await supabase.from('ingredientes').update(update).eq('id', id)
    setLocalIngs(prev => prev.map(ing => ing.id === id ? { ...ing, ...update } as Ingrediente : ing))
    setEditingCell(null)
    recalcularUsos()
  }

  const cancelEdit = () => setEditingCell(null)
  const isEditing = (i: Ingrediente, campo: string) => editingCell?.id === i.id && editingCell.campo === campo

  const renderInput = (id: string, campo: string, extraStyle?: CSSProperties) => (
    <input
      autoFocus
      type={CAMPOS_NUMERICOS.includes(campo) ? 'number' : 'text'}
      step={CAMPOS_NUMERICOS.includes(campo) ? 'any' : undefined}
      value={editingValue}
      onChange={e => setEditingValue(e.target.value)}
      onBlur={() => saveEdit(id, campo, editingValue)}
      onKeyDown={e => {
        if (e.key === 'Enter') saveEdit(id, campo, editingValue)
        if (e.key === 'Escape') cancelEdit()
      }}
      onClick={e => e.stopPropagation()}
      style={{ ...editInputStyle, ...extraStyle }}
    />
  )

  const renderSelect = (id: string, campo: string, opciones: string[]) => (
    <select
      autoFocus
      value={editingValue}
      onChange={e => { setEditingValue(e.target.value); saveEdit(id, campo, e.target.value) }}
      onBlur={() => cancelEdit()}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
      style={editSelectStyle}
    >
      <option value=""></option>
      {opciones.map(op => <option key={op} value={op}>{op}</option>)}
    </select>
  )

  const stickyCol = (left: number, bg: string, base: CSSProperties): CSSProperties => ({
    ...base, position: 'sticky', left, zIndex: 5, background: bg, borderRight: `2px solid ${INK}`,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Cabecera neobrutal AMA: título + pastillas-filtro + Nuevo */}
      <div style={{ background: AMA, border: `4px solid ${INK}`, boxShadow: SHADOW, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 20, lineHeight: 1, letterSpacing: '2px', textTransform: 'uppercase', color: PG.pri }}>Ingredientes</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill label="Total" value={total} color={PG.sec} active={filter === 'todos'} onClick={() => setFilter('todos')} />
            <Pill label="En uso" value={enUso} color={PG.ok} active={filter === 'enuso'} onClick={() => toggle('enuso')} />
            <Pill label="Sin uso" value={sinUso} color={PG.err} active={filter === 'sinuso'} onClick={() => toggle('sinuso')} />
          </div>
        </div>
        {onNew && (
          <button onClick={onNew} style={{ fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', background: VERDE, color: '#fff', border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, borderRadius: 0, padding: '10px 18px', cursor: 'pointer' }}>+ Nuevo</button>
        )}
      </div>

      {/* Controles de desplazamiento lateral */}
      {!!filtered.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: PG.mut }}>Desplazar columnas</span>
          <button type="button" onClick={() => irExtremo(false)} style={scrollBtn}>⏮ Inicio</button>
          <button type="button" onClick={() => desplazar(-560)} style={scrollBtn}>◀</button>
          <button type="button" onClick={() => desplazar(560)} style={scrollBtn}>▶</button>
          <button type="button" onClick={() => irExtremo(true)} style={scrollBtn}>Fin ⏭</button>
        </div>
      )}

      {!filtered.length ? (
        <div style={{ background: CREMA, border: `4px solid ${INK}`, boxShadow: SHADOW, padding: 40, textAlign: 'center' }}>
          <p style={{ color: PG.mut, fontFamily: LEX, fontSize: 13, margin: 0 }}>Sin ingredientes{filter !== 'todos' ? ' en este filtro' : ''}</p>
        </div>
      ) : (
        <div style={{ background: CREMA, border: `5px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}`, overflow: 'hidden' }}>
          <div ref={scrollRef} className="ing-scroll" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)', width: '100%' }}>
            <table style={{ tableLayout: 'fixed', width: '2660px', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: 90 }} /><col style={{ width: 150 }} /><col style={{ width: 190 }} /><col style={{ width: 55 }} />
                <col style={{ width: 210 }} /><col style={{ width: 110 }} /><col style={{ width: 110 }} /><col style={{ width: 90 }} />
                <col style={{ width: 55 }} /><col style={{ width: 65 }} /><col style={{ width: 65 }} /><col style={{ width: 55 }} />
                <col style={{ width: 85 }} /><col style={{ width: 85 }} /><col style={{ width: 85 }} /><col style={{ width: 95 }} />
                <col style={{ width: 75 }} /><col style={{ width: 85 }} /><col style={{ width: 85 }} /><col style={{ width: 65 }} />
                <col style={{ width: 85 }} /><col style={{ width: 65 }} /><col style={{ width: 85 }} /><col style={{ width: 75 }} />
                <col style={{ width: 75 }} /><col style={{ width: 95 }} /><col style={{ width: 75 }} /><col style={{ width: 95 }} /><col style={{ width: 75 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={stickyCol(0, PG.head, { ...thBase, zIndex: 30 })}>IDING</th>
                  <th style={thBase}>CATEGORÍA</th>
                  <th style={stickyCol(90, PG.head, { ...thBase, zIndex: 30 })}>NOMBRE BASE</th>
                  <th style={thBase}>ABV</th>
                  <th style={thBase}>NOMBRE</th>
                  <th style={thBase}>PROVEEDOR</th>
                  <th style={thBase}>MARCA</th>
                  <th style={thBase}>FORMATO</th>
                  <th style={thR}>UDS</th>
                  <th style={thBase}>UD STD</th>
                  <th style={thBase}>UD MIN</th>
                  <th style={thC}>USOS</th>
                  <th style={thR}>PRECIO 1</th>
                  <th style={thR}>PRECIO 2</th>
                  <th style={thR}>PRECIO 3</th>
                  <th style={thR}>ÚLTIMO</th>
                  <th style={thC}>SELECTOR</th>
                  <th style={thR}>ACTIVO</th>
                  <th style={thR}>EUR/STD</th>
                  <th style={thBase}>UD/STD</th>
                  <th style={thR}>EUR/MIN</th>
                  <th style={thBase}>UD/MIN</th>
                  <th style={thBase}>TIPO MERMA</th>
                  <th style={thR}>MERMA %</th>
                  <th style={thR}>MERMA EF.</th>
                  <th style={thR}>C.NETO/STD</th>
                  <th style={thBase}>UD/NETO STD</th>
                  <th style={thR}>C.NETO/MIN</th>
                  <th style={thBase}>UD/NETO MIN</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i, idx) => {
                  const usos = usosMap[String(i.id)] ?? n(i.usos)
                  const mermaManual = i.tipo_merma === 'Manual'
                  const zebra = idx % 2 ? ZEBRA_B : ZEBRA_A
                  // ---- Fórmulas en vivo (idénticas al modal/auditoría) ----
                  const p1 = n(i.precio1), p2 = n(i.precio2), p3 = n(i.precio3)
                  const ultimoAuto = p3 || p2 || p1
                  const preciosArr = [p1, p2, p3].filter(p => p > 0)
                  const media = preciosArr.length ? preciosArr.reduce((a, b) => a + b, 0) / preciosArr.length : 0
                  const precioActivo = esUltimo(i.selector_precio) ? ultimoAuto : media
                  const udsN = n(i.uds)
                  const mermaN = n(i.merma_pct)
                  const eurStd = udsN > 0 ? precioActivo / udsN : 0
                  const ud = (i.ud_std ?? '').toLowerCase()
                  const factor = ud.startsWith('kg') || ud.startsWith('l') ? 1000 : (i.ud_std === 'Docena' ? 12 : 1)
                  const eurMin = eurStd / factor
                  const costeNetoStd = mermaN > 0 && mermaN < 100 ? eurStd / (1 - mermaN / 100) : eurStd
                  const costeNetoMin = costeNetoStd / factor
                  return (
                    <tr key={i.id} className="ing-row">
                      <td onClick={() => onSelect?.(i)} style={{ ...stickyCol(0, zebra, tdBase), color: PG.red, fontFamily: OSW, fontWeight: 600, fontSize: 12, cursor: 'pointer', zIndex: 4 }}>
                        {i.iding ?? '—'}
                      </td>
                      <td onClick={e => startEdit(e, i.id, 'categoria', i.categoria)} style={{ ...tdBase, background: zebra, color: PG.sec, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'categoria') ? renderSelect(i.id, 'categoria', categoriasUnicas) : (i.categoria ?? '—')}
                      </td>
                      <td onClick={e => startEdit(e, i.id, 'nombre_base', i.nombre_base)} style={{ ...stickyCol(90, zebra, tdBase), fontWeight: 600, cursor: 'text', zIndex: 4 }}>
                        {isEditing(i, 'nombre_base') ? renderInput(i.id, 'nombre_base') : (i.nombre_base ?? '—')}
                      </td>
                      <td onClick={e => startEdit(e, i.id, 'abv', i.abv)} style={{ ...tdBase, background: zebra, fontFamily: OSW, fontWeight: 600, color: PG.blue, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'abv') ? renderSelect(i.id, 'abv', abvUnicos) : (i.abv ?? '—')}
                      </td>
                      <td style={{ ...tdBase, background: zebra }}>{i.nombre}</td>
                      <td style={{ ...tdBase, background: zebra, color: PG.sec }}>{getProveedor(i.abv) || '—'}</td>
                      <td onClick={e => startEdit(e, i.id, 'marca', i.marca)} style={{ ...tdBase, background: zebra, color: PG.sec, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'marca') ? renderInput(i.id, 'marca') : (i.marca ?? '—')}
                      </td>
                      <td onClick={e => startEdit(e, i.id, 'formato', i.formato)} style={{ ...tdBase, background: zebra, color: PG.sec, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'formato') ? renderSelect(i.id, 'formato', formatosUnicos) : (i.formato ?? '—')}
                      </td>
                      <td onClick={e => startEdit(e, i.id, 'uds', i.uds)} style={{ ...tdNum, background: zebra, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'uds') ? renderInput(i.id, 'uds') : fmt(i.uds)}
                      </td>
                      <td onClick={e => startEdit(e, i.id, 'ud_std', i.ud_std)} style={{ ...tdUd, background: zebra, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'ud_std') ? renderSelect(i.id, 'ud_std', udStdOptions) : (i.ud_std ?? '—')}
                      </td>
                      <td onClick={e => startEdit(e, i.id, 'ud_min', i.ud_min)} style={{ ...tdUd, background: zebra, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'ud_min') ? renderSelect(i.id, 'ud_min', udMinOptions) : (i.ud_min ?? '—')}
                      </td>
                      <td style={{ ...tdBase, background: zebra, textAlign: 'center', fontFamily: OSW, fontWeight: 600, fontSize: 15, color: colorUsos(usos) }}>{usos}</td>
                      <td onClick={e => startEdit(e, i.id, 'precio1', i.precio1)} style={{ ...tdNum, background: zebra, color: PG.mut, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'precio1') ? renderInput(i.id, 'precio1') : (p1 ? fmt(p1) : '—')}
                      </td>
                      <td onClick={e => startEdit(e, i.id, 'precio2', i.precio2)} style={{ ...tdNum, background: zebra, color: PG.mut, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'precio2') ? renderInput(i.id, 'precio2') : (p2 ? fmt(p2) : '—')}
                      </td>
                      <td onClick={e => startEdit(e, i.id, 'precio3', i.precio3)} style={{ ...tdNum, background: zebra, color: PG.mut, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'precio3') ? renderInput(i.id, 'precio3') : (p3 ? fmt(p3) : '—')}
                      </td>
                      <td style={{ ...tdNum, background: zebra }}>{ultimoAuto ? fmt(ultimoAuto) : '—'}</td>
                      <td onClick={e => startEdit(e, i.id, 'selector_precio', labelSelector(i.selector_precio))} style={{ ...tdBase, background: zebra, textAlign: 'center', cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'selector_precio') ? renderSelect(i.id, 'selector_precio', ['Último', 'Media'])
                          : <span style={{ fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '0.5px', background: CLARO, border: `2px solid ${INK}`, borderRadius: 0, padding: '2px 8px', color: INK }}>{labelSelector(i.selector_precio)}</span>}
                      </td>
                      <td style={{ ...tdNum, background: zebra, fontSize: 14, color: PG.red }}>{precioActivo ? fmt(precioActivo) : '—'}</td>
                      <td style={{ ...tdNum, background: zebra }}>{eurStd ? fmtNum(eurStd) : '—'}</td>
                      <td style={{ ...tdUd, background: zebra }}>{i.ud_std ?? '—'}</td>
                      <td style={{ ...tdNum, background: zebra }}>{eurMin ? fmtNum(eurMin) : '—'}</td>
                      <td style={{ ...tdUd, background: zebra }}>{i.ud_min ?? '—'}</td>
                      <td onClick={e => startEdit(e, i.id, 'tipo_merma', i.tipo_merma)} style={{ ...tdBase, background: zebra, fontSize: 12, color: PG.sec, cursor: 'text', textDecoration: 'underline dotted', textDecorationColor: AZUL, textUnderlineOffset: '3px' }}>
                        {isEditing(i, 'tipo_merma') ? renderSelect(i.id, 'tipo_merma', ['Manual', 'Tecnica']) : (i.tipo_merma ?? '—')}
                      </td>
                      <td onClick={mermaManual ? e => startEdit(e, i.id, 'merma_pct', i.merma_pct) : undefined} style={{ ...tdNum, background: zebra, cursor: mermaManual ? 'text' : 'default', textDecoration: mermaManual ? 'underline dotted' : 'none', textDecorationColor: AZUL, textUnderlineOffset: '3px', color: i.tipo_merma === 'Tecnica' ? PG.mut : PG.pri }}>
                        {isEditing(i, 'merma_pct') ? renderInput(i.id, 'merma_pct') : (i.merma_pct != null ? fmtPct(i.merma_pct) : '—')}
                      </td>
                      <td style={{ ...tdNum, background: zebra, color: PG.warn }}>{i.merma_ef != null ? fmtNum(i.merma_ef) : '—'}</td>
                      <td style={{ ...tdNum, background: zebra }}>{costeNetoStd ? fmtNum(costeNetoStd) : '—'}</td>
                      <td style={{ ...tdUd, background: zebra }}>{i.ud_neto_std ?? i.ud_std ?? '—'}</td>
                      <td style={{ ...tdNum, background: zebra }}>{costeNetoMin ? fmtNum(costeNetoMin) : '—'}</td>
                      <td style={{ ...tdUd, background: zebra }}>{i.ud_neto_min ?? i.ud_min ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Pill({ label, value, color, active, onClick }: { label: string; value: number; color: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} type="button" style={{
      cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 7,
      background: active ? color : '#fff', border: `2px solid ${INK}`, borderRadius: 0,
      boxShadow: active ? `3px 3px 0 ${INK}` : 'none', padding: '6px 12px', transition: 'all 120ms',
    }}>
      <span style={{ fontFamily: OSW, fontSize: 10.5, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: active ? '#fff' : INK }}>{label}</span>
      <span style={{ fontFamily: OSW, fontSize: 19, fontWeight: 700, lineHeight: 1, color: active ? '#fff' : color }}>{value}</span>
    </button>
  )
}
