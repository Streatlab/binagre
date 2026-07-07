import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import ToastHost from '@/components/ui/ToastHost'
import ResponsiveTables from '@/components/ResponsiveTables'
import OcrCompletadoGlobal from '@/components/ocr/OcrCompletadoGlobal'
import OcrUploadToast from '@/components/ocr/OcrUploadToast'
import CommandPalette from '@/components/CommandPalette'
import { useEsMovil } from '@/hooks/useEsMovil'
import { useTheme } from '@/styles/tokens'

// Fondo del wrapper del ERP: crema en modo claro (mismo crema del sidebar).
const CREMA_WRAP = '#FCEFD6'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const movil = useEsMovil()
  const { isDark } = useTheme()
  const appBg = isDark ? 'var(--sl-app)' : CREMA_WRAP

  return (
    <div className="flex h-screen text-[var(--sl-text-primary)] font-sans" style={{ background: appBg }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className={`h-12 flex items-center px-4 border-b border-[var(--sl-border)] ${movil ? '' : 'md:hidden'}`}
          style={{ background: appBg }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)]"
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-[var(--sl-text-primary)] text-sm" style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}>STREAT LAB · ERP</span>
          <div style={{ marginLeft: 'auto' }}><ThemeToggle /></div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6" style={{ background: appBg }}>
          <Outlet />
        </main>
      </div>
      <ToastHost />
      <ResponsiveTables />
      <OcrUploadToast />
      <OcrCompletadoGlobal />
      <CommandPalette />
    </div>
  )
}
