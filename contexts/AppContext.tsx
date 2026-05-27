import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem, StorageKeys } from '@/services/storage';
import {
  UserProfile, Subject, Chapter, Topic,
  FocusSession, DailySummary, XPTransaction, ActiveSession
} from '@/types/models';
import { calculateSessionXP, XP_REWARDS } from '@/constants/levels';

export type AppContextType = {
  // User
  user: UserProfile | null;
  isOnboarded: boolean;
  setUser: (u: UserProfile) => Promise<void>;
  setOnboarded: (v: boolean) => Promise<void>;

  // Subjects
  subjects: Subject[];
  addSubject: (name: string, colorHex: string, iconName: string) => Promise<Subject>;
  updateSubject: (id: string, data: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;

  // Chapters
  chapters: Chapter[];
  getChaptersForSubject: (subjectId: string) => Chapter[];
  addChapter: (subjectId: string, name: string, plannedDate?: string) => Promise<Chapter>;
  updateChapter: (id: string, data: Partial<Chapter>) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;

  // Topics
  topics: Topic[];
  getTopicsForChapter: (chapterId: string) => Topic[];
  addTopic: (chapterId: string, name: string) => Promise<Topic>;
  toggleTopic: (id: string) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;

  // Sessions
  sessions: FocusSession[];
  activeSession: ActiveSession | null;
  startSession: (plannedMins: number, subjectId: string | null, chapterId: string | null) => Promise<string>;
  completeSession: (sessionId: string, actualMins: number) => Promise<FocusSession>;
  breakSession: (sessionId: string, actualMins: number) => Promise<FocusSession>;

  // Daily summary
  getDailySummary: (date: string) => DailySummary | null;
  getLast7Days: () => DailySummary[];
  getLast90Days: () => DailySummary[];

  // XP & streaks
  xpLog: XPTransaction[];
  awardXP: (amount: number, reason: string) => Promise<void>;
  deductXP: (amount: number, reason: string) => Promise<void>;
  checkStreak: () => Promise<{ wasStreakBroken: boolean }>;

  // Loading
  isLoading: boolean;
  reload: () => Promise<void>;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboardedState] = useState(false);
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [xpLog, setXpLog] = useState<XPTransaction[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [
      onboarded, savedUser, savedSubjects, savedChapters,
      savedTopics, savedSessions, savedSummaries, savedXP, savedActive
    ] = await Promise.all([
      getItem<boolean>(StorageKeys.ONBOARDED),
      getItem<UserProfile>(StorageKeys.USER),
      getItem<Subject[]>(StorageKeys.SUBJECTS),
      getItem<Chapter[]>(StorageKeys.CHAPTERS),
      getItem<Topic[]>(StorageKeys.TOPICS),
      getItem<FocusSession[]>(StorageKeys.SESSIONS),
      getItem<DailySummary[]>(StorageKeys.DAILY_SUMMARY),
      getItem<XPTransaction[]>(StorageKeys.XP_LOG),
      getItem<ActiveSession>(StorageKeys.ACTIVE_SESSION),
    ]);
    setIsOnboardedState(onboarded ?? false);
    setUserState(savedUser);
    setSubjects(savedSubjects ?? []);
    setChapters(savedChapters ?? []);
    setTopics(savedTopics ?? []);
    setSessions(savedSessions ?? []);
    setDailySummaries(savedSummaries ?? []);
    setXpLog(savedXP ?? []);
    setActiveSession(savedActive ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── User ──────────────────────────────────────────────────────────
  const setUser = async (u: UserProfile) => {
    setUserState(u);
    await setItem(StorageKeys.USER, u);
  };

  const setOnboarded = async (v: boolean) => {
    setIsOnboardedState(v);
    await setItem(StorageKeys.ONBOARDED, v);
  };

  // ── Helpers ───────────────────────────────────────────────────────
  const persistSummary = async (updated: DailySummary[]) => {
    setDailySummaries(updated);
    await setItem(StorageKeys.DAILY_SUMMARY, updated);
  };

  const getOrCreateSummary = (date: string, summaries: DailySummary[], u: UserProfile): { summary: DailySummary; all: DailySummary[] } => {
    const existing = summaries.find(s => s.date === date);
    if (existing) return { summary: existing, all: summaries };
    const fresh: DailySummary = {
      id: uuidv4(), userId: u.id, date,
      totalMinutes: 0, sessionsCompleted: 0, sessionsBroken: 0,
      goalMinutes: u.dailyGoalMinutes, goalMet: false, xpEarned: 0,
    };
    return { summary: fresh, all: [...summaries, fresh] };
  };

  // ── XP ────────────────────────────────────────────────────────────
  const awardXP = async (amount: number, reason: string) => {
    if (!user) return;
    const tx: XPTransaction = { id: uuidv4(), userId: user.id, amount, reason, createdAt: new Date().toISOString() };
    const newLog = [tx, ...xpLog];
    setXpLog(newLog);
    await setItem(StorageKeys.XP_LOG, newLog);

    const updated = { ...user, xpTotal: user.xpTotal + amount };
    await setUser(updated);
  };

  const deductXP = async (amount: number, reason: string) => {
    if (!user) return;
    const tx: XPTransaction = { id: uuidv4(), userId: user.id, amount: -amount, reason, createdAt: new Date().toISOString() };
    const newLog = [tx, ...xpLog];
    setXpLog(newLog);
    await setItem(StorageKeys.XP_LOG, newLog);

    const updated = { ...user, xpTotal: Math.max(0, user.xpTotal - amount) };
    await setUser(updated);
  };

  // ── Streak ────────────────────────────────────────────────────────
  const checkStreak = async (): Promise<{ wasStreakBroken: boolean }> => {
    if (!user) return { wasStreakBroken: false };
    const today = todayStr();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const last = user.lastStudyDate;

    if (last === today) return { wasStreakBroken: false };
    if (last === yesterday) return { wasStreakBroken: false }; // streak intact, just not studied today yet

    // Missed a day (or never studied)
    if (last && last < yesterday) {
      const updated = { ...user, streakCurrent: 0 };
      await setUser(updated);
      return { wasStreakBroken: true };
    }
    return { wasStreakBroken: false };
  };

  // ── Subjects ──────────────────────────────────────────────────────
  const addSubject = async (name: string, colorHex: string, iconName: string): Promise<Subject> => {
    if (!user) throw new Error('No user');
    const s: Subject = {
      id: uuidv4(), userId: user.id, name, colorHex, iconName,
      displayOrder: subjects.length, createdAt: new Date().toISOString(), isDeleted: false,
    };
    const updated = [...subjects, s];
    setSubjects(updated);
    await setItem(StorageKeys.SUBJECTS, updated);
    return s;
  };

  const updateSubject = async (id: string, data: Partial<Subject>) => {
    const updated = subjects.map(s => s.id === id ? { ...s, ...data } : s);
    setSubjects(updated);
    await setItem(StorageKeys.SUBJECTS, updated);
  };

  const deleteSubject = async (id: string) => {
    const updated = subjects.map(s => s.id === id ? { ...s, isDeleted: true } : s);
    setSubjects(updated);
    await setItem(StorageKeys.SUBJECTS, updated);
  };

  // ── Chapters ──────────────────────────────────────────────────────
  const getChaptersForSubject = (subjectId: string) =>
    chapters.filter(c => c.subjectId === subjectId && !c.isDeleted)
      .sort((a, b) => a.displayOrder - b.displayOrder);

  const addChapter = async (subjectId: string, name: string, plannedDate?: string): Promise<Chapter> => {
    if (!user) throw new Error('No user');
    const existing = chapters.filter(c => c.subjectId === subjectId && !c.isDeleted);
    const c: Chapter = {
      id: uuidv4(), subjectId, userId: user.id, name,
      status: 'not_started', plannedDate: plannedDate ?? null,
      completedDate: null, displayOrder: existing.length,
      createdAt: new Date().toISOString(), isDeleted: false,
    };
    const updated = [...chapters, c];
    setChapters(updated);
    await setItem(StorageKeys.CHAPTERS, updated);
    return c;
  };

  const updateChapter = async (id: string, data: Partial<Chapter>) => {
    const updated = chapters.map(c => c.id === id ? { ...c, ...data } : c);
    setChapters(updated);
    await setItem(StorageKeys.CHAPTERS, updated);

    // XP for completing chapter
    if (data.status === 'done' && user) {
      await awardXP(XP_REWARDS.chapterComplete, 'chapter_done');
    }
  };

  const deleteChapter = async (id: string) => {
    const updated = chapters.map(c => c.id === id ? { ...c, isDeleted: true } : c);
    setChapters(updated);
    await setItem(StorageKeys.CHAPTERS, updated);
  };

  // ── Topics ────────────────────────────────────────────────────────
  const getTopicsForChapter = (chapterId: string) =>
    topics.filter(t => t.chapterId === chapterId && !t.isDeleted)
      .sort((a, b) => a.displayOrder - b.displayOrder);

  const addTopic = async (chapterId: string, name: string): Promise<Topic> => {
    const existing = topics.filter(t => t.chapterId === chapterId && !t.isDeleted);
    const t: Topic = {
      id: uuidv4(), chapterId, name, isDone: false,
      displayOrder: existing.length, isDeleted: false,
    };
    const updated = [...topics, t];
    setTopics(updated);
    await setItem(StorageKeys.TOPICS, updated);
    return t;
  };

  const toggleTopic = async (id: string) => {
    const updated = topics.map(t => t.id === id ? { ...t, isDone: !t.isDone } : t);
    setTopics(updated);
    await setItem(StorageKeys.TOPICS, updated);
  };

  const deleteTopic = async (id: string) => {
    const updated = topics.map(t => t.id === id ? { ...t, isDeleted: true } : t);
    setTopics(updated);
    await setItem(StorageKeys.TOPICS, updated);
  };

  // ── Focus Sessions ────────────────────────────────────────────────
  const startSession = async (plannedMins: number, subjectId: string | null, chapterId: string | null): Promise<string> => {
    const sessionId = uuidv4();
    const active: ActiveSession = {
      sessionId, startedAt: new Date().toISOString(), plannedMins, subjectId, chapterId,
    };
    setActiveSession(active);
    await setItem(StorageKeys.ACTIVE_SESSION, active);
    return sessionId;
  };

  const completeSession = async (sessionId: string, actualMins: number): Promise<FocusSession> => {
    if (!user) throw new Error('No user');
    const xp = calculateSessionXP(actualMins);
    const session: FocusSession = {
      id: sessionId, userId: user.id,
      subjectId: activeSession?.subjectId ?? null,
      chapterId: activeSession?.chapterId ?? null,
      durationPlannedMins: activeSession?.plannedMins ?? actualMins,
      durationActualMins: actualMins,
      completed: true, xpEarned: xp, xpDeducted: 0, brokenAtPercent: 100,
      sessionDate: todayStr(), createdAt: new Date().toISOString(),
    };

    const updatedSessions = [session, ...sessions];
    setSessions(updatedSessions);
    await setItem(StorageKeys.SESSIONS, updatedSessions);
    setActiveSession(null);
    await setItem(StorageKeys.ACTIVE_SESSION, null);

    // Update streak
    const today = todayStr();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak = user.streakCurrent;
    if (user.lastStudyDate !== today) {
      if (user.lastStudyDate === yesterday || user.lastStudyDate === null) {
        newStreak = user.streakCurrent + 1;
      } else {
        newStreak = 1;
      }
    }
    const longest = Math.max(newStreak, user.streakLongest);

    // Update daily summary
    const { summary, all } = getOrCreateSummary(today, dailySummaries, user);
    const newTotalMins = summary.totalMinutes + actualMins;
    const updatedSummary: DailySummary = {
      ...summary,
      totalMinutes: newTotalMins,
      sessionsCompleted: summary.sessionsCompleted + 1,
      goalMet: newTotalMins >= user.dailyGoalMinutes,
      xpEarned: summary.xpEarned + xp,
    };
    const updatedAll = all.map(s => s.date === today ? updatedSummary : s);
    if (!all.find(s => s.date === today)) updatedAll.push(updatedSummary);
    await persistSummary(updatedAll.map(s => s.date === today ? updatedSummary : s).concat(
      all.find(s => s.date === today) ? [] : [updatedSummary]
    ).filter((s, i, arr) => arr.findIndex(x => x.date === s.date) === i));

    // Check daily goal bonus
    let totalXP = xp;
    if (!summary.goalMet && updatedSummary.goalMet) {
      totalXP += XP_REWARDS.dailyGoalBonus;
    }

    const updatedUser = {
      ...user,
      xpTotal: user.xpTotal + totalXP,
      streakCurrent: newStreak,
      streakLongest: longest,
      lastStudyDate: today,
    };
    await setUser(updatedUser);

    // Log XP
    const tx: XPTransaction = { id: uuidv4(), userId: user.id, amount: totalXP, reason: 'session_complete', createdAt: new Date().toISOString() };
    const newLog = [tx, ...xpLog];
    setXpLog(newLog);
    await setItem(StorageKeys.XP_LOG, newLog);

    return session;
  };

  const breakSession = async (sessionId: string, actualMins: number): Promise<FocusSession> => {
    if (!user) throw new Error('No user');
    const planned = activeSession?.plannedMins ?? 1;
    const brokenAt = Math.floor((actualMins / planned) * 100);
    const sessionXP = calculateSessionXP(planned);
    const penalty = Math.floor(sessionXP * XP_REWARDS.sessionBrokenMultiplier);

    const session: FocusSession = {
      id: sessionId, userId: user.id,
      subjectId: activeSession?.subjectId ?? null,
      chapterId: activeSession?.chapterId ?? null,
      durationPlannedMins: planned,
      durationActualMins: actualMins,
      completed: false, xpEarned: 0, xpDeducted: penalty, brokenAtPercent: brokenAt,
      sessionDate: todayStr(), createdAt: new Date().toISOString(),
    };

    const updatedSessions = [session, ...sessions];
    setSessions(updatedSessions);
    await setItem(StorageKeys.SESSIONS, updatedSessions);
    setActiveSession(null);
    await setItem(StorageKeys.ACTIVE_SESSION, null);

    // Update daily summary
    const today = todayStr();
    const { summary, all } = getOrCreateSummary(today, dailySummaries, user);
    const updatedSummary: DailySummary = {
      ...summary,
      sessionsBroken: summary.sessionsBroken + 1,
    };
    await persistSummary(all.map(s => s.date === today ? updatedSummary : s).concat(
      all.find(s => s.date === today) ? [] : [updatedSummary]
    ).filter((s, i, arr) => arr.findIndex(x => x.date === s.date) === i));

    // Reset streak
    const updatedUser = {
      ...user,
      xpTotal: Math.max(0, user.xpTotal - penalty),
      streakCurrent: 0,
    };
    await setUser(updatedUser);

    // Log XP deduction
    if (penalty > 0) {
      const tx: XPTransaction = { id: uuidv4(), userId: user.id, amount: -penalty, reason: 'session_broken', createdAt: new Date().toISOString() };
      const newLog = [tx, ...xpLog];
      setXpLog(newLog);
      await setItem(StorageKeys.XP_LOG, newLog);
    }

    return session;
  };

  // ── Analytics ─────────────────────────────────────────────────────
  const getDailySummary = (date: string) => dailySummaries.find(s => s.date === date) ?? null;

  const getLast7Days = () => {
    const result: DailySummary[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      result.push(dailySummaries.find(s => s.date === d) ?? {
        id: '', userId: '', date: d, totalMinutes: 0,
        sessionsCompleted: 0, sessionsBroken: 0,
        goalMinutes: user?.dailyGoalMinutes ?? 120, goalMet: false, xpEarned: 0,
      });
    }
    return result;
  };

  const getLast90Days = () => {
    const result: DailySummary[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      result.push(dailySummaries.find(s => s.date === d) ?? {
        id: '', userId: '', date: d, totalMinutes: 0,
        sessionsCompleted: 0, sessionsBroken: 0,
        goalMinutes: user?.dailyGoalMinutes ?? 120, goalMet: false, xpEarned: 0,
      });
    }
    return result;
  };

  return (
    <AppContext.Provider value={{
      user, isOnboarded, setUser, setOnboarded,
      subjects, addSubject, updateSubject, deleteSubject,
      chapters, getChaptersForSubject, addChapter, updateChapter, deleteChapter,
      topics, getTopicsForChapter, addTopic, toggleTopic, deleteTopic,
      sessions, activeSession, startSession, completeSession, breakSession,
      getDailySummary, getLast7Days, getLast90Days,
      xpLog, awardXP, deductXP, checkStreak,
      isLoading, reload: load,
    }}>
      {children}
    </AppContext.Provider>
  );
}
