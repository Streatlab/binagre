/**
 * useFraseArea — lee la tabla `frases_insight` (SOLO SELECT, cero escritura) y
 * devuelve una frase de cabecera para el área indicada (D · punto 9).
 *
 * La tabla es un motor condicional con placeholders {campo:fmt} que necesitan
 * métricas en vivo. En la cabecera de área no hay pipeline de métricas, así que
 * mostramos las frases del `sub` que NO llevan placeholder (consejo accionable
 * limpio). Si el área no tiene ninguna, devuelve '' → la ranura queda vacía.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface FilaFrase { categoria: string; sub: string | null; lead: string | null; tail: string | null; impacto_base: number | null }

// Frases limpias = las oraciones del sub que no contienen ningún {placeholder}.
function limpia(fila: FilaFrase): string {
  const sub = fila.sub ?? ''
  const buenas = sub.split(/(?<=\.)\s+/).filter(s => s.trim() && !s.includes('{'))
  if (buenas.length) return buenas.join(' ').trim()
  const cab = `${fila.lead ?? ''} ${fila.tail ?? ''}`.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim()
  return cab && !cab.includes('{') ? cab : ''
}

const cache = new Map<string, string>()

export function useFraseArea(categoria?: string): string {
  const [frase, setFrase] = useState<string>(() => (categoria ? cache.get(categoria) ?? '' : ''))

  useEffect(() => {
    if (!categoria) { setFrase(''); return }
    if (cache.has(categoria)) { setFrase(cache.get(categoria)!); return }
    let vivo = true
    supabase
      .from('frases_insight')
      .select('categoria, sub, lead, tail, impacto_base')
      .eq('activo', true)
      .eq('categoria', categoria)
      .order('impacto_base', { ascending: false })
      .then(({ data }) => {
        if (!vivo) return
        const filas = (data ?? []) as FilaFrase[]
        let out = ''
        for (const f of filas) { out = limpia(f); if (out) break }
        cache.set(categoria, out)
        setFrase(out)
      })
    return () => { vivo = false }
  }, [categoria])

  return frase
}
