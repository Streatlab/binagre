import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * SelloAct · "Act. 14/07 · 15:32"
 * Muestra la fecha/hora del último registro de una tabla (columna de tiempo dada).
 * Uso: <SelloAct tabla="papeleo_bandeja" columna="creado_en" etiqueta="Última subida" />
 * Pensado para las cabeceras de los módulos que reciben documentos (Papeleo,
 * Bancos, Importar plataformas): se ve de un vistazo cuándo entró lo último.
 */
export default function SelloAct({
  tabla,
  columna = 'creado_en',
  etiqueta = 'Act.',
  filtro,
}: {
  tabla: string
  columna?: string
  etiqueta?: string
  filtro?: { col: string; val: string }
}) {
  const [texto, setTexto] = useState<string>('')

  useEffect(() => {
    let vivo = true
    async function cargar() {
      try {
        let q = supabase.from(tabla).select(columna).order(columna, { ascending: false }).limit(1)
        if (filtro) q = q.eq(filtro.col, filtro.val)
        const { data } = await q
        const v = (data?.[0] as Record<string, unknown> | undefined)?.[columna]
        if (!vivo || !v) return
        const d = new Date(String(v))
        const dd = String(d.getDate()).padStart(2, '0')
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const hh = String(d.getHours()).padStart(2, '0')
        const mi = String(d.getMinutes()).padStart(2, '0')
        setTexto(`${etiqueta} ${dd}/${mm} · ${hh}:${mi}`)
      } catch { /* sin sello si falla */ }
    }
    cargar()
    const t = setInterval(cargar, 120000)
    return () => { vivo = false; clearInterval(t) }
  }, [tabla, columna, etiqueta, filtro?.col, filtro?.val])

  if (!texto) return null
  return (
    <span
      title="Hora del último documento o movimiento recibido"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        border: '2px solid #1e2233',
        background: '#fff',
        color: '#1e2233',
        fontFamily: 'Lexend, sans-serif',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.3,
        boxShadow: '3px 3px 0 #1e2233',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 99, background: '#22c55e', display: 'inline-block' }} />
      {texto}
    </span>
  )
}
