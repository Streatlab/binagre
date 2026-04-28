import { supabase } from '@/lib/supabase'

interface TareaPeriodica {
  id: string
  nombre: string
  frecuencia: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral'
  dia_esperado: number | null
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function calcProximaFecha(t: TareaPeriodica, hoy: Date): string {
  const dia = t.dia_esperado ?? 1
  const y = hoy.getFullYear()
  const m = hoy.getMonth()

  switch (t.frecuencia) {
    case 'diaria': {
      return toDateStr(hoy)
    }
    case 'semanal': {
      // dia_esperado: 1=lun ... 7=dom
      const dow = hoy.getDay() || 7 // 1-7
      const diff = dia - dow
      const d = new Date(hoy)
      d.setDate(hoy.getDate() + diff)
      return toDateStr(d)
    }
    case 'quincenal': {
      // dia_esperado: 1 o 15
      const expected = dia <= 14 ? 1 : 15
      if (hoy.getDate() <= expected) {
        return toDateStr(new Date(y, m, expected))
      }
      // siguiente quincena
      const nextExpected = expected === 1 ? 15 : 1
      const nextMonth = nextExpected === 1 ? m + 1 : m
      return toDateStr(new Date(y, nextMonth, nextExpected))
    }
    case 'mensual': {
      const diaClamp = Math.min(dia, new Date(y, m + 1, 0).getDate())
      if (hoy.getDate() <= diaClamp) {
        return toDateStr(new Date(y, m, diaClamp))
      }
      const nm = m + 1
      const ny = nm > 11 ? y + 1 : y
      const nm2 = nm > 11 ? 0 : nm
      const diaClamp2 = Math.min(dia, new Date(ny, nm2 + 1, 0).getDate())
      return toDateStr(new Date(ny, nm2, diaClamp2))
    }
    case 'trimestral': {
      // trimestre actual: inicio en el mes multiplo de 3 (0, 3, 6, 9)
      const trimStart = Math.floor(m / 3) * 3
      const fechaTrim = new Date(y, trimStart, dia)
      if (fechaTrim >= hoy) return toDateStr(fechaTrim)
      // siguiente trimestre
      const nextTrim = trimStart + 3
      const ny = nextTrim > 11 ? y + 1 : y
      const nm3 = nextTrim > 11 ? nextTrim - 12 : nextTrim
      return toDateStr(new Date(ny, nm3, dia))
    }
    default:
      return toDateStr(hoy)
  }
}

export async function generarPendientes(): Promise<void> {
  const hoy = new Date()
  const hoyStr = toDateStr(hoy)

  // 1. Actualizar pendientes atrasadas
  await supabase
    .from('tareas_pendientes')
    .update({ estado: 'atrasada' })
    .eq('estado', 'pendiente')
    .lt('fecha_esperada', hoyStr)

  // 2. Obtener tareas activas
  const { data: tareas, error } = await supabase
    .from('tareas_periodicas')
    .select('id, nombre, frecuencia, dia_esperado')
    .eq('activa', true)

  if (error || !tareas) return

  for (const t of tareas as TareaPeriodica[]) {
    const fecha = calcProximaFecha(t, hoy)

    // Verificar si ya existe
    const { data: existe } = await supabase
      .from('tareas_pendientes')
      .select('id')
      .eq('tarea_periodica_id', t.id)
      .eq('fecha_esperada', fecha)
      .maybeSingle()

    if (!existe) {
      await supabase.from('tareas_pendientes').insert({
        tarea_periodica_id: t.id,
        fecha_esperada: fecha,
        estado: fecha < hoyStr ? 'atrasada' : 'pendiente',
      })
    }
  }
}
