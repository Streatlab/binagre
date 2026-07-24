/**
 * CostePlato — A2 + A4 · Enlaza cada plato que vendes con su receta costeada,
 * y limpia los platos duplicados.
 *
 * A2 · Sin receta enlazada no hay coste, y sin coste no hay margen. El problema
 * de fondo no es enlazar: es que faltan recetas. Por eso la lista va ordenada
 * por EUROS con el % acumulado, para convertir "escandalla 435 platos" en
 * "escandalla estos 28 y ya cubres la mitad".
 *
 * A4 · El mismo plato escrito distinto contaba como dos, se comía dos veces la
 * misma receta y partía las ventas. Los idénticos ya se han fusionado solos; los
 * dudosos se deciden aquí abajo.
 *
 * Estilo: Neobrutal (@/styles/neobrutal).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { vincularPlato, desvincularPlato } from '@/lib/cocina/vincularCliente'
import {
  OSW, LEX, INK, CREMA, CLARO, GRIS, GRANATE, VERDE, AMA, AZUL, BLANCO,
  VERDE_S, AMA_S, ROSA_S, AZUL_S,
  SHADOW, BORDER, d, cardHead, pill,
} from '@/styles/neobrutal'
import { agruparColaPendientes, formatoCierreAlta, type GrupoColaPendiente } from '@/utils/colaRecetasPendientes'
import ModalReceta from '@/components/escandallo/ModalReceta'
import type { Ingrediente, EPS } from '@/components/escandallo/types'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { HeroCantera, Plancha, PlanchaCelda, Papel, FrasePotente, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import type { jsPDF } from 'jspdf'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

interface Fila {
  id: number
  plato_norm: string
  plato_muestra: string | null
  receta_id: string | null
  maestro_id: number | null
  origen: string
  confianza: number | null
  euros: number
  unidades: number
  tipo_linea?: string
  plato_maestro_id: number | null
}
interface Receta { id: string; nombre: string; coste_rac: number | null }
interface Dup {
  id: number
  plato_a: string
  plato_b: string
  euros_a: number
  euros_b: number
  parecido: number
  decision: string
}

type Filtro = 'sin_receta' | 'sugerido' | 'listo'

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: 'sin_receta', label: 'Sin receta' },
  { id: 'sugerido', label: 'Sugeridas por confirmar' },
  { id: 'listo', label: 'Ya enlazados' },
]

const nf0 = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: true })
const eur0 = (n: number) => `${nf0(n)} €`
const eur2 = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const pct1 = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

function Vacio({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>{children}</div>
}

function Nota({ tono = 'verde', children }: { tono?: 'verde' | 'rojo' | 'ambar' | 'blu'; children: React.ReactNode }) {
  const map = { verde: VERDE_S, rojo: ROSA_S, ambar: AMA_S, blu: AZUL_S } as const
  const borde = { verde: VERDE, rojo: GRANATE, ambar: AMA, blu: AZUL } as const
  return (
    <div style={{ marginTop: 14, padding: '11px 14px', background: map[tono], border: `2px solid ${borde[tono]}`, fontFamily: LEX, fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

function InBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 8, background: CLARO, border: `2px solid ${INK}`, marginTop: 4, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.max(1, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

/* ═══ PDF — MARCO ÚNICO (src/lib/marcoDoc.ts) — VERTICAL ═══
 * DECISIÓN AUTÓNOMA: esta pantalla no maneja PVP ni margen (eso vive en
 * Menú Engineering); su dato de coste real es `recetas.coste_rac` (€/ración)
 * de la receta enlazada. El PDF reproduce la tabla "Platos ordenados por lo
 * que facturan" tal cual la muestra la pantalla (mismo filtro activo). */
type FilaConAcumulado = Fila & { acumulado: number }

const AREA_CP: M.Area = 'cocina'

