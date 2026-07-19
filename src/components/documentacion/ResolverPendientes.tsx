/**
 * ResolverPendientes — botón manual de Papeleo.
 * Hace de una sola pulsación, y en bucle hasta acabar, el mantenimiento que antes
 * corría solo por cron (ya NO hay crons de esto: solo se ejecuta cuando Rubén pulsa):
 *   1) Subir a Drive lo que quedó en el almacén interno (archivar-pendientes)
 *   2) Reintentar las lecturas que salieron sin importe (reencolar)
 *   3) Releer las facturas sin importe (encolar-reproc + reproc, solo si las hay)
 *   4) Borrar copias huérfanas del trastero temporal (limpieza)
 * No se ejecuta en ningún otro momento. No gasta nada si no hay nada pendiente.
 */
import { useState } from 'react'
import { RefreshCw, Check, AlertTriangle } from 'lucide-react'
import { OSW, LEX, INK, VERDE, NAR, ROJO, GRIS, SHADOW, BORDER_CARD } from '@/styles/neobrutal'

type LineaEstado = 'run' | 'ok' | 'warn'
interface Linea { txt: string; estado: LineaEstado }

async function jget(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, { method: 'GET' })
  try { return (await r.json()) as Record<string, unknown> } catch { return {} }
}
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

export default function ResolverPendientes({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [lineas, setLineas] = useState<Linea[]>([])

  const push = (txt: string, estado: LineaEstado = 'run') =>
    setLineas(prev => [...prev, { txt, estado }])
  const cerrarUltima = (txt: string, estado: LineaEstado) =>
    setLineas(prev => prev.map((l, i) => (i === prev.length - 1 ? { txt, estado } : l)))

  async function run() {
    if (busy) return
    setBusy(true)
    setLineas([])
    try {
      // 1 · Subir a Drive lo pendiente
      push('Subiendo a Drive lo pendiente…')
      let subidas = 0
      for (let i = 0; i < 40; i++) {
        const r = await jget('/api/facturas?action=archivar-pendientes&lote=30')
        subidas += num(r.subidas)
        if (r.terminado === true || num(r.subidas) === 0) break
      }
      cerrarUltima(`Drive al día · ${subidas} subida${subidas === 1 ? '' : 's'}`, 'ok')

      // 2 · Reintentar lecturas sin importe
      push('Reintentando lecturas sin importe…')
      let reenc = 0
      for (let i = 0; i < 20; i++) {
        const r = await jget('/api/ocr-queue')
        const n = num(r.reencoladas)
        reenc += n
        if (n === 0) break
      }
      cerrarUltima(`Reintentos encolados · ${reenc}`, 'ok')

      // 3 · Releer las facturas sin importe (solo si las hay)
      push('Releyendo facturas sin importe…')
      const enc = await jget('/api/facturas?action=encolar-reproc')
      const porLeer = num(enc.encoladas)
      if (porLeer === 0) {
        cerrarUltima('Sin facturas que releer', 'ok')
      } else {
        let leidas = 0
        for (let i = 0; i < 20; i++) {
          const r = await jget('/api/facturas?action=reproc')
          leidas += num(r.ok_tanda)
          if (r.terminado === true || typeof r.mensaje === 'string') break
        }
        cerrarUltima(`Releídas · ${leidas} de ${porLeer}`, 'ok')
      }

      // 4 · Limpiar copias huérfanas
      push('Limpiando copias huérfanas…')
      const cl = await jget('/api/ocr-cleanup')
      cerrarUltima(`Trastero limpio · ${num(cl.borrados)} borrada${num(cl.borrados) === 1 ? '' : 's'}`, 'ok')

      push('Todo resuelto.', 'ok')
      onDone?.()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Error inesperado', 'warn')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      <button
        onClick={run}
        disabled={busy}
        style={{
          background: busy ? GRIS : VERDE, color: '#fff', border: BORDER_CARD, boxShadow: SHADOW,
          padding: '10px 18px', fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '1.5px',
          textTransform: 'uppercase', cursor: busy ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <RefreshCw size={16} strokeWidth={2.6} style={busy ? { animation: 'sl-spin 1s linear infinite' } : undefined} />
        {busy ? 'Resolviendo…' : 'Resolver pendientes'}
      </button>

      {lineas.length > 0 && (
        <div style={{
          background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: '10px 14px',
          minWidth: 260, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {lineas.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: LEX, fontSize: 12.5, color: INK }}>
              {l.estado === 'ok'
                ? <Check size={14} strokeWidth={3} color={VERDE} style={{ flexShrink: 0 }} />
                : l.estado === 'warn'
                  ? <AlertTriangle size={14} strokeWidth={2.6} color={ROJO} style={{ flexShrink: 0 }} />
                  : <RefreshCw size={14} strokeWidth={2.6} color={NAR} style={{ flexShrink: 0, animation: 'sl-spin 1s linear infinite' }} />}
              <span style={{ color: l.estado === 'warn' ? ROJO : INK }}>{l.txt}</span>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes sl-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
