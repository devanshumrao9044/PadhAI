import React, { createContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
// Cross-platform UUID generator (no native crypto dependency)
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import { getItem, setItem, removeItem, StorageKeys } from '@/services/storage';
import { readUserCache, removeUserCache, writeUserCache } from '@/services/cache';
import { supabase } from '@/services/supabase';
import {
  UserProfile, Subject, Chapter, Topic,
  FocusSession, ChapterAnalytics, DailySummary, XPTransaction, ActiveSession
} from '@/types/models';
import { calculateSessionXP, XP_REWARDS, getLevelForUser } from '@/constants/levels';
import { processReferralOnFirstSession } from '@/services/referralService';
import { normalizeChapterAnalyticsRows } from '@/services/chapterAnalytics';
import { reconcileTrackerState } from '@/services/trackerState';
import { getRecoveredStreak, isStreakRecoveryEligible } from '@/services/streakRecovery';
import {
  buildBaselineMarker,
  buildWeeklySettlement,
  createWeeklyMarkerReason,
  getEffectiveLevelRank,
  getLatestWeeklyMarker,
  getWeekStart,
  type WeeklySettlementResult,
} from '@/services/weeklyXp';

export type AppContextType = {
  comebackPending: boolean;
  setComebackPending: (v: boolean) => void;
  hasUnlockedReward: boolean;
  setHasUnlockedReward: (v: boolean) => void;
  referralCount: number;
  streakRecoveryPending: boolean;
  lostStreakCount: number;
  setStreakRecoveryPending: (v: boolean, lostStreak?: number) => void;
  user: UserProfile | null;
  isOnboarded: boolean;
  setUser: (u: UserProfile) => Promise<void>;
  setOnboarded: (v: boolean) => Promise<void>;
  subjects: Subject[];
  addSubject: (name: string, colorHex: string, iconName: string) => Promise<Subject>;
  updateSubject: (id: string, data: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  chapters: Chapter[];
  chapterAnalytics: ChapterAnalytics[];
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
  dailySummaries: DailySummary[];
  last7Days: DailySummary[];
  last90Days: DailySummary[];
  activeSession: ActiveSession | null;
  startSession: (plannedMins: number, subjectId: string | null, chapterId: string | null, isRecoverySession?: boolean, recoveryLostStreak?: number) => Promise<string>;
  completeSession: (sessionId: string, actualMins: number) => Promise<(FocusSession & { leveledUp?: boolean; newLevelRank?: number; totalXP?: number; referralXpAwarded?: number }) | null>;
  breakSession: (sessionId: string, actualMins: number) => Promise<FocusSession | null>;
  getDailySummary: (date: string) => DailySummary | null;
  getLast7Days: () => DailySummary[];
  getLast90Days: () => DailySummary[];
  xpLog: XPTransaction[];
  awardXP: (amount: number, reason: string) => Promise<void>;
  deductXP: (amount: number, reason: string) => Promise<void>;
  isLoading: boolean;
  reload: (options?: { force?: boolean }) => Promise<void>;
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

function dateStr(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayStr() {
  return dateStr();
}

function daysAgoStr(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return dateStr(date);
}

// ── Data Mappers ──────────────────────────────────────────────────────────────
const mapUser = (u: any): UserProfile => ({
  id: u.id,
  username: u.email?.split('@')[0] ?? 'student',
  fullName: u.name ?? 'Student',
  targetExam: u.target_exam ?? 'JEE',
  classLevel: u.class ?? '12th',
  dailyGoalMinutes: u.daily_goal_minutes ?? 120,
  xpTotal: u.xp ?? 0,
  levelRank: typeof u.level_rank === 'number' ? u.level_rank : undefined,
  streakCurrent: u.streak ?? 0,
  streakLongest: u.longest_streak ?? 0,
  lastStudyDate: u.last_study_date ?? null,
  createdAt: u.created_at ?? new Date().toISOString(),
  avatarUrl: u.avatar_url ?? null,          
  myReferralCode: u.my_referral_code ?? null, 
  hasUnlockedReward: u.has_unlocked_reward ?? false, 
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
  isDeleted: c.is_deleted === true || c.is_deleted === 'true' || c.is_deleted === 1,
});

const mapSession = (s: any): FocusSession => {
  // chapter_id is supported by the production focus_sessions schema.
  // broken_at_percent and created_at remain local/derived compatibility fields.
  const startedAt = s.started_at ?? s.startedAt ?? new Date().toISOString();
  const endedAt = s.ended_at ?? s.endedAt ?? startedAt;
  return {
    comebackBonus: s.comebackBonus ?? s.comeback_bonus ?? 0,
    id: s.id,
    userId: s.user_id ?? s.userId,
    subjectId: s.subject_id ?? s.subjectId ?? null,
    chapterId: s.chapter_id ?? s.chapterId ?? null,
    durationPlannedMins: s.planned_minutes ?? s.durationPlannedMins ?? 0,
    durationActualMins: s.actual_minutes ?? s.durationActualMins ?? 0,
    completed: typeof s.completed === 'boolean' ? s.completed : !s.broken,
    xpEarned: s.xp_earned ?? s.xpEarned ?? 0,
    xpDeducted: s.xp_deducted ?? s.xpDeducted ?? 0,
    brokenAtPercent: s.broken_at_percent ?? s.brokenAtPercent ?? (
      s.broken
        ? Math.min(100, Math.max(0, Math.floor(((s.actual_minutes ?? s.durationActualMins ?? 0) / Math.max(1, s.planned_minutes ?? s.durationPlannedMins ?? 1)) * 100)))
        : 100
    ),
    sessionDate: dateStr(new Date(startedAt)),
    createdAt: s.created_at ?? s.createdAt ?? endedAt,
  };
};

const toFocusSessionDbPayload = (s: any) => {
  const broken = typeof s.broken === 'boolean' ? s.broken : s.completed === false;
  return {
    id: s.id,
    user_id: s.user_id ?? s.userId,
    subject_id: s.subject_id ?? s.subjectId ?? null,
    chapter_id: s.chapter_id ?? s.chapterId ?? null,
    planned_minutes: s.planned_minutes ?? s.durationPlannedMins ?? 0,
    actual_minutes: s.actual_minutes ?? s.durationActualMins ?? 0,
    completed: typeof s.completed === 'boolean' ? s.completed : !broken,
    broken,
    xp_earned: s.xp_earned ?? s.xpEarned ?? 0,
    xp_deducted: s.xp_deducted ?? s.xpDeducted ?? 0,
    break_reason: s.break_reason ?? null,
    started_at: s.started_at ?? s.startedAt ?? new Date().toISOString(),
    ended_at: s.ended_at ?? s.endedAt ?? null,
    comeback_bonus: s.comeback_bonus ?? s.comebackBonus ?? 0,
  };
};

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

const createWeeklyMarkerTransaction = (userId: string, marker: WeeklySettlementResult) => ({
  id: marker.markerId,
  user_id: userId,
  amount: 0,
  reason: createWeeklyMarkerReason(marker),
  created_at: new Date().toISOString(),
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

function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback(((...args: Parameters<T>) => callbackRef.current(...args)) as T, []);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboardedState] = useState(false);
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [chapterAnalytics, setChapterAnalytics] = useState<ChapterAnalytics[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [xpLog, setXpLog] = useState<XPTransaction[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [comebackPending, setComebackPendingState] = useState(false);
  const [hasUnlockedReward, setHasUnlockedRewardState] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const [streakRecoveryPending, setStreakRecoveryPendingState] = useState(false);
  const [lostStreakCount, setLostStreakCount] = useState(0);
  const authGenerationRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const weeklySettlementInFlightRef = useRef(false);
  const deletedChapterIdsRef = useRef(new Set<string>());
  const deletedSubjectIdsRef = useRef(new Set<string>());
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const lastLoadAtRef = useRef<{ userId: string | null; at: number } | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const addToSyncQueue = async (task: Omit<SyncTask, 'id'>) => {
    const existingQueue = (await getItem<SyncTask[]>(OFFLINE_QUEUE_KEY)) || [];
    const newTask = { ...task, id: uuidv4() };
    await setItem(OFFLINE_QUEUE_KEY, [...existingQueue, newTask]);
  };

  const processSyncQueue = async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      const queue = await getItem<SyncTask[]>(OFFLINE_QUEUE_KEY);
      if (!queue || queue.length === 0) return;
      let remainingQueue = [...queue];
      for (const task of queue) {
        try {
          if (task.action === 'insert') {
            const payload = task.table === 'focus_sessions'
              ? toFocusSessionDbPayload(task.payload)
              : task.payload;
            const { error } = await supabase.from(task.table).insert(payload);
            if (error) throw error;
            if (
              task.table === 'focus_sessions' &&
              task.payload?.broken === false &&
              task.payload?.user_id
            ) {
              try {
                await processReferralOnFirstSession(task.payload.user_id);
              } catch (referralError) {
                console.warn('[Referral] Sync processing failed:', referralError);
              }
            }
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
    } finally {
      syncInFlightRef.current = false;
    }
  };

  const persistWeeklyMarker = async (userId: string, marker: WeeklySettlementResult) => {
    const txPayload = createWeeklyMarkerTransaction(userId, marker);
    try {
      const { error } = await supabase
        .from('xp_transactions')
        .upsert([txPayload], { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    } catch {
      await addToSyncQueue({ table: 'xp_transactions', action: 'upsert', payload: txPayload });
    }
    return mapXP(txPayload);
  };

  const settleWeeklyXPIfNeeded = async (
    profile: UserProfile,
    transactions: XPTransaction[],
  ): Promise<{ user: UserProfile; xpLog: XPTransaction[] }> => {
    if (weeklySettlementInFlightRef.current) return { user: profile, xpLog: transactions };
    weeklySettlementInFlightRef.current = true;
    try {
      const weekStart = getWeekStart();
      const latestMarker = getLatestWeeklyMarker(transactions);
      if (latestMarker && latestMarker.weekStart >= weekStart) {
        return {
          user: {
            ...profile,
            xpTotal: latestMarker.kind === 'settlement' ? 0 : profile.xpTotal,
            levelRank: latestMarker.toLevelRank,
          },
          xpLog: transactions,
        };
      }

      if (!latestMarker) {
        const baseline = buildBaselineMarker(profile.id, profile, weekStart);
        const markerXP = await persistWeeklyMarker(profile.id, baseline);
        return {
          user: { ...profile, levelRank: baseline.toLevelRank },
          xpLog: [markerXP, ...transactions.filter(transaction => transaction.id !== markerXP.id)],
        };
      }

      const { data: leaderboardData, error: leaderboardError } = await supabase.rpc('get_leaderboard');
      if (leaderboardError || !Array.isArray(leaderboardData) || leaderboardData.length === 0) {
        return { user: { ...profile, levelRank: latestMarker.toLevelRank }, xpLog: transactions };
      }

      const myEntry = leaderboardData.find((entry: any) => entry.id === profile.id);
      if (!myEntry) {
        return { user: { ...profile, levelRank: latestMarker.toLevelRank }, xpLog: transactions };
      }

      const rank = Number(myEntry.rank ?? leaderboardData.findIndex((entry: any) => entry.id === profile.id) + 1);
      const settlement = buildWeeklySettlement({
        userId: profile.id,
        weekStart,
        currentLevelRank: latestMarker.toLevelRank || getEffectiveLevelRank(profile),
        rank,
        totalPlayers: leaderboardData.length,
      });
      const markerXP = await persistWeeklyMarker(profile.id, settlement);
      const updatedUser = {
        ...profile,
        xpTotal: 0,
        levelRank: settlement.toLevelRank,
      };
      return {
        user: updatedUser,
        xpLog: [markerXP, ...transactions.filter(transaction => transaction.id !== markerXP.id)],
      };
    } finally {
      weeklySettlementInFlightRef.current = false;
    }
  };

  const clearLocalAccountData = async (userId?: string) => {
    await Promise.all([
      userId ? removeUserCache(userId) : Promise.resolve(),
      removeItem(StorageKeys.USER),
      removeItem(StorageKeys.SUBJECTS),
      removeItem(StorageKeys.CHAPTERS),
      removeItem(StorageKeys.TOPICS),
      removeItem(StorageKeys.SESSIONS),
      removeItem(StorageKeys.DAILY_SUMMARY),
      removeItem(StorageKeys.XP_LOG),
      removeItem(StorageKeys.ONBOARDED),
      removeItem(StorageKeys.ACTIVE_SESSION),
      removeItem(OFFLINE_QUEUE_KEY),
    ]);
  };

  // ── Core Load ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const loadGeneration = authGenerationRef.current;
    setIsLoading(true);
    try {
      const [savedUser, savedTopics, savedActive, savedSessions, savedSummaries, savedXP] = await Promise.all([
        getItem<UserProfile>(StorageKeys.USER),
        getItem<Topic[]>(StorageKeys.TOPICS),
        getItem<ActiveSession>(StorageKeys.ACTIVE_SESSION),
        getItem<FocusSession[]>(StorageKeys.SESSIONS),
        getItem<DailySummary[]>(StorageKeys.DAILY_SUMMARY),
        getItem<XPTransaction[]>(StorageKeys.XP_LOG),
      ]);

      const { data: authData } = await supabase.auth.getSession();
      if (loadGeneration !== authGenerationRef.current) return;
      const authUser = authData.session?.user;
      if (authUser) {
        const userId = authUser.id;
        currentUserIdRef.current = userId;
        const sameAccount = savedUser?.id === userId;
        const [cachedUser, cachedSubjects, cachedChapters, cachedTopics, cachedSessions, cachedSummaries, cachedXP, cachedAnalytics, cachedReferral] = await Promise.all([
          readUserCache<UserProfile>(userId, 'user'),
          readUserCache<Subject[]>(userId, 'subjects'),
          readUserCache<Chapter[]>(userId, 'chapters'),
          readUserCache<Topic[]>(userId, 'topics'),
          readUserCache<FocusSession[]>(userId, 'sessions'),
          readUserCache<DailySummary[]>(userId, 'dailySummaries'),
          readUserCache<XPTransaction[]>(userId, 'xpLog'),
          readUserCache<ChapterAnalytics[]>(userId, 'chapterAnalytics'),
          readUserCache<{ referralCount: number; hasUnlockedReward: boolean }>(userId, 'referralMeta'),
        ]);
        if (cachedUser) {
          setUserState(cachedUser.data);
          setIsOnboardedState(cachedUser.data.fullName !== 'Student');
        }
        const localTopics = sameAccount
          ? (cachedTopics?.data ?? savedTopics ?? [])
          : (cachedTopics?.data ?? []);
        const cachedTracker = reconcileTrackerState(
          cachedSubjects?.data.filter(subject => !deletedSubjectIdsRef.current.has(subject.id)) ?? [],
          cachedChapters?.data.filter(chapter => !deletedChapterIdsRef.current.has(chapter.id)) ?? [],
          localTopics,
        );
        const cachedActiveChapterIds = cachedChapters
          ? new Set(cachedTracker.chapters.map(chapter => chapter.id))
          : null;
        if (cachedSubjects) setSubjects(cachedTracker.subjects);
        if (cachedChapters) setChapters(cachedTracker.chapters);
        if (cachedTopics || sameAccount) setTopics(cachedTracker.topics);
        if (cachedAnalytics) {
          setChapterAnalytics(cachedActiveChapterIds
            ? cachedAnalytics.data.filter(analytics => cachedActiveChapterIds.has(analytics.chapterId))
            : []);
        }
        if (cachedReferral) {
          setReferralCount(cachedReferral.data.referralCount);
          setHasUnlockedRewardState(cachedReferral.data.hasUnlockedReward);
        }

        if (sameAccount) {
          setTopics(cachedTracker.topics);
          setActiveSession(savedActive ?? null);
          setSessions(cachedSessions?.data ?? savedSessions ?? []);
          setDailySummaries(cachedSummaries?.data ?? savedSummaries ?? []);
          setXpLog(cachedXP?.data ?? savedXP ?? []);
          await processSyncQueue();
        } else {
          deletedChapterIdsRef.current.clear();
          deletedSubjectIdsRef.current.clear();
          await clearLocalAccountData(savedUser?.id);
          setSubjects(cachedTracker.subjects);
          setChapters(cachedTracker.chapters);
          setTopics(cachedTracker.topics);
          setActiveSession(null);
          setSessions(cachedSessions?.data ?? []);
          setChapterAnalytics(cachedActiveChapterIds
            ? cachedAnalytics?.data.filter(analytics => cachedActiveChapterIds.has(analytics.chapterId)) ?? []
            : []);
          setDailySummaries(cachedSummaries?.data ?? []);
          setXpLog(cachedXP?.data ?? []);
        }

        // Load user profile from DB
        let loadedProfile: UserProfile | null = null;
        const { data: profileData } = await supabase
          .from('users')
          .select('id,name,target_exam,class,daily_goal_minutes,xp,streak,longest_streak,last_study_date,created_at,avatar_url,my_referral_code,has_unlocked_reward')
          .eq('id', userId)
          .single();

        if (loadGeneration !== authGenerationRef.current) return;
        if (profileData) {
          loadedProfile = mapUser({ ...profileData, email: authUser.email });
          setUserState(loadedProfile);
          setIsOnboardedState(!!(profileData.name && profileData.name !== 'Student'));
          await setItem(StorageKeys.USER, loadedProfile);
          void writeUserCache(userId, 'user', loadedProfile);
        }

        // Load referral count and check jackpot
        try {
          const { count } = await supabase
            .from('referrals')
            .select('id', { count: 'exact', head: true })
            .eq('referrer_id', userId)
            .eq('status', 'completed');
          const rCount = count ?? 0;
          setReferralCount(rCount);
          setHasUnlockedRewardState(rCount >= 5);
          void writeUserCache(userId, 'referralMeta', { referralCount: rCount, hasUnlockedReward: rCount >= 5 });
        } catch {
          // ignore
        }

        if (loadGeneration !== authGenerationRef.current) return;
        const [subRes, chapRes, sessRes, sumRes, xpRes, chapterAnalyticsRes] = await Promise.all([
          supabase.from('subjects').select('id,user_id,name,color_hex,icon_name,display_order,created_at,is_deleted').eq('user_id', userId).eq('is_deleted', false).order('display_order', { ascending: true }),
          supabase.from('chapters').select('id,subject_id,user_id,name,status,planned_date,completed_date,display_order,created_at,is_deleted').eq('user_id', userId).eq('is_deleted', false).order('display_order', { ascending: true }),
          supabase.from('focus_sessions').select('id,user_id,subject_id,chapter_id,planned_minutes,actual_minutes,completed,broken,xp_earned,xp_deducted,break_reason,started_at,ended_at,comeback_bonus').eq('user_id', userId).order('started_at', { ascending: false }).limit(200),
          supabase.from('daily_summary').select('id,user_id,date,total_focus_minutes,sessions_completed,sessions_broken,goal_minutes,goal_met,xp_earned').eq('user_id', userId).order('date', { ascending: false }).limit(100),
          supabase.from('xp_transactions').select('id,user_id,amount,reason,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
          supabase.rpc('get_chapter_analytics', { p_start_date: null, p_end_date: null }),
        ]);

        if (loadGeneration !== authGenerationRef.current) return;
        let activeChapterIds: Set<string> | null = null;
        const cloudSubjects = subRes.data
          ? subRes.data
            .map(mapSubject)
            .filter(subject => !subject.isDeleted && !deletedSubjectIdsRef.current.has(subject.id))
          : cachedTracker.subjects;
        const cloudChapters = chapRes.data
          ? chapRes.data
            .map(mapChapter)
            .filter(chapter => !deletedChapterIdsRef.current.has(chapter.id) && chapter.isDeleted === false)
          : cachedTracker.chapters;
        const reconciledTracker = reconcileTrackerState(cloudSubjects, cloudChapters, cachedTracker.topics);
        activeChapterIds = new Set(reconciledTracker.chapters.map(chapter => chapter.id));
        if (subRes.data) {
          setSubjects(reconciledTracker.subjects);
          void writeUserCache(userId, 'subjects', reconciledTracker.subjects);
        }
        if (chapRes.data) {
          setChapters(reconciledTracker.chapters);
          await setItem(StorageKeys.CHAPTERS, reconciledTracker.chapters);
          void writeUserCache(userId, 'chapters', reconciledTracker.chapters);
        }
        setTopics(reconciledTracker.topics);
        await setItem(StorageKeys.TOPICS, reconciledTracker.topics);
        void writeUserCache(userId, 'topics', reconciledTracker.topics);
        if (sessRes.data) {
          const cloudSess = sessRes.data.map(mapSession);
          setSessions(cloudSess);
          setItem(StorageKeys.SESSIONS, cloudSess);
          void writeUserCache(userId, 'sessions', cloudSess);
        }
        if (sumRes.data) {
          const cloudSum = sumRes.data.map(mapSummary);
          setDailySummaries(cloudSum);
          setItem(StorageKeys.DAILY_SUMMARY, cloudSum);
          void writeUserCache(userId, 'dailySummaries', cloudSum);
        }
        if (!chapterAnalyticsRes.error && chapterAnalyticsRes.data) {
          const normalizedAnalytics = normalizeChapterAnalyticsRows(chapterAnalyticsRes.data);
          const visibleAnalytics = activeChapterIds
            ? normalizedAnalytics.filter(analytics => activeChapterIds.has(analytics.chapterId))
            : normalizedAnalytics;
          setChapterAnalytics(visibleAnalytics);
          void writeUserCache(userId, 'chapterAnalytics', visibleAnalytics);
        } else if (chapterAnalyticsRes.error) {
          console.warn('[Analytics] Chapter analytics load failed:', chapterAnalyticsRes.error.message);
          if (!cachedAnalytics) setChapterAnalytics([]);
        }
        let loadedXP = cachedXP?.data ?? savedXP ?? [];
        if (xpRes.data) {
          loadedXP = xpRes.data.map(mapXP);
          setXpLog(loadedXP);
          setItem(StorageKeys.XP_LOG, loadedXP);
          void writeUserCache(userId, 'xpLog', loadedXP);
        }
        if (loadedProfile) {
          const settlementResult = await settleWeeklyXPIfNeeded(loadedProfile, loadedXP);
          if (loadGeneration !== authGenerationRef.current) return;
          const userChanged = settlementResult.user.xpTotal !== loadedProfile.xpTotal
            || settlementResult.user.levelRank !== loadedProfile.levelRank;
          if (userChanged) await setUser(settlementResult.user);
          else setUserState(settlementResult.user);
          setXpLog(settlementResult.xpLog);
          await setItem(StorageKeys.XP_LOG, settlementResult.xpLog);
          void writeUserCache(userId, 'xpLog', settlementResult.xpLog);
        }
      } else {
        if (loadGeneration !== authGenerationRef.current) return;
        currentUserIdRef.current = null;
        setUserState(null);
        setIsOnboardedState(false);
        setSubjects([]);
        setChapters([]);
        deletedChapterIdsRef.current.clear();
        deletedSubjectIdsRef.current.clear();
        setTopics([]);
        setSessions([]);
        setChapterAnalytics([]);
        setDailySummaries([]);
        setXpLog([]);
        setActiveSession(null);
      }
    } catch (err) {
      console.warn('Cloud load failed, operating in offline mode.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reload = useCallback(async (options?: { force?: boolean }) => {
    if (loadInFlightRef.current) return loadInFlightRef.current;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;
    const lastLoad = lastLoadAtRef.current;
    if (!options?.force && lastLoad?.userId === userId && Date.now() - lastLoad.at < 60_000) return;
    const pending = load();
    loadInFlightRef.current = pending;
    try {
      await pending;
      lastLoadAtRef.current = { userId, at: Date.now() };
    } finally {
      if (loadInFlightRef.current === pending) loadInFlightRef.current = null;
    }
  }, [load]);

  useEffect(() => {
    void reload();

    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        void processSyncQueue();
        void reload();
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        setIsLoading(true);
        void reload({ force: true });
      } else if (event === 'SIGNED_OUT') {
        authGenerationRef.current += 1;
        setUserState(null);
        setIsOnboardedState(false);
        setSubjects([]);
        setChapters([]);
        deletedChapterIdsRef.current.clear();
        deletedSubjectIdsRef.current.clear();
        setTopics([]);
        setSessions([]);
        setChapterAnalytics([]);
        setDailySummaries([]);
        setXpLog([]);
        setActiveSession(null);
        setReferralCount(0);
        setHasUnlockedRewardState(false);
        setComebackPendingState(false);
        setStreakRecoveryPendingState(false);
        setLostStreakCount(0);
        lastLoadAtRef.current = null;
        const activeUserId = currentUserIdRef.current;
        currentUserIdRef.current = null;
        const savedAccount = await getItem<UserProfile>(StorageKeys.USER);
        await clearLocalAccountData(activeUserId ?? savedAccount?.id);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, [load, reload]);

  // ── setUser: sync XP/streak fields to Supabase (profile fields saved separately in profile.tsx) ─────────────────────────────────────────────
  const setUser = async (u: UserProfile) => {
    setUserState(u);
    setIsOnboardedState(Boolean(u.fullName && u.fullName !== 'Student'));
    await setItem(StorageKeys.USER, u);
    void writeUserCache(u.id, 'user', u);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      // Sync XP, streak, and goal fields — profile fields (name/exam/class/avatar)
      // are already persisted by the caller (profile.tsx handleSaveProfile)
      const payload: any = {
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
    const updatedSubjects = [...subjects, newSubject];
    setSubjects(updatedSubjects);
    void writeUserCache(authUser.id, 'subjects', updatedSubjects);
    return newSubject;
  };

  const updateSubject = async (id: string, data: Partial<Subject>) => {
    const payload: any = {};
    if (data.name) payload.name = data.name;
    if (data.colorHex) payload.color_hex = data.colorHex;
    if (data.iconName) payload.icon_name = data.iconName;
    const { error } = await supabase.from('subjects').update(payload).eq('id', id);
    if (error) throw error;
    const updatedSubjects = subjects.map(s => s.id === id ? { ...s, ...data } : s);
    setSubjects(updatedSubjects);
    const { data: authData } = await supabase.auth.getSession();
    if (authData.session?.user?.id) void writeUserCache(authData.session.user.id, 'subjects', updatedSubjects);
  };

  const deleteSubject = async (id: string) => {
    const { data: deleted, error } = await supabase.rpc('delete_subject_and_chapters', {
      p_subject_id: id,
    });
    if (error) throw error;
    if (deleted === false) throw new Error('Subject not found or already deleted.');

    const deletedChapterIds = new Set(
      chapters.filter(chapter => chapter.subjectId === id).map(chapter => chapter.id),
    );
    deletedChapterIds.forEach(chapterId => deletedChapterIdsRef.current.add(chapterId));
    deletedSubjectIdsRef.current.add(id);

    const updatedSubjects = subjects.filter(subject => subject.id !== id);
    const updatedChapters = chapters.filter(chapter => !deletedChapterIds.has(chapter.id));
    const updatedTopics = topics.filter(topic => !deletedChapterIds.has(topic.chapterId));
    const updatedAnalytics = chapterAnalytics.filter(analytics => (
      analytics.subjectId !== id && !deletedChapterIds.has(analytics.chapterId)
    ));

    setSubjects(updatedSubjects);
    setChapters(updatedChapters);
    setTopics(updatedTopics);
    setChapterAnalytics(updatedAnalytics);
    await setItem(StorageKeys.CHAPTERS, updatedChapters);
    await setItem(StorageKeys.TOPICS, updatedTopics);

    if (activeSession?.subjectId === id) {
      setActiveSession(null);
      await removeItem(StorageKeys.ACTIVE_SESSION);
    }

    const { data: authData } = await supabase.auth.getSession();
    const userId = authData.session?.user?.id;
    if (userId) {
      void writeUserCache(userId, 'subjects', updatedSubjects);
      void writeUserCache(userId, 'chapters', updatedChapters);
      void writeUserCache(userId, 'topics', updatedTopics);
      void writeUserCache(userId, 'chapterAnalytics', updatedAnalytics);
    }
    lastLoadAtRef.current = null;
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
    const updatedChapters = [...chapters, newChapter];
    setChapters(updatedChapters);
    void writeUserCache(authUser.id, 'chapters', updatedChapters);
    return newChapter;
  };

  const updateChapter = async (id: string, data: Partial<Chapter>) => {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.plannedDate !== undefined) payload.planned_date = data.plannedDate;
    if (data.status !== undefined) payload.status = data.status;
    const { error } = await supabase.from('chapters').update(payload).eq('id', id);
    if (error) throw error;
    const updatedChapters = chapters.map(c => c.id === id ? { ...c, ...data } : c);
    setChapters(updatedChapters);
    const { data: authData } = await supabase.auth.getSession();
    if (authData.session?.user?.id) void writeUserCache(authData.session.user.id, 'chapters', updatedChapters);
  };

  const deleteChapter = async (id: string) => {
    const { error } = await supabase.from('chapters').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
    deletedChapterIdsRef.current.add(id);
    const updatedChapters = chapters.filter(c => c.id !== id);
    const updatedTopics = topics.filter(topic => topic.chapterId !== id);
    const updatedAnalytics = chapterAnalytics.filter(analytics => analytics.chapterId !== id);
    setChapters(updatedChapters);
    setTopics(updatedTopics);
    setChapterAnalytics(updatedAnalytics);
    await setItem(StorageKeys.TOPICS, updatedTopics);
    const { data: authData } = await supabase.auth.getSession();
    if (authData.session?.user?.id) {
      void writeUserCache(authData.session.user.id, 'chapters', updatedChapters);
      void writeUserCache(authData.session.user.id, 'topics', updatedTopics);
      void writeUserCache(authData.session.user.id, 'chapterAnalytics', updatedAnalytics);
    }
  };

  const bulkDeleteChapters = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await supabase.from('chapters').update({ is_deleted: true }).in('id', ids);
    if (error) throw error;
    ids.forEach(id => deletedChapterIdsRef.current.add(id));
    const deletedChapterIds = new Set(ids);
    const updatedChapters = chapters.filter(c => !deletedChapterIds.has(c.id));
    const updatedTopics = topics.filter(topic => !deletedChapterIds.has(topic.chapterId));
    const updatedAnalytics = chapterAnalytics.filter(analytics => !deletedChapterIds.has(analytics.chapterId));
    setChapters(updatedChapters);
    setTopics(updatedTopics);
    setChapterAnalytics(updatedAnalytics);
    await setItem(StorageKeys.TOPICS, updatedTopics);
    const { data: authData } = await supabase.auth.getSession();
    if (authData.session?.user?.id) {
      void writeUserCache(authData.session.user.id, 'chapters', updatedChapters);
      void writeUserCache(authData.session.user.id, 'topics', updatedTopics);
      void writeUserCache(authData.session.user.id, 'chapterAnalytics', updatedAnalytics);
    }
  };

  // ── Topics (local only) ───────────────────────────────────────────────────
  const getTopicsForChapter = (chapterId: string) =>
    topics
      .filter(topic => topic.chapterId === chapterId && !topic.isDeleted)
      .sort((a, b) => a.displayOrder - b.displayOrder);

  const addTopic = async (chapterId: string, name: string): Promise<Topic> => {
    const chapterExists = chapters.some(chapter => (
      chapter.id === chapterId && !chapter.isDeleted && subjects.some(subject => (
        subject.id === chapter.subjectId && !subject.isDeleted
      ))
    ));
    if (!chapterExists) throw new Error('Cannot add a topic to an inactive chapter.');
    const existing = topics.filter(t => t.chapterId === chapterId && !t.isDeleted);
    const t: Topic = { id: uuidv4(), chapterId, name: name.trim(), isDone: false, displayOrder: existing.length, isDeleted: false };
    const updated = [...topics, t];
    setTopics(updated);
    await setItem(StorageKeys.TOPICS, updated);
    if (user?.id) void writeUserCache(user.id, 'topics', updated);
    return t;
  };

  const toggleTopic = async (id: string) => {
    const updated = topics.map(t => t.id === id ? { ...t, isDone: !t.isDone } : t);
    setTopics(updated);
    await setItem(StorageKeys.TOPICS, updated);
    if (user?.id) void writeUserCache(user.id, 'topics', updated);
  };

  const deleteTopic = async (id: string) => {
    const updated = topics.map(t => t.id === id ? { ...t, isDeleted: true } : t);
    setTopics(updated);
    await setItem(StorageKeys.TOPICS, updated);
    if (user?.id) void writeUserCache(user.id, 'topics', updated);
  };

  // ── XP ────────────────────────────────────────────────────────────────────
  const awardXP = async (amount: number, reason: string) => {
    if (!user) return;
    const txPayload = { id: uuidv4(), user_id: user.id, amount, reason, created_at: new Date().toISOString() };
    const newXPLog = [mapXP(txPayload), ...xpLog];
    setXpLog(newXPLog);
    await setItem(StorageKeys.XP_LOG, newXPLog);
    void writeUserCache(user.id, 'xpLog', newXPLog);
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
    void writeUserCache(user.id, 'xpLog', newXPLog);
    await setUser({ ...user, xpTotal: Math.max(0, user.xpTotal - amount) });
    try {
      const { error } = await supabase.from('xp_transactions').insert([txPayload]);
      if (error) throw error;
    } catch {
      await addToSyncQueue({ table: 'xp_transactions', action: 'insert', payload: txPayload });
    }
  };

  // ── Sessions ──────────────────────────────────────────────────────────────
  const startSession = async (plannedMins: number, subjectId: string | null, chapterId: string | null, isRecoverySession?: boolean, recoveryLostStreak?: number): Promise<string> => {
    const sessionId = uuidv4();
    const active: ActiveSession = {
      sessionId,
      startedAt: new Date().toISOString(),
      plannedMins,
      subjectId,
      chapterId,
      isRecovery: isRecoverySession ?? streakRecoveryPending,
      recoveryLostStreak: isRecoverySession ? (recoveryLostStreak ?? lostStreakCount) : undefined,
    };
    setActiveSession(active);
    await setItem(StorageKeys.ACTIVE_SESSION, active);
    return sessionId;
  };

  const COMEBACK_BONUS_XP = 50;

  const completeSession = async (sessionId: string, actualMins: number): Promise<(FocusSession & { leveledUp?: boolean; newLevelRank?: number; totalXP?: number; referralXpAwarded?: number }) | null> => {
    const isRecoverySession = Boolean(activeSession?.isRecovery || streakRecoveryPending);
    if (!isStreakRecoveryEligible(isRecoverySession, actualMins)) return null;

    try {
      const activeUser = user ?? await getItem<UserProfile>(StorageKeys.USER);
      const bonusFromComeback = comebackPending ? COMEBACK_BONUS_XP : 0;
      const xp = calculateSessionXP(actualMins) + bonusFromComeback;
      if (comebackPending) setComebackPendingState(false);

      let newXPTotal = activeUser?.xpTotal ?? 0;
      let referralXpAwarded = 0;

      const sessionPayload = {
        id: sessionId,
        user_id: activeUser?.id ?? '',
        subject_id: activeSession?.subjectId ?? null,
        chapter_id: activeSession?.chapterId ?? null,
        planned_minutes: activeSession?.plannedMins ?? actualMins,
        actual_minutes: actualMins,
        completed: true,
        broken: false,
        xp_earned: xp,
        xp_deducted: 0,
        comeback_bonus: bonusFromComeback,
        started_at: activeSession?.startedAt ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
      };

      const sessionObj = mapSession({
        ...sessionPayload,
        broken_at_percent: 100,
      });
      
      const newSessions = [sessionObj, ...sessions];
      setSessions(newSessions);
      await setItem(StorageKeys.SESSIONS, newSessions);
      if (activeUser?.id) void writeUserCache(activeUser.id, 'sessions', newSessions);
      setActiveSession(null);
      await setItem(StorageKeys.ACTIVE_SESSION, null);
      if (activeUser) {
        const recoveryStreak = isRecoverySession
          ? getRecoveredStreak(activeSession?.recoveryLostStreak ?? lostStreakCount)
          : undefined;
        const postSessionResult = await processPostSessionData(actualMins, xp, true, activeUser, recoveryStreak);
        newXPTotal = postSessionResult.newXPTotal;
        let sessionSaved = false;
        try {
          const { error } = await supabase.from('focus_sessions').insert([sessionPayload]);
          if (error) throw error;
          sessionSaved = true;
        } catch {
          await addToSyncQueue({ table: 'focus_sessions', action: 'insert', payload: sessionPayload });
        }
        if (sessionSaved) {
          try {
            const referralResult = await processReferralOnFirstSession(activeUser.id);
            referralXpAwarded = referralResult?.refereeXpAdded ?? 0;
            newXPTotal += referralXpAwarded;
          } catch (referralError) {
            console.warn('[Referral] Processing failed:', referralError);
          }
        }
      }
      const oldLevelRank = activeUser ? getLevelForUser(activeUser).rank : 1;
      const newLevelRank = activeUser ? getLevelForUser({ ...activeUser, xpTotal: newXPTotal }).rank : 1;
      const leveledUp = newLevelRank > oldLevelRank;
      processSyncQueue();
      return { ...sessionObj, leveledUp, newLevelRank, totalXP: newXPTotal, referralXpAwarded };
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
        completed: false,
        broken: true,
        xp_earned: 0,
        xp_deducted: penalty,
        break_reason: 'user_abandoned',
        started_at: activeSession?.startedAt ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
      };

      const sessionObj = mapSession({
        ...sessionPayload,
        broken_at_percent: brokenAt,
      });
      
      const newSessions = [sessionObj, ...sessions];
      setSessions(newSessions);
      await setItem(StorageKeys.SESSIONS, newSessions);
      if (activeUser?.id) void writeUserCache(activeUser.id, 'sessions', newSessions);
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
  const setHasUnlockedReward = (v: boolean) => setHasUnlockedRewardState(v);
  const setStreakRecoveryPending = (v: boolean, lostStreak?: number) => {
    setStreakRecoveryPendingState(v);
    if (lostStreak !== undefined) setLostStreakCount(lostStreak);
  };

  const processPostSessionData = async (
    mins: number,
    xpDelta: number,
    isCompleted: boolean,
    activeUser: UserProfile,
    recoveredStreak?: number,
  ): Promise<{ finalXP: number; newXPTotal: number }> => {
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
      void writeUserCache(activeUser.id, 'dailySummaries', newDaily);
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
        void writeUserCache(activeUser.id, 'xpLog', newXPLog);
        try {
          const { error } = await supabase.from('xp_transactions').insert([txPayload]);
          if (error) throw error;
        } catch {
          await addToSyncQueue({ table: 'xp_transactions', action: 'insert', payload: txPayload });
        }
      }
      const yesterday = daysAgoStr(1);
      let newStreak = activeUser.streakCurrent;
      if (isCompleted && recoveredStreak !== undefined) {
        newStreak = recoveredStreak;
      } else if (isCompleted && activeUser.lastStudyDate !== today) {
        newStreak = (activeUser.lastStudyDate === yesterday || activeUser.lastStudyDate === null) ? newStreak + 1 : 1;
      } else if (!isCompleted) {
        newStreak = 0;
      }
      
      const newXPTotal = Math.max(0, activeUser.xpTotal + finalXP);
      await setUser({
        ...activeUser,
        xpTotal: newXPTotal,
        streakCurrent: newStreak,
        streakLongest: Math.max(newStreak, activeUser.streakLongest),
        lastStudyDate: isCompleted ? today : activeUser.lastStudyDate,
      });
      return { finalXP, newXPTotal };
    } catch (e) {
      console.error('Failed to process post session data', e);
      return {
        finalXP: xpDelta,
        newXPTotal: Math.max(0, activeUser.xpTotal + xpDelta),
      };
    }
  };

  const getDailySummary = (date: string) => dailySummaries.find(s => s.date === date) ?? null;

  const getEmptySummary = (daysAgo: number): DailySummary => {
    const d = daysAgoStr(daysAgo);
    return dailySummaries.find(s => s.date === d) ?? {
      id: '', userId: user?.id || '', date: d, totalMinutes: 0,
      sessionsCompleted: 0, sessionsBroken: 0, goalMinutes: user?.dailyGoalMinutes ?? 120, goalMet: false, xpEarned: 0,
    };
  };

  const last7Days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => getEmptySummary(6 - i)),
    [dailySummaries, user?.id, user?.dailyGoalMinutes],
  );
  const last90Days = useMemo(
    () => Array.from({ length: 90 }, (_, i) => getEmptySummary(89 - i)),
    [dailySummaries, user?.id, user?.dailyGoalMinutes],
  );
  const getLast7Days = () => last7Days;
  const getLast90Days = () => last90Days;

  const stableSetUser = useStableCallback(setUser);
  const stableSetOnboarded = useStableCallback(setOnboarded);
  const stableAddSubject = useStableCallback(addSubject);
  const stableUpdateSubject = useStableCallback(updateSubject);
  const stableDeleteSubject = useStableCallback(deleteSubject);
  const stableGetChaptersForSubject = useStableCallback(getChaptersForSubject);
  const stableAddChapter = useStableCallback(addChapter);
  const stableUpdateChapter = useStableCallback(updateChapter);
  const stableDeleteChapter = useStableCallback(deleteChapter);
  const stableBulkDeleteChapters = useStableCallback(bulkDeleteChapters);
  const stableGetTopicsForChapter = useStableCallback(getTopicsForChapter);
  const stableAddTopic = useStableCallback(addTopic);
  const stableToggleTopic = useStableCallback(toggleTopic);
  const stableDeleteTopic = useStableCallback(deleteTopic);
  const stableStartSession = useStableCallback(startSession);
  const stableCompleteSession = useStableCallback(completeSession);
  const stableBreakSession = useStableCallback(breakSession);
  const stableGetDailySummary = useStableCallback(getDailySummary);
  const stableGetLast7Days = useStableCallback(getLast7Days);
  const stableGetLast90Days = useStableCallback(getLast90Days);
  const stableAwardXP = useStableCallback(awardXP);
  const stableDeductXP = useStableCallback(deductXP);
  const stableSetComebackPending = useStableCallback(setComebackPending);
  const stableSetHasUnlockedReward = useStableCallback(setHasUnlockedReward);
  const stableSetStreakRecoveryPending = useStableCallback(setStreakRecoveryPending);
  const contextValue = useMemo<AppContextType>(() => ({
    user, isOnboarded, setUser: stableSetUser, setOnboarded: stableSetOnboarded,
    subjects, addSubject: stableAddSubject, updateSubject: stableUpdateSubject, deleteSubject: stableDeleteSubject,
    chapters, chapterAnalytics, getChaptersForSubject: stableGetChaptersForSubject, addChapter: stableAddChapter,
    updateChapter: stableUpdateChapter, deleteChapter: stableDeleteChapter, bulkDeleteChapters: stableBulkDeleteChapters,
    topics, getTopicsForChapter: stableGetTopicsForChapter, addTopic: stableAddTopic,
    toggleTopic: stableToggleTopic, deleteTopic: stableDeleteTopic,
    sessions, dailySummaries, last7Days, last90Days, activeSession, startSession: stableStartSession, completeSession: stableCompleteSession, breakSession: stableBreakSession,
    getDailySummary: stableGetDailySummary, getLast7Days: stableGetLast7Days, getLast90Days: stableGetLast90Days,
    xpLog, awardXP: stableAwardXP, deductXP: stableDeductXP,
    comebackPending, setComebackPending: stableSetComebackPending,
    hasUnlockedReward, setHasUnlockedReward: stableSetHasUnlockedReward, referralCount,
    streakRecoveryPending, lostStreakCount, setStreakRecoveryPending: stableSetStreakRecoveryPending,
    isLoading, reload,
  }), [
    user, isOnboarded, subjects, chapters, chapterAnalytics, topics, sessions, dailySummaries, last7Days, last90Days, activeSession, xpLog,
    comebackPending, hasUnlockedReward, referralCount, streakRecoveryPending, lostStreakCount, isLoading,
    stableSetUser, stableSetOnboarded, stableAddSubject, stableUpdateSubject, stableDeleteSubject,
    stableGetChaptersForSubject, stableAddChapter, stableUpdateChapter, stableDeleteChapter, stableBulkDeleteChapters,
    stableGetTopicsForChapter, stableAddTopic, stableToggleTopic, stableDeleteTopic, stableStartSession,
    stableCompleteSession, stableBreakSession, stableGetDailySummary, stableGetLast7Days, stableGetLast90Days,
    stableAwardXP, stableDeductXP, stableSetComebackPending, stableSetHasUnlockedReward, stableSetStreakRecoveryPending, reload,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

