export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  targetExam: 'JEE' | 'NEET' | 'BOARDS' | 'OTHER';
  classLevel: '11' | '12' | 'Dropper';
  dailyGoalMinutes: number;
  xpTotal: number;
  streakCurrent: number;
  streakLongest: number;
  lastStudyDate: string | null;
  createdAt: string;
  avatarUrl?: string | null;
  myReferralCode?: string | null;
  referredBy?: string | null;
  hasUnlockedReward?: boolean;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  colorHex: string;
  iconName: string;
  displayOrder: number;
  createdAt: string;
  isDeleted: boolean;
}

export interface Chapter {
  id: string;
  subjectId: string;
  userId: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'done' | 'weak';
  plannedDate: string | null;
  completedDate: string | null;
  displayOrder: number;
  createdAt: string;
  isDeleted: boolean;
}

export interface Topic {
  id: string;
  chapterId: string;
  name: string;
  isDone: boolean;
  displayOrder: number;
  isDeleted: boolean;
}

export interface FocusSession {
  id: string;
  userId: string;
  subjectId: string | null;
  chapterId: string | null;
  durationPlannedMins: number;
  durationActualMins: number;
  completed: boolean;
  xpEarned: number;
  xpDeducted: number;
  brokenAtPercent: number;
  comebackBonus?: number;
  sessionDate: string;
  createdAt: string;
}

export interface DailySummary {
  id: string;
  userId: string;
  date: string;
  totalMinutes: number;
  sessionsCompleted: number;
  sessionsBroken: number;
  goalMinutes: number;
  goalMet: boolean;
  xpEarned: number;
}

export interface XPTransaction {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface ActiveSession {
  sessionId: string;
  startedAt: string;
  plannedMins: number;
  subjectId: string | null;
  chapterId: string | null;
}

export interface Referral {
  id: string;
  referrerId: string;
  refereeId: string;
  status: 'pending' | 'completed';
  xpAwarded: boolean;
  createdAt: string;
  completedAt: string | null;
}
