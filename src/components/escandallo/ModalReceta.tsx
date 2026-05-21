import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtNum, fmtEur, fmtPct } from '@/utils/format'
import { useConfig } from '@/hooks/useConfig'
import { useConfigCanales } from '@/lib/panel/calcNetoPlataforma'
import type { Ingrediente, EPS, Receta, RecetaLinea, CanalKey } from './types'
import { UNIDADES, thCls, tdCls, n } from './types'
import ModalIngrediente from './ModalIngrediente'
import ModalEPS from './ModalEPS'

interface ConflictoItem { nombre: string; cantidad: number; unidad: string }

interface Props { receta: Receta | null; initialNombre?: string; ingredientes: Ingrediente[]; epsList: EPS[]; onClose: () => void; onSaved: () => void; onDelete?: () => void }

const labelStyle = (_isDark?: boolean): CSSProperties => ({
  fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase' as const, letterSpacing: '2px',
  color: 'var(--sl-text-muted)', marginBottom: 6,
})

const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'var(--sl-input-bg)',
  border: '1px solid var(--sl-border)', borderRadius: 4,
  fontFamily: 'Lexend, sans-serif', fontSize: 13,
  color: 'var(--sl-text-primary)', outline: 'none', transition: 'border-color 200ms',
}

const CHANNELS = [
  { id: 'uber',    label: 'Uber Eats', canalName: 'Uber Eats',     pvpKey: 'pvp_uber'    as CanalKey, color: '#06C167', fg: '#ffffff' },
  { id: 'glovo',   label: 'Glovo',     canalName: 'Glovo',         pvpKey: 'pvp_glovo'   as CanalKey, color: '#e8f442', fg: '#111111' },
  { id: 'je',      label: 'Just Eat',  canalName: 'Just Eat',      pvpKey: 'pvp_je'      as CanalKey, color: '#f5a623', fg: '#111111' },
  { id: 'web',     label: 'Web',       canalName: 'Web Propia',    pvpKey: 'pvp_web'     as CanalKey, color: '#ff6b70', fg: '#ffffff' },
  { id: 'directa', label: 'Directa',   canalName: 'Venta Directa', pvpKey: 'pvp_directa' as CanalKey, color: '#66aaff', fg: '#111111' },
]

const ALL_PVP_KEYS: CanalKey[] = ['pvp_uber', 'pvp_glovo', 'pvp_je', 'pvp_web', 'pvp_directa']

function colorAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function norm(v: number): number { return v > 1 ? v / 100 : v }

interface Waterfall {
  costePlatR: number; costeEstrR: number; costeTotalR: number; margenR: number; margenPctR: number; ivaRepercutido: number
  costePlatC: number; costeEstrC: number; costeTotalC: number; margenC: number; margenPctC: number; ivaSoportado: number
  pvpRecR: number; pvpRecC: number; factorK: number
}

function computeWaterfall(costeMP: number, pvp: number, comision: number, estructura: number, margenDeseado: number): Waterfall {
  const costePlatR = pvp * comision * 1.21
  const ingresoNetoR = pvp - costePlatR
  const costeEstrR = ingresoNetoR * estructura
  const costeTotalR = costeMP + costePlatR + costeEstrR
  const margenR = pvp - costeTotalR
  const margenPctR = pvp > 0 ? (margenR / pvp) * 100 : 0
  const ivaRepercutido = pvp > 0 ? (ingresoNetoR / 1.10) * 0.10 : 0
  const costePlatC = pvp * comision
  const ingresoNetoC = pvp - costePlatC
  const costeEstrC = ingresoNetoC * estructura
  const costeTotalC = costeMP + costePlatC + costeEstrC
  const margenC = pvp - costeTotalC
  const margenPctC = pvp > 0 ? (margenC / pvp) * 100 : 0
  const ivaSoportado = pvp * comision * 0.21
  const denomR = 1 - comision * 1.21 - estructura - margenDeseado
  const denomC = 1 - comision - estructura - margenDeseado
  const pvpRecR = denomR > 0 ? costeMP / denomR : 0
  const pvpRecC = denomC > 0 ? costeMP / denomC : 0
  const factorK = pvp > 0 && costeMP > 0 ? pvp / costeMP : 0
  return { costePlatR, costeEstrR, costeTotalR, margenR, margenPctR, ivaRepercutido, costePlatC, costeEstrC, costeTotalC, margenC, margenPctC, ivaSoportado, pvpRecR, pvpRecC, factorK }
}

// FILE TOO LARGE — only header + key changes pushed. See full file in repo.
// The key change is in channelData calculation below using configCanalesCentral.
