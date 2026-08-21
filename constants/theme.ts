export type ThemeColors = {
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceElevated: string;
  primary: string;
  primaryGlow: string;
  primaryDim: string;
  accent: string;
  success: string;
  danger: string;
  dangerDim: string;
  warning: string;
  warningDim: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  overlay: string;
  levelBeginner: string;
  levelGrinder: string;
  levelConsistent: string;
  levelBeast: string;
  levelLegend: string;
};

/** PadhAI dark palette: calm teal surfaces with orange reserved for achievements and emphasis. */
export const DarkColors: ThemeColors = {
  background: '#071A1B',
  surface: '#0D2526',
  surfaceVariant: '#123335',
  surfaceElevated: '#174040',
  primary: '#2DD4BF',
  primaryGlow: '#5EEAD4',
  primaryDim: '#155E5A',
  accent: '#FB923C',
  success: '#79D9A7',
  danger: '#FCA5A5',
  dangerDim: '#482328',
  warning: '#FDE68A',
  warningDim: '#4A3817',
  textPrimary: '#E6FFFB',
  textSecondary: '#C3DEDA',
  textTertiary: '#B1D0CB',
  border: 'rgba(230,255,251,0.12)',
  borderStrong: 'rgba(230,255,251,0.22)',
  overlay: 'rgba(0,0,0,0.72)',
  levelBeginner: '#7F9E99',
  levelGrinder: '#67E8F9',
  levelConsistent: '#59C894',
  levelBeast: '#FDBA74',
  levelLegend: '#FCD34D',
};

/** PadhAI light palette: soft mint background with readable ink and semantic accent colours. */
export const LightColors: ThemeColors = {
  background: '#F0FDFA',
  surface: '#FFFFFF',
  surfaceVariant: '#E8F1F4',
  surfaceElevated: '#FFFFFF',
  primary: '#0F766E',
  primaryGlow: '#14B8A6',
  primaryDim: '#CCFBF1',
  accent: '#C2410C',
  success: '#166534',
  danger: '#B91C1C',
  dangerDim: '#FEE2E2',
  warning: '#92400E',
  warningDim: '#FEF3C7',
  textPrimary: '#134E4A',
  textSecondary: '#475569',
  textTertiary: '#52616F',
  border: 'rgba(19,78,74,0.14)',
  borderStrong: 'rgba(19,78,74,0.24)',
  overlay: 'rgba(15,23,42,0.45)',
  levelBeginner: '#64748B',
  levelGrinder: '#0E7490',
  levelConsistent: '#166534',
  levelBeast: '#A16207',
  levelLegend: '#92400E',
};

// Kept for non-React helpers and as the default palette for legacy imports.
export const Colors = DarkColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 36,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
};
