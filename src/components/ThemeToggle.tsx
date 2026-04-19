import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        background: 'none',
        border: '1px solid var(--sl-border)',
        borderRadius: '20px',
        padding: '4px 10px',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontFamily: 'Oswald, sans-serif',
        letterSpacing: '1px',
        color: 'var(--sl-text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        minHeight: '32px',
        transition: 'border-color 0.15s',
      }}
    >
      {theme === 'dark' ? '☀ CLARO' : '☽ OSCURO'}
    </button>
  );
}
