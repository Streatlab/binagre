/**
 * Gestión de personal desde Horarios: alta, baja (soft) y orden manual.
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

/** Baja blanda: deja de aparecer pero conserva su histórico. */
export async function desactivarEmpleado(id: string): Promise<boolean> {
  const { error } = await supabase.from('empleados')
    .update({ estado: 'inactivo', activo: false })
    .eq('id', id)
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
