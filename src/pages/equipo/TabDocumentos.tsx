/**
 * TabDocumentos — lista-archivo de todo lo del equipo (nóminas, RLC, RNT,
 * cuotas de autónomos, contratos), filtrable por persona/mes/tipo, con enlace
 * a Drive/Storage. Solo lectura: la subida vive únicamente en Papeleo →
 * Bandeja de entrada (botón EQUIPO). La cola "por revisar"
 * (equipo_docs_revision) se integra aquí con el modal ya existente.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/format'
import ModalRevisionEquipo from '@/components/equipo/ModalRevisionEquipo'
import { OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA, AZUL, GRIS, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'
import * as M from '@/lib/marcoDoc'
import BotonImprimir from '@/components/BotonImprimir'

const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD }

type Tipo = 'Nómina' | 'RLC' | 'RNT' | 'Cuota autónomos' | 'Contrato' | 'Otro documento'

interface DocUnificado {
  id: string
  tipo: Tipo
  persona: string | null
  mes: number | null
  anio: number | null
  fecha: string | null
  url: string | null
}

// ─── FASE 2: PDF con el marco único (área 'equipo') — botón Imprimir ────────
const AREA: M.Area = 'equipo'

/** Listado de documentos de empleado con los filtros ya aplicados en pantalla. Sin filas → null. */
function construirDocumentosPDF(filas: DocUnificado[], filtroLabel: string, rec: M.Recursos, bn = false) {
  if (filas.length === 0) return null

  const doc = M.nuevaHoja({ orientation: 'portrait' })
  const ctx = M.preparar(doc, rec)
  const pal = M.paleta(AREA, bn)
  const cb = M.contentBox(doc)

  const xTipo = cb.x0 + 1.5
  const xPersona = cb.x0 + cb.w * 0.28
  const xPeriodo = cb.x0 + cb.w * 0.60
  const xUrl = cb.x1 - 1.5

  const nuevaPagina = () => {
    M.pintarEspina(doc, AREA, ctx, bn)
    return M.pintarCabecera(doc, ctx, { docNombre: 'Documentos de Empleado', meta: filtroLabel, area: AREA, bn })
  }
  let y = nuevaPagina()

  doc.setFillColor(pal.soft2[0], pal.soft2[1], pal.soft2[2]); doc.rect(cb.x0, y, cb.w, 6, 'F')
  M.fTitulo(doc, ctx, true); doc.setFontSize(8); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
  doc.text('Tipo', xTipo, y + 4.2)
  doc.text('Persona', xPersona, y + 4.2)
  doc.text('Periodo', xPeriodo, y + 4.2)
  doc.text('Documento', xUrl, y + 4.2, { align: 'right' })
  y += 6

  for (const d of filas) {
    if (y > cb.bottom - 6) { doc.addPage(); y = nuevaPagina() }
    doc.setDrawColor(...M.LINEA); doc.setLineWidth(0.1); doc.line(cb.x0, y + 4.6, cb.x1, y + 4.6)
    M.fDato(doc, ctx, true); doc.setFontSize(9); doc.setTextColor(pal.acento[0], pal.acento[1], pal.acento[2])
    doc.text(d.tipo, xTipo, y + 3.6)
    M.fDato(doc, ctx, false); doc.setTextColor(...M.TINTA)
    doc.text(d.persona ?? '—', xPersona, y + 3.6)
    doc.setTextColor(...M.GRIS)
    const periodo = d.mes ? `${MESES_LARGO[d.mes - 1]} ${d.anio}` : d.fecha ? fmtDate(d.fecha) : (d.anio ? String(d.anio) : '—')
    doc.text(periodo, xPeriodo, y + 3.6)
    doc.text(d.url ? 'Ver online' : '—', xUrl, y + 3.6, { align: 'right' })
    y += 4.8
  }

  const totalPag = doc.getNumberOfPages()
  for (let p = 1; p <= totalPag; p++) { doc.setPage(p); M.pintarPaginado(doc, p, totalPag, ctx) }
  return doc
}

