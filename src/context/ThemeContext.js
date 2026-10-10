import { createContext, useContext, useMemo, useState } from 'react';
import { darkColors, lightColors } from '../theme/colors';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [colorScheme, setColorScheme] = useState('light');

  const value = useMemo(() => {
    const colors = colorScheme === 'dark' ? darkColors : lightColors;

    return {
      colorScheme,
      colors,
      toggleTheme: () => setColorScheme((current) => (current === 'dark' ? 'light' : 'dark')),
    };
  }, [colorScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}