import { useEffect, useState } from 'react'

const KEY = 'sidebar_collapsed'
const EVT = 'sidebar-toggle'

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(KEY) === 'true'
  })

  useEffect(() => {
    const h = () => setCollapsed(localStorage.getItem(KEY) === 'true')
    window.addEventListener(EVT, h)
    return () => window.removeEventListener(EVT, h)
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(KEY, String(next))
    window.dispatchEvent(new Event(EVT))
  }

  return { collapsed, toggle }
}
