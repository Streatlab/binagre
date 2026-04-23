/* Toast store mínimo, sin dependencias. API tipo react-hot-toast / sonner. */

import { useSyncExternalStore } from 'react'

export type ToastStatus = 'loading' | 'success' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface ToastItem {
  id: string
  status: ToastStatus
  message: string  // soporta "\n" para saltos de línea
  duration?: number  // ms; loading nunca auto-cierra; success default 6000; error no auto-cierra
  action?: ToastAction
  createdAt: number
}

interface ShowOpts {
  id?: string
  duration?: number
  action?: ToastAction
}

let items: ToastItem[] = []
const listeners = new Set<() => void>()
let nextId = 1
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function emit() {
  for (const l of listeners) l()
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
  const item: ToastItem = {
    id, status, message, duration: opts.duration, action: opts.action, createdAt: Date.now(),
  }
  const existingIdx = items.findIndex(i => i.id === id)
  if (existingIdx >= 0) items = items.map((it, i) => i === existingIdx ? item : it)
  else items = [...items, item]
  emit()

  // Auto-dismiss: solo cuando NO es loading y la duración es finita
  if (status !== 'loading') {
    const defaultMs = status === 'success' ? 6000 : Infinity
    const ms = opts.duration ?? defaultMs
    if (Number.isFinite(ms)) {
      const t = setTimeout(() => dismiss(id), ms)
      timers.set(id, t)
    }
  }
  return id
}

export const toast = {
  loading: (message: string, opts?: ShowOpts) => show('loading', message, opts),
  success: (message: string, opts?: ShowOpts) => show('success', message, opts),
  error:   (message: string, opts?: ShowOpts) => show('error', message, opts),
  dismiss,
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => items,
    () => items,
  )
}
