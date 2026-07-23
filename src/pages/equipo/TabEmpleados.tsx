/**
 * TabEmpleados (pestaña "Personas") — rejilla de tarjetas, una por empleado
 * activo de plantilla o extra (los socios no tienen ficha de empleado: nunca
 * tienen nómina, LEY-PRUDENCIA-01 regla 2). Cada tarjeta muestra la realidad
 * real de su tipo: plantilla con nómina real, Emilio con cálculo automático
 * (v_nomina_emilio, nunca "Falta nómina" — a él no le llega PDF, es correcto
 * que no exista fila en `nominas`), Fernando (extra) con lo pagado por Bizum
 * del mes. Clic en la tarjeta abre su ficha (nóminas del año + acumulados);
 * el icono de editar (abajo a la derecha, no en la cabecera) abre sus datos.
 */
import { useEffect, useMemo, useState } from 'react'
import { UserPlus, Archive, ArchiveRestore, Trash2, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNominasCompletas } from '@/lib/equipo/useNominasCompletas'
import { buscarBizumMes } from '@/lib/equipo/bizumExtra'
import { fmtEur, fmtDate } from '@/lib/format'
import ModalEmpleado, { type Empleado } from '@/components/equipo/ModalEmpleado'
import { MESES_LARGO } from '@/components/equipo/NominaSoloLectura'
import { archivarEmpleado, reactivarEmpleado, eliminarEmpleadoDuro } from '@/components/equipo/horarios/personal'
import { OSW, LEX, INK, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, AZUL, GRIS, BLANCO, eyebrow } from '@/styles/neobrutal'
import { HeroCantera, PantallaCantera, SeccionLabel } from '@/components/kit/cantera'

const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW }

interface NominaEmilioMes {
  adeudado: number
}

function Avatar({ nombre, foto, apagado }: { nombre: string; foto?: string | null; apagado?: boolean }) {
  const initials = nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: apagado ? GRIS : GRANATE, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: OSW, fontSize: 14, fontWeight: 700, color: BLANCO,
    }}>
      {foto ? <img src={foto} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </div>
  )
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', fontFamily: OSW, fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
      textTransform: 'uppercase', border: `2px solid ${INK}`, padding: '2px 8px', background: bg, color,
    }}>{label}</span>
  )
}

