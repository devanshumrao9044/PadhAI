/**
 * Legacy colour adapter for components that still use useThemeColor.
 * Keep these values aligned with constants/theme.ts so older screens do not
 * drift away from the current PadhAI visual system.
 */

export const Colors = {
  light: {
    text: '#134E4A',
    background: '#F0FDFA',
    tint: '#0F766E',
    icon: '#475569',
    tabIconDefault: '#64748B',
    tabIconSelected: '#0F766E',
  },
  dark: {
    text: '#E6FFFB',
    background: '#071A1B',
    tint: '#2DD4BF',
    icon: '#A7C7C3',
    tabIconDefault: '#7F9E99',
    tabIconSelected: '#2DD4BF',
  },
};