function crearPDF(
  lista: FilaConAcumulado[],
  filtroLabel: string,
  nombrePorId: Map<string, string>,
  costePorRecetaId: Map<string, number | null>,
  rec: M.Recursos,
  bn = false,
): jsPDF | null {
  if (!lista.length) return null

  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA_CP, bn)
  const cb = M.contentBox(doc)
  const meta = `${filtroLabel} · ${lista.length} platos`

  const cols: { label: string; w: number; align: 'left' | 'right' }[] = [
    { label: '#', w: 0.05, align: 'left' },
    { label: 'Plato', w: 0.34, align: 'left' },
    { label: 'Receta enlazada', w: 0.29, align: 'left' },
    { label: 'Factura', w: 0.14, align: 'right' },
    { label: 'Uds', w: 0.08, align: 'right' },
    { label: 'Cubierto', w: 0.10, align: 'right' },
  ]
  const colX: number[] = []
  { let acc = cb.x0; cols.forEach(c => { colX.push(acc); acc += cb.w * c.w }) }

  const nuevaPagina = () => {
    M.pintarEspina(doc, AREA_CP, ctx, bn)
    return M.pintarCabecera(doc, ctx, { docNombre: 'Coste por plato', meta, area: AREA_CP, bn })
  }
  const pintarCabeceraTabla = (yy: number) => {
    doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, yy, cb.w, 5.6, 'F')
    M.fTitulo(doc, ctx, true); doc.setFontSize(7.6); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    cols.forEach((c, i) => doc.text(c.label, c.align === 'right' ? colX[i] + cb.w * c.w - 2 : colX[i] + 2, yy + 3.9, { align: c.align }))
    return yy + 5.6
  }

  let y = nuevaPagina()
  y = pintarCabeceraTabla(y)

  lista.forEach((f, i) => {
    if (y > cb.bottom - 5) { doc.addPage(); y = nuevaPagina(); y = pintarCabeceraTabla(y) }
    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(cb.x0, y + 4.6, cb.x1, y + 4.6)

    const nombreMadre = f.receta_id ? nombrePorId.get(f.receta_id) : null
    const nombrePlato = f.plato_muestra ?? f.plato_norm
    const coste = f.receta_id ? costePorRecetaId.get(f.receta_id) : null

    M.fDato(doc, ctx, false); doc.setFontSize(7.5); doc.setTextColor(...M.GRIS)
    doc.text(String(i + 1), colX[0] + 2, y + 3.6)

    doc.setFontSize(8.5); doc.setTextColor(...M.TINTA)
    doc.text(nombreMadre ?? nombrePlato, colX[1] + 2, y + 3.6, { maxWidth: cb.w * cols[1].w - 4 })

    doc.setFontSize(8); doc.setTextColor(...M.GRIS)
    if (nombreMadre) {
      doc.text(coste != null ? `${nombrePlato} · ${eur2(coste)}/rac.` : `${nombrePlato} · sin coste`, colX[2] + 2, y + 3.6, { maxWidth: cb.w * cols[2].w - 4 })
    } else {
      doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
      doc.text('Falta la receta', colX[2] + 2, y + 3.6)
    }

    doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(eur0(Number(f.euros) || 0), colX[3] + cb.w * cols[3].w - 2, y + 3.6, { align: 'right' })
    doc.setTextColor(...M.TINTA)
    doc.text(String(Math.round(Number(f.unidades) || 0)), colX[4] + cb.w * cols[4].w - 2, y + 3.6, { align: 'right' })
    doc.setTextColor(...M.GRIS)
    doc.text(`${f.acumulado.toFixed(1)}%`, colX[5] + cb.w * cols[5].w - 2, y + 3.6, { align: 'right' })

    y += 4.8
  })

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

