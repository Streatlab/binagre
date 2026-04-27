import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { IVAProvider } from './contexts/IVAContext'
import { CalendarioProvider } from './contexts/CalendarioContext'
import { ConfigProvider } from './contexts/ConfigContext'

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
