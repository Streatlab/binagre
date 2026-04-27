import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { IVAProvider } from './contexts/IVAContext'
import { CalendarioProvider } from './contexts/CalendarioContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <IVAProvider>
        <CalendarioProvider>
          <App />
        </CalendarioProvider>
      </IVAProvider>
    </ThemeProvider>
  </StrictMode>,
)
