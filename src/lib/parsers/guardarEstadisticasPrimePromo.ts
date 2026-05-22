/**
 * Guardar estadísticas Prime/Promo en Supabase
 *
 * Upsert en tabla `estadisticas_prime_promo`.
 * El trigger `trg_actualizar_pct_prime_promo` actualiza automáticamente
 * config_canales con la media de los últimos 3 meses.
 */

import { supabase } from '../supabase';
import type { EstadisticaPrimePromo } from './parserUberGanancias';

export interface ResultadoGuardado {
  insertados: number;
  actualizados: number;
  errores: string[];
}

export async function guardarEstadisticasPrimePromo(
  datos: EstadisticaPrimePromo[]
): Promise<ResultadoGuardado> {
  const resultado: ResultadoGuardado = { insertados: 0, actualizados: 0, errores: [] };

  if (!datos.length) {
    resultado.errores.push('No hay datos para guardar');
    return resultado;
  }

  for (const d of datos) {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('estadisticas_prime_promo')
      .select('id')
      .eq('canal', d.canal)
      .eq('marca', d.marca)
      .eq('mes', d.mes)
      .eq('año', d.año)
      .maybeSingle();

    const payload = {
      canal: d.canal,
      marca: d.marca,
      mes: d.mes,
      año: d.año,
      pedidos_total: d.pedidos_total,
      pedidos_prime: d.pedidos_prime,
      pedidos_promo: d.pedidos_promo,
      pct_prime: d.pct_prime,
      pct_promo: d.pct_promo,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      // Update
      const { error } = await supabase
        .from('estadisticas_prime_promo')
        .update(payload)
        .eq('id', existing.id);

      if (error) {
        resultado.errores.push(`Error actualizando ${d.marca} ${d.mes}/${d.año}: ${error.message}`);
      } else {
        resultado.actualizados++;
      }
    } else {
      // Insert
      const { error } = await supabase
        .from('estadisticas_prime_promo')
        .insert(payload);

      if (error) {
        resultado.errores.push(`Error insertando ${d.marca} ${d.mes}/${d.año}: ${error.message}`);
      } else {
        resultado.insertados++;
      }
    }
  }

  return resultado;
}
