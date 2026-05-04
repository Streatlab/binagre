import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FONT } from '@/styles/tokens'
import { fmtEur, fmtDate } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import TabsPastilla from '@/components/ui/TabsPastilla'
import SelectorFechaUniversal from '@/components/ui/SelectorFechaUniversal'
import OcrEditModal from '@/components/ocr/OcrEditModal'
import ExtractosTabla from '@/components/ocr/ExtractosTabla'
import { useOcrUpload } from '@/lib/ocrUploadStore'

type TabId = 'facturas' | 'extractos' | 'ventas' | 'otros'
type SortColumn = 'fecha' | 'contraparte' | 'nif' | 'importe' | 'categoria' | 'doc' | 'estado' | 'titular'
type SortDir = 'asc' | 'desc'
type FiltroCard = 'conciliadas' | 'pendientes' | null

const PAGE_SIZES = [50, 100, 200] as const
type PageSize = typeof PAGE_SIZES[number]
const DEFAULT_PAGE_SIZE: PageSize = 100

const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'

const ACCEPT_FACTURAS = '.pdf,.png,.jpg,.jpeg,.webp'
const ACCEPT_EXTRACTOS = '.csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp'
const ACCEPT_OTROS = '.pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls'

function parsePageSize(raw: string | null): PageSize {
  const n = Number(raw)
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE
}
function parsePage(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

interface CatPyg { id: string; nombre: string; nivel: number; parent_id: string | null }
interface Titular { id: string; nombre: string }
interface ConciliacionRef { id: string }
interface Factura {
  id: string; fecha_factura: string; pr