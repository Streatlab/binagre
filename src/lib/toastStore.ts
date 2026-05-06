/* Toast store con persistencia en localStorage. Sobrevive a F5/reload. */

import { useSyncExternalStore } from 'react'

export type ToastStatus = 'loading' | 'success' | 'error'

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
const MAX_LIFETIME_MS = 5 * 60 * 1000  // 5 minutos máx por toast (success + error)

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
    // Filtra los expirados al cargar
    items = stored.filter(it => !it.expiresAt || it.expiresAt > now)
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
  // - loading: nunca expira
  // - success/error: máx 5 min (o el duration que pase, si menor)
  let expiresAt: number | undefined
  if (status !== 'loading') {
    const defaultMs = MAX_LIFETIME_MS
    const ms = opts.duration ?? defaultMs
    const finalMs = Math.min(ms, MAX_LIFETIME_MS)
    if (Number.isFinite(finalMs)) {
      expiresAt = now + finalMs
    }
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
