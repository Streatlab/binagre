import { supabase } from '@/lib/supabase'

/**
 * T-F3-10: Comprueba si todos los empleados activos están ausentes en la fecha dada.
 * Si es así → upsert en calendario_operativo con tipo='cerrado' y nota 'Auto: equipo completo ausente'.
 * Si no → revertir a 'operativo' si la fila tiene nota que empieza por 'Auto:'.
 * Implementado en frontend (no trigger BD), según F3-H6.
 */
export async function syncCierrePorCobertura(fecha: string): Promise<void> {
  try {
    // Total empleados activos
    const { count: totalActivos } = await supabase
      .from('empleados')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'activo')

    if (!totalActivos || totalActivos === 0) return

    // Total ausentes ese día (eventos_laborales + permisos aprobados)
    const { data: ausentes } = await supabase
      .from('eventos_laborales')
      .select('empleado_id')
      .eq('fecha', fecha)
      .in('tipo', ['vacaciones', 'baja_medica', 'asuntos_propios', 'permiso_retribuido'])

    const uniqueAusentes = new Set((ausentes ?? []).map((r: { empleado_id: string }) => r.empleado_id)).size

    if (uniqueAusentes >= totalActivos) {
      // Todo el equipo ausente → marcar CERRADO
      await supabase
        .from('calendario_operativo')
        .upsert(
          { fecha, tipo: 'cerrado', nota: 'Auto: equipo completo ausente' },
          { onConflict: 'fecha' }
        )
    } else {
      // Verificar si existe una fila Auto para revertirla
      const { data: fila } = await supabase
        .from('calendario_operativo')
        .select('tipo, nota')
        .eq('fecha', fecha)
        .maybeSingle()

      if (fila && fila.nota && (fila.nota as string).startsWith('Auto:')) {
        await supabase
          .from('calendario_operativo')
          .update({ tipo: 'operativo', nota: null })
          .eq('fecha', fecha)
      }
    }
  } catch (err) {
    console.error('[calendarioOperativoSync] Error:', err)
  }
}

/**
 * Ejecutar sync para un rango de fechas (fecha_inicio a fecha_fin inclusive).
 * Usa Promise.all por eficiencia (F3 riesgo 3 mitigado: batch en paralelo).
 */
export async function syncRango(fechaInicio: string, fechaFin: string): Promise<void> {
  const fechas: string[] = []
  const cur = new Date(fechaInicio + 'T12:00:00')
  const end = new Date(fechaFin + 'T12:00:00')
  while (cur <= end) {
    fechas.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  await Promise.all(fechas.map(syncCierrePorCobertura))
}
