// matchNomina — motor de sugerencia de cruce nómina ↔ movimiento de banco (conciliacion).
//
// Contexto de negocio (instrucción explícita): las nóminas en el banco están MAL
// categorizadas en muchos casos históricos (migración en curso). El motor NUNCA debe
// depender de `categoria` para encontrar candidatos. Identifica candidatos por:
//   (a) fecha dentro de una ventana alrededor de fin de mes de la nómina
//       (día 25 del mes de la nómina → día 10 del mes siguiente)
//   (b) tipo='gasto'
//   (c) importe (valor absoluto) parecido al neto, o la SUMA de 2 movimientos parecida
//       al neto (anticipo + resto)
//   (d) el concepto/proveedor contiene el nombre del empleado o una palabra clave de nómina
//
// FÓRMULA DE PUNTUACIÓN (confianza 0-100), ver `scoreCandidato`:
//   +40  el importe (abs) del movimiento coincide con el neto de la nómina ±2€
//   +25  el nombre o apellido del empleado aparece en concepto o proveedor
//        (comparación normalizada: minúsculas, sin tildes)
//   +15  el concepto/proveedor contiene alguna palabra clave: nomina, liquidacion,
//        anticipo, sueldo, salario (case-insensitive, sin acentos)
//   +10  la fecha cae en la primera semana (día 1-7) del mes siguiente al de la nómina
//        (patrón típico de pago de nóminas)
// Máximo teórico: 90. Solo se devuelven candidatos con confianza > 0 (evita ruido de
// movimientos que solo cumplen la ventana de fechas sin ninguna señal real).
//
// NUNCA se empareja solo por importe sin ninguna señal de nombre/palabra clave: un
// candidato que solo puntúa por importe (+40) queda con confianza 40, que el frontend
// debe mostrar como "candidato de baja confianza, solo por importe" (no se marca ni
// asocia automáticamente en ningún punto de este motor; asociar-pago siempre requiere
// una llamada explícita).

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CandidatoMatch {
  conciliacion_id: string
  fecha: string
  concepto: string | null
  proveedor: string | null
  importe: number
  confianza: number // 0-100
  motivo: string // por qué se sugiere (ej. "nombre 'García' en proveedor + importe exacto")
}

export interface NominaParaMatch {
  id: string
  empleado_nombre: string
  /** Alias del empleado (cuadrante, nómina oficial, banco…) además de `empleado_nombre`.
   *  El cruce comprueba TODOS: el nombre del banco puede venir por cualquiera. */
  aliases?: string[]
  mes: number
  anio: number
  importe_neto: number | null
}

interface FilaConciliacion {
  id: string
  fecha: string
  concepto: string | null
  proveedor: string | null
  importe: number
}

const TOLERANCIA_IMPORTE = 2 // €
const PALABRAS_CLAVE = ['nomina', 'liquidacion', 'anticipo', 'sueldo', 'salario']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Ventana de fechas: día 25 del mes de la nómina → día 10 del mes siguiente.
// Se construye como string 'YYYY-MM-DD' (sin pasar por Date) para no arrastrar
// desplazamientos de timezone al comparar contra columnas `date` de Supabase.
function ventanaFechas(mes: number, anio: number): { desde: string; hasta: string } {
  const desde = `${anio}-${pad2(mes)}-25`
  let mesSig = mes + 1
  let anioSig = anio
  if (mesSig > 12) { mesSig = 1; anioSig += 1 }
  const hasta = `${anioSig}-${pad2(mesSig)}-10`
  return { desde, hasta }
}

function mesSiguiente(mes: number, anio: number): { mes: number; anio: number } {
  let mesSig = mes + 1
  let anioSig = anio
  if (mesSig > 12) { mesSig = 1; anioSig += 1 }
  return { mes: mesSig, anio: anioSig }
}

// Primera semana (día 1-7) del mes siguiente al de la nómina — patrón típico de pago.
function esPrimeraSemanaMesSiguiente(fechaISO: string, mes: number, anio: number): boolean {
  const sig = mesSiguiente(mes, anio)
  const prefijo = `${sig.anio}-${pad2(sig.mes)}-`
  if (!fechaISO.startsWith(prefijo)) return false
  const dia = parseInt(fechaISO.slice(8, 10), 10)
  return dia >= 1 && dia <= 7
}

// Normaliza a minúsculas y sin tildes para comparar texto libre (concepto/proveedor/nombre).
function normalizarTexto(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Devuelve la primera palabra (>=3 letras) del nombre o de CUALQUIER alias del
// empleado que aparece en el texto normalizado de concepto+proveedor, o null si
// ninguna aparece. Revisar por alias es lo que permite que "Ray" en el cuadrante
// y "Juan Ramón Méndez Melo" en la nómina/banco casen con el mismo empleado.
function nombreEnTexto(nombresEmpleado: string[], textoNormalizado: string): string | null {
  for (const nombre of nombresEmpleado) {
    const palabras = normalizarTexto(nombre).split(/\s+/).filter(p => p.length >= 3)
    for (const p of palabras) {
      if (textoNormalizado.includes(p)) return p
    }
  }
  return null
}

function nombresYAlias(nomina: NominaParaMatch): string[] {
  return [nomina.empleado_nombre, ...(nomina.aliases ?? [])].filter(Boolean)
}

// IDs de movimientos de conciliación ya asociados (confirmados) a OTRA nómina distinta
// de la que se está procesando — se excluyen para no proponer un mismo movimiento de
// banco como pago de dos nóminas distintas.
async function conciliacionIdsAsociadosOtraNomina(supabase: SupabaseClient, nominaId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('nominas_pagos')
    .select('conciliacion_id')
    .neq('nomina_id', nominaId)
    .eq('confirmado', true)
  return new Set((data ?? []).map(r => r.conciliacion_id as string))
}

async function fetchCandidatosBase(supabase: SupabaseClient, nomina: NominaParaMatch): Promise<FilaConciliacion[]> {
  const { desde, hasta } = ventanaFechas(nomina.mes, nomina.anio)
  const [{ data, error }, excluidos] = await Promise.all([
    supabase
      .from('conciliacion')
      .select('id, fecha, concepto, importe, proveedor, tipo')
      .eq('tipo', 'gasto')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true }),
    conciliacionIdsAsociadosOtraNomina(supabase, nomina.id),
  ])
  if (error || !data) return []
  return (data as { id: string; fecha: string; concepto: string | null; importe: number; proveedor: string | null }[])
    .filter(r => !excluidos.has(r.id))
    .map(r => ({
      id: r.id,
      fecha: r.fecha,
      concepto: r.concepto ?? null,
      proveedor: r.proveedor ?? null,
      importe: Number(r.importe),
    }))
}

