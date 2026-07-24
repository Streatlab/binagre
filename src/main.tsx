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

// ── CANDADO DE DISPOSITIVO ────────────────────────────────────────────────
// La primera vez que un dispositivo abre /fichaje queda marcado como TABLET DE
// FICHAJE. Desde ese momento, cualquier dirección del ERP que se escriba en ese
// navegador vuelve sola al fichaje: no hay forma de llegar al resto de la
// aplicación desde la tablet. El candado solo se suelta desde el propio fichaje
// con el PIN de administración.
const QUIOSCO_KEY = 'sl_dispositivo_quiosco'
const enFichaje = window.location.pathname.startsWith('/fichaje')
let dispositivoBloqueado = false
try { dispositivoBloqueado = localStorage.getItem(QUIOSCO_KEY) === '1' } catch { dispositivoBloqueado = false }

if (enFichaje) {
  try { localStorage.setItem(QUIOSCO_KEY, '1') } catch { /* sin almacenamiento, sigue funcionando */ }
} else if (dispositivoBloqueado) {
  window.location.replace('/fichaje')
}

const FichajeKiosco = lazy(() => import('./pages/Fichaje'))
const raiz = createRoot(document.getElementById('root')!)

if (enFichaje) {
  // La tablet no monta el router del ERP, ni la sesión, ni el menú: solo el fichaje.
  raiz.render(
    <StrictMode>
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FCEFD6' }} />}>
        <FichajeKiosco />
      </Suspense>
    </StrictMode>,
  )
} else if (!dispositivoBloqueado) {
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