export default function TabDocumentos() {
  const [docs, setDocs] = useState<DocUnificado[]>([])
  const [loading, setLoading] = useState(true)
  const [pendientesRevision, setPendientesRevision] = useState(0)
  const [verRevision, setVerRevision] = useState(false)

  const [filtroPersona, setFiltroPersona] = useState('todas')
  const [filtroMes, setFiltroMes] = useState<number | 'todos'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<Tipo | 'todos'>('todos')

  async function cargarPendientesRevision() {
    const { count } = await supabase.from('equipo_docs_revision').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
    setPendientesRevision(count ?? 0)
  }

  async function cargar() {
    setLoading(true)
    const [nominas, rlc, rnt, cuotas, docsEmp, empleados, titulares] = await Promise.all([
      supabase.from('nominas').select('id, mes, anio, pdf_url, empleado_id, empleados(nombre)'),
      supabase.from('seguridad_social_resumen').select('id, mes, anio, pdf_url'),
      supabase.from('seguridad_social_rnt').select('id, mes, anio, drive_url'),
      supabase.from('autonomos_cuotas').select('id, mes, anio, pdf_url, titular_id'),
      supabase.from('empleado_documentos').select('id, tipo, fecha, url, empleado_id'),
      supabase.from('empleados').select('id, nombre'),
      supabase.from('titulares').select('id, nombre'),
    ])

    const nombreEmpleado = new Map<string, string>((empleados.data ?? []).map((e: { id: string; nombre: string }) => [e.id, e.nombre]))
    const nombreTitular = new Map<string, string>((titulares.data ?? []).map((t: { id: string; nombre: string }) => [t.id, t.nombre]))
    const nombreDeJoin = (v: unknown): string => {
      if (!v) return '—'
      const row = Array.isArray(v) ? v[0] : v
      return (row as { nombre?: string })?.nombre ?? '—'
    }

    const unificados: DocUnificado[] = []

    for (const n of (nominas.data ?? []) as { id: string; mes: number; anio: number; pdf_url: string | null; empleado_id: string; empleados: unknown }[]) {
      unificados.push({ id: `nomina-${n.id}`, tipo: 'Nómina', persona: nombreDeJoin(n.empleados), mes: n.mes, anio: n.anio, fecha: null, url: n.pdf_url })
    }
    for (const r of (rlc.data ?? []) as { id: string; mes: number; anio: number; pdf_url: string | null }[]) {
      unificados.push({ id: `rlc-${r.id}`, tipo: 'RLC', persona: null, mes: r.mes, anio: r.anio, fecha: null, url: r.pdf_url })
    }
    // RNT: una fila por trabajador, pero comparten el mismo PDF mensual — se
    // deduplica por (mes, anio, drive_url) para no listar el mismo documento N veces.
    const rntVistos = new Set<string>()
    for (const r of (rnt.data ?? []) as { id: string; mes: number; anio: number; drive_url: string | null }[]) {
      const clave = `${r.mes}-${r.anio}-${r.drive_url ?? ''}`
      if (rntVistos.has(clave)) continue
      rntVistos.add(clave)
      unificados.push({ id: `rnt-${r.id}`, tipo: 'RNT', persona: null, mes: r.mes, anio: r.anio, fecha: null, url: r.drive_url })
    }
    for (const c of (cuotas.data ?? []) as { id: string; mes: number; anio: number; pdf_url: string | null; titular_id: string }[]) {
      unificados.push({ id: `cuota-${c.id}`, tipo: 'Cuota autónomos', persona: nombreTitular.get(c.titular_id) ?? '—', mes: c.mes, anio: c.anio, fecha: null, url: c.pdf_url })
    }
    for (const d of (docsEmp.data ?? []) as { id: string; tipo: string; fecha: string | null; url: string | null; empleado_id: string }[]) {
      unificados.push({
        id: `doc-${d.id}`,
        tipo: d.tipo === 'Contrato' ? 'Contrato' : d.tipo === 'Nómina' ? 'Nómina' : 'Otro documento',
        persona: nombreEmpleado.get(d.empleado_id) ?? '—',
        mes: null, anio: d.fecha ? Number(d.fecha.slice(0, 4)) : null, fecha: d.fecha, url: d.url,
      })
    }

    unificados.sort((a, b) => (b.anio ?? 0) - (a.anio ?? 0) || (b.mes ?? 0) - (a.mes ?? 0))
    setDocs(unificados)
    setLoading(false)
  }

  useEffect(() => { cargar(); cargarPendientesRevision() }, [])

  const personas = useMemo(() => Array.from(new Set(docs.map(d => d.persona).filter((p): p is string => Boolean(p)))).sort(), [docs])
  const anios = useMemo(() => Array.from(new Set(docs.map(d => d.anio).filter((a): a is number => Boolean(a)))).sort((a, b) => b - a), [docs])

  const filtrados = docs.filter(d =>
    (filtroPersona === 'todas' || d.persona === filtroPersona) &&
    (filtroMes === 'todos' || d.mes === filtroMes) &&
    (filtroTipo === 'todos' || d.tipo === filtroTipo)
  )

  const tipos: Tipo[] = ['Nómina', 'RLC', 'RNT', 'Cuota autónomos', 'Contrato', 'Otro documento']

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular={`Tienes ${docs.length} documento${docs.length !== 1 ? 's' : ''} del equipo archivados`}
        etiquetaDato="Documentos con estos filtros"
        cifra={filtrados.length}
        resumen={pendientesRevision > 0
          ? <>{pendientesRevision} documento{pendientesRevision !== 1 ? 's' : ''} por revisar antes de dar por buenos.</>
          : 'Nada pendiente de revisión.'}
        atencion={[
          personas.length > 0 ? `${personas.length} personas` : null,
          pendientesRevision > 0 ? `${pendientesRevision} por revisar` : null,
        ]}
      />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filtroPersona} onChange={e => setFiltroPersona(e.target.value)} style={selectNeo}>
          <option value="todas">Todas las personas</option>
          {personas.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value))} style={selectNeo}>
          <option value="todos">Todos los meses</option>
          {MESES_LARGO.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as Tipo | 'todos')} style={selectNeo}>
          <option value="todos">Todos los tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <Link
          to="/finanzas/papeleo?tab=bandeja"
          style={{ fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: GRANATE, textDecoration: 'none' }}
        >
          Subir documentos → Papeleo · Bandeja de entrada
        </Link>

        {pendientesRevision > 0 && (
          <button
            onClick={() => setVerRevision(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: `3px solid ${INK}`, boxShadow: SHADOW, background: AMA, color: INK,
              fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase',
              padding: '8px 14px', cursor: 'pointer', marginLeft: pendientesRevision > 0 ? undefined : 'auto',
            }}
          >
            {pendientesRevision} documento{pendientesRevision !== 1 ? 's' : ''} por revisar
          </button>
        )}

        <div style={{ marginLeft: pendientesRevision > 0 ? 0 : 'auto' }}>
          <BotonImprimir
            compacto
            documentoId="equipo.documentos_empleado"
            titulo="Documentos de empleado"
            generarPdf={async opts => {
              const rec = await M.cargarRecursos()
              const partes = [
                filtroPersona === 'todas' ? 'Todas las personas' : filtroPersona,
                filtroMes === 'todos' ? 'Todos los meses' : MESES_LARGO[filtroMes - 1],
                filtroTipo === 'todos' ? 'Todos los tipos' : filtroTipo,
              ]
              return construirDocumentosPDF(filtrados, partes.join(' · '), rec, opts.bn)
            }}
          />
        </div>
      </div>

      {verRevision && (
        <ModalRevisionEquipo
          onClose={() => setVerRevision(false)}
          onResuelto={() => { cargarPendientesRevision(); cargar() }}
        />
      )}

      <SeccionLabel bg={GRANATE}>Documentos archivados</SeccionLabel>
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Cargando…</div>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: INK }}>
                {['Tipo', 'Persona', 'Periodo', 'Documento'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: OSW, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: CREMA, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Sin documentos con estos filtros.</td></tr>
              ) : filtrados.map(d => (
                <tr key={d.id} style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', border: `2px solid ${INK}`, padding: '2px 8px', background: CLARO, color: INK }}>{d.tipo}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: OSW, fontWeight: 600 }}>{d.persona ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: GRIS }}>
                    {d.mes ? `${MESES_LARGO[d.mes - 1]} ${d.anio}` : d.fecha ? fmtDate(d.fecha) : (d.anio ?? '—')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: AZUL, fontFamily: OSW, fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                        <ExternalLink size={12} /> Ver
                      </a>
                    ) : <span style={{ color: GRIS }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PantallaCantera>
  )
}

const selectNeo: React.CSSProperties = { background: BLANCO, border: `3px solid ${INK}`, color: INK, padding: '7px 12px', fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', outline: 'none' }
