/* ============================================================================
   HojaA4.tsx · Streat Lab · ERP Binagre
   ----------------------------------------------------------------------------
   Garantiza que la ficha ocupe UNA SOLA hoja A4, siempre, sin tocar el
   documento aprobado de Design.

   No reinterpreta el diseño: lo reduce en bloque, como una fotocopia al 90 %.
   El documento se compone a un ancho mayor (donde el texto necesita menos
   líneas) y después se escala hasta encajar exactamente en 210 mm. Todo baja
   en la misma proporción —tipos, filas, márgenes—, así que la hoja se ve
   idéntica, solo que más compacta. Si ya cabe, no se toca nada.
   ========================================================================== */
import * as React from 'react'

const ANCHO_MM = 210
/** Un pelo por debajo de 297 para que el redondeo del navegador no salte de hoja. */
const ALTO_MM = 296.4
const RATIO = ALTO_MM / ANCHO_MM

/** Milímetros reales del navegador (depende del zoom y del dispositivo). */
function pxPorMm(): number {
  const regla = document.createElement('div')
  regla.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1mm;height:100mm;visibility:hidden'
  document.body.appendChild(regla)
  const v = regla.getBoundingClientRect().height / 100
  regla.remove()
  return v > 0 ? v : 96 / 25.4
}

export default function HojaA4({ children }: { children: React.ReactNode }) {
  const marcoRef = React.useRef<HTMLDivElement>(null)

  const ajustar = React.useCallback(() => {
    const marco = marcoRef.current
    const capa = marco?.firstElementChild as HTMLElement | null
    const hoja = capa?.firstElementChild as HTMLElement | null
    if (!marco || !capa || !hoja) return

    const mm = pxPorMm()
    capa.style.transform = 'none'

    /** ¿Cabe el documento compuesto a este ancho, una vez reducido a 210 mm? */
    const cabe = (ancho: number) => {
      hoja.style.setProperty('width', `${ancho}mm`, 'important')
      hoja.style.setProperty('min-height', '0', 'important')
      const alto = hoja.getBoundingClientRect().height / mm
      return !alto || alto / ancho <= RATIO
    }

    // Se busca el ancho MÁS PEQUEÑO que cabe, o sea la reducción más suave
    // posible. El alto relativo solo baja al ensanchar, así que vale bisecar.
    let ancho = ANCHO_MM
    if (!cabe(ANCHO_MM)) {
      let corto = ANCHO_MM
      let largo = ANCHO_MM * 1.5
      while (largo < ANCHO_MM * 6 && !cabe(largo)) {
        corto = largo
        largo *= 1.5
      }
      for (let i = 0; i < 9 && largo - corto > 0.4; i++) {
        const medio = (corto + largo) / 2
        if (cabe(medio)) largo = medio
        else corto = medio
      }
      ancho = largo * 1.002
    }

    const escala = ANCHO_MM / ancho
    hoja.style.setProperty('width', `${ancho}mm`, 'important')
    // El pie sigue anclado abajo: la hoja mide una página completa a esta escala.
    hoja.style.setProperty('min-height', `${ALTO_MM / escala}mm`, 'important')
    capa.style.transformOrigin = 'top left'
    capa.style.transform = escala < 1 ? `scale(${escala})` : 'none'
  }, [])

  // Sin lista de dependencias: los datos, el logo y las fuentes llegan async.
  React.useLayoutEffect(() => {
    ajustar()
    let vivo = true
    const reajustar = () => { if (vivo) ajustar() }
    const tempo = window.setTimeout(reajustar, 150)
    document.fonts?.ready.then(reajustar).catch(() => {})
    const imagenes = Array.from(marcoRef.current?.querySelectorAll('img') ?? [])
    imagenes.forEach(im => { if (!im.complete) im.addEventListener('load', reajustar) })
    window.addEventListener('beforeprint', reajustar)
    return () => {
      vivo = false
      window.clearTimeout(tempo)
      imagenes.forEach(im => im.removeEventListener('load', reajustar))
      window.removeEventListener('beforeprint', reajustar)
    }
  })

  return (
    <div
      ref={marcoRef}
      style={{
        width: `${ANCHO_MM}mm`,
        height: `${ALTO_MM}mm`,
        overflow: 'hidden',
        background: '#ffffff',
        flex: 'none',
      }}
    >
      <div style={{ transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}
