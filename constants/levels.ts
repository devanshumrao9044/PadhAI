// XP Level System

export interface LevelDef {
  minXP: number;
  maxXP: number;
  realisticTitle: string;
  examTitle: string;
  color: string;
  rank: number;
}

export const LEVELS: LevelDef[] = [
  { rank: 1, minXP: 0,    maxXP: 99,   realisticTitle: 'Beginner',    examTitle: 'Fresher',          color: '#64748B' },
  { rank: 2, minXP: 100,  maxXP: 499,  realisticTitle: 'Grinder',     examTitle: 'Class 11',         color: '#0E7490' },
  { rank: 3, minXP: 500,  maxXP: 1499, realisticTitle: 'Consistent',  examTitle: 'Class 12',         color: '#166534' },
  { rank: 4, minXP: 1500, maxXP: 3999, realisticTitle: 'Beast',       examTitle: 'Dropper',          color: '#A16207' },
  { rank: 5, minXP: 4000, maxXP: 9999, realisticTitle: 'Legend',      examTitle: 'IITian / Doctor',  color: '#92400E' },
];

export function getLevelForXP(xp: number): LevelDef {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getLevelForRank(rank: number): LevelDef {
  const safeRank = Math.min(Math.max(1, Math.floor(rank)), LEVELS.length);
  return LEVELS[safeRank - 1] ?? LEVELS[0];
}

export function getLevelForUser(user: { xpTotal: number; levelRank?: number }): LevelDef {
  return user.levelRank ? getLevelForRank(user.levelRank) : getLevelForXP(user.xpTotal);
}

export function getXPProgressForLevel(xp: number, levelRank: number): { current: number; needed: number; progress: number } {
  const level = getLevelForRank(levelRank);
  const current = Math.max(0, Math.min(xp, level.maxXP - level.minXP + 1));
  const needed = level.maxXP - level.minXP + 1;
  return { current, needed, progress: Math.min(current / needed, 1) };
}

export function getXPProgressForUser(user: { xpTotal: number; levelRank?: number }): { current: number; needed: number; progress: number } {
  return user.levelRank ? getXPProgressForLevel(user.xpTotal, user.levelRank) : getXPProgress(user.xpTotal);
}

export function getXPProgress(xp: number): { current: number; needed: number; progress: number } {
  const level = getLevelForXP(xp);
  const current = xp - level.minXP;
  const needed = level.maxXP - level.minXP + 1;
  return { current, needed, progress: Math.min(current / needed, 1) };
}

export function calculateSessionXP(durationMins: number): number {
  return Math.floor((durationMins / 5) * 10);
}

export const XP_REWARDS = {
  chapterComplete: 30,
  dailyGoalBonus: 50,
  sessionBrokenMultiplier: 0.5, // deduct 50% of session XP
};

export const SUBJECT_COLORS = [
  '#0D9488', '#14B8A6', '#0F766E', '#EA580C', '#C2410C',
  '#2DD4BF', '#0E7490', '#166534', '#A16207', '#92400E',
];

export const SUBJECT_ICONS = [
  'book', 'science', 'calculate', 'biotech', 'history-edu',
  'language', 'computer', 'sports-cricket', 'music-note', 'palette',
];
