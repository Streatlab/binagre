import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

type Theme = 'dark' | 'light' | 'foodpop' | 'darkops';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', toggleTheme: () => {}, setTheme: () => {} });

/* ── Automatismo horario (horario de Madrid, con verano/invierno) ──────────
   Verano (DST Madrid):  oscuro a las 21:00 · claro a las 07:00
   Invierno:             oscuro a las 18:00 · claro a las 07:00
   El cambio se aplica solo al CRUZAR el umbral, así que el usuario puede
   revertir manualmente con el botón y se respeta hasta el siguiente cruce. */

function partesMadrid(date: Date) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  let h = parseInt(p.hour, 10);
  if (h === 24) h = 0;
  return { y: +p.year, mo: +p.month, d: +p.day, h, mi: +p.minute };
}

function offsetMadridMin(date: Date): number {
  const p = partesMadrid(date);
  const asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  return Math.round((asUTC - date.getTime()) / 60000);
}

function esVeranoMadrid(date: Date): boolean {
  const enero = new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 12));
  return offsetMadridMin(date) > offsetMadridMin(enero);
}

// Devuelve la franja que toca ahora mismo: 'dark' u 'light'
function franjaHoraria(date: Date): 'dark' | 'light' {
  const { h } = partesMadrid(date);
  const umbralOscuro = esVeranoMadrid(date) ? 21 : 18;
  return (h >= umbralOscuro || h < 7) ? 'dark' : 'light';
}

const FRANJA_LS_KEY = 'sl-auto-franja';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const getDefaultTheme = (): Theme => {
    const saved = localStorage.getItem('sl-theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark';
  };

  const [theme, setThemeState] = useState<Theme>(getDefaultTheme);
  const franjaRef = useRef<string | null>(null);

  const setTheme = (t: Theme) => setThemeState(t);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark' || theme === 'light') localStorage.setItem('sl-theme', theme);
  }, [theme]);

  // Automatismo: aplica la franja al montar y en cada cruce de umbral.
  useEffect(() => {
    const aplicar = () => {
      const franja = franjaHoraria(new Date());
      const guardada = localStorage.getItem(FRANJA_LS_KEY);
      franjaRef.current = franja;
      // Solo fuerza el tema cuando la franja cambia respecto a la última vista.
      if (guardada !== franja) {
        localStorage.setItem(FRANJA_LS_KEY, franja);
        setThemeState(prev => (prev === 'foodpop' || prev === 'darkops') ? prev : franja);
      }
    };
    aplicar();
    const id = setInterval(aplicar, 60000);
    return () => clearInterval(id);
  }, []);

  const toggleTheme = () => setThemeState(t => (t === 'dark' || t === 'darkops') ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
