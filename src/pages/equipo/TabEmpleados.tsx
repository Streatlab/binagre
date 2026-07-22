/**
 * TabEmpleados (pestaña "Personas") — rejilla de tarjetas, una por empleado
 * activo de plantilla o extra (los socios no tienen ficha de empleado: nunca
 * tienen nómina, LEY-PRUDENCIA-01 regla 2). Cada tarjeta muestra su estado de
 * nómina del mes en curso (real, según banco) y, si es extra, lo pagado por
 * Bizum del mes. Clic en la tarjeta abre su ficha (nóminas del año +
 * acumulados); el icono de editar abre los datos personales/laborales.
 */
import { useEffect, useMemo, useState } from 'react'
import { UserPlus, Archive, ArchiveRestore, Trash2, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNominasCompletas } from '@/lib/equipo/useNominasCompletas'
import { buscarBizumMes } from '@/lib/equipo/bizumExtra'
import { fmtEur, fmtDate } from '@/lib/format'
import ModalEmpleado, { type Empleado } from '@/components/equipo/ModalEmpleado'
import { archivarEmpleado, reactivarEmpleado, eliminarEmpleadoDuro } from '@/components/equipo/horarios/personal'
import { OSW, LEX, INK, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, AZUL, GRIS, BLANCO, eyebrow } from '@/styles/neobrutal'

const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW }

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

export default function TabEmpleados() {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loadingBase, setLoadingBase] = useState(true)
  const [verArchivados, setVerArchivados] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; empleado: Empleado | null; tabInicial?: 'personales' | 'nominas' }>({ open: false, empleado: null })
  const [bizumPorExtra, setBizumPorExtra] = useState<Record<string, { importe: number; fecha: string } | null>>({})

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

  return (
    <div style={{ fontFamily: LEX, color: INK }}>
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

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Cargando…</div>
      ) : personas.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Sin empleados. Añade el primero.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {personas.map(emp => {
            const tipoRelacion = emp.tipo_relacion
            const esExtra = tipoRelacion === 'extra'
            const archivado = emp.estado !== 'activo'
            const nomMes = !esExtra ? nominas.find(n => n.empleado_id === emp.id && n.mes === mesActual) : undefined
            const pendientes = nominas.filter(n => n.empleado_id === emp.id && n.estado === 'revisar').length
            const bizum = esExtra ? bizumPorExtra[emp.id!] : undefined

            let estadoNominaLabel: string
            let estadoNominaColor: string
            let costeMes: number | null = null
            let fechaPago: string | null = null
            if (esExtra) {
              estadoNominaLabel = bizum ? 'Pagado por Bizum' : 'Sin movimiento este mes'
              estadoNominaColor = bizum ? VERDE : GRIS
              costeMes = bizum?.importe ?? null
              fechaPago = bizum?.fecha ?? null
            } else if (!nomMes) {
              estadoNominaLabel = 'Falta nómina'
              estadoNominaColor = GRIS
            } else if (nomMes.clasificacion === 'sin_pago') {
              estadoNominaLabel = 'Comprometida'
              estadoNominaColor = AMA
              costeMes = nomMes.importe_neto
            } else {
              estadoNominaLabel = 'Pagada ✓'
              estadoNominaColor = VERDE
              costeMes = nomMes.totalPagado
              fechaPago = nomMes.pagos.find(p => p.confirmado)?.fecha ?? null
            }

            return (
              <div
                key={emp.id}
                onClick={() => setModal({ open: true, empleado: emp, tabInicial: 'nominas' })}
                style={{ ...card, padding: 14, cursor: 'pointer', opacity: archivado ? 0.55 : 1, display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar nombre={emp.nombre} foto={emp.foto_url} apagado={archivado} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 14, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.nombre}</div>
                    <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS }}>{emp.cargo || (esExtra ? 'Extra' : 'Plantilla')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setModal({ open: true, empleado: emp, tabInicial: 'personales' })} title="Editar datos" style={accionBtn}><Pencil size={13} color={GRIS} /></button>
                    <button onClick={e => onArchivar(emp, e)} title={archivado ? 'Reactivar' : 'Pasar a antiguos'} style={accionBtn}>
                      {archivado ? <ArchiveRestore size={13} color={VERDE} /> : <Archive size={13} color={GRIS} />}
                    </button>
                    <button onClick={e => onBorrar(emp, e)} title="Borrar definitivamente" style={accionBtn}><Trash2 size={13} color={GRANATE} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...eyebrow(pendientes > 0 ? AMA : CLARO, INK), fontSize: 9 }}>{pendientes > 0 ? `${pendientes} pendiente${pendientes !== 1 ? 's' : ''}` : 'Al día'}</span>
                  {esExtra && <span style={{ ...eyebrow(AZUL, BLANCO), fontSize: 9 }}>Pago por Bizum</span>}
                </div>

                <div style={{ borderTop: `2px solid ${CLARO}`, paddingTop: 8 }}>
                  <div style={{ fontFamily: OSW, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginBottom: 3 }}>Coste del mes</div>
                  <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 20, color: INK }}>{costeMes != null ? fmtEur(costeMes, { decimals: 2 }) : '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{
                      fontFamily: OSW, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', border: `2px solid ${INK}`, padding: '1px 7px',
                      background: estadoNominaColor, color: estadoNominaColor === VERDE ? BLANCO : INK,
                    }}>{estadoNominaLabel}</span>
                    {fechaPago && <span style={{ fontFamily: LEX, fontSize: 11, color: GRIS }}>{fmtDate(fechaPago)}</span>}
                  </div>
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
    </div>
  )
}

const accionBtn: React.CSSProperties = { width: 26, height: 26, border: `2px solid ${INK}`, background: BLANCO, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }
