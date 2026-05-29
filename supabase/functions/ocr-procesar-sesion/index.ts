// Worker v11: FIX fuga storage — borra ocr-uploads tambien en 'pendiente' (match banco pendiente es estado normal). Solo retiene 'error'/'achtung' (reprocesables; cron los barre a 24h). Fuente espejo de la edge function desplegada en Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// NOTA: fuente canonica desplegada via Supabase MCP. Este archivo es espejo para control de versiones.
// El unico cambio funcional v10->v11 esta en borrarDelStorage(): se anade 'pendiente' a los estados que permiten borrado.

async function borrarDelStorage(sb: any, storagePath: string, resultados: any[]) {
  const todosBien = resultados.every((r: any) => r.status === 'ok' || r.status === 'duplicado' || r.status === 'pendiente')
  if (!todosBien) return
  try { await sb.storage.from('ocr-uploads').remove([storagePath]) } catch {}
}

export { borrarDelStorage }