function scoreCandidato(row: FilaConciliacion, nomina: NominaParaMatch): CandidatoMatch {
  let confianza = 0
  const motivos: string[] = []
  const importeAbs = Math.abs(Number(row.importe))
  const netoAbs = nomina.importe_neto != null ? Math.abs(nomina.importe_neto) : null

  if (netoAbs != null && Math.abs(importeAbs - netoAbs) <= TOLERANCIA_IMPORTE) {
    confianza += 40
    motivos.push(`importe ${importeAbs.toFixed(2)}€ coincide con neto ${netoAbs.toFixed(2)}€`)
  }

  const conceptoNorm = normalizarTexto(row.concepto)
  const proveedorNorm = normalizarTexto(row.proveedor)
  const textoCompleto = `${conceptoNorm} ${proveedorNorm}`

  const nombreCoincide = nombreEnTexto(nombresYAlias(nomina), textoCompleto)
  if (nombreCoincide) {
    confianza += 25
    motivos.push(`nombre "${nombreCoincide}" en concepto/proveedor`)
  }

  const palabraClave = PALABRAS_CLAVE.find(p => textoCompleto.includes(p))
  if (palabraClave) {
    confianza += 15
    motivos.push(`palabra clave "${palabraClave}"`)
  }

  if (esPrimeraSemanaMesSiguiente(row.fecha, nomina.mes, nomina.anio)) {
    confianza += 10
    motivos.push('fecha en primera semana del mes siguiente (patrón típico de pago)')
  }

  return {
    conciliacion_id: row.id,
    fecha: row.fecha,
    concepto: row.concepto,
    proveedor: row.proveedor,
    importe: Number(row.importe),
    confianza,
    motivo: motivos.length > 0 ? motivos.join(' + ') : 'candidato de baja confianza, solo por ventana de fechas',
  }
}

export async function sugerirCandidatos(supabase: SupabaseClient, nomina: NominaParaMatch): Promise<CandidatoMatch[]> {
  const base = await fetchCandidatosBase(supabase, nomina)
  const puntuados = base
    .map(row => scoreCandidato(row, nomina))
    // Se descartan candidatos con confianza 0 (ninguna señal real más allá de la
    // ventana de fechas): son ruido, no aportan valor al usuario en la lista corta.
    .filter(c => c.confianza > 0)
  puntuados.sort((a, b) => b.confianza - a.confianza)
  return puntuados.slice(0, 8)
}

// Caso "anticipo + resto": si ningún candidato individual iguala el neto, pero dos
// movimientos del mismo empleado (ambos con señal de nombre en concepto/proveedor) en
// la misma ventana suman el neto ±2€, se propone esa pareja como combinación.
export async function sugerirCombinacion(supabase: SupabaseClient, nomina: NominaParaMatch): Promise<CandidatoMatch[][]> {
  if (nomina.importe_neto == null) return []
  const netoAbs = Math.abs(nomina.importe_neto)

  const base = await fetchCandidatosBase(supabase, nomina)

  const hayIndividual = base.some(row => Math.abs(Math.abs(row.importe) - netoAbs) <= TOLERANCIA_IMPORTE)
  if (hayIndividual) return []

  // Solo se consideran candidatos con señal de nombre del empleado — evita proponer
  // parejas de movimientos ajenos que por casualidad suman un importe parecido.
  const conNombre = base
    .map(row => scoreCandidato(row, nomina))
    .filter(c => {
      const texto = `${normalizarTexto(c.concepto)} ${normalizarTexto(c.proveedor)}`
      return Boolean(nombreEnTexto(nombresYAlias(nomina), texto))
    })

  const combinaciones: CandidatoMatch[][] = []
  const usados = new Set<number>()
  for (let i = 0; i < conNombre.length; i++) {
    if (usados.has(i)) continue
    for (let j = i + 1; j < conNombre.length; j++) {
      if (usados.has(j)) continue
      const suma = Math.abs(conNombre[i].importe) + Math.abs(conNombre[j].importe)
      if (Math.abs(suma - netoAbs) <= TOLERANCIA_IMPORTE) {
        const nota = ` · combinación anticipo+resto (suma ${suma.toFixed(2)}€ ≈ neto ${netoAbs.toFixed(2)}€)`
        combinaciones.push([
          { ...conNombre[i], motivo: conNombre[i].motivo + nota },
          { ...conNombre[j], motivo: conNombre[j].motivo + nota },
        ])
        usados.add(i)
        usados.add(j)
        break
      }
    }
  }

  return combinaciones.slice(0, 3)
}
