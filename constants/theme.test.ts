import test from 'node:test';
import assert from 'node:assert/strict';
import { DarkColors, LightColors } from './theme.ts';

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test('shared theme text and status colors meet readable contrast across surfaces', () => {
  for (const [name, palette] of [['dark', DarkColors], ['light', LightColors] ] as const) {
    for (const foreground of ['textPrimary', 'textSecondary', 'textTertiary', 'primary', 'accent', 'success', 'danger', 'warning'] as const) {
      for (const background of ['background', 'surface', 'surfaceVariant', 'surfaceElevated'] as const) {
        assert.ok(
          contrast(palette[foreground], palette[background]) >= 4.5,
          `${name}: ${foreground} on ${background} is below 4.5:1`,
        );
      }
    }
  }
});

test('primary action foreground is readable in both themes', () => {
  assert.ok(contrast(DarkColors.background, DarkColors.primary) >= 4.5);
  assert.ok(contrast(LightColors.background, LightColors.primary) >= 4.5);
});
