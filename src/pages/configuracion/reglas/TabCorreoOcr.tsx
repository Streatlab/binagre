import { BLANCO, GRANATE, GRIS, VERDE, OSW, LEX, INK } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { Plus, Trash2, Mail, FileText, BarChart3, HelpCircle } from 'lucide-react'
import { PantallaCantera, HeroCantera, Papel, Plancha, PlanchaCelda, SeccionLabel } from '@/components/kit/cantera'

// Aprendizaje del cartero de correo -> OCR.
// El barrido diario (8:00) lee el buzón de facturas, coge cada PDF y, segun
// estas reglas, lo manda al OCR de FACTURAS o al de RESUMENES DE VENTAS.
// Cada vez que Ruben clasifica un remitente nuevo, se guarda aqui como regla y
// el sistema deja de preguntar. Autopropaga a remitentes ya conocidos.

interface ReglaCorreo {
  id: string
  remitente: string | null      // dominio o email del que llega (ej: @glovoapp.com)
  asunto_contiene: string | null // palabra clave opcional en el asunto
  destino: 'factura' | 'ventas'  // a que OCR va
  veces_confirmada: number
  activa: boolean
}

interface EstadoCartero {
  ultimo_barrido: string | null
  procesados_hoy: number
  pendientes_clasificar: number
  buzon_conectado: boolean
}

