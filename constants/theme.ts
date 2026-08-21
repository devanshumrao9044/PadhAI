// PadhAI design system with persisted dark/light palettes.

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

export const DarkColors: ThemeColors = {
  background: '#0A0A0F',
  surface: '#12121A',
  surfaceVariant: '#1C1C28',
  surfaceElevated: '#22223A',
  primary: '#8E78FF',
  primaryGlow: '#9B7FFF',
  primaryDim: '#4A3A9A',
  accent: '#4FC3F7',
  success: '#4CAF7D',
  danger: '#FF4757',
  dangerDim: '#7A1A22',
  warning: '#FFB547',
  warningDim: '#7A5A20',
  textPrimary: '#F1F1F6',
  textSecondary: '#8888AA',
  textTertiary: '#8A8AA0',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.15)',
  overlay: 'rgba(0,0,0,0.7)',
  levelBeginner: '#8888AA',
  levelGrinder: '#4FC3F7',
  levelConsistent: '#4CAF7D',
  levelBeast: '#FFB547',
  levelLegend: '#FFD700',
};

export const LightColors: ThemeColors = {
  background: '#F7F8FC',
  surface: '#FFFFFF',
  surfaceVariant: '#EEF0F7',
  surfaceElevated: '#FFFFFF',
  primary: '#6547E8',
  primaryGlow: '#816AF5',
  primaryDim: '#DCD6FF',
  accent: '#0D6E96',
  success: '#176B45',
  danger: '#B42336',
  dangerDim: '#F9D9DE',
  warning: '#8A4B00',
  warningDim: '#FBE5BF',
  textPrimary: '#171A24',
  textSecondary: '#3C4250',
  textTertiary: '#646D82',
  border: 'rgba(23,26,36,0.10)',
  borderStrong: 'rgba(23,26,36,0.18)',
  overlay: 'rgba(17,20,30,0.45)',
  levelBeginner: '#5A6272',
  levelGrinder: '#0D6E96',
  levelConsistent: '#176B45',
  levelBeast: '#8A4B00',
  levelLegend: '#805800',
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
