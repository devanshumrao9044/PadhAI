export function formatXPValue(xp: number): string {
  if (xp < 0) return '0';
  if (xp >= 1000) {
    return (xp / 1000).toFixed(xp % 1000 === 0 ? 0 : 1) + 'k';
  }
  return xp.toLocaleString();
}

export function isNegativeXP(xp: number): boolean {
  return xp < 0;
}
