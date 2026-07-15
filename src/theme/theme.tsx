import React, { createContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';

const colorScheme = Appearance.getColorScheme();

export const colors = {
  primary: '#5B67F5',
  primaryDark: '#3D47C7',
  primarySoft: '#EEF0FF',
  accent: '#FF6B9D',
  accentLight: '#FFE0EC',
  success: '#2ED47A',
  successLight: '#E0F8EF',
  warning: '#FFB546',
  warningLight: '#FFF4E0',
  danger: '#FF6B6B',
  dangerLight: '#FFE8E8',
  background: '#F8F9FE',
  backgroundDark: '#0B0E17',
  card: '#FFFFFF',
  cardDark: '#141827',
  text: '#0F141E',
  textDark: '#F1F3F8',
  muted: '#8E96A8',
  mutedDark: '#9EA6BB',
  border: '#E8ECF5',
  borderDark: '#252B3D',
  chip: '#F0F2F8',
  overlay: 'rgba(15, 23, 42, 0.5)',
  white: '#FFFFFF',
  black: '#000000',
  google: '#EA4335',
  shadow: 'rgba(91, 103, 245, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.15)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  soft: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  fab: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  deep: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 6,
  },
};

export const ThemeContext = createContext({
  mode: 'light',
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    muted: colors.muted,
    border: colors.border,
    primarySoft: colors.primarySoft,
  },
  toggle: () => {},
} as any);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState(colorScheme || 'light');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setMode(colorScheme || 'light'));
    return () => sub.remove();
  }, []);

  const toggle = () => setMode((m: string) => (m === 'light' ? 'dark' : 'light'));

  const theme = {
    mode,
    colors:
      mode === 'light'
        ? {
            primary: colors.primary,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            muted: colors.muted,
            border: colors.border,
            primarySoft: colors.primarySoft,
          }
        : {
            primary: '#7985FF',
            background: colors.backgroundDark,
            card: colors.cardDark,
            text: colors.textDark,
            muted: colors.mutedDark,
            border: colors.borderDark,
            primarySoft: '#1F2440',
          },
    toggle,
  };

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
