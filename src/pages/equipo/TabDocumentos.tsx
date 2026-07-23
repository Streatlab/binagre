/**
 * TabDocumentos — lista-archivo de todo lo del equipo (nóminas, RLC, RNT,
 * cuotas de autónomos, contratos), filtrable por persona/mes/tipo, con enlace
 * a Drive/Storage. Solo lectura: la subida vive únicamente en Papeleo →
 * Equipo. La cola "por revisar" (equipo_docs_revision) se integra aquí con
 * el modal ya existente.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/format'
import ModalRevisionEquipo from '@/components/equipo/ModalRevisionEquipo'
import { OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA, AZUL, GRIS, BLANCO } from '@/styles/neobrutal'
import { HeroCantera, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW }

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
          to="/finanzas/papeleo?tab=equipo"
          style={{ fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase', color: GRANATE, textDecoration: 'none' }}
        >
          Subir documentos → Papeleo · Equipo
        </Link>

        {pendientesRevision > 0 && (
          <button
            onClick={() => setVerRevision(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: `3px solid ${INK}`, boxShadow: SHADOW, background: AMA, color: INK,
              fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase',
              padding: '8px 14px', cursor: 'pointer', marginLeft: 'auto',
            }}
          >
            {pendientesRevision} documento{pendientesRevision !== 1 ? 's' : ''} por revisar
          </button>
        )}
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
