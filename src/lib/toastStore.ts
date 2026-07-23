/* Toast store con persistencia en localStorage. Sobrevive a F5/reload. */

import { useSyncExternalStore } from 'react'

export type ToastStatus = 'loading' | 'success' | 'aviso' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface ToastItem {
  id: string
  status: ToastStatus
  message: string
  duration?: number
  action?: ToastAction
  createdAt: number
  expiresAt?: number  // timestamp absoluto en ms; null = no expira nunca
}

interface ShowOpts {
  id?: string
  duration?: number
  action?: ToastAction
}

const STORAGE_KEY = 'binagre_toasts_v1'
const MAX_LIFETIME_MS = 5 * 60 * 1000  // tope duro si alguien pide una duración mayor
const DEFAULT_AUTOCIERRE_MS = 6 * 1000 // success/aviso/error/info: 6s por defecto (kit v5-B)
// Tope duro para los avisos de "cargando". Antes no expiraban NUNCA: si el
// proceso que lo abrió se colgaba (una petición sin respuesta, por ejemplo),
// el aviso se quedaba clavado en pantalla para siempre, incluso al día
// siguiente, porque además se guarda en el navegador. Ahora se cae solo.
const MAX_LOADING_MS = 10 * 60 * 1000

let items: ToastItem[] = []
const listeners = new Set<() => void>()
let nextId = 1
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function persist() {
  try {
    // No persistimos action (es función) ni timers
    const serializable = items.map(({ action: _action, ...rest }) => rest)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
  } catch { /* ignora errores de quota */ }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const stored: ToastItem[] = JSON.parse(raw)
    const now = Date.now()
    // Al recargar la página, CUALQUIER aviso de "cargando" es basura: el código
    // que iba a cerrarlo murió con la página anterior. Se descartan siempre.
    items = stored.filter(it => it.status !== 'loading' && (!it.expiresAt || it.expiresAt > now))
    // Reanima los timers de los que aún tienen tiempo
    for (const it of items) {
      if (it.expiresAt && it.expiresAt > now) {
        const t = setTimeout(() => dismiss(it.id), it.expiresAt - now)
        timers.set(it.id, t)
      }
    }
    // Si limpiamos algunos, reescribimos storage
    if (items.length !== stored.length) persist()
  } catch { /* ignore */ }
}

// Cargar al inicializar (solo navegador)
if (typeof window !== 'undefined') loadFromStorage()

function emit() {
  for (const l of listeners) l()
  persist()
}

function dismiss(id: string) {
  items = items.filter(i => i.id !== id)
  const t = timers.get(id)
  if (t) { clearTimeout(t); timers.delete(id) }
  emit()
}

function clearTimer(id: string) {
  const t = timers.get(id)
  if (t) { clearTimeout(t); timers.delete(id) }
}

function show(status: ToastStatus, message: string, opts: ShowOpts = {}): string {
  const id = opts.id ?? `toast-${nextId++}`
  clearTimer(id)
  const now = Date.now()

  // Calcular expiresAt:
  // - loading: lo normal es que lo cierre el éxito/error que lo reemplaza, pero
  //   lleva tope duro de 10 min por si el proceso que lo abrió se cuelga.
  // - success/aviso/error/info: autocierre a los 6s por defecto.
  let expiresAt: number | undefined
  if (status === 'loading') {
    expiresAt = now + MAX_LOADING_MS
  } else {
    const ms = opts.duration ?? DEFAULT_AUTOCIERRE_MS
    if (Number.isFinite(ms)) expiresAt = now + Math.min(ms, MAX_LIFETIME_MS)
  }

  const item: ToastItem = {
    id, status, message,
    duration: opts.duration,
    action: opts.action,
    createdAt: now,
    expiresAt,
  }
  const existingIdx = items.findIndex(i => i.id === id)
  if (existingIdx >= 0) items = items.map((it, i) => i === existingIdx ? item : it)
  else items = [...items, item]
  emit()

  if (expiresAt) {
    const t = setTimeout(() => dismiss(id), expiresAt - now)
    timers.set(id, t)
  }
  return id
}

export const toast = {
  loading: (message: string, opts?: ShowOpts) => show('loading', message, opts),
  success: (message: string, opts?: ShowOpts) => show('success', message, opts),
  aviso:   (message: string, opts?: ShowOpts) => show('aviso', message, opts),
  error:   (message: string, opts?: ShowOpts) => show('error', message, opts),
  info:    (message: string, opts?: ShowOpts) => show('info', message, opts),
  dismiss,
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => items,
    () => items,
  )
}