export default function CostePlato() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [dups, setDups] = useState<Dup[]>([])
  const [maestros, setMaestros] = useState<Map<number, string>>(new Map())
  const [filtro, setFiltro] = useState<Filtro>('sin_receta')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: dic }, { data: rec }, { data: dup }, { data: maes }] = await Promise.all([
      // 4d: solo tipo_linea='plato' entra aquí — ruido/bebida/extra quedan fuera de la cola
      // de escandallo (no se borran, ver migración mapeo_plato_receta_tipo_linea_bebida_extra).
      supabase.from('v_mapeo_resuelto')
        .select('id, plato_norm, plato_muestra, receta_id:receta_efectiva, maestro_id, origen:origen_manual, confianza:confianza_manual, euros, unidades, tipo_linea')
        .eq('tipo_linea', 'plato')
        .order('euros', { ascending: false }),
      supabase.from('recetas').select('id, nombre, coste_rac').order('nombre'),
      supabase.from('platos_duplicados').select('*').eq('decision', 'pendiente').order('euros_a', { ascending: false }),
      supabase.from('platos_maestros').select('id, nombre'),
    ])
    setFilas((dic ?? []) as Fila[])
    setRecetas((rec ?? []) as Receta[])
    setDups((dup ?? []) as Dup[])
    setMaestros(new Map((maes ?? []).map((m: { id: number; nombre: string }) => [m.id, m.nombre])))
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // LEY-PLATO-01: el vínculo se hace sobre el plato maestro (único vinculador) y se
  // refleja a la vez en análisis, Carta, Pareto y aquí. Fallback al mapeo si aún no
  // hay identidad (no debería tras la migración).
  const enlazar = useCallback(async (fila: Fila, recetaId: string) => {
    setGuardando(fila.plato_norm)
    if (fila.plato_maestro_id != null) {
      if (recetaId) await vincularPlato(fila.plato_maestro_id, recetaId)
      else await desvincularPlato(fila.plato_maestro_id)
    } else {
      await supabase.from('mapeo_plato_receta').update({
        receta_id: recetaId || null,
        origen: recetaId ? 'manual' : 'pendiente',
        confianza: recetaId ? 1 : null,
        updated_at: new Date().toISOString(),
      }).eq('id', fila.id)
    }
    setGuardando(null)
    await cargar()
  }, [cargar])

  const confirmarSugerencias = useCallback(async () => {
    setGuardando('todas')
    await supabase.from('mapeo_plato_receta')
      .update({ origen: 'manual', confianza: 1, updated_at: new Date().toISOString() })
      .eq('origen', 'sugerido').not('receta_id', 'is', null)
    setGuardando(null)
    setAviso('Sugerencias confirmadas. Esos platos ya tienen coste.')
    await cargar()
  }, [cargar])

  /* ── A4 · fusionar o separar duplicados ── */
  const fusionar = useCallback(async (d: Dup, canonico: string, duplicado: string) => {
    setGuardando(`dup-${d.id}`)
    await supabase.rpc('unificar_plato', { canonico, duplicado })
    await supabase.from('platos_duplicados')
      .update({ decision: 'mismo', canonico, updated_at: new Date().toISOString() })
      .eq('id', d.id)
    setGuardando(null)
    setAviso(`Unificados. Todo el histórico pasa a llamarse "${canonico}".`)
    await cargar()
  }, [cargar])

  const separar = useCallback(async (d: Dup) => {
    setGuardando(`dup-${d.id}`)
    await supabase.from('platos_duplicados')
      .update({ decision: 'distinto', updated_at: new Date().toISOString() })
      .eq('id', d.id)
    setGuardando(null)
    await cargar()
  }, [cargar])

  /* ── 4a/4b/4c · Cola priorizada por euros + alta por dictado de voz ──
   * Un alta cubre TODOS los alias del mismo plato maestro de golpe (4b): al guardar la
   * receta, si el grupo tiene maestro_id se enlaza platos_maestros.receta_id (resuelve la
   * vista v_mapeo_resuelto para todos sus alias); si no tiene maestro (nombre suelto) se
   * enlaza directo el único mapeo_plato_receta.id del grupo — igual que hace `enlazar`. */
  const colaMaestros = useMemo(() => agruparColaPendientes(filas, maestros), [filas, maestros])

  const [ingredientesEsc, setIngredientesEsc] = useState<Ingrediente[]>([])
  const [epsListEsc, setEpsListEsc] = useState<EPS[]>([])
  const [datosEscCargados, setDatosEscCargados] = useState(false)
  const cargarDatosEscandallo = useCallback(async () => {
    if (datosEscCargados) return
    const [{ data: ing }, { data: eps }] = await Promise.all([
      supabase.from('ingredientes').select('*'),
      supabase.from('eps').select('*'),
    ])
    setIngredientesEsc((ing ?? []) as Ingrediente[])
    setEpsListEsc((eps ?? []) as EPS[])
    setDatosEscCargados(true)
  }, [datosEscCargados])

  const [colaSesion, setColaSesion] = useState<GrupoColaPendiente[] | null>(null)
  const [colaPos, setColaPos] = useState(0)
  const grupoActivo = colaSesion ? colaSesion[colaPos] : null

  const abrirAlta = useCallback(async (grupo: GrupoColaPendiente) => {
    await cargarDatosEscandallo()
    const base = colaMaestros
    const pos = base.findIndex(g => g.key === grupo.key)
    setColaSesion(base)
    setColaPos(pos >= 0 ? pos : 0)
  }, [cargarDatosEscandallo, colaMaestros])

  const cerrarAlta = useCallback(() => { setColaSesion(null); setColaPos(0) }, [])

  const resolverGrupo = useCallback(async (grupo: GrupoColaPendiente, recetaId: string) => {
    if (grupo.maestroId != null) {
      await supabase.from('platos_maestros')
        .update({ receta_id: recetaId, updated_at: new Date().toISOString() })
        .eq('id', grupo.maestroId)
    } else if (grupo.mapeoIdSolo != null) {
      await supabase.from('mapeo_plato_receta')
        .update({ receta_id: recetaId, origen: 'manual', confianza: 1, updated_at: new Date().toISOString() })
        .eq('id', grupo.mapeoIdSolo)
    }
    setAviso(`Resuelto: ${formatoCierreAlta(grupo)}.`)
    await cargar()
  }, [cargar])

  /* onSaved de ModalReceta: guarda el enlace y avanza sola a la siguiente del lote —
   * "dictar → guardar → siguiente", sin cerrar ni recargar la pantalla. */
  const alGuardarYAvanzar = useCallback(async (recetaId?: string) => {
    const grupo = grupoActivo
    if (recetaId && grupo) await resolverGrupo(grupo, recetaId)
    setColaPos(p => p + 1)
  }, [grupoActivo, resolverGrupo])

  useEffect(() => {
    if (colaSesion && colaPos >= colaSesion.length) cerrarAlta()
  }, [colaSesion, colaPos, cerrarAlta])

  /* ── Métricas ── */
  const stats = useMemo(() => {
    const s = { conReceta: 0, sugeridas: 0, sinReceta: 0, eCon: 0, eSug: 0, eSin: 0, total: 0 }
    for (const f of filas) {
      const e = Number(f.euros) || 0
      s.total += e
      if (!f.receta_id) { s.sinReceta++; s.eSin += e }
      else if (f.origen === 'sugerido') { s.sugeridas++; s.eSug += e }
      else { s.conReceta++; s.eCon += e }
    }
    return s
  }, [filas])

  const pctCubierto = stats.total > 0 ? (stats.eCon / stats.total) * 100 : 0

  const lista = useMemo(() => {
    const base = filas.filter(f => {
      if (filtro === 'sin_receta') return !f.receta_id
      if (filtro === 'sugerido') return !!f.receta_id && f.origen === 'sugerido'
      return !!f.receta_id && f.origen !== 'sugerido'
    })
    const total = base.reduce((s, f) => s + (Number(f.euros) || 0), 0) || 1
    let ac = 0
    return base.map(f => {
      ac += Number(f.euros) || 0
      return { ...f, acumulado: (ac / total) * 100 }
    })
  }, [filas, filtro])

  const maxEuros = lista.length > 0 ? Number(lista[0].euros) || 1 : 1

  /* ── Tanda 8: nombre madre (recetas.nombre) siempre que ya haya enlace; el nombre
   *  crudo de plataforma queda como detalle secundario. Sin enlace no hay madre —
   *  ahí el nombre crudo sigue siendo el dato principal (es lo que hay que identificar). ── */
  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of recetas) m.set(r.id, r.nombre)
    return m
  }, [recetas])

  const cuantasPara = useCallback((objetivo: number) => {
    const sin = filas.filter(f => !f.receta_id).sort((a, b) => Number(b.euros) - Number(a.euros))
    const totalSin = sin.reduce((s, f) => s + Number(f.euros), 0) || 1
    let ac = 0
    for (let i = 0; i < sin.length; i++) {
      ac += Number(sin[i].euros)
      if ((ac / totalSin) * 100 >= objetivo) return i + 1
    }
    return sin.length
  }, [filas])

  const para50 = useMemo(() => cuantasPara(50), [cuantasPara])
  const para80 = useMemo(() => cuantasPara(80), [cuantasPara])

  const eurosDuplicados = useMemo(
    () => dups.reduce((s, d) => s + Math.min(Number(d.euros_a), Number(d.euros_b)), 0),
    [dups])

  const costePorRecetaId = useMemo(() => new Map(recetas.map(r => [r.id, r.coste_rac])), [recetas])
  const filtroLabel = FILTROS.find(f => f.id === filtro)?.label ?? ''

  if (cargando) {
    return (
      <PantallaCantera>
        <div style={{ background: BLANCO, border: BORDER }}><Vacio>Cargando platos y recetas…</Vacio></div>
      </PantallaCantera>
    )
  }

  return (
    <>
    <PantallaCantera>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <RutaPantalla niveles={['Cocina', 'Coste por plato']} subtitulo="Enlaza lo que vendes con lo que cuesta. Sin esto no hay margen real." />
        <BotonImprimir
          compacto
          documentoId="cocina.coste_plato"
          titulo={`Coste por plato · ${filtroLabel}`}
          generarPdf={async opts => {
            const rec = await M.cargarRecursos()
            return crearPDF(lista, filtroLabel, nombrePorId, costePorRecetaId, rec, opts.bn)
          }}
        />
      </div>

      {/* HÉROE (naranja · área Cocina) */}
      <HeroCantera
        area="cocina"
        titular={pctCubierto >= 80 ? 'Ya sabes lo que te cuesta casi todo lo que vendes.' : 'No sabes lo que te cuesta casi nada de lo que vendes.'}
        etiquetaDato="Facturación con coste conocido"
        cifra={pct1(pctCubierto)}
        resumen={<>{eur0(stats.eCon)} con coste · {eur0(stats.eSin + stats.eSug)} sin coste conocido</>}
        atencion={[
          `${nf0(stats.conReceta)} platos enlazados`,
          `${nf0(stats.sinReceta)} sin receta`,
          stats.sugeridas > 0 ? `${stats.sugeridas} sugeridas por confirmar` : null,
          colaMaestros.length > 0 ? `${colaMaestros.length} altas agrupadas` : null,
        ].filter(Boolean) as string[]}
      />

      {/* PLANCHA DE KPIs: sólidos pegados */}
      <div>
        <SeccionLabel bg={GRANATE}>KPIs de cobertura</SeccionLabel>
        <Plancha>
          <PlanchaCelda bg={VERDE} color={BLANCO} first>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Con coste</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{pct1(pctCubierto)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{eur0(stats.eCon)} de facturación</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AZUL} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Sugeridas</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{nf0(stats.sugeridas)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{eur0(stats.eSug)} en juego</div>
          </PlanchaCelda>
          <PlanchaCelda bg={GRANATE} color={BLANCO}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Sin receta</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{nf0(stats.sinReceta)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>{eur0(stats.eSin)} sin coste</div>
          </PlanchaCelda>
          <PlanchaCelda bg={AMA} color={INK}>
            <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>Recetas para el 80%</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 26, lineHeight: 1.05, marginTop: 6 }}>{nf0(para80)}</div>
            <div style={{ fontFamily: LEX, fontSize: 12, marginTop: 4 }}>de {nf0(stats.sinReceta)} platos</div>
          </PlanchaCelda>
        </Plancha>
      </div>

      {/* FRASE POTENTE (color por significado, distinto del héroe naranja) */}
      <FrasePotente significado="oportunidad">
        No hace falta escandallar los {nf0(stats.sinReceta)} platos: con las {para50} primeras de la lista cubres la mitad de la facturación que hoy va a ciegas, con {para80} cubres el 80%. Empieza por arriba y para cuando quieras.
      </FrasePotente>

      {/* 4a/4b · Cola priorizada por plato maestro: un alta cierra de golpe todos sus alias */}
      {colaMaestros.length > 0 && (
        <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
          <div style={{ ...cardHead(GRANATE), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div>Altas por escribir, agrupadas</div>
              <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>
                Una receta nueva cierra de golpe todos los nombres que agrupa. Dicta por voz y sigue con la siguiente sin salir de aquí.
              </div>
            </div>
            <span style={pill(AMA_S, AMA)}>{colaMaestros.length} platos maestros sin receta</span>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: INK }}>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left', width: 30 }}>#</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>Se cierra con esta alta</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'right' }}>Uds</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>Factura</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {colaMaestros.slice(0, 30).map((g, i) => (
                    <tr key={g.key}>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 11, color: GRIS, borderBottom: `2px solid ${INK}` }}>{i + 1}</td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, maxWidth: 380 }}>
                        <div>{g.nombre}</div>
                        <div style={{ fontSize: 11, color: GRIS, fontWeight: 600, marginTop: 2 }}>{formatoCierreAlta(g)}</div>
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, textAlign: 'right' }}>{nf0(g.unidades)}</td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, minWidth: 120 }}>
                        <span>{eur0(g.euros)}</span>
                        <InBar pct={(g.euros / (colaMaestros[0]?.euros || 1)) * 100} color={GRANATE} />
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: `2px solid ${INK}`, textAlign: 'right' }}>
                        <button
                          onClick={() => abrirAlta(g)}
                          style={{ background: AMA, color: INK, border: `2px solid ${INK}`, boxShadow: '2px 2px 0 var(--neo-shadow-color)', padding: '7px 12px', fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >Escribir receta</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {colaMaestros.length > 30 && (
                <Nota tono="blu">Se muestran los 30 que más facturan de {nf0(colaMaestros.length)} platos maestros sin receta.</Nota>
              )}
            </div>
          </div>
        </Papel>
      )}

      {stats.sugeridas > 0 && (
        <Papel ceja={AZUL} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ ...d('19px', AZUL), whiteSpace: 'nowrap' }}>{eur0(stats.eSug)}</span>
          <span style={{ flex: 1, fontFamily: LEX, fontSize: 13, fontWeight: 600, color: INK, minWidth: 220 }}>
            <b>{stats.sugeridas} platos con receta sugerida.</b> El nombre se parece mucho al de una receta que ya tienes. Repásalos y confírmalos.
          </span>
          <button
            onClick={confirmarSugerencias}
            disabled={guardando === 'todas'}
            style={{ background: AZUL, color: BLANCO, border: `2px solid ${INK}`, boxShadow: '2px 2px 0 var(--neo-shadow-color)', padding: '8px 14px', fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >{guardando === 'todas' ? 'Aplicando…' : `Confirmar las ${stats.sugeridas}`}</button>
        </Papel>
      )}

      {aviso && <Nota tono="verde">{aviso}</Nota>}

      {/* ── A4 · Platos duplicados ── */}
      {dups.length > 0 && (
        <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
          <div style={{ ...cardHead(GRANATE), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div>Platos que parecen el mismo</div>
              <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>Si son el mismo, se juntan las ventas y una sola receta cubre los dos</div>
            </div>
            <span style={pill(AMA_S, AMA)}>{dups.length} por decidir · {eur0(eurosDuplicados)}</span>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: INK }}>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>Se parecen</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'right' }}>Factura</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'right' }}>Parecido</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>¿Son el mismo plato?</th>
                  </tr>
                </thead>
                <tbody>
                  {dups.slice(0, 50).map(dd => {
                    const busy = guardando === `dup-${dd.id}`
                    const ea = Number(dd.euros_a), eb = Number(dd.euros_b)
                    const canon = ea >= eb ? dd.plato_a : dd.plato_b
                    const otro = ea >= eb ? dd.plato_b : dd.plato_a
                    return (
                      <tr key={dd.id}>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, maxWidth: 380 }}>
                          <div>{dd.plato_a}</div>
                          <div style={{ color: GRIS, fontWeight: 600, fontSize: 12, marginTop: 2 }}>{dd.plato_b}</div>
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, textAlign: 'right' }}>
                          <div>{eur0(ea)}</div>
                          <div style={{ color: GRIS, fontSize: 12 }}>{eur0(eb)}</div>
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, textAlign: 'right' }}>
                          <span style={pill(Number(dd.parecido) >= 0.85 ? AMA_S : CLARO, Number(dd.parecido) >= 0.85 ? AMA : GRIS)}>
                            {Math.round(Number(dd.parecido) * 100)}%
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}` }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              disabled={busy}
                              onClick={() => fusionar(dd, canon, otro)}
                              style={{
                                padding: '6px 12px', cursor: 'pointer',
                                border: `2px solid ${INK}`, background: VERDE, color: BLANCO,
                                fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                              }}
                            >{busy ? 'Uniendo…' : 'Sí, es el mismo'}</button>
                            <button
                              disabled={busy}
                              onClick={() => separar(dd)}
                              style={{
                                padding: '6px 12px', cursor: 'pointer',
                                border: `2px solid ${INK}`, background: BLANCO, color: INK,
                                fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                              }}
                            >Son distintos</button>
                          </div>
                          <div style={{ fontSize: 11, color: GRIS, fontWeight: 600, marginTop: 4 }}>
                            Se quedaría con el nombre: {canon}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Nota tono="ambar">
              Ojo con los que solo cambian una talla o un ingrediente (por ejemplo Talla XL y Talla XXL): esos <b>no</b> son el mismo plato.
            </Nota>
          </div>
        </Papel>
      )}

      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
        <div style={{ ...cardHead(GRANATE), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div>Platos ordenados por lo que facturan</div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>La columna de la derecha dice cuánto llevas cubierto si escandallas hasta ahí</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map(f => {
              const on = f.id === filtro
              return (
                <button key={f.id} onClick={() => setFiltro(f.id)}
                  style={{
                    padding: '6px 12px', cursor: 'pointer',
                    background: on ? BLANCO : 'transparent',
                    color: on ? GRANATE : BLANCO,
                    border: `2px solid ${BLANCO}`,
                    fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                  }}>{f.label}</button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          {lista.length === 0 ? (
            <Vacio>Nada en esta lista.</Vacio>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: INK }}>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left', width: 30 }}>#</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>Plato</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'right' }}>Uds</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>Factura</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'left' }}>Receta</th>
                    <th style={{ padding: '9px 12px', fontFamily: OSW, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, textAlign: 'right' }}>Cubierto</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 120).map((f, i) => (
                    <tr key={f.id}>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 11, color: GRIS, borderBottom: `2px solid ${INK}` }}>{i + 1}</td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, maxWidth: 320 }}>
                        {f.receta_id && nombrePorId.get(f.receta_id) ? (
                          <>
                            <div>{nombrePorId.get(f.receta_id)}</div>
                            <div style={{ fontSize: 11, color: GRIS, fontWeight: 600 }}>{f.plato_muestra ?? f.plato_norm}</div>
                          </>
                        ) : (
                          f.plato_muestra ?? f.plato_norm
                        )}
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, textAlign: 'right' }}>{nf0(Number(f.unidades) || 0)}</td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, minWidth: 120 }}>
                        <span>{eur0(Number(f.euros) || 0)}</span>
                        <InBar pct={(Number(f.euros) / maxEuros) * 100} color={GRANATE} />
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}` }}>
                        <select
                          value={f.receta_id ?? ''}
                          disabled={guardando === f.plato_norm}
                          onChange={e => enlazar(f, e.target.value)}
                          style={{
                            padding: '6px 10px', minWidth: 220,
                            border: `2px solid ${f.receta_id ? INK : GRANATE}`,
                            background: BLANCO, color: f.receta_id ? INK : GRANATE,
                            fontFamily: LEX, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">— Falta la receta —</option>
                          {recetas.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.nombre}{r.coste_rac != null ? ` · ${eur2(Number(r.coste_rac))}/ración` : ' · sin coste'}
                            </option>
                          ))}
                        </select>
                        {f.origen === 'sugerido' && (
                          <div style={{ marginTop: 4 }}>
                            <span style={pill(AZUL_S, AZUL)}>Se parece · {Math.round((f.confianza ?? 0) * 100)}%</span>
                          </div>
                        )}
                        {f.origen === 'carta' && (
                          <div style={{ marginTop: 4 }}><span style={pill(VERDE_S, VERDE)}>Venía de la carta</span></div>
                        )}
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: LEX, fontSize: 13, borderBottom: `2px solid ${INK}`, textAlign: 'right', color: f.acumulado >= 80 ? GRIS : GRANATE }}>
                        {pct1(f.acumulado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lista.length > 120 && (
                <Nota tono="blu">Se muestran los 120 que más facturan de {nf0(lista.length)}.</Nota>
              )}
            </div>
          )}

          <Nota tono="ambar">
            Si un plato no tiene receta, no aparece en el desplegable. Créala primero en Cocina → Recetas y luego vuelve aquí a enlazarla.
          </Nota>
        </div>
      </Papel>
    </PantallaCantera>

    {/* 4c · Alta por dictado de voz, en lote: dictar → guardar → siguiente, sin salir de la pantalla. */}
    {colaSesion && grupoActivo && (
      <>
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: INK, color: BLANCO, border: `2px solid ${AMA}`, boxShadow: SHADOW, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: OSW, fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          <span>Alta {colaPos + 1} de {colaSesion.length}</span>
          <span style={{ color: AMA }}>{grupoActivo.nombre}</span>
          <button
            onClick={() => setColaPos(p => p + 1)}
            style={{ background: 'transparent', color: BLANCO, border: `2px solid ${BLANCO}`, padding: '4px 10px', fontFamily: OSW, fontWeight: 700, fontSize: 10, letterSpacing: '0.5px', cursor: 'pointer' }}
          >Saltar →</button>
          <button
            onClick={cerrarAlta}
            style={{ background: 'transparent', color: BLANCO, border: 'none', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}
          >×</button>
        </div>
        <ModalReceta
          key={grupoActivo.key}
          receta={null}
          initialNombre={grupoActivo.nombre}
          ingredientes={ingredientesEsc}
          epsList={epsListEsc}
          onClose={cerrarAlta}
          onSaved={alGuardarYAvanzar}
        />
      </>
    )}
    </>
  )
}
