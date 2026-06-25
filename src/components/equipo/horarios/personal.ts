/**
 * Gestión de personal desde Horarios y Empleados: alta, archivo (soft),
 * borrado definitivo (hard), renombrar y orden manual.
 */
import { supabase } from '@/lib/supabase'

export async function crearEmpleado(nombre: string, orden: number): Promise<boolean> {
  const n = nombre.trim()
  if (!n) return false
  const { error } = await supabase.from('empleados').insert({
    nombre: n, estado: 'activo', activo: true, orden,
  })
  return !error
}

export async function renombrarEmpleado(id: string, nombre: string): Promise<boolean> {
  const n = nombre.trim()
  if (!n) return false
  const { error } = await supabase.from('empleados').update({ nombre: n }).eq('id', id)
  return !error
}

/** Archivo blando: pasa a "antiguos", deja de aparecer pero conserva su histórico. */
export async function archivarEmpleado(id: string): Promise<boolean> {
  const { error } = await supabase.from('empleados')
    .update({ estado: 'inactivo', activo: false })
    .eq('id', id)
  return !error
}

/** Reactivar un empleado archivado. */
export async function reactivarEmpleado(id: string): Promise<boolean> {
  const { error } = await supabase.from('empleados')
    .update({ estado: 'activo', activo: true })
    .eq('id', id)
  return !error
}

/** Borrado definitivo: elimina sus horarios y la ficha. Irreversible. */
export async function eliminarEmpleadoDuro(id: string): Promise<boolean> {
  await supabase.from('horarios').delete().eq('empleado_id', id)
  const { error } = await supabase.from('empleados').delete().eq('id', id)
  return !error
}

/** Guarda el orden manual (orden = posición en la lista, 1..n). */
export async function guardarOrden(ids: string[]): Promise<boolean> {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from('empleados').update({ orden: i + 1 }).eq('id', ids[i])
    if (error) return false
  }
  return true
}
