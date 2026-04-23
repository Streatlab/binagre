import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ModoIVA = 'sin' | 'con'

const LS_KEY = 'erp_modo_iva'

interface IVACtx {
  modo: ModoIVA
  setModo: (m: ModoIVA) => void
  /** Devuelve 'base_imponible' si sin, 'importe' si con */
  campoImporte: () => 'base_imponible' | 'importe'
}

const IVAContext = createContext<IVACtx>({
  modo: 'sin',
  setModo: () => {},
  campoImporte: () => 'base_imponible',
})

export function IVAProvider({ children }: { children: ReactNode }) {
  const [modo, setModoState] = useState<ModoIVA>(() => {
    if (typeof window === 'undefined') return 'sin'
    return (localStorage.getItem(LS_KEY) as ModoIVA) || 'sin'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_KEY, modo)
  }, [modo])

  const setModo = (m: ModoIVA) => setModoState(m)
  const campoImporte = () => (modo === 'sin' ? 'base_imponible' : 'importe')

  return (
    <IVAContext.Provider value={{ modo, setModo, campoImporte }}>
      {children}
    </IVAContext.Provider>
  )
}

export const useIVA = () => useContext(IVAContext)
