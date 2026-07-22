import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

// Botón cuadrado neobrutal 40x40 SIN sombra (CANTERA ALEGRE: el cromo del sidebar no lleva sombra).
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        background: 'transparent',
        border: '3px solid #0a0a0a',
        borderRadius: 0,
        padding: 0,
        cursor: 'pointer',
        color: '#FF2E63',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        transition: 'background 0.15s',
      }}
    >
      {isDark ? <Sun size={20} strokeWidth={2.2} /> : <Moon size={20} strokeWidth={2.2} />}
    </button>
  )
}
