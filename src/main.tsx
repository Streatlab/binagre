import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/responsive-movil.css'
import './styles/sl.css'
import './styles/sl-movil.css'
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

createRoot(document.getElementById('root')!).render(
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
