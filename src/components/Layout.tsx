import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[var(--sl-app)] text-[var(--sl-text-primary)] font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center px-4 border-b border-[var(--sl-border)] bg-[var(--sl-sidebar)] lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[var(--sl-text-muted)] hover:text-[var(--sl-text-primary)]"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-[var(--sl-text-primary)] text-sm" style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}>STREAT LAB · ERP</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
