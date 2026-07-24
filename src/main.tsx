import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/responsive-movil.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { IVAProvider } from './contexts/IVAContext'
import { CalendarioProvider } from './contexts/CalendarioContext'
import { ConfigProvider } from './contexts/ConfigContext'

// PWA: registrar el service worker (necesario para poder instalar la app).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin PWA, la web sigue funcionando */ })
  })
}

// QUIOSCO DE FICHAJE (/fichaje): se monta ANTES que el ERP y aparte de él.
// La tablet del restaurante no carga router, ni sesión, ni menú: solo el fichaje.
// Así el equipo no puede llegar a ninguna otra pantalla desde ese dispositivo.
const FichajeKiosco = lazy(() => import('./pages/Fichaje'))
const esQuiosco = window.location.pathname.startsWith('/fichaje')

const raiz = createRoot(document.getElementById('root')!)

if (esQuiosco) {
  raiz.render(
    <StrictMode>
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FCEFD6' }} />}>
        <FichajeKiosco />
      </Suspense>
    </StrictMode>,
  )
} else {
  raiz.render(
    <StrictMode>
      <ThemeProvider>
        <IVAProvider>
          <CalendarioProvider>
            <ConfigProvider>
              <App />
            </ConfigProvider>
          </CalendarioProvider>
        </IVAProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}
