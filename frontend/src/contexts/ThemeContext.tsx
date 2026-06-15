'use client';
import { createContext, useContext, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme:       Theme;
  toggleTheme: () => void;
  isDark:      boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:       'dark',
  toggleTheme: () => {},
  isDark:      true,
});

// Algora is a dark-only theme. The provider keeps the same API (so any
// useTheme() consumer keeps working) but is permanently locked to dark.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme: Theme = 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('psp-theme', 'dark'); } catch {}
  }, []);

  function toggleTheme() { /* no-op: dark-only theme */ }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
