import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem, removeItem, StorageKeys } from '@/services/storage';
import { supabase } from '@/services/supabase';
import {
  UserProfile, Subject, Chapter, Topic,
  FocusSession, DailySummary, XPTransaction, ActiveSession
} from '@/types/models';
import { calculateSessionXP, XP_REWARDS, getLevelForXP } from '@/constants/levels';

export type AppContextType = {
  comebackPending: boolean;
  setComebackPending: (v: boolean) => void;
  user: UserProfile | null;
  isOnboarded: boolean;
  setUser: (u: UserProfile) => Promise<void>;
  setOnboarded: (v: boolean) => Promise<void>;
  subjects: Subject[];
  addSubject: (name: string, colorHex: string, iconName: string) => Promise<Subject>;
  updateSubject: (id: string, data: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  chapters: Chapter[];
  getChaptersForSubject: (subjectId: string) => Chapter[];
  addChapter: (subjectId: string, name: string, plannedDate?: string | null) => Promise<Chapter>;
  updateChapter: (id: string, data: Partial<Chapter>) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  bulkDeleteChapters: (ids: string[]) => Promise<void>;
  topics: Topic[];
  getTopicsForChapter: (chapterId: string) => Topic[];
  addTopic: (chapterId: string, name: string) => Promise<Topic>;
  toggleTopic: (id: string) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  sessions: FocusSession[];
  activeSession: ActiveSession | null;
  startSession: (plannedMins: number, subjectId: string | null, chapterId: string | null) => Promise<string>;
  completeSession: (sessionId: string, actualMins: number) => Promise<(FocusSession & { leveledUp?: boolean; newLevelRank?: number }) | null>;
  breakSession: (sessionId: string, actualMins: number) => Promise<FocusSession | null>;
  getDailySummary: (date: string) => DailySummary | null;
  getLast7Days: () => DailySummary[];
  getLast90Days: () => DailySummary[];
  xpLog: XPTransaction[];
  awardXP: (amount: number, reason: string) => Promise<void>;
  deductXP: (amount: number, reason: string) => Promise<void>;
  checkStreak: () => Promise<{ wasStreakBroken: boolean }>;
  isLoading: boolean;
  reload: () => Promise<void>;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── Data Mappers ──────────────────────────────────────────────────────────────
const mapUser = (u: any): UserProfile => ({
  id: u.id,
  username: u.email?.split('@')[0] ?? 'student',
  fullName: u.name ?? 'Student',
  targetExam: u.target_exam ?? 'JEE',
  classLevel: u.class ?? '12',
  dailyGoalMinutes: u.daily_goal_minutes ?? 120,
  xpTotal: u.xp ?? 0,
  streakCurrent: u.streak ?? 0,
  streakLongest: u.longest_streak ?? 0,
  lastStudyDate: u.last_study_date ?? null,
  createdAt: u.created_at ?? new Date().toISOString(),
});

const mapSubject = (s: any): Subject => ({
  id: s.id,
  userId: s.user_id,
  name: s.name,
  colorHex: s.color_hex,
  iconName: s.icon_name,
  displayOrder: s.display_order,
  createdAt: s.created_at,
  isDeleted: s.is_deleted,
});

const mapChapter = (c: any): Chapter => ({
  id: c.id,
  subjectId: c.subject_id,
  userId: c.user_id,
  name: c.name,
  status: c.status,
  plannedDate: c.planned_date,
  completedDate: c.completed_date,
  displayOrder: c.display_order,
  createdAt: c.created_at,
  isDeleted: c.is_deleted,
});

const mapSession = (s: any): FocusSession => ({
  comebackBonus: s.comeback_bonus ?? 0,
  id: s.id,
  userId: s.user_id,
  subjectId: s.subject_id,
  chapterId: s.chapter_id ?? null,
  durationPlannedMins: s.planned_minutes,
  durationActualMins: s.actual_minutes,
  completed: !s.broken,
  xpEarned: s.xp_earned,
  xpDeducted: s.xp_deducted,
  brokenAtPercent: s.broken_at_percent ?? (s.broken ? 0 : 100),
  sessionDate: s.started_at ? s.started_at.split('T')[0] : todayStr(),
  createdAt: s.created_at,
});

const mapSummary = (s: any): DailySummary => ({
  id: s.id,
  userId: s.user_id,
  date: s.date,
  totalMinutes: s.total_focus_minutes,
  sessionsCompleted: s.sessions_completed,
  sessionsBroken: s.sessions_broken,
  goalMinutes: s.goal_minutes,
  goalMet: s.goal_met,
  xpEarned: s.xp_earned,
});

const mapXP = (x: any): XPTransaction => ({
  id: x.id,
  userId: x.user_id,
  amount: x.amount,
  reason: x.reason,
  createdAt: x.created_at,
});

// ── Offline Queue ─────────────────────────────────────────────────────────────
const OFFLINE_QUEUE_KEY = '@app_offline_sync_queue';
type SyncTask = {
  id: string;
  table: string;
  action: 'insert' | 'upsert' | 'update';
  payload: any;
  matchKey?: string;
  matchValue?: any;
};

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
  const [comebackPending, setComebackPendingState] = useState(false);

  const addToSyncQueue = async (task: Omit<SyncTask, 'id'>) => {
    const existingQueue = (await getItem<SyncTask[]>(OFFLINE_QUEUE_KEY)) || [];
    const newTask = { ...task, id: uuidv4() };
    await setItem(OFFLINE_QUEUE_KEY, [...existingQueue, newTask]);
  };

  const processSyncQueue = async () => {
    try {
      const queue = await getItem<SyncTask[]>(OFFLINE_QUEUE_KEY);
      if (!queue || queue.length === 0) return;
      let remainingQueue = [...queue];
      for (const task of queue) {
        try {
          if (task.action === 'insert') {
            const { error } = await supabase.from(task.table).insert(task.payload);
            if (error) throw error;
          } else if (task.action === 'upsert') {
            const conflictKey = task.table === 'daily_summary' ? 'user_id,date' : 'id';
            const { error } = await supabase.from(task.table).upsert(task.payload, { onConflict: conflictKey });
            if (error) throw error;
          } else if (task.action === 'update' && task.matchKey) {
            const { error } = await supabase.from(task.table).update(task.payload).eq(task.matchKey, task.matchValue);
            if (error) throw error;
          }
          remainingQueue = remainingQueue.filter(t => t.id !== task.id);
        } catch {
          break;
        }
      }
      await setItem(OFFLINE_QUEUE_KEY, remainingQueue);
    } catch (e) {
      console.error('[Sync] Manager error:', e);
    }
  };

  // ── Core Load ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [savedTopics, savedActive, savedSessions, savedSummaries, savedXP] = await Promise.all([
        getItem<Topic[]>(StorageKeys.TOPICS),
        getItem<ActiveSession>(StorageKeys.ACTIVE_SESSION),
        getItem<FocusSession[]>(StorageKeys.SESSIONS),
        getItem<DailySummary[]>(StorageKeys.DAILY_SUMMARY),
        getItem<XPTransaction[]>(StorageKeys.XP_LOG),
      ]);

      setTopics(savedTopics ?? []);
      setActiveSession(savedActive ?? null);
      if (savedSessions) setSessions(savedSessions);
      if (savedSummaries) setDailySummaries(savedSummaries);
      if (savedXP) setXpLog(savedXP);

      await processSyncQueue();

      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const userId = authData.user.id;

        // Load user profile from DB
        const { data: profileData } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileData) {
          const mappedUser = mapUser({ ...profileData, email: authData.user.email });
          setUserState(mappedUser);
          setIsOnboardedState(!!(profileData.name && profileData.name !== 'Student'));
          await setItem(StorageKeys.USER, mappedUser);
        }

        const [subRes, chapRes, sessRes, sumRes, xpRes] = await Promise.all([
          supabase.from('subjects').select('*').eq('user_id', userId).eq('is_deleted', false).order('display_order', { ascending: true }),
          supabase.from('chapters').select('*').eq('user_id', userId).eq('is_deleted', false).order('display_order', { ascending: true }),
          supabase.from('focus_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(200),
          supabase.from('daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(100),
          supabase.from('xp_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        ]);

        if (subRes.data) setSubjects(subRes.data.map(mapSubject));
        if (chapRes.data) setChapters(chapRes.data.map(mapChapter));
        if (sessRes.data) {
          const cloudSess = sessRes.data.map(mapSession);
          setSessions(cloudSess);
          setItem(StorageKeys.SESSIONS, cloudSess);
        }
        if (sumRes.data) {
          const cloudSum = sumRes.data.map(mapSummary);
          setDailySummaries(cloudSum);
          setItem(StorageKeys.DAILY_SUMMARY, cloudSum);
        }
        if (xpRes.data) {
          const cloudXP = xpRes.data.map(mapXP);
          setXpLog(cloudXP);
          setItem(StorageKeys.XP_LOG, cloudXP);
        }
      }
    } catch (err) {
      console.warn('Cloud load failed, operating in offline mode.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') processSyncQueue();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        load();
      } else if (event === 'SIGNED_OUT') {
        setUserState(null);
        setIsOnboardedState(false);
        setSubjects([]);
        setChapters([]);
        setTopics([]);
        setSessions([]);
        setDailySummaries([]);
        setXpLog([]);
        setActiveSession(null);
        await removeItem(StorageKeys.USER);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, [load]);

  // ── setUser: sync to Supabase ─────────────────────────────────────────────
  const setUser = async (u: UserProfile) => {
    setUserState(u);
    await setItem(StorageKeys.USER, u);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const payload = {
        xp: u.xpTotal,
        streak: u.streakCurrent,
        longest_streak: u.streakLongest,
        last_study_date: u.lastStudyDate,
        daily_goal_minutes: u.dailyGoalMinutes,
      };
      const { error } = await supabase.from('users').update(payload).eq('id', authUser.id);
      if (error) throw error;
    } catch {
      if (u.id) {
        await addToSyncQueue({
          table: 'users', action: 'update',
          payload: { xp: u.xpTotal, streak: u.streakCurrent, longest_streak: u.streakLongest, last_study_date: u.lastStudyDate, daily_goal_minutes: u.dailyGoalMinutes },
          matchKey: 'id', matchValue: u.id,
        });
      }
    }
  };

  const setOnboarded = async (v: boolean) => {
    setIsOnboardedState(v);
    await setItem(StorageKeys.ONBOARDED, v);
  };

  // ── Subjects ──────────────────────────────────────────────────────────────
  const addSubject = async (name: string, colorHex: string, iconName: string): Promise<Subject> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');
    const { data, error } = await supabase.from('subjects').insert([{
      user_id: authUser.id, name: name.trim(), color_hex: colorHex,
      icon_name: iconName, display_order: subjects.length,
    }]).select().single();
    if (error) throw error;
    const newSubject = mapSubject(data);
    setSubjects(prev => [...prev, newSubject]);
    return newSubject;
  };

  const updateSubject = async (id: string, data: Partial<Subject>) => {
    const payload: any = {};
    if (data.name) payload.name = data.name;
    if (data.colorHex) payload.color_hex = data.colorHex;
    if (data.iconName) payload.icon_name = data.iconName;
    const { error } = await supabase.from('subjects').update(payload).eq('id', id);
    if (error) throw error;
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  const deleteSubject = async (id: string) => {
    const { error } = await supabase.from('subjects').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
    setSubjects(prev => prev.filter(s => s.id !== id));
  };

  // ── Chapters ──────────────────────────────────────────────────────────────
  const getChaptersForSubject = (subjectId: string) =>
    chapters.filter(c => c.subjectId === subjectId && !c.isDeleted).sort((a, b) => a.displayOrder - b.displayOrder);

  const addChapter = async (subjectId: string, name: string, plannedDate?: string | null): Promise<Chapter> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');
    const existing = chapters.filter(c => c.subjectId === subjectId && !c.isDeleted);
    const { data, error } = await supabase.from('chapters').insert([{
      subject_id: subjectId, user_id: authUser.id, name: name.trim(),
      status: 'not_started', planned_date: plannedDate || null, display_order: existing.length,
    }]).select().single();
    if (error) throw error;
    const newChapter = mapChapter(data);
    setChapters(prev => [...prev, newChapter]);
    return newChapter;
  };

  const updateChapter = async (id: string, data: Partial<Chapter>) => {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.plannedDate !== undefined) payload.planned_date = data.plannedDate;
    if (data.status !== undefined) payload.status = data.status;
    const { error } = await supabase.from('chapters').update(payload).eq('id', id);
    if (error) throw error;
    setChapters(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const deleteChapter = async (id: string) => {
    const { error } = await supabase.from('chapters').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
    setChapters(prev => prev.filter(c => c.id !== id));
  };

  const bulkDeleteChapters = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await supabase.from('chapters').update({ is_deleted: true }).in('id', ids);
    if (error) throw error;
    setChapters(prev => prev.filter(c => !ids.includes(c.id)));
  };

  // ── Topics (local only) ───────────────────────────────────────────────────
  const getTopicsForChapter = (chapterId: string) =>
    topics.filter(t => t.chapterId === chapterId && !t.isDeleted).sort((a, b) => a.displayOrder - b.displayOrder);

  const addTopic = async (chapterId: string, name: string): Promise<Topic> => {
    const existing = topics.filter(t => t.chapterId === chapterId && !t.isDeleted);
    const t: Topic = { id: uuidv4(), chapterId, name, isDone: false, displayOrder: existing.length, isDeleted: false };
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

  // ── XP ────────────────────────────────────────────────────────────────────
  const awardXP = async (amount: number, reason: string) => {
    if (!user) return;
    const txPayload = { id: uuidv4(), user_id: user.id, amount, reason, created_at: new Date().toISOString() };
    const newXPLog = [mapXP(txPayload), ...xpLog];
    setXpLog(newXPLog);
    await setItem(StorageKeys.XP_LOG, newXPLog);
    await setUser({ ...user, xpTotal: user.xpTotal + amount });
    try {
      const { error } = await supabase.from('xp_transactions').insert([txPayload]);
      if (error) throw error;
    } catch {
      await addToSyncQueue({ table: 'xp_transactions', action: 'insert', payload: txPayload });
    }
  };

  const deductXP = async (amount: number, reason: string) => {
    if (!user) return;
    const txPayload = { id: uuidv4(), user_id: user.id, amount: -amount, reason, created_at: new Date().toISOString() };
    const newXPLog = [mapXP(txPayload), ...xpLog];
    setXpLog(newXPLog);
    await setItem(StorageKeys.XP_LOG, newXPLog);
    await setUser({ ...user, xpTotal: Math.max(0, user.xpTotal - amount) });
    try {
      const { error } = await supabase.from('xp_transactions').insert([txPayload]);
      if (error) throw error;
    } catch {
      await addToSyncQueue({ table: 'xp_transactions', action: 'insert', payload: txPayload });
    }
  };

  const checkStreak = async (): Promise<{ wasStreakBroken: boolean }> => {
    if (!user) return { wasStreakBroken: false };
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (user.lastStudyDate && user.lastStudyDate < yesterday) {
      await setUser({ ...user, streakCurrent: 0 });
      return { wasStreakBroken: true };
    }
    return { wasStreakBroken: false };
  };

  // ── Sessions ──────────────────────────────────────────────────────────────
  const startSession = async (plannedMins: number, subjectId: string | null, chapterId: string | null): Promise<string> => {
    const sessionId = uuidv4();
    const active: ActiveSession = { sessionId, startedAt: new Date().toISOString(), plannedMins, subjectId, chapterId };
    setActiveSession(active);
    await setItem(StorageKeys.ACTIVE_SESSION, active);
    return sessionId;
  };

    const COMEBACK_BONUS_XP = 50;

  const completeSession = async (sessionId: string, actualMins: number): Promise<(FocusSession & { leveledUp?: boolean; newLevelRank?: number }) | null> => {
    try {
      const activeUser = user ?? await getItem<UserProfile>(StorageKeys.USER);
      const bonusFromComeback = comebackPending ? COMEBACK_BONUS_XP : 0;
      const xp = calculateSessionXP(actualMins) + bonusFromComeback;
      if (comebackPending) setComebackPendingState(false);

      // Level-up detection
      const oldLevelRank = activeUser ? getLevelForXP(activeUser.xpTotal).rank : 1;
      const newXPTotal = (activeUser?.xpTotal ?? 0) + xp;
      const newLevelRank = getLevelForXP(newXPTotal).rank;
      const leveledUp = newLevelRank > oldLevelRank;
      const sessionPayload = {
        id: sessionId,
        user_id: activeUser?.id ?? '',
        subject_id: activeSession?.subjectId ?? null,
        chapter_id: activeSession?.chapterId ?? null,
        planned_minutes: activeSession?.plannedMins ?? actualMins,
        actual_minutes: actualMins,
        broken: false,
        xp_earned: xp,
        comeback_bonus: bonusFromComeback > 0 ? bonusFromComeback : undefined,
        xp_deducted: 0,
        broken_at_percent: 100,
        started_at: activeSession?.startedAt ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const sessionObj = mapSession(sessionPayload);
      const newSessions = [sessionObj, ...sessions];
      setSessions(newSessions);
      await setItem(StorageKeys.SESSIONS, newSessions);
      setActiveSession(null);
      await setItem(StorageKeys.ACTIVE_SESSION, null);
      if (activeUser) {
        await processPostSessionData(actualMins, xp, true, activeUser);
        try {
          const { error } = await supabase.from('focus_sessions').insert([sessionPayload]);
          if (error) throw error;
        } catch {
          await addToSyncQueue({ table: 'focus_sessions', action: 'insert', payload: sessionPayload });
        }
      }
      processSyncQueue();
      return { ...sessionObj, leveledUp, newLevelRank };
    } catch {
      return null;
    }
  };

  const breakSession = async (sessionId: string, actualMins: number): Promise<FocusSession | null> => {
    try {
      const activeUser = user ?? await getItem<UserProfile>(StorageKeys.USER);
      const planned = activeSession?.plannedMins ?? 1;
      const brokenAt = Math.floor((actualMins / planned) * 100);
      const penalty = Math.floor(calculateSessionXP(planned) * XP_REWARDS.sessionBrokenMultiplier);
      const sessionPayload = {
        id: sessionId,
        user_id: activeUser?.id ?? '',
        subject_id: activeSession?.subjectId ?? null,
        chapter_id: activeSession?.chapterId ?? null,
        planned_minutes: planned,
        actual_minutes: actualMins,
        broken: true,
        xp_earned: 0,
        xp_deducted: penalty,
        broken_at_percent: brokenAt,
        started_at: activeSession?.startedAt ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const sessionObj = mapSession(sessionPayload);
      const newSessions = [sessionObj, ...sessions];
      setSessions(newSessions);
      await setItem(StorageKeys.SESSIONS, newSessions);
      setActiveSession(null);
      await setItem(StorageKeys.ACTIVE_SESSION, null);
      if (activeUser) {
        await processPostSessionData(actualMins, -penalty, false, activeUser);
        try {
          const { error } = await supabase.from('focus_sessions').insert([sessionPayload]);
          if (error) throw error;
        } catch {
          await addToSyncQueue({ table: 'focus_sessions', action: 'insert', payload: sessionPayload });
        }
      }
      processSyncQueue();
      return sessionObj;
    } catch {
      return null;
    }
  };

  const setComebackPending = (v: boolean) => setComebackPendingState(v);

  const processPostSessionData = async (mins: number, xpDelta: number, isCompleted: boolean, activeUser: UserProfile) => {
    try {
      const today = todayStr();
      const existingSummary = dailySummaries.find(s => s.date === today);
      const summaryId = existingSummary?.id || uuidv4();
      const newTotalMins = (existingSummary?.totalMinutes || 0) + mins;
      const goalMet = newTotalMins >= activeUser.dailyGoalMinutes;
      let bonusXP = 0;
      if (!existingSummary?.goalMet && goalMet) bonusXP = XP_REWARDS.dailyGoalBonus;
      const finalXP = xpDelta + bonusXP;
      const summaryPayload = {
        id: summaryId, user_id: activeUser.id, date: today,
        total_focus_minutes: newTotalMins,
        sessions_completed: (existingSummary?.sessionsCompleted || 0) + (isCompleted ? 1 : 0),
        sessions_broken: (existingSummary?.sessionsBroken || 0) + (isCompleted ? 0 : 1),
        goal_minutes: activeUser.dailyGoalMinutes, goal_met: goalMet,
        xp_earned: (existingSummary?.xpEarned || 0) + (finalXP > 0 ? finalXP : 0),
      };
      const newDaily = [mapSummary(summaryPayload), ...dailySummaries.filter(s => s.date !== today)];
      setDailySummaries(newDaily);
      await setItem(StorageKeys.DAILY_SUMMARY, newDaily);
      try {
        const { error } = await supabase.from('daily_summary').upsert([summaryPayload], { onConflict: 'user_id,date' });
        if (error) throw error;
      } catch {
        await addToSyncQueue({ table: 'daily_summary', action: 'upsert', payload: summaryPayload });
      }
      if (finalXP !== 0) {
        const txPayload = { id: uuidv4(), user_id: activeUser.id, amount: finalXP, reason: isCompleted ? 'session_complete' : 'session_broken', created_at: new Date().toISOString() };
        const newXPLog = [mapXP(txPayload), ...xpLog];
        setXpLog(newXPLog);
        await setItem(StorageKeys.XP_LOG, newXPLog);
        try {
          const { error } = await supabase.from('xp_transactions').insert([txPayload]);
          if (error) throw error;
        } catch {
          await addToSyncQueue({ table: 'xp_transactions', action: 'insert', payload: txPayload });
        }
      }
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      let newStreak = activeUser.streakCurrent;
      if (isCompleted && activeUser.lastStudyDate !== today) {
        newStreak = (activeUser.lastStudyDate === yesterday || activeUser.lastStudyDate === null) ? newStreak + 1 : 1;
      } else if (!isCompleted) {
        newStreak = 0;
      }
      await setUser({
        ...activeUser,
        xpTotal: Math.max(0, activeUser.xpTotal + finalXP),
        streakCurrent: newStreak,
        streakLongest: Math.max(newStreak, activeUser.streakLongest),
        lastStudyDate: isCompleted ? today : activeUser.lastStudyDate,
      });
    } catch (e) {
      console.error('Failed to process post session data', e);
    }
  };

  const getDailySummary = (date: string) => dailySummaries.find(s => s.date === date) ?? null;

  const getEmptySummary = (daysAgo: number): DailySummary => {
    const d = new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
    return dailySummaries.find(s => s.date === d) ?? {
      id: '', userId: user?.id || '', date: d, totalMinutes: 0,
      sessionsCompleted: 0, sessionsBroken: 0, goalMinutes: user?.dailyGoalMinutes ?? 120, goalMet: false, xpEarned: 0,
    };
  };

  const getLast7Days = () => Array.from({ length: 7 }).map((_, i) => getEmptySummary(6 - i));
  const getLast90Days = () => Array.from({ length: 90 }).map((_, i) => getEmptySummary(89 - i));

  return (
    <AppContext.Provider value={{
      user, isOnboarded, setUser, setOnboarded,
      subjects, addSubject, updateSubject, deleteSubject,
      chapters, getChaptersForSubject, addChapter, updateChapter, deleteChapter, bulkDeleteChapters,
      topics, getTopicsForChapter, addTopic, toggleTopic, deleteTopic,
      sessions, activeSession, startSession, completeSession, breakSession,
      getDailySummary, getLast7Days, getLast90Days,
      xpLog, awardXP, deductXP, checkStreak,
      comebackPending, setComebackPending,
      isLoading, reload: load,
    }}>
      {children}
    </AppContext.Provider>
  );
}
