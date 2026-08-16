import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getItem, setItem } from '@/services/storage';
import { DarkColors, LightColors, ThemeColors } from '@/constants/theme';

export type ThemeMode = 'dark' | 'light';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_MODE_KEY = 'padhai_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    getItem<ThemeMode>(THEME_MODE_KEY).then(saved => {
      if (!mounted) return;
      if (saved === 'light' || saved === 'dark') setModeState(saved);
      setReady(true);
    }).catch(() => {
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    await setItem(THEME_MODE_KEY, nextMode);
  }, []);

  const toggleTheme = useCallback(async () => {
    await setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const colors = mode === 'dark' ? DarkColors : LightColors;
  const value = useMemo(() => ({ mode, colors, setMode, toggleTheme, ready }), [mode, colors, setMode, toggleTheme, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
  return context;
}

export function useThemeStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
