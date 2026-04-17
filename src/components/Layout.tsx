import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center px-4 border-b border-[#dddddd] lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[#555] hover:text-[#1a1a1a]"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-[#1a1a1a] font-semibold text-sm">Streat Lab</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
