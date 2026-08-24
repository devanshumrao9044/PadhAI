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

const PROCESS_INSTANCE_ID = uuidv4();

import { getItem, setItem, removeItem, StorageKeys} from '@/features/core/services/storage';
import { readUserCache, removeUserCache, writeUserCache } from '@/features/core/services/cache';
import { supabase } from '@/features/core/services/supabase';
import {
  UserProfile, Subject, Chapter, Topic,
  FocusSession, ChapterAnalytics, DailySummary, XPTransaction, ActiveSession
} from '@/types/models';
import { getLevelForUser } from '@/constants/levels';
import { mergeFocusSessions, mergeXPTransactions } from '@/features/focus/services/sessionPersistence';
import { normalizeChapterAnalyticsRows } from '@/features/analytics/services/chapterAnalytics';
import { reconcileTrackerState } from '@/features/tracker/services/trackerState';
import { getRecoveredStreak, isStreakRecoveryEligible } from '@/features/focus/services/streakRecovery';
import { haptics } from '@/features/core/services/haptics';
import { clearStudyGroupPresence } from '@/features/study-groups/services/studyGroups';
import {
  enqueueOfflineFocusSession,
  isNetworkReachable,
  subscribeToOfflineFocusReconnect,
  syncOfflineFocusQueue,
  clearOfflineFocusQueue,
  submitOfflineFocusSession,
  reconcileOfflineFocusProgress,
} from '@/features/focus/services/offlineFocusSync';
import {
  buildBaselineMarker,
  buildWeeklySettlement,
  createWeeklyMarkerReason,
  getEffectiveLevelRank,
  getLatestWeeklyMarker,
  getWeekStart,
  type WeeklySettlementResult,
} from '@/features/progression/services/weeklyXp';

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
  last30Days: DailySummary[];
  last90Days: DailySummary[];
  activeSession: ActiveSession | null;
  startSession: (plannedMins: number, subjectId: string | null, chapterId: string | null, isRecoverySession?: boolean, recoveryLostStreak?: number, studyGroupId?: string | null) => Promise<string>;
  checkpointActiveSession: (elapsedSeconds: number, clockAnomaly?: boolean) => Promise<void>;
  discardActiveSession: () => Promise<void>;
  completeSession: (sessionId: string, actualMins: number, actualSeconds?: number) => Promise<(FocusSession & { leveledUp?: boolean; newLevelRank?: number; totalXP?: number; referralXpAwarded?: number; syncPending?: boolean; clockAnomaly?: boolean }) | null>;
  breakSession: (sessionId: string, actualMins: number) => Promise<FocusSession | null>;
  getDailySummary: (date: string) => DailySummary | null;
  getLast7Days: () => DailySummary[];
  getLast30Days: () => DailySummary[];
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
  targetExam: u.target_exam ?? 'OTHER',
  classLevel: u.class ?? 'SELF_STUDY',
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
  table?: string;
  action: 'insert' | 'upsert' | 'update' | 'rpc';
  payload?: any;
  matchKey?: string;
  matchValue?: any;
  rpcName?: string;
  rpcArgs?: Record<string, unknown>;
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
          if (task.action === 'rpc') {
            if (task.rpcName !== 'record_weekly_xp_marker') throw new Error('Unsupported sync operation.');
            const { error } = await supabase.rpc(task.rpcName, task.rpcArgs ?? {});
            if (error) throw error;
          } else if (task.action === 'insert') {
            if (!task.table) throw new Error('Sync table is missing.');
            if (task.table === 'focus_sessions') {
              const payload = toFocusSessionDbPayload(task.payload);
              await enqueueOfflineFocusSession({
                sessionId: payload.id,
                userId: payload.user_id,
                subjectId: payload.subject_id ?? null,
                chapterId: payload.chapter_id ?? null,
                studyGroupId: task.payload?.study_group_id ?? null,
                plannedMinutes: Number(payload.planned_minutes ?? payload.actual_minutes ?? 0),
                actualMinutes: Number(payload.actual_minutes ?? 0),
                elapsedSeconds: Number(payload.actual_minutes ?? 0) * 60,
                completed: payload.completed === true,
                broken: payload.broken === true,
                startedAt: payload.started_at,
                endedAt: payload.ended_at ?? payload.started_at,
                clockAnomaly: Boolean(task.payload?.clock_anomaly),
                isRecovery: Boolean(task.payload?.is_recovery),
                recoveryLostStreak: task.payload?.recovery_lost_streak ?? null,
                comebackBonus: Number(payload.comeback_bonus ?? 0),
              });
              remainingQueue = remainingQueue.filter(t => t.id !== task.id);
              continue;
            }
            if (['users', 'daily_summary', 'xp_transactions'].includes(task.table)) {
              console.warn(`[Sync] Dropping legacy direct ${task.table} write; progression is RPC-only.`);
              remainingQueue = remainingQueue.filter(t => t.id !== task.id);
              continue;
            }
            const { error } = await supabase.from(task.table).insert(task.payload);
            if (error) throw error;
          } else if (task.action === 'upsert') {
            if (!task.table) throw new Error('Sync table is missing.');
            if (['users', 'daily_summary', 'xp_transactions'].includes(task.table)) {
              console.warn(`[Sync] Dropping legacy direct ${task.table} upsert; progression is RPC-only.`);
              remainingQueue = remainingQueue.filter(t => t.id !== task.id);
              continue;
            }
            const conflictKey = task.table === 'daily_summary' ? 'user_id,date' : 'id';
            const { error } = await supabase.from(task.table).upsert(task.payload, { onConflict: conflictKey });
            if (error) throw error;
          } else if (task.action === 'update' && task.matchKey) {
            if (!task.table) throw new Error('Sync table is missing.');
            if (['users', 'daily_summary', 'xp_transactions'].includes(task.table)) {
              console.warn(`[Sync] Dropping legacy direct ${task.table} update; progression is RPC-only.`);
              remainingQueue = remainingQueue.filter(t => t.id !== task.id);
              continue;
            }
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
      const { data, error } = await supabase.rpc('record_weekly_xp_marker', {
        p_week_start: marker.weekStart,
      });
      if (error) throw error;
      const serverMarker: WeeklySettlementResult = {
        ...marker,
        markerId: String(data?.marker_id ?? marker.markerId),
        kind: data?.kind === 'settlement' ? 'settlement' : marker.kind,
        zone: data?.zone === 'promotion' || data?.zone === 'safety' || data?.zone === 'demotion' ? data.zone : marker.zone,
        fromLevelRank: Number.isFinite(Number(data?.from_level_rank)) ? Number(data.from_level_rank) : marker.fromLevelRank,
        toLevelRank: Number.isFinite(Number(data?.to_level_rank)) ? Number(data.to_level_rank) : marker.toLevelRank,
        xpAfterReset: 0,
      };
      return mapXP(createWeeklyMarkerTransaction(userId, serverMarker));
    } catch {
      await addToSyncQueue({
        action: 'rpc',
        rpcName: 'record_weekly_xp_marker',
        rpcArgs: { p_week_start: marker.weekStart },
        payload: txPayload,
      });
      return mapXP(txPayload);
    }
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
      userId ? clearOfflineFocusQueue(userId) : Promise.resolve(),
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
          const recoveredActive = savedActive && savedActive.processInstanceId !== PROCESS_INSTANCE_ID && savedActive.status === 'running'
            ? { ...savedActive, status: 'interrupted' as const }
            : savedActive;
          if (recoveredActive && recoveredActive !== savedActive) {
            await setItem(StorageKeys.ACTIVE_SESSION, recoveredActive);
          }
          setActiveSession(recoveredActive ?? null);
          setSessions(cachedSessions?.data ?? savedSessions ?? []);
          setDailySummaries(cachedSummaries?.data ?? savedSummaries ?? []);
          setXpLog(cachedXP?.data ?? savedXP ?? []);
          await processSyncQueue();
          await syncOfflineFocusQueue(userId);
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
          const localSess = cachedSessions?.data ?? savedSessions ?? [];
          const mergedSess = mergeFocusSessions(cloudSess, localSess);
          setSessions(mergedSess);
          await setItem(StorageKeys.SESSIONS, mergedSess);
          void writeUserCache(userId, 'sessions', mergedSess);
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
          console.warn('[Analytics] Chapter analytics load failed');
          if (!cachedAnalytics) setChapterAnalytics([]);
        }
        let loadedXP = cachedXP?.data ?? savedXP ?? [];
        if (xpRes.data) {
          const cloudXP = xpRes.data.map(mapXP);
          loadedXP = mergeXPTransactions(cloudXP, cachedXP?.data ?? savedXP ?? []);
          setXpLog(loadedXP);
          await setItem(StorageKeys.XP_LOG, loadedXP);
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
        const activeUserId = currentUserIdRef.current;
        if (activeUserId) void syncOfflineFocusQueue(activeUserId);
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

  useEffect(() => {
    if (!user?.id) return;
    return subscribeToOfflineFocusReconnect(user.id, results => {
      const accepted = results.find(result => result.status === 'accepted' || result.status === 'duplicate');
      if (!accepted) return;
      void (async () => {
        const cachedUser = await getItem<UserProfile>(StorageKeys.USER);
        if (!cachedUser || cachedUser.id !== user.id) return;
        const reconciledUser = reconcileOfflineFocusProgress(cachedUser, accepted);
        if (reconciledUser !== cachedUser) {
          setUserState(reconciledUser);
          await setItem(StorageKeys.USER, reconciledUser);
          void writeUserCache(user.id, 'user', reconciledUser);
        }
        await reload({ force: true });
      })();
    });
  }, [reload, user?.id]);

  // ── setUser: local cache/state only. Server-controlled progression fields are
  // settled by authenticated RPCs and reloaded from Supabase. ────────────────
  const setUser = async (u: UserProfile) => {
    setUserState(u);
    setIsOnboardedState(Boolean(u.fullName && u.fullName !== 'Student'));
    await setItem(StorageKeys.USER, u);
    void writeUserCache(u.id, 'user', u);
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
  // XP is granted or deducted only by the server-authoritative focus settlement
  // RPC. Keeping these methods in the context preserves the public contract for
  // older screens while making accidental client-side mutation impossible.
  const awardXP = async (_amount: number, _reason: string) => {
    throw new Error('XP can only be granted by a verified focus session.');
  };

  const deductXP = async (_amount: number, _reason: string) => {
    throw new Error('XP can only be deducted by a verified focus session.');
  };

  // ── Sessions ──────────────────────────────────────────────────────────────
  const startSession = async (plannedMins: number, subjectId: string | null, chapterId: string | null, isRecoverySession?: boolean, recoveryLostStreak?: number, studyGroupId?: string | null): Promise<string> => {
    const sessionId = uuidv4();
    const active: ActiveSession = {
      sessionId,
      startedAt: new Date().toISOString(),
      plannedMins,
      subjectId,
      chapterId,
      studyGroupId: studyGroupId ?? null,
      isRecovery: isRecoverySession ?? streakRecoveryPending,
      recoveryLostStreak: isRecoverySession ? (recoveryLostStreak ?? lostStreakCount) : undefined,
      status: 'running',
      checkpointElapsedSeconds: 0,
      lastCheckpointAt: new Date().toISOString(),
      lastWallClockAt: new Date().toISOString(),
      clockAnomaly: false,
      processInstanceId: PROCESS_INSTANCE_ID,
    };
    setActiveSession(active);
    await setItem(StorageKeys.ACTIVE_SESSION, active);
    return sessionId;
  };

  const discardActiveSession = async () => {
    setActiveSession(null);
    await setItem(StorageKeys.ACTIVE_SESSION, null);
  };

  const checkpointActiveSession = async (elapsedSeconds: number, clockAnomaly = false) => {
    if (!activeSession) return;
    const now = new Date().toISOString();
    const next: ActiveSession = {
      ...activeSession,
      status: clockAnomaly ? 'verification_required' : 'running',
      checkpointElapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
      lastCheckpointAt: now,
      lastWallClockAt: now,
      clockAnomaly: Boolean(activeSession.clockAnomaly || clockAnomaly),
    };
    setActiveSession(next);
    await setItem(StorageKeys.ACTIVE_SESSION, next);
  };

  const COMEBACK_BONUS_XP = 50;
  const isStreakMilestone = (value: number) => value >= 3 && (value % 7 === 0 || [30, 60, 100].includes(value));

  const completeSession = async (sessionId: string, actualMins: number, actualSeconds = actualMins * 60): Promise<(FocusSession & { leveledUp?: boolean; newLevelRank?: number; totalXP?: number; referralXpAwarded?: number; syncPending?: boolean; syncRejected?: boolean; syncError?: string; clockAnomaly?: boolean }) | null> => {
    const isRecoverySession = Boolean(activeSession?.isRecovery || streakRecoveryPending);
    if (!isStreakRecoveryEligible(isRecoverySession, actualMins)) return null;

    try {
      const activeUser = user ?? await getItem<UserProfile>(StorageKeys.USER);
      if (!activeUser?.id) return null;
      const bonusFromComeback = comebackPending ? COMEBACK_BONUS_XP : 0;
      const studyGroupId = activeSession?.studyGroupId ?? null;
      const startedAt = activeSession?.startedAt ?? new Date().toISOString();
      const endedAt = new Date().toISOString();
      const clockAnomaly = Boolean(activeSession?.clockAnomaly);
      const settlement = {
        sessionId,
        userId: activeUser.id,
        subjectId: activeSession?.subjectId ?? null,
        chapterId: activeSession?.chapterId ?? null,
        studyGroupId,
        plannedMinutes: activeSession?.plannedMins ?? actualMins,
        actualMinutes: Math.max(0, Math.floor(actualMins)),
        elapsedSeconds: Math.max(actualMins * 60, Math.floor(actualSeconds)),
        completed: true,
        broken: false,
        startedAt,
        endedAt,
        clockAnomaly,
        isRecovery: isRecoverySession,
        recoveryLostStreak: activeSession?.recoveryLostStreak ?? lostStreakCount,
        comebackBonus: bonusFromComeback,
      };

      if (comebackPending) setComebackPendingState(false);
      const networkAvailable = await isNetworkReachable();
      const syncPending = !networkAvailable || clockAnomaly;
      if (syncPending) {
        await enqueueOfflineFocusSession(settlement);
        const localSession = mapSession({
          id: sessionId,
          user_id: activeUser.id,
          subject_id: settlement.subjectId,
          chapter_id: settlement.chapterId,
          planned_minutes: settlement.plannedMinutes,
          actual_minutes: settlement.actualMinutes,
          completed: true,
          broken: false,
          xp_earned: 0,
          xp_deducted: 0,
          comeback_bonus: bonusFromComeback,
          started_at: startedAt,
          ended_at: endedAt,
          broken_at_percent: 100,
        });
        const newSessions = [localSession, ...sessions];
        setSessions(newSessions);
        await setItem(StorageKeys.SESSIONS, newSessions);
        void writeUserCache(activeUser.id, 'sessions', newSessions);
        setActiveSession(null);
        await setItem(StorageKeys.ACTIVE_SESSION, null);
        return {
          ...localSession,
          leveledUp: false,
          newLevelRank: getLevelForUser(activeUser).rank,
          totalXP: activeUser.xpTotal,
          referralXpAwarded: 0,
          syncPending: true,
          clockAnomaly,
        };
      }

      const { data, error } = await submitOfflineFocusSession(settlement);
      if (error) {
        await enqueueOfflineFocusSession(settlement);
        const localSession = mapSession({
          id: sessionId,
          user_id: activeUser.id,
          subject_id: settlement.subjectId,
          chapter_id: settlement.chapterId,
          planned_minutes: settlement.plannedMinutes,
          actual_minutes: settlement.actualMinutes,
          completed: true,
          broken: false,
          xp_earned: 0,
          xp_deducted: 0,
          comeback_bonus: bonusFromComeback,
          started_at: startedAt,
          ended_at: endedAt,
          broken_at_percent: 100,
        });
        const newSessions = [localSession, ...sessions];
        setSessions(newSessions);
        await setItem(StorageKeys.SESSIONS, newSessions);
        void writeUserCache(activeUser.id, 'sessions', newSessions);
        setActiveSession(null);
        await setItem(StorageKeys.ACTIVE_SESSION, null);
        return {
          ...localSession,
          leveledUp: false,
          newLevelRank: getLevelForUser(activeUser).rank,
          totalXP: activeUser.xpTotal,
          referralXpAwarded: 0,
          syncPending: true,
          clockAnomaly: false,
        };
      }
      if (data?.accepted !== true) {
        const rejectedSession = mapSession({
          id: sessionId,
          user_id: activeUser.id,
          subject_id: settlement.subjectId,
          chapter_id: settlement.chapterId,
          planned_minutes: settlement.plannedMinutes,
          actual_minutes: settlement.actualMinutes,
          completed: true,
          broken: false,
          xp_earned: 0,
          xp_deducted: 0,
          comeback_bonus: bonusFromComeback,
          started_at: startedAt,
          ended_at: endedAt,
          broken_at_percent: 100,
        });
        setActiveSession(null);
        await setItem(StorageKeys.ACTIVE_SESSION, null);
        return {
          ...rejectedSession,
          leveledUp: false,
          newLevelRank: getLevelForUser(activeUser).rank,
          totalXP: activeUser.xpTotal,
          referralXpAwarded: 0,
          syncRejected: true,
          syncError: data?.conflict_code ?? 'verification_failed',
          clockAnomaly: false,
        };
      }

      const verifiedMinutes = Number(data.verified_minutes ?? settlement.actualMinutes);
      const verifiedXp = Number(data.xp_earned ?? 0);
      const referralXpAwarded = Number(data.referral_xp_awarded ?? 0);
      const sessionObj = mapSession({
        id: sessionId,
        user_id: activeUser.id,
        subject_id: settlement.subjectId,
        chapter_id: settlement.chapterId,
        planned_minutes: settlement.plannedMinutes,
        actual_minutes: verifiedMinutes,
        completed: true,
        broken: false,
        xp_earned: verifiedXp,
        xp_deducted: 0,
        comeback_bonus: bonusFromComeback,
        started_at: startedAt,
        ended_at: endedAt,
        broken_at_percent: 100,
      });
      if (data.duplicate === true) {
        // The server already settled this session. Reconcile by reload only;
        // never replay the returned XP locally.
        setActiveSession(null);
        await setItem(StorageKeys.ACTIVE_SESSION, null);
        void reload({ force: true });
        return {
          ...sessionObj,
          leveledUp: false,
          newLevelRank: getLevelForUser(activeUser).rank,
          totalXP: activeUser.xpTotal,
          referralXpAwarded: 0,
        };
      }
      const newSessions = [sessionObj, ...sessions];
      setSessions(newSessions);
      await setItem(StorageKeys.SESSIONS, newSessions);
      void writeUserCache(activeUser.id, 'sessions', newSessions);
      setActiveSession(null);
      await setItem(StorageKeys.ACTIVE_SESSION, null);

      const recoveryStreak = isRecoverySession
        ? getRecoveredStreak(activeSession?.recoveryLostStreak ?? lostStreakCount)
        : undefined;
      const postSessionResult = await processPostSessionData(
        verifiedMinutes,
        verifiedXp,
        true,
        activeUser,
        recoveryStreak,
        {
          newXpTotal: Number(data.new_xp_total),
          newStreak: Number(data.new_streak),
        },
        sessionId,
      );
      const oldLevelRank = getLevelForUser(activeUser).rank;
      const newLevelRank = getLevelForUser({ ...activeUser, xpTotal: postSessionResult.newXPTotal }).rank;
      const leveledUp = newLevelRank > oldLevelRank;
      if (studyGroupId) {
        try {
          await clearStudyGroupPresence(studyGroupId, activeUser.id);
        } catch {
          // Stale presence is treated as offline by the secure member-summary RPC.
        }
      }
      void reload({ force: true });
      return { ...sessionObj, leveledUp, newLevelRank, totalXP: postSessionResult.newXPTotal, referralXpAwarded };
    } catch {
      return null;
    }
  };

  const breakSession = async (sessionId: string, actualMins: number): Promise<FocusSession | null> => {
    try {
      const activeUser = user ?? await getItem<UserProfile>(StorageKeys.USER);
      if (!activeUser?.id) return null;
      const planned = activeSession?.plannedMins ?? 1;
      const studyGroupId = activeSession?.studyGroupId ?? null;
      const startedAt = activeSession?.startedAt ?? new Date().toISOString();
      const endedAt = new Date().toISOString();
      const clockAnomaly = Boolean(activeSession?.clockAnomaly);
      const settlement = {
        sessionId,
        userId: activeUser.id,
        subjectId: activeSession?.subjectId ?? null,
        chapterId: activeSession?.chapterId ?? null,
        studyGroupId,
        plannedMinutes: planned,
        actualMinutes: Math.max(0, Math.floor(actualMins)),
        elapsedSeconds: Math.max(0, Math.floor(actualMins * 60)),
        completed: false,
        broken: true,
        startedAt,
        endedAt,
        clockAnomaly,
        isRecovery: false,
        recoveryLostStreak: null,
        comebackBonus: 0,
      };
      const networkAvailable = await isNetworkReachable();
      const syncPending = !networkAvailable || clockAnomaly;
      if (syncPending) {
        await enqueueOfflineFocusSession(settlement);
        const localSession = mapSession({
          id: sessionId,
          user_id: activeUser.id,
          subject_id: settlement.subjectId,
          chapter_id: settlement.chapterId,
          planned_minutes: planned,
          actual_minutes: settlement.actualMinutes,
          completed: false,
          broken: true,
          xp_earned: 0,
          xp_deducted: 0,
          break_reason: 'user_abandoned',
          started_at: startedAt,
          ended_at: endedAt,
          broken_at_percent: Math.floor((settlement.actualMinutes / Math.max(1, planned)) * 100),
        });
        const newSessions = [localSession, ...sessions];
        setSessions(newSessions);
        await setItem(StorageKeys.SESSIONS, newSessions);
        void writeUserCache(activeUser.id, 'sessions', newSessions);
        setActiveSession(null);
        await setItem(StorageKeys.ACTIVE_SESSION, null);
        return { ...localSession, syncPending: true, clockAnomaly } as FocusSession & { syncPending: boolean; clockAnomaly: boolean };
      }

      const { data, error } = await submitOfflineFocusSession(settlement);
      if (error) throw error;
      if (data?.accepted !== true) {
        throw new Error(data?.message ?? 'The broken session could not be verified.');
      }
      const verifiedMinutes = Number(data.verified_minutes ?? settlement.actualMinutes);
      const verifiedPenalty = Number(data.xp_deducted ?? 0);
      const sessionObj = mapSession({
        id: sessionId,
        user_id: activeUser.id,
        subject_id: settlement.subjectId,
        chapter_id: settlement.chapterId,
        planned_minutes: planned,
        actual_minutes: verifiedMinutes,
        completed: false,
        broken: true,
        xp_earned: 0,
        xp_deducted: verifiedPenalty,
        break_reason: 'user_abandoned',
        started_at: startedAt,
        ended_at: endedAt,
        broken_at_percent: Math.floor((verifiedMinutes / Math.max(1, planned)) * 100),
      });
      const newSessions = [sessionObj, ...sessions];
      setSessions(newSessions);
      await setItem(StorageKeys.SESSIONS, newSessions);
      void writeUserCache(activeUser.id, 'sessions', newSessions);
      setActiveSession(null);
      await setItem(StorageKeys.ACTIVE_SESSION, null);
      await processPostSessionData(
        verifiedMinutes,
        -verifiedPenalty,
        false,
        activeUser,
        undefined,
        {
          newXpTotal: Number(data.new_xp_total),
          newStreak: Number(data.new_streak),
        },
        sessionId,
      );
      if (studyGroupId) {
        try {
          await clearStudyGroupPresence(studyGroupId, activeUser.id);
        } catch {
          // Stale presence is treated as offline by the secure member-summary RPC.
        }
      }
      void reload({ force: true });
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
    serverState?: { newXpTotal?: number; newStreak?: number },
    transactionId?: string,
  ): Promise<{ finalXP: number; newXPTotal: number }> => {
    try {
      const today = todayStr();
      const existingSummary = dailySummaries.find(s => s.date === today);
      const newTotalMins = (existingSummary?.totalMinutes || 0) + mins;
      const goalMet = newTotalMins >= activeUser.dailyGoalMinutes;
      const finalXP = xpDelta;
      const summaryPayload = {
        id: existingSummary?.id || uuidv4(),
        user_id: activeUser.id,
        date: today,
        total_focus_minutes: newTotalMins,
        sessions_completed: (existingSummary?.sessionsCompleted || 0) + (isCompleted ? 1 : 0),
        sessions_broken: (existingSummary?.sessionsBroken || 0) + (isCompleted ? 0 : 1),
        goal_minutes: activeUser.dailyGoalMinutes,
        goal_met: goalMet,
        xp_earned: (existingSummary?.xpEarned || 0) + (finalXP > 0 ? finalXP : 0),
      };
      const newDaily = [mapSummary(summaryPayload), ...dailySummaries.filter(s => s.date !== today)];
      setDailySummaries(newDaily);
      await setItem(StorageKeys.DAILY_SUMMARY, newDaily);
      void writeUserCache(activeUser.id, 'dailySummaries', newDaily);

      if (finalXP !== 0) {
        const txPayload = {
          id: transactionId || uuidv4(),
          user_id: activeUser.id,
          amount: finalXP,
          reason: isCompleted ? 'session_complete' : 'session_broken',
          created_at: new Date().toISOString(),
        };
        const newXPLog = [mapXP(txPayload), ...xpLog.filter(transaction => transaction.id !== txPayload.id)];
        setXpLog(newXPLog);
        await setItem(StorageKeys.XP_LOG, newXPLog);
        void writeUserCache(activeUser.id, 'xpLog', newXPLog);
      }

      const yesterday = daysAgoStr(1);
      const fallbackStreak = isCompleted && recoveredStreak !== undefined
        ? recoveredStreak
        : isCompleted && activeUser.lastStudyDate !== today
          ? (activeUser.lastStudyDate === yesterday || activeUser.lastStudyDate === null ? activeUser.streakCurrent + 1 : 1)
          : isCompleted ? activeUser.streakCurrent : 0;
      const newStreak = Number.isFinite(serverState?.newStreak) ? Number(serverState?.newStreak) : fallbackStreak;
      const fallbackXP = Math.max(0, activeUser.xpTotal + finalXP);
      const newXPTotal = Number.isFinite(serverState?.newXpTotal) ? Number(serverState?.newXpTotal) : fallbackXP;
      if (finalXP > 0) void haptics.xpGain();
      if (isCompleted && newStreak > activeUser.streakCurrent && isStreakMilestone(newStreak)) {
        void haptics.streakMilestone();
      }
      await setUser({
        ...activeUser,
        xpTotal: newXPTotal,
        streakCurrent: newStreak,
        streakLongest: Math.max(newStreak, activeUser.streakLongest),
        lastStudyDate: isCompleted ? today : activeUser.lastStudyDate,
      });
      return { finalXP, newXPTotal };
    } catch (e) {
      console.error('Failed to process local post session data', e);
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
  const last30Days = useMemo(
    () => Array.from({ length: 30 }, (_, i) => getEmptySummary(29 - i)),
    [dailySummaries, user?.id, user?.dailyGoalMinutes],
  );
  const last90Days = useMemo(
    () => Array.from({ length: 90 }, (_, i) => getEmptySummary(89 - i)),
    [dailySummaries, user?.id, user?.dailyGoalMinutes],
  );
  const getLast7Days = () => last7Days;
  const getLast30Days = () => last30Days;
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
  const stableCheckpointActiveSession = useStableCallback(checkpointActiveSession);
  const stableDiscardActiveSession = useStableCallback(discardActiveSession);
  const stableCompleteSession = useStableCallback(completeSession);
  const stableBreakSession = useStableCallback(breakSession);
  const stableGetDailySummary = useStableCallback(getDailySummary);
  const stableGetLast7Days = useStableCallback(getLast7Days);
  const stableGetLast30Days = useStableCallback(getLast30Days);
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
    sessions, dailySummaries, last7Days, last30Days, last90Days, activeSession, startSession: stableStartSession, checkpointActiveSession: stableCheckpointActiveSession, discardActiveSession: stableDiscardActiveSession, completeSession: stableCompleteSession, breakSession: stableBreakSession,
    getDailySummary: stableGetDailySummary, getLast7Days: stableGetLast7Days, getLast30Days: stableGetLast30Days, getLast90Days: stableGetLast90Days,
    xpLog, awardXP: stableAwardXP, deductXP: stableDeductXP,
    comebackPending, setComebackPending: stableSetComebackPending,
    hasUnlockedReward, setHasUnlockedReward: stableSetHasUnlockedReward, referralCount,
    streakRecoveryPending, lostStreakCount, setStreakRecoveryPending: stableSetStreakRecoveryPending,
    isLoading, reload,
  }), [
    user, isOnboarded, subjects, chapters, chapterAnalytics, topics, sessions, dailySummaries, last7Days, last30Days, last90Days, activeSession, xpLog,
    comebackPending, hasUnlockedReward, referralCount, streakRecoveryPending, lostStreakCount, isLoading,
    stableSetUser, stableSetOnboarded, stableAddSubject, stableUpdateSubject, stableDeleteSubject,
    stableGetChaptersForSubject, stableAddChapter, stableUpdateChapter, stableDeleteChapter, stableBulkDeleteChapters,
        stableGetTopicsForChapter, stableAddTopic, stableToggleTopic, stableDeleteTopic, stableStartSession, stableCheckpointActiveSession, stableDiscardActiveSession,
     stableCompleteSession, stableBreakSession, stableGetDailySummary, stableGetLast7Days, stableGetLast30Days, stableGetLast90Days,
    stableAwardXP, stableDeductXP, stableSetComebackPending, stableSetHasUnlockedReward, stableSetStreakRecoveryPending, reload,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