export default function TabCorreoOcr() {
  const { T } = useTheme()
  const [reglas, setReglas] = useState<ReglaCorreo[]>([])
  const [estado, setEstado] = useState<EstadoCartero | null>(null)
  const [loading, setLoading] = useState(true)
  const [nRem, setNRem] = useState('')
  const [nAsunto, setNAsunto] = useState('')
  const [nDest, setNDest] = useState<'factura' | 'ventas'>('factura')

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setLoading(true)
    try {
      const { data } = await supabase.from('reglas_correo_ocr').select('*').order('veces_confirmada', { ascending: false })
      setReglas((data as ReglaCorreo[]) ?? [])
      const { data: est } = await supabase.from('cartero_correo_estado').select('*').limit(1).single()
      if (est) setEstado(est as EstadoCartero)
    } catch { /* tablas aun no creadas: estado vacio */ }
    setLoading(false)
  }

  async function crear() {
    if (!nRem.trim()) return
    await supabase.from('reglas_correo_ocr').insert({
      remitente: nRem.trim() || null,
      asunto_contiene: nAsunto.trim() || null,
      destino: nDest,
      veces_confirmada: 1, activa: true,
    })
    setNRem(''); setNAsunto(''); setNDest('factura'); cargar()
  }
  async function toggleActiva(id: string, activa: boolean) {
    await supabase.from('reglas_correo_ocr').update({ activa: !activa }).eq('id', id); cargar()
  }
  async function borrar(id: string) {
    if (!confirm('¿Eliminar esta regla de clasificación?')) return
    await supabase.from('reglas_correo_ocr').delete().eq('id', id); cargar()
  }

  const inp: React.CSSProperties = { background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' }
  const btnP: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: GRANATE, color: BLANCO, border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }
  const ico: React.CSSProperties = { background: 'transparent', border: `0.5px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', padding: 5, display: 'flex' }
  const chip = (activo: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: `1px solid ${activo ? GRANATE : T.brd}`, background: activo ? GRANATE : 'transparent', color: activo ? BLANCO : T.sec, fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' })

  if (loading) return (
    <PantallaCantera embedded>
      <Papel ceja={GRIS}><div style={{ padding: 32, textAlign: 'center', color: GRIS, fontFamily: LEX, fontSize: 13, fontWeight: 600 }}>Cargando…</div></Papel>
    </PantallaCantera>
  )

  const pendientes = estado?.pendientes_clasificar ?? 0
  const titular = !estado?.buzon_conectado
    ? 'El buzón de facturas todavía no está conectado'
    : pendientes > 0
    ? 'El cartero tiene correos esperando a que los clasifiques'
    : 'El cartero está al día: clasifica solo cada correo que entra'

  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular={titular}
        etiquetaDato={estado ? 'Correos por clasificar' : undefined}
        cifra={estado ? String(pendientes) : undefined}
        resumen="El sistema revisa el buzón de facturas cada día a las 8:00, coge los PDF y los manda solo al OCR correcto: facturas de proveedor al OCR de Facturas, liquidaciones de plataforma al OCR de Resúmenes de ventas. Aprende de cada remitente que clasificas: a las pocas veces deja de preguntar."
      />

      <Plancha>
        <PlanchaCelda bg={BLANCO} color={INK} first>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}><Mail size={13} />Buzón</div>
          <div style={{ fontFamily: OSW, fontSize: 24, fontWeight: 700, marginTop: 6, color: estado?.buzon_conectado ? VERDE : GRIS }}>{estado?.buzon_conectado ? 'Conectado' : 'Sin conectar'}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={BLANCO} color={INK}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}><BarChart3 size={13} />Procesados hoy</div>
          <div style={{ fontFamily: OSW, fontSize: 24, fontWeight: 700, marginTop: 6 }}>{estado?.procesados_hoy ?? 0}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={BLANCO} color={INK}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}><HelpCircle size={13} />Por clasificar</div>
          <div style={{ fontFamily: OSW, fontSize: 24, fontWeight: 700, marginTop: 6, color: pendientes > 0 ? GRANATE : INK }}>{pendientes}</div>
        </PlanchaCelda>
        <PlanchaCelda bg={BLANCO} color={INK}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: OSW, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}><FileText size={13} />Último barrido</div>
          <div style={{ fontFamily: OSW, fontSize: 24, fontWeight: 700, marginTop: 6 }}>{estado?.ultimo_barrido ? new Date(estado.ultimo_barrido).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
        </PlanchaCelda>
      </Plancha>

      <div>
        <SeccionLabel bg={GRANATE}>Reglas de clasificación aprendidas</SeccionLabel>
        <Papel ceja={GRANATE} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={nRem} onChange={e => setNRem(e.target.value)} placeholder="Llega de… (ej: @glovoapp.com)" style={{ ...inp, flex: 1.3, minWidth: 200 }} />
          <input value={nAsunto} onChange={e => setNAsunto(e.target.value)} placeholder="Asunto contiene (opcional)" style={{ ...inp, flex: 1, minWidth: 160 }} />
          <button onClick={() => setNDest('factura')} style={chip(nDest === 'factura')}>Factura</button>
          <button onClick={() => setNDest('ventas')} style={chip(nDest === 'ventas')}>Ventas</button>
          <button onClick={crear} style={btnP}><Plus size={16} /> Añadir</button>
        </Papel>
      </div>

      <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 14 }}>
          <thead>
            <tr style={{ background: T.group }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Llega de</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Asunto contiene</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }}>Va a</th>
              <th style={{ width: 90, textAlign: 'center', padding: '10px 8px', fontSize: 11, color: T.mut, textTransform: 'uppercase' }}>Veces</th>
              <th style={{ width: 70, textAlign: 'center', padding: '10px 8px', fontSize: 11, color: T.mut, textTransform: 'uppercase' }}>Activa</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {reglas.map(r => (
              <tr key={r.id} style={{ borderTop: `0.5px solid ${T.brd}`, opacity: r.activa ? 1 : 0.5 }}>
                <td style={{ padding: '10px 14px', color: T.pri }}>{r.remitente ?? '—'}</td>
                <td style={{ padding: '10px 14px', color: T.sec }}>{r.asunto_contiene ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: r.destino === 'factura' ? 'rgba(176,29,35,0.12)' : 'rgba(6,193,103,0.12)', color: r.destino === 'factura' ? GRANATE : VERDE }}>
                    {r.destino === 'factura' ? 'Facturas' : 'Resúmenes ventas'}
                  </span>
                </td>
                <td style={{ textAlign: 'center', color: T.sec }}>{r.veces_confirmada}</td>
                <td style={{ textAlign: 'center' }}>
                  <button onClick={() => toggleActiva(r.id, r.activa)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: r.activa ? VERDE : GRIS }} />
                  </button>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button onClick={() => borrar(r.id)} style={{ ...ico, color: GRANATE }}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            {reglas.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: T.mut }}>Aún sin reglas. El sistema las irá creando a medida que clasifiques los primeros correos.</td></tr>}
          </tbody>
        </table>
      </Papel>
    </PantallaCantera>
  )
}
