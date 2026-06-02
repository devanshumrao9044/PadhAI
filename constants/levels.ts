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
  { rank: 1, minXP: 0,    maxXP: 99,   realisticTitle: 'Beginner',    examTitle: 'Fresher',          color: '#8888AA' },
  { rank: 2, minXP: 100,  maxXP: 499,  realisticTitle: 'Grinder',     examTitle: 'Class 11',         color: '#4FC3F7' },
  { rank: 3, minXP: 500,  maxXP: 1499, realisticTitle: 'Consistent',  examTitle: 'Class 12',         color: '#4CAF7D' },
  { rank: 4, minXP: 1500, maxXP: 3999, realisticTitle: 'Beast',       examTitle: 'Dropper',          color: '#FFB547' },
  { rank: 5, minXP: 4000, maxXP: 9999, realisticTitle: 'Legend',      examTitle: 'IITian / Doctor',  color: '#FFD700' },
];

export function getLevelForXP(xp: number): LevelDef {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
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
  '#7C5CFC', '#4FC3F7', '#4CAF7D', '#FFB547', '#FF4757',
  '#FF6B9D', '#00D4AA', '#A78BFA', '#FB923C', '#34D399',
];

export const SUBJECT_ICONS = [
  'book', 'science', 'calculate', 'biotech', 'history-edu',
  'language', 'computer', 'sports-cricket', 'music-note', 'palette',
];
