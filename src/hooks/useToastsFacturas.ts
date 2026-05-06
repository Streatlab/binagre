import { useEffect, useState, useRef } from 'react'

export interface ToastFactura {
  id: string
  createdAt: number
  totalFacturas: number
  facturaIds: string[]
  cerradoManualmente?: boolean
}

const STORAGE_KEY = 'binagre_facturas_toasts'
const TTL_MS = 5 * 60 * 1000 // 5 minutos
const POLL_MS = 3000

interface EstadoToast {
  toast: ToastFactura
  procesadas: number
  asociadas: number
  pendientes: number
  errores: number
}

function leerStorage(): ToastFactura[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as ToastFactura[]
    if (!Array.isArray(arr)) return []
    return arr
  } catch {
    return []
  }
}

function guardarStorage(toasts: ToastFactura[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toasts))
  } catch {
    // ignore
  }
}

function esVivo(t: ToastFactura): boolean {
  if (t.cerradoManualmente) return false
  return Date.now() - t.createdAt < TTL_MS
}

export function useToastsFacturas() {
  const [toasts, setToasts] = useState<ToastFactura[]>(() =>
    leerStorage().filter(esVivo)
  )
  const [estados, setEstados] = useState<Record<string, EstadoToast>>({})
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup TTL cada minuto
  useEffect(() => {
    const limpiar = () => {
      setToasts(prev => {
        const vivos = prev.filter(esVivo)
        if (vivos.length !== prev.length) guardarStorage(vivos)
        return vivos
      })
    }
    const i = setInterval(limpiar, 30000)
    return () => clearInterval(i)
  }, [])

  // Polling estados desde Supabase
  useEffect(() => {
    if (toasts.length === 0) return

    const poll = async () => {
      const nuevosEstados: Record<string, EstadoToast> = {}
      for (const t of toasts) {
        if (t.facturaIds.length === 0) continue
        try {
          const params = new URLSearchParams()
          t.facturaIds.forEach(id => params.append('id', id))
          const r = await fetch(`/api/facturas/estados?${params.toString()}`)
          if (!r.ok) continue
          const data = await r.json() as { facturas: { id: string; estado: string }[] }
          let asoc = 0
          let pend = 0
          let err = 0
          for (const f of data.facturas || []) {
            if (f.estado === 'asociada') asoc++
            else if (f.estado === 'error' || f.estado === 'ocr_fallido' || f.estado === 'cola_fallida') err++
            else pend++
          }
          nuevosEstados[t.id] = {
            toast: t,
            procesadas: asoc + err,
            asociadas: asoc,
            pendientes: pend,
            errores: err,
          }
        } catch {
          // ignore
        }
      }
      setEstados(nuevosEstados)
    }

    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [toasts])

  const crearToast = (facturaIds: string[]) => {
    const nuevo: ToastFactura = {
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      totalFacturas: facturaIds.length,
      facturaIds,
      cerradoManualmente: false,
    }
    setToasts(prev => {
      const next = [...prev, nuevo]
      guardarStorage(next)
      return next
    })
  }

  const cerrarToast = (id: string) => {
    setToasts(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, cerradoManualmente: true } : t)).filter(esVivo)
      guardarStorage(next)
      return next
    })
  }

  return { toasts, estados, crearToast, cerrarToast }
}