export default function TabEmpleados() {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loadingBase, setLoadingBase] = useState(true)
  const [verArchivados, setVerArchivados] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; empleado: Empleado | null; tabInicial?: 'personales' | 'nominas' }>({ open: false, empleado: null })
  const [bizumPorExtra, setBizumPorExtra] = useState<Record<string, { importe: number; fecha: string } | null>>({})
  const [emilioMes, setEmilioMes] = useState<NominaEmilioMes | null>(null)

  const { loading: loadingNominas, nominas } = useNominasCompletas(anioActual)

  async function fetchEmpleados() {
    setLoadingBase(true)
    const { data, error } = await supabase
      .from('empleados')
      .select('id, nombre, nif, iban, salario, fecha_alta, estado, datos_personales, drive_folder_id, cargo, email, foto_url, dias_vacaciones_anuales, tipo_relacion')
      .order('nombre')
    if (!error) setEmpleados((data ?? []) as Empleado[])
    setLoadingBase(false)
  }
  useEffect(() => { fetchEmpleados() }, [])

  // Cálculo automático de Emilio del mes en curso: no le llega PDF, nunca tiene
  // fila en `nominas` — su coste real sale de v_nomina_emilio, no de esa tabla.
  useEffect(() => {
    let cancelado = false
    supabase.from('v_nomina_emilio').select('adeudado').eq('mes', mesActual).eq('anio', anioActual).maybeSingle()
      .then(({ data }) => { if (!cancelado) setEmilioMes((data as NominaEmilioMes | null) ?? null) })
    return () => { cancelado = true }
  }, [mesActual, anioActual])

  const personas = useMemo(() => {
    // Socios (Rubén) nunca aparecen como empleados: no tienen nómina ni ficha aquí.
    const base = empleados.filter(e => e.tipo_relacion !== 'socio')
    return verArchivados ? base : base.filter(e => e.estado === 'activo')
  }, [empleados, verArchivados])

  // Extras (Fernando): pago por Bizum del mes en curso, buscado por nombre real en conciliación.
  useEffect(() => {
    let cancelado = false
    const extras = personas.filter(e => e.tipo_relacion === 'extra')
    Promise.all(extras.map(async e => [e.id!, await buscarBizumMes(supabase, e.nombre, mesActual, anioActual)] as const))
      .then(pares => { if (!cancelado) setBizumPorExtra(Object.fromEntries(pares)) })
    return () => { cancelado = true }
  }, [personas, mesActual, anioActual])

  async function onArchivar(emp: Empleado, e: React.MouseEvent) {
    e.stopPropagation()
    const archivado = emp.estado !== 'activo'
    if (archivado) {
      await reactivarEmpleado(emp.id!)
    } else {
      if (!window.confirm(`¿Pasar a ${emp.nombre} a antiguos empleados? Deja de aparecer en horarios pero conserva su histórico.`)) return
      await archivarEmpleado(emp.id!)
    }
    fetchEmpleados()
  }

  async function onBorrar(emp: Empleado, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`BORRAR DEFINITIVAMENTE a ${emp.nombre}. Se elimina su ficha y sus horarios. Esta acción NO se puede deshacer. ¿Continuar?`)) return
    await eliminarEmpleadoDuro(emp.id!)
    fetchEmpleados()
  }

  const loading = loadingBase || loadingNominas
  const mesLabel = `${MESES_LARGO[mesActual - 1].toLowerCase()} ${anioActual}`

  // Agregado solo para el héroe visual (no altera el cálculo por tarjeta, que sigue igual abajo).
  const activosHero = useMemo(() => empleados.filter(e => e.tipo_relacion !== 'socio' && e.estado === 'activo'), [empleados])
  const { totalCosteMesHero, pendientesHero } = useMemo(() => {
    let total = 0, pendientes = 0
    for (const emp of activosHero) {
      const esExtra = emp.tipo_relacion === 'extra'
      const esEmilio = /emilio/i.test(emp.nombre)
      if (esEmilio) { if (emilioMes?.adeudado != null) total += emilioMes.adeudado }
      else if (esExtra) { const b = bizumPorExtra[emp.id!]; if (b?.importe != null) total += b.importe }
      else {
        const nomMes = nominas.filter(n => n.empleado_id === emp.id).find(n => n.mes === mesActual)
        if (nomMes) {
          total += nomMes.clasificacion === 'sin_pago' ? nomMes.importe_neto : nomMes.totalPagado
          if (nomMes.estado === 'revisar') pendientes += 1
        }
      }
    }
    return { totalCosteMesHero: total, pendientesHero: pendientes }
  }, [activosHero, nominas, mesActual, emilioMes, bizumPorExtra])

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular={`Tu equipo son ${activosHero.length} persona${activosHero.length !== 1 ? 's' : ''}`}
        etiquetaDato={`Coste del equipo · ${mesLabel}`}
        cifra={fmtEur(totalCosteMesHero, { decimals: 0 })}
        resumen={pendientesHero > 0
          ? <>{pendientesHero} nómina{pendientesHero !== 1 ? 's' : ''} pendiente{pendientesHero !== 1 ? 's' : ''} de revisar este mes.</>
          : 'Todo el equipo está al día este mes.'}
        atencion={[
          pendientesHero > 0 ? `${pendientesHero} nóminas pendientes` : null,
          `${activosHero.length} activos`,
        ]}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: OSW, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: GRIS, cursor: 'pointer' }}>
          <input type="checkbox" checked={verArchivados} onChange={e => setVerArchivados(e.target.checked)} />
          Ver antiguos empleados también
        </label>
        <button
          onClick={() => setModal({ open: true, empleado: null })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            border: `3px solid ${INK}`, boxShadow: SHADOW, background: AMA, color: INK,
            fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase',
            padding: '8px 14px', cursor: 'pointer',
          }}
        >
          <UserPlus size={13} /> Nuevo empleado
        </button>
      </div>

      <SeccionLabel bg={GRANATE}>Plantilla</SeccionLabel>
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Cargando…</div>
      ) : personas.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Sin empleados. Añade el primero.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignItems: 'stretch' }}>
          {personas.map(emp => {
            const esExtra = emp.tipo_relacion === 'extra'
            const esEmilio = /emilio/i.test(emp.nombre)
            const archivado = emp.estado !== 'activo'
            const nominasEmp = nominas.filter(n => n.empleado_id === emp.id)
            const nomMes = !esExtra && !esEmilio ? nominasEmp.find(n => n.mes === mesActual) : undefined
            const pendientes = nominasEmp.filter(n => n.estado === 'revisar').length
            const bizum = esExtra ? bizumPorExtra[emp.id!] : undefined

            // Fila 2 — UNA sola etiqueta de estado general.
            let estadoGeneral: string
            if (esExtra || esEmilio) estadoGeneral = 'Al día'
            else if (!nomMes) estadoGeneral = 'Falta nómina'
            else if (pendientes > 0) estadoGeneral = `${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`
            else estadoGeneral = 'Al día'
            const estadoGeneralBg = estadoGeneral === 'Al día' ? CLARO : estadoGeneral === 'Falta nómina' ? GRIS : AMA

            // Fila 3 — coste del mes (real por tipo).
            let costeMes: number | null = null
            if (esEmilio) costeMes = emilioMes?.adeudado ?? null
            else if (esExtra) costeMes = bizum?.importe ?? null
            else if (nomMes) costeMes = nomMes.clasificacion === 'sin_pago' ? nomMes.importe_neto : nomMes.totalPagado

            // Fila 4 — estado real de la nómina del mes, con el significado correcto por tipo.
            let fila4: { label: string; bg: string; color: string; detalle?: string } | null = null
            if (esEmilio) {
              fila4 = { label: 'Cálculo auto', bg: GRANATE, color: BLANCO, detalle: emilioMes ? fmtEur(emilioMes.adeudado, { decimals: 2 }) : '—' }
            } else if (esExtra) {
              fila4 = bizum
                ? { label: 'Extra · pago por Bizum', bg: AZUL, color: BLANCO, detalle: `${fmtEur(bizum.importe, { decimals: 2 })} · ${fmtDate(bizum.fecha)}` }
                : { label: 'Extra · pago por Bizum', bg: CLARO, color: GRIS, detalle: 'Sin pagos este mes' }
            } else if (nomMes) {
              fila4 = nomMes.clasificacion === 'sin_pago'
                ? { label: 'Comprometida', bg: AMA, color: INK, detalle: fmtEur(nomMes.importe_neto, { decimals: 2 }) }
                : { label: 'Pagada ✓', bg: VERDE, color: BLANCO, detalle: `${fmtEur(nomMes.totalPagado, { decimals: 2 })} · ${fmtDate(nomMes.pagos.find(p => p.confirmado)?.fecha ?? '')}` }
            }

            return (
              <div
                key={emp.id}
                onClick={() => setModal({ open: true, empleado: emp, tabInicial: 'nominas' })}
                style={{ ...card, padding: 14, cursor: 'pointer', opacity: archivado ? 0.55 : 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 220 }}
              >
                {/* Fila 1 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Avatar nombre={emp.nombre} foto={emp.foto_url} apagado={archivado} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontFamily: OSW, fontWeight: 700, fontSize: 14, color: INK, lineHeight: 1.25,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word',
                    }}>{emp.nombre}</div>
                    <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 2 }}>{emp.cargo || (esExtra ? 'Extra' : 'Plantilla')}</div>
                  </div>
                </div>

                {/* Fila 2 — una sola etiqueta de estado */}
                <div><Badge label={estadoGeneral} bg={estadoGeneralBg} color={INK} /></div>

                {/* Fila 3 — coste del mes */}
                <div>
                  <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, color: INK, lineHeight: 1 }}>
                    {costeMes != null ? fmtEur(costeMes, { decimals: 2 }) : '—'}
                  </div>
                  <div style={{ fontFamily: LEX, fontSize: 10.5, color: GRIS, marginTop: 2 }}>coste del mes ({mesLabel})</div>
                </div>

                {/* Fila 4 — estado real de la nómina del mes */}
                {fila4 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Badge label={fila4.label} bg={fila4.bg} color={fila4.color} />
                    {fila4.detalle && <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS }}>{fila4.detalle}</span>}
                  </div>
                )}

                <div style={{ flex: 1 }} />

                {/* Acciones — abajo a la derecha, nunca en la cabecera */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setModal({ open: true, empleado: emp, tabInicial: 'personales' })} title="Editar datos" style={accionBtn}><Pencil size={13} color={GRIS} /></button>
                  <button onClick={e => onArchivar(emp, e)} title={archivado ? 'Reactivar' : 'Pasar a antiguos'} style={accionBtn}>
                    {archivado ? <ArchiveRestore size={13} color={VERDE} /> : <Archive size={13} color={GRIS} />}
                  </button>
                  <button onClick={e => onBorrar(emp, e)} title="Borrar definitivamente" style={accionBtn}><Trash2 size={13} color={GRANATE} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal.open && (
        <ModalEmpleado
          empleado={modal.empleado}
          tabInicial={modal.tabInicial}
          onClose={() => setModal({ open: false, empleado: null })}
          onSaved={() => { fetchEmpleados(); setModal({ open: false, empleado: null }) }}
        />
      )}
    </PantallaCantera>
  )
}

const accionBtn: React.CSSProperties = { width: 26, height: 26, border: `2px solid ${INK}`, background: BLANCO, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }
